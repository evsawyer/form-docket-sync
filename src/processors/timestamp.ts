import { JotFormSubmissionResponse } from '../types/jotform';

// Helper function to convert JotForm timestamp to LeadDocket format (Central Time)
export function convertToLeadDocketTimestamp(jotFormTimestamp: string): string {
	try {
		// JotForm format: "2025-08-06 16:37:50" (always EST)
		// LeadDocket format: "Mon Apr 21 2025 07:15:01 GMT-0500 (Central Daylight Time)"
		
		// Parse the JotForm timestamp and create Date with EST timezone
		const parts = jotFormTimestamp.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
		if (!parts) {
			throw new Error('Invalid timestamp format');
		}
		
		const [, year, month, day, hour, minute, second] = parts;
		// Create date with EST offset (-05:00 for EST, -04:00 for EDT)
		// Using -05:00 as you specified EST (not EDT)
		const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`);
		
		// Convert to Central Time and use toString() format
		const centralTime = date.toLocaleString('en-US', { timeZone: 'America/Chicago' });
		const centralDate = new Date(centralTime);
		
		// Use the simple toString() method - it gives us exactly what we need!
		const formattedDate = centralDate.toString();
		
		console.log(`Converted timestamp: "${jotFormTimestamp}" → "${formattedDate}"`);
		return formattedDate;
		
	} catch (error) {
		console.error('Error converting timestamp:', error);
		// Fallback to original timestamp if conversion fails
		return jotFormTimestamp;
	}
}

// Helper function to convert JotForm timestamp to UTC format: "Mon, 21 Apr 2025 12:15:01 GMT"
export function convertToUTCTimestamp(jotFormTimestamp: string): string {
	try {
		// JotForm format: "2025-08-06 16:37:50" (always EST)
		// UTC format: "Mon, 21 Apr 2025 12:15:01 GMT"
		
		// Parse the JotForm timestamp and create Date with EST timezone
		const parts = jotFormTimestamp.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
		if (!parts) {
			throw new Error('Invalid timestamp format');
		}
		
		const [, year, month, day, hour, minute, second] = parts;
		// Create date with EST offset (-05:00)
		const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`);
		
		// Use the simple toUTCString() method - it gives us exactly what we need!
		const formattedDate = date.toUTCString();
		
		console.log(`Converted UTC timestamp: "${jotFormTimestamp}" → "${formattedDate}"`);
		return formattedDate;
		
	} catch (error) {
		console.error('Error converting UTC timestamp:', error);
		// Fallback to original timestamp if conversion fails
		return jotFormTimestamp;
	}
}

// Helper function to format dates for LeadDocket (both Central Time and UTC)
export function getFormattedDates(submissionData: JotFormSubmissionResponse | null) {
	if (!submissionData?.content?.created_at) {
		return {
			tsa_timestamp: null,
			tsa_timestamp_utc: null
		};
	}

	const createdAt = submissionData.content.created_at;
	return {
		tsa_timestamp: convertToLeadDocketTimestamp(createdAt),
		tsa_timestamp_utc: convertToUTCTimestamp(createdAt)
	};
}