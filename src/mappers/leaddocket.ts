import { getStateAbbreviation } from '../processors/state';
import { convertToLeadDocketTimestamp } from '../processors/timestamp';
import { createHash } from '../processors/hash';

// Helper function to map our extracted data to LeadDocket format
export async function mapToLeadDocketFormat(inputParams: any): Promise<any> {
	// Build the base object first
	const leadDocketData: any = {
		// Core tracking fields
		__guid: crypto.randomUUID(),
		ip_address: inputParams.ip_address,
		tsa_timestamp: inputParams.tsa_timestamp,
		tsa_timestamp_utc: inputParams.tsa_timestamp_utc,
		geolocation: inputParams.geolocation,
		hash: await createHash(
			inputParams.tsa_timestamp_utc,
			inputParams.retainer_text,
			inputParams.signature_base64
		), // Create hash directly in object
		user_agent: inputParams.user_agent,
		potential_robot: "false", // Default to false
		
		// Form metadata
		tfa_dbFormId: inputParams.form_id,
		tfa_dbVersionId: inputParams.submission_id,
		// control_codes: inputParams.control_codes, // Not required
		
		// Business fields from hidden form fields
		client_id: inputParams.client_id,
		project_id: inputParams.project_id,
		case_type: inputParams.case_type,
		
		// UTM and tracking fields from hidden form fields (with fallbacks)
		utm_campaign: inputParams.utm_campaign,
		utm_source: inputParams.utm_source,
		utm_medium: inputParams.utm_medium,
		utm_term: inputParams.utm_term,
		utm_content: inputParams.utm_content,
		
		// Basic contact information
		first_name: inputParams.first_name,
		last_name: inputParams.last_name,
		
		// Address information (address_line_1 modified with project_id)
		address_line_1: inputParams.address_line_1 && inputParams.project_id
			? `${inputParams.address_line_1} (${inputParams.project_id})`
			: inputParams.address_line_1,
		address_line_2: inputParams.address_line_2,
		city: inputParams.city,
		state: inputParams.state && getStateAbbreviation(inputParams.state) 
			? `${getStateAbbreviation(inputParams.state)} - ${inputParams.state}` 
			: inputParams.state, // Format: "IL - Illinois"
		state_abbr: getStateAbbreviation(inputParams.state), // Auto-convert state name to abbreviation
		state_name: inputParams.state, // Note: LeadDocket uses "state_name" not "state"
		zip_code: inputParams.zip_code,
		
		// Contact information (modified with project_id)
		email_address: inputParams.email_address && inputParams.project_id 
			? inputParams.email_address.replace(/(@.+)$/, `.${inputParams.project_id}$1`)
			: inputParams.email_address,
		phone_number: inputParams.phone_number && inputParams.project_id
			? `${inputParams.phone_number}.${inputParams.project_id}`
			: inputParams.phone_number,
		
		// Additional metadata
		JSON_DATA: JSON.stringify(inputParams.all_data),
		
		// Signature data (base64 image)
		signature_data_image: inputParams.signature_base64,
		// signature_data_svgbase64: inputParams.signature_data_svgbase64, // Not currently defined
		// signatory_name: inputParams.signatory_name, // Not currently defined
		// esignature_pointCount: inputParams.esignature_pointCount, // Not currently defined
		// esignature_strokeCount: inputParams.esignature_strokeCount, // Not currently defined
		// esignature_maxStrokeLength: inputParams.esignature_maxStrokeLength, // Not currently defined
		
		// Retainer text content
		Retainer_HTML: inputParams.retainer_text,
		
		// Additional hash-related fields
		retainer_text_hash: inputParams.hash_data?.retainer_text ? 'present' : 'missing',
		signature_data_image_hash: inputParams.hash_data?.signature_data_image ? 'present' : 'missing'
	};
	
	// Add eligibility questions and answers as separate fields
	if (inputParams.eligibility_questions) {
		console.log('Adding eligibility questions and answers to LeadDocket data...');
		for (const [questionId, questionData] of Object.entries(inputParams.eligibility_questions)) {
			const data = questionData as any;
			
			// Add the question
			leadDocketData[questionId] = data.question;
			console.log(`Added ${questionId}: ${data.question}`);
			
			// Add the corresponding answer
			const answerId = questionId.replace('eligibility_question_', 'eligibility_answer_');
			leadDocketData[answerId] = data.answer;
			console.log(`Added ${answerId}: ${data.answer}`);
		}
	}
	
	return leadDocketData;
}