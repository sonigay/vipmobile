const express = require('express');
const { google } = require('googleapis');

// 월간시상 관련 시트 이름
const MANUAL_DATA_SHEET_NAME = '수기초';
const PLAN_SHEET_NAME = '무선요금제군';
const STORE_SHEET_NAME = '폰클출고처데이터';
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';
const PHONEKL_HOME_DATA_SHEET_NAME = '폰클홈데이터';
const MONTHLY_AWARD_SETTINGS_SHEET_NAME = '장표모드셋팅메뉴';

// Google API 인증 설정
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.includes('\\n') ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : process.env.GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SHEET_ID;

// 캐시 시스템
const cache = {
  data: new Map(),
  timestamps: new Map(),
  TTL: 5 * 60 * 1000 // 5분 캐시
};

// 캐시에서 데이터 가져오기
function getFromCache(key) {
  const timestamp = cache.timestamps.get(key);
  if (timestamp && Date.now() - timestamp < cache.TTL) {
    return cache.data.get(key);
  }
  return null;
}

// 캐시에 데이터 저장
function setCache(key, data) {
  cache.data.set(key, data);
  cache.timestamps.set(key, Date.now());
}

// 데이터 시트에서 값 가져오기 (캐싱 적용)
async function getSheetValues(sheetName) {
  try {
    // 캐시에서 먼저 확인
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
    
    // 캐시에 저장
    setCache(sheetName, data);
    
    return data;
  } catch (error) {
    console.error(`Error fetching sheet ${sheetName}:`, error);
    throw error;
  }
}

