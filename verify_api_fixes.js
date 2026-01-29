const http = require('http');

const API_BASE = 'http://localhost:4000';

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        http.get(`${API_BASE}${path}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function verify() {
    console.log('🔍 [Verification] Starting API Check...');

    // 1. Check Store Data (Range expansion & Index mapping)
    try {
        console.log('\nTesting /api/stores...');
        const storesRes = await makeRequest('/api/stores?includeShipped=false');
        if (storesRes.status === 200 && Array.isArray(storesRes.data)) {
            console.log(`✅ Stores fetched: ${storesRes.data.length} items`);
            if (storesRes.data.length > 0) {
                const sample = storesRes.data[0];
                console.log('Sample Store Data:', {
                    name: sample.name,
                    managerName: sample.managerName,
                    businessNumber: sample.businessNumber,
                    phone: sample.phone
                });
                if (sample.managerName && sample.businessNumber) {
                    console.log('✅ Manager Name & Business Number present!');
                } else {
                    console.warn('⚠️ Manager Name or Business Number is MISSING in sample.');
                }
            }
        } else {
            console.error('❌ Failed to fetch stores:', storesRes.status);
        }
    } catch (e) {
        console.error('❌ Error fetching stores:', e.message);
    }

    // 2. Check Transit Location (Supabase Fallback)
    try {
        console.log('\nTesting /api/direct/transit-location/list...');
        const transitRes = await makeRequest('/api/direct/transit-location/list');
        if (transitRes.status === 200 && transitRes.data.success) {
            const data = transitRes.data.data || [];
            console.log(`✅ Transit Locations fetched: ${data.length} stores with transit info`);
            if (data.length === 0) {
                console.warn('⚠️ Transit Location list is empty (Fallback might have returned empty or both DB/Sheet empty)');
            }
        } else {
            console.error('❌ Failed to fetch transit locations:', transitRes.status, transitRes.data);
        }
    } catch (e) {
        console.error('❌ Error fetching transit locations:', e.message);
    }

    // 3. Check Image Monitoring (New Endpoint)
    try {
        console.log('\nTesting /api/discord/image-monitoring...');
        const monitorRes = await makeRequest('/api/discord/image-monitoring');
        if (monitorRes.status === 200 && monitorRes.data.success) {
            console.log('✅ Image Monitoring Endpoint works (Dummy response received)');
        } else {
            console.error('❌ Image Monitoring Endpoint Failed:', monitorRes.status);
        }
    } catch (e) {
        console.error('❌ Error fetching monitoring:', e.message);
    }

    console.log('\n🏁 Verification Finished.');
}

verify();
