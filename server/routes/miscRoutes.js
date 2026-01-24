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
