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

  // 예약 설정 관련
  router.get('/api/reservation-settings/list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약설정목록');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation-settings/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약설정데이터');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/reservation-settings/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '예약설정!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );
      cacheManager.deletePattern('reservation');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 예약 판매 관련
  router.get('/api/reservation-sales/all-customers', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약판매전체고객');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation-sales/model-color', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약판매모델색상');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation-sales/customer-list/by-agent/:agentName', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { agentName } = req.params;
      const values = await getSheetValues('예약판매전체고객');
      const filtered = values.slice(1).filter(row => row[0] === agentName);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 예약 배정 관련
  router.get('/api/reservation/assignment-memory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약배정메모리');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/reservation/save-assignment-memory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '예약배정메모리!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );
      cacheManager.deletePattern('reservation');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation/assignment-changes', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약배정변경이력');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 예약 데이터 관련
  router.get('/api/reservation-data/reservation-site', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약사이트');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation-data/on-sale-receipt', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('온세일접수');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation-data/yard-receipt', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('야드접수');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/reservation-inventory-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('예약재고현황');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createReservationRoutes;
