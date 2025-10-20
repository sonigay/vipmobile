require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const NodeGeocoder = require('node-geocoder');
const webpush = require('web-push');
const ExcelJS = require('exceljs');
// const cron = require('node-cron'); // 클라우드타입에서 패키지 설치 문제로 임시 비활성화
const monthlyAwardAPI = require('./monthlyAwardAPI');
const setupTeamRoutes = require('./teamRoutes');
const UserSheetManager = require('./UserSheetManager');
const PhoneklDataManager = require('./PhoneklDataManager');
const setupObRoutes = require('./obRoutes');

// 기본 설정
const app = express();
const port = process.env.PORT || 4000;

// Google Sheets API 호출 빈도 제한을 위한 변수
let lastSheetsApiCall = 0;
const SHEETS_API_COOLDOWN = 1000; // 1초 대기

// Google Sheets API 호출 빈도 제한 함수
const rateLimitedSheetsCall = async (apiCall) => {
  const now = Date.now();
  const timeSinceLastCall = now - lastSheetsApiCall;
  
  if (timeSinceLastCall < SHEETS_API_COOLDOWN) {
    const waitTime = SHEETS_API_COOLDOWN - timeSinceLastCall;
    console.log(`Google Sheets API 호출 빈도 제한: ${waitTime}ms 대기`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastSheetsApiCall = Date.now();
  return await apiCall();
};

// 서버 타임아웃 설정 (5분)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5분
  res.setTimeout(300000); // 5분
  next();
});

// CORS 설정 - 더 안전하고 포괄적인 설정
app.use(cors({
  origin: function (origin, callback) {
    // 허용할 도메인 목록
    const allowedOrigins = [
      'https://vipmobile.netlify.app',
      'https://vipmobile.netlify.app/',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000'
    ];
    
    // origin이 없거나 허용된 도메인에 포함되어 있으면 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'X-API-Key'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// OPTIONS 요청 명시적 처리
app.options('*', (req, res) => {
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24시간 캐시
  res.status(200).end();
});

// 특정 API 엔드포인트에 대한 OPTIONS 요청 처리
app.options('/api/budget/user-sheets-v2', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://vipmobile.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24시간 캐시
  res.status(200).end();
});

// 팀 목록 조회 API
app.get('/api/teams', async (req, res) => {
  try {
    console.log('🔍 [팀목록] 팀 목록 조회 시작');
    
    // 대리점아이디관리 시트에서 팀장 목록 가져오기
    const sheetName = '대리점아이디관리';
    console.log('🔍 [팀목록] 시트 이름:', sheetName);
    
    const range = 'A:P'; // A열(이름)과 P열(권한레벨) 포함
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    
    const rows = response.data.values || [];
    console.log('🔍 [팀목록] 총 행 수:', rows.length);
    
    const teams = [];
    
    // 헤더 제외하고 데이터 처리
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = row[0]; // A열: 대상(이름)
      const permissionLevel = row[15]; // P열: 정책모드권한레벨
      
      console.log(`🔍 [팀목록] 행 ${i}: 이름=${name}, 권한레벨=${permissionLevel}`);
      
      // 권한레벨이 알파벳 두 개인 경우 팀장으로 인식 (AA, BB, CC, DD, EE, FF 등)
      if (permissionLevel && permissionLevel.length === 2 && /^[A-Z]{2}$/.test(permissionLevel)) {
        teams.push({
          code: permissionLevel,
          name: name
        });
        console.log(`✅ [팀목록] 팀장 추가: ${permissionLevel} - ${name}`);
      }
    }
    
    console.log('🔍 [팀목록] 최종 팀 목록:', teams);
    res.json(teams);
  } catch (error) {
    console.error('❌ [팀목록] 팀 목록 조회 실패:', error);
    res.status(500).json({ error: '팀 목록 조회에 실패했습니다.', details: error.message });
  }
});

// VAPID 키 설정 (환경변수에서 가져오거나 생성)
const vapidKeys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY 
  ? {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    }
  : webpush.generateVAPIDKeys();

// web-push 설정
webpush.setVapidDetails(
  'mailto:admin@vipmap.com', // 관리자 이메일 (실제 이메일로 변경 필요)
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// 푸시 구독 저장소 (실제로는 데이터베이스 사용 권장)
const pushSubscriptions = new Map();

// 캐싱 시스템 설정 (트래픽 최적화)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분 (5 * 60 * 1000ms)
const MAX_CACHE_SIZE = 200; // 최대 캐시 항목 수 증가 (100 → 200)

// 동시 요청 제한 설정
const concurrentRequestLimit = {
  maxConcurrent: 10, // 최대 동시 요청 수
  currentRequests: 0,
  queue: []
};

// API 호출 제한 설정 (트래픽 최적화)
const API_RATE_LIMIT = {
  maxRequestsPerMinute: 45, // Google Sheets API 무료 한도(60회)보다 낮게 설정
  requests: [],
  isRateLimited: false
};

// 요청 큐 관리 함수
const processRequestQueue = async () => {
  if (concurrentRequestLimit.queue.length > 0 && 
      concurrentRequestLimit.currentRequests < concurrentRequestLimit.maxConcurrent) {
    const { resolve, reject, requestFunction } = concurrentRequestLimit.queue.shift();
    concurrentRequestLimit.currentRequests++;
    
    try {
      const result = await requestFunction();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      concurrentRequestLimit.currentRequests--;
      processRequestQueue(); // 다음 요청 처리
    }
  }
};

// 요청 제한 래퍼 함수
const withConcurrencyLimit = (requestFunction) => {
  return new Promise((resolve, reject) => {
    if (concurrentRequestLimit.currentRequests < concurrentRequestLimit.maxConcurrent) {
      concurrentRequestLimit.currentRequests++;
      requestFunction()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          concurrentRequestLimit.currentRequests--;
          processRequestQueue();
        });
    } else {
      concurrentRequestLimit.queue.push({ resolve, reject, requestFunction });
    }
  });
};

// 캐시 유틸리티 함수들
const cacheUtils = {
  // 캐시에 데이터 저장
  set: (key, data, ttl = CACHE_TTL) => {
    const now = Date.now();
    cache.set(key, {
      data,
      timestamp: now,
      ttl: now + ttl
    });
    
    // 캐시 크기 제한 확인
    if (cache.size > MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  },
  
  // 캐시에서 데이터 가져오기
  get: (key) => {
    const item = cache.get(key);
    if (!item) {
      return null;
    }
    
    const now = Date.now();
    if (now > item.ttl) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  },
  
  // 캐시 삭제
  delete: (key) => {
    cache.delete(key);
  },
  
  // 캐시 전체 정리 (만료된 항목들)
  cleanup: () => {
    const now = Date.now();
    
    for (const [key, item] of cache.entries()) {
      if (now > item.ttl) {
        cache.delete(key);
      }
    }
  },
  
  // 캐시 상태 확인
  status: () => {
    const now = Date.now();
    const validItems = Array.from(cache.entries()).filter(([key, item]) => now <= item.ttl);
    return {
      total: cache.size,
      valid: validItems.length,
      expired: cache.size - validItems.length
    };
  },
  
  // 캐시 패턴 삭제
  deletePattern: (pattern) => {
    for (const key of cache.keys()) {
      if (key.startsWith(pattern)) {
        cache.delete(key);
      }
    }
  }
};

// API 호출 제한 유틸리티
const rateLimitUtils = {
  // API 호출 가능 여부 확인
  canMakeRequest: () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // 1분 이전의 요청들 제거
    API_RATE_LIMIT.requests = API_RATE_LIMIT.requests.filter(time => time > oneMinuteAgo);
    
    // 현재 요청 수가 제한을 초과했는지 확인
    if (API_RATE_LIMIT.requests.length >= API_RATE_LIMIT.maxRequestsPerMinute) {
      API_RATE_LIMIT.isRateLimited = true;
      return false;
    }
    
    API_RATE_LIMIT.isRateLimited = false;
    return true;
  },
  
  // API 호출 기록
  recordRequest: () => {
    API_RATE_LIMIT.requests.push(Date.now());
  },
  
  // 대기 시간 계산
  getWaitTime: () => {
    if (API_RATE_LIMIT.requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...API_RATE_LIMIT.requests);
    const timeSinceOldest = Date.now() - oldestRequest;
    return Math.max(0, 60000 - timeSinceOldest); // 1분 - 경과 시간
  }
};

// 주기적 캐시 정리 (5분마다)
setInterval(() => {
  cacheUtils.cleanup();
}, 5 * 60 * 1000);

// 주기적 배정 저장 (10분마다) - 개통완료 확인 후 배정 저장
setInterval(async () => {
  try {
    console.log('🔄 [자동배정저장] 주기적 배정 저장 시작');
    
    // 1. 먼저 개통완료 상태 확인 및 F열 업데이트
    console.log('📋 [자동배정저장] 1단계: 개통완료 상태 확인 시작');
    const activationResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/activation-status`);
    
    if (activationResponse.ok) {
      const activationResult = await activationResponse.json();
      if (activationResult.success) {
        console.log(`✅ [자동배정저장] 개통완료 상태 확인 완료: ${activationResult.data?.length || 0}개 고객 처리`);
      } else {
        console.error('❌ [자동배정저장] 개통완료 상태 확인 실패:', activationResult.error);
      }
    } else {
      console.error('❌ [자동배정저장] 개통완료 상태 확인 API 호출 실패:', activationResponse.status);
    }
    
    // 2. 개통완료 데이터 저장 완료를 위한 대기 (2초)
    console.log('⏳ [자동배정저장] 2단계: 개통완료 데이터 저장 완료 대기 (2초)');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 폰클재고데이터 기준으로 현재 배정 상태 가져오기
    console.log('📊 [자동배정저장] 3단계: 배정 상태 확인 시작');
    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
    
    if (response.ok) {
      const result = await response.json();
      
      if (result.success) {
        // 배정완료된 고객들만 필터링
        const assignments = result.data
          .filter(item => item.assignmentStatus === '배정완료' && item.assignedSerialNumber)
          .map(item => ({
            reservationNumber: item.reservationNumber,
            assignedSerialNumber: item.assignedSerialNumber
          }));
        
        if (assignments.length > 0) {
          // 배정 저장 API 호출 (개통완료 고객 제외 로직 포함)
          console.log('💾 [자동배정저장] 4단계: 배정 저장 시작');
          const saveResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/save-assignment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assignments })
          });
          
          if (saveResponse.ok) {
            const saveResult = await saveResponse.json();
            console.log(`✅ [자동배정저장] 배정 저장 완료: ${saveResult.updated}개 저장, ${saveResult.skipped}개 유지`);
          } else {
            console.error('❌ [자동배정저장] 배정 저장 실패:', saveResponse.status);
          }
        } else {
          console.log('ℹ️ [자동배정저장] 저장할 배정이 없습니다');
        }
      }
    }
  } catch (error) {
    console.error('❌ [자동배정저장] 주기적 배정 저장 오류:', error);
  }
}, 10 * 60 * 1000); // 10분마다

// Discord 봇 설정
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_AGENT_CHANNEL_ID = process.env.DISCORD_AGENT_CHANNEL_ID || DISCORD_CHANNEL_ID; // 관리자 채널 (없으면 기본 채널 사용)
const DISCORD_STORE_CHANNEL_ID = process.env.DISCORD_STORE_CHANNEL_ID || DISCORD_CHANNEL_ID; // 일반 매장 채널 (없으면 기본 채널 사용)
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

// 디스코드 봇 및 관련 라이브러리는 필요한 경우에만 초기화
let discordBot = null;
let EmbedBuilder = null;

if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    ({ EmbedBuilder } = require('discord.js'));
    
    // 디스코드 봇 초기화
    discordBot = new Client({ 
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    // 봇 준비 이벤트
    discordBot.once('ready', () => {
      // console.log(`봇이 준비되었습니다: ${discordBot.user.tag}`);
    });
    
    // console.log('디스코드 봇 모듈 로딩 성공');
  } catch (error) {
    console.error('디스코드 봇 모듈 로딩 실패:', error.message);
  }
}

// 전역 오류 처리
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  
  // Discord에 오류 알림 전송
  if (DISCORD_LOGGING_ENABLED && discordBot) {
    try {
      // 봇이 준비되었는지 확인
      if (discordBot.isReady()) {
        if (DISCORD_CHANNEL_ID) {
          try {
            const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
            if (channel) {
              // 에러 정보를 간결하게 정리
              const errorInfo = {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 5).join('\n') || '스택 정보 없음',
                time: new Date().toISOString()
              };
              
              const crashEmbed = new EmbedBuilder()
                .setTitle('🚨 서버 충돌 알림')
                .setColor(15548997) // 빨간색
                .setDescription('@everyone\n서버에 치명적인 오류가 발생했습니다. 서비스가 중단되었습니다.')
                .addFields({
                  name: '오류 정보',
                  value: `\`\`\`\n${errorInfo.message}\n${errorInfo.stack}\n\`\`\``
                })
                .setTimestamp()
                .setFooter({ text: '(주)브이아이피플러스 서버 오류 알림' });
                
              // console.log('충돌 알림 전송 시도 중...');
              await channel.send({ content: '@everyone', embeds: [crashEmbed] });
              // console.log('서버 충돌 알림 메시지가 Discord로 전송되었습니다.');
            }
          } catch (discordError) {
            console.error('Discord 충돌 알림 전송 실패:', discordError);
          }
        }
      }
      
      // Discord 메시지 전송을 위한 대기
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (discordError) {
      console.error('Discord 오류 알림 처리 중 추가 오류:', discordError);
    }
  }
  
  // 3초 후 프로세스 종료 (Discord 메시지 전송 시간 확보)
  setTimeout(() => {
    console.error('치명적인 오류로 인한 서버 종료');
    process.exit(1);
  }, 3000);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // 치명적이지 않은 경우 Discord에 경고 알림만 전송
  if (DISCORD_LOGGING_ENABLED && discordBot && discordBot.isReady()) {
    try {
      if (DISCORD_CHANNEL_ID) {
        const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel) {
          // 오류 정보 정리
          const errorInfo = {
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error && reason.stack 
              ? reason.stack.split('\n').slice(0, 5).join('\n') 
              : '스택 정보 없음',
            time: new Date().toISOString()
          };
          
          const warningEmbed = new EmbedBuilder()
            .setTitle('⚠️ 서버 경고 알림')
            .setColor(16776960) // 노란색
            .setDescription('서버에서 처리되지 않은 Promise 거부가 발생했습니다.')
            .addFields({
              name: '오류 정보',
              value: `\`\`\`\n${errorInfo.message}\n${errorInfo.stack}\n\`\`\``
            })
            .setTimestamp()
            .setFooter({ text: '(주)브이아이피플러스 서버 경고 알림' });
            
          await channel.send({ embeds: [warningEmbed] });
          // console.log('서버 경고 알림 메시지가 Discord로 전송되었습니다.');
        }
      }
    } catch (discordError) {
      console.error('Discord 경고 알림 전송 실패:', discordError);
    }
  }
  
  // 처리되지 않은 Promise 거부를 기록하지만 프로세스는 계속 실행
});

// 모든 요청에 대한 로깅 미들웨어
app.use((req, res, next) => {
  // console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// CORS 설정 (더 구체적으로)
app.use(cors({
  origin: true, // 모든 origin 허용 (개발 환경)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control']
}));
app.use(express.json());

// Google Sheets API configuration
const SPREADSHEET_ID = process.env.SHEET_ID;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// 필수 환경 변수 검증
if (!SPREADSHEET_ID) {
  console.error('SHEET_ID is not defined in environment variables');
  process.exit(1);
}

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not defined in environment variables');
  process.exit(1);
}

if (!GOOGLE_PRIVATE_KEY) {
  console.error('GOOGLE_PRIVATE_KEY is not defined in environment variables');
  process.exit(1);
}

// 시트 이름 설정
const INVENTORY_SHEET_NAME = '폰클재고데이터';
const STORE_SHEET_NAME = '폰클출고처데이터';
const PLAN_SHEET_NAME = '무선요금제군';  // 무선요금제군 시트 추가
const AGENT_SHEET_NAME = '대리점아이디관리';  // 대리점 아이디 관리 시트 추가
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';  // 당월 개통실적 데이터
const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터(전월)';  // 전월 개통실적 데이터
const UPDATE_SHEET_NAME = '어플업데이트';  // 업데이트 내용 관리 시트 추가
const MANUAL_DATA_SHEET_NAME = '수기초';  // 수기초 데이터
const INSPECTION_RESULT_SHEET_NAME = '검수결과';  // 검수 결과 데이터
const SMS_SHEET_NAME = 'SMS관리';  // SMS 수신 데이터
const SMS_RULES_SHEET_NAME = 'SMS전달규칙';  // SMS 전달 규칙
const SMS_HISTORY_SHEET_NAME = 'SMS전달이력';  // SMS 전달 이력
const SMS_AUTO_REPLY_RULES_SHEET_NAME = 'SMS자동응답규칙';  // SMS 자동응답 규칙
const SMS_AUTO_REPLY_CONTACTS_SHEET_NAME = 'SMS자동응답거래처';  // SMS 자동응답 거래처
const SMS_AUTO_REPLY_HISTORY_SHEET_NAME = 'SMS자동응답이력';  // SMS 자동응답 이력

// 단가표 시트 ID (Phase 2에서 사용)
const PRICE_SHEET_IDS = {
  SUPPORT: '12Jx-Y2EXGjsIulWvw9Cr4kVOZQwQPdBQtIRi90rUTJc',      // 이통사지원금
  PLAN_GROUP: '1vw5BzmtS7vvDqbrWJcqvqwEW63NV2SzQgf9Bt9NExm0',   // 요금제그룹핑
  MOBILE_PRICE: '1Vy8Qhce3B6_41TxRfVUs883ioLxiGTUjkbD_nKebgrs',  // 무선공지용단가표
  MOBILE_GSB: '1NrWlDCtvsm8szOwrn505L8f8rhMvAfoVhwwE-loWzqU',   // 무선(GSB)
  MOBILE_GSA: '1fFDdnmb_kROHzNnGqE6yIgBUkxipHdaFZPqO1_Lon8I',   // 무선(GSA)
  MOBILE_S: '1zqhmIn9_nyPr2Ar-S4EBjw3ojahcz9csObu9zDHoKgE',     // 무선(S)
  MOBILE_DIRECT: '1PZJTaVf9ezRHVYyEbIAvQZ-kpXKMJyexTMcWtcs7z2k', // 무선(직영)
  MOBILE_L: '1aqz-Q3rwE_s0rMWEyeYNhIpEE3V1KXBj3Dw9USiTqAc',     // 무선(L)
  MOBILE_BK: '1I3Jzq0O5-8u8PzCmGvCuXUcqieSROOYUlZjxg8k0Uio',    // 무선(BK)
  WIRE_PRICE: '1d0DgeCBL80PCTBkdArFAbQpAe_oPGqkzOVQ-fp_oUTI'    // 유선공지용단가표
};

const NORMALIZATION_HISTORY_SHEET_NAME = '정규화이력';  // 정규화 이력 데이터
const INSPECTION_MEMO_SHEET_NAME = '여직원검수데이터메모';  // 여직원 검수 데이터 메모 시트 추가
const INSPECTION_SETTINGS_SHEET_NAME = '검수설정';  // 검수 설정 시트
const RESERVATION_SITE_SHEET_NAME = '사전예약사이트';  // 사전예약사이트 시트
const YARD_RECEIPT_SHEET_NAME = '마당접수';  // 마당접수 시트
const ON_SALE_SHEET_NAME = '온세일';  // 온세일 시트
const POS_CODE_MAPPING_SHEET_NAME = 'POS코드변경설정';  // POS코드변경설정 시트
const NORMALIZATION_WORK_SHEET_NAME = '정규화작업';
const SUBSCRIBER_INCREASE_SHEET_NAME = '가입자증감';  // 가입자증감 시트  // 정규화작업 시트

// 월간시상 관련 시트 이름 추가
const PHONEKL_HOME_DATA_SHEET_NAME = '폰클홈데이터';  // 폰클홈데이터 시트
const MONTHLY_AWARD_SETTINGS_SHEET_NAME = '장표모드셋팅메뉴';  // 월간시상 셋팅 메뉴 시트

// 사용자 권한 조회 함수
async function getUserRole(userId) {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${AGENT_SHEET_NAME}!A:R`
    });
    
    const agentValues = response.data.values || [];
    if (agentValues.length > 1) {
      const agentRows = agentValues.slice(1);
      const match = agentRows.find(row => row[2] === userId); // C열: 연락처(아이디)
      if (match) {
        return (match[17] || '').trim(); // R열: 권한레벨
      }
    }
    return null;
  } catch (error) {
    console.error('사용자 권한 조회 실패:', error.message);
    return null;
  }
}

// Kakao geocoding 함수 (개선된 버전)
async function geocodeAddressWithKakao(address, retryCount = 0) {
  const apiKey = process.env.KAKAO_API_KEY;
  if (!apiKey) {
    console.error('❌ [지오코딩] KAKAO_API_KEY 환경변수가 설정되어 있지 않습니다.');
    throw new Error('KAKAO_API_KEY 환경변수가 설정되어 있지 않습니다.');
  }
  
  // 주소 전처리
  const cleanAddress = address.toString().trim();
  if (!cleanAddress) {
    return null;
  }
  
  // 주소에 "시" 또는 "구"가 포함되어 있지 않으면 기본 지역 추가
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
      },
      timeout: 10000 // 10초 타임아웃
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        // 할당량 초과
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (retryCount < 2) {
          return await geocodeAddressWithKakao(address, retryCount + 1);
        }
      }
      throw new Error(`Kakao geocoding API 오류: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      const result = {
        latitude: parseFloat(doc.y),
        longitude: parseFloat(doc.x)
      };
      return result;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Geocoding 오류 (${retryCount + 1}/3): ${processedAddress}`, error.message);
    
    // 네트워크 오류나 일시적 오류인 경우 재시도
    if (retryCount < 2 && (error.message.includes('fetch') || error.message.includes('timeout'))) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // 지수 백오프
      return await geocodeAddressWithKakao(address, retryCount + 1);
    }
    
    throw error;
  }
}

// 메인 geocoding 함수 (Kakao만 사용)
async function geocodeAddress(address) {
  return await geocodeAddressWithKakao(address);
}

// Geocoder 설정 (기존 코드와 호환성을 위해 유지)
const geocoder = {
  geocode: async (address) => {
    const result = await geocodeAddress(address);
    return result ? [result] : [];
  }
};

// Google API 인증 설정
const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// 원본 Google Sheets API 초기화 (타임아웃 설정 포함)
const originalSheets = google.sheets({ 
  version: 'v4', 
  auth,
  timeout: 60000 // 60초 타임아웃
});

// UserSheetManager 및 PhoneklDataManager 인스턴스 생성
const userSheetManager = new UserSheetManager(originalSheets, SPREADSHEET_ID);
const phoneklDataManager = new PhoneklDataManager(originalSheets, SPREADSHEET_ID);

// 모든 API 호출을 추적하는 래퍼 함수 (로그 최적화)
function createTrackedSheets() {
  return {
    spreadsheets: {
      values: {
        get: async (params) => {
          // 로그 최소화 - 성능 최적화
          // const timestamp = new Date().toISOString();
          // console.log(`🚨 [API-TRACE] GET 시작: ${timestamp} - Range: ${params.range}`);
          const result = await originalSheets.spreadsheets.values.get(params);
          // console.log(`🚨 [API-TRACE] GET 완료: ${new Date().toISOString()} - Range: ${params.range}`);
          return result;
        },
        update: async (params) => {
          // 로그 최소화 - 성능 최적화
          // const timestamp = new Date().toISOString();
          // console.log(`🚨 [API-TRACE] UPDATE 시작: ${timestamp} - Range: ${params.range}`);
          const result = await originalSheets.spreadsheets.values.update(params);
          // console.log(`🚨 [API-TRACE] UPDATE 완료: ${new Date().toISOString()} - Range: ${params.range}`);
          return result;
        },
        append: async (params) => {
          // 로그 최소화 - 성능 최적화
          // const timestamp = new Date().toISOString();
          // console.log(`🚨 [API-TRACE] APPEND 시작: ${timestamp} - Range: ${params.range}`);
          const result = await originalSheets.spreadsheets.values.append(params);
          // console.log(`🚨 [API-TRACE] APPEND 완료: ${new Date().toISOString()} - Range: ${params.range}`);
          return result;
        },
        batchUpdate: async (params) => {
          // 로그 최소화 - 성능 최적화
          // const timestamp = new Date().toISOString();
          // console.log(`🚨 [API-TRACE] BATCH_UPDATE 시작: ${timestamp} - SpreadsheetId: ${params.spreadsheetId}`);
          const result = await originalSheets.spreadsheets.values.batchUpdate(params);
          // console.log(`🚨 [API-TRACE] BATCH_UPDATE 완료: ${new Date().toISOString()} - SpreadsheetId: ${params.spreadsheetId}`);
          return result;
        }
      },
      get: async (params) => {
        return await originalSheets.spreadsheets.get(params);
      },
      batchUpdate: async (params) => {
        // 로그 최소화 - 성능 최적화
        // const timestamp = new Date().toISOString();
        // console.log(`🚨 [API-TRACE] SPREADSHEET_BATCH_UPDATE 시작: ${timestamp} - SpreadsheetId: ${params.spreadsheetId}`);
        const result = await originalSheets.spreadsheets.batchUpdate(params);
        // console.log(`🚨 [API-TRACE] SPREADSHEET_BATCH_UPDATE 완료: ${new Date().toISOString()} - SpreadsheetId: ${params.spreadsheetId}`);
        return result;
      }
    }
  };
}

const sheets = createTrackedSheets();

// 데이터 시트에서 값 가져오기 (캐싱 적용)
async function getSheetValues(sheetName, spreadsheetId = SPREADSHEET_ID) {
  const cacheKey = `sheet_${sheetName}_${spreadsheetId}`;
  
  // 캐시에서 먼저 확인
  const cachedData = cacheUtils.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  return await fetchSheetValuesDirectly(sheetName, spreadsheetId);
}

// 폰클개통데이터 캐시 무효화 함수
function invalidatePhoneklActivationCache() {
  const cacheKey = `sheet_폰클개통데이터_${SPREADSHEET_ID}`;
  cacheUtils.delete(cacheKey);
  console.log('🗑️ [캐시 무효화] 폰클개통데이터 캐시 삭제됨');
}

// 캐시를 무시하고 직접 시트에서 데이터를 가져오는 함수
async function getSheetValuesWithoutCache(sheetName) {
  try {
    // 시트 이름을 안전하게 처리
    const safeSheetName = `'${sheetName}'`; // 작은따옴표로 감싸서 특수문자 처리
    
    // raw데이터 시트는 A:AB 범위 필요 (AB열까지), 폰클개통데이터는 A:BZ 범위 필요 (BZ열까지), 정책_기본정보는 A:AC 범위 필요 (AC열까지), 나머지는 A:AA 범위
    let range;
    if (sheetName === 'raw데이터') {
      range = `${safeSheetName}!A:AB`;
    } else if (sheetName === '폰클개통데이터') {
      range = `${safeSheetName}!A:BZ`;
    } else if (sheetName === '폰클홈데이터') {
      range = `${safeSheetName}!A:CN`;
    } else if (sheetName === '정책_기본정보 ') {
      range = `${safeSheetName}!A:AX`;  // 담당자 AX열까지 확장
    } else {
      range = `${safeSheetName}!A:AA`;
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range
    });
    
    const data = response.data.values || [];
    
    // 폰클개통데이터의 경우 캐시에 저장 (5분 TTL)
    if (sheetName === '폰클개통데이터') {
      const cacheKey = `sheet_${sheetName}_${SPREADSHEET_ID}`;
      cacheUtils.set(cacheKey, data, 5 * 60);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching sheet ${sheetName} without cache:`, error);
    throw error;
  }
}

// 시트에서 직접 데이터를 가져오는 공통 함수
async function fetchSheetValuesDirectly(sheetName, spreadsheetId = SPREADSHEET_ID) {
  
  try {
    // API 호출 제한 확인
    if (!rateLimitUtils.canMakeRequest()) {
      const waitTime = rateLimitUtils.getWaitTime();
      console.log(`⏳ [API-LIMIT] API 호출 제한됨. ${Math.ceil(waitTime/1000)}초 대기 중...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // API 호출 기록
    rateLimitUtils.recordRequest();
    
    // 시트 이름을 안전하게 처리
    const safeSheetName = `'${sheetName}'`; // 작은따옴표로 감싸서 특수문자 처리
    
    // raw데이터 시트는 A:AB 범위 필요 (AB열까지), 폰클개통데이터는 A:BZ 범위 필요 (BZ열까지), 나머지는 A:AA 범위
    let range;
    if (sheetName === 'raw데이터') {
      range = `${safeSheetName}!A:AB`;
    } else if (sheetName === '폰클개통데이터') {
      range = `${safeSheetName}!A:BZ`;
    } else if (sheetName === '폰클홈데이터') {
      range = `${safeSheetName}!A:CN`;
    } else {
      range = `${safeSheetName}!A:AA`;
    }
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range
    });
    
    const data = response.data.values || [];
    
    return data;
  } catch (error) {
    // 429 에러 (Rate Limit) 처리 - Exponential Backoff
    if (error.code === 429 || error.message?.includes('rateLimitExceeded')) {
      console.log(`⚠️ [API-LIMIT] Google API 할당량 초과 (429). 60초 대기 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, 60000)); // 60초 대기
      
      // 재시도
      try {
        const retryResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: range
        });
        return retryResponse.data.values || [];
      } catch (retryError) {
        console.error(`❌ [API-LIMIT] 재시도 실패:`, retryError);
        throw retryError;
      }
    }
    
    console.error(`Error fetching sheet ${sheetName}:`, error);
    
    // 첫 번째 시도가 실패하면 시트 목록을 가져와서 정확한 이름 확인
    try {
      console.log(`🔄 [시트조회] 시트 목록 확인 중...`);
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      const sheetNames = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
      console.log(`📋 [시트조회] 사용 가능한 시트:`, sheetNames);
      
      // 정확한 시트 이름 찾기
      const exactSheetName = sheetNames.find(name => name === sheetName);
      if (exactSheetName) {
        console.log(`✅ [시트조회] 정확한 시트 이름 발견: '${exactSheetName}'`);
        const safeSheetName = `'${exactSheetName}'`;
        
        // raw데이터 시트는 A:AB 범위 필요 (AB열까지), 나머지는 A:AA 범위
        const retryRange = sheetName === 'raw데이터' ? `${safeSheetName}!A:AB` : `${safeSheetName}!A:AA`;
        
        const retryResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: retryRange
        });
        
        const data = retryResponse.data.values || [];
        return data;
      } else {
        console.error(`❌ [시트조회] 시트 '${sheetName}'을 찾을 수 없습니다.`);
        throw new Error(`Sheet '${sheetName}' not found. Available sheets: ${sheetNames.join(', ')}`);
      }
    } catch (retryError) {
      console.error(`❌ [시트조회] 재시도 실패:`, retryError);
      throw error; // 원래 오류를 다시 던짐
    }
  }
}

// VLOOKUP 함수 (폰클출고처데이터에서 POS코드로 업체명 찾기)
function vlookupPosCodeToStoreName(posCode, storeData) {
  if (!posCode || !storeData || storeData.length === 0) {
    return null;
  }
  
  const searchPosCode = posCode.toString().trim();
  
  // P열(POS코드)에서 검색하여 O열(업체명) 반환
  for (let i = 1; i < storeData.length; i++) { // 헤더 제외하고 검색
    const row = storeData[i];
    if (row && row.length > 14) { // 최소 P열(14)은 있어야 함
      const storePosCode = (row[14] || '').toString().trim(); // P열: POS코드
      if (storePosCode === searchPosCode) {
        return (row[13] || '').toString().trim(); // O열: 업체명
      }
    }
  }
  
  return null;
}

// VLOOKUP 함수 (폰클출고처데이터에서 업체명으로 POS코드 찾기)
function vlookupStoreNameToPosCode(storeName, storeData) {
  if (!storeName || !storeData || storeData.length === 0) {
    return null;
  }
  
  const searchStoreName = storeName.toString().trim();
  
  // O열(업체명)에서 검색하여 P열(POS코드) 반환
  for (let i = 1; i < storeData.length; i++) { // 헤더 제외하고 검색
    const row = storeData[i];
    if (row && row.length > 14) { // 최소 P열(14)은 있어야 함
      const rowStoreName = (row[13] || '').toString().trim(); // O열: 업체명
      if (rowStoreName === searchStoreName) {
        return (row[14] || '').toString().trim(); // P열: POS코드
      }
    }
  }
  
  return null;
}

// 여직원검수데이터메모 시트 관리 함수들
async function loadInspectionMemoData() {
  try {
    const memoData = await getSheetValues(INSPECTION_MEMO_SHEET_NAME);
    if (!memoData || memoData.length <= 1) {
      return { completionStatus: new Map(), notes: new Map() };
    }
    
    const completionStatus = new Map();
    const notes = new Map();
    
    // 헤더 제외하고 데이터 처리 (새로운 구조: 고유키, 가입번호, 사용자ID, 완료상태, 메모내용, 업데이트시간, 필드구분)
    for (let i = 1; i < memoData.length; i++) {
      const row = memoData[i];
      if (row && row.length >= 7) {
        const uniqueKey = (row[0] || '').toString().trim(); // A열: 고유키
        const subscriptionNumber = (row[1] || '').toString().trim(); // B열: 가입번호
        const userId = (row[2] || '').toString().trim(); // C열: 사용자ID
        const isCompleted = (row[3] || '').toString().trim() === '완료'; // D열: 완료상태
        const memoContent = (row[4] || '').toString().trim(); // E열: 메모내용
        const updateTime = (row[5] || '').toString().trim(); // F열: 업데이트시간
        const fieldType = (row[6] || '').toString().trim(); // G열: 필드구분
        
        if (uniqueKey && userId) {
          // 완료상태 저장 (완료와 대기 모두 처리)
          completionStatus.set(uniqueKey, {
              userId,
            isCompleted: isCompleted,  // true 또는 false
              timestamp: updateTime || new Date().toISOString()
            });
          
          // 메모내용 저장 (빈 문자열도 포함)
          notes.set(uniqueKey, {
              userId,
            notes: memoContent || '',  // 빈 문자열도 저장
              timestamp: updateTime || new Date().toISOString()
            });
        }
      }
    }
    
    return { completionStatus, notes };
  } catch (error) {
    console.error('여직원검수데이터메모 시트 로드 실패:', error);
    return { completionStatus: new Map(), notes: new Map() };
  }
}

async function saveInspectionMemoData(completionStatus, notes) {
  try {
    const headerRow = ['고유키', '가입번호', '사용자ID', '완료상태', '메모내용', '업데이트시간', '필드구분'];
    
    // 최종 데이터 행 생성 (완료 상태와 대기 상태 모두 처리)
    const finalDataRows = [];
    
    // 모든 상태의 항목들 처리
    for (const [uniqueKey, status] of completionStatus) {
      // 메모 내용 가져오기
      const noteData = notes.get(uniqueKey);
      const memoContent = noteData ? noteData.notes : '';
      
      // 고유키에서 가입번호 추출
      const subscriptionNumber = uniqueKey.split('_')[0];
      
      // 상태에 따른 완료상태 텍스트 결정
      const statusText = status.isCompleted ? '완료' : '대기';
      
      // 행 데이터 생성
      const rowData = [
        uniqueKey,                    // 고유키
        subscriptionNumber,           // 가입번호
        status.userId,               // 사용자ID
        statusText,                   // 완료상태 (완료/대기)
        memoContent,                  // 메모내용
        status.timestamp,             // 업데이트시간
        '전체'                        // 필드구분
      ];
      
      finalDataRows.push(rowData);
    }
    
    // 시트 업데이트 (완료 상태인 항목만)
    if (finalDataRows.length > 0) {
      await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headerRow, ...finalDataRows]
        }
      });
      console.log(`여직원검수데이터메모 시트 업데이트 완료: ${finalDataRows.length}개 행`);
    } else {
      // 데이터가 없는 경우 헤더만 유지
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headerRow]
        }
      });
      console.log('여직원검수데이터메모 시트 헤더만 유지');
    }
    
    // 🔍 디버깅: 현재 상태 로그
    console.log('🔍 [saveInspectionMemoData] 현재 상태:', {
      completionStatusSize: completionStatus.size,
      notesSize: notes.size,
      finalDataRowsCount: finalDataRows.length,
      completionStatusKeys: Array.from(completionStatus.keys()),
      notesKeys: Array.from(notes.keys())
    });

  } catch (error) {
    console.error('여직원검수데이터메모 시트 저장 실패:', error);
  }
}

async function cleanupInspectionMemoData(currentInspectionKeys) {
  try {
    const memoData = await getSheetValues(INSPECTION_MEMO_SHEET_NAME);
    if (!memoData || memoData.length <= 1) {
      return;
    }
    
    // 현재 검수 대상에 있는 고유키만 필터링
    const validRows = [memoData[0]]; // 헤더 유지
    
    for (let i = 1; i < memoData.length; i++) {
      const row = memoData[i];
      if (row && row.length > 0) {
        const uniqueKey = (row[0] || '').toString().trim();
        if (uniqueKey && currentInspectionKeys.has(uniqueKey)) {
          validRows.push(row);
        }
      }
    }
    
    // 시트 업데이트 (유효한 데이터만 유지)
    if (validRows.length > 1) { // 헤더 외에 데이터가 있는 경우
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: validRows
        }
      });
    } else {
      // 데이터가 없는 경우 헤더만 유지
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [memoData[0]]
        }
      });
    }

  } catch (error) {
    console.error('여직원검수데이터메모 시트 정리 실패:', error);
  }
}

// 요금제 VLOOKUP 함수들
function vlookupPlanNameToPlanCode(planName, planData) {
  if (!planName || !planData || planData.length === 0) {
    return null;
  }
  
  const searchPlanName = planName.toString().trim();
  
  // N열(요금제명)에서 검색하여 O열(요금제코드) 반환
  for (let i = 1; i < planData.length; i++) { // 헤더 제외하고 검색
    const row = planData[i];
    if (row && row.length > 14) { // 최소 O열(14)은 있어야 함
      const rowPlanName = (row[13] || '').toString().trim(); // N열: 요금제명
      if (rowPlanName === searchPlanName) {
        return (row[14] || '').toString().trim(); // O열: 요금제코드
      }
    }
  }
  
  return null;
}

function vlookupPlanNameToPlanType(planName, planData) {
  if (!planName || !planData || planData.length === 0) {
    return null;
  }
  
  const searchPlanName = planName.toString().trim();
  
  // N열(요금제명)에서 검색하여 U열(요금제구분) 반환
  for (let i = 1; i < planData.length; i++) { // 헤더 제외하고 검색
    const row = planData[i];
    if (row && row.length > 20) { // 최소 U열(20)은 있어야 함
      const rowPlanName = (row[13] || '').toString().trim(); // N열: 요금제명
      if (rowPlanName === searchPlanName) {
        return (row[20] || '').toString().trim(); // U열: 요금제구분
      }
    }
  }
  
  return null;
}

function vlookupPlanCodeToPlanName(planCode, planData) {
  if (!planCode || !planData || planData.length === 0) {
    return null;
  }
  
  const searchPlanCode = planCode.toString().trim();
  
  // O열(요금제코드)에서 검색하여 N열(요금제명) 반환
  for (let i = 1; i < planData.length; i++) { // 헤더 제외하고 검색
    const row = planData[i];
    if (row && row.length > 14) { // 최소 O열(14)은 있어야 함
      const rowPlanCode = (row[14] || '').toString().trim(); // O열: 요금제코드
      if (rowPlanCode === searchPlanCode) {
        return (row[13] || '').toString().trim(); // N열: 요금제명
      }
    }
  }
  
  return null;
}

function vlookupPlanCodeToPlanType(planCode, planData) {
  if (!planCode || !planData || planData.length === 0) {
    return null;
  }
  
  const searchPlanCode = planCode.toString().trim();
  
  // O열(요금제코드)에서 검색하여 U열(요금제구분) 반환
  for (let i = 1; i < planData.length; i++) { // 헤더 제외하고 검색
    const row = planData[i];
    if (row && row.length > 20) { // 최소 U열(20)은 있어야 함
      const rowPlanCode = (row[14] || '').toString().trim(); // O열: 요금제코드
      if (rowPlanCode === searchPlanCode) {
        return (row[20] || '').toString().trim(); // U열: 요금제구분
      }
    }
  }
  
  return null;
}

// Discord로 로그 메시지 전송 함수
async function sendLogToDiscord(embedData) {
  // 필요한 설정이 없으면 로깅 안함
  if (!DISCORD_LOGGING_ENABLED) {
    // console.log('Discord 로깅이 비활성화되었습니다.');
    return;
  }

  // 봇 객체가 초기화되지 않은 경우
  if (!discordBot || !EmbedBuilder) {
    // console.log('Discord 봇이 초기화되지 않았습니다. 로그를 전송할 수 없습니다.');
    return;
  }

  try {
    // 봇이 연결되었는지 확인
    if (!discordBot.isReady()) {
      // console.log('Discord 봇이 아직 준비되지 않았습니다. 메시지를 보낼 수 없습니다.');
      return;
    }

    // 사용자 유형에 따라 채널 ID 결정
    const userType = embedData.userType || 'store'; // 기본값은 일반 매장
    let channelId = DISCORD_CHANNEL_ID; // 기본 채널
    
    if (userType === 'agent') {
      channelId = DISCORD_AGENT_CHANNEL_ID;
      // console.log('관리자 로그 전송 - 채널 ID:', channelId);
    } else {
      channelId = DISCORD_STORE_CHANNEL_ID;
      // console.log('일반 매장 로그 전송 - 채널 ID:', channelId);
    }
    
    // 채널 ID가 없으면 로깅 중단
    if (!channelId) {
      // console.log(`${userType} 유형의 Discord 채널 ID가 설정되지 않았습니다.`);
      return;
    }

    // console.log('Discord 채널에 메시지 전송 시도...');
    // console.log('Discord 채널 ID:', channelId);
    
    // 채널 가져오기 시도
    let channel = null;
    try {
      channel = await discordBot.channels.fetch(channelId);
    } catch (channelError) {
      console.error(`채널 ID ${channelId} 가져오기 실패:`, channelError.message);
      console.error('전체 오류:', channelError);
      return;
    }
    
    if (!channel) {
      console.error(`채널을 찾을 수 없습니다: ${channelId}`);
      return;
    }

            // console.log(`채널 찾음: ${channel.name} (${channel.id}), 메시지 전송 중...`);
    
    try {
      // EmbedBuilder 생성
      const embed = new EmbedBuilder()
        .setTitle(embedData.title || '알림')
        .setColor(embedData.color || 0x0099FF);
      
      // Fields 추가
      if (embedData.fields && Array.isArray(embedData.fields)) {
        embed.addFields(...embedData.fields);
      }
      
      // 타임스탬프 설정
      if (embedData.timestamp) {
        embed.setTimestamp(new Date(embedData.timestamp));
      } else {
        embed.setTimestamp();
      }
      
      // Footer 설정
      if (embedData.footer && embedData.footer.text) {
        embed.setFooter({ text: embedData.footer.text });
      }
      
      // 메시지 전송 시도
      const sentMessage = await channel.send({ embeds: [embed] });
              // console.log(`Discord 메시지 전송 성공! 메시지 ID: ${sentMessage.id}`);
      return true;
    } catch (embedError) {
      console.error('Embed 생성 또는 전송 중 오류:', embedError.message);
      console.error('자세한 오류 정보:', embedError);
      return false;
    }
  } catch (error) {
    console.error('Discord 로그 전송 중 오류:', error.message);
    console.error('자세한 오류 정보:', error);
    return false;
  }
}

// 서버 상태 확인용 엔드포인트
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    cache: cacheUtils.status(),
    env: {
      SHEET_ID: SPREADSHEET_ID ? 'SET' : 'NOT SET',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET',
      GOOGLE_PRIVATE_KEY: GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET',
      PORT: process.env.PORT || 4000
    }
  });
});

// 서버 버전 정보 엔드포인트
app.get('/api/version', (req, res) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    buildTime: Date.now().toString(),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 캐시 상태 확인용 엔드포인트
app.get('/api/cache-status', (req, res) => {
  res.json({
    status: 'success',
    cache: cacheUtils.status(),
    timestamp: new Date().toISOString()
  });
});

// 캐시 강제 새로고침 엔드포인트
app.post('/api/cache-refresh', (req, res) => {
  const { sheet } = req.body;
  
  if (sheet) {
    // 특정 시트 캐시만 삭제
    cacheUtils.delete(`sheet_${sheet}`);
    res.json({
      status: 'success',
      message: `캐시 새로고침 완료: ${sheet}`,
      timestamp: new Date().toISOString()
    });
  } else {
    // 전체 캐시 정리
    cacheUtils.cleanup();
    res.json({
      status: 'success',
      message: '전체 캐시 새로고침 완료',
      timestamp: new Date().toISOString()
    });
  }
});

// 주소를 위도/경도로 변환하여 시트에 업데이트
app.post('/api/update-coordinates', async (req, res) => {
  try {
    // console.log('Updating coordinates...');
    
    const storeValues = await getSheetValues(STORE_SHEET_NAME);
    if (!storeValues) {
      throw new Error('Failed to fetch data from store sheet');
    }

    // 헤더 제거
    const storeRows = storeValues.slice(1);
    const updates = [];

    for (let i = 0; i < storeRows.length; i++) {
      const row = storeRows[i];
      const address = row[11];  // L열: 주소 (8칸 밀림)
      const status = row[12];    // M열: 거래상태 (8칸 밀림)
      
      if (status === "사용") {
        if (!address || address.toString().trim() === '') {
          // 사용 상태이지만 주소가 없는 경우 좌표 삭제
          updates.push({
            range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
            values: [["", ""]]
          });
          // console.log(`Cleared coordinates for store without address at row ${i + 2}`);
          continue;
        }
        
        // 주소가 있는 경우 geocoding 실행
        try {
          // console.log(`\n=== 좌표 업데이트 시작: ${address} ===`);
          const result = await geocodeAddress(address);
          if (result) {
            const { latitude, longitude } = result;
            updates.push({
              range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
              values: [[latitude, longitude]]
            });
                          // console.log(`✅ 좌표 업데이트 성공: ${address}`);
              // console.log(`📍 위도: ${latitude}, 경도: ${longitude}`);
          } else {
                          // console.log(`❌ Geocoding 결과 없음: ${address}`);
            // geocoding 실패 시 기존 좌표 유지 (삭제하지 않음)
            // console.log(`⚠️ 기존 좌표 유지 (삭제하지 않음): ${address}`);
          }
        } catch (error) {
          console.error(`❌ Geocoding 오류: ${address}`, error.message);
          // geocoding 오류 시 기존 좌표 유지 (삭제하지 않음)
          // console.log(`⚠️ 기존 좌표 유지 (삭제하지 않음): ${address}`);
        }
      } else {
        // 미사용 매장은 위도/경도 값을 빈 값으로 비움
        updates.push({
          range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
          values: [["", ""]]
        });
        // console.log(`Cleared coordinates for unused store at row ${i + 2}`);
      }
      // API 할당량 제한을 피하기 위한 지연 (사용 매장만)
      if (status === "사용") await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 일괄 업데이트 실행
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      // console.log(`Successfully updated ${updates.length} coordinates`);
    } else {
      // console.log('No coordinates to update');
    }

    res.json({ 
      success: true, 
      message: `Updated coordinates for ${updates.length} addresses` 
    });
  } catch (error) {
    console.error('Error updating coordinates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update coordinates', 
      message: error.message 
    });
  }
});

// 판매점정보 시트의 주소를 위도/경도로 변환하여 업데이트
app.post('/api/update-sales-coordinates', async (req, res) => {
  try {
    console.log('Updating sales coordinates...');
    
    // 새로운 구글 시트 ID 확인
    const SALES_SPREADSHEET_ID = process.env.SALES_SHEET_ID;
    if (!SALES_SPREADSHEET_ID) {
      throw new Error('SALES_SHEET_ID 환경변수가 설정되어 있지 않습니다.');
    }
    
    const SALES_SHEET_NAME = '판매점정보';
    const salesValues = await getSheetValues(SALES_SHEET_NAME, SALES_SPREADSHEET_ID);
    if (!salesValues) {
      throw new Error('Failed to fetch data from sales sheet');
    }

    // 헤더 제거 (2행부터 시작)
    const salesRows = salesValues.slice(1);
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < salesRows.length; i++) {
      const row = salesRows[i];
      const address = row[7];  // H열: 주소
      const existingLat = row[5]; // F열: 기존 위도
      const existingLng = row[6]; // G열: 기존 경도
      
      // 주소가 없거나 '주소확인필요'인 경우 건너뛰기
      if (!address || address.toString().trim() === '' || address.toString().trim() === '주소확인필요') {
        continue;
      }
      
      processedCount++;
      
      // 기존 좌표가 모두 존재하면 지오코딩 생략
      if (existingLat && existingLng) {
        skippedCount++;
        continue;
      }

      // 주소 해시 비교 (변경 감지) - 좌표가 없을 경우에만 적용
      const addressHash = createHash(address.toString().trim());
      const existingAddressHash = createHash('');

      // 좌표가 없는 경우에만 지오코딩 실행
      if (addressHash !== existingAddressHash) {
        try {
          console.log(`\n=== 좌표 업데이트 시작: ${address} ===`);
          const result = await geocodeAddress(address);
          if (result) {
            const { latitude, longitude } = result;
            
            // 개별 업데이트 실행 (즉시 저장)
            await sheets.spreadsheets.values.update({
              spreadsheetId: SALES_SPREADSHEET_ID,
              range: `${SALES_SHEET_NAME}!F${i + 2}:G${i + 2}`,
              valueInputOption: 'USER_ENTERED',
              resource: {
                values: [[latitude, longitude]]
              }
            });
            
            updatedCount++;
            console.log(`✅ 좌표 업데이트 성공: ${address}`);
            console.log(`📍 위도: ${latitude}, 경도: ${longitude}`);
          } else {
            console.log(`❌ Geocoding 결과 없음: ${address}`);
          }
        } catch (error) {
          console.error(`❌ Geocoding 오류: ${address}`, error.message);
        }
        
        // API 할당량 제한을 피하기 위한 지연 (0.2초)
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        console.log(`⏭️ 주소 변경 없음, 건너뛰기: ${address}`);
      }
    }

    console.log(`📊 주소 업데이트 완료 - 처리: ${processedCount}개, 업데이트: ${updatedCount}개, 건너뜀: ${skippedCount}개`);

    res.json({ 
      success: true, 
      message: `Processed ${processedCount} addresses, updated ${updatedCount} coordinates, skipped ${skippedCount}`,
      processed: processedCount,
      updated: updatedCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error('Error updating sales coordinates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update sales coordinates', 
      message: error.message 
    });
  }
});

// 해시 함수 (주소 변경 감지용)
function createHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  return hash.toString();
}

// 스토어 데이터 가져오기 (캐싱 적용)
app.get('/api/stores', async (req, res) => {
  const { includeShipped = 'true' } = req.query; // 쿼리 파라미터로 출고 제외 여부 제어
  const cacheKey = `processed_stores_data_${includeShipped}`;
  
  // 캐시에서 먼저 확인
  const cachedStores = cacheUtils.get(cacheKey);
  if (cachedStores) {
    return res.json(cachedStores);
  }
  
  try {
    const startTime = Date.now();
    
    const [inventoryValues, storeValues] = await Promise.all([
      getSheetValues(INVENTORY_SHEET_NAME),
      getSheetValues(STORE_SHEET_NAME)
    ]);
    
    if (!inventoryValues || !storeValues) {
      throw new Error('Failed to fetch data from sheets');
    }

    // 헤더 제거 (첫 3행은 제외)
    const inventoryRows = inventoryValues.slice(3);
    const storeRows = storeValues.slice(1);

    // 출고 제외 로직 (includeShipped가 'false'일 때만 적용)
    let threeDaysAgo = null;
    if (includeShipped === 'false') {
      const today = new Date();
      threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
    }

    // 매장별 재고 데이터 매핑
    const inventoryMap = {};
    let excludedCount = 0; // 제외된 재고 카운터
    
    inventoryRows.forEach((row, index) => {
      if (!row || row.length < 23) return; // 최소 O열까지 데이터가 있어야 함 (15+8)
      
      const storeName = (row[21] || '').toString().trim();  // N열: 매장명 (13+8)
      let cleanStoreName = storeName;
      
      // 모든 매장(사무실 포함)은 원래 이름 그대로 유지
      cleanStoreName = storeName;
      const model = (row[13] || '').toString().trim();      // F열: 모델 (5+8)
      const color = (row[14] || '').toString().trim();      // G열: 색상 (6+8)
      const status = (row[15] || '').toString().trim();     // H열: 상태 (7+8)
      const type = (row[12] || '').toString().trim();       // E열: 종류 (4+8)
      const shippingDate = row[22] ? new Date(row[22]) : null;  // O열: 출고일 (14+8)
      
      if (!storeName || !model || !color) return;

      // 출고일이 있고, 최근 3일 이내인 경우 재고에서 제외 (includeShipped가 'false'일 때만)
      if (includeShipped === 'false' && shippingDate && threeDaysAgo && shippingDate >= threeDaysAgo) {
        excludedCount++;
        return;
      }

      // 매장별 재고 데이터 구조 생성 (정리된 이름으로 매핑)
      if (!inventoryMap[cleanStoreName]) {
        inventoryMap[cleanStoreName] = {
          phones: {},    // 단말기
          sims: {},      // 유심
          wearables: {}, // 웨어러블
          smartDevices: {} // 스마트기기
        };
      }
      
      // 종류에 따라 분류
      let category = 'phones'; // 기본값
      if (type === '유심') {
        category = 'sims';
      } else if (type === '웨어러블') {
        category = 'wearables';
      } else if (type === '스마트기기') {
        category = 'smartDevices';
      }
      
      if (!inventoryMap[cleanStoreName][category][model]) {
        inventoryMap[cleanStoreName][category][model] = {};
      }
      
      // 상태별로 수량 관리
      if (!inventoryMap[cleanStoreName][category][model][status]) {
        inventoryMap[cleanStoreName][category][model][status] = {};
      }
      
      // 같은 모델/색상/상태 조합의 수량과 출고일 정보 관리
      if (!inventoryMap[cleanStoreName][category][model][status][color]) {
        inventoryMap[cleanStoreName][category][model][status][color] = {
          quantity: 1,
          shippedDate: shippingDate ? shippingDate.toISOString() : null
        };
      } else {
        inventoryMap[cleanStoreName][category][model][status][color].quantity++;
        // 출고일이 더 오래된 것으로 업데이트 (가장 오래된 재고 기준)
        if (shippingDate && (!inventoryMap[cleanStoreName][category][model][status][color].shippedDate || 
            shippingDate < new Date(inventoryMap[cleanStoreName][category][model][status][color].shippedDate))) {
          inventoryMap[cleanStoreName][category][model][status][color].shippedDate = shippingDate.toISOString();
        }
      }
    });

    // 매장 정보와 재고 정보 결합
    const stores = storeRows
      .filter(row => {
        const name = (row[14] || '').toString().trim();  // G열: 업체명 (6+8)
        const status = row[12];                          // M열: 거래상태 (12번째 컬럼)
        return name && status === "사용";
      })
      .map(row => {
        const latitude = parseFloat(row[8] || '0');    // I열: 위도 (8번째 컬럼)
        const longitude = parseFloat(row[9] || '0');   // J열: 경도 (9번째 컬럼)
        const status = row[12];                         // M열: 거래상태 (12번째 컬럼)
        const name = row[14].toString().trim();        // G열: 업체명 (6+8)
        const storeId = row[15];                        // H열: 매장 ID (7+8)
        const phone = row[17] || '';                    // R열: 연락처 (17번째 컬럼)
        const storePhone = row[22] || '';               // W열: 매장연락처 (22번째 컬럼)
        const manager = row[21] || '';                  // V열: 담당자 (21번째 컬럼)
        const address = (row[11] || '').toString();    // L열: 주소 (11번째 컬럼)
        
        // 빈 매장 ID 제외
        if (!storeId || storeId.toString().trim() === '') {
          return null;
        }

        // 모든 매장(사무실 포함)은 원래 이름 그대로 유지
        const inventory = inventoryMap[name] || {};

        return {
          id: storeId.toString(),
          name: name, // 원래 이름 그대로 사용
          address,
          phone,
          storePhone,
          manager,
          latitude,
          longitude,
          uniqueId: `${storeId}_${name}`,
          inventory: inventory
        };
      })
      .filter(store => store !== null); // null 값 제거

    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, stores);
    
    res.json(stores);
  } catch (error) {
    console.error('Error fetching store data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch store data', 
      message: error.message 
    });
  }
});

// 영업 모드 데이터 가져오기 (캐싱 적용)
app.get('/api/sales-data', async (req, res) => {
  // CORS 헤더 명시적 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  const cacheKey = 'sales_data';
  
  // 캐시에서 먼저 확인
  const cachedSalesData = cacheUtils.get(cacheKey);
  if (cachedSalesData) {
    // 로그 최소화 (성능 최적화)
    // console.log('📦 [SALES] 캐시에서 데이터 반환 (트래픽 절약)');
    return res.json(cachedSalesData);
  }
  
  try {
    // 동시 요청 제한 적용
    const result = await withConcurrencyLimit(async () => {
      // 로그 최소화 (성능 최적화)
      // console.log(`🔄 [SALES] 동시 요청 처리 중... (현재: ${concurrentRequestLimit.currentRequests}/${concurrentRequestLimit.maxConcurrent})`);
      return await processSalesData();
    });
    
    // 결과 검증
    if (!result || !result.success) {
      throw new Error('영업 데이터 처리 결과가 유효하지 않습니다.');
    }
    
    // 캐시에 저장 (6시간 TTL)
    cacheUtils.set(cacheKey, result, 6 * 60 * 60 * 1000);
    
    // 로그 최소화 (성능 최적화)
    // console.log(`✅ [SALES] 영업 데이터 로드 완료: ${result.data.salesData.length}개 레코드, ${result.data.summary.totalPosCodes}개 POS코드 (처리시간: ${result.processingTime}ms)`);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching sales data:', error);
    
    // 더 자세한 오류 정보 제공
    const errorResponse = {
      success: false,
      error: 'Failed to fetch sales data',
      message: error.message,
      timestamp: new Date().toISOString(),
      details: {
        hasSalesSheetId: !!process.env.SALES_SHEET_ID,
        salesSheetId: process.env.SALES_SHEET_ID ? 'SET' : 'NOT_SET'
      }
    };
    
    res.status(500).json(errorResponse);
  }
});

// 영업 데이터 미리 로드 함수 (공통 함수 활용 + 메모리 최적화 + 트래픽 최적화 + 로그 최적화)
async function preloadSalesData() {
  try {
    // 로그 최소화 (성능 최적화)
    // console.log('🔄 [SALES] 영업 데이터 미리 로드 시작...');
    
    // 동시 요청 제한 적용
    const result = await withConcurrencyLimit(async () => {
      return await processSalesData();
    });
    
    // 캐시에 저장 (6시간 TTL)
    cacheUtils.set('sales_data', result, 6 * 60 * 60 * 1000);
    
    // 로그 최소화 (성능 최적화)
    // console.log(`✅ [SALES] 영업 데이터 미리 로드 완료: ${result.data.salesData.length}개 레코드, ${result.data.summary.totalPosCodes}개 POS코드 (트래픽 최적화됨)`);
  } catch (error) {
    console.error('❌ [SALES] 영업 데이터 미리 로드 실패:', error);
  }
}

// 영업 데이터 처리 공통 함수 (코드 중복 제거)
async function processSalesData(spreadsheetId = process.env.SALES_SHEET_ID) {
  try {
    const startTime = Date.now();
    
    if (!spreadsheetId) {
      throw new Error('SALES_SHEET_ID 환경변수가 설정되어 있지 않습니다.');
    }
    
    const RAW_DATA_SHEET_NAME = 'raw데이터';
    const rawDataValues = await getSheetValues(RAW_DATA_SHEET_NAME, spreadsheetId);
    
    if (!rawDataValues) {
      throw new Error('Failed to fetch data from raw data sheet');
    }

    // 헤더 제거 (3행이 헤더, 4행부터 데이터)
    const rawDataRows = rawDataValues.slice(3);
    
    console.log(`🔍 [SALES] raw데이터 처리 시작: ${rawDataRows.length}개 행`);
    
    // 필터링된 데이터 처리 (성능 최적화)
    const salesData = [];
    const posCodeMap = new Map(); // Map 사용으로 성능 향상
    const regionMap = new Map(); // Map 사용으로 성능 향상
    
    // 유효한 데이터만 먼저 필터링
    const validRows = rawDataRows.filter(row => {
      if (!row || row.length < 28) return false;
      
      const latitude = parseFloat(row[10]) || 0;
      const longitude = parseFloat(row[11]) || 0;
      const performance = parseInt(row[27]) || 0;
      
      return latitude && longitude && performance > 0;
    });
    
    console.log(`✅ [SALES] 유효한 데이터: ${validRows.length}개 행`);
    
    validRows.forEach((row, index) => {
      const latitude = parseFloat(row[10]);    // K열: 위도
      const longitude = parseFloat(row[11]);   // L열: 경도
      const address = (row[12] || '').toString();   // M열: 주소
      const agentCode = (row[16] || '').toString(); // Q열: 대리점코드
      const agentName = (row[17] || '').toString(); // R열: 대리점명
      const posCode = (row[21] || '').toString();   // V열: POS코드
      const storeName = (row[22] || '').toString(); // W열: 판매점명
      const region = (row[24] || '').toString();    // Y열: 광역상권
      const subRegion = (row[25] || '').toString(); // Z열: 세부상권
      const performance = parseInt(row[27]);   // AB열: 실적
      
      // 추가 필터 데이터
      const manager = (row[14] || '').toString();   // O열: 담당
      const branch = (row[15] || '').toString();    // P열: 지점
      
      // 주소 계층 데이터 (E, F, G, H열)
      const province = (row[4] || '').toString();   // E열: 도/광역시
      const city = (row[5] || '').toString();       // F열: 시/구
      const district = (row[6] || '').toString();   // G열: 구/동
      const detailArea = (row[7] || '').toString(); // H열: 동/상세
      
      // 개별 데이터 추가
      const salesItem = {
        latitude,
        longitude,
        address,
        agentCode,
        agentName,
        posCode,
        storeName,
        region,
        subRegion,
        performance,
        manager,
        branch,
        // 주소 계층 데이터 추가
        province,
        city,
        district,
        detailArea
      };
      
      salesData.push(salesItem);
      
      // POS코드별 실적 합계 (Map 사용으로 성능 향상)
      if (!posCodeMap.has(posCode)) {
        posCodeMap.set(posCode, {
          latitude,
          longitude,
          address,
          posCode,
          storeName,
          region,
          subRegion,
          manager,
          branch,
          // 주소 계층 데이터 추가
          province,
          city,
          district,
          detailArea,
          totalPerformance: 0,
          agents: new Map() // 대리점 정보도 Map으로 관리
        });
      }
      
      const posCodeData = posCodeMap.get(posCode);
      posCodeData.totalPerformance += performance;
      
      // 대리점 정보 추가 (Map으로 중복 방지)
      if (!posCodeData.agents.has(agentCode)) {
        posCodeData.agents.set(agentCode, {
          agentCode,
          agentName,
          performance
        });
      } else {
        posCodeData.agents.get(agentCode).performance += performance;
      }
      
      // 지역별 실적 합계
      const regionKey = `${region}_${subRegion}`;
      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, {
          region,
          subRegion,
          totalPerformance: 0,
          posCodes: new Set()
        });
      }
      
      const regionData = regionMap.get(regionKey);
      regionData.totalPerformance += performance;
      regionData.posCodes.add(posCode);
    });
    
    // Map을 Object로 변환
    const posCodeMapObj = {};
    posCodeMap.forEach((value, key) => {
      posCodeMapObj[key] = {
        ...value,
        agents: Array.from(value.agents.values())
      };
    });
    
    const regionMapObj = {};
    regionMap.forEach((value, key) => {
      regionMapObj[key] = {
        ...value,
        posCodes: Array.from(value.posCodes)
      };
    });
    
    // 결과 데이터 구성
    const result = {
      success: true,
      data: {
        salesData,
        posCodeMap: posCodeMapObj,
        regionMap: regionMapObj,
        summary: {
          totalRecords: salesData.length,
          totalPosCodes: posCodeMap.size,
          totalRegions: regionMap.size,
          totalPerformance: Array.from(posCodeMap.values()).reduce((sum, item) => sum + item.totalPerformance, 0)
        }
      }
    };
    
    // 캐시에 저장 (24시간 TTL)
    cacheUtils.set('sales_data', result, 24 * 60 * 60 * 1000);
    
    console.log(`✅ [SALES] 영업 데이터 미리 로드 완료: ${salesData.length}개 레코드, ${posCodeMap.size}개 POS코드`);
    
    // 결과 반환 추가
    return result;
  } catch (error) {
    console.error('❌ [SALES] 영업 데이터 미리 로드 실패:', error);
    throw error; // 오류를 다시 던져서 호출자가 처리할 수 있도록 함
  }
}

// 영업 모드 접근 권한 확인
app.get('/api/sales-mode-access', async (req, res) => {
  // CORS 헤더 명시적 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // 대리점아이디관리 시트에서 S열 권한 확인
    const agentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${AGENT_SHEET_NAME}!A:S`
    });

    if (!agentResponse.data.values || agentResponse.data.values.length === 0) {
      throw new Error('Failed to fetch agent data');
    }

    // 헤더 제거
    const agentRows = agentResponse.data.values.slice(1);
    
    // S열에서 "O" 권한이 있는 대리점 찾기
    const authorizedAgents = agentRows
      .filter(row => row && row.length > 18 && row[18] === 'O') // S열 (18번 인덱스)
      .map(row => ({
        agentCode: row[0] || '', // A열: 대리점코드
        agentName: row[1] || '', // B열: 대리점명
        accessLevel: row[18] || '' // S열: 접근권한
      }));

    res.json({
      success: true,
      hasAccess: authorizedAgents.length > 0,
      authorizedAgents,
      totalAgents: agentRows.length,
      authorizedCount: authorizedAgents.length
    });
  } catch (error) {
    console.error('Error checking sales mode access:', error);
    res.status(500).json({
      success: false,
      hasAccess: false,
      error: 'Failed to check sales mode access',
      message: error.message
    });
  }
});

// 재고회수모드 접근권한 확인 API
app.get('/api/inventoryRecoveryAccess', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // 대리점아이디관리 시트에서 T열 권한 확인
    const agentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${AGENT_SHEET_NAME}!A:T`
    });

    if (!agentResponse.data.values || agentResponse.data.values.length === 0) {
      throw new Error('Failed to fetch agent data');
    }

    // 헤더 제거
    const agentRows = agentResponse.data.values.slice(1);
    
    // T열에서 재고회수모드 권한이 있는 대리점 찾기
    const authorizedAgents = agentRows
      .filter(row => row && row.length > 19 && row[19] === 'O') // T열 (19번 인덱스)
      .map(row => ({
        agentCode: row[0] || '', // A열: 대리점코드
        agentName: row[1] || '', // B열: 대리점명
        accessLevel: row[19] || '' // T열: 재고회수모드 접근권한
      }));

    res.json({
      success: true,
      hasAccess: authorizedAgents.length > 0,
      authorizedAgents,
      totalAgents: agentRows.length,
      authorizedCount: authorizedAgents.length
    });
  } catch (error) {
    console.error('Error checking inventory recovery mode access:', error);
    res.status(500).json({
      success: false,
      hasAccess: false,
      error: 'Failed to check inventory recovery mode access',
      message: error.message
    });
  }
});

// 모델과 색상 데이터 가져오기 (캐싱 적용)
app.get('/api/models', async (req, res) => {
  const cacheKey = 'processed_models_data';
  
  // 캐시에서 먼저 확인
  const cachedModels = cacheUtils.get(cacheKey);
  if (cachedModels) {
    return res.json(cachedModels);
  }
  
  try {
    const startTime = Date.now();
    
    const inventoryValues = await getSheetValues(INVENTORY_SHEET_NAME);
    
    if (!inventoryValues) {
      throw new Error('Failed to fetch data from inventory sheet');
    }

    // 헤더 제거 (첫 3행은 제외)
    const inventoryRows = inventoryValues.slice(3);

    // 모델과 색상 데이터 추출
    const modelColorMap = {};
    
    inventoryRows.forEach(row => {
      if (row.length < 16) return;
      
      const model = (row[13] || '').toString().trim();    // F열: 모델 (5+8)
      const color = (row[14] || '').toString().trim();    // G열: 색상 (6+8)
      const status = (row[15] || '').toString().trim();   // H열: 상태 (7+8)
      const type = (row[12] || '').toString().trim();     // E열: 종류 (4+8)
      
      if (!model || !color) return;
      
      // 상태가 '정상'인 것만 포함 (필터링)
      if (status !== '정상') return;
      
      if (!modelColorMap[model]) {
        modelColorMap[model] = new Set();
      }
      modelColorMap[model].add(color);
    });

    // Set을 배열로 변환
    const result = Object.entries(modelColorMap).reduce((acc, [model, colors]) => {
      acc[model] = Array.from(colors).sort();
      return acc;
    }, {});

    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, result);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching model and color data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch model and color data', 
      message: error.message 
    });
  }
});



// 대리점 ID 정보 가져오기 (캐싱 적용)
app.get('/api/agents', async (req, res) => {
  const cacheKey = 'processed_agents_data';
  
  // 캐시에서 먼저 확인
  const cachedAgents = cacheUtils.get(cacheKey);
  if (cachedAgents) {
    // console.log('캐시된 대리점 데이터 반환');
    return res.json(cachedAgents);
  }
  
  try {
    // console.log('대리점 데이터 처리 시작...');
    const startTime = Date.now();
    
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    
    if (!agentValues) {
      throw new Error('Failed to fetch data from agent sheet');
    }

    // 헤더 제거 (3행까지가 헤더이므로 4행부터 시작)
    const agentRows = agentValues.slice(3);
    
    // 대리점 데이터 구성
    const agents = agentRows.map(row => {
      return {
        target: row[0] || '',       // A열: 대상
        qualification: row[1] || '', // B열: 자격
        contactId: row[2] || '',     // C열: 연락처(아이디)
        office: row[3] || '',        // D열: 사무실 (새로 추가)
        department: row[4] || ''     // E열: 소속 (새로 추가)
      };
    }).filter(agent => agent.contactId); // 아이디가 있는 항목만 필터링
    
    const processingTime = Date.now() - startTime;
    // console.log(`대리점 데이터 처리 완료: ${agents.length}개 대리점, ${processingTime}ms 소요`);
    
    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, agents);
    
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agent data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent data', 
      message: error.message 
    });
  }
});

// 당월 개통실적 데이터 가져오기
app.get('/api/activation-data/current-month', async (req, res) => {
  const cacheKey = 'current_month_activation_data';
  
      // 캐시에서 먼저 확인
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    try {
    const startTime = Date.now();
    
    const activationValues = await getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME);
    
    if (!activationValues) {
      throw new Error('Failed to fetch data from current month activation sheet');
    }

    // 헤더 제거
    const activationRows = activationValues.slice(1);
    
    // 개통실적 데이터 구성 (선불개통 제외)
    const activationData = activationRows
      .filter(row => row[14] !== '선불개통') // O열: 개통 (선불개통 제외)
      .map(row => {
        return {
          '담당자': row[8] || '',        // I열: 담당자
          '개통일': row[9] || '',        // J열: 개통일
          '개통시': row[10] || '',       // K열: 개통시
          '개통분': row[11] || '',       // L열: 개통분
          '출고처': row[14] || '',       // O열: 출고처
          '개통': row[19] || '',         // T열: 개통
          '모델명': row[21] || '',       // V열: 모델명
          '색상': row[22] || '',         // W열: 색상
          '일련번호': row[23] || ''      // X열: 일련번호
        };
      });
    
    const processingTime = Date.now() - startTime;
    
    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, activationData);
    
    res.json(activationData);
  } catch (error) {
    console.error('Error fetching current month activation data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch current month activation data', 
      message: error.message 
    });
  }
});

// 전월 개통실적 데이터 가져오기
app.get('/api/activation-data/previous-month', async (req, res) => {
  const cacheKey = 'previous_month_activation_data';
  
      // 캐시에서 먼저 확인
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    try {
    const startTime = Date.now();
    
    const activationValues = await getSheetValues(PREVIOUS_MONTH_ACTIVATION_SHEET_NAME);
    
    if (!activationValues) {
      throw new Error('Failed to fetch data from previous month activation sheet');
    }

    // 헤더 제거
    const activationRows = activationValues.slice(1);
    
    // 개통실적 데이터 구성 (선불개통 제외)
    const activationData = activationRows
      .filter(row => row[14] !== '선불개통') // O열: 개통 (선불개통 제외)
      .map(row => {
        return {
          '담당자': row[8] || '',        // I열: 담당자
          '개통일': row[9] || '',        // J열: 개통일
          '개통시': row[10] || '',       // K열: 개통시
          '개통분': row[11] || '',       // L열: 개통분
          '출고처': row[14] || '',       // O열: 출고처
          '개통': row[19] || '',         // T열: 개통
          '모델명': row[21] || '',       // V열: 모델명
          '색상': row[22] || '',         // W열: 색상
          '일련번호': row[23] || ''      // X열: 일련번호
        };
      });
    
    const processingTime = Date.now() - startTime;
    
    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, activationData);
    
    res.json(activationData);
  } catch (error) {
    console.error('Error fetching previous month activation data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch previous month activation data', 
      message: error.message 
    });
  }
});

// 날짜별 개통실적 데이터 가져오기 (새로운 API)
app.get('/api/activation-data/by-date', async (req, res) => {
  const cacheKey = 'activation_data_by_date';
  
      // 캐시에서 먼저 확인
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    try {
    const startTime = Date.now();
    
    const activationValues = await getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME);
    
    if (!activationValues) {
      throw new Error('Failed to fetch data from current month activation sheet');
    }

    // 헤더 제거
    const activationRows = activationValues.slice(1);
    
    // 날짜별 개통실적 데이터 구성
    const dateStats = {};
    
    activationRows.forEach(row => {
      if (row[14] === '선불개통') return; // O열: 개통 (선불개통 제외)
      
      const store = row[14] || '미지정'; // O열: 출고처
      const agent = row[8] || '미지정'; // I열: 담당자
      const activationDate = row[9] || ''; // J열: 개통일
      const model = row[21] || '미지정'; // V열: 모델명
      const color = row[22] || '미지정'; // W열: 색상
      
      if (!activationDate) return;
      
      // 날짜 형식 정규화 (MM/DD -> MM/DD/YYYY -> toLocaleDateString 형식)
      let normalizedDate = activationDate;
      if (activationDate.match(/^\d{1,2}\/\d{1,2}$/)) {
        const currentYear = new Date().getFullYear();
        normalizedDate = `${activationDate}/${currentYear}`;
      }
      
      // Date 객체로 변환하여 ISO 형식으로 통일
      try {
        const dateObj = new Date(normalizedDate);
        if (!isNaN(dateObj.getTime())) {
          // ISO 형식으로 통일 (재고 데이터와 동일)
          normalizedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD 형식
        }
      } catch (error) {
        console.warn('날짜 변환 실패:', normalizedDate, error);
      }
      
      if (!dateStats[normalizedDate]) {
        dateStats[normalizedDate] = {};
      }
      
      if (!dateStats[normalizedDate][store]) {
        dateStats[normalizedDate][store] = {
          storeName: store,
          totalCount: 0,
          agents: new Set(),
          models: {}
        };
      }
      
      dateStats[normalizedDate][store].totalCount++;
      dateStats[normalizedDate][store].agents.add(agent);
      
      const modelKey = `${model} (${color})`;
      if (!dateStats[normalizedDate][store].models[modelKey]) {
        dateStats[normalizedDate][store].models[modelKey] = 0;
      }
      dateStats[normalizedDate][store].models[modelKey]++;
    });
    
    // Set을 배열로 변환
    Object.keys(dateStats).forEach(date => {
      Object.keys(dateStats[date]).forEach(store => {
        dateStats[date][store].agents = Array.from(dateStats[date][store].agents);
      });
    });
    
    const processingTime = Date.now() - startTime;
    
    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, dateStats);
    
    res.json(dateStats);
  } catch (error) {
    console.error('Error fetching activation data by date:', error);
    res.status(500).json({ 
      error: 'Failed to fetch activation data by date', 
      message: error.message 
    });
  }
});

// 특정 날짜의 당월/전월 개통실적 데이터 가져오기 (새로운 API)
app.get('/api/activation-data/date-comparison/:date', async (req, res) => {
  const { date } = req.params;
  const cacheKey = `activation_date_comparison_${date}`;
  
      // 캐시에서 먼저 확인
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    try {
    const startTime = Date.now();
    
    // 당월과 전월 데이터 모두 가져오기
    const [currentMonthValues, previousMonthValues] = await Promise.all([
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
      getSheetValues(PREVIOUS_MONTH_ACTIVATION_SHEET_NAME)
    ]);
    
    if (!currentMonthValues || !previousMonthValues) {
      throw new Error('Failed to fetch activation data from sheets');
    }

    // 헤더 제거
    const currentMonthRows = currentMonthValues.slice(1);
    const previousMonthRows = previousMonthValues.slice(1);
    
    // 날짜별 당월/전월 데이터 구성
    const comparisonData = {};
    
    // 당월 데이터 처리
    currentMonthRows.forEach(row => {
      if (row[14] === '선불개통') return; // O열: 개통 (선불개통 제외)
      
      const store = row[14] || '미지정'; // O열: 출고처
      const agent = row[8] || '미지정'; // I열: 담당자
      const activationDate = row[9] || ''; // J열: 개통일
      const model = row[21] || '미지정'; // V열: 모델명
      const color = row[22] || '미지정'; // W열: 색상
      
      if (!activationDate) return;
      
      // 날짜 형식 정규화
      let normalizedDate = activationDate;
      if (activationDate.match(/^\d{1,2}\/\d{1,2}$/)) {
        const currentYear = new Date().getFullYear();
        normalizedDate = `${activationDate}/${currentYear}`;
      }
      
      // ISO 형식으로 변환
      try {
        const dateObj = new Date(normalizedDate);
        if (!isNaN(dateObj.getTime())) {
          normalizedDate = dateObj.toISOString().split('T')[0];
        }
      } catch (error) {
        console.warn('날짜 변환 실패:', normalizedDate, error);
        return;
      }
      
      // 특정 날짜만 처리 (일자만 비교)
      const currentDay = new Date(normalizedDate).getDate();
      const targetDay = new Date(date).getDate();
      if (currentDay !== targetDay) return;
      
      if (!comparisonData[store]) {
        comparisonData[store] = {
          storeName: store,
          currentMonth: 0,
          previousMonth: 0,
          agents: new Set(),
          models: {}
        };
      }
      
      comparisonData[store].currentMonth++;
      comparisonData[store].agents.add(agent);
      
      const modelKey = `${model} (${color})`;
      if (!comparisonData[store].models[modelKey]) {
        comparisonData[store].models[modelKey] = 0;
      }
      comparisonData[store].models[modelKey]++;
    });
    
    // 전월 데이터 처리 (같은 일자)
    // console.log(`전월 데이터 처리 시작 - 요청 날짜: ${date}`);
    // console.log(`전월 데이터 행 수: ${previousMonthRows.length}`);
    
    const targetDay = new Date(date).getDate();
    // console.log(`전월 비교 대상 일자: ${targetDay}일`);
    
    let processedPreviousCount = 0;
    
    previousMonthRows.forEach((row, index) => {
      if (row[14] === '선불개통') return; // O열: 개통 (선불개통 제외)
      
      const store = row[14] || '미지정'; // O열: 출고처
      const agent = row[8] || '미지정'; // I열: 담당자
      const activationDate = row[9] || ''; // J열: 개통일
      const model = row[21] || '미지정'; // V열: 모델명
      const color = row[22] || '미지정'; // W열: 색상
      
      if (!activationDate) return;
      
      // 날짜 형식 정규화
      let normalizedDate = activationDate;
      if (activationDate.match(/^\d{1,2}\/\d{1,2}$/)) {
        const previousYear = new Date().getFullYear() - 1;
        normalizedDate = `${activationDate}/${previousYear}`;
      }
      
      // ISO 형식으로 변환
      try {
        const dateObj = new Date(normalizedDate);
        if (!isNaN(dateObj.getTime())) {
          normalizedDate = dateObj.toISOString().split('T')[0];
        }
      } catch (error) {
        console.warn('날짜 변환 실패:', normalizedDate, error);
        return;
      }
      
      // 특정 날짜만 처리 (전월의 같은 일자)
      const previousDay = new Date(normalizedDate).getDate();
      const targetDay = new Date(date).getDate();
      if (previousDay !== targetDay) return;
      
      processedPreviousCount++;
      if (processedPreviousCount <= 5) { // 처음 5개만 로그 출력
        const day = new Date(normalizedDate).getDate();
        // console.log(`전월 데이터 매칭: ${store} - ${activationDate} -> ${day}일`);
      }
      
      if (!comparisonData[store]) {
        comparisonData[store] = {
          storeName: store,
          currentMonth: 0,
          previousMonth: 0,
          agents: new Set(),
          models: {}
        };
      }
      
      comparisonData[store].previousMonth++;
      comparisonData[store].agents.add(agent);
      
      const modelKey = `${model} (${color})`;
      if (!comparisonData[store].models[modelKey]) {
        comparisonData[store].models[modelKey] = 0;
      }
      comparisonData[store].models[modelKey]++;
    });
    
    // Set을 배열로 변환
    Object.keys(comparisonData).forEach(store => {
      comparisonData[store].agents = Array.from(comparisonData[store].agents);
    });
    
    const processingTime = Date.now() - startTime;
    // console.log(`날짜 비교 데이터 처리 완료: ${date}, ${Object.keys(comparisonData).length}개 매장, ${processingTime}ms 소요`);
    
    // 전월 데이터 요약 로그
    const storesWithPreviousData = Object.values(comparisonData).filter(store => store.previousMonth > 0);
    // console.log(`전월 데이터가 있는 매장 수: ${storesWithPreviousData.length}`);
    if (storesWithPreviousData.length > 0) {
      // console.log('전월 데이터가 있는 매장들:', storesWithPreviousData.map(store => ({
      //   storeName: store.storeName,
      //   previousMonth: store.previousMonth
      // })));
    }
    
    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, comparisonData);
    
    res.json(comparisonData);
  } catch (error) {
    console.error('Error fetching activation date comparison data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch activation date comparison data', 
      message: error.message 
    });
  }
});

// 사용자 활동 로깅 API (비동기 처리)
app.post('/api/log-activity', async (req, res) => {
  // 즉시 응답 반환
  res.json({ success: true });
  
  // 로깅 처리를 비동기로 실행
  setImmediate(async () => {
    try {
      const { 
        userId, 
        userType, 
        targetName, 
        ipAddress, 
        location, 
        deviceInfo, 
        activity, 
        model, 
        colorName,
        callButton 
      } = req.body;
      
      // 활동 유형에 따른 제목 설정
      let title = '사용자 활동';
      let embedColor = 3447003; // 파란색
      
      if (activity === 'login') {
        title = '사용자 로그인';
        embedColor = 5763719; // 초록색
      } else if (activity === 'search') {
        title = '모델 검색';
        embedColor = 16776960; // 노란색
      } else if (activity === 'call_button') {
        title = '전화 연결 버튼 클릭';
        embedColor = 15548997; // 빨간색
      } else if (activity === 'kakao_button') {
        title = '카톡문구 생성';
        embedColor = 16776960; // 노란색 (카카오톡 색상)
      }
      
      // Discord로 로그 전송 시도
      if (DISCORD_LOGGING_ENABLED) {
        try {
          // Embed 데이터 구성
          const embedData = {
            title: title,
            color: embedColor,
            timestamp: new Date().toISOString(),
            userType: userType || 'store',
            fields: [
              {
                name: '사용자 정보',
                value: `ID: ${userId}\n종류: ${userType === 'agent' ? '관리자' : '일반'}\n대상: ${targetName || '없음'}`
              },
              {
                name: '접속 정보',
                value: `IP: ${ipAddress}\n위치: ${location || '알 수 없음'}\n기기: ${deviceInfo || '알 수 없음'}`
              }
            ],
            footer: {
              text: userType === 'agent' ? '(주)브이아이피플러스 관리자 활동 로그' : '(주)브이아이피플러스 매장 활동 로그'
            }
          };
          
          // 검색 정보가 있는 경우 필드 추가
          if (model) {
            embedData.fields.push({
              name: '검색 정보',
              value: `모델: ${model}${colorName ? `\n색상: ${colorName}` : ''}`
            });
          }
          
          // 전화 연결 버튼 클릭 정보
          if (callButton) {
            embedData.fields.push({
              name: '전화 연결',
              value: `${callButton}`
            });
          }
          
          // 카톡문구 생성 버튼 클릭 정보
          if (req.body.kakaoButton) {
            embedData.fields.push({
              name: '카톡문구 생성',
              value: `카카오톡 메시지 템플릿이 클립보드에 복사되었습니다.`
            });
          }
          
          // Discord로 로그 전송
          await sendLogToDiscord(embedData);
        } catch (logError) {
          console.error('활동 로그 Discord 전송 오류:', logError.message);
        }
      }
    } catch (error) {
      console.error('활동 로그 처리 중 오류:', error);
    }
  });
});

// 로그인 전용 캐시 (성능 최적화)
const loginCache = new Map();
const LOGIN_CACHE_TTL = 5 * 60 * 1000; // 5분

// 로그인 검증 API 추가
app.post('/api/login', async (req, res) => {
  try {
    const { storeId, deviceInfo, ipAddress, location } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Store ID is required' 
      });
    }
    
    // 로그인 캐시 확인 (성능 최적화)
    const cacheKey = `login_${storeId}`;
    const cachedLogin = loginCache.get(cacheKey);
    if (cachedLogin && Date.now() < cachedLogin.ttl) {
      console.log(`🚀 [로그인 최적화] 캐시된 로그인 정보 사용: ${storeId}`);
      return res.json(cachedLogin.data);
    }
    
    // console.log(`Login attempt with ID: ${storeId}`);
    // console.log('Step 1: Starting login process...');
    
    // 1. 대리점 관리자와 일반 매장 데이터를 병렬로 가져오기 (성능 최적화)
    // console.log('Step 2: Fetching agent and store data in parallel...');
    const [agentValues, storeValues] = await Promise.all([
      getSheetValues(AGENT_SHEET_NAME),
      getSheetValues(STORE_SHEET_NAME)
    ]);
    // console.log('Step 3: Data fetched, agent rows:', agentValues ? agentValues.length : 0, 'store rows:', storeValues ? storeValues.length : 0);
    
    // 2. 먼저 대리점 관리자 ID인지 확인
    if (agentValues) {
      const agentRows = agentValues.slice(1);
      // console.log('Step 4: Agent rows (excluding header):', agentRows.length);
      
      const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디)
      // console.log('Step 5: Agent search result:', agent ? 'Found' : 'Not found');
      
      if (agent) {
        // console.log(`Found agent: ${agent[0]}, ${agent[1]}`);
        // console.log('Step 6: Processing agent login...');
        
        // F열: 재고모드 권한, G열: 정산모드 권한, H열: 검수모드 권한, I열: 채권장표 메뉴 권한, J열: 정책모드 권한, K열: 검수전체현황 권한, L열: 회의모드 권한, M열: 사전예약모드 권한, N열: 장표모드 권한, Q열: 예산모드 권한, S열: 영업모드 권한, T열: 재고회수모드 권한 확인
        const hasInventoryPermission = agent[5] === 'O'; // F열
        const hasSettlementPermission = agent[6] === 'O'; // G열
        const hasInspectionPermission = agent[7] === 'O'; // H열
        const hasBondChartPermission = agent[8] === 'O'; // I열: 채권장표 메뉴 권한
        const hasPolicyPermission = agent[9] === 'O'; // J열
        const hasInspectionOverviewPermission = agent[10] === 'O'; // K열
        const hasMeetingPermission = agent[11] === 'O'; // L열
        const hasReservationPermission = agent[12] === 'O'; // M열
        const hasChartPermission = agent[13] === 'O'; // N열: 장표모드 권한
        const hasBudgetPermission = agent[16] === 'O'; // Q열: 예산모드 권한
        const hasSalesPermission = agent[18] === 'O'; // S열: 영업모드 권한
        const hasInventoryRecoveryPermission = agent[19] === 'O'; // T열: 재고회수모드 권한
        const hasDataCollectionPermission = agent[20] === 'O'; // U열: 정보수집모드 권한
        const hasSmsManagementPermission = agent[21] === 'O'; // V열: SMS 관리모드 권한
        const hasObManagementPermission = agent[22] === 'O'; // W열: OB 관리모드 권한
        const hasAgentModePermission = agent[23] === 'O'; // X열: 관리자모드 권한
        
        // 정보수집모드 권한 디버깅
        console.log('🔍 [권한체크] 정보수집모드 디버깅:');
        console.log('  - agent[20] 값:', agent[20]);
        console.log('  - hasDataCollectionPermission:', hasDataCollectionPermission);
        console.log('  - agent 전체:', agent);
        
        // console.log('Step 6.5: Permission check:', {
        //   inventory: hasInventoryPermission,
        //   settlement: hasSettlementPermission,
        //   inspection: hasInspectionPermission,
        //   bondChart: hasBondChartPermission,
        //   chart: hasChartPermission,
        //   policy: hasPolicyPermission,
        //   inspectionOverview: hasInspectionOverviewPermission
        // });
        
        // 다중 권한이 있는 경우 권한 정보 포함
        const modePermissions = {
          agent: hasAgentModePermission, // 관리자 모드도 권한 확인
          inventory: hasInventoryPermission,
          settlement: hasSettlementPermission,
          inspection: hasInspectionPermission,
          bondChart: hasBondChartPermission, // 채권장표 메뉴 권한
          chart: hasChartPermission, // 장표모드 권한
          policy: hasPolicyPermission,
          inspectionOverview: hasInspectionOverviewPermission,
          meeting: hasMeetingPermission,
          reservation: hasReservationPermission,
          budget: hasBudgetPermission, // 예산모드 권한
          sales: hasSalesPermission, // 영업모드 권한
          inventoryRecovery: hasInventoryRecoveryPermission, // 재고회수모드 권한
          dataCollection: hasDataCollectionPermission, // 정보수집모드 권한
          smsManagement: hasSmsManagementPermission, // SMS 관리모드 권한
          obManagement: hasObManagementPermission // OB 관리모드 권한
        };
        
        // 디스코드로 로그인 로그 전송 (비동기 처리로 성능 최적화)
        if (DISCORD_LOGGING_ENABLED) {
          const embedData = {
            title: '관리자 로그인',
            color: 15844367, // 보라색
            timestamp: new Date().toISOString(),
            userType: 'agent', // 관리자 타입 지정
            fields: [
              {
                name: '관리자 정보',
                value: `ID: ${agent[2]}\n대상: ${agent[0]}\n자격: ${agent[1]}\n관리자권한: ${hasAgentModePermission ? 'O' : 'X'}\n재고권한: ${hasInventoryPermission ? 'O' : 'X'}\n정산권한: ${hasSettlementPermission ? 'O' : 'X'}\n검수권한: ${hasInspectionPermission ? 'O' : 'X'}\n채권장표권한: ${hasBondChartPermission ? 'O' : 'X'}\n장표권한: ${hasChartPermission ? 'O' : 'X'}\n정책권한: ${hasPolicyPermission ? 'O' : 'X'}\n검수전체현황권한: ${hasInspectionOverviewPermission ? 'O' : 'X'}\n회의권한: ${hasMeetingPermission ? 'O' : 'X'}\n사전예약권한: ${hasReservationPermission ? 'O' : 'X'}\n예산권한: ${hasBudgetPermission ? 'O' : 'X'}\n영업권한: ${hasSalesPermission ? 'O' : 'X'}\n재고회수권한: ${hasInventoryRecoveryPermission ? 'O' : 'X'}\nSMS관리권한: ${hasSmsManagementPermission ? 'O' : 'X'}\nOB관리권한: ${hasObManagementPermission ? 'O' : 'X'}`
              },
              {
                name: '접속 정보',
                value: `IP: ${ipAddress || '알 수 없음'}\n위치: ${location || '알 수 없음'}\n기기: ${deviceInfo || '알 수 없음'}`
              }
            ],
            footer: {
              text: '(주)브이아이피플러스 관리자 로그인'
            }
          };
          
          // 비동기로 로그 전송 (응답 지연 방지)
          sendLogToDiscord(embedData).catch(logError => {
            console.error('로그인 로그 전송 실패:', logError.message);
          });
        }
        
        const loginResult = {
          success: true,
          isAgent: true,
          modePermissions: modePermissions,
          agentInfo: {
            target: agent[0] || '',       // A열: 대상
            qualification: agent[1] || '', // B열: 자격
            contactId: agent[2] || '',     // C열: 연락처(아이디)
            office: agent[3] || '',        // D열: 사무실
            department: agent[4] || '',    // E열: 소속
            userRole: agent[15] || ''      // P열: 권한 (정책모드 권한)
          }
        };
        
        // 로그인 결과 캐시 저장 (성능 최적화)
        loginCache.set(cacheKey, {
          data: loginResult,
          ttl: Date.now() + LOGIN_CACHE_TTL
        });
        
        return res.json(loginResult);
      }
    }
    
    // 3. 대리점 관리자가 아닌 경우 일반 매장으로 검색 (이미 가져온 데이터 사용)
    
    if (!storeValues) {
      throw new Error('Failed to fetch data from store sheet');
    }
    
    const storeRows = storeValues.slice(1);
    
    const foundStoreRow = storeRows.find(row => {
      const rowId = row[15]; // H열: 매장 ID (7+8)
      return rowId === storeId;
    });
    
    if (foundStoreRow) {
      const store = {
        id: foundStoreRow[15],                      // H열: 매장 ID (7+8)
        name: foundStoreRow[14],                    // G열: 업체명 (6+8)
        manager: foundStoreRow[21] || '',          // N열: 담당자 (13+8)
        address: foundStoreRow[11] || '',          // D열: 주소 (3+8)
        latitude: parseFloat(foundStoreRow[8] || '0'),  // A열: 위도 (0+8)
        longitude: parseFloat(foundStoreRow[9] || '0'),  // B열: 경도 (1+8)
        phone: foundStoreRow[19] || ''              // L열: 연락처 추가 (11+8)
      };
      
      // 디스코드로 로그인 로그 전송 (비동기 처리로 성능 최적화)
      if (DISCORD_LOGGING_ENABLED) {
        const embedData = {
          title: '매장 로그인',
          color: 5763719, // 초록색
          timestamp: new Date().toISOString(),
          userType: 'store', // 일반 매장 타입 지정
          fields: [
            {
              name: '매장 정보',
              value: `ID: ${store.id}\n매장명: ${store.name}\n담당자: ${store.manager || '없음'}`
            },
            {
              name: '접속 정보',
              value: `IP: ${ipAddress || '알 수 없음'}\n위치: ${location || '알 수 없음'}\n기기: ${deviceInfo || '알 수 없음'}`
            }
          ],
          footer: {
            text: '(주)브이아이피플러스 매장 로그인'
          }
        };
        
        // 비동기로 로그 전송 (응답 지연 방지)
        sendLogToDiscord(embedData).catch(logError => {
          console.error('로그인 로그 전송 실패:', logError.message);
        });
      }
      
      const loginResult = {
        success: true,
        isAgent: false,
        storeInfo: store
      };
      
      // 로그인 결과 캐시 저장 (성능 최적화)
      loginCache.set(cacheKey, {
        data: loginResult,
        ttl: Date.now() + LOGIN_CACHE_TTL
      });
      
      return res.json(loginResult);
    }
    
    // 3. 매장 ID도 아닌 경우
    return res.status(404).json({
      success: false,
      error: 'Store not found'
    });
    
  } catch (error) {
    console.error('Error in login:', error);
    console.error('Login error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed', 
      message: error.message 
    });
  }
});

// 주기적으로 주소 업데이트를 확인하고 실행하는 함수
async function checkAndUpdateAddresses() {
  try {
    console.log('🔍 [주소업데이트] 폰클출고처데이터 시트 데이터 가져오기 시작');
    const storeValues = await getSheetValues(STORE_SHEET_NAME);
    if (!storeValues) {
      throw new Error('Failed to fetch data from store sheet');
    }
    console.log(`🔍 [주소업데이트] 폰클출고처데이터 로드 완료: ${storeValues.length}개 행`);

    // 헤더 제거
    const storeRows = storeValues.slice(1);
    const updates = [];
    console.log(`🔍 [주소업데이트] 처리할 데이터 행 수: ${storeRows.length}개`);
    
    // 모든 주소에 대해 좌표 업데이트 (행 위치가 변경되어도 항상 처리)
    for (let i = 0; i < storeRows.length; i++) {
      const row = storeRows[i];
      const address = row[11];  // L열: 주소 (8칸 밀림)
      const status = row[12];    // M열: 거래상태 (8칸 밀림)
      
      if (status === "사용") {
        if (!address || address.toString().trim() === '') {
          // 사용 상태이지만 주소가 없는 경우 좌표 삭제
          updates.push({
            range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
            values: [["", ""]]
          });
          continue;
        }
        
        // 주소가 있는 경우 geocoding 실행
        try {
          const result = await geocodeAddress(address);
          if (result) {
            const { latitude, longitude } = result;
            updates.push({
              range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
              values: [[latitude, longitude]]
            });
          }
        } catch (error) {
          console.error(`Geocoding 오류: ${address}`, error.message);
        }
      } else {
        // 미사용 매장은 위도/경도 값을 빈 값으로 비움
        updates.push({
          range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
          values: [["", ""]]
        });
      }
      // API 할당량 제한을 피하기 위한 지연 (사용 매장만)
      if (status === "사용") await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 일괄 업데이트 실행
    console.log(`🔍 [주소업데이트] 업데이트할 좌표 수: ${updates.length}개`);
    if (updates.length > 0) {
      console.log('🔍 [주소업데이트] Google Sheets 일괄 업데이트 시작');
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      console.log('✅ [주소업데이트] Google Sheets 일괄 업데이트 완료');
    } else {
      console.log('⏭️ [주소업데이트] 업데이트할 좌표가 없음');
    }
    console.log('✅ [주소업데이트] 주소 업데이트 함수 완료');
  } catch (error) {
    console.error('❌ [주소업데이트] Error in checkAndUpdateAddresses:', error);
  }
}

// SALES_SHEET_ID 주소 업데이트를 확인하고 실행하는 함수 (로그 최적화)
async function checkAndUpdateSalesAddresses() {
  try {
    // SALES_SHEET_ID 환경변수 확인
    const SALES_SPREADSHEET_ID = process.env.SALES_SHEET_ID;
    if (!SALES_SPREADSHEET_ID) {
      console.log('SALES_SHEET_ID 환경변수가 설정되지 않아 주소 업데이트를 건너뜁니다.');
      return;
    }
    
    const SALES_SHEET_NAME = '판매점정보';
    const salesValues = await getSheetValues(SALES_SHEET_NAME, SALES_SPREADSHEET_ID);
    if (!salesValues) {
      throw new Error('Failed to fetch data from sales sheet');
    }

    // 헤더 제거 (2행부터 시작)
    const salesRows = salesValues.slice(1);
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`🔍 [SALES] 판매점정보 시트 데이터 로드: ${salesRows.length}개 행`);
    
    // 모든 주소에 대해 좌표 업데이트 (개별 업데이트 방식)
    for (let i = 0; i < salesRows.length; i++) {
      const row = salesRows[i];
      const address = row[7];  // H열: 주소
      const existingLat = row[5]; // F열: 기존 위도
      const existingLng = row[6]; // G열: 기존 경도
      
      // 주소가 없거나 '주소확인필요'인 경우 건너뛰기
      if (!address || address.toString().trim() === '' || address.toString().trim() === '주소확인필요') {
        continue;
      }
      
      processedCount++;
      
      // 기존 좌표가 모두 존재하면 지오코딩 생략
      if (existingLat && existingLng) {
        skippedCount++;
        continue;
      }
      
      // 주소 해시 비교 (변경 감지) - 좌표가 없을 경우에만 적용
      const addressHash = createHash(address.toString().trim());
      const existingAddressHash = createHash('');
      
      // 좌표가 없는 경우에만 지오코딩 실행
      if (addressHash !== existingAddressHash) {
        try {
          // 개별 주소 로그 제거 (성능 최적화)
          const result = await geocodeAddress(address);
          if (result) {
            const { latitude, longitude } = result;
            
            // 개별 업데이트 실행 (즉시 저장)
            await sheets.spreadsheets.values.update({
              spreadsheetId: SALES_SPREADSHEET_ID,
              range: `${SALES_SHEET_NAME}!F${i + 2}:G${i + 2}`,
              valueInputOption: 'USER_ENTERED',
              resource: {
                values: [[latitude, longitude]]
              }
            });
            
            updatedCount++;
            
            // 100개마다 진행상황 로그 (로그 최적화)
            if (updatedCount % 100 === 0) {
              console.log(`📊 [SALES] 진행상황: ${updatedCount}개 업데이트 완료`);
            }
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          // 에러 로그도 최소화 (성능 최적화)
          if (errorCount <= 5) {
            console.error(`❌ [SALES] Geocoding 오류: ${address}`, error.message);
          }
        }
        
        // API 할당량 제한을 피하기 위한 지연 (0.2초)
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`📊 [SALES] 주소 업데이트 완료 - 처리: ${processedCount}개, 업데이트: ${updatedCount}개, 건너뜀: ${skippedCount}개, 오류: ${errorCount}개`);
  } catch (error) {
    console.error('Error in checkAndUpdateSalesAddresses:', error);
  }
}

// 재고배정 상태 계산 API
app.get('/api/inventory/assignment-status', async (req, res) => {
  try {
    // 캐시 키 생성
    const cacheKey = 'inventory_assignment_status';
    
    // 캐시에서 먼저 확인 (30분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 1. 필요한 시트 데이터 병렬로 가져오기
    const [reservationSiteValues, phoneklInventoryValues, phoneklStoreValues, phoneklActivationValues, normalizationValues] = await Promise.all([
      getSheetValues('사전예약사이트'),
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클출고처데이터'),
      getSheetValues('폰클개통데이터'),
      getSheetValues('정규화작업')
    ]);
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklInventoryValues || phoneklInventoryValues.length < 2) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklStoreValues || phoneklStoreValues.length < 2) {
      throw new Error('폰클출고처데이터를 가져올 수 없습니다.');
    }
    
    // 2. 정규화 규칙 로드
    const normalizationRules = new Map();
    if (normalizationValues && normalizationValues.length > 1) {
      normalizationValues.slice(1).forEach(row => {
        if (row.length >= 3) {
          const reservationSite = (row[1] || '').toString().trim(); // C열: 사전예약사이트 형식
          const phoneklModel = (row[2] || '').toString().trim(); // D열: 폰클
          const phoneklColor = (row[3] || '').toString().trim(); // E열: 색상
          
          if (reservationSite && phoneklModel && phoneklColor) {
            // 정규화 규칙의 키를 사전예약사이트 형식으로 생성 (파이프 제거)
            const key = reservationSite.replace(/\s*\|\s*/g, ' ').trim();
            normalizationRules.set(key, { phoneklModel, phoneklColor });
          }
        }
      });
    }
    
    // 3. 폰클출고처데이터에서 POS코드 매핑 생성
    const storePosCodeMapping = new Map();
    phoneklStoreValues.slice(1).forEach(row => {
      if (row.length >= 16) {
        const storeName = (row[14] || '').toString().trim(); // G열: 출고처명 (6+8)
        const posCode = (row[15] || '').toString().trim(); // H열: POS코드 (7+8)
        
        if (storeName && posCode) {
          storePosCodeMapping.set(storeName, posCode);
        }
      }
    });
    
    // 4. 폰클재고데이터에서 사용 가능한 재고 정보 생성
    const availableInventory = new Map(); // key: "모델명_색상_POS코드", value: [일련번호들]
    const serialNumberToStore = new Map(); // key: 일련번호, value: 출고처명
    
    phoneklInventoryValues.slice(1).forEach(row => {
      if (row.length >= 22) {
        const serialNumber = (row[11] || '').toString().trim(); // D열: 일련번호 (3+8)
        const modelCapacity = (row[13] || '').toString().trim(); // F열: 모델명&용량 (5+8)
        const color = (row[14] || '').toString().trim(); // G열: 색상 (6+8)
        const storeName = (row[21] || '').toString().trim(); // N열: 출고처 (13+8)
        
        if (serialNumber && modelCapacity && color && storeName) {
          const posCode = storePosCodeMapping.get(storeName);
          if (posCode) {
            // 모델명에 색상 정보가 없으면 추가
            let modelWithColor = modelCapacity;
            if (!modelCapacity.includes('|') && color) {
              modelWithColor = `${modelCapacity} | ${color}`;
            }
            const key = `${modelWithColor}_${posCode}`;
            
            if (!availableInventory.has(key)) {
              availableInventory.set(key, []);
            }
            availableInventory.get(key).push(serialNumber);
            
            serialNumberToStore.set(serialNumber, storeName);
          }
        }
      }
    });
    
    // 5. 폰클개통데이터에서 개통 완료된 일련번호 수집
    const activatedSerialNumbers = new Set();
    if (phoneklActivationValues && phoneklActivationValues.length > 1) {
      phoneklActivationValues.slice(1).forEach(row => {
        if (row.length >= 24) {
          const serialNumber = (row[23] || '').toString().trim(); // P열: 일련번호 (15+8)
          const storeName = (row[14] || '').toString().trim(); // G열: 출고처 (6+8)
          
          if (serialNumber && storeName) {
            activatedSerialNumbers.add(serialNumber);
          }
        }
      });
    }
    
    // 6. 사전예약사이트 데이터 처리 및 배정 상태 계산
    const reservationSiteRows = reservationSiteValues.slice(1);
    const assignmentResults = [];
    
    // 이미 배정된 일련번호 추적 (서버 시작 시 Google Sheets에서 동기화)
    const assignedSerialNumbers = new Set();
    
    // 서버 시작 시 Google Sheets에서 이미 배정된 일련번호들을 읽어와서 동기화
    reservationSiteRows.forEach(row => {
      if (row.length >= 22) {
        const assignedSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
        if (assignedSerialNumber && assignedSerialNumber.trim() !== '') {
          assignedSerialNumbers.add(assignedSerialNumber);
        }
      }
    });
    
    let processedCount = 0;
    let skippedCount = 0;
    let normalizationFailedCount = 0;
    let successfulAssignmentCount = 0;
    let waitingAssignmentCount = 0;
    
    reservationSiteRows.forEach((row, index) => {
      // 필요한 열들이 있는지 확인 (V열까지 = 22개 열 필요)
      if (row.length < 22) {
        skippedCount++;
        if (index < 10) {
          console.log(`❌ [건너뛴 고객 디버깅] 행 ${index + 1}: 열 개수 부족 (${row.length}/22)`);
        }
        return;
      }
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const reservationDateTime = (row[14] || '').toString().trim(); // O열: 예약일시
      const model = (row[15] || '').toString().trim(); // P열: 모델
      const capacity = (row[16] || '').toString().trim(); // Q열: 용량
      const color = (row[17] || '').toString().trim(); // R열: 색상
      const posCode = (row[21] || '').toString().trim(); // V열: POS코드
      const yardReceivedDate = (row[11] || '').toString().trim(); // L열: 마당접수일 (임시)
      const onSaleReceivedDate = (row[12] || '').toString().trim(); // M열: 온세일접수일 (임시)
      const assignedSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
      const activationStatusFromSheet = (row[5] || '').toString().trim(); // F열: 개통완료 상태
      
      // 디버깅: 처음 몇 개 행의 개통완료 상태 확인
      if (index < 5) {
        console.log(`🔍 [개통완료 디버깅] 행 ${index + 1}: 예약번호=${reservationNumber}, F열값="${activationStatusFromSheet}"`);
      }
      
      if (!reservationNumber || !customerName || !model || !capacity || !color || !posCode) {
        skippedCount++;
        return;
      }
      
      // 정규화된 모델명 생성 (사전예약사이트 형식)
      const reservationSiteModel = `${model} ${capacity} ${color}`.trim();
      const normalizedRule = normalizationRules.get(reservationSiteModel);
      

      
      // 배정 상태 계산 (정규화 규칙과 관계없이 개통완료 상태는 먼저 설정)
      let assignmentStatus = '미배정';
      let activationStatus = activationStatusFromSheet || '미개통'; // 사전예약사이트 F열 값을 그대로 사용
      let assignedSerial = '';
      let waitingOrder = 0;
      
      if (!normalizedRule) {
        normalizationFailedCount++;
        // 정규화 규칙이 없어도 개통완료 상태는 표시
        assignmentResults.push({
          reservationNumber,
          customerName,
          reservationDateTime,
          model: reservationSiteModel,
          posCode,
          yardReceivedDate,
          onSaleReceivedDate,
          assignmentStatus,
          activationStatus,
          assignedSerialNumber: assignedSerial,
          waitingOrder
        });
        processedCount++;
        return;
      }
      
      const phoneklModel = normalizedRule.phoneklModel;
      const phoneklColor = normalizedRule.phoneklColor;
      
      // 재고 키 생성
      const inventoryKey = `${phoneklModel}_${posCode}`;
      
      // 해당 재고 확인
      const availableSerials = availableInventory.get(inventoryKey) || [];
      
      // 이미 배정된 일련번호가 있는 경우
      if (assignedSerialNumber && assignedSerialNumber.trim() !== '') {
        assignedSerial = assignedSerialNumber;
        assignmentStatus = '배정완료';
        successfulAssignmentCount++;
        
      } else {
        // 새로운 배정이 필요한 경우
        const unassignedSerials = availableSerials.filter(serial => !assignedSerialNumbers.has(serial));
        
        if (unassignedSerials.length > 0) {
          // 배정 가능한 재고가 있음
          assignedSerial = unassignedSerials[0];
          assignmentStatus = '배정완료';
          assignedSerialNumbers.add(assignedSerial);
          successfulAssignmentCount++;
          
        } else {
          // 배정 대기 중 - 순번 계산
          const allCustomersForModel = reservationSiteRows.filter(r => {
            if (r.length < 22) return false;
            const rModel = (r[15] || '').toString().trim();
            const rCapacity = (r[16] || '').toString().trim();
            const rColor = (r[17] || '').toString().trim();
            const rPosCode = (r[21] || '').toString().trim();
            return `${rModel} ${rCapacity} ${rColor}`.trim() === reservationSiteModel && rPosCode === posCode;
          });
          
          // 개선된 우선순위별로 정렬 (예약번호 → 온세일일시 → 마당접수일 → 사이트예약일)
          allCustomersForModel.sort((a, b) => {
            const aReservationNumber = (a[8] || '').toString().trim(); // I열: 예약번호
            const bReservationNumber = (b[8] || '').toString().trim();
            const aOnSale = (a[12] || '').toString().trim(); // M열: 온세일접수일
            const bOnSale = (b[12] || '').toString().trim();
            const aYard = (a[11] || '').toString().trim(); // L열: 마당접수일
            const bYard = (b[11] || '').toString().trim();
            const aDateTime = (a[14] || '').toString().trim(); // O열: 사이트예약일
            const bDateTime = (b[14] || '').toString().trim();
            
            // 1순위: 예약번호 (고유문자, 순번이 아님)
            if (aReservationNumber !== bReservationNumber) {
              return aReservationNumber.localeCompare(bReservationNumber);
            }
            
            // 2순위: 온세일일시 낮은순 (오래된 것 우선)
            if (aOnSale && !bOnSale) return -1;
            if (!aOnSale && bOnSale) return 1;
            if (aOnSale && bOnSale) {
              return new Date(aOnSale) - new Date(bOnSale);
            }
            
            // 3순위: 마당접수일 낮은순 (오래된 것 우선)
            if (aYard && !bYard) return -1;
            if (!aYard && bYard) return 1;
            if (aYard && bYard) {
              return new Date(aYard) - new Date(bYard);
            }
            
            // 4순위: 사이트예약일 낮은순 (오래된 것 우선)
            return new Date(aDateTime) - new Date(bDateTime);
          });
          
          // 현재 고객의 순번 찾기
          const currentIndex = allCustomersForModel.findIndex(r => 
            (r[8] || '').toString().trim() === reservationNumber
          );
          
          if (currentIndex !== -1) {
            waitingOrder = currentIndex + 1;
            assignmentStatus = '미배정';
            waitingAssignmentCount++;
          }
        }
      }
      
      assignmentResults.push({
        reservationNumber,
        customerName,
        reservationDateTime,
        model: reservationSiteModel,
        posCode,
        yardReceivedDate,
        onSaleReceivedDate,
        assignmentStatus,
        activationStatus,
        assignedSerialNumber: assignedSerial,
        waitingOrder
      });
      
      processedCount++;
    });
    
    // 통계 계산
    const assignedCount = assignmentResults.filter(item => item.assignmentStatus === '배정완료').length;
    const unassignedCount = assignmentResults.filter(item => item.assignmentStatus === '미배정').length;
    const activatedCount = assignmentResults.filter(item => item.activationStatus === '개통완료').length;
    const notActivatedCount = assignmentResults.filter(item => item.activationStatus === '미개통').length;
    
    const result = {
      success: true,
      data: assignmentResults,
      total: assignmentResults.length,
      stats: {
        assigned: assignedCount,
        unassigned: unassignedCount,
        activated: activatedCount,
        notActivated: notActivatedCount
      }
    };
    
    // 결과 캐싱 (30분 TTL)
    cacheUtils.set(cacheKey, result, 30 * 60);
    console.log('✅ [서버 디버깅] 결과 캐싱 완료');
    
    // 디버깅 로그 추가
    const activatedFromSheetCount = assignmentResults.filter(item => item.activationStatus === '개통완료').length;
    console.log(`📊 [개통완료 표시] 사전예약사이트 F열 값 그대로 표시: ${activatedFromSheetCount}건`);
    
    console.log('🎉 [서버 디버깅] API 응답 전송 완료');
    res.json(result);
    
  } catch (error) {
    console.error('❌ [서버 디버깅] 재고배정 상태 계산 오류:', error);
    console.error('❌ [서버 디버깅] 오류 스택:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate inventory assignment status',
      message: error.message
    });
  }
});

// 배정 저장 API
app.post('/api/inventory/save-assignment', async (req, res) => {
  try {
    console.log('💾 [배정저장 디버깅] 배정 저장 시작');
    
    const { assignments } = req.body; // [{ reservationNumber, assignedSerialNumber }]
    
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid assignments data'
      });
    }
    
    console.log(`📊 [배정저장 디버깅] 저장할 배정 수: ${assignments.length}개`);
    
    // 사전예약사이트 시트 데이터 가져오기
    const reservationSiteValues = await getSheetValues('사전예약사이트');
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    // 배정 데이터를 예약번호로 매핑
    const assignmentMap = new Map();
    assignments.forEach(assignment => {
      assignmentMap.set(assignment.reservationNumber, assignment.assignedSerialNumber);
    });
    
    // 중복 배정 자동 정리 로직
    console.log('🧹 [중복정리] 중복 배정 데이터 자동 정리 시작');
    const serialToReservations = new Map(); // 일련번호별 예약번호 매핑
    const reservationToSerial = new Map(); // 예약번호별 일련번호 매핑
    
    // 기존 배정 데이터 수집 (개통완료 고객 제외 - 일련번호를 다른 고객에게 배정하기 위해)
    for (let i = 1; i < reservationSiteValues.length; i++) {
      const row = reservationSiteValues[i];
      if (row.length < 22) continue;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
      const activationStatus = (row[5] || '').toString().trim(); // F열: 개통상태
      
      // 개통완료된 고객은 중복 정리에서 제외 (일련번호를 다른 고객에게 배정하기 위해)
      if (existingSerial && existingSerial.trim() !== '' && activationStatus !== '개통완료') {
        if (!serialToReservations.has(existingSerial)) {
          serialToReservations.set(existingSerial, []);
        }
        serialToReservations.get(existingSerial).push(reservationNumber);
        reservationToSerial.set(reservationNumber, existingSerial);
      }
    }
    
    // 중복 배정된 일련번호들 정리
    let cleanedCount = 0;
    for (const [serialNumber, reservationNumbers] of serialToReservations.entries()) {
      if (reservationNumbers.length > 1) {
        console.log(`⚠️ [중복정리] 일련번호 ${serialNumber}에 ${reservationNumbers.length}개 고객 배정됨: ${reservationNumbers.join(', ')}`);
        
        // 우선순위에 따라 첫 번째 고객만 남기고 나머지는 배정 해제
        const sortedReservations = reservationNumbers.sort((a, b) => {
          // 예약번호 순서로 정렬 (고유문자)
          return a.localeCompare(b);
        });
        
        // 첫 번째 고객만 유지하고 나머지는 배정 해제
        for (let i = 1; i < sortedReservations.length; i++) {
          const reservationToRemove = sortedReservations[i];
          
          // 해당 행에서 배정 해제
          for (let j = 1; j < reservationSiteValues.length; j++) {
            const row = reservationSiteValues[j];
            if (row.length < 22) continue;
            
            const reservationNumber = (row[8] || '').toString().trim();
            if (reservationNumber === reservationToRemove) {
              row[6] = ''; // G열 배정 해제
              cleanedCount++;
              console.log(`🧹 [중복정리] 배정 해제: ${reservationToRemove} (일련번호: ${serialNumber})`);
              break;
            }
          }
        }
      }
    }
    
    console.log(`✅ [중복정리] 중복 배정 정리 완료: ${cleanedCount}개 배정 해제`);
    
    // 시트 데이터 업데이트 (G열에 일련번호 저장)
    let updatedCount = 0;
    let skippedCount = 0;
    
    // 이미 배정된 일련번호 추적 (중복 배정 방지)
    const assignedSerials = new Set();
    
    // 기존 배정된 일련번호들을 먼저 수집
    for (let i = 1; i < reservationSiteValues.length; i++) {
      const row = reservationSiteValues[i];
      if (row.length < 22) continue;
      
      const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
      if (existingSerial && existingSerial.trim() !== '') {
        assignedSerials.add(existingSerial);
      }
    }
    
    console.log(`📊 [배정저장 디버깅] 기존 배정된 일련번호 ${assignedSerials.size}개 확인`);
    
    // 1단계: 모든 고객에 대해 개통완료 체크 (배정 대상 여부와 관계없이)
    for (let i = 1; i < reservationSiteValues.length; i++) {
      const row = reservationSiteValues[i];
      if (row.length < 22) continue;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
      const activationStatus = (row[5] || '').toString().trim(); // F열: 개통상태
      
      // 개통완료된 고객은 새로운 배정에서만 제외 (기존 일련번호는 유지)
      if (activationStatus === '개통완료') {
        console.log(`⚠️ [배정저장 디버깅] 개통완료 고객 배정 건너뜀: ${reservationNumber}`);
        skippedCount++;
        continue; // 새로운 배정만 건너뜀, 기존 일련번호는 그대로 유지
      }
    }
    
    // 2단계: 배정 대상 고객들에 대해 배정 로직 실행
    for (let i = 1; i < reservationSiteValues.length; i++) {
      const row = reservationSiteValues[i];
      if (row.length < 22) continue;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
      const activationStatus = (row[5] || '').toString().trim(); // F열: 개통상태
      
      if (assignmentMap.has(reservationNumber)) {
        const newSerial = assignmentMap.get(reservationNumber);
        
        // 개통완료된 고객은 새로운 배정에서만 제외 (기존 일련번호는 유지)
        if (activationStatus === '개통완료') {
          console.log(`⚠️ [배정저장 디버깅] 개통완료 고객 배정 건너뜀: ${reservationNumber}`);
          skippedCount++;
          continue; // 새로운 배정만 건너뜀, 기존 일련번호는 그대로 유지
        }
        
        // 기존 배정된 일련번호가 있으면 유지
        if (existingSerial && existingSerial.trim() !== '') {
          console.log(`⚠️ [배정저장 디버깅] 기존 배정 유지: ${reservationNumber} (${existingSerial})`);
          skippedCount++;
          continue;
        }
        
        // 새로운 배정 시 일련번호 중복 체크
        if (assignedSerials.has(newSerial)) {
          console.log(`❌ [배정저장 디버깅] 일련번호 중복으로 배정 실패: ${reservationNumber} → ${newSerial} (이미 배정됨)`);
          skippedCount++;
          continue;
        }
        
        // 새로운 배정 저장
        row[6] = newSerial; // G열에 일련번호 저장
        assignedSerials.add(newSerial); // 배정된 일련번호 추적에 추가
        updatedCount++;
        console.log(`✅ [배정저장 디버깅] 배정 저장: ${reservationNumber} → ${newSerial}`);
      }
    }
    
          // 업데이트된 데이터를 시트에 저장
      if (updatedCount > 0) {
        try {
          const sheets = google.sheets({ version: 'v4', auth });
          const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
          
          // spreadsheetId 검증
          if (!spreadsheetId) {
            throw new Error('GOOGLE_SHEET_ID 또는 SHEET_ID 환경변수가 설정되지 않았습니다.');
          }
          
          console.log(`🔧 [배정저장 디버깅] Google Sheets 업데이트 시작 - Spreadsheet ID: ${spreadsheetId.substring(0, 10)}...`);
          
                      // G열만 업데이트 (배정일련번호) - 중복 정리된 데이터 포함
            const range = '사전예약사이트!G2:G' + (reservationSiteValues.length);
            const values = reservationSiteValues.slice(1).map(row => [row[6] || '']); // G열 데이터만 추출
          
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            resource: { values }
          });
          
          console.log(`💾 [배정저장 디버깅] Google Sheets 업데이트 완료: ${updatedCount}개 저장`);
        } catch (error) {
          console.error('❌ [배정저장 디버깅] Google Sheets 업데이트 실패:', error.message);
          console.error('❌ [배정저장 디버깅] 환경변수 확인 필요: GOOGLE_SHEET_ID');
          throw error;
        }
      }
    
    console.log(`📈 [배정저장 디버깅] 저장 완료: ${updatedCount}개 저장, ${skippedCount}개 유지, ${cleanedCount}개 중복정리`);
    
    res.json({
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      cleaned: cleanedCount,
      total: assignments.length
    });
    
  } catch (error) {
    console.error('❌ [배정저장 디버깅] 배정 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save assignment',
      message: error.message
    });
  }
});

// 대리점아이디관리 시트에서 사무실별, 소속별 데이터 가져오기 API
app.get('/api/agent-office-department', async (req, res) => {
  try {
    console.log('📊 [대리점관리 디버깅] 사무실별, 소속별 데이터 로드 시작');
    
    // 캐시 키 생성
    const cacheKey = 'agent_office_department';
    
    // 캐시에서 먼저 확인 (30분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 대리점아이디관리 시트 데이터 가져오기
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    
    if (!agentValues || agentValues.length < 2) {
      throw new Error('대리점아이디관리 데이터를 가져올 수 없습니다.');
    }
    
    console.log(`📊 [대리점관리 디버깅] 대리점아이디관리 데이터: ${agentValues.length}행`);
    
    // 사무실별, 소속별 데이터 추출
    const offices = new Set();
    const departments = new Map(); // key: 사무실, value: Set of 소속들
    const agentInfo = new Map(); // key: 담당자명, value: { office, department }
    
    agentValues.slice(1).forEach(row => {
      if (row.length >= 5) {
        const agentName = (row[0] || '').toString().trim(); // A열: 담당자명
        const office = (row[3] || '').toString().trim(); // D열: 사무실
        const department = (row[4] || '').toString().trim(); // E열: 소속
        
        if (agentName && office) {
          offices.add(office);
          
          if (!departments.has(office)) {
            departments.set(office, new Set());
          }
          departments.get(office).add(department);
          
          agentInfo.set(agentName, { office, department });
        }
      }
    });
    
    // 결과 데이터 구성
    const result = {
      offices: Array.from(offices).sort(),
      departments: {},
      agentInfo: Object.fromEntries(agentInfo)
    };
    
    // 사무실별 소속 목록 구성
    departments.forEach((deptSet, office) => {
      result.departments[office] = Array.from(deptSet).filter(Boolean).sort();
    });
    
    console.log(`📊 [대리점관리 디버깅] 사무실: ${result.offices.length}개, 담당자: ${Object.keys(result.agentInfo).length}명`);
    
    const responseData = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    
    // 캐시에 저장 (30분 TTL)
    cacheUtils.set(cacheKey, responseData, 30 * 60 * 1000);
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ [대리점관리 디버깅] 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load agent office department data',
      message: error.message
    });
  }
});

// 정규화작업시트 C열 기준 사무실별 재고 현황 API
app.get('/api/inventory/normalized-status', async (req, res) => {
  try {
    console.log('📊 [재고현황 디버깅] 정규화작업시트 C열 기준 사무실별 재고 현황 로드 시작');
    
    // 캐시 키 생성
    const cacheKey = 'inventory_normalized_status';
    
    // 캐시에서 먼저 확인 (10분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log('📊 [재고현황 디버깅] 캐시에서 데이터 반환');
      return res.json(cachedData);
    }
    
    console.log('📊 [재고현황 디버깅] 시트 데이터 로드 시작');
    
    // 필요한 시트 데이터 병렬로 가져오기
    const [normalizationValues, phoneklInventoryValues] = await Promise.all([
      getSheetValues('정규화작업'),
      getSheetValues('폰클재고데이터')
    ]);
    
    console.log('📊 [재고현황 디버깅] 시트 데이터 로드 완료');
    
    if (!normalizationValues || normalizationValues.length < 2) {
      throw new Error('정규화작업 데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklInventoryValues || phoneklInventoryValues.length < 2) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    console.log(`📊 [재고현황 디버깅] 정규화작업 데이터: ${normalizationValues.length}행, 폰클재고데이터: ${phoneklInventoryValues.length}행`);
    
    // 정규화작업 C열에 있는 모델들만 추출
    const validModels = new Set();
    normalizationValues.slice(1).forEach(row => {
      if (row.length >= 2) {
        const reservationSiteModel = (row[1] || '').toString().trim(); // C열: 사전예약사이트 형식
        if (reservationSiteModel) {
          validModels.add(reservationSiteModel);
          console.log(`📊 [재고현황 디버깅] 유효한 모델 추가: ${reservationSiteModel}`);
        }
      }
    });
    
    console.log(`📊 [재고현황 디버깅] 유효한 모델 개수: ${validModels.size}`);
    
    // 폰클재고데이터에서 사무실별 모델별 재고 수량 집계
    const officeInventory = {
      '평택사무실': new Map(), // key: "모델명|색상", value: 수량
      '인천사무실': new Map(),
      '군산사무실': new Map(),
      '안산사무실': new Map()
    };
    
    let processedRows = 0;
    let matchedOffices = 0;
    let matchedModels = 0;
    
    phoneklInventoryValues.slice(1).forEach(row => {
      if (row.length >= 22) {
        const modelCapacity = (row[13] || '').toString().trim(); // F열: 모델명&용량 (5+8)
        const color = (row[14] || '').toString().trim(); // G열: 색상 (6+8)
        const storeName = (row[21] || '').toString().trim(); // N열: 출고처 (13+8)
        
        if (modelCapacity && color && storeName) {
          processedRows++;
          
          // 사무실명은 원래 이름 그대로 사용
          let officeName = '';
          
          if (storeName.includes('평택사무실')) {
            officeName = '평택사무실';
          } else if (storeName.includes('인천사무실')) {
            officeName = '인천사무실';
          } else if (storeName.includes('군산사무실')) {
            officeName = '군산사무실';
          } else if (storeName.includes('안산사무실')) {
            officeName = '안산사무실';
          }
          
          if (officeName && officeInventory[officeName]) {
            // F열 + "|" + G열 조합 생성
            const modelWithColor = `${modelCapacity} | ${color}`;
            
            // 정규화작업 C열에 있는 모델인지 확인
            if (validModels.has(modelWithColor)) {
              matchedModels++;
              
              // 사무실별로 카운팅
              if (!officeInventory[officeName].has(modelWithColor)) {
                officeInventory[officeName].set(modelWithColor, 0);
              }
              officeInventory[officeName].set(modelWithColor, officeInventory[officeName].get(modelWithColor) + 1);
              
              matchedOffices++;
            }
          }
        }
      }
    });
    
    console.log(`📊 [재고현황 디버깅] 처리된 행: ${processedRows}, 매칭된 사무실: ${matchedOffices}, 매칭된 모델: ${matchedModels}`);
    
    // 정규화 규칙을 통해 사무실별 사전예약사이트 형식으로 변환
    const result = {
      '평택사무실': {},
      '인천사무실': {},
      '군산사무실': {},
      '안산사무실': {}
    };
    
    Object.keys(officeInventory).forEach(officeName => {
      const officeData = officeInventory[officeName];
      officeData.forEach((count, reservationSiteModel) => {
        if (count > 0) {
          result[officeName][reservationSiteModel] = count;
        }
      });
    });
    
    // 각 사무실별 모델 개수 로그
    Object.keys(result).forEach(officeName => {
      const modelCount = Object.keys(result[officeName]).length;
      console.log(`📊 [재고현황 디버깅] ${officeName}: ${modelCount}개 모델`);
    });
    
    const responseData = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    
    // 캐시에 저장 (10분 TTL)
    cacheUtils.set(cacheKey, responseData, 10 * 60 * 1000);
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ [재고현황 디버깅] 재고 현황 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load normalized inventory status',
      message: error.message
    });
  }
});

// 수동 배정 실행 API
app.post('/api/inventory/manual-assignment', async (req, res) => {
  try {
    console.log('🔧 [수동배정 디버깅] 수동 배정 실행 시작');
    
    // 필요한 시트 데이터 병렬로 가져오기
    const [reservationSiteValues, phoneklInventoryValues, phoneklStoreValues, normalizationValues] = await Promise.all([
      getSheetValues('사전예약사이트'),
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클출고처데이터'),
      getSheetValues('정규화작업')
    ]);
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklInventoryValues || phoneklInventoryValues.length < 2) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklStoreValues || phoneklStoreValues.length < 2) {
      throw new Error('폰클출고처데이터를 가져올 수 없습니다.');
    }
    
    // 정규화 규칙 로드
    const normalizationRules = new Map();
    if (normalizationValues && normalizationValues.length > 1) {
      normalizationValues.slice(1).forEach(row => {
        if (row.length >= 3) {
          const reservationSite = (row[1] || '').toString().trim(); // C열: 사전예약사이트 형식
          const phoneklModel = (row[2] || '').toString().trim(); // D열: 폰클
          const phoneklColor = (row[3] || '').toString().trim(); // E열: 색상
          
          if (reservationSite && phoneklModel && phoneklColor) {
            const key = reservationSite.replace(/\s*\|\s*/g, ' ').trim();
            normalizationRules.set(key, { phoneklModel, phoneklColor });
          }
        }
      });
    }
    
    // 폰클출고처데이터에서 POS코드 매핑 생성
    const storePosCodeMapping = new Map();
    phoneklStoreValues.slice(1).forEach(row => {
      if (row.length >= 8) {
        const storeName = (row[6] || '').toString().trim(); // G열: 출고처명
        const posCode = (row[7] || '').toString().trim(); // H열: POS코드
        
        if (storeName && posCode) {
          storePosCodeMapping.set(storeName, posCode);
        }
      }
    });
    
    // 폰클재고데이터에서 사용 가능한 재고 정보 생성
    const availableInventory = new Map(); // key: "모델명_색상_POS코드", value: [일련번호들]
    const serialNumberToStore = new Map(); // key: 일련번호, value: 출고처명
    
    phoneklInventoryValues.slice(1).forEach(row => {
      if (row.length >= 22) {
        const serialNumber = (row[11] || '').toString().trim(); // D열: 일련번호 (3+8)
        const modelCapacity = (row[13] || '').toString().trim(); // F열: 모델명&용량 (5+8)
        const color = (row[14] || '').toString().trim(); // G열: 색상 (6+8)
        const storeName = (row[21] || '').toString().trim(); // N열: 출고처 (13+8)
        
        if (serialNumber && modelCapacity && color && storeName) {
          const posCode = storePosCodeMapping.get(storeName);
          if (posCode) {
            let modelWithColor = modelCapacity;
            if (!modelCapacity.includes('|') && color) {
              modelWithColor = `${modelCapacity} | ${color}`;
            }
            const key = `${modelWithColor}_${posCode}`;
            
            if (!availableInventory.has(key)) {
              availableInventory.set(key, []);
            }
            availableInventory.get(key).push(serialNumber);
            
            serialNumberToStore.set(serialNumber, storeName);
          }
        }
      }
    });
    
    // 이미 배정된 일련번호 추적
    const assignedSerialNumbers = new Set();
    reservationSiteValues.slice(1).forEach(row => {
      if (row.length >= 22) {
        const assignedSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
        if (assignedSerialNumber && assignedSerialNumber.trim() !== '') {
          assignedSerialNumbers.add(assignedSerialNumber);
        }
      }
    });
    
    // 사전예약사이트 데이터 처리 및 배정
    const reservationSiteRows = reservationSiteValues.slice(1);
    const assignments = [];
    let processedCount = 0;
    let assignedCount = 0;
    let skippedCount = 0;
    
    reservationSiteRows.forEach((row, index) => {
      if (row.length < 22) {
        skippedCount++;
        return;
      }
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const model = (row[15] || '').toString().trim(); // P열: 모델
      const capacity = (row[16] || '').toString().trim(); // Q열: 용량
      const color = (row[17] || '').toString().trim(); // R열: 색상
      const posCode = (row[21] || '').toString().trim(); // V열: POS코드
      const assignedSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
      
      if (!reservationNumber || !customerName || !model || !capacity || !color || !posCode) {
        skippedCount++;
        return;
      }
      
      // 이미 배정된 경우 건너뛰기
      if (assignedSerialNumber && assignedSerialNumber.trim() !== '') {
        skippedCount++;
        return;
      }
      
      // 정규화된 모델명 생성
      const reservationSiteModel = `${model} ${capacity} ${color}`.trim();
      const normalizedRule = normalizationRules.get(reservationSiteModel);
      
      if (!normalizedRule) {
        skippedCount++;
        return;
      }
      
      const phoneklModel = normalizedRule.phoneklModel;
      const phoneklColor = normalizedRule.phoneklColor;
      
      // 재고 키 생성
      const inventoryKey = `${phoneklModel}_${posCode}`;
      const availableSerials = availableInventory.get(inventoryKey) || [];
      
      // 사용 가능한 일련번호 중 배정되지 않은 것 찾기
      const availableSerial = availableSerials.find(serial => !assignedSerialNumbers.has(serial));
      
      if (availableSerial) {
        assignments.push({
          reservationNumber,
          assignedSerialNumber: availableSerial
        });
        assignedSerialNumbers.add(availableSerial);
        assignedCount++;
      }
      
      processedCount++;
    });
    
    console.log(`📊 [수동배정 디버깅] 수동 배정 완료: ${assignedCount}개 배정, ${skippedCount}개 건너뜀, ${processedCount}개 처리`);
    
    // 배정 결과 저장
    if (assignments.length > 0) {
      const saveResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/save-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ assignments })
      });
      
      if (saveResponse.ok) {
        const saveResult = await saveResponse.json();
        console.log(`💾 [수동배정 디버깅] 배정 저장 완료: ${saveResult.updated}개 저장`);
      }
    }
    
    res.json({
      success: true,
      assigned: assignedCount,
      skipped: skippedCount,
      processed: processedCount,
      total: assignments.length
    });
    
  } catch (error) {
    console.error('❌ [수동배정 디버깅] 수동 배정 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute manual assignment',
      message: error.message
    });
  }
});

// 실시간 개통 상태 확인 API
app.get('/api/inventory/activation-status', async (req, res) => {
  try {

    
    // 캐시 키 생성
    const cacheKey = 'inventory_activation_status';
    
    // 캐시에서 먼저 확인 (1분 TTL로 단축)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log('✅ [개통상태 디버깅] 캐시된 개통 상태 반환');
      return res.json(cachedData);
    }
    
    // 고객명 정규화 함수
    const cleanCustomerName = (name) => {
      return name.replace(/\([^)]*\)/g, '').trim(); // 괄호 제거
    };
    
    // 폰클개통데이터에서 개통 완료된 고객 수집 (고객명 + 개통번호 끝 4자리)
    const phoneklActivationValues = await getSheetValues('폰클개통데이터');
    
    if (!phoneklActivationValues || phoneklActivationValues.length < 2) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    // 디버깅: 폰클개통데이터 헤더 확인
    console.log('🔍 [개통매칭 디버깅] 폰클개통데이터 헤더:', phoneklActivationValues[0]);
    console.log('🔍 [개통매칭 디버깅] 폰클개통데이터 총 행 수:', phoneklActivationValues.length);
    
    // 처음 3개 데이터 행의 구조 확인
    for (let i = 1; i <= Math.min(3, phoneklActivationValues.length - 1); i++) {
      console.log(`🔍 [개통매칭 디버깅] 폰클개통데이터 행 ${i}:`, phoneklActivationValues[i]);
    }
    
    const activatedCustomers = new Set();
    let activationCount = 0;
    
    phoneklActivationValues.slice(1).forEach((row, index) => {
      if (row.length >= 18) {
        const customerName = cleanCustomerName((row[16] || '').toString().trim()); // Q열: 고객명
        const activationNumber = (row[17] || '').toString().trim(); // R열: 개통번호
        
        // 디버깅: 처음 5개 개통 데이터 확인
        if (index < 5) {
          console.log(`🔍 [개통매칭 디버깅] 폰클개통데이터 행 ${index + 1}: 고객명="${customerName}", 개통번호="${activationNumber}"`);
        }
        
        if (customerName && activationNumber && activationNumber.length >= 4) {
          const lastFourDigits = activationNumber.slice(-4); // 끝 4자리
          const activationKey = `${customerName}_${lastFourDigits}`;
          
          activatedCustomers.add(activationKey);
          activationCount++;
          
          // 디버깅: 매칭 키 확인
          if (index < 5) {
            console.log(`🔍 [개통매칭 디버깅] 매칭키 생성: "${activationKey}"`);
          }
        }
      }
    });
    
    console.log(`📊 [개통매칭 디버깅] 폰클개통데이터에서 수집된 개통 고객: ${activationCount}명`);
    

    
    // 사전예약사이트에서 고객명 + 전화번호 끝 4자리로 매칭
    const reservationSiteValues = await getSheetValues('사전예약사이트');
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    const activationResults = [];
    let matchedCount = 0;
    
    reservationSiteValues.slice(1).forEach((row, index) => {
      if (row.length < 10) return;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = cleanCustomerName((row[7] || '').toString().trim()); // H열: 고객명
      const phoneNumber = (row[9] || '').toString().trim(); // J열: 고객전화번호
      
      // 디버깅: 처음 5개 사전예약사이트 데이터 확인
      if (index < 5) {
        console.log(`🔍 [개통매칭 디버깅] 사전예약사이트 행 ${index + 1}: 예약번호="${reservationNumber}", 고객명="${customerName}", 전화번호="${phoneNumber}"`);
      }
      
      if (reservationNumber && customerName && phoneNumber && phoneNumber.length >= 4) {
        const lastFourDigits = phoneNumber.slice(-4); // 끝 4자리
        const reservationKey = `${customerName}_${lastFourDigits}`;
        const isActivated = activatedCustomers.has(reservationKey);
        
        // 디버깅: 매칭 키와 결과 확인
        if (index < 5) {
          console.log(`🔍 [개통매칭 디버깅] 사전예약사이트 매칭키: "${reservationKey}", 개통여부: ${isActivated}`);
        }
        
        activationResults.push({
          reservationNumber,
          customerName,
          phoneNumber: lastFourDigits, // 끝 4자리만 저장
          activationStatus: isActivated ? '개통완료' : '미개통'
        });
        
        if (isActivated) {
          matchedCount++;
        }
      }
    });
    
    console.log(`📈 [개통상태 디버깅] 개통 상태 매칭 완료: ${matchedCount}개 개통완료, ${activationResults.length - matchedCount}개 미개통`);
    
    // 사전예약사이트 시트에 개통 상태 저장 (F열)
    try {
      console.log('💾 [개통상태 디버깅] 사전예약사이트 시트에 개통 상태 저장 시작');
      
      // 예약번호를 키로 하는 개통 상태 맵 생성
      const activationStatusMap = new Map();
      activationResults.forEach(item => {
        activationStatusMap.set(item.reservationNumber, item.activationStatus);
      });
      
      // 사전예약사이트 데이터 업데이트
      let updatedCount = 0;
      const updatedRows = reservationSiteValues.map((row, index) => {
        if (index === 0) return row; // 헤더는 그대로 유지
        
        if (row.length < 10) return row;
        
        const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
        const activationStatus = activationStatusMap.get(reservationNumber);
        
        if (activationStatus) {
          // F열(5번째)에 개통 상태 저장
          const newRow = [...row];
          newRow[5] = activationStatus; // F열: 개통완료 또는 미개통
          updatedCount++;
          return newRow;
        }
        
        return row;
      });
      
      // Google Sheets에 업데이트된 데이터 저장
      if (updatedCount > 0) {
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
        
        if (!spreadsheetId) {
          throw new Error('GOOGLE_SHEET_ID 또는 SHEET_ID 환경변수가 설정되지 않았습니다.');
        }
        
        // F열만 업데이트 (개통상태)
        const range = '사전예약사이트!F2:F' + (updatedRows.length);
        const values = updatedRows.slice(1).map(row => [row[5] || '']); // F열 데이터만 추출
        
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          resource: { values }
        });
        
        console.log(`💾 [개통상태 디버깅] 사전예약사이트 시트 업데이트 완료: ${updatedCount}개 고객의 개통 상태 저장`);
      } else {
        console.log('💾 [개통상태 디버깅] 업데이트할 개통 상태가 없습니다.');
      }
      
    } catch (error) {
      console.error('❌ [개통상태 디버깅] 사전예약사이트 시트 업데이트 실패:', error.message);
      // 시트 업데이트 실패해도 API 응답은 정상 반환
    }
    
    const result = {
      success: true,
      data: activationResults,
      total: activationResults.length,
      activated: matchedCount,
      notActivated: activationResults.length - matchedCount
    };
    
    // 결과 캐싱 (1분 TTL로 단축)
    cacheUtils.set(cacheKey, result, 1 * 60);
    
    console.log('✅ [개통상태 디버깅] 개통 상태 확인 완료');
    res.json(result);
    
  } catch (error) {
    console.error('❌ [개통상태 디버깅] 개통 상태 확인 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check activation status',
      message: error.message
    });
  }
});

// 팀 라우트 설정
setupTeamRoutes(app, getSheetValuesWithoutCache);

// OB 관리모드 라우트 설정
try {
  setupObRoutes(app);
  console.log('✅ [OB] OB routes mounted at /api/ob');
} catch (e) {
  console.error('❌ [OB] Failed to mount OB routes:', e.message);
}

// 정책그룹 목록 가져오기 API
app.get('/api/budget/policy-groups', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 폰클출고처데이터 시트에서 S열 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!S:S',
    });
    
    const values = response.data.values || [];
    
    // S열에서 정책그룹 데이터 추출 및 정리
    const policyGroups = new Set();
    values.forEach(row => {
      if (row[0] && row[0].trim()) {
        // 괄호와 괄호 안 내용 제거 (예: "홍기현(2/2)" -> "홍기현")
        const cleanGroup = row[0].replace(/\([^)]*\)/g, '').trim();
        if (cleanGroup) {
          policyGroups.add(cleanGroup);
        }
      }
    });
    
    // Set을 배열로 변환하고 정렬
    const sortedPolicyGroups = Array.from(policyGroups).sort();
    
    res.json({ policyGroups: sortedPolicyGroups });
  } catch (error) {
    console.error('정책그룹 목록 가져오기 오류:', error);
    res.status(500).json({ error: '정책그룹 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 정책그룹 설정 저장 API
app.post('/api/budget/policy-group-settings', async (req, res) => {
  try {
    const { name, selectedGroups } = req.body;
    
    if (!name || !selectedGroups || !Array.isArray(selectedGroups)) {
      return res.status(400).json({ error: '저장이름과 선택된 정책그룹이 필요합니다.' });
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 기존 설정 목록 가져오기
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_정책그룹관리!A:B',
    });
    
    const existingRows = existingData.data.values || [];
    
    // 시트가 비어있거나 헤더가 없는 경우 헤더 추가
    if (existingRows.length === 0 || !existingRows[0] || existingRows[0][0] !== '저장이름') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '예산_정책그룹관리!A1:B1',
        valueInputOption: 'RAW',
        resource: {
          values: [['저장이름', '선택된정책그룹']]
        }
      });
      existingRows = [['저장이름', '선택된정책그룹']];
    }
    
    // 중복 이름 체크 (헤더 제외)
    const isDuplicate = existingRows.slice(1).some(row => row[0] === name);
    if (isDuplicate) {
      return res.status(400).json({ error: '이미 존재하는 저장이름입니다.' });
    }
    
    // 새 설정 추가
    const newRow = [name, selectedGroups.join(',')];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_정책그룹관리!A:B',
      valueInputOption: 'RAW',
      resource: {
        values: [newRow]
      }
    });
    
    res.json({ message: '정책그룹 설정이 저장되었습니다.' });
  } catch (error) {
    console.error('정책그룹 설정 저장 오류:', error);
    res.status(500).json({ error: '정책그룹 설정 저장 중 오류가 발생했습니다.' });
  }
});

// 정책그룹 설정 목록 가져오기 API
app.get('/api/budget/policy-group-settings', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_정책그룹관리!A:B',
    });
    
    const rows = response.data.values || [];
    
    // 시트가 비어있거나 헤더가 없거나 헤더만 있는 경우 빈 배열 반환
    if (rows.length === 0 || rows.length === 1 || !rows[0] || rows[0][0] !== '저장이름') {
      return res.json({ settings: [] });
    }
    
    // 헤더 제외하고 데이터만 반환
    const settings = rows.slice(1).map(row => ({
      name: row[0] || '',
      groups: row[1] ? row[1].split(',').filter(group => group.trim()) : []
    })).filter(setting => setting.name.trim()); // 빈 이름 제거
    
    res.json({ settings });
  } catch (error) {
    console.error('정책그룹 설정 목록 가져오기 오류:', error);
    res.status(500).json({ error: '정책그룹 설정 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 정책그룹 설정 삭제 API
app.delete('/api/budget/policy-group-settings/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 기존 설정 목록 가져오기
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_정책그룹관리!A:B',
    });
    
    const existingRows = existingData.data.values || [];
    
    // 삭제할 행 찾기
    const rowIndex = existingRows.findIndex(row => row[0] === name);
    if (rowIndex === -1) {
      return res.status(404).json({ error: '해당 설정을 찾을 수 없습니다.' });
    }
    
    // 행 삭제 (헤더 제외하고 실제 데이터 행 번호 계산)
    const actualRowNumber = rowIndex + 1;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetIdByName('예산_정책그룹관리'),
                dimension: 'ROWS',
                startIndex: actualRowNumber,
                endIndex: actualRowNumber + 1
              }
            }
          }
        ]
      }
    });
    
    res.json({ message: '정책그룹 설정이 삭제되었습니다.' });
  } catch (error) {
    console.error('정책그룹 설정 삭제 오류:', error);
    res.status(500).json({ error: '정책그룹 설정 삭제 중 오류가 발생했습니다.' });
  }
});

// 날짜 정규화 함수들
function normalizeReceptionDate(receptionDateStr) {
  if (!receptionDateStr || receptionDateStr === '#N/A' || receptionDateStr.trim() === '') return null;
  
  // "2025. 6. 30 오후 2:45:00" 형식을 Date 객체로 변환
  try {
    // 한국어 시간 형식을 영어로 변환하고 공백 정리
    let normalizedStr = receptionDateStr.trim()
      .replace(/오전/g, 'AM')
      .replace(/오후/g, 'PM')
      .replace(/\./g, '/')
      .replace(/\s+/g, ' '); // 여러 공백을 하나로
    
    // "2025/ 6/ 13 PM 12:48:00" -> "2025/6/13 PM 12:48:00" 형태로 정리
    normalizedStr = normalizedStr.replace(/\s*\//g, '/').replace(/\/\s*/g, '/');
    
    const date = new Date(normalizedStr);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      // 유효하지 않은 접수일 형식
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('접수일 정규화 오류:', error, '원본값:', receptionDateStr);
    return null;
  }
}

function normalizeActivationDate(dateStr, hourStr, minuteStr) {
  if (!dateStr) return null;
  
  try {
    // "2025-06-30" 형식의 날짜
    const date = new Date(dateStr);
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      console.warn('유효하지 않은 개통일 형식:', dateStr);
      return null;
    }
    
    // 시간과 분이 있으면 추가
    if (hourStr && minuteStr) {
      const hour = parseInt(hourStr.replace(/시/g, '')) || 0;
      const minute = parseInt(minuteStr.replace(/분/g, '')) || 0;
      date.setHours(hour, minute, 0, 0);
    }
    
    return date;
  } catch (error) {
    console.error('개통일 정규화 오류:', error, '원본값:', dateStr, hourStr, minuteStr);
    return null;
  }
}

function isDateInRange(date, startDate, endDate) {
  if (!date || !startDate || !endDate) return false;
  
  const targetDate = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 시간을 00:00:00으로 설정하여 날짜만 비교
  targetDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999); // 종료일은 23:59:59로 설정
  
  return targetDate >= start && targetDate <= end;
}

// 사용자 시트명 가져오기 헬퍼 함수
async function getUserSheetName(userName, budgetType) {
  try {
    // 실제 생성된 시트명을 예산_사용자시트관리에서 조회 (1순위)
    const userSheetManagementResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_사용자시트관리!A:G'
    });
    
    const userSheetManagementData = userSheetManagementResponse.data.values || [];
    if (userSheetManagementData.length > 1) {
      // 사용자명에서 괄호와 공백을 완전히 제거
      const actualSheetOwner = userName.replace(/\([^)]+\)/g, '').trim();
      // 헤더 제외하고 해당 사용자의 예산타입별 시트명 찾기
      for (let i = 1; i < userSheetManagementData.length; i++) {
        const row = userSheetManagementData[i];
        if (row.length >= 3) {
          const sheetName = row[2]; // C열: 시트명
          // 시트명 패턴 매칭: 액면_김기송(Ⅰ)(이사) - 공백 제거로 일관성 확보
          const pattern = new RegExp(`^액면_${actualSheetOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(${budgetType}\\)\\([^)]+\\)$`);
          console.log(`🔍 [getUserSheetName] 패턴 매칭 시도: 시트명="${sheetName}", 패턴="${pattern.source}", actualSheetOwner="${actualSheetOwner}"`);
          if (pattern.test(sheetName)) {
            console.log(`🎯 [getUserSheetName] 실제 시트명 발견: ${sheetName}`);
            return sheetName;
          }
        }
      }
    }
  } catch (error) {
    console.error('[getUserSheetName] 예산_사용자시트관리 조회 실패:', error);
  }
  
  // Fallback: 현재 직급으로 시트명 생성 (2순위)
  try {
    const agentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${AGENT_SHEET_NAME}!A:R`
    });
    
    const agentValues = agentResponse.data.values || [];
    // 사용자명에서 괄호와 공백을 완전히 제거
    const actualSheetOwner = userName.replace(/\([^)]+\)/g, '').trim();
    const agentRow = agentValues.find(row => row[0] === actualSheetOwner); // A열에서 이름 찾기 (수정됨)
    const userQualification = agentRow ? agentRow[1] : '이사'; // B열의 qualification
    
    const fallbackSheetName = `액면_${actualSheetOwner}(${budgetType}) (${userQualification})`;
    console.log(`🎯 [getUserSheetName] Fallback 시트명: ${fallbackSheetName}`);
    return fallbackSheetName;
  } catch (error) {
    console.error('[getUserSheetName] 대리점아이디관리 조회 실패:', error);
    // 사용자명에서 괄호와 공백을 완전히 제거
    const actualSheetOwner = userName.replace(/\([^)]+\)/g, '').trim();
    return `액면_${actualSheetOwner}(${budgetType}) (이사)`;
  }
}

// 예산 매칭 계산 함수 (VLOOKUP 방식으로 완전히 새로 작성)
async function performBudgetMatching(userSheetData, phoneklData, selectedPolicyGroups, dateRange, budgetType) {
  console.log(`🧮 [performBudgetMatching] VLOOKUP 방식 시작: 정책그룹=${selectedPolicyGroups.join(',')}, 예산타입=${budgetType}`);
  
  // 메모리 사용량 모니터링
  const startMemory = process.memoryUsage();
  console.log(`🧠 [메모리] 시작: RSS=${Math.round(startMemory.rss / 1024 / 1024)}MB, Heap=${Math.round(startMemory.heapUsed / 1024 / 1024)}MB`);
  
  const calculationResults = [];
  const dataMapping = {};
  
  let totalSecuredBudget = 0;
  let totalUsedBudget = 0;
  let totalRemainingBudget = 0;
  let processedRows = 0;
  let matchedItems = 0;
  let policyGroupFiltered = 0;
  let dateRangeFiltered = 0;
  let modelMismatch = 0;
  
  // 배치 처리 설정
  const BATCH_SIZE = 50;
  let batchCount = 0;
  
  // 헤더 확인 (5행부터 시작)
  const dataStartRow = 4; // 0-based index (실제 5행)
  
  // 사용자시트 데이터를 복합 키로 인덱싱 (VLOOKUP 검색용)
  const userSheetIndex = new Map();
  
  console.log(`🔍 [인덱싱] 사용자시트 데이터 복합 키 인덱스 생성 시작...`);
  
  // 사용자시트 데이터 인덱싱 (헤더 제외)
  if (userSheetData.length > 1) {
    for (let i = 1; i < userSheetData.length; i++) {
      const userRow = userSheetData[i];
      if (userRow.length >= 12) {
        const userModelName = (userRow[5] || '').toString().trim(); // F열: 모델명
        const userArmyType = (userRow[6] || '').toString().trim(); // G열: 군 (S군, A군, B군 등)
        const userCategoryType = (userRow[7] || '').toString().trim(); // H열: 유형
        const userSecuredAmount = parseFloat((userRow[8] || '').toString().replace(/,/g, '')) || 0; // I열: 확보예산
        const userUsedAmount = parseFloat((userRow[9] || '').toString().replace(/,/g, '')) || 0; // J열: 사용예산
        const userRemainingAmount = parseFloat((userRow[10] || '').toString().replace(/,/g, '')) || 0; // K열: 예산잔액
        
        // 필수 데이터가 있는 경우만 인덱싱
        if (userModelName && userArmyType && userCategoryType) {
          // 정책군 매핑: S군 → S, A군 → A 등
          let mappedUserArmyType = '';
          if (userArmyType === 'S군') mappedUserArmyType = 'S';
          else if (userArmyType === 'A군') mappedUserArmyType = 'A';
          else if (userArmyType === 'B군') mappedUserArmyType = 'B';
          else if (userArmyType === 'C군') mappedUserArmyType = 'C';
          else if (userArmyType === 'D군') mappedUserArmyType = 'D';
          else if (userArmyType === 'E군') mappedUserArmyType = 'E';
          else mappedUserArmyType = userArmyType;
          
          // 복합 키 생성: 모델명&정책군&유형 (액면예산과 동일한 형식)
          const compositeKey = `${userModelName}&${mappedUserArmyType}&${userCategoryType}`;
          
          userSheetIndex.set(compositeKey, {
            securedBudget: userSecuredAmount,
            usedBudget: userUsedAmount,
            remainingBudget: userRemainingAmount,
            rowIndex: i,
            modelName: userModelName,
            armyType: userArmyType,
            categoryType: userCategoryType
          });
        }
      }
    }
  }
  
  console.log(`🔍 [인덱싱] 사용자시트 완료: ${userSheetIndex.size}개 복합 키`);
  
  // 액면예산 데이터를 기준으로 VLOOKUP 수행
  console.log(`🔍 [VLOOKUP] 액면예산 기준으로 사용자시트 검색 시작...`);
  
  for (let j = dataStartRow; j < phoneklData.length; j++) {
    const phoneklRow = phoneklData[j];
    if (!phoneklRow || phoneklRow.length < 33) continue;
    
    const policyGroup = (phoneklRow[15] || '').toString().trim(); // P열: 정책그룹
    const armyType = (phoneklRow[14] || '').toString().trim(); // O열: 정책군 (S, A, B, C, D, E)
    const categoryType = (phoneklRow[30] || '').toString().trim(); // AE열: 유형
           const modelName = (phoneklRow[0] || '').toString().trim(); // A열: 모델명
    
    // 정책그룹 필터링
          if (!selectedPolicyGroups.includes(policyGroup)) {
      policyGroupFiltered++;
            continue;
          }
          
    // 날짜 범위 필터링
          let isInDateRange = true;
          if (dateRange) {
      const receptionDate = normalizeReceptionDate(phoneklRow[16]); // Q열: 접수일
      const activationDate = normalizeActivationDate(phoneklRow[20], phoneklRow[21], phoneklRow[22]); // U, V, W열: 개통일
            
            if (dateRange.applyReceiptDate && dateRange.receiptStartDate && dateRange.receiptEndDate) {
              const receptionInRange = receptionDate ? isDateInRange(receptionDate, dateRange.receiptStartDate, dateRange.receiptEndDate) : false;
              isInDateRange = isInDateRange && receptionInRange;
            }
            
            const activationStartDate = dateRange.activationStartDate || dateRange.startDate;
            const activationEndDate = dateRange.activationEndDate || dateRange.endDate;
            
            if (activationStartDate && activationEndDate) {
              const activationInRange = activationDate ? isDateInRange(activationDate, activationStartDate, activationEndDate) : false;
              isInDateRange = isInDateRange && activationInRange;
            }
          }
          
          if (!isInDateRange) {
      dateRangeFiltered++;
            continue;
          }
          
    // 액면예산 복합 키 생성: 모델명&정책군&유형
    const phoneklCompositeKey = `${modelName}&${armyType}&${categoryType}`;
    
         // VLOOKUP: 사용자시트에서 매칭 데이터 검색
     const matchingUserData = userSheetIndex.get(phoneklCompositeKey);
     
     if (matchingUserData) {
      // 매칭 성공! 사용자시트 데이터를 액면예산에 복사
            matchedItems++;
            processedRows++;
            
      const actualRowNumber = j + 1; // Google Sheets 행 번호 (1-based)
            
      // 사용자시트 데이터를 액면예산에 복사
            dataMapping[actualRowNumber] = {
        remainingBudget: matchingUserData.remainingBudget, // K열 → L열
        securedBudget: matchingUserData.securedBudget,     // I열 → M열
        usedBudget: matchingUserData.usedBudget            // J열 → N열
            };
            
            calculationResults.push({
              rowIndex: j + dataStartRow,
              actualRowNumber,
        calculatedBudgetValue: matchingUserData.remainingBudget,
        securedBudgetValue: matchingUserData.securedBudget,
        usedBudgetValue: matchingUserData.usedBudget,
              matchingData: {
                policyGroup,
          armyType,
          categoryType,
                modelName
              }
            });
            
      totalSecuredBudget += matchingUserData.securedBudget;
      totalUsedBudget += matchingUserData.usedBudget;
      totalRemainingBudget += matchingUserData.remainingBudget;
      
      // 매칭 성공 로그 (배치 단위로만 출력)
      if (batchCount % 10 === 0) {
        console.log(`✅ [VLOOKUP성공] Row ${actualRowNumber}: 정책그룹=${policyGroup}, 모델=${modelName}, 군=${armyType}, 유형=${categoryType}`);
        console.log(`   📊 복사된 데이터: 확보=${matchingUserData.securedBudget}, 사용=${matchingUserData.usedBudget}, 잔액=${matchingUserData.remainingBudget}`);
      }
      
      // 배치 처리 후 메모리 정리
      batchCount++;
      if (batchCount % BATCH_SIZE === 0) {
        const currentMemory = process.memoryUsage();
        console.log(`📦 [배치처리] ${batchCount}개 매칭 완료 - 메모리: RSS=${Math.round(currentMemory.rss / 1024 / 1024)}MB, Heap=${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
        
        if (global.gc) {
          global.gc();
          console.log(`🧹 [메모리] 가비지 컬렉션 실행`);
        }
      }
    } else {
      // 매칭 실패
          modelMismatch++;
      
      // 로그 스팸 방지를 위해 간단한 로그만 출력
      if (modelMismatch % 50 === 0) {
        console.log(`❌ [VLOOKUP실패] 액면예산 Row ${j + 1}: 모델=${modelName}, 군=${armyType}, 유형=${categoryType} (매칭 실패)`);
        }
      }
    }
  
  // 사용자시트 데이터가 비어있는 경우 처리
  if (userSheetData.length <= 1) {
    console.log(`🚫 사용자 시트 데이터가 비어있음 (헤더만 존재)`);
  }
  
  // 최종 메모리 사용량 로그
  const endMemory = process.memoryUsage();
  const memoryDiff = {
    rss: Math.round((endMemory.rss - startMemory.rss) / 1024 / 1024),
    heap: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
  };
  
  console.log(`📈 [performBudgetMatching] 완료: 처리=${processedRows}, 매칭=${matchedItems}, 모델불일치=${modelMismatch}`);
  console.log(`📋 [dataMapping] 생성 완료: ${Object.keys(dataMapping).length}개 행`);
  console.log(`🧠 [메모리] 완료: RSS=${Math.round(endMemory.rss / 1024 / 1024)}MB (${memoryDiff.rss > 0 ? '+' : ''}${memoryDiff.rss}MB), Heap=${Math.round(endMemory.heapUsed / 1024 / 1024)}MB (${memoryDiff.heap > 0 ? '+' : ''}${memoryDiff.heap}MB)`);
  
  return {
    dataMapping,
    calculationResults,
    totalSecuredBudget,
    totalUsedBudget,
    totalRemainingBudget,
    processedRows,
    matchedItems,
    statistics: {
      policyGroupFiltered: 0, // 사용자 시트 기준이므로 정책그룹 필터링은 액면예산에서 처리
      dateRangeFiltered: 0,   // 사용자 시트 기준이므로 날짜 필터링은 액면예산에서 처리
      modelMismatch
    }
  };
}

// findMatchingUserData 함수는 제거됨 - performBudgetMatching에서 직접 처리

// 안전한 계산 전용 함수 (실제 업데이트 없이 계산만 수행)
async function calculateUsageBudgetDryRun(sheetId, selectedPolicyGroups, dateRange, userName, budgetType) {
  console.log('🧮 [DRY-RUN] calculateUsageBudgetDryRun 시작 - 사용자:', userName);
  console.log('🧮 [DRY-RUN] dateRange 확인:', JSON.stringify(dateRange, null, 2));
  
  try {
    // 1. 사용자 시트 데이터 읽기
    const userSheetName = await getUserSheetName(userName, budgetType);
    const userSheetRange = `${userSheetName}!A2:L`;
    
    const userSheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: userSheetRange
    });
    
    const userSheetData = userSheetResponse.data.values || [];
    
    // 2. 액면예산 읽기 (AG열까지 필요)
    const phoneklRange = '액면예산!A:AG';
    const phoneklResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: phoneklRange
    });
    
    const phoneklData = phoneklResponse.data.values || [];
    
    // 3. 계산 수행 (dateRange 명시적 전달)
    const calculationResult = await performBudgetMatching(
      userSheetData, 
      phoneklData, 
      selectedPolicyGroups, 
      dateRange, 
      budgetType
    );
    return calculationResult;
    
  } catch (error) {
    console.error('❌ [DRY-RUN] 계산 실패:', error);
    throw error;
  }
}

// 기존 사용예산 계산 함수 (레거시)
async function calculateUsageBudget(sheetId, selectedPolicyGroups, dateRange, userName, budgetType) {
  const sheets = google.sheets({ version: 'v4', auth });
  
  console.log('🔍 [calculateUsageBudget] 시작 - 사용자:', userName);
  
  // 사용자별 예산 데이터 가져오기 - 시트 목록에서 해당 사용자의 시트 찾기
  const baseUserName = userName.replace(/\([^)]+\)/, '').trim(); // 모든 괄호 내용 제거
  let userSheetName = `액면_${baseUserName}`;
  let budgetData = [];
  
  // 사용자의 자격 정보를 대리점아이디관리에서 가져오기
  let userQualification = '이사'; // 기본값
  try {
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    if (agentValues) {
      const agentRows = agentValues.slice(1);
      const userAgent = agentRows.find(row => row[0] === baseUserName); // A열: 이름으로 검색
      if (userAgent) {
        userQualification = userAgent[1] || '이사'; // B열: 자격
        console.log(`📋 [calculateUsageBudget] 사용자 자격 확인: ${baseUserName} → ${userQualification}`);
      }
    }
  } catch (error) {
    console.error('사용자 자격 정보 조회 실패:', error);
  }
  
  // 시트 목록에서 해당 사용자의 시트 찾기
  try {
    const sheetsListResponse = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    const sheetsList = sheetsListResponse.data.sheets || [];
    
    // 시트 목록에서 사용자 시트 찾기
    
    // 사용자명에서 괄호와 공백을 완전히 제거하여 시트명 생성
    const cleanUserName = baseUserName.replace(/\([^)]+\)/g, '').trim();
    const expectedSheetName = `액면_${cleanUserName}(${budgetType || 'Ⅰ'}) (${userQualification})`;
    console.log(`🧭 [calculateUsageBudget] budgetType=${budgetType || 'Ⅰ'}, expectedSheetName=${expectedSheetName} (원본: "${baseUserName}")`);
    const userSheet = sheetsList.find(sheet => 
      sheet.properties.title === expectedSheetName
    );
    
    if (userSheet) {
      userSheetName = userSheet.properties.title;
      console.log(`✅ 사용자 시트 찾음: ${userSheetName}`);
    } else {
      console.warn(`사용자 시트를 찾을 수 없습니다: ${expectedSheetName}`);
      console.warn(`검색 조건: 정확한 시트 이름 매칭 - ${expectedSheetName}`);
    }
  } catch (error) {
    console.warn('시트 목록 조회 중 오류:', error.message);
  }
  
  try {
    console.log(`📥 [calculateUsageBudget] 사용자 시트 범위 읽기: ${userSheetName}!A:L`);
    const budgetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${userSheetName}!A:L`, // A열부터 L열까지 (3열 추가로 12개 컬럼)
    });
    budgetData = budgetResponse.data.values || [];
    console.log(`💰 ${userSheetName} 시트 데이터 로드:`, budgetData.length, '행');
    if (budgetData.length === 0) {
      console.warn('⚠️ [calculateUsageBudget] 사용자 시트 데이터가 비어 있습니다. (헤더 포함 0행)');
    } else {
      // 헤더 정보 확인
    }
  } catch (error) {
    console.warn(`사용자 시트 ${userSheetName}에서 예산 데이터를 가져올 수 없습니다:`, error.message);
  }
  
  // 액면예산 시트에서 데이터 가져오기 (AG열까지 필요)
  const activationData = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: '액면예산!A:AG', // AG열까지 포함
  });
  
  const activationRows = activationData.data.values || [];
  console.log('📱 액면예산 시트 데이터 로드:', activationRows.length, '행');
  
  // 헤더 구조 확인
  console.log('📋 액면예산 헤더 구조 확인:');
  activationRows.slice(0, 10).forEach((row, i) => {
    console.log(`  행${i + 1}:`, row.slice(0, 5).join(' | ')); // 처음 5개 컬럼만 출력
  });
  
  // 사용자가 명확히 알려준 대로 고정값 사용: C4행 헤더, C5행부터 데이터 시작
  const dataStartRow = 5; // C5행부터 시작
  console.log(`🎯 데이터 시작 행: ${dataStartRow} (C${dataStartRow}) - 고정값 사용`);
  
  // 사용예산 계산 및 A열, B열, C열 업데이트
  let totalUsedBudget = 0;
  let totalSecuredBudget = 0;
  let totalRemainingBudget = 0;
  const calculatedData = [];
  const updateRequests = [];
  
  // 통계 변수
  let policyGroupFiltered = 0;
  let dateRangeFiltered = 0;
  let modelMismatch = 0;
  let armyTypeMismatch = 0;
  let categoryTypeMismatch = 0;
  let successfulMatches = 0;
  
  // C5행부터 데이터 처리 (배열 인덱스 4부터 시작)
  activationRows.slice(4).forEach((row, index) => {
    const actualRowNumber = 5 + index; // C5, C6, C7, C8...
    if (row.length >= 33) { // AG열까지 접근하므로 최소 33개 컬럼 필요
      const policyGroup = row[15]; // P열: 정책그룹 (기존 E열에서 +11)
      const armyType = row[14]; // O열: 정책군 (기존 D열에서 +11)
      const categoryType = row[30]; // AE열: 유형 (기존 T열에서 +11)
      const currentBudgetValue = parseFloat((row[13] || '').toString().replace(/,/g, '')) || 0; // N열: 현재 예산값 (기존 C열에서 +11)
      
      // 날짜 데이터 정규화
      const receptionDate = normalizeReceptionDate(row[16]); // Q열: 접수일 (기존 F열에서 +11)
      const activationDate = normalizeActivationDate(row[20], row[21], row[22]); // U, V, W열: 개통일 (기존 J, K, L열에서 +11)
      
      // 정책그룹 매칭 (디버깅 로그 추가)
      if (!selectedPolicyGroups.includes(policyGroup)) {
        // 정책그룹 불일치로 제외
        policyGroupFiltered++;
        if (policyGroupFiltered <= 5) { // 처음 5개만 로그 출력
          console.log(`🚫 [calculateUsageBudget] 정책그룹 불일치: ${policyGroup} (선택된 정책그룹: ${selectedPolicyGroups.join(', ')})`);
        }
      }
      if (selectedPolicyGroups.includes(policyGroup)) {
        // 날짜 범위 필터링 - 새로운 4개 날짜 컬럼 사용
        let isInDateRange = true;
        if (dateRange && dateRange.startDate && dateRange.endDate) {
          // 접수일 또는 개통일이 범위에 있는지 확인
          const receptionInRange = receptionDate ? isDateInRange(receptionDate, dateRange.startDate, dateRange.endDate) : false;
          const activationInRange = activationDate ? isDateInRange(activationDate, dateRange.startDate, dateRange.endDate) : false;
          isInDateRange = receptionInRange || activationInRange;
        }
        // 날짜 범위 제외
        
        if (isInDateRange) {
          // 정책군 매핑 (S, A, B, C, D, E 모두 매핑)
          let mappedArmyType = '';
          if (armyType === 'S') mappedArmyType = 'S군';
          else if (armyType === 'A') mappedArmyType = 'A군';
          else if (armyType === 'B') mappedArmyType = 'B군';
          else if (armyType === 'C') mappedArmyType = 'C군';
          else if (armyType === 'D') mappedArmyType = 'D군';
          else if (armyType === 'E') mappedArmyType = 'E군';
          else mappedArmyType = armyType; // 기타 경우 그대로 사용
          
          // 유형 매핑 (신규, MNP, 보상, 기변 모두 매핑)
          let mappedCategoryType = categoryType;
          if (categoryType === '신규') mappedCategoryType = '신규';
          else if (categoryType === 'MNP') mappedCategoryType = 'MNP';
          else if (categoryType === '보상') mappedCategoryType = '보상';
          else if (categoryType === '기변') mappedCategoryType = '보상';
          else mappedCategoryType = categoryType; // 기타 경우 그대로 사용

                  // 매칭 조건 확인 (디버그용)
          
          // 사용자별 예산 데이터에서 해당하는 사용 예산 찾기
          let calculatedBudgetValue = 0; // 기본값 0원
          let securedBudgetValue = 0; // 확보예산 기본값
          let matchFound = false;
          
          // 헤더 제외하고 예산 데이터에서 매칭
          if (budgetData.length > 1) {
            for (let i = 1; i < budgetData.length; i++) {
              const budgetRow = budgetData[i];
              if (budgetRow.length >= 12) { // 12개 컬럼 필요
                const budgetModelName = budgetRow[5]; // F열: 모델명 (기존 C열에서 3열 밀림)
                const budgetArmyType = budgetRow[6]; // G열: 군 (기존 D열에서 3열 밀림)
                const budgetCategoryType = budgetRow[7]; // H열: 유형 (기존 E열에서 3열 밀림)
                const budgetUsedAmount = parseFloat((budgetRow[9] || '').toString().replace(/,/g, '')) || 0; // J열: 사용 예산 (기존 G열에서 3열 밀림)
                const budgetSecuredAmount = parseFloat((budgetRow[8] || '').toString().replace(/,/g, '')) || 0; // I열: 확보 예산 (기존 F열에서 3열 밀림)
                
                // 액면예산 A열의 모델명과 비교
                const activationModelName = row[0]; // A열: 모델명
                
                // 모델명, 군, 유형이 모두 일치하는 경우
                if (budgetModelName === activationModelName && 
                    budgetArmyType === mappedArmyType && 
                    budgetCategoryType === mappedCategoryType) {
                  calculatedBudgetValue = budgetUsedAmount;
                  securedBudgetValue = budgetSecuredAmount;
                  matchFound = true;
                  successfulMatches++;
                  // 매칭 성공
                  break;
                }
              }
            }
          }
          
          if (!matchFound) {
            // 매칭 실패 원인 분석
            const activationModelName = row[0]; // A열: 모델명
            // 매칭 실패
            
            // 액면_홍남옥에서 해당 모델명이 있는지 확인
            const modelExists = budgetData.slice(1).some(budgetRow => 
              budgetRow.length >= 12 && budgetRow[5] === activationModelName
            );
            
            if (!modelExists) {
              modelMismatch++;
              // 모델명 불일치
            } else {
              // 모델은 있지만 군/유형이 다른 경우
              const matchingBudgetRows = budgetData.slice(1).filter(budgetRow => 
                budgetRow.length >= 12 && budgetRow[5] === activationModelName
              );
              
              const armyTypeExists = matchingBudgetRows.some(budgetRow => budgetRow[6] === mappedArmyType);
              const categoryTypeExists = matchingBudgetRows.some(budgetRow => budgetRow[7] === mappedCategoryType);
              
              if (!armyTypeExists) {
                armyTypeMismatch++;
                // 정책군 불일치
              }
              if (!categoryTypeExists) {
                categoryTypeMismatch++;
                // 유형 불일치
              }
            }
          }
          
          // 매핑된 데이터 저장
          calculatedData.push({
            rowIndex: actualRowNumber, // 실제 행 번호
            policyGroup,
            armyType: mappedArmyType,
            categoryType: mappedCategoryType,
            budgetValue: calculatedBudgetValue,
            securedBudget: securedBudgetValue, // 확보예산 추가
            remainingBudget: securedBudgetValue - calculatedBudgetValue, // 예산잔액 추가 (확보예산 - 사용예산)
            receptionDate: receptionDate && !isNaN(receptionDate.getTime()) ? receptionDate.toISOString() : null,
            activationDate: activationDate && !isNaN(activationDate.getTime()) ? activationDate.toISOString() : null
          });
          
          totalUsedBudget += calculatedBudgetValue;
          totalSecuredBudget += securedBudgetValue;
          totalRemainingBudget += (securedBudgetValue - calculatedBudgetValue);
          
          // 액면예산 타입에 따라 다른 컬럼 업데이트
          // 액면예산(Ⅰ): L열(예산잔액), M열(확보예산), N열(사용예산)
          // 액면예산(Ⅱ): I열(예산잔액), J열(확보예산), K열(사용예산)
          let remainingCol, securedCol, usedCol;
          let remainingIdx, securedIdx, usedIdx;
          
          if (budgetType === 'Ⅱ') {
            // 액면예산(Ⅱ): I, J, K열
            remainingCol = 'I'; securedCol = 'J'; usedCol = 'K';
            remainingIdx = 8; securedIdx = 9; usedIdx = 10; // I=9번째(8), J=10번째(9), K=11번째(10)
          } else {
            // 액면예산(Ⅰ): L, M, N열 (기본값)
            remainingCol = 'L'; securedCol = 'M'; usedCol = 'N';
            remainingIdx = 11; securedIdx = 12; usedIdx = 13; // L=12번째(11), M=13번째(12), N=14번째(13)
          }
          
          // 전체 재계산에서는 기존 값과 관계없이 항상 업데이트 (데이터 위치 변경 대응)
          // 예산잔액 업데이트
          updateRequests.push({
            range: `액면예산!${remainingCol}${actualRowNumber}`,
            values: [[securedBudgetValue - calculatedBudgetValue]]
          });
          
          // 확보예산 업데이트
          updateRequests.push({
            range: `액면예산!${securedCol}${actualRowNumber}`,
            values: [[securedBudgetValue]]
          });
          
          // 사용예산 업데이트
          updateRequests.push({
            range: `액면예산!${usedCol}${actualRowNumber}`,
            values: [[calculatedBudgetValue]]
          });
          
          // 입력자/입력일시 컬럼 업데이트 (기존 저장 버튼과 동일한 형식)
          if (budgetType === 'Ⅱ') {
            // 액면예산(Ⅱ): B열(입력자), C열(입력일시)
            updateRequests.push({
              range: `액면예산!B${actualRowNumber}`,
              values: [[`${userName}(${budgetType})`]]
            });
            updateRequests.push({
              range: `액면예산!C${actualRowNumber}`,
              values: [[`${new Date().toISOString()} (${budgetType})`]]
            });
          } else {
            // 액면예산(Ⅰ): D열(입력자), E열(입력일시)
            updateRequests.push({
              range: `액면예산!D${actualRowNumber}`,
              values: [[`${userName}(${budgetType})`]]
            });
            updateRequests.push({
              range: `액면예산!E${actualRowNumber}`,
              values: [[`${new Date().toISOString()} (${budgetType})`]]
            });
          }
        } else {
          // 날짜 범위에 포함되지 않는 경우 공백으로 설정 (데이터 손상 방지)
          dateRangeFiltered++;
          // 날짜 범위 제외
          updateRequests.push({
            range: `액면예산!L${actualRowNumber}`,
            values: [['']] // 예산잔액 공백
          });
          updateRequests.push({
            range: `액면예산!M${actualRowNumber}`,
            values: [['']] // 확보예산 공백
          });
          updateRequests.push({
            range: `액면예산!N${actualRowNumber}`,
            values: [['']] // 사용예산 공백
          });
        }
      } else {
        // 선택되지 않은 정책그룹의 경우 공백으로 설정 (데이터 손상 방지)
        policyGroupFiltered++;
        // 정책그룹 제외
        updateRequests.push({
          range: `액면예산!L${actualRowNumber}`,
          values: [['']] // 예산잔액 공백
        });
        updateRequests.push({
          range: `액면예산!M${actualRowNumber}`,
          values: [['']] // 확보예산 공백
        });
        updateRequests.push({
          range: `액면예산!N${actualRowNumber}`,
          values: [['']] // 사용예산 공백
        });
      }
    }
  });
  
  // 통계 요약
  console.log(`📊 [calculateUsageBudget] 완료 - 처리: ${activationRows.length - 1}행, 매칭: ${successfulMatches}개`);
  console.log(`  - 총 확보예산: ${totalSecuredBudget}`);
  console.log(`  - 총 사용예산: ${totalUsedBudget}`);
  console.log(`  - 총 예산잔액: ${totalRemainingBudget}`);
  console.log('🚨 [TRACE] calculateUsageBudget 함수 완료:', new Date().toISOString());
  
  // 액면예산 시트의 L열, M열, N열 일괄 업데이트 (기존 A, B, C열에서 +11)
  if (updateRequests.length > 0) {
    console.log('🚨 [TRACE] batchUpdate 시작 - 액면예산:', new Date().toISOString());
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      resource: {
        valueInputOption: 'RAW',
        data: updateRequests
      }
    });
    console.log('🚨 [TRACE] batchUpdate 완료 - 액면예산:', new Date().toISOString());
  }
  
  return {
    totalSecuredBudget,
    totalUsedBudget,
    totalRemainingBudget,
    calculatedData,
    updatedRows: updateRequests.length,
    message: '예산 계산이 완료되었습니다.'
  };
}

// 사용예산 계산 API
app.post('/api/budget/calculate-usage', async (req, res) => {
  try {
    const { sheetId, selectedPolicyGroups, dateRange, userName, budgetType } = req.body;
    
    if (!sheetId || !selectedPolicyGroups || !Array.isArray(selectedPolicyGroups)) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }
    
    const result = await calculateUsageBudget(sheetId, selectedPolicyGroups, dateRange, userName, budgetType);
    res.json(result);
    
  } catch (error) {
    console.error('사용예산 계산 오류:', error);
    res.status(500).json({ error: '사용예산 계산 중 오류가 발생했습니다.' });
  }
});

// 에러 핸들링 미들웨어 (CORS 헤더 포함)
app.use((error, req, res, next) => {
  console.error('🚨 [서버에러]', error);
  
  // CORS 헤더 설정
  res.header('Access-Control-Allow-Origin', 'https://vipmobile.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// ==================== 가입자증감 관련 API ====================

// 가입자증감 권한 확인 API
app.get('/api/subscriber-increase/access', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // 대리점아이디관리 시트에서 I열 권한 확인 (채권장표 메뉴 권한)
    const agentResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${AGENT_SHEET_NAME}!A:J`
    });

    if (!agentResponse.data.values || agentResponse.data.values.length === 0) {
      throw new Error('Failed to fetch agent data');
    }

    // 헤더 제거
    const agentRows = agentResponse.data.values.slice(1);
    
    // I열에서 "O" 권한이 있는 대리점 찾기 (채권장표 메뉴 권한)
    const authorizedAgents = agentRows
      .filter(row => row && row.length > 8 && row[8] === 'O') // I열 (8번 인덱스)
      .map(row => ({
        agentCode: row[0] || '', // A열: 대리점코드
        agentName: row[1] || '', // B열: 대리점명
        accessLevel: row[8] || '' // I열: 채권장표 메뉴 접근권한
      }));

    res.json({
      success: true,
      hasAccess: authorizedAgents.length > 0,
      authorizedAgents,
      totalAgents: agentRows.length,
      authorizedCount: authorizedAgents.length
    });
  } catch (error) {
    console.error('Error checking subscriber increase access:', error);
    res.status(500).json({
      success: false,
      hasAccess: false,
      error: 'Failed to check subscriber increase access',
      message: error.message
    });
  }
});

// 가입자증감 시트 초기화/생성 API
app.post('/api/subscriber-increase/init-sheet', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // 시트 존재 여부 확인
    const spreadsheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const existingSheets = spreadsheetResponse.data.sheets || [];
    const targetSheet = existingSheets.find(sheet => sheet.properties.title === SUBSCRIBER_INCREASE_SHEET_NAME);
    
    if (targetSheet) {
      // 시트가 이미 존재하는 경우 기존 데이터 확인
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`
      });
      
      const existingData = dataResponse.data.values || [];
      
      // 데이터가 비어있으면 초기 데이터 입력
      if (existingData.length === 0) {
        console.log('시트가 존재하지만 데이터가 비어있음. 초기 데이터를 입력합니다.');
        
        // 헤더 설정 (대리점코드, 대리점명, 구분, 년월 컬럼들)
        const headers = [
          '대리점코드', '대리점명', '구분', 
          '2024년 1월', '2024년 2월', '2024년 3월', '2024년 4월', '2024년 5월', '2024년 6월',
          '2024년 7월', '2024년 8월', '2024년 9월', '2024년 10월', '2024년 11월', '2024년 12월',
          '2025년 1월', '2025년 2월', '2025년 3월', '2025년 4월', '2025년 5월', '2025년 6월',
          '2025년 7월', '2025년 8월', '2025년 9월', '2025년 10월', '2025년 11월', '2025년 12월'
        ];
        
        // 초기 데이터 설정
        const initialData = [
          headers,
          ['합계', '합계', '가입자수', ...Array(24).fill('')],
          ['합계', '합계', '관리수수료', ...Array(24).fill('')],
          ['306891', '경수', '가입자수', ...Array(24).fill('')],
          ['306891', '경수', '관리수수료', ...Array(24).fill('')],
          ['315835', '경인', '가입자수', ...Array(24).fill('')],
          ['315835', '경인', '관리수수료', ...Array(24).fill('')],
          ['315835(제외)', '경인(제외)', '가입자수', ...Array(24).fill('')],
          ['315835(제외)', '경인(제외)', '관리수수료', ...Array(24).fill('')],
          ['316558', '동서울', '가입자수', ...Array(24).fill('')],
          ['316558', '동서울', '관리수수료', ...Array(24).fill('')],
          ['314942', '호남', '가입자수', ...Array(24).fill('')],
          ['314942', '호남', '관리수수료', ...Array(24).fill('')],
          ['316254', '호남2', '가입자수', ...Array(24).fill('')],
          ['316254', '호남2', '관리수수료', ...Array(24).fill('')]
        ];
        
        // 데이터 입력
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A1:AA${initialData.length}`,
          valueInputOption: 'RAW',
          resource: { values: initialData }
        });
        
        return res.json({
          success: true,
          message: '시트가 존재했지만 데이터가 비어있어 초기 데이터를 입력했습니다',
          data: initialData
        });
      }
      
      // 315835(제외) 행이 있는지 확인하고 없으면 추가
      const hasExcludedRow = existingData.some(row => row[0] === '315835(제외)');
      if (!hasExcludedRow && existingData.length > 0) {
        console.log('315835(제외) 행이 없어서 추가합니다.');
        
        // 315835 행 다음에 315835(제외) 행 추가
        const updatedData = [...existingData];
        const insertIndex = updatedData.findIndex(row => row[0] === '315835' && row[2] === '관리수수료') + 1;
        
        const excludedSubscriberRow = ['315835(제외)', '경인(제외)', '가입자수', ...Array(24).fill('')];
        const excludedFeeRow = ['315835(제외)', '경인(제외)', '관리수수료', ...Array(24).fill('')];
        
        updatedData.splice(insertIndex, 0, excludedSubscriberRow, excludedFeeRow);
        
        // 업데이트된 데이터를 시트에 저장
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A1:AA${updatedData.length}`,
          valueInputOption: 'RAW',
          resource: { values: updatedData }
        });
        
        return res.json({
          success: true,
          message: '시트가 존재했지만 315835(제외) 행이 없어서 추가했습니다',
          data: updatedData
        });
      }
      
      return res.json({
        success: true,
        message: '시트가 이미 존재합니다',
        data: existingData
      });
    }
    
    // 시트 생성
    const createSheetRequest = {
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: SUBSCRIBER_INCREASE_SHEET_NAME,
              gridProperties: {
                rowCount: 20,
                columnCount: 27  // 27개 컬럼 (A부터 AA까지)
              }
            }
          }
        }]
      }
    };
    
    await sheets.spreadsheets.batchUpdate(createSheetRequest);
    
    // 헤더 설정 (대리점코드, 대리점명, 구분, 년월 컬럼들)
    const headers = [
      '대리점코드', '대리점명', '구분', 
      '2024년 1월', '2024년 2월', '2024년 3월', '2024년 4월', '2024년 5월', '2024년 6월',
      '2024년 7월', '2024년 8월', '2024년 9월', '2024년 10월', '2024년 11월', '2024년 12월',
      '2025년 1월', '2025년 2월', '2025년 3월', '2025년 4월', '2025년 5월', '2025년 6월',
      '2025년 7월', '2025년 8월', '2025년 9월', '2025년 10월', '2025년 11월', '2025년 12월'
    ];
    
    // 초기 데이터 설정
    const initialData = [
      headers,
      ['합계', '합계', '가입자수', ...Array(24).fill('')],
      ['합계', '합계', '관리수수료', ...Array(24).fill('')],
      ['306891', '경수', '가입자수', ...Array(24).fill('')],
      ['306891', '경수', '관리수수료', ...Array(24).fill('')],
      ['315835', '경인', '가입자수', ...Array(24).fill('')],
      ['315835', '경인', '관리수수료', ...Array(24).fill('')],
      ['316558', '동서울', '가입자수', ...Array(24).fill('')],
      ['316558', '동서울', '관리수수료', ...Array(24).fill('')],
      ['314942', '호남', '가입자수', ...Array(24).fill('')],
      ['314942', '호남', '관리수수료', ...Array(24).fill('')],
      ['316254', '호남2', '가입자수', ...Array(24).fill('')],
      ['316254', '호남2', '관리수수료', ...Array(24).fill('')]
    ];
    
    // 데이터 입력
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A1:AA${initialData.length}`,
      valueInputOption: 'RAW',
      resource: { values: initialData }
    });
    
    res.json({
      success: true,
      message: '가입자증감 시트가 성공적으로 생성되었습니다',
      data: initialData
    });
    
  } catch (error) {
    console.error('Error initializing subscriber increase sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize sheet',
      message: error.message
    });
  }
});

// 가입자증감 시트에 315835(제외) 행 추가 API
app.post('/api/subscriber-increase/add-excluded-row', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // 기존 데이터 조회
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`
    });
    
    const existingData = dataResponse.data.values || [];
    if (existingData.length === 0) {
      return res.status(404).json({
        success: false,
        error: '시트 데이터를 찾을 수 없습니다'
      });
    }
    
    // 315835(제외) 행이 있는지 확인
    const hasExcludedRow = existingData.some(row => row[0] === '315835(제외)');
    if (hasExcludedRow) {
      return res.json({
        success: true,
        message: '315835(제외) 행이 이미 존재합니다',
        data: existingData
      });
    }
    
    console.log('315835(제외) 행이 없어서 추가합니다.');
    
    // 315835 행 다음에 315835(제외) 행 추가
    const updatedData = [...existingData];
    const insertIndex = updatedData.findIndex(row => row[0] === '315835' && row[2] === '관리수수료') + 1;
    
    const excludedSubscriberRow = ['315835(제외)', '경인(제외)', '가입자수', ...Array(24).fill('')];
    const excludedFeeRow = ['315835(제외)', '경인(제외)', '관리수수료', ...Array(24).fill('')];
    
    updatedData.splice(insertIndex, 0, excludedSubscriberRow, excludedFeeRow);
    
    // 업데이트된 데이터를 시트에 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A1:AA${updatedData.length}`,
      valueInputOption: 'RAW',
      resource: { values: updatedData }
    });
    
    res.json({
      success: true,
      message: '315835(제외) 행이 성공적으로 추가되었습니다',
      data: updatedData
    });
    
  } catch (error) {
    console.error('Error adding excluded row:', error);
    res.status(500).json({
      success: false,
      error: '315835(제외) 행 추가 중 오류가 발생했습니다',
      message: error.message
    });
  }
});

// 가입자증감 데이터 조회 API
app.get('/api/subscriber-increase/data', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`
    });
    
    res.json({
      success: true,
      data: dataResponse.data.values || []
    });
    
  } catch (error) {
    console.error('Error fetching subscriber increase data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data',
      message: error.message
    });
  }
});

// 가입자증감 데이터 저장 API
app.post('/api/subscriber-increase/save', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { yearMonth, agentCode, type, value } = req.body;
    
    // 입력 데이터 검증
    if (!yearMonth || !agentCode || !type || value === undefined) {
      return res.status(400).json({
        success: false,
        error: '필수 데이터가 누락되었습니다',
        required: ['yearMonth', 'agentCode', 'type', 'value']
      });
    }
    
    // 숫자 검증
    if (type !== '가입자수' && type !== '관리수수료') {
      return res.status(400).json({
        success: false,
        error: '잘못된 타입입니다. 가입자수 또는 관리수수료만 가능합니다'
      });
    }
    
    // 기존 데이터 조회
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`
    });
    
    const existingData = dataResponse.data.values || [];
    if (existingData.length === 0) {
      return res.status(404).json({
        success: false,
        error: '시트 데이터를 찾을 수 없습니다'
      });
    }
    
    // 헤더에서 년월 컬럼 인덱스 찾기
    const headers = existingData[0];
    const yearMonthIndex = headers.findIndex(header => header === yearMonth);
    
    if (yearMonthIndex === -1) {
      return res.status(400).json({
        success: false,
        error: '해당 년월 컬럼을 찾을 수 없습니다'
      });
    }
    
    // 해당 대리점과 타입의 행 찾기
    let targetRowIndex = -1;
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (row[0] === agentCode && row[2] === type) {
        targetRowIndex = i;
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '해당 대리점과 타입의 행을 찾을 수 없습니다'
      });
    }
    
    // 데이터 업데이트
    const updatedData = [...existingData];
    updatedData[targetRowIndex][yearMonthIndex] = value;
    
    // Google Sheets에 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A${targetRowIndex + 1}:AA${targetRowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [updatedData[targetRowIndex]] }
    });
    
    // 합계 계산 및 업데이트
    await calculateAndUpdateTotals(SPREADSHEET_ID, SUBSCRIBER_INCREASE_SHEET_NAME, yearMonthIndex);
    
    res.json({
      success: true,
      message: '데이터가 성공적으로 저장되었습니다',
      data: {
        yearMonth,
        agentCode,
        type,
        value,
        rowIndex: targetRowIndex + 1,
        columnIndex: yearMonthIndex + 1
      }
    });
    
  } catch (error) {
    console.error('Error saving subscriber increase data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save data',
      message: error.message
    });
  }
});

// 가입자증감 데이터 일괄 저장 API
app.post('/api/subscriber-increase/bulk-save', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  try {
    const { bulkData } = req.body; // [{ yearMonth, agentCode, type, value }, ...]
    
    if (!bulkData || !Array.isArray(bulkData) || bulkData.length === 0) {
      return res.status(400).json({
        success: false,
        error: '일괄 저장할 데이터가 없습니다'
      });
    }
    
    // 기존 데이터 조회 (빈도 제한 적용)
    const dataResponse = await rateLimitedSheetsCall(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`
      });
    });
    
    const existingData = dataResponse.data.values || [];
    if (existingData.length === 0) {
      return res.status(404).json({
        success: false,
        error: '시트 데이터를 찾을 수 없습니다'
      });
    }
    
    const headers = existingData[0];
    const updatedData = [...existingData];
    const updateResults = [];
    const errors = [];
    
    // 각 데이터 항목 처리
    for (const item of bulkData) {
      try {
        const { yearMonth, agentCode, type, value } = item;
        
        // 입력 데이터 검증
        if (!yearMonth || !agentCode || !type || value === undefined) {
          errors.push({
            item,
            error: '필수 데이터가 누락되었습니다'
          });
          continue;
        }
        
        // 타입 검증
        if (type !== '가입자수' && type !== '관리수수료') {
          errors.push({
            item,
            error: '잘못된 타입입니다. 가입자수 또는 관리수수료만 가능합니다'
          });
          continue;
        }
        
        // 헤더에서 년월 컬럼 인덱스 찾기
        const yearMonthIndex = headers.findIndex(header => header === yearMonth);
        
        if (yearMonthIndex === -1) {
          errors.push({
            item,
            error: '해당 년월 컬럼을 찾을 수 없습니다'
          });
          continue;
        }
        
        // 해당 대리점과 타입의 행 찾기
        let targetRowIndex = -1;
        for (let i = 1; i < updatedData.length; i++) {
          const row = updatedData[i];
          if (row[0] === agentCode && row[2] === type) {
            targetRowIndex = i;
            break;
          }
        }
        
        if (targetRowIndex === -1) {
          errors.push({
            item,
            error: '해당 대리점과 타입의 행을 찾을 수 없습니다'
          });
          continue;
        }
        
        // 데이터 업데이트
        updatedData[targetRowIndex][yearMonthIndex] = value;
        
        updateResults.push({
          yearMonth,
          agentCode,
          type,
          value,
          rowIndex: targetRowIndex + 1,
          columnIndex: yearMonthIndex + 1
        });
        
      } catch (itemError) {
        errors.push({
          item,
          error: itemError.message
        });
      }
    }
    
    // Google Sheets에 일괄 저장 (전체 시트 업데이트) - 빈도 제한 적용
    if (updateResults.length > 0) {
      await rateLimitedSheetsCall(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`,
          valueInputOption: 'RAW',
          resource: { values: updatedData }
        });
      });
      
      // 합계 계산 및 업데이트 (모든 월에 대해) - 빈도 제한 적용
      const uniqueYearMonths = [...new Set(updateResults.map(r => r.yearMonth))];
      for (const yearMonth of uniqueYearMonths) {
        const yearMonthIndex = headers.findIndex(header => header === yearMonth);
        if (yearMonthIndex !== -1) {
          await rateLimitedSheetsCall(async () => {
            return await calculateAndUpdateTotals(SPREADSHEET_ID, SUBSCRIBER_INCREASE_SHEET_NAME, yearMonthIndex);
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: `${updateResults.length}개 데이터가 성공적으로 저장되었습니다`,
      results: {
        successCount: updateResults.length,
        errorCount: errors.length,
        updatedData: updateResults,
        errors: errors
      }
    });
    
  } catch (error) {
    console.error('Error bulk saving subscriber increase data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk save data',
      message: error.message
    });
  }
});

// 가입자증감 데이터 삭제 API
app.post('/api/subscriber-increase/delete', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { yearMonth, agentCode, type } = req.body;
    
    // 입력 데이터 검증
    if (!yearMonth || !agentCode || !type) {
      return res.status(400).json({
        success: false,
        error: '필수 데이터가 누락되었습니다',
        required: ['yearMonth', 'agentCode', 'type']
      });
    }
    
    // 기존 데이터 조회
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A:AA`
    });
    
    const existingData = dataResponse.data.values || [];
    if (existingData.length === 0) {
      return res.status(404).json({
        success: false,
        error: '시트 데이터를 찾을 수 없습니다'
      });
    }
    
    // 헤더에서 년월 컬럼 인덱스 찾기
    const headers = existingData[0];
    const yearMonthIndex = headers.findIndex(header => header === yearMonth);
    
    if (yearMonthIndex === -1) {
      return res.status(400).json({
        success: false,
        error: '해당 년월 컬럼을 찾을 수 없습니다'
      });
    }
    
    // 해당 대리점과 타입의 행 찾기
    let targetRowIndex = -1;
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (row[0] === agentCode && row[2] === type) {
        targetRowIndex = i;
        break;
      }
    }
    
    if (targetRowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '해당 대리점과 타입의 행을 찾을 수 없습니다'
      });
    }
    
    // 데이터 삭제 (빈 값으로 설정)
    const updatedData = [...existingData];
    updatedData[targetRowIndex][yearMonthIndex] = '';
    
    // Google Sheets에 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A${targetRowIndex + 1}:AA${targetRowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [updatedData[targetRowIndex]] }
    });
    
    // 합계 계산 및 업데이트
    await calculateAndUpdateTotals(SPREADSHEET_ID, SUBSCRIBER_INCREASE_SHEET_NAME, yearMonthIndex);
    
    res.json({
      success: true,
      message: '데이터가 성공적으로 삭제되었습니다',
      data: {
        yearMonth,
        agentCode,
        type,
        rowIndex: targetRowIndex + 1,
        columnIndex: yearMonthIndex + 1
      }
    });
    
  } catch (error) {
    console.error('Error deleting subscriber increase data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete data',
      message: error.message
    });
  }
});

// 합계 계산 및 업데이트 함수
async function calculateAndUpdateTotals(spreadsheetId, sheetName, yearMonthIndex) {
  try {
    // 기존 데이터 조회
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:AA`
    });
    
    const data = dataResponse.data.values || [];
    if (data.length < 3) return;
    
    // 각 타입별 합계 계산
    const subscriberTotals = {};
    const feeTotals = {};
    
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      const agentCode = row[0];
      const type = row[2];
      const value = parseFloat(row[yearMonthIndex]) || 0;
      
      if (type === '가입자수') {
        subscriberTotals[agentCode] = (subscriberTotals[agentCode] || 0) + value;
      } else if (type === '관리수수료') {
        feeTotals[agentCode] = (feeTotals[agentCode] || 0) + value;
      }
    }
    
    // 합계 계산
    const totalSubscribers = Object.values(subscriberTotals).reduce((sum, val) => sum + val, 0);
    const totalFees = Object.values(feeTotals).reduce((sum, val) => sum + val, 0);
    
    // 합계 행 업데이트
    const updatedData = [...data];
    updatedData[1][yearMonthIndex] = totalSubscribers; // 가입자수 합계
    updatedData[2][yearMonthIndex] = totalFees; // 관리수수료 합계
    
    // Google Sheets에 합계 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2:AA3`,
      valueInputOption: 'RAW',
      resource: { values: [updatedData[1], updatedData[2]] }
    });
    
  } catch (error) {
    console.error('Error calculating totals:', error);
  }
}

// ============================================
// 재초담초채권 API
// ============================================

// 재초담초채권 데이터 저장
app.post('/api/rechotancho-bond/save', async (req, res) => {
  try {
    const { data, inputUser } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: '데이터가 올바르지 않습니다.'
      });
    }
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
    const sheetName = '재초담초채권_내역';
    
    // 현재 시간 생성 (KST)
    const now = new Date();
    const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const timestamp = kstTime.toISOString().replace('T', ' ').substring(0, 19);
    
    // 시트에 저장할 행 생성 (빈 값도 허용)
    const rows = data.map(item => [
      timestamp,                          // A: 저장일시
      item.agentCode,                     // B: 대리점코드
      item.agentName,                     // C: 대리점명
      Number(item.inventoryBond) || 0,    // D: 재고초과채권
      Number(item.collateralBond) || 0,   // E: 담보초과채권
      Number(item.managementBond) || 0,   // F: 관리대상채권
      inputUser || ''                     // G: 입력자
    ]);
    
    // Google Sheets에 데이터 추가
    await rateLimitedSheetsCall(async () => {
      return await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:G`,
        valueInputOption: 'RAW',
        resource: {
          values: rows
        }
      });
    });
    
    console.log(`✅ 재초담초채권 데이터 저장 완료: ${timestamp}, 입력자: ${inputUser}, ${rows.length}개 대리점`);
    
    res.json({
      success: true,
      message: '데이터가 성공적으로 저장되었습니다.',
      timestamp
    });
    
  } catch (error) {
    console.error('❌ 재초담초채권 데이터 저장 실패:', error);
    res.status(500).json({
      success: false,
      error: '데이터 저장에 실패했습니다.',
      message: error.message
    });
  }
});

// 재초담초채권 저장 시점 목록 조회
app.get('/api/rechotancho-bond/history', async (req, res) => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
    const sheetName = '재초담초채권_내역';
    
    // 시트 데이터 조회
    const response = await rateLimitedSheetsCall(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:G`
      });
    });
    
    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // 헤더 제외하고 데이터 행만 처리
    const dataRows = rows.slice(1);
    
    // 저장 시점별로 그룹화 (중복 제거)
    const timestampMap = new Map();
    
    dataRows.forEach(row => {
      const timestamp = row[0];
      const inputUser = row[6];
      
      if (timestamp && !timestampMap.has(timestamp)) {
        timestampMap.set(timestamp, {
          timestamp,
          inputUser: inputUser || '미상'
        });
      }
    });
    
    // 최신순으로 정렬
    const history = Array.from(timestampMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log(`✅ 재초담초채권 저장 시점 조회 완료: ${history.length}개`);
    
    res.json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('❌ 재초담초채권 저장 시점 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '저장 시점 조회에 실패했습니다.',
      message: error.message
    });
  }
});

// 특정 시점의 재초담초채권 데이터 조회
app.get('/api/rechotancho-bond/data/:timestamp', async (req, res) => {
  try {
    const { timestamp } = req.params;
    
    if (!timestamp) {
      return res.status(400).json({
        success: false,
        error: '시점 정보가 필요합니다.'
      });
    }
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
    const sheetName = '재초담초채권_내역';
    
    // 시트 데이터 조회
    const response = await rateLimitedSheetsCall(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:G`
      });
    });
    
    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // 헤더 제외하고 해당 시점의 데이터만 필터링
    const dataRows = rows.slice(1).filter(row => row[0] === timestamp);
    
    if (dataRows.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // 데이터 변환
    const data = dataRows.map(row => ({
      timestamp: row[0] || '',
      agentCode: row[1] || '',
      agentName: row[2] || '',
      inventoryBond: Number(row[3]) || 0,
      collateralBond: Number(row[4]) || 0,
      managementBond: Number(row[5]) || 0,
      inputUser: row[6] || ''
    }));
    
    console.log(`✅ 재초담초채권 데이터 조회 완료: ${timestamp}, ${data.length}개`);
    
    res.json({
      success: true,
      data
    });
    
  } catch (error) {
    console.error('❌ 재초담초채권 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '데이터 조회에 실패했습니다.',
      message: error.message
    });
  }
});

// 모든 재초담초채권 데이터 조회 (그래프용)
app.get('/api/rechotancho-bond/all-data', async (req, res) => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
    const sheetName = '재초담초채권_내역';
    
    // 시트 데이터 조회
    const response = await rateLimitedSheetsCall(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:G`
      });
    });
    
    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // 헤더 제외하고 데이터 변환
    const data = rows.slice(1).map(row => ({
      timestamp: row[0] || '',
      agentCode: row[1] || '',
      agentName: row[2] || '',
      inventoryBond: Number(row[3]) || 0,
      collateralBond: Number(row[4]) || 0,
      managementBond: Number(row[5]) || 0,
      inputUser: row[6] || ''
    }));
    
    console.log(`✅ 재초담초채권 전체 데이터 조회 완료: ${data.length}개`);
    
    res.json({
      success: true,
      data
    });
    
  } catch (error) {
    console.error('❌ 재초담초채권 전체 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '전체 데이터 조회에 실패했습니다.',
      message: error.message
    });
  }
});

// 서버 시작
const server = app.listen(port, '0.0.0.0', async () => {
  try {
    // console.log(`서버가 포트 ${port}에서 실행 중입니다`);
    // console.log(`VAPID Public Key: ${vapidKeys.publicKey}`);
    
    // 환경변수 디버깅 (민감한 정보는 로깅하지 않음)
    console.log('🔧 [서버시작] 환경변수 상태 확인:');
    console.log('- GOOGLE_SHEET_ID 설정됨:', !!process.env.GOOGLE_SHEET_ID);
    console.log('- SHEET_ID 설정됨:', !!process.env.SHEET_ID);
    console.log('- SALES_SHEET_ID 설정됨:', !!process.env.SALES_SHEET_ID);
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
    console.log('- 최종 사용할 Spreadsheet ID 설정됨:', !!spreadsheetId);
    
    if (spreadsheetId) {
      console.log('- Spreadsheet ID 길이:', spreadsheetId.length);
      console.log('- Spreadsheet ID 시작:', spreadsheetId.substring(0, 10) + '...');
    }
    if (process.env.SALES_SHEET_ID) {
      console.log('- SALES_SHEET_ID 길이:', process.env.SALES_SHEET_ID.length);
      console.log('- SALES_SHEET_ID 시작:', process.env.SALES_SHEET_ID.substring(0, 10) + '...');
    }
    // console.log('Discord 봇 환경변수 상태:');
    // console.log('- DISCORD_BOT_TOKEN 설정됨:', !!process.env.DISCORD_BOT_TOKEN);
    // console.log('- DISCORD_CHANNEL_ID 설정됨:', !!process.env.DISCORD_CHANNEL_ID);
    // console.log('- DISCORD_AGENT_CHANNEL_ID 설정됨:', !!process.env.DISCORD_AGENT_CHANNEL_ID);
    // console.log('- DISCORD_STORE_CHANNEL_ID 설정됨:', !!process.env.DISCORD_STORE_CHANNEL_ID);
    // console.log('- DISCORD_LOGGING_ENABLED 설정됨:', process.env.DISCORD_LOGGING_ENABLED);
    
    // 무료 Geocoding 서비스 상태
          // console.log('무료 Geocoding 서비스 상태:');
      // console.log('- Photon API (Komoot): 사용 가능 (무료)');
      // console.log('- Nominatim API (OpenStreetMap): 사용 가능 (무료)');
      // console.log('- Pelias API (Mapzen): 사용 가능 (무료)');
      // console.log('- 총 3개 무료 서비스로 정확도 향상');
    
    // 봇 로그인 (서버 시작 후)
    if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN && discordBot) {
      // console.log('서버 시작 후 Discord 봇 로그인 시도...');
      try {
        await discordBot.login(DISCORD_BOT_TOKEN);
                  // console.log('Discord 봇 연결 성공!');
        
        // 관리자 채널 연결 테스트
        if (DISCORD_AGENT_CHANNEL_ID) {
          try {
            const agentChannel = await discordBot.channels.fetch(DISCORD_AGENT_CHANNEL_ID);
            if (agentChannel) {
              // console.log(`관리자 채널 '${agentChannel.name}' 연결 성공!`);
            }
          } catch (agentChannelError) {
            console.error('관리자 채널 연결 실패:', agentChannelError.message);
          }
        }
        
        // 일반 매장 채널 연결 테스트
        if (DISCORD_STORE_CHANNEL_ID) {
          try {
            const storeChannel = await discordBot.channels.fetch(DISCORD_STORE_CHANNEL_ID);
            if (storeChannel) {
              // console.log(`일반 매장 채널 '${storeChannel.name}' 연결 성공!`);
            }
          } catch (storeChannelError) {
            console.error('일반 매장 채널 연결 실패:', storeChannelError.message);
          }
        }
        
        // 테스트 메시지 전송 (기본 채널)
        if (DISCORD_CHANNEL_ID) {
          const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
          if (channel) {
            // console.log(`채널 '${channel.name}' 연결 성공!`);
            
            // 테스트 메시지 전송
            const testEmbed = new EmbedBuilder()
              .setTitle('서버 시작 알림')
              .setColor(5763719)
              .setDescription('서버가 성공적으로 시작되었습니다.')
              .setTimestamp()
              .setFooter({ text: '(주)브이아이피플러스 서버' });
              
            await channel.send({ embeds: [testEmbed] });
            // console.log('서버 시작 알림 메시지 전송됨');
          }
        }
      } catch (error) {
        console.error('서버 시작 시 Discord 봇 초기화 오류:', error.message);
        console.error('Discord 봇은 비활성화 상태로 서버가 계속 실행됩니다.');
      }
    } else {
              // console.log('Discord 봇 기능이 비활성화되었거나 설정이 완료되지 않았습니다.');
    }
    
    // 주소 업데이트 함수 호출 (비동기로 처리하여 배정 로직을 방해하지 않도록)
    console.log('🔍 [서버시작] 주소 업데이트 함수 시작 (비동기 처리)');
    checkAndUpdateAddresses().then(() => {
      console.log('✅ [서버시작] 주소 업데이트 함수 완료');
    }).catch(error => {
      console.error('❌ [서버시작] 주소 업데이트 함수 실패:', error.message);
    });
    
    // SALES_SHEET_ID 주소 업데이트 함수 호출 (비동기로 처리)
    console.log('🔍 [서버시작] SALES_SHEET_ID 주소 업데이트 함수 시작 (비동기 처리)');
    checkAndUpdateSalesAddresses().then(() => {
  
    }).catch(error => {
      console.error('❌ [서버시작] SALES_SHEET_ID 주소 업데이트 함수 실패:', error.message);
    });
    
    // 영업 데이터 미리 로드 (비동기로 처리)
    console.log('🔍 [서버시작] 영업 데이터 미리 로드 시작 (비동기 처리)');
    preloadSalesData().then(() => {
  
    }).catch(error => {
      console.error('❌ [서버시작] 영업 데이터 미리 로드 실패:', error.message);
    });
    
    // 매 시간마다 업데이트 체크 실행 (3600000ms = 1시간)
    setInterval(checkAndUpdateAddresses, 3600000);
    
    // Git 커밋 히스토리를 구글시트에 자동 입력
    console.log('🔍 [서버시작] Git 히스토리 업데이트 시작');
    try {
      await updateGoogleSheetWithGitHistory();
  
    } catch (error) {
      console.error('❌ [서버시작] Git 히스토리 업데이트 실패:', error.message);
    }
    
    // 푸시 구독 정보 초기화
    console.log('🔍 [서버시작] 푸시 구독 초기화 시작');
    try {
      await initializePushSubscriptions();
  
    } catch (error) {
      console.error('❌ [서버시작] 푸시 구독 초기화 실패:', error.message);
    }
    
    // SMS 시트 헤더 초기화 (서버 시작 시 한 번만 실행)
    console.log('📱 [서버시작] SMS 시트 헤더 초기화 시작');
    try {
      await ensureSmsSheetHeaders();
      console.log('✅ [서버시작] SMS 시트 헤더 초기화 완료');
    } catch (error) {
      console.error('❌ [서버시작] SMS 시트 헤더 초기화 실패:', error.message);
    }
    
    // SMS 자동응답 시트 헤더 초기화 (서버 시작 시 한 번만 실행)
    console.log('🤖 [서버시작] SMS 자동응답 시트 헤더 초기화 시작');
    try {
      await ensureAutoReplySheetHeaders();
      console.log('✅ [서버시작] SMS 자동응답 시트 헤더 초기화 완료');
    } catch (error) {
      console.error('❌ [서버시작] SMS 자동응답 시트 헤더 초기화 실패:', error.message);
    }
    
    // 서버 시작 시 배정완료된 재고 자동 저장 및 중복 정리 (지연 로딩으로 성능 최적화)
    console.log('💾 [서버시작] 배정완료된 재고 자동 저장 및 중복 정리 시작 (백그라운드에서 실행)');
    
    // 백그라운드에서 데이터 로드 (서버 시작 지연 방지)
    setTimeout(async () => {
      try {
        console.log('🔍 [서버시작] 1단계: 시트 데이터 가져오기 시작 (백그라운드)');
        
        // 폰클재고데이터를 기준으로 배정 상태 데이터 가져오기
        const phoneklInventoryValues = await getSheetValues('폰클재고데이터');
        console.log(`🔍 [서버시작] 폰클재고데이터 로드 완료: ${phoneklInventoryValues ? phoneklInventoryValues.length : 0}개 행`);
        
        const reservationSiteValues = await getSheetValues('사전예약사이트');
        // 사전예약사이트 로드 완료
        
        // 1단계: 먼저 개통완료 상태 확인 및 F열 업데이트 (비동기 처리)
        console.log('📋 [서버시작] 1-1단계: 개통완료 상태 확인 시작 (비동기)');
        fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/activation-status`)
          .then(async (activationResponse) => {
            if (activationResponse.ok) {
              const activationResult = await activationResponse.json();
              if (activationResult.success) {
            
              } else {
                console.error('❌ [서버시작] 개통완료 상태 확인 실패:', activationResult.error);
              }
            } else {
              console.error('❌ [서버시작] 개통완료 상태 확인 API 호출 실패:', activationResponse.status);
            }
          })
          .catch(error => {
            console.error('❌ [서버시작] 개통완료 상태 확인 오류:', error.message);
          });
        
        // 폰클출고처데이터 로드 (POS점 매핑용)
        const phoneklStoreValues = await getSheetValues('폰클출고처데이터');
        console.log(`🔍 [서버시작] 폰클출고처데이터 로드 완료: ${phoneklStoreValues ? phoneklStoreValues.length : 0}개 행`);
        
        // 정규화 규칙 로드
        const normalizationValues = await getSheetValues('정규화작업');
        console.log(`🔍 [서버시작] 정규화작업 로드 완료: ${normalizationValues ? normalizationValues.length : 0}개 행`);
        
        // 정규화 규칙 생성
        const normalizationRules = new Map();
        if (normalizationValues && normalizationValues.length > 1) {
          normalizationValues.slice(1).forEach(row => {
            if (row.length >= 4) {
              const reservationSite = (row[1] || '').toString().trim(); // B열: 사전예약사이트 형식
              const phoneklFormat = (row[2] || '').toString().trim(); // C열: 폰클형식
              const combinedFormat = (row[3] || '').toString().trim(); // D열: 사전예약사이트&폰클형식
              
              if (reservationSite && phoneklFormat) {
                // 정규화 규칙의 키를 사전예약사이트 형식으로 생성 (파이프 제거)
                const key = reservationSite.replace(/\s*\|\s*/g, ' ').trim();
                normalizationRules.set(key, { phoneklFormat });
              }
            }
          });
          console.log(`🔧 [서버시작] 정규화 규칙 로드 완료: ${normalizationRules.size}개 규칙`);
        }
        
        if (!phoneklInventoryValues || !reservationSiteValues) {
          throw new Error('시트 데이터를 가져올 수 없습니다.');
        }
        
        // 폰클출고처데이터에서 출고처별 P코드 매핑 생성
        const storeToPosCodeMap = new Map();
        if (phoneklStoreValues && phoneklStoreValues.length > 1) {
          phoneklStoreValues.slice(1).forEach(row => {
            if (row.length >= 8) {
              const storeName = (row[6] || '').toString().trim(); // G열: 출고처명
              const posCode = (row[7] || '').toString().trim(); // H열: P코드
              
              if (storeName && posCode) {
                storeToPosCodeMap.set(storeName, posCode);
              }
            }
          });
          console.log(`🔧 [서버시작] 출고처-P코드 매핑 생성 완료: ${storeToPosCodeMap.size}개`);
        }
        
        // 폰클재고데이터 처리 (배정완료된 재고만 - N열 출고처에 값이 있는 재고)
        const inventoryMap = new Map(); // 모델별 일련번호 배열 저장
        phoneklInventoryValues.slice(1).forEach(row => {
          if (row.length >= 22) {
            const serialNumber = (row[11] || '').toString().trim(); // D열: 일련번호 (3+8)
            const modelCapacity = (row[13] || '').toString().trim(); // F열: 모델명&용량 (5+8)
            const color = (row[14] || '').toString().trim(); // G열: 색상 (6+8)
            const storeName = (row[21] || '').toString().trim(); // N열: 출고처 (13+8)
            
            // N열 출고처가 비어있는 재고만 사용 가능한 재고로 간주 (아직 배정되지 않은 재고)
            if (serialNumber && modelCapacity && color && (!storeName || storeName.trim() === '')) {
              const inventoryKey = `${modelCapacity} | ${color}`;
              
              // 같은 모델의 재고를 배열로 저장
              if (!inventoryMap.has(inventoryKey)) {
                inventoryMap.set(inventoryKey, []);
              }
              inventoryMap.get(inventoryKey).push(serialNumber);
            }
          }
        });
        
        console.log(`💾 [서버시작] 재고 데이터 처리 완료: ${inventoryMap.size}개 배정완료 재고`);
        console.log(`🔍 [서버시작] 재고 데이터 샘플:`, Array.from(inventoryMap.entries()).slice(0, 5));
        
        // 사전예약사이트 데이터와 매칭
        const assignments = [];
        let updatedCount = 0;
        let skippedCount = 0;
        let noMatchCount = 0;
        
        // 서버 시작 시 중복 배정 자동 정리
        console.log('🧹 [서버시작] 중복 배정 데이터 자동 정리 시작');
        const serialToReservations = new Map(); // 일련번호별 예약번호 매핑
        
        // 기존 배정 데이터 수집 (개통완료 고객 제외 - 일련번호를 다른 고객에게 배정하기 위해)
        reservationSiteValues.slice(1).forEach((row, index) => {
          if (row.length < 22) return;
          
          const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
          const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
        const activationStatus = (row[5] || '').toString().trim(); // F열: 개통상태
        
        // 개통완료된 고객은 중복 정리에서 제외 (일련번호를 다른 고객에게 배정하기 위해)
        if (existingSerial && existingSerial.trim() !== '' && activationStatus !== '개통완료') {
          if (!serialToReservations.has(existingSerial)) {
            serialToReservations.set(existingSerial, []);
          }
          serialToReservations.get(existingSerial).push({
            reservationNumber,
            rowIndex: index + 1,
            row: row
          });
        }
      });
      
      // 중복 배정된 일련번호들 정리
      let cleanedCount = 0;
      for (const [serialNumber, reservations] of serialToReservations.entries()) {
        if (reservations.length > 1) {
          console.log(`⚠️ [서버시작] 일련번호 ${serialNumber}에 ${reservations.length}개 고객 배정됨: ${reservations.map(r => r.reservationNumber).join(', ')}`);
          
          // 우선순위에 따라 첫 번째 고객만 남기고 나머지는 배정 해제
          const sortedReservations = reservations.sort((a, b) => {
            // 예약번호 순서로 정렬 (고유문자)
            return a.reservationNumber.localeCompare(b.reservationNumber);
          });
          
          // 첫 번째 고객만 유지하고 나머지는 배정 해제
          for (let i = 1; i < sortedReservations.length; i++) {
            const reservationToRemove = sortedReservations[i];
            reservationToRemove.row[6] = ''; // G열 배정 해제
            cleanedCount++;
            console.log(`🧹 [서버시작] 배정 해제: ${reservationToRemove.reservationNumber} (일련번호: ${serialNumber})`);
          }
        }
      }
      
  
      
      // 사전예약사이트 데이터 처리 시작
      
      // 1단계: 모든 고객에 대해 개통완료 체크 (필수 데이터 여부와 관계없이)
      reservationSiteValues.slice(1).forEach((row, index) => {
        if (row.length < 22) {
          console.log(`⚠️ [서버시작] 행 ${index + 2}: 컬럼 수 부족 (${row.length})`);
          return;
        }
        
        const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
        const activationStatus = (row[5] || '').toString().trim(); // F열: 개통상태
        
        // 개통완료된 고객은 새로운 배정에서만 제외 (기존 일련번호는 유지)
        if (activationStatus === '개통완료') {
          if (index < 5) {
            console.log(`⚠️ [서버시작] 행 ${index + 2}: 개통완료 고객 배정 건너뜀: ${reservationNumber}`);
          }
          skippedCount++;
          return; // 새로운 배정만 건너뜀, 기존 일련번호는 그대로 유지
        }
      });
      
      // 2단계: 필수 데이터가 있는 고객들에 대해 배정 로직 실행
      reservationSiteValues.slice(1).forEach((row, index) => {
        if (row.length < 22) {
          console.log(`⚠️ [서버시작] 행 ${index + 2}: 컬럼 수 부족 (${row.length})`);
          return;
        }
        
        const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
        const customerName = (row[7] || '').toString().trim(); // H열: 고객명
        const model = (row[15] || '').toString().trim(); // P열: 모델명
        const capacity = (row[16] || '').toString().trim(); // Q열: 용량
        const color = (row[17] || '').toString().trim(); // R열: 색상
        const posCode = (row[21] || '').toString().trim(); // V열: POS코드
        const currentSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
        const activationStatus = (row[5] || '').toString().trim(); // F열: 개통상태
        
        // 개통완료된 고객은 새로운 배정에서만 제외 (기존 일련번호는 유지)
        if (activationStatus === '개통완료') {
          if (index < 5) {
            console.log(`⚠️ [서버시작] 행 ${index + 2}: 개통완료 고객 배정 건너뜀: ${reservationNumber}`);
          }
          skippedCount++;
          return; // 새로운 배정만 건너뜀, 기존 일련번호는 그대로 유지
        }
        
        if (reservationNumber && customerName && model && color && capacity && posCode) {
          // 정규화 규칙 적용
          const originalKey = `${model} ${capacity} ${color}`;
          let normalizedKey = originalKey;
          
          // 정규화 규칙에서 매칭되는 키 찾기
          for (const [ruleKey, ruleValue] of normalizationRules.entries()) {
            if (originalKey.includes(ruleKey) || ruleKey.includes(originalKey)) {
              normalizedKey = ruleValue.phoneklFormat;
              if (index < 5) {
                console.log(`🔧 [서버시작] 정규화 적용: "${originalKey}" → "${normalizedKey}"`);
              }
              break;
            }
          }
          
          const inventoryKey = normalizedKey;
          
          // 처음 5개 행은 상세 로그
          if (index < 5) {
            console.log(`🔍 [서버시작] 행 ${index + 2}: 예약번호="${reservationNumber}", 모델="${model} ${capacity} ${color}", 현재일련번호="${currentSerialNumber}"`);
          }
          
          // POS코드에 해당하는 출고처 찾기
          let targetStoreName = null;
          for (const [storeName, storePosCode] of storeToPosCodeMap.entries()) {
            if (storePosCode === posCode) {
              targetStoreName = storeName;
              break;
            }
          }
          
          if (!targetStoreName) {
            noMatchCount++;
            if (index < 5) {
              console.log(`❌ [서버시작] 행 ${index + 2}: POS코드 "${posCode}"에 해당하는 출고처 없음`);
            }
            return;
          }
          
          // 해당 출고처에 배정된 재고 찾기
          const availableSerials = [];
          phoneklInventoryValues.slice(1).forEach(inventoryRow => {
            if (inventoryRow.length >= 15) {
                      const inventorySerialNumber = (inventoryRow[11] || '').toString().trim(); // D열: 일련번호 (3+8)
        const inventoryModelCapacity = (inventoryRow[13] || '').toString().trim(); // F열: 모델명&용량 (5+8)
        const inventoryColor = (inventoryRow[14] || '').toString().trim(); // G열: 색상 (6+8)
        const inventoryStoreName = (inventoryRow[21] || '').toString().trim(); // N열: 출고처 (13+8)
              
              // 해당 출고처에 배정된 재고이고, 모델이 일치하는 경우
              if (inventorySerialNumber && inventoryModelCapacity && inventoryColor && 
                  inventoryStoreName === targetStoreName && 
                  `${inventoryModelCapacity} | ${inventoryColor}` === inventoryKey) {
                availableSerials.push(inventorySerialNumber);
              }
            }
          });
          
          if (availableSerials.length > 0) {
            // 기존 배정 상태 확인
            const existingAssignment = assignmentMemory.get(reservationNumber);
            
            // 사용 가능한 일련번호 중에서 중복되지 않는 것을 찾기
            let assignedSerialNumber = null;
            
            for (const serial of availableSerials) {
              // 이미 배정된 일련번호가 있고, 현재와 다른 경우에만 업데이트
              if (currentSerialNumber !== serial) {
                // 기존에 배정된 적이 없거나, 다른 일련번호로 배정된 경우에만 업데이트
                if (!existingAssignment || existingAssignment.serialNumber !== serial) {
                  // 중복 배정 체크: 같은 일련번호가 이미 다른 고객에게 배정되었는지 확인
                  let isDuplicate = false;
                  for (let i = 0; i < index; i++) {
                    const prevRow = reservationSiteValues[i + 1];
                    if (prevRow && prevRow.length >= 22) {
                      const prevSerial = (prevRow[6] || '').toString().trim();
                      if (prevSerial === serial) {
                        isDuplicate = true;
                        break;
                      }
                    }
                  }
                  
                  if (!isDuplicate) {
                    assignedSerialNumber = serial;
                    break; // 사용 가능한 일련번호를 찾았으므로 루프 종료
                  }
                }
              }
            }
            
            if (assignedSerialNumber) {
              row[6] = assignedSerialNumber; // G열 업데이트
              updatedCount++;
              
              if (index < 5) {
            
              }
              
              assignments.push({
                reservationNumber,
                assignedSerialNumber
              });
            } else {
              noMatchCount++;
              if (index < 5) {
                console.log(`❌ [서버시작] 행 ${index + 2}: 사용 가능한 일련번호 없음 "${inventoryKey}"`);
              }
            }
          } else {
            noMatchCount++;
            if (index < 5) {
              console.log(`❌ [서버시작] 행 ${index + 2}: 재고 매칭 실패 "${inventoryKey}"`);
            }
          }
        } else {
          if (index < 5) {
            console.log(`⚠️ [서버시작] 행 ${index + 2}: 필수 데이터 누락 - 예약번호:${!!reservationNumber}, 고객명:${!!customerName}, 모델:${!!model}, 용량:${!!capacity}, 색상:${!!color}`);
          }
        }
      });
      
      console.log(`📊 [서버시작] 매칭 결과: 업데이트=${updatedCount}, 유지=${skippedCount}, 매칭실패=${noMatchCount}`);
      
      // 기존 배정 상태를 메모리에 로드
      console.log(`💾 [서버시작] 기존 배정 상태 메모리 로드 시작`);
      reservationSiteValues.slice(1).forEach((row, index) => {
        if (row.length >= 22) {
          const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
          const currentSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
          
          if (reservationNumber && currentSerialNumber) {
            assignmentMemory.set(reservationNumber, {
              serialNumber: currentSerialNumber,
              timestamp: Date.now()
            });
          }
        }
      });
      console.log(`💾 [서버시작] 기존 배정 상태 ${assignmentMemory.size}개 메모리 로드 완료`);
      
      // Google Sheets에 저장
      if (updatedCount > 0) {
          try {
            const sheets = google.sheets({ version: 'v4', auth });
            const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
            
            // spreadsheetId 검증
            if (!spreadsheetId) {
              throw new Error('GOOGLE_SHEET_ID 또는 SHEET_ID 환경변수가 설정되지 않았습니다.');
            }
            
            console.log(`🔧 [서버시작] Google Sheets 업데이트 시작 - Spreadsheet ID: ${spreadsheetId.substring(0, 10)}...`);
            
            // G열만 업데이트 (배정일련번호)
            const range = '사전예약사이트!G2:G' + (reservationSiteValues.length);
            const values = reservationSiteValues.slice(1).map(row => [row[6] || '']); // G열 데이터만 추출
            
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range,
              valueInputOption: 'RAW',
              resource: { values }
            });
            
        
          } catch (error) {
            console.error('❌ [서버시작] Google Sheets 업데이트 실패:', error.message);
            console.error('❌ [서버시작] 환경변수 확인 필요: GOOGLE_SHEET_ID');
          }
        }
      
      console.log(`📈 [서버시작] 배정완료 재고 자동 저장 완료: ${updatedCount}개 저장, ${skippedCount}개 유지, ${cleanedCount}개 중복정리`);
      
      // 실제 시트 데이터와 비교 분석
      console.log('🔍 [서버시작] 실제 시트 데이터와 배정 상태 비교 분석 시작');
      
      // 사전예약사이트에서 실제로 일련번호가 입력된 고객들 수집
      const actualAssignedCustomers = [];
      reservationSiteValues.slice(1).forEach(row => {
        if (row.length >= 22) {
          const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
          const customerName = (row[7] || '').toString().trim(); // H열: 고객명
          const assignedSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
          
          if (reservationNumber && customerName && assignedSerialNumber) {
            actualAssignedCustomers.push({
              reservationNumber,
              customerName,
              assignedSerialNumber
            });
          }
        }
      });
      
      console.log(`📊 [서버시작] 실제 시트에 일련번호가 입력된 고객: ${actualAssignedCustomers.length}개`);
      
      // 재고관리에서 배정완료로 표시된 재고들
      const inventoryAssignedCount = inventoryMap.size;
      console.log(`📊 [서버시작] 재고관리에서 배정완료로 표시된 재고: ${inventoryAssignedCount}개`);
      
      // 차이점 분석
      const difference = actualAssignedCustomers.length - inventoryAssignedCount;
      console.log(`📊 [서버시작] 차이점: ${difference > 0 ? '+' : ''}${difference}개`);
      
      if (difference !== 0) {
        console.log('⚠️ [서버시작] 불일치 발견! 상세 분석:');
        
        // 실제 시트에 있지만 재고관리에 없는 일련번호들
        const actualSerialNumbers = new Set(actualAssignedCustomers.map(c => c.assignedSerialNumber));
        const inventorySerialNumbers = new Set(inventoryMap.values());
        
        const onlyInSheet = [...actualSerialNumbers].filter(sn => !inventorySerialNumbers.has(sn));
        const onlyInInventory = [...inventorySerialNumbers].filter(sn => !actualSerialNumbers.has(sn));
        
        console.log(`  - 시트에만 있는 일련번호: ${onlyInSheet.length}개`);
        if (onlyInSheet.length > 0) {
          console.log(`    샘플: ${onlyInSheet.slice(0, 5).join(', ')}`);
        }
        
        console.log(`  - 재고관리에만 있는 일련번호: ${onlyInInventory.length}개`);
        if (onlyInInventory.length > 0) {
          console.log(`    샘플: ${onlyInInventory.slice(0, 5).join(', ')}`);
        }
      }
      
    } catch (error) {
      console.error('❌ [서버시작] 배정완료 재고 자동 저장 오류:', error);
      console.error('❌ [서버시작] 오류 상세:', error.message);
      console.error('❌ [서버시작] 오류 스택:', error.stack);
    }
  }, 1000); // setTimeout 함수 닫기 (1초 후 실행)
  
  } catch (error) {
    console.error('서버 시작 중 오류:', error);
  }
}).on('error', (error) => {
  console.error('서버 시작 실패:', error);
  process.exit(1);
});

  // 정상적인 종료 처리
  process.on('SIGTERM', async () => {
    // console.log('Received SIGTERM signal. Shutting down gracefully...');
    
    // Discord에 서버 종료 알림 전송
    if (DISCORD_LOGGING_ENABLED && discordBot) {
      try {
        // 봇 준비 상태 확인
        if (!discordBot.isReady()) {
          // console.log('Discord 봇이 아직 준비되지 않았습니다. 5초 대기 후 재시도...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        }
      
      if (discordBot.isReady()) {
        // 기본 채널에 알림 전송
        if (DISCORD_CHANNEL_ID) {
          try {
            const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
            if (channel) {
              const shutdownEmbed = new EmbedBuilder()
                .setTitle('⚠️ 서버 종료 알림')
                .setColor(15548997) // 빨간색
                .setDescription('@everyone\n서버가 종료되었습니다. 서비스 이용이 불가능할 수 있습니다.')
                .setTimestamp()
                .setFooter({ text: '(주)브이아이피플러스 서버 알림' });
                
              // console.log('종료 알림 전송 시도 중...');
              const sentMessage = await channel.send({ content: '@everyone', embeds: [shutdownEmbed] });
              // console.log(`서버 종료 알림 메시지가 Discord로 전송되었습니다. 메시지 ID: ${sentMessage.id}`);
            }
          } catch (error) {
            console.error('Discord 채널 접근 또는 메시지 전송 실패:', error);
          }
        }
      } else {
        console.log('Discord 봇이 준비되지 않아 종료 알림을 보낼 수 없습니다.');
      }
    } catch (error) {
      console.error('Discord 종료 알림 전송 실패:', error);
    }
    
    // Discord 봇 연결 종료를 기다림 (메시지 전송에 충분한 시간)
    console.log('Discord 메시지 전송 대기 중... (3초)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('대기 완료, 서버 종료 진행');
  }
  
  server.close(() => {
    console.log('Server closed');
    // 일정 시간 후 강제 종료 (메시지가 전송되지 않더라도)
    setTimeout(() => {
      console.log('강제 종료');
      process.exit(0);
    }, 1000);
  });
});

// SIGINT 처리 (Ctrl+C)
process.on('SIGINT', async () => {
  // console.log('Received SIGINT signal (Ctrl+C). Shutting down gracefully...');
  
  // Discord에 서버 종료 알림 전송
  if (DISCORD_LOGGING_ENABLED && discordBot) {
    try {
      // 봇 준비 상태 확인
      if (!discordBot.isReady()) {
        // console.log('Discord 봇이 아직 준비되지 않았습니다. 5초 대기 후 재시도...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
      }
      
      if (discordBot.isReady()) {
        // 기본 채널에 알림 전송
        if (DISCORD_CHANNEL_ID) {
          try {
            const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
            if (channel) {
              const shutdownEmbed = new EmbedBuilder()
                .setTitle('⚠️ 서버 종료 알림')
                .setColor(15548997) // 빨간색
                .setDescription('@everyone\n서버가 종료되었습니다. 서비스 이용이 불가능할 수 있습니다.')
                .setTimestamp()
                .setFooter({ text: '(주)브이아이피플러스 서버 알림' });
                
              console.log('종료 알림 전송 시도 중...');
              const sentMessage = await channel.send({ content: '@everyone', embeds: [shutdownEmbed] });
              console.log(`서버 종료 알림 메시지가 Discord로 전송되었습니다. 메시지 ID: ${sentMessage.id}`);
            }
          } catch (error) {
            console.error('Discord 채널 접근 또는 메시지 전송 실패:', error);
          }
        }
      } else {
        console.log('Discord 봇이 준비되지 않아 종료 알림을 보낼 수 없습니다.');
      }
    } catch (error) {
      console.error('Discord 종료 알림 전송 실패:', error);
    }
    
    // Discord 봇 연결 종료를 기다림 (메시지 전송에 충분한 시간)
    console.log('Discord 메시지 전송 대기 중... (3초)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('대기 완료, 서버 종료 진행');
  }
  
  server.close(() => {
    console.log('Server closed');
    // 일정 시간 후 강제 종료 (메시지가 전송되지 않더라도)
    setTimeout(() => {
      console.log('강제 종료');
      process.exit(0);
    }, 1000);
  });
});

// 배정관리 관련 API
app.get('/api/assignment/history', async (req, res) => {
  try {
    // 배정 히스토리 데이터 (임시로 하드코딩된 데이터 반환)
    const assignments = [
      {
        id: 1,
        assigner: '경수',
        model: 'iPhone 15 Pro',
        color: '블랙',
        quantity: 50,
        target_office: '경인사무소',
        target_department: '영업1팀',
        target_agent: '김영업',
        assigned_at: new Date('2024-01-15T10:30:00'),
        status: 'completed'
      },
      {
        id: 2,
        assigner: '홍기현',
        model: 'Galaxy S24',
        color: '화이트',
        quantity: 30,
        target_office: '호남사무소',
        target_department: '영업2팀',
        target_agent: '이영업',
        assigned_at: new Date('2024-01-15T09:15:00'),
        status: 'completed'
      }
    ];
    
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('배정 히스토리 조회 오류:', error);
    res.status(500).json({ success: false, error: '배정 히스토리 조회 실패' });
  }
});

app.post('/api/assignment/complete', async (req, res) => {
  // console.log('=== 배정 완료 API 호출됨 ===');
  // console.log('요청 본문:', JSON.stringify(req.body, null, 2));
  
  try {
    const {
      assigner,
      model,
      color,
      quantity,
      target_office,
      target_department,
      target_agent,
      target_offices,
      target_departments,
      target_agents
    } = req.body;
    
    // 실제 배정된 수량 계산 (quantity가 0이 아닌 경우에만)
    const actualQuantity = parseInt(quantity) || 0;
    
    // 배정 정보 저장 (실제로는 데이터베이스에 저장)
    const assignment = {
      id: Date.now(),
      assigner,
      model,
      color,
      quantity: actualQuantity,
      target_office,
      target_department,
      target_agent,
      assigned_at: new Date(),
      status: 'completed'
    };
    
    // console.log('새로운 배정 완료:', assignment);
    // console.log('배정 대상자:', { target_offices, target_departments, target_agents });
    
    // 배정 대상자에게만 알림 전송 (실제 배정된 수량이 있는 경우에만)
    if (actualQuantity > 0) {
      const notification = {
        type: 'assignment_completed',
        title: '새로운 배정 완료',
        message: `${assigner}님이 ${model} (${color}) ${actualQuantity}대를 배정했습니다.`,
        data: assignment,
        timestamp: new Date()
      };
      
      // console.log('알림 전송 시작:', {
      //   notification,
      //   targetOffices: target_offices,
      //   targetDepartments: target_departments,
      //   targetAgents: target_agents
      // });
      
      // 대상자 필터링하여 알림 전송
      await sendNotificationToTargetAgents(notification, target_offices, target_departments, target_agents);
    } else {
      // console.log('배정된 수량이 0이므로 알림을 전송하지 않습니다.');
    }
    
    res.json({ success: true, assignment });
  } catch (error) {
    console.error('배정 완료 처리 오류:', error);
    res.status(500).json({ success: false, error: '배정 완료 처리 실패' });
  }
});

// 알림 관련 API
app.get('/api/notifications', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    // 실제 알림 데이터는 데이터베이스에서 조회 (현재는 빈 배열)
    const notifications = [];
    
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('알림 조회 오류:', error);
    res.status(500).json({ success: false, error: '알림 조회 실패' });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 알림 읽음 처리 (실제로는 데이터베이스 업데이트)
    console.log(`알림 ${id} 읽음 처리`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('알림 읽음 처리 오류:', error);
    res.status(500).json({ success: false, error: '알림 읽음 처리 실패' });
  }
});

// 모든 알림을 읽음 처리하는 API
app.put('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    // 모든 알림을 읽음 처리 (실제로는 데이터베이스 업데이트)
    console.log(`사용자 ${user_id}의 모든 알림을 읽음 처리`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('모든 알림 읽음 처리 오류:', error);
    res.status(500).json({ success: false, error: '모든 알림 읽음 처리 실패' });
  }
});

// 실시간 알림 스트림 (Server-Sent Events)
const connectedClients = new Map();

app.get('/api/notifications/stream', (req, res) => {
  const { user_id } = req.query;
  
  // HTTP/2 호환성을 위한 SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx 프록시에서 버퍼링 비활성화
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Last-Event-ID',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Last-Event-ID'
  });
  
  // 클라이언트 연결 저장
  const clientId = Date.now();
  connectedClients.set(clientId, { res, user_id });
  
  console.log(`클라이언트 ${clientId} (${user_id}) 연결됨`);
  
  // 연결 해제 시 클라이언트 제거
  req.on('close', () => {
    connectedClients.delete(clientId);
    console.log(`클라이언트 ${clientId} 연결 해제됨`);
  });
  
  req.on('error', (error) => {
    console.error(`클라이언트 ${clientId} 연결 오류:`, error);
    connectedClients.delete(clientId);
  });
  
  // 초기 연결 메시지 (keep-alive 유지)
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: Date.now() })}\n\n`);
  
  // 주기적으로 연결 상태 확인 (30초마다)
  const keepAliveInterval = setInterval(() => {
    try {
      if (connectedClients.has(clientId)) {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      } else {
        clearInterval(keepAliveInterval);
      }
    } catch (error) {
      console.error(`클라이언트 ${clientId} keep-alive 오류:`, error);
      connectedClients.delete(clientId);
      clearInterval(keepAliveInterval);
    }
  }, 30000);
  
  // 연결 해제 시 인터벌 정리
  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });
});

// 모든 관리자모드 접속자에게 알림 전송하는 함수
function sendNotificationToAllAgents(notification) {
  console.log('모든 관리자모드 접속자에게 알림 전송:', notification);
  
  connectedClients.forEach((client, clientId) => {
    try {
      client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
      console.log(`알림 전송 완료: 클라이언트 ${clientId}`);
    } catch (error) {
      console.error(`클라이언트 ${clientId}에게 알림 전송 실패:`, error);
      connectedClients.delete(clientId);
    }
  });
}

// 배정 대상자에게만 알림 전송하는 함수
async function sendNotificationToTargetAgents(notification, targetOffices, targetDepartments, targetAgents) {
  console.log('배정 대상자에게만 알림 전송 시작:', {
    notification,
    targetOffices,
    targetDepartments,
    targetAgents
  });
  
  // 실제 담당자 데이터를 가져오는 로직 (Google Sheets에서)
  let agents = [];
  
  try {
    // Google Sheets에서 담당자 데이터 가져오기
    const agentSheetName = '대리점아이디관리';
    const agentData = await getSheetValues(agentSheetName);
    
    console.log('담당자 시트 데이터 로드 결과:', {
      hasData: !!agentData,
      dataLength: agentData?.length || 0,
      firstRow: agentData?.[0],
      secondRow: agentData?.[1]
    });
    
    if (agentData && agentData.length > 3) {
      // 헤더 제거 (3행까지가 헤더이므로 4행부터 시작)
      agents = agentData.slice(3).map((row, index) => {
        const agent = {
          target: row[0], // A열: 담당자명
          qualification: row[15], // P열: 권한 (정책모드 권한)
          contactId: row[2], // C열: 연락처(아이디)
          office: row[3], // D열: 사무실
          department: row[4], // E열: 소속
          pushSubscription: row[14] ? JSON.parse(row[14]) : null // O열: 푸시 구독 정보
        };
        
        console.log(`담당자 데이터 파싱 ${index + 1}:`, {
          target: agent.target,
          contactId: agent.contactId,
          office: agent.office,
          department: agent.department,
          hasPushSubscription: !!agent.pushSubscription
        });
        return agent;
      }).filter(agent => agent.target && agent.contactId);
      
      console.log(`담당자 데이터 로드 완료: ${agents.length}명`);
    } else {
      console.warn('담당자 데이터가 없거나 유효하지 않음');
    }
  } catch (error) {
    console.error('담당자 데이터 로드 실패:', error);
  }
  
  console.log('사용 가능한 담당자 목록:', agents.map(a => `${a.target}(${a.contactId}) - ${a.role} - ${a.office} ${a.department}`));
  console.log('현재 연결된 클라이언트:', Array.from(connectedClients.entries()).map(([id, client]) => `${id}:${client.user_id}`));
  console.log('배정 대상자 정보:', {
    targetOffices: targetOffices || [],
    targetDepartments: targetDepartments || [],
    targetAgents: targetAgents || []
  });
  console.log('현재 푸시 구독 상태:', {
    totalSubscriptions: pushSubscriptions.size,
    subscriptions: Array.from(pushSubscriptions.keys())
  });
  
  // 배정 대상자 필터링
  const targetAgentsList = agents.filter(agent => 
    isTargetAgent(agent.contactId, targetOffices, targetDepartments, targetAgents, agents)
  );
  
  console.log('배정 대상자 필터링 결과:', {
    totalAgents: agents.length,
    targetAgentsCount: targetAgentsList.length,
    targetAgents: targetAgentsList.map(a => `${a.target}(${a.contactId})`)
  });
  
  // SSE 실시간 알림 전송
  let sseSentCount = 0;
  connectedClients.forEach((client, clientId) => {
    try {
      // 클라이언트가 배정 대상자인지 확인
      if (isTargetAgent(client.user_id, targetOffices, targetDepartments, targetAgents, agents)) {
        client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
        console.log(`SSE 알림 전송 완료: 클라이언트 ${clientId} (${client.user_id})`);
        sseSentCount++;
        
        // 푸시 알림도 함께 전송 (시트에서 로드한 구독 정보 사용)
        const targetAgent = agents.find(agent => agent.contactId === client.user_id);
        const subscription = targetAgent?.pushSubscription || pushSubscriptions.get(client.user_id);
        if (subscription) {
          sendPushNotificationToUser(client.user_id, notification, subscription);
        }
      } else {
        console.log(`클라이언트 ${clientId} (${client.user_id})는 배정 대상자가 아님`);
      }
    } catch (error) {
      console.error(`클라이언트 ${clientId}에게 알림 전송 실패:`, error);
      connectedClients.delete(clientId);
    }
  });
  
  // 오프라인 사용자를 위한 푸시 알림 전송
  let pushSentCount = 0;
  targetAgentsList.forEach(agent => {
    // 현재 온라인 상태가 아닌 사용자에게만 푸시 알림 전송
    const isOnline = Array.from(connectedClients.values()).some(client => client.user_id === agent.contactId);
    if (!isOnline) {
      // 시트에서 로드한 구독 정보가 있으면 사용, 없으면 메모리에서 찾기
      const subscription = agent.pushSubscription || pushSubscriptions.get(agent.contactId);
      if (subscription) {
        sendPushNotificationToUser(agent.contactId, notification, subscription);
        pushSentCount++;
      } else {
        console.log(`사용자 ${agent.contactId}의 푸시 구독 정보를 찾을 수 없습니다.`);
      }
    }
  });
  
  console.log('알림 전송 완료 요약:', {
    sseSentCount,
    pushSentCount,
    totalSent: sseSentCount + pushSentCount
  });
}

// 푸시 알림 전송 함수
async function sendPushNotificationToUser(userId, notification, subscription = null) {
  try {
    // 구독 정보가 전달되지 않으면 메모리에서 찾기
    if (!subscription) {
      subscription = pushSubscriptions.get(userId);
    }
    
    console.log(`푸시 알림 전송 시도: ${userId}`, {
      hasSubscription: !!subscription,
      subscriptionSource: subscription ? (subscription === pushSubscriptions.get(userId) ? 'memory' : 'sheet') : 'none',
      notificationTitle: notification.title,
      notificationMessage: notification.message
    });
    
    if (!subscription) {
      console.log(`사용자 ${userId}의 푸시 구독이 없습니다.`);
      return;
    }
    
    const payload = JSON.stringify({
      title: notification.title || '새로운 배정 완료',
      body: notification.message || '새로운 배정이 완료되었습니다.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'assignment-notification',
      data: {
        url: '/',
        timestamp: Date.now(),
        ...notification.data
      }
    });
    
    console.log(`푸시 알림 페이로드:`, payload);
    
    await webpush.sendNotification(subscription, payload);
    console.log(`푸시 알림 전송 완료: ${userId}`);
  } catch (error) {
    console.error(`푸시 알림 전송 실패 (${userId}):`, error);
    
    // 구독이 만료된 경우 삭제
    if (error.statusCode === 410) {
      pushSubscriptions.delete(userId);
      console.log(`만료된 구독 삭제: ${userId}`);
    }
  }
}

// 대상자 확인 함수
function isTargetAgent(userId, targetOffices, targetDepartments, targetAgents, agents) {
  console.log('대상자 확인 함수 호출:', {
    userId,
    targetOffices,
    targetDepartments,
    targetAgents,
    agentsCount: agents?.length || 0
  });
  
  // 사용자 정보에서 소속 확인 (contactId 또는 role로 매칭)
  let userAgent = agents.find(agent => agent.contactId === userId);
  if (!userAgent) {
    // contactId로 찾지 못하면 role로 찾기
    userAgent = agents.find(agent => agent.role === userId);
  }
  if (!userAgent) {
    console.log(`사용자 ${userId}의 정보를 찾을 수 없음`);
    return false;
  }
  
  console.log(`사용자 ${userId} 정보:`, userAgent);
  console.log(`배정 대상자:`, { targetOffices, targetDepartments, targetAgents });
  
  // 빈 배열이거나 undefined인 경우 처리
  const offices = Array.isArray(targetOffices) ? targetOffices : [];
  const departments = Array.isArray(targetDepartments) ? targetDepartments : [];
  const targetAgentsList = Array.isArray(targetAgents) ? targetAgents : [];
  
  // 전체 배정인 경우 모든 관리자모드 접속자에게 전송
  if (offices.includes('전체') || departments.includes('전체') || targetAgentsList.includes('전체')) {
    console.log(`전체 배정이므로 ${userId}에게 알림 전송`);
    return true;
  }
  
  // 특정 대상자 배정인 경우 해당 대상자만 확인
  const isTarget = offices.includes(userAgent.office) || 
                   departments.includes(userAgent.department) || 
                   targetAgentsList.includes(userAgent.target) ||
                   targetAgentsList.includes(userAgent.contactId) ||
                   targetAgentsList.includes(userAgent.role);
  
  console.log(`${userId} 대상자 여부:`, isTarget, {
    officeMatch: offices.includes(userAgent.office),
    departmentMatch: departments.includes(userAgent.department),
    targetMatch: targetAgentsList.includes(userAgent.target),
    contactIdMatch: targetAgentsList.includes(userAgent.contactId),
    roleMatch: targetAgentsList.includes(userAgent.role)
  });
  
  return isTarget;
}

// 푸시 구독 정보를 Google Sheets에 저장하는 함수
async function savePushSubscriptionToSheet(userId, subscription) {
  try {
    console.log(`푸시 구독 정보를 시트에 저장 중: ${userId}`);
    
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    if (!agentValues || agentValues.length < 4) {
      throw new Error('대리점아이디관리 시트 데이터를 가져올 수 없습니다.');
    }
    
    // 헤더 제거 (3행까지가 헤더이므로 4행부터 시작)
    const agentRows = agentValues.slice(3);
    
    // 사용자 ID로 해당 행 찾기 (C열: 연락처(아이디))
    const userRowIndex = agentRows.findIndex(row => row[2] === userId);
    
    if (userRowIndex === -1) {
      console.log(`사용자 ${userId}를 대리점아이디관리 시트에서 찾을 수 없습니다.`);
      return false;
    }
    
    // 실제 시트 행 번호 (헤더 3행 + 0부터 시작하는 인덱스 + 1)
    const actualRowNumber = 4 + userRowIndex;
    
    // 구독 정보를 JSON 문자열로 변환 (null인 경우 빈 문자열)
    const subscriptionJson = subscription ? JSON.stringify(subscription) : '';
    
    // Google Sheets API를 사용하여 O열에 구독 정보 저장
    const sheets = google.sheets({ version: 'v4', auth });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${AGENT_SHEET_NAME}!O${actualRowNumber}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[subscriptionJson]]
      }
    });
    
    console.log(`푸시 구독 정보 저장 완료: ${userId} (행 ${actualRowNumber})`);
    return true;
    
  } catch (error) {
    console.error(`푸시 구독 정보 저장 실패 (${userId}):`, error);
    return false;
  }
}

// Google Sheets에서 푸시 구독 정보를 로드하는 함수
async function loadPushSubscriptionsFromSheet() {
  try {
    console.log('Google Sheets에서 푸시 구독 정보 로드 중...');
    
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    if (!agentValues || agentValues.length < 4) {
      console.warn('대리점아이디관리 시트 데이터를 가져올 수 없습니다.');
      return new Map();
    }
    
    // 헤더 제거 (3행까지가 헤더이므로 4행부터 시작)
    const agentRows = agentValues.slice(3);
    
    const subscriptions = new Map();
    
    agentRows.forEach((row, index) => {
      const userId = row[2]; // C열: 연락처(아이디)
      const subscriptionJson = row[14]; // O열: 푸시 구독 정보
      
      if (userId && subscriptionJson) {
        try {
          const subscription = JSON.parse(subscriptionJson);
          subscriptions.set(userId, subscription);
          console.log(`푸시 구독 정보 로드: ${userId}`);
        } catch (error) {
          console.error(`푸시 구독 정보 파싱 실패 (${userId}):`, error);
        }
      }
    });
    
    console.log(`푸시 구독 정보 로드 완료: ${subscriptions.size}개`);
    return subscriptions;
    
  } catch (error) {
    console.error('푸시 구독 정보 로드 실패:', error);
    return new Map();
  }
}

// 서버 시작 시 푸시 구독 정보 로드
async function initializePushSubscriptions() {
  try {
    console.log('서버 시작 시 푸시 구독 정보 초기화 중...');
    const subscriptions = await loadPushSubscriptionsFromSheet();
    
    // 기존 메모리 기반 구독 정보를 시트에서 로드한 정보로 교체
    pushSubscriptions.clear();
    subscriptions.forEach((subscription, userId) => {
      pushSubscriptions.set(userId, subscription);
    });
    
    console.log(`푸시 구독 정보 초기화 완료: ${pushSubscriptions.size}개`);
  } catch (error) {
    console.error('푸시 구독 정보 초기화 실패:', error);
  }
}

// 푸시 알림 관련 API
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ 
    success: true, 
    publicKey: vapidKeys.publicKey 
  });
});

// 푸시 구독 등록
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, userId } = req.body;
    
    console.log('푸시 구독 등록 요청:', {
      hasSubscription: !!subscription,
      userId,
      subscriptionKeys: subscription ? Object.keys(subscription) : []
    });
    
    if (!subscription || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: '구독 정보와 사용자 ID가 필요합니다.' 
      });
    }
    
    // 메모리와 Google Sheets 모두에 구독 정보 저장
    pushSubscriptions.set(userId, subscription);
    
    // Google Sheets에 저장 시도
    const sheetSaveResult = await savePushSubscriptionToSheet(userId, subscription);
    
    console.log(`푸시 구독 등록 완료: ${userId}`, {
      totalSubscriptions: pushSubscriptions.size,
      sheetSaveResult,
      subscription: {
        endpoint: subscription.endpoint,
        keys: subscription.keys ? Object.keys(subscription.keys) : []
      }
    });
    
    res.json({ 
      success: true, 
      sheetSaved: sheetSaveResult 
    });
  } catch (error) {
    console.error('푸시 구독 등록 오류:', error);
    res.status(500).json({ success: false, error: '구독 등록 실패' });
  }
});

// 푸시 구독 해제
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: '사용자 ID가 필요합니다.' 
      });
    }
    
    // 메모리에서 구독 정보 삭제
    pushSubscriptions.delete(userId);
    
    // Google Sheets에서도 구독 정보 삭제 (빈 문자열로 업데이트)
    const sheetDeleteResult = await savePushSubscriptionToSheet(userId, null);
    
    console.log(`푸시 구독 해제: ${userId}`, {
      sheetDeleteResult
    });
    
    res.json({ 
      success: true, 
      sheetDeleted: sheetDeleteResult 
    });
  } catch (error) {
    console.error('푸시 구독 해제 오류:', error);
    res.status(500).json({ success: false, error: '구독 해제 실패' });
  }
});

// 푸시 알림 전송 (특정 사용자)
app.post('/api/push/send', async (req, res) => {
  try {
    const { userId, notification } = req.body;
    
    if (!userId || !notification) {
      return res.status(400).json({ 
        success: false, 
        error: '사용자 ID와 알림 정보가 필요합니다.' 
      });
    }
    
    // 먼저 메모리에서 구독 정보 찾기
    let subscription = pushSubscriptions.get(userId);
    
    // 메모리에 없으면 시트에서 로드
    if (!subscription) {
      try {
        const agentValues = await getSheetValues(AGENT_SHEET_NAME);
        if (agentValues && agentValues.length > 3) {
          const agentRows = agentValues.slice(3);
          const userRow = agentRows.find(row => row[2] === userId);
          if (userRow && userRow[14]) {
            subscription = JSON.parse(userRow[14]);
            console.log(`시트에서 구독 정보 로드: ${userId}`);
          }
        }
      } catch (error) {
        console.error('시트에서 구독 정보 로드 실패:', error);
      }
    }
    
    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        error: '사용자의 푸시 구독을 찾을 수 없습니다.' 
      });
    }
    
    const payload = JSON.stringify({
      title: notification.title || '새로운 알림',
      body: notification.message || '새로운 알림이 도착했습니다.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'assignment-notification',
      data: {
        url: '/',
        timestamp: Date.now(),
        ...notification.data
      }
    });
    
    await webpush.sendNotification(subscription, payload);
    console.log(`푸시 알림 전송 완료: ${userId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('푸시 알림 전송 오류:', error);
    
    // 구독이 만료된 경우 삭제
    if (error.statusCode === 410) {
      const { userId } = req.body;
      pushSubscriptions.delete(userId);
      // 시트에서도 삭제
      await savePushSubscriptionToSheet(userId, null);
      console.log(`만료된 구독 삭제: ${userId}`);
    }
    
    res.status(500).json({ success: false, error: '푸시 알림 전송 실패' });
  }
});

// 모델색상별 정리 데이터 API (최적화 버전)
app.get('/api/reservation-sales/model-color', async (req, res) => {
  try {
    console.log('모델색상별 정리 데이터 요청');
    
    // 캐시 키 생성
    const cacheKey = 'model_color_stats';
    
    // 캐시에서 먼저 확인 (5분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log('캐시된 모델색상별 정리 데이터 반환');
      return res.json(cachedData);
    }
    
    // 1. 정규화된 데이터 가져오기 (캐시 활용)
    const normalizedCacheKey = 'normalized_data_cache';
    let normalizedData = cacheUtils.get(normalizedCacheKey);
    
    if (!normalizedData) {
      const normalizedResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/reservation-settings/normalized-data`);
      if (!normalizedResponse.ok) {
        throw new Error('정규화된 데이터를 가져올 수 없습니다.');
      }
      normalizedData = await normalizedResponse.json();
      
      if (!normalizedData.success) {
        throw new Error('정규화된 데이터 조회 실패');
      }
      
      // 정규화 데이터 캐싱 (10분 TTL)
      cacheUtils.set(normalizedCacheKey, normalizedData, 600);
    }
    
    // 2. 병렬로 시트 데이터 가져오기 (온세일, 모바일가입내역 포함)
    const [reservationSiteValues, yardValues, onSaleValues, mobileJoinValues] = await Promise.all([
      getSheetValues('사전예약사이트'),
      getSheetValues('마당접수'),
      getSheetValues('온세일'),
      getSheetValues('모바일가입내역')
    ]);
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    if (!yardValues || yardValues.length < 2) {
      throw new Error('마당접수 데이터를 가져올 수 없습니다.');
    }
    
    if (!onSaleValues || onSaleValues.length < 2) {
      throw new Error('온세일 데이터를 가져올 수 없습니다.');
    }
    
    if (!mobileJoinValues || mobileJoinValues.length < 2) {
      console.log('모바일가입내역 데이터를 가져올 수 없습니다. (무시됨)');
    }
    
    // 4. 정규화 규칙 매핑 생성
    const normalizationRules = normalizedData.normalizationRules || [];
    const ruleMap = new Map();
    
    console.log(`정규화 규칙 수: ${normalizationRules.length}`);
    
    normalizationRules.forEach(rule => {
      // reservationSite 부분만 사용하여 키 생성 (P|Q|R 형식) - 공백 제거
      const key = rule.reservationSite.replace(/\s+/g, '');
      ruleMap.set(key, rule.normalizedModel);
      console.log(`정규화 규칙 추가: ${key} -> ${rule.normalizedModel}`);
      console.log(`  원본 데이터: reservationSite="${rule.reservationSite}", phonekl="${rule.phonekl}"`);
    });
    
    console.log(`정규화 규칙 매핑 완료: ${ruleMap.size}개 규칙`);
    
    // 5. 마당접수 데이터 인덱싱 (예약번호별 빠른 검색을 위해)
    const yardIndex = new Map();
    let yardIndexCount = 0;
    yardValues.slice(1).forEach((yardRow, index) => {
      if (yardRow.length >= 22) { // V열까지 필요하므로 최소 22개 컬럼
        const uValue = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        const vValue = (yardRow[21] || '').toString().trim(); // V열 (22번째, 0부터 시작)
        const receivedDateTime = (yardRow[11] || '').toString().trim(); // L열 (12번째, 0부터 시작)
        const receivedMemo = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        
        // 예약번호 패턴 찾기 (하이픈이 없는 형태: XX000000)
        const reservationPattern = /[A-Z]{2}\d{6}/g;
        const uMatches = uValue.match(reservationPattern) || [];
        const vMatches = vValue.match(reservationPattern) || [];
        
        // 모든 예약번호를 인덱스에 추가 (이미 하이픈이 없는 형태)
        [...uMatches, ...vMatches].forEach(match => {
          const normalizedReservationNumber = match;
          yardIndex.set(normalizedReservationNumber, {
            receivedDateTime,
            receivedMemo
          });
          yardIndexCount++;
          
          // 처음 5개 마당접수 데이터 로그
          if (index < 5) {
            console.log(`마당접수 인덱싱: 원본="${match}" -> 정규화="${normalizedReservationNumber}"`);
            console.log(`  U열: "${uValue}", V열: "${vValue}"`);
            console.log(`  접수일시: "${receivedDateTime}", 접수메모: "${receivedMemo}"`);
          }
        });
      }
    });
    
    console.log(`마당접수 데이터 인덱싱 완료: ${yardIndex.size}개 예약번호 (총 ${yardIndexCount}개 처리)`);
    console.log(`마당접수 예약번호 샘플:`, Array.from(yardIndex.keys()).slice(0, 5));
    
    // 온세일 데이터 인덱싱 (고객명 + 대리점코드 기준)
    const onSaleIndex = new Map();
    let onSaleIndexCount = 0;
    
    onSaleValues.slice(1).forEach((row, index) => {
      const customerName = row[2] || ''; // C열 (3번째, 0부터 시작)
      const storeCode = row[12] || ''; // M열 (13번째, 0부터 시작)
      const receivedDate = row[5] || ''; // F열 (6번째, 0부터 시작)
      
      if (customerName && storeCode) {
        const key = `${customerName}_${storeCode}`;
        onSaleIndex.set(key, receivedDate);
        onSaleIndexCount++;
        
        // 처음 5개만 디버깅 로그
        if (index < 5) {
          console.log(`온세일 행 ${index + 2}: 고객명="${customerName}", 대리점코드="${storeCode}", 접수일="${receivedDate}"`);
        }
      }
    });

    console.log(`온세일 데이터 인덱싱 완료: ${onSaleIndex.size}개 고객-대리점 조합 (총 ${onSaleIndexCount}개 처리)`);
    console.log(`온세일 데이터 샘플:`, Array.from(onSaleIndex.entries()).slice(0, 5));
    
    // 모바일가입내역 데이터 인덱싱 (예약번호 기준)
    const mobileJoinIndex = new Map();
    let mobileJoinIndexCount = 0;
    
    if (mobileJoinValues && mobileJoinValues.length > 1) {
      mobileJoinValues.slice(1).forEach((row, index) => {
        const reservationNumber = (row[6] || '').toString().trim(); // G열 (7번째, 0부터 시작): 예약번호
        const reservationDateTime = (row[9] || '').toString().trim(); // J열 (10번째, 0부터 시작): 예약일시
        
        if (reservationNumber) {
          // 예약번호 정규화 (하이픈 제거)
          const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
          mobileJoinIndex.set(normalizedReservationNumber, reservationDateTime);
          mobileJoinIndexCount++;
          
          // 처음 5개만 디버깅 로그
          if (index < 5) {
            console.log(`모바일가입내역 행 ${index + 2}: 예약번호="${reservationNumber}", 정규화="${normalizedReservationNumber}", 예약일시="${reservationDateTime}"`);
          }
        }
      });
    }
    
    console.log(`모바일가입내역 데이터 인덱싱 완료: ${mobileJoinIndex.size}개 예약번호 (총 ${mobileJoinIndexCount}개 처리)`);
    console.log(`모바일가입내역 데이터 샘플:`, Array.from(mobileJoinIndex.entries()).slice(0, 5));
    
    // 6. 사전예약사이트 데이터 처리
    const reservationSiteRows = reservationSiteValues.slice(1); // 헤더 제거
    const modelColorStats = new Map(); // 모델색상별 통계
    
    // 사전예약사이트 데이터 처리
    
    let processedCount = 0;
    let matchedCount = 0;
    
    reservationSiteRows.forEach((row, index) => {
      if (row.length < 20) {
        console.log(`행 ${index + 1}: 컬럼 수 부족 (${row.length})`);
        return; // 최소 컬럼 수 확인
      }
      
      const pValue = (row[15] || '').toString().trim(); // P열
      const qValue = (row[16] || '').toString().trim(); // Q열
      const rValue = (row[17] || '').toString().trim(); // R열
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const storeCode = (row[23] || '').toString().trim(); // X열: 대리점코드
      const type = (row[31] || '').toString().trim(); // AF열: 유형
      
      // 처음 몇 개 행의 데이터 확인
      if (index < 5) {
        console.log(`행 ${index + 1} 데이터: P="${pValue}", Q="${qValue}", R="${rValue}", 예약번호="${reservationNumber}", 유형="${type}"`);
      }
      
      if (!pValue || !qValue || !rValue || !reservationNumber) {
        if (index < 10) {
          console.log(`행 ${index + 1}: 필수 데이터 누락 - P:${!!pValue}, Q:${!!qValue}, R:${!!rValue}, 예약번호:${!!reservationNumber}`);
        }
        return;
      }
      
      processedCount++;
      
      // 정규화된 모델명 찾기 (공백 제거)
      const originalKey = `${pValue}|${qValue}|${rValue}`.replace(/\s+/g, '');
      const normalizedModel = ruleMap.get(originalKey);
      
      if (!normalizedModel) {
        if (index < 5) {
          console.log(`정규화되지 않은 모델: ${originalKey}`);
          console.log(`  원본 값: P="${pValue}", Q="${qValue}", R="${rValue}"`);
        }
        return; // 정규화되지 않은 모델은 제외
      }
      
      matchedCount++;
      console.log(`정규화된 모델 매칭: ${originalKey} -> ${normalizedModel}`);
      
      // 모델과 색상 분리 (정규화된 모델명에서 모델명만 추출)
      // "Z Fold7 512G 블루 쉐도우 SM-F966N_512G 블루 쉐도우" -> "Z Fold7 512G 블루 쉐도우"
      const modelMatch = normalizedModel.match(/^(.+?)\s+SM-[A-Z0-9_]+/);
      if (!modelMatch) {
        if (index < 5) {
          console.log(`모델명 추출 실패: 정규화된모델="${normalizedModel}"`);
          console.log(`  정규표현식 매칭 실패: ${normalizedModel}`);
        }
        return;
      }
      
      const model = modelMatch[1].trim();
      const color = ''; // 색상은 모델명에 포함되어 있으므로 별도 추출하지 않음
      
      if (!model) {
        if (index < 5) {
          console.log(`모델명이 비어있음: 정규화된모델="${normalizedModel}"`);
        }
        return;
      }
      
      if (index < 5) {
        console.log(`모델명 추출 성공: 정규화된모델="${normalizedModel}" -> 모델명="${model}"`);
      }
      
      // 유형 분류 함수
      const classifyType = (typeValue) => {
        if (!typeValue) return '기타';
        const typeStr = typeValue.toString().trim();
        if (typeStr.includes('신규가입')) return '신규';
        if (typeStr.includes('번호이동')) return 'MNP';
        if (typeStr.includes('기기변경')) return '기변';
        return '기타';
      };
      
      const classifiedType = classifyType(type);
      
      const key = model; // 모델명만으로 키 생성
      
      if (!modelColorStats.has(key)) {
        modelColorStats.set(key, {
          model,
          total: 0,
          received: {
            신규: 0,
            MNP: 0,
            기변: 0,
            기타: 0
          },
          notReceived: {
            신규: 0,
            MNP: 0,
            기변: 0,
            기타: 0
          }
        });
      }
      
      const stats = modelColorStats.get(key);
      stats.total++;
      
      // 서류접수 여부 확인 (마당접수 OR 온세일 접수)
      // 예약번호도 하이픈 제거하여 정규화된 형태로 비교
      const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
      const isYardReceived = yardIndex.has(normalizedReservationNumber);
      const isOnSaleReceived = onSaleIndex.has(`${customerName}_${storeCode}`);
      const isReceived = isYardReceived || isOnSaleReceived;
      
      if (index < 5) {
        console.log(`서류접수 매칭 시도: 예약번호="${reservationNumber}" -> 정규화="${normalizedReservationNumber}" -> 마당접수=${isYardReceived}, 온세일접수=${isOnSaleReceived}, 최종결과=${isReceived}`);
        console.log(`  마당접수 인덱스에 존재: ${yardIndex.has(normalizedReservationNumber)}`);
        console.log(`  온세일 인덱스에 존재: ${onSaleIndex.has(`${customerName}_${storeCode}`)}`);
      }
      
      if (isReceived) {
        stats.received[classifiedType]++;
        if (index < 5) {
          console.log(`✅ 서류접수 확인됨: ${reservationNumber} (정규화: ${normalizedReservationNumber}) -> ${model} (${classifiedType})`);
        }
      } else {
        stats.notReceived[classifiedType]++;
        if (index < 5) {
          console.log(`❌ 서류미접수: ${reservationNumber} (정규화: ${normalizedReservationNumber}) -> ${model} (${classifiedType})`);
        }
      }
    });
    
    // 7. 결과 정렬 및 반환
    const result = Array.from(modelColorStats.values())
      .sort((a, b) => b.total - a.total) // 총 수량 내림차순 정렬
      .map((item, index) => {
        // 유형별 합계 계산
        const receivedTotal = item.received.신규 + item.received.MNP + item.received.기변 + item.received.기타;
        const notReceivedTotal = item.notReceived.신규 + item.notReceived.MNP + item.notReceived.기변 + item.notReceived.기타;
        
        return {
          ...item,
          rank: index + 1,
          receivedTotal,
          notReceivedTotal
        };
      });
    
    console.log(`모델색상별 정리 데이터 생성 완료: ${result.length}개 모델색상 조합`);
    console.log(`처리된 데이터: ${processedCount}개, 매칭된 데이터: ${matchedCount}개`);
    console.log(`모델색상 통계: ${modelColorStats.size}개 조합`);
    
    const responseData = {
      success: true,
      data: result,
      total: result.length,
      stats: {
        totalItems: result.reduce((sum, item) => sum + item.total, 0),
        totalReceived: result.reduce((sum, item) => sum + item.receivedTotal, 0),
        totalNotReceived: result.reduce((sum, item) => sum + item.notReceivedTotal, 0)
      }
    };
    
    // 결과 캐싱 (5분 TTL)
    cacheUtils.set(cacheKey, responseData, 300);
    
    res.json(responseData);
    
  } catch (error) {
    console.error('모델색상별 정리 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load model-color data',
      message: error.message
    });
  }
});

// POS별 모델색상 데이터 API (최적화 버전)
app.get('/api/reservation-sales/model-color/by-pos/:posName', async (req, res) => {
  try {
    const { posName } = req.params;
    console.log(`POS별 모델색상 데이터 요청: ${posName}`);
    
    // 캐시 키 생성
    const cacheKey = `pos_customer_list_${posName}`;
    
    // 캐시에서 먼저 확인 (5분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log(`캐시된 POS별 고객 리스트 반환: ${posName}`);
      return res.json(cachedData);
    }
    
    // 1. 정규화된 데이터 가져오기 (캐시 활용)
    const normalizedCacheKey = 'normalized_data_cache';
    let normalizedData = cacheUtils.get(normalizedCacheKey);
    
    if (!normalizedData) {
      const normalizedResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/reservation-settings/normalized-data`);
      if (!normalizedResponse.ok) {
        throw new Error('정규화된 데이터를 가져올 수 없습니다.');
      }
      normalizedData = await normalizedResponse.json();
      
      if (!normalizedData.success) {
        throw new Error('정규화된 데이터 조회 실패');
      }
      
      // 정규화 데이터 캐싱 (10분 TTL)
      cacheUtils.set(normalizedCacheKey, normalizedData, 600);
    }
    
    // 2. 병렬로 모든 시트 데이터 가져오기
    const [reservationSiteValues, yardValues, onSaleValues] = await Promise.all([
      getSheetValues('사전예약사이트'),
      getSheetValues('마당접수'),
      getSheetValues('온세일')
    ]);

    // 3. POS코드변경설정 시트 로드 (선택사항 - 없어도 에러 발생하지 않음)
    let posCodeMappingValues = null;
    try {
      posCodeMappingValues = await getSheetValues('POS코드변경설정');
      console.log('POS별 고객리스트: POS코드변경설정 시트 로드 성공');
    } catch (error) {
      console.log('POS별 고객리스트: POS코드변경설정 시트 로드 실패 (무시됨):', error.message);
      posCodeMappingValues = [];
    }
    
    // POS코드/이름 매핑 테이블 생성
    const posCodeMapping = new Map();
    const posNameMapping = new Map();
    const posNameMappingWithReceiver = new Map();
    
    if (posCodeMappingValues && posCodeMappingValues.length > 1) {
      posCodeMappingValues.slice(1).forEach(row => {
        if (row.length >= 4) {
          const originalCode = (row[0] || '').toString().trim();
          const newCode = (row[1] || '').toString().trim();
          const originalName = (row[2] || '').toString().trim();
          const newName = (row[3] || '').toString().trim();
          const receiver = row.length > 4 ? (row[4] || '').toString().trim() : '';
          
          if (originalCode && newCode) {
            posCodeMapping.set(originalCode, newCode);
          }
          
          if (originalName && newName) {
            if (receiver) {
              // 접수자별 매핑
              const key = `${originalName}_${receiver}`;
              posNameMappingWithReceiver.set(key, newName);
            } else {
              // 일반 매핑
              posNameMapping.set(originalName, newName);
            }
          }
        }
      });
      console.log(`POS별 고객리스트: POS코드 매핑 ${posCodeMapping.size}개, POS명 매핑 ${posNameMapping.size}개, 접수자별 매핑 ${posNameMappingWithReceiver.size}개 로드`);
    }
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    if (!yardValues || yardValues.length < 2) {
      throw new Error('마당접수 데이터를 가져올 수 없습니다.');
    }
    
    if (!onSaleValues || onSaleValues.length < 2) {
      throw new Error('온세일 데이터를 가져올 수 없습니다.');
    }
    
    // 4. 정규화 규칙 매핑 생성
    const normalizationRules = normalizedData.normalizationRules || [];
    const ruleMap = new Map();
    
    normalizationRules.forEach(rule => {
      const key = rule.reservationSite.replace(/\s+/g, '');
      ruleMap.set(key, rule.normalizedModel);
    });
    
    // 4. 마당접수 데이터 인덱싱 (예약번호별 빠른 검색을 위해)
    const yardIndex = new Map();
    let yardIndexCount = 0;
    yardValues.slice(1).forEach((yardRow, index) => {
      if (yardRow.length >= 22) { // V열까지 필요하므로 최소 22개 컬럼
        const uValue = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        const vValue = (yardRow[21] || '').toString().trim(); // V열 (22번째, 0부터 시작)
        const receivedDateTime = (yardRow[11] || '').toString().trim(); // L열 (12번째, 0부터 시작)
        const receivedMemo = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        
        // 예약번호 패턴 찾기 (하이픈이 없는 형태: XX000000)
        const reservationPattern = /[A-Z]{2}\d{6}/g;
        const uMatches = uValue.match(reservationPattern) || [];
        const vMatches = vValue.match(reservationPattern) || [];
        
        // 모든 예약번호를 인덱스에 추가 (이미 하이픈이 없는 형태)
        [...uMatches, ...vMatches].forEach(match => {
          const normalizedReservationNumber = match;
          yardIndex.set(normalizedReservationNumber, {
            receivedDateTime,
            receivedMemo
          });
          yardIndexCount++;
          
          // 처음 5개 마당접수 데이터 로그
          if (index < 5) {
            console.log(`POS별 마당접수 인덱싱: 원본="${match}" -> 정규화="${normalizedReservationNumber}"`);
            console.log(`  U열: "${uValue}", V열: "${vValue}"`);
            console.log(`  접수일시: "${receivedDateTime}", 접수메모: "${receivedMemo}"`);
          }
        });
      }
    });
    
    console.log(`POS별 마당접수 데이터 인덱싱 완료: ${yardIndex.size}개 예약번호 (총 ${yardIndexCount}개 처리)`);
    console.log(`POS별 마당접수 예약번호 샘플:`, Array.from(yardIndex.keys()).slice(0, 5));
    
    // 온세일 데이터 인덱싱 (고객명 + 대리점코드 기준)
    const onSaleIndex = new Map();
    let onSaleIndexCount = 0;
    
    onSaleValues.slice(1).forEach(row => {
      const customerName = row[2] || ''; // C열 (3번째, 0부터 시작)
      const storeCode = row[12] || ''; // M열 (13번째, 0부터 시작)
      const receivedDate = row[5] || ''; // F열 (6번째, 0부터 시작)
      
      if (customerName && storeCode) {
        const key = `${customerName}_${storeCode}`;
        onSaleIndex.set(key, receivedDate);
        onSaleIndexCount++;
      }
    });

    console.log(`POS별 온세일 데이터 인덱싱 완료: ${onSaleIndex.size}개 고객-대리점 조합 (총 ${onSaleIndexCount}개 처리)`);
    
    // 5. 사전예약사이트 데이터 처리 (POS별 필터링, 최적화)
    const reservationSiteRows = reservationSiteValues.slice(1);
    const customerList = [];
    
    // POS별 필터링을 먼저 수행하여 처리할 데이터 양 줄이기
    // 매핑된 POS명도 포함하여 필터링
    const targetPosNames = new Set([posName]);
    
    // 매핑된 POS명에서 원본 POS명 찾기
    for (const [originalName, mappedName] of posNameMapping.entries()) {
      if (mappedName === posName) {
        targetPosNames.add(originalName);
      }
    }
    
    // 접수자별 매핑에서도 원본 POS명 찾기
    for (const [key, mappedName] of posNameMappingWithReceiver.entries()) {
      if (mappedName === posName) {
        const originalName = key.split('_')[0]; // key는 "원본POS명_접수자" 형태
        targetPosNames.add(originalName);
      }
    }
    
    console.log(`POS "${posName}" 필터링 대상:`, Array.from(targetPosNames));
    
    const filteredRows = reservationSiteRows.filter(row => {
      if (row.length < 30) return false;
      const rowPosName = (row[22] || '').toString().trim(); // W열: POS명
      return targetPosNames.has(rowPosName);
    });
    
    console.log(`POS "${posName}" 필터링 결과: ${filteredRows.length}개 행 (전체 ${reservationSiteRows.length}개 중)`);
    
    filteredRows.forEach((row, index) => {
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const reservationDateTime = (row[14] || '').toString().trim(); // O열: 예약일시
      const model = (row[15] || '').toString().trim(); // P열: 모델
      const capacity = (row[16] || '').toString().trim(); // Q열: 용량
      const color = (row[17] || '').toString().trim(); // R열: 색상
      const type = row.length > 31 ? (row[31] || '') : ''; // AF열: 유형
      const storeCode = (row[23] || '').toString().trim(); // X열: 대리점코드
      const originalPosName = (row[22] || '').toString().trim(); // W열: POS명 (원본)
      const reservationMemo = row.length > 34 ? (row[34] || '') : ''; // AI열: 예약메모
      const receiver = (row[25] || '').toString().trim(); // Z열: 접수자
      
      if (!reservationNumber || !customerName || !model || !capacity || !color) return;
      
      // 서류접수 정보 찾기 (인덱스 활용으로 빠른 검색)
      // 예약번호도 하이픈 제거하여 정규화된 형태로 비교
      const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
      const yardData = yardIndex.get(normalizedReservationNumber) || {};
      const receivedDateTime = yardData.receivedDateTime || '';
      const receivedMemo = yardData.receivedMemo || '';
      
      // 온세일접수 정보 매칭 (온세일 → 모바일가입내역 순서로 찾기)
      const onSaleKey = `${customerName}_${storeCode}`;
      let onSaleReceivedDate = onSaleIndex.get(onSaleKey) || '';
      
      // 온세일에서 찾지 못한 경우 모바일가입내역에서 찾기
      if (!onSaleReceivedDate && mobileJoinIndex.has(normalizedReservationNumber)) {
        onSaleReceivedDate = mobileJoinIndex.get(normalizedReservationNumber);
        if (index < 5) {
          console.log(`  모바일가입내역에서 온세일접수일 찾음: "${onSaleReceivedDate}"`);
        }
      }
      
      // POS명 매핑 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedPosName = originalPosName;
      if (originalPosName && receiver) {
        // 접수자별 매핑 먼저 확인
        const receiverKey = `${originalPosName}_${receiver}`;
        if (posNameMappingWithReceiver.has(receiverKey)) {
          mappedPosName = posNameMappingWithReceiver.get(receiverKey);
        } else if (posNameMapping.has(originalPosName)) {
          // 일반 매핑 확인
          mappedPosName = posNameMapping.get(originalPosName);
        }
      } else if (originalPosName && posNameMapping.has(originalPosName)) {
        // 일반 매핑만 확인
        mappedPosName = posNameMapping.get(originalPosName);
      }
      
      // 처음 5개 고객의 접수정보 디버깅 로그
      if (index < 5) {
        console.log(`POS별 고객리스트 접수정보 매칭: 고객명="${customerName}", 예약번호="${reservationNumber}"`);
        console.log(`  정규화된 예약번호: "${normalizedReservationNumber}"`);
        console.log(`  마당접수 인덱스 존재: ${yardIndex.has(normalizedReservationNumber)}`);
        console.log(`  접수일시: "${receivedDateTime}"`);
        console.log(`  접수메모: "${receivedMemo}"`);
        console.log(`  온세일접수일: "${onSaleReceivedDate}"`);
        console.log(`  모델명: "${model}"`);
        console.log(`  원본 POS명: "${originalPosName}" -> 매핑된 POS명: "${mappedPosName}"`);
      }
      
      // 모델/용량/색상 조합
      const modelCapacityColor = [model, capacity, color].filter(Boolean).join('/');
      
      customerList.push({
        customerName,
        reservationNumber,
        reservationDateTime,
        yardReceivedDate: receivedDateTime,
        onSaleReceivedDate,
        modelCapacityColor, // 모델&용량&색상으로 변경
        type,
        storeCode,
        posName: mappedPosName, // 매핑된 POS명 사용
        reservationMemo,
        yardReceivedMemo: receivedMemo,
        receiver
      });
    });
    
    // 6. 예약일시로 오름차순 정렬
    customerList.sort((a, b) => {
      const dateA = new Date(a.reservationDateTime);
      const dateB = new Date(b.reservationDateTime);
      return dateA - dateB;
    });
    
    console.log(`POS별 고객 리스트 생성 완료: ${customerList.length}개 고객`);
    
    const result = {
      success: true,
      data: customerList,
      total: customerList.length,
      posName: posName
    };
    
    // 결과 캐싱 (5분 TTL)
    cacheUtils.set(cacheKey, result, 300);
    
    res.json(result);
    
  } catch (error) {
    console.error('POS별 모델색상 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load POS-specific data',
      message: error.message
    });
  }
});

// 모델별 고객 리스트 API (최적화 버전)
app.get('/api/reservation-sales/customers/by-model/:model', async (req, res) => {
  try {
    const { model } = req.params;
    console.log(`모델별 고객 리스트 요청: ${model}`);
    
    // 캐시 키 생성 (POS 매핑 포함)
    const cacheKey = `model_customer_list_with_pos_mapping_${model}`;
    
    // 캐시에서 먼저 확인 (5분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log(`캐시된 모델별 고객 리스트 반환: ${model}`);
      return res.json(cachedData);
    }
    
    // 1. 정규화된 데이터 가져오기 (캐시 활용)
    const normalizedCacheKey = 'normalized_data_cache';
    let normalizedData = cacheUtils.get(normalizedCacheKey);
    
    if (!normalizedData) {
      const normalizedResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/reservation-settings/normalized-data`);
      if (!normalizedResponse.ok) {
        throw new Error('정규화된 데이터를 가져올 수 없습니다.');
      }
      normalizedData = await normalizedResponse.json();
      
      if (!normalizedData.success) {
        throw new Error('정규화된 데이터 조회 실패');
      }
      
      // 정규화 데이터 캐싱 (10분 TTL)
      cacheUtils.set(normalizedCacheKey, normalizedData, 600);
    }
    
    // 2. 병렬로 시트 데이터 가져오기 (온세일, 모바일가입내역 포함)
    const [reservationSiteValues, yardValues, onSaleValues, mobileJoinValues] = await Promise.all([
      getSheetValues('사전예약사이트'),
      getSheetValues('마당접수'),
      getSheetValues('온세일'),
      getSheetValues('모바일가입내역')
    ]);

    // 3. POS코드변경설정 시트 로드 (선택사항 - 없어도 에러 발생하지 않음)
    let posCodeMappingValues = null;
    try {
      posCodeMappingValues = await getSheetValues('POS코드변경설정');
      console.log('모델별 고객리스트: POS코드변경설정 시트 로드 성공');
    } catch (error) {
      console.log('모델별 고객리스트: POS코드변경설정 시트 로드 실패 (무시됨):', error.message);
      posCodeMappingValues = [];
    }
    
    // POS코드/이름 매핑 테이블 생성
    const posCodeMapping = new Map();
    const posNameMapping = new Map();
    const posNameMappingWithReceiver = new Map();
    
    if (posCodeMappingValues && posCodeMappingValues.length > 1) {
      posCodeMappingValues.slice(1).forEach(row => {
        if (row.length >= 4) {
          const originalCode = (row[0] || '').toString().trim();
          const newCode = (row[1] || '').toString().trim();
          const originalName = (row[2] || '').toString().trim();
          const newName = (row[3] || '').toString().trim();
          const receiver = row.length > 4 ? (row[4] || '').toString().trim() : '';
          
          if (originalCode && newCode) {
            posCodeMapping.set(originalCode, newCode);
          }
          
          if (originalName && newName) {
            if (receiver) {
              // 접수자별 매핑
              const key = `${originalName}_${receiver}`;
              posNameMappingWithReceiver.set(key, newName);
            } else {
              // 일반 매핑
              posNameMapping.set(originalName, newName);
            }
          }
        }
      });
      console.log(`모델별 고객리스트: POS코드 매핑 ${posCodeMapping.size}개, POS명 매핑 ${posNameMapping.size}개, 접수자별 매핑 ${posNameMappingWithReceiver.size}개 로드`);
      
      // 매핑 테이블 내용 디버깅 (처음 5개만)
      console.log('모델별 POS명 매핑 테이블 내용:');
      let count = 0;
      for (const [original, mapped] of posNameMapping.entries()) {
        if (count < 5) {
          console.log(`  "${original}" -> "${mapped}"`);
          count++;
        }
      }
      
      console.log('모델별 접수자별 POS명 매핑 테이블 내용:');
      count = 0;
      for (const [key, mapped] of posNameMappingWithReceiver.entries()) {
        if (count < 5) {
          console.log(`  "${key}" -> "${mapped}"`);
          count++;
        }
      }
    }
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    if (!yardValues || yardValues.length < 2) {
      throw new Error('마당접수 데이터를 가져올 수 없습니다.');
    }
    
    if (!mobileJoinValues || mobileJoinValues.length < 2) {
      console.log('모바일가입내역 데이터를 가져올 수 없습니다. (무시됨)');
    }
    
    // 온세일 데이터 인덱싱 (고객명 + 대리점코드 기준)
    const onSaleIndex = new Map();
    let onSaleIndexCount = 0;
    onSaleValues.slice(1).forEach(row => {
      const customerName = row[2] || '';
      const storeCode = row[12] || '';
      const receivedDate = row[5] || '';
      if (customerName && storeCode) {
        const key = `${customerName}_${storeCode}`;
        onSaleIndex.set(key, receivedDate);
        onSaleIndexCount++;
      }
    });
    
    // 모바일가입내역 데이터 인덱싱 (예약번호 기준)
    const mobileJoinIndex = new Map();
    let mobileJoinIndexCount = 0;
    
    if (mobileJoinValues && mobileJoinValues.length > 1) {
      mobileJoinValues.slice(1).forEach((row, index) => {
        const reservationNumber = (row[6] || '').toString().trim(); // G열 (7번째, 0부터 시작): 예약번호
        const reservationDateTime = (row[9] || '').toString().trim(); // J열 (10번째, 0부터 시작): 예약일시
        
        if (reservationNumber) {
          // 예약번호 정규화 (하이픈 제거)
          const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
          mobileJoinIndex.set(normalizedReservationNumber, reservationDateTime);
          mobileJoinIndexCount++;
          
          // 처음 5개만 디버깅 로그
          if (index < 5) {
            console.log(`모델별 모바일가입내역 행 ${index + 2}: 예약번호="${reservationNumber}", 정규화="${normalizedReservationNumber}", 예약일시="${reservationDateTime}"`);
          }
        }
      });
    }
    
    console.log(`모델별 모바일가입내역 데이터 인덱싱 완료: ${mobileJoinIndex.size}개 예약번호 (총 ${mobileJoinIndexCount}개 처리)`);
    
    // 3. 정규화 규칙 매핑 생성
    const normalizationRules = normalizedData.normalizationRules || [];
    const ruleMap = new Map();
    
    normalizationRules.forEach(rule => {
      const key = rule.reservationSite.replace(/\s+/g, '');
      ruleMap.set(key, rule.normalizedModel);
    });
    
    // 4. 마당접수 데이터 인덱싱 (예약번호별 빠른 검색을 위해)
    const yardIndex = new Map();
    let yardIndexCount = 0;
    yardValues.slice(1).forEach((yardRow, index) => {
      if (yardRow.length >= 22) { // V열까지 필요하므로 최소 22개 컬럼
        const uValue = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        const vValue = (yardRow[21] || '').toString().trim(); // V열 (22번째, 0부터 시작)
        const receivedDateTime = (yardRow[11] || '').toString().trim(); // L열 (12번째, 0부터 시작)
        const receivedMemo = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        
        // 예약번호 패턴 찾기 (하이픈이 없는 형태: XX000000)
        const reservationPattern = /[A-Z]{2}\d{6}/g;
        const uMatches = uValue.match(reservationPattern) || [];
        const vMatches = vValue.match(reservationPattern) || [];
        
        // 모든 예약번호를 인덱스에 추가 (이미 하이픈이 없는 형태)
        [...uMatches, ...vMatches].forEach(match => {
          const normalizedReservationNumber = match;
          yardIndex.set(normalizedReservationNumber, {
            receivedDateTime,
            receivedMemo
          });
          yardIndexCount++;
          
          // 처음 5개 마당접수 데이터 로그
          if (index < 5) {
            console.log(`모델별 마당접수 인덱싱: 원본="${match}" -> 정규화="${normalizedReservationNumber}"`);
            console.log(`  U열: "${uValue}", V열: "${vValue}"`);
            console.log(`  접수일시: "${receivedDateTime}", 접수메모: "${receivedMemo}"`);
          }
        });
      }
    });
    
    console.log(`모델별 마당접수 데이터 인덱싱 완료: ${yardIndex.size}개 예약번호 (총 ${yardIndexCount}개 처리)`);
    console.log(`모델별 마당접수 예약번호 샘플:`, Array.from(yardIndex.keys()).slice(0, 5));
    
    // 5. 사전예약사이트 데이터 처리 (모델별 필터링, 최적화)
    const reservationSiteRows = reservationSiteValues.slice(1);
    const customerList = [];
    
    // 디버깅: 요청된 모델명과 실제 데이터의 모델명 비교
    console.log(`모델별 고객리스트 필터링: 요청된 모델명="${req.params.model}"`);
    
    // 실제 데이터에서 사용되는 모델명들 수집 (처음 20개)
    const actualModels = new Set();
    reservationSiteRows.slice(0, 20).forEach((row, index) => {
      if (row.length >= 16) {
        const actualModel = (row[15] || '').toString().trim(); // P열: 모델
        if (actualModel) {
          actualModels.add(actualModel);
        }
      }
    });
    console.log(`실제 데이터의 모델명 샘플 (처음 20개):`, Array.from(actualModels));
    
    reservationSiteRows.forEach((row, index) => {
      if (row.length < 30) return;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const reservationDateTime = (row[14] || '').toString().trim(); // O열: 예약일시
      const model = (row[15] || '').toString().trim(); // P열: 모델
      const capacity = (row[16] || '').toString().trim(); // Q열: 용량
      const color = (row[17] || '').toString().trim(); // R열: 색상
      const type = row.length > 31 ? (row[31] || '') : ''; // AF열: 유형
      const storeCode = (row[23] || '').toString().trim(); // X열: 대리점코드
      const posName = (row[22] || '').toString().trim(); // W열: POS명
      const reservationMemo = row.length > 34 ? (row[34] || '') : ''; // AI열: 예약메모
      const receiver = (row[25] || '').toString().trim(); // Z열: 접수자
      
      if (!reservationNumber || !customerName || !model || !capacity || !color) return;
      
      // 모델 필터링 (모델+용량+색상 조합으로 정확히 비교)
      // 요청된 모델명을 모델/용량/색상으로 분해
      const requestedParts = req.params.model.split(' ');
      const requestedModel = requestedParts.slice(0, 2).join(' '); // "Z Flip7"
      const requestedCapacity = requestedParts[2]; // "512G"
      const requestedColor = requestedParts.slice(3).join(' '); // "제트블랙"
      
      // 데이터의 모델/용량/색상과 비교
      if (model !== requestedModel || capacity !== requestedCapacity || color !== requestedColor) {
        // 처음 10개만 로그 출력
        if (index < 10) {
          console.log(`모델 불일치: 데이터="${model} ${capacity} ${color}" vs 요청="${requestedModel} ${requestedCapacity} ${requestedColor}"`);
        }
        return;
      }
      
      // 서류접수 정보 찾기 (인덱스 활용으로 빠른 검색)
      // 예약번호도 하이픈 제거하여 정규화된 형태로 비교
      const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
      const yardData = yardIndex.get(normalizedReservationNumber) || {};
      const receivedDateTime = yardData.receivedDateTime || '';
      const receivedMemo = yardData.receivedMemo || '';
      
      // 온세일 접수일 (온세일 → 모바일가입내역 순서로 찾기)
      const onSaleKey = `${customerName}_${storeCode}`;
      let onSaleReceivedDate = onSaleIndex.get(onSaleKey) || '';
      
      // 온세일에서 찾지 못한 경우 모바일가입내역에서 찾기
      if (!onSaleReceivedDate && mobileJoinIndex.has(normalizedReservationNumber)) {
        onSaleReceivedDate = mobileJoinIndex.get(normalizedReservationNumber);
        if (index < 5) {
          console.log(`  모바일가입내역에서 온세일접수일 찾음: "${onSaleReceivedDate}"`);
        }
      }
      
      // POS명 매핑 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedPosName = posName;
      if (posName && receiver) {
        // 접수자별 매핑 먼저 확인
        const receiverKey = `${posName}_${receiver}`;
        if (posNameMappingWithReceiver.has(receiverKey)) {
          mappedPosName = posNameMappingWithReceiver.get(receiverKey);
        } else if (posNameMapping.has(posName)) {
          // 일반 매핑 확인
          mappedPosName = posNameMapping.get(posName);
        }
      } else if (posName && posNameMapping.has(posName)) {
        // 일반 매핑만 확인
        mappedPosName = posNameMapping.get(posName);
      }
      
      // 처음 5개 고객의 접수정보 디버깅 로그
      if (index < 5) {
        console.log(`모델별 고객리스트 접수정보 매칭: 고객명="${customerName}", 예약번호="${reservationNumber}"`);
        console.log(`  정규화된 예약번호: "${normalizedReservationNumber}"`);
        console.log(`  마당접수 인덱스 존재: ${yardIndex.has(normalizedReservationNumber)}`);
        console.log(`  마당접수일: "${receivedDateTime}"`);
        console.log(`  마당메모: "${receivedMemo}"`);
        console.log(`  온세일접수일: "${onSaleReceivedDate}"`);
        console.log(`  모델명: "${model}"`);
        console.log(`  원본 POS명: "${posName}" -> 매핑된 POS명: "${mappedPosName}"`);
      }
      
      // 모델/용량/색상 조합
      const modelCapacityColor = [model, capacity, color].filter(Boolean).join('/');
      
      customerList.push({
        customerName,
        reservationNumber,
        reservationDateTime,
        yardReceivedDate: receivedDateTime,
        onSaleReceivedDate,
        modelCapacityColor, // 모델&용량&색상으로 변경
        type,
        storeCode,
        posName: mappedPosName, // 매핑된 POS명 사용
        reservationMemo,
        yardReceivedMemo: receivedMemo,
        receiver
      });
    });
    
    // 6. 예약일시로 오름차순 정렬
    customerList.sort((a, b) => {
      const dateA = new Date(a.reservationDateTime);
      const dateB = new Date(b.reservationDateTime);
      return dateA - dateB;
    });
    
    console.log(`모델별 고객 리스트 생성 완료: ${customerList.length}개 고객`);
    
    const result = {
      success: true,
      data: customerList,
      total: customerList.length,
      model: req.params.model
    };
    
    // 결과 캐싱 (5분 TTL)
    cacheUtils.set(cacheKey, result, 300);
    
    res.json(result);
    
  } catch (error) {
    console.error('모델별 고객 리스트 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load model-specific customer data',
      message: error.message
    });
  }
});

// 모델별 고객 리스트 API (model-color 경로)
app.get('/api/reservation-sales/model-color/by-model/:model', async (req, res) => {
  try {
    const { model } = req.params;
    console.log(`모델별 고객 리스트 요청 (model-color): ${model}`);
    
    // 기존 customers/by-model API를 재사용
    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/reservation-sales/customers/by-model/${encodeURIComponent(model)}`);
    
    if (!response.ok) {
      throw new Error('모델별 고객 리스트를 불러올 수 없습니다.');
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('모델별 고객 리스트 조회 오류 (model-color):', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load model-specific customer data',
      message: error.message
    });
  }
});

// 푸시 구독 정보 관리 API
app.get('/api/push/subscriptions', async (req, res) => {
  try {
    // 메모리와 시트의 모든 구독 정보 수집
    const allSubscriptions = new Map(pushSubscriptions);
    
    // 시트에서 추가 구독 정보 로드
    try {
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      if (agentValues && agentValues.length > 3) {
        const agentRows = agentValues.slice(3);
        agentRows.forEach(row => {
          const userId = row[2]; // C열: 연락처(아이디)
          const subscriptionJson = row[14]; // O열: 푸시 구독 정보
          
          if (userId && subscriptionJson && !allSubscriptions.has(userId)) {
            try {
              const subscription = JSON.parse(subscriptionJson);
              allSubscriptions.set(userId, subscription);
            } catch (error) {
              console.error(`구독 정보 파싱 실패 (${userId}):`, error);
            }
          }
        });
      }
    } catch (error) {
      console.error('시트에서 구독 정보 로드 실패:', error);
    }
    
    const subscriptions = Array.from(allSubscriptions.entries()).map(([userId, subscription]) => ({
      userId,
      endpoint: subscription.endpoint,
      hasKeys: !!subscription.keys,
      source: pushSubscriptions.has(userId) ? 'memory' : 'sheet'
    }));
    
    res.json({
      success: true,
      subscriptions,
      totalCount: subscriptions.length,
      memoryCount: pushSubscriptions.size,
      sheetCount: subscriptions.length - pushSubscriptions.size
    });
  } catch (error) {
    console.error('푸시 구독 정보 조회 오류:', error);
    res.status(500).json({ success: false, error: '구독 정보 조회 실패' });
  }
});

// 푸시 알림 전송 (모든 구독자)
app.post('/api/push/send-all', async (req, res) => {
  try {
    const { notification } = req.body;
    
    if (!notification) {
      return res.status(400).json({ 
        success: false, 
        error: '알림 정보가 필요합니다.' 
      });
    }
    
    const payload = JSON.stringify({
      title: notification.title || '새로운 알림',
      body: notification.message || '새로운 알림이 도착했습니다.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'assignment-notification',
      data: {
        url: '/',
        timestamp: Date.now(),
        ...notification.data
      }
    });
    
    const results = [];
    const expiredSubscriptions = [];
    
    // 메모리와 시트의 모든 구독 정보 수집
    const allSubscriptions = new Map(pushSubscriptions);
    
    // 시트에서 추가 구독 정보 로드
    try {
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      if (agentValues && agentValues.length > 3) {
        const agentRows = agentValues.slice(3);
        agentRows.forEach(row => {
          const userId = row[2]; // C열: 연락처(아이디)
          const subscriptionJson = row[14]; // O열: 푸시 구독 정보
          
          if (userId && subscriptionJson && !allSubscriptions.has(userId)) {
            try {
              const subscription = JSON.parse(subscriptionJson);
              allSubscriptions.set(userId, subscription);
            } catch (error) {
              console.error(`구독 정보 파싱 실패 (${userId}):`, error);
            }
          }
        });
      }
    } catch (error) {
      console.error('시트에서 구독 정보 로드 실패:', error);
    }
    
    for (const [userId, subscription] of allSubscriptions.entries()) {
      try {
        await webpush.sendNotification(subscription, payload);
        results.push({ userId, success: true });
        console.log(`푸시 알림 전송 완료: ${userId}`);
      } catch (error) {
        console.error(`푸시 알림 전송 실패 (${userId}):`, error);
        results.push({ userId, success: false, error: error.message });
        
        // 구독이 만료된 경우 삭제
        if (error.statusCode === 410) {
          expiredSubscriptions.push(userId);
        }
      }
    }
    
    // 만료된 구독 삭제
    expiredSubscriptions.forEach(userId => {
      pushSubscriptions.delete(userId);
      savePushSubscriptionToSheet(userId, null);
      console.log(`만료된 구독 삭제: ${userId}`);
    });
    
    res.json({ 
      success: true, 
      results,
      expiredCount: expiredSubscriptions.length,
      totalSent: allSubscriptions.size
    });
  } catch (error) {
    console.error('푸시 알림 전송 오류:', error);
    res.status(500).json({ success: false, error: '푸시 알림 전송 실패' });
  }
});

// 개통일시분 정규화 함수
function normalizeActivationDateTime(manualDate, manualTime, systemDate, systemHour, systemMinute) {
  try {
    // 수기초 데이터 정규화
    let manualDateTime = '';
    if (manualDate && manualTime) {
      const date = manualDate.trim();
      const time = manualTime.toString().trim();
      
      if (date && time && time.length >= 4) {
        const hour = time.substring(0, 2);
        const minute = time.substring(2, 4);
        
        // 수기초 분값을 5분 단위로 내림차순 처리
        const minuteNum = parseInt(minute, 10);
        const normalizedMinute = Math.floor(minuteNum / 5) * 5;
        const normalizedMinuteStr = normalizedMinute.toString().padStart(2, '0');
        
        manualDateTime = `${date} ${hour}:${normalizedMinuteStr}`;
      }
    }
    
    // 폰클개통데이터 정규화
    let systemDateTime = '';
    if (systemDate && systemHour && systemMinute) {
      const date = systemDate.trim();
      const hour = systemHour.toString().replace('시', '').trim();
      const minute = systemMinute.toString().replace('분', '').trim();
      
      if (date && hour && minute) {
        // 폰클개통데이터 시값과 분값을 2자리 형식으로 정규화
        const hourNum = parseInt(hour, 10);
        const minuteNum = parseInt(minute, 10);
        const normalizedHourStr = hourNum.toString().padStart(2, '0');
        const normalizedMinuteStr = minuteNum.toString().padStart(2, '0');
        
        systemDateTime = `${date} ${normalizedHourStr}:${normalizedMinuteStr}`;
      }
    }
    
    return { manualDateTime, systemDateTime };
  } catch (error) {
    console.error('개통일시분 정규화 오류:', error);
    return { manualDateTime: '', systemDateTime: '' };
  }
}

// 컬럼 설정 관리 API
app.get('/api/inspection/columns', async (req, res) => {
  try {
    // 현재 컬럼 설정 반환
    const columnSettings = {
      manualKeyColumn: 'U', // 수기초 가입번호 컬럼
      manualKeyColumnName: '가입번호',
      systemKeyColumn: 'BW', // 폰클개통데이터 가입번호 컬럼
      systemKeyColumnName: '가입번호',
      systemAgentColumn: 'BR', // 폰클개통데이터 등록직원 컬럼
      systemAgentColumnName: '등록직원',
      systemMemo2Column: 'BP', // 폰클개통데이터 메모2 컬럼
      systemMemo2ColumnName: '메모2',
      // 동적 매칭 설정
      dynamicMappings: [
        {
          key: 'store_code',
          manualColumn: 'O',
          manualColumnName: '대리점코드',
          systemColumn: 'BX',
          systemColumnName: '메모2',
          description: '대리점코드 비교 (메모2에서 숫자 추출)',
          regex: '\\d+',
          enabled: true
        },
        {
          key: 'activation_datetime',
          manualColumns: ['AD', 'AE'],
          manualColumnNames: ['가입일자', '개통시간'],
          systemColumns: ['J', 'K', 'L'],
          systemColumnNames: ['개통일', '개통시', '개통분'],
          description: '개통일시분 비교 (초 제외, 24시간 형식)',
          enabled: true
        },
        {
          key: 'model_serial',
          manualColumns: ['AM', 'AN'],
          manualColumnNames: ['개통모델', '판매모델일련번호'],
          systemColumns: ['V', 'X'],
          systemColumnNames: ['모델명', '일련번호'],
          description: '모델명과 일련번호 비교 (모델명 정규화, 일련번호 6자리 비교)',
          enabled: true
        }
      ]
    };
    
    res.json({
      success: true,
      settings: columnSettings
    });
  } catch (error) {
    console.error('Error fetching column settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch column settings', 
      message: error.message 
    });
  }
});

// 컬럼 설정 업데이트 API
app.post('/api/inspection/columns', async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings) {
      return res.status(400).json({ 
        success: false, 
        error: 'Settings are required' 
      });
    }

    // 설정을 검수설정 시트에 저장
    const settingsData = [
      [
        new Date().toISOString(), // 설정일시
        JSON.stringify(settings), // 설정 JSON
        '컬럼설정업데이트'        // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_SETTINGS_SHEET_NAME}!A:C`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: settingsData
      }
    });

    // 캐시 무효화
    cacheUtils.deletePattern('inspection_data_*');

    res.json({ 
      success: true, 
      message: '컬럼 설정이 업데이트되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating column settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update column settings', 
      message: error.message 
    });
  }
});

// 수정완료 상태를 시트에서 관리 (서버 재시작시에도 유지)
let modificationCompletionStatus = new Map(); // uniqueKey -> {userId, isCompleted, timestamp}
let modificationNotes = new Map(); // uniqueKey -> {userId, notes, timestamp}

// 고유키 생성 함수
function generateUniqueKey(subscriptionNumber, incorrectValue, correctValue) {
  // 가입번호 + 수기초값 + 폰클데이터값 조합으로 고유키 생성
  const sanitizedIncorrect = (incorrectValue || '').toString().replace(/[^a-zA-Z0-9가-힣]/g, '');
  const sanitizedCorrect = (correctValue || '').toString().replace(/[^a-zA-Z0-9가-힣]/g, '');
  return `${subscriptionNumber}_${sanitizedIncorrect}_${sanitizedCorrect}`;
}

// 서버 시작 시 시트에서 데이터 로드
async function initializeInspectionMemoData() {
  try {
    console.log('여직원검수데이터메모 시트에서 데이터 로드 중...');
    const { completionStatus, notes } = await loadInspectionMemoData();
    
    // 기존 데이터가 있는 경우 마이그레이션 수행
    if (completionStatus.size > 0 || notes.size > 0) {
      console.log('기존 데이터 마이그레이션 수행 중...');
      await migrateExistingData(completionStatus, notes);
    }
    
    modificationCompletionStatus = completionStatus;
    modificationNotes = notes;
    console.log(`여직원검수데이터메모 로드 완료: 완료상태 ${completionStatus.size}개, 메모 ${notes.size}개`);
  } catch (error) {
    console.error('여직원검수데이터메모 초기화 실패:', error);
    modificationCompletionStatus = new Map();
    modificationNotes = new Map();
  }
}

// 기존 데이터 마이그레이션 함수
async function migrateExistingData(completionStatus, notes) {
  try {
    const memoData = await getSheetValues(INSPECTION_MEMO_SHEET_NAME);
    if (!memoData || memoData.length <= 1) {
      return;
    }
    
    // 기존 구조인지 확인 (6개 컬럼이면 기존 구조)
    const firstDataRow = memoData[1];
    if (firstDataRow && firstDataRow.length === 6) {
      console.log('기존 데이터 구조 감지, 마이그레이션 수행...');
      
      const newRows = [['고유키', '가입번호', '사용자ID', '완료상태', '메모내용', '업데이트시간', '필드구분']];
      
      for (let i = 1; i < memoData.length; i++) {
        const row = memoData[i];
        if (row && row.length >= 6) {
          const subscriptionNumber = (row[0] || '').toString().trim();
          const userId = (row[1] || '').toString().trim();
          const isCompleted = (row[2] || '').toString().trim();
          const memoContent = (row[3] || '').toString().trim();
          const updateTime = (row[4] || '').toString().trim();
          const fieldType = (row[5] || '').toString().trim();
          
          if (subscriptionNumber && userId) {
            // 고유키 생성 (기존 데이터는 가입번호만으로 고유키 생성)
            const uniqueKey = `${subscriptionNumber}_${Date.now()}_${i}`;
            
            newRows.push([
              uniqueKey,
              subscriptionNumber,
              userId,
              isCompleted,
              memoContent,
              updateTime,
              fieldType
            ]);
          }
        }
      }
      
      // 새로운 구조로 시트 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: newRows
        }
      });
      
      console.log('기존 데이터 마이그레이션 완료');
    }
  } catch (error) {
    console.error('기존 데이터 마이그레이션 실패:', error);
  }
}

// 서버 시작 시 초기화 실행 (비동기로 처리하여 다른 초기화를 방해하지 않도록)
initializeInspectionMemoData().catch(error => {
  console.error('여직원검수데이터메모 초기화 실패 (무시됨):', error);
});

// 수정완료 상태 조회 API
app.get('/api/inspection/modification-completion-status', async (req, res) => {
  try {
    const { userId, view = 'personal' } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // 메모리에서 수정완료 항목들 조회
    const completedItems = [];
    const notesData = {};
    
    // 완료 상태 조회 (개인현황에서는 해당 사용자의 완료 항목만)
    for (const [uniqueKey, status] of modificationCompletionStatus) {
      if (status.isCompleted) {
        if (view === 'personal') {
          // 개인현황: 해당 사용자의 항목만
          if (status.userId === userId) {
            completedItems.push(uniqueKey);
          }
        } else {
          // 전체현황: 모든 사용자의 항목
          completedItems.push(uniqueKey);
        }
      }
    }
    
    // 메모 내용 조회 (개인현황에서는 해당 사용자의 메모만)
    for (const [uniqueKey, notes] of modificationNotes) {
        if (view === 'personal') {
        // 개인현황: 해당 사용자의 메모만
          if (notes.userId === userId) {
          notesData[uniqueKey] = notes.notes;
          }
        } else {
        // 전체현황: 모든 사용자의 메모
        notesData[uniqueKey] = notes.notes;
      }
    }

    res.json({ 
      completedItems,
      notes: notesData,
      total: completedItems.length
    });
  } catch (error) {
    console.error('Error fetching modification completion status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch modification completion status', 
      message: error.message 
    });
  }
});

// 수정완료 상태 업데이트 API
app.post('/api/inspection/modification-complete', async (req, res) => {
  try {
    const { itemId, userId, isCompleted, subscriptionNumber, incorrectValue, correctValue } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 고유키 생성
    const uniqueKey = generateUniqueKey(subscriptionNumber, incorrectValue, correctValue);

    // 메모리에 상태 저장
    if (isCompleted) {
      // 완료 체크 시
      modificationCompletionStatus.set(uniqueKey, {
        userId,
        isCompleted: true,
        timestamp: new Date().toISOString()
      });
    } else {
      // 완료체크 해제 시 "대기" 상태로 변경
      modificationCompletionStatus.set(uniqueKey, {
        userId,
        isCompleted: false,  // false = 대기 상태
        timestamp: new Date().toISOString()
      });
      // 메모는 유지 (사용자가 다시 체크할 수 있도록)
    }

    // 시트에 저장
    await saveInspectionMemoData(modificationCompletionStatus, modificationNotes);

    console.log(`수정완료 상태 업데이트: ${uniqueKey} - ${userId} - ${isCompleted ? '완료' : '대기'}`);

    res.json({ 
      success: true, 
      message: '수정완료 상태가 업데이트되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating modification completion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update modification completion', 
      message: error.message 
    });
  }
});

// 수정완료 내용 업데이트 API
app.post('/api/inspection/modification-notes', async (req, res) => {
  try {
    const { itemId, userId, notes, subscriptionNumber, incorrectValue, correctValue } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 고유키 생성
    const uniqueKey = generateUniqueKey(subscriptionNumber, incorrectValue, correctValue);

    // 메모리에 내용 저장
    if (notes && notes.trim()) {
      // 메모가 있는 경우
      modificationNotes.set(uniqueKey, {
        userId,
        notes: notes.trim(),
        timestamp: new Date().toISOString()
      });
      
      // 완료 상태 설정
      modificationCompletionStatus.set(uniqueKey, {
        userId,
        isCompleted: true,
        timestamp: new Date().toISOString()
      });
    } else {
      // 메모가 없는 경우 (공백으로 변경)
      modificationNotes.set(uniqueKey, {
        userId,
        notes: '',  // 빈 문자열로 설정
        timestamp: new Date().toISOString()
      });
      
      // 완료 상태는 유지
      modificationCompletionStatus.set(uniqueKey, {
        userId,
        isCompleted: true,
        timestamp: new Date().toISOString()
      });
    }

    // 시트에 저장
    await saveInspectionMemoData(modificationCompletionStatus, modificationNotes);

    console.log(`수정완료 내용 업데이트: ${uniqueKey} - ${userId} - ${notes}`);

    res.json({ 
      success: true, 
      message: '수정완료 내용이 업데이트되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating modification notes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update modification notes', 
      message: error.message 
    });
  }
});

// 검수모드 데이터 가져오기 (보안 강화된 캐싱 적용)
app.get('/api/inspection-data', async (req, res) => {
  const { view = 'personal', userId, field } = req.query;
  const cacheKey = `inspection_data_${view}_${userId}_${field || 'all'}`;
  
  // 폰클개통데이터 캐시 무효화 (BZ열 데이터 포함하도록)
  invalidatePhoneklActivationCache();
  
  // 캐시에서 먼저 확인 (보안 TTL 적용)
  const cachedData = cacheUtils.get(cacheKey);
  if (cachedData) {
    console.log('캐시된 검수 데이터 반환 (보안 TTL 적용)');
    return res.json(cachedData);
  }
  
  try {
    console.log('검수 데이터 처리 시작... (개인정보 보안 처리 포함)');
    const startTime = Date.now();
    
    // 수기초, 폰클개통데이터, 폰클출고처데이터, 무선요금제군 병렬 로드 (캐시 활용)
    const [manualValues, systemValues, storeValues, planValues] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
      getSheetValues(STORE_SHEET_NAME),
      getSheetValues(PLAN_SHEET_NAME)
    ]);
    
    if (!manualValues || !systemValues) {
      throw new Error('Failed to fetch data from sheets');
    }

    // 헤더 제거 (수기초: 1행 헤더, 폰클개통데이터: 3행 헤더)
    const manualRows = manualValues.slice(1);
    const systemRows = systemValues.slice(3);

    // 수기초 데이터를 동일한 열 구조로 맞춰주는 함수
    function normalizeManualRows(manualRows) {
      const REQUIRED_COLUMNS = 150; // DX열(127) + 여유분을 위해 150개로 설정
      
      return manualRows.map(row => {
        if (row.length < REQUIRED_COLUMNS) {
          // 부족한 열만큼 빈 문자열로 채우기
          const normalizedRow = [...row];
          while (normalizedRow.length < REQUIRED_COLUMNS) {
            normalizedRow.push('');
          }
          return normalizedRow;
        }
        return row;
      });
    }

    // 수기초 데이터 정규화 적용
    const normalizedManualRows = normalizeManualRows(manualRows);

    // 수기초 데이터의 최대 일시 계산 (메모리 최적화)
    function getMaxManualDateTime(normalizedManualRows) {
      let maxDateTime = null;
      let processedCount = 0;
      const BATCH_SIZE = 1000;
      
      for (let i = 0; i < normalizedManualRows.length; i++) {
        const row = normalizedManualRows[i];
        
        if (row.length > 30) { // AD열(29) + AE열(30) 최소 필요
          const date = (row[29] || '').toString().trim(); // AD열: 가입일자
          const time = (row[30] || '').toString().trim(); // AE열: 개통시간
          
          if (date && time && time.length >= 4) {
            const hour = time.substring(0, 2);
            const minute = time.substring(2, 4);
            
            // 5분 단위로 내림차순 처리 (기존 정규화 로직과 동일)
            const minuteNum = parseInt(minute, 10);
            const normalizedMinute = Math.floor(minuteNum / 5) * 5;
            const normalizedMinuteStr = normalizedMinute.toString().padStart(2, '0');
            
            const dateTimeStr = `${date} ${hour}:${normalizedMinuteStr}`;
            const dateTime = new Date(dateTimeStr);
            
            if (!isNaN(dateTime.getTime()) && (!maxDateTime || dateTime > maxDateTime)) {
              maxDateTime = dateTime;
            }
          }
        }
        
        processedCount++;
        
        // 배치 단위로 메모리 정리
        if (processedCount % BATCH_SIZE === 0) {
          if (global.gc) {
            global.gc();
          }
          console.log(`🧠 [일시필터링] 최대일시 계산 진행률: ${processedCount}/${normalizedManualRows.length} (${Math.round(processedCount/normalizedManualRows.length*100)}%)`);
        }
      }
      
      return maxDateTime;
    }

    // 폰클 데이터를 수기초 최대 일시로 필터링 (메모리 최적화)
    function filterSystemRowsByDateTime(systemRows, maxManualDateTime) {
      if (!maxManualDateTime) {
        return systemRows; // 최대 일시가 없으면 모든 데이터 반환
      }
      
      const filteredRows = [];
      let processedCount = 0;
      const BATCH_SIZE = 1000;
      
      for (let i = 0; i < systemRows.length; i++) {
        const row = systemRows[i];
        let shouldInclude = true;
        
        if (row.length > 11) { // J열(9) + K열(10) + L열(11) 최소 필요
          const date = (row[9] || '').toString().trim(); // J열: 개통일
          const hour = (row[10] || '').toString().replace('시', '').trim(); // K열: 개통시
          const minute = (row[11] || '').toString().replace('분', '').trim(); // L열: 개통분
          
          if (date && hour && minute) {
            const hourNum = parseInt(hour, 10);
            const minuteNum = parseInt(minute, 10);
            const normalizedHourStr = hourNum.toString().padStart(2, '0');
            const normalizedMinuteStr = minuteNum.toString().padStart(2, '0');
            
            const dateTimeStr = `${date} ${normalizedHourStr}:${normalizedMinuteStr}`;
            const dateTime = new Date(dateTimeStr);
            
            // 수기초 최대 일시 이전 또는 같은 데이터만 포함
            shouldInclude = !isNaN(dateTime.getTime()) && dateTime <= maxManualDateTime;
          }
        }
        
        if (shouldInclude) {
          filteredRows.push(row);
        }
        
        processedCount++;
        
        // 배치 단위로 메모리 정리
        if (processedCount % BATCH_SIZE === 0) {
          if (global.gc) {
            global.gc();
          }
          console.log(`🧠 [일시필터링] 폰클필터링 진행률: ${processedCount}/${systemRows.length} (${Math.round(processedCount/systemRows.length*100)}%)`);
        }
      }
      
      return filteredRows;
    }

    // 메모리 사용량 모니터링
    const startMemory = process.memoryUsage();
    console.log(`🧠 [메모리] 일시필터링 시작: ${Math.round(startMemory.heapUsed / 1024 / 1024)}MB`);
    
    // 수기초 최대 일시 계산
    const maxManualDateTime = getMaxManualDateTime(normalizedManualRows);
    console.log(`📅 [일시필터링] 수기초 최대 일시: ${maxManualDateTime ? maxManualDateTime.toISOString() : '없음'}`);
    
    // 폰클 데이터 필터링
    const originalSystemRowsCount = systemRows.length;
    const filteredSystemRows = filterSystemRowsByDateTime(systemRows, maxManualDateTime);
    const filteredSystemRowsCount = filteredSystemRows.length;
    const excludedCount = originalSystemRowsCount - filteredSystemRowsCount;
    
    console.log(`📅 [일시필터링] 폰클 데이터 필터링 결과: 전체 ${originalSystemRowsCount}개 → 필터링 후 ${filteredSystemRowsCount}개 (제외: ${excludedCount}개)`);
    
    // 메모리 사용량 모니터링
    const endMemory = process.memoryUsage();
    console.log(`🧠 [메모리] 일시필터링 완료: ${Math.round(endMemory.heapUsed / 1024 / 1024)}MB (증가: ${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)}MB)`);
    
    // 강제 가비지 컬렉션
    if (global.gc) {
      global.gc();
      const afterGCMemory = process.memoryUsage();
      console.log(`🧠 [메모리] GC 후: ${Math.round(afterGCMemory.heapUsed / 1024 / 1024)}MB`);
    }
    
    // 필터링된 데이터로 계속 진행
    const filteredSystemRowsForComparison = filteredSystemRows;

    // 데이터 비교 및 차이점 찾기
    const differences = [];
    const manualMap = new Map();
    const systemMap = new Map();

    // 수기초 데이터 인덱싱 (U열: 가입번호 기준)
    normalizedManualRows.forEach((row, index) => {
      if (row.length > 20 && row[20]) {
        const key = row[20].toString().trim();
        manualMap.set(key, { row, index: index + 2 }); // +2는 헤더와 1-based 인덱스 때문
      }
    });

    // 중복 분석 함수들
    function analyzeDuplicateDifferences(duplicateRows) {
      if (duplicateRows.length <= 1) return '';
      
      const differences = [];
      const baseRow = duplicateRows[0];
      
      for (let i = 1; i < duplicateRows.length; i++) {
        const currentRow = duplicateRows[i];
        const rowDifferences = [];
        
        // 모델명 비교 (V열: 21번째 컬럼)
        if (baseRow[21] !== currentRow[21]) {
          rowDifferences.push(`모델명: ${baseRow[21] || '없음'} vs ${currentRow[21] || '없음'}`);
        }
        
        // 개통유형 비교 (T열: 19번째 컬럼)
        if (baseRow[19] !== currentRow[19]) {
          rowDifferences.push(`개통유형: ${baseRow[19] || '없음'} vs ${currentRow[19] || '없음'}`);
        }
        
        // 입고처 비교 (M열: 12번째 컬럼)
        if (baseRow[12] !== currentRow[12]) {
          rowDifferences.push(`입고처: ${baseRow[12] || '없음'} vs ${currentRow[12] || '없음'}`);
        }
        
        if (rowDifferences.length > 0) {
          differences.push(`중복${i}: ${rowDifferences.join(', ')}`);
        } else {
          differences.push(`중복${i}: 완전동일`);
        }
      }
      
      return differences.join(' | ');
    }
    
    // 각 행별로 개별적인 중복 정보를 생성하는 함수
    function generateIndividualDuplicateInfo(duplicateRows, currentRowIndex, duplicateType) {
      if (duplicateRows.length <= 1) return '';
      
      const currentRow = duplicateRows[currentRowIndex];
      const differences = [];
      
      for (let i = 0; i < duplicateRows.length; i++) {
        if (i === currentRowIndex) continue; // 자기 자신은 제외
        
        const otherRow = duplicateRows[i];
        const rowDifferences = [];
        
        // 입고처 비교 (M열: 12번째 컬럼)
        if (currentRow[12] !== otherRow[12]) {
          rowDifferences.push(`${currentRow[12] || '없음'}`);
        }
        
        // 모델명 비교 (V열: 21번째 컬럼)
        if (currentRow[21] !== otherRow[21]) {
          rowDifferences.push(`${currentRow[21] || '모델명없음'}`);
        }
        
        // 개통유형 비교 (T열: 19번째 컬럼)
        if (currentRow[19] !== otherRow[19]) {
          rowDifferences.push(`${currentRow[19] || '개통유형없음'}`);
        }
        
        if (rowDifferences.length > 0) {
          differences.push(`${rowDifferences.join(' ')}`);
        } else {
          differences.push(`완전동일`);
        }
      }
      
      return differences.join(' | ');
    }
    
    function getDuplicateType(manualDuplicates, systemDuplicates) {
      // 수기초 1개 + 폰클 1개 = 정상 (중복 아님)
      if (!manualDuplicates && !systemDuplicates) return 'no_duplicate';
      
      // 수기초 2개 이상 + 폰클 1개 = 수기초 중복
      if (manualDuplicates && !systemDuplicates) return 'manual_duplicate';
      
      // 수기초 1개 + 폰클 2개 이상 = 폰클 중복
      if (!manualDuplicates && systemDuplicates) return 'system_duplicate';
      
      // 수기초 2개 이상 + 폰클 2개 이상 = 양쪽 중복
      if (manualDuplicates && systemDuplicates) return 'both_duplicate';
      
      return 'no_duplicate';
    }
    
    // 단순하고 심플한 행값 기반 처리 로직
    const allRows = [];
    
    // 모든 수기초 데이터 추가
    normalizedManualRows.forEach((row, index) => {
      if (row.length > 20 && row[20]) {
        const key = row[20].toString().trim();
        allRows.push({
          key,
          row,
          index: index + 2,
          source: 'manual'
        });
      }
    });
    
    // 모든 폰클 데이터 추가 (필터링된 데이터 사용)
    filteredSystemRowsForComparison.forEach((row, index) => {
      if (row.length > 74 && row[74]) { // BW열은 75번째 컬럼 (0-based)
        const key = row[74].toString().trim();
        allRows.push({
          key,
          row,
          index: index + 4,
          source: 'system'
        });
      }
    });
    
    // 가입번호별로 그룹화하여 중복 감지
    const groupsByKey = new Map();
    allRows.forEach(item => {
      if (!groupsByKey.has(item.key)) {
        groupsByKey.set(item.key, []);
      }
      groupsByKey.get(item.key).push(item);
    });
    
    // 각 가입번호 그룹별로 처리
    for (const [key, group] of groupsByKey) {
      const manualItems = group.filter(item => item.source === 'manual');
      const systemItems = group.filter(item => item.source === 'system');
      
      const isManualDuplicate = manualItems.length > 1;
      const isSystemDuplicate = systemItems.length > 1;
      
      // 수기초 데이터가 있는 경우
      if (manualItems.length > 0) {
        for (const manualItem of manualItems) {
          // 폰클 데이터가 있는 경우 - 각 폰클 데이터와 비교
          if (systemItems.length > 0) {
            for (const systemItem of systemItems) {
              // 중복 타입 결정
              const duplicateType = getDuplicateType(isManualDuplicate, isSystemDuplicate);
              
              // 중복 정보 생성
              let duplicateInfo = '';
              if (isSystemDuplicate) {
                const systemIndex = systemItems.findIndex(item => item.index === systemItem.index);
                duplicateInfo = generateIndividualDuplicateInfo(
                  systemItems.map(item => item.row), 
                  systemIndex, 
                  'system_duplicate'
                );
              } else if (isManualDuplicate) {
                const manualIndex = manualItems.findIndex(item => item.index === manualItem.index);
                duplicateInfo = generateIndividualDuplicateInfo(
                  manualItems.map(item => item.row), 
                  manualIndex, 
                  'manual_duplicate'
                );
              }
              
              // 두 데이터 비교
              const rowDifferences = compareDynamicColumns(manualItem.row, systemItem.row, key, field, storeValues, planValues);
              
              rowDifferences.forEach(diff => {
                differences.push({
                  ...diff,
                  manualRow: manualItem.index,
                  systemRow: systemItem.index,
                  assignedAgent: systemItem.row[77] || '', // BZ열: 등록직원
                  isDuplicate: isManualDuplicate || isSystemDuplicate,
                  duplicateType: duplicateType,
                  duplicateInfo: duplicateInfo
                });
              });
            }
          } else {
            // 수기초에만 있는 데이터
            if (!field) {
              const duplicateType = isManualDuplicate ? 'manual_duplicate' : 'no_duplicate';
              let duplicateInfo = '';
              
              if (isManualDuplicate) {
                const manualIndex = manualItems.findIndex(item => item.index === manualItem.index);
                duplicateInfo = generateIndividualDuplicateInfo(
                  manualItems.map(item => item.row), 
                  manualIndex, 
                  'manual_duplicate'
                );
              }
              
              differences.push({
                key,
                type: 'manual_only',
                field: '전체',
                fieldKey: 'all',
                correctValue: '수기초에만 존재',
                incorrectValue: '없음',
                manualRow: manualItem.index,
                systemRow: null,
                assignedAgent: '',
                isDuplicate: isManualDuplicate,
                duplicateType: duplicateType,
                duplicateInfo: duplicateInfo
              });
            }
          }
        }
      } else {
        // 폰클에만 있는 데이터
        if (!field) {
          systemItems.forEach(systemItem => {
            const duplicateType = isSystemDuplicate ? 'system_duplicate' : 'no_duplicate';
            let duplicateInfo = '';
            
            if (isSystemDuplicate) {
              const systemIndex = systemItems.findIndex(item => item.index === systemItem.index);
              duplicateInfo = generateIndividualDuplicateInfo(
                systemItems.map(item => item.row), 
                systemIndex, 
                'system_duplicate'
              );
            }
            
            differences.push({
              key,
              type: 'system_only',
              field: '전체',
              fieldKey: 'all',
              correctValue: '없음',
              incorrectValue: '수기초에 없음',
              manualRow: null,
              systemRow: systemItem.index,
                                assignedAgent: systemItem.row[77] || '', // BZ열: 등록직원
              isDuplicate: isSystemDuplicate,
              duplicateType: duplicateType,
              duplicateInfo: duplicateInfo
            });
          });
        }
      }
    }

    // 처리자 이름에서 괄호와 접두사 제거하는 함수
    function cleanAgentName(agentName) {
      if (!agentName) return '';
      let cleaned = agentName.toString();
      
      // VIP│, MIN│ 접두사 제거 (예: "VIP│최은진" → "최은진")
      cleaned = cleaned.replace(/^(VIP│|MIN│)/, '');
      
      // 괄호와 괄호 안의 내용 제거 (예: "홍길동 (RM)" → "홍길동")
      cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
      
      // 앞뒤 공백 제거
      cleaned = cleaned.trim();
      
      // 빈 문자열이면 원본 반환
      if (!cleaned) return agentName.toString().trim();
      
      return cleaned;
    }

    // 뷰에 따른 필터링
    let filteredDifferences = differences;
    if (view === 'personal' && userId) {
      console.log(`개인담당 필터링: userId=${userId}, 전체 차이점=${differences.length}개`);
      console.log('등록직원 목록:', [...new Set(differences.map(d => d.assignedAgent))]);
      console.log('정리된 등록직원 목록:', [...new Set(differences.map(d => cleanAgentName(d.assignedAgent)))]);
      
      // 사용자 ID가 전화번호인지 확인하고, 전화번호인 경우 대리점 관리자 시트에서 이름을 찾기
      let userName = userId;
      
      // 전화번호 패턴 확인 (010으로 시작하는 11자리)
      if (/^010\d{8}$/.test(userId)) {
        console.log(`전화번호 감지: ${userId}, 대리점 관리자 시트에서 이름 검색 중...`);
        
        try {
          const agentValues = await getSheetValues(AGENT_SHEET_NAME);
          if (agentValues) {
            const agentRows = agentValues.slice(1);
            const agent = agentRows.find(row => row[2] === userId); // C열: 연락처(아이디)
            
            if (agent) {
              userName = agent[0]; // A열: 대상 (이름)
              console.log(`대리점 관리자 시트에서 이름 찾음: "${userName}" (전화번호: ${userId})`);
            } else {
              console.log(`대리점 관리자 시트에서 전화번호 ${userId}에 해당하는 이름을 찾을 수 없음`);
            }
          }
        } catch (error) {
          console.error('대리점 관리자 시트 조회 중 오류:', error);
        }
      }
      
      // 사용자 이름과 정리된 등록직원 이름을 비교
      const cleanUserName = cleanAgentName(userName);
      console.log(`정리된 사용자 이름: "${cleanUserName}" (원본: "${userName}")`);
      
      // 매칭 시도 로그
      let matchCount = 0;
      filteredDifferences = differences.filter(diff => {
        const cleanAgent = cleanAgentName(diff.assignedAgent);
        const isMatch = cleanAgent === cleanUserName;
        if (isMatch) {
          matchCount++;
        }
        return isMatch;
      });
    }

    // 개인정보 보안 처리: 마스킹 및 해시화
    const secureDifferences = securityUtils.createSafeDataStructure(filteredDifferences);

    // 현재 검수 대상 가입번호 목록 생성 (자동 정리용)
    const currentInspectionKeys = new Set();
    secureDifferences.forEach(diff => {
      if (diff.key) {
        currentInspectionKeys.add(diff.key);
      }
    });

    // 여직원검수데이터메모 시트 자동 정리 (백그라운드에서 실행)
    cleanupInspectionMemoData(currentInspectionKeys).catch(error => {
      console.error('여직원검수데이터메모 시트 정리 실패:', error);
    });

    const result = {
      differences: secureDifferences,
      total: secureDifferences.length,
      manualOnly: secureDifferences.filter(d => d.type === 'manual_only').length,
      systemOnly: secureDifferences.filter(d => d.type === 'system_only').length,
      mismatched: secureDifferences.filter(d => d.type === 'mismatch').length,
      securityNote: '검수자는 실제 값을 확인할 수 있습니다. ID는 해시화되어 보안이 유지됩니다.'
    };

    const processingTime = Date.now() - startTime;
    console.log(`검수 데이터 처리 완료: ${result.total}개 차이점, ${processingTime}ms 소요 (보안 처리 포함)`);
    
    // 보안 강화된 캐시에 저장 (2분 TTL)
    cacheUtils.set(cacheKey, result, SECURE_CACHE_TTL);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching inspection data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inspection data', 
      message: error.message 
    });
  }
});

// 해시화된 ID를 원본 키로 변환하는 함수
function findOriginalKeyFromHash(hashId, differences) {
  for (const diff of differences) {
    if (securityUtils.hashPersonalInfo(diff.key) === hashId) {
      return diff.key;
    }
  }
  return null;
}

// 선택적 캐시 무효화 함수
function invalidateInspectionCache(userId, field = null) {
  const cacheKeysToDelete = [
    `inspection_data_personal_${userId}`,
    `inspection_data_overview_${userId}`,
    `inspection_data_personal_${userId}_all`,
    `inspection_data_overview_${userId}_all`
  ];
  
  // 특정 필드가 지정된 경우 해당 필드 캐시도 삭제
  if (field && field !== 'all') {
    cacheKeysToDelete.push(`inspection_data_personal_${userId}_${field}`);
    cacheKeysToDelete.push(`inspection_data_overview_${userId}_${field}`);
  }
  
  cacheKeysToDelete.forEach(key => {
    if (cacheUtils.get(key)) {
      cacheUtils.delete(key);
      console.log(`캐시 무효화: ${key}`);
    }
  });
}

// 검수 완료 상태 업데이트 (해시화된 ID 처리)
app.post('/api/inspection/complete', async (req, res) => {
  try {
    const { itemId, userId, status } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 해시화된 ID를 원본 키로 변환
    let originalKey = itemId;
    // 캐시에서 원본 데이터 찾기
    const cacheKeys = Array.from(cache.keys()).filter(key => key.includes('inspection_data'));
    for (const cacheKey of cacheKeys) {
      const cachedData = cacheUtils.get(cacheKey);
      if (cachedData && cachedData.differences) {
        const foundKey = findOriginalKeyFromHash(itemId, cachedData.differences);
        if (foundKey) {
          originalKey = foundKey;
          break;
        }
      }
    }

    // 검수결과 시트에 완료 상태 기록
    const completionData = [
      [
        new Date().toISOString(), // 완료일시
        userId,                   // 처리자
        originalKey,              // 원본 항목 ID
        status || '완료',         // 상태
        '처리완료'                // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_RESULT_SHEET_NAME}!A:E`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: completionData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '검수 완료 상태가 업데이트되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating inspection completion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update inspection completion', 
      message: error.message 
    });
  }
});

// 정규화 데이터 저장
app.post('/api/inspection/normalize', async (req, res) => {
  try {
    const { itemId, userId, originalValue, normalizedValue, field } = req.body;
    
    if (!itemId || !userId || !normalizedValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID, User ID, and normalized value are required' 
      });
    }

    // 정규화이력 시트에 기록
    const normalizationData = [
      [
        new Date().toISOString(), // 정규화일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        field,                    // 필드명
        originalValue || '',      // 원본값
        normalizedValue,          // 정규화값
        '수동정규화'              // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NORMALIZATION_HISTORY_SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: normalizationData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '정규화 데이터가 저장되었습니다.' 
    });
  } catch (error) {
    console.error('Error saving normalization data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save normalization data', 
      message: error.message 
    });
  }
});

// 폰클개통데이터 수정 API
app.post('/api/inspection/update-system-data', async (req, res) => {
  try {
    const { itemId, userId, field, correctValue, systemRow } = req.body;
    
    if (!itemId || !userId || !field || !correctValue || systemRow === null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID, User ID, field, correct value, and system row are required' 
      });
    }

    // 필드명에 따른 컬럼 인덱스 매핑
    const fieldToColumnMap = {
      '이름': 1,      // B열
      '전화번호': 2,   // C열
      '주소': 3,      // D열
      '생년월일': 4,  // E열
      '성별': 5,      // F열
      // 더 많은 필드 매핑 추가 가능
    };

    const columnIndex = fieldToColumnMap[field];
    if (columnIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid field name' 
      });
    }

    // 폰클개통데이터 시트에서 해당 행의 특정 컬럼 수정
    const range = `${CURRENT_MONTH_ACTIVATION_SHEET_NAME}!${String.fromCharCode(65 + columnIndex)}${systemRow}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[correctValue]]
      }
    });

    // 수정 이력 시트에 기록
    const updateHistoryData = [
      [
        new Date().toISOString(), // 수정일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        field,                    // 필드명
        correctValue,             // 수정된 값
        '폰클개통데이터 수정'     // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_RESULT_SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: updateHistoryData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '폰클개통데이터가 성공적으로 수정되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating system data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update system data', 
      message: error.message 
    });
  }
});

// 사용 가능한 필드 목록 조회 API
app.get('/api/inspection/available-fields', async (req, res) => {
  try {
    const fields = COLUMN_MATCHING_CONFIG.map(config => ({
      key: config.manualField.key,
      name: config.manualField.name,
      description: config.description
    }));

    res.json({ 
      success: true, 
      fields 
    });
  } catch (error) {
    console.error('Error fetching available fields:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available fields', 
      message: error.message 
    });
  }
});

// 필드별 고유값 조회 API
app.get('/api/inspection/field-values', async (req, res) => {
  try {
    const { field } = req.query;
    
    if (!field) {
      return res.status(400).json({ 
        success: false, 
        error: 'Field name is required' 
      });
    }

    // 필드명에 따른 컬럼 인덱스 매핑
    const fieldMapping = COLUMN_MAPPINGS.find(mapping => mapping.name === field);
    if (!fieldMapping) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid field name' 
      });
    }

    const columnIndex = fieldMapping.manual;

    // 수기초와 폰클개통데이터에서 해당 필드의 모든 값 수집
    const [manualValues, systemValues] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME)
    ]);

    const allValues = new Set();

    // 수기초에서 값 수집
    if (manualValues && manualValues.length > 1) {
      manualValues.slice(1).forEach(row => {
        if (row.length > columnIndex && row[columnIndex]) {
          allValues.add(row[columnIndex].toString().trim());
        }
      });
    }

    // 폰클개통데이터에서 값 수집
    if (systemValues && systemValues.length > 1) {
      systemValues.slice(1).forEach(row => {
        if (row.length > columnIndex && row[columnIndex]) {
          allValues.add(row[columnIndex].toString().trim());
        }
      });
    }

    // 정규화 이력에서도 값 수집
    try {
      const normalizationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NORMALIZATION_HISTORY_SHEET_NAME}!A:G`
      });
      
      if (normalizationResponse.data.values && normalizationResponse.data.values.length > 1) {
        normalizationResponse.data.values.slice(1).forEach(row => {
          if (row.length >= 6 && row[3] === field && row[5]) { // 필드명이 일치하고 정규화값이 있는 경우
            allValues.add(row[5].toString().trim());
          }
        });
      }
    } catch (error) {
      // 정규화 이력 시트가 없거나 비어있는 경우 무시
      console.log('정규화 이력 시트가 없거나 비어있습니다.');
    }

    const uniqueValues = Array.from(allValues).filter(value => value).sort();

    res.json({ 
      success: true, 
      field,
      values: uniqueValues 
    });
  } catch (error) {
    console.error('Error fetching field values:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch field values', 
      message: error.message 
    });
  }
});

// 검수 완료 상태 조회
app.get('/api/inspection/completion-status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // 검수결과 시트에서 해당 사용자의 완료 항목 조회
    let completionData = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_RESULT_SHEET_NAME}!A:E`
      });
      completionData = response.data.values || [];
    } catch (error) {
      // 시트가 없거나 비어있는 경우 빈 배열 반환
      console.log('검수결과 시트가 없거나 비어있습니다.');
    }

    // 헤더 제거하고 해당 사용자의 완료 항목만 필터링
    const userCompletions = completionData
      .slice(1) // 헤더 제거
      .filter(row => row.length >= 3 && row[1] === userId) // 처리자 ID가 일치하는 항목
      .map(row => row[2]); // 항목 ID만 추출

    res.json({ 
      success: true, 
      completedItems: userCompletions 
    });
  } catch (error) {
    console.error('Error fetching completion status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch completion status', 
      message: error.message 
    });
  }
});

// 컬럼 매칭 설정 (수기초 컬럼 ↔ 폰클개통데이터 컬럼)
const COLUMN_MATCHING_CONFIG = [
  {
    manualField: { name: '대리점코드', key: 'store_code', column: 14 }, // O열 (기존 F열에서 +9)
    systemField: { name: '메모2', key: 'memo2', column: 75 }, // BX열 (기존 BP열에서 +8)
    regex: '\\d+', // 숫자 추출 (6자리 제한 제거)
    description: '대리점코드 비교 (메모2에서 숫자 추출)'
  },
  {
    manualField: { name: '개통일시분', key: 'activation_datetime', column: 29 }, // AD열 (기존 U열에서 +9)
    systemField: { name: '개통일시분', key: 'activation_datetime', column: 9 }, // J열 (기존 B열에서 +8)
    description: '개통일시분 비교 (초 제외, 24시간 형식)'
  },
  {
    manualField: { name: '모델명(일련번호)', key: 'model_serial', column: 38 }, // AM열 (기존 AD열에서 +9)
    systemField: { name: '모델명(일련번호)', key: 'model_serial', column: 21 }, // V열 (기존 N열에서 +8)
    description: '모델명과 일련번호 비교 (모델명 정규화, 일련번호 6자리 비교)'
  },
  {
    manualField: { name: '개통유형', key: 'activation_type', column: 19 }, // T열 (기존 K열에서 +9)
    systemField: { name: '개통유형', key: 'activation_type', column: 19 }, // T열 (기존 L열에서 +8)
    description: '개통유형 및 C타겟차감대상 비교 (가입구분+이전사업자+기변타겟구분 정규화)'
  },
  {
    manualField: { name: '실판매POS', key: 'sales_pos', column: 16 }, // Q열 (기존 H열에서 +9)
    systemField: { name: '실판매POS', key: 'sales_pos', column: 5 }, // F열 (새로 추가된 POS코드 컬럼)
    description: '실판매POS 비교 (직접 비교, 전략온라인 제외)'
  },
  {
    manualField: { name: '요금제', key: 'plan', column: 46 }, // AU열 (기존 AL열에서 +9)
    systemField: { name: '요금제', key: 'plan', column: 29 }, // AD열 (기존 V열에서 +8)
    description: '요금제 비교 (VLOOKUP 방식 정규화, AN열 BLANK 제외)'
  },
  {
    manualField: { name: '출고가상이', key: 'shipping_virtual', column: 56 }, // BD열 (기존 AV열에서 +9)
    systemField: { name: '출고가상이', key: 'shipping_virtual', column: 35 }, // AJ열 (기존 AB열에서 +8)
    description: '출고가상이 비교 (더하기 방식 정규화)'
  },
  {
    manualField: { name: '지원금 및 약정상이', key: 'support_contract', column: 94 }, // DQ열 (기존 DH열에서 +9)
    systemField: { name: '지원금 및 약정상이', key: 'support_contract', column: 36 }, // AK열 (기존 AC열에서 +8)
    description: '지원금 및 약정상이 비교 (선택방식 정규화, AN열 BLANK 제외)'
  },
  {
    manualField: { name: '프리할부상이', key: 'pre_installment', column: 56 }, // BE열
    systemField: { name: '프리할부상이', key: 'pre_installment', column: 39 }, // AN열
    description: '프리할부상이 비교 (직접 비교, AN열 BLANK 제외)'
  },
  {
    manualField: { name: '유통망지원금 상이', key: 'distribution_support', column: 75 }, // BX열
    systemField: { name: '유통망지원금 상이', key: 'distribution_support', column: 37 }, // AL열
    description: '유통망지원금 상이 비교 (숫자 서식 정규화)'
  },
  {
    manualField: { name: '유플레이 유치 추가', key: 'uplay_check', column: 127 }, // DX열 (기존 DO열에서 +9)
    systemField: { name: '유플레이 유치 추가', key: 'uplay_check', column: 30 }, // AE열 (기존 W열에서 +8)
    description: '유플레이 유치 추가 (단어 포함 여부 비교)'
  },
  {
    manualField: { name: 'V컬러링 음악감상 플러스 유치', key: 'vcoloring_music_plus', column: 119 }, // DP열
    systemField: { name: 'V컬러링 음악감상 플러스 유치', key: 'vcoloring_music_plus', column: 30 }, // AE열
    description: 'V컬러링 음악감상 플러스 유치 (단어 포함 여부 비교)'
  },
  {
    manualField: { name: '폰교체 패스 유치', key: 'phone_exchange_pass', column: 124 }, // DU열
    systemField: { name: '폰교체 패스 유치', key: 'phone_exchange_pass', column: 30 }, // AE열
    description: '폰교체 패스 유치 (단어 포함 여부 비교)'
  },
  {
    manualField: { name: '폰교체 슬림 유치', key: 'phone_exchange_slim', column: 124 }, // DU열
    systemField: { name: '폰교체 슬림 유치', key: 'phone_exchange_slim', column: 30 }, // AE열
    description: '폰교체 슬림 유치 (단어 포함 여부 비교)'
  },
  {
    manualField: { name: '폰 안심패스 유치', key: 'phone_safe_pass', column: 124 }, // DU열
    systemField: { name: '폰 안심패스 유치', key: 'phone_safe_pass', column: 30 }, // AE열
    description: '폰 안심패스 유치 (단어 포함 여부 비교)'
  },
  {
    manualField: { name: '보험 미유치', key: 'insurance_no', column: 124 }, // DU열
    systemField: { name: '보험 미유치', key: 'insurance_no', column: 31 }, // AF열
    description: '보험 미유치 (폰클: 보험 포함시 미유치, 미포함시 유치)'
  },
  {
    manualField: { name: '통화연결음 유치', key: 'call_ringtone', column: 131 }, // EB열
    systemField: { name: '통화연결음 유치', key: 'call_ringtone', column: 30 }, // AE열
    description: '통화연결음 유치 (단어 포함 여부 비교)'
  },
  {
    manualField: { name: '통화연결음 미유치', key: 'call_ringtone_no', column: 119 }, // DP열 또는 EB열
    systemField: { name: '통화연결음 미유치', key: 'call_ringtone_no', column: 31 }, // AF열
    description: '통화연결음 미유치 (폰클: 통화연결음 포함시 미유치, 미포함시 유치)'
  },
  {
    manualField: { name: '청소년요금제추가정책(1)유치', key: 'youth_plan_policy_1', column: 19 }, // T열, AX열, CV열
    systemField: { name: '청소년요금제추가정책(1)유치', key: 'youth_plan_policy_1', column: 30 }, // AE열
    description: '청소년요금제추가정책(1)유치 (복합 조건 비교)'
  },
  {
    manualField: { name: '청소년요금제추가정책(2)유치', key: 'youth_plan_policy_2', column: 19 }, // T열, AM열, CV열
    systemField: { name: '청소년요금제추가정책(2)유치', key: 'youth_plan_policy_2', column: 30 }, // AE열
    description: '청소년요금제추가정책(2)유치 (복합 조건 비교)'
  },
  {
    manualField: { name: '유통망지원금 활성화정책', key: 'distribution_support_activation', column: 19 }, // T열, AX열, AM열, BX열
    systemField: { name: '유통망지원금 활성화정책', key: 'distribution_support_activation', column: 30 }, // AE열
    description: '유통망지원금 활성화정책 (복합 조건 비교)'
  },
  {
    manualField: { name: '115군 선택약정 차감', key: '115_group_contract_deduction', column: 19 }, // T열, AX열, BQ열, CU열, CV열
    systemField: { name: '115군 선택약정 차감', key: '115_group_contract_deduction', column: 31 }, // AF열
    description: '115군 선택약정 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: '선택약정 S721(010신규) 차감', key: 's721_contract_deduction', column: 19 }, // T열, AX열, AM열, BQ열, CV열
    systemField: { name: '선택약정 S721(010신규) 차감', key: 's721_contract_deduction', column: 31 }, // AF열
    description: '선택약정 S721(010신규) 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: '선택약정 S931,S938,S937(MNP) 차감', key: 's931_s938_s937_contract_deduction', column: 19 }, // T열, AX열, AM열, BQ열, CV열
    systemField: { name: '선택약정 S931,S938,S937(MNP) 차감', key: 's931_s938_s937_contract_deduction', column: 31 }, // AF열
    description: '선택약정 S931,S938,S937(MNP) 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: '선택약정 아이폰16류전체(MNP) 차감', key: 'iphone16_contract_deduction', column: 19 }, // T열, AX열, AM열, BQ열, CV열
    systemField: { name: '선택약정 아이폰16류전체(MNP) 차감', key: 'iphone16_contract_deduction', column: 31 }, // AF열
    description: '선택약정 아이폰16류전체(MNP) 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: 'A166 44군 대상외요금제(MNP) 차감', key: 'a166_44group_excluded_plan_deduction', column: 19 }, // T열, AX열, AM열, BQ열, CV열, AT열
    systemField: { name: 'A166 44군 대상외요금제(MNP) 차감', key: 'a166_44group_excluded_plan_deduction', column: 31 }, // AF열
    description: 'A166 44군 대상외요금제(MNP) 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: 'A166 44군 대상외요금제(기변) 차감', key: 'a166_44group_excluded_plan_change_deduction', column: 19 }, // T열, AM열, BQ열, CV열, AT열
    systemField: { name: 'A166 44군 대상외요금제(기변) 차감', key: 'a166_44group_excluded_plan_change_deduction', column: 31 }, // AF열
    description: 'A166 44군 대상외요금제(기변) 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: '정책기변 차감', key: 'policy_change_deduction', column: 19 }, // T열
    systemField: { name: '정책기변 차감', key: 'policy_change_deduction', column: 31 }, // AF열
    description: '정책기변 차감 (단순 조건 비교)'
  },
  {
    manualField: { name: '기변 C타겟 차감', key: 'change_c_target_deduction', column: 89 }, // CL열
    systemField: { name: '기변 C타겟 차감', key: 'change_c_target_deduction', column: 31 }, // AF열
    description: '기변 C타겟 차감 (단순 조건 비교)'
  },
  {
    manualField: { name: '33군미만, 시니어1군시 차감', key: '33group_senior1_deduction', column: 99 }, // CV열
    systemField: { name: '33군미만, 시니어1군시 차감', key: '33group_senior1_deduction', column: 31 }, // AF열
    description: '33군미만, 시니어1군시 차감 (단순 조건 비교)'
  },
  {
    manualField: { name: '온세일 전략온라인POS 차감', key: 'onsale_strategy_online_pos_deduction', column: 82 }, // CE열
    systemField: { name: '온세일 전략온라인POS 차감', key: 'onsale_strategy_online_pos_deduction', column: 31 }, // AF열
    description: '온세일 전략온라인POS 차감 (복합 조건 비교)'
  },
  {
    manualField: { name: '유플레이 미유치 차감', key: 'uplay_no_check', column: 127 }, // DX열 (기존 DO열에서 +9)
    systemField: { name: '유플레이 미유치 차감', key: 'uplay_no_check', column: 31 }, // AF열 (기존 X열에서 +8)
    description: '유플레이 미유치 차감 (단어 미포함/포함 여부 비교)'
  }
];

// 정규표현식으로 값 추출 (쉼표, 슬래시, 띄어쓰기 구분하여 모든 숫자 추출)
function extractValueWithRegex(value, regex) {
  if (!regex || !value) return value;
  try {
    // 쉼표, 슬래시, 띄어쓰기로 분리
    const parts = value.toString().split(/[,/\\s]+/);
    
    // 모든 부분에서 정규표현식 매치 찾기
    const allMatches = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        const matches = trimmed.match(new RegExp(regex, 'g'));
        if (matches) {
          allMatches.push(...matches);
        }
      }
    }
    return allMatches.join(', '); // 모든 매치를 쉼표로 연결하여 반환
  } catch (error) {
    console.error('정규표현식 오류:', error);
    return value;
  }
}

// 디버깅 대상 시리얼번호 목록 (필요시에만 사용)
const DEBUG_SERIAL_NUMBERS = [];
const DEBUG_SUBSCRIPTION_NUMBERS = [];

// 모델명 정규화 함수
function normalizeModelName(modelName) {
  if (!modelName) return '';
  
  let normalized = modelName.toString().trim();
  
  // 언더스코어를 제거하고 G를 제거
  normalized = normalized.replace(/_/g, '').replace(/G$/i, '');
  
  return normalized;
}

// 일련번호 정규화 함수
function normalizeSerialNumber(serialNumber) {
  if (!serialNumber) return '';
  
  let serial = serialNumber.toString().trim();
  
  // 숫자인지 확인
  if (/^\d+$/.test(serial)) {
    // 숫자인 경우: 오른쪽에서부터 6자리로 맞춤
    // 6자리보다 부족한 경우 왼쪽에 0을 붙여서 6자리로 맞춤
    if (serial.length > 6) {
      // 6자리보다 긴 경우: 오른쪽에서 6자리만 사용
      return serial.slice(-6);
    } else {
      // 6자리보다 짧은 경우: 왼쪽에 0을 붙여서 6자리로 맞춤
      return serial.padStart(6, '0');
    }
  } else {
    // 영문이 포함된 경우: 앞의 0들을 제거하고 반환
    const result = serial.replace(/^0+/, '');
    return result;
  }
}

// 숫자 서식 정규화 함수 (#,### 형식)
function normalizeNumberFormat(value) {
  // 0값도 유효한 값으로 처리
  if (value === null || value === undefined || value === '') return '';
  
  const strValue = value.toString().trim();
  
  // 숫자만 추출 (쉼표, 공백, 기타 문자 제거)
  const numericValue = strValue.replace(/[^\d.-]/g, '');
  
  if (!numericValue || numericValue === '-') return '';
  
  // 숫자로 변환
  const num = parseFloat(numericValue);
  if (isNaN(num)) return '';
  
  // #,### 형식으로 포맷팅
  return num.toLocaleString();
}

// 숫자 더하기 연산 함수
function addNumbers(values) {
  let sum = 0;
  for (const value of values) {
    if (value) {
      const numericValue = value.toString().replace(/[^\d.-]/g, '');
      const num = parseFloat(numericValue);
      if (!isNaN(num)) {
        sum += num;
      }
    }
  }
  return sum;
}

// 숫자 빼기 연산 함수
function subtractNumbers(value1, value2) {
  const num1 = parseFloat(value1.toString().replace(/[^\d.-]/g, '')) || 0;
  const num2 = parseFloat(value2.toString().replace(/[^\d.-]/g, '')) || 0;
  return num1 - num2;
}

// 개통유형 정규화 함수
function normalizeActivationType(manualRow, systemRow) {
  // 수기초 데이터 정규화 (K열, AO열, CC열 조합)
  let manualType = '';
  if (manualRow.length > 80) { // 최소 CC열(80)은 있어야 함
            const joinType = (manualRow[19] || '').toString().trim(); // K열: 가입구분 (10+9)
        const prevOperator = (manualRow[49] || '').toString().trim(); // AO열: 이전사업자 (40+9)
        const changeTarget = (manualRow[89] || '').toString().trim(); // CC열: 기변타겟구분 (80+9)
        const finalPolicy = (manualRow[48] || '').toString().trim(); // AN열: 최종영업정책 (39+9)
    
    // 수기초 정규화 로직
    if (joinType === '신규') {
      if (prevOperator && prevOperator.includes('일반개통')) {
        manualType = '신규';
      } else {
        manualType = 'MNP';
      }
    } else if (joinType === '재가입') {
      if (changeTarget && changeTarget.includes('기변C')) {
        manualType = '보상(C타겟)';
      } else {
        manualType = '보상';
      }
    } else if (joinType === '정책기변') {
      if (changeTarget && changeTarget.includes('기변C')) {
        manualType = '기변(C타겟)';
      } else {
        manualType = '기변';
      }
    }
    
    // 중고 조건 확인 (AN열에 "BLANK"가 있으면 "중고-" 접두사 추가)
    if (finalPolicy && finalPolicy.includes('BLANK')) {
      manualType = `중고-${manualType}`;
    }
  }
  
  // 폰클 데이터 정규화 (L열, X열 조합)
  let systemType = '';
  if (systemRow.length > 23) { // 최소 X열(23)은 있어야 함
    const activationType = (systemRow[19] || '').toString().trim(); // L열: 개통 (11+8)
    const returnService = (systemRow[31] || '').toString().trim(); // X열: 환수서비스 (23+8)
    const columnI = (systemRow[16] || '').toString().trim(); // I열 (8+8)
    const columnE = (systemRow[12] || '').toString().trim(); // E열 (4+8)
    
    // 선불개통 조건 먼저 확인
    if (activationType && activationType.includes('선불개통')) {
      systemType = '선불개통';
      
      // 중고 조건 확인 (I열/E열에 "중고" 포함)
      if ((columnI && columnI.includes('중고')) || 
          (columnE && columnE.includes('중고'))) {
        systemType = `중고-${systemType}`;
      }
    } else {
      // 기존 폰클 정규화 로직
      if (activationType === '신규') {
        if (!returnService.includes('C타겟')) {
          systemType = '신규';
        }
      } else if (activationType === 'MNP') {
        if (!returnService.includes('C타겟')) {
          systemType = 'MNP';
        }
      } else if (activationType === '보상') {
        if (returnService.includes('C타겟')) {
          systemType = '보상(C타겟)';
        } else {
          systemType = '보상';
        }
      } else if (activationType === '기변') {
        if (returnService.includes('C타겟')) {
          systemType = '기변(C타겟)';
        } else {
          systemType = '기변';
        }
      }
    }
  }
  
  return { manualType, systemType };
}

// 실판매POS 정규화 함수
function normalizeSalesPos(manualRow, systemRow, storeData = null) {
  // 수기초 데이터 정규화 (Q열, R열)
  let manualPos = '';
  if (manualRow.length > 17) { // 최소 R열(17)은 있어야 함
    const salesPos = (manualRow[16] || '').toString().trim(); // Q열: 실판매POS
    const strategyOnline = (manualRow[17] || '').toString().trim(); // R열: 전략온라인 체크
    
    // 전략온라인 제외 조건
    if (strategyOnline && strategyOnline.includes('전략온라인')) {
      return { manualPos: '', systemPos: '' }; // 검수 대상에서 제외
    }
    
    // 수기초 정규화: Q열 값 그대로 사용
    manualPos = salesPos;
  }
  
  // 폰클 데이터 정규화 (F열 - 새로 추가된 POS코드 컬럼)
  let systemPos = '';
  if (systemRow.length > 5) { // 최소 F열(5)은 있어야 함
    const posCode = (systemRow[5] || '').toString().trim(); // F열: POS코드
    
    // 폰클 정규화: F열 POS코드 값 그대로 사용
    systemPos = posCode;
  }
  
  return { manualPos, systemPos };
}

// 요금제 정규화 함수
function normalizePlan(manualRow, systemRow, planData = null) {
  // 수기초 데이터 정규화 (AL열)
  let manualPlan = '';
  let manualPlanType = '';
  if (manualRow.length > 37) { // 최소 AL열(37)은 있어야 함
            const planName = (manualRow[46] || '').toString().trim(); // AL열: 최종요금제 (37+9)
        const finalPolicy = (manualRow[48] || '').toString().trim(); // AN열: 최종영업정책 (39+9)
    
    // AN열에 "BLANK" 문구 포함건은 대상에서 제외
    if (finalPolicy && finalPolicy.toUpperCase().includes('BLANK')) {
      return { manualPlan: '', systemPlan: '', manualPlanType: '', systemPlanType: '' }; // 검수 대상에서 제외
    }
    
    // 수기초 정규화: AL열 & (VLOOKUP1) & (VLOOKUP2)
    if (planName && planData) {
      const vlookup1 = vlookupPlanNameToPlanCode(planName, planData);
      const vlookup2 = vlookupPlanNameToPlanType(planName, planData);
      
      const parts = [planName];
      if (vlookup1) parts.push(`(${vlookup1})`);
      if (vlookup2) parts.push(`(${vlookup2})`);
      
      manualPlan = parts.join(' & ');
      manualPlanType = vlookup2 || ''; // U열 값 저장
    } else {
      manualPlan = planName;
    }
  }
  
  // 폰클 데이터 정규화 (V열)
  let systemPlan = '';
  let systemPlanType = '';
  if (systemRow.length > 21) { // 최소 V열(21)은 있어야 함
    const planCode = (systemRow[29] || '').toString().trim(); // V열: 요금제 (21+8)
    
    // 폰클 정규화: VLOOKUP1 & (V열) & (VLOOKUP2)
    if (planCode && planData) {
      const vlookup1 = vlookupPlanCodeToPlanName(planCode, planData);
      const vlookup2 = vlookupPlanCodeToPlanType(planCode, planData);
      
      const parts = [];
      if (vlookup1) parts.push(vlookup1);
      parts.push(`(${planCode})`);
      if (vlookup2) parts.push(`(${vlookup2})`);
      
      systemPlan = parts.join(' & ');
      systemPlanType = vlookup2 || ''; // U열 값 저장
    } else {
      systemPlan = planCode ? `(${planCode})` : '';
    }
  }
  
  return { manualPlan, systemPlan, manualPlanType, systemPlanType };
}

// 출고가상이 정규화 함수
function normalizeShippingVirtual(manualRow, systemRow) {
  // 수기초 데이터 정규화 (AV열+AZ열+AW열+BK열+BM열+BN열+BL열)
  let manualShipping = '';
  if (manualRow.length > 65) { // 최소 BN열(65)은 있어야 함
            const avValue = (manualRow[56] || '').toString().trim(); // AV열 (47+9)
        const azValue = (manualRow[60] || '').toString().trim(); // AZ열 (51+9)
        const awValue = (manualRow[57] || '').toString().trim(); // AW열 (48+9)
        const bkValue = (manualRow[71] || '').toString().trim(); // BK열 (62+9)
        const bmValue = (manualRow[73] || '').toString().trim(); // BM열 (64+9)
        const bnValue = (manualRow[74] || '').toString().trim(); // BN열 (65+9)
        const blValue = (manualRow[75] || '').toString().trim(); // BL열 (66+9)
        const finalPolicy = (manualRow[48] || '').toString().trim(); // AN열: 최종영업정책 (39+9)
    
    // AN열에 "BLANK" 포함되어있으면 대상에서 제외
    if (finalPolicy && finalPolicy.toUpperCase().includes('BLANK')) {
      return { manualShipping: '', systemShipping: '' }; // 검수 대상에서 제외
    }
    
    // 숫자 더하기 연산으로 정규화
    const values = [avValue, azValue, awValue, bkValue, bmValue, bnValue, blValue].filter(v => v);
    const sum = addNumbers(values);
    manualShipping = normalizeNumberFormat(sum);
  }
  
  // 폰클 데이터 정규화 (AB열)
  let systemShipping = '';
  if (systemRow.length > 27) { // 최소 AB열(27)은 있어야 함
    const abValue = (systemRow[35] || '').toString().trim(); // AB열: 출고가상이 (27+8)
    systemShipping = normalizeNumberFormat(abValue);
  }
  
  return { manualShipping, systemShipping };
}

// 지원금 및 약정상이 정규화 함수
function normalizeSupportContract(manualRow, systemRow) {
  // 수기초 데이터 정규화 (BH열 또는 BK열)
  let manualSupport = '';
  if (manualRow.length > 62) { // 최소 BK열(62)은 있어야 함
            const bhValue = (manualRow[68] || '').toString().trim(); // BH열 (59+9)
        const bkValue = (manualRow[71] || '').toString().trim(); // BK열 (62+9)
        const finalPolicy = (manualRow[48] || '').toString().trim(); // AN열: 최종영업정책 (39+9)
    
    // AN열에 "BLANK" 포함되어있으면 대상에서 제외
    if (finalPolicy && finalPolicy.toUpperCase().includes('BLANK')) {
      return { manualSupport: '', systemSupport: '' }; // 검수 대상에서 제외
    }
    
    // 선택방식 정규화: BH열에 "선택" 포함 시 "선택약정할인", 아니면 BK열
    console.log(`BH열 값: "${bhValue}", BK열 값: "${bkValue}"`);
    if (bhValue && bhValue.includes('선택')) {
      console.log('BH열에 "선택" 포함됨 → "선택약정할인" 설정');
      manualSupport = '선택약정할인';
    } else {
      console.log('BH열에 "선택" 없음 → BK열 숫자 형식으로 정규화');
      manualSupport = normalizeNumberFormat(bkValue);
    }
  }
  
  // 폰클 데이터 정규화 (AC열)
  let systemSupport = '';
  if (systemRow.length > 28) { // 최소 AC열(28)은 있어야 함
    const acValue = (systemRow[36] || '').toString().trim(); // AC열: 지원금 및 약정상이 (28+8)
    
    // 선택방식 정규화: AC열에 "선택" 포함 시 "선택약정할인", 아니면 숫자 형식
    console.log(`AC열 값: "${acValue}"`);
    if (acValue && acValue.includes('선택')) {
      console.log('AC열에 "선택" 포함됨 → "선택약정할인" 설정');
      systemSupport = '선택약정할인';
    } else {
      console.log('AC열에 "선택" 없음 → 숫자 형식으로 정규화');
      systemSupport = normalizeNumberFormat(acValue);
    }
  }
  
  return { manualSupport, systemSupport };
}

// 프리할부상이 정규화 함수
function normalizePreInstallment(manualRow, systemRow) {
  // 수기초 데이터 정규화 (BE열)
  let manualPreInstallment = '';
  if (manualRow.length > 56) { // 최소 BE열(56)은 있어야 함
    const beValue = (manualRow[56] || '').toString().trim(); // BE열: 프리할부상이
        const finalPolicy = (manualRow[48] || '').toString().trim(); // AN열: 최종영업정책 (39+9)
    
    // AN열에 "BLANK" 포함되어있으면 대상에서 제외
    if (finalPolicy && finalPolicy.toUpperCase().includes('BLANK')) {
      return { manualPreInstallment: '', systemPreInstallment: '' }; // 검수 대상에서 제외
    }
    
    // BE열에서 직접 가져오기
    manualPreInstallment = normalizeNumberFormat(beValue);
  }
  
  // 폰클 데이터 정규화 (AN열)
  let systemPreInstallment = '';
  if (systemRow.length > 39) { // 최소 AN열(39)은 있어야 함
    const anValue = (systemRow[39] || '').toString().trim(); // AN열: 프리할부상이
    
    // AN열에서 직접 가져오기
    systemPreInstallment = normalizeNumberFormat(anValue);
  }
  
  return { manualPreInstallment, systemPreInstallment };
}

// 유통망지원금 상이 정규화 함수
function normalizeDistributionSupport(manualRow, systemRow) {
  // 수기초 데이터 정규화 (BX열)
  let manualDistribution = '';
  if (manualRow.length > 75) { // 최소 BX열(75)은 있어야 함
    const bxValue = (manualRow[75] || '').toString().trim(); // BX열: 유통망지원금액
    manualDistribution = normalizeNumberFormat(bxValue);
  }
  
  // 폰클 데이터 정규화 (AL열)
  let systemDistribution = '';
  if (systemRow.length > 37) { // 최소 AL열(37)은 있어야 함
    const alValue = (systemRow[37] || '').toString().trim(); // AL열: 유통망지원금
    // 공백이면 0으로 표기
    if (!alValue || alValue === '') {
      systemDistribution = '0';
    } else {
      systemDistribution = normalizeNumberFormat(alValue);
    }
  }
  
  return { manualDistribution, systemDistribution };
}

// 유플레이 유치 추가 정규화 함수
function normalizeUplayCheck(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DX열)
  let manualValue = '유플레이 유치 추가 비대상'; // 기본값 설정
  if (manualRow.length > 127) { // 최소 DX열(127)은 있어야 함
    const uplayValue = (manualRow[127] || '').toString().trim(); // DX열: 유플레이
    
    // "유플레이" 포함 시 "유플레이 유치 추가" 표기
    if (uplayValue && uplayValue.includes('유플레이')) {
      manualValue = '유플레이 유치 추가 대상';
    } else {
      manualValue = '유플레이 유치 추가 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '유플레이 유치 추가 비대상'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const uplayValue = (systemRow[30] || '').toString().trim(); // AE열: 유플레이
    
    // "유플레이" 포함 시 "유플레이 유치 추가" 표기
    if (uplayValue && uplayValue.includes('유플레이')) {
      systemValue = '유플레이 유치 추가 대상';
    } else {
      systemValue = '유플레이 유치 추가 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// V컬러링 음악감상 플러스 유치 정규화 함수
function normalizeVcoloringMusicPlus(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DP열)
  let manualValue = 'V컬러링 음악감상 플러스 미유치'; // 기본값 설정
  if (manualRow.length > 119) { // 최소 DP열(119)은 있어야 함
    const musicValue = (manualRow[119] || '').toString().trim(); // DP열: 뮤직류
    
    // "V컬러링 음악감상 플러스" 단어 포함 여부로 정규화
    if (musicValue && musicValue.includes('V컬러링 음악감상 플러스')) {
      manualValue = 'V컬러링 음악감상 플러스 유치';
    } else {
      manualValue = 'V컬러링 음악감상 플러스 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = 'V컬러링 음악감상 플러스 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "V컬러링 음악감상 플러스" 단어 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('V컬러링 음악감상 플러스')) {
      systemValue = 'V컬러링 음악감상 플러스 유치';
    } else {
      systemValue = 'V컬러링 음악감상 플러스 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 폰교체 패스 유치 정규화 함수
function normalizePhoneExchangePass(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DU열)
  let manualValue = '폰교체 패스 미유치'; // 기본값 설정
  if (manualRow.length > 124) { // 최소 DU열(124)은 있어야 함
    const insuranceValue = (manualRow[124] || '').toString().trim(); // DU열: 보험(폰교체)
    
    // "폰교체 패스" 단어 포함 여부로 정규화
    if (insuranceValue && insuranceValue.includes('폰교체 패스')) {
      manualValue = '폰교체 패스 유치';
    } else {
      manualValue = '폰교체 패스 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '폰교체 패스 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "폰교체패스" 단어 포함 여부로 정규화 (공백 없음)
    if (serviceValue && serviceValue.includes('폰교체패스')) {
      systemValue = '폰교체 패스 유치';
    } else {
      systemValue = '폰교체 패스 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 폰교체 슬림 유치 정규화 함수
function normalizePhoneExchangeSlim(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DU열)
  let manualValue = '폰교체 슬림 미유치'; // 기본값 설정
  if (manualRow.length > 124) { // 최소 DU열(124)은 있어야 함
    const insuranceValue = (manualRow[124] || '').toString().trim(); // DU열: 보험(폰교체)
    
    // "폰교체 슬림" 단어 포함 여부로 정규화
    if (insuranceValue && insuranceValue.includes('폰교체 슬림')) {
      manualValue = '폰교체 슬림 유치';
    } else {
      manualValue = '폰교체 슬림 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '폰교체 슬림 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "폰교체슬림" 단어 포함 여부로 정규화 (공백 없음)
    if (serviceValue && serviceValue.includes('폰교체슬림')) {
      systemValue = '폰교체 슬림 유치';
    } else {
      systemValue = '폰교체 슬림 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 폰 안심패스 유치 정규화 함수
function normalizePhoneSafePass(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DU열)
  let manualValue = '폰 안심패스 미유치'; // 기본값 설정
  if (manualRow.length > 124) { // 최소 DU열(124)은 있어야 함
    const insuranceValue = (manualRow[124] || '').toString().trim(); // DU열: 보험(폰교체)
    
    // "폰 안심패스" 단어 포함 여부로 정규화
    if (insuranceValue && insuranceValue.includes('폰 안심패스')) {
      manualValue = '폰 안심패스 유치';
    } else {
      manualValue = '폰 안심패스 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '폰 안심패스 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "폰 안심패스" 단어 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('폰 안심패스')) {
      systemValue = '폰 안심패스 유치';
    } else {
      systemValue = '폰 안심패스 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 보험 미유치 정규화 함수
function normalizeInsuranceNo(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DU열)
  let manualValue = '보험 미유치'; // 기본값 설정
  if (manualRow.length > 124) { // 최소 DU열(124)은 있어야 함
    const insuranceValue = (manualRow[124] || '').toString().trim(); // DU열: 보험(폰교체)
    
    // "폰 안심패스" 또는 "폰교체 패스" 또는 "폰교체 슬림" 포함 여부로 정규화
    if (insuranceValue && (
      insuranceValue.includes('폰 안심패스') || 
      insuranceValue.includes('폰교체 패스') || 
      insuranceValue.includes('폰교체 슬림')
    )) {
      manualValue = '보험 유치';
    } else {
      manualValue = '보험 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '보험 미유치'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "보험" 단어 포함 여부로 정규화 (포함시 미유치, 미포함시 유치)
    if (serviceValue && serviceValue.includes('보험')) {
      systemValue = '보험 미유치';
    } else {
      systemValue = '보험 유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 통화연결음 유치 정규화 함수
function normalizeCallRingtone(manualRow, systemRow) {
  // 수기초 데이터 정규화 (EB열)
  let manualValue = '통화연결음 미유치'; // 기본값 설정
  if (manualRow.length > 131) { // 최소 EB열(131)은 있어야 함
    const ringtoneValue = (manualRow[131] || '').toString().trim(); // EB열: 통화연결음
    
    // "V컬러링 기본" 또는 "지정번호 필터링" 포함 여부로 정규화
    if (ringtoneValue && (
      ringtoneValue.includes('V컬러링 기본') || 
      ringtoneValue.includes('지정번호 필터링')
    )) {
      manualValue = '통화연결음 유치';
    } else {
      manualValue = '통화연결음 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '통화연결음 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "V컬러링 기본" 또는 "지정번호필터링" 포함 여부로 정규화 (공백 없음)
    if (serviceValue && (
      serviceValue.includes('V컬러링 기본') || 
      serviceValue.includes('지정번호필터링')
    )) {
      systemValue = '통화연결음 유치';
    } else {
      systemValue = '통화연결음 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 통화연결음 미유치 정규화 함수
function normalizeCallRingtoneNo(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DP열 또는 EB열)
  let manualValue = '통화연결음 미유치'; // 기본값 설정
  if (manualRow.length > 119) { // 최소 DP열(119)은 있어야 함
    const musicValue = (manualRow[119] || '').toString().trim(); // DP열: 뮤직류
    const ringtoneValue = (manualRow.length > 131 ? (manualRow[131] || '').toString().trim() : ''); // EB열: 통화연결음
    
    // "V컬러링 기본" 또는 "지정번호 필터링" 또는 "V컬러링 음악감상 플러스" 포함 여부로 정규화
    const combinedValue = musicValue + ' ' + ringtoneValue;
    if (combinedValue && (
      combinedValue.includes('V컬러링 기본') || 
      combinedValue.includes('지정번호 필터링') ||
      combinedValue.includes('V컬러링 음악감상 플러스')
    )) {
      manualValue = '통화연결음 유치';
    } else {
      manualValue = '통화연결음 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '통화연결음 미유치'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "통화연결음" 포함 여부로 정규화 (포함시 미유치, 미포함시 유치)
    if (serviceValue && serviceValue.includes('통화연결음')) {
      systemValue = '통화연결음 미유치';
    } else {
      systemValue = '통화연결음 유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 청소년요금제추가정책(1)유치 정규화 함수
function normalizeYouthPlanPolicy1(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, CV열)
  let manualValue = '청소년요금제추가정책(1) 미유치'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // 복합 조건: 가입구분이 "신규" 포함, 이전사업자가 "일반개통" 포함, 요금제유형명이 "청소년" 또는 "키즈" 포함
    if (joinType && joinType.includes('신규') && 
        prevCarrier && prevCarrier.includes('일반개통') && 
        planType && (planType.includes('청소년') || planType.includes('키즈'))) {
      manualValue = '청소년요금제추가정책(1) 유치';
    } else {
      manualValue = '청소년요금제추가정책(1) 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '청소년요금제추가정책(1) 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "청소년추가①" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('청소년추가①')) {
      systemValue = '청소년요금제추가정책(1) 유치';
    } else {
      systemValue = '청소년요금제추가정책(1) 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 청소년요금제추가정책(2)유치 정규화 함수
function normalizeYouthPlanPolicy2(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AM열, CV열)
  let manualValue = '청소년요금제추가정책(2) 미유치'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // 허용된 모델 목록
    const allowedModels = [
      'UIP16-128', 'UIP16-256', 'UIP16-512',
      'UIP16PL-128', 'UIP16PL-256', 'UIP16PL-512',
      'UIP16PR-128', 'UIP16PR-256', 'UIP16PR-512', 'UIP16PR-1T',
      'UIP16PM-256', 'UIP16PM-512', 'UIP16PM-1T'
    ];
    
    // 복합 조건: 가입구분이 "재가입" 또는 "정책기변" 포함, 개통모델이 허용된 모델 중 하나, 요금제유형명이 "청소년 Ⅱ군" 또는 "청소년 Ⅲ군" 포함
    const isJoinTypeValid = joinType && (joinType.includes('재가입') || joinType.includes('정책기변'));
    const isModelValid = model && allowedModels.some(allowedModel => model.includes(allowedModel));
    const isPlanTypeValid = planType && (planType.includes('청소년 Ⅱ군') || planType.includes('청소년 Ⅲ군'));
    
    if (isJoinTypeValid && isModelValid && isPlanTypeValid) {
      manualValue = '청소년요금제추가정책(2) 유치';
    } else {
      manualValue = '청소년요금제추가정책(2) 미유치';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '청소년요금제추가정책(2) 미유치'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "청소년추가②" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('청소년추가②')) {
      systemValue = '청소년요금제추가정책(2) 유치';
    } else {
      systemValue = '청소년요금제추가정책(2) 미유치';
    }
  }
  
  return { manualValue, systemValue };
}

// 유통망지원금 활성화정책 정규화 함수
function normalizeDistributionSupportActivation(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, AM열, BX열)
  let manualValue = '유통망지원금 활성화정책 비대상'; // 기본값 설정
  if (manualRow.length > 75) { // 최소 BX열(75)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const supportAmount = (manualRow[75] || '').toString().trim(); // BX열: 유통망지원금
    
    // 허용된 모델 목록
    const allowedModels = [
      'SM-F761N256', 'SM-F766N256', 'SM-F766N512',
      'SM-F966N256', 'SM-F966N512', 'SM-F966N1TB',
      'SM-S937N256', 'SM-S937N512', 'SM-S931N256', 'SM-S931N512',
      'SM-S936N256', 'SM-S936N512', 'SM-S938N256', 'SM-S938N512', 'SM-S938N1TB',
      'UIP16-128', 'UIP16-256', 'UIP16-512',
      'UIP16PL-128', 'UIP16PL-256', 'UIP16PL-512',
      'UIP16PR-128', 'UIP16PR-256', 'UIP16PR-512', 'UIP16PR-1T',
      'UIP16PM-256', 'UIP16PM-512', 'UIP16PM-1T'
    ];
    
    // 복합 조건: 가입구분이 "신규" 포함, 이전사업자가 "일반개통" 제외 모두 포함, 개통모델이 허용된 모델 중 하나, 유통망지원금이 200000 이상
    const isJoinTypeValid = joinType && joinType.includes('신규');
    const isPrevCarrierValid = prevCarrier && !prevCarrier.includes('일반개통'); // "일반개통" 제외 모두 포함
    const isModelValid = model && allowedModels.some(allowedModel => model.includes(allowedModel));
    
    // 유통망지원금 숫자 변환 및 비교
    let isSupportAmountValid = false;
    const numericSupportAmount = parseFloat(supportAmount.replace(/[^\d.-]/g, ''));
    if (!isNaN(numericSupportAmount)) {
      isSupportAmountValid = numericSupportAmount >= 200000;
    }
    
    if (isJoinTypeValid && isPrevCarrierValid && isModelValid && isSupportAmountValid) {
      manualValue = '유통망지원금 활성화정책 대상';
    } else {
      manualValue = '유통망지원금 활성화정책 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemValue = '유통망지원금 활성화정책 비대상'; // 기본값 설정
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const serviceValue = (systemRow[30] || '').toString().trim(); // AE열: 부가서비스
    
    // "유통망지원금 활성화정책" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('유통망지원금 활성화정책')) {
      systemValue = '유통망지원금 활성화정책 대상';
    } else {
      systemValue = '유통망지원금 활성화정책 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 115군 선택약정 차감 정규화 함수
function normalize115GroupContractDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, BQ열, CU열, CV열)
  let manualValue = '115군 선택약정 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const contractDetail = (manualRow[68] || '').toString().trim(); // BQ열: 약정상세구분
    const modelType = (manualRow[98] || '').toString().trim(); // CU열: 모델유형
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // 복합 조건: 가입구분이 "신규"이면서 이전사업자가 "일반개통"이면 제외, 약정상세구분이 "선택약정" 포함, 모델유형이 "5G모델" 포함, 요금제유형명이 "115군" 포함
    const isJoinTypeValid = joinType && joinType.includes('신규');
    const isPrevCarrierExcluded = prevCarrier && prevCarrier.includes('일반개통'); // 제외 조건
    const isContractDetailValid = contractDetail && contractDetail.includes('선택약정');
    const isModelTypeValid = modelType && modelType.includes('5G모델');
    const isPlanTypeValid = planType && planType.includes('115군');
    
    // 신규이면서 일반개통이면 제외, 그 외의 경우 조건 만족 시 대상
    if (isJoinTypeValid && isPrevCarrierExcluded) {
      manualValue = '115군 선택약정 차감 비대상'; // 신규 + 일반개통 조합은 제외
    } else if (isContractDetailValid && isModelTypeValid && isPlanTypeValid) {
      manualValue = '115군 선택약정 차감 대상';
    } else {
      manualValue = '115군 선택약정 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '115군 선택약정 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "5G전모델 115군이상 선택약정" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('5G전모델 115군이상 선택약정')) {
      systemValue = '115군 선택약정 차감 대상';
    } else {
      systemValue = '115군 선택약정 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 선택약정 S721(010신규) 차감 정규화 함수
function normalizeS721ContractDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, AM열, BQ열, CV열)
  let manualValue = '선택약정 S721(010신규) 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const contractDetail = (manualRow[68] || '').toString().trim(); // BQ열: 약정상세구분
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // 허용된 요금제 유형 목록
    const allowedPlanTypes = [
      '청소년 Ⅰ군', '청소년 Ⅱ군', '청소년 Ⅲ군',
      '시니어 Ⅰ군', '시니어 Ⅱ군', '키즈군', '33군 미만'
    ];
    
    // 복합 조건: 가입구분이 "신규" 포함, 이전사업자가 "일반개통" 포함, 개통모델이 "SM-S721N" 포함, 약정상세구분이 "선택약정" 포함, 요금제유형명이 허용된 유형 중 하나
    const isJoinTypeValid = joinType && joinType.includes('신규');
    const isPrevCarrierValid = prevCarrier && prevCarrier.includes('일반개통');
    const isModelValid = model && model.includes('SM-S721N');
    const isContractDetailValid = contractDetail && contractDetail.includes('선택약정');
    const isPlanTypeValid = planType && allowedPlanTypes.some(allowedType => planType.includes(allowedType));
    
    if (isJoinTypeValid && isPrevCarrierValid && isModelValid && isContractDetailValid && isPlanTypeValid) {
      manualValue = '선택약정 S721(010신규) 차감 대상';
    } else {
      manualValue = '선택약정 S721(010신규) 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '선택약정 S721(010신규) 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "S721 키즈군/청소년/시니어/33미만 유치시 그리고 010신규선택약정 개통시 차감" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('S721 키즈군/청소년/시니어/33미만 유치시 그리고 010신규선택약정 개통시 차감')) {
      systemValue = '선택약정 S721(010신규) 차감 대상';
    } else {
      systemValue = '선택약정 S721(010신규) 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 선택약정 S931,S938,S937(MNP) 차감 정규화 함수
function normalizeS931S938S937ContractDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, AM열, BQ열, CV열)
  let manualValue = '선택약정 S931,S938,S937(MNP) 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const contractDetail = (manualRow[68] || '').toString().trim(); // BQ열: 약정상세구분
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // 허용된 모델 목록
    const allowedModels = [
      'SM-S937N256', 'SM-S937N512',
      'SM-S931N256', 'SM-S931N512',
      'SM-S938N256', 'SM-S938N512', 'SM-S938N1TB'
    ];
    
    // 허용된 요금제 유형 목록
    const allowedPlanTypes = [
      '청소년 Ⅲ군', '75군', '85군', '95군', '105군', '115군'
    ];
    
    // 복합 조건: 가입구분이 "신규"이면서 이전사업자가 "일반개통" 아닌 경우, 개통모델이 허용된 모델 중 하나, 약정상세구분이 "선택약정" 포함, 요금제유형명이 허용된 유형 중 하나
    const isJoinTypeValid = joinType && joinType.includes('신규');
    const isPrevCarrierValid = prevCarrier && !prevCarrier.includes('일반개통'); // "일반개통" 아닌 경우
    const isModelValid = model && allowedModels.some(allowedModel => model.includes(allowedModel));
    const isContractDetailValid = contractDetail && contractDetail.includes('선택약정');
    const isPlanTypeValid = planType && allowedPlanTypes.some(allowedType => planType.includes(allowedType));
    
    if (isJoinTypeValid && isPrevCarrierValid && isModelValid && isContractDetailValid && isPlanTypeValid) {
      manualValue = '선택약정 S931,S938,S937(MNP) 차감 대상';
    } else {
      manualValue = '선택약정 S931,S938,S937(MNP) 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '선택약정 S931,S938,S937(MNP) 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "S931, S938, S937 75군/청소년 3군이상/ 선택약정 MNP 개통시 차감" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('S931, S938, S937 75군/청소년 3군이상/ 선택약정 MNP 개통시 차감')) {
      systemValue = '선택약정 S931,S938,S937(MNP) 차감 대상';
    } else {
      systemValue = '선택약정 S931,S938,S937(MNP) 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 선택약정 아이폰16류전체(MNP) 차감 정규화 함수
function normalizeIphone16ContractDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, AM열, BQ열, CV열)
  let manualValue = '선택약정 아이폰16류전체(MNP) 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const contractDetail = (manualRow[68] || '').toString().trim(); // BQ열: 약정상세구분
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // 허용된 모델 목록
    const allowedModels = [
      'UIP16-128', 'UIP16-256', 'UIP16-512',
      'UIP16PL-128', 'UIP16PL-256', 'UIP16PL-512',
      'UIP16PR-128', 'UIP16PR-256', 'UIP16PR-512', 'UIP16PR-1T',
      'UIP16PM-256', 'UIP16PM-512', 'UIP16PM-1T'
    ];
    
    // 허용된 요금제 유형 목록
    const allowedPlanTypes = [
      '청소년 Ⅲ군', '75군', '85군', '95군', '105군', '115군'
    ];
    
    // 복합 조건: 가입구분이 "신규"이면서 이전사업자가 "일반개통" 아닌 경우, 개통모델이 허용된 모델 중 하나, 약정상세구분이 "선택약정" 포함, 요금제유형명이 허용된 유형 중 하나
    const isJoinTypeValid = joinType && joinType.includes('신규');
    const isPrevCarrierValid = prevCarrier && !prevCarrier.includes('일반개통'); // "일반개통" 아닌 경우
    const isModelValid = model && allowedModels.some(allowedModel => model.includes(allowedModel));
    const isContractDetailValid = contractDetail && contractDetail.includes('선택약정');
    const isPlanTypeValid = planType && allowedPlanTypes.some(allowedType => planType.includes(allowedType));
    
    if (isJoinTypeValid && isPrevCarrierValid && isModelValid && isContractDetailValid && isPlanTypeValid) {
      manualValue = '선택약정 아이폰16류전체(MNP) 차감 대상';
    } else {
      manualValue = '선택약정 아이폰16류전체(MNP) 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '선택약정 아이폰16류전체(MNP) 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "UIP16류전체(UIP16E제외) 75군/청소년 3군이상/ 선택약정 MNP 개통시 차감" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('UIP16류전체(UIP16E제외) 75군/청소년 3군이상/ 선택약정 MNP 개통시 차감')) {
      systemValue = '선택약정 아이폰16류전체(MNP) 차감 대상';
    } else {
      systemValue = '선택약정 아이폰16류전체(MNP) 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// A166 44군 대상외요금제(MNP) 차감 정규화 함수
function normalizeA16644GroupExcludedPlanDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AX열, AM열, BQ열, CV열, AT열)
  let manualValue = 'A166 44군 대상외요금제(MNP) 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const prevCarrier = (manualRow[49] || '').toString().trim(); // AX열: 이전사업자
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const contractDetail = (manualRow[68] || '').toString().trim(); // BQ열: 약정상세구분
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    const planName = (manualRow[45] || '').toString().trim(); // AT열: 개통요금제명
    
    // 허용된 모델 목록
    const allowedModels = [
      'SM-A166L', 'SM-A156L'
    ];
    
    // 제외할 요금제명 목록
    const excludedPlanNames = [
      '5G 슬림+', '유쓰 5G 슬림+', '추가 요금 걱정 없는 데이터 49'
    ];
    
    // 복합 조건: 가입구분이 "신규"이면서 이전사업자가 "일반개통" 아닌 경우, 개통모델이 허용된 모델 중 하나, 약정상세구분이 "선택약정" 포함, 요금제유형명이 "44군" 포함, 개통요금제명이 제외 목록에 없는 경우
    const isJoinTypeValid = joinType && joinType.includes('신규');
    const isPrevCarrierValid = prevCarrier && !prevCarrier.includes('일반개통'); // "일반개통" 아닌 경우
    const isModelValid = model && allowedModels.some(allowedModel => model.includes(allowedModel));
    const isContractDetailValid = contractDetail && contractDetail.includes('선택약정');
    const isPlanTypeValid = planType && planType.includes('44군');
    const isPlanNameValid = planName && !excludedPlanNames.some(excludedPlan => planName.includes(excludedPlan)); // 제외 목록에 없는 경우
    
    if (isJoinTypeValid && isPrevCarrierValid && isModelValid && isContractDetailValid && isPlanTypeValid && isPlanNameValid) {
      manualValue = 'A166 44군 대상외요금제(MNP) 차감 대상';
    } else {
      manualValue = 'A166 44군 대상외요금제(MNP) 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = 'A166 44군 대상외요금제(MNP) 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "44군 대상외 요금제 차감- D군중 (55,청소년Ⅱ,시니어Ⅱ)차감제외 MNP" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('44군 대상외 요금제 차감- D군중 (55,청소년Ⅱ,시니어Ⅱ)차감제외 MNP')) {
      systemValue = 'A166 44군 대상외요금제(MNP) 차감 대상';
    } else {
      systemValue = 'A166 44군 대상외요금제(MNP) 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// A166 44군 대상외요금제(기변) 차감 정규화 함수
function normalizeA16644GroupExcludedPlanChangeDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열, AM열, BQ열, CV열, AT열)
  let manualValue = 'A166 44군 대상외요금제(기변) 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    const model = (manualRow[38] || '').toString().trim(); // AM열: 개통모델
    const contractDetail = (manualRow[68] || '').toString().trim(); // BQ열: 약정상세구분
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    const planName = (manualRow[45] || '').toString().trim(); // AT열: 개통요금제명
    
    // 허용된 모델 목록
    const allowedModels = [
      'SM-A166L', 'SM-A156L'
    ];
    
    // 제외할 요금제명 목록
    const excludedPlanNames = [
      '5G 슬림+', '유쓰 5G 슬림+', '추가 요금 걱정 없는 데이터 49'
    ];
    
    // 복합 조건: 가입구분이 "재가입" 또는 "정책기변"인 경우, 개통모델이 허용된 모델 중 하나, 약정상세구분이 "선택약정" 포함, 요금제유형명이 "44군" 포함, 개통요금제명이 제외 목록에 없는 경우
    const isJoinTypeValid = joinType && (joinType.includes('재가입') || joinType.includes('정책기변'));
    const isModelValid = model && allowedModels.some(allowedModel => model.includes(allowedModel));
    const isContractDetailValid = contractDetail && contractDetail.includes('선택약정');
    const isPlanTypeValid = planType && planType.includes('44군');
    const isPlanNameValid = planName && !excludedPlanNames.some(excludedPlan => planName.includes(excludedPlan)); // 제외 목록에 없는 경우
    
    if (isJoinTypeValid && isModelValid && isContractDetailValid && isPlanTypeValid && isPlanNameValid) {
      manualValue = 'A166 44군 대상외요금제(기변) 차감 대상';
    } else {
      manualValue = 'A166 44군 대상외요금제(기변) 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = 'A166 44군 대상외요금제(기변) 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "44군 대상외 요금제 차감- D군중 (55,청소년Ⅱ,시니어Ⅱ)차감제외 기변" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('44군 대상외 요금제 차감- D군중 (55,청소년Ⅱ,시니어Ⅱ)차감제외 기변')) {
      systemValue = 'A166 44군 대상외요금제(기변) 차감 대상';
    } else {
      systemValue = 'A166 44군 대상외요금제(기변) 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 정책기변 차감 정규화 함수
function normalizePolicyChangeDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (T열)
  let manualValue = '정책기변 차감 비대상'; // 기본값 설정
  if (manualRow.length > 19) { // 최소 T열(19)은 있어야 함
    const joinType = (manualRow[19] || '').toString().trim(); // T열: 가입구분
    
    // "정책기변" 포함 여부로 정규화
    if (joinType && joinType.includes('정책기변')) {
      manualValue = '정책기변 차감 대상';
    } else {
      manualValue = '정책기변 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '정책기변 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "정책기변" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('정책기변')) {
      systemValue = '정책기변 차감 대상';
    } else {
      systemValue = '정책기변 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 기변 C타겟 차감 정규화 함수
function normalizeChangeCTargetDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (CL열)
  let manualValue = '기변 C타겟 차감 비대상'; // 기본값 설정
  if (manualRow.length > 89) { // 최소 CL열(89)은 있어야 함
    const joinType = (manualRow[89] || '').toString().trim(); // CL열: 가입구분
    
    // "기변C" 포함 여부로 정규화
    if (joinType && joinType.includes('기변C')) {
      manualValue = '기변 C타겟 차감 대상';
    } else {
      manualValue = '기변 C타겟 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '기변 C타겟 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "기변 C타겟" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('기변 C타겟')) {
      systemValue = '기변 C타겟 차감 대상';
    } else {
      systemValue = '기변 C타겟 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 33군미만, 시니어1군시 차감 정규화 함수
function normalize33GroupSenior1Deduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (CV열)
  let manualValue = '33군미만, 시니어1군시 차감 비대상'; // 기본값 설정
  if (manualRow.length > 99) { // 최소 CV열(99)은 있어야 함
    const planType = (manualRow[99] || '').toString().trim(); // CV열: 요금제유형명
    
    // "시니어 Ⅰ군" 또는 "33군 미만" 포함 여부로 정규화
    if (planType && (planType.includes('시니어 Ⅰ군') || planType.includes('33군 미만'))) {
      manualValue = '33군미만, 시니어1군시 차감 대상';
    } else {
      manualValue = '33군미만, 시니어1군시 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '33군미만, 시니어1군시 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "33군 미만/ LTE 시니어1군 유치시" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('33군 미만/ LTE 시니어1군 유치시')) {
      systemValue = '33군미만, 시니어1군시 차감 대상';
    } else {
      systemValue = '33군미만, 시니어1군시 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 온세일 전략온라인POS 차감 정규화 함수
function normalizeOnsaleStrategyOnlinePosDeduction(manualRow, systemRow) {
  // 수기초 데이터 정규화 (CE열, AW열, CU열)
  let manualValue = '온세일 전략온라인POS 차감 비대상'; // 기본값 설정
  
  if (manualRow.length > 98) { // 최소 CU열(98)은 있어야 함
    const reservationSystem = (manualRow[82] || '').toString().trim(); // CE열: 예약가입시스템
    const finalPolicy = (manualRow[48] || '').toString().trim(); // AW열: 최종영업정책
    const modelType = (manualRow[98] || '').toString().trim(); // CU열: 모델유형
    
    // 복합 조건 확인:
    // 1. CE열에 "온세일" 포함
    // 2. AW열에 "BLANK" 미포함
    // 3. CU열에 "LTE_2nd모델" 또는 "5G_2nd모델" 미포함
    const hasOnsale = reservationSystem && reservationSystem.includes('온세일');
    const notBlank = finalPolicy && !finalPolicy.includes('BLANK');
    const notSecondModel = modelType && !modelType.includes('LTE_2nd모델') && !modelType.includes('5G_2nd모델');
    
    if (hasOnsale && notBlank && notSecondModel) {
      manualValue = '온세일 전략온라인POS 차감 대상';
    } else {
      manualValue = '온세일 전략온라인POS 차감 비대상';
    }
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '온세일 전략온라인POS 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const serviceValue = (systemRow[31] || '').toString().trim(); // AF열: 환수서비스
    
    // "온세일 전략온라인POS 개통시" 포함 여부로 정규화
    if (serviceValue && serviceValue.includes('온세일 전략온라인POS 개통시')) {
      systemValue = '온세일 전략온라인POS 차감 대상';
    } else {
      systemValue = '온세일 전략온라인POS 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 유플레이 미유치 차감 정규화 함수
function normalizeUplayNoCheck(manualRow, systemRow) {
  // 수기초 데이터 정규화 (DX열)
  let manualValue = '유플레이 미유치 차감 비대상'; // 기본값 설정
  
  // 디버깅 로그 추가
  console.log(`🔍 [유플레이 미유치] 수기초 배열 길이: ${manualRow.length}`);
  console.log(`🔍 [유플레이 미유치] DX열(127) 원본값: "${manualRow[127]}"`);
  console.log(`🔍 [유플레이 미유치] DX열(127) 타입: ${typeof manualRow[127]}`);
  
  if (manualRow.length > 127) { // 최소 DX열(127)은 있어야 함 (128 이상)
    const uplayValue = (manualRow[127] || '').toString().trim(); // DX열: 유플레이
    
    console.log(`🔍 [유플레이 미유치] uplayValue: "${uplayValue}"`);
    console.log(`🔍 [유플레이 미유치] !uplayValue: ${!uplayValue}`);
    console.log(`🔍 [유플레이 미유치] !uplayValue.includes('유플레이'): ${!uplayValue.includes('유플레이')}`);
    console.log(`🔍 [유플레이 미유치] 조건문 결과: ${!uplayValue || !uplayValue.includes('유플레이')}`);
    
    // "유플레이" 문구가 없거나 공백이면 "유플레이 미유치 차감 대상"
    if (!uplayValue || !uplayValue.includes('유플레이')) {
      manualValue = '유플레이 미유치 차감 대상';
      console.log(`🔍 [유플레이 미유치] 조건문 통과 - manualValue를 "대상"으로 설정`);
    } else {
      manualValue = '유플레이 미유치 차감 비대상';
      console.log(`🔍 [유플레이 미유치] 조건문 실패 - manualValue를 "비대상"으로 설정`);
    }
  } else {
    console.log(`🔍 [유플레이 미유치] 배열 길이 부족 (${manualRow.length} <= 127) - 기본값 "비대상" 유지`);
  }
  
  // 폰클 데이터 정규화 (AF열)
  let systemValue = '유플레이 미유치 차감 비대상'; // 기본값 설정
  if (systemRow.length > 31) { // 최소 AF열(31)은 있어야 함
    const uplayNoValue = (systemRow[31] || '').toString().trim(); // AF열: 유플레이 미유치
    
    // "유플레이" 문구가 있다면 "유플레이 미유치 차감 대상"
    if (uplayNoValue && uplayNoValue.includes('유플레이')) {
      systemValue = '유플레이 미유치 차감 대상';
    } else {
      systemValue = '유플레이 미유치 차감 비대상';
    }
  }
  
  return { manualValue, systemValue };
}

// 동적 컬럼 비교 함수
function compareDynamicColumns(manualRow, systemRow, key, targetField = null, storeData = null, planData = null) {
  const differences = [];
  
  // 특정 필드만 비교하거나 전체 필드 비교
  const mappingsToCompare = targetField 
    ? COLUMN_MATCHING_CONFIG.filter(config => config.manualField.key === targetField)
    : COLUMN_MATCHING_CONFIG;

  mappingsToCompare.forEach(config => {
    const { manualField, systemField, regex, description } = config;
    
    // 개통일시분 비교 로직
    if (manualField.key === 'activation_datetime') {
      // 배열 범위 체크
      if (manualRow.length <= 20 || systemRow.length <= 3) { // U=20, B=1, C=2, D=3
        return;
      }
      
      const manualDate = manualRow[29] || ''; // U열: 가입일자 (20+9)
      const manualTime = manualRow[30] || ''; // V열: 개통시간 (21+9)
      const systemDate = systemRow[9] || '';  // B열: 개통일 (1+8)
      const systemHour = systemRow[10] || '';  // C열: 개통시 (2+8)
      const systemMinute = systemRow[11] || ''; // D열: 개통분 (3+8)
      
      // 개통일시분 정규화
      const { manualDateTime, systemDateTime } = normalizeActivationDateTime(
        manualDate, manualTime, systemDate, systemHour, systemMinute
      );
      
      // 정규화된 값이 있고 다르면 차이점으로 기록
      if (manualDateTime && systemDateTime && manualDateTime !== systemDateTime) {
        differences.push({
          key,
          type: 'mismatch',
          field: '개통일시분',
          fieldKey: 'activation_datetime',
          correctValue: manualDateTime,
          incorrectValue: systemDateTime,
          description: '개통일시분 비교 (초 제외, 24시간 형식)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 모델명(일련번호) 비교 로직
    if (manualField.key === 'model_serial') {
      // 배열 범위 체크 (AD=29, AE=30, AN=39, N=13, P=15)
      if (manualRow.length <= 30 || systemRow.length <= 15) {
        console.log(`모델명 비교 범위 체크 실패: key=${key}, manualRow.length=${manualRow.length}, systemRow.length=${systemRow.length}`);
        return;
      }
      
      // AN열 최종영업정책이 "BLANK"인 경우 비교 제외
              const finalPolicy = manualRow[48] || ''; // AN열: 최종영업정책 (39+9)
      if (finalPolicy.toString().trim().toUpperCase() === 'BLANK') {
        return;
      }
      
              const manualModel = manualRow[38] || ''; // AD열: 개통모델 (29+9)
        const manualSerial = manualRow[39] || ''; // AE열: 개통모델일련번호 (30+9)
      const systemModel = systemRow[21] || '';  // N열: 모델명 (13+8)
      const systemSerial = systemRow[23] || ''; // P열: 일련번호 (15+8)
      
      // 디버깅 대상 시리얼번호인지 확인 (필요시에만 사용)
      const isDebugTarget = DEBUG_SERIAL_NUMBERS.includes(manualSerial) || DEBUG_SERIAL_NUMBERS.includes(systemSerial);
      
      // 모델명과 일련번호 정규화
      const normalizedManualModel = normalizeModelName(manualModel);
      const normalizedSystemModel = normalizeModelName(systemModel);
      const normalizedManualSerial = normalizeSerialNumber(manualSerial);
      const normalizedSystemSerial = normalizeSerialNumber(systemSerial);
      

      
      // 모델명과 일련번호를 조합하여 비교
      const manualCombined = `${normalizedManualModel}(${normalizedManualSerial})`;
      const systemCombined = `${normalizedSystemModel}(${normalizedSystemSerial})`;
      

      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualCombined !== systemCombined && 
          (manualCombined || systemCombined)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '모델명(일련번호)',
          fieldKey: 'model_serial',
          correctValue: manualCombined,
          incorrectValue: systemCombined,
          description: '모델명과 일련번호 비교 (모델명 정규화, 일련번호 6자리 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 개통유형 비교 로직
    if (manualField.key === 'activation_type') {
      // 배열 범위 체크 (K=10, AO=40, CC=80, L=11, X=23)
      if (manualRow.length <= 80 || systemRow.length <= 23) {
        return;
      }
      
      // 개통유형 정규화
      const { manualType, systemType } = normalizeActivationType(manualRow, systemRow);
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualType !== systemType && 
          (manualType || systemType)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '개통유형',
          fieldKey: 'activation_type',
          correctValue: manualType || '정규화 불가',
          incorrectValue: systemType || '정규화 불가',
          description: '개통유형 및 C타겟차감대상 비교 (가입구분+이전사업자+기변타겟구분 정규화)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 실판매POS 비교 로직
    if (manualField.key === 'sales_pos') {
      // 배열 범위 체크 (Q=16, R=17, F=5)
      if (manualRow.length <= 17 || systemRow.length <= 5) {
        return;
      }
      
      // 실판매POS 정규화
      const { manualPos, systemPos } = normalizeSalesPos(manualRow, systemRow, storeData);
      
      // 전략온라인 제외 조건으로 인해 빈 값이 반환된 경우 비교 제외
      if (!manualPos && !systemPos) {
        return;
      }
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualPos !== systemPos && 
          (manualPos || systemPos)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '실판매POS',
          fieldKey: 'sales_pos',
          correctValue: manualPos || '정규화 불가',
          incorrectValue: systemPos || '정규화 불가',
          description: '실판매POS 비교 (VLOOKUP 방식 정규화, 전략온라인 제외)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 요금제 비교 로직
    if (manualField.key === 'plan') {
      // 배열 범위 체크 (AL=37, AN=39, V=21)
      if (manualRow.length <= 39 || systemRow.length <= 21) {
        return;
      }
      
          // 요금제 정규화
    const { manualPlan, systemPlan, manualPlanType, systemPlanType } = normalizePlan(manualRow, systemRow, planData);
    
    // AN열 BLANK 제외 조건으로 인해 빈 값이 반환된 경우 비교 제외
    if (!manualPlan && !systemPlan) {
      return;
    }
    
    // 요금제 구분(U열)이 일치하는지 확인
    const planTypeMatch = manualPlanType && systemPlanType && manualPlanType === systemPlanType;
    
    // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
    // 단, 요금제 구분(U열)이 일치하면 차이점으로 기록하지 않음
    if (manualPlan !== systemPlan && 
        (manualPlan || systemPlan) && 
        !planTypeMatch) {

      differences.push({
        key,
        type: 'mismatch',
        field: '요금제',
        fieldKey: 'plan',
        correctValue: manualPlan || '정규화 불가',
        incorrectValue: systemPlan || '정규화 불가',
        description: '요금제 비교 (VLOOKUP 방식 정규화, AN열 BLANK 제외, U열 일치 시 제외)',
        manualRow: null,
        systemRow: null,
        assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
      });
    }
      return;
    }
    
    // 출고가상이 비교 로직
    if (manualField.key === 'shipping_virtual') {
      // 배열 범위 체크 (AV=47, AZ=51, AW=48, BK=62, BM=64, BN=63, BL=65, AB=27)
      if (manualRow.length <= 65 || systemRow.length <= 27) {
        return;
      }
      
      // 출고가상이 정규화
      const { manualShipping, systemShipping } = normalizeShippingVirtual(manualRow, systemRow);
      
      // AN열 BLANK 제외 조건으로 인해 빈 값이 반환된 경우 비교 제외
      if (!manualShipping && !systemShipping) {
        return;
      }
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualShipping !== systemShipping && 
          (manualShipping || systemShipping)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '출고가상이',
          fieldKey: 'shipping_virtual',
          correctValue: manualShipping || '정규화 불가',
          incorrectValue: systemShipping || '정규화 불가',
          description: '출고가상이 비교 (더하기 방식 정규화, AN열 BLANK 제외)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 지원금 및 약정상이 비교 로직
    if (manualField.key === 'support_contract') {
      // 배열 범위 체크 (DH=85, BK=62, AN=39, AC=28)
      if (manualRow.length <= 85 || systemRow.length <= 28) {
        return;
      }
      
      // 지원금 및 약정상이 정규화
      const { manualSupport, systemSupport } = normalizeSupportContract(manualRow, systemRow);
      
      // AN열 BLANK 제외 조건으로 인해 빈 값이 반환된 경우 비교 제외
      if (!manualSupport && !systemSupport) {
        return;
      }
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualSupport !== systemSupport && 
          (manualSupport || systemSupport)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '지원금 및 약정상이',
          fieldKey: 'support_contract',
          correctValue: manualSupport || '정규화 불가',
          incorrectValue: systemSupport || '정규화 불가',
          description: '지원금 및 약정상이 비교 (선택방식 정규화, AN열 BLANK 제외)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 프리할부상이 비교 로직
    if (manualField.key === 'pre_installment') {
      // 배열 범위 체크 (BE=56, AN=39)
      if (manualRow.length <= 56 || systemRow.length <= 39) {
        return;
      }
      
      // 프리할부상이 정규화
      const { manualPreInstallment, systemPreInstallment } = normalizePreInstallment(manualRow, systemRow);
      
      // AN열 BLANK 제외 조건으로 인해 빈 값이 반환된 경우 비교 제외
      if (!manualPreInstallment && !systemPreInstallment) {
        return;
      }
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualPreInstallment !== systemPreInstallment && 
          (manualPreInstallment || systemPreInstallment)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '프리할부상이',
          fieldKey: 'pre_installment',
          correctValue: manualPreInstallment || '정규화 불가',
          incorrectValue: systemPreInstallment || '정규화 불가',
          description: '프리할부상이 비교 (직접 비교, AN열 BLANK 제외)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 유통망지원금 상이 비교 로직
    if (manualField.key === 'distribution_support') {
      // 배열 범위 체크 (BX=75, AL=37)
      if (manualRow.length <= 75 || systemRow.length <= 37) {
        return;
      }
      
      // 유통망지원금 상이 정규화
      const { manualDistribution, systemDistribution } = normalizeDistributionSupport(manualRow, systemRow);
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualDistribution !== systemDistribution && 
          (manualDistribution || systemDistribution)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '유통망지원금 상이',
          fieldKey: 'distribution_support',
          correctValue: manualDistribution || '정규화 불가',
          incorrectValue: systemDistribution || '정규화 불가',
          description: '유통망지원금 상이 비교 (숫자 서식 정규화)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 유플레이 유치 추가 비교 로직
    if (manualField.key === 'uplay_check') {
      // 유플레이 유치 추가 정규화
      const { manualValue, systemValue } = normalizeUplayCheck(manualRow, systemRow);
      
      // 디버깅 로그 추가
      console.log(`[유플레이 유치 추가] key=${key}, manualValue="${manualValue}", systemValue="${systemValue}"`);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        
        console.log(`[유플레이 유치 추가] 불일치 발견: manualValue="${manualValue}" !== systemValue="${systemValue}"`);

        differences.push({
          key,
          type: 'mismatch',
          field: '유플레이 유치 추가',
          fieldKey: 'uplay_check',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '유플레이 유치 추가 (단어 포함 여부 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      } else {
        console.log(`[유플레이 유치 추가] 일치: manualValue="${manualValue}" === systemValue="${systemValue}"`);
      }
      return;
    }
    
    // V컬러링 음악감상 플러스 유치 비교 로직
    if (manualField.key === 'vcoloring_music_plus') {
      // V컬러링 음악감상 플러스 유치 정규화
      const { manualValue, systemValue } = normalizeVcoloringMusicPlus(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: 'V컬러링 음악감상 플러스 유치',
          fieldKey: 'vcoloring_music_plus',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: 'V컬러링 음악감상 플러스 유치 (단어 포함 여부 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 폰교체 패스 유치 비교 로직
    if (manualField.key === 'phone_exchange_pass') {
      // 폰교체 패스 유치 정규화
      const { manualValue, systemValue } = normalizePhoneExchangePass(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '폰교체 패스 유치',
          fieldKey: 'phone_exchange_pass',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '폰교체 패스 유치 (단어 포함 여부 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 폰교체 슬림 유치 비교 로직
    if (manualField.key === 'phone_exchange_slim') {
      // 폰교체 슬림 유치 정규화
      const { manualValue, systemValue } = normalizePhoneExchangeSlim(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '폰교체 슬림 유치',
          fieldKey: 'phone_exchange_slim',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '폰교체 슬림 유치 (단어 포함 여부 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 폰 안심패스 유치 비교 로직
    if (manualField.key === 'phone_safe_pass') {
      // 폰 안심패스 유치 정규화
      const { manualValue, systemValue } = normalizePhoneSafePass(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '폰 안심패스 유치',
          fieldKey: 'phone_safe_pass',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '폰 안심패스 유치 (단어 포함 여부 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 보험 미유치 비교 로직
    if (manualField.key === 'insurance_no') {
      // 보험 미유치 정규화
      const { manualValue, systemValue } = normalizeInsuranceNo(manualRow, systemRow);
      
      // 보험 미유치: 값이 다르면 불일치, 같으면 일치
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '보험 미유치',
          fieldKey: 'insurance_no',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '보험 미유치 (폰클: 보험 포함시 미유치, 미포함시 유치)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 통화연결음 유치 비교 로직
    if (manualField.key === 'call_ringtone') {
      // 통화연결음 유치 정규화
      const { manualValue, systemValue } = normalizeCallRingtone(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '통화연결음 유치',
          fieldKey: 'call_ringtone',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '통화연결음 유치 (단어 포함 여부 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 통화연결음 미유치 비교 로직
    if (manualField.key === 'call_ringtone_no') {
      // 통화연결음 미유치 정규화
      const { manualValue, systemValue } = normalizeCallRingtoneNo(manualRow, systemRow);
      
      // 통화연결음 미유치: 값이 다르면 불일치, 같으면 일치
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '통화연결음 미유치',
          fieldKey: 'call_ringtone_no',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '통화연결음 미유치 (폰클: 통화연결음 포함시 미유치, 미포함시 유치)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }
    
    // 청소년요금제추가정책(1)유치 비교 로직
    if (manualField.key === 'youth_plan_policy_1') {
      // 청소년요금제추가정책(1)유치 정규화
      const { manualValue, systemValue } = normalizeYouthPlanPolicy1(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '청소년요금제추가정책(1)유치',
          fieldKey: 'youth_plan_policy_1',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '청소년요금제추가정책(1)유치 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 청소년요금제추가정책(2)유치 비교 로직
    if (manualField.key === 'youth_plan_policy_2') {
      // 청소년요금제추가정책(2)유치 정규화
      const { manualValue, systemValue } = normalizeYouthPlanPolicy2(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '청소년요금제추가정책(2)유치',
          fieldKey: 'youth_plan_policy_2',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '청소년요금제추가정책(2)유치 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 유통망지원금 활성화정책 비교 로직
    if (manualField.key === 'distribution_support_activation') {
      // 유통망지원금 활성화정책 정규화
      const { manualValue, systemValue } = normalizeDistributionSupportActivation(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '유통망지원금 활성화정책',
          fieldKey: 'distribution_support_activation',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '유통망지원금 활성화정책 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 115군 선택약정 차감 비교 로직
    if (manualField.key === '115_group_contract_deduction') {
      // 115군 선택약정 차감 정규화
      const { manualValue, systemValue } = normalize115GroupContractDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '115군 선택약정 차감',
          fieldKey: '115_group_contract_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '115군 선택약정 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 선택약정 S721(010신규) 차감 비교 로직
    if (manualField.key === 's721_contract_deduction') {
      // 선택약정 S721(010신규) 차감 정규화
      const { manualValue, systemValue } = normalizeS721ContractDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '선택약정 S721(010신규) 차감',
          fieldKey: 's721_contract_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '선택약정 S721(010신규) 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 선택약정 S931,S938,S937(MNP) 차감 비교 로직
    if (manualField.key === 's931_s938_s937_contract_deduction') {
      // 선택약정 S931,S938,S937(MNP) 차감 정규화
      const { manualValue, systemValue } = normalizeS931S938S937ContractDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '선택약정 S931,S938,S937(MNP) 차감',
          fieldKey: 's931_s938_s937_contract_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '선택약정 S931,S938,S937(MNP) 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 선택약정 아이폰16류전체(MNP) 차감 비교 로직
    if (manualField.key === 'iphone16_contract_deduction') {
      // 선택약정 아이폰16류전체(MNP) 차감 정규화
      const { manualValue, systemValue } = normalizeIphone16ContractDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '선택약정 아이폰16류전체(MNP) 차감',
          fieldKey: 'iphone16_contract_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '선택약정 아이폰16류전체(MNP) 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // A166 44군 대상외요금제(MNP) 차감 비교 로직
    if (manualField.key === 'a166_44group_excluded_plan_deduction') {
      // A166 44군 대상외요금제(MNP) 차감 정규화
      const { manualValue, systemValue } = normalizeA16644GroupExcludedPlanDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: 'A166 44군 대상외요금제(MNP) 차감',
          fieldKey: 'a166_44group_excluded_plan_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: 'A166 44군 대상외요금제(MNP) 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // A166 44군 대상외요금제(기변) 차감 비교 로직
    if (manualField.key === 'a166_44group_excluded_plan_change_deduction') {
      // A166 44군 대상외요금제(기변) 차감 정규화
      const { manualValue, systemValue } = normalizeA16644GroupExcludedPlanChangeDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: 'A166 44군 대상외요금제(기변) 차감',
          fieldKey: 'a166_44group_excluded_plan_change_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: 'A166 44군 대상외요금제(기변) 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 정책기변 차감 비교 로직
    if (manualField.key === 'policy_change_deduction') {
      // 정책기변 차감 정규화
      const { manualValue, systemValue } = normalizePolicyChangeDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '정책기변 차감',
          fieldKey: 'policy_change_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '정책기변 차감 (단순 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 기변 C타겟 차감 비교 로직
    if (manualField.key === 'change_c_target_deduction') {
      // 기변 C타겟 차감 정규화
      const { manualValue, systemValue } = normalizeChangeCTargetDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '기변 C타겟 차감',
          fieldKey: 'change_c_target_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '기변 C타겟 차감 (단순 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 33군미만, 시니어1군시 차감 비교 로직
    if (manualField.key === '33group_senior1_deduction') {
      // 33군미만, 시니어1군시 차감 정규화
      const { manualValue, systemValue } = normalize33GroupSenior1Deduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '33군미만, 시니어1군시 차감',
          fieldKey: '33group_senior1_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '33군미만, 시니어1군시 차감 (단순 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 온세일 전략온라인POS 차감 비교 로직
    if (manualField.key === 'onsale_strategy_online_pos_deduction') {
      // 온세일 전략온라인POS 차감 정규화
      const { manualValue, systemValue } = normalizeOnsaleStrategyOnlinePosDeduction(manualRow, systemRow);
      
      // 값이 다르면 차이점으로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        differences.push({
          key,
          type: 'mismatch',
          field: '온세일 전략온라인POS 차감',
          fieldKey: 'onsale_strategy_online_pos_deduction',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '온세일 전략온라인POS 차감 (복합 조건 비교)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      }
      return;
    }

    // 유플레이 미유치 차감 비교 로직
    if (manualField.key === 'uplay_no_check') {
      // 유플레이 미유치 차감 정규화
      const { manualValue, systemValue } = normalizeUplayNoCheck(manualRow, systemRow);
      
      // 500280760172 가번 디버깅 로그 추가
      
      
      // 디버깅 로그 추가
      console.log(`[유플레이 미유치 차감] key=${key}, manualValue="${manualValue}", systemValue="${systemValue}"`);
        
      // 값이 다르면 불일치로 기록
      if (manualValue.trim() !== systemValue.trim()) {
        
        console.log(`[유플레이 미유치 차감] 불일치 발견: manualValue="${manualValue}" !== systemValue="${systemValue}"`);

        differences.push({
          key,
          type: 'mismatch',
          field: '유플레이 미유치 차감',
          fieldKey: 'uplay_no_check',
          correctValue: manualValue,
          incorrectValue: systemValue,
          description: '유플레이 미유치 차감 (일반 로직: 값이 다르면 불일치)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
        });
      } else {
        console.log(`[유플레이 미유치 차감] 일치: manualValue="${manualValue}" === systemValue="${systemValue}"`);
      }
      return;
    }
    
    // 기존 비교 로직 (대리점코드 등)
    // 배열 범위 체크
    if (manualRow.length <= manualField.column || systemRow.length <= systemField.column) {
      return;
    }
    
    let manualValue = manualRow[manualField.column] || '';
    let systemValue = systemRow[systemField.column] || '';
    
    // 정규표현식이 있으면 값 추출
    if (regex) {
      manualValue = extractValueWithRegex(manualValue, regex);
      systemValue = extractValueWithRegex(systemValue, regex);
      
      // 대리점코드의 경우: 수기초 값이 폰클데이터에 포함되어 있으면 일치로 처리
      if (manualField.key === 'store_code' && manualValue && systemValue) {
        const manualCodes = manualValue.split(', ').map(code => code.trim());
        const systemCodes = systemValue.split(', ').map(code => code.trim());
        
        // 수기초의 대리점코드가 폰클데이터에 하나라도 포함되어 있으면 일치
        const hasMatch = manualCodes.some(manualCode => 
          systemCodes.some(systemCode => manualCode === systemCode)
        );
        
        if (hasMatch) {
          return; // 일치하므로 차이점으로 기록하지 않음
        }
      }
    }
    
    // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
    if (manualValue.toString().trim() !== systemValue.toString().trim() && 
        (manualValue.toString().trim() || systemValue.toString().trim())) {
      differences.push({
        key,
        type: 'mismatch',
        field: manualField.name,
        fieldKey: manualField.key,
        correctValue: manualValue.toString().trim(),
        incorrectValue: systemValue.toString().trim(),
        description,
        manualRow: null,
        systemRow: null,
        assignedAgent: systemRow[77] || '' // BR열: 등록직원 (69+8)
      });
    }
  });

  return differences;
}

// 검수 완료 상태 업데이트
app.post('/api/inspection/complete', async (req, res) => {
  try {
    const { itemId, userId, status } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 검수결과 시트에 완료 상태 기록
    const completionData = [
      [
        new Date().toISOString(), // 완료일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        status || '완료',         // 상태
        '처리완료'                // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_RESULT_SHEET_NAME}!A:E`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: completionData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '검수 완료 상태가 업데이트되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating inspection completion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update inspection completion', 
      message: error.message 
    });
  }
});

// 정규화 데이터 저장
app.post('/api/inspection/normalize', async (req, res) => {
  try {
    const { itemId, userId, originalValue, normalizedValue, field } = req.body;
    
    if (!itemId || !userId || !normalizedValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID, User ID, and normalized value are required' 
      });
    }

    // 정규화이력 시트에 기록
    const normalizationData = [
      [
        new Date().toISOString(), // 정규화일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        field,                    // 필드명
        originalValue || '',      // 원본값
        normalizedValue,          // 정규화값
        '수동정규화'              // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NORMALIZATION_HISTORY_SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: normalizationData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '정규화 데이터가 저장되었습니다.' 
    });
  } catch (error) {
    console.error('Error saving normalization data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save normalization data', 
      message: error.message 
    });
  }
});

// 폰클개통데이터 수정 API
app.post('/api/inspection/update-system-data', async (req, res) => {
  try {
    const { itemId, userId, field, correctValue, systemRow } = req.body;
    
    if (!itemId || !userId || !field || !correctValue || systemRow === null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID, User ID, field, correct value, and system row are required' 
      });
    }

    // 필드명에 따른 컬럼 인덱스 매핑
    const fieldToColumnMap = {
      '이름': 1,      // B열
      '전화번호': 2,   // C열
      '주소': 3,      // D열
      '생년월일': 4,  // E열
      '성별': 5,      // F열
      // 더 많은 필드 매핑 추가 가능
    };

    const columnIndex = fieldToColumnMap[field];
    if (columnIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid field name' 
      });
    }

    // 폰클개통데이터 시트에서 해당 행의 특정 컬럼 수정
    const range = `${CURRENT_MONTH_ACTIVATION_SHEET_NAME}!${String.fromCharCode(65 + columnIndex)}${systemRow}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[correctValue]]
      }
    });

    // 수정 이력 시트에 기록
    const updateHistoryData = [
      [
        new Date().toISOString(), // 수정일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        field,                    // 필드명
        correctValue,             // 수정된 값
        '폰클개통데이터 수정'     // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_RESULT_SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: updateHistoryData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '폰클개통데이터가 성공적으로 수정되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating system data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update system data', 
      message: error.message 
    });
  }
});

// 사용 가능한 필드 목록 조회 API
app.get('/api/inspection/available-fields', async (req, res) => {
  try {
    const fields = COLUMN_MAPPINGS.map(mapping => ({
      key: mapping.key,
      name: mapping.name
    }));

    res.json({ 
      success: true, 
      fields 
    });
  } catch (error) {
    console.error('Error fetching available fields:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available fields', 
      message: error.message 
    });
  }
});

// 필드별 고유값 조회 API
app.get('/api/inspection/field-values', async (req, res) => {
  try {
    const { field } = req.query;
    
    if (!field) {
      return res.status(400).json({ 
        success: false, 
        error: 'Field name is required' 
      });
    }

    // 필드명에 따른 컬럼 인덱스 매핑
    const fieldMapping = COLUMN_MAPPINGS.find(mapping => mapping.name === field);
    if (!fieldMapping) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid field name' 
      });
    }

    const columnIndex = fieldMapping.manual;

    // 수기초와 폰클개통데이터에서 해당 필드의 모든 값 수집
    const [manualValues, systemValues] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME)
    ]);

    const allValues = new Set();

    // 수기초에서 값 수집
    if (manualValues && manualValues.length > 1) {
      manualValues.slice(1).forEach(row => {
        if (row.length > columnIndex && row[columnIndex]) {
          allValues.add(row[columnIndex].toString().trim());
        }
      });
    }

    // 폰클개통데이터에서 값 수집
    if (systemValues && systemValues.length > 1) {
      systemValues.slice(1).forEach(row => {
        if (row.length > columnIndex && row[columnIndex]) {
          allValues.add(row[columnIndex].toString().trim());
        }
      });
    }

    // 정규화 이력에서도 값 수집
    try {
      const normalizationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NORMALIZATION_HISTORY_SHEET_NAME}!A:G`
      });
      
      if (normalizationResponse.data.values && normalizationResponse.data.values.length > 1) {
        normalizationResponse.data.values.slice(1).forEach(row => {
          if (row.length >= 6 && row[3] === field && row[5]) { // 필드명이 일치하고 정규화값이 있는 경우
            allValues.add(row[5].toString().trim());
          }
        });
      }
    } catch (error) {
      // 정규화 이력 시트가 없거나 비어있는 경우 무시
      console.log('정규화 이력 시트가 없거나 비어있습니다.');
    }

    const uniqueValues = Array.from(allValues).filter(value => value).sort();

    res.json({ 
      success: true, 
      field,
      values: uniqueValues 
    });
  } catch (error) {
    console.error('Error fetching field values:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch field values', 
      message: error.message 
    });
  }
});

// 검수 완료 상태 조회
app.get('/api/inspection/completion-status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // 검수결과 시트에서 해당 사용자의 완료 항목 조회
    let completionData = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_RESULT_SHEET_NAME}!A:E`
      });
      completionData = response.data.values || [];
    } catch (error) {
      // 시트가 없거나 비어있는 경우 빈 배열 반환
      console.log('검수결과 시트가 없거나 비어있습니다.');
    }

    // 헤더 제거하고 해당 사용자의 완료 항목만 필터링
    const userCompletions = completionData
      .slice(1) // 헤더 제거
      .filter(row => row.length >= 3 && row[1] === userId) // 처리자 ID가 일치하는 항목
      .map(row => row[2]); // 항목 ID만 추출

    res.json({ 
      success: true, 
      completedItems: userCompletions 
    });
  } catch (error) {
    console.error('Error fetching completion status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch completion status', 
      message: error.message 
    });
  }
});

// 개인정보 보안 유틸리티 함수들
const securityUtils = {
  // 개인정보 마스킹 함수
  maskPersonalInfo: (value, type = 'default') => {
    if (!value || typeof value !== 'string') return value;
    
    const trimmed = value.toString().trim();
    if (!trimmed) return value;
    
    switch (type) {
      case 'name':
        // 이름: 첫 글자만 보이고 나머지는 *
        return trimmed.length > 1 ? trimmed[0] + '*'.repeat(trimmed.length - 1) : '*';
      
      case 'phone':
        // 전화번호: 앞 3자리와 뒤 4자리만 보이고 중간은 *
        if (trimmed.length >= 7) {
          return trimmed.substring(0, 3) + '*'.repeat(trimmed.length - 7) + trimmed.substring(trimmed.length - 4);
        }
        return '*'.repeat(trimmed.length);
      
      case 'address':
        // 주소: 시/도까지만 보이고 나머지는 *
        const addressParts = trimmed.split(' ');
        if (addressParts.length > 1) {
          return addressParts[0] + ' ' + '*'.repeat(trimmed.length - addressParts[0].length - 1);
        }
        return '*'.repeat(trimmed.length);
      
      case 'birthdate':
        // 생년월일: 년도만 보이고 월일은 *
        if (trimmed.length >= 4) {
          return trimmed.substring(0, 4) + '*'.repeat(trimmed.length - 4);
        }
        return '*'.repeat(trimmed.length);
      
      default:
        // 기본: 전체를 *로 마스킹
        return '*'.repeat(trimmed.length);
    }
  },
  
  // 개인정보 해시 함수 (간단한 해시)
  hashPersonalInfo: (value) => {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.toString().trim();
    if (!trimmed) return '';
    
    // 간단한 해시 함수 (실제 운영에서는 더 강력한 해시 사용 권장)
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash).toString(36);
  },
  
  // 안전한 데이터 구조 생성 (검수자는 실제 값 볼 수 있음)
  createSafeDataStructure: (differences) => {
    return differences.map(diff => {
      const safeDiff = {
        id: securityUtils.hashPersonalInfo(diff.key), // 개인정보 해시화
        type: diff.type,
        field: diff.field,
        fieldKey: diff.fieldKey,
        manualRow: diff.manualRow,
        systemRow: diff.systemRow,
        assignedAgent: diff.assignedAgent,
        // 검수자는 실제 값을 볼 수 있도록 원본 값 전송
        correctValue: diff.correctValue,
        incorrectValue: diff.incorrectValue,
        // 가입번호는 화면에 표시되어야 하므로 원본 값 유지
        originalKey: diff.key,
        // 중복 관련 정보 추가
        isDuplicate: diff.isDuplicate || false,
        duplicateType: diff.duplicateType || 'no_duplicate',
        duplicateInfo: diff.duplicateInfo || ''
      };
      
      return safeDiff;
    });
  }
};

// 필드 타입 판별 함수
function getFieldType(fieldKey) {
  const fieldTypeMap = {
    'name': 'name',
    'phone': 'phone', 
    'address': 'address',
    'birthdate': 'birthdate',
    'gender': 'default',
    'type': 'default',
    'model': 'default',
    'plan': 'default',
    'store': 'default'
  };
  return fieldTypeMap[fieldKey] || 'default';
}

// 개인정보 포함 캐시 TTL 단축 (보안 강화)
const SECURE_CACHE_TTL = 10 * 60 * 1000; // 10분 (검수 데이터는 자주 변경되지 않음)

// 검수 완료 상태 업데이트
app.post('/api/inspection/complete', async (req, res) => {
  try {
    const { itemId, userId, status } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 검수결과 시트에 완료 상태 기록
    const completionData = [
      [
        new Date().toISOString(), // 완료일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        status || '완료',         // 상태
        '처리완료'                // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_RESULT_SHEET_NAME}!A:E`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: completionData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '검수 완료 상태가 업데이트되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating inspection completion:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update inspection completion', 
      message: error.message 
    });
  }
});

// 정규화 데이터 저장
app.post('/api/inspection/normalize', async (req, res) => {
  try {
    const { itemId, userId, originalValue, normalizedValue, field } = req.body;
    
    if (!itemId || !userId || !normalizedValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID, User ID, and normalized value are required' 
      });
    }

    // 정규화이력 시트에 기록
    const normalizationData = [
      [
        new Date().toISOString(), // 정규화일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        field,                    // 필드명
        originalValue || '',      // 원본값
        normalizedValue,          // 정규화값
        '수동정규화'              // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NORMALIZATION_HISTORY_SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: normalizationData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '정규화 데이터가 저장되었습니다.' 
    });
  } catch (error) {
    console.error('Error saving normalization data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save normalization data', 
      message: error.message 
    });
  }
});

// 폰클개통데이터 수정 API
app.post('/api/inspection/update-system-data', async (req, res) => {
  try {
    const { itemId, userId, field, correctValue, systemRow } = req.body;
    
    if (!itemId || !userId || !field || !correctValue || systemRow === null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID, User ID, field, correct value, and system row are required' 
      });
    }

    // 필드명에 따른 컬럼 인덱스 매핑
    const fieldToColumnMap = {
      '이름': 1,      // B열
      '전화번호': 2,   // C열
      '주소': 3,      // D열
      '생년월일': 4,  // E열
      '성별': 5,      // F열
      // 더 많은 필드 매핑 추가 가능
    };

    const columnIndex = fieldToColumnMap[field];
    if (columnIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid field name' 
      });
    }

    // 폰클개통데이터 시트에서 해당 행의 특정 컬럼 수정
    const range = `${CURRENT_MONTH_ACTIVATION_SHEET_NAME}!${String.fromCharCode(65 + columnIndex)}${systemRow}`;
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[correctValue]]
      }
    });

    // 수정 이력 시트에 기록
    const updateHistoryData = [
      [
        new Date().toISOString(), // 수정일시
        userId,                   // 처리자
        itemId,                   // 항목 ID
        field,                    // 필드명
        correctValue,             // 수정된 값
        '폰클개통데이터 수정'     // 비고
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSPECTION_RESULT_SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: updateHistoryData
      }
    });

    // 캐시 무효화
    invalidateInspectionCache(userId);

    res.json({ 
      success: true, 
      message: '폰클개통데이터가 성공적으로 수정되었습니다.' 
    });
  } catch (error) {
    console.error('Error updating system data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update system data', 
      message: error.message 
    });
  }
});

// 사용 가능한 필드 목록 조회 API
app.get('/api/inspection/available-fields', async (req, res) => {
  try {
    const fields = COLUMN_MAPPINGS.map(mapping => ({
      key: mapping.key,
      name: mapping.name
    }));

    res.json({ 
      success: true, 
      fields 
    });
  } catch (error) {
    console.error('Error fetching available fields:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available fields', 
      message: error.message 
    });
  }
});

// 필드별 고유값 조회 API
app.get('/api/inspection/field-values', async (req, res) => {
  try {
    const { field } = req.query;
    
    if (!field) {
      return res.status(400).json({ 
        success: false, 
        error: 'Field name is required' 
      });
    }

    // 필드명에 따른 컬럼 인덱스 매핑
    const fieldMapping = COLUMN_MAPPINGS.find(mapping => mapping.name === field);
    if (!fieldMapping) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid field name' 
      });
    }

    const columnIndex = fieldMapping.manual;

    // 수기초와 폰클개통데이터에서 해당 필드의 모든 값 수집
    const [manualValues, systemValues] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME)
    ]);

    const allValues = new Set();

    // 수기초에서 값 수집
    if (manualValues && manualValues.length > 1) {
      manualValues.slice(1).forEach(row => {
        if (row.length > columnIndex && row[columnIndex]) {
          allValues.add(row[columnIndex].toString().trim());
        }
      });
    }

    // 폰클개통데이터에서 값 수집
    if (systemValues && systemValues.length > 1) {
      systemValues.slice(1).forEach(row => {
        if (row.length > columnIndex && row[columnIndex]) {
          allValues.add(row[columnIndex].toString().trim());
        }
      });
    }

    // 정규화 이력에서도 값 수집
    try {
      const normalizationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NORMALIZATION_HISTORY_SHEET_NAME}!A:G`
      });
      
      if (normalizationResponse.data.values && normalizationResponse.data.values.length > 1) {
        normalizationResponse.data.values.slice(1).forEach(row => {
          if (row.length >= 6 && row[3] === field && row[5]) { // 필드명이 일치하고 정규화값이 있는 경우
            allValues.add(row[5].toString().trim());
          }
        });
      }
    } catch (error) {
      // 정규화 이력 시트가 없거나 비어있는 경우 무시
      console.log('정규화 이력 시트가 없거나 비어있습니다.');
    }

    const uniqueValues = Array.from(allValues).filter(value => value).sort();

    res.json({ 
      success: true, 
      field,
      values: uniqueValues 
    });
  } catch (error) {
    console.error('Error fetching field values:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch field values', 
      message: error.message 
    });
  }
});

// 검수 완료 상태 조회
app.get('/api/inspection/completion-status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // 검수결과 시트에서 해당 사용자의 완료 항목 조회
    let completionData = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_RESULT_SHEET_NAME}!A:E`
      });
      completionData = response.data.values || [];
    } catch (error) {
      // 시트가 없거나 비어있는 경우 빈 배열 반환
      console.log('검수결과 시트가 없거나 비어있습니다.');
    }

    // 헤더 제거하고 해당 사용자의 완료 항목만 필터링
    const userCompletions = completionData
      .slice(1) // 헤더 제거
      .filter(row => row.length >= 3 && row[1] === userId) // 처리자 ID가 일치하는 항목
      .map(row => row[2]); // 항목 ID만 추출

    res.json({ 
      success: true, 
      completedItems: userCompletions 
    });
  } catch (error) {
    console.error('Error fetching completion status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch completion status', 
      message: error.message 
    });
  }
});

// 서버 시작 코드는 1866번째 줄에 이미 존재합니다.
// 중복된 서버 시작 코드 제거 

// 사전예약 설정 관련 API

// 사전예약사이트 모델/용량/색상 데이터 API
app.get('/api/reservation-settings/model-data', async (req, res) => {
  try {
    // 사전예약사이트 모델/용량/색상 데이터 요청
    
    // 캐시 키 생성
    const cacheKey = 'reservation_site_model_data';
    
    // 캐시에서 먼저 확인 (10분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      // 캐시된 사전예약사이트 모델 데이터 반환
      return res.json(cachedData);
    }
    
    // 사전예약사이트 시트에서 P, Q, R열 데이터 로드
    const reservationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '사전예약사이트!P:R'
    });
    
    if (!reservationResponse.data.values || reservationResponse.data.values.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    const rows = reservationResponse.data.values.slice(1); // 헤더 제거
    const models = new Set();
    const capacities = new Set();
    const colors = new Set();
    const modelCapacityColors = new Map();
    
    // 사전예약사이트 데이터 처리
    
    rows.forEach((row, index) => {
      if (row.length < 3) return;
      
      const model = (row[0] || '').toString().trim(); // P열: 모델
      const capacity = (row[1] || '').toString().trim(); // Q열: 용량
      const color = (row[2] || '').toString().trim(); // R열: 색상
      
      // 처음 10개 행의 데이터 확인
      if (index < 10) {
        console.log(`행 ${index + 1}: 모델="${model}", 용량="${capacity}", 색상="${color}"`);
      }
      
      if (model && capacity && color) {
        models.add(model);
        capacities.add(capacity);
        colors.add(color);
        
        // 모델별 용량-색상 조합 저장
        if (!modelCapacityColors.has(model)) {
          modelCapacityColors.set(model, new Map());
        }
        
        if (!modelCapacityColors.get(model).has(capacity)) {
          modelCapacityColors.get(model).set(capacity, new Set());
        }
        
        modelCapacityColors.get(model).get(capacity).add(color);
      }
    });
    
    // Map 객체를 일반 객체로 변환하여 JSON 직렬화 가능하게 만들기
    const modelCapacityColorsObj = {};
    Array.from(modelCapacityColors.entries()).forEach(([model, capacityMap]) => {
      modelCapacityColorsObj[model] = {};
      Array.from(capacityMap.entries()).forEach(([capacity, colorSet]) => {
        modelCapacityColorsObj[model][capacity] = Array.from(colorSet).sort();
      });
    });

    const result = {
      success: true,
      models: Array.from(models).sort(),
      capacities: Array.from(capacities).sort(),
      colors: Array.from(colors).sort(),
      modelCapacityColors: modelCapacityColorsObj,
      stats: {
        totalModels: models.size,
        totalCapacities: capacities.size,
        totalColors: colors.size,
        totalCombinations: Array.from(modelCapacityColors.values()).reduce((sum, capacityMap) => {
          return sum + Array.from(capacityMap.values()).reduce((sum2, colorSet) => sum2 + colorSet.size, 0);
        }, 0)
      }
    };
    
    // 사전예약사이트 모델 데이터 처리 완료
    
    // 결과 캐싱 (10분 TTL)
    cacheUtils.set(cacheKey, result, 600);
    
    res.json(result);
    
  } catch (error) {
    console.error('사전예약사이트 모델 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load reservation site model data',
      message: error.message
    });
  }
});

// 사전예약 설정 데이터 로드 API
app.get('/api/reservation-settings/data', async (req, res) => {
  try {
    // 사전예약사이트 시트에서 P, Q, R열 데이터 로드
    let reservationSiteData = { pColumn: [], qColumn: [], rColumn: [] };
    try {
      const reservationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트!P:R'
      });
      
      if (reservationResponse.data.values && reservationResponse.data.values.length > 1) {
        const rows = reservationResponse.data.values.slice(1); // 헤더 제거
        const pValues = new Set();
        const qValues = new Set();
        const rValues = new Set();
        
        rows.forEach(row => {
          if (row.length > 0 && row[0]) pValues.add(row[0].toString().trim());
          if (row.length > 1 && row[1]) qValues.add(row[1].toString().trim());
          if (row.length > 2 && row[2]) rValues.add(row[2].toString().trim());
        });
        
        reservationSiteData = {
          pColumn: Array.from(pValues).filter(v => v).sort(),
          qColumn: Array.from(qValues).filter(v => v).sort(),
          rColumn: Array.from(rValues).filter(v => v).sort()
        };
      }
    } catch (error) {
      // 사전예약사이트 시트 로드 실패
    }

    // 폰클재고데이터 시트에서 F, G열 데이터 로드
    let phoneklData = { fColumn: [], gColumn: [] };
    try {
      const phoneklResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '폰클재고데이터!F:G'
      });
      
      if (phoneklResponse.data.values && phoneklResponse.data.values.length > 1) {
        const rows = phoneklResponse.data.values.slice(1); // 헤더 제거
        const fValues = new Set();
        const gValues = new Set();
        
        rows.forEach(row => {
          if (row.length > 0 && row[0]) fValues.add(row[0].toString().trim());
          if (row.length > 1 && row[1]) gValues.add(row[1].toString().trim());
        });
        
        phoneklData = {
          fColumn: Array.from(fValues).filter(v => v).sort(),
          gColumn: Array.from(gValues).filter(v => v).sort()
        };
      }
    } catch (error) {
      console.log('폰클재고데이터 시트 로드 실패:', error.message);
    }

    res.json({
      success: true,
      reservationSite: reservationSiteData,
      phonekl: phoneklData
    });
  } catch (error) {
    console.error('사전예약 설정 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load reservation settings data',
      message: error.message
    });
  }
});

// 배정 상태 메모리 저장소 (서버 재시작 시 초기화됨)
const assignmentMemory = new Map(); // key: reservationNumber, value: { serialNumber, timestamp }

// 배정 상태 저장 API
app.post('/api/reservation/save-assignment-memory', async (req, res) => {
  try {
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      throw new Error('배정 데이터가 올바르지 않습니다.');
    }
    
    // 메모리에 배정 상태 저장
    assignments.forEach(assignment => {
      if (assignment.reservationNumber && assignment.assignedSerialNumber) {
        assignmentMemory.set(assignment.reservationNumber, {
          serialNumber: assignment.assignedSerialNumber,
          timestamp: Date.now()
        });
      }
    });
    
    console.log(`💾 [배정메모리] ${assignments.length}개 배정 상태 저장됨`);
    
    res.json({
      success: true,
      message: `${assignments.length}개 배정 상태가 메모리에 저장되었습니다.`,
      memorySize: assignmentMemory.size
    });
    
  } catch (error) {
    console.error('❌ [배정메모리] 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: '배정 상태 저장 실패',
      message: error.message
    });
  }
});

// 배정 상태 조회 API
app.get('/api/reservation/assignment-memory', async (req, res) => {
  try {
    const memoryData = Array.from(assignmentMemory.entries()).map(([reservationNumber, data]) => ({
      reservationNumber,
      serialNumber: data.serialNumber,
      timestamp: data.timestamp
    }));
    
    res.json({
      success: true,
      memorySize: assignmentMemory.size,
      data: memoryData
    });
    
  } catch (error) {
    console.error('❌ [배정메모리] 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '배정 상태 조회 실패',
      message: error.message
    });
  }
});

// 배정 상태 변경 감지 API OPTIONS 요청 처리
app.options('/api/reservation/assignment-changes', (req, res) => {
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// 배정 상태 변경 감지 API (실시간 업데이트용 - 최적화)
app.get('/api/reservation/assignment-changes', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    const { lastCheck } = req.query;
    const lastCheckTime = lastCheck ? new Date(parseInt(lastCheck)) : new Date(0);
    
    console.log(`🔍 [실시간감지] 배정 상태 변경 확인: ${lastCheckTime.toISOString()}`);
    
    // 캐시 키 생성
    const cacheKey = 'assignment_changes_check';
    
    // 캐시에서 먼저 확인 (2분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData && cachedData.lastCheckTime > lastCheckTime.getTime()) {
      console.log('📋 [실시간감지] 캐시된 결과 반환');
      return res.json(cachedData);
    }
    
    // 배정 상태 계산 API 호출
    const assignmentResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
    
    if (!assignmentResponse.ok) {
      throw new Error('배정 상태를 가져올 수 없습니다.');
    }
    
    const assignmentResult = await assignmentResponse.json();
    
    if (!assignmentResult.success) {
      throw new Error('배정 상태 데이터가 올바르지 않습니다.');
    }
    
    // 실제 변경사항만 필터링 (배정완료된 항목 중에서 최근에 변경된 것만)
    const currentTime = Date.now();
    
    // Google Sheets의 수정 시간을 확인하여 실제 변경사항만 감지
    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
      
      if (spreadsheetId) {
        const metadataResponse = await sheets.spreadsheets.get({
          spreadsheetId,
          ranges: ['사전예약사이트!G:G'], // 배정일련번호 열만 확인
          fields: 'sheets.properties.sheetId,sheets.properties.title,sheets.properties.updated'
        });
        
        const sheetUpdated = metadataResponse.data.sheets?.[0]?.properties?.updated;
        if (sheetUpdated) {
          const sheetUpdateTime = new Date(sheetUpdated).getTime();
          
          // 시트가 마지막 체크 시간 이후에 업데이트되지 않았다면 변경사항 없음
          if (sheetUpdateTime <= lastCheckTime.getTime()) {
            console.log('📋 [실시간감지] 시트 업데이트 없음 - 변경사항 없음');
            const responseData = {
              success: true,
              hasChanges: false,
              changeCount: 0,
              lastCheckTime: new Date().toISOString(),
              changes: []
            };
            cacheUtils.set(cacheKey, responseData, 2 * 60 * 1000);
            return res.json(responseData);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ [실시간감지] 시트 메타데이터 확인 실패, 기본 로직 사용:', error.message);
    }
    
    // 시트 메타데이터 확인이 실패한 경우 기본 로직 사용
    const recentChanges = assignmentResult.data.filter(item => {
      // 배정완료된 항목만 확인
      return item.assignmentStatus === '배정완료' && item.assignedSerialNumber;
    });
    
    const hasChanges = recentChanges.length > 0;
    
    console.log(`🔍 [실시간감지] 변경사항 발견: ${hasChanges ? '있음' : '없음'} (${recentChanges.length}개)`);
    
    const responseData = {
      success: true,
      hasChanges,
      changeCount: recentChanges.length,
      lastCheckTime: new Date().toISOString(),
      changes: hasChanges ? recentChanges.slice(0, 10) : [] // 최대 10개만 반환
    };
    
    // 결과 캐싱 (2분 TTL)
    cacheUtils.set(cacheKey, responseData, 2 * 60 * 1000);
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ [실시간감지] 오류:', error);
    res.status(500).json({
      success: false,
      error: '배정 상태 변경 감지 실패',
      message: error.message
    });
  }
});



// 사전예약 재고 현황 API
app.get('/api/reservation-inventory-status', async (req, res) => {
  try {
    console.log('🔍 [사전예약재고] 사전예약 재고 현황 요청');
    
    // 폰클재고데이터에서 재고 정보 수집
    const inventoryValues = await getSheetValues('폰클재고데이터');
    
    if (!inventoryValues || inventoryValues.length < 4) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    console.log(`📊 [사전예약재고] 폰클재고데이터 로드 완료: ${inventoryValues.length}행`);
    
    // 사무실별 재고 카운팅
    const officeInventory = {
      '평택사무실': {},
      '인천사무실': {},
      '군산사무실': {},
      '안산사무실': {}
    };
    
    let processedCount = 0;
    let totalCount = 0;
    
    // 3행 헤더를 제외하고 데이터 처리 (4행부터 시작)
    inventoryValues.slice(3).forEach((row, index) => {
      if (row.length >= 14) {
        totalCount++;
        const model = (row[5] || '').toString().trim(); // F열: 모델명
        const color = (row[6] || '').toString().trim(); // G열: 색상
        const status = (row[7] || '').toString().trim(); // H열: 상태
        const storeName = (row[13] || '').toString().trim(); // N열: 출고처(사무실명)
        
        // 정상 상태이고 모델, 색상, 사무실명이 있는 경우만 처리
        if (model && color && storeName && status === '정상') {
          const combinedModel = `${model} | ${color}`;
          
          // 사무실명 추출
          let officeName = '';
          if (storeName.includes('평택사무실')) {
            officeName = '평택사무실';
          } else if (storeName.includes('인천사무실')) {
            officeName = '인천사무실';
          } else if (storeName.includes('군산사무실')) {
            officeName = '군산사무실';
          } else if (storeName.includes('안산사무실')) {
            officeName = '안산사무실';
          }
          
          if (officeName && officeInventory[officeName]) {
            if (!officeInventory[officeName][combinedModel]) {
              officeInventory[officeName][combinedModel] = 0;
            }
            officeInventory[officeName][combinedModel]++;
            processedCount++;
          }
        }
      }
    });
    
    console.log(`📊 [사전예약재고] 총 데이터: ${totalCount}개, 처리된 재고: ${processedCount}개`);
    
    // 통계 계산
    const stats = {
      totalInventory: 0,
      officeStats: {},
      processedCount,
      totalCount
    };
    
    Object.entries(officeInventory).forEach(([officeName, inventory]) => {
      const officeTotal = Object.values(inventory).reduce((sum, count) => sum + count, 0);
      const modelCount = Object.keys(inventory).length;
      
      stats.officeStats[officeName] = {
        totalInventory: officeTotal,
        modelCount: modelCount
      };
      
      stats.totalInventory += officeTotal;
    });
    
    const result = {
      success: true,
      officeInventory,
      stats,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('✅ [사전예약재고] 처리 완료:', stats);
    res.json(result);
    
  } catch (error) {
    console.error('❌ [사전예약재고] 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '사전예약 재고 조회 실패',
      message: error.message
    });
  }
});

// 미매칭 고객 확인 API
app.get('/api/unmatched-customers', async (req, res) => {
  try {
    console.log('🔍 [미매칭고객] 미매칭 고객 확인 요청');
    
    // 사전예약사이트 데이터 로드 (기준 데이터)
    const reservationData = await getSheetValues('사전예약사이트');
    if (!reservationData || reservationData.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    // 사전예약사이트의 고유 식별자 추출 (예약번호 또는 전화번호)
    const reservationIds = new Set();
    reservationData.slice(1).forEach(row => {
      if (row.length >= 3) {
        const reservationNumber = (row[2] || '').toString().trim(); // C열: 예약번호
        const phoneNumber = (row[3] || '').toString().trim(); // D열: 전화번호
        if (reservationNumber) reservationIds.add(reservationNumber);
        if (phoneNumber) reservationIds.add(phoneNumber);
      }
    });
    
    console.log(`📋 [미매칭고객] 사전예약사이트 기준 ID: ${reservationIds.size}개`);
    
    // 각 시트별 데이터 로드 및 미매칭 찾기
    const unmatchedData = {
      yard: [],
      onSale: [],
      mobile: []
    };
    
    // 1. 마당접수 미매칭 확인
    try {
      console.log('🔄 [미매칭고객] 마당접수 데이터 로드 중...');
      const yardData = await getSheetValues('마당접수');
      console.log(`📋 [미매칭고객] 마당접수 데이터 로드 완료: ${yardData ? yardData.length : 0}행`);
      
      if (yardData && yardData.length > 1) {
        yardData.slice(1).forEach(row => {
          if (row.length >= 3) {
            const customerName = (row[1] || '').toString().trim(); // B열: 고객명
            const phoneNumber = (row[2] || '').toString().trim(); // C열: 전화번호
            const receptionDate = (row[3] || '').toString().trim(); // D열: 접수일
            const model = (row[4] || '').toString().trim(); // E열: 모델
            const memo = (row[5] || '').toString().trim(); // F열: 메모
            
            // 사전예약사이트에 없는 고객만 추가
            if (customerName && phoneNumber && !reservationIds.has(phoneNumber)) {
              unmatchedData.yard.push({
                customerName,
                phoneNumber,
                receptionDate,
                model,
                memo
              });
            }
          }
        });
        console.log(`✅ [미매칭고객] 마당접수 미매칭: ${unmatchedData.yard.length}건`);
      } else {
        console.log('⚠️ [미매칭고객] 마당접수 데이터가 없거나 헤더만 존재');
      }
    } catch (error) {
      console.error('❌ [미매칭고객] 마당접수 데이터 로드 오류:', error);
      // 오류가 발생해도 다른 시트는 계속 처리
    }
    
    // 2. 온세일 미매칭 확인
    try {
      console.log('🔄 [미매칭고객] 온세일 데이터 로드 중...');
      const onSaleData = await getSheetValues('온세일');
      console.log(`📋 [미매칭고객] 온세일 데이터 로드 완료: ${onSaleData ? onSaleData.length : 0}행`);
      
      if (onSaleData && onSaleData.length > 1) {
        onSaleData.slice(1).forEach(row => {
          if (row.length >= 3) {
            const customerName = (row[1] || '').toString().trim(); // B열: 고객명
            const phoneNumber = (row[2] || '').toString().trim(); // C열: 전화번호
            const receptionDate = (row[3] || '').toString().trim(); // D열: 접수일
            const model = (row[4] || '').toString().trim(); // E열: 모델
            const memo = (row[5] || '').toString().trim(); // F열: 메모
            
            // 사전예약사이트에 없는 고객만 추가
            if (customerName && phoneNumber && !reservationIds.has(phoneNumber)) {
              unmatchedData.onSale.push({
                customerName,
                phoneNumber,
                receptionDate,
                model,
                memo
              });
            }
          }
        });
        console.log(`✅ [미매칭고객] 온세일 미매칭: ${unmatchedData.onSale.length}건`);
      } else {
        console.log('⚠️ [미매칭고객] 온세일 데이터가 없거나 헤더만 존재');
      }
    } catch (error) {
      console.error('❌ [미매칭고객] 온세일 데이터 로드 오류:', error);
      // 오류가 발생해도 다른 시트는 계속 처리
    }
    
    // 3. 모바일가입내역 미매칭 확인
    try {
      console.log('🔄 [미매칭고객] 모바일가입내역 데이터 로드 중...');
      const mobileData = await getSheetValues('모바일가입내역');
      console.log(`📋 [미매칭고객] 모바일가입내역 데이터 로드 완료: ${mobileData ? mobileData.length : 0}행`);
      
      if (mobileData && mobileData.length > 1) {
        mobileData.slice(1).forEach(row => {
          if (row.length >= 3) {
            const customerName = (row[1] || '').toString().trim(); // B열: 고객명
            const phoneNumber = (row[2] || '').toString().trim(); // C열: 전화번호
            const joinDate = (row[3] || '').toString().trim(); // D열: 가입일
            const model = (row[4] || '').toString().trim(); // E열: 모델
            const memo = (row[5] || '').toString().trim(); // F열: 메모
            
            // 사전예약사이트에 없는 고객만 추가
            if (customerName && phoneNumber && !reservationIds.has(phoneNumber)) {
              unmatchedData.mobile.push({
                customerName,
                phoneNumber,
                joinDate,
                model,
                memo
              });
            }
          }
        });
        console.log(`✅ [미매칭고객] 모바일가입내역 미매칭: ${unmatchedData.mobile.length}건`);
      } else {
        console.log('⚠️ [미매칭고객] 모바일가입내역 데이터가 없거나 헤더만 존재');
      }
    } catch (error) {
      console.error('❌ [미매칭고객] 모바일가입내역 데이터 로드 오류:', error);
      // 오류가 발생해도 다른 시트는 계속 처리
    }
    
    const totalUnmatched = unmatchedData.yard.length + unmatchedData.onSale.length + unmatchedData.mobile.length;
    
    console.log(`📊 [미매칭고객] 미매칭 현황: 마당접수 ${unmatchedData.yard.length}건, 온세일 ${unmatchedData.onSale.length}건, 모바일가입내역 ${unmatchedData.mobile.length}건 (총 ${totalUnmatched}건)`);
    
    const result = {
      success: true,
      data: unmatchedData,
      stats: {
        totalUnmatched,
        yardCount: unmatchedData.yard.length,
        onSaleCount: unmatchedData.onSale.length,
        mobileCount: unmatchedData.mobile.length,
        reservationBaseCount: reservationIds.size
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [미매칭고객] 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '미매칭 고객 조회 실패',
      message: error.message
    });
  }
});

// 미매칭 고객 엑셀 다운로드 API
app.get('/api/unmatched-customers/excel', async (req, res) => {
  try {
    console.log('📊 [미매칭고객] 엑셀 다운로드 요청');
    
    // 사전예약사이트 데이터 로드 (기준 데이터)
    const reservationData = await getSheetValues('사전예약사이트');
    if (!reservationData || reservationData.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    // 사전예약사이트의 고유 식별자 추출 (예약번호 또는 전화번호)
    const reservationIds = new Set();
    reservationData.slice(1).forEach(row => {
      if (row.length >= 3) {
        const reservationNumber = (row[2] || '').toString().trim(); // C열: 예약번호
        const phoneNumber = (row[3] || '').toString().trim(); // D열: 전화번호
        if (reservationNumber) reservationIds.add(reservationNumber);
        if (phoneNumber) reservationIds.add(phoneNumber);
      }
    });
    
    console.log(`📋 [미매칭고객] 사전예약사이트 기준 ID: ${reservationIds.size}개`);
    
    // 각 시트별 데이터 로드 및 미매칭 찾기
    const unmatchedData = {
      yard: [],
      onSale: [],
      mobile: []
    };
    
    // 1. 마당접수 미매칭 확인
    try {
      const yardData = await getSheetValues('마당접수');
      if (yardData && yardData.length > 1) {
        yardData.slice(1).forEach(row => {
          if (row.length >= 3) {
            const customerName = (row[1] || '').toString().trim(); // B열: 고객명
            const phoneNumber = (row[2] || '').toString().trim(); // C열: 전화번호
            const receptionDate = (row[3] || '').toString().trim(); // D열: 접수일
            const model = (row[4] || '').toString().trim(); // E열: 모델
            const memo = (row[5] || '').toString().trim(); // F열: 메모
            
            // 사전예약사이트에 없는 고객만 추가
            if (customerName && phoneNumber && !reservationIds.has(phoneNumber)) {
              unmatchedData.yard.push({
                customerName,
                phoneNumber,
                receptionDate,
                model,
                memo
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('마당접수 데이터 로드 오류:', error);
    }
    
    // 2. 온세일 미매칭 확인
    try {
      const onSaleData = await getSheetValues('온세일');
      if (onSaleData && onSaleData.length > 1) {
        onSaleData.slice(1).forEach(row => {
          if (row.length >= 3) {
            const customerName = (row[1] || '').toString().trim(); // B열: 고객명
            const phoneNumber = (row[2] || '').toString().trim(); // C열: 전화번호
            const receptionDate = (row[3] || '').toString().trim(); // D열: 접수일
            const model = (row[4] || '').toString().trim(); // E열: 모델
            const memo = (row[5] || '').toString().trim(); // F열: 메모
            
            // 사전예약사이트에 없는 고객만 추가
            if (customerName && phoneNumber && !reservationIds.has(phoneNumber)) {
              unmatchedData.onSale.push({
                customerName,
                phoneNumber,
                receptionDate,
                model,
                memo
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('온세일 데이터 로드 오류:', error);
    }
    
    // 3. 모바일가입내역 미매칭 확인
    try {
      const mobileData = await getSheetValues('모바일가입내역');
      if (mobileData && mobileData.length > 1) {
        mobileData.slice(1).forEach(row => {
          if (row.length >= 3) {
            const customerName = (row[1] || '').toString().trim(); // B열: 고객명
            const phoneNumber = (row[2] || '').toString().trim(); // C열: 전화번호
            const joinDate = (row[3] || '').toString().trim(); // D열: 가입일
            const model = (row[4] || '').toString().trim(); // E열: 모델
            const memo = (row[5] || '').toString().trim(); // F열: 메모
            
            // 사전예약사이트에 없는 고객만 추가
            if (customerName && phoneNumber && !reservationIds.has(phoneNumber)) {
              unmatchedData.mobile.push({
                customerName,
                phoneNumber,
                joinDate,
                model,
                memo
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('모바일가입내역 데이터 로드 오류:', error);
    }
    
    // Excel 파일 생성
    const workbook = new ExcelJS.Workbook();
    const dateStr = new Date().toISOString().split('T')[0];
    workbook.creator = 'VIP Plus';
    workbook.lastModifiedBy = 'VIP Plus';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // 1. 마당접수 미매칭 시트
    const yardSheet = workbook.addWorksheet('마당접수미매칭');
    yardSheet.columns = [
      { header: '고객명', key: 'customerName', width: 15 },
      { header: '전화번호', key: 'phoneNumber', width: 15 },
      { header: '접수일', key: 'receptionDate', width: 12 },
      { header: '모델', key: 'model', width: 20 },
      { header: '메모', key: 'memo', width: 30 }
    ];
    
    unmatchedData.yard.forEach(item => {
      yardSheet.addRow(item);
    });
    
    // 2. 온세일 미매칭 시트
    const onSaleSheet = workbook.addWorksheet('온세일미매칭');
    onSaleSheet.columns = [
      { header: '고객명', key: 'customerName', width: 15 },
      { header: '전화번호', key: 'phoneNumber', width: 15 },
      { header: '접수일', key: 'receptionDate', width: 12 },
      { header: '모델', key: 'model', width: 20 },
      { header: '메모', key: 'memo', width: 30 }
    ];
    
    unmatchedData.onSale.forEach(item => {
      onSaleSheet.addRow(item);
    });
    
    // 3. 모바일가입내역 미매칭 시트
    const mobileSheet = workbook.addWorksheet('모바일가입내역미매칭');
    mobileSheet.columns = [
      { header: '고객명', key: 'customerName', width: 15 },
      { header: '전화번호', key: 'phoneNumber', width: 15 },
      { header: '가입일', key: 'joinDate', width: 12 },
      { header: '모델', key: 'model', width: 20 },
      { header: '메모', key: 'memo', width: 30 }
    ];
    
    unmatchedData.mobile.forEach(item => {
      mobileSheet.addRow(item);
    });
    
    // 4. 요약 시트
    const summarySheet = workbook.addWorksheet('요약');
    summarySheet.columns = [
      { header: '구분', key: 'category', width: 20 },
      { header: '미매칭 건수', key: 'count', width: 15 },
      { header: '비고', key: 'note', width: 30 }
    ];
    
    summarySheet.addRow({ category: '마당접수 미매칭', count: unmatchedData.yard.length, note: '사전예약사이트에 없는 고객' });
    summarySheet.addRow({ category: '온세일 미매칭', count: unmatchedData.onSale.length, note: '사전예약사이트에 없는 고객' });
    summarySheet.addRow({ category: '모바일가입내역 미매칭', count: unmatchedData.mobile.length, note: '사전예약사이트에 없는 고객' });
    summarySheet.addRow({ category: '총 미매칭 건수', count: unmatchedData.yard.length + unmatchedData.onSale.length + unmatchedData.mobile.length, note: '전체 미매칭 합계' });
    summarySheet.addRow({ category: '사전예약사이트 기준', count: reservationIds.size, note: '매칭 기준이 되는 고객 수' });
    
    // 스타일 적용
    [yardSheet, onSaleSheet, mobileSheet, summarySheet].forEach(sheet => {
      // 헤더 스타일
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // 테두리 스타일
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
    });
    
    // 파일 생성
    const buffer = await workbook.xlsx.writeBuffer();
    
    // 응답 헤더 설정
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = `unmatched_customers_${dateStr}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(`미매칭고객현황_${dateStr}.xlsx`)}`);
    
    console.log(`📊 [미매칭고객] 엑셀 파일 생성 완료: 마당접수 ${unmatchedData.yard.length}건, 온세일 ${unmatchedData.onSale.length}건, 모바일가입내역 ${unmatchedData.mobile.length}건`);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ [미매칭고객] 엑셀 다운로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '엑셀 파일 생성 실패',
      message: error.message
    });
  }
});

// 취소 체크 데이터 저장 API
app.post('/api/cancel-check/save', async (req, res) => {
  try {
    console.log('📝 [취소체크] 취소 체크 데이터 저장 요청:', req.body);
    
    // Google Sheets API 인증 및 sheets 객체 생성
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const { reservationNumbers } = req.body;
    
    if (!Array.isArray(reservationNumbers)) {
      return res.status(400).json({
        success: false,
        error: '예약번호 배열이 필요합니다.'
      });
    }

    // 기존 취소 데이터 로드 (캐시 무시)
    let existingData = [];
    let hasHeader = false;
    try {
      const currentData = await getSheetValuesWithoutCache('사전예약사이트취소데이터');
      console.log(`📝 [취소체크] 시트에서 직접 로드한 데이터: ${currentData ? currentData.length : 0}행`);
      if (currentData && currentData.length > 0) {
        // 헤더 확인 (예약번호, 등록일시, 상태)
        const firstRow = currentData[0];
        if (firstRow && firstRow.length >= 3 && 
            firstRow[0] === '예약번호' && 
            firstRow[1] === '등록일시' && 
            firstRow[2] === '상태') {
          hasHeader = true;
          if (currentData.length > 1) {
            existingData = currentData.slice(1); // 헤더 제외
          }
        } else {
          // 헤더가 없으면 모든 데이터를 기존 데이터로 처리
          existingData = currentData;
        }
      }
    } catch (error) {
      console.log('기존 취소 데이터가 없습니다. 새로 생성합니다.');
    }

    // 새로운 취소 데이터 추가
    const newCancelData = reservationNumbers.map(reservationNumber => [
      reservationNumber,
      new Date().toISOString(),
      '취소체크'
    ]);

    // 중복 제거 (예약번호 기준)
    const existingReservationNumbers = new Set(existingData.map(row => row[0]));
    const uniqueNewData = newCancelData.filter(row => !existingReservationNumbers.has(row[0]));

    console.log(`📝 [취소체크] 기존 예약번호: ${Array.from(existingReservationNumbers).join(', ')}`);
    console.log(`📝 [취소체크] 새 예약번호: ${reservationNumbers.join(', ')}`);
    console.log(`📝 [취소체크] 중복 제거 후 저장할 데이터: ${uniqueNewData.length}건`);

    if (uniqueNewData.length === 0) {
      console.log('📝 [취소체크] 이미 체크된 예약번호들입니다.');
      return res.json({
        success: true,
        message: '이미 체크된 예약번호들입니다.',
        savedCount: 0
      });
    }

    // 헤더가 없으면 먼저 헤더 추가
    if (!hasHeader) {
      console.log('📝 [취소체크] 헤더가 없습니다. 헤더를 추가합니다.');
      const headerRow = [['예약번호', '등록일시', '상태']];
      
      // 시트를 완전히 비우고 헤더 추가
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트취소데이터'
      });
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트취소데이터!A1:C1',
        valueInputOption: 'RAW',
        resource: {
          values: headerRow
        }
      });
      
      console.log('📝 [취소체크] 헤더 추가 완료');
    }

    // Google Sheets에 데이터 추가 (헤더가 있으면 append, 없으면 update)
    let response;
    if (hasHeader) {
      // 헤더가 있으면 append 사용
      response = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트취소데이터!A:C',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: uniqueNewData
        }
      });
    } else {
      // 헤더가 없었으면 헤더와 데이터를 함께 update
      const allData = [['예약번호', '등록일시', '상태'], ...uniqueNewData];
      response = await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트취소데이터!A:C',
        valueInputOption: 'RAW',
        resource: {
          values: allData
        }
      });
    }

    console.log(`📝 [취소체크] 취소 데이터 저장 완료: ${uniqueNewData.length}건`);

    res.json({
      success: true,
      message: '취소 체크 데이터가 저장되었습니다.',
      savedCount: uniqueNewData.length,
      data: response.data
    });

  } catch (error) {
    console.error('❌ [취소체크] 저장 오류:', error);
    console.error('❌ [취소체크] 에러 스택:', error.stack);
    res.status(500).json({
      success: false,
      error: '취소 체크 데이터 저장 실패',
      message: error.message,
      stack: error.stack
    });
  }
});

// 취소 체크 데이터 조회 API
app.get('/api/cancel-check/list', async (req, res) => {
  try {
    console.log('📋 [취소체크] 취소 체크 데이터 조회 요청');
    
    const cancelData = await getSheetValuesWithoutCache('사전예약사이트취소데이터');
    console.log(`📋 [취소체크] 시트에서 직접 로드한 데이터: ${cancelData ? cancelData.length : 0}행`);
    
    if (!cancelData || cancelData.length <= 1) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // 헤더 확인 및 데이터 추출
    const firstRow = cancelData[0];
    let dataRows;
    
    if (firstRow && firstRow.length >= 3 && 
        firstRow[0] === '예약번호' && 
        firstRow[1] === '등록일시' && 
        firstRow[2] === '상태') {
      // 헤더가 있으면 헤더 제외
      dataRows = cancelData.slice(1);
    } else {
      // 헤더가 없으면 모든 데이터 사용
      dataRows = cancelData;
    }
    
    const cancelReservationNumbers = dataRows.map(row => row[0]); // 예약번호만 추출

    console.log(`📋 [취소체크] 취소 체크 데이터 조회 완료: ${cancelReservationNumbers.length}건`);

    res.json({
      success: true,
      data: cancelReservationNumbers,
      count: cancelReservationNumbers.length
    });

  } catch (error) {
    console.error('❌ [취소체크] 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '취소 체크 데이터 조회 실패',
      message: error.message
    });
  }
});

// 취소 체크 데이터 삭제 API
app.delete('/api/cancel-check/delete', async (req, res) => {
  try {
    console.log('🗑️ [취소체크] 취소 체크 데이터 삭제 요청 시작');
    console.log('🗑️ [취소체크] 요청 body:', req.body);
    console.log('🗑️ [취소체크] 요청 headers:', req.headers);
    
    // Google Sheets API 인증 및 sheets 객체 생성
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const { reservationNumbers } = req.body || {};
    
    if (!Array.isArray(reservationNumbers)) {
      return res.status(400).json({
        success: false,
        error: '예약번호 배열이 필요합니다.'
      });
    }

    if (reservationNumbers.length === 0) {
      return res.json({
        success: true,
        message: '삭제할 데이터가 없습니다.',
        deletedCount: 0
      });
    }

    console.log(`🗑️ [취소체크] 삭제 대상 예약번호: ${reservationNumbers.join(', ')}`);

    // 현재 취소 데이터 로드 (캐시 무시)
    const currentData = await getSheetValuesWithoutCache('사전예약사이트취소데이터');
    console.log(`🗑️ [취소체크] 시트에서 직접 로드한 데이터: ${currentData ? currentData.length : 0}행`);
    
    if (!currentData || currentData.length === 0) {
      console.log('🗑️ [취소체크] 삭제할 데이터가 없습니다 (시트가 비어있음)');
      return res.json({
        success: true,
        message: '삭제할 데이터가 없습니다.',
        deletedCount: 0
      });
    }

    console.log(`🗑️ [취소체크] 현재 시트 데이터: ${currentData.length}행`);

    // 헤더 확인 및 처리
    let header, dataRows;
    const firstRow = currentData[0];
    
    if (firstRow && firstRow.length >= 3 && 
        firstRow[0] === '예약번호' && 
        firstRow[1] === '등록일시' && 
        firstRow[2] === '상태') {
      // 헤더가 있음
      header = firstRow;
      dataRows = currentData.slice(1);
    } else {
      // 헤더가 없음 - 헤더 추가
      header = ['예약번호', '등록일시', '상태'];
      dataRows = currentData;
    }
    
    console.log(`🗑️ [취소체크] 기존 데이터 행: ${dataRows.length}개`);
    console.log(`🗑️ [취소체크] 기존 예약번호들: ${dataRows.map(row => row[0]).join(', ')}`);
    
    const filteredData = dataRows.filter(row => {
      const reservationNumber = row[0];
      const shouldKeep = !reservationNumbers.includes(reservationNumber);
      if (!shouldKeep) {
        console.log(`🗑️ [취소체크] 삭제 대상 발견: ${reservationNumber}`);
      }
      return shouldKeep;
    });

    const deletedCount = dataRows.length - filteredData.length;
    
    console.log(`🗑️ [취소체크] 필터링 후 데이터: ${filteredData.length}개, 삭제 예정: ${deletedCount}개`);
    
    if (deletedCount === 0) {
      console.log('🗑️ [취소체크] 삭제할 데이터가 없습니다 (매칭되는 예약번호 없음)');
      return res.json({
        success: true,
        message: '삭제할 데이터가 없습니다.',
        deletedCount: 0
      });
    }

    // 전체 데이터를 새로 쓰기 (헤더 + 필터링된 데이터)
    const newData = [header, ...filteredData];
    
    console.log(`🗑️ [취소체크] 삭제 전 데이터: ${dataRows.length}건, 삭제 후 데이터: ${filteredData.length}건`);
    console.log(`🗑️ [취소체크] 새 데이터 구조:`, newData);
    
    let sheetResponse;
    try {
      // 먼저 시트를 완전히 비우고 새 데이터로 업데이트
      console.log('🗑️ [취소체크] 시트 초기화 시작...');
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트취소데이터'
      });
      console.log('🗑️ [취소체크] 시트 초기화 완료');
      
      console.log('🗑️ [취소체크] 새 데이터 쓰기 시작...');
      sheetResponse = await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트취소데이터!A:C',
        valueInputOption: 'RAW',
        resource: {
          values: newData
        }
      });
      console.log('🗑️ [취소체크] 새 데이터 쓰기 완료:', sheetResponse.data);

      console.log(`🗑️ [취소체크] 취소 데이터 삭제 완료: ${deletedCount}건`);
    } catch (sheetError) {
      console.error('🗑️ [취소체크] 시트 작업 중 오류:', sheetError);
      throw sheetError;
    }

    res.json({
      success: true,
      message: '취소 체크 데이터가 삭제되었습니다.',
      deletedCount,
      data: sheetResponse.data
    });

  } catch (error) {
    console.error('❌ [취소체크] 삭제 오류:', error);
    console.error('❌ [취소체크] 에러 스택:', error.stack);
    res.status(500).json({
      success: false,
      error: '취소 체크 데이터 삭제 실패',
      message: error.message,
      stack: error.stack
    });
  }
});

// 사무실별 보유재고 현황 API (정규화작업시트 C열 필터링 적용)
app.get('/api/office-inventory', async (req, res) => {
  try {
    console.log('🔍 [사무실재고] 사무실별 보유재고 현황 요청');
    
    // 정규화작업시트에서 허용된 모델 목록 가져오기
    const normalizedValues = await getSheetValues('정규화작업');
    const allowedModels = new Set();
    
    if (normalizedValues && normalizedValues.length > 1) {
      // C열(인덱스 2)에서 허용된 모델명 추출
      normalizedValues.slice(1).forEach(row => {
        if (row.length > 2 && row[2]) {
          const normalizedModel = row[2].toString().trim();
          if (normalizedModel) {
            allowedModels.add(normalizedModel);
          }
        }
      });
    }
    
    console.log(`📋 [사무실재고] 정규화작업시트 C열 허용 모델: ${allowedModels.size}개`);
    console.log('📋 [사무실재고] 허용 모델 목록:', Array.from(allowedModels));
    
    // 폰클재고데이터에서 재고 정보 수집
    const inventoryValues = await getSheetValues('폰클재고데이터');
    
    if (!inventoryValues || inventoryValues.length < 2) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    console.log(`📊 [사무실재고] 폰클재고데이터 로드 완료: ${inventoryValues.length}행`);
    
    // 사무실별 재고 카운팅
    const officeInventory = {
      '평택사무실': {},
      '인천사무실': {},
      '군산사무실': {},
      '안산사무실': {}
    };
    
    let processedCount = 0;
    let filteredCount = 0;
    let totalCount = 0;
    
    // 헤더 제거하고 데이터 처리 (2행부터 시작)
    inventoryValues.slice(1).forEach((row, index) => {
      if (row.length >= 14) {
        totalCount++;
        const model = (row[5] || '').toString().trim(); // F열: 모델명
        const color = (row[6] || '').toString().trim(); // G열: 색상
        const status = (row[7] || '').toString().trim(); // H열: 상태
        const storeName = (row[13] || '').toString().trim(); // N열: 출고처(사무실명)
        
        // 정상 상태이고 모델, 색상, 사무실명이 있는 경우만 처리
        if (model && color && storeName && status === '정상') {
          const combinedModel = `${model} | ${color}`;
          
          // 정규화작업시트 C열과 매칭되는 모델만 처리
          if (allowedModels.has(combinedModel)) {
            // 사무실명 추출
            let officeName = '';
            if (storeName.includes('평택사무실')) {
              officeName = '평택사무실';
            } else if (storeName.includes('인천사무실')) {
              officeName = '인천사무실';
            } else if (storeName.includes('군산사무실')) {
              officeName = '군산사무실';
            } else if (storeName.includes('안산사무실')) {
              officeName = '안산사무실';
            }
            
            if (officeName && officeInventory[officeName]) {
              if (!officeInventory[officeName][combinedModel]) {
                officeInventory[officeName][combinedModel] = 0;
              }
              officeInventory[officeName][combinedModel]++;
              processedCount++;
            }
          } else {
            filteredCount++;
          }
        }
      }
    });
    
    console.log(`📊 [사무실재고] 총 데이터: ${totalCount}개, 처리된 재고: ${processedCount}개, 필터링된 항목: ${filteredCount}개`);
    
    // 통계 계산
    const stats = {
      totalInventory: 0,
      officeStats: {},
      allowedModelsCount: allowedModels.size,
      processedCount,
      filteredCount,
      totalCount
    };
    
    Object.entries(officeInventory).forEach(([officeName, inventory]) => {
      const officeTotal = Object.values(inventory).reduce((sum, count) => sum + count, 0);
      const modelCount = Object.keys(inventory).length;
      
      stats.officeStats[officeName] = {
        totalInventory: officeTotal,
        modelCount: modelCount
      };
      
      stats.totalInventory += officeTotal;
    });
    
    const result = {
      success: true,
      officeInventory,
      stats,
      allowedModels: Array.from(allowedModels),
      lastUpdated: new Date().toISOString()
    };
    
    console.log('✅ [사무실재고] 처리 완료:', stats);
    res.json(result);
    
  } catch (error) {
    console.error('❌ [사무실재고] 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '사무실별 재고 조회 실패',
      message: error.message
    });
  }
});

// 사전예약 설정 저장 API
app.post('/api/reservation-settings/save', async (req, res) => {
  try {
    const { selectedValues, matchingResult } = req.body;
    
    console.log('저장 요청 받음:', { selectedValues, matchingResult });
    
    // 더 읽기 쉬운 형식으로 데이터 정리
    const reservationSiteText = [
      selectedValues.reservationSite.p,
      selectedValues.reservationSite.q,
      selectedValues.reservationSite.r
    ].filter(v => v).join(' | ');
    
    const phoneklText = [
      selectedValues.phonekl.f,
      selectedValues.phonekl.g
    ].filter(v => v).join(' | ');
    
    console.log('정리된 데이터:', { reservationSiteText, phoneklText });
    
    // 정규화작업 시트에 저장
    const saveData = [
      [
        new Date().toISOString(), // 저장일시
        reservationSiteText || '선택된 값 없음', // 사전예약사이트 선택값
        phoneklText || '선택된 값 없음', // 폰클 선택값
        matchingResult.normalizedModel || '정규화된 값 없음', // 정규화된 모델명
        matchingResult.matchingStatus || '매칭 상태 없음', // 매칭 상태
        matchingResult.isMatched ? '완료' : '미완료', // 완료 여부
        '사전예약 모델명 정규화' // 비고
      ]
    ];

    console.log('Google Sheets에 저장할 데이터:', saveData);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '정규화작업!A:G',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: saveData
      }
    });

    console.log('Google Sheets 저장 완료');

    res.json({
      success: true,
      message: '정규화 설정이 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('사전예약 설정 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save reservation settings',
      message: error.message
    });
  }
});

// 저장된 정규화 목록 불러오기 API
app.get('/api/reservation-settings/list', async (req, res) => {
  try {
    // 정규화작업 시트에서 모든 정규화 기록 불러오기
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '정규화작업!A:G'
      });
      
      if (response.data.values && response.data.values.length > 1) {
        // 헤더 제거하고 데이터 정리
        const normalizationList = response.data.values.slice(1).map((row, index) => ({
          id: index + 1,
          timestamp: row[0] || '',
          reservationSite: row[1] || '',
          phonekl: row[2] || '',
          normalizedModel: row[3] || '',
          matchingStatus: row[4] || '',
          isCompleted: row[5] === '완료',
          note: row[6] || ''
        }));
        
        res.json({
          success: true,
          normalizationList: normalizationList.reverse() // 최신 항목이 위로 오도록
        });
        return;
      }
    } catch (error) {
      console.log('정규화작업 시트 로드 실패:', error.message);
    }

    // 저장된 데이터가 없는 경우 빈 배열 반환
    res.json({
      success: true,
      normalizationList: []
    });
  } catch (error) {
    console.error('정규화 목록 불러오기 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load normalization list',
      message: error.message
    });
  }
});

// 사전예약 설정 불러오기 API
app.get('/api/reservation-settings/load', async (req, res) => {
  try {
    // 정규화작업 시트에서 최신 설정 불러오기
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '정규화작업!A:G'
      });
      
      if (response.data.values && response.data.values.length > 1) {
        // 최신 설정 (마지막 행) 불러오기
        const latestRow = response.data.values[response.data.values.length - 1];
        
        if (latestRow.length >= 3) {
          // 텍스트 형태의 데이터를 다시 객체로 변환
          const reservationSiteParts = (latestRow[1] || '').split(' | ');
          const phoneklParts = (latestRow[2] || '').split(' | ');
          
          const selectedValues = {
            reservationSite: {
              p: reservationSiteParts[0] || '',
              q: reservationSiteParts[1] || '',
              r: reservationSiteParts[2] || ''
            },
            phonekl: {
              f: phoneklParts[0] || '',
              g: phoneklParts[1] || ''
            }
          };
          
          const matchingResult = {
            normalizedModel: latestRow[3] || '',
            matchingStatus: latestRow[4] || '',
            isMatched: latestRow[5] === '완료'
          };
          
          res.json({
            success: true,
            selectedValues,
            matchingResult
          });
          return;
        }
      }
    } catch (error) {
      console.log('정규화작업 시트 로드 실패:', error.message);
    }

    // 저장된 설정이 없는 경우 기본값 반환
    res.json({
      success: true,
      selectedValues: {
        reservationSite: { p: '', q: '', r: '' },
        phonekl: { f: '', g: '' }
      },
      matchingResult: {
        normalizedModel: '',
        matchingStatus: '',
        isMatched: false
      }
    });
  } catch (error) {
    console.error('사전예약 설정 불러오기 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load reservation settings',
      message: error.message
    });
  }
});

// 정규화된 데이터 조회 API
app.get('/api/reservation-settings/normalized-data', async (req, res) => {
  try {
    // 1. 정규화 규칙들을 불러오기
    let normalizationRules = [];
    try {
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '정규화작업!A:G'
      });
      
      if (rulesResponse.data.values && rulesResponse.data.values.length > 1) {
        // 헤더 제거하고 완료된 규칙만 필터링
        normalizationRules = rulesResponse.data.values.slice(1)
          .filter(row => row.length >= 6 && row[5] === '완료')
          .map(row => ({
            reservationSite: row[1] || '',
            phonekl: row[2] || '',
            normalizedModel: row[3] || '',
            note: row[6] || ''
          }));
      }
    } catch (error) {
      console.log('정규화 규칙 로드 실패:', error.message);
    }

    // 2. 사전예약사이트 시트의 원본 데이터 읽기
    let reservationSiteOriginalData = [];
    try {
      const reservationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트!A:AA' // 전체 데이터 읽기
      });
      
      if (reservationResponse.data.values && reservationResponse.data.values.length > 1) {
        const headers = reservationResponse.data.values[0];
        const dataRows = reservationResponse.data.values.slice(1);
        
        reservationSiteOriginalData = dataRows.map((row, index) => {
          const rowData = {};
          headers.forEach((header, colIndex) => {
            rowData[header] = row[colIndex] || '';
          });
          
          // P, Q, R열 값 추출
          const pValue = row[15] || ''; // P열 (16번째, 0부터 시작)
          const qValue = row[16] || ''; // Q열 (17번째, 0부터 시작)
          const rValue = row[17] || ''; // R열 (18번째, 0부터 시작)
          
          // 정규화 규칙 적용
          let normalizedModel = '';
          let appliedRule = null;
          
          for (const rule of normalizationRules) {
            const ruleParts = rule.reservationSite.split(' | ');
            if (ruleParts.length >= 3) {
              const ruleP = ruleParts[0];
              const ruleQ = ruleParts[1];
              const ruleR = ruleParts[2];
              
              // 공백 제거하여 정확한 매칭 확인
              const normalizedPValue = pValue.replace(/\s+/g, '');
              const normalizedQValue = qValue.replace(/\s+/g, '');
              const normalizedRValue = rValue.replace(/\s+/g, '');
              const normalizedRuleP = ruleP.replace(/\s+/g, '');
              const normalizedRuleQ = ruleQ.replace(/\s+/g, '');
              const normalizedRuleR = ruleR.replace(/\s+/g, '');
              
              // 정확한 매칭 확인
              const pMatch = !normalizedRuleP || normalizedPValue === normalizedRuleP;
              const qMatch = !normalizedRuleQ || normalizedQValue === normalizedRuleQ;
              const rMatch = !normalizedRuleR || normalizedRValue === normalizedRuleR;
              
              if (pMatch && qMatch && rMatch) {
                normalizedModel = rule.normalizedModel;
                appliedRule = rule;
                break;
              }
            }
          }
          
          return {
            ...rowData,
            originalP: pValue,
            originalQ: qValue,
            originalR: rValue,
            normalizedModel: normalizedModel,
            appliedRule: appliedRule,
            rowIndex: index + 2 // 실제 행 번호 (헤더 제외)
          };
        });
      }
    } catch (error) {
      // 사전예약사이트 시트 로드 실패
    }

    // 3. 폰클재고데이터 시트의 원본 데이터 읽기
    let phoneklOriginalData = [];
    try {
      const phoneklResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '폰클재고데이터!A:AA' // 전체 데이터 읽기
      });
      
      if (phoneklResponse.data.values && phoneklResponse.data.values.length > 1) {
        const headers = phoneklResponse.data.values[0];
        const dataRows = phoneklResponse.data.values.slice(1);
        
        phoneklOriginalData = dataRows.map((row, index) => {
          const rowData = {};
          headers.forEach((header, colIndex) => {
            rowData[header] = row[colIndex] || '';
          });
          
          // F, G열 값 추출
          const fValue = row[5] || ''; // F열 (6번째, 0부터 시작)
          const gValue = row[6] || ''; // G열 (7번째, 0부터 시작)
          
          // 정규화 규칙 적용
          let normalizedModel = '';
          let appliedRule = null;
          
          for (const rule of normalizationRules) {
            const ruleParts = rule.phonekl.split(' | ');
            if (ruleParts.length >= 2) {
              const ruleF = ruleParts[0];
              const ruleG = ruleParts[1];
              
              // 공백 제거하여 정확한 매칭 확인
              const normalizedFValue = fValue.replace(/\s+/g, '');
              const normalizedGValue = gValue.replace(/\s+/g, '');
              const normalizedRuleF = ruleF.replace(/\s+/g, '');
              const normalizedRuleG = ruleG.replace(/\s+/g, '');
              
              // 정확한 매칭 확인
              const fMatch = !normalizedRuleF || normalizedFValue === normalizedRuleF;
              const gMatch = !normalizedRuleG || normalizedGValue === normalizedRuleG;
              
              if (fMatch && gMatch) {
                normalizedModel = rule.normalizedModel;
                appliedRule = rule;
                break;
              }
            }
          }
          
          return {
            ...rowData,
            originalF: fValue,
            originalG: gValue,
            normalizedModel: normalizedModel,
            appliedRule: appliedRule,
            rowIndex: index + 2 // 실제 행 번호 (헤더 제외)
          };
        });
      }
    } catch (error) {
      console.log('폰클재고데이터 시트 로드 실패:', error.message);
    }

    // 4. 통계 정보 계산 - 사전예약사이트 기준으로 완료율 계산
    const uniqueReservationModels = new Set();
    const uniqueNormalizedModels = new Set();
    
    // 사전예약사이트의 고유 모델 조합 추출 (P+Q+R) - 공백 제거
    reservationSiteOriginalData.forEach(item => {
      const modelKey = `${item.originalP}|${item.originalQ}|${item.originalR}`.replace(/\s+/g, '');
      if (modelKey && modelKey !== '||') {
        uniqueReservationModels.add(modelKey);
      }
    });
    
    // 정규화된 고유 모델 추출
    reservationSiteOriginalData.forEach(item => {
      if (item.normalizedModel) {
        uniqueNormalizedModels.add(item.normalizedModel);
      }
    });
    
    const stats = {
      totalRules: normalizationRules.length,
      reservationSiteTotal: uniqueReservationModels.size,
      reservationSiteNormalized: uniqueNormalizedModels.size,
      phoneklTotal: phoneklOriginalData.length,
      phoneklNormalized: phoneklOriginalData.filter(item => item.normalizedModel).length,
      // 사전예약사이트 기준 완료율 (100% 완료 시 정규화작업 완료로 간주)
      completionRate: uniqueReservationModels.size > 0 
        ? Math.round((uniqueNormalizedModels.size / uniqueReservationModels.size) * 100) 
        : 0,
      isCompleted: uniqueReservationModels.size > 0 && uniqueNormalizedModels.size >= uniqueReservationModels.size
    };

    res.json({
      success: true,
      normalizationRules: normalizationRules,
      reservationSiteData: reservationSiteOriginalData,
      phoneklData: phoneklOriginalData,
      stats: stats
    });
  } catch (error) {
    console.error('정규화된 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load normalized data',
      message: error.message
    });
  }
});

// 판매처별정리 관련 API들

// 대리점코드별 데이터 로드 API (캐시 적용)
app.get('/api/sales-by-store/data', async (req, res) => {
  try {
    const cacheKey = 'sales_by_store_data';
    const cachedData = cacheUtils.get(cacheKey);
    
    if (cachedData) {
      console.log('판매처별정리 데이터 캐시에서 로드');
      return res.json(cachedData);
    }

    console.log('판매처별정리 데이터 구글시트에서 로드');

    // 1. 사전예약사이트 시트 데이터 로드
    const reservationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '사전예약사이트!A:AA'
    });

    // 2. 폰클출고처데이터 시트 로드 (담당자 매칭용)
    const phoneklResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:V'
    });

    // 3. 마당접수 시트 로드 (서류접수 상태 확인용)
    const yardResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '마당접수!A:X'
    });

    // 4. 온세일 시트 로드 (온세일 접수 상태 확인용)
    const onSaleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '온세일!A:AA'
    });

    // 5. POS코드변경설정 시트 로드 (선택사항 - 없어도 에러 발생하지 않음)
    let posCodeMappingResponse = null;
    try {
      posCodeMappingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'POS코드변경설정!A:H'
      });
      console.log('POS코드변경설정 시트 로드 성공');
    } catch (error) {
      console.log('POS코드변경설정 시트 로드 실패 (무시됨):', error.message);
      posCodeMappingResponse = { data: { values: null } };
    }

    if (!reservationResponse.data.values || !phoneklResponse.data.values || !yardResponse.data.values || !onSaleResponse.data.values) {
      throw new Error('시트 데이터를 불러올 수 없습니다.');
    }

    const reservationHeaders = reservationResponse.data.values[0];
    const reservationData = reservationResponse.data.values.slice(1);
    
    const phoneklHeaders = phoneklResponse.data.values[0];
    const phoneklData = phoneklResponse.data.values.slice(3); // 헤더가 3행이므로 4행부터 시작
    
    const yardHeaders = yardResponse.data.values[0];
    const yardData = yardResponse.data.values.slice(1);
    
    const onSaleHeaders = onSaleResponse.data.values[0];
    const onSaleData = onSaleResponse.data.values.slice(1);
    
    const posCodeMappingHeaders = posCodeMappingResponse.data.values ? posCodeMappingResponse.data.values[0] : [];
    const posCodeMappingData = posCodeMappingResponse.data.values ? posCodeMappingResponse.data.values.slice(1) : [];

    // POS코드 매핑 테이블 생성 (접수자별 매핑 지원)
    const posCodeMapping = new Map();
    const posCodeMappingWithReceiver = new Map(); // 접수자별 매핑
    
    // POS명 매핑 테이블 생성 (접수자별 매핑 지원)
    const posNameMapping = new Map();
    const posNameMappingWithReceiver = new Map(); // 접수자별 매핑
    
    if (posCodeMappingData && posCodeMappingData.length > 0) {
      posCodeMappingData.forEach((row, index) => {
        // POS코드 매핑 처리
        const originalCode = row[0] || ''; // A열: 원본 POS코드
        const receiverCode = row[1] || ''; // B열: 접수자명 (POS코드용)
        const mappedCode = row[2] || '';   // C열: 변경될 POS코드
        const descriptionCode = row[3] || ''; // D열: 설명 (POS코드용)
        
        if (originalCode && mappedCode) {
          if (receiverCode) {
            // 접수자별 매핑
            const key = `${originalCode}_${receiverCode}`;
            posCodeMappingWithReceiver.set(key, mappedCode);
            console.log(`POS코드 접수자별 매핑 ${index + 2}: ${key} -> ${mappedCode} (${descriptionCode})`);
          } else {
            // 일반 매핑
            posCodeMapping.set(originalCode, mappedCode);
            console.log(`POS코드 일반 매핑 ${index + 2}: ${originalCode} -> ${mappedCode} (${descriptionCode})`);
          }
        }
        
        // POS명 매핑 처리
        const originalName = row[4] || ''; // E열: 원본 POS명
        const receiverName = row[5] || ''; // F열: 접수자명 (POS명용)
        const mappedName = row[6] || '';   // G열: 변경될 POS명
        const descriptionName = row[7] || ''; // H열: 설명 (POS명용)
        
        if (originalName && mappedName) {
          if (receiverName) {
            // 접수자별 매핑
            const key = `${originalName}_${receiverName}`;
            posNameMappingWithReceiver.set(key, mappedName);
            console.log(`POS명 접수자별 매핑 ${index + 2}: ${key} -> ${mappedName} (${descriptionName})`);
          } else {
            // 일반 매핑
            posNameMapping.set(originalName, mappedName);
            console.log(`POS명 일반 매핑 ${index + 2}: ${originalName} -> ${mappedName} (${descriptionName})`);
          }
        }
      });

      console.log('매핑 테이블 생성 완료:', {
        POS코드_일반매핑: posCodeMapping.size,
        POS코드_접수자별매핑: posCodeMappingWithReceiver.size,
        POS명_일반매핑: posNameMapping.size,
        POS명_접수자별매핑: posNameMappingWithReceiver.size
      });
    } else {
      console.log('매핑 테이블: 매핑 데이터 없음 (원본 값 그대로 사용)');
    }

    // 담당자 이름 정규화 함수 (괄호 안 부서 정보 제거)
    const normalizeAgentName = (agentName) => {
      if (!agentName) return '';
      // 괄호와 그 안의 내용 제거 (예: 홍기현(별도) -> 홍기현)
      return agentName.replace(/\([^)]*\)/g, '').trim();
    };

    // 폰클출고처데이터에서 P열(매장코드)과 V열(담당자) 매핑 생성
    const storeAgentMap = new Map();
    const agentNormalizationMap = new Map(); // 정규화된 이름 -> 원본 이름 매핑
    
    phoneklData.forEach(row => {
      const storeCode = row[15] || ''; // P열 (16번째, 0부터 시작)
      const agent = row[21] || ''; // V열 (22번째, 0부터 시작)
      if (storeCode && agent) {
        const normalizedAgent = normalizeAgentName(agent);
        
        // 정규화된 이름으로 매핑 저장
        storeAgentMap.set(storeCode, normalizedAgent);
        
        // 정규화된 이름 -> 원본 이름 매핑 저장 (첫 번째 발견된 원본 이름 사용)
        if (!agentNormalizationMap.has(normalizedAgent)) {
          agentNormalizationMap.set(normalizedAgent, agent);
        }
      }
    });

    console.log('담당자 정규화 매핑:', Object.fromEntries(agentNormalizationMap));

    // 마당접수에서 예약번호 추출 (정규표현식 사용)
    const yardReservationMap = new Set();
    yardData.forEach((row, index) => {
      const uValue = row[20] || ''; // U열 (21번째, 0부터 시작)
      const vValue = row[21] || ''; // V열 (22번째, 0부터 시작)
      
      // 예약번호 패턴 찾기 (예: PK590797, XJ766583 등)
      const reservationPattern = /[A-Z]{2}\d{6}/g;
      const uMatches = uValue.match(reservationPattern) || [];
      const vMatches = vValue.match(reservationPattern) || [];
      
      // 모든 예약번호를 Set에 추가
      [...uMatches, ...vMatches].forEach(match => {
        yardReservationMap.add(match);
        // 처음 5개만 디버깅 로그
        if (index < 5) {
          console.log(`마당접수 행 ${index + 2}: U=${uValue}, V=${vValue}, 추출된예약번호=${match}`);
        }
      });
    });

    console.log('마당접수 예약번호 개수:', yardReservationMap.size);
    console.log('마당접수 예약번호 샘플:', Array.from(yardReservationMap).slice(0, 5));

    // 온세일 데이터 인덱싱 (고객명 + 대리점코드 기준)
    const onSaleIndex = new Map();
    const unmatchedOnSaleData = [];
    let onSaleIndexCount = 0;
    
    onSaleData.forEach((row, index) => {
      const customerName = row[2] || ''; // C열 (3번째, 0부터 시작)
      const storeCode = row[12] || ''; // M열 (13번째, 0부터 시작)
      const receivedDate = row[5] || ''; // F열 (6번째, 0부터 시작)
      
      if (customerName && storeCode) {
        const key = `${customerName}_${storeCode}`;
        onSaleIndex.set(key, receivedDate);
        onSaleIndexCount++;
        
        // 처음 5개만 디버깅 로그
        if (index < 5) {
          console.log(`온세일 행 ${index + 2}: 고객명="${customerName}", 대리점코드="${storeCode}", 접수일="${receivedDate}"`);
        }
      }
    });

    console.log('온세일 데이터 인덱싱 완료:', onSaleIndex.size, '개 고객-대리점 조합 (총', onSaleIndexCount, '개 처리)');
    console.log('온세일 데이터 샘플:', Array.from(onSaleIndex.entries()).slice(0, 5));

    // 온세일 매칭 실패 데이터 수집 (사전예약사이트에 없는 온세일 데이터)
    onSaleData.forEach((row, index) => {
      const customerName = row[2] || ''; // C열 (3번째, 0부터 시작)
      const storeCode = row[12] || ''; // M열 (13번째, 0부터 시작)
      const receivedDate = row[5] || ''; // F열 (6번째, 0부터 시작)
      
      if (customerName && storeCode) {
        // 사전예약사이트에서 해당 고객명+대리점코드 조합이 있는지 확인
        const isMatched = reservationData.some(reservationRow => {
          const reservationCustomerName = (reservationRow[7] || '').toString().trim(); // H열: 고객명
          const reservationStoreCode = (reservationRow[23] || '').toString().trim(); // X열: 대리점코드
          return reservationCustomerName === customerName && reservationStoreCode === storeCode;
        });
        
        if (!isMatched) {
          unmatchedOnSaleData.push({
            customerName,
            storeCode,
            receivedDate,
            key: `${customerName}_${storeCode}`
          });
        }
      }
    });

    console.log('온세일 매칭 실패 데이터:', unmatchedOnSaleData.length, '건');
    if (unmatchedOnSaleData.length > 0) {
      console.log('온세일 매칭 실패 샘플:', unmatchedOnSaleData.slice(0, 5));
    }

    // 사전예약사이트 데이터 처리
    const processedData = reservationData.map((row, index) => {
      const posName = row[22] || ''; // W열 (23번째, 0부터 시작)
      const storeCode = row[23] || ''; // X열 (24번째, 0부터 시작)
      const reservationNumber = row[8] || ''; // I열 (9번째, 0부터 시작)
      const storeCodeForLookup = row[21] || ''; // V열 (22번째, 0부터 시작)
      const receiver = row[25] || ''; // Z열 (26번째, 0부터 시작): 접수자명
      
      // POS코드 매핑 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedStoreCode = storeCodeForLookup;
      const receiverKey = `${storeCodeForLookup}_${receiver}`;
      
      if (posCodeMappingWithReceiver.has(receiverKey)) {
        mappedStoreCode = posCodeMappingWithReceiver.get(receiverKey);
        console.log(`POS코드 접수자별 매핑 적용: ${storeCodeForLookup}(${receiver}) -> ${mappedStoreCode}`);
      } else if (posCodeMapping.has(storeCodeForLookup)) {
        mappedStoreCode = posCodeMapping.get(storeCodeForLookup);
        console.log(`POS코드 일반 매핑 적용: ${storeCodeForLookup} -> ${mappedStoreCode}`);
      }
      
      // POS명 매핑 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedPosName = posName;
      const posNameReceiverKey = `${posName}_${receiver}`;
      
      if (posNameMappingWithReceiver.has(posNameReceiverKey)) {
        mappedPosName = posNameMappingWithReceiver.get(posNameReceiverKey);
        console.log(`POS명 접수자별 매핑 적용: ${posName}(${receiver}) -> ${mappedPosName}`);
      } else if (posNameMapping.has(posName)) {
        mappedPosName = posNameMapping.get(posName);
        console.log(`POS명 일반 매핑 적용: ${posName} -> ${mappedPosName}`);
      }
      
      // 담당자 매칭 (매핑된 POS코드 사용)
      let agent = storeAgentMap.get(mappedStoreCode) || '';
      
      // 서류접수 상태 확인 (마당접수 OR 온세일 접수)
      const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      
      const isYardReceived = yardReservationMap.has(normalizedReservationNumber);
      const isOnSaleReceived = onSaleIndex.has(`${customerName}_${storeCode}`);
      const isDocumentReceived = isYardReceived || isOnSaleReceived;

      // 디버깅용 로그 (처음 10개만)
      if (index < 10) {
        console.log(`사전예약 행 ${index + 2}: 예약번호=${reservationNumber}, 정규화=${normalizedReservationNumber}, 마당접수=${isYardReceived}, 온세일접수=${isOnSaleReceived}, 최종접수=${isDocumentReceived}, 담당자=${agent}`);
      }

      return {
        rowIndex: index + 2,
        posName: mappedPosName, // 매핑된 POS명 사용
        storeName: mappedPosName, // 클라이언트 호환성
        storeCode,
        reservationNumber,
        storeCodeForLookup,
        agent,
        isDocumentReceived,
        originalRow: row
      };
    });

    console.log('총 처리된 데이터:', processedData.length);
    console.log('서류접수된 데이터:', processedData.filter(item => item.isDocumentReceived).length);
    
    // 서류접수 매칭 상세 분석
    const receivedItems = processedData.filter(item => item.isDocumentReceived);
    const notReceivedItems = processedData.filter(item => !item.isDocumentReceived);
    
    console.log('서류접수된 항목 샘플:', receivedItems.slice(0, 3).map(item => ({
      예약번호: item.reservationNumber,
      정규화: item.reservationNumber.replace(/-/g, ''),
      담당자: item.agent,
      POS명: item.posName
    })));
    
    console.log('서류미접수 항목 샘플:', notReceivedItems.slice(0, 3).map(item => ({
      예약번호: item.reservationNumber,
      정규화: item.reservationNumber.replace(/-/g, ''),
      담당자: item.agent,
      POS명: item.posName
    })));

    // 매칭 실패 통계 분석
    const matchingFailures = processedData.filter(item => !item.agent);
    const failureStats = {};
    const failureByPosCode = {};
    
    matchingFailures.forEach(item => {
      const posCode = item.storeCodeForLookup;
      const posName = item.posName;
      
      // POS코드별 실패 통계
      failureStats[posCode] = (failureStats[posCode] || 0) + 1;
      
      // POS명별 실패 통계
      if (!failureByPosCode[posCode]) {
        failureByPosCode[posCode] = {
          posName: posName,
          count: 0,
          items: []
        };
      }
      failureByPosCode[posCode].count++;
      failureByPosCode[posCode].items.push({
        reservationNumber: item.reservationNumber,
        customerName: item.originalRow[7] || '',
        receiver: item.originalRow[25] || ''
      });
    });

    console.log('매칭 실패 통계:', {
      총실패건수: matchingFailures.length,
      실패율: ((matchingFailures.length / processedData.length) * 100).toFixed(1) + '%',
      실패POS코드수: Object.keys(failureStats).length,
      상위실패POS코드: Object.entries(failureStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([code, count]) => ({ code, count }))
    });

    // 대리점코드별로 그룹화
    const groupedByStore = {};
    processedData.forEach(item => {
      if (item.storeCode) {
        if (!groupedByStore[item.storeCode]) {
          groupedByStore[item.storeCode] = [];
        }
        groupedByStore[item.storeCode].push(item);
      }
    });

    // 대리점코드별로 담당자별 그룹화 및 카운팅
    const groupedByStoreWithAgent = {};
    
    Object.keys(groupedByStore).forEach(storeCode => {
      const storeData = groupedByStore[storeCode];
      groupedByStoreWithAgent[storeCode] = {};
      
      storeData.forEach(item => {
        const agent = item.agent || '미배정';
        
        if (!groupedByStoreWithAgent[storeCode][agent]) {
          groupedByStoreWithAgent[storeCode][agent] = {
            received: 0,
            notReceived: 0,
            total: 0,
            items: []
          };
        }
        
        // 서류접수 상태에 따라 카운팅
        if (item.isDocumentReceived) {
          groupedByStoreWithAgent[storeCode][agent].received++;
        } else {
          groupedByStoreWithAgent[storeCode][agent].notReceived++;
        }
        
        groupedByStoreWithAgent[storeCode][agent].total++;
        groupedByStoreWithAgent[storeCode][agent].items.push(item);
      });
    });

    // 담당자별로 그룹화하고 POS명별로 서브 그룹화
    const groupedByAgent = {};
    
    // 모든 데이터를 담당자별로 그룹화 (정규화된 이름 사용)
    processedData.forEach(item => {
      const agent = item.agent || '미배정';
      const posName = item.posName || '미지정';
      
      if (!groupedByAgent[agent]) {
        groupedByAgent[agent] = {};
      }
      
      if (!groupedByAgent[agent][posName]) {
        groupedByAgent[agent][posName] = {
          received: 0,
          notReceived: 0,
          total: 0,
          items: []
        };
      }
      
      // 서류접수 상태에 따라 카운팅
      if (item.isDocumentReceived) {
        groupedByAgent[agent][posName].received++;
      } else {
        groupedByAgent[agent][posName].notReceived++;
      }
      
      groupedByAgent[agent][posName].total++;
      groupedByAgent[agent][posName].items.push(item);
    });

    // 디버깅용: 담당자별 POS 개수 확인
    Object.entries(groupedByAgent).forEach(([agent, agentData]) => {
      const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
      const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
      console.log(`${agent} 담당자: ${Object.keys(agentData).length}개 POS, 총 ${totalItems}건, 접수 ${totalReceived}건`);
      
      // POS명 상세 로그 (처음 10개만)
      const posNames = Object.keys(agentData);
      console.log(`  POS명 목록: ${posNames.slice(0, 10).join(', ')}${posNames.length > 10 ? `... (총 ${posNames.length}개)` : ''}`);
      
      // 서류접수 상세 로그
      posNames.slice(0, 5).forEach(posName => {
        const posData = agentData[posName];
        console.log(`    ${posName}: 접수 ${posData.received}, 미접수 ${posData.notReceived}, 총 ${posData.total}`);
      });
    });

    const result = {
      success: true,
      data: {
        byStore: groupedByStoreWithAgent,
        byAgent: groupedByAgent
      },
      stats: {
        totalStores: Object.keys(groupedByStore).length,
        totalAgents: Object.keys(groupedByAgent).length,
        totalItems: processedData.length,
        totalWithAgent: processedData.filter(item => item.agent).length,
        totalDocumentReceived: processedData.filter(item => item.isDocumentReceived).length,
        matchingSuccessRate: ((processedData.filter(item => item.agent).length / processedData.length) * 100).toFixed(1)
      },
      matchingFailures: {
        totalFailures: matchingFailures.length,
        failureRate: ((matchingFailures.length / processedData.length) * 100).toFixed(1),
        failureByPosCode: failureByPosCode,
        topFailurePosCodes: Object.entries(failureStats)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([code, count]) => ({ code, count, posName: failureByPosCode[code]?.posName || '' }))
      },
      unmatchedOnSaleData: unmatchedOnSaleData // 온세일 매칭 실패 데이터 추가
    };

    // 캐시에 저장 (10분)
    cacheUtils.set(cacheKey, result, 10 * 60 * 1000);
    
    res.json(result);
  } catch (error) {
    console.error('판매처별정리 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load sales by store data',
      message: error.message
    });
  }
});

// 담당자별 고객 리스트 API
app.get('/api/reservation-sales/customer-list/by-agent/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    console.log(`담당자별 고객 리스트 요청: ${agentName}`);
    
    // 캐시 키 생성
    const cacheKey = `agent_customer_list_${agentName}`;
    
    // 캐시에서 먼저 확인 (5분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log(`캐시된 담당자별 고객 리스트 반환: ${agentName}`);
      return res.json(cachedData);
    }
    
    // 1. 정규화된 데이터 가져오기 (캐시 활용)
    const normalizedCacheKey = 'normalized_data_cache';
    let normalizedData = cacheUtils.get(normalizedCacheKey);
    
    if (!normalizedData) {
      const normalizedResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/reservation-settings/normalized-data`);
      if (!normalizedResponse.ok) {
        throw new Error('정규화된 데이터를 가져올 수 없습니다.');
      }
      normalizedData = await normalizedResponse.json();
      
      if (!normalizedData.success) {
        throw new Error('정규화된 데이터 조회 실패');
      }
      
      // 정규화 데이터 캐싱 (10분 TTL)
      cacheUtils.set(normalizedCacheKey, normalizedData, 600);
    }
    
    // 2. 병렬로 시트 데이터 가져오기 (온세일, 모바일가입내역 포함)
    const [reservationSiteValues, yardValues, onSaleValues, mobileJoinValues] = await Promise.all([
      getSheetValues('사전예약사이트'),
      getSheetValues('마당접수'),
      getSheetValues('온세일'),
      getSheetValues('모바일가입내역')
    ]);

    // 3. POS코드변경설정 시트 로드 (선택사항 - 없어도 에러 발생하지 않음)
    let posCodeMappingValues = null;
    try {
      posCodeMappingValues = await getSheetValues('POS코드변경설정');
      console.log('담당자별 고객리스트: POS코드변경설정 시트 로드 성공');
    } catch (error) {
      console.log('담당자별 고객리스트: POS코드변경설정 시트 로드 실패 (무시됨):', error.message);
      posCodeMappingValues = [];
    }
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    if (!yardValues || yardValues.length < 2) {
      throw new Error('마당접수 데이터를 가져올 수 없습니다.');
    }
    
    if (!onSaleValues || onSaleValues.length < 2) {
      throw new Error('온세일 데이터를 가져올 수 없습니다.');
    }
    
    if (!mobileJoinValues || mobileJoinValues.length < 2) {
      console.log('모바일가입내역 데이터를 가져올 수 없습니다. (무시됨)');
    }
    
    // 4. 정규화 규칙 매핑 생성
    const normalizationRules = normalizedData.normalizationRules || [];
    const ruleMap = new Map();
    
    normalizationRules.forEach(rule => {
      const key = rule.reservationSite.replace(/\s+/g, '');
      ruleMap.set(key, rule.normalizedModel);
    });

    // 5. POS코드 매핑 테이블 생성 (접수자별 매핑 지원)
    const posCodeMapping = new Map();
    const posCodeMappingWithReceiver = new Map(); // 접수자별 매핑
    
    // POS명 매핑 테이블 생성 (접수자별 매핑 지원)
    const posNameMapping = new Map();
    const posNameMappingWithReceiver = new Map(); // 접수자별 매핑
    
    if (posCodeMappingValues && posCodeMappingValues.length > 1) {
      const posCodeMappingData = posCodeMappingValues.slice(1);
      
      posCodeMappingData.forEach((row, index) => {
        // POS코드 매핑 처리
        const originalCode = row[0] || ''; // A열: 원본 POS코드
        const receiverCode = row[1] || ''; // B열: 접수자명 (POS코드용)
        const mappedCode = row[2] || '';   // C열: 변경될 POS코드
        const descriptionCode = row[3] || ''; // D열: 설명 (POS코드용)
        
        if (originalCode && mappedCode) {
          if (receiverCode) {
            // 접수자별 매핑
            const key = `${originalCode}_${receiverCode}`;
            posCodeMappingWithReceiver.set(key, mappedCode);
          } else {
            // 일반 매핑
            posCodeMapping.set(originalCode, mappedCode);
          }
        }
        
        // POS명 매핑 처리
        const originalName = row[4] || ''; // E열: 원본 POS명
        const receiverName = row[5] || ''; // F열: 접수자명 (POS명용)
        const mappedName = row[6] || '';   // G열: 변경될 POS명
        const descriptionName = row[7] || ''; // H열: 설명 (POS명용)
        
        if (originalName && mappedName) {
          if (receiverName) {
            // 접수자별 매핑
            const key = `${originalName}_${receiverName}`;
            posNameMappingWithReceiver.set(key, mappedName);
          } else {
            // 일반 매핑
            posNameMapping.set(originalName, mappedName);
          }
        }
      });

      console.log('담당자별 고객리스트: POS코드 매핑 테이블 생성 완료:', {
        POS코드_일반매핑: posCodeMapping.size,
        POS코드_접수자별매핑: posCodeMappingWithReceiver.size,
        POS명_일반매핑: posNameMapping.size,
        POS명_접수자별매핑: posNameMappingWithReceiver.size
      });
    } else {
      console.log('담당자별 고객리스트: POS코드 매핑 테이블: 매핑 데이터 없음 (원본 값 그대로 사용)');
    }
    
    // 6. 담당자 매핑 생성
    const storeAgentMap = new Map();
    const normalizeAgentName = (agentName) => {
      if (!agentName) return '';
      return agentName.replace(/\([^)]*\)/g, '').trim();
    };
    
    onSaleValues.slice(1).forEach(row => {
      const storeCode = row[12] || ''; // L열 (13번째, 0부터 시작)
      const agent = row[2] || ''; // C열 (3번째, 0부터 시작)
      if (storeCode && agent) {
        const normalizedAgent = normalizeAgentName(agent);
        storeAgentMap.set(storeCode, normalizedAgent);
      }
    });
    
    // 5. 마당접수 데이터 인덱싱 (예약번호별 빠른 검색을 위해)
    const yardIndex = new Map();
    let yardIndexCount = 0;
    yardValues.slice(1).forEach((yardRow, index) => {
      if (yardRow.length >= 22) { // V열까지 필요하므로 최소 22개 컬럼
        const uValue = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        const vValue = (yardRow[21] || '').toString().trim(); // V열 (22번째, 0부터 시작)
        const receivedDateTime = (yardRow[11] || '').toString().trim(); // L열 (12번째, 0부터 시작)
        const receivedMemo = (yardRow[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        
        // 예약번호 패턴 찾기 (하이픈이 없는 형태: XX000000)
        const reservationPattern = /[A-Z]{2}\d{6}/g;
        const uMatches = uValue.match(reservationPattern) || [];
        const vMatches = vValue.match(reservationPattern) || [];
        
        // 모든 예약번호를 인덱스에 추가 (이미 하이픈이 없는 형태)
        [...uMatches, ...vMatches].forEach(match => {
          const normalizedReservationNumber = match;
          yardIndex.set(normalizedReservationNumber, {
            receivedDateTime,
            receivedMemo
          });
          yardIndexCount++;
          
          // 처음 5개 마당접수 데이터 로그
          if (index < 5) {
            console.log(`담당자별 마당접수 인덱싱: 원본="${match}" -> 정규화="${normalizedReservationNumber}"`);
            console.log(`  U열: "${uValue}", V열: "${vValue}"`);
            console.log(`  접수일시: "${receivedDateTime}", 접수메모: "${receivedMemo}"`);
          }
        });
      }
    });
    
    console.log(`담당자별 마당접수 데이터 인덱싱 완료: ${yardIndex.size}개 예약번호 (총 ${yardIndexCount}개 처리)`);
    console.log(`담당자별 마당접수 예약번호 샘플:`, Array.from(yardIndex.keys()).slice(0, 5));
    
    // 6. 온세일 데이터 인덱싱 (고객명+대리점코드별 빠른 검색을 위해)
    const onSaleIndex = new Map();
    onSaleValues.slice(1).forEach(row => {
      if (row.length >= 13) { // L열까지 필요하므로 최소 13개 컬럼
        const customerName = (row[1] || '').toString().trim(); // B열 (2번째, 0부터 시작)
        const storeCode = (row[12] || '').toString().trim(); // L열 (13번째, 0부터 시작)
        const receivedDate = (row[0] || '').toString().trim(); // A열 (1번째, 0부터 시작)
        
        if (customerName && storeCode) {
          const key = `${customerName}_${storeCode}`;
          onSaleIndex.set(key, receivedDate);
        }
      }
    });
    
    console.log(`담당자별 온세일 데이터 인덱싱 완료: ${onSaleIndex.size}개 고객-대리점 조합`);
    
    // 6-1. 모바일가입내역 데이터 인덱싱 (예약번호 기준)
    const mobileJoinIndex = new Map();
    let mobileJoinIndexCount = 0;
    
    if (mobileJoinValues && mobileJoinValues.length > 1) {
      mobileJoinValues.slice(1).forEach((row, index) => {
        const reservationNumber = (row[6] || '').toString().trim(); // G열 (7번째, 0부터 시작): 예약번호
        const reservationDateTime = (row[9] || '').toString().trim(); // J열 (10번째, 0부터 시작): 예약일시
        
        if (reservationNumber) {
          // 예약번호 정규화 (하이픈 제거)
          const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
          mobileJoinIndex.set(normalizedReservationNumber, reservationDateTime);
          mobileJoinIndexCount++;
          
          // 처음 5개만 디버깅 로그
          if (index < 5) {
            console.log(`담당자별 모바일가입내역 행 ${index + 2}: 예약번호="${reservationNumber}", 정규화="${normalizedReservationNumber}", 예약일시="${reservationDateTime}"`);
          }
        }
      });
    }
    
    console.log(`담당자별 모바일가입내역 데이터 인덱싱 완료: ${mobileJoinIndex.size}개 예약번호 (총 ${mobileJoinIndexCount}개 처리)`);
    
    // 7. 사전예약사이트 데이터 처리 (담당자별 필터링)
    const reservationSiteRows = reservationSiteValues.slice(1);
    const customerList = [];
    
    reservationSiteRows.forEach((row, index) => {
      if (row.length < 30) return;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const reservationDateTime = (row[14] || '').toString().trim(); // O열: 예약일시
      const model = (row[15] || '').toString().trim(); // P열: 모델
      const capacity = (row[16] || '').toString().trim(); // Q열: 용량
      const color = (row[17] || '').toString().trim(); // R열: 색상
      const type = (row[18] || '').toString().trim(); // S열: 유형
      const storeCode = (row[23] || '').toString().trim(); // X열: 대리점코드
      const posName = (row[22] || '').toString().trim(); // W열: POS명
      const reservationMemo = (row[34] || '').toString().trim(); // AI열: 예약메모
      const receiver = (row[25] || '').toString().trim(); // Z열: 접수자
      const storeCodeForLookup = (row[21] || '').toString().trim(); // V열: 대리점코드(조회용)
      
      if (!reservationNumber || !customerName || !model || !capacity || !color) return;
      
      // 담당자 매칭 (VLOOKUP 방식) - 정규화된 이름 사용
      const agent = storeAgentMap.get(storeCodeForLookup) || '';
      
      // 담당자 필터링
      if (normalizeAgentName(agent) !== agentName) return;
      
      // 서류접수 정보 찾기 (인덱스 활용으로 빠른 검색)
      // 예약번호도 하이픈 제거하여 정규화된 형태로 비교
      const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
      const yardData = yardIndex.get(normalizedReservationNumber) || {};
      const receivedDateTime = yardData.receivedDateTime || '';
      const receivedMemo = yardData.receivedMemo || '';
      
      // 처음 5개 고객의 접수정보 디버깅 로그
      if (index < 5) {
        console.log(`담당자별 고객리스트 접수정보 매칭: 고객명="${customerName}", 예약번호="${reservationNumber}"`);
        console.log(`  정규화된 예약번호: "${normalizedReservationNumber}"`);
        console.log(`  마당접수 인덱스 존재: ${yardIndex.has(normalizedReservationNumber)}`);
        console.log(`  마당접수일: "${receivedDateTime}"`);
        console.log(`  마당메모: "${receivedMemo}"`);
        console.log(`  모델명: "${model}"`);
        console.log(`  담당자: "${agent}"`);
      }
      
      // 온세일 접수일 찾기 (온세일 → 모바일가입내역 순서로 찾기)
      const onSaleKey = `${customerName}_${storeCode}`;
      let onSaleReceivedDate = onSaleIndex.get(onSaleKey) || '';
      
      // 온세일에서 찾지 못한 경우 모바일가입내역에서 찾기
      if (!onSaleReceivedDate && mobileJoinIndex.has(normalizedReservationNumber)) {
        onSaleReceivedDate = mobileJoinIndex.get(normalizedReservationNumber);
        if (index < 5) {
          console.log(`  모바일가입내역에서 온세일접수일 찾음: "${onSaleReceivedDate}"`);
        }
      }
      
      // POS명 매핑 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedPosName = posName;
      if (posName && receiver) {
        // 접수자별 매핑 먼저 확인
        const receiverKey = `${posName}_${receiver}`;
        if (posNameMappingWithReceiver.has(receiverKey)) {
          mappedPosName = posNameMappingWithReceiver.get(receiverKey);
        } else if (posNameMapping.has(posName)) {
          // 일반 매핑 확인
          mappedPosName = posNameMapping.get(posName);
        }
      } else if (posName && posNameMapping.has(posName)) {
        // 일반 매핑만 확인
        mappedPosName = posNameMapping.get(posName);
      }
      
      // 모델/용량/색상 조합
      const modelCapacityColor = [model, capacity, color].filter(Boolean).join('/');
      
      customerList.push({
        customerName,
        reservationNumber,
        reservationDateTime,
        receivedDateTime,
        modelCapacityColor,
        type,
        storeCode,
        posName: mappedPosName, // 매핑된 POS명 사용
        reservationMemo,
        receivedMemo,
        receiver,
        agent,
        onSaleReceivedDate
      });
    });
    
    // 8. 예약일시로 오름차순 정렬
    customerList.sort((a, b) => {
      const dateA = new Date(a.reservationDateTime);
      const dateB = new Date(b.reservationDateTime);
      return dateA - dateB;
    });
    
    console.log(`담당자별 고객 리스트 생성 완료: ${customerList.length}개 고객`);
    
    const result = {
      success: true,
      data: customerList,
      total: customerList.length,
      agentName: agentName
    };
    
    // 결과 캐싱 (5분 TTL)
    cacheUtils.set(cacheKey, result, 300);
    
    res.json(result);
    
  } catch (error) {
    console.error('담당자별 고객 리스트 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load customer list by agent',
      message: error.message
    });
  }
});

// 담당자별 모델/색상 데이터 API
app.get('/api/reservation-sales/model-color/by-agent/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    
    // 1. 사전예약사이트 데이터 로드
    const reservationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '사전예약사이트!A:AA'
    });

    // 2. 폰클출고처데이터 시트 로드 (담당자 매칭용)
    const phoneklResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:V'
    });

    if (!reservationResponse.data.values || !phoneklResponse.data.values) {
      throw new Error('시트 데이터를 불러올 수 없습니다.');
    }

    const reservationHeaders = reservationResponse.data.values[0];
    const reservationData = reservationResponse.data.values.slice(1);
    
    const phoneklHeaders = phoneklResponse.data.values[0];
    const phoneklData = phoneklResponse.data.values.slice(3); // 헤더가 3행이므로 4행부터 시작

    // 담당자 이름 정규화 함수
    const normalizeAgentName = (agentName) => {
      if (!agentName) return '';
      return agentName.replace(/\([^)]*\)/g, '').trim();
    };

    // 폰클출고처데이터에서 P열(매장코드)과 V열(담당자) 매핑 생성
    const storeAgentMap = new Map();
    
    phoneklData.forEach(row => {
      const storeCode = row[15] || ''; // P열 (16번째, 0부터 시작)
      const agent = row[21] || ''; // V열 (22번째, 0부터 시작)
      if (storeCode && agent) {
        const normalizedAgent = normalizeAgentName(agent);
        storeAgentMap.set(storeCode, normalizedAgent);
      }
    });

    // 해당 담당자의 모델/색상 데이터 필터링
    const modelColorData = reservationData
      .map((row, index) => {
        const reservationNumber = row[8] || ''; // I열 (9번째, 0부터 시작)
        const customerName = row[9] || ''; // J열 (10번째, 0부터 시작)
        const model = row[15] || ''; // P열 (16번째, 0부터 시작)
        const color = row[16] || ''; // Q열 (17번째, 0부터 시작)
        const type = row[17] || ''; // R열 (18번째, 0부터 시작)
        const storeCodeForLookup = row[21] || ''; // V열 (22번째, 0부터 시작)
        const posName = row[22] || ''; // W열 (23번째, 0부터 시작)
        
        // 담당자 매칭
        const agent = storeAgentMap.get(storeCodeForLookup) || '';
        
        return {
          reservationNumber,
          customerName,
          model,
          color,
          type,
          storeCode: storeCodeForLookup,
          posName,
          agent,
          rowIndex: index + 2
        };
      })
      .filter(item => normalizeAgentName(item.agent) === agentName);

    res.json({
      success: true,
      data: modelColorData,
      stats: {
        totalItems: modelColorData.length,
        agentName: agentName
      }
    });
  } catch (error) {
    console.error('담당자별 모델/색상 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load model-color data by agent',
      message: error.message
    });
  }
});

// 전체 고객리스트 API
app.get('/api/reservation-sales/all-customers', async (req, res) => {
  try {
    console.log('전체 고객리스트 요청');
    
    // 캐시 확인
    const cacheKey = 'all_customer_list';
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log('캐시된 전체 고객리스트 반환');
      // 캐시 정보 업데이트
      cachedData.stats.cacheInfo = {
        cached: true,
        timestamp: new Date().toISOString(),
        ttl: 300
      };
      return res.json(cachedData);
    }

    // 1. 사전예약사이트 데이터 로드
    const reservationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '사전예약사이트!A:AI'
    });

    // 2. 마당접수 데이터 로드
    const yardResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '마당접수!A:AI'
    });

    // 3. 온세일 데이터 로드
    const onSaleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '온세일!A:AA'
    });

    // 3-1. 모바일가입내역 데이터 로드
    let mobileJoinResponse = null;
    try {
      mobileJoinResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '모바일가입내역!A:AA'
      });
      console.log('전체고객리스트: 모바일가입내역 시트 로드 성공');
    } catch (error) {
      console.log('전체고객리스트: 모바일가입내역 시트 로드 실패 (무시됨):', error.message);
      mobileJoinResponse = { data: { values: null } };
    }

    // 4. 폰클출고처데이터 시트 로드 (담당자 매칭용)
    const storeResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:V'
    });

    // 5. POS코드변경설정 시트 로드 (선택사항 - 없어도 에러 발생하지 않음)
    let posCodeMappingResponse = null;
    try {
      posCodeMappingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'POS코드변경설정!A:J' // I, J열 추가 (담당자 매핑용)
      });
      console.log('전체고객리스트: POS코드변경설정 시트 로드 성공');
    } catch (error) {
      console.log('전체고객리스트: POS코드변경설정 시트 로드 실패 (무시됨):', error.message);
      posCodeMappingResponse = { data: { values: null } };
    }

    if (!reservationResponse.data.values || !yardResponse.data.values || !onSaleResponse.data.values || !storeResponse.data.values) {
      throw new Error('시트 데이터를 불러올 수 없습니다.');
    }

    const reservationHeaders = reservationResponse.data.values[0];
    const reservationData = reservationResponse.data.values.slice(1);
    
    const yardHeaders = yardResponse.data.values[0];
    const yardData = yardResponse.data.values.slice(1);
    
    const onSaleHeaders = onSaleResponse.data.values[0];
    const onSaleData = onSaleResponse.data.values.slice(1);

    // 담당자 매핑 테이블 생성 (매장코드 -> 담당자)
    const managerMapping = new Map();
    const storeHeaders = storeResponse.data.values[0];
    const storeData = storeResponse.data.values.slice(3); // 헤더가 3행이므로 4행부터 시작
    
    console.log(`폰클출고처데이터 총 행 수: ${storeData.length}`);
    
    let processedRows = 0;
    let validRows = 0;
    let emptyStoreCode = 0;
    let emptyManager = 0;
    
    storeData.forEach((row, index) => {
      processedRows++;
      
      // 처음 5개 행의 상세 디버깅
      if (index < 5) {
        console.log(`=== 폰클출고처데이터 ${index + 1}번째 행 디버깅 ===`);
        console.log(`행 길이: ${row.length}`);
        console.log(`M열(12번인덱스): "${row[12] || ''}"`);
        console.log(`P열(15번인덱스): "${row[15] || ''}"`);
        console.log(`V열(21번인덱스): "${row[21] || ''}"`);
        console.log(`=== 폰클출고처데이터 디버깅 끝 ===`);
      }
      
      if (row.length >= 22) { // V열까지 필요
        const status = (row[12] || '').toString().trim(); // M열: 사용/미사용 상태
        const storeCode = (row[15] || '').toString().trim(); // P열: 매장코드
        const manager = (row[21] || '').toString().trim(); // V열: 담당자
        
        if (!storeCode) {
          emptyStoreCode++;
        }
        if (!manager) {
          emptyManager++;
        }
        
        // M열 상태가 "사용"인 경우에만 매핑 (매장코드 중복 처리)
        if (storeCode && manager && status === "사용") {
          validRows++;
          // 담당자 이름에서 괄호 부분 제거 (예: "홍기현(별도)" → "홍기현")
          const cleanManager = manager.replace(/\([^)]*\)/g, '').trim();
          managerMapping.set(storeCode, cleanManager);
          
          // 처음 5개 유효한 매핑 로그
          if (validRows <= 5) {
            console.log(`매핑 추가: "${storeCode}" -> "${cleanManager}" (상태: ${status})`);
          }
        } else if (storeCode && manager && status !== "사용") {
          // 미사용 상태인 경우 로그 출력
          if (index < 10) {
            console.log(`미사용 상태로 제외: "${storeCode}" -> "${manager}" (상태: ${status})`);
          }
        }
      }
    });
    
    console.log(`폰클출고처데이터 처리 통계:`);
    console.log(`- 총 처리된 행: ${processedRows}`);
    console.log(`- 유효한 행(22열 이상): ${storeData.filter(row => row.length >= 22).length}`);
    console.log(`- 매장코드가 있는 행: ${processedRows - emptyStoreCode}`);
    console.log(`- 담당자가 있는 행: ${processedRows - emptyManager}`);
    console.log(`- 유효한 매핑: ${validRows}`);
    
    console.log(`담당자 매핑 테이블 생성 완료: ${managerMapping.size}개 매장-담당자 매핑`);
    
    // 디버깅: 매핑 테이블 내용 출력 (처음 5개만)
    console.log('=== 담당자 매핑 테이블 디버깅 ===');
    let debugCount = 0;
    for (const [storeCode, manager] of managerMapping) {
      if (debugCount < 5) {
        console.log(`매장코드: "${storeCode}" -> 담당자: "${manager}"`);
        debugCount++;
      }
    }
    console.log('=== 매핑 테이블 디버깅 끝 ===');

    // POS코드 매핑 테이블 생성 (접수자별 매핑 지원)
    const posCodeMapping = new Map();
    const posCodeMappingWithReceiver = new Map(); // 접수자별 매핑
    
    // POS명 매핑 테이블 생성 (접수자별 매핑 지원)
    const posNameMapping = new Map();
    const posNameMappingWithReceiver = new Map(); // 접수자별 매핑
    
    const posCodeMappingHeaders = posCodeMappingResponse.data.values ? posCodeMappingResponse.data.values[0] : [];
    const posCodeMappingData = posCodeMappingResponse.data.values ? posCodeMappingResponse.data.values.slice(1) : [];
    
    if (posCodeMappingData && posCodeMappingData.length > 0) {
      posCodeMappingData.forEach((row, index) => {
        // POS코드 매핑 처리
        const originalCode = row[0] || ''; // A열: 원본 POS코드
        const receiverCode = row[1] || ''; // B열: 접수자명 (POS코드용)
        const mappedCode = row[2] || '';   // C열: 변경될 POS코드
        const descriptionCode = row[3] || ''; // D열: 설명 (POS코드용)
        
        if (originalCode && mappedCode) {
          if (receiverCode) {
            // 접수자별 매핑
            const key = `${originalCode}_${receiverCode}`;
            posCodeMappingWithReceiver.set(key, mappedCode);
          } else {
            // 일반 매핑
            posCodeMapping.set(originalCode, mappedCode);
          }
        }
        
        // POS명 매핑 처리
        const originalName = row[4] || ''; // E열: 원본 POS명
        const receiverName = row[5] || ''; // F열: 접수자명 (POS명용)
        const mappedName = row[6] || '';   // G열: 변경될 POS명
        const descriptionName = row[7] || ''; // H열: 설명 (POS명용)
        
        if (originalName && mappedName) {
          if (receiverName) {
            // 접수자별 매핑
            const key = `${originalName}_${receiverName}`;
            posNameMappingWithReceiver.set(key, mappedName);
          } else {
            // 일반 매핑
            posNameMapping.set(originalName, mappedName);
          }
        }
      });

      console.log('전체고객리스트: POS코드 매핑 테이블 생성 완료:', {
        POS코드_일반매핑: posCodeMapping.size,
        POS코드_접수자별매핑: posCodeMappingWithReceiver.size,
        POS명_일반매핑: posNameMapping.size,
        POS명_접수자별매핑: posNameMappingWithReceiver.size
      });
    } else {
      console.log('전체고객리스트: POS코드 매핑 테이블: 매핑 데이터 없음 (원본 값 그대로 사용)');
    }

    // 예약번호 정규화 함수
    const normalizeReservationNumber = (number) => {
      if (!number) return '';
      return number.toString().replace(/[-\s]/g, '').trim();
    };



    // 마당접수 데이터 인덱싱 (예약번호 기준)
    const yardIndex = new Map();
    let yardIndexCount = 0;
    
    yardData.forEach((row, index) => {
      if (row.length >= 22) { // V열까지 필요하므로 최소 22개 컬럼
        const uValue = (row[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        const vValue = (row[21] || '').toString().trim(); // V열 (22번째, 0부터 시작)
        const receivedDate = (row[11] || '').toString().trim(); // L열 (12번째, 0부터 시작)
        const receivedMemo = (row[20] || '').toString().trim(); // U열 (21번째, 0부터 시작)
        const receiver = (row[24] || '').toString().trim(); // Y열 (25번째, 0부터 시작)
        
        // 예약번호 패턴 찾기 (하이픈이 없는 형태: XX000000)
        const reservationPattern = /[A-Z]{2}\d{6}/g;
        const uMatches = uValue.match(reservationPattern) || [];
        const vMatches = vValue.match(reservationPattern) || [];
        
        // 모든 예약번호를 인덱스에 추가 (이미 하이픈이 없는 형태)
        [...uMatches, ...vMatches].forEach(match => {
          const normalizedReservationNumber = match;
          yardIndex.set(normalizedReservationNumber, {
            receivedDate,
            receivedMemo,
            receiver
          });
          yardIndexCount++;
          
          // 처음 5개 마당접수 데이터 로그
          if (index < 5) {
            console.log(`전체고객리스트 마당접수 인덱싱: 원본="${match}" -> 정규화="${normalizedReservationNumber}"`);
            console.log(`  U열: "${uValue}", V열: "${vValue}"`);
            console.log(`  접수일시: "${receivedDate}", 접수메모: "${receivedMemo}"`);
          }
        });
      }
    });

    console.log(`마당접수 데이터 인덱싱 완료: ${yardIndex.size}개 예약번호 (총 ${yardIndexCount}개 처리)`);

    // 온세일 데이터 인덱싱 (고객명 + 대리점코드 기준)
    const onSaleIndex = new Map();
    let onSaleIndexCount = 0;
    
    onSaleData.forEach(row => {
      const customerName = row[2] || ''; // C열 (3번째, 0부터 시작)
      const storeCode = row[12] || ''; // M열 (13번째, 0부터 시작)
      const receivedDate = row[5] || ''; // F열 (6번째, 0부터 시작)
      
      if (customerName && storeCode) {
        const key = `${customerName}_${storeCode}`;
        onSaleIndex.set(key, receivedDate);
        onSaleIndexCount++;
      }
    });

    console.log(`온세일 데이터 인덱싱 완료: ${onSaleIndex.size}개 고객-대리점 조합 (총 ${onSaleIndexCount}개 처리)`);

    // 모바일가입내역 데이터 인덱싱 (예약번호 기준)
    const mobileJoinIndex = new Map();
    let mobileJoinIndexCount = 0;
    
    if (mobileJoinResponse && mobileJoinResponse.data.values && mobileJoinResponse.data.values.length > 1) {
      const mobileJoinData = mobileJoinResponse.data.values.slice(1);
      mobileJoinData.forEach((row, index) => {
        const reservationNumber = (row[6] || '').toString().trim(); // G열 (7번째, 0부터 시작): 예약번호
        const reservationDateTime = (row[9] || '').toString().trim(); // J열 (10번째, 0부터 시작): 예약일시
        
        if (reservationNumber) {
          // 예약번호 정규화 (하이픈 제거)
          const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
          mobileJoinIndex.set(normalizedReservationNumber, reservationDateTime);
          mobileJoinIndexCount++;
          
          // 처음 5개만 디버깅 로그
          if (index < 5) {
            console.log(`전체고객리스트 모바일가입내역 행 ${index + 2}: 예약번호="${reservationNumber}", 정규화="${normalizedReservationNumber}", 예약일시="${reservationDateTime}"`);
          }
        }
      });
    }
    
    console.log(`전체고객리스트 모바일가입내역 데이터 인덱싱 완료: ${mobileJoinIndex.size}개 예약번호 (총 ${mobileJoinIndexCount}개 처리)`);

    // 전체 고객리스트 생성
    const customerList = reservationData.map((row, index) => {
      const reservationNumber = row[8] || ''; // I열 (9번째, 0부터 시작)
      const customerName = row[7] || ''; // H열 (8번째, 0부터 시작)
      const reservationDateTime = row[14] || ''; // O열 (15번째, 0부터 시작)
      const model = row[15] || ''; // P열 (16번째, 0부터 시작)
      const capacity = row[16] || ''; // Q열 (17번째, 0부터 시작) - 용량
      const color = row[17] || ''; // R열 (18번째, 0부터 시작) - 색상
      const type = row.length > 31 ? (row[31] || '') : ''; // AF열 (32번째, 0부터 시작) - 유형
      const reservationMemo = row.length > 34 ? (row[34] || '') : ''; // AI열 (35번째, 0부터 시작) - 사이트메모
      const storeCode = row[23] || ''; // X열 (24번째, 0부터 시작) - 대리점 코드
      const posName = row[22] || ''; // W열 (23번째, 0부터 시작)
      const receiver = row[25] || ''; // Z열 (26번째, 0부터 시작) - 접수자
      
      // 담당자 정보 매핑 (V열 매장코드 기준 + POS코드 변환 적용)
      const originalManagerCode = row[21] || ''; // V열 (22번째, 0부터 시작) - 원본 매장코드
      
      // POS코드 변환 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedManagerCode = originalManagerCode;
      const managerCodeReceiverKey = `${originalManagerCode}_${receiver}`;
      
      if (posCodeMappingWithReceiver.has(managerCodeReceiverKey)) {
        mappedManagerCode = posCodeMappingWithReceiver.get(managerCodeReceiverKey);
        console.log(`전체고객리스트: 매장코드 접수자별 매핑 적용: ${originalManagerCode}(${receiver}) -> ${mappedManagerCode}`);
      } else if (posCodeMapping.has(originalManagerCode)) {
        mappedManagerCode = posCodeMapping.get(originalManagerCode);
        console.log(`전체고객리스트: 매장코드 일반 매핑 적용: ${originalManagerCode} -> ${mappedManagerCode}`);
      }
      
      // 변환된 매장코드로 담당자 찾기
      const manager = managerMapping.get(mappedManagerCode) || '';
      
      // 디버깅: 처음 5개 고객의 담당자 매칭 과정 출력
      if (index < 5) {
        console.log(`=== 담당자 매칭 디버깅 ${index + 1}번째 고객 ===`);
        console.log(`고객명: "${customerName}"`);
        console.log(`원본 매장코드(V열): "${originalManagerCode}"`);
        console.log(`변환된 매장코드: "${mappedManagerCode}"`);
        console.log(`매칭된 담당자: "${manager}"`);
        console.log(`매핑 테이블에 존재하는가: ${managerMapping.has(mappedManagerCode)}`);
        console.log(`=== 담당자 매칭 디버깅 끝 ===`);
      }

      // POS명 매핑 적용 (접수자별 매핑 우선, 일반 매핑 차선)
      let mappedPosName = posName;
      const posNameReceiverKey = `${posName}_${receiver}`;
      
      if (posNameMappingWithReceiver.has(posNameReceiverKey)) {
        mappedPosName = posNameMappingWithReceiver.get(posNameReceiverKey);
        console.log(`전체고객리스트: POS명 접수자별 매핑 적용: ${posName}(${receiver}) -> ${mappedPosName}`);
      } else if (posNameMapping.has(posName)) {
        mappedPosName = posNameMapping.get(posName);
        console.log(`전체고객리스트: POS명 일반 매핑 적용: ${posName} -> ${mappedPosName}`);
      }

      // 모델/용량/색상 조합
      const modelCapacityColor = [model, capacity, color].filter(Boolean).join('/');

      // 처음 5개 고객의 상세 디버깅 로그
      if (index < 5) {
        console.log(`=== 전체고객리스트 디버깅 ${index + 1}번째 고객 ===`);
        console.log(`고객명: "${customerName}", 예약번호: "${reservationNumber}"`);
        console.log(`행 길이: ${row.length}`);
        console.log(`--- 전체 컬럼 값 확인 ---`);
        for (let i = 0; i < Math.min(row.length, 40); i++) {
          if (row[i] && row[i].toString().trim() !== '') {
            console.log(`  ${i}번째 컬럼: "${row[i]}"`);
          }
        }
        console.log(`--- 현재 매핑 확인 ---`);
        console.log(`  P열(16번째, index 15): 모델 = "${row[15]}"`);
        console.log(`  Q열(17번째, index 16): 색상 = "${row[16]}"`);
        console.log(`  R열(18번째, index 17): 용량 = "${row[17]}"`);
        console.log(`  AF열(32번째, index 31): 유형 = "${row.length > 31 ? row[31] : '컬럼 없음'}"`);
        console.log(`  AI열(35번째, index 34): 사이트메모 = "${row.length > 34 ? row[34] : '컬럼 없음'}"`);
        console.log(`  Z열(26번째, index 25): 접수자 = "${row[25]}"`);
        console.log(`--- 처리된 값 ---`);
        console.log(`  모델: "${model}"`);
        console.log(`  색상: "${color}"`);
        console.log(`  용량: "${capacity}"`);
        console.log(`  유형: "${type}"`);
        console.log(`  사이트메모: "${reservationMemo}"`);
        console.log(`  접수자: "${receiver}"`);
        console.log(`  모델/용량/색상: "${modelCapacityColor}"`);
        console.log(`=== 디버깅 끝 ===`);
      }

      // 마당접수 정보 매칭
      const normalizedReservationNumber = normalizeReservationNumber(reservationNumber);
      const yardInfo = yardIndex.get(normalizedReservationNumber) || {};
      
      // 온세일접수 정보 매칭 (온세일 → 모바일가입내역 순서로 찾기)
      const onSaleKey = `${customerName}_${storeCode}`;
      let onSaleReceivedDate = onSaleIndex.get(onSaleKey) || '';
      
      // 온세일에서 찾지 못한 경우 모바일가입내역에서 찾기
      if (!onSaleReceivedDate && mobileJoinIndex.has(normalizedReservationNumber)) {
        onSaleReceivedDate = mobileJoinIndex.get(normalizedReservationNumber);
      }

      return {
        reservationNumber,
        customerName,
        reservationDateTime,
        modelCapacityColor, // 모델&용량&색상으로 변경
        type,
        reservationMemo,
        storeCode,
        posName: mappedPosName, // 매핑된 POS명 사용
        manager, // 담당자 정보 추가
        yardReceivedDate: yardInfo.receivedDate || '',
        yardReceivedMemo: yardInfo.receivedMemo || '',
        onSaleReceivedDate,
        receiver: receiver, // 사전예약사이트 Z열에서 가져온 접수자
        rowIndex: index + 2,
        // 재고배정 상태는 별도 API에서 가져올 예정
        assignmentStatus: '로딩중...',
        activationStatus: '로딩중...'
      };
    });

    console.log(`전체 고객리스트 생성 완료: ${customerList.length}개 고객`);

    // 사이트예약(예약일시) 기준으로 오름차순 정렬
    customerList.sort((a, b) => {
      const dateA = new Date(a.reservationDateTime);
      const dateB = new Date(b.reservationDateTime);
      return dateA - dateB;
    });

    const result = {
      success: true,
      data: customerList,
      stats: {
        totalCustomers: customerList.length,
        totalYardReceived: customerList.filter(c => c.yardReceivedDate).length,
        totalOnSaleReceived: customerList.filter(c => c.onSaleReceivedDate).length,
        cacheInfo: {
          cached: false,
          timestamp: new Date().toISOString(),
          ttl: 300
        }
      }
    };

    // 캐시 저장 (5분)
    cacheUtils.set(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    console.error('전체 고객리스트 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load all customer list',
      message: error.message
    });
  }
});

// 담당자 수동 매칭 저장 API
app.post('/api/sales-by-store/update-agent', async (req, res) => {
  try {
    const { storeCode, posName, agent } = req.body;
    
    // 여기서는 임시로 성공 응답만 반환
    // 실제로는 구글시트에 저장하거나 별도 저장소에 저장할 수 있음
    
    // 캐시 무효화
    cacheUtils.deletePattern('sales_by_store');
    
    res.json({
      success: true,
      message: '담당자가 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('담당자 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update agent',
      message: error.message
    });
  }
});

// POS코드변경설정 조회 API
app.get('/api/pos-code-mappings', async (req, res) => {
  try {
    console.log('POS코드변경설정 조회 요청');
    
    // POS코드변경설정 시트에서 데이터 로드
    const posCodeMappingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'POS코드변경설정!A:H'
    });

    if (!posCodeMappingResponse.data.values) {
      return res.json({
        success: true,
        mappings: []
      });
    }

    const posCodeMappingData = posCodeMappingResponse.data.values.slice(1); // 헤더 제거
    
    // 매핑 데이터 변환
    const mappings = posCodeMappingData.map((row, index) => ({
      id: index + 1,
      originalCode: row[0] || '', // A열: 원본 POS코드
      receiverCode: row[1] || '', // B열: 접수자명 (POS코드용)
      mappedCode: row[2] || '',   // C열: 변경될 POS코드
      descriptionCode: row[3] || '', // D열: 설명 (POS코드용)
      originalName: row[4] || '', // E열: 원본 POS명
      receiverName: row[5] || '', // F열: 접수자명 (POS명용)
      mappedName: row[6] || '',   // G열: 변경될 POS명
      descriptionName: row[7] || '' // H열: 설명 (POS명용)
    })).filter(mapping => (mapping.originalCode && mapping.mappedCode) || (mapping.originalName && mapping.mappedName)); // 빈 데이터 제거

    console.log(`POS코드변경설정 로드 완료: ${mappings.length}개 매핑`);

    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    console.error('POS코드변경설정 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load POS code mappings',
      message: error.message
    });
  }
});

// POS코드변경설정 저장 API
app.post('/api/pos-code-mappings', async (req, res) => {
  try {
    const { mappings } = req.body;
    console.log('POS코드변경설정 저장 요청:', mappings.length, '개 매핑');

    // 데이터 검증
    if (!Array.isArray(mappings)) {
      throw new Error('매핑 데이터가 올바르지 않습니다.');
    }

    // 시트에 저장할 데이터 준비 (헤더 포함)
    const sheetData = [
      ['원본 POS코드', '접수자명', '변경될 POS코드', '설명', '원본 POS명', '접수자명', '변경될 POS명', '설명'] // 헤더
    ];

    // 매핑 데이터 추가
    mappings.forEach(mapping => {
      sheetData.push([
        mapping.originalCode || '',
        mapping.receiverCode || '',
        mapping.mappedCode || '',
        mapping.descriptionCode || '',
        mapping.originalName || '',
        mapping.receiverName || '',
        mapping.mappedName || '',
        mapping.descriptionName || ''
      ]);
    });

    // Google Sheets에 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'POS코드변경설정!A:H',
      valueInputOption: 'RAW',
      resource: {
        values: sheetData
      }
    });

    console.log('POS코드변경설정 저장 완료');

    // 캐시 무효화
    cacheUtils.deletePattern('sales_by_store');

    res.json({
      success: true,
      message: 'POS코드변경설정이 성공적으로 저장되었습니다.',
      savedCount: mappings.length
    });
  } catch (error) {
    console.error('POS코드변경설정 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save POS code mappings',
      message: error.message
    });
  }
});

// 개별 POS코드 매핑 추가 API
app.post('/api/pos-code-mapping', async (req, res) => {
  try {
    const { posCode, storeCode } = req.body;
    
    if (!posCode || !storeCode) {
      return res.status(400).json({
        success: false,
        message: 'POS코드와 매장코드를 모두 입력해주세요.'
      });
    }

    // 기존 매핑 데이터 로드
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'POS코드변경설정!A:H'
    });

    let existingMappings = [];
    if (existingResponse.data.values && existingResponse.data.values.length > 1) {
      existingMappings = existingResponse.data.values.slice(1).map(row => ({
        originalCode: row[0] || '',
        receiverCode: row[1] || '',
        mappedCode: row[2] || '',
        description: row[3] || '',
        originalName: row[4] || '',
        receiverName: row[5] || '',
        mappedName: row[6] || '',
        nameDescription: row[7] || ''
      }));
    }

    // 중복 확인
    const isDuplicate = existingMappings.some(mapping => 
      mapping.originalCode === posCode && mapping.mappedCode === storeCode
    );

    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        message: '이미 동일한 매핑이 존재합니다.'
      });
    }

    // 새 매핑 추가
    const newMapping = {
      originalCode: posCode,
      receiverCode: '',
      mappedCode: storeCode,
      description: '매핑 실패 모달에서 추가됨',
      originalName: '',
      receiverName: '',
      mappedName: '',
      nameDescription: ''
    };

    existingMappings.push(newMapping);

    // 시트에 저장할 데이터 준비
    const sheetData = [
      ['원본 POS코드', '접수자명', '변경될 POS코드', '설명', '원본 POS명', '접수자명', '변경될 POS명', '설명']
    ];

    existingMappings.forEach(mapping => {
      sheetData.push([
        mapping.originalCode,
        mapping.receiverCode,
        mapping.mappedCode,
        mapping.description,
        mapping.originalName,
        mapping.receiverName,
        mapping.mappedName,
        mapping.nameDescription
      ]);
    });

    // 시트에 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'POS코드변경설정!A:H',
      valueInputOption: 'RAW',
      resource: {
        values: sheetData
      }
    });

    console.log(`POS코드 매핑 추가: ${posCode} -> ${storeCode}`);

    res.json({
      success: true,
      message: '매핑이 성공적으로 추가되었습니다.',
      mapping: newMapping
    });

  } catch (error) {
    console.error('POS코드 매핑 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '매핑 추가 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 매핑 실패 원인 분석 API
app.get('/api/mapping-failure-analysis', async (req, res) => {
  try {
    const { posCode } = req.query;
    
    if (!posCode) {
      return res.status(400).json({
        success: false,
        message: 'POS코드를 입력해주세요.'
      });
    }

    // 1. 폰클출고처데이터에서 해당 POS코드가 존재하는지 확인
    const phoneklResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:V'
    });

    let phoneklHasCode = false;
    let phoneklManager = '';
    if (phoneklResponse.data.values && phoneklResponse.data.values.length > 3) {
      const phoneklData = phoneklResponse.data.values.slice(3);
      const foundRow = phoneklData.find(row => 
        row.length >= 22 && (row[15] || '').toString().trim() === posCode
      );
      
      if (foundRow) {
        phoneklHasCode = true;
        phoneklManager = (foundRow[21] || '').toString().trim();
      }
    }

    // 2. POS코드변경설정에서 매핑이 설정되어 있는지 확인
    const mappingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'POS코드변경설정!A:H'
    });

    let hasMapping = false;
    let mappedCode = '';
    if (mappingResponse.data.values && mappingResponse.data.values.length > 1) {
      const mappingData = mappingResponse.data.values.slice(1);
      const foundMapping = mappingData.find(row => 
        (row[0] || '').toString().trim() === posCode
      );
      
      if (foundMapping) {
        hasMapping = true;
        mappedCode = (foundMapping[2] || '').toString().trim();
      }
    }

    // 3. 사전예약사이트에서 해당 POS코드 사용 현황 확인
    const reservationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '사전예약사이트!A:AA'
    });

    let reservationUsage = [];
    if (reservationResponse.data.values && reservationResponse.data.values.length > 1) {
      const reservationData = reservationResponse.data.values.slice(1);
      reservationUsage = reservationData
        .filter(row => row.length >= 26 && (row[25] || '').toString().trim() === posCode)
        .slice(0, 3) // 최대 3개만 표시
        .map(row => ({
          customerName: (row[7] || '').toString().trim(),
          reservationNumber: (row[8] || '').toString().trim(),
          receiver: (row[25] || '').toString().trim()
        }));
    }

    // 4. 실패 원인 분석
    const reasons = [];

    if (!phoneklHasCode) {
      reasons.push(`폰클출고처데이터에 매장코드 "${posCode}"가 존재하지 않음`);
    } else {
      reasons.push(`폰클출고처데이터에 매장코드 "${posCode}" 존재 (담당자: ${phoneklManager || '없음'})`);
    }

    if (!hasMapping) {
      reasons.push(`POS코드변경설정에 "${posCode}" 매핑이 설정되지 않음`);
    } else {
      reasons.push(`POS코드변경설정에 "${posCode}" → "${mappedCode}" 매핑 존재`);
    }

    if (reservationUsage.length === 0) {
      reasons.push(`사전예약사이트에서 "${posCode}" 사용 내역 없음`);
    } else {
      reasons.push(`사전예약사이트에서 "${posCode}" 사용: ${reservationUsage.length}건`);
      reasons.push(`사용 예시: ${reservationUsage.map(item => `${item.customerName}(${item.reservationNumber})`).join(', ')}`);
    }

    // 5. 해결 방안 제시
    const solutions = [];
    
    if (!phoneklHasCode && !hasMapping) {
      solutions.push(`1. 폰클출고처데이터에 "${posCode}" 매장코드 추가`);
      solutions.push(`2. 또는 POS코드변경설정에서 다른 매장코드로 매핑`);
    } else if (phoneklHasCode && !hasMapping) {
      solutions.push(`1. POS코드변경설정에서 "${posCode}" → "${posCode}" 매핑 추가`);
    } else if (!phoneklHasCode && hasMapping) {
      solutions.push(`1. 폰클출고처데이터에 "${mappedCode}" 매장코드 확인`);
    }

    res.json({
      success: true,
      posCode,
      reasons,
      solutions,
      details: {
        phoneklHasCode,
        phoneklManager,
        hasMapping,
        mappedCode,
        reservationUsageCount: reservationUsage.length,
        reservationUsage
      }
    });

  } catch (error) {
    console.error('매핑 실패 원인 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: '분석 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 마당접수 데이터 누락 분석 API
app.get('/api/yard-receipt-missing-analysis', async (req, res) => {
  try {
    console.log('마당접수 데이터 누락 분석 시작');

    // 1. 마당접수 시트 데이터 로드
    const yardResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '마당접수!A:X'
    });

    // 2. 사전예약사이트 데이터 로드
    const reservationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '사전예약사이트!A:AA'
    });

    // 3. 온세일 데이터 로드
    const onSaleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '온세일!A:AA'
    });

    if (!yardResponse.data.values || !reservationResponse.data.values || !onSaleResponse.data.values) {
      throw new Error('시트 데이터를 불러올 수 없습니다.');
    }

    // 마당접수 데이터 처리 (헤더 제외) - 마당접수는 헤더가 1행, 데이터가 2행부터
    const yardData = yardResponse.data.values.slice(1);
    const reservationData = reservationResponse.data.values.slice(1);
    
    console.log(`마당접수 원본 데이터 행 수: ${yardResponse.data.values.length}`);
    console.log(`마당접수 처리 후 데이터 행 수: ${yardData.length}`);
    console.log(`마당접수 첫 번째 데이터 행:`, yardData[0]?.slice(0, 5));

    // 마당접수에서 예약번호 추출 (정규화) - 매칭용
    const yardReservationNumbers = new Set();
    yardData.forEach(row => {
      if (row.length >= 8) {
        const reservationNumber = (row[7] || '').toString().trim(); // H열: 예약번호
        if (reservationNumber) {
          yardReservationNumbers.add(reservationNumber.replace(/-/g, ''));
        }
      }
    });

    // 온세일 데이터에서 고객명_매장코드 조합 추출
    const onSaleIndex = new Set();
    onSaleResponse.data.values.slice(1).forEach(row => {
      if (row.length >= 3) {
        const customerName = (row[0] || '').toString().trim();
        const storeCode = (row[2] || '').toString().trim();
        if (customerName && storeCode) {
          onSaleIndex.add(`${customerName}_${storeCode}`);
        }
      }
    });

    // 마당접수 데이터 분석
    const yardAnalysis = {
      total: 0,
      matched: 0,
      unmatched: 0,
      missingDetails: []
    };

    // 사전예약사이트에서 예약번호 추출 (정규화) - 매칭 확인용
    const reservationNumbers = new Set();
    reservationData.forEach(row => {
      if (row.length >= 9) {
        const reservationNumber = (row[8] || '').toString().trim();
        if (reservationNumber) {
          reservationNumbers.add(reservationNumber.replace(/-/g, ''));
        }
      }
    });

    yardData.forEach((row, index) => {
      if (row.length < 22) {
        console.log(`행 ${index + 2}: 컬럼 수 부족 (${row.length}개, 최소 22개 필요)`);
        return; // V열까지 필요하므로 최소 22개 컬럼
      }
      
      // H열에서 "열람" 텍스트 확인 (이전 방식)
      const hValue = (row[7] || '').toString().trim(); // H열: "열람" 텍스트
      console.log(`행 ${index + 2}: H열="${hValue}"`);
      
      if (hValue !== '열람') {
        console.log(`행 ${index + 2}: H열이 "열람"이 아님`);
        return; // "열람"이 아니면 건너뛰기
      }
      
      yardAnalysis.total++;
      
      // U열, V열에서 예약번호 추출
      const uValue = (row[20] || '').toString().trim(); // U열
      const vValue = (row[21] || '').toString().trim(); // V열
      
      // 예약번호 패턴 찾기 (하이픈이 없는 형태: XX000000)
      const reservationPattern = /[A-Z]{2}\d{6}/g;
      const uMatches = uValue.match(reservationPattern) || [];
      const vMatches = vValue.match(reservationPattern) || [];
      const allMatches = [...uMatches, ...vMatches];
      
      const normalizedReservationNumber = allMatches.length > 0 ? allMatches[0] : '';
      const isMatched = normalizedReservationNumber && reservationNumbers.has(normalizedReservationNumber);
      
      if (isMatched) {
        yardAnalysis.matched++;
      } else {
        yardAnalysis.unmatched++;
        yardAnalysis.missingDetails.push({
          rowIndex: index + 2, // 실제 행 번호
          reservationNumber: normalizedReservationNumber || '예약번호 없음',
          posCode: (row[17] || '').toString().trim(), // R열: POS코드
          storeName: (row[18] || '').toString().trim(), // S열: 상호명
          customerName: (row[23] || '').toString().trim(), // X열: 고객명
          receivedDateTime: (row[11] || '').toString().trim(), // L열: 접수시간
          receivedMemo: (row[20] || '').toString().trim(), // U열: 수신점메모
          reason: normalizedReservationNumber ? '사전예약사이트에 예약번호 없음' : '예약번호 추출 실패'
        });
      }
    });

    // 대시보드에서 사용하는 정확한 서류접수 완료 건수 가져오기
    let appCalculatedCount = 0;
    
    try {
      // 기존 대시보드 API와 동일한 로직 사용
      const salesResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/sales-by-store/data`);
      if (salesResponse.ok) {
        const salesResult = await salesResponse.json();
        if (salesResult.success) {
          appCalculatedCount = salesResult.stats?.totalDocumentReceived || 0;
          console.log(`대시보드 API에서 가져온 서류접수 완료 건수: ${appCalculatedCount}건`);
        }
      }
    } catch (error) {
      console.error('대시보드 API 호출 실패:', error);
      // 대시보드 API 실패 시 직접 계산
      reservationData.forEach((row, index) => {
        if (row.length < 26) return;
        
        const reservationNumber = (row[8] || '').toString().trim();
        const customerName = (row[7] || '').toString().trim();
        const storeCode = (row[25] || '').toString().trim();
        
        if (!reservationNumber) return;
        
        const normalizedReservationNumber = reservationNumber.replace(/-/g, '');
        const isYardReceived = yardReservationNumbers.has(normalizedReservationNumber);
        const isOnSaleReceived = onSaleIndex.has(`${customerName}_${storeCode}`);
        
        if (isYardReceived || isOnSaleReceived) {
          appCalculatedCount++;
        }
      });
      console.log(`직접 계산한 서류접수 완료 건수: ${appCalculatedCount}건`);
    }

    const result = {
      success: true,
      analysis: {
        yardReceipt: {
          total: yardAnalysis.total,
          matched: yardAnalysis.matched,
          unmatched: yardAnalysis.unmatched,
          missingDetails: yardAnalysis.missingDetails.slice(0, 50) // 최대 50개만 반환
        },
        appCalculation: {
          totalReservations: reservationData.length,
          calculatedReceived: appCalculatedCount
        },
        difference: {
          yardTotal: yardAnalysis.total,
          appCalculated: appCalculatedCount,
          difference: yardAnalysis.unmatched // 실제 누락된 상세 항목 수
        }
      }
    };

    console.log('마당접수 누락 분석 완료:', {
      마당접수총건수: yardAnalysis.total,
      앱계산건수: appCalculatedCount,
      차이: yardAnalysis.total - appCalculatedCount,
      매칭된건수: yardAnalysis.matched,
      매칭안된건수: yardAnalysis.unmatched,
      누락상세건수: yardAnalysis.missingDetails.length
    });
    
    console.log('누락 상세 분석:');
    const reasonCounts = {};
    yardAnalysis.missingDetails.forEach(item => {
      reasonCounts[item.reason] = (reasonCounts[item.reason] || 0) + 1;
    });
    console.log('원인별 건수:', reasonCounts);
    
    // 중복 예약번호 확인
    const missingReservationNumbers = new Set();
    const duplicateReservations = new Set();
    yardAnalysis.missingDetails.forEach(item => {
      if (missingReservationNumbers.has(item.reservationNumber)) {
        duplicateReservations.add(item.reservationNumber);
      } else {
        missingReservationNumbers.add(item.reservationNumber);
      }
    });
    console.log('중복된 예약번호:', Array.from(duplicateReservations));
    console.log('고유 예약번호 수:', missingReservationNumbers.size);
    console.log('총 누락 상세 항목 수:', yardAnalysis.missingDetails.length);

    res.json(result);

  } catch (error) {
    console.error('마당접수 누락 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: '분석 중 오류가 발생했습니다: ' + error.message
    });
  }
});

// 재고 현황 분석 API (대리점별 분리)
app.get('/api/inventory-analysis', async (req, res) => {
  const { storeCode } = req.query; // 대리점 코드 필터링 (선택사항)
  
  try {
    // 1. 대리점 코드 매핑 정보 로드
    let storeCodeMapping = {};
    try {
      const mappingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '폰클재고데이터!K:K'
      });
      
      if (mappingResponse.data.values && mappingResponse.data.values.length > 1) {
        // K열에서 대리점명과 코드 매핑 정보 추출
        const mappingData = mappingResponse.data.values.slice(1);
        mappingData.forEach((row, index) => {
          const storeName = row[0] || '';
          if (storeName) {
            // 매핑 규칙 적용
            if (storeName.includes('LG사업자폰(경수)')) {
              storeCodeMapping['306891'] = storeName;
            } else if (storeName.includes('LG사업자폰(군산)')) {
              storeCodeMapping['314942'] = storeName;
            } else if (storeName.includes('LG사업자폰(인천)')) {
              storeCodeMapping['315835'] = storeName;
            }
          }
        });
      }
    } catch (error) {
      console.log('대리점 코드 매핑 로드 실패:', error.message);
    }

        console.log('대리점 코드 매핑:', storeCodeMapping);

    // 2. 정규화 규칙 로드
    let normalizationRules = [];
    try {
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '정규화작업!A:G'
      });
      
      if (rulesResponse.data.values && rulesResponse.data.values.length > 1) {
        normalizationRules = rulesResponse.data.values.slice(1)
          .filter(row => row.length >= 6 && row[5] === '완료')
          .map(row => ({
            reservationSite: row[1] || '',
            phonekl: row[2] || '',
            normalizedModel: row[3] || '',
            note: row[6] || ''
          }));
      }
    } catch (error) {
      console.log('정규화 규칙 로드 실패:', error.message);
    }

    // 2. 사전예약사이트 데이터 로드 (대리점별 필터링)
    let reservationData = [];
    try {
      const reservationResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '사전예약사이트!A:AA'
      });
      
      if (reservationResponse.data.values && reservationResponse.data.values.length > 1) {
        const headers = reservationResponse.data.values[0];
        const dataRows = reservationResponse.data.values.slice(1);
        
        reservationData = dataRows.map((row, index) => {
          const pValue = row[15] || ''; // P열 (16번째, 0부터 시작)
          const qValue = row[16] || ''; // Q열 (17번째, 0부터 시작)
          const rValue = row[17] || ''; // R열 (18번째, 0부터 시작)
          const storeCode = row[23] || ''; // X열 (24번째, 0부터 시작) - 대리점코드
          
          // 정규화 규칙 적용
          let normalizedModel = '';
          for (const rule of normalizationRules) {
            const ruleParts = rule.reservationSite.split(' | ');
            if (ruleParts.length >= 3) {
              const ruleP = ruleParts[0];
              const ruleQ = ruleParts[1];
              const ruleR = ruleParts[2];
              
              const pMatch = !ruleP || pValue.includes(ruleP) || ruleP.includes(pValue);
              const qMatch = !ruleQ || qValue.includes(ruleQ) || ruleQ.includes(qValue);
              const rMatch = !ruleR || rValue.includes(ruleR) || ruleR.includes(rValue);
              
              if (pMatch && qMatch && rMatch) {
                normalizedModel = rule.normalizedModel;
                break;
              }
            }
          }
          
          return {
            reservationNumber: row[8] || '', // I열 (9번째, 0부터 시작)
            originalP: pValue,
            originalQ: qValue,
            originalR: rValue,
            normalizedModel: normalizedModel,
            storeCode: storeCode,
            rowIndex: index + 2
          };
        });
        
        // 대리점 코드별 필터링 적용
        if (storeCode) {
          reservationData = reservationData.filter(item => item.storeCode === storeCode);
          // 대리점 코드 필터링 적용
        }
      }
    } catch (error) {
      // 사전예약사이트 시트 로드 실패
    }

    // 3. 폰클재고데이터 로드 (재고 수량 포함, 대리점별 필터링)
    let inventoryData = [];
    try {
      const inventoryResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '폰클재고데이터!A:AA'
      });
      
      if (inventoryResponse.data.values && inventoryResponse.data.values.length > 1) {
        const headers = inventoryResponse.data.values[0];
        const dataRows = inventoryResponse.data.values.slice(1);
        
        inventoryData = dataRows.map((row, index) => {
          const fValue = row[5] || ''; // F열 (6번째, 0부터 시작) - 모델
          const gValue = row[6] || ''; // G열 (7번째, 0부터 시작) - 색상
          const storeName = row[10] || ''; // K열 (11번째, 0부터 시작) - 대리점명
          
          // 여러 열에서 수량 확인 (H, I, J, K, L열)
          const quantityH = parseInt(row[7] || '0') || 0; // H열
          const quantityI = parseInt(row[8] || '0') || 0; // I열
          const quantityJ = parseInt(row[9] || '0') || 0; // J열
          const quantityK = parseInt(row[10] || '0') || 0; // K열
          const quantityL = parseInt(row[11] || '0') || 0; // L열
          
          // 첫 번째로 0이 아닌 수량을 사용
          const quantity = quantityH || quantityI || quantityJ || quantityK || quantityL;
          
          // 대리점 코드 결정
          let storeCode = '';
          if (storeName.includes('LG사업자폰(경수)')) {
            storeCode = '306891';
          } else if (storeName.includes('LG사업자폰(군산)')) {
            storeCode = '314942';
          } else if (storeName.includes('LG사업자폰(인천)')) {
            storeCode = '315835';
          }
          
          // 디버깅: 처음 5개 행의 모든 열 값 확인
          if (index < 5) {
            console.log(`행 ${index + 2}: F="${fValue}", G="${gValue}", 대리점="${storeName}", 코드="${storeCode}", H=${quantityH}, I=${quantityI}, J=${quantityJ}, K=${quantityK}, L=${quantityL}, 최종수량=${quantity}`);
          }
          
          // 폰클재고데이터의 F열, G열을 그대로 사용하여 정규화 규칙과 매칭
          let normalizedModel = '';
          
          // 빈 값이나 헤더 행은 정규화하지 않음
          if (!fValue.trim() || !gValue.trim() || 
              fValue.trim() === '모델명' || gValue.trim() === '색상') {
            normalizedModel = '';
          } else {
            for (const rule of normalizationRules) {
              const ruleParts = rule.phonekl.split(' | ');
              if (ruleParts.length >= 2) {
                const ruleF = ruleParts[0]; // 정규화 규칙의 F열 값
                const ruleG = ruleParts[1]; // 정규화 규칙의 G열 값
                
                // 빈 규칙 값은 매칭하지 않음
                if (!ruleF.trim() || !ruleG.trim()) continue;
                
                // 더 유연한 매칭: 부분 문자열 포함 또는 정확한 일치
                const fMatch = fValue.trim() === ruleF.trim() || 
                             fValue.trim().includes(ruleF.trim()) || 
                             ruleF.trim().includes(fValue.trim());
                const gMatch = gValue.trim() === ruleG.trim() || 
                             gValue.trim().includes(ruleG.trim()) || 
                             ruleG.trim().includes(gValue.trim());
                
                if (fMatch && gMatch) {
                  normalizedModel = rule.normalizedModel;
                  break;
                }
              }
            }
          }
          
          return {
            originalF: fValue,
            originalG: gValue,
            normalizedModel: normalizedModel,
            quantity: quantity,
            storeName: storeName,
            storeCode: storeCode,
            rowIndex: index + 2
          };
        });
        
        // 대리점 코드별 필터링 적용
        if (storeCode) {
          inventoryData = inventoryData.filter(item => item.storeCode === storeCode);
          // 대리점 코드 필터링 적용
        }
      }
    } catch (error) {
      console.log('폰클재고데이터 시트 로드 실패:', error.message);
    }
    
    // 폰클재고데이터 수량 통계
    const totalQuantity = inventoryData.reduce((sum, item) => sum + item.quantity, 0);
    const itemsWithQuantity = inventoryData.filter(item => item.quantity > 0).length;
    console.log('폰클재고데이터 수량 통계:', {
      총수량: totalQuantity,
      수량있는항목수: itemsWithQuantity,
      전체항목수: inventoryData.length,
      평균수량: inventoryData.length > 0 ? (totalQuantity / inventoryData.length).toFixed(2) : 0
    });

    // 4. 재고 현황 분석
    const inventoryAnalysis = {};
    
    // 디버깅: 정규화 규칙 로그
    console.log('=== 재고 현황 분석 디버깅 ===');
    console.log('정규화 규칙 개수:', normalizationRules.length);
    console.log('정규화 규칙 샘플:', normalizationRules.slice(0, 3));
    
    // 디버깅: 폰클재고데이터 정규화 결과
    console.log('폰클재고데이터 총 개수:', inventoryData.length);
    const normalizedInventoryCount = inventoryData.filter(item => item.normalizedModel).length;
    console.log('정규화된 재고 데이터 개수:', normalizedInventoryCount);
    console.log('정규화되지 않은 재고 데이터 샘플:', 
      inventoryData.filter(item => !item.normalizedModel).slice(0, 5).map(item => ({
        F: item.originalF,
        G: item.originalG,
        수량: item.quantity
      }))
    );
    
    // 정규화 규칙과 실제 데이터 비교 디버깅
    console.log('=== 정규화 규칙 vs 실제 데이터 비교 ===');
    const sampleUnnormalized = inventoryData.filter(item => !item.normalizedModel).slice(0, 3);
    sampleUnnormalized.forEach((item, index) => {
      console.log(`샘플 ${index + 1}: F="${item.originalF}", G="${item.originalG}"`);
      console.log('매칭 시도한 규칙들:');
      normalizationRules.slice(0, 3).forEach((rule, ruleIndex) => {
        const ruleParts = rule.phonekl.split(' | ');
        if (ruleParts.length >= 2) {
          const ruleF = ruleParts[0];
          const ruleG = ruleParts[1];
          console.log(`  규칙 ${ruleIndex + 1}: F="${ruleF}", G="${ruleG}"`);
        }
      });
    });
    
    // 정규화되지 않은 모델들의 통계
    const unnormalizedModels = new Set();
    inventoryData.filter(item => !item.normalizedModel).forEach(item => {
      unnormalizedModels.add(`${item.originalF} | ${item.originalG}`);
    });
    console.log('정규화되지 않은 모델 조합 개수:', unnormalizedModels.size);
    console.log('정규화되지 않은 모델 조합 샘플:', Array.from(unnormalizedModels).slice(0, 10));
    
    // 정규화된 모델들의 통계
    const normalizedModels = new Set();
    inventoryData.filter(item => item.normalizedModel).forEach(item => {
      normalizedModels.add(`${item.originalF} | ${item.originalG} -> ${item.normalizedModel}`);
    });
    console.log('정규화된 모델 조합 개수:', normalizedModels.size);
    console.log('정규화된 모델 조합 샘플:', Array.from(normalizedModels).slice(0, 10));
    
    // 정규화된 모델별로 재고 수량 집계
    const inventoryByModel = {};
    const quantityDebug = [];
    
    // 정규화된 모델명에서 F열, G열 값 추출하여 재고 수량 찾기
    const uniqueNormalizedModels = new Set();
    inventoryData.filter(item => item.normalizedModel).forEach(item => {
      uniqueNormalizedModels.add(item.normalizedModel);
    });
    
    uniqueNormalizedModels.forEach(normalizedModel => {
      // 정규화된 모델명에서 F열, G열 값 추출
      // 예: "Z Fold7 512G 실버 쉐도우 SM-F966N_512G 실버 쉐도우" -> F="SM-F966N_512G", G="실버 쉐도우"
      const modelParts = normalizedModel.split(' ');
      let extractedF = '';
      let extractedG = '';
      
      // 마지막 부분에서 F열 값 추출 (SM-으로 시작하는 부분)
      for (let i = modelParts.length - 1; i >= 0; i--) {
        if (modelParts[i].startsWith('SM-')) {
          extractedF = modelParts[i];
          // F열 값 앞의 색상 부분을 G열 값으로 추출
          if (i > 0) {
            extractedG = modelParts[i - 1];
            // 색상이 두 단어일 수 있음 (예: "실버 쉐도우")
            if (i > 1 && !modelParts[i - 2].startsWith('SM-') && !modelParts[i - 2].includes('G')) {
              extractedG = modelParts[i - 2] + ' ' + modelParts[i - 1];
            }
          }
          break;
        }
      }
      
      console.log(`정규화된 모델 "${normalizedModel}" -> F="${extractedF}", G="${extractedG}"`);
      
      // 해당 F, G 조합의 총 행 수 확인
      const matchingRows = inventoryData.filter(item => item.originalF === extractedF && item.originalG === extractedG);
      console.log(`  매칭된 행 수: ${matchingRows.length}, 총 수량: ${matchingRows.reduce((sum, item) => sum + item.quantity, 0)}`);
      
      // 추출된 F열, G열 값으로 폰클재고데이터에서 해당 조합의 개수 세기
      const matchingItems = inventoryData.filter(item => 
        item.originalF === extractedF && item.originalG === extractedG
      );
      
      const totalCount = matchingItems.length; // 해당 조합의 총 개수
      
      console.log(`  ${extractedF} | ${extractedG} 조합 개수: ${totalCount}개`);
      
              inventoryByModel[normalizedModel] = totalCount;
    });
    
    console.log('수량이 있는 정규화된 재고 항목들:', quantityDebug.slice(0, 10));
    console.log('전체 재고 수량 분포:', {
      총항목수: inventoryData.length,
      정규화된항목수: inventoryData.filter(item => item.normalizedModel).length,
      수량있는항목수: inventoryData.filter(item => item.quantity > 0).length,
      정규화되고수량있는항목수: inventoryData.filter(item => item.normalizedModel && item.quantity > 0).length
    });
    
    console.log('재고 모델별 집계 결과:', Object.keys(inventoryByModel).length, '개 모델');
    console.log('재고 모델별 집계 샘플:', Object.entries(inventoryByModel).slice(0, 5));
    
    // 정규화된 모델별로 사전예약 건수 집계
    const reservationByModel = {};
    reservationData.forEach(item => {
      if (item.normalizedModel) {
        if (!reservationByModel[item.normalizedModel]) {
          reservationByModel[item.normalizedModel] = 0;
        }
        reservationByModel[item.normalizedModel]++;
      }
    });
    
    // 재고 현황 분석 결과 생성
    const allModels = new Set([
      ...Object.keys(inventoryByModel),
      ...Object.keys(reservationByModel)
    ]);
    
    allModels.forEach(model => {
      const inventory = inventoryByModel[model] || 0;
      const reservations = reservationByModel[model] || 0;
      const remainingStock = inventory - reservations;
      
      inventoryAnalysis[model] = {
        inventory: inventory,
        reservations: reservations,
        remainingStock: remainingStock,
        status: remainingStock > 0 ? '충분' : remainingStock === 0 ? '부족' : '초과예약'
      };
    });

    // 5. 통계 정보
    const totalInventory = Object.values(inventoryByModel).reduce((sum, qty) => sum + qty, 0);
    const totalReservations = Object.values(reservationByModel).reduce((sum, count) => sum + count, 0);
    const totalRemainingStock = Object.values(inventoryAnalysis).reduce((sum, item) => sum + item.remainingStock, 0);
    
    const stats = {
      totalModels: allModels.size,
      totalInventory: totalInventory,
      totalReservations: totalReservations,
      totalRemainingStock: totalRemainingStock,
      modelsWithSufficientStock: Object.values(inventoryAnalysis).filter(item => item.status === '충분').length,
      modelsWithInsufficientStock: Object.values(inventoryAnalysis).filter(item => item.status === '부족').length,
      modelsWithOverReservation: Object.values(inventoryAnalysis).filter(item => item.status === '초과예약').length
    };

    res.json({
      success: true,
      inventoryAnalysis: inventoryAnalysis,
      stats: stats,
      inventoryByModel: inventoryByModel,
      reservationByModel: reservationByModel,
      storeCode: storeCode || 'all',
      storeCodeMapping: storeCodeMapping
    });
  } catch (error) {
    console.error('재고 현황 분석 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze inventory',
      message: error.message
    });
  }
});

// 정규화 상태 확인 API
app.get('/api/reservation-settings/normalization-status', async (req, res) => {
  try {
    console.log('정규화 상태 확인 요청');
    
    // 정규화 규칙들을 불러오기
    let normalizationRules = [];
    try {
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '정규화작업!A:G'
      });
      
      if (rulesResponse.data.values && rulesResponse.data.values.length > 1) {
        normalizationRules = rulesResponse.data.values.slice(1)
          .filter(row => row.length >= 6 && row[5] === '완료')
          .map(row => ({
            reservationSite: row[1] || '',
            phonekl: row[2] || '',
            normalizedModel: row[3] || '',
            note: row[6] || ''
          }));
      }
    } catch (error) {
      console.log('정규화 규칙 로드 실패:', error.message);
    }

    // 정규화 상태 판단
    const isNormalized = normalizationRules.length > 0;
    const totalRules = normalizationRules.length;
    const completedRules = normalizationRules.filter(rule => rule.normalizedModel).length;

    console.log(`정규화 상태 확인 완료: ${isNormalized ? '완료' : '미완료'} (총 ${totalRules}개 규칙, 완료 ${completedRules}개)`);

    res.json({
      success: true,
      isNormalized,
      totalRules,
      completedRules,
      rules: normalizationRules
    });
  } catch (error) {
    console.error('정규화 상태 확인 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check normalization status',
      message: error.message
    });
  }
});

// 정규화 규칙 적용 테스트 API
app.post('/api/reservation-settings/test-normalization', async (req, res) => {
  try {
    const { testData, dataType } = req.body; // dataType: 'reservationSite' 또는 'phonekl'
    
    // 정규화 규칙들을 불러오기
    let normalizationRules = [];
    try {
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '정규화작업!A:G'
      });
      
      if (rulesResponse.data.values && rulesResponse.data.values.length > 1) {
        normalizationRules = rulesResponse.data.values.slice(1)
          .filter(row => row.length >= 6 && row[5] === '완료')
          .map(row => ({
            reservationSite: row[1] || '',
            phonekl: row[2] || '',
            normalizedModel: row[3] || '',
            note: row[6] || ''
          }));
      }
    } catch (error) {
      console.log('정규화 규칙 로드 실패:', error.message);
    }

    // 테스트 데이터에 정규화 규칙 적용
    const testResults = testData.map(item => {
      let normalizedModel = '';
      let appliedRule = null;
      
      if (dataType === 'reservationSite') {
        const { p, q, r } = item;
        
        for (const rule of normalizationRules) {
          const ruleParts = rule.reservationSite.split(' | ');
          if (ruleParts.length >= 3) {
            const ruleP = ruleParts[0];
            const ruleQ = ruleParts[1];
            const ruleR = ruleParts[2];
            
            const pMatch = !ruleP || p.includes(ruleP) || ruleP.includes(p);
            const qMatch = !ruleQ || q.includes(ruleQ) || ruleQ.includes(q);
            const rMatch = !ruleR || r.includes(ruleR) || ruleR.includes(r);
            
            if (pMatch && qMatch && rMatch) {
              normalizedModel = rule.normalizedModel;
              appliedRule = rule;
              break;
            }
          }
        }
      } else if (dataType === 'phonekl') {
        const { f, g } = item;
        
        for (const rule of normalizationRules) {
          const ruleParts = rule.phonekl.split(' | ');
          if (ruleParts.length >= 2) {
            const ruleF = ruleParts[0];
            const ruleG = ruleParts[1];
            
            const fMatch = !ruleF || f.includes(ruleF) || ruleF.includes(f);
            const gMatch = !ruleG || g.includes(ruleG) || ruleG.includes(g);
            
            if (fMatch && gMatch) {
              normalizedModel = rule.normalizedModel;
              appliedRule = rule;
              break;
            }
          }
        }
      }
      
      return {
        ...item,
        normalizedModel,
        appliedRule
      };
    });

    res.json({
      success: true,
      testResults,
      appliedRules: normalizationRules
    });
  } catch (error) {
    console.error('정규화 테스트 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test normalization',
      message: error.message
    });
  }
});

// 사전예약 데이터 API 엔드포인트들
app.get('/api/reservation-data/on-sale-receipt', async (req, res) => {
  try {
    console.log('온세일접수 데이터 요청');
    
    // 온세일 시트에서 데이터 가져오기 (고객명 + 대리점코드 매칭용)
    const sheetName = '온세일';
    const values = await getSheetValues(sheetName);
    
    if (!values || values.length === 0) {
      console.log('온세일 데이터가 없습니다.');
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제거하고 데이터 처리
    const headers = values[0];
    const dataRows = values.slice(1);
    
    const processedData = dataRows
      .filter(row => row.length > 0 && row.some(cell => cell && cell.toString().trim() !== ''))
      .map((row, index) => {
        // 고객명 (C열)
        const customerName = row[2] ? row[2].toString().trim() : '';
        
        // 가입대리점코드 (M열)
        const storeCode = row[12] ? row[12].toString().trim() : '';
        
        // 모델명 (D열)
        const model = row[3] ? row[3].toString().trim() : '';
        
        // 색상 (E열)
        const color = row[4] ? row[4].toString().trim() : '';
        
        // 접수시간 (F열)
        const receiptTime = row[5] ? row[5].toString().trim() : '';
        
        // 유효한 데이터만 반환
        if (customerName && storeCode && model && color) {
          return {
            customerName,
            storeCode,
            model,
            color,
            receiptTime,
            source: 'onSale'
          };
        }
        return null;
      })
      .filter(item => item !== null);
    
    console.log(`온세일 데이터 처리 완료: ${processedData.length}건`);
    
    res.json({ success: true, data: processedData });
    
  } catch (error) {
    console.error('온세일 데이터 가져오기 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reservation-data/yard-receipt', async (req, res) => {
  try {
    console.log('마당접수 데이터 요청');
    
    // 마당접수 시트에서 데이터 가져오기
    const sheetName = '마당접수';
    const values = await getSheetValues(sheetName);
    
    if (!values || values.length === 0) {
      console.log('마당접수 데이터가 없습니다.');
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제거하고 데이터 처리
    const headers = values[0];
    const dataRows = values.slice(1);
    
    const processedData = dataRows
      .filter(row => row.length > 0 && row.some(cell => cell && cell.toString().trim() !== ''))
      .map((row, index) => {
        // 예약번호 (U, V열에서 추출)
        let reservationNumber = '';
        if (row[20]) { // U열
          const match = row[20].toString().match(/[A-Z]{2}\d+/);
          if (match) reservationNumber = match[0];
        }
        if (!reservationNumber && row[21]) { // V열
          const match = row[21].toString().match(/[A-Z]{2}\d+/);
          if (match) reservationNumber = match[0];
        }
        
        // 고객명 (B열)
        const customerName = row[1] ? row[1].toString().trim() : '';
        
        // 모델명 (C열)
        const model = row[2] ? row[2].toString().trim() : '';
        
        // 색상 (D열)
        const color = row[3] ? row[3].toString().trim() : '';
        
        // 접수시간 (L열)
        const receiptTime = row[11] ? row[11].toString().trim() : '';
        
        // 유효한 데이터만 반환
        if (reservationNumber && customerName && model && color) {
          return {
            reservationNumber,
            customerName,
            model,
            color,
            receiptTime,
            source: 'yard'
          };
        }
        return null;
      })
      .filter(item => item !== null);
    
    console.log(`마당접수 데이터 처리 완료: ${processedData.length}건`);
    
    res.json({ success: true, data: processedData });
    
  } catch (error) {
    console.error('마당접수 데이터 가져오기 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reservation-data/reservation-site', async (req, res) => {
  try {
    // 사전예약사이트 데이터 요청
    
    // 사전예약사이트 시트에서 데이터 가져오기
    const sheetName = '사전예약사이트';
    const values = await getSheetValues(sheetName);
    
    if (!values || values.length === 0) {
      console.log('사전예약사이트 데이터가 없습니다.');
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제거하고 데이터 처리
    const headers = values[0];
    const dataRows = values.slice(1);
    
    const processedData = dataRows
      .filter(row => row.length > 0 && row.some(cell => cell && cell.toString().trim() !== ''))
      .map((row, index) => {
        // 예약번호 (I열)
        const reservationNumber = row[8] ? row[8].toString().replace(/-/g, '') : '';
        
        // 고객명 (H열)
        const customerName = row[7] ? row[7].toString().trim() : '';
        
        // 대리점코드 (X열)
        const storeCode = row[23] ? row[23].toString().trim() : '';
        
        // 모델명 (P, Q, R열 조합)
        const pValue = row[15] ? row[15].toString().trim() : '';
        const qValue = row[16] ? row[16].toString().trim() : '';
        const rValue = row[17] ? row[17].toString().trim() : '';
        
        // 색상 (Q열)
        const color = qValue;
        
        // 접수시간 (O열)
        const receiptTime = row[14] ? row[14].toString().trim() : '';
        
        // 유효한 데이터만 반환
        if (reservationNumber && customerName && pValue && qValue && rValue) {
          return {
            reservationNumber,
            customerName,
            storeCode,
            model: `${pValue} ${qValue} ${rValue}`.trim(),
            color,
            receiptTime,
            source: 'site'
          };
        }
        return null;
      })
      .filter(item => item !== null);
    
    console.log(`사전예약사이트 데이터 처리 완료: ${processedData.length}건`);
    
    res.json({ success: true, data: processedData });
    
  } catch (error) {
    console.error('사전예약사이트 데이터 가져오기 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 월간시상 API 라우트
app.get('/api/monthly-award/data', monthlyAwardAPI.getMonthlyAwardData);
app.post('/api/monthly-award/settings', monthlyAwardAPI.saveMonthlyAwardSettings);

// 어플업데이트 API 라우트
app.get('/api/app-updates', async (req, res) => {
  try {
    console.log('어플업데이트 데이터 요청');
    
    const values = await getSheetValues(UPDATE_SHEET_NAME);
    
    if (!values || values.length === 0) {
      console.log('어플업데이트 데이터가 없습니다.');
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 2행 제거하고 데이터 반환 (3행부터 시작)
    const dataRows = values.slice(2);
    
    // 빈 행 제거
    const filteredData = dataRows.filter(row => 
      row.length > 0 && row.some(cell => cell && cell.toString().trim() !== '')
    );
    
    console.log(`어플업데이트 데이터 처리 완료: ${filteredData.length}건`);
    
    res.json({ success: true, data: filteredData });
    
  } catch (error) {
    console.error('어플업데이트 데이터 가져오기 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/app-updates', async (req, res) => {
  try {
    console.log('새 어플업데이트 추가 요청:', req.body);
    
    // 환경 변수 체크
    if (!SPREADSHEET_ID) {
      console.error('❌ [어플업데이트] SHEET_ID 환경 변수가 설정되지 않음');
      return res.status(500).json({ 
        success: false, 
        error: '서버 설정 오류: SHEET_ID가 설정되지 않았습니다.' 
      });
    }
    
    const { mode, date, content } = req.body;
    
    if (!mode || !date || !content) {
      return res.status(400).json({ 
        success: false, 
        error: '모드, 날짜, 내용이 모두 필요합니다.' 
      });
    }
    
    // 모드별 컬럼 매핑
    const modeColumnMap = {
      'general': 2,    // C열: 일반모드
      'agent': 3,      // D열: 관리자모드
      'inventory': 4,  // E열: 재고관리모드
      'settlement': 5, // F열: 정산모드
      'inspection': 6, // G열: 검수모드
      'policy': 7,     // H열: 정책모드
      'meeting': 8,    // I열: 회의모드
      'reservation': 9, // J열: 사전예약모드
      'chart': 10,     // K열: 장표모드
      'budget': 11,    // L열: 예산모드
      'sales': 12,     // M열: 영업모드
      'inventoryRecovery': 13, // N열: 재고회수모드
      'dataCollection': 14,    // O열: 정보수집모드
      'smsManagement': 15,     // P열: SMS 관리모드
      'obManagement': 16       // Q열: OB 관리모드
    };
    
    const columnIndex = modeColumnMap[mode];
    if (columnIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: '유효하지 않은 모드입니다.' 
      });
    }
    
    // 새 행 데이터 생성
    const newRow = new Array(17).fill(''); // A~Q열 (17개 컬럼)
    newRow[0] = date;  // A열: 날짜
    newRow[columnIndex] = content;  // 해당 모드 컬럼에 내용
    
    // Google Sheets에 새 행 추가
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${UPDATE_SHEET_NAME}!A:Q`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    console.log('어플업데이트 추가 완료:', response.data);
    
    res.json({ 
      success: true, 
      message: '업데이트가 성공적으로 추가되었습니다.',
      data: response.data
    });
    
  } catch (error) {
    console.error('어플업데이트 추가 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 정책 취소 API
app.put('/api/policies/:policyId/cancel', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { cancelReason, userId, userName } = req.body;
    
    console.log('정책 취소 요청:', { policyId, cancelReason, userId, userName });
    
    if (!cancelReason || !userId) {
      return res.status(400).json({
        success: false,
        error: '취소 사유와 사용자 정보가 필요합니다.'
      });
    }
    
    // 정책_기본정보 시트에서 해당 정책 찾기
    const values = await getSheetValues('정책_기본정보 ');
    
    if (!values || values.length <= 1) {
      return res.status(404).json({
        success: false,
        error: '정책을 찾을 수 없습니다.'
      });
    }
    
    const dataRows = values.slice(1);
    const policyRowIndex = dataRows.findIndex(row => row[0] === policyId);
    
    if (policyRowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '정책을 찾을 수 없습니다.'
      });
    }
    
    const policyRow = dataRows[policyRowIndex];
    const inputUserId = policyRow[9]; // J열: 입력자ID
    
    // 본인이 입력한 정책인지 확인
    if (inputUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: '본인이 입력한 정책만 취소할 수 있습니다.'
      });
    }
    
    // 정책 상태를 취소로 변경
    const updatedRow = [...policyRow];
    updatedRow[15] = '취소됨'; // P열: 정책상태
    updatedRow[16] = cancelReason; // Q열: 취소사유
    updatedRow[17] = new Date().toISOString(); // R열: 취소일시
    updatedRow[18] = userName; // S열: 취소자명
    
    // Google Sheets 업데이트
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `정책_기본정보 !A${policyRowIndex + 2}:X${policyRowIndex + 2}`,
      valueInputOption: 'RAW',
      resource: {
        values: [updatedRow]
      }
    });
    
    // 취소 알림 생성
    await createPolicyNotification(policyId, userId, 'policy_cancelled', { cancelReason });
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('정책 취소 완료:', response.data);
    
    res.json({
      success: true,
      message: '정책이 성공적으로 취소되었습니다.'
    });
    
  } catch (error) {
    console.error('정책 취소 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 승인 취소 API
app.put('/api/policies/:policyId/approval-cancel', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { cancelReason, userId, userName, approvalType } = req.body;
    
    console.log('승인 취소 요청:', { policyId, cancelReason, userId, userName, approvalType });
    
    if (!cancelReason || !userId || !approvalType) {
      return res.status(400).json({
        success: false,
        error: '취소 사유, 사용자 정보, 승인 유형이 필요합니다.'
      });
    }
    
    // 정책_기본정보 시트에서 해당 정책 찾기
    const values = await getSheetValues('정책_기본정보 ');
    
    if (!values || values.length <= 1) {
      return res.status(404).json({
        success: false,
        error: '정책을 찾을 수 없습니다.'
      });
    }
    
    const dataRows = values.slice(1);
    const policyRowIndex = dataRows.findIndex(row => row[0] === policyId);
    
    if (policyRowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '정책을 찾을 수 없습니다.'
      });
    }
    
    const policyRow = dataRows[policyRowIndex];
    
    // 승인 상태 확인 및 업데이트
    const updatedRow = [...policyRow];
    let approvalColumn = '';
    
    switch (approvalType) {
      case 'total':
        approvalColumn = 'M'; // M열: 승인상태_총괄
        break;
      case 'settlement':
        approvalColumn = 'N'; // N열: 승인상태_정산팀
        break;
      case 'team':
        approvalColumn = 'O'; // O열: 승인상태_소속팀
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '잘못된 승인 유형입니다.'
        });
    }
    
    // 승인 상태를 대기로 변경
    const columnIndex = approvalColumn === 'M' ? 12 : approvalColumn === 'N' ? 13 : 14;
    updatedRow[columnIndex] = '대기';
    
    // 취소 이력을 정책_승인이력 시트에 기록
    const approvalHistoryRow = [
      policyId,                    // A열: 정책ID
      approvalType,                // B열: 승인유형
      '취소',                      // C열: 승인상태
      cancelReason,                // D열: 사유
      new Date().toISOString(),    // E열: 처리일시
      userName,                    // F열: 처리자명
      userId                       // G열: 처리자ID
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: '정책_승인이력 !A:G',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [approvalHistoryRow]
      }
    });
    
    // Google Sheets 업데이트
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `정책_기본정보 !A${policyRowIndex + 2}:X${policyRowIndex + 2}`,
      valueInputOption: 'RAW',
      resource: {
        values: [updatedRow]
      }
    });
    
    // 승인 취소 알림 생성
    await createPolicyNotification(policyId, userId, 'approval_cancelled', { 
      approvalType, 
      cancelReason 
    });
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('승인 취소 완료:', response.data);
    
    res.json({
      success: true,
      message: '승인이 성공적으로 취소되었습니다.'
    });
    
  } catch (error) {
    console.error('승인 취소 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 정산 반영 API
app.put('/api/policies/:policyId/settlement-reflect', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { userId, userName, isReflected } = req.body;
    
    console.log('정산 반영 요청:', { policyId, userId, userName, isReflected });
    
    if (!userId || !userName) {
      return res.status(400).json({
        success: false,
        error: '사용자 정보가 필요합니다.'
      });
    }
    
    // 정책_기본정보 시트에서 해당 정책 찾기
    const values = await getSheetValues('정책_기본정보 ');
    
    if (!values || values.length <= 1) {
      return res.status(404).json({
        success: false,
        error: '정책을 찾을 수 없습니다.'
      });
    }
    
    const dataRows = values.slice(1);
    const policyRowIndex = dataRows.findIndex(row => row[0] === policyId);
    
    if (policyRowIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '정책을 찾을 수 없습니다.'
      });
    }
    
    const policyRow = dataRows[policyRowIndex];
    
    // 정산 반영 상태 업데이트
    const updatedRow = [...policyRow];
    updatedRow[19] = isReflected ? '반영됨' : '미반영'; // T열: 정산반영상태
    updatedRow[20] = isReflected ? userName : ''; // U열: 정산반영자명
    updatedRow[21] = isReflected ? new Date().toISOString() : ''; // V열: 정산반영일시
    updatedRow[22] = isReflected ? userId : ''; // W열: 정산반영자ID
    
    // Google Sheets 업데이트
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `정책_기본정보 !A${policyRowIndex + 2}:X${policyRowIndex + 2}`,
      valueInputOption: 'RAW',
      resource: {
        values: [updatedRow]
      }
    });
    
    // 정산 반영 알림 생성
    await createPolicyNotification(policyId, userId, 'settlement_reflected', { 
      isReflected,
      userName 
    });
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('정산 반영 완료:', response.data);
    
    res.json({
      success: true,
      message: `정책이 정산에 ${isReflected ? '반영' : '미반영'} 처리되었습니다.`
    });
    
  } catch (error) {
    console.error('정산 반영 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 정책 관련 API 라우트
app.get('/api/policies', async (req, res) => {
  try {
    console.log('정책 목록 조회 요청:', req.query);
    
    const { yearMonth, policyType, category, userId, approvalStatus } = req.query;
    
    // 정책_기본정보 시트에서 데이터 가져오기 (캐시 무시하고 직접 조회)
    const values = await getSheetValuesWithoutCache('정책_기본정보 ');
    
    console.log(`📊 [정책조회] 시트에서 가져온 데이터:`, {
      totalRows: values ? values.length : 0,
      firstRow: values && values.length > 0 ? values[0] : null,
      lastRow: values && values.length > 1 ? values[values.length - 1] : null
    });
    
    if (!values || values.length === 0) {
      console.log('정책 데이터가 없습니다.');
      return res.json({ success: true, policies: [] });
    }
    
    // 헤더가 있는 경우 헤더 제거
    const dataRows = values.length > 1 ? values.slice(1) : values;
    
    if (dataRows.length === 0) {
      console.log('정책 데이터가 없습니다.');
      return res.json({ success: true, policies: [] });
    }
    

    
    // 필터링 적용
    let filteredPolicies = dataRows.filter(row => {
      if (row.length < 24) return false; // 최소 컬럼 수 확인 (A~X열, 기존 데이터 호환성)
      
      const policyYearMonth = row[23] || ''; // X열: 대상년월
      const policyTypeData = row[6];   // G열: 정책유형
      const categoryData = row[7];     // H열: 무선/유선
      const subCategory = row[8];      // I열: 하위카테고리
      const inputUserId = row[9];      // J열: 입력자ID
      const totalApproval = row[12];   // M열: 승인상태_총괄
      const settlementApproval = row[13]; // N열: 승인상태_정산팀
      const teamApproval = row[14];    // O열: 승인상태_소속팀
      
      // console.log(`🔍 [정책필터] 정책 필터링:`, {
      //   rowId: row[0], // A열: 정책ID
      //   policyYearMonth,
      //   policyTypeData,
      //   categoryData,
      //   subCategory,
      //   inputUserId,
      //   filters: { yearMonth, policyType, category, userId, approvalStatus }
      // });
      
      // 정책이 통과했는지 확인
      const passed = true; // 기본적으로 통과
      if (passed) {
        // console.log(`✅ [정책필터] 정책 통과: ${row[0]}`);
      }
      
      // 년월 필터
      if (yearMonth && policyYearMonth && policyYearMonth !== yearMonth) {
        // console.log(`❌ [정책필터] yearMonth 불일치: ${policyYearMonth} !== ${yearMonth}`);
        return false;
      }
      
      // 년월 필터 통과 로그
      if (yearMonth && policyYearMonth && policyYearMonth === yearMonth) {
        console.log(`✅ [정책필터] yearMonth 일치: ${policyYearMonth} === ${yearMonth}`);
      }
      
      // 정책유형 필터 (URL 디코딩 및 처리)
      if (policyType) {
        const decodedPolicyType = decodeURIComponent(policyType);
        // "무선:1" 형태에서 "무선" 부분만 추출
        const cleanPolicyType = decodedPolicyType.split(':')[0];
        if (policyTypeData !== cleanPolicyType) {
          // console.log(`❌ [정책필터] policyType 불일치: ${policyTypeData} !== ${cleanPolicyType}`);
          return false;
        }
      }
      
      // 카테고리 필터
      if (category && subCategory !== category) {
        // console.log(`❌ [정책필터] category 불일치: ${subCategory} !== ${category}`);
        return false;
      }
      
      // 사용자 필터
      if (userId && inputUserId !== userId) {
        // console.log(`❌ [정책필터] userId 불일치: ${inputUserId} !== ${userId}`);
        return false;
      }
      
      // 승인상태 필터
      if (approvalStatus) {
        const hasApprovalStatus = [totalApproval, settlementApproval, teamApproval].includes(approvalStatus);
        if (!hasApprovalStatus) {
          // console.log(`❌ [정책필터] approvalStatus 불일치`);
          return false;
        }
      }
      
      // console.log(`✅ [정책필터] 정책 통과: ${row[0]}`);
      return true;
    });
    
    // 매장 데이터 가져오기 (업체명 매핑용)
    let storeData = [];
    try {
      const storeValues = await getSheetValuesWithoutCache(STORE_SHEET_NAME);
      if (storeValues && storeValues.length > 1) {
        const storeRows = storeValues.slice(1);
        storeData = storeRows
          .filter(row => {
            const name = (row[14] || '').toString().trim();  // O열: 업체명 (14인덱스)
            const status = row[12];                          // M열: 거래상태 (12번째 컬럼)
            return name && status === "사용";
          })
          .map(row => ({
            id: row[15],                        // P열: 매장코드 (15인덱스)
            name: row[14].toString().trim()   // O열: 업체명 (14인덱스)
          }));
      }
    } catch (error) {
      console.warn('매장 데이터 가져오기 실패:', error.message);
    }

    // 매장 ID로 업체명을 찾는 함수
    const getStoreNameById = (storeId) => {
      if (!storeId || !storeData.length) return '';
      const store = storeData.find(s => s.id && s.id.toString() === storeId.toString());
      return store ? store.name : '';
    };

    // 정책 데이터 변환
    const policies = filteredPolicies.map(row => {
      const policyStore = row[3]; // D열: 정책적용점
      const storeName = getStoreNameById(policyStore);
      
      return {
        id: row[0],                    // A열: 정책ID
        policyName: row[1],            // B열: 정책명
        policyDate: row[2],            // C열: 정책적용일 (시작일~종료일)
        policyStore: policyStore,      // D열: 정책적용점 (코드)
        policyStoreName: storeName,    // 매장명 (매핑된 업체명)
        policyContent: row[4],         // E열: 정책내용
        policyAmount: (() => {         // F열: 금액 (금액 + 유형)
          const amountStr = row[5] || '';
          // "100,000원 (총금액)" 형식에서 숫자만 추출
          const match = amountStr.match(/^([\d,]+)원/);
          if (match) {
            return match[1].replace(/,/g, ''); // 쉼표 제거하고 숫자만 반환
          }
          return amountStr;
        })(),
        amountType: (() => {           // F열에서 금액 유형 추출
          const amountStr = row[5] || '';
          if (amountStr.includes('총금액')) return 'total';
          if (amountStr.includes('건당금액')) return 'per_case';
          if (amountStr.includes('내용에 직접입력')) return 'in_content';
          return 'total';
        })(),
        policyType: row[6],            // G열: 정책유형
        wirelessWired: row[7],         // H열: 무선/유선
        category: row[8],              // I열: 하위카테고리
        inputUserId: row[9],           // J열: 입력자ID
        inputUserName: row[10],        // K열: 입력자명
        inputDateTime: row[11],        // L열: 입력일시
        approvalStatus: {
          total: row[12] || '대기',     // M열: 승인상태_총괄
          settlement: row[13] || '대기', // N열: 승인상태_정산팀
          team: row[14] || '대기'       // O열: 승인상태_소속팀
        },
        // 취소 관련 정보 추가
        policyStatus: row[15] || '활성', // P열: 정책상태
        cancelReason: row[16] || '',    // Q열: 취소사유
        cancelDateTime: row[17] || '',  // R열: 취소일시
        cancelUserName: row[18] || '',  // S열: 취소자명
        // 정산 반영 관련 정보 추가
        settlementStatus: row[19] || '미반영', // T열: 정산반영상태
        settlementUserName: row[20] || '',     // U열: 정산반영자명
        settlementDateTime: row[21] || '',     // V열: 정산반영일시
        settlementUserId: row[22] || '',       // W열: 정산반영자ID
        yearMonth: row[23] || '',               // X열: 대상년월
        multipleStoreName: (() => {
          const value = row[24];
          // 새로 저장된 정책 로그 출력
          if (row[0] === 'POL_1760243517056_ushvjqq8t') {
            console.log('🔍 [정책조회] Y열(24인덱스) 복수점명 확인:', {
              policyId: row[0],
              rowLength: row.length,
              row24Value: value,
              row24Type: typeof value,
              row24IsEmpty: value === '',
              row23: row[23], // X열
              row25: row[25], // Z열
              row26: row[26]  // AA열
            });
          }
          return value || null;
        })(),       // Y열: 복수점명
        isMultiple: (row[24] && row[24].trim()) ? true : false, // 복수점명이 있으면 복수점
        storeNameFromSheet: row[25] || '',       // Z열: 업체명 (시트에서 직접 읽은 값)
        activationTypeFromSheet: row[26] || '',   // AA열: 개통유형 (시트에서 직접 읽은 값)
        amount95Above: row[27] || '',            // AB열: 95군이상금액
        amount95Below: row[28] || '',            // AC열: 95군미만금액
        team: (() => {
          const teamValue = row[29];
          console.log('🔍 [정책목록] AD열 소속팀 값:', teamValue, '정책ID:', row[0], '전체 row 길이:', row.length);
          
          // 기존 정책들 (24개 컬럼)은 소속팀 정보가 없으므로 '미지정'
          if (row.length < 30) {
            return '미지정';
          }
          
          // 새 정책들 (36개 컬럼)은 AD열에서 소속팀 정보 읽기
          return teamValue || '미지정';
        })(),         // AD열: 소속팀 (기존 데이터는 미지정)
        teamName: (() => {
          const teamValue = row[29];
          
          // 기존 정책들 (24개 컬럼)은 소속팀 정보가 없으므로 '미지정'
          if (row.length < 30) {
            return '미지정';
          }
          
          // 팀 코드가 'AA'인 경우, 대리점아이디관리 시트에서 실제 팀장 이름을 찾아서 반환
          // 임시로 팀 코드를 그대로 반환 (나중에 실제 팀장 이름으로 매핑)
          return teamValue || '미지정';
        })(),         // 팀 이름 (코드 변환)
        // 부가차감지원정책 관련 데이터
        deductSupport: {
          addServiceAmount: row[30] || '',        // AE열: 부가미유치금액
          insuranceAmount: row[31] || '',         // AF열: 보험미유치금액
          connectionAmount: row[32] || ''         // AG열: 연결음미유치금액
        },
        conditionalOptions: {
          addServiceAcquired: row[33] === 'Y',    // AH열: 부가유치시조건
          insuranceAcquired: row[34] === 'Y',     // AI열: 보험유치시조건
          connectionAcquired: row[35] === 'Y'     // AJ열: 연결음유치시조건
        },
        // 부가추가지원정책 관련 데이터
        addSupport: {
          uplayPremiumAmount: row[36] || '',      // AK열: 유플레이(프리미엄) 유치금액
          phoneExchangePassAmount: row[37] || '', // AL열: 폰교체패스 유치금액
          musicAmount: row[38] || '',             // AM열: 음악감상 유치금액
          numberFilteringAmount: row[39] || ''    // AN열: 지정번호필터링 유치금액
        },
        supportConditionalOptions: {
          vas2Both: row[40] === 'Y',              // AO열: VAS 2종 동시유치 조건
          vas2Either: row[41] === 'Y',            // AP열: VAS 2종중 1개유치 조건
          addon3All: row[42] === 'Y'              // AQ열: 부가3종 모두유치 조건
        },
        // 요금제유형별정책 관련 데이터
        rateSupports: (() => {
          try {
            return JSON.parse(row[43] || '[]');  // AR열: 요금제유형별정책 지원사항 (JSON)
          } catch (error) {
            return [];
          }
        })(),
        // 연합정책 관련 데이터
        unionSettlementStore: row[44] || '',  // AS열: 정산 입금처
        unionTargetStores: (() => {
          try {
            return JSON.parse(row[45] || '[]');  // AT열: 연합대상하부점 (JSON)
          } catch (error) {
            return [];
          }
        })(),
        unionConditions: (() => {
          try {
            return JSON.parse(row[46] || '{}');  // AU열: 조건 (JSON)
          } catch (error) {
            return {};
          }
        })(),
        // 개별소급정책 관련 데이터
        individualTarget: (() => {
          try {
            return JSON.parse(row[47] || '{}');  // AV열: 적용대상 (JSON)
          } catch (error) {
            return {};
          }
        })(),
        individualActivationType: row[48] || '',  // AW열: 개통유형
        manager: row[49] || '',  // AX열: 담당자명
        // activationType을 객체로 파싱
        activationType: (() => {
          const activationTypeStr = row[26] || '';
          if (!activationTypeStr) return { new010: false, mnp: false, change: false };
          
          const hasNew010 = activationTypeStr.includes('010신규');
          const hasMnp = activationTypeStr.includes('MNP');
          const hasChange = activationTypeStr.includes('기변');
          
          return {
            new010: hasNew010,
            mnp: hasMnp,
            change: hasChange
          };
        })()
      };
    });

    // 복수점 정책 그룹화 및 복수점명 추가
    const policyGroups = new Map();
    const processedPolicies = [];

    policies.forEach(policy => {
      // 정책명과 입력자ID로 그룹화 (같은 정책명과 입력자ID를 가진 정책들을 그룹화)
      const groupKey = `${policy.policyName}_${policy.inputUserId}_${policy.inputDateTime}`;
      
      if (!policyGroups.has(groupKey)) {
        policyGroups.set(groupKey, {
          policies: [],
          groupName: policy.policyName
        });
      }
      
      policyGroups.get(groupKey).policies.push(policy);
    });

    // 각 그룹에서 복수점명 추가
    policyGroups.forEach((group, groupKey) => {
      if (group.policies.length > 1) {
        // 복수점 정책인 경우 - 시트에서 읽은 복수점명 사용
        const multipleStoreName = group.policies[0].multipleStoreName || '복수점';
        
        group.policies.forEach(policy => {
          processedPolicies.push({
            ...policy,
            isMultiple: true,
            multipleStoreName: multipleStoreName
          });
        });
      } else {
        // 단일 그룹이지만 복수점명이 있는 경우 (시트에 복수점명이 저장된 경우)
        group.policies.forEach(policy => {
          const hasMultipleStoreName = policy.multipleStoreName && policy.multipleStoreName.trim();
          processedPolicies.push({
            ...policy,
            isMultiple: hasMultipleStoreName ? true : false,
            multipleStoreName: hasMultipleStoreName ? policy.multipleStoreName : null
          });
        });
      }
    });
    
    console.log(`정책 목록 조회 완료: ${processedPolicies.length}건`);
    
    res.json({ success: true, policies: processedPolicies });
    
  } catch (error) {
    console.error('정책 목록 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/policies', async (req, res) => {
  try {
    console.log('새 정책 생성 요청:', req.body);
    
    // 카테고리별 로그 출력
    const policyCategory = req.body.category;
    const isShoePolicyForLog = policyCategory === 'wireless_shoe' || policyCategory === 'wired_shoe';
    const isAddDeductPolicyForLog = policyCategory === 'wireless_add_deduct' || policyCategory === 'wired_add_deduct';
    
    if (isShoePolicyForLog) {
      console.log('📝 [정책생성-구두정책] 요청 데이터 상세:', {
      policyName: req.body.policyName,
      policyStartDate: req.body.policyStartDate,
      policyEndDate: req.body.policyEndDate,
      policyStore: req.body.policyStore,
      policyContent: req.body.policyContent,
      policyAmount: req.body.policyAmount,
      amountType: req.body.amountType,
      category: req.body.category,
      yearMonth: req.body.yearMonth,
      activationType: req.body.activationType,
      amount95Above: req.body.amount95Above,
      amount95Below: req.body.amount95Below,
      multipleStoreName: req.body.multipleStoreName
    });
    } else if (isAddDeductPolicyForLog) {
      console.log('📝 [정책생성-부가차감지원정책] 요청 데이터 상세:', {
        policyName: req.body.policyName,
        policyStartDate: req.body.policyStartDate,
        policyEndDate: req.body.policyEndDate,
        policyStore: req.body.policyStore,
        policyContent: req.body.policyContent,
        category: req.body.category,
        yearMonth: req.body.yearMonth,
        activationType: req.body.activationType,
        deductSupport: req.body.deductSupport,
        conditionalOptions: req.body.conditionalOptions,
        multipleStoreName: req.body.multipleStoreName
      });
    } else {
      console.log('📝 [정책생성-일반정책] 요청 데이터 상세:', {
        policyName: req.body.policyName,
        policyStartDate: req.body.policyStartDate,
        policyEndDate: req.body.policyEndDate,
        policyStore: req.body.policyStore,
        policyContent: req.body.policyContent,
        policyAmount: req.body.policyAmount,
        amountType: req.body.amountType,
        category: req.body.category,
        yearMonth: req.body.yearMonth,
        activationType: req.body.activationType,
        multipleStoreName: req.body.multipleStoreName
      });
    }
    
    const {
      policyName,
      policyStartDate,
      policyEndDate,
      policyStore,
      policyContent,
      policyAmount,
      amountType,
      policyType,
      category,
      yearMonth,
      inputUserId,
      inputUserName,
      policyTeam // 소속팀 정보 추가
    } = req.body;
    
    // 구두정책 여부 확인 (로그 출력용 변수 재사용)
    const isShoePolicy = isShoePolicyForLog;
    const isAddDeductPolicy = isAddDeductPolicyForLog;
    console.log('구두정책 여부:', isShoePolicy, '부가차감지원정책 여부:', isAddDeductPolicy, 'category:', category);
    console.log('🔍 [정책생성] policyTeam 값:', policyTeam);
    
    // 필수 필드 검증 (구두정책이나 부가차감지원정책이 아닌 경우에만 amountType 필수)
    const missingFields = [];
    if (!policyName) missingFields.push('policyName');
    if (!policyStartDate) missingFields.push('policyStartDate');
    if (!policyEndDate) missingFields.push('policyEndDate');
    // 연합정책이 아닐 때만 policyStore 검증
    const isUnionPolicy = category === 'wireless_union' || category === 'wired_union';
    if (!isUnionPolicy && !policyStore) missingFields.push('policyStore');
    if (!policyTeam || !policyTeam.trim()) missingFields.push('policyTeam');
    
    // 구두정책이나 부가차감지원정책이 아닌 경우에만 policyContent 필수
    // 부가차감지원정책은 자동 생성되므로 policyContent 검증 제외
    const isAddSupportPolicyForValidation = category === 'wireless_add_support' || category === 'wired_add_support';
    const isRatePolicyForValidation = category === 'wireless_rate' || category === 'wired_rate';
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicyForValidation && !isRatePolicyForValidation && !policyContent) missingFields.push('policyContent');
    
    // 구두정책 전용 검증
    if (isShoePolicy) {
      console.log('🔍 [구두정책] 전용 검증 시작');
      // 95군이상/미만 금액 중 하나라도 있어야 함
      if (!req.body.amount95Above && !req.body.amount95Below && !policyContent) {
      missingFields.push('amount95Above 또는 amount95Below 또는 policyContent');
      }
      console.log('✅ [구두정책] 검증 완료');
    }
    
    // 부가차감지원정책 전용 검증
    if (isAddDeductPolicy) {
      console.log('🔍 [부가차감지원정책] 전용 검증 시작');
      const deductSupport = req.body.deductSupport || {};
      
      console.log('🔍 [부가차감지원정책] 검증 데이터:', {
        deductSupport,
        addServiceAmount: deductSupport.addServiceAmount,
        insuranceAmount: deductSupport.insuranceAmount,
        connectionAmount: deductSupport.connectionAmount
      });
      
      // 차감지원 금액 중 최소 하나는 입력되어야 함 (지원할 항목이 있어야 함)
      const hasAnyAmount = (deductSupport.addServiceAmount && deductSupport.addServiceAmount.trim()) ||
                          (deductSupport.insuranceAmount && deductSupport.insuranceAmount.trim()) ||
                          (deductSupport.connectionAmount && deductSupport.connectionAmount.trim());
      
      console.log('🔍 [부가차감지원정책] hasAnyAmount:', hasAnyAmount);
      
      if (!hasAnyAmount) {
        console.log('❌ [부가차감지원정책] 차감지원 금액 누락');
        missingFields.push('차감지원 금액');
      } else {
        console.log('✅ [부가차감지원정책] 차감지원 금액 검증 통과');
      }
      
      // 조건부 옵션은 선택사항이므로 검증하지 않음
      console.log('✅ [부가차감지원정책] 검증 완료');
    }

    // 부가추가지원정책 전용 검증
    const isAddSupportPolicy = category === 'wireless_add_support' || category === 'wired_add_support';
    if (isAddSupportPolicy) {
      console.log('🔍 [부가추가지원정책] 전용 검증 시작');
      const addSupport = req.body.addSupport || {};
      
      console.log('🔍 [부가추가지원정책] 검증 데이터:', {
        addSupport,
        uplayPremiumAmount: addSupport.uplayPremiumAmount,
        phoneExchangePassAmount: addSupport.phoneExchangePassAmount,
        musicAmount: addSupport.musicAmount,
        numberFilteringAmount: addSupport.numberFilteringAmount
      });
      
      // 추가지원 금액 중 최소 하나는 입력되어야 함 (지원할 항목이 있어야 함)
      const hasAnyAmount = (addSupport.uplayPremiumAmount && addSupport.uplayPremiumAmount.trim()) ||
                          (addSupport.phoneExchangePassAmount && addSupport.phoneExchangePassAmount.trim()) ||
                          (addSupport.musicAmount && addSupport.musicAmount.trim()) ||
                          (addSupport.numberFilteringAmount && addSupport.numberFilteringAmount.trim());
      
      console.log('🔍 [부가추가지원정책] hasAnyAmount:', hasAnyAmount);
      
      if (!hasAnyAmount) {
        console.log('❌ [부가추가지원정책] 추가지원 금액 누락');
        missingFields.push('추가지원 금액');
      } else {
        console.log('✅ [부가추가지원정책] 추가지원 금액 검증 통과');
      }
      
      // 조건부 옵션은 선택사항이므로 검증하지 않음
      console.log('✅ [부가추가지원정책] 검증 완료');
    }

    // 요금제유형별정책 전용 검증
    const isRatePolicy = category === 'wireless_rate' || category === 'wired_rate';
    if (isRatePolicy) {
      console.log('🔍 [요금제유형별정책] 전용 검증 시작');
      const rateSupports = req.body.rateSupports || [];
      
      console.log('🔍 [요금제유형별정책] 검증 데이터:', {
        rateSupports,
        count: rateSupports.length
      });
      
      // 지원사항 최소 1개는 입력되어야 함
      if (rateSupports.length === 0) {
        console.log('❌ [요금제유형별정책] 지원사항 누락');
        missingFields.push('지원사항');
      } else {
        // 각 항목의 필드 검증 (rateRange는 선택사항이므로 제외)
        const hasIncompleteItem = rateSupports.some(item => 
          !item.modelType || !item.rateGrade || !item.activationType || !item.amount
        );
        if (hasIncompleteItem) {
          console.log('❌ [요금제유형별정책] 불완전한 지원사항 존재');
          missingFields.push('지원사항 필드');
        } else {
          console.log('✅ [요금제유형별정책] 지원사항 검증 통과');
        }
      }
      
      console.log('✅ [요금제유형별정책] 검증 완료');
    }
    
    // 일반 정책 검증 (구두정책, 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아닌 경우)
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy) {
      console.log('🔍 [일반정책] 검증 시작');
      if (!amountType) missingFields.push('amountType');
      console.log('✅ [일반정책] 검증 완료');
    }
    
    console.log('🔍 [전체 검증] missingFields:', missingFields);
    console.log('🔍 [전체 검증] missingFields.length:', missingFields.length);
    
    if (missingFields.length > 0) {
      console.log('❌ [전체 검증] 누락된 필드:', missingFields);
      
      // 필드명을 한국어로 변환
      const fieldNames = {
        'policyName': '정책명',
        'policyStartDate': '정책 시작일',
        'policyEndDate': '정책 종료일',
        'policyStore': '정책적용점',
        'policyContent': '정책내용',
        'amountType': '금액 유형',
        'amount95Above 또는 amount95Below 또는 policyContent': '95군이상/미만 금액 또는 정책내용',
        '차감지원 금액': '차감지원 금액'
      };
      
      const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
      const errorMessage = `다음 필수 항목이 누락되었습니다: ${missingFieldNames.join(', ')}`;
      
      return res.status(400).json({
        success: false,
        error: errorMessage,
        missingFields: missingFields,
        missingFieldNames: missingFieldNames,
        received: { policyName, policyStartDate, policyEndDate, policyStore, policyContent, amountType, isShoePolicy }
      });
    }
    
    // amountType이 'in_content'가 아닐 때만 policyAmount 필수 (구두정책, 부가차감지원정책이 아닌 경우에만)
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicy && amountType !== 'in_content' && !policyAmount) {
      return res.status(400).json({
        success: false,
        error: '금액이 입력되지 않았습니다.',
        received: { policyAmount, amountType }
      });
    }
    
    // 정책 ID 생성
    const policyId = `POL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 정책 적용일을 시작일~종료일 형태로 변환
    const startDate = new Date(policyStartDate).toLocaleDateString('ko-KR');
    const endDate = new Date(policyEndDate).toLocaleDateString('ko-KR');
    const policyDateRange = `${startDate} ~ ${endDate}`;
    
    // 금액 정보에 유형 추가
    const amountWithType = amountType === 'in_content' 
      ? '내용에 직접입력' 
      : `${policyAmount}원 (${amountType === 'total' ? '총금액' : '건당금액'})`;
    
    // 먼저 시트에 데이터가 있는지 확인
    const existingData = await getSheetValuesWithoutCache('정책_기본정보 ');
    
    // 헤더 정의
    const headerRow = [
      '정책ID',           // A열
      '정책명',           // B열
      '정책적용일',       // C열
      '정책적용점',       // D열
      '정책내용',         // E열
      '금액',             // F열
      '정책유형',         // G열
      '무선/유선',        // H열
      '하위카테고리',     // I열
      '입력자ID',         // J열
      '입력자명',         // K열
      '입력일시',         // L열
      '승인상태_총괄',     // M열
      '승인상태_정산팀',   // N열
      '승인상태_소속팀',   // O열
      '정책상태',         // P열
      '취소사유',         // Q열
      '취소일시',         // R열
      '취소자명',         // S열
      '정산반영상태',     // T열
      '정산반영자명',     // U열
      '정산반영일시',     // V열
      '정산반영자ID',     // W열
      '대상년월',                   // X열
      '복수점명',                   // Y열
      '업체명',                     // Z열
      '개통유형',                   // AA열
      '95군이상금액',               // AB열
      '95군미만금액',               // AC열
      '소속팀',                     // AD열
      '부가미유치금액',             // AE열
      '보험미유치금액',             // AF열
      '연결음미유치금액',           // AG열
      '부가유치시조건',             // AH열
      '보험유치시조건',             // AI열
      '연결음유치시조건',           // AJ열
      '유플레이프리미엄금액',       // AK열
      '폰교체패스금액',             // AL열
      '음악감상금액',               // AM열
      '지정번호필터링금액',         // AN열
      'VAS2종동시유치',             // AO열
      'VAS2종중1개유치',            // AP열
      '부가3종모두유치',            // AQ열
      '요금제유형별지원사항',       // AR열
      '연합정산입금처',             // AS열
      '연합대상하부점',             // AT열
      '연합조건',                   // AU열
      '개별소급적용대상',           // AV열
      '개별소급개통유형',           // AW열
      '담당자'                      // AX열
    ];
    
    // 매장 데이터에서 업체명 조회
    let storeName = '';
    try {
      const storeValues = await getSheetValuesWithoutCache(STORE_SHEET_NAME);
      if (storeValues && storeValues.length > 1) {
        const storeRows = storeValues.slice(1);
        const store = storeRows.find(row => {
          const storeId = row[15]; // P열: 매장코드 (15인덱스)
          return storeId && storeId.toString() === policyStore.toString();
        });
        if (store) {
          storeName = store[14] ? store[14].toString().trim() : ''; // O열: 업체명 (14인덱스)
        }
      }
    } catch (error) {
      console.warn('매장 데이터 조회 실패:', error.message);
    }

    // 새 정책 데이터 생성
    const newPolicyRow = [
      policyId,                    // A열: 정책ID
      policyName,                  // B열: 정책명
      policyDateRange,             // C열: 정책적용일 (시작일~종료일)
      policyStore,                 // D열: 정책적용점
      policyContent,               // E열: 정책내용
      amountWithType,              // F열: 금액 (금액 + 유형)
      policyType,                  // G열: 정책유형
      category.startsWith('wireless') ? '무선' : '유선', // H열: 무선/유선
      category,                    // I열: 하위카테고리
      inputUserId,                 // J열: 입력자ID
      inputUserName,               // K열: 입력자명
      new Date().toISOString(),    // L열: 입력일시
      '대기',                      // M열: 승인상태_총괄
      '대기',                      // N열: 승인상태_정산팀
      '대기',                      // O열: 승인상태_소속팀
      '활성',                      // P열: 정책상태
      '',                          // Q열: 취소사유
      '',                          // R열: 취소일시
      '',                          // S열: 취소자명
      '미반영',                    // T열: 정산반영상태
      '',                          // U열: 정산반영자명
      '',                          // V열: 정산반영일시
      '',                          // W열: 정산반영자ID
      yearMonth,                   // X열: 대상년월
      req.body.multipleStoreName || '', // Y열: 복수점명
      storeName,                   // Z열: 업체명
      (() => {                     // AA열: 개통유형
        // 부가차감/추가지원정책, 요금제유형별정책은 개통유형 선택 필드가 없으므로 "전유형"으로 설정
        if (category === 'wireless_add_deduct' || category === 'wired_add_deduct' || 
            category === 'wireless_add_support' || category === 'wired_add_support' ||
            category === 'wireless_rate' || category === 'wired_rate') {
          return '전유형';
        }
        
        if (!req.body.activationType) return '';
        const { new010, mnp, change } = req.body.activationType;
        const types = [];
        if (new010) types.push('010신규');
        if (mnp) types.push('MNP');
        if (change) types.push('기변');
        if (types.length === 3) return '전유형';
        return types.join(', ');
      })(),
      // AB열: 95군이상금액 (구두정책에서만 사용)
      (category === 'wireless_shoe' || category === 'wired_shoe') ? (req.body.amount95Above || '') : '',
      // AC열: 95군미만금액 (구두정책에서만 사용)
      (category === 'wireless_shoe' || category === 'wired_shoe') ? (req.body.amount95Below || '') : '',
      (policyTeam && policyTeam.trim()) || '미지정',       // AD열: 소속팀
      // AE열: 부가미유치금액 (부가차감지원정책에서만 사용)
      (category === 'wireless_add_deduct' || category === 'wired_add_deduct') ? (req.body.deductSupport?.addServiceAmount || '') : '',
      // AF열: 보험미유치금액 (부가차감지원정책에서만 사용)
      (category === 'wireless_add_deduct' || category === 'wired_add_deduct') ? (req.body.deductSupport?.insuranceAmount || '') : '',
      // AG열: 연결음미유치금액 (부가차감지원정책에서만 사용)
      (category === 'wireless_add_deduct' || category === 'wired_add_deduct') ? (req.body.deductSupport?.connectionAmount || '') : '',
      // AH열: 부가유치시조건 (부가차감지원정책에서만 사용)
      (category === 'wireless_add_deduct' || category === 'wired_add_deduct') ? (req.body.conditionalOptions?.addServiceAcquired ? 'Y' : 'N') : '',
      // AI열: 보험유치시조건 (부가차감지원정책에서만 사용)
      (category === 'wireless_add_deduct' || category === 'wired_add_deduct') ? (req.body.conditionalOptions?.insuranceAcquired ? 'Y' : 'N') : '',
      // AJ열: 연결음유치시조건 (부가차감지원정책에서만 사용)
      (category === 'wireless_add_deduct' || category === 'wired_add_deduct') ? (req.body.conditionalOptions?.connectionAcquired ? 'Y' : 'N') : '',
      // AK열: 유플레이(프리미엄) 유치금액 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.addSupport?.uplayPremiumAmount || '') : '',
      // AL열: 폰교체패스 유치금액 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.addSupport?.phoneExchangePassAmount || '') : '',
      // AM열: 음악감상 유치금액 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.addSupport?.musicAmount || '') : '',
      // AN열: 지정번호필터링 유치금액 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.addSupport?.numberFilteringAmount || '') : '',
      // AO열: VAS 2종 동시유치 조건 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.supportConditionalOptions?.vas2Both ? 'Y' : 'N') : '',
      // AP열: VAS 2종중 1개유치 조건 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.supportConditionalOptions?.vas2Either ? 'Y' : 'N') : '',
      // AQ열: 부가3종 모두유치 조건 (부가추가지원정책에서만 사용)
      (category === 'wireless_add_support' || category === 'wired_add_support') ? (req.body.supportConditionalOptions?.addon3All ? 'Y' : 'N') : '',
      // AR열: 요금제유형별정책 지원사항 (JSON 문자열)
      (category === 'wireless_rate' || category === 'wired_rate') ? JSON.stringify(req.body.rateSupports || []) : '',
      // AS열: 연합정책 정산 입금처
      (category === 'wireless_union' || category === 'wired_union') ? (req.body.unionSettlementStore || '') : '',
      // AT열: 연합정책 연합대상하부점 (JSON 문자열)
      (category === 'wireless_union' || category === 'wired_union') ? JSON.stringify(req.body.unionTargetStores || []) : '',
      // AU열: 연합정책 조건 (JSON 문자열)
      (category === 'wireless_union' || category === 'wired_union') ? JSON.stringify(req.body.unionConditions || {}) : '',
      // AV열: 개별소급정책 적용대상 (JSON 문자열)
      (category === 'wireless_individual' || category === 'wired_individual') ? JSON.stringify(req.body.individualTarget || {}) : '',
      // AW열: 개별소급정책 개통유형
      (category === 'wireless_individual' || category === 'wired_individual') ? (req.body.individualActivationType || '') : '',
      // AX열: 담당자명
      req.body.manager || ''
    ];
    
    console.log('📝 [정책생성] 구글시트 저장 데이터:', {
      policyId,
      policyName,
      policyContent,
      amount95Above: req.body.amount95Above,
      amount95Below: req.body.amount95Below,
      activationType: req.body.activationType,
      multipleStoreName: req.body.multipleStoreName,
      storeName,
      arrayLength: newPolicyRow.length
    });
    
    console.log('🔍 [정책생성] newPolicyRow Y열(24인덱스) 확인:', newPolicyRow[24]);
    
    let response;
    
    // 시트가 비어있으면 헤더와 함께 데이터 추가
    try {
    if (!existingData || existingData.length === 0) {
      console.log('📝 [정책생성] 시트가 비어있어 헤더와 함께 데이터 추가');
      response = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
          range: '정책_기본정보 !A:AX',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [headerRow, newPolicyRow]
        }
      });
    } else {
        // 기존 데이터가 있는 경우
        // 1. 헤더가 누락되어 있으면 업데이트
        const currentHeader = existingData[0];
        const needsHeaderUpdate = !currentHeader[24] || !currentHeader[25] || !currentHeader[26]; // Y, Z, AA열 확인
        
        if (needsHeaderUpdate) {
          console.log('📝 [정책생성] 헤더 업데이트 필요 - Y~AX열 헤더 추가');
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: '정책_기본정보 !A1:AX1',
            valueInputOption: 'RAW',
            resource: {
              values: [headerRow]
            }
          });
        }
        
        // 2. 정책 데이터 추가 (다음 행의 A열부터 정확히 기록)
      console.log('📝 [정책생성] 기존 데이터에 정책 추가');
        // existingData에는 헤더를 포함한 전체 행이 들어있다고 가정
        const nextRowIndex = existingData.length + 1; // 1-based index
        const targetRange = `정책_기본정보 !A${nextRowIndex}:AX${nextRowIndex}`;
        response = await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
          range: targetRange,
        valueInputOption: 'RAW',
        resource: {
          values: [newPolicyRow]
        }
        });
      }
      console.log('✅ [정책생성] Google Sheets 저장 성공:', response.data);
    } catch (sheetsError) {
      console.error('❌ [정책생성] Google Sheets 저장 실패:', sheetsError);
      return res.status(400).json({
        success: false,
        error: 'Google Sheets 저장에 실패했습니다.',
        details: sheetsError.message
      });
    }
    
    // 알림 생성
    await createPolicyNotification(policyId, inputUserId, 'new_policy');
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('정책 생성 완료:', response.data);
    
    res.json({
      success: true,
      message: '정책이 성공적으로 생성되었습니다.',
      policyId: policyId
    });
    
  } catch (error) {
    console.error('정책 생성 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 정책 삭제 API (라우터 순서 문제 해결을 위해 가장 앞에 배치)
app.delete('/api/policies/:policyId', async (req, res) => {
  console.log('🔥 [DELETE API] 요청 받음:', req.method, req.url);
  console.log('🔥 [DELETE API] 요청 헤더:', req.headers);
  console.log('🔥 [DELETE API] 요청 파라미터:', req.params);
  try {
    const { policyId } = req.params;
    console.log('🔥 [DELETE API] 정책 삭제 요청:', { policyId });
    
    // 정책_기본정보 시트에서 해당 정책 찾기
    const values = await getSheetValuesWithoutCache('정책_기본정보 ');
    
    if (!values || values.length <= 1) {
      return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
    }
    
    // 헤더 제거
    const dataRows = values.slice(1);
    const policyRowIndex = dataRows.findIndex(row => row[0] === policyId);
    
    if (policyRowIndex === -1) {
      return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
    }
    
    // Google Sheets에서 해당 행 삭제
    const sheetId = await getSheetIdByName('정책_기본정보 ');
    console.log('🔥 [DELETE API] 정책_기본정보 시트 ID:', sheetId);
    
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId, // 정책_기본정보 시트 ID
              dimension: 'ROWS',
              startIndex: policyRowIndex + 1, // 0-based index, +1 for header
              endIndex: policyRowIndex + 2
            }
          }
        }]
      }
    });
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('정책 삭제 완료:', response.data);
    
    res.json({ success: true, message: '정책이 삭제되었습니다.' });
    
  } catch (error) {
    console.error('정책 삭제 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 정책 수정 API
app.put('/api/policies/:policyId', async (req, res) => {
  try {
    const { policyId } = req.params;
    console.log('정책 수정 요청:', { policyId, body: req.body });
    
    const {
      policyName,
      policyStartDate,
      policyEndDate,
      policyStore,
      policyContent,
      policyAmount,
      amountType,
      policyType,
      category,
      yearMonth,
      team,
      inputUserId,
      inputUserName
    } = req.body;
    // 정책팀 값 정규화: 프론트는 policyTeam(이름) 또는 team(코드/이름)로 보낼 수 있음
    const policyTeam = (req.body.policyTeam ?? team ?? '').toString();
    
    // 구두정책 여부 확인
    const isShoePolicy = category === 'wireless_shoe' || category === 'wired_shoe';
    const isAddDeductPolicy = category === 'wireless_add_deduct' || category === 'wired_add_deduct';
    console.log('정책 수정 - 구두정책 여부:', isShoePolicy, '부가차감지원정책 여부:', isAddDeductPolicy, 'category:', category);
    
    // 필수 필드 검증 (구두정책이나 부가차감지원정책이 아닌 경우에만 amountType 필수)
    const missingFields = [];
    if (!policyName) missingFields.push('policyName');
    if (!policyStartDate) missingFields.push('policyStartDate');
    if (!policyEndDate) missingFields.push('policyEndDate');
    // 연합정책이 아닐 때만 policyStore 검증
    const isUnionPolicyForUpdate = category === 'wireless_union' || category === 'wired_union';
    if (!isUnionPolicyForUpdate && !policyStore) missingFields.push('policyStore');
    if (!policyTeam || !policyTeam.trim()) missingFields.push('policyTeam');
    
    // 구두정책이나 부가차감지원정책이 아닌 경우에만 policyContent 필수
    // 부가차감지원정책은 자동 생성되므로 policyContent 검증 제외
    const isAddSupportPolicyForValidation = category === 'wireless_add_support' || category === 'wired_add_support';
    const isRatePolicyForValidation = category === 'wireless_rate' || category === 'wired_rate';
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicyForValidation && !isRatePolicyForValidation && !policyContent) missingFields.push('policyContent');
    
    // 구두정책 전용 검증
    if (isShoePolicy) {
      console.log('🔍 [정책수정-구두정책] 전용 검증 시작');
      // 95군이상/미만 금액 중 하나라도 있어야 함
      if (!req.body.amount95Above && !req.body.amount95Below && !policyContent) {
      missingFields.push('amount95Above 또는 amount95Below 또는 policyContent');
      }
      console.log('✅ [정책수정-구두정책] 검증 완료');
    }
    
    // 부가차감지원정책 전용 검증
    if (isAddDeductPolicy) {
      console.log('🔍 [정책수정-부가차감지원정책] 전용 검증 시작');
      const deductSupport = req.body.deductSupport || {};
      
      // 차감지원 금액 중 최소 하나는 입력되어야 함 (지원할 항목이 있어야 함)
      const hasAnyAmount = (deductSupport.addServiceAmount && deductSupport.addServiceAmount.trim()) ||
                          (deductSupport.insuranceAmount && deductSupport.insuranceAmount.trim()) ||
                          (deductSupport.connectionAmount && deductSupport.connectionAmount.trim());
      
      if (!hasAnyAmount) {
        missingFields.push('차감지원 금액');
      }
      
      // 조건부 옵션은 선택사항이므로 검증하지 않음
      console.log('✅ [정책수정-부가차감지원정책] 검증 완료');
    }

    // 부가추가지원정책 전용 검증
    const isAddSupportPolicy = category === 'wireless_add_support' || category === 'wired_add_support';
    if (isAddSupportPolicy) {
      console.log('🔍 [정책수정-부가추가지원정책] 전용 검증 시작');
      const addSupport = req.body.addSupport || {};
      
      // 추가지원 금액 중 최소 하나는 입력되어야 함 (지원할 항목이 있어야 함)
      const hasAnyAmount = (addSupport.uplayPremiumAmount && addSupport.uplayPremiumAmount.trim()) ||
                          (addSupport.phoneExchangePassAmount && addSupport.phoneExchangePassAmount.trim()) ||
                          (addSupport.musicAmount && addSupport.musicAmount.trim()) ||
                          (addSupport.numberFilteringAmount && addSupport.numberFilteringAmount.trim());
      
      if (!hasAnyAmount) {
        missingFields.push('추가지원 금액');
      }
      
      // 조건부 옵션은 선택사항이므로 검증하지 않음
      console.log('✅ [정책수정-부가추가지원정책] 검증 완료');
    }

    // 요금제유형별정책 전용 검증
    const isRatePolicyForUpdate = category === 'wireless_rate' || category === 'wired_rate';
    if (isRatePolicyForUpdate) {
      console.log('🔍 [정책수정-요금제유형별정책] 전용 검증 시작');
      const rateSupports = req.body.rateSupports || [];
      
      // 지원사항 최소 1개는 입력되어야 함
      if (rateSupports.length === 0) {
        missingFields.push('지원사항');
      } else {
        // 각 항목의 필드 검증 (rateRange는 선택사항이므로 제외)
        const hasIncompleteItem = rateSupports.some(item => 
          !item.modelType || !item.rateGrade || !item.activationType || !item.amount
        );
        if (hasIncompleteItem) {
          missingFields.push('지원사항 필드');
        }
      }
      
      console.log('✅ [정책수정-요금제유형별정책] 검증 완료');
    }
    
    // 일반 정책 검증 (구두정책, 부가차감지원정책, 부가추가지원정책, 요금제유형별정책이 아닌 경우)
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicyForUpdate) {
      console.log('🔍 [정책수정-일반정책] 검증 시작');
      if (!amountType) missingFields.push('amountType');
      console.log('✅ [정책수정-일반정책] 검증 완료');
    }
    
    if (missingFields.length > 0) {
      console.log('정책 수정 - 누락된 필드:', missingFields);
      
      // 필드명을 한국어로 변환
      const fieldNames = {
        'policyName': '정책명',
        'policyStartDate': '정책 시작일',
        'policyEndDate': '정책 종료일',
        'policyStore': '정책적용점',
        'policyContent': '정책내용',
        'amountType': '금액 유형',
        'amount95Above 또는 amount95Below 또는 policyContent': '95군이상/미만 금액 또는 정책내용',
        '차감지원 금액': '차감지원 금액'
      };
      
      const missingFieldNames = missingFields.map(field => fieldNames[field] || field);
      const errorMessage = `다음 필수 항목이 누락되었습니다: ${missingFieldNames.join(', ')}`;
      
      return res.status(400).json({
        success: false,
        error: errorMessage,
        missingFields: missingFields,
        missingFieldNames: missingFieldNames,
        received: { policyName, policyStartDate, policyEndDate, policyStore, policyContent, amountType, isShoePolicy }
      });
    }
    
    // amountType이 'in_content'가 아닐 때만 policyAmount 필수 (구두정책, 부가차감지원정책이 아닌 경우에만)
    if (!isShoePolicy && !isAddDeductPolicy && !isAddSupportPolicy && !isRatePolicyForUpdate && amountType !== 'in_content' && !policyAmount) {
      return res.status(400).json({
        success: false,
        error: '금액이 입력되지 않았습니다.',
        received: { policyAmount, amountType }
      });
    }
    
    // 정책_기본정보 시트에서 해당 정책 찾기
    const values = await getSheetValuesWithoutCache('정책_기본정보 ');
    
    if (!values || values.length <= 1) {
      return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
    }
    
    // 정책 찾기 (헤더 제외)
    const dataRows = values.slice(1);
    const policyIndex = dataRows.findIndex(row => row[0] === policyId);
    
    if (policyIndex === -1) {
      return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
    }
    
    const policyRow = dataRows[policyIndex];
    const rowNumber = policyIndex + 2; // 헤더 + 1부터 시작하므로 +2
    
    // 정책 적용일을 시작일~종료일 형태로 변환
    const startDate = new Date(policyStartDate).toLocaleDateString('ko-KR');
    const endDate = new Date(policyEndDate).toLocaleDateString('ko-KR');
    const policyDateRange = `${startDate} ~ ${endDate}`;
    
    // 금액 정보에 유형 추가
    const amountWithType = amountType === 'in_content' 
      ? '내용에 직접입력' 
      : `${policyAmount}원 (${amountType === 'total' ? '총금액' : '건당금액'})`;
    
    // 수정할 데이터 준비
    const updateData = [
      policyName,                  // B열: 정책명
      policyDateRange,             // C열: 정책적용일 (시작일~종료일)
      policyStore,                 // D열: 정책적용점
      policyContent,               // E열: 정책내용
      amountWithType,              // F열: 금액 (금액 + 유형)
      policyType,                  // G열: 정책유형
      (category && category.startsWith('wireless')) ? '무선' : '유선', // H열: 무선/유선
      category || '',              // I열: 하위카테고리
      inputUserId,                 // J열: 입력자ID
      inputUserName,               // K열: 입력자명
      new Date().toISOString(),    // L열: 입력일시 (수정일시로 업데이트)
      yearMonth,                   // X열: 대상년월
      req.body.amount95Above || '', // AB열: 95군이상금액
      req.body.amount95Below || '', // AC열: 95군미만금액
      // 부가차감지원정책 데이터
      JSON.stringify(req.body.deductSupport || {}), // AD열
      (req.body.conditionalOptions?.option1 ? 'Y' : 'N'), // AE열
      (req.body.conditionalOptions?.option2 ? 'Y' : 'N'), // AF열
      (req.body.conditionalOptions?.option3 ? 'Y' : 'N'), // AG열
      // 부가추가지원정책 데이터
      req.body.addSupport?.ktClubAmount || '', // AH열
      req.body.addSupport?.musicBellAmount || '', // AI열
      req.body.addSupport?.uplayBasicAmount || '', // AJ열
      req.body.addSupport?.uplayPremiumAmount || '', // AK열
      req.body.addSupport?.phoneExchangePassAmount || '', // AL열
      req.body.addSupport?.musicAmount || '', // AM열
      req.body.addSupport?.numberFilteringAmount || '', // AN열
      (req.body.supportConditionalOptions?.vas2Both ? 'Y' : 'N'), // AO열
      (req.body.supportConditionalOptions?.vas2Either ? 'Y' : 'N'), // AP열
      (req.body.supportConditionalOptions?.addon3All ? 'Y' : 'N'), // AQ열
      // 요금제유형별정책 데이터
      JSON.stringify(req.body.rateSupports || []), // AR열
      // 연합정책 데이터
      req.body.unionSettlementStore || '', // AS열
      JSON.stringify(req.body.unionTargetStores || []), // AT열
      JSON.stringify(req.body.unionConditions || {}), // AU열
      // 개별소급정책 데이터
      JSON.stringify(req.body.individualTarget || {}), // AV열
      req.body.individualActivationType || '', // AW열
      // 담당자
      req.body.manager || '' // AX열
    ];
    
    // 각 필드를 개별적으로 업데이트
    const updateRanges = [
      `'정책_기본정보 '!B${rowNumber}`,  // 정책명
      `'정책_기본정보 '!C${rowNumber}`,  // 정책적용일
      `'정책_기본정보 '!D${rowNumber}`,  // 정책적용점
      `'정책_기본정보 '!E${rowNumber}`,  // 정책내용
      `'정책_기본정보 '!F${rowNumber}`,  // 금액
      `'정책_기본정보 '!G${rowNumber}`,  // 정책유형
      `'정책_기본정보 '!H${rowNumber}`,  // 무선/유선
      `'정책_기본정보 '!I${rowNumber}`,  // 하위카테고리
      `'정책_기본정보 '!J${rowNumber}`,  // 입력자ID
      `'정책_기본정보 '!K${rowNumber}`,  // 입력자명
      `'정책_기본정보 '!L${rowNumber}`,  // 입력일시
      `'정책_기본정보 '!X${rowNumber}`,  // 대상년월
      `'정책_기본정보 '!AB${rowNumber}`, // 95군이상금액
      `'정책_기본정보 '!AC${rowNumber}`, // 95군미만금액
      `'정책_기본정보 '!AD${rowNumber}`, // 부가차감지원 데이터
      `'정책_기본정보 '!AE${rowNumber}`, // 조건옵션1
      `'정책_기본정보 '!AF${rowNumber}`, // 조건옵션2
      `'정책_기본정보 '!AG${rowNumber}`, // 조건옵션3
      `'정책_기본정보 '!AH${rowNumber}`, // KT클럽
      `'정책_기본정보 '!AI${rowNumber}`, // 뮤직벨
      `'정책_기본정보 '!AJ${rowNumber}`, // 유플레이(기본)
      `'정책_기본정보 '!AK${rowNumber}`, // 유플레이(프리미엄)
      `'정책_기본정보 '!AL${rowNumber}`, // 폰교체패스
      `'정책_기본정보 '!AM${rowNumber}`, // 음악감상
      `'정책_기본정보 '!AN${rowNumber}`, // 지정번호필터링
      `'정책_기본정보 '!AO${rowNumber}`, // VAS 2종 동시유치
      `'정책_기본정보 '!AP${rowNumber}`, // VAS 2종중 1개유치
      `'정책_기본정보 '!AQ${rowNumber}`, // 부가3종 모두유치
      `'정책_기본정보 '!AR${rowNumber}`, // 요금제유형별정책 데이터
      `'정책_기본정보 '!AS${rowNumber}`, // 연합정책 정산 입금처
      `'정책_기본정보 '!AT${rowNumber}`, // 연합정책 연합대상하부점
      `'정책_기본정보 '!AU${rowNumber}`, // 연합정책 조건
      `'정책_기본정보 '!AV${rowNumber}`, // 개별소급정책 적용대상
      `'정책_기본정보 '!AW${rowNumber}`, // 개별소급정책 개통유형
      `'정책_기본정보 '!AX${rowNumber}`  // 담당자명
    ];
    
    // 배치 업데이트 실행
    const batchUpdateRequests = updateRanges.map((range, index) => ({
      range: range,
      values: [[updateData[index]]]
    }));
    
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        valueInputOption: 'RAW',
        data: batchUpdateRequests
      }
    });
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('정책 수정 완료:', policyId);
    
    res.json({
      success: true,
      message: '정책이 성공적으로 수정되었습니다.',
      policyId: policyId
    });
    
  } catch (error) {
    console.error('정책 수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// DELETE 메서드 테스트 API
app.delete('/api/test-delete', (req, res) => {
  console.log('DELETE 테스트 요청 받음');
  res.json({ success: true, message: 'DELETE 메서드가 작동합니다.' });
});

// 정책 삭제 테스트 API (더 간단한 버전)
app.delete('/api/policies-delete/:policyId', async (req, res) => {
  console.log('🔥 [DELETE TEST API] 요청 받음:', req.method, req.url);
  try {
    const { policyId } = req.params;
    console.log('🔥 [DELETE TEST API] 정책 삭제 요청:', { policyId });
    
    res.json({ success: true, message: 'DELETE 테스트 API가 작동합니다.', policyId });
  } catch (error) {
    console.error('DELETE 테스트 API 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 정책 승인 API
app.put('/api/policies/:policyId/approve', async (req, res) => {
  try {
    const { policyId } = req.params;
    const { approvalType, comment, userId, userName } = req.body;
    
    console.log('정책 승인 요청:', { policyId, approvalType, comment, userId, userName });
    
    // 정책_기본정보 시트에서 해당 정책 찾기
    const values = await getSheetValuesWithoutCache('정책_기본정보 ');
    
    if (!values || values.length <= 1) {
      return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
    }
    
    // 정책 찾기 (헤더 제외)
    const dataRows = values.slice(1);
    const policyIndex = dataRows.findIndex(row => row[0] === policyId);
    
    if (policyIndex === -1) {
      return res.status(404).json({ success: false, error: '정책을 찾을 수 없습니다.' });
    }
    
    const policyRow = dataRows[policyIndex];
    const rowNumber = policyIndex + 2; // 헤더 + 1부터 시작하므로 +2
    
    // 승인 상태 업데이트
    let updateRange, updateValues;
    
    if (approvalType === 'total') {
      updateRange = `'정책_기본정보 '!M${rowNumber}`;
      updateValues = [['승인']];
    } else if (approvalType === 'settlement') {
      updateRange = `'정책_기본정보 '!N${rowNumber}`;
      updateValues = [['승인']];
    } else if (approvalType === 'team') {
      updateRange = `'정책_기본정보 '!O${rowNumber}`;
      updateValues = [['승인']];
    } else {
      return res.status(400).json({ success: false, error: '잘못된 승인 유형입니다.' });
    }
    
    // Google Sheets 업데이트
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'RAW',
      resource: {
        values: updateValues
      }
    });
    
    // 승인 이력 저장
    const approvalHistoryRow = [
      `HIST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // A열: 이력ID
      policyId,                                                         // B열: 정책ID
      approvalType,                                                     // C열: 승인유형
      '승인',                                                           // D열: 승인상태
      userId,                                                           // E열: 승인자ID
      userName,                                                         // F열: 승인자명
      comment || '',                                                    // G열: 승인코멘트
      new Date().toISOString()                                         // H열: 승인일시
    ];
    
    // 시트에 데이터가 있는지 확인
    const existingHistoryData = await getSheetValuesWithoutCache('정책_승인이력');
    
    // 헤더 정의
    const historyHeaderRow = [
      '이력ID',           // A열
      '정책ID',           // B열
      '승인유형',         // C열
      '승인상태',         // D열
      '승인자ID',         // E열
      '승인자명',         // F열
      '승인코멘트',       // G열
      '승인일시'          // H열
    ];
    
    // 시트가 비어있거나 헤더가 없으면 헤더와 함께 데이터 추가
    if (!existingHistoryData || existingHistoryData.length === 0 || 
        !existingHistoryData[0] || existingHistoryData[0][0] !== '이력ID') {
      console.log('📝 [승인이력] 시트가 비어있거나 헤더가 없어 헤더와 함께 데이터 추가');
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_승인이력!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [historyHeaderRow, approvalHistoryRow]
        }
      });
    } else {
      // 기존 데이터가 있으면 이력만 추가
      console.log('📝 [승인이력] 기존 데이터에 이력 추가');
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_승인이력!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [approvalHistoryRow]
        }
      });
    }
    
    // 승인 알림 생성
    await createPolicyNotification(policyId, userId, 'policy_approved', { 
      approvalType, 
      comment 
    });
    
    // 정책_기본정보 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_기본정보 ');
    
    console.log('정책 승인 완료:', response.data);
    
    res.json({
      success: true,
      message: '정책이 성공적으로 승인되었습니다.',
      approvalType,
      approvedBy: userName
    });
    
  } catch (error) {
    console.error('정책 승인 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 카테고리 관리 API
app.get('/api/policy-categories', async (req, res) => {
  try {
    console.log('카테고리 목록 조회 요청');
    
    const values = await getSheetValuesWithoutCache('정책_카테고리');
    
    if (!values || values.length === 0) {
      // 카테고리가 없으면 기본 카테고리 생성
      await initializeDefaultCategories();
      const defaultValues = await getSheetValuesWithoutCache('정책_카테고리');
      const categories = defaultValues.slice(1).map(row => ({
        id: row[0],
        name: row[1],
        policyType: row[2],
        icon: row[3],
        isActive: row[4] === '활성',
        sortOrder: parseInt(row[5]) || 0,
        createdAt: row[6],
        updatedAt: row[7]
      }));
      
      return res.json({ success: true, categories });
    }
    
    const categories = values.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      policyType: row[2],
      icon: row[3],
      isActive: row[4] === '활성',
      sortOrder: parseInt(row[5]) || 0,
      createdAt: row[6],
      updatedAt: row[7]
    }));
    
    console.log(`카테고리 목록 조회 완료: ${categories.length}건`);
    res.json({ success: true, categories });
    
  } catch (error) {
    console.error('카테고리 목록 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 카테고리 추가 API
app.post('/api/policy-categories', async (req, res) => {
  try {
    const { name, policyType, icon, sortOrder } = req.body;
    
    console.log('새 카테고리 생성 요청:', req.body);
    
    // 필수 필드 검증
    if (!name || !policyType || !icon) {
      return res.status(400).json({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      });
    }
    
    // 카테고리 ID 생성
    const categoryId = `${policyType}_${name.replace(/\s+/g, '_').toLowerCase()}`;
    
    // 새 카테고리 데이터 생성
    const newCategoryRow = [
      categoryId,                    // A열: 카테고리ID
      name,                          // B열: 카테고리명
      policyType,                    // C열: 정책타입
      icon,                          // D열: 아이콘
      '활성',                        // E열: 활성화여부
      sortOrder || 0,                // F열: 정렬순서
      new Date().toISOString(),      // G열: 생성일시
      new Date().toISOString()       // H열: 수정일시
    ];
    
    // 시트에 데이터가 있는지 확인
    const existingData = await getSheetValuesWithoutCache('정책_카테고리');
    
    // 헤더 정의
    const headerRow = [
      '카테고리ID',      // A열
      '카테고리명',      // B열
      '정책타입',        // C열
      '아이콘',          // D열
      '활성화여부',      // E열
      '정렬순서',        // F열
      '생성일시',        // G열
      '수정일시'         // H열
    ];
    
    let response;
    
    // 시트가 비어있거나 헤더가 없으면 헤더와 함께 데이터 추가
    if (!existingData || existingData.length === 0 || 
        !existingData[0] || existingData[0][0] !== '카테고리ID') {
      console.log('📝 [카테고리생성] 시트가 비어있거나 헤더가 없어 헤더와 함께 데이터 추가');
      response = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_카테고리!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [headerRow, newCategoryRow]
        }
      });
    } else {
      // 기존 데이터가 있으면 카테고리만 추가
      console.log('📝 [카테고리생성] 기존 데이터에 카테고리 추가');
      response = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_카테고리!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newCategoryRow]
        }
      });
    }
    
    // 정책_카테고리 시트 캐시 무효화
    cacheUtils.delete('sheet_정책_카테고리');
    
    console.log('카테고리 생성 완료:', response.data);
    
    res.json({
      success: true,
      message: '카테고리가 성공적으로 생성되었습니다.',
      categoryId: categoryId
    });
    
  } catch (error) {
    console.error('카테고리 생성 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 기본 카테고리 초기화 함수
async function initializeDefaultCategories() {
  const defaultCategories = [
    ['wireless_shoe', '구두정책', 'wireless', '👞', '활성', 1, new Date().toISOString(), new Date().toISOString()],
    ['wireless_union', '연합정책', 'wireless', '🤝', '활성', 2, new Date().toISOString(), new Date().toISOString()],
    ['wireless_rate', '요금제유형별정책', 'wireless', '💰', '활성', 3, new Date().toISOString(), new Date().toISOString()],
    ['wireless_add_support', '부가추가지원정책', 'wireless', '➕', '활성', 4, new Date().toISOString(), new Date().toISOString()],
    ['wireless_add_deduct', '부가차감지원정책', 'wireless', '➖', '활성', 5, new Date().toISOString(), new Date().toISOString()],
    ['wireless_grade', '그레이드정책', 'wireless', '⭐', '활성', 6, new Date().toISOString(), new Date().toISOString()],
    ['wireless_individual', '개별소급정책', 'wireless', '📋', '활성', 7, new Date().toISOString(), new Date().toISOString()],
    ['wired_shoe', '구두정책', 'wired', '👞', '활성', 1, new Date().toISOString(), new Date().toISOString()],
    ['wired_union', '연합정책', 'wired', '🤝', '활성', 2, new Date().toISOString(), new Date().toISOString()],
    ['wired_rate', '요금제유형별정책', 'wired', '💰', '활성', 3, new Date().toISOString(), new Date().toISOString()],
    ['wired_add_support', '부가추가지원정책', 'wired', '➕', '활성', 4, new Date().toISOString(), new Date().toISOString()],
    ['wired_add_deduct', '부가차감지원정책', 'wired', '➖', '활성', 5, new Date().toISOString(), new Date().toISOString()],
    ['wired_grade', '그레이드정책', 'wired', '⭐', '활성', 6, new Date().toISOString(), new Date().toISOString()],
    ['wired_individual', '개별소급정책', 'wired', '📋', '활성', 7, new Date().toISOString(), new Date().toISOString()]
  ];
  
  const headerRow = [
    '카테고리ID',      // A열
    '카테고리명',      // B열
    '정책타입',        // C열
    '아이콘',          // D열
    '활성화여부',      // E열
    '정렬순서',        // F열
    '생성일시',        // G열
    '수정일시'         // H열
  ];
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: '정책_카테고리!A:H',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [headerRow, ...defaultCategories]
    }
  });
  
  console.log('기본 카테고리 초기화 완료');
}

// 운영모델 시트에서 모델 순서 가져오기 API
app.get('/api/operation-models', async (req, res) => {
  try {
    const cacheKey = 'operation_models_order';
    
    // 캐시에서 먼저 확인 (1시간 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    const operationModelValues = await getSheetValues('운영모델');
    
    if (!operationModelValues || operationModelValues.length < 4) {
      throw new Error('운영모델 시트를 가져올 수 없습니다.');
    }
    
    // 3행 헤더를 제외하고 4행부터 데이터 처리
    const modelOrder = {};
    operationModelValues.slice(3).forEach((row, index) => {
      if (row.length >= 3) {
        const modelName = (row[2] || '').toString().trim(); // C열: 모델명
        if (modelName && modelName !== '모델명') {
          modelOrder[modelName] = index;
        }
      }
    });
    
    const result = {
      success: true,
      data: modelOrder,
      count: Object.keys(modelOrder).length
    };
    
    // 캐시에 저장 (1시간 TTL)
    cacheUtils.set(cacheKey, result, 60 * 60 * 1000);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching operation models:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch operation models', 
      message: error.message 
    });
  }
});

// 재고장표 API - 모델별 재고 현황
app.get('/api/inventory/status', async (req, res) => {
  try {
    const { agent, office, department } = req.query;
    
    // 캐시 키 생성
    const cacheKey = `inventory_status_${agent || 'all'}_${office || 'all'}_${department || 'all'}`;
    
    // 캐시에서 먼저 확인 (30분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 폰클재고데이터와 폰클개통데이터 병렬로 가져오기
    const [inventoryValues, activationValues] = await Promise.all([
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클개통데이터')
    ]);
    
    if (!inventoryValues || inventoryValues.length < 4) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    if (!activationValues || activationValues.length < 4) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    // 재고 데이터 처리 (모델별 집계)
    const inventoryMap = new Map(); // key: "모델명", value: { 재고수량, 담당자, 사무실, 소속, 구분 }
    
    console.log(`📊 [재고배정 디버깅] 재고 데이터 행 수: ${inventoryValues.length}`);
    let processedRows = 0;
    let validModels = 0;
    
    inventoryValues.slice(3).forEach((row, index) => {
      if (row.length >= 23) {
        const modelName = (row[13] || '').toString().trim(); // N열: 모델명
        const color = (row[14] || '').toString().trim(); // O열: 색상
        const category = (row[5] || '').toString().trim(); // F열: 구분
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        const store = (row[21] || '').toString().trim(); // V열: 출고처
        
        // 디버깅: 처음 5개 행의 모델명 확인
        if (index < 5) {
          console.log(`재고 행 ${index}: 모델명="${modelName}", 색상="${color}", 구분="${category}", 길이=${row.length}`);
        }
        
        if (modelName && category !== '#N/A') {
          validModels++;
          // 필터링 적용
          if (req.query.agent && req.query.agent !== agent) return;
          if (req.query.office && req.query.office !== office) return;
          if (req.query.department && req.query.department !== department) return;
          
          // 모델별재고현황에서는 모델명+색상으로 집계 (서버에서는 원본 데이터 유지)
          const key = `${modelName}|${color}`;
          if (!inventoryMap.has(key)) {
            inventoryMap.set(key, {
              modelName,
              color,
              category,
              store,
              agent,
              office,
              department,
              inventoryCount: 0,
              monthlyActivation: 0,
              dailyActivation: Array(31).fill(0)
            });
          }
          
          inventoryMap.get(key).inventoryCount++;
        }
      }
    });
    
    // 개통 데이터 처리
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    activationValues.slice(3).forEach(row => {
      if (row.length >= 23) {
        const activationDate = (row[9] || '').toString().trim(); // J열: 개통일
        const modelName = (row[21] || '').toString().trim(); // V열: 모델명
        const color = (row[22] || '').toString().trim(); // W열: 색상
        const store = (row[14] || '').toString().trim(); // O열: 출고처
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        
        if (activationDate && modelName) {
          // 날짜 파싱 (2025-08-02 형식에서 날짜 추출)
          const dateMatch = activationDate.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            const activationYear = parseInt(year);
            const activationMonth = parseInt(month);
            const activationDay = parseInt(day);
            
            // 현재 월의 데이터만 처리
            if (activationYear === currentYear && activationMonth === currentMonth) {
              // 필터링 적용
              if (req.query.agent && req.query.agent !== agent) return;
              if (req.query.office && req.query.office !== office) return;
              if (req.query.department && req.query.department !== department) return;
              
              // 모델별재고현황에서는 모델명+색상으로 매칭 (서버에서는 원본 데이터 유지)
              const key = `${modelName}|${color}`;
              const inventoryItem = inventoryMap.get(key);
              if (inventoryItem) {
                inventoryItem.monthlyActivation++;
                
                // 일별 개통 현황 (1일~31일)
                if (activationDay >= 1 && activationDay <= 31) {
                  inventoryItem.dailyActivation[activationDay - 1]++;
                }
              }
            }
          }
        }
      }
    });
    
    // 결과 데이터 구성
    const result = {
      success: true,
      data: Array.from(inventoryMap.values()).map(item => ({
        ...item,
        dailyActivation: item.dailyActivation.map((count, index) => ({
          day: String(index + 1).padStart(2, '0'),
          count
        }))
      }))
    };
    
    // 캐시에 저장
    cacheUtils.set(cacheKey, result);
    
    res.json(result);
    
  } catch (error) {
    console.error('재고 현황 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 재고장표 API - 담당자 필터 옵션 (실제 재고가 있는 담당자만)
app.get('/api/inventory/agent-filters', async (req, res) => {
  try {
    // 캐시 키 생성
    const cacheKey = 'inventory_agent_filters';
    
    // 캐시에서 먼저 확인 (30분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 폰클재고데이터와 폰클개통데이터 병렬로 가져오기
    const [inventoryValues, activationValues] = await Promise.all([
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클개통데이터')
    ]);
    
    if (!inventoryValues || inventoryValues.length < 4) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    if (!activationValues || activationValues.length < 4) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    // 실제 재고가 있는 담당자 추출
    const agentsWithInventory = new Set();
    const agentsWithActivation = new Set();
    const agentInfo = new Map(); // key: 담당자명, value: { office, department }
    
    // 재고 데이터에서 담당자 추출
    inventoryValues.slice(3).forEach(row => {
      if (row.length >= 23) {
        const modelName = (row[13] || '').toString().trim(); // N열: 모델명
        const category = (row[5] || '').toString().trim(); // F열: 구분
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        
        if (modelName && category !== '#N/A' && agent) {
          agentsWithInventory.add(agent);
          if (!agentInfo.has(agent)) {
            agentInfo.set(agent, { office, department });
          }
        }
      }
    });
    
    // 개통 데이터에서 담당자 추출 (당월)
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    activationValues.slice(3).forEach(row => {
      if (row.length >= 23) {
        const activationDate = (row[9] || '').toString().trim(); // J열: 개통일
        const modelName = (row[21] || '').toString().trim(); // V열: 모델명
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        
        if (activationDate && modelName && agent) {
          // 날짜 파싱 (2025-08-02 형식에서 날짜 추출)
          const dateMatch = activationDate.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            const [, year, month] = dateMatch;
            const activationYear = parseInt(year);
            const activationMonth = parseInt(month);
            
            // 현재 월의 데이터만 처리
            if (activationYear === currentYear && activationMonth === currentMonth) {
              agentsWithActivation.add(agent);
              if (!agentInfo.has(agent)) {
                agentInfo.set(agent, { office, department });
              }
            }
          }
        }
      }
    });
    
    // 보유재고와 개통재고가 있는 담당자 통합
    const allAgentsWithData = new Set([...agentsWithInventory, ...agentsWithActivation]);
    
    // 결과 데이터 구성
    const result = {
      success: true,
      data: Array.from(allAgentsWithData).map(agent => ({
        target: agent,
        contactId: agent,
        office: agentInfo.get(agent)?.office || '',
        department: agentInfo.get(agent)?.department || '',
        hasInventory: agentsWithInventory.has(agent),
        hasActivation: agentsWithActivation.has(agent)
      })).sort((a, b) => a.target.localeCompare(b.target))
    };
    
    // 캐시에 저장 (30분 TTL)
    cacheUtils.set(cacheKey, result, 30 * 60 * 1000);
    
    res.json(result);
    
  } catch (error) {
    console.error('재고장표 담당자 필터 옵션 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 재고장표 API - 색상별 재고 현황
app.get('/api/inventory/status-by-color', async (req, res) => {
  try {
    const { agent, office, department } = req.query;
    
    // 캐시 키 생성
    const cacheKey = `inventory_status_by_color_${agent || 'all'}_${office || 'all'}_${department || 'all'}`;
    
    // 캐시에서 먼저 확인 (30분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 폰클재고데이터와 폰클개통데이터 병렬로 가져오기
    const [inventoryValues, activationValues] = await Promise.all([
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클개통데이터')
    ]);
    
    if (!inventoryValues || inventoryValues.length < 4) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }
    
    if (!activationValues || activationValues.length < 4) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    // 재고 데이터 처리 (모델명+색상별 집계)
    const inventoryMap = new Map(); // key: "모델명|색상", value: { 모델명, 색상, 재고수량, 담당자, 사무실, 소속, 구분 }
    
    // 먼저 모델명이 있는 행들만 수집
    const validRows = [];
    inventoryValues.slice(3).forEach(row => {
      if (row.length >= 23) {
        const modelName = (row[13] || '').toString().trim(); // N열: 모델명
        const color = (row[14] || '').toString().trim(); // O열: 색상
        const category = (row[5] || '').toString().trim(); // F열: 구분
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        const store = (row[21] || '').toString().trim(); // V열: 출고처
        
        // 모델명이 있고, 색상이 있고, 구분이 #N/A가 아닌 경우만 처리
        if (modelName && color && category !== '#N/A') {
          // 필터링 적용
          if (req.query.agent && req.query.agent !== agent) return;
          if (req.query.office && req.query.office !== office) return;
          if (req.query.department && req.query.department !== department) return;
          
          validRows.push({
            modelName,
            color,
            category,
            store,
            agent,
            office,
            department
          });
        }
      }
    });
    
    // 모델명별로 그룹화하여 처리
    const modelGroups = new Map();
    validRows.forEach(row => {
      if (!modelGroups.has(row.modelName)) {
        modelGroups.set(row.modelName, []);
      }
      modelGroups.get(row.modelName).push(row);
    });
    
    // 각 모델 그룹에서 색상별로 처리
    modelGroups.forEach((rows, modelName) => {
      rows.forEach((row, index) => {
        const key = `${modelName}|${row.color}`;
        
        if (!inventoryMap.has(key)) {
          inventoryMap.set(key, {
            modelName: modelName, // 모든 행에 모델명 표시 (프론트엔드에서 처리)
            color: row.color,
            category: row.category,
            store: row.store,
            agent: row.agent,
            office: row.office,
            department: row.department,
            inventoryCount: 0,
            monthlyActivation: 0,
            dailyActivation: Array(31).fill(0)
          });
        }
        
        inventoryMap.get(key).inventoryCount++;
      });
    });
    
    // 개통 데이터 처리
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    activationValues.slice(3).forEach(row => {
      if (row.length >= 23) {
        const activationDate = (row[9] || '').toString().trim(); // J열: 개통일
        const modelName = (row[21] || '').toString().trim(); // V열: 모델명
        const color = (row[22] || '').toString().trim(); // W열: 색상
        const store = (row[14] || '').toString().trim(); // O열: 출고처
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        
        if (activationDate && modelName && color) {
          // 날짜 파싱 (2025-08-02 형식에서 날짜 추출)
          const dateMatch = activationDate.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            const activationYear = parseInt(year);
            const activationMonth = parseInt(month);
            const activationDay = parseInt(day);
            
            // 현재 월의 데이터만 처리
            if (activationYear === currentYear && activationMonth === currentMonth) {
              // 필터링 적용
              if (req.query.agent && req.query.agent !== agent) return;
              if (req.query.office && req.query.office !== office) return;
              if (req.query.department && req.query.department !== department) return;
              
              const key = `${modelName}|${color}`;
              const inventoryItem = inventoryMap.get(key);
              if (inventoryItem) {
                inventoryItem.monthlyActivation++;
                
                // 일별 개통 현황 (1일~31일)
                if (activationDay >= 1 && activationDay <= 31) {
                  inventoryItem.dailyActivation[activationDay - 1]++;
                }
              }
            }
          }
        }
      }
    });
    
    // 결과 데이터 구성
    const result = {
      success: true,
      data: Array.from(inventoryMap.values()).map(item => ({
        ...item,
        dailyActivation: item.dailyActivation.map((count, index) => ({
          day: String(index + 1).padStart(2, '0'),
          count
        }))
      }))
    };
    
    // 캐시에 저장
    cacheUtils.set(cacheKey, result);
    
    res.json(result);
    
  } catch (error) {
    console.error('색상별 재고 현황 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 예산 대상월 관리 API
app.get('/api/budget/month-sheets', async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_대상월관리!A:D',
    });

    const rows = sheetsData.data.values || [];
    
    // 시트가 비어있거나 헤더가 없으면 헤더 생성
    if (rows.length === 0 || !rows[0] || rows[0][0] !== '대상월') {
      const headerRow = ['대상월', '시트ID', '수정일시', '수정자'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '예산_대상월관리!A1:D1',
        valueInputOption: 'RAW',
        resource: {
          values: [headerRow]
        }
      });
      return res.json([]);
    }

    if (rows.length <= 1) {
      return res.json([]);
    }

    // 헤더 제외하고 데이터만 반환
    const data = rows.slice(1).map(row => ({
      month: row[0] || '',
      sheetId: row[1] || '',
      updatedAt: row[2] || '',
      updatedBy: row[3] || ''
    }));

    res.json(data);
  } catch (error) {
    console.error('예산 대상월 관리 데이터 조회 오류:', error);
    res.status(500).json({ error: '데이터 조회 중 오류가 발생했습니다.' });
  }
});

app.post('/api/budget/month-sheets', async (req, res) => {
  try {
    const { month, sheetId, updatedBy } = req.body;
    
    if (!month || !sheetId) {
      return res.status(400).json({ error: '대상월과 시트 ID는 필수입니다.' });
    }

    const currentTime = new Date().toISOString();
    
    // 기존 데이터 확인
    const sheets = google.sheets({ version: 'v4', auth });
    const existingSheets = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_대상월관리!A:D',
    });

    const rows = existingSheets.data.values || [];
    const existingRowIndex = rows.findIndex(row => row[0] === month);
    
    if (existingRowIndex > 0) { // 0은 헤더
      // 기존 데이터 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `예산_대상월관리!B${existingRowIndex + 1}:D${existingRowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[sheetId, currentTime, updatedBy]]
        }
      });
    } else {
      // 새 데이터 추가
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '예산_대상월관리!A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [[month, sheetId, currentTime, updatedBy]]
        }
      });
    }

    res.json({ message: '월별 시트 ID가 저장되었습니다.' });
  } catch (error) {
    console.error('예산 대상월 관리 데이터 저장 오류:', error);
    res.status(500).json({ error: '데이터 저장 중 오류가 발생했습니다.' });
  }
});

app.delete('/api/budget/month-sheets/:month', async (req, res) => {
  try {
    const { month } = req.params;
    
    // 기존 데이터 확인
    const sheets = google.sheets({ version: 'v4', auth });
    const existingSheets = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_대상월관리!A:D',
    });

    const rows = existingSheets.data.values || [];
    const existingRowIndex = rows.findIndex(row => row[0] === month);
    
    if (existingRowIndex <= 0) { // 0은 헤더, -1은 찾지 못함
      return res.status(404).json({ error: '해당 월의 데이터를 찾을 수 없습니다.' });
    }

    // 행 삭제
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: await getSheetIdByName('예산_대상월관리'),
                dimension: 'ROWS',
                startIndex: existingRowIndex,
                endIndex: existingRowIndex + 1
              }
            }
          }
        ]
      }
    });

    res.json({ message: '월별 시트 ID가 삭제되었습니다.' });
  } catch (error) {
    console.error('예산 대상월 관리 데이터 삭제 오류:', error);
    res.status(500).json({ error: '데이터 삭제 중 오류가 발생했습니다.' });
  }
});

// 시트 이름으로 시트 ID를 가져오는 헬퍼 함수
async function getSheetIdByName(sheetName) {
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
  } catch (error) {
    console.error('시트 ID 조회 오류:', error);
    return null;
  }
}

// 예산_사용자시트관리 시트 존재 확인 및 생성 함수
async function ensureUserSheetManagementExists(sheets) {
  try {
    // 시트 목록 조회
    const spreadsheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetExists = spreadsheetResponse.data.sheets.some(
      sheet => sheet.properties.title === '예산_사용자시트관리'
    );
    
    if (!sheetExists) {
      console.log('📋 [시트관리] 예산_사용자시트관리 시트가 없어 새로 생성합니다.');
      
      // 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: '예산_사용자시트관리',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 10
                  }
                }
              }
            }
          ]
        }
      });
      
      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '예산_사용자시트관리!A1:G1',
        valueInputOption: 'RAW',
        resource: {
          values: [['사용자ID', '시트ID', '시트명', '생성일시', '생성자', '대상월', '선택된정책그룹']]
        }
      });
      
      console.log('✅ [시트관리] 예산_사용자시트관리 시트 생성 및 헤더 설정 완료');
    }
  } catch (error) {
    console.error('예산_사용자시트관리 시트 확인/생성 실패:', error);
  }
}

// 새로운 안전한 폰클개통데이터 업데이트 API
app.post('/api/budget/user-sheets/:sheetId/update-usage-safe', async (req, res) => {
  console.log('🔒 [SAFE-UPDATE] POST /api/budget/user-sheets/:sheetId/update-usage-safe 호출됨!');
  try {
    const { sheetId } = req.params;
    const { selectedPolicyGroups, dateRange, userName, budgetType } = req.body;
    
    if (!selectedPolicyGroups || !Array.isArray(selectedPolicyGroups)) {
      return res.status(400).json({ error: '선택된 정책그룹이 필요합니다.' });
    }
    
    // 사용자 정보 설정
    const userInfo = {
      userName: userName || 'Unknown',
      budgetType: budgetType || 'Ⅰ',
      selectedPolicyGroups
    };
    
    console.log(`🔒 [SAFE-UPDATE] 처리 시작: 사용자=${userInfo.userName}, 타입=${userInfo.budgetType}`);
    
    // 1. 기존 calculateUsageBudget 함수로 계산 수행 (실제 업데이트는 하지 않음)
    const calculatedResult = await calculateUsageBudgetDryRun(sheetId, selectedPolicyGroups, dateRange, userName, budgetType);
    
    // 2. PhoneklDataManager를 사용하여 안전한 업데이트
    const updateResult = await phoneklDataManager.safeUpdateData(
      sheetId, 
      budgetType, 
      calculatedResult.dataMapping, 
      userInfo,
      dateRange
    );
    
    console.log(`✅ [SAFE-UPDATE] 완료: ${updateResult.message}`);
    
    // 계산 결과를 메타데이터에 누적 저장 (O열~X열)
    try {
      console.log(`💾 [SAFE-UPDATE] 메타데이터 누적 저장 시작`);
      
      const sheets = google.sheets({ version: 'v4', auth });
      
      // 사용자 자격 정보를 대리점아이디관리에서 가져오기
      let userQualification = '이사'; // 기본값
      try {
        // 사용자명에서 괄호와 공백을 완전히 제거
        const baseUserName = userName.replace(/\([^)]+\)/g, '').trim();
        console.log(`🔍 [SAFE-UPDATE] 사용자명 정리: "${userName}" → "${baseUserName}"`);
        
        const agentValues = await getSheetValues(AGENT_SHEET_NAME);
        if (agentValues) {
          const agentRows = agentValues.slice(1);
          const userAgent = agentRows.find(row => row[0] === baseUserName); // A열: 이름으로 검색
          if (userAgent) {
            userQualification = userAgent[1] || '이사'; // B열: 자격
            console.log(`📋 [SAFE-UPDATE] 사용자 자격 확인: ${baseUserName} → ${userQualification}`);
          } else {
            console.log(`⚠️ [SAFE-UPDATE] 대리점아이디관리에서 ${baseUserName} 정보를 찾을 수 없어 기본값 '이사' 사용`);
          }
        }
      } catch (error) {
        console.error('사용자 자격 정보 조회 실패:', error);
      }
      
      // 사용자 시트 이름 가져오기 (동적 자격 사용, 중복 방지)
      const cleanUserName = userName.replace(/\([^)]+\)/g, '').trim(); // 괄호 완전 제거
      const userSheetName = `액면_${cleanUserName}(${budgetType || 'Ⅰ'}) (${userQualification})`;
      console.log(`📝 [SAFE-UPDATE] 시트명 생성: "${userSheetName}"`);
      
      // 기존 메타데이터 읽기 (O열~X열)
      let existingMetadata = [];
      try {
        const metadataResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${userSheetName}!O:X`
        });
        existingMetadata = metadataResponse.data.values || [];
      } catch (error) {
        console.log(`📋 [SAFE-UPDATE] 기존 메타데이터 없음, 새로 생성`);
      }
      
      // 헤더 설정 (O열~X열)
      const metadataHeader = [
        '저장일시', '접수일범위', '개통일범위', '접수일적용여부', 
        '계산일시', '계산자', '정책그룹', '잔액', '확보', '사용'
      ];
      
      // 사용자시트의 A열(접수시작일), B열(접수종료일) 데이터 읽기
      let receiptDateRange = '미설정';
      let receiptDateApplied = '미적용';
      
      try {
        const userSheetData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${userSheetName}!A:B`
        });
        
        const userSheetRows = userSheetData.data.values || [];
        if (userSheetRows.length > 1) { // 헤더 제외하고 데이터 행 확인
          // 첫 번째 데이터 행 (헤더 다음 행)의 A열(접수시작일), B열(접수종료일) 확인
          const firstDataRow = userSheetRows[1]; // 인덱스 1 = 두 번째 행 (헤더 제외)
          if (firstDataRow && firstDataRow[0] && firstDataRow[1]) {
            // 실제 날짜 데이터인지 확인 (헤더 텍스트가 아닌)
            const startDate = firstDataRow[0];
            const endDate = firstDataRow[1];
            
            // 헤더 텍스트가 아닌 실제 날짜 데이터인 경우만 적용
            if (startDate !== '접수시작일' && endDate !== '접수종료일' && 
                startDate !== '시작일' && endDate !== '종료일' &&
                startDate.trim() !== '' && endDate.trim() !== '') {
              receiptDateRange = `${startDate} ~ ${endDate}`;
              receiptDateApplied = '적용';
              console.log(`📅 [SAFE-UPDATE] 사용자시트 접수일 범위 확인: ${receiptDateRange}`);
            } else {
              console.log(`⚠️ [SAFE-UPDATE] 사용자시트 첫 번째 행이 헤더입니다: ${startDate}, ${endDate}`);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ [SAFE-UPDATE] 사용자시트 접수일 데이터 읽기 실패:`, error.message);
      }
      
      // 새 정책 데이터 행 생성
      const newPolicyRow = [
        new Date().toISOString(),           // O열: 저장일시
        receiptDateRange,                   // P열: 접수일범위 (사용자시트 데이터 기반)
        `${dateRange.startDate} ~ ${dateRange.endDate}`, // Q열: 개통일범위
        receiptDateApplied,                 // R열: 접수일적용여부 (사용자시트 데이터 기반)
        new Date().toISOString(),           // S열: 계산일시
        userName,                           // T열: 계산자
        selectedPolicyGroups.join(','),     // U열: 정책그룹
        calculatedResult.totalRemainingBudget, // V열: 잔액
        calculatedResult.totalSecuredBudget,   // W열: 확보
        calculatedResult.totalUsedBudget       // X열: 사용
      ];
      
      // 메타데이터 저장 - 헤더가 없으면 헤더 추가, 새 정책은 append로 추가
      
      // 헤더가 없으면 헤더 추가
      if (existingMetadata.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${userSheetName}!O1:X1`,
          valueInputOption: 'RAW',
          resource: {
            values: [metadataHeader]
          }
        });
        console.log(`📝 [SAFE-UPDATE] ${userSheetName}: 메타데이터 헤더 생성 완료`);
      }
      
      // 기존 메타데이터 백업 (문제 진단용)
      console.log(`💾 [SAFE-UPDATE] 기존 메타데이터 백업:`, existingMetadata);
      
      // 새 정책 데이터를 append로 추가 (기존 데이터 덮어쓰지 않음)
      console.log(`📝 [SAFE-UPDATE] ${userSheetName}: 새 정책 데이터 append로 추가`);
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${userSheetName}!O:X`,
        valueInputOption: 'RAW',
        resource: {
          values: [newPolicyRow]
        }
      });
      console.log(`✅ [SAFE-UPDATE] 메타데이터 새 정책 추가 완료 (${existingMetadata.length + 1}번째 정책)`);
      
      // 저장 후 검증 (문제 진단용)
      try {
        const verificationResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${userSheetName}!O:X`
        });
        const finalMetadata = verificationResponse.data.values || [];
        console.log(`🔍 [SAFE-UPDATE] 저장 후 메타데이터 검증: ${finalMetadata.length}행`);
        console.log(`📊 [SAFE-UPDATE] 최종 메타데이터:`, finalMetadata);
      } catch (verificationError) {
        console.log(`⚠️ [SAFE-UPDATE] 메타데이터 검증 실패:`, verificationError.message);
      }
      
      // 메타데이터 정리 로직 제거 - 기존 정책을 보존하고 새 정책만 추가
      console.log(`✅ [SAFE-UPDATE] ${userSheetName}: 메타데이터 정리 로직 제거, 기존 정책 보존`);
    } catch (metadataError) {
      console.error(`❌ [SAFE-UPDATE] 메타데이터 저장 실패:`, metadataError.message);
    }
    
    res.json({
      message: '액면예산이 안전하게 업데이트되었습니다.',
      result: updateResult,
      calculationSummary: {
        totalSecuredBudget: calculatedResult.totalSecuredBudget,
        totalUsedBudget: calculatedResult.totalUsedBudget,
        totalRemainingBudget: calculatedResult.totalRemainingBudget,
        processedRows: calculatedResult.processedRows,
        matchedItems: calculatedResult.matchedItems
      }
    });
    
  } catch (error) {
    console.error('[SAFE-UPDATE] 안전 업데이트 오류:', error);
    res.status(500).json({ error: '안전 업데이트 중 오류가 발생했습니다: ' + error.message });
  }
});

// 기존 API (레거시)
app.post('/api/budget/user-sheets/:sheetId/update-usage', async (req, res) => {
  try {
    const { sheetId } = req.params;
    const { selectedPolicyGroups, dateRange, userName, budgetType } = req.body;
    
    if (!selectedPolicyGroups || !Array.isArray(selectedPolicyGroups)) {
      return res.status(400).json({ error: '선택된 정책그룹이 필요합니다.' });
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 먼저 액면예산 C열 업데이트
    const calculateResult = await calculateUsageBudget(sheetId, selectedPolicyGroups, dateRange, userName, budgetType);
    
    // 사용자 시트에서 데이터 가져오기
    const userSheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:L', // 사용자 시트 데이터 범위 (12개 컬럼)
    });
    
    const userSheetRows = userSheetData.data.values || [];
    
    // 액면예산 타입에 따른 액면예산 매핑 컬럼 결정
    const currentBudgetType = budgetType || 'Ⅰ';
    let phoneklColumns = {};
    
    if (currentBudgetType === 'Ⅰ') {
      // 액면예산(Ⅰ): L열(예산잔액), M열(확보예산), N열(사용예산)
      phoneklColumns = {
        remainingBudget: 'L', // 예산잔액
        securedBudget: 'M',   // 확보예산
        usedBudget: 'N'       // 사용예산
      };
    } else if (currentBudgetType === 'Ⅱ') {
      // 액면예산(Ⅱ): I열(예산잔액), J열(확보예산), K열(사용예산)
      phoneklColumns = {
        remainingBudget: 'I', // 예산잔액
        securedBudget: 'J',   // 확보예산
        usedBudget: 'K'       // 사용예산
      };
    }
    
    // 액면예산에서 계산된 데이터를 사용자 시트의 사용예산에 반영
    const updateRequests = [];
    
    userSheetRows.forEach((row, index) => {
      if (row.length >= 12) {
        const armyType = row[6]; // 군 (G열 - 기존 D열에서 3열 밀림)
        const categoryType = row[7]; // 유형 (H열 - 기존 E열에서 3열 밀림)
        
        // 액면예산에서 해당 군/유형에 맞는 사용예산 찾기
        const matchingData = calculateResult.calculatedData.find(data => 
          data.armyType === armyType && data.categoryType === categoryType
        );
        
        if (matchingData) {
          // 사용예산 업데이트 (J열 - 기존 F열에서 3열 밀림)
          updateRequests.push({
            range: `J${index + 2}`,
            values: [[matchingData.budgetValue]]
          });
          
          // 잔액 업데이트 (K열 - 기존 G열에서 3열 밀림) - 예산타입에 따른 확보예산
          const defaultSecuredBudget = budgetType === 'Ⅱ' ? 0 : 40000;
          const securedBudget = defaultSecuredBudget;
          const remainingBudget = securedBudget - matchingData.budgetValue;
          updateRequests.push({
            range: `K${index + 2}`,
            values: [[remainingBudget]]
          });
          
          console.log(`💾 [사용자시트] Row ${index + 2} 업데이트: 사용예산=${matchingData.budgetValue}, 잔액=${remainingBudget}`);
        }
      }
    });
    
    // 사용자 시트 업데이트
    if (updateRequests.length > 0) {
      console.log(`🚀 [사용자시트] 배치 업데이트 실행: ${updateRequests.length}개 셀`);
      
      try {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          valueInputOption: 'RAW',
          data: updateRequests
        }
      });
        
        console.log(`✅ [사용자시트] 배치 업데이트 성공: ${updateRequests.length}개 셀`);
      } catch (error) {
        console.error(`❌ [사용자시트] 배치 업데이트 실패:`, error);
        throw error;
      }
    }
    
    // 계산 결과를 메타데이터에 누적 저장 (O열~X열)
    try {
      console.log(`💾 [updateUserSheetUsage] 메타데이터 누적 저장 시작`);
      
      // 사용자 자격 정보를 대리점아이디관리에서 가져오기
      let userQualification = '이사'; // 기본값
      try {
        // 사용자명에서 괄호와 공백을 완전히 제거
        const baseUserName = userName.replace(/\([^)]+\)/g, '').trim();
        console.log(`🔍 [updateUserSheetUsage] 사용자명 정리: "${userName}" → "${baseUserName}"`);
        
        const agentValues = await getSheetValues(AGENT_SHEET_NAME);
        if (agentValues) {
          const agentRows = agentValues.slice(1);
          const userAgent = agentRows.find(row => row[0] === baseUserName); // A열: 이름으로 검색
          if (userAgent) {
            userQualification = userAgent[1] || '이사'; // B열: 자격
            console.log(`📋 [updateUserSheetUsage] 사용자 자격 확인: ${baseUserName} → ${userQualification}`);
          } else {
            console.log(`⚠️ [updateUserSheetUsage] 대리점아이디관리에서 ${baseUserName} 정보를 찾을 수 없어 기본값 '이사' 사용`);
          }
        }
      } catch (error) {
        console.error('사용자 자격 정보 조회 실패:', error);
      }
      
      // 사용자 시트 이름 가져오기 (동적 자격 사용, 중복 방지)
      const cleanUserName = userName.replace(/\([^)]+\)/g, '').trim(); // 괄호 완전 제거
      const userSheetName = `액면_${cleanUserName}(${budgetType || 'Ⅰ'}) (${userQualification})`;
      console.log(`📝 [updateUserSheetUsage] 시트명 생성: "${userSheetName}"`);
      
      // 기존 메타데이터 읽기 (O열~X열)
      let existingMetadata = [];
      try {
        const metadataResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${userSheetName}!O:X`
        });
        existingMetadata = metadataResponse.data.values || [];
      } catch (error) {
        console.log(`📋 [updateUserSheetUsage] 기존 메타데이터 없음, 새로 생성`);
      }
      
      // 헤더 설정 (O열~X열)
      const metadataHeader = [
        '저장일시', '접수일범위', '개통일범위', '접수일적용여부', 
        '계산일시', '계산자', '정책그룹', '잔액', '확보', '사용'
      ];
      
      // 사용자시트의 A열(접수시작일), B열(접수종료일) 데이터 읽기
      let receiptDateRange = '미설정';
      let receiptDateApplied = '미적용';
      
      try {
        const userSheetData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${userSheetName}!A:B`
        });
        
        const userSheetRows = userSheetData.data.values || [];
        if (userSheetRows.length > 1) { // 헤더 제외하고 데이터 행 확인
          // 첫 번째 데이터 행 (헤더 다음 행)의 A열(접수시작일), B열(접수종료일) 확인
          const firstDataRow = userSheetRows[1]; // 인덱스 1 = 두 번째 행 (헤더 제외)
          if (firstDataRow && firstDataRow[0] && firstDataRow[1]) {
            // 실제 날짜 데이터인지 확인 (헤더 텍스트가 아닌)
            const startDate = firstDataRow[0];
            const endDate = firstDataRow[1];
            
            // 헤더 텍스트가 아닌 실제 날짜 데이터인 경우만 적용
            if (startDate !== '접수시작일' && endDate !== '접수종료일' && 
                startDate !== '시작일' && endDate !== '종료일' &&
                startDate.trim() !== '' && endDate.trim() !== '') {
              receiptDateRange = `${startDate} ~ ${endDate}`;
              receiptDateApplied = '적용';
              console.log(`📅 [updateUserSheetUsage] 사용자시트 접수일 범위 확인: ${receiptDateRange}`);
            } else {
              console.log(`⚠️ [updateUserSheetUsage] 사용자시트 첫 번째 행이 헤더입니다: ${startDate}, ${endDate}`);
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ [updateUserSheetUsage] 사용자시트 접수일 데이터 읽기 실패:`, error.message);
      }
      
      // 새 정책 데이터 행 생성
      const newPolicyRow = [
        new Date().toISOString(),           // O열: 저장일시
        receiptDateRange,                   // P열: 접수일범위 (사용자시트 데이터 기반)
        `${dateRange.startDate} ~ ${dateRange.endDate}`, // Q열: 개통일범위
        receiptDateApplied,                 // R열: 접수일적용여부 (사용자시트 데이터 기반)
        new Date().toISOString(),           // S열: 계산일시
        userName,                           // T열: 계산자
        selectedPolicyGroups.join(','),     // U열: 정책그룹
        calculateResult.totalRemainingBudget, // V열: 잔액
        calculateResult.totalSecuredBudget,   // W열: 확보
        calculateResult.totalUsedBudget       // X열: 사용
      ];
      
      // 메타데이터 업데이트 (기존 데이터 유지하고 새 행 추가)
      const metadataUpdateRequests = [];
      
      // 헤더가 없으면 헤더 추가
      if (existingMetadata.length === 0) {
        metadataUpdateRequests.push({
          range: `${userSheetName}!O1:X1`,
          values: [metadataHeader]
        });
      }
      
      // 새 정책 데이터 행 추가
      metadataUpdateRequests.push({
        range: `${userSheetName}!O${existingMetadata.length + 2}:X${existingMetadata.length + 2}`,
        values: [newPolicyRow]
      });
      
      // 메타데이터 업데이트 실행
      if (metadataUpdateRequests.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            valueInputOption: 'RAW',
            data: metadataUpdateRequests
          }
        });
        console.log(`✅ [updateUserSheetUsage] 메타데이터 누적 저장 완료 (${existingMetadata.length + 1}번째 정책)`);
      }
    } catch (metadataError) {
      console.error(`❌ [updateUserSheetUsage] 메타데이터 저장 실패:`, metadataError.message);
    }
    
    res.json({
      message: '사용자 시트의 사용예산이 업데이트되었습니다.',
      updatedRows: updateRequests.length,
      totalUsedBudget: calculateResult.totalUsedBudget
    });
    
  } catch (error) {
    console.error('사용자 시트 사용예산 업데이트 오류:', error);
    res.status(500).json({ error: '사용자 시트 사용예산 업데이트에 실패했습니다.' });
  }
});

// 새로운 사용자 시트 조회 API (UserSheetManager 사용) - 계산 로직 제거
app.get('/api/budget/user-sheets-v2', async (req, res) => {
  // CORS 헤더 명시적 설정
  res.header('Access-Control-Allow-Origin', 'https://vipmobile.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  console.log('🔍 [NEW-API] GET /api/budget/user-sheets-v2 호출됨!', req.query);
  try {
    const { userId, targetMonth, showAllUsers, budgetType } = req.query;
    
    await userSheetManager.ensureSheetExists();
    
    const options = {
      userId,
      targetMonth,
      showAllUsers: showAllUsers === 'true',
      budgetType: budgetType || null
    };
    
    const userSheets = await userSheetManager.getUserSheets(options);
    
    // 디버깅: 중복 확인
    console.log(`🔍 [NEW-API] userSheets 배열 내용:`, userSheets.map(sheet => ({
      sheetName: sheet.sheetName,
      sheetId: sheet.sheetId,
      uuid: sheet.uuid
    })));
    
    // 중복 제거 (sheetId + sheetName 기준) - 각 사용자별 시트를 개별적으로 표시
    const uniqueSheets = userSheets.filter((sheet, index, self) => 
      index === self.findIndex(s => s.sheetId === sheet.sheetId && s.sheetName === sheet.sheetName)
    );
    
    console.log(`🔍 [NEW-API] 중복 제거 후: ${uniqueSheets.length}개`);
    
    // 각 시트의 요약 정보 가져오기
    const enrichedSheets = await Promise.all(uniqueSheets.map(async (sheet) => {
      let summary = {
        totalSecuredBudget: 0,
        totalUsedBudget: 0,
        totalRemainingBudget: 0,
        itemCount: 0,
        lastUpdated: sheet.createdAt,
        dateRange: '',
        applyReceiptDate: false
      };
      
      try {
        const sheets_api = google.sheets({ version: 'v4', auth });
        
        // 시트의 예산 데이터 요약 정보 가져오기
        const budgetTypeMatch = sheet.sheetName.match(/\(([IⅠⅡ]+)\)/);
        const budgetType = budgetTypeMatch ? budgetTypeMatch[1] : 'Ⅰ';
        
        // 사용자 시트 메타데이터에서 계산 결과 불러오기 (O열~X열)
        console.log(`🔍 [${sheet.sheetName}] 메타데이터에서 계산 결과 불러오기 시작!`);
        
        try {
          // 사용자 시트 메타데이터에서 계산 결과 가져오기 (O열~X열)
          const metadataResponse = await sheets_api.spreadsheets.values.get({
            spreadsheetId: sheet.sheetId,
            range: `${sheet.sheetName}!O:X`
          });
          
          const metadata = metadataResponse.data.values || [];
          console.log(`📊 [${sheet.sheetName}] 메타데이터 데이터 로드: ${metadata.length}행`);
          
          if (metadata.length > 1) { // 헤더 1행 제외
            let totalRemainingBudget = 0;
            let totalSecuredBudget = 0;
            let totalUsedBudget = 0;
            let policyCount = 0;
            
            // 메타데이터의 각 정책 행에서 예산 데이터 합계 (빈 행 제외)
            const validRows = metadata.slice(1).filter(row => 
              row.length >= 10 && row.some(cell => cell !== '' && cell !== null && cell !== undefined)
            );
            
            const policies = [];
            // 모든 정책 행을 처리
            
            validRows.forEach((row, index) => {
              if (row.length >= 10) {
                // 각 정책별로 개별 시트에서 실제 값을 읽어오기
                // V열: 잔액, W열: 확보, X열: 사용 (메타데이터에 저장된 값)
                const remainingBudget = parseFloat(row[7]) || 0; // V열 (0-based index 7)
                const securedBudget = parseFloat(row[8]) || 0;   // W열 (0-based index 8)
                const usedBudget = parseFloat(row[9]) || 0;      // X열 (0-based index 9)
                
                // 메타데이터 부가정보 (표시용)
                const savedAt = row[0] || '';
                const receiptDateRange = row[1] || '';
                const activationDateRange = row[2] || '';
                const receiptApplied = row[3] || '';
                const calculatedAt = row[4] || '';
                const calculator = row[5] || '';
                const policyGroups = row[6] || '';
                
                // 각 정책을 개별적으로 처리 (중복 제거하지 않음)
                totalRemainingBudget += remainingBudget;
                totalSecuredBudget += securedBudget;
                totalUsedBudget += usedBudget;
                policyCount++;
                
                // 각 정책 데이터를 policies 배열에 추가
                policies.push({
                  securedBudget,
                  usedBudget,
                  remainingBudget,
                  savedAt,
                  receiptDateRange,
                  activationDateRange,
                  receiptApplied,
                  calculatedAt,
                  calculator,
                  policyGroups
                });
                
                console.log(`📋 [${sheet.sheetName}] 정책 ${policyCount}: 잔액=${remainingBudget}, 확보=${securedBudget}, 사용=${usedBudget}`);
              }
            });
            
            console.log(`📊 [${sheet.sheetName}] 메타데이터 계산 완료: 잔액=${totalRemainingBudget}, 확보=${totalSecuredBudget}, 사용=${totalUsedBudget}, 정책수=${policyCount}`);
            
            summary.totalRemainingBudget = totalRemainingBudget;
            summary.totalSecuredBudget = totalSecuredBudget;
            summary.totalUsedBudget = totalUsedBudget;
            summary.itemCount = policyCount;
            summary.policies = policies; // 정책별 데이터 추가
            
            console.log(`📋 [${sheet.sheetName}] policies 배열:`, JSON.stringify(policies));
            console.log(`📋 [${sheet.sheetName}] policies 배열 길이:`, policies.length);
            console.log(`📋 [${sheet.sheetName}] validRows 길이:`, validRows.length);
          } else {
            console.log(`📋 [${sheet.sheetName}] 메타데이터에 정책 데이터 없음`);
          }
        } catch (metadataError) {
          console.log(`❌ [${sheet.sheetName}] 메타데이터 조회 실패:`, metadataError.message);
          
          // 메타데이터 조회 실패 시 액면예산 시트에서 계산 (기존 방식)
          console.log(`🔍 [${sheet.sheetName}] 액면예산 시트에서 계산 시작!`);
          
          // 액면예산 시트에서 해당 범위 가져오기
          const activationDataResponse = await sheets_api.spreadsheets.values.get({
            spreadsheetId: sheet.sheetId,
            range: '액면예산!A:AA' // A열부터 Z열까지 (26개 컬럼) - API 부하 감소
          });
          
          const activationData = activationDataResponse.data.values || [];
          console.log(`📊 [${sheet.sheetName}] 액면예산 데이터 로드: ${activationData.length}행`);
          
          if (activationData.length > 4) { // 헤더 4행 제외
            let totalRemainingBudget = 0;
            let totalSecuredBudget = 0;
            let totalUsedBudget = 0;
            
            // 액면예산 타입에 따른 컬럼 매핑
            const inputUserCol = budgetType === 'Ⅱ' ? 1 : 3; // B열 또는 D열
            
            // 메타데이터에서 생성자 정보 가져오기
            let creatorName = '';
            try {
              const creatorResponse = await sheets_api.spreadsheets.values.get({
                spreadsheetId: sheet.sheetId,
                range: `${sheet.sheetName}!O1:X2`
              });
              
              const creatorData = creatorResponse.data.values || [];
              if (creatorData.length >= 2 && creatorData[1].length >= 4) {
                creatorName = creatorData[1][3] || ''; // 생성자 이름 (R열)
                console.log(`🔍 [${sheet.sheetName}] 생성자: ${creatorName}`);
              }
            } catch (creatorError) {
              console.log(`❌ [${sheet.sheetName}] 생성자 정보 조회 실패:`, creatorError.message);
            }
            
            activationData.slice(4).forEach((row, index) => { // 5행부터 시작 (헤더 4행 제외)
              if (row.length >= (budgetType === 'Ⅱ' ? 11 : 14)) { // 충분한 열이 있는지 확인
                const inputUser = row[inputUserCol];
                
                // 생성자 매칭 (생성자가 설정된 경우에만)
                let isMatched = true;
                if (creatorName && inputUser && creatorName !== '미적용') {
                  isMatched = inputUser.includes(creatorName);
                }
                
                // 조건에 맞는 데이터만 합계
                if (isMatched) {
                  if (budgetType === 'Ⅱ') {
                    // 액면예산(Ⅱ): I열(잔액), J열(확보), K열(사용)
                    if (row[8] !== '' && row[8] !== undefined && row[8] !== null) {
                      const value = parseFloat(row[8]) || 0;
                      totalRemainingBudget += value;
                    }
                    if (row[9] !== '' && row[9] !== undefined && row[9] !== null) {
                      const value = parseFloat(row[9]) || 0;
                      totalSecuredBudget += value;
                    }
                    if (row[10] !== '' && row[10] !== undefined && row[10] !== null) {
                      const value = parseFloat(row[10]) || 0;
                      totalUsedBudget += value;
                    }
                  } else {
                    // 액면예산(Ⅰ): L열(잔액), M열(확보), N열(사용)
                    if (row[11] !== '' && row[11] !== undefined && row[11] !== null) {
                      const value = parseFloat(row[11]) || 0;
                      totalRemainingBudget += value;
                    }
                    if (row[12] !== '' && row[12] !== undefined && row[12] !== null) {
                      const value = parseFloat(row[12]) || 0;
                      totalSecuredBudget += value;
                    }
                    if (row[13] !== '' && row[13] !== undefined && row[13] !== null) {
                      const value = parseFloat(row[13]) || 0;
                      totalUsedBudget += value;
                    }
                  }
                }
              }
            });
            
            console.log(`📊 [${sheet.sheetName}] 액면예산 계산 완료: 잔액=${totalRemainingBudget}, 확보=${totalSecuredBudget}, 사용=${totalUsedBudget}`);
            
            summary.totalRemainingBudget = totalRemainingBudget;
            summary.totalSecuredBudget = totalSecuredBudget;
            summary.totalUsedBudget = totalUsedBudget;
            summary.itemCount = activationData.length - 4; // 헤더 4행 제외
          } else {
            console.log(`❌ [${sheet.sheetName}] 액면예산 데이터 부족: ${activationData.length}행`);
          }
        } 
        
        // 날짜 범위 설정
        if (sheet.dateRange.receiptStartDate) {
          summary.dateRange = `접수일 ${sheet.dateRange.receiptStartDate} ~ ${sheet.dateRange.receiptEndDate}<br/>개통일 ${sheet.dateRange.activationStartDate} ~ ${sheet.dateRange.activationEndDate}`;
          summary.applyReceiptDate = true;
        } else {
          summary.dateRange = `접수일 미설정~미설정<br/>개통일 ${sheet.dateRange.activationStartDate} ~ ${sheet.dateRange.activationEndDate}`;
        }
        
      } catch (dataError) {
        console.log(`[NEW-API] 시트 ${sheet.sheetName} 데이터 조회 실패:`, dataError.message);
      }
      
      return {
        id: sheet.sheetId,
        name: sheet.sheetName,
        createdAt: sheet.createdAt,
        createdBy: sheet.createdBy,
        month: sheet.targetMonth,
        summary,
        policies: summary.policies || [], // 정책별 데이터를 최상위 레벨에 추가
        uuid: sheet.uuid,
        userName: sheet.createdBy,
        creator: sheet.createdBy
      };
    }));
    
    console.log(`✅ [NEW-API] 사용자 시트 조회 완료: ${enrichedSheets.length}개`);
    res.json(enrichedSheets);
    
  } catch (error) {
    console.error('[NEW-API] 사용자별 시트 조회 오류:', error);
    res.status(500).json({ error: '사용자별 시트 조회 중 오류가 발생했습니다.' });
  }
});

// 사용자 시트 삭제 API (새로 추가)
app.delete('/api/budget/user-sheets-v2/:uuid', async (req, res) => {
  console.log('🗑️ [NEW-API] DELETE /api/budget/user-sheets-v2 호출됨!', req.params);
  try {
    const { uuid } = req.params;
    const { userId } = req.query; // 요청자 ID
    
    if (!userId) {
      return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
    }
    
    const result = await userSheetManager.deleteUserSheet(uuid, userId);
    
    console.log(`✅ [NEW-API] 시트 삭제 완료: ${result.deletedSheetName}`);
    res.json({ 
      message: '시트가 성공적으로 삭제되었습니다.',
      deletedSheetName: result.deletedSheetName 
    });
    
  } catch (error) {
    console.error('[NEW-API] 시트 삭제 오류:', error);
    res.status(500).json({ error: error.message || '시트 삭제 중 오류가 발생했습니다.' });
  }
});

// 기존 API (레거시)
app.get('/api/budget/user-sheets', async (req, res) => {
  try {
    const { userId, targetMonth, showAllUsers, budgetType } = req.query;
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 사용자별 시트 목록 조회 (예산_사용자시트관리 시트에서)
    const sheetsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_사용자시트관리!A:F', // 대상월 컬럼 추가
    });

    const rows = sheetsData.data.values || [];
    
    // 시트가 비어있거나 헤더가 없으면 헤더 생성
    if (rows.length === 0 || !rows[0] || rows[0][0] !== '사용자ID') {
      const headerRow = ['사용자ID', '시트ID', '시트명', '생성일시', '생성자', '대상월'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: '예산_사용자시트관리!A1:F1',
        valueInputOption: 'RAW',
        resource: {
          values: [headerRow]
        }
      });
      return res.json([]);
    }

    if (rows.length <= 1) {
      return res.json([]);
    }

    // 해당 사용자의 시트만 필터링하고 예산 데이터 요약 정보 추가
    const userSheets = [];
    
    for (const row of rows.slice(1)) {
      // showAllUsers가 true이면 모든 사용자의 시트를 반환, 아니면 해당 사용자의 시트만
      const shouldInclude = showAllUsers === 'true' 
        ? (!targetMonth || row[5] === targetMonth) // 모든 사용자 + 대상월 필터
        : (row[0] === userId && (!targetMonth || row[5] === targetMonth)); // 특정 사용자 + 대상월 필터
      
      if (shouldInclude) {
        const sheetId = row[1] || '';
        const sheetName = row[2] || '';
        
        // 예산 타입별 필터링 (budgetType 파라미터 기준)
        if (budgetType) {
          const requestedType = budgetType; // 'Ⅰ' 또는 'Ⅱ'
          const hasRequestedType = sheetName.includes(`(${requestedType})`);
          
          if (!hasRequestedType) {
            continue; // 요청된 예산 타입이 아닌 시트 제외
          }
        }
        
        // 소유권 기반 필터링
        const isTypeI = sheetName.includes('(Ⅰ)');
        const isTypeII = sheetName.includes('(Ⅱ)');
        const isOwnSheet = row[0] === userId;
        
        // 액면예산(Ⅰ): 모든 사용자 시트 표시 (필터링 없음)
        // 액면예산(Ⅱ): 본인의 시트만 표시
        if (isTypeII && !isOwnSheet) {
          continue; // 액면예산(Ⅱ)이면서 본인 시트가 아닌 경우 제외
        }
        const createdAt = row[3] || '';
        const createdBy = row[4] || '';
        const month = row[5] || '';
        
        // 각 시트의 예산 데이터 요약 정보 가져오기
        let summary = {
          totalSecuredBudget: 0,
          totalUsedBudget: 0,
          totalRemainingBudget: 0,
          itemCount: 0,
          lastUpdated: '',
          dateRange: '',
          applyReceiptDate: false
        };
        
        try {
          // 시트 이름에서 액면예산 타입 추출
          const budgetTypeMatch = sheetName.match(/액면_.*?\(([ⅠⅡ])\)/);
          const budgetType = budgetTypeMatch ? budgetTypeMatch[1] : 'Ⅰ';
          
          // 액면예산 타입에 따른 범위 결정
          let phoneklRange, inputUserCol, inputDateCol;
          if (budgetType === 'Ⅱ') {
            // 액면예산(Ⅱ): B열(입력자), C열(입력일시), I열(잔액), J열(확보), K열(사용)
            phoneklRange = '액면예산!B:K';
            inputUserCol = 0; // B열 (첫 번째 컬럼)
            inputDateCol = 1; // C열 (두 번째 컬럼)
          } else {
            // 액면예산(Ⅰ): D열(입력자), E열(입력일시), L열(잔액), M열(확보), N열(사용)
            phoneklRange = '액면예산!D:N';
            inputUserCol = 0; // D열 (첫 번째 컬럼)
            inputDateCol = 1; // E열 (두 번째 컬럼)
          }
          
          // 액면예산에서 해당 범위 가져오기
          const activationDataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: phoneklRange
          });
          
          const activationData = activationDataResponse.data.values || [];
          
          // 자가업자 정보 추출 (시트 이름에서) - 괄호와 공백 제거
          const ownerMatch = sheetName.match(/액면_(.+?)\(/);
          const ownerName = ownerMatch ? ownerMatch[1].replace(/\([^)]+\)/g, '').trim() : '';
          
          // 마지막수정일시 가져오기 (메타데이터에서)
          let lastModifiedDate = '';
          try {
            const metadataResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${sheetName}!O1:X2`
            });
            
            const metadata = metadataResponse.data.values || [];
            if (metadata.length >= 2 && metadata[1].length >= 2) {
              const rawDate = metadata[1][1] || ''; // 마지막수정일시
              
              // 한국 시간 형식을 서버 시간 형식으로 변환
              if (rawDate && rawDate.includes('오후')) {
                // "2025. 8. 28. 오후 11:48:16" → "2025-08-28 23:48:16"
                const match = rawDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})/);
                if (match) {
                  const [, year, month, day, ampm, hour, minute, second] = match;
                  let adjustedHour = parseInt(hour);
                  
                  // 오후인 경우 12를 더함 (단, 12시는 제외)
                  if (ampm === '오후' && hour !== '12') {
                    adjustedHour += 12;
                  }
                  // 오전 12시는 0시로 변환
                  if (ampm === '오전' && hour === '12') {
                    adjustedHour = 0;
                  }
                  
                  lastModifiedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${adjustedHour.toString().padStart(2, '0')}:${minute}:${second}`;
                } else {
                  lastModifiedDate = rawDate; // 변환 실패시 원본 사용
                }
              } else {
                lastModifiedDate = rawDate; // 이미 서버 형식이거나 다른 형식
              }
            }
          } catch (metadataError) {
            console.log('메타데이터 조회 실패:', metadataError.message);
          }
          
          console.log(`🔍 [${sheetName}] 조건 매칭: 자가업자=${ownerName}, 마지막수정일시=${lastModifiedDate}`);
          
          // 조건부 합계 계산 - 날짜 범위와 생성한 저장값에 맞는 금액만 합산
          let totalRemainingBudget = 0;
          let totalSecuredBudget = 0;
          let totalUsedBudget = 0;
          
          // 메타데이터에서 날짜 범위와 생성자 정보 가져오기
          let receiptStartDate = '';
          let receiptEndDate = '';
          let activationStartDate = '';
          let activationEndDate = '';
          let creatorName = '';
          
          console.log(`🔍 [${sheetName}] 메타데이터 조회 시작: O1:X2`);
          
          try {
            const metadataResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${sheetName}!O1:X2`
            });
            
            const metadata = metadataResponse.data.values || [];
            console.log(`🔍 [${sheetName}] 메타데이터 원본:`, JSON.stringify(metadata));
            
            if (metadata.length >= 2 && metadata[1].length >= 4) {
              const receiptRange = metadata[1][1] || ''; // 접수일 범위
              const activationRange = metadata[1][2] || ''; // 개통일 범위
              creatorName = metadata[1][0] || ''; // 생성자 이름
              
              console.log(`🔍 [${sheetName}] 파싱 전: receiptRange="${receiptRange}", activationRange="${activationRange}", creatorName="${creatorName}"`);
              
              // 접수일 범위 파싱 (예: "2025.08.01~2025.08.31")
              if (receiptRange && receiptRange.includes('~')) {
                const [start, end] = receiptRange.split('~');
                receiptStartDate = start.trim();
                receiptEndDate = end.trim();
              }
              
              // 개통일 범위 파싱 (예: "2025.08.01~2025.08.31")
              if (activationRange && activationRange.includes('~')) {
                const [start, end] = activationRange.split('~');
                activationStartDate = start.trim();
                activationEndDate = end.trim();
              }
            } else {
              console.log(`❌ [${sheetName}] 메타데이터 형식 오류: length=${metadata.length}, row1.length=${metadata[1]?.length}`);
            }
          } catch (metadataError) {
            console.log(`❌ [${sheetName}] 메타데이터 조회 실패:`, metadataError.message);
          }
          
          console.log(`📅 [${sheetName}] 파싱 후 조건: 생성자="${creatorName}", 접수일="${receiptStartDate}~${receiptEndDate}", 개통일="${activationStartDate}~${activationEndDate}"`);
          
          activationData.slice(4).forEach((row, index) => { // 5행부터 시작 (헤더 4행 제외)
            if (row.length >= (budgetType === 'Ⅱ' ? 11 : 14)) { // 충분한 열이 있는지 확인
              const inputUser = row[inputUserCol];
              const inputDate = row[inputDateCol];
              
              // 조건 매칭 체크
              let isMatched = true;
              let matchReason = [];
              
              console.log(`🔍 [${sheetName}] Row ${index + 5} 매칭 체크: inputUser="${inputUser}", inputDate="${inputDate}"`);
              
              // 1. 생성자 매칭 (생성자가 설정된 경우에만)
              if (creatorName && inputUser) {
                const creatorMatch = inputUser.includes(creatorName);
                isMatched = isMatched && creatorMatch;
                matchReason.push(`생성자: ${creatorMatch ? '성공' : '실패'} (${inputUser} vs ${creatorName})`);
              } else {
                matchReason.push(`생성자: 조건없음`);
              }
              
              // 2. 날짜 범위 매칭 (범위가 설정된 경우에만)
              if (inputDate) {
                const inputDateStr = inputDate.toString().trim();
                
                // 접수일 범위 체크
                if (receiptStartDate && receiptEndDate) {
                  const receiptMatch = (inputDateStr >= receiptStartDate && inputDateStr <= receiptEndDate);
                  isMatched = isMatched && receiptMatch;
                  matchReason.push(`접수일: ${receiptMatch ? '성공' : '실패'} (${inputDateStr} vs ${receiptStartDate}~${receiptEndDate})`);
                } else {
                  matchReason.push(`접수일: 조건없음`);
                }
                
                // 개통일 범위 체크
                if (activationStartDate && activationEndDate) {
                  const activationMatch = (inputDateStr >= activationStartDate && inputDateStr <= activationEndDate);
                  isMatched = isMatched && activationMatch;
                  matchReason.push(`개통일: ${activationMatch ? '성공' : '실패'} (${inputDateStr} vs ${activationStartDate}~${activationEndDate})`);
                } else {
                  matchReason.push(`개통일: 조건없음`);
                }
              } else {
                matchReason.push(`입력일: 데이터없음`);
              }
              
              console.log(`🔍 [${sheetName}] Row ${index + 5} 매칭 결과: ${isMatched ? '성공' : '실패'} - ${matchReason.join(', ')}`);
              
              // 조건에 맞는 데이터만 합계
              if (isMatched) {
                if (budgetType === 'Ⅱ') {
                  // 액면예산(Ⅱ): I열(잔액), J열(확보), K열(사용)
                  if (row[8] !== '' && row[8] !== undefined && row[8] !== null) {
                    const value = parseFloat(row[8]) || 0;
                totalRemainingBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(Ⅱ): I열=${row[8]} → 잔액 누적=${totalRemainingBudget}`);
              }
                  if (row[9] !== '' && row[9] !== undefined && row[9] !== null) {
                    const value = parseFloat(row[9]) || 0;
                totalSecuredBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(Ⅱ): J열=${row[9]} → 확보 누적=${totalSecuredBudget}`);
              }
                  if (row[10] !== '' && row[10] !== undefined && row[10] !== null) {
                    const value = parseFloat(row[10]) || 0;
                totalUsedBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(Ⅱ): K열=${row[10]} → 사용 누적=${totalUsedBudget}`);
                  }
                } else if (budgetType === '종합') {
                  // 액면예산(종합): F열(잔액), G열(확보), H열(사용)
                  if (row[5] !== '' && row[5] !== undefined && row[5] !== null) {
                    const value = parseFloat(row[5]) || 0;
                    totalRemainingBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(종합): F열=${row[5]} → 잔액 누적=${totalRemainingBudget}`);
                  }
                  if (row[6] !== '' && row[6] !== undefined && row[6] !== null) {
                    const value = parseFloat(row[6]) || 0;
                    totalSecuredBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(종합): G열=${row[6]} → 확보 누적=${totalSecuredBudget}`);
                  }
                  if (row[7] !== '' && row[7] !== undefined && row[7] !== null) {
                    const value = parseFloat(row[7]) || 0;
                    totalUsedBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(종합): H열=${row[7]} → 사용 누적=${totalUsedBudget}`);
                  }
                } else {
                  // 액면예산(Ⅰ): L열(잔액), M열(확보), N열(사용)
                  if (row[11] !== '' && row[11] !== undefined && row[11] !== null) {
                    const value = parseFloat(row[11]) || 0;
                    totalRemainingBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(Ⅰ): L열=${row[11]} → 잔액 누적=${totalRemainingBudget}`);
                  }
                  if (row[12] !== '' && row[12] !== undefined && row[12] !== null) {
                    const value = parseFloat(row[12]) || 0;
                    totalSecuredBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(Ⅰ): M열=${row[12]} → 확보 누적=${totalSecuredBudget}`);
                  }
                  if (row[13] !== '' && row[13] !== undefined && row[13] !== null) {
                    const value = parseFloat(row[13]) || 0;
                    totalUsedBudget += value;
                    console.log(`💰 [${sheetName}] Row ${index + 5} 매칭성공(Ⅰ): N열=${row[13]} → 사용 누적=${totalUsedBudget}`);
                  }
                }
              } else {
                console.log(`❌ [${sheetName}] Row ${index + 5} 매칭실패 - ${matchReason.join(', ')}`);
              }
            }
          });
          
          console.log(`📊 [${sheetName}] 조건부 합계 완료: 잔액=${totalRemainingBudget}, 확보=${totalSecuredBudget}, 사용=${totalUsedBudget}`);
          
          console.log(`📊 [${sheetName}] 최종 합계: 예산잔액=${totalRemainingBudget}, 확보예산=${totalSecuredBudget}, 사용예산=${totalUsedBudget}`);
          
          // 원 단위 그대로 표시 (액면예산에서 직접 읽은 값)
          summary.totalRemainingBudget = totalRemainingBudget;
          summary.totalSecuredBudget = totalSecuredBudget;
          summary.totalUsedBudget = totalUsedBudget;
          
          console.log(`📋 [${sheetName}] 📋 저장된 데이터 목록 표시값: 확보예산=${totalSecuredBudget}, 사용예산=${totalUsedBudget}, 예산잔액=${totalRemainingBudget}`);
          
          // 메타데이터에서 마지막 업데이트 시간과 날짜 범위 가져오기 (O1:X2로 이동)
          try {
            const metadataResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${sheetName}!O1:X2`
            });
            
            const metadata = metadataResponse.data.values || [];
            if (metadata.length >= 2 && metadata[1].length >= 4) {
              summary.lastUpdated = metadata[1][0] || '';
              
              // 예산적용일 표시 개선
              const receiptRange = metadata[1][1] || ''; // 접수일 범위
              const activationRange = metadata[1][2] || ''; // 개통일 범위
              
              if (receiptRange === '미적용') {
                summary.dateRange = `접수일 미설정~미설정<br/>개통일 ${activationRange}`;
              } else {
                summary.dateRange = `접수일 ${receiptRange}<br/>개통일 ${activationRange}`;
              }
              
              summary.applyReceiptDate = metadata[1][3] === '적용'; // 접수일 적용 여부
            }
          } catch (metadataError) {
            console.log('메타데이터 조회 실패:', metadataError.message);
          }
          
        } catch (dataError) {
          console.log(`시트 ${sheetName} 데이터 조회 실패:`, dataError.message);
        }
        
        userSheets.push({
          id: sheetId,
          name: sheetName,
          createdAt,
          createdBy,
          month,
          summary
        });
      }
    }

    res.json(userSheets);
  } catch (error) {
    console.error('사용자별 시트 조회 오류:', error);
    res.status(500).json({ error: '사용자별 시트 조회 중 오류가 발생했습니다.' });
  }
});

// 새로운 사용자 시트 생성 API (UserSheetManager 사용)
app.post('/api/budget/user-sheets-v2', async (req, res) => {
  console.log('🚀 [NEW-API] POST /api/budget/user-sheets-v2 호출됨!', req.body);
  try {
    const { userId, userName, targetMonth, selectedPolicyGroups, budgetType, dateRange } = req.body;
    
    if (!userId || !userName || !targetMonth) {
      return res.status(400).json({ error: '사용자 ID, 이름, 대상월은 필수입니다.' });
    }

    // 1. 대상월의 시트 ID 조회
    const sheets = google.sheets({ version: 'v4', auth });
    const monthSheetsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_대상월관리!A:D',
    });

    const monthRows = monthSheetsData.data.values || [];
    const targetMonthRow = monthRows.find(row => row[0] === targetMonth);
    
    if (!targetMonthRow || !targetMonthRow[1]) {
      return res.status(400).json({ error: '해당 월의 시트 ID를 찾을 수 없습니다.' });
    }

    const targetSheetId = targetMonthRow[1];

    // 2. 사용자의 자격 정보 조회
    const baseUserName = userName.replace(/\([^)]+\)/, '').trim();
    let userQualification = '이사';
    
    try {
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      if (agentValues) {
        const agentRows = agentValues.slice(1);
        const userAgent = agentRows.find(row => row[0] === baseUserName);
        if (userAgent) {
          userQualification = userAgent[1] || '이사';
          console.log(`📋 [NEW-API] 사용자 자격 확인: ${baseUserName} → ${userQualification}`);
        }
      }
    } catch (error) {
      console.error('[NEW-API] 사용자 자격 정보 조회 실패:', error);
    }

    // 사용자명에서 괄호와 공백을 완전히 제거하여 시트명 생성
    const cleanUserName = baseUserName.replace(/\([^)]+\)/g, '').trim();
    const userSheetName = `액면_${cleanUserName}(${budgetType}) (${userQualification})`;
    console.log(`📝 [NEW-API] 시트명 생성: "${userSheetName}" (원본: "${baseUserName}")`);

    // 3. 사용자 시트 생성 (이미 존재하면 무시)
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: userSheetName,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 24
                }
              }
            }
          }]
        }
      });
      console.log(`✅ [NEW-API] 시트 "${userSheetName}" 생성 완료`);
    } catch (addSheetError) {
      if (addSheetError.code === 400 && addSheetError.message.includes('already exists')) {
        console.log(`📋 [NEW-API] 시트 "${userSheetName}" 이미 존재`);
      } else {
        throw addSheetError;
      }
    }

    // 4. 헤더 설정
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSheetId,
      range: `${userSheetName}!A1:I1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['적용일', '입력자(권한레벨)', '모델명', '군', '유형', '확보된 예산', '사용된 예산', '예산 잔액', '상태']]
      }
    });
    
    // 4-1. 메타데이터 헤더 설정 (O열~X열)
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSheetId,
      range: `${userSheetName}!O1:X1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['저장일시', '접수일범위', '개통일범위', '접수일적용여부', '계산일시', '계산자', '정책그룹', '잔액', '확보', '사용']]
      }
    });

    // 5. UserSheetManager를 사용하여 예산_사용자시트관리에 레코드 추가
    await userSheetManager.ensureSheetExists();
    
    const sheetData = {
      userId,
      targetSheetId,
      userSheetName,
      userName,
      targetMonth,
      selectedPolicyGroups,
      dateRange
    };

    const result = await userSheetManager.addUserSheet(sheetData);
    
    console.log(`✅ [NEW-API] 사용자 시트 레코드 추가 완료: UUID=${result.uuid}`);

    const newSheet = {
      id: targetSheetId,
      name: userSheetName,
      createdAt: result.createdAt,
      createdBy: userName,
      uuid: result.uuid
    };

    res.json({ 
      message: '사용자별 시트가 생성되었습니다.',
      sheet: newSheet
    });

  } catch (error) {
    console.error('[NEW-API] 사용자별 시트 생성 오류:', error);
    
    let errorMessage = '사용자별 시트 생성 중 오류가 발생했습니다.';
    if (error.code === 400) {
      if (error.message.includes('already exists')) {
        errorMessage = '시트가 이미 존재합니다.';
      } else if (error.message.includes('Invalid value')) {
        errorMessage = '잘못된 값이 입력되었습니다.';
      }
    } else if (error.code === 403) {
      errorMessage = 'Google Sheets 접근 권한이 없습니다.';
    } else if (error.code === 404) {
      errorMessage = '대상 시트를 찾을 수 없습니다.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// 기존 API (레거시)
app.post('/api/budget/user-sheets', async (req, res) => {
  console.log('🚀 [DEBUG] POST /api/budget/user-sheets 호출됨!', {
    userId: req.body.userId,
    userName: req.body.userName,
    targetMonth: req.body.targetMonth,
    budgetType: req.body.budgetType
  });
  try {
    const { userId, userName, targetMonth, selectedPolicyGroups, budgetType } = req.body;
    
    if (!userId || !userName || !targetMonth) {
      return res.status(400).json({ error: '사용자 ID, 이름, 대상월은 필수입니다.' });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const currentTime = new Date().toISOString();
    
    // 대상월의 시트 ID 조회
    const monthSheetsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_대상월관리!A:D',
    });

    const monthRows = monthSheetsData.data.values || [];
    const targetMonthRow = monthRows.find(row => row[0] === targetMonth);
    
    if (!targetMonthRow || !targetMonthRow[1]) {
      return res.status(400).json({ error: '해당 월의 시트 ID를 찾을 수 없습니다.' });
    }

    const targetSheetId = targetMonthRow[1];
    
    // userName에서 괄호 부분을 제거하고 실제 자격 정보를 대리점아이디관리에서 가져오기
    const baseUserName = userName.replace(/\([^)]+\)/, '').trim();
    
    // 사용자의 자격 정보를 대리점아이디관리에서 가져오기
    let userQualification = '이사'; // 기본값
    try {
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      if (agentValues) {
        const agentRows = agentValues.slice(1);
        const userAgent = agentRows.find(row => row[0] === baseUserName); // A열: 이름으로 검색
        if (userAgent) {
          userQualification = userAgent[1] || '이사'; // B열: 자격
          console.log(`📋 [시트생성] 사용자 자격 확인: ${baseUserName} → ${userQualification}`);
        } else {
          console.log(`⚠️ [시트생성] 대리점아이디관리에서 ${baseUserName} 정보를 찾을 수 없어 기본값 '이사' 사용`);
        }
      }
    } catch (error) {
      console.error('사용자 자격 정보 조회 실패:', error);
    }
    
    // 사용자명에서 괄호와 공백을 완전히 제거하여 시트명 생성
    const cleanUserName = baseUserName.replace(/\([^)]+\)/g, '').trim();
    const userSheetName = `액면_${cleanUserName}(${budgetType}) (${userQualification})`;
    console.log(`📝 [시트생성] 시트명 생성: "${userSheetName}" (원본: "${baseUserName}")`);
    
    // 기존 시트에 새로운 시트 추가
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: userSheetName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 24
                  }
                }
              }
            }
          ]
        }
      });
      console.log(`시트 "${userSheetName}"이 성공적으로 생성되었습니다.`);
    } catch (addSheetError) {
      // 시트가 이미 존재하는 경우 무시하고 계속 진행
      if (addSheetError.code === 400 && addSheetError.message.includes('already exists')) {
        console.log(`시트 "${userSheetName}"이 이미 존재합니다. 기존 시트를 사용합니다.`);
      } else {
        console.error('시트 생성 중 오류:', addSheetError);
        throw addSheetError;
      }
    }
    
    // 헤더 추가
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSheetId,
      range: `${userSheetName}!A1:I1`,
      valueInputOption: 'RAW',
      resource: {
        values: [['적용일', '입력자(권한레벨)', '모델명', '군', '유형', '확보된 예산', '사용된 예산', '예산 잔액', '상태']]
      }
    });

    // 예산_사용자시트관리 시트가 존재하는지 확인하고 없으면 생성
    await ensureUserSheetManagementExists(sheets);
    
    // 기존 사용자 시트가 있는지 확인 - 정확한 조건으로 수정
    console.log('🚨 [TRACE] 예산_사용자시트관리 읽기 시작:', new Date().toISOString());
    const existingSheetsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_사용자시트관리!A:G',
    });
    console.log('🚨 [TRACE] 예산_사용자시트관리 읽기 완료:', new Date().toISOString());
    
    const existingRows = existingSheetsData.data.values || [];
    // 동일한 사용자ID, 시트ID, 시트명, 대상월이 일치하는 기존 시트는 절대 덮어쓰지 않음
    // 모든 저장은 새로운 행으로 추가 (고유성은 생성일시로 자동 보장)
    const existingSheet = null; // 항상 새로 추가하도록 수정
    
    console.log(`📋 [시트생성] 기존 데이터 분석:`);
    console.log(`  - 전체 행 수: ${existingRows.length}`);
    console.log(`  - 기존 데이터:`, existingRows);
    console.log(`📋 [시트생성] 기존 시트 검색: userId=${userId}, sheetId=${targetSheetId}, sheetName=${userSheetName}, createdAt=${currentTime}, month=${targetMonth}`);
    console.log(`📋 [시트생성] 기존 시트 발견: ${existingSheet ? 'YES' : 'NO'}`);
    
    // 기존 시트가 없을 때만 새로 추가
    if (!existingSheet) {
      try {
        // append 사용하되 상세한 응답 로깅
        console.log(`📋 [시트생성] append 실행 전 - 기존 행 수: ${existingRows.length}`);
        console.log(`📋 [시트생성] 추가할 데이터:`, [userId, targetSheetId, userSheetName, currentTime, userName, targetMonth, selectedPolicyGroups ? selectedPolicyGroups.join(',') : '']);
        
        console.log('🚨 [TRACE] 예산_사용자시트관리 append 시작:', new Date().toISOString());
        const appendResult = await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: '예산_사용자시트관리!A:G',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS', // 새 행 삽입 보장
          resource: {
            values: [[userId, targetSheetId, userSheetName, currentTime, userName, targetMonth, selectedPolicyGroups ? selectedPolicyGroups.join(',') : '']]
          }
        });
        console.log('🚨 [TRACE] 예산_사용자시트관리 append 완료:', new Date().toISOString());
        
        console.log(`📋 [시트생성] append 응답:`, JSON.stringify(appendResult.data, null, 2));
        
        // append 후 실제 데이터 다시 확인
        console.log('🚨 [TRACE] 예산_사용자시트관리 재확인 시작:', new Date().toISOString());
        const afterAppendData = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '예산_사용자시트관리!A:G',
        });
        console.log('🚨 [TRACE] 예산_사용자시트관리 재확인 완료:', new Date().toISOString());
        console.log(`📋 [시트생성] append 후 실제 데이터:`, afterAppendData.data.values);
        
        // 3초 후 다시 한 번 확인 (Google Sheets 내부 처리 확인)
        setTimeout(async () => {
          try {
            console.log('🚨 [TRACE] 예산_사용자시트관리 3초후 확인 시작:', new Date().toISOString());
            const finalCheck = await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: '예산_사용자시트관리!A:G',
            });
            console.log('🚨 [TRACE] 예산_사용자시트관리 3초후 확인 완료:', new Date().toISOString());
            console.log(`📋 [시트생성] 3초 후 최종 확인:`, finalCheck.data.values);
          } catch (error) {
            console.error('3초 후 확인 실패:', error);
          }
        }, 3000);
      } catch (appendError) {
        // 시트가 존재하지 않으면 새로 생성하고 데이터 추가
        console.log('예산_사용자시트관리 시트가 존재하지 않아 새로 생성합니다.');
        try {
          await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                  title: '예산_사용자시트관리',
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 10
                  }
                }
              }
            }
          ]
        }
      });
    } catch (batchUpdateError) {
      console.error('시트 생성 중 오류:', batchUpdateError);
      throw batchUpdateError;
    }
  }
  
  // 헤더와 데이터 추가
  const headerRow = ['사용자ID', '시트ID', '시트명', '생성일시', '생성자', '대상월', '선택된정책그룹'];
  const dataRow = [userId, targetSheetId, userSheetName, currentTime, userName, targetMonth, selectedPolicyGroups ? selectedPolicyGroups.join(',') : ''];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: '예산_사용자시트관리!A1:G2',
    valueInputOption: 'RAW',
    resource: {
      values: [headerRow, dataRow]
    }
  });
}

    const newSheet = {
      id: targetSheetId,
      name: userSheetName,
      createdAt: currentTime,
      createdBy: userName
    };

    res.json({ 
      message: '사용자별 시트가 생성되었습니다.',
      sheet: newSheet
    });
  } catch (error) {
    console.error('사용자별 시트 생성 오류:', error);
    
    // 더 구체적인 오류 메시지 제공
    let errorMessage = '사용자별 시트 생성 중 오류가 발생했습니다.';
    
    if (error.code === 400) {
      if (error.message.includes('already exists')) {
        errorMessage = '시트가 이미 존재합니다.';
      } else if (error.message.includes('Invalid value')) {
        errorMessage = '잘못된 값이 입력되었습니다.';
      }
    } else if (error.code === 403) {
      errorMessage = 'Google Sheets 접근 권한이 없습니다.';
    } else if (error.code === 404) {
      errorMessage = '대상 시트를 찾을 수 없습니다.';
    } else if (error.message.includes('timeout')) {
      errorMessage = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/budget/user-sheets/:sheetId/data', async (req, res) => {
  try {
    const { sheetId } = req.params;
    const { data, dateRange, userName, userLevel, budgetAmounts, budgetType } = req.body; // Added budgetAmounts, budgetType
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '저장할 데이터가 없습니다.' });
    }

    if (!userName) {
      return res.status(400).json({ error: '사용자 이름이 필요합니다.' });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const baseUserName = userName.replace(/\([^)]+\)/, '').trim();
    
    // 사용자의 자격 정보를 대리점아이디관리에서 가져오기
    let userQualification = '이사'; // 기본값
    try {
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      if (agentValues) {
        const agentRows = agentValues.slice(1);
        const userAgent = agentRows.find(row => row[0] === baseUserName); // A열: 이름으로 검색
        if (userAgent) {
          userQualification = userAgent[1] || '이사'; // B열: 자격
          console.log(`📋 [데이터저장] 사용자 자격 확인: ${baseUserName} → ${userQualification}`);
        } else {
          console.log(`⚠️ [데이터저장] 대리점아이디관리에서 ${baseUserName} 정보를 찾을 수 없어 기본값 '이사' 사용`);
        }
      }
    } catch (error) {
      console.error('사용자 자격 정보 조회 실패:', error);
    }
    
    const userSheetName = `액면_${baseUserName}(${budgetType || 'Ⅰ'}) (${userQualification})`;
    
    // 데이터를 사용자가 원하는 형식으로 변환
    // 각 모델별로 군/유형별 데이터를 개별 행으로 분리
    const rowsToSave = [];
    
    data.forEach(item => {
      if (item.modelName && item.expenditureValues) {
        // 18개 컬럼의 지출예산 값을 각각 개별 행으로 저장
        item.expenditureValues.forEach((expenditureValue, index) => {
          // 모델명이 있으면 모든 행을 저장 (값이 0이어도 포함)
          const armyType = getArmyType(index + 1);
          const categoryType = getCategoryType(index + 1);
          
          // 해당 군의 예산금액 가져오기 (예산타입에 따른 기본값 적용)
          const defaultAmount = budgetType === 'Ⅱ' ? 0 : 40000;
          const securedBudget = budgetAmounts?.[armyType] || defaultAmount;
          
          // 지출예산을 1만원 단위에서 원 단위로 변환 (예: 2 -> 20000, -2 -> -20000)
          const usedBudget = expenditureValue * 10000; // Multiplied by 10000
          
          // 예산 잔액 계산
          const remainingBudget = securedBudget - usedBudget;
          
          rowsToSave.push([
            dateRange.receiptStartDate || '', // A열: 접수일 시작
            dateRange.receiptEndDate || '', // B열: 접수일 종료
            dateRange.activationStartDate || '', // C열: 개통일 시작
            dateRange.activationEndDate || '', // D열: 개통일 종료
            `${userName}(레벨${userLevel || 'SS'})`, // E열: 입력자(권한레벨)
            item.modelName, // F열: 모델명
            armyType, // G열: 군
            categoryType, // H열: 유형
            securedBudget, // I열: 확보된 예산 (원 단위)
            usedBudget, // J열: 사용된 예산 (원 단위)
            remainingBudget, // K열: 예산 잔액 (원 단위)
            '정상' // L열: 상태
          ]);
        });
      }
    });

    // 헤더 업데이트 (새로운 12개 컬럼 구조)
    const headerRow = [
      '접수시작일', '접수종료일', '개통시작일', '개통종료일', 
      '입력자(권한레벨)', '모델명', '군', '유형', 
      '확보된 예산', '사용된 예산', '예산 잔액', '상태'
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${userSheetName}!A1:L1`,
      valueInputOption: 'RAW',
      resource: {
        values: [headerRow]
      }
    });

    // 기존 데이터 유지하고 새 데이터 누적 저장 (append 방식)
    let existingData = [];
    try {
      const existingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${userSheetName}!A:L`
      });
      existingData = existingResponse.data.values || [];
    } catch (error) {
      console.log(`📋 [데이터저장] ${userSheetName}: 기존 데이터 없음, 새로 생성`);
    }

    // 새 데이터를 기존 데이터 아래에 추가 (append 방식)
    if (rowsToSave.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${userSheetName}!A:L`,
        valueInputOption: 'RAW',
        // insertDataOption 제거로 빈 행 생성 방지
        resource: {
          values: rowsToSave
        }
      });
    }

    // 메타데이터 누적 저장 (O열~X열)
    let existingMetadata = [];
    try {
      const metadataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${userSheetName}!O:X`
      });
      existingMetadata = metadataResponse.data.values || [];
    } catch (error) {
      console.log(`📋 [데이터저장] ${userSheetName}: 기존 메타데이터 없음, 새로 생성`);
    }

    // 헤더가 없으면 헤더 추가
    if (existingMetadata.length === 0) {
      // 헤더 추가 전 기존 시트 컬럼 확장 확인 및 확장 (X열까지)
      try {
        const sheetInfo = await sheets.spreadsheets.get({
          spreadsheetId: sheetId
        });
        
        const targetSheet = sheetInfo.data.sheets.find(s => s.properties.title === userSheetName);
        if (targetSheet && targetSheet.properties.gridProperties.columnCount < 24) {
          console.log(`🔄 [데이터저장] ${userSheetName}: 컬럼 수 확장 필요 (현재: ${targetSheet.properties.gridProperties.columnCount}, 목표: 24)`);
          
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            resource: {
              requests: [{
                updateDimensionProperties: {
                  range: {
                    sheetId: targetSheet.properties.sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: 24
                  },
                  properties: {
                    pixelSize: 100
                  },
                  fields: 'pixelSize'
                }
              }]
            }
          });
          
          console.log(`✅ [데이터저장] ${userSheetName}: 컬럼 수 확장 완료 (24개)`);
        }
      } catch (expandError) {
        console.log(`⚠️ [데이터저장] ${userSheetName}: 컬럼 확장 실패 (무시하고 진행):`, expandError.message);
      }
      
      const metadataHeader = [
        '저장일시', '접수일범위', '개통일범위', '접수일적용여부', 
        '계산일시', '계산자', '정책그룹', '잔액', '확보', '사용'
      ];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${userSheetName}!O1:X1`,
        valueInputOption: 'RAW',
        resource: {
          values: [metadataHeader]
        }
      });
    }

    // 메타데이터 생성은 SAFE-UPDATE에서 처리하므로 여기서는 제거
    // 사용자시트 데이터만 저장하고, 메타데이터는 계산 완료 후 SAFE-UPDATE에서 생성
    console.log(`📝 [데이터저장] ${userSheetName}: 사용자시트 데이터 저장 완료, 메타데이터는 SAFE-UPDATE에서 처리`);

    // 데이터 저장 후 바로 계산 수행
    console.log(`📊 [데이터저장] ${userSheetName} 계산 시작`);
    
    // 액면예산에서 해당 범위 가져오기
    const activationDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: '액면예산!A:AA' // A열부터 Z열까지 (26개 컬럼) - API 부하 감소
    });
    
    const activationData = activationDataResponse.data.values || [];
    console.log(`📊 [데이터저장] 액면예산 데이터 로드: ${activationData.length}행`);
    
    // 계산 결과 초기화
    let totalRemainingBudget = 0;
    let totalSecuredBudget = 0;
    let totalUsedBudget = 0;
    
    if (activationData.length > 4) {
      // 메타데이터에서 날짜 범위와 생성자 정보 가져오기
      let receiptStartDate = '';
      let receiptEndDate = '';
      let activationStartDate = '';
      let activationEndDate = '';
      let creatorName = '';
      
      // 메타데이터 조회
      try {
        const metadataResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${userSheetName}!O1:X2`
        });
        
        const metadata = metadataResponse.data.values || [];
        if (metadata.length >= 2 && metadata[1].length >= 4) {
          const receiptRange = metadata[1][1] || ''; // 접수일 범위
          const activationRange = metadata[1][2] || ''; // 개통일 범위
          creatorName = metadata[1][3] || ''; // 생성자 이름 (R열)
          
          // 접수일 범위 파싱
          if (receiptRange && receiptRange.includes('~') && receiptRange !== '미적용') {
            const [start, end] = receiptRange.split('~');
            receiptStartDate = start.trim();
            receiptEndDate = end.trim();
          }
          
          // 개통일 범위 파싱
          if (activationRange && activationRange.includes('~') && activationRange !== '미적용') {
            const [start, end] = activationRange.split('~');
            activationStartDate = start.trim();
            activationEndDate = end.trim();
          }
        }
      } catch (metadataError) {
        console.log(`❌ [데이터저장] 메타데이터 조회 실패:`, metadataError.message);
      }
      
      console.log(`📅 [데이터저장] 조건: 생성자="${creatorName}", 접수일="${receiptStartDate}~${receiptEndDate}", 개통일="${activationStartDate}~${activationEndDate}"`);
      
      // 액면예산 타입에 따른 컬럼 매핑
      const inputUserCol = budgetType === 'Ⅱ' ? 1 : 3; // B열 또는 D열
      const inputDateCol = budgetType === 'Ⅱ' ? 2 : 4; // C열 또는 E열
      
      activationData.slice(4).forEach((row, index) => { // 5행부터 시작 (헤더 4행 제외)
        if (row.length >= (budgetType === 'Ⅱ' ? 11 : 14)) { // 충분한 열이 있는지 확인
          const inputUser = row[inputUserCol];
          const inputDate = row[inputDateCol];
          
          // 조건 매칭 체크
          let isMatched = true;
          
          // 1. 생성자 매칭 (생성자가 설정된 경우에만)
          if (creatorName && inputUser && creatorName !== '미적용') {
            const creatorMatch = inputUser.includes(creatorName);
            isMatched = isMatched && creatorMatch;
          }
          
          // 2. 날짜 범위 매칭 (범위가 설정된 경우에만)
          if (inputDate) {
            let inputDateStr = inputDate.toString().trim();
            
            // (Ⅰ) 접미사 제거
            if (inputDateStr.includes('(Ⅰ)')) {
              inputDateStr = inputDateStr.replace('(Ⅰ)', '').trim();
            }
            if (inputDateStr.includes('(Ⅱ)')) {
              inputDateStr = inputDateStr.replace('(Ⅱ)', '').trim();
            }
            
            // 접수일 범위 체크 (접수일이 설정된 경우에만)
            if (receiptStartDate && receiptEndDate && receiptStartDate !== '미적용') {
              const receiptMatch = (inputDateStr >= receiptStartDate && inputDateStr <= receiptEndDate);
              isMatched = isMatched && receiptMatch;
            }
            
            // 개통일 범위 체크 (개통일이 설정된 경우에만)
            if (activationStartDate && activationEndDate && activationStartDate !== '미적용') {
              const activationMatch = (inputDateStr >= activationStartDate && inputDateStr <= activationEndDate);
              isMatched = isMatched && activationMatch;
            }
          }
          
          // 조건에 맞는 데이터만 합계
          if (isMatched) {
            if (budgetType === 'Ⅱ') {
              // 액면예산(Ⅱ): I열(잔액), J열(확보), K열(사용)
              if (row[8] !== '' && row[8] !== undefined && row[8] !== null) {
                const value = parseFloat(row[8]) || 0;
                totalRemainingBudget += value;
              }
              if (row[9] !== '' && row[9] !== undefined && row[9] !== null) {
                const value = parseFloat(row[9]) || 0;
                totalSecuredBudget += value;
              }
              if (row[10] !== '' && row[10] !== undefined && row[10] !== null) {
                const value = parseFloat(row[10]) || 0;
                totalUsedBudget += value;
              }
            } else {
              // 액면예산(Ⅰ): L열(잔액), M열(확보), N열(사용)
              if (row[11] !== '' && row[11] !== undefined && row[11] !== null) {
                const value = parseFloat(row[11]) || 0;
                totalRemainingBudget += value;
              }
              if (row[12] !== '' && row[12] !== undefined && row[12] !== null) {
                const value = parseFloat(row[12]) || 0;
                totalSecuredBudget += value;
              }
              if (row[13] !== '' && row[13] !== undefined && row[13] !== null) {
                const value = parseFloat(row[13]) || 0;
                totalUsedBudget += value;
              }
            }
          }
        }
      });
      
      console.log(`📊 [데이터저장] ${userSheetName} 계산 완료: 잔액=${totalRemainingBudget}, 확보=${totalSecuredBudget}, 사용=${totalUsedBudget}`);
      
      // 계산 결과가 0이 아닌 경우에만 메타데이터 업데이트 (0값 정책 생성 방지)
      if (totalRemainingBudget > 0 || totalSecuredBudget > 0 || totalUsedBudget > 0) {
        try {
          const metadataUpdateResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${userSheetName}!O:X`
          });
          
          const metadata = metadataUpdateResponse.data.values || [];
          if (metadata.length > 1) { // 헤더 1행 + 데이터 1행 이상
            const lastRowIndex = metadata.length; // 마지막 행 인덱스
            
            // V열(잔액), W열(확보), X열(사용) 업데이트
            const updateRequests = [
              {
                range: `${userSheetName}!V${lastRowIndex}`,
                values: [[totalRemainingBudget]]
              },
              {
                range: `${userSheetName}!W${lastRowIndex}`,
                values: [[totalSecuredBudget]]
              },
              {
                range: `${userSheetName}!X${lastRowIndex}`,
                values: [[totalUsedBudget]]
              }
            ];
            
            await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: sheetId,
              resource: {
                valueInputOption: 'RAW',
                data: updateRequests
              }
            });
            
            console.log(`✅ [데이터저장] ${userSheetName}: 메타데이터 계산 결과 업데이트 완료 (잔액=${totalRemainingBudget}, 확보=${totalSecuredBudget}, 사용=${totalUsedBudget})`);
          }
        } catch (updateError) {
          console.error(`❌ [데이터저장] ${userSheetName}: 메타데이터 업데이트 실패:`, updateError.message);
        }
      } else {
        console.log(`⚠️ [데이터저장] ${userSheetName}: 계산 결과가 모두 0이므로 메타데이터 업데이트 건너뜀 (0값 정책 생성 방지)`);
      }
    }
    
    res.json({ 
      message: '예산 데이터가 저장되었습니다.',
      summary: {
        totalRemainingBudget,
        totalSecuredBudget,
        totalUsedBudget
      }
    });
  } catch (error) {
    console.error('예산 데이터 저장 오류:', error);
    res.status(500).json({ error: '예산 데이터 저장 중 오류가 발생했습니다.' });
  }
});

// 군별 타입 매핑 함수
function getArmyType(columnIndex) {
  const armyTypes = ['S군', 'S군', 'S군', 'A군', 'A군', 'A군', 'B군', 'B군', 'B군', 'C군', 'C군', 'C군', 'D군', 'D군', 'D군', 'E군', 'E군', 'E군'];
  return armyTypes[columnIndex - 1] || 'Unknown';
}

// 카테고리 타입 매핑 함수
function getCategoryType(columnIndex) {
  const categoryTypes = ['신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상'];
  return categoryTypes[columnIndex - 1] || 'Unknown';
}

// 액면예산 종합 계산 API
app.get('/api/budget/summary/:targetMonth', async (req, res) => {
  try {
    const { targetMonth } = req.params;
    const { userId } = req.query;
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(`🔍 [액면예산종합] 시작: ${targetMonth}, 사용자: ${userId}`);
    
    // userId → 사용자 이름 매핑 (대리점아이디관리 C열:연락처 → A열:이름)
    let targetUserName = '';
    try {
      const agentSheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: AGENT_SHEET_NAME + '!A:C'
      });
      const agentValues = agentSheetResponse.data.values || [];
      if (agentValues.length > 1) {
        const agentRows = agentValues.slice(1);
        const match = agentRows.find(row => row[2] === userId); // C열: 연락처(아이디)
        if (match) {
          targetUserName = (match[0] || '').trim(); // A열: 이름
        }
      }
    } catch (e) {
      console.log('⚠️ [액면예산종합] 사용자 이름 매핑 실패:', e.message);
    }
    // 정규화된 비교용 이름 (괄호 제거)
    const targetUserNameClean = targetUserName ? targetUserName.replace(/\([^)]*\)/g, '').trim() : '';
    
    // 예산_사용자시트관리에서 해당 월의 모든 시트 조회
    const userSheetManagementResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_사용자시트관리!A:G'
    });
    
    const userSheetManagementData = userSheetManagementResponse.data.values || [];
    if (userSheetManagementData.length <= 1) {
      return res.json({
        success: true,
        summary: {
          totalSecuredBudget: 0,
          totalUsedBudget: 0,
          totalRemainingBudget: 0,
          basicShoeAmount: 0
        }
      });
    }
    
    // 사용자별 예산 데이터 저장
    const userBudgets = {};
    
    // 중복 제거: 같은 sheetId는 한 번만 처리 (액면예산(종합)에서는 구글 시트 기준)
    const processedSheetIds = new Set();
    
    // 기본구두 데이터 수집을 위한 변수
    let totalBasicShoeAmount = 0;
    const processedBasicShoeSheets = new Set();
    
    // 헤더 제외하고 각 시트의 액면예산 시트에서 사용자별 타입별 컬럼 합계
    for (let i = 1; i < userSheetManagementData.length; i++) {
      const row = userSheetManagementData[i];
      if (row.length >= 6 && row[5] === targetMonth) { // F열: 대상월
        const sheetId = row[1]; // B열: 시트ID
        const sheetName = row[2]; // C열: 시트명
        
        // 이미 처리된 sheetId는 건너뛰기 (같은 구글 시트는 한 번만 처리)
        if (processedSheetIds.has(sheetId)) {
          console.log(`⚠️ [액면예산종합] ${sheetName} (${sheetId}) 이미 처리됨, 건너뛰기`);
          continue;
        }
        
        processedSheetIds.add(sheetId);
        console.log(`🔍 [액면예산종합] ${sheetName} 처리 시작`);
        
        // 기본구두 생성 목록 읽기 (한 번만)
        if (!processedBasicShoeSheets.has(sheetId)) {
          try {
            // "기본구두생성목록" 시트에서 사용자가 생성한 기본구두만 읽기
            const basicShoeCreationResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: '기본구두생성목록!A:E'
            });
            
            const basicShoeCreationData = basicShoeCreationResponse.data.values || [];
            if (basicShoeCreationData.length > 1) {
              const rows = basicShoeCreationData.slice(1); // 헤더 제외
              rows.forEach((creationRow) => {
                if (creationRow.length >= 4) {
                  const createdBy = creationRow[1] || ''; // B열: 사용자
                  const policyGroups = creationRow[2] || ''; // C열: 정책그룹
                  const amount = parseFloat((creationRow[3] || '').toString().replace(/,/g, '')) || 0; // D열: 금액
                  
                  // 해당 사용자가 생성한 기본구두만 합산
                  if (createdBy && amount > 0 && createdBy.includes(targetUserNameClean)) {
                    totalBasicShoeAmount += amount;
                    console.log(`👞 [액면예산종합] 사용자 생성 기본구두: ${createdBy} - ${amount.toLocaleString()}원`);
                  }
                }
              });
            }
            
            // 기존 "기본구두" 시트는 읽지 않음 (사용자가 생성한 기본구두만 계산)
            // 하위 호환성이 필요한 경우 아래 주석을 해제
            /*
            try {
              const basicShoeResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: '기본구두!A:L'
              });
              
              const basicShoeData = basicShoeResponse.data.values || [];
              if (basicShoeData.length > 1) {
                const rows = basicShoeData.slice(1);
                rows.forEach((basicRow) => {
                  if (basicRow.length >= 12) {
                    const policyGroup = basicRow[11] || ''; // L열(11번인덱스): 정책그룹
                    const amount = parseFloat((basicRow[10] || '').toString().replace(/,/g, '')) || 0; // K열(10번인덱스): 기본구두 금액
                    
                    if (policyGroup && amount > 0) {
                      totalBasicShoeAmount += amount;
                    }
                  }
                });
              }
            } catch (basicShoeError) {
              console.log(`⚠️ [액면예산종합] ${sheetName} 기존 기본구두 시트 조회 실패:`, basicShoeError.message);
            }
            */
            
            processedBasicShoeSheets.add(sheetId);
            console.log(`✅ [액면예산종합] ${sheetName} 기본구두 데이터 처리 완료: ${totalBasicShoeAmount.toLocaleString()}원`);
          } catch (error) {
            console.log(`⚠️ [액면예산종합] ${sheetName} 기본구두 생성 목록 조회 실패:`, error.message);
          }
        }
        
        try {
          // 액면예산 시트에서 데이터 가져오기
          const activationResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: '액면예산!A:AA' // A열부터 Z열까지 (26개 컬럼) - API 부하 감소
          });
          
          const activationData = activationResponse.data.values || [];
          console.log(`📊 [액면예산종합] 액면예산 데이터 로드: ${activationData.length}행`);
          
                      if (activationData.length > 4) { // 헤더 4행 제외
              // 시트에서 사용자가 포함된 모든 행을 찾아서 F/G/H 값 합산 (SUMIF 방식)
              for (let index = 0; index < activationData.slice(4).length; index++) {
                const row = activationData[index + 4]; // 5행부터 시작
                if (row.length >= 14 && targetUserNameClean) {
                  const inputUserB = row[1] || ''; // B열: 입력자
                  const inputUserD = row[3] || ''; // D열: 입력자
                  const cleanB = inputUserB ? inputUserB.replace(/\([^)]*\)/g, '').trim() : '';
                  const cleanD = inputUserD ? inputUserD.replace(/\([^)]*\)/g, '').trim() : '';
                  
                  // B열 또는 D열에 타겟 사용자가 포함되어 있는지 확인
                  const isMatched = (cleanB && cleanB.includes(targetUserNameClean)) || (cleanD && cleanD.includes(targetUserNameClean));
                  if (isMatched) {
                    // F/G/H 열에서 직접 합계 값 읽어오기 (SUMIF 방식)
                    const remainingValue = row[5] !== '' && row[5] !== undefined && row[5] !== null ? 
                      parseFloat(String(row[5]).replace(/,/g, '')) || 0 : 0;
                    const securedValue = row[6] !== '' && row[6] !== undefined && row[6] !== null ? 
                      parseFloat(String(row[6]).replace(/,/g, '')) || 0 : 0;
                    const usedValue = row[7] !== '' && row[7] !== undefined && row[7] !== null ? 
                      parseFloat(String(row[7]).replace(/,/g, '')) || 0 : 0;
                    
                    // 사용자 예산에 직접 추가 (시트별 개별 합계 없이)
                    const key = targetUserNameClean;
                    if (!userBudgets[key]) {
                      userBudgets[key] = { remainingBudget: 0, securedBudget: 0, usedBudget: 0 };
                    }
                    userBudgets[key].remainingBudget += remainingValue;
                    userBudgets[key].securedBudget += securedValue;
                    userBudgets[key].usedBudget += usedValue;
                    
                    console.log(`📊 [액면예산종합] 사용자 ${targetUserNameClean} 발견: F/G/H열=${remainingValue}/${securedValue}/${usedValue}`);
                  }
                }
              }
            }
        } catch (error) {
          console.log(`⚠️ [액면예산종합] ${sheetName} 액면예산 시트 조회 실패:`, error.message);
        }
      }
    }
    
    // 전체 합계 계산
    let totalSecuredBudget = 0;
    let totalUsedBudget = 0;
    let totalRemainingBudget = 0;
    
    Object.keys(userBudgets).forEach(user => {
      const budget = userBudgets[user];
      totalRemainingBudget += budget.remainingBudget;
      totalSecuredBudget += budget.securedBudget;
      totalUsedBudget += budget.usedBudget;
      
      console.log(`📊 [액면예산종합] 사용자 ${user}: 잔액=${budget.remainingBudget}, 확보=${budget.securedBudget}, 사용=${budget.usedBudget}`);
    });
    
    // 기본구두 금액을 최종 예산 잔액에서 차감
    const finalRemainingBudget = totalRemainingBudget - totalBasicShoeAmount;
    
    console.log(`📊 [액면예산종합] 전체 합계: 확보=${totalSecuredBudget}, 사용=${totalUsedBudget}, 잔액=${totalRemainingBudget}`);
    console.log(`👞 [액면예산종합] 기본구두 차감: ${totalBasicShoeAmount.toLocaleString()}원`);
    console.log(`🎯 [액면예산종합] 최종 예산 잔액: ${finalRemainingBudget.toLocaleString()}원`);
    
    res.json({
      success: true,
      summary: {
        totalSecuredBudget,
        totalUsedBudget,
        totalRemainingBudget: finalRemainingBudget, // 기본구두 차감된 최종 잔액
        originalRemainingBudget: totalRemainingBudget, // 기본구두 차감 전 원본 잔액
        basicShoeAmount: totalBasicShoeAmount,
        userBudgets // 사용자별 상세 데이터 추가
      }
    });
    
  } catch (error) {
    console.error('[액면예산종합] 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '액면예산 종합 계산 중 오류가 발생했습니다.' 
    });
  }
});

// 기본구두 생성 목록 저장 API
app.post('/api/budget/basic-shoe/save-creation-list', async (req, res) => {
  try {
    const { sheetId, policyGroups, totalAmount, userName } = req.body;
    
    if (!sheetId || !policyGroups || !Array.isArray(policyGroups)) {
      return res.status(400).json({ 
        success: false, 
        error: '시트 ID와 정책그룹 목록이 필요합니다.' 
      });
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // "기본구두생성목록" 시트가 없으면 생성
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: '기본구두생성목록!A:A'
      });
    } catch (error) {
      // 시트가 없으면 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: '기본구두생성목록',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10
                }
              }
            }
          }]
        }
      });
      
      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: '기본구두생성목합!A1',
        valueInputOption: 'RAW',
        resource: {
          values: [['생성일시', '사용자', '정책그룹', '금액', '비고']]
        }
      });
    }
    
    // 새 데이터 추가
    const currentTime = new Date().toISOString();
    const newRow = [
      currentTime,
      userName || '알 수 없음',
      policyGroups.join(', '),
      totalAmount,
      '사용자 생성'
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: '기본구두생성목록!A:E',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    console.log(`✅ [기본구두] 생성 목록 저장 완료: ${policyGroups.length}개 그룹, 총 ${totalAmount.toLocaleString()}원`);
    
    res.json({ 
      success: true, 
      message: '기본구두 생성 목록이 저장되었습니다.',
      savedData: {
        timestamp: currentTime,
        userName,
        policyGroups,
        totalAmount
      }
    });
    
  } catch (error) {
    console.error('❌ [기본구두] 생성 목록 저장 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '기본구두 생성 목록 저장 중 오류가 발생했습니다.' 
    });
  }
});

// 기본구두 생성 목록 조회 API
app.get('/api/budget/basic-shoe/creation-list', async (req, res) => {
  try {
    const { sheetId } = req.query;
    
    if (!sheetId) {
      return res.status(400).json({ 
        success: false, 
        error: '시트 ID가 필요합니다.' 
      });
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // "기본구두생성목록" 시트에서 데이터 읽기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: '기본구두생성목록!A:E'
    });
    
    const data = response.data.values || [];
    if (data.length <= 1) {
      return res.json({
        success: true,
        creationList: [],
        totalAmount: 0
      });
    }
    
    // 헤더 제외하고 데이터 처리
    const rows = data.slice(1);
    const creationList = [];
    let totalAmount = 0;
    
    rows.forEach((row, index) => {
      if (row.length >= 4) {
        const timestamp = row[0] || ''; // A열: 생성일시
        const userName = row[1] || ''; // B열: 사용자
        const policyGroups = row[2] || ''; // C열: 정책그룹
        const amount = parseFloat((row[3] || '').toString().replace(/,/g, '')) || 0; // D열: 금액
        const note = row[4] || ''; // E열: 비고
        
        if (amount > 0) {
          creationList.push({
            id: index,
            timestamp,
            userName,
            policyGroups,
            amount,
            note
          });
          totalAmount += amount;
        }
      }
    });
    
    console.log(`✅ [기본구두] 생성 목록 조회: 총 ${totalAmount.toLocaleString()}원, ${creationList.length}개 항목`);
    
    res.json({
      success: true,
      creationList,
      totalAmount
    });
    
  } catch (error) {
    console.error('❌ [기본구두] 생성 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '기본구두 생성 목록 조회 중 오류가 발생했습니다.' 
    });
  }
});

// 기본구두 데이터 조회 API
app.get('/api/budget/basic-shoe', async (req, res) => {
  try {
    const { sheetId, policyGroups } = req.query;
    
    if (!sheetId) {
      return res.status(400).json({ 
        success: false, 
        error: '시트 ID가 필요합니다.' 
      });
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // "기본구두" 시트에서 데이터 읽기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: '기본구두!A:L'
    });
    
    const data = response.data.values || [];
    if (data.length <= 1) {
      return res.json({
        success: true,
        basicShoeData: [],
        totalAmount: 0,
        policyGroupAmounts: {}
      });
    }
    
    // 헤더 제외하고 데이터 처리
    const rows = data.slice(1);
    const processedData = [];
    const policyGroupAmounts = {};
    let totalAmount = 0;
    
    // 정책그룹 필터링 (콤마로 구분된 문자열을 배열로 변환)
    const selectedPolicyGroups = policyGroups ? policyGroups.split(',') : [];
    
    rows.forEach((row, index) => {
      if (row.length >= 12) {
        const policyGroup = row[11] || ''; // L열(11번인덱스): 정책그룹
        const amount = parseFloat((row[10] || '').toString().replace(/,/g, '')) || 0; // K열(10번인덱스): 기본구두 금액
        
        // 선택된 정책그룹과 일치하는 경우만 처리
        if (policyGroup && amount > 0 && selectedPolicyGroups.includes(policyGroup)) {
          processedData.push({
            id: index,
            policyGroup,
            amount,
            row: row
          });
          
          // 정책그룹별 금액 합산
          if (!policyGroupAmounts[policyGroup]) {
            policyGroupAmounts[policyGroup] = 0;
          }
          policyGroupAmounts[policyGroup] += amount;
          totalAmount += amount;
        }
      }
    });
    
    console.log(`✅ [기본구두] API 응답: 총 ${totalAmount.toLocaleString()}원, ${Object.keys(policyGroupAmounts).length}개 그룹`);
    
    res.json({
      success: true,
      basicShoeData: processedData,
      totalAmount,
      policyGroupAmounts
    });
    
  } catch (error) {
    console.error('❌ [기본구두] API 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '기본구두 데이터 조회 중 오류가 발생했습니다.' 
    });
  }
});



// 예산 데이터 불러오기 API
app.get('/api/budget/user-sheets/:sheetId/data', async (req, res) => {
  try {
    const { sheetId } = req.params;
    const { userName, currentUserId, budgetType } = req.query;
    const sheets = google.sheets({ version: 'v4', auth });
    
      if (!userName) {
      return res.status(400).json({ error: '사용자 이름이 필요합니다.' });
    }
    
    // 현재 사용자의 권한 확인 (액면예산(Ⅰ)에서만 다른 사용자 데이터 조회 허용)
    let canAccessOtherUserData = false;
    let actualSheetOwner = userName; // 기본값: 요청된 사용자 이름
    
    if (currentUserId && budgetType === 'Ⅰ') {
      try {
        // 대리점아이디관리 시트에서 현재 사용자의 권한 레벨 확인
        const agentValues = await getSheetValues(AGENT_SHEET_NAME);
        if (agentValues) {
          const agentRows = agentValues.slice(1);
          const currentUserAgent = agentRows.find(row => row[2] === currentUserId); // C열: 연락처(아이디)
          
          if (currentUserAgent) {
            const userRole = currentUserAgent[15] || ''; // P열: 권한레벨
            console.log(`🔐 [예산데이터조회] 사용자 권한 확인: ${currentUserId} → 권한레벨: ${userRole}`);
            
            // SS, S, AA, BB, CC, DD, EE, FF 권한이 있는 경우 다른 사용자 데이터 조회 허용
            if (['SS', 'S', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
              canAccessOtherUserData = true;
              console.log(`✅ [예산데이터조회] 다른 사용자 데이터 조회 권한 있음: ${userRole}`);
              
              // 예산_사용자시트관리에서 실제 시트 소유자 확인
              console.log('🚨 [TRACE] [예산데이터조회] 예산_사용자시트관리 읽기 시작:', new Date().toISOString());
              const userSheetManagementResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: '예산_사용자시트관리!A:G'
              });
              console.log('🚨 [TRACE] [예산데이터조회] 예산_사용자시트관리 읽기 완료:', new Date().toISOString());
              
              const userSheetManagementData = userSheetManagementResponse.data.values || [];
              if (userSheetManagementData.length > 1) {
                // 헤더 제외하고 해당 시트 ID로 실제 소유자 찾기
                for (let i = 1; i < userSheetManagementData.length; i++) {
                  const row = userSheetManagementData[i];
                  if (row.length >= 6 && row[1] === sheetId) { // B열: 시트ID
                    actualSheetOwner = row[4] || userName; // E열: 생성자 (실제 소유자)
                    console.log(`📋 [예산데이터조회] 실제 시트 소유자 확인: ${actualSheetOwner} (시트ID: ${sheetId})`);
                    break;
                  }
                }
              }
            } else {
              console.log(`❌ [예산데이터조회] 권한 부족: ${userRole} (액면예산(Ⅰ) 다른 사용자 조회 권한 없음)`);
            }
          } else {
            console.log(`❌ [예산데이터조회] 사용자 정보 없음: ${currentUserId}`);
          }
        }
      } catch (error) {
        console.error('권한 확인 중 오류:', error);
        // 권한 확인 실패 시에도 기본 로직 진행 (자신의 데이터는 조회 가능)
      }
    }
    
    // 액면예산(Ⅱ)이거나 권한이 없는 경우, 요청자와 시트 소유자가 다르면 접근 거부
    if (budgetType === 'Ⅱ' || (!canAccessOtherUserData && actualSheetOwner !== userName)) {
      return res.status(403).json({ 
        error: '해당 데이터에 접근할 권한이 없습니다.',
        details: budgetType === 'Ⅱ' ? '액면예산(Ⅱ)는 본인 데이터만 조회 가능합니다.' : '권한이 부족합니다.'
      });
    }
    
    // 실제 시트 소유자의 자격 정보를 대리점아이디관리에서 가져오기
    let userQualification = '이사'; // 기본값
    try {
      // 대리점아이디관리 시트에서 소유자의 자격 정보 가져오기
      const agentSheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: AGENT_SHEET_NAME + '!A:B'
      });
      
      const agentValues = agentSheetResponse.data.values;
      if (agentValues && agentValues.length > 1) {
        const agentRows = agentValues.slice(1);
        // actualSheetOwner에서 이름만 추출 (예: "김기송 (영업사원)" → "김기송")
        const cleanOwnerName = actualSheetOwner.replace(/\([^)]+\)/, '').trim();
        const ownerAgent = agentRows.find(row => row[0] === cleanOwnerName); // A열: 대상(이름)으로 검색
        if (ownerAgent) {
          userQualification = ownerAgent[1] || '이사'; // B열: 자격
          console.log(`📋 [예산데이터조회] 시트 소유자 자격 확인: ${cleanOwnerName} → ${userQualification}`);
        } else {
          console.log(`⚠️ [예산데이터조회] 대리점아이디관리에서 ${cleanOwnerName} 정보를 찾을 수 없어 기본값 '이사' 사용`);
        }
      }
    } catch (error) {
      console.error('시트 소유자 자격 정보 조회 실패:', error);
    }
    
    // 실제 시트 소유자 이름을 사용하여 시트 이름 구성
    const baseUserName = actualSheetOwner.replace(/\([ⅠⅡ]\)/, '').replace(/\([^)]+\)/, '').trim();
    const requestedBudgetType = budgetType || 'Ⅰ'; // 요청된 예산 타입 사용
    
    const userSheetName = `액면_${baseUserName}(${requestedBudgetType}) (${userQualification})`;
    
    console.log(`📊 [예산데이터조회] 시트명 구성: ${userSheetName} (소유자: ${actualSheetOwner}, 타입: ${requestedBudgetType}, 자격: ${userQualification})`);
    
    // 데이터 불러오기 (A2:L) - 새로운 형식에 맞춰 12개 컬럼
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${userSheetName}!A2:L`
    });
    
    // 메타데이터 불러오기 (O1:X1) - 새로운 10개 컬럼 구조
    const metadataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${userSheetName}!O1:X1`
    });
    
    const data = dataResponse.data.values || [];
    const metadata = metadataResponse.data.values || [];
    
    // 데이터 파싱 - 새로운 형식에 맞춰 수정 (12개 컬럼)
    const parsedData = data.map((row, index) => {
      if (row.length >= 12) {
        const [receiptStartDate, receiptEndDate, activationStartDate, activationEndDate, inputUserInfo, modelName, armyType, categoryType, securedBudget, usedBudget, remainingBudget, status] = row;
        
        // 입력자 정보 파싱 (예: "홍길동(레벨3)" -> "홍길동", "3")
        const userMatch = inputUserInfo.match(/^(.+?)\(레벨(\d+)\)$/);
        const inputUser = userMatch ? userMatch[1] : inputUserInfo;
        const userLevel = userMatch ? parseInt(userMatch[2]) : 1;
        
        // 숫자 값 파싱 개선
        const parseBudgetValue = (value) => {
          if (!value || value === '') return 0;
          const parsed = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
          return isNaN(parsed) ? 0 : parsed;
        };

        // 디버깅을 위한 로그 추가
        console.log(`Row ${index + 2} parsing:`, {
          securedBudget: { original: securedBudget, parsed: parseBudgetValue(securedBudget) },
          usedBudget: { original: usedBudget, parsed: parseBudgetValue(usedBudget) },
          remainingBudget: { original: remainingBudget, parsed: parseBudgetValue(remainingBudget) }
        });

        return {
          id: `loaded-${index}`,
          receiptStartDate,
          receiptEndDate,
          activationStartDate,
          activationEndDate,
          inputUser,
          userLevel,
          modelName,
          armyType,
          categoryType,
          securedBudget: parseBudgetValue(securedBudget),
          usedBudget: parseBudgetValue(usedBudget),
          remainingBudget: parseBudgetValue(remainingBudget),
          status,
          budgetValue: parseBudgetValue(securedBudget) // 원본 예산 값
        };
      }
      return null;
    }).filter(item => item !== null);
    
    // 메타데이터 파싱 - 새로운 10개 컬럼 구조
    let dateRange = {
      receiptStartDate: '',
      receiptEndDate: '',
      activationStartDate: '',
      activationEndDate: ''
    };
    
    if (metadata.length >= 2 && metadata[1].length >= 10) {
      // 새로운 메타데이터 구조: [저장일시, 접수일범위, 개통일범위, 접수일적용여부, 계산일시, 계산자, 정책그룹, 잔액, 확보, 사용]
      const receiptRange = metadata[1][1] || ''; // P열: 접수일범위
      const activationRange = metadata[1][2] || ''; // Q열: 개통일범위
      const applyReceiptDate = metadata[1][3] || ''; // R열: 접수일적용여부
      const calculationDate = metadata[1][4] || ''; // S열: 계산일시
      const calculator = metadata[1][5] || ''; // T열: 계산자
      const policyGroups = metadata[1][6] || ''; // U열: 정책그룹
      const totalRemaining = metadata[1][7] || ''; // V열: 잔액
      const totalSecured = metadata[1][8] || ''; // W열: 확보
      const totalUsed = metadata[1][9] || ''; // X열: 사용
      
      // "2024-01-01 ~ 2024-01-31" 형식 파싱
      const receiptMatch = receiptRange.match(/^(.+?)\s*~\s*(.+)$/);
      const activationMatch = activationRange.match(/^(.+?)\s*~\s*(.+)$/);
      
      if (receiptMatch) {
        dateRange.receiptStartDate = receiptMatch[1].trim();
        dateRange.receiptEndDate = receiptMatch[2].trim();
      }
      
      if (activationMatch) {
        dateRange.activationStartDate = activationMatch[1].trim();
        dateRange.activationEndDate = activationMatch[2].trim();
      }
      
      console.log(`📋 [메타데이터파싱] 새로운 구조: 접수일=${receiptRange}, 개통일=${activationRange}, 적용여부=${applyReceiptDate}, 계산자=${calculator}, 정책그룹=${policyGroups}`);
    }
    
    // 정책그룹 정보 가져오기 - "예산_사용자시트관리" 시트에서
    let selectedPolicyGroups = [];
    try {
      // 위에서 이미 가져온 userSheetManagementData가 있으면 재사용
      let userSheetManagementData = [];
      if (canAccessOtherUserData) {
        // 이미 권한 확인 시 가져온 데이터 재사용
      console.log('🚨 [TRACE] [정책그룹조회1] 예산_사용자시트관리 읽기 시작:', new Date().toISOString());
      const userSheetManagementResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '예산_사용자시트관리!A:G'
      });
      console.log('🚨 [TRACE] [정책그룹조회1] 예산_사용자시트관리 읽기 완료:', new Date().toISOString());
        userSheetManagementData = userSheetManagementResponse.data.values || [];
      } else {
        console.log('🚨 [TRACE] [정책그룹조회2] 예산_사용자시트관리 읽기 시작:', new Date().toISOString());
        const userSheetManagementResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '예산_사용자시트관리!A:G'
        });
        console.log('🚨 [TRACE] [정책그룹조회2] 예산_사용자시트관리 읽기 완료:', new Date().toISOString());
        userSheetManagementData = userSheetManagementResponse.data.values || [];
      }
      
      if (userSheetManagementData.length > 1) {
        // 헤더 제외하고 데이터 검색 - 시트 ID로 찾기
        for (let i = 1; i < userSheetManagementData.length; i++) {
          const row = userSheetManagementData[i];
          if (row.length >= 7 && row[1] === sheetId) { // B열: 시트ID로 검색
            // G열에 정책그룹 정보가 저장되어 있음
            const policyGroupsStr = row[6] || '';
            if (policyGroupsStr) {
              selectedPolicyGroups = policyGroupsStr.split(',').map(group => group.trim()).filter(group => group);
            }
            console.log(`📋 [예산데이터조회] 정책그룹 정보 로드: ${selectedPolicyGroups.join(', ')}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('정책그룹 정보 불러오기 실패:', error);
      // 정책그룹 정보 불러오기 실패는 전체 API 실패로 처리하지 않음
    }
    
    // 다른 사용자 데이터 조회 시 로그 기록
    if (canAccessOtherUserData && actualSheetOwner !== userName) {
      console.log(`📊 [접근로그] ${currentUserId}님이 ${actualSheetOwner}님의 예산 데이터를 조회했습니다. (시트ID: ${sheetId}, 타입: ${requestedBudgetType})`);
    }
    
    res.json({ 
      data: parsedData, 
      dateRange,
      selectedPolicyGroups,
      metadata: metadata.length >= 2 ? metadata[1] : [],
      accessInfo: {
        originalRequester: userName,
        actualDataOwner: actualSheetOwner,
        accessedBy: currentUserId,
        isAccessedByOtherUser: canAccessOtherUserData && actualSheetOwner !== userName
      }
    });
  } catch (error) {
    console.error('예산 데이터 불러오기 실패:', error);
    res.status(500).json({ error: '예산 데이터 불러오기에 실패했습니다.' });
  }
});

// 정책 알림 생성 함수
async function createPolicyNotification(policyId, userId, notificationType, approvalStatus = null) {
  try {
    const notificationId = `NOTI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notificationRow = [
      notificationId,           // A열: 알림ID
      policyId,                 // B열: 정책ID
      notificationType,         // C열: 알림유형
      userId,                   // D열: 대상자ID
      '읽지않음',               // E열: 읽음상태
      new Date().toISOString()  // F열: 생성일시
    ];
    
    // 시트에 데이터가 있는지 확인
    const existingNotificationData = await getSheetValuesWithoutCache('정책_알림관리');
    
    // 헤더 정의
    const notificationHeaderRow = [
      '알림ID',           // A열
      '정책ID',           // B열
      '알림유형',         // C열
      '대상자ID',         // D열
      '읽음상태',         // E열
      '생성일시'          // F열
    ];
    
    // 시트가 비어있거나 헤더가 없으면 헤더와 함께 데이터 추가
    if (!existingNotificationData || existingNotificationData.length === 0 || 
        !existingNotificationData[0] || existingNotificationData[0][0] !== '알림ID') {
      console.log('📝 [알림관리] 시트가 비어있거나 헤더가 없어 헤더와 함께 데이터 추가');
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_알림관리!A:F',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [notificationHeaderRow, notificationRow]
        }
      });
    } else {
      // 기존 데이터가 있으면 알림만 추가
      console.log('📝 [알림관리] 기존 데이터에 알림 추가');
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '정책_알림관리!A:F',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [notificationRow]
        }
      });
    }
    
    console.log('정책 알림 생성 완료:', notificationId);
  } catch (error) {
    console.error('정책 알림 생성 실패:', error);
  }
}

// ========================================
// 마감장표 API
// ========================================

// 마감장표 데이터 조회 API
app.get('/api/closing-chart', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`마감장표 데이터 조회 시작: ${targetDate}`);
    
    // 폰클개통데이터 캐시 무효화 (BZ열 데이터 포함하도록)
    invalidatePhoneklActivationCache();
    
    // 캐시 키 생성
    const cacheKey = `closing_chart_${targetDate}`;
    
    // 캐시 확인
    if (cache.has(cacheKey)) {
      console.log('캐시된 마감장표 데이터 반환');
      return res.json(cache.get(cacheKey));
    }
    
    // 필요한 시트 데이터 로드 (병렬 처리)
    const [
      phoneklData,
      storeData,
      inventoryData,
      operationModelData,
      customerData,
      salesTargetData,
      phoneklHomeData
    ] = await Promise.all([
      getSheetValues('폰클개통데이터'),
      getSheetValues('폰클출고처데이터'),
      getSheetValues('폰클재고데이터'),
      getSheetValues('운영모델'),
      getSheetValues('거래처정보'),
      getSheetValues('영업사원목표'),
      getSheetValues('폰클홈데이터')
    ]);
    
    // 제외 조건 설정
    const excludedAgents = getExcludedAgents(salesTargetData);
    const excludedStores = getExcludedStores(inventoryData);
    
    // 데이터 처리
    const processedData = processClosingChartData({
      phoneklData,
      storeData,
      inventoryData,
      operationModelData,
      customerData,
      salesTargetData,
      phoneklHomeData,
      targetDate,
      excludedAgents,
      excludedStores
    });
    
    // 캐시 저장 (1분으로 단축 - 빠른 업데이트를 위해)
    cache.set(cacheKey, processedData, 60);
    
    console.log('마감장표 데이터 처리 완료');
    res.json(processedData);
    
  } catch (error) {
    console.error('마감장표 데이터 조회 오류:', error);
    res.status(500).json({ error: '마감장표 데이터 조회 중 오류가 발생했습니다.' });
  }
});

// 제외된 담당자 목록 조회
function getExcludedAgents(salesTargetData) {
  if (!salesTargetData || salesTargetData.length < 2) return [];
  
  const excluded = [];
  for (let i = 1; i < salesTargetData.length; i++) {
    const row = salesTargetData[i];
    if (row.length > 2 && row[2] === 'Y') { // C열: 제외여부
      excluded.push(row[0]); // A열: 담당자명
    }
  }
  return excluded;
}

// 제외된 출고처 목록 조회
function getExcludedStores(inventoryData) {
  if (!inventoryData || inventoryData.length < 7) return [];
  
  const excluded = [];
  for (let i = 6; i < inventoryData.length; i++) { // E7:E부터 시작
    const row = inventoryData[i];
    if (row.length > 4) {
      const storeName = (row[4] || '').toString(); // E열
      if (storeName.includes('사무실') || storeName.includes('거래종료') || storeName.includes('본점판매')) {
        excluded.push(storeName);
      }
    }
  }
  return excluded;
}

// 마감장표 데이터 처리
function processClosingChartData({ phoneklData, storeData, inventoryData, operationModelData, customerData, salesTargetData, phoneklHomeData, targetDate, excludedAgents, excludedStores }) {
  // 운영모델 필터링 (휴대폰만)
  const phoneModels = new Set();
  
  if (operationModelData && operationModelData.length > 0) {
    operationModelData.forEach((row, index) => {
      if (row.length > 0) {
        const category = (row[0] || '').toString(); // A열: 구분 (휴대폰/워치/TAB)
        const modelName = (row[2] || '').toString(); // C열: 모델명
        
        if (category === '휴대폰' && modelName) {
          phoneModels.add(modelName);
        }
      }
    });
  }
  
  // 개통 데이터 필터링
  const dataRows = phoneklData.slice(3); // 헤더 제외
  console.log('🔍 [CS 디버깅] 원본 데이터 행 수:', dataRows.length);
  
  let filteredCount = 0;
  let lengthFilteredCount = 0;
  let dateFilteredCount = 0;
  let modelFilteredCount = 0;
  let planFilteredCount = 0;
  let conditionFilteredCount = 0;
  let typeFilteredCount = 0;
  
  const filteredPhoneklData = dataRows.filter(row => {
    if (row.length < 10) {
      lengthFilteredCount++;
      return false;
    }
    
    const activationDate = (row[9] || '').toString(); // J열: 개통일
    const model = (row[21] || '').toString(); // V열: 모델명
    const planType = (row[19] || '').toString(); // T열: 요금제
    const condition = (row[12] || '').toString(); // M열: 상태
    const type = (row[16] || '').toString(); // Q열: 유형
    
    // 날짜 필터링
    const targetDateObj = new Date(targetDate);
    const activationDateObj = new Date(activationDate);
    if (isNaN(activationDateObj.getTime()) || activationDateObj > targetDateObj) {
      dateFilteredCount++;
      return false;
    }
    
    // 모델 필터링 (휴대폰만)
    if (!phoneModels.has(model)) {
      modelFilteredCount++;
      return false;
    }
    
    // 제외 조건
    if (planType.includes('선불')) {
      planFilteredCount++;
      return false;
    }
    if (condition.includes('중고')) {
      conditionFilteredCount++;
      return false;
    }
    if (type.includes('중고') || type.includes('유심')) {
      typeFilteredCount++;
      return false;
    }
    
    filteredCount++;
    return true;
  });
  
  console.log('🔍 [CS 디버깅] 필터링 결과:');
  console.log('🔍 [CS 디버깅] - 원본 행 수:', dataRows.length);
  console.log('🔍 [CS 디버깅] - 필터링된 행 수:', filteredPhoneklData.length);
  console.log('🔍 [CS 디버깅] - 행 길이 부족으로 제외:', lengthFilteredCount);
  console.log('🔍 [CS 디버깅] - 날짜 조건으로 제외:', dateFilteredCount);
  console.log('🔍 [CS 디버깅] - 모델 조건으로 제외:', modelFilteredCount);
  console.log('🔍 [CS 디버깅] - 요금제 조건으로 제외:', planFilteredCount);
  console.log('🔍 [CS 디버깅] - 상태 조건으로 제외:', conditionFilteredCount);
  console.log('🔍 [CS 디버깅] - 유형 조건으로 제외:', typeFilteredCount);
  
  // 지원금 계산
  const supportBonusData = calculateSupportBonus(filteredPhoneklData, excludedAgents);
  
  // 통합 매칭 키 시스템으로 데이터 집계

  
  // 목표값 데이터 처리
  const targets = new Map();
  if (salesTargetData && salesTargetData.length > 1) {
    salesTargetData.slice(1).forEach(row => {
      const agent = row[0] || '';
      const code = row[1] || '';
      const target = parseInt(row[2]) || 0;
      const excluded = row[3] === 'Y';
      const key = `${agent}|${code}`;
      targets.set(key, { agent, code, target, excluded });
    });
  }
  
    // 통합 매칭 키 데이터 생성
  const { matchingKeyMap, matchingMismatches } = createUnifiedMatchingKeyData(filteredPhoneklData, storeData, inventoryData, excludedAgents, excludedStores, targets, customerData);
  
  // 각 집계별로 데이터 추출 (Map.values()로 배열 변환)
  const codeData = aggregateByCodeFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.codeSupportMap);
  const officeData = aggregateByOfficeFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.officeSupportMap);
  const departmentData = aggregateByDepartmentFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.departmentSupportMap);
  const agentData = aggregateByAgentFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.agentSupportMap);
  

  
    // CS 개통 요약
  const csSummary = calculateCSSummary(filteredPhoneklData, phoneklHomeData, targetDate, phoneModels, excludedAgents);
  
  // 매핑 실패 데이터
  const mappingFailures = findMappingFailures(filteredPhoneklData, storeData);
  

  
  return {
    date: targetDate,
    codeData,
    officeData,
    departmentData,
    agentData,
    csSummary,
    mappingFailures,
    excludedAgents,
    excludedStores,
    matchingMismatches // 매칭 불일치 데이터 추가
  };
}

// 통합 매칭 키 생성 함수
function createMatchingKey(row) {
  const agent = (row[8] || '').toString();        // I열: 담당자
  const department = (row[7] || '').toString();   // H열: 소속
  const office = (row[6] || '').toString();       // G열: 사무실
  const code = (row[4] || '').toString();         // E열: 코드명
  
  return `${agent}|${department}|${office}|${code}`;
}

// 통합 매칭 키 데이터 생성
function createUnifiedMatchingKeyData(phoneklData, storeData, inventoryData, excludedAgents, excludedStores, targets, customerData) {
  const matchingKeyMap = new Map();
  
  // 1단계: 개통 데이터로 기본 정보 생성
  phoneklData.forEach(row => {
    const agent = (row[8] || '').toString();
    if (excludedAgents.includes(agent)) return;
    
    const key = createMatchingKey(row);
    
    if (!matchingKeyMap.has(key)) {
      matchingKeyMap.set(key, {
        agent: row[8],           // I열: 담당자
        department: row[7],      // H열: 소속
        office: row[6],          // G열: 사무실
        code: row[4],            // E열: 코드
        performance: 0,           // 개통 건수
        fee: 0,                  // 수수료
        registeredStores: 0,     // 등록점
        activeStores: 0,         // 가동점
        devices: 0,              // 보유단말
        sims: 0,                 // 보유유심
        target: 0,               // 목표값
        support: 0               // 지원금
      });
    }
    
    const data = matchingKeyMap.get(key);
    data.performance++;
    
    // 수수료 처리
    const rawFee = row[3];
    if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
      data.fee += parseFloat(rawFee) || 0;
    }
  });
  
  // 2단계: 목표값 적용
  targets.forEach((targetInfo, targetKey) => {
    if (targetInfo.excluded) return;
    
    // 해당 담당자-코드 조합에 목표값 적용
    matchingKeyMap.forEach((data, key) => {
      if (data.agent === targetInfo.agent && data.code === targetInfo.code) {
        data.target += targetInfo.target;
      }
    });
  });
  
  // 3단계: 출고처 데이터로 등록점 계산 (거래처정보 기반)
  console.log('🔍 [디버깅] customerData 확인:', {
    customerDataExists: !!customerData,
    customerDataLength: customerData ? customerData.length : 'undefined',
    customerDataSample: customerData && customerData.length > 0 ? customerData[0] : 'empty'
  });
  
  // 매칭 불일치 데이터 수집
  const matchingMismatches = [];
  
  if (storeData && customerData && customerData.length > 0) {
    // 각 매칭키별로 정확한 출고처 찾기
    matchingKeyMap.forEach((data, key) => {
      const matchingStores = new Set();
      
      // 김수빈 전용 디버깅: customerData 전체 확인
      if (data.agent === '김수빈') {
        console.log('🔍 [김수빈] customerData 전체 확인:', {
          customerDataLength: customerData.length,
          customerDataSample: customerData.slice(0, 5).map(row => ({
            담당자: row[3] || 'undefined',
            코드: row[1] || 'undefined',
            출고처: row[2] || 'undefined'
          }))
        });
      }
      
      // 거래처정보에서 해당 매칭키(담당자+코드)에 해당하는 출고처 찾기
      customerData.forEach(거래처Row => {
        if (거래처Row.length > 3) {
          const 거래처코드 = (거래처Row[1] || '').toString(); // B열: 코드명
          const 거래처출고처 = (거래처Row[2] || '').toString(); // C열: 출고처명
          const 거래처담당자 = (거래처Row[3] || '').toString().replace(/\([^)]*\)/g, ''); // D열: 담당자명 (괄호와 내용 모두 제거)
          
          // 김수빈 전용 디버깅: 지우모바일 관련만 로그 출력
          if (data.agent === '김수빈' && 거래처출고처.includes('지우모바일')) {
            console.log('🔍 [김수빈] 지우모바일 매칭 조건 확인:', {
              거래처담당자,
              dataAgent: data.agent,
              거래처코드,
              dataCode: data.code,
              거래처출고처,
              담당자매칭: 거래처담당자 === data.agent,
              코드매칭: 거래처코드 === data.code,
              출고처존재: !!거래처출고처
            });
          }
          
          // 해당 매칭키와 정확히 매칭되는 데이터만 처리
          if (거래처담당자 === data.agent && 거래처코드 === data.code && 거래처출고처) {
            
            // 김수빈 전용 상세 디버깅
            if (data.agent === '김수빈') {
              console.log('🔍 [김수빈] 거래처정보 매칭 성공:', {
                거래처담당자,
                거래처코드,
                거래처출고처,
                매칭키: key
              });
            }
            
            // 폰클출고처데이터에서 해당 출고처가 등록되어 있는지 확인 (코드명까지 매칭)
            const isRegistered = storeData.some(storeRow => {
              if (storeRow.length > 21) {
                const storeAgent = (storeRow[21] || '').toString().replace(/\([^)]*\)/g, ''); // V열: 담당자 (괄호와 내용 모두 제거)
                const storeCodeName = (storeRow[7] || '').toString(); // H열: 코드명
                const storeCode = (storeRow[14] || '').toString(); // O열: 출고처코드
                
                // 담당자명 매칭: 정확히 일치하거나 포함 관계
                const agentMatches = storeAgent === 거래처담당자 || 
                                   storeAgent.includes(거래처담당자) || 
                                   거래처담당자.includes(storeAgent);
                
                // 김수빈 전용 디버깅: 매칭 과정 상세 추적
                if (data.agent === '김수빈') {
                  console.log('🔍 [김수빈] 매칭 과정 상세:', {
                    출고처: 거래처출고처,
                    거래처담당자,
                    거래처코드,
                    storeCode,
                    storeAgent,
                    storeCodeName,
                    agentMatches,
                    codeMatches: storeCode === 거래처출고처,
                    nameMatches: storeCodeName === 거래처코드
                  });
                }
                
                return storeCode === 거래처출고처 && agentMatches && storeCodeName === 거래처코드;
              }
              return false;
            });
            
            if (isRegistered) {
              matchingStores.add(거래처출고처);
              
              // 김수빈 전용 디버깅: 매칭 성공
              if (data.agent === '김수빈') {
                console.log('🔍 [김수빈] 폰클출고처데이터 매칭 성공:', {
                  출고처: 거래처출고처,
                  거래처담당자,
                  거래처코드
                });
              }
            } else {
              // 매칭 불일치 데이터 수집
              const storeMismatch = storeData.find(row => 
                row.length > 21 && (row[14] || '').toString() === 거래처출고처
              );
              
              if (storeMismatch) {
                const storeAgent = (storeMismatch[21] || '').toString();
                const storeCodeName = (storeMismatch[7] || '').toString();
                
                matchingMismatches.push({
                  type: '출고처',
                  거래처정보: {
                    담당자: 거래처담당자,
                    코드: 거래처코드,
                    출고처: 거래처출고처
                  },
                  폰클출고처데이터: {
                    담당자: storeAgent,
                    코드: storeCodeName,
                    출고처: (storeMismatch[14] || '').toString()
                  }
                });
              }
              
              // 김수빈 전용 디버깅: 매칭 실패 원인 확인
              if (data.agent === '김수빈') {
                console.log('🔍 [김수빈] 출고처 매칭 실패:', {
                  거래처출고처: 거래처출고처,
                  거래처담당자: 거래처담당자,
                  폰클출고처데이터_담당자들: storeData
                    .filter(row => row.length > 21 && (row[14] || '').toString() === 거래처출고처)
                    .map(row => (row[21] || '').toString())
                });
              }
            }
          }
        }
      });
      
      data.registeredStores = matchingStores.size;
      
      // 가동점 계산 (등록점 중에서 개통 실적이 있는 출고처)
      let activeCount = 0;
      matchingStores.forEach(storeCode => {
        const hasPerformance = phoneklData.some(performanceRow => {
          if (performanceRow.length > 14) {
            const performanceStoreCode = (performanceRow[14] || '').toString(); // O열: 출고처
            const performanceAgent = (performanceRow[8] || '').toString(); // I열: 담당자
            const performanceDepartment = (performanceRow[7] || '').toString(); // H열: 소속
            const performanceOffice = (performanceRow[6] || '').toString(); // G열: 사무실
            const performanceCode = (performanceRow[4] || '').toString(); // E열: 코드
            
            // 코드가 비어있거나 담당자가 비어있으면 제외
            if (!performanceCode.trim() || !performanceAgent.trim()) return false;
            
            // 해당 매칭키와 정확히 매칭되고, 등록점에 포함된 출고처인지 확인
            return performanceStoreCode === storeCode && 
                   performanceAgent === data.agent &&
                   performanceDepartment === data.department &&
                   performanceOffice === data.office &&
                   performanceCode === data.code;
          }
          return false;
        });
        
        if (hasPerformance) {
          activeCount++;
        }
      });
      data.activeStores = activeCount;
      
      // 김수빈 전용 디버깅: 출고처 결과 확인
      if (data.agent === '김수빈') {
        console.log('🔍 [김수빈] 출고처 결과:', {
          매칭키: key,
          등록점: data.registeredStores,
          가동점: data.activeStores,
          출고처목록: Array.from(matchingStores)
        });
      }
    });
  }
  
  // 매칭 불일치 데이터 로그 출력
  if (matchingMismatches.length > 0) {
    // 매칭 불일치 데이터 수집 완료 (로그 제거)
  }
  
  // 4단계: 재고 데이터로 보유단말/유심 계산 (거래처정보 기반)
  if (inventoryData && customerData && customerData.length > 0) {
    // 각 매칭키별로 정확한 재고 찾기
    matchingKeyMap.forEach((data, key) => {
      let devices = 0;
      let sims = 0;
      
      // 거래처정보에서 해당 매칭키(담당자+코드)에 해당하는 출고처 찾기
      customerData.forEach(거래처Row => {
        if (거래처Row.length > 3) {
          const 거래처코드 = (거래처Row[1] || '').toString(); // B열: 코드명
          const 거래처출고처 = (거래처Row[2] || '').toString(); // C열: 출고처명
          const 거래처담당자 = (거래처Row[3] || '').toString().replace(/\([^)]*\)/g, ''); // D열: 담당자명 (괄호와 내용 모두 제거)
          
          // 해당 매칭키와 정확히 매칭되는 데이터만 처리
          if (거래처담당자 === data.agent && 거래처코드 === data.code && 거래처출고처) {
            // 폰클재고데이터에서 해당 출고처의 재고 찾기 (코드명까지 매칭)
            inventoryData.forEach(inventoryRow => {
              if (inventoryRow.length > 8) {
                const inventoryAgent = (inventoryRow[8] || '').toString().replace(/\([^)]*\)/g, ''); // I열: 담당자 (괄호와 내용 모두 제거)
                const inventoryCodeName = (inventoryRow[3] || '').toString(); // D열: 코드명
                const inventoryType = (inventoryRow[12] || '').toString(); // M열: 유형
                const inventoryStore = (inventoryRow[21] || '').toString(); // V열: 출고처
                
                if (excludedAgents.includes(inventoryAgent)) return;
                if (excludedStores.includes(inventoryStore)) return;
                
                // 해당 매칭키와 정확히 매칭되는 재고만 추가 (코드명까지 확인)
                // 담당자명 매칭: 정확히 일치하거나 포함 관계
                const agentMatches = inventoryAgent === 거래처담당자 || 
                                   inventoryAgent.includes(거래처담당자) || 
                                   거래처담당자.includes(inventoryAgent);
                
                if (agentMatches && inventoryStore === 거래처출고처 && inventoryCodeName === 거래처코드) {
                  if (inventoryType === '유심') {
                    sims++;
                  } else {
                    devices++;
                  }
                }
              }
            });
          }
        }
      });
      
      data.devices = devices;
      data.sims = sims;
      
      // 김수빈 전용 디버깅: 재고 결과 확인
      if (data.agent === '김수빈') {
        console.log('🔍 [김수빈] 재고 결과:', {
          매칭키: key,
          보유단말: data.devices,
          보유유심: data.sims
        });
      }
    });
  }
  
  // 5단계: 추가 계산
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  matchingKeyMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / today.getDate() * daysInMonth);
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
  });
  

  return { matchingKeyMap, matchingMismatches };
}

// 지원금 계산 함수
function calculateSupportBonus(phoneklData, excludedAgents) {
  // 1단계: 담당자별 총수수료 집계 (조합별)
  const agentCombinationMap = new Map();
  
  phoneklData.forEach(row => {
    const agent = (row[8] || '').toString(); // I열: 담당자
    const code = (row[4] || '').toString(); // E열: 코드
    const office = (row[6] || '').toString(); // G열: 사무실
    const department = (row[7] || '').toString(); // H열: 소속
    
    if (!agent || excludedAgents.includes(agent)) return;
    
    const combinationKey = `${agent}|${code}|${office}|${department}`;
    
    // #N/A 값 처리
    const rawFee = row[3];
    let fee = 0;
    
    if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
      fee = parseFloat(rawFee) || 0;
    }
    
    if (!agentCombinationMap.has(combinationKey)) {
      agentCombinationMap.set(combinationKey, {
        agent,
        code,
        office,
        department,
        fee: 0
      });
    }
    
    agentCombinationMap.get(combinationKey).fee += fee;
  });
  
  // 2단계: 담당자별 총수수료 집계
  const agentTotalMap = new Map();
  
  agentCombinationMap.forEach((data, key) => {
    const agent = data.agent;
    
    if (!agentTotalMap.has(agent)) {
      agentTotalMap.set(agent, {
        agent,
        totalFee: 0,
        combinations: []
      });
    }
    
    agentTotalMap.get(agent).totalFee += data.fee;
    agentTotalMap.get(agent).combinations.push(data);
  });
  
  // 3단계: 담당자별 총수수료 기준 상위 1~5위 선정
  const sortedAgents = Array.from(agentTotalMap.values())
    .sort((a, b) => b.totalFee - a.totalFee)
    .slice(0, 5);
  
  // 4단계: 각 조합별 지원금 계산
  const supportRates = [0.10, 0.08, 0.06, 0.04, 0.02]; // 10%, 8%, 6%, 4%, 2%
  
  sortedAgents.forEach((agentData, index) => {
    const supportRate = supportRates[index];
    
    agentData.combinations.forEach(combination => {
      combination.support = combination.fee * supportRate;
    });
  });
  
  // 5단계: 그룹별 지원금 합계 계산
  const officeSupportMap = new Map();
  const departmentSupportMap = new Map();
  const agentSupportMap = new Map();
  const codeSupportMap = new Map();
  
  agentCombinationMap.forEach((data, key) => {
    const support = data.support || 0;
    
    // 코드별 합계
    if (data.code) {
      if (!codeSupportMap.has(data.code)) {
        codeSupportMap.set(data.code, 0);
      }
      codeSupportMap.set(data.code, codeSupportMap.get(data.code) + support);
    }
    
    // 사무실별 합계
    if (data.office) {
      if (!officeSupportMap.has(data.office)) {
        officeSupportMap.set(data.office, 0);
      }
      officeSupportMap.set(data.office, officeSupportMap.get(data.office) + support);
    }
    
    // 소속별 합계
    if (data.department) {
      if (!departmentSupportMap.has(data.department)) {
        departmentSupportMap.set(data.department, 0);
      }
      departmentSupportMap.set(data.department, departmentSupportMap.get(data.department) + support);
    }
    
    // 담당자별 합계
    if (data.agent) {
      if (!agentSupportMap.has(data.agent)) {
        agentSupportMap.set(data.agent, 0);
      }
      agentSupportMap.set(data.agent, agentSupportMap.get(data.agent) + support);
    }
  });
  

  
  return {
    codeSupportMap,
    officeSupportMap,
    departmentSupportMap,
    agentSupportMap
  };
}

// 코드별 집계


// 사무실별 집계
function aggregateByOffice(phoneklData, storeData, inventoryData, excludedAgents, excludedStores, officeSupportMap, targets, filteredPhoneklData) {

  
  const officeMap = new Map();
  
  phoneklData.forEach(row => {
    const office = (row[6] || '').toString(); // G열: 사무실
    const agent = (row[8] || '').toString(); // I열: 담당자
    
    if (!office || excludedAgents.includes(agent)) return;
    
    if (!officeMap.has(office)) {
      officeMap.set(office, {
        office,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0
      });
    }
    
    const data = officeMap.get(office);
    data.performance++;
    
    // #N/A 값 처리
    const rawFee = row[3];
    let fee = 0;
    
    if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
      fee = parseFloat(rawFee) || 0;
    }
    
    data.fee += fee;
  });
  

  

  
  // 추가 계산
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  officeMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / today.getDate() * daysInMonth);
    
    // 목표값 적용 (해당 사무실의 모든 담당자-코드 조합 목표값 합계)
    let totalTarget = 0;
    targets.forEach((targetInfo, key) => {
      if (!targetInfo.excluded) {
        // 해당 사무실의 담당자인지 확인
        const agentData = phoneklData.find(row => 
          (row[8] || '').toString() === targetInfo.agent && 
          (row[6] || '').toString() === data.office
        );
        if (agentData) {
        totalTarget += targetInfo.target;
        }
      }
    });
    data.target = totalTarget;
    
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    
    // 등록점, 가동점, 보유단말, 보유유심 계산 (담당자별 방식으로 통일)
    let totalRegisteredStores = 0;
    let totalActiveStores = 0;
    let totalDevices = 0;
    let totalSims = 0;
    
    // 해당 사무실의 모든 담당자들의 고유 출고처 목록 생성
    const agentStores = new Map(); // 담당자별 고유 출고처 목록
    const agentInventory = new Map(); // 담당자별 재고 데이터
    
    // 1단계: 해당 사무실의 담당자들의 고유 출고처 수집
    if (storeData) {
      storeData.forEach(storeRow => {
        if (storeRow.length > 21) {
          const storeAgent = (storeRow[21] || '').toString(); // V열: 담당자
          const storeCode = (storeRow[14] || '').toString(); // O열: 출고처코드
          
          // 해당 사무실의 담당자인지 확인
          const isOfficeAgent = phoneklData.some(row => {
            const rowOffice = (row[6] || '').toString(); // G열: 사무실
            const rowAgent = (row[8] || '').toString(); // I열: 담당자
            return rowOffice === data.office && rowAgent === storeAgent && !excludedAgents.includes(rowAgent);
          });
          
          if (isOfficeAgent && storeCode) {
            // 제외 조건들
            if (storeCode.includes('사무실')) return;
            if (storeCode === storeAgent) return;
            if (storeAgent.includes('거래종료')) return;
            
            if (!agentStores.has(storeAgent)) {
              agentStores.set(storeAgent, new Set());
            }
            agentStores.get(storeAgent).add(storeCode);
          }
        }
      });
    }
    
    // 2단계: 재고 데이터 수집
    if (inventoryData) {
      inventoryData.forEach(inventoryRow => {
        if (inventoryRow.length > 8) {
          const inventoryAgent = (inventoryRow[8] || '').toString(); // I열: 담당자
          const inventoryType = (inventoryRow[12] || '').toString(); // M열: 유형
          const inventoryStore = (inventoryRow[21] || '').toString(); // V열: 출고처
          
          // 해당 사무실의 담당자인지 확인
          const isOfficeAgent = phoneklData.some(row => {
            const rowOffice = (row[6] || '').toString(); // G열: 사무실
            const rowAgent = (row[8] || '').toString(); // I열: 담당자
            return rowOffice === data.office && rowAgent === inventoryAgent && !excludedAgents.includes(rowAgent);
          });
          
          if (isOfficeAgent && !excludedStores.includes(inventoryStore)) {
            if (!agentInventory.has(inventoryAgent)) {
              agentInventory.set(inventoryAgent, { devices: 0, sims: 0 });
            }
            if (inventoryType === '유심') {
              agentInventory.get(inventoryAgent).sims++;
            } else {
              agentInventory.get(inventoryAgent).devices++;
            }
          }
        }
      });
    }
    
    // 3단계: 등록점, 가동점, 재고 계산
    agentStores.forEach((stores, agent) => {
      totalRegisteredStores += stores.size;
      
      // 가동점 계산 (각 출고처별로 실적 확인)
      stores.forEach(storeCode => {
        const hasPerformance = filteredPhoneklData.some(performanceRow => {
          const performanceStoreCode = (performanceRow[14] || '').toString();
          const performanceAgent = (performanceRow[8] || '').toString();
          return performanceStoreCode === storeCode && performanceAgent === agent;
        });
        
        if (hasPerformance) {
          totalActiveStores++;
        }
      });
    });
    
    // 4단계: 재고 합계
    agentInventory.forEach((inventory) => {
      totalDevices += inventory.devices;
      totalSims += inventory.sims;
    });
    
    data.registeredStores = totalRegisteredStores;
    data.activeStores = totalActiveStores;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.inactiveStores = data.registeredStores - data.activeStores;
    data.devices = totalDevices;
    data.sims = totalSims;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    
    // 지원금 적용
    data.support = officeSupportMap ? (officeSupportMap.get(data.office) || 0) : 0;
  });
  
  return Array.from(officeMap.values()).sort((a, b) => b.performance - a.performance);
}

// 코드별 집계
function aggregateByCode(phoneklData, storeData, inventoryData, excludedAgents, excludedStores, codeSupportMap, targets, filteredPhoneklData) {

  
  const codeMap = new Map();
  let excludedCount = 0;
  let noCodeCount = 0;
  
  phoneklData.forEach(row => {
    const code = (row[4] || '').toString(); // E열: 코드
    const agent = (row[8] || '').toString(); // I열: 담당자
    
    if (!code) {
      noCodeCount++;
      return;
    }
    
    if (excludedAgents.includes(agent)) {
      excludedCount++;
      return;
    }
    
    if (!codeMap.has(code)) {
      codeMap.set(code, {
        code,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const data = codeMap.get(code);
    data.performance++;
    
    // #N/A 값 처리
    const rawFee = row[3];
    let fee = 0;
    
    if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
      fee = parseFloat(rawFee) || 0;
    }
    
    data.fee += fee;
  });
  

  
  // 추가 계산
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  codeMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / today.getDate() * daysInMonth);
    
    // 목표값 적용 (해당 코드의 모든 담당자-코드 조합 목표값 합계)
    let totalTarget = 0;
    targets.forEach((targetInfo, key) => {
      if (!targetInfo.excluded) {
        // 해당 코드의 담당자인지 확인
        const agentData = phoneklData.find(row => 
          (row[8] || '').toString() === targetInfo.agent && 
          (row[4] || '').toString() === data.code
        );
        if (agentData) {
          totalTarget += targetInfo.target;
        }
      }
    });
    data.target = totalTarget;
    
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    
    // 등록점, 가동점, 보유단말, 보유유심 계산 (담당자별 방식으로 통일)
    let totalRegisteredStores = 0;
    let totalActiveStores = 0;
    let totalDevices = 0;
    let totalSims = 0;
    
    // 해당 코드의 모든 담당자들의 고유 출고처 목록 생성
    const agentStores = new Map(); // 담당자별 고유 출고처 목록
    const agentInventory = new Map(); // 담당자별 재고 데이터
    
    // 1단계: 해당 코드의 담당자들의 고유 출고처 수집
    if (storeData) {
      storeData.forEach(storeRow => {
        if (storeRow.length > 21) {
          const storeAgent = (storeRow[21] || '').toString(); // V열: 담당자
          const storeCode = (storeRow[14] || '').toString(); // O열: 출고처코드
          
          // 해당 코드의 담당자인지 확인
          const isCodeAgent = phoneklData.some(row => {
            const rowCode = (row[4] || '').toString(); // E열: 코드
            const rowAgent = (row[8] || '').toString(); // I열: 담당자
            return rowCode === data.code && rowAgent === storeAgent && !excludedAgents.includes(rowAgent);
          });
          
          if (isCodeAgent && storeCode) {
            // 제외 조건들
            if (storeCode.includes('사무실')) return;
            if (storeCode === storeAgent) return;
            if (storeAgent.includes('거래종료')) return;
            
            if (!agentStores.has(storeAgent)) {
              agentStores.set(storeAgent, new Set());
            }
            agentStores.get(storeAgent).add(storeCode);
          }
        }
      });
    }
    
    // 2단계: 재고 데이터 수집
    if (inventoryData) {
      inventoryData.forEach(inventoryRow => {
        if (inventoryRow.length > 8) {
          const inventoryAgent = (inventoryRow[8] || '').toString(); // I열: 담당자
          const inventoryType = (inventoryRow[12] || '').toString(); // M열: 유형
          const inventoryStore = (inventoryRow[21] || '').toString(); // V열: 출고처
          
          // 해당 코드의 담당자인지 확인
          const isCodeAgent = phoneklData.some(row => {
            const rowCode = (row[4] || '').toString(); // E열: 코드
            const rowAgent = (row[8] || '').toString(); // I열: 담당자
            return rowCode === data.code && rowAgent === inventoryAgent && !excludedAgents.includes(rowAgent);
          });
          
          if (isCodeAgent && !excludedStores.includes(inventoryStore)) {
            if (!agentInventory.has(inventoryAgent)) {
              agentInventory.set(inventoryAgent, { devices: 0, sims: 0 });
            }
            if (inventoryType === '유심') {
              agentInventory.get(inventoryAgent).sims++;
            } else {
              agentInventory.get(inventoryAgent).devices++;
            }
          }
        }
      });
    }
    
    // 3단계: 등록점, 가동점, 재고 계산
    agentStores.forEach((stores, agent) => {
      totalRegisteredStores += stores.size;
      
      // 가동점 계산 (각 출고처별로 실적 확인)
      stores.forEach(storeCode => {
        const hasPerformance = filteredPhoneklData.some(performanceRow => {
          const performanceStoreCode = (performanceRow[14] || '').toString();
          const performanceAgent = (performanceRow[8] || '').toString();
          return performanceStoreCode === storeCode && performanceAgent === agent;
        });
        
        if (hasPerformance) {
          totalActiveStores++;
        }
      });
    });
    
    // 4단계: 재고 합계
    agentInventory.forEach((inventory) => {
      totalDevices += inventory.devices;
      totalSims += inventory.sims;
    });
    
    data.registeredStores = totalRegisteredStores;
    data.activeStores = totalActiveStores;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.inactiveStores = data.registeredStores - totalActiveStores;
    data.devices = totalDevices;
    data.sims = totalSims;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    
    // 지원금 적용
    data.support = codeSupportMap ? (codeSupportMap.get(data.code) || 0) : 0;
  });
  

  
  return Array.from(codeMap.values()).sort((a, b) => b.fee - a.fee);
}

// 통합 데이터에서 코드별 집계 추출
function aggregateByCodeFromUnified(unifiedData, codeSupportMap) {
  const codeMap = new Map();
  
  unifiedData.forEach((data, key) => {
    const code = data.code;
    
    if (!codeMap.has(code)) {
      codeMap.set(code, {
        code,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const codeData = codeMap.get(code);
    codeData.performance += data.performance;
    codeData.fee += data.fee;
    codeData.target += data.target;
    codeData.registeredStores += data.registeredStores;
    codeData.activeStores += data.activeStores;
    codeData.devices += data.devices;
    codeData.sims += data.sims;
  });
  
  // 추가 계산
  codeMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    data.support = codeSupportMap ? (codeSupportMap.get(data.code) || 0) : 0;
  });
  
  return Array.from(codeMap.values()).sort((a, b) => b.fee - a.fee);
}

// 통합 데이터에서 사무실별 집계 추출
function aggregateByOfficeFromUnified(unifiedData, officeSupportMap) {
  const officeMap = new Map();
  
  unifiedData.forEach((data, key) => {
    const office = data.office;
    
    if (!officeMap.has(office)) {
      officeMap.set(office, {
        office,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const officeData = officeMap.get(office);
    officeData.performance += data.performance;
    officeData.fee += data.fee;
    officeData.target += data.target;
    officeData.registeredStores += data.registeredStores;
    officeData.activeStores += data.activeStores;
    officeData.devices += data.devices;
    officeData.sims += data.sims;
  });
  
  // 추가 계산
  officeMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    data.support = officeSupportMap ? (officeSupportMap.get(data.office) || 0) : 0;
  });
  
  return Array.from(officeMap.values()).sort((a, b) => b.performance - a.performance);
}

// 통합 데이터에서 소속별 집계 추출
function aggregateByDepartmentFromUnified(unifiedData, departmentSupportMap) {
  const departmentMap = new Map();
  
  unifiedData.forEach((data, key) => {
    const department = data.department;
    
    if (!departmentMap.has(department)) {
      departmentMap.set(department, {
        department,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const deptData = departmentMap.get(department);
    deptData.performance += data.performance;
    deptData.fee += data.fee;
    deptData.target += data.target;
    deptData.registeredStores += data.registeredStores;
    deptData.activeStores += data.activeStores;
    deptData.devices += data.devices;
    deptData.sims += data.sims;
  });
  
  // 추가 계산
  departmentMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    data.support = departmentSupportMap ? (departmentSupportMap.get(data.department) || 0) : 0;
  });
  
  return Array.from(departmentMap.values()).sort((a, b) => b.fee - a.fee);
}

// 통합 데이터에서 담당자별 집계 추출
function aggregateByAgentFromUnified(unifiedData, agentSupportMap) {
  const agentMap = new Map();
  
  unifiedData.forEach((data, key) => {
    const agent = data.agent;
    
    if (!agentMap.has(agent)) {
      agentMap.set(agent, {
        agent,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const agentData = agentMap.get(agent);
    agentData.performance += data.performance;
    agentData.fee += data.fee;
    agentData.target += data.target;
    agentData.registeredStores += data.registeredStores;
    agentData.activeStores += data.activeStores;
    agentData.devices += data.devices;
    agentData.sims += data.sims;
  });
  
  // 추가 계산
  agentMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    data.support = agentSupportMap ? (agentSupportMap.get(data.agent) || 0) : 0;
  });
  
  return Array.from(agentMap.values()).sort((a, b) => b.fee - a.fee);
}

// 소속별 집계
function aggregateByDepartment(phoneklData, storeData, inventoryData, excludedAgents, excludedStores, departmentSupportMap, targets, filteredPhoneklData) {

  
  const departmentMap = new Map();
  let excludedCount = 0;
  let noDepartmentCount = 0;
  
  phoneklData.forEach(row => {
    const department = (row[7] || '').toString(); // H열: 소속
    const agent = (row[8] || '').toString(); // I열: 담당자
    
    if (!department) {
      noDepartmentCount++;
      return;
    }
    
    if (excludedAgents.includes(agent)) {
      excludedCount++;
      return;
    }
    
    if (!departmentMap.has(department)) {
      departmentMap.set(department, {
        department,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const data = departmentMap.get(department);
    data.performance++;
    
    // #N/A 값 처리
    const rawFee = row[3];
    let fee = 0;
    
    if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
      fee = parseFloat(rawFee) || 0;
    }
    
    data.fee += fee;
  });
  

  
  // 추가 계산
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  departmentMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / today.getDate() * daysInMonth);
    
    // 목표값 적용 (해당 소속의 모든 담당자-코드 조합 목표값 합계)
    let totalTarget = 0;
    targets.forEach((targetInfo, key) => {
      if (!targetInfo.excluded) {
        // 해당 소속의 담당자인지 확인
        const agentData = phoneklData.find(row => 
          (row[8] || '').toString() === targetInfo.agent && 
          (row[7] || '').toString() === data.department
        );
        if (agentData) {
          totalTarget += targetInfo.target;
        }
      }
    });
    data.target = totalTarget;
    
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    
    // 등록점, 가동점, 보유단말, 보유유심 계산 (담당자별 방식으로 통일)
    let totalRegisteredStores = 0;
    let totalActiveStores = 0;
    let totalDevices = 0;
    let totalSims = 0;
    
    // 해당 소속의 모든 담당자들의 고유 출고처 목록 생성
    const agentStores = new Map(); // 담당자별 고유 출고처 목록
    const agentInventory = new Map(); // 담당자별 재고 데이터
    
    // 1단계: 해당 소속의 담당자들의 고유 출고처 수집
    if (storeData) {
      storeData.forEach(storeRow => {
        if (storeRow.length > 21) {
          const storeAgent = (storeRow[21] || '').toString(); // V열: 담당자
          const storeCode = (storeRow[14] || '').toString(); // O열: 출고처코드
          
          // 해당 소속의 담당자인지 확인
          const isDepartmentAgent = phoneklData.some(row => {
            const rowDepartment = (row[7] || '').toString(); // H열: 소속
            const rowAgent = (row[8] || '').toString(); // I열: 담당자
            return rowDepartment === data.department && rowAgent === storeAgent && !excludedAgents.includes(rowAgent);
          });
          
          if (isDepartmentAgent && storeCode) {
            // 제외 조건들
            if (storeCode.includes('사무실')) return;
            if (storeCode === storeAgent) return;
            if (storeAgent.includes('거래종료')) return;
            
            if (!agentStores.has(storeAgent)) {
              agentStores.set(storeAgent, new Set());
            }
            agentStores.get(storeAgent).add(storeCode);
          }
        }
      });
    }
    
    // 2단계: 재고 데이터 수집
    if (inventoryData) {
      inventoryData.forEach(inventoryRow => {
        if (inventoryRow.length > 8) {
          const inventoryAgent = (inventoryRow[8] || '').toString(); // I열: 담당자
          const inventoryType = (inventoryRow[12] || '').toString(); // M열: 유형
          const inventoryStore = (inventoryRow[21] || '').toString(); // V열: 출고처
          
          // 해당 소속의 담당자인지 확인
          const isDepartmentAgent = phoneklData.some(row => {
            const rowDepartment = (row[7] || '').toString(); // H열: 소속
            const rowAgent = (row[8] || '').toString(); // I열: 담당자
            return rowDepartment === data.department && rowAgent === inventoryAgent && !excludedAgents.includes(rowAgent);
          });
          
          if (isDepartmentAgent && !excludedStores.includes(inventoryStore)) {
            if (!agentInventory.has(inventoryAgent)) {
              agentInventory.set(inventoryAgent, { devices: 0, sims: 0 });
            }
            if (inventoryType === '유심') {
              agentInventory.get(inventoryAgent).sims++;
            } else {
              agentInventory.get(inventoryAgent).devices++;
            }
          }
        }
      });
    }
    
    // 3단계: 등록점, 가동점, 재고 계산
    agentStores.forEach((stores, agent) => {
      totalRegisteredStores += stores.size;
      
      // 가동점 계산 (각 출고처별로 실적 확인)
      stores.forEach(storeCode => {
        const hasPerformance = filteredPhoneklData.some(performanceRow => {
          const performanceStoreCode = (performanceRow[14] || '').toString();
          const performanceAgent = (performanceRow[8] || '').toString();
          return performanceStoreCode === storeCode && performanceAgent === agent;
        });
        
        if (hasPerformance) {
          totalActiveStores++;
        }
      });
    });
    
    // 4단계: 재고 합계
    agentInventory.forEach((inventory) => {
      totalDevices += inventory.devices;
      totalSims += inventory.sims;
    });
    
    data.registeredStores = totalRegisteredStores;
    data.activeStores = totalActiveStores;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.inactiveStores = data.registeredStores - data.activeStores;
    data.devices = totalDevices;
    data.sims = totalSims;
    data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    
    // 지원금 적용
    data.support = departmentSupportMap ? (departmentSupportMap.get(data.department) || 0) : 0;
  });
  

  
  return Array.from(departmentMap.values()).sort((a, b) => b.fee - a.fee);
}

// 소속별 상세 정보 계산
function calculateDepartmentDetails(departmentMap, storeData, inventoryData, excludedStores) {
  // 등록점 계산 (폰클출고처데이터)
  if (storeData) {
    storeData.forEach(row => {
      if (row.length > 21) {
        const agent = (row[21] || '').toString(); // V열: 담당자
        const storeCode = (row[14] || '').toString(); // O열: 출고처코드
        
        if (agent && storeCode) {
          // 담당자로부터 소속 찾기
          departmentMap.forEach((data, department) => {
            // 실제로는 담당자-소속 매핑이 필요하지만, 여기서는 간단히 처리
            if (agent.includes(department) || department.includes(agent)) {
              data.registeredStores++;
            }
          });
        }
      }
    });
  }
  
  // 가동점 계산
  departmentMap.forEach((data, department) => {
    let activeCount = 0;
    if (storeData) {
      storeData.forEach(row => {
        if (row.length > 21) {
          const agent = (row[21] || '').toString();
          if (agent.includes(department) || department.includes(agent)) {
            const storeCode = (row[14] || '').toString();
            if (storeCode && data.performance > 0) {
              activeCount++;
            }
          }
        }
      });
    }
    data.activeStores = activeCount;
  });
  
  // 보유단말, 보유유심 계산 (폰클재고데이터)
  if (inventoryData) {
    inventoryData.forEach(row => {
      if (row.length > 8) {
        const agent = (row[8] || '').toString(); // I열: 담당자
        const type = (row[12] || '').toString(); // M열: 유형
        const store = (row[21] || '').toString(); // V열: 출고처
        
        if (agent && !excludedStores.includes(store)) {
          departmentMap.forEach((data, department) => {
            if (agent.includes(department) || department.includes(agent)) {
              if (type === '유심') {
                data.sims++;
              } else {
                data.devices++;
              }
            }
          });
        }
      }
    });
  }
}

// 담당자별 집계
function aggregateByAgent(phoneklData, storeData, inventoryData, excludedAgents, excludedStores, agentSupportMap, targets, filteredPhoneklData) {
  const agentMap = new Map();
  
  phoneklData.forEach(row => {
    const agent = (row[8] || '').toString(); // I열: 담당자
    
    if (!agent || excludedAgents.includes(agent)) return;
    
    if (!agentMap.has(agent)) {
      agentMap.set(agent, {
        agent,
        performance: 0,
        fee: 0,
        support: 0,
        target: 0,
        achievement: 0,
        expectedClosing: 0,
        rotation: 0,
        registeredStores: 0,
        activeStores: 0,
        devices: 0,
        sims: 0,
        utilization: 0
      });
    }
    
    const data = agentMap.get(agent);
    data.performance++;
    
    // #N/A 값 처리
    const rawFee = row[3];
    let fee = 0;
    
    if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
      fee = parseFloat(rawFee) || 0;
    }
    
    data.fee += fee;
  });
  
  // 등록점, 가동점, 보유단말, 보유유심 계산
  calculateAgentDetails(agentMap, storeData, inventoryData, excludedStores, filteredPhoneklData);
  
  // 추가 계산
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  agentMap.forEach(data => {
    data.expectedClosing = Math.round(data.performance / today.getDate() * daysInMonth);
    
    // 목표값 적용 (해당 담당자의 모든 코드 목표값 합계)
    let totalTarget = 0;
    targets.forEach((targetInfo, key) => {
      if (!targetInfo.excluded && targetInfo.agent === data.agent) {
        totalTarget += targetInfo.target;
      }
    });
    data.target = totalTarget;
    
    data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
    data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
    data.rotation = (data.devices + data.expectedClosing) > 0 ? Math.round((data.expectedClosing / (data.devices + data.expectedClosing)) * 100) : 0;
    
    // 지원금 적용
    data.support = agentSupportMap ? (agentSupportMap.get(data.agent) || 0) : 0;
  });
  
  return Array.from(agentMap.values()).sort((a, b) => b.fee - a.fee);
}

// 담당자 상세 정보 계산
function calculateAgentDetails(agentMap, storeData, inventoryData, excludedStores, filteredPhoneklData) {
  // 등록점 계산 (폰클출고처데이터)
  if (storeData) {
    storeData.forEach(row => {
      if (row.length > 21) {
        const agent = (row[21] || '').toString(); // V열: 담당자
        const storeCode = (row[14] || '').toString(); // O열: 출고처코드
        
        // 제외 조건들
        if (storeCode.includes('사무실')) return; // 출고처코드에 "사무실" 포함 시 제외
        if (storeCode === agent) return; // 출고처코드와 담당자가 동일한 텍스트 시 제외
        if (agent.includes('거래종료')) return; // 담당자에 "거래종료" 포함 시 제외
        
        if (agent && agentMap.has(agent) && storeCode) {
          agentMap.get(agent).registeredStores++;
        }
      }
    });
  }
  
  // 가동점 계산
  agentMap.forEach((data, agent) => {
    // 가동점 = 등록점 중에서 실적이 있는 곳
    let activeCount = 0;
    if (storeData) {
      storeData.forEach(row => {
        if (row.length > 21 && row[21] === agent) {
          const storeCode = (row[14] || '').toString();
          
          // 제외 조건들 (등록점과 동일)
          if (storeCode.includes('사무실')) return; // 출고처코드에 "사무실" 포함 시 제외
          if (storeCode === agent) return; // 출고처코드와 담당자가 동일한 텍스트 시 제외
          if (agent.includes('거래종료')) return; // 담당자에 "거래종료" 포함 시 제외
          
          // 해당 출고처에서 당월실적이 있는지 확인
          const hasPerformance = filteredPhoneklData.some(performanceRow => {
            const performanceStoreCode = (performanceRow[14] || '').toString(); // O열: 출고처코드
            const performanceAgent = (performanceRow[8] || '').toString(); // I열: 담당자
            return performanceStoreCode === storeCode && performanceAgent === agent;
          });
          
          if (storeCode && hasPerformance) {
            activeCount++;
          }
        }
      });
    }
    data.activeStores = activeCount;
  });
  
  // 보유단말, 보유유심 계산 (폰클재고데이터)
  if (inventoryData) {
    inventoryData.forEach(row => {
      if (row.length > 8) {
        const agent = (row[8] || '').toString(); // I열: 담당자
        const type = (row[12] || '').toString(); // M열: 유형
        const store = (row[21] || '').toString(); // V열: 출고처
        
        if (agent && agentMap.has(agent) && !excludedStores.includes(store)) {
          if (type === '유심') {
            agentMap.get(agent).sims++;
          } else {
            agentMap.get(agent).devices++;
          }
        }
      }
    });
  }
}

// CS 개통 요약 계산 (무선 + 유선)
function calculateCSSummary(filteredPhoneklData, phoneklHomeData, targetDate, phoneModels, excludedAgents) {
  console.log('🔍 [CS 디버깅] calculateCSSummary 시작');
  console.log('🔍 [CS 디버깅] filteredPhoneklData 길이:', filteredPhoneklData.length);
  console.log('🔍 [CS 디버깅] targetDate:', targetDate);
  console.log('🔍 [CS 디버깅] phoneModels 크기:', phoneModels.size);
  
  const csAgents = new Map();
  let totalWireless = 0;
  let totalWired = 0;
  
  // BZ열에서 CS 직원들 명단 추출 (고유값) - 무선
  const csEmployeeSet = new Set();
  let bzColumnEmptyCount = 0;
  let bzColumnNCount = 0;
  let bzColumnValidCount = 0;
  
  filteredPhoneklData.forEach((row, index) => {
    const csEmployee = (row[77] || '').toString().trim(); // BZ열: CS직원
    
    if (!csEmployee || csEmployee === '') {
      bzColumnEmptyCount++;
    } else if (csEmployee === 'N' || csEmployee === 'NO') {
      bzColumnNCount++;
    } else {
      bzColumnValidCount++;
      csEmployeeSet.add(csEmployee);
      
      // 처음 5개 CS 직원명만 로그 출력
      if (bzColumnValidCount <= 5) {
        console.log(`🔍 [CS 디버깅] 유효한 CS 직원 ${bzColumnValidCount}: "${csEmployee}" (행 ${index + 4})`);
      }
    }
  });
  
  console.log('🔍 [CS 디버깅] BZ열 분석 결과:');
  console.log('🔍 [CS 디버깅] - 빈 값:', bzColumnEmptyCount);
  console.log('🔍 [CS 디버깅] - N/NO 값:', bzColumnNCount);
  console.log('🔍 [CS 디버깅] - 유효한 CS 직원:', bzColumnValidCount);
  console.log('🔍 [CS 디버깅] - 고유 CS 직원 수:', csEmployeeSet.size);
  console.log('🔍 [CS 디버깅] - 고유 CS 직원 목록:', Array.from(csEmployeeSet));
  

  
  // CN열에서 CS 직원들 명단 추출 (고유값) - 유선
  const wiredCSEmployees = new Set();
  if (phoneklHomeData) {

    
    // 헤더 제외 (3행까지 제외, 4행부터 데이터)
    const dataRows = phoneklHomeData.slice(3);

    

    
    // CN열에서 CS 직원 추출
    dataRows.forEach((row, index) => {
      const csEmployee = (row[91] || '').toString().trim(); // CN열: CS 직원
      if (csEmployee && csEmployee !== '' && csEmployee !== 'N' && csEmployee !== 'NO' && 
          (csEmployee.includes('MIN') || csEmployee.includes('VIP') || csEmployee.includes('등록'))) {
        wiredCSEmployees.add(csEmployee);

      }
    });
    

  } else {

  }
  
  // 모든 CS 직원 통합
  csEmployeeSet.forEach(employee => wiredCSEmployees.add(employee));
  
  
  // 각 CS 직원별로 실적 계산 초기화
  wiredCSEmployees.forEach(csEmployee => {
    csAgents.set(csEmployee, { wireless: 0, wired: 0, total: 0 });
  });
  
  // 무선 개통 데이터 처리 (filteredPhoneklData 사용) - 모든 필터링이 이미 적용된 데이터
  let wirelessProcessed = 0;
  let rowLengthIssueCount = 0;
  let csEmployeeValidCount = 0;
  
  filteredPhoneklData.forEach((row, index) => {
    // 처음 5개 행의 길이와 BZ열 값 확인
    if (index < 5) {
      console.log(`🔍 [CS 디버깅] 행 ${index + 1} 길이: ${row.length}, BZ열(77): "${row[77] || '없음'}"`);
    }
    
    if (row.length < 78) {
      rowLengthIssueCount++;
      return; // 최소한 BZ열까지 있는지 확인
    }
    
    const csEmployee = (row[77] || '').toString().trim(); // BZ열: CS직원
    
    // CS 직원 필터링 (BZ열에 값이 있으면 CS 개통으로 간주)
    if (csEmployee && csEmployee !== '' && csEmployee !== 'N' && csEmployee !== 'NO') {
      totalWireless++;
      wirelessProcessed++;
      csEmployeeValidCount++;
      
      if (csAgents.has(csEmployee)) {
        csAgents.get(csEmployee).wireless++;
        csAgents.get(csEmployee).total++;
      }
      
      // 처음 3개 CS 개통만 상세 로그 출력
      if (csEmployeeValidCount <= 3) {
        const activationDate = (row[9] || '').toString(); // J열: 개통일
        const model = (row[21] || '').toString(); // V열: 모델명
        console.log(`🔍 [CS 디버깅] CS 개통 ${csEmployeeValidCount}: "${csEmployee}" - ${activationDate} - ${model} (행 ${index + 4})`);
      }
    }
  });
  
  console.log('🔍 [CS 디버깅] 무선 개통 처리 결과:');
  console.log('🔍 [CS 디버깅] - 행 길이 부족:', rowLengthIssueCount);
  console.log('🔍 [CS 디버깅] - 유효한 CS 개통:', csEmployeeValidCount);
  console.log('🔍 [CS 디버깅] - 총 무선 개통:', totalWireless);
  
  
  
  // 유선 개통 데이터 처리 (폰클홈데이터)
  let wiredProcessed = 0;
  if (phoneklHomeData) {
    // 헤더 제외 (3행까지 제외, 4행부터 데이터)
    const dataRows = phoneklHomeData.slice(3);
    
    dataRows.forEach((row, index) => {
      // CN열에서 CS 직원 정보 추출
      const csEmployee = (row[91] || '').toString().trim(); // CN열: CS 직원
      
      // CM열에서 접수일 추출
      const receiptDate = (row[90] || '').toString().trim(); // CM열: 접수일
      
      // 날짜 필터링 (해당 날짜까지의 누적 데이터)
      const targetDateObj = new Date(targetDate);
      const receiptDateObj = new Date(receiptDate);
      
      if (!isNaN(receiptDateObj.getTime()) && receiptDateObj <= targetDateObj && 
          csEmployee && csEmployee !== '' && csEmployee !== 'N' && csEmployee !== 'NO' &&
          (csEmployee.includes('MIN') || csEmployee.includes('VIP') || csEmployee.includes('등록'))) {
        totalWired++;
        wiredProcessed++;
        
        if (csAgents.has(csEmployee)) {
          csAgents.get(csEmployee).wired++;
          csAgents.get(csEmployee).total++;
        }
      }
      

    });
    

  }
  
  const result = {
    totalWireless,
    totalWired,
    total: totalWireless + totalWired,
    agents: Array.from(csAgents.entries())
      .filter(([agent, data]) => data.total > 0) // 실적이 있는 직원만
      .sort((a, b) => b[1].total - a[1].total) // 총 실적 순으로 정렬
      .map(([agent, data]) => ({
        agent,
        wireless: data.wireless,
        wired: data.wired,
        total: data.total
      }))
  };
  
  console.log('🔍 [CS 디버깅] 최종 결과:');
  console.log('🔍 [CS 디버깅] - 총 무선 개통:', result.totalWireless);
  console.log('🔍 [CS 디버깅] - 총 유선 개통:', result.totalWired);
  console.log('🔍 [CS 디버깅] - 총 개통:', result.total);
  console.log('🔍 [CS 디버깅] - CS 직원 수:', result.agents.length);
  console.log('🔍 [CS 디버깅] - CS 직원 목록:', result.agents.map(a => `${a.agent}(${a.total}건)`));
  
  return result;
}

// 등록점 계산 함수
function calculateRegisteredStores(code, storeData) {
  if (!storeData) return 0;
  
  let count = 0;
  console.log(`🔍 [등록점계산] ${code} 검색 시작`);
  
  storeData.forEach((row, index) => {
    if (row.length > 14) {
      const storeCode = (row[14] || '').toString(); // O열: 출고처코드
      const storeName = (row[4] || '').toString(); // E열: 출고처명
      
      // 더 정확한 매칭 로직
      const isMatch = storeCode.includes(code) || 
                     storeName.includes(code) ||
                     (code === 'VIP(경수)' && (storeName.includes('경수') || storeCode.includes('경수'))) ||
                     (code === 'VIP(경인)' && (storeName.includes('경인') || storeCode.includes('경인'))) ||
                     (code === 'VIP(호남)' && (storeName.includes('호남') || storeCode.includes('호남')));
      
      if (isMatch) {
        count++;
        if (index < 5) {
          console.log(`🔍 [등록점계산] ${code} 매칭 (행 ${index}):`, { storeCode, storeName });
        }
      }
    }
  });
  
  console.log(`🔍 [등록점계산] ${code}: ${count}개`);
  return count;
}

// 가동점 계산 함수
function calculateActiveStores(code, inventoryData) {
  if (!inventoryData) return 0;
  
  const activeStores = new Set();
  console.log(`🔍 [가동점계산] ${code} 검색 시작`);
  
  inventoryData.forEach((row, index) => {
    if (row.length > 4) {
      const storeName = (row[4] || '').toString(); // E열: 출고처명
      const quantity = parseFloat(row[5] || 0); // F열: 수량
      
      // 더 정확한 매칭 로직
      const isMatch = storeName.includes(code) ||
                     (code === 'VIP(경수)' && storeName.includes('경수')) ||
                     (code === 'VIP(경인)' && storeName.includes('경인')) ||
                     (code === 'VIP(호남)' && storeName.includes('호남'));
      
      if (isMatch && quantity > 0) {
        activeStores.add(storeName);
        if (index < 5) {
          console.log(`🔍 [가동점계산] ${code} 매칭 (행 ${index}):`, { storeName, quantity });
        }
      }
    }
  });
  
  console.log(`🔍 [가동점계산] ${code}: ${activeStores.size}개`);
  return activeStores.size;
}

// 보유단말, 보유유심 계산 함수
function calculateDeviceSimData(code, inventoryData) {
  if (!inventoryData) return { devices: 0, sims: 0 };
  
  let devices = 0;
  let sims = 0;
  
  inventoryData.forEach(row => {
    if (row.length > 4) {
      const storeName = (row[4] || '').toString(); // E열: 출고처명
      const quantity = parseFloat(row[5] || 0); // F열: 수량
      
      if (storeName.includes(code)) {
        // 단말기와 유심 구분 (임시로 단말기로 계산)
        devices += quantity;
        sims += quantity; // 실제로는 유심 데이터가 별도로 있어야 함
      }
    }
  });
  
  console.log(`🔍 [보유단말계산] ${code}: 단말 ${devices}개, 유심 ${sims}개`);
  return { devices, sims };
}

// 매핑 실패 데이터 찾기
function findMappingFailures(phoneklData, storeData) {
  const failures = [];
  const failureMap = new Map();
  
  phoneklData.forEach(row => {
    if (row.length > 14) {
      const storeCode = (row[14] || '').toString(); // O열: 출고처
      const agent = (row[8] || '').toString(); // I열: 담당자
      
      if (storeCode && !findStoreInData(storeCode, storeData)) {
        const key = `${storeCode}_${agent}`;
        if (!failureMap.has(key)) {
          failureMap.set(key, {
            storeCode,
            agent,
            reason: '출고처 매핑 실패',
            count: 0
          });
        }
        failureMap.get(key).count++;
      }
    }
  });
  
  return Array.from(failureMap.values());
}

// 실제 데이터에서 담당자-코드 조합 추출
function extractAgentCodeCombinations(phoneklData) {
  const combinations = new Map();
  
  phoneklData.forEach(row => {
    const agent = (row[8] || '').toString().trim(); // I열: 담당자
    const code = (row[4] || '').toString().trim(); // E열: 코드명
    
    // 헤더 제외
    if (agent === '담당자' || code === '코드명') return;
    
    if (agent && code) {
      const key = `${agent}|${code}`;
      if (!combinations.has(key)) {
        combinations.set(key, {
          agent,
          code,
          displayName: `${agent} (${code})`
        });
      }
    }
  });
  
  return Array.from(combinations.values());
}

// 출고처 데이터에서 매칭 찾기
function findStoreInData(storeCode, storeData) {
  if (!storeData) return false;
  
  return storeData.some(row => {
    if (row.length > 14) {
      const code = (row[14] || '').toString(); // O열: 출고처코드
      return code === storeCode;
    }
    return false;
  });
}

// 목표 설정 API
app.post('/api/closing-chart/targets', async (req, res) => {
  try {
    const { targets } = req.body;
    
    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({ error: '목표 데이터가 올바르지 않습니다.' });
    }
    
    // 헤더 설정
    const headerData = [
      ['담당자명', '코드명', '목표값', '제외여부']
    ];
    
    // 헤더 먼저 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '영업사원목표!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: headerData
      }
    });
    
    // 영업사원목표 시트에 저장
    const targetData = targets.map(target => [
      target.agent, // A열: 담당자명
      target.code, // B열: 코드명
      target.target, // C열: 목표값
      target.excluded ? 'Y' : 'N' // D열: 제외여부
    ]);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '영업사원목표!A2',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: targetData
      }
    });
    
    // 캐시 무효화
    cacheUtils.cleanup();
    
    res.json({ success: true, message: '목표가 성공적으로 저장되었습니다.' });
    
  } catch (error) {
    console.error('목표 설정 오류:', error);
    res.status(500).json({ error: '목표 설정 중 오류가 발생했습니다.' });
  }
});

// 매핑 실패 데이터 조회 API
app.get('/api/closing-chart/mapping-failures', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const phoneklData = await getSheetValues('폰클개통데이터');
    const storeData = await getSheetValues('폰클출고처데이터');
    
    const failures = findMappingFailures(phoneklData, storeData);
    
    res.json({ failures });
    
  } catch (error) {
    console.error('매핑 실패 데이터 조회 오류:', error);
    res.status(500).json({ error: '매핑 실패 데이터 조회 중 오류가 발생했습니다.' });
  }
});

// 담당자-코드 조합 추출 API
app.get('/api/closing-chart/agent-code-combinations', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // 폰클개통데이터 가져오기
    const phoneklData = await getSheetValues('폰클개통데이터');
    
    if (!phoneklData || phoneklData.length < 2) {
      return res.json({ combinations: [] });
    }
    
    // 헤더 제외하고 데이터만 처리
    const dataRows = phoneklData.slice(1);
    
    // 실제 데이터에서 담당자-코드 조합 추출
    const combinations = extractAgentCodeCombinations(dataRows);
    
    // 기존 목표값 데이터 가져오기
    const targetData = await getSheetValues('영업사원목표');
    const existingTargets = new Map();
    
    if (targetData && targetData.length > 1) {
      targetData.slice(1).forEach(row => {
        const agent = row[0] || '';
        const code = row[1] || '';
        const target = parseInt(row[2]) || 0;
        const excluded = row[3] === 'Y';
        const key = `${agent}|${code}`;
        existingTargets.set(key, { agent, code, target, excluded });
      });
    }
    
    // 조합에 기존 목표값 병합
    const result = combinations.map(combo => {
      const key = `${combo.agent}|${combo.code}`;
      const existing = existingTargets.get(key);
      
      return {
        agent: combo.agent,
        code: combo.code,
        target: existing ? existing.target : 0,
        excluded: existing ? existing.excluded : false
      };
    });
    
    // 담당자-코드조합 추출 완료 (로그 제거)
    
    res.json({ combinations: result });
    
  } catch (error) {
    console.error('담당자-코드 조합 추출 오류:', error);
    res.status(500).json({ error: '담당자-코드 조합 추출 중 오류가 발생했습니다.' });
  }
});

// 전체 재계산 API - 기존 저장 버튼 로직을 배치로 재실행 (SS 레벨 이상만 접근 가능)
app.post('/api/budget/recalculate-all', async (req, res) => {
  try {
    console.log('🔄 [전체재계산] 시작 - 기존 저장 버튼 로직 배치 실행');
    
    // 권한 체크: SS 레벨 이상만 전체재계산 가능
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
    }
    
    // 사용자 권한 확인
    const userRole = await getUserRole(userId);
    if (!userRole || (userRole !== 'SS' && userRole !== 'S')) {
      console.log(`⚠️ [전체재계산] 권한 부족: ${userId} (${userRole})`);
      return res.status(403).json({ 
        error: '전체재계산은 SS 레벨 이상만 가능합니다.',
        userRole: userRole 
      });
    }
    
    console.log(`✅ [전체재계산] 권한 확인 완료: ${userId} (${userRole})`);
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 1. 모든 대상월 시트 조회
    const monthSheetsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '예산_대상월관리!A:D',
    });

    const monthRows = monthSheetsData.data.values || [];
    const results = [];
    
    // 2. 각 대상월별로 처리 (헤더 제외)
    for (const monthRow of monthRows.slice(1)) { // 첫 번째 행(헤더) 제외
      if (!monthRow[0] || !monthRow[1]) continue; // 빈 행 스킵
      
      const targetMonth = monthRow[0];
      const sheetId = monthRow[1];
      
      console.log(`🔄 [전체재계산] ${targetMonth}월 처리 시작 (시트ID: ${sheetId})`);
      
      try {
        // 3. 메인 스프레드시트에서 해당 월의 모든 사용자 시트 조회
        const userSheetsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '예산_사용자시트관리!A:AA',
        });
        
        const userSheetRows = userSheetsResponse.data.values || [];
        
        // 4. 해당 월의 사용자 시트만 필터링
        const targetMonthUserSheets = userSheetRows.filter(row => {
          if (!row[0] || !row[1] || !row[5]) return false; // 사용자ID, 시트ID, 대상월이 있는지 확인
          return row[5] === targetMonth; // 대상월이 일치하는지 확인
        });
        
        console.log(`🔄 [전체재계산] ${targetMonth}월 - ${targetMonthUserSheets.length}개 사용자 시트 발견`);
        
        // 5. 각 사용자 시트별로 재계산
        for (const userRow of targetMonthUserSheets) {
          if (!userRow[0] || !userRow[1]) continue; // 빈 행 스킵
          
          const sheetName = userRow[2]; // C열: 시트명
          // 시트 이름에서 예산 타입 추출 (예: "액면_홍기현(Ⅰ) (팀장)" → "Ⅰ")
          let budgetType = 'Ⅰ'; // 기본값
          if (sheetName && sheetName.includes('(') && sheetName.includes(')')) {
            const match = sheetName.match(/\(([ⅠⅡ종합]+)\)/);
            if (match) {
              budgetType = match[1];
            }
          }
          
          console.log(`🔄 [전체재계산] ${targetMonth}월 - ${sheetName} (${budgetType}) 기존 저장 버튼 로직 재실행`);
          
          try {
            // 5. 사용자 시트에서 입력 데이터 로드 (기존 저장 버튼과 동일한 방식)
            const userSheetDataResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${sheetName}!A:L`
            });
            
            const userSheetData = userSheetDataResponse.data.values || [];
            
            if (userSheetData.length <= 1) {
              console.log(`⚠️ [전체재계산] ${sheetName}: 사용자 시트 데이터 부족`);
              continue;
            }
            
            // 6. 기존 저장 버튼과 동일한 방식으로 데이터 변환
            const data = [];
            const modelGroups = {};
            
            // 헤더 제외하고 데이터 처리
            userSheetData.slice(1).forEach(row => {
              if (row.length >= 12) {
                const modelName = row[5]; // F열: 모델명
                const armyType = row[6]; // G열: 군
                const categoryType = row[7]; // H열: 유형
                const usedBudget = parseFloat((row[9] || '').toString().replace(/,/g, '')) || 0; // J열: 사용된 예산
                
                if (modelName && armyType && categoryType) {
                  if (!modelGroups[modelName]) {
                    modelGroups[modelName] = {
                      modelName,
                      expenditureValues: new Array(18).fill(0)
                    };
                  }
                  
                  // 군/유형별 인덱스 계산
                  const armyIndex = ['S군', 'A군', 'B군', 'C군', 'D군', 'E군'].indexOf(armyType);
                  const categoryIndex = ['신규', 'MNP', '보상'].indexOf(categoryType);
                  
                  if (armyIndex !== -1 && categoryIndex !== -1) {
                    const columnIndex = armyIndex * 3 + categoryIndex;
                    modelGroups[modelName].expenditureValues[columnIndex] = Math.round(usedBudget / 10000);
                  }
                }
              }
            });
            
            // 모델 그룹을 배열로 변환
            Object.values(modelGroups).forEach(group => {
              data.push(group);
            });
            
            if (data.length === 0) {
              console.log(`⚠️ [전체재계산] ${sheetName}: 변환된 데이터 없음`);
              continue;
            }
            
            // 7. 메타데이터 추출 (기존 저장 버튼과 동일)
            let dateRange = {
              receiptStartDate: '',
              receiptEndDate: '',
              activationStartDate: '',
              activationEndDate: ''
            };
            
            // 첫 번째 데이터 행에서 날짜 정보 추출
            if (userSheetData.length > 1) {
              const firstDataRow = userSheetData[1];
              if (firstDataRow.length >= 4) {
                dateRange.receiptStartDate = firstDataRow[0] || ''; // A열: 접수시작일
                dateRange.receiptEndDate = firstDataRow[1] || ''; // B열: 접수종료일
                dateRange.activationStartDate = firstDataRow[2] || ''; // C열: 개통시작일
                dateRange.activationEndDate = firstDataRow[3] || ''; // D열: 개통종료일
              }
            }
            
            // calculateUsageBudget 함수가 기대하는 형식으로 변환
            const calculateDateRange = {
              startDate: dateRange.receiptStartDate || dateRange.activationStartDate,
              endDate: dateRange.receiptEndDate || dateRange.activationEndDate
            };
            
            // 입력자 정보 추출
            let inputUserName = '';
            if (userSheetData.length > 1) {
              const firstDataRow = userSheetData[1];
              if (firstDataRow.length >= 5) {
                const inputUser = firstDataRow[4]; // E열: 입력자(권한레벨)
                if (inputUser) {
                  // "홍기현(레벨SS)" 형태에서 "홍기현" 추출
                  inputUserName = inputUser.replace(/\(레벨[^)]+\)/, '').trim();
                }
              }
            }
            
            // 8. 기존 저장 버튼과 동일한 방식으로 사용자 시트에 데이터 저장
            console.log(`🔄 [전체재계산] ${sheetName}: 사용자 시트 데이터 저장 시작`);
            
            // 기존 저장 버튼과 동일한 방식으로 데이터 변환
            const rowsToSave = [];
            
            data.forEach(item => {
              if (item.modelName && item.expenditureValues) {
                // 18개 컬럼의 지출예산 값을 각각 개별 행으로 저장
                item.expenditureValues.forEach((expenditureValue, index) => {
                  // 모델명이 있으면 모든 행을 저장 (값이 0이어도 포함)
                  const armyType = getArmyType(index + 1);
                  const categoryType = getCategoryType(index + 1);
                  
                  // 해당 군의 예산금액 가져오기 (예산타입에 따른 기본값 적용)
                  const defaultAmount = budgetType === 'Ⅱ' ? 0 : 40000;
                  const securedBudget = defaultAmount;
                  
                  // 지출예산을 1만원 단위에서 원 단위로 변환 (예: 2 -> 20000, -2 -> -20000)
                  const usedBudget = expenditureValue * 10000;
                  
                  // 예산 잔액 계산
                  const remainingBudget = securedBudget - usedBudget;
                  
                  rowsToSave.push([
                    dateRange.receiptStartDate || '', // A열: 접수일 시작
                    dateRange.receiptEndDate || '', // B열: 접수일 종료
                    dateRange.activationStartDate || '', // C열: 개통일 시작
                    dateRange.activationEndDate || '', // D열: 개통일 종료
                    `${inputUserName}(레벨SS)`, // E열: 입력자(권한레벨)
                    item.modelName, // F열: 모델명
                    armyType, // G열: 군
                    categoryType, // H열: 유형
                    securedBudget, // I열: 확보된 예산 (원 단위)
                    usedBudget, // J열: 사용된 예산 (원 단위)
                    remainingBudget, // K열: 예산 잔액 (원 단위)
                    '정상' // L열: 상태
                  ]);
                });
              }
            });
            
            // 사용자 시트에 데이터 누적 저장 (기존 데이터 유지하고 새 데이터 추가)
            if (rowsToSave.length > 0) {
              // 헤더가 없으면 헤더 추가
              let existingData = [];
              try {
                const existingResponse = await sheets.spreadsheets.values.get({
                  spreadsheetId: sheetId,
                  range: `${sheetName}!A:L`
                });
                existingData = existingResponse.data.values || [];
              } catch (error) {
                console.log(`📋 [전체재계산] ${sheetName}: 기존 데이터 없음, 새로 생성`);
              }
              
              // 헤더가 없으면 헤더 추가
              if (existingData.length === 0) {
                const headerRow = [
                  '접수시작일', '접수종료일', '개통시작일', '개통종료일', 
                  '입력자(권한레벨)', '모델명', '군', '유형', 
                  '확보된 예산', '사용된 예산', '예산 잔액', '상태'
                ];
                
                await sheets.spreadsheets.values.update({
                  spreadsheetId: sheetId,
                  range: `${sheetName}!A1:L1`,
                  valueInputOption: 'RAW',
                  resource: {
                    values: [headerRow]
                  }
                });
              }
              
              // 새 데이터를 기존 데이터 아래에 추가 (append 방식)
              await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: `${sheetName}!A:L`,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                  values: rowsToSave
                }
              });
              
              console.log(`✅ [전체재계산] ${sheetName}: 사용자 시트 데이터 누적 저장 완료 (기존 ${existingData.length}행 + 새 ${rowsToSave.length}행)`);
            }
            
            // 8-1. 기존 시트 컬럼 확장 확인 및 확장 (X열까지)
            try {
              const sheetInfo = await sheets.spreadsheets.get({
                spreadsheetId: sheetId
              });
              
              const targetSheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);
              if (targetSheet && targetSheet.properties.gridProperties.columnCount < 24) {
                console.log(`🔄 [전체재계산] ${sheetName}: 컬럼 수 확장 필요 (현재: ${targetSheet.properties.gridProperties.columnCount}, 목표: 24)`);
                
                await sheets.spreadsheets.batchUpdate({
                  spreadsheetId: sheetId,
                  resource: {
                    requests: [{
                      updateDimensionProperties: {
                        range: {
                          sheetId: targetSheet.properties.sheetId,
                          dimension: 'COLUMNS',
                          startIndex: 0,
                          endIndex: 24
                        },
                        properties: {
                          pixelSize: 100
                        },
                        fields: 'pixelSize'
                      }
                    }]
                  }
                });
                
                console.log(`✅ [전체재계산] ${sheetName}: 컬럼 수 확장 완료 (24개)`);
              }
            } catch (expandError) {
              console.log(`⚠️ [전체재계산] ${sheetName}: 컬럼 확장 실패 (무시하고 진행):`, expandError.message);
            }
            
            // 8-2. 메타데이터 저장 (기존 값 보존, 예산 관련 컬럼만 업데이트)
            console.log(`💾 [전체재계산] ${sheetName}: 메타데이터 업데이트 시작`);
            
            // 기존 메타데이터 읽기 (O열~X열)
            let existingMetadataForUpdate = [];
            try {
              const existingMetadataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${sheetName}!O:X`
              });
              existingMetadataForUpdate = existingMetadataResponse.data.values || [];
            } catch (error) {
              console.log(`📋 [전체재계산] ${sheetName}: 기존 메타데이터 없음, 새로 생성`);
            }
            
            // 헤더가 없으면 헤더 추가
            if (existingMetadataForUpdate.length === 0) {
              existingMetadataForUpdate = [
                ['저장일시', '접수일범위', '개통일범위', '접수일적용여부', '계산일시', '계산자', '정책그룹', '잔액', '확보', '사용']
              ];
            }
            
            // 기존 데이터 행이 없으면 빈 행 추가
            if (existingMetadataForUpdate.length === 1) {
              existingMetadataForUpdate.push(['', '', '', '', '', '', '', '', '', '']);
            }
            
            // 기존 메타데이터 보존하면서 필요한 부분만 업데이트
            const updatedMetadata = [
              existingMetadataForUpdate[0], // 헤더는 그대로
              [
                existingMetadataForUpdate[1]?.[0] || new Date().toISOString(), // O열: 저장일시 (기존 값 보존, 없으면 현재 시간)
                existingMetadataForUpdate[1]?.[1] || `${dateRange.receiptStartDate} ~ ${dateRange.receiptEndDate}`, // P열: 접수일범위 (기존 값 보존)
                existingMetadataForUpdate[1]?.[2] || `${dateRange.activationStartDate} ~ ${dateRange.activationEndDate}`, // Q열: 개통일범위 (기존 값 보존)
                existingMetadataForUpdate[1]?.[3] || '적용', // R열: 접수일적용여부 (기존 값 보존)
                new Date().toISOString(), // S열: 계산일시 (현재 시간으로 업데이트)
                existingMetadataForUpdate[1]?.[5] || inputUserName, // T열: 계산자 (기존 값 보존, 없으면 현재 사용자)
                existingMetadataForUpdate[1]?.[6] || policyGroupString, // U열: 정책그룹 (기존 값 보존, 없으면 현재 정책그룹)
                '', // V열: 잔액 (나중에 계산 결과로 업데이트)
                '', // W열: 확보 (나중에 계산 결과로 업데이트)
                ''  // X열: 사용 (나중에 계산 결과로 업데이트)
              ]
            ];
            
            // 메타데이터 업데이트
            await sheets.spreadsheets.values.update({
              spreadsheetId: sheetId,
              range: `${sheetName}!O1:X2`,
              valueInputOption: 'RAW',
              resource: {
                values: updatedMetadata
              }
            });
            
            console.log(`✅ [전체재계산] ${sheetName}: 메타데이터 업데이트 완료 (기존 값 보존)`);
            
            // 9. 액면예산 시트 부분 영역 초기화 (올바른 컬럼 범위)
            console.log(`🔄 [전체재계산] ${sheetName}: 액면예산 시트 부분 영역 초기화 시작`);
            
                  if (budgetType === 'Ⅱ') {
              // 액면예산(Ⅱ): B5:C열(입력자/입력일시), I5:K열(예산 관련)
              await sheets.spreadsheets.values.clear({
                spreadsheetId: sheetId,
                range: '액면예산!B5:C'
              });
              await sheets.spreadsheets.values.clear({
                spreadsheetId: sheetId,
                range: '액면예산!I5:K'
              });
              console.log(`🧹 [전체재계산] ${sheetName}: 액면예산 시트 B5:C열, I5:K열 초기화 완료`);
            } else {
              // 액면예산(Ⅰ): D5:E열(입력자/입력일시), L5:N열(예산 관련)
              await sheets.spreadsheets.values.clear({
                spreadsheetId: sheetId,
                range: '액면예산!D5:E'
              });
              await sheets.spreadsheets.values.clear({
                spreadsheetId: sheetId,
                range: '액면예산!L5:N'
              });
              console.log(`🧹 [전체재계산] ${sheetName}: 액면예산 시트 D5:E열, L5:N열 초기화 완료`);
            }
            
                        // 10. 기존 calculateUsageBudget 함수 호출 (액면예산 계산 + 입력)
            console.log(`🔄 [전체재계산] ${sheetName}: 액면예산 계산 시작`);
            
            // 기존 저장 버튼과 동일한 매개변수로 calculateUsageBudget 호출
            // 정책그룹을 실제 사용자 시트에서 읽어오기
            let policyGroupString = userRow[6]; // G열: 선택된정책그룹
            if (!policyGroupString) {
              // 정책그룹이 없으면 기본값 사용 (디버깅용)
              policyGroupString = '홍기현직영,홍기현별도,홍기현,평택사무실,임재욱별도,임재욱,이은록,양진영별도,양진영,이덕제,김일환,김일환별도';
              console.log(`⚠️ [전체재계산] ${sheetName}: 정책그룹 정보 없음, 기본값 사용: ${policyGroupString}`);
            } else {
              console.log(`📋 [전체재계산] ${sheetName}: 정책그룹 정보: ${policyGroupString}`);
            }
            const selectedPolicyGroups = policyGroupString.split(',').map(group => group.trim());
            console.log(`🔍 [전체재계산] ${sheetName}: 파싱된 정책그룹:`, selectedPolicyGroups);
            
            const calculationResult = await calculateUsageBudget(
              sheetId, 
              selectedPolicyGroups, 
              calculateDateRange, 
              inputUserName, 
              budgetType
            );
            
            console.log(`✅ [전체재계산] ${sheetName}: 액면예산 계산 완료`);
            
            // 9-1. 액면예산 시트 부분 영역 초기화 (올바른 순서로 수정)
            // calculateUsageBudget 호출 후 초기화는 불필요 (이미 데이터 입력됨)
            console.log(`🧹 [전체재계산] ${sheetName}: 액면예산 시트 업데이트 완료 (calculateUsageBudget에서 처리됨)`);
            
            // 9-2. 기존 저장 버튼과 동일하게 사용자 시트 업데이트 수행
            console.log(`🔄 [전체재계산] ${sheetName}: 사용자 시트 업데이트 시작`);
            
            // 사용자 시트에서 데이터 가져오기 (업데이트용)
            const userSheetUpdateResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: `${sheetName}!A2:L`, // 사용자 시트 데이터 범위 (12개 컬럼)
            });
            
            const userSheetUpdateRows = userSheetUpdateResponse.data.values || [];
            
            // 9-3. 계산 결과를 사용자 시트 메타데이터에 누적 저장 (O열~X열)
            console.log(`💾 [전체재계산] ${sheetName}: 계산 결과 메타데이터 누적 저장 시작`);
            
            // 기존 메타데이터 읽기 (O열~X열)
            let existingMetadataForCalculation = [];
            try {
              const metadataResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${sheetName}!O:X`
              });
              existingMetadataForCalculation = metadataResponse.data.values || [];
            } catch (error) {
              console.log(`📋 [전체재계산] ${sheetName}: 기존 메타데이터 없음, 새로 생성`);
            }
            
            // 헤더 설정 (O열~X열)
            const metadataHeader = [
              '저장일시', '접수일범위', '개통일범위', '접수일적용여부', 
              '계산일시', '계산자', '정책그룹', '잔액', '확보', '사용'
            ];
            
            // 새 정책 데이터 행 생성
            const newPolicyRow = [
              new Date().toISOString(),           // O열: 저장일시
              calculateDateRange.receiptStartDate && calculateDateRange.receiptEndDate 
                ? `${calculateDateRange.receiptStartDate} ~ ${calculateDateRange.receiptEndDate}` 
                : '미설정',                       // P열: 접수일범위
              `${calculateDateRange.activationStartDate} ~ ${calculateDateRange.activationEndDate}`, // Q열: 개통일범위
              calculateDateRange.receiptStartDate && calculateDateRange.receiptEndDate 
                ? '적용' 
                : '미적용',                       // R열: 접수일적용여부
              new Date().toISOString(),           // S열: 계산일시
              inputUserName,                      // T열: 계산자
              selectedPolicyGroups.join(','),     // U열: 정책그룹
              calculationResult.totalRemainingBudget, // V열: 잔액
              calculationResult.totalSecuredBudget,   // W열: 확보
              calculationResult.totalUsedBudget       // X열: 사용
            ];
            
            // 메타데이터 업데이트 (기존 데이터 유지하고 새 행 추가)
            const metadataUpdateRequests = [];
            
            // 헤더가 없으면 헤더 추가
            if (existingMetadataForCalculation.length === 0) {
              metadataUpdateRequests.push({
                range: `${sheetName}!O1:X1`,
                values: [metadataHeader]
              });
            }
            
            // 새 정책 데이터 행 추가
            metadataUpdateRequests.push({
              range: `${sheetName}!O${existingMetadataForCalculation.length + 2}:X${existingMetadataForCalculation.length + 2}`,
              values: [newPolicyRow]
            });
            
            // 메타데이터 업데이트 실행
            if (metadataUpdateRequests.length > 0) {
              await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: sheetId,
                resource: {
                  valueInputOption: 'RAW',
                  data: metadataUpdateRequests
                }
              });
              console.log(`✅ [전체재계산] ${sheetName}: 메타데이터 누적 저장 완료 (${existingMetadataForCalculation.length + 1}번째 정책)`);
            }
            
            // 액면예산 타입에 따른 액면예산 매핑 컬럼 결정
            const currentBudgetType = budgetType || 'Ⅰ';
            let phoneklColumns = {};
            
            if (currentBudgetType === 'Ⅰ') {
              // 액면예산(Ⅰ): L열(예산잔액), M열(확보예산), N열(사용예산)
              phoneklColumns = {
                remainingBudget: 'L', // 예산잔액
                securedBudget: 'M',   // 확보예산
                usedBudget: 'N'       // 사용예산
              };
            } else if (currentBudgetType === 'Ⅱ') {
              // 액면예산(Ⅱ): I열(예산잔액), J열(확보예산), K열(사용예산)
              phoneklColumns = {
                remainingBudget: 'I', // 예산잔액
                securedBudget: 'J',   // 확보예산
                usedBudget: 'K'       // 사용예산
              };
            }
            
            // 액면예산에서 계산된 데이터를 사용자 시트의 사용예산에 반영
            const updateRequests = [];
            
            // calculateUsageBudget 결과에서 calculatedData 확인
            console.log(`🔍 [전체재계산] ${sheetName}: calculationResult 확인:`, {
              calculatedDataLength: calculationResult.calculatedData?.length || 0,
              totalRemainingBudget: calculationResult.totalRemainingBudget,
              totalSecuredBudget: calculationResult.totalSecuredBudget,
              totalUsedBudget: calculationResult.totalUsedBudget
            });
            
            userSheetUpdateRows.forEach((row, index) => {
              if (row.length >= 12) {
                const armyType = row[6]; // 군 (G열)
                const categoryType = row[7]; // 유형 (H열)
                
                // 액면예산에서 해당 군/유형에 맞는 사용예산 찾기
                const matchingData = calculationResult.calculatedData?.find(data => 
                  data.armyType === armyType && data.categoryType === categoryType
                );
                
                if (matchingData) {
                  // 사용예산 업데이트 (J열)
                  updateRequests.push({
                    range: `${sheetName}!J${index + 2}`,
                    values: [[matchingData.budgetValue]]
                  });
                  
                  // 잔액 업데이트 (K열) - 예산타입에 따른 확보예산
                  const defaultSecuredBudget = budgetType === 'Ⅱ' ? 0 : 40000;
                  const securedBudget = defaultSecuredBudget;
                  const remainingBudget = securedBudget - matchingData.budgetValue;
                  updateRequests.push({
                    range: `${sheetName}!K${index + 2}`,
                    values: [[remainingBudget]]
                  });
                  
                  console.log(`💾 [전체재계산] ${sheetName} Row ${index + 2} 업데이트: 사용예산=${matchingData.budgetValue}, 잔액=${remainingBudget}`);
                  } else {
                  console.log(`⚠️ [전체재계산] ${sheetName} Row ${index + 2} 매칭 실패: 군=${armyType}, 유형=${categoryType}`);
                }
              }
            });
            
            // 사용자 시트 업데이트
            if (updateRequests.length > 0) {
              console.log(`🚀 [전체재계산] ${sheetName} 배치 업데이트 실행: ${updateRequests.length}개 셀`);
              
              try {
                await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId: sheetId,
                  resource: {
                    valueInputOption: 'RAW',
                    data: updateRequests
                  }
                });
                
                console.log(`✅ [전체재계산] ${sheetName} 배치 업데이트 성공: ${updateRequests.length}개 셀`);
              } catch (error) {
                console.error(`❌ [전체재계산] ${sheetName} 배치 업데이트 실패:`, error);
                throw error;
              }
            }
            
            // 11. 결과 저장 (기존 저장 버튼과 동일한 방식)
            results.push({
              month: targetMonth,
              sheetName,
              budgetType,
              totalRemainingBudget: calculationResult.totalRemainingBudget,
              totalSecuredBudget: calculationResult.totalSecuredBudget,
              totalUsedBudget: calculationResult.totalUsedBudget,
              updatedRows: updateRequests.length,
              success: true
            });
            
            console.log(`✅ [전체재계산] ${sheetName} 완료: 잔액=${calculationResult.totalRemainingBudget}, 확보=${calculationResult.totalSecuredBudget}, 사용=${calculationResult.totalUsedBudget}, 매칭행=${updateRequests.length}`);
            
          } catch (userSheetError) {
            console.error(`❌ [전체재계산] ${sheetName} 처리 실패:`, userSheetError.message);
            results.push({
              month: targetMonth,
              sheetName,
              budgetType,
              success: false,
              error: userSheetError.message
            });
          }
        }
        
      } catch (monthError) {
        console.error(`❌ [전체재계산] ${targetMonth}월 처리 실패:`, monthError.message);
        results.push({
          month: targetMonth,
          success: false,
          error: monthError.message
        });
      }
    }
    
    console.log(`🔄 [전체재계산] 완료 - 총 ${results.length}개 시트 처리`);
    
    res.json({
      success: true,
      message: '전체 재계산이 완료되었습니다.',
      results
    });
    
  } catch (error) {
    console.error('❌ [전체재계산] 오류:', error);
    res.status(500).json({
      success: false,
      error: '전체 재계산 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 스케줄러 설정 - 매일 새벽 2시에 자동 재계산 (클라우드타입 패키지 문제로 임시 비활성화)
// cron.schedule('0 2 * * *', async () => {
//   try {
//     console.log('🕐 [스케줄러] 자동 재계산 시작');
//     
//     // 전체 재계산 API 호출
//     const response = await fetch('http://localhost:4000/api/budget/recalculate-all', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       }
//     });
//     
//     if (response.ok) {
//       const result = await response.json();
//       console.log('✅ [스케줄러] 자동 재계산 완료:', result.message);
//     } else {
//       console.error('❌ [스케줄러] 자동 재계산 실패:', response.status);
//     }
//     
//   } catch (error) {
//     console.error('❌ [스케줄러] 자동 재계산 오류:', error);
//   }
// }, {
//   timezone: 'Asia/Seoul'
// });

// console.log('🕐 [스케줄러] 매일 새벽 2시 자동 재계산 설정 완료');

// ===== 재고회수모드 API =====

// 재고회수 데이터 조회 API
app.get('/api/inventory-recovery/data', async (req, res) => {
  console.log('🔍 [재고회수 API] 요청 받음 - 시작');
  console.log('🔍 [재고회수 API] 요청 헤더:', req.headers);
  console.log('🔍 [재고회수 API] 요청 URL:', req.url);
  console.log('🔍 [재고회수 API] 요청 메서드:', req.method);
  
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000'
  ];
  
  const origin = req.headers.origin;
  console.log('🔍 [재고회수 API] Origin:', origin);
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log('🔍 [재고회수 API] CORS 허용된 Origin 사용:', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
    console.log('🔍 [재고회수 API] CORS * 사용');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    console.log('🔍 [재고회수 API] OPTIONS 요청 - 200 응답');
    res.sendStatus(200);
    return;
  }
  
  try {
    console.log('🔄 [재고회수] 데이터 조회 시작');
    
    // 회수목록 시트만 가져오기 (좌표는 "회수목록" 시트에서 직접 읽기)
    console.log('🔍 [재고회수 API] Google Sheets API 호출 시작');
    console.log('🔍 [재고회수 API] Spreadsheet ID:', process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY');
    console.log('🔍 [재고회수 API] Sheet Name:', process.env.INVENTORY_RECOVERY_SHEET_NAME || '회수목록');
    
    const recoveryListResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
      range: (process.env.INVENTORY_RECOVERY_SHEET_NAME || '회수목록') + '!A:AA'
    });

    console.log('🔍 [재고회수 API] Google Sheets API 응답 받음');
    console.log('🔍 [재고회수 API] 응답 데이터 존재 여부:', !!recoveryListResponse.data.values);
    console.log('🔍 [재고회수 API] 응답 데이터 길이:', recoveryListResponse.data.values?.length || 0);

    if (!recoveryListResponse.data.values) {
      console.error('❌ [재고회수 API] 데이터를 가져올 수 없습니다.');
      throw new Error('데이터를 가져올 수 없습니다.');
    }

    // 헤더 제거
    const recoveryData = recoveryListResponse.data.values.slice(1);

    // 회수 데이터 처리
    console.log(`🔍 [재고회수] 원본 데이터: ${recoveryData.length}행`);
    
    const processedData = recoveryData
      .filter(row => {
        const hasEnoughColumns = row.length > 25;
        if (!hasEnoughColumns) {
          console.log(`⚠️ [재고회수] 컬럼 부족: ${row.length}개 (필요: 26개)`);
        }
        return hasEnoughColumns;
      })
      .map((row, index) => {
        const storeName = (row[25] || '').toString().trim(); // Z열(25번인덱스): 출고처(업체명)
        const latitude = parseFloat(row[8] || '0'); // I열(8번인덱스): 위도
        const longitude = parseFloat(row[9] || '0'); // J열(9번인덱스): 경도
        
        const item = {
          recoveryCompleted: row[10] || '', // K열(10번인덱스): 회수완료
          recoveryTargetSelected: row[11] || '', // L열(11번인덱스): 회수대상선정
          manager: row[12] || '', // M열(12번인덱스): 담당자
          address: row[7] || '', // H열(7번인덱스): 주소
          entryDate: row[13] || '', // N열(13번인덱스): 입고일
          status: row[14] || '', // O열(14번인덱스): 현황
          serialNumber: row[15] || '', // P열(15번인덱스): 일련번호
          category: row[16] || '', // Q열(16번인덱스): 종류
          modelName: row[17] || '', // R열(17번인덱스): 모델명
          color: row[18] || '', // S열(18번인덱스): 색상
          deviceStatus: row[19] || '', // T열(19번인덱스): 상태
          payment: row[20] || '', // U열(20번인덱스): 결제
          entryPrice: row[21] || '', // V열(21번인덱스): 입고가
          entrySource: row[22] || '', // W열(22번인덱스): 입고처
          carrier: row[23] || '', // X열(23번인덱스): 통신사
          employee: row[24] || '', // Y열(24번인덱스): 담당사원
          storeName, // Z열(25번인덱스): 출고처(업체명)
          recentShipmentDate: row[26] || '', // AA열(26번인덱스): 최근출고일
          latitude: latitude,
          longitude: longitude,
          hasCoordinates: latitude !== 0 && longitude !== 0,
          rowIndex: recoveryData.indexOf(row) + 2 // 실제 시트 행 번호 (헤더 제외)
        };
        
        console.log(`🔍 [재고회수] 행${index + 1}: ${storeName} (${latitude}, ${longitude})`);
        return item;
      })
      .filter(item => {
        const hasStoreName = item.storeName && item.storeName.length > 0;
        
        if (!hasStoreName) {
          console.log(`⚠️ [재고회수] 업체명 누락: ${JSON.stringify(item)}`);
        }
        
        return hasStoreName; // 좌표가 없어도 업체명만 있으면 포함
      });

    console.log(`✅ [재고회수] 데이터 조회 완료: ${processedData.length}개 항목`);
    console.log('🔍 [재고회수 API] 응답 데이터 샘플:', processedData.slice(0, 2));
    
    res.json({
      success: true,
      data: processedData
    });
    
    console.log('🔍 [재고회수 API] 응답 전송 완료');
    
  } catch (error) {
    console.error('❌ [재고회수] 데이터 조회 오류:', error);
    console.error('❌ [재고회수 API] 에러 스택:', error.stack);
    console.error('❌ [재고회수 API] 에러 메시지:', error.message);
    
    res.status(500).json({
      success: false,
      error: '재고회수 데이터 조회에 실패했습니다.',
      message: error.message
    });
  }
});

// 재고회수 상태 업데이트 API
app.post('/api/inventory-recovery/update-status', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  try {
    const { rowIndex, column, value } = req.body;
    
    if (!rowIndex || !column || value === undefined) {
      return res.status(400).json({
        success: false,
        error: '필수 파라미터가 누락되었습니다. (rowIndex, column, value)'
      });
    }

    console.log(`🔄 [재고회수] 상태 업데이트: 행${rowIndex}, 열${column}, 값=${value}`);

    // 구글시트 업데이트
    let ranges = [];
    let values = [];
    
    if (column === 'recoveryCompleted') {
      ranges.push(`회수목록!K${rowIndex}`); // K열(10번인덱스): 회수완료
      values.push([value]);
    } else if (column === 'recoveryTargetSelected') {
      ranges.push(`회수목록!L${rowIndex}`); // L열(11번인덱스): 회수대상선정
      values.push([value]);
      
      // 회수대상선정이 취소되면 회수완료도 자동으로 취소
      if (!value || value === '') {
        ranges.push(`회수목록!K${rowIndex}`); // K열(10번인덱스): 회수완료
        values.push(['']); // 빈 값으로 설정하여 취소
        console.log(`🔄 [재고회수] 회수대상선정 취소로 인한 회수완료 자동 취소: 행${rowIndex}`);
      }
    } else {
      throw new Error('유효하지 않은 컬럼입니다.');
    }

    // 각 셀을 개별적으로 업데이트
    for (let i = 0; i < ranges.length; i++) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
        range: ranges[i],
        valueInputOption: 'RAW',
        requestBody: {
          values: [values[i]]
        }
      });
    }

    console.log(`✅ [재고회수] 상태 업데이트 완료: 행${rowIndex}, 열${column} = ${value}`);
    
    res.json({
      success: true,
      message: '상태가 성공적으로 업데이트되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ [재고회수] 상태 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: '상태 업데이트에 실패했습니다.',
      message: error.message
    });
  }
});

// 우선순위 모델 저장 API
app.post('/api/inventory-recovery/priority-models', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  try {
    const { priorityModels } = req.body;
    
    if (!priorityModels || typeof priorityModels !== 'object') {
      return res.status(400).json({
        success: false,
        error: '우선순위 모델 데이터가 필요합니다.'
      });
    }

    console.log('🔄 [우선순위 모델] 저장 요청:', priorityModels);

    // 구글시트에 우선순위 모델 저장 (회수목록 시트의 특정 셀에 저장)
    const ranges = [];
    const values = [];
    
    // 우선순위 모델을 JSON 형태로 저장할 셀 (우선순위 시트의 A1 셀)
    ranges.push('우선순위!A1');
    values.push([JSON.stringify(priorityModels)]);
    
    // 배치 업데이트 실행
    await rateLimitedSheetsCall(async () => {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
        resource: {
          valueInputOption: 'RAW',
          data: ranges.map((range, index) => ({
            range: range,
            values: [values[index]]
          }))
        }
      });
    });

    console.log('✅ [우선순위 모델] 저장 완료');
    
    res.json({
      success: true,
      message: '우선순위 모델이 성공적으로 저장되었습니다.',
      data: priorityModels
    });
    
  } catch (error) {
    console.error('❌ [우선순위 모델] 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: '우선순위 모델 저장에 실패했습니다.',
      message: error.message
    });
  }
});

// 우선순위 모델 로드 API
app.get('/api/inventory-recovery/priority-models', async (req, res) => {
  // CORS 헤더 설정
  const allowedOrigins = [
    'https://vipmobile.netlify.app',
    'https://vipmobile.netlify.app/',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  try {
    console.log('🔄 [우선순위 모델] 로드 요청');

    // 구글시트에서 우선순위 모델 데이터 로드 (우선순위 시트의 A1 셀)
    const response = await rateLimitedSheetsCall(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
        range: '우선순위!A1'
      });
    });

    let priorityModels = {
      '1순위': null,
      '2순위': null,
      '3순위': null,
      '4순위': null,
      '5순위': null,
      '6순위': null,
      '7순위': null,
      '8순위': null,
      '9순위': null,
      '10순위': null
    };

    // 데이터가 있으면 파싱
    if (response.data.values && response.data.values[0] && response.data.values[0][0]) {
      try {
        const savedData = JSON.parse(response.data.values[0][0]);
        priorityModels = { ...priorityModels, ...savedData };
        console.log('✅ [우선순위 모델] 로드 완료:', priorityModels);
      } catch (parseError) {
        console.warn('⚠️ [우선순위 모델] 파싱 오류, 기본값 사용:', parseError.message);
      }
    } else {
      console.log('ℹ️ [우선순위 모델] 저장된 데이터 없음, 기본값 사용');
    }

    res.json({
      success: true,
      data: priorityModels
    });
    
  } catch (error) {
    console.error('❌ [우선순위 모델] 로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '우선순위 모델 로드에 실패했습니다.',
      message: error.message
    });
  }
});

// 마지막 개통날짜 캐시 초기화 API
app.get('/api/last-activation-date/clear-cache', async (req, res) => {
  try {
    const cacheKey = 'last_activation_date';
    cache.delete(cacheKey);
    console.log('마지막 개통날짜 캐시 초기화 완료');
    res.json({ success: true, message: '캐시가 초기화되었습니다.' });
  } catch (error) {
    console.error('캐시 초기화 오류:', error);
    res.status(500).json({ error: '캐시 초기화 중 오류가 발생했습니다.' });
  }
});

// 업체별 재고 상세 조회 API
app.get('/api/company-inventory-details', async (req, res) => {
  try {
    const { companyName } = req.query;
    
    if (!companyName) {
      return res.status(400).json({ error: '업체명이 필요합니다.' });
    }
    
    console.log(`업체별 재고 상세 조회 시작: ${companyName}`);
    
    // 캐시 키 생성
    const cacheKey = `company_inventory_${companyName}`;
    
    // 캐시 확인
    if (cache.has(cacheKey)) {
      console.log('캐시된 업체 재고 데이터 반환');
      return res.json(cache.get(cacheKey));
    }
    
    // 폰클재고데이터 로드
    const inventoryData = await getSheetValues('폰클재고데이터');
    
    if (!inventoryData || inventoryData.length < 4) {
      return res.json({
        success: true,
        data: {
          companyName,
          defectiveDevices: [],
          defectiveSims: [],
          normalDevices: [],
          normalSims: []
        }
      });
    }
    
    // 헤더 3행 제외하고 데이터 처리
    const dataRows = inventoryData.slice(3);
    
    const result = {
      companyName,
      defectiveDevices: [], // 불량&이력단말
      defectiveSims: [],    // 불량&유심
      normalDevices: [],    // 보유단말
      normalSims: []        // 보유유심
    };
    
    dataRows.forEach(row => {
      if (row.length < 23) return; // 필요한 열이 없으면 스킵
      
      const company = (row[21] || '').toString(); // V열: 업체명
      const category = (row[12] || '').toString(); // M열: 종류
      const status = (row[15] || '').toString(); // P열: 상태
      const model = (row[13] || '').toString(); // N열: 모델명
      const color = (row[14] || '').toString(); // O열: 색상
      const serial = (row[11] || '').toString(); // L열: 일련번호
      const purchasePrice = (row[17] || '').toString(); // R열: 입고가
      const releaseDate = (row[22] || '').toString(); // W열: 출고일
      
      // 업체명이 일치하는 경우만 처리
      if (company === companyName) {
        const item = {
          category,
          status,
          model,
          color,
          serial,
          purchasePrice,
          releaseDate
        };
        
        // 카테고리별, 상태별로 분류
        if (category !== '유심' && status !== '정상') {
          result.defectiveDevices.push(item); // 불량&이력단말
        } else if (category === '유심' && status !== '정상') {
          result.defectiveSims.push(item); // 불량&유심
        } else if (category !== '유심' && status === '정상') {
          result.normalDevices.push(item); // 보유단말
        } else if (category === '유심' && status === '정상') {
          result.normalSims.push(item); // 보유유심
        }
      }
    });
    
    // 캐시 저장 (5분)
    cache.set(cacheKey, { success: true, data: result }, 300);
    
    console.log(`업체별 재고 상세 조회 완료: ${companyName}`);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('업체별 재고 상세 조회 오류:', error);
    res.status(500).json({ error: '업체별 재고 상세 조회 중 오류가 발생했습니다.' });
  }
});

// 마지막 개통날짜 조회 API
app.get('/api/last-activation-date', async (req, res) => {
  try {
    console.log('마지막 개통날짜 조회 시작');
    
    // 캐시 키 생성
    const cacheKey = 'last_activation_date';
    
    // 캐시 확인
    if (cache.has(cacheKey)) {
      console.log('캐시된 마지막 개통날짜 반환');
      return res.json(cache.get(cacheKey));
    }
    
    // 폰클개통데이터 로드
    const phoneklData = await getSheetValues('폰클개통데이터');
    
    if (!phoneklData || phoneklData.length < 4) {
      // 데이터가 없으면 오늘 날짜 반환
      const today = new Date().toISOString().split('T')[0];
      return res.json({ success: true, lastActivationDate: today });
    }
    
    // 헤더 3행 제외하고 데이터 처리
    const dataRows = phoneklData.slice(3);
    
    let lastDate = null;
    
    dataRows.forEach(row => {
      if (row.length > 9) {
        const activationDate = (row[9] || '').toString(); // J열: 개통일
        console.log(`개통날짜 발견: ${activationDate}`);

        // 날짜 형식 검증 (YYYY-MM-DD)
        if (activationDate && /^\d{4}-\d{2}-\d{2}$/.test(activationDate)) {
          const date = new Date(activationDate);
          if (!isNaN(date.getTime())) {
            if (!lastDate || date > lastDate) {
              console.log(`새로운 최신 날짜: ${activationDate} (이전: ${lastDate ? lastDate.toISOString().split('T')[0] : '없음'})`);
              lastDate = date;
            }
          }
        }
      }
    });
    
    // 마지막 날짜가 없으면 오늘 날짜 반환
    const resultDate = lastDate ? lastDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    // 캐시 저장 (1분)
    cache.set(cacheKey, { success: true, lastActivationDate: resultDate }, 60);
    
    console.log(`마지막 개통날짜 조회 완료: ${resultDate}`);
    res.json({ success: true, lastActivationDate: resultDate });
    
  } catch (error) {
    console.error('마지막 개통날짜 조회 오류:', error);
    // 오류 시 오늘 날짜 반환
    const today = new Date().toISOString().split('T')[0];
    res.json({ success: true, lastActivationDate: today });
  }
});

// 영업사원별마감 데이터 조회 API
app.get('/api/agent-closing-chart', async (req, res) => {
  try {
    const { date, agent } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`담당자별마감 데이터 조회 시작: ${targetDate}, 담당자: ${agent || '전체'}`);
    
    // 캐시 키 생성
    const cacheKey = `agent_closing_chart_${targetDate}_${agent || 'all'}`;
    
    // 캐시 확인
    if (cache.has(cacheKey)) {
      console.log('캐시된 담당자별마감 데이터 반환');
      return res.json(cache.get(cacheKey));
    }
    
    // 필요한 시트 데이터 로드 (병렬 처리)
    const [
      phoneklStoreData,
      phoneklInventoryData,
      phoneklActivationData
    ] = await Promise.all([
      getSheetValues('폰클출고처데이터'),
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클개통데이터')
    ]);
    
    if (!phoneklStoreData || !phoneklInventoryData || !phoneklActivationData) {
      throw new Error('필요한 시트 데이터를 가져올 수 없습니다.');
    }
    
    // 영업사원별 데이터 처리
    const agentData = processAgentClosingData({
      phoneklStoreData,
      phoneklInventoryData,
      phoneklActivationData,
      targetDate,
      selectedAgent: agent
    });
    
    const result = {
      success: true,
      agentData,
      totalCount: agentData.length,
      targetDate,
      selectedAgent: agent || '전체'
    };
    
    // 캐시 저장 (5분)
    cache.set(cacheKey, result, 300);
    
    console.log(`담당자별마감 데이터 처리 완료: ${agentData.length}건`);
    res.json(result);
    
  } catch (error) {
    console.error('담당자별마감 데이터 조회 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '담당자별마감 데이터를 가져오는데 실패했습니다.',
      details: error.message
    });
  }
});

// 영업사원별마감 초기 데이터 조회 API (마지막 개통날짜 + 영업사원 목록)
app.get('/api/agent-closing-initial', async (req, res) => {
  try {
    const cacheKey = 'agent_closing_initial_data';
    
    // 캐시 확인
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }
    
    // 마지막 개통날짜 조회
    const phoneklActivationList = await getSheetValues('폰클개통리스트');
    let lastActivationDate = new Date().toISOString().split('T')[0];
    
    if (phoneklActivationList && phoneklActivationList.length > 1) {
      const dateColumn = phoneklActivationList[0].indexOf('개통날짜');
      if (dateColumn !== -1) {
        const dates = phoneklActivationList.slice(1)
          .map(row => row[dateColumn])
          .filter(date => date && typeof date === 'string' && date.includes('-'))
          .map(dateStr => {
            try {
              const date = new Date(dateStr);
              return isNaN(date.getTime()) ? null : date;
            } catch {
              return null;
            }
          })
          .filter(date => date !== null);
        
        if (dates.length > 0) {
          const latestDate = new Date(Math.max(...dates));
          lastActivationDate = latestDate.toISOString().split('T')[0];
        }
      }
    }
    
    // 영업사원 목록 조회
    const [phoneklStoreData, phoneklActivationData] = await Promise.all([
      getSheetValues('폰클출고처데이터'),
      getSheetValues('폰클개통데이터')
    ]);
    
    if (!phoneklStoreData || phoneklStoreData.length < 2) {
      throw new Error('폰클출고처데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklActivationData || phoneklActivationData.length < 4) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    // 이번달 개통실적이 있는 담당자 추출
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentYearMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    
    const agentsWithActivation = new Set();
    let activationCount = 0;
    
    phoneklActivationData.slice(3).forEach(row => {
      if (row[1] && row[9]) {
        const activationDate = row[9];
        const agent = row[1];
        
        if (typeof activationDate === 'string' && activationDate.includes('-')) {
          const [year, month] = activationDate.split('-');
          if (year === currentYear.toString() && month === currentMonth.toString().padStart(2, '0')) {
            agentsWithActivation.add(agent);
            activationCount++;
          }
        }
      }
    });
    
    // 폰클출고처데이터에서 해당 담당자들의 전체 목록 추출
    const allAgents = new Set();
    phoneklStoreData.slice(3).forEach(row => {
      if (row[21] && row[12] !== '미사용') {
        allAgents.add(row[21]);
      }
    });
    
    // 이번달 개통실적이 있는 담당자만 필터링
    const filteredAgents = Array.from(allAgents).filter(agent => 
      agentsWithActivation.has(agent)
    ).sort();
    
    const result = {
      success: true,
      lastActivationDate,
      agents: filteredAgents,
      agentsWithActivation: filteredAgents.length,
      totalAgents: allAgents.size,
      activationCount
    };
    
    // 캐시 저장 (2분)
    cache.set(cacheKey, result, 120);
    
    console.log(`영업사원별마감 초기 데이터 로드 완료: 마지막 개통날짜=${lastActivationDate}, 담당자=${filteredAgents.length}명`);
    res.json(result);
    
  } catch (error) {
    console.error('영업사원별마감 초기 데이터 조회 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '영업사원별마감 초기 데이터를 가져오는데 실패했습니다.',
      details: error.message
    });
  }
});

// 영업사원별마감용 영업사원 목록 조회 API (이번달 개통실적 있는 담당자만)
app.get('/api/agent-closing-agents', async (req, res) => {
  try {
    const cacheKey = 'agent_closing_agents_list_with_activation';
    
    // 캐시 확인
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }
    
    // 필요한 시트 데이터 병렬 로드
    const [phoneklStoreData, phoneklActivationData] = await Promise.all([
      getSheetValues('폰클출고처데이터'),
      getSheetValues('폰클개통데이터')
    ]);
    
    if (!phoneklStoreData || phoneklStoreData.length < 2) {
      throw new Error('폰클출고처데이터를 가져올 수 없습니다.');
    }
    
    if (!phoneklActivationData || phoneklActivationData.length < 4) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    // 이번달 개통실적이 있는 담당자 추출
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentYearMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    
    console.log(`이번달 개통실적 조회: ${currentYearMonth}`);
    
    // 폰클개통데이터에서 이번달 개통실적이 있는 담당자 찾기
    const agentsWithActivation = new Set();
    let activationCount = 0;
    
    phoneklActivationData.slice(3).forEach(row => {
      if (row.length < 2) return; // B열(1인덱스)까지 필요
      
      const category = row[2] || ''; // C열: 휴대폰
      const activationDate = row[9] || ''; // J열: 개통일
      const assignedAgent = row[1] || ''; // B열: 담당자 (괄호 포함)
      
      if (category !== '휴대폰') return;
      
      // 날짜 파싱 (J열 형식: 2025-09-27)
      if (activationDate.length >= 10) {
        const dateStr = activationDate.substring(0, 10);
        const dateObj = new Date(dateStr);
        
        if (isNaN(dateObj.getTime())) return;
        
        const yearMonth = dateStr.substring(0, 7); // YYYY-MM
        
        // 이번달 개통실적이 있는 경우
        if (yearMonth === currentYearMonth && assignedAgent) {
          const agentName = assignedAgent.toString().trim();
          if (agentName) {
            agentsWithActivation.add(agentName);
            activationCount++;
          }
        }
      }
    });
    
    console.log(`이번달 개통실적 있는 담당자: ${agentsWithActivation.size}명, 총 개통건수: ${activationCount}건`);
    
    // 폰클출고처데이터에서 모든 담당자명 추출 (참고용)
    const allAgents = new Set();
    phoneklStoreData.slice(3).forEach(row => {
      if (row.length > 21 && row[21]) {
        const agentName = row[21].toString().trim();
        if (agentName) {
          allAgents.add(agentName);
        }
      }
    });
    
    // 이번달 개통실적이 있는 담당자만 필터링
    const filteredAgents = Array.from(agentsWithActivation).sort();
    
    const result = {
      success: true,
      agents: filteredAgents,
      currentMonth: currentYearMonth,
      totalAgents: allAgents.size,
      agentsWithActivation: agentsWithActivation.size,
      activationCount: activationCount,
      note: `이번달(${currentYearMonth}) 개통실적이 있는 담당자만 필터링`
    };
    
    // 캐시 저장 (10분)
    cache.set(cacheKey, result, 600);
    
    console.log(`이번달 개통실적 있는 담당자 목록 조회 완료: ${result.agents.length}명 (전체 ${allAgents.size}명 중)`);
    res.json(result);
    
  } catch (error) {
    console.error('담당자 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '담당자 목록을 가져오는데 실패했습니다.',
      details: error.message
    });
  }
});

// 영업사원별마감 데이터 처리 함수
function processAgentClosingData({ phoneklStoreData, phoneklInventoryData, phoneklActivationData, targetDate, selectedAgent }) {
  const agentMap = new Map();
  
  // 1. 폰클출고처데이터에서 기본 정보 수집
  phoneklStoreData.slice(3).forEach(row => {
    if (row.length < 22) return;
    
    const status = row[12] || ''; // M열: 사용/미사용 상태
    const policyGroup = row[18] || ''; // S열
    const pCode = row[15] || ''; // P열
    const companyName = row[14] || ''; // O열
    const agent = row[21] || ''; // V열
    
    // M열이 "미사용"인 경우 제외
    if (status === '미사용') return;
    
    // 영업사원 필터링 (기본 이름으로 그룹핑)
    if (selectedAgent) {
      const baseAgentName = agent.replace(/\([^)]*\)/g, '').trim();
      if (baseAgentName !== selectedAgent) return;
    }
    
    if (!agent || !companyName) return;
    
    const key = `${agent}_${companyName}`;
    if (!agentMap.has(key)) {
      agentMap.set(key, {
        policyGroup,
        pCode,
        companyName,
        agent,
        turnoverRate: 0,
        defectiveDevices: 0,
        historyDevices: 0,
        defectiveSims: 0,
        historySims: 0,
        totalInventory: 0,
        remainingSims: 0,
        dailyPerformance: 0,
        monthlyPerformance: 0,
        expectedClosing: 0,
        noPerformanceStores: 0
      });
    }
  });
  
  // 2. 폰클재고데이터에서 재고 정보 수집
  phoneklInventoryData.slice(3).forEach(row => {
    if (row.length < 22) return;
    
    const category = row[12] || ''; // M열: 휴대폰/유심/웨어러블/태블릿
    const status = row[15] || ''; // P열: 정상/불량/이력
    const companyName = row[21] || ''; // V열: 업체명
    
    // agentMap에서 해당 업체명 찾기 (미사용 업체는 이미 agentMap에서 제외됨)
    for (const [key, data] of agentMap) {
      if (data.companyName === companyName) {
        if (category === '휴대폰' && status === '불량') {
          data.defectiveDevices++;
        } else if (category === '휴대폰' && status === '이력') {
          data.historyDevices++;
        } else if (category === '유심' && status === '불량') {
          data.defectiveSims++;
        } else if (category === '유심' && status === '이력') {
          data.historySims++;
        } else if ((category === '휴대폰' || category === '웨어러블' || category === '태블릿') && status === '정상') {
          data.totalInventory++;
        } else if (category === '유심' && status === '정상') {
          data.remainingSims++;
        }
        break;
      }
    }
  });
  
  // 3. 폰클개통데이터에서 실적 정보 수집
  const targetYearMonth = targetDate.substring(0, 7); // YYYY-MM
  const targetDay = targetDate.substring(8, 10); // DD
  
  phoneklActivationData.slice(3).forEach(row => {
    if (row.length < 15) return; // O열(14인덱스)까지 필요
    
    const category = row[2] || ''; // C열: 휴대폰
    const activationDate = row[9] || ''; // J열: 개통일
    const assignedAgent = row[1] || ''; // B열: 담당자 (괄호 포함)
    const companyName = row[14] || ''; // O열: 업체명
    
    if (category !== '휴대폰') return;
    
    // 날짜 파싱 (J열 형식: 2025-09-27)
    if (activationDate.length >= 10) {
      const dateStr = activationDate.substring(0, 10);
      const dateObj = new Date(dateStr);
      
      if (isNaN(dateObj.getTime())) return;
      
      const yearMonth = dateStr.substring(0, 7);
      const day = dateStr.substring(8, 10);
      
      // 담당자와 업체명으로 정확한 실적 계산
      const agentName = assignedAgent.toString().trim();
      const activationCompanyName = companyName.toString().trim();
      
      if (agentName && activationCompanyName) {
        // 금일실적: 선택된 날짜와 정확히 일치
        if (day === targetDay && yearMonth === targetYearMonth) {
          for (const [key, data] of agentMap) {
            if (data.agent === agentName && data.companyName === activationCompanyName) {
              data.dailyPerformance++;
            }
          }
        }
        
        // 당월실적: 선택된 월의 모든 날짜
        if (yearMonth === targetYearMonth) {
          for (const [key, data] of agentMap) {
            if (data.agent === agentName && data.companyName === activationCompanyName) {
              data.monthlyPerformance++;
            }
          }
        }
      }
    }
  });
  
  // 4. 예상마감 계산 (전체총마감과 동일한 로직)
  const targetDateObj = new Date(targetDate);
  const currentDay = targetDateObj.getDate(); // 1일부터 선택된 날짜까지의 기간 (예: 15일 선택 시 15일간)
  const daysInMonth = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth() + 1, 0).getDate(); // 해당월 총 일수
  
  for (const [key, data] of agentMap) {
    if (currentDay > 0 && data.monthlyPerformance > 0) {
      // 당월실적(1일~선택된날짜까지)을 선택된 기간으로 나누어 일평균 계산 후 월 총 일수 곱하기
      data.expectedClosing = Math.round((data.monthlyPerformance / currentDay) * daysInMonth);
    } else {
      data.expectedClosing = 0;
    }
  }
  
  // 5. 회전율 계산 (예상마감 / (예상마감 + 보유재고) * 100) - 전체총마감 탭과 동일한 방식
  for (const [key, data] of agentMap) {
    if ((data.expectedClosing + data.totalInventory) > 0) {
      data.turnoverRate = Math.round((data.expectedClosing / (data.expectedClosing + data.totalInventory)) * 100);
    }
  }
  
  // 6. 무실적점 계산 (당월실적이 없는 곳은 "무실적점"으로 표기)
  for (const [key, data] of agentMap) {
    if (data.monthlyPerformance === 0) {
      data.noPerformanceStores = "무실적점";
    } else {
      data.noPerformanceStores = "";
    }
  }
  
  // 담당자별로 먼저 그룹핑하고, 각 그룹 내에서 당월실적 내림차순 정렬
  const sortedData = Array.from(agentMap.values()).sort((a, b) => {
    // 1. 담당자명으로 먼저 정렬 (같은 담당자는 함께 그룹핑)
    const agentA = a.agent || '';
    const agentB = b.agent || '';
    
    if (agentA !== agentB) {
      return agentA.localeCompare(agentB);
    }
    
    // 2. 같은 담당자 내에서는 당월실적 내림차순 정렬
    return (b.monthlyPerformance || 0) - (a.monthlyPerformance || 0);
  });
  
  return sortedData;
}

// 폰클중복값 API 엔드포인트들
app.get('/api/phone-duplicates', async (req, res) => {
  try {
    console.log('📱 폰클중복값 API 호출 시작');
    
    // 폰클개통데이터와 폰클재고데이터 시트에서 데이터 가져오기
    const activationData = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: '폰클개통데이터!A4:BZ',
    });

    const inventoryData = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: '폰클재고데이터!A4:AC',
    });

    const activationRows = activationData.data.values || [];
    const inventoryRows = inventoryData.data.values || [];

    // 휴대폰 데이터 통합 (개통 + 재고)
    const phoneData = [];
    
    // 개통데이터에서 휴대폰 정보 추출
    console.log(`📱 개통 데이터 행 수: ${activationRows.length}`);
    
    activationRows.forEach((row, index) => {
      if (row[12] && row[12] !== '유심') { // M열(12)이 유심이 아닌 경우
        const serial = row[23] || '';
        const cleanSerial = serial.replace(/\s/g, '');
        
        // 디버깅: 처음 5개 일련번호 로그
        if (index < 5) {
          console.log(`개통 일련번호 ${index}: 원본="${row[23]}", 공백제거="${cleanSerial}", 길이=${cleanSerial.length}`);
        }
        
        phoneData.push({
          store: row[14] || '', // O열(14) - 업체명
          model: row[21] || '', // V열(21) - 모델명
          color: row[22] || '', // W열(22) - 색상
          serial: serial, // X열(23) - 일련번호 (RIGHT 함수로 6자리)
          employee: row[77] || '', // BZ열(77) - 등록직원
          inputStore: row[12] || '', // M열(12) - 입고처
          outputDate: row[9] || '', // J열(9) - 출고일
          type: '개통'
        });
      }
    });

    // 재고데이터에서 휴대폰 정보 추출
    console.log(`📱 재고 데이터 행 수: ${inventoryRows.length}`);
    
    inventoryRows.forEach((row, index) => {
      if (row[12] && row[12] !== '유심') { // M열(12)이 유심이 아닌 경우
        const serial = row[11] || '';
        const cleanSerial = serial.replace(/\s/g, '');
        
        // 디버깅: 처음 5개 일련번호 로그
        if (index < 5) {
          console.log(`재고 일련번호 ${index}: 원본="${row[11]}", 공백제거="${cleanSerial}", 길이=${cleanSerial.length}`);
        }
        
        phoneData.push({
          store: row[21] || '', // V열(21) - 업체명
          model: row[13] || '', // N열(13) - 모델명
          color: row[14] || '', // O열(14) - 색상
          serial: serial, // L열(11) - 일련번호
          employee: row[28] || '', // AC열(28) - 등록직원
          inputStore: row[18] || '', // S열(18) - 입고처
          outputDate: row[22] || '', // W열(22) - 출고일
          type: '재고'
        });
      }
    });

    // 중복 검사: 모델명 + 일련번호(마지막 6자리) 조합
    const duplicateMap = new Map();
    phoneData.forEach(item => {
      // 일련번호 유효성 검사: 공백 제거 후 최소 6자리 이상
      const cleanSerial = item.serial ? item.serial.replace(/\s/g, '') : '';
      if (!cleanSerial || cleanSerial.length < 6) {
        return; // 유효하지 않은 일련번호는 건너뛰기
      }
      
      const serialKey = cleanSerial.slice(-6); // 마지막 6자리 (공백 제거 후)
      const key = `${item.model}|${serialKey}`;
      
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key).push(item);
    });

    // 중복된 항목만 필터링
    const duplicates = Array.from(duplicateMap.entries())
      .filter(([key, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        count: items.length,
        items: items.sort((a, b) => a.store.localeCompare(b.store))
      }));

    // 등록직원 빈도 계산
    const employeeFrequency = {};
    duplicates.forEach(duplicate => {
      duplicate.items.forEach(item => {
        if (item.employee) {
          employeeFrequency[item.employee] = (employeeFrequency[item.employee] || 0) + 1;
        }
      });
    });

    console.log(`📱 휴대폰 중복 검사 완료: ${duplicates.length}개 중복 그룹 발견`);
    
    res.json({
      success: true,
      data: {
        duplicates,
        employeeFrequency,
        totalDuplicates: duplicates.reduce((sum, dup) => sum + dup.count, 0)
      }
    });

  } catch (error) {
    console.error('❌ 폰클중복값 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/sim-duplicates', async (req, res) => {
  try {
    console.log('📲 유심중복값 API 호출 시작');
    
    // 폰클개통데이터와 폰클재고데이터 시트에서 데이터 가져오기
    const activationData = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: '폰클개통데이터!A4:BZ',
    });

    const inventoryData = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: '폰클재고데이터!A4:AC',
    });

    const activationRows = activationData.data.values || [];
    const inventoryRows = inventoryData.data.values || [];

    // 유심 데이터 통합 (개통 + 재고)
    const simData = [];
    
    // 개통데이터에서 유심 정보 추출
    console.log(`📲 개통 데이터에서 유심 검색 중...`);
    let simCount = 0;
    
    activationRows.forEach((row, index) => {
      if (row[12] && row[12].includes('유심')) { // M열(12)에 유심이 포함된 경우
        simCount++;
        if (simCount <= 5) {
          console.log(`개통 유심 ${simCount}: M열="${row[12]}", 모델="${row[24]}", 일련번호="${row[25]}"`);
        }
        
        simData.push({
          store: row[14] || '', // O열(14) - 업체명
          model: row[24] || '', // Y열(24) - 유심모델명
          serial: row[25] || '', // Z열(25) - 유심일련번호
          employee: row[77] || '', // BZ열(77) - 등록직원
          inputStore: row[12] || '', // M열(12) - 입고처
          outputDate: row[9] || '', // J열(9) - 출고일
          type: '개통'
        });
      }
    });
    
    console.log(`📲 개통에서 유심 데이터 ${simCount}개 발견`);

    // 재고데이터에서 유심 정보 추출
    console.log(`📲 재고 데이터에서 유심 검색 중...`);
    let inventorySimCount = 0;
    
    inventoryRows.forEach((row, index) => {
      if (row[12] && row[12].includes('유심')) { // M열(12)에 유심이 포함된 경우
        inventorySimCount++;
        if (inventorySimCount <= 5) {
          console.log(`재고 유심 ${inventorySimCount}: M열="${row[12]}", 모델="${row[13]}", 일련번호="${row[11]}"`);
        }
        
        simData.push({
          store: row[21] || '', // V열(21) - 업체명
          model: row[13] || '', // N열(13) - 유심모델명
          serial: row[11] || '', // L열(11) - 유심일련번호
          employee: row[28] || '', // AC열(28) - 등록직원
          inputStore: row[18] || '', // S열(18) - 입고처
          outputDate: row[22] || '', // W열(22) - 출고일
          type: '재고'
        });
      }
    });
    
    console.log(`📲 재고에서 유심 데이터 ${inventorySimCount}개 발견`);

    // 중복 검사: 유심모델명 + 유심일련번호(마지막 6자리) 조합
    const duplicateMap = new Map();
    simData.forEach(item => {
      // 유심 일련번호 유효성 검사: 공백 제거 후 최소 6자리 이상
      const cleanSerial = item.serial ? item.serial.replace(/\s/g, '') : '';
      if (!cleanSerial || cleanSerial.length < 6) {
        return; // 유효하지 않은 일련번호는 건너뛰기
      }
      
      const serialKey = cleanSerial.slice(-6); // 마지막 6자리 (공백 제거 후)
      const key = `${item.model}|${serialKey}`;
      
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key).push(item);
    });

    // 중복된 항목만 필터링
    const duplicates = Array.from(duplicateMap.entries())
      .filter(([key, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        count: items.length,
        items: items.sort((a, b) => a.store.localeCompare(b.store))
      }));

    // 등록직원 빈도 계산
    const employeeFrequency = {};
    duplicates.forEach(duplicate => {
      duplicate.items.forEach(item => {
        if (item.employee) {
          employeeFrequency[item.employee] = (employeeFrequency[item.employee] || 0) + 1;
        }
      });
    });

    console.log(`📲 유심 데이터 통합 완료: ${simData.length}개 유심 데이터 발견`);
    console.log(`📲 유심 중복 검사 완료: ${duplicates.length}개 중복 그룹 발견`);
    
    res.json({
      success: true,
      data: {
        duplicates,
        employeeFrequency,
        totalDuplicates: duplicates.reduce((sum, dup) => sum + dup.count, 0)
      }
    });

  } catch (error) {
    console.error('❌ 유심중복값 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 폰클입고가상이값 API
app.get('/api/price-discrepancies', async (req, res) => {
  try {
    console.log('💰 폰클입고가상이값 API 호출 시작');
    
    // 캐싱된 getSheetValues 함수를 사용하여 데이터 가져오기
    const [inventoryValues, activationValues] = await Promise.all([
      getSheetValues('폰클재고데이터'),
      getSheetValues('폰클개통데이터')
    ]);

    if (!inventoryValues || inventoryValues.length === 0) {
      throw new Error('폰클재고데이터를 가져올 수 없습니다.');
    }

    if (!activationValues || activationValues.length === 0) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }

    // 헤더 제거 (폰클재고데이터: 3행 헤더, 폰클개통데이터: 3행 헤더)
    const inventoryRows = inventoryValues.slice(3);
    const activationRows = activationValues.slice(3);

    console.log(`💰 폰클재고데이터 행 수: ${inventoryRows.length} (캐시 사용)`);
    console.log(`💰 폰클개통데이터 행 수: ${activationRows.length} (캐시 사용)`);

    // 모델명별 입고가 데이터 수집
    const modelPriceMap = new Map();

    // 폰클재고데이터에서 데이터 추출
    inventoryRows.forEach((row, index) => {
      const modelName = (row[13] || '').toString().trim(); // N열(13) - 모델명
      const inPrice = (row[17] || '').toString().trim(); // R열(17) - 입고가
      
      // 모델명과 입고가가 모두 있는 경우만 처리
      if (modelName && inPrice) {
        if (!modelPriceMap.has(modelName)) {
          modelPriceMap.set(modelName, []);
        }
        
        modelPriceMap.get(modelName).push({
          sheetName: '폰클재고데이터',
          rowIndex: index + 4, // 4행부터 시작
          modelName: modelName,
          inPrice: inPrice,
          outStore: (row[21] || '').toString().trim(), // V열(21) - 출고처
          serial: (row[11] || '').toString().trim(), // L열(11) - 일련번호
          processDate: (row[22] || '').toString().trim(), // W열(22) - 최종처리일
          employee: (row[28] || '').toString().trim() // AC열(28) - 최종작업자
        });
      }
    });

    // 폰클개통데이터에서 데이터 추출
    activationRows.forEach((row, index) => {
      const modelName = (row[21] || '').toString().trim(); // V열(21) - 모델명
      const inPrice = (row[35] || '').toString().trim(); // AJ열(35) - 입고가
      
      // 모델명과 입고가가 모두 있는 경우만 처리
      if (modelName && inPrice) {
        if (!modelPriceMap.has(modelName)) {
          modelPriceMap.set(modelName, []);
        }
        
        modelPriceMap.get(modelName).push({
          sheetName: '폰클개통데이터',
          rowIndex: index + 4, // 4행부터 시작
          modelName: modelName,
          inPrice: inPrice,
          outStore: (row[14] || '').toString().trim(), // O열(14) - 출고처
          serial: (row[23] || '').toString().trim(), // X열(23) - 일련번호
          processDate: (row[9] || '').toString().trim(), // J열(9) - 최종처리일
          employee: (row[77] || '').toString().trim() // BZ열(77) - 최종작업자
        });
      }
    });

    console.log(`💰 모델명 종류: ${modelPriceMap.size}개`);

    // 입고가가 상이한 모델명만 필터링
    const discrepancies = [];

    modelPriceMap.forEach((items, modelName) => {
      // 입고가별로 그룹화
      const priceGroups = new Map();
      
      items.forEach(item => {
        // 입고가 정규화 (숫자만 추출, 콤마 및 공백 제거)
        const normalizedPrice = item.inPrice.replace(/[,\s]/g, '');
        
        if (!priceGroups.has(normalizedPrice)) {
          priceGroups.set(normalizedPrice, []);
        }
        priceGroups.get(normalizedPrice).push(item);
      });

      // 입고가가 2개 이상인 경우만 상이값으로 판단
      if (priceGroups.size > 1) {
        // 입고가별 건수 집계
        const priceBreakdown = Array.from(priceGroups.entries())
          .map(([price, items]) => ({
            price: price,
            count: items.length
          }))
          .sort((a, b) => b.count - a.count); // 건수 많은 순으로 정렬

        // 가장 많이 나오는 입고가를 추천 입고가로 설정
        const recommendedPrice = priceBreakdown[0].price;
        const totalCount = items.length;
        const recommendedCount = priceBreakdown[0].count;
        const confidence = ((recommendedCount / totalCount) * 100).toFixed(1);

        discrepancies.push({
          modelName: modelName,
          recommendedPrice: recommendedPrice,
          confidence: parseFloat(confidence),
          priceBreakdown: priceBreakdown,
          items: items.sort((a, b) => {
            // 추천 입고가가 아닌 항목을 먼저 표시
            const aNormalized = a.inPrice.replace(/[,\s]/g, '');
            const bNormalized = b.inPrice.replace(/[,\s]/g, '');
            if (aNormalized !== recommendedPrice && bNormalized === recommendedPrice) return -1;
            if (aNormalized === recommendedPrice && bNormalized !== recommendedPrice) return 1;
            return a.sheetName.localeCompare(b.sheetName);
          })
        });
      }
    });

    // 모델명 기준으로 정렬
    discrepancies.sort((a, b) => a.modelName.localeCompare(b.modelName));

    console.log(`💰 입고가 상이값 발견: ${discrepancies.length}개 모델명`);
    console.log(`💰 총 상이값 항목 수: ${discrepancies.reduce((sum, d) => sum + d.items.length, 0)}개`);

    res.json({
      success: true,
      data: {
        discrepancies: discrepancies,
        totalDiscrepancies: discrepancies.length,
        totalItems: discrepancies.reduce((sum, d) => sum + d.items.length, 0)
      }
    });

  } catch (error) {
    console.error('❌ 폰클입고가상이값 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// 무선단말검수 관련 API
// ============================================================

// 일련번호 정규화 함수 (공백 제거, 앞부분 연속된 0 제거)
function normalizeSerialNumber(serial) {
  if (!serial) return '';
  
  // 공백 제거
  let normalized = serial.toString().trim().replace(/\s+/g, '');
  
  // 알파벳으로 시작하는 경우, 앞부분 연속된 0 제거
  // 예: "000000ABC123" -> "ABC123", "00123ABC" -> "123ABC"
  normalized = normalized.replace(/^0+(?=\w)/, '');
  
  return normalized.toUpperCase(); // 대소문자 통일
}

// 마스터재고 데이터 조회 API
app.get('/api/master-inventory', async (req, res) => {
  try {
    console.log('📦 마스터재고 데이터 조회 시작...');
    
    // 마스터재고 시트 ID는 환경변수에서 가져옴
    const masterSpreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    const sheetData = await fetchSheetValuesDirectly('마스터재고', masterSpreadsheetId);
    
    if (!sheetData || sheetData.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제외하고 데이터 파싱
    const rows = sheetData.slice(1);
    const inventory = rows.map(row => ({
      modelCode: row[9] || '',           // 모델코드 (10번째 컬럼)
      color: row[11] || '',              // 색상 (12번째 컬럼)
      serialNumber: row[12] || '',       // 일련번호 (13번째 컬럼)
      normalizedSerial: normalizeSerialNumber(row[12]), // 정규화된 일련번호
      outletCode: row[17] || '',         // 출고점코드 (18번째 컬럼)
      firstInDate: row[23] || '',        // 최초입고일자 (24번째 컬럼)
      dealerInDate: row[26] || ''        // 대리점입고일자 (27번째 컬럼)
    })).filter(item => item.serialNumber); // 일련번호가 있는 것만
    
    console.log(`✅ 마스터재고 데이터 조회 완료: ${inventory.length}개`);
    
    res.json({
      success: true,
      data: inventory
    });
    
  } catch (error) {
    console.error('❌ 마스터재고 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 폰클재고 데이터 조회 API
app.get('/api/phonekl-inventory', async (req, res) => {
  try {
    console.log('📱 폰클재고 데이터 조회 시작...');
    
    const phoneklSpreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    const sheetData = await fetchSheetValuesDirectly('폰클재고', phoneklSpreadsheetId);
    
    if (!sheetData || sheetData.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제외하고 데이터 파싱
    const rows = sheetData.slice(1);
    const inventory = rows.map(row => ({
      inDate: row[8] || '',              // 입고일 (9번째 컬럼)
      serialNumber: row[10] || '',       // 일련번호 (11번째 컬럼)
      normalizedSerial: normalizeSerialNumber(row[10]), // 정규화된 일련번호
      type: row[11] || '',               // 종류 (12번째 컬럼)
      modelName: row[12] || '',          // 모델명 (13번째 컬럼)
      color: row[13] || '',              // 색상 (14번째 컬럼)
      status: row[14] || '',             // 상태 (15번째 컬럼)
      inPrice: row[16] || ''             // 입고가 (17번째 컬럼)
    })).filter(item => item.serialNumber); // 일련번호가 있는 것만
    
    console.log(`✅ 폰클재고 데이터 조회 완료: ${inventory.length}개`);
    
    res.json({
      success: true,
      data: inventory
    });
    
  } catch (error) {
    console.error('❌ 폰클재고 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 모델명정규화 데이터 조회 API
app.get('/api/model-normalization', async (req, res) => {
  try {
    console.log('🔄 모델명정규화 데이터 조회 시작...');
    
    const spreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    const sheetData = await fetchSheetValuesDirectly('모델명정규화', spreadsheetId);
    
    if (!sheetData || sheetData.length === 0) {
      return res.json({ success: true, data: {} });
    }
    
    // 헤더 제외하고 데이터 파싱
    const rows = sheetData.slice(1);
    const normalizationMap = {};
    
    rows.forEach(row => {
      const modelCode = row[0] || '';           // 원본 모델코드
      const normalizedName = row[1] || '';      // 정규화된 모델명
      
      if (modelCode && normalizedName) {
        normalizationMap[modelCode] = normalizedName;
      }
    });
    
    console.log(`✅ 모델명정규화 데이터 조회 완료: ${Object.keys(normalizationMap).length}개`);
    
    res.json({
      success: true,
      data: normalizationMap
    });
    
  } catch (error) {
    console.error('❌ 모델명정규화 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 모델명정규화 데이터 저장 API
app.post('/api/model-normalization', async (req, res) => {
  try {
    console.log('💾 모델명정규화 데이터 저장 시작...');
    
    const { normalizationMap } = req.body;
    
    if (!normalizationMap || typeof normalizationMap !== 'object') {
      return res.status(400).json({
        success: false,
        error: '정규화 데이터가 올바르지 않습니다.'
      });
    }
    
    const spreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    
    // 헤더 + 데이터 행 생성
    const rows = [
      ['모델코드', '정규화모델명', '등록일시']
    ];
    
    Object.entries(normalizationMap).forEach(([modelCode, normalizedName]) => {
      if (normalizedName) { // 정규화명이 입력된 것만 저장
        rows.push([
          modelCode,
          normalizedName,
          new Date().toISOString()
        ]);
      }
    });
    
    // 시트 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: '모델명정규화!A:C',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: rows
      }
    });
    
    console.log(`✅ 모델명정규화 데이터 저장 완료: ${rows.length - 1}개`);
    
    res.json({
      success: true,
      message: `${rows.length - 1}개의 정규화 데이터가 저장되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ 모델명정규화 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 확인된미확인재고 데이터 조회 API
app.get('/api/confirmed-unconfirmed-inventory', async (req, res) => {
  try {
    console.log('✔️ 확인된미확인재고 데이터 조회 시작...');
    
    const spreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    const sheetData = await fetchSheetValuesDirectly('확인된미확인재고', spreadsheetId);
    
    if (!sheetData || sheetData.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제외하고 데이터 파싱
    const rows = sheetData.slice(1);
    const confirmedItems = rows.map(row => ({
      outletCode: row[0] || '',          // 출고점코드
      inPrice: row[1] || '',             // 입고가
      modelCode: row[2] || '',           // 모델코드
      color: row[3] || '',               // 색상
      serialNumber: row[4] || '',        // 일련번호
      normalizedSerial: normalizeSerialNumber(row[4]), // 정규화된 일련번호
      inDate: row[5] || '',              // 입고일자
      confirmNote: row[6] || '',         // 확인내용
      status: row[7] || ''               // 진행상황
    })).filter(item => item.serialNumber); // 일련번호가 있는 것만
    
    console.log(`✅ 확인된미확인재고 데이터 조회 완료: ${confirmedItems.length}개`);
    
    res.json({
      success: true,
      data: confirmedItems
    });
    
  } catch (error) {
    console.error('❌ 확인된미확인재고 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 확인된미확인재고 데이터 추가 API
app.post('/api/confirmed-unconfirmed-inventory', async (req, res) => {
  try {
    console.log('💾 확인된미확인재고 데이터 추가 시작...');
    
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: '추가할 항목이 없습니다.'
      });
    }
    
    const spreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    
    // 기존 데이터 조회
    const existingData = await fetchSheetValuesDirectly('확인된미확인재고', spreadsheetId);
    
    // 새로운 항목 추가
    const newRows = items.map(item => [
      item.outletCode || '',
      item.inPrice || '',
      item.modelCode || '',
      item.color || '',
      item.serialNumber || '',
      item.inDate || '',
      item.confirmNote || '',
      item.status || '처리중'
    ]);
    
    // 헤더가 없으면 생성
    let allRows;
    if (!existingData || existingData.length === 0) {
      allRows = [
        ['출고점코드', '입고가', '모델코드', '색상', '일련번호', '입고일자', '확인내용', '진행상황'],
        ...newRows
      ];
    } else {
      allRows = [
        ...existingData,
        ...newRows
      ];
    }
    
    // 시트 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: '확인된미확인재고!A:H',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: allRows
      }
    });
    
    console.log(`✅ 확인된미확인재고 데이터 추가 완료: ${newRows.length}개`);
    
    res.json({
      success: true,
      message: `${newRows.length}개의 항목이 추가되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ 확인된미확인재고 추가 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 재고 비교 검수 API
app.post('/api/inventory-inspection', async (req, res) => {
  try {
    console.log('🔍 재고 비교 검수 시작...');
    
    const spreadsheetId = '12_oC7c2xqHlDCppUvWL2EFesszA3oDU5JBdrYccYT7Q';
    
    // 1. 마스터재고 조회
    const masterData = await fetchSheetValuesDirectly('마스터재고', spreadsheetId);
    const masterRows = masterData.slice(1);
    const masterInventory = masterRows.map(row => ({
      modelCode: row[9] || '',
      color: row[11] || '',
      serialNumber: row[12] || '',
      normalizedSerial: normalizeSerialNumber(row[12]),
      outletCode: row[17] || '',
      firstInDate: row[23] || '',
      dealerInDate: row[26] || ''
    })).filter(item => item.serialNumber);
    
    // 2. 폰클재고 조회
    const phoneklData = await fetchSheetValuesDirectly('폰클재고', spreadsheetId);
    const phoneklRows = phoneklData.slice(1);
    const phoneklInventory = phoneklRows.map(row => ({
      inDate: row[8] || '',
      serialNumber: row[10] || '',
      normalizedSerial: normalizeSerialNumber(row[10]),
      type: row[11] || '',
      modelName: row[12] || '',
      color: row[13] || '',
      status: row[14] || '',
      inPrice: row[16] || '',
      inStore: row[17] || '',    // 입고처 (18번째 컬럼)
      outStore: row[20] || ''    // 출고처 (21번째 컬럼)
    })).filter(item => item.serialNumber);
    
    // 3. 모델명정규화 맵 조회
    const normData = await fetchSheetValuesDirectly('모델명정규화', spreadsheetId);
    const normalizationMap = {};
    if (normData && normData.length > 1) {
      normData.slice(1).forEach(row => {
        const modelCode = row[0] || '';
        const normalizedName = row[1] || '';
        if (modelCode && normalizedName) {
          normalizationMap[modelCode] = normalizedName;
        }
      });
    }
    
    // 4. 확인된미확인재고 조회
    const confirmedData = await fetchSheetValuesDirectly('확인된미확인재고', spreadsheetId);
    const confirmedSet = new Set();
    if (confirmedData && confirmedData.length > 1) {
      confirmedData.slice(1).forEach(row => {
        const serial = normalizeSerialNumber(row[4] || '');
        if (serial) {
          confirmedSet.add(serial);
        }
      });
    }
    
    // 5. 폰클재고를 Map으로 변환 (빠른 검색을 위해)
    const phoneklMap = new Map();
    phoneklInventory.forEach(item => {
      phoneklMap.set(item.normalizedSerial, item);
    });
    
    // 6. 마스터재고 기준으로 비교
    const matchedItems = [];
    const unmatchedItems = [];
    const needsNormalization = new Set();
    
    masterInventory.forEach(masterItem => {
      const phoneklItem = phoneklMap.get(masterItem.normalizedSerial);
      
      if (phoneklItem) {
        // 일련번호 일치
        matchedItems.push({
          ...masterItem,
          phoneklData: phoneklItem,
          matched: true
        });
      } else {
        // 일련번호 불일치 - 확인된미확인재고에 있는지 확인
        const isConfirmed = confirmedSet.has(masterItem.normalizedSerial);
        
        if (!isConfirmed) {
          // 확인되지 않은 미확인 재고
          unmatchedItems.push({
            ...masterItem,
            matched: false,
            isConfirmed: false
          });
        } else {
          // 이미 확인된 재고
          unmatchedItems.push({
            ...masterItem,
            matched: false,
            isConfirmed: true
          });
        }
      }
      
      // 모델코드가 정규화되지 않은 경우 추가
      if (masterItem.modelCode && !normalizationMap[masterItem.modelCode]) {
        needsNormalization.add(masterItem.modelCode);
      }
    });
    
    console.log(`✅ 재고 비교 검수 완료`);
    console.log(`   - 전체: ${masterInventory.length}개`);
    console.log(`   - 일치: ${matchedItems.length}개`);
    console.log(`   - 미확인: ${unmatchedItems.filter(i => !i.isConfirmed).length}개`);
    console.log(`   - 확인됨: ${unmatchedItems.filter(i => i.isConfirmed).length}개`);
    console.log(`   - 정규화 필요: ${needsNormalization.size}개`);
    
    res.json({
      success: true,
      data: {
        total: masterInventory.length,
        matched: matchedItems,
        unmatched: unmatchedItems.filter(i => !i.isConfirmed), // 미확인만
        confirmed: unmatchedItems.filter(i => i.isConfirmed),  // 확인된 것들
        needsNormalization: Array.from(needsNormalization),
        normalizationMap: normalizationMap,
        statistics: {
          totalCount: masterInventory.length,
          matchedCount: matchedItems.length,
          unmatchedCount: unmatchedItems.filter(i => !i.isConfirmed).length,
          confirmedCount: unmatchedItems.filter(i => i.isConfirmed).length,
          needsNormalizationCount: needsNormalization.size
        }
      }
    });
    
  } catch (error) {
    console.error('❌ 재고 비교 검수 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 정보수집모드 앱 업데이트 API
app.get('/api/data-collection-updates', async (req, res) => {
  try {
    console.log('정보수집모드 앱 업데이트 데이터 요청');
    
    const values = await getSheetValues('어플업데이트');
    
    if (!values || values.length === 0) {
      console.log('정보수집모드 앱 업데이트 데이터가 없습니다.');
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 2행 제거하고 데이터 반환 (3행부터 시작)
    const dataRows = values.slice(2);
    
    // 정보수집모드 관련 업데이트만 필터링 (O열 14인덱스)
    const dataCollectionUpdates = dataRows.filter(row => {
      const mode = row[14] || ''; // O열
      return mode.toString().toLowerCase().includes('정보수집') || 
             mode.toString().toLowerCase().includes('데이터수집');
    });
    
    // 빈 행 제거
    const filteredData = dataCollectionUpdates.filter(row => 
      row.length > 0 && row.some(cell => cell && cell.toString().trim() !== '')
    );
    
    console.log(`정보수집모드 앱 업데이트 데이터 처리 완료: ${filteredData.length}건`);
    
    res.json({ success: true, data: filteredData });
    
  } catch (error) {
    console.error('정보수집모드 앱 업데이트 데이터 가져오기 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SMS 관리 API
// ============================================

// SMS 자동응답 시트 헤더 초기화 함수
async function ensureAutoReplySheetHeaders() {
  try {
    // SMS자동응답규칙 시트 헤더 체크
    try {
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A1:K1`,
      });
      
      if (!rulesResponse.data.values || rulesResponse.data.values.length === 0) {
        console.log('SMS자동응답규칙 시트 헤더 추가 중...');
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A1:K1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['규칙ID', '규칙명', '키워드', '답변유형', '답변템플릿', '가격조회설정', '활성화여부', '우선순위', '생성일시', '수정일시', '메모']]
          }
        });
      }
    } catch (rulesError) {
      if (rulesError.code === 429) {
        console.log('⚠️ [AUTO-REPLY-HEADER] API 할당량 초과 - 헤더 체크 스킵');
      } else {
        throw rulesError;
      }
    }
    
    // SMS자동응답거래처 시트 헤더 체크
    try {
      const contactsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A1:H1`,
      });
      
      if (!contactsResponse.data.values || contactsResponse.data.values.length === 0) {
        console.log('SMS자동응답거래처 시트 헤더 추가 중...');
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A1:H1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['ID', '유형', '담당영업사원ID', '이름', '연락처', '등록방식', '등록일시', '메모']]
          }
        });
      }
    } catch (contactsError) {
      if (contactsError.code === 429) {
        console.log('⚠️ [AUTO-REPLY-HEADER] API 할당량 초과 - 헤더 체크 스킵');
      } else {
        throw contactsError;
      }
    }
    
    // SMS자동응답이력 시트 헤더 체크
    try {
      const historyResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A1:J1`,
      });
      
      if (!historyResponse.data.values || historyResponse.data.values.length === 0) {
        console.log('SMS자동응답이력 시트 헤더 추가 중...');
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A1:J1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['이력ID', '수신일시', '발신번호', '거래처명', '문의내용', '매칭된규칙', '답변내용', '발송번호', '발송상태', '발송일시']]
          }
        });
      }
    } catch (historyError) {
      if (historyError.code === 429) {
        console.log('⚠️ [AUTO-REPLY-HEADER] API 할당량 초과 - 헤더 체크 스킵');
      } else {
        throw historyError;
      }
    }
    
    console.log('SMS 자동응답 시트 헤더 체크 완료');
  } catch (error) {
    if (error.code !== 429) {
      console.error('SMS 자동응답 시트 헤더 초기화 실패:', error);
    }
  }
}

// SMS 시트 헤더 자동 초기화 함수
async function ensureSmsSheetHeaders() {
  try {
    // SMS관리 시트 헤더 체크 (429 에러 시 무시)
    try {
      const smsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_SHEET_NAME}!A1:I1`,
      });
      
      if (!smsResponse.data.values || smsResponse.data.values.length === 0) {
        console.log('SMS관리 시트 헤더 추가 중...');
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_SHEET_NAME}!A1:I1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['ID', '수신일시', '발신번호', '수신번호', '메시지내용', '전달상태', '전달일시', '전달대상번호들', '처리메모']]
          }
        });
      }
    } catch (smsError) {
      if (smsError.code === 429) {
        console.log('⚠️ [SMS-HEADER] API 할당량 초과 - 헤더 체크 스킵 (이미 있을 가능성 높음)');
      } else {
        throw smsError;
      }
    }
    
    // SMS전달규칙 시트 헤더 체크 (429 에러 시 무시)
    try {
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_RULES_SHEET_NAME}!A1:J1`,
      });
      
      if (!rulesResponse.data.values || rulesResponse.data.values.length === 0) {
        console.log('SMS전달규칙 시트 헤더 추가 중...');
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_RULES_SHEET_NAME}!A1:K1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['규칙ID', '규칙명', '수신번호필터', '발신번호필터', '키워드필터', '전달대상번호들', '자동전달여부', '활성화여부', '생성일시', '수정일시', '메모']]
          }
        });
      }
    } catch (rulesError) {
      if (rulesError.code === 429) {
        console.log('⚠️ [SMS-HEADER] API 할당량 초과 - 헤더 체크 스킵 (이미 있을 가능성 높음)');
      } else {
        throw rulesError;
      }
    }
    
    // SMS전달이력 시트 헤더 체크 (429 에러 시 무시)
    try {
      const historyResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_HISTORY_SHEET_NAME}!A1:H1`,
      });
      
      if (!historyResponse.data.values || historyResponse.data.values.length === 0) {
        console.log('SMS전달이력 시트 헤더 추가 중...');
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_HISTORY_SHEET_NAME}!A1:H1`,
          valueInputOption: 'RAW',
          resource: {
            values: [['이력ID', 'SMS ID', '전달일시', '전달번호', '전달상태', '오류메시지', '처리방식', '규칙ID']]
          }
        });
      }
    } catch (historyError) {
      if (historyError.code === 429) {
        console.log('⚠️ [SMS-HEADER] API 할당량 초과 - 헤더 체크 스킵 (이미 있을 가능성 높음)');
      } else {
        throw historyError;
      }
    }
    
    console.log('SMS 시트 헤더 체크 완료');
  } catch (error) {
    // 429 에러가 아닌 경우만 로그 출력
    if (error.code !== 429) {
      console.error('SMS 시트 헤더 초기화 실패:', error);
    }
  }
}

// SMS 수신 데이터 조회 API
app.get('/api/sms/received', async (req, res) => {
  try {
    const { limit = 100, status = 'all' } = req.query;
    
    console.log(`SMS 수신 데이터 조회: limit=${limit}, status=${status}`);
    
    // SMS관리 시트에서 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:I`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }
    
    // 헤더 제외하고 데이터만 파싱
    const header = rows[0];
    const dataRows = rows.slice(1);
    
    // 데이터를 객체 배열로 변환
    let smsData = dataRows.map(row => ({
      id: row[0] || '',
      receivedAt: row[1] || '',
      sender: row[2] || '',
      receiver: row[3] || '',
      message: row[4] || '',
      forwardStatus: row[5] || '대기중',
      forwardedAt: row[6] || '',
      forwardTargets: row[7] || '',
      memo: row[8] || ''
    }));
    
    // 상태 필터링 (상세 상태도 지원: "대기중 (규칙: xxx)" → "대기중"으로 필터링)
    if (status !== 'all') {
      smsData = smsData.filter(sms => (sms.forwardStatus || '').startsWith(status));
    }
    
    // 최신순 정렬 (ID 내림차순)
    smsData.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    
    // 제한 적용
    smsData = smsData.slice(0, parseInt(limit));
    
    res.json({ success: true, data: smsData });
    
  } catch (error) {
    console.error('SMS 수신 데이터 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 전달 규칙 조회 API
app.get('/api/sms/rules', async (req, res) => {
  try {
    console.log('SMS 전달 규칙 조회');
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!A:K`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }
    
    const dataRows = rows.slice(1);
    const rules = dataRows.map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      receiverFilter: row[2] || '',
      senderFilter: row[3] || '',
      keywordFilter: row[4] || '',
      targetNumbers: row[5] || '',
      autoForward: row[6] === 'O',
      active: row[7] === 'O',
      createdAt: row[8] || '',
      updatedAt: row[9] || '',
      memo: row[10] || ''
    }));
    
    res.json({ success: true, data: rules });
    
  } catch (error) {
    console.error('SMS 전달 규칙 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 전달 규칙 추가 API
app.post('/api/sms/rules', async (req, res) => {
  try {
    const { name, receiverFilter, senderFilter, keywordFilter, targetNumbers, autoForward, active, memo } = req.body;
    
    console.log('SMS 전달 규칙 추가:', name);
    
    // 기존 데이터 가져오기 (ID 생성용)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!A:A`,
    });
    
    const rows = response.data.values || [];
    const newId = rows.length; // 헤더 포함이므로 length가 곧 새 ID
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetNumbersStr = Array.isArray(targetNumbers) ? targetNumbers.join(',') : targetNumbers;
    
    const newRow = [
      newId,
      name,
      receiverFilter || '',
      senderFilter || '',
      keywordFilter || '',
      targetNumbersStr,
      autoForward ? 'O' : 'X',
      active ? 'O' : 'X',
      now,
      now,
      memo || ''
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!A:K`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    res.json({ success: true, id: newId });
    
  } catch (error) {
    console.error('SMS 전달 규칙 추가 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 전달 규칙 수정 API
app.put('/api/sms/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, receiverFilter, senderFilter, keywordFilter, targetNumbers, autoForward, active, memo } = req.body;
    
    console.log(`SMS 전달 규칙 수정: ID=${id}`);
    
    // 기존 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!A:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);
    
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '규칙을 찾을 수 없습니다.' });
    }
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetNumbersStr = Array.isArray(targetNumbers) ? targetNumbers.join(',') : targetNumbers;
    const createdAt = rows[rowIndex][8] || now; // createdAt은 이제 8번 인덱스
    
    const updatedRow = [
      id,
      name,
      receiverFilter || '',
      senderFilter || '',
      keywordFilter || '',
      targetNumbersStr,
      autoForward ? 'O' : 'X',
      active ? 'O' : 'X',
      createdAt,
      now,
      memo || ''
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!A${rowIndex + 1}:K${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [updatedRow]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('SMS 전달 규칙 수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 전달 규칙 삭제 API
app.delete('/api/sms/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`SMS 전달 규칙 삭제: ID=${id}`);
    
    // 구글 시트는 행 삭제가 복잡하므로, 활성화를 X로 변경하는 방식으로 처리
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!A:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);
    
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '규칙을 찾을 수 없습니다.' });
    }
    
    // 활성화를 X로 변경
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_RULES_SHEET_NAME}!G${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['X']]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('SMS 전달 규칙 삭제 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 전달 이력 조회 API
app.get('/api/sms/history', async (req, res) => {
  try {
    const { smsId } = req.query;
    
    console.log(`SMS 전달 이력 조회: smsId=${smsId}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_HISTORY_SHEET_NAME}!A:H`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }
    
    const dataRows = rows.slice(1);
    let history = dataRows.map(row => ({
      id: row[0] || '',
      smsId: row[1] || '',
      forwardedAt: row[2] || '',
      targetNumber: row[3] || '',
      status: row[4] || '',
      errorMessage: row[5] || '',
      processType: row[6] || '',
      ruleId: row[7] || ''
    }));
    
    // SMS ID로 필터링
    if (smsId) {
      history = history.filter(h => h.smsId === smsId);
    }
    
    // 최신순 정렬
    history.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    
    res.json({ success: true, data: history });
    
  } catch (error) {
    console.error('SMS 전달 이력 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 수동 전달 API
app.post('/api/sms/forward', async (req, res) => {
  try {
    const { smsId, targetNumbers, memo } = req.body;
    
    console.log(`SMS 수동 전달: ID=${smsId}, 대상=${targetNumbers.length}개`);
    
    if (!smsId || !targetNumbers || targetNumbers.length === 0) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    }
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // 이력 ID 생성용
    const historyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_HISTORY_SHEET_NAME}!A:A`,
    });
    
    let historyId = (historyResponse.data.values || []).length;
    
    // 각 대상 번호별로 이력 추가
    const historyRows = [];
    let successCount = 0;
    
    for (const targetNumber of targetNumbers) {
      const historyRow = [
        historyId++,
        smsId,
        now,
        targetNumber,
        '성공', // 실제로는 전송 결과에 따라 달라짐
        '',
        '수동',
        ''
      ];
      
      historyRows.push(historyRow);
      successCount++;
    }
    
    // 이력 시트에 추가
    if (historyRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_HISTORY_SHEET_NAME}!A:H`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: historyRows
        }
      });
    }
    
    // SMS관리 시트 업데이트
    const smsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:I`,
    });
    
    const smsRows = smsResponse.data.values || [];
    const smsRowIndex = smsRows.findIndex(row => row[0] === smsId);
    
    if (smsRowIndex !== -1) {
      const forwardStatus = successCount === targetNumbers.length ? '전달완료' : 
                           successCount > 0 ? '부분실패' : '실패';
      const targetNumbersStr = targetNumbers.join(',');
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_SHEET_NAME}!F${smsRowIndex + 1}:I${smsRowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[forwardStatus, now, targetNumbersStr, memo || '']]
        }
      });
    }
    
    res.json({ 
      success: true, 
      successCount,
      totalCount: targetNumbers.length
    });
    
  } catch (error) {
    console.error('SMS 수동 전달 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 안드로이드 앱용 SMS 등록 API
app.post('/api/sms/register', async (req, res) => {
  try {
    const { sender, receiver, message, timestamp } = req.body;
    
    console.log(`SMS 등록: 발신=${sender}, 수신=${receiver}`);
    
    if (!sender || !receiver || !message) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    }
    
    // 중복 체크: 발신번호 + 수신번호 + 메시지 내용으로 확인
    const existingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:E`,
    });
    
    const existingRows = existingResponse.data.values || [];
    
    // 헤더 제외하고 데이터만
    if (existingRows.length > 1) {
      const dataRows = existingRows.slice(1);
      
      // 같은 발신번호, 수신번호, 메시지가 이미 있는지 확인
      const isDuplicate = dataRows.some(row => {
        const existingSender = row[2] || '';
        const existingReceiver = row[3] || '';
        const existingMessage = row[4] || '';
        
        return existingSender === sender && 
               existingReceiver === receiver && 
               existingMessage === message;
      });
      
      if (isDuplicate) {
        console.log('⚠️ 중복된 SMS - 등록 스킵');
        return res.json({ success: true, duplicate: true, message: '이미 등록된 SMS입니다.' });
      }
    }
    
    console.log('✅ 중복 아님 - 규칙 매칭 체크 시작...');
    
    // ⚠️ 중요: 발신번호 = 수신번호인 경우 바로 스킵 (무한 루프 방지)
    if (sender === receiver) {
      console.log('⚠️ 자가 전송 감지 (발신=수신) - 시트 저장 스킵:', sender);
      return res.json({ success: true, skipped: true, reason: 'self-send' });
    }
    
    // ==================================================
    // 📋 1단계: 규칙 매칭 체크 (시트 저장 전)
    // ==================================================
    let matchedRule = null;
    let matchedFilters = [];
    let matchInfo = '';
    
    try {
      // 전달 규칙 조회
      const rulesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_RULES_SHEET_NAME}!A:K`,
      });
      
      const rulesRows = rulesResponse.data.values || [];
      
      if (rulesRows.length > 1) {
        const rulesData = rulesRows.slice(1);
        
        // 활성화되고 자동전달이 ON인 규칙만 필터링
        const activeRules = rulesData.filter(rule => {
          const autoForward = rule[6] === 'O'; // G열: 자동전달여부
          const active = rule[7] === 'O'; // H열: 활성화여부
          return autoForward && active;
        });
        
        console.log(`활성화된 자동전달 규칙: ${activeRules.length}개`);
        
        // 규칙이 없으면 바로 스킵
        if (activeRules.length === 0) {
          console.log('❌ 활성화된 규칙 없음 - 시트 저장 스킵');
          return res.json({ success: true, skipped: true, reason: 'no-active-rules' });
        }
        
        // 각 규칙 체크 (3단계 필터링)
        for (const rule of activeRules) {
          const ruleId = rule[0];
          const ruleName = rule[1];
          const receiverFilter = rule[2] || ''; // C열: 수신번호 필터
          const senderFilter = rule[3] || '';   // D열: 발신번호 필터
          const keywordFilter = rule[4] || '';  // E열: 키워드 필터
          
          let isMatch = true;
          
          // 1단계: 수신번호 필터 체크
          if (receiverFilter && !receiver.includes(receiverFilter)) {
            console.log(`  ✗ 수신번호 불일치: 규칙=${receiverFilter}, 실제=${receiver}`);
            isMatch = false;
          }
          
          // 2단계: 발신번호 필터 체크
          if (isMatch && senderFilter && !sender.includes(senderFilter)) {
            console.log(`  ✗ 발신번호 불일치: 규칙=${senderFilter}, 실제=${sender}`);
            isMatch = false;
          }
          
          // 3단계: 키워드 필터 체크 (쉼표로 구분된 키워드 중 하나라도 포함되면 OK)
          if (isMatch && keywordFilter) {
            const keywords = keywordFilter.split(',').map(k => k.trim());
            const hasKeyword = keywords.some(keyword => message.includes(keyword));
            if (!hasKeyword) {
              console.log(`  ✗ 키워드 불일치: 규칙=[${keywords.join(',')}], 메시지=${message.substring(0, 30)}...`);
              isMatch = false;
            }
          }
          
          if (isMatch) {
            matchedRule = rule;
            console.log(`✅ 규칙 매칭 성공: ${ruleName} (ID: ${ruleId})`);
            console.log(`   수신번호: ${receiver} ✓`);
            console.log(`   발신번호: ${sender} ✓`);
            console.log(`   키워드: ${keywordFilter || '(필터 없음)'} ✓`);
            
            // 매칭 정보 수집
            if (receiverFilter) matchedFilters.push(`수신번호:${receiverFilter}`);
            if (senderFilter) matchedFilters.push(`발신번호:${senderFilter}`);
            if (keywordFilter) {
              const keywords = keywordFilter.split(',').map(k => k.trim());
              matchedFilters.push(`키워드:${keywords.join(',')}`);
            }
            matchInfo = matchedFilters.length > 0 
              ? ` | 일치: ${matchedFilters.join(', ')}` 
              : '';
            
            break;
          }
        }
        
        // 매칭 실패 시 바로 리턴 (시트에 저장 안 함)
        if (!matchedRule) {
          console.log('❌ 매칭된 규칙 없음 - 시트 저장 스킵');
          return res.json({ success: true, skipped: true, reason: 'no-match' });
        }
      } else {
        console.log('❌ 규칙 없음 - 시트 저장 스킵');
        return res.json({ success: true, skipped: true, reason: 'no-rules' });
      }
    } catch (ruleError) {
      console.error('규칙 조회 실패:', ruleError);
      return res.json({ success: true, skipped: true, reason: 'rule-check-error' });
    }
    
    // ==================================================
    // 📝 2단계: 매칭 성공 - 시트에 저장
    // ==================================================
    console.log('✅ 규칙 매칭 성공 - 시트에 저장 시작');
    
    // ID 생성
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:A`,
    });
    
    const newId = (response.data.values || []).length;
    const receivedAt = timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // 매칭된 규칙 정보 추출
    const ruleId = matchedRule[0];
    const ruleName = matchedRule[1];
    const targetNumbersStr = matchedRule[5] || ''; // F열: 전달대상번호들
    const targetNumbers = targetNumbersStr.split(',').map(n => n.trim()).filter(n => n);
    
    // SMS관리 시트에 추가 (바로 "대기중" 상태로)
    const matchInfoForStatus = matchInfo.replace(/^ \| /, '').trim();
    const newRow = [
      newId,
      receivedAt,
      sender,
      receiver,
      message,
      `대기중 (규칙: ${ruleName}, ${matchInfoForStatus})`,
      '',
      targetNumbersStr,
      `자동전달 준비`
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:I`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    console.log(`✅ 시트 저장 완료 (ID: ${newId}) - 자동 전달 대기중`);
    
    // ==================================================
    // 🚀 3단계: 자동 전달 준비 완료
    // ==================================================
    console.log(`✅ 자동 전달 준비 완료: ${targetNumbers.length}개 번호 (앱이 실제 전송할 예정)`);
    
    // ============================================
    // 자동응답 로직 시작
    // ============================================
    console.log('🤖 자동응답 규칙 확인 시작...');
    
    try {
      // 1. 발신번호가 등록된 거래처/영업사원인지 확인
      let isRegistered = false;
      let clientName = '';
      let responsibleSalesPhone = '';
      
      // 1-1. 폰클출고처데이터에서 확인 (W-AA열: 22-26)
      const storeCheckResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STORE_SHEET_NAME}!A:AA`,
      });
      
      const storeRows = storeCheckResponse.data.values || [];
      if (storeRows.length > 1) {
        for (const row of storeRows.slice(1)) {
          const storeName = row[14] || '';  // O열(14): 업체명
          const salesPerson = row[5] || '';  // F열(5): 담당자 연락처
          
          // W-AA열(22-26): 휴대폰번호 1-5 확인
          for (let i = 22; i <= 26; i++) {
            const phone = row[i] || '';
            if (phone && phone.trim() === sender) {
              isRegistered = true;
              clientName = storeName;
              responsibleSalesPhone = salesPerson;
              console.log(`✅ 시트에서 거래처 확인: ${clientName} (담당: ${salesPerson})`);
              break;
            }
          }
          if (isRegistered) break;
        }
      }
      
      // 1-2. SMS자동응답거래처 시트에서 확인 (앱 등록)
      if (!isRegistered) {
        const contactsCheckResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A:H`,
        });
        
        const contactRows = contactsCheckResponse.data.values || [];
        if (contactRows.length > 1) {
          for (const row of contactRows.slice(1)) {
            const contact = row[4] || '';
            if (contact && contact.trim() === sender) {
              isRegistered = true;
              clientName = row[3] || '';
              const salesPersonId = row[2] || '';
              
              // 담당 영업사원 폰 번호 찾기
              if (row[1] === '영업사원') {
                // 유형이 영업사원이면 본인 연락처가 발송 번호
                responsibleSalesPhone = contact;
              } else {
                // 거래처면 담당 영업사원 찾기
                responsibleSalesPhone = salesPersonId;
              }
              
              console.log(`✅ 앱에서 등록된 연락처 확인: ${clientName} (담당: ${responsibleSalesPhone})`);
              break;
            }
          }
        }
      }
      
      if (!isRegistered) {
        console.log('미등록 번호 - 자동응답 스킵:', sender);
      } else {
        // 2. 자동응답 규칙 확인
        const rulesResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A:K`,
        });
        
        const rulesRows = rulesResponse.data.values || [];
        
        if (rulesRows.length > 1) {
          const rulesData = rulesRows.slice(1);
          
          // 활성화된 규칙만 필터링하고 우선순위 정렬
          const activeRules = rulesData
            .filter(rule => rule[6] === 'O')
            .sort((a, b) => (parseInt(a[7]) || 999) - (parseInt(b[7]) || 999));
          
          console.log(`활성화된 자동응답 규칙: ${activeRules.length}개`);
          
          let matchedAutoReplyRule = null;
          
          // 우선순위 순으로 규칙 체크
          for (const rule of activeRules) {
            const ruleKeywords = rule[2] || '';
            const keywords = ruleKeywords.split(',').map(k => k.trim()).filter(k => k);
            
            // 키워드 매칭
            const hasKeyword = keywords.some(keyword => message.includes(keyword));
            
            if (hasKeyword) {
              matchedAutoReplyRule = rule;
              console.log(`✅ 자동응답 규칙 매칭: ${rule[1]} (우선순위: ${rule[7]})`);
              break;
            }
          }
          
          if (matchedAutoReplyRule) {
            // 3. 답변 생성
            const ruleName = matchedAutoReplyRule[1];
            const answerType = matchedAutoReplyRule[3] || '템플릿';
            const answerTemplate = matchedAutoReplyRule[4] || '';
            
            let replyMessage = answerTemplate;
            
            // TODO: Phase 2에서 실시간가격 처리 추가
            
            // 4. 자동응답이력에 기록 (대기중 상태)
            const historyResponse = await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A:A`,
            });
            
            const historyRows = historyResponse.data.values || [];
            const historyId = historyRows.length;
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            
            const historyRow = [
              historyId,
              now,
              sender,
              clientName,
              message.substring(0, 100), // 문의내용 (최대 100자)
              ruleName,
              replyMessage,
              responsibleSalesPhone,
              '대기중',
              ''
            ];
            
            await sheets.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A:J`,
              valueInputOption: 'RAW',
              insertDataOption: 'INSERT_ROWS',
              resource: {
                values: [historyRow]
              }
            });
            
            console.log(`✅ 자동응답 준비 완료: ${sender}에게 "${replyMessage.substring(0, 30)}..." 발송 예정 (발송번호: ${responsibleSalesPhone})`);
          } else {
            console.log('매칭된 자동응답 규칙 없음');
          }
        }
      }
    } catch (autoReplyError) {
      console.error('자동응답 처리 중 오류:', autoReplyError);
      // 자동응답 실패해도 SMS 등록은 성공으로 처리
    }
    
    res.json({ success: true, id: newId });
    
  } catch (error) {
    console.error('SMS 등록 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 통계 API (선택)
app.get('/api/sms/stats', async (req, res) => {
  try {
    console.log('SMS 통계 조회');
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:I`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, stats: { total: 0, pending: 0, forwarded: 0, failed: 0, receiveOnly: 0 } });
    }
    
    const dataRows = rows.slice(1);
    
    const stats = {
      total: dataRows.length,
      pending: dataRows.filter(row => (row[5] || '').startsWith('대기중')).length,
      forwarded: dataRows.filter(row => (row[5] || '').startsWith('전달완료')).length,
      failed: dataRows.filter(row => {
        const status = row[5] || '';
        return status.startsWith('실패') || status.startsWith('부분실패');
      }).length,
      receiveOnly: dataRows.filter(row => (row[5] || '').startsWith('수신만')).length
    };
    
    res.json({ success: true, stats });
    
  } catch (error) {
    console.error('SMS 통계 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 전달 상태 업데이트 API (안드로이드 앱용)
app.post('/api/sms/update-forward-status', async (req, res) => {
  try {
    const { smsId, results } = req.body;
    
    console.log(`SMS 전달 상태 업데이트: SMS ID=${smsId}, 결과=${results.length}개`);
    
    if (!smsId || !results || results.length === 0) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    }
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // 이력 ID 생성용
    const historyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_HISTORY_SHEET_NAME}!A:A`,
    });
    
    let historyId = (historyResponse.data.values || []).length;
    
    // 각 전달 결과별로 이력 추가
    const historyRows = [];
    let successCount = 0;
    let failCount = 0;
    const targetNumbers = [];
    
    for (const result of results) {
      const historyRow = [
        historyId++,
        smsId,
        now,
        result.targetNumber,
        result.success ? '성공' : '실패',
        result.errorMessage || '',
        '앱전송',
        ''
      ];
      
      historyRows.push(historyRow);
      targetNumbers.push(result.targetNumber);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    // 이력 시트에 추가
    if (historyRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_HISTORY_SHEET_NAME}!A:H`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: historyRows
        }
      });
    }
    
    // SMS관리 시트 업데이트
    const smsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_SHEET_NAME}!A:I`,
    });
    
    const smsRows = smsResponse.data.values || [];
    const smsRowIndex = smsRows.findIndex(row => row[0] === smsId);
    
    if (smsRowIndex !== -1) {
      // 전달상태에 상세 정보 + 매칭 정보 포함
      const existingStatus = smsRows[smsRowIndex][5] || ''; // F열: 전달상태
      const matchInfoRaw = existingStatus.includes('일치:') 
        ? existingStatus.split('일치:')[1].trim() 
        : '';
      const matchInfoForStatus = matchInfoRaw ? `, 일치: ${matchInfoRaw}` : '';
      const forwardStatus = failCount === 0 
        ? `전달완료 (성공:${successCount}, 실패:0${matchInfoForStatus})` 
        : successCount > 0 
          ? `부분실패 (성공:${successCount}, 실패:${failCount}${matchInfoForStatus})` 
          : `실패 (성공:0, 실패:${failCount}${matchInfoForStatus})`;
      const targetNumbersStr = targetNumbers.join(',');
      
      // 처리메모는 간단 유지
      const memo = '전송 완료';
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_SHEET_NAME}!F${smsRowIndex + 1}:I${smsRowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[forwardStatus, now, targetNumbersStr, memo]]
        }
      });
    }
    
    console.log(`✅ 전달 상태 업데이트 완료: 성공=${successCount}, 실패=${failCount}`);
    
    res.json({ 
      success: true, 
      successCount,
      failCount
    });
    
  } catch (error) {
    console.error('SMS 전달 상태 업데이트 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SMS 데이터 정리 API
app.post('/api/sms/cleanup', async (req, res) => {
  try {
    const { days, target } = req.body; // days: 며칠 이전 데이터 삭제, target: 'sms' | 'history' | 'all'
    
    console.log(`SMS 데이터 정리: ${days}일 이전, 대상=${target}`);
    
    if (days === undefined || days === null || !target) {
      return res.status(400).json({ success: false, error: '필수 파라미터가 누락되었습니다.' });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().substring(0, 10);
    
    let deletedCount = 0;
    
    // days가 0이면 전체 삭제
    const isDeleteAll = days === 0;
    console.log(`삭제 모드: ${isDeleteAll ? '전체 삭제' : `${days}일 이전 삭제`}`);
    
    // SMS 데이터 정리
    if (target === 'sms' || target === 'all') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_SHEET_NAME}!A:I`,
      });
      
      const rows = response.data.values || [];
      if (rows.length > 1) {
        const header = rows[0];
        const dataRows = rows.slice(1);
        
        console.log(`SMS 데이터 정리 전: ${dataRows.length}개`);
        
        // 날짜가 cutoffDate 이후인 데이터만 유지 (0일이면 모두 삭제)
        const filteredRows = isDeleteAll ? [] : dataRows.filter(row => {
          const receivedAt = row[1] || '';
          const receivedDate = receivedAt.substring(0, 10);
          return receivedDate >= cutoffDateStr;
        });
        
        deletedCount += dataRows.length - filteredRows.length;
        console.log(`SMS 데이터 정리 후: ${filteredRows.length}개, 삭제: ${deletedCount}개`);
        
        // 전체 범위를 먼저 빈 값으로 덮어쓰기 (기존 데이터 완전 제거)
        const totalRows = Math.max(rows.length + 100, 1000); // 충분히 큰 범위
        const emptyRows = Array(totalRows).fill(null).map(() => Array(9).fill(''));
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_SHEET_NAME}!A1:I${totalRows}`,
          valueInputOption: 'RAW',
          resource: {
            values: emptyRows
          }
        });
        
        // 헤더 + 필터링된 데이터만 다시 쓰기
        if (filteredRows.length > 0 || header) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SMS_SHEET_NAME}!A1:I${filteredRows.length + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [header, ...filteredRows]
            }
          });
        } else {
          // 데이터가 없으면 헤더만
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SMS_SHEET_NAME}!A1:I1`,
            valueInputOption: 'RAW',
            resource: {
              values: [header]
            }
          });
        }
      }
    }
    
    // 이력 데이터 정리
    if (target === 'history' || target === 'all') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SMS_HISTORY_SHEET_NAME}!A:H`,
      });
      
      const rows = response.data.values || [];
      if (rows.length > 1) {
        const header = rows[0];
        const dataRows = rows.slice(1);
        
        console.log(`이력 데이터 정리 전: ${dataRows.length}개`);
        
        // 날짜가 cutoffDate 이후인 데이터만 유지 (0일이면 모두 삭제)
        const filteredRows = isDeleteAll ? [] : dataRows.filter(row => {
          const forwardedAt = row[2] || '';
          const forwardedDate = forwardedAt.substring(0, 10);
          return forwardedDate >= cutoffDateStr;
        });
        
        const historyDeletedCount = dataRows.length - filteredRows.length;
        deletedCount += historyDeletedCount;
        console.log(`이력 데이터 정리 후: ${filteredRows.length}개, 삭제: ${historyDeletedCount}개`);
        
        // 전체 범위를 먼저 빈 값으로 덮어쓰기 (기존 데이터 완전 제거)
        const totalRows = Math.max(rows.length + 100, 1000); // 충분히 큰 범위
        const emptyRows = Array(totalRows).fill(null).map(() => Array(8).fill(''));
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SMS_HISTORY_SHEET_NAME}!A1:H${totalRows}`,
          valueInputOption: 'RAW',
          resource: {
            values: emptyRows
          }
        });
        
        // 헤더 + 필터링된 데이터만 다시 쓰기
        if (filteredRows.length > 0 || header) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SMS_HISTORY_SHEET_NAME}!A1:H${filteredRows.length + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [header, ...filteredRows]
            }
          });
        } else {
          // 데이터가 없으면 헤더만
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SMS_HISTORY_SHEET_NAME}!A1:H1`,
            valueInputOption: 'RAW',
            resource: {
              values: [header]
            }
          });
        }
      }
    }
    
    res.json({ success: true, deletedCount });
    
  } catch (error) {
    console.error('SMS 데이터 정리 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SMS 자동응답 API
// ============================================

// 자동응답 규칙 조회 API
app.get('/api/sms/auto-reply/rules', async (req, res) => {
  try {
    console.log('자동응답 규칙 조회');
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A:K`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }
    
    const dataRows = rows.slice(1);
    const rules = dataRows.map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      keywords: row[2] || '',
      answerType: row[3] || '템플릿',
      answerTemplate: row[4] || '',
      priceConfig: row[5] || '',
      active: row[6] === 'O',
      priority: parseInt(row[7]) || 999,
      createdAt: row[8] || '',
      updatedAt: row[9] || '',
      memo: row[10] || ''
    }));
    
    res.json({ success: true, data: rules });
    
  } catch (error) {
    console.error('자동응답 규칙 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동응답 규칙 추가 API
app.post('/api/sms/auto-reply/rules', async (req, res) => {
  try {
    const { name, keywords, answerType, answerTemplate, priceConfig, active, priority, memo } = req.body;
    
    console.log('자동응답 규칙 추가:', name);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A:A`,
    });
    
    const rows = response.data.values || [];
    const newId = rows.length;
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const newRow = [
      newId,
      name,
      keywords,
      answerType || '템플릿',
      answerTemplate || '',
      priceConfig || '',
      active ? 'O' : 'X',
      priority || 999,
      now,
      now,
      memo || ''
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A:K`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    res.json({ success: true, id: newId });
    
  } catch (error) {
    console.error('자동응답 규칙 추가 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동응답 규칙 수정 API
app.put('/api/sms/auto-reply/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, keywords, answerType, answerTemplate, priceConfig, active, priority, memo } = req.body;
    
    console.log(`자동응답 규칙 수정: ID=${id}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);
    
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '규칙을 찾을 수 없습니다.' });
    }
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const createdAt = rows[rowIndex][8] || now;
    
    const updatedRow = [
      id,
      name,
      keywords,
      answerType || '템플릿',
      answerTemplate || '',
      priceConfig || '',
      active ? 'O' : 'X',
      priority || 999,
      createdAt,
      now,
      memo || ''
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A${rowIndex + 1}:K${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [updatedRow]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('자동응답 규칙 수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동응답 규칙 삭제 API
app.delete('/api/sms/auto-reply/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`자동응답 규칙 삭제: ID=${id}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!A:K`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);
    
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '규칙을 찾을 수 없습니다.' });
    }
    
    // 활성화를 X로 변경
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_RULES_SHEET_NAME}!G${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['X']]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('자동응답 규칙 삭제 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 거래처 연락처 조회 API
app.get('/api/sms/auto-reply/contacts', async (req, res) => {
  try {
    console.log('자동응답 거래처 연락처 조회');
    
    // 1. 폰클출고처데이터에서 거래처 연락처 로드 (W-AA열: 22-26인덱스)
    const storeResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${STORE_SHEET_NAME}!A:AA`,
    });
    
    const storeRows = storeResponse.data.values || [];
    const storeContacts = [];
    
    if (storeRows.length > 1) {
      storeRows.slice(1).forEach((row, index) => {
        const storeName = row[14] || '';  // O열(14): 업체명
        const salesPerson = row[5] || ''; // F열(5): 담당자
        
        // W-AA열(22-26): 휴대폰번호 1-5
        for (let i = 22; i <= 26; i++) {
          const phone = row[i] || '';
          if (phone && phone.trim()) {
            storeContacts.push({
              id: `store_${index}_${i}`,
              type: '거래처',
              salesPersonId: salesPerson,
              name: storeName,
              contact: phone.trim(),
              source: '시트'
            });
          }
        }
      });
    }
    
    // 2. SMS자동응답거래처 시트에서 앱 등록 연락처 로드
    const appContactsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A:H`,
    });
    
    const appRows = appContactsResponse.data.values || [];
    const appContacts = [];
    
    if (appRows.length > 1) {
      appRows.slice(1).forEach(row => {
        appContacts.push({
          id: row[0] || '',
          type: row[1] || '',
          salesPersonId: row[2] || '',
          name: row[3] || '',
          contact: row[4] || '',
          source: row[5] || '앱',
          createdAt: row[6] || '',
          memo: row[7] || ''
        });
      });
    }
    
    // 3. 합치기
    const allContacts = [...storeContacts, ...appContacts];
    
    res.json({ success: true, data: allContacts });
    
  } catch (error) {
    console.error('자동응답 거래처 연락처 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 거래처 연락처 추가 API (앱에서 추가 등록)
app.post('/api/sms/auto-reply/contacts', async (req, res) => {
  try {
    const { type, salesPersonId, name, contact, memo } = req.body;
    
    console.log('자동응답 거래처 추가:', name);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A:A`,
    });
    
    const rows = response.data.values || [];
    const newId = rows.length;
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const newRow = [
      newId,
      type || '거래처',
      salesPersonId || '',
      name || '',
      contact || '',
      '앱',
      now,
      memo || ''
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [newRow]
      }
    });
    
    res.json({ success: true, id: newId });
    
  } catch (error) {
    console.error('자동응답 거래처 추가 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 거래처 연락처 삭제 API
app.delete('/api/sms/auto-reply/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`자동응답 거래처 삭제: ID=${id}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A:H`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === id);
    
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '거래처를 찾을 수 없습니다.' });
    }
    
    // 해당 행 삭제 (빈 값으로 덮어쓰기)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_CONTACTS_SHEET_NAME}!A${rowIndex + 1}:H${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['', '', '', '', '', '', '', '']]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('자동응답 거래처 삭제 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동응답 이력 조회 API
app.get('/api/sms/auto-reply/history', async (req, res) => {
  try {
    const { limit = 100, status = 'all' } = req.query;
    
    console.log(`자동응답 이력 조회: limit=${limit}, status=${status}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A:J`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }
    
    const dataRows = rows.slice(1);
    
    let historyData = dataRows.map(row => ({
      id: row[0] || '',
      receivedAt: row[1] || '',
      sender: row[2] || '',
      clientName: row[3] || '',
      inquiry: row[4] || '',
      matchedRule: row[5] || '',
      reply: row[6] || '',
      senderPhone: row[7] || '',
      status: row[8] || '',
      sentAt: row[9] || ''
    }));
    
    // 상태 필터링
    if (status !== 'all') {
      historyData = historyData.filter(h => (h.status || '').startsWith(status));
    }
    
    // 최신순 정렬
    historyData.sort((a, b) => {
      if (b.receivedAt > a.receivedAt) return 1;
      if (b.receivedAt < a.receivedAt) return -1;
      return 0;
    });
    
    // 제한 적용
    historyData = historyData.slice(0, parseInt(limit));
    
    res.json({ success: true, data: historyData });
    
  } catch (error) {
    console.error('자동응답 이력 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동응답 발송 대기 목록 API (안드로이드 앱용)
app.get('/api/sms/auto-reply/pending', async (req, res) => {
  try {
    const { salesPhone } = req.query;
    
    console.log(`자동응답 발송 대기 목록 조회: salesPhone=${salesPhone}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A:J`,
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, data: [] });
    }
    
    const dataRows = rows.slice(1);
    
    // 대기중 상태이고 발송번호가 일치하는 것만 필터링
    const pendingReplies = dataRows
      .map((row, index) => ({
        id: row[0] || '',
        sender: row[2] || '',
        reply: row[6] || '',
        senderPhone: row[7] || '',
        status: row[8] || '',
        rowIndex: index + 2
      }))
      .filter(r => r.status === '대기중' && r.senderPhone === salesPhone);
    
    res.json({ success: true, data: pendingReplies });
    
  } catch (error) {
    console.error('자동응답 발송 대기 목록 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동응답 발송 상태 업데이트 API (안드로이드 앱용)
app.post('/api/sms/auto-reply/update-status', async (req, res) => {
  try {
    const { replyId, success, errorMessage } = req.body;
    
    console.log(`자동응답 발송 상태 업데이트: ID=${replyId}, success=${success}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!A:J`,
    });
    
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === replyId);
    
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '이력을 찾을 수 없습니다.' });
    }
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const status = success ? '발송완료' : '실패';
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SMS_AUTO_REPLY_HISTORY_SHEET_NAME}!I${rowIndex + 1}:J${rowIndex + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[status, now]]
      }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('자동응답 발송 상태 업데이트 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 서버 시작 (이미 위에서 처리됨)
  console.log(`🚀 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`📊 예산 관리 시스템이 준비되었습니다.`);
  console.log(`🕐 자동 재계산 스케줄러가 임시 비활성화되었습니다. (클라우드타입 패키지 문제)`);