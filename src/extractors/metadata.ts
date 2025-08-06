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

// Helper function to extract geolocation from Geo Stamp widget
export function getGeolocationFromSubmission(submissionData: JotFormSubmissionResponse | null): GeolocationData | null {
	if (!submissionData) {
		console.log('No submission data provided for geolocation');
		return null;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for Geo Stamp widget by matching the cfname property
			if ((answer as any).cfname === 'Geo Stamp') {
				console.log(`Found Geo Stamp widget in question ${questionId}`);
				
				const geoStampData = answer.answer;
				
				if (typeof geoStampData === 'string' && geoStampData.trim()) {
					// Parse the multi-line geo stamp data to extract latitude and longitude
					const lines = geoStampData.split('\n');
					let latitude: string | null = null;
					let longitude: string | null = null;
					
					for (const line of lines) {
						if (line.startsWith('Latitude: ')) {
							latitude = line.substring('Latitude: '.length).trim();
						} else if (line.startsWith('Longitude: ')) {
							longitude = line.substring('Longitude: '.length).trim();
						}
					}
					
					if (latitude && longitude) {
						// Format as "lat,lon" for consistency
						const geolocationCoords = `${latitude},${longitude}`;
						
						const geolocationData: GeolocationData = {
							questionId,
							geolocation: geolocationCoords
						};
						console.log(`Found geolocation from Geo Stamp in question ${questionId}: ${geolocationCoords}`);
						return geolocationData;
					} else {
						console.log(`Geo Stamp widget found but could not extract lat/lon in question ${questionId}`);
					}
				} else {
					console.log(`Geo Stamp widget found but no valid data in question ${questionId}`);
				}
			}
		}
	}
	
	console.log('No Geo Stamp widget found');
	return null;
}