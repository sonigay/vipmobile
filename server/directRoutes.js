const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 디버그 로그 파일 경로
const DEBUG_LOG_PATH = path.join(__dirname, '..', '.cursor', 'debug.log');
function writeDebug(payload) {
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(payload) + '\n');
  } catch (err) {
    // ignore logging failures
  }
}

function logDebug(payload) {
  writeDebug(payload);
  // HTTP 로깅 (기존 클라이언트와 동일 endpoint)
  fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

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

// 경고 로그 빈도 제한을 위한 추적 맵 (같은 경고를 1분에 1번만 출력)
const warningLogTracker = new Map(); // key -> { lastLogged, count }
const WARNING_LOG_INTERVAL_MS = 60 * 1000; // 1분

function logWarningOnce(key, message, data = {}) {
  const now = Date.now();
  const entry = warningLogTracker.get(key);
  
  if (!entry || now - entry.lastLogged > WARNING_LOG_INTERVAL_MS) {
    console.warn(message, data);
    warningLogTracker.set(key, { lastLogged: now, count: (entry?.count || 0) + 1 });
    
    // 오래된 항목 정리 (메모리 누수 방지)
    if (warningLogTracker.size > 1000) {
      for (const [k, v] of warningLogTracker.entries()) {
        if (now - v.lastLogged > WARNING_LOG_INTERVAL_MS * 10) {
          warningLogTracker.delete(k);
        }
      }
    }
  }
}

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

// Rate limit 에러 발생 시 재시도하는 래퍼 함수 (개선: 더 긴 대기 시간, jitter 추가)
async function withRetry(fn, maxRetries = 5, baseDelay = 2000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Rate limiting: 최소 간격 유지
      const now = Date.now();
      const timeSinceLastCall = now - lastApiCallTime;
      if (timeSinceLastCall < MIN_API_INTERVAL_MS) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:90',message:'Rate limiting 대기',data:{waitTime:MIN_API_INTERVAL_MS-timeSinceLastCall,timeSinceLastCall},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL_MS - timeSinceLastCall));
      }
      lastApiCallTime = Date.now();

      return await fn();
    } catch (error) {
      // Rate limit 에러 감지 개선 (더 많은 케이스 처리)
      const isRateLimitError = 
        error.code === 429 || 
        (error.response && error.response.status === 429) ||
        (error.response && error.response.data && error.response.data.error && 
         (error.response.data.error.status === 'RESOURCE_EXHAUSTED' || 
          error.response.data.error.message && error.response.data.error.message.includes('Quota exceeded'))) ||
        (error.message && (
          error.message.includes('Quota exceeded') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('429') ||
          error.message.includes('rateLimitExceeded')
        ));
        
      if (isRateLimitError && attempt < maxRetries - 1) {
        // Exponential backoff with jitter (랜덤 지연 추가로 동시 요청 분산)
        const jitter = Math.random() * 1000; // 0~1초 랜덤
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:105',message:'Rate limit 에러 재시도',data:{attempt:attempt+1,maxRetries,delay:Math.round(delay),errorCode:error.code,errorStatus:error.response?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        console.warn(`[Direct] Rate limit 에러 발생, ${Math.round(delay)}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      // #region agent log
      if (isRateLimitError) {
        fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:109',message:'Rate limit 에러 최종 실패',data:{attempt:attempt+1,maxRetries,errorCode:error.code,errorStatus:error.response?.status,errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      }
      // #endregion
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

// 모델 코드 정규화 함수 (공백, 하이픈, 언더스코어 제거, 소문자 변환, 용량 표기 통일)
function normalizeModelCode(modelCode) {
  if (!modelCode) return '';
  let normalized = modelCode.toString().trim().toUpperCase();

  // 1. 공백, 하이픈, 언더스코어 제거
  normalized = normalized.replace(/[\s\-_]/g, '');

  // 2. 용량 표기 통일 (사용자 피드백 반영)
  // 256G, 256GB -> 256
  // 512G, 512GB -> 512
  // 128G, 128GB -> 128
  // 끝에 G나 GB가 붙은 경우 제거
  normalized = normalized.replace(/(\d+)(GB|G)$/, '$1');

  // 1T, 1TB -> 1T 통일
  // 끝에 TB가 붙은 경우 T로 변경
  normalized = normalized.replace(/(\d+)TB$/, '$1T');

  return normalized;
}

// 하이픈 변형 생성 함수 - 더 이상 주력으로 사용하지 않지만 호환성을 위해 유지
function generateHyphenVariants(modelCode) {
  if (!modelCode) return [];
  const normalized = normalizeModelCode(modelCode);
  return [modelCode, normalized];
}

// 개통유형 문자열을 표준화하여 배열로 반환
// 내부적으로 사용하는 표준 유형: '010신규', 'MNP', '기변'
function parseOpeningTypes(raw) {
  const text = (raw || '').toString().toLowerCase().replace(/\s/g, '');

  // 전유형 키워드 처리
  if (text.includes('전유형') || text.includes('전체') || text.includes('모두')) {
    return ['010신규', 'MNP', '기변'];
  }

  const types = [];

  // 010 신규 (시트의 '010신규/기변' 매핑용)
  if (text.includes('010') || text.includes('신규')) types.push('010신규');

  // MNP / 번호이동
  if (text.includes('mnp') || text.includes('번호이동')) types.push('MNP');

  // 기변 (시트의 '010신규/기변' 매핑용)
  if (text.includes('기변') || text.includes('기기변경')) types.push('기변');

  // 기본값
  if (types.length === 0) return ['010신규'];

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
      // 캐시된 링크 설정 사용 (중복 호출 및 rate limit 감소)
      const carrierSettings = await getLinkSettings(carrier);

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1087',message:'getMobileList 호출 시작',data:{carrier,options},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    try {
      const carrierParam = carrier || 'SK';
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 1. 링크설정에서 정책표 설정과 이통사 지원금 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
      const settingsRes = await withRetry(async () => {
        return sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_SETTINGS
        });
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1132',message:'정책표 모델명/펫네임 읽기 시작',data:{carrier:carrierParam,modelRange,petNameRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const [modelData, petNameData] = await Promise.all([
        modelRange ? withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: policySheetId,
            range: modelRange,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
        }).then(r => r.data.values || []).catch((err) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1138',message:'정책표 모델명 읽기 실패',data:{error:err.message,code:err.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return [];
        }) : Promise.resolve([]),
        petNameRange ? withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: policySheetId,
            range: petNameRange,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
        }).then(r => r.data.values || []).catch(() => []) : Promise.resolve([])
      ]);

      // 모델명을 기준으로 다른 시트의 데이터를 매칭해야 함
      // 이통사 지원금 시트에서 모델명, 출고가, 개통유형 읽기 (모델명 기준으로 매칭)
      const supportModelRange = supportSettingsJson.modelRange || '';

      let supportSheetData = {}; // { key: { factoryPrice, openingType, openingTypes: [], rowIndex } }

      // planGroupSupportData 생성을 위해 상위 스코프에 저장
      let supportModelData = [];
      let supportOpeningTypeData = [];

      if (supportModelRange && factoryPriceRange && openingTypeRange) {
        try {
          // 이통사 지원금 시트에서 모델명, 출고가, 개통유형 읽기
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1159',message:'이통사 지원금 시트 읽기 시작',data:{carrier:carrierParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          [supportModelData, supportFactoryPriceData, supportOpeningTypeData] = await Promise.all([
            withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: supportSheetId,
                range: supportModelRange,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
            }).then(r => r.data.values || []).catch(() => []),
            factoryPriceRange ? withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: supportSheetId,
                range: factoryPriceRange,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
            }).then(r => r.data.values || []).catch(() => []) : Promise.resolve([]),
            openingTypeRange ? withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: supportSheetId,
                range: openingTypeRange,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
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
      // 🔥 캐시 제거: 매번 새로 생성 (캐시 로직 완전 제거)
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

      // planGroupSupportData 생성을 위해 supportModelData와 supportOpeningTypeData 재사용
      // supportSheetData 생성 시 이미 가져왔으므로 재사용 (API 호출 절약)
      console.log(`[Direct] planGroupSupportData 생성 준비:`, {
        supportModelRange: supportModelRange || '(없음)',
        openingTypeRange: openingTypeRange || '(없음)',
        supportRanges길이: supportRanges.length,
        planGroupRanges키목록: Object.keys(planGroupRanges),
        planGroupRanges값목록: Object.values(planGroupRanges),
        supportModelData길이: supportModelData.length,
        supportOpeningTypeData길이: supportOpeningTypeData.length
      });

      let supportMapBuilt = false;
      if (supportRanges.length === 0) {
        console.warn(`[Direct] planGroupSupportData 생성 실패: supportRanges가 비어있습니다. planGroupRanges 설정을 확인하세요.`);
      }

      if (supportRanges.length > 0 && supportModelData.length > 0 && supportOpeningTypeData.length > 0) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1454',message:'지원금 범위 batchGet 시작',data:{carrier:carrierParam,rangesCount:supportRanges.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
            // #endregion
            const response = await withRetry(async () => {
              return await sheets.spreadsheets.values.batchGet({
                spreadsheetId: supportSheetId,
                ranges: supportRanges,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
            }, 5, 3000);

            response.data.valueRanges.forEach((valueRange, index) => {
              const range = supportRanges[index];
              const planGroup = supportRangeMap[range];
              const supportValues = valueRange.values || [];
              
              // 🔥 핵심 디버그: supportValues의 실제 내용 확인
              if (planGroup === '115군') {
                console.log(`\n🔥🔥🔥 [핵심 디버그] 115군 supportValues 확인:`);
                console.log(`  범위: ${range}`);
                console.log(`  supportValues 길이: ${supportValues.length}`);
                console.log(`  supportValues 첫 5개:`, supportValues.slice(0, 5));
                console.log(`  supportModelData 첫 5개:`, supportModelData.slice(0, 5));
                console.log(`  supportOpeningTypeData 첫 5개:`, supportOpeningTypeData.slice(0, 5));
              }
              
              // 디버깅용 변수 정의
              const debugRows = [];
              const debugModels = ['UIP17-256', 'SM-S926N256', 'SM-S928N256', 'UIP17PR-256'];

              // 범위 문자열에서 시작 행 번호 추출 (예: 'F9:F97' -> 9행)
              let startRow = 0; // 0-based index (실제 행번호 - 1)

              // 시트 이름 제거 (있는 경우)
              let rangeWithoutSheet = range;
              const sheetMatch = range.match(/^'[^']+'!/);
              if (sheetMatch) {
                rangeWithoutSheet = range.replace(/^'[^']+'!/, '');
              }

              // 범위에서 시작 행 번호 추출 (예: 'F9:F97' -> 9)
              const rangeMatch = rangeWithoutSheet.match(/[A-Z]+(\d+)/);
              if (rangeMatch) {
                const rowNumber = parseInt(rangeMatch[1], 10);
                startRow = rowNumber - 1; // 0-based index로 변환
              }

              // 모델명+개통유형 복합키 맵으로 변환
              const supportMap = {};

              // 모든 범위(modelRange, openingTypeRange, planGroupRange)가 같은 시작 행에서 시작하므로
              // 오프셋 없이 동일한 인덱스를 사용 (2024-12-10 버그 수정)

              const maxRows = Math.min(
                supportModelData.length,
                supportOpeningTypeData.length,
                supportValues.length
              );

              if (maxRows <= 0) {
                console.warn(`[Direct] planGroupSupportData 생성 실패: maxRows가 0 이하`, {
                  range,
                  planGroup,
                  startRow,
                  supportModelDataLength: supportModelData.length,
                  supportOpeningTypeDataLength: supportOpeningTypeData.length,
                  supportValuesLength: supportValues.length
                });
              }

              for (let j = 0; j < maxRows; j++) {
                // 모든 범위(modelRange, openingTypeRange, planGroupRange)가 같은 시작 행에서 시작하므로
                // 오프셋 없이 동일한 인덱스 j를 사용해야 함
                // (이전 버그: startRow 오프셋을 적용하여 잘못된 행을 읽음)

                // 모델명이 없는 공백 행은 철저히 무시 (데이터 밀림 방지)
                const model = (supportModelData[j]?.[0] || '').toString().trim();
                const openingTypeRaw = (supportOpeningTypeData[j]?.[0] || '').toString().trim();
                
                // 공백 행이면 건너뛰기
                if (!model) continue;

                // 모든 범위가 같은 행에서 시작하므로 같은 인덱스 j 사용
                const supportValueStr = (supportValues[j]?.[0] || 0).toString().replace(/,/g, '');
                const supportValue = Number(supportValueStr) || 0;

                const normalizedModel = normalizeModelCode(model);
                const openingTypes = parseOpeningTypes(openingTypeRaw);

                // 🔥 디버그: 특정 모델의 모든 행 데이터 확인 (openingTypes 파싱 후)
                // 시트에서 실제로 읽은 원본 데이터 확인 (데이터 밀림 확인용)
                if ((model === 'SM-S928N256' || model === 'UIP17PR-256') && planGroup === '115군') {
                  console.log(`🔥 [${model} 원본데이터] 행 ${j + 9}: 모델="${model}", 개통유형원본="${openingTypeRaw}", 지원금원본=${supportValues[j]?.[0]}, 파싱된유형=[${openingTypes.join(',')}], 파싱값=${supportValue}`);
                }

                // 하이픈 변형 생성 (조회 시와 동일한 로직)
                const hyphenVariants = generateHyphenVariants(model);

                // 키 생성 헬퍼 함수 (모든 변형 생성)
                // 🔥 핵심 수정: 전유형 행은 기존 값이 있으면 절대 덮어쓰지 않음
                const isAllType = openingTypeRaw === '전유형' || openingTypes.includes('전유형');
                
                const addKeys = (openingType) => {
                  const setIfBetter = (key, value) => {
                    // 1. 새 값이 0이고 기존 값이 0보다 크면 덮어쓰지 않음
                    if (value === 0 && supportMap[key] && supportMap[key] > 0) {
                      return; // 기존 값 유지
                    }
                    // 2. 🔥 전유형 행은 기존 값이 있으면 절대 덮어쓰지 않음 (개별 유형 우선)
                    if (isAllType && supportMap[key] !== undefined) {
                      return; // 기존 값 유지 (번호이동/010신규 등 개별 유형이 우선)
                    }
                    // 3. 🔥 개별 유형 행이 "010신규/기변" 키를 덮어쓰지 않도록 방지
                    // "010신규/기변" 키는 명시적 "010신규/기변" 행에서만 설정되어야 함
                    if (key.includes('|010신규/기변') && !isAllType && 
                        openingTypeRaw !== '010신규/기변' && 
                        !(openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                      // 개별 유형(010신규 또는 기변)이 "010신규/기변" 키를 덮어쓰려고 할 때
                      if (supportMap[key] !== undefined) {
                        return; // 기존 값 유지 (명시적 "010신규/기변" 행이 우선)
                      }
                    }
                    supportMap[key] = value;
                  };
                  
                  // 원본 모델명 변형
                  setIfBetter(`${model}|${openingType}`, supportValue);
                  setIfBetter(`${model.toLowerCase()}|${openingType}`, supportValue);
                  setIfBetter(`${model.toUpperCase()}|${openingType}`, supportValue);

                  // 하이픈 변형
                  hyphenVariants.forEach(variant => {
                    if (variant && variant !== model) {
                      setIfBetter(`${variant}|${openingType}`, supportValue);
                      setIfBetter(`${variant.toLowerCase()}|${openingType}`, supportValue);
                      setIfBetter(`${variant.toUpperCase()}|${openingType}`, supportValue);
                    }
                  });

                  // 정규화된 모델명 변형 (대소문자 포함)
                  if (normalizedModel) {
                    setIfBetter(`${normalizedModel}|${openingType}`, supportValue);
                    setIfBetter(`${normalizedModel.toLowerCase()}|${openingType}`, supportValue);
                    setIfBetter(`${normalizedModel.toUpperCase()}|${openingType}`, supportValue);
                  }
                };

                // 매핑 타겟 설정
                // 1. 전유형 처리
                if (openingTypeRaw === '전유형' || openingTypes.includes('전유형')) {
                  // 전유형인 경우 모든 유형에 매핑
                  const allTargets = ['010신규', '기변', 'MNP', '번호이동', '010신규/기변'];
                  allTargets.forEach(ot => addKeys(ot));
                } else {
                  // 2. 개별 유형 처리

                  // (A) 기본 파싱된 유형들 매핑 (010신규, MNP, 기변)
                  openingTypes.forEach(ot => addKeys(ot));

                  // (B) "MNP" <-> "번호이동" 상호 매핑
                  if (openingTypes.includes('MNP') || openingTypeRaw.includes('번호이동')) {
                    const mnpTargets = ['MNP', '번호이동'];
                    mnpTargets.forEach(ot => addKeys(ot));
                  }

                  // (C) "010신규" / "기변" <-> "010신규/기변" 상호 매핑
                  // "010신규/기변" Row는 010신규, 기변, 010신규/기변 키 모두에 매핑되어야 함
                  if (openingTypeRaw.includes('010신규/기변') ||
                    (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                    const newChangeTargets = ['010신규', '기변', '010신규/기변'];
                    newChangeTargets.forEach(ot => addKeys(ot));
                  }

                  // (D) 개별 유형이 "010신규" 또는 "기변"인 경우 "010신규/기변"에도 매핑
                  // 🔥 수정: 개별 유형 행은 자신의 키에만 값을 설정하고, "010신규/기변" 키는 설정하지 않음
                  // "010신규/기변" 키는 명시적 "010신규/기변" 행에서만 설정되어야 함
                  // (이전 로직이 개별 유형 행이 "010신규/기변" 키를 덮어써서 값이 섞이는 문제 발생)
                  // 주석 처리: 개별 유형 행이 "010신규/기변" 키를 설정하지 않도록 함
                  // if (openingTypes.includes('010신규') && !openingTypes.includes('기변')) {
                  //   if (supportMap[`${model}|010신규/기변`] === undefined) {
                  //     addKeys('010신규/기변');
                  //   }
                  // }
                  // if (openingTypes.includes('기변') && !openingTypes.includes('010신규')) {
                  //   if (supportMap[`${model}|010신규/기변`] === undefined) {
                  //     addKeys('010신규/기변');
                  //   }
                  // }
                }
              }

              planGroupSupportData[planGroup] = supportMap;

              // 디버깅 로그 간소화
            });
            supportMapBuilt = true;
          } catch (err) {
            console.warn(`[Direct] 지원금 범위 batchGet 실패:`, err);
            // 실패 시 빈 객체로 초기화
            Object.keys(planGroupRanges).forEach(planGroup => {
              if (!planGroupSupportData[planGroup]) {
                planGroupSupportData[planGroup] = {};
              }
            });
          }

        // supportRanges 처리 블록 종료
      }

      // 캐시 제거: planGroupSupportData는 매번 새로 생성 (캐시 저장 로직 제거)
      if (!supportMapBuilt) {
        console.warn('[Direct] planGroupSupportData 생성 실패 (supportMapBuilt=false)');
      }

      // 5. 정책표 설정에서 요금제군 & 유형별 리베이트 읽기 (모델명 기준 매핑)
      // { '115군': { '010신규': { 'SM-S926N256': 690000, ... }, 'MNP': { 'SM-S926N256': 700000, ... } } }
      const policyRebateData = {};
      const policyRebateDataByIndex = {}; // 폴백용: 인덱스 기반 배열도 유지

      if (policySheetId && policySettingsJson.planGroupRanges && modelRange) {
        // 정책표 시트에서 모델명 읽기
        let policyModelData = [];
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1677',message:'정책표 모델명 읽기 시작 (리베이트용)',data:{carrier:carrierParam,modelRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          const modelResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: policySheetId,
              range: modelRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            });
          }, 5, 3000);
          policyModelData = (modelResponse.data.values || []).map(row =>
            (row[0] || '').toString().trim()
          );
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1683',message:'정책표 모델명 읽기 성공',data:{carrier:carrierParam,modelCount:policyModelData.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'directRoutes.js:1687',message:'정책표 모델명 읽기 실패',data:{carrier:carrierParam,error:err.message,code:err.code,status:err.response?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
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
            // 🔥 개선: Rate Limit 에러 재시도 로직 적용
            const response = await withRetry(async () => {
              return await sheets.spreadsheets.values.batchGet({
                spreadsheetId: policySheetId,
                ranges: rebateRanges,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
            }, 5, 3000); // 최대 5회 재시도, 기본 지연 3초

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
            // Rate Limit 에러인지 확인
            const isRateLimitError = err.code === 429 || 
              (err.response && err.response.status === 429) ||
              (err.message && err.message.includes('Quota exceeded')) ||
              (err.message && err.message.includes('rateLimitExceeded'));
            
            if (isRateLimitError) {
              console.warn(`[Direct] 리베이트 범위 batchGet Rate Limit 에러 (재시도 실패):`, err.message || err.code);
            } else {
              console.warn(`[Direct] 리베이트 범위 batchGet 실패:`, err.message || err);
            }
            
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
        }).catch((err) => {
          console.error(`[Direct] ⚠️ 직영점_모델이미지 시트 읽기 실패:`, err.message);
          return { data: { values: [] } };
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '직영점_오늘의휴대폰!A:Z'
        }).catch((err) => {
          console.error(`[Direct] ⚠️ 직영점_오늘의휴대폰 시트 읽기 실패:`, err.message);
          return { data: { values: [] } };
        })
      ]);

      const imageRows = (imageRes.data.values || []).slice(1);
      const imageMap = new Map();
      
      // 이미지 시트 읽기 결과 로깅
      if (imageRows.length === 0) {
        console.warn(`[Direct] ⚠️ 직영점_모델이미지 시트에 데이터가 없습니다. 통신사=${carrierParam}`);
      } else {
        console.log(`[Direct] ✅ 직영점_모델이미지 시트 읽기 성공: ${imageRows.length}개 행, 통신사=${carrierParam}`);
      }
      
      let imageMapCount = 0; // 매핑된 이미지 수 추적
      // 이미지 URL 정규화 함수: 이중 하이픈을 단일 하이픈로 변환
      const normalizeImageUrl = (url) => {
        if (!url) return url;
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/');
          const filename = pathParts[pathParts.length - 1];
          if (filename.includes('--')) {
            const normalizedFilename = filename.replace(/--+/g, '-');
            pathParts[pathParts.length - 1] = normalizedFilename;
            urlObj.pathname = pathParts.join('/');
            return urlObj.toString();
          }
          return url;
        } catch (err) {
          // URL 파싱 실패 시 문자열 치환으로 처리
          return url.replace(/--+/g, '-');
        }
      };
      
      imageRows.forEach(row => {
        // 통신사(A열, 인덱스 0), 모델ID(B열, 인덱스 1), 모델명(C열, 인덱스 2), 이미지URL(F열, 인덱스 5) 매핑
        const rowCarrier = (row[0] || '').trim();
        const modelId = (row[1] || '').trim(); // 모델ID (실제 모델 코드)
        const modelName = (row[2] || '').trim(); // 모델명 (모델ID와 동일)
        let imageUrl = (row[5] || '').trim();
        
        // 이미지 URL 정규화: 이중 하이픈 제거
        imageUrl = normalizeImageUrl(imageUrl);

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
            imageMapCount++;

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
      
      // 이미지 맵 생성 결과 로깅
      console.log(`[Direct] ✅ imageMap 생성 완료: 통신사=${carrierParam}, 매핑된 이미지 수=${imageMapCount}, imageMap 크기=${imageMap.size}`);

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
        
        // 🔥 UIP17PR-256 디버그: 요금제군 선택 로직
        if (model === 'UIP17PR-256') {
          console.log(`🔥 [UIP17PR-256 요금제군 선택]:`, { model, isBudget, selectedPlanGroup, 'tags.isBudget': tags.isBudget, 'tags.isPremium': tags.isPremium });
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
              
              // 🔥 개선: 하이픈 변형도 시도
              if (rebateValue === undefined) {
                const hyphenVariants = generateHyphenVariants(model);
                for (const variant of hyphenVariants) {
                  if (variant !== model) {
                    rebateValue = rebateMap[variant] || rebateMap[variant.toLowerCase()] || rebateMap[variant.toUpperCase()];
                    if (rebateValue !== undefined) {
                      matchedKey = variant;
                      break;
                    }
                  }
                }
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
          }
          // 성공 로그 제거 (불필요한 로그 정리)
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
          // 🔥 핵심 수정: '010신규'나 '기변'을 선택했을 때, 둘 다 '010신규/기변' 키를 찾고 supportOpeningType도 '010신규/기변'으로 설정
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
                // 🔥 핵심 수정: '010신규'나 '기변'을 선택했을 때, supportOpeningType을 '010신규/기변'으로 설정
                supportOpeningType = '010신규/기변';
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
              const mapKeys = Object.keys(planGroupSupportData[selectedPlanGroup] || {});
              const relatedKeys = mapKeys.filter(k => {
                const keyModel = k.split('|')[0];
                return keyModel === model || 
                       keyModel === model.toLowerCase() || 
                       keyModel === model.toUpperCase() ||
                       (normalizedModel && (keyModel === normalizedModel || keyModel === normalizedModel.toLowerCase() || keyModel === normalizedModel.toUpperCase()));
              });
              
              // 실패 로그 (문제 분석용)
              console.warn(`[Direct] ⚠️ 키 없음: ${model}|${supportOpeningType} (${selectedPlanGroup})`);
            } else if (model === 'UIP17PR-256') {
              // 🔥 UIP17PR-256 성공 로그
              console.log(`🔥 [UIP17PR-256 이통사지원금 조회]:`, { selectedPlanGroup, foundKey, publicSupport });
            }
          }
        } else {
          // planGroupSupportData가 없거나 selectedPlanGroup이 없는 경우
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
            console.warn(`[Direct] ⚠️ planGroupSupportData가 없음:`, {
              모델명: model,
              요금제군: selectedPlanGroup,
              planGroupSupportData존재: !!planGroupSupportData[selectedPlanGroup],
              planGroupSupportData키목록: Object.keys(planGroupSupportData || {})
            });
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
          }
          // 성공 로그 제거 (불필요한 로그 정리)
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

        // 로그 제거 (불필요한 로그 정리)

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
        // UIP 태그 로그 제거 (불필요한 로그 정리)

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
            let foundVia = imgUrl ? `key1:${key}` : null;

            // 2. 없으면 모델명만으로 조회 (하위 호환)
            if (!imgUrl) {
              imgUrl = imageMap.get(model);
              if (imgUrl) foundVia = `key2:${model}`;
            }

            // 3. 정규화된 키로 조회 (형식 차이 무시)
            if (!imgUrl) {
              const normalizedModel = normalizeModelCode(model);
              if (normalizedModel) {
                const normalizedKey = `${carrierParam}:${normalizedModel}`;
                imgUrl = imageMap.get(normalizedKey);
                if (imgUrl) {
                  foundVia = `key3:${normalizedKey}`;
                } else {
                  imgUrl = imageMap.get(normalizedModel);
                  if (imgUrl) foundVia = `key4:${normalizedModel}`;
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
                  if (imgUrl) {
                    foundVia = `key5:${mapKey}`;
                    if (isDebugTarget(model)) {
                      console.log(`[Direct] ✅ 유사 키로 이미지 찾음: 모델명=${model}, 맵키=${mapKey}`);
                    }
                  }
                  break;
                }
              }
            }

            // 이미지 찾기 결과 로깅
            if (imgUrl) {
              if (isDebugTarget(model) || i < 3) { // 처음 3개 모델 또는 디버그 타겟만 로깅
                console.log(`[Direct] ✅ 이미지 찾음: 통신사=${carrierParam}, 모델명=${model}, 방법=${foundVia}, URL=${imgUrl.substring(0, 50)}...`);
              }
            } else {
              // 이미지 URL이 없을 때 상세 로깅 (디버깅용)
              if (imageMap.size > 0) {
                console.log(`[Direct] ⚠️ 이미지를 찾을 수 없음: 통신사=${carrierParam}, 모델명=${model}, imageMap 크기=${imageMap.size}`);
                // 검색한 키들 로깅
                const normalizedModel = normalizeModelCode(model);
                const searchedKeys = [
                  `${carrierParam}:${model}`,
                  model,
                  normalizedModel ? `${carrierParam}:${normalizedModel}` : null,
                  normalizedModel || null
                ].filter(Boolean);
                console.log(`[Direct] 검색한 키들:`, searchedKeys);
                // 처음 10개 키만 로깅 (너무 많으면 방지)
                const sampleKeys = Array.from(imageMap.keys()).slice(0, 10);
                console.log(`[Direct] imageMap 샘플 키 (처음 10개):`, sampleKeys);
              } else {
                console.log(`[Direct] ⚠️ imageMap이 비어있음: 통신사=${carrierParam}, 모델명=${model}`);
              }
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

      // ========== 간소화된 디버깅 요약 ==========
      // 115군의 SM-S926N256 값만 확인 (핵심 검증용)
      const testPlanGroup = '115군';
      const testModel1 = 'SM-S926N256';
      const testModel2 = 'SM-S928N256';
      const testValue1 = planGroupSupportData[testPlanGroup]?.[`${testModel1}|MNP`];
      const testValue2 = planGroupSupportData[testPlanGroup]?.[`${testModel2}|MNP`];
      
      console.log(`\n🔥 [${carrier}] 이통사지원금 요약: 모델 ${mobileList.length}개`);
      console.log(`   ${testModel1}|MNP = ${testValue1 ?? '(없음)'} (예상: 690,000)`);
      console.log(`   ${testModel2}|MNP = ${testValue2 ?? '(없음)'} (예상: 800,000)`);
      // ========== 디버깅 끝 ==========

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
    // 🔥 브라우저 캐시 방지 (304 응답 방지)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const carrier = req.query.carrier || 'SK';
      const includeMeta = req.query.meta === '1';
      // 🔥 캐시 버전: 버그 수정 시 버전을 올려서 이전 캐시 무효화
      const MOBILES_CACHE_VERSION = 'v5'; // v5: 33군 및 기변 캐시 문제 수정
      const cacheKey = `mobiles-${carrier}-${MOBILES_CACHE_VERSION}`;
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
    // 🔥 브라우저 캐시 방지 (304 응답 방지)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      // 모든 통신사 데이터 가져오기 (SK, KT, LG)
      const carriers = ['SK', 'KT', 'LG'];
      const allMobiles = [];

      // 캐시 확인
      // 🔥 캐시 버전: 버그 수정 시 버전을 올려서 이전 캐시 무효화
      const TODAYS_CACHE_VERSION = 'v5'; // v5: 33군 및 기변 캐시 문제 수정
      const cacheKey = `todays-mobiles-${TODAYS_CACHE_VERSION}`;
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
    req._startTime = Date.now(); // 요청 시작 시간 기록
    // #region agent log
    writeDebug({
      location:'directRoutes.js:/calculate',
      message:'entry',
      data:{modelId:req.params.modelId,query:req.query},
      timestamp:Date.now(),
      sessionId:'debug-session',
      runId:'run1',
      hypothesisId:'S-entry'
    });
    // #endregion
    // 🔥 브라우저 캐시 방지 (304 응답 방지)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const { modelId } = req.params;
      const { planGroup, openingType = '010신규', carrier } = req.query;
      
      // 🔥 UIP17PR-256 디버그: /calculate 호출 확인
      if (modelId === 'mobile-LG-23' || modelId?.includes('UIP17PR')) {
        console.log(`📡 [Direct] /calculate 호출:`, { modelId, planGroup, openingType, carrier });
      }

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
      let actualModelIndex = modelIndex; // 실제 사용할 인덱스 (요청 모델명과 일치하는 행의 인덱스)
      if (!isNaN(modelIndex) && modelIndex >= 0 && modelIndex < modelData.length) {
        modelRow = modelData[modelIndex];
        if (modelRow && modelRow[0]) {
          // 인덱스로 찾기 성공
          // 🔥 핵심 개선: 인덱스로 찾은 모델명이 요청 모델명과 다를 때, 정책표 전체를 스캔해서 같은 모델 찾기
          if (req.query.modelName) {
            const targetModelName = req.query.modelName.trim();
            const policyModel = (modelRow[0] || '').toString().trim();
            
            // 정규화 후 다른 모델인지 확인
            const targetNormalized = normalizeModelCode(targetModelName);
            const policyNormalized = normalizeModelCode(policyModel);
            
            if (targetNormalized !== policyNormalized) {
              // 정규화 후 다른 모델이면 정책표 전체를 스캔해서 요청 모델명과 일치하는 행 찾기
              let foundIndex = -1;
              
              // 1단계: 정확히 일치하는 모델명 찾기
              for (let i = 0; i < modelData.length; i++) {
                const rowModel = (modelData[i]?.[0] || '').toString().trim();
                if (!rowModel) continue;
                
                if (rowModel === targetModelName) {
                  foundIndex = i;
                  modelRow = modelData[i];
                  break;
                }
              }
              
              // 2단계: 정규화된 모델명으로 찾기 (정확히 일치하지 않을 때만)
              if (foundIndex < 0) {
                for (let i = 0; i < modelData.length; i++) {
                  const rowModel = (modelData[i]?.[0] || '').toString().trim();
                  if (!rowModel) continue;
                  
                  const normalized = normalizeModelCode(rowModel);
                  if (normalized && targetNormalized && normalized === targetNormalized) {
                    foundIndex = i;
                    modelRow = modelData[i];
                    logWarningOnce(`model-mismatch-${targetModelName}-${rowModel}`, `[Direct] /calculate 정책표 모델명 불일치: 요청=${targetModelName}, 정책표=${rowModel} (정규화 후 일치, 인덱스 ${modelIndex} → ${i}로 변경)`);
                    break;
                  }
                }
              }
              
              if (foundIndex >= 0) {
                actualModelIndex = foundIndex; // 실제 사용할 인덱스 업데이트
                console.log(`[Direct] /calculate 같은 모델 찾기 성공: 요청=${targetModelName}, 정책표 인덱스 ${modelIndex}의 모델명=${policyModel} → 인덱스 ${foundIndex}의 모델명=${(modelRow[0] || '').toString().trim()} 사용`);
              } else {
                logWarningOnce(`model-find-fail-${targetModelName}-${policyModel}`, `[Direct] /calculate 같은 모델 찾기 실패: 요청=${targetModelName}, 정책표 인덱스 ${modelIndex}의 모델명=${policyModel} (정규화 후도 다름, 원래 인덱스 사용)`);
              }
            }
          }
        } else {
          modelRow = null; // 빈 행이면 null로 설정
        }
      }

      // 인덱스로 찾기 실패 시 모델명으로 찾기 시도 (query parameter로 modelName 전달 시)
      // 🔥 핵심 수정: req.query.modelName이 있으면 정확히 일치하는 모델명을 우선 찾음
      if (!modelRow && req.query.modelName) {
        const targetModelName = req.query.modelName.trim();
        const targetModelNormalized = normalizeModelCode(targetModelName);

        // 1단계: 정확히 일치하는 모델명 찾기
        for (let i = 0; i < modelData.length; i++) {
          const rowModel = (modelData[i]?.[0] || '').toString().trim();
          if (!rowModel) continue;

          if (rowModel === targetModelName) {
            modelRow = modelData[i];
            actualModelIndex = i; // 실제 사용할 인덱스 업데이트
            break;
          }
        }

        // 2단계: 정규화된 모델명으로 찾기 (정확히 일치하지 않을 때만)
        if (!modelRow) {
          for (let i = 0; i < modelData.length; i++) {
            const rowModel = (modelData[i]?.[0] || '').toString().trim();
            if (!rowModel) continue;

            const normalized = normalizeModelCode(rowModel);
            if (normalized && targetModelNormalized && normalized === targetModelNormalized) {
              modelRow = modelData[i];
              actualModelIndex = i; // 실제 사용할 인덱스 업데이트
              // 🔥 경고: 정책표 모델명이 요청 모델명과 다름
              if (rowModel !== targetModelName) {
                logWarningOnce(`model-mismatch-${targetModelName}-${rowModel}-2`, `[Direct] /calculate 정책표 모델명 불일치: 요청=${targetModelName}, 정책표=${rowModel} (정규화 후 일치, 인덱스 ${i} 사용)`);
              }
              break;
            }
          }
        }
      }

      if (!modelRow || !modelRow[0]) {
        // 인덱스 범위 초과인 경우 - 경고 로그만 남기고 기본값 반환 (404 대신)
        const isIndexOutOfRange = modelIndex >= modelData.length;
        logWarningOnce(`model-out-of-range-${modelId}`, `[Direct] /calculate 모델 범위 초과 (기본값 반환): ${modelId} (인덱스: ${modelIndex}/${modelData.length})`);
        
        // 기본값 반환 (에러 대신)
        return res.json({
          success: true,
          publicSupport: 0,
          storeSupportWithAddon: 0,
          storeSupportWithoutAddon: 0,
          purchasePriceWithAddon: 0,
          purchasePriceWithoutAddon: 0,
          factoryPrice: 0,
          warning: isIndexOutOfRange 
            ? `모델 인덱스가 범위를 초과했습니다. (인덱스: ${modelIndex}, 최대: ${modelData.length - 1}). 정책표 설정의 modelRange를 확인하세요.`
            : `모델을 찾을 수 없습니다. (인덱스: ${modelIndex})`
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

            // 🔥 핵심 개선: 요청 모델명으로 이통사 지원금 시트에서 매칭 (정책표 모델명이 잘못되어도 올바른 값 찾기)
            const targetModelName = req.query.modelName ? req.query.modelName.trim() : (modelRow[0] || '').toString().trim();
            const targetModelNormalized = normalizeModelCode(targetModelName);
            const policyModel = (modelRow[0] || '').toString().trim();
            const policyModelNormalized = normalizeModelCode(policyModel);
            
            let supportModelIndex = -1;
            
            // 1단계: 요청 모델명으로 정확히 일치하는 행 찾기
            if (req.query.modelName) {
              supportModelIndex = supportModelData.findIndex(row => {
                const target = (row[0] || '').toString().trim();
                if (!target) return false;
                if (target === targetModelName) return true;
                const normalized = normalizeModelCode(target);
                return normalized && (normalized === targetModelNormalized);
              });
            }
            
            // 2단계: 요청 모델명으로 찾지 못했으면 정책표 모델명으로 찾기 (폴백)
            if (supportModelIndex < 0) {
              supportModelIndex = supportModelData.findIndex(row => {
                const target = (row[0] || '').toString().trim();
                if (!target) return false;
                if (target === policyModel) return true;
                const normalized = normalizeModelCode(target);
                return normalized && (normalized === policyModelNormalized);
              });
            }
            
            if (supportModelIndex >= 0) {
              factoryPrice = Number(factoryPriceData[supportModelIndex]?.[0] || 0);
              if (req.query.modelName && targetModelName !== policyModel) {
                console.log(`[Direct] /calculate 출고가 매칭: 요청 모델명=${targetModelName}, 정책표 모델명=${policyModel}, 인덱스=${supportModelIndex}`);
              }
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
          // 🔥 핵심 개선: actualModelIndex 사용 (요청 모델명과 일치하는 행의 인덱스)
          const rebateValues = await getSheetData(policySheetId, rebateRange);
          policyRebate = Number(rebateValues[actualModelIndex]?.[0] || 0) * 10000; // 만원 단위 변환
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

        // 🔥 캐시 제거: planGroupSupportData를 매번 직접 생성 (캐시 로직 완전 제거)
        // getMobileList와 동일한 로직으로 직접 생성
        let planGroupSupportData = null;
        
        // planGroupSupportData를 직접 생성 (캐시 없이)
        try {
          const planGroupRanges = supportSettingsJson.planGroupRanges || {};
          const supportRanges = [];
          const supportRangeMap = {}; // range -> planGroup 매핑

          for (const [pg, range] of Object.entries(planGroupRanges)) {
            if (range) {
              supportRanges.push(range);
              supportRangeMap[range] = pg;
            }
          }

          if (supportRanges.length > 0 && modelRange && openingTypeRange) {
            // 이통사 지원금 데이터 가져오기
            const [supportModelData, supportOpeningTypeData] = await Promise.all([
              getSheetData(supportSheetId, modelRange),
              getSheetData(supportSheetId, openingTypeRange)
            ]);

            // 지원금 범위 데이터 가져오기
            const response = await withRetry(async () => {
              return await sheets.spreadsheets.values.batchGet({
                spreadsheetId: supportSheetId,
                ranges: supportRanges,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
            }, 5, 3000);

            planGroupSupportData = {};
            response.data.valueRanges.forEach((valueRange, index) => {
              const range = supportRanges[index];
              const pg = supportRangeMap[range];
              const supportValues = valueRange.values || [];
              
              const supportMap = {};
              const maxRows = Math.min(
                supportModelData.length,
                supportOpeningTypeData.length,
                supportValues.length
              );

              for (let j = 0; j < maxRows; j++) {
                const model = (supportModelData[j]?.[0] || '').toString().trim();
                if (!model) continue;

                const openingTypeRaw = (supportOpeningTypeData[j]?.[0] || '').toString().trim();
                const supportValueStr = (supportValues[j]?.[0] || 0).toString().replace(/,/g, '');
                const supportValue = Number(supportValueStr) || 0;

                // 🔥 디버그: SM-S928N256의 경우 상세 로그
                if (model === 'SM-S928N256' && pg === '115군') {
                  console.log(`🔥 [SM-S928N256 calculate 디버그] 행 ${j}: 개통유형="${openingTypeRaw}", 지원금=${supportValue}`);
                  if (j > 0 && j < maxRows - 1) {
                    const prevModel = (supportModelData[j-1]?.[0] || '').toString().trim();
                    const prevOpeningType = (supportOpeningTypeData[j-1]?.[0] || '').toString().trim();
                    const prevValue = (supportValues[j-1]?.[0] || 0).toString();
                    const nextModel = (supportModelData[j+1]?.[0] || '').toString().trim();
                    const nextOpeningType = (supportOpeningTypeData[j+1]?.[0] || '').toString().trim();
                    const nextValue = (supportValues[j+1]?.[0] || 0).toString();
                    console.log(`🔥 [SM-S928N256 calculate 디버그] 이전 행: 모델="${prevModel}", 유형="${prevOpeningType}", 값=${prevValue}`);
                    console.log(`🔥 [SM-S928N256 calculate 디버그] 다음 행: 모델="${nextModel}", 유형="${nextOpeningType}", 값=${nextValue}`);
                  }
                }

                const normalizedModel = normalizeModelCode(model);
                const openingTypes = parseOpeningTypes(openingTypeRaw);
                const hyphenVariants = generateHyphenVariants(model);
                const isAllType = openingTypeRaw === '전유형' || openingTypes.includes('전유형');
                
                const addKeys = (ot) => {
                  const setIfBetter = (key, value) => {
                    if (value === 0 && supportMap[key] && supportMap[key] > 0) return;
                    if (isAllType && supportMap[key] !== undefined) return;
                    // 🔥 개별 유형 행이 "010신규/기변" 키를 덮어쓰지 않도록 방지
                    if (key.includes('|010신규/기변') && !isAllType && 
                        openingTypeRaw !== '010신규/기변' && 
                        !(openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                      if (supportMap[key] !== undefined) return;
                    }
                    supportMap[key] = value;
                  };
                  
                  setIfBetter(`${model}|${ot}`, supportValue);
                  setIfBetter(`${model.toLowerCase()}|${ot}`, supportValue);
                  setIfBetter(`${model.toUpperCase()}|${ot}`, supportValue);
                  
                  hyphenVariants.forEach(variant => {
                    if (variant && variant !== model) {
                      setIfBetter(`${variant}|${ot}`, supportValue);
                      setIfBetter(`${variant.toLowerCase()}|${ot}`, supportValue);
                      setIfBetter(`${variant.toUpperCase()}|${ot}`, supportValue);
                    }
                  });
                  
                  if (normalizedModel) {
                    setIfBetter(`${normalizedModel}|${ot}`, supportValue);
                    setIfBetter(`${normalizedModel.toLowerCase()}|${ot}`, supportValue);
                    setIfBetter(`${normalizedModel.toUpperCase()}|${ot}`, supportValue);
                  }
                };

                if (isAllType) {
                  ['010신규', '기변', 'MNP', '번호이동', '010신규/기변'].forEach(ot => addKeys(ot));
                } else {
                  openingTypes.forEach(ot => addKeys(ot));
                  
                  if (openingTypes.includes('MNP') || openingTypeRaw.includes('번호이동')) {
                    ['MNP', '번호이동'].forEach(ot => addKeys(ot));
                  }
                  
                  if (openingTypeRaw.includes('010신규/기변') ||
                    (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                    ['010신규', '기변', '010신규/기변'].forEach(ot => addKeys(ot));
                  }
                  
                  // 개별 유형이 "010신규" 또는 "기변"인 경우 "010신규/기변"에도 매핑
                  // 🔥 수정: 개별 유형 행은 자신의 키에만 값을 설정하고, "010신규/기변" 키는 설정하지 않음
                  // "010신규/기변" 키는 명시적 "010신규/기변" 행에서만 설정되어야 함
                  // 주석 처리: 개별 유형 행이 "010신규/기변" 키를 설정하지 않도록 함
                  // if (openingTypes.includes('010신규') && !openingTypes.includes('기변')) {
                  //   if (supportMap[`${model}|010신규/기변`] === undefined) {
                  //     addKeys('010신규/기변');
                  //   }
                  // }
                  // if (openingTypes.includes('기변') && !openingTypes.includes('010신규')) {
                  //   if (supportMap[`${model}|010신규/기변`] === undefined) {
                  //     addKeys('010신규/기변');
                  //   }
                  // }
                }
              }

              planGroupSupportData[pg] = supportMap;
            });
          }
        } catch (err) {
          console.warn(`[Direct] /calculate planGroupSupportData 생성 실패:`, err.message);
        }

        if (planGroupSupportData && planGroupSupportData[planGroup]) {
          // 캐시에서 planGroupSupportData를 찾았으면 직접 사용 (API 호출 없음)
          const policyModel = (modelRow[0] || '').toString().trim();
          const policyModelNormalized = normalizeModelCode(policyModel);
          
          // 🔥 핵심 수정: req.query.modelName이 있으면 우선 사용 (정책표 모델명보다 정확)
          const primaryModel = req.query.modelName ? req.query.modelName.trim() : policyModel;
          const primaryModelNormalized = normalizeModelCode(primaryModel);
          
          // 🔥 핵심 수정: 정규화 후 다른 모델명인지 확인 (다른 모델이면 정책표 모델명 제외)
          const isDifferentModel = primaryModelNormalized && policyModelNormalized && 
                                   primaryModelNormalized !== policyModelNormalized;
          
          // 🔥 경고: 정책표 모델명과 요청 모델명이 다를 때 경고 (정규화 후에도 다르면)
          if (req.query.modelName && policyModel && req.query.modelName.trim() !== policyModel) {
            if (isDifferentModel) {
              logWarningOnce(`model-different-${req.query.modelName}-${policyModel}`, `[Direct] /calculate ⚠️ 정책표 모델명 불일치 (다른 모델): 요청=${req.query.modelName}, 정책표=${policyModel} (인덱스 ${modelIndex}, 정규화 후도 다름 - 정책표 모델명 제외)`);
            }
          }
          
          // 🔥 디버그: UIP17PR-256 관련 로그
          if (modelId === 'mobile-LG-23' || modelId?.includes('UIP17PR') || primaryModel?.includes('UIP17PR') || policyModel?.includes('UIP17PR')) {
            console.log(`🔍 [Direct] /calculate 모델명 비교:`, {
              modelId,
              queryModelName: req.query.modelName,
              primaryModel,
              policyModel,
              primaryModelNormalized,
              policyModelNormalized,
              isDifferentModel,
              planGroup,
              openingType,
              모델명일치: req.query.modelName?.trim() === policyModel
            });
          }

          // 시도할 키 목록: query modelName 우선 → 정책표 모델명(정규화 후 같을 때만) → 대소문자 변형 → 하이픈 변형 → 정규화
          const supportKeys = [
            `${primaryModel}|${openingType}`,  // query modelName 우선
            `${primaryModel.toLowerCase()}|${openingType}`,
            `${primaryModel.toUpperCase()}|${openingType}`
          ];
          
          // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명 추가 (다른 모델이면 제외)
          if (!isDifferentModel && policyModel && policyModel !== primaryModel) {
            supportKeys.push(
              `${policyModel}|${openingType}`,
              `${policyModel.toLowerCase()}|${openingType}`,
              `${policyModel.toUpperCase()}|${openingType}`
            );
          }

          // 하이픈 변형 추가 (primaryModel 우선)
          const primaryHyphenVariants = generateHyphenVariants(primaryModel);
          primaryHyphenVariants.forEach(variant => {
            if (variant !== primaryModel) {
              supportKeys.push(
                `${variant}|${openingType}`,
                `${variant.toLowerCase()}|${openingType}`,
                `${variant.toUpperCase()}|${openingType}`
              );
            }
          });
          
          // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명의 하이픈 변형 추가
          if (!isDifferentModel && policyModel && policyModel !== primaryModel) {
            const policyHyphenVariants = generateHyphenVariants(policyModel);
            policyHyphenVariants.forEach(variant => {
              // primaryModel의 하이픈 변형과도 중복 체크
              const variantNormalized = normalizeModelCode(variant);
              if (variant !== policyModel && variant !== primaryModel && 
                  variantNormalized === primaryModelNormalized) {
                supportKeys.push(
                  `${variant}|${openingType}`,
                  `${variant.toLowerCase()}|${openingType}`,
                  `${variant.toUpperCase()}|${openingType}`
                );
              }
            });
          }

          if (primaryModelNormalized) {
            supportKeys.push(
              `${primaryModelNormalized}|${openingType}`,
              `${primaryModelNormalized.toLowerCase()}|${openingType}`,
              `${primaryModelNormalized.toUpperCase()}|${openingType}`
            );
          }
          
          // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명의 정규화된 버전 추가
          // (이미 위에서 isDifferentModel 체크로 제외됨)

          // "번호이동" → MNP 매핑도 시도
          if (openingType === 'MNP') {
            supportKeys.push(
              `${primaryModel}|번호이동`,
              `${primaryModel.toLowerCase()}|번호이동`,
              `${primaryModel.toUpperCase()}|번호이동`
            );
            
            // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명 추가
            if (!isDifferentModel && policyModel && policyModel !== primaryModel) {
              supportKeys.push(
                `${policyModel}|번호이동`,
                `${policyModel.toLowerCase()}|번호이동`,
                `${policyModel.toUpperCase()}|번호이동`
              );
            }
            
            primaryHyphenVariants.forEach(variant => {
              if (variant !== primaryModel) {
                supportKeys.push(
                  `${variant}|번호이동`,
                  `${variant.toLowerCase()}|번호이동`,
                  `${variant.toUpperCase()}|번호이동`
                );
              }
            });
            
            // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명의 하이픈 변형 추가
            if (!isDifferentModel && policyModel && policyModel !== primaryModel) {
              const policyHyphenVariants = generateHyphenVariants(policyModel);
              policyHyphenVariants.forEach(variant => {
                const variantNormalized = normalizeModelCode(variant);
                if (variant !== policyModel && variant !== primaryModel && 
                    variantNormalized === primaryModelNormalized) {
                  supportKeys.push(
                    `${variant}|번호이동`,
                    `${variant.toLowerCase()}|번호이동`,
                    `${variant.toUpperCase()}|번호이동`
                  );
                }
              });
            }
            
            if (primaryModelNormalized) {
              supportKeys.push(
                `${primaryModelNormalized}|번호이동`,
                `${primaryModelNormalized.toLowerCase()}|번호이동`,
                `${primaryModelNormalized.toUpperCase()}|번호이동`
              );
            }
            
            // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명의 정규화된 버전 추가
            // (이미 위에서 isDifferentModel 체크로 제외됨)
          }

          // "010신규/기변" 매핑도 시도
          if (openingType === '010신규' || openingType === '기변') {
            supportKeys.push(
              `${primaryModel}|010신규/기변`,
              `${primaryModel.toLowerCase()}|010신규/기변`,
              `${primaryModel.toUpperCase()}|010신규/기변`
            );
            
            // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명 추가
            if (!isDifferentModel && policyModel && policyModel !== primaryModel) {
              supportKeys.push(
                `${policyModel}|010신규/기변`,
                `${policyModel.toLowerCase()}|010신규/기변`,
                `${policyModel.toUpperCase()}|010신규/기변`
              );
            }
            
            primaryHyphenVariants.forEach(variant => {
              if (variant !== primaryModel) {
                supportKeys.push(
                  `${variant}|010신규/기변`,
                  `${variant.toLowerCase()}|010신규/기변`,
                  `${variant.toUpperCase()}|010신규/기변`
                );
              }
            });
            
            // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명의 하이픈 변형 추가
            if (!isDifferentModel && policyModel && policyModel !== primaryModel) {
              const policyHyphenVariants = generateHyphenVariants(policyModel);
              policyHyphenVariants.forEach(variant => {
                const variantNormalized = normalizeModelCode(variant);
                if (variant !== policyModel && variant !== primaryModel && 
                    variantNormalized === primaryModelNormalized) {
                  supportKeys.push(
                    `${variant}|010신규/기변`,
                    `${variant.toLowerCase()}|010신규/기변`,
                    `${variant.toUpperCase()}|010신규/기변`
                  );
                }
              });
            }
            
            if (primaryModelNormalized) {
              supportKeys.push(
                `${primaryModelNormalized}|010신규/기변`,
                `${primaryModelNormalized.toLowerCase()}|010신규/기변`,
                `${primaryModelNormalized.toUpperCase()}|010신규/기변`
              );
            }
            
            // 🔥 핵심 수정: 정규화 후 같은 모델일 때만 정책표 모델명의 정규화된 버전 추가
            // (이미 위에서 isDifferentModel 체크로 제외됨)
          }

          // 키를 순서대로 시도하여 값 찾기
          let foundKey = null;
          let foundValue = null;
          for (const key of supportKeys) {
            if (planGroupSupportData[planGroup][key] !== undefined) {
              foundValue = Number(planGroupSupportData[planGroup][key]) || 0;
              foundKey = key;
              break;
            }
          }

          // 🔥 디버그: SM-S928N256의 경우 모든 가능한 키와 값 확인
          if (primaryModel === 'SM-S928N256' || policyModel === 'SM-S928N256') {
            const allPossibleKeys = [
              `${primaryModel}|010신규`,
              `${primaryModel}|MNP`,
              `${primaryModel}|기변`,
              `${primaryModel}|번호이동`,
              `${primaryModel}|010신규/기변`
            ];
            const availableValues = {};
            allPossibleKeys.forEach(key => {
              if (planGroupSupportData[planGroup][key] !== undefined) {
                availableValues[key] = planGroupSupportData[planGroup][key];
              }
            });
            console.log(`🔥 [SM-S928N256 디버그] 사용 가능한 모든 키와 값:`, availableValues);
            console.log(`🔥 [SM-S928N256 디버그] 요청 openingType: ${openingType}, 찾은 키: ${foundKey}, 찾은 값: ${foundValue}`);
          }

          if (foundKey) {
            publicSupport = foundValue;
            // 🔥 디버그: 키 매칭 성공 로그 (SM-S928N256 또는 UIP17PR-256)
            if (modelId === 'mobile-LG-16' || modelId === 'mobile-LG-23' || modelId?.includes('UIP17PR') || policyModel?.includes('UIP17PR') || primaryModel?.includes('UIP17PR') || primaryModel === 'SM-S928N256' || policyModel === 'SM-S928N256') {
              console.log(`✅ [Direct] /calculate 키 매칭 성공:`, {
                modelId,
                queryModelName: req.query.modelName,
                primaryModel,
                policyModel,
                planGroup,
                openingType,
                foundKey,
                publicSupport,
                시도한키목록: supportKeys.slice(0, 10)
              });
            }
          } else {
            // 🔥 UIP17PR-256 키 매칭 실패 시 상세 로그
            if (modelId === 'mobile-LG-23' || modelId?.includes('UIP17PR') || policyModel?.includes('UIP17PR')) {
              const availableKeys = Object.keys(planGroupSupportData[planGroup] || {})
                .filter(k => k.includes('UIP17PR') || k.includes('uip17pr'))
                .slice(0, 10);
              console.warn(`⚠️ [Direct] /calculate UIP17PR-256 키 매칭 실패:`, {
                modelId,
                policyModel,
                planGroup,
                openingType,
                시도한키목록: supportKeys.slice(0, 5),
                사용가능한키목록: availableKeys
              });
            }
            // 캐시 값이 0이면 폴백 시트 조회를 한 번 더 시도 (잘못된 캐시 값 방지)
            if (false && publicSupport === 0 && supportRange && modelRange && supportSheetId) {
              try {
                const [supportModelDataFB, supportValuesFB, supportOpeningTypeDataFB] = await Promise.all([
                  getSheetData(supportSheetId, modelRange),
                  getSheetData(supportSheetId, supportRange),
                  openingTypeRange ? getSheetData(supportSheetId, openingTypeRange) : Promise.resolve([])
                ]);
                const fallbackSupport = (() => {
                  if (openingTypeRange && supportOpeningTypeDataFB.length > 0) {
                    // 범위 기반 키 생성 재시도
                    let startRowFB = 0;
                    let rangeWithoutSheetFB = supportRange;
                    const sheetMatchFB = supportRange.match(/^'[^']+'!/);
                    if (sheetMatchFB) {
                      rangeWithoutSheetFB = supportRange.replace(/^'[^']+'!/, '');
                    }
                    const rangeMatchFB = rangeWithoutSheetFB.match(/[A-Z]+(\d+)/);
                    if (rangeMatchFB) {
                      startRowFB = parseInt(rangeMatchFB[1], 10) - 1;
                    }
                    const supportMapFB = {};
                    const maxRowsFB = Math.min(
                      supportModelDataFB.length - startRowFB,
                      supportOpeningTypeDataFB.length - startRowFB,
                      supportValuesFB.length
                    );
                    // 공백 행을 건너뛰기 위해 실제 데이터 행만 추적
                    let validRowIndexFB = 0; // supportValuesFB의 실제 인덱스 (공백 행 제외)

                    for (let j = 0; j < maxRowsFB; j++) {
                      const modelIndexFB = startRowFB + j;
                      const modelFB = (supportModelDataFB[modelIndexFB]?.[0] || '').toString().trim();
                      
                      // 공백 행이면 건너뛰기 (supportValuesFB 인덱스는 증가시키지 않음)
                      if (!modelFB) continue;

                      // 공백 행이 아닌 경우에만 supportValuesFB 인덱스 사용
                      const supportValueStrFB = (supportValuesFB[validRowIndexFB]?.[0] || 0).toString().replace(/,/g, '');
                      const supportValueFB = Number(supportValueStrFB) || 0;
                      validRowIndexFB++; // 다음 유효한 행으로 이동

                      const openingTypeRawFB = (supportOpeningTypeDataFB[modelIndexFB]?.[0] || '').toString().trim();
                      const openingTypesFB = parseOpeningTypes(openingTypeRawFB);
                      const hyphenVariantsFB = generateHyphenVariants(modelFB);
                      const normalizedModelFB = normalizeModelCode(modelFB);
                      
                      const addKeys = (ot) => {
                        // 원본 모델명 변형
                        supportMapFB[`${modelFB}|${ot}`] = supportValueFB;
                        supportMapFB[`${modelFB.toLowerCase()}|${ot}`] = supportValueFB;
                        supportMapFB[`${modelFB.toUpperCase()}|${ot}`] = supportValueFB;

                        // 하이픈 변형
                        hyphenVariantsFB.forEach(variant => {
                          if (variant && variant !== modelFB) {
                            supportMapFB[`${variant}|${ot}`] = supportValueFB;
                            supportMapFB[`${variant.toLowerCase()}|${ot}`] = supportValueFB;
                            supportMapFB[`${variant.toUpperCase()}|${ot}`] = supportValueFB;
                          }
                        });

                        // 정규화된 모델명 변형 (대소문자 포함)
                        if (normalizedModelFB) {
                          supportMapFB[`${normalizedModelFB}|${ot}`] = supportValueFB;
                          supportMapFB[`${normalizedModelFB.toLowerCase()}|${ot}`] = supportValueFB;
                          supportMapFB[`${normalizedModelFB.toUpperCase()}|${ot}`] = supportValueFB;
                        }
                      };
                      
                      if (openingTypeRawFB === '전유형' || openingTypesFB.includes('전유형')) {
                        ['010신규', '기변', 'MNP', '번호이동', '010신규/기변'].forEach(addKeys);
                      } else {
                        // 기본 파싱된 유형들 매핑
                        openingTypesFB.forEach(addKeys);
                        
                        // "MNP" <-> "번호이동" 상호 매핑
                        if (openingTypesFB.includes('MNP') || openingTypeRawFB.includes('번호이동')) {
                          ['MNP', '번호이동'].forEach(addKeys);
                        }
                        
                        // "010신규/기변" 매핑
                        if (openingTypeRawFB === '010신규/기변' ||
                          (openingTypesFB.includes('010신규') && openingTypesFB.includes('기변'))) {
                          ['010신규', '기변', '010신규/기변'].forEach(addKeys);
                        }
                        
                        // 개별 유형이 "010신규" 또는 "기변"인 경우 "010신규/기변"에도 매핑
                        // 🔥 수정: 개별 유형 행은 자신의 키에만 값을 설정하고, "010신규/기변" 키는 설정하지 않음
                        // 주석 처리: 개별 유형 행이 "010신규/기변" 키를 설정하지 않도록 함
                        // if (openingTypesFB.includes('010신규') && !openingTypesFB.includes('기변')) {
                        //   if (supportMapFB[`${modelFB}|010신규/기변`] === undefined) {
                        //     addKeys('010신규/기변');
                        //   }
                        // }
                        // if (openingTypesFB.includes('기변') && !openingTypesFB.includes('010신규')) {
                        //   if (supportMapFB[`${modelFB}|010신규/기변`] === undefined) {
                        //     addKeys('010신규/기변');
                        //   }
                        // }
                      }
                    }
                    const fbKeys = supportKeys;
                    for (const k of fbKeys) {
                      if (supportMapFB[k] !== undefined) return Number(supportMapFB[k]) || 0;
                    }
                    return 0;
                  } else {
                    // openingTypeRange 없으면 인덱스 기반
                    const idx = supportModelDataFB.findIndex(row => {
                      const target = (row[0] || '').toString().trim();
                      if (!target) return false;
                      if (target === policyModel) return true;
                      const normalized = normalizeModelCode(target);
                      return normalized && normalized === policyModelNormalized;
                    });
                    if (idx >= 0) {
                      return Number(supportValuesFB[idx]?.[0] || 0);
                    }
                    return 0;
                  }
                })();
                if (fallbackSupport > 0) {
                  publicSupport = fallbackSupport;
                  console.log('[Direct] /calculate 캐시 0원 폴백 성공:', {
                    modelId,
                    planGroup,
                    openingType,
                    fallbackSupport
                  });
                }
              } catch (fbErr) {
                console.warn('[Direct] /calculate 캐시 0원 폴백 실패:', fbErr);
              }
            }
          }
        } else if (supportRange && modelRange && supportSheetId) {
          // 캐시에 없으면 기존 로직 사용 (폴백)
          try {
            // 이통사 지원금 데이터 가져오기 (캐시 사용)
            const [supportModelData, supportValues, supportOpeningTypeData] = await Promise.all([
              getSheetData(supportSheetId, modelRange),
              getSheetData(supportSheetId, supportRange),
              openingTypeRange ? getSheetData(supportSheetId, openingTypeRange) : Promise.resolve([])
            ]);

            // 폴백 로그는 빈도 제한 (너무 많이 출력되지 않도록)
            logWarningOnce(`support-fallback-${planGroup}-${openingType}`, `[Direct] /calculate 이통사지원금 조회 (폴백):`, {
              modelId,
              policyModel: (modelRow[0] || '').toString().trim(),
              planGroup,
              openingType,
              openingTypeRange: openingTypeRange || '(없음)',
              supportOpeningTypeDataLength: supportOpeningTypeData.length,
              supportModelDataLength: supportModelData.length,
              supportValuesLength: supportValues.length
            });

            // 🔥 핵심 개선: 요청 모델명으로 이통사 지원금 시트에서 매칭 (정책표 모델명이 잘못되어도 올바른 값 찾기)
            const targetModelName = req.query.modelName ? req.query.modelName.trim() : (modelRow[0] || '').toString().trim();
            const targetModelNormalized = normalizeModelCode(targetModelName);
            const policyModel = (modelRow[0] || '').toString().trim();
            const policyModelNormalized = normalizeModelCode(policyModel);

            // getMobileList와 동일한 로직: planGroupSupportData 생성하여 사용
            // openingTypeRange가 없으면 인덱스 기반으로만 매칭
            if (!openingTypeRange || supportOpeningTypeData.length === 0) {
              // 디버그 로그는 빈도 제한
              logWarningOnce(`openingTypeRange-none-${planGroup}`, `[Direct] /calculate 이통사지원금: openingTypeRange 없음, 인덱스 기반 매칭 사용`);
              
              let supportModelIndex = -1;
              
              // 1단계: 요청 모델명으로 정확히 일치하는 행 찾기
              if (req.query.modelName) {
                supportModelIndex = supportModelData.findIndex(row => {
                  const target = (row[0] || '').toString().trim();
                  if (!target) return false;
                  if (target === targetModelName) return true;
                  const normalized = normalizeModelCode(target);
                  return normalized && (normalized === targetModelNormalized);
                });
              }
              
              // 2단계: 요청 모델명으로 찾지 못했으면 정책표 모델명으로 찾기 (폴백)
              if (supportModelIndex < 0) {
                supportModelIndex = supportModelData.findIndex(row => {
                  const target = (row[0] || '').toString().trim();
                  if (!target) return false;
                  if (target === policyModel) return true;
                  const normalized = normalizeModelCode(target);
                  return normalized && (normalized === policyModelNormalized);
                });
              }
              
              if (supportModelIndex >= 0) {
                publicSupport = Number(supportValues[supportModelIndex]?.[0] || 0);
                console.log(`[Direct] /calculate 이통사지원금 (인덱스 기반):`, {
                  modelId,
                  요청모델명: targetModelName,
                  정책표모델명: policyModel,
                  planGroup,
                  openingType,
                  supportModelIndex,
                  publicSupport
                });
              }
            } else {
              // openingTypeRange가 있으면 getMobileList와 동일한 로직 사용
              // 범위 문자열에서 시작 행 번호 추출
              let startRow = 0;
              let rangeWithoutSheet = supportRange;
              const sheetMatch = supportRange.match(/^'[^']+'!/);
              if (sheetMatch) {
                rangeWithoutSheet = supportRange.replace(/^'[^']+'!/, '');
              }
              const rangeMatch = rangeWithoutSheet.match(/[A-Z]+(\d+)/);
              if (rangeMatch) {
                const rowNumber = parseInt(rangeMatch[1], 10);
                startRow = rowNumber - 1; // 0-based index로 변환
              }

              // 모델명+개통유형 복합키 맵 생성 (getMobileList와 동일한 로직)
              // 모든 범위가 같은 시작 행에서 시작하므로 오프셋 없이 동일한 인덱스 사용 (2024-12-10 버그 수정)
              const supportMap = {};
              const maxRows = Math.min(
                supportModelData.length,
                supportOpeningTypeData.length,
                supportValues.length
              );

              for (let j = 0; j < maxRows; j++) {
                const model = (supportModelData[j]?.[0] || '').toString().trim();
                
                // 공백 행이면 건너뛰기
                if (!model) continue;

                // 모든 범위가 같은 행에서 시작하므로 같은 인덱스 j 사용
                const supportValueStr = (supportValues[j]?.[0] || 0).toString().replace(/,/g, '');
                const supportValue = Number(supportValueStr) || 0;

                const openingTypeRaw = (supportOpeningTypeData[j]?.[0] || '').toString().trim();
                const openingTypes = parseOpeningTypes(openingTypeRaw);

                // 하이픈 변형 생성
                const hyphenVariants = generateHyphenVariants(model);
                const normalizedModel = normalizeModelCode(model);

                // 🔥 전유형 행 덮어쓰기 방지 (getMobileList와 동일)
                const isAllType = openingTypeRaw === '전유형' || openingTypes.includes('전유형');

                // 키 생성 헬퍼 함수 (모든 변형 생성)
                const addKeys = (openingType) => {
                  const setIfBetter = (key, value) => {
                    // 1. 새 값이 0이고 기존 값이 0보다 크면 덮어쓰지 않음
                    if (value === 0 && supportMap[key] && supportMap[key] > 0) {
                      return;
                    }
                    // 2. 전유형 행은 기존 값이 있으면 절대 덮어쓰지 않음
                    if (isAllType && supportMap[key] !== undefined) {
                      return;
                    }
                    // 3. 🔥 개별 유형 행이 "010신규/기변" 키를 덮어쓰지 않도록 방지
                    if (key.includes('|010신규/기변') && !isAllType && 
                        openingTypeRaw !== '010신규/기변' && 
                        !(openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                      if (supportMap[key] !== undefined) return;
                    }
                    supportMap[key] = value;
                  };

                  // 원본 모델명 변형
                  setIfBetter(`${model}|${openingType}`, supportValue);
                  setIfBetter(`${model.toLowerCase()}|${openingType}`, supportValue);
                  setIfBetter(`${model.toUpperCase()}|${openingType}`, supportValue);

                  // 하이픈 변형
                  hyphenVariants.forEach(variant => {
                    if (variant && variant !== model) {
                      setIfBetter(`${variant}|${openingType}`, supportValue);
                      setIfBetter(`${variant.toLowerCase()}|${openingType}`, supportValue);
                      setIfBetter(`${variant.toUpperCase()}|${openingType}`, supportValue);
                    }
                  });

                  // 정규화된 모델명 변형 (대소문자 포함)
                  if (normalizedModel) {
                    setIfBetter(`${normalizedModel}|${openingType}`, supportValue);
                    setIfBetter(`${normalizedModel.toLowerCase()}|${openingType}`, supportValue);
                    setIfBetter(`${normalizedModel.toUpperCase()}|${openingType}`, supportValue);
                  }
                };

                // 각 개통유형에 대해 복합키 생성
                if (isAllType) {
                  ['010신규', '기변', 'MNP', '번호이동', '010신규/기변'].forEach(ot => addKeys(ot));
                } else {
                  // 기본 파싱된 유형들 매핑
                  openingTypes.forEach(ot => addKeys(ot));

                  // "MNP" <-> "번호이동" 상호 매핑
                  if (openingTypes.includes('MNP') || openingTypeRaw.includes('번호이동')) {
                    ['MNP', '번호이동'].forEach(ot => addKeys(ot));
                  }

                  // "010신규/기변" 매핑
                  if (openingTypeRaw === '010신규/기변' ||
                    (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                    ['010신규', '기변', '010신규/기변'].forEach(ot => addKeys(ot));
                  }

                  // 개별 유형이 "010신규" 또는 "기변"인 경우 "010신규/기변"에도 매핑
                  // 🔥 수정: 개별 유형 행은 자신의 키에만 값을 설정하고, "010신규/기변" 키는 설정하지 않음
                  // "010신규/기변" 키는 명시적 "010신규/기변" 행에서만 설정되어야 함
                  // 주석 처리: 개별 유형 행이 "010신규/기변" 키를 설정하지 않도록 함
                  // if (openingTypes.includes('010신규') && !openingTypes.includes('기변')) {
                  //   if (supportMap[`${model}|010신규/기변`] === undefined) {
                  //     addKeys('010신규/기변');
                  //   }
                  // }
                  // if (openingTypes.includes('기변') && !openingTypes.includes('010신규')) {
                  //   if (supportMap[`${model}|010신규/기변`] === undefined) {
                  //     addKeys('010신규/기변');
                  //   }
                  // }
                }
              }

              // 모델명+개통유형 복합키로 직접 조회 (getMobileList와 동일)
              const supportKeys = [
                `${policyModel}|${openingType}`,
                `${policyModel.toLowerCase()}|${openingType}`,
                `${policyModel.toUpperCase()}|${openingType}`
              ];

              const policyHyphenVariants = generateHyphenVariants(policyModel);
              policyHyphenVariants.forEach(variant => {
                if (variant !== policyModel) {
                  supportKeys.push(
                    `${variant}|${openingType}`,
                    `${variant.toLowerCase()}|${openingType}`,
                    `${variant.toUpperCase()}|${openingType}`
                  );
                }
              });

              if (policyModelNormalized) {
                supportKeys.push(
                  `${policyModelNormalized}|${openingType}`,
                  `${policyModelNormalized.toLowerCase()}|${openingType}`,
                  `${policyModelNormalized.toUpperCase()}|${openingType}`
                );
              }

              // "번호이동" → MNP 매핑도 시도
              if (openingType === 'MNP') {
                supportKeys.push(
                  `${policyModel}|번호이동`,
                  `${policyModel.toLowerCase()}|번호이동`,
                  `${policyModel.toUpperCase()}|번호이동`
                );
                policyHyphenVariants.forEach(variant => {
                  if (variant !== policyModel) {
                    supportKeys.push(
                      `${variant}|번호이동`,
                      `${variant.toLowerCase()}|번호이동`,
                      `${variant.toUpperCase()}|번호이동`
                    );
                  }
                });
                if (policyModelNormalized) {
                  supportKeys.push(
                    `${policyModelNormalized}|번호이동`,
                    `${policyModelNormalized.toLowerCase()}|번호이동`,
                    `${policyModelNormalized.toUpperCase()}|번호이동`
                  );
                }
              }

              // "010신규/기변" 매핑도 시도
              if (openingType === '010신규' || openingType === '기변') {
                supportKeys.push(
                  `${policyModel}|010신규/기변`,
                  `${policyModel.toLowerCase()}|010신규/기변`,
                  `${policyModel.toUpperCase()}|010신규/기변`
                );
                policyHyphenVariants.forEach(variant => {
                  if (variant !== policyModel) {
                    supportKeys.push(
                      `${variant}|010신규/기변`,
                      `${variant.toLowerCase()}|010신규/기변`,
                      `${variant.toUpperCase()}|010신규/기변`
                    );
                  }
                });
                if (policyModelNormalized) {
                  supportKeys.push(
                    `${policyModelNormalized}|010신규/기변`,
                    `${policyModelNormalized.toLowerCase()}|010신규/기변`,
                    `${policyModelNormalized.toUpperCase()}|010신규/기변`
                  );
                }
              }

              // 키를 순서대로 시도하여 값 찾기
              let foundKey = null;
              for (const key of supportKeys) {
                if (supportMap[key] !== undefined) {
                  publicSupport = Number(supportMap[key]) || 0;
                  foundKey = key;
                  break;
                }
              }

              if (foundKey) {
                // 성공 로그 제거 (불필요한 로그 정리)
              } else {
                logWarningOnce(`support-match-fail-${modelId}-${planGroup}-${openingType}`, `[Direct] /calculate 이통사지원금 매칭 실패:`, {
                  modelId,
                  policyModel: (modelRow[0] || '').toString().trim(),
                  planGroup,
                  openingType,
                  시도한키: supportKeys.slice(0, 10),
                  맵크기: Object.keys(supportMap).length,
                  맵키샘플: Object.keys(supportMap).slice(0, 10)
                });
              }
            }
          } catch (err) {
            logWarningOnce(`support-read-fail-${planGroup}`, `[Direct] ${planGroup} 이통사지원금 읽기 실패 (폴백):`, { planGroup, error: err.message });
          }
        } else {
          logWarningOnce(`support-data-missing-${carrier}-${planGroup}`, `[Direct] /calculate planGroupSupportData 생성 실패 및 폴백 조건 불만족:`, {
            modelId,
            planGroup,
            planGroupSupportData존재: !!planGroupSupportData,
            supportRange존재: !!supportRange,
            modelRange존재: !!modelRange,
            supportSheetId존재: !!supportSheetId
          });
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

      // #region agent log
      // 지원금/구매가 계산 값 기록 (불일치 원인 추적)
      logDebug({
        location:'directRoutes.js:/calculate',
        message:'계산 결과',
        data:{
          modelId,
          modelName: (typeof primaryModel !== 'undefined' ? primaryModel : (req.query.modelName ? req.query.modelName.trim() : ((modelRow?.[0] || '').toString().trim()))) || modelId,
          carrier,
          planGroup,
          openingType,
          factoryPrice,
          publicSupport,
          policyRebate,
          baseMargin,
          totalAddonIncentive,
          totalSpecialAddition,
          totalAddonDeduction,
          totalSpecialDeduction,
          storeSupportWithAddon,
          storeSupportWithoutAddon,
          purchasePriceWithAddon,
          purchasePriceWithoutAddon
        },
        timestamp:Date.now(),
        sessionId:'debug-session',
        runId:'run1',
        hypothesisId:'S'
      });
      // #endregion

      // #region agent log
      const responseStartTime = Date.now();
      const requestDuration = responseStartTime - (req._startTime || responseStartTime);
      writeDebug({
        location:'directRoutes.js:/calculate',
        message:'응답 반환',
        data:{
          modelId,
          planGroup,
          openingType,
          carrier,
          success:true,
          publicSupport,
          storeSupportWithAddon,
          purchasePriceWithAddon,
          requestDuration:req._startTime?requestDuration:undefined
        },
        timestamp:Date.now(),
        sessionId:'debug-session',
        runId:'run1',
        hypothesisId:'S-response'
      });
      // #endregion
      
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
      // #region agent log
      writeDebug({
        location:'directRoutes.js:/calculate',
        message:'에러 발생',
        data:{
          modelId:req.params?.modelId,
          planGroup:req.query?.planGroup,
          openingType:req.query?.openingType,
          error:error?.message,
          errorStack:error?.stack?.substring(0,200)
        },
        timestamp:Date.now(),
        sessionId:'debug-session',
        runId:'run1',
        hypothesisId:'S-error'
      });
      // #endregion
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
