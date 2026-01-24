/**
 * Cancel Check Routes
 * 취소 체크 관리 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createCancelCheckRoutes(context) {
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

  router.get('/api/cancel-check/list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'cancel_check_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('취소체크');
      const data = values.slice(1);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching cancel check list:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/cancel-check/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '취소체크!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('cancel_check');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving cancel check:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/api/cancel-check/delete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      // 삭제 로직 구현 필요
      console.log('Delete cancel check:', id);

      cacheManager.deletePattern('cancel_check');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting cancel check:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createCancelCheckRoutes;
