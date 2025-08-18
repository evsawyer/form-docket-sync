import { JotFormSubmissionResponse } from '../types/jotform';

export interface RetainerData {
	questionId: string;
	retainer_text: string;
}

// Helper function to extract retainer text from already-fetched submission data
export function getRetainerFromSubmission(submissionData: JotFormSubmissionResponse | null): RetainerData | null {
	if (!submissionData) {
		console.log('No submission data provided for retainer');
		return null;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for retainer field by name "retainer0"
			if (answer.name === 'retainer0' && answer.type === 'control_text') {
				const retainerText = answer.text || '';
				
				if (retainerText.trim()) {
					const retainerData: RetainerData = {
						questionId,
						retainer_text: retainerText
					};
					console.log(`Found retainer text in question ${questionId} (length: ${retainerText.length})`);
					return retainerData;
				} else {
					console.log(`Retainer field found but no text content in question ${questionId}`);
				}
			}
		}
	}
	
	console.log('No retainer field found (looking for name="retainer0" and type="control_text")');
	return null;
}
