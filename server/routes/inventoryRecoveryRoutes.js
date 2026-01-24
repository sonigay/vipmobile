/**
 * Inventory Recovery Routes
 * 
 * 재고 회수 모드 접근 권한 확인 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/inventoryRecoveryAccess - 재고 회수 모드 접근 권한 확인
 * 
 * Requirements: 1.1, 1.2, 7.9
 */

const express = require('express');
const router = express.Router();

/**
 * Inventory Recovery Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createInventoryRecoveryRoutes(context) {
  const { sheetsClient, rateLimiter } = context;

  // 시트 이름 상수
  const AGENT_SHEET_NAME = '대리점아이디관리';

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

  // GET /api/inventoryRecoveryAccess - 재고 회수 모드 접근 권한 확인
  router.get('/api/inventoryRecoveryAccess', async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    try {
      if (!requireSheetsClient(res)) return;

      // 대리점아이디관리 시트에서 V열 권한 확인
      const agentResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${AGENT_SHEET_NAME}!A:V`
        })
      );

      if (!agentResponse.data.values || agentResponse.data.values.length === 0) {
        throw new Error('Failed to fetch agent data');
      }

      // 헤더 제거
      const agentRows = agentResponse.data.values.slice(1);

      // V열에서 재고회수모드 권한이 있는 대리점 찾기
      const authorizedAgents = agentRows
        .filter(row => row && row.length > 21 && row[21] === 'O') // V열 (21번 인덱스)
        .map(row => ({
          agentCode: row[0] || '', // A열: 대리점코드
          agentName: row[1] || '', // B열: 대리점명
          accessLevel: row[21] || '' // V열: 재고회수모드 접근권한
        }));

      res.json({
        success: true,
        hasAccess: authorizedAgents.length > 0,
        authorizedAgents,
        totalAgents: agentRows.length,
        authorizedCount: authorizedAgents.length
      });
    } catch (error) {
      console.error('Error checking inventory recovery mode access:', error);
      res.status(500).json({
        success: false,
        hasAccess: false,
        error: 'Failed to check inventory recovery mode access',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createInventoryRecoveryRoutes;

  // GET /api/inventory-recovery/data - 재고회수 데이터
  router.get('/api/inventory-recovery/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'inventory_recovery_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('재고회수데이터');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching inventory recovery data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inventory-recovery/priority-models - 우선순위 모델
  router.get('/api/inventory-recovery/priority-models', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'inventory_recovery_priority_models';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('우선순위모델');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching priority models:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inventory-recovery/update-status - 회수 상태 업데이트
  router.post('/api/inventory-recovery/update-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { serialNumber, status } = req.body;

      // 상태 업데이트 로직
      console.log('Update recovery status:', serialNumber, status);

      cacheManager.deletePattern('inventory_recovery');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating recovery status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inventoryRecoveryAccess - 재고회수 접근 권한
  router.get('/api/inventoryRecoveryAccess', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'inventory_recovery_access';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('재고회수접근권한');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching recovery access:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createInventoryRecoveryRoutes;
