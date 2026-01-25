/**
 * Member Routes
 * 
 * 고객(회원) 관련 엔드포인트를 제공합니다.
 * - 고객 로그인
 * - 구매 대기 목록 관리 (CRUD)
 * - 게시판 관리 (CRUD)
 * 
 * Endpoints:
 * - POST /api/member/login - 고객 로그인
 * - GET /api/member/queue/all - 모든 구매 대기 목록 조회
 * - GET /api/member/queue - 고객별 구매 대기 목록 조회
 * - POST /api/member/queue - 구매 대기 등록
 * - PUT /api/member/queue/:id - 구매 대기 수정
 * - DELETE /api/member/queue/:id - 구매 대기 삭제
 * - GET /api/member/board - 게시판 목록 조회
 * - GET /api/member/board/:id - 게시판 상세 조회
 * - POST /api/member/board - 게시판 글 작성
 * - PUT /api/member/board/:id - 게시판 글 수정
 * - DELETE /api/member/board/:id - 게시판 글 삭제
 * 
 * Requirements: 1.1, 1.2, 7.14
 */

const express = require('express');

/**
 * Member Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createMemberRoutes(context) {
  const router = express.Router();
  const { sheetsClient, rateLimiter } = context;

  // 시트 이름 상수
  const MEMBER_SHEET_NAME = '고객정보';
  const QUEUE_SHEET_NAME = '구매대기';
  const BOARD_SHEET_NAME = '게시판';

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

  // POST /api/member/login - 고객 로그인
  router.post('/api/member/login', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { ctn, password } = req.body;

      if (!ctn || !password) {
        return res.status(400).json({
          success: false,
          error: 'CTN과 비밀번호가 필요합니다.'
        });
      }

      const memberValues = await getSheetValues(MEMBER_SHEET_NAME);
      const memberRows = memberValues.slice(1);

      const member = memberRows.find(row => {
        const rowCtn = (row[0] || '').toString().trim();
        const rowPassword = (row[1] || '').toString().trim();
        return rowCtn === ctn && rowPassword === password;
      });

      if (!member) {
        return res.status(401).json({
          success: false,
          error: '로그인 정보가 일치하지 않습니다.'
        });
      }

      res.json({
        success: true,
        ctn,
        name: member[2] || '',
        message: '로그인 성공'
      });
    } catch (error) {
      console.error('Error during member login:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process login',
        message: error.message
      });
    }
  });

  // GET /api/member/queue/all - 모든 구매 대기 목록 조회
  router.get('/api/member/queue/all', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { posCode } = req.query;

      const queueValues = await getSheetValues(QUEUE_SHEET_NAME);
      const queueRows = queueValues.slice(1);

      let queueList = queueRows.map((row, index) => ({
        id: index + 1,
        ctn: row[0] || '',
        name: row[1] || '',
        model: row[2] || '',
        color: row[3] || '',
        posCode: row[4] || '',
        storeName: row[5] || '',
        status: row[6] || '대기',
        createdAt: row[7] || '',
        memo: row[8] || ''
      }));

      // POS코드 필터링
      if (posCode) {
        queueList = queueList.filter(item => item.posCode === posCode);
      }

      res.json({
        success: true,
        data: queueList
      });
    } catch (error) {
      console.error('Error fetching queue list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch queue list',
        message: error.message
      });
    }
  });

  // GET /api/member/queue - 고객별 구매 대기 목록 조회
  router.get('/api/member/queue', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { ctn } = req.query;
      if (!ctn) {
        return res.status(400).json({ error: 'CTN이 필요합니다.' });
      }

      const queueValues = await getSheetValues(QUEUE_SHEET_NAME);
      const queueRows = queueValues.slice(1);

      const queueList = queueRows
        .filter(row => (row[0] || '').toString().trim() === ctn)
        .map((row, index) => ({
          id: index + 1,
          ctn: row[0] || '',
          name: row[1] || '',
          model: row[2] || '',
          color: row[3] || '',
          posCode: row[4] || '',
          storeName: row[5] || '',
          status: row[6] || '대기',
          createdAt: row[7] || '',
          memo: row[8] || ''
        }));

      res.json({
        success: true,
        data: queueList
      });
    } catch (error) {
      console.error('Error fetching member queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch member queue',
        message: error.message
      });
    }
  });

  // POST /api/member/queue - 구매 대기 등록
  router.post('/api/member/queue', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const data = req.body;
      const now = new Date().toLocaleString('ko-KR');

      const newRow = [
        data.ctn || '',
        data.name || '',
        data.model || '',
        data.color || '',
        data.posCode || '',
        data.storeName || '',
        '대기',
        now,
        data.memo || ''
      ];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A:I`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      res.json({
        success: true,
        message: '구매 대기가 등록되었습니다.'
      });
    } catch (error) {
      console.error('Error creating queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create queue',
        message: error.message
      });
    }
  });

  // PUT /api/member/queue/:id - 구매 대기 수정
  router.put('/api/member/queue/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const data = req.body;

      const rowIndex = parseInt(id) + 1; // 헤더 포함

      const updatedRow = [
        data.ctn || '',
        data.name || '',
        data.model || '',
        data.color || '',
        data.posCode || '',
        data.storeName || '',
        data.status || '대기',
        data.createdAt || '',
        data.memo || ''
      ];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A${rowIndex}:I${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [updatedRow]
          }
        })
      );

      res.json({
        success: true,
        message: '구매 대기가 수정되었습니다.'
      });
    } catch (error) {
      console.error('Error updating queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update queue',
        message: error.message
      });
    }
  });

  // DELETE /api/member/queue/:id - 구매 대기 삭제
  router.delete('/api/member/queue/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const rowIndex = parseInt(id) + 1;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex
                }
              }
            }]
          }
        })
      );

      res.json({
        success: true,
        message: '구매 대기가 삭제되었습니다.'
      });
    } catch (error) {
      console.error('Error deleting queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete queue',
        message: error.message
      });
    }
  });

  // GET /api/member/board - 게시판 목록 조회
  router.get('/api/member/board', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { storeName, posCode } = req.query;

      const boardValues = await getSheetValues(BOARD_SHEET_NAME);
      const boardRows = boardValues.slice(1);

      let boardList = boardRows.map((row, index) => ({
        id: index + 1,
        title: row[0] || '',
        content: row[1] || '',
        author: row[2] || '',
        storeName: row[3] || '',
        posCode: row[4] || '',
        createdAt: row[5] || '',
        views: parseInt(row[6]) || 0
      }));

      // 필터링
      if (storeName) {
        boardList = boardList.filter(item => item.storeName === storeName);
      }
      if (posCode) {
        boardList = boardList.filter(item => item.posCode === posCode);
      }

      res.json({
        success: true,
        data: boardList
      });
    } catch (error) {
      console.error('Error fetching board list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch board list',
        message: error.message
      });
    }
  });

  // GET /api/member/board/:id - 게시판 상세 조회
  router.get('/api/member/board/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const rowIndex = parseInt(id) + 1;

      const boardValues = await getSheetValues(BOARD_SHEET_NAME);
      const row = boardValues[rowIndex];

      if (!row) {
        return res.status(404).json({
          success: false,
          error: '게시글을 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: {
          id: parseInt(id),
          title: row[0] || '',
          content: row[1] || '',
          author: row[2] || '',
          storeName: row[3] || '',
          posCode: row[4] || '',
          createdAt: row[5] || '',
          views: parseInt(row[6]) || 0
        }
      });
    } catch (error) {
      console.error('Error fetching board detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch board detail',
        message: error.message
      });
    }
  });

  // POST /api/member/board - 게시판 글 작성
  router.post('/api/member/board', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const data = req.body;
      const now = new Date().toLocaleString('ko-KR');

      const newRow = [
        data.title || '',
        data.content || '',
        data.author || '',
        data.storeName || '',
        data.posCode || '',
        now,
        0 // 조회수
      ];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${BOARD_SHEET_NAME}!A:G`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      res.json({
        success: true,
        message: '게시글이 작성되었습니다.'
      });
    } catch (error) {
      console.error('Error creating board post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create board post',
        message: error.message
      });
    }
  });

  // PUT /api/member/board/:id - 게시판 글 수정
  router.put('/api/member/board/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const data = req.body;
      const rowIndex = parseInt(id) + 1;

      const updatedRow = [
        data.title || '',
        data.content || '',
        data.author || '',
        data.storeName || '',
        data.posCode || '',
        data.createdAt || '',
        data.views || 0
      ];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${BOARD_SHEET_NAME}!A${rowIndex}:G${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [updatedRow]
          }
        })
      );

      res.json({
        success: true,
        message: '게시글이 수정되었습니다.'
      });
    } catch (error) {
      console.error('Error updating board post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update board post',
        message: error.message
      });
    }
  });

  // DELETE /api/member/board/:id - 게시판 글 삭제
  router.delete('/api/member/board/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const rowIndex = parseInt(id) + 1;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex
                }
              }
            }]
          }
        })
      );

      res.json({
        success: true,
        message: '게시글이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('Error deleting board post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete board post',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createMemberRoutes;
