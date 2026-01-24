/**
 * Budget Routes
 * 
 * 예산 관리 관련 엔드포인트를 제공합니다.
 * - 정책그룹 관리
 * - 예산 계산 로직
 * - 예산 사용 현황 집계
 * 
 * Endpoints:
 * - GET /api/budget/policy-groups - 정책그룹 목록
 * - POST /api/budget/policy-group-settings - 정책그룹 설정 저장
 * - GET /api/budget/policy-group-settings - 정책그룹 설정 목록
 * - DELETE /api/budget/policy-group-settings/:name - 정책그룹 설정 삭제
 * - POST /api/budget/calculate-usage - 사용예산 계산
 * 
 * Requirements: 1.1, 1.2, 7.18
 */

const express = require('express');
const router = express.Router();

/**
 * Budget Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createBudgetRoutes(context) {
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

  // GET /api/budget/policy-groups - 정책그룹 목록
  router.get('/api/budget/policy-groups', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [예산] 정책그룹 목록 조회 시작');

      // 캐시 키 생성
      const cacheKey = 'budget_policy_groups';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 정책그룹 목록 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('정책그룹');
      const headers = values[0] || [];
      const rows = values.slice(1);

      const policyGroups = rows.map((row, index) => {
        const group = {};
        headers.forEach((header, i) => {
          group[header] = row[i] || '';
        });
        group.id = index + 1;
        return group;
      });

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, policyGroups, 5 * 60 * 1000);

      res.json({
        success: true,
        data: policyGroups
      });
    } catch (error) {
      console.error('Error fetching policy groups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch policy groups',
        message: error.message
      });
    }
  });

  // POST /api/budget/policy-group-settings - 정책그룹 설정 저장
  router.post('/api/budget/policy-group-settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { name, selectedGroups } = req.body;

      if (!name || !selectedGroups) {
        return res.status(400).json({
          success: false,
          error: '설정 이름과 선택된 그룹이 필요합니다.'
        });
      }

      console.log(`💾 [예산] 정책그룹 설정 저장: ${name}`);

      const now = new Date().toLocaleString('ko-KR');

      // 설정 저장
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책그룹설정!A:C',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              name,
              Array.isArray(selectedGroups) ? selectedGroups.join(',') : selectedGroups,
              now
            ]]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('budget_policy_group_settings');

      res.json({
        success: true,
        message: '정책그룹 설정이 저장되었습니다.'
      });
    } catch (error) {
      console.error('Error saving policy group settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save policy group settings',
        message: error.message
      });
    }
  });

  // GET /api/budget/policy-group-settings - 정책그룹 설정 목록
  router.get('/api/budget/policy-group-settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [예산] 정책그룹 설정 목록 조회 시작');

      // 캐시 키 생성
      const cacheKey = 'budget_policy_group_settings';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 정책그룹 설정 목록 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('정책그룹설정');
      const headers = values[0] || [];
      const rows = values.slice(1);

      const settings = rows.map((row, index) => {
        const setting = {};
        headers.forEach((header, i) => {
          setting[header] = row[i] || '';
        });
        setting.id = index + 1;
        
        // 그룹 문자열을 배열로 변환
        if (setting['선택된그룹']) {
          setting.selectedGroups = setting['선택된그룹'].split(',').map(g => g.trim());
        }
        
        return setting;
      });

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, settings, 5 * 60 * 1000);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching policy group settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch policy group settings',
        message: error.message
      });
    }
  });

  // DELETE /api/budget/policy-group-settings/:name - 정책그룹 설정 삭제
  router.delete('/api/budget/policy-group-settings/:name', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { name } = req.params;

      console.log(`🗑️ [예산] 정책그룹 설정 삭제: ${name}`);

      // 설정 찾기
      const values = await getSheetValues('정책그룹설정');
      const rows = values.slice(1);

      let targetRowIndex = -1;
      rows.forEach((row, index) => {
        if (row[0] === name) {
          targetRowIndex = index + 2; // 헤더 포함
        }
      });

      if (targetRowIndex === -1) {
        return res.status(404).json({
          success: false,
          error: '해당 설정을 찾을 수 없습니다.'
        });
      }

      // 행 삭제
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: targetRowIndex - 1,
                  endIndex: targetRowIndex
                }
              }
            }]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('budget_policy_group_settings');

      res.json({
        success: true,
        message: '정책그룹 설정이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('Error deleting policy group settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete policy group settings',
        message: error.message
      });
    }
  });

  // POST /api/budget/calculate-usage - 사용예산 계산
  router.post('/api/budget/calculate-usage', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, selectedPolicyGroups, dateRange, userName, budgetType } = req.body;

      if (!sheetId || !selectedPolicyGroups) {
        return res.status(400).json({
          success: false,
          error: '시트 ID와 정책그룹이 필요합니다.'
        });
      }

      console.log(`🧮 [예산] 사용예산 계산 시작: ${userName}, 타입: ${budgetType}`);

      // 개통 데이터 조회
      const activationValues = await getSheetValues('폰클개통데이터', sheetId);
      const activationHeaders = activationValues[0] || [];
      let activationRows = activationValues.slice(1);

      // 날짜 범위 필터링
      if (dateRange && dateRange.start && dateRange.end) {
        const dateIndex = activationHeaders.indexOf('개통일');
        if (dateIndex !== -1) {
          activationRows = activationRows.filter(row => {
            const date = row[dateIndex];
            return date >= dateRange.start && date <= dateRange.end;
          });
        }
      }

      // 정책그룹 필터링
      const policyGroupIndex = activationHeaders.indexOf('정책그룹');
      if (policyGroupIndex !== -1) {
        activationRows = activationRows.filter(row => {
          const group = row[policyGroupIndex];
          return selectedPolicyGroups.includes(group);
        });
      }

      // 예산 계산
      const budgetIndex = activationHeaders.indexOf('예산금액');
      let totalBudget = 0;

      if (budgetIndex !== -1) {
        activationRows.forEach(row => {
          const budget = parseFloat(row[budgetIndex]) || 0;
          totalBudget += budget;
        });
      }

      const result = {
        totalCount: activationRows.length,
        totalBudget,
        averageBudget: activationRows.length > 0 ? totalBudget / activationRows.length : 0,
        budgetType,
        dateRange,
        selectedPolicyGroups
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error calculating budget usage:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate budget usage',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createBudgetRoutes;
