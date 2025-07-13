require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const NodeGeocoder = require('node-geocoder');
const webpush = require('web-push');

// 기본 설정
const app = express();
const port = process.env.PORT || 4000;

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
const AGENT_SHEET_NAME = '대리점아이디관리';  // 대리점 아이디 관리 시트 추가
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';  // 당월 개통실적 데이터
const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터(전월)';  // 전월 개통실적 데이터
const UPDATE_SHEET_NAME = '어플업데이트';  // 업데이트 내용 관리 시트 추가
const MANUAL_DATA_SHEET_NAME = '수기초';  // 수기초 데이터
const INSPECTION_RESULT_SHEET_NAME = '검수결과';  // 검수 결과 데이터
const NORMALIZATION_HISTORY_SHEET_NAME = '정규화이력';  // 정규화 이력 데이터

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
  
  // console.log(`매장 데이터 요청 - includeShipped: ${includeShipped}, 캐시키: ${cacheKey}`);
  
  // 캐시에서 먼저 확인
  const cachedStores = cacheUtils.get(cacheKey);
  if (cachedStores) {
    // console.log(`캐시된 매장 데이터 반환 (${cachedStores.length}개 매장)`);
    return res.json(cachedStores);
  }
  
  try {
    // console.log('매장 데이터 처리 시작...');
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

// Git 커밋 히스토리를 기반으로 업데이트 내용 생성
async function getGitUpdateHistory() {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    // 최근 30일간의 커밋 히스토리 가져오기
    const { stdout } = await execAsync('git log --since="30 days ago" --pretty=format:"%h|%ad|%s" --date=short', { 
      cwd: __dirname, // 서버 파일이 있는 디렉토리 (Git 저장소 루트)
      timeout: 10000 
    });
    
    if (!stdout.trim()) {
      return [];
    }
    
    const commits = stdout.trim().split('\n').map(line => {
      const [hash, date, message] = line.split('|');
      return { hash, date, message };
    });
    
    // 날짜별로 그룹화
    const groupedByDate = {};
    commits.forEach(commit => {
      if (!groupedByDate[commit.date]) {
        groupedByDate[commit.date] = [];
      }
      groupedByDate[commit.date].push(commit);
    });
    
    // 업데이트 히스토리 생성
    const updateHistory = Object.entries(groupedByDate)
      .sort(([a], [b]) => new Date(b) - new Date(a)) // 최신 날짜순 정렬
      .slice(0, 10) // 최근 10일만 표시
      .map(([date, dayCommits]) => {
        const changes = dayCommits.map(commit => {
          // 커밋 메시지에서 불필요한 접두사 제거
          let cleanMessage = commit.message;
          if (cleanMessage.startsWith('fix: ')) {
            cleanMessage = cleanMessage.substring(5);
          } else if (cleanMessage.startsWith('feat: ')) {
            cleanMessage = cleanMessage.substring(6);
          } else if (cleanMessage.startsWith('update: ')) {
            cleanMessage = cleanMessage.substring(8);
          }
          return cleanMessage;
        });
        
        // 날짜 형식 변환
        const [year, month, day] = date.split('-');
        const version = `${year}.${month}.${day}`;
        
        // 제목 생성 (가장 중요한 커밋 메시지 사용)
        const title = dayCommits.length > 0 ? 
          dayCommits[0].message.replace(/^(fix|feat|update):\s*/, '') : 
          '업데이트';
        
        return {
          version,
          date,
          title,
          changes,
          type: 'feature',
          timestamp: new Date(date).getTime()
        };
      });
    
    return updateHistory;
  } catch (error) {
    console.error('Git 히스토리 가져오기 실패:', error);
    // Git 히스토리를 가져올 수 없는 경우 기본 업데이트 정보 반환
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0];
    
    return [{
      version: `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${String(currentDate.getDate()).padStart(2, '0')}`,
      date: formattedDate,
      title: '시스템 업데이트',
      changes: ['최신 업데이트가 적용되었습니다.'],
      type: 'feature',
      timestamp: currentDate.getTime()
    }];
  }
}

