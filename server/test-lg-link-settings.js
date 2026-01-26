/**
 * LG 링크 설정 확인
 * 
 * 목적:
 * - 직영점_설정 시트에서 LG 링크 설정 확인
 * - 정책표 시트 ID와 범위 확인
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEET_ID;

// Google Sheets 인증
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function testLGLinkSettings() {
  try {
    console.log('=== LG 링크 설정 확인 ===\n');

    // 1. Google Sheets 클라이언트 생성
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 2. 직영점_설정 시트 읽기
    console.log('📋 직영점_설정 시트 읽기 중...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_설정!A:Z'
    });

    const rows = (response.data.values || []).slice(1);
    console.log(`✅ 전체 설정 행 수: ${rows.length}\n`);

    // 3. LG 설정만 필터링
    const lgRows = rows.filter(row => {
      const carrier = (row[0] || '').trim();
      return carrier === 'LG';
    });

    console.log(`🔍 LG 설정 행 수: ${lgRows.length}\n`);

    if (lgRows.length === 0) {
      console.log('⚠️ LG 링크 설정이 없습니다.');
      return;
    }

    // 4. LG 설정 출력
    console.log('=== LG 링크 설정 ===');
    lgRows.forEach((row, idx) => {
      const carrier = (row[0] || '').trim();
      const settingType = (row[1] || '').trim();
      const sheetId = (row[2] || '').trim();
      const sheetUrl = (row[3] || '').trim();
      const modelRange = (row[4] || '').trim();
      const petNameRange = (row[5] || '').trim();
      const factoryPriceRange = (row[6] || '').trim();
      const supportRange = (row[7] || '').trim();

      console.log(`\n[${idx + 1}] ${settingType}`);
      console.log(`  - 통신사: ${carrier}`);
      console.log(`  - 시트ID: ${sheetId || '없음'}`);
      console.log(`  - 시트URL: ${sheetUrl ? sheetUrl.substring(0, 50) + '...' : '없음'}`);
      console.log(`  - 모델명 범위: ${modelRange || '없음'}`);
      console.log(`  - 펫네임 범위: ${petNameRange || '없음'}`);
      console.log(`  - 출고가 범위: ${factoryPriceRange || '없음'}`);
      console.log(`  - 지원금 범위: ${supportRange || '없음'}`);
    });

    // 5. policy 설정 확인
    console.log('\n\n=== LG policy 설정 상세 확인 ===');
    const policyRow = lgRows.find(row => (row[1] || '').trim() === 'policy');

    if (!policyRow) {
      console.log('❌ LG policy 설정을 찾을 수 없습니다.');
      return;
    }

    const policySheetId = (policyRow[2] || '').trim();
    const modelRange = (policyRow[4] || '').trim();

    console.log(`✅ LG policy 설정 찾음`);
    console.log(`  - 시트ID: ${policySheetId}`);
    console.log(`  - 모델명 범위: ${modelRange}\n`);

    // 6. 정책표 시트에서 데이터 읽기 시도
    if (policySheetId && modelRange) {
      console.log('📋 정책표 시트에서 모델명 읽기 시도...');
      try {
        const policyResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: policySheetId,
          range: modelRange
        });

        const modelData = policyResponse.data.values || [];
        console.log(`✅ 모델명 데이터: ${modelData.length}개\n`);

        if (modelData.length > 0) {
          console.log('=== 처음 10개 모델명 ===');
          modelData.slice(0, 10).forEach((row, idx) => {
            const model = (row[0] || '').toString().trim();
            console.log(`[${idx + 1}] ${model}`);
          });
        }
      } catch (err) {
        console.error('❌ 정책표 시트 읽기 실패:', err.message);
      }
    } else {
      console.log('⚠️ 시트ID 또는 모델명 범위가 없습니다.');
    }

    console.log('\n\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
    console.error(error.stack);
  }
}

// 실행
testLGLinkSettings();
