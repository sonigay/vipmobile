const express = require('express');
const { google } = require('googleapis');

// 월간시상 관련 시트 이름
const MANUAL_DATA_SHEET_NAME = '수기초';
const PLAN_SHEET_NAME = '무선요금제군';
const STORE_SHEET_NAME = '폰클출고처데이터';
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';
const PHONEKL_HOME_DATA_SHEET_NAME = '폰클홈데이터';
const MONTHLY_AWARD_SETTINGS_SHEET_NAME = '장표모드셋팅메뉴';

// 실제 시트 이름 확인을 위한 디버깅 함수
async function debugSheetNames() {
  try {
    console.log('=== 사용 가능한 시트 목록 확인 ===');
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });
    
    const sheetsList = response.data.sheets || [];
    console.log('전체 시트 목록:');
    sheetsList.forEach((sheet, index) => {
      console.log(`${index + 1}. ${sheet.properties.title}`);
    });
    console.log('================================');
    
    return sheetsList.map(sheet => sheet.properties.title);
  } catch (error) {
    console.error('시트 목록 확인 실패:', error);
    return [];
  }
}

// 환경변수 체크
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.SHEET_ID;

// 환경변수가 없으면 경고 로그만 출력하고 계속 진행
if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
  console.warn('⚠️ 환경변수가 설정되지 않았습니다. Google Sheets 기능이 제한될 수 있습니다.');
  console.warn('필요한 환경변수:', {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: !!GOOGLE_PRIVATE_KEY,
    SPREADSHEET_ID: !!SPREADSHEET_ID
  });
}

// Google API 인증 설정 (환경변수가 있을 때만)
let auth = null;
let sheets = null;

