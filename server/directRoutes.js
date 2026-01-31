const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const dalFactory = require('./dal/DALFactory');

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
}

// 직영점 모드 시트 이름
const SHEET_POLICY_MARGIN = '직영점_정책_마진';
const SHEET_POLICY_ADDON = '직영점_정책_부가서비스';
const SHEET_POLICY_INSURANCE = '직영점_정책_보험상품';
const SHEET_POLICY_SPECIAL = '직영점_정책_별도';
const SHEET_SETTINGS = '직영점_설정';
const SHEET_MAIN_PAGE_TEXTS = '직영점_메인페이지문구';
const SHEET_PLAN_MASTER = '직영점_요금제마스터';
const SHEET_MOBILE_MASTER = '직영점_단말마스터';
const SHEET_MOBILE_PRICING = '직영점_단말요금정책';
const SHEET_MOBILE_IMAGES = '직영점_모델이미지';
const SHEET_TODAYS_MOBILES = '직영점_오늘의휴대폰';
const SHEET_TRANSIT_LOCATION = '직영점_대중교통위치';
const SHEET_STORE_PHOTO = '직영점_매장사진';

// 시트 헤더 정의
const HEADERS_POLICY_MARGIN = ['통신사', '마진'];
const HEADERS_POLICY_ADDON = ['통신사', '서비스명', '월요금', '유치추가금액', '미유치차감금액', '상세설명', '공식사이트URL'];
const HEADERS_POLICY_INSURANCE = ['통신사', '보험상품명', '출고가최소', '출고가최대', '월요금', '유치추가금액', '미유치차감금액', '상세설명', '공식사이트URL'];
const HEADERS_POLICY_SPECIAL = ['통신사', '정책명', '정책타입', '금액', '적용여부', '조건JSON'];
const HEADERS_SETTINGS = ['통신사', '설정유형', '시트ID', '시트URL', '설정값JSON'];
const HEADERS_MAIN_PAGE_TEXTS = ['통신사', '카테고리', '설정유형', '문구내용', '이미지URL', '수정일시'];
const HEADERS_PLAN_MASTER = ['통신사', '요금제명', '요금제군', '기본료', '요금제코드', '사용여부', '비고'];
const HEADERS_MOBILE_MASTER = [
  '통신사',          // 0
  '모델ID',          // 1
  '모델명',          // 2
  '펫네임',          // 3
  '제조사',          // 4
  '출고가',          // 5
  '기본요금제군',     // 6
  'isPremium',      // 7
  'isBudget',       // 8
  'isPopular',      // 9
  'isRecommended',  // 10
  'isCheap',        // 11
  '이미지URL',        // 12
  '사용여부',         // 13
  '비고',            // 14
  'Discord메시지ID',  // 15
  'Discord포스트ID',  // 16
  'Discord스레드ID'   // 17
];
const HEADERS_MOBILE_IMAGES = [
  '통신사',          // 0
  '모델ID',          // 1
  '모델명',          // 2
  '펫네임',          // 3
  '제조사',          // 4
  '이미지URL',        // 5
  '비고',            // 6
  '색상',            // 7
  'Discord메시지ID',  // 8
  'Discord포스트ID',  // 9
  'Discord스레드ID'   // 10
];
const HEADERS_MOBILE_PRICING = [
  '통신사',                     // 0
  '모델ID',                     // 1
  '모델명',                     // 2
  '요금제군',                   // 3
  '요금제코드',                 // 4
  '개통유형',                   // 5
  '출고가',                     // 6
  '이통사지원금',               // 7
  '대리점추가지원금_부가유치',   // 8
  // 🔥 수정: 부가미유치 기준 제거 (9번째 컬럼 제거)
  '정책마진',                   // 9 (인덱스 변경: 10 → 9)
  '정책ID',                    // 10 (인덱스 변경: 11 → 10)
  '기준일자',                   // 11 (인덱스 변경: 12 → 11)
  '비고'                        // 12 (인덱스 변경: 13 → 12)
];
const HEADERS_TRANSIT_LOCATION = [
  'ID',                        // 0 - 고유 ID (자동 생성)
  '타입',                      // 1 - "버스터미널" 또는 "지하철역"
  '이름',                      // 2
  '주소',                      // 3
  '위도',                      // 4
  '경도',                      // 5
  '수정일시'                   // 6
];

function createSheetsClient() {
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;

  // 🔥 환경 변수 검증 강화
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
    const missingVars = [];
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) missingVars.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!GOOGLE_PRIVATE_KEY) missingVars.push('GOOGLE_PRIVATE_KEY');
    if (!SPREADSHEET_ID) missingVars.push('SHEET_ID');

    console.error('❌ [Google Sheets] 필수 환경 변수 누락:', missingVars.join(', '));
    throw new Error(`Missing Google Sheets environment variables: ${missingVars.join(', ')}`);
  }

  // 🔥 SPREADSHEET_ID 형식 검증 (최소 길이 체크)
  if (SPREADSHEET_ID.length < 10) {
    console.error('❌ [Google Sheets] 잘못된 SHEET_ID 형식:', SPREADSHEET_ID);
    console.error('   SHEET_ID는 최소 10자 이상이어야 합니다.');
    console.error('   예시: 1abc2def3ghi4jkl5mno6pqr7stu8vwx9yz0');
    throw new Error(`Invalid SHEET_ID format: "${SPREADSHEET_ID}" (too short)`);
  }

  // 🔥 시작 시 SPREADSHEET_ID 로그 출력 (디버깅용, 한 번만)
  if (!createSheetsClient._logged) {
    console.log(`✅ [Google Sheets] SPREADSHEET_ID: ${SPREADSHEET_ID.substring(0, 10)}...${SPREADSHEET_ID.substring(SPREADSHEET_ID.length - 5)}`);
    createSheetsClient._logged = true;
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

// Rate limiting을 위한 전역 큐 시스템 (Google Sheets 전용)
let lastApiCallTime = 0;
const sheetsRequestQueue = [];
let currentSheetsRequests = 0;

// 🔥 Feature Flag에 따라 동적으로 설정 변경
function getRateLimitConfig() {
  // Google Sheets API는 DB 사용 여부와 관계없이 항상 엄격한 제한을 적용해야 합니다.
  // DB(Supabase)를 사용하더라도 소스 데이터는 Sheet에서 읽어오기 때문입니다.
  return {
    MIN_API_INTERVAL_MS: 500, // 0.5초 간격 (배치 적용으로 인해 요청 수 감소, 속도 향상 가능)
    MAX_CONCURRENT_REQUESTS: 5, // 동시 요청 5개 (배치 적용으로 안전)
    CACHE_FRESH_TTL: 10 * 60 * 1000, // 10분
    CACHE_STALE_TTL: 60 * 60 * 1000, // 60분
    BASE_RETRY_DELAY: 1000 // 1초
  };
}

// 시트 헤더 확인 및 생성
async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  const cacheKey = `headers-${sheetName}-${spreadsheetId}`;

  // 캐시 확인
  const cached = cacheStore.get(cacheKey); // Changed cacheManager to cacheStore
  if (cached) {
    return cached.data; // Return data from cacheStore entry
  }

  try {
    const spreadsheet = await withRetryGoogleSheets(async () => {
      return await sheets.spreadsheets.get({ spreadsheetId });
    });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === sheetName);

    if (!sheetExists) {
      await withRetryGoogleSheets(async () => {
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
    }

    const res = await withRetryGoogleSheets(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`
      });
    });
    const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
    const needsInit = firstRow.length === 0 || headers.some((h, i) => (firstRow[i] || '') !== h) || firstRow.length < headers.length;

    if (needsInit) {
      await withRetryGoogleSheets(async () => {
        // 컬럼 인덱스를 알파벳으로 변환하는 간단한 로직
        const getColumnLetter = (columnNumber) => {
          let result = '';
          while (columnNumber > 0) {
            columnNumber--;
            result = String.fromCharCode(65 + (columnNumber % 26)) + result;
            columnNumber = Math.floor(columnNumber / 26);
          }
          return result;
        };

        const lastColumn = getColumnLetter(headers.length);
        return await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:${lastColumn}1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] }
        });
      });
      cacheStore.delete(cacheKey); // Changed cacheManager to cacheStore
      return headers;
    }

    // 캐시 저장 (30분)
    const expires = Date.now() + (30 * 60 * 1000);
    cacheStore.set(cacheKey, { data: headers, expires });
    return headers;
  } catch (error) {
    console.error(`[Direct] Failed to ensure sheet headers for ${sheetName}:`, error);
    cacheStore.delete(cacheKey);
    throw error;
  }
}

// 현재 설정 가져오기
const rateLimitConfig = getRateLimitConfig();
const MIN_API_INTERVAL_MS = rateLimitConfig.MIN_API_INTERVAL_MS;
const MAX_CONCURRENT_SHEETS_REQUESTS = rateLimitConfig.MAX_CONCURRENT_REQUESTS;
const CACHE_FRESH_TTL = rateLimitConfig.CACHE_FRESH_TTL;
const CACHE_STALE_TTL = rateLimitConfig.CACHE_STALE_TTL;

// 🔥 서버 시작 시 현재 Rate Limit 설정 로그 출력
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 [Direct Routes] Rate Limit 설정');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   데이터 소스: ${process.env.USE_DB_DIRECT_STORE === 'true' ? 'Supabase (빠름)' : 'Google Sheets (느림)'}`);
console.log(`   API 호출 간격: ${MIN_API_INTERVAL_MS}ms`);
console.log(`   동시 요청 수: ${MAX_CONCURRENT_SHEETS_REQUESTS}개`);
console.log(`   캐시 유지 시간: ${CACHE_FRESH_TTL / 60000}분 (신선) / ${CACHE_STALE_TTL / 60000}분 (만료)`);
console.log(`   재시도 기본 지연: ${rateLimitConfig.BASE_RETRY_DELAY}ms`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
const backgroundRefreshing = new Set(); // 현재 백그라운드에서 갱신 중인 키 목록

function getCacheEntry(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  const isFresh = now < entry.expires;
  const isStale = now < entry.expires + (CACHE_STALE_TTL - CACHE_FRESH_TTL);

  if (!isFresh && !isStale) {
    cacheStore.delete(key);
    return null;
  }

  return {
    data: entry.data,
    isFresh,
    isStale: !isFresh && isStale
  };
}

// 요청 큐 처리 함수
// 요청 큐 처리 함수
async function processSheetsRequestQueue() {
  const config = getRateLimitConfig();
  // 🔥 버그 수정: MAX_CONCURRENT_SHEETS_REQUESTS 변수가 정의되지 않아 큐가 멈추는 문제 해결
  if (sheetsRequestQueue.length > 0 && currentSheetsRequests < config.MAX_CONCURRENT_REQUESTS) {
    const { resolve, reject, fn } = sheetsRequestQueue.shift();
    currentSheetsRequests++;

    // 백그라운드에서 비동기 실행 (await하지 않음 - 큐 회전을 위해)
    // 단, fn() 내부에서 Rate Limit 대기가 있으므로 실제로는 간격이 조절됨
    (async () => {
      try {
        const result = await fn();
        if (resolve) resolve(result);
      } catch (error) {
        if (reject) reject(error);
      } finally {
        currentSheetsRequests--;
        processSheetsRequestQueue(); // 다음 요청 처리
      }
    })();

    // 즉시 재귀 호출하여 동시성 한도까지 추가 실행 시도
    processSheetsRequestQueue();
  }
}

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

// Supabase용 재시도 함수 (딜레이 없음, 네트워크 에러만 재시도)
async function withRetrySupabase(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      // 네트워크 에러만 재시도
      const isNetworkError =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        (error.message && (
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET')
        ));

      if (isNetworkError && attempt < maxRetries - 1) {
        console.warn(`[Direct] Supabase 네트워크 에러, 즉시 재시도 (${attempt + 1}/${maxRetries})`);
        continue;
      }

      // 네트워크 에러가 아니거나 최대 재시도 횟수 초과 시
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Google Sheets용 재시도 함수 (Rate Limit 로직 유지)
async function withRetryGoogleSheets(fn, maxRetries = 5, baseDelay = null) {
  // 🔥 동적 설정 사용
  const config = getRateLimitConfig();
  const actualBaseDelay = baseDelay || config.BASE_RETRY_DELAY;

  // 전역 큐를 통한 동시 요청 제한
  return new Promise((resolve, reject) => {
    const executeRequest = async () => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Rate limiting: 최소 간격 유지
          const now = Date.now();
          const timeSinceLastCall = now - lastApiCallTime;
          // 🔥 버그 수정: MIN_API_INTERVAL_MS 변수 미정의 문제 해결
          if (timeSinceLastCall < config.MIN_API_INTERVAL_MS) {
            await new Promise(resolve => setTimeout(resolve, config.MIN_API_INTERVAL_MS - timeSinceLastCall));
          }
          lastApiCallTime = Date.now();

          const result = await fn();
          resolve(result);
          return;
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
              error.message.includes('rateLimitExceeded') ||
              error.message.includes('Rate Limit') ||
              error.message.includes('quota metric')
            ));

          if (isRateLimitError && attempt < maxRetries - 1) {
            // Exponential backoff with jitter (랜덤 지연 추가로 동시 요청 분산)
            const jitter = Math.random() * 2000; // 0~2초 랜덤
            const delay = actualBaseDelay * Math.pow(2, attempt) + jitter;
            console.warn(`⚠️ [Direct] Google Sheets Rate Limit 에러 발생, ${Math.round(delay)}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
            console.warn(`   에러 메시지: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Rate limit 에러가 아니거나 최대 재시도 횟수 초과 시
          if (attempt === maxRetries - 1 || !isRateLimitError) {
            if (isRateLimitError) {
              console.error(`❌ [Direct] Google Sheets Rate Limit 최대 재시도 횟수 초과 (${maxRetries}회)`);
              console.error(`   해결 방법: 1-2분 기다린 후 다시 시도하거나, Supabase로 전환하세요 (USE_DB_DIRECT_STORE=true)`);
            }
            reject(error);
            return;
          }
        }
      }
      // 모든 재시도 실패
      reject(new Error('Max retries exceeded'));
    };

    // 큐에 추가
    // 큐에 추가
    sheetsRequestQueue.push({
      // executeRequest 내부에서 이미 resolve/reject를 호출하므로, 
      // 큐 프로세서의 resolve/reject 호출은 무시하도록 빈 함수 전달
      resolve: () => { },
      reject: () => { },
      fn: executeRequest
    });

    // 큐 처리 시작
    processSheetsRequestQueue();
  });
}

// 하위 호환성을 위한 별칭 (기존 코드에서 withRetry 사용하는 경우)
const withRetry = withRetryGoogleSheets;

// 동시 요청 방지를 위한 래퍼 함수 (재시도 로직 포함 + SWR 지원)
async function withRequestDeduplication(key, fetchFn, ttlOverride = null) {
  const ttl = ttlOverride || CACHE_FRESH_TTL;

  // 1. 캐시 확인 (SWR 로직)
  const cacheEntry = getCacheEntry(key);
  if (cacheEntry) {
    if (cacheEntry.isFresh) {
      return cacheEntry.data;
    }

    // Stale한 경우: 데이터를 즉시 반환하고 백그라운드에서 갱신 시도
    if (cacheEntry.isStale && !backgroundRefreshing.has(key) && !pendingRequests.has(key)) {
      console.log(`[SWR] '${key}' 캐시가 오래됨(Stale). 백그라운드 갱신 시작.`);
      backgroundRefreshing.add(key);

      // 백그라운드에서 실행 (await 하지 않음)
      withRetry(fetchFn)
        .then(data => {
          setCache(key, data, ttl);
          console.log(`[SWR] '${key}' 백그라운드 갱신 완료.`);
        })
        .catch(err => {
          // 🔥 태스크 7.2: 로그 빈도 제한 적용 - 백그라운드 캐시 갱신 실패 시 경고 로그 빈도 제한
          logWarningOnce(
            `swr-background-refresh-failure-${key}`,
            `[SWR] '${key}' 백그라운드 갱신 실패:`,
            { 오류메시지: err.message, 캐시키: key }
          );
        })
        .finally(() => {
          backgroundRefreshing.delete(key);
        });
    }

    // Stale 데이터를 즉시 반환
    return cacheEntry.data;
  }

  // 2. 캐시가 없거나 완전히 만료된 경우: 이미 진행 중인 요청이 있는지 확인
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // 3. 완전히 새로운 요청 시작
  const promise = withRetry(fetchFn)
    .then(data => {
      setCache(key, data, ttl);
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

// 정책 설정 캐시 (메모리)
const policySettingsCache = new Map();
const POLICY_CACHE_TTL = 5 * 60 * 1000; // 5분

// 정책 설정 읽기 함수 (캐시 적용, 동시 요청 방지)
// 정책 설정 읽기 함수 (캐시 적용, 동시 요청 방지)
async function getPolicySettings(carrier) {
  const cacheKey = `policy-settings-${carrier}`;
  const cached = policySettingsCache.get(cacheKey);

  // 캐시가 유효하면 반환
  if (cached && (Date.now() - cached.timestamp < POLICY_CACHE_TTL)) {
    console.log(`⚡ [Direct][getPolicySettings] 캐시 HIT: ${carrier}`);
    return cached.data;
  }

  return withRequestDeduplication(cacheKey, async () => {
    console.log(`🔍 [Direct][getPolicySettings] 구글 시트 통합 조회 시작: ${carrier}`);
    const { sheets, SPREADSHEET_ID } = createSheetsClient();

    // 🔥 성능 최적화: 4개 시트를 단 한 번의 요청으로 모두 가져옴 (Margin, Addon, Insurance, Special)
    // 헤더 확인(ensureSheetHeaders)은 읽기 시점에는 불필요하므로 제거 (속도 향상)
    const batchRes = await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20초 타임아웃
      try {
        return await sheets.spreadsheets.values.batchGet({
          spreadsheetId: SPREADSHEET_ID,
          ranges: [
            `${SHEET_POLICY_MARGIN}!A:B`,     // index 0: 마진
            `${SHEET_POLICY_ADDON}!A:Z`,      // index 1: 부가서비스
            `${SHEET_POLICY_INSURANCE}!A:Z`,  // index 2: 보험
            `${SHEET_POLICY_SPECIAL}!A:Z`     // index 3: 별도정책
          ],
          // msg: '통합 정책 조회',  // 옵션이므로 주석 처리 (일부 googleapis 버전에 따라 다를 수 있음)
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
    });

    const valueRanges = batchRes.data.valueRanges || [];

    // 1. 마진 설정 파싱 (SHEET_POLICY_MARGIN)
    const marginRows = (valueRanges[0]?.values || []).slice(1);
    const marginRow = marginRows.find(row => (row[0] || '').toString().trim() === carrier.toString().trim());

    // 설정된 마진이 없으면 기본값을 0원으로 처리
    const marginValue = marginRow && marginRow[1] !== undefined && marginRow[1] !== null && marginRow[1] !== ''
      ? marginRow[1]
      : null;

    let marginNum = 0;
    if (marginValue !== null) {
      const cleanValue = String(marginValue).replace(/[^0-9.-]/g, '');
      marginNum = Number(cleanValue) || 0;
    }
    const baseMargin = marginNum;

    // 2. 부가서비스 설정 파싱 (SHEET_POLICY_ADDON)
    const addonRows = (valueRanges[1]?.values || []).slice(1);
    const addonList = addonRows
      .filter(row => (row[0] || '').trim() === carrier)
      .map(row => ({
        carrier: row[0],
        name: row[1] || '',
        fee: Number(row[2] || 0),           // 월요금
        incentive: Number(row[3] || 0),     // 유치추가금액
        deduction: -Math.abs(Number(row[4] || 0)), // 미유치차감금액 (음수 처리)
        description: row[5] || '',
        url: row[6] || ''
      }));

    // 3. 보험상품 설정 파싱 (SHEET_POLICY_INSURANCE)
    const insuranceRows = (valueRanges[2]?.values || []).slice(1);
    const insuranceList = insuranceRows
      .filter(row => (row[0] || '').trim() === carrier)
      .map(row => ({
        carrier: row[0],
        name: row[1] || '',
        minPrice: Number(row[2] || 0),
        maxPrice: Number(row[3] || 0),
        fee: Number(row[4] || 0),
        incentive: Number(row[5] || 0),
        deduction: -Math.abs(Number(row[6] || 0)),
        description: row[7] || '',
        url: row[8] || ''
      }));

    // 4. 별도 정책 설정 파싱 (SHEET_POLICY_SPECIAL)
    const specialRows = (valueRanges[3]?.values || []).slice(1);
    const specialPolicies = specialRows
      .filter(row => (row[0] || '').trim() === carrier && (row[4] || '').toString().toUpperCase() === 'TRUE')
      .map(row => ({
        carrier: row[0],
        name: row[1] || '',
        policyType: row[2] || 'general',
        amount: Number(row[3] || 0),
        isActive: true, // 필터링했으므로 true
        conditionsJson: row[5] || ''
      }));

    const result = {
      baseMargin,
      addonList,
      insuranceList,
      specialPolicies
    };

    // 캐시 저장
    policySettingsCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });
    console.log(`✅ [Direct] 정책 설정 통합 조회 완료: ${carrier} (마진:${baseMargin}, 부가:${addonList.length}, 보험:${insuranceList.length}, 별도:${specialPolicies.length})`);

    return result;
  });
}

// 단말마스터/요금정책 공통: 시트의 Y/N/TRUE/FALSE 값을 boolean으로 변환
function parseBooleanFlag(value) {
  if (value == null) return false;
  const text = value.toString().trim().toUpperCase();
  if (!text) return false;
  return text === 'Y' || text === 'TRUE' || text === '1';
}

// 링크 설정 읽기 함수 (캐시 적용, 동시 요청 방지)
async function getLinkSettings(carrier) {
  const cacheKey = `link-settings-${carrier}`;

  return withRequestDeduplication(cacheKey, async () => {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();

    // 🔥 디버그: 링크설정 읽기 시작 로그
    console.log(`🔍 [getLinkSettings] ${carrier} 링크설정 읽기 시작`, {
      SPREADSHEET_ID: SPREADSHEET_ID ? `${SPREADSHEET_ID.substring(0, 10)}...` : 'undefined',
      sheetName: SHEET_SETTINGS
    });

    const linkSettingsRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
    });

    const allRows = linkSettingsRes.data.values || [];
    const linkSettingsRows = allRows.slice(1); // 헤더 제거
    const carrierSettings = linkSettingsRows.filter(row => (row[0] || '').trim() === carrier);

    // 🔥 디버그: 링크설정 읽기 결과 로그
    console.log(`✅ [getLinkSettings] ${carrier} 링크설정 읽기 완료`, {
      전체행수: allRows.length,
      데이터행수: linkSettingsRows.length,
      해당통신사설정수: carrierSettings.length,
      설정유형: carrierSettings.map(row => row[1]).join(', ')
    });

    return carrierSettings;
  });
}

// 요금제마스터(직영점_요금제마스터) 재빌드 헬퍼
async function rebuildPlanMaster(carriersParam) {
  const carriers = carriersParam && carriersParam.length > 0 ? carriersParam : ['SK', 'KT', 'LG'];
  const { sheets, SPREADSHEET_ID } = createSheetsClient();

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 시작 시점 로깅
  const startTime = Date.now();
  console.log(`🔄 [rebuildPlanMaster] 요금제 마스터 재빌드 시작 - ${new Date(startTime).toISOString()}`, {
    통신사: carriers.join(', ')
  });

  await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_PLAN_MASTER, HEADERS_PLAN_MASTER);

  const allRows = [];
  const perCarrierStats = {};

  for (const carrier of carriers) {
    const settingsRows = await getLinkSettings(carrier);
    const planGroupRow = settingsRows.find(
      row => (row[0] || '').toString().trim() === carrier &&
        (row[1] || '').toString().trim() === 'planGroup'
    );

    if (!planGroupRow) {
      perCarrierStats[carrier] = { count: 0, warning: 'planGroup 설정을 찾을 수 없습니다.' };
      continue;
    }

    const sheetId = (planGroupRow[2] || '').toString().trim();
    let configJson = {};
    try {
      configJson = planGroupRow[4] ? JSON.parse(planGroupRow[4]) : {};
    } catch (err) {
      console.warn('[Direct][rebuildPlanMaster] planGroup JSON 파싱 실패:', err.message);
    }

    const planNameRange = configJson.planNameRange || '';
    const planGroupRange = configJson.planGroupRange || '';
    const basicFeeRange = configJson.basicFeeRange || '';

    if (!sheetId || !(planNameRange || planGroupRange || basicFeeRange)) {
      perCarrierStats[carrier] = { count: 0, warning: '시트ID 또는 범위 설정이 없습니다.' };
      continue;
    }

    // 🔥 성능 개선: Batch Get 사용 (1번의 API 호출로 3개 범위 조회)
    let planNames = [], planGroups = [], basicFees = [];
    const rangesToFetch = [];
    if (planNameRange) rangesToFetch.push(planNameRange);
    if (planGroupRange) rangesToFetch.push(planGroupRange);
    if (basicFeeRange) rangesToFetch.push(basicFeeRange);

    if (rangesToFetch.length > 0) {
      try {
        const batchRes = await withRetry(async () => {
          return await sheets.spreadsheets.values.batchGet({
            spreadsheetId: sheetId,
            ranges: rangesToFetch
          });
        });

        const valueRanges = batchRes.data.valueRanges || [];
        let rangeIdx = 0;

        if (planNameRange) planNames = valueRanges[rangeIdx++]?.values || [];
        if (planGroupRange) planGroups = valueRanges[rangeIdx++]?.values || [];
        if (basicFeeRange) basicFees = valueRanges[rangeIdx++]?.values || [];
      } catch (err) {
        console.warn(`[Direct] 요금제 데이터 Batch Get 실패 (${sheetId}):`, err.message);
        perCarrierStats[carrier] = { count: 0, warning: '데이터 조회 실패' };
        continue;
      }
    }

    const flatNames = planNames.flat().map(v => (v || '').toString().trim());
    const flatGroups = planGroups.flat().map(v => (v || '').toString().trim());
    const flatFees = basicFees.flat().map(v => {
      const cleanVal = (v || '').toString().replace(/[^0-9]/g, '');
      return Number(cleanVal) || 0;
    });

    const maxLength = Math.max(flatNames.length, flatGroups.length, flatFees.length);
    let created = 0;

    for (let i = 0; i < maxLength; i++) {
      const planName = flatNames[i] || '';
      const group = flatGroups[i] || '';
      const fee = flatFees[i] || 0;
      if (!planName && !group && !fee) continue;

      const displayGroup = group || planName;

      allRows.push([
        carrier,           // 통신사
        planName,          // 요금제명
        displayGroup,      // 요금제군
        fee || 0,          // 기본료
        '',                // 요금제코드 (추후 필요 시 사용)
        'Y',               // 사용여부
        ''                 // 비고
      ]);
      created++;
    }

    perCarrierStats[carrier] = { count: created };
  }

  // 🔥 태스크 9 Safety Lock: 데이터가 0건이면 기존 데이터를 지우지 않고 중단
  if (allRows.length === 0) {
    const msg = `⚠️ [SafeMode] ${SHEET_PLAN_MASTER} 재빌드 중단: 새로 생성된 데이터가 0건입니다. 기존 데이터를 보호하기 위해 업데이트를 건너뜁니다.`;
    console.warn(msg);
    return { totalCount: 0, perCarrier: perCarrierStats, warning: msg };
  }

  // 기존 데이터 제거: 헤더를 제외한 모든 행 삭제
  try {
    // 먼저 기존 데이터 행 수 확인
    const existingRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_PLAN_MASTER}!A:A`
      });
    });
    const existingRows = existingRes.data.values || [];
    const existingDataRowCount = existingRows.length - 1; // 헤더 제외

    // 헤더를 제외한 모든 행 삭제 (행이 있는 경우만)
    if (existingDataRowCount > 0) {
      const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_PLAN_MASTER);
      if (sheetId !== null) {
        await withRetry(async () => {
          return await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: 1, // 헤더 다음 행부터 (0-based, 헤더가 0)
                    endIndex: existingRows.length // 마지막 행까지
                  }
                }
              }]
            }
          });
        });
      }
    }
  } catch (err) {
    console.warn('[Direct][rebuildPlanMaster] 기존 데이터 삭제 실패 (계속 진행):', err.message);
    // 삭제 실패해도 계속 진행 (clear로 대체 시도)
    try {
      await withRetry(async () => {
        return await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_PLAN_MASTER}!A2:G1000` // A:G 범위 유지
        });
      });
    } catch (clearErr) {
      console.warn('[Direct][rebuildPlanMaster] clear도 실패:', clearErr.message);
    }
  }

  // 새 데이터 쓰기 (빈 행 필터링)
  const filteredRows = allRows.filter(row => row && row.length > 0 && row[0]); // 첫 번째 컬럼(통신사)이 있는 행만

  // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에 쓰기, 아니면 Google Sheets에 쓰기
  const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

  if (useDatabase) {
    // Supabase에 쓰기 (DirectStoreDAL 사용)
    console.log(`📝 [rebuildPlanMaster] Supabase에 데이터 쓰기 시작 (${filteredRows.length}개)`);
    const DirectStoreDAL = require('./dal/DirectStoreDAL');

    // 배열 데이터를 객체 배열로 변환
    const planData = filteredRows.map(row => ({
      carrier: row[0],           // 통신사
      planName: row[1],          // 요금제명
      planGroup: row[2],         // 요금제군
      basicFee: row[3] || 0,     // 기본료
      planCode: row[4] || '',    // 요금제코드
      isActive: row[5] === 'Y',  // 사용여부
      note: row[6] || ''         // 비고
    }));

    await DirectStoreDAL.rebuildPlanMaster(planData);
    console.log(`✅ [rebuildPlanMaster] Supabase에 데이터 쓰기 완료`);
  } else {
    // Google Sheets에 쓰기 (기존 로직)
    console.log(`📝 [rebuildPlanMaster] Google Sheets에 데이터 쓰기 시작 (${filteredRows.length}개)`);
    if (filteredRows.length > 0) {
      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_PLAN_MASTER,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: filteredRows }
        });
      });
    }
    console.log(`✅ [rebuildPlanMaster] Google Sheets에 데이터 쓰기 완료`);
  }

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 완료 시점 로깅 및 소요 시간 측정
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ [rebuildPlanMaster] 요금제 마스터 재빌드 완료 - ${new Date().toISOString()}`, {
    소요시간: `${elapsedTime}초`,
    총개수: filteredRows.length,
    통신사: carriers.join(', '),
    통신사별상세: perCarrierStats,
    저장위치: useDatabase ? 'Supabase' : 'Google Sheets'
  });

  return {
    totalCount: filteredRows.length,
    perCarrier: perCarrierStats
  };
}

// 단말마스터(직영점_단말마스터) 재빌드 헬퍼
async function rebuildDeviceMaster(carriersParam) {
  const carriers = carriersParam && carriersParam.length > 0 ? carriersParam : ['SK', 'KT', 'LG'];
  const { sheets, SPREADSHEET_ID } = createSheetsClient();

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 시작 시점 로깅
  const startTime = Date.now();
  console.log(`🔄 [rebuildDeviceMaster] 단말 마스터 재빌드 시작 - ${new Date(startTime).toISOString()}`, {
    통신사: carriers.join(', ')
  });

  await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_MASTER, HEADERS_MOBILE_MASTER);

  // 1. 이미지 및 태그 데이터 미리 로드 (해당 통신사만 필터링)
  let imageMap = new Map(); // Key: Carrier+ModelCode -> { imageUrl, discordMessageId, discordPostId, discordThreadId }
  let tagMap = new Map();   // Key: ModelName -> { isPremium, isBudget, ... }

  try {
    const imagesRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_MOBILE_IMAGES}!A:K` });
    });
    const imageRows = (imagesRes.data.values || []).slice(1);

    // 🔥 수정: 통신사 필터링 추가 (해당 통신사 데이터만 처리)
    for (const row of imageRows) {
      const c = (row[0] || '').toString().trim().toUpperCase();

      // 해당 통신사만 처리
      if (!carriers.includes(c)) continue;

      const code = normalizeModelCode(row[1] || row[2]); // ModelID or ModelName
      const url = (row[5] || '').toString().trim();
      const discordMessageId = (row[8] || '').toString().trim(); // I: Discord메시지ID
      const discordPostId = (row[9] || '').toString().trim(); // J: Discord포스트ID
      const discordThreadId = (row[10] || '').toString().trim(); // K: Discord스레드ID
      if (c && code && url) {
        imageMap.set(`${c}:${code}`, {
          imageUrl: url,
          discordMessageId: discordMessageId || null,
          discordPostId: discordPostId || null,
          discordThreadId: discordThreadId || null
        });
      }
    }

    console.log(`📊 [rebuildDeviceMaster] 이미지 데이터 로드 완료: ${imageMap.size}개`);

    const todaysRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SHEET_TODAYS_MOBILES });
    });
    const todaysRows = (todaysRes.data.values || []).slice(1);
    const TODAYS_HEADERS_MAP = {
      isPopular: 9, // J
      isRecommended: 10, // K
      isCheap: 11, // L
      isPremium: 12, // M
      isBudget: 13, // N
    };
    for (const row of todaysRows) {
      const modelName = (row[0] || '').toString().trim(); // A열 ModelName
      if (!modelName) continue;
      const tags = {
        isPopular: parseBooleanFlag(row[TODAYS_HEADERS_MAP.isPopular]),
        isRecommended: parseBooleanFlag(row[TODAYS_HEADERS_MAP.isRecommended]),
        isCheap: parseBooleanFlag(row[TODAYS_HEADERS_MAP.isCheap]),
        isPremium: parseBooleanFlag(row[TODAYS_HEADERS_MAP.isPremium]),
        isBudget: parseBooleanFlag(row[TODAYS_HEADERS_MAP.isBudget]),
      };
      // 원본 모델명과 정규화된 모델명 모두 키로 저장 (매칭 강화)
      tagMap.set(modelName, tags);
      const normalizedModel = normalizeModelCode(modelName);
      if (normalizedModel && normalizedModel !== modelName) {
        tagMap.set(normalizedModel, tags);
      }
    }
  } catch (err) {
    // 🔥 태스크 7.2: 로그 빈도 제한 적용 - 백그라운드 작업 실패 시 경고 로그 빈도 제한
    logWarningOnce(
      'rebuildDeviceMaster-auxiliary-data-load-failure',
      '[Direct][rebuildDeviceMaster] 보조 데이터(이미지/태그) 로딩 실패 (일부 누락 가능):',
      { 오류메시지: err.message, 통신사: carriers.join(', ') }
    );
  }

  const allRows = [];
  const perCarrierStats = {};

  for (const carrier of carriers) {
    // 2. LinkSettings에서 support 설정 로드 (모델 목록의 기준)
    const settingsRows = await getLinkSettings(carrier);
    const supportRow = settingsRows.find(
      row => (row[0] || '').toString().trim() === carrier &&
        (row[1] || '').toString().trim() === 'support'
    );

    if (!supportRow) {
      perCarrierStats[carrier] = { count: 0, warning: 'support(단말목록) 설정을 찾을 수 없습니다.' };
      continue;
    }

    const sheetId = (supportRow[2] || '').toString().trim();
    let configJson = {};
    try {
      configJson = supportRow[4] ? JSON.parse(supportRow[4]) : {};
    } catch (err) {
      console.warn('[Direct][rebuildDeviceMaster] support JSON 파싱 실패:', err.message);
    }

    const { modelRange, petNameRange, factoryPriceRange, makerRange } = configJson;

    if (!sheetId || !modelRange) {
      perCarrierStats[carrier] = { count: 0, warning: 'support 시트ID 또는 모델 범위가 없습니다.' };
      continue;
    }

    // 3. 실제 모델 데이터 읽기
    // 🔥 성능 개선: Batch Get 사용 (1번의 API 호출로 4개 범위 조회)
    let models = [], petNames = [], makers = [], prices = [];
    const rangesToFetch = [];

    // 범위가 있는 경우만 요청 목록에 추가
    if (modelRange) rangesToFetch.push(modelRange);
    if (petNameRange) rangesToFetch.push(petNameRange);
    if (makerRange) rangesToFetch.push(makerRange);
    if (factoryPriceRange) rangesToFetch.push(factoryPriceRange);

    if (rangesToFetch.length > 0) {
      try {
        const batchRes = await withRetry(async () => {
          return await sheets.spreadsheets.values.batchGet({
            spreadsheetId: sheetId,
            ranges: rangesToFetch,
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE'
          });
        });

        const valueRanges = batchRes.data.valueRanges || [];

        // 결과 매핑 (요청 순서대로)
        let responseIndex = 0;
        if (modelRange) models = valueRanges[responseIndex++]?.values || [];
        if (petNameRange) petNames = valueRanges[responseIndex++]?.values || [];
        if (makerRange) makers = valueRanges[responseIndex++]?.values || [];
        if (factoryPriceRange) prices = valueRanges[responseIndex++]?.values || [];
      } catch (err) {
        console.warn(`[Direct] ${carrier} 모델 데이터 Batch Get 실패:`, err.message);
        // 실패 시 개별 조회 시도하지 않고 빈 배열 처리 (또는 필요시 개별 조회 폴백 로직 추가 가능)
      }
    }

    const flatModels = models.flat().map(v => (v || '').toString().trim());
    const flatPets = petNames.flat().map(v => (v || '').toString().trim());
    const flatMakers = makers.flat().map(v => (v || '').toString().trim());
    const flatPrices = prices.flat().map(v => {
      const n = Number((v || '').toString().replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? 0 : n;
    });

    // ⚠ 주의: 이통사 지원금 시트에는 중간중간 완전히 비어 있는 행이 섞여 있을 수 있다.
    // 이러한 행은 의미가 없으므로, "모델명도 없고 출고가도 0"인 행만 제거하고
    // 나머지 행(5G중고/LTE중고 포함)은 그대로 보존하여 인덱스를 유지한다.
    const filteredModels = [];
    const filteredPets = [];
    const filteredMakers = [];
    const filteredPrices = [];

    const maxLength = Math.max(flatModels.length, flatPrices.length);
    for (let i = 0; i < maxLength; i++) {
      const modelName = flatModels[i];
      const price = flatPrices[i] || 0;

      // 1) 모델명도 없고 출고가도 0이면 "완전히 빈 행" → 스킵
      if (!modelName && price === 0) {
        continue;
      }

      // 2) 그 외의 경우(중고/실제 모델/0원 출고가 포함)는 그대로 유지
      filteredModels.push(modelName);
      filteredPets.push(flatPets[i] || modelName);
      filteredMakers.push(flatMakers[i] || '');
      filteredPrices.push(price);
    }

    let created = 0;
    const effectiveLength = filteredModels.length;

    // 먼저 carrier별 로우를 생성한 뒤,
    // 정책표( policy 링크의 modelRange ) 순서에 맞춰 정렬한다.
    const carrierRows = [];

    for (let i = 0; i < effectiveLength; i++) {
      const modelName = filteredModels[i];
      if (!modelName) continue; // 모델명이 없으면 스킵

      const petName = filteredPets[i] || modelName;
      const factoryPrice = filteredPrices[i] || 0;
      const maker = filteredMakers[i] || ''; // 제조사가 없으면 빈칸 (추후 보완 가능)

      const normalizedCode = normalizeModelCode(modelName);
      const tags = tagMap.get(modelName) || {
        isPremium: false, isBudget: false, isPopular: false, isRecommended: false, isCheap: false
      };

      // 이미지 매칭: Carrier+ModelCode 우선, 없으면 Carrier+ModelName
      const imageInfo = imageMap.get(`${carrier}:${normalizedCode}`) || imageMap.get(`${carrier}:${modelName}`) || null;
      let imageUrl = imageInfo && typeof imageInfo === 'object' ? imageInfo.imageUrl : (imageInfo || '');
      const discordMessageId = imageInfo && typeof imageInfo === 'object' ? (imageInfo.discordMessageId || '') : '';
      const discordPostId = imageInfo && typeof imageInfo === 'object' ? (imageInfo.discordPostId || '') : '';
      const discordThreadId = imageInfo && typeof imageInfo === 'object' ? (imageInfo.discordThreadId || '') : '';

      // 기본 요금제군 결정
      let defaultPlanGroup = '115군';
      if (tags.isBudget) defaultPlanGroup = '33군';
      // 프리미엄/기타는 115군

      carrierRows.push([
        carrier,           // 0: 통신사
        normalizedCode,   // 1: 모델ID (정규화된 코드 사용)
        modelName,        // 2: 원본 모델명
        petName,          // 3: 펫네임
        maker,            // 4: 제조사
        factoryPrice,     // 5: 출고가
        defaultPlanGroup, // 6: 기본요금제군
        tags.isPremium ? 'Y' : 'N',    // 7: isPremium
        tags.isBudget ? 'Y' : 'N',     // 8: isBudget
        tags.isPopular ? 'Y' : 'N',    // 9: isPopular
        tags.isRecommended ? 'Y' : 'N', // 10: isRecommended
        tags.isCheap ? 'Y' : 'N',      // 11: isCheap
        imageUrl,         // 12: 이미지URL
        'Y',              // 13: 사용여부 기본값 Y
        '',               // 14: 비고
        discordMessageId, // 15: Discord메시지ID
        discordPostId,    // 16: Discord포스트ID
        discordThreadId  // 17: Discord스레드ID
      ]);
      created++;
    }

    // 정책표 링크 설정에서 모델 순서를 가져와 정렬 기준으로 사용
    const policyRow = settingsRows.find(
      row => (row[0] || '').toString().trim() === carrier &&
        (row[1] || '').toString().trim() === 'policy'
    );

    const policyOrderMap = new Map(); // key: 모델명/정규화코드 -> index

    if (policyRow && policyRow[2] && policyRow[4]) {
      const policySheetId = (policyRow[2] || '').toString().trim();
      let policyConfig = {};
      try {
        policyConfig = policyRow[4] ? JSON.parse(policyRow[4]) : {};
      } catch (e) {
        console.warn(`[Direct][rebuildDeviceMaster] ${carrier} policy 설정 JSON 파싱 실패:`, e.message);
      }

      const policyModelRange = policyConfig.modelRange;

      if (policySheetId && policyModelRange) {
        try {
          const policyModels = await getSheetData(policySheetId, policyModelRange);
          const flatPolicyModels = policyModels.flat().map(v => (v || '').toString().trim());

          flatPolicyModels.forEach((name, idx) => {
            if (!name) return;
            const norm = normalizeModelCode(name);

            if (!policyOrderMap.has(name)) {
              policyOrderMap.set(name, idx);
            }
            if (norm && !policyOrderMap.has(norm)) {
              policyOrderMap.set(norm, idx);
            }
          });
        } catch (e) {
          console.warn(`[Direct][rebuildDeviceMaster] ${carrier} policy 모델 범위 로딩 실패:`, e.message);
        }
      }
    }

    if (policyOrderMap.size > 0) {
      // 정책표 모델 순서 기준 정렬
      carrierRows.sort((a, b) => {
        const modelA = (a[2] || '').toString().trim();
        const modelB = (b[2] || '').toString().trim();
        const normA = normalizeModelCode(modelA);
        const normB = normalizeModelCode(modelB);

        const idxA = policyOrderMap.has(modelA)
          ? policyOrderMap.get(modelA)
          : (policyOrderMap.has(normA) ? policyOrderMap.get(normA) : Number.MAX_SAFE_INTEGER);
        const idxB = policyOrderMap.has(modelB)
          ? policyOrderMap.get(modelB)
          : (policyOrderMap.has(normB) ? policyOrderMap.get(normB) : Number.MAX_SAFE_INTEGER);

        if (idxA === idxB) {
          // 둘 다 정책표에 없거나 같은 인덱스면, 원래 순서 유지
          return 0;
        }
        return idxA - idxB;
      });
    }

    // 중복 제거: 정책표 순서를 유지하면서 모델명/정규화코드 기준으로 첫 번째만 유지
    const seenModels = new Set(); // 이미 본 모델명/정규화코드 추적
    const uniqueCarrierRows = [];

    for (const row of carrierRows) {
      const modelName = (row[2] || '').toString().trim();
      const normalizedCode = (row[1] || '').toString().trim(); // 모델ID (정규화된 코드)

      // 중복 체크: 모델명 또는 정규화코드가 이미 나왔으면 스킵
      if (seenModels.has(modelName) || seenModels.has(normalizedCode)) {
        continue;
      }

      // 첫 번째로 나온 모델만 추가
      seenModels.add(modelName);
      if (normalizedCode && normalizedCode !== modelName) {
        seenModels.add(normalizedCode);
      }
      uniqueCarrierRows.push(row);
    }

    // 중복 제거된 carrierRows를 전체 allRows에 합치기
    for (const row of uniqueCarrierRows) {
      allRows.push(row);
    }

    perCarrierStats[carrier] = { count: uniqueCarrierRows.length };
  }

  // 🔥 태스크 9 Safety Lock: 데이터가 0건이면 기존 데이터를 지우지 않고 중단
  if (allRows.length === 0) {
    const msg = `⚠️ [SafeMode] ${SHEET_MOBILE_MASTER} 재빌드 중단: 새로 생성된 데이터가 0건입니다. 기존 데이터를 보호하기 위해 업데이트를 건너뜁니다.`;
    console.warn(msg);
    return { success: false, warning: msg };
  }

  // 기존 데이터 제거: 헤더를 제외한 모든 행 삭제
  try {
    // 먼저 기존 데이터 행 수 확인
    const existingRes = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_MOBILE_MASTER}!A:A`
      });
    });
    const existingRows = existingRes.data.values || [];
    const existingDataRowCount = existingRows.length - 1; // 헤더 제외

    // 헤더를 제외한 모든 행 삭제 (행이 있는 경우만)
    if (existingDataRowCount > 0) {
      const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_MOBILE_MASTER);
      if (sheetId !== null) {
        await withRetry(async () => {
          return await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: 1, // 헤더 다음 행부터 (0-based, 헤더가 0)
                    endIndex: existingRows.length // 마지막 행까지
                  }
                }
              }]
            }
          });
        });
      }
    }
  } catch (err) {
    console.warn('[Direct][rebuildDeviceMaster] 기존 데이터 삭제 실패 (계속 진행):', err.message);
    // 삭제 실패해도 계속 진행 (clear로 대체 시도)
    try {
      await withRetry(async () => {
        return await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_MOBILE_MASTER}!A2:O1000` // 더 넓은 범위로 clear
        });
      });
    } catch (clearErr) {
      console.warn('[Direct][rebuildDeviceMaster] clear도 실패:', clearErr.message);
    }
  }

  // 새 데이터 쓰기 (빈 행 필터링)
  const filteredRows = allRows.filter(row => row && row.length > 0 && row[0]); // 첫 번째 컬럼(통신사)이 있는 행만

  // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에 쓰기, 아니면 Google Sheets에 쓰기
  const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

  if (useDatabase) {
    // Supabase에 쓰기 (DirectStoreDAL 사용)
    console.log(`📝 [rebuildDeviceMaster] Supabase에 데이터 쓰기 시작 (${filteredRows.length}개)`);
    const DirectStoreDAL = require('./dal/DirectStoreDAL');

    // 배열 데이터를 객체 배열로 변환
    const deviceData = filteredRows.map(row => ({
      carrier: row[0],                    // 통신사
      modelId: row[1],                    // 모델ID
      modelName: row[2],                  // 모델명
      petName: row[3] || '',              // 펫네임
      manufacturer: row[4] || '',         // 제조사
      factoryPrice: row[5] || 0,          // 출고가
      defaultPlanGroup: row[6] || '',     // 기본요금제군
      isPremium: row[7] === 'Y',          // isPremium
      isBudget: row[8] === 'Y',           // isBudget
      isPopular: row[9] === 'Y',          // isPopular
      isRecommended: row[10] === 'Y',     // isRecommended
      isCheap: row[11] === 'Y',           // isCheap
      imageUrl: row[12] || '',            // 이미지URL
      isActive: row[13] === 'Y',          // 사용여부
      note: row[14] || '',                // 비고
      discordMessageId: row[15] || '',    // Discord메시지ID
      discordPostId: row[16] || '',       // Discord포스트ID
      discordThreadId: row[17] || ''      // Discord스레드ID
    }));

    await DirectStoreDAL.rebuildDeviceMaster(deviceData);
    console.log(`✅ [rebuildDeviceMaster] Supabase에 데이터 쓰기 완료`);
  } else {
    // Google Sheets에 쓰기 (기존 로직)
    console.log(`📝 [rebuildDeviceMaster] Google Sheets에 데이터 쓰기 시작 (${filteredRows.length}개)`);
    if (filteredRows.length > 0) {
      // 시트 크기 확인 및 확장
      const requiredRows = filteredRows.length + 1; // 헤더 포함
      const requiredCols = Math.max(...filteredRows.map(row => row.length), 18); // 최소 18열 (R열)

      try {
        const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_MOBILE_MASTER);
        if (sheetId !== null) {
          const spreadsheet = await withRetry(async () => {
            return await sheets.spreadsheets.get({
              spreadsheetId: SPREADSHEET_ID,
              fields: 'sheets.properties'
            });
          });
          const sheet = spreadsheet.data.sheets.find(s => s.properties.sheetId === sheetId);
          if (sheet && sheet.properties.gridProperties) {
            const currentRows = sheet.properties.gridProperties.rowCount || 1;
            const currentCols = sheet.properties.gridProperties.columnCount || 26;

            if (currentRows < requiredRows || currentCols < requiredCols) {
              console.log(`[Direct][rebuildDeviceMaster] 시트 크기 확장: ${currentRows}행/${currentCols}열 -> ${requiredRows}행/${requiredCols}열`);
              await withRetry(async () => {
                return await sheets.spreadsheets.batchUpdate({
                  spreadsheetId: SPREADSHEET_ID,
                  resource: {
                    requests: [{
                      updateSheetProperties: {
                        properties: {
                          sheetId: sheetId,
                          gridProperties: {
                            rowCount: Math.max(currentRows, requiredRows + 10), // 여유 공간 추가
                            columnCount: Math.max(currentCols, requiredCols + 5) // 여유 공간 추가
                          }
                        },
                        fields: 'gridProperties.rowCount,gridProperties.columnCount'
                      }
                    }]
                  }
                });
              });
            }
          }
        }
      } catch (expandErr) {
        console.warn('[Direct][rebuildDeviceMaster] 시트 크기 확장 실패 (계속 진행):', expandErr.message);
      }

      await withRetry(async () => {
        // A2부터 시작하도록 명시 (헤더는 A1에 있음)
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_MOBILE_MASTER}!A2:R${filteredRows.length + 1}`, // A2부터 R열까지
          valueInputOption: 'USER_ENTERED',
          resource: { values: filteredRows }
        });
      });
    }
    console.log(`✅ [rebuildDeviceMaster] Google Sheets에 데이터 쓰기 완료`);
  }

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 완료 시점 로깅 및 소요 시간 측정
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ [rebuildDeviceMaster] 단말 마스터 재빌드 완료 - ${new Date().toISOString()}`, {
    소요시간: `${elapsedTime}초`,
    총개수: filteredRows.length,
    통신사: carriers.join(', '),
    통신사별상세: perCarrierStats,
    저장위치: useDatabase ? 'Supabase' : 'Google Sheets'
  });

  return {
    success: true,
    totalCount: filteredRows.length,
    perCarrier: perCarrierStats,
    carriers: carriers
  };
}

