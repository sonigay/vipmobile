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

const SHEET_EXCLUSIONS = '제외인원';
const DEFAULT_EXCLUSION_SHEET_NAME = SHEET_EXCLUSIONS;
const HEADERS_EXCLUSIONS = [
  '연월',
  '구분(맞춤제안/재약정)',
  '유치자ID',
  '유치자명',
  '사유',
  'ID',
  '비고',
  '등록자',
  '등록일시'
];
const EXCLUSION_TYPE_LABELS = {
  custom: '맞춤제안',
  recontract: '재약정'
};

const SHEET_TARGET_OUTLETS = '대상점';
const DEFAULT_TARGET_OUTLET_SHEET_NAME = SHEET_TARGET_OUTLETS;
const HEADERS_TARGET_OUTLETS = [
  '연월',
  '구분(재약정/후정산)',
  '대상점명',
  '사유',
  'ID',
  '비고',
  '등록자',
  '등록일시'
];
const TARGET_OUTLET_TYPE_LABELS = {
  recontract: '재약정',
  postSettlement: '후정산'
};

const PLACEHOLDER_SHEET_TOKENS = [
  '시트이름(맞춤제안)',
  '시트이름(재약정)',
  '시트이름(후정산)',
  '기타맞춤제안 시트',
  '기타재약정 시트',
  '기타후정산 시트',
  'sheet name (custom)',
  'sheet name (recontract)',
  'sheet name (post)'
];

const DEFAULT_POST_SETTLEMENT_SHEET_NAME = '기타후정산';
const DEFAULT_PROGRESS_SHEET_NAME = '정산진행상황';
const HEADERS_POST_SETTLEMENT = [
  '연월',
  '구분(인건비/비용)',
  '항목명',
  '직원명',
  '고정급여',
  '인센티브/추가비용',
  '총합(자동계산용)',
  'ID',
  '비고',
  '작성자',
  '작성일시'
];
const HEADERS_PROGRESS = ['연월', '카테고리', '필드', '값', '등록자', '등록일시'];

const OB_RECONTRACT_OFFER_PATTERNS = {
  giftCard: /상품권/i,
  deposit: /입금/i
};

const LABOR_SUPPORT_TABLE = [
  { sales: 500, payout: 700 },
  { sales: 400, payout: 600 },
  { sales: 300, payout: 500 },
  { sales: 250, payout: 400 },
  { sales: 200, payout: 325 },
  { sales: 150, payout: 250 },
  { sales: 100, payout: 175 }
];

const PER_CASE_PAYOUT_TABLE = [
  { count: 500, unitAmount: 23100 },
  { count: 400, unitAmount: 19800 },
  { count: 300, unitAmount: 16500 },
  { count: 200, unitAmount: 13200 },
  { count: 100, unitAmount: 9900 }
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

async function fetchSettlementConfig(sheets, baseSpreadsheetId, month) {
  await ensureSheetHeaders(sheets, baseSpreadsheetId, SHEET_SETTLEMENT_LINKS, HEADERS_SETTLEMENT_LINKS);
  const configResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: baseSpreadsheetId,
    range: SHEET_SETTLEMENT_LINKS
  });
  const configRows = configResponse.data.values || [];
  return configRows
    .slice(1)
    .map((row) => mapSettlementRow(row))
    .find((config) => config.month === month);
}

async function ensureManualSheetStructure(sheets, spreadsheetId, sheetName) {
  const spreadsheetMeta = await sheets.spreadsheets.get({
    spreadsheetId
  });
  const sheetExists = (spreadsheetMeta.data.sheets || []).some(
    (sheet) => sheet.properties && sheet.properties.title === sheetName
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });
  }

  // 헤더는 항상 1행: 빈 행, 2행: 실제 헤더
  const headerRange = `${sheetName}!A1:${String.fromCharCode(65 + HEADERS_POST_SETTLEMENT.length - 1)}2`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const headerValues = headerResponse.data.values || [];
  const firstRow = headerValues[0] || [];
  const secondRow = headerValues[1] || [];

  const isFirstRowBlank = firstRow.length === 0 || firstRow.every((cell) => !cell || String(cell).trim() === '');
  const isSecondRowHeader = HEADERS_POST_SETTLEMENT.every(
    (header, index) => (secondRow[index] || '') === header
  );

  if (!isFirstRowBlank || !isSecondRowHeader) {
    const values = [
      new Array(HEADERS_POST_SETTLEMENT.length).fill(''),
      HEADERS_POST_SETTLEMENT
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      resource: {
        values
      }
    });
  }
}

async function ensureProgressSheetStructure(sheets, spreadsheetId, sheetName) {
  const spreadsheetMeta = await sheets.spreadsheets.get({
    spreadsheetId
  });
  const sheetExists = (spreadsheetMeta.data.sheets || []).some(
    (sheet) => sheet.properties && sheet.properties.title === sheetName
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });
  }

  const headerRange = `${sheetName}!A1:${String.fromCharCode(65 + HEADERS_PROGRESS.length - 1)}2`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const headerValues = headerResponse.data.values || [];
  const firstRow = headerValues[0] || [];
  const secondRow = headerValues[1] || [];
  const isFirstRowBlank =
    firstRow.length === 0 || firstRow.every((cell) => !cell || String(cell).trim() === '');
  const isSecondRowHeader = HEADERS_PROGRESS.every((header, index) => (secondRow[index] || '') === header);

  if (!isFirstRowBlank || !isSecondRowHeader) {
    const values = [
      new Array(HEADERS_PROGRESS.length).fill(''),
      HEADERS_PROGRESS
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      resource: {
        values
      }
    });
  }
}

function mapManualPostSettlementRow(row = [], index = 0) {
  const month = parseString(row[0]).replace(/^'/, '');
  const rawType = parseString(row[1]).toLowerCase();
  const type =
    rawType === 'labor' || rawType === 'cost' || rawType === '인건비' || rawType === '비용'
      ? rawType === '인건비'
        ? 'labor'
        : rawType === '비용'
          ? 'cost'
          : rawType
      : 'labor';
  const label = parseString(row[2]);
  const employeeName = parseString(row[3]);
  const fixedSalary = parseNumber(row[4]);
  const incentive = parseNumber(row[5]);
  const total = parseNumber(row[6]);
  const id = parseString(row[7]);
  const amount = Number.isFinite(total) && total !== 0 ? total : fixedSalary + incentive;
  const note = parseString(row[8]);
  const registrant = parseString(row[9]);
  const createdAt = parseString(row[10]);
  return {
    id,
    month,
    type,
    label,
    employeeName,
    fixedSalary,
    incentive,
    amount,
    note,
    registrant,
    createdAt,
    updatedAt: createdAt,
    rowNumber: index + 3
  };
}

function buildManualSummary(entries = []) {
  const laborEntries = entries.filter((entry) => entry.type === 'labor');
  const costEntries = entries.filter((entry) => entry.type === 'cost');
  const laborManualTotal = laborEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const costManualTotal = costEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const laborSheetTotal = 0;
  const costSheetTotal = 0;

  return {
    laborEntries,
    costEntries,
    laborManualTotal,
    costManualTotal,
    laborSheetTotal,
    costSheetTotal,
    laborTotal: laborSheetTotal + laborManualTotal,
    costTotal: costSheetTotal + costManualTotal
  };
}

async function ensureExclusionSheetStructure(sheets, spreadsheetId, sheetName) {
  const spreadsheetMeta = await sheets.spreadsheets.get({
    spreadsheetId
  });
  const sheetExists = (spreadsheetMeta.data.sheets || []).some(
    (sheet) => sheet.properties && sheet.properties.title === sheetName
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });
  }

  const headerRange = `${sheetName}!A1:${String.fromCharCode(65 + HEADERS_EXCLUSIONS.length - 1)}2`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const headerValues = headerResponse.data.values || [];
  const firstRow = headerValues[0] || [];
  const secondRow = headerValues[1] || [];
  const isFirstRowBlank =
    firstRow.length === 0 || firstRow.every((cell) => !cell || String(cell).trim() === '');
  const isSecondRowHeader = HEADERS_EXCLUSIONS.every(
    (header, index) => (secondRow[index] || '') === header
  );

  if (!isFirstRowBlank || !isSecondRowHeader) {
    const values = [
      new Array(HEADERS_EXCLUSIONS.length).fill(''),
      HEADERS_EXCLUSIONS
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      resource: {
        values
      }
    });
  }
}

