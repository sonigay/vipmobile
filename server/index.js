require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const NodeGeocoder = require('node-geocoder');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();
const port = process.env.PORT || 4000;

// Discord 봇 설정
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

// 디스코드 봇 초기화
const discordBot = new Client({ 
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

// 전역 오류 처리
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 치명적인 오류 발생 시 프로세스를 깔끔하게 종료
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
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

// Geocoder 설정
const geocoder = NodeGeocoder({
  provider: 'google',
  apiKey: process.env.GOOGLE_MAPS_API_KEY // Google Maps API 키 필요
});

// Google API 인증 설정
const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// Google Sheets API 초기화
const sheets = google.sheets({ version: 'v4', auth });

// 데이터 시트에서 값 가져오기
async function getSheetValues(sheetName) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName
    });
    return response.data.values || [];
  } catch (error) {
    console.error(`Error fetching sheet ${sheetName}:`, error);
    throw error;
  }
}

// Discord로 로그 메시지 전송 함수
async function sendLogToDiscord(embedData) {
  if (!DISCORD_LOGGING_ENABLED || !DISCORD_CHANNEL_ID) {
    console.log('Discord 로깅이 비활성화되었거나 채널 ID가 없습니다.');
    return;
  }

  try {
    // 봇이 연결되었는지 확인
    if (!discordBot.isReady()) {
      console.log('Discord 봇이 아직 준비되지 않았습니다. 메시지를 보낼 수 없습니다.');
      return;
    }

    console.log('Discord 채널에 메시지 전송 시도...');
    const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID).catch(error => {
      console.error(`채널 ID ${DISCORD_CHANNEL_ID} 가져오기 실패:`, error.message);
      return null;
    });
    
    if (!channel) {
      console.error(`채널을 찾을 수 없습니다: ${DISCORD_CHANNEL_ID}`);
      return;
    }

    console.log('채널 찾음, 메시지 전송 중...');
    
    const embed = new EmbedBuilder()
      .setTitle(embedData.title)
      .setColor(embedData.color)
      .addFields(embedData.fields)
      .setTimestamp(embedData.timestamp)
      .setFooter({ text: embedData.footer.text });

    await channel.send({ embeds: [embed] });
    console.log('Discord 메시지 전송 성공');
  } catch (error) {
    console.error('Discord 로그 전송 중 오류:', error.message);
    console.error('자세한 오류 정보:', error);
  }
}

// 서버 상태 확인용 엔드포인트
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
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
      const address = row[23]; // X열: 주소
      const status = row[3];   // D열: 거래상태
      
      // 사용 중인 매장만 처리
      if (!address || status !== "사용") continue;

      try {
        // OpenStreetMap Geocoding API 호출
        const results = await geocoder.geocode(address + ', 대한민국');
        
        if (results && results[0]) {
          const { latitude, longitude } = results[0];
          
          // AC열(29번째)과 AD열(30번째)에 위도/경도 업데이트
          updates.push({
            range: `${STORE_SHEET_NAME}!AC${i + 2}:AD${i + 2}`,
            values: [[latitude, longitude]]
          });

          console.log(`Updated coordinates for address: ${address}`);
          console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
        } else {
          console.log(`No results found for address: ${address}`);
        }
      } catch (error) {
        console.error(`Error geocoding address: ${address}`, error);
      }

      // API 할당량 제한을 피하기 위한 지연
      await new Promise(resolve => setTimeout(resolve, 1000));
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

