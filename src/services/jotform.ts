import { JotFormSubmissionResponse } from '../types/jotform';

// Helper function to get complete submission details from JotForm
export async function getSubmissionDetails(submissionId: string, apiKey: string): Promise<JotFormSubmissionResponse | null> {
	try {
		const response = await fetch(
			`https://api.jotform.com/submission/${submissionId}?apiKey=${apiKey}`,
			{
				method: 'GET',
				headers: { 'Accept': 'application/json' }
			}
		);

		if (!response.ok) {
			console.error(`JotForm API error: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = await response.json() as JotFormSubmissionResponse;
		console.log(`Successfully fetched submission ${submissionId} from JotForm API`);
		return data;
		
	} catch (error) {
		console.error('Error fetching JotForm submission:', error);
		return null;
	}
}