function mapExclusionRow(row = [], index = 0) {
  const monthRaw = parseString(row[0]);
  const month = monthRaw.replace(/^'/, '');
  const rawType = parseString(row[1]);
  const normalizedType =
    rawType === EXCLUSION_TYPE_LABELS.recontract ? 'recontract' : 'custom';
  const targetId = parseString(row[2]);
  const targetName = parseString(row[3]);
  const reason = parseString(row[4]);
  const id = parseString(row[5]);
  const note = parseString(row[6]);
  const registrant = parseString(row[7]);
  const createdAt = parseString(row[8]);

  return {
    id,
    month,
    type: normalizedType,
    targetId,
    targetName,
    reason,
    note,
    registrant,
    createdAt,
    rowNumber: index + 3
  };
}

async function loadExclusionRows(sheets, spreadsheetId, sheetName = DEFAULT_EXCLUSION_SHEET_NAME) {
  await ensureExclusionSheetStructure(sheets, spreadsheetId, sheetName);
  const values = await loadSheetRows(sheets, spreadsheetId, sheetName);
  if (!values || values.length <= 2) return [];
  return values
    .slice(2)
    .map((row, index) => mapExclusionRow(row, index))
    .filter((entry) => entry.id);
}

function normalizeIdentifier(value) {
  const normalized = parseString(value)
    .replace(/\s+/g, '')
    .toLowerCase();
  return normalized;
}

function buildExclusionConfig(entries = [], month) {
  const targetMonth = parseString(month);
  const normalizedMonth = targetMonth ? targetMonth : '';
  const result = {
    custom: {
      entries: [],
      idSet: new Set(),
      nameSet: new Set()
    },
    recontract: {
      entries: [],
      idSet: new Set(),
      nameSet: new Set()
    }
  };

  entries.forEach((entry) => {
    const monthMatches =
      !normalizedMonth ||
      !entry.month ||
      entry.month === normalizedMonth ||
      entry.month === '전체';
    if (!monthMatches) return;

    if (entry.type === 'recontract') {
      result.recontract.entries.push(entry);
      if (entry.targetId) {
        result.recontract.idSet.add(normalizeIdentifier(entry.targetId));
      }
      if (entry.targetName) {
        result.recontract.nameSet.add(normalizeIdentifier(entry.targetName));
      }
    } else {
      result.custom.entries.push(entry);
      if (entry.targetId) {
        result.custom.idSet.add(normalizeIdentifier(entry.targetId));
      }
      if (entry.targetName) {
        result.custom.nameSet.add(normalizeIdentifier(entry.targetName));
      }
    }
  });

  return result;
}

async function ensureTargetOutletSheetStructure(sheets, spreadsheetId, sheetName = DEFAULT_TARGET_OUTLET_SHEET_NAME) {
  const sheetList = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = sheetList.data.sheets.find((s) => s.properties.title === sheetName);

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }
        ]
      }
    });
  }

  const headerRange = `${sheetName}!A1:${String.fromCharCode(65 + HEADERS_TARGET_OUTLETS.length - 1)}2`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const headerValues = headerResponse.data.values || [];
  const firstRow = headerValues[0] || [];
  const secondRow = headerValues[1] || [];
  const isFirstRowBlank =
    firstRow.length === 0 || firstRow.every((cell) => !cell || String(cell).trim() === '');
  const isSecondRowHeader = HEADERS_TARGET_OUTLETS.every(
    (header, index) => (secondRow[index] || '') === header
  );

  if (!isFirstRowBlank || !isSecondRowHeader) {
    const values = [
      new Array(HEADERS_TARGET_OUTLETS.length).fill(''),
      HEADERS_TARGET_OUTLETS
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      resource: {
        values
      }
    });
  }
}

