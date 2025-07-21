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

interface Env {
	JOTFORM_API_KEY: string;
	LEADDOCKET_API_KEY: string;
}

// JotForm API response types
interface JotFormSubmissionsResponse {
	responseCode: number;
	message: string;
	content: Array<{
		id: string;
		form_id: string;
		created_at: string;
		answers: Record<string, JotFormAnswer>;
		[key: string]: any;
	}>;
}

interface JotFormSubmissionResponse {
	responseCode: number;
	message: string;
	content: {
		id: string;
		form_id: string;
		created_at: string;
		answers: Record<string, JotFormAnswer>;
		[key: string]: any;
	};
}

interface JotFormAnswer {
	text: string;
	type: string;
	answer?: any;
	prettyFormat?: string;
}

// Request body type
interface SyncRequest {
	formId: string;
	submissionId: string;
	leadId: number;
}

// Helper function to get signature from JotForm submission
async function getSignatureFromJotForm(formId: string, submissionId: string, apiKey: string): Promise<string | null> {
	try {
		// Get specific submission
		const response = await fetch(
			`https://api.jotform.com/submission/${submissionId}?apiKey=${apiKey}`,
			{
				method: 'GET',
				headers: { 'Accept': 'application/json' }
			}
		);

		if (!response.ok) {
			console.error(`JotForm API error: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = await response.json() as JotFormSubmissionResponse;
		
		// Find signature field
		if (data.content && data.content.answers) {
			for (const answer of Object.values(data.content.answers)) {
				if (answer.type === 'control_signature' && answer.answer) {
					console.log(`Found signature: ${answer.answer}`);
					return answer.answer;
				}
			}
		}
		
		console.log('No signature found in submission');
		return null;
	} catch (error) {
		console.error('Error fetching JotForm submission:', error);
		return null;
	}
}

// Helper function to upload file to LeadDocket
async function uploadToLeadDocket(
	imageUrl: string, 
	leadId: number, 
	jotformApiKey: string, 
	leadDocketApiKey: string
): Promise<{ success: boolean; message: string; fileId?: number }> {
	try {
		// Fetch the image from JotForm
		const imageResponse = await fetch(`${imageUrl}?apiKey=${jotformApiKey}`);
		if (!imageResponse.ok) {
			return { success: false, message: `Failed to fetch image: ${imageResponse.status}` };
		}

		const imageBlob = await imageResponse.blob();
		console.log(`Fetched image: ${imageBlob.type}, ${imageBlob.size} bytes`);

		// Create FormData
		const formData = new FormData();
		formData.append('file', imageBlob, 'jotform_signature.png');

		// Upload to LeadDocket
		const uploadParams = new URLSearchParams({
			uploadedBy: 'JotForm Sync',
			allowDuplicateFilesOnLead: 'false'
		});

		const uploadUrl = `https://brysonfirm.leaddocket.com/api/leads/${leadId}/files/upload?${uploadParams}`;
		
		const uploadResponse = await fetch(uploadUrl, {
			method: 'POST',
			headers: {
				'ApiKey': leadDocketApiKey,
			},
			body: formData
		});

		if (!uploadResponse.ok) {
			const errorText = await uploadResponse.text();
			return { success: false, message: `LeadDocket upload failed: ${errorText}` };
		}

		const result = await uploadResponse.json();
		const uploadedFile = result.UploadedFiles?.[0];
		
		return {
			success: true,
			message: uploadedFile?.Message || 'Signature uploaded successfully',
			fileId: uploadedFile?.Id
		};

	} catch (error) {
		console.error('Upload error:', error);
		return { 
			success: false, 
			message: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// Main endpoint for syncing signatures
		if (url.pathname === '/sync-signature' && request.method === 'POST') {
			try {
				// Parse request body
				const body = await request.json() as SyncRequest;
				const { formId, submissionId, leadId } = body;

				// Validate required parameters
				if (!formId || !submissionId || !leadId) {
					return new Response(JSON.stringify({ 
						error: 'Missing required parameters: formId, submissionId, and leadId' 
					}), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				// Step 1: Get signature from JotForm
				const signatureUrl = await getSignatureFromJotForm(formId, submissionId, env.JOTFORM_API_KEY);
				if (!signatureUrl) {
					return new Response(JSON.stringify({ 
						error: 'No signature found in JotForm submission' 
					}), {
						status: 404,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				// Step 2: Upload to LeadDocket
				const uploadResult = await uploadToLeadDocket(
					signatureUrl, 
					leadId, 
					env.JOTFORM_API_KEY, 
					env.LEADDOCKET_API_KEY
				);

				if (!uploadResult.success) {
					return new Response(JSON.stringify({ 
						error: uploadResult.message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}

				// Success response
				return new Response(JSON.stringify({
					success: true,
					message: uploadResult.message,
					submissionId: submissionId,
					leadId: leadId,
					fileId: uploadResult.fileId
				}), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});

			} catch (error) {
				console.error('Sync error:', error);
				return new Response(JSON.stringify({ 
					error: 'Internal server error',
					message: error instanceof Error ? error.message : 'Unknown error'
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// Default response
		return new Response('JotForm to LeadDocket Sync Worker - POST to /sync-signature', { 
			status: 200 
		});
	},
} satisfies ExportedHandler<Env>;