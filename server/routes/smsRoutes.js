/**
 * SMS Routes
 * 
 * SMS 관리 관련 엔드포인트를 제공합니다.
 */

const express = require('express');
const router = express.Router();

function createSmsRoutes(context) {
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

  router.get('/api/sms/list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'sms_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('SMS관리');
      const data = values.slice(1);
      
      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching SMS list:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/sms/send', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { to, message } = req.body;

      // SMS 전송 로직 (실제 구현 필요)
      console.log(`SMS 전송: ${to} - ${message}`);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'SMS관리!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [[new Date().toISOString(), to, message, 'sent']] }
        })
      );

      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending SMS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createSmsRoutes;
