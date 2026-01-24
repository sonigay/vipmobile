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

  // GET /api/quick-cost/companies - 통신사 목록
  router.get('/api/quick-cost/companies', async (req, res) => {
    try {
      res.json(['SK', 'KT', 'LG']);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/quick-cost/phone-numbers - 전화번호 목록
  router.get('/api/quick-cost/phone-numbers', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('빠른견적전화번호');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/quick-cost/costs - 견적 목록
  router.get('/api/quick-cost/costs', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'quick_cost_costs';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('빠른견적목록');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/quick-cost/history - 견적 이력
  router.get('/api/quick-cost/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('빠른견적이력');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/quick-cost/statistics - 견적 통계
  router.get('/api/quick-cost/statistics', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('빠른견적통계');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/quick-cost/quality - 견적 품질
  router.get('/api/quick-cost/quality', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('빠른견적품질');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/quick-cost/save - 견적 저장
  router.post('/api/quick-cost/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '빠른견적!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('quick_cost');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/quick-cost/update - 견적 수정
  router.put('/api/quick-cost/update', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id, data } = req.body;

      console.log('견적 수정:', id, data);

      cacheManager.deletePattern('quick_cost');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/quick-cost/delete - 견적 삭제
  router.delete('/api/quick-cost/delete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      console.log('견적 삭제:', id);

      cacheManager.deletePattern('quick_cost');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/quick-cost/estimate - 견적 계산
  router.post('/api/quick-cost/estimate', async (req, res) => {
    try {
      const { model, plan, options } = req.body;

      // 견적 계산 로직
      const result = {
        model,
        plan,
        options,
        totalCost: 0,
        monthlyCost: 0,
        discount: 0
      };

      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/quick-cost/normalize - 견적 정규화
  router.post('/api/quick-cost/normalize', async (req, res) => {
    try {
      const { data } = req.body;

      // 정규화 로직
      console.log('견적 정규화:', data);

      res.json({ success: true, normalized: data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createQuickCostRoutes;
