import { JotFormSubmissionResponse } from '../types/jotform';
import { AddressData } from '../types/common';

// Helper function to extract address from already-fetched submission data
export function getAddressFromSubmission(submissionData: JotFormSubmissionResponse | null): AddressData[] {
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