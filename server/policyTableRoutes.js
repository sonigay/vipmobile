require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

// Discord 봇 설정 (server/index.js의 전역 discordBot 사용 또는 자체 초기화)
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

// Discord 봇 초기화 (server/index.js의 전역 봇을 사용하거나 자체 초기화)
let discordBot = null;
if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
  discordBot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  discordBot.once('ready', () => {
    console.log(`✅ [정책표] Discord 봇이 준비되었습니다: ${discordBot.user.tag}`);
  });

  discordBot.login(DISCORD_BOT_TOKEN)
    .then(() => console.log('✅ [정책표] Discord 봇 로그인 성공'))
    .catch(error => console.error('❌ [정책표] Discord 봇 로그인 실패:', error));
}

// Google Sheets 클라이언트 생성
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

// 시트 이름 정의
const SHEET_POLICY_TABLE_SETTINGS = '정책모드_정책표설정';
const SHEET_POLICY_TABLE_LIST = '정책모드_정책표목록';
const SHEET_USER_GROUPS = '정책모드_일반사용자그룹';

// 시트 헤더 정의
const HEADERS_POLICY_TABLE_SETTINGS = [
  '정책표ID',
  '정책표이름',
  '정책표링크',
  '디스코드채널ID',
  '생성자적용권한',
  '등록일시',
  '등록자'
];

const HEADERS_POLICY_TABLE_LIST = [
  '정책표ID',           // 0: 고유 ID
  '정책표ID_설정',      // 1: 설정과 연결된 ID
  '정책표이름',         // 2
  '정책적용일시',       // 3
  '정책적용내용',       // 4
  '접근권한',           // 5
  '생성자',             // 6
  '생성일시',           // 7
  '디스코드메시지ID',   // 8
  '디스코드스레드ID',   // 9
  '이미지URL',          // 10
  '등록여부',           // 11
  '등록일시'            // 12
];

const HEADERS_USER_GROUPS = [
  '그룹ID',
  '그룹이름',
  '일반사용자목록',
  '등록일시',
  '등록자'
];

// 컬럼 인덱스 헬퍼 함수
function getColumnLetter(columnNumber) {
  let result = '';
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
}

// 간단한 메모리 캐시
const cacheStore = new Map();
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

// Rate limit 에러 재시도 함수
async function withRetry(fn, maxRetries = 5, baseDelay = 2000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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
        const jitter = Math.random() * 1000;
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// 시트 헤더 확인 및 생성
async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  const cacheKey = `headers-${sheetName}-${spreadsheetId}`;
  const CACHE_TTL = 5 * 60 * 1000;

  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const spreadsheet = await withRetry(async () => {
      return await sheets.spreadsheets.get({ spreadsheetId });
    });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === sheetName);

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

    const res = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`
      });
    });
    const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
    const needsInit = firstRow.length === 0 || headers.some((h, i) => (firstRow[i] || '') !== h) || firstRow.length < headers.length;
    
    if (needsInit) {
      await withRetry(async () => {
        const lastColumn = getColumnLetter(headers.length);
        return await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:${lastColumn}1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] }
        });
      });
      cacheStore.delete(cacheKey);
      return headers;
    }
    
    setCache(cacheKey, headers, CACHE_TTL);
    return headers;
  } catch (error) {
    console.error(`[정책표] Failed to ensure sheet headers for ${sheetName}:`, error);
    cacheStore.delete(cacheKey);
    throw error;
  }
}

// 시트 ID 가져오기 헬퍼 함수
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const spreadsheet = await withRetry(async () => {
    return await sheets.spreadsheets.get({ spreadsheetId });
  });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

// 권한 체크 헬퍼 함수
async function checkPermission(req, allowedRoles) {
  const { sheets, SPREADSHEET_ID } = createSheetsClient();
  
  // 대리점아이디관리 시트에서 사용자 정보 조회
  const agentSheetName = '대리점아이디관리';
  const response = await withRetry(async () => {
    return await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${agentSheetName}!A:Z`
    });
  });

  const rows = response.data.values || [];
  if (rows.length < 2) {
    throw new Error('대리점아이디관리 시트에 데이터가 없습니다.');
  }

  // 로그인한 사용자 정보 찾기 (헤더에서 가져오기)
  const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId;
  const userRole = req.headers['x-user-role'] || req.body?.userRole || req.query?.userRole;
  
  // 대리점아이디관리 시트에서 사용자 정보 찾기
  // C열(2번 인덱스): 연락처(아이디) = contactId
  // A열(0번 인덱스): 대상(이름)
  // R열(17번 인덱스): 권한레벨
  let userInfo = null;
  if (userId) {
    const userRow = rows.find(row => {
      // C열(2번 인덱스)에서 contactId로 찾기
      return row[2] === userId;
    });
    if (userRow) {
      userInfo = {
        id: userRow[2] || userId,      // C열: 연락처(아이디)
        name: userRow[0] || userId,    // A열: 대상(이름)
        role: userRow[17] || userRole  // R열(17번 인덱스): 권한레벨
      };
    }
  }
  
  // userRole이 없으면 userInfo에서 가져오기
  const finalUserRole = userRole || userInfo?.role;
  const finalUserId = userId || userInfo?.id;
  const finalUserName = userInfo?.name;

  if (!finalUserRole) {
    return { hasPermission: false, error: '사용자 권한 정보가 없습니다.' };
  }

  const hasPermission = allowedRoles.includes(finalUserRole);
  return { 
    hasPermission, 
    userRole: finalUserRole, 
    userId: finalUserId, 
    userName: finalUserName || userInfo?.name 
  };
}