// 단말요금정책(직영점_단말요금정책) 재빌드 헬퍼
async function rebuildPricingMaster(carriersParam) {
  const carriers = carriersParam && carriersParam.length > 0 ? carriersParam : ['SK', 'KT', 'LG'];
  const { sheets, SPREADSHEET_ID } = createSheetsClient();

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 시작 시점 로깅
  const startTime = Date.now();
  console.log(`🔄 [rebuildPricingMaster] 단말 요금정책 재빌드 시작 - ${new Date(startTime).toISOString()}`, {
    통신사: carriers.join(', ')
  });

  await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_PRICING, HEADERS_MOBILE_PRICING);

  // 1. 단말 마스터 읽기 (활성화된 모델만)
  let mobileMasterRows = [];
  try {
    const res = await withRetry(() => sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: SHEET_MOBILE_MASTER }));
    const rows = (res.data.values || []).slice(1);
    mobileMasterRows = rows.filter(r => (r[13] || 'Y').toString().toUpperCase() !== 'N');

    if (mobileMasterRows.length === 0) {
      console.warn('[Direct][rebuildPricingMaster] 단말 마스터에 활성화된 모델이 없습니다.');
      return {
        totalCount: 0,
        perCarrier: {
          SK: { count: 0, warning: '단말 마스터에 활성화된 모델이 없습니다.' },
          KT: { count: 0, warning: '단말 마스터에 활성화된 모델이 없습니다.' },
          LG: { count: 0, warning: '단말 마스터에 활성화된 모델이 없습니다.' }
        }
      };
    }
  } catch (err) {
    console.error('[Direct][rebuildPricingMaster] 단말 마스터 읽기 실패:', err);
    return {
      totalCount: 0,
      perCarrier: {
        SK: { count: 0, error: '단말 마스터 읽기 실패' },
        KT: { count: 0, error: '단말 마스터 읽기 실패' },
        LG: { count: 0, error: '단말 마스터 읽기 실패' }
      }
    };
  }

  const allRows = [];
  const perCarrierStats = {};
  // 기준일자는 문자열로 강제 입력하여 시리얼 숫자(46006 등)로 보이지 않도록 처리
  const todayStr = `'${new Date().toISOString().split('T')[0]}`;

  for (const carrier of carriers) {
    // 해당 통신사의 모델들
    const carrierModels = mobileMasterRows.filter(r => (r[0] || '').toString().trim() === carrier);
    if (carrierModels.length === 0) {
      perCarrierStats[carrier] = { count: 0, warning: '단말 마스터에 해당 통신사 모델이 없습니다.' };
      continue;
    }

    // 2. 설정 및 정책 로딩
    const settingsRows = await getLinkSettings(carrier);
    const supportRow = settingsRows.find(r => r[1] === 'support' && r[0] === carrier);

    // 🔥 핵심 수정: 정책 설정 로딩 전에 로그 추가
    console.log(`🔍 [rebuildPricingMaster] ${carrier} 정책 설정 로딩 시작...`);
    const policySettings = await getPolicySettings(carrier); // { baseMargin, addonList, insuranceList, specialPolicies }
    console.log(`✅ [rebuildPricingMaster] ${carrier} 정책 설정 로딩 완료:`, {
      baseMargin: policySettings?.baseMargin,
      addonListLength: policySettings?.addonList?.length || 0,
      insuranceListLength: policySettings?.insuranceList?.length || 0,
      specialPoliciesLength: policySettings?.specialPolicies?.length || 0
    });

    if (!supportRow) {
      perCarrierStats[carrier] = { count: 0, warning: 'support 설정 없음' };
      continue;
    }

    // 🔥 핵심 수정: policySettings 유효성 검사 및 기본값 설정
    if (!policySettings) {
      console.error(`❌ [rebuildPricingMaster] ${carrier} 정책 설정을 불러올 수 없습니다.`);
      perCarrierStats[carrier] = { count: 0, warning: '정책 설정을 불러올 수 없습니다.' };
      continue;
    }

    // 각 속성이 배열인지 확인하고, 없으면 빈 배열로 설정
    // 🔥 수정: baseMargin을 안전하게 파싱 (문자열/콤마 포함 시 처리)
    const safePolicySettings = {
      baseMargin: Number(String(policySettings.baseMargin || '0').replace(/[^0-9.-]/g, '')) || 0,
      addonList: Array.isArray(policySettings.addonList) ? policySettings.addonList : [],
      insuranceList: Array.isArray(policySettings.insuranceList) ? policySettings.insuranceList : [],
      specialPolicies: Array.isArray(policySettings.specialPolicies) ? policySettings.specialPolicies : []
    };

    // 🔥 디버그: 안전한 정책 설정 로그
    console.log(`📊 [rebuildPricingMaster] ${carrier} 안전한 정책 설정:`, safePolicySettings);

    let supportConfig = {};
    try { supportConfig = JSON.parse(supportRow[4] || '{}'); } catch (e) { }

    const supportSheetId = supportRow[2];
    const { modelRange, planGroupRanges, openingTypeRange } = supportConfig;

    if (!supportSheetId || !modelRange || !planGroupRanges) {
      perCarrierStats[carrier] = { count: 0, warning: 'support 설정 불완전 (시트ID/모델범위/요금제군범위 누락)' };
      continue;
    }

    // 2-1. 정책표 리베이트 설정 로딩 (요금제군/개통유형별)
    const policyRow = settingsRows.find(r => (r[0] || '').toString().trim() === carrier && (r[1] || '').toString().trim() === 'policy');
    const policyRebateData = {}; // { planGroup: { openingType: { model|normalizedModel: rebate } } }

    if (policyRow && policyRow[2] && policyRow[4]) {
      let policySettingsJson = {};
      try {
        policySettingsJson = JSON.parse(policyRow[4] || '{}');
      } catch (e) {
        console.warn(`[Direct][rebuildPricingMaster] ${carrier} 정책표 설정 JSON 파싱 실패:`, e.message);
      }

      const policySheetId = (policyRow[2] || '').toString().trim();
      const policyModelRange = policySettingsJson.modelRange || '';
      const policyPlanGroupRanges = policySettingsJson.planGroupRanges || {};

      if (policySheetId && policyModelRange && policyPlanGroupRanges && Object.keys(policyPlanGroupRanges).length > 0) {
        try {
          // 1) 정책표 모델명 목록 읽기
          const modelValues = await getSheetData(policySheetId, policyModelRange);
          const policyModels = (modelValues || [])
            .flat()
            .map(v => (v || '').toString().trim());

          // 2) 각 요금제군/개통유형별 리베이트 범위 읽기
          // 🔥 성능 개선: 모든 리베이트 범위를 병렬로 읽기
          const rebateLoadPromises = [];
          const rebateLoadMap = new Map(); // key: `${pgName}|${openingType}`, value: { pgName, openingType, range }

          for (const [pgName, typeRanges] of Object.entries(policyPlanGroupRanges)) {
            if (typeof typeRanges !== 'object') continue;
            if (!policyRebateData[pgName]) policyRebateData[pgName] = {};

            for (const [openingType, range] of Object.entries(typeRanges)) {
              if (!range) {
                policyRebateData[pgName][openingType] = {};
                continue;
              }

              const key = `${pgName}|${openingType}`;
              rebateLoadMap.set(key, { pgName, openingType, range });
              rebateLoadPromises.push(
                getSheetData(policySheetId, range)
                  .then(rebateValues => ({ key, rebateValues, success: true }))
                  .catch(err => ({ key, error: err, success: false }))
              );
            }
          }

          // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
          const rebateResults = [];
          for (const promise of rebateLoadPromises) {
            rebateResults.push(await promise);
          }

          // 결과 처리
          for (const result of rebateResults) {
            const { pgName, openingType, range } = rebateLoadMap.get(result.key);

            if (!result.success) {
              console.warn(`[Direct][rebuildPricingMaster] ${carrier} 리베이트 범위 로딩 실패:`, {
                planGroup: pgName,
                openingType,
                range,
                error: result.error?.message
              });
              policyRebateData[pgName][openingType] = {};
              continue;
            }

            const flatRebates = (result.rebateValues || [])
              .flat()
              .map(v => {
                const n = Number((v || '').toString().replace(/,/g, ''));
                // 정책표는 "단위(만원)"로 관리되는 경우가 많아 10,000을 곱해 원 단위로 변환
                return isNaN(n) ? 0 : n * 10000;
              });

            const rebateMap = {};
            const maxLen = Math.min(policyModels.length, flatRebates.length);
            for (let i = 0; i < maxLen; i++) {
              const m = policyModels[i];
              if (!m) continue;
              const rebate = flatRebates[i] || 0;

              // 원본 모델명
              rebateMap[m] = rebate;

              // 정규화된 모델명/대소문자 변형도 함께 저장해 매칭 성공률을 높임
              const norm = normalizeModelCode(m);
              if (norm) {
                rebateMap[norm] = rebate;
                rebateMap[norm.toLowerCase()] = rebate;
                rebateMap[norm.toUpperCase()] = rebate;
              }
              rebateMap[m.toLowerCase()] = rebate;
              rebateMap[m.toUpperCase()] = rebate;
            }

            policyRebateData[pgName][openingType] = rebateMap;
          }
        } catch (err) {
          console.warn(`[Direct][rebuildPricingMaster] ${carrier} 정책표 리베이트 데이터 로딩 실패:`, err.message);
        }
      }
    }

    // 3. 지원금표(Support Sheet) 데이터 읽기
    // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
    const supportOpeningTypeRange = openingTypeRange || '';
    const modelData = await getSheetData(supportSheetId, modelRange);
    const openingTypeData = supportOpeningTypeRange ? await getSheetData(supportSheetId, supportOpeningTypeRange) : [];

    // 모델명 리스트 (매칭용)
    const supportModelsRaw = (modelData || []).flat().map(v => (v || '').toString().trim());
    let supportOpeningTypeRows = openingTypeData || [];

    // 각 요금제군별 지원금 컬럼 읽기 (원본 배열 보존)
    // 🔥 성능 개선: 모든 요금제군별 지원금 컬럼을 병렬로 읽기
    const planGroupDataMapRaw = {}; // Key: PlanGroup -> Array of Supports
    const supportLoadPromises = [];
    const supportLoadMap = new Map(); // key: pgName, value: pgRange

    for (const [pgNameRaw, pgRange] of Object.entries(planGroupRanges)) {
      if (!pgRange) continue;
      const pgName = pgNameRaw.trim(); // 🔥 핵심 수정: 키 공백 제거
      supportLoadMap.set(pgName, pgRange);
      supportLoadPromises.push(
        getSheetData(supportSheetId, pgRange)
          .then(supportValues => ({ pgName, supportValues, success: true }))
          .catch(err => ({ pgName, error: err, success: false }))
      );
    }

    // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
    const supportResults = [];
    for (const promise of supportLoadPromises) {
      supportResults.push(await promise);
    }

    // 결과 처리
    for (const result of supportResults) {
      if (!result.success) {
        console.warn(`[Direct][rebuildPricingMaster] ${carrier} 요금제군별 지원금 로딩 실패:`, {
          planGroup: result.pgName,
          error: result.error?.message
        });
        planGroupDataMapRaw[result.pgName] = [];
        continue;
      }

      const supportValues = (result.supportValues || []).flat();
      planGroupDataMapRaw[result.pgName] = supportValues.map(v => {
        const n = Number((v || '').toString().replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? 0 : n;
      });
    }

    // 3-1. 지원금표에서 완전히 빈 행만 제거하여 인덱스 정렬
    const validIndexes = [];
    const maxSupportLen = supportModelsRaw.length;

    for (let i = 0; i < maxSupportLen; i++) {
      const modelName = (supportModelsRaw[i] || '').toString().trim();

      // 각 요금제군에서 이 인덱스의 지원금 합 (절대값 기준) 계산
      let supportAbsSum = 0;
      for (const arr of Object.values(planGroupDataMapRaw)) {
        if (Array.isArray(arr) && i < arr.length) {
          supportAbsSum += Math.abs(arr[i] || 0);
        }
      }

      // 1) 모델명도 없고 모든 요금제군에서 지원금이 0이면 완전히 빈 행 → 스킵
      if (!modelName && supportAbsSum === 0) {
        continue;
      }

      validIndexes.push(i);
    }

    // 필터링된 모델/지원금 배열 생성 (이후 로직은 이 배열을 기준으로 진행)
    const supportModels = validIndexes.map(idx => supportModelsRaw[idx]);
    const planGroupDataMap = {};
    for (const [pgName, arr] of Object.entries(planGroupDataMapRaw)) {
      planGroupDataMap[pgName] = validIndexes.map(idx => (arr[idx] || 0));
    }

    // 3-2. 요금제군 + 개통유형별 이통사지원금 맵 생성
    // planGroupSupportData[planGroup][`${model}|openingType`] = supportValue
    const planGroupSupportData = {};
    // 🔥 성능 개선: supportOpeningTypeRows는 이미 병렬로 읽었으므로 재사용 (1094번 라인)
    // 🔥 핵심 수정: getMobileList와 동일하게 같은 인덱스 사용 (오프셋 없이)
    // planGroupSupportData 생성 시에도 같은 인덱스를 사용하므로, 여기서도 같은 인덱스 사용
    // supportModelsRaw와 supportOpeningTypeRows는 같은 시작 행에서 시작한다고 가정

    // 🔥 성능 개선: supportOpeningTypeRows는 이미 병렬로 읽었으므로 재사용 (1094번 라인에서 읽음)
    if (supportOpeningTypeRange && supportOpeningTypeRows.length === 0) {
      // 혹시 읽지 못한 경우에만 다시 읽기
      supportOpeningTypeRows = await getSheetData(supportSheetId, supportOpeningTypeRange);
    }

    if (supportOpeningTypeRange) {

      // 🔥 성능 개선: 디버깅 로그는 개발 환경에서만 실행 (프로덕션 성능 향상)
      if (process.env.NODE_ENV === 'development' && validIndexes.length > 0) {
        const firstOriginalIndex = validIndexes[0];
        const firstModelName = (supportModelsRaw[firstOriginalIndex] || '').toString().trim();
        // 같은 인덱스 사용 (오프셋 없이)
        const firstOpeningTypeRaw = (supportOpeningTypeRows[firstOriginalIndex]?.[0] || '').toString().trim();

        // 첫 번째 모델의 모든 행 찾기 (같은 모델명이 여러 행에 있을 수 있음)
        // 주의: 모델명이 연속되지 않을 수 있으므로 validIndexes 전체를 검색
        const firstModelEntries = [];
        for (let i = 0; i < validIndexes.length; i++) {
          const idx = validIndexes[i];
          const modelName = (supportModelsRaw[idx] || '').toString().trim();
          if (modelName === firstModelName) {
            const openingTypeRaw = (supportOpeningTypeRows[idx]?.[0] || '').toString().trim();
            firstModelEntries.push({
              index: idx,
              openingTypeRaw: openingTypeRaw,
              parsedTypes: parseOpeningTypes(openingTypeRaw)
            });
          }
          // 다른 모델이 나와도 계속 검색 (같은 모델이 여러 행에 분산되어 있을 수 있음)
          // 하지만 성능을 위해 처음 20개 행만 검색
          if (i >= 20) break;
        }

        console.log(`[Direct][rebuildPricingMaster] ${carrier} openingType 데이터 확인:`, {
          modelRange,
          openingTypeRange: supportOpeningTypeRange,
          firstModelName,
          firstOriginalIndex,
          firstOpeningTypeRaw,
          supportModelsRawLength: supportModelsRaw.length,
          supportOpeningTypeRowsLength: supportOpeningTypeRows.length,
          firstModelAllEntries: firstModelEntries // 첫 번째 모델의 모든 행
        });
      }
    }

    // 모델별 entry를 먼저 그룹핑 (openingTypeRaw, openingTypes, rowIndex)
    const maxIndexedLen = validIndexes.length;
    const modelEntriesMap = {}; // { modelName: [{ openingTypeRaw, openingTypes, rowIndex }] }

    for (let idxPos = 0; idxPos < maxIndexedLen; idxPos++) {
      const originalIndex = validIndexes[idxPos];
      const modelName = (supportModelsRaw[originalIndex] || '').toString().trim();
      if (!modelName) continue;

      // 🔥 핵심 수정: getMobileList와 동일하게 같은 인덱스 사용 (오프셋 없이)
      // planGroupSupportData 생성 시에도 같은 인덱스를 사용하므로, 여기서도 같은 인덱스 사용
      // supportModelsRaw와 supportOpeningTypeRows는 같은 시작 행에서 시작한다고 가정
      const openingTypeIndex = originalIndex;

      // 배열 범위 체크 및 안전한 접근
      let openingTypeRaw = '';
      if (openingTypeIndex >= 0 && openingTypeIndex < supportOpeningTypeRows.length) {
        openingTypeRaw = (supportOpeningTypeRows[openingTypeIndex]?.[0] || '').toString().trim();
      } else if (process.env.NODE_ENV === 'development') {
        // 개발 환경에서만 경고 로그
        console.warn(`[Direct][rebuildPricingMaster] openingTypeIndex 범위 초과: originalIndex=${originalIndex}, calculatedIndex=${openingTypeIndex}, arrayLength=${supportOpeningTypeRows.length}`);
      }

      const openingTypes = parseOpeningTypes(openingTypeRaw);

      if (!modelEntriesMap[modelName]) {
        modelEntriesMap[modelName] = [];
      }
      modelEntriesMap[modelName].push({
        openingTypeRaw,
        openingTypes,
        rowIndex: idxPos // idxPos = index into supportModels/planGroupDataMap[*]
      });
    }

    // 요금제군별로, 위에서 만든 modelEntriesMap을 이용해 openingType별 지원금 맵 구성
    for (const [pgName, supports] of Object.entries(planGroupDataMap)) {
      const supportMap = {};

      for (const [model, entries] of Object.entries(modelEntriesMap)) {
        // 이 모델에 대해 번호이동/010신규/기변/전유형 구성 파악
        const hasNumberPort = entries.some(e =>
          e.openingTypeRaw === '번호이동' || e.openingTypes.includes('번호이동')
        );
        const hasNewChange = entries.some(e =>
          e.openingTypeRaw === '010신규/기변' ||
          (e.openingTypes.includes('010신규') && e.openingTypes.includes('기변'))
        );

        const shouldIgnoreAllTypes = hasNumberPort && hasNewChange;

        for (const entry of entries) {
          const { openingTypeRaw, openingTypes, rowIndex } = entry;
          const supportValue = supports[rowIndex] || 0;

          // 값이 0이면 굳이 등록하지 않아도 됨 (기본값 0)
          if (!supportValue) continue;

          const isAllType = openingTypeRaw === '전유형' || openingTypes.includes('전유형');

          // 번호이동/010신규/기변이 모두 있는 경우 전유형은 무시
          if (isAllType && shouldIgnoreAllTypes) {
            continue;
          }

          if (isAllType) {
            // 전유형: 별도 정의가 없을 때만 세 유형(010신규/MNP/기변)에 공통 적용
            ['010신규', 'MNP', '기변'].forEach(ot => {
              const key = `${model}|${ot}`;
              if (supportMap[key] == null) {
                supportMap[key] = supportValue;
              }
            });
          } else {
            // 번호이동/010신규/기변과 같은 구체적인 유형
            openingTypes.forEach(ot => {
              const key = `${model}|${ot}`;
              supportMap[key] = supportValue;
            });
          }
        }
      }

      planGroupSupportData[pgName] = supportMap;
    }

    // 4. 가격 계산 Loop
    let createdCount = 0;
    const openingTypes = ['010신규', 'MNP', '기변'];

    // 부가서비스/보험 총액 계산 (단순화: 필수 부가서비스의 미유치 차감금액 합산 등)
    // 실제 로직: OpeningInfoPage에서는 사용자가 선택. 여기서는 마스터 기준 '최대지원'과 '기본지원' 등을 정의해야 함.
    // 전략: 'StoreSupportWithAddon'(풀유치) 와 'StoreSupportWithoutAddon'(미유치) 두 가지를 계산.
    // 풀유치: 정책마진 - 최소마진(0?) + (부가서비스 유치 인센티브 합)
    // 미유치: 정책마진 - 최소마진 - (부가서비스 미유치 차감 합)
    // * 복잡성을 줄이기 위해:
    //   PolicyMargin = baseMargin (from Sheet) + SpecialAdditions.
    //   StoreSupport = PolicyMargin - (TargetMargin aka MinimumProfit).
    //   여기서는 'PolicyMargin' 컬럼에 순수 정책마진을 적고,
    //   StoreSupport는 (PublicSupport + PolicyMargin) - TargetMargin 형태로 가는게 맞으나,
    //   기존 로직인 calculateMobilePrice를 흉내내야 함.
    //   간단히:
    //     StoreSupportWithAddon = (BaseMargin + SpecialPolicy) - TargetProfit(예: 5만원)
    //     StoreSupportWithoutAddon = StoreSupportWithAddon - (AddonDeductions)

    const targetProfit = 50000; // 목표 마진 (하드코딩 or 설정)
    // 🔥 핵심 수정: safePolicySettings 사용
    const totalAddonDeduction = safePolicySettings.addonList.reduce((acc, cur) => acc + Math.abs(cur.deduction || 0), 0) +
      safePolicySettings.insuranceList.reduce((acc, cur) => acc + Math.abs(cur.deduction || 0), 0);
    // 별도 정책 합계
    const specialPolicySum = safePolicySettings.specialPolicies.reduce((acc, cur) => acc + (Number(cur.addition) || 0) - (Number(cur.deduction) || 0), 0);

    // 기본 정책 마진
    // 🔥 수정: baseMargin과 specialPolicySum을 Number로 변환하여 NaN 방지
    const baseMarginRaw = Number(safePolicySettings.baseMargin) || 0;
    const specialPolicySumNum = Number(specialPolicySum) || 0;
    const baseMargin = baseMarginRaw + specialPolicySumNum;

    // 🔥 디버그: baseMargin 계산 확인 (항상 로그 출력하여 문제 추적)
    console.log(`[Direct][rebuildPricingMaster] ${carrier} 정책마진 계산:`, {
      baseMarginFromSettings: safePolicySettings.baseMargin,
      baseMarginRaw: baseMarginRaw,
      specialPolicySum: specialPolicySum,
      specialPolicySumNum: specialPolicySumNum,
      finalBaseMargin: baseMargin,
      safePolicySettings: {
        baseMargin: safePolicySettings.baseMargin,
        specialPoliciesCount: safePolicySettings.specialPolicies.length
      }
    });

    for (const mobileRow of carrierModels) {
      const modelName = mobileRow[2]; // Model Name
      const modelId = mobileRow[1];   // Model ID
      const factoryPrice = Number(mobileRow[5] || 0);

      // "5G중고", "LTE중고" 등 구분용 라벨 모델은 단말요금정책에서도 제외
      if (isDeviceCategoryRow(modelName, factoryPrice)) {
        continue;
      }

      // 지원금표에서 해당 모델의 Index 찾기 (정확한 매칭 or 정규화 매칭)
      // supportModels와 mobileRow[2](ModelName) 매칭
      const supportIdx = supportModels.findIndex(m => m === modelName); // 엄격 매칭

      if (supportIdx === -1) {
        // 모델이 지원금표에 없으면 스킵? 혹은 지원금 0으로 생성? -> 생성하고 0 처리.
        // 하지만 지원금표에 없으면 '판매불가'일 확률 높음. 일단 0으로 생성.
      }

      for (const planGroup of Object.keys(planGroupDataMap)) {
        // 해당 모델/요금제군/개통유형별 공시지원금 (planGroupSupportData 기반)

        for (const openingType of openingTypes) {
          // 이통사지원금 조회 (planGroup + openingType + modelName 기준)
          let publicSupport = 0;
          const supportMapForGroup = planGroupSupportData[planGroup] || {};
          const supportKey1 = `${modelName}|${openingType}`;
          const supportKey2 = `${normalizeModelCode(modelName)}|${openingType}`;
          const supportDataEntry = supportMapForGroup[supportKey1] ||
            supportMapForGroup[supportKey2];

          if (supportDataEntry != null) {
            publicSupport = Number(supportDataEntry) || 0;
          } else if (process.env.NODE_ENV === 'development' && modelName.includes('SM-S926N256')) {
            // 첫 번째 모델 디버깅용
            console.warn(`[Direct][rebuildPricingMaster] ${carrier} 이통사지원금 조회 실패:`, {
              modelName,
              planGroup,
              openingType,
              supportKey1,
              supportKey2,
              supportMapKeys: Object.keys(supportMapForGroup).slice(0, 10),
              supportMapForGroupSize: Object.keys(supportMapForGroup).length
            });
          }

          // 정책표 리베이트 조회 (planGroup + openingType + modelName 기준)
          let policyRebate = 0;
          const rebateByGroup = policyRebateData[planGroup] || {};
          const rebateMap = rebateByGroup[openingType] || {};

          if (rebateMap && Object.keys(rebateMap).length > 0) {
            const norm = normalizeModelCode(modelName);
            const candidates = [
              modelName,
              modelName && modelName.toLowerCase(),
              modelName && modelName.toUpperCase(),
              norm,
              norm && norm.toLowerCase(),
              norm && norm.toUpperCase()
            ].filter(Boolean);

            for (const key of candidates) {
              if (rebateMap[key] != null) {
                policyRebate = Number(rebateMap[key] || 0);
                break;
              }
            }
          }

          // 부가서비스 인센티브/차감 합계 (보험은 모델별로 1개만 선택하므로 여기서는 제외)
          // 🔥 핵심 수정: safePolicySettings 사용 및 Number 변환 추가
          const addonIncentiveSum = safePolicySettings.addonList.reduce((acc, cur) => acc + (Number(cur.incentive) || 0), 0);
          const addonDeductionSum = safePolicySettings.addonList.reduce((acc, cur) => acc + (Number(cur.deduction) || 0), 0);
          const totalSpecialAddition = safePolicySettings.specialPolicies.reduce((acc, cur) => acc + (Number(cur.addition) || 0), 0);
          const totalSpecialDeduction = safePolicySettings.specialPolicies.reduce((acc, cur) => acc + (Number(cur.deduction) || 0), 0);

          // 🔥 수정: 정책마진 = 기본마진 + 별도정책 합계 (1278번 라인의 baseMargin 사용)
          // baseMargin은 for 루프 밖에서 계산되었으므로 그대로 사용

          // 보험상품: 출고가 및 모델명(플립/폴드 여부)에 맞는 보험 인센티브/차감 선택
          // 🔥 핵심 수정: safePolicySettings 사용
          const insuranceList = safePolicySettings.insuranceList || [];

          const modelNameForCheck = (modelName || '').toString();
          const lowerModelName = modelNameForCheck.toLowerCase();
          const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
          const isFlipFoldModel = flipFoldKeywords.some(keyword =>
            lowerModelName.includes(keyword.toLowerCase())
          );

          const flipFoldInsurances = insuranceList.filter(item => {
            const name = (item.name || '').toString().toLowerCase();
            return flipFoldKeywords.some(keyword =>
              name.includes(keyword.toLowerCase())
            );
          });

          const normalInsurances = insuranceList.filter(item => !flipFoldInsurances.includes(item));

          let selectedInsurance = null;

          if (carrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
            // LG + 플립/폴드 단말 → 플립/폴드 전용 보험상품 우선 적용
            selectedInsurance = flipFoldInsurances.find(insurance => {
              const minPrice = insurance.minPrice || 0;
              const maxPrice = insurance.maxPrice || 9999999;
              return factoryPrice >= minPrice && factoryPrice <= maxPrice;
            }) || flipFoldInsurances[0];
          } else {
            // 그 외 모델 → 플립/폴드 전용 상품 제외 후 출고가 구간으로 매칭
            const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceList;
            selectedInsurance = baseList.find(insurance => {
              const minPrice = insurance.minPrice || 0;
              const maxPrice = insurance.maxPrice || 9999999;
              return factoryPrice >= minPrice && factoryPrice <= maxPrice;
            });
          }

          const insuranceIncentive = selectedInsurance?.incentive || 0;
          const insuranceDeduction = selectedInsurance?.deduction || 0;

          const totalAddonIncentive = addonIncentiveSum + insuranceIncentive;
          const totalAddonDeduction = addonDeductionSum + insuranceDeduction;

          // 대리점추가지원금 계산
          // 부가유치: 정책표리베이트 - 마진 + (부가서비스/보험 인센티브) + 별도정책추가금액
          const storeSupportFull = Math.max(0,
            policyRebate
            - baseMargin
            + totalAddonIncentive
            + totalSpecialAddition
          );

          // 🔥 디버그: 대리점추가지원금 계산 확인 (특정 모델만)
          if (process.env.NODE_ENV === 'development' && modelName === 'SM-A166L' && planGroup === '33군' && openingType === 'MNP') {
            console.log(`[Direct][rebuildPricingMaster] ${carrier} 대리점추가지원금 계산 (${modelName}, ${planGroup}, ${openingType}):`, {
              policyRebate,
              baseMargin,
              totalAddonIncentive,
              totalSpecialAddition,
              calculatedStoreSupportFull: storeSupportFull,
              formula: `${policyRebate} - ${baseMargin} + ${totalAddonIncentive} + ${totalSpecialAddition} = ${storeSupportFull}`
            });
          }

          // 🔥 수정: 부가미유치 기준 제거 (부가서비스 선택/삭제 시 동적 계산으로 대체)
          // 부가미유치 계산 제거

          allRows.push([
            carrier,
            modelId,
            modelName,
            planGroup,
            '', // PlanCode (Optional)
            openingType,
            factoryPrice,
            publicSupport,
            storeSupportFull, // 대리점추가지원금_부가유치
            // 🔥 수정: 부가미유치 기준 제거 (9번째 컬럼 제거, 이후 컬럼 인덱스 -1)
            baseMargin,       // 정책마진 (직영점_정책_마진 + 별도정책 반영) - 인덱스: 9 (기존 10)
            '',               // 정책ID - 인덱스: 10 (기존 11)
            todayStr,         // 기준일자 - 인덱스: 11 (기존 12)
            ''                // 비고 - 인덱스: 12 (기존 13)
          ]);
          createdCount++;
        }
      }
    }
    perCarrierStats[carrier] = { count: createdCount };
  }

  // 데이터 쓰기
  // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에 쓰기, 아니면 Google Sheets에 쓰기
  const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

  if (useDatabase) {
    // Supabase에 쓰기 (DirectStoreDAL 사용)
    console.log(`📝 [rebuildPricingMaster] Supabase에 데이터 쓰기 시작 (${allRows.length}개)`);
    const DirectStoreDAL = require('./dal/DirectStoreDAL');

    // 배열 데이터를 객체 배열로 변환
    const pricingData = allRows.map(row => ({
      carrier: row[0],                              // 통신사
      modelId: row[1],                              // 모델ID
      modelName: row[2],                            // 모델명
      planGroup: row[3],                            // 요금제군
      planCode: row[4] || '',                       // 요금제코드
      openingType: row[5],                          // 개통유형
      factoryPrice: row[6] || 0,                    // 출고가
      publicSupport: row[7] || 0,                   // 이통사지원금
      storeAdditionalSupportWithAddon: row[8] || 0, // 대리점추가지원금_부가유치
      policyMargin: row[9] || 0,                    // 정책마진
      policyId: row[10] || '',                      // 정책ID
      baseDate: row[11] || '',                      // 기준일자
      note: row[12] || ''                           // 비고
    }));

    await DirectStoreDAL.rebuildPricingMaster(pricingData);
    console.log(`✅ [rebuildPricingMaster] Supabase에 데이터 쓰기 완료`);
  } else {
    // Google Sheets에 쓰기 (기존 로직)
    console.log(`📝 [rebuildPricingMaster] Google Sheets에 데이터 쓰기 시작 (${allRows.length}개)`);
    // 🔥 수정: 부가미유치 기준 제거로 인해 컬럼 수 감소 (14개 → 13개)
    await withRetry(async () => {
      return await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_MOBILE_PRICING}!A2:L` // 수정: M → L (A:L 범위)
      });
    });

    if (allRows.length > 0) {
      await withRetry(async () => {
        // A2부터 시작하도록 명시 (헤더는 A1에 있음)
        // 🔥 수정: 부가미유치 기준 제거로 인해 컬럼 수 감소 (14개 → 13개)
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_MOBILE_PRICING}!A2:L${allRows.length + 1}`, // 수정: M → L (A:L 범위)
          valueInputOption: 'USER_ENTERED',
          resource: { values: allRows }
        });
      });
    } else {
      // 🔥 태스크 7.2: 로그 빈도 제한 적용 - 데이터 없음 경고 로그 빈도 제한
      logWarningOnce(
        'rebuildPricingMaster-no-data',
        '[Direct][rebuildPricingMaster] 생성할 데이터가 없습니다.',
        { 통신사: carriers.join(', ') }
      );
    }
    console.log(`✅ [rebuildPricingMaster] Google Sheets에 데이터 쓰기 완료`);
  }

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 완료 시점 로깅 및 소요 시간 측정
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ [rebuildPricingMaster] 단말 요금정책 재빌드 완료 - ${new Date().toISOString()}`, {
    소요시간: `${elapsedTime}초`,
    총개수: allRows.length,
    통신사: carriers.join(', '),
    통신사별상세: perCarrierStats,
    저장위치: useDatabase ? 'Supabase' : 'Google Sheets'
  });

  return { totalCount: allRows.length, perCarrier: perCarrierStats };
}

/**
 * Discord API Rate Limit을 고려한 재시도 로직
 * @param {Function} fn - 실행할 함수
 * @param {number} maxRetries - 최대 재시도 횟수
 * @returns {Promise<any>}
 */
async function withDiscordRateLimit(fn, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Rate Limit 에러 감지 (429)
      const isRateLimitError =
        error.message && error.message.includes('429') ||
        error.message && error.message.includes('rate limit');

      if (isRateLimitError && attempt < maxRetries - 1) {
        // Discord API가 제공하는 retry_after 값 추출 (초 단위)
        let retryAfter = 0.5; // 기본값 500ms

        try {
          const match = error.message.match(/"retry_after":\s*([\d.]+)/);
          if (match) {
            retryAfter = parseFloat(match[1]);
          }
        } catch (parseError) {
          // 파싱 실패 시 기본값 사용
        }

        // Exponential backoff: retry_after + 추가 지연
        const baseDelay = retryAfter * 1000; // 초를 밀리초로 변환
        const exponentialDelay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms, 800ms...
        const jitter = Math.random() * 100; // 0~100ms 랜덤
        const totalDelay = baseDelay + exponentialDelay + jitter;

        console.warn(`⚠️ [withDiscordRateLimit] Rate Limit 발생, ${Math.round(totalDelay)}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        continue;
      }

      // Rate Limit 에러가 아니거나 최대 재시도 횟수 초과
      throw error;
    }
  }
  throw new Error('Max retries exceeded for Discord API');
}