// 구글시트에 업데이트 내용 자동 입력
async function updateGoogleSheetWithGitHistory() {
  try {
    // console.log('Git 커밋 히스토리를 구글시트에 자동 입력 시작...');
    
    // Git 히스토리 가져오기
    const gitHistory = await getGitUpdateHistory();
    
    if (gitHistory.length === 0) {
      // console.log('Git 히스토리가 없어서 업데이트 시트 입력을 건너뜁니다.');
      return;
    }
    
    // 기존 시트 데이터 확인
    let existingData = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: UPDATE_SHEET_NAME
      });
      existingData = response.data.values || [];
    } catch (error) {
      // console.log('업데이트 시트가 없거나 비어있습니다. 새로 생성합니다.');
    }
    
    // 헤더 행 준비
    const headerRow = ['버전', '날짜', '제목', '타입', '상태', '변경사항1', '변경사항2'];
    
    // 새로운 데이터 행 준비
    const newRows = gitHistory.map(update => {
      const [year, month, day] = update.date.split('-');
      const version = `${year}.${month}.${day}`;
      
      // 변경사항을 2개로 제한 (F열, G열)
      const change1 = update.changes[0] || '';
      const change2 = update.changes[1] || '';
      
      // 타입 결정 (커밋 메시지 기반)
      let type = 'feature';
      if (update.title.toLowerCase().includes('fix') || update.title.toLowerCase().includes('bug')) {
        type = 'bugfix';
      } else if (update.title.toLowerCase().includes('security')) {
        type = 'security';
      } else if (update.title.toLowerCase().includes('system') || update.title.toLowerCase().includes('performance')) {
        type = 'system';
      }
      
      return [
        version,           // A열: 버전
        update.date,       // B열: 날짜
        update.title,      // C열: 제목
        type,              // D열: 타입
        '활성',            // E열: 상태 (기본값: 활성)
        change1,           // F열: 변경사항1
        change2            // G열: 변경사항2
      ];
    });
    
    // 기존 데이터와 새 데이터 병합 (중복 제거)
    const existingVersions = new Set();
    if (existingData.length > 1) { // 헤더 제외
      existingData.slice(1).forEach(row => {
        if (row[0]) existingVersions.add(row[0]); // A열: 버전
      });
    }
    
    // 중복되지 않은 새 데이터만 필터링
    const uniqueNewRows = newRows.filter(row => !existingVersions.has(row[0]));
    
    if (uniqueNewRows.length === 0) {
      // console.log('새로운 업데이트 내용이 없습니다.');
      return;
    }
    
    // 시트에 데이터 입력
    const allRows = [headerRow, ...uniqueNewRows];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${UPDATE_SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: allRows
      }
    });
    
          // console.log(`업데이트 시트에 ${uniqueNewRows.length}개의 새로운 업데이트 내용이 입력되었습니다.`);
    
  } catch (error) {
    console.error('구글시트 업데이트 내용 입력 실패:', error);
  }
}

