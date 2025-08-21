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

// Helper function to convert state abbreviation to full state name
export function getStateName(stateAbbreviation: string | null): string | null {
	if (!stateAbbreviation) return null;
	
	const abbreviationMap: Record<string, string> = {
		'AL': 'Alabama',
		'AK': 'Alaska',
		'AZ': 'Arizona',
		'AR': 'Arkansas',
		'CA': 'California',
		'CO': 'Colorado',
		'CT': 'Connecticut',
		'DE': 'Delaware',
		'FL': 'Florida',
		'GA': 'Georgia',
		'HI': 'Hawaii',
		'ID': 'Idaho',
		'IL': 'Illinois',
		'IN': 'Indiana',
		'IA': 'Iowa',
		'KS': 'Kansas',
		'KY': 'Kentucky',
		'LA': 'Louisiana',
		'ME': 'Maine',
		'MD': 'Maryland',
		'MA': 'Massachusetts',
		'MI': 'Michigan',
		'MN': 'Minnesota',
		'MS': 'Mississippi',
		'MO': 'Missouri',
		'MT': 'Montana',
		'NE': 'Nebraska',
		'NV': 'Nevada',
		'NH': 'New Hampshire',
		'NJ': 'New Jersey',
		'NM': 'New Mexico',
		'NY': 'New York',
		'NC': 'North Carolina',
		'ND': 'North Dakota',
		'OH': 'Ohio',
		'OK': 'Oklahoma',
		'OR': 'Oregon',
		'PA': 'Pennsylvania',
		'RI': 'Rhode Island',
		'SC': 'South Carolina',
		'SD': 'South Dakota',
		'TN': 'Tennessee',
		'TX': 'Texas',
		'UT': 'Utah',
		'VT': 'Vermont',
		'VA': 'Virginia',
		'WA': 'Washington',
		'WV': 'West Virginia',
		'WI': 'Wisconsin',
		'WY': 'Wyoming',
		'DC': 'District of Columbia',
		'PR': 'Puerto Rico',
		'GU': 'Guam',
		'AS': 'American Samoa',
		'VI': 'U.S. Virgin Islands',
		'MP': 'Northern Mariana Islands'
	};
	
	// Try exact match first (uppercase)
	const upperAbbr = stateAbbreviation.toUpperCase();
	if (abbreviationMap[upperAbbr]) {
		return abbreviationMap[upperAbbr];
	}
	
	// Try case-insensitive match
	for (const [abbr, fullName] of Object.entries(abbreviationMap)) {
		if (abbr.toLowerCase() === stateAbbreviation.toLowerCase()) {
			return fullName;
		}
	}
	
	console.log(`Could not find state name for abbreviation: ${stateAbbreviation}`);
	return null;
}