import { JotFormSubmissionResponse } from '../types/jotform';

// Helper function to convert JotForm timestamp to LeadDocket format (forced to Central Time)
export function convertToLeadDocketTimestamp(jotFormTimestamp: string): string {
	try {
		// JotForm format: "2025-08-06 16:37:50"
		// LeadDocket format: "Mon Apr 21 2025 07:15:01 GMT-0500 (Central Daylight Time)"
		
		// Parse the JotForm timestamp - assuming it's already in Central Time
		// Parse manually to avoid timezone interpretation issues
		const parts = jotFormTimestamp.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
		if (!parts) {
			throw new Error('Invalid timestamp format');
		}
		
		const [, year, month, day, hour, minute, second] = parts;
		// Create date assuming the timestamp is already in Central Time
		const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
		
		// Format to LeadDocket's expected format: "Mon Apr 21 2025 07:15:01 GMT-0500 (Central Daylight Time)"
		// Using toLocaleString with specific options to match exact format
		const formattedDate = date.toLocaleString('en-US', {
			timeZone: 'America/Chicago',  // Force Central Time (handles CST/CDT automatically)
			weekday: 'short',    // Mon
			year: 'numeric',     // 2025
			month: 'short',      // Apr
			day: 'numeric',      // 21 (no leading zero, no commas)
			hour: '2-digit',     // 07
			minute: '2-digit',   // 15
			second: '2-digit',   // 01
			hour12: false,       // 24-hour format instead of 12-hour
			timeZoneName: 'longOffset' // GMT-0500 or GMT-0600
		}).replace(/,/g, '').replace(/GMT([+-]\d{2}):?(\d{2})/, (match, hourOffset, minuteOffset) => {
			// Reconstruct offset without colon and determine timezone name
			const offset = `${hourOffset}${minuteOffset}`;
			const timezoneName = offset === '-0500' ? 'Central Daylight Time' : 'Central Standard Time';
			return `GMT${offset} (${timezoneName})`;
		});
		
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
		// Parse the JotForm timestamp manually and assume it's in Eastern Time
		const parts = jotFormTimestamp.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
		if (!parts) {
			throw new Error('Invalid timestamp format');
		}
		
		const [, year, month, day, hour, minute, second] = parts;
		// Create a date string that explicitly indicates Eastern Time
		const easternTimeString = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
		
		// Use toLocaleString to convert Eastern Time to UTC
		const easternDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
		
		// Get the UTC equivalent by treating the input as Eastern Time
		const utcTime = easternDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
		const utcDate = new Date(utcTime);
		
		// Actually, let's use a simpler approach - create date and convert timezone
		const tempDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-04:00`); // EDT offset
		const date = new Date(tempDate.getTime());
		
		// Format UTC timestamp using toLocaleString with UTC timezone
		const utcFormatted = date.toLocaleString('en-US', {
			timeZone: 'UTC',        // Force UTC timezone
			weekday: 'short',       // Mon
			year: 'numeric',        // 2025
			month: 'short',         // Apr
			day: 'numeric',         // 21
			hour: '2-digit',        // 12
			minute: '2-digit',      // 15
			second: '2-digit',      // 01
			hour12: false           // 24-hour format
		}).replace(/(\w{3}) (\w{3}) (\d+) (\d{4}) (\d{2}:\d{2}:\d{2})/, '$1, $3 $2 $4 $5 GMT');
		
		console.log(`Converted UTC timestamp: "${jotFormTimestamp}" → "${utcFormatted}"`);
		return utcFormatted;
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