/**
 * Rechotancho Bond Routes
 * 레초탄초 채권 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createRechotanchoBondRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({ success: false, error: 'Google Sheets client not available' });
      return false;
    }
    return true;
  };

  async function getSheetValues(sheetName) {
    try {
      if (!sheetsClient || !sheetsClient.sheets) {
        console.warn(`[RechotanchoBond] Sheets client not available for ${sheetName}`);
        return [];
      }

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!A:Z`
        })
      );
      return response.data.values || [];
    } catch (error) {
      console.warn(`[RechotanchoBond] Failed to load sheet '${sheetName}': ${error.message}`);
      return []; // Return empty array to prevent 500 errors
    }
  }

  // GET /api/rechotancho-bond/all-data - 전체 데이터
  router.get('/api/rechotancho-bond/all-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'jaecho_damcho_bond_all_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('재초담초채권');
      const data = values.slice(1);

      const result = { success: true, data };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching rechotancho bond data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rechotancho-bond/history - 이력
  router.get('/api/rechotancho-bond/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('재초담초채권_내역');
      res.json({ success: true, data: values.slice(1) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rechotancho-bond/data/:timestamp - 특정 데이터
  router.get('/api/rechotancho-bond/data/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      const [allDataValues, mappingValues] = await Promise.all([
        getSheetValues('재초담초채권'),
        getSheetValues('재초담초채권_매핑') // 매핑 정보가 필요할 수 있음
      ]);

      const rawRow = allDataValues.slice(1).find(row => row[0] === timestamp);
      if (!rawRow) {
        return res.status(404).json({ success: false, error: '데이터를 찾을 수 없습니다.' });
      }

      // 프론트엔드 기대 형식으로 변환 (데이터 파싱 로직 필요)
      // 폰클재고데이터 기반으로 에이전트별 데이터 구성
      let parsedData = [];
      try {
        // 시트 저장 형식: [timestamp, agent1_inv, agent1_col, agent1_mgmt, agent2_inv, ...]
        // 혹은 JSON 문자열일 수 있음. 여기서는 프론트엔드에서 보낸 형식을 그대로 로드한다고 가정
        if (rawRow[2] && rawRow[2].startsWith('[')) {
          parsedData = JSON.parse(rawRow[2]);
        } else {
          // 컬럼별 매칭 (구버전 대응)
          parsedData = rawRow.slice(2).map((val, idx) => ({ value: val }));
        }
      } catch (e) {
        console.warn('Data parse error:', e);
      }

      res.json({ success: true, data: parsedData });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rechotancho-bond/save - 저장
  router.post('/api/rechotancho-bond/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '재초담초채권!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/rechotancho-bond/update/:timestamp - 수정
  router.put('/api/rechotancho-bond/update/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;
      const { data } = req.body;

      console.log('레초탄초 채권 수정:', timestamp, data);

      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/rechotancho-bond/delete/:timestamp - 삭제
  router.delete('/api/rechotancho-bond/delete/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      console.log('레초탄초 채권 삭제:', timestamp);

      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createRechotanchoBondRoutes;
