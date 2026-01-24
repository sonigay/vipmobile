/**
 * Notification Routes
 * 알림 관련 API 엔드포인트
 */

module.exports = function createNotificationRoutes(context) {
  const express = require('express');
  const router = express.Router();
  
  const { sheetsClient, rateLimiter } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // 알림 목록 조회 API
  router.get('/notifications', async (req, res) => {
    try {
      const { user_id } = req.query;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id가 필요합니다.' });
      }

      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '알림!A:Z'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ notifications: [] });
      }

      const notifications = rows.slice(1)
        .filter(row => row[1] === user_id) // user_id 필터링
        .map((row, index) => ({
          id: row[0] || `NOTIF_${index}`,
          userId: row[1] || '',
          type: row[2] || '',
          title: row[3] || '',
          message: row[4] || '',
          isRead: row[5] === 'true' || row[5] === 'TRUE',
          createdAt: row[6] || '',
          link: row[7] || ''
        }));

      res.json({ notifications });
    } catch (error) {
      console.error('알림 목록 조회 실패:', error);
      res.status(500).json({ error: '알림 목록 조회 실패' });
    }
  });

  // 알림 읽음 처리 API
  router.put('/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      
      // 알림 시트에서 해당 ID 찾아서 읽음 처리
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '알림!A:Z'
        })
      );

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);
      
      if (rowIndex === -1) {
        return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
      }

      // 읽음 상태 업데이트 (F열 = 인덱스 5)
      await rateLimiter.execute(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `알림!F${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [['TRUE']] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
      res.status(500).json({ error: '알림 읽음 처리 실패' });
    }
  });

  return router;
};
