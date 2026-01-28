/**
 * Subscriber Increase Routes
 * 가입자 증가 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createSubscriberIncreaseRoutes(context) {
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

  // GET /api/subscriber-increase/access - 접근 권한
  router.get('/api/subscriber-increase/access', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('가입자증감');
      res.json({
        success: true,
        hasAccess: values.length > 1
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/subscriber-increase/data - 데이터
  router.get('/api/subscriber-increase/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'subscriber_increase_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('가입자증감');
      const data = values.slice(1);

      const result = { success: true, data };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/save - 저장
  router.post('/api/subscriber-increase/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '가입자증감!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/bulk-save - 대량 저장
  router.post('/api/subscriber-increase/bulk-save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '가입자증감!A:Z',
          valueInputOption: 'RAW',
          resource: { values: data }
        })
      );

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true, count: data.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/subscriber-increase/delete - 삭제
  router.delete('/api/subscriber-increase/delete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      console.log('가입자증가 삭제:', id);

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/init-sheet - 시트 초기화
  router.post('/api/subscriber-increase/init-sheet', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('가입자증가 시트 초기화');

      // 시트 초기화 로직
      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/add-excluded-row - 제외 행 추가
  router.post('/api/subscriber-increase/add-excluded-row', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { rowData } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '가입자증감제외!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [rowData] }
        })
      );

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createSubscriberIncreaseRoutes;
