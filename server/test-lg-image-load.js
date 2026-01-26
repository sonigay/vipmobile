/**
 * LG 시세표 이미지 로드 테스트
 * 
 * 목적: 시세표에서 모델 이미지가 로드되지 않는 문제 진단
 * 
 * 테스트 항목:
 * 1. 직영점_모델이미지 시트에서 LG 이미지 데이터 확인
 * 2. imageMap 생성 로직 확인
 * 3. 이미지 매칭 로직 확인
 * 4. 실제 API 응답 확인
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEET_ID;

// 모델 코드 정규화 함수 (directRoutes.js와 동일)
function normalizeModelCode(code) {
  if (!code) return '';
  return code
    .toLowerCase()
    .replace(/[\s\-_]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function testLGImageLoad() {
  console.log('='.repeat(80));
  console.log('LG 시세표 이미지 로드 테스트 시작');
  console.log('='.repeat(80));

  try {
    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('\n1️⃣ 직영점_모델이미지 시트에서 LG 데이터 읽기...');
    const imageResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_모델이미지!A:K'
    });

    const imageRows = (imageResponse.data.values || []).slice(1);
    console.log(`   총 ${imageRows.length}개 행 읽음`);

    // LG 데이터만 필터링
    const lgRows = imageRows.filter(row => {
      const carrier = (row[0] || '').trim();
      return carrier === 'LG';
    });

    console.log(`   LG 데이터: ${lgRows.length}개`);

    if (lgRows.length === 0) {
      console.log('\n⚠️ LG 데이터가 없습니다!');
      console.log('   이것이 정상입니다. 사용자가 아직 LG 이미지를 업로드하지 않았습니다.');
      console.log('   SK나 KT 데이터가 있는지 확인해보겠습니다...\n');

      // SK, KT 데이터 확인
      const skRows = imageRows.filter(row => (row[0] || '').trim() === 'SK');
      const ktRows = imageRows.filter(row => (row[0] || '').trim() === 'KT');

      console.log(`   SK 데이터: ${skRows.length}개`);
      console.log(`   KT 데이터: ${ktRows.length}개`);

      if (skRows.length > 0) {
        console.log('\n   SK 데이터 샘플 (첫 3개):');
        skRows.slice(0, 3).forEach((row, idx) => {
          console.log(`   ${idx + 1}. 모델ID: ${row[1]}, 모델명: ${row[2]}, 이미지URL: ${row[5] ? '있음' : '없음'}`);
        });
      }

      if (ktRows.length > 0) {
        console.log('\n   KT 데이터 샘플 (첫 3개):');
        ktRows.slice(0, 3).forEach((row, idx) => {
          console.log(`   ${idx + 1}. 모델ID: ${row[1]}, 모델명: ${row[2]}, 이미지URL: ${row[5] ? '있음' : '없음'}`);
        });
      }

      return;
    }

    // LG 데이터 상세 출력
    console.log('\n   LG 데이터 상세:');
    lgRows.forEach((row, idx) => {
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      const imageUrl = (row[5] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      console.log(`   ${idx + 1}. 모델ID: ${modelId}, 모델명: ${modelName}`);
      console.log(`      이미지URL: ${imageUrl ? imageUrl.substring(0, 50) + '...' : '없음'}`);
      console.log(`      Discord메시지ID: ${discordMessageId || '없음'}`);
      console.log(`      Discord스레드ID: ${discordThreadId || '없음'}`);
    });

    console.log('\n2️⃣ imageMap 생성 로직 테스트...');
    const imageMap = new Map();
    let imageMapCount = 0;

    // 이미지 URL 정규화 함수
    const normalizeImageUrl = (url) => {
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
    };

    lgRows.forEach(row => {
      const rowCarrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      let imageUrl = (row[5] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      // 이미지 URL 정규화
      imageUrl = normalizeImageUrl(imageUrl);

      if (!imageUrl) {
        return;
      }

      if (!rowCarrier) {
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

          console.log(`   ✅ 매핑 생성: ${key}`);
          console.log(`      모델코드: ${actualModelCode}`);

          // 정규화된 모델 코드로도 키 생성
          const normalizedCode = normalizeModelCode(actualModelCode);
          if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
            const normalizedKey = `LG:${normalizedCode}`;
            imageMap.set(normalizedKey, imageInfo);
            imageMap.set(normalizedCode, imageInfo);
            console.log(`      정규화된 키: ${normalizedKey}`);
          }
        }
      }
    });

    console.log(`\n   총 ${imageMapCount}개 이미지 매핑 생성`);
    console.log(`   imageMap 크기: ${imageMap.size}`);

    console.log('\n3️⃣ imageMap 키 목록:');
    const keys = Array.from(imageMap.keys());
    keys.forEach((key, idx) => {
      console.log(`   ${idx + 1}. ${key}`);
    });

    console.log('\n4️⃣ 이미지 매칭 테스트...');
    // 테스트할 모델명 (LG 데이터에서 가져온 것)
    const testModels = lgRows.map(row => (row[1] || row[2] || '').trim()).filter(m => m);

    if (testModels.length === 0) {
      console.log('   테스트할 모델이 없습니다.');
      return;
    }

    console.log(`   테스트할 모델: ${testModels.length}개`);

    testModels.forEach((model, idx) => {
      console.log(`\n   ${idx + 1}. 모델: ${model}`);

      // 1. 통신사+모델명 조합으로 조회
      const key = `LG:${model}`;
      let imageInfo = imageMap.get(key);
      let foundVia = imageInfo ? `key1:${key}` : null;

      // 2. 모델명만으로 조회
      if (!imageInfo) {
        imageInfo = imageMap.get(model);
        if (imageInfo) foundVia = `key2:${model}`;
      }

      // 3. 정규화된 키로 조회
      if (!imageInfo) {
        const normalizedModel = normalizeModelCode(model);
        if (normalizedModel) {
          const normalizedKey = `LG:${normalizedModel}`;
          imageInfo = imageMap.get(normalizedKey);
          if (imageInfo) {
            foundVia = `key3:${normalizedKey}`;
          } else {
            imageInfo = imageMap.get(normalizedModel);
            if (imageInfo) foundVia = `key4:${normalizedModel}`;
          }
        }
      }

      // 4. 유사한 키 찾기
      if (!imageInfo && imageMap.size > 0) {
        const modelNormalized = normalizeModelCode(model);
        const mapKeys = Array.from(imageMap.keys());

        for (const mapKey of mapKeys) {
          const keyWithoutCarrier = mapKey.includes(':') ? mapKey.split(':')[1] : mapKey;
          const keyNormalized = normalizeModelCode(keyWithoutCarrier);

          if (keyNormalized === modelNormalized ||
            keyNormalized.includes(modelNormalized) ||
            modelNormalized.includes(keyNormalized)) {
            imageInfo = imageMap.get(mapKey);
            if (imageInfo) {
              foundVia = `key5:${mapKey}`;
              break;
            }
          }
        }
      }

      if (imageInfo) {
        console.log(`      ✅ 이미지 찾음: ${foundVia}`);
        if (typeof imageInfo === 'object' && imageInfo.imageUrl) {
          console.log(`      이미지URL: ${imageInfo.imageUrl.substring(0, 50)}...`);
        } else if (typeof imageInfo === 'string') {
          console.log(`      이미지URL: ${imageInfo.substring(0, 50)}...`);
        }
      } else {
        console.log(`      ❌ 이미지를 찾을 수 없음`);
      }
    });

    console.log('\n5️⃣ 실제 API 호출 테스트...');
    console.log('   API 엔드포인트: GET /api/direct/mobiles?carrier=LG');
    console.log('   브라우저에서 다음 URL을 열어 확인하세요:');
    console.log('   http://localhost:4000/api/direct/mobiles?carrier=LG');
    console.log('   또는 프론트엔드에서 시세표를 열어 LG 탭을 확인하세요.');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(80));
  console.log('테스트 완료');
  console.log('='.repeat(80));
}

// 실행
testLGImageLoad();
