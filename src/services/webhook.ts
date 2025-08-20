import { getSubmissionDetails } from './jotform';
import { sendToLeadDocket } from './leaddocket';
import { mapToLeadDocketFormat } from '../mappers/leaddocket';
import { getSignatureFromSubmission } from '../extractors/signature';
import { getAddressFromSubmission } from '../extractors/address';
import { getNameFromSubmission, getEmailFromSubmission, getPhoneFromSubmission } from '../extractors/contact';
import { getUserAgentFromSubmission, getGeolocationFromSubmission } from '../extractors/metadata';
import { getHiddenFieldsFromSubmission, getEligibilityQuestionsFromSubmission } from '../extractors/fields';
import { getTimestamps } from '../processors/timestamp';
import { getRetainerFromSubmission } from '../extractors/retainer';

// Helper function for background processing after webhook response
export async function processWebhookInBackground(submissionId: string, formId: string, formTitle: string, jotformApiKey: string, leadDocketApiKey: string) {
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
		const retainerData = getRetainerFromSubmission(submissionData);
		const formattedDates = getTimestamps();

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
			
			// Formatted dates
			tsa_timestamp: formattedDates.tsa_timestamp,
			tsa_timestamp_utc: formattedDates.tsa_timestamp_utc,
			
			// Retainer text
			retainer_text: retainerData?.retainer_text || null,
			
			// Hidden fields from form
			client_id: hiddenFields.client_id,
			case_type: hiddenFields.case_type,
			utm_campaign: hiddenFields.utm_campaign,
			utm_source: hiddenFields.utm_source,
			utm_term: hiddenFields.utm_term,
			utm_content: hiddenFields.utm_content,
			utm_medium: hiddenFields.utm_medium,
			utm_id: hiddenFields.utm_id,
			project_id: hiddenFields.project_id,
			
			// Eligibility questions from form
			eligibility_questions: eligibilityQuestions,
			
			// Include arrays of all found instances (in case there are multiple)
			all_data: {
				names: names,
				emails: emails,
				phones: phones,
				addresses: addresses,
				hidden_fields: hiddenFields,
				eligibility_questions: eligibilityQuestions,
				geolocation: geolocationData,
				formatted_dates: formattedDates,
				retainer_data: retainerData
			}
		};

		// Log the processed data
		console.log('Processed webhook input params:', JSON.stringify(inputParams, null, 2));
		
		// Map to LeadDocket format and send
		const leadDocketData = await mapToLeadDocketFormat(inputParams);
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