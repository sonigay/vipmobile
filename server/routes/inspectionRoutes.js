/**
 * Inspection Routes
 * 
 * 검수 관리 관련 엔드포인트를 제공합니다.
 */

const express = require('express');
const router = express.Router();

function createInspectionRoutes(context) {
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

  router.get('/api/inspection/list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'inspection_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('검수관리');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching inspection list:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/api/inspection/save', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '검수관리!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('inspection');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving inspection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection-data - 검수 데이터 조회
  router.get('/api/inspection-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('검수데이터');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching inspection data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/available-fields - 사용 가능한 필드 목록
  router.get('/api/inspection/available-fields', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('검수필드');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching available fields:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/columns - 검수 컬럼 조회
  router.get('/api/inspection/columns', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('검수컬럼');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching inspection columns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/columns - 검수 컬럼 저장
  router.post('/api/inspection/columns', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { columns } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '검수컬럼!A2:Z',
          valueInputOption: 'RAW',
          resource: { values: columns }
        })
      );

      cacheManager.deletePattern('inspection');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving inspection columns:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/completion-status - 검수 완료 상태
  router.get('/api/inspection/completion-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('검수완료상태');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching completion status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/complete - 검수 완료 처리
  router.post('/api/inspection/complete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      console.log('검수 완료 처리:', id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing inspection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/field-values - 필드 값 목록
  router.get('/api/inspection/field-values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('검수필드값');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching field values:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inspection/modification-completion-status - 수정 완료 상태
  router.get('/api/inspection/modification-completion-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('검수수정완료상태');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching modification completion status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/modification-complete - 수정 완료 처리
  router.post('/api/inspection/modification-complete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.body;

      console.log('검수 수정 완료 처리:', id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing modification:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/modification-notes - 수정 노트 저장
  router.post('/api/inspection/modification-notes', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id, notes } = req.body;

      console.log('검수 수정 노트 저장:', id, notes);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving modification notes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/normalize - 검수 데이터 정규화
  router.post('/api/inspection/normalize', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      console.log('검수 데이터 정규화:', data);
      res.json({ success: true });
    } catch (error) {
      console.error('Error normalizing inspection data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inspection/update-system-data - 시스템 데이터 업데이트
  router.post('/api/inspection/update-system-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      console.log('검수 시스템 데이터 업데이트:', data);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating system data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/inventory-inspection - 재고 비교 검수 (마스터재고 vs 폰클재고)
  router.post('/api/inventory-inspection', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { normalizeSerialNumber } = require('../inventoryFilterUtils');

      console.log('🔍 재고 비교 검수 시작...');

      // 1. 필요한 모든 데이터 병렬 로드
      const [masterData, phoneklData, normData, confirmedData] = await Promise.all([
        getSheetValues('마스터재고'),
        getSheetValues('폰클재고데이터'),
        getSheetValues('모델명정규화'),
        getSheetValues('확정미확정재고')
      ]);

      // 2. 데이터 파싱
      const masterInventory = masterData.slice(1).map(row => ({
        modelCode: row[9] || '',
        color: row[11] || '',
        serialNumber: row[12] || '',
        normalizedSerial: normalizeSerialNumber(row[12]),
        outletCode: row[17] || '',
        firstInDate: row[23] || '',
        dealerInDate: row[26] || ''
      })).filter(item => item.serialNumber);

      const phoneklInventory = phoneklData.slice(3).map(row => ({
        inDate: row[22] || '', // W열 (예전 logic은 J 또는 W)
        serialNumber: row[11] || '', // L열
        normalizedSerial: normalizeSerialNumber(row[11]),
        type: row[12] || '', // M열
        modelName: row[13] || '', // N열
        color: row[14] || '', // O열
        status: row[15] || '', // P열
        inPrice: row[17] || '', // R열
        inStore: row[18] || '', // S열
        outStore: row[21] || '' // V열
      })).filter(item => item.serialNumber);

      // 모델 정규화 맵 구성
      const normalizationMap = {};
      normData.slice(1).forEach(row => {
        if (row[0] && row[1]) normalizationMap[row[0]] = row[1];
      });

      // 확인된 재고 셋 구성
      const confirmedSet = new Set();
      confirmedData.slice(1).forEach(row => {
        const serial = normalizeSerialNumber(row[4] || ''); // E열 (시트 구조 확인 필요)
        if (serial) confirmedSet.add(serial);
      });

      // 3. 폰클재고 Map 구성
      const phoneklMap = new Map();
      phoneklInventory.forEach(item => phoneklMap.set(item.normalizedSerial, item));

      // 4. 비교 로직
      const matchedItems = [];
      const unmatchedItems = [];
      const needsNormalization = new Set();

      masterInventory.forEach(masterItem => {
        const phoneklItem = phoneklMap.get(masterItem.normalizedSerial);

        if (phoneklItem) {
          matchedItems.push({ ...masterItem, phoneklData: phoneklItem, matched: true });
        } else {
          const isConfirmed = confirmedSet.has(masterItem.normalizedSerial);
          unmatchedItems.push({ ...masterItem, matched: false, isConfirmed });
        }

        if (masterItem.modelCode && !normalizationMap[masterItem.modelCode]) {
          needsNormalization.add(masterItem.modelCode);
        }
      });

      const response = {
        success: true,
        data: {
          total: masterInventory.length,
          matched: matchedItems,
          unmatched: unmatchedItems.filter(i => !i.isConfirmed),
          confirmed: unmatchedItems.filter(i => i.isConfirmed),
          needsNormalization: Array.from(needsNormalization),
          normalizationMap: normalizationMap,
          statistics: {
            totalCount: masterInventory.length,
            matchedCount: matchedItems.length,
            unmatchedCount: unmatchedItems.filter(i => !i.isConfirmed).length,
            confirmedCount: unmatchedItems.filter(i => i.isConfirmed).length,
            needsNormalizationCount: needsNormalization.size
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error inspecting inventory:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createInspectionRoutes;
