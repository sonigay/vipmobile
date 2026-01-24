/**
 * Inventory Routes
 * 
 * 재고 관리 관련 엔드포인트를 제공합니다.
 * - 재고 배정 로직
 * - 재고 현황 집계
 * - 개통 상태 확인
 * - 재고 분석
 * 
 * Endpoints:
 * - GET /api/inventory/assignment-status - 재고배정 상태 계산
 * - POST /api/inventory/save-assignment - 배정 저장
 * - GET /api/inventory/normalized-status - 정규화작업시트 재고 현황
 * - POST /api/inventory/manual-assignment - 수동 배정 실행
 * - GET /api/inventory/activation-status - 실시간 개통 상태 확인
 * - GET /api/inventory-analysis - 재고 현황 분석
 * 
 * Requirements: 1.1, 1.2, 7.16
 */

const express = require('express');
const router = express.Router();

/**
 * Inventory Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createInventoryRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // Google Sheets 클라이언트가 없으면 에러 응답 반환하는 헬퍼 함수
  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({
        success: false,
        error: 'Google Sheets client not available. Please check environment variables.'
      });
      return false;
    }
    return true;
  };

  // 시트 데이터 가져오기 헬퍼 함수
  async function getSheetValues(sheetName, spreadsheetId = null) {
    const targetSpreadsheetId = spreadsheetId || sheetsClient.SPREADSHEET_ID;
    
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: targetSpreadsheetId,
        range: `${sheetName}!A:Z`
      })
    );
    
    return response.data.values || [];
  }

  // GET /api/inventory/assignment-status - 재고배정 상태 계산
  router.get('/api/inventory/assignment-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📊 [재고배정] 재고배정 상태 계산 시작');

      // 캐시 키 생성
      const cacheKey = 'inventory_assignment_status';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 재고배정 상태 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      // 폰클재고데이터 시트 조회
      const inventoryValues = await getSheetValues('폰클재고데이터');
      const inventoryHeaders = inventoryValues[0] || [];
      const inventoryRows = inventoryValues.slice(1);

      // 예약 데이터 조회
      const reservationValues = await getSheetValues('예약데이터');
      const reservationHeaders = reservationValues[0] || [];
      const reservationRows = reservationValues.slice(1);

      // 재고 배정 상태 계산 로직
      const assignmentStatus = {
        totalInventory: inventoryRows.length,
        totalReservations: reservationRows.length,
        assigned: 0,
        unassigned: 0,
        pending: 0
      };

      // 배정 상태 집계
      inventoryRows.forEach(row => {
        const status = row[inventoryHeaders.indexOf('배정상태')] || '';
        if (status === '배정완료') assignmentStatus.assigned++;
        else if (status === '미배정') assignmentStatus.unassigned++;
        else if (status === '보류') assignmentStatus.pending++;
      });

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, assignmentStatus, 5 * 60 * 1000);

      res.json({
        success: true,
        data: assignmentStatus
      });
    } catch (error) {
      console.error('Error calculating assignment status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate assignment status',
        message: error.message
      });
    }
  });

  // POST /api/inventory/save-assignment - 배정 저장
  router.post('/api/inventory/save-assignment', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('💾 [배정저장] 배정 저장 시작');

      const { assignments } = req.body;

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          error: '배정 데이터가 필요합니다.'
        });
      }

      // 각 배정 항목 처리
      for (const assignment of assignments) {
        const { reservationNumber, assignedSerialNumber, rowIndex } = assignment;

        if (!reservationNumber || !assignedSerialNumber) {
          continue;
        }

        // 재고 시트 업데이트
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `폰클재고데이터!${rowIndex}:${rowIndex}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[
                assignedSerialNumber,
                reservationNumber,
                '배정완료',
                new Date().toLocaleString('ko-KR')
              ]]
            }
          })
        );
      }

      // 캐시 무효화
      cacheManager.deletePattern('inventory_');

      res.json({
        success: true,
        message: `${assignments.length}건의 배정이 저장되었습니다.`
      });
    } catch (error) {
      console.error('Error saving assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save assignment',
        message: error.message
      });
    }
  });

  // GET /api/inventory/normalized-status - 정규화작업시트 재고 현황
  router.get('/api/inventory/normalized-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📊 [재고현황] 정규화작업시트 C열 기준 사무실별 재고 현황 로드 시작');

      // 캐시 키 생성
      const cacheKey = 'inventory_normalized_status';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 정규화 재고 현황 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('정규화작업시트');
      const rows = values.slice(1);

      // C열(사무실) 기준으로 집계
      const statusByOffice = {};

      rows.forEach(row => {
        const office = row[2] || '미지정'; // C열
        const model = row[3] || ''; // D열
        const color = row[4] || ''; // E열

        if (!statusByOffice[office]) {
          statusByOffice[office] = {
            office,
            totalCount: 0,
            models: {}
          };
        }

        statusByOffice[office].totalCount++;

        const modelKey = `${model}_${color}`;
        if (!statusByOffice[office].models[modelKey]) {
          statusByOffice[office].models[modelKey] = {
            model,
            color,
            count: 0
          };
        }
        statusByOffice[office].models[modelKey].count++;
      });

      // 배열로 변환
      const result = Object.values(statusByOffice).map(office => ({
        ...office,
        models: Object.values(office.models)
      }));

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching normalized status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch normalized status',
        message: error.message
      });
    }
  });

  // POST /api/inventory/manual-assignment - 수동 배정 실행
  router.post('/api/inventory/manual-assignment', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🔧 [수동배정] 수동 배정 실행 시작');

      const { reservationNumber, serialNumber, model, color } = req.body;

      if (!reservationNumber || !serialNumber) {
        return res.status(400).json({
          success: false,
          error: '예약번호와 시리얼번호가 필요합니다.'
        });
      }

      // 재고 시트에서 해당 시리얼번호 찾기
      const inventoryValues = await getSheetValues('폰클재고데이터');
      const inventoryRows = inventoryValues.slice(1);

      let targetRowIndex = -1;
      inventoryRows.forEach((row, index) => {
        if (row[0] === serialNumber) {
          targetRowIndex = index + 2; // 헤더 포함
        }
      });

      if (targetRowIndex === -1) {
        return res.status(404).json({
          success: false,
          error: '해당 시리얼번호를 찾을 수 없습니다.'
        });
      }

      // 배정 처리
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `폰클재고데이터!A${targetRowIndex}:Z${targetRowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[
              serialNumber,
              model,
              color,
              reservationNumber,
              '배정완료',
              new Date().toLocaleString('ko-KR')
            ]]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('inventory_');

      res.json({
        success: true,
        message: '수동 배정이 완료되었습니다.'
      });
    } catch (error) {
      console.error('Error executing manual assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute manual assignment',
        message: error.message
      });
    }
  });

  // GET /api/inventory/activation-status - 실시간 개통 상태 확인
  router.get('/api/inventory/activation-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📱 [개통상태] 실시간 개통 상태 확인 시작');

      const { serialNumber } = req.query;

      if (!serialNumber) {
        return res.status(400).json({
          success: false,
          error: '시리얼번호가 필요합니다.'
        });
      }

      // 개통 데이터 조회
      const activationValues = await getSheetValues('폰클개통데이터');
      const activationRows = activationValues.slice(1);

      const activationInfo = activationRows.find(row => row[0] === serialNumber);

      if (!activationInfo) {
        return res.json({
          success: true,
          data: {
            serialNumber,
            activated: false,
            message: '개통 정보가 없습니다.'
          }
        });
      }

      res.json({
        success: true,
        data: {
          serialNumber,
          activated: true,
          activationDate: activationInfo[1] || '',
          customerName: activationInfo[2] || '',
          phoneNumber: activationInfo[3] || ''
        }
      });
    } catch (error) {
      console.error('Error checking activation status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check activation status',
        message: error.message
      });
    }
  });

  // GET /api/inventory/agent-filters - 대리점 필터 목록 조회
  router.get('/api/inventory/agent-filters', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🔍 [대리점필터] 대리점 필터 목록 조회 시작');

      // 캐시 키 생성
      const cacheKey = 'inventory_agent_filters';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 대리점 필터 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      // 대리점아이디관리 시트에서 대리점 목록 조회
      const values = await getSheetValues('대리점아이디관리');
      const headers = values[0] || [];
      const rows = values.slice(1);

      const agentCodeIndex = headers.indexOf('대리점코드');
      const agentNameIndex = headers.indexOf('대리점명');
      const officeIndex = headers.indexOf('사무실');

      const filters = rows
        .filter(row => row[agentCodeIndex] && row[agentNameIndex])
        .map(row => ({
          code: row[agentCodeIndex] || '',
          name: row[agentNameIndex] || '',
          office: row[officeIndex] || ''
        }));

      // 중복 제거
      const uniqueFilters = Array.from(
        new Map(filters.map(item => [item.code, item])).values()
      );

      // 캐시 저장 (10분)
      cacheManager.set(cacheKey, uniqueFilters, 10 * 60 * 1000);

      res.json({
        success: true,
        data: uniqueFilters
      });
    } catch (error) {
      console.error('Error fetching agent filters:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch agent filters',
        message: error.message
      });
    }
  });

  // GET /api/inventory-analysis - 재고 현황 분석
  router.get('/api/inventory-analysis', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { storeCode } = req.query;

      console.log('📊 [재고분석] 재고 현황 분석 시작', storeCode ? `(대리점: ${storeCode})` : '');

      // 캐시 키 생성
      const cacheKey = `inventory_analysis_${storeCode || 'all'}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 재고 분석 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('폰클재고데이터');
      const headers = values[0] || [];
      let rows = values.slice(1);

      // 대리점 필터링
      if (storeCode) {
        const storeCodeIndex = headers.indexOf('대리점코드');
        if (storeCodeIndex !== -1) {
          rows = rows.filter(row => row[storeCodeIndex] === storeCode);
        }
      }

      // 분석 데이터 생성
      const analysis = {
        totalCount: rows.length,
        byModel: {},
        byColor: {},
        byStatus: {},
        byStore: {}
      };

      rows.forEach(row => {
        const model = row[headers.indexOf('모델명')] || '미지정';
        const color = row[headers.indexOf('색상')] || '미지정';
        const status = row[headers.indexOf('배정상태')] || '미지정';
        const store = row[headers.indexOf('대리점코드')] || '미지정';

        // 모델별 집계
        analysis.byModel[model] = (analysis.byModel[model] || 0) + 1;

        // 색상별 집계
        analysis.byColor[color] = (analysis.byColor[color] || 0) + 1;

        // 상태별 집계
        analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;

        // 대리점별 집계
        analysis.byStore[store] = (analysis.byStore[store] || 0) + 1;
      });

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, analysis, 5 * 60 * 1000);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error analyzing inventory:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze inventory',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createInventoryRoutes;
