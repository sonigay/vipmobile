const express = require('express');
const { google } = require('googleapis');

// 월간시상 관련 시트 이름
const MANUAL_DATA_SHEET_NAME = '수기초';
const PLAN_SHEET_NAME = '무선요금제군';
const STORE_SHEET_NAME = '폰클출고처데이터';
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';
const PHONEKL_HOME_DATA_SHEET_NAME = '폰클홈데이터';
const MONTHLY_AWARD_SETTINGS_SHEET_NAME = '장표모드셋팅메뉴';

module.exports = function createMonthlyAwardRoutes(context) {
  const router = express.Router();
  const { sheetsClient } = context;
  const sheets = sheetsClient.sheets;
  const SPREADSHEET_ID = sheetsClient.SPREADSHEET_ID;

  // 실제 시트 이름 확인을 위한 디버깅 함수
  async function debugSheetNames() {
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      });

      const sheetsList = response.data.sheets || [];
      return sheetsList.map(sheet => sheet.properties.title);
    } catch (error) {
      console.error('시트 목록 확인 실패:', error);
      return [];
    }
  }

  // 캐시 시스템
  const cache = {
    data: new Map(),
    timestamps: new Map(),
    TTL: 5 * 60 * 1000 // 5분 캐시
  };

  function getFromCache(key) {
    const timestamp = cache.timestamps.get(key);
    if (timestamp && Date.now() - timestamp < cache.TTL) {
      return cache.data.get(key);
    }
    return null;
  }

  function setCache(key, data) {
    cache.data.set(key, data);
    cache.timestamps.set(key, Date.now());
  }

  async function getSheetValues(sheetName) {
    try {
      if (!sheets || !SPREADSHEET_ID) {
        console.warn(`⚠️ Google Sheets API가 설정되지 않아 ${sheetName} 데이터를 가져올 수 없습니다.`);
        return [];
      }

      const cachedData = getFromCache(sheetName);
      if (cachedData) {
        console.log(`캐시에서 ${sheetName} 데이터 로드`);
        return cachedData;
      }

      console.log(`Google Sheets에서 ${sheetName} 데이터 로드`);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName
      });

      const data = response.data.values || [];
      setCache(sheetName, data);
      return data;
    } catch (error) {
      console.warn(`[MonthlyAward] Failed to load sheet '${sheetName}': ${error.message}`);
      return [];
    }
  }

  function invalidateCache(sheetName = null) {
    if (sheetName) {
      cache.data.delete(sheetName);
      cache.timestamps.delete(sheetName);
      console.log(`${sheetName} 캐시 무효화`);
    } else {
      cache.data.clear();
      cache.timestamps.clear();
      console.log('모든 캐시 무효화');
    }
  }

  // 월간시상 데이터 계산 API
  async function getMonthlyAwardData(req, res) {
    try {
      // console.log('월간시상 데이터 구글시트에서 로드'); // Removed verbose log
      if (req.query.refresh === 'true') {
        console.log('🔄 [MonthlyAward] Forcing cache refresh via query param');
        invalidateCache();
      }

      const availableSheets = await debugSheetNames();
      const requiredSheets = [
        MANUAL_DATA_SHEET_NAME,
        PLAN_SHEET_NAME,
        STORE_SHEET_NAME,
        CURRENT_MONTH_ACTIVATION_SHEET_NAME,
        PHONEKL_HOME_DATA_SHEET_NAME,
        MONTHLY_AWARD_SETTINGS_SHEET_NAME,
        '대리점아이디관리'
      ];

      const [
        manualData,
        planData,
        storeData,
        activationData,
        homeData,
        settingsData,
        officeData
      ] = await Promise.all([
        getSheetValues(MANUAL_DATA_SHEET_NAME),
        getSheetValues(PLAN_SHEET_NAME),
        getSheetValues(STORE_SHEET_NAME),
        getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
        getSheetValues(PHONEKL_HOME_DATA_SHEET_NAME),
        getSheetValues(MONTHLY_AWARD_SETTINGS_SHEET_NAME),
        getSheetValues('대리점아이디관리')
      ]);

      if (!manualData || !planData || !storeData || !activationData || !homeData) {
        throw new Error('필요한 시트 데이터를 불러올 수 없습니다.');
      }

      const managerOfficeMapping = new Map();
      const manualRows = manualData.slice(1);

      manualRows.forEach(row => {
        if (row.length >= 9) {
          const manager = (row[8] || '').toString().trim();
          const office = (row[6] || '').toString().trim();
          const department = (row[7] || '').toString().trim();
          if (manager) {
            managerOfficeMapping.set(manager, { office: office || '미분류', department: department || '미분류' });
          }
        }
      });

      const planMapping = new Map();
      const planRows = planData.slice(1);
      planRows.forEach(row => {
        if (row.length >= 21) {
          const planName = (row[14] || '').toString().trim();
          const planGroup = (row[19] || '').toString().trim();
          const planPrice = parseFloat(row[15] || 0);
          if (planName) planMapping.set(planName, { group: planGroup, price: planPrice });
        }
      });

      const unmatchedPlans = new Set();
      const unmatchedStrategicProducts = new Set();

      // 전략상품 리스트 로드
      const strategicProducts = [];
      try {
        const strategicProductsResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!F1:I50`
        });
        const strategicProductsData = strategicProductsResponse.data.values || [];
        if (strategicProductsData.length > 1) {
          const strategicProductsRows = strategicProductsData.slice(1);
          strategicProductsRows.forEach(row => {
            if (row.length >= 4 && row[0] && row[2] && row[3]) {
              strategicProducts.push({
                subCategory: row[0] || '',
                serviceCode: row[1] || '',
                serviceName: row[2] || '',
                points: parseFloat(row[3] || 0)
              });
            }
          });
        }
      } catch (error) {
        console.log('전략상품 데이터 로드 실패:', error.message);
      }

      const defaultStrategicProducts = [
        { subCategory: '보험(폰교체)', serviceName: '보험(폰교체)', points: 2.0 },
        { subCategory: '유플릭스', serviceName: '유플릭스', points: 1.5 },
        { subCategory: '통화연결음', serviceName: '통화연결음', points: 1.0 },
        { subCategory: '뮤직류', serviceName: '뮤직류', points: 1.0 }
      ];
      const finalStrategicProducts = strategicProducts.length > 0 ? strategicProducts : defaultStrategicProducts;

      // Matrix 기준값 로드
      const matrixCriteria = [];
      try {
        const matrixResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!A1:D30`
        });
        const matrixData = matrixResponse.data.values || [];
        if (matrixData.length > 1) {
          const matrixRows = matrixData.slice(1);
          matrixRows.forEach((row) => {
            if (row.length >= 3 && row[0] && row[1] && row[2]) {
              const indicatorName = row[0] || '';
              const score = parseInt(row[1]);
              const percentage = parseFloat(row[2]);
              const description = row[3] || '';

              if (!isNaN(score) && !isNaN(percentage)) {
                let indicatorType = '';
                if (indicatorName.includes('기변105이상')) indicatorType = 'change105';
                else if (indicatorName.includes('전략상품')) indicatorType = 'strategic';
                else if (indicatorName.includes('인터넷 비중')) indicatorType = 'internet';

                if (indicatorType) {
                  matrixCriteria.push({ score, percentage, description, indicator: indicatorType });
                }
              }
            }
          });
        }
      } catch (error) {
        console.error('Matrix 기준값 데이터 로드 실패:', error.message);
      }

      // 요금제 가중치 로드
      const planWeights = [];
      try {
        let targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!Z1:AA50`;
        try {
          const weightRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: targetRange
          });
          processWeightData(weightRes.data.values || []);
        } catch (rangeError) {
          if (rangeError.message.includes('exceeds grid limits')) {
            console.log('⚠️ [MonthlyAward] Settings sheet too small, expanding columns for Weight Data...');
            try {
              // 시트 ID 가져오기
              const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
              const targetSheet = sheetInfo.data.sheets.find(s => s.properties.title === MONTHLY_AWARD_SETTINGS_SHEET_NAME);
              if (targetSheet) {
                // 28개 컬럼까지 확장 (Z, AA는 26, 27번째)
                await sheets.spreadsheets.batchUpdate({
                  spreadsheetId: SPREADSHEET_ID,
                  resource: {
                    requests: [{
                      appendDimension: {
                        sheetId: targetSheet.properties.sheetId,
                        dimension: 'COLUMNS',
                        length: 10 // 현재 컬럼 수에 10개 추가
                      }
                    }]
                  }
                });
                // 확장 후 재시도
                const retryRes = await sheets.spreadsheets.values.get({
                  spreadsheetId: SPREADSHEET_ID,
                  range: targetRange
                });
                processWeightData(retryRes.data.values || []);
              }
            } catch (expandError) {
              console.error('❌ [MonthlyAward] Failed to expand sheet columns:', expandError.message);
            }
          } else {
            throw rangeError;
          }
        }

        function processWeightData(weightRows) {
          if (weightRows.length > 1) { // Assuming header row exists
            const planWeightsRows = weightRows.slice(1);
            planWeightsRows.forEach(row => {
              if (row.length >= 2 && row[0] && row[1]) {
                planWeights.push({
                  keyword: row[0].toString().trim(),
                  points: parseFloat(row[1] || 0)
                });
              }
            });
          }
        }
      } catch (error) {
        if (error.message.includes('exceeds grid limits')) {
          // 이미 위에서 처리했거나 다른 시도에서 발생할 수 있음
          console.log('⚠️ [MonthlyAward] Re-handling grid limit error in outer catch:', error.message);
        }
        console.log('요금제 가중치 데이터 로드 실패:', error.message);
      }

      const defaultPlanWeights = [
        { keyword: '티빙', points: 1.2 },
        { keyword: '멀티팩', points: 1.2 },
        { keyword: '디즈니', points: 0.8 }
      ];
      const finalPlanWeights = planWeights.length > 0 ? planWeights : defaultPlanWeights;

      const indicators = ['change105', 'strategic', 'internet']; // Upsell 제거됨
      const missingIndicators = indicators.filter(indicator => !matrixCriteria.some(criterion => criterion.indicator === indicator));

      // 누락된 지표가 있으면 기본값 생성 (서버 에러 방지)
      if (missingIndicators.length > 0) {
        console.warn(`Matrix 기준값 누락, 기본값 사용: ${missingIndicators.join(', ')}`);
        // 기본값 로직은 생략하거나 필요한 경우 추가
      }

      const finalMatrixCriteria = matrixCriteria;

      // --- 계산 함수들 (Upsell 제거됨) ---

      const calculateChange105Above = (manager) => {
        const manualRows = manualData.slice(1);
        let numerator = 0;
        let denominator = 0;

        manualRows.forEach(row => {
          if (row.length < 100) return;
          const currentManager = (row[8] || '').toString().trim();
          if (manager !== 'TOTAL' && currentManager !== manager) return;

          const finalPolicy = (row[48] || '').toString().trim();
          const modelType = (row[98] || '').toString().trim();
          const finalPlan = (row[45] || '').toString().trim();
          const finalModel = (row[38] || '').toString().trim();

          const joinType = (row[19] || '').toString().trim();

          if (finalPolicy === 'BLANK') return;
          if (modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') return;
          if (joinType !== '재가입') return; // 정책기변 제거, 재가입만 포함

          if (finalPlan.includes('태블릿') || finalPlan.includes('스마트기기') || finalPlan.includes('Wearable') || finalPlan.includes('현역병사') ||
            finalPlan.includes('키즈') || finalPlan.includes('청소년') || finalPlan.includes('시니어')) return;

          const excludedModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
          if (excludedModels.includes(finalModel)) return;

          denominator++;

          const planGroup = (row[99] || '').toString().trim();
          if (planGroup === '105군' || planGroup === '115군') {
            let weight = 1.0;
            // 동적 가중치 적용
            for (const pw of finalPlanWeights) {
              if (finalPlan.includes(pw.keyword)) {
                weight = pw.points;
                break;
              }
            }
            numerator += weight;
          }
        });

        return {
          numerator,
          denominator,
          percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
        };
      };

      const calculateStrategicProducts = (manager) => {
        const manualRows = manualData.slice(1);
        const headers = manualData[0] || [];
        const targetHeaders = [
          '음악감상',
          '벨링콘텐츠팩',
          '보험(폰교체)',
          '구글 원 패키지',
          '통화연결음',
          '듀얼넘버',
          '국제전화'
        ];

        // Find indices for target headers
        const targetIndices = targetHeaders.map(header => {
          const index = headers.findIndex(h => h && h.toString().trim() === header);
          if (index === -1) console.warn(`[MonthlyAward] Warning: Strategic product header '${header}' not found.`);
          return { header, index };
        }).filter(item => item.index !== -1);

        let numerator = 0;
        let denominator = 0;

        manualRows.forEach(row => {
          if (row.length < 50) return; // Basic length check (adjust as needed, was 132 but dynamic columns might be anywhere)

          const currentManager = (row[8] || '').toString().trim(); // Manager column index (fixed)
          if (manager !== 'TOTAL' && currentManager !== manager) return;

          const finalPolicy = (row[48] || '').toString().trim(); // Policy column index (fixed)
          const modelType = (row[98] || '').toString().trim(); // Model type column index (fixed)

          if (finalPolicy === 'BLANK') return;
          if (modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') return;

          denominator++;

          let totalPoints = 0;

          // 중복 카운트 방지 로직 (수기초 시트 특이사항 대응)
          // 벨링콘텐츠팩 컬럼에 콤보 상품이 있고, 음악감상 컬럼에 단품 상품이 동시에 존재할 경우 음악감상 단품은 제외
          let skipMusicPlus = false;
          const musicIdxObj = targetIndices.find(t => t.header === '음악감상');
          const bellingIdxObj = targetIndices.find(t => t.header === '벨링콘텐츠팩');

          if (musicIdxObj && bellingIdxObj) {
            const musicVal = (row[musicIdxObj.index] || '').toString().trim();
            const bellingVal = (row[bellingIdxObj.index] || '').toString().trim();

            if (bellingVal === 'V컬러링 음악감상 플러스 + 벨링콘텐츠팩' && musicVal === 'V컬러링 음악감상 플러스') {
              skipMusicPlus = true;
            }
          }

          targetIndices.forEach(({ header, index }) => {
            const service = (row[index] || '').toString().trim();
            if (service) {
              // 중복 제외 대상인 경우 스킵
              if (header === '음악감상' && service === 'V컬러링 음악감상 플러스' && skipMusicPlus) {
                return;
              }

              const product = finalStrategicProducts.find(p => p.serviceName === service);
              if (product) {
                totalPoints += product.points;
              } else {
                unmatchedStrategicProducts.add(service);
              }
            }
          });
          numerator += totalPoints;
        });

        return {
          numerator,
          denominator,
          percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
        };
      };

      const calculateInternetRatio = (manager) => {
        const activationRows = activationData.slice(3);
        const homeRows = homeData.slice(3);
        let numerator = 0;
        let denominator = 0;
        let matchedHomeRows = 0;
        let internetRows = 0;

        // 폰클홈데이터 헤더 인덱스 검색 (3행/index 2 기준)
        const homeHeaders = homeData[2] || [];
        const targetHomeHeaders = ['동판-요금제', '동판-비고', '원스톱-요금제'];
        const homeTargetIndices = targetHomeHeaders.map(header => {
          const index = homeHeaders.findIndex(h => h && h.toString().trim() === header);
          return { header, index };
        }).filter(item => item.index !== -1);

        activationRows.forEach(row => {
          if (row.length < 16) return;
          const activation = (row[19] || '').toString().trim();
          const modelName = (row[21] || '').toString().trim();
          const inputStore = (row[12] || '').toString().trim();
          const planName = (row[29] || '').toString().trim();
          const currentManager = (row[8] || '').toString().trim();
          const customerName = (row[16] || '').toString().trim();

          if (activation === '선불개통' || !modelName || inputStore === '중고') return;
          if (planName.includes('태블릿') || planName.includes('스마트기기') || planName.includes('Wearable')) return;
          if (customerName.includes('(중고)')) return; // 고객명에 (중고) 포함 시 제외
          if (manager !== 'TOTAL' && currentManager !== manager) return;

          denominator++;
        });

        homeRows.forEach(row => {
          if (row.length < 8) return;
          const product = (row[17] || '').toString().trim();
          const currentManager = (row[7] || '').toString().trim();

          if (manager !== 'TOTAL' && currentManager !== manager) return;

          // '중고' 포함된 데이터 제외 로직 (동판-요금제, 동판-비고, 원스톱-요금제 컬럼 확인)
          const isUsedPhone = homeTargetIndices.some(({ index }) => {
            const value = (row[index] || '').toString().trim();
            return value.includes('중고');
          });

          if (isUsedPhone) return;

          matchedHomeRows++;

          if (product.includes('인터넷')) {
            internetRows++;
            if (!product.includes('동판')) {
              if (product !== '선불' && product !== '소호') numerator++;
            } else {
              numerator++;
            }
          }
        });

        return {
          numerator,
          denominator,
          percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
        };
      };

      // --- 담당자별 데이터 수집 및 계산 ---
      const agentMap = new Map();

      manualRows.forEach(row => {
        if (row.length < 132) return;
        const manager = (row[8] || '').toString().trim();
        if (manager && !agentMap.has(manager)) {
          const officeInfo = managerOfficeMapping.get(manager) || { office: '미분류', department: '미분류' };

          const change105Data = calculateChange105Above(manager);
          const strategicData = calculateStrategicProducts(manager);
          const internetData = calculateInternetRatio(manager);

          const calculateScore = (percentage, criteria) => {
            const sortedCriteria = criteria.sort((a, b) => b.score - a.score);
            for (let i = 0; i < sortedCriteria.length; i++) {
              const criterion = sortedCriteria[i];
              if (criterion.description === '미만') {
                if (percentage < criterion.percentage) return criterion.score;
              } else {
                if (percentage >= criterion.percentage) return criterion.score;
              }
            }
            return Math.min(...criteria.map(c => c.score));
          };

          const change105Score = calculateScore(parseFloat(change105Data.percentage), finalMatrixCriteria.filter(c => c.indicator === 'change105'));
          const strategicScore = calculateScore(parseFloat(strategicData.percentage), finalMatrixCriteria.filter(c => c.indicator === 'strategic'));
          const internetScore = calculateScore(parseFloat(internetData.percentage), finalMatrixCriteria.filter(c => c.indicator === 'internet'));

          const totalScore = (change105Score + strategicScore + internetScore).toFixed(0);

          agentMap.set(manager, {
            manager,
            office: officeInfo.office,
            department: officeInfo.department,
            change105Above: { ...change105Data, score: change105Score },
            strategicProducts: { ...strategicData, score: strategicScore },
            internetRatio: { ...internetData, score: internetScore },
            totalScore: parseInt(totalScore)
          });
        }
      });

      // --- 그룹화 및 평균 계산 ---
      const officeGroupMap = new Map();
      const departmentGroupMap = new Map();

      agentMap.forEach(agent => {
        // Office Group
        if (!officeGroupMap.has(agent.office)) {
          officeGroupMap.set(agent.office, {
            office: agent.office,
            count: 0,
            totalChange105Score: 0,
            totalChange105Percentage: 0,
            totalChange105Numerator: 0,
            totalChange105Denominator: 0,
            totalStrategicScore: 0,
            totalStrategicPercentage: 0,
            totalStrategicNumerator: 0,
            totalStrategicDenominator: 0,
            totalInternetScore: 0,
            totalInternetPercentage: 0,
            totalInternetNumerator: 0,
            totalInternetDenominator: 0,
            totalTotalScore: 0
          });
        }
        const officeGroup = officeGroupMap.get(agent.office);
        officeGroup.count++;
        officeGroup.totalChange105Score += agent.change105Above.score;
        officeGroup.totalChange105Percentage += parseFloat(agent.change105Above.percentage);
        officeGroup.totalChange105Numerator += agent.change105Above.numerator;
        officeGroup.totalChange105Denominator += agent.change105Above.denominator;

        officeGroup.totalStrategicScore += agent.strategicProducts.score;
        officeGroup.totalStrategicPercentage += parseFloat(agent.strategicProducts.percentage);
        officeGroup.totalStrategicNumerator += agent.strategicProducts.numerator;
        officeGroup.totalStrategicDenominator += agent.strategicProducts.denominator;

        officeGroup.totalInternetScore += agent.internetRatio.score;
        officeGroup.totalInternetPercentage += parseFloat(agent.internetRatio.percentage);
        officeGroup.totalInternetNumerator += agent.internetRatio.numerator;
        officeGroup.totalInternetDenominator += agent.internetRatio.denominator;

        officeGroup.totalTotalScore += agent.totalScore;

        // Department Group
        if (!departmentGroupMap.has(agent.department)) {
          departmentGroupMap.set(agent.department, {
            department: agent.department,
            count: 0,
            totalChange105Score: 0,
            totalChange105Percentage: 0,
            totalChange105Numerator: 0,
            totalChange105Denominator: 0,
            totalStrategicScore: 0,
            totalStrategicPercentage: 0,
            totalStrategicNumerator: 0,
            totalStrategicDenominator: 0,
            totalInternetScore: 0,
            totalInternetPercentage: 0,
            totalInternetNumerator: 0,
            totalInternetDenominator: 0,
            totalTotalScore: 0
          });
        }
        const departmentGroup = departmentGroupMap.get(agent.department);
        departmentGroup.count++;
        departmentGroup.totalChange105Score += agent.change105Above.score;
        departmentGroup.totalChange105Percentage += parseFloat(agent.change105Above.percentage);
        departmentGroup.totalChange105Numerator += agent.change105Above.numerator;
        departmentGroup.totalChange105Denominator += agent.change105Above.denominator;

        departmentGroup.totalStrategicScore += agent.strategicProducts.score;
        departmentGroup.totalStrategicPercentage += parseFloat(agent.strategicProducts.percentage);
        departmentGroup.totalStrategicNumerator += agent.strategicProducts.numerator;
        departmentGroup.totalStrategicDenominator += agent.strategicProducts.denominator;

        departmentGroup.totalInternetScore += agent.internetRatio.score;
        departmentGroup.totalInternetPercentage += parseFloat(agent.internetRatio.percentage);
        departmentGroup.totalInternetNumerator += agent.internetRatio.numerator;
        departmentGroup.totalInternetDenominator += agent.internetRatio.denominator;

        departmentGroup.totalTotalScore += agent.totalScore;
      });

      // Averages
      officeGroupMap.forEach(group => {
        group.averageChange105Score = (group.totalChange105Score / group.count).toFixed(1);
        group.averageChange105Percentage = (group.totalChange105Percentage / group.count).toFixed(1);
        group.averageStrategicScore = (group.totalStrategicScore / group.count).toFixed(1);
        group.averageStrategicPercentage = (group.totalStrategicPercentage / group.count).toFixed(1);
        group.averageInternetScore = (group.totalInternetScore / group.count).toFixed(1);
        group.averageInternetPercentage = (group.totalInternetPercentage / group.count).toFixed(1);
        group.averageTotalScore = (group.totalTotalScore / group.count).toFixed(1);
      });

      departmentGroupMap.forEach(group => {
        group.averageChange105Score = (group.totalChange105Score / group.count).toFixed(1);
        group.averageChange105Percentage = (group.totalChange105Percentage / group.count).toFixed(1); // Avg Percentage
        group.averageStrategicScore = (group.totalStrategicScore / group.count).toFixed(1);
        group.averageStrategicPercentage = (group.totalStrategicPercentage / group.count).toFixed(1); // Avg Percentage
        group.averageInternetScore = (group.totalInternetScore / group.count).toFixed(1);
        group.averageInternetPercentage = (group.totalInternetPercentage / group.count).toFixed(1); // Avg Percentage
        group.averageTotalScore = (group.totalTotalScore / group.count).toFixed(1);
      });

      // --- 전체 지표 계산 (전체 합계 기준) ---
      const totalChange105Above = calculateChange105Above('TOTAL');
      const totalStrategicProducts = calculateStrategicProducts('TOTAL');
      const totalInternetRatio = calculateInternetRatio('TOTAL');

      const calculateScore = (percentage, criteria) => {
        const sortedCriteria = criteria.sort((a, b) => b.score - a.score);
        for (let i = 0; i < sortedCriteria.length; i++) {
          const criterion = sortedCriteria[i];
          if (criterion.description === '미만') {
            if (percentage < criterion.percentage) return criterion.score;
          } else {
            if (percentage >= criterion.percentage) return criterion.score;
          }
        }
        return Math.min(...criteria.map(c => c.score));
      };

      const change105Score = calculateScore(parseFloat(totalChange105Above.percentage), finalMatrixCriteria.filter(c => c.indicator === 'change105'));
      const strategicScore = calculateScore(parseFloat(totalStrategicProducts.percentage), finalMatrixCriteria.filter(c => c.indicator === 'strategic'));
      const internetScore = calculateScore(parseFloat(totalInternetRatio.percentage), finalMatrixCriteria.filter(c => c.indicator === 'internet'));

      const totalScore = (change105Score + strategicScore + internetScore).toFixed(0);

      const maxScores = {
        change105: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'change105').map(c => c.score), 6),
        strategic: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'strategic').map(c => c.score), 6),
        internet: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'internet').map(c => c.score), 3)
      };

      const totalMaxScore = maxScores.change105 + maxScores.strategic + maxScores.internet; // 15점 예상

      const result = {
        date: new Date().toISOString().split('T')[0],
        indicators: {
          change105Above: totalChange105Above,
          strategicProducts: totalStrategicProducts,
          internetRatio: totalInternetRatio
        },
        totalScore,
        maxScores,
        totalMaxScore,
        matrixCriteria: finalMatrixCriteria,
        strategicProductsList: finalStrategicProducts,
        planWeightsList: finalPlanWeights,
        agentDetails: Array.from(agentMap.values()).sort((a, b) => {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          if (b.change105Above.denominator !== a.change105Above.denominator) return b.change105Above.denominator - a.change105Above.denominator;
          const aSum = parseFloat(a.change105Above.percentage) + parseFloat(a.strategicProducts.percentage) + parseFloat(a.internetRatio.percentage);
          const bSum = parseFloat(b.change105Above.percentage) + parseFloat(b.strategicProducts.percentage) + parseFloat(b.internetRatio.percentage);
          return bSum - aSum;
        }),
        officeGroups: Array.from(officeGroupMap.values()).sort((a, b) => {
          const bScore = parseFloat(b.averageTotalScore);
          const aScore = parseFloat(a.averageTotalScore);
          if (bScore !== aScore) return bScore - aScore;
          if (b.totalChange105Denominator !== a.totalChange105Denominator) return b.totalChange105Denominator - a.totalChange105Denominator;
          const aSum = parseFloat(a.averageChange105Percentage) + parseFloat(a.averageStrategicPercentage) + parseFloat(a.averageInternetPercentage);
          const bSum = parseFloat(b.averageChange105Percentage) + parseFloat(b.averageStrategicPercentage) + parseFloat(b.averageInternetPercentage);
          return bSum - aSum;
        }),
        departmentGroups: Array.from(departmentGroupMap.values()).sort((a, b) => {
          const bScore = parseFloat(b.averageTotalScore);
          const aScore = parseFloat(a.averageTotalScore);
          if (bScore !== aScore) return bScore - aScore;
          if (b.totalChange105Denominator !== a.totalChange105Denominator) return b.totalChange105Denominator - a.totalChange105Denominator;
          const aSum = parseFloat(a.averageChange105Percentage) + parseFloat(a.averageStrategicPercentage) + parseFloat(a.averageInternetPercentage);
          const bSum = parseFloat(b.averageChange105Percentage) + parseFloat(b.averageStrategicPercentage) + parseFloat(b.averageInternetPercentage);
          return bSum - aSum;
        }),
        unmatchedItems: {
          companies: [],
          strategicProducts: Array.from(unmatchedStrategicProducts),
          plans: Array.from(unmatchedPlans)
        }
      };

      res.json(result);
    } catch (error) {
      console.error('월간시상 데이터 계산 오류:', error);
      res.status(500).json({ success: false, error: 'Failed to calculate monthly award data', message: error.message });
    }
  }

  // 월간시상 셋팅 저장 API
  async function saveMonthlyAwardSettings(req, res) {
    try {
      const { type } = req.body;
      let { data } = req.body;

      if (!type) return res.status(400).json({ success: false, error: 'Type is required' });
      if (!data) data = [];

      let sheetData = [];
      let targetRange = '';

      switch (type) {
        case 'matrix_criteria':
          targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!A1:D30`;
          if (!data || data.length === 0) return res.status(400).json({ success: false, error: '데이터가 비어있습니다.' });

          const maxScores = { 'change105': 6, 'strategic': 6, 'internet': 3 };
          const organizedData = [['지표명', '점수', '퍼센트', '설명']];

          ['change105', 'strategic', 'internet'].forEach(indicator => {
            const indicatorData = data.filter(item => item.indicator === indicator);
            const maxScore = maxScores[indicator];
            const indicatorNames = { 'change105': '기변105이상', 'strategic': '전략상품', 'internet': '인터넷 비중' };
            const scoreRange = indicator === 'internet' ? [3, 2, 1] : [6, 5, 4, 3, 2, 1];

            for (let i = 0; i < scoreRange.length; i++) {
              const score = scoreRange[i];
              const item = indicatorData.find(d => d.score === score);
              if (item && item.percentage > 0) {
                const description = item.description || (i === 0 ? '만점' : (i === scoreRange.length - 1 ? '미만' : '이상'));
                organizedData.push([`${indicatorNames[indicator]} (${maxScore}점)`, score, item.percentage, description]);
              }
            }
          });
          sheetData = organizedData;
          break;

        case 'strategic_products':
          targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!F1:I50`;
          sheetData = [['소분류', '부가서비스 코드', '부가서비스명', '포인트']];
          data.forEach(item => {
            sheetData.push([item.subCategory || '', item.serviceCode || '', item.serviceName || '', item.points || 0]);
          });
          break;

        // ... (Other settings cases remain the same or can be cleaned up later) ...

        case 'company_mapping':
          targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!K1:N100`;
          sheetData = [['개통데이터업체명', '폰클출고처업체명', '매핑상태', '비고']];
          data.forEach(item => sheetData.push([item.sourceCompany, item.targetCompany, '매핑완료', '인터넷비중계산용']));
          break;

        case 'plan_mapping':
          targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!P1:S100`;
          sheetData = [['요금제명', '요금제군', '기본료', '매핑상태']];
          data.forEach(item => sheetData.push([item.planName, item.planGroup, item.baseFee, '매핑완료']));
          break;

        case 'manager_settings':
          targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!U1:X50`;
          sheetData = [['담당자명', '활성화상태', '목표달성률', '비고']];
          data.forEach(item => sheetData.push([item.managerName, item.status || '활성', item.targetRate, item.note || '']));
          break;

        case 'plan_weights':
          targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!Z1:AA50`;
          sheetData = [['키워드', '가중치']];
          data.forEach(item => {
            if (item.keyword && !isNaN(item.points)) {
              sheetData.push([item.keyword, item.points]);
            }
          });
          break;

        default:
          return res.status(400).json({ success: false, error: 'Invalid type' });
      }

      if (!sheets || !SPREADSHEET_ID) {
        return res.json({ success: true, message: 'Google Sheets API 미설정' });
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: targetRange,
        valueInputOption: 'USER_ENTERED',
        resource: { values: sheetData }
      });

      invalidateCache(MONTHLY_AWARD_SETTINGS_SHEET_NAME);
      if (type !== 'matrix_criteria') invalidateCache();

      res.json({ success: true, message: '설정이 저장되었습니다.' });

    } catch (error) {
      console.error('설정 저장 오류:', error);
      res.status(500).json({ success: false, error: 'Failed to save settings', message: error.message });
    }
  }

  router.get('/monthly-award/data', getMonthlyAwardData);
  router.post('/monthly-award/settings', saveMonthlyAwardSettings);

  return router;
};