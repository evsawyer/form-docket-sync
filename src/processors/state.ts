// Helper function to convert state name to two-letter abbreviation
export function getStateAbbreviation(stateName: string | null): string | null {
	if (!stateName) return null;
	
	const stateMap: Record<string, string> = {
		'Alabama': 'AL',
		'Alaska': 'AK',
		'Arizona': 'AZ',
		'Arkansas': 'AR',
		'California': 'CA',
		'Colorado': 'CO',
		'Connecticut': 'CT',
		'Delaware': 'DE',
		'Florida': 'FL',
		'Georgia': 'GA',
		'Hawaii': 'HI',
		'Idaho': 'ID',
		'Illinois': 'IL',
		'Indiana': 'IN',
		'Iowa': 'IA',
		'Kansas': 'KS',
		'Kentucky': 'KY',
		'Louisiana': 'LA',
		'Maine': 'ME',
		'Maryland': 'MD',
		'Massachusetts': 'MA',
		'Michigan': 'MI',
		'Minnesota': 'MN',
		'Mississippi': 'MS',
		'Missouri': 'MO',
		'Montana': 'MT',
		'Nebraska': 'NE',
		'Nevada': 'NV',
		'New Hampshire': 'NH',
		'New Jersey': 'NJ',
		'New Mexico': 'NM',
		'New York': 'NY',
		'North Carolina': 'NC',
		'North Dakota': 'ND',
		'Ohio': 'OH',
		'Oklahoma': 'OK',
		'Oregon': 'OR',
		'Pennsylvania': 'PA',
		'Rhode Island': 'RI',
		'South Carolina': 'SC',
		'South Dakota': 'SD',
		'Tennessee': 'TN',
		'Texas': 'TX',
		'Utah': 'UT',
		'Vermont': 'VT',
		'Virginia': 'VA',
		'Washington': 'WA',
		'West Virginia': 'WV',
		'Wisconsin': 'WI',
		'Wyoming': 'WY',
		'District of Columbia': 'DC',
		'Puerto Rico': 'PR',
		'Guam': 'GU',
		'American Samoa': 'AS',
		'U.S. Virgin Islands': 'VI',
		'Northern Mariana Islands': 'MP'
	};
	
	// Try exact match first
	if (stateMap[stateName]) {
		return stateMap[stateName];
	}
	
	// Try case-insensitive match
	const lowerStateName = stateName.toLowerCase();
	for (const [fullName, abbr] of Object.entries(stateMap)) {
		if (fullName.toLowerCase() === lowerStateName) {
			return abbr;
		}
	}
	
	// If already an abbreviation, return as-is (uppercase)
	if (stateName.length === 2) {
		return stateName.toUpperCase();
	}
	
	console.log(`Could not find abbreviation for state: ${stateName}`);
	return null;
}