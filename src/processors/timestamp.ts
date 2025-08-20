import { JotFormSubmissionResponse } from '../types/jotform';

// Helper function to generate timestamps based on webhook receipt time
export function getTimestamps(): { tsa_timestamp: string; tsa_timestamp_utc: string } {
	// Use current time (when webhook was received) instead of JotForm's timestamp
	// This eliminates timezone confusion and uses the actual processing time
	const now = new Date();
	
	// Get both formats
	const localTimestamp = now.toString(); // Server timezone (UTC for Cloudflare)
	const utcTimestamp = now.toUTCString(); // UTC format
	
	console.log(`Generated webhook receipt timestamps → Local: "${localTimestamp}", UTC: "${utcTimestamp}"`);
	
	return {
		tsa_timestamp: localTimestamp,
		tsa_timestamp_utc: utcTimestamp
	};
}