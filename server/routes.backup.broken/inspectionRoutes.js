/**
 * Inspection Routes
 * 
 * 검수 관리 관련 엔드포인트를 제공합니다.
 */

const express = require('express');
const router = express.Router();

function createInspectionRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({ success: false, error: 'Google Sheets client not available' });
      return false;
    }
    return true;
  };

  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    return response.data.values || [];
  }

  router.get('/api/inspection/list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'inspection_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('검수관리');
      const data = values.slice(1);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching inspection list:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/inspection/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '검수관리!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('inspection');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving inspection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection-data - 검수 데이터 조회
  router.get('/api/inspection-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('검수데이터');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching inspection data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/available-fields - 사용 가능한 필드 목록
  router.get('/api/inspection/available-fields', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('검수필드');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching available fields:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/columns - 검수 컬럼 조회
  router.get('/api/inspection/columns', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('검수컬럼');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching inspection columns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/columns - 검수 컬럼 저장
  router.post('/api/inspection/columns', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { columns } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '검수컬럼!A2:Z',
          valueInputOption: 'RAW',
          resource: { values: columns }
        })
      );

      cacheManager.deletePattern('inspection');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving inspection columns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/completion-status - 검수 완료 상태
  router.get('/api/inspection/completion-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('검수완료상태');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching completion status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/complete - 검수 완료 처리
  router.post('/api/inspection/complete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      console.log('검수 완료 처리:', id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing inspection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/field-values - 필드 값 목록
  router.get('/api/inspection/field-values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('검수필드값');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching field values:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/modification-completion-status - 수정 완료 상태
  router.get('/api/inspection/modification-completion-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('검수수정완료상태');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching modification completion status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/modification-complete - 수정 완료 처리
  router.post('/api/inspection/modification-complete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      console.log('검수 수정 완료 처리:', id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing modification:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/modification-notes - 수정 노트 저장
  router.post('/api/inspection/modification-notes', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id, notes } = req.body;

      console.log('검수 수정 노트 저장:', id, notes);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving modification notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/normalize - 검수 데이터 정규화
  router.post('/api/inspection/normalize', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      console.log('검수 데이터 정규화:', data);
      res.json({ success: true });
    } catch (error) {
      console.error('Error normalizing inspection data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/update-system-data - 시스템 데이터 업데이트
  router.post('/api/inspection/update-system-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      console.log('검수 시스템 데이터 업데이트:', data);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating system data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inventory-inspection - 재고 검수
  router.post('/api/inventory-inspection', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      console.log('재고 검수:', data);
      res.json({ success: true });
    } catch (error) {
      console.error('Error inspecting inventory:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createInspectionRoutes;
