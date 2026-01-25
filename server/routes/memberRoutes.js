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
  const QUEUE_SHEET_NAME = '직영점_구매대기';
  const BOARD_SHEET_NAME = '직영점_게시판';

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
      if (!queueValues || queueValues.length <= 1) return res.json([]);

      const rows = queueValues.slice(1);

      // POS코드 필터링이 필요한 경우, 폰클출고처데이터에서 매장명->POS코드 매핑 생성
      let storeNameToPosCodeMap = null;
      if (posCode) {
        try {
          const storeValues = await getSheetValues('폰클출고처데이터');
          storeNameToPosCodeMap = new Map();
          if (storeValues && storeValues.length > 1) {
            storeValues.slice(1).forEach(row => {
              if (row && row.length > 15) {
                const storeName = (row[14] || '').toString().trim();
                const storePosCode = (row[15] || '').toString().trim();
                if (storeName && storePosCode) {
                  storeNameToPosCodeMap.set(storeName, storePosCode);
                }
              }
            });
          }
        } catch (err) {
          console.error('폰클출고처데이터 조회 오류:', err);
        }
      }

      let filteredRows = rows;
      if (posCode && storeNameToPosCodeMap) {
        filteredRows = rows.filter(row => {
          const storeName = (row[22] || '').toString().trim();
          const itemPosCode = storeNameToPosCodeMap.get(storeName);
          return itemPosCode === posCode;
        });
      }

      const queue = filteredRows
        .filter(row => (row[27] || '').toString().trim() !== '삭제됨')
        .map(row => ({
          id: row[0],
          ctn: row[1],
          name: row[2],
          carrier: row[3],
          model: row[4],
          color: row[5],
          deviceSerial: row[6],
          usimModel: row[7],
          usimSerial: row[8],
          activationType: row[9],
          oldCarrier: row[10],
          installmentType: row[11],
          installmentMonths: row[12],
          contractType: row[13],
          plan: row[14],
          additionalServices: row[15],
          factoryPrice: row[16],
          carrierSupport: row[17],
          dealerSupportWithAdd: row[18],
          dealerSupportWithoutAdd: row[19],
          installmentPrincipal: Number(row[20] || 0),
          할부원금: Number(row[20] || 0),
          lgPremier: (row[21] || '') === 'Y',
          프리미어약정: (row[21] || '') === 'Y',
          storeName: row[22],
          storePhone: row[23],
          storeAddress: row[24],
          storeBankInfo: row[25],
          createdAt: row[26],
          status: row[27],
          processedBy: row[28],
          processedAt: row[29],
          ip: row[30],
          deviceInfo: row[31],
          isAnonymous: row[32] === 'Y'
        }));

      // 최신순 정렬
      queue.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      res.json(queue);
    } catch (error) {
      console.error('Error fetching queue list:', error);
      res.status(500).json({ error: '목록을 불러오는데 실패했습니다.' });
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

      const cleanCtn = ctn.replace(/[^0-9]/g, '');

      const queueValues = await getSheetValues(QUEUE_SHEET_NAME);
      if (!queueValues || queueValues.length <= 1) return res.json([]);

      const rows = queueValues.slice(1);
      const queue = rows
        .filter(row => {
          const rowCtn = (row[1] || '').replace(/[^0-9]/g, '');
          return rowCtn === cleanCtn;
        })
        .map(row => ({
          id: row[0],
          ctn: row[1],
          name: row[2],
          carrier: row[3],
          model: row[4],
          color: row[5],
          deviceSerial: row[6],
          usimModel: row[7],
          usimSerial: row[8],
          activationType: row[9],
          oldCarrier: row[10],
          installmentType: row[11],
          installmentMonths: row[12],
          contractType: row[13],
          plan: row[14],
          additionalServices: row[15],
          factoryPrice: row[16],
          carrierSupport: row[17],
          dealerSupport: row[18],
          대리점추가지원금: row[18],
          additionalStoreSupport: row[19],
          대리점추가지원금직접입력: row[19],
          installmentPrincipal: Number(row[20] || 0),
          할부원금: Number(row[20] || 0),
          lgPremier: (row[21] || '') === 'Y',
          프리미어약정: (row[21] || '') === 'Y',
          dealerSupportWithAdd: row[18],
          dealerSupportWithoutAdd: row[19],
          storeName: row[22],
          storePhone: row[23],
          storeAddress: row[24],
          storeBankInfo: row[25],
          createdAt: row[26],
          status: row[27],
          processedBy: row[28],
          processedAt: row[29],
          ip: row[30],
          deviceInfo: row[31],
          isAnonymous: row[32] === 'Y'
        }));

      res.json(queue);
    } catch (error) {
      console.error('Error fetching member queue:', error);
      res.status(500).json({ error: '목록을 불러오는데 실패했습니다.' });
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
      if (!boardValues || boardValues.length <= 1) return res.json([]);

      const rows = boardValues.slice(1);

      // POS코드 필터링이 필요한 경우, 폰클출고처데이터에서 매장명->POS코드 매핑 생성
      let storeNameToPosCodeMap = null;
      if (posCode) {
        try {
          const storeValues = await getSheetValues('폰클출고처데이터');
          storeNameToPosCodeMap = new Map();
          if (storeValues && storeValues.length > 1) {
            storeValues.slice(1).forEach(row => {
              if (row && row.length > 15) {
                const storeNameFromData = (row[14] || '').toString().trim();
                const storePosCode = (row[15] || '').toString().trim();
                if (storeNameFromData && storePosCode) {
                  storeNameToPosCodeMap.set(storeNameFromData, storePosCode);
                }
              }
            });
          }
        } catch (err) {
          console.error('매장 데이터 조회 오류:', err);
        }
      }

      let queue = rows
        .filter(row => {
          // 삭제된 항목 제외
          const status = (row[11] || '').toString().trim();
          if (status === '삭제됨') return false;

          // 매장명 필터링
          if (storeName) {
            const rowStoreName = (row[6] || '').toString().trim();
            return rowStoreName === storeName;
          }

          // POS코드 필터링
          if (posCode && storeNameToPosCodeMap) {
            const rowStoreName = (row[6] || '').toString().trim();
            const itemPosCode = storeNameToPosCodeMap.get(rowStoreName);
            return itemPosCode === posCode;
          }

          return true;
        })
        .map(row => ({
          id: row[0],
          category: row[1] || '',
          title: row[2] || '',
          content: row[3] || '',
          customerName: row[4] || '',
          customerCtn: row[5] || '',
          storeName: row[6] || '',
          storePhone: row[7] || '',
          storeAddress: row[8] || '',
          createdAt: row[9] || '',
          updatedAt: row[10] || '',
          status: row[11] || '활성'
        }));

      // 최신순 정렬
      queue.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      res.json(queue);
    } catch (error) {
      console.error('Error fetching board list:', error);
      res.status(500).json({ error: '목록을 불러오는데 실패했습니다.' });
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
