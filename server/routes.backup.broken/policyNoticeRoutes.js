/**
 * Policy Notice Routes
 * 
 * 정책 공지사항 관련 엔드포인트를 제공합니다.
 * - 정책 공지사항 CRUD
 * - 연월 및 카테고리 필터링
 * 
 * Endpoints:
 * - GET /api/policy-notices - 공지사항 목록
 * - POST /api/policy-notices - 공지사항 생성
 * - PUT /api/policy-notices/:id - 공지사항 수정
 * - DELETE /api/policy-notices/:id - 공지사항 삭제
 * 
 * Requirements: 1.1, 1.2, 7.19
 */

const express = require('express');
const router = express.Router();

/**
 * Policy Notice Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createPolicyNoticeRoutes(context) {
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

  // GET /api/policy-notices - 공지사항 목록 조회
  router.get('/api/policy-notices', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { yearMonth, category } = req.query;

      console.log('📋 [정책공지] 공지사항 목록 조회 시작', { yearMonth, category });

      // 캐시 키 생성
      const cacheKey = `policy_notices_${yearMonth || 'all'}_${category || 'all'}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 정책공지 목록 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('정책공지사항');
      const headers = values[0] || [];
      const rows = values.slice(1);

      let noticeList = rows.map((row, index) => {
        const notice = {};
        headers.forEach((header, i) => {
          notice[header] = row[i] || '';
        });
        notice.id = index + 2; // 헤더 포함
        return notice;
      });

      // 필터링
      if (yearMonth) {
        noticeList = noticeList.filter(notice => notice['연월'] === yearMonth);
      }
      if (category) {
        noticeList = noticeList.filter(notice => notice['카테고리'] === category);
      }

      // 최신순 정렬
      noticeList.sort((a, b) => {
        const dateA = new Date(a['작성일'] || 0);
        const dateB = new Date(b['작성일'] || 0);
        return dateB - dateA;
      });

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, noticeList, 5 * 60 * 1000);

      res.json({
        success: true,
        data: noticeList
      });
    } catch (error) {
      console.error('Error fetching policy notices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch policy notices',
        message: error.message
      });
    }
  });

  // POST /api/policy-notices - 공지사항 생성
  router.post('/api/policy-notices', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { yearMonth, category, title, content, author, note } = req.body;

      if (!yearMonth || !category || !title || !content) {
        return res.status(400).json({
          success: false,
          error: '연월, 카테고리, 제목, 내용이 필요합니다.'
        });
      }

      console.log('➕ [정책공지] 공지사항 생성 시작');

      const now = new Date().toLocaleString('ko-KR');

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책공지사항!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const newRow = headers.map(header => {
        if (header === '연월') return yearMonth;
        if (header === '카테고리') return category;
        if (header === '제목') return title;
        if (header === '내용') return content;
        if (header === '작성자') return author || '';
        if (header === '작성일') return now;
        if (header === '비고') return note || '';
        return '';
      });

      // 추가
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책공지사항!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('policy_notices_');

      res.json({
        success: true,
        message: '공지사항이 생성되었습니다.'
      });
    } catch (error) {
      console.error('Error creating policy notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create policy notice',
        message: error.message
      });
    }
  });

  // PUT /api/policy-notices/:id - 공지사항 수정
  router.put('/api/policy-notices/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const { yearMonth, category, title, content, author, note } = req.body;

      console.log(`✏️ [정책공지] 공지사항 수정: ID ${id}`);

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책공지사항!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 기존 데이터 가져오기
      const existingResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `정책공지사항!A${id}:Z${id}`
        })
      );
      const existingRow = existingResponse.data.values?.[0] || [];

      // 데이터 배열 생성 (기존 값 유지)
      const updatedRow = headers.map((header, i) => {
        if (header === '연월' && yearMonth !== undefined) return yearMonth;
        if (header === '카테고리' && category !== undefined) return category;
        if (header === '제목' && title !== undefined) return title;
        if (header === '내용' && content !== undefined) return content;
        if (header === '작성자' && author !== undefined) return author;
        if (header === '비고' && note !== undefined) return note;
        return existingRow[i] || '';
      });

      // 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `정책공지사항!A${id}:Z${id}`,
          valueInputOption: 'RAW',
          resource: {
            values: [updatedRow]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('policy_notices_');

      res.json({
        success: true,
        message: '공지사항이 수정되었습니다.'
      });
    } catch (error) {
      console.error('Error updating policy notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update policy notice',
        message: error.message
      });
    }
  });

  // DELETE /api/policy-notices/:id - 공지사항 삭제
  router.delete('/api/policy-notices/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;

      console.log(`🗑️ [정책공지] 공지사항 삭제: ID ${id}`);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: parseInt(id) - 1,
                  endIndex: parseInt(id)
                }
              }
            }]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('policy_notices_');

      res.json({
        success: true,
        message: '공지사항이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('Error deleting policy notice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete policy notice',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createPolicyNoticeRoutes;
