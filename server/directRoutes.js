const express = require('express');
const { google } = require('googleapis');

// 직영점 모드 시트 이름
const SHEET_POLICY_MARGIN = '직영점_정책_마진';
const SHEET_POLICY_ADDON = '직영점_정책_부가서비스';
const SHEET_POLICY_INSURANCE = '직영점_정책_보험상품';
const SHEET_POLICY_SPECIAL = '직영점_정책_별도';
const SHEET_SETTINGS = '직영점_설정';
const SHEET_MAIN_PAGE_TEXTS = '직영점_메인페이지문구';

// 시트 헤더 정의
const HEADERS_POLICY_MARGIN = ['통신사', '마진'];
const HEADERS_POLICY_ADDON = ['통신사', '서비스명', '월요금', '유치추가금액', '미유치차감금액'];
const HEADERS_POLICY_INSURANCE = ['통신사', '보험상품명', '출고가최소', '출고가최대', '월요금', '유치추가금액', '미유치차감금액'];
const HEADERS_POLICY_SPECIAL = ['통신사', '정책명', '추가금액', '차감금액', '적용여부'];
const HEADERS_SETTINGS = ['통신사', '설정유형', '시트ID', '시트URL', '설정값JSON'];
const HEADERS_MAIN_PAGE_TEXTS = ['통신사', '카테고리', '설정유형', '문구내용', '이미지URL', '수정일시'];

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

// 간단한 메모리 캐시 (TTL)
const cacheStore = new Map(); // key -> { data, expires }
const pendingRequests = new Map(); // key -> Promise (동시 요청 방지)

// Rate limiting을 위한 마지막 요청 시간 추적
let lastApiCallTime = 0;
const MIN_API_INTERVAL_MS = 100; // 최소 100ms 간격으로 API 호출

function getCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs = 60 * 1000) {
  cacheStore.set(key, { data, expires: Date.now() + ttlMs });
}

// Rate limit 에러 발생 시 재시도하는 래퍼 함수
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Rate limiting: 최소 간격 유지
      const now = Date.now();
      const timeSinceLastCall = now - lastApiCallTime;
      if (timeSinceLastCall < MIN_API_INTERVAL_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL_MS - timeSinceLastCall));
      }
      lastApiCallTime = Date.now();

      return await fn();
    } catch (error) {
      // Rate limit 에러인 경우에만 재시도
      if (error.code === 429 && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.warn(`[Direct] Rate limit 에러 발생, ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// 동시 요청 방지를 위한 래퍼 함수 (재시도 로직 포함)
async function withRequestDeduplication(key, fetchFn) {
  // 캐시 확인
  const cached = getCache(key);
  if (cached) {
    return cached;
  }

  // 이미 진행 중인 요청이 있으면 대기
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // 새로운 요청 시작 (재시도 로직 포함)
  const promise = withRetry(fetchFn)
    .then(data => {
      setCache(key, data, 10 * 60 * 1000); // 10분 캐시
      pendingRequests.delete(key);
      return data;
    })
    .catch(err => {
      pendingRequests.delete(key);
      throw err;
    });

  pendingRequests.set(key, promise);
  return promise;
}

// 정책 설정 읽기 함수 (캐시 적용, 동시 요청 방지)
async function getPolicySettings(carrier) {
  const cacheKey = `policy-settings-${carrier}`;
  
  return withRequestDeduplication(cacheKey, async () => {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();

    // 마진 설정 읽기
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN);
    const marginRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_MARGIN
      });
    });
    const marginRows = (marginRes.data.values || []).slice(1);
    const marginRow = marginRows.find(row => (row[0] || '').trim() === carrier);
    const baseMargin = marginRow ? Number(marginRow[1] || 0) : 50000;

    // 부가서비스, 보험상품, 별도정책 병렬 읽기 (재시도 로직 포함)
    const [addonRes, insuranceRes, specialRes] = await Promise.all([
      withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_ADDON
        });
      }),
      withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_INSURANCE
        });
      }),
      withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_SPECIAL
        });
      })
    ]);

    const addonRows = (addonRes.data.values || []).slice(1);
    const addonList = addonRows
      .filter(row => (row[0] || '').trim() === carrier)
      .map(row => ({
        incentive: Number(row[3] || 0),
        deduction: -Math.abs(Number(row[4] || 0))  // 부가미유치 차감금액 (음수 처리)
      }));

    const insuranceRows = (insuranceRes.data.values || []).slice(1);
    const insuranceList = insuranceRows
      .filter(row => (row[0] || '').trim() === carrier)
      .map(row => ({
        incentive: Number(row[5] || 0), // 보험 유치 추가금액
        deduction: -Math.abs(Number(row[6] || 0))  // 보험 미유치 차감금액 (음수 처리)
      }));

    const specialRows = (specialRes.data.values || []).slice(1);
    const specialPolicies = specialRows
      .filter(row => (row[0] || '').trim() === carrier && (row[4] || '').toString().toLowerCase() === 'true')
      .map(row => ({
        addition: Number(row[2] || 0),
        deduction: Number(row[3] || 0)
      }));

    return {
      baseMargin,
      addonList,
      insuranceList,
      specialPolicies
    };
  });
}

// 링크 설정 읽기 함수 (캐시 적용, 동시 요청 방지)
async function getLinkSettings(carrier) {
  const cacheKey = `link-settings-${carrier}`;
  
  return withRequestDeduplication(cacheKey, async () => {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const linkSettingsRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
    });
    const linkSettingsRows = (linkSettingsRes.data.values || []).slice(1);
    const carrierSettings = linkSettingsRows.filter(row => (row[0] || '').trim() === carrier);
    return carrierSettings;
  });
}

// 시트 데이터 읽기 함수 (캐시 적용, 동시 요청 방지)
async function getSheetData(sheetId, range, ttlMs = 10 * 60 * 1000) {
  const cacheKey = `sheet-data-${sheetId}-${range}`;
  
  return withRequestDeduplication(cacheKey, async () => {
    const { sheets } = createSheetsClient();
    const res = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE'
      });
    });
    const data = (res.data.values || []).slice(1);
    return data;
  });
}

function deleteCache(key) {
  cacheStore.delete(key);
  console.log(`[Direct] 캐시 무효화: ${key}`);
}

// 모델 코드 정규화 함수 (공백, 하이픈, 언더스코어 제거, 소문자 변환)
function normalizeModelCode(modelCode) {
  if (!modelCode) return '';
  return modelCode.replace(/[\s\-_]/g, '').toLowerCase();
}

// 하이픈 변형 생성 함수 (하이픈 유무/위치 차이 처리)
function generateHyphenVariants(modelCode) {
  if (!modelCode) return [];
  const variants = [modelCode]; // 원본 포함
  
  // 하이픈이 있는 경우: 하이픈 제거
  if (modelCode.includes('-')) {
    variants.push(modelCode.replace(/-/g, ''));
  }
  
  // 하이픈이 없는 경우: 일반적인 위치에 하이픈 추가 시도
  if (!modelCode.includes('-')) {
    // 숫자 앞에 하이픈 추가 (예: UIP17PR256 → UIP17PR-256)
    variants.push(modelCode.replace(/([A-Z])(\d+)/g, '$1-$2'));
    // 숫자 뒤에 하이픈 추가 (예: SM-S928N256 → SM-S928N-256)
    variants.push(modelCode.replace(/(\d+)([A-Z])/g, '$1-$2'));
  }
  
  return [...new Set(variants)]; // 중복 제거
}

// 개통유형 문자열을 표준화하여 배열로 반환 (예: "010신규/기변" → ['010신규','기변'])
function parseOpeningTypes(raw) {
  const text = (raw || '').toString().toLowerCase();
  // 전유형 키워드가 있으면 전부 포함
  if (text.includes('전유형') || text.includes('전체') || text.includes('모두')) {
    return ['010신규', 'MNP', '기변'];
  }

  const types = [];
  if (text.includes('010') || text.includes('신규')) types.push('010신규');
  if (text.includes('mnp') || text.includes('번호이동')) types.push('MNP');
  if (text.includes('기변') || text.includes('기기변경')) types.push('기변');

  // 쉼표나 슬래시로 분리되어 있을 수 있으므로 추가 파싱
  if (types.length === 0 && (text.includes('/') || text.includes(','))) {
    const tokens = text.split(/[\/,]/).map(t => t.trim());
    tokens.forEach(token => {
      if (token.includes('010') || token.includes('신규')) types.push('010신규');
      if (token.includes('mnp') || token.includes('번호이동')) types.push('MNP');
      if (token.includes('기변') || token.includes('기기변경')) types.push('기변');
    });
  }

  // 기본값
  if (types.length === 0) return ['010신규'];
  // 중복 제거
  return [...new Set(types)];
}

// 캐시 무효화 함수를 외부에서 사용할 수 있도록 export
function invalidateDirectStoreCache(carrier = null) {
  if (carrier) {
    deleteCache(`mobiles-${carrier}`);
  } else {
    // 모든 통신사 캐시 무효화
    deleteCache('mobiles-SK');
    deleteCache('mobiles-KT');
    deleteCache('mobiles-LG');
  }
  deleteCache('todays-mobiles');
  console.log(`[Direct] 모든 직영점 캐시 무효화 완료`);
}

// 시트 ID 조회 헬퍼 함수
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  // 캐시 키 생성
  const cacheKey = `headers-${sheetName}-${spreadsheetId}`;
  const CACHE_TTL = 5 * 60 * 1000; // 5분
  
  // 캐시 확인
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    // 시트 존재 여부 확인 및 헤더 확인 (재시도 로직 포함)
    const res = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`
      });
    });
    const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
    const needsInit = firstRow.length === 0 || headers.some((h, i) => (firstRow[i] || '') !== h);
    if (needsInit) {
      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] }
        });
      });
      // 헤더 업데이트 후 캐시 무효화 (다음 호출에서 다시 확인)
      // 캐시하지 않고 바로 반환
      return headers;
    }
    // 헤더가 정상이면 캐시에 저장
    setCache(cacheKey, headers, CACHE_TTL);
    return headers;
  } catch (error) {
    // 시트가 없으면 생성 (재시도 로직 포함)
    if (error.code === 400) {
      try {
        await withRetry(async () => {
          return await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }]
            }
          });
        });
        // 헤더 작성 (재시도 로직 포함)
        await withRetry(async () => {
          return await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [headers] }
          });
        });
        // 시트 생성 후 캐시에 저장
        setCache(cacheKey, headers, CACHE_TTL);
      } catch (createError) {
        console.error(`[Direct] Failed to create sheet ${sheetName}:`, createError);
        // 에러 발생 시 캐시 삭제
        cacheStore.delete(cacheKey);
        throw createError;
      }
    } else {
      // 에러 발생 시 캐시 삭제
      cacheStore.delete(cacheKey);
      throw error;
    }
    return headers;
  }
}