if (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY) {
  try {
    auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API 인증 설정 완료');
  } catch (error) {
    console.error('❌ Google Sheets API 인증 설정 실패:', error);
  }
} else {
  console.warn('⚠️ Google Sheets API 인증 설정을 건너뜁니다.');
}

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
    // 환경변수가 없으면 빈 배열 반환
    if (!sheets || !SPREADSHEET_ID) {
      console.warn(`⚠️ Google Sheets API가 설정되지 않아 ${sheetName} 데이터를 가져올 수 없습니다.`);
      return [];
    }

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

    // 캐시 확인 (개발 중이지만 성능을 위해 캐시 활용)
    invalidateCache(); // 개발 중 캐시 비활성화 해제

    // 1단계: 사용 가능한 시트 목록 확인
    const availableSheets = await debugSheetNames();
    
    // 2단계: 필요한 시트들이 존재하는지 확인
    const requiredSheets = [
      MANUAL_DATA_SHEET_NAME,
      PLAN_SHEET_NAME,
      STORE_SHEET_NAME,
      CURRENT_MONTH_ACTIVATION_SHEET_NAME,
      PHONEKL_HOME_DATA_SHEET_NAME,
      MONTHLY_AWARD_SETTINGS_SHEET_NAME,
      '대리점아이디관리'
    ];
    
    console.log('=== 필요한 시트 존재 여부 확인 ===');
    requiredSheets.forEach(sheetName => {
      const exists = availableSheets.includes(sheetName);
      console.log(`${sheetName}: ${exists ? '✅ 존재' : '❌ 없음'}`);
    });
    console.log('================================');

    // 필요한 시트 데이터 로드
    const [
      manualData,           // 수기초
      planData,             // 무선요금제군
      storeData,            // 폰클출고처데이터
      activationData,       // 폰클개통데이터
      homeData,             // 폰클홈데이터
      settingsData,         // 장표모드셋팅메뉴
      officeData            // 대리점아이디관리
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

    // 수기초에서 직접 담당자, 사무실, 소속 정보 사용
    console.log('=== 수기초에서 직접 담당자/사무실/소속 정보 사용 ===');
    
    const managerOfficeMapping = new Map(); // 담당자별 사무실/소속 매핑
    const manualRows = manualData.slice(1);
    
    // 수기초에서 담당자별 사무실/소속 정보 수집
    manualRows.forEach(row => {
      if (row.length >= 9) {
        const manager = (row[8] || '').toString().trim(); // I열: 담당자
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const department = (row[7] || '').toString().trim(); // H열: 소속
        
        if (manager) {
          managerOfficeMapping.set(manager, {
            office: office || '미분류',
            department: department || '미분류'
          });
        }
      }
    });
    
    console.log('담당자별 사무실/소속 매핑:', Object.fromEntries(managerOfficeMapping));
    console.log('담당자 수:', managerOfficeMapping.size);

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
    
    console.log('요금제 매핑 테이블 크기:', planMapping.size);
    console.log('요금제 매핑 예시:', Array.from(planMapping.entries()).slice(0, 5));

    // 요금제 매핑 실패 케이스 수집
    const unmatchedPlansForDebug = new Set();
    const unmatchedPlanGroups = new Set();
    
    // 수기초에서 실제 사용되는 요금제명들 수집
    const manualRowsForPlanMapping = manualData.slice(1);
    manualRowsForPlanMapping.forEach(row => {
      if (row.length >= 111) {
        const finalPlan = (row[47] || '').toString().trim(); // AU열: 최종요금제 (기존 AM열에서 +9)
        const beforePlan = (row[110] || '').toString().trim(); // DG열: 변경전요금제 (기존 CX열에서 +9)
        
        if (finalPlan && !planMapping.has(finalPlan)) {
          unmatchedPlansForDebug.add(finalPlan);
        }
        if (beforePlan && !planMapping.has(beforePlan)) {
          unmatchedPlansForDebug.add(beforePlan);
        }
      }
    });
    
    console.log('=== 요금제 매핑 실패 정보 ===');
    console.log('매칭되지 않은 요금제명 수:', unmatchedPlansForDebug.size);
    console.log('매칭되지 않은 요금제명 목록:', Array.from(unmatchedPlansForDebug));
    console.log('================================');

    // 전략상품 부가서비스명 수집 (디버깅용) - 올바른 컬럼으로 수정
    const manualRowsForServiceMapping = manualData.slice(1);
    const uniqueServices = new Set();
    
    manualRowsForServiceMapping.forEach(row => {
      if (row.length >= 132) {
        // 전략상품 관련 컬럼들 확인 (올바른 컬럼 인덱스 사용)
        const musicService = (row[119] || '').toString().trim(); // DP열: 뮤직류
        const insuranceService = (row[124] || '').toString().trim(); // DU열: 보험(폰교체)
        const uflixService = (row[127] || '').toString().trim(); // DX열: 유플릭스
        const callToneService = (row[131] || '').toString().trim(); // EB열: 통화연결음
        
        // 고유한 부가서비스명들 수집
        if (musicService) uniqueServices.add(musicService);
        if (insuranceService) uniqueServices.add(insuranceService);
        if (uflixService) uniqueServices.add(uflixService);
        if (callToneService) uniqueServices.add(callToneService);
      }
    });
    
    console.log('=== 전략상품 부가서비스명 정보 ===');
    console.log('발견된 고유 전략상품 부가서비스명 수:', uniqueServices.size);
    console.log('전략상품 부가서비스명 목록:', Array.from(uniqueServices));
    console.log('================================');

    // 전략상품 리스트 로드 (F1:I50 영역에서)
    const strategicProducts = [];
    try {
      const strategicProductsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!F1:I50`
      });
      
      const strategicProductsData = strategicProductsResponse.data.values || [];
      console.log('전략상품 시트 데이터:', strategicProductsData);
      
      if (strategicProductsData.length > 1) {
        const strategicProductsRows = strategicProductsData.slice(1); // 헤더 제외
        strategicProductsRows.forEach(row => {
          if (row.length >= 4 && row[0] && row[2] && row[3]) { // 소분류, 부가서비스명, 포인트가 있는 경우만
            strategicProducts.push({
              subCategory: row[0] || '',        // F열: 소분류
              serviceCode: row[1] || '',        // G열: 부가서비스 코드
              serviceName: row[2] || '',        // H열: 부가서비스명
              points: parseFloat(row[3] || 0)   // I열: 포인트
            });
          }
        });
      }
    } catch (error) {
      console.log('전략상품 데이터 로드 실패, 기본값 사용:', error.message);
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
    
    console.log('전략상품 설정 개수:', finalStrategicProducts.length);
    console.log('전략상품 설정:', finalStrategicProducts);

    // Matrix 기준값 로드 (A1:D30 영역에서)
    const matrixCriteria = [];
    try {
      // 환경변수가 없으면 기본값 사용
      if (!sheets || !SPREADSHEET_ID) {
        console.log('Google Sheets API가 설정되지 않아 기본 Matrix 기준값을 사용합니다.');
      } else {
        const matrixResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!A1:D30`
        });
        
        const matrixData = matrixResponse.data.values || [];
        console.log('Matrix 기준값 시트 데이터:', matrixData);
        
        if (matrixData.length > 1) {
          const matrixRows = matrixData.slice(1); // 헤더 제외
          console.log('Matrix 행 데이터:', matrixRows);
          matrixRows.forEach((row, index) => {
            console.log(`행 ${index}:`, row);
            if (row.length >= 3 && row[0] && row[1] && row[2]) { // 지표명, 점수, 퍼센트가 있는 경우만
              const indicatorName = row[0] || ''; // A열: 지표명
              const score = parseInt(row[1]); // B열: 점수
              const percentage = parseFloat(row[2]); // C열: 퍼센트
              const description = row[3] || ''; // D열: 설명
              
              console.log(`처리 중: indicatorName="${indicatorName}", score=${score}, percentage=${percentage}, description="${description}"`);
              
              if (!isNaN(score) && !isNaN(percentage)) {
                // 지표명에서 indicator 추출
                let indicatorType = '';
                if (indicatorName.includes('업셀기변')) {
                  indicatorType = 'upsell';
                } else if (indicatorName.includes('기변105이상')) {
                  indicatorType = 'change105';
                } else if (indicatorName.includes('전략상품')) {
                  indicatorType = 'strategic';
                } else if (indicatorName.includes('인터넷 비중')) {
                  indicatorType = 'internet';
                }
                
                console.log(`지표 추출 결과: ${indicatorType}`);
                
                if (indicatorType) {
                  matrixCriteria.push({ 
                    score, 
                    percentage, 
                    description,
                    indicator: indicatorType 
                  });
                  console.log(`Matrix 기준값 추가: ${indicatorType} ${score}점 ${percentage}% (${description})`);
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Matrix 기준값 데이터 로드 실패:', error.message);
      throw new Error(`Matrix 기준값을 로드할 수 없습니다. 장표모드셋팅메뉴 시트의 A1:D30 범위를 확인해주세요. 오류: ${error.message}`);
    }

    // Matrix 기준값 검증
    if (matrixCriteria.length === 0) {
      throw new Error('Matrix 기준값이 설정되지 않았습니다. 장표모드셋팅메뉴 시트에 데이터를 입력해주세요.');
    }

    // 각 지표별로 최소 1개 이상의 기준값이 있는지 확인
    const indicators = ['upsell', 'change105', 'strategic', 'internet'];
    const missingIndicators = indicators.filter(indicator => 
      !matrixCriteria.some(criterion => criterion.indicator === indicator)
    );
    
    if (missingIndicators.length > 0) {
      throw new Error(`다음 지표의 Matrix 기준값이 누락되었습니다: ${missingIndicators.join(', ')}`);
    }

    const finalMatrixCriteria = matrixCriteria;

    // 월간시상 계산 함수들
    const calculateUpsellChange = (manager) => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0; // 자수
      let denominator = 0; // 모수
      
      if (manager === '지은정보') {
        console.error(`\n=== ${manager} 업셀기변 계산 시작 ===`);
        console.error(`🔍 [업셀기변] ${manager} 디버깅 시작 - 전체 행 수: ${manualRows.length}`);
      }
      
      manualRows.forEach(row => {
        if (row.length < 112) return; // 최소 필요한 열 수 확인 (DH열까지)
        
        // 담당자 매칭 확인
        const currentManager = (row[8] || '').toString().trim(); // I열: 담당자
        if (currentManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        // 지은정보 담당자만 디버깅 로그 출력
        if (manager === '지은정보') {
          console.log(`🔍 [지은정보] 행 처리 시작`);
        }
        
        // 기본조건 확인
        const finalPolicy = (row[48] || '').toString().trim(); // AW열: 최종영업정책
        const modelType = (row[98] || '').toString().trim(); // CU열: 모델유형
        const joinType = (row[19] || '').toString().trim(); // T열: 가입구분
        
        // 모수 조건 확인 (BLANK만 제외, 나머지는 모두 모수에 포함)
        if (finalPolicy === 'BLANK') {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 제외: finalPolicy BLANK`);
          }
          return; // BLANK만 제외
        }
        if (modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 제외: modelType ${modelType}`);
          }
          return; // 2nd모델 제외
        }
        if (joinType !== '정책기변' && joinType !== '재가입') {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 제외: joinType ${joinType}`);
          }
          return; // 정책기변/재가입이 아닌 경우 제외
        }
        
        // 모수 카운팅
        denominator++;
        if (manager === '지은정보') {
          console.error(`🔍 [지은정보] 모수 추가: ${denominator} (finalPolicy: ${finalPolicy}, modelType: ${modelType}, joinType: ${joinType})`);
        }
        
        // 자수 조건 확인
        const planGroup = (row[99] || '').toString().trim(); // CV열: 105군/115군 확인
        const upsellTarget = (row[111] || '').toString().trim(); // DH열: 업셀대상
        
        // 특별 조건: 105군, 115군이면 무조건 인정
        if (planGroup === '105군' || planGroup === '115군') {
          numerator++;
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 자수 추가: ${numerator} (planGroup: ${planGroup})`);
          }
        }
        // 일반 조건: 업셀대상이 'Y'인 경우
        else if (upsellTarget === 'Y') {
          numerator++;
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 자수 추가: ${numerator} (upsellTarget: ${upsellTarget})`);
          }
        }
      });
      
      if (manager === '지은정보') {
        console.error(`🔍 [지은정보] 업셀기변 최종 결과: numerator=${numerator}, denominator=${denominator}, percentage=${denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0}%`);
      }
      if (manager !== '지은정보') {
        console.log(`${manager} 업셀기변 결과: numerator=${numerator}, denominator=${denominator}`);
      }
      return {
        numerator,
        denominator,
        percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
      };
    };

    const calculateChange105Above = (manager) => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0;
      let denominator = 0;
      
      if (manager === '지은정보') {
        console.error(`\n🔍 [기변105이상] ${manager} 계산 시작 (전체 행 수: ${manualRows.length})`);
      }
      
      manualRows.forEach(row => {
        if (row.length < 100) return; // CV열(99번 인덱스) 사용을 위해 100 이상 필요
        
        // 담당자 매칭 확인
        const currentManager = (row[8] || '').toString().trim(); // I열: 담당자
        if (manager === '지은정보') {
          console.error(`🔍 [지은정보] 담당자 매칭 확인: "${currentManager}" vs "${manager}"`);
        }
        if (currentManager !== manager) {
          if (manager === '지은정보') {
            console.error(`❌ [지은정보] 담당자 불일치: "${currentManager}" vs "${manager}"`);
          }
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        // 기본조건 확인 (컬럼 인덱스 수정)
        const finalPolicy = (row[48] || '').toString().trim(); // AW열: 최종영업정책
        const modelType = (row[98] || '').toString().trim(); // CU열: 모델유형
        const joinType = (row[19] || '').toString().trim(); // T열: 가입구분
        const finalPlan = (row[45] || '').toString().trim(); // AT열: 개통요금제
        const finalModel = (row[38] || '').toString().trim(); // AM열: 개통모델
        
        // 기본조건 검증 (BLANK만 제외, 나머지는 모두 모수에 포함)
        if (finalPolicy === 'BLANK') {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 기변105이상 제외: 최종영업정책 BLANK`);
          }
          return;
        }
        if (modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 기변105이상 제외: 모델유형 ${modelType}`);
          }
          return;
        }
        if (joinType !== '정책기변' && joinType !== '재가입') {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 기변105이상 제외: 가입구분 ${joinType} (정책기변/재가입 아님)`);
          }
          return;
        }
        
        // 요금제 제외 조건 (태블릿, 스마트기기, Wearable 포함된 요금제 제외)
        if (finalPlan.includes('태블릿') || finalPlan.includes('스마트기기') || finalPlan.includes('Wearable')) {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 기변105이상 제외: 요금제 ${finalPlan} (태블릿/스마트기기/Wearable 포함)`);
          }
          return;
        }
        
        // 요금제명 제외 (현역병사 포함)
        if (finalPlan.includes('현역병사')) {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 기변105이상 제외: 요금제 ${finalPlan} (현역병사 포함)`);
          }
          return;
        }
        
        // 모델명 제외
        const excludedModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
        if (excludedModels.includes(finalModel)) {
          if (manager === '지은정보') {
            console.error(`🔍 [지은정보] 기변105이상 제외: 모델 ${finalModel} (제외 모델)`);
          }
          return;
        }
        
        // 모수 카운팅
        denominator++;
        if (manager === '지은정보') {
          console.error(`🔍 [지은정보] 기변105이상 모수 추가: ${denominator}`);
        }
        
        // 자수 카운팅 (CV열에서 105군/115군 직접 확인)
        const planGroup = (row[99] || '').toString().trim(); // CV열: 105군/115군 확인
        if (manager === '지은정보') {
          console.error(`🔍 [지은정보] 기변105이상 CV열 값: "${planGroup}" (요금제: ${finalPlan})`);
        }
        if (planGroup === '105군' || planGroup === '115군') {
          // 특별 조건: 티빙, 멀티팩 포함 시 1.2 카운트
          if (finalPlan.includes('티빙') || finalPlan.includes('멀티팩')) {
            numerator += 1.2;
            if (manager === '지은정보') {
              console.error(`✅ [지은정보] 기변105이상 인정: ${planGroup}, 티빙/멀티팩 포함`);
            }
          } else {
            numerator += 1.0;
            if (manager === '지은정보') {
              console.error(`✅ [지은정보] 기변105이상 인정: ${planGroup}`);
            }
          }
        } else if (planGroup) {
          if (manager === '지은정보') {
            console.error(`❌ [지은정보] 기변105이상 제외: ${planGroup} (105군/115군 아님)`);
          }
        } else {
          if (manager === '지은정보') {
            console.error(`❌ [지은정보] 기변105이상 제외: CV열 값 없음`);
          }
        }
      });
      
      if (manager === '지은정보') {
        console.error(`🔍 [지은정보] 기변105이상 최종 결과: numerator=${numerator}, denominator=${denominator}, percentage=${denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0}%`);
      }
      if (manager !== '지은정보') {
        console.log(`${manager} 기변105이상 결과: numerator=${numerator}, denominator=${denominator}`);
      }
      return {
        numerator,
        denominator,
        percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
      };
    };

    const calculateStrategicProducts = (manager) => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0;
      let denominator = 0;
      
      // 전략상품 로그 최소화
      // console.log(`\n=== ${manager} 전략상품 계산 시작 ===`);
      // console.log(`전략상품 설정:`, finalStrategicProducts);
      // console.log(`전략상품 설정 개수:`, finalStrategicProducts.length);
      
      manualRows.forEach(row => {
        if (row.length < 132) return; // EB열(131번 인덱스) 사용을 위해 132 이상 필요
        
        // 담당자 매칭 확인
        const currentManager = (row[8] || '').toString().trim(); // I열: 담당자
        if (currentManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        // 기본조건 확인 (컬럼 인덱스 수정)
        const finalPolicy = (row[48] || '').toString().trim(); // AW열: 최종영업정책
        const modelType = (row[98] || '').toString().trim(); // CU열: 모델유형
        
        // 기본조건 검증 (BLANK만 제외, 나머지는 모두 모수에 포함)
        if (finalPolicy === 'BLANK') {
          return; // BLANK만 제외
        }
        if (modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
          return; // 2nd모델 제외
        }
        
        // 모수 카운팅
        denominator++;
        
        // 자수 계산 (전략상품 포인트 합계)
        const insurance = (row[124] || '').toString().trim(); // DU열: 보험(폰교체)
        const uflix = (row[127] || '').toString().trim(); // DX열: 유플릭스
        const callTone = (row[131] || '').toString().trim(); // EB열: 통화연결음
        const music = (row[119] || '').toString().trim(); // DP열: 뮤직류
        
        let totalPoints = 0;
        
        // 각 항목별 포인트 계산 (부가서비스명 직접 매칭)
        [insurance, uflix, callTone, music].forEach(service => {
          if (service) {
            // 장표모드셋팅메뉴의 H열(부가서비스명)과 정확히 일치하는지 확인
            const product = finalStrategicProducts.find(p => p.serviceName === service);
            
            if (product) {
              totalPoints += product.points;
            } else {
              // 매칭되지 않은 부가서비스명은 디버깅용으로 수집
              unmatchedStrategicProducts.add(service);
            }
          }
        });
        
        numerator += totalPoints;
      });
      
      // console.log(`${manager} 전략상품 결과: numerator=${numerator}, denominator=${denominator}`);
      return {
        numerator,
        denominator,
        percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
      };
    };

    const calculateInternetRatio = (manager) => {
      const activationRows = activationData.slice(3); // 헤더가 3행에 있으므로 4행부터 시작
      const homeRows = homeData.slice(3); // 헤더가 3행에 있으므로 4행부터 시작
      
      let numerator = 0;
      let denominator = 0;
      
      // 인터넷 비중 계산 디버깅
      let matchedHomeRows = 0;
      let internetRows = 0;
      
      console.log(`\n🌐 [인터넷 비중] ${manager} 계산 시작 (개통: ${activationRows.length}, 홈: ${homeRows.length})`);
      
      // 개통데이터 기준으로 모수 계산
      activationRows.forEach(row => {
        if (row.length < 16) return; // 최소 필요한 열 수 확인 (+8)
        
        const activation = (row[19] || '').toString().trim(); // T열: 개통 (기존 L열에서 +8)
        const modelName = (row[21] || '').toString().trim(); // V열: 모델명 (기존 N열에서 +8)
        const inputStore = (row[12] || '').toString().trim(); // M열: 입고처 (기존 E열에서 +8)
        const planName = (row[29] || '').toString().trim(); // AD열: 요금제 (기존 V열에서 +8)
        const currentManager = (row[8] || '').toString().trim(); // I열: 담당자 (폰클개통데이터)
        
        // 모수 조건 확인
        if (activation === '선불개통' || !modelName || inputStore === '중고') {
          return;
        }
        
        // 요금제 제외 조건 (태블릿, 스마트기기, Wearable 포함된 요금제 제외)
        if (planName.includes('태블릿') || planName.includes('스마트기기') || planName.includes('Wearable')) {
          return;
        }
        
        // 담당자 매칭 확인
        if (currentManager !== manager) {
          console.log(`❌ [인터넷 비중] ${manager} 개통데이터 담당자 불일치: "${currentManager}" vs "${manager}"`);
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        denominator++;
        console.log(`✅ [인터넷 비중] ${manager} 개통데이터 모수 추가: ${denominator}`);
      });
      
      // 홈데이터 기준으로 자수 계산
      homeRows.forEach(row => {
        if (row.length < 8) return;
        
        const product = (row[17] || '').toString().trim(); // R열: 가입상품
        const currentManager = (row[7] || '').toString().trim(); // H열: 담당자 (폰클홈데이터)
        
        // 담당자 매칭 확인
        if (currentManager !== manager) {
          console.log(`❌ [인터넷 비중] ${manager} 홈데이터 담당자 불일치: "${currentManager}" vs "${manager}"`);
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        matchedHomeRows++;
        console.log(`✅ [인터넷 비중] ${manager} 홈데이터 매칭: ${matchedHomeRows}`);
        
        // 자수 조건 확인
        if (product.includes('인터넷')) {
          internetRows++;
          // console.log(`${manager} 인터넷 상품 발견: ${product}`);
          // 동판 문구가 없는 경우에만 추가 조건 확인
          if (!product.includes('동판')) {
            if (product !== '선불' && product !== '소호') {
              numerator++;
              // console.log(`${manager} 인터넷 비중 인정: ${product}`);
            } else {
              console.log(`${manager} 인터넷 비중 제외: ${product} (선불/소호)`);
            }
          } else {
            numerator++;
            // console.log(`${manager} 인터넷 비중 인정: ${product} (동판 포함)`);
          }
        }
      });
      
      // 매칭되지 않은 경우에만 로그 출력
      if (matchedHomeRows === 0) {
        console.log(`🔍 [인터넷 비중] ${manager}: 매칭된 업체 없음 (분모: ${denominator}, 분자: 0)`);
      } else if (numerator > 0) {
        console.log(`✅ [인터넷 비중] ${manager}: ${numerator}/${denominator} = ${((numerator/denominator)*100).toFixed(2)}%`);
      }
      return {
        numerator,
        denominator,
        percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
      };
    };

    // 담당자별 상세 데이터 계산
    const agentMap = new Map();
    
    // 매칭되지 않은 항목들 추적 (전역으로 이동)
    const unmatchedStrategicProducts = new Set(); // 전략상품용
    const unmatchedPlans = new Set(); // 요금제 매핑용
    
    // 담당자별 데이터 수집 (manualRows는 이미 위에서 선언됨)
    console.log('매뉴얼데이터 행 수:', manualRows.length);
    
    // 첫 번째 행에서 컬럼 구조 확인
    if (manualRows.length > 0) {
      const firstRow = manualRows[0];
      console.log('=== 매뉴얼데이터 컬럼 구조 확인 ===');
      console.log('전체 행 길이:', firstRow.length);
      console.log('I열(8) - 담당자:', firstRow[8]);
      console.log('G열(6) - 사무실:', firstRow[6]);
      console.log('H열(7) - 소속:', firstRow[7]);
      console.log('T열(19) - 가입구분:', firstRow[19]);
      console.log('AM열(38) - 개통모델:', firstRow[38]);
      console.log('AT열(45) - 개통요금제:', firstRow[45]);
      console.log('AW열(48) - 최종영업정책:', firstRow[48]);
      console.log('CU열(98) - 모델유형:', firstRow[98]);
      console.log('CV열(99) - 105군/115군:', firstRow[99]);
      console.log('DH열(111) - 업셀대상:', firstRow[111]);
      console.log('DP열(119) - 뮤직류:', firstRow[119]);
      console.log('DU열(124) - 보험(폰교체):', firstRow[124]);
      console.log('DX열(127) - 유플릭스:', firstRow[127]);
      console.log('EB열(131) - 통화연결음:', firstRow[131]);
      console.log('================================');
    }
    
    let matchedCount = 0;
    
    manualRows.forEach(row => {
      if (row.length < 132) return; // 최소 필요한 열 수 확인 (EB열까지)
      
      const manager = (row[8] || '').toString().trim(); // I열: 담당자
      
      if (manager) {
        matchedCount++;
        if (!agentMap.has(manager)) {
          const officeInfo = managerOfficeMapping.get(manager) || { office: '미분류', department: '미분류' };
          agentMap.set(manager, {
            name: manager,
            office: officeInfo.office,
            department: officeInfo.department,
            upsellChange: { numerator: 0, denominator: 0 },
            change105Above: { numerator: 0, denominator: 0 },
            strategicProducts: { numerator: 0, denominator: 0 },
            internetRatio: { numerator: 0, denominator: 0 }
          });
        }
        
        const agent = agentMap.get(manager);
        
        // 기본조건 확인
        const subscriptionNumber = (row[9] || '').toString().trim(); // J열: 가입번호 (기존 A열에서 +9)
        const finalPolicy = (row[48] || '').toString().trim(); // AV열: 최종영업정책 (기존 AN열에서 +9)
        const modelType = (row[76] || '').toString().trim(); // CU열: 모델유형 (기존 CL열에서 +9)
        const joinType = (row[19] || '').toString().trim(); // T열: 가입구분 (기존 K열에서 +9)
        
        // 기본조건 검증
        if (!subscriptionNumber || finalPolicy === 'BLANK' || 
            modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
          return;
        }
        
        // 업셀기변 계산
        if (joinType === '정책기변' || joinType === '재가입') {
          // 모수 조건 확인
          const finalPolicy = (row[48] || '').toString().trim(); // AV열: 최종영업정책
          const modelType = (row[76] || '').toString().trim(); // CU열: 모델유형
          
          if (finalPolicy === 'BLANK' || 
              modelType === 'LTE_2nd모델' || modelType === '5G_2nd모델') {
            return;
          }
          
          agent.upsellChange.denominator++;
          
          // 자수 조건 확인
          const planGroup = (row[99] || '').toString().trim(); // CV열: 105군/115군 확인
          const upsellTarget = (row[111] || '').toString().trim(); // DH열: 업셀대상
          
          console.log(`🔍 [업셀기변] ${manager} - CV열: "${planGroup}", DH열: "${upsellTarget}"`);
          
          // 특별 조건: 105군, 115군이면 무조건 인정
          if (planGroup === '105군' || planGroup === '115군') {
            agent.upsellChange.numerator++;
          }
          // 일반 조건: 업셀대상이 'Y'인 경우
          else if (upsellTarget === 'Y') {
            agent.upsellChange.numerator++;
          }
        }
        
        // 기변105이상 계산
        if (joinType === '정책기변' || joinType === '재가입') {
          const finalPlan = (row[45] || '').toString().trim(); // AT열: 개통요금제
          const finalModel = (row[38] || '').toString().trim(); // AM열: 개통모델
          
          // 요금제 제외 조건 (태블릿, 스마트기기, Wearable 포함된 요금제 제외)
          if (finalPlan.includes('태블릿') || finalPlan.includes('스마트기기') || finalPlan.includes('Wearable')) {
            return;
          }
          
          if (finalPlan.includes('현역병사')) {
            return;
          }
          
          const excludedModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
          if (excludedModels.includes(finalModel)) {
            return;
          }
          
          agent.change105Above.denominator++;
          
          // CV열에서 105군/115군 직접 확인
          const planGroup = (row[99] || '').toString().trim(); // CV열: 105군/115군 확인
          
          if (planGroup === '105군' || planGroup === '115군') {
            if (finalPlan.includes('티빙') || finalPlan.includes('멀티팩')) {
              agent.change105Above.numerator += 1.2;
            } else {
              agent.change105Above.numerator += 1.0;
            }
          }
        }
        
        // 전략상품 계산은 별도 함수에서 처리 (중복 제거)
      }
    });
    
    // 디버깅 로그 추가
    // console.log('매칭된 담당자 수:', matchedCount);
    // console.log('담당자별 데이터 수집 완료');
    // console.log('매칭 예시:');
    if (manualRows.length > 0) {
      const firstRow = manualRows[0];
      const manager = (firstRow[8] || '').toString().trim();
              // console.log(`담당자: "${manager}"`);
    }



    // 담당자별 인터넷 비중 계산
    const activationRows = activationData.slice(3); // 헤더가 3행에 있으므로 4행부터 시작
    const homeRows = homeData.slice(3); // 헤더가 3행에 있으므로 4행부터 시작
    
    // console.log('=== 인터넷 비중 계산 디버깅 ===');
    // console.log('개통데이터 행 수:', activationRows.length);
    // console.log('홈데이터 행 수:', homeRows.length);
    // console.log('담당자별 사무실/소속 매핑 수:', managerOfficeMapping.size);
    
    // 개통데이터/홈데이터 컬럼 구조 확인
    if (activationRows.length > 0) {
      const firstActivationRow = activationRows[0];
      // console.log('=== 개통데이터 컬럼 구조 확인 ===');
              // console.log('전체 행 길이:', firstActivationRow.length);
              // console.log('M열(12) - 입고처:', firstActivationRow[12]);
              // console.log('I열(8) - 담당자:', firstActivationRow[8]);
              // console.log('V열(21) - 모델명:', firstActivationRow[21]);
              // console.log('AD열(29) - 요금제:', firstActivationRow[29]);
              // console.log('T열(19) - 개통:', firstActivationRow[19]);
      console.log('================================');
    }
    
    if (homeRows.length > 0) {
      const firstHomeRow = homeRows[0];
      // console.log('=== 홈데이터 컬럼 구조 확인 ===');
              // console.log('전체 행 길이:', firstHomeRow.length);
              // console.log('H열(7) - 담당자:', firstHomeRow[7]);
              // console.log('R열(17) - 가입상품:', firstHomeRow[17]);
      // console.log('================================');
    }
    

    
    // 폰클개통데이터와 폰클홈데이터에서 직접 담당자 정보 사용
    // console.log('=== 폰클개통데이터/홈데이터에서 직접 담당자 정보 사용 ===');
    
    // 인터넷 비중 계산용 담당자별 Map 생성
    const internetAgentMap = new Map();
    
    // 개통데이터에서 담당자별 모수 계산
    let activationProcessedCount = 0;
    let activationMatchedCount = 0;
    
    activationRows.forEach(row => {
      if (row.length < 30) return;
      
      const activation = (row[19] || '').toString().trim(); // T열: 개통
      const modelName = (row[21] || '').toString().trim(); // V열: 모델명
      const inputStore = (row[12] || '').toString().trim(); // M열: 입고처
      const planName = (row[29] || '').toString().trim(); // AD열: 요금제
      const manager = (row[8] || '').toString().trim(); // I열: 담당자 (폰클개통데이터)
      
      activationProcessedCount++;
      
      // 담당자 정보 확인
      if (!manager) {
        return;
      }
      
      // 모수 조건 확인
      if (activation === '선불개통' || !modelName || inputStore === '중고') {
        return;
      }
      
      // 요금제 제외 조건 (태블릿, 스마트기기, Wearable 포함된 요금제 제외)
      if (planName.includes('태블릿') || planName.includes('스마트기기') || planName.includes('Wearable')) {
        return;
      }
      
      // 인터넷 비중 계산용 Map에 담당자 추가
      if (!internetAgentMap.has(manager)) {
        internetAgentMap.set(manager, {
          name: manager,
          denominator: 0,
          numerator: 0
        });
      }
      
      internetAgentMap.get(manager).denominator++;
      activationMatchedCount++;
    });
    
    // console.log('개통데이터 처리 결과:', {
    //   processed: activationProcessedCount,
    //   matched: activationMatchedCount
    // });
    
    // 홈데이터에서 담당자별 자수 계산
    let homeProcessedCount = 0;
    let homeMatchedCount = 0;
    let internetCount = 0;
    
    homeRows.forEach(row => {
      if (row.length < 10) return;
      
      const product = (row[17] || '').toString().trim(); // R열: 가입상품 (수정)
      const manager = (row[7] || '').toString().trim(); // H열: 담당자 (폰클홈데이터)
      
      homeProcessedCount++;
      
      // 담당자 정보 확인
      if (!manager) {
        console.log(`홈데이터 담당자 없음: ${product}`);
        return;
      }
      
      // 자수 조건 확인
      if (product.includes('인터넷')) {
        internetCount++;
        // console.log(`인터넷 상품 발견: ${manager} - ${product}`);
        // 동판 문구가 없는 경우에만 추가 조건 확인
        if (!product.includes('동판')) {
          if (product !== '선불' && product !== '소호') {
            if (internetAgentMap.has(manager)) {
              internetAgentMap.get(manager).numerator++;
              homeMatchedCount++;
              // console.log(`인터넷 비중 인정: ${manager} - ${product}`);
            } else {
              console.log(`홈데이터 담당자 매칭 실패: "${manager}" (상품: ${product})`);
            }
          }
        } else {
          if (internetAgentMap.has(manager)) {
            internetAgentMap.get(manager).numerator++;
            homeMatchedCount++;
            // console.log(`인터넷 비중 인정 (동판): ${manager} - ${product}`);
          } else {
            console.log(`홈데이터 담당자 매칭 실패: "${manager}" (상품: ${product})`);
          }
        }
      }
    });
    
    // console.log('홈데이터 처리 결과:', {
    //   processed: homeProcessedCount,
    //   matched: homeMatchedCount,
    //   internetProducts: internetCount
    // });
    
    // 인터넷 비중 결과를 agentMap에 반영
    internetAgentMap.forEach((internetAgent, managerName) => {
      if (agentMap.has(managerName)) {
        agentMap.get(managerName).internetRatio.numerator = internetAgent.numerator;
        agentMap.get(managerName).internetRatio.denominator = internetAgent.denominator;
        // console.log(`인터넷 비중 결과 반영: ${managerName} - ${internetAgent.numerator}/${internetAgent.denominator}`);
      }
    });

    // 담당자별 전략상품 계산 (별도 함수 사용)
    // console.log('=== 전략상품 계산 시작 ===');
    agentMap.forEach(agent => {
      const strategicResult = calculateStrategicProducts(agent.name);
      agent.strategicProducts.numerator = strategicResult.numerator;
      agent.strategicProducts.denominator = strategicResult.denominator;
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

    // 사무실별/소속별 그룹화된 데이터 생성
    const officeGroupMap = new Map();
    const departmentGroupMap = new Map();
    
    agentMap.forEach(agent => {
      // 사무실별 그룹화
      const officeKey = agent.office || '미분류';
      if (!officeGroupMap.has(officeKey)) {
        officeGroupMap.set(officeKey, {
          office: officeKey,
          agents: [],
          totalUpsellChange: { numerator: 0, denominator: 0, percentage: '0.00' },
          totalChange105Above: { numerator: 0, denominator: 0, percentage: '0.00' },
          totalStrategicProducts: { numerator: 0, denominator: 0, percentage: '0.00' },
          totalInternetRatio: { numerator: 0, denominator: 0, percentage: '0.00' }
        });
      }
      const officeGroup = officeGroupMap.get(officeKey);
      officeGroup.agents.push(agent);
      
      // 소속별 그룹화
      const departmentKey = agent.department || '미분류';
      if (!departmentGroupMap.has(departmentKey)) {
        departmentGroupMap.set(departmentKey, {
          department: departmentKey,
          agents: [],
          totalUpsellChange: { numerator: 0, denominator: 0, percentage: '0.00' },
          totalChange105Above: { numerator: 0, denominator: 0, percentage: '0.00' },
          totalStrategicProducts: { numerator: 0, denominator: 0, percentage: '0.00' },
          totalInternetRatio: { numerator: 0, denominator: 0, percentage: '0.00' }
        });
      }
      const departmentGroup = departmentGroupMap.get(departmentKey);
      departmentGroup.agents.push(agent);
    });
    
    // 사무실별/소속별 합계 계산
    officeGroupMap.forEach(group => {
      group.agents.forEach(agent => {
        group.totalUpsellChange.numerator += agent.upsellChange.numerator;
        group.totalUpsellChange.denominator += agent.upsellChange.denominator;
        group.totalChange105Above.numerator += agent.change105Above.numerator;
        group.totalChange105Above.denominator += agent.change105Above.denominator;
        group.totalStrategicProducts.numerator += agent.strategicProducts.numerator;
        group.totalStrategicProducts.denominator += agent.strategicProducts.denominator;
        group.totalInternetRatio.numerator += agent.internetRatio.numerator;
        group.totalInternetRatio.denominator += agent.internetRatio.denominator;
      });
      
      // percentage 계산
      group.totalUpsellChange.percentage = group.totalUpsellChange.denominator > 0 
        ? (group.totalUpsellChange.numerator / group.totalUpsellChange.denominator * 100).toFixed(2) 
        : '0.00';
      group.totalChange105Above.percentage = group.totalChange105Above.denominator > 0 
        ? (group.totalChange105Above.numerator / group.totalChange105Above.denominator * 100).toFixed(2) 
        : '0.00';
      group.totalStrategicProducts.percentage = group.totalStrategicProducts.denominator > 0 
        ? (group.totalStrategicProducts.numerator / group.totalStrategicProducts.denominator * 100).toFixed(2) 
        : '0.00';
      group.totalInternetRatio.percentage = group.totalInternetRatio.denominator > 0 
        ? (group.totalInternetRatio.numerator / group.totalInternetRatio.denominator * 100).toFixed(2) 
        : '0.00';
    });
    
    departmentGroupMap.forEach(group => {
      group.agents.forEach(agent => {
        group.totalUpsellChange.numerator += agent.upsellChange.numerator;
        group.totalUpsellChange.denominator += agent.upsellChange.denominator;
        group.totalChange105Above.numerator += agent.change105Above.numerator;
        group.totalChange105Above.denominator += agent.change105Above.denominator;
        group.totalStrategicProducts.numerator += agent.strategicProducts.numerator;
        group.totalStrategicProducts.denominator += agent.strategicProducts.denominator;
        group.totalInternetRatio.numerator += agent.internetRatio.numerator;
        group.totalInternetRatio.denominator += agent.internetRatio.denominator;
      });
      
      // percentage 계산
      group.totalUpsellChange.percentage = group.totalUpsellChange.denominator > 0 
        ? (group.totalUpsellChange.numerator / group.totalUpsellChange.denominator * 100).toFixed(2) 
        : '0.00';
      group.totalChange105Above.percentage = group.totalChange105Above.denominator > 0 
        ? (group.totalChange105Above.numerator / group.totalChange105Above.denominator * 100).toFixed(2) 
        : '0.00';
      group.totalStrategicProducts.percentage = group.totalStrategicProducts.denominator > 0 
        ? (group.totalStrategicProducts.numerator / group.totalStrategicProducts.denominator * 100).toFixed(2) 
        : '0.00';
      group.totalInternetRatio.percentage = group.totalInternetRatio.denominator > 0 
        ? (group.totalInternetRatio.numerator / group.totalInternetRatio.denominator * 100).toFixed(2) 
        : '0.00';
    });

    // 전체 합계 계산
    let totalUpsellChange = { numerator: 0, denominator: 0, percentage: '0.00' };
    let totalChange105Above = { numerator: 0, denominator: 0, percentage: '0.00' };
    let totalStrategicProducts = { numerator: 0, denominator: 0, percentage: '0.00' };
    let totalInternetRatio = { numerator: 0, denominator: 0, percentage: '0.00' };

    agentMap.forEach(agent => {
      totalUpsellChange.numerator += agent.upsellChange.numerator;
      totalUpsellChange.denominator += agent.upsellChange.denominator;
      totalChange105Above.numerator += agent.change105Above.numerator;
      totalChange105Above.denominator += agent.change105Above.denominator;
      totalStrategicProducts.numerator += agent.strategicProducts.numerator;
      totalStrategicProducts.denominator += agent.strategicProducts.denominator;
      totalInternetRatio.numerator += agent.internetRatio.numerator;
      totalInternetRatio.denominator += agent.internetRatio.denominator;
    });

    // 전체 percentage 계산
    totalUpsellChange.percentage = totalUpsellChange.denominator > 0 
      ? (totalUpsellChange.numerator / totalUpsellChange.denominator * 100).toFixed(2) 
      : '0.00';
    totalChange105Above.percentage = totalChange105Above.denominator > 0 
      ? (totalChange105Above.numerator / totalChange105Above.denominator * 100).toFixed(2) 
      : '0.00';
    totalStrategicProducts.percentage = totalStrategicProducts.denominator > 0 
      ? (totalStrategicProducts.numerator / totalStrategicProducts.denominator * 100).toFixed(2) 
      : '0.00';
    totalInternetRatio.percentage = totalInternetRatio.denominator > 0 
      ? (totalInternetRatio.numerator / totalInternetRatio.denominator * 100).toFixed(2) 
      : '0.00';

    // 각 지표별 점수 계산 함수 (개선된 버전)
    const calculateScore = (percentage, criteria, maxScore) => {
      // 기준값을 점수 순으로 정렬 (높은 점수부터)
      const sortedCriteria = criteria.sort((a, b) => b.score - a.score);
      
      for (let i = 0; i < sortedCriteria.length; i++) {
        const criterion = sortedCriteria[i];
        
        if (criterion.description === '미만') {
          // 미만 조건: 해당 퍼센트 미만이면 해당 점수
          if (percentage < criterion.percentage) {
            return criterion.score;
          }
        } else if (criterion.description === '만점') {
          // 만점 조건: 해당 퍼센트 이상이면 해당 점수
          if (percentage >= criterion.percentage) {
            return criterion.score;
          }
        } else {
          // 이상 조건: 해당 퍼센트 이상이면 해당 점수
          if (percentage >= criterion.percentage) {
            return criterion.score;
          }
        }
      }
      
      // 모든 조건을 만족하지 않으면 최소 점수 반환
      const minScore = Math.min(...criteria.map(c => c.score));
      return minScore;
    };

    // 각 지표별 점수 계산
    const upsellScore = calculateScore(
      parseFloat(totalUpsellChange.percentage), 
      finalMatrixCriteria.filter(c => c.indicator === 'upsell'), 
      6
    );
    const change105Score = calculateScore(
      parseFloat(totalChange105Above.percentage), 
      finalMatrixCriteria.filter(c => c.indicator === 'change105'), 
      6
    );
    const strategicScore = calculateScore(
      parseFloat(totalStrategicProducts.percentage), 
      finalMatrixCriteria.filter(c => c.indicator === 'strategic'), 
      6 // 전략상품은 6점으로 수정
    );
    const internetScore = calculateScore(
      parseFloat(totalInternetRatio.percentage), 
      finalMatrixCriteria.filter(c => c.indicator === 'internet'), 
      3 // 인터넷 비중은 3점으로 수정
    );

    // 총점 계산 (각 지표별 점수 합산)
    const totalScore = (upsellScore + change105Score + strategicScore + internetScore).toFixed(0);

    // 디버깅 로그
    console.log('점수 계산 결과:', {
      upsellChange: { percentage: totalUpsellChange.percentage, score: upsellScore },
      change105Above: { percentage: totalChange105Above.percentage, score: change105Score },
      strategicProducts: { percentage: totalStrategicProducts.percentage, score: strategicScore },
      internetRatio: { percentage: totalInternetRatio.percentage, score: internetScore },
      totalScore
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

    // 각 지표별 최대 점수 계산 (시트에서 설정된 값 사용)
    const maxScores = {
      upsell: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'upsell').map(c => c.score), 6),
      change105: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'change105').map(c => c.score), 6),
      strategic: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'strategic').map(c => c.score), 6), // 전략상품은 6점으로 수정
      internet: Math.max(...finalMatrixCriteria.filter(c => c.indicator === 'internet').map(c => c.score), 3) // 인터넷 비중은 3점으로 수정
    };
    
    // 총점 계산
    const totalMaxScore = maxScores.upsell + maxScores.change105 + maxScores.strategic + maxScores.internet;

    const result = {
      date: new Date().toISOString().split('T')[0],
      indicators: {
        upsellChange: totalUpsellChange,
        change105Above: totalChange105Above,
        strategicProducts: totalStrategicProducts,
        internetRatio: totalInternetRatio
      },
      totalScore,
      maxScores, // 각 지표별 최대 점수
      totalMaxScore, // 총점 만점
      matrixCriteria: finalMatrixCriteria,
      strategicProductsList: finalStrategicProducts,
      agentDetails: Array.from(agentMap.values()),
      officeGroups: Array.from(officeGroupMap.values()),
      departmentGroups: Array.from(departmentGroupMap.values()),
      unmatchedItems: {
        companies: [], // 인터넷 비중 계산에서 업체명 매핑 제거로 인해 더 이상 필요하지 않음
        strategicProducts: Array.from(unmatchedStrategicProducts),
        plans: Array.from(unmatchedPlans)
      }
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
    const { type } = req.body;
    let { data } = req.body;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type is required'
      });
    }

    // data가 없거나 빈 배열인 경우 기본값 설정
    if (!data) {
      data = [];
    }

    // 데이터 검증 함수
    const validateMatrixData = (data) => {
      const errors = [];
      
      if (!Array.isArray(data) || data.length === 0) {
        errors.push('데이터가 비어있습니다.');
        return errors;
      }
      
      // 각 지표별로 데이터가 있는지 확인
      const requiredIndicators = ['upsell', 'change105', 'strategic', 'internet'];
      const missingIndicators = requiredIndicators.filter(indicator => 
        !data.some(item => item.indicator === indicator)
      );
      
      if (missingIndicators.length > 0) {
        errors.push(`누락된 지표: ${missingIndicators.join(', ')}`);
      }
      
      // 각 지표별로 퍼센트가 내림차순인지 확인
      requiredIndicators.forEach(indicator => {
        const indicatorData = data.filter(item => item.indicator === indicator);
        if (indicatorData.length > 1) {
          for (let i = 1; i < indicatorData.length; i++) {
            if (indicatorData[i-1].percentage <= indicatorData[i].percentage) {
              errors.push(`${indicator} 지표의 퍼센트가 내림차순이 아닙니다.`);
              break;
            }
          }
        }
      });
      
      return errors;
    };

    let sheetData = [];
    
    console.log('=== 전략상품 저장 디버깅 ===');
    console.log('저장 타입:', type);
    console.log('원본 데이터:', data);
    
    switch (type) {
      case 'matrix_criteria':
        // Matrix 기준값 저장
        console.log('=== Matrix 기준값 저장 디버깅 ===');
        console.log('원본 데이터:', data);
        
        // 데이터 검증 (임시로 완화)
        console.log('전송된 데이터:', JSON.stringify(data, null, 2));
        
        if (!data || data.length === 0) {
          return res.status(400).json({
            success: false,
            error: '데이터가 비어있습니다.'
          });
        }
        
        // 기본 데이터 구조 확인
        const hasValidData = data.some(item => 
          item && typeof item === 'object' && 
          item.indicator && item.score && item.percentage
        );
        
        if (!hasValidData) {
          return res.status(400).json({
            success: false,
            error: '데이터 형식이 올바르지 않습니다.'
          });
        }
        
        console.log('데이터 검증 통과');
        
        // 각 지표별 최대 점수 설정
        const maxScores = {
          'upsell': 6,      // 업셀기변: 6점
          'change105': 6,   // 기변105이상: 6점
          'strategic': 6,   // 전략상품: 6점
          'internet': 3     // 인터넷 비중: 3점으로 수정
        };
        
        // 총점 계산 (21점 만점으로 수정: 6+6+6+3)
        const totalMaxScore = 21;
        
        // 단순한 테이블 형태로 데이터 정리
        const organizedData = [];
        
        // 헤더 추가
        organizedData.push(['지표명', '점수', '퍼센트', '설명']);
        
        // 각 지표별 데이터 추가
        ['upsell', 'change105', 'strategic', 'internet'].forEach(indicator => {
          const indicatorData = data.filter(item => item.indicator === indicator);
          const maxScore = maxScores[indicator];
          
          // 지표별 헤더 추가
          const indicatorNames = {
            'upsell': '업셀기변',
            'change105': '기변105이상', 
            'strategic': '전략상품',
            'internet': '인터넷 비중'
          };
          
          // 점수별 데이터 추가 (6점부터 1점까지, 또는 3점부터 1점까지)
          const scoreRange = indicator === 'internet' ? [3, 2, 1] : [6, 5, 4, 3, 2, 1];
          
          for (let i = 0; i < scoreRange.length; i++) {
            const score = scoreRange[i];
            const item = indicatorData.find(d => d.score === score);
            if (item && item.percentage > 0) {
              // 사용자가 입력한 설명이 있으면 사용, 없으면 기본값
              let description = item.description || '';
              if (!description) {
                if (i === 0) {
                  description = '만점';
                } else if (i === scoreRange.length - 1) {
                  description = '미만';
                } else {
                  description = '이상';
                }
              }
              organizedData.push([
                `${indicatorNames[indicator]} (${maxScore}점)`,
                score,
                item.percentage,
                description
              ]);
            }
          }
        });
        
        sheetData = organizedData;
        console.log('정리된 데이터:', sheetData);
        break;
      case 'strategic_products':
        // 전략상품 리스트 저장
        console.log('=== 전략상품 저장 디버깅 ===');
        console.log('원본 데이터:', data);
        
        sheetData = [
          ['소분류', '부가서비스 코드', '부가서비스명', '포인트']
        ];
        
        if (data && Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            sheetData.push([
              item.subCategory || '',
              item.serviceCode || '',
              item.serviceName || '',
              item.points || 0
            ]);
          });
        } else {
          console.log('전략상품 데이터가 비어있습니다.');
        }
        
        console.log('전략상품 데이터:', sheetData);
        break;
      case 'company_mapping':
        // 업체 매핑 저장
        console.log('=== 업체 매핑 저장 디버깅 ===');
        console.log('원본 데이터:', data);
        
        sheetData = [
          ['개통데이터업체명', '폰클출고처업체명', '매핑상태', '비고']
        ];
        
        if (data && Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            sheetData.push([
              item.sourceCompany || '',
              item.targetCompany || '',
              '매핑완료',
              '인터넷비중계산용'
            ]);
          });
        } else {
          console.log('업체 매핑 데이터가 비어있습니다.');
        }
        
        console.log('업체 매핑 데이터:', sheetData);
        break;
      case 'plan_mapping':
        // 요금제 매핑 저장
        console.log('=== 요금제 매핑 저장 디버깅 ===');
        console.log('원본 데이터:', data);
        
        sheetData = [
          ['요금제명', '요금제군', '기본료', '매핑상태']
        ];
        
        if (data && Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            sheetData.push([
              item.planName || '',
              item.planGroup || '',
              item.baseFee || '',
              '매핑완료'
            ]);
          });
        } else {
          console.log('요금제 매핑 데이터가 비어있습니다.');
        }
        
        console.log('요금제 매핑 데이터:', sheetData);
        break;
      case 'manager_settings':
        // 담당자 관리 저장
        console.log('=== 담당자 관리 저장 디버깅 ===');
        console.log('원본 데이터:', data);
        
        sheetData = [
          ['담당자명', '활성화상태', '목표달성률', '비고']
        ];
        
        if (data && Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            sheetData.push([
              item.managerName || '',
              item.status || '활성',
              item.targetRate || '',
              item.note || ''
            ]);
          });
        } else {
          console.log('담당자 관리 데이터가 비어있습니다.');
        }
        
        console.log('담당자 관리 데이터:', sheetData);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type'
        });
    }

    // Google Sheets에 저장 (메뉴별로 다른 위치에 저장)
    let targetRange = '';
    
    switch (type) {
      case 'matrix_criteria':
        // Matrix 기준값: A1:D30 영역에 저장
        targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!A1:D30`;
        break;
      case 'strategic_products':
        // 전략상품: F1:I50 영역에 저장
        targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!F1:I50`;
        break;
      case 'company_mapping':
        // 업체 매핑: K1:N100 영역에 저장
        targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!K1:N100`;
        break;
      case 'plan_mapping':
        // 요금제 매핑: P1:S100 영역에 저장
        targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!P1:S100`;
        break;
      case 'manager_settings':
        // 담당자 관리: U1:X50 영역에 저장
        targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!U1:X50`;
        break;
      default:
        targetRange = `${MONTHLY_AWARD_SETTINGS_SHEET_NAME}!A:D`;
    }
    
    console.log(`저장 위치: ${targetRange}`);
    
    // Google Sheets API가 설정되지 않은 경우 처리
    if (!sheets || !SPREADSHEET_ID) {
      console.warn('Google Sheets API가 설정되지 않아 저장을 건너뜁니다.');
      return res.json({
        success: true,
        message: 'Google Sheets API가 설정되지 않아 로컬에서만 처리되었습니다.'
      });
    }
    
    // 기존 데이터를 지우고 새로운 데이터로 교체
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: targetRange,
      valueInputOption: 'USER_ENTERED', // 숫자 형식 유지
      resource: {
        values: sheetData
      }
    });

    // 캐시 무효화 (저장된 타입에 따라 선택적 무효화)
    if (type === 'matrix_criteria') {
      // Matrix 기준값만 저장한 경우 해당 시트만 무효화
      invalidateCache(MONTHLY_AWARD_SETTINGS_SHEET_NAME);
    } else {
      // 다른 설정을 저장한 경우 관련 캐시들 무효화
      invalidateCache(MANUAL_DATA_SHEET_NAME);
      invalidateCache(PLAN_SHEET_NAME);
      invalidateCache(STORE_SHEET_NAME);
      invalidateCache(CURRENT_MONTH_ACTIVATION_SHEET_NAME);
      invalidateCache(PHONEKL_HOME_DATA_SHEET_NAME);
      invalidateCache(MONTHLY_AWARD_SETTINGS_SHEET_NAME);
    }

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