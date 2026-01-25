/**
 * Sales By Store Routes
 * 매장별 판매 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createSalesByStoreRoutes(context) {
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

  // GET /api/sales-by-store/data - 매장별 판매 데이터
  router.get('/api/sales-by-store/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'sales_by_store_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('매장별판매');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching sales by store:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sales-by-store/update-agent - 대리점 업데이트
  router.post('/api/sales-by-store/update-agent', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { storeCode, agentCode } = req.body;

      console.log('매장별 판매 대리점 업데이트:', storeCode, agentCode);

      cacheManager.deletePattern('sales_by_store');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createSalesByStoreRoutes;