// 작업 상태 저장 (메모리 또는 구글시트)
const jobStatusStore = new Map();

function updateJobStatus(jobId, status) {
  jobStatusStore.set(jobId, {
    ...status,
    updatedAt: new Date().toISOString()
  });
}

function getJobStatus(jobId) {
  return jobStatusStore.get(jobId) || null;
}

// 정책표 생성 백그라운드 작업
async function processPolicyTableGeneration(jobId, params) {
  const { policyTableId, applyDate, applyContent, accessGroupId, creatorName, creatorRole } = params;
  let browser = null;

  try {
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 0,
      message: '초기화 중...'
    });

    // 1. 정책표 설정 조회
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 10,
      message: '정책표 설정 조회 중...'
    });

    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

    const settingsResponse = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_POLICY_TABLE_SETTINGS}!A:G`
      });
    });

    const settingsRows = settingsResponse.data.values || [];
    if (settingsRows.length < 2) {
      throw new Error('정책표 설정을 찾을 수 없습니다.');
    }

    const settingsRow = settingsRows.find(row => row[0] === policyTableId);
    if (!settingsRow) {
      throw new Error(`정책표 ID ${policyTableId}를 찾을 수 없습니다.`);
    }

    const policyTableName = settingsRow[1];
    const policyTableLink = settingsRow[2];
    const discordChannelId = settingsRow[3];

    // 2. Puppeteer로 구글 시트 캡쳐
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 25,
      message: '구글 시트 접근 중...'
    });

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=2560,10000',
        '--hide-scrollbars'
      ]
    });

    const page = await browser.newPage();
    await page.goto(policyTableLink, { waitUntil: 'networkidle0', timeout: 30000 });

    // iframe 찾기
    let frame = null;
    await page.waitForSelector('#pageswitcher-content', { timeout: 30000 });
    const frameElement = await page.$('#pageswitcher-content');
    if (frameElement) {
      frame = await frameElement.contentFrame();
    }
    if (!frame) {
      frame = await page.frames().find(f =>
        f.url().includes('pageswitcher') || f.name() === 'pageswitcher-content'
      );
    }

    if (!frame) {
      throw new Error('정책표 iframe을 찾을 수 없습니다.');
    }

    updateJobStatus(jobId, {
      status: 'processing',
      progress: 50,
      message: '이미지 캡쳐 중...'
    });

    // 테이블 찾기 및 스크린샷
    await frame.waitForSelector('table', { timeout: 30000, visible: true });
    const table = await frame.$('table');
    await table.scrollIntoViewIfNeeded();
    const boundingBox = await table.boundingBox();

    if (!boundingBox) {
      throw new Error('테이블 위치를 찾을 수 없습니다.');
    }

    // 전체 페이지 스크린샷
    const fullScreenshot = await page.screenshot({
      type: 'png',
      encoding: 'binary',
      fullPage: true
    });

    // Sharp로 테이블 영역만 크롭
    const x = Math.max(0, Math.floor(boundingBox.x * 0.95));
    const y = Math.max(0, Math.floor(boundingBox.y * 0.95));
    const width = Math.floor(boundingBox.width * 1.01);
    const height = Math.floor(boundingBox.height * 1.01);

    const cropped = await sharp(fullScreenshot)
      .extract({
        left: x,
        top: y,
        width: width,
        height: height
      })
      .png()
      .toBuffer();

    await browser.close();
    browser = null;

    // 3. 디스코드 업로드
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 75,
      message: '디스코드 업로드 중...'
    });

    if (!DISCORD_LOGGING_ENABLED || !discordBot) {
      throw new Error('Discord 봇이 초기화되지 않았습니다.');
    }

    // 봇이 준비될 때까지 대기
    if (!discordBot.isReady()) {
      for (let i = 0; i < 10; i++) {
        if (discordBot.isReady()) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!discordBot.isReady()) {
      throw new Error('Discord 봇이 준비되지 않았습니다.');
    }

    const channel = await discordBot.channels.fetch(discordChannelId);
    if (!channel) {
      throw new Error(`디스코드 채널을 찾을 수 없습니다: ${discordChannelId}`);
    }

    // 스레드 찾기 또는 생성
    const threadName = `${creatorName}-${policyTableName}`;
    let thread = null;

    // 기존 스레드 찾기
    const threads = await channel.threads.fetchActive();
    thread = threads.threads.find(t => t.name === threadName);

    if (!thread) {
      // 새 스레드 생성
      thread = await channel.threads.create({
        name: threadName,
        message: {
          content: `${threadName} 이미지 저장`
        }
      });
    }

    // 이미지 업로드
    const attachment = new AttachmentBuilder(cropped, { name: `정책표_${Date.now()}.png` });
    const message = await thread.send({ files: [attachment] });

    const imageUrl = message.attachments.first().url;
    const messageId = message.id;
    const threadId = thread.id;

    // 4. 구글시트에 저장
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 90,
      message: '데이터 저장 중...'
    });

    await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

    const newRowId = `POL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

      const newRow = [
        newRowId,                    // 0: 정책표ID (고유 ID)
        policyTableId,               // 1: 정책표ID (설정과 연결)
        policyTableName,             // 2: 정책표이름
        applyDate,                   // 3: 정책적용일시
        applyContent,                // 4: 정책적용내용
        accessGroupId || '',         // 5: 접근권한 (그룹ID)
        creatorName || creatorRole,  // 6: 생성자 (이름 또는 역할)
        createdAt,                   // 7: 생성일시
        messageId,                   // 8: 디스코드메시지ID
        threadId,                    // 9: 디스코드스레드ID
        imageUrl,                    // 10: 이미지URL
        'N',                         // 11: 등록여부
        ''                           // 12: 등록일시
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

    // 완료
    updateJobStatus(jobId, {
      status: 'completed',
      progress: 100,
      message: '정책표 생성이 완료되었습니다.',
      result: {
        id: newRowId,
        policyTableId,
        policyTableName,
        imageUrl,
        messageId,
        threadId
      }
    });

  } catch (error) {
    console.error('[정책표] 생성 오류:', error);
    updateJobStatus(jobId, {
      status: 'failed',
      progress: 0,
      message: '정책표 생성에 실패했습니다.',
      error: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function setupPolicyTableRoutes(app) {
  const router = express.Router();

  // CORS 헤더 설정
  const setCORSHeaders = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-role');
  };

  // OPTIONS 요청 처리 (CORS preflight)
  router.options('*', (req, res) => {
    setCORSHeaders(req, res);
    res.sendStatus(200);
  });

  // ========== 정책표생성설정 관련 API ==========

  // GET /api/policy-table-settings
  router.get('/policy-table-settings', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:G`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const settings = dataRows.map(row => ({
        id: row[0] || '',
        policyTableName: row[1] || '',
        policyTableLink: row[2] || '',
        discordChannelId: row[3] || '',
        creatorPermissions: row[4] ? JSON.parse(row[4]) : [],
        registeredAt: row[5] || '',
        registeredBy: row[6] || ''
      }));

      return res.json(settings);
    } catch (error) {
      console.error('[정책표] 설정 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-table-settings
  router.post('/policy-table-settings', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { policyTableName, policyTableLink, discordChannelId, creatorPermissions } = req.body;

      if (!policyTableName || !policyTableLink || !discordChannelId || !creatorPermissions || !Array.isArray(creatorPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const newId = `PT_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId,
        policyTableName,
        policyTableLink,
        discordChannelId,
        JSON.stringify(creatorPermissions),
        registeredAt,
        registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:G`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

      return res.json({
        success: true,
        id: newId,
        message: '정책표 설정이 추가되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 설정 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table-settings/:id
  router.put('/policy-table-settings/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { policyTableName, policyTableLink, discordChannelId, creatorPermissions } = req.body;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:G`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const updatedRow = [
        id, // 정책표ID는 변경 불가
        policyTableName !== undefined ? policyTableName : existingRow[1],
        policyTableLink !== undefined ? policyTableLink : existingRow[2],
        discordChannelId !== undefined ? discordChannelId : existingRow[3],
        creatorPermissions !== undefined ? JSON.stringify(creatorPermissions) : existingRow[4],
        existingRow[5], // 등록일시는 변경 불가
        existingRow[6]  // 등록자는 변경 불가
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A${rowIndex + 1}:G${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        id: id,
        message: '정책표 설정이 수정되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 설정 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-table-settings/:id
  router.delete('/policy-table-settings/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:G`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }

      // 행 삭제
      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS),
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      });

      return res.json({
        success: true,
        message: '정책표 설정이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 설정 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 일반사용자 그룹 관련 API ==========

  // GET /api/policy-table/user-groups
  router.get('/policy-table/user-groups', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);

      const groups = dataRows.map(row => ({
        id: row[0] || '',
        groupName: row[1] || '',
        userIds: row[2] ? JSON.parse(row[2]) : [],
        registeredAt: row[3] || '',
        registeredBy: row[4] || ''
      }));

      return res.json(groups);
    } catch (error) {
      console.error('[정책표] 그룹 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-table/user-groups
  router.post('/policy-table/user-groups', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { groupName, userIds } = req.body;

      if (!groupName || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const newId = `UG_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId,
        groupName,
        JSON.stringify(userIds),
        registeredAt,
        registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

      return res.json({
        success: true,
        id: newId,
        message: '일반사용자 그룹이 추가되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table/user-groups/:id
  router.put('/policy-table/user-groups/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { groupName, userIds } = req.body;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '그룹을 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const updatedRow = [
        id,
        groupName !== undefined ? groupName : existingRow[1],
        userIds !== undefined ? JSON.stringify(userIds) : existingRow[2],
        existingRow[3],
        existingRow[4]
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A${rowIndex + 1}:E${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        id: id,
        message: '일반사용자 그룹이 수정되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-table/user-groups/:id
  router.delete('/policy-table/user-groups/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '그룹을 찾을 수 없습니다.' });
      }

      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS),
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      });

      return res.json({
        success: true,
        message: '일반사용자 그룹이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 정책표 생성 관련 API ==========

  // POST /api/policy-table/generate
  router.post('/policy-table/generate', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { policyTableId, applyDate, applyContent, accessGroupId } = req.body;

      if (!policyTableId || !applyDate || !applyContent) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      // 작업 ID 생성
      const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 백그라운드 작업 시작
      processPolicyTableGeneration(jobId, {
        policyTableId,
        applyDate,
        applyContent,
        accessGroupId,
        creatorName: permission.userId || 'Unknown',
        creatorRole: permission.userRole
      }).catch(error => {
        console.error('[정책표] 백그라운드 작업 오류:', error);
      });

      return res.json({
        success: true,
        jobId: jobId,
        status: 'queued',
        message: '정책표 생성이 시작되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 생성 요청 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-table/generate/:jobId/status
  router.get('/policy-table/generate/:jobId/status', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { jobId } = req.params;
      const status = getJobStatus(jobId);

      if (!status) {
        return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다.' });
      }

      return res.json(status);
    } catch (error) {
      console.error('[정책표] 상태 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 정책표목록 관련 API ==========

  // GET /api/policy-tables/tabs
  router.get('/policy-tables/tabs', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const userRole = req.headers['x-user-role'] || req.query.userRole;
      const userId = req.headers['x-user-id'] || req.query.userId;
      
      if (!userRole) {
        return res.status(400).json({ success: false, error: '사용자 권한 정보가 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:B`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      let tabs = dataRows.map(row => ({
        policyTableId: row[0] || '',
        policyTableName: row[1] || ''
      }));

      // 권한 필터링
      if (['SS', 'S'].includes(userRole) || ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
        // 모든 탭 표시
      } else if (['A', 'B', 'C', 'D', 'E', 'F'].includes(userRole)) {
        // 일반 사용자는 접근권한에 포함된 탭만 표시
        // 정책표목록에서 접근권한 확인
        const policyListResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_TABLE_LIST}!A:M`
          });
        });

        const policyRows = policyListResponse.data.values || [];
        const policyDataRows = policyRows.slice(1);

        // 일반사용자 그룹 목록 조회
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroupsMap = new Map();
        userGroupsDataRows.forEach(row => {
          const groupId = row[0];
          const userIds = row[2] ? JSON.parse(row[2]) : [];
          userGroupsMap.set(groupId, userIds);
        });

        // 접근 가능한 정책표ID 목록 생성
        const accessiblePolicyTableIds = new Set();
        policyDataRows.forEach(row => {
          const accessGroupId = row[5]; // 접근권한 (그룹ID)
          if (accessGroupId) {
            const userIds = userGroupsMap.get(accessGroupId) || [];
            if (userIds.includes(userRole)) {
              accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
            }
          }
        });

        // 접근 가능한 탭만 필터링
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      }

      return res.json(tabs);
    } catch (error) {
      console.error('[정책표] 탭 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-tables
  router.get('/policy-tables', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { policyTableName, applyDateFrom, applyDateTo, creator, createDateFrom, createDateTo } = req.query;
      const userRole = req.headers['x-user-role'] || req.query.userRole;

      if (!policyTableName) {
        return res.status(400).json({ success: false, error: 'policyTableName이 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      let policies = dataRows
        .filter(row => {
          // 정책표이름 필터
          if (row[2] !== policyTableName) return false;
          // 등록여부 필터 (등록된 것만)
          if (row[11] !== 'Y') return false;
          return true;
        })
        .map(row => ({
          id: row[0] || '',
          policyTableId: row[1] || '',
          policyTableName: row[2] || '',
          applyDate: row[3] || '',
          applyContent: row[4] || '',
          accessGroupId: row[5] || '',
          creator: row[6] || '',
          createdAt: row[7] || '',
          messageId: row[8] || '',
          threadId: row[9] || '',
          imageUrl: row[10] || '',
          registeredAt: row[12] || ''
        }));

      // 권한 필터링
      if (['SS', 'S'].includes(userRole) || ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
        // 모든 정책표 표시
      } else if (['A', 'B', 'C', 'D', 'E', 'F'].includes(userRole)) {
        // 일반 사용자는 접근권한에 포함된 것만 표시
        // 일반사용자 그룹 목록 조회
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroupsMap = new Map();
        userGroupsDataRows.forEach(row => {
          const groupId = row[0];
          const userIds = row[2] ? JSON.parse(row[2]) : [];
          userGroupsMap.set(groupId, userIds);
        });

        // 접근권한에 포함된 정책표만 필터링
        policies = policies.filter(policy => {
          const accessGroupId = policy.accessGroupId;
          if (!accessGroupId) return false; // 접근권한이 없으면 접근 불가
          const userIds = userGroupsMap.get(accessGroupId) || [];
          return userIds.includes(userRole);
        });
      }

      // 추가 필터링
      if (applyDateFrom) {
        policies = policies.filter(p => p.applyDate >= applyDateFrom);
      }
      if (applyDateTo) {
        policies = policies.filter(p => p.applyDate <= applyDateTo);
      }
      if (creator) {
        policies = policies.filter(p => p.creator === creator);
      }
      if (createDateFrom) {
        policies = policies.filter(p => p.createdAt >= createDateFrom);
      }
      if (createDateTo) {
        policies = policies.filter(p => p.createdAt <= createDateTo);
      }

      return res.json(policies);
    } catch (error) {
      console.error('[정책표] 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-tables/:id/register
  router.post('/policy-tables/:id/register', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const updatedRow = [...existingRow];
      updatedRow[11] = 'Y'; // 등록여부
      updatedRow[12] = new Date().toISOString(); // 등록일시

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 1}:M${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        message: '정책표가 등록되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 등록 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-tables/:id
  router.get('/policy-tables/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { id } = req.params;
      const userRole = req.headers['x-user-role'] || req.query.userRole;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`
        });
      });

      const rows = response.data.values || [];
      const row = rows.find(r => r[0] === id);

      if (!row) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      // 권한 체크
      if (['SS', 'S'].includes(userRole) || ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
        // 모든 정책표 접근 가능
      } else if (['A', 'B', 'C', 'D', 'E', 'F'].includes(userRole)) {
        // 일반 사용자는 접근권한 확인 필요
        const accessGroupId = row[5]; // 접근권한 (그룹ID)
        if (accessGroupId) {
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });

          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          const userGroup = userGroupsDataRows.find(r => r[0] === accessGroupId);
          
          if (userGroup) {
            const userIds = userGroup[2] ? JSON.parse(userGroup[2]) : [];
            if (!userIds.includes(userRole)) {
              return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
            }
          } else {
            return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
          }
        } else {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      }

      const policy = {
        id: row[0] || '',
        policyTableId: row[1] || '',
        policyTableName: row[2] || '',
        applyDate: row[3] || '',
        applyContent: row[4] || '',
        accessGroupId: row[5] || '',
        creator: row[6] || '',
        createdAt: row[7] || '',
        messageId: row[8] || '',
        threadId: row[9] || '',
        imageUrl: row[10] || '',
        registeredAt: row[12] || ''
      };

      return res.json(policy);
    } catch (error) {
      console.error('[정책표] 상세 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-tables/:id/refresh-image
  router.post('/policy-tables/:id/refresh-image', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`
        });
      });

      const rows = response.data.values || [];
      const row = rows.find(r => r[0] === id);

      if (!row) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      const messageId = row[8];
      if (!messageId) {
        return res.status(400).json({ success: false, error: '메시지 ID가 없습니다.' });
      }

      // Discord API로 메시지 조회하여 이미지 URL 갱신
      if (!DISCORD_LOGGING_ENABLED || !discordBot || !discordBot.isReady()) {
        return res.status(503).json({ success: false, error: 'Discord 봇이 준비되지 않았습니다.' });
      }

      // 스레드 ID로 스레드 찾기
      const threadId = row[9];
      if (!threadId) {
        return res.status(400).json({ success: false, error: '스레드 ID가 없습니다.' });
      }

      const thread = await discordBot.channels.fetch(threadId);
      if (!thread) {
        return res.status(404).json({ success: false, error: '디스코드 스레드를 찾을 수 없습니다.' });
      }

      const message = await thread.messages.fetch(messageId);
      if (!message || !message.attachments.first()) {
        return res.status(404).json({ success: false, error: '메시지 또는 이미지를 찾을 수 없습니다.' });
      }

      const newImageUrl = message.attachments.first().url;

      // 구글시트 업데이트
      const rowIndex = rows.findIndex(r => r[0] === id);
      const updatedRow = [...row];
      updatedRow[10] = newImageUrl; // 이미지URL

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 1}:M${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        imageUrl: newImageUrl,
        message: '이미지가 갱신되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 이미지 갱신 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-tables/:id
  router.delete('/policy-tables/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST),
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      });

      return res.json({
        success: true,
        message: '정책표가 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = setupPolicyTableRoutes;

