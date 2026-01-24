/**
 * App Update Routes
 * 앱 업데이트 관련 API 엔드포인트
 */

module.exports = function createAppUpdateRoutes(context) {
  const express = require('express');
  const router = express.Router();
  
  const { sheetsClient, rateLimiter } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // 앱 업데이트 정보 조회 API
  router.get('/app-updates', async (req, res) => {
    try {
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '앱업데이트!A:Z'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ updates: [] });
      }

      const updates = rows.slice(1).map((row, index) => ({
        id: row[0] || `UPDATE_${index}`,
        version: row[1] || '',
        title: row[2] || '',
        description: row[3] || '',
        releaseDate: row[4] || '',
        isRequired: row[5] === 'true' || row[5] === 'TRUE',
        downloadUrl: row[6] || '',
        platform: row[7] || 'all' // web, android, ios, all
      }));

      res.json({ updates });
    } catch (error) {
      console.error('앱 업데이트 정보 조회 실패:', error);
      res.status(500).json({ error: '앱 업데이트 정보 조회 실패' });
    }
  });

  // 최신 업데이트 정보 조회 API
  router.get('/app-updates/latest', async (req, res) => {
    try {
      const { platform = 'web' } = req.query;
      
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '앱업데이트!A:Z'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ update: null });
      }

      const updates = rows.slice(1)
        .filter(row => row[7] === platform || row[7] === 'all')
        .map((row, index) => ({
          id: row[0] || `UPDATE_${index}`,
          version: row[1] || '',
          title: row[2] || '',
          description: row[3] || '',
          releaseDate: row[4] || '',
          isRequired: row[5] === 'true' || row[5] === 'TRUE',
          downloadUrl: row[6] || '',
          platform: row[7] || 'all'
        }))
        .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

      const latestUpdate = updates[0] || null;
      res.json({ update: latestUpdate });
    } catch (error) {
      console.error('최신 업데이트 정보 조회 실패:', error);
      res.status(500).json({ error: '최신 업데이트 정보 조회 실패' });
    }
  });

  return router;
};
