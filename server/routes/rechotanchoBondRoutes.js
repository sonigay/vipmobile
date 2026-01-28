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

  // GET /api/rechotancho-bond/all-data - 전체 데이터 (현재 상태)
  router.get('/api/rechotancho-bond/all-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'jaecho_damcho_bond_all_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      // 현재 상태는 '재초담초채권' 시트에서 조회 (개별 에이전트 데이터)
      const values = await getSheetValues('재초담초채권');
      const data = values.slice(1);

      // 데이터 가공 (필요 시)
      const processedData = data.map(row => ({
        agentCode: row[0], // 예시 매핑
        agentName: row[1],
        inventoryBond: Number(row[2]) || 0,
        collateralBond: Number(row[3]) || 0,
        managementBond: Number(row[4]) || 0,
        timestamp: row[5] // 만약 타임스탬프가 있다면
      }));

      const result = { success: true, data: processedData };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching rechotancho bond data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rechotancho-bond/history - 저장 시점 목록 조회
  router.get('/api/rechotancho-bond/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      // 재초담초채권_내역 시트에서 A:G 범위 조회
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '재초담초채권_내역!A:G'
        })
      );

      const rows = response.data.values || [];

      if (rows.length <= 1) {
        return res.json({ success: true, data: [] });
      }

      // 헤더 제외하고 데이터 행만 처리
      const dataRows = rows.slice(1);

      // 저장 시점별로 그룹화 (중복 제거)
      const timestampMap = new Map();

      dataRows.forEach(row => {
        const timestamp = row[0];
        const inputUser = row[6] || ''; // G열 사용자

        if (timestamp && !timestampMap.has(timestamp)) {
          timestampMap.set(timestamp, {
            timestamp,
            inputUser: inputUser || '미상'
          });
        }
      });

      // 최신순으로 정렬
      const history = Array.from(timestampMap.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      console.log(`✅ 재초담초채권 저장 시점 조회 완료: ${history.length}개`);

      res.json({ success: true, data: history });
    } catch (error) {
      console.error('❌ 재초담초채권 저장 시점 조회 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rechotancho-bond/data/:timestamp - 특정 시점 데이터
  router.get('/api/rechotancho-bond/data/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      console.log(`🔍 [Rechotancho] Fetching data for timestamp: "${timestamp}"`);

      // 내역 시트에서 조회해야 함
      const values = await getSheetValues('재초담초채권_내역');

      // Timestamp(A열) 매칭. 헤더 제외
      // EXACT MATCH가 안될 수도 있으므로 공백 제거 후 비교
      const targetTimestamp = decodeURIComponent(timestamp).trim();
      const targetDateVal = new Date(targetTimestamp).getTime();

      if (values.length > 1) {
        console.log(`   First 3 row timestamps in sheet:`, values.slice(1, 4).map(r => `"${r[0]}"`));
      }

      const rawRow = values.slice(1).find(row => {
        const rowTimestampStr = (row[0] || '').toString().trim();
        // 1. 단순 문자열 비교
        if (rowTimestampStr === targetTimestamp) return true;

        // 2. Date 객체 변환 후 시간 비교
        const rowDateVal = new Date(rowTimestampStr).getTime();
        // 1초 이내 오차 허용
        if (!isNaN(rowDateVal) && !isNaN(targetDateVal) && Math.abs(rowDateVal - targetDateVal) < 1000) {
          console.log(`   Match found via Date comparison: "${rowTimestampStr}" ~= "${targetTimestamp}"`);
          return true;
        }
        return false;
      });

      if (!rawRow) {
        console.warn(`⚠️ [Rechotancho] Data not found for timestamp: "${targetTimestamp}". Total rows checked: ${values.length - 1}`);
        return res.status(404).json({ success: false, error: '데이터를 찾을 수 없습니다.' });
      }

      console.log(`✅ [Rechotancho] Row found. Processing data...`);

      let parsedData = [];
      try {
        // C열(Index 2)에 JSON 데이터가 있다고 가정 (저장 로직과 일치)
        const jsonData = rawRow[2];
        if (jsonData && (jsonData.trim().startsWith('[') || jsonData.trim().startsWith('{'))) {
          parsedData = JSON.parse(rawRow[2]);
        } else {
          // JSON 형식이 아닐 경우 레거시 파싱 시도 (컬럼 매핑 등)
          // 여기서는 빈 배열 반환하여 오류 방지
          console.warn('JSON parsing failed or invalid format in Column C', rawRow[2]);
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
      const { data, inputUser } = req.body;
      const timestamp = new Date().toISOString();

      // 저장 포맷: [Timestamp, "", JSON_Data, "", "", "", User]
      // A: Timestamp, C: JSON(data), G: User. B, D, E, F는 빈 값 (또는 필요한 메타데이터)
      // data는 배열(InputData) --> JSON String
      const row = [
        timestamp,
        "",
        JSON.stringify(data),
        "",
        "",
        "",
        inputUser || 'Unknown'
      ];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '재초담초채권_내역!A:G', // 내역 시트에 추가
          valueInputOption: 'RAW',
          resource: { values: [row] }
        })
      );

      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      console.error('Save error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/rechotancho-bond/update/:timestamp - 수정
  router.put('/api/rechotancho-bond/update/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;
      const { data, inputUser } = req.body;

      // 행 찾기
      const values = await getSheetValues('재초담초채권_내역');
      // 헤더 포함 인덱스 찾기
      const rowIndex = values.findIndex(row => row[0] === timestamp);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '수정할 데이터를 찾을 수 없습니다.' });
      }

      // 1-based index
      const range = `재초담초채권_내역!C${rowIndex + 1}:G${rowIndex + 1}`;

      // C열 update (JSON), G열 update (User)
      // C, D, E, F, G (5칸)
      const updateRow = [JSON.stringify(data), "", "", "", inputUser || 'Modified'];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: range,
          valueInputOption: 'RAW',
          resource: { values: [updateRow] }
        })
      );

      console.log('레초탄초 채권 수정 완료:', timestamp);
      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/rechotancho-bond/delete/:timestamp - 삭제
  router.delete('/api/rechotancho-bond/delete/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      // 행 찾기 (Sheet ID 필요)
      // Spreadsheet 메타데이터 조회하여 Sheet ID 찾기
      const meta = await sheetsClient.sheets.spreadsheets.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID
      });

      const sheet = meta.data.sheets.find(s => s.properties.title === '재초담초채권_내역');
      if (!sheet) {
        return res.status(500).json({ success: false, error: '재초담초채권_내역 시트를 찾을 수 없습니다.' });
      }
      const sheetId = sheet.properties.sheetId;

      const values = await getSheetValues('재초담초채권_내역');
      const rowIndex = values.findIndex(row => row[0] === timestamp);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '삭제할 데이터를 찾을 수 없습니다.' });
      }

      // 행 삭제 Request
      const requests = [{
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }];

      await sheetsClient.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        resource: { requests }
      });

      console.log('레초탄초 채권 삭제 완료:', timestamp);
      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createRechotanchoBondRoutes;
