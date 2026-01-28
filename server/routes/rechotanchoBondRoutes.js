/**
 * Rechotancho Bond Routes
 * 재초담초채권 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createRechotanchoBondRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      console.error('[RechotanchoBond] sheetsClient is undefined');
      res.status(503).json({ success: false, error: 'Google Sheets client not available' });
      return false;
    }
    if (!sheetsClient.sheets) {
      console.error('[RechotanchoBond] sheetsClient.sheets is undefined');
      res.status(503).json({ success: false, error: 'Google Sheets API not initialized' });
      return false;
    }
    return true;
  };

  // 공통 시트 데이터 조회 함수
  async function getSheetValues(sheetName) {
    try {
      if (!sheetsClient || !sheetsClient.sheets) {
        console.warn(`[RechotanchoBond] Sheets client not available for ${sheetName}`);
        return [];
      }

      // range 포맷 확인 (사용자 피드백: 데이터는 G열까지 있음)
      const range = `${sheetName}!A:G`;
      console.log(`[RechotanchoBond] Requesting range: ${range}`);

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: range
        })
      );
      return response.data.values || [];
    } catch (error) {
      console.warn(`[RechotanchoBond] Failed to load sheet '${sheetName}': ${error.message}`);
      return [];
    }
  }

  // GET /api/rechotancho-bond/all-data - 전체 데이터 (현재 상태 - 가장 최신 시점 데이터)
  router.get('/api/rechotancho-bond/all-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'jaecho_damcho_bond_all_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const sheetName = '재초담초채권_내역';
      const rows = await getSheetValues(sheetName);

      if (!rows || rows.length <= 1) {
        return res.json({ success: true, data: [] });
      }

      // 1. 모든 데이터에서 최신 타임스탬프 찾기
      // 헤더 제외
      const dataRows = rows.slice(1);

      let latestTimestamp = null;
      let latestDate = 0;

      dataRows.forEach(row => {
        const timestamp = row[0];
        if (timestamp) {
          const dateVal = new Date(timestamp).getTime();
          if (!isNaN(dateVal) && dateVal > latestDate) {
            latestDate = dateVal;
            latestTimestamp = timestamp;
          }
        }
      });

      if (!latestTimestamp) {
        return res.json({ success: true, data: [] });
      }

      console.log(`[RechotanchoBond] Latest timestamp found: ${latestTimestamp}`);

      // 2. 최신 타임스탬프에 해당하는 행들만 필터링
      const targetDataRows = dataRows.filter(row => row[0] === latestTimestamp);

      // 3. 데이터 매핑 (레거시 구조: A=Timestamp, B=AgentCode, C=AgentName, D=Inv, E=Col, F=Mgmt, G=User)
      const processedData = targetDataRows.map(row => ({
        timestamp: row[0] || '',
        agentCode: row[1] || '',
        agentName: row[2] || '',
        inventoryBond: Number(row[3]) || 0,
        collateralBond: Number(row[4]) || 0,
        managementBond: Number(row[5]) || 0,
        inputUser: row[6] || ''
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

      const sheetName = '재초담초채권_내역';
      const rows = await getSheetValues(sheetName);

      if (rows.length <= 1) {
        return res.json({ success: true, data: [] });
      }

      // 헤더 제외하고 데이터 행만 처리
      const dataRows = rows.slice(1);

      // 저장 시점별로 그룹화 (중복 제거)
      const timestampMap = new Map();

      dataRows.forEach(row => {
        const timestamp = row[0];
        const inputUser = row[6];

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

      // URL decode needed? Express usually handles params decoding but ensure safety
      // 클라이언트에서 encodeURIComponent해서 보냄.
      // 하지만 req.params.timestamp는 이미 디코딩되어 있을 수 있음.
      // 정확한 비교를 위해 원본 sheet 값과 비교 필요.
      const requestedTimestamp = req.params.timestamp;

      console.log(`🔍 [Rechotancho] Fetching data for timestamp: "${requestedTimestamp}"`);

      const sheetName = '재초담초채권_내역';
      const rows = await getSheetValues(sheetName);

      if (rows.length <= 1) {
        return res.json({ success: true, data: [] });
      }

      const dataRows = rows.slice(1);

      // 로그: 상위 5개 타임스탬프 확인
      // console.log(`🔍 Raw Timestamps Sample:`, dataRows.slice(0, 5).map(r => r[0]));

      // 타임스탬프 매칭 (문자열 비교 + Date 객체 비교 fallback)
      const targetDateVal = new Date(requestedTimestamp).getTime();

      const filteredRows = dataRows.filter(row => {
        const rowTimestamp = (row[0] || '').toString();

        // 1. Exact String Match (trim)
        if (rowTimestamp.trim() === requestedTimestamp.trim()) return true;

        // 2. Date Object Match (1 second tolerance)
        const rowDateVal = new Date(rowTimestamp).getTime();
        if (!isNaN(rowDateVal) && !isNaN(targetDateVal)) {
          if (Math.abs(rowDateVal - targetDateVal) < 1000) return true;
        }

        return false;
      });

      if (filteredRows.length === 0) {
        console.warn(`⚠️ [Rechotancho] Data not found for timestamp: "${requestedTimestamp}"`);
        return res.json({ success: true, data: [] }); // 빈 배열 반환 (에러 아님)
      }

      console.log(`✅ [Rechotancho] Found ${filteredRows.length} rows for timestamp.`);

      // 데이터 변환
      const data = filteredRows.map(row => ({
        timestamp: row[0] || '',
        agentCode: row[1] || '',
        agentName: row[2] || '',
        inventoryBond: Number(row[3]) || 0,
        collateralBond: Number(row[4]) || 0,
        managementBond: Number(row[5]) || 0,
        inputUser: row[6] || ''
      }));

      res.json({ success: true, data });
    } catch (error) {
      console.error('❌ 재초담초채권 데이터 조회 실패:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rechotancho-bond/save - 저장
  router.post('/api/rechotancho-bond/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data, inputUser } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ success: false, error: '데이터가 올바르지 않습니다. (Array expected)' });
      }

      // 현재 시간 (KST) - Legacy 로직 준수
      const now = new Date();
      // const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // 서버 시간대에 따라 다름. 보통 ISOString 사용이 안전.
      // 사용자가 원한 포맷이 있다면 유지. 여기서는 toISOString 사용하되 포맷 맞춤.
      // Legacy Code used: kstTime.toISOString().replace('T', ' ').substring(0, 19);
      // 하지만 환경에 따라 timezone 이슈 있음. 안전하게 toISOString() 혹은 moment 사용.
      // 일관성을 위해 Date().toISOString() 사용 혹은 로컬 시간 포맷팅.
      // 여기서는 심플하게 ISOString 사용 (프론트/백엔드 통일 권장)
      const timestamp = formatDateKST(new Date());

      // 시트에 저장할 행 생성 (다중 행)
      const rows = data.map(item => [
        timestamp,                          // A: 저장일시
        item.agentCode,                     // B: 대리점코드
        item.agentName,                     // C: 대리점명
        Number(item.inventoryBond) || 0,    // D: 재고초과채권
        Number(item.collateralBond) || 0,   // E: 담보초과채권
        Number(item.managementBond) || 0,   // F: 관리대상채권
        inputUser || ''                     // G: 입력자
      ]);

      const sheetName = '재초담초채권_내역';

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!A:G`,
          valueInputOption: 'RAW',
          resource: { values: rows }
        })
      );

      console.log(`✅ 재초담초채권 데이터 저장 완료: ${timestamp}, 입력자: ${inputUser}, ${rows.length}개 행`);
      cacheManager.deletePattern('jaecho_damcho_bond');

      res.json({ success: true, message: '데이터가 성공적으로 저장되었습니다.', timestamp });
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

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ success: false, error: '데이터가 올바르지 않습니다.' });
      }

      const sheetName = '재초담초채권_내역';
      const rows = await getSheetValues(sheetName);

      if (rows.length <= 1) {
        return res.status(404).json({ success: false, error: '수정할 데이터를 찾을 수 없습니다.' });
      }

      // 1-based index finding
      const targetRowIndices = [];
      // rows[0] is header. index 0 match -> row 1.
      rows.forEach((row, idx) => {
        if (row[0] === timestamp) {
          targetRowIndices.push(idx + 1); // 1-based
        }
      });

      if (targetRowIndices.length === 0) {
        // Timestamp exact match fail? Try permissive search if needed, but for Update it should be exact.
        // Try verifying with Date logic just in case user passed a slightly diff string?
        // For safety, stick to exact string match for Update/Delete to avoid accidental deletion.
        return res.status(404).json({ success: false, error: '해당 시점의 데이터를 찾을 수 없습니다.' });
      }

      // Update Strategy:
      // The legacy code performed DELETE then INSERT (Append).
      // This is safer for "Update" where the number of agents might change?
      // Or simply Delete old rows and Append new rows.
      // Legacy code logic: Delete rows (batchUpdate deleteDimension) then Append.

      // 1. Get Sheet ID
      const meta = await sheetsClient.sheets.spreadsheets.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID
      });
      const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) throw new Error('Sheet not found');
      const sheetId = sheet.properties.sheetId;

      // 2. Delete existing rows
      // Delete in reverse order to keep indices valid
      // Note: Consecutive rows can be deleted in one go if we optimized, but basic loop is safer for now.
      const requests = [];
      // Sort indices descending
      targetRowIndices.sort((a, b) => b - a);

      targetRowIndices.forEach(rowIndex => {
        requests.push({
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        });
      });

      if (requests.length > 0) {
        await sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: { requests }
        });
      }

      // 3. Append new data
      const newRows = data.map(item => [
        timestamp,                          // Keep original timestamp
        item.agentCode,
        item.agentName,
        Number(item.inventoryBond) || 0,
        Number(item.collateralBond) || 0,
        Number(item.managementBond) || 0,
        inputUser || ''
      ]);

      if (newRows.length > 0) {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.append({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${sheetName}!A:G`,
            valueInputOption: 'RAW',
            resource: { values: newRows }
          })
        );
      }

      console.log('재초담초채권 수정 완료:', timestamp);
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

      const sheetName = '재초담초채권_내역';
      const rows = await getSheetValues(sheetName);

      // 행 찾기
      const targetRowIndices = [];
      rows.forEach((row, idx) => {
        if (row[0] === timestamp) {
          targetRowIndices.push(idx + 1);
        }
      });

      if (targetRowIndices.length === 0) {
        return res.status(404).json({ success: false, error: '삭제할 데이터를 찾을 수 없습니다.' });
      }

      // Get Sheet ID
      const meta = await sheetsClient.sheets.spreadsheets.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID
      });
      const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) throw new Error('Sheet not found');
      const sheetId = sheet.properties.sheetId;

      // Delete Rows
      const requests = [];
      targetRowIndices.sort((a, b) => b - a); // Reverse order

      targetRowIndices.forEach(rowIndex => {
        requests.push({
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        });
      });

      await sheetsClient.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        resource: { requests }
      });

      console.log('재초담초채권 삭제 완료:', timestamp);
      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Helper for KST formatting (YYYY-MM-DD HH:mm:ss)
  function formatDateKST(date) {
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return kstDate.toISOString().replace('T', ' ').substring(0, 19);
  }

  return router;
}

module.exports = createRechotanchoBondRoutes;