// 구글시트에서 업데이트 내용 읽어오기
async function getUpdateHistoryFromSheet() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: UPDATE_SHEET_NAME
    });
    
    const data = response.data.values || [];
    if (data.length <= 1) { // 헤더만 있거나 데이터가 없는 경우
      return [];
    }
    
    // 헤더 제거하고 데이터 파싱
    const rows = data.slice(1);
    const updateHistory = rows
      .filter(row => row.length >= 5 && row[4] === '활성') // 상태가 '활성'인 것만
      .map(row => {
        const version = row[0] || '';
        const date = row[1] || '';
        const title = row[2] || '';
        const type = row[3] || 'feature';
        const change1 = row[5] || '';
        const change2 = row[6] || '';
        
        // 변경사항 배열 생성
        const changes = [];
        if (change1) changes.push(change1);
        if (change2) changes.push(change2);
        
        return {
          version,
          date,
          title,
          changes,
          type,
          timestamp: new Date(date).getTime()
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬
    
    return updateHistory;
  } catch (error) {
    console.error('구글시트에서 업데이트 내용 읽기 실패:', error);
    return [];
  }
}

// 업데이트 히스토리 가져오기 (구글시트 기반)
app.get('/api/updates', async (req, res) => {
  try {
    const updateHistory = await getUpdateHistoryFromSheet();
    
    res.json({
      success: true,
      data: updateHistory,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching update history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch update history', 
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
    // console.log('캐시된 당월 개통실적 데이터 반환');
    return res.json(cachedData);
  }
  
  try {
    // console.log('당월 개통실적 데이터 처리 시작...');
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
    // console.log(`당월 개통실적 데이터 처리 완료: ${activationData.length}개 레코드, ${processingTime}ms 소요`);
    
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
    // console.log('캐시된 전월 개통실적 데이터 반환');
    return res.json(cachedData);
  }
  
  try {
    // console.log('전월 개통실적 데이터 처리 시작...');
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
    // console.log(`전월 개통실적 데이터 처리 완료: ${activationData.length}개 레코드, ${processingTime}ms 소요`);
    
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
    // console.log('캐시된 날짜별 개통실적 데이터 반환');
    return res.json(cachedData);
  }
  
  try {
    // console.log('날짜별 개통실적 데이터 처리 시작...');
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
    // console.log(`날짜별 개통실적 데이터 처리 완료: ${Object.keys(dateStats).length}개 날짜, ${processingTime}ms 소요`);
    
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
    // console.log(`캐시된 날짜 비교 데이터 반환: ${date}`);
    return res.json(cachedData);
  }
  
  try {
    // console.log(`날짜 비교 데이터 처리 시작: ${date}`);
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
        
        // F열: 재고모드 권한, G열: 정산모드 권한, H열: 검수모드 권한, I열: 장표모드 권한, J열: 정책모드 권한, K열: 검수전체현황 권한 확인
        const hasInventoryPermission = agent[5] === 'O'; // F열
        const hasSettlementPermission = agent[6] === 'O'; // G열
        const hasInspectionPermission = agent[7] === 'O'; // H열
        const hasChartPermission = agent[8] === 'O'; // I열
        const hasPolicyPermission = agent[9] === 'O'; // J열
        const hasInspectionOverviewPermission = agent[10] === 'O'; // K열
        
        // console.log('Step 6.5: Permission check:', {
        //   inventory: hasInventoryPermission,
        //   settlement: hasSettlementPermission,
        //   inspection: hasInspectionPermission,
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
          chart: hasChartPermission,
          policy: hasPolicyPermission,
          inspectionOverview: hasInspectionOverviewPermission
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
                    value: `ID: ${agent[2]}\n대상: ${agent[0]}\n자격: ${agent[1]}\n재고권한: ${hasInventoryPermission ? 'O' : 'X'}\n정산권한: ${hasSettlementPermission ? 'O' : 'X'}\n검수권한: ${hasInspectionPermission ? 'O' : 'X'}\n장표권한: ${hasChartPermission ? 'O' : 'X'}\n정책권한: ${hasPolicyPermission ? 'O' : 'X'}\n검수전체현황권한: ${hasInspectionOverviewPermission ? 'O' : 'X'}`
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

// 서버 시작
const server = app.listen(port, '0.0.0.0', async () => {
  try {
    // console.log(`서버가 포트 ${port}에서 실행 중입니다`);
    // console.log(`VAPID Public Key: ${vapidKeys.publicKey}`);
    
    // 환경변수 디버깅 (민감한 정보는 로깅하지 않음)
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
    
    // 주소 업데이트 함수 호출
          // console.log('모든 사용 중인 주소에 대해 위도/경도 값을 업데이트합니다...');
    await checkAndUpdateAddresses();
    
    // 매 시간마다 업데이트 체크 실행 (3600000ms = 1시간)
    setInterval(checkAndUpdateAddresses, 3600000);
    
    // Git 커밋 히스토리를 구글시트에 자동 입력
          // console.log('Git 커밋 히스토리를 구글시트에 자동 입력합니다...');
    await updateGoogleSheetWithGitHistory();
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
  
  // SSE 헤더 설정 (CORS 개선)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
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
  
  // 초기 연결 메시지
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
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
    
    if (agentData && agentData.length > 1) {
      // 헤더 제외하고 데이터 파싱 (대리점아이디관리 시트 구조)
      agents = agentData.slice(1).map((row, index) => {
        const agent = {
          target: row[0], // 담당자명
          contactId: row[1], // 연락처 ID (전화번호)
          role: row[2], // 역할 (영업사원, 스탭, 이사 등)
          office: row[3], // 사무실
          department: row[4] // 부서
        };
        
        // contactId가 전화번호 형식인지 확인하고, 아니면 role과 교체
        if (agent.contactId && !agent.contactId.match(/^\d{10,11}$/)) {
          // contactId가 전화번호가 아니면 role과 교체
          const temp = agent.contactId;
          agent.contactId = agent.role;
          agent.role = temp;
        }
        
        console.log(`담당자 데이터 파싱 ${index + 1}:`, agent);
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
        
        // 푸시 알림도 함께 전송
        sendPushNotificationToUser(client.user_id, notification);
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
      sendPushNotificationToUser(agent.contactId, notification);
      pushSentCount++;
    }
  });
  
  console.log('알림 전송 완료 요약:', {
    sseSentCount,
    pushSentCount,
    totalSent: sseSentCount + pushSentCount
  });
}

// 푸시 알림 전송 함수
async function sendPushNotificationToUser(userId, notification) {
  try {
    console.log(`푸시 알림 전송 시도: ${userId}`, {
      hasSubscription: pushSubscriptions.has(userId),
      notificationTitle: notification.title,
      notificationMessage: notification.message
    });
    
    const subscription = pushSubscriptions.get(userId);
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
    
    // 구독 정보 저장
    pushSubscriptions.set(userId, subscription);
    console.log(`푸시 구독 등록 완료: ${userId}`, {
      totalSubscriptions: pushSubscriptions.size,
      subscription: {
        endpoint: subscription.endpoint,
        keys: subscription.keys ? Object.keys(subscription.keys) : []
      }
    });
    
    res.json({ success: true });
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
    
    // 구독 정보 삭제
    pushSubscriptions.delete(userId);
    console.log(`푸시 구독 해제: ${userId}`);
    
    res.json({ success: true });
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
    
    const subscription = pushSubscriptions.get(userId);
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
      console.log(`만료된 구독 삭제: ${userId}`);
    }
    
    res.status(500).json({ success: false, error: '푸시 알림 전송 실패' });
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
    
    for (const [userId, subscription] of pushSubscriptions.entries()) {
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
      console.log(`만료된 구독 삭제: ${userId}`);
    });
    
    res.json({ 
      success: true, 
      results,
      expiredCount: expiredSubscriptions.length
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

// 수정완료 상태를 메모리에서 관리 (서버 재시작시 초기화)
const modificationCompletionStatus = new Map(); // itemId -> {userId, isCompleted, timestamp}
const modificationNotes = new Map(); // itemId -> {userId, notes, timestamp}

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
    modificationCompletionStatus.set(itemId, {
      userId,
      isCompleted,
      timestamp: new Date().toISOString()
    });

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
    modificationNotes.set(itemId, {
      userId,
      notes: notes || '',
      timestamp: new Date().toISOString()
    });

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
    
    // 수기초와 폰클개통데이터 병렬 로드
    const [manualValues, systemValues] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME)
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
    
    // 수기초 데이터 인덱싱 (A열: 가입번호 기준) - 중복 감지 포함
    const manualDuplicateKeys = new Set();
    const manualDuplicateGroups = new Map();
    
    // 먼저 모든 수기초 데이터를 manualMap에 추가
    manualRows.forEach((row, index) => {
      if (row.length > 0 && row[0]) {
        const key = row[0].toString().trim();
        manualMap.set(key, { row, index: index + 2 });
        
        // 특정 가입번호 디버깅
        if (key === '516697159306') {
          console.log(`수기초 데이터 발견: key=${key}, 행=${index + 2}, 모델=${row[29] || ''}, 일련번호=${row[30] || ''}`);
        }
      }
    });
    
    // 그 다음 중복을 감지
    manualRows.forEach((row, index) => {
      if (row.length > 0 && row[0]) {
        const key = row[0].toString().trim();
        
        if (!manualDuplicateGroups.has(key)) {
          manualDuplicateGroups.set(key, []);
        }
        manualDuplicateGroups.get(key).push({ row, index: index + 2 });
      }
    });
    
    // 실제로 2개 이상인 경우만 중복으로 처리
    for (const [key, group] of manualDuplicateGroups) {
      if (group.length > 1) {
        manualDuplicateKeys.add(key);
      }
    }
    
    // 폰클개통데이터 인덱싱 (BO열: 메모1 기준) - 중복 가입번호 처리
    const systemDuplicateKeys = new Set();
    const systemDuplicateGroups = new Map();
    
    // 먼저 모든 폰클데이터를 systemMap에 추가
    systemRows.forEach((row, index) => {
      if (row.length > 66 && row[66]) { // BO열은 67번째 컬럼 (0-based)
        const key = row[66].toString().trim();
        systemMap.set(key, { row, index: index + 2 });
        
        // 특정 가입번호 디버깅
        if (key === '516697159306') {
          console.log(`폰클 데이터 발견: key=${key}, 행=${index + 2}, 모델=${row[13] || ''}, 일련번호=${row[15] || ''}`);
        }
      }
    });
    
    // 그 다음 중복을 감지
    systemRows.forEach((row, index) => {
      if (row.length > 66 && row[66]) { // BO열은 67번째 컬럼 (0-based)
        const key = row[66].toString().trim();
        
        if (!systemDuplicateGroups.has(key)) {
          systemDuplicateGroups.set(key, []);
        }
        systemDuplicateGroups.get(key).push({ row, index: index + 2 });
        
        // 특정 가입번호의 모든 중복 데이터 확인
        if (key === '516697159306') {
          console.log(`폰클 중복 데이터 추가: key=${key}, 행=${index + 2}, 모델=${row[13] || ''}, 일련번호=${row[15] || ''}`);
        }
      }
    });
    
    // 실제로 2개 이상인 경우만 중복으로 처리
    for (const [key, group] of systemDuplicateGroups) {
      if (group.length > 1) {
        systemDuplicateKeys.add(key);
        
        // 특정 가입번호의 중복 처리 결과 확인
        if (key === '516697159306') {
          console.log(`폰클 중복 처리 완료: key=${key}, 중복 개수=${group.length}`);
          group.forEach((item, idx) => {
            console.log(`  중복 ${idx + 1}: 행=${item.index}, 모델=${item.row[13] || ''}, 일련번호=${item.row[15] || ''}`);
          });
        }
      }
    }

    // 차이점 찾기
    for (const [key, manualData] of manualMap) {
      const systemData = systemMap.get(key);
      
      if (systemData) {
        // 중복 타입 결정
        const isManualDuplicate = manualDuplicateKeys.has(key);
        const isSystemDuplicate = systemDuplicateKeys.has(key);
        const duplicateType = getDuplicateType(isManualDuplicate, isSystemDuplicate);
        
        // 중복 정보 생성 - 각 행별로 개별적인 정보 생성
        let duplicateInfo = '';
        if (isSystemDuplicate && systemDuplicateGroups.has(key)) {
          const systemDuplicates = systemDuplicateGroups.get(key);
          // 현재 행의 인덱스를 찾아서 개별적인 중복 정보 생성
          const currentRowIndex = systemDuplicates.findIndex(item => item.index === systemData.index);
          if (currentRowIndex !== -1) {
            duplicateInfo = generateIndividualDuplicateInfo(
              systemDuplicates.map(item => item.row), 
              currentRowIndex, 
              'system_duplicate'
            );
          }
        } else if (isManualDuplicate && manualDuplicateGroups.has(key)) {
          const manualDuplicates = manualDuplicateGroups.get(key);
          // 현재 행의 인덱스를 찾아서 개별적인 중복 정보 생성
          const currentRowIndex = manualDuplicates.findIndex(item => item.index === manualData.index);
          if (currentRowIndex !== -1) {
            duplicateInfo = generateIndividualDuplicateInfo(
              manualDuplicates.map(item => item.row), 
              currentRowIndex, 
              'manual_duplicate'
            );
          }
        }
        
        // 두 데이터가 모두 있는 경우 비교
        const rowDifferences = compareDynamicColumns(manualData.row, systemData.row, key, field);
        
        rowDifferences.forEach(diff => {
          differences.push({
            ...diff,
            manualRow: manualData.index,
            systemRow: systemData.index,
            assignedAgent: systemData.row[69] || '', // BR열: 등록직원
            isDuplicate: isManualDuplicate || isSystemDuplicate,
            duplicateType: duplicateType,
            duplicateInfo: duplicateInfo
          });
        });
        
        // 수기초에만 있는 데이터 (필드 필터링이 있을 때는 제외)
        if (!field) {
          // 가입번호를 정규표현식으로 정확히 비교
          const manualKey = manualData.row[0]?.toString().trim() || '';
          let isReallyManualOnly = true;
          
          // 폰클데이터에서 가입번호와 유사한 값이 있는지 확인
          for (const [systemKey, systemData] of systemMap) {
            const systemKeyTrimmed = systemKey.toString().trim();
            if (manualKey === systemKeyTrimmed || 
                manualKey.includes(systemKeyTrimmed) || 
                systemKeyTrimmed.includes(manualKey)) {
              isReallyManualOnly = false;
              break;
            }
          }
          
          if (isReallyManualOnly) {
            differences.push({
              key,
              type: 'manual_only',
              field: '전체',
              fieldKey: 'all',
              correctValue: '수기초에만 존재',
              incorrectValue: '없음',
              manualRow: manualData.index,
              systemRow: null,
              assignedAgent: '',
              isDuplicate: isManualDuplicate,
              duplicateType: isManualDuplicate ? 'manual_duplicate' : 'no_duplicate',
              duplicateInfo: isManualDuplicate && manualDuplicateGroups.has(key) ? 
                generateIndividualDuplicateInfo(
                  manualDuplicateGroups.get(key).map(item => item.row),
                  manualDuplicateGroups.get(key).findIndex(item => item.index === manualData.index),
                  'manual_duplicate'
                ) : ''
            });
          }
        }
      }
    }

    // 중복 가입번호에 대한 별도 차이점 추가 (개선된 버전)
    // 이 부분은 제거 - 이미 위에서 각 행별로 중복 정보가 처리되고 있음

    // 수기초에 없는 데이터도 확인 (필드 필터링이 있을 때는 제외)
    if (!field) {
      for (const [key, systemData] of systemMap) {
        if (!manualMap.has(key)) {
          const isSystemDuplicate = systemDuplicateKeys.has(key);
          let duplicateInfo = '';
          
          if (isSystemDuplicate && systemDuplicateGroups.has(key)) {
            const systemDuplicates = systemDuplicateGroups.get(key);
            // 현재 행의 인덱스를 찾아서 개별적인 중복 정보 생성
            const currentRowIndex = systemDuplicates.findIndex(item => item.index === systemData.index);
            if (currentRowIndex !== -1) {
              duplicateInfo = generateIndividualDuplicateInfo(
                systemDuplicates.map(item => item.row), 
                currentRowIndex, 
                'system_duplicate'
              );
            }
          }
          
          differences.push({
            key,
            type: 'system_only',
            field: '전체',
            fieldKey: 'all',
            correctValue: '없음',
            incorrectValue: '수기초에 없음',
            manualRow: null,
            systemRow: systemData.index,
            assignedAgent: systemData.row[69] || '', // BR열: 등록직원
            isDuplicate: isSystemDuplicate,
            duplicateType: isSystemDuplicate ? 'system_duplicate' : 'no_duplicate',
            duplicateInfo: duplicateInfo
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

// 기존 COLUMN_MAPPINGS와 compareRows 함수는 제거됨 (compareDynamicColumns로 통합)

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
  
  // 디버깅 대상 시리얼번호인지 확인 (필요시에만 사용)
  const isDebugTarget = DEBUG_SERIAL_NUMBERS.includes(serial);
  
  // 숫자인지 확인
  if (/^\d+$/.test(serial)) {
    // 숫자인 경우 앞의 0만 제거하고 반환 (뒤에서 6자리 제한 제거)
    const result = serial.replace(/^0+/, '');
    return result;
  } else {
    // 영문이 포함된 경우 앞의 0들을 제거하고 반환
    const result = serial.replace(/^0+/, '');
    return result;
  }
}

// 동적 컬럼 비교 함수
function compareDynamicColumns(manualRow, systemRow, key, targetField = null) {
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
        console.log(`모델명 비교 제외: key=${key}, 최종영업정책=BLANK`);
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
      
      // 디버깅: 특정 가입번호의 모델명 비교 로그
      if (key === '516697159306') {
        console.log(`모델명 비교 디버깅 - 가입번호: ${key}`);
        console.log(`수기초: 모델=${manualModel}, 일련번호=${manualSerial}`);
        console.log(`폰클: 모델=${systemModel}, 일련번호=${systemSerial}`);
        console.log(`정규화 후 수기초: ${manualCombined}`);
        console.log(`정규화 후 폰클: ${systemCombined}`);
        console.log(`비교 결과: ${manualCombined !== systemCombined ? '다름' : '같음'}`);
      }
      
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