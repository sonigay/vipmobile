require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const NodeGeocoder = require('node-geocoder');
const webpush = require('web-push');
const monthlyAwardAPI = require('./monthlyAwardAPI');

// 기본 설정
const app = express();
const port = process.env.PORT || 4000;

// CORS 설정 - 모든 도메인 허용
app.use(cors({
  origin: ['https://vipmobile.netlify.app', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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

// 캐싱 시스템 설정
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분 (5 * 60 * 1000ms)
const MAX_CACHE_SIZE = 100; // 최대 캐시 항목 수

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

// 주기적 캐시 정리 (5분마다)
setInterval(() => {
  cacheUtils.cleanup();
}, 5 * 60 * 1000);

// 주기적 배정 저장 (10분마다)
setInterval(async () => {
  try {
    console.log('🔄 [자동배정저장] 주기적 배정 저장 시작');
    
    // 폰클재고데이터 기준으로 현재 배정 상태 가져오기
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
          // 배정 저장 API 호출
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
const NORMALIZATION_HISTORY_SHEET_NAME = '정규화이력';  // 정규화 이력 데이터
const INSPECTION_MEMO_SHEET_NAME = '여직원검수데이터메모';  // 여직원 검수 데이터 메모 시트 추가
const INSPECTION_SETTINGS_SHEET_NAME = '검수설정';  // 검수 설정 시트
const RESERVATION_SITE_SHEET_NAME = '사전예약사이트';  // 사전예약사이트 시트
const YARD_RECEIPT_SHEET_NAME = '마당접수';  // 마당접수 시트
const ON_SALE_SHEET_NAME = '온세일';  // 온세일 시트
const POS_CODE_MAPPING_SHEET_NAME = 'POS코드변경설정';  // POS코드변경설정 시트
const NORMALIZATION_WORK_SHEET_NAME = '정규화작업';  // 정규화작업 시트

// 월간시상 관련 시트 이름 추가
const PHONEKL_HOME_DATA_SHEET_NAME = '폰클홈데이터';  // 폰클홈데이터 시트
const MONTHLY_AWARD_SETTINGS_SHEET_NAME = '장표모드셋팅메뉴';  // 월간시상 셋팅 메뉴 시트

// Kakao geocoding 함수 (개선된 버전)
async function geocodeAddressWithKakao(address, retryCount = 0) {
  const apiKey = process.env.KAKAO_API_KEY;
  if (!apiKey) {
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

// Google Sheets API 초기화
const sheets = google.sheets({ version: 'v4', auth });

// 데이터 시트에서 값 가져오기 (캐싱 적용)
async function getSheetValues(sheetName) {
  const cacheKey = `sheet_${sheetName}`;
  
  // 캐시에서 먼저 확인
  const cachedData = cacheUtils.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName
    });
    
    const data = response.data.values || [];
    
    // 캐시에 저장 (5분 TTL)
    cacheUtils.set(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error(`Error fetching sheet ${sheetName}:`, error);
    throw error;
  }
}

// VLOOKUP 함수 (폰클출고처데이터에서 POS코드로 업체명 찾기)
function vlookupPosCodeToStoreName(posCode, storeData) {
  if (!posCode || !storeData || storeData.length === 0) {
    return null;
  }
  
  const searchPosCode = posCode.toString().trim();
  
  // H열(POS코드)에서 검색하여 G열(업체명) 반환
  for (let i = 1; i < storeData.length; i++) { // 헤더 제외하고 검색
    const row = storeData[i];
    if (row && row.length > 7) { // 최소 H열(7)은 있어야 함
      const storePosCode = (row[7] || '').toString().trim(); // H열: POS코드
      if (storePosCode === searchPosCode) {
        return (row[6] || '').toString().trim(); // G열: 업체명
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
  
  // G열(업체명)에서 검색하여 H열(POS코드) 반환
  for (let i = 1; i < storeData.length; i++) { // 헤더 제외하고 검색
    const row = storeData[i];
    if (row && row.length > 7) { // 최소 H열(7)은 있어야 함
      const rowStoreName = (row[6] || '').toString().trim(); // G열: 업체명
      if (rowStoreName === searchStoreName) {
        return (row[7] || '').toString().trim(); // H열: POS코드
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
    
    // 헤더 제외하고 데이터 처리
    for (let i = 1; i < memoData.length; i++) {
      const row = memoData[i];
      if (row && row.length >= 6) {
        const subscriptionNumber = (row[0] || '').toString().trim(); // A열: 가입번호
        const userId = (row[1] || '').toString().trim(); // B열: 사용자ID
        const isCompleted = (row[2] || '').toString().trim() === '완료'; // C열: 완료상태
        const memoContent = (row[3] || '').toString().trim(); // D열: 메모내용
        const updateTime = (row[4] || '').toString().trim(); // E열: 업데이트시간
        const fieldType = (row[5] || '').toString().trim(); // F열: 필드구분
        
        if (subscriptionNumber && userId) {
          // 완료상태 저장
          if (isCompleted) {
            completionStatus.set(subscriptionNumber, {
              userId,
              isCompleted: true,
              timestamp: updateTime || new Date().toISOString()
            });
          }
          
          // 메모내용 저장
          if (memoContent) {
            notes.set(subscriptionNumber, {
              userId,
              notes: memoContent,
              timestamp: updateTime || new Date().toISOString()
            });
          }
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
    // 헤더 행
    const headerRow = ['가입번호', '사용자ID', '완료상태', '메모내용', '업데이트시간', '필드구분'];
    
    // 데이터 행들 생성
    const dataRows = [];
    
    // 완료상태 데이터
    for (const [subscriptionNumber, status] of completionStatus) {
      if (status.isCompleted) {
        dataRows.push([
          subscriptionNumber,
          status.userId,
          '완료',
          '', // 메모는 별도로 처리
          status.timestamp,
          '전체'
        ]);
      }
    }
    
    // 메모내용 데이터
    for (const [subscriptionNumber, noteData] of notes) {
      const existingRowIndex = dataRows.findIndex(row => row[0] === subscriptionNumber);
      if (existingRowIndex >= 0) {
        // 기존 행에 메모 추가
        dataRows[existingRowIndex][3] = noteData.notes;
        dataRows[existingRowIndex][4] = noteData.timestamp;
      } else {
        // 새 행 생성
        dataRows.push([
          subscriptionNumber,
          noteData.userId,
          '대기',
          noteData.notes,
          noteData.timestamp,
          '전체'
        ]);
      }
    }
    
    // 시트 전체 삭제 후 새 데이터로 업데이트
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: INSPECTION_MEMO_SHEET_NAME
    });
    
    if (dataRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:F`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headerRow, ...dataRows]
        }
      });
    }
    

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
    
    // 현재 검수 대상에 있는 가입번호만 필터링
    const validRows = [memoData[0]]; // 헤더 유지
    
    for (let i = 1; i < memoData.length; i++) {
      const row = memoData[i];
      if (row && row.length > 0) {
        const subscriptionNumber = (row[0] || '').toString().trim();
        if (currentInspectionKeys.has(subscriptionNumber)) {
          validRows.push(row);
        }
      }
    }
    
    // 시트 업데이트 (유효한 데이터만 유지)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: INSPECTION_MEMO_SHEET_NAME
    });
    
    if (validRows.length > 1) { // 헤더 외에 데이터가 있는 경우
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${INSPECTION_MEMO_SHEET_NAME}!A:F`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: validRows
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
      const address = row[3];  // D열: 주소
      const status = row[4];    // E열: 거래상태
      
      if (status === "사용") {
        if (!address || address.toString().trim() === '') {
          // 사용 상태이지만 주소가 없는 경우 좌표 삭제
          updates.push({
            range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
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
              range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
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
          range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
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
      if (!row || row.length < 15) return; // 최소 O열까지 데이터가 있어야 함
      
      const storeName = (row[13] || '').toString().trim();  // N열: 매장명
      const model = (row[5] || '').toString().trim();      // F열: 모델
      const color = (row[6] || '').toString().trim();      // G열: 색상
      const status = (row[7] || '').toString().trim();     // H열: 상태 (정상, 이력, 불량)
      const type = (row[4] || '').toString().trim();       // E열: 종류 (단말기, 웨어러블, 스마트기기, 유심)
      const shippingDate = row[14] ? new Date(row[14]) : null;  // O열: 출고일
      
      if (!storeName || !model || !color) return;

      // 출고일이 있고, 최근 3일 이내인 경우 재고에서 제외 (includeShipped가 'false'일 때만)
      if (includeShipped === 'false' && shippingDate && threeDaysAgo && shippingDate >= threeDaysAgo) {
        excludedCount++;
        return;
      }

      // 매장별 재고 데이터 구조 생성
      if (!inventoryMap[storeName]) {
        inventoryMap[storeName] = {
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
      
      if (!inventoryMap[storeName][category][model]) {
        inventoryMap[storeName][category][model] = {};
      }
      
      // 상태별로 수량 관리
      if (!inventoryMap[storeName][category][model][status]) {
        inventoryMap[storeName][category][model][status] = {};
      }
      
      // 같은 모델/색상/상태 조합의 수량과 출고일 정보 관리
      if (!inventoryMap[storeName][category][model][status][color]) {
        inventoryMap[storeName][category][model][status][color] = {
          quantity: 1,
          shippedDate: shippingDate ? shippingDate.toISOString() : null
        };
      } else {
        inventoryMap[storeName][category][model][status][color].quantity++;
        // 출고일이 더 오래된 것으로 업데이트 (가장 오래된 재고 기준)
        if (shippingDate && (!inventoryMap[storeName][category][model][status][color].shippedDate || 
            shippingDate < new Date(inventoryMap[storeName][category][model][status][color].shippedDate))) {
          inventoryMap[storeName][category][model][status][color].shippedDate = shippingDate.toISOString();
        }
      }
    });

    // 매장 정보와 재고 정보 결합
    const stores = storeRows
      .filter(row => {
        const name = (row[6] || '').toString().trim();  // G열: 업체명
        const status = row[4];                          // E열: 거래상태
        return name && status === "사용";
      })
      .map(row => {
        const latitude = parseFloat(row[0] || '0');    // A열: 위도
        const longitude = parseFloat(row[1] || '0');   // B열: 경도
        const status = row[4];                         // E열: 거래상태
        const name = row[6].toString().trim();         // G열: 업체명
        const storeId = row[7];                        // H열: 매장 ID
        const phone = row[9] || '';                    // J열: 연락처
        const manager = row[13] || '';                 // N열: 담당자
        const address = (row[3] || '').toString();    // D열: 주소
        
        // 빈 매장 ID 제외
        if (!storeId || storeId.toString().trim() === '') {
          return null;
        }

        const inventory = inventoryMap[name] || {};

        return {
          id: storeId.toString(),
          name,
          address,
          phone,
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
      if (row.length < 8) return;
      
      const model = (row[5] || '').toString().trim();    // F열: 모델
      const color = (row[6] || '').toString().trim();    // G열: 색상
      const status = (row[7] || '').toString().trim();   // H열: 상태
      const type = (row[4] || '').toString().trim();     // E열: 종류
      
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
      .filter(row => row[6] !== '선불개통') // L열: 개통 (선불개통 제외)
      .map(row => {
        return {
          '담당자': row[0] || '',        // A열: 담당자
          '개통일': row[1] || '',        // B열: 개통일
          '개통시': row[2] || '',        // C열: 개통시
          '개통분': row[3] || '',        // D열: 개통분
          '출고처': row[6] || '',        // G열: 출고처
          '개통': row[11] || '',         // L열: 개통
          '모델명': row[13] || '',       // N열: 모델명
          '색상': row[14] || '',         // O열: 색상
          '일련번호': row[15] || ''      // P열: 일련번호
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
      .filter(row => row[6] !== '선불개통') // L열: 개통 (선불개통 제외)
      .map(row => {
        return {
          '담당자': row[0] || '',        // A열: 담당자
          '개통일': row[1] || '',        // B열: 개통일
          '개통시': row[2] || '',        // C열: 개통시
          '개통분': row[3] || '',        // D열: 개통분
          '출고처': row[6] || '',        // G열: 출고처
          '개통': row[11] || '',         // L열: 개통
          '모델명': row[13] || '',       // N열: 모델명
          '색상': row[14] || '',         // O열: 색상
          '일련번호': row[15] || ''      // P열: 일련번호
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
      if (row[6] === '선불개통') return; // 선불개통 제외
      
      const store = row[6] || '미지정'; // G열: 출고처
      const agent = row[0] || '미지정'; // A열: 담당자
      const activationDate = row[1] || ''; // B열: 개통일
      const model = row[13] || '미지정'; // N열: 모델명
      const color = row[14] || '미지정'; // O열: 색상
      
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
      if (row[6] === '선불개통') return; // 선불개통 제외
      
      const store = row[6] || '미지정'; // G열: 출고처
      const agent = row[0] || '미지정'; // A열: 담당자
      const activationDate = row[1] || ''; // B열: 개통일
      const model = row[13] || '미지정'; // N열: 모델명
      const color = row[14] || '미지정'; // O열: 색상
      
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
      if (row[6] === '선불개통') return; // 선불개통 제외
      
      const store = row[6] || '미지정'; // G열: 출고처
      const agent = row[0] || '미지정'; // A열: 담당자
      const activationDate = row[1] || ''; // B열: 개통일
      const model = row[13] || '미지정'; // N열: 모델명
      const color = row[14] || '미지정'; // O열: 색상
      
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
    
    // console.log(`Login attempt with ID: ${storeId}`);
    // console.log('Step 1: Starting login process...');
    
    // 1. 먼저 대리점 관리자 ID인지 확인 (구글시트 기반)
    // console.log('Step 2: Checking if ID is agent...');
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    // console.log('Step 3: Agent sheet data fetched, rows:', agentValues ? agentValues.length : 0);
    
    if (agentValues) {
      const agentRows = agentValues.slice(1);
      // console.log('Step 4: Agent rows (excluding header):', agentRows.length);
      
      const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디)
      // console.log('Step 5: Agent search result:', agent ? 'Found' : 'Not found');
      
      if (agent) {
        // console.log(`Found agent: ${agent[0]}, ${agent[1]}`);
        // console.log('Step 6: Processing agent login...');
        
        // F열: 재고모드 권한, G열: 정산모드 권한, H열: 검수모드 권한, I열: 채권장표 메뉴 권한, J열: 정책모드 권한, K열: 검수전체현황 권한, L열: 회의모드 권한, M열: 사전예약모드 권한, N열: 장표모드 권한 확인
        const hasInventoryPermission = agent[5] === 'O'; // F열
        const hasSettlementPermission = agent[6] === 'O'; // G열
        const hasInspectionPermission = agent[7] === 'O'; // H열
        const hasBondChartPermission = agent[8] === 'O'; // I열: 채권장표 메뉴 권한
        const hasPolicyPermission = agent[9] === 'O'; // J열
        const hasInspectionOverviewPermission = agent[10] === 'O'; // K열
        const hasMeetingPermission = agent[11] === 'O'; // L열
        const hasReservationPermission = agent[12] === 'O'; // M열
        const hasChartPermission = agent[13] === 'O'; // N열: 장표모드 권한
        
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
          agent: true, // 관리자 모드는 기본
          inventory: hasInventoryPermission,
          settlement: hasSettlementPermission,
          inspection: hasInspectionPermission,
          bondChart: hasBondChartPermission, // 채권장표 메뉴 권한
          chart: hasChartPermission, // 장표모드 권한
          policy: hasPolicyPermission,
          inspectionOverview: hasInspectionOverviewPermission,
          meeting: hasMeetingPermission,
          reservation: hasReservationPermission
        };
        
        // 디스코드로 로그인 로그 전송
        if (DISCORD_LOGGING_ENABLED) {
          try {
            const embedData = {
              title: '관리자 로그인',
              color: 15844367, // 보라색
              timestamp: new Date().toISOString(),
              userType: 'agent', // 관리자 타입 지정
                              fields: [
                  {
                    name: '관리자 정보',
                    value: `ID: ${agent[2]}\n대상: ${agent[0]}\n자격: ${agent[1]}\n재고권한: ${hasInventoryPermission ? 'O' : 'X'}\n정산권한: ${hasSettlementPermission ? 'O' : 'X'}\n검수권한: ${hasInspectionPermission ? 'O' : 'X'}\n채권장표권한: ${hasBondChartPermission ? 'O' : 'X'}\n장표권한: ${hasChartPermission ? 'O' : 'X'}\n정책권한: ${hasPolicyPermission ? 'O' : 'X'}\n검수전체현황권한: ${hasInspectionOverviewPermission ? 'O' : 'X'}\n회의권한: ${hasMeetingPermission ? 'O' : 'X'}\n사전예약권한: ${hasReservationPermission ? 'O' : 'X'}`
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
            
            await sendLogToDiscord(embedData);
          } catch (logError) {
            console.error('로그인 로그 전송 실패:', logError.message);
            // 로그 전송 실패해도 로그인은 허용
          }
        }
        
        return res.json({
          success: true,
          isAgent: true,
          modePermissions: modePermissions,
          agentInfo: {
            target: agent[0] || '',       // A열: 대상
            qualification: agent[1] || '', // B열: 자격
            contactId: agent[2] || '',     // C열: 연락처(아이디)
            office: agent[3] || '',        // D열: 사무실
            department: agent[4] || ''     // E열: 소속
          }
        });
      }
    }
    
    // 2. 대리점 관리자가 아닌 경우 일반 매장으로 검색
    const storeValues = await getSheetValues(STORE_SHEET_NAME);
    
    if (!storeValues) {
      throw new Error('Failed to fetch data from store sheet');
    }
    
    const storeRows = storeValues.slice(1);
    
    const foundStoreRow = storeRows.find(row => {
      const rowId = row[7];
      return rowId === storeId;
    }); // G열: 매장 ID로 수정
    
    if (foundStoreRow) {
      const store = {
        id: foundStoreRow[7],                      // H열: 매장 ID
        name: foundStoreRow[6],                    // G열: 업체명
        manager: foundStoreRow[13] || '',          // N열: 담당자
        address: foundStoreRow[3] || '',          // D열: 주소
        latitude: parseFloat(foundStoreRow[0] || '0'),  // A열: 위도
        longitude: parseFloat(foundStoreRow[1] || '0'),  // B열: 경도
        phone: foundStoreRow[11] || ''              // L열: 연락처 추가
      };
      
      // 디스코드로 로그인 로그 전송
      if (DISCORD_LOGGING_ENABLED) {
        try {
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
          
          await sendLogToDiscord(embedData);
        } catch (logError) {
          console.error('로그인 로그 전송 실패:', logError.message);
          // 로그 전송 실패해도 로그인은 허용
        }
      }
      
      return res.json({
        success: true,
        isAgent: false,
        storeInfo: store
      });
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
    const storeValues = await getSheetValues(STORE_SHEET_NAME);
    if (!storeValues) {
      throw new Error('Failed to fetch data from store sheet');
    }

    // 헤더 제거
    const storeRows = storeValues.slice(1);
    const updates = [];
    
    // 모든 주소에 대해 좌표 업데이트 (행 위치가 변경되어도 항상 처리)
    for (let i = 0; i < storeRows.length; i++) {
      const row = storeRows[i];
      const address = row[3];  // D열: 주소
      const status = row[4];    // E열: 거래상태
      
      if (status === "사용") {
        if (!address || address.toString().trim() === '') {
          // 사용 상태이지만 주소가 없는 경우 좌표 삭제
          updates.push({
            range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
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
              range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
              values: [[latitude, longitude]]
            });
          }
        } catch (error) {
          console.error(`Geocoding 오류: ${address}`, error.message);
        }
      } else {
        // 미사용 매장은 위도/경도 값을 빈 값으로 비움
        updates.push({
          range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
          values: [["", ""]]
        });
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
    }
  } catch (error) {
    console.error('Error in checkAndUpdateAddresses:', error);
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
      if (row.length >= 8) {
        const storeName = (row[6] || '').toString().trim(); // G열: 출고처명
        const posCode = (row[7] || '').toString().trim(); // H열: POS코드
        
        if (storeName && posCode) {
          storePosCodeMapping.set(storeName, posCode);
        }
      }
    });
    
    // 4. 폰클재고데이터에서 사용 가능한 재고 정보 생성
    const availableInventory = new Map(); // key: "모델명_색상_POS코드", value: [일련번호들]
    const serialNumberToStore = new Map(); // key: 일련번호, value: 출고처명
    
    phoneklInventoryValues.slice(1).forEach(row => {
      if (row.length >= 15) {
        const serialNumber = (row[3] || '').toString().trim(); // D열: 일련번호
        const modelCapacity = (row[5] || '').toString().trim(); // F열: 모델명&용량
        const color = (row[6] || '').toString().trim(); // G열: 색상
        const storeName = (row[13] || '').toString().trim(); // N열: 출고처
        
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
        if (row.length >= 16) {
          const serialNumber = (row[15] || '').toString().trim(); // P열: 일련번호
          const storeName = (row[6] || '').toString().trim(); // G열: 출고처
          
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
      
      if (!reservationNumber || !customerName || !model || !capacity || !color || !posCode) {
        skippedCount++;
        return;
      }
      
      // 정규화된 모델명 생성 (사전예약사이트 형식)
      const reservationSiteModel = `${model} ${capacity} ${color}`.trim();
      const normalizedRule = normalizationRules.get(reservationSiteModel);
      

      
      if (!normalizedRule) {
        normalizationFailedCount++;
        return;
      }
      
      const phoneklModel = normalizedRule.phoneklModel;
      const phoneklColor = normalizedRule.phoneklColor;
      
      // 재고 키 생성
      const inventoryKey = `${phoneklModel}_${posCode}`;
      

      
      // 해당 재고 확인
      const availableSerials = availableInventory.get(inventoryKey) || [];
      

      

      
      // 배정 상태 계산
      let assignmentStatus = '미배정';
      let activationStatus = '미개통';
      let assignedSerial = '';
      let waitingOrder = 0;
      
      // 이미 배정된 일련번호가 있는 경우
      if (assignedSerialNumber && assignedSerialNumber.trim() !== '') {
        assignedSerial = assignedSerialNumber;
        assignmentStatus = '배정완료';
        successfulAssignmentCount++;
        
        // 개통 상태 확인
        if (activatedSerialNumbers.has(assignedSerialNumber)) {
          activationStatus = '개통완료';
        }
        
      } else {
        // 새로운 배정이 필요한 경우
        const unassignedSerials = availableSerials.filter(serial => !assignedSerialNumbers.has(serial));
        
        if (unassignedSerials.length > 0) {
          // 배정 가능한 재고가 있음
          assignedSerial = unassignedSerials[0];
          assignmentStatus = '배정완료';
          assignedSerialNumbers.add(assignedSerial);
          successfulAssignmentCount++;
          

          
          // 개통 상태 확인
          if (activatedSerialNumbers.has(assignedSerial)) {
            activationStatus = '개통완료';
          }
          
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
    
    // 기존 배정 데이터 수집
    for (let i = 1; i < reservationSiteValues.length; i++) {
      const row = reservationSiteValues[i];
      if (row.length < 22) continue;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
      
      if (existingSerial && existingSerial.trim() !== '') {
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
    
    for (let i = 1; i < reservationSiteValues.length; i++) {
      const row = reservationSiteValues[i];
      if (row.length < 22) continue;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
      
      if (assignmentMap.has(reservationNumber)) {
        const newSerial = assignmentMap.get(reservationNumber);
        
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
      if (row.length >= 15) {
        const modelCapacity = (row[5] || '').toString().trim(); // F열: 모델명&용량
        const color = (row[6] || '').toString().trim(); // G열: 색상
        const storeName = (row[13] || '').toString().trim(); // N열: 출고처
        
        if (modelCapacity && color && storeName) {
          processedRows++;
          
          // 사무실명 추출 (괄호 안 부가 정보 제거하여 매핑)
          let officeName = '';
          // 괄호 안의 부가 정보 제거 (예: "안산사무실(안산고잔)" -> "안산사무실")
          const cleanStoreName = storeName.replace(/\([^)]*\)/g, '').trim();
          
          if (cleanStoreName.includes('평택')) {
            officeName = '평택사무실';
          } else if (cleanStoreName.includes('인천')) {
            officeName = '인천사무실';
          } else if (cleanStoreName.includes('군산')) {
            officeName = '군산사무실';
          } else if (cleanStoreName.includes('안산')) {
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
      if (row.length >= 15) {
        const serialNumber = (row[3] || '').toString().trim(); // D열: 일련번호
        const modelCapacity = (row[5] || '').toString().trim(); // F열: 모델명&용량
        const color = (row[6] || '').toString().trim(); // G열: 색상
        const storeName = (row[13] || '').toString().trim(); // N열: 출고처
        
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
    console.log('📱 [개통상태 디버깅] 개통 상태 확인 시작');
    
    // 캐시 키 생성
    const cacheKey = 'inventory_activation_status';
    
    // 캐시에서 먼저 확인 (5분 TTL)
    const cachedData = cacheUtils.get(cacheKey);
    if (cachedData) {
      console.log('✅ [개통상태 디버깅] 캐시된 개통 상태 반환');
      return res.json(cachedData);
    }
    
    // 폰클개통데이터에서 개통 완료된 일련번호 수집
    const phoneklActivationValues = await getSheetValues('폰클개통데이터');
    
    if (!phoneklActivationValues || phoneklActivationValues.length < 2) {
      throw new Error('폰클개통데이터를 가져올 수 없습니다.');
    }
    
    const activatedSerialNumbers = new Set();
    let activationCount = 0;
    
    phoneklActivationValues.slice(1).forEach((row, index) => {
      if (row.length >= 16) {
        const serialNumber = (row[15] || '').toString().trim(); // P열: 일련번호
        const storeName = (row[6] || '').toString().trim(); // G열: 출고처
        
        // 테스트용 디버깅: 일련번호 1005552 확인
        if (serialNumber === '1005552') {
          console.log(`🎯 [개통상태 디버깅] 테스트 일련번호 발견! 행 ${index + 2}:`, {
            serialNumber,
            storeName,
            rowLength: row.length
          });
        }
        
        if (serialNumber && storeName) {
          activatedSerialNumbers.add(serialNumber);
          activationCount++;
        }
      }
    });
    
    console.log(`📱 [개통상태 디버깅] 개통 데이터 처리 완료: ${activationCount}개 개통된 일련번호`);
    
    // 사전예약사이트에서 배정된 일련번호와 매칭
    const reservationSiteValues = await getSheetValues('사전예약사이트');
    
    if (!reservationSiteValues || reservationSiteValues.length < 2) {
      throw new Error('사전예약사이트 데이터를 가져올 수 없습니다.');
    }
    
    const activationResults = [];
    let matchedCount = 0;
    
    reservationSiteValues.slice(1).forEach((row, index) => {
      if (row.length < 22) return;
      
      const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
      const customerName = (row[7] || '').toString().trim(); // H열: 고객명
      const assignedSerialNumber = (row[6] || '').toString().trim(); // G열: 배정일련번호
      
      // 테스트용 디버깅: 일련번호 1005552가 배정된 고객 확인
      if (assignedSerialNumber === '1005552') {
        console.log(`🎯 [개통상태 디버깅] 테스트 일련번호 배정 고객 발견! 행 ${index + 2}:`, {
          reservationNumber,
          customerName,
          assignedSerialNumber,
          isActivated: activatedSerialNumbers.has(assignedSerialNumber)
        });
      }
      
      if (reservationNumber && customerName && assignedSerialNumber) {
        const isActivated = activatedSerialNumbers.has(assignedSerialNumber);
        
        activationResults.push({
          reservationNumber,
          customerName,
          assignedSerialNumber,
          activationStatus: isActivated ? '개통완료' : '미개통'
        });
        
        if (isActivated) {
          matchedCount++;
        }
      }
    });
    
    console.log(`📈 [개통상태 디버깅] 개통 상태 매칭 완료: ${matchedCount}개 개통완료, ${activationResults.length - matchedCount}개 미개통`);
    
    const result = {
      success: true,
      data: activationResults,
      total: activationResults.length,
      activated: matchedCount,
      notActivated: activationResults.length - matchedCount
    };
    
    // 결과 캐싱 (5분 TTL)
    cacheUtils.set(cacheKey, result, 5 * 60);
    
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

// 서버 시작
const server = app.listen(port, '0.0.0.0', async () => {
  try {
    // console.log(`서버가 포트 ${port}에서 실행 중입니다`);
    // console.log(`VAPID Public Key: ${vapidKeys.publicKey}`);
    
    // 환경변수 디버깅 (민감한 정보는 로깅하지 않음)
    console.log('🔧 [서버시작] 환경변수 상태 확인:');
    console.log('- GOOGLE_SHEET_ID 설정됨:', !!process.env.GOOGLE_SHEET_ID);
    console.log('- SHEET_ID 설정됨:', !!process.env.SHEET_ID);
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;
    console.log('- 최종 사용할 Spreadsheet ID 설정됨:', !!spreadsheetId);
    
    if (spreadsheetId) {
      console.log('- Spreadsheet ID 길이:', spreadsheetId.length);
      console.log('- Spreadsheet ID 시작:', spreadsheetId.substring(0, 10) + '...');
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
    
    // 매 시간마다 업데이트 체크 실행 (3600000ms = 1시간)
    setInterval(checkAndUpdateAddresses, 3600000);
    
    // Git 커밋 히스토리를 구글시트에 자동 입력
    console.log('🔍 [서버시작] Git 히스토리 업데이트 시작');
    try {
      await updateGoogleSheetWithGitHistory();
      console.log('✅ [서버시작] Git 히스토리 업데이트 완료');
    } catch (error) {
      console.error('❌ [서버시작] Git 히스토리 업데이트 실패:', error.message);
    }
    
    // 푸시 구독 정보 초기화
    console.log('🔍 [서버시작] 푸시 구독 초기화 시작');
    try {
      await initializePushSubscriptions();
      console.log('✅ [서버시작] 푸시 구독 초기화 완료');
    } catch (error) {
      console.error('❌ [서버시작] 푸시 구독 초기화 실패:', error.message);
    }
    
    // 서버 시작 시 배정완료된 재고 자동 저장 및 중복 정리
    console.log('💾 [서버시작] 배정완료된 재고 자동 저장 및 중복 정리 시작');
    try {
      console.log('🔍 [서버시작] 1단계: 시트 데이터 가져오기 시작');
      
      // 폰클재고데이터를 기준으로 배정 상태 데이터 가져오기
      const phoneklInventoryValues = await getSheetValues('폰클재고데이터');
      console.log(`🔍 [서버시작] 폰클재고데이터 로드 완료: ${phoneklInventoryValues ? phoneklInventoryValues.length : 0}개 행`);
      
      const reservationSiteValues = await getSheetValues('사전예약사이트');
      // 사전예약사이트 로드 완료
      
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
        if (row.length >= 15) {
          const serialNumber = (row[3] || '').toString().trim(); // D열: 일련번호
          const modelCapacity = (row[5] || '').toString().trim(); // F열: 모델명&용량
          const color = (row[6] || '').toString().trim(); // G열: 색상
          const storeName = (row[13] || '').toString().trim(); // N열: 출고처
          
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
      
      // 기존 배정 데이터 수집
      reservationSiteValues.slice(1).forEach((row, index) => {
        if (row.length < 22) return;
        
        const reservationNumber = (row[8] || '').toString().trim(); // I열: 예약번호
        const existingSerial = (row[6] || '').toString().trim(); // G열: 기존 배정일련번호
        
        if (existingSerial && existingSerial.trim() !== '') {
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
      
      console.log(`✅ [서버시작] 중복 배정 정리 완료: ${cleanedCount}개 배정 해제`);
      
      // 사전예약사이트 데이터 처리 시작
      
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
              const inventorySerialNumber = (inventoryRow[3] || '').toString().trim(); // D열: 일련번호
              const inventoryModelCapacity = (inventoryRow[5] || '').toString().trim(); // F열: 모델명&용량
              const inventoryColor = (inventoryRow[6] || '').toString().trim(); // G열: 색상
              const inventoryStoreName = (inventoryRow[13] || '').toString().trim(); // N열: 출고처
              
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
                console.log(`✅ [서버시작] 행 ${index + 2}: 일련번호 업데이트 "${currentSerialNumber}" → "${assignedSerialNumber}" (새로운 배정)`);
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
            
            console.log(`✅ [서버시작] Google Sheets 업데이트 완료: ${updatedCount}개 저장, ${cleanedCount}개 중복정리`);
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
          qualification: row[1], // B열: 자격
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
      manualKeyColumn: 'A', // 수기초 가입번호 컬럼
      manualKeyColumnName: '가입번호',
      systemKeyColumn: 'BO', // 폰클개통데이터 메모1 컬럼
      systemKeyColumnName: '메모1',
      systemAgentColumn: 'BR', // 폰클개통데이터 등록직원 컬럼
      systemAgentColumnName: '등록직원',
      systemMemo2Column: 'BP', // 폰클개통데이터 메모2 컬럼
      systemMemo2ColumnName: '메모2',
      // 동적 매칭 설정
      dynamicMappings: [
        {
          key: 'store_code',
          manualColumn: 'F',
          manualColumnName: '대리점코드',
          systemColumn: 'BP',
          systemColumnName: '메모2',
          description: '대리점코드 비교 (메모2에서 숫자 추출)',
          regex: '\\d+',
          enabled: true
        },
        {
          key: 'activation_datetime',
          manualColumns: ['U', 'V'],
          manualColumnNames: ['가입일자', '개통시간'],
          systemColumns: ['B', 'C', 'D'],
          systemColumnNames: ['개통일', '개통시', '개통분'],
          description: '개통일시분 비교 (초 제외, 24시간 형식)',
          enabled: true
        },
        {
          key: 'model_serial',
          manualColumns: ['AD', 'AS'],
          manualColumnNames: ['개통모델', '판매모델일련번호'],
          systemColumns: ['N', 'P'],
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
let modificationCompletionStatus = new Map(); // itemId -> {userId, isCompleted, timestamp}
let modificationNotes = new Map(); // itemId -> {userId, notes, timestamp}

// 서버 시작 시 시트에서 데이터 로드
async function initializeInspectionMemoData() {
  try {
    console.log('여직원검수데이터메모 시트에서 데이터 로드 중...');
    const { completionStatus, notes } = await loadInspectionMemoData();
    modificationCompletionStatus = completionStatus;
    modificationNotes = notes;
    console.log(`여직원검수데이터메모 로드 완료: 완료상태 ${completionStatus.size}개, 메모 ${notes.size}개`);
  } catch (error) {
    console.error('여직원검수데이터메모 초기화 실패:', error);
    modificationCompletionStatus = new Map();
    modificationNotes = new Map();
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
    
    for (const [itemId, status] of modificationCompletionStatus) {
      if (status.isCompleted) {
        if (view === 'personal') {
          // 개인현황: 해당 사용자의 항목만
          if (status.userId === userId) {
            completedItems.push(itemId);
            // 해당 항목의 내용도 함께 조회
            const notes = modificationNotes.get(itemId);
            if (notes && notes.userId === userId) {
              notesData[itemId] = notes.notes;
            }
          }
        } else {
          // 전체현황: 모든 사용자의 항목
          completedItems.push(itemId);
          // 해당 항목의 내용도 함께 조회 (모든 사용자의 내용)
          const notes = modificationNotes.get(itemId);
          if (notes) {
            notesData[itemId] = notes.notes;
          }
        }
      }
    }
    
    // 수정완료 상태가 없어도 내용이 있는 경우 포함
    for (const [itemId, notes] of modificationNotes) {
      if (!notesData[itemId]) {
        if (view === 'personal') {
          // 개인현황: 해당 사용자의 내용만
          if (notes.userId === userId) {
            notesData[itemId] = notes.notes;
          }
        } else {
          // 전체현황: 모든 사용자의 내용
          notesData[itemId] = notes.notes;
        }
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
    const { itemId, userId, isCompleted } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 메모리에 상태 저장
    if (isCompleted) {
      modificationCompletionStatus.set(itemId, {
        userId,
        isCompleted,
        timestamp: new Date().toISOString()
      });
    } else {
      modificationCompletionStatus.delete(itemId);
    }

    // 시트에 저장
    await saveInspectionMemoData(modificationCompletionStatus, modificationNotes);

    console.log(`수정완료 상태 업데이트: ${itemId} - ${userId} - ${isCompleted ? '완료' : '대기'}`);

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
    const { itemId, userId, notes } = req.body;
    
    if (!itemId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item ID and User ID are required' 
      });
    }

    // 메모리에 내용 저장
    if (notes && notes.trim()) {
      modificationNotes.set(itemId, {
        userId,
        notes: notes.trim(),
        timestamp: new Date().toISOString()
      });
    } else {
      modificationNotes.delete(itemId);
    }

    // 시트에 저장
    await saveInspectionMemoData(modificationCompletionStatus, modificationNotes);

    console.log(`수정완료 내용 업데이트: ${itemId} - ${userId} - ${notes}`);

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
  
  // 캐시에서 먼저 확인 (보안 TTL 적용)
  const cachedData = cacheUtils.get(cacheKey);
  if (cachedData) {
    console.log('캐시된 검수 데이터 반환 (보안 TTL 적용)');
    return res.json(cachedData);
  }
  
  try {
    console.log('검수 데이터 처리 시작... (개인정보 보안 처리 포함)');
    const startTime = Date.now();
    
    // 수기초, 폰클개통데이터, 폰클출고처데이터, 무선요금제군 병렬 로드
    const [manualValues, systemValues, storeValues, planValues] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
      getSheetValues(STORE_SHEET_NAME),
      getSheetValues(PLAN_SHEET_NAME)
    ]);
    
    if (!manualValues || !systemValues) {
      throw new Error('Failed to fetch data from sheets');
    }

    // 헤더 제거
    const manualRows = manualValues.slice(1);
    const systemRows = systemValues.slice(1);

    // 데이터 비교 및 차이점 찾기
    const differences = [];
    const manualMap = new Map();
    const systemMap = new Map();

    // 수기초 데이터 인덱싱 (A열: 가입번호 기준)
    manualRows.forEach((row, index) => {
      if (row.length > 0 && row[0]) {
        const key = row[0].toString().trim();
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
        
        // 모델명 비교 (N열: 13번째 컬럼)
        if (baseRow[13] !== currentRow[13]) {
          rowDifferences.push(`모델명: ${baseRow[13] || '없음'} vs ${currentRow[13] || '없음'}`);
        }
        
        // 개통유형 비교 (L열: 11번째 컬럼)
        if (baseRow[11] !== currentRow[11]) {
          rowDifferences.push(`개통유형: ${baseRow[11] || '없음'} vs ${currentRow[11] || '없음'}`);
        }
        
        // 입고처 비교 (E열: 4번째 컬럼)
        if (baseRow[4] !== currentRow[4]) {
          rowDifferences.push(`입고처: ${baseRow[4] || '없음'} vs ${currentRow[4] || '없음'}`);
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
        
        // 입고처 비교 (E열: 4번째 컬럼)
        if (currentRow[4] !== otherRow[4]) {
          rowDifferences.push(`${currentRow[4] || '없음'}`);
        }
        
        // 모델명 비교 (N열: 13번째 컬럼)
        if (currentRow[13] !== otherRow[13]) {
          rowDifferences.push(`${currentRow[13] || '모델명없음'}`);
        }
        
        // 개통유형 비교 (L열: 11번째 컬럼)
        if (currentRow[11] !== otherRow[11]) {
          rowDifferences.push(`${currentRow[11] || '개통유형없음'}`);
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
    manualRows.forEach((row, index) => {
      if (row.length > 0 && row[0]) {
        const key = row[0].toString().trim();
        allRows.push({
          key,
          row,
          index: index + 2,
          source: 'manual'
        });
      }
    });
    
    // 모든 폰클 데이터 추가
    systemRows.forEach((row, index) => {
      if (row.length > 66 && row[66]) { // BO열은 67번째 컬럼 (0-based)
        const key = row[66].toString().trim();
        allRows.push({
          key,
          row,
          index: index + 2,
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
                  assignedAgent: systemItem.row[69] || '', // BR열: 등록직원
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
              assignedAgent: systemItem.row[69] || '', // BR열: 등록직원
              isDuplicate: isSystemDuplicate,
              duplicateType: duplicateType,
              duplicateInfo: duplicateInfo
            });
          });
        }
      }
    }

    // 처리자 이름에서 괄호 제거하는 함수
    function cleanAgentName(agentName) {
      if (!agentName) return '';
      let cleaned = agentName.toString();
      
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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    manualField: { name: '대리점코드', key: 'store_code', column: 5 }, // F열
    systemField: { name: '메모2', key: 'memo2', column: 67 }, // BP열
    regex: '\\d+', // 숫자 추출 (6자리 제한 제거)
    description: '대리점코드 비교 (메모2에서 숫자 추출)'
  },
  {
    manualField: { name: '개통일시분', key: 'activation_datetime', column: 20 }, // U열
    systemField: { name: '개통일시분', key: 'activation_datetime', column: 1 }, // B열
    description: '개통일시분 비교 (초 제외, 24시간 형식)'
  },
  {
    manualField: { name: '모델명(일련번호)', key: 'model_serial', column: 29 }, // AD열
    systemField: { name: '모델명(일련번호)', key: 'model_serial', column: 13 }, // N열
    description: '모델명과 일련번호 비교 (모델명 정규화, 일련번호 6자리 비교)'
  },
  {
    manualField: { name: '개통유형', key: 'activation_type', column: 10 }, // K열
    systemField: { name: '개통유형', key: 'activation_type', column: 11 }, // L열
    description: '개통유형 및 C타겟차감대상 비교 (가입구분+이전사업자+기변타겟구분 정규화)'
  },
  {
    manualField: { name: '실판매POS', key: 'sales_pos', column: 7 }, // H열
    systemField: { name: '실판매POS', key: 'sales_pos', column: 6 }, // G열
    description: '실판매POS 비교 (VLOOKUP 방식 정규화, 전략온라인 제외)'
  },
  {
    manualField: { name: '요금제', key: 'plan', column: 37 }, // AL열
    systemField: { name: '요금제', key: 'plan', column: 21 }, // V열
    description: '요금제 비교 (VLOOKUP 방식 정규화, AN열 BLANK 제외)'
  },
  {
    manualField: { name: '출고가상이', key: 'shipping_virtual', column: 47 }, // AV열
    systemField: { name: '출고가상이', key: 'shipping_virtual', column: 27 }, // AB열
    description: '출고가상이 비교 (더하기 방식 정규화)'
  },
  {
    manualField: { name: '지원금 및 약정상이', key: 'support_contract', column: 85 }, // DH열
    systemField: { name: '지원금 및 약정상이', key: 'support_contract', column: 28 }, // AC열
    description: '지원금 및 약정상이 비교 (선택방식 정규화, AN열 BLANK 제외)'
  },
  {
    manualField: { name: '전환지원금상이', key: 'conversion_support', column: 64 }, // BM열
    systemField: { name: '전환지원금상이', key: 'conversion_support', column: 30 }, // AE열
    description: '전환지원금상이 비교 (더하기 방식 정규화, AN열 BLANK 제외)'
  },
  {
    manualField: { name: '프리할부상이', key: 'pre_installment', column: 47 }, // AV열
    systemField: { name: '프리할부상이', key: 'pre_installment', column: 27 }, // AB열
    description: '프리할부상이 비교 (빼기 방식 정규화, AN열 BLANK 제외)'
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
    const joinType = (manualRow[10] || '').toString().trim(); // K열: 가입구분
    const prevOperator = (manualRow[40] || '').toString().trim(); // AO열: 이전사업자
    const changeTarget = (manualRow[80] || '').toString().trim(); // CC열: 기변타겟구분
    const finalPolicy = (manualRow[39] || '').toString().trim(); // AN열: 최종영업정책
    
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
    const activationType = (systemRow[11] || '').toString().trim(); // L열: 개통
    const returnService = (systemRow[23] || '').toString().trim(); // X열: 환수서비스
    const columnI = (systemRow[8] || '').toString().trim(); // I열
    const columnE = (systemRow[4] || '').toString().trim(); // E열
    
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
  // 수기초 데이터 정규화 (H열)
  let manualPos = '';
  if (manualRow.length > 7) { // 최소 H열(7)은 있어야 함
    const salesPos = (manualRow[7] || '').toString().trim(); // H열: 실판매POS
    const strategyOnline = (manualRow[8] || '').toString().trim(); // I열: 전략온라인 체크
    
    // 전략온라인 제외 조건
    if (strategyOnline && strategyOnline.includes('전략온라인')) {
      return { manualPos: '', systemPos: '' }; // 검수 대상에서 제외
    }
    
    // 수기초 정규화: H열 & (VLOOKUP 결과)
    if (salesPos && storeData) {
      const vlookupResult = vlookupPosCodeToStoreName(salesPos, storeData);
      manualPos = vlookupResult ? `${salesPos} & (${vlookupResult})` : salesPos;
    } else {
      manualPos = salesPos;
    }
  }
  
  // 폰클 데이터 정규화 (G열)
  let systemPos = '';
  if (systemRow.length > 6) { // 최소 G열(6)은 있어야 함
    const storeCode = (systemRow[6] || '').toString().trim(); // G열: 출고처
    
    // 폰클 정규화: VLOOKUP 결과 & G열
    if (storeCode && storeData) {
      const vlookupResult = vlookupStoreNameToPosCode(storeCode, storeData);
      systemPos = vlookupResult ? `${vlookupResult} & (${storeCode})` : `(${storeCode})`;
    } else {
      systemPos = storeCode ? `(${storeCode})` : '';
    }
  }
  
  return { manualPos, systemPos };
}

// 요금제 정규화 함수
function normalizePlan(manualRow, systemRow, planData = null) {
  // 수기초 데이터 정규화 (AL열)
  let manualPlan = '';
  let manualPlanType = '';
  if (manualRow.length > 37) { // 최소 AL열(37)은 있어야 함
    const planName = (manualRow[37] || '').toString().trim(); // AL열: 최종요금제
    const finalPolicy = (manualRow[39] || '').toString().trim(); // AN열: 최종영업정책
    
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
    const planCode = (systemRow[21] || '').toString().trim(); // V열: 요금제
    
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
    const avValue = (manualRow[47] || '').toString().trim(); // AV열
    const azValue = (manualRow[51] || '').toString().trim(); // AZ열
    const awValue = (manualRow[48] || '').toString().trim(); // AW열
    const bkValue = (manualRow[62] || '').toString().trim(); // BK열
    const bmValue = (manualRow[64] || '').toString().trim(); // BM열
    const bnValue = (manualRow[65] || '').toString().trim(); // BN열
    const blValue = (manualRow[66] || '').toString().trim(); // BL열
    const finalPolicy = (manualRow[39] || '').toString().trim(); // AN열: 최종영업정책
    
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
    const abValue = (systemRow[27] || '').toString().trim(); // AB열: 출고가상이
    systemShipping = normalizeNumberFormat(abValue);
  }
  
  return { manualShipping, systemShipping };
}

// 지원금 및 약정상이 정규화 함수
function normalizeSupportContract(manualRow, systemRow) {
  // 수기초 데이터 정규화 (BH열 또는 BK열)
  let manualSupport = '';
  if (manualRow.length > 62) { // 최소 BK열(62)은 있어야 함
    const bhValue = (manualRow[59] || '').toString().trim(); // BH열
    const bkValue = (manualRow[62] || '').toString().trim(); // BK열
    const finalPolicy = (manualRow[39] || '').toString().trim(); // AN열: 최종영업정책
    
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
    const acValue = (systemRow[28] || '').toString().trim(); // AC열: 지원금 및 약정상이
    
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

// 전환지원금상이 정규화 함수
function normalizeConversionSupport(manualRow, systemRow) {
  // 수기초 데이터 정규화 (BM열+BN열)
  let manualConversion = '';
  if (manualRow.length > 65) { // 최소 BN열(65)은 있어야 함
    const bmValue = (manualRow[64] || '').toString().trim(); // BM열
    const bnValue = (manualRow[65] || '').toString().trim(); // BN열
    const finalPolicy = (manualRow[39] || '').toString().trim(); // AN열: 최종영업정책
    
    // AN열에 "BLANK" 포함되어있으면 대상에서 제외
    if (finalPolicy && finalPolicy.toUpperCase().includes('BLANK')) {
      return { manualConversion: '', systemConversion: '' }; // 검수 대상에서 제외
    }
    
    // 숫자 더하기 연산으로 정규화
    const values = [bmValue, bnValue].filter(v => v);
    const sum = addNumbers(values);
    manualConversion = normalizeNumberFormat(sum);
  }
  
  // 폰클 데이터 정규화 (AE열)
  let systemConversion = '';
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const aeValue = (systemRow[30] || '').toString().trim(); // AE열: 전환지원금상이
    systemConversion = normalizeNumberFormat(aeValue);
  }
  
  return { manualConversion, systemConversion };
}

// 프리할부상이 정규화 함수
function normalizePreInstallment(manualRow, systemRow) {
  // 수기초 데이터 정규화 (AV열+BL열)
  let manualPreInstallment = '';
  if (manualRow.length > 63) { // 최소 BL열(63)은 있어야 함
    const avValue = (manualRow[47] || '').toString().trim(); // AV열: 프리할부상이
    const blValue = (manualRow[63] || '').toString().trim(); // BL열
    const finalPolicy = (manualRow[39] || '').toString().trim(); // AN열: 최종영업정책
    
    // AN열에 "BLANK" 포함되어있으면 대상에서 제외
    if (finalPolicy && finalPolicy.toUpperCase().includes('BLANK')) {
      return { manualPreInstallment: '', systemPreInstallment: '' }; // 검수 대상에서 제외
    }
    
    // 숫자 더하기 연산으로 정규화: AV + BL
    const values = [avValue, blValue].filter(v => v);
    const sum = addNumbers(values);
    manualPreInstallment = normalizeNumberFormat(sum);
  }
  
  // 폰클 데이터 정규화 (AB열-AS열-AC열-AE열)
  let systemPreInstallment = '';
  if (systemRow.length > 30) { // 최소 AE열(30)은 있어야 함
    const abValue = (systemRow[27] || '').toString().trim(); // AB열
    const asValue = (systemRow[44] || '').toString().trim(); // AS열
    const acValue = (systemRow[28] || '').toString().trim(); // AC열
    const aeValue = (systemRow[30] || '').toString().trim(); // AE열
    
    // 숫자 빼기 연산으로 정규화: AB - AS - AC - AE
    let result = subtractNumbers(abValue, asValue);
    result = subtractNumbers(result, acValue);
    result = subtractNumbers(result, aeValue);
    systemPreInstallment = normalizeNumberFormat(result);
  }
  
  return { manualPreInstallment, systemPreInstallment };
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
      
      const manualDate = manualRow[20] || ''; // U열: 가입일자
      const manualTime = manualRow[21] || ''; // V열: 개통시간
      const systemDate = systemRow[1] || '';  // B열: 개통일
      const systemHour = systemRow[2] || '';  // C열: 개통시
      const systemMinute = systemRow[3] || ''; // D열: 개통분
      
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
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
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
      const finalPolicy = manualRow[39] || ''; // AN열: 최종영업정책
      if (finalPolicy.toString().trim().toUpperCase() === 'BLANK') {
        return;
      }
      
      const manualModel = manualRow[29] || ''; // AD열: 개통모델
      const manualSerial = manualRow[30] || ''; // AE열: 개통모델일련번호
      const systemModel = systemRow[13] || '';  // N열: 모델명
      const systemSerial = systemRow[15] || ''; // P열: 일련번호
      
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
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
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
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
        });
      }
      return;
    }
    
    // 실판매POS 비교 로직
    if (manualField.key === 'sales_pos') {
      // 배열 범위 체크 (H=7, I=8, G=6)
      if (manualRow.length <= 8 || systemRow.length <= 6) {
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
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
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
        assignedAgent: systemRow[69] || '' // BR열: 등록직원
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
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
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
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
        });
      }
      return;
    }
    
    // 전환지원금상이 비교 로직
    if (manualField.key === 'conversion_support') {
      // 배열 범위 체크 (BM=64, BN=63, AN=39, AE=30)
      if (manualRow.length <= 63 || systemRow.length <= 30) {
        return;
      }
      
      // 전환지원금상이 정규화
      const { manualConversion, systemConversion } = normalizeConversionSupport(manualRow, systemRow);
      
      // AN열 BLANK 제외 조건으로 인해 빈 값이 반환된 경우 비교 제외
      if (!manualConversion && !systemConversion) {
        return;
      }
      
      // 값이 다르고 둘 다 비어있지 않은 경우만 차이점으로 기록
      if (manualConversion !== systemConversion && 
          (manualConversion || systemConversion)) {

        differences.push({
          key,
          type: 'mismatch',
          field: '전환지원금상이',
          fieldKey: 'conversion_support',
          correctValue: manualConversion || '정규화 불가',
          incorrectValue: systemConversion || '정규화 불가',
          description: '전환지원금상이 비교 (더하기 방식 정규화, AN열 BLANK 제외)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
        });
      }
      return;
    }
    
    // 프리할부상이 비교 로직
    if (manualField.key === 'pre_installment') {
      // 배열 범위 체크 (AV=47, AN=39, AB=27, AS=44)
      if (manualRow.length <= 47 || systemRow.length <= 44) {
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
          description: '프리할부상이 비교 (빼기 방식 정규화, AN열 BLANK 제외)',
          manualRow: null,
          systemRow: null,
          assignedAgent: systemRow[69] || '' // BR열: 등록직원
        });
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
        assignedAgent: systemRow[69] || '' // BR열: 등록직원
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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
const SECURE_CACHE_TTL = 2 * 60 * 1000; // 2분 (기존 5분에서 단축)

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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
    cacheUtils.delete(`inspection_data_personal_${userId}`);
    cacheUtils.delete(`inspection_data_overview_${userId}`);

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

// 배정 상태 변경 감지 API (실시간 업데이트용 - 최적화)
app.get('/api/reservation/assignment-changes', async (req, res) => {
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
    
    if (!inventoryValues || inventoryValues.length < 2) {
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
        range: '사전예약사이트!A:Z' // 전체 데이터 읽기
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
        range: '폰클재고데이터!A:Z' // 전체 데이터 읽기
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
      range: '사전예약사이트!A:Z'
    });

    // 2. 폰클출고처데이터 시트 로드 (담당자 매칭용)
    const phoneklResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:N'
    });

    // 3. 마당접수 시트 로드 (서류접수 상태 확인용)
    const yardResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '마당접수!A:V'
    });

    // 4. 온세일 시트 로드 (온세일 접수 상태 확인용)
    const onSaleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '온세일!A:Z'
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
    const phoneklData = phoneklResponse.data.values.slice(1);
    
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

    // 폰클출고처데이터에서 H열(매장코드)과 N열(담당자) 매핑 생성
    const storeAgentMap = new Map();
    const agentNormalizationMap = new Map(); // 정규화된 이름 -> 원본 이름 매핑
    
    phoneklData.forEach(row => {
      const storeCode = row[7] || ''; // H열 (8번째, 0부터 시작)
      const agent = row[13] || ''; // N열 (14번째, 0부터 시작)
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
      range: '사전예약사이트!A:Z'
    });

    // 2. 폰클출고처데이터 시트 로드 (담당자 매칭용)
    const phoneklResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:N'
    });

    if (!reservationResponse.data.values || !phoneklResponse.data.values) {
      throw new Error('시트 데이터를 불러올 수 없습니다.');
    }

    const reservationHeaders = reservationResponse.data.values[0];
    const reservationData = reservationResponse.data.values.slice(1);
    
    const phoneklHeaders = phoneklResponse.data.values[0];
    const phoneklData = phoneklResponse.data.values.slice(1);

    // 담당자 이름 정규화 함수
    const normalizeAgentName = (agentName) => {
      if (!agentName) return '';
      return agentName.replace(/\([^)]*\)/g, '').trim();
    };

    // 폰클출고처데이터에서 H열(매장코드)과 N열(담당자) 매핑 생성
    const storeAgentMap = new Map();
    
    phoneklData.forEach(row => {
      const storeCode = row[7] || ''; // H열 (8번째, 0부터 시작)
      const agent = row[13] || ''; // N열 (14번째, 0부터 시작)
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
      range: '온세일!A:Z'
    });

    // 3-1. 모바일가입내역 데이터 로드
    let mobileJoinResponse = null;
    try {
      mobileJoinResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '모바일가입내역!A:Z'
      });
      console.log('전체고객리스트: 모바일가입내역 시트 로드 성공');
    } catch (error) {
      console.log('전체고객리스트: 모바일가입내역 시트 로드 실패 (무시됨):', error.message);
      mobileJoinResponse = { data: { values: null } };
    }

    // 4. 폰클출고처데이터 시트 로드 (담당자 매칭용)
    const storeResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '폰클출고처데이터!A:N'
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
    const storeData = storeResponse.data.values.slice(1);
    
    storeData.forEach(row => {
      if (row.length >= 14) { // N열까지 필요
        const storeCode = (row[7] || '').toString().trim(); // H열: 매장코드
        const manager = (row[13] || '').toString().trim(); // N열: 담당자
        
        if (storeCode && manager) {
          // 담당자 이름에서 괄호 부분 제거 (예: "홍기현(별도)" → "홍기현")
          const cleanManager = manager.replace(/\([^)]*\)/g, '').trim();
          managerMapping.set(storeCode, cleanManager);
        }
      }
    });
    
    console.log(`담당자 매핑 테이블 생성 완료: ${managerMapping.size}개 매장-담당자 매핑`);

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
        range: '사전예약사이트!A:Z'
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
        range: '폰클재고데이터!A:Z'
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
    
    const { mode, date, content } = req.body;
    
    if (!mode || !date || !content) {
      return res.status(400).json({ 
        success: false, 
        error: '모드, 날짜, 내용이 모두 필요합니다.' 
      });
    }
    
    // 모드별 컬럼 매핑
    const modeColumnMap = {
      'general': 1,    // B열: 일반모드
      'agent': 2,      // C열: 관리자모드
      'inventory': 3,  // D열: 재고관리모드
      'settlement': 4, // E열: 정산모드
      'inspection': 5, // F열: 검수모드
      'policy': 6,     // G열: 정책모드
      'meeting': 7,    // H열: 회의모드
      'reservation': 8, // I열: 사전예약모드
      'chart': 9       // J열: 장표모드
    };
    
    const columnIndex = modeColumnMap[mode];
    if (columnIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: '유효하지 않은 모드입니다.' 
      });
    }
    
    // 새 행 데이터 생성
    const newRow = new Array(11).fill(''); // A~K열 (11개 컬럼)
    newRow[0] = date;  // A열: 날짜
    newRow[columnIndex] = content;  // 해당 모드 컬럼에 내용
    
    // Google Sheets에 새 행 추가
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${UPDATE_SHEET_NAME}!A:K`,
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