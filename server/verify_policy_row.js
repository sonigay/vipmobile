require('dotenv').config();
const { google } = require('googleapis');

const SHEET_SETTINGS = '직영점_설정';

function createSheetsClient() {
    const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
    const SPREADSHEET_ID = process.env.SHEET_ID;

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
        throw new Error('Missing environment variables');
    }

    const auth = new google.auth.JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return { sheets, SPREADSHEET_ID };
}

async function verifyPolicyRows() {
    try {
        const { sheets, SPREADSHEET_ID } = createSheetsClient();
        console.log(`Checking Spreadsheet: ${SPREADSHEET_ID}`);

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS
        });

        const rows = res.data.values || [];
        console.log(`Total Rows Found: ${rows.length}`);

        console.log('\n--- Checking for "policy" rows ---');
        rows.forEach((row, index) => {
            const carrier = row[0];
            const type = row[1];
            if (type === 'policy') {
                console.log(`[Row ${index + 1}] Found Policy for ${carrier}`);
                console.log(`   - SheetID (Col 3): "${row[2] || ''}"`);
                console.log(`   - JSON (Col 5):    "${row[4] || ''}"`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

verifyPolicyRows();
