import { JotFormSubmissionResponse } from '../types/jotform';
import { HiddenFieldsData, EligibilityQuestionsData } from '../types/common';

// Helper function to extract hidden fields from already-fetched submission data
export function getHiddenFieldsFromSubmission(submissionData: JotFormSubmissionResponse | null): HiddenFieldsData {
	const hiddenFields: HiddenFieldsData = {};
	
	if (!submissionData) {
		console.log('No submission data provided for hidden fields');
		return hiddenFields;
	}

	if (submissionData.content && submissionData.content.answers) {
		console.log('Searching for hidden fields...');
		
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for specific hidden fields by their text property
			if (answer.text) {
				const fieldText = answer.text.toLowerCase();
				
				// Check for various field name patterns
				if (fieldText === 'client_id' || fieldText === 'clientid') {
					hiddenFields.client_id = answer.answer?.toString() || null;
					console.log(`Found client_id in question ${questionId}:`, hiddenFields.client_id);
				} else if (fieldText === 'case_type' || fieldText === 'casetype') {
					hiddenFields.case_type = answer.answer?.toString() || null;
					console.log(`Found case_type in question ${questionId}:`, hiddenFields.case_type);
				} else if (fieldText === 'utm_campaign') {
					hiddenFields.utm_campaign = answer.answer?.toString() || null;
					console.log(`Found utm_campaign in question ${questionId}:`, hiddenFields.utm_campaign);
				} else if (fieldText === 'utm_source') {
					hiddenFields.utm_source = answer.answer?.toString() || null;
					console.log(`Found utm_source in question ${questionId}:`, hiddenFields.utm_source);
				} else if (fieldText === 'utm_term') {
					hiddenFields.utm_term = answer.answer?.toString() || null;
					console.log(`Found utm_term in question ${questionId}:`, hiddenFields.utm_term);
				} else if (fieldText === 'utm_content') {
					hiddenFields.utm_content = answer.answer?.toString() || null;
					console.log(`Found utm_content in question ${questionId}:`, hiddenFields.utm_content);
				} else if (fieldText === 'project_id' || fieldText === 'projectid') {
					hiddenFields.project_id = answer.answer?.toString() || null;
					console.log(`Found project_id in question ${questionId}:`, hiddenFields.project_id);
				}
			}
		}
	}
	
	console.log('Extracted hidden fields:', hiddenFields);
	return hiddenFields;
}

// Helper function to extract eligibility questions from submission
export function getEligibilityQuestionsFromSubmission(submissionData: JotFormSubmissionResponse | null): EligibilityQuestionsData {
	const eligibilityQuestions: EligibilityQuestionsData = {};
	
	if (!submissionData) {
		console.log('No submission data provided for eligibility questions');
		return eligibilityQuestions;
	}

	if (submissionData.content && submissionData.content.answers) {
		console.log('Searching for eligibility questions...');
		
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for questions with names that match "eligibility_question_" followed by numbers
			if (answer.name && answer.name.match(/^eligibility_question_\d+$/)) {
				eligibilityQuestions[answer.name] = {
					questionId: questionId,
					question: answer.text || '',
					answer: answer.answer,
					type: answer.type
				};
				console.log(`Found eligibility question ${answer.name} (ID: ${questionId}): "${answer.text}" = ${answer.answer}`);
			}
		}
	}
	
	console.log(`Extracted ${Object.keys(eligibilityQuestions).length} eligibility questions:`, eligibilityQuestions);
	return eligibilityQuestions;
}