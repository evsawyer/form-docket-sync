// JotForm API response types

export interface JotFormSubmissionResponse {
	responseCode: number;
	message: string;
	content: {
		id: string;
		form_id: string;
		created_at: string;
		ip?: string;
		answers: Record<string, JotFormAnswer>;
		[key: string]: any;
	};
}

export interface JotFormAnswer {
	name?: string;
	text: string;
	type: string;
	answer?: any;
	prettyFormat?: string;
}