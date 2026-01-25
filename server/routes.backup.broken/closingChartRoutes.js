/**
 * Closing Chart Routes
 * 
 * 마감장표 관련 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/closing-chart - 마감장표 데이터 조회
 * - POST /api/closing-chart/targets - 목표 설정
 * - GET /api/closing-chart/mapping-failures - 매핑 실패 데이터 조회
 * - GET /api/closing-chart/agent-code-combinations - 담당자-코드 조합 추출
 */

const express = require('express');
const router = express.Router();

function createClosingChartRoutes(context) {
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

  router.get('/api/closing-chart', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { date } = req.query;
      
      const cacheKey = `closing_chart_${date}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('마감장표');
      const data = values.slice(1).filter(row => row[0] === date);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching closing chart:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/closing-chart/targets', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { targets } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '마감장표목표!A:Z',
          valueInputOption: 'RAW',
          resource: { values: targets }
        })
      );

      cacheManager.deletePattern('closing_chart');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving targets:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/closing-chart/mapping-failures', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { date } = req.query;

      const values = await getSheetValues('매핑실패');
      const data = values.slice(1).filter(row => row[0] === date);
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching mapping failures:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/closing-chart/agent-code-combinations', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { date } = req.query;

      const values = await getSheetValues('담당자코드조합');
      const data = values.slice(1).filter(row => row[0] === date);
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching agent code combinations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createClosingChartRoutes;
