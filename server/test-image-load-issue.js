/**
 * 시세표 이미지 로드 문제 테스트 스크립트
 * 
 * 목적: LG 통신사의 시세표 이미지가 제대로 로드되는지 확인
 * 
 * 테스트 항목:
 * 1. 직영점_모델이미지 시트에서 LG 데이터 읽기
 * 2. 이미지 맵 생성 확인
 * 3. 실제 모델 코드와 이미지 URL 매핑 확인
 * 4. 정규화 로직 확인
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEET_ID;

// 모델 코드 정규화 함수 (directRoutes.js와 동일)
function normalizeModelCode(code) {
  if (!code) return '';
  return code
    .toString()
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .toLowerCase();
}

// 이미지 URL 정규화 함수 (directRoutes.js와 동일)
function normalizeImageUrl(url) {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    if (filename.includes('--')) {
      const normalizedFilename = filename.replace(/--+/g, '-');
      pathParts[pathParts.length - 1] = normalizedFilename;
      urlObj.pathname = pathParts.join('/');
      return urlObj.toString();
    }
    return url;
  } catch (err) {
    return url.replace(/--+/g, '-');
  }
}

async function testImageLoad() {
  console.log('='.repeat(80));
  console.log('시세표 이미지 로드 문제 테스트');
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

    console.log('\n1. 직영점_모델이미지 시트에서 LG 데이터 읽기...');
    const imageRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_모델이미지!A:K'
    });

    const imageRows = (imageRes.data.values || []).slice(1);
    console.log(`   총 ${imageRows.length}개 행 읽음`);

    // LG 데이터만 필터링
    const lgRows = imageRows.filter(row => (row[0] || '').trim() === 'LG');
    console.log(`   LG 데이터: ${lgRows.length}개`);

    if (lgRows.length === 0) {
      console.error('\n❌ 오류: 직영점_모델이미지 시트에 LG 데이터가 없습니다!');
      return;
    }

    console.log('\n2. 이미지 맵 생성...');
    const imageMap = new Map();
    let imageMapCount = 0;

    lgRows.forEach((row, index) => {
      const rowCarrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      let imageUrl = (row[5] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      // 이미지 URL 정규화
      imageUrl = normalizeImageUrl(imageUrl);

      if (!imageUrl) {
        console.log(`   [${index + 1}] 건너뛰기: 이미지 URL 없음 (모델ID=${modelId}, 모델명=${modelName})`);
        return;
      }

      if (!rowCarrier) {
        console.log(`   [${index + 1}] 건너뛰기: 통신사 없음`);
        return;
      }

      if (rowCarrier === 'LG') {
        const actualModelCode = modelId || modelName;

        if (actualModelCode) {
          const imageInfo = {
            imageUrl,
            discordMessageId: discordMessageId || null,
            discordThreadId: discordThreadId || null
          };

          // 원본 모델 코드로 키 생성
          const key = `LG:${actualModelCode}`;
          imageMap.set(key, imageInfo);
          imageMap.set(actualModelCode, imageInfo);
          imageMapCount++;

          console.log(`   [${index + 1}] ✅ 매핑 성공: ${actualModelCode}`);
          console.log(`        키1: ${key}`);
          console.log(`        키2: ${actualModelCode}`);
          console.log(`        이미지: ${imageUrl.substring(0, 60)}...`);

          // 정규화된 모델 코드로도 키 생성
          const normalizedCode = normalizeModelCode(actualModelCode);
          if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
            const normalizedKey = `LG:${normalizedCode}`;
            imageMap.set(normalizedKey, imageInfo);
            imageMap.set(normalizedCode, imageInfo);
            console.log(`        키3: ${normalizedKey}`);
            console.log(`        키4: ${normalizedCode}`);
          }
        }
      }
    });

    console.log(`\n   이미지 맵 생성 완료: ${imageMapCount}개 (통신사=LG)`);
    console.log(`   총 키 개수: ${imageMap.size}개`);

    console.log('\n3. 이미지 맵 샘플 확인...');
    let sampleCount = 0;
    for (const [key, value] of imageMap.entries()) {
      if (sampleCount >= 5) break;
      console.log(`   키: ${key}`);
      console.log(`   값: ${JSON.stringify(value, null, 2)}`);
      sampleCount++;
    }

    console.log('\n4. 특정 모델 코드로 이미지 조회 테스트...');
    // LG의 대표 모델 코드 몇 개로 테스트
    const testModels = [
      'LM-Q910N',
      'LM-V600N',
      'LM-G900N'
    ];

    testModels.forEach(model => {
      console.log(`\n   모델: ${model}`);
      
      // 1. 통신사+모델코드 조합
      const key1 = `LG:${model}`;
      const imageInfo1 = imageMap.get(key1);
      console.log(`   키1 (LG:${model}): ${imageInfo1 ? '✅ 찾음' : '❌ 없음'}`);
      if (imageInfo1) {
        console.log(`      이미지: ${imageInfo1.imageUrl.substring(0, 60)}...`);
      }

      // 2. 모델코드만
      const imageInfo2 = imageMap.get(model);
      console.log(`   키2 (${model}): ${imageInfo2 ? '✅ 찾음' : '❌ 없음'}`);

      // 3. 정규화된 키
      const normalizedModel = normalizeModelCode(model);
      const key3 = `LG:${normalizedModel}`;
      const imageInfo3 = imageMap.get(key3);
      console.log(`   키3 (LG:${normalizedModel}): ${imageInfo3 ? '✅ 찾음' : '❌ 없음'}`);

      // 4. 정규화된 모델코드만
      const imageInfo4 = imageMap.get(normalizedModel);
      console.log(`   키4 (${normalizedModel}): ${imageInfo4 ? '✅ 찾음' : '❌ 없음'}`);
    });

    console.log('\n5. 이미지 URL 접근 테스트...');
    const firstKey = Array.from(imageMap.keys())[0];
    const firstValue = imageMap.get(firstKey);
    console.log(`   첫 번째 키: ${firstKey}`);
    console.log(`   값 타입: ${typeof firstValue}`);
    console.log(`   값: ${JSON.stringify(firstValue, null, 2)}`);
    
    if (typeof firstValue === 'object' && firstValue.imageUrl) {
      console.log(`   ✅ 이미지 URL 접근 성공: ${firstValue.imageUrl.substring(0, 60)}...`);
    } else if (typeof firstValue === 'string') {
      console.log(`   ⚠️ 값이 문자열입니다 (하위 호환 모드): ${firstValue.substring(0, 60)}...`);
    } else {
      console.log(`   ❌ 이미지 URL 접근 실패`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('테스트 완료');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 테스트 실행
testImageLoad().catch(console.error);
