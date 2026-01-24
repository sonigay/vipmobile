/**
 * Miscellaneous Routes
 * 기타 API 엔드포인트 (price-discrepancies 등)
 */

module.exports = function createMiscRoutes(context) {
  const express = require('express');
  const router = express.Router();
  
  const { sheetsClient, rateLimiter } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // 가격 불일치 조회 API
  router.get('/price-discrepancies', async (req, res) => {
    try {
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '가격불일치!A:Z'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ discrepancies: [] });
      }

      const discrepancies = rows.slice(1).map((row, index) => ({
        id: row[0] || `DISC_${index}`,
        model: row[1] || '',
        carrier: row[2] || '',
        expectedPrice: parseInt(row[3]) || 0,
        actualPrice: parseInt(row[4]) || 0,
        difference: parseInt(row[5]) || 0,
        reportedBy: row[6] || '',
        reportedAt: row[7] || '',
        status: row[8] || 'pending'
      }));

      res.json({ discrepancies });
    } catch (error) {
      console.error('가격 불일치 조회 실패:', error);
      res.status(500).json({ error: '가격 불일치 조회 실패' });
    }
  });

  // 테스트 API
  router.get('/test', (req, res) => {
    console.log('🧪 [테스트] API 호출됨');
    res.json({ success: true, message: '테스트 API 작동 중' });
  });

  return router;
};

  // GET /api/stores - 매장 목록
  router.get('/api/stores', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'stores_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('매장목록');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stores/unique-values - 매장 고유값
  router.get('/api/stores/unique-values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('매장목록');
      const rows = values.slice(1);

      const uniqueValues = {
        stores: [...new Set(rows.map(r => r[0]))],
        regions: [...new Set(rows.map(r => r[1]))],
        types: [...new Set(rows.map(r => r[2]))]
      };

      res.json(uniqueValues);
    } catch (error) {
      console.error('Error fetching unique values:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/version - 버전 정보
  router.get('/api/version', (req, res) => {
    res.json({
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Push 알림 관련
  router.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  });

  router.post('/api/push/subscribe', async (req, res) => {
    try {
      const { subscription } = req.body;
      console.log('Push 구독:', subscription);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body;
      console.log('Push 구독 해제:', endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/push/send', async (req, res) => {
    try {
      const { title, message, userId } = req.body;
      console.log('Push 전송:', title, message, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/push/send-all', async (req, res) => {
    try {
      const { title, message } = req.body;
      console.log('Push 전체 전송:', title, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 기타 엔드포인트
  router.get('/api/sales-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('판매데이터');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/sim-duplicates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('유심중복');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/unmatched-customers', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('미매칭고객');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/verify-password', async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = password === process.env.ADMIN_PASSWORD;
      res.json({ success: isValid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/verify-direct-store-password', async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = password === process.env.DIRECT_STORE_PASSWORD;
      res.json({ success: isValid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/set-password', async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      // 비밀번호 변경 로직
      console.log('비밀번호 변경 요청');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createMiscRoutes;
