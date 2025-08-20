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

// Create Hono app with proper typing
const app = new Hono<{ Bindings: Bindings }>();

// Apply CORS middleware to all routes
app.use('/*', cors());

// Routes

// Home route
app.get('/', (c) => {
	return c.text('JotForm to LeadDocket Sync Worker - Available endpoints: POST /webhook, GET /submission/:submissionId');
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