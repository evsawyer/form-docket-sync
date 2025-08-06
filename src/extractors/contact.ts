import { JotFormSubmissionResponse } from '../types/jotform';
import { NameData, EmailData, PhoneData } from '../types/common';

// Helper function to extract name from already-fetched submission data
export function getNameFromSubmission(submissionData: JotFormSubmissionResponse | null): NameData[] {
	const names: NameData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for name');
		return names;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_fullname' && answer.answer) {
				const nameData: NameData = {
					questionId,
					first_name: answer.answer.first || null,
					last_name: answer.answer.last || null
				};
				names.push(nameData);
				console.log(`Found name in question ${questionId}:`, nameData);
			}
		}
	}
	
	return names;
}

// Helper function to extract email from already-fetched submission data
export function getEmailFromSubmission(submissionData: JotFormSubmissionResponse | null): EmailData[] {
	const emails: EmailData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for email');
		return emails;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_email' && answer.answer) {
				const emailData: EmailData = {
					questionId,
					email_address: answer.answer || null
				};
				emails.push(emailData);
				console.log(`Found email in question ${questionId}:`, emailData);
			}
		}
	}
	
	return emails;
}

// Helper function to extract phone from already-fetched submission data
export function getPhoneFromSubmission(submissionData: JotFormSubmissionResponse | null): PhoneData[] {
	const phones: PhoneData[] = [];
	
	if (!submissionData) {
		console.log('No submission data provided for phone');
		return phones;
	}

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			if (answer.type === 'control_phone' && answer.answer) {
				const phoneData: PhoneData = {
					questionId,
					phone_number: answer.answer.full || answer.answer || null
				};
				phones.push(phoneData);
				console.log(`Found phone in question ${questionId}:`, phoneData);
			}
		}
	}
	
	return phones;
}