function mapTargetOutletRow(row = [], index = 0) {
  const monthRaw = parseString(row[0]);
  const month = monthRaw.replace(/^'/, '');
  const rawType = parseString(row[1]);
  const normalizedType =
    rawType === TARGET_OUTLET_TYPE_LABELS.postSettlement ? 'postSettlement' : 'recontract';
  const outletName = parseString(row[2]);
  const reason = parseString(row[3]);
  const id = parseString(row[4]);
  const note = parseString(row[5]);
  const registrant = parseString(row[6]);
  const createdAt = parseString(row[7]);

  return {
    id,
    month,
    type: normalizedType,
    outletName,
    reason,
    note,
    registrant,
    createdAt,
    rowNumber: index + 3
  };
}

async function loadTargetOutletRows(sheets, spreadsheetId, sheetName = DEFAULT_TARGET_OUTLET_SHEET_NAME) {
  await ensureTargetOutletSheetStructure(sheets, spreadsheetId, sheetName);
  const values = await loadSheetRows(sheets, spreadsheetId, sheetName);
  if (!values || values.length <= 2) return [];
  return values
    .slice(2)
    .map((row, index) => mapTargetOutletRow(row, index))
    .filter((entry) => entry.id);
}

function buildTargetOutletConfig(entries = [], month, type = null) {
  const targetMonth = parseString(month);
  const normalizedMonth = targetMonth ? targetMonth : '';
  const outletNames = [];
  const filteredEntries = [];

  entries.forEach((entry) => {
    const monthMatches =
      !normalizedMonth ||
      !entry.month ||
      entry.month === normalizedMonth ||
      entry.month === '전체';
    if (!monthMatches) return;

    // 타입 필터링 (type이 지정된 경우에만)
    if (type !== null && entry.type !== type) return;

    filteredEntries.push(entry);
    if (entry.outletName) {
      outletNames.push(entry.outletName.trim());
    }
  });

  return {
    entries: filteredEntries,
    outletNames
  };
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

function parseNumber(value, defaultValue = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : defaultValue;
  }
  if (!value) return defaultValue;
  const cleaned = value.toString().replace(/[^0-9.+-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseString(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function normalizeConfiguredSheetName(value) {
  const name = parseString(value);
  if (!name) return '';
  const compact = name.replace(/\s+/g, '').toLowerCase();
  const isPlaceholder = PLACEHOLDER_SHEET_TOKENS.some(
    (token) => compact === token.replace(/\s+/g, '').toLowerCase()
  );
  if (isPlaceholder) {
    return '';
  }
  return name;
}

function extractOfferAmounts(value) {
  const text = parseString(value);
  if (!text) return { giftCard: 0, deposit: 0 };

  const normalized = text.replace(/,/g, '');
  let giftCardTotal = 0;
  let depositTotal = 0;
  const matchedPositions = new Set();

  const accumulateMatches = (patterns, type) => {
    patterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(normalized)) !== null) {
        const amount = parseNumber(match[1]);
        if (!amount) continue;
        const startIndex = match.index;
        const key = `${type}-${startIndex}-${amount}`;
        if (matchedPositions.has(key)) continue;
        matchedPositions.add(key);
        if (type === 'gift') {
          giftCardTotal += amount;
        } else if (type === 'deposit') {
          depositTotal += amount;
        }
      }
    });
  };

  const giftCardPatterns = [
    /상품권[^\d]*?(\d+)/gi, // 상품권 뒤 숫자
    /(\d+)[^\d]*?상품권/gi  // 숫자 뒤 상품권
  ];
  const depositPatterns = [
    /입금[^\d]*?(\d+)/gi,   // 입금 뒤 숫자
    /(\d+)[^\d]*?입금/gi    // 숫자 뒤 입금
  ];

  accumulateMatches(giftCardPatterns, 'gift');
  accumulateMatches(depositPatterns, 'deposit');

  return {
    giftCard: giftCardTotal,
    deposit: depositTotal
  };
}

async function loadSheetRows(sheets, spreadsheetId, sheetName) {
  if (!sheetName) return [];
  const range = `'${sheetName}'`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  return response.data.values || [];
}

function normalizeCustomRows(values, sourceSheet) {
  if (!values || values.length <= 2) return [];
  return values.slice(2).map((row, index) => ({
    sourceSheet,
    rowNumber: index + 3,
    row
  }));
}

function normalizeRecontractRows(values, sourceSheet) {
  if (!values || values.length <= 2) return [];
  return values.slice(2).map((row, index) => ({
    sourceSheet,
    rowNumber: index + 3,
    row
  }));
}

function normalizePostSettlementRows(values, sourceSheet) {
  if (!values || values.length <= 2) return [];
  return values.slice(2).map((row, index) => ({
    sourceSheet,
    rowNumber: index + 3,
    row
  }));
}

function mapPostSettlementRow(rowObject, targetOutletNames = []) {
  const { row } = rowObject;
  // 7인덱스: 항목, 10인덱스: 대상, 15인덱스: 내용, 16인덱스: 금액, 17인덱스: 상세내용
  const item = parseString(row[7]); // 항목
  const target = parseString(row[10]); // 대상
  const content = parseString(row[15]); // 내용
  const rawAmount = parseNumber(row[16]); // 금액
  const amount = rawAmount * -1; // 시트에 저장된 값에 *-1 적용
  const detail = parseString(row[17]); // 상세내용

  // 대상(10인덱스)에 후정산 대상점이 포함되어 있는지 확인
  const matchesTargetOutlet = targetOutletNames.length > 0 && targetOutletNames.some(
    (outletName) => target && target.includes(outletName.trim())
  );

  // 항목(7인덱스)이 "인건비" 또는 "비용"인지 확인
  const normalizedItem = item.toLowerCase().trim();
  const isLabor = normalizedItem === '인건비';
  const isCost = normalizedItem === '비용';

  return {
    item,
    target,
    content,
    amount: Number.isFinite(amount) ? amount : 0,
    detail,
    type: isLabor ? 'labor' : isCost ? 'cost' : null,
    matchesTargetOutlet
  };
}

function buildPostSettlementSummary(rows, targetOutletConfig = {}) {
  const targetOutletNames = targetOutletConfig.outletNames || [];
  const included = [];
  let excludedCount = 0;

  rows.forEach((rowObj) => {
    const mapped = mapPostSettlementRow(rowObj, targetOutletNames);
    // 대상점과 매칭되고, 항목이 인건비 또는 비용인 경우만 포함
    if (mapped.matchesTargetOutlet && mapped.type) {
      included.push({
        ...mapped,
        sourceSheet: rowObj.sourceSheet,
        rowNumber: rowObj.rowNumber
      });
    } else {
      excludedCount += 1;
    }
  });

  const laborEntries = included.filter((entry) => entry.type === 'labor');
  const costEntries = included.filter((entry) => entry.type === 'cost');

  const laborTotal = laborEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const costTotal = costEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return {
    laborEntries,
    costEntries,
    laborTotal,
    costTotal,
    excludedCount,
    rows: included
  };
}

function filterCustomRow(rowObject, excludedIdsSet = new Set(), excludedNamesSet = new Set()) {
  const { row } = rowObject;
  // 사용자가 이미 -1을 해서 알려준 인덱스 기준: 38인덱스(유치자마당ID), 39인덱스(유치자명)
  const proposerId = normalizeIdentifier(row[38]);
  const proposerName = normalizeIdentifier(row[39]);

  if (proposerId && excludedIdsSet.has(proposerId)) {
    return { include: false, reason: 'excludedId' };
  }

  if (proposerName && excludedNamesSet.has(proposerName)) {
    return { include: false, reason: 'excludedName' };
  }

  return { include: true };
}

function filterRecontractRow(rowObject, excludedIdsSet = new Set(), excludedNamesSet = new Set(), targetOutletNames = []) {
  const { row } = rowObject;
  // 사용자가 이미 -1을 해서 알려준 인덱스 기준: 90(유치자ID), 91(등록직원), 10(출고처)
  const promoterIdPrimary = normalizeIdentifier(row[90]);
  const promoterIdSecondary = normalizeIdentifier(row[91]);
  const promoterNamePrimary = normalizeIdentifier(row[91]);
  const promoterNameSecondary = normalizeIdentifier(row[90]);
  const outlet = parseString(row[10]); // 출고처

  // 제외인원 체크: 제외 목록에 있으면 제외
  const isExcludedById = (promoterIdPrimary && excludedIdsSet.has(promoterIdPrimary)) ||
    (promoterIdSecondary && excludedIdsSet.has(promoterIdSecondary));
  const isExcludedByName = (promoterNamePrimary && excludedNamesSet.has(promoterNamePrimary)) ||
    (promoterNameSecondary && excludedNamesSet.has(promoterNameSecondary));
  const isExcluded = isExcludedById || isExcludedByName;

  // 출고처에 대상점 문자열이 포함되어 있는지 확인
  const matchesTargetOutlet = targetOutletNames.length > 0 && targetOutletNames.some(
    (outletName) => outlet && outlet.includes(outletName.trim())
  );

  // AND 조건: 제외인원에 없고 AND 대상점에 매칭되는 경우만 포함
  // 1. 제외인원에 있으면 무조건 제외
  if (isExcluded) {
    return { include: false, reason: 'excluded' };
  }
  
  // 2. 대상점이 설정되어 있으면 매칭되어야 함
  if (targetOutletNames.length > 0 && !matchesTargetOutlet) {
    return { include: false, reason: 'target outlet not matched' };
  }

  return { include: true };
}

function calculatePolicy3Payout(totalSales) {
  const totalSalesInTenThousands = totalSales / 10000;
  const entry = LABOR_SUPPORT_TABLE.find((item) => totalSalesInTenThousands >= item.sales);
  if (!entry) {
    return {
      tier: null,
      payout: 0
    };
  }
  return {
    tier: entry,
    payout: entry.payout * 10000
  };
}

function calculatePerCasePayout(caseCount) {
  const entry = PER_CASE_PAYOUT_TABLE.find((item) => caseCount >= item.count);
  if (!entry) {
    return {
      threshold: null,
      unitAmount: 0,
      payout: 0
    };
  }
  return {
    threshold: entry,
    unitAmount: entry.unitAmount,
    payout: caseCount * entry.unitAmount
  };
}

function buildCustomProposalSummary(rows, exclusionConfig = {}) {
  const excludedIdsSet = exclusionConfig.idSet || new Set();
  const excludedNamesSet = exclusionConfig.nameSet || new Set();
  const exclusionEntries = exclusionConfig.entries || [];
  const included = [];
  const excluded = {
    count: 0,
    reasons: {
      excludedId: 0,
      excludedName: 0
    },
    entries: exclusionEntries
  };

  rows.forEach((rowObj) => {
    const decision = filterCustomRow(rowObj, excludedIdsSet, excludedNamesSet);
    if (decision.include) {
      included.push(rowObj);
    } else {
      excluded.count += 1;
      if (decision.reason && excluded.reasons[decision.reason] != null) {
        excluded.reasons[decision.reason] += 1;
      }
    }
  });

  const resultRows = included.map(({ sourceSheet, rowNumber, row }) => {
    // 사용자가 이미 -1을 해서 알려준 인덱스 기준 (K열=10인덱스=row[10])
    // 10인덱스(맞춤제안인정여부) -> row[10], 11인덱스(당월 맞춤제안 매출) -> row[11]
    // 23인덱스(테마 업셀) -> row[23], 30인덱스(영업팀) -> row[30], 31인덱스(코드) -> row[31]
    // 38인덱스(유치자마당ID) -> row[38], 39인덱스(유치자명) -> row[39]
    const proposerId = parseString(row[38]);
    const proposerName = parseString(row[39]);
    const sales = parseNumber(row[11]);
    const themeFlag = parseString(row[23]);
    const team = parseString(row[30]); // 영업팀
    const code = parseString(row[31]); // 코드
    const approvalFlagRaw = parseString(row[10]);
    const approvalFlagLower = approvalFlagRaw.toLowerCase();
    const approvalFlagNumber = parseNumber(approvalFlagRaw);
    // 숫자로 변환했을 때 1 이상이면 '1', 아니면 문자열 체크
    // "1", "1.0", "1.00" 등도 모두 인정
    let approvalFlag = '0';
    if (approvalFlagNumber >= 1) {
      approvalFlag = '1';
    } else if (approvalFlagRaw === '1' || approvalFlagRaw === '1.0' || approvalFlagRaw === '1.00') {
      approvalFlag = '1';
    } else if (
      approvalFlagLower === 'y' ||
      approvalFlagLower === 'yes' ||
      approvalFlagLower === 'true' ||
      approvalFlagLower === 't' ||
      approvalFlagLower === '승인' ||
      approvalFlagLower === '확인' ||
      approvalFlagLower === 'o'
    ) {
      approvalFlag = '1';
    }
    return {
      sourceSheet,
      rowNumber,
      proposerId,
      proposerName,
      salesAmount: sales,
      themeFlag,
      team,
      code,
      approvalFlag
    };
  });

  const totalSales = resultRows.reduce((sum, item) => sum + item.salesAmount, 0);
  const policy1Payout = totalSales * 2;
  const policy2Sales = resultRows
    .filter((item) => item.themeFlag === '1')
    .reduce((sum, item) => sum + item.salesAmount, 0);

  const policy3Result = calculatePolicy3Payout(totalSales);
  // approvalFlag가 '1'인 행만 카운트 (이미 정규화되어 있음)
  const perCaseCount = resultRows.length;
  const perCaseResult = calculatePerCasePayout(perCaseCount);

  const totalPayout =
    policy1Payout +
    policy2Sales +
    policy3Result.payout +
    perCaseResult.payout;

  return {
    includedCount: resultRows.length,
    excluded,
    policy1: {
      totalSales,
      payout: policy1Payout
    },
    policy2: {
      qualifyingSales: policy2Sales
    },
    policy3: {
      totalSales,
      payout: policy3Result.payout,
      tier: policy3Result.tier
    },
    perCase: {
      count: perCaseCount,
      unitAmount: perCaseResult.unitAmount,
      payout: perCaseResult.payout,
      threshold: perCaseResult.threshold
    },
    totalPayout,
    exclusions: exclusionEntries,
    rows: resultRows
  };
}

function buildRecontractSummary(rows, exclusionConfig = {}, targetOutletConfig = {}) {
  const excludedIdsSet = exclusionConfig.idSet || new Set();
  const excludedNamesSet = exclusionConfig.nameSet || new Set();
  const exclusionEntries = exclusionConfig.entries || [];
  const targetOutletNames = targetOutletConfig.outletNames || [];
  const included = [];
  let excludedCount = 0;

  // 디버깅: 제외인원 목록 확인
  if (exclusionEntries.length > 0) {
    console.log('[OB] 재약정 제외인원 목록:', {
      entries: exclusionEntries.map(e => ({ targetId: e.targetId, targetName: e.targetName })),
      idSet: Array.from(excludedIdsSet),
      nameSet: Array.from(excludedNamesSet)
    });
  }

  rows.forEach((rowObj) => {
    const decision = filterRecontractRow(rowObj, excludedIdsSet, excludedNamesSet, targetOutletNames);
    if (decision.include) {
      included.push(rowObj);
    } else {
      excludedCount += 1;
    }
  });

  const filteredRows = included
    .map(({ sourceSheet, rowNumber, row }) => {
      // 사용자가 이미 -1을 해서 알려준 인덱스 기준
      // 10인덱스(출고처) -> row[10], 11인덱스(상태) -> row[11], 20인덱스(정산금액) -> row[20]
      // 14인덱스(고객명) -> row[14], 26인덱스(인터넷-고유번호) -> row[26]
      // 59인덱스(동판-비고) -> row[59], 74인덱스(재약정-비고) -> row[74]
      // 90인덱스(유치자ID) -> row[90], 91인덱스(등록직원) -> row[91], 92인덱스(등록일) -> row[92]
      const registrationDate = parseString(row[92]); // 등록일
      const outlet = parseString(row[10]); // 출고처
      const customerName = parseString(row[14]); // 고객명
      const internetUniqueNumber = parseString(row[26]); // 인터넷-고유번호
      const status = parseString(row[11]);
      const isObOutlet = outlet.includes('OB');
      const isCompleted = status === '완료';
      const rawSettlementAmount = parseNumber(row[20]);
      const settlementAmount = rawSettlementAmount * -1; // sheet stores negative values → convert to positive
      
      // 19인덱스(오퍼금액) 컬럼 사용 (시트에 이미 -금액으로 입력됨)
      const offerAmount = parseNumber(row[19]);
      
      // 기존 비고 필드 추출 로직은 유지 (참고용)
      const remarkPlate = parseString(row[59]);
      const remarkRecontract = parseString(row[74]);

      // 오퍼금액을 상품권과 입금으로 구분하지 않고 전체 금액으로 처리
      const offerGiftCard = 0; // 19인덱스 사용 시 구분 없음
      const offerDeposit = offerAmount; // 전체 오퍼금액을 입금으로 처리

      const promoterId = parseString(row[90]); // 유치자ID
      const promoterName = parseString(row[91] || ''); // 등록직원/유치자명

      return {
        sourceSheet,
        rowNumber,
        registrationDate,
        outlet,
        customerName,
        internetUniqueNumber,
        status,
        isObOutlet,
        isCompleted,
        settlementAmount,
        remarkPlate,
        remarkRecontract,
        offerGiftCard,
        offerDeposit,
        promoterId,
        promoterName
      };
    })
    .filter((row) => row.isObOutlet && row.isCompleted);

  const feeTotal = filteredRows.reduce((sum, row) => sum + row.settlementAmount, 0);
  // 19인덱스 사용 시 offerDeposit에 전체 오퍼금액이 포함됨
  const giftCardTotal = 0; // 19인덱스 사용 시 구분 없음
  const depositTotal = filteredRows.reduce((sum, row) => sum + row.offerDeposit, 0);
  const offerTotal = depositTotal; // offerDeposit에 전체 오퍼금액이 포함됨

  return {
    includedCount: filteredRows.length,
    excludedCount,
    feeTotal,
    offer: {
      giftCard: giftCardTotal,
      deposit: depositTotal,
      total: offerTotal
    },
    totalPayout: feeTotal + offerTotal,
    exclusions: exclusionEntries,
    rows: filteredRows
  };
}

async function getManualSheetRows(sheets, spreadsheetId, sheetName) {
  await ensureManualSheetStructure(sheets, spreadsheetId, sheetName);
  const values = await loadSheetRows(sheets, spreadsheetId, sheetName);
  if (!values || values.length <= 2) return [];

  const dataRows = values.slice(2);
  const entries = [];
  const updates = [];

  dataRows.forEach((row, index) => {
    const entry = mapManualPostSettlementRow(row, index);
    if (!entry.id) {
      entry.id = uuidv4();
      updates.push({
        rowNumber: entry.rowNumber,
        id: entry.id
      });
    }
    entries.push(entry);
  });

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map((item) => ({
          range: `${sheetName}!H${item.rowNumber}`,
          values: [[item.id]]
        }))
      }
    });
  }

  return entries;
}

