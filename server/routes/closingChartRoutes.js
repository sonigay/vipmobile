/**
 * Closing Chart Routes
 * 
 * 마감장표 관련 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/closing-chart - 마감장표 데이터 조회
 * 
 * Requirements: 1.1, 1.2
 */

const express = require('express');

/**
 * Closing Chart Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @param {Object} context.cacheManager - Cache Manager
 * @returns {express.Router} Express 라우터
 */
function createClosingChartRoutes(context) {
  const router = express.Router();
  const { sheetsClient, rateLimiter, cacheManager } = context;
  const { cache } = require('../cacheMonitor');

  // 내부 헬퍼 함수: 시트 데이터 가져오기
  async function getSheetValues(sheetName) {
    try {
      if (!sheetsClient || !sheetsClient.sheets) {
        console.warn(`[ClosingChart] Sheets client not available for ${sheetName}`);
        return [];
      }

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: sheetName
        })
      );

      return response.data.values || [];
    } catch (error) {
      console.warn(`[ClosingChart] Failed to load sheet '${sheetName}': ${error.message}`);
      return [];
    }
  }

  function invalidatePhoneklActivationCache() {
    // 필요한 경우 구현하거나, cacheMonitor를 통해 관리
    // 여기서는 빈 함수로 둠
  }

  // ========================================
  // 마감장표 API
  // ========================================

  // 마감장표 데이터 조회 API
  router.get('/closing-chart', async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      console.log(`마감장표 데이터 조회 시작: ${targetDate}`);

      // 캐시 키 생성
      const cacheKey = `closing_chart_${targetDate}`;

      // 캐시 확인
      if (cache.has(cacheKey)) {
        console.log('캐시된 마감장표 데이터 반환');
        return res.json(cache.get(cacheKey));
      }

      // 필요한 시트 데이터 로드 (병렬 처리)
      const [
        phoneklData,
        storeData,
        inventoryData,
        operationModelData,
        customerData,
        salesTargetData,
        phoneklHomeData
      ] = await Promise.all([
        getSheetValues('폰클개통데이터!A:BZ'), // 범위 명시
        getSheetValues('폰클출고처데이터!A:Z'),
        getSheetValues('폰클재고데이터!A:Z'),
        getSheetValues('운영모델!A:Z'),
        getSheetValues('거래처정보!A:Z'),
        getSheetValues('영업사원목표!A:Z'),
        getSheetValues('폰클홈데이터!A:Z')
      ]);

      // 제외 조건 설정
      const excludedAgents = getExcludedAgents(salesTargetData);
      const excludedStores = getExcludedStores(inventoryData);

      // 데이터 처리
      const processedData = processClosingChartData({
        phoneklData,
        storeData,
        inventoryData,
        operationModelData,
        customerData,
        salesTargetData,
        phoneklHomeData,
        targetDate,
        excludedAgents,
        excludedStores
      });

      // 캐시 저장 (1분으로 단축 - 빠른 업데이트를 위해)
      cache.set(cacheKey, processedData, 60);

      console.log('마감장표 데이터 처리 완료');
      res.json(processedData);

    } catch (error) {
      console.error('마감장표 데이터 조회 오류:', error);
      res.status(500).json({ error: '마감장표 데이터 조회 중 오류가 발생했습니다.' });
    }
  });

  // 제외된 담당자 목록 조회
  function getExcludedAgents(salesTargetData) {
    if (!salesTargetData || salesTargetData.length < 2) return [];

    const excluded = [];
    for (let i = 1; i < salesTargetData.length; i++) {
      const row = salesTargetData[i];
      if (row.length > 2 && row[2] === 'Y') { // C열: 제외여부
        excluded.push(row[0]); // A열: 담당자명
      }
    }
    return excluded;
  }

  // 제외된 출고처 목록 조회
  function getExcludedStores(inventoryData) {
    if (!inventoryData || inventoryData.length < 7) return [];

    const excluded = [];
    for (let i = 6; i < inventoryData.length; i++) { // E7:E부터 시작
      const row = inventoryData[i];
      if (row.length > 4) {
        const storeName = (row[4] || '').toString(); // E열
        if (storeName.includes('사무실') || storeName.includes('거래종료') || storeName.includes('본점판매')) {
          excluded.push(storeName);
        }
      }
    }
    return excluded;
  }

  // 마감장표 데이터 처리
  function processClosingChartData({ phoneklData, storeData, inventoryData, operationModelData, customerData, salesTargetData, phoneklHomeData, targetDate, excludedAgents, excludedStores }) {
    // 운영모델 필터링 (휴대폰만)
    const phoneModels = new Set();

    if (operationModelData && operationModelData.length > 0) {
      operationModelData.forEach((row, index) => {
        if (row.length > 0) {
          const category = (row[0] || '').toString(); // A열: 구분 (휴대폰/워치/TAB)
          const modelName = (row[2] || '').toString(); // C열: 모델명

          if (category === '휴대폰' && modelName) {
            phoneModels.add(modelName);
          }
        }
      });
    }

    // 개통 데이터 필터링
    const dataRows = phoneklData.slice(3); // 헤더 제외
    console.log('🔍 [CS 디버깅] 원본 데이터 행 수:', dataRows.length);

    let filteredCount = 0;
    let lengthFilteredCount = 0;
    let dateFilteredCount = 0;
    let modelFilteredCount = 0;
    let planFilteredCount = 0;
    let conditionFilteredCount = 0;
    let typeFilteredCount = 0;

    const filteredPhoneklData = dataRows.filter(row => {
      if (row.length < 10) {
        lengthFilteredCount++;
        return false;
      }

      const activationDate = (row[9] || '').toString(); // J열: 개통일
      const model = (row[21] || '').toString(); // V열: 모델명
      const planType = (row[19] || '').toString(); // T열: 요금제
      const condition = (row[12] || '').toString(); // M열: 상태
      const type = (row[16] || '').toString(); // Q열: 유형

      // 날짜 필터링
      const targetDateObj = new Date(targetDate);
      const activationDateObj = new Date(activationDate);
      if (isNaN(activationDateObj.getTime()) || activationDateObj > targetDateObj) {
        dateFilteredCount++;
        return false;
      }

      // 모델 필터링 (휴대폰만)
      if (!phoneModels.has(model)) {
        modelFilteredCount++;
        return false;
      }

      // 제외 조건
      if (planType.includes('선불')) {
        planFilteredCount++;
        return false;
      }
      if (condition.includes('중고')) {
        conditionFilteredCount++;
        return false;
      }
      if (type.includes('중고') || type.includes('유심')) {
        typeFilteredCount++;
        return false;
      }

      filteredCount++;
      return true;
    });

    console.log('🔍 [CS 디버깅] 필터링 결과:');
    console.log('🔍 [CS 디버깅] - 원본 행 수:', dataRows.length);
    console.log('🔍 [CS 디버깅] - 필터링된 행 수:', filteredPhoneklData.length);
    console.log('🔍 [CS 디버깅] - 행 길이 부족으로 제외:', lengthFilteredCount);
    console.log('🔍 [CS 디버깅] - 날짜 조건으로 제외:', dateFilteredCount);
    console.log('🔍 [CS 디버깅] - 모델 조건으로 제외:', modelFilteredCount);
    console.log('🔍 [CS 디버깅] - 요금제 조건으로 제외:', planFilteredCount);
    console.log('🔍 [CS 디버깅] - 상태 조건으로 제외:', conditionFilteredCount);
    console.log('🔍 [CS 디버깅] - 유형 조건으로 제외:', typeFilteredCount);

    // 지원금 계산
    const supportBonusData = calculateSupportBonus(filteredPhoneklData, excludedAgents);

    // 목표값 데이터 처리
    const targets = new Map();
    if (salesTargetData && salesTargetData.length > 1) {
      salesTargetData.slice(1).forEach(row => {
        const agent = row[0] || '';
        const code = row[1] || '';
        const target = parseInt(row[2]) || 0;
        const excluded = row[3] === 'Y';
        const key = `${agent}|${code}`;
        targets.set(key, { agent, code, target, excluded });
      });
    }

    // 통합 매칭 키 데이터 생성
    const { matchingKeyMap, matchingMismatches } = createUnifiedMatchingKeyData(filteredPhoneklData, storeData, inventoryData, excludedAgents, excludedStores, targets, customerData);

    // 각 집계별로 데이터 추출 (Map.values()로 배열 변환)
    const codeData = aggregateByCodeFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.codeSupportMap);
    const officeData = aggregateByOfficeFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.officeSupportMap);
    const departmentData = aggregateByDepartmentFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.departmentSupportMap);
    const agentData = aggregateByAgentFromUnified(Array.from(matchingKeyMap.values()), supportBonusData.agentSupportMap);

    // CS 개통 요약
    const csSummary = calculateCSSummary(filteredPhoneklData, phoneklHomeData, targetDate, phoneModels, excludedAgents);

    // 매핑 실패 데이터
    const mappingFailures = findMappingFailures(filteredPhoneklData, storeData);

    return {
      date: targetDate,
      codeData,
      officeData,
      departmentData,
      agentData,
      csSummary,
      mappingFailures,
      excludedAgents,
      excludedStores,
      matchingMismatches // 매칭 불일치 데이터 추가
    };
  }

  // 통합 매칭 키 생성 함수
  function createMatchingKey(row) {
    const agent = (row[8] || '').toString();        // I열: 담당자
    const department = (row[7] || '').toString();   // H열: 소속
    const office = (row[6] || '').toString();       // G열: 사무실
    const code = (row[4] || '').toString();         // E열: 코드명

    return `${agent}|${department}|${office}|${code}`;
  }


  // 통합 매칭 키 데이터 생성
  function createUnifiedMatchingKeyData(phoneklData, storeData, inventoryData, excludedAgents, excludedStores, targets, customerData) {
    const matchingKeyMap = new Map();

    // 1단계: 개통 데이터로 기본 정보 생성
    phoneklData.forEach(row => {
      const agent = (row[8] || '').toString();
      if (excludedAgents.includes(agent)) return;

      const key = createMatchingKey(row);

      if (!matchingKeyMap.has(key)) {
        matchingKeyMap.set(key, {
          agent: row[8],           // I열: 담당자
          department: row[7],      // H열: 소속
          office: row[6],          // G열: 사무실
          code: row[4],            // E열: 코드
          performance: 0,           // 개통 건수
          fee: 0,                  // 수수료
          registeredStores: 0,     // 등록점
          activeStores: 0,         // 가동점
          devices: 0,              // 보유단말
          sims: 0,                 // 보유유심
          target: 0,               // 목표값
          support: 0               // 지원금
        });
      }

      const data = matchingKeyMap.get(key);
      data.performance++;

      // 수수료 처리
      const rawFee = row[3];
      if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
        data.fee += parseFloat(rawFee) || 0;
      }
    });

    // 2단계: 목표값 적용
    targets.forEach((targetInfo, targetKey) => {
      if (targetInfo.excluded) return;

      // 해당 담당자-코드 조합에 목표값 적용
      matchingKeyMap.forEach((data, key) => {
        if (data.agent === targetInfo.agent && data.code === targetInfo.code) {
          data.target += targetInfo.target;
        }
      });
    });

    // 3단계: 출고처 데이터로 등록점 계산 (거래처정보 기반)
    console.log('🔍 [디버깅] customerData 확인:', {
      customerDataExists: !!customerData,
      customerDataLength: customerData ? customerData.length : 'undefined',
      customerDataSample: customerData && customerData.length > 0 ? customerData[0] : 'empty'
    });

    // 매칭 불일치 데이터 수집
    const matchingMismatches = [];

    if (storeData && customerData && customerData.length > 0) {
      // 각 매칭키별로 정확한 출고처 찾기
      matchingKeyMap.forEach((data, key) => {
        const matchingStores = new Set();

        // 김수빈 전용 디버깅: customerData 전체 확인
        if (data.agent === '김수빈') {
          console.log('🔍 [김수빈] customerData 전체 확인:', {
            customerDataLength: customerData.length,
            customerDataSample: customerData.slice(0, 5).map(row => ({
              담당자: row[3] || 'undefined',
              코드: row[1] || 'undefined',
              출고처: row[2] || 'undefined'
            }))
          });
        }

        // 거래처정보에서 해당 매칭키(담당자+코드)에 해당하는 출고처 찾기
        customerData.forEach(거래처Row => {
          if (거래처Row.length > 3) {
            const 거래처코드 = (거래처Row[1] || '').toString(); // B열: 코드명
            const 거래처출고처 = (거래처Row[2] || '').toString(); // C열: 출고처명
            const 거래처담당자 = (거래처Row[3] || '').toString().replace(/\([^)]*\)/g, ''); // D열: 담당자명 (괄호와 내용 모두 제거)

            // 김수빈 전용 디버깅: 지우모바일 관련만 로그 출력
            if (data.agent === '김수빈' && 거래처출고처.includes('지우모바일')) {
              console.log('🔍 [김수빈] 지우모바일 매칭 조건 확인:', {
                거래처담당자,
                dataAgent: data.agent,
                거래처코드,
                dataCode: data.code,
                거래처출고처,
                담당자매칭: 거래처담당자 === data.agent,
                코드매칭: 거래처코드 === data.code,
                출고처존재: !!거래처출고처
              });
            }

            // 해당 매칭키와 정확히 매칭되는 데이터만 처리
            if (거래처담당자 === data.agent && 거래처코드 === data.code && 거래처출고처) {

              // 김수빈 전용 상세 디버깅
              if (data.agent === '김수빈') {
                console.log('🔍 [김수빈] 거래처정보 매칭 성공:', {
                  거래처담당자,
                  거래처코드,
                  거래처출고처,
                  매칭키: key
                });
              }

              // 폰클출고처데이터에서 해당 출고처가 등록되어 있는지 확인 (코드명까지 매칭)
              const isRegistered = storeData.some(storeRow => {
                if (storeRow.length > 21) {
                  const storeAgent = (storeRow[21] || '').toString().replace(/\([^)]*\)/g, ''); // V열: 담당자 (괄호와 내용 모두 제거)
                  const storeCodeName = (storeRow[7] || '').toString(); // H열: 코드명
                  const storeCode = (storeRow[14] || '').toString(); // O열: 출고처코드

                  // 담당자명 매칭: 정확히 일치하거나 포함 관계
                  const agentMatches = storeAgent === 거래처담당자 ||
                    storeAgent.includes(거래처담당자) ||
                    거래처담당자.includes(storeAgent);

                  // 김수빈 전용 디버깅: 매칭 과정 상세 추적
                  if (data.agent === '김수빈') {
                    console.log('🔍 [김수빈] 매칭 과정 상세:', {
                      출고처: 거래처출고처,
                      거래처담당자,
                      거래처코드,
                      storeCode,
                      storeAgent,
                      storeCodeName,
                      agentMatches,
                      codeMatches: storeCode === 거래처출고처,
                      nameMatches: storeCodeName === 거래처코드
                    });
                  }

                  return storeCode === 거래처출고처 && agentMatches && storeCodeName === 거래처코드;
                }
                return false;
              });

              if (isRegistered) {
                matchingStores.add(거래처출고처);

                // 김수빈 전용 디버깅: 매칭 성공
                if (data.agent === '김수빈') {
                  console.log('🔍 [김수빈] 폰클출고처데이터 매칭 성공:', {
                    출고처: 거래처출고처,
                    거래처담당자,
                    거래처코드
                  });
                }
              } else {
                // 매칭 불일치 데이터 수집
                const storeMismatch = storeData.find(row =>
                  row.length > 21 && (row[14] || '').toString() === 거래처출고처
                );

                if (storeMismatch) {
                  const storeAgent = (storeMismatch[21] || '').toString();
                  const storeCodeName = (storeMismatch[7] || '').toString();

                  matchingMismatches.push({
                    type: '출고처',
                    거래처정보: {
                      담당자: 거래처담당자,
                      코드: 거래처코드,
                      출고처: 거래처출고처
                    },
                    폰클출고처데이터: {
                      담당자: storeAgent,
                      코드: storeCodeName,
                      출고처: (storeMismatch[14] || '').toString()
                    }
                  });
                }

                // 김수빈 전용 디버깅: 매칭 실패 원인 확인
                if (data.agent === '김수빈') {
                  console.log('🔍 [김수빈] 출고처 매칭 실패:', {
                    거래처출고처: 거래처출고처,
                    거래처담당자: 거래처담당자,
                    폰클출고처데이터_담당자들: storeData
                      .filter(row => row.length > 21 && (row[14] || '').toString() === 거래처출고처)
                      .map(row => (row[21] || '').toString())
                  });
                }
              }
            }
          }
        });

        data.registeredStores = matchingStores.size;

        // 가동점 계산 (등록점 중에서 개통 실적이 있는 출고처)
        let activeCount = 0;
        matchingStores.forEach(storeCode => {
          const hasPerformance = phoneklData.some(performanceRow => {
            if (performanceRow.length > 14) {
              const performanceStoreCode = (performanceRow[14] || '').toString(); // O열: 출고처
              const performanceAgent = (performanceRow[8] || '').toString(); // I열: 담당자
              const performanceDepartment = (performanceRow[7] || '').toString(); // H열: 소속
              const performanceOffice = (performanceRow[6] || '').toString(); // G열: 사무실
              const performanceCode = (performanceRow[4] || '').toString(); // E열: 코드

              // 코드가 비어있거나 담당자가 비어있으면 제외
              if (!performanceCode.trim() || !performanceAgent.trim()) return false;

              // 해당 매칭키와 정확히 매칭되고, 등록점에 포함된 출고처인지 확인
              return performanceStoreCode === storeCode &&
                performanceAgent === data.agent &&
                performanceDepartment === data.department &&
                performanceOffice === data.office &&
                performanceCode === data.code;
            }
            return false;
          });

          if (hasPerformance) {
            activeCount++;
          }
        });
        data.activeStores = activeCount;

        // 김수빈 전용 디버깅: 출고처 결과 확인
        if (data.agent === '김수빈') {
          console.log('🔍 [김수빈] 출고처 결과:', {
            매칭키: key,
            등록점: data.registeredStores,
            가동점: data.activeStores,
            출고처목록: Array.from(matchingStores)
          });
        }
      });
    }

    // 매칭 불일치 데이터 로그 출력
    if (matchingMismatches.length > 0) {
      // 매칭 불일치 데이터 수집 완료 (로그 제거)
    }

    // 4단계: 재고 데이터로 보유단말/유심 계산 (거래처정보 기반)
    if (inventoryData && customerData && customerData.length > 0) {
      // 각 매칭키별로 정확한 재고 찾기
      matchingKeyMap.forEach((data, key) => {
        let devices = 0;
        let sims = 0;

        // 거래처정보에서 해당 매칭키(담당자+코드)에 해당하는 출고처 찾기
        customerData.forEach(거래처Row => {
          if (거래처Row.length > 3) {
            const 거래처코드 = (거래처Row[1] || '').toString(); // B열: 코드명
            const 거래처출고처 = (거래처Row[2] || '').toString(); // C열: 출고처명
            const 거래처담당자 = (거래처Row[3] || '').toString().replace(/\([^)]*\)/g, ''); // D열: 담당자명 (괄호와 내용 모두 제거)

            // 해당 매칭키와 정확히 매칭되는 데이터만 처리
            if (거래처담당자 === data.agent && 거래처코드 === data.code && 거래처출고처) {
              // 폰클재고데이터에서 해당 출고처의 재고 찾기 (코드명까지 매칭)
              inventoryData.forEach(inventoryRow => {
                if (inventoryRow.length > 8) {
                  const inventoryAgent = (inventoryRow[8] || '').toString().replace(/\([^)]*\)/g, ''); // I열: 담당자 (괄호와 내용 모두 제거)
                  const inventoryCodeName = (inventoryRow[3] || '').toString(); // D열: 코드명
                  const inventoryType = (inventoryRow[12] || '').toString(); // M열: 유형
                  const inventoryStore = (inventoryRow[21] || '').toString(); // V열: 출고처

                  if (excludedAgents.includes(inventoryAgent)) return;
                  if (excludedStores.includes(inventoryStore)) return;

                  // 해당 매칭키와 정확히 매칭되는 재고만 추가 (코드명까지 확인)
                  // 담당자명 매칭: 정확히 일치하거나 포함 관계
                  const agentMatches = inventoryAgent === 거래처담당자 ||
                    inventoryAgent.includes(거래처담당자) ||
                    거래처담당자.includes(inventoryAgent);

                  if (agentMatches && inventoryStore === 거래처출고처 && inventoryCodeName === 거래처코드) {
                    if (inventoryType === '유심') {
                      sims++;
                    } else {
                      devices++;
                    }
                  }
                }
              });
            }
          }
        });

        data.devices = devices;
        data.sims = sims;

        // 김수빈 전용 디버깅: 재고 결과 확인
        if (data.agent === '김수빈') {
          console.log('🔍 [김수빈] 재고 결과:', {
            매칭키: key,
            보유단말: data.devices,
            보유유심: data.sims
          });
        }
      });
    }

    // 5단계: 추가 계산
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    matchingKeyMap.forEach(data => {
      data.expectedClosing = Math.round(data.performance / today.getDate() * daysInMonth);
      data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
      data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
      data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
    });

    return { matchingKeyMap, matchingMismatches };
  }


  // 지원금 계산 함수
  function calculateSupportBonus(phoneklData, excludedAgents) {
    // 1단계: 담당자별 총수수료 집계 (조합별)
    const agentCombinationMap = new Map();

    phoneklData.forEach(row => {
      const agent = (row[8] || '').toString(); // I열: 담당자
      const code = (row[4] || '').toString(); // E열: 코드
      const office = (row[6] || '').toString(); // G열: 사무실
      const department = (row[7] || '').toString(); // H열: 소속

      if (!agent || excludedAgents.includes(agent)) return;

      const combinationKey = `${agent}|${code}|${office}|${department}`;

      // #N/A 값 처리
      const rawFee = row[3];
      let fee = 0;

      if (rawFee && rawFee !== '#N/A' && rawFee !== 'N/A') {
        fee = parseFloat(rawFee) || 0;
      }

      if (!agentCombinationMap.has(combinationKey)) {
        agentCombinationMap.set(combinationKey, {
          agent,
          code,
          office,
          department,
          fee: 0
        });
      }

      agentCombinationMap.get(combinationKey).fee += fee;
    });

    // 2단계: 담당자별 총수수료 집계
    const agentTotalMap = new Map();

    agentCombinationMap.forEach((data, key) => {
      const agent = data.agent;

      if (!agentTotalMap.has(agent)) {
        agentTotalMap.set(agent, {
          agent,
          totalFee: 0,
          combinations: []
        });
      }

      agentTotalMap.get(agent).totalFee += data.fee;
      agentTotalMap.get(agent).combinations.push(data);
    });

    // 3단계: 담당자별 총수수료 기준 상위 1~5위 선정
    const sortedAgents = Array.from(agentTotalMap.values())
      .sort((a, b) => b.totalFee - a.totalFee)
      .slice(0, 5);

    // 4단계: 각 조합별 지원금 계산
    const supportRates = [0.10, 0.08, 0.06, 0.04, 0.02]; // 10%, 8%, 6%, 4%, 2%

    sortedAgents.forEach((agentData, index) => {
      const supportRate = supportRates[index];

      agentData.combinations.forEach(combination => {
        combination.support = combination.fee * supportRate;
      });
    });

    // 5단계: 그룹별 지원금 합계 계산
    const officeSupportMap = new Map();
    const departmentSupportMap = new Map();
    const agentSupportMap = new Map();
    const codeSupportMap = new Map();

    agentCombinationMap.forEach((data, key) => {
      const support = data.support || 0;

      // 코드별 합계
      if (data.code) {
        if (!codeSupportMap.has(data.code)) {
          codeSupportMap.set(data.code, 0);
        }
        codeSupportMap.set(data.code, codeSupportMap.get(data.code) + support);
      }

      // 사무실별 합계
      if (data.office) {
        if (!officeSupportMap.has(data.office)) {
          officeSupportMap.set(data.office, 0);
        }
        officeSupportMap.set(data.office, officeSupportMap.get(data.office) + support);
      }

      // 소속별 합계
      if (data.department) {
        if (!departmentSupportMap.has(data.department)) {
          departmentSupportMap.set(data.department, 0);
        }
        departmentSupportMap.set(data.department, departmentSupportMap.get(data.department) + support);
      }

      // 담당자별 합계
      if (data.agent) {
        if (!agentSupportMap.has(data.agent)) {
          agentSupportMap.set(data.agent, 0);
        }
        agentSupportMap.set(data.agent, agentSupportMap.get(data.agent) + support);
      }
    });

    return {
      codeSupportMap,
      officeSupportMap,
      departmentSupportMap,
      agentSupportMap
    };
  }

  // 통합 데이터에서 코드별 집계 추출
  function aggregateByCodeFromUnified(unifiedData, codeSupportMap) {
    const codeMap = new Map();

    unifiedData.forEach((data, key) => {
      const code = data.code;

      if (!codeMap.has(code)) {
        codeMap.set(code, {
          code,
          performance: 0,
          fee: 0,
          support: 0,
          target: 0,
          achievement: 0,
          expectedClosing: 0,
          rotation: 0,
          registeredStores: 0,
          activeStores: 0,
          devices: 0,
          sims: 0,
          utilization: 0
        });
      }

      const codeData = codeMap.get(code);
      codeData.performance += data.performance;
      codeData.fee += data.fee;
      codeData.target += data.target;
      codeData.registeredStores += data.registeredStores;
      codeData.activeStores += data.activeStores;
      codeData.devices += data.devices;
      codeData.sims += data.sims;
    });

    // 추가 계산
    codeMap.forEach(data => {
      data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
      data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
      data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
      data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
      data.support = codeSupportMap ? (codeSupportMap.get(data.code) || 0) : 0;
    });

    return Array.from(codeMap.values()).sort((a, b) => b.fee - a.fee);
  }

  // 통합 데이터에서 사무실별 집계 추출
  function aggregateByOfficeFromUnified(unifiedData, officeSupportMap) {
    const officeMap = new Map();

    unifiedData.forEach((data, key) => {
      const office = data.office;

      if (!officeMap.has(office)) {
        officeMap.set(office, {
          office,
          performance: 0,
          fee: 0,
          support: 0,
          target: 0,
          achievement: 0,
          expectedClosing: 0,
          rotation: 0,
          registeredStores: 0,
          activeStores: 0,
          devices: 0,
          sims: 0,
          utilization: 0
        });
      }

      const officeData = officeMap.get(office);
      officeData.performance += data.performance;
      officeData.fee += data.fee;
      officeData.target += data.target;
      officeData.registeredStores += data.registeredStores;
      officeData.activeStores += data.activeStores;
      officeData.devices += data.devices;
      officeData.sims += data.sims;
    });

    // 추가 계산
    officeMap.forEach(data => {
      data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
      data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
      data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
      data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
      data.support = officeSupportMap ? (officeSupportMap.get(data.office) || 0) : 0;
    });

    return Array.from(officeMap.values()).sort((a, b) => b.performance - a.performance);
  }

  // 통합 데이터에서 소속별 집계 추출
  function aggregateByDepartmentFromUnified(unifiedData, departmentSupportMap) {
    const departmentMap = new Map();

    unifiedData.forEach((data, key) => {
      const department = data.department;

      if (!departmentMap.has(department)) {
        departmentMap.set(department, {
          department,
          performance: 0,
          fee: 0,
          support: 0,
          target: 0,
          achievement: 0,
          expectedClosing: 0,
          rotation: 0,
          registeredStores: 0,
          activeStores: 0,
          devices: 0,
          sims: 0,
          utilization: 0
        });
      }

      const deptData = departmentMap.get(department);
      deptData.performance += data.performance;
      deptData.fee += data.fee;
      deptData.target += data.target;
      deptData.registeredStores += data.registeredStores;
      deptData.activeStores += data.activeStores;
      deptData.devices += data.devices;
      deptData.sims += data.sims;
    });

    // 추가 계산
    departmentMap.forEach(data => {
      data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
      data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
      data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
      data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
      data.support = departmentSupportMap ? (departmentSupportMap.get(data.department) || 0) : 0;
    });

    return Array.from(departmentMap.values()).sort((a, b) => b.fee - a.fee);
  }

  // 통합 데이터에서 담당자별 집계 추출
  function aggregateByAgentFromUnified(unifiedData, agentSupportMap) {
    const agentMap = new Map();

    unifiedData.forEach((data, key) => {
      const agent = data.agent;

      if (!agentMap.has(agent)) {
        agentMap.set(agent, {
          agent,
          performance: 0,
          fee: 0,
          support: 0,
          target: 0,
          achievement: 0,
          expectedClosing: 0,
          rotation: 0,
          registeredStores: 0,
          activeStores: 0,
          devices: 0,
          sims: 0,
          utilization: 0
        });
      }

      const agentData = agentMap.get(agent);
      agentData.performance += data.performance;
      agentData.fee += data.fee;
      agentData.target += data.target;
      agentData.registeredStores += data.registeredStores;
      agentData.activeStores += data.activeStores;
      agentData.devices += data.devices;
      agentData.sims += data.sims;
    });

    // 추가 계산
    agentMap.forEach(data => {
      data.expectedClosing = Math.round(data.performance / new Date().getDate() * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
      data.achievement = data.target > 0 ? Math.round((data.expectedClosing / data.target) * 100) : 0;
      data.utilization = data.registeredStores > 0 ? Math.round((data.activeStores / data.registeredStores) * 100) : 0;
      data.rotation = (data.expectedClosing + data.devices) > 0 ? Math.round((data.expectedClosing / (data.expectedClosing + data.devices)) * 100) : 0;
      data.support = agentSupportMap ? (agentSupportMap.get(data.agent) || 0) : 0;
    });

    return Array.from(agentMap.values()).sort((a, b) => b.fee - a.fee);
  }


  // CS 개통 요약 계산 (무선 + 유선)
  function calculateCSSummary(filteredPhoneklData, phoneklHomeData, targetDate, phoneModels, excludedAgents) {
    console.log('🔍 [CS 디버깅] calculateCSSummary 시작');
    console.log('🔍 [CS 디버깅] filteredPhoneklData 길이:', filteredPhoneklData.length);
    console.log('🔍 [CS 디버깅] targetDate:', targetDate);
    console.log('🔍 [CS 디버깅] phoneModels 크기:', phoneModels.size);

    const csAgents = new Map();
    let totalWireless = 0;
    let totalWired = 0;

    // BZ열에서 CS 직원들 명단 추출 (고유값) - 무선
    const csEmployeeSet = new Set();
    let bzColumnEmptyCount = 0;
    let bzColumnNCount = 0;
    let bzColumnValidCount = 0;

    filteredPhoneklData.forEach((row, index) => {
      const csEmployee = (row[77] || '').toString().trim(); // BZ열: CS직원

      if (!csEmployee || csEmployee === '') {
        bzColumnEmptyCount++;
      } else if (csEmployee === 'N' || csEmployee === 'NO') {
        bzColumnNCount++;
      } else {
        bzColumnValidCount++;
        csEmployeeSet.add(csEmployee);

        // 처음 5개 CS 직원명만 로그 출력
        if (bzColumnValidCount <= 5) {
          console.log(`🔍 [CS 디버깅] 유효한 CS 직원 ${bzColumnValidCount}: "${csEmployee}" (행 ${index + 4})`);
        }
      }
    });

    console.log('🔍 [CS 디버깅] BZ열 분석 결과:');
    console.log('🔍 [CS 디버깅] - 빈 값:', bzColumnEmptyCount);
    console.log('🔍 [CS 디버깅] - N/NO 값:', bzColumnNCount);
    console.log('🔍 [CS 디버깅] - 유효한 CS 직원:', bzColumnValidCount);
    console.log('🔍 [CS 디버깅] - 고유 CS 직원 수:', csEmployeeSet.size);
    console.log('🔍 [CS 디버깅] - 고유 CS 직원 목록:', Array.from(csEmployeeSet));

    // CN열에서 CS 직원들 명단 추출 (고유값) - 유선
    const wiredCSEmployees = new Set();
    if (phoneklHomeData) {
      // 헤더 제외 (3행까지 제외, 4행부터 데이터)
      const dataRows = phoneklHomeData.slice(3);

      // CN열에서 CS 직원 추출
      dataRows.forEach((row, index) => {
        const csEmployee = (row[91] || '').toString().trim(); // CN열: CS 직원
        if (csEmployee && csEmployee !== '' && csEmployee !== 'N' && csEmployee !== 'NO' &&
          (csEmployee.includes('MIN') || csEmployee.includes('VIP') || csEmployee.includes('등록'))) {
          wiredCSEmployees.add(csEmployee);
        }
      });
    }

    // 모든 CS 직원 통합
    csEmployeeSet.forEach(employee => wiredCSEmployees.add(employee));

    // 각 CS 직원별로 실적 계산 초기화
    wiredCSEmployees.forEach(csEmployee => {
      csAgents.set(csEmployee, { wireless: 0, wired: 0, total: 0 });
    });

    // 무선 개통 데이터 처리 (filteredPhoneklData 사용) - 모든 필터링이 이미 적용된 데이터
    let wirelessProcessed = 0;
    let rowLengthIssueCount = 0;
    let csEmployeeValidCount = 0;

    filteredPhoneklData.forEach((row, index) => {
      // 처음 5개 행의 길이와 BZ열 값 확인
      if (index < 5) {
        console.log(`🔍 [CS 디버깅] 행 ${index + 1} 길이: ${row.length}, BZ열(77): "${row[77] || '없음'}"`);
      }

      if (row.length < 78) {
        rowLengthIssueCount++;
        return; // 최소한 BZ열까지 있는지 확인
      }

      const csEmployee = (row[77] || '').toString().trim(); // BZ열: CS직원

      // CS 직원 필터링 (BZ열에 값이 있으면 CS 개통으로 간주)
      if (csEmployee && csEmployee !== '' && csEmployee !== 'N' && csEmployee !== 'NO') {
        totalWireless++;
        wirelessProcessed++;
        csEmployeeValidCount++;

        if (csAgents.has(csEmployee)) {
          csAgents.get(csEmployee).wireless++;
          csAgents.get(csEmployee).total++;
        }

        // 처음 3개 CS 개통만 상세 로그 출력
        if (csEmployeeValidCount <= 3) {
          const activationDate = (row[9] || '').toString(); // J열: 개통일
          const model = (row[21] || '').toString(); // V열: 모델명
          console.log(`🔍 [CS 디버깅] CS 개통 ${csEmployeeValidCount}: "${csEmployee}" - ${activationDate} - ${model} (행 ${index + 4})`);
        }
      }
    });

    console.log('🔍 [CS 디버깅] 무선 개통 처리 결과:');
    console.log('🔍 [CS 디버깅] - 행 길이 부족:', rowLengthIssueCount);
    console.log('🔍 [CS 디버깅] - 유효한 CS 개통:', csEmployeeValidCount);
    console.log('🔍 [CS 디버깅] - 총 무선 개통:', totalWireless);

    // 유선 개통 데이터 처리 (폰클홈데이터)
    let wiredProcessed = 0;
    if (phoneklHomeData) {
      // 헤더 제외 (3행까지 제외, 4행부터 데이터)
      const dataRows = phoneklHomeData.slice(3);

      dataRows.forEach((row, index) => {
        // CN열에서 CS 직원 정보 추출
        const csEmployee = (row[91] || '').toString().trim(); // CN열: CS 직원

        // CM열에서 접수일 추출
        const receiptDate = (row[90] || '').toString().trim(); // CM열: 접수일

        // 날짜 필터링 (해당 날짜까지의 누적 데이터)
        const targetDateObj = new Date(targetDate);
        const receiptDateObj = new Date(receiptDate);

        if (!isNaN(receiptDateObj.getTime()) && receiptDateObj <= targetDateObj &&
          csEmployee && csEmployee !== '' && csEmployee !== 'N' && csEmployee !== 'NO' &&
          (csEmployee.includes('MIN') || csEmployee.includes('VIP') || csEmployee.includes('등록'))) {
          totalWired++;
          wiredProcessed++;

          if (csAgents.has(csEmployee)) {
            csAgents.get(csEmployee).wired++;
            csAgents.get(csEmployee).total++;
          }
        }
      });
    }

    const result = {
      totalWireless,
      totalWired,
      total: totalWireless + totalWired,
      agents: Array.from(csAgents.entries())
        .filter(([agent, data]) => data.total > 0) // 실적이 있는 직원만
        .sort((a, b) => b[1].total - a[1].total) // 총 실적 순으로 정렬
        .map(([agent, data]) => ({
          agent,
          wireless: data.wireless,
          wired: data.wired,
          total: data.total
        }))
    };

    console.log('🔍 [CS 디버깅] 최종 결과:');
    console.log('🔍 [CS 디버깅] - 총 무선 개통:', result.totalWireless);
    console.log('🔍 [CS 디버깅] - 총 유선 개통:', result.totalWired);
    console.log('🔍 [CS 디버깅] - 총 개통:', result.total);
    console.log('🔍 [CS 디버깅] - CS 직원 수:', result.agents.length);
    console.log('🔍 [CS 디버깅] - CS 직원 목록:', result.agents.map(a => `${a.agent}(${a.total}건)`));

    return result;
  }

  // 매핑 실패 데이터 찾기
  function findMappingFailures(phoneklData, storeData) {
    const failures = [];
    const failureMap = new Map();

    phoneklData.forEach(row => {
      if (row.length > 14) {
        const storeCode = (row[14] || '').toString(); // O열: 출고처
        const agent = (row[8] || '').toString(); // I열: 담당자

        if (storeCode && !findStoreInData(storeCode, storeData)) {
          const key = `${storeCode}_${agent}`;
          if (!failureMap.has(key)) {
            failureMap.set(key, {
              storeCode,
              agent,
              reason: '출고처 매핑 실패',
              count: 0
            });
          }
          failureMap.get(key).count++;
        }
      }
    });

    return Array.from(failureMap.values());
  }

  // 출고처 데이터에서 매칭 찾기
  function findStoreInData(storeCode, storeData) {
    if (!storeData) return false;

    return storeData.some(row => {
      if (row.length > 14) {
        const code = (row[14] || '').toString(); // O열: 출고처코드
        return code === storeCode;
      }
      return false;
    });
  }

  // 실제 데이터에서 담당자-코드 조합 추출
  function extractAgentCodeCombinations(phoneklData) {
    const combinations = new Map();

    phoneklData.forEach(row => {
      const agent = (row[8] || '').toString().trim(); // I열: 담당자
      const code = (row[4] || '').toString().trim(); // E열: 코드명

      // 헤더 제외
      if (agent === '담당자' || code === '코드명') return;

      if (agent && code) {
        const key = `${agent}|${code}`;
        if (!combinations.has(key)) {
          combinations.set(key, {
            agent,
            code,
            displayName: `${agent} (${code})`
          });
        }
      }
    });

    return Array.from(combinations.values());
  }

  // ========================================
  // 목표 설정 API
  // ========================================

  router.post('/closing-chart/targets', async (req, res) => {
    try {
      const { targets } = req.body;

      if (!targets || !Array.isArray(targets)) {
        return res.status(400).json({ error: '목표 데이터가 올바르지 않습니다.' });
      }

      // 헤더 설정
      const headerData = [
        ['담당자명', '코드명', '목표값', '제외여부']
      ];

      // 헤더 먼저 저장
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: '영업사원목표!A1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: headerData
        }
      });

      // 영업사원목표 시트에 저장
      const targetData = targets.map(target => [
        target.agent, // A열: 담당자명
        target.code, // B열: 코드명
        target.target, // C열: 목표값
        target.excluded ? 'Y' : 'N' // D열: 제외여부
      ]);

      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: process.env.SHEET_ID,
        range: '영업사원목표!A2',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: targetData
        }
      });

      // 캐시 무효화
      if (cache && cache.cleanup) {
        cache.cleanup();
      }

      res.json({ success: true, message: '목표가 성공적으로 저장되었습니다.' });

    } catch (error) {
      console.error('목표 설정 오류:', error);
      res.status(500).json({ error: '목표 설정 중 오류가 발생했습니다.' });
    }
  });

  // ========================================
  // 매핑 실패 데이터 조회 API
  // ========================================

  router.get('/closing-chart/mapping-failures', async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const phoneklData = await getSheetValues('폰클개통데이터');
      const storeData = await getSheetValues('폰클출고처데이터');

      const failures = findMappingFailures(phoneklData, storeData);

      res.json({ failures });

    } catch (error) {
      console.error('매핑 실패 데이터 조회 오류:', error);
      res.status(500).json({ error: '매핑 실패 데이터 조회 중 오류가 발생했습니다.' });
    }
  });

  // ========================================
  // 담당자-코드 조합 추출 API
  // ========================================

  router.get('/closing-chart/agent-code-combinations', async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      // 폰클개통데이터 가져오기
      const phoneklData = await getSheetValues('폰클개통데이터');

      if (!phoneklData || phoneklData.length < 2) {
        return res.json({ combinations: [] });
      }

      // 헤더 제외하고 데이터만 처리
      const dataRows = phoneklData.slice(1);

      // 실제 데이터에서 담당자-코드 조합 추출
      const combinations = extractAgentCodeCombinations(dataRows);

      // 기존 목표값 데이터 가져오기
      const targetData = await getSheetValues('영업사원목표');
      const existingTargets = new Map();

      if (targetData && targetData.length > 1) {
        targetData.slice(1).forEach(row => {
          const agent = row[0] || '';
          const code = row[1] || '';
          const target = parseInt(row[2]) || 0;
          const excluded = row[3] === 'Y';
          const key = `${agent}|${code}`;
          existingTargets.set(key, { agent, code, target, excluded });
        });
      }

      // 조합에 기존 목표값 병합
      const result = combinations.map(combo => {
        const key = `${combo.agent}|${combo.code}`;
        const existing = existingTargets.get(key);

        return {
          agent: combo.agent,
          code: combo.code,
          target: existing ? existing.target : 0,
          excluded: existing ? existing.excluded : false
        };
      });

      res.json({ combinations: result });

    } catch (error) {
      console.error('담당자-코드 조합 추출 오류:', error);
      res.status(500).json({ error: '담당자-코드 조합 추출 중 오류가 발생했습니다.' });
    }
  });

  return router;
}

module.exports = createClosingChartRoutes;
