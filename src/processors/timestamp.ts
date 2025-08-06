// Helper function to convert JotForm timestamp to LeadDocket format
export function convertToLeadDocketTimestamp(jotFormTimestamp: string): string {
	try {
		// JotForm format: "2025-08-06 16:37:50"
		// LeadDocket format: "Mon Apr 21 2025 07:15:01 GMT-0500 (Central Daylight Time)"
		
		// Parse the JotForm timestamp (assuming it's in UTC or server timezone)
		const date = new Date(jotFormTimestamp);
		
		// Format to LeadDocket's expected format
		// Using toLocaleString with specific options to match the format
		const formattedDate = date.toLocaleString('en-US', {
			weekday: 'short',    // Mon
			year: 'numeric',     // 2025
			month: 'short',      // Apr
			day: '2-digit',      // 21
			hour: '2-digit',     // 07
			minute: '2-digit',   // 15
			second: '2-digit',   // 01
			timeZoneName: 'longOffset' // GMT-0500 (Central Daylight Time)
		});
		
		console.log(`Converted timestamp: "${jotFormTimestamp}" → "${formattedDate}"`);
		return formattedDate;
		
	} catch (error) {
		console.error('Error converting timestamp:', error);
		// Fallback to original timestamp if conversion fails
		return jotFormTimestamp;
	}
}