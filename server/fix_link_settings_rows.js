
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const SPREADSHEET_ID = process.env.SHEET_ID;
const SHEET_SETTINGS = '직영점_설정';
const CARRIERS = ['SK', 'KT', 'LG'];
const SETTING_TYPES = ['planGroup', 'support', 'policy'];

async function createSheetsClient() {
    const auth = new GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

async function fixLinkSettings() {
    console.log('🚀 Repairing Link Settings Rows...');
    const sheets = await createSheetsClient();

    // 1. Fetch current settings
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
    });
    const rows = res.data.values || [];
    console.log(`   Current rows: ${rows.length}`);

    const missingRows = [];

    for (const carrier of CARRIERS) {
        for (const type of SETTING_TYPES) {
            const exists = rows.find(r => (r[0] || '').trim() === carrier && (r[1] || '').trim() === type);
            if (!exists) {
                console.log(`   [MISSING] ${carrier} - ${type}`);
                // Add blank default row
                // Format: [Carrier, Type, Link(SheetID), Range, JSON]
                missingRows.push([carrier, type, '', '', '{}']);
            } else {
                console.log(`   [OK] ${carrier} - ${type}`);
            }
        }
    }

    if (missingRows.length > 0) {
        console.log(`\n   Adding ${missingRows.length} missing rows...`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: missingRows }
        });
        console.log('   ✅ Repair complete.');
    } else {
        console.log('\n   ✅ All settings rows exist. No repair needed.');
    }
}

fixLinkSettings().catch(console.error);
