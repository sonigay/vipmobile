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
        // 시트가 없으면 기본값 반환
        console.warn('어플업데이트 시트가 존재하지 않습니다:', sheetError.message);
        const defaultResult = {
          hasUpdate: false,
          version: '1.0.0',
          message: '',
          forceUpdate: false
        };
        cacheManager.set(cacheKey, defaultResult, 10 * 60 * 1000);
        return res.json(defaultResult);
      }

      if (!values || values.length === 0) {
        return res.json({
          hasUpdate: false,
          version: '1.0.0',
          message: '',
          forceUpdate: false
        });
      }

      const rows = values.slice(1);
      const latestUpdate = rows[0] || [];

      const updateInfo = {
        hasUpdate: latestUpdate[0] === 'TRUE' || latestUpdate[0] === true,
        version: latestUpdate[1] || '1.0.0',
        message: latestUpdate[2] || '',
        forceUpdate: latestUpdate[3] === 'TRUE' || latestUpdate[3] === true,
        releaseDate: latestUpdate[4] || new Date().toISOString()
      };

      cacheManager.set(cacheKey, updateInfo, 10 * 60 * 1000); // 10분 캐시
      res.json(updateInfo);
    } catch (error) {
      console.error('Error fetching app updates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/app-updates - 앱 업데이트 정보 등록
  router.post('/app-updates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const { version, message, forceUpdate } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '어플업데이트!A:Z',
          valueInputOption: 'RAW',
          resource: {
            values: [[true, version, message, forceUpdate, new Date().toISOString()]]
          }
        })
      );

      cacheManager.deletePattern('app_updates');
      res.json({ success: true });
    } catch (error) {
      console.error('Error creating app update:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createAppUpdateRoutes;
