// Helper function to send data to LeadDocket
export async function sendToLeadDocket(data: any, apiKey: string): Promise<{ success: boolean; message: string; response?: any }> {
	try {
		console.log('Sending data to LeadDocket...');
		console.log('LeadDocket URL:', `https://brysonfirm.leaddocket.com/opportunities/formjson/1?apikey=${apiKey.substring(0, 8)}...`);
		
		const response = await fetch(`https://brysonfirm.leaddocket.com/opportunities/formjson/1?apikey=${apiKey}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify(data)
		});

		console.log(`LeadDocket Response Status: ${response.status} ${response.statusText}`);
		console.log('LeadDocket Response Headers:', Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.error('❌ LeadDocket Error Response:');
			console.error('   Status:', response.status);
			console.error('   Headers:', Object.fromEntries(response.headers.entries()));
			console.error('   Body:', errorText);
			return { 
				success: false, 
				message: `LeadDocket API error: ${response.status} ${response.statusText}`,
				response: errorText
			};
		}

		const result = await response.json();
		console.log('✅ LeadDocket Success Response:');
		console.log('   Status:', response.status);
		console.log('   Response Body:', JSON.stringify(result, null, 2));
		
		return { 
			success: true, 
			message: 'Data sent to LeadDocket successfully',
			response: result
		};
		
	} catch (error) {
		console.error('Error sending to LeadDocket:', error);
		return { 
			success: false, 
			message: error instanceof Error ? error.message : 'Unknown error sending to LeadDocket'
		};
	}
}