/**
 * Discord 메시지에서 이미지 URL 가져오기
 * @param {string} messageId - Discord 메시지 ID
 * @param {string} postId - Discord 포스트 ID (선택)
 * @param {string} threadId - Discord 스레드 ID (선택)
 * @returns {Promise<string|null>} 이미지 URL 또는 null
 */
async function fetchImageUrlFromDiscordMessage(messageId, postId, threadId) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    throw new Error('Discord 설정이 없습니다 (DISCORD_BOT_TOKEN 또는 DISCORD_CHANNEL_ID 누락)');
  }

  return withDiscordRateLimit(async () => {
    // Discord API를 통해 메시지 조회
    // threadId가 있으면 스레드에서 조회, 없으면 채널에서 조회
    const channelId = threadId || DISCORD_CHANNEL_ID;
    const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API 오류: ${response.status} - ${errorText}`);
    }

    const message = await response.json();

    // 첨부 파일에서 이미지 URL 추출
    if (message.attachments && message.attachments.length > 0) {
      const imageAttachment = message.attachments.find(att =>
        att.content_type && att.content_type.startsWith('image/')
      );

      if (imageAttachment) {
        console.log(`✅ [fetchImageUrlFromDiscordMessage] 이미지 URL 찾음: ${imageAttachment.url}`);
        return imageAttachment.url;
      }
    }

    // Embed에서 이미지 URL 추출 (첨부 파일이 없는 경우)
    if (message.embeds && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        if (embed.image && embed.image.url) {
          console.log(`✅ [fetchImageUrlFromDiscordMessage] Embed 이미지 URL 찾음: ${embed.image.url}`);
          return embed.image.url;
        }
      }
    }

    throw new Error('메시지에 이미지 첨부 파일이 없습니다');
  });
}

/**
 * Discord 메시지 ID를 통한 이미지 재업로드
 * @param {string} carrier - 통신사 (SK, KT, LG)
 * @returns {Promise<Object>} { success, carrier, updatedCount, failedCount, updatedImages, failedImages }
 */
async function refreshImagesFromDiscord(carrier) {
  const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

  // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 시작 시점 로깅
  const startTime = Date.now();
  console.log(`🔄 [refreshImagesFromDiscord] ${carrier} 이미지 갱신 시작 - ${new Date(startTime).toISOString()}`);
  console.log(`📊 [refreshImagesFromDiscord] 데이터 소스: ${USE_DB ? 'Supabase' : 'Google Sheets'}`);

  try {
    const updatedImages = [];
    const failedImages = [];
    let targetRows = [];

    // 1. 데이터 소스에서 Discord 메시지 ID 조회
    if (USE_DB) {
      // Supabase에서 조회
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      const images = await DirectStoreDAL.getModelImages(carrier);

      targetRows = images.map((img, index) => ({
        row: [
          img.carrier,
          img.modelId,
          img.modelName,
          img.petName,
          img.manufacturer,
          img.imageUrl,
          img.note,
          img.color,
          img.discordMessageId,
          img.discordPostId,
          img.discordThreadId
        ],
        rowIndex: index,
        dbId: img.id // Supabase ID 저장
      }));

      console.log(`📊 [refreshImagesFromDiscord] ${carrier} 대상 (Supabase): ${targetRows.length}개`);
    } else {
      // Google Sheets에서 조회
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const imagesRes = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_MOBILE_IMAGES}!A:K`
        });
      });

      const imageRows = (imagesRes.data.values || []).slice(1); // 헤더 제외

      // 해당 통신사의 이미지만 필터링
      targetRows = imageRows
        .map((row, index) => ({ row, rowIndex: index + 2 })) // 헤더 포함 행 번호 (1-based, 헤더가 1)
        .filter(({ row }) => {
          const rowCarrier = (row[0] || '').toString().trim().toUpperCase();
          return rowCarrier === carrier;
        });

      console.log(`📊 [refreshImagesFromDiscord] ${carrier} 대상 (Google Sheets): ${targetRows.length}개`);
    }

    if (targetRows.length === 0) {
      return {
        success: true,
        carrier,
        updatedCount: 0,
        failedCount: 0,
        updatedImages: [],
        failedImages: [],
        message: '갱신할 이미지가 없습니다'
      };
    }

    // 2. Discord API를 통해 이미지 URL 갱신
    const BATCH_SIZE = 50; // 안전을 위해 50개씩 처리
    const updateRequests = []; // Google Sheets용
    const supabaseUpdates = []; // Supabase용

    for (const { row, rowIndex, dbId } of targetRows) {
      const modelId = row[1] || row[2]; // B열(모델ID) 또는 C열(모델명)
      const currentImageUrl = (row[5] || '').toString().trim(); // F열: 이미지URL
      const discordMessageId = (row[8] || '').toString().trim(); // I열: Discord메시지ID
      const discordPostId = (row[9] || '').toString().trim(); // J열: Discord포스트ID
      const discordThreadId = (row[10] || '').toString().trim(); // K열: Discord스레드ID

      if (!modelId) {
        console.warn(`⚠️ [refreshImagesFromDiscord] 모델ID 없음: 행 ${rowIndex}`);
        continue;
      }

      if (!discordMessageId) {
        console.warn(`⚠️ [refreshImagesFromDiscord] Discord 메시지 ID 없음: ${modelId}`);
        failedImages.push({
          modelId,
          reason: 'Discord 메시지 ID 없음'
        });
        continue;
      }

      try {
        // Discord API를 통해 메시지에서 첨부 파일 URL 가져오기
        const newImageUrl = await fetchImageUrlFromDiscordMessage(
          discordMessageId,
          discordPostId,
          discordThreadId
        );

        if (!newImageUrl) {
          throw new Error('Discord 메시지에서 이미지 URL을 찾을 수 없습니다');
        }

        // 이미지 URL이 변경된 경우에만 업데이트
        if (newImageUrl !== currentImageUrl) {
          if (USE_DB) {
            // Supabase 업데이트 준비
            supabaseUpdates.push({
              id: dbId,
              modelId,
              imageUrl: newImageUrl
            });
          } else {
            // Google Sheets 업데이트 준비
            updateRequests.push({
              range: `${SHEET_MOBILE_IMAGES}!F${rowIndex}`, // F열: 이미지URL
              values: [[newImageUrl]]
            });
          }

          updatedImages.push({
            modelId,
            oldUrl: currentImageUrl,
            newUrl: newImageUrl
          });

          console.log(`✅ [refreshImagesFromDiscord] ${modelId} 이미지 URL 갱신: ${newImageUrl.substring(0, 50)}...`);
        } else {
          console.log(`ℹ️ [refreshImagesFromDiscord] ${modelId} 이미지 URL 변경 없음`);
        }

        // Discord API Rate Limit은 withDiscordRateLimit 함수에서 자동 처리됨

      } catch (error) {
        // 🔥 태스크 7.1: 백엔드 오류 로깅 강화 - Discord CDN 이미지 404 오류 상세 로깅
        console.error(`❌ [refreshImagesFromDiscord] ${modelId} 이미지 갱신 실패:`, {
          오류타입: error.name || 'Error',
          오류메시지: error.message,
          스택트레이스: error.stack,
          모델정보: {
            모델ID: modelId,
            통신사: carrier,
            현재이미지URL: currentImageUrl,
            Discord메시지ID: discordMessageId,
            Discord포스트ID: discordPostId,
            Discord스레드ID: discordThreadId
          },
          요청정보: {
            행번호: rowIndex,
            데이터소스: USE_DB ? 'Supabase' : 'Google Sheets'
          }
        });
        failedImages.push({
          modelId,
          reason: error.message
        });
      }
    }

    // 3. 데이터 소스에 업데이트 적용
    if (USE_DB && supabaseUpdates.length > 0) {
      // Supabase 배치 업데이트
      console.log(`📝 [refreshImagesFromDiscord] ${carrier} Supabase 배치 업데이트 시작: ${supabaseUpdates.length}개`);

      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      for (const update of supabaseUpdates) {
        try {
          if (!update.id) {
            console.warn(`⚠️ [refreshImagesFromDiscord] 업데이트 스킵: 모델 ${update.modelId}의 DB ID가 없습니다.`);
            continue;
          }
          await DirectStoreDAL.updateModelImageUrl(update.id, update.imageUrl);
        } catch (error) {
          console.error(`❌ [refreshImagesFromDiscord] Supabase 업데이트 실패: ${update.modelId}`, error);
          failedImages.push({
            modelId: update.modelId,
            reason: `Supabase 업데이트 실패: ${error.message}`
          });
        }
      }

      console.log(`✅ [refreshImagesFromDiscord] Supabase 배치 업데이트 완료`);
    } else if (!USE_DB && updateRequests.length > 0) {
      // Google Sheets 배치 업데이트
      console.log(`📝 [refreshImagesFromDiscord] ${carrier} Google Sheets 배치 업데이트 시작: ${updateRequests.length}개`);

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 배치를 나누어 처리 (Google Sheets API Rate Limit 고려)
      for (let i = 0; i < updateRequests.length; i += BATCH_SIZE) {
        const batch = updateRequests.slice(i, i + BATCH_SIZE);

        try {
          await withRetry(async () => {
            return await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: SPREADSHEET_ID,
              resource: {
                valueInputOption: 'USER_ENTERED',
                data: batch
              }
            });
          });

          console.log(`✅ [refreshImagesFromDiscord] 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(updateRequests.length / BATCH_SIZE)} 완료`);

          // 배치 간 지연 (Google Sheets API Rate Limit 고려)
          if (i + BATCH_SIZE < updateRequests.length) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연
          }
        } catch (error) {
          // 🔥 태스크 7.1: 백엔드 오류 로깅 강화 - API 오류 상세 로깅
          console.error(`❌ [refreshImagesFromDiscord] 배치 업데이트 실패:`, {
            오류타입: error.name || 'Error',
            오류메시지: error.message,
            스택트레이스: error.stack,
            배치정보: {
              배치번호: Math.floor(i / BATCH_SIZE) + 1,
              배치크기: batch.length,
              시작인덱스: i,
              통신사: carrier
            },
            요청정보: {
              시트ID: SPREADSHEET_ID,
              시트명: SHEET_MOBILE_IMAGES,
              업데이트범위: batch.map(b => b.range).join(', ')
            }
          });
          // 실패한 배치의 이미지들을 failedImages에 추가
          batch.forEach(req => {
            const modelId = updatedImages.find(img => req.range.includes(`F`))?.modelId;
            if (modelId) {
              failedImages.push({
                modelId,
                reason: `배치 업데이트 실패: ${error.message}`
              });
            }
          });
        }
      }
    }

    // 🔥 태스크 7.3: 중요 작업 로깅 추가 - 완료 시점 로깅 및 소요 시간 측정
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [refreshImagesFromDiscord] ${carrier} 이미지 갱신 완료 - ${new Date().toISOString()}`, {
      소요시간: `${elapsedTime}초`,
      성공: updatedImages.length,
      실패: failedImages.length,
      전체: targetRows.length,
      데이터소스: USE_DB ? 'Supabase' : 'Google Sheets'
    });

    // 🔥 캐시 무효화: 이미지가 갱신되었으므로 관련 캐시 삭제
    if (updatedImages.length > 0) {
      if (!USE_DB) {
        // Google Sheets 캐시 삭제
        const { SPREADSHEET_ID } = createSheetsClient();

        // 1. 단말마스터 캐시 삭제 (해당 통신사)
        const mobileMasterCacheKey = `sheet-data-${SPREADSHEET_ID}-${SHEET_MOBILE_MASTER}!A:R`;
        cacheStore.delete(mobileMasterCacheKey);
        console.log(`🗑️ [refreshImagesFromDiscord] 캐시 삭제: ${mobileMasterCacheKey}`);

        // 2. 모델이미지 캐시 삭제 (해당 통신사)
        const mobileImagesCacheKey = `sheet-data-${SPREADSHEET_ID}-${SHEET_MOBILE_IMAGES}!A:K`;
        cacheStore.delete(mobileImagesCacheKey);
        console.log(`🗑️ [refreshImagesFromDiscord] 캐시 삭제: ${mobileImagesCacheKey}`);
      }

      // 3. rebuildDeviceMaster 관련 캐시 삭제 (이미지 맵) - 공통
      const imageMapCacheKey = `device-master-images-${carrier}`;
      cacheStore.delete(imageMapCacheKey);
      console.log(`🗑️ [refreshImagesFromDiscord] 캐시 삭제: ${imageMapCacheKey}`);

      console.log(`✅ [refreshImagesFromDiscord] ${carrier} 관련 캐시 무효화 완료`);
    }

    return {
      success: true,
      carrier,
      updatedCount: updatedImages.length,
      failedCount: failedImages.length,
      updatedImages,
      failedImages
    };
  } catch (error) {
    // 🔥 태스크 7.1: 백엔드 오류 로깅 강화 - 전체 실패 시 상세 로깅
    console.error(`❌ [refreshImagesFromDiscord] ${carrier} 전체 실패:`, {
      오류타입: error.name || 'Error',
      오류메시지: error.message,
      스택트레이스: error.stack,
      통신사: carrier,
      데이터소스: process.env.USE_DB_DIRECT_STORE === 'true' ? 'Supabase' : 'Google Sheets'
    });
    throw error;
  }
}

// 시트 데이터 읽기 함수 (캐시 적용, 동시 요청 방지)
// 🔥 중요: 이 함수는 첫 번째 행(헤더)을 제거하고 반환합니다.
// 외부 시트를 읽을 때는 헤더가 없을 수 있으므로 주의가 필요합니다.
async function getSheetData(sheetId, range, ttlMs = null) {
  // 🔥 동적 TTL 사용 (Feature Flag에 따라 다름)
  const config = getRateLimitConfig();
  const actualTtl = ttlMs || config.CACHE_FRESH_TTL;

  const cacheKey = `sheet-data-${sheetId}-${range}`;

  return withRequestDeduplication(cacheKey, async () => {
    const { sheets } = createSheetsClient();

    // 🔥 수정: 에러 핸들링 강화 및 상세 로그 추가
    try {
      const res = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: range,
          majorDimension: 'ROWS',
          valueRenderOption: 'UNFORMATTED_VALUE'
        });
      });

      const values = res.data.values || [];

      // 🔥 수정: 데이터가 비어있는 경우 경고 로그
      if (values.length === 0) {
        console.warn(`⚠️ [getSheetData] 시트 데이터가 비어있음: sheetId=${sheetId.substring(0, 10)}..., range=${range}`);
        return [];
      }

      // 🔥 수정: 첫 번째 행을 헤더로 간주하고 제거
      // 외부 시트의 경우 헤더가 없을 수 있으므로, 데이터가 1행만 있는 경우 빈 배열 반환
      const data = values.slice(1);

      // 🔥 디버그: 데이터 로딩 성공 로그 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [getSheetData] 데이터 로딩 성공: sheetId=${sheetId.substring(0, 10)}..., range=${range}, rows=${data.length}`);
      }

      return data;
    } catch (error) {
      // 🔥 수정: 에러 메시지 개선
      console.error(`❌ [getSheetData] 시트 데이터 읽기 실패:`, {
        sheetId: sheetId ? `${sheetId.substring(0, 10)}...` : 'undefined',
        range: range,
        error: error.message,
        code: error.code
      });

      // Rate Limit 에러 체크
      const isRateLimitError =
        error.code === 429 ||
        (error.message && (
          error.message.includes('Quota exceeded') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('Rate Limit') ||
          error.message.includes('quota metric')
        ));

      if (isRateLimitError) {
        throw new Error(`Google Sheets API Rate Limit 초과. 1-2분 기다린 후 다시 시도하거나, Supabase로 전환하세요 (USE_DB_DIRECT_STORE=true)`);
      }

      // 사용자 친화적인 에러 메시지 생성
      if (error.message && error.message.includes('Requested entity was not found')) {
        throw new Error(`시트를 찾을 수 없습니다. 링크설정에서 시트 ID를 확인해주세요: ${sheetId ? sheetId.substring(0, 15) + '...' : '(없음)'}`);
      } else if (error.message && error.message.includes('Unable to parse range')) {
        throw new Error(`잘못된 범위 형식입니다: ${range}`);
      } else if (error.message && error.message.includes('The caller does not have permission')) {
        throw new Error(`시트 접근 권한이 없습니다. 시트 공유 설정을 확인해주세요: ${sheetId ? sheetId.substring(0, 15) + '...' : '(없음)'}`);
      } else {
        throw new Error(`시트 데이터 읽기 실패: ${error.message}`);
      }
    }
  });
}

