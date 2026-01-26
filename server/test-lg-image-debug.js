/**
 * LG 시세표 이미지 로드 디버깅 스크립트
 * 
 * 목적:
 * - 직영점_모델이미지 시트에서 LG 데이터 확인
 * - imageMap 생성 로직 검증
 * - 실제 모델명과 이미지 매핑 확인
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
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

// 모델 코드 정규화 함수 (directRoutes.js와 동일)
function normalizeModelCode(code) {
  if (!code) return '';
  return code
    .toString()
    .toLowerCase()
    .replace(/[\s\-_]/g, '')
    .trim();
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

async function testLGImageLoad() {
  try {
    console.log('=== LG 시세표 이미지 로드 디버깅 시작 ===\n');

    // 1. Google Sheets 클라이언트 생성
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 2. 직영점_모델이미지 시트 읽기
    console.log('📋 직영점_모델이미지 시트 읽기 중...');
    const imageRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_모델이미지!A:K'
    });

    const imageRows = (imageRes.data.values || []).slice(1);
    console.log(`✅ 전체 이미지 행 수: ${imageRows.length}\n`);

    // 3. LG 데이터만 필터링
    const lgImageRows = imageRows.filter(row => {
      const carrier = (row[0] || '').trim();
      return carrier === 'LG';
    });

    console.log(`🔍 LG 이미지 행 수: ${lgImageRows.length}\n`);

    if (lgImageRows.length === 0) {
      console.log('⚠️ LG 이미지 데이터가 없습니다.');
      return;
    }

    // 4. LG 이미지 데이터 출력
    console.log('=== LG 이미지 데이터 ===');
    lgImageRows.forEach((row, idx) => {
      const carrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      const petName = (row[3] || '').trim();
      const manufacturer = (row[4] || '').trim();
      let imageUrl = (row[5] || '').trim();
      const note = (row[6] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      // 이미지 URL 정규화
      imageUrl = normalizeImageUrl(imageUrl);

      console.log(`\n[${idx + 1}] ${modelName || modelId}`);
      console.log(`  - 통신사: ${carrier}`);
      console.log(`  - 모델ID: ${modelId}`);
      console.log(`  - 모델명: ${modelName}`);
      console.log(`  - 펫네임: ${petName}`);
      console.log(`  - 제조사: ${manufacturer}`);
      console.log(`  - 이미지URL: ${imageUrl ? '있음' : '없음'}`);
      if (imageUrl) {
        console.log(`    ${imageUrl.substring(0, 80)}...`);
      }
      console.log(`  - Discord메시지ID: ${discordMessageId || '없음'}`);
      console.log(`  - Discord스레드ID: ${discordThreadId || '없음'}`);
      console.log(`  - 비고: ${note || '없음'}`);
    });

    // 5. imageMap 생성 (directRoutes.js와 동일한 로직)
    console.log('\n\n=== imageMap 생성 ===');
    const imageMap = new Map();
    const carrierParam = 'LG';
    let imageMapCount = 0;

    imageRows.forEach(row => {
      const rowCarrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      let imageUrl = (row[5] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      // 이미지 URL 정규화
      imageUrl = normalizeImageUrl(imageUrl);

      // 이미지 URL이 없으면 건너뛰기
      if (!imageUrl) {
        return;
      }

      // 통신사가 비어있으면 건너뛰기
      if (!rowCarrier) {
        return;
      }

      // 통신사가 일치하는 경우만 매핑
      if (rowCarrier === carrierParam) {
        const actualModelCode = modelId || modelName;

        if (actualModelCode) {
          // 이미지 정보 객체 생성
          const imageInfo = {
            imageUrl,
            discordMessageId: discordMessageId || null,
            discordThreadId: discordThreadId || null
          };

          // 원본 모델 코드로 키 생성
          const key = `${carrierParam}:${actualModelCode}`;
          imageMap.set(key, imageInfo);
          imageMap.set(actualModelCode, imageInfo);
          imageMapCount++;

          // 정규화된 모델 코드로도 키 생성
          const normalizedCode = normalizeModelCode(actualModelCode);
          if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
            const normalizedKey = `${carrierParam}:${normalizedCode}`;
            imageMap.set(normalizedKey, imageInfo);
            imageMap.set(normalizedCode, imageInfo);
          }

          console.log(`✅ 매핑 추가: ${actualModelCode}`);
          console.log(`   - 키1: ${key}`);
          console.log(`   - 키2: ${actualModelCode}`);
          if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
            console.log(`   - 키3: ${carrierParam}:${normalizedCode}`);
            console.log(`   - 키4: ${normalizedCode}`);
          }
        }
      }
    });

    console.log(`\n✅ imageMap 생성 완료: ${imageMapCount}개 매핑\n`);

    // 6. imageMap 키 목록 출력
    console.log('=== imageMap 키 목록 ===');
    const mapKeys = Array.from(imageMap.keys());
    mapKeys.forEach((key, idx) => {
      const imageInfo = imageMap.get(key);
      const url = imageInfo && typeof imageInfo === 'object' ? imageInfo.imageUrl : imageInfo;
      console.log(`[${idx + 1}] ${key} -> ${url ? '이미지 있음' : '이미지 없음'}`);
    });

    // 7. 시세표 모델명으로 이미지 조회 테스트
    console.log('\n\n=== 시세표 모델명으로 이미지 조회 테스트 ===');
    
    // LG 시세표 데이터 읽기 (링크 설정에서 시트 정보 가져오기)
    const linkSettingsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_링크설정!A:Z'
    });

    const linkRows = (linkSettingsRes.data.values || []).slice(1);
    const lgPolicyRow = linkRows.find(row => {
      const carrier = (row[0] || '').trim();
      const settingType = (row[1] || '').trim();
      return carrier === 'LG' && settingType === 'policy';
    });

    if (!lgPolicyRow) {
      console.log('⚠️ LG 정책표 링크 설정을 찾을 수 없습니다.');
      return;
    }

    const policySheetId = (lgPolicyRow[2] || '').trim();
    const modelRange = (lgPolicyRow[4] || '').trim();

    console.log(`📋 LG 정책표 시트ID: ${policySheetId}`);
    console.log(`📋 모델명 범위: ${modelRange}\n`);

    // 정책표에서 모델명 읽기
    const modelRes = await sheets.spreadsheets.values.get({
      spreadsheetId: policySheetId,
      range: modelRange
    });

    const modelData = modelRes.data.values || [];
    console.log(`✅ 정책표 모델명 수: ${modelData.length}\n`);

    // 각 모델명으로 이미지 조회 테스트
    console.log('=== 이미지 조회 결과 ===');
    modelData.slice(0, 10).forEach((row, idx) => {
      const model = (row[0] || '').toString().trim();
      if (!model) return;

      console.log(`\n[${idx + 1}] 모델명: ${model}`);

      // 1. 통신사+모델명 조합
      const key = `${carrierParam}:${model}`;
      let imageInfo = imageMap.get(key);
      let foundVia = imageInfo ? `key1:${key}` : null;

      // 2. 모델명만
      if (!imageInfo) {
        imageInfo = imageMap.get(model);
        if (imageInfo) foundVia = `key2:${model}`;
      }

      // 3. 정규화된 키
      if (!imageInfo) {
        const normalizedModel = normalizeModelCode(model);
        if (normalizedModel) {
          const normalizedKey = `${carrierParam}:${normalizedModel}`;
          imageInfo = imageMap.get(normalizedKey);
          if (imageInfo) {
            foundVia = `key3:${normalizedKey}`;
          } else {
            imageInfo = imageMap.get(normalizedModel);
            if (imageInfo) foundVia = `key4:${normalizedModel}`;
          }
        }
      }

      // 4. 유사 키 찾기
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

      // 결과 출력
      if (imageInfo) {
        const url = imageInfo && typeof imageInfo === 'object' ? imageInfo.imageUrl : imageInfo;
        console.log(`  ✅ 이미지 찾음: ${foundVia}`);
        console.log(`     URL: ${url ? url.substring(0, 80) + '...' : '없음'}`);
      } else {
        console.log(`  ❌ 이미지 없음`);
      }
    });

    console.log('\n\n=== 디버깅 완료 ===');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
    console.error(error.stack);
  }
}

// 실행
testLGImageLoad();
