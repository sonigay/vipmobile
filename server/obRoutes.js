const express = require('express');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

// Sheet names
const SHEET_RESULTS = 'OB_결과';
const SHEET_DISCOUNTS = 'OB_할인';
const SHEET_SEGMENTS = 'OB_세그';
const SHEET_PLANS = '무선요금제군';
const SHEET_SETTLEMENT_LINKS = 'OB정산관리링크관리';

// Standard headers
const HEADERS_RESULTS = ['id', 'userId', 'userName', 'createdAt', 'subscriptionNumber', 'scenarioName', 'inputsJson', 'existingAmount', 'togetherAmount', 'diff', 'chosenType', 'status', 'notes'];
const HEADERS_DISCOUNTS = ['discountCode', 'name', 'scope', 'type', 'value', 'conditionsJson'];
const HEADERS_SEGMENTS = ['segmentCode', 'name', 'rulesJson'];
const HEADERS_SETTLEMENT_LINKS = [
  '연월',
  '시트ID',
  '시트URL',
  '시트이름(맞춤제안)',
  '시트이름(재약정)',
  '시트이름(후정산)',
  '기타시트(맞춤제안)',
  '기타시트(재약정)',
  '기타시트(후정산)',
  '비고',
  '등록자',
  '등록일시'
];

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

function extractSheetId(value = '') {
  if (!value) return '';
  const trimmed = value.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) return trimmed;
  return '';
}

function resolveSheetUrl(sheetId, sheetUrl) {
  if (sheetUrl) return sheetUrl;
  if (!sheetId) return '';
  return `https://docs.google.com/spreadsheets/d/${sheetId}`;
}

function mapSettlementRow(row = []) {
  const [
    month = '',
    sheetId = '',
    sheetUrl = '',
    sheetNameCustom = '',
    sheetNameRecontract = '',
    sheetNamePost = '',
    extraCustom = '',
    extraRecontract = '',
    extraPost = '',
    notes = '',
    registrant = '',
    registeredAt = ''
  ] = row;

  return {
    month,
    sheetId,
    sheetUrl: resolveSheetUrl(sheetId, sheetUrl),
    sheetNames: {
      customProposal: sheetNameCustom,
      recontract: sheetNameRecontract,
      postSettlement: sheetNamePost
    },
    extraSheetNames: {
      customProposal: extraCustom,
      recontract: extraRecontract,
      postSettlement: extraPost
    },
    notes,
    registrant,
    updatedAt: registeredAt,
    createdAt: registeredAt // 동일 값 사용 (추후 필요 시 분리 가능)
  };
}

