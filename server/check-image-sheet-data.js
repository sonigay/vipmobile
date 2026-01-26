/**
 * 직영점_모델이미지 시트 데이터 상세 확인
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEET_ID;

async function checkImageSheetData() {
  try {
    console.log('=== 직영점_모델이미지 시트 데이터 확인 ===\n');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 직영점_모델이미지 시트 읽기
    const imageResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_모델이미지!A:K'
    });

    const rows = imageResponse.data.values || [];
    
    if (rows.length === 0) {
      console.log('❌ 시트에 데이터가 없습니다!');
      return;
    }

    // 헤더 출력
    console.log('헤더:', rows[0]);
    console.log('');

    // 데이터 행 분석
    const dataRows = rows.slice(1);
    console.log(`총 데이터 행 수: ${dataRows.length}\n`);

    // 통신사별 그룹화
    const carrierCounts = {};
    const carrierSamples = {};

    dataRows.forEach((row, index) => {
      const carrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      const imageUrl = (row[5] || '').trim();

      if (!carrierCounts[carrier]) {
        carrierCounts[carrier] = 0;
        carrierSamples[carrier] = [];
      }
      carrierCounts[carrier]++;

      // 각 통신사별로 처음 3개 샘플만 저장
      if (carrierSamples[carrier].length < 3) {
        carrierSamples[carrier].push({
          rowNum: index + 2,
          modelId,
          modelName,
          hasImage: !!imageUrl
        });
      }
    });

    // 통신사별 통계 출력
    console.log('통신사별 데이터 수:');
    for (const [carrier, count] of Object.entries(carrierCounts)) {
      console.log(`  ${carrier || '(빈값)'}: ${count}개`);
    }
    console.log('');

    // 각 통신사별 샘플 데이터 출력
    console.log('통신사별 샘플 데이터:');
    for (const [carrier, samples] of Object.entries(carrierSamples)) {
      console.log(`\n  ${carrier || '(빈값)'}:`);
      samples.forEach(sample => {
        console.log(`    행 ${sample.rowNum}: 모델ID="${sample.modelId}", 모델명="${sample.modelName}", 이미지=${sample.hasImage ? '✅' : '❌'}`);
      });
    }

    // SK, KT, LG 데이터 확인
    console.log('\n\n주요 통신사 데이터 확인:');
    ['SK', 'KT', 'LG'].forEach(carrier => {
      const count = carrierCounts[carrier] || 0;
      if (count === 0) {
        console.log(`  ❌ ${carrier}: 데이터 없음`);
      } else {
        console.log(`  ✅ ${carrier}: ${count}개`);
      }
    });

  } catch (error) {
    console.error('확인 실패:', error);
    process.exit(1);
  }
}

checkImageSheetData();