function parseBooleanValue(value, defaultValue = false) {
  const normalized = parseString(value).toLowerCase();
  if (!normalized) return defaultValue;
  if (['true', '1', 'y', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'n', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function stringifyProgressValue(value) {
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return value != null ? String(value) : '';
}

async function loadProgressRows(sheets, spreadsheetId, sheetName) {
  await ensureProgressSheetStructure(sheets, spreadsheetId, sheetName);
  const values = await loadSheetRows(sheets, spreadsheetId, sheetName);
  if (!values || values.length <= 2) return [];
  return values
    .slice(2)
    .map((row, index) => {
      const month = parseString(row[0]).replace(/^'/, '');
      const category = parseString(row[1]);
      const field = parseString(row[2]);
      const value = parseString(row[3]);
      const registrant = parseString(row[4]);
      const updatedAt = parseString(row[5]);
      return {
        month,
        category,
        field,
        value,
        registrant,
        updatedAt,
        rowNumber: index + 3,
        key: `${month}__${category}__${field}`
      };
    })
    .filter((entry) => entry.month && entry.category && entry.field);
}

function createDefaultCompanyProgress() {
  return {
    completed: false,
    bankName: '',
    accountNumber: '',
    isSaved: false,
    depositDone: false,
    confirmDone: false
  };
}

function buildProgressState(entries = [], month) {
  const invoice = {
    issued: false,
    approved: false
  };
  const companies = {
    vip: createDefaultCompanyProgress(),
    yai: createDefaultCompanyProgress()
  };

  entries
    .filter((entry) => !month || entry.month === month || entry.month === '전체')
    .forEach((entry) => {
      const { category, field, value } = entry;
      if (category === 'invoice') {
        if (field === 'issued') invoice.issued = parseBooleanValue(value, false);
        if (field === 'approved') invoice.approved = parseBooleanValue(value, false);
      }
      if (category === 'vip' || category === 'yai') {
        const target = category === 'vip' ? companies.vip : companies.yai;
        if (['completed', 'isSaved', 'depositDone', 'confirmDone'].includes(field)) {
          target[field] = parseBooleanValue(value, false);
        } else if (field === 'bankName' || field === 'accountNumber') {
          target[field] = value || '';
        }
      }
    });

  return { invoice, companies };
}

function buildProgressEntries(month, progressState = {}, registrant = '') {
  const entries = [];
  const monthCellValue = month ? `'${month}` : '';
  const nowIso = new Date().toISOString();

  const addEntry = (category, field, value) => {
    entries.push({
      month,
      category,
      field,
      row: [
        monthCellValue,
        category,
        field,
        stringifyProgressValue(value),
        registrant || '',
        nowIso
      ]
    });
  };

  const invoice = progressState.invoice || {};
  addEntry('invoice', 'issued', !!invoice.issued);
  addEntry('invoice', 'approved', !!invoice.approved);

  const companies = progressState.companies || {};
  const vip = { ...createDefaultCompanyProgress(), ...(companies.vip || {}) };
  const yai = { ...createDefaultCompanyProgress(), ...(companies.yai || {}) };

  Object.entries(vip).forEach(([field, value]) => addEntry('vip', field, value));
  Object.entries(yai).forEach(([field, value]) => addEntry('yai', field, value));

  return entries;
}

function buildTotals(customSummary, recontractSummary, manualSummary) {
  const customTotal = customSummary.totalPayout || 0;
  const recontractTotal = recontractSummary.totalPayout || 0;
  const laborTotal = manualSummary?.laborTotal || 0;
  const costTotal = manualSummary?.costTotal || 0;
  const grandTotal = customTotal + recontractTotal + laborTotal + costTotal;

  return {
    customTotal,
    recontractTotal,
    laborTotal,
    costTotal,
    grandTotal,
    split: {
      vip: Math.round(grandTotal * 0.3),
      yai: Math.round(grandTotal * 0.7)
    }
  };
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

  router.get('/settlement-summary', async (req, res) => {
    const month = (req.query.month || '').trim();
    if (!month) {
      return res.status(400).json({ success: false, error: 'month query parameter is required' });
    }

    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, month);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const sheetNames = configEntry.sheetNames || {};
      const extraSheetNames = configEntry.extraSheetNames || {};

      const resolvedSheetNames = {
        customProposal: normalizeConfiguredSheetName(sheetNames.customProposal),
        recontract: normalizeConfiguredSheetName(sheetNames.recontract),
        postSettlement: normalizeConfiguredSheetName(sheetNames.postSettlement)
      };
      const resolvedExtraSheetNames = {
        customProposal: normalizeConfiguredSheetName(extraSheetNames.customProposal),
        recontract: normalizeConfiguredSheetName(extraSheetNames.recontract),
        postSettlement: normalizeConfiguredSheetName(extraSheetNames.postSettlement)
      };

      const missingNames = [];
      if (!resolvedSheetNames.customProposal) missingNames.push('맞춤제안');
      if (!resolvedSheetNames.recontract) missingNames.push('재약정');

      if (missingNames.length > 0) {
        return res.status(400).json({
          success: false,
          error: `정산 관리 탭에서 ${missingNames.join(', ')} 시트 이름을 먼저 입력해주세요.`
        });
      }

      const customMainValues = await loadSheetRows(
        sheets,
        targetSheetId,
        resolvedSheetNames.customProposal
      );
      const customExtraValues = resolvedExtraSheetNames.customProposal
        ? await loadSheetRows(sheets, targetSheetId, resolvedExtraSheetNames.customProposal)
        : [];

      const recontractMainValues = await loadSheetRows(
        sheets,
        targetSheetId,
        resolvedSheetNames.recontract
      );
      const recontractExtraValues = resolvedExtraSheetNames.recontract
        ? await loadSheetRows(sheets, targetSheetId, resolvedExtraSheetNames.recontract)
        : [];

      const customRows = [
        ...normalizeCustomRows(
          customMainValues,
          resolvedSheetNames.customProposal || '맞춤제안'
        ),
        ...normalizeCustomRows(
          customExtraValues,
          resolvedExtraSheetNames.customProposal || '기타맞춤제안'
        )
      ];

      const recontractRows = [
        ...normalizeRecontractRows(
          recontractMainValues,
          resolvedSheetNames.recontract || '재약정'
        ),
        ...normalizeRecontractRows(
          recontractExtraValues,
          resolvedExtraSheetNames.recontract || '기타재약정'
        )
      ];

      // 후정산 시트 데이터 읽기
      const postSettlementMainValues = resolvedSheetNames.postSettlement
        ? await loadSheetRows(sheets, targetSheetId, resolvedSheetNames.postSettlement)
        : [];
      const postSettlementExtraValues = resolvedExtraSheetNames.postSettlement
        ? await loadSheetRows(sheets, targetSheetId, resolvedExtraSheetNames.postSettlement)
        : [];

      const postSettlementRows = [
        ...normalizePostSettlementRows(
          postSettlementMainValues,
          resolvedSheetNames.postSettlement || '후정산'
        ),
        ...normalizePostSettlementRows(
          postSettlementExtraValues,
          resolvedExtraSheetNames.postSettlement || '기타후정산'
        )
      ];

      // 제외인원 및 대상점 설정 로드 (postSettlementSummary 및 recontractSummary를 위해 필요)
      const exclusionSheetName =
        normalizeConfiguredSheetName(extraSheetNames.exclusion) || DEFAULT_EXCLUSION_SHEET_NAME;

      const exclusionRows = await loadExclusionRows(sheets, targetSheetId, exclusionSheetName);
      const exclusionConfig = buildExclusionConfig(exclusionRows, month);

      const targetOutletSheetName =
        normalizeConfiguredSheetName(extraSheetNames.targetOutlet) || DEFAULT_TARGET_OUTLET_SHEET_NAME;
      const targetOutletRows = await loadTargetOutletRows(sheets, targetSheetId, targetOutletSheetName);
      const recontractTargetOutletConfig = buildTargetOutletConfig(targetOutletRows, month, 'recontract');
      const postSettlementTargetOutletConfig = buildTargetOutletConfig(targetOutletRows, month, 'postSettlement');

      // 후정산 시트 데이터 요약 (대상점 설정 필요)
      const postSettlementSummary = buildPostSettlementSummary(postSettlementRows, postSettlementTargetOutletConfig);

      // 항상 "기타후정산" 시트를 사용 (extraSheetNames.postSettlement가 있으면 사용, 없으면 기본값)
      const manualSheetName =
        resolvedExtraSheetNames.postSettlement ||
        DEFAULT_POST_SETTLEMENT_SHEET_NAME;
      const manualRows = await getManualSheetRows(sheets, targetSheetId, manualSheetName);
      const manualRowsForMonth = manualRows.filter((entry) => entry.month === month);
      const manualSummary = buildManualSummary(manualRowsForMonth);

      // 시트 데이터와 수기 입력 데이터 합산
      const combinedLaborTotal = (postSettlementSummary.laborTotal || 0) + (manualSummary.laborTotal || 0);
      const combinedCostTotal = (postSettlementSummary.costTotal || 0) + (manualSummary.costTotal || 0);

      const progressSheetName =
        normalizeConfiguredSheetName(extraSheetNames.progress) || DEFAULT_PROGRESS_SHEET_NAME;
      const progressRows = await loadProgressRows(sheets, targetSheetId, progressSheetName);
      const progressState = buildProgressState(progressRows, month);

      const customSummary = buildCustomProposalSummary(customRows, exclusionConfig.custom);
      const recontractSummary = buildRecontractSummary(recontractRows, exclusionConfig.recontract, recontractTargetOutletConfig);
      const totals = buildTotals(customSummary, recontractSummary, {
        ...manualSummary,
        laborTotal: combinedLaborTotal,
        costTotal: combinedCostTotal
      });

      res.json({
        success: true,
        data: {
          month,
          config: {
            ...configEntry,
            sheetNames: resolvedSheetNames,
            extraSheetNames: resolvedExtraSheetNames,
            manualSheetName,
            progressSheetName
          },
          customProposal: customSummary,
          recontract: recontractSummary,
          postSettlement: postSettlementSummary,
          manual: {
            ...manualSummary,
            sheetName: manualSheetName
          },
          exclusions: exclusionConfig,
          targetOutlets: {
            recontract: recontractTargetOutletConfig,
            postSettlement: postSettlementTargetOutletConfig
          },
          progress: progressState,
          totals: {
            ...totals,
            combinedLaborTotal,
            combinedCostTotal
          }
        }
      });
    } catch (error) {
      console.error('[OB] settlement-summary GET error:', error);
      res.status(500).json({ success: false, error: '정산 데이터를 불러오지 못했습니다.', message: error.message });
    }
  });

  router.get('/manual-adjustments', async (req, res) => {
    const month = (req.query.month || '').trim();
    if (!month) {
      return res.status(400).json({ success: false, error: 'month query parameter is required' });
    }

    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, month);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      // 항상 "기타후정산" 시트를 사용 (extraSheetNames.postSettlement가 있으면 사용, 없으면 기본값)
      const manualSheetName =
        normalizeConfiguredSheetName(extraSheetNames.postSettlement) ||
        DEFAULT_POST_SETTLEMENT_SHEET_NAME;

      const manualRows = await getManualSheetRows(sheets, targetSheetId, manualSheetName);
      const manualRowsForMonth = manualRows.filter((entry) => entry.month === month);
      const manualSummary = buildManualSummary(manualRowsForMonth);

      res.json({
        success: true,
        data: {
          labor: manualSummary.laborEntries,
          cost: manualSummary.costEntries,
          laborTotal: manualSummary.laborTotal,
          costTotal: manualSummary.costTotal
        }
      });
    } catch (error) {
      console.error('[OB] manual-adjustments GET error:', error);
      res.status(500).json({ success: false, error: '수기 데이터를 불러오지 못했습니다.', message: error.message });
    }
  });

  router.post('/manual-adjustments', async (req, res) => {
    try {
      const {
        month,
        type,
        label,
        amount,
        note = ''
      } = req.body || {};

      if (!month || !type || !label) {
        return res.status(400).json({ success: false, error: 'month, type, label은 필수값입니다.' });
      }

      const normalizedType = type.toLowerCase();
      if (!['labor', 'cost'].includes(normalizedType)) {
        return res.status(400).json({ success: false, error: 'type은 labor 또는 cost 이어야 합니다.' });
      }

      const parsedAmount = parseNumber(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
        return res.status(400).json({ success: false, error: 'amount는 0이 아닌 숫자여야 합니다.' });
      }

      const adjustedAmount = parsedAmount > 0 ? parsedAmount * -1 : parsedAmount;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, month);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      // 항상 "기타후정산" 시트를 사용 (extraSheetNames.postSettlement가 있으면 사용, 없으면 기본값)
      const manualSheetName =
        normalizeConfiguredSheetName(extraSheetNames.postSettlement) ||
        DEFAULT_POST_SETTLEMENT_SHEET_NAME;

      await ensureManualSheetStructure(sheets, targetSheetId, manualSheetName);

      const id = uuidv4();
      const nowIso = new Date().toISOString();
      const typeLabel = normalizedType === 'labor' ? '인건비' : '비용';
      const employeeName = ''; // 프론트엔드에서 전달받지 않으면 빈 문자열
      const fixedSalary = normalizedType === 'labor' ? adjustedAmount : 0;
      const incentive = normalizedType === 'labor' ? 0 : adjustedAmount;
      const total = adjustedAmount;
      // month를 문자열로 명시적으로 변환 (숫자로 변환되지 않도록)
      const rawMonthString = String(month || '').trim();
      const monthCellValue = rawMonthString ? `'${rawMonthString}` : '';
      const row = [
        monthCellValue,
        typeLabel,
        label,
        employeeName,
        fixedSalary.toString(),
        incentive.toString(),
        total.toString(),
        id, // ID 저장
        note || '',
        '', // 작성자 (추후 추가 가능)
        nowIso
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: `${manualSheetName}!A3`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [row]
        }
      });

      res.json({
        success: true,
        data: {
          id,
          month,
          type: normalizedType,
          label,
          amount: adjustedAmount,
          note: note || '',
          createdAt: nowIso,
          updatedAt: nowIso
        }
      });
    } catch (error) {
      console.error('[OB] manual-adjustments POST error:', error);
      res.status(500).json({ success: false, error: '수기 데이터를 저장하지 못했습니다.', message: error.message });
    }
  });

  router.get('/settlement-progress', async (req, res) => {
    const monthParam = parseString(req.query.month || '');
    if (!monthParam) {
      return res.status(400).json({ success: false, error: 'month query parameter is required' });
    }

    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, monthParam);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const progressSheetName =
        normalizeConfiguredSheetName(extraSheetNames.progress) || DEFAULT_PROGRESS_SHEET_NAME;

      const progressRows = await loadProgressRows(sheets, targetSheetId, progressSheetName);
      const progressState = buildProgressState(progressRows, monthParam);

      res.json({ success: true, data: progressState });
    } catch (error) {
      console.error('[OB] settlement-progress GET error:', error);
      res
        .status(500)
        .json({ success: false, error: '정산 진행상황을 불러오지 못했습니다.', message: error.message });
    }
  });

  router.post('/settlement-progress', async (req, res) => {
    try {
      const { month, progress = {}, registrant = '' } = req.body || {};
      const trimmedMonth = parseString(month);
      if (!trimmedMonth) {
        return res.status(400).json({ success: false, error: 'month는 필수값입니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, trimmedMonth);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const progressSheetName =
        normalizeConfiguredSheetName(extraSheetNames.progress) || DEFAULT_PROGRESS_SHEET_NAME;

      const existingRows = await loadProgressRows(sheets, targetSheetId, progressSheetName);
      const existingMap = new Map(existingRows.map((entry) => [entry.key, entry]));
      const entries = buildProgressEntries(trimmedMonth, progress, registrant);

      const updateRequests = [];
      const appendValues = [];
      const rangeEndColumn = String.fromCharCode(65 + HEADERS_PROGRESS.length - 1);

      entries.forEach((entry) => {
        const key = `${entry.month}__${entry.category}__${entry.field}`;
        const existing = existingMap.get(key);
        if (existing) {
          updateRequests.push({
            range: `${progressSheetName}!A${existing.rowNumber}:${rangeEndColumn}${existing.rowNumber}`,
            values: [entry.row]
          });
        } else {
          appendValues.push(entry.row);
        }
      });

      if (updateRequests.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: targetSheetId,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: updateRequests
          }
        });
      }

      if (appendValues.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: targetSheetId,
          range: `${progressSheetName}!A3`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: appendValues
          }
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] settlement-progress POST error:', error);
      res
        .status(500)
        .json({ success: false, error: '정산 진행상황을 저장하지 못했습니다.', message: error.message });
    }
  });

  router.put('/manual-adjustments/:id', async (req, res) => {
    const idParam = (req.params.id || '').trim();
    if (!idParam) {
      return res.status(400).json({ success: false, error: 'id parameter is required' });
    }

    try {
      const {
        month,
        type,
        label,
        amount,
        note = ''
      } = req.body || {};

      if (!month) {
        return res.status(400).json({ success: false, error: 'month는 필수값입니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, month);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      // 항상 "기타후정산" 시트를 사용 (extraSheetNames.postSettlement가 있으면 사용, 없으면 기본값)
      const manualSheetName =
        normalizeConfiguredSheetName(extraSheetNames.postSettlement) ||
        DEFAULT_POST_SETTLEMENT_SHEET_NAME;

      const manualRows = await getManualSheetRows(sheets, targetSheetId, manualSheetName);
      const targetEntry = manualRows.find((entry) => entry.id === idParam);

      if (!targetEntry) {
        return res.status(404).json({ success: false, error: '해당 ID의 수기 데이터가 존재하지 않습니다.' });
      }

      const nextType = type && ['labor', 'cost'].includes(type.toLowerCase())
        ? type.toLowerCase()
        : targetEntry.type;

      const nextLabel = label != null ? label : targetEntry.label;

      const hasAmount = amount != null;
      const parsedAmount = hasAmount ? parseNumber(amount) : targetEntry.amount;
      if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
        return res.status(400).json({ success: false, error: 'amount는 0이 아닌 숫자여야 합니다.' });
      }
      const adjustedAmount = parsedAmount > 0 ? parsedAmount * -1 : parsedAmount;

      const updatedNote = note != null ? note : targetEntry.note;
      const updatedAt = new Date().toISOString();
      const typeLabel = nextType === 'labor' ? '인건비' : '비용';
      const employeeName = targetEntry.employeeName || '';
      const fixedSalary = nextType === 'labor' ? adjustedAmount : (targetEntry.fixedSalary || 0);
      const incentive = nextType === 'cost' ? adjustedAmount : (targetEntry.incentive || 0);
      const total = adjustedAmount;
      const registrant = targetEntry.registrant || '';
      const range = `${manualSheetName}!A${targetEntry.rowNumber}:${String.fromCharCode(65 + HEADERS_POST_SETTLEMENT.length - 1)}${targetEntry.rowNumber}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            targetEntry.month,
            typeLabel,
            nextLabel,
            employeeName,
            fixedSalary.toString(),
            incentive.toString(),
            total.toString(),
            targetEntry.id, // ID 유지
            updatedNote || '',
            registrant,
            targetEntry.createdAt || updatedAt
          ]]
        }
      });

      res.json({
        success: true,
        data: {
          id: targetEntry.id,
          month: targetEntry.month,
          type: nextType,
          label: nextLabel,
          amount: adjustedAmount,
          note: updatedNote || '',
          createdAt: targetEntry.createdAt || updatedAt,
          updatedAt
        }
      });
    } catch (error) {
      console.error('[OB] manual-adjustments PUT error:', error);
      res.status(500).json({ success: false, error: '수기 데이터를 수정하지 못했습니다.', message: error.message });
    }
  });

  router.delete('/manual-adjustments/:id', async (req, res) => {
    const idParam = (req.params.id || '').trim();
    const month = (req.query.month || '').trim();

    if (!idParam || !month) {
      return res.status(400).json({ success: false, error: 'id와 month는 필수값입니다.' });
    }

    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, month);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      // 항상 "기타후정산" 시트를 사용 (extraSheetNames.postSettlement가 있으면 사용, 없으면 기본값)
      const manualSheetName =
        normalizeConfiguredSheetName(extraSheetNames.postSettlement) ||
        DEFAULT_POST_SETTLEMENT_SHEET_NAME;

      const manualRows = await getManualSheetRows(sheets, targetSheetId, manualSheetName);
      const targetEntry = manualRows.find((entry) => entry.id === idParam);

      if (!targetEntry) {
        return res.status(404).json({ success: false, error: '해당 ID의 수기 데이터가 존재하지 않습니다.' });
      }

      const range = `${manualSheetName}!A${targetEntry.rowNumber}:${String.fromCharCode(65 + HEADERS_POST_SETTLEMENT.length - 1)}${targetEntry.rowNumber}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [new Array(HEADERS_POST_SETTLEMENT.length).fill('')]
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] manual-adjustments DELETE error:', error);
      res.status(500).json({ success: false, error: '수기 데이터를 삭제하지 못했습니다.', message: error.message });
    }
  });

  router.get('/exclusions', async (req, res) => {
    try {
      const monthParam = parseString(req.query.month || '');
      const typeParam = parseString(req.query.type || 'all').toLowerCase();

      if (!monthParam) {
        return res.status(400).json({ success: false, error: 'month query parameter is required' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, monthParam);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const exclusionSheetName =
        normalizeConfiguredSheetName(extraSheetNames.exclusion) || DEFAULT_EXCLUSION_SHEET_NAME;

      const exclusionRows = await loadExclusionRows(sheets, targetSheetId, exclusionSheetName);
      const exclusionConfig = buildExclusionConfig(exclusionRows, monthParam);

      if (typeParam === 'custom') {
        return res.json({
          success: true,
          data: exclusionConfig.custom.entries
        });
      }
      if (typeParam === 'recontract') {
        return res.json({
          success: true,
          data: exclusionConfig.recontract.entries
        });
      }

      res.json({
        success: true,
        data: {
          custom: exclusionConfig.custom.entries,
          recontract: exclusionConfig.recontract.entries
        }
      });
    } catch (error) {
      console.error('[OB] exclusions GET error:', error);
      res
        .status(500)
        .json({ success: false, error: '제외 인원 정보를 불러오지 못했습니다.', message: error.message });
    }
  });

  router.post('/exclusions', async (req, res) => {
    try {
      const {
        month,
        type,
        targetId = '',
        targetName = '',
        reason = '',
        note = '',
        registrant = ''
      } = req.body || {};

      const trimmedMonth = parseString(month);
      const normalizedType = parseString(type).toLowerCase();
      if (!trimmedMonth || !normalizedType) {
        return res.status(400).json({ success: false, error: 'month와 type은 필수값입니다.' });
      }
      if (!targetId && !targetName) {
        return res.status(400).json({ success: false, error: '유치자 ID 또는 유치자명을 입력해주세요.' });
      }

      const typeLabel =
        normalizedType === 'recontract'
          ? EXCLUSION_TYPE_LABELS.recontract
          : EXCLUSION_TYPE_LABELS.custom;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, trimmedMonth);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const exclusionSheetName =
        normalizeConfiguredSheetName(extraSheetNames.exclusion) || DEFAULT_EXCLUSION_SHEET_NAME;

      await ensureExclusionSheetStructure(sheets, targetSheetId, exclusionSheetName);

      const id = uuidv4();
      const nowIso = new Date().toISOString();
      const monthCellValue = trimmedMonth ? `'${trimmedMonth}` : '';

      const row = [
        monthCellValue,
        typeLabel,
        targetId,
        targetName,
        reason,
        id,
        note,
        registrant,
        nowIso
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: `${exclusionSheetName}!A3`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [row]
        }
      });

      res.json({
        success: true,
        data: {
          id,
          month: trimmedMonth,
          type: normalizedType === 'recontract' ? 'recontract' : 'custom',
          targetId,
          targetName,
          reason,
          note,
          registrant,
          createdAt: nowIso
        }
      });
    } catch (error) {
      console.error('[OB] exclusions POST error:', error);
      res.status(500).json({ success: false, error: '제외 인원을 등록하지 못했습니다.', message: error.message });
    }
  });

  router.put('/exclusions/:id', async (req, res) => {
    const idParam = parseString(req.params.id || '');
    if (!idParam) {
      return res.status(400).json({ success: false, error: 'id parameter is required' });
    }

    try {
      const {
        month,
        type,
        targetId = '',
        targetName = '',
        reason = '',
        note = '',
        registrant
      } = req.body || {};

      const trimmedMonth = parseString(month);
      const normalizedType = parseString(type).toLowerCase();
      if (!trimmedMonth || !normalizedType) {
        return res.status(400).json({ success: false, error: 'month와 type은 필수값입니다.' });
      }
      if (!targetId && !targetName) {
        return res.status(400).json({ success: false, error: '유치자 ID 또는 유치자명을 입력해주세요.' });
      }

      const typeLabel =
        normalizedType === 'recontract'
          ? EXCLUSION_TYPE_LABELS.recontract
          : EXCLUSION_TYPE_LABELS.custom;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, trimmedMonth);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const exclusionSheetName =
        normalizeConfiguredSheetName(extraSheetNames.exclusion) || DEFAULT_EXCLUSION_SHEET_NAME;

      const exclusionRows = await loadExclusionRows(sheets, targetSheetId, exclusionSheetName);
      const targetEntry = exclusionRows.find((entry) => entry.id === idParam);

      if (!targetEntry) {
        return res.status(404).json({ success: false, error: '해당 ID의 제외 인원이 존재하지 않습니다.' });
      }

      const range = `${exclusionSheetName}!A${targetEntry.rowNumber}:${String.fromCharCode(
        65 + HEADERS_EXCLUSIONS.length - 1
      )}${targetEntry.rowNumber}`;
      const monthCellValue = trimmedMonth ? `'${trimmedMonth}` : '';

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            monthCellValue,
            typeLabel,
            targetId,
            targetName,
            reason,
            targetEntry.id,
            note,
            registrant || targetEntry.registrant,
            targetEntry.createdAt || new Date().toISOString()
          ]]
        }
      });

      res.json({
        success: true,
        data: {
          id: targetEntry.id,
          month: trimmedMonth,
          type: normalizedType === 'recontract' ? 'recontract' : 'custom',
          targetId,
          targetName,
          reason,
          note,
          registrant: registrant || targetEntry.registrant,
          createdAt: targetEntry.createdAt
        }
      });
    } catch (error) {
      console.error('[OB] exclusions PUT error:', error);
      res.status(500).json({ success: false, error: '제외 인원을 수정하지 못했습니다.', message: error.message });
    }
  });

  router.delete('/exclusions/:id', async (req, res) => {
    const idParam = parseString(req.params.id || '');
    const monthParam = parseString(req.query.month || '');
    if (!idParam) {
      return res.status(400).json({ success: false, error: 'id parameter is required' });
    }
    if (!monthParam) {
      return res.status(400).json({ success: false, error: 'month query parameter is required' });
    }

    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, monthParam);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const exclusionSheetName =
        normalizeConfiguredSheetName(extraSheetNames.exclusion) || DEFAULT_EXCLUSION_SHEET_NAME;

      const exclusionRows = await loadExclusionRows(sheets, targetSheetId, exclusionSheetName);
      const targetEntry = exclusionRows.find((entry) => entry.id === idParam);

      if (!targetEntry) {
        return res.status(404).json({ success: false, error: '해당 ID의 제외 인원이 존재하지 않습니다.' });
      }

      const range = `${exclusionSheetName}!A${targetEntry.rowNumber}:${String.fromCharCode(
        65 + HEADERS_EXCLUSIONS.length - 1
      )}${targetEntry.rowNumber}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [new Array(HEADERS_EXCLUSIONS.length).fill('')]
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] exclusions DELETE error:', error);
      res.status(500).json({ success: false, error: '제외 인원을 삭제하지 못했습니다.', message: error.message });
    }
  });

  // 대상점 관리 API
  router.get('/target-outlets', async (req, res) => {
    try {
      const monthParam = parseString(req.query.month || '');

      if (!monthParam) {
        return res.status(400).json({ success: false, error: 'month query parameter is required' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, monthParam);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const targetOutletSheetName =
        normalizeConfiguredSheetName(extraSheetNames.targetOutlet) || DEFAULT_TARGET_OUTLET_SHEET_NAME;

      const targetOutletRows = await loadTargetOutletRows(sheets, targetSheetId, targetOutletSheetName);
      const targetOutletConfig = buildTargetOutletConfig(targetOutletRows, monthParam);

      res.json({
        success: true,
        data: targetOutletConfig.entries
      });
    } catch (error) {
      console.error('[OB] target-outlets GET error:', error);
      res
        .status(500)
        .json({ success: false, error: '대상점 정보를 불러오지 못했습니다.', message: error.message });
    }
  });

  router.post('/target-outlets', async (req, res) => {
    try {
      const {
        month,
        type = 'recontract',
        outletName = '',
        reason = '',
        note = '',
        registrant = ''
      } = req.body || {};

      const trimmedMonth = parseString(month);
      if (!trimmedMonth) {
        return res.status(400).json({ success: false, error: 'month는 필수값입니다.' });
      }
      if (!outletName || !outletName.trim()) {
        return res.status(400).json({ success: false, error: '대상점명을 입력해주세요.' });
      }

      const normalizedType = parseString(type).toLowerCase();
      const typeLabel =
        normalizedType === 'postsettlement' || normalizedType === 'post_settlement'
          ? TARGET_OUTLET_TYPE_LABELS.postSettlement
          : TARGET_OUTLET_TYPE_LABELS.recontract;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, trimmedMonth);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const targetOutletSheetName =
        normalizeConfiguredSheetName(extraSheetNames.targetOutlet) || DEFAULT_TARGET_OUTLET_SHEET_NAME;

      await ensureTargetOutletSheetStructure(sheets, targetSheetId, targetOutletSheetName);

      const id = uuidv4();
      const nowIso = new Date().toISOString();
      const monthCellValue = trimmedMonth ? `'${trimmedMonth}` : '';

      const row = [
        monthCellValue,
        typeLabel,
        outletName.trim(),
        reason.trim(),
        id,
        note.trim(),
        registrant || '',
        nowIso
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: targetSheetId,
        range: `${targetOutletSheetName}!A3`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [row] }
      });

      res.json({
        success: true,
        data: {
          id,
          month: trimmedMonth,
          type: normalizedType === 'postsettlement' || normalizedType === 'post_settlement' ? 'postSettlement' : 'recontract',
          outletName: outletName.trim(),
          reason: reason.trim(),
          note: note.trim(),
          registrant: registrant || '',
          createdAt: nowIso
        }
      });
    } catch (error) {
      console.error('[OB] target-outlets POST error:', error);
      res.status(500).json({ success: false, error: '대상점을 등록하지 못했습니다.', message: error.message });
    }
  });

  router.put('/target-outlets/:id', async (req, res) => {
    const idParam = parseString(req.params.id || '');
    if (!idParam) {
      return res.status(400).json({ success: false, error: 'id parameter is required' });
    }

    try {
      const {
        month,
        type = 'recontract',
        outletName = '',
        reason = '',
        note = '',
        registrant
      } = req.body || {};

      const trimmedMonth = parseString(month);
      if (!trimmedMonth) {
        return res.status(400).json({ success: false, error: 'month는 필수값입니다.' });
      }
      if (!outletName || !outletName.trim()) {
        return res.status(400).json({ success: false, error: '대상점명을 입력해주세요.' });
      }

      const normalizedType = parseString(type).toLowerCase();
      const typeLabel =
        normalizedType === 'postsettlement' || normalizedType === 'post_settlement'
          ? TARGET_OUTLET_TYPE_LABELS.postSettlement
          : TARGET_OUTLET_TYPE_LABELS.recontract;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, trimmedMonth);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const targetOutletSheetName =
        normalizeConfiguredSheetName(extraSheetNames.targetOutlet) || DEFAULT_TARGET_OUTLET_SHEET_NAME;

      const targetOutletRows = await loadTargetOutletRows(sheets, targetSheetId, targetOutletSheetName);
      const targetEntry = targetOutletRows.find((entry) => entry.id === idParam);

      if (!targetEntry) {
        return res.status(404).json({ success: false, error: '해당 ID의 대상점이 존재하지 않습니다.' });
      }

      const range = `${targetOutletSheetName}!A${targetEntry.rowNumber}:${String.fromCharCode(
        65 + HEADERS_TARGET_OUTLETS.length - 1
      )}${targetEntry.rowNumber}`;
      const monthCellValue = trimmedMonth ? `'${trimmedMonth}` : '';

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            monthCellValue,
            typeLabel,
            outletName.trim(),
            reason.trim(),
            targetEntry.id,
            note.trim(),
            registrant || targetEntry.registrant,
            targetEntry.createdAt || new Date().toISOString()
          ]]
        }
      });

      res.json({
        success: true,
        data: {
          id: targetEntry.id,
          month: trimmedMonth,
          type: normalizedType === 'postsettlement' || normalizedType === 'post_settlement' ? 'postSettlement' : 'recontract',
          outletName: outletName.trim(),
          reason: reason.trim(),
          note: note.trim(),
          registrant: registrant || targetEntry.registrant,
          createdAt: targetEntry.createdAt
        }
      });
    } catch (error) {
      console.error('[OB] target-outlets PUT error:', error);
      res.status(500).json({ success: false, error: '대상점을 수정하지 못했습니다.', message: error.message });
    }
  });

  router.delete('/target-outlets/:id', async (req, res) => {
    const idParam = parseString(req.params.id || '');
    const monthParam = parseString(req.query.month || '');
    if (!idParam) {
      return res.status(400).json({ success: false, error: 'id parameter is required' });
    }
    if (!monthParam) {
      return res.status(400).json({ success: false, error: 'month query parameter is required' });
    }

    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const configEntry = await fetchSettlementConfig(sheets, SPREADSHEET_ID, monthParam);

      if (!configEntry) {
        return res.status(404).json({ success: false, error: '해당 월의 정산 링크 구성이 존재하지 않습니다.' });
      }

      const targetSheetId = configEntry.sheetId || SPREADSHEET_ID;
      const extraSheetNames = configEntry.extraSheetNames || {};
      const targetOutletSheetName =
        normalizeConfiguredSheetName(extraSheetNames.targetOutlet) || DEFAULT_TARGET_OUTLET_SHEET_NAME;

      const targetOutletRows = await loadTargetOutletRows(sheets, targetSheetId, targetOutletSheetName);
      const targetEntry = targetOutletRows.find((entry) => entry.id === idParam);

      if (!targetEntry) {
        return res.status(404).json({ success: false, error: '해당 ID의 대상점이 존재하지 않습니다.' });
      }

      const range = `${targetOutletSheetName}!A${targetEntry.rowNumber}:${String.fromCharCode(
        65 + HEADERS_TARGET_OUTLETS.length - 1
      )}${targetEntry.rowNumber}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [new Array(HEADERS_TARGET_OUTLETS.length).fill('')]
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[OB] target-outlets DELETE error:', error);
      res.status(500).json({ success: false, error: '대상점을 삭제하지 못했습니다.', message: error.message });
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