// 스토어 데이터 가져오기
app.get('/api/stores', async (req, res) => {
  try {
    console.log('Fetching store data...');
    
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

    // 현재 날짜 기준 3일 전 날짜 계산
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    
    console.log(`오늘 날짜: ${today.toISOString().split('T')[0]}`);
    console.log(`3일 전 날짜: ${threeDaysAgo.toISOString().split('T')[0]}`);

    // 매장별 재고 데이터 매핑
    const inventoryMap = {};
    
    console.log('Processing inventory data...');
    inventoryRows.forEach((row, index) => {
      if (!row || row.length < 14) return; // 최소 N열까지 데이터가 있어야 함
      
      const storeName = (row[13] || '').toString().trim();  // N열: 매장명
      const model = (row[5] || '').toString().trim();      // F열: 모델
      const color = (row[6] || '').toString().trim();      // G열: 색상
      const shippingDate = row[14] ? new Date(row[14]) : null;  // O열: 출고일
      
      if (!storeName || !model || !color) {
        console.log(`Skipping row ${index + 4}: Invalid data`, { storeName, model, color });
        return;
      }

      // 출고일이 있고, 최근 3일 이내인 경우 재고에서 제외
      if (shippingDate && shippingDate >= threeDaysAgo) {
        console.log(`Skipping recent inventory: ${model} ${color} at ${storeName}, shipping date: ${shippingDate.toISOString().split('T')[0]}`);
        return;
      }

      // 매장별 재고 데이터 구조 생성
      if (!inventoryMap[storeName]) {
        inventoryMap[storeName] = {};
      }
      if (!inventoryMap[storeName][model]) {
        inventoryMap[storeName][model] = {};
      }
      
      // 같은 모델/색상 조합의 수량을 증가
      if (!inventoryMap[storeName][model][color]) {
        inventoryMap[storeName][model][color] = 1;
      } else {
        inventoryMap[storeName][model][color]++;
      }
    });

    // 담당자 정보 확인을 위한 로깅
    console.log('매장 담당자 정보 샘플:');
    storeRows.slice(0, 5).forEach((row, idx) => {
      const name = row[5] || ''; // F열: 업체명
      const manager = row[12] || ''; // M열: 담당자
      console.log(`[${idx}] ${name}: 담당자 = "${manager}"`);
    });

    // 매장 정보와 재고 정보 결합
    const stores = storeRows
      .filter(row => {
        const name = (row[5] || '').toString().trim();  // F열: 업체명
        const status = row[3];                          // D열: 거래상태
        return name && status === "사용";
      })
      .map(row => {
        const latitude = parseFloat(row[0] || '0');    // A열: 위도
        const longitude = parseFloat(row[1] || '0');   // B열: 경도
        const status = row[3];                         // D열: 거래상태
        const name = row[5].toString().trim();         // F열: 업체명
        const storeId = row[6];                        // G열: 매장 ID
        const phone = row[8] || '';                    // I열: 연락처
        const manager = row[12] || '';                 // M열: 담당자 (빈 문자열이 아닌 실제 값 확인)
        const address = (row[23] || '').toString();    // X열: 주소
        
        // 빈 매장 ID 제외
        if (!storeId || storeId.toString().trim() === '') {
          return null;
        }

        const inventory = inventoryMap[name] || {};
        
        // 재고 데이터 로깅 (특정 매장에 대해서만)
        if (name === "승텔레콤(인천부평)") {
          console.log('Found store:', name);
          console.log('Store manager:', manager);
          console.log('Inventory data:', JSON.stringify(inventory, null, 2));
        }

        return {
          id: storeId.toString(),
          name,
          address,
          phone,
          manager, // 담당자 정보 추가
          latitude,
          longitude,
          // 매장 ID와 업체명을 조합한 고유 식별자 추가
          uniqueId: `${storeId}_${name}`,
          inventory: inventory
        };
      })
      .filter(store => store !== null); // null 값 제거

    console.log(`Returning ${stores.length} stores with inventory data`);
    
    // 전체 재고 현황 요약 로깅
    const inventorySummary = stores
      .filter(store => Object.keys(store.inventory).length > 0)
      .map(store => ({
        매장명: store.name,
        담당자: store.manager,
        모델수: Object.keys(store.inventory).length
      }));
    
    console.log('Inventory and manager summary:', JSON.stringify(inventorySummary.slice(0, 10), null, 2));
    
    res.json(stores);
  } catch (error) {
    console.error('Error fetching store data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch store data', 
      message: error.message 
    });
  }
});

