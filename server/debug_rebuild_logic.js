
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

// 설정
const SPREADSHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// 시트 이름 (directRoutes.js와 동일해야 함)
const SHEET_SETTINGS = '직영점_설정';
const SHEET_POLICY_MARGIN = '직영점_정책_마진';
const SHEET_MOBILE_IMAGES = '직영점_이미지_전체';

async function createSheetsClient() {
    const auth = new GoogleAuth({
        credentials: {
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

async function runDebug() {
    console.log('🚀 [Debug] Rebuild Logic Diagnostics');
    const sheets = await createSheetsClient();

    // 1. Margin Test
    console.log('\n🔍 [1. Policy Margin Test]');
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_MARGIN}!A:B`
        });
        const rows = res.data.values || [];
        console.log(`   Fetched ${rows.length} rows from ${SHEET_POLICY_MARGIN}`);

        ['SK', 'KT', 'LG'].forEach(carrier => {
            const row = rows.find(r => (r[0] || '').trim() === carrier);
            if (row) {
                const rawValue = row[1];
                const numValue = Number(rawValue);
                const fixedValue = Number((rawValue || '').replace(/[^0-9.-]/g, ''));
                console.log(`   Carrier: ${carrier}`);
                console.log(`     - Raw Value: "${rawValue}"`);
                console.log(`     - Number(): ${numValue} (Is NaN? ${isNaN(numValue)})`);
                console.log(`     - Fixed logic: ${fixedValue}`);

                if (isNaN(numValue) && !isNaN(fixedValue)) {
                    console.log(`     ⚠️  PROBLEM DETECTED: Margin is NaN with current logic! Needs fix.`);
                }
            } else {
                console.log(`   Carrier: ${carrier} - NOT FOUND`);
            }
        });
    } catch (err) {
        console.error('   ❌ Failed to fetch margins:', err.message);
    }

    // 2. Link Settings & Device Generation Test
    console.log('\n🔍 [2. Link Settings & Device Generation Test]');
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS
        });
        const settings = res.data.values || [];
        console.log(`   Fetched ${settings.length} settings rows.`);

        for (const carrier of ['SK', 'KT', 'LG']) {
            console.log(`\n   checking ${carrier}...`);
            // Find Policy Row
            const policyRow = settings.find(r => (r[0] || '').trim() === carrier && (r[1] || '').trim() === 'policy');
            const supportRow = settings.find(r => (r[0] || '').trim() === carrier && (r[1] || '').trim() === 'support');

            if (!policyRow) console.warn(`   ⚠️  No 'policy' row found for ${carrier}`);
            else {
                console.log(`   ✅ 'policy' row found: SheetID=${policyRow[2] || 'EMPTY'}`);
                if (policyRow[4]) console.log(`      JSON: ${policyRow[4]}`);
            }

            if (!supportRow) console.warn(`   ⚠️  No 'support' row found for ${carrier}`);
            else {

                // Check if we can fetch from Support Sheet
                const sheetId = supportRow[2];
                let config = {};
                try { config = JSON.parse(supportRow[4] || '{}'); } catch (e) { }
                const range = config.modelRange;

                if (sheetId && range) {
                    try {
                        const mRes = await sheets.spreadsheets.values.get({
                            spreadsheetId: sheetId,
                            range: range
                        });
                        const models = mRes.data.values || [];
                        console.log(`   ✅ Successfully fetched models from Support Sheet (${sheetId}): ${models.length} rows found.`);
                    } catch (e) {
                        console.error(`   ❌ Failed to fetch from Support Sheet (${sheetId}):`, e.message);
                    }
                } else {
                    console.warn(`   ⚠️  Cannot test Support Sheet fetch (Missing ID or Range)`);
                }
            }
        }

    } catch (err) {
        console.error('   ❌ Failed to fetch settings:', err.message);
    }
}

runDebug();
