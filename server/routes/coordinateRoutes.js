/**
 * Coordinate Routes
 * 
 * 주소를 위도/경도로 변환하여 시트에 업데이트하는 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - POST /api/update-coordinates - 주소를 위도/경도로 변환
 * - POST /api/update-sales-coordinates - 판매점 좌표 업데이트
 * 
 * Requirements: 1.1, 1.2, 7.5
 */

const express = require('express');
const router = express.Router();

/**
 * Kakao geocoding 함수
 */
async function geocodeAddressWithKakao(address, retryCount = 0) {
  const apiKey = process.env.KAKAO_API_KEY;
  if (!apiKey) {
    console.error('❌ [지오코딩] KAKAO_API_KEY 환경변수가 설정되어 있지 않습니다.');
    throw new Error('KAKAO_API_KEY 환경변수가 설정되어 있지 않습니다.');
  }

  // 주소 전처리 강화
  let cleanAddress = address.toString().trim();
  if (!cleanAddress) return null;

  // 지오코딩에 불필요한 상세 정보 제거 (괄호 안 내용, 호실 정보 등)
  // 예: "서울시 강남구 테헤란로 123 (역삼동, 1층)" -> "서울시 강남구 테헤란로 123"
  cleanAddress = cleanAddress.replace(/\s*\(.*?\)/g, '');
  cleanAddress = cleanAddress.replace(/\s+(\d+층|\d+호).*$/g, '');
  cleanAddress = cleanAddress.split(',')[0]; // 쉼표 이후 제거

  // 주소에 "시" 또는 "구"가 포함되어 있지 않으면 기본 지역 추가
  let processedAddress = cleanAddress;
  if (!cleanAddress.includes('시') && !cleanAddress.includes('구') && !cleanAddress.includes('군')) {
    processedAddress = `경기도 ${cleanAddress}`;
  }

  const encodedAddress = encodeURIComponent(processedAddress);
  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodedAddress}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${apiKey}`
      },
      timeout: 10000 // 10초 타임아웃
    });

    if (!response.ok) {
      if (response.status === 429) {
        // 할당량 초과
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (retryCount < 2) {
          return await geocodeAddressWithKakao(address, retryCount + 1);
        }
      }
      throw new Error(`Kakao geocoding API 오류: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();

    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      const result = {
        latitude: parseFloat(doc.y),
        longitude: parseFloat(doc.x)
      };
      return result;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Geocoding 오류 (${retryCount + 1}/3): ${processedAddress}`, error.message);

    // 네트워크 오류나 일시적 오류인 경우 재시도
    if (retryCount < 2 && (error.message.includes('fetch') || error.message.includes('timeout'))) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // 지수 백오프
      return await geocodeAddressWithKakao(address, retryCount + 1);
    }

    throw error;
  }
}

/**
 * 메인 geocoding 함수
 */
async function geocodeAddress(address) {
  return await geocodeAddressWithKakao(address);
}

/**
 * 해시 함수 (주소 변경 감지용)
 */
function createHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  return hash.toString();
}

/**
 * Coordinate Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createCoordinateRoutes(context) {
  const { sheetsClient, rateLimiter } = context;

  // Google Sheets 클라이언트가 없으면 에러 응답 반환하는 헬퍼 함수
  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({
        success: false,
        error: 'Google Sheets client not available. Please check environment variables.'
      });
      return false;
    }
    return true;
  };

  // 시트 데이터 가져오기 헬퍼 함수
  async function getSheetValues(sheetName, spreadsheetId = null) {
    const targetSpreadsheetId = spreadsheetId || sheetsClient.SPREADSHEET_ID;

    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: targetSpreadsheetId,
        range: `${sheetName}!A:Z`
      })
    );

    return response.data.values || [];
  }

  // 해시 파일 경로 (주소 변경 감지용)
  const HASH_FILE_PATH = require('path').join(__dirname, '..', '..', 'data', 'address_hashes.json');

  // 해시 로드/저장 헬퍼
  function getStoredHashes() {
    try {
      if (require('fs').existsSync(HASH_FILE_PATH)) {
        return JSON.parse(require('fs').readFileSync(HASH_FILE_PATH, 'utf8'));
      }
    } catch (e) { }
    return {};
  }

  function saveHashes(hashes) {
    try {
      const dir = require('path').dirname(HASH_FILE_PATH);
      if (!require('fs').existsSync(dir)) require('fs').mkdirSync(dir, { recursive: true });
      require('fs').writeFileSync(HASH_FILE_PATH, JSON.stringify(hashes, null, 2));
    } catch (e) { }
  }

  /**
   * 디스코드에 작업 요약 전송
   */
  async function sendDiscordSummary(title, fields) {
    const { discordBot, EmbedBuilder, DISCORD_CHANNEL_ID } = context;
    if (!discordBot || !EmbedBuilder || !DISCORD_CHANNEL_ID) return;

    try {
      const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .addFields(fields)
        .setTimestamp()
        .setColor(0x00AE86);

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('❌ [디스코드알림] 실패:', error.message);
    }
  }

  /**
   * 폰클출고처데이터 좌표 업데이트 핵심 로직
   */
  async function updateStoreCoordinates() {
    console.log('🗺️ [좌표업데이트] 폰클출고처데이터 업데이트 시작');

    const STORE_SHEET_NAME = '폰클출고처데이터';
    const storeValues = await getSheetValues(STORE_SHEET_NAME);

    if (!storeValues || storeValues.length === 0) {
      return { success: false, message: 'No data found in store sheet' };
    }

    // 헤더 제거
    const storeRows = storeValues.slice(1);
    const updates = [];
    const storedHashes = getStoredHashes();
    const currentHashes = { ...storedHashes };
    let changed = false;
    let upCount = 0;

    for (let i = 0; i < storeRows.length; i++) {
      const row = storeRows[i];
      const storeId = row[0] || `row_${i + 2}`; // A열: ID
      const address = row[11] || "";  // L열: 주소
      const status = row[12];    // M열: 거래상태
      const existingLat = row[8]; // I열
      const existingLng = row[9]; // J열

      const addressHash = createHash(address.toString().trim());
      const lastHash = currentHashes[`store_${storeId}`];

      if (status === "사용") {
        // 주소가 없으면 좌표 삭제
        if (!address.toString().trim()) {
          if (existingLat || existingLng) {
            updates.push({
              range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
              values: [["", ""]]
            });
            changed = true;
          }
          continue;
        }

        // 주소가 변경되었거나 좌표가 없는 경우에만 지오코딩 실행
        if (addressHash !== lastHash || !existingLat || !existingLng) {
          try {
            const result = await geocodeAddress(address);
            if (result) {
              const { latitude, longitude } = result;
              updates.push({
                range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
                values: [[latitude, longitude]]
              });
              currentHashes[`store_${storeId}`] = addressHash;
              changed = true;
              upCount++;
              console.log(`✅ [좌표업데이트] 성공: ${address}`);
            }
          } catch (error) {
            console.error(`❌ [좌표업데이트] 오류: ${address}`, error.message);
          }
          // API 할당량 제한을 피하기 위한 지연
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        // 미사용 매장은 위도/경도 삭제
        if (existingLat || existingLng) {
          updates.push({
            range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
            values: [["", ""]]
          });
          changed = true;
        }
      }
    }

    if (changed) saveHashes(currentHashes);

    // 일괄 업데이트 실행
    if (updates.length > 0) {
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: updates
          }
        })
      );
      console.log(`✅ [좌표업데이트] ${updates.length}개 좌표 업데이트 완료`);
    }

    // 최종 결과 보고
    if (upCount > 0) {
      await sendDiscordSummary('🗺️ 폰클출고처 위경도 업데이트 완료', [
        { name: '처리된 주소', value: `${upCount}개`, inline: true },
        { name: '시트 반영', value: `${updates.length}건`, inline: true }
      ]);
    }

    return {
      success: true,
      message: `Updated coordinates for ${upCount} addresses out of ${updates.length} items checked`,
      updatedCount: upCount,
      totalUpdates: updates.length
    };
  }

  /**
   * 판매점정보 좌표 업데이트 핵심 로직
   */
  async function updateSalesCoordinates() {
    console.log('🗺️ [판매점좌표] 판매점정보 업데이트 시작');

    const SALES_SPREADSHEET_ID = process.env.SALES_SHEET_ID || process.env.SHEET_ID;
    if (!SALES_SPREADSHEET_ID) {
      throw new Error('SALES_SHEET_ID 또는 SHEET_ID 환경변수가 설정되어 있지 않습니다.');
    }

    const SALES_SHEET_NAME = '판매점정보';
    const salesValues = await getSheetValues(SALES_SHEET_NAME, SALES_SPREADSHEET_ID);

    if (!salesValues || salesValues.length === 0) {
      return { success: false, message: 'No data found in sales sheet' };
    }

    // 헤더 제거 (2행부터 시작)
    const salesRows = salesValues.slice(1);
    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];
    const storedHashes = getStoredHashes();
    const currentHashes = { ...storedHashes };
    let changed = false;

    for (let i = 0; i < salesRows.length; i++) {
      const row = salesRows[i];
      const storeName = row[3] || ""; // D열: 판매점명
      const address = row[7];  // H열: 주소
      const existingLat = row[5]; // F열: 기존 위도
      const existingLng = row[6]; // G열: 기존 경도

      // 주소가 없거나 '주소확인필요'인 경우 건너뛰기
      if (!address || address.toString().trim() === '' || address.toString().trim() === '주소확인필요') {
        continue;
      }

      // 판매점명과 주소의 조합을 키로 사용 (행 정렬 대응)
      const salesId = storeName ? `${storeName}_${address}` : `row_${i + 2}`;
      const addressHash = createHash(address.toString().trim());
      const lastHash = currentHashes[`sales_${salesId}`];

      processedCount++;

      // 주소 변경 감지 또는 좌표 누락 시 업데이트
      if (addressHash !== lastHash || !existingLat || !existingLng) {
        try {
          console.log(`🗺️ [판매점좌표] 업데이트 시도: ${address}`);
          const result = await geocodeAddress(address);

          if (result) {
            const { latitude, longitude } = result;

            updates.push({
              range: `${SALES_SHEET_NAME}!F${i + 2}:G${i + 2}`,
              values: [[latitude, longitude]]
            });

            updatedCount++;
            currentHashes[`sales_${salesId}`] = addressHash;
            changed = true;
            console.log(`✅ [판매점좌표] 성공: ${address}`);
          } else {
            console.log(`❌ [판매점좌표] 결과 없음: ${address}`);
          }
        } catch (error) {
          console.error(`❌ [판매점좌표] 오류: ${address}`, error.message);
        }

        // API 할당량 제한을 피하기 위한 지연
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        skippedCount++;
      }
    }

    if (changed) saveHashes(currentHashes);

    // 일괄 업데이트 실행
    if (updates.length > 0) {
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SALES_SPREADSHEET_ID,
          resource: {
            valueInputOption: 'USER_ENTERED',
            data: updates
          }
        })
      );
      console.log(`✅ [판매점좌표] ${updates.length}개 좌표 일괄 업데이트 완료`);
    }

    console.log(`📊 [판매점좌표] 주소 업데이트 완료 - 처리: ${processedCount}개, 업데이트: ${updatedCount}개, 건너뜀: ${skippedCount}개`);

    // 최종 결과 보고
    if (updatedCount > 0) {
      await sendDiscordSummary('🗺️ 판매점정보 위경도 업데이트 완료', [
        { name: '신규 업데이트', value: `${updatedCount}개`, inline: true },
        { name: '처리/건너뜀', value: `${processedCount}/${skippedCount}개`, inline: true }
      ]);
    }

    return {
      success: true,
      message: `Processed ${processedCount} addresses, updated ${updatedCount} coordinates, skipped ${skippedCount}`,
      processed: processedCount,
      updated: updatedCount,
      skipped: skippedCount
    };
  }

  // POST /api/update-coordinates - 주소를 위도/경도로 변환
  router.post('/api/update-coordinates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const result = await updateStoreCoordinates();
      res.json(result);
    } catch (error) {
      console.error('❌ [좌표업데이트] Error updating coordinates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update coordinates',
        message: error.message
      });
    }
  });

  // POST /api/update-sales-coordinates - 판매점 좌표 업데이트
  router.post('/api/update-sales-coordinates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const result = await updateSalesCoordinates();
      res.json(result);
    } catch (error) {
      console.error('❌ [판매점좌표] Error updating sales coordinates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update sales coordinates',
        message: error.message
      });
    }
  });

  return {
    router,
    updateStoreCoordinates,
    updateSalesCoordinates
  };
}

module.exports = createCoordinateRoutes;
