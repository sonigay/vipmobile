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

  // GET /api/agent-closing-chart - 영업사원별마감 데이터 조회 API
  router.get('/api/agent-closing-chart', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { date, agent } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      console.log(`담당자별마감 데이터 조회 시작: ${targetDate}, 담당자: ${agent || '전체'}`);

      // 캐시 키 생성
      const cacheKey = `agent_closing_chart_${targetDate}_${agent || 'all'}`;

      // 캐시 확인
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('캐시된 담당자별마감 데이터 반환');
        return res.json(cached);
      }

      // 필요한 시트 데이터 로드 (병렬 처리)
      const [
        phoneklStoreData,
        phoneklInventoryData,
        phoneklActivationData
      ] = await Promise.all([
        getSheetValues('폰클출고처데이터'),
        getSheetValues('폰클재고데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      if (!phoneklStoreData || !phoneklInventoryData || !phoneklActivationData) {
        throw new Error('필요한 시트 데이터를 가져올 수 없습니다.');
      }

      // 영업사원별 데이터 처리
      const agentData = processAgentClosingData({
        phoneklStoreData,
        phoneklInventoryData,
        phoneklActivationData,
        targetDate,
        selectedAgent: agent
      });

      const result = {
        success: true,
        agentData,
        totalCount: agentData.length,
        targetDate,
        selectedAgent: agent || '전체'
      };

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);

      console.log(`담당자별마감 데이터 처리 완료: ${agentData.length}건`);
      res.json(result);

    } catch (error) {
      console.error('담당자별마감 데이터 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: '담당자별마감 데이터를 가져오는데 실패했습니다.',
        details: error.message
      });
    }
  });

  // GET /api/agent-closing-initial - 영업사원별마감 초기 데이터 조회 API (마지막 개통날짜 + 영업사원 목록)
  router.get('/api/agent-closing-initial', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'agent_closing_initial_data';

      // 캐시 확인
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // 마지막 개통날짜 조회
      const phoneklActivationList = await getSheetValues('폰클개통리스트');
      let lastActivationDate = new Date().toISOString().split('T')[0];

      if (phoneklActivationList && phoneklActivationList.length > 1) {
        const dateColumn = phoneklActivationList[0].indexOf('개통날짜');
        if (dateColumn !== -1) {
          const dates = phoneklActivationList.slice(1)
            .map(row => row[dateColumn])
            .filter(date => date && typeof date === 'string' && date.includes('-'))
            .map(dateStr => {
              try {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
              } catch {
                return null;
              }
            })
            .filter(date => date !== null);

          if (dates.length > 0) {
            const latestDate = new Date(Math.max(...dates));
            lastActivationDate = latestDate.toISOString().split('T')[0];
          }
        }
      }

      // 영업사원 목록 조회
      const [phoneklStoreData, phoneklActivationData] = await Promise.all([
        getSheetValues('폰클출고처데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      if (!phoneklStoreData || phoneklStoreData.length < 2) {
        throw new Error('폰클출고처데이터를 가져올 수 없습니다.');
      }

      if (!phoneklActivationData || phoneklActivationData.length < 4) {
        throw new Error('폰클개통데이터를 가져올 수 없습니다.');
      }

      // 이번달 개통실적이 있는 담당자 추출
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const currentYearMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      const agentsWithActivation = new Set();
      let activationCount = 0;

      phoneklActivationData.slice(3).forEach(row => {
        if (row[1] && row[9]) {
          const activationDate = row[9];
          const agent = row[1];

          if (typeof activationDate === 'string' && activationDate.includes('-')) {
            const [year, month] = activationDate.split('-');
            if (year === currentYear.toString() && month === currentMonth.toString().padStart(2, '0')) {
              agentsWithActivation.add(agent);
              activationCount++;
            }
          }
        }
      });

      // 폰클출고처데이터에서 해당 담당자들의 전체 목록 추출
      const allAgents = new Set();
      phoneklStoreData.slice(3).forEach(row => {
        if (row[21] && row[12] !== '미사용') {
          allAgents.add(row[21]);
        }
      });

      // 이번달 개통실적이 있는 담당자만 필터링
      const filteredAgents = Array.from(allAgents).filter(agent =>
        agentsWithActivation.has(agent)
      ).sort();

      const result = {
        success: true,
        lastActivationDate,
        agents: filteredAgents,
        agentsWithActivation: filteredAgents.length,
        totalAgents: allAgents.size,
        activationCount
      };

      // 캐시 저장 (2분)
      cacheManager.set(cacheKey, result, 2 * 60 * 1000);

      console.log(`영업사원별마감 초기 데이터 로드 완료: 마지막 개통날짜=${lastActivationDate}, 담당자=${filteredAgents.length}명`);
      res.json(result);

    } catch (error) {
      console.error('영업사원별마감 초기 데이터 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: '영업사원별마감 초기 데이터를 가져오는데 실패했습니다.',
        details: error.message
      });
    }
  });

  // GET /api/agent-closing-agents - 영업사원별마감용 영업사원 목록 조회 API (이번달 개통실적 있는 담당자만)
  router.get('/api/agent-closing-agents', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'agent_closing_agents_list_with_activation';

      // 캐시 확인
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // 필요한 시트 데이터 병렬 로드
      const [phoneklStoreData, phoneklActivationData] = await Promise.all([
        getSheetValues('폰클출고처데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      if (!phoneklStoreData || phoneklStoreData.length < 2) {
        throw new Error('폰클출고처데이터를 가져올 수 없습니다.');
      }

      if (!phoneklActivationData || phoneklActivationData.length < 4) {
        throw new Error('폰클개통데이터를 가져올 수 없습니다.');
      }

      // 이번달 개통실적이 있는 담당자 추출
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const currentYearMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      console.log(`이번달 개통실적 조회: ${currentYearMonth}`);

      // 폰클개통데이터에서 이번달 개통실적이 있는 담당자 찾기
      const agentsWithActivation = new Set();
      let activationCount = 0;

      phoneklActivationData.slice(3).forEach(row => {
        if (row.length < 2) return; // B열(1인덱스)까지 필요

        const category = row[2] || ''; // C열: 휴대폰
        const activationDate = row[9] || ''; // J열: 개통일
        const assignedAgent = row[1] || ''; // B열: 담당자 (괄호 포함)

        if (category !== '휴대폰') return;

        // 날짜 파싱 (J열 형식: 2025-09-27)
        if (activationDate.length >= 10) {
          const dateStr = activationDate.substring(0, 10);
          const dateObj = new Date(dateStr);

          if (isNaN(dateObj.getTime())) return;

          const yearMonth = dateStr.substring(0, 7); // YYYY-MM

          // 이번달 개통실적이 있는 경우
          if (yearMonth === currentYearMonth && assignedAgent) {
            const agentName = assignedAgent.toString().trim();
            if (agentName) {
              agentsWithActivation.add(agentName);
              activationCount++;
            }
          }
        }
      });

      console.log(`이번달 개통실적 있는 담당자: ${agentsWithActivation.size}명, 총 개통건수: ${activationCount}건`);

      // 폰클출고처데이터에서 모든 담당자명 추출 (참고용)
      const allAgents = new Set();
      phoneklStoreData.slice(3).forEach(row => {
        if (row.length > 21 && row[21]) {
          const agentName = row[21].toString().trim();
          if (agentName) {
            allAgents.add(agentName);
          }
        }
      });

      // 이번달 개통실적이 있는 담당자만 필터링
      const filteredAgents = Array.from(agentsWithActivation).sort();

      const result = {
        success: true,
        agents: filteredAgents,
        currentMonth: currentYearMonth,
        totalAgents: allAgents.size,
        agentsWithActivation: agentsWithActivation.size,
        activationCount: activationCount,
        note: `이번달(${currentYearMonth}) 개통실적이 있는 담당자만 필터링`
      };

      // 캐시 저장 (10분)
      cacheManager.set(cacheKey, result, 10 * 60 * 1000);

      console.log(`이번달 개통실적 있는 담당자 목록 조회 완료: ${result.agents.length}명 (전체 ${allAgents.size}명 중)`);
      res.json(result);

    } catch (error) {
      console.error('담당자 목록 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: '담당자 목록을 가져오는데 실패했습니다.',
        details: error.message
      });
    }
  });

  // 영업사원별마감 데이터 처리 함수
  function processAgentClosingData({ phoneklStoreData, phoneklInventoryData, phoneklActivationData, targetDate, selectedAgent }) {
    const agentMap = new Map();

    // 1. 폰클출고처데이터에서 기본 정보 수집
    phoneklStoreData.slice(3).forEach(row => {
      if (row.length < 22) return;

      const status = row[12] || ''; // M열: 사용/미사용 상태
      const policyGroup = row[18] || ''; // S열
      const pCode = row[15] || ''; // P열
      const companyName = row[14] || ''; // O열
      const agent = row[21] || ''; // V열

      // M열이 "미사용"인 경우 제외
      if (status === '미사용') return;

      // 영업사원 필터링 (기본 이름으로 그룹핑)
      if (selectedAgent) {
        const baseAgentName = agent.replace(/\([^)]*\)/g, '').trim();
        if (baseAgentName !== selectedAgent) return;
      }

      if (!agent || !companyName) return;

      const key = `${agent}_${companyName}`;
      if (!agentMap.has(key)) {
        agentMap.set(key, {
          policyGroup,
          pCode,
          companyName,
          agent,
          turnoverRate: 0,
          defectiveDevices: 0,
          historyDevices: 0,
          defectiveSims: 0,
          historySims: 0,
          totalInventory: 0,
          remainingSims: 0,
          dailyPerformance: 0,
          monthlyPerformance: 0,
          expectedClosing: 0,
          noPerformanceStores: 0
        });
      }
    });

    // 2. 폰클재고데이터에서 재고 정보 수집
    phoneklInventoryData.slice(3).forEach(row => {
      if (row.length < 22) return;

      const category = row[12] || ''; // M열: 휴대폰/유심/웨어러블/태블릿
      const status = row[15] || ''; // P열: 정상/불량/이력
      const companyName = row[21] || ''; // V열: 업체명

      // agentMap에서 해당 업체명 찾기 (미사용 업체는 이미 agentMap에서 제외됨)
      for (const [key, data] of agentMap) {
        if (data.companyName === companyName) {
          if (category === '휴대폰' && status === '불량') {
            data.defectiveDevices++;
          } else if (category === '휴대폰' && status === '이력') {
            data.historyDevices++;
          } else if (category === '유심' && status === '불량') {
            data.defectiveSims++;
          } else if (category === '유심' && status === '이력') {
            data.historySims++;
          } else if ((category === '휴대폰' || category === '웨어러블' || category === '태블릿') && status === '정상') {
            data.totalInventory++;
          } else if (category === '유심' && status === '정상') {
            data.remainingSims++;
          }
          break;
        }
      }
    });

    // 3. 폰클개통데이터에서 실적 정보 수집
    const targetYearMonth = targetDate.substring(0, 7); // YYYY-MM
    const targetDay = targetDate.substring(8, 10); // DD

    phoneklActivationData.slice(3).forEach(row => {
      if (row.length < 15) return; // O열(14인덱스)까지 필요

      const category = row[2] || ''; // C열: 휴대폰
      const activationDate = row[9] || ''; // J열: 개통일
      const assignedAgent = row[1] || ''; // B열: 담당자 (괄호 포함)
      const companyName = row[14] || ''; // O열: 업체명

      if (category !== '휴대폰') return;

      // 날짜 파싱 (J열 형식: 2025-09-27)
      if (activationDate.length >= 10) {
        const dateStr = activationDate.substring(0, 10);
        const dateObj = new Date(dateStr);

        if (isNaN(dateObj.getTime())) return;

        const yearMonth = dateStr.substring(0, 7);
        const day = dateStr.substring(8, 10);

        // 담당자와 업체명으로 정확한 실적 계산
        const agentName = assignedAgent.toString().trim();
        const activationCompanyName = companyName.toString().trim();

        if (agentName && activationCompanyName) {
          // 금일실적: 선택된 날짜와 정확히 일치
          if (day === targetDay && yearMonth === targetYearMonth) {
            for (const [key, data] of agentMap) {
              if (data.agent === agentName && data.companyName === activationCompanyName) {
                data.dailyPerformance++;
              }
            }
          }

          // 당월실적: 선택된 월의 모든 날짜
          if (yearMonth === targetYearMonth) {
            for (const [key, data] of agentMap) {
              if (data.agent === agentName && data.companyName === activationCompanyName) {
                data.monthlyPerformance++;
              }
            }
          }
        }
      }
    });

    // 4. 예상마감 계산 (전체총마감과 동일한 로직)
    const targetDateObj = new Date(targetDate);
    const currentDay = targetDateObj.getDate(); // 1일부터 선택된 날짜까지의 기간 (예: 15일 선택 시 15일간)
    const daysInMonth = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth() + 1, 0).getDate(); // 해당월 총 일수

    for (const [key, data] of agentMap) {
      if (currentDay > 0 && data.monthlyPerformance > 0) {
        // 당월실적(1일~선택된날짜까지)을 선택된 기간으로 나누어 일평균 계산 후 월 총 일수 곱하기
        data.expectedClosing = Math.round((data.monthlyPerformance / currentDay) * daysInMonth);
      } else {
        data.expectedClosing = 0;
      }
    }

    // 5. 회전율 계산 (예상마감 / (예상마감 + 보유재고) * 100) - 전체총마감 탭과 동일한 방식
    for (const [key, data] of agentMap) {
      if ((data.expectedClosing + data.totalInventory) > 0) {
        data.turnoverRate = Math.round((data.expectedClosing / (data.expectedClosing + data.totalInventory)) * 100);
      }
    }

    // 6. 무실적점 계산 (당월실적이 없는 곳은 "무실적점"으로 표기)
    for (const [key, data] of agentMap) {
      if (data.monthlyPerformance === 0) {
        data.noPerformanceStores = "무실적점";
      } else {
        data.noPerformanceStores = "";
      }
    }

    // 담당자별로 먼저 그룹핑하고, 각 그룹 내에서 당월실적 내림차순 정렬
    const sortedData = Array.from(agentMap.values()).sort((a, b) => {
      // 1. 담당자명으로 먼저 정렬 (같은 담당자는 함께 그룹핑)
      const agentA = a.agent || '';
      const agentB = b.agent || '';

      if (agentA !== agentB) {
        return agentA.localeCompare(agentB);
      }

      // 2. 같은 담당자 내에서는 당월실적 내림차순 정렬
      return (b.monthlyPerformance || 0) - (a.monthlyPerformance || 0);
    });

    return sortedData;
  }

  return router;
}

module.exports = createAgentRoutes;
