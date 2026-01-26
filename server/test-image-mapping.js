/**
 * 시세표 이미지 매핑 테스트 스크립트
 * 
 * 목적: 직영점_모델이미지 시트의 데이터가 시세표에서 올바르게 로드되는지 확인
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SHEET_ID;

// 모델 코드 정규화 함수 (directRoutes.js와 동일)
function normalizeModelCode(modelCode) {
  if (!modelCode) return '';
  return modelCode.replace(/[\s\-_]/g, '').toLowerCase();
}

async function testImageMapping() {
  try {
    console.log('=== 시세표 이미지 매핑 테스트 시작 ===\n');

    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 직영점_모델이미지 시트 읽기
    console.log('1. 직영점_모델이미지 시트 읽기...');
    const imageResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_모델이미지!A:K'
    });

    const imageRows = (imageResponse.data.values || []).slice(1);
    console.log(`   - 총 ${imageRows.length}개 행 발견\n`);

    // 통신사별로 그룹화
    const carrierGroups = { SK: [], KT: [], LG: [] };
    
    imageRows.forEach((row, index) => {
      const carrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      const imageUrl = (row[5] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      if (carrier && (carrier === 'SK' || carrier === 'KT' || carrier === 'LG')) {
        carrierGroups[carrier].push({
          rowIndex: index + 2, // 헤더 제외
          modelId,
          modelName,
          imageUrl: imageUrl ? '✅' : '❌',
          discordMessageId: discordMessageId ? '✅' : '❌',
          discordThreadId: discordThreadId ? '✅' : '❌'
        });
      }
    });

    // 통신사별 통계 출력
    console.log('2. 통신사별 이미지 데이터 통계:');
    for (const [carrier, rows] of Object.entries(carrierGroups)) {
      const withImage = rows.filter(r => r.imageUrl === '✅').length;
      const withDiscordMsg = rows.filter(r => r.discordMessageId === '✅').length;
      const withDiscordThread = rows.filter(r => r.discordThreadId === '✅').length;
      
      console.log(`\n   ${carrier}:`);
      console.log(`   - 총 모델 수: ${rows.length}`);
      console.log(`   - 이미지 URL 있음: ${withImage}개 (${(withImage/rows.length*100).toFixed(1)}%)`);
      console.log(`   - Discord 메시지 ID 있음: ${withDiscordMsg}개 (${(withDiscordMsg/rows.length*100).toFixed(1)}%)`);
      console.log(`   - Discord 스레드 ID 있음: ${withDiscordThread}개 (${(withDiscordThread/rows.length*100).toFixed(1)}%)`);
    }

    // 이미지 매핑 시뮬레이션 (SK 통신사 기준)
    console.log('\n\n3. 이미지 매핑 시뮬레이션 (SK 통신사):');
    const carrier = 'SK';
    const imageMap = new Map();
    let imageMapCount = 0;

    imageRows.forEach(row => {
      const rowCarrier = (row[0] || '').trim();
      const modelId = (row[1] || '').trim();
      const modelName = (row[2] || '').trim();
      const imageUrl = (row[5] || '').trim();
      const discordMessageId = (row[8] || '').trim();
      const discordThreadId = (row[10] || '').trim();

      if (!imageUrl || !rowCarrier || rowCarrier !== carrier) {
        return;
      }

      const actualModelCode = modelId || modelName;
      if (actualModelCode) {
        const imageInfo = {
          imageUrl,
          discordMessageId: discordMessageId || null,
          discordThreadId: discordThreadId || null
        };

        // 원본 모델 코드로 키 생성
        const key = `${carrier}:${actualModelCode}`;
        imageMap.set(key, imageInfo);
        imageMap.set(actualModelCode, imageInfo);
        imageMapCount++;

        // 정규화된 모델 코드로도 키 생성
        const normalizedCode = normalizeModelCode(actualModelCode);
        if (normalizedCode && normalizedCode !== actualModelCode.toLowerCase()) {
          const normalizedKey = `${carrier}:${normalizedCode}`;
          imageMap.set(normalizedKey, imageInfo);
          imageMap.set(normalizedCode, imageInfo);
        }
      }
    });

    console.log(`   - 이미지 맵 생성 완료: ${imageMapCount}개 모델`);
    console.log(`   - 총 맵 키 수: ${imageMap.size}개\n`);

    // 샘플 모델 코드로 이미지 조회 테스트
    console.log('4. 샘플 모델 이미지 조회 테스트:');
    const sampleModels = ['SM-S926N256', 'SM-S928N512', 'UIP17-256', 'SM-F766N256', 'SM-S731N'];
    
    for (const model of sampleModels) {
      const key = `${carrier}:${model}`;
      let imageInfo = imageMap.get(key);
      let foundVia = imageInfo ? `key1:${key}` : null;

      if (!imageInfo) {
        imageInfo = imageMap.get(model);
        if (imageInfo) foundVia = `key2:${model}`;
      }

      if (!imageInfo) {
        const normalizedModel = normalizeModelCode(model);
        if (normalizedModel) {
          const normalizedKey = `${carrier}:${normalizedModel}`;
          imageInfo = imageMap.get(normalizedKey);
          if (imageInfo) {
            foundVia = `key3:${normalizedKey}`;
          } else {
            imageInfo = imageMap.get(normalizedModel);
            if (imageInfo) foundVia = `key4:${normalizedModel}`;
          }
        }
      }

      if (imageInfo) {
        const imgUrl = typeof imageInfo === 'object' ? imageInfo.imageUrl : imageInfo;
        console.log(`   ✅ ${model}: 이미지 찾음 (${foundVia})`);
        console.log(`      URL: ${imgUrl.substring(0, 60)}...`);
      } else {
        console.log(`   ❌ ${model}: 이미지 없음`);
        
        // 유사한 키 찾기
        const modelNormalized = normalizeModelCode(model);
        const mapKeys = Array.from(imageMap.keys());
        const similarKeys = mapKeys.filter(k => {
          const keyWithoutCarrier = k.includes(':') ? k.split(':')[1] : k;
          const keyNormalized = normalizeModelCode(keyWithoutCarrier);
          return keyNormalized.includes(modelNormalized) || modelNormalized.includes(keyNormalized);
        });
        
        if (similarKeys.length > 0) {
          console.log(`      유사 키: ${similarKeys.slice(0, 3).join(', ')}`);
        }
      }
    }

    console.log('\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('테스트 실패:', error);
    process.exit(1);
  }
}

testImageMapping();
