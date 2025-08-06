import { getStateAbbreviation } from '../processors/state';
import { convertToLeadDocketTimestamp } from '../processors/timestamp';

// Helper function to map our extracted data to LeadDocket format
export function mapToLeadDocketFormat(inputParams: any): any {
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
		state_abbr: getStateAbbreviation(inputParams.state), // Auto-convert state name to abbreviation
		state: inputParams.state && getStateAbbreviation(inputParams.state) 
			? `${getStateAbbreviation(inputParams.state)} - ${inputParams.state}` 
			: inputParams.state, // Format: "IL - Illinois"
		zip_code: inputParams.zip_code,
		
		// Technical metadata
		ip_address: inputParams.ip_address,
		user_agent: inputParams.user_agent,
		geolocation: inputParams.geolocation,
		
		// Signature data (base64 image)
		signature_data_image: inputParams.signature_base64,
		
		// Form metadata
		tfa_dbFormId: inputParams.form_id,
		tfa_dbVersionId: inputParams.submission_id,
		
		// Timestamps
		tsa_timestamp: convertToLeadDocketTimestamp(inputParams.created_at),
		tsa_timestamp_utc: new Date(inputParams.created_at).toUTCString(),
		
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