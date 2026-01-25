/**
 * Team Routes
 * 
 * 팀 정보 조회 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/teams - 팀 목록 조회
 * - GET /api/team-leaders - 팀장 목록 조회
 * 
 * Requirements: 1.1, 1.2, 7.2
 */

const express = require('express');
const router = express.Router();

/**
 * Team Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createTeamRoutes(context) {
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

  // GET /api/teams - 팀 목록 조회
  router.get('/api/teams', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🔍 [팀목록] 팀 목록 조회 시작');

      // 대리점아이디관리 시트에서 팀장 목록 가져오기
      const sheetName = '대리점아이디관리';
      const range = 'A:R'; // A열(이름)과 R열(권한레벨) 포함

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!${range}`
        })
      );

      const rows = response.data.values || [];
      console.log('🔍 [팀목록] 총 행 수:', rows.length);

      const teams = [];

      // 헤더 제외하고 데이터 처리
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0]; // A열: 대상(이름)
        const permissionLevel = row[17]; // R열: 정책모드권한레벨

        console.log(`🔍 [팀목록] 행 ${i}: 이름=${name}, 권한레벨=${permissionLevel}`);

        // 권한레벨이 알파벳 두 개인 경우 팀장으로 인식 (AA, BB, CC, DD, EE, FF 등)
        if (permissionLevel && permissionLevel.length === 2 && /^[A-Z]{2}$/.test(permissionLevel)) {
          teams.push({
            code: permissionLevel,
            name: name
          });
          console.log(`✅ [팀목록] 팀장 추가: ${permissionLevel} - ${name}`);
        }
      }

      console.log('🔍 [팀목록] 최종 팀 목록:', teams);
      res.json(teams);
    } catch (error) {
      console.error('❌ [팀목록] 팀 목록 조회 실패:', error);
      res.status(500).json({ error: '팀 목록 조회에 실패했습니다.', details: error.message });
    }
  });

  // GET /api/team-leaders - 팀장 목록 조회
  router.get('/api/team-leaders', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🔍 [팀장목록] 팀장 목록 조회 시작');

      // 캐시 확인
      const cacheKey = 'team_leaders_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [팀장목록] 캐시에서 반환');
        return res.json(cached);
      }

      // 대리점아이디관리 시트에서 팀장 목록 가져오기
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '대리점아이디관리!A:R'
        })
      );

      const rows = response.data.values || [];
      console.log('🔍 [팀장목록] 총 행 수:', rows.length);

      const teamLeaders = [];

      // 헤더 제외하고 데이터 처리
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[0]; // A열: 대상(이름)
        const permissionLevel = row[17]; // R열: 정책모드권한레벨

        // 권한레벨이 알파벳 두 개인 경우 팀장으로 인식 (AA, BB, CC, DD, EE, FF 등)
        if (permissionLevel && permissionLevel.length === 2 && /^[A-Z]{2}$/.test(permissionLevel)) {
          teamLeaders.push({
            code: permissionLevel,
            name: name
          });
          console.log(`✅ [팀장목록] 팀장 추가: ${permissionLevel} - ${name}`);
        }
      }

      // 캐시 저장
      cacheManager.set(cacheKey, teamLeaders);

      console.log('✅ [팀장목록] 최종 팀장 목록:', teamLeaders.length, '명');
      res.json(teamLeaders);

    } catch (error) {
      console.error('❌ [팀장목록] 팀장 목록 조회 실패:', {
        오류타입: error.name || 'Error',
        오류메시지: error.message,
        요청경로: req.path,
        요청메서드: req.method
      });

      // 시트가 존재하지 않는 경우 빈 배열 반환
      if (error.message && error.message.includes('Unable to parse range')) {
        console.warn('⚠️ [팀장목록] 시트를 찾을 수 없음, 빈 배열 반환');
        return res.json([]);
      }

      res.status(500).json({ error: '팀장 목록 조회에 실패했습니다.', details: error.message });
    }
  });

  return router;
}

module.exports = createTeamRoutes;
