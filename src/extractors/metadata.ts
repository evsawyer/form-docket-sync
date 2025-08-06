import { JotFormSubmissionResponse } from '../types/jotform';
import { UserAgentData, GeolocationData } from '../types/common';

// Helper function to extract user agent from Get User Agent widget
export function getUserAgentFromSubmission(submissionData: JotFormSubmissionResponse | null): UserAgentData | null {
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

// Helper function to extract geolocation from Detected Location field
export function getGeolocationFromSubmission(submissionData: JotFormSubmissionResponse | null): GeolocationData | null {
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