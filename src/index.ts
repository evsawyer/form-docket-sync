/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import types
import { Bindings } from './types/environment';

// Import services
import { getSubmissionDetails } from './services/jotform';
import { processWebhookInBackground } from './services/webhook';
import { getAddressFromSubmission } from './extractors/address';
import { getStateAbbreviation, getStateName } from './processors/state';
import { convertPngToSvg, convertSignatureUrlToSvg, convertPngToSvgPotrace, convertPngToSvgPosterized, convertSignatureUrlToSvgPotrace } from './processors/svg-signature';
import { getSignatureFromSubmission } from './extractors/signature';
import { trace } from 'ts-potrace';
import { Buffer } from 'buffer';

// Create Hono app with proper typing
const app = new Hono<{ Bindings: Bindings }>();

// Apply CORS middleware to all routes
app.use('/*', cors());

// Routes

// Home route
app.get('/', (c) => {
	return c.text('JotForm to LeadDocket Sync Worker - Available endpoints: POST /webhook, POST /test-address, POST /test-svg-signature, POST /test-png-url, POST /test-potrace-comparison, POST /test-potrace-direct, POST /test-potrace-configs, GET /debug-buffer-image, GET /preview-svg, GET /compare-svg');
});

// GET endpoint to fetch and log complete JotForm submission data
// app.get('/submission/:submissionId', async (c) => {
// 	const submissionId = c.req.param('submissionId');
	
// 	if (!submissionId) {
// 		return c.json({ 
// 			error: 'Missing required parameter: submissionId' 
// 		}, 400);
// 	}

// 	try {
// 		console.log(`=== Manual Submission Fetch for ${submissionId} ===`);
// 		console.log(`Fetching submission details for ID: ${submissionId}`);
// 		console.log(`Equivalent curl command:`);
// 		console.log(`curl -X GET "https://api.jotform.com/submission/${submissionId}?apiKey=${c.env.JOTFORM_API_KEY.substring(0, 8)}..."`);
		
// 		const submissionData = await getSubmissionDetails(submissionId, c.env.JOTFORM_API_KEY);
		
// 		if (!submissionData) {
// 			console.error('Failed to fetch submission details from JotForm API');
// 			return c.json({ 
// 				error: 'Failed to fetch submission details from JotForm API' 
// 			}, 500);
// 		}

// 		console.log(`Successfully fetched submission data for ${submissionId}`);
// 		console.log(`=== FULL JOTFORM SUBMISSION DATA ===`);
// 		console.log(JSON.stringify(submissionData, null, 2));
// 		console.log(`=== END JOTFORM SUBMISSION DATA ===`);

// 		// Return the complete submission data
// 		return c.json({
// 			success: true,
// 			submissionId: submissionId,
// 			curlCommand: `curl -X GET "https://api.jotform.com/submission/${submissionId}?apiKey=YOUR_API_KEY"`,
// 			data: submissionData
// 		});

// 	} catch (error) {
// 		console.error('Error fetching submission:', error);
// 		return c.json({ 
// 			error: 'Failed to fetch submission',
// 			message: error instanceof Error ? error.message : 'Unknown error'
// 		}, 500);
// 	}
// });

