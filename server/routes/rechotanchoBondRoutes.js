/**
 * Rechotancho Bond Routes (Restored Multi-row Logic)
 * 재초담초채권 관련 엔드포인트
 * 
 * Schema:
 * A: Timestamp (저장일시)
 * B: Agent Code (대리점 코드)
 * C: Agent Name (대리점명)
 * D: Inventory Bond (재고초과채권)
 * E: Collateral Bond (담보초과채권)
 * F: Management Bond (관리대상채권)
 * G: Input User (입력자)
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

  async function getSheetValues(sheetName) {
    try {
      if (!sheetsClient || !sheetsClient.sheets) {
        return [];
      }
      const range = `${sheetName}!A:G`;
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

  // GET /api/rechotancho-bond/all-data - 전체 데이터 조회 (History Graph용)
  router.get('/api/rechotancho-bond/all-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'jaecho_damcho_bond_all_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('재초담초채권_내역');

      // 헤더 제외하고 데이터 파싱
      // A: Timestamp, B: Code, C: Name, D: Inventory, E: Collateral, F: Management, G: User
      const rawRows = values.slice(1);

      const parsedData = rawRows.map(row => {
        // 행 데이터가 부족할 경우 안전 처리
        return {
          timestamp: row[0] || '',
          agentCode: row[1] || '',
          agentName: row[2] || '',
          inventoryBond: Number(row[3]?.replace(/,/g, '')) || 0,
          collateralBond: Number(row[4]?.replace(/,/g, '')) || 0,
          managementBond: Number(row[5]?.replace(/,/g, '')) || 0,
          inputUser: row[6] || ''
        };
      }).filter(item => item.timestamp && item.agentName); // 유효한 데이터만 필터링

      const result = { success: true, data: parsedData };

      // 캐시 저장 (1분)
      cacheManager.set(cacheKey, result, 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching rechotancho bond all-data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rechotancho-bond/history - 저장된 시점 목록 (Dropdown용)
  router.get('/api/rechotancho-bond/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('재초담초채권_내역');
      const rawRows = values.slice(1);

      // Unique Timestamp 추출
      const timestampMap = new Map();
      rawRows.forEach(row => {
        const ts = row[0];
        const user = row[6] || 'Unknown';
        if (ts && !timestampMap.has(ts)) {
          timestampMap.set(ts, { timestamp: ts, inputUser: user });
        }
      });

      // 최신순 정렬
      const history = Array.from(timestampMap.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.json({ success: true, data: history });
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/rechotancho-bond/data/:timestamp - 특정 시점 데이터 상세 조회 (입력폼 로드용)
  router.get('/api/rechotancho-bond/data/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;
      const targetTs = decodeURIComponent(timestamp).trim();

      const values = await getSheetValues('재초담초채권_내역');
      const rawRows = values.slice(1);

      // 해당 타임스탬프를 가진 모든 행 필터링
      const matchedRows = rawRows.filter(row => (row[0] || '').trim() === targetTs);

      if (matchedRows.length === 0) {
        // Date 객체 비교 시도 (1초 오차 허용) - 레거시 호환
        const targetTime = new Date(targetTs).getTime();
        const fallbackRows = rawRows.filter(row => {
          const rowTime = new Date(row[0]).getTime();
          return Math.abs(rowTime - targetTime) < 1000;
        });

        if (fallbackRows.length > 0) {
          const parsedData = fallbackRows.map(row => ({
            agentCode: row[1] || '',
            agentName: row[2] || '',
            inventoryBond: row[3] || '', // 입력폼엔 문자열 유지 (콤마 등)
            collateralBond: row[4] || '',
            managementBond: Number(row[5]?.replace(/,/g, '')) || 0
          }));
          return res.json({ success: true, data: parsedData });
        }

        return res.status(404).json({ success: false, error: '데이터를 찾을 수 없습니다.' });
      }

      const parsedData = matchedRows.map(row => ({
        agentCode: row[1] || '',
        agentName: row[2] || '',
        inventoryBond: row[3] || '',
        collateralBond: row[4] || '',
        managementBond: Number(row[5]?.replace(/,/g, '')) || 0
      }));

      res.json({ success: true, data: parsedData });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/rechotancho-bond/save - 데이터 저장 (Multi-row Append)
  router.post('/api/rechotancho-bond/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { data, inputUser } = req.body; // data is Array of agents
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ success: false, error: '데이터가 없습니다.' });
      }

      const timestamp = new Date().toISOString(); // KST 변환은 Frontend or Utils 처리 권장, 여기선 ISO

      // 행 데이터 변환
      // A:Ts, B:Code, C:Name, D:Inv, E:Col, F:Mgmt, G:User
      const rows = data.map(item => [
        timestamp,
        item.agentCode || '',
        item.agentName || '',
        item.inventoryBond || '0',
        item.collateralBond || '0',
        item.managementBond || '0',
        inputUser || 'Unknown'
      ]);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '재초담초채권_내역!A:G',
          valueInputOption: 'RAW',
          resource: { values: rows }
        })
      );

      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });
    } catch (error) {
      console.error('Save error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/rechotancho-bond/update/:timestamp - 데이터 수정 (Delete & Insert)
  router.put('/api/rechotancho-bond/update/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;
      const { data, inputUser } = req.body;

      // 1. 기존 데이터 행 인덱스 찾기
      const values = await getSheetValues('재초담초채권_내역');
      const targetTs = decodeURIComponent(timestamp).trim();

      // 삭제할 범위들 계산 (역순으로 정렬하여 삭제 시 인덱스 변화 방지)
      // 하지만 batchUpdate deleteDimension은 인덱스가 밀리므로 주의해야 함.
      // 안전하게: 
      // A. 해당 Timestamp의 행들을 모두 찾는다.
      // B. 해당 행들을 삭제한다.
      // C. 새로운 데이터를 Append 한다.

      // Google Sheets API는 불연속 행 삭제가 까다로우므로, 
      // 연속된 경우가 많겠지만 섞여있을 수도 있음.
      // 가장 안전한 방법: Filter 후 다시 쓰기? 비효율적.
      // 대안: 해당 행들의 내용을 비우고(Clear), 맨 뒤에 새 데이터 Append? -> 빈 행이 생김.

      // 전략: 
      // 1) 시트 메타데이터 로드하여 SheetID 획득
      // 2) 전체 데이터를 스캔하여 삭제할 Row Index 목록 확보
      // 3) BatchUpdate로 삭제 요청 (Sheet API는 startIndex가 큰 순서대로 요청하면 인덱스 문제 없음)
      // 4) Append로 새 데이터 추가

      const meta = await sheetsClient.sheets.spreadsheets.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID
      });
      const sheet = meta.data.sheets.find(s => s.properties.title === '재초담초채권_내역');
      const sheetId = sheet.properties.sheetId;

      const rowsToDelete = [];
      const rawRows = values; // values includes header at 0

      for (let i = 1; i < rawRows.length; i++) {
        if ((rawRows[i][0] || '').trim() === targetTs) {
          rowsToDelete.push(i);
        }
      }

      if (rowsToDelete.length > 0) {
        // 뒤에서부터 삭제해야 인덱스가 꼬이지 않음 (라고 생각하기 쉽지만 batchUpdate 안의 request 순서 중요)
        // 사실 deleteDimension을 여러 개 보내면 내부적으로 처리해주나? 문서상 "The requests are applied in the order they appear".
        // 즉, 10번 삭제 후 11번 삭제하려면... 원래 11번이 10번이 됨.
        // 따라서 인덱스가 큰 순서(내림차순)로 요청을 만들어야 함.
        rowsToDelete.sort((a, b) => b - a);

        const deleteRequests = rowsToDelete.map(idx => ({
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: idx,
              endIndex: idx + 1
            }
          }
        }));

        await sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: { requests: deleteRequests }
        });
      }

      // 2. 새 데이터 추가
      const newRows = data.map(item => [
        targetTs, // 기존 Timestamp 유지
        item.agentCode || '',
        item.agentName || '',
        item.inventoryBond || '0',
        item.collateralBond || '0',
        item.managementBond || '0',
        inputUser || 'Modified'
      ]);

      if (newRows.length > 0) {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.append({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: '재초담초채권_내역!A:G',
            valueInputOption: 'RAW',
            resource: { values: newRows }
          })
        );
      }

      cacheManager.deletePattern('jaecho_damcho_bond');
      res.json({ success: true });

    } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/rechotancho-bond/delete/:timestamp - 데이터 삭제
  router.delete('/api/rechotancho-bond/delete/:timestamp', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { timestamp } = req.params;

      const meta = await sheetsClient.sheets.spreadsheets.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID
      });
      const sheet = meta.data.sheets.find(s => s.properties.title === '재초담초채권_내역');
      const sheetId = sheet.properties.sheetId;

      const values = await getSheetValues('재초담초채권_내역');
      const targetTs = decodeURIComponent(timestamp).trim();

      const rowsToDelete = [];
      for (let i = 1; i < values.length; i++) {
        if ((values[i][0] || '').trim() === targetTs) {
          rowsToDelete.push(i);
        }
      }

      if (rowsToDelete.length === 0) {
        return res.status(404).json({ success: false, error: '삭제할 데이터를 찾을 수 없습니다.' });
      }

      // 내림차순 정렬하여 뒤에서부터 삭제
      rowsToDelete.sort((a, b) => b - a);

      const deleteRequests = rowsToDelete.map(idx => ({
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: idx,
            endIndex: idx + 1
          }
        }
      }));

      await sheetsClient.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        resource: { requests: deleteRequests }
      });

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
