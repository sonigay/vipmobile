require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
// Puppeteer 없이 Google Sheets API + Canvas 사용
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
  '정책표설명',
  '정책표링크',           // 편집 링크 (사용자가 클릭하는 링크)
  '정책표공개링크',        // 공개 링크 (/pubhtml, Puppeteer 캡처용)
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

// 구글시트 편집 링크 정규화 함수
// 시트 ID만 넣어도, 전체 URL을 넣어도 편집 가능한 표준 URL로 변환
function normalizeGoogleSheetEditLink(link) {
  if (!link) return '';
  
  // 공백 제거
  link = link.trim();
  
  // 시트 ID만 있는 경우 (예: "1Vy8Qhce3B6_41TxRfVUs883ioLxiGTUjkbD_nKebgrs")
  if (/^[a-zA-Z0-9-_]+$/.test(link)) {
    return `https://docs.google.com/spreadsheets/d/${link}/edit`;
  }
  
  // 이미 전체 URL인 경우
  if (link.startsWith('http://') || link.startsWith('https://')) {
    // 시트 ID 추출
    const sheetIdMatch = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetIdMatch) {
      const sheetId = sheetIdMatch[1];
      // gid 파라미터 추출 (있는 경우)
      const gidMatch = link.match(/[?&#]gid=([0-9]+)/);
      if (gidMatch) {
        const gid = gidMatch[1];
        return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=${gid}#gid=${gid}`;
      }
      return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    }
  }
  
  // 변환 실패 시 원본 반환
  return link;
}

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
        range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
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
    const policyTableDescription = settingsRow[2] || '';
    const policyTableLink = settingsRow[3];  // 편집 링크
    const policyTablePublicLink = settingsRow[4] || settingsRow[3];  // 공개 링크 (없으면 편집 링크 사용)
    const discordChannelId = settingsRow[5];

    // 2. Google Sheets API export 기능으로 PDF 받아서 이미지로 변환 (실제 보이는 모습 그대로)
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 25,
      message: '구글 시트를 이미지로 변환 중...'
    });

    // Google Sheets 링크에서 스프레드시트 ID와 시트 ID 추출
    const spreadsheetIdMatch = policyTableLink.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetIdMatch = policyTableLink.match(/[#&]gid=(\d+)/);
    
    if (!spreadsheetIdMatch) {
      throw new Error('구글 시트 ID를 찾을 수 없습니다.');
    }

    const targetSpreadsheetId = spreadsheetIdMatch[1];
    const targetSheetId = sheetIdMatch ? sheetIdMatch[1] : null;

    // Google Drive API를 사용하여 PDF로 export
    const { google: googleDrive } = require('googleapis');
    const auth = new googleDrive.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.includes('\\n') 
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : process.env.GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = googleDrive.drive({ version: 'v3', auth });

    // PDF로 export (실제 보이는 모습 그대로)
    let pdfBuffer;
    try {
      const exportResponse = await drive.files.export(
        {
          fileId: targetSpreadsheetId,
          mimeType: 'application/pdf',
          // 특정 시트만 export하려면 (선택사항)
          // ...(targetSheetId ? { gid: targetSheetId } : {})
        },
        { responseType: 'arraybuffer' }
      );
      pdfBuffer = Buffer.from(exportResponse.data);
    } catch (exportError) {
      console.error('❌ [정책표] PDF export 실패:', exportError.message);
      throw new Error(`구글 시트를 PDF로 변환할 수 없습니다: ${exportError.message}`);
    }

    updateJobStatus(jobId, {
      status: 'processing',
      progress: 50,
      message: 'PDF를 이미지로 변환 중...'
    });

    // PDF를 이미지로 변환 (pdfjs-dist 사용 - 순수 JavaScript, 시스템 의존성 없음)
    let cropped;
    try {
      // pdfjs-dist 동적 로드 (서버 시작 시 에러 방지)
      let pdfjsLib;
      try {
        // 여러 경로 시도
        try {
          pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        } catch (e1) {
          try {
            pdfjsLib = require('pdfjs-dist/build/pdf.js');
          } catch (e2) {
            pdfjsLib = require('pdfjs-dist');
          }
        }
      } catch (requireError) {
        console.error('❌ [정책표] pdfjs-dist 모듈 로드 실패:', requireError.message);
        throw new Error(`pdfjs-dist 모듈을 로드할 수 없습니다: ${requireError.message}`);
      }

      const { createCanvas, Image } = require('canvas');

      // pdfjs-dist를 Node.js 환경에서 사용하기 위한 설정
      // Node.js Canvas를 브라우저 Canvas처럼 사용할 수 있도록 전역 설정
      if (typeof global !== 'undefined') {
        global.Canvas = createCanvas;
        global.Image = Image;
      }

      // PDF 문서 로드 (Buffer를 Uint8Array로 변환)
      const pdfData = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjsLib.getDocument({ 
        data: pdfData,
        verbosity: 0, // 로그 레벨 낮춤
        // Node.js 환경에서 이미지 처리를 위한 설정
        disableAutoFetch: false,
        disableStream: false
      });
      const pdfDocument = await loadingTask.promise;

      // 첫 번째 페이지만 렌더링 (정책표는 보통 한 페이지)
      const page = await pdfDocument.getPage(1);
      
      // 렌더링 옵션 (고해상도)
      const scale = 2.0; // 2배 확대하여 고해상도
      const viewport = page.getViewport({ scale });

      // Canvas 생성
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');

      // PDF 페이지를 Canvas에 렌더링
      // pdfjs-dist가 Node.js Canvas를 인식할 수 있도록 설정
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        // Node.js 환경에서 이미지 처리를 위한 추가 설정
        enableWebGL: false
      };

      // render 메서드 호출
      const renderTask = page.render(renderContext);
      await renderTask.promise;

      // Canvas를 PNG 버퍼로 변환
      cropped = canvas.toBuffer('image/png');
      
      console.log(`✅ [정책표] PDF를 이미지로 변환 완료 (크기: ${Math.ceil(viewport.width)}x${Math.ceil(viewport.height)})`);
    } catch (pdfError) {
      console.error('❌ [정책표] PDF를 이미지로 변환 실패:', pdfError.message);
      console.error('❌ [정책표] 스택:', pdfError.stack);
      throw new Error(`PDF를 이미지로 변환할 수 없습니다: ${pdfError.message}`);
    }

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
    // Puppeteer를 사용하지 않으므로 browser 정리 불필요
  }
}

