const axios = require('axios');

const BASE_URL = 'http://localhost:4001'; // Use temp server port

const API_BASE_URL = `${BASE_URL}/api/direct`;

async function debugSettings() {
    try {
        console.log('--- Debugging /link-settings ---');
        const carriers = ['SK', 'LGU', 'KT'];
        for (const carrier of carriers) {
            console.log(`\nFetching link-settings for ${carrier}...`);
            try {
                const res = await axios.get(`${API_BASE_URL}/link-settings?carrier=${carrier}`);
                console.log(`[${carrier}] Success:`, res.data.success);
                console.log(`[${carrier}] Policy:`, JSON.stringify(res.data.policy, null, 2));
                // Check if policy has ranges
                if (res.data.policy && Object.keys(res.data.policy).length === 1 && res.data.policy.link === '') {
                    console.warn(`[${carrier}] WARNING: Policy object is empty/default.`);
                }
            } catch (err) {
                if (err.response) {
                    console.error(`[${carrier}] Failed: ${err.response.status} ${err.response.statusText}`);
                    console.error('Data:', err.response.data);
                } else {
                    console.error(`[${carrier}] Failed:`, err.message);
                }
            }
        }

        console.log('\n--- Debugging /main-page-texts ---');
        try {
            const res = await axios.get(`${API_BASE_URL}/main-page-texts`);
            console.log('Success:', res.data.success);
            console.log('Data:', JSON.stringify(res.data.data, null, 2));
        } catch (err) {
            if (err.response) {
                console.error(`Failed: ${err.response.status} ${err.response.statusText}`);
                console.error('Data:', err.response.data);
            } else {
                console.error('Failed:', err.message);
            }
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

debugSettings();
