require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const NodeGeocoder = require('node-geocoder');

const app = express();
const port = process.env.PORT || 4000;

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

    // 매장별 재고 데이터 매핑
    const inventoryMap = {};
    
    console.log('Processing inventory data...');
    inventoryRows.forEach((row, index) => {
      if (!row || row.length < 14) return; // 최소 N열까지 데이터가 있어야 함
      
      const storeName = (row[13] || '').toString().trim();  // N열: 매장명
      const model = (row[5] || '').toString().trim();      // F열: 모델
      const color = (row[6] || '').toString().trim();      // G열: 색상
      
      if (!storeName || !model || !color) {
        console.log(`Skipping row ${index + 4}: Invalid data`, { storeName, model, color });
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
        const address = (row[23] || '').toString();    // X열: 주소
        
        // 빈 매장 ID 제외
        if (!storeId || storeId.toString().trim() === '') {
          return null;
        }

        const inventory = inventoryMap[name] || {};
        
        // 재고 데이터 로깅 (특정 매장에 대해서만)
        if (name === "승텔레콤(인천부평)") {
          console.log('Found store:', name);
          console.log('Inventory data:', JSON.stringify(inventory, null, 2));
        }

        return {
          id: storeId.toString(),
          name,
          address,
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
        모델수: Object.keys(store.inventory).length,
        재고현황: store.inventory
      }));
    
    console.log('Inventory summary:', JSON.stringify(inventorySummary, null, 2));
    
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

    for (let i = 0; i < storeRows.length; i++) {
      const row = storeRows[i];
      const address = row[23];  // X열: 주소
      const status = row[3];    // D열: 거래상태
      const latitude = row[0];   // A열: 위도
      const longitude = row[1];  // B열: 경도
      
      // 사용 중이고 위도/경도가 없는 매장만 처리
      if (!address || status !== "사용" || (latitude && longitude)) continue;

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
    console.log(`Server is running on http://localhost:${port}`);
    
    // 서버 시작 시 첫 업데이트 실행
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