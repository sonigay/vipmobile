/**
 * Policy Routes
 * 정책 관리 관련 API 엔드포인트
 */

module.exports = function createPolicyRoutes(context) {
  const express = require('express');
  const router = express.Router();
  
  const { sheetsClient, cacheManager, rateLimiter } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // 카테고리 관리 API
  router.get('/policy-categories', async (req, res) => {
    try {
      console.log('카테고리 목록 조회 요청');
      
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '정책카테고리!A:E'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ categories: [] });
      }

      const headers = rows[0];
      const categories = rows.slice(1).map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        policyType: row[2] || '',
        icon: row[3] || '',
        sortOrder: parseInt(row[4]) || 0
      }));

      res.json({ categories });
    } catch (error) {
      console.error('카테고리 목록 조회 실패:', error);
      res.status(500).json({ error: '카테고리 목록 조회 실패' });
    }
  });

  // 카테고리 추가 API
  router.post('/policy-categories', async (req, res) => {
    try {
      const { name, policyType, icon, sortOrder } = req.body;
      
      const id = `CAT_${Date.now()}`;
      const newRow = [id, name, policyType, icon, sortOrder];

      await rateLimiter.execute(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: '정책카테고리!A:E',
          valueInputOption: 'RAW',
          resource: { values: [newRow] }
        })
      );

      res.json({ success: true, category: { id, name, policyType, icon, sortOrder } });
    } catch (error) {
      console.error('카테고리 추가 실패:', error);
      res.status(500).json({ error: '카테고리 추가 실패' });
    }
  });

  // 정책 목록 조회 API
  router.get('/policies', async (req, res) => {
    try {
      const { yearMonth, policyType } = req.query;
      
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '정책목록!A:Z'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ policies: [] });
      }

      let policies = rows.slice(1).map((row, index) => ({
        id: row[0] || `POL_${index}`,
        yearMonth: row[1] || '',
        policyType: row[2] || '',
        category: row[3] || '',
        title: row[4] || '',
        content: row[5] || '',
        createdAt: row[6] || '',
        createdBy: row[7] || ''
      }));

      // 필터링
      if (yearMonth) {
        policies = policies.filter(p => p.yearMonth === yearMonth);
      }
      if (policyType) {
        policies = policies.filter(p => p.policyType === policyType);
      }

      res.json({ policies });
    } catch (error) {
      console.error('정책 목록 조회 실패:', error);
      res.status(500).json({ error: '정책 목록 조회 실패' });
    }
  });

  return router;
};

  // GET /api/policies/:policyId - 정책 상세 조회
  router.get('/policies/:policyId', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      const values = await getSheetValues('정책목록');
      const policy = values.slice(1).find(row => row[0] === policyId);

      if (!policy) {
        return res.status(404).json({ error: '정책을 찾을 수 없습니다.' });
      }

      res.json(policy);
    } catch (error) {
      console.error('Error fetching policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/policies/:policyId/approve - 정책 승인
  router.post('/policies/:policyId/approve', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      const { approver } = req.body;

      console.log('정책 승인:', policyId, approver);

      // 승인 처리 로직
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책승인이력!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [[policyId, approver, new Date().toISOString(), '승인']] }
        })
      );

      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error approving policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/policies/:policyId/approval-cancel - 정책 승인 취소
  router.post('/policies/:policyId/approval-cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      const { canceller } = req.body;

      console.log('정책 승인 취소:', policyId, canceller);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책승인이력!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [[policyId, canceller, new Date().toISOString(), '승인취소']] }
        })
      );

      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error cancelling approval:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/policies/:policyId/cancel - 정책 취소
  router.post('/policies/:policyId/cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      const { canceller } = req.body;

      console.log('정책 취소:', policyId, canceller);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책취소이력!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [[policyId, canceller, new Date().toISOString()]] }
        })
      );

      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error cancelling policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/policies/:policyId/settlement-reflect - 정산 반영
  router.post('/policies/:policyId/settlement-reflect', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      const { reflector } = req.body;

      console.log('정산 반영:', policyId, reflector);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정산반영이력!A:Z',
          valueInputOption: 'RAW',
          resource: { values: [[policyId, reflector, new Date().toISOString()]] }
        })
      );

      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error reflecting settlement:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/policies/shoe-counting - 구두 집계
  router.get('/policies/shoe-counting', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'policies_shoe_counting';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('구두집계');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching shoe counting:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/policies-delete/:policyId - 정책 삭제
  router.delete('/policies-delete/:policyId', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      console.log('정책 삭제:', policyId);

      // 삭제 로직 구현 필요
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/policies - 정책 목록 조회
  router.get('/policies', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const cacheKey = 'policies_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('정책목록');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching policies:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/policies - 정책 생성
  router.post('/policies', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책목록!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error creating policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/policies/:policyId - 정책 수정
  router.put('/policies/:policyId', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;
      const { data } = req.body;

      console.log('정책 수정:', policyId, data);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/policies/:policyId - 정책 삭제
  router.delete('/policies/:policyId', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      console.log('정책 삭제:', policyId);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/policies/:policyId/approve - 정책 승인
  router.put('/policies/:policyId/approve', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      console.log('정책 승인:', policyId);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error approving policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/policies/:policyId/approval-cancel - 정책 승인 취소
  router.put('/policies/:policyId/approval-cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      console.log('정책 승인 취소:', policyId);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error canceling policy approval:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/policies/:policyId/cancel - 정책 취소
  router.put('/policies/:policyId/cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      console.log('정책 취소:', policyId);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error canceling policy:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/policies/:policyId/settlement-reflect - 정책 정산 반영
  router.put('/policies/:policyId/settlement-reflect', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { policyId } = req.params;

      console.log('정책 정산 반영:', policyId);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error reflecting policy settlement:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/policy/notices - 정책 공지사항 목록
  router.get('/policy/notices', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      
      const values = await getSheetValues('정책공지사항');
      res.json(values.slice(1));
    } catch (error) {
      console.error('Error fetching policy notices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/policy/notices - 정책 공지사항 생성
  router.post('/policy/notices', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책공지사항!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [data] }
        })
      );

      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error creating policy notice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/policy/notices/:id - 정책 공지사항 수정
  router.put('/policy/notices/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;
      const { data } = req.body;

      console.log('정책 공지사항 수정:', id, data);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating policy notice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/policy/notices/:id - 정책 공지사항 삭제
  router.delete('/policy/notices/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { id } = req.params;

      console.log('정책 공지사항 삭제:', id);
      cacheManager.deletePattern('policy');
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting policy notice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/monthly-award/settings - 월간 시상 설정 저장
  router.post('/monthly-award/settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { settings } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '월간시상설정!A2:Z',
          valueInputOption: 'RAW',
          resource: { values: settings }
        })
      );

      cacheManager.deletePattern('monthly_award');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving monthly award settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/model-normalization - 모델 정규화 저장
  router.post('/model-normalization', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '모델정규화!A2:Z',
          valueInputOption: 'RAW',
          resource: { values: data }
        })
      );

      cacheManager.deletePattern('model');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving model normalization:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/marker-color-settings - 마커 색상 설정 저장
  router.post('/marker-color-settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { settings } = req.body;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '마커색상설정!A2:Z',
          valueInputOption: 'RAW',
          resource: { values: settings }
        })
      );

      cacheManager.deletePattern('marker');
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving marker color settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createPolicyRoutes;
