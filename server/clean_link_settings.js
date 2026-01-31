
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

async function cleanSettings() {
    console.log('🧹 Cleaning Link Settings Sheet...');
    const sheets = await createSheetsClient();

    // 1. Fetch ALL current data
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
    });
    const rawRows = res.data.values || [];
    const header = rawRows[0] || ['통신사', '설정유형', '시트ID', '시트URL', '설정값JSON'];
    const dataRows = rawRows.slice(1); // Exclude header

    // 2. Process Data (Deduplicate & Organize)
    const cleanData = {}; // Key: "CARRIER|TYPE" -> RowArray

    dataRows.forEach(row => {
        const carrier = (row[0] || '').trim();
        const type = (row[1] || '').trim();
        if (!carrier || !type) return; // Skip garbage

        const key = `${carrier}|${type}`;

        // If duplicate exists, keep the one with MORE data (longer JSON)
        if (cleanData[key]) {
            const currentLen = (cleanData[key][4] || '').length;
            const newLen = (row[4] || '').length;
            if (newLen > currentLen) {
                console.log(`   🔸 Replaced duplicate for ${key} (kept longer data)`);
                cleanData[key] = row;
            } else {
                console.log(`   🔹 Ignored duplicate for ${key} (shorter/equal data)`);
            }
        } else {
            cleanData[key] = row;
        }
    });

    // 3. Ensure All Required Rows Exist
    const finalRows = [header];

    for (const carrier of CARRIERS) {
        for (const type of SETTING_TYPES) {
            const key = `${carrier}|${type}`;
            if (cleanData[key]) {
                finalRows.push(cleanData[key]);
            } else {
                console.log(`   VX Added missing row: ${key}`);
                finalRows.push([carrier, type, '', '', '{}']);
            }
        }
    }

    // 4. Sort for readability (SK -> KT -> LG, then by type)
    const sortedRows = finalRows.slice(1).sort((a, b) => {
        const cA = CARRIERS.indexOf(a[0]);
        const cB = CARRIERS.indexOf(b[0]);
        if (cA !== cB) return cA - cB;
        return SETTING_TYPES.indexOf(a[1]) - SETTING_TYPES.indexOf(b[1]);
    });

    const payload = [header, ...sortedRows];

    // 5. Overwrite Sheet (Clear + Update)
    console.log(`\n💾 Writing ${payload.length} rows to sheet...`);

    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_SETTINGS}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: payload }
    });

    console.log('✅ Clean & Repair Complete.');
}

cleanSettings().catch(console.error);