function setupDirectRoutes(app) {
  const router = express.Router();

  // === 정책 설정 ===

  // GET /api/direct/policy-settings?carrier=SK
  router.get('/policy-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 마진 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN);
      const marginRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_MARGIN
      });
      const marginRows = (marginRes.data.values || []).slice(1);
      const marginRow = marginRows.find(row => (row[0] || '').trim() === carrier);
      const margin = marginRow ? Number(marginRow[1] || 0) : 50000; // 기본값 50000

      // 부가서비스 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON, HEADERS_POLICY_ADDON);
      const addonRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_ADDON
      });
      const addonRows = (addonRes.data.values || []).slice(1);
      const addons = addonRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          fee: Number(row[2] || 0),
          incentive: Number(row[3] || 0),
          deduction: Number(row[4] || 0)
        }));

      // 보험상품 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_INSURANCE, HEADERS_POLICY_INSURANCE);
      const insuranceRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_INSURANCE
      });
      const insuranceRows = (insuranceRes.data.values || []).slice(1);
      const insurances = insuranceRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          minPrice: Number(row[2] || 0),
          maxPrice: Number(row[3] || 0),
          fee: Number(row[4] || 0),
          incentive: Number(row[5] || 0),
          deduction: Number(row[6] || 0)
        }));

      // 별도 정책 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL, HEADERS_POLICY_SPECIAL);
      const specialRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_SPECIAL
      });
      const specialRows = (specialRes.data.values || []).slice(1);
      const specialPolicies = specialRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          addition: Number(row[2] || 0),
          deduction: Number(row[3] || 0),
          isActive: (row[4] || '').toString().toLowerCase() === 'true' || (row[4] || '').toString() === '1'
        }));

      res.json({
        success: true,
        margin: { baseMargin: margin },
        addon: { list: addons },
        insurance: { list: insurances },
        special: { list: specialPolicies }
      });
    } catch (error) {
      console.error('[Direct] policy-settings GET error:', error);
      res.status(500).json({ success: false, error: '정책 설정 조회 실패', message: error.message });
    }
  });

      // POST /api/direct/policy-settings?carrier=SK
  router.post('/policy-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { margin, addon, insurance, special } = req.body || {};
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 마진 설정 저장
      if (margin && margin.baseMargin !== undefined) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN);
        const marginRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_MARGIN
        });
        const marginRows = (marginRes.data.values || []).slice(1);
        const marginRowIndex = marginRows.findIndex(row => (row[0] || '').trim() === carrier);

        if (marginRowIndex >= 0) {
          // 업데이트
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_MARGIN}!A${marginRowIndex + 2}:B${marginRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[carrier, margin.baseMargin]] }
          });
        } else {
          // 추가
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_MARGIN,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [[carrier, margin.baseMargin]] }
          });
        }
      }

      // 부가서비스 설정 저장
      if (addon && addon.list) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON, HEADERS_POLICY_ADDON);
        // 기존 데이터 읽기
        const addonRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_ADDON
        });
        const addonRows = (addonRes.data.values || []).slice(1);
        // 해당 통신사 데이터 삭제 (인덱스 역순으로 삭제)
        const deleteIndices = [];
        for (let i = addonRows.length - 1; i >= 0; i--) {
          if ((addonRows[i][0] || '').trim() === carrier) {
            deleteIndices.push(i + 2); // 1-based + header row
          }
        }
        if (deleteIndices.length > 0) {
          const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON);
          // 역순으로 정렬 (높은 인덱스부터 삭제)
          deleteIndices.sort((a, b) => b - a);
          const deleteRequests = deleteIndices.map(idx => ({
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: idx - 1,
                endIndex: idx
              }
            }
          }));
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: deleteRequests }
          });
        }
        // 새 데이터 추가
        const newAddonRows = addon.list.map(item => [
          carrier,
          item.name || '',
          item.fee || 0,
          item.incentive || 0,
          item.deduction || 0
        ]);
        if (newAddonRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_ADDON,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: newAddonRows }
          });
        }
      }

      // 보험상품 설정 저장
      if (insurance && insurance.list) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_INSURANCE, HEADERS_POLICY_INSURANCE);
        // 기존 데이터 읽기
        const insuranceRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_INSURANCE
        });
        const insuranceRows = (insuranceRes.data.values || []).slice(1);
        // 해당 통신사 데이터 삭제 (인덱스 역순으로 삭제)
        const deleteIndices = [];
        for (let i = insuranceRows.length - 1; i >= 0; i--) {
          if ((insuranceRows[i][0] || '').trim() === carrier) {
            deleteIndices.push(i + 2); // 1-based + header row
          }
        }
        if (deleteIndices.length > 0) {
          const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_INSURANCE);
          // 역순으로 정렬 (높은 인덱스부터 삭제)
          deleteIndices.sort((a, b) => b - a);
          const deleteRequests = deleteIndices.map(idx => ({
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: idx - 1,
                endIndex: idx
              }
            }
          }));
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: deleteRequests }
          });
        }
        // 새 데이터 추가
        const newInsuranceRows = insurance.list.map(item => [
          carrier,
          item.name || '',
          item.minPrice || 0,
          item.maxPrice || 0,
          item.fee || 0,
          item.incentive || 0,
          item.deduction || 0
        ]);
        if (newInsuranceRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_INSURANCE,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: newInsuranceRows }
          });
        }
      }

      // 별도 정책 설정 저장
      if (special && special.list) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL, HEADERS_POLICY_SPECIAL);
        // 기존 데이터 읽기
        const specialRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_SPECIAL
        });
        const specialRows = (specialRes.data.values || []).slice(1);
        // 해당 통신사 데이터 삭제
        const deleteIndices = [];
        for (let i = specialRows.length - 1; i >= 0; i--) {
          if ((specialRows[i][0] || '').trim() === carrier) {
            deleteIndices.push(i + 2);
          }
        }
        if (deleteIndices.length > 0) {
          const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL);
          // 역순으로 정렬 (높은 인덱스부터 삭제)
          deleteIndices.sort((a, b) => b - a);
          const deleteRequests = deleteIndices.map(idx => ({
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: idx - 1,
                endIndex: idx
              }
            }
          }));
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: deleteRequests }
          });
        }
        // 새 데이터 추가
        const newSpecialRows = special.list.map(item => [
          carrier,
          item.name || '',
          item.addition || 0,
          item.deduction || 0,
          item.isActive ? 'TRUE' : 'FALSE'
        ]);
        if (newSpecialRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_SPECIAL,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: newSpecialRows }
          });
        }
      }

      // 정책 설정 캐시 무효화
      deleteCache(`policy-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings POST error:', error);
      res.status(500).json({ success: false, error: '정책 설정 저장 실패', message: error.message });
    }
  });

  // === 링크 설정 ===

  // GET /api/direct/link-settings?carrier=SK
  router.get('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
      const settingsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
      const settingsRows = (settingsRes.data.values || []).slice(1);

      // 통신사별 설정 필터링
      const carrierSettings = settingsRows.filter(row => (row[0] || '').trim() === carrier);

      // 설정 유형별로 그룹화
      const planGroupRow = carrierSettings.find(row => (row[1] || '').trim() === 'planGroup');
      const supportRow = carrierSettings.find(row => (row[1] || '').trim() === 'support');
      const policyRow = carrierSettings.find(row => (row[1] || '').trim() === 'policy');

      let planGroup = { link: '', planGroups: [] };
      let support = { link: '' };
      let policy = { link: '' };

      if (planGroupRow) {
        let settingsJson = {};
        try {
          settingsJson = planGroupRow[4] ? JSON.parse(planGroupRow[4]) : {};
        } catch (parseErr) {
          console.error(`[Direct] ${carrier} planGroup 설정 JSON 파싱 실패:`, parseErr);
          console.error(`[Direct] JSON 문자열:`, planGroupRow[4]);
        }
        planGroup = {
          link: planGroupRow[2] || '', // 시트ID
          sheetId: planGroupRow[2] || '',
          planNameRange: settingsJson.planNameRange || '',
          planGroupRange: settingsJson.planGroupRange || '',
          basicFeeRange: settingsJson.basicFeeRange || '',
          planGroups: settingsJson.planGroups || []
        };
      }

      if (supportRow) {
        let settingsJson = {};
        try {
          settingsJson = supportRow[4] ? JSON.parse(supportRow[4]) : {};
        } catch (parseErr) {
          console.error(`[Direct] ${carrier} support 설정 JSON 파싱 실패:`, parseErr);
          console.error(`[Direct] JSON 문자열:`, supportRow[4]);
        }
        support = {
          link: supportRow[2] || '',
          sheetId: supportRow[2] || '',
          modelRange: settingsJson.modelRange || '',
          petNameRange: settingsJson.petNameRange || '',
          factoryPriceRange: settingsJson.factoryPriceRange || '',
          openingTypeRange: settingsJson.openingTypeRange || '',
          planGroupRanges: settingsJson.planGroupRanges || {}
        };
      }

      if (policyRow) {
        let settingsJson = {};
        try {
          settingsJson = policyRow[4] ? JSON.parse(policyRow[4]) : {};
        } catch (parseErr) {
          console.error(`[Direct] ${carrier} policy 설정 JSON 파싱 실패:`, parseErr);
          console.error(`[Direct] JSON 문자열:`, policyRow[4]);
        }
        policy = {
          link: policyRow[2] || '',
          sheetId: policyRow[2] || '',
          modelRange: settingsJson.modelRange || '',
          petNameRange: settingsJson.petNameRange || '',
          planGroupRanges: settingsJson.planGroupRanges || {}
        };
      }

      res.json({
        success: true,
        planGroup,
        support,
        policy
      });
    } catch (error) {
      console.error(`[Direct] link-settings GET error (통신사: ${req.query.carrier || 'SK'}):`, error);
      console.error('[Direct] Error stack:', error.stack);
      // 에러 발생 시에도 기본값 반환 (500 에러 대신)
      res.json({
        success: true,
        planGroup: { link: '', planGroups: [] },
        support: { link: '' },
        policy: { link: '' }
      });
    }
  });

  // GET /api/direct/link-settings/fetch-range?sheetId=xxx&range=전체!F5:F500&unique=true
  // 시트에서 범위를 읽어서 데이터 반환 (유니크 옵션 지원)
  // 주의: unique=true는 요금제군 같은 카테고리 데이터에만 사용하고,
  //       금액 범위(기본료, 출고가, 지원금 등)는 unique=false로 모든 값을 가져와야 합니다.
  router.get('/link-settings/fetch-range', async (req, res) => {
    try {
      const { sheetId, range, unique } = req.query;
      if (!sheetId || !range) {
        return res.status(400).json({ success: false, error: 'sheetId와 range가 필요합니다.' });
      }

      const { sheets } = createSheetsClient();
      
      // 시트에서 범위 읽기
      // majorDimension: 'ROWS'를 사용하여 모든 행을 가져오고, 빈 행도 포함
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE'
      });

      const values = response.data.values || [];
      
      if (unique === 'true') {
        // 유니크한 값 추출 (빈 값 제외, 공백 제거)
        // flat()으로 모든 행의 값을 하나의 배열로 만들고, 빈 값은 제외
        const uniqueValues = [...new Set(
          values
            .flat()
            .map(v => {
              // 숫자나 문자열 모두 처리
              if (v === null || v === undefined) return '';
              return String(v).trim();
            })
            .filter(v => v.length > 0)
        )].sort();
        
        res.json({
          success: true,
          data: uniqueValues,
          isUnique: true
        });
      } else {
        // 원본 데이터 그대로 반환 (빈 행 포함)
        // 중간에 빈 행이 있어도 모든 행을 반환
        res.json({
          success: true,
          data: values,
          isUnique: false
        });
      }
    } catch (error) {
      console.error('[Direct] fetch-range GET error:', error);
      res.status(500).json({ success: false, error: '범위 데이터 조회 실패', message: error.message });
    }
  });

  // GET /api/direct/link-settings/plan-groups?carrier=SK&sheetId=xxx&range=전체!F5:F500
  // 시트에서 요금제군 범위를 읽어서 유니크한 값들만 반환 (하위 호환성)
  router.get('/link-settings/plan-groups', async (req, res) => {
    try {
      const { sheetId, range } = req.query;
      if (!sheetId || !range) {
        return res.status(400).json({ success: false, error: 'sheetId와 range가 필요합니다.' });
      }

      const { sheets } = createSheetsClient();
      
      // 시트에서 범위 읽기
      // majorDimension: 'ROWS'를 사용하여 모든 행을 가져오고, 빈 행도 포함
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE'
      });

      const values = response.data.values || [];
      // 유니크한 값 추출 (빈 값 제외, 공백 제거)
      const uniqueGroups = [...new Set(
        values
          .flat()
          .map(v => {
            // 숫자나 문자열 모두 처리
            if (v === null || v === undefined) return '';
            return String(v).trim();
          })
          .filter(v => v.length > 0)
      )].sort();

      res.json({
        success: true,
        planGroups: uniqueGroups
      });
    } catch (error) {
      console.error('[Direct] plan-groups GET error:', error);
      res.status(500).json({ success: false, error: '요금제군 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/link-settings?carrier=SK
  router.post('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { planGroup, support, policy } = req.body || {};
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

      // planGroup 저장 시, planGroupRange가 있고 planGroups가 비어있으면 자동으로 추출
      if (planGroup && planGroup.planGroupRange && (!planGroup.planGroups || planGroup.planGroups.length === 0)) {
        try {
          const sheetId = planGroup.sheetId || planGroup.link;
          if (sheetId) {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: planGroup.planGroupRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            });
            const values = response.data.values || [];
            const uniqueGroups = [...new Set(
              values
                .flat()
                .map(v => {
                  // 숫자나 문자열 모두 처리
                  if (v === null || v === undefined) return '';
                  return String(v).trim();
                })
                .filter(v => v.length > 0)
            )].sort();
            planGroup.planGroups = uniqueGroups;
          }
        } catch (autoExtractError) {
          console.warn('[Direct] planGroups 자동 추출 실패:', autoExtractError);
          // 자동 추출 실패해도 계속 진행
        }
      }

      // 기존 설정 읽기
      const settingsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
      const settingsRows = (settingsRes.data.values || []).slice(1);

      // 통신사별 설정 필터링 및 업데이트/추가
      const rowsToUpdate = [];

      if (planGroup) {
        const existingRowIndex = settingsRows.findIndex(
          row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'planGroup'
        );
        const settingsJson = JSON.stringify({
          planNameRange: planGroup.planNameRange || '',
          planGroupRange: planGroup.planGroupRange || '',
          basicFeeRange: planGroup.basicFeeRange || '',
          planGroups: planGroup.planGroups || []
        });
        if (existingRowIndex >= 0) {
          // 업데이트
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[carrier, 'planGroup', planGroup.sheetId || planGroup.link || '', '', settingsJson]]
            }
          });
        } else {
          // 추가
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[carrier, 'planGroup', planGroup.sheetId || planGroup.link || '', '', settingsJson]]
            }
          });
        }
      }

      if (support) {
        const existingRowIndex = settingsRows.findIndex(
          row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'support'
        );
        const settingsJson = JSON.stringify({
          modelRange: support.modelRange || '',
          petNameRange: support.petNameRange || '',
          factoryPriceRange: support.factoryPriceRange || '',
          openingTypeRange: support.openingTypeRange || '',
          planGroupRanges: support.planGroupRanges || {}
        });
        if (existingRowIndex >= 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[carrier, 'support', support.sheetId || support.link || '', '', settingsJson]]
            }
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[carrier, 'support', support.sheetId || support.link || '', '', settingsJson]]
            }
          });
        }
      }

      if (policy) {
        const existingRowIndex = settingsRows.findIndex(
          row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'policy'
        );
        const settingsJson = JSON.stringify({
          modelRange: policy.modelRange || '',
          petNameRange: policy.petNameRange || '',
          planGroupRanges: policy.planGroupRanges || {}
        });
        if (existingRowIndex >= 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[carrier, 'policy', policy.sheetId || policy.link || '', '', settingsJson]]
            }
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[carrier, 'policy', policy.sheetId || policy.link || '', '', settingsJson]]
            }
          });
        }
      }

      // 링크 설정 캐시 무효화
      deleteCache(`link-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] link-settings POST error:', error);
      res.status(500).json({ success: false, error: '링크 설정 저장 실패', message: error.message });
    }
  });

  // === 상품 데이터 ===

  // mobiles 데이터를 가져오는 공통 함수
  async function getMobileList(carrier, options = {}) {
    try {
      const carrierParam = carrier || 'SK';
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 1. 링크설정에서 정책표 설정과 이통사 지원금 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
      const settingsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
      const settingsRows = (settingsRes.data.values || []).slice(1);
      
      // 정책표 설정에서 모델명, 펫네임 가져오기 (프롬프트 기준)
      const policyRow = settingsRows.find(row => (row[0] || '').trim() === carrierParam && (row[1] || '').trim() === 'policy');
      if (!policyRow || !policyRow[2]) {
        console.warn(`[Direct] ${carrierParam} 정책표 설정을 찾을 수 없습니다.`);
        return []; // 빈 배열 반환
      }

      let policySettingsJson = {};
      try {
        policySettingsJson = policyRow[4] ? JSON.parse(policyRow[4]) : {};
      } catch (parseErr) {
        console.error(`[Direct] ${carrierParam} 정책표 설정 JSON 파싱 실패:`, parseErr);
        console.error(`[Direct] JSON 문자열:`, policyRow[4]);
        return []; // 빈 배열 반환
      }
      const policySheetId = policyRow[2].trim();
      const modelRange = policySettingsJson.modelRange || '';
      const petNameRange = policySettingsJson.petNameRange || '';

      if (!modelRange || !petNameRange) {
        console.warn(`[Direct] ${carrierParam} 정책표 설정에서 모델명, 펫네임 범위가 누락되었습니다.`);
        return []; // 빈 배열 반환
      }

      // 이통사 지원금 설정 읽기
      const supportRow = settingsRows.find(row => (row[0] || '').trim() === carrierParam && (row[1] || '').trim() === 'support');
      if (!supportRow || !supportRow[2]) {
        console.warn(`[Direct] ${carrierParam} 이통사 지원금 설정을 찾을 수 없습니다.`);
        return []; // 빈 배열 반환
      }

      let supportSettingsJson = {};
      try {
        supportSettingsJson = supportRow[4] ? JSON.parse(supportRow[4]) : {};
      } catch (parseErr) {
        console.error(`[Direct] ${carrierParam} 이통사 지원금 설정 JSON 파싱 실패:`, parseErr);
        console.error(`[Direct] JSON 문자열:`, supportRow[4]);
        return []; // 빈 배열 반환
      }
      const supportSheetId = supportRow[2].trim();
      const factoryPriceRange = supportSettingsJson.factoryPriceRange || '';
      const openingTypeRange = supportSettingsJson.openingTypeRange || '';
      const planGroupRanges = supportSettingsJson.planGroupRanges || {};

      if (!factoryPriceRange) {
        console.warn(`[Direct] ${carrierParam} 이통사 지원금 설정에서 출고가 범위가 누락되었습니다.`);
        return []; // 빈 배열 반환
      }

      // 2. 정책표 시트에서 모델명, 펫네임 읽기 (기준 데이터)
      const [modelData, petNameData] = await Promise.all([
        modelRange ? sheets.spreadsheets.values.get({
          spreadsheetId: policySheetId,
          range: modelRange,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        }).then(r => r.data.values || []).catch(() => []) : Promise.resolve([]),
        petNameRange ? sheets.spreadsheets.values.get({
          spreadsheetId: policySheetId,
          range: petNameRange,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        }).then(r => r.data.values || []).catch(() => []) : Promise.resolve([])
      ]);

      // 모델명을 기준으로 다른 시트의 데이터를 매칭해야 함
      // 이통사 지원금 시트에서 모델명, 출고가, 개통유형 읽기 (모델명 기준으로 매칭)
      const supportModelRange = supportSettingsJson.modelRange || '';
      
      let supportSheetData = {}; // { key: { factoryPrice, openingType, openingTypes: [], rowIndex } }
      
      if (supportModelRange && factoryPriceRange && openingTypeRange) {
        try {
          // 이통사 지원금 시트에서 모델명, 출고가, 개통유형 읽기
          const [supportModelData, supportFactoryPriceData, supportOpeningTypeData] = await Promise.all([
            sheets.spreadsheets.values.get({
              spreadsheetId: supportSheetId,
              range: supportModelRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            }).then(r => r.data.values || []).catch(() => []),
            factoryPriceRange ? sheets.spreadsheets.values.get({
              spreadsheetId: supportSheetId,
              range: factoryPriceRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            }).then(r => r.data.values || []).catch(() => []) : Promise.resolve([]),
            openingTypeRange ? sheets.spreadsheets.values.get({
              spreadsheetId: supportSheetId,
              range: openingTypeRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            }).then(r => r.data.values || []).catch(() => []) : Promise.resolve([])
          ]);

          // 모델명을 키로 하는 맵 생성 (모델명 기준 매칭)
          const maxSupportRows = Math.max(
            supportModelData.length,
            supportFactoryPriceData.length,
            supportOpeningTypeData.length
          );
          
          // 1단계: 모델별로 모든 개통유형 수집
          const modelOpeningTypesMap = {}; // { model: [{ openingTypeRaw, openingTypes, rowIndex, factoryPrice }] }
          
          for (let j = 0; j < maxSupportRows; j++) {
            const supportModel = (supportModelData[j]?.[0] || '').toString().trim();
            if (!supportModel) continue;

            const openingTypeRaw = (supportOpeningTypeData[j]?.[0] || '').toString().trim();
            const openingTypes = parseOpeningTypes(openingTypeRaw);
            const factoryPrice = Number(supportFactoryPriceData[j]?.[0] || 0);
            
            if (!modelOpeningTypesMap[supportModel]) {
              modelOpeningTypesMap[supportModel] = [];
            }
            
            modelOpeningTypesMap[supportModel].push({
              openingTypeRaw,
              openingTypes,
              rowIndex: j,
              factoryPrice
            });
          }
          
          // 2단계: 전유형 처리 후 저장
          for (const [supportModel, entries] of Object.entries(modelOpeningTypesMap)) {
            // 같은 모델에 "번호이동"과 "010신규/기변"이 모두 있는지 확인
            const hasNumberPort = entries.some(e => 
              e.openingTypeRaw === '번호이동' || e.openingTypes.includes('번호이동')
            );
            const hasNewChange = entries.some(e => 
              e.openingTypeRaw === '010신규/기변' || 
              (e.openingTypes.includes('010신규') && e.openingTypes.includes('기변'))
            );
            const hasAllTypes = entries.some(e => 
              e.openingTypeRaw === '전유형' || e.openingTypes.includes('전유형')
            );
            
            // "번호이동"과 "010신규/기변"이 모두 있으면 전유형 무시
            const shouldIgnoreAllTypes = hasNumberPort && hasNewChange;
            
            for (const entryData of entries) {
              const { openingTypeRaw, openingTypes, rowIndex, factoryPrice } = entryData;
              
              // 전유형이고 무시해야 하면 스킵
              if (shouldIgnoreAllTypes && (openingTypeRaw === '전유형' || openingTypes.includes('전유형'))) {
                continue;
              }
              
              const entry = {
                factoryPrice,
                openingType: openingTypes[0] || '010신규',
                openingTypes,
                rowIndex
              };
              
              // 원본 모델명으로 저장 (개통유형 고려 없이, 폴백용)
              if (!supportSheetData[supportModel]) {
                supportSheetData[supportModel] = entry;
              }
              
              // 전유형인 경우 모든 개통유형에 매핑
              if (openingTypeRaw === '전유형' || openingTypes.includes('전유형')) {
                const allTypes = ['010신규', 'MNP', '기변', '번호이동'];
                allTypes.forEach(ot => {
                  const key = `${supportModel}|${ot}`;
                  supportSheetData[key] = entry;
                  
                  const normalizedModel = normalizeModelCode(supportModel);
                  if (normalizedModel) {
                    supportSheetData[`${normalizedModel}|${ot}`] = entry;
                    supportSheetData[`${normalizedModel.toLowerCase()}|${ot}`] = entry;
                    supportSheetData[`${normalizedModel.toUpperCase()}|${ot}`] = entry;
                  }
                  supportSheetData[`${supportModel.toLowerCase()}|${ot}`] = entry;
                  supportSheetData[`${supportModel.toUpperCase()}|${ot}`] = entry;
                });
              } else {
                // 모델명+개통유형 조합으로 저장 (정확한 매칭용)
                const normalizedModel = normalizeModelCode(supportModel);
                const hyphenVariants = generateHyphenVariants(supportModel);
                
                openingTypes.forEach(ot => {
                  // 원본 모델명
                  const key = `${supportModel}|${ot}`;
                  supportSheetData[key] = entry;
                  
                  // 대소문자 변형
                  supportSheetData[`${supportModel.toLowerCase()}|${ot}`] = entry;
                  supportSheetData[`${supportModel.toUpperCase()}|${ot}`] = entry;
                  
                  // 하이픈 변형 (원본 우선, 하이픈 변형은 폴백)
                  hyphenVariants.forEach(variant => {
                    if (variant !== supportModel) {
                      const variantKey = `${variant}|${ot}`;
                      if (!supportSheetData[variantKey]) {
                        supportSheetData[variantKey] = entry;
                      }
                      supportSheetData[`${variant.toLowerCase()}|${ot}`] = entry;
                      supportSheetData[`${variant.toUpperCase()}|${ot}`] = entry;
                    }
                  });
                  
                  // 정규화된 모델명 (마지막 폴백)
                  if (normalizedModel) {
                    const normalizedKey = `${normalizedModel}|${ot}`;
                    if (!supportSheetData[normalizedKey]) {
                      supportSheetData[normalizedKey] = entry;
                    }
                    supportSheetData[`${normalizedModel.toLowerCase()}|${ot}`] = entry;
                    supportSheetData[`${normalizedModel.toUpperCase()}|${ot}`] = entry;
                  }
                });
                
                // "번호이동" → MNP 매핑
                if (openingTypeRaw === '번호이동' || openingTypes.includes('번호이동')) {
                  const mnpKeys = [
                    `${supportModel}|MNP`,
                    `${supportModel.toLowerCase()}|MNP`,
                    `${supportModel.toUpperCase()}|MNP`
                  ];
                  if (normalizedModel) {
                    mnpKeys.push(
                      `${normalizedModel}|MNP`,
                      `${normalizedModel.toLowerCase()}|MNP`,
                      `${normalizedModel.toUpperCase()}|MNP`
                    );
                  }
                  mnpKeys.forEach(key => {
                    if (!supportSheetData[key]) {
                      supportSheetData[key] = entry;
                    }
                  });
                }
                
                // "010신규/기변" → 010신규와 기변 매핑
                if (openingTypeRaw === '010신규/기변' || 
                    (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                  // 원본 "010신규/기변" 키로도 저장
                  const originalKeys = [
                    `${supportModel}|010신규/기변`,
                    `${supportModel.toLowerCase()}|010신규/기변`,
                    `${supportModel.toUpperCase()}|010신규/기변`
                  ];
                  if (normalizedModel) {
                    originalKeys.push(
                      `${normalizedModel}|010신규/기변`,
                      `${normalizedModel.toLowerCase()}|010신규/기변`,
                      `${normalizedModel.toUpperCase()}|010신규/기변`
                    );
                  }
                  originalKeys.forEach(key => {
                    if (!supportSheetData[key]) {
                      supportSheetData[key] = entry;
                    }
                  });
                  
                  // "010신규"와 "기변"으로도 각각 저장
                  ['010신규', '기변'].forEach(ot => {
                    const key = `${supportModel}|${ot}`;
                    if (!supportSheetData[key]) {
                      supportSheetData[key] = entry;
                    }
                    if (normalizedModel) {
                      const normalizedKeys = [
                        `${normalizedModel}|${ot}`,
                        `${normalizedModel.toLowerCase()}|${ot}`,
                        `${normalizedModel.toUpperCase()}|${ot}`
                      ];
                      normalizedKeys.forEach(k => {
                        if (!supportSheetData[k]) {
                          supportSheetData[k] = entry;
                        }
                      });
                    }
                    const lowerUpperKeys = [
                      `${supportModel.toLowerCase()}|${ot}`,
                      `${supportModel.toUpperCase()}|${ot}`
                    ];
                    lowerUpperKeys.forEach(k => {
                      if (!supportSheetData[k]) {
                        supportSheetData[k] = entry;
                      }
                    });
                  });
                }
              }
              
              // 정규화/대소문자 변형 키로도 저장하여 매칭 강화 (폴백용)
              const normalizedModel = normalizeModelCode(supportModel);
              if (normalizedModel) {
                if (!supportSheetData[normalizedModel]) {
                  supportSheetData[normalizedModel] = entry;
                }
                if (!supportSheetData[normalizedModel.toLowerCase()]) {
                  supportSheetData[normalizedModel.toLowerCase()] = entry;
                }
                if (!supportSheetData[normalizedModel.toUpperCase()]) {
                  supportSheetData[normalizedModel.toUpperCase()] = entry;
                }
              }
              if (!supportSheetData[supportModel.toLowerCase()]) {
                supportSheetData[supportModel.toLowerCase()] = entry;
              }
              if (!supportSheetData[supportModel.toUpperCase()]) {
                supportSheetData[supportModel.toUpperCase()] = entry;
              }
            }
          }
        } catch (err) {
          console.warn('[Direct] 이통사 지원금 시트 데이터 읽기 실패:', err);
        }
      }

      // 3. 정책표 설정은 이미 위에서 읽었으므로 재사용
      // policyRow, policySettingsJson, policySheetId는 이미 선언됨

      // 4. 요금제군별 이통사지원금 범위 읽기 (모델명+개통유형 복합키 맵으로 저장)
      const planGroupSupportData = {}; // { '115군': { 'UIP17PR-256|MNP': 550000, ... } }
      const supportRanges = [];
      const supportRangeMap = {}; // range -> planGroup 매핑
      
      for (const [planGroup, range] of Object.entries(planGroupRanges)) {
        if (range) {
          supportRanges.push(range);
          supportRangeMap[range] = planGroup;
        } else {
          planGroupSupportData[planGroup] = {};
        }
      }
      
      if (supportRanges.length > 0) {
        try {
          const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: supportSheetId,
            ranges: supportRanges,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
          
          response.data.valueRanges.forEach((valueRange, index) => {
            const range = supportRanges[index];
            const planGroup = supportRangeMap[range];
            const supportValues = valueRange.values || [];
            
            // 범위 문자열에서 시작 행 번호 추출 (예: 'F9:F97' -> 9)
            // 시트 이름이 포함된 경우도 처리 (예: "'시트명'!F9:F97" -> 9)
            let startRow = 0;
            const rangeMatch = range.match(/(?:'[^']+'!)?[A-Z]+(\d+)/);
            if (rangeMatch) {
              startRow = parseInt(rangeMatch[1], 10) - 1; // 0-based index로 변환
            }
            
            // 모델명+개통유형 복합키 맵으로 변환
            // supportModelData와 supportOpeningTypeData의 해당 범위만 사용
            const supportMap = {};
            const maxRows = Math.min(
              supportModelData.length - startRow,
              supportOpeningTypeData.length - startRow,
              supportValues.length
            );
            
            for (let j = 0; j < maxRows; j++) {
              // 전체 시트의 startRow+j 인덱스 사용
              const modelIndex = startRow + j;
              const model = (supportModelData[modelIndex]?.[0] || '').toString().trim();
              if (!model) continue;
              
              const openingTypeRaw = (supportOpeningTypeData[modelIndex]?.[0] || '').toString().trim();
              const openingTypes = parseOpeningTypes(openingTypeRaw);
              const supportValue = Number((supportValues[j]?.[0] || 0).toString().replace(/,/g, '')) || 0;
              
              // 각 개통유형에 대해 복합키 생성
              if (openingTypeRaw === '전유형' || openingTypes.includes('전유형')) {
                // 전유형인 경우 모든 개통유형에 매핑
                ['010신규', 'MNP', '기변'].forEach(ot => {
                  const key = `${model}|${ot}`;
                  if (!supportMap[key]) {
                    supportMap[key] = supportValue;
                  }
                  // 대소문자 변형
                  supportMap[`${model.toLowerCase()}|${ot}`] = supportValue;
                  supportMap[`${model.toUpperCase()}|${ot}`] = supportValue;
                  // 정규화된 모델명
                  const normalizedModel = normalizeModelCode(model);
                  if (normalizedModel) {
                    supportMap[`${normalizedModel}|${ot}`] = supportValue;
                    supportMap[`${normalizedModel.toLowerCase()}|${ot}`] = supportValue;
                    supportMap[`${normalizedModel.toUpperCase()}|${ot}`] = supportValue;
                  }
                });
              } else {
                // 각 개통유형에 대해 복합키 생성
                openingTypes.forEach(ot => {
                  const key = `${model}|${ot}`;
                  if (!supportMap[key]) {
                    supportMap[key] = supportValue;
                  }
                  // 대소문자 변형
                  supportMap[`${model.toLowerCase()}|${ot}`] = supportValue;
                  supportMap[`${model.toUpperCase()}|${ot}`] = supportValue;
                  // 정규화된 모델명
                  const normalizedModel = normalizeModelCode(model);
                  if (normalizedModel) {
                    supportMap[`${normalizedModel}|${ot}`] = supportValue;
                    supportMap[`${normalizedModel.toLowerCase()}|${ot}`] = supportValue;
                    supportMap[`${normalizedModel.toUpperCase()}|${ot}`] = supportValue;
                  }
                });
                
                // "번호이동" → MNP 매핑
                if (openingTypeRaw === '번호이동' || openingTypes.includes('번호이동')) {
                  const mnpKeys = [
                    `${model}|MNP`,
                    `${model.toLowerCase()}|MNP`,
                    `${model.toUpperCase()}|MNP`
                  ];
                  const normalizedModel = normalizeModelCode(model);
                  if (normalizedModel) {
                    mnpKeys.push(
                      `${normalizedModel}|MNP`,
                      `${normalizedModel.toLowerCase()}|MNP`,
                      `${normalizedModel.toUpperCase()}|MNP`
                    );
                  }
                  mnpKeys.forEach(key => {
                    if (!supportMap[key]) {
                      supportMap[key] = supportValue;
                    }
                  });
                }
                
                // "010신규/기변" → 010신규와 기변 매핑
                if (openingTypeRaw === '010신규/기변' ||
                    (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                  ['010신규', '기변'].forEach(ot => {
                    const key = `${model}|${ot}`;
                    if (!supportMap[key]) {
                      supportMap[key] = supportValue;
                    }
                    supportMap[`${model.toLowerCase()}|${ot}`] = supportValue;
                    supportMap[`${model.toUpperCase()}|${ot}`] = supportValue;
                    const normalizedModel = normalizeModelCode(model);
                    if (normalizedModel) {
                      supportMap[`${normalizedModel}|${ot}`] = supportValue;
                      supportMap[`${normalizedModel.toLowerCase()}|${ot}`] = supportValue;
                      supportMap[`${normalizedModel.toUpperCase()}|${ot}`] = supportValue;
                    }
                  });
                }
              }
            }
            
            planGroupSupportData[planGroup] = supportMap;
          });
        } catch (err) {
          console.warn(`[Direct] 지원금 범위 batchGet 실패:`, err);
          // 실패 시 빈 객체로 초기화
          Object.keys(planGroupRanges).forEach(planGroup => {
            if (!planGroupSupportData[planGroup]) {
              planGroupSupportData[planGroup] = {};
            }
          });
        }
      }

      // 5. 정책표 설정에서 요금제군 & 유형별 리베이트 읽기 (모델명 기준 매핑)
      // { '115군': { '010신규': { 'SM-S926N256': 690000, ... }, 'MNP': { 'SM-S926N256': 700000, ... } } }
      const policyRebateData = {};
      const policyRebateDataByIndex = {}; // 폴백용: 인덱스 기반 배열도 유지
      
      if (policySheetId && policySettingsJson.planGroupRanges && modelRange) {
        // 정책표 시트에서 모델명 읽기
        let policyModelData = [];
        try {
          const modelResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: policySheetId,
            range: modelRange,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
          policyModelData = (modelResponse.data.values || []).map(row => 
            (row[0] || '').toString().trim()
          );
        } catch (err) {
          console.warn(`[Direct] 정책표 모델명 읽기 실패:`, err);
        }
        
        const rebateRanges = [];
        const rebateRangeMap = []; // [{ planGroup, openingType, range }]
        
        for (const [planGroup, typeRanges] of Object.entries(policySettingsJson.planGroupRanges)) {
          if (typeof typeRanges === 'object') {
            policyRebateData[planGroup] = {};
            policyRebateDataByIndex[planGroup] = {};
            for (const [openingType, range] of Object.entries(typeRanges)) {
              if (range) {
                rebateRanges.push(range);
                rebateRangeMap.push({ planGroup, openingType, range });
              } else {
                policyRebateData[planGroup][openingType] = {};
                policyRebateDataByIndex[planGroup][openingType] = [];
              }
            }
          }
        }
        
        if (rebateRanges.length > 0) {
          try {
            const response = await sheets.spreadsheets.values.batchGet({
              spreadsheetId: policySheetId,
              ranges: rebateRanges,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            });
            
            response.data.valueRanges.forEach((valueRange, index) => {
              const { planGroup, openingType } = rebateRangeMap[index];
              const values = (valueRange.values || []).map(row => 
                Number((row[0] || 0).toString().replace(/,/g, '')) * 10000
              );
              
              // 인덱스 기반 배열 저장 (폴백용)
              policyRebateDataByIndex[planGroup][openingType] = values;
              
              // 모델명 기준 맵 저장
              const rebateMap = {};
              const maxLen = Math.min(policyModelData.length, values.length);
              for (let i = 0; i < maxLen; i++) {
                const model = policyModelData[i];
                if (model) {
                  // 원본 모델명으로 저장
                  rebateMap[model] = values[i] || 0;
                  
                  // 정규화된 모델명으로도 저장
                  const normalizedModel = normalizeModelCode(model);
                  if (normalizedModel && normalizedModel !== model) {
                    rebateMap[normalizedModel] = values[i] || 0;
                    rebateMap[normalizedModel.toLowerCase()] = values[i] || 0;
                    rebateMap[normalizedModel.toUpperCase()] = values[i] || 0;
                  }
                  rebateMap[model.toLowerCase()] = values[i] || 0;
                  rebateMap[model.toUpperCase()] = values[i] || 0;
                }
              }
              policyRebateData[planGroup][openingType] = rebateMap;
            });
          } catch (err) {
            console.warn(`[Direct] 리베이트 범위 batchGet 실패:`, err);
            // 실패 시 빈 객체로 초기화
            rebateRangeMap.forEach(({ planGroup, openingType }) => {
              if (!policyRebateData[planGroup][openingType]) {
                policyRebateData[planGroup][openingType] = {};
                policyRebateDataByIndex[planGroup][openingType] = [];
              }
            });
          }
        }
      }

      // 6. 정책설정에서 마진, 부가서비스, 보험상품, 별도정책 정보 읽기 (병렬 처리로 최적화)
      const [marginRes, addonRes, insuranceRes, specialRes] = await Promise.all([
        ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN)
          .then(() => sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_MARGIN
          })),
        ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON, HEADERS_POLICY_ADDON)
          .then(() => sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_ADDON
          })),
        ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_INSURANCE, HEADERS_POLICY_INSURANCE)
          .then(() => sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_INSURANCE
          })),
        ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL, HEADERS_POLICY_SPECIAL)
          .then(() => sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_SPECIAL
          }))
      ]);
      
      const marginRows = (marginRes.data.values || []).slice(1);
      const marginRow = marginRows.find(row => (row[0] || '').trim() === carrierParam);
      const baseMargin = marginRow ? Number(marginRow[1] || 0) : 50000;

      const addonRows = (addonRes.data.values || []).slice(1);
      const addonList = addonRows
        .filter(row => (row[0] || '').trim() === carrierParam)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          fee: Number(row[2] || 0),
          incentive: Number(row[3] || 0), // 부가유치 추가금액
          deduction: -Math.abs(Number(row[4] || 0))  // 부가미유치 차감금액 (음수 처리)
        }));
      
      const requiredAddons = addonList
        .filter(addon => addon.deduction < 0)  // 차감금액이 음수인 경우 (미유치 시 차감되는 부가서비스)
        .map(addon => addon.name);

      const insuranceRows = (insuranceRes.data.values || []).slice(1);
      const insuranceList = insuranceRows
        .filter(row => (row[0] || '').trim() === carrierParam)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          minPrice: Number(row[2] || 0),
          maxPrice: Number(row[3] || 0),
          fee: Number(row[4] || 0),
          incentive: Number(row[5] || 0), // 보험 유치 추가금액
          deduction: -Math.abs(Number(row[6] || 0))  // 보험 미유치 차감금액 (음수 처리)
        }));

      const specialRows = (specialRes.data.values || []).slice(1);
      const specialPolicies = specialRows
        .filter(row => (row[0] || '').trim() === carrierParam && (row[4] || '').toString().toLowerCase() === 'true')
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          addition: Number(row[2] || 0), // 추가금액
          deduction: Number(row[3] || 0)  // 차감금액
        }));
      
      // 부가서비스 + 보험상품 추가금액 합계 (부가유치)
      const totalAddonIncentive = addonList.reduce((sum, addon) => sum + (addon.incentive || 0), 0) +
                                  insuranceList.reduce((sum, insurance) => sum + (insurance.incentive || 0), 0);
      // 부가서비스 + 보험상품 차감금액 합계 (부가미유치)
      const totalAddonDeduction = addonList.reduce((sum, addon) => sum + (addon.deduction || 0), 0) +
                                  insuranceList.reduce((sum, insurance) => sum + (insurance.deduction || 0), 0);
      
      // 별도정책 추가금액 합계
      const totalSpecialAddition = specialPolicies.reduce((sum, policy) => sum + (policy.addition || 0), 0);
      // 별도정책 차감금액 합계
      const totalSpecialDeduction = specialPolicies.reduce((sum, policy) => sum + (policy.deduction || 0), 0);

      // 7. 직영점_모델이미지 시트와 직영점_오늘의휴대폰 시트 병렬 읽기 (최적화)
      // 컬럼 구조: 통신사(A) | 모델ID(B) | 모델명(C) | 펫네임(D) | 제조사(E) | 이미지URL(F) | 비고(G)
      const [imageRes, todaysRes] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '직영점_모델이미지!A:G'
        }).catch(() => ({ data: { values: [] } })),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '직영점_오늘의휴대폰!A:Z'
        }).catch(() => ({ data: { values: [] } }))
      ]);
      
      const imageRows = (imageRes.data.values || []).slice(1);
      const imageMap = new Map();
      imageRows.forEach(row => {
        // 통신사(A열, 인덱스 0), 모델ID(B열, 인덱스 1), 모델명(C열, 인덱스 2), 이미지URL(F열, 인덱스 5) 매핑
        const rowCarrier = (row[0] || '').trim();
        const modelId = (row[1] || '').trim(); // 모델ID (실제 모델 코드)
        const modelName = (row[2] || '').trim(); // 모델명 (모델ID와 동일)
        const imageUrl = (row[5] || '').trim();
        
        // 이미지 URL이 없으면 건너뛰기
        if (!imageUrl) {
          return;
        }
        
        // 통신사 필터링: 현재 조회 중인 통신사와 정확히 일치하는 경우만 매핑
        // 통신사가 비어있으면 해당 행을 건너뛰어 잘못된 매핑 방지
        if (!rowCarrier) {
          console.log(`[Direct] ⚠️ 통신사가 비어있는 이미지 행 건너뛰기: 모델ID=${modelId}, 모델명=${modelName}`);
          return;
        }
        
        // 통신사가 일치하는 경우만 매핑
        if (rowCarrier === carrierParam) {
          // 모델ID와 모델명 중 하나라도 있으면 사용 (둘 다 실제 모델 코드와 동일)
          const actualModelCode = modelId || modelName;
          
          if (actualModelCode) {
            // 원본 모델 코드로 키 생성 (정확한 매칭)
            const key = `${carrierParam}:${actualModelCode}`;
            imageMap.set(key, imageUrl);
            imageMap.set(actualModelCode, imageUrl);
            
            // 정규화된 모델 코드로도 키 생성 (형식 차이 무시)
            const normalizedCode = normalizeModelCode(actualModelCode);
            if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
              const normalizedKey = `${carrierParam}:${normalizedCode}`;
              imageMap.set(normalizedKey, imageUrl);
              imageMap.set(normalizedCode, imageUrl);
            }
          } else {
            console.log(`[Direct] ⚠️ 모델코드가 없는 이미지 행 건너뛰기: 통신사=${rowCarrier}`);
          }
        }
      });
      
      console.log(`[Direct] 이미지 맵 크기: ${imageMap.size}, 통신사: ${carrierParam}`);
      // 디버깅: 이미지 맵의 키들 출력 (처음 20개)
      if (imageMap.size > 0) {
        const mapKeys = Array.from(imageMap.keys());
        console.log(`[Direct] 이미지 맵 키 전체 (${mapKeys.length}개):`, mapKeys);
      } else {
        console.warn(`[Direct] 이미지 맵이 비어있습니다. 통신사: ${carrierParam}`);
      }

      // 8. 직영점_오늘의휴대폰 시트에서 구분(인기/추천/저렴/프리미엄/중저가) 태그 읽기
      let tagMap = new Map(); // { model: { isPopular, isRecommended, isCheap, isPremium, isBudget } }
      try {
        const todaysRows = (todaysRes.data.values || []).slice(1);
        todaysRows.forEach(row => {
          if (row[0]) { // 모델명
            const model = (row[0] || '').trim();
            const normalizedModel = normalizeModelCode(model);
            const tagData = {
              isPopular: (row[9] || '').toString().toUpperCase() === 'Y' || (row[9] || '').toString().toUpperCase() === 'TRUE',
              isRecommended: (row[10] || '').toString().toUpperCase() === 'Y' || (row[10] || '').toString().toUpperCase() === 'TRUE',
              isCheap: (row[11] || '').toString().toUpperCase() === 'Y' || (row[11] || '').toString().toUpperCase() === 'TRUE',
              isPremium: (row[12] || '').toString().toUpperCase() === 'Y' || (row[12] || '').toString().toUpperCase() === 'TRUE',
              isBudget: (row[13] || '').toString().toUpperCase() === 'Y' || (row[13] || '').toString().toUpperCase() === 'TRUE'
            };
            // 원본 모델명과 정규화된 모델명 모두 키로 저장 (매칭 강화)
            tagMap.set(model, tagData);
            // 대소문자 변형도 저장
            tagMap.set(model.toLowerCase(), tagData);
            tagMap.set(model.toUpperCase(), tagData);
            if (normalizedModel) {
              tagMap.set(normalizedModel, tagData);
              // 정규화된 모델명의 대소문자 변형도 저장
              if (normalizedModel !== model.toLowerCase()) {
                tagMap.set(normalizedModel.toLowerCase(), tagData);
                tagMap.set(normalizedModel.toUpperCase(), tagData);
              }
            }
          }
        });
        console.log(`[Direct] 태그 맵 크기: ${tagMap.size}, 통신사: ${carrierParam}`);
        // UIP 관련 모델명이 있는지 확인
        const uipKeys = Array.from(tagMap.keys()).filter(k => k.includes('UIP') || k.includes('uip'));
        if (uipKeys.length > 0) {
          console.log(`[Direct] UIP 관련 태그 키:`, uipKeys);
        }
      } catch (err) {
        console.warn('[Direct] 직영점_오늘의휴대폰 시트 읽기 실패:', err);
      }

      // 9. 데이터 조합 (모델명 기준으로 매칭)
      const maxRows = Math.max(modelData.length, petNameData.length);
      const mobileList = [];
      
      // 디버깅 대상 모델 목록 (이통사지원금 + 대리점지원금 문제 모델)
      const debugTargetModels = [
        'SM-S926N256', 'SM-S926N512', 'SM-S928N256', 'SM-S928N512',
        'UIP17-256', 'UIP17-512', 'UIPA-256', 'UIPA-512', 'UIPA-1T',
        'UIP17PR-256', 'UIP17PR-512', 'UIP17PR-1T',
        'SM-F766N256', 'SM-S731N', 'SM-S937N256', 'SM-A166L', 
        'A2633-128', 'AT-M140L'
      ];
      
      // 디버깅 대상 모델인지 확인하는 헬퍼 함수
      const isDebugTarget = (modelName) => {
        const normalizedModel = normalizeModelCode(modelName);
        return debugTargetModels.some(pm => 
          modelName === pm || modelName.toLowerCase() === pm.toLowerCase() || 
          (normalizedModel && normalizedModel.toLowerCase() === pm.toLowerCase())
        );
      };
      
      for (let i = 0; i < maxRows; i++) {
        const model = (modelData[i]?.[0] || '').toString().trim();
        if (!model) continue; // 빈 행 스킵

        const petName = (petNameData[i]?.[0] || model).toString().trim();
        
        // 모델명을 기준으로 이통사 지원금 시트에서 데이터 찾기
        // 매칭 순서: 원본 → 대소문자 변형 → 하이픈 변형 → 정규화
        const normalizedModel = normalizeModelCode(model);
        let supportData = supportSheetData[model] || // 원본 최우선
          supportSheetData[model.toLowerCase()] ||
          supportSheetData[model.toUpperCase()];
        
        // 하이픈 변형 시도
        if (!supportData) {
          const hyphenVariants = generateHyphenVariants(model);
          for (const variant of hyphenVariants) {
            if (variant !== model) {
              supportData = supportSheetData[variant] ||
                supportSheetData[variant.toLowerCase()] ||
                supportSheetData[variant.toUpperCase()];
              if (supportData) break;
            }
          }
        }
        
        // 정규화된 모델명 (마지막 폴백)
        if (!supportData && normalizedModel) {
          supportData = supportSheetData[normalizedModel] ||
            supportSheetData[normalizedModel.toLowerCase()] ||
            supportSheetData[normalizedModel.toUpperCase()];
        }
        if (!supportData) {
          console.warn(`[Direct] 모델명 ${model}에 대한 이통사 지원금 데이터를 찾을 수 없습니다. 기본값(0)으로 계속 진행합니다.`);
          supportData = {
            factoryPrice: 0,
            openingType: '010신규',
            openingTypes: ['010신규'],
            rowIndex: i // 요금제군별 지원금 매칭 기본값
          };
        }
        
        const factoryPrice = supportData.factoryPrice || 0;
        const openingTypeStr = supportData.openingType || '';
        const openingTypeList = supportData.openingTypes && supportData.openingTypes.length > 0
          ? supportData.openingTypes
          : parseOpeningTypes(openingTypeStr);
        const supportRowIndex = supportData.rowIndex || i; // 요금제군별 지원금 매칭용

        // 출고가에 맞는 보험상품 찾기
        const matchingInsurance = insuranceList.find(insurance => {
          const minPrice = insurance.minPrice || 0;
          const maxPrice = insurance.maxPrice || 9999999;
          return factoryPrice >= minPrice && factoryPrice <= maxPrice;
        });
        const insuranceFee = matchingInsurance ? matchingInsurance.fee : 0;
        const insuranceName = matchingInsurance ? matchingInsurance.name : '';
        
        // 개통유형을 표준화 (010신규, MNP, 기변)
        let openingType = openingTypeList[0] || '010신규';

        // 구분 태그 가져오기 (원본 모델명, 정규화된 모델명, 대소문자 변형 모두 시도)
        // 요금제군 선택을 위해 먼저 태그를 가져와야 함
        let tags = tagMap.get(model) || {};
        if (!tags || Object.keys(tags).length === 0) {
          // 대소문자 변형 시도
          tags = tagMap.get(model.toLowerCase()) || tagMap.get(model.toUpperCase()) || {};
        }
        if (!tags || Object.keys(tags).length === 0) {
          // 정규화된 모델명으로 시도
          const normalizedModel = normalizeModelCode(model);
          if (normalizedModel) {
            tags = tagMap.get(normalizedModel) || tagMap.get(normalizedModel.toLowerCase()) || tagMap.get(normalizedModel.toUpperCase()) || {};
          }
        }
        // 여전히 찾지 못했으면 유사 매칭 시도
        if ((!tags || Object.keys(tags).length === 0) && tagMap.size > 0) {
          const modelLower = model.toLowerCase();
          const normalizedModel = normalizeModelCode(model);
          const normalizedModelLower = normalizedModel ? normalizedModel.toLowerCase() : '';
          
          for (const [key, value] of tagMap.entries()) {
            const keyLower = key.toLowerCase();
            // 정확한 일치 또는 포함 관계 확인
            if (keyLower === modelLower || 
                keyLower === normalizedModelLower ||
                (normalizedModelLower && (keyLower.includes(normalizedModelLower) || normalizedModelLower.includes(keyLower))) ||
                (modelLower && (keyLower.includes(modelLower) || modelLower.includes(keyLower)))) {
              tags = value;
              break;
            }
          }
        }

        // 요금제군 선택: 각 모델의 태그 기반으로 정확한 값 결정 (프론트엔드 기본값 무시)
        const planGroupKeys = Object.keys(planGroupRanges || {});
        const isBudget = tags.isBudget === true && tags.isPremium !== true;
        let selectedPlanGroup = planGroupKeys[0];
        
        // 각 모델의 태그 기반으로 요금제군 결정
        if (isBudget && planGroupRanges['33군']) {
          selectedPlanGroup = '33군';
        } else if (planGroupRanges['115군']) {
          selectedPlanGroup = '115군';
        }
        // 정책표 리베이트 가져오기 (요금제군 & 유형별, 모델명 기준 매핑)
        // 로드 전 기본값: 태그와 관계없이 항상 MNP 사용
        let policyRebate = 0;
        const defaultOpeningTypeForRebate = 'MNP'; // 로드 전 기본값: MNP
        let matchedOpeningType = defaultOpeningTypeForRebate; // 이통사지원금 매칭에 사용할 개통유형
        const rebateDebugInfo = {
          model,
          normalizedModel,
          selectedPlanGroup,
          candidateTypes: [],
          matched: false,
          matchedKey: null,
          matchedValue: null,
          fallbackUsed: false
        };
        
        if (selectedPlanGroup && policyRebateData[selectedPlanGroup]) {
          // 정책표에 실제로 있는 개통유형 확인
          const availableTypes = Object.keys(policyRebateData[selectedPlanGroup] || {});
          
          // 로드 전 기본값(MNP)을 최우선으로 사용
          // 그 다음 정책표에 있는 개통유형
          let candidateTypes = [];
          
          // 로드 전 기본값: MNP 최우선
          candidateTypes.push(defaultOpeningTypeForRebate);
          
          // "번호이동"과 "MNP" 양방향 매칭
          if (!candidateTypes.includes('번호이동')) {
            candidateTypes.push('번호이동');
          }
          
          // 정책표에 있는 개통유형 추가 (보조)
          candidateTypes.push(...availableTypes);
          
          // 중복 제거
          candidateTypes = candidateTypes.filter((v, i, arr) => arr.indexOf(v) === i);
          
          // 후보가 없으면 기본값
          if (candidateTypes.length === 0) {
            candidateTypes.push('010신규');
          }
          
          rebateDebugInfo.candidateTypes = candidateTypes;
          let matched = false;
          
          // 모델명 기준으로 리베이트 찾기
          for (const ot of candidateTypes) {
            const rebateMap = policyRebateData[selectedPlanGroup]?.[ot];
            if (rebateMap && typeof rebateMap === 'object') {
              // 모델명으로 직접 찾기
              let rebateValue = rebateMap[model];
              let matchedKey = model;
              
              if (rebateValue === undefined) {
                rebateValue = rebateMap[model.toLowerCase()];
                matchedKey = model.toLowerCase();
              }
              if (rebateValue === undefined) {
                rebateValue = rebateMap[model.toUpperCase()];
                matchedKey = model.toUpperCase();
              }
              if (rebateValue === undefined && normalizedModel) {
                rebateValue = rebateMap[normalizedModel];
                matchedKey = normalizedModel;
              }
              if (rebateValue === undefined && normalizedModel) {
                rebateValue = rebateMap[normalizedModel.toLowerCase()];
                matchedKey = normalizedModel.toLowerCase();
              }
              if (rebateValue === undefined && normalizedModel) {
                rebateValue = rebateMap[normalizedModel.toUpperCase()];
                matchedKey = normalizedModel.toUpperCase();
              }
              
              if (rebateValue !== undefined) {
                policyRebate = rebateValue || 0;
                matchedOpeningType = ot;
                matched = true;
                rebateDebugInfo.matched = true;
                rebateDebugInfo.matchedKey = `${matchedKey} (개통유형: ${ot})`;
                rebateDebugInfo.matchedValue = policyRebate;
                break;
              }
            }
          }
          
          // 모델명 기준 매칭 실패 시 인덱스 기반 폴백 (하위 호환)
          if (!matched && policyRebateDataByIndex[selectedPlanGroup]) {
            rebateDebugInfo.fallbackUsed = true;
            for (const ot of candidateTypes) {
              if (policyRebateDataByIndex[selectedPlanGroup]?.[ot]?.[i] !== undefined) {
                policyRebate = policyRebateDataByIndex[selectedPlanGroup][ot][i] || 0;
                matchedOpeningType = ot;
                matched = true;
                rebateDebugInfo.matched = true;
                rebateDebugInfo.matchedKey = `인덱스[${i}] (개통유형: ${ot}, 폴백)`;
                rebateDebugInfo.matchedValue = policyRebate;
                break;
              }
            }
            if (!matched && policyRebateDataByIndex[selectedPlanGroup]?.['010신규']?.[i] !== undefined) {
              policyRebate = policyRebateDataByIndex[selectedPlanGroup]['010신규'][i] || 0;
              matchedOpeningType = '010신규';
              rebateDebugInfo.matched = true;
              rebateDebugInfo.matchedKey = `인덱스[${i}] (개통유형: 010신규, 폴백)`;
              rebateDebugInfo.matchedValue = policyRebate;
            }
          }
        }
        
        // 정책표 리베이트 매칭 디버깅 로그 (대리점지원금 문제 모델만)
        const storeSupportProblemModels = [
          'SM-F766N256', 'SM-S731N', 'SM-S937N256', 'SM-A166L', 
          'UIP17PR-256', 'A2633-128', 'AT-M140L'
        ];
        const shouldLogRebate = storeSupportProblemModels.some(pm => 
          model === pm || model.toLowerCase() === pm.toLowerCase() || 
          (normalizedModel && normalizedModel.toLowerCase() === pm.toLowerCase())
        );
        
        if (shouldLogRebate) {
          if (!rebateDebugInfo.matched) {
            console.warn(`[Direct] ⚠️ 정책표 리베이트 매칭 실패:`, {
              모델명: model,
              정규화된모델명: normalizedModel,
              요금제군: selectedPlanGroup,
              시도한개통유형: rebateDebugInfo.candidateTypes,
              정책표데이터존재: !!policyRebateData[selectedPlanGroup]
            });
          } else {
            console.log(`[Direct] ✅ 정책표 리베이트 매칭 성공:`, {
              모델명: model,
              요금제군: selectedPlanGroup,
              개통유형: matchedOpeningType,
              매칭키: rebateDebugInfo.matchedKey,
              리베이트금액: policyRebate,
              폴백사용: rebateDebugInfo.fallbackUsed
            });
          }
        }

        // 모델명+개통유형 조합으로 정확한 이통사지원금 행 찾기
        let finalSupportData = supportData;
        let finalSupportRowIndex = supportRowIndex;
        
        // 이통사지원금 매칭에 사용할 개통유형: 초기 로드 시 기본값(MNP) 우선 사용
        // 정책표 리베이트 매칭 결과는 참고용으로만 사용
        // 초기 로드 시 프론트엔드 기본값은 항상 MNP이므로, MNP를 먼저 시도
        const defaultOpeningTypeForSupport = 'MNP';
        
        const supportDebugInfo = {
          model,
          normalizedModel,
          matchedOpeningType: matchedOpeningType,
          initialRowIndex: supportRowIndex,
          matchedKey: null,
          finalRowIndex: null,
          found: false,
          triedOpeningTypes: []
        };
        
        // 시도할 개통유형 순서: MNP 우선, 그 다음 정책표 매칭 결과, 그 다음 다른 개통유형
        const tryOpeningTypes = [defaultOpeningTypeForSupport];
        if (matchedOpeningType && matchedOpeningType !== defaultOpeningTypeForSupport) {
          tryOpeningTypes.push(matchedOpeningType);
        }
        // 다른 개통유형도 추가 (010신규, 기변)
        if (!tryOpeningTypes.includes('010신규')) tryOpeningTypes.push('010신규');
        if (!tryOpeningTypes.includes('기변')) tryOpeningTypes.push('기변');
        
        // 각 개통유형을 순서대로 시도
        let supportOpeningType = null;
        for (const tryType of tryOpeningTypes) {
          supportDebugInfo.triedOpeningTypes.push(tryType);
          
          // normalizedModel은 이미 위에서 선언됨 (1467번 라인)
          // 매칭 순서: 원본 → 대소문자 변형 → 하이픈 변형 → 정규화
          const candidateKeys = [
            `${model}|${tryType}`, // 원본 최우선
            `${model.toLowerCase()}|${tryType}`,
            `${model.toUpperCase()}|${tryType}`,
          ];
          
          // 하이픈 변형 추가 (원본 매칭 실패 시 시도)
          const hyphenVariants = generateHyphenVariants(model);
          hyphenVariants.forEach(variant => {
            if (variant !== model) {
              candidateKeys.push(
                `${variant}|${tryType}`,
                `${variant.toLowerCase()}|${tryType}`,
                `${variant.toUpperCase()}|${tryType}`
              );
            }
          });
          
          // 정규화된 모델명 (마지막 폴백)
          if (normalizedModel) {
            candidateKeys.push(
              `${normalizedModel}|${tryType}`,
              `${normalizedModel.toLowerCase()}|${tryType}`,
              `${normalizedModel.toUpperCase()}|${tryType}`
            );
          }
          
          let foundForThisType = false;
          for (const key of candidateKeys) {
            if (supportSheetData[key]) {
              finalSupportData = supportSheetData[key];
              finalSupportRowIndex = finalSupportData.rowIndex;
              supportDebugInfo.matchedKey = key;
              supportDebugInfo.found = true;
              supportOpeningType = tryType;
              foundForThisType = true;
              break;
            }
          }
          
          if (foundForThisType) break;
          
          // "번호이동"과 "MNP" 양방향 매칭
          if (tryType === 'MNP') {
            const mnpKeys = [
              `${model}|번호이동`, // 원본 최우선
              `${model.toLowerCase()}|번호이동`,
              `${model.toUpperCase()}|번호이동`,
            ];
            
            // 하이픈 변형 추가
            const hyphenVariants = generateHyphenVariants(model);
            hyphenVariants.forEach(variant => {
              if (variant !== model) {
                mnpKeys.push(
                  `${variant}|번호이동`,
                  `${variant.toLowerCase()}|번호이동`,
                  `${variant.toUpperCase()}|번호이동`
                );
              }
            });
            
            // 정규화된 모델명 (마지막 폴백)
            if (normalizedModel) {
              mnpKeys.push(
                `${normalizedModel}|번호이동`,
                `${normalizedModel.toLowerCase()}|번호이동`,
                `${normalizedModel.toUpperCase()}|번호이동`
              );
            }
            
            for (const key of mnpKeys) {
              if (supportSheetData[key]) {
                finalSupportData = supportSheetData[key];
                finalSupportRowIndex = finalSupportData.rowIndex;
                supportDebugInfo.matchedKey = key;
                supportDebugInfo.found = true;
                supportOpeningType = 'MNP';
                foundForThisType = true;
                break;
              }
            }
            if (foundForThisType) break;
          }
          
          // "010신규/기변" 매칭
          if (tryType === '010신규' || tryType === '기변') {
            const combinedKeys = [
              `${model}|010신규/기변`, // 원본 최우선
              `${model.toLowerCase()}|010신규/기변`,
              `${model.toUpperCase()}|010신규/기변`,
            ];
            
            // 하이픈 변형 추가
            const hyphenVariants = generateHyphenVariants(model);
            hyphenVariants.forEach(variant => {
              if (variant !== model) {
                combinedKeys.push(
                  `${variant}|010신규/기변`,
                  `${variant.toLowerCase()}|010신규/기변`,
                  `${variant.toUpperCase()}|010신규/기변`
                );
              }
            });
            
            // 정규화된 모델명 (마지막 폴백)
            if (normalizedModel) {
              combinedKeys.push(
                `${normalizedModel}|010신규/기변`,
                `${normalizedModel.toLowerCase()}|010신규/기변`,
                `${normalizedModel.toUpperCase()}|010신규/기변`
              );
            }
            
            for (const key of combinedKeys) {
              if (supportSheetData[key]) {
                finalSupportData = supportSheetData[key];
                finalSupportRowIndex = finalSupportData.rowIndex;
                supportDebugInfo.matchedKey = key;
                supportDebugInfo.found = true;
                supportOpeningType = tryType;
                foundForThisType = true;
                break;
              }
            }
            if (foundForThisType) break;
          }
        }
        
        // 매칭된 개통유형이 없으면 기본값 사용
        if (!supportOpeningType) {
          supportOpeningType = defaultOpeningTypeForSupport;
        }

        supportDebugInfo.finalRowIndex = finalSupportRowIndex;
        
        let publicSupport = 0;
        // 모델명+개통유형 복합키로 요금제군별 이통사지원금 직접 조회
        if (selectedPlanGroup && planGroupSupportData[selectedPlanGroup]) {
          // 시도할 키 목록: 원본 → 대소문자 변형 → 하이픈 변형 → 정규화
          const supportKeys = [
            `${model}|${supportOpeningType}`, // 원본 최우선
            `${model.toLowerCase()}|${supportOpeningType}`,
            `${model.toUpperCase()}|${supportOpeningType}`
          ];
          
          // 하이픈 변형 추가
          const hyphenVariants = generateHyphenVariants(model);
          hyphenVariants.forEach(variant => {
            if (variant !== model) {
              supportKeys.push(
                `${variant}|${supportOpeningType}`,
                `${variant.toLowerCase()}|${supportOpeningType}`,
                `${variant.toUpperCase()}|${supportOpeningType}`
              );
            }
          });
          
          // 정규화된 모델명 (마지막 폴백)
          if (normalizedModel) {
            supportKeys.push(
              `${normalizedModel}|${supportOpeningType}`,
              `${normalizedModel.toLowerCase()}|${supportOpeningType}`,
              `${normalizedModel.toUpperCase()}|${supportOpeningType}`
            );
          }
          
          // 키를 순서대로 시도하여 값 찾기
          let foundKey = null;
          for (const key of supportKeys) {
            if (planGroupSupportData[selectedPlanGroup][key] !== undefined) {
              publicSupport = Number(planGroupSupportData[selectedPlanGroup][key]) || 0;
              foundKey = key;
              break;
            }
          }
          
          // 디버깅: 문제 모델에 대해 상세 로그
          const carrierSupportProblemModels = [
            'SM-S926N256', 'SM-S926N512', 'SM-S928N256', 'SM-S928N512',
            'UIP17-256', 'UIP17-512', 'UIPA-256', 'UIPA-512', 'UIPA-1T',
            'UIP17PR-256', 'UIP17PR-512', 'UIP17PR-1T'
          ];
          const shouldLog = carrierSupportProblemModels.some(pm => 
            model === pm || model.toLowerCase() === pm.toLowerCase() || 
            (normalizedModel && normalizedModel.toLowerCase() === pm.toLowerCase())
          );
          
          if (shouldLog) {
            if (!foundKey) {
              console.warn(`[Direct] ⚠️ planGroupSupportData에서 키를 찾을 수 없음:`, {
                모델명: model,
                요금제군: selectedPlanGroup,
                개통유형: supportOpeningType,
                시도한키: supportKeys.slice(0, 5),
                맵에있는키수: Object.keys(planGroupSupportData[selectedPlanGroup] || {}).length,
                맵에있는키샘플: Object.keys(planGroupSupportData[selectedPlanGroup] || {}).slice(0, 5)
              });
            } else {
              console.log(`[Direct] ✅ planGroupSupportData에서 값 찾음:`, {
                모델명: model,
                요금제군: selectedPlanGroup,
                개통유형: supportOpeningType,
                찾은키: foundKey,
                이통사지원금: publicSupport
              });
            }
          }
        }
        
        // 이통사지원금 매칭 디버깅 로그 (이통사지원금 문제 모델만)
        const carrierSupportProblemModels = [
          'SM-S926N256', 'SM-S926N512', 'SM-S928N256', 'SM-S928N512',
          'UIP17-256', 'UIP17-512', 'UIPA-256', 'UIPA-512', 'UIPA-1T',
          'UIP17PR-256', 'UIP17PR-512', 'UIP17PR-1T'
        ];
        // 이통사지원금 문제 모델은 모든 개통유형에서 로그 출력
        const shouldLogCarrierSupport = carrierSupportProblemModels.some(pm => 
          model === pm || model.toLowerCase() === pm.toLowerCase() || 
          (normalizedModel && normalizedModel.toLowerCase() === pm.toLowerCase())
        );
        
        if (shouldLogCarrierSupport) {
          if (!supportDebugInfo.found) {
            console.warn(`[Direct] ⚠️ 이통사지원금 매칭 실패:`, {
              모델명: model,
              정규화된모델명: normalizedModel,
              최종개통유형: supportOpeningType,
              정책표매칭개통유형: matchedOpeningType,
              시도한개통유형: supportDebugInfo.triedOpeningTypes,
              초기행인덱스: supportDebugInfo.initialRowIndex,
              이통사지원금데이터존재: !!supportSheetData[model]
            });
          } else {
            console.log(`[Direct] ✅ 이통사지원금 매칭 성공:`, {
              모델명: model,
              최종개통유형: supportOpeningType,
              정책표매칭개통유형: matchedOpeningType,
              시도한개통유형: supportDebugInfo.triedOpeningTypes,
              매칭키: supportDebugInfo.matchedKey,
              행인덱스: finalSupportRowIndex,
              이통사지원금: publicSupport
            });
          }
        }

        // 대리점 지원금 계산
        // 부가유치: 정책표리베이트 - 마진 + 부가서비스추가금액 + 별도정책추가금액
        const storeSupportWithAddon = Math.max(0,
          policyRebate        // 정책표 요금제군별 리베이트
          - baseMargin         // 마진 (차감)
          + totalAddonIncentive // 부가서비스 추가금액
          + totalSpecialAddition // 별도정책 추가금액
        );
        // 부가미유치: 정책표리베이트 - 마진 + 부가서비스차감금액 + 별도정책차감금액
        const storeSupportWithoutAddon = Math.max(0,
          policyRebate        // 정책표 요금제군별 리베이트
          - baseMargin         // 마진 (차감)
          + totalAddonDeduction // 부가서비스 차감금액
          + totalSpecialDeduction // 별도정책 차감금액
        );
        
        // 최종 계산값 디버깅 로그 (대리점지원금 문제 모델만)
        if (shouldLogRebate) {
          console.log(`[Direct] 💰 최종 계산값:`, {
            모델명: model,
            펫네임: petName,
            요금제군: selectedPlanGroup,
            개통유형: supportOpeningType,
            정책표매칭개통유형: matchedOpeningType,
            출고가: factoryPrice,
            이통사지원금: publicSupport,
            정책표리베이트: policyRebate,
            마진: baseMargin,
            부가서비스추가: totalAddonIncentive,
            부가서비스차감: totalAddonDeduction,
            별도정책추가: totalSpecialAddition,
            별도정책차감: totalSpecialDeduction,
            대리점지원금_부가유치: storeSupportWithAddon,
            대리점지원금_부가미유치: storeSupportWithoutAddon,
            계산상세_부가유치: `${policyRebate} - ${baseMargin} + ${totalAddonIncentive} + ${totalSpecialAddition} = ${storeSupportWithAddon}`,
            계산상세_부가미유치: `${policyRebate} - ${baseMargin} + ${totalAddonDeduction} + ${totalSpecialDeduction} = ${storeSupportWithoutAddon}`
          });
        }

        // 구매가 계산
        // 대리점추가지원금에 이미 정책표리베이트, 마진, 부가서비스, 별도정책이 포함되어 있으므로
        // 구매가 = 출고가 - 이통사지원금 - 대리점추가지원금
        const purchasePriceWithAddon = Math.max(0, 
          factoryPrice 
          - publicSupport       // 이통사지원금 요금제구간별
          - storeSupportWithAddon  // 대리점추가지원금 (정책표리베이트 - 마진 + 부가서비스추가 + 별도정책추가 포함)
        );
        
        const purchasePriceWithoutAddon = Math.max(0, 
          factoryPrice 
          - publicSupport       // 이통사지원금 요금제구간별
          - storeSupportWithoutAddon  // 대리점추가지원금 (정책표리베이트 - 마진 + 부가서비스차감 + 별도정책차감 포함)
        );

        // tags는 이미 위에서 초기화됨 (요금제군 선택을 위해)
        const tagsArray = [];
        if (tags.isPopular) tagsArray.push('popular');
        if (tags.isRecommended) tagsArray.push('recommend');
        if (tags.isCheap) tagsArray.push('cheap');
        if (tags.isPremium) tagsArray.push('premium');
        if (tags.isBudget) tagsArray.push('budget');
        
        // 디버깅: UIP 관련 모델명에 대한 상세 로그
        if (tagMap.size > 0 && (model.includes('UIP') || model.includes('uip'))) {
          if (tags.isPremium || tags.isBudget) {
            if (isDebugTarget(model)) {
              console.log(`[Direct] ✅ UIP 태그 찾음: 모델명=${model}, isPremium=${tags.isPremium}, isBudget=${tags.isBudget}`);
            }
          } else {
            if (isDebugTarget(model)) {
              const mapKeys = Array.from(tagMap.keys());
              const matchingKeys = mapKeys.filter(k => {
                const kLower = k.toLowerCase();
                const modelLower = model.toLowerCase();
                const normalizedModel = normalizeModelCode(model);
                const normalizedModelLower = normalizedModel ? normalizedModel.toLowerCase() : '';
                return kLower.includes(modelLower) || 
                       modelLower.includes(kLower) || 
                       kLower === modelLower ||
                       (normalizedModelLower && (kLower.includes(normalizedModelLower) || normalizedModelLower.includes(kLower)));
              });
              console.log(`[Direct] ⚠️ UIP 태그를 찾을 수 없음:`, {
                통신사: carrierParam,
                모델명: model,
                정규화된모델명: normalizeModelCode(model),
                태그맵크기: tagMap.size,
                태그맵키전체: mapKeys.slice(0, 30), // 처음 30개
                유사키: matchingKeys
              });
            }
          }
        }

        const mobile = {
          id: `mobile-${carrierParam}-${i}`,
          model: model,
          petName: petName,
          carrier: carrierParam,
          factoryPrice: factoryPrice,
          support: publicSupport,
          publicSupport: publicSupport,
          storeSupport: storeSupportWithAddon,
          storeSupportWithAddon: storeSupportWithAddon,
          storeSupportNoAddon: storeSupportWithoutAddon,
          purchasePriceWithAddon: purchasePriceWithAddon,
          purchasePriceWithoutAddon: purchasePriceWithoutAddon,
          image: (() => {
            // 1. 통신사+모델명 조합으로 먼저 조회 (가장 정확)
            const key = `${carrierParam}:${model}`;
            let imgUrl = imageMap.get(key);
            
            // 2. 없으면 모델명만으로 조회 (하위 호환)
            if (!imgUrl) {
              imgUrl = imageMap.get(model);
            }
            
            // 3. 정규화된 키로 조회 (형식 차이 무시)
            if (!imgUrl) {
              const normalizedModel = normalizeModelCode(model);
              if (normalizedModel) {
                const normalizedKey = `${carrierParam}:${normalizedModel}`;
                imgUrl = imageMap.get(normalizedKey);
                if (!imgUrl) {
                  imgUrl = imageMap.get(normalizedModel);
                }
              }
            }
            
            // 4. 여전히 없으면 유사한 키 찾기 (공백, 하이픈 등 차이 무시)
            if (!imgUrl && imageMap.size > 0) {
              const modelNormalized = normalizeModelCode(model);
              const mapKeys = Array.from(imageMap.keys());
              
              for (const mapKey of mapKeys) {
                // 통신사 부분 제거 후 비교
                const keyWithoutCarrier = mapKey.includes(':') ? mapKey.split(':')[1] : mapKey;
                const keyNormalized = normalizeModelCode(keyWithoutCarrier);
                
                if (keyNormalized === modelNormalized || 
                    keyNormalized.includes(modelNormalized) || 
                    modelNormalized.includes(keyNormalized)) {
                  imgUrl = imageMap.get(mapKey);
                  if (isDebugTarget(model)) {
                    console.log(`[Direct] ✅ 유사 키로 이미지 찾음: 모델명=${model}, 맵키=${mapKey}`);
                  }
                  break;
                }
              }
            }
            
            // 디버깅: 이미지를 찾지 못한 경우 상세 로그 (디버깅 대상 모델만)
            if (!imgUrl && imageMap.size > 0 && isDebugTarget(model)) {
              const mapKeys = Array.from(imageMap.keys());
              const matchingKeys = mapKeys.filter(k => {
                const kLower = k.toLowerCase();
                const modelLower = model.toLowerCase();
                return kLower.includes(modelLower) || modelLower.includes(kLower) || kLower === modelLower;
              });
              console.log(`[Direct] ⚠️ 이미지를 찾을 수 없음:`, {
                통신사: carrierParam,
                모델명: model,
                조회키: key,
                맵크기: imageMap.size,
                맵키전체: mapKeys,
                유사키: matchingKeys
              });
            }
            return imgUrl || '';
          })(),
          tags: tagsArray,
          requiredAddons: (requiredAddons.length > 0 ? requiredAddons.join(', ') : '') + (insuranceName ? (requiredAddons.length > 0 ? ', ' : '') + insuranceName : '') || '없음',
          insuranceName: insuranceName,
          insuranceFee: insuranceFee,
          isPopular: tags.isPopular || false,
          isRecommended: tags.isRecommended || false,
          isCheap: tags.isCheap || false,
          isPremium: tags.isPremium || false,
          isBudget: tags.isBudget || false
        };

        mobileList.push(mobile);
      }

      return mobileList;
    } catch (error) {
      console.error(`[Direct] getMobileList error (통신사: ${carrier || 'SK'}):`, error);
      console.error('[Direct] Error stack:', error.stack);
      
      // Rate limit 에러인지 확인
      const isRateLimitError = error.code === 429 || 
        (error.response && error.response.status === 429) ||
        (error.message && error.message.includes('Quota exceeded')) ||
        (error.message && error.message.includes('rateLimitExceeded'));
      
      if (isRateLimitError) {
        // Rate limit 에러인 경우 특별한 객체 반환 (캐시 저장 방지용)
        return { __rateLimitError: true, __carrier: carrier };
      }
      
      // 에러를 throw하지 않고 빈 배열 반환하여 다른 통신사 데이터는 정상적으로 가져올 수 있도록 함
      return [];
    }
  }

  // GET /api/direct/mobiles?carrier=SK
  // 링크설정에서 시트 링크와 범위를 읽어서 휴대폰 목록 동적 생성
  router.get('/mobiles', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const includeMeta = req.query.meta === '1';
      const cacheKey = `mobiles-${carrier}`;
      const cached = getCache(cacheKey);
      if (cached) {
        if (includeMeta) {
          const isEmpty = (cached.length || 0) === 0;
          let errorMsg = '';
          if (isEmpty) {
            errorMsg = '데이터가 없습니다. 다음을 확인해주세요:\n1. 링크설정 시트: 정책표 설정 (통신사별 policy 행), 이통사지원금 설정 (통신사별 support 행)\n2. 정책표 시트에 모델 데이터 존재 여부\n3. 이통사지원금 시트에 모델 데이터 존재 여부\n4. Google Sheets API 할당량 초과 가능성 (잠시 후 재시도)';
          }
          return res.json({
            data: cached,
            meta: {
              carrier,
              count: cached.length || 0,
              empty: isEmpty,
              cached: true,
              timestamp: Date.now(),
              ...(isEmpty ? { error: errorMsg } : {})
            }
          });
        }
        return res.json(cached);
      }

      const mobileListResult = await getMobileList(carrier);
      
      // Rate limit 에러인 경우 처리
      if (mobileListResult && typeof mobileListResult === 'object' && mobileListResult.__rateLimitError) {
        const errorMsg = 'Google Sheets API 할당량 초과로 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.';
        if (includeMeta) {
          return res.json({
            data: [],
            meta: {
              carrier,
              count: 0,
              empty: true,
              cached: false,
              timestamp: Date.now(),
              error: errorMsg,
              rateLimitError: true
            }
          });
        }
        return res.json([]);
      }
      
      const mobileList = Array.isArray(mobileListResult) ? mobileListResult : [];
      
      // Rate limit 에러가 아닌 경우에만 캐시 저장 (빈 배열이어도 저장)
      if (!(mobileListResult && typeof mobileListResult === 'object' && mobileListResult.__rateLimitError)) {
        setCache(cacheKey, mobileList, 5 * 60 * 1000); // 5분 캐시 (로딩 시간 최적화)
      }
      
      if (includeMeta) {
        const isEmpty = (mobileList.length || 0) === 0;
        // 서버 로그에서 확인된 일반적인 원인들
        let errorMsg = '';
        if (isEmpty) {
          errorMsg = '링크설정 시트에서 다음을 확인해주세요:\n1. 정책표 설정 (통신사별 policy 행)\n2. 이통사지원금 설정 (통신사별 support 행)\n3. 정책표 시트에 모델 데이터 존재 여부\n4. 이통사지원금 시트에 모델 데이터 존재 여부';
        }
        return res.json({
          data: mobileList,
          meta: {
            carrier,
            count: mobileList.length || 0,
            empty: isEmpty,
            cached: false,
            timestamp: Date.now(),
            ...(isEmpty ? { error: errorMsg } : {})
          }
        });
      }
      res.json(mobileList);
    } catch (error) {
      console.error(`[Direct] mobiles GET error (통신사: ${req.query.carrier || 'SK'}):`, error);
      console.error('[Direct] Error stack:', error.stack);
      // 에러 발생 시에도 빈 배열 반환 (500 에러 대신)
      res.json([]);
    }
  });

  // GET /api/direct/todays-mobiles
  // 오늘의 휴대폰 조회 (모든 통신사 데이터에서 구분 태그 기반 필터링)
  router.get('/todays-mobiles', async (req, res) => {
    try {
      // 모든 통신사 데이터 가져오기 (SK, KT, LG)
      const carriers = ['SK', 'KT', 'LG'];
      const allMobiles = [];

      // 캐시 확인
      const cacheKey = `todays-mobiles`;
      const cached = getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // 각 통신사별로 mobiles 데이터 가져오기 (병렬 처리로 최적화)
      const mobileListPromises = carriers.map(carrier => 
        getMobileList(carrier).catch(err => {
          console.warn(`[Direct] ${carrier} 통신사 데이터 가져오기 실패:`, err);
          return []; // 에러 시 빈 배열 반환
        })
      );
      
      const mobileLists = await Promise.all(mobileListPromises);
      mobileLists.forEach(mobileList => {
        allMobiles.push(...mobileList);
      });

      // 프리미엄: isPremium 태그가 true인 상품만 필터링 (3개로 제한)
      const premium = allMobiles
        .filter(p => p.isPremium === true)
        .slice(0, 3)
        .map(p => ({
          ...p,
          purchasePrice: p.purchasePriceWithAddon,
          addons: p.requiredAddons
        }));

      // 중저가: isBudget 태그가 true인 상품만 필터링 (2개로 제한)
      const budget = allMobiles
        .filter(p => p.isBudget === true)
        .slice(0, 2)
        .map(p => ({
          ...p,
          purchasePrice: p.purchasePriceWithAddon,
          addons: p.requiredAddons
        }));

      const result = { premium, budget };
      setCache(cacheKey, result, 5 * 60 * 1000); // 5분 캐시 (로딩 시간 최적화)
      res.json(result);
    } catch (error) {
      console.error('[Direct] todays-mobiles GET error:', error);
      res.status(500).json({ success: false, error: '오늘의 휴대폰 조회 실패', message: error.message });
    }
  });

  // PUT /api/direct/mobiles/:modelId/tags
  // 휴대폰 태그 업데이트 (직영점_오늘의휴대폰 시트에 저장)
  router.put('/mobiles/:modelId/tags', async (req, res) => {
    try {
      const { modelId } = req.params;
      const {
        isPopular,
        isRecommended,
        isCheap,
        isPremium,
        isBudget,
        model: modelFromBody,
        petName: petNameFromBody,
        carrier: carrierFromBody,
        factoryPrice,
        publicSupport,
        storeSupport,
        storeSupportNoAddon,
        requiredAddons,
        image
      } = req.body || {};

      // modelId에서 carrier와 index 추출 (형식: mobile-{carrier}-{index})
      const parts = modelId.split('-');
      if (parts.length < 3) {
        return res.status(400).json({ success: false, error: '잘못된 모델 ID 형식입니다.' });
      }
      
      const carrier = carrierFromBody || parts[1]; // SK, KT, LG
      const index = parseInt(parts[2], 10);
      
      if (isNaN(index)) {
        return res.status(400).json({ success: false, error: '잘못된 모델 인덱스입니다.' });
      }
      
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 링크설정에서 정책표 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
      const settingsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
      const settingsRows = (settingsRes.data.values || []).slice(1);
      
      const policyRow = settingsRows.find(row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'policy');
      if (!policyRow || !policyRow[2]) {
        return res.status(404).json({ success: false, error: `${carrier} 정책표 설정을 찾을 수 없습니다.` });
      }

      const policySettingsJson = policyRow[4] ? JSON.parse(policyRow[4]) : {};
      const policySheetId = policyRow[2].trim();
      const modelRange = policySettingsJson.modelRange || '';
      
      if (!modelRange) {
        return res.status(404).json({ success: false, error: `${carrier} 정책표 설정에서 모델명 범위가 누락되었습니다.` });
      }

      // 정책표 시트에서 해당 인덱스의 모델명 읽기 (body 우선)
      let modelName = (modelFromBody || '').toString().trim();
      if (!modelName) {
        try {
          const modelRes = await sheets.spreadsheets.values.get({
            spreadsheetId: policySheetId,
            range: modelRange,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
          const modelRows = modelRes.data.values || [];
          if (modelRows[index] && modelRows[index][0]) {
            modelName = (modelRows[index][0] || '').toString().trim();
          }
        } catch (err) {
          console.warn('[Direct] 모델명 읽기 실패:', err);
          return res.status(500).json({ success: false, error: '모델명을 읽을 수 없습니다.', message: err.message });
        }
      }

      if (!modelName) {
        return res.status(404).json({ success: false, error: '모델을 찾을 수 없습니다.' });
      }
      
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, '직영점_오늘의휴대폰', [
        '모델명', '펫네임', '통신사', '출고가', '이통사지원금', '대리점지원금(부가유치)', '대리점지원금(부가미유치)', '이미지', '필수부가서비스', '인기', '추천', '저렴', '프리미엄', '중저가'
      ]);

      // 직영점_오늘의휴대폰 시트에서 해당 모델 찾기
      const todaysRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '직영점_오늘의휴대폰!A:Z'
      });
      const todaysRows = (todaysRes.data.values || []).slice(1);

      // 해당 모델명의 행 찾기
      const rowIndex = todaysRows.findIndex(row => (row[0] || '').trim() === modelName);
      
      // 기존 행 정보 확보
      const existingRow = todaysRows[rowIndex] || [];
      const toText = (v) => (v === undefined || v === null ? '' : v);
      const addonsText = Array.isArray(requiredAddons) ? requiredAddons.join(', ') : (requiredAddons || '');

      // 채워 넣을 전체 행 데이터 (A:N)
      const newRowValues = [
        modelName,                                             // A 모델명
        petNameFromBody || existingRow[1] || '',              // B 펫네임
        carrier || existingRow[2] || '',                      // C 통신사
        toText(factoryPrice) || existingRow[3] || '',         // D 출고가
        toText(publicSupport) || existingRow[4] || '',        // E 이통사지원금
        toText(storeSupport) || existingRow[5] || '',         // F 대리점지원금(부가유치)
        toText(storeSupportNoAddon) || existingRow[6] || '',  // G 대리점지원금(부가미유치)
        image || existingRow[7] || '',                        // H 이미지
        addonsText || existingRow[8] || '',                   // I 필수부가서비스
        isPopular ? 'Y' : '',                                 // J 인기
        isRecommended ? 'Y' : '',                             // K 추천
        isCheap ? 'Y' : '',                                   // L 저렴
        isPremium ? 'Y' : '',                                 // M 프리미엄
        isBudget ? 'Y' : ''                                   // N 중저가
      ];

      if (rowIndex === -1) {
        // 행이 없으면 추가
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: '직영점_오늘의휴대폰',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [newRowValues] }
        });
      } else {
        // 행이 있으면 전체 컬럼(A:N) 업데이트
        const updateRange = `직영점_오늘의휴대폰!A${rowIndex + 2}:N${rowIndex + 2}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRowValues]
          }
        });
      }

      // 태그/모바일 캐시 무효화
      deleteCache('todays-mobiles');
      deleteCache(`mobiles-${carrier || 'SK'}`);
      deleteCache(`mobiles-KT`);
      deleteCache(`mobiles-LG`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] mobiles tags PUT error:', error);
      res.status(500).json({ success: false, error: '태그 업데이트 실패', message: error.message });
    }
  });

  // GET /api/direct/mobiles/:modelId/calculate?planGroup=xxx&openingType=xxx&carrier=SK
  // 요금제군별 대리점지원금 및 구매가 계산
  router.get('/mobiles/:modelId/calculate', async (req, res) => {
    try {
      const { modelId } = req.params;
      const { planGroup, openingType = '010신규', carrier } = req.query;
      
      if (!planGroup || !carrier) {
        return res.status(400).json({ success: false, error: 'planGroup과 carrier가 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 링크 설정 가져오기 (캐시 사용)
      const carrierSettings = await getLinkSettings(carrier);
      const policyRow = carrierSettings.find(row => (row[1] || '').trim() === 'policy');
      
      if (!policyRow) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }

      const policySettingsJson = policyRow[4] ? JSON.parse(policyRow[4]) : {};
      const policySheetId = policyRow[2] || '';
      const modelRange = policySettingsJson.modelRange || '';
      
      // 모델 인덱스 추출 (modelId에서)
      const parts = modelId.split('-');
      if (parts.length < 3) {
        return res.status(400).json({ success: false, error: '잘못된 모델 ID 형식입니다.' });
      }
      const modelIndex = parseInt(parts[2], 10);

      // 정책표에서 모델 정보 가져오기 (캐시 사용)
      const modelData = await getSheetData(policySheetId, modelRange);
      
      let modelRow = null;
      
      // 인덱스 범위 체크
      if (!isNaN(modelIndex) && modelIndex >= 0 && modelIndex < modelData.length) {
        modelRow = modelData[modelIndex];
        if (modelRow && modelRow[0]) {
          // 인덱스로 찾기 성공
        } else {
          modelRow = null; // 빈 행이면 null로 설정
        }
      }
      
      // 인덱스로 찾기 실패 시 모델명으로 찾기 시도 (query parameter로 modelName 전달 시)
      if (!modelRow && req.query.modelName) {
        const targetModelName = req.query.modelName.trim();
        const targetModelNormalized = normalizeModelCode(targetModelName);
        
        for (let i = 0; i < modelData.length; i++) {
          const rowModel = (modelData[i]?.[0] || '').toString().trim();
          if (!rowModel) continue;
          
          if (rowModel === targetModelName) {
            modelRow = modelData[i];
            break;
          }
          
          const normalized = normalizeModelCode(rowModel);
          if (normalized && targetModelNormalized && normalized === targetModelNormalized) {
            modelRow = modelData[i];
            break;
          }
        }
      }
      
      if (!modelRow || !modelRow[0]) {
        console.error(`[Direct] /calculate 모델을 찾을 수 없음:`, {
          modelId,
          modelIndex,
          modelDataLength: modelData.length,
          modelName: req.query.modelName || '(없음)',
          planGroup,
          openingType,
          carrier
        });
        return res.status(404).json({ 
          success: false, 
          error: `모델을 찾을 수 없습니다. (인덱스: ${modelIndex}, 범위: 0-${modelData.length - 1})` 
        });
      }

      // 출고가 가져오기 (이통사 지원금 시트에서)
      const supportRow = carrierSettings.find(row => (row[1] || '').trim() === 'support');
      let factoryPrice = 0;
      if (supportRow) {
        const supportSettingsJson = supportRow[4] ? JSON.parse(supportRow[4]) : {};
        const supportSheetId = supportRow[2] || '';
        const factoryPriceRange = supportSettingsJson.factoryPriceRange || '';
        const modelRange = supportSettingsJson.modelRange || '';
        
        if (factoryPriceRange && modelRange && supportSheetId) {
          try {
            // 이통사 지원금 시트 데이터 가져오기 (캐시 사용)
            const [supportModelData, factoryPriceData] = await Promise.all([
              getSheetData(supportSheetId, modelRange),
              getSheetData(supportSheetId, factoryPriceRange)
            ]);
            
            // 정책표의 모델명으로 이통사 지원금 시트에서 매칭
            const policyModel = (modelRow[0] || '').toString().trim();
            const policyModelNormalized = normalizeModelCode(policyModel);
            const supportModelIndex = supportModelData.findIndex(row => {
              const target = (row[0] || '').toString().trim();
              if (!target) return false;
              if (target === policyModel) return true;
              const normalized = normalizeModelCode(target);
              return normalized && (normalized === policyModelNormalized);
            });
            if (supportModelIndex >= 0) {
              factoryPrice = Number(factoryPriceData[supportModelIndex]?.[0] || 0);
            }
          } catch (err) {
            console.warn('[Direct] 출고가 읽기 실패:', err);
          }
        }
      }

      // 정책표 리베이트 가져오기
      const planGroupRanges = policySettingsJson.planGroupRanges || {};
      const rebateRange = planGroupRanges[planGroup]?.[openingType];
      
      let policyRebate = 0;
      if (rebateRange && policySheetId) {
        try {
          // 정책표 리베이트 가져오기 (캐시 사용)
          const rebateValues = await getSheetData(policySheetId, rebateRange);
          policyRebate = Number(rebateValues[modelIndex]?.[0] || 0) * 10000; // 만원 단위 변환
        } catch (err) {
          console.warn(`[Direct] ${planGroup} ${openingType} 리베이트 읽기 실패:`, err);
        }
      }

      // 정책설정 가져오기 (캐시 사용)
      const policySettings = await getPolicySettings(carrier);
      const { baseMargin, addonList, insuranceList, specialPolicies } = policySettings;
      
      // 부가서비스 + 보험상품 추가금액 합계 (부가유치)
      const totalAddonIncentive = addonList.reduce((sum, addon) => sum + (addon.incentive || 0), 0) +
                                  insuranceList.reduce((sum, insurance) => sum + (insurance.incentive || 0), 0);
      // 부가서비스 + 보험상품 차감금액 합계 (부가미유치)
      const totalAddonDeduction = addonList.reduce((sum, addon) => sum + (addon.deduction || 0), 0) +
                                  insuranceList.reduce((sum, insurance) => sum + (insurance.deduction || 0), 0);

      const totalSpecialAddition = specialPolicies.reduce((sum, policy) => sum + (policy.addition || 0), 0);
      const totalSpecialDeduction = specialPolicies.reduce((sum, policy) => sum + (policy.deduction || 0), 0);

      // 이통사지원금 가져오기 (요금제군별, 개통유형 고려)
      let publicSupport = 0;
      if (supportRow) {
        const supportSettingsJson = supportRow[4] ? JSON.parse(supportRow[4]) : {};
        const supportSheetId = supportRow[2] || '';
        const planGroupRanges = supportSettingsJson.planGroupRanges || {};
        const supportRange = planGroupRanges[planGroup];
        const modelRange = supportSettingsJson.modelRange || '';
        const openingTypeRange = supportSettingsJson.openingTypeRange || '';
        
        if (supportRange && modelRange && supportSheetId) {
          try {
            // 이통사 지원금 데이터 가져오기 (캐시 사용)
            const [supportModelData, supportValues, supportOpeningTypeData] = await Promise.all([
              getSheetData(supportSheetId, modelRange),
              getSheetData(supportSheetId, supportRange),
              openingTypeRange ? getSheetData(supportSheetId, openingTypeRange) : Promise.resolve([])
            ]);
            
            console.log(`[Direct] /calculate 이통사지원금 조회:`, {
              modelId,
              policyModel: (modelRow[0] || '').toString().trim(),
              planGroup,
              openingType,
              openingTypeRange: openingTypeRange || '(없음)',
              supportOpeningTypeDataLength: supportOpeningTypeData.length,
              supportModelDataLength: supportModelData.length,
              supportValuesLength: supportValues.length
            });
            
            // 정책표의 모델명으로 이통사 지원금 시트에서 매칭
            const policyModel = (modelRow[0] || '').toString().trim();
            const policyModelNormalized = normalizeModelCode(policyModel);
            
            // openingTypeRange가 없으면 기존 로직 사용 (인덱스 기반)
            if (!openingTypeRange || supportOpeningTypeData.length === 0) {
              console.log(`[Direct] /calculate 이통사지원금: openingTypeRange 없음, 인덱스 기반 매칭 사용`);
              const supportModelIndex = supportModelData.findIndex(row => {
                const target = (row[0] || '').toString().trim();
                if (!target) return false;
                if (target === policyModel) return true;
                const normalized = normalizeModelCode(target);
                return normalized && (normalized === policyModelNormalized);
              });
              if (supportModelIndex >= 0) {
                publicSupport = Number(supportValues[supportModelIndex]?.[0] || 0);
                console.log(`[Direct] /calculate 이통사지원금 (인덱스 기반):`, {
                  modelId,
                  policyModel: (modelRow[0] || '').toString().trim(),
                  planGroup,
                  openingType,
                  supportModelIndex,
                  publicSupport
                });
              }
            } else {
              // openingTypeRange가 있으면 개통유형 기반 매칭
              // 같은 모델의 모든 행 찾기
              const matchingRows = [];
              for (let i = 0; i < supportModelData.length; i++) {
                const target = (supportModelData[i]?.[0] || '').toString().trim();
                if (!target) continue;
                
                let isMatch = false;
                if (target === policyModel) {
                  isMatch = true;
                } else {
                  const normalized = normalizeModelCode(target);
                  if (normalized && normalized === policyModelNormalized) {
                    isMatch = true;
                  }
                }
                
                if (isMatch) {
                  const openingTypeRaw = supportOpeningTypeData[i]?.[0] ? 
                    (supportOpeningTypeData[i][0] || '').toString().trim() : '';
                  const supportValue = Number(supportValues[i]?.[0] || 0);
                  matchingRows.push({
                    rowIndex: i,
                    openingTypeRaw,
                    supportValue
                  });
                }
              }
              
              if (matchingRows.length > 0) {
                // 같은 모델에 "번호이동"과 "010신규/기변"이 모두 있는지 확인
                const hasNumberPort = matchingRows.some(r => 
                  r.openingTypeRaw === '번호이동' || parseOpeningTypes(r.openingTypeRaw).includes('번호이동')
                );
                const hasNewChange = matchingRows.some(r => 
                  r.openingTypeRaw === '010신규/기변' || 
                  (parseOpeningTypes(r.openingTypeRaw).includes('010신규') && 
                   parseOpeningTypes(r.openingTypeRaw).includes('기변'))
                );
                const shouldIgnoreAllTypes = hasNumberPort && hasNewChange;
                
                // 개통유형에 맞는 행 찾기
                let matchedRow = null;
                
                // 1. 정확한 개통유형 매칭 시도
                for (const row of matchingRows) {
                  const rowOpeningTypes = parseOpeningTypes(row.openingTypeRaw);
                  const rowOpeningTypeRawLower = (row.openingTypeRaw || '').toLowerCase();
                  
                  // 전유형이고 무시해야 하면 스킵
                  if (shouldIgnoreAllTypes && (row.openingTypeRaw === '전유형' || rowOpeningTypes.includes('전유형'))) {
                    continue;
                  }
                  
                  // 정확한 매칭 (파싱된 타입에 포함되는지 확인)
                  if (rowOpeningTypes.includes(openingType)) {
                    matchedRow = row;
                    break;
                  }
                  
                  // "번호이동" → MNP 매핑
                  if (openingType === 'MNP' && (row.openingTypeRaw === '번호이동' || rowOpeningTypes.includes('번호이동'))) {
                    matchedRow = row;
                    break;
                  }
                  
                  // "010신규/기변" → 010신규와 기변 매핑
                  // 원본 문자열에 "010신규"나 "기변"이 포함되어 있는지 직접 확인
                  if (openingType === '010신규') {
                    // "010신규/기변" 또는 "010신규"가 포함되어 있으면 매칭
                    if (rowOpeningTypeRawLower.includes('010신규') || 
                        rowOpeningTypeRawLower.includes('010') && rowOpeningTypeRawLower.includes('신규') ||
                        rowOpeningTypes.includes('010신규')) {
                      matchedRow = row;
                      break;
                    }
                  } else if (openingType === '기변') {
                    // "010신규/기변" 또는 "기변"이 포함되어 있으면 매칭
                    if (rowOpeningTypeRawLower.includes('기변') || 
                        rowOpeningTypes.includes('기변')) {
                      matchedRow = row;
                      break;
                    }
                  }
                }
                
                // 2. 전유형 찾기 (shouldIgnoreAllTypes가 false일 때만)
                if (!matchedRow && !shouldIgnoreAllTypes) {
                  const allTypesRow = matchingRows.find(r => 
                    r.openingTypeRaw === '전유형' || parseOpeningTypes(r.openingTypeRaw).includes('전유형')
                  );
                  if (allTypesRow) {
                    matchedRow = allTypesRow;
                  }
                }
                
                // 3. 첫 번째 행 사용 (폴백)
                if (!matchedRow && matchingRows.length > 0) {
                  matchedRow = matchingRows[0];
                }
                
                if (matchedRow) {
                  publicSupport = matchedRow.supportValue;
                  console.log(`[Direct] /calculate 이통사지원금 매칭 성공:`, {
                    modelId,
                    policyModel: (modelRow[0] || '').toString().trim(),
                    planGroup,
                    openingType,
                    matchedOpeningTypeRaw: matchedRow.openingTypeRaw,
                    publicSupport
                  });
                } else {
                  console.warn(`[Direct] /calculate 이통사지원금 매칭 실패:`, {
                    modelId,
                    policyModel: (modelRow[0] || '').toString().trim(),
                    planGroup,
                    openingType,
                    matchingRowsCount: matchingRows.length,
                    matchingRows: matchingRows.map(r => ({
                      openingTypeRaw: r.openingTypeRaw,
                      supportValue: r.supportValue
                    }))
                  });
                }
              }
            }
          } catch (err) {
            console.warn(`[Direct] ${planGroup} 이통사지원금 읽기 실패:`, err);
          }
        }
      }

      // 대리점지원금 계산
      const storeSupportWithAddon = Math.max(0,
        policyRebate - baseMargin + totalAddonIncentive + totalSpecialAddition
      );
      const storeSupportWithoutAddon = Math.max(0,
        policyRebate - baseMargin + totalAddonDeduction + totalSpecialDeduction
      );

      // 구매가 계산
      const purchasePriceWithAddon = Math.max(0, factoryPrice - publicSupport - storeSupportWithAddon);
      const purchasePriceWithoutAddon = Math.max(0, factoryPrice - publicSupport - storeSupportWithoutAddon);

      res.json({
        success: true,
        storeSupportWithAddon,
        storeSupportWithoutAddon,
        purchasePriceWithAddon,
        purchasePriceWithoutAddon,
        policyRebate,
        publicSupport
      });
    } catch (error) {
      console.error('[Direct] mobiles calculate GET error:', error);
      res.status(500).json({ success: false, error: '계산 실패', message: error.message });
    }
  });

  // GET /api/direct/main-page-texts: 메인페이지 문구 조회
  router.get('/main-page-texts', async (req, res) => {
    try {
      const cacheKey = 'main-page-texts';
      const cached = getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 시트 헤더 확인 및 생성
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MAIN_PAGE_TEXTS, HEADERS_MAIN_PAGE_TEXTS);
      
      // 데이터 조회
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_MAIN_PAGE_TEXTS}!A:F`
      });
      
      const rows = (response.data.values || []).slice(1); // 헤더 제외
      
      // 데이터 파싱
      const texts = {
        mainHeader: null,
        transitionPages: {}
      };
      
      rows.forEach(row => {
        const carrier = (row[0] || '').trim();
        const category = (row[1] || '').trim();
        const textType = (row[2] || '').trim();
        const content = (row[3] || '').trim();
        const imageUrl = (row[4] || '').trim();
        const updatedAt = (row[5] || '').trim();
        
        if (textType === 'mainHeader') {
          texts.mainHeader = {
            content,
            imageUrl,
            updatedAt
          };
        } else if (textType === 'transitionPage' && carrier && category) {
          if (!texts.transitionPages[carrier]) {
            texts.transitionPages[carrier] = {};
          }
          texts.transitionPages[carrier][category] = {
            content,
            imageUrl,
            updatedAt
          };
        }
      });
      
      const payload = { success: true, data: texts };
      // 시트에 정상적으로 접근되었을 때만 캐시 저장
      setCache(cacheKey, payload, 5 * 60 * 1000); // 5분 캐시
      res.json(payload);
    } catch (error) {
      console.error('[Direct] main-page-texts GET error:', error);
      const cached = getCache('main-page-texts');
      if (cached) {
        // 시트 오류 시 마지막 성공 응답을 반환해 빈 값으로 덮어쓰는 문제 방지
        return res.json(cached);
      }
      res.status(500).json({ success: false, error: '문구 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/main-page-texts: 메인페이지 문구 저장/업데이트
  router.post('/main-page-texts', async (req, res) => {
    try {
      const { carrier, category, textType, content, imageUrl } = req.body;
      
      if (!textType || (textType !== 'mainHeader' && textType !== 'transitionPage')) {
        return res.status(400).json({ success: false, error: '설정유형이 올바르지 않습니다.' });
      }
      
      if (textType === 'transitionPage' && (!carrier || !category)) {
        return res.status(400).json({ success: false, error: '통신사와 카테고리가 필요합니다.' });
      }
      
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 시트 헤더 확인 및 생성
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MAIN_PAGE_TEXTS, HEADERS_MAIN_PAGE_TEXTS);
      
      // 기존 데이터 조회
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_MAIN_PAGE_TEXTS}!A:F`
      });
      
      const rows = (response.data.values || []).slice(1);
      const now = new Date().toISOString();
      
      // 기존 행 찾기
      let existingRowIndex = -1;
      if (textType === 'mainHeader') {
        existingRowIndex = rows.findIndex(row => (row[2] || '').trim() === 'mainHeader');
      } else if (textType === 'transitionPage') {
        existingRowIndex = rows.findIndex(row => 
          (row[0] || '').trim() === carrier &&
          (row[1] || '').trim() === category &&
          (row[2] || '').trim() === 'transitionPage'
        );
      }
      
      const newRow = [
        textType === 'mainHeader' ? '' : carrier,
        textType === 'mainHeader' ? '' : category,
        textType,
        content || '',
        imageUrl || '',
        now
      ];
      
      if (existingRowIndex !== -1) {
        // 기존 행 업데이트
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_MAIN_PAGE_TEXTS}!A${existingRowIndex + 2}:F${existingRowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      } else {
        // 새 행 추가
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_MAIN_PAGE_TEXTS}!A:F`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [newRow] }
        });
      }
      
      // 캐시 무효화
      deleteCache('main-page-texts');
      
      res.json({ success: true, message: '문구가 저장되었습니다.' });
    } catch (error) {
      console.error('[Direct] main-page-texts POST error:', error);
      res.status(500).json({ success: false, error: '문구 저장 실패', message: error.message });
    }
  });

  app.use('/api/direct', router);
}

module.exports = setupDirectRoutes;
module.exports.invalidateDirectStoreCache = invalidateDirectStoreCache;
module.exports.deleteCache = deleteCache;

