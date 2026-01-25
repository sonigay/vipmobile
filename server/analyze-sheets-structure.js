/**
 * Google Sheets 데이터 구조 분석 스크립트
 * 실제 컬럼명과 샘플 데이터를 확인합니다
 */

require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// 분석할 시트 목록
const SHEETS_TO_ANALYZE = [
  '직영점_요금제마스터',
  '직영점_단말마스터',
  '직영점_단말요금정책'
];

async function analyzeSheet(sheetName) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 시트: ${sheetName}`);
    console.log('='.repeat(70));

    const doc = new GoogleSpreadsheet(SHEET_ID);
    
    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    });

    await doc.loadInfo();
    
    const sheet = doc.sheetsByTitle[sheetName];
    
    if (!sheet) {
      console.log(`❌ 시트를 찾을 수 없습니다: ${sheetName}`);
      return;
    }

    const rows = await sheet.getRows();
    
    console.log(`\n📊 기본 정보:`);
    console.log(`  - 총 행 수: ${rows.length}`);
    console.log(`  - 헤더 행: ${sheet.headerValues.length}개 컬럼`);

    console.log(`\n📝 컬럼 목록 (${sheet.headerValues.length}개):`);
    sheet.headerValues.forEach((header, index) => {
      console.log(`  ${index + 1}. "${header}"`);
    });

    if (rows.length > 0) {
      console.log(`\n🔍 첫 번째 행 샘플 데이터:`);
      const firstRow = rows[0];
      sheet.headerValues.forEach((header) => {
        const value = firstRow.get(header);
        const displayValue = value === '' ? '(빈 값)' : value === null ? '(null)' : value === undefined ? '(undefined)' : value;
        console.log(`  "${header}": ${displayValue}`);
      });

      if (rows.length > 1) {
        console.log(`\n🔍 두 번째 행 샘플 데이터:`);
        const secondRow = rows[1];
        sheet.headerValues.forEach((header) => {
          const value = secondRow.get(header);
          const displayValue = value === '' ? '(빈 값)' : value === null ? '(null)' : value === undefined ? '(undefined)' : value;
          console.log(`  "${header}": ${displayValue}`);
        });
      }
    }

    // 필수 컬럼 체크
    console.log(`\n✅ 필수 컬럼 존재 여부:`);
    const requiredColumns = {
      '직영점_요금제마스터': ['통신사', '요금제명'],
      '직영점_단말마스터': ['통신사', '모델ID', '모델명'],
      '직영점_단말요금정책': ['통신사', '모델ID']
    };

    const required = requiredColumns[sheetName] || [];
    required.forEach(col => {
      const exists = sheet.headerValues.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} "${col}"`);
    });

  } catch (error) {
    console.error(`\n❌ 에러 발생:`, error.message);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 Google Sheets 데이터 구조 분석');
  console.log('='.repeat(70));
  console.log(`Spreadsheet ID: ${SHEET_ID}`);
  console.log(`분석할 시트: ${SHEETS_TO_ANALYZE.length}개`);

  for (const sheetName of SHEETS_TO_ANALYZE) {
    await analyzeSheet(sheetName);
    
    // Rate limiting 방지
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ 분석 완료!');
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
