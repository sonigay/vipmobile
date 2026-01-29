const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { google } = require('googleapis');

async function investigate() {
    try {
        const auth = new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const SPREADSHEET_ID = process.env.SHEET_ID;

        console.log('Checking Spreadsheet:', SPREADSHEET_ID);

        const checkSheet = async (sheetName) => {
            console.log(`\n--- Checking ${sheetName} ---`);
            try {
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${sheetName}!A1:Z5`
                });
                const rows = res.data.values || [];
                if (rows.length === 0) {
                    console.log('Sheet is empty.');
                } else {
                    console.log('Headers:', rows[0]);
                    console.log('Row 1:', rows[1] || 'None');
                    console.log('Row 2:', rows[2] || 'None');
                }
            } catch (e) {
                console.log('Error reading sheet:', e.message);
            }
        };

        await checkSheet('직영점_정책_부가서비스');
        await checkSheet('직영점_정책_별도');

    } catch (error) {
        console.error('Fatal Error:', error);
    }
}

investigate();
