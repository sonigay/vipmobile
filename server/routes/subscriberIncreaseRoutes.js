/**
 * Subscriber Increase Routes
 * 가입자 증가 관련 엔드포인트
 */

const express = require('express');
const router = express.Router();

function createSubscriberIncreaseRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({ success: false, error: 'Google Sheets client not available' });
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

  // GET /api/subscriber-increase/access - 접근 권한
  router.get('/api/subscriber-increase/access', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const AGENT_SHEET_NAME = '대리점아이디관리';

      const agentResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${AGENT_SHEET_NAME}!A:L`
        })
      );

      if (!agentResponse.data.values || agentResponse.data.values.length === 0) {
        throw new Error('Failed to fetch agent data');
      }

      const agentRows = agentResponse.data.values.slice(1);
      const authorizedAgents = agentRows
        .filter(row => row && row.length > 10 && row[10] === 'O') // K열 (10번 인덱스)
        .map(row => ({
          agentCode: row[0] || '',
          agentName: row[1] || '',
          accessLevel: row[10] || ''
        }));

      res.json({
        success: true,
        hasAccess: authorizedAgents.length > 0,
        authorizedAgents,
        totalAgents: agentRows.length,
        authorizedCount: authorizedAgents.length
      });
    } catch (error) {
      console.error('Error checking subscriber increase access:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/subscriber-increase/data - 데이터 (헤더 포함)
  router.get('/api/subscriber-increase/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'subscriber_increase_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      // 레거시: A:AA 범위로 조회, 헤더 포함 전체 데이터 반환
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '가입자증감!A:AA'
        })
      );

      const data = response.data.values || [];

      const result = { success: true, data };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching subscriber increase data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 합계 계산 및 업데이트 함수
  async function calculateAndUpdateTotals(spreadsheetId, sheetName, yearMonthIndex) {
    try {
      const data = await getSheetValues(sheetName);
      if (data.length < 3) return;

      const subscriberTotals = {};
      const feeTotals = {};

      for (let i = 3; i < data.length; i++) {
        const row = data[i];
        const agentCode = row[0];
        const type = row[2];
        const value = parseFloat((row[yearMonthIndex] || '').toString().replace(/,/g, '')) || 0;

        if (type === '가입자수') {
          subscriberTotals[agentCode] = (subscriberTotals[agentCode] || 0) + value;
        } else if (type === '관리수수료') {
          feeTotals[agentCode] = (feeTotals[agentCode] || 0) + value;
        }
      }

      const totalSubscribers = Object.values(subscriberTotals).reduce((sum, val) => sum + val, 0);
      const totalFees = Object.values(feeTotals).reduce((sum, val) => sum + val, 0);

      const updatedRow1 = [...data[1]];
      const updatedRow2 = [...data[2]];
      updatedRow1[yearMonthIndex] = totalSubscribers;
      updatedRow2[yearMonthIndex] = totalFees;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A2:AA3`,
          valueInputOption: 'RAW',
          resource: { values: [updatedRow1, updatedRow2] }
        })
      );
    } catch (error) {
      console.error('Error calculating totals:', error);
    }
  }

  // POST /api/subscriber-increase/save - 저장 (단일 업데이트 대응)
  router.post('/api/subscriber-increase/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { yearMonth, agentCode, type, value } = req.body;

      if (!yearMonth || !agentCode || !type || value === undefined) {
        return res.status(400).json({ success: false, error: '필수 데이터 누락' });
      }

      const existingData = await getSheetValues('가입자증감');
      if (existingData.length === 0) return res.status(404).json({ success: false, error: '시트 데이터 없음' });

      const headers = existingData[0];
      const yearMonthIndex = headers.findIndex(h => h === yearMonth);
      if (yearMonthIndex === -1) return res.status(400).json({ success: false, error: '년월 컬럼을 찾을 수 없음' });

      let targetRowIndex = existingData.findIndex((row, idx) => idx > 0 && row[0] === agentCode && row[2] === type);
      if (targetRowIndex === -1) return res.status(404).json({ success: false, error: '행을 찾을 수 없음' });

      const updatedRow = [...existingData[targetRowIndex]];
      updatedRow[yearMonthIndex] = value;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `가입자증감!A${targetRowIndex + 1}:AA${targetRowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [updatedRow] }
        })
      );

      await calculateAndUpdateTotals(sheetsClient.SPREADSHEET_ID, '가입자증감', yearMonthIndex);
      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/bulk-save - 대량 저장 (기존 업데이트 방식)
  router.post('/api/subscriber-increase/bulk-save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      // bulkData 또는 data로 유연하게 받기
      const bulkData = req.body.bulkData || req.body.data;

      if (!bulkData || !Array.isArray(bulkData) || bulkData.length === 0) {
        return res.status(400).json({ success: false, error: '저장할 데이터가 없습니다.' });
      }

      // 1. 기존 데이터 전체 로드
      const existingData = await getSheetValues('가입자증감');
      if (existingData.length === 0) return res.status(404).json({ success: false, error: '시트 데이터를 찾을 수 없습니다.' });

      const headers = existingData[0];
      const updatedData = [...existingData];
      const affectedYearMonths = new Set();

      // 2. 인메모리 데이터 업데이트
      for (const item of bulkData) {
        const { yearMonth, agentCode, type, value } = item;
        const colIdx = headers.findIndex(h => h === yearMonth);
        const rowIdx = existingData.findIndex((row, idx) => idx > 0 && row[0] === agentCode && row[2] === type);

        if (colIdx !== -1 && rowIdx !== -1) {
          updatedData[rowIdx][colIdx] = value;
          affectedYearMonths.add(colIdx);
        }
      }

      // 3. 전체 시트 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '가입자증감!A:AA',
          valueInputOption: 'RAW',
          resource: { values: updatedData }
        })
      );

      // 4. 영향받은 모든 월의 합계 재계산
      for (const yearMonthIndex of affectedYearMonths) {
        await calculateAndUpdateTotals(sheetsClient.SPREADSHEET_ID, '가입자증감', yearMonthIndex);
      }

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true, count: bulkData.length });
    } catch (error) {
      console.error('Error bulk saving subscriber increase data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/subscriber-increase/delete - 삭제
  router.post('/api/subscriber-increase/delete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { yearMonth, agentCode, type } = req.body;

      const existingData = await getSheetValues('가입자증감');
      const headers = existingData[0];
      const colIdx = headers.findIndex(h => h === yearMonth);
      const rowIdx = existingData.findIndex((row, idx) => idx > 0 && row[0] === agentCode && row[2] === type);

      if (colIdx !== -1 && rowIdx !== -1) {
        const updatedRow = [...existingData[rowIdx]];
        updatedRow[colIdx] = '';

        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `가입자증감!A${rowIdx + 1}:AA${rowIdx + 1}`,
            valueInputOption: 'RAW',
            resource: { values: [updatedRow] }
          })
        );
        await calculateAndUpdateTotals(sheetsClient.SPREADSHEET_ID, '가입자증감', colIdx);
      }

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/init-sheet - 시트 초기화
  router.post('/api/subscriber-increase/init-sheet', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const SUBSCRIBER_INCREASE_SHEET_NAME = '가입자증감';

      // 시트 존재 여부 확인
      const spreadsheetResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID
        })
      );

      const existingSheets = spreadsheetResponse.data.sheets || [];
      const targetSheet = existingSheets.find(sheet => sheet.properties.title === SUBSCRIBER_INCREASE_SHEET_NAME);

      const headers = [
        '대리점코드', '대리점명', '구분',
        '2024년 1월', '2024년 2월', '2024년 3월', '2024년 4월', '2024년 5월', '2024년 6월',
        '2024년 7월', '2024년 8월', '2024년 9월', '2024년 10월', '2024년 11월', '2024년 12월',
        '2025년 1월', '2025년 2월', '2025년 3월', '2025년 4월', '2025년 5월', '2025년 6월',
        '2025년 7월', '2025년 8월', '2025년 9월', '2025년 10월', '2025년 11월', '2025년 12월'
      ];

      const initialDataRows = [
        ['합계', '합계', '가입자수', ...Array(24).fill('')],
        ['합계', '합계', '관리수수료', ...Array(24).fill('')],
        ['306891', '경수', '가입자수', ...Array(24).fill('')],
        ['306891', '경수', '관리수수료', ...Array(24).fill('')],
        ['315835', '경인', '가입자수', ...Array(24).fill('')],
        ['315835', '경인', '관리수수료', ...Array(24).fill('')],
        ['315835(제외)', '경인(제외)', '가입자수', ...Array(24).fill('')],
        ['315835(제외)', '경인(제외)', '관리수수료', ...Array(24).fill('')],
        ['316558', '동서울', '가입자수', ...Array(24).fill('')],
        ['316558', '동서울', '관리수수료', ...Array(24).fill('')],
        ['314942', '호남', '가입자수', ...Array(24).fill('')],
        ['314942', '호남', '관리수수료', ...Array(24).fill('')],
        ['316254', '호남2', '가입자수', ...Array(24).fill('')],
        ['316254', '호남2', '관리수수료', ...Array(24).fill('')]
      ];

      if (targetSheet) {
        const existingData = await getSheetValues(SUBSCRIBER_INCREASE_SHEET_NAME);
        if (existingData.length === 0) {
          const values = [headers, ...initialDataRows];
          await rateLimiter.execute(() =>
            sheetsClient.sheets.spreadsheets.values.update({
              spreadsheetId: sheetsClient.SPREADSHEET_ID,
              range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A1`,
              valueInputOption: 'RAW',
              resource: { values }
            })
          );
        }
      } else {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            resource: {
              requests: [{
                addSheet: { properties: { title: SUBSCRIBER_INCREASE_SHEET_NAME } }
              }]
            }
          })
        );
        const values = [headers, ...initialDataRows];
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${SUBSCRIBER_INCREASE_SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            resource: { values }
          })
        );
      }

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/subscriber-increase/add-excluded-row - 제외 행 추가
  router.post('/api/subscriber-increase/add-excluded-row', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const existingData = await getSheetValues('가입자증감');
      const hasExcludedRow = existingData.some(row => row[0] === '315835(제외)');

      if (hasExcludedRow) {
        return res.json({ success: true, message: '이미 존재함' });
      }

      const updatedData = [...existingData];
      const insertIndex = updatedData.findIndex(row => row[0] === '315835' && row[2] === '관리수수료') + 1;

      if (insertIndex > 0) {
        updatedData.splice(insertIndex, 0,
          ['315835(제외)', '경인(제외)', '가입자수', ...Array(24).fill('')],
          ['315835(제외)', '경인(제외)', '관리수수료', ...Array(24).fill('')]
        );

        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: '가입자증감!A1',
            valueInputOption: 'RAW',
            resource: { values: updatedData }
          })
        );
      }

      cacheManager.deletePattern('subscriber_increase');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createSubscriberIncreaseRoutes;
