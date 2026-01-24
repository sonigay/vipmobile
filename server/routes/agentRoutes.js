/**
 * Agent Routes
 * 
 * 대리점(담당자) 정보와 권한 정보를 제공하는 엔드포인트입니다.
 * 
 * Endpoints:
 * - GET /api/agents - 대리점 목록 및 권한 정보 조회
 * 
 * Requirements: 1.1, 1.2, 7.11
 */

const express = require('express');
const router = express.Router();

/**
 * Agent Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createAgentRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // 시트 이름 상수
  const AGENT_SHEET_NAME = '대리점아이디관리';

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
        range: `${sheetName}!A:Z`
      })
    );
    
    return response.data.values || [];
  }

  // GET /api/agents - 대리점 목록 및 권한 정보 조회
  router.get('/api/agents', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      // 캐시 키 변경 (v2) - 컬럼 인덱스 수정 후 캐시 무효화를 위해
      const cacheKey = 'processed_agents_data_v2';

      // 캐시에서 먼저 확인
      const cachedAgents = cacheManager.get(cacheKey);
      if (cachedAgents) {
        console.log('✅ [캐시] 수정된 agent 데이터 반환');
        return res.json(cachedAgents);
      }

      console.log('🔄 [담당자] 데이터 처리 시작...');
      const startTime = Date.now();

      const agentValues = await getSheetValues(AGENT_SHEET_NAME);

      if (!agentValues) {
        throw new Error('Failed to fetch data from agent sheet');
      }

      // 헤더 제거 (3행까지가 헤더이므로 4행부터 시작)
      const agentRows = agentValues.slice(3);

      // 대리점 데이터 구성 (D열, E열 추가로 인해 사무실/소속이 +2 이동)
      // F열(인덱스 5) = 사무실, G열(인덱스 6) = 소속
      const agents = agentRows.map((row, index) => {
        // 정확히 F열(row[5])에서 사무실, G열(row[6])에서 소속만 읽기
        let office = (row[5] || '').toString().trim();        // F열: 사무실
        let department = (row[6] || '').toString().trim();     // G열: 소속

        // 보안 검증: E열(패스워드) 값 확인 (비교용)
        const passwordValue = (row[4] || '').toString().trim(); // E열: 패스워드
        const passwordNotUsed = (row[3] || '').toString().trim(); // D열: 패스워드 미사용

        // 중요: department가 E열(패스워드) 값과 같으면 안 됨 (절대 비밀번호가 소속으로 표시되면 안 됨)
        if (department === passwordValue && passwordValue !== '') {
          console.error(`❌ [치명적 오류] ${row[2]}: G열(소속) 값이 E열(패스워드) 값과 동일! G열="${department}", E열="${passwordValue ? '***' : ''}" - department 초기화`);
          department = '';
        }

        // department가 체크박스 값인 경우 필터링
        if (department === passwordNotUsed || department === 'FALSE' || department === 'TRUE') {
          console.warn(`⚠️ [보안] department가 체크박스 값: ${row[2]}, department 초기화`);
          department = '';
        }

        // 숫자만 있고 4자 이상인 경우 (비밀번호일 가능성) 필터링
        // 단, E열(패스워드)과 비교하여 동일한 값이면 확실히 필터링
        if (/^\d+$/.test(department) && department.length >= 4) {
          if (department === passwordValue) {
            console.error(`❌ [치명적 오류] ${row[2]}: G열(소속)이 비밀번호 형식이고 E열(패스워드)과 동일! - department 초기화`);
            department = '';
          } else {
            console.warn(`⚠️ [보안] department가 비밀번호 형식으로 의심됨: ${row[2]}, 값="${department}" - department 초기화`);
            department = '';
          }
        }

        // office도 체크박스 값 필터링
        if (office === 'FALSE' || office === 'TRUE') {
          console.warn(`⚠️ [보안] office가 체크박스 값: ${row[2]}, office 초기화`);
          office = '';
        }

        const agent = {
          target: row[0] || '',       // A열: 대상
          qualification: row[1] || '', // B열: 자격
          contactId: row[2] || '',     // C열: 연락처(아이디)
          office: office,
          department: department,
          permissionLevel: row[17] || '' // R열: 정책모드권한레벨
        };

        // 디버깅: 처음 10개 행 모두 상세 로그 출력
        if (index < 10) {
          console.log(`📋 [담당자 ${index + 1}]`, {
            target: agent.target,
            contactId: agent.contactId,
            office: agent.office,
            department: agent.department,
            '전체 row 길이': row.length,
            'row[0] (A열-대상)': row[0],
            'row[1] (B열-자격)': row[1],
            'row[2] (C열-아이디)': row[2],
            'row[3] (D열-패스워드미사용)': row[3],
            'row[4] (E열-패스워드)': row[4] ? '***' : '',
            'row[5] (F열-사무실)': row[5],
            'row[6] (G열-소속)': row[6],
            '최종 office': office,
            '최종 department': department,
            '필터링 전 row 전체': row.slice(0, 10) // 처음 10개 컬럼만
          });
        }

        return agent;
      }).filter(agent => {
        // SS 권한 사용자는 office/department 필터링을 우회
        if (agent.permissionLevel === 'SS') {
          return agent.contactId && agent.target && agent.target.trim() !== '';
        }
        // 일반 사용자는 아이디가 있고, office와 department가 모두 유효한 항목만 반환
        return agent.contactId &&
          agent.office && agent.office.trim() !== '' &&
          agent.department && agent.department.trim() !== '';
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ [담당자] 데이터 처리 완료: ${agents.length}개 담당자, ${processingTime}ms 소요`);

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, agents);

      res.json(agents);
    } catch (error) {
      console.error('Error fetching agent data:', error);
      res.status(500).json({
        error: 'Failed to fetch agent data',
        message: error.message
      });
    }
  });

  // GET /api/agent-office-department - 사무소/부서 목록
  router.get('/api/agent-office-department', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'agent_office_department';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('대리점아이디관리');
      const rows = values.slice(1);

      const offices = new Set();
      const departments = new Set();

      rows.forEach(row => {
        if (row[5]) offices.add(row[5]); // F열: 사무실
        if (row[6]) departments.add(row[6]); // G열: 소속
      });

      const result = {
        offices: Array.from(offices),
        departments: Array.from(departments)
      };

      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching office/department:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/agent-closing-chart - 대리점 마감장표
  router.get('/api/agent-closing-chart', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'agent_closing_chart';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('대리점마감장표');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching agent closing chart:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/agent-closing-agents - 마감 대리점 목록
  router.get('/api/agent-closing-agents', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'agent_closing_agents';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('마감대리점목록');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching closing agents:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/agent-closing-initial - 마감 초기값
  router.get('/api/agent-closing-initial', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'agent_closing_initial';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('마감초기값');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching closing initial:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createAgentRoutes;
