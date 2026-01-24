/**
 * Quick Cost Routes
 * 빠른 견적 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createQuickCostRoutes(context) {
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

  router.get('/api/quick-cost/models', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'quick_cost_models';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('빠른견적모델');
      const data = values.slice(1);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching quick cost models:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/quick-cost/calculate', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { model, plan, options } = req.body;

      // 견적 계산 로직
      const result = {
        model,
        plan,
        options,
        totalCost: 0,
        monthlyCost: 0
      };

      res.json({ success: true, result });
    } catch (error) {
      console.error('Error calculating quick cost:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createQuickCostRoutes;
