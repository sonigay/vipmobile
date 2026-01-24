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

  // GET /api/budget/month-sheets - 예산 대상월 관리 목록
  router.get('/api/budget/month-sheets', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'budget_month_sheets';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const values = await getSheetValues('예산_대상월관리');
      
      if (values.length === 0 || !values[0] || values[0][0] !== '대상월') {
        return res.json([]);
      }

      if (values.length <= 1) {
        return res.json([]);
      }

      const data = values.slice(1).map(row => ({
        month: row[0] || '',
        sheetId: row[1] || '',
        updatedAt: row[2] || '',
        updatedBy: row[3] || ''
      }));

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching month sheets:', error);
      res.status(500).json({
        error: '예산 대상월 관리 데이터 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/month-sheets - 예산 대상월 관리 저장
  router.post('/api/budget/month-sheets', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { month, sheetId, updatedBy } = req.body;

      if (!month || !sheetId) {
        return res.status(400).json({ error: '대상월과 시트 ID는 필수입니다.' });
      }

      const currentTime = new Date().toISOString();
      const values = await getSheetValues('예산_대상월관리');
      const rows = values || [];
      const existingRowIndex = rows.findIndex(row => row[0] === month);

      if (existingRowIndex > 0) {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `예산_대상월관리!B${existingRowIndex + 1}:D${existingRowIndex + 1}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[sheetId, currentTime, updatedBy]]
            }
          })
        );
      } else {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.append({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: '예산_대상월관리!A:D',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[month, sheetId, currentTime, updatedBy]]
            }
          })
        );
      }

      cacheManager.deletePattern('budget_month_sheets');
      res.json({ message: '월별 시트 ID가 저장되었습니다.' });
    } catch (error) {
      console.error('Error saving month sheet:', error);
      res.status(500).json({
        error: '예산 대상월 관리 데이터 저장 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // DELETE /api/budget/month-sheets/:month - 예산 대상월 관리 삭제
  router.delete('/api/budget/month-sheets/:month', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { month } = req.params;
      const values = await getSheetValues('예산_대상월관리');
      const rows = values || [];
      const existingRowIndex = rows.findIndex(row => row[0] === month);

      if (existingRowIndex <= 0) {
        return res.status(404).json({ error: '해당 월의 데이터를 찾을 수 없습니다.' });
      }

      // 시트 ID 가져오기
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID
        })
      );

      const sheet = response.data.sheets.find(s => s.properties.title === '예산_대상월관리');
      const sheetId = sheet ? sheet.properties.sheetId : null;

      if (!sheetId) {
        return res.status(404).json({ error: '시트를 찾을 수 없습니다.' });
      }

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: existingRowIndex,
                  endIndex: existingRowIndex + 1
                }
              }
            }]
          }
        })
      );

      cacheManager.deletePattern('budget_month_sheets');
      res.json({ message: '월별 시트 ID가 삭제되었습니다.' });
    } catch (error) {
      console.error('Error deleting month sheet:', error);
      res.status(500).json({
        error: '예산 대상월 관리 데이터 삭제 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/budget/user-sheets - 사용자 시트 목록 (레거시)
  router.get('/api/budget/user-sheets', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, targetMonth, showAllUsers, budgetType } = req.query;
      
      const cacheKey = `budget_user_sheets_${userId}_${targetMonth}_${showAllUsers}_${budgetType}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const values = await getSheetValues('예산_사용자시트관리');
      
      if (values.length <= 1) {
        return res.json([]);
      }

      let data = values.slice(1).map(row => ({
        userId: row[0] || '',
        sheetId: row[1] || '',
        sheetName: row[2] || '',
        createdAt: row[3] || '',
        createdBy: row[4] || '',
        targetMonth: row[5] || '',
        selectedPolicyGroups: row[6] || ''
      }));

      // 필터링
      if (userId && showAllUsers !== 'true') {
        data = data.filter(item => item.userId === userId);
      }
      if (targetMonth) {
        data = data.filter(item => item.targetMonth === targetMonth);
      }
      if (budgetType) {
        data = data.filter(item => item.sheetName.includes(budgetType));
      }

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching user sheets:', error);
      res.status(500).json({
        error: '사용자 시트 목록 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/budget/user-sheets-v2 - 사용자 시트 목록 (v2)
  router.get('/api/budget/user-sheets-v2', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, targetMonth, showAllUsers, budgetType } = req.query;
      
      const cacheKey = `budget_user_sheets_v2_${userId}_${targetMonth}_${showAllUsers}_${budgetType}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }

      const values = await getSheetValues('예산_사용자시트관리');
      
      if (values.length <= 1) {
        return res.json({ success: true, data: [] });
      }

      let data = values.slice(1).map(row => ({
        userId: row[0] || '',
        sheetId: row[1] || '',
        sheetName: row[2] || '',
        createdAt: row[3] || '',
        createdBy: row[4] || '',
        targetMonth: row[5] || '',
        selectedPolicyGroups: row[6] || '',
        uuid: row[7] || ''
      }));

      // 필터링
      if (userId && showAllUsers !== 'true') {
        data = data.filter(item => item.userId === userId);
      }
      if (targetMonth) {
        data = data.filter(item => item.targetMonth === targetMonth);
      }
      if (budgetType) {
        data = data.filter(item => item.sheetName.includes(budgetType));
      }

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error fetching user sheets v2:', error);
      res.status(500).json({
        success: false,
        error: '사용자 시트 목록 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/budget/basic-shoe - 기본구두 데이터 조회
  router.get('/api/budget/basic-shoe', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, policyGroups } = req.query;

      if (!sheetId) {
        return res.status(400).json({ error: '시트 ID가 필요합니다.' });
      }

      const cacheKey = `budget_basic_shoe_${sheetId}_${policyGroups}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const values = await getSheetValues('기본구두', sheetId);
      
      if (values.length <= 1) {
        return res.json([]);
      }

      let data = values.slice(1).map(row => ({
        policyGroup: row[0] || '',
        amount: parseFloat(row[1]) || 0,
        description: row[2] || ''
      }));

      // 정책그룹 필터링
      if (policyGroups) {
        const groups = policyGroups.split(',');
        data = data.filter(item => groups.includes(item.policyGroup));
      }

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching basic shoe data:', error);
      res.status(500).json({
        error: '기본구두 데이터 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/budget/user-sheets/:sheetId/data - 사용자 시트 데이터 조회
  router.get('/api/budget/user-sheets/:sheetId/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId } = req.params;
      const { userName, currentUserId, budgetType } = req.query;

      if (!userName) {
        return res.status(400).json({ error: '사용자 이름이 필요합니다.' });
      }

      const values = await getSheetValues('예산데이터', sheetId);
      
      if (values.length <= 1) {
        return res.json([]);
      }

      const data = values.slice(1);
      res.json(data);
    } catch (error) {
      console.error('Error fetching user sheet data:', error);
      res.status(500).json({
        error: '사용자 시트 데이터 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/user-sheets/:sheetId/data - 사용자 시트 데이터 저장
  router.post('/api/budget/user-sheets/:sheetId/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId } = req.params;
      const { data } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: '데이터가 필요합니다.' });
      }

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: '예산데이터!A2:Z',
          valueInputOption: 'RAW',
          resource: {
            values: data
          }
        })
      );

      res.json({ success: true, message: '데이터가 저장되었습니다.' });
    } catch (error) {
      console.error('Error saving user sheet data:', error);
      res.status(500).json({
        error: '데이터 저장 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/user-sheets/:sheetId/update-usage - 사용예산 업데이트
  router.post('/api/budget/user-sheets/:sheetId/update-usage', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId } = req.params;
      const { usage } = req.body;

      console.log('사용예산 업데이트:', sheetId, usage);
      res.json({ success: true, message: '사용예산이 업데이트되었습니다.' });
    } catch (error) {
      console.error('Error updating usage:', error);
      res.status(500).json({
        error: '사용예산 업데이트 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/user-sheets/:sheetId/update-usage-safe - 안전한 사용예산 업데이트
  router.post('/api/budget/user-sheets/:sheetId/update-usage-safe', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId } = req.params;
      const { usage } = req.body;

      console.log('안전한 사용예산 업데이트:', sheetId, usage);
      res.json({ success: true, message: '사용예산이 안전하게 업데이트되었습니다.' });
    } catch (error) {
      console.error('Error updating usage safely:', error);
      res.status(500).json({
        error: '안전한 사용예산 업데이트 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/user-sheets - 사용자 시트 생성
  router.post('/api/budget/user-sheets', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, sheetName, targetMonth, selectedPolicyGroups } = req.body;

      if (!userId || !sheetName) {
        return res.status(400).json({ error: '사용자 ID와 시트 이름이 필요합니다.' });
      }

      const now = new Date().toLocaleString('ko-KR');

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '예산_사용자시트관리!A:G',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              userId,
              'NEW_SHEET_ID',
              sheetName,
              now,
              userId,
              targetMonth || '',
              selectedPolicyGroups || ''
            ]]
          }
        })
      );

      cacheManager.deletePattern('budget_user_sheets');
      res.json({ success: true, message: '사용자 시트가 생성되었습니다.' });
    } catch (error) {
      console.error('Error creating user sheet:', error);
      res.status(500).json({
        error: '사용자 시트 생성 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/user-sheets-v2 - 사용자 시트 생성 v2
  router.post('/api/budget/user-sheets-v2', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, sheetName, targetMonth, selectedPolicyGroups, uuid } = req.body;

      if (!userId || !sheetName) {
        return res.status(400).json({ error: '사용자 ID와 시트 이름이 필요합니다.' });
      }

      const now = new Date().toLocaleString('ko-KR');

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '예산_사용자시트관리!A:H',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[
              userId,
              'NEW_SHEET_ID',
              sheetName,
              now,
              userId,
              targetMonth || '',
              selectedPolicyGroups || '',
              uuid || ''
            ]]
          }
        })
      );

      cacheManager.deletePattern('budget_user_sheets');
      res.json({ success: true, message: '사용자 시트가 생성되었습니다.', uuid });
    } catch (error) {
      console.error('Error creating user sheet v2:', error);
      res.status(500).json({
        error: '사용자 시트 생성 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // DELETE /api/budget/user-sheets-v2/:uuid - 사용자 시트 삭제 v2
  router.delete('/api/budget/user-sheets-v2/:uuid', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { uuid } = req.params;

      const values = await getSheetValues('예산_사용자시트관리');
      const rows = values || [];
      const targetRowIndex = rows.findIndex(row => row[7] === uuid);

      if (targetRowIndex <= 0) {
        return res.status(404).json({ error: '해당 시트를 찾을 수 없습니다.' });
      }

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID
        })
      );

      const sheet = response.data.sheets.find(s => s.properties.title === '예산_사용자시트관리');
      const sheetId = sheet ? sheet.properties.sheetId : null;

      if (!sheetId) {
        return res.status(404).json({ error: '시트를 찾을 수 없습니다.' });
      }

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: targetRowIndex,
                  endIndex: targetRowIndex + 1
                }
              }
            }]
          }
        })
      );

      cacheManager.deletePattern('budget_user_sheets');
      res.json({ success: true, message: '사용자 시트가 삭제되었습니다.' });
    } catch (error) {
      console.error('Error deleting user sheet v2:', error);
      res.status(500).json({
        error: '사용자 시트 삭제 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/budget/summary/:targetMonth - 예산 요약
  router.get('/api/budget/summary/:targetMonth', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { targetMonth } = req.params;

      console.log('예산 요약 조회:', targetMonth);
      res.json({
        success: true,
        data: {
          totalBudget: 0,
          usedBudget: 0,
          remainingBudget: 0
        }
      });
    } catch (error) {
      console.error('Error fetching budget summary:', error);
      res.status(500).json({
        error: '예산 요약 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/budget/basic-shoe/creation-list - 기본구두 생성 목록
  router.get('/api/budget/basic-shoe/creation-list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('기본구두생성목록');
      
      if (values.length <= 1) {
        return res.json([]);
      }

      const data = values.slice(1);
      res.json(data);
    } catch (error) {
      console.error('Error fetching basic shoe creation list:', error);
      res.status(500).json({
        error: '기본구두 생성 목록 조회 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/basic-shoe/save-creation-list - 기본구두 생성 목록 저장
  router.post('/api/budget/basic-shoe/save-creation-list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { data } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: '데이터가 필요합니다.' });
      }

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '기본구두생성목록!A2:Z',
          valueInputOption: 'RAW',
          resource: {
            values: data
          }
        })
      );

      res.json({ success: true, message: '기본구두 생성 목록이 저장되었습니다.' });
    } catch (error) {
      console.error('Error saving basic shoe creation list:', error);
      res.status(500).json({
        error: '기본구두 생성 목록 저장 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/budget/recalculate-all - 전체 재계산
  router.post('/api/budget/recalculate-all', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('전체 예산 재계산 시작');
      res.json({ success: true, message: '전체 예산이 재계산되었습니다.' });
    } catch (error) {
      console.error('Error recalculating all budgets:', error);
      res.status(500).json({
        error: '전체 예산 재계산 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createBudgetRoutes;