// Test endpoint for autocompleted address parsing
app.post('/test-address', async (c) => {
	try {
		console.log('=== Test Address Endpoint Received ===');
		
		// Extract submissionID from form data (same as webhook)
		const formData = await c.req.formData();
		const submissionId = formData.get('submissionID')?.toString();
		const formId = formData.get('formID')?.toString();
		const formTitle = formData.get('formTitle')?.toString();
		
		console.log(`Test Address: FormID=${formId}, SubmissionID=${submissionId}, Title="${formTitle}"`);
		
		if (!submissionId) {
			console.error('No submissionID found in test payload');
			return c.json({ 
				error: 'Missing submissionID in test payload' 
			}, 400);
		}

		// Fetch submission data to test address parsing
		console.log(`Fetching submission details for address test: ${submissionId}`);
		const submissionData = await getSubmissionDetails(submissionId, c.env.JOTFORM_API_KEY);
		
		if (!submissionData) {
			console.error('Failed to fetch submission details from JotForm API');
			return c.json({ 
				error: 'Failed to fetch submission details from JotForm API' 
			}, 500);
		}

		// Test address parsing (now uses autocompleted address by default)
		const testAddressData = getAddressFromSubmission(submissionData)[0] || null;
		
		// Add formatted state fields if address was found
		let formattedStateData = null;
		if (testAddressData?.state) {
			// JotForm provides state abbreviation (e.g., "CA"), so we need to get the full name
			const stateAbbr = testAddressData.state; // This is already the abbreviation
			const stateName = getStateName(stateAbbr); // Convert abbreviation to full name
			
			formattedStateData = {
				state: stateName ? `${stateAbbr} - ${stateName}` : stateAbbr,
				state_abbr: stateAbbr,
				state_name: stateName
			};
		}
		
		console.log('=== TEST ADDRESS PARSING RESULTS ===');
		console.log('Parsed Address Data:', JSON.stringify(testAddressData, null, 2));
		if (formattedStateData) {
			console.log('Formatted State Data:', JSON.stringify(formattedStateData, null, 2));
		}
		console.log('=== END TEST ADDRESS PARSING ===');

		return c.json({ 
			success: true,
			message: 'Address parsing test completed',
			submissionId: submissionId,
			parsedAddress: testAddressData,
			formattedState: formattedStateData
		});
		
	} catch (error) {
		console.error('Test address error:', error);
		return c.json({ 
			error: 'Failed to process test address',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Test endpoint for Zhang-Suen SVG signature conversion from JotForm submission
app.post('/test-svg-signature', async (c) => {
	try {
		console.log('=== Test SVG Signature Endpoint Received ===');
		
		// Handle both form-data and JSON content types
		let submissionId: string | undefined;
		let threshold = 150;
		let strokeWidth = 1;
		let fitError = 2.0;
		
		const contentType = c.req.header('content-type') || '';
		
		if (contentType.includes('application/json')) {
			const jsonData = await c.req.json();
			submissionId = jsonData.submissionId;
			threshold = jsonData.threshold || 150;
			strokeWidth = jsonData.strokeWidth || 1;
			fitError = jsonData.fitError || 2.0;
		} else {
			// Assume form-data (from webhook format)
			const formData = await c.req.formData();
			submissionId = formData.get('submissionID')?.toString();
		}
		
		console.log(`Test SVG: SubmissionID=${submissionId}, threshold=${threshold}, strokeWidth=${strokeWidth}, fitError=${fitError}`);
		
		if (!submissionId) {
			console.error('No submissionID found in test payload');
			return c.json({ 
				error: 'Missing submissionID in test payload' 
			}, 400);
		}

		// Fetch submission data to get signature
		console.log(`Fetching submission details for SVG test: ${submissionId}`);
		const submissionData = await getSubmissionDetails(submissionId, c.env.JOTFORM_API_KEY);
		
		if (!submissionData) {
			console.error('Failed to fetch submission details from JotForm API');
			return c.json({ 
				error: 'Failed to fetch submission details from JotForm API' 
			}, 500);
		}

		// Extract signature and convert to SVG using Zhang-Suen
		const signatureBase64 = await getSignatureFromSubmission(submissionData, c.env.JOTFORM_API_KEY);
		
		if (!signatureBase64) {
			console.log('No signature found in submission');
			return c.json({ 
				success: true,
				message: 'No signature found in submission',
				submissionId: submissionId,
				svg: null
			});
		}

		console.log('Converting signature to SVG using Zhang-Suen + cubic Bézier...');
		const svg = await convertPngToSvg(signatureBase64, threshold, strokeWidth, fitError);
		
		console.log('=== TEST SVG SIGNATURE CONVERSION RESULTS ===');
		console.log(`SVG length: ${svg?.length || 0}`);
		console.log('=== END TEST SVG SIGNATURE CONVERSION ===');

		return c.json({ 
			success: true,
			message: 'SVG signature conversion test completed',
			submissionId: submissionId,
			threshold: threshold,
			strokeWidth: strokeWidth,
			fitError: fitError,
			svg: svg
		});
		
	} catch (error) {
		console.error('Test SVG signature error:', error);
		return c.json({ 
			error: 'Failed to process test SVG signature',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Test endpoint for direct PNG URL to SVG conversion using Zhang-Suen
app.post('/test-png-url', async (c) => {
	try {
		console.log('=== Test PNG URL to SVG Endpoint Received ===');
		
		const { pngUrl, threshold = 150, strokeWidth = 1, fitError = 2.0 } = await c.req.json();
		console.log(`Testing PNG URL: ${pngUrl}`);
		
		if (!pngUrl) {
			return c.json({ 
				error: 'Missing pngUrl in request body' 
			}, 400);
		}

		console.log('Converting PNG URL to SVG using Zhang-Suen + cubic Bézier...');
		const svg = await convertSignatureUrlToSvg(pngUrl, c.env.JOTFORM_API_KEY, threshold, strokeWidth, fitError);
		
		console.log('=== TEST PNG URL CONVERSION RESULTS ===');
		console.log(`SVG length: ${svg?.length || 0}`);
		console.log('=== END TEST PNG URL CONVERSION ===');

		return c.json({ 
			success: true,
			message: 'PNG URL to SVG conversion test completed',
			pngUrl: pngUrl,
			threshold: threshold,
			strokeWidth: strokeWidth,
			fitError: fitError,
			svg: svg
		});
		
	} catch (error) {
		console.error('Test PNG URL error:', error);
		return c.json({ 
			error: 'Failed to process test PNG URL',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Preview SVG endpoint - displays SVG directly in browser
app.get('/preview-svg', async (c) => {
	try {
		const svgData = c.req.query('svg');
		
		if (!svgData) {
			return c.html(`
				<html>
					<body>
						<h1>SVG Preview</h1>
						<p>No SVG data provided. Use ?svg=ENCODED_SVG_DATA</p>
						<p>Example: <code>/preview-svg?svg=${encodeURIComponent('<svg>...</svg>')}</code></p>
					</body>
				</html>
			`);
		}

		const decodedSvg = decodeURIComponent(svgData);
		
		return c.html(`
			<html>
				<head>
					<title>SVG Preview</title>
					<style>
						body { font-family: Arial, sans-serif; margin: 20px; }
						.svg-container { border: 1px solid #ccc; padding: 20px; margin: 20px 0; background: #f9f9f9; }
						.svg-code { background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
					</style>
				</head>
				<body>
					<h1>SVG Preview</h1>
					<div class="svg-container">
						<h3>Rendered SVG:</h3>
						${decodedSvg}
					</div>
					<div class="svg-code">
						<h3>SVG Code:</h3>
						${decodedSvg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
					</div>
				</body>
			</html>
		`, 200, {
			'Content-Type': 'text/html'
		});
		
	} catch (error) {
		console.error('Preview SVG error:', error);
		return c.json({ 
			error: 'Failed to preview SVG',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Compare SVG endpoint - displays two SVGs side by side
app.get('/compare-svg', async (c) => {
	try {
		const zhangSuenSvg = c.req.query('zhang');
		const potraceSvg = c.req.query('potrace');
		
		if (!zhangSuenSvg && !potraceSvg) {
			return c.html(`
				<html>
					<body>
						<h1>SVG Comparison</h1>
						<p>No SVG data provided. Use ?zhang=ENCODED_SVG_DATA&potrace=ENCODED_SVG_DATA</p>
						<p>Example: <code>/compare-svg?zhang=${encodeURIComponent('<svg>...</svg>')}&potrace=${encodeURIComponent('<svg>...</svg>')}</code></p>
					</body>
				</html>
			`);
		}

		const decodedZhangSuen = zhangSuenSvg ? decodeURIComponent(zhangSuenSvg) : null;
		const decodedPotrace = potraceSvg ? decodeURIComponent(potraceSvg) : null;
		
		return c.html(`
			<html>
				<head>
					<title>SVG Algorithm Comparison</title>
					<style>
						body { font-family: Arial, sans-serif; margin: 20px; }
						.comparison-container { display: flex; gap: 20px; }
						.svg-panel { flex: 1; border: 1px solid #ccc; padding: 20px; background: #f9f9f9; }
						.svg-container { border: 1px solid #ddd; padding: 20px; margin: 10px 0; background: white; min-height: 200px; display: flex; align-items: center; justify-content: center; }
						.algorithm-title { color: #333; margin-bottom: 10px; }
						.stats { background: #e9e9e9; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; }
						.no-data { color: #666; font-style: italic; text-align: center; padding: 40px; }
					</style>
				</head>
				<body>
					<h1>SVG Algorithm Comparison</h1>
					<div class="comparison-container">
						<div class="svg-panel">
							<h2 class="algorithm-title">Zhang-Suen + Cubic Bézier</h2>
							${zhangSuenSvg ? `
								<div class="svg-container">
									${decodedZhangSuen}
								</div>
								<div class="stats">
									Size: ${decodedZhangSuen?.length || 0} characters
								</div>
							` : `
								<div class="no-data">No Zhang-Suen SVG provided</div>
							`}
						</div>
						<div class="svg-panel">
							<h2 class="algorithm-title">ts-potrace</h2>
							${potraceSvg ? `
								<div class="svg-container">
									${decodedPotrace}
								</div>
								<div class="stats">
									Size: ${decodedPotrace?.length || 0} characters
								</div>
							` : `
								<div class="no-data">No ts-potrace SVG provided</div>
							`}
						</div>
					</div>
					${zhangSuenSvg && potraceSvg ? `
						<div style="margin-top: 20px; padding: 15px; background: #f0f8ff; border-radius: 4px;">
							<h3>Comparison Summary</h3>
							<p><strong>Size difference:</strong> ${((decodedZhangSuen?.length || 0) - (decodedPotrace?.length || 0))} characters</p>
							<p><strong>Compression:</strong> ts-potrace is ${Math.round((1 - (decodedPotrace?.length || 0) / (decodedZhangSuen?.length || 1)) * 100)}% smaller</p>
						</div>
					` : ''}
				</body>
			</html>
		`, 200, {
			'Content-Type': 'text/html'
		});
		
	} catch (error) {
		console.error('Compare SVG error:', error);
		return c.json({ 
			error: 'Failed to compare SVGs',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Test endpoint for comparing Zhang-Suen vs ts-potrace SVG conversion
app.post('/test-potrace-comparison', async (c) => {
	try {
		console.log('=== Test Potrace Comparison Endpoint Received ===');
		
		// Handle both form-data and JSON content types
		let submissionId: string | undefined;
		let zhangSuenOptions = { threshold: 150, strokeWidth: 1, fitError: 2.0 };
		let potraceOptions = { 
			background: 'white', 
			color: 'black', 
			threshold: 128,
			turdSize: 2,
			optTolerance: 0.2,
			alphaMax: 1.0,
			optCurve: true,
			blackOnWhite: false, // Invert tracing
			turnPolicy: 'left'
		};
		let usePosterization = true;
		let posterizeOptions = { 
			steps: [40, 128, 200], 
			fillStrategy: 'dominant' as const, 
			background: 'white',
			color: 'black'
		};
		
		const contentType = c.req.header('content-type') || '';
		
		if (contentType.includes('application/json')) {
			const jsonData = await c.req.json();
			submissionId = jsonData.submissionId;
			zhangSuenOptions = { ...zhangSuenOptions, ...jsonData.zhangSuenOptions };
			potraceOptions = { ...potraceOptions, ...jsonData.potraceOptions };
			usePosterization = jsonData.usePosterization || false;
			posterizeOptions = { ...posterizeOptions, ...jsonData.posterizeOptions };
		} else {
			// Assume form-data (from webhook format)
			const formData = await c.req.formData();
			submissionId = formData.get('submissionID')?.toString();
		}
		
		console.log(`Test Comparison: SubmissionID=${submissionId}`);
		console.log(`Zhang-Suen options:`, zhangSuenOptions);
		console.log(`Potrace options:`, potraceOptions);
		console.log(`Use posterization:`, usePosterization);
		if (usePosterization) {
			console.log(`Posterize options:`, posterizeOptions);
		}
		
		if (!submissionId) {
			console.error('No submissionID found in test payload');
			return c.json({ 
				error: 'Missing submissionID in test payload' 
			}, 400);
		}

		// Fetch submission data to get signature
		console.log(`Fetching submission details for comparison test: ${submissionId}`);
		const submissionData = await getSubmissionDetails(submissionId, c.env.JOTFORM_API_KEY);
		
		if (!submissionData) {
			console.error('Failed to fetch submission details from JotForm API');
			return c.json({ 
				error: 'Failed to fetch submission details from JotForm API' 
			}, 500);
		}

		// Extract signature base64
		const signatureBase64 = await getSignatureFromSubmission(submissionData, c.env.JOTFORM_API_KEY);
		
		if (!signatureBase64) {
			console.log('No signature found in submission');
			return c.json({ 
				success: true,
				message: 'No signature found in submission',
				submissionId: submissionId,
				results: null
			});
		}

		console.log('Converting signature using both methods...');
		
		// Convert using Zhang-Suen algorithm
		const zhangSuenStart = Date.now();
		const zhangSuenSvg = await convertPngToSvg(
			signatureBase64, 
			zhangSuenOptions.threshold, 
			zhangSuenOptions.strokeWidth, 
			zhangSuenOptions.fitError
		);
		const zhangSuenTime = Date.now() - zhangSuenStart;
		
		// Convert using ts-potrace
		const potraceStart = Date.now();
		let potraceSvg: string | null;
		
		if (usePosterization) {
			potraceSvg = await convertPngToSvgPosterized(signatureBase64, posterizeOptions);
		} else {
			potraceSvg = await convertPngToSvgPotrace(signatureBase64, potraceOptions);
		}
		const potraceTime = Date.now() - potraceStart;
		
		// Generate preview URLs
		const zhangSuenPreview = zhangSuenSvg ? `http://localhost:8787/preview-svg?svg=${encodeURIComponent(zhangSuenSvg)}` : null;
		const potracePreview = potraceSvg ? `http://localhost:8787/preview-svg?svg=${encodeURIComponent(potraceSvg)}` : null;
		
		// Generate side-by-side comparison URL
		const comparisonUrl = (zhangSuenSvg && potraceSvg) ? 
			`http://localhost:8787/compare-svg?zhang=${encodeURIComponent(zhangSuenSvg)}&potrace=${encodeURIComponent(potraceSvg)}` : null;
		
		console.log('=== COMPARISON RESULTS ===');
		console.log(`Zhang-Suen: ${zhangSuenTime}ms, ${zhangSuenSvg?.length || 0} chars`);
		console.log(`ts-potrace: ${potraceTime}ms, ${potraceSvg?.length || 0} chars`);
		if (comparisonUrl) {
			console.log(`🎨 Side-by-side comparison: ${comparisonUrl}`);
		}
		console.log('=== END COMPARISON ===');

		return c.json({ 
			success: true,
			message: 'SVG conversion comparison completed',
			submissionId: submissionId,
			comparisonUrl: comparisonUrl,
			results: {
				zhangSuen: {
					svg: zhangSuenSvg,
					processingTime: zhangSuenTime,
					options: zhangSuenOptions,
					previewUrl: zhangSuenPreview,
					size: zhangSuenSvg?.length || 0
				},
				potrace: {
					svg: potraceSvg,
					processingTime: potraceTime,
					options: usePosterization ? posterizeOptions : potraceOptions,
					method: usePosterization ? 'posterization' : 'trace',
					previewUrl: potracePreview,
					size: potraceSvg?.length || 0
				}
			}
		});
		
	} catch (error) {
		console.error('Test potrace comparison error:', error);
		return c.json({ 
			error: 'Failed to process potrace comparison test',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Test endpoint for ts-potrace with direct URL (bypassing signature extraction)
app.post('/test-potrace-direct', async (c) => {
	try {
		console.log('=== Test Potrace Direct Endpoint Received ===');
		
		const { signatureUrl, apiKey, options = {} } = await c.req.json();
		
		if (!signatureUrl) {
			return c.json({ 
				error: 'Missing signatureUrl in request body' 
			}, 400);
		}
		
		console.log(`Testing ts-potrace with direct URL: ${signatureUrl}`);
		console.log(`Options:`, options);
		
		// Test 1: Direct URL to ts-potrace
		const directStart = Date.now();
		const directSvg = await convertSignatureUrlToSvgPotrace(
			signatureUrl, 
			apiKey || c.env.JOTFORM_API_KEY, 
			{
				background: 'white',
				color: 'black',
				threshold: 128,
				turdSize: 2,
				optTolerance: 0.2,
				alphaMax: 1.0,
				optCurve: true,
				...options
			}
		);
		const directTime = Date.now() - directStart;
		
		// Test 2: Fetch raw image and pass directly to ts-potrace
		const rawStart = Date.now();
		let rawSvg: string | null = null;
		
		try {
			console.log('Fetching raw image data...');
			const response = await fetch(`${signatureUrl}?apiKey=${apiKey || c.env.JOTFORM_API_KEY}`);
			if (response.ok) {
				const arrayBuffer = await response.arrayBuffer();
				const uint8Array = new Uint8Array(arrayBuffer);
				const base64 = btoa(String.fromCharCode(...uint8Array));
				const mimeType = response.headers.get('content-type') || 'image/png';
				const properDataUri = `data:${mimeType};base64,${base64}`;
				
				console.log(`Raw fetch: ${properDataUri.length} chars, MIME: ${mimeType}`);
				
				rawSvg = await convertPngToSvgPotrace(properDataUri, {
					background: 'transparent',
					color: 'black',
					threshold: 128,
					turdSize: 2,
					optTolerance: 0.2,
					alphaMax: 1.0,
					optCurve: true,
					...options
				});
			}
		} catch (error) {
			console.error('Raw fetch error:', error);
		}
		
		const rawTime = Date.now() - rawStart;
		
		// Generate preview URLs
		const directPreview = directSvg ? `http://localhost:8787/preview-svg?svg=${encodeURIComponent(directSvg)}` : null;
		const rawPreview = rawSvg ? `http://localhost:8787/preview-svg?svg=${encodeURIComponent(rawSvg)}` : null;
		const comparisonUrl = (directSvg && rawSvg) ? 
			`http://localhost:8787/compare-svg?zhang=${encodeURIComponent(directSvg)}&potrace=${encodeURIComponent(rawSvg)}` : null;
		
		console.log('=== DIRECT POTRACE TEST RESULTS ===');
		console.log(`Direct URL method: ${directTime}ms, ${directSvg?.length || 0} chars`);
		console.log(`Raw fetch method: ${rawTime}ms, ${rawSvg?.length || 0} chars`);
		if (comparisonUrl) {
			console.log(`🎨 Comparison: ${comparisonUrl}`);
		}
		console.log('=== END DIRECT TEST ===');

		return c.json({ 
			success: true,
			message: 'Direct ts-potrace test completed',
			signatureUrl: signatureUrl,
			comparisonUrl: comparisonUrl,
			results: {
				directUrl: {
					svg: directSvg,
					processingTime: directTime,
					previewUrl: directPreview,
					size: directSvg?.length || 0
				},
				rawFetch: {
					svg: rawSvg,
					processingTime: rawTime,
					previewUrl: rawPreview,
					size: rawSvg?.length || 0
				}
			}
		});
		
	} catch (error) {
		console.error('Test potrace direct error:', error);
		return c.json({ 
			error: 'Failed to process direct potrace test',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Debug endpoint to visualize the Buffer as an image
app.get('/debug-buffer-image', async (c) => {
	const signatureUrl = c.req.query('signatureUrl');
	if (!signatureUrl) {
		return c.json({ error: 'Missing signatureUrl parameter' }, 400);
	}

	try {
		// Fetch the image
		const response = await fetch(`${signatureUrl}?apiKey=${c.env.JOTFORM_API_KEY}`);
		if (!response.ok) {
			return c.json({ error: 'Failed to fetch image' }, 500);
		}

		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		
		// Return the raw image data so we can see what potrace is getting
		return new Response(uint8Array, {
			headers: {
				'Content-Type': 'image/png',
				'Content-Length': uint8Array.length.toString()
			}
		});
	} catch (error) {
		console.error('Error in debug-buffer-image:', error);
		return c.json({ error: 'Failed to process image' }, 500);
	}
});

// Test endpoint for trying multiple potrace configurations
app.post('/test-potrace-configs', async (c) => {
	try {
		console.log('=== Test Multiple Potrace Configs ===');
		
		const { signatureUrl, apiKey } = await c.req.json();
		
		if (!signatureUrl) {
			return c.json({ 
				error: 'Missing signatureUrl in request body' 
			}, 400);
		}
		
		// Define different configurations to test - focused on transparent backgrounds
		const configs = [
			{
				name: 'Completely default (transparent bg)',
				options: {} // Pure ts-potrace defaults - should have transparent background
			},
			{
				name: 'Stroke only (no fill)',
				options: {
				  threshold: 150,
				  optCurve: false,
				  turdSize: 0,
				  color: 'none',
				  stroke: 'black'
				}
			  },
			  {
				name: 'Inverted colors',
				options: {
				  threshold: 150,
				  optCurve: false,
				  turdSize: 0,
				  blackOnWhite: false
				}
			  },
			  {
				name: 'Extreme threshold',
				options: {
				  threshold: 250,
				  optCurve: false,
				  turdSize: 0
				}
			  },
			  {
				name: 'Looser curve optimization',
				options: {
				  threshold: 150,
				  optCurve: true,
				  optTolerance: 0.5,
				  turdSize: 0
				}
			  },
			  {
				name: 'High threshold + stroke only',
				options: {
				  threshold: 200,
				  optCurve: false,
				  turdSize: 0,
				  color: 'none',
				  stroke: 'black'
				}
			  },
			  {
				threshold: 200,
				optCurve: false,
				turdSize: 10,
				color: 'none',
				stroke: 'black'
			  },
			  {
				threshold: 180, 
				optCurve: true,
				optTolerance: 0.8,
				turdSize: 10,
				color: 'none',
				stroke: 'black'  
			  },
			  {
				threshold: 150,
				blackOnWhite: false, 
				optCurve: false,
				turdSize: 15,
				color: 'none',
				stroke: 'black'
			  },
			  {
				threshold: 165,
				blackOnWhite: false,
				optCurve: true, 
				optTolerance: 0.6,
				turdSize: 12,
				color: 'none',
				stroke: 'black'
			  },
			  {
				threshold: 220,
				optCurve: false,
				turdSize: 20, 
				color: 'none',
				stroke: 'black'
			  },
			  

			{
				name: 'No curve optimization (current best)',
				options: { 
					threshold: 150,
					optCurve: false, // Disable all curve smoothing
					turdSize: 0
					// No background specified - should be transparent
				}
			},
			{
				name: 'No curve + explicit transparent',
				options: { 
					threshold: 150,
					optCurve: false,
					turdSize: 0,
					background: 'transparent' // Explicitly set transparent
				}
			},
			{
				name: 'Higher threshold + transparent',
				options: { 
					threshold: 150, // Much higher threshold
					optCurve: false,
					turdSize: 0
					// No background - should be transparent
				}
			},
			{
				name: 'Very high threshold + transparent',
				options: { 
					threshold: 200, // Very high threshold
					optCurve: false,
					turdSize: 0
					// No background - should be transparent
				}
			},
			{
				name: 'No curve + remove noise + transparent',
				options: { 
					threshold: 150,
					optCurve: false,
					turdSize: 5 // Remove small noise areas
					// No background - should be transparent
				}
			},
			{
				name: 'Lower threshold + transparent',
				options: { 
					threshold: 125, // Lower threshold
					optCurve: false,
					turdSize: 0
					// No background - should be transparent
				}
			},
			{
				name: 'No curve + minority turns + transparent',
				options: { 
					threshold: 150,
					optCurve: false,
					turdSize: 0,
					turnPolicy: 'minority'
					// No background - should be transparent
				}
			}
		];
		
		// Fetch the image once
		console.log('Fetching image...');
		const response = await fetch(`${signatureUrl}?apiKey=${apiKey || c.env.JOTFORM_API_KEY}`);
		if (!response.ok) {
			return c.json({ error: 'Failed to fetch image' }, 500);
		}
		
		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		// Create Buffer directly from the image bytes - this is what ts-potrace expects!
		const imageBuffer = Buffer.from(uint8Array);
		
		console.log(`Testing ${configs.length} configurations...`);
		
		// Test each configuration
		const results = [];
		for (const config of configs) {
			try {
				const startTime = Date.now();
				// Only apply default settings if they're not specified in the config
				const finalOptions = {
					// Minimal defaults - let ts-potrace use its own defaults where possible
					// Don't set background - let it default to transparent
					// Don't set color - let it default to black
					// turdSize: 2,
					// optTolerance: 0.2,
					// alphaMax: 1.0,
					// optCurve: true,
					// Config-specific options override defaults
					...config.options
				};
				// Call ts-potrace directly with the Buffer instead of going through our wrapper
				const svg = await new Promise<string>((resolve, reject) => {
					trace(imageBuffer, finalOptions as any, function(err, svg) {
						if (err) reject(err);
						else resolve(svg || '');
					});
				});
				const endTime = Date.now();
				
				results.push({
					name: config.name,
					options: config.options,
					svg: svg,
					size: svg?.length || 0,
					time: endTime - startTime,
					previewUrl: svg ? `http://localhost:8787/preview-svg?svg=${encodeURIComponent(svg)}` : null
				});
				
				console.log(`${config.name}: ${svg?.length || 0} chars in ${endTime - startTime}ms`);
			} catch (error) {
				console.error(`${config.name} failed:`, error);
				results.push({
					name: config.name,
					options: config.options,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
		
		// Generate a comparison URL with the best looking results
		const successfulResults = results.filter(r => r.svg && !r.error);
		let comparisonUrl = null;
		if (successfulResults.length >= 2) {
			const first = successfulResults[0];
			const second = successfulResults[1];
			comparisonUrl = `http://localhost:8787/compare-svg?zhang=${encodeURIComponent(first.svg || '')}&potrace=${encodeURIComponent(second.svg || '')}`;
		}
		
		console.log('=== END POTRACE CONFIG TEST ===');
		
		return c.json({
			success: true,
			message: 'Multiple potrace configurations tested',
			signatureUrl: signatureUrl,
			comparisonUrl: comparisonUrl,
			results: results
		});
		
	} catch (error) {
		console.error('Test potrace configs error:', error);
		return c.json({ 
			error: 'Failed to test potrace configurations',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// Test endpoint for potrace configs with uploaded file data
app.post('/test-potrace-configs-upload', async (c) => {
	try {
		console.log('=== Test Potrace Configs on Uploaded File ===');
		
		const { fileBase64 } = await c.req.json();
		
		if (!fileBase64) {
			return c.json({ 
				error: 'Missing fileBase64 in request body. Expected format: "data:image/png;base64,..."' 
			}, 400);
		}
		
		// Same configs as the URL version
		const configs = [
			{
				name: 'Completely default (transparent bg)',
				options: {}
			},
			{
				name: 'Stroke only (no fill)',
				options: {
				  threshold: 150,
				  optCurve: false,
				  turdSize: 0,
				  color: 'none',
				  stroke: 'black'
				}
			},
			{
				name: 'No curve optimization (current best)',
				options: { 
					threshold: 150,
					optCurve: false,
					turdSize: 0
				}
			},
			{
				name: 'Higher threshold + transparent',
				options: { 
					threshold: 200,
					optCurve: false,
					turdSize: 0
				}
			},
			{
				name: 'Inverted colors',
				options: {
				  threshold: 150,
				  optCurve: false,
				  turdSize: 0,
				  blackOnWhite: false
				}
			}
		];
		
		// Convert base64 to Buffer
		console.log('Converting base64 to Buffer...');
		const base64Data = fileBase64.split(',')[1] || fileBase64;
		const uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
		const imageBuffer = Buffer.from(uint8Array);
		
		console.log(`Testing ${configs.length} configurations on uploaded file...`);
		
		// Test each configuration
		const results = [];
		for (const config of configs) {
			try {
				const startTime = Date.now();
				const finalOptions = {
					turdSize: 2,
					optTolerance: 0.2,
					alphaMax: 1.0,
					optCurve: true,
					...config.options
				};
				
				const svg = await new Promise<string>((resolve, reject) => {
					trace(imageBuffer, finalOptions as any, function(err, svg) {
						if (err) reject(err);
						else resolve(svg || '');
					});
				});
				const endTime = Date.now();
				
				results.push({
					name: config.name,
					options: config.options,
					svg: svg,
					size: svg?.length || 0,
					time: endTime - startTime,
					previewUrl: svg ? `http://localhost:8787/preview-svg?svg=${encodeURIComponent(svg)}` : null
				});
				
				console.log(`${config.name}: ${svg?.length || 0} chars in ${endTime - startTime}ms`);
			} catch (error) {
				console.error(`${config.name} failed:`, error);
				results.push({
					name: config.name,
					options: config.options,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
		
		console.log('=== END POTRACE CONFIG TEST (UPLOAD) ===');
		
		return c.json({
			success: true,
			message: 'Multiple potrace configurations tested on uploaded file',
			results: results
		});
		
	} catch (error) {
		console.error('Test potrace configs upload error:', error);
		return c.json({ 
			error: 'Failed to test potrace configurations on uploaded file',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// JotForm webhook endpoint - receives POST requests from JotForm
app.post('/webhook', async (c) => {
	try {
		console.log('=== JotForm Webhook Received ===');
		
		// Extract submissionID from form data
		const formData = await c.req.formData();
		const submissionId = formData.get('submissionID')?.toString();
		const formId = formData.get('formID')?.toString();
		const formTitle = formData.get('formTitle')?.toString();
		
		console.log(`Webhook details: FormID=${formId}, SubmissionID=${submissionId}, Title="${formTitle}"`);
		
		if (!submissionId) {
			console.error('No submissionID found in webhook payload');
			return c.json({ 
				error: 'Missing submissionID in webhook payload' 
			}, 400);
		}

		// Send immediate success response to JotForm
		const response = c.json({ 
			success: true,
			message: 'Webhook received successfully',
			submissionId: submissionId
		});

		// Schedule background processing - this happens after the response is sent
		c.executionCtx.waitUntil(
			processWebhookInBackground(
				submissionId, 
				formId || 'unknown', 
				formTitle || 'Unknown Form',
				c.env.JOTFORM_API_KEY,
				c.env.LEADDOCKET_FORM_KEY
			)
		);

		return response;
		
	} catch (error) {
		console.error('Webhook error:', error);
		return c.json({ 
			error: 'Failed to process webhook',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, 500);
	}
});

// 404 handler
app.notFound((c) => {
	return c.json({
		error: 'Not Found',
		message: `Route ${c.req.method} ${c.req.path} not found`
	}, 404);
});

// Error handler
app.onError((err, c) => {
	console.error(`Error: ${err}`);
	return c.json({
		error: 'Internal Server Error',
		message: err.message
	}, 500);
});

// Export the Hono app
export default app;