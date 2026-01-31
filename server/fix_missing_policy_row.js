require('dotenv').config();
const { google } = require('googleapis');

const SHEET_SETTINGS = '직영점_설정';
const CARRIERS = ['SK', 'KT', 'LG'];

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

async function fixMissingPolicyRow() {
    try {
        const { sheets, SPREADSHEET_ID } = createSheetsClient();
        console.log(`Checking Spreadsheet: ${SPREADSHEET_ID}`);

        // 1. Read existing data
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS
        });

        const rows = res.data.values || [];
        const missingFixes = [];

        // 2. Check each carrier for missing 'policy' row
        for (const carrier of CARRIERS) {
            const hasPolicy = rows.some(r => (r[0] || '').trim() === carrier && (r[1] || '').trim() === 'policy');

            if (!hasPolicy) {
                console.log(`[${carrier}] Missing 'policy' row. preparing to add...`);
                // Add default row: [Carrier, Type, SheetId(Link), SheetURL(Empty), JsonSettings(Empty Object)]
                missingFixes.push([carrier, 'policy', '', '', '{}']);
            } else {
                console.log(`[${carrier}] 'policy' row exists.`);
            }
        }

        // 3. Append missing rows
        if (missingFixes.length > 0) {
            console.log(`Appending ${missingFixes.length} missing rows...`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: SHEET_SETTINGS,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: missingFixes
                }
            });
            console.log('✅ Missing rows added successfully.');
        } else {
            console.log('✅ All carriers have policy rows. No changes needed.');
        }

    } catch (error) {
        console.error('Error fixing data:', error);
    }
}

fixMissingPolicyRow();
