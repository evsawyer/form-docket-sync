import { JotFormSubmissionResponse } from '../types/jotform';

// Helper function to convert JotForm timestamp to both local and UTC formats
export function convertToLeadDocketTimestamp(jotFormTimestamp: string): { tsa_timestamp: string; tsa_timestamp_utc: string } {
	try {
		// JotForm format: "2025-08-06 16:37:50" (always EST)
		// Parse the JotForm timestamp and create Date with EST timezone
		const parts = jotFormTimestamp.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
		if (!parts) {
			throw new Error('Invalid timestamp format');
		}
		
		const [, year, month, day, hour, minute, second] = parts;
		// Create date with EST offset (-05:00 for EST)
		// This will automatically convert EST to UTC internally
		const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`);
		
		// Get both formats
		const localTimestamp = date.toString(); // Server timezone (UTC for Cloudflare)
		const utcTimestamp = date.toUTCString(); // UTC format
		
		console.log(`Converted timestamp: "${jotFormTimestamp}" → Local: "${localTimestamp}", UTC: "${utcTimestamp}"`);
		
		return {
			tsa_timestamp: localTimestamp,
			tsa_timestamp_utc: utcTimestamp
		};
		
	} catch (error) {
		console.error('Error converting timestamp:', error);
		// Fallback to original timestamp if conversion fails
		return {
			tsa_timestamp: jotFormTimestamp,
			tsa_timestamp_utc: jotFormTimestamp
		};
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
	return convertToLeadDocketTimestamp(createdAt);
}
}