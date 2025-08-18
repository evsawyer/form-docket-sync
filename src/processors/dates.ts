import { JotFormSubmissionResponse } from '../types/jotform';
import { convertToLeadDocketTimestamp } from './timestamp';

// Helper function to format dates for LeadDocket
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
		tsa_timestamp_utc: new Date(createdAt).toUTCString()
	};
}
