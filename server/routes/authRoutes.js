/**
 * Auth Routes
 * 
 * 인증 및 로그인 관련 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - POST /api/login - 로그인 검증
 * - POST /api/verify-password - 비밀번호 검증
 * - POST /api/verify-direct-store-password - 직영점 비밀번호 검증
 * 
 * Requirements: 1.1, 1.2, 7.13
 */

const express = require('express');
const router = express.Router();

/**
 * Auth Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createAuthRoutes(context) {
  const { sheetsClient, rateLimiter } = context;

  // 시트 이름 상수
  const AGENT_SHEET_NAME = '대리점아이디관리';
  const STORE_SHEET_NAME = '폰클출고처데이터';

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
  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A:AF`
      })
    );
    
    return response.data.values || [];
  }

  // POST /api/login - 로그인 검증
  router.post('/api/login', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { storeId, deviceInfo, ipAddress, location } = req.body;

      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: '매장 ID가 필요합니다.'
        });
      }

      // 매장 정보 조회
      const storeValues = await getSheetValues(STORE_SHEET_NAME);
      
      if (!storeValues) {
        throw new Error('Failed to fetch store data');
      }

      const storeRows = storeValues.slice(1);
      const storeRow = storeRows.find(row => {
        const rowStoreId = (row[15] || '').toString().trim(); // H열: 매장 ID
        return rowStoreId === storeId;
      });

      if (!storeRow) {
        return res.status(404).json({
          success: false,
          error: '매장을 찾을 수 없습니다.'
        });
      }

      const storeName = (storeRow[14] || '').toString().trim(); // G열: 업체명
      const status = storeRow[12]; // M열: 거래상태

      if (status !== '사용') {
        return res.status(403).json({
          success: false,
          error: '사용 중지된 매장입니다.'
        });
      }

      // 로그인 이력 기록 (선택적)
      const now = new Date().toLocaleString('ko-KR');
      console.log(`✅ [로그인] ${storeName} (${storeId}) - ${now}`);

      res.json({
        success: true,
        storeId,
        storeName,
        message: '로그인 성공'
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process login',
        message: error.message
      });
    }
  });

  // POST /api/verify-password - 비밀번호 검증
  router.post('/api/verify-password', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, password } = req.body;

      if (!userId || !password) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID와 비밀번호가 필요합니다.'
        });
      }

      // 대리점 정보 조회
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      
      if (!agentValues) {
        throw new Error('Failed to fetch agent data');
      }

      const agentRows = agentValues.slice(3); // 헤더 3행 제외
      const agentRow = agentRows.find(row => {
        const rowUserId = (row[2] || '').toString().trim(); // C열: 연락처(아이디)
        return rowUserId === userId;
      });

      if (!agentRow) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      const storedPassword = (agentRow[4] || '').toString().trim(); // E열: 패스워드
      const passwordNotUsed = agentRow[3]; // D열: 패스워드 미사용

      // 패스워드 미사용 체크박스가 체크되어 있으면 비밀번호 검증 스킵
      if (passwordNotUsed === 'TRUE' || passwordNotUsed === true) {
        return res.json({
          success: true,
          message: '비밀번호 검증 성공 (패스워드 미사용)'
        });
      }

      // 비밀번호 검증
      if (storedPassword !== password) {
        return res.status(401).json({
          success: false,
          error: '비밀번호가 일치하지 않습니다.'
        });
      }

      res.json({
        success: true,
        message: '비밀번호 검증 성공'
      });
    } catch (error) {
      console.error('Error verifying password:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify password',
        message: error.message
      });
    }
  });

  // POST /api/verify-direct-store-password - 직영점 비밀번호 검증
  router.post('/api/verify-direct-store-password', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { storeId, password } = req.body;

      if (!storeId || !password) {
        return res.status(400).json({
          success: false,
          error: '매장 ID와 비밀번호가 필요합니다.'
        });
      }

      // 매장 정보 조회
      const storeValues = await getSheetValues(STORE_SHEET_NAME);
      
      if (!storeValues) {
        throw new Error('Failed to fetch store data');
      }

      const storeRows = storeValues.slice(1);
      const storeRow = storeRows.find(row => {
        const rowStoreId = (row[15] || '').toString().trim(); // H열: 매장 ID
        return rowStoreId === storeId;
      });

      if (!storeRow) {
        return res.status(404).json({
          success: false,
          error: '매장을 찾을 수 없습니다.'
        });
      }

      const storedPassword = (storeRow[16] || '').toString().trim(); // I열: 비밀번호 (가정)

      // 비밀번호 검증
      if (storedPassword !== password) {
        return res.status(401).json({
          success: false,
          error: '비밀번호가 일치하지 않습니다.'
        });
      }

      res.json({
        success: true,
        message: '비밀번호 검증 성공'
      });
    } catch (error) {
      console.error('Error verifying direct store password:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify direct store password',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createAuthRoutes;
