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

// Environment type
type Bindings = {
	JOTFORM_API_KEY: string;
	LEADDOCKET_FORM_KEY: string;
};

// JotForm API response types

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
	name?: string;
	text: string;
	type: string;
	answer?: any;
	prettyFormat?: string;
}

// Create Hono app with proper typing
const app = new Hono<{ Bindings: Bindings }>();

// Apply CORS middleware to all routes
app.use('/*', cors());

// Helper function to extract signature from already-fetched submission data and convert to base64
async function getSignatureFromSubmission(submissionData: JotFormSubmissionResponse | null, apiKey: string): Promise<string | null> {
	if (!submissionData) {
		console.log('No submission data provided');
		return null;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const answer of Object.values(submissionData.content.answers)) {
			if (answer.type === 'control_signature' && answer.answer) {
				const signatureUrl = answer.answer;
				console.log(`Found signature URL: ${signatureUrl}`);
				
				try {
					// Fetch the image from JotForm
					const imageResponse = await fetch(`${signatureUrl}?apiKey=${apiKey}`);
					if (!imageResponse.ok) {
						console.error(`Failed to fetch signature image: ${imageResponse.status}`);
						return null;
					}

					// Convert to base64
					const imageBlob = await imageResponse.blob();
					const arrayBuffer = await imageBlob.arrayBuffer();
					const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
					
					console.log(`Successfully converted signature to base64 (${base64.length} characters)`);
					return base64;
				} catch (error) {
					console.error('Error fetching/converting signature:', error);
					return null;
				}
			}
		}
	}
	
	console.log('No signature found in submission');
	return null;
}

// Interface for address data
interface AddressData {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	zip_code: string | null;
	questionId: string;
}

// Helper function to extract address from already-fetched submission data
function getAddressFromSubmission(submissionData: JotFormSubmissionResponse | null): AddressData[] {
	const addresses: AddressData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for address');
		return addresses;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_address' && answer.answer) {
				const addressData: AddressData = {
					questionId,
					address_line_1: answer.answer.addr_line1 || null,
					address_line_2: answer.answer.addr_line2 || null,
					city: answer.answer.city || null,
					state: answer.answer.state || null,
					zip_code: answer.answer.postal || null
				};
				addresses.push(addressData);
				console.log(`Found address in question ${questionId}:`, addressData);
			}
		}
	}
	
	return addresses;
}

// Interface for name data
interface NameData {
	first_name: string | null;
	last_name: string | null;
	questionId: string;
}

// Helper function to extract name from already-fetched submission data
function getNameFromSubmission(submissionData: JotFormSubmissionResponse | null): NameData[] {
	const names: NameData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for name');
		return names;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_fullname' && answer.answer) {
				const nameData: NameData = {
					questionId,
					first_name: answer.answer.first || null,
					last_name: answer.answer.last || null
				};
				names.push(nameData);
				console.log(`Found name in question ${questionId}:`, nameData);
			}
		}
	}
	
	return names;
}

// Interface for email data
interface EmailData {
	email_address: string | null;
	questionId: string;
}

// Helper function to extract email from already-fetched submission data
function getEmailFromSubmission(submissionData: JotFormSubmissionResponse | null): EmailData[] {
	const emails: EmailData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for email');
		return emails;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_email' && answer.answer) {
				const emailData: EmailData = {
					questionId,
					email_address: answer.answer || null
				};
				emails.push(emailData);
				console.log(`Found email in question ${questionId}:`, emailData);
			}
		}
	}
	
	return emails;
}

// Interface for phone data
interface PhoneData {
	phone_number: string | null;
	questionId: string;
}

// Helper function to extract phone from already-fetched submission data
function getPhoneFromSubmission(submissionData: JotFormSubmissionResponse | null): PhoneData[] {
	const phones: PhoneData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for phone');
		return phones;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_phone' && answer.answer) {
				const phoneData: PhoneData = {
					questionId,
					phone_number: answer.answer.full || answer.answer || null
				};
				phones.push(phoneData);
				console.log(`Found phone in question ${questionId}:`, phoneData);
			}
		}
	}
	
	return phones;
}

// Interface for user agent data
interface UserAgentData {
	user_agent: string;
	questionId: string;
}

// Interface for hidden fields data
interface HiddenFieldsData {
	client_id?: string;
	case_type?: string;
	utm_campaign?: string;
	utm_source?: string;
	utm_term?: string;
	utm_content?: string;
	project_id?: string;
}

// Interface for eligibility questions data
interface EligibilityQuestionsData {
	[key: string]: {
		questionId: string;
		question: string;
		answer: any;
		type: string;
	};
}

