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

  // 주소 전처리
  const cleanAddress = address.toString().trim();
  if (!cleanAddress) {
    return null;
  }

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

  // POST /api/update-coordinates - 주소를 위도/경도로 변환
  router.post('/api/update-coordinates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🗺️ [좌표업데이트] 좌표 업데이트 시작');

      const STORE_SHEET_NAME = '폰클출고처데이터';
      const storeValues = await getSheetValues(STORE_SHEET_NAME);
      
      if (!storeValues) {
        throw new Error('Failed to fetch data from store sheet');
      }

      // 헤더 제거
      const storeRows = storeValues.slice(1);
      const updates = [];

      for (let i = 0; i < storeRows.length; i++) {
        const row = storeRows[i];
        const address = row[11];  // L열: 주소
        const status = row[12];    // M열: 거래상태

        if (status === "사용") {
          if (!address || address.toString().trim() === '') {
            // 사용 상태이지만 주소가 없는 경우 좌표 삭제
            updates.push({
              range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
              values: [["", ""]]
            });
            continue;
          }

          // 주소가 있는 경우 geocoding 실행
          try {
            const result = await geocodeAddress(address);
            if (result) {
              const { latitude, longitude } = result;
              updates.push({
                range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
                values: [[latitude, longitude]]
              });
              console.log(`✅ [좌표업데이트] 성공: ${address} -> (${latitude}, ${longitude})`);
            }
          } catch (error) {
            console.error(`❌ [좌표업데이트] Geocoding 오류: ${address}`, error.message);
          }
        } else {
          // 미사용 매장은 위도/경도 값을 빈 값으로 비움
          updates.push({
            range: `${STORE_SHEET_NAME}!I${i + 2}:J${i + 2}`,
            values: [["", ""]]
          });
        }
        
        // API 할당량 제한을 피하기 위한 지연 (사용 매장만)
        if (status === "사용") await new Promise(resolve => setTimeout(resolve, 1000));
      }

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

      res.json({
        success: true,
        message: `Updated coordinates for ${updates.length} addresses`
      });
      
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

      console.log('🗺️ [판매점좌표] 판매점 좌표 업데이트 시작');

      // 새로운 구글 시트 ID 확인
      const SALES_SPREADSHEET_ID = process.env.SALES_SHEET_ID;
      if (!SALES_SPREADSHEET_ID) {
        throw new Error('SALES_SHEET_ID 환경변수가 설정되어 있지 않습니다.');
      }

      const SALES_SHEET_NAME = '판매점정보';
      const salesValues = await getSheetValues(SALES_SHEET_NAME, SALES_SPREADSHEET_ID);
      
      if (!salesValues) {
        throw new Error('Failed to fetch data from sales sheet');
      }

      // 헤더 제거 (2행부터 시작)
      const salesRows = salesValues.slice(1);
      let processedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < salesRows.length; i++) {
        const row = salesRows[i];
        const address = row[7];  // H열: 주소
        const existingLat = row[5]; // F열: 기존 위도
        const existingLng = row[6]; // G열: 기존 경도

        // 주소가 없거나 '주소확인필요'인 경우 건너뛰기
        if (!address || address.toString().trim() === '' || address.toString().trim() === '주소확인필요') {
          continue;
        }

        processedCount++;

        // 기존 좌표가 모두 존재하면 지오코딩 생략
        if (existingLat && existingLng) {
          skippedCount++;
          continue;
        }

        // 좌표가 없는 경우에만 지오코딩 실행
        try {
          console.log(`🗺️ [판매점좌표] 좌표 업데이트 시작: ${address}`);
          const result = await geocodeAddress(address);
          
          if (result) {
            const { latitude, longitude } = result;

            // 개별 업데이트 실행 (즉시 저장)
            await rateLimiter.execute(() =>
              sheetsClient.sheets.spreadsheets.values.update({
                spreadsheetId: SALES_SPREADSHEET_ID,
                range: `${SALES_SHEET_NAME}!F${i + 2}:G${i + 2}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                  values: [[latitude, longitude]]
                }
              })
            );

            updatedCount++;
            console.log(`✅ [판매점좌표] 좌표 업데이트 성공: ${address} -> (${latitude}, ${longitude})`);
          } else {
            console.log(`❌ [판매점좌표] Geocoding 결과 없음: ${address}`);
          }
        } catch (error) {
          console.error(`❌ [판매점좌표] Geocoding 오류: ${address}`, error.message);
        }

        // API 할당량 제한을 피하기 위한 지연 (0.2초)
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`📊 [판매점좌표] 주소 업데이트 완료 - 처리: ${processedCount}개, 업데이트: ${updatedCount}개, 건너뜀: ${skippedCount}개`);
      
      res.json({
        success: true,
        message: `Processed ${processedCount} addresses, updated ${updatedCount} coordinates, skipped ${skippedCount}`,
        processed: processedCount,
        updated: updatedCount,
        skipped: skippedCount
      });
      
    } catch (error) {
      console.error('❌ [판매점좌표] Error updating sales coordinates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update sales coordinates',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createCoordinateRoutes;
