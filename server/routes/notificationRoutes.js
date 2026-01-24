/**
 * Notification Routes
 * 알림 관련 API 엔드포인트
 */

const express = require('express');

function createNotificationRoutes(context) {
  const router = express.Router();
  const { sheetsClient, rateLimiter, cacheManager } = context;

  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets) {
      res.status(503).json({ error: 'Google Sheets client not available' });
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

  // GET /api/notifications - 알림 목록
  router.get('/notifications', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const { user_id } = req.query;
      const cacheKey = `notifications_${user_id}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      let values;
      try {
        values = await getSheetValues('알림');
      } catch (sheetError) {
        // 시트가 없으면 빈 배열 반환
        console.warn('알림 시트가 존재하지 않습니다:', sheetError.message);
        const emptyResult = { notifications: [] };
        cacheManager.set(cacheKey, emptyResult, 1 * 60 * 1000);
        return res.json(emptyResult);
      }

      const rows = values.slice(1);

      // user_id로 필터링
      const notifications = rows
        .filter(row => !user_id || row[1] === user_id)
        .map((row, index) => ({
          id: row[0] || `notif_${index}`,
          userId: row[1] || '',
          message: row[2] || '',
          type: row[3] || 'info',
          is_read: row[4] === 'TRUE' || row[4] === true,
          createdAt: row[5] || new Date().toISOString()
        }));

      const result = { notifications };
      cacheManager.set(cacheKey, result, 1 * 60 * 1000); // 1분 캐시
      res.json(result);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/notifications/stream - SSE 스트림
  router.get('/notifications/stream', (req, res) => {
    const { user_id } = req.query;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 초기 연결 메시지
    res.write(`data: ${JSON.stringify({ type: 'connected', userId: user_id })}\n\n`);

    // Keep-alive 핑 (30초마다)
    const pingInterval = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 30000);

    // 연결 종료 처리
    req.on('close', () => {
      clearInterval(pingInterval);
      console.log(`SSE connection closed for user: ${user_id}`);
    });
  });

  // PUT /api/notifications/mark-all-read - 모두 읽음 처리
  router.put('/notifications/mark-all-read', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const { userId } = req.body;
      console.log('Mark all read for user:', userId);

      // 캐시 무효화
      cacheManager.deletePattern(`notifications_${userId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createNotificationRoutes;
