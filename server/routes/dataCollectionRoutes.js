/**
 * Data Collection Routes
 * 데이터 수집 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createDataCollectionRoutes(context) {
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

  router.get('/api/data-collection-updates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'data_collection_updates';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('데이터수집업데이트');
      const data = values.slice(1);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching data collection updates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/data-collection-updates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '데이터수집업데이트!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('data_collection');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving data collection update:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createDataCollectionRoutes;
