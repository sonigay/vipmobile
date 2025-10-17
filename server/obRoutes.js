const express = require('express');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

// Sheet names
const SHEET_RESULTS = 'OB_결과';
const SHEET_DISCOUNTS = 'OB_할인';
const SHEET_SEGMENTS = 'OB_세그';
const SHEET_PLANS = '무선요금제군';

// Standard headers
const HEADERS_RESULTS = ['id', 'userId', 'createdAt', 'scenarioName', 'inputsJson', 'existingAmount', 'togetherAmount', 'diff', 'chosenType', 'notes'];
const HEADERS_DISCOUNTS = ['discountCode', 'name', 'scope', 'type', 'value', 'conditionsJson'];
const HEADERS_SEGMENTS = ['segmentCode', 'name', 'rulesJson'];

function createSheetsClient() {
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
    throw new Error('Missing Google Sheets environment variables');
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, SPREADSHEET_ID };
}

async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  // Read first row
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`
  });
  const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
  // If empty or mismatch, write standard headers
  const needsInit = firstRow.length === 0 || headers.some((h, i) => (firstRow[i] || '') !== h);
  if (needsInit) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] }
    });
  }
  return headers;
}

function setupObRoutes(app) {
  const router = express.Router();

  // GET /api/ob/plan-data
  router.get('/plan-data', async (req, res) => {
    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      // Read entire plan sheet
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_PLANS
      });
      const rows = response.data.values || [];
      const dataRows = rows.slice(1); // skip header
      // Mapping per user spec: O(14) planName, Q(16) baseFee, T(19) planGroup
      const plans = dataRows
        .map((row) => {
          const planName = (row[14] || '').toString().trim();
          const baseFeeRaw = (row[16] || '0').toString().replace(/,/g, '');
          const baseFee = Number(baseFeeRaw) || 0;
          const planGroup = (row[19] || '').toString().trim();
          return planName ? { planName, baseFee, planGroup } : null;
        })
        .filter(Boolean);
      res.json({ success: true, data: plans });
    } catch (error) {
      console.error('[OB] plan-data error:', error);
      res.status(500).json({ success: false, error: 'Failed to load plan data', message: error.message });
    }
  });

  // GET /api/ob/dev-sheet-data (개발용 - 나중에 제거)
  router.get('/dev-sheet-data', async (req, res) => {
    try {
      const { sheets } = createSheetsClient();
      const devSpreadsheetId = '13CoBlIKqFDr0cjf3tC2GiZv3fhoxfCVzCHlR-WVjj1Y';
      
      // 모든 시트 읽기
      const [mainSheet, segDiscount, planList] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: devSpreadsheetId,
          range: '투게더결합 컨설팅!A1:Z50'
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: devSpreadsheetId,
          range: 'seg)할인!A1:N40'
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: devSpreadsheetId,
          range: '별첨)요금제 리스트!A1:Z100'
        })
      ]);
      
      res.json({
        success: true,
        data: {
          mainSheet: mainSheet.data.values || [],
          segDiscount: segDiscount.data.values || [],
          planList: planList.data.values || []
        }
      });
    } catch (error) {
      console.error('[OB] dev-sheet-data error:', error);
      res.status(500).json({ success: false, error: 'Failed to load dev sheet data', message: error.message });
    }
  });

  // GET /api/ob/discount-data
  router.get('/discount-data', async (req, res) => {
    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_DISCOUNTS, HEADERS_DISCOUNTS);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_DISCOUNTS
      });
      const rows = response.data.values || [];
      const header = rows[0] || HEADERS_DISCOUNTS;
      const items = rows.slice(1).map(r => ({
        discountCode: r[header.indexOf('discountCode')] || '',
        name: r[header.indexOf('name')] || '',
        scope: r[header.indexOf('scope')] || '',
        type: r[header.indexOf('type')] || '',
        value: Number((r[header.indexOf('value')] || '0').toString().replace(/,/g, '')) || 0,
        conditionsJson: r[header.indexOf('conditionsJson')] || ''
      }));
      res.json({ success: true, data: items });
    } catch (error) {
      console.error('[OB] discount-data error:', error);
      res.status(500).json({ success: false, error: 'Failed to load discount data', message: error.message });
    }
  });

  // GET /api/ob/results?userId=...
  router.get('/results', async (req, res) => {
      const userId = (req.query.userId || '').toString().trim();
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }
      try {
        const { sheets, SPREADSHEET_ID } = createSheetsClient();
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_RESULTS, HEADERS_RESULTS);
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_RESULTS
        });
        const rows = response.data.values || [];
        const header = rows[0] || HEADERS_RESULTS;
        const items = rows.slice(1)
          .map((r, idx) => {
            const obj = Object.fromEntries(header.map((h, i) => [h, r[i] || '']));
            return { rowIndex: idx + 2, ...obj };
          })
          .filter(item => item.userId === userId);
        res.json({ success: true, data: items });
      } catch (error) {
        console.error('[OB] results GET error:', error);
        res.status(500).json({ success: false, error: 'Failed to load results', message: error.message });
      }
  });

  // POST /api/ob/results
  router.post('/results', async (req, res) => {
    try {
      const { userId, scenarioName, inputs, existingAmount, togetherAmount, diff, chosenType, notes } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_RESULTS, HEADERS_RESULTS);

      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const inputsJson = JSON.stringify(inputs || {});
      const row = [
        id,
        userId,
        createdAt,
        scenarioName || '',
        inputsJson,
        Number(existingAmount || 0),
        Number(togetherAmount || 0),
        Number(diff || 0),
        chosenType || '',
        notes || ''
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_RESULTS,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [row] }
      });

      res.json({ success: true, id });
    } catch (error) {
      console.error('[OB] results POST error:', error);
      res.status(500).json({ success: false, error: 'Failed to save result', message: error.message });
    }
  });

  // PUT /api/ob/results/:id
  router.put('/results/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const payload = req.body || {};
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_RESULTS, HEADERS_RESULTS);

      // Load all rows to find the row index by id
      const getRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SHEET_RESULTS });
      const rows = getRes.data.values || [];
      const header = rows[0] || HEADERS_RESULTS;
      const idCol = header.indexOf('id');
      if (idCol === -1) {
        return res.status(500).json({ success: false, error: 'Header missing id column' });
      }
      let targetRowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if ((rows[i][idCol] || '') === id) {
          targetRowIndex = i + 1; // 1-based in Sheets
          break;
        }
      }
      if (targetRowIndex === -1) {
        return res.status(404).json({ success: false, error: 'Result not found' });
      }

      // Build updated row using header order
      const current = Object.fromEntries(header.map((h, idx) => [h, (rows[targetRowIndex - 1] && rows[targetRowIndex - 1][idx]) || '']));
      const next = { ...current, ...payload };
      // Normalize numeric fields
      next.existingAmount = Number(next.existingAmount || 0);
      next.togetherAmount = Number(next.togetherAmount || 0);
      next.diff = Number(next.diff || 0);
      // Serialize inputs if object provided
      if (typeof next.inputs === 'object' && next.inputs !== null) {
        next.inputsJson = JSON.stringify(next.inputs);
      }

      const updatedRow = header.map(h => next[h] != null ? next[h] : '');
      const range = `${SHEET_RESULTS}!A${targetRowIndex}:${String.fromCharCode(65 + header.length - 1)}${targetRowIndex}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [updatedRow] }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] results PUT error:', error);
      res.status(500).json({ success: false, error: 'Failed to update result', message: error.message });
    }
  });

  app.use('/api/ob', router);
}

module.exports = setupObRoutes;


