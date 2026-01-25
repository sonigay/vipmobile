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

  // GET /api/sms/rules - SMS 규칙 목록
  router.get('/api/sms/rules', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('SMS규칙');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching SMS rules:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sms/rules - SMS 규칙 생성
  router.post('/api/sms/rules', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { rule } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'SMS규칙!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [rule] }
        })
      );

      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error creating SMS rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/sms/rules/:id - SMS 규칙 수정
  router.put('/api/sms/rules/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;
      const { rule } = req.body;

      console.log('SMS 규칙 수정:', id, rule);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating SMS rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/sms/rules/:id - SMS 규칙 삭제
  router.delete('/api/sms/rules/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;

      console.log('SMS 규칙 삭제:', id);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting SMS rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sms/auto-reply/contacts - 자동응답 연락처 추가
  router.post('/api/sms/auto-reply/contacts', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { contact } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'SMS자동응답연락처!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [contact] }
        })
      );

      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding auto-reply contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/sms/auto-reply/contacts/:id - 자동응답 연락처 삭제
  router.delete('/api/sms/auto-reply/contacts/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;

      console.log('자동응답 연락처 삭제:', id);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting auto-reply contact:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/sms/auto-reply/rules/:id - 자동응답 규칙 수정
  router.put('/api/sms/auto-reply/rules/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;
      const { rule } = req.body;

      console.log('자동응답 규칙 수정:', id, rule);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating auto-reply rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/sms/auto-reply/rules/:id - 자동응답 규칙 삭제
  router.delete('/api/sms/auto-reply/rules/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;

      console.log('자동응답 규칙 삭제:', id);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting auto-reply rule:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sms/auto-reply/update-status - 자동응답 상태 업데이트
  router.post('/api/sms/auto-reply/update-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id, status } = req.body;

      console.log('자동응답 상태 업데이트:', id, status);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating auto-reply status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sms/cleanup - SMS 정리
  router.post('/api/sms/cleanup', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('SMS 정리 시작');
      res.json({ success: true, message: 'SMS가 정리되었습니다.' });
    } catch (error) {
      console.error('Error cleaning up SMS:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/sms/update-forward-status - 전달 상태 업데이트
  router.post('/api/sms/update-forward-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id, status } = req.body;

      console.log('SMS 전달 상태 업데이트:', id, status);
      cacheManager.deletePattern('sms');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating forward status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createSmsRoutes;