// 캐시 무효화 함수
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
    console.log('월간시상 데이터 구글시트에서 로드');

    // 캐시 무효화 (개발 중이므로 캐시 비활성화)
    invalidateCache();

    // 필요한 시트 데이터 로드
    const [
      manualData,           // 수기초
      planData,             // 무선요금제군
      storeData,            // 폰클출고처데이터
      activationData,       // 폰클개통데이터
      homeData,             // 폰클홈데이터
      settingsData          // 장표모드셋팅메뉴
    ] = await Promise.all([
      getSheetValues(MANUAL_DATA_SHEET_NAME),
      getSheetValues(PLAN_SHEET_NAME),
      getSheetValues(STORE_SHEET_NAME),
      getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
      getSheetValues(PHONEKL_HOME_DATA_SHEET_NAME),
      getSheetValues(MONTHLY_AWARD_SETTINGS_SHEET_NAME)
    ]);

    if (!manualData || !planData || !storeData || !activationData || !homeData) {
      throw new Error('필요한 시트 데이터를 불러올 수 없습니다.');
    }

    // 담당자 매핑 테이블 생성 (수기초에 있는 실판매POS 코드만)
    const managerMapping = new Map();
    const storeRows = storeData.slice(1);
    
    // 수기초에 있는 실판매POS 코드 수집
    const manualPosCodes = new Set();
    manualData.slice(1).forEach(row => {
      if (row.length >= 8) {
        const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
        if (posCode) {
          manualPosCodes.add(posCode);
        }
      }
    });
    
    console.log('수기초에 있는 실판매POS 코드 수:', manualPosCodes.size);
    console.log('수기초 실판매POS 코드 예시:', Array.from(manualPosCodes).slice(0, 10));
    
    // 수기초에 있는 실판매POS 코드만 매핑 (미사용 상태 제외)
    storeRows.forEach(row => {
      if (row.length >= 14) {
        const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
        const manager = (row[13] || '').toString().trim(); // N열: 담당자
        const status = (row[4] || '').toString().trim(); // E열: 상태
        
        // 미사용 상태 제외하고, 수기초에 있는 실판매POS 코드만 매핑
        if (posCode && manager && status !== '미사용' && manualPosCodes.has(posCode)) {
          // 담당자 이름에서 괄호 부분 제거
          const cleanManager = manager.replace(/\([^)]*\)/g, '').trim();
          managerMapping.set(posCode, cleanManager);
        }
      }
    });

    // 디버깅 로그 추가
    console.log('담당자 매핑 테이블 크기:', managerMapping.size);
    console.log('담당자 목록:', Array.from(managerMapping.values()));
    console.log('매핑된 실판매POS 코드 수:', managerMapping.size);
    console.log('매핑된 실판매POS 코드 예시:', Array.from(managerMapping.keys()).slice(0, 10));
    console.log('매뉴얼데이터 첫 번째 행:', manualData[0]);
    console.log('매뉴얼데이터 두 번째 행:', manualData[1]);

    // 요금제 매핑 테이블 생성
    const planMapping = new Map();
    const planRows = planData.slice(1);
    
    planRows.forEach(row => {
      if (row.length >= 21) {
        const planName = (row[14] || '').toString().trim(); // O열: 요금제명
        const planGroup = (row[19] || '').toString().trim(); // T열: 요금제군
        const planPrice = parseFloat(row[15] || 0); // P열: 기본료
        
        if (planName) {
          planMapping.set(planName, {
            group: planGroup,
            price: planPrice
          });
        }
      }
    });

    // 전략상품 리스트 로드 (셋팅에서)
    const strategicProducts = [];
    if (settingsData && settingsData.length > 1) {
      const settingsRows = settingsData.slice(1);
      settingsRows.forEach(row => {
        if (row.length >= 4) {
          strategicProducts.push({
            subCategory: row[0] || '',        // 소분류
            serviceCode: row[1] || '',        // 부가서비스 코드
            serviceName: row[2] || '',        // 부가서비스명
            points: parseFloat(row[3] || 0)   // 포인트
          });
        }
      });
    }

    // 기본 전략상품 포인트 (설정이 없을 때 사용)
    const defaultStrategicProducts = [
      { subCategory: '보험(폰교체)', serviceName: '보험(폰교체)', points: 2.0 },
      { subCategory: '유플릭스', serviceName: '유플릭스', points: 1.5 },
      { subCategory: '통화연결음', serviceName: '통화연결음', points: 1.0 },
      { subCategory: '뮤직류', serviceName: '뮤직류', points: 1.0 }
    ];

    // 설정된 값이 없으면 기본값 사용
    const finalStrategicProducts = strategicProducts.length > 0 ? strategicProducts : defaultStrategicProducts;

    // Matrix 기준값 로드 (셋팅에서)
    const matrixCriteria = [];
    if (settingsData && settingsData.length > 1) {
      const settingsRows = settingsData.slice(1);
      settingsRows.forEach(row => {
        if (row.length >= 2 && row[0] && row[1]) {
          const score = parseInt(row[0]);
          const percentage = parseFloat(row[1]);
          if (!isNaN(score) && !isNaN(percentage)) {
            matrixCriteria.push({ score, percentage });
          }
        }
      });
    }

    // 기본 Matrix 기준값 (설정이 없을 때 사용)
    const defaultMatrixCriteria = [
      // 업셀기변 기준값
      { score: 6, indicator: 'upsell', percentage: 92.0 },
      { score: 5, indicator: 'upsell', percentage: 85.0 },
      { score: 4, indicator: 'upsell', percentage: 78.0 },
      { score: 3, indicator: 'upsell', percentage: 70.0 },
      { score: 2, indicator: 'upsell', percentage: 60.0 },
      { score: 1, indicator: 'upsell', percentage: 50.0 },
      
      // 기변105이상 기준값
      { score: 6, indicator: 'change105', percentage: 88.0 },
      { score: 5, indicator: 'change105', percentage: 80.0 },
      { score: 4, indicator: 'change105', percentage: 72.0 },
      { score: 3, indicator: 'change105', percentage: 64.0 },
      { score: 2, indicator: 'change105', percentage: 56.0 },
      { score: 1, indicator: 'change105', percentage: 48.0 },
      
      // 전략상품 기준값
      { score: 6, indicator: 'strategic', percentage: 40.0 },
      { score: 5, indicator: 'strategic', percentage: 35.0 },
      { score: 4, indicator: 'strategic', percentage: 30.0 },
      { score: 3, indicator: 'strategic', percentage: 25.0 },
      { score: 2, indicator: 'strategic', percentage: 20.0 },
      { score: 1, indicator: 'strategic', percentage: 15.0 },
      
      // 인터넷 비중 기준값
      { score: 6, indicator: 'internet', percentage: 60.0 },
      { score: 5, indicator: 'internet', percentage: 55.0 },
      { score: 4, indicator: 'internet', percentage: 50.0 },
      { score: 3, indicator: 'internet', percentage: 45.0 },
      { score: 2, indicator: 'internet', percentage: 40.0 },
      { score: 1, indicator: 'internet', percentage: 35.0 }
    ];

    // 설정된 값이 없으면 기본값 사용
    const finalMatrixCriteria = matrixCriteria.length > 0 ? matrixCriteria : defaultMatrixCriteria;

    // 월간시상 계산 함수들
    const calculateUpsellChange = () => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0; // 자수
      let denominator = 0; // 모수
      
      manualRows.forEach(row => {
        if (row.length < 90) return; // 최소 필요한 열 수 확인
        
        // 기본조건 확인
        const subscriptionNumber = (row[0] || '').toString().trim(); // A열: 가입번호
        const finalPolicy = (row[39] || '').toString().trim(); // AN열: 최종영업정책
        const modelType = (row[67] || '').toString().trim(); // CL열: 모델유형
        const joinType = (row[10] || '').toString().trim(); // K열: 가입구분
        
        // 기본조건 검증
        if (!subscriptionNumber || finalPolicy === 'BLANK' || 
            modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델' ||
            (joinType !== '정책기변' && joinType !== '재가입')) {
          return;
        }
        
        // 모수 카운팅
        denominator++;
        
        // 최종요금제와 변경전요금제 기본료 추출
        const finalPlan = (row[38] || '').toString().trim(); // AM열: 최종요금제
        const beforePlan = (row[75] || '').toString().trim(); // CX열: 변경전요금제
        
        const finalPlanInfo = planMapping.get(finalPlan);
        const beforePlanInfo = planMapping.get(beforePlan);
        
        if (finalPlanInfo && beforePlanInfo) {
          // 특별 조건: 115군, 105군이면 무조건 인정
          if (beforePlanInfo.group === '115군' || beforePlanInfo.group === '105군') {
            numerator++;
          }
          // 일반 조건: 업셀 (변경전 < 최종)
          else if (beforePlanInfo.price < finalPlanInfo.price) {
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

    const calculateChange105Above = () => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0;
      let denominator = 0;
      
      manualRows.forEach(row => {
        if (row.length < 90) return;
        
        // 기본조건 확인
        const subscriptionNumber = (row[0] || '').toString().trim();
        const finalPolicy = (row[39] || '').toString().trim();
        const modelType = (row[67] || '').toString().trim();
        const joinType = (row[10] || '').toString().trim();
        const finalPlan = (row[38] || '').toString().trim();
        const finalModel = (row[32] || '').toString().trim(); // AG열: 최종모델
        
        // 기본조건 검증
        if (!subscriptionNumber || finalPolicy === 'BLANK' || 
            modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델' ||
            (joinType !== '정책기변' && joinType !== '재가입')) {
          return;
        }
        
        // 제외대상 확인
        const finalPlanInfo = planMapping.get(finalPlan);
        if (!finalPlanInfo) return;
        
        // 요금제군 제외
        const excludedGroups = ['시니어 Ⅰ군', '시니어 Ⅱ군', '청소년 Ⅰ군', '청소년 Ⅱ군', '청소년 Ⅲ군', '키즈군', '키즈22군'];
        if (excludedGroups.includes(finalPlanInfo.group)) return;
        
        // 요금제명 제외 (현역병사 포함)
        if (finalPlan.includes('현역병사')) return;
        
        // 모델명 제외
        const excludedModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
        if (excludedModels.includes(finalModel)) return;
        
        // 모수 카운팅
        denominator++;
        
        // 자수 카운팅 (105군, 115군)
        if (finalPlanInfo.group === '105군' || finalPlanInfo.group === '115군') {
          // 특별 조건: 디즈니, 멀티팩 포함 시 1.2 카운트
          if (finalPlan.includes('디즈니') || finalPlan.includes('멀티팩')) {
            numerator += 1.2;
          } else {
            numerator += 1.0;
          }
        }
      });
      
      return {
        numerator,
        denominator,
        percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
      };
    };

    const calculateStrategicProducts = () => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0;
      let denominator = 0;
      
      manualRows.forEach(row => {
        if (row.length < 90) return;
        
        // 기본조건 확인
        const subscriptionNumber = (row[0] || '').toString().trim();
        const finalPolicy = (row[39] || '').toString().trim();
        const modelType = (row[67] || '').toString().trim();
        
        // 기본조건 검증
        if (!subscriptionNumber || finalPolicy === 'BLANK' || 
            modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
          return;
        }
        
        // 모수 카운팅
        denominator++;
        
        // 자수 계산 (전략상품 포인트 합계)
        const insurance = (row[83] || '').toString().trim(); // DL열: 보험(폰교체)
        const uflix = (row[93] || '').toString().trim(); // DO열: 유플릭스
        const callTone = (row[95] || '').toString().trim(); // DS열: 통화연결음
        const music = (row[79] || '').toString().trim(); // DG열: 뮤직류
        
        let totalPoints = 0;
        
        // 각 항목별 포인트 계산 (소분류 또는 부가서비스명으로 매칭)
        [insurance, uflix, callTone, music].forEach(service => {
          if (service) {
            // 1. 부가서비스명으로 정확히 매칭
            let product = finalStrategicProducts.find(p => p.serviceName === service);
            
            // 2. 부가서비스명 매칭이 안되면 소분류로 매칭
            if (!product) {
              product = finalStrategicProducts.find(p => p.subCategory === service);
            }
            
            if (product) {
              totalPoints += product.points;
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

    const calculateInternetRatio = () => {
      const activationRows = activationData.slice(1);
      const homeRows = homeData.slice(1);
      
      let numerator = 0;
      let denominator = 0;
      
      // 개통데이터 기준으로 모수 계산
      activationRows.forEach(row => {
        if (row.length < 38) return;
        
        const activation = (row[37] || '').toString().trim(); // AL열: 개통
        const modelName = (row[13] || '').toString().trim(); // N열: 모델명
        const inputStore = (row[4] || '').toString().trim(); // E열: 입고처
        const planName = (row[21] || '').toString().trim(); // V열: 요금제
        
        // 모수 조건 확인
        if (activation === '선불개통' || !modelName || inputStore === '중고') {
          return;
        }
        
        // 요금제군 확인 (2nd군 제외)
        const planInfo = planMapping.get(planName);
        if (planInfo && planInfo.group === '2nd군') {
          return;
        }
        
        denominator++;
      });
      
      // 홈데이터 기준으로 자수 계산
      homeRows.forEach(row => {
        if (row.length < 10) return;
        
        const product = (row[9] || '').toString().trim(); // J열: 가입상품
        
        // 자수 조건 확인
        if (product === '인터넷') {
          // 동판 문구가 없는 경우에만 추가 조건 확인
          if (!product.includes('동판')) {
            if (product !== '선불' && product !== '소호') {
              numerator++;
            }
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

    // 각 지표 계산
    const upsellChange = calculateUpsellChange();
    const change105Above = calculateChange105Above();
    const strategicProductsResult = calculateStrategicProducts();
    const internetRatio = calculateInternetRatio();

    // 총점 계산
    const totalScore = (
      parseFloat(upsellChange.percentage) +
      parseFloat(change105Above.percentage) +
      parseFloat(strategicProductsResult.percentage) +
      parseFloat(internetRatio.percentage)
    ).toFixed(2);

    // 담당자별 상세 데이터 계산
    const agentMap = new Map();
    
    // 담당자별 데이터 수집
    const manualRows = manualData.slice(1);
    console.log('매뉴얼데이터 행 수:', manualRows.length);
    
    let matchedCount = 0;
    let unmatchedStores = new Set();
    
    manualRows.forEach(row => {
      if (row.length < 90) return;
      
      const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
      const manager = managerMapping.get(posCode);
      
      if (manager) {
        matchedCount++;
        if (!agentMap.has(manager)) {
          agentMap.set(manager, {
            name: manager,
            upsellChange: { numerator: 0, denominator: 0 },
            change105Above: { numerator: 0, denominator: 0 },
            strategicProducts: { numerator: 0, denominator: 0 },
            internetRatio: { numerator: 0, denominator: 0 }
          });
        }
        
        const agent = agentMap.get(manager);
        
        // 기본조건 확인
        const subscriptionNumber = (row[0] || '').toString().trim(); // A열: 가입번호
        const finalPolicy = (row[39] || '').toString().trim(); // AN열: 최종영업정책
        const modelType = (row[67] || '').toString().trim(); // CL열: 모델유형
        const joinType = (row[10] || '').toString().trim(); // K열: 가입구분
        
        // 기본조건 검증
        if (!subscriptionNumber || finalPolicy === 'BLANK' || 
            modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
          return;
        }
        
        // 업셀기변 계산
        if (joinType === '정책기변' || joinType === '재가입') {
          agent.upsellChange.denominator++;
          
          const finalPlan = (row[38] || '').toString().trim(); // AM열: 최종요금제
          const beforePlan = (row[75] || '').toString().trim(); // CX열: 변경전요금제
          
          const finalPlanInfo = planMapping.get(finalPlan);
          const beforePlanInfo = planMapping.get(beforePlan);
          
          if (finalPlanInfo && beforePlanInfo) {
            if (beforePlanInfo.group === '115군' || beforePlanInfo.group === '105군') {
              agent.upsellChange.numerator++;
            } else if (beforePlanInfo.price < finalPlanInfo.price) {
              agent.upsellChange.numerator++;
            }
          }
        }
        
        // 기변105이상 계산
        if (joinType === '정책기변' || joinType === '재가입') {
          const finalPlan = (row[38] || '').toString().trim();
          const finalModel = (row[32] || '').toString().trim(); // AG열: 최종모델
          
          const finalPlanInfo = planMapping.get(finalPlan);
          if (!finalPlanInfo) return;
          
          // 제외대상 확인
          const excludedGroups = ['시니어 Ⅰ군', '시니어 Ⅱ군', '청소년 Ⅰ군', '청소년 Ⅱ군', '청소년 Ⅲ군', '키즈군', '키즈22군'];
          if (excludedGroups.includes(finalPlanInfo.group)) return;
          
          if (finalPlan.includes('현역병사')) return;
          
          const excludedModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
          if (excludedModels.includes(finalModel)) return;
          
          agent.change105Above.denominator++;
          
          if (finalPlanInfo.group === '105군' || finalPlanInfo.group === '115군') {
            if (finalPlan.includes('디즈니') || finalPlan.includes('멀티팩')) {
              agent.change105Above.numerator += 1.2;
            } else {
              agent.change105Above.numerator += 1.0;
            }
          }
        }
        
        // 전략상품 계산
        agent.strategicProducts.denominator++;
        
        const insurance = (row[83] || '').toString().trim(); // DL열: 보험(폰교체
        const uflix = (row[93] || '').toString().trim(); // DO열: 유플릭스
        const callTone = (row[95] || '').toString().trim(); // DS열: 통화연결음
        const music = (row[79] || '').toString().trim(); // DG열: 뮤직류
        
        let totalPoints = 0;
        [insurance, uflix, callTone, music].forEach(service => {
          if (service) {
            // 1. 부가서비스명으로 정확히 매칭
            let product = finalStrategicProducts.find(p => p.serviceName === service);
            
            // 2. 부가서비스명 매칭이 안되면 소분류로 매칭
            if (!product) {
              product = finalStrategicProducts.find(p => p.subCategory === service);
            }
            
            if (product) {
              totalPoints += product.points;
            }
          }
        });
        
        agent.strategicProducts.numerator += totalPoints;
      } else {
        unmatchedStores.add(posCode);
      }
    });
    
    // 디버깅 로그 추가
    console.log('매칭된 담당자 수:', matchedCount);
    console.log('매칭되지 않은 업체들:', Array.from(unmatchedStores));
    console.log('매칭 예시:');
    if (manualRows.length > 0) {
      const firstRow = manualRows[0];
      const posCode = (firstRow[8] || '').toString().trim();
      console.log(`실판매POS: "${posCode}"`);
    }

    // 담당자별 인터넷 비중 계산
    const activationRows = activationData.slice(1);
    const homeRows = homeData.slice(1);
    
    // 개통데이터에서 담당자별 모수 계산
    activationRows.forEach(row => {
      if (row.length < 38) return;
      
      const activation = (row[37] || '').toString().trim(); // AL열: 개통
      const modelName = (row[13] || '').toString().trim(); // N열: 모델명
      const inputStore = (row[4] || '').toString().trim(); // E열: 입고처
      const planName = (row[21] || '').toString().trim(); // V열: 요금제
      const posCode = (row[7] || '').toString().trim(); // H열: P코드
      
      // 모수 조건 확인
      if (activation === '선불개통' || !modelName || inputStore === '중고') {
        return;
      }
      
      // 요금제군 확인 (2nd군 제외)
      const planInfo = planMapping.get(planName);
      if (planInfo && planInfo.group === '2nd군') {
        return;
      }
      
      // 담당자 매핑
      const manager = managerMapping.get(posCode);
      if (manager && agentMap.has(manager)) {
        agentMap.get(manager).internetRatio.denominator++;
      }
    });
    
    // 홈데이터에서 담당자별 자수 계산
    homeRows.forEach(row => {
      if (row.length < 10) return;
      
      const product = (row[9] || '').toString().trim(); // J열: 가입상품
      const posCode = (row[7] || '').toString().trim(); // H열: P코드
      
      // 자수 조건 확인
      if (product === '인터넷') {
        // 동판 문구가 없는 경우에만 추가 조건 확인
        if (!product.includes('동판')) {
          if (product !== '선불' && product !== '소호') {
            const manager = managerMapping.get(posCode);
            if (manager && agentMap.has(manager)) {
              agentMap.get(manager).internetRatio.numerator++;
            }
          }
        } else {
          const manager = managerMapping.get(posCode);
          if (manager && agentMap.has(manager)) {
            agentMap.get(manager).internetRatio.numerator++;
          }
        }
      }
    });

    // 담당자별 percentage 계산
    agentMap.forEach(agent => {
      // 업셀기변 percentage 계산
      agent.upsellChange.percentage = agent.upsellChange.denominator > 0 
        ? (agent.upsellChange.numerator / agent.upsellChange.denominator * 100).toFixed(2) 
        : '0.00';
      
      // 기변105이상 percentage 계산
      agent.change105Above.percentage = agent.change105Above.denominator > 0 
        ? (agent.change105Above.numerator / agent.change105Above.denominator * 100).toFixed(2) 
        : '0.00';
      
      // 전략상품 percentage 계산
      agent.strategicProducts.percentage = agent.strategicProducts.denominator > 0 
        ? (agent.strategicProducts.numerator / agent.strategicProducts.denominator * 100).toFixed(2) 
        : '0.00';
      
      // 인터넷 비중 percentage 계산
      agent.internetRatio.percentage = agent.internetRatio.denominator > 0 
        ? (agent.internetRatio.numerator / agent.internetRatio.denominator * 100).toFixed(2) 
        : '0.00';
    });

    // 디버깅 로그 추가
    console.log('담당자별 계산 결과:');
    agentMap.forEach((agent, name) => {
      console.log(`${name}:`, {
        upsellChange: agent.upsellChange,
        change105Above: agent.change105Above,
        strategicProducts: agent.strategicProducts,
        internetRatio: agent.internetRatio
      });
    });

    const result = {
      date: new Date().toISOString().split('T')[0],
      indicators: {
        upsellChange,
        change105Above,
        strategicProducts: strategicProductsResult,
        internetRatio
      },
      totalScore,
      matrixCriteria: finalMatrixCriteria,
      strategicProductsList: finalStrategicProducts,
      agentDetails: Array.from(agentMap.values())
    };

    res.json(result);
  } catch (error) {
    console.error('월간시상 데이터 계산 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate monthly award data',
      message: error.message
    });
  }
}

// 월간시상 셋팅 저장 API
async function saveMonthlyAwardSettings(req, res) {
  try {
    const { type, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Type and data are required'
      });
    }

    let sheetData = [];
    
    switch (type) {
      case 'matrix_criteria':
        // Matrix 기준값 저장
        sheetData = data.map(item => [item.score, item.percentage]);
        break;
      case 'strategic_products':
        // 전략상품 리스트 저장
        sheetData = data.map(item => [
          item.subCategory,
          item.serviceCode,
          item.serviceName,
          item.points
        ]);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type'
        });
    }

    // Google Sheets에 저장
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!A:Z`,
      valueInputOption: 'RAW',
      resource: {
        values: sheetData
      }
    });

    // 캐시 무효화
    invalidateCache(MANUAL_DATA_SHEET_NAME);
    invalidateCache(PLAN_SHEET_NAME);
    invalidateCache(STORE_SHEET_NAME);
    invalidateCache(CURRENT_MONTH_ACTIVATION_SHEET_NAME);
    invalidateCache(PHONEKL_HOME_DATA_SHEET_NAME);
    invalidateCache(MONTHLY_AWARD_SETTINGS_SHEET_NAME);

    res.json({
      success: true,
      message: '설정이 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('월간시상 셋팅 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save monthly award settings',
      message: error.message
    });
  }
}

module.exports = {
  getMonthlyAwardData,
  saveMonthlyAwardSettings
}; 