// Interface for geolocation data
interface GeolocationData {
	geolocation: string;
	questionId: string;
}

// Interface for hash data
interface HashData {
	retainer_text: string | null;
	signature_data_image: string | null;
	created_at: string | null;
	hash: string;
}

// Helper function to extract user agent from Get User Agent widget
function getUserAgentFromSubmission(submissionData: JotFormSubmissionResponse | null): UserAgentData | null {
	if (!submissionData) {
		console.log('No submission data provided');
		return null;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for Get User Agent widget by matching the cfname property
			if ((answer as any).cfname === 'Get User Agent') {
				console.log(`Found Get User Agent widget in question ${questionId}`);
				
				// Extract the user agent directly from the answer field
				const userAgent = answer.answer;
				
				if (typeof userAgent === 'string' && userAgent.trim()) {
					const userAgentData: UserAgentData = {
						questionId,
						user_agent: userAgent.trim()
					};
					console.log(`Found user agent in question ${questionId}: ${userAgent}`);
					return userAgentData;
				} else {
					console.log(`Get User Agent widget found but no valid user agent string in question ${questionId}`);
				}
			}
		}
	}
	
	console.log('No Get User Agent widget found');
	return null;
}

// Helper function to create a hash from retainer text, signature base64, and created_at
async function createHash(submissionData: JotFormSubmissionResponse | null, signatureBase64: string | null): Promise<HashData> {
	const hashData: HashData = {
		retainer_text: null,
		signature_data_image: signatureBase64,
		created_at: null,
		hash: ''
	};
	
	if (!submissionData) {
		console.log('No submission data provided for hash creation');
		return hashData;
	}

	// Extract created_at
	hashData.created_at = submissionData.content?.created_at || null;

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for retainer field by name "retainer0"
			if (answer.name === 'retainer0' && answer.type === 'control_text') {
				hashData.retainer_text = answer.text || null;
				console.log(`Found retainer text in question ${questionId} (length: ${hashData.retainer_text?.length || 0})`);
			}
		}
	}

	// Create hash from the extracted data
	const hashInput = [
		hashData.retainer_text || '',
		hashData.signature_data_image || '',
		hashData.created_at || ''
	].join('|');

	try {
		// Create SHA-256 hash using Cloudflare Workers crypto API
		const encoder = new TextEncoder();
		const data = encoder.encode(hashInput);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		hashData.hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		console.log(`Created SHA-256 hash: ${hashData.hash}`);
	} catch (error) {
		console.error('Error creating crypto hash:', error);
		// Fallback to a simple base64-based hash if crypto fails
		hashData.hash = btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
		console.log(`Created fallback hash: ${hashData.hash}`);
	}

	console.log('Hash data extracted:', {
		retainer_text_length: hashData.retainer_text?.length || 0,
		signature_data_image_length: hashData.signature_data_image?.length || 0,
		created_at: hashData.created_at,
		hash_input_length: hashInput.length,
		hash: hashData.hash
	});

	return hashData;
}

// Helper function to extract geolocation from Detected Location field
function getGeolocationFromSubmission(submissionData: JotFormSubmissionResponse | null): GeolocationData | null {
	if (!submissionData) {
		console.log('No submission data provided for geolocation');
		return null;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for Detected Location field by matching the text property
			if (answer.text === 'Detected Location') {
				console.log(`Found Detected Location field in question ${questionId}`);
				
				const locationData = answer.answer;
				
				if (typeof locationData === 'string' && locationData.trim()) {
					// The answer should be in format "lat, lon"
					const geolocationData: GeolocationData = {
						questionId,
						geolocation: locationData.trim()
					};
					console.log(`Found geolocation in question ${questionId}: ${locationData}`);
					return geolocationData;
				} else {
					console.log(`Detected Location field found but no valid coordinates in question ${questionId}`);
				}
			}
		}
	}
	
	console.log('No Detected Location field found');
	return null;
}