function setupPolicyTableRoutes(app) {
  const router = express.Router();

  // CORS 헤더 설정
  const setCORSHeaders = (req, res) => {
    // 환경 변수에서 허용할 도메인 목록 가져오기
    const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    
    // 기본 허용 도메인 (개발용 및 프로덕션)
    const defaultOrigins = [
      'https://vipmobile.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002'
    ];
    
    const allowedOrigins = [...defaultOrigins, ...corsOrigins];
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && process.env.CORS_ORIGIN?.includes(origin)) {
      // 환경 변수에 있는 경우도 허용
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://vipmobile.vercel.app');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, X-API-Key, x-user-id, x-user-role');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24시간 캐시
  };

  // CORS 헤더는 전역 핸들러(app.options('*'))에서 처리되므로
  // 라우터에서는 각 라우트 핸들러에서만 setCORSHeaders 호출
  // OPTIONS 요청은 전역 핸들러가 처리

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
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
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
        policyTableDescription: row[2] || '',
        policyTableLink: row[3] || '',
        policyTablePublicLink: row[4] || '',  // 공개 링크
        discordChannelId: row[5] || '',
        creatorPermissions: row[6] ? JSON.parse(row[6]) : [],
        registeredAt: row[7] || '',
        registeredBy: row[8] || ''
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

      const { policyTableName, policyTableDescription, policyTableLink, policyTablePublicLink, discordChannelId, creatorPermissions } = req.body;

      if (!policyTableName || !policyTableLink || !discordChannelId || !creatorPermissions || !Array.isArray(creatorPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      // 편집 링크 정규화 (시트 ID만 넣어도 전체 URL로 변환)
      const normalizedEditLink = normalizeGoogleSheetEditLink(policyTableLink);
      
      const newId = `PT_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId,
        policyTableName,
        policyTableDescription || '',
        normalizedEditLink,  // 정규화된 편집 링크
        policyTablePublicLink || '',  // 공개 링크 (선택)
        discordChannelId,
        JSON.stringify(creatorPermissions),
        registeredAt,
        registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`,
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

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
        });
      });

      const rows = response.data.values || [];
      
      // 헤더 행 제외 (첫 번째 행은 헤더)
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }
      
      // 헤더를 제외한 데이터 행에서 찾기
      const dataRows = rows.slice(1);
      const rowIndex = dataRows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }

      const existingRow = dataRows[rowIndex];
      const { policyTableName, policyTableDescription, policyTableLink, policyTablePublicLink, discordChannelId, creatorPermissions } = req.body;
      
      // 편집 링크 정규화
      const normalizedEditLink = policyTableLink !== undefined 
        ? normalizeGoogleSheetEditLink(policyTableLink)
        : existingRow[3];
      
      const updatedRow = [
        id, // 정책표ID는 변경 불가
        policyTableName !== undefined ? policyTableName : existingRow[1],
        policyTableDescription !== undefined ? policyTableDescription : (existingRow[2] || ''),
        normalizedEditLink,  // 정규화된 편집 링크
        policyTablePublicLink !== undefined ? policyTablePublicLink : (existingRow[4] || ''),
        discordChannelId !== undefined ? discordChannelId : existingRow[5],
        creatorPermissions !== undefined ? JSON.stringify(creatorPermissions) : existingRow[6],
        existingRow[7], // 등록일시는 변경 불가
        existingRow[8]  // 등록자는 변경 불가
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A${rowIndex + 2}:I${rowIndex + 2}`,
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
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
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

  // ========== 정책영업그룹 관련 API ==========

  // GET /api/policy-table/user-groups
  router.get('/policy-table/user-groups', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
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
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
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
        message: '정책영업그룹이 추가되었습니다.'
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
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
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
        message: '정책영업그룹이 수정되었습니다.'
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
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
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
        message: '정책영업그룹이 삭제되었습니다.'
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
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
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

        // 정책영업그룹 목록 조회
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
        // 정책영업그룹 목록 조회
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

