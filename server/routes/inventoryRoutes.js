/**
 * Inventory Routes
 * 
 * 재고 관리 관련 엔드포인트를 제공합니다.
 * - 재고 배정 로직
 * - 재고 현황 집계
 * - 개통 상태 확인
 * - 재고 분석
 * 
 * Endpoints:
 * - GET /api/inventory/assignment-status - 재고배정 상태 계산
 * - POST /api/inventory/save-assignment - 배정 저장
 * - GET /api/inventory/normalized-status - 정규화작업시트 재고 현황
 * - POST /api/inventory/manual-assignment - 수동 배정 실행
 * - GET /api/inventory/activation-status - 실시간 개통 상태 확인
 * - GET /api/inventory-analysis - 재고 현황 분석
 * 
 * Requirements: 1.1, 1.2, 7.16
 */

const express = require('express');
const router = express.Router();

/**
 * Inventory Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createInventoryRoutes(context) {
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

  // GET /api/inventory/assignment-status - 재고배정 상태 계산
  router.get('/api/inventory/assignment-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📊 [재고배정] 재고배정 상태 계산 시작');

      // 캐시 키 생성
      const cacheKey = 'inventory_assignment_status';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 재고배정 상태 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      // 폰클재고데이터 시트 조회
      const inventoryValues = await getSheetValues('폰클재고데이터');
      const inventoryHeaders = inventoryValues[0] || [];
      const inventoryRows = inventoryValues.slice(1);

      // 예약 데이터 조회
      const reservationValues = await getSheetValues('예약데이터');
      const reservationHeaders = reservationValues[0] || [];
      const reservationRows = reservationValues.slice(1);

      // 재고 배정 상태 계산 로직
      // 1. 필요한 시트 데이터 병렬로 가져오기 (추가 시트 포함)
      const [phoneklInventoryValues, reservationSiteValues, phoneklStoreValues, phoneklActivationValues, normalizationValues] = await Promise.all([
        getSheetValues('폰클재고데이터'),
        getSheetValues('사전예약사이트'),
        getSheetValues('폰클출고처데이터'),
        getSheetValues('폰클개통데이터'),
        getSheetValues('정규화작업')
      ]);

      if (!phoneklInventoryValues || phoneklInventoryValues.length < 2) {
        throw new Error('폰클재고데이터를 가져올 수 없습니다.');
      }

      // 2. 정규화 규칙 로드
      const normalizationRules = new Map();
      if (normalizationValues && normalizationValues.length > 1) {
        normalizationValues.slice(1).forEach(row => {
          if (row.length >= 3) {
            const reservationSite = (row[1] || '').toString().trim(); // C열
            const phoneklModel = (row[2] || '').toString().trim(); // D열
            const phoneklColor = (row[3] || '').toString().trim(); // E열

            if (reservationSite && phoneklModel && phoneklColor) {
              const key = reservationSite.replace(/\s*\|\s*/g, ' ').trim();
              normalizationRules.set(key, { phoneklModel, phoneklColor });
            }
          }
        });
      }

      // 3. 폰클출고처데이터에서 POS코드 매핑 생성
      const storePosCodeMapping = new Map();
      if (phoneklStoreValues && phoneklStoreValues.length > 1) {
        phoneklStoreValues.slice(1).forEach(row => {
          if (row.length >= 16) {
            const storeName = (row[14] || '').toString().trim(); // O열: 출고처명
            const posCode = (row[15] || '').toString().trim(); // P열: POS코드

            if (storeName && posCode) {
              storePosCodeMapping.set(storeName, posCode);
            }
          }
        });
      }

      // 4. 폰클재고데이터에서 사용 가능한 재고 정보 생성
      const availableInventory = {}; // 변환: Map -> Object for JSON response
      // Legacy logic structure adaptation
      phoneklInventoryValues.slice(1).forEach(row => {
        if (row.length >= 22) {
          const serialNumber = (row[11] || '').toString().trim(); // L열
          const modelCapacity = (row[13] || '').toString().trim(); // N열
          const color = (row[14] || '').toString().trim(); // O열
          const storeName = (row[21] || '').toString().trim(); // V열
          const status = (row[12] || '').toString().trim(); // M열: 재고상태 (확인 필요)

          // 재고상태가 '가용'이거나 비어있는 경우 등 조건 확인 필요 (레거시 코드에는 명시적 필터링이 없어 보이나 확인 필요)
          // 여기서는 POS 코드로 매핑 가능한 것만 집계

          if (modelCapacity && storeName) {
            const posCode = storePosCodeMapping.get(storeName);
            if (posCode) {
              let modelWithColor = modelCapacity;
              if (!modelCapacity.includes('|') && color) {
                modelWithColor = `${modelCapacity} | ${color}`;
              }
              const key = `${modelWithColor}_${posCode}`;

              if (!availableInventory[key]) {
                availableInventory[key] = 0;
              }
              availableInventory[key]++;
            }
          }
        }
      });

      // 5. 결과 반환
      const responseData = {
        success: true,
        assignmentStatus: availableInventory,
        normalizationRules: Object.fromEntries(normalizationRules),
        storePosCodeMapping: Object.fromEntries(storePosCodeMapping),
        lastUpdated: new Date()
      };

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, responseData, 5 * 60 * 1000);

      res.json(responseData);
    } catch (error) {
      console.error('Error calculating assignment status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate assignment status',
        message: error.message
      });
    }
  });

  // POST /api/inventory/save-assignment - 배정 저장
  router.post('/api/inventory/save-assignment', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('💾 [배정저장] 배정 저장 시작');

      const { assignments } = req.body;

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          error: '배정 데이터가 필요합니다.'
        });
      }

      // 각 배정 항목 처리
      for (const assignment of assignments) {
        const { reservationNumber, assignedSerialNumber, rowIndex } = assignment;

        if (!reservationNumber || !assignedSerialNumber) {
          continue;
        }

        // 재고 시트 업데이트
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `폰클재고데이터!${rowIndex}:${rowIndex}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[
                assignedSerialNumber,
                reservationNumber,
                '배정완료',
                new Date().toLocaleString('ko-KR')
              ]]
            }
          })
        );
      }

      // 캐시 무효화
      cacheManager.deletePattern('inventory_');

      res.json({
        success: true,
        message: `${assignments.length}건의 배정이 저장되었습니다.`
      });
    } catch (error) {
      console.error('Error saving assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save assignment',
        message: error.message
      });
    }
  });

  // GET /api/inventory/normalized-status - 정규화작업시트 재고 현황
  router.get('/api/inventory/normalized-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📊 [재고현황] 정규화작업시트 C열 기준 사무실별 재고 현황 로드 시작');

      // 캐시 키 생성
      const cacheKey = 'inventory_normalized_status';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 정규화 재고 현황 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('정규화작업시트');
      const rows = values.slice(1);

      // C열(사무실) 기준으로 집계
      const statusByOffice = {};

      rows.forEach(row => {
        const office = row[2] || '미지정'; // C열
        const model = row[3] || ''; // D열
        const color = row[4] || ''; // E열

        if (!statusByOffice[office]) {
          statusByOffice[office] = {
            office,
            totalCount: 0,
            models: {}
          };
        }

        statusByOffice[office].totalCount++;

        const modelKey = `${model}_${color}`;
        if (!statusByOffice[office].models[modelKey]) {
          statusByOffice[office].models[modelKey] = {
            model,
            color,
            count: 0
          };
        }
        statusByOffice[office].models[modelKey].count++;
      });

      // 배열로 변환
      const result = Object.values(statusByOffice).map(office => ({
        ...office,
        models: Object.values(office.models)
      }));

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching normalized status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch normalized status',
        message: error.message
      });
    }
  });

  // POST /api/inventory/manual-assignment - 수동 배정 실행
  router.post('/api/inventory/manual-assignment', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🔧 [수동배정] 수동 배정 실행 시작');

      const { reservationNumber, serialNumber, model, color } = req.body;

      if (!reservationNumber || !serialNumber) {
        return res.status(400).json({
          success: false,
          error: '예약번호와 시리얼번호가 필요합니다.'
        });
      }

      // 재고 시트에서 해당 시리얼번호 찾기
      const inventoryValues = await getSheetValues('폰클재고데이터');
      const inventoryRows = inventoryValues.slice(1);

      let targetRowIndex = -1;
      inventoryRows.forEach((row, index) => {
        if (row[0] === serialNumber) {
          targetRowIndex = index + 2; // 헤더 포함
        }
      });

      if (targetRowIndex === -1) {
        return res.status(404).json({
          success: false,
          error: '해당 시리얼번호를 찾을 수 없습니다.'
        });
      }

      // 배정 처리
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `폰클재고데이터!A${targetRowIndex}:Z${targetRowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[
              serialNumber,
              model,
              color,
              reservationNumber,
              '배정완료',
              new Date().toLocaleString('ko-KR')
            ]]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('inventory_');

      res.json({
        success: true,
        message: '수동 배정이 완료되었습니다.'
      });
    } catch (error) {
      console.error('Error executing manual assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute manual assignment',
        message: error.message
      });
    }
  });

  // GET /api/inventory/activation-status - 실시간 개통 상태 확인
  router.get('/api/inventory/activation-status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📱 [개통상태] 실시간 개통 상태 확인 시작');

      const { serialNumber } = req.query;

      if (!serialNumber) {
        return res.status(400).json({
          success: false,
          error: '시리얼번호가 필요합니다.'
        });
      }

      // 개통 데이터 조회
      const activationValues = await getSheetValues('폰클개통데이터');
      const activationRows = activationValues.slice(1);

      const activationInfo = activationRows.find(row => row[0] === serialNumber);

      if (!activationInfo) {
        return res.json({
          success: true,
          data: {
            serialNumber,
            activated: false,
            message: '개통 정보가 없습니다.'
          }
        });
      }

      res.json({
        success: true,
        data: {
          serialNumber,
          activated: true,
          activationDate: activationInfo[1] || '',
          customerName: activationInfo[2] || '',
          phoneNumber: activationInfo[3] || ''
        }
      });
    } catch (error) {
      console.error('Error checking activation status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check activation status',
        message: error.message
      });
    }
  });

  // GET /api/inventory/agent-filters - 대리점 필터 목록 조회 (원본 로직)
  router.get('/api/inventory/agent-filters', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('🔍 [대리점필터] 대리점 필터 목록 조회 시작');

      // 캐시 키 생성
      const cacheKey = 'inventory_agent_filters';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 대리점 필터 캐시 히트');
        return res.json(cached);
      }

      // 폰클재고데이터와 폰클개통데이터 병렬로 가져오기
      const [inventoryValues, activationValues] = await Promise.all([
        getSheetValues('폰클재고데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      if (!inventoryValues || inventoryValues.length < 4) {
        throw new Error('폰클재고데이터를 가져올 수 없습니다.');
      }

      if (!activationValues || activationValues.length < 4) {
        throw new Error('폰클개통데이터를 가져올 수 없습니다.');
      }

      // 실제 재고가 있는 담당자 추출
      const agentsWithInventory = new Set();
      const agentsWithActivation = new Set();
      const agentInfo = new Map(); // key: 담당자명, value: { office, department }

      // 재고 데이터에서 담당자 추출
      inventoryValues.slice(3).forEach(row => {
        if (row.length >= 23) {
          const modelName = (row[13] || '').toString().trim(); // N열: 모델명
          const category = (row[5] || '').toString().trim(); // F열: 구분
          const office = (row[6] || '').toString().trim(); // G열: 사무실
          const department = (row[7] || '').toString().trim(); // H열: 소속
          const agent = (row[8] || '').toString().trim(); // I열: 담당자

          if (modelName && category !== '#N/A' && agent) {
            agentsWithInventory.add(agent);
            if (!agentInfo.has(agent)) {
              agentInfo.set(agent, { office, department });
            }
          }
        }
      });

      // 개통 데이터에서 담당자 추출 (당월)
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      activationValues.slice(3).forEach(row => {
        if (row.length >= 23) {
          const activationDate = (row[9] || '').toString().trim(); // J열: 개통일
          const modelName = (row[21] || '').toString().trim(); // V열: 모델명
          const office = (row[6] || '').toString().trim(); // G열: 사무실
          const department = (row[7] || '').toString().trim(); // H열: 소속
          const agent = (row[8] || '').toString().trim(); // I열: 담당자

          if (activationDate && modelName && agent) {
            // 날짜 파싱 (2025-08-02 형식에서 날짜 추출)
            const dateMatch = activationDate.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              const [, year, month] = dateMatch;
              const activationYear = parseInt(year);
              const activationMonth = parseInt(month);

              // 현재 월의 데이터만 처리
              if (activationYear === currentYear && activationMonth === currentMonth) {
                agentsWithActivation.add(agent);
                if (!agentInfo.has(agent)) {
                  agentInfo.set(agent, { office, department });
                }
              }
            }
          }
        }
      });

      // 보유재고와 개통재고가 있는 담당자 통합
      const allAgentsWithData = new Set([...agentsWithInventory, ...agentsWithActivation]);

      // 결과 데이터 구성
      const result = {
        success: true,
        data: Array.from(allAgentsWithData).map(agent => ({
          target: agent,
          contactId: agent,
          office: agentInfo.get(agent)?.office || '',
          department: agentInfo.get(agent)?.department || '',
          hasInventory: agentsWithInventory.has(agent),
          hasActivation: agentsWithActivation.has(agent)
        })).sort((a, b) => a.target.localeCompare(b.target))
      };

      // 캐시 저장 (30분)
      cacheManager.set(cacheKey, result, 30 * 60 * 1000);

      res.json(result);
    } catch (error) {
      console.error('Error fetching agent filters:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch agent filters',
        message: error.message
      });
    }
  });

  // GET /api/inventory-analysis - 재고 현황 분석
  router.get('/api/inventory-analysis', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { storeCode } = req.query;

      console.log('📊 [재고분석] 재고 현황 분석 시작', storeCode ? `(대리점: ${storeCode})` : '');

      // 캐시 키 생성
      const cacheKey = `inventory_analysis_${storeCode || 'all'}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 재고 분석 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('폰클재고데이터');
      const headers = values[0] || [];
      let rows = values.slice(1);

      // 대리점 필터링
      if (storeCode) {
        const storeCodeIndex = headers.indexOf('대리점코드');
        if (storeCodeIndex !== -1) {
          rows = rows.filter(row => row[storeCodeIndex] === storeCode);
        }
      }

      // 분석 데이터 생성
      const analysis = {
        totalCount: rows.length,
        byModel: {},
        byColor: {},
        byStatus: {},
        byStore: {}
      };

      rows.forEach(row => {
        const model = row[headers.indexOf('모델명')] || '미지정';
        const color = row[headers.indexOf('색상')] || '미지정';
        const status = row[headers.indexOf('배정상태')] || '미지정';
        const store = row[headers.indexOf('대리점코드')] || '미지정';

        // 모델별 집계
        analysis.byModel[model] = (analysis.byModel[model] || 0) + 1;

        // 색상별 집계
        analysis.byColor[color] = (analysis.byColor[color] || 0) + 1;

        // 상태별 집계
        analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;

        // 대리점별 집계
        analysis.byStore[store] = (analysis.byStore[store] || 0) + 1;
      });

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, analysis, 5 * 60 * 1000);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error analyzing inventory:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze inventory',
        message: error.message
      });
    }
  });

  // GET /api/inventory/status - 모델별 재고 현황 (프론트엔드 형식에 맞춰 수정)
  router.get('/api/inventory/status', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { agent, office, department } = req.query;

      const cacheKey = `inventory_status_${agent || 'all'}_${office || 'all'}_${department || 'all'}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('폰클재고데이터');
      if (!values || values.length < 4) {
        return res.json({ success: true, data: [] });
      }

      let rows = values.slice(3); // 4행부터 데이터

      // 필터링 로직 (G, H, I열 기준: 6, 7, 8번 인덱스)
      if (agent || office || department) {
        rows = rows.filter(row => {
          if (agent && (row[8] || '').toString().trim() !== agent) return false;
          if (office && (row[6] || '').toString().trim() !== office) return false;
          if (department && (row[7] || '').toString().trim() !== department) return false;
          return true;
        });
      }

      // 모델/색상별 집계
      const modelMap = new Map();
      rows.forEach(row => {
        const modelName = (row[13] || '').toString().trim(); // N열
        const color = (row[14] || '').toString().trim();     // O열
        const type = (row[12] || '').toString().trim();      // M열

        if (!modelName || type === '유심') return;

        const key = `${modelName}|${color}`;
        if (!modelMap.has(key)) {
          modelMap.set(key, {
            modelName,
            color,
            inventoryCount: 0
          });
        }
        modelMap.get(key).inventoryCount++;
      });

      const result = {
        success: true,
        data: Array.from(modelMap.values())
      };

      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching inventory status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/inventory/status-by-color - 색상별 재고 현황
  router.get('/api/inventory/status-by-color', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { agent, office, department } = req.query;

      const cacheKey = `inventory_status_by_color_${agent}_${office}_${department}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('폰클재고데이터');
      let rows = values.slice(1);

      // 필터링 및 색상별 그룹화
      const byColor = {};
      rows.forEach(row => {
        const color = row[5] || '미지정';
        if (!byColor[color]) byColor[color] = [];
        byColor[color].push(row);
      });

      cacheManager.set(cacheKey, byColor, 5 * 60 * 1000);
      res.json(byColor);
    } catch (error) {
      console.error('Error fetching inventory status by color:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/inventory-inspection - 재고 검수
  router.get('/api/inventory-inspection', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'inventory_inspection';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('재고검수');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching inventory inspection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/company-inventory-details - 회사 재고 상세
  router.get('/api/company-inventory-details', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'company_inventory_details';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('회사재고상세');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching company inventory details:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/confirmed-unconfirmed-inventory - 확정/미확정 재고
  router.get('/api/confirmed-unconfirmed-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'confirmed_unconfirmed_inventory';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('확정미확정재고');
      const data = values.slice(1);

      const result = { success: true, data: data };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching confirmed/unconfirmed inventory:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/price-discrepancies - 입고가 상이 데이터 조회
  router.get('/api/price-discrepancies', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'price_discrepancies';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const [inventoryValues, activationValues] = await Promise.all([
        getSheetValues('폰클재고데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      const inventoryRows = inventoryValues.slice(3);
      const activationRows = activationValues.slice(3);

      const modelPriceMap = new Map();

      inventoryRows.forEach((row, index) => {
        const modelName = (row[13] || '').toString().trim(); // N열
        const inPrice = (row[17] || '').toString().trim();  // R열
        if (modelName && inPrice) {
          if (!modelPriceMap.has(modelName)) modelPriceMap.set(modelName, []);
          modelPriceMap.get(modelName).push({
            sheetName: '폰클재고데이터',
            rowIndex: index + 4,
            modelName,
            inPrice,
            outStore: (row[21] || '').toString().trim(),
            serial: (row[11] || '').toString().trim(),
            processDate: (row[22] || '').toString().trim()
          });
        }
      });

      activationRows.forEach((row, index) => {
        const modelName = (row[21] || '').toString().trim(); // V열
        const inPrice = (row[35] || '').toString().trim();  // AJ열
        if (modelName && inPrice) {
          if (!modelPriceMap.has(modelName)) modelPriceMap.set(modelName, []);
          modelPriceMap.get(modelName).push({
            sheetName: '폰클개통데이터',
            rowIndex: index + 4,
            modelName,
            inPrice,
            outStore: (row[14] || '').toString().trim(),
            serial: (row[23] || '').toString().trim(),
            processDate: (row[9] || '').toString().trim()
          });
        }
      });

      const discrepancies = [];
      modelPriceMap.forEach((items, modelName) => {
        const priceGroups = new Map();
        items.forEach(item => {
          const normalizedPrice = item.inPrice.replace(/[,\s]/g, '');
          if (!priceGroups.has(normalizedPrice)) priceGroups.set(normalizedPrice, []);
          priceGroups.get(normalizedPrice).push(item);
        });

        if (priceGroups.size > 1) {
          const priceBreakdown = Array.from(priceGroups.entries())
            .map(([price, groupItems]) => ({ price, count: groupItems.length }))
            .sort((a, b) => b.count - a.count);

          const recommendedPrice = priceBreakdown[0].price;
          discrepancies.push({
            modelName,
            recommendedPrice,
            confidence: parseFloat(((priceBreakdown[0].count / items.length) * 100).toFixed(1)),
            priceBreakdown,
            items: items.sort((a, b) => {
              const aP = a.inPrice.replace(/[,\s]/g, '');
              const bP = b.inPrice.replace(/[,\s]/g, '');
              if (aP !== recommendedPrice && bP === recommendedPrice) return -1;
              if (aP === recommendedPrice && bP !== recommendedPrice) return 1;
              return 0;
            })
          });
        }
      });

      const responseData = {
        success: true,
        data: {
          discrepancies: discrepancies.sort((a, b) => a.modelName.localeCompare(b.modelName)),
          totalDiscrepancies: discrepancies.length,
          totalItems: discrepancies.reduce((sum, d) => sum + d.items.length, 0)
        }
      };

      cacheManager.set(cacheKey, responseData, 5 * 60 * 1000);
      res.json(responseData);
    } catch (error) {
      console.error('Error fetching price discrepancies:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/phone-duplicates - 단말기 중복값 확인
  router.get('/api/phone-duplicates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'phone_duplicates';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const [inventoryValues, activationValues] = await Promise.all([
        getSheetValues('폰클재고데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      const inventoryRows = inventoryValues.slice(3);
      const activationRows = activationValues.slice(3);

      const phoneData = [];
      activationRows.forEach(row => {
        if (row[12] && row[12] !== '유심') {
          phoneData.push({
            store: row[14] || '', model: row[21] || '', color: row[22] || '',
            serial: row[23] || '', employee: row[77] || '', type: '개통'
          });
        }
      });

      inventoryRows.forEach(row => {
        if (row[12] && row[12] !== '유심') {
          phoneData.push({
            store: row[21] || '', model: row[13] || '', color: row[14] || '',
            serial: row[11] || '', employee: row[28] || '', type: '재고'
          });
        }
      });

      const duplicateMap = new Map();
      phoneData.forEach(item => {
        const cleanSerial = (item.serial || '').replace(/\s/g, '');
        if (!cleanSerial || cleanSerial.length < 6) return;
        const key = `${item.model}|${cleanSerial.slice(-6)}`;
        if (!duplicateMap.has(key)) duplicateMap.set(key, []);
        duplicateMap.get(key).push(item);
      });

      const duplicates = Array.from(duplicateMap.entries())
        .filter(([key, items]) => items.length > 1)
        .map(([key, items]) => ({ key, count: items.length, items }));

      const result = { success: true, data: { duplicates, totalDuplicates: duplicates.length } };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching phone duplicates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/sim-duplicates - 유심 중복값 확인
  router.get('/api/sim-duplicates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'sim_duplicates';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const [inventoryValues, activationValues] = await Promise.all([
        getSheetValues('폰클재고데이터'),
        getSheetValues('폰클개통데이터')
      ]);

      const inventoryRows = inventoryValues.slice(3);
      const activationRows = activationValues.slice(3);

      const simData = [];
      activationRows.forEach(row => {
        if (row[12] && row[12].includes('유심')) {
          simData.push({
            store: row[14] || '', model: row[24] || '', serial: row[25] || '',
            employee: row[77] || '', type: '개통'
          });
        }
      });

      inventoryRows.forEach(row => {
        if (row[12] && row[12].includes('유심')) {
          simData.push({
            store: row[21] || '', model: row[13] || '', serial: row[11] || '',
            employee: row[28] || '', type: '재고'
          });
        }
      });

      const duplicateMap = new Map();
      simData.forEach(item => {
        const cleanSerial = (item.serial || '').replace(/\s/g, '');
        if (!cleanSerial || cleanSerial.length < 6) return;
        const key = `${item.model}|${cleanSerial.slice(-6)}`;
        if (!duplicateMap.has(key)) duplicateMap.set(key, []);
        duplicateMap.get(key).push(item);
      });

      const duplicates = Array.from(duplicateMap.entries())
        .filter(([key, items]) => items.length > 1)
        .map(([key, items]) => ({ key, count: items.length, items }));

      const result = { success: true, data: { duplicates, totalDuplicates: duplicates.length } };
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      res.json(result);
    } catch (error) {
      console.error('Error fetching sim duplicates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = createInventoryRoutes;
