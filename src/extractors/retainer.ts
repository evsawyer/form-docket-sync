import { JotFormSubmissionResponse } from '../types/jotform';

export interface RetainerData {
	questionId: string;
	retainer_text: string;
}

// Helper function to extract and concatenate retainer text from already-fetched submission data
export function getRetainerFromSubmission(submissionData: JotFormSubmissionResponse | null): RetainerData | null {
	if (!submissionData) {
		console.log('No submission data provided for retainer');
		return null;
	}

	// Collect all retainer fields with their indices
	const retainerFields: { index: number; questionId: string; text: string }[] = [];

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for retainer fields by name pattern "retainer{n}" where n is an integer
			const retainerMatch = answer.name?.match(/^retainer(\d+)$/);
			if (retainerMatch && answer.type === 'control_text') {
				const retainerText = answer.text || '';
				const index = parseInt(retainerMatch[1], 10);
				
				if (retainerText.trim()) {
					retainerFields.push({
						index,
						questionId,
						text: retainerText
					});
					console.log(`Found retainer text in question ${questionId} (name: retainer${index}, length: ${retainerText.length})`);
				} else {
					console.log(`Retainer field found but no text content in question ${questionId} (name: retainer${index})`);
				}
			}
		}
	}
	
	if (retainerFields.length === 0) {
		console.log('No retainer fields found (looking for name pattern "retainer{n}" and type="control_text")');
		return null;
	}

	// Sort by index to ensure proper order (retainer0, retainer1, retainer2, etc.)
	retainerFields.sort((a, b) => a.index - b.index);

	// Concatenate all retainer texts in order
	const concatenatedText = retainerFields.map(field => field.text).join('\n\n');
	
	// Convert to base64 (handle Unicode characters properly)
	const base64Text = btoa(new TextEncoder().encode(concatenatedText).reduce((data, byte) => data + String.fromCharCode(byte), ''));
	
	// Use the first questionId as the representative ID
	const representativeQuestionId = retainerFields[0].questionId;

	console.log(`Concatenated ${retainerFields.length} retainer field(s) into single text (original length: ${concatenatedText.length}, base64 length: ${base64Text.length})`);

	return {
		questionId: representativeQuestionId,
		retainer_text: base64Text
	};
}