function buildSettlementRow({
  month,
  sheetId,
  sheetUrl,
  sheetNames = {},
  extraSheetNames = {},
  notes = '',
  registrant = '',
  updatedAt
}) {
  const normalizedSheetUrl = resolveSheetUrl(sheetId, sheetUrl);
  return [
    month || '',
    sheetId || '',
    normalizedSheetUrl || '',
    sheetNames.customProposal || '',
    sheetNames.recontract || '',
    sheetNames.postSettlement || '',
    extraSheetNames.customProposal || '',
    extraSheetNames.recontract || '',
    extraSheetNames.postSettlement || '',
    notes || '',
    registrant || '',
    updatedAt || new Date().toISOString()
  ];
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

  // GET /api/ob/discount-data (seg)할인 원본 데이터 - 배열 그대로 반환)
  router.get('/discount-data', async (req, res) => {
    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      // OB_할인 시트 전체 읽기 (seg)할인 데이터)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'OB_할인!A1:N40'
      });
      res.json({ success: true, data: response.data.values || [] });
    } catch (error) {
      console.error('[OB] discount-data error:', error);
      res.status(500).json({ success: false, error: 'Failed to load discount data', message: error.message });
    }
  });

  // GET /api/ob/results?userId=...&showAll=true
  router.get('/results', async (req, res) => {
      const userId = (req.query.userId || '').toString().trim();
      const showAll = req.query.showAll === 'true';
      
      if (!userId && !showAll) {
        return res.status(400).json({ success: false, error: 'userId is required or set showAll=true' });
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
        
        // 헤더에 subscriptionNumber가 있는지 확인
        const hasSubscriptionNumber = header.includes('subscriptionNumber');
        
        let items = rows.slice(1)
          .map((r, idx) => {
            const obj = Object.fromEntries(header.map((h, i) => [h, r[i] || '']));
            
            // subscriptionNumber 컬럼이 없는 기존 데이터 처리
            if (!hasSubscriptionNumber && !obj.subscriptionNumber) {
              obj.subscriptionNumber = '';
            }
            
            // status 컬럼이 없는 기존 데이터 처리
            if (!obj.status) {
              obj.status = '';
            }
            
            return { rowIndex: idx + 2, ...obj };
          });
        
        // showAll이 아니면 userId 필터
        if (!showAll) {
          items = items.filter(item => item.userId === userId);
        }
        
        res.json({ success: true, data: items });
      } catch (error) {
        console.error('[OB] results GET error:', error);
        res.status(500).json({ success: false, error: 'Failed to load results', message: error.message });
      }
  });

  // Settlement link management
  router.get('/settlement-links', async (req, res) => {
    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTLEMENT_LINKS, HEADERS_SETTLEMENT_LINKS);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTLEMENT_LINKS
      });
      const rows = response.data.values || [];
      const dataRows = rows.slice(1);
      const items = dataRows
        .filter((row) => (row && row[0] && row[0].trim()))
        .map((row) => mapSettlementRow(row));
      res.json({ success: true, data: items });
    } catch (error) {
      console.error('[OB] settlement-links GET error:', error);
      res.status(500).json({ success: false, error: 'Failed to load settlement links', message: error.message });
    }
  });

  router.post('/settlement-links', async (req, res) => {
    try {
      const {
        month,
        originalMonth,
        sheetUrlOrId,
        sheetUrl,
        sheetId: incomingSheetId,
        sheetNames = {},
        extraSheetNames = {},
        notes = '',
        registrant = ''
      } = req.body || {};

      if (!month) {
        return res.status(400).json({ success: false, error: 'month is required' });
      }

      const normalizedMonth = month.trim();
      const targetMonth = originalMonth && originalMonth.trim() ? originalMonth.trim() : normalizedMonth;

      const resolvedSheetId = extractSheetId(sheetUrlOrId || incomingSheetId || sheetUrl || '');
      const resolvedSheetUrl = resolveSheetUrl(resolvedSheetId, sheetUrlOrId && sheetUrlOrId.startsWith('http') ? sheetUrlOrId : sheetUrl);

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTLEMENT_LINKS, HEADERS_SETTLEMENT_LINKS);

      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTLEMENT_LINKS
      });
      const rows = getRes.data.values || [];
      const header = rows[0] || HEADERS_SETTLEMENT_LINKS;
      const dataRows = rows.slice(1);

      let targetRowIndex = -1;
      for (let i = 0; i < dataRows.length; i++) {
        if ((dataRows[i][0] || '').trim() === targetMonth) {
          targetRowIndex = i + 2; // sheet index (header row is 1)
          break;
        }
      }

      const rowPayload = buildSettlementRow({
        month: normalizedMonth,
        sheetId: resolvedSheetId,
        sheetUrl: resolvedSheetUrl,
        sheetNames,
        extraSheetNames,
        notes,
        registrant,
        updatedAt: new Date().toISOString()
      });

      if (targetRowIndex === -1) {
        // Append new row
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_SETTLEMENT_LINKS,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [rowPayload] }
        });
      } else {
        // Update existing row
        const range = `${SHEET_SETTLEMENT_LINKS}!A${targetRowIndex}:${String.fromCharCode(65 + header.length - 1)}${targetRowIndex}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [rowPayload] }
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] settlement-links POST error:', error);
      res.status(500).json({ success: false, error: 'Failed to save settlement link', message: error.message });
    }
  });

  router.delete('/settlement-links/:month', async (req, res) => {
    try {
      const monthParam = (req.params.month || '').trim();
      if (!monthParam) {
        return res.status(400).json({ success: false, error: 'month is required' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTLEMENT_LINKS, HEADERS_SETTLEMENT_LINKS);

      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTLEMENT_LINKS
      });
      const rows = getRes.data.values || [];
      const dataRows = rows.slice(1);

      let targetRowIndex = -1;
      for (let i = 0; i < dataRows.length; i++) {
        if ((dataRows[i][0] || '').trim() === monthParam) {
          targetRowIndex = i + 1; // zero-based index for batchUpdate (excluding header)
          break;
        }
      }

      if (targetRowIndex === -1) {
        return res.status(404).json({ success: false, error: 'Settlement link not found' });
      }

      const emptyRow = new Array(HEADERS_SETTLEMENT_LINKS.length).fill('');
      const range = `${SHEET_SETTLEMENT_LINKS}!A${targetRowIndex + 1}:${String.fromCharCode(65 + HEADERS_SETTLEMENT_LINKS.length - 1)}${targetRowIndex + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [emptyRow] }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] settlement-links DELETE error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete settlement link', message: error.message });
    }
  });

  // POST /api/ob/results
  router.post('/results', async (req, res) => {
    try {
      const { userId, userName, scenarioName, inputs, existingAmount, togetherAmount, diff, chosenType, notes } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_RESULTS, HEADERS_RESULTS);

      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const inputsJson = JSON.stringify(inputs || {});
      const subscriptionNumber = (inputs && inputs.subscriptionNumber) || '';
      const row = [
        id,
        userId,
        userName || '',
        createdAt,
        subscriptionNumber,
        scenarioName || '',
        inputsJson,
        Number(existingAmount || 0),
        Number(togetherAmount || 0),
        Number(diff || 0),
        chosenType || '',
        '', // status (성공/실패/보류)
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


