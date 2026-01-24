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

  // SMS 자동응답 관련 엔드포인트
  router.get('/api/sms/auto-reply/rules', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS자동응답규칙');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/sms/auto-reply/rules', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'SMS자동응답규칙!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sms/auto-reply/pending', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS자동응답대기');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sms/auto-reply/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS자동응답이력');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sms/auto-reply/contacts', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS연락처');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sms/received', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS수신');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sms/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS이력');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sms/stats', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('SMS통계');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/sms/forward', async (req, res) => {
    try {
      const { to, message } = req.body;
      console.log('SMS 전달:', to, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/sms/register', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { phoneNumber } = req.body;
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'SMS등록!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [[phoneNumber, new Date().toISOString()]] }
        })
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createSmsRoutes;
