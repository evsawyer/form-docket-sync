import { JotFormSubmissionResponse } from '../types/jotform';

// Helper function to extract signature from already-fetched submission data and convert to base64
export async function getSignatureFromSubmission(submissionData: JotFormSubmissionResponse | null, apiKey: string): Promise<string | null> {
	if (!submissionData) {
		console.log('No submission data provided');
		return null;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const answer of Object.values(submissionData.content.answers)) {
			if (answer.type === 'control_signature' && answer.answer) {
				const signatureUrl = answer.answer;
				console.log(`Found signature URL: ${signatureUrl}`);
				
				try {
					// Fetch the image from JotForm
					const imageResponse = await fetch(`${signatureUrl}?apiKey=${apiKey}`);
					if (!imageResponse.ok) {
						console.error(`Failed to fetch signature image: ${imageResponse.status}`);
						return null;
					}

					// Convert to base64
					const imageBlob = await imageResponse.blob();
					const arrayBuffer = await imageBlob.arrayBuffer();
					const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
					
					// Add data URI preamble to indicate this is a signature image
					const mimeType = imageBlob.type || 'image/png';
					const base64WithPreamble = `${mimeType};base64,${base64}`;
					
					console.log(`Successfully converted signature to base64 with preamble (${base64WithPreamble.length} characters)`);
					return base64WithPreamble;
				} catch (error) {
					console.error('Error fetching/converting signature:', error);
					return null;
				}
			}
		}
	}
	
	console.log('No signature found in submission');
	return null;
}