// 단말 마스터/요금정책 ETL에서 "구분 행(섹션 헤더)"을 걸러내기 위한 헬퍼
// 예: '5G중고', 'LTE중고' 등은 실제 단말 모델이 아니며, 출고가/정책 범위도 비어 있는 경우가 많다.
// 가격 필드가 잘못 매칭되어 0이 아니더라도, 모델명이 구분 라벨이면 무조건 제외한다.
function isDeviceCategoryRow(modelName, factoryPrice) {
  const name = (modelName || '').toString().trim();
  if (!name) return false;

  // 대표적인 구분 라벨들
  if (name === '5G중고' || name === 'LTE중고') {
    return true;
  }

  // 보다 일반적인 패턴: "...중고"와 같이 끝나는 섹션 헤더
  if (/중고$/.test(name)) {
    return true;
  }

  return false;
}

function deleteCache(key) {
  cacheStore.delete(key);
  console.log(`[Direct] 캐시 무효화: ${key}`);
}

// 모델 코드 정규화 함수 (공백, 하이픈, 언더스코어 제거, 소문자 변환)
// 🔥 수정: 원본 로직과 동일하게 변경 (이미지 매핑 문제 해결)
function normalizeModelCode(modelCode) {
  if (!modelCode) return '';
  return modelCode.replace(/[\s\-_]/g, '').toLowerCase();
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
  // 캐시 키가 mobiles-${carrier}-v6-${policyOrderHash} 형식이므로
  // mobiles-${carrier}로 시작하는 모든 키를 삭제해야 함
  const keysToDelete = [];
  for (const key of cacheStore.keys()) {
    if (carrier) {
      // 특정 통신사의 모든 버전/해시 캐시 삭제
      if (key.startsWith(`mobiles-${carrier}-`)) {
        keysToDelete.push(key);
      }
    } else {
      // 모든 통신사의 모든 버전/해시 캐시 삭제
      if (key.startsWith('mobiles-SK-') || key.startsWith('mobiles-KT-') || key.startsWith('mobiles-LG-')) {
        keysToDelete.push(key);
      }
    }
  }

  // 레거시 캐시 키도 삭제 (하위 호환성)
  if (carrier) {
    deleteCache(`mobiles-${carrier}`);
    deleteCache(`mobiles-${carrier}-v5`);
    deleteCache(`mobiles-${carrier}-v6`);
  } else {
    // 모든 통신사 캐시 무효화
    deleteCache('mobiles-SK');
    deleteCache('mobiles-KT');
    deleteCache('mobiles-LG');
    deleteCache('mobiles-SK-v5');
    deleteCache('mobiles-KT-v5');
    deleteCache('mobiles-LG-v5');
    deleteCache('mobiles-SK-v6');
    deleteCache('mobiles-KT-v6');
    deleteCache('mobiles-LG-v6');
  }

  // 동적으로 생성된 캐시 키 삭제
  keysToDelete.forEach(key => deleteCache(key));

  deleteCache('todays-mobiles');
  console.log(`[Direct] 직영점 캐시 무효화 완료: ${carrier || '모든 통신사'} (${keysToDelete.length}개 동적 키 + 레거시 키)`);
}

// 시트 ID 조회 헬퍼 함수
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

// 스프레드시트 컬럼 번호를 컬럼 문자로 변환 (1 -> A, 27 -> AA, 36 -> AJ)
// Google Sheets와 Excel 모두 동일한 컬럼 명명 규칙 사용 (A-Z, AA-AZ, BA-BZ, ...)
function getColumnLetter(columnNumber) {
  let result = '';
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
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
    // 먼저 시트 존재 여부 확인
    const spreadsheet = await withRetry(async () => {
      return await sheets.spreadsheets.get({ spreadsheetId });
    });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === sheetName);

    // 시트가 없으면 생성
    if (!sheetExists) {
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
    }

    // 헤더 확인 및 업데이트 (재시도 로직 포함)
    const res = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`
      });
    });
    const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
    // 🔥 수정: 헤더 길이가 다르거나 내용이 다르면 업데이트 (기존 헤더가 더 긴 경우도 처리)
    const needsInit = firstRow.length === 0 ||
      firstRow.length !== headers.length ||
      headers.some((h, i) => (firstRow[i] || '').toString().trim() !== h.toString().trim());
    if (needsInit) {
      await withRetry(async () => {
        const lastColumn = getColumnLetter(headers.length);
        // 🔥 수정: 기존 헤더가 더 긴 경우, 나머지 컬럼도 빈 값으로 업데이트하여 중복 제거
        let updateRange = `${sheetName}!A1:${lastColumn}1`;
        let updateValues = [headers];

        // 기존 헤더가 더 긴 경우, 나머지 컬럼도 빈 값으로 업데이트
        if (firstRow.length > headers.length) {
          const oldLastColumn = getColumnLetter(firstRow.length);
          updateRange = `${sheetName}!A1:${oldLastColumn}1`;
          // headers 뒤에 빈 문자열 추가하여 기존 헤더 제거
          const extendedHeaders = [...headers];
          for (let i = headers.length; i < firstRow.length; i++) {
            extendedHeaders.push('');
          }
          updateValues = [extendedHeaders];
        }

        // 범위를 명시적으로 지정하여 업데이트
        return await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          resource: { values: updateValues }
        });
      });
      // 헤더 업데이트 후 캐시 무효화
      cacheStore.delete(cacheKey);
      return headers;
    }
    // 헤더가 정상이면 캐시에 저장
    setCache(cacheKey, headers, CACHE_TTL);
    return headers;
  } catch (error) {
    // 에러 메시지 확인: 시트가 이미 존재하는 경우
    const errorMessage = error.message || (error.errors && error.errors[0] && error.errors[0].message) || '';
    if (error.code === 400 && errorMessage.includes('already exists')) {
      // 시트가 이미 존재하는 경우, 헤더만 업데이트 시도
      try {
        const res = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!1:1`
          });
        });
        const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
        // 🔥 수정: 헤더 길이가 다르거나 내용이 다르면 업데이트 (기존 헤더가 더 긴 경우도 처리)
        const needsInit = firstRow.length === 0 ||
          firstRow.length !== headers.length ||
          headers.some((h, i) => (firstRow[i] || '').toString().trim() !== h.toString().trim());
        if (needsInit) {
          await withRetry(async () => {
            const lastColumn = getColumnLetter(headers.length);
            // 🔥 수정: 기존 헤더가 더 긴 경우, 나머지 컬럼도 빈 값으로 업데이트하여 중복 제거
            let updateRange = `${sheetName}!A1:${lastColumn}1`;
            let updateValues = [headers];

            // 기존 헤더가 더 긴 경우, 나머지 컬럼도 빈 값으로 업데이트
            if (firstRow.length > headers.length) {
              const oldLastColumn = getColumnLetter(firstRow.length);
              updateRange = `${sheetName}!A1:${oldLastColumn}1`;
              // headers 뒤에 빈 문자열 추가하여 기존 헤더 제거
              const extendedHeaders = [...headers];
              for (let i = headers.length; i < firstRow.length; i++) {
                extendedHeaders.push('');
              }
              updateValues = [extendedHeaders];
            }

            // 범위를 명시적으로 지정하여 업데이트
            return await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              resource: { values: updateValues }
            });
          });
          // 헤더 업데이트 후 캐시 무효화
          cacheStore.delete(cacheKey);
        }
        setCache(cacheKey, headers, CACHE_TTL);
        return headers;
      } catch (updateError) {
        console.error(`[Direct] Failed to update headers for sheet ${sheetName}:`, updateError);
        cacheStore.delete(cacheKey);
        throw updateError;
      }
    } else {
      // 다른 에러인 경우
      console.error(`[Direct] Failed to ensure sheet headers for ${sheetName}:`, error);
      cacheStore.delete(cacheKey);
      throw error;
    }
  }
}

// 재빌드 진행 상태 관리 (Global Status for Rebuild)
let isRebuilding = false;
let rebuildStatus = {
  startTime: null,
  endTime: null,
  step: 'IDLE',
  error: null,
  results: null,
  carriers: []
};