// Helper function to extract hidden fields from already-fetched submission data
function getHiddenFieldsFromSubmission(submissionData: JotFormSubmissionResponse | null): HiddenFieldsData {
	const hiddenFields: HiddenFieldsData = {};
	
	if (!submissionData) {
		console.log('No submission data provided for hidden fields');
		return hiddenFields;
	}

	if (submissionData.content && submissionData.content.answers) {
		console.log('Searching for hidden fields...');
		
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for specific hidden fields by their text property
			if (answer.text) {
				const fieldText = answer.text.toLowerCase();
				
				// Check for various field name patterns
				if (fieldText === 'client_id' || fieldText === 'clientid') {
					hiddenFields.client_id = answer.answer?.toString() || null;
					console.log(`Found client_id in question ${questionId}:`, hiddenFields.client_id);
				} else if (fieldText === 'case_type' || fieldText === 'casetype') {
					hiddenFields.case_type = answer.answer?.toString() || null;
					console.log(`Found case_type in question ${questionId}:`, hiddenFields.case_type);
				} else if (fieldText === 'utm_campaign') {
					hiddenFields.utm_campaign = answer.answer?.toString() || null;
					console.log(`Found utm_campaign in question ${questionId}:`, hiddenFields.utm_campaign);
				} else if (fieldText === 'utm_source') {
					hiddenFields.utm_source = answer.answer?.toString() || null;
					console.log(`Found utm_source in question ${questionId}:`, hiddenFields.utm_source);
				} else if (fieldText === 'utm_term') {
					hiddenFields.utm_term = answer.answer?.toString() || null;
					console.log(`Found utm_term in question ${questionId}:`, hiddenFields.utm_term);
				} else if (fieldText === 'utm_content') {
					hiddenFields.utm_content = answer.answer?.toString() || null;
					console.log(`Found utm_content in question ${questionId}:`, hiddenFields.utm_content);
				} else if (fieldText === 'project_id' || fieldText === 'projectid') {
					hiddenFields.project_id = answer.answer?.toString() || null;
					console.log(`Found project_id in question ${questionId}:`, hiddenFields.project_id);
				}
			}
		}
	}
	
	console.log('Extracted hidden fields:', hiddenFields);
	return hiddenFields;
}

// Helper function to extract eligibility questions from submission
function getEligibilityQuestionsFromSubmission(submissionData: JotFormSubmissionResponse | null): EligibilityQuestionsData {
	const eligibilityQuestions: EligibilityQuestionsData = {};
	
	if (!submissionData) {
		console.log('No submission data provided for eligibility questions');
		return eligibilityQuestions;
	}

	if (submissionData.content && submissionData.content.answers) {
		console.log('Searching for eligibility questions...');
		
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for questions with names that match "eligibility_question_" followed by numbers
			if (answer.name && answer.name.match(/^eligibility_question_\d+$/)) {
				eligibilityQuestions[answer.name] = {
					questionId: questionId,
					question: answer.text || '',
					answer: answer.answer,
					type: answer.type
				};
				console.log(`Found eligibility question ${answer.name} (ID: ${questionId}): "${answer.text}" = ${answer.answer}`);
			}
		}
	}
	
	console.log(`Extracted ${Object.keys(eligibilityQuestions).length} eligibility questions:`, eligibilityQuestions);
	return eligibilityQuestions;
}

// Helper function to get complete submission details from JotForm
async function getSubmissionDetails(submissionId: string, apiKey: string): Promise<JotFormSubmissionResponse | null> {
	try {
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
		console.log(`Successfully fetched submission ${submissionId} from JotForm API`);
		return data;
		
	} catch (error) {
		console.error('Error fetching JotForm submission:', error);
		return null;
	}
}




// Helper function to map our extracted data to LeadDocket format
function mapToLeadDocketFormat(inputParams: any): any {
	// Build the base object first
	const leadDocketData: any = {
		// Basic contact information
		first_name: inputParams.first_name,
		last_name: inputParams.last_name,
		phone_number: inputParams.phone_number,
		email_address: inputParams.email_address,
		
		// Address information
		address_line_1: inputParams.address_line_1,
		address_line_2: inputParams.address_line_2,
		city: inputParams.city,
		state_name: inputParams.state, // Note: LeadDocket uses "state_name" not "state"
		zip_code: inputParams.zip_code,
		
		// Technical metadata
		ip_address: inputParams.ip_address,
		user_agent: inputParams.user_agent,
		geolocation: inputParams.geolocation,
		
		// Signature data (base64 image)
		signature_data_image: inputParams.signature_base64,
		signature_data_svgbase64: inputParams.signature_base64,
		
		// Form metadata
		tfa_dbFormId: inputParams.form_id,
		tfa_dbVersionId: inputParams.submission_id,
		
		// Timestamps
		tsa_timestamp: inputParams.created_at,
		tsa_timestamp_utc: new Date(inputParams.created_at).toISOString(),
		
		// Additional metadata
		JSON_DATA: JSON.stringify(inputParams.all_data),
		
		// UTM and tracking fields from hidden form fields (with fallbacks)
		utm_source: inputParams.utm_source || "jotform",
		utm_medium: "form",
		utm_campaign: inputParams.utm_campaign || inputParams.form_title || "form_submission",
		utm_term: inputParams.utm_term || null,
		utm_content: inputParams.utm_content || null,
		
		// Business fields from hidden form fields
		case_type: inputParams.case_type || "lead",
		client_id: inputParams.client_id || null,
		project_id: inputParams.project_id || null,
		
		// Add any other fields you want to track
		__guid: `jotform_${inputParams.submission_id}`,
		hash: inputParams.hash_data?.hash || inputParams.submission_id, // Use generated hash or fallback to submission ID
		
		// Additional hash-related fields
		retainer_text_hash: inputParams.hash_data?.retainer_text ? 'present' : 'missing',
		signature_data_image_hash: inputParams.hash_data?.signature_data_image ? 'present' : 'missing'
	};
	
	// Add eligibility questions as separate fields
	if (inputParams.eligibility_questions) {
		console.log('Adding eligibility questions to LeadDocket data...');
		for (const [questionId, questionData] of Object.entries(inputParams.eligibility_questions)) {
			const data = questionData as any;
			leadDocketData[questionId] = data.answer;
			console.log(`Added ${questionId}: ${data.answer}`);
		}
	}
	
	return leadDocketData;
}