// 모델과 색상 데이터 가져오기
app.get('/api/models', async (req, res) => {
  try {
    console.log('Fetching model and color data...');
    
    const inventoryValues = await getSheetValues(INVENTORY_SHEET_NAME);
    
    if (!inventoryValues) {
      throw new Error('Failed to fetch data from inventory sheet');
    }

    // 헤더 제거
    const inventoryRows = inventoryValues.slice(1);

    // 모델과 색상 데이터 추출
    const modelColorMap = {};
    
    inventoryRows.forEach(row => {
      if (row.length < 7) return;
      
      const model = row[5];    // F열: 모델
      const color = row[6];    // G열: 색상
      
      if (!model || !color) return;
      
      if (!modelColorMap[model]) {
        modelColorMap[model] = new Set();
      }
      modelColorMap[model].add(color);
    });

    // Set을 배열로 변환
    const result = Object.entries(modelColorMap).reduce((acc, [model, colors]) => {
      acc[model] = Array.from(colors);
      return acc;
    }, {});

    console.log(`Returning model and color data with ${Object.keys(result).length} models`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching model and color data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch model and color data', 
      message: error.message 
    });
  }
});

// 대리점 ID 정보 가져오기
app.get('/api/agents', async (req, res) => {
  try {
    console.log('Fetching agent data...');
    
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    
    if (!agentValues) {
      throw new Error('Failed to fetch data from agent sheet');
    }

    // 헤더 제거
    const agentRows = agentValues.slice(1);
    
    // 대리점 데이터 구성
    const agents = agentRows.map(row => {
      return {
        target: row[0] || '',       // A열: 대상
        qualification: row[1] || '', // B열: 자격
        contactId: row[2] || ''      // C열: 연락처(아이디)
      };
    }).filter(agent => agent.contactId); // 아이디가 있는 항목만 필터링
    
    console.log(`Returning ${agents.length} agent records`);
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agent data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent data', 
      message: error.message 
    });
  }
});

// 사용자 활동 로깅 API
app.post('/api/log-activity', async (req, res) => {
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
    
    // 콘솔에 로그 출력
    console.log('사용자 활동 로그:', JSON.stringify(req.body, null, 2));
    
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
    }
    
    // Embed 데이터 구성
    const embedData = {
      title: title,
      color: embedColor,
      timestamp: new Date().toISOString(),
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
        text: 'VIP+ 사용자 활동 로그'
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
        value: '전화 연결 버튼이 클릭되었습니다.'
      });
    }
    
    // Discord로 로그 전송
    await sendLogToDiscord(embedData);
    
    res.json({ success: true });
  } catch (error) {
    console.error('활동 로그 처리 중 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: '활동 로그 처리 실패', 
      message: error.message 
    });
  }
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
    
    // 1. 먼저 대리점 관리자 ID인지 확인
    const agentValues = await getSheetValues(AGENT_SHEET_NAME);
    if (agentValues) {
      const agentRows = agentValues.slice(1);
      const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디)
      
      if (agent) {
        console.log(`Found agent: ${agent[0]}, ${agent[1]}`);
        
        // 디스코드로 로그인 로그 전송
        if (DISCORD_LOGGING_ENABLED && DISCORD_CHANNEL_ID) {
          const embedData = {
            title: '관리자 로그인',
            color: 15844367, // 보라색
            timestamp: new Date().toISOString(),
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
              text: 'VIP+ 관리자 로그인'
            }
          };
          
          await sendLogToDiscord(embedData);
        }
        
        return res.json({
          success: true,
          isAgent: true,
          agentInfo: {
            target: agent[0] || '',       // A열: 대상
            qualification: agent[1] || '', // B열: 자격
            contactId: agent[2] || ''      // C열: 연락처(아이디)
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
    const storeRow = storeRows.find(row => row[6] === storeId);
    
    if (storeRow) {
      const store = {
        id: storeRow[6],                      // G열: 매장 ID
        name: storeRow[5],                    // F열: 업체명
        manager: storeRow[12] || '',          // M열: 담당자
        address: storeRow[23] || '',          // X열: 주소
        latitude: parseFloat(storeRow[0] || '0'),  // A열: 위도
        longitude: parseFloat(storeRow[1] || '0'),  // B열: 경도
        phone: storeRow[8] || ''              // I열: 연락처 추가
      };
      
      console.log(`Found store: ${store.name}`);
      
      // 디스코드로 로그인 로그 전송
      if (DISCORD_LOGGING_ENABLED && DISCORD_CHANNEL_ID) {
        const embedData = {
          title: '매장 로그인',
          color: 5763719, // 초록색
          timestamp: new Date().toISOString(),
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
            text: 'VIP+ 매장 로그인'
          }
        };
        
        await sendLogToDiscord(embedData);
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
      const address = row[23];  // X열: 주소
      const status = row[3];    // D열: 거래상태
      
      // 사용 중인 매장만 처리
      if (!address || status !== "사용") continue;

      try {
        // Google Geocoding API 호출
        const results = await geocoder.geocode(address + ', 대한민국');
        
        if (results && results[0]) {
          const { latitude, longitude } = results[0];
          
          // A열과 B열에 위도/경도 업데이트
          updates.push({
            range: `${STORE_SHEET_NAME}!A${i + 2}:B${i + 2}`,
            values: [[latitude, longitude]]
          });

          console.log(`Updated coordinates for address: ${address}`);
          console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
        } else {
          console.log(`No results found for address: ${address}`);
        }
      } catch (error) {
        console.error(`Error geocoding address: ${address}`, error);
      }

      // API 할당량 제한을 피하기 위한 지연
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    
    // 환경변수 디버깅
    console.log('Discord 봇 환경변수 상태:');
    console.log('- DISCORD_BOT_TOKEN 설정됨:', !!process.env.DISCORD_BOT_TOKEN);
    console.log('- DISCORD_CHANNEL_ID 설정됨:', !!process.env.DISCORD_CHANNEL_ID);
    console.log('- DISCORD_LOGGING_ENABLED 설정됨:', process.env.DISCORD_LOGGING_ENABLED);
    
    // 봇 로그인 (서버 시작 후)
    if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
      console.log('서버 시작 후 Discord 봇 로그인 시도...');
      try {
        await discordBot.login(DISCORD_BOT_TOKEN);
        console.log('Discord 봇 연결 성공!');
        
        // 채널 연결 테스트
        const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel) {
          console.log(`채널 '${channel.name}' 연결 성공!`);
          
          // 테스트 메시지 전송
          const testEmbed = new EmbedBuilder()
            .setTitle('서버 시작 알림')
            .setColor(5763719)
            .setDescription('서버가 성공적으로 시작되었습니다.')
            .setTimestamp()
            .setFooter({ text: 'VIP+ 서버' });
            
          await channel.send({ embeds: [testEmbed] });
          console.log('서버 시작 알림 메시지 전송됨');
        }
      } catch (error) {
        console.error('서버 시작 시 Discord 봇 초기화 오류:', error.message);
      }
    }
    
    // 주소 업데이트 함수 호출
    console.log('모든 사용 중인 주소에 대해 위도/경도 값을 업데이트합니다...');
    await checkAndUpdateAddresses();
    
    // 매 시간마다 업데이트 체크 실행 (3600000ms = 1시간)
    setInterval(checkAndUpdateAddresses, 3600000);
  } catch (error) {
    console.error('Error during server startup:', error);
  }
}).on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// 정상적인 종료 처리
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 