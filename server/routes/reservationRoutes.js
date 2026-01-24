/**
 * Reservation Routes
 * 
 * 예약 관리 관련 엔드포인트를 제공합니다.
 */

const express = require('express');
const router = express.Router();

function createReservationRoutes(context) {
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

  router.get('/api/reservation/list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'reservation_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('예약관리');
      const data = values.slice(1);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching reservation list:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/reservation/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '예약관리!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('reservation');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving reservation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createReservationRoutes;
