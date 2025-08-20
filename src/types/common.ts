// Common data interfaces used across the application

export interface AddressData {
	address_line_1: string | null;
	address_line_2: string | null;
	city: string | null;
	state: string | null;
	zip_code: string | null;
	questionId: string;
}

export interface NameData {
	first_name: string | null;
	last_name: string | null;
	questionId: string;
}

export interface EmailData {
	email_address: string | null;
	questionId: string;
}

export interface PhoneData {
	phone_number: string | null;
	questionId: string;
}

export interface UserAgentData {
	user_agent: string;
	questionId: string;
}

export interface GeolocationData {
	geolocation: string;
	questionId: string;
}

export interface HiddenFieldsData {
	client_id?: string;
	case_type?: string;
	utm_campaign?: string;
	utm_source?: string;
	utm_term?: string;
	utm_content?: string;
	utm_medium?: string;
	utm_id?: string;
	project_id?: string;
}

export interface EligibilityQuestionsData {
	[key: string]: {
		questionId: string;
		question: string;
		answer: any;
		type: string;
	};
}

export interface HashData {
	retainer_text: string | null;
	signature_data_image: string | null;
	created_at: string | null;
	hash: string;
}