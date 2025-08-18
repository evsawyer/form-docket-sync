import { JotFormSubmissionResponse } from '../types/jotform';
import { HashData } from '../types/common';

// Helper function to create a hash from specific parameters
export async function createHash(tsaTimestampUtc: string | null, retainerText: string | null, signatureBase64: string | null): Promise<string> {
	// Create hash from the provided parameters
	const hashInput = [
		retainerText || '',
		signatureBase64 || '',
		tsaTimestampUtc || ''
	].join('|');

	try {
		// Create SHA-256 hash using Cloudflare Workers crypto API
		const encoder = new TextEncoder();
		const data = encoder.encode(hashInput);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		console.log(`Created SHA-256 hash: ${hash}`);
		return hash;
	} catch (error) {
		console.error('Error creating crypto hash:', error);
		// Fallback to a simple base64-based hash if crypto fails
		const fallbackHash = btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
		console.log(`Created fallback hash: ${fallbackHash}`);
		return fallbackHash;
	}
}

// Legacy function to create a hash from retainer text, signature base64, and created_at (keeping for backward compatibility)
export async function createHashLegacy(submissionData: JotFormSubmissionResponse | null, signatureBase64: string | null): Promise<HashData> {
	const hashData: HashData = {
		retainer_text: null,
		signature_data_image: signatureBase64,
		created_at: null,
		hash: ''
	};
	
	if (!submissionData) {
		console.log('No submission data provided for hash creation');
		return hashData;
	}

	// Extract created_at
	hashData.created_at = submissionData.content?.created_at || null;

	if (submissionData.content && submissionData.content.answers) {
		for (const [questionId, answer] of Object.entries(submissionData.content.answers)) {
			// Look for retainer field by name "retainer0"
			if (answer.name === 'retainer0' && answer.type === 'control_text') {
				hashData.retainer_text = answer.text || null;
				console.log(`Found retainer text in question ${questionId} (length: ${hashData.retainer_text?.length || 0})`);
			}
		}
	}

	// Create hash from the extracted data
	const hashInput = [
		hashData.retainer_text || '',
		hashData.signature_data_image || '',
		hashData.created_at || ''
	].join('|');

	try {
		// Create SHA-256 hash using Cloudflare Workers crypto API
		const encoder = new TextEncoder();
		const data = encoder.encode(hashInput);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		hashData.hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		console.log(`Created SHA-256 hash: ${hashData.hash}`);
	} catch (error) {
		console.error('Error creating crypto hash:', error);
		// Fallback to a simple base64-based hash if crypto fails
		hashData.hash = btoa(hashInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
		console.log(`Created fallback hash: ${hashData.hash}`);
	}

	console.log('Hash data extracted:', {
		retainer_text_length: hashData.retainer_text?.length || 0,
		signature_data_image_length: hashData.signature_data_image?.length || 0,
		created_at: hashData.created_at,
		hash_input_length: hashInput.length,
		hash: hashData.hash
	});

	return hashData;
}