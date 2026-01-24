/**
 * Model Routes
 * 
 * 재고 데이터에서 모델과 색상 정보를 추출하여 제공하는 엔드포인트입니다.
 * 
 * Endpoints:
 * - GET /api/models - 모델별 색상 목록 조회
 * - GET /api/operation-models - 운영 모델 목록 조회
 * - GET /api/model-normalization - 모델 정규화 데이터 조회
 * 
 * Requirements: 1.1, 1.2, 7.10
 */

const express = require('express');

/**
 * Model Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createModelRoutes(context) {
  const router = express.Router();
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // 시트 이름 상수
  const INVENTORY_SHEET_NAME = '폰클재고데이터';

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
        range: `${sheetName}!A:Z`
      })
    );
    
    return response.data.values || [];
  }

  // GET /api/models - 모델별 색상 목록 조회
  router.get('/api/models', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'processed_models_data';

      // 캐시에서 먼저 확인
      const cachedModels = cacheManager.get(cacheKey);
      if (cachedModels) {
        return res.json(cachedModels);
      }

      const inventoryValues = await getSheetValues(INVENTORY_SHEET_NAME);

      if (!inventoryValues) {
        throw new Error('Failed to fetch data from inventory sheet');
      }

      // 헤더 제거 (첫 3행은 제외)
      const inventoryRows = inventoryValues.slice(3);

      // 모델과 색상 데이터 추출
      const modelColorMap = {};

      inventoryRows.forEach(row => {
        if (row.length < 16) return;

        const model = (row[13] || '').toString().trim();    // F열: 모델 (5+8)
        const color = (row[14] || '').toString().trim();    // G열: 색상 (6+8)
        const status = (row[15] || '').toString().trim();   // H열: 상태 (7+8)

        if (!model || !color) return;

        // 상태가 '정상'인 것만 포함 (필터링)
        if (status !== '정상') return;

        if (!modelColorMap[model]) {
          modelColorMap[model] = new Set();
        }
        modelColorMap[model].add(color);
      });

      // Set을 배열로 변환
      const result = Object.entries(modelColorMap).reduce((acc, [model, colors]) => {
        acc[model] = Array.from(colors).sort();
        return acc;
      }, {});

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, result);

      res.json(result);
    } catch (error) {
      console.error('Error fetching model and color data:', error);
      res.status(500).json({
        error: 'Failed to fetch model and color data',
        message: error.message
      });
    }
  });

  // GET /api/operation-models - 운영 모델
  router.get('/api/operation-models', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'operation_models';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('운영모델');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/model-normalization - 모델 정규화
  router.get('/api/model-normalization', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('모델정규화');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createModelRoutes;
