/**
 * Miscellaneous Routes
 * 기타 API 엔드포인트 (price-discrepancies 등)
 */

module.exports = function createMiscRoutes(context) {
  const express = require('express');
  const router = express.Router();
  
  const { sheetsClient, rateLimiter, cacheManager } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // Helper functions
  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets) {
      res.status(503).json({ error: 'Google Sheets client not available' });
      return false;
    }
    return true;
  };

  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    return response.data.values || [];
  }

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
      console.log('비밀번호 변경 요청:', oldPassword ? '***' : 'none', '->', newPassword ? '***' : 'none');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 월간 시상 관련
  router.get('/api/monthly-award/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('월간시상데이터');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/monthly-award/settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('월간시상설정');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 재고 관련 추가
  router.get('/api/master-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('마스터재고');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/office-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('사무소재고');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/phonekl-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('폰클재고');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 중복 관련
  router.get('/api/phone-duplicates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('전화번호중복');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 권한 체크
  router.get('/api/check-general-policy-permission', async (req, res) => {
    try {
      const { userId } = req.query;
      console.log('일반 정책 권한 체크:', userId);
      // 권한 체크 로직
      res.json({ hasPermission: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/check-onsale-permission', async (req, res) => {
    try {
      const { userId } = req.query;
      console.log('온세일 권한 체크:', userId);
      // 권한 체크 로직
      res.json({ hasPermission: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 로그인
  router.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log('로그인 시도:', username);
      // 로그인 로직
      res.json({ success: true, token: 'dummy-token', username });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 활동 로그
  router.post('/api/log-activity', async (req, res) => {
    try {
      const { activity } = req.body;
      console.log('활동 로그:', activity);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 지오코딩
  router.post('/api/geocode-address', async (req, res) => {
    try {
      const { address } = req.body;
      console.log('주소 지오코딩:', address);
      // 지오코딩 로직
      res.json({ lat: 37.5665, lng: 126.9780, address });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 마커 색상 설정
  router.get('/api/marker-color-settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('마커색상설정');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 지도 표시 옵션
  router.get('/api/map-display-option', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('지도표시옵션');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/map-display-option/users', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('지도표시옵션사용자');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/map-display-option/values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('지도표시옵션값');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 매핑 실패 분석
  router.get('/api/mapping-failure-analysis', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('매핑실패분석');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 마지막 개통일
  router.get('/api/last-activation-date', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('마지막개통일');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/last-activation-date/clear-cache', async (req, res) => {
    try {
      cacheManager.deletePattern('last_activation');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 크롬 확장 프로그램
  router.get('/api/extension-version', (req, res) => {
    res.json({ version: '1.0.0' });
  });

  router.get('/api/download-chrome-extension', (req, res) => {
    res.json({ downloadUrl: '/extension/vip-extension.zip' });
  });

  // 알림 스트림
  router.get('/api/notifications/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({ type: 'connected', timestamp: Date.now() });

    const interval = setInterval(() => {
      sendEvent({ type: 'ping', timestamp: Date.now() });
    }, 30000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  router.put('/api/notifications/mark-all-read', async (req, res) => {
    try {
      const { userId } = req.body;
      console.log('모든 알림 읽음 처리:', userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