function setupDirectRoutes(app) {
  const router = express.Router();
  // ... (existing code inside setupDirectRoutes)

  // === 디버그/검증용 엔드포인트 ===

  /**
   * GET /api/direct/debug/link-settings?carrier=SK
   *
   * - 목적:
   *   - 직영점관리모드의 링크설정에서 입력한 시트ID/범위가
   *     실제 구글시트에서 올바르게 읽히는지 확인하기 위한 디버그용 API
   * - 반환:
   *   - carrier: 조회한 통신사
   *   - rawSettings: 직영점_설정 시트에서 읽어온 원본 행들(planGroup/support/policy)
   *   - parsed: 각 설정유형별 JSON 파싱 결과
   *   - samples: 각 range의 상위/하위 일부 샘플 데이터
   */
  router.get('/debug/link-settings', async (req, res) => {
    try {
      const carrier = (req.query.carrier || 'SK').trim();
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 직영점_설정 헤더 보장
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

      const settingsRes = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_SETTINGS
        });
      });

      const rows = (settingsRes.data.values || []).slice(1);
      const carrierRows = rows.filter(row => (row[0] || '').toString().trim() === carrier);

      const types = ['planGroup', 'support', 'policy'];
      const parsed = {};
      const samples = {};

      for (const type of types) {
        const row = carrierRows.find(r => (r[1] || '').toString().trim() === type);
        if (!row) continue;

        // C열: 시트ID/링크, E열: 설정 JSON
        const sheetId = (row[2] || '').toString().trim();
        let configJson = {};
        try {
          configJson = row[4] ? JSON.parse(row[4]) : {};
        } catch (err) {
          console.warn(`[Direct][debug/link-settings] ${carrier}/${type} JSON 파싱 실패:`, err.message);
        }

        parsed[type] = {
          sheetId,
          config: configJson
        };

        // range별 샘플 데이터 추출
        const sampleForType = {};

        const addRangeSample = async (label, range) => {
          if (!sheetId || !range) return;
          try {
            const data = await getSheetData(sheetId, range);
            const first = data.slice(0, 3);
            const last = data.length > 6 ? data.slice(-3) : [];
            sampleForType[label] = {
              range,
              totalRows: data.length,
              firstRows: first,
              lastRows: last
            };
          } catch (err) {
            console.warn(`[Direct][debug/link-settings] ${carrier}/${type} range 샘플 로딩 실패:`, {
              label,
              range,
              message: err.message
            });
            sampleForType[label] = {
              range,
              error: err.message
            };
          }
        };

        if (type === 'planGroup') {
          await addRangeSample('planNameRange', configJson.planNameRange);
          await addRangeSample('planGroupRange', configJson.planGroupRange);
          await addRangeSample('basicFeeRange', configJson.basicFeeRange);
        } else if (type === 'support') {
          await addRangeSample('modelRange', configJson.modelRange);
          await addRangeSample('petNameRange', configJson.petNameRange);
          await addRangeSample('factoryPriceRange', configJson.factoryPriceRange);
          await addRangeSample('openingTypeRange', configJson.openingTypeRange);
          if (configJson.planGroupRanges && typeof configJson.planGroupRanges === 'object') {
            for (const [groupKey, groupRange] of Object.entries(configJson.planGroupRanges)) {
              await addRangeSample(`planGroupRanges.${groupKey}`, groupRange);
            }
          }
        } else if (type === 'policy') {
          await addRangeSample('modelRange', configJson.modelRange);
          await addRangeSample('petNameRange', configJson.petNameRange);
          if (configJson.planGroupRanges && typeof configJson.planGroupRanges === 'object') {
            for (const [groupKey, groupRange] of Object.entries(configJson.planGroupRanges)) {
              await addRangeSample(`planGroupRanges.${groupKey}`, groupRange);
            }
          }
        }

        samples[type] = sampleForType;
      }

      return res.json({
        success: true,
        carrier,
        rawSettings: carrierRows,
        parsed,
        samples
      });
    } catch (error) {
      console.error('[Direct][debug/link-settings] error:', error);
      return res.status(500).json({
        success: false,
        error: '링크설정 디버그 조회 실패',
        message: error.message
      });
    }
  });

  /**
   * GET /api/direct/debug/rebuild-master-preview?carrier=SK
   *
   * - 목적:
   *   - 마스터 시트 리팩토링 전에, 링크설정 기반 정규화(ETL)가
   *     어떤 형태의 데이터를 만들어낼지 미리 확인하기 위한 프리뷰용 API
   * - 현재 범위:
   *   - 요금제 마스터(직영점_요금제마스터에 들어갈 데이터)의 샘플만 생성
   *   - 단말/요금정책 마스터는 이후 단계에서 확장 예정
   */
  router.get('/debug/rebuild-master-preview', async (req, res) => {
    try {
      const carrier = (req.query.carrier || 'SK').trim();

      // 직영점_설정에서 해당 통신사의 planGroup 설정을 getLinkSettings로 가져옴
      const settingsRows = await getLinkSettings(carrier);
      const planGroupRow = settingsRows.find(
        row => (row[0] || '').toString().trim() === carrier &&
          (row[1] || '').toString().trim() === 'planGroup'
      );

      if (!planGroupRow) {
        return res.json({
          success: false,
          carrier,
          error: 'planGroup 설정을 찾을 수 없습니다. 직영점_설정 시트를 확인해주세요.'
        });
      }

      const sheetId = (planGroupRow[2] || '').toString().trim();
      let configJson = {};
      try {
        configJson = planGroupRow[4] ? JSON.parse(planGroupRow[4]) : {};
      } catch (err) {
        console.warn('[Direct][debug/rebuild-master-preview] planGroup JSON 파싱 실패:', err.message);
      }

      const planNameRange = configJson.planNameRange || '';
      const planGroupRange = configJson.planGroupRange || '';
      const basicFeeRange = configJson.basicFeeRange || '';

      const plansSample = [];

      if (sheetId && (planNameRange || planGroupRange || basicFeeRange)) {
        // 각 범위를 읽어서 인덱스 기준으로 매칭
        // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
        const planNames = planNameRange ? await getSheetData(sheetId, planNameRange) : [];
        const planGroups = planGroupRange ? await getSheetData(sheetId, planGroupRange) : [];
        const basicFees = basicFeeRange ? await getSheetData(sheetId, basicFeeRange) : [];

        const flatNames = planNames.flat().map(v => (v || '').toString().trim());
        const flatGroups = planGroups.flat().map(v => (v || '').toString().trim());
        const flatFees = basicFees.flat().map(v => Number(v || 0));

        const maxLength = Math.max(flatNames.length, flatGroups.length, flatFees.length);
        for (let i = 0; i < maxLength; i++) {
          const planName = flatNames[i] || '';
          const group = flatGroups[i] || '';
          const fee = flatFees[i] || 0;
          if (!planName && !group && !fee) continue;

          plansSample.push({
            carrier,
            planName,
            planGroup: group || planName,
            basicFee: fee
          });
        }
      }

      return res.json({
        success: true,
        carrier,
        plansSample: plansSample.slice(0, 50) // 너무 많을 경우를 대비해 상위 50개만
      });
    } catch (error) {
      console.error('[Direct][debug/rebuild-master-preview] error:', error);
      return res.status(500).json({
        success: false,
        error: '마스터 프리뷰 생성 실패',
        message: error.message
      });
    }
  });

  // 중앙 집중식 데이터 재빌드 실행기
  async function executeFullRebuild(carriersParam = null) {
    if (isRebuilding) {
      throw new Error('재빌드가 이미 진행 중입니다.');
    }

    try {
      isRebuilding = true;
      const carriers = carriersParam || ['SK', 'KT', 'LG'];

      // 상태 초기화
      rebuildStatus = {
        startTime: Date.now(),
        endTime: null,
        step: 'STARTING',
        error: null,
        results: null,
        carriers: carriers
      };

      const results = { summary: {} };

      console.log(`🚀 [Direct][executeFullRebuild] 시작: ${carriers.join(', ')}`);

      // 0. 정책 설정 캐시 무효화 (최신 데이터 읽기 보장)
      console.log(`[Direct] Invalidating policy settings cache before rebuild`);
      for (const carrier of carriers) {
        deleteCache(`policy-settings-${carrier}`);
      }

      // 1. 요금제 마스터 리빌드
      console.log(`[Direct] Step 1: Rebuilding Plan Master...`);
      rebuildStatus.step = 'PLAN_MASTER';
      results.plans = await rebuildPlanMaster(carriers);

      // 구글 시트 API 할당량 여유를 위한 지연 (2초)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. 단말 마스터 리빌드
      console.log(`[Direct] Step 2: Rebuilding Device Master...`);
      rebuildStatus.step = 'DEVICE_MASTER';
      results.devices = await rebuildDeviceMaster(carriers);

      // 구글 시트 API 할당량 여유를 위한 지연 (2초)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. 단말 요금정책 리빌드
      console.log(`[Direct] Step 3: Rebuilding Pricing Master...`);
      rebuildStatus.step = 'PRICING_MASTER';
      results.pricing = await rebuildPricingMaster(carriers);

      // 4. 재빌드 완료 후 모든 관련 캐시 무효화
      console.log(`[Direct] Step 4: Invalidating all related caches...`);
      rebuildStatus.step = 'CLEANUP';
      deleteCache('todays-mobiles');
      for (const carrier of ['SK', 'KT', 'LG']) {
        deleteCache(`mobiles-${carrier}`);
        deleteCache(`mobiles-${carrier}-v5`);
        deleteCache(`mobiles-${carrier}-v6`);
      }
      if (typeof invalidateDirectStoreCache === 'function') {
        invalidateDirectStoreCache();
      }

      console.log(`✅ [Direct][executeFullRebuild] 모든 단계 완료`);
      rebuildStatus.endTime = Date.now();
      rebuildStatus.step = 'COMPLETED';
      rebuildStatus.results = results;
      return results;
    } catch (error) {
      console.error('❌ [Direct][executeFullRebuild] 오류 발생:', error);
      rebuildStatus.endTime = Date.now();
      rebuildStatus.step = 'FAILED';
      rebuildStatus.error = error.message;
      throw error;
    } finally {
      isRebuilding = false;
    }
  }

  // 외부에 함수 연결 (index.js에서 사용 가능하도록 함)
  setupDirectRoutes.executeFullRebuild = executeFullRebuild;
  setupDirectRoutes.getIsRebuilding = () => isRebuilding;

  router.post('/rebuild-master', async (req, res) => {
    try {
      const carrierParam = (req.query.carrier || '').trim().toUpperCase();
      if (carrierParam && !['SK', 'KT', 'LG'].includes(carrierParam)) {
        return res.status(400).json({
          success: false,
          error: '유효한 통신사를 지정해주세요 (SK, KT, LG)'
        });
      }

      if (isRebuilding) {
        return res.status(429).json({
          success: false,
          error: '재빌드가 이미 진행 중입니다.',
          status: rebuildStatus
        });
      }

      const carriers = carrierParam ? [carrierParam] : ['SK', 'KT', 'LG'];

      // 🔥 비동기로 실행하고 즉시 응답 반환 (504 Timeout 방지)
      executeFullRebuild(carriers).catch(err => {
        console.error('[Direct][rebuild-master] Background rebuild error:', err);
      });

      return res.status(202).json({
        success: true,
        message: '마스터 데이터 재빌드를 시작했습니다. 잠시 후 완료됩니다.',
        carriers: carriers
      });
    } catch (error) {
      console.error('[Direct][rebuild-master] error:', error);
      return res.status(500).json({
        success: false,
        error: '마스터 데이터 통합 재빌드 요청 실패',
        message: error.message
      });
    }
  });

  /**
   * GET /api/direct/rebuild-status
   * 재빌드 진행 상태 확인
   */
  router.get('/rebuild-status', (req, res) => {
    res.json({
      success: true,
      isRebuilding,
      ...rebuildStatus
    });
  });

  /**
   * POST /api/direct/refresh-images-from-discord
   * 
   * Discord 메시지 ID를 통한 이미지 재업로드
   * - 쿼리: carrier (필수) - SK, KT, LG 중 하나
   * - 응답: { success, carrier, updatedCount, failedCount, updatedImages, failedImages }
   */
  router.post('/refresh-images-from-discord', async (req, res) => {
    try {
      const carrier = (req.query.carrier || '').trim().toUpperCase();

      // carrier 파라미터 검증
      if (!carrier || !['SK', 'KT', 'LG'].includes(carrier)) {
        return res.status(400).json({
          success: false,
          error: '유효한 통신사를 지정해주세요 (SK, KT, LG)'
        });
      }

      console.log(`🔄 [refreshImagesFromDiscord] ${carrier} 시작`);

      const result = await refreshImagesFromDiscord(carrier);

      console.log(`✅ [refreshImagesFromDiscord] ${carrier} 완료: 성공 ${result.updatedCount}개, 실패 ${result.failedCount}개`);

      res.json(result);
    } catch (error) {
      console.error('❌ [refreshImagesFromDiscord] 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/direct/plans-master/rebuild
   *
   * - 목적:
   *   - 직영점_요금제마스터 시트를 링크설정 기반으로 재빌드(ETL)하는 실제 쓰기용 엔드포인트
   * - 쿼리:
   *   - carrier (선택): SK/KT/LG 중 하나. 없으면 세 통신사 모두 처리.
   */
  router.post('/plans-master/rebuild', async (req, res) => {
    try {
      const carrierParam = (req.query.carrier || '').trim().toUpperCase();
      const carriers = carrierParam ? [carrierParam] : ['SK', 'KT', 'LG'];

      const { totalCount, perCarrier } = await rebuildPlanMaster(carriers);

      return res.json({
        success: true,
        totalCount,
        perCarrier
      });
    } catch (error) {
      console.error('[Direct][plans-master/rebuild] error:', error);
      return res.status(500).json({
        success: false,
        error: '요금제마스터 재빌드 실패',
        message: error.message
      });
    }
  });

  /**
   * GET /api/direct/plans-master
   *
   * - 목적:
   *   - 직영점_요금제마스터 시트에서 정규화된 요금제 정보를 조회
   * - 쿼리:
   *   - carrier (선택): 필터용 통신사 코드
   */
  router.get('/plans-master', async (req, res) => {
    try {
      const carrierFilter = (req.query.carrier || '').trim().toUpperCase();

      // Feature Flag 확인
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      let plans = [];

      if (useDatabase) {
        // Supabase에서 조회 (DirectStoreDAL 사용)
        console.log(`📖 [GET /plans-master] Supabase에서 조회: carrier=${carrierFilter}`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');
        plans = await withRetrySupabase(async () => {
          return await DirectStoreDAL.getPlanMaster(carrierFilter || null);
        });
      } else {
        // Google Sheets에서 조회 (폴백)
        console.log(`📖 [GET /plans-master] Google Sheets에서 조회: carrier=${carrierFilter}`);
        const sheetName = '직영점_요금제마스터';
        const range = `${sheetName}!A:G`; // 원본 파일 기준: A:G
        const rows = await withRetry(() => getSheetData(process.env.SHEET_ID, range));

        if (!rows || rows.length === 0) {
          return res.json({ success: true, data: [] });
        }

        // 헤더 파싱
        const headers = rows[0];
        const carrierIdx = headers.indexOf('통신사');
        const planNameIdx = headers.indexOf('요금제명');
        const planGroupIdx = headers.indexOf('요금제군');
        const basicFeeIdx = headers.indexOf('기본료');
        const planCodeIdx = headers.indexOf('요금제코드');
        const isActiveIdx = headers.indexOf('사용여부');
        const noteIdx = headers.indexOf('비고');

        // 데이터 파싱
        plans = rows.slice(1)
          .filter(row => {
            const carrier = row[carrierIdx] || '';
            const isActive = row[isActiveIdx] || 'Y';

            // 필터링
            if (carrierFilter && carrier !== carrierFilter) return false;
            if (isActive === 'N') return false;

            return true;
          })
          .map(row => ({
            carrier: row[carrierIdx] || '',
            planName: row[planNameIdx] || '',
            planGroup: row[planGroupIdx] || '',
            basicFee: parseInt(row[basicFeeIdx]) || 0,
            planCode: row[planCodeIdx] || '',
            isActive: row[isActiveIdx] !== 'N',
            note: row[noteIdx] || ''
          }));
      }

      // 응답 형식 변환
      const data = plans.map(plan => ({
        carrier: plan.carrier,
        planName: plan.planName,
        planGroup: plan.planGroup,
        basicFee: plan.basicFee,
        planCode: plan.planCode,
        enabled: plan.isActive,
        note: plan.note
      }));

      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Direct][plans-master] error:', error);
      return res.status(500).json({
        success: false,
        error: '요금제마스터 조회 실패',
        message: error.message
      });
    }
  });

  /**
   * POST /api/direct/plans-master
   *
   * - 목적:
   *   - 요금제 마스터 생성
   * - Body:
   *   - carrier: 통신사 (SK/KT/LG)
   *   - planName: 요금제명
   *   - planGroup: 요금제군
   *   - basicFee: 기본료
   *   - planCode: 요금제코드 (선택)
   *   - isActive: 사용여부 (선택, 기본값: true)
   *   - note: 비고 (선택)
   */
  router.post('/plans-master', async (req, res) => {
    try {
      const { carrier, planName, planGroup, basicFee, planCode, isActive, note } = req.body;

      // 필수 필드 검증
      if (!carrier || !planName || !planGroup || basicFee === undefined) {
        return res.status(400).json({
          success: false,
          error: '필수 필드 누락',
          message: 'carrier, planName, planGroup, basicFee는 필수입니다.'
        });
      }

      const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

      if (USE_DB) {
        try {
          const directStoreDAL = require('./dal/DirectStoreDAL');

          await directStoreDAL.createPlanMaster({
            carrier: carrier.toUpperCase(),
            planName,
            planGroup,
            basicFee: parseInt(basicFee),
            planCode: planCode || '',
            isActive: isActive !== false,
            note: note || ''
          });

          return res.json({ success: true, message: '요금제 마스터 생성 완료' });
        } catch (err) {
          console.error('[Direct][plans-master] Supabase 실패, Google Sheets로 폴백:', err.message);
          // Google Sheets 폴백은 현재 미구현 (빠른 구현을 위해 생략)
          return res.status(500).json({
            success: false,
            error: '요금제 마스터 생성 실패',
            message: err.message
          });
        }
      }

      // Google Sheets 로직 (미구현)
      return res.status(501).json({
        success: false,
        error: 'Google Sheets 모드는 아직 지원하지 않습니다.',
        message: 'USE_DB_DIRECT_STORE=true로 설정해주세요.'
      });
    } catch (error) {
      console.error('[Direct][plans-master] POST error:', error);
      return res.status(500).json({
        success: false,
        error: '요금제 마스터 생성 실패',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/direct/plans-master/:carrier/:planName
   *
   * - 목적:
   *   - 요금제 마스터 수정
   * - 파라미터:
   *   - carrier: 통신사 (SK/KT/LG)
   *   - planName: 요금제명
   * - Body (부분 업데이트):
   *   - planGroup: 요금제군 (선택)
   *   - basicFee: 기본료 (선택)
   *   - planCode: 요금제코드 (선택)
   *   - isActive: 사용여부 (선택)
   *   - note: 비고 (선택)
   */
  router.put('/plans-master/:carrier/:planName', async (req, res) => {
    try {
      const { carrier, planName } = req.params;
      const updates = req.body;

      if (!carrier || !planName) {
        return res.status(400).json({
          success: false,
          error: '필수 파라미터 누락',
          message: 'carrier와 planName은 필수입니다.'
        });
      }

      const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

      if (USE_DB) {
        try {
          const directStoreDAL = require('./dal/DirectStoreDAL');

          // basicFee가 있으면 숫자로 변환
          if (updates.basicFee !== undefined) {
            updates.basicFee = parseInt(updates.basicFee);
          }

          await directStoreDAL.updatePlanMaster(carrier.toUpperCase(), decodeURIComponent(planName), updates);

          return res.json({ success: true, message: '요금제 마스터 수정 완료' });
        } catch (err) {
          console.error('[Direct][plans-master] Supabase 실패:', err.message);
          return res.status(500).json({
            success: false,
            error: '요금제 마스터 수정 실패',
            message: err.message
          });
        }
      }

      // Google Sheets 로직 (미구현)
      return res.status(501).json({
        success: false,
        error: 'Google Sheets 모드는 아직 지원하지 않습니다.',
        message: 'USE_DB_DIRECT_STORE=true로 설정해주세요.'
      });
    } catch (error) {
      console.error('[Direct][plans-master] PUT error:', error);
      return res.status(500).json({
        success: false,
        error: '요금제 마스터 수정 실패',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/direct/plans-master/:carrier/:planName
   *
   * - 목적:
   *   - 요금제 마스터 삭제
   * - 파라미터:
   *   - carrier: 통신사 (SK/KT/LG)
   *   - planName: 요금제명
   */
  router.delete('/plans-master/:carrier/:planName', async (req, res) => {
    try {
      const { carrier, planName } = req.params;

      if (!carrier || !planName) {
        return res.status(400).json({
          success: false,
          error: '필수 파라미터 누락',
          message: 'carrier와 planName은 필수입니다.'
        });
      }

      const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

      if (USE_DB) {
        try {
          const directStoreDAL = require('./dal/DirectStoreDAL');

          await directStoreDAL.deletePlanMaster(carrier.toUpperCase(), decodeURIComponent(planName));

          return res.json({ success: true, message: '요금제 마스터 삭제 완료' });
        } catch (err) {
          console.error('[Direct][plans-master] Supabase 실패:', err.message);
          return res.status(500).json({
            success: false,
            error: '요금제 마스터 삭제 실패',
            message: err.message
          });
        }
      }

      // Google Sheets 로직 (미구현)
      return res.status(501).json({
        success: false,
        error: 'Google Sheets 모드는 아직 지원하지 않습니다.',
        message: 'USE_DB_DIRECT_STORE=true로 설정해주세요.'
      });
    } catch (error) {
      console.error('[Direct][plans-master] DELETE error:', error);
      return res.status(500).json({
        success: false,
        error: '요금제 마스터 삭제 실패',
        message: error.message
      });
    }
  });

  /**
   * GET /api/direct/mobiles-master
   *
   * - 목적:
   *   - 직영점_단말마스터 시트에서 정규화된 단말(휴대폰) 정보를 조회
   * - 쿼리:
   *   - carrier (선택): 통신사 필터 (SK/KT/LG)
   *   - modelId (선택): 특정 모델ID 필터
   *
   * - 비고:
   *   - Feature Flag에 따라 Supabase 또는 Google Sheets에서 조회
   */
  router.get('/mobiles-master', async (req, res) => {
    try {
      const carrierFilter = (req.query.carrier || '').trim().toUpperCase();
      const modelIdFilter = (req.query.modelId || '').toString().trim();

      // Feature Flag 확인
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      let devices = [];

      if (useDatabase) {
        // Supabase에서 조회 (DirectStoreDAL 사용)
        console.log(`📖 [GET /mobiles-master] Supabase에서 조회: carrier=${carrierFilter}, modelId=${modelIdFilter}`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');
        devices = await withRetrySupabase(async () => {
          return await DirectStoreDAL.getDeviceMaster(
            carrierFilter || null,
            modelIdFilter || null
          );
        });
      } else {
        // Google Sheets에서 조회 (폴백)
        console.log(`📖 [GET /mobiles-master] Google Sheets에서 조회: carrier=${carrierFilter}, modelId=${modelIdFilter}`);
        const sheetName = '직영점_단말마스터';
        const range = `${sheetName}!A:R`; // 원본 파일 기준: A:R
        const rows = await withRetry(() => getSheetData(process.env.SHEET_ID, range));

        if (!rows || rows.length === 0) {
          return res.json({ success: true, data: [] });
        }

        // 헤더 파싱
        const headers = rows[0];
        const carrierIdx = headers.indexOf('통신사');
        const modelIdIdx = headers.indexOf('모델ID');
        const modelNameIdx = headers.indexOf('모델명');
        const petNameIdx = headers.indexOf('펫네임');
        const manufacturerIdx = headers.indexOf('제조사');
        const factoryPriceIdx = headers.indexOf('출고가');
        const defaultPlanGroupIdx = headers.indexOf('기본요금제군');
        const isPremiumIdx = headers.indexOf('프리미엄여부');
        const isBudgetIdx = headers.indexOf('보급형여부');
        const isPopularIdx = headers.indexOf('인기여부');
        const isRecommendedIdx = headers.indexOf('추천여부');
        const isCheapIdx = headers.indexOf('저렴여부');
        const imageUrlIdx = headers.indexOf('이미지URL');
        const isActiveIdx = headers.indexOf('사용여부');
        const noteIdx = headers.indexOf('비고');
        const discordMessageIdIdx = headers.indexOf('Discord메시지ID');
        const discordPostIdIdx = headers.indexOf('Discord포스트ID');
        const discordThreadIdIdx = headers.indexOf('Discord스레드ID');

        // 데이터 파싱
        devices = rows.slice(1)
          .filter(row => {
            const carrier = row[carrierIdx] || '';
            const modelId = row[modelIdIdx] || '';
            const isActive = row[isActiveIdx] || 'Y';

            // 필터링
            if (carrierFilter && carrier !== carrierFilter) return false;
            if (modelIdFilter && modelId !== modelIdFilter) return false;
            if (isActive === 'N') return false;

            return true;
          })
          .map(row => ({
            carrier: row[carrierIdx] || '',
            modelId: row[modelIdIdx] || '',
            modelName: row[modelNameIdx] || '',
            petName: row[petNameIdx] || '',
            manufacturer: row[manufacturerIdx] || '',
            factoryPrice: parseInt(row[factoryPriceIdx]) || 0,
            defaultPlanGroup: row[defaultPlanGroupIdx] || '',
            isPremium: row[isPremiumIdx] === 'Y',
            isBudget: row[isBudgetIdx] === 'Y',
            isPopular: row[isPopularIdx] === 'Y',
            isRecommended: row[isRecommendedIdx] === 'Y',
            isCheap: row[isCheapIdx] === 'Y',
            imageUrl: row[imageUrlIdx] || '',
            isActive: row[isActiveIdx] !== 'N',
            note: row[noteIdx] || '',
            discordMessageId: row[discordMessageIdIdx] || '',
            discordPostId: row[discordPostIdIdx] || '',
            discordThreadId: row[discordThreadIdIdx] || ''
          }));
      }

      // 응답 형식 변환
      const data = devices.map(device => ({
        carrier: device.carrier,
        modelId: device.modelId,
        model: device.modelName,
        petName: device.petName,
        manufacturer: device.manufacturer,
        factoryPrice: device.factoryPrice,
        defaultPlanGroup: device.defaultPlanGroup,
        isPremium: device.isPremium,
        isBudget: device.isBudget,
        isPopular: device.isPopular,
        isRecommended: device.isRecommended,
        isCheap: device.isCheap,
        imageUrl: device.imageUrl,
        enabled: device.isActive,
        note: device.note,
        discordMessageId: device.discordMessageId,
        discordPostId: device.discordPostId,
        discordThreadId: device.discordThreadId
      }));

      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Direct][mobiles-master] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말마스터 조회 실패',
        message: error.message
      });
    }
  });

  /**
   * POST /api/direct/mobiles-master
   *
   * - 목적:
   *   - 직영점_단말마스터에 새로운 단말 정보를 추가
   * - Body:
   *   - carrier (필수): 통신사 (SK/KT/LG)
   *   - modelId (필수): 모델ID
   *   - modelName (필수): 모델명
   *   - petName (선택): 펫네임
   *   - manufacturer (선택): 제조사
   *   - factoryPrice (선택): 출고가
   *   - defaultPlanGroup (선택): 기본요금제군
   *   - isPremium (선택): 프리미엄 여부
   *   - isBudget (선택): 보급형 여부
   *   - isPopular (선택): 인기 여부
   *   - isRecommended (선택): 추천 여부
   *   - isCheap (선택): 저렴 여부
   *   - imageUrl (선택): 이미지URL
   *   - isActive (선택): 사용여부
   *   - note (선택): 비고
   *   - discordMessageId (선택): Discord메시지ID
   *   - discordPostId (선택): Discord포스트ID
   *   - discordThreadId (선택): Discord스레드ID
   *
   * - 비고:
   *   - Feature Flag에 따라 Supabase 또는 Google Sheets에 저장
   */
  router.post('/mobiles-master', async (req, res) => {
    try {
      const { carrier, modelId, modelName } = req.body;

      // 필수 필드 검증
      if (!carrier || !modelId || !modelName) {
        return res.status(400).json({
          success: false,
          error: '필수 필드 누락',
          message: 'carrier, modelId, modelName은 필수입니다.'
        });
      }

      // Feature Flag 확인
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에 저장 (DirectStoreDAL 사용)
        console.log(`📝 [POST /mobiles-master] Supabase에 데이터 저장: ${carrier} - ${modelId}`);
        const directStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await directStoreDAL.createDeviceMaster(req.body);
        });

        return res.json({ success: true, message: '단말 마스터 생성 완료' });
      } else {
        // Google Sheets 폴백 (기존 로직 - 구현 필요 시 추가)
        console.log(`📝 [POST /mobiles-master] Google Sheets 폴백 (미구현)`);
        return res.status(501).json({
          success: false,
          error: 'Google Sheets 쓰기 미구현',
          message: 'USE_DB_DIRECT_STORE=true로 설정하여 Supabase를 사용하세요.'
        });
      }
    } catch (error) {
      console.error('[Direct][mobiles-master POST] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말마스터 생성 실패',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/direct/mobiles-master/:carrier/:modelId
   *
   * - 목적:
   *   - 직영점_단말마스터의 특정 단말 정보를 수정
   * - Params:
   *   - carrier (필수): 통신사 (SK/KT/LG)
   *   - modelId (필수): 모델ID
   * - Body:
   *   - 수정할 필드들 (모두 선택)
   *
   * - 비고:
   *   - Feature Flag에 따라 Supabase 또는 Google Sheets에서 수정
   */
  router.put('/mobiles-master/:carrier/:modelId', async (req, res) => {
    try {
      const { carrier, modelId } = req.params;
      const updates = req.body;

      // 수정할 필드가 없으면 에러
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: '수정할 필드 없음',
          message: '최소 하나의 필드를 수정해야 합니다.'
        });
      }

      // Feature Flag 확인
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 수정 (DirectStoreDAL 사용)
        console.log(`✏️ [PUT /mobiles-master] Supabase에서 데이터 수정: ${carrier} - ${modelId}`);
        const directStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await directStoreDAL.updateDeviceMaster(carrier, modelId, updates);
        });

        return res.json({ success: true, message: '단말 마스터 수정 완료' });
      } else {
        // Google Sheets 폴백 (기존 로직 - 구현 필요 시 추가)
        console.log(`✏️ [PUT /mobiles-master] Google Sheets 폴백 (미구현)`);
        return res.status(501).json({
          success: false,
          error: 'Google Sheets 쓰기 미구현',
          message: 'USE_DB_DIRECT_STORE=true로 설정하여 Supabase를 사용하세요.'
        });
      }
    } catch (error) {
      console.error('[Direct][mobiles-master PUT] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말마스터 수정 실패',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/direct/mobiles-master/:carrier/:modelId
   *
   * - 목적:
   *   - 직영점_단말마스터에서 특정 단말 정보를 삭제
   * - Params:
   *   - carrier (필수): 통신사 (SK/KT/LG)
   *   - modelId (필수): 모델ID
   *
   * - 비고:
   *   - Feature Flag에 따라 Supabase 또는 Google Sheets에서 삭제
   */
  router.delete('/mobiles-master/:carrier/:modelId', async (req, res) => {
    try {
      const { carrier, modelId } = req.params;

      // Feature Flag 확인
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        console.log(`🗑️ [DELETE /mobiles-master] Supabase에서 데이터 삭제: ${carrier} - ${modelId}`);
        const directStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await directStoreDAL.deleteDeviceMaster(carrier, modelId);
        });

        return res.json({ success: true, message: '단말 마스터 삭제 완료' });
      } else {
        // Google Sheets 폴백 (기존 로직 - 구현 필요 시 추가)
        console.log(`🗑️ [DELETE /mobiles-master] Google Sheets 폴백 (미구현)`);
        return res.status(501).json({
          success: false,
          error: 'Google Sheets 쓰기 미구현',
          message: 'USE_DB_DIRECT_STORE=true로 설정하여 Supabase를 사용하세요.'
        });
      }
    } catch (error) {
      console.error('[Direct][mobiles-master DELETE] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말마스터 삭제 실패',
        message: error.message
      });
    }
  });

  /**
   * GET /api/direct/mobiles-pricing
   *
   * - 목적:
   *   - 직영점_단말요금정책 시트에서 단말/요금제군/개통유형별 가격/정책 정보를 조회
   * - 쿼리:
   *   - carrier (선택): 통신사 필터
   *   - modelId (선택): 모델ID 필터
   *   - planGroup (선택): 요금제군 필터
   *   - openingType (선택): 개통유형 필터 (010신규/MNP/기변 등)
   *
   * - 비고:
   *   - 조회 범위가 큰 경우를 고려해, 프론트에서는 되도록 carrier/planGroup 단위로 필터링하여 호출하는 것을 권장.
   */
  router.get('/mobiles-pricing', async (req, res) => {
    try {
      const carrierFilter = (req.query.carrier || '').trim().toUpperCase();
      const modelIdFilter = (req.query.modelId || '').toString().trim();
      const planGroupFilter = (req.query.planGroup || '').toString().trim();
      const openingTypeFilter = (req.query.openingType || '').toString().trim();

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 읽기, 아니면 Google Sheets에서 읽기
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      let data = [];

      if (useDatabase) {
        // Supabase에서 읽기 (DirectStoreDAL 사용)
        console.log(`📖 [GET /mobiles-pricing] Supabase에서 데이터 읽기`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        const pricingData = await withRetrySupabase(async () => {
          return await DirectStoreDAL.getDevicePricingPolicy(
            carrierFilter || null,
            modelIdFilter || null,
            planGroupFilter || null
          );
        });

        // 응답 형식 변환 및 openingType 필터링
        data = pricingData
          .map(pricing => ({
            carrier: pricing.carrier,
            modelId: pricing.modelId,
            model: pricing.modelName,
            planGroup: pricing.planGroup,
            planCode: pricing.planCode,
            openingType: pricing.openingType,
            factoryPrice: pricing.factoryPrice,
            publicSupport: pricing.publicSupport,
            storeSupportWithAddon: pricing.storeAdditionalSupportWithAddon,
            policyMargin: pricing.policyMargin,
            policyId: pricing.policyId,
            baseDate: pricing.baseDate,
            note: pricing.note
          }))
          .filter(item => {
            if (openingTypeFilter && item.openingType !== openingTypeFilter) return false;
            return true;
          });

        console.log(`✅ [GET /mobiles-pricing] Supabase에서 데이터 읽기 완료: ${data.length}개`);
      } else {
        // Google Sheets에서 읽기 (기존 로직)
        console.log(`📖 [GET /mobiles-pricing] Google Sheets에서 데이터 읽기`);
        const { sheets, SPREADSHEET_ID } = createSheetsClient();

        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_PRICING, HEADERS_MOBILE_PRICING);
        const response = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_MOBILE_PRICING
          });
        });

        const values = response.data.values || [];
        if (values.length <= 1) {
          return res.json({ success: true, data: [] });
        }

        const rows = values.slice(1);
        data = rows
          .map(row => {
            const carrier = (row[0] || '').toString().trim();
            const modelId = (row[1] || '').toString().trim();
            const planGroup = (row[3] || '').toString().trim();
            const openingTypeRaw = (row[5] || '').toString().trim();

            // 직영점_단말요금정책 시트에는 이미 'MNP'로 저장되어 있으므로 변환 불필요
            // 🔥 수정: 부가미유치 기준 제거 (9번째 컬럼 제거, 이후 컬럼 인덱스 -1)
            return {
              carrier,
              modelId,
              model: (row[2] || '').toString().trim(),
              planGroup,
              planCode: (row[4] || '').toString().trim(),
              openingType: openingTypeRaw,
              factoryPrice: Number(row[6] || 0),
              publicSupport: Number(row[7] || 0),
              storeSupportWithAddon: Number(row[8] || 0),
              // 🔥 수정: 부가미유치 기준 제거 (row[9] 제거)
              policyMargin: Number(row[9] || 0), // 인덱스 변경: 10 → 9
              policyId: (row[10] || '').toString().trim(), // 인덱스 변경: 11 → 10
              baseDate: (row[11] || '').toString().trim(), // 인덱스 변경: 12 → 11
              note: (row[12] || '').toString().trim() // 인덱스 변경: 13 → 12
            };
          })
          .filter(item => {
            if (carrierFilter && item.carrier.toUpperCase() !== carrierFilter) return false;
            if (modelIdFilter && item.modelId !== modelIdFilter) return false;
            if (planGroupFilter && item.planGroup !== planGroupFilter) return false;
            if (openingTypeFilter && item.openingType !== openingTypeFilter) return false;
            return true;
          });

        console.log(`✅ [GET /mobiles-pricing] Google Sheets에서 데이터 읽기 완료: ${data.length}개`);
      }

      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Direct][mobiles-pricing] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말 요금/정책 조회 실패',
        message: error.message
      });
    }
  });

  /**
   * POST /api/direct/mobiles-pricing
   * 
   * - 목적: 단말 요금정책 생성
   * - Body: { carrier, modelId, modelName, planGroup, planCode, openingType, factoryPrice, publicSupport, storeAdditionalSupportWithAddon, policyMargin, policyId, baseDate, note }
   */
  router.post('/mobiles-pricing', async (req, res) => {
    try {
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에 쓰기 (DirectStoreDAL 사용)
        console.log(`✍️ [POST /mobiles-pricing] Supabase에 데이터 쓰기`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await DirectStoreDAL.createPricingMaster(req.body);
        });

        console.log(`✅ [POST /mobiles-pricing] Supabase에 데이터 쓰기 완료`);
        return res.json({ success: true, message: '단말 요금정책이 생성되었습니다.' });
      } else {
        // Google Sheets에 쓰기 (기존 로직)
        console.log(`✍️ [POST /mobiles-pricing] Google Sheets에 데이터 쓰기`);
        const { sheets, SPREADSHEET_ID } = createSheetsClient();

        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_PRICING, HEADERS_MOBILE_PRICING);

        const row = [
          req.body.carrier || '',
          req.body.modelId || '',
          req.body.modelName || '',
          req.body.planGroup || '',
          req.body.planCode || '',
          req.body.openingType || '',
          req.body.factoryPrice || 0,
          req.body.publicSupport || 0,
          req.body.storeAdditionalSupportWithAddon || 0,
          req.body.policyMargin || 0,
          req.body.policyId || '',
          req.body.baseDate || new Date().toISOString().split('T')[0],
          req.body.note || ''
        ];

        await withRetry(async () => {
          return await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_MOBILE_PRICING,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
          });
        });

        console.log(`✅ [POST /mobiles-pricing] Google Sheets에 데이터 쓰기 완료`);
        return res.json({ success: true, message: '단말 요금정책이 생성되었습니다.' });
      }
    } catch (error) {
      console.error('[Direct][mobiles-pricing POST] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말 요금정책 생성 실패',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType
   * 
   * - 목적: 단말 요금정책 수정
   * - Body: { modelName?, planCode?, factoryPrice?, publicSupport?, storeAdditionalSupportWithAddon?, policyMargin?, policyId?, baseDate?, note? }
   */
  router.put('/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType', async (req, res) => {
    try {
      const { carrier, modelId, planGroup, openingType } = req.params;
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 수정 (DirectStoreDAL 사용)
        console.log(`✍️ [PUT /mobiles-pricing] Supabase에서 데이터 수정: ${carrier} - ${modelId} - ${planGroup} - ${openingType}`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await DirectStoreDAL.updatePricingMaster(carrier, modelId, planGroup, openingType, req.body);
        });

        console.log(`✅ [PUT /mobiles-pricing] Supabase에서 데이터 수정 완료`);
        return res.json({ success: true, message: '단말 요금정책이 수정되었습니다.' });
      } else {
        // Google Sheets에서 수정 (기존 로직)
        console.log(`✍️ [PUT /mobiles-pricing] Google Sheets에서 데이터 수정`);
        const { sheets, SPREADSHEET_ID } = createSheetsClient();

        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_PRICING, HEADERS_MOBILE_PRICING);

        // 1. 기존 데이터 찾기
        const response = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_MOBILE_PRICING
          });
        });

        const values = response.data.values || [];
        if (values.length <= 1) {
          return res.status(404).json({ success: false, error: '수정할 데이터를 찾을 수 없습니다.' });
        }

        // 2. 해당 행 찾기
        const rowIndex = values.findIndex((row, idx) => {
          if (idx === 0) return false; // 헤더 제외
          return row[0] === carrier && row[1] === modelId && row[3] === planGroup && row[5] === openingType;
        });

        if (rowIndex === -1) {
          return res.status(404).json({ success: false, error: '수정할 데이터를 찾을 수 없습니다.' });
        }

        // 3. 기존 데이터 가져오기
        const existingRow = values[rowIndex];

        // 4. 업데이트할 데이터 준비 (기존 값 유지하면서 새 값으로 덮어쓰기)
        const updatedRow = [
          existingRow[0], // carrier
          existingRow[1], // modelId
          req.body.modelName !== undefined ? req.body.modelName : existingRow[2], // modelName
          existingRow[3], // planGroup
          req.body.planCode !== undefined ? req.body.planCode : existingRow[4], // planCode
          existingRow[5], // openingType
          req.body.factoryPrice !== undefined ? req.body.factoryPrice : existingRow[6], // factoryPrice
          req.body.publicSupport !== undefined ? req.body.publicSupport : existingRow[7], // publicSupport
          req.body.storeAdditionalSupportWithAddon !== undefined ? req.body.storeAdditionalSupportWithAddon : existingRow[8], // storeAdditionalSupportWithAddon
          req.body.policyMargin !== undefined ? req.body.policyMargin : existingRow[9], // policyMargin
          req.body.policyId !== undefined ? req.body.policyId : existingRow[10], // policyId
          req.body.baseDate !== undefined ? req.body.baseDate : existingRow[11], // baseDate
          req.body.note !== undefined ? req.body.note : existingRow[12] // note
        ];

        // 5. 업데이트
        await withRetry(async () => {
          return await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MOBILE_PRICING}!A${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [updatedRow] }
          });
        });

        console.log(`✅ [PUT /mobiles-pricing] Google Sheets에서 데이터 수정 완료`);
        return res.json({ success: true, message: '단말 요금정책이 수정되었습니다.' });
      }
    } catch (error) {
      console.error('[Direct][mobiles-pricing PUT] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말 요금정책 수정 실패',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType
   * 
   * - 목적: 단말 요금정책 삭제
   */
  router.delete('/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType', async (req, res) => {
    try {
      const { carrier, modelId, planGroup, openingType } = req.params;
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        console.log(`🗑️ [DELETE /mobiles-pricing] Supabase에서 데이터 삭제: ${carrier} - ${modelId} - ${planGroup} - ${openingType}`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await DirectStoreDAL.deletePricingMaster(carrier, modelId, planGroup, openingType);
        });

        console.log(`✅ [DELETE /mobiles-pricing] Supabase에서 데이터 삭제 완료`);
        return res.json({ success: true, message: '단말 요금정책이 삭제되었습니다.' });
      } else {
        // Google Sheets에서 삭제 (기존 로직)
        console.log(`🗑️ [DELETE /mobiles-pricing] Google Sheets에서 데이터 삭제`);
        const { sheets, SPREADSHEET_ID } = createSheetsClient();

        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_PRICING, HEADERS_MOBILE_PRICING);

        // 1. 기존 데이터 찾기
        const response = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_MOBILE_PRICING
          });
        });

        const values = response.data.values || [];
        if (values.length <= 1) {
          return res.status(404).json({ success: false, error: '삭제할 데이터를 찾을 수 없습니다.' });
        }

        // 2. 해당 행 찾기
        const rowIndex = values.findIndex((row, idx) => {
          if (idx === 0) return false; // 헤더 제외
          return row[0] === carrier && row[1] === modelId && row[3] === planGroup && row[5] === openingType;
        });

        if (rowIndex === -1) {
          return res.status(404).json({ success: false, error: '삭제할 데이터를 찾을 수 없습니다.' });
        }

        // 3. 행 삭제 (Google Sheets API는 행 삭제를 직접 지원하지 않으므로, 빈 값으로 덮어쓰기)
        const emptyRow = Array(HEADERS_MOBILE_PRICING.length).fill('');

        await withRetry(async () => {
          return await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MOBILE_PRICING}!A${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [emptyRow] }
          });
        });

        console.log(`✅ [DELETE /mobiles-pricing] Google Sheets에서 데이터 삭제 완료`);
        return res.json({ success: true, message: '단말 요금정책이 삭제되었습니다.' });
      }
    } catch (error) {
      console.error('[Direct][mobiles-pricing DELETE] error:', error);
      return res.status(500).json({
        success: false,
        error: '단말 요금정책 삭제 실패',
        message: error.message
      });
    }
  });

  // === 정책 설정 ===

  // GET /api/direct/policy-settings?carrier=SK&noCache=true
  router.get('/policy-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const noCache = req.query.noCache === 'true' || req.query.noCache === '1';

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 읽기
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        try {
          // Supabase에서 읽기 (DirectStoreDAL 사용)
          console.log(`📖 [GET /api/direct/policy-settings] Supabase에서 데이터 읽기 시작 (${carrier})`);

          const DirectStoreDAL = require('./dal/DirectStoreDAL');

          // 병렬로 모든 정책 데이터 조회 (withRetrySupabase 적용)
          const [marginData, addonData, insuranceData, specialData] = await Promise.all([
            withRetrySupabase(async () => await DirectStoreDAL.getPolicyMargin(carrier)),
            withRetrySupabase(async () => await DirectStoreDAL.getPolicyAddonServices(carrier)),
            withRetrySupabase(async () => await DirectStoreDAL.getPolicyInsurance(carrier)),
            withRetrySupabase(async () => await DirectStoreDAL.getPolicySpecial(carrier))
          ]);

          // 응답 형식 변환
          const margin = marginData ? marginData.margin : 50000; // 기본값 50000

          const addons = addonData.map((item, idx) => ({
            id: idx + 1,
            name: item.serviceName,
            fee: item.monthlyFee,
            incentive: item.attractionBonus,
            deduction: item.noAttractionDeduction,
            description: item.description,
            url: item.officialUrl
          }));

          const insurances = insuranceData.map((item, idx) => ({
            id: idx + 1,
            name: item.productName,
            minPrice: item.minPrice,
            maxPrice: item.maxPrice,
            fee: item.monthlyFee,
            incentive: item.attractionBonus,
            deduction: item.noAttractionDeduction,
            description: item.description,
            url: item.officialUrl
          }));

          const specialPolicies = specialData.map((item, idx) => ({
            id: idx + 1,
            name: item.policyName,
            policyType: item.policyType,
            amount: item.amount,
            isActive: item.isActive,
            conditionsJson: item.condition
          }));

          // 중복 제거 헬퍼 함수
          const removeDuplicates = (list, key = 'name') => {
            const seen = new Set();
            return list.filter(item => {
              const val = (item[key] || '').toString().trim();
              if (seen.has(val)) return false;
              seen.add(val);
              return true;
            });
          };

          const result = {
            success: true,
            margin: { baseMargin: margin },
            addon: { list: removeDuplicates(addons) },
            insurance: { list: removeDuplicates(insurances) },
            special: { list: removeDuplicates(specialPolicies) }
          };

          // 🔥 수파베이스에 마진은 있어도 서비스 리스트들이 전무하면 구글 시트에서 데이터를 가져오도록 폴백 허용
          // 특히 사용자가 시트 데이터를 신뢰하는 상황이므로, 특별 정책(specialPolicies)이 비어있으면 폴백합니다.
          const hasMinimumData = marginData !== null && (addons.length > 0 || insurances.length > 0 || specialPolicies.length > 0);

          if (!hasMinimumData || noCache || specialPolicies.length === 0) {
            console.log(`⚠️ [GET /api/direct/policy-settings] 데이터 보완 필요 (${carrier}): 마진=${!!marginData}, 부가=${addons.length}, 보험=${insurances.length}, 특별=${specialPolicies.length} -> Google Sheets에서 확인합니다.`);
            // return res.json(result); 를 하지 않고 그대로 흘려보내면 아래의 Google Sheets 로직이 실행됨
          } else {
            console.log(`✅ [GET /api/direct/policy-settings] Supabase에서 데이터 읽기 완료 (${carrier})`);
            return res.json(result);
          }
        } catch (supabaseError) {
          console.error(`⚠️ [GET /api/direct/policy-settings] Supabase 실패, Google Sheets로 폴백:`, supabaseError.message);
          // Google Sheets 폴백으로 계속 진행
        }
      }

      // Google Sheets에서 읽기 (기존 로직)
      console.log(`📖 [GET /api/direct/policy-settings] Google Sheets에서 데이터 읽기 시작 (${carrier})`);

      // 캐시 확인 (noCache가 true이면 캐시 무시)
      const cacheKey = `policy-settings-${carrier}`;
      if (!noCache) {
        const cached = getCache(cacheKey);
        if (cached) {
          return res.json(cached);
        }
      } else {
        // 새로고침 요청 시 기존 캐시 삭제
        cacheStore.delete(cacheKey);
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 🔥 성능 개선: 모든 시트 헤더 확인을 병렬로 처리
      // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON, HEADERS_POLICY_ADDON);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_INSURANCE, HEADERS_POLICY_INSURANCE);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL, HEADERS_POLICY_SPECIAL);

      // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
      const marginRes = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_MARGIN
        });
      });
      const addonRes = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_ADDON
        });
      });
      const insuranceRes = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_INSURANCE
        });
      });
      const specialRes = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_SPECIAL
        });
      });

      // 데이터 처리
      const marginRows = (marginRes.data.values || []).slice(1);
      const marginRow = marginRows.find(row => (row[0] || '').trim() === carrier);
      const margin = marginRow ? Number(marginRow[1] || 0) : 50000; // 기본값 50000

      const addonRows = (addonRes.data.values || []).slice(1);
      const addons = addonRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          fee: Number(row[2] || 0),
          incentive: Number(row[3] || 0),
          deduction: Number(row[4] || 0),
          description: (row[5] || '').trim(),
          url: (row[6] || '').trim()
        }));

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
          deduction: Number(row[6] || 0),
          description: (row[7] || '').trim(),
          url: (row[8] || '').trim()
        }));

      const specialRows = (specialRes.data.values || []).slice(1);
      const specialPolicies = specialRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => {
          // 🔥 기존 데이터 마이그레이션 (5개 컬럼 → 6개 컬럼)
          if (row.length === 5) {
            // 기존 형식: ['통신사', '정책명', '추가금액', '차감금액', '적용여부']
            return {
              id: idx + 1,
              name: (row[1] || '').trim(),
              policyType: 'general', // 기본값
              amount: Number(row[2] || 0) - Number(row[3] || 0), // addition - deduction
              isActive: (row[4] || '').toString().toLowerCase() === 'true' || (row[4] || '').toString() === '1',
              conditionsJson: null,
              // 하위 호환을 위해 addition, deduction도 유지
              addition: Number(row[2] || 0),
              deduction: Number(row[3] || 0)
            };
          }
          // 새 형식: ['통신사', '정책명', '정책타입', '금액', '적용여부', '조건JSON']
          let conditionsJson = null;
          try {
            const conditionsJsonStr = (row[5] || '').trim();
            if (conditionsJsonStr) {
              conditionsJson = JSON.parse(conditionsJsonStr);
            }
          } catch (e) {
            console.warn(`[Direct][getPolicySettings] 정책 조건 JSON 파싱 실패: ${row[1]}`, e);
          }

          return {
            id: idx + 1,
            name: (row[1] || '').trim(),
            policyType: (row[2] || '').trim() || 'general',
            amount: Number(row[3] || 0), // 양수: 추가, 음수: 차감
            isActive: (row[4] || '').toString().toLowerCase() === 'true' || (row[4] || '').toString() === '1',
            conditionsJson: conditionsJson
          };
        });

      // 중복 제거 헬퍼 함수
      const removeDuplicates = (list, key = 'name') => {
        const seen = new Set();
        return list.filter(item => {
          const val = (item[key] || '').toString().trim();
          if (seen.has(val)) return false;
          seen.add(val);
          return true;
        });
      };

      const result = {
        success: true,
        margin: { baseMargin: margin },
        addon: { list: removeDuplicates(addons) },
        insurance: { list: removeDuplicates(insurances) },
        special: { list: removeDuplicates(specialPolicies) }
      };

      // 캐시 저장 (5분)
      setCache(cacheKey, result, 5 * 60 * 1000);

      res.json(result);
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

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에도 저장
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';
      if (useDatabase) {
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        // 병렬로 Supabase 저장 실행
        await Promise.all([
          margin && margin.baseMargin !== undefined ? DirectStoreDAL.savePolicyMargin(carrier, margin.baseMargin) : Promise.resolve(),
          addon && addon.list ? DirectStoreDAL.savePolicyAddonServices(carrier, addon.list) : Promise.resolve(),
          insurance && insurance.list ? DirectStoreDAL.savePolicyInsurance(carrier, insurance.list) : Promise.resolve(),
          special && special.list ? DirectStoreDAL.savePolicySpecial(carrier, special.list) : Promise.resolve()
        ]);

        console.log(`✅ [POST /api/direct/policy-settings] Supabase 저장 완료 (${carrier})`);
      }

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
          item.deduction || 0,
          item.description || '',
          item.url || ''
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
          item.deduction || 0,
          item.description || '',
          item.url || ''
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
        const newSpecialRows = special.list.map(item => {
          // 🔥 조건JSON 생성
          let conditionsJsonStr = '';
          if (item.policyType === 'conditional' && item.conditionsJson) {
            if (typeof item.conditionsJson === 'string') {
              conditionsJsonStr = item.conditionsJson;
            } else {
              conditionsJsonStr = JSON.stringify(item.conditionsJson);
            }
          }

          // 🔥 amount 필드 사용 (기존 addition/deduction도 지원)
          const amount = item.amount !== undefined
            ? item.amount
            : ((item.addition || 0) - (item.deduction || 0));

          return [
            carrier,
            item.name || '',
            item.policyType || 'general',
            amount,
            item.isActive ? 'TRUE' : 'FALSE',
            conditionsJsonStr
          ];
        });
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

      // 정책 설정 캐시 무효화 (메모리 캐시)
      policySettingsCache.delete(`policy-settings-${carrier}`);
      console.log(`🧹 [Direct] 정책 설정 메모리 캐시 무효화: policy-settings-${carrier}`);

      deleteCache(`policy-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings POST error:', error);
      res.status(500).json({ success: false, error: '정책 설정 저장 실패', message: error.message });
    }
  });

  // DELETE /api/direct/policy-settings/margin/:carrier
  router.delete('/policy-settings/margin/:carrier', async (req, res) => {
    try {
      const { carrier } = req.params;
      console.log(`🗑️ [DELETE /api/direct/policy-settings/margin] 정책 마진 삭제 시작 (${carrier})`);

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 삭제
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        const DirectStoreDAL = require('./dal/DirectStoreDAL');
        await DirectStoreDAL.deletePolicyMargin(carrier);
        console.log(`✅ [DELETE /api/direct/policy-settings/margin] Supabase에서 삭제 완료 (${carrier})`);
      } else {
        // Google Sheets에서 삭제 (폴백) - 구현 필요
        console.log(`⚠️ [DELETE /api/direct/policy-settings/margin] Google Sheets 삭제는 아직 구현되지 않았습니다.`);
        return res.status(501).json({ success: false, error: 'Google Sheets 삭제 미구현' });
      }

      // 정책 설정 캐시 무효화
      deleteCache(`policy-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings/margin DELETE error:', error);
      res.status(500).json({ success: false, error: '정책 마진 삭제 실패', message: error.message });
    }
  });

  // DELETE /api/direct/policy-settings/addon/:carrier
  router.delete('/policy-settings/addon/:carrier', async (req, res) => {
    try {
      const { carrier } = req.params;
      console.log(`🗑️ [DELETE /api/direct/policy-settings/addon] 부가서비스 정책 삭제 시작 (${carrier})`);

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 삭제
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        const DirectStoreDAL = require('./dal/DirectStoreDAL');
        await DirectStoreDAL.deletePolicyAddonServices(carrier);
        console.log(`✅ [DELETE /api/direct/policy-settings/addon] Supabase에서 삭제 완료 (${carrier})`);
      } else {
        // Google Sheets에서 삭제 (폴백) - 구현 필요
        console.log(`⚠️ [DELETE /api/direct/policy-settings/addon] Google Sheets 삭제는 아직 구현되지 않았습니다.`);
        return res.status(501).json({ success: false, error: 'Google Sheets 삭제 미구현' });
      }

      // 정책 설정 캐시 무효화
      deleteCache(`policy-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings/addon DELETE error:', error);
      res.status(500).json({ success: false, error: '부가서비스 정책 삭제 실패', message: error.message });
    }
  });

  // DELETE /api/direct/policy-settings/insurance/:carrier
  router.delete('/policy-settings/insurance/:carrier', async (req, res) => {
    try {
      const { carrier } = req.params;
      console.log(`🗑️ [DELETE /api/direct/policy-settings/insurance] 보험상품 정책 삭제 시작 (${carrier})`);

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 삭제
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        const DirectStoreDAL = require('./dal/DirectStoreDAL');
        await DirectStoreDAL.deletePolicyInsurance(carrier);
        console.log(`✅ [DELETE /api/direct/policy-settings/insurance] Supabase에서 삭제 완료 (${carrier})`);
      } else {
        // Google Sheets에서 삭제 (폴백) - 구현 필요
        console.log(`⚠️ [DELETE /api/direct/policy-settings/insurance] Google Sheets 삭제는 아직 구현되지 않았습니다.`);
        return res.status(501).json({ success: false, error: 'Google Sheets 삭제 미구현' });
      }

      // 정책 설정 캐시 무효화
      deleteCache(`policy-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings/insurance DELETE error:', error);
      res.status(500).json({ success: false, error: '보험상품 정책 삭제 실패', message: error.message });
    }
  });

  // DELETE /api/direct/policy-settings/special/:carrier
  router.delete('/policy-settings/special/:carrier', async (req, res) => {
    try {
      const { carrier } = req.params;
      console.log(`🗑️ [DELETE /api/direct/policy-settings/special] 특별 정책 삭제 시작 (${carrier})`);

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 삭제
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        const DirectStoreDAL = require('./dal/DirectStoreDAL');
        await DirectStoreDAL.deletePolicySpecial(carrier);
        console.log(`✅ [DELETE /api/direct/policy-settings/special] Supabase에서 삭제 완료 (${carrier})`);
      } else {
        // Google Sheets에서 삭제 (폴백) - 구현 필요
        console.log(`⚠️ [DELETE /api/direct/policy-settings/special] Google Sheets 삭제는 아직 구현되지 않았습니다.`);
        return res.status(501).json({ success: false, error: 'Google Sheets 삭제 미구현' });
      }

      // 정책 설정 캐시 무효화
      deleteCache(`policy-settings-${carrier}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings/special DELETE error:', error);
      res.status(500).json({ success: false, error: '특별 정책 삭제 실패', message: error.message });
    }
  });

  // === 링크 설정 ===

  // GET /api/direct/link-settings?carrier=SK
  router.get('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 읽기
      // [Hotfix] 링크 설정은 Google Sheets를 주 데이터소스로 사용하기 위해 Supabase 비활성화 (사용자 요청)
      const useDatabase = false; // process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 읽기 (DirectStoreDAL 사용)
        console.log(`📖 [GET /api/direct/link-settings] Supabase에서 데이터 읽기 시작 (${carrier})`);

        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        // 모든 설정 조회 (withRetrySupabase 적용)
        const settingsData = await withRetrySupabase(async () => {
          return await DirectStoreDAL.getSettings(carrier);
        });

        // 🔥 수파베이스에 설정이 하나라도 있으면 처리 후 반환
        if (settingsData && settingsData.length > 0) {
          // 🔥 디버그 로그 추가
          console.log(`[LinkSettings] Supabase 원본 데이터 (${carrier}):`, JSON.stringify(settingsData, null, 2));

          // 설정 유형별로 그룹화 (한글/영어 라벨 모두 대응)
          const findSetting = (data, type) => {
            const labels = {
              'planGroup': ['planGroup', '요금제그룹', '요금제그룹핑', '요금제'],
              'support': ['support', '이통사지원금', '공시지원금', '지원금'],
              'policy': ['policy', '정책표', '리베이트', '정책', '단말정책']
            }[type] || [type];
            const found = data.find(row => labels.some(label => row.settingType === label));
            if (found) {
              console.log(`[LinkSettings] ${carrier} ${type} 매칭 성공: settingType=${found.settingType}`);
            } else {
              console.warn(`[LinkSettings] ${carrier} ${type} 매칭 실패: labels=[${labels.join(', ')}]`);
            }
            return found;
          };

          const planGroupRow = findSetting(settingsData, 'planGroup');
          const supportRow = findSetting(settingsData, 'support');
          const policyRow = findSetting(settingsData, 'policy');

          let planGroup = { link: '', planGroups: [] };
          let support = { link: '' };
          let policy = { link: '' };

          if (planGroupRow) {
            const settingsJson = planGroupRow.settings || {};
            planGroup = {
              link: planGroupRow.sheetId || '',
              sheetId: planGroupRow.sheetId || '',
              planNameRange: settingsJson.planNameRange || '',
              planGroupRange: settingsJson.planGroupRange || '',
              basicFeeRange: settingsJson.basicFeeRange || '',
              planGroups: settingsJson.planGroups || []
            };
          }

          if (supportRow) {
            const settingsJson = supportRow.settings || {};
            support = {
              link: supportRow.sheetId || '',
              sheetId: supportRow.sheetId || '',
              modelRange: settingsJson.modelRange || '',
              petNameRange: settingsJson.petNameRange || '',
              factoryPriceRange: settingsJson.factoryPriceRange || '',
              openingTypeRange: settingsJson.openingTypeRange || '',
              planGroupRanges: settingsJson.planGroupRanges || {}
            };
          }

          if (policyRow) {
            const settingsJson = policyRow.settings || {};
            policy = {
              link: policyRow.sheetId || '',
              sheetId: policyRow.sheetId || '',
              modelRange: settingsJson.modelRange || '',
              petNameRange: settingsJson.petNameRange || '',
              planGroupRanges: settingsJson.planGroupRanges || {}
            };
          }

          console.log(`✅ [GET /api/direct/link-settings] Supabase에서 데이터 읽기 완료 (${carrier})`);

          return res.json({
            success: true,
            planGroup,
            support,
            policy
          });
        }

        console.warn(`⚠️ [LinkSettings] Supabase에 ${carrier} 설정이 없습니다. Google Sheets로 폴백합니다.`);
      }

      // Google Sheets에서 읽기 (기존 로직)
      console.log(`📖 [GET /api/direct/link-settings] Google Sheets에서 데이터 읽기 시작 (${carrier})`);

      // 캐시된 링크 설정 사용 (중복 호출 및 rate limit 감소)
      const carrierSettings = await getLinkSettings(carrier);


      // 설정 유형별로 그룹화 (한글/영어 라벨 모두 대응)
      const findRow = (settings, type) => {
        const labels = {
          'planGroup': ['planGroup', '요금제그룹', '요금제그룹핑', '요금제'],
          'support': ['support', '이통사지원금', '공시지원금', '지원금'],
          'policy': ['policy', '정책표', '리베이트', '정책', '단말정책']
        }[type] || [type];

        const found = settings.find(row => labels.some(label => (row[1] || '').trim() === label));
        if (found) {
          console.log(`[LinkSettings] ${carrier} ${type} 매칭 성공: Label=${found[1]}`);
        } else {
          console.warn(`[LinkSettings] ${carrier} ${type} 매칭 실패: 검색라벨=[${labels.join(', ')}]`);
        }
        return found;
      };

      const planGroupRow = findRow(carrierSettings, 'planGroup');
      const supportRow = findRow(carrierSettings, 'support');
      const policyRow = findRow(carrierSettings, 'policy');

      // JSON 데이터 추출 헬퍼 (E열 우선, 없으면 D열 확인)
      const getJson = (row) => {
        if (!row) return {};
        const jsonStr = row[4] || row[3] || '';
        try {
          return (jsonStr && (jsonStr.startsWith('{') || jsonStr.startsWith('['))) ? JSON.parse(jsonStr) : {};
        } catch (e) {
          return {};
        }
      };

      let planGroup = { link: '', planGroups: [] };
      let support = { link: '' };
      let policy = { link: '' };

      if (planGroupRow) {
        const settingsJson = getJson(planGroupRow);
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
        const settingsJson = getJson(supportRow);
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
        const settingsJson = getJson(policyRow);
        policy = {
          link: policyRow[2] || '',
          sheetId: policyRow[2] || '',
          modelRange: settingsJson.modelRange || '',
          petNameRange: settingsJson.petNameRange || '',
          planGroupRanges: settingsJson.planGroupRanges || {}
        };
      }

      console.log(`✅ [GET /api/direct/link-settings] 분석 완료 (${carrier} - Sheets):`, {
        planGroupCount: planGroup.planGroups.length,
        hasSupport: !!support.link,
        hasPolicy: !!policy.link
      });

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

  // DELETE /api/direct/link-settings/:carrier/:settingType
  // 링크 설정 삭제
  router.delete('/link-settings/:carrier/:settingType', async (req, res) => {
    try {
      const { carrier, settingType } = req.params;

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 삭제
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 삭제 (DirectStoreDAL 사용)
        console.log(`🗑️ [DELETE /api/direct/link-settings] Supabase에서 데이터 삭제 시작 (${carrier} - ${settingType})`);

        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        // 링크 설정 삭제 (withRetrySupabase 적용)
        await withRetrySupabase(async () => {
          return await DirectStoreDAL.deleteLinkSettings(carrier, settingType);
        });

        console.log(`✅ [DELETE /api/direct/link-settings] Supabase에서 데이터 삭제 완료 (${carrier} - ${settingType})`);

        return res.json({
          success: true,
          message: `링크 설정이 삭제되었습니다. (${carrier} - ${settingType})`
        });
      }

      // Google Sheets에서 삭제 (기존 로직)
      console.log(`🗑️ [DELETE /api/direct/link-settings] Google Sheets에서 데이터 삭제 시작 (${carrier} - ${settingType})`);

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 직영점_설정 헤더 보장
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

      // 시트 데이터 로드
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_SETTINGS
        });
      });

      const rows = (response.data.values || []).slice(1);


      // 삭제할 행 찾기 (한글/영어 라벨 모두 대응)
      const labels = {
        'planGroup': ['planGroup', '요금제그룹', '요금제그룹핑'],
        'support': ['support', '이통사지원금', '공시지원금'],
        'policy': ['policy', '정책표', '리베이트']
      }[settingType] || [settingType];

      const rowIndex = rows.findIndex(row =>
        (row[0] || '').trim() === carrier &&
        labels.some(label => (row[1] || '').trim() === label)
      );

      if (rowIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `링크 설정을 찾을 수 없습니다. (${carrier} - ${settingType})`
        });
      }

      // 행 삭제 (실제 행 번호는 헤더 + 1 + rowIndex)
      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_SETTINGS),
                  dimension: 'ROWS',
                  startIndex: rowIndex + 1, // 헤더 다음부터
                  endIndex: rowIndex + 2
                }
              }
            }]
          }
        });
      });

      // 캐시 무효화
      deleteCache(`link-settings-${carrier}`);

      console.log(`✅ [DELETE /api/direct/link-settings] Google Sheets에서 데이터 삭제 완료 (${carrier} - ${settingType})`);

      res.json({
        success: true,
        message: `링크 설정이 삭제되었습니다. (${carrier} - ${settingType})`
      });
    } catch (error) {
      console.error(`[Direct] link-settings DELETE error (통신사: ${req.params.carrier}, 설정유형: ${req.params.settingType}):`, error);
      console.error('[Direct] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: '링크 설정 삭제 중 오류가 발생했습니다.',
        details: error.message
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

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에 저장
      // [Hotfix] 링크 설정 복구를 위해 Google Sheets에 강제 저장 (Supabase 비활성화)
      const useDatabase = false; // process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        console.log(`💾 [POST /api/direct/link-settings] Supabase에 데이터 저장 시작 (${carrier})`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        const saveToSupabase = async (type, data) => {
          if (!data) return;
          const settingsJson = data; // 이미 밖에서 정규화된 형태의 데이터를 받음

          await withRetrySupabase(async () => {
            return await DirectStoreDAL.saveLinkSettings(carrier, type, data.sheetId || data.link || '', settingsJson);
          });
        };

        if (planGroup) await saveToSupabase('planGroup', {
          sheetId: planGroup.sheetId || planGroup.link || '',
          planNameRange: planGroup.planNameRange || '',
          planGroupRange: planGroup.planGroupRange || '',
          basicFeeRange: planGroup.basicFeeRange || '',
          planGroups: planGroup.planGroups || []
        });
        if (support) await saveToSupabase('support', {
          sheetId: support.sheetId || support.link || '',
          modelRange: support.modelRange || '',
          petNameRange: support.petNameRange || '',
          factoryPriceRange: support.factoryPriceRange || '',
          openingTypeRange: support.openingTypeRange || '',
          planGroupRanges: support.planGroupRanges || {}
        });
        if (policy) await saveToSupabase('policy', {
          sheetId: policy.sheetId || policy.link || '',
          modelRange: policy.modelRange || '',
          petNameRange: policy.petNameRange || '',
          planGroupRanges: policy.planGroupRanges || {}
        });

        return res.json({ success: true, message: 'Supabase에 설정이 저장되었습니다.' });
      }

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
      const settingsRows = settingsRes.data.values || [];

      // 통신사별 설정 필터링 및 업데이트/추가
      // 통신사별 설정 필터링 및 업데이트/추가
      const findRowIdx = (settings, type) => {
        // 🔥 수정: 라벨 비교 로직 개선 (공백 제거, 대소문자 무시)
        const normalize = (str) => (str || '').toString().trim().toLowerCase();
        const targetType = normalize(type);

        // 동의어 매핑
        const synonymMap = {
          'plangroup': ['plangroup', '요금제그룹', '요금제그룹핑'],
          'support': ['support', '이통사지원금', '공시지원금'],
          'policy': ['policy', '정책표', '리베이트']
        };
        const validLabels = synonymMap[targetType] || [targetType];

        return settings.findIndex(row => {
          const rowCarrier = normalize(row[0]);
          const rowType = normalize(row[1]);
          return rowCarrier === normalize(carrier) && validLabels.includes(rowType);
        });
      };

      if (planGroup) {
        const existingRowIndex = findRowIdx(settingsRows, 'planGroup');
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
        const existingRowIndex = findRowIdx(settingsRows, 'support');
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
        const existingRowIndex = findRowIdx(settingsRows, 'policy');
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

      // 링크설정 저장 후 해당 통신사의 요금제마스터를 바로 재빌드
      try {
        const rebuildResult = await rebuildPlanMaster([carrier]);
        console.log('[Direct] plans-master rebuilt after link-settings save:', {
          carrier,
          totalCount: rebuildResult.totalCount,
          perCarrier: rebuildResult.perCarrier
        });
      } catch (rebuildError) {
        console.warn('[Direct] plans-master rebuild failed after link-settings save (continuing):', rebuildError.message);
      }

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
    fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'directRoutes.js:1087', message: 'getMobileList 호출 시작', data: { carrier, options }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H2' }) }).catch(() => { });
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
      // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
      let modelData = [];
      let petNameData = [];

      if (modelRange) {
        try {
          const modelRes = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: policySheetId,
              range: modelRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            });
          });
          modelData = modelRes.data.values || [];
        } catch (err) {
          console.warn(`[Direct] 정책표 모델명 읽기 실패:`, err.message);
          modelData = [];
        }
      }

      if (petNameRange) {
        try {
          const petNameRes = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: policySheetId,
              range: petNameRange,
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE'
            });
          });
          petNameData = petNameRes.data.values || [];
        } catch (err) {
          console.warn(`[Direct] 정책표 펫네임 읽기 실패:`, err.message);
          petNameData = [];
        }
      }

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
          // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
          let supportFactoryPriceData = [];

          try {
            const supportModelRes = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: supportSheetId,
                range: supportModelRange,
                majorDimension: 'ROWS',
                valueRenderOption: 'UNFORMATTED_VALUE'
              });
            });
            supportModelData = supportModelRes.data.values || [];
          } catch (err) {
            console.warn(`[Direct] 이통사 지원금 모델명 읽기 실패:`, err.message);
            supportModelData = [];
          }

          if (factoryPriceRange) {
            try {
              const factoryPriceRes = await withRetry(async () => {
                return await sheets.spreadsheets.values.get({
                  spreadsheetId: supportSheetId,
                  range: factoryPriceRange,
                  majorDimension: 'ROWS',
                  valueRenderOption: 'UNFORMATTED_VALUE'
                });
              });
              supportFactoryPriceData = factoryPriceRes.data.values || [];
            } catch (err) {
              console.warn(`[Direct] 이통사 지원금 출고가 읽기 실패:`, err.message);
              supportFactoryPriceData = [];
            }
          }

          if (openingTypeRange) {
            try {
              const openingTypeRes = await withRetry(async () => {
                return await sheets.spreadsheets.values.get({
                  spreadsheetId: supportSheetId,
                  range: openingTypeRange,
                  majorDimension: 'ROWS',
                  valueRenderOption: 'UNFORMATTED_VALUE'
                });
              });
              supportOpeningTypeData = openingTypeRes.data.values || [];
            } catch (err) {
              console.warn(`[Direct] 이통사 지원금 개통유형 읽기 실패:`, err.message);
              supportOpeningTypeData = [];
            }
          }

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
              // 🔥 핵심 수정: 전유형은 기존 값이 있으면 덮어쓰지 않음 (개별 유형 우선)
              if (openingTypeRaw === '전유형' || openingTypes.includes('전유형')) {
                const allTypes = ['010신규', 'MNP', '기변', '번호이동'];
                allTypes.forEach(ot => {
                  const key = `${supportModel}|${ot}`;
                  // 개별 유형이 이미 있으면 전유형 값으로 덮어쓰지 않음
                  if (!supportSheetData[key]) {
                    supportSheetData[key] = entry;
                  }

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

                // 🔥 핵심 수정: "번호이동" 행은 "번호이동" 키에만 설정, "MNP" 키에는 설정하지 않음
                // parseOpeningTypes("번호이동")이 ['MNP']를 반환하므로, openingTypeRaw를 직접 사용
                if (openingTypeRaw === '번호이동') {
                  // "번호이동" 키에만 설정
                  const 번호이동Key = `${supportModel}|번호이동`;
                  if (!supportSheetData[번호이동Key]) {
                    supportSheetData[번호이동Key] = entry;
                  }
                  // "MNP" 키에는 설정하지 않음 (정확한 "MNP" 행이 우선)
                } else {
                  // 다른 개통유형은 기존 로직대로 처리
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
                }

                // 🔥 핵심 수정: "번호이동" → MNP 매핑 제거
                // 문제: "번호이동" 행이 "MNP" 키에도 값을 설정하여 값이 섞이는 문제 발생
                // 해결: 상호 매핑을 완전히 제거하고, 정확한 키만 사용
                // if (openingTypeRaw === '번호이동' || openingTypes.includes('번호이동')) {
                //   const mnpKeys = [
                //     `${supportModel}|MNP`,
                //     `${supportModel.toLowerCase()}|MNP`,
                //     `${supportModel.toUpperCase()}|MNP`
                //   ];
                //   if (normalizedModel) {
                //     mnpKeys.push(
                //       `${normalizedModel}|MNP`,
                //       `${normalizedModel.toLowerCase()}|MNP`,
                //       `${normalizedModel.toUpperCase()}|MNP`
                //     );
                //   }
                //   mnpKeys.forEach(key => {
                //     if (!supportSheetData[key]) {
                //       supportSheetData[key] = entry;
                //     }
                //   });
                // }

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

                  // 🔥 핵심 수정: "010신규"와 "기변"으로도 각각 저장
                  // 하지만 기존 값이 있으면 덮어쓰지 않음 (개별 유형 우선)
                  ['010신규', '기변'].forEach(ot => {
                    const key = `${supportModel}|${ot}`;
                    // 🔥 핵심 수정: 기존 값이 있으면 덮어쓰지 않음 (개별 유형 우선)
                    // "010신규/기변" 행이 "기변" 키에 값을 설정하려 할 때,
                    // 이미 "기변" 키에 개별 유형 행의 값이 있으면 덮어쓰지 않음
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
      // 로그 제거 (성능 최적화)

      let supportMapBuilt = false;
      if (supportRanges.length === 0) {
        console.warn(`[Direct] planGroupSupportData 생성 실패: supportRanges가 비어있습니다. planGroupRanges 설정을 확인하세요.`);
      }

      if (supportRanges.length > 0 && supportModelData.length > 0 && supportOpeningTypeData.length > 0) {
        try {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'directRoutes.js:1454', message: '지원금 범위 batchGet 시작', data: { carrier: carrierParam, rangesCount: supportRanges.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H4' }) }).catch(() => { });
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

            // 디버그 로그 제거 (성능 최적화)

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

              // 디버그 로그 제거 (성능 최적화)

              // 하이픈 변형 생성 (조회 시와 동일한 로직)
              const hyphenVariants = generateHyphenVariants(model);

              // 키 생성 헬퍼 함수 (모든 변형 생성)
              // 🔥 핵심 수정: 전유형 행은 기존 값이 있으면 절대 덮어쓰지 않음
              const isAllType = openingTypeRaw === '전유형' || openingTypes.includes('전유형');

              const addKeys = (openingType, isExplicitMapping = false) => {
                const setIfBetter = (key, value, isExplicit = false) => {
                  // 1. 새 값이 0이고 기존 값이 0보다 크면 덮어쓰지 않음
                  if (value === 0 && supportMap[key] && supportMap[key] > 0) {
                    return; // 기존 값 유지
                  }
                  // 2. 🔥 전유형 행은 기존 값이 있으면 절대 덮어쓰지 않음 (개별 유형 우선)
                  if (isAllType && supportMap[key] !== undefined) {
                    return; // 기존 값 유지 (번호이동/010신규 등 개별 유형이 우선)
                  }

                  // 🔥 핵심 수정: 우선순위 로직
                  // 정확한 키 매칭이 우선 (예: "번호이동" 행은 "번호이동" 키에만, "MNP" 행은 "MNP" 키에만)
                  // 명시적 매핑(상호 매핑)은 기존 정확한 키가 있으면 덮어쓰지 않음
                  if (isExplicit && supportMap[key] !== undefined) {
                    // 키에서 openingType 추출
                    const keyOpeningType = key.split('|')[1];

                    // 🔥 핵심 수정: 상호 매핑 시 정확한 키가 이미 있으면 절대 덮어쓰지 않음
                    // "MNP" <-> "번호이동" 상호 매핑인 경우
                    if ((keyOpeningType === 'MNP' && (openingTypeRaw === '번호이동' || openingTypes.includes('번호이동'))) ||
                      (keyOpeningType === '번호이동' && (openingTypeRaw === 'MNP' || openingTypes.includes('MNP')))) {
                      // 상호 매핑이지만, 정확한 키가 이미 설정되어 있으면 덮어쓰지 않음
                      // 예: "MNP" 키에 정확한 값이 있으면 "번호이동" 행의 상호 매핑 값으로 덮어쓰지 않음
                      const exactKeyForTarget = `${model}|${keyOpeningType}`;
                      if (supportMap[exactKeyForTarget] !== undefined) {
                        return; // 정확한 키가 있으면 상호 매핑 값으로 덮어쓰지 않음
                      }
                    }

                    // 현재 행의 openingTypeRaw와 정확히 일치하는 키는 덮어쓰지 않음
                    if (keyOpeningType === openingTypeRaw) {
                      return; // 정확한 키는 보호
                    }
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
                setIfBetter(`${model}|${openingType}`, supportValue, isExplicitMapping);
                setIfBetter(`${model.toLowerCase()}|${openingType}`, supportValue, isExplicitMapping);
                setIfBetter(`${model.toUpperCase()}|${openingType}`, supportValue, isExplicitMapping);

                // 하이픈 변형
                hyphenVariants.forEach(variant => {
                  if (variant && variant !== model) {
                    setIfBetter(`${variant}|${openingType}`, supportValue, isExplicitMapping);
                    setIfBetter(`${variant.toLowerCase()}|${openingType}`, supportValue, isExplicitMapping);
                    setIfBetter(`${variant.toUpperCase()}|${openingType}`, supportValue, isExplicitMapping);
                  }
                });

                // 정규화된 모델명 변형 (대소문자 포함)
                if (normalizedModel) {
                  setIfBetter(`${normalizedModel}|${openingType}`, supportValue, isExplicitMapping);
                  setIfBetter(`${normalizedModel.toLowerCase()}|${openingType}`, supportValue, isExplicitMapping);
                  setIfBetter(`${normalizedModel.toUpperCase()}|${openingType}`, supportValue, isExplicitMapping);
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

                // 🔥 핵심 수정: 정확한 키를 먼저 설정 (isExplicitMapping=false)
                // (A) 기본 파싱된 유형들 매핑 (010신규, MNP, 기변)
                openingTypes.forEach(ot => addKeys(ot, false));

                // 🔥 핵심 수정: 상호 매핑 제거 - 정확한 키만 사용
                // (B) "MNP" <-> "번호이동" 상호 매핑 제거
                // 문제: 상호 매핑으로 설정된 키는 나중에 정확한 키가 처리될 때 덮어쓰지 않아서 값이 섞임
                // 해결: 상호 매핑을 완전히 제거하고, 정확한 키만 사용
                // if (openingTypes.includes('MNP') || openingTypeRaw.includes('번호이동')) {
                //   const otherType = openingTypeRaw.includes('번호이동') ? 'MNP' : '번호이동';
                //   const exactKeyForOther = `${model}|${otherType}`;
                //   if (supportMap[exactKeyForOther] === undefined) {
                //     addKeys(otherType, true);
                //   }
                // }

                // (C) "010신규" / "기변" <-> "010신규/기변" 상호 매핑
                // "010신규/기변" Row는 010신규, 기변, 010신규/기변 키 모두에 매핑되어야 함
                if (openingTypeRaw.includes('010신규/기변') ||
                  (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                  const newChangeTargets = ['010신규', '기변', '010신규/기변'];
                  newChangeTargets.forEach(ot => addKeys(ot, false));
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
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'directRoutes.js:1677', message: '정책표 모델명 읽기 시작 (리베이트용)', data: { carrier: carrierParam, modelRange }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
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
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'directRoutes.js:1683', message: '정책표 모델명 읽기 성공', data: { carrier: carrierParam, modelCount: policyModelData.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
          // #endregion
        } catch (err) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'directRoutes.js:1687', message: '정책표 모델명 읽기 실패', data: { carrier: carrierParam, error: err.message, code: err.code, status: err.response?.status }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
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
            range: `${SHEET_POLICY_MARGIN}!A:B` // 🔥 수정: 명시적으로 A:B 범위 지정 (getPolicySettings와 동일)
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
          range: '직영점_모델이미지!A:K'
        }).catch((err) => {
          console.error(`[Direct] ⚠️ 직영점_모델이미지 시트 읽기 실패:`, err.message);
          return { data: { values: [] } };
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '직영점_오늘의휴대폰!A:N' // 수정: A:Z → A:N
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
        // 로그 제거 (성능 최적화 - 매번 호출되는 불필요한 로그)
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
        // 통신사(A열, 인덱스 0), 모델ID(B열, 인덱스 1), 모델명(C열, 인덱스 2), 이미지URL(F열, 인덱스 5), Discord메시지ID(I열, 인덱스 8), Discord스레드ID(K열, 인덱스 10) 매핑
        const rowCarrier = (row[0] || '').trim();
        const modelId = (row[1] || '').trim(); // 모델ID (실제 모델 코드)
        const modelName = (row[2] || '').trim(); // 모델명 (모델ID와 동일)
        let imageUrl = (row[5] || '').trim();
        const discordMessageId = (row[8] || '').trim(); // I: Discord메시지ID
        const discordThreadId = (row[10] || '').trim(); // K: Discord스레드ID

        // 이미지 URL 정규화: 이중 하이픈 제거
        imageUrl = normalizeImageUrl(imageUrl);

        // 이미지 URL이 없으면 건너뛰기
        if (!imageUrl) {
          return;
        }

        // 통신사 필터링: 현재 조회 중인 통신사와 정확히 일치하는 경우만 매핑
        // 통신사가 비어있으면 해당 행을 건너뛰어 잘못된 매핑 방지
        if (!rowCarrier) {
          return;
        }

        // 통신사가 일치하는 경우만 매핑
        if (rowCarrier === carrierParam) {
          // 모델ID와 모델명 중 하나라도 있으면 사용 (둘 다 실제 모델 코드와 동일)
          const actualModelCode = modelId || modelName;

          if (actualModelCode) {
            // 이미지 정보 객체 생성 (URL + Discord 정보)
            const imageInfo = {
              imageUrl,
              discordMessageId: discordMessageId || null,
              discordThreadId: discordThreadId || null
            };

            // 원본 모델 코드로 키 생성 (정확한 매칭)
            const key = `${carrierParam}:${actualModelCode}`;
            imageMap.set(key, imageInfo);
            imageMap.set(actualModelCode, imageInfo);
            imageMapCount++;

            // 정규화된 모델 코드로도 키 생성 (형식 차이 무시)
            const normalizedCode = normalizeModelCode(actualModelCode);
            if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
              const normalizedKey = `${carrierParam}:${normalizedCode}`;
              imageMap.set(normalizedKey, imageInfo);
              imageMap.set(normalizedCode, imageInfo);
            }
          }
        }
      });

      console.log(`[Direct] 이미지 맵 생성 완료: ${imageMapCount}개 (통신사=${carrierParam})`);

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

      // 9. 직영점_단말마스터 시트 읽기 (정렬 기준으로 사용)
      let mobileMasterOrderMap = new Map(); // Key: 모델명 -> 순서 인덱스
      try {
        const masterRes = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MOBILE_MASTER}!A:R`
          });
        });
        const masterRows = (masterRes.data.values || []).slice(1);
        masterRows.forEach((row, idx) => {
          const rowCarrier = (row[0] || '').toString().trim().toUpperCase();
          const modelName = (row[2] || '').toString().trim(); // 모델명 (C열)
          if (rowCarrier === carrierParam && modelName) {
            // 통신사가 일치하고 모델명이 있으면 순서 맵에 추가
            mobileMasterOrderMap.set(modelName, idx);
            // 정규화된 모델명으로도 추가
            const normalizedModel = normalizeModelCode(modelName);
            if (normalizedModel && normalizedModel !== modelName) {
              mobileMasterOrderMap.set(normalizedModel, idx);
            }
          }
        });
      } catch (err) {
        console.warn(`[Direct] 직영점_단말마스터 시트 읽기 실패 (정렬 기준 없이 계속 진행):`, err.message);
      }

      // 10. 데이터 조합 (모델명 기준으로 매칭)
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
        // 🔥 수정: 부가미유치 기준 제거 (부가서비스 선택/삭제 시 동적 계산으로 대체)

        // 로그 제거 (불필요한 로그 정리)

        // 구매가 계산
        // 대리점추가지원금에 이미 정책표리베이트, 마진, 부가서비스, 별도정책이 포함되어 있으므로
        // 구매가 = 출고가 - 이통사지원금 - 대리점추가지원금
        const purchasePriceWithAddon = Math.max(0,
          factoryPrice
          - publicSupport       // 이통사지원금 요금제구간별
          - storeSupportWithAddon  // 대리점추가지원금 (정책표리베이트 - 마진 + 부가서비스추가 + 별도정책추가 포함)
        );
        // 🔥 수정: 부가미유치 기준 제거 (purchasePriceWithoutAddon 계산 제거)

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
          // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon, purchasePriceWithoutAddon 제거)
          purchasePriceWithAddon: purchasePriceWithAddon,
          image: (() => {
            // 1. 통신사+모델명 조합으로 먼저 조회 (가장 정확)
            const key = `${carrierParam}:${model}`;
            let imageInfo = imageMap.get(key);
            let foundVia = imageInfo ? `key1:${key}` : null;

            // 2. 없으면 모델명만으로 조회 (하위 호환)
            if (!imageInfo) {
              imageInfo = imageMap.get(model);
              if (imageInfo) foundVia = `key2:${model}`;
            }

            // 3. 정규화된 키로 조회 (형식 차이 무시)
            if (!imageInfo) {
              const normalizedModel = normalizeModelCode(model);
              if (normalizedModel) {
                const normalizedKey = `${carrierParam}:${normalizedModel}`;
                imageInfo = imageMap.get(normalizedKey);
                if (imageInfo) {
                  foundVia = `key3:${normalizedKey}`;
                } else {
                  imageInfo = imageMap.get(normalizedModel);
                  if (imageInfo) foundVia = `key4:${normalizedModel}`;
                }
              }
            }

            // 4. 여전히 없으면 유사한 키 찾기 (공백, 하이픈 등 차이 무시)
            if (!imageInfo && imageMap.size > 0) {
              const modelNormalized = normalizeModelCode(model);
              const mapKeys = Array.from(imageMap.keys());

              for (const mapKey of mapKeys) {
                // 통신사 부분 제거 후 비교
                const keyWithoutCarrier = mapKey.includes(':') ? mapKey.split(':')[1] : mapKey;
                const keyNormalized = normalizeModelCode(keyWithoutCarrier);

                if (keyNormalized === modelNormalized ||
                  keyNormalized.includes(modelNormalized) ||
                  modelNormalized.includes(keyNormalized)) {
                  imageInfo = imageMap.get(mapKey);
                  if (imageInfo) {
                    foundVia = `key5:${mapKey}`;
                    // 로그 제거 (성능 최적화)
                  }
                  break;
                }
              }
            }

            // 이미지 정보에서 URL 추출
            if (imageInfo) {
              if (typeof imageInfo === 'object' && imageInfo.imageUrl) {
                return imageInfo.imageUrl;
              } else if (typeof imageInfo === 'string') {
                // 하위 호환: 문자열인 경우 (기존 코드)
                return imageInfo;
              }
            }

            // 로그 제거 (성능 최적화 - 모든 모델에 대해 반복 실행되는 불필요한 로그)

            return '';
          })(),
          discordMessageId: (() => {
            // 이미지 정보 조회 (위의 image 로직과 동일)
            const key = `${carrierParam}:${model}`;
            let imageInfo = imageMap.get(key);

            if (!imageInfo) {
              imageInfo = imageMap.get(model);
            }

            if (!imageInfo) {
              const normalizedModel = normalizeModelCode(model);
              if (normalizedModel) {
                imageInfo = imageMap.get(`${carrierParam}:${normalizedModel}`) || imageMap.get(normalizedModel);
              }
            }

            if (imageInfo && typeof imageInfo === 'object' && imageInfo.discordMessageId) {
              return imageInfo.discordMessageId;
            }
            return null;
          })(),
          discordThreadId: (() => {
            // 이미지 정보 조회 (위의 image 로직과 동일)
            const key = `${carrierParam}:${model}`;
            let imageInfo = imageMap.get(key);

            if (!imageInfo) {
              imageInfo = imageMap.get(model);
            }

            if (!imageInfo) {
              const normalizedModel = normalizeModelCode(model);
              if (normalizedModel) {
                imageInfo = imageMap.get(`${carrierParam}:${normalizedModel}`) || imageMap.get(normalizedModel);
              }
            }

            if (imageInfo && typeof imageInfo === 'object' && imageInfo.discordThreadId) {
              return imageInfo.discordThreadId;
            }
            return null;
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

      // 11. 직영점_단말마스터 시트 순서대로 정렬
      if (mobileMasterOrderMap.size > 0) {
        mobileList.sort((a, b) => {
          const modelA = (a.model || '').toString().trim();
          const modelB = (b.model || '').toString().trim();
          const normalizedA = normalizeModelCode(modelA);
          const normalizedB = normalizeModelCode(modelB);

          // 직영점_단말마스터에서 순서 찾기
          const idxA = mobileMasterOrderMap.has(modelA)
            ? mobileMasterOrderMap.get(modelA)
            : (mobileMasterOrderMap.has(normalizedA) ? mobileMasterOrderMap.get(normalizedA) : Number.MAX_SAFE_INTEGER);
          const idxB = mobileMasterOrderMap.has(modelB)
            ? mobileMasterOrderMap.get(modelB)
            : (mobileMasterOrderMap.has(normalizedB) ? mobileMasterOrderMap.get(normalizedB) : Number.MAX_SAFE_INTEGER);

          // 둘 다 직영점_단말마스터에 없으면 원래 순서 유지
          if (idxA === Number.MAX_SAFE_INTEGER && idxB === Number.MAX_SAFE_INTEGER) {
            return 0;
          }

          return idxA - idxB;
        });
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
      const MOBILES_CACHE_VERSION = 'v6'; // v6: 직영점_단말마스터 순서 기준 정렬 추가

      // 정책표 모델 순서 해시 계산 (변경 감지용) - 캐시 우선 확인
      const policyHashCacheKey = `policy-hash-${carrier}`;
      let policyOrderHash = getCache(policyHashCacheKey) || '';

      // 캐시에 없거나 Rate Limit 에러가 아닌 경우에만 계산
      if (!policyOrderHash) {
        try {
          const { sheets, SPREADSHEET_ID } = createSheetsClient();
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
          const settingsRes = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: SHEET_SETTINGS
            });
          });
          const settingsRows = (settingsRes.data.values || []).slice(1);
          const policyRow = settingsRows.find(row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'policy');
          if (policyRow && policyRow[2] && policyRow[4]) {
            const policySheetId = policyRow[2].trim();
            const policySettingsJson = JSON.parse(policyRow[4] || '{}');
            const modelRange = policySettingsJson.modelRange || '';
            if (modelRange) {
              const modelRes = await withRetry(async () => {
                return await sheets.spreadsheets.values.get({
                  spreadsheetId: policySheetId,
                  range: modelRange,
                  majorDimension: 'ROWS',
                  valueRenderOption: 'UNFORMATTED_VALUE'
                });
              });
              const modelRows = (modelRes.data.values || []);
              // 모델 순서를 문자열로 변환하여 해시 생성
              const modelOrderStr = modelRows.map(row => (row[0] || '').toString().trim()).join('|');
              // 간단한 해시 생성 (crypto 모듈 없이)
              let hash = 0;
              for (let i = 0; i < modelOrderStr.length; i++) {
                const char = modelOrderStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 32bit 정수로 변환
              }
              policyOrderHash = Math.abs(hash).toString(36);
              // 해시 결과를 캐시에 저장 (5분)
              setCache(policyHashCacheKey, policyOrderHash, 5 * 60 * 1000);
            }
          }
        } catch (err) {
          console.warn('[Direct] 정책표 순서 해시 계산 실패:', err.message);
          // Rate Limit 에러가 아닌 경우에만 경고
          const isRateLimitError = err.code === 429 || (err.response && err.response.status === 429) ||
            (err.message && err.message.includes('Quota exceeded')) ||
            (err.message && err.message.includes('rateLimitExceeded'));
          if (!isRateLimitError) {
            console.warn('[Direct] 정책표 순서 해시 계산 실패 (캐시 무효화 안됨):', err.message);
          }
          // 해시 계산 실패 시 기본값 사용 (빈 문자열)
          policyOrderHash = '';
        }
      }

      const cacheKey = `mobiles-${carrier}-${MOBILES_CACHE_VERSION}-${policyOrderHash}`;
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
        // Rate Limit 에러 발생 시 캐시된 데이터가 있으면 반환 (최신 데이터는 아니지만 사용자 경험 개선)
        if (cached) {
          console.warn(`[Direct] Rate Limit 에러 발생, 캐시된 데이터 반환 (통신사: ${carrier})`);
          if (includeMeta) {
            return res.json({
              data: cached,
              meta: {
                carrier,
                count: cached.length || 0,
                empty: (cached.length || 0) === 0,
                cached: true,
                timestamp: Date.now(),
                rateLimitError: true,
                warning: 'Google Sheets API 할당량 초과로 캐시된 데이터를 반환합니다.'
              }
            });
          }
          return res.json(cached);
        }

        // 캐시도 없으면 에러 메시지 반환
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
      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 읽기
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 읽기 (DirectStoreDAL 사용)
        console.log(`📖 [GET /api/direct/todays-mobiles] Supabase에서 데이터 읽기 시작`);

        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        // 모든 통신사의 오늘의 휴대폰 조회 (withRetrySupabase 적용)
        const todaysMobiles = await withRetrySupabase(async () => {
          return await DirectStoreDAL.getTodaysMobiles();
        });

        // 프리미엄: isPremium 태그가 true인 상품만 필터링 (3개로 제한)
        const premium = todaysMobiles
          .filter(p => p.isPremium === true)
          .slice(0, 3)
          .map(p => ({
            model: p.modelName,
            petName: p.petName,
            carrier: p.carrier,
            modelId: p.modelId,
            factoryPrice: p.factoryPrice,
            publicSupport: p.publicSupport,
            storeSupportWithAddon: p.storeSupportWithAddon,
            storeSupportNoAddon: p.storeSupportNoAddon,
            purchasePrice: p.factoryPrice - p.publicSupport - p.storeSupportWithAddon,
            purchasePriceWithAddon: p.factoryPrice - p.publicSupport - p.storeSupportWithAddon,
            purchasePriceNoAddon: p.factoryPrice - p.publicSupport - p.storeSupportNoAddon,
            image: p.imageUrl,
            requiredAddons: p.requiredAddons,
            addons: p.requiredAddons,
            isPremium: p.isPremium,
            isBudget: p.isBudget,
            isPopular: p.isPopular,
            isRecommended: p.isRecommended,
            isCheap: p.isCheap
          }));

        // 중저가: isBudget 태그가 true인 상품만 필터링 (2개로 제한)
        const budget = todaysMobiles
          .filter(p => p.isBudget === true)
          .slice(0, 2)
          .map(p => ({
            model: p.modelName,
            petName: p.petName,
            carrier: p.carrier,
            modelId: p.modelId,
            factoryPrice: p.factoryPrice,
            publicSupport: p.publicSupport,
            storeSupportWithAddon: p.storeSupportWithAddon,
            storeSupportNoAddon: p.storeSupportNoAddon,
            purchasePrice: p.factoryPrice - p.publicSupport - p.storeSupportWithAddon,
            purchasePriceWithAddon: p.factoryPrice - p.publicSupport - p.storeSupportWithAddon,
            purchasePriceNoAddon: p.factoryPrice - p.publicSupport - p.storeSupportNoAddon,
            image: p.imageUrl,
            requiredAddons: p.requiredAddons,
            addons: p.requiredAddons,
            isPremium: p.isPremium,
            isBudget: p.isBudget,
            isPopular: p.isPopular,
            isRecommended: p.isRecommended,
            isCheap: p.isCheap
          }));

        const result = { premium, budget };
        console.log(`✅ [GET /api/direct/todays-mobiles] Supabase에서 데이터 읽기 완료 (프리미엄: ${premium.length}개, 중저가: ${budget.length}개)`);

        return res.json(result);
      }

      // Google Sheets에서 읽기 (기존 로직)
      console.log(`📖 [GET /api/direct/todays-mobiles] Google Sheets에서 데이터 읽기 시작`);

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

      // 🔥 Rate Limit 방지: 순차 처리로 변경 (Promise.all 대신)
      const mobileLists = [];
      for (const carrier of carriers) {
        try {
          const mobileList = await getMobileList(carrier);
          mobileLists.push(mobileList);
        } catch (err) {
          console.warn(`[Direct] ${carrier} 통신사 데이터 가져오기 실패:`, err);
          mobileLists.push([]); // 에러 시 빈 배열 반환
        }
      }
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

  // POST /api/direct/todays-mobiles
  // 오늘의 휴대폰 추가
  router.post('/todays-mobiles', async (req, res) => {
    try {
      const {
        modelName,
        petName,
        carrier,
        modelId,
        factoryPrice,
        publicSupport,
        storeSupportWithAddon,
        storeSupportNoAddon,
        imageUrl,
        requiredAddons,
        isPopular,
        isRecommended,
        isCheap,
        isPremium,
        isBudget
      } = req.body;

      // 필수 필드 검증
      if (!modelName || !carrier) {
        return res.status(400).json({
          success: false,
          error: '모델명과 통신사는 필수입니다.'
        });
      }

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에 저장
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에 저장 (DirectStoreDAL 사용)
        console.log(`📝 [POST /api/direct/todays-mobiles] Supabase에 데이터 저장 시작 (${carrier} - ${modelName})`);

        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        const result = await withRetrySupabase(async () => {
          return await DirectStoreDAL.createTodaysMobile({
            modelName,
            petName,
            carrier,
            modelId,
            factoryPrice,
            publicSupport,
            storeSupportWithAddon,
            storeSupportNoAddon,
            imageUrl,
            requiredAddons,
            isPopular: isPopular || false,
            isRecommended: isRecommended || false,
            isCheap: isCheap || false,
            isPremium: isPremium || false,
            isBudget: isBudget || false
          });
        });

        console.log(`✅ [POST /api/direct/todays-mobiles] Supabase에 데이터 저장 완료`);
        return res.json(result);
      }

      // Google Sheets에 저장 (폴백)
      console.log(`📝 [POST /api/direct/todays-mobiles] Google Sheets 폴백 - 501 응답`);
      return res.status(501).json({
        success: false,
        error: 'Google Sheets 모드에서는 지원하지 않습니다. USE_DB_DIRECT_STORE=true로 설정하세요.'
      });

    } catch (error) {
      console.error('[Direct] todays-mobiles POST error:', error);
      res.status(500).json({
        success: false,
        error: '오늘의 휴대폰 추가 실패',
        message: error.message
      });
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
        // 🔥 수정: 부가미유치 기준 제거 (storeSupportNoAddon 제거)
        requiredAddons,
        image
      } = req.body || {};

      // 🔥 Feature Flag 확인
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      // modelId 형식 처리: mobile-{carrier}-{index} 또는 실제 모델 ID
      let carrier = carrierFromBody;
      let index = null;
      let modelNameFromId = null;

      const parts = modelId.split('-');
      if (parts.length >= 3 && parts[0] === 'mobile') {
        // 형식: mobile-{carrier}-{index}
        carrier = carrier || parts[1]; // SK, KT, LG
        index = parseInt(parts[2], 10);
        if (isNaN(index)) {
          return res.status(400).json({ success: false, error: '잘못된 모델 인덱스입니다.' });
        }
      } else {
        // 실제 모델 ID 형식 (예: SMS731N) - 모델명으로 직접 사용
        modelNameFromId = modelId;
        if (!carrier && carrierFromBody) {
          carrier = carrierFromBody;
        } else if (!carrier) {
          // carrier가 없으면 body에서 가져오거나 기본값 사용
          carrier = carrierFromBody || 'SK';
        }
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

      // 모델명 결정 (우선순위: body > modelId에서 추출 > 인덱스로 조회)
      let modelName = (modelFromBody || modelNameFromId || '').toString().trim();
      if (!modelName && index !== null) {
        // 인덱스가 있으면 정책표에서 조회
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

      // 실제 모델 ID를 사용하는 경우, 정책표 조회 없이 바로 사용
      if (!modelName && modelNameFromId) {
        modelName = modelNameFromId;
      }

      if (!modelName) {
        return res.status(404).json({ success: false, error: '모델을 찾을 수 없습니다.' });
      }

      // 🔥 Feature Flag에 따라 Supabase 또는 Google Sheets에 쓰기
      if (useDatabase) {
        // Supabase에 쓰기 (DirectStoreDAL 사용)
        console.log(`📝 [PUT /mobiles/:modelId/tags] Supabase에 태그 업데이트: ${modelName} (${carrier})`);
        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        // 모든 태그가 체크 해제되었는지 확인
        const hasAnyTag = isPopular || isRecommended || isCheap || isPremium || isBudget;

        if (hasAnyTag) {
          // 태그가 있으면 업데이트 또는 생성
          const addonsText = Array.isArray(requiredAddons) ? requiredAddons.join(', ') : (requiredAddons || '');

          await withRetrySupabase(async () => {
            return await DirectStoreDAL.updateTodaysMobileTags(modelName, carrier, {
              isPopular: !!isPopular,
              isRecommended: !!isRecommended,
              isCheap: !!isCheap,
              isPremium: !!isPremium,
              isBudget: !!isBudget,
              petName: petNameFromBody || '',
              modelId: modelId,
              factoryPrice: factoryPrice || 0,
              publicSupport: publicSupport || 0,
              storeSupportWithAddon: storeSupport || 0,
              storeSupportNoAddon: 0, // 부가미유치 기준 제거
              imageUrl: image || '',
              requiredAddons: addonsText
            });
          });
        } else {
          // 모든 태그가 체크 해제되었으면 삭제
          await withRetrySupabase(async () => {
            return await DirectStoreDAL.deleteTodaysMobile(modelName, carrier);
          });
        }

        // 직영점_단말마스터도 업데이트
        try {
          await withRetrySupabase(async () => {
            return await DirectStoreDAL.updateDeviceMasterTags(modelId, carrier, {
              isPremium: !!isPremium,
              isBudget: !!isBudget,
              isPopular: !!isPopular,
              isRecommended: !!isRecommended,
              isCheap: !!isCheap
            });
          });
        } catch (masterErr) {
          console.error('[Direct] 직영점_단말마스터 업데이트 실패:', masterErr.message);
        }

        console.log(`✅ [PUT /mobiles/:modelId/tags] Supabase에 태그 업데이트 완료`);
      } else {
        // Google Sheets에 쓰기 (기존 로직)
        console.log(`📝 [PUT /mobiles/:modelId/tags] Google Sheets에 태그 업데이트: ${modelName} (${carrier})`);

        await ensureSheetHeaders(sheets, SPREADSHEET_ID, '직영점_오늘의휴대폰', [
          '모델명', '펫네임', '통신사', '출고가', '이통사지원금', '대리점지원금(부가유치)', '대리점지원금(부가미유치)', '이미지', '필수부가서비스', '인기', '추천', '저렴', '프리미엄', '중저가'
        ]);

        // 직영점_오늘의휴대폰 시트에서 해당 모델 찾기
        const todaysRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '직영점_오늘의휴대폰!A:N' // 수정: A:Z → A:N
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
          // 🔥 수정: 부가미유치 기준 제거 (G 컬럼 제거, 이후 컬럼 인덱스 -1)
          image || existingRow[6] || '',                        // H 이미지 - 인덱스 변경: 7 → 6
          addonsText || existingRow[7] || '',                   // I 필수부가서비스 - 인덱스 변경: 8 → 7
          isPopular ? 'Y' : '',                                 // J 인기 - 인덱스 변경: 9 → 8
          isRecommended ? 'Y' : '',                             // K 추천 - 인덱스 변경: 10 → 9
          isCheap ? 'Y' : '',                                   // L 저렴 - 인덱스 변경: 11 → 10
          isPremium ? 'Y' : '',                                 // M 프리미엄 - 인덱스 변경: 12 → 11
          isBudget ? 'Y' : ''                                   // N 중저가 - 인덱스 변경: 13 → 12
        ];

        // 모든 태그가 체크 해제되었는지 확인
        const hasAnyTag = isPopular || isRecommended || isCheap || isPremium || isBudget;

        if (rowIndex === -1) {
          // 행이 없으면 태그가 있을 때만 추가
          if (hasAnyTag) {
            await sheets.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: '직영점_오늘의휴대폰',
              valueInputOption: 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
              resource: { values: [newRowValues] }
            });
          }
        } else {
          if (hasAnyTag) {
            // 행이 있고 태그가 있으면 전체 컬럼(A:N) 업데이트
            const updateRange = `직영점_오늘의휴대폰!A${rowIndex + 2}:N${rowIndex + 2}`;
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: updateRange,
              valueInputOption: 'USER_ENTERED',
              resource: {
                values: [newRowValues]
              }
            });
          } else {
            // 모든 태그가 체크 해제되었으면 해당 행 삭제
            const sheetId = await getSheetId(sheets, SPREADSHEET_ID, '직영점_오늘의휴대폰');
            if (sheetId !== null) {
              await withRetry(async () => {
                return await sheets.spreadsheets.batchUpdate({
                  spreadsheetId: SPREADSHEET_ID,
                  resource: {
                    requests: [{
                      deleteDimension: {
                        range: {
                          sheetId: sheetId,
                          dimension: 'ROWS',
                          startIndex: rowIndex + 1, // 헤더 다음 행부터 (0-based, 헤더가 0)
                          endIndex: rowIndex + 2 // 삭제할 행까지
                        }
                      }
                    }]
                  }
                });
              });
            }
          }
        }

        // 직영점_단말마스터 시트도 업데이트
        try {
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MOBILE_MASTER, HEADERS_MOBILE_MASTER);
          const masterRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MOBILE_MASTER}!A:R`
          });
          const masterRows = (masterRes.data.values || []).slice(1);

          // 모델명과 통신사로 해당 행 찾기 (정규화된 모델명도 시도)
          const normalizedModelName = normalizeModelCode(modelName);
          let masterRowIndex = masterRows.findIndex(row => {
            const rowModel = (row[2] || '').toString().trim();
            const rowCarrier = (row[0] || '').toString().trim().toUpperCase();
            return rowCarrier === carrier.toUpperCase() && (
              rowModel === modelName ||
              rowModel === normalizedModelName ||
              normalizeModelCode(rowModel) === normalizedModelName
            );
          });

          if (masterRowIndex !== -1) {
            // 기존 행 정보 가져오기
            const existingMasterRow = masterRows[masterRowIndex];

            // 태그 컬럼 업데이트 (7: isPremium, 8: isBudget, 9: isPopular, 10: isRecommended, 11: isCheap)
            const updatedMasterRow = [...existingMasterRow];
            // 행이 18개 컬럼보다 짧으면 확장
            while (updatedMasterRow.length < 18) {
              updatedMasterRow.push('');
            }

            updatedMasterRow[7] = isPremium ? 'Y' : 'N';  // isPremium
            updatedMasterRow[8] = isBudget ? 'Y' : 'N';    // isBudget
            updatedMasterRow[9] = isPopular ? 'Y' : 'N';  // isPopular
            updatedMasterRow[10] = isRecommended ? 'Y' : 'N'; // isRecommended
            updatedMasterRow[11] = isCheap ? 'Y' : 'N';    // isCheap

            // 업데이트
            const masterUpdateRange = `${SHEET_MOBILE_MASTER}!A${masterRowIndex + 2}:R${masterRowIndex + 2}`;
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: masterUpdateRange,
              valueInputOption: 'USER_ENTERED',
              resource: {
                values: [updatedMasterRow]
              }
            });
          } else {
            console.warn(`[Direct] 직영점_단말마스터에서 모델을 찾을 수 없음: ${modelName} (${carrier})`);
          }
        } catch (masterErr) {
          console.error('[Direct] 직영점_단말마스터 업데이트 실패:', masterErr.message);
          // 마스터 업데이트 실패 시 경고만 출력 (직영점_오늘의휴대폰은 이미 업데이트됨)
          // 다음 재빌드 시 동기화될 예정
        }

        console.log(`✅ [PUT /mobiles/:modelId/tags] Google Sheets에 태그 업데이트 완료`);
      } // useDatabase 분기 종료

      // 태그/모바일 캐시 무효화 (모든 버전 및 해시 포함)
      deleteCache('todays-mobiles');
      // 모든 통신사 캐시 무효화 (모든 버전 및 해시 포함)
      for (const c of ['SK', 'KT', 'LG']) {
        // 기본 캐시 키
        deleteCache(`mobiles-${c}`);
        // 캐시 버전별 키 (v5, v6 등)
        deleteCache(`mobiles-${c}-v5`);
        deleteCache(`mobiles-${c}-v6`);
        // 정책표 순서 해시가 포함된 캐시는 정확한 해시를 알 수 없으므로
        // 모든 가능한 패턴을 무효화하기 위해 캐시 스토어를 순회
        // (실제로는 다음 요청 시 새로운 해시로 캐시가 생성되므로 문제 없음)
      }

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
    // 디버그 로그 제거 (성능 최적화)
    // 🔥 브라우저 캐시 방지 (304 응답 방지)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
      const { modelId } = req.params;
      const { planGroup, openingType = '010신규', carrier } = req.query;

      // 디버그 로그 제거 (성능 최적화)

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
      let actualModelIndex = -1;

      // 🔥 핵심 수정: 이통사 시트와 정책표 시트의 모델 행이 다르고 값도 다르기 때문에
      // 정책표 인덱스로 찾지 말고 모델명으로 직접 찾기
      // 1순위: req.query.modelName으로 찾기 (가장 정확)
      // 2순위: 정책표 인덱스로 찾기 (폴백, 참고용)

      const targetModelName = req.query.modelName ? req.query.modelName.trim() : null;

      if (targetModelName) {
        // 1순위: req.query.modelName으로 정확히 일치하는 모델명 찾기
        const targetModelNormalized = normalizeModelCode(targetModelName);

        // 1단계: 정확히 일치하는 모델명 찾기
        for (let i = 0; i < modelData.length; i++) {
          const rowModel = (modelData[i]?.[0] || '').toString().trim();
          if (!rowModel) continue;

          if (rowModel === targetModelName) {
            modelRow = modelData[i];
            actualModelIndex = i;
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
              actualModelIndex = i;
              // 🔥 경고: 정책표 모델명이 요청 모델명과 다름
              if (rowModel !== targetModelName) {
                logWarningOnce(`model-mismatch-${targetModelName}-${rowModel}`, `[Direct] /calculate 정책표 모델명 불일치: 요청=${targetModelName}, 정책표=${rowModel} (정규화 후 일치, 인덱스 ${i} 사용)`);
              }
              break;
            }
          }
        }
      }

      // 2순위: 정책표 인덱스로 찾기 (폴백, 참고용)
      // req.query.modelName으로 찾지 못했을 때만 사용
      if (!modelRow && !isNaN(modelIndex) && modelIndex >= 0 && modelIndex < modelData.length) {
        const policyRow = modelData[modelIndex];
        if (policyRow && policyRow[0]) {
          // 정책표 인덱스로 찾은 모델명이 요청 모델명과 다를 수 있음
          // 하지만 폴백으로 사용
          modelRow = policyRow;
          actualModelIndex = modelIndex;

          // 요청 모델명이 있으면 경고
          if (targetModelName) {
            const policyModel = (policyRow[0] || '').toString().trim();
            const targetNormalized = normalizeModelCode(targetModelName);
            const policyNormalized = normalizeModelCode(policyModel);

            if (targetNormalized !== policyNormalized) {
              logWarningOnce(`model-index-fallback-${targetModelName}-${policyModel}`, `[Direct] /calculate 정책표 인덱스 폴백 사용: 요청=${targetModelName}, 정책표 인덱스 ${modelIndex}의 모델명=${policyModel} (정규화 후 다름, 폴백으로 사용)`);
            }
          }
        }
      }

      if (!modelRow || !modelRow[0]) {
        // 인덱스 범위 초과인 경우 - 경고 로그만 남기고 기본값 반환 (404 대신)
        const isIndexOutOfRange = modelIndex >= modelData.length;
        logWarningOnce(`model-out-of-range-${modelId}`, `[Direct] /calculate 모델 범위 초과 (기본값 반환): ${modelId} (인덱스: ${modelIndex}/${modelData.length})`);

        // 기본값 반환 (에러 대신)
        // 🔥 수정: 부가미유치 기준 제거
        return res.json({
          success: true,
          publicSupport: 0,
          storeSupportWithAddon: 0,
          purchasePriceWithAddon: 0,
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
              // 로그 제거 (성능 최적화)
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
          // 🔥 핵심 수정: 인덱스에 의존하지 않고 모델명으로 직접 찾기
          // 공백 행이 있을 때 인덱스가 밀리고 당겨져서 잘못된 데이터를 가져오는 문제 해결
          const rebateValues = await getSheetData(policySheetId, rebateRange);

          // 모델명으로 직접 찾기 (인덱스 기반 접근 제거)
          const targetModelName = req.query.modelName ? req.query.modelName.trim() : (modelRow[0] || '').toString().trim();
          const targetModelNormalized = normalizeModelCode(targetModelName);
          const policyModel = (modelRow[0] || '').toString().trim();
          const policyModelNormalized = normalizeModelCode(policyModel);

          let rebateIndex = -1;

          // 1단계: 요청 모델명으로 정확히 일치하는 행 찾기
          if (req.query.modelName) {
            for (let i = 0; i < modelData.length && i < rebateValues.length; i++) {
              const rowModel = (modelData[i]?.[0] || '').toString().trim();
              if (!rowModel) continue; // 공백 행 건너뛰기

              if (rowModel === targetModelName) {
                rebateIndex = i;
                break;
              }

              const normalized = normalizeModelCode(rowModel);
              if (normalized && targetModelNormalized && normalized === targetModelNormalized) {
                rebateIndex = i;
                break;
              }
            }
          }

          // 2단계: 요청 모델명으로 찾지 못했으면 정책표 모델명으로 찾기 (폴백)
          if (rebateIndex < 0 && policyModel) {
            for (let i = 0; i < modelData.length && i < rebateValues.length; i++) {
              const rowModel = (modelData[i]?.[0] || '').toString().trim();
              if (!rowModel) continue; // 공백 행 건너뛰기

              if (rowModel === policyModel) {
                rebateIndex = i;
                break;
              }

              const normalized = normalizeModelCode(rowModel);
              if (normalized && policyModelNormalized && normalized === policyModelNormalized) {
                rebateIndex = i;
                break;
              }
            }
          }

          // 3단계: 여전히 찾지 못했으면 actualModelIndex 사용 (최후의 폴백)
          if (rebateIndex < 0 && actualModelIndex >= 0 && actualModelIndex < rebateValues.length) {
            rebateIndex = actualModelIndex;
          }

          if (rebateIndex >= 0) {
            policyRebate = Number(rebateValues[rebateIndex]?.[0] || 0) * 10000; // 만원 단위 변환
          }
        } catch (err) {
          console.warn(`[Direct] ${planGroup} ${openingType} 리베이트 읽기 실패:`, err);
        }
      }

      // 정책설정 가져오기 (캐시 사용)
      const policySettings = await getPolicySettings(carrier);
      const { baseMargin, addonList, insuranceList, specialPolicies } = policySettings;

      // 부가서비스 인센티브/차감 합계 (보험은 모델별로 1개만 선택하므로 여기서는 제외)
      const addonIncentiveSum = addonList.reduce((sum, addon) => sum + (addon.incentive || 0), 0);
      const addonDeductionSum = addonList.reduce((sum, addon) => sum + (addon.deduction || 0), 0);

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

              // 🔥 핵심 수정: supportSheetData와 동일한 로직으로 처리
              // 1단계: 모델별로 모든 개통유형 수집 (supportSheetData와 동일)
              const modelOpeningTypesMap = {}; // { model: [{ openingTypeRaw, openingTypes, rowIndex, supportValue }] }

              for (let j = 0; j < maxRows; j++) {
                const model = (supportModelData[j]?.[0] || '').toString().trim();
                if (!model) continue;

                const openingTypeRaw = (supportOpeningTypeData[j]?.[0] || '').toString().trim();
                const supportValueStr = (supportValues[j]?.[0] || 0).toString().replace(/,/g, '');
                const supportValue = Number(supportValueStr) || 0;
                const openingTypes = parseOpeningTypes(openingTypeRaw);

                if (!modelOpeningTypesMap[model]) {
                  modelOpeningTypesMap[model] = [];
                }

                modelOpeningTypesMap[model].push({
                  openingTypeRaw,
                  openingTypes,
                  rowIndex: j,
                  supportValue
                });
              }

              // 2단계: 전유형 처리 후 저장 (supportSheetData와 동일)
              for (const [model, entries] of Object.entries(modelOpeningTypesMap)) {
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

                const normalizedModel = normalizeModelCode(model);
                const hyphenVariants = generateHyphenVariants(model);

                for (const entryData of entries) {
                  const { openingTypeRaw, openingTypes, rowIndex, supportValue } = entryData;

                  // 전유형이고 무시해야 하면 스킵
                  if (shouldIgnoreAllTypes && (openingTypeRaw === '전유형' || openingTypes.includes('전유형'))) {
                    continue;
                  }

                  const isAllType = openingTypeRaw === '전유형' || openingTypes.includes('전유형');

                  // 전유형인 경우 모든 개통유형에 매핑 (기존 값이 있으면 덮어쓰지 않음)
                  if (isAllType) {
                    const allTypes = ['010신규', 'MNP', '기변', '번호이동'];
                    allTypes.forEach(ot => {
                      const key = `${model}|${ot}`;
                      // 개별 유형이 이미 있으면 전유형 값으로 덮어쓰지 않음
                      if (!supportMap[key]) {
                        supportMap[key] = supportValue;
                        // 대소문자 변형
                        supportMap[`${model.toLowerCase()}|${ot}`] = supportValue;
                        supportMap[`${model.toUpperCase()}|${ot}`] = supportValue;
                        // 정규화된 모델명
                        if (normalizedModel) {
                          supportMap[`${normalizedModel}|${ot}`] = supportValue;
                          supportMap[`${normalizedModel.toLowerCase()}|${ot}`] = supportValue;
                          supportMap[`${normalizedModel.toUpperCase()}|${ot}`] = supportValue;
                        }
                        // 하이픈 변형
                        hyphenVariants.forEach(variant => {
                          if (variant !== model) {
                            const variantKey = `${variant}|${ot}`;
                            if (!supportMap[variantKey]) {
                              supportMap[variantKey] = supportValue;
                            }
                            supportMap[`${variant.toLowerCase()}|${ot}`] = supportValue;
                            supportMap[`${variant.toUpperCase()}|${ot}`] = supportValue;
                          }
                        });
                      }
                    });
                  } else {
                    // 🔥 핵심 수정: "번호이동" 행은 "번호이동" 키에만 설정 (supportSheetData와 동일)
                    if (openingTypeRaw === '번호이동') {
                      const 번호이동Key = `${model}|번호이동`;
                      if (!supportMap[번호이동Key]) {
                        supportMap[번호이동Key] = supportValue;
                        // 대소문자 변형
                        supportMap[`${model.toLowerCase()}|번호이동`] = supportValue;
                        supportMap[`${model.toUpperCase()}|번호이동`] = supportValue;
                        // 정규화된 모델명
                        if (normalizedModel) {
                          supportMap[`${normalizedModel}|번호이동`] = supportValue;
                          supportMap[`${normalizedModel.toLowerCase()}|번호이동`] = supportValue;
                          supportMap[`${normalizedModel.toUpperCase()}|번호이동`] = supportValue;
                        }
                        // 하이픈 변형
                        hyphenVariants.forEach(variant => {
                          if (variant !== model) {
                            const variantKey = `${variant}|번호이동`;
                            if (!supportMap[variantKey]) {
                              supportMap[variantKey] = supportValue;
                            }
                            supportMap[`${variant.toLowerCase()}|번호이동`] = supportValue;
                            supportMap[`${variant.toUpperCase()}|번호이동`] = supportValue;
                          }
                        });
                      }
                    } else {
                      // 🔥 핵심 수정: "010신규/기변" 행은 "010신규", "기변", "010신규/기변" 모두에 매핑
                      // 하지만 개별 유형("010신규" 또는 "기변") 행은 자신의 키에만 설정
                      if (openingTypeRaw.includes('010신규/기변') ||
                        (openingTypes.includes('010신규') && openingTypes.includes('기변'))) {
                        // "010신규/기변" 행이면 "010신규", "기변", "010신규/기변" 모두에 매핑
                        ['010신규', '기변', '010신규/기변'].forEach(ot => {
                          const key = `${model}|${ot}`;
                          // 🔥 핵심 수정: 기존 값이 있으면 덮어쓰지 않음 (개별 유형 우선)
                          if (!supportMap[key]) {
                            supportMap[key] = supportValue;
                            // 대소문자 변형
                            supportMap[`${model.toLowerCase()}|${ot}`] = supportValue;
                            supportMap[`${model.toUpperCase()}|${ot}`] = supportValue;
                            // 정규화된 모델명
                            if (normalizedModel) {
                              supportMap[`${normalizedModel}|${ot}`] = supportValue;
                              supportMap[`${normalizedModel.toLowerCase()}|${ot}`] = supportValue;
                              supportMap[`${normalizedModel.toUpperCase()}|${ot}`] = supportValue;
                            }
                            // 하이픈 변형
                            hyphenVariants.forEach(variant => {
                              if (variant !== model) {
                                const variantKey = `${variant}|${ot}`;
                                if (!supportMap[variantKey]) {
                                  supportMap[variantKey] = supportValue;
                                }
                                supportMap[`${variant.toLowerCase()}|${ot}`] = supportValue;
                                supportMap[`${variant.toUpperCase()}|${ot}`] = supportValue;
                              }
                            });
                          }
                        });
                      } else {
                        // 개별 유형("010신규" 또는 "기변")은 자신의 키에만 설정
                        openingTypes.forEach(ot => {
                          const key = `${model}|${ot}`;
                          // 🔥 핵심 수정: 기존 값이 있으면 덮어쓰지 않음 (정확한 키 우선)
                          if (!supportMap[key]) {
                            supportMap[key] = supportValue;
                            // 대소문자 변형
                            supportMap[`${model.toLowerCase()}|${ot}`] = supportValue;
                            supportMap[`${model.toUpperCase()}|${ot}`] = supportValue;
                            // 정규화된 모델명
                            if (normalizedModel) {
                              supportMap[`${normalizedModel}|${ot}`] = supportValue;
                              supportMap[`${normalizedModel.toLowerCase()}|${ot}`] = supportValue;
                              supportMap[`${normalizedModel.toUpperCase()}|${ot}`] = supportValue;
                            }
                            // 하이픈 변형
                            hyphenVariants.forEach(variant => {
                              if (variant !== model) {
                                const variantKey = `${variant}|${ot}`;
                                if (!supportMap[variantKey]) {
                                  supportMap[variantKey] = supportValue;
                                }
                                supportMap[`${variant.toLowerCase()}|${ot}`] = supportValue;
                                supportMap[`${variant.toUpperCase()}|${ot}`] = supportValue;
                              }
                            });
                          }
                        });
                      }
                    }
                  }
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

          // 디버그 로그 제거 (성능 최적화)

          // 🔥 핵심 수정: 키 우선순위 명확화
          // 1순위: 정확한 키 (예: MNP 요청 → MNP 키, 기변 요청 → 기변 키)
          // 2순위: 폴백 키 (예: MNP 요청 → 번호이동 키, 기변 요청 → 010신규/기변 키)
          const supportKeys = [];

          // 1순위: 정확한 키 (항상 먼저 시도)
          supportKeys.push(
            `${primaryModel}|${openingType}`,
            `${primaryModel.toLowerCase()}|${openingType}`,
            `${primaryModel.toUpperCase()}|${openingType}`
          );

          // 2순위: 폴백 키 (정확한 키가 없을 때만 사용)
          // MNP 요청 시 "번호이동" 키도 찾기
          if (openingType === 'MNP') {
            supportKeys.push(
              `${primaryModel}|번호이동`,
              `${primaryModel.toLowerCase()}|번호이동`,
              `${primaryModel.toUpperCase()}|번호이동`
            );
          }

          // 번호이동 요청 시 "MNP" 키도 찾기
          if (openingType === '번호이동') {
            supportKeys.push(
              `${primaryModel}|MNP`,
              `${primaryModel.toLowerCase()}|MNP`,
              `${primaryModel.toUpperCase()}|MNP`
            );
          }

          // 기변 요청 시 "010신규/기변" 키도 찾기 (하지만 "기변" 키가 우선)
          if (openingType === '기변') {
            supportKeys.push(
              `${primaryModel}|010신규/기변`,
              `${primaryModel.toLowerCase()}|010신규/기변`,
              `${primaryModel.toUpperCase()}|010신규/기변`
            );
          }

          // 010신규 요청 시 "010신규/기변" 키도 찾기 (하지만 "010신규" 키가 우선)
          if (openingType === '010신규') {
            supportKeys.push(
              `${primaryModel}|010신규/기변`,
              `${primaryModel.toLowerCase()}|010신규/기변`,
              `${primaryModel.toUpperCase()}|010신규/기변`
            );
          }

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

          // 🔥 핵심 수정: "번호이동" → MNP 매핑 제거
          // 문제: 상호 매핑으로 인해 값이 섞이는 문제 발생
          // 해결: 정확한 키만 사용 (MNP 요청 시 MNP 키만, 번호이동 요청 시 번호이동 키만)
          // if (openingType === 'MNP') {
          //   supportKeys.push(...);
          // }

          // 🔥 핵심 수정: "010신규/기변" 매핑은 위에서 이미 처리됨 (중복 제거)
          // 기변 요청 시 "010신규/기변" 키는 위에서 이미 추가됨
          // 010신규 요청 시 "010신규/기변" 키는 위에서 이미 추가됨

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

          // 디버그 로그 제거 (성능 최적화)

          if (foundKey) {
            publicSupport = foundValue;
            // 디버그 로그 제거 (성능 최적화)
          } else {
            // 디버그 로그 제거 (성능 최적화)
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
                  // 로그 제거 (성능 최적화)
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
                // 로그 제거 (성능 최적화)
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
              // 🔥 핵심 수정: 정확한 openingType 키를 먼저 찾도록 순서 조정
              const supportKeys = [];

              // 1단계: 정확한 openingType 키를 최우선으로 추가
              supportKeys.push(
                `${policyModel}|${openingType}`,
                `${policyModel.toLowerCase()}|${openingType}`,
                `${policyModel.toUpperCase()}|${openingType}`
              );

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

              // 2단계: openingType별 대체 키 추가 (정확한 키를 찾지 못한 경우에만 사용)
              // "번호이동" → MNP 매핑 (MNP일 때만)
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

              // "010신규/기변" 매핑 (010신규나 기변일 때만, MNP가 아닐 때만)
              if ((openingType === '010신규' || openingType === '기변') && openingType !== 'MNP') {
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

      // 보험상품: 출고가 및 모델명(플립/폴드 여부)에 맞는 보험 인센티브/차감 선택
      const insuranceListForCalc = insuranceList || [];
      const modelNameForCheck = (modelName || '').toString();
      const lowerModelName = modelNameForCheck.toLowerCase();
      const flipFoldKeywords = ['플립', '폴드', 'flip', 'fold'];
      const isFlipFoldModel = flipFoldKeywords.some(keyword =>
        lowerModelName.includes(keyword.toLowerCase())
      );

      const flipFoldInsurances = insuranceListForCalc.filter(item => {
        const name = (item.name || '').toString().toLowerCase();
        return flipFoldKeywords.some(keyword =>
          name.includes(keyword.toLowerCase())
        );
      });

      const normalInsurances = insuranceListForCalc.filter(item => !flipFoldInsurances.includes(item));

      let selectedInsurance = null;

      if (carrier === 'LG' && isFlipFoldModel && flipFoldInsurances.length > 0) {
        // LG + 플립/폴드 단말 → 플립/폴드 전용 보험상품 우선 적용
        selectedInsurance = flipFoldInsurances.find(insurance => {
          const minPrice = insurance.minPrice || 0;
          const maxPrice = insurance.maxPrice || 9999999;
          return factoryPrice >= minPrice && factoryPrice <= maxPrice;
        }) || flipFoldInsurances[0];
      } else {
        // 그 외 모델 → 플립/폴드 전용 상품 제외 후 출고가 구간으로 매칭
        const baseList = normalInsurances.length > 0 ? normalInsurances : insuranceListForCalc;
        selectedInsurance = baseList.find(insurance => {
          const minPrice = insurance.minPrice || 0;
          const maxPrice = insurance.maxPrice || 9999999;
          return factoryPrice >= minPrice && factoryPrice <= maxPrice;
        });
      }

      const insuranceIncentive = selectedInsurance?.incentive || 0;
      const insuranceDeduction = selectedInsurance?.deduction || 0;

      const totalAddonIncentive = addonIncentiveSum + insuranceIncentive;
      const totalAddonDeduction = addonDeductionSum + insuranceDeduction;

      // 대리점지원금 계산
      const storeSupportWithAddon = Math.max(0,
        policyRebate - baseMargin + totalAddonIncentive + totalSpecialAddition
      );
      // 🔥 수정: 부가미유치 기준 제거 (부가서비스 선택/삭제 시 동적 계산으로 대체)

      // 구매가 계산
      const purchasePriceWithAddon = Math.max(0, factoryPrice - publicSupport - storeSupportWithAddon);
      // 🔥 수정: 부가미유치 기준 제거 (purchasePriceWithoutAddon 계산 제거)

      // 디버그 로그 제거 (성능 최적화)

      res.json({
        success: true,
        storeSupportWithAddon,
        purchasePriceWithAddon,
        policyRebate,
        publicSupport
      });
    } catch (error) {
      // 디버그 로그 제거 (성능 최적화)
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

      // DirectStoreDAL 사용 (간소화된 헬퍼) - withRetrySupabase 적용
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      const rows = await withRetrySupabase(async () => {
        return await DirectStoreDAL.getMainPageTexts();
      });

      // 데이터 파싱
      const texts = {
        mainHeader: null,
        transitionPages: {}
      };

      rows.forEach(row => {
        if (row.type === 'mainHeader') {
          texts.mainHeader = {
            content: row.content,
            imageUrl: row.imageUrl,
            updatedAt: row.updatedAt
          };
        } else if (row.type === 'transitionPage' && row.carrier && row.category) {
          if (!texts.transitionPages[row.carrier]) {
            texts.transitionPages[row.carrier] = {};
          }
          texts.transitionPages[row.carrier][row.category] = {
            content: row.content,
            imageUrl: row.imageUrl,
            updatedAt: row.updatedAt
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

      const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

      if (USE_DB) {
        try {
          const DirectStoreDAL = require('./dal/DirectStoreDAL');
          await DirectStoreDAL.updateMainPageText(
            textType === 'mainHeader' ? '' : carrier,
            textType === 'mainHeader' ? '' : category,
            textType,
            { content, imageUrl }
          );

          // 캐시 무효화
          deleteCache('main-page-texts');

          return res.json({ success: true, message: '문구가 저장되었습니다.' });
        } catch (err) {
          console.error('[Direct] Supabase 실패, Google Sheets로 폴백:', err.message);
          // 폴백: Google Sheets
        }
      }

      // Google Sheets 로직 (기존)
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

  // DELETE /api/direct/main-page-text/:carrier: 메인페이지 문구 삭제
  router.delete('/main-page-text/:carrier', async (req, res) => {
    try {
      const { carrier } = req.params;

      const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

      if (USE_DB) {
        try {
          const DirectStoreDAL = require('./dal/DirectStoreDAL');
          await DirectStoreDAL.deleteMainPageText(carrier);

          // 캐시 무효화
          deleteCache('main-page-texts');

          return res.json({ success: true, message: '문구가 삭제되었습니다.' });
        } catch (err) {
          console.error('[Direct] Supabase 실패, Google Sheets로 폴백:', err.message);
          // 폴백: Google Sheets
        }
      }

      // Google Sheets 로직 (기존)
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 기존 데이터 조회
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_MAIN_PAGE_TEXTS}!A:F`
      });

      const rows = (response.data.values || []).slice(1);

      // 삭제할 행 찾기 (통신사가 일치하는 모든 행)
      const rowsToDelete = [];
      rows.forEach((row, index) => {
        if ((row[0] || '').trim() === carrier) {
          rowsToDelete.push(index + 2); // +2는 헤더 행과 0-based index 보정
        }
      });

      if (rowsToDelete.length === 0) {
        return res.json({ success: true, message: '삭제할 문구가 없습니다.' });
      }

      // 역순으로 삭제 (인덱스 변경 방지)
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_MAIN_PAGE_TEXTS),
                  dimension: 'ROWS',
                  startIndex: rowsToDelete[i] - 1,
                  endIndex: rowsToDelete[i]
                }
              }
            }]
          }
        });
      }

      // 캐시 무효화
      deleteCache('main-page-texts');

      res.json({ success: true, message: '문구가 삭제되었습니다.' });
    } catch (error) {
      console.error('[Direct] main-page-text DELETE error:', error);
      res.status(500).json({ success: false, error: '문구 삭제 실패', message: error.message });
    }
  });

  // === 매장별 슬라이드쇼 설정 관리 API ===

  // GET /api/direct/store-slideshow-settings?storeId=xxx: 매장별 슬라이드쇼 설정 조회 (캐싱 및 중복 요청 방지 적용)
  // GET /api/direct/store-slideshow-settings?storeId=xxx: 매장별 슬라이드쇼 설정 조회 (캐싱 및 중복 요청 방지 적용)
  router.get('/store-slideshow-settings', async (req, res) => {
    try {
      const storeId = req.query.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: '매장ID가 필요합니다.' });
      }

      // 캐시 키 생성
      const cacheKey = `store-settings-all`;
      const CACHE_TTL = 60 * 1000; // 1분 캐싱

      let allSettings = [];
      try {
        // 중복 요청 방지 및 캐싱 적용
        allSettings = await withRequestDeduplication(cacheKey, async () => {
          // 1. 캐시 확인
          const cached = cacheManager.get(cacheKey);
          if (cached) return cached;

          const { sheets, SPREADSHEET_ID } = createSheetsClient();

          // 2. 시트 헤더 확인
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

          // 3. 데이터 조회 (Retry 적용)
          const response = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_SETTINGS}!A:E`
            });
          });

          // 데이터 안전성 검사
          const rows = (response.data && response.data.values) ? response.data.values.slice(1) : [];

          // 캐시 저장
          cacheManager.set(cacheKey, rows, CACHE_TTL);
          return rows;
        });
      } catch (innerError) {
        console.error('[Direct] store-slideshow-settings data fetch error:', innerError);
        // 데이터 조회 실패 시에는 빈 배열로 처리 (500 에러 방지)
        return res.status(500).json({ success: false, error: '설정 데이터 조회 실패', message: innerError.message });
      }

      if (!allSettings || !Array.isArray(allSettings)) {
        return res.json({ success: true, data: null });
      }

      // 매장별 슬라이드쇼 설정 찾기
      const storeSetting = allSettings.find(row => {
        if (!row || row.length < 5) return false; // 행 데이터 유효성 검사

        const settingType = (row[1] || '').trim();
        const settingJson = (row[4] || '').trim();

        if (settingType === 'slideshowSettings') {
          try {
            const parsed = JSON.parse(settingJson);
            // storeId 비교 (문자열 변환 후 비교)
            return String(parsed.storeId) === String(storeId);
          } catch {
            return false;
          }
        }
        return false;
      });

      if (storeSetting) {
        try {
          const settings = JSON.parse(storeSetting[4] || '{}');
          return res.json({ success: true, data: settings });
        } catch (parseError) {
          console.error('[Direct] store-slideshow-settings JSON parse error:', parseError);
          return res.json({ success: true, data: null });
        }
      }

      return res.json({ success: true, data: null });
    } catch (error) {
      console.error('[Direct] store-slideshow-settings GET error:', error);
      res.status(500).json({ success: false, error: '설정 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/store-slideshow-settings: 매장별 슬라이드쇼 설정 저장
  router.post('/store-slideshow-settings', async (req, res) => {
    try {
      const { storeId, slideSettings, mainHeaderText, transitionPageTexts } = req.body;

      if (!storeId) {
        return res.status(400).json({ success: false, error: '매장ID가 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 시트 헤더 확인 및 생성
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

      // 기존 설정 조회
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_SETTINGS}!A:E`
      });

      const rows = (response.data.values || []).slice(1);

      // 저장할 설정 객체 구성
      const settingsData = {
        storeId,
        slideSettings: slideSettings || {},
        mainHeaderText: mainHeaderText || null,
        transitionPageTexts: transitionPageTexts || {},
        updatedAt: new Date().toISOString()
      };

      // 기존 행 찾기
      let existingRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const settingType = (rows[i][1] || '').trim();
        const settingJson = (rows[i][4] || '').trim();
        if (settingType === 'slideshowSettings') {
          try {
            const parsed = JSON.parse(settingJson);
            if (parsed.storeId === storeId) {
              existingRowIndex = i;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      const newRow = [
        '', // 통신사 (슬라이드쇼 설정은 통신사 무관)
        'slideshowSettings',
        '', // 시트ID
        '', // 시트URL
        JSON.stringify(settingsData)
      ];

      if (existingRowIndex !== -1) {
        // 기존 행 업데이트
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      } else {
        // 새 행 추가
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_SETTINGS}!A:E`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [newRow] }
        });
      }

      res.json({ success: true, message: '슬라이드쇼 설정이 저장되었습니다.' });
    } catch (error) {
      console.error('[Direct] store-slideshow-settings POST error:', error);
      res.status(500).json({ success: false, error: '설정 저장 실패', message: error.message });
    }
  });

  // GET /api/direct/store-main-page-texts?storeId=xxx: 매장별 메인페이지 문구 조회 (기본값 우선순위 처리)
  router.get('/store-main-page-texts', async (req, res) => {
    try {
      const storeId = req.query.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: '매장ID가 필요합니다.' });
      }

      // 🔥 캐싱 추가: storeId별로 캐싱
      const cacheKey = `store-main-page-texts-${storeId}`;
      const cached = getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 1. 매장별 설정 조회 (withRetry 사용)
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
      const settingsResponse = await withRetry(async () =>
        await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_SETTINGS}!A:E`
        })
      );
      const settingsRows = (settingsResponse.data.values || []).slice(1);

      let storeMainPageTexts = null;
      const storeSetting = settingsRows.find(row => {
        const settingType = (row[1] || '').trim();
        const settingJson = (row[4] || '').trim();
        if (settingType === 'slideshowSettings') {
          try {
            const parsed = JSON.parse(settingJson);
            return parsed.storeId === storeId;
          } catch {
            return false;
          }
        }
        return false;
      });

      if (storeSetting) {
        try {
          const settings = JSON.parse(storeSetting[4] || '{}');
          storeMainPageTexts = {
            mainHeaderText: settings.mainHeaderText,
            transitionPageTexts: settings.transitionPageTexts || {}
          };
        } catch {
          // JSON 파싱 실패 시 무시
        }
      }

      // 2. 통신사별 기본값 조회 (별도 캐싱으로 재사용)
      const defaultTextsCacheKey = 'store-main-page-texts-defaults';
      let defaultTexts = getCache(defaultTextsCacheKey);

      if (!defaultTexts) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_MAIN_PAGE_TEXTS, HEADERS_MAIN_PAGE_TEXTS);
        const mainPageResponse = await withRetry(async () =>
          await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_MAIN_PAGE_TEXTS}!A:F`
          })
        );
        const mainPageRows = (mainPageResponse.data.values || []).slice(1);

        defaultTexts = {
          mainHeader: null,
          transitionPages: {}
        };

        mainPageRows.forEach(row => {
          const carrier = (row[0] || '').trim();
          const category = (row[1] || '').trim();
          const textType = (row[2] || '').trim();
          const content = (row[3] || '').trim();
          const imageUrl = (row[4] || '').trim();
          const updatedAt = (row[5] || '').trim();

          if (textType === 'mainHeader') {
            defaultTexts.mainHeader = {
              content,
              imageUrl,
              updatedAt
            };
          } else if (textType === 'transitionPage' && carrier && category) {
            if (!defaultTexts.transitionPages[carrier]) {
              defaultTexts.transitionPages[carrier] = {};
            }
            defaultTexts.transitionPages[carrier][category] = {
              content,
              imageUrl,
              updatedAt
            };
          }
        });

        // 기본값 캐싱 (5분)
        setCache(defaultTextsCacheKey, defaultTexts, 5 * 60 * 1000);
      }

      // 3. 매장별 설정이 있으면 우선 사용, 없으면 기본값 사용
      const result = {
        mainHeader: storeMainPageTexts?.mainHeaderText
          ? { content: storeMainPageTexts.mainHeaderText, imageUrl: '', updatedAt: '' }
          : defaultTexts.mainHeader,
        transitionPages: {}
      };

      // 통신사별 연결페이지 텍스트 병합 (매장별 설정 우선)
      const carriers = ['SK', 'KT', 'LG'];
      const categories = ['budget', 'premium'];

      carriers.forEach(carrier => {
        result.transitionPages[carrier] = {};
        categories.forEach(category => {
          // 매장별 설정에서 가져온 값 (문자열)
          const storeText = storeMainPageTexts?.transitionPageTexts?.[carrier]?.[category];
          // 기본값에서 가져온 값 (객체: { content, imageUrl, updatedAt })
          const defaultText = defaultTexts.transitionPages[carrier]?.[category];

          // 매장별 설정이 있으면 우선 사용 (문자열을 객체로 변환)
          // 없으면 기본값 사용
          result.transitionPages[carrier][category] = storeText
            ? { content: storeText, imageUrl: '', updatedAt: '' }
            : (defaultText || null);
        });
      });

      const payload = { success: true, data: result };
      // 🔥 캐싱 저장 (5분)
      setCache(cacheKey, payload, 5 * 60 * 1000);
      res.json(payload);
    } catch (error) {
      console.error('[Direct] store-main-page-texts GET error:', error);
      res.status(500).json({ success: false, error: '문구 조회 실패', message: error.message });
    }
  });

  // === 대중교통 위치 관리 API ===

  /**
   * 카카오 API를 사용한 주소 → 위도/경도 변환
   */
  async function geocodeAddressWithKakao(address, retryCount = 0) {
    const apiKey = process.env.KAKAO_API_KEY;
    if (!apiKey) {
      throw new Error('KAKAO_API_KEY 환경변수가 설정되어 있지 않습니다.');
    }

    const cleanAddress = address.toString().trim();
    if (!cleanAddress) {
      return null;
    }

    let processedAddress = cleanAddress;
    if (!cleanAddress.includes('시') && !cleanAddress.includes('구') && !cleanAddress.includes('군')) {
      processedAddress = `경기도 ${cleanAddress}`;
    }

    const encodedAddress = encodeURIComponent(processedAddress);
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodedAddress}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `KakaoAK ${apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          if (retryCount < 2) {
            return await geocodeAddressWithKakao(address, retryCount + 1);
          }
        }
        throw new Error(`Kakao geocoding API 오류: ${response.status}`);
      }

      const data = await response.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        return {
          latitude: parseFloat(doc.y),
          longitude: parseFloat(doc.x)
        };
      }
      return null;
    } catch (error) {
      if (retryCount < 2 && (error.message.includes('fetch') || error.message.includes('timeout'))) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return await geocodeAddressWithKakao(address, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * 고유 ID 생성 (타임스탬프 + 랜덤)
   */
  function generateTransitLocationId() {
    return `TL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // GET /api/direct/transit-location/all: 모든 대중교통 위치 조회
  router.get('/transit-location/all', async (req, res) => {
    try {
      const cacheKey = 'transit-location-all';

      // 캐시 확인
      const cached = getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // DirectStoreDAL 사용 (간소화된 헬퍼) - withRetrySupabase 적용
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      const locations = await withRetrySupabase(async () => {
        return await DirectStoreDAL.getAllTransitLocations();
      });

      // 응답 형식 변환
      const formattedLocations = locations.map(loc => ({
        id: loc.id,
        type: loc.type,
        name: loc.name,
        address: loc.address,
        lat: loc.latitude,
        lng: loc.longitude,
        updatedAt: loc.updatedAt
      }));

      const payload = { success: true, data: formattedLocations };
      setCache(cacheKey, payload, 5 * 60 * 1000); // 5분 캐시
      res.json(payload);
    } catch (error) {
      console.error('[Direct] transit-location/all GET error:', error);
      res.status(500).json({ success: false, error: '대중교통 위치 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/transit-location/create: 대중교통 위치 생성
  router.post('/transit-location/create', async (req, res) => {
    try {
      const { type, name, address } = req.body;

      if (!type || !name || !address) {
        return res.status(400).json({ success: false, error: '타입, 이름, 주소가 필요합니다.' });
      }

      if (type !== '버스터미널' && type !== '지하철역') {
        return res.status(400).json({ success: false, error: '타입은 "버스터미널" 또는 "지하철역"이어야 합니다.' });
      }

      // 주소 → 위도/경도 변환
      const coords = await geocodeAddressWithKakao(address);
      if (!coords) {
        return res.status(400).json({ success: false, error: '주소를 찾을 수 없습니다.' });
      }

      // 고유 ID 생성
      const id = generateTransitLocationId();

      // DirectStoreDAL 사용 - withRetrySupabase 적용
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      await withRetrySupabase(async () => {
        return await DirectStoreDAL.createTransitLocation({
          id,
          type,
          name,
          address,
          latitude: coords.latitude,
          longitude: coords.longitude
        });
      });

      // 캐시 무효화
      deleteCache('transit-location-all');
      deleteCache('transit-location-list');

      res.json({
        success: true,
        data: {
          id,
          type,
          name,
          address,
          lat: coords.latitude,
          lng: coords.longitude,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[Direct] transit-location/create POST error:', error);
      res.status(500).json({ success: false, error: '대중교통 위치 생성 실패', message: error.message });
    }
  });

  // PUT /api/direct/transit-location/:id: 대중교통 위치 수정
  router.put('/transit-location/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { type, name, address } = req.body;

      if (!type || !name || !address) {
        return res.status(400).json({ success: false, error: '타입, 이름, 주소가 필요합니다.' });
      }

      if (type !== '버스터미널' && type !== '지하철역') {
        return res.status(400).json({ success: false, error: '타입은 "버스터미널" 또는 "지하철역"이어야 합니다.' });
      }

      // 주소 → 위도/경도 변환
      const coords = await geocodeAddressWithKakao(address);
      if (!coords) {
        return res.status(400).json({ success: false, error: '주소를 찾을 수 없습니다.' });
      }

      // DirectStoreDAL 사용 - withRetrySupabase 적용
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      await withRetrySupabase(async () => {
        return await DirectStoreDAL.updateTransitLocation(id, {
          type,
          name,
          address,
          latitude: coords.latitude,
          longitude: coords.longitude
        });
      });

      // 캐시 무효화
      deleteCache('transit-location-all');
      deleteCache('transit-location-list');

      res.json({
        success: true,
        data: {
          id,
          type,
          name,
          address,
          lat: coords.latitude,
          lng: coords.longitude,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[Direct] transit-location/:id PUT error:', error);
      res.status(500).json({ success: false, error: '대중교통 위치 수정 실패', message: error.message });
    }
  });

  // DELETE /api/direct/transit-location/:id: 대중교통 위치 삭제
  router.delete('/transit-location/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // DirectStoreDAL 사용 - withRetrySupabase 적용
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      await withRetrySupabase(async () => {
        return await DirectStoreDAL.deleteTransitLocation(id);
      });

      // 캐시 무효화
      deleteCache('transit-location-all');
      deleteCache('transit-location-list');

      res.json({ success: true, message: '대중교통 위치가 삭제되었습니다.' });
    } catch (error) {
      console.error('[Direct] transit-location/:id DELETE error:', error);
      res.status(500).json({ success: false, error: '대중교통 위치 삭제 실패', message: error.message });
    }
  });

  // GET /api/direct/transit-location/list: 매장별 대중교통 위치 조회
  router.get('/transit-location/list', async (req, res) => {
    try {
      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 읽기
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에서 읽기 (DirectStoreDAL 사용)
        console.log(`📖 [GET /api/direct/transit-location/list] Supabase에서 데이터 읽기 시작`);

        try {
          const DirectStoreDAL = require('./dal/DirectStoreDAL');

          // 모든 대중교통 위치 조회 - withRetrySupabase 적용
          const allLocations = await withRetrySupabase(async () => {
            return await DirectStoreDAL.getAllTransitLocations();
          });

          if (allLocations && allLocations.length > 0) {
            const locationMap = new Map();
            allLocations.forEach(loc => {
              locationMap.set(loc.id, {
                id: loc.id,
                type: loc.type,
                name: loc.name,
                address: loc.address,
                lat: loc.latitude,
                lng: loc.longitude,
                updatedAt: loc.updatedAt
              });
            });

            // 모든 매장의 대중교통 위치 조회 - withRetrySupabase 적용
            const storePhotos = await withRetrySupabase(async () => {
              return await DirectStoreDAL.dal.read('direct_store_photos');
            });

            const storeTransitData = [];

            for (const row of storePhotos) {
              const storeName = row['업체명'];
              if (!storeName) continue;

              let busTerminalIds = [];
              let subwayStationIds = [];

              try {
                busTerminalIds = row['버스터미널ID목록'] ? JSON.parse(row['버스터미널ID목록']) : [];
              } catch (e) {
                console.warn(`[Direct] 버스터미널ID목록 JSON 파싱 실패 (${storeName}):`, e);
              }

              try {
                subwayStationIds = row['지하철역ID목록'] ? JSON.parse(row['지하철역ID목록']) : [];
              } catch (e) {
                console.warn(`[Direct] 지하철역ID목록 JSON 파싱 실패 (${storeName}):`, e);
              }

              const busTerminals = busTerminalIds
                .map(id => locationMap.get(id))
                .filter(Boolean);
              const subwayStations = subwayStationIds
                .map(id => locationMap.get(id))
                .filter(Boolean);

              if (busTerminals.length > 0 || subwayStations.length > 0) {
                storeTransitData.push({
                  storeName,
                  busTerminals,
                  subwayStations
                });
              }
            }

            console.log(`✅ [GET /api/direct/transit-location/list] Supabase에서 데이터 읽기 완료 (${storeTransitData.length}개 매장)`);

            // 데이터가 있으면 바로 반환
            if (storeTransitData.length > 0) {
              return res.json({ success: true, data: storeTransitData });
            } else {
              console.warn(`⚠️ [GET /api/direct/transit-location/list] Supabase 데이터가 비어있어 Google Sheets로 폴백합니다.`);
            }
          } else {
            console.warn(`⚠️ [GET /api/direct/transit-location/list] Supabase 대중교통 위치 데이터가 없어 Google Sheets로 폴백합니다.`);
          }

        } catch (dbError) {
          console.error(`🚨 [GET /api/direct/transit-location/list] Supabase 조회 중 에러 발생, Google Sheets로 폴백:`, dbError);
        }
        // 여기로 내려오면 Google Sheets 로직 실행
      }

      // Google Sheets에서 읽기 (기존 로직)
      console.log(`📖 [GET /api/direct/transit-location/list] Google Sheets에서 데이터 읽기 시작`);

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const cacheKey = 'transit-location-list';

      // 캐시 확인
      const cached = getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // 직영점_매장사진 시트에서 데이터 조회
      const HEADERS_STORE_PHOTO = [
        '업체명', '전면사진URL', '전면사진Discord메시지ID', '전면사진Discord포스트ID', '전면사진Discord스레드ID',
        '내부사진URL', '내부사진Discord메시지ID', '내부사진Discord포스트ID', '내부사진Discord스레드ID',
        '외부사진URL', '외부사진Discord메시지ID', '외부사진Discord포스트ID', '외부사진Discord스레드ID',
        '외부2사진URL', '외부2사진Discord메시지ID', '외부2사진Discord포스트ID', '외부2사진Discord스레드ID',
        '점장사진URL', '점장사진Discord메시지ID', '점장사진Discord포스트ID', '점장사진Discord스레드ID',
        '직원1사진URL', '직원1사진Discord메시지ID', '직원1사진Discord포스트ID', '직원1사진Discord스레드ID',
        '직원2사진URL', '직원2사진Discord메시지ID', '직원2사진Discord포스트ID', '직원2사진Discord스레드ID',
        '직원3사진URL', '직원3사진Discord메시지ID', '직원3사진Discord포스트ID', '직원3사진Discord스레드ID',
        '수정일시', '버스터미널ID목록', '지하철역ID목록'
      ];

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_STORE_PHOTO, HEADERS_STORE_PHOTO);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_STORE_PHOTO}!A:AJ`
        });
      });

      const rows = (response.data.values || []).slice(1);
      const storeTransitData = [];

      // 모든 대중교통 위치 조회
      const allLocationsResponse = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_TRANSIT_LOCATION}!A:G`
        });
      });

      const allLocationRows = (allLocationsResponse.data.values || []).slice(1);
      const locationMap = new Map();
      allLocationRows.forEach(row => {
        const id = (row[0] || '').trim();
        if (id) {
          locationMap.set(id, {
            id,
            type: (row[1] || '').trim(),
            name: (row[2] || '').trim(),
            address: (row[3] || '').trim(),
            lat: row[4] ? parseFloat(row[4]) : null,
            lng: row[5] ? parseFloat(row[5]) : null,
            updatedAt: (row[6] || '').trim()
          });
        }
      });

      // 매장별 데이터 파싱
      rows.forEach(row => {
        const storeName = (row[0] || '').trim();
        if (!storeName) return;

        const busTerminalIdsJson = (row[34] || '').trim();
        const subwayStationIdsJson = (row[35] || '').trim();

        let busTerminalIds = [];
        let subwayStationIds = [];

        try {
          if (busTerminalIdsJson) {
            busTerminalIds = JSON.parse(busTerminalIdsJson);
          }
        } catch (e) {
          console.warn(`[Direct] 버스터미널ID목록 JSON 파싱 실패 (${storeName}):`, e);
        }

        try {
          if (subwayStationIdsJson) {
            subwayStationIds = JSON.parse(subwayStationIdsJson);
          }
        } catch (e) {
          console.warn(`[Direct] 지하철역ID목록 JSON 파싱 실패 (${storeName}):`, e);
        }

        const busTerminals = busTerminalIds
          .map(id => locationMap.get(id))
          .filter(Boolean);
        const subwayStations = subwayStationIds
          .map(id => locationMap.get(id))
          .filter(Boolean);

        if (busTerminals.length > 0 || subwayStations.length > 0) {
          storeTransitData.push({
            storeName,
            busTerminals,
            subwayStations
          });
        }
      });

      const payload = { success: true, data: storeTransitData };
      setCache(cacheKey, payload, 5 * 60 * 1000); // 5분 캐시
      res.json(payload);
    } catch (error) {
      console.error('[Direct] transit-location/list GET error:', error);
      res.status(500).json({ success: false, error: '대중교통 위치 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/transit-location/save: 매장별 대중교통 위치 저장 (ID 목록)
  router.post('/transit-location/save', async (req, res) => {
    // CORS 헤더는 전역 corsMiddleware에서 처리됨
    try {
      const { storeName, busTerminalIds, subwayStationIds } = req.body;

      if (!storeName) {
        return res.status(400).json({ success: false, error: '매장명이 필요합니다.' });
      }

      // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에 쓰기
      const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

      if (useDatabase) {
        // Supabase에 쓰기 (DirectStoreDAL 사용)
        console.log(`📝 [POST /api/direct/transit-location/save] Supabase에 데이터 쓰기 시작 (${storeName})`);

        const DirectStoreDAL = require('./dal/DirectStoreDAL');

        await withRetrySupabase(async () => {
          return await DirectStoreDAL.updateStoreTransitLocations(
            storeName,
            busTerminalIds,
            subwayStationIds
          );
        });

        console.log(`✅ [POST /api/direct/transit-location/save] Supabase에 데이터 쓰기 완료 (${storeName})`);

        return res.json({ success: true, message: '대중교통 위치가 저장되었습니다.' });
      }

      // Google Sheets에 쓰기 (기존 로직)
      console.log(`📝 [POST /api/direct/transit-location/save] Google Sheets에 데이터 쓰기 시작 (${storeName})`);

      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      const HEADERS_STORE_PHOTO = [
        '업체명', '전면사진URL', '전면사진Discord메시지ID', '전면사진Discord포스트ID', '전면사진Discord스레드ID',
        '내부사진URL', '내부사진Discord메시지ID', '내부사진Discord포스트ID', '내부사진Discord스레드ID',
        '외부사진URL', '외부사진Discord메시지ID', '외부사진Discord포스트ID', '외부사진Discord스레드ID',
        '외부2사진URL', '외부2사진Discord메시지ID', '외부2사진Discord포스트ID', '외부2사진Discord스레드ID',
        '점장사진URL', '점장사진Discord메시지ID', '점장사진Discord포스트ID', '점장사진Discord스레드ID',
        '직원1사진URL', '직원1사진Discord메시지ID', '직원1사진Discord포스트ID', '직원1사진Discord스레드ID',
        '직원2사진URL', '직원2사진Discord메시지ID', '직원2사진Discord포스트ID', '직원2사진Discord스레드ID',
        '직원3사진URL', '직원3사진Discord메시지ID', '직원3사진Discord포스트ID', '직원3사진Discord스레드ID',
        '수정일시', '버스터미널ID목록', '지하철역ID목록'
      ];

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_STORE_PHOTO, HEADERS_STORE_PHOTO);

      // 기존 데이터 조회
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_STORE_PHOTO}!A:AJ`
        });
      });

      const rows = (response.data.values || []).slice(1);
      const rowIndex = rows.findIndex(row => (row[0] || '').trim() === storeName);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });
      }

      // 기존 행 데이터 가져오기
      const existingRow = rows[rowIndex];
      const updatedRow = [...existingRow];

      // 배열 길이가 부족하면 확장 (36개 컬럼 보장)
      while (updatedRow.length < 36) {
        updatedRow.push('');
      }

      // AI 열 (인덱스 34): 버스터미널ID목록
      updatedRow[34] = JSON.stringify(Array.isArray(busTerminalIds) ? busTerminalIds : []);
      // AJ 열 (인덱스 35): 지하철역ID목록
      updatedRow[35] = JSON.stringify(Array.isArray(subwayStationIds) ? subwayStationIds : []);

      // 행 업데이트
      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_STORE_PHOTO}!A${rowIndex + 2}:AJ${rowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 캐시 무효화
      deleteCache('transit-location-list');

      res.json({ success: true, message: '대중교통 위치가 저장되었습니다.' });
    } catch (error) {
      console.error('[Direct] transit-location/save POST error:', error);
      res.status(500).json({ success: false, error: '대중교통 위치 저장 실패', message: error.message });
    }
  });

  app.use('/api/direct', router);
}

module.exports = setupDirectRoutes;
module.exports.invalidateDirectStoreCache = invalidateDirectStoreCache;
module.exports.deleteCache = deleteCache;
module.exports.ensureSheetHeaders = ensureSheetHeaders;
module.exports.HEADERS_MOBILE_IMAGES = HEADERS_MOBILE_IMAGES;
module.exports.HEADERS_MOBILE_MASTER = HEADERS_MOBILE_MASTER;
module.exports.rebuildPlanMaster = rebuildPlanMaster;
module.exports.rebuildDeviceMaster = rebuildDeviceMaster;
module.exports.rebuildPricingMaster = rebuildPricingMaster;
module.exports.refreshImagesFromDiscord = refreshImagesFromDiscord;