// Helper function to send data to LeadDocket
async function sendToLeadDocket(data: any, apiKey: string): Promise<{ success: boolean; message: string; response?: any }> {
	try {
		console.log('Sending data to LeadDocket...');
		console.log('LeadDocket URL:', `https://brysonfirm.leaddocket.com/opportunities/formjson/1?apikey=${apiKey.substring(0, 8)}...`);
		
		const response = await fetch(`https://brysonfirm.leaddocket.com/opportunities/formjson/1?apikey=${apiKey}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(data)
		});

		console.log(`LeadDocket Response Status: ${response.status} ${response.statusText}`);
		console.log('LeadDocket Response Headers:', Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.error('❌ LeadDocket Error Response:');
			console.error('   Status:', response.status);
			console.error('   Headers:', Object.fromEntries(response.headers.entries()));
			console.error('   Body:', errorText);
			return { 
				success: false, 
				message: `LeadDocket API error: ${response.status} ${response.statusText}`,
				response: errorText
			};
		}

		const result = await response.json();
		console.log('✅ LeadDocket Success Response:');
		console.log('   Status:', response.status);
		console.log('   Response Body:', JSON.stringify(result, null, 2));
		
			return { 
				success: true, 
			message: 'Data sent to LeadDocket successfully',
			response: result
		};
		
	} catch (error) {
		console.error('Error sending to LeadDocket:', error);
		return { 
			success: false, 
			message: error instanceof Error ? error.message : 'Unknown error sending to LeadDocket'
		};
	}
}

// Helper function for background processing after webhook response
async function processWebhookInBackground(submissionId: string, formId: string, formTitle: string, jotformApiKey: string, leadDocketApiKey: string) {
	try {
		console.log(`=== Background Processing Started for ${submissionId} ===`);
		
		// Fetch full submission details from JotForm API
		console.log(`Fetching submission details for ID: ${submissionId}`);
		console.log(`Equivalent curl command:`);
		console.log(`curl -X GET "https://api.jotform.com/submission/${submissionId}?apiKey=${jotformApiKey.substring(0, 8)}..."`);
		
		const submissionData = await getSubmissionDetails(submissionId, jotformApiKey);
		
		if (!submissionData) {
			console.error('Failed to fetch submission details from JotForm API');
			return;
		}

		console.log(`Successfully fetched submission data for ${submissionId}`);
		console.log(`=== FULL JOTFORM SUBMISSION DATA ===`);
		console.log(JSON.stringify(submissionData, null, 2));
		console.log(`=== END JOTFORM SUBMISSION DATA ===`);

		// Extract all data using our helper functions
		const signatureBase64 = await getSignatureFromSubmission(submissionData, jotformApiKey);
		const addresses = getAddressFromSubmission(submissionData);
		const names = getNameFromSubmission(submissionData);
		const emails = getEmailFromSubmission(submissionData);
		const phones = getPhoneFromSubmission(submissionData);
		const userAgentData = getUserAgentFromSubmission(submissionData);
		const geolocationData = getGeolocationFromSubmission(submissionData);
		const hiddenFields = getHiddenFieldsFromSubmission(submissionData);
		const eligibilityQuestions = getEligibilityQuestionsFromSubmission(submissionData);
		const hashData = await createHash(submissionData, signatureBase64);

		// Build the consolidated input parameters
		const inputParams = {
			// Signature
			signature_base64: signatureBase64,
			
			// Name fields (taking the first one if multiple exist)
			first_name: names[0]?.first_name || null,
			last_name: names[0]?.last_name || null,
			
			// Email (taking the first one if multiple exist)
			email_address: emails[0]?.email_address || null,
			
			// Phone (taking the first one if multiple exist)
			phone_number: phones[0]?.phone_number || null,
			
			// Address fields (taking the first one if multiple exist)
			address_line_1: addresses[0]?.address_line_1 || null,
			address_line_2: addresses[0]?.address_line_2 || null,
			city: addresses[0]?.city || null,
			state: addresses[0]?.state || null,
			zip_code: addresses[0]?.zip_code || null,
			
			// User agent from ThumbmarkJS
			user_agent: userAgentData?.user_agent || null,
			
			// Geolocation
			geolocation: geolocationData?.geolocation || null,
			
			// IP address
			ip_address: submissionData.content?.ip || null,
			
			// Metadata
			submission_id: submissionData.content.id,
			form_id: submissionData.content.form_id,
			created_at: submissionData.content.created_at,
			form_title: formTitle,
			
			// Hidden fields from form
			client_id: hiddenFields.client_id,
			case_type: hiddenFields.case_type,
			utm_campaign: hiddenFields.utm_campaign,
			utm_source: hiddenFields.utm_source,
			utm_term: hiddenFields.utm_term,
			utm_content: hiddenFields.utm_content,
			project_id: hiddenFields.project_id,
			
			// Eligibility questions from form
			eligibility_questions: eligibilityQuestions,
			
			// Hash data from retainer text, signature, and created_at
			hash_data: hashData,
			
			// Include arrays of all found instances (in case there are multiple)
			all_data: {
				names: names,
				emails: emails,
				phones: phones,
				addresses: addresses,
				hidden_fields: hiddenFields,
				eligibility_questions: eligibilityQuestions,
				geolocation: geolocationData,
				hash_data: hashData
			}
		};

		// Log the processed data
		console.log('Processed webhook input params:', JSON.stringify(inputParams, null, 2));
		
		// Map to LeadDocket format and send
		const leadDocketData = mapToLeadDocketFormat(inputParams);
		console.log('Mapped LeadDocket data:', JSON.stringify(leadDocketData, null, 2));
		
		const leadDocketResult = await sendToLeadDocket(leadDocketData, leadDocketApiKey);
		
		if (leadDocketResult.success) {
			console.log('✅ Successfully sent to LeadDocket');
		} else {
			console.error('❌ Failed to send to LeadDocket:', leadDocketResult.message);
		}
		
		console.log(`=== Background Processing Complete for ${submissionId} ===`);

	} catch (error) {
		console.error('Background processing error:', error);
	}
}

// Routes

// Home route
app.get('/', (c) => {
	return c.text('JotForm to LeadDocket Sync Worker - Available endpoints: POST /webhook, GET /submission/:submissionId');
});

// GET endpoint to fetch and log complete JotForm submission data
app.get('/submission/:submissionId', async (c) => {
	const submissionId = c.req.param('submissionId');
	
	if (!submissionId) {
		return c.json({ 
			error: 'Missing required parameter: submissionId' 
		}, 400);
	}

	try {
		console.log(`=== Manual Submission Fetch for ${submissionId} ===`);
		console.log(`Fetching submission details for ID: ${submissionId}`);
		console.log(`Equivalent curl command:`);
		console.log(`curl -X GET "https://api.jotform.com/submission/${submissionId}?apiKey=${c.env.JOTFORM_API_KEY.substring(0, 8)}..."`);
		
		const submissionData = await getSubmissionDetails(submissionId, c.env.JOTFORM_API_KEY);
		
		if (!submissionData) {
			console.error('Failed to fetch submission details from JotForm API');
			return c.json({ 
				error: 'Failed to fetch submission details from JotForm API' 
			}, 500);
		}

		console.log(`Successfully fetched submission data for ${submissionId}`);
		console.log(`=== FULL JOTFORM SUBMISSION DATA ===`);
		console.log(JSON.stringify(submissionData, null, 2));
		console.log(`=== END JOTFORM SUBMISSION DATA ===`);

		// Return the complete submission data
		return c.json({
			success: true,
			submissionId: submissionId,
			curlCommand: `curl -X GET "https://api.jotform.com/submission/${submissionId}?apiKey=YOUR_API_KEY"`,
			data: submissionData
		});

	} catch (error) {
		console.error('Error fetching submission:', error);
		return c.json({ 
			error: 'Failed to fetch submission',
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