// 휴대폰 시세표 데이터 로딩 진단 스크립트
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { google } = require('googleapis');

const SHEET_SETTINGS = '직영점_설정';
const SHEET_MOBILE_PRICING = '직영점_단말요금정책';

async function diagnose() {
  console.log('🔍 휴대폰 시세표 데이터 로딩 진단 시작...\n');

  // 1. 환경 변수 확인
  console.log('1️⃣ 환경 변수 확인:');
  const SPREADSHEET_ID = process.env.SHEET_ID;
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

  if (!SPREADSHEET_ID) {
    console.error('❌ SHEET_ID 환경 변수가 설정되지 않았습니다!');
    return;
  }
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_EMAIL 환경 변수가 설정되지 않았습니다!');
    return;
  }
  if (!GOOGLE_PRIVATE_KEY) {
    console.error('❌ GOOGLE_PRIVATE_KEY 환경 변수가 설정되지 않았습니다!');
    return;
  }

  console.log(`✅ SHEET_ID: ${SPREADSHEET_ID.substring(0, 10)}...${SPREADSHEET_ID.substring(SPREADSHEET_ID.length - 5)}`);
  console.log(`✅ GOOGLE_SERVICE_ACCOUNT_EMAIL: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
  console.log(`✅ GOOGLE_PRIVATE_KEY: ${GOOGLE_PRIVATE_KEY.substring(0, 50)}...\n`);

  // 2. Google Sheets 클라이언트 생성
  console.log('2️⃣ Google Sheets 클라이언트 생성...');
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('✅ Google Sheets 클라이언트 생성 완료\n');

  // 3. 링크설정 시트 읽기
  console.log('3️⃣ 링크설정 시트 읽기...');
  try {
    const settingsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_SETTINGS
    });
    const allRows = settingsRes.data.values || [];
    console.log(`✅ 링크설정 시트 읽기 완료: 총 ${allRows.length}행`);
    
    if (allRows.length > 0) {
      console.log(`   헤더: ${JSON.stringify(allRows[0])}`);
      
      const dataRows = allRows.slice(1);
      console.log(`   데이터 행 수: ${dataRows.length}`);
      
      // SK, KT, LG 통신사별 설정 확인
      for (const carrier of ['SK', 'KT', 'LG']) {
        const carrierSettings = dataRows.filter(row => (row[0] || '').trim() === carrier);
        console.log(`\n   ${carrier} 설정: ${carrierSettings.length}개`);
        carrierSettings.forEach((row, idx) => {
          console.log(`     ${idx + 1}. 설정유형: ${row[1]}, 시트ID: ${(row[2] || '').substring(0, 15)}...`);
        });
      }
    } else {
      console.warn('⚠️ 링크설정 시트가 비어있습니다!');
    }
  } catch (error) {
    console.error(`❌ 링크설정 시트 읽기 실패:`, error.message);
    return;
  }

  // 4. 단말요금정책 시트 읽기
  console.log('\n4️⃣ 단말요금정책 시트 읽기...');
  try {
    const pricingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_MOBILE_PRICING
    });
    const allRows = pricingRes.data.values || [];
    console.log(`✅ 단말요금정책 시트 읽기 완료: 총 ${allRows.length}행`);
    
    if (allRows.length > 0) {
      console.log(`   헤더: ${JSON.stringify(allRows[0])}`);
      
      const dataRows = allRows.slice(1);
      console.log(`   데이터 행 수: ${dataRows.length}`);
      
      // SK, KT, LG 통신사별 데이터 확인
      for (const carrier of ['SK', 'KT', 'LG']) {
        const carrierData = dataRows.filter(row => (row[0] || '').trim() === carrier);
        console.log(`   ${carrier} 데이터: ${carrierData.length}개`);
        
        if (carrierData.length > 0) {
          console.log(`     첫 번째 행: ${JSON.stringify(carrierData[0].slice(0, 5))}...`);
        }
      }
    } else {
      console.warn('⚠️ 단말요금정책 시트가 비어있습니다!');
    }
  } catch (error) {
    console.error(`❌ 단말요금정책 시트 읽기 실패:`, error.message);
  }

  console.log('\n✅ 진단 완료!');
}

diagnose().catch(error => {
  console.error('❌ 진단 중 오류 발생:', error);
  process.exit(1);
});
