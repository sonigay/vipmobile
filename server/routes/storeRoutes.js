/**
 * Store Routes
 * 
 * 매장 정보와 재고 데이터를 제공하는 엔드포인트입니다.
 * 
 * Endpoints:
 * - GET /api/stores - 매장 목록 및 재고 정보 조회
 * 
 * Requirements: 1.1, 1.2, 7.6
 */

const express = require('express');
const router = express.Router();

/**
 * Store Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createStoreRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // 시트 이름 상수
  const INVENTORY_SHEET_NAME = '폰클재고데이터';
  const STORE_SHEET_NAME = '폰클출고처데이터';

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
  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A:AZ`
      })
    );

    return response.data.values || [];
  }

  // GET /api/stores - 매장 목록 및 재고 정보 조회
  router.get('/api/stores', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { includeShipped = 'true' } = req.query; // 쿼리 파라미터로 출고 제외 여부 제어
      const cacheKey = `processed_stores_data_${includeShipped}`;

      // 캐시에서 먼저 확인
      const cachedStores = cacheManager.get(cacheKey);
      if (cachedStores) {
        return res.json(cachedStores);
      }

      const [inventoryValues, storeValues] = await Promise.all([
        getSheetValues(INVENTORY_SHEET_NAME),
        getSheetValues(STORE_SHEET_NAME)
      ]);

      if (!inventoryValues || !storeValues) {
        throw new Error('Failed to fetch data from sheets');
      }

      // 디버깅: 헤더 및 데이터 샘플 로깅 (인덱스 확인용)
      if (storeValues.length > 0) {
        console.log('📋 [StoreRoutes] Store Header:', storeValues[0]);
        // console.log('📋 [StoreRoutes] First Row Sample:', storeValues[1]);
      }

      // 헤더 제거 (첫 3행은 제외)
      const inventoryRows = inventoryValues.slice(3);
      const storeRows = storeValues.slice(1);

      // 출고 제외 로직 (includeShipped가 'false'일 때만 적용)
      let threeDaysAgo = null;
      if (includeShipped === 'false') {
        const today = new Date();
        threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
      }

      // 매장별 재고 데이터 매핑
      const inventoryMap = {};
      let excludedCount = 0; // 제외된 재고 카운터

      inventoryRows.forEach((row) => {
        if (!row || row.length < 23) return; // 최소 O열까지 데이터가 있어야 함 (15+8)

        const storeName = (row[21] || '').toString().trim();  // N열: 매장명
        let cleanStoreName = storeName;

        // 모든 매장(사무실 포함)은 원래 이름 그대로 유지
        cleanStoreName = storeName;
        const model = (row[13] || '').toString().trim();      // F열: 모델
        const color = (row[14] || '').toString().trim();      // G열: 색상
        const status = (row[15] || '').toString().trim();     // H열: 상태
        const type = (row[12] || '').toString().trim();       // E열: 종류
        const shippingDate = row[22] ? new Date(row[22]) : null;  // O열: 출고일

        if (!storeName || !model || !color) return;

        // 출고일이 있고, 최근 3일 이내인 경우 재고에서 제외 (includeShipped가 'false'일 때만)
        if (includeShipped === 'false' && shippingDate && threeDaysAgo && shippingDate >= threeDaysAgo) {
          excludedCount++;
          return;
        }

        // 매장별 재고 데이터 구조 생성 (정리된 이름으로 매핑)
        if (!inventoryMap[cleanStoreName]) {
          inventoryMap[cleanStoreName] = {
            phones: {},    // 단말기
            sims: {},      // 유심
            wearables: {}, // 웨어러블
            smartDevices: {} // 스마트기기
          };
        }

        // 종류에 따라 분류
        let category = 'phones'; // 기본값
        if (type === '유심') {
          category = 'sims';
        } else if (type === '웨어러블') {
          category = 'wearables';
        } else if (type === '스마트기기') {
          category = 'smartDevices';
        }

        if (!inventoryMap[cleanStoreName][category][model]) {
          inventoryMap[cleanStoreName][category][model] = {};
        }

        // 상태별로 수량 관리
        if (!inventoryMap[cleanStoreName][category][model][status]) {
          inventoryMap[cleanStoreName][category][model][status] = {};
        }

        // 같은 모델/색상/상태 조합의 수량과 출고일 정보 관리
        if (!inventoryMap[cleanStoreName][category][model][status][color]) {
          inventoryMap[cleanStoreName][category][model][status][color] = {
            quantity: 1,
            shippedDate: shippingDate ? shippingDate.toISOString() : null
          };
        } else {
          inventoryMap[cleanStoreName][category][model][status][color].quantity++;
          // 출고일이 더 오래된 것으로 업데이트 (가장 오래된 재고 기준)
          if (shippingDate && (!inventoryMap[cleanStoreName][category][model][status][color].shippedDate ||
            shippingDate < new Date(inventoryMap[cleanStoreName][category][model][status][color].shippedDate))) {
            inventoryMap[cleanStoreName][category][model][status][color].shippedDate = shippingDate.toISOString();
          }
        }
      });

      // 매장 정보와 재고 정보 결합
      const stores = storeRows
        .filter(row => {
          const name = (row[14] || '').toString().trim();  // G열: 업체명 (실제 인덱스 14?) -> 로그 확인 후 보정 필요
          const status = row[12];                          // M열: 거래상태
          return name && status === "사용";
        })
        .map(row => {
          const latitude = parseFloat(row[8] || '0');    // I열: 위도 (8)
          const longitude = parseFloat(row[9] || '0');   // J열: 경도 (9)
          const name = row[14].toString().trim();        // G열: 업체명
          const storeId = row[15];                        // H열: 매장 ID
          const phone = row[17] || '';                    // R열: 연락처 (17)
          const storePhone = row[22] || '';               // W열: 매장연락처 (22)
          const manager = row[21] || '';                  // V열: 담당자 (21)
          const address = (row[11] || '').toString();    // L열: 주소 (11)

          // 빈 매장 ID 제외
          if (!storeId || storeId.toString().trim() === '') {
            return null;
          }

          const inventory = inventoryMap[name] || {};
          const vipStatus = (row[18] || '').toString().trim(); // S열: 구분 (18)
          const businessNumber = (row[28] || '').toString().trim(); // AC열: 사업자번호 (28)
          const managerName = (row[29] || '').toString().trim(); // AD열: 점장명 (29)
          const accountInfo = (row[35] || '').toString().trim(); // AJ열: 계좌정보 (35)

          // 코드/사무실/소속/담당자 정보 추가 (필터링용)
          const code = (row[7] || '').toString().trim();        // H열(7인덱스): 코드
          const office = (row[3] || '').toString().trim();      // D열(3인덱스): 사무실
          const department = (row[4] || '').toString().trim();  // E열(4인덱스): 소속
          const managerForFilter = (row[5] || '').toString().trim(); // F열(5인덱스): 담당자 (필터링용)

          return {
            id: storeId.toString(),
            name: name,
            address,
            phone,
            storePhone,
            manager, // 기존 담당자 필드 유지
            managerForFilter, // 필터용 담당자
            managerName, // 점장명 (AD열)
            businessNumber, // 사업자번호 (AC열)
            accountInfo, // 계좌정보 (AJ열)
            vipStatus,
            latitude,
            longitude,
            uniqueId: `${storeId}_${name}`,
            inventory: inventory,
            code,        // H열
            office,      // D열
            department   // E열
          };
        })
        .filter(store => store !== null); // null 값 제거

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, stores);

      res.json(stores);
    } catch (error) {
      console.error('Error fetching store data:', error);
      res.status(500).json({
        error: 'Failed to fetch store data',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createStoreRoutes;
