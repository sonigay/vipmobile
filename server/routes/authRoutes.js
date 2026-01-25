/**
 * Auth Routes
 * 
 * 인증 및 로그인 관련 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - POST /api/login - 로그인 검증 (대리점 관리자 + 일반모드 사용자)
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
 * @param {Object} context.cacheManager - Cache Manager
 * @returns {express.Router} Express 라우터
 */
function createAuthRoutes(context) {
  const { sheetsClient, rateLimiter, cacheManager } = context;

  // 시트 이름 상수
  const AGENT_SHEET_NAME = '대리점아이디관리';
  const STORE_SHEET_NAME = '폰클출고처데이터';
  const GENERAL_MODE_SHEET_NAME = '일반모드권한관리';

  // 로그인 캐시 (간단한 메모리 캐시)
  const loginCache = new Map();
  const LOGIN_CACHE_TTL = 5 * 60 * 1000; // 5분

  // Google Sheets 클라이언트가 없으면 에러 응답 반환하는 헬퍼 함수
  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets) {
      res.status(503).json({
        success: false,
        error: 'Google Sheets client not available. Please check environment variables.'
      });
      return false;
    }
    return true;
  };

  // 시트 데이터 가져오기 헬퍼 함수
  async function getSheetValues(sheetName, range = 'A:AF') {
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!${range}`
      })
    );
    
    return response.data.values || [];
  }

  // POST /api/login - 로그인 검증 (대리점 관리자 + 일반모드 사용자)
  router.post('/api/login', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { storeId, deviceInfo, ipAddress, location } = req.body;

      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: 'Store ID is required'
        });
      }

      // 로그인 캐시 확인 (성능 최적화)
      const cacheKey = `login_${storeId}`;
      const cachedLogin = loginCache.get(cacheKey);
      if (cachedLogin && Date.now() < cachedLogin.ttl) {
        console.log(`🚀 [로그인 최적화] 캐시된 로그인 정보 사용: ${storeId}`);
        return res.json(cachedLogin.data);
      }

      // 1. 대리점 관리자와 일반 매장 데이터를 병렬로 가져오기 (성능 최적화)
      const [agentValues, storeValues] = await Promise.all([
        getSheetValues(AGENT_SHEET_NAME),
        getSheetValues(STORE_SHEET_NAME)
      ]);

      // 2. 먼저 대리점 관리자 ID인지 확인
      if (agentValues) {
        const agentRows = agentValues.slice(1); // 헤더 1행 제외
        const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디)

        if (agent) {
          // 대리점 관리자 로그인 처리
          console.log(`✅ [로그인] 대리점 관리자: ${agent[0]}, ${agent[1]}`);

          // 패스워드 관련 정보
          const passwordNotUsed = agent[3] === 'TRUE'; // D열: 패스워드 미사용
          const storedPassword = agent[4] || ''; // E열: 패스워드
          const isPasswordEmpty = (!agent[3] || agent[3] === '') && (!agent[4] || agent[4] === '');

          // 사무실과 소속 정보
          const office = agent[5] || ''; // F열: 사무실
          const department = agent[6] || ''; // G열: 소속

          // 권한 정보 (H~AF열)
          const hasInventoryPermission = agent[7] === 'O'; // H열: 재고모드
          const hasSettlementPermission = agent[8] === 'O'; // I열: 정산모드
          const hasInspectionPermission = agent[9] === 'O'; // J열: 검수모드
          const hasBondChartPermission = agent[10] === 'O'; // K열: 채권장표 메뉴
          const hasPolicyPermission = agent[11] === 'O'; // L열: 정책모드
          const hasInspectionOverviewPermission = agent[12] === 'O'; // M열: 검수전체현황
          const meetingPermissionRaw = (agent[13] || '').toString().trim().toUpperCase(); // N열: 회의모드 (M/O)
          const hasMeetingPermission = ['M', 'O'].includes(meetingPermissionRaw);
          const hasReservationPermission = agent[14] === 'O'; // O열: 사전예약모드
          const hasChartPermission = agent[15] === 'O'; // P열: 장표모드
          const teamCode = agent[16] || ''; // Q열: 팀코드
          const userRole = agent[17] || ''; // R열: 권한
          const hasBudgetPermission = agent[18] === 'O'; // S열: 예산모드
          const hasSalesPermission = agent[20] === 'O'; // U열: 영업모드
          const hasInventoryRecoveryPermission = agent[21] === 'O'; // V열: 재고회수모드
          const hasDataCollectionPermission = agent[22] === 'O'; // W열: 정보수집모드
          const hasSmsManagementPermission = agent[23] === 'O'; // X열: SMS 관리모드
          const obManagementPermissionRaw = (agent[24] || '').toString().trim().toUpperCase(); // Y열: OB 관리모드 (O/M/S)
          const hasObManagementPermission = ['O', 'M', 'S'].includes(obManagementPermissionRaw);
          const agentModePermissionRaw = (agent[25] || '').toString().trim().toUpperCase(); // Z열: 관리자모드 (O/M)
          const hasAgentModePermission = agentModePermissionRaw === 'O' || agentModePermissionRaw === 'M';
          const hasOnSaleManagementPermission = agent[26] === 'O' || agent[26] === 'S' || agent[26] === 'M'; // AA열: 온세일관리모드
          const hasOnSaleLinkPermission = agent[26] === 'S'; // AA열: 온세일 링크관리
          const hasOnSalePolicyPermission = agent[26] === 'M'; // AA열: 온세일 정책게시판 (M은 링크+정책)
          const hasMealAllowancePermission = agent[27] === 'O'; // AB열: 식대 모드
          const hasAttendancePermission = agent[28] === 'O'; // AC열: 근퇴 모드
          const hasRiskManagementPermission = agent[29] === 'O'; // AD열: 리스크 관리 모드
          const directStoreManagementPermissionRaw = (agent[30] || '').toString().trim().toUpperCase(); // AE열: 직영점 관리 모드 (M/S/O)
          const hasDirectStoreManagementPermission = directStoreManagementPermissionRaw === 'M' || directStoreManagementPermissionRaw === 'S' || directStoreManagementPermissionRaw === 'O';
          const hasQuickServiceManagementPermission = agent[31] === 'O'; // AF열: 퀵서비스 관리 모드

          // 권한 객체 생성
          const modePermissions = {
            agent: hasAgentModePermission,
            inventory: hasInventoryPermission,
            settlement: hasSettlementPermission,
            inspection: hasInspectionPermission,
            bondChart: hasBondChartPermission,
            chart: hasChartPermission,
            policy: hasPolicyPermission,
            inspectionOverview: hasInspectionOverviewPermission,
            meeting: hasMeetingPermission ? meetingPermissionRaw : false,
            reservation: hasReservationPermission,
            budget: hasBudgetPermission,
            sales: hasSalesPermission,
            inventoryRecovery: hasInventoryRecoveryPermission,
            dataCollection: hasDataCollectionPermission,
            smsManagement: hasSmsManagementPermission,
            obManagement: hasObManagementPermission,
            onSaleManagement: hasOnSaleManagementPermission,
            onSaleLink: hasOnSaleLinkPermission || hasOnSalePolicyPermission,
            onSalePolicy: hasOnSalePolicyPermission,
            mealAllowance: hasMealAllowancePermission,
            attendance: hasAttendancePermission,
            riskManagement: hasRiskManagementPermission,
            quickServiceManagement: hasQuickServiceManagementPermission,
            directStoreManagement: hasDirectStoreManagementPermission ? directStoreManagementPermissionRaw : false
          };

          const loginResult = {
            success: true,
            isAgent: true,
            modePermissions: modePermissions,
            obManagementRole: obManagementPermissionRaw || '',
            meetingRole: meetingPermissionRaw || '',
            agentInfo: {
              target: agent[0] || '',
              qualification: agent[1] || '',
              contactId: agent[2] || '',
              passwordNotUsed: passwordNotUsed,
              hasPassword: storedPassword !== '',
              isPasswordEmpty: isPasswordEmpty,
              office: office,
              department: department,
              userRole: userRole,
              obManagementRole: obManagementPermissionRaw || '',
              meetingRole: meetingPermissionRaw || '',
              onSaleLink: hasOnSaleLinkPermission || hasOnSalePolicyPermission,
              onSalePolicy: hasOnSalePolicyPermission,
              agentModePermission: agentModePermissionRaw || ''
            }
          };

          // 로그인 결과 캐시 저장
          loginCache.set(cacheKey, {
            data: loginResult,
            ttl: Date.now() + LOGIN_CACHE_TTL
          });

          return res.json(loginResult);
        }
      }

      // 3. 대리점 관리자가 아닌 경우 일반모드권한관리 시트에서 검색
      const generalModeValues = await getSheetValues(GENERAL_MODE_SHEET_NAME);

      if (generalModeValues && generalModeValues.length > 3) {
        const generalModeRows = generalModeValues.slice(3); // 4행부터 데이터
        const foundGeneralUser = generalModeRows.find(row => {
          const rowId = (row[0] || '').toString().trim(); // A열: 사용자ID(POS코드)
          const normalizedStoreId = (storeId || '').toString().trim();
          return rowId.toUpperCase() === normalizedStoreId.toUpperCase();
        });

        if (foundGeneralUser) {
          console.log(`✅ [로그인] 일반모드 사용자: ${foundGeneralUser[0]}`);

          // 권한 확인
          const hasBasicMode = foundGeneralUser[3] === 'O'; // D열: 기본 모드
          const eColumnValue = (foundGeneralUser[4] || '').toString().trim().toUpperCase(); // E열: 온세일접수 모드 (O/M)
          const hasOnSaleMode = eColumnValue === 'O' || eColumnValue === 'M';
          const directStoreColumnValue = (foundGeneralUser[6] || '').toString().trim().toUpperCase(); // G열: 직영점 모드
          const hasDirectStoreMode = directStoreColumnValue === 'O';
          const directStorePassword = (foundGeneralUser[7] || '').toString().trim(); // H열: 직영점 모드 비밀번호
          const requiresDirectStorePassword = hasDirectStoreMode && directStorePassword !== '';
          const generalPolicyColumnValue = (foundGeneralUser[8] || '').toString().trim().toUpperCase(); // I열: 일반정책모드
          const hasGeneralPolicyMode = generalPolicyColumnValue === 'O';
          const generalPolicyPassword = (foundGeneralUser[9] || '').toString().trim(); // J열: 일반정책모드 비밀번호
          const requiresGeneralPolicyPassword = hasGeneralPolicyMode && generalPolicyPassword !== '';

          // 권한이 하나도 없으면 로그인 거부
          if (!hasBasicMode && !hasOnSaleMode && !hasDirectStoreMode && !hasGeneralPolicyMode) {
            return res.status(403).json({
              success: false,
              error: '접근 권한이 없습니다.'
            });
          }

          // 폰클출고처데이터에서 추가 정보 가져오기
          let storeDetails = {
            latitude: 0,
            longitude: 0,
            address: '',
            phone: '',
            code: '',
            office: '',
            department: '',
            manager: ''
          };

          if (storeValues) {
            const storeRows = storeValues.slice(1);
            const foundStoreRow = storeRows.find(row => row[15] === storeId);

            if (foundStoreRow) {
              storeDetails = {
                address: foundStoreRow[11] || '',
                latitude: parseFloat(foundStoreRow[8] || '0'),
                longitude: parseFloat(foundStoreRow[9] || '0'),
                phone: foundStoreRow[19] || '',
                code: (foundStoreRow[7] || '').toString().trim(),
                office: (foundStoreRow[3] || '').toString().trim(),
                department: (foundStoreRow[4] || '').toString().trim(),
                manager: (foundStoreRow[5] || '').toString().trim()
              };
            }
          }

          const store = {
            id: foundGeneralUser[0],
            name: foundGeneralUser[1] || '',
            group: (foundGeneralUser[2] || '').trim(),
            manager: foundGeneralUser[2] || '',
            userRole: eColumnValue,
            ...storeDetails,
            modePermissions: {
              basicMode: hasBasicMode,
              onSaleReception: hasOnSaleMode,
              onSalePolicy: eColumnValue === 'M',
              directStore: hasDirectStoreMode,
              generalPolicy: hasGeneralPolicyMode
            },
            directStoreSecurity: {
              requiresPassword: requiresDirectStorePassword
            },
            generalPolicySecurity: {
              requiresPassword: requiresGeneralPolicyPassword
            }
          };

          const loginResult = {
            success: true,
            isAgent: false,
            storeInfo: store,
            modePermissions: store.modePermissions
          };

          // 로그인 결과 캐시 저장
          loginCache.set(cacheKey, {
            data: loginResult,
            ttl: Date.now() + LOGIN_CACHE_TTL
          });

          return res.json(loginResult);
        }
      }

      // 4. 매장 ID도 아닌 경우
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });

    } catch (error) {
      console.error('❌ [로그인] 에러:', error);
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
      const { storeId, password } = req.body;

      if (!storeId || !password) {
        return res.status(400).json({
          success: false,
          error: '아이디와 패스워드를 입력해주세요'
        });
      }

      // 대리점아이디관리 시트에서 사용자 정보 가져오기
      const agentValues = await getSheetValues(AGENT_SHEET_NAME);
      if (!agentValues) {
        return res.status(500).json({
          success: false,
          error: '시트 데이터를 가져올 수 없습니다'
        });
      }

      const agentRows = agentValues.slice(1);
      const agent = agentRows.find(row => row[2] === storeId); // C열: 아이디

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다'
        });
      }

      const passwordNotUsed = agent[3] === 'TRUE'; // D열: 패스워드 미사용
      const storedPassword = agent[4] || ''; // E열: 패스워드

      console.log(`🔐 [패스워드 검증] 사용자: ${storeId}, 패스워드 미사용: ${passwordNotUsed}`);

      // 패스워드 미사용인 경우, 접속 허용
      if (passwordNotUsed) {
        console.log(`✅ [패스워드 검증] 패스워드 미사용 - 접속 허용`);
        return res.json({
          success: true,
          verified: true,
          message: '패스워드 미사용 - 접속 허용'
        });
      }

      // 패스워드가 설정되지 않은 경우 - 접속 거부
      if (!storedPassword) {
        console.log(`❌ [패스워드 검증] 패스워드가 설정되지 않음 - 접속 거부`);
        return res.json({
          success: false,
          verified: false,
          error: '패스워드가 설정되지 않았습니다. 관리자에게 문의하세요.'
        });
      }

      // 패스워드 검증
      if (storedPassword === password) {
        console.log(`✅ [패스워드 검증] 패스워드 일치 - 접속 허용`);
        return res.json({
          success: true,
          verified: true,
          message: '패스워드 일치'
        });
      } else {
        console.log(`❌ [패스워드 검증] 패스워드 불일치`);
        return res.json({
          success: false,
          verified: false,
          error: '패스워드가 일치하지 않습니다'
        });
      }
    } catch (error) {
      console.error('❌ [패스워드 검증] 오류:', error);
      return res.status(500).json({
        success: false,
        error: '패스워드 검증 중 오류가 발생했습니다',
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

      // 일반모드권한관리 시트에서 직영점 비밀번호 확인
      const generalModeValues = await getSheetValues(GENERAL_MODE_SHEET_NAME);
      
      if (!generalModeValues || generalModeValues.length <= 3) {
        throw new Error('Failed to fetch general mode data');
      }

      const generalModeRows = generalModeValues.slice(3); // 4행부터 데이터
      const foundUser = generalModeRows.find(row => {
        const rowId = (row[0] || '').toString().trim(); // A열: 사용자ID(POS코드)
        const normalizedStoreId = (storeId || '').toString().trim();
        return rowId.toUpperCase() === normalizedStoreId.toUpperCase();
      });

      if (!foundUser) {
        return res.status(404).json({
          success: false,
          error: '매장을 찾을 수 없습니다.'
        });
      }

      const storedPassword = (foundUser[7] || '').toString().trim(); // H열: 직영점 모드 비밀번호

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
      console.error('❌ [직영점 비밀번호 검증] 에러:', error);
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
