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
