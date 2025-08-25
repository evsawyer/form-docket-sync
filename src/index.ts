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

// Create Hono app with proper typing
const app = new Hono<{ Bindings: Bindings }>();

// Apply CORS middleware to all routes
app.use('/*', cors());

// Routes

// Home route
app.get('/', (c) => {
	return c.text('JotForm to LeadDocket Sync Worker - Available endpoints: POST /webhook, POST /test-address, POST /test-svg-signature, POST /test-png-url, POST /test-potrace-comparison, GET /preview-svg');
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

// Test endpoint for comparing Zhang-Suen vs ts-potrace SVG conversion
app.post('/test-potrace-comparison', async (c) => {
	try {
		console.log('=== Test Potrace Comparison Endpoint Received ===');
		
		// Handle both form-data and JSON content types
		let submissionId: string | undefined;
		let zhangSuenOptions = { threshold: 150, strokeWidth: 1, fitError: 2.0 };
		let potraceOptions = { background: 'transparent', color: 'black', threshold: 120 };
		let usePosterization = false;
		let posterizeOptions = { steps: 3, fillStrategy: 'dominant' as const, background: 'transparent' };
		
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
		const zhangSuenPreview = zhangSuenSvg ? `http://localhost:58230/preview-svg?svg=${encodeURIComponent(zhangSuenSvg)}` : null;
		const potracePreview = potraceSvg ? `http://localhost:58230/preview-svg?svg=${encodeURIComponent(potraceSvg)}` : null;
		
		console.log('=== COMPARISON RESULTS ===');
		console.log(`Zhang-Suen: ${zhangSuenTime}ms, ${zhangSuenSvg?.length || 0} chars`);
		console.log(`ts-potrace: ${potraceTime}ms, ${potraceSvg?.length || 0} chars`);
		console.log('=== END COMPARISON ===');

		return c.json({ 
			success: true,
			message: 'SVG conversion comparison completed',
			submissionId: submissionId,
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