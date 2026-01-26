/**
 * LG 시세표 데이터 확인 테스트
 * 
 * 목적: LG 통신사의 실제 시세표 데이터와 이미지 매핑 확인
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEET_ID;

async function testLGMobileList() {
  console.log('='.repeat(80));
  console.log('LG 시세표 데이터 확인');
  console.log('='.repeat(80));

  try {
    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('\n1. 직영점_링크설정 시트에서 LG 설정 읽기...');
    const linkRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_링크설정!A:Z'
    });

    const linkRows = (linkRes.data.values || []).slice(1);
    const lgLinkRow = linkRows.find(row => (row[0] || '').trim() === 'LG' && (row[1] || '').trim() === 'support');

    if (!lgLinkRow) {
      console.error('   ❌ LG 지원금 링크 설정을 찾을 수 없습니다!');
      return;
    }

    const lgSheetId = (lgLinkRow[2] || '').trim();
    const lgSettings = JSON.parse(lgLinkRow[4] || '{}');
    
    console.log(`   ✅ LG 지원금 시트 ID: ${lgSheetId}`);
    console.log(`   설정:`, JSON.stringify(lgSettings, null, 2));

    // 모델 범위 확인
    const modelRange = lgSettings.modelRange;
    if (!modelRange) {
      console.error('   ❌ 모델 범위가 설정되지 않았습니다!');
      return;
    }

    console.log(`\n2. LG 지원금 시트에서 모델명 읽기 (범위: ${modelRange})...`);
    const modelRes = await sheets.spreadsheets.values.get({
      spreadsheetId: lgSheetId,
      range: modelRange
    });

    const modelData = (modelRes.data.values || []).map(row => (row[0] || '').toString().trim());
    console.log(`   총 ${modelData.length}개 모델`);
    console.log(`   샘플 (처음 10개):`);
    modelData.slice(0, 10).forEach((model, index) => {
      console.log(`      [${index + 1}] ${model}`);
    });

    console.log('\n3. 직영점_모델이미지 시트에서 LG 이미지 읽기...');
    const imageRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_모델이미지!A:K'
    });

    const imageRows = (imageRes.data.values || []).slice(1);
    const lgImageRows = imageRows.filter(row => (row[0] || '').trim() === 'LG');
    
    console.log(`   총 ${lgImageRows.length}개 LG 이미지`);
    console.log(`   샘플 (처음 10개):`);
    lgImageRows.slice(0, 10).forEach((row, index) => {
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      const imageUrl = (row[5] || '').trim();
      console.log(`      [${index + 1}] 모델ID: ${modelId}, 모델명: ${modelName}`);
      console.log(`           이미지: ${imageUrl ? imageUrl.substring(0, 60) + '...' : '없음'}`);
    });

    console.log('\n4. 모델명 매칭 분석...');
    let matchCount = 0;
    let mismatchCount = 0;
    const mismatchSamples = [];

    modelData.forEach(model => {
      if (!model) return;
      
      const found = lgImageRows.some(row => {
        const modelId = (row[1] || '').trim();
        const modelName = (row[2] || '').trim();
        return modelId === model || modelName === model;
      });

      if (found) {
        matchCount++;
      } else {
        mismatchCount++;
        if (mismatchSamples.length < 10) {
          mismatchSamples.push(model);
        }
      }
    });

    console.log(`   ✅ 매칭된 모델: ${matchCount}개`);
    console.log(`   ❌ 매칭 안 된 모델: ${mismatchCount}개`);
    
    if (mismatchSamples.length > 0) {
      console.log(`\n   매칭 안 된 모델 샘플:`);
      mismatchSamples.forEach((model, index) => {
        console.log(`      [${index + 1}] ${model}`);
      });
    }

    console.log('\n5. 직영점_단말마스터 시트에서 LG 데이터 읽기...');
    const masterRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_단말마스터!A:Z'
    });

    const masterRows = (masterRes.data.values || []).slice(1);
    const lgMasterRows = masterRows.filter(row => (row[0] || '').trim() === 'LG');
    
    console.log(`   총 ${lgMasterRows.length}개 LG 단말`);
    console.log(`   샘플 (처음 10개):`);
    lgMasterRows.slice(0, 10).forEach((row, index) => {
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      console.log(`      [${index + 1}] 모델ID: ${modelId}, 모델명: ${modelName}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('테스트 완료');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 테스트 실행
testLGMobileList().catch(console.error);
