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

// Helper function to parse autocompleted address widget data
export function parseAutocompletedAddress(submissionData: JotFormSubmissionResponse | null): AddressData | null {
	if (!submissionData?.content?.answers) {
		console.log('No submission data or answers provided');
		return null;
	}

	for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
		// Look for Autocompleted Address widget
		if ((answer as any).cfname === 'Autocompleted Address' && answer.answer) {
			console.log(`Found Autocompleted Address widget in question ${questionId}`);
			console.log('Raw answer:', answer.answer);
			
			// Parse the multi-line address data
			// Format: "Street name: Audiffred Lane\nHouse number: 116\nCity: Woodside\nState: CA\nPostal code: 94062\nCountry: United States"
			const addressText = answer.answer as string;
			const lines = addressText.split('\n');
			
			let streetName = '';
			let houseNumber = '';
			let city = '';
			let state = '';
			let postalCode = '';
			
			for (const line of lines) {
				const trimmedLine = line.trim();
				if (trimmedLine.startsWith('Street name: ')) {
					streetName = trimmedLine.substring('Street name: '.length);
				} else if (trimmedLine.startsWith('House number: ')) {
					houseNumber = trimmedLine.substring('House number: '.length);
				} else if (trimmedLine.startsWith('City: ')) {
					city = trimmedLine.substring('City: '.length);
				} else if (trimmedLine.startsWith('State: ')) {
					state = trimmedLine.substring('State: '.length);
				} else if (trimmedLine.startsWith('Postal code: ')) {
					postalCode = trimmedLine.substring('Postal code: '.length);
				}
			}
			
			// Combine house number and street name for address line 1
			const addressLine1 = houseNumber && streetName ? `${houseNumber} ${streetName}` : (streetName || houseNumber || null);
			
			const parsedAddress: AddressData = {
				questionId,
				address_line_1: addressLine1,
				address_line_2: null, // Autocompleted address doesn't seem to have line 2
				city: city || null,
				state: state || null,
				zip_code: postalCode || null
			};
			
			console.log('Parsed address components:', {
				streetName,
				houseNumber,
				city,
				state,
				postalCode,
				combinedAddressLine1: addressLine1
			});
			
			return parsedAddress;
		}
	}
	
	console.log('No Autocompleted Address widget found');
	return null;
}