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

console.log('VAPID Public Key:', vapidKeys.publicKey);
console.log('VAPID Private Key:', vapidKeys.privateKey);

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
    
    console.log(`캐시 저장: ${key} (TTL: ${new Date(now + ttl).toLocaleTimeString()})`);
  },
  
  // 캐시에서 데이터 가져오기
  get: (key) => {
    const item = cache.get(key);
    if (!item) {
      console.log(`캐시 미스: ${key}`);
      return null;
    }
    
    const now = Date.now();
    if (now > item.ttl) {
      cache.delete(key);
      console.log(`캐시 만료: ${key}`);
      return null;
    }
    
    console.log(`캐시 히트: ${key}`);
    return item.data;
  },
  
  // 캐시 삭제
  delete: (key) => {
    cache.delete(key);
    console.log(`캐시 삭제: ${key}`);
  },
  
  // 캐시 전체 정리 (만료된 항목들)
  cleanup: () => {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, item] of cache.entries()) {
      if (now > item.ttl) {
        cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`캐시 정리 완료: ${deletedCount}개 항목 삭제`);
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
      console.log(`봇이 준비되었습니다: ${discordBot.user.tag}`);
    });
    
    console.log('디스코드 봇 모듈 로딩 성공');
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
                
              console.log('충돌 알림 전송 시도 중...');
              await channel.send({ content: '@everyone', embeds: [crashEmbed] });
              console.log('서버 충돌 알림 메시지가 Discord로 전송되었습니다.');
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
          console.log('서버 경고 알림 메시지가 Discord로 전송되었습니다.');
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
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// CORS 설정
app.use(cors());
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

// Kakao geocoding 함수 (개선된 버전)
async function geocodeAddressWithKakao(address, retryCount = 0) {
  const apiKey = process.env.KAKAO_API_KEY;
  if (!apiKey) {
    throw new Error('KAKAO_API_KEY 환경변수가 설정되어 있지 않습니다.');
  }
  
  // 주소 전처리
  const cleanAddress = address.toString().trim();
  if (!cleanAddress) {
    console.log('빈 주소로 geocoding 시도 중단');
    return null;
  }
  
  // 주소에 "시" 또는 "구"가 포함되어 있지 않으면 기본 지역 추가
  let processedAddress = cleanAddress;
  if (!cleanAddress.includes('시') && !cleanAddress.includes('구') && !cleanAddress.includes('군')) {
    processedAddress = `경기도 ${cleanAddress}`;
    console.log(`주소 전처리: "${cleanAddress}" → "${processedAddress}"`);
  }
  
  const encodedAddress = encodeURIComponent(processedAddress);
  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodedAddress}`;
  
  try {
    console.log(`Geocoding 시도 (${retryCount + 1}/3): ${processedAddress}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${apiKey}`
      },
      timeout: 10000 // 10초 타임아웃
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        // 할당량 초과
        console.log('Kakao API 할당량 초과, 5초 대기 후 재시도');
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
      console.log(`Geocoding 성공: ${processedAddress} → (${result.latitude}, ${result.longitude})`);
      return result;
    } else {
      console.log(`Geocoding 결과 없음: ${processedAddress}`);
      return null;
    }
  } catch (error) {
    console.error(`Geocoding 오류 (${retryCount + 1}/3): ${processedAddress}`, error.message);
    
    // 네트워크 오류나 일시적 오류인 경우 재시도
    if (retryCount < 2 && (error.message.includes('fetch') || error.message.includes('timeout'))) {
      console.log('네트워크 오류로 인한 재시도...');
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
    console.log(`Google Sheets API 호출: ${sheetName}`);
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
    console.log('Discord 로깅이 비활성화되었습니다.');
    return;
  }

  // 봇 객체가 초기화되지 않은 경우
  if (!discordBot || !EmbedBuilder) {
    console.log('Discord 봇이 초기화되지 않았습니다. 로그를 전송할 수 없습니다.');
    return;
  }

  try {
    // 봇이 연결되었는지 확인
    if (!discordBot.isReady()) {
      console.log('Discord 봇이 아직 준비되지 않았습니다. 메시지를 보낼 수 없습니다.');
      return;
    }

    // 사용자 유형에 따라 채널 ID 결정
    const userType = embedData.userType || 'store'; // 기본값은 일반 매장
    let channelId = DISCORD_CHANNEL_ID; // 기본 채널
    
    if (userType === 'agent') {
      channelId = DISCORD_AGENT_CHANNEL_ID;
      console.log('관리자 로그 전송 - 채널 ID:', channelId);
    } else {
      channelId = DISCORD_STORE_CHANNEL_ID;
      console.log('일반 매장 로그 전송 - 채널 ID:', channelId);
    }
    
    // 채널 ID가 없으면 로깅 중단
    if (!channelId) {
      console.log(`${userType} 유형의 Discord 채널 ID가 설정되지 않았습니다.`);
      return;
    }

    console.log('Discord 채널에 메시지 전송 시도...');
    console.log('Discord 채널 ID:', channelId);
    
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

    console.log(`채널 찾음: ${channel.name} (${channel.id}), 메시지 전송 중...`);
    
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
      console.log(`Discord 메시지 전송 성공! 메시지 ID: ${sentMessage.id}`);
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
    console.log('Updating coordinates...');
    
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
          console.log(`Cleared coordinates for store without address at row ${i + 2}`);
          continue;
        }
        
        // 주소가 있는 경우 geocoding 실행
        try {
          console.log(`\n=== 좌표 업데이트 시작: ${address} ===`);
          const result = await geocodeAddress(address);
          if (result) {
            const { latitude, longitude } = result;
            updates.push({
              range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
              values: [[latitude, longitude]]
            });
            console.log(`✅ 좌표 업데이트 성공: ${address}`);
            console.log(`📍 위도: ${latitude}, 경도: ${longitude}`);
          } else {
            console.log(`❌ Geocoding 결과 없음: ${address}`);
            // geocoding 실패 시 기존 좌표 유지 (삭제하지 않음)
            console.log(`⚠️ 기존 좌표 유지 (삭제하지 않음): ${address}`);
          }
        } catch (error) {
          console.error(`❌ Geocoding 오류: ${address}`, error.message);
          // geocoding 오류 시 기존 좌표 유지 (삭제하지 않음)
          console.log(`⚠️ 기존 좌표 유지 (삭제하지 않음): ${address}`);
        }
      } else {
        // 미사용 매장은 위도/경도 값을 빈 값으로 비움
        updates.push({
          range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
          values: [["", ""]]
        });
        console.log(`Cleared coordinates for unused store at row ${i + 2}`);
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
      console.log(`Successfully updated ${updates.length} coordinates`);
    } else {
      console.log('No coordinates to update');
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
  
  console.log(`매장 데이터 요청 - includeShipped: ${includeShipped}, 캐시키: ${cacheKey}`);
  
  // 캐시에서 먼저 확인
  const cachedStores = cacheUtils.get(cacheKey);
  if (cachedStores) {
    console.log(`캐시된 매장 데이터 반환 (${cachedStores.length}개 매장)`);
    return res.json(cachedStores);
  }
  
  try {
    console.log('매장 데이터 처리 시작...');
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
      console.log(`3일 이내 출고재고 제외 모드 - 기준일: ${threeDaysAgo.toISOString()}`);
    } else {
      console.log('모든 재고 포함 모드');
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

    const processingTime = Date.now() - startTime;
    console.log(`매장 데이터 처리 완료: ${stores.length}개 매장, 제외된 재고: ${excludedCount}개, ${processingTime}ms 소요`);
    
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
    console.log('캐시된 모델 데이터 반환');
    return res.json(cachedModels);
  }
  
  try {
    console.log('모델 데이터 처리 시작...');
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

    const processingTime = Date.now() - startTime;
    console.log(`모델 데이터 처리 완료: ${Object.keys(result).length}개 모델, ${processingTime}ms 소요`);
    
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
      cwd: process.cwd(),
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

// 업데이트 히스토리 가져오기
app.get('/api/updates', async (req, res) => {
  try {
    const updateHistory = await getGitUpdateHistory();
    
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
    console.log('캐시된 대리점 데이터 반환');
    return res.json(cachedAgents);
  }
  
  try {
    console.log('대리점 데이터 처리 시작...');
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
    console.log(`대리점 데이터 처리 완료: ${agents.length}개 대리점, ${processingTime}ms 소요`);
    
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
    console.log('캐시된 당월 개통실적 데이터 반환');
    return res.json(cachedData);
  }
  
  try {
    console.log('당월 개통실적 데이터 처리 시작...');
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
    console.log(`당월 개통실적 데이터 처리 완료: ${activationData.length}개 레코드, ${processingTime}ms 소요`);
    
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
    console.log('캐시된 전월 개통실적 데이터 반환');
    return res.json(cachedData);
  }
  
  try {
    console.log('전월 개통실적 데이터 처리 시작...');
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
    console.log(`전월 개통실적 데이터 처리 완료: ${activationData.length}개 레코드, ${processingTime}ms 소요`);
    
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
    console.log('캐시된 날짜별 개통실적 데이터 반환');
    return res.json(cachedData);
  }
  
  try {
    console.log('날짜별 개통실적 데이터 처리 시작...');
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
    console.log(`날짜별 개통실적 데이터 처리 완료: ${Object.keys(dateStats).length}개 날짜, ${processingTime}ms 소요`);
    
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
    console.log(`캐시된 날짜 비교 데이터 반환: ${date}`);
    return res.json(cachedData);
  }
  
  try {
    console.log(`날짜 비교 데이터 처리 시작: ${date}`);
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
    console.log(`전월 데이터 처리 시작 - 요청 날짜: ${date}`);
    console.log(`전월 데이터 행 수: ${previousMonthRows.length}`);
    
    const targetDay = new Date(date).getDate();
    console.log(`전월 비교 대상 일자: ${targetDay}일`);
    
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
        console.log(`전월 데이터 매칭: ${store} - ${activationDate} -> ${day}일`);
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
    console.log(`날짜 비교 데이터 처리 완료: ${date}, ${Object.keys(comparisonData).length}개 매장, ${processingTime}ms 소요`);
    
    // 전월 데이터 요약 로그
    const storesWithPreviousData = Object.values(comparisonData).filter(store => store.previousMonth > 0);
    console.log(`전월 데이터가 있는 매장 수: ${storesWithPreviousData.length}`);
    if (storesWithPreviousData.length > 0) {
      console.log('전월 데이터가 있는 매장들:', storesWithPreviousData.map(store => ({
        storeName: store.storeName,
        previousMonth: store.previousMonth
      })));
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
    
    console.log(`Login attempt with ID: ${storeId}`);
    console.log('Step 1: Starting login process...');
    
    // 재고모드 전용 ID 목록
    const INVENTORY_MODE_IDS = [
      "JEGO306891",  // 경수
      "JEGO315835",  // 경인
      "JEGO314942",  // 호남
      "JEGO316558",  // 동서울
      "JEGO316254",  // 호남2
      "VIP3473",     // 김수빈
      "VIP4464",     // 홍기현
      "VIP8119",     // 홍남옥
      "VIP8062",     // 이병각
      "VIP6741",     // 이형주
      "VIP6965"      // 정광영
    ];
    
    // 재고모드 ID인지 먼저 확인
    if (INVENTORY_MODE_IDS.includes(storeId)) {
      console.log(`Step 1.5: Inventory mode ID detected: ${storeId}`);
      
      // 디스코드로 로그인 로그 전송
      if (DISCORD_LOGGING_ENABLED) {
        try {
          const embedData = {
            title: '재고모드 로그인',
            color: 16776960, // 노란색
            timestamp: new Date().toISOString(),
            userType: 'inventory', // 재고모드 타입 지정
            fields: [
              {
                name: '재고모드 정보',
                value: `ID: ${storeId}\n모드: 재고관리 전용`
              },
              {
                name: '접속 정보',
                value: `IP: ${ipAddress || '알 수 없음'}\n위치: ${location || '알 수 없음'}\n기기: ${deviceInfo || '알 수 없음'}`
              }
            ],
            footer: {
              text: '(주)브이아이피플러스 재고모드 로그인'
            }
          };
          
          await sendLogToDiscord(embedData);
        } catch (logError) {
          console.error('재고모드 로그인 로그 전송 실패:', logError.message);
          // 로그 전송 실패해도 로그인은 허용
        }
      }
      
      console.log('Step 1.6: Inventory mode login successful, sending response...');
      return res.json({
        success: true,
        isAgent: false,
        isInventory: true,
        storeInfo: {
          id: storeId,
          name: '재고관리 모드',
          manager: '재고관리자',
          address: '',
          latitude: 37.5665,
          longitude: 126.9780,
          phone: ''
        }
      });
    }
    
    // 1. 먼저 대리점 관리자 ID인지 확인
    console.log('Step 2: Checking if ID is agent...');
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    console.log('Step 3: Agent sheet data fetched, rows:', agentValues ? agentValues.length : 0);
    
    if (agentValues) {
      const agentRows = agentValues.slice(1);
      console.log('Step 4: Agent rows (excluding header):', agentRows.length);
      
      const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디)
      console.log('Step 5: Agent search result:', agent ? 'Found' : 'Not found');
      
      if (agent) {
        console.log(`Found agent: ${agent[0]}, ${agent[1]}`);
        console.log('Step 6: Processing agent login...');
        
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
                  value: `ID: ${agent[2]}\n대상: ${agent[0]}\n자격: ${agent[1]}`
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
        
        console.log('Step 7: Agent login successful, sending response...');
        return res.json({
          success: true,
          isAgent: true,
          agentInfo: {
            target: agent[0] || '',       // A열: 대상
            qualification: agent[1] || '', // B열: 자격
            contactId: agent[2] || '',     // C열: 연락처(아이디)
            office: agent[3] || '',        // D열: 사무실 (새로 추가)
            department: agent[4] || ''     // E열: 소속 (새로 추가)
          }
        });
      }
    }
    
    // 2. 대리점 관리자가 아닌 경우 일반 매장으로 검색
    console.log('Step 8: Not an agent, checking if ID is store...');
    const storeValues = await getSheetValues(STORE_SHEET_NAME);
    console.log('Step 9: Store sheet data fetched, rows:', storeValues ? storeValues.length : 0);
    
    if (!storeValues) {
      console.log('Step 9.5: Store sheet data is null or empty');
      throw new Error('Failed to fetch data from store sheet');
    }
    
    const storeRows = storeValues.slice(1);
    console.log('Step 10: Store rows (excluding header):', storeRows.length);
    
    // 매장 ID 검색을 위한 디버깅 로그 추가
    console.log('Step 10.5: Searching for store ID:', storeId);
    console.log('Step 10.6: First few store IDs for comparison:');
    storeRows.slice(0, 5).forEach((row, index) => {
      console.log(`  Row ${index + 1}: "${row[7]}" (type: ${typeof row[7]})`);
    });
    
    const foundStoreRow = storeRows.find(row => {
      const rowId = row[7];
      const match = rowId === storeId;
      if (match) {
        console.log(`Step 10.7: Found matching store ID: "${rowId}"`);
      }
      return match;
    }); // G열: 매장 ID로 수정
    console.log('Step 11: Store search result:', foundStoreRow ? 'Found' : 'Not found');
    
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
      
      console.log(`Found store: ${store.name}`);
      console.log('Step 12: Processing store login...');
      
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
      
      console.log('Step 13: Store login successful, sending response...');
      return res.json({
        success: true,
        isAgent: false,
        storeInfo: store
      });
    }
    
    // 3. 매장 ID도 아닌 경우
    console.log('Step 14: ID not found in either agent or store sheets');
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
    console.log('Checking for addresses that need updating...');
    
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
          console.log(`Cleared coordinates for store without address at row ${i + 2}`);
          continue;
        }
        
        // 주소가 있는 경우 geocoding 실행
        try {
          console.log(`\n=== 좌표 업데이트 시작: ${address} ===`);
          const result = await geocodeAddress(address);
          if (result) {
            const { latitude, longitude } = result;
            updates.push({
              range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
              values: [[latitude, longitude]]
            });
            console.log(`✅ 좌표 업데이트 성공: ${address}`);
            console.log(`📍 위도: ${latitude}, 경도: ${longitude}`);
          } else {
            console.log(`❌ Geocoding 결과 없음: ${address}`);
            // geocoding 실패 시 기존 좌표 유지 (삭제하지 않음)
            console.log(`⚠️ 기존 좌표 유지 (삭제하지 않음): ${address}`);
          }
        } catch (error) {
          console.error(`❌ Geocoding 오류: ${address}`, error.message);
          // geocoding 오류 시 기존 좌표 유지 (삭제하지 않음)
          console.log(`⚠️ 기존 좌표 유지 (삭제하지 않음): ${address}`);
        }
      } else {
        // 미사용 매장은 위도/경도 값을 빈 값으로 비움
        updates.push({
          range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
          values: [["", ""]]
        });
        console.log(`Cleared coordinates for unused store at row ${i + 2}`);
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
      console.log(`Successfully updated ${updates.length} coordinates`);
    } else {
      console.log('No coordinates to update');
    }
  } catch (error) {
    console.error('Error in checkAndUpdateAddresses:', error);
  }
}

// 서버 시작
const server = app.listen(port, '0.0.0.0', async () => {
  try {
    console.log(`서버가 포트 ${port}에서 실행 중입니다`);
    console.log(`VAPID Public Key: ${vapidKeys.publicKey}`);
    
    // 환경변수 디버깅 (민감한 정보는 로깅하지 않음)
    console.log('Discord 봇 환경변수 상태:');
    console.log('- DISCORD_BOT_TOKEN 설정됨:', !!process.env.DISCORD_BOT_TOKEN);
    console.log('- DISCORD_CHANNEL_ID 설정됨:', !!process.env.DISCORD_CHANNEL_ID);
    console.log('- DISCORD_AGENT_CHANNEL_ID 설정됨:', !!process.env.DISCORD_AGENT_CHANNEL_ID);
    console.log('- DISCORD_STORE_CHANNEL_ID 설정됨:', !!process.env.DISCORD_STORE_CHANNEL_ID);
    console.log('- DISCORD_LOGGING_ENABLED 설정됨:', process.env.DISCORD_LOGGING_ENABLED);
    
    // 무료 Geocoding 서비스 상태
    console.log('무료 Geocoding 서비스 상태:');
    console.log('- Photon API (Komoot): 사용 가능 (무료)');
    console.log('- Nominatim API (OpenStreetMap): 사용 가능 (무료)');
    console.log('- Pelias API (Mapzen): 사용 가능 (무료)');
    console.log('- 총 3개 무료 서비스로 정확도 향상');
    
    // 봇 로그인 (서버 시작 후)
    if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN && discordBot) {
      console.log('서버 시작 후 Discord 봇 로그인 시도...');
      try {
        await discordBot.login(DISCORD_BOT_TOKEN);
        console.log('Discord 봇 연결 성공!');
        
        // 관리자 채널 연결 테스트
        if (DISCORD_AGENT_CHANNEL_ID) {
          try {
            const agentChannel = await discordBot.channels.fetch(DISCORD_AGENT_CHANNEL_ID);
            if (agentChannel) {
              console.log(`관리자 채널 '${agentChannel.name}' 연결 성공!`);
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
              console.log(`일반 매장 채널 '${storeChannel.name}' 연결 성공!`);
            }
          } catch (storeChannelError) {
            console.error('일반 매장 채널 연결 실패:', storeChannelError.message);
          }
        }
        
        // 테스트 메시지 전송 (기본 채널)
        if (DISCORD_CHANNEL_ID) {
          const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
          if (channel) {
            console.log(`채널 '${channel.name}' 연결 성공!`);
            
            // 테스트 메시지 전송
            const testEmbed = new EmbedBuilder()
              .setTitle('서버 시작 알림')
              .setColor(5763719)
              .setDescription('서버가 성공적으로 시작되었습니다.')
              .setTimestamp()
              .setFooter({ text: '(주)브이아이피플러스 서버' });
              
            await channel.send({ embeds: [testEmbed] });
            console.log('서버 시작 알림 메시지 전송됨');
          }
        }
      } catch (error) {
        console.error('서버 시작 시 Discord 봇 초기화 오류:', error.message);
        console.error('Discord 봇은 비활성화 상태로 서버가 계속 실행됩니다.');
      }
    } else {
      console.log('Discord 봇 기능이 비활성화되었거나 설정이 완료되지 않았습니다.');
    }
    
    // 주소 업데이트 함수 호출
    console.log('모든 사용 중인 주소에 대해 위도/경도 값을 업데이트합니다...');
    await checkAndUpdateAddresses();
    
    // 매 시간마다 업데이트 체크 실행 (3600000ms = 1시간)
    setInterval(checkAndUpdateAddresses, 3600000);
  } catch (error) {
    console.error('서버 시작 중 오류:', error);
  }
}).on('error', (error) => {
  console.error('서버 시작 실패:', error);
  process.exit(1);
});

// 정상적인 종료 처리
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal. Shutting down gracefully...');
  
  // Discord에 서버 종료 알림 전송
  if (DISCORD_LOGGING_ENABLED && discordBot) {
    try {
      // 봇 준비 상태 확인
      if (!discordBot.isReady()) {
        console.log('Discord 봇이 아직 준비되지 않았습니다. 5초 대기 후 재시도...');
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
  console.log('Received SIGINT signal (Ctrl+C). Shutting down gracefully...');
  
  // Discord에 서버 종료 알림 전송
  if (DISCORD_LOGGING_ENABLED && discordBot) {
    try {
      // 봇 준비 상태 확인
      if (!discordBot.isReady()) {
        console.log('Discord 봇이 아직 준비되지 않았습니다. 5초 대기 후 재시도...');
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
    
    console.log('새로운 배정 완료:', assignment);
    console.log('배정 대상자:', { target_offices, target_departments, target_agents });
    
    // 배정 대상자에게만 알림 전송 (실제 배정된 수량이 있는 경우에만)
    if (actualQuantity > 0) {
      const notification = {
        type: 'assignment_completed',
        title: '새로운 배정 완료',
        message: `${assigner}님이 ${model} (${color}) ${actualQuantity}대를 배정했습니다.`,
        data: assignment,
        timestamp: new Date()
      };
      
      console.log('알림 전송 시작:', {
        notification,
        targetOffices: target_offices,
        targetDepartments: target_departments,
        targetAgents: target_agents
      });
      
      // 대상자 필터링하여 알림 전송
      await sendNotificationToTargetAgents(notification, target_offices, target_departments, target_agents);
    } else {
      console.log('배정된 수량이 0이므로 알림을 전송하지 않습니다.');
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
  
  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
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
          contactId: row[1], // 연락처 ID (아이디)
          office: row[2], // 사무실
          department: row[3] // 부서
        };
        
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
  
  console.log('사용 가능한 담당자 목록:', agents.map(a => `${a.target}(${a.contactId}) - ${a.office} ${a.department}`));
  console.log('현재 연결된 클라이언트:', Array.from(connectedClients.entries()).map(([id, client]) => `${id}:${client.user_id}`));
  console.log('배정 대상자 정보:', {
    targetOffices: targetOffices || [],
    targetDepartments: targetDepartments || [],
    targetAgents: targetAgents || []
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
  
  // 사용자 정보에서 소속 확인
  const userAgent = agents.find(agent => agent.contactId === userId);
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
                   targetAgentsList.includes(userAgent.contactId);
  
  console.log(`${userId} 대상자 여부:`, isTarget, {
    officeMatch: offices.includes(userAgent.office),
    departmentMatch: departments.includes(userAgent.department),
    targetMatch: targetAgentsList.includes(userAgent.target),
    contactIdMatch: targetAgentsList.includes(userAgent.contactId)
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

// 서버 시작 코드는 1866번째 줄에 이미 존재합니다.
// 중복된 서버 시작 코드 제거 