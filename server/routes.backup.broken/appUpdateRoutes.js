/**
 * App Update Routes
 * 앱 업데이트 관련 API 엔드포인트
 */

const express = require('express');

function createAppUpdateRoutes(context) {
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

  // GET /api/app-updates - 앱 업데이트 정보
  router.get('/app-updates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'app_updates';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      let values;
      try {
        values = await getSheetValues('어플업데이트');
      } catch (sheetError) {
        // 시트가 없으면 빈 배열 반환 (프론트엔드 형식에 맞춤)
        console.warn('어플업데이트 시트가 존재하지 않습니다:', sheetError.message);
        const emptyResult = { success: true, data: [] };
        cacheManager.set(cacheKey, emptyResult, 10 * 60 * 1000);
        return res.json(emptyResult);
      }

      if (!values || values.length === 0) {
        const emptyResult = { success: true, data: [] };
        cacheManager.set(cacheKey, emptyResult, 10 * 60 * 1000);
        return res.json(emptyResult);
      }

      // 헤더 제외하고 데이터 반환
      const data = values.slice(1);
      const result = { success: true, data };

      cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10분 캐시
      res.json(result);
    } catch (error) {
      console.error('Error fetching app updates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/app-updates - 앱 업데이트 정보 등록
  router.post('/app-updates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '어플업데이트!A:Z',
          valueInputOption: 'RAW',
          resource: {
            values: [data]
          }
        })
      );

      cacheManager.deletePattern('app_updates');
      res.json({ success: true });
    } catch (error) {
      console.error('Error creating app update:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createAppUpdateRoutes;
