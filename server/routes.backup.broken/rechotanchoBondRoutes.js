/**
 * Rechotancho Bond Routes
 * 레초탄초 채권 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createRechotanchoBondRoutes(context) {
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

  // GET /api/rechotancho-bond/all-data - 전체 데이터
  router.get('/api/rechotancho-bond/all-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'rechotancho_bond_all_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('레초탄초채권');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching rechotancho bond data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/rechotancho-bond/history - 이력
  router.get('/api/rechotancho-bond/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('레초탄초채권이력');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/rechotancho-bond/data/:timestamp - 특정 데이터
  router.get('/api/rechotancho-bond/data/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      const values = await getSheetValues('레초탄초채권');
      const data = values.slice(1).find(row => row[0] === timestamp);

      if (!data) {
        return res.status(404).json({ error: '데이터를 찾을 수 없습니다.' });
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/rechotancho-bond/save - 저장
  router.post('/api/rechotancho-bond/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '레초탄초채권!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('rechotancho_bond');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/rechotancho-bond/update/:timestamp - 수정
  router.put('/api/rechotancho-bond/update/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;
      const { data } = req.body;

      console.log('레초탄초 채권 수정:', timestamp, data);

      cacheManager.deletePattern('rechotancho_bond');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/rechotancho-bond/delete/:timestamp - 삭제
  router.delete('/api/rechotancho-bond/delete/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      console.log('레초탄초 채권 삭제:', timestamp);

      cacheManager.deletePattern('rechotancho_bond');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createRechotanchoBondRoutes;
