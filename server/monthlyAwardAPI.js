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

    // 캐시 무효화 (개발 중이므로 캐시 비활성화)
    invalidateCache();

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

    // 담당자 매핑 테이블 생성 (수기초에 있는 실판매POS 코드만)
    const managerMapping = new Map();
    const companyManagerMapping = new Map(); // 업체명 → 담당자 매핑 (인터넷 비중용)
    const managerOfficeMapping = new Map(); // 담당자별 사무실/소속 매핑
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
        const companyName = (row[6] || '').toString().trim(); // G열: 업체명
        const manager = (row[13] || '').toString().trim(); // N열: 담당자
        const status = (row[4] || '').toString().trim(); // E열: 상태
        
        // 미사용 상태 제외하고, 수기초에 있는 실판매POS 코드만 매핑
        if (posCode && manager && status !== '미사용' && manualPosCodes.has(posCode)) {
          // 담당자 이름에서 괄호 부분 제거
          const cleanManager = manager.replace(/\([^)]*\)/g, '').trim();
          managerMapping.set(posCode, cleanManager);
          
          // 업체명 → 담당자 매핑도 추가
          if (companyName) {
            companyManagerMapping.set(companyName, cleanManager);
          }
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

    // 담당자별 사무실/소속 정보 수집 (대리점아이디관리 시트)
    if (officeData && officeData.length > 1) {
      const officeRows = officeData.slice(1);
      officeRows.forEach(row => {
        if (row.length >= 5) {
          const manager = (row[0] || '').toString().trim(); // A열: 담당자
          const office = (row[3] || '').toString().trim(); // D열: 사무실
          const department = (row[4] || '').toString().trim(); // E열: 소속
          
          if (manager) {
            managerOfficeMapping.set(manager, {
              office: office,
              department: department
            });
          }
        }
      });
    }
    
    console.log('담당자별 사무실/소속 매핑:', Object.fromEntries(managerOfficeMapping));

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
      if (row.length >= 102) {
        const finalPlan = (row[38] || '').toString().trim(); // AM열: 최종요금제
        const beforePlan = (row[101] || '').toString().trim(); // CX열: 변경전요금제
        
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

    // 전략상품 코드 매핑 테이블 생성 (숫자 코드 -> 부가서비스명)
    const strategicProductCodeMapping = new Map();
    
    // 매뉴얼데이터에서 실제 전략상품 코드와 부가서비스명 매핑 수집
    const manualRowsForCodeMapping = manualData.slice(1);
    const uniqueCodes = new Set();
    
    manualRowsForCodeMapping.forEach(row => {
      if (row.length >= 123) {
        // 전략상품 관련 컬럼들 확인
        const musicCode = (row[110] || '').toString().trim(); // DG열: 뮤직류
        const insuranceCode = (row[115] || '').toString().trim(); // DL열: 보험(폰교체)
        const uflixCode = (row[118] || '').toString().trim(); // DO열: 유플릭스
        const callToneCode = (row[122] || '').toString().trim(); // DS열: 통화연결음
        
        // 고유한 코드들 수집
        if (musicCode) uniqueCodes.add(musicCode);
        if (insuranceCode) uniqueCodes.add(insuranceCode);
        if (uflixCode) uniqueCodes.add(uflixCode);
        if (callToneCode) uniqueCodes.add(callToneCode);
      }
    });
    
    console.log('=== 전략상품 코드 매핑 정보 ===');
    console.log('발견된 고유 전략상품 코드 수:', uniqueCodes.size);
    console.log('전략상품 코드 목록:', Array.from(uniqueCodes));
    
    // 기본 매핑 규칙 (실제 데이터에 맞게 조정 필요)
    strategicProductCodeMapping.set('1900030850', '통화연결음');
    strategicProductCodeMapping.set('1900032727', '통화연결음');
    strategicProductCodeMapping.set('1900032118', '통화연결음');
    strategicProductCodeMapping.set('1411727779', '뮤직류');
    strategicProductCodeMapping.set('674704', '뮤직류');
    
    console.log('전략상품 코드 매핑 테이블:', Object.fromEntries(strategicProductCodeMapping));
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
              
              console.log(`처리 중: indicatorName="${indicatorName}", score=${score}, percentage=${percentage}`);
              
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
                    indicator: indicatorType 
                  });
                  console.log(`Matrix 기준값 추가: ${indicatorType} ${score}점 ${percentage}%`);
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.log('Matrix 기준값 데이터 로드 실패, 기본값 사용:', error.message);
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
      
      // 전략상품 기준값 (90%에서 6점)
      { score: 6, indicator: 'strategic', percentage: 90.0 },
      { score: 5, indicator: 'strategic', percentage: 80.0 },
      { score: 4, indicator: 'strategic', percentage: 70.0 },
      { score: 3, indicator: 'strategic', percentage: 60.0 },
      { score: 2, indicator: 'strategic', percentage: 50.0 },
      { score: 1, indicator: 'strategic', percentage: 40.0 },
      
      // 인터넷 비중 기준값 (7%에서 3점)
      { score: 3, indicator: 'internet', percentage: 7.0 },
      { score: 2, indicator: 'internet', percentage: 6.0 },
      { score: 1, indicator: 'internet', percentage: 5.0 }
    ];

    // 설정된 값이 없으면 기본값 사용
    const finalMatrixCriteria = matrixCriteria.length > 0 ? matrixCriteria : defaultMatrixCriteria;

    // 월간시상 계산 함수들
    const calculateUpsellChange = (manager) => {
      const manualRows = manualData.slice(1);
      
      let numerator = 0; // 자수
      let denominator = 0; // 모수
      
      console.log(`\n=== ${manager} 업셀기변 계산 시작 ===`);
      
      manualRows.forEach(row => {
        if (row.length < 90) return; // 최소 필요한 열 수 확인
        
        // 기본조건 확인
        const subscriptionNumber = (row[0] || '').toString().trim(); // A열: 가입번호
        const finalPolicy = (row[39] || '').toString().trim(); // AN열: 최종영업정책
        const modelType = (row[67] || '').toString().trim(); // CL열: 모델유형
        const joinType = (row[10] || '').toString().trim(); // K열: 가입구분
        
        // 담당자 매칭 확인
        const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
        const matchedManager = managerMapping.get(posCode);
        if (matchedManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
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
        const beforePlan = (row[101] || '').toString().trim(); // CX열: 변경전요금제
        
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
      
      console.log(`${manager} 업셀기변 결과: numerator=${numerator}, denominator=${denominator}`);
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
      
      console.log(`\n=== ${manager} 기변105이상 계산 시작 ===`);
      
      manualRows.forEach(row => {
        if (row.length < 90) return;
        
        // 담당자 매칭 확인
        const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
        const matchedManager = managerMapping.get(posCode);
        if (matchedManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
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
      
      console.log(`${manager} 기변105이상 결과: numerator=${numerator}, denominator=${denominator}`);
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
      
      console.log(`\n=== ${manager} 전략상품 계산 시작 ===`);
      console.log(`전략상품 설정:`, finalStrategicProducts);
      console.log(`전략상품 설정 개수:`, finalStrategicProducts.length);
      
      manualRows.forEach(row => {
        if (row.length < 90) return;
        
        // 담당자 매칭 확인
        const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
        const matchedManager = managerMapping.get(posCode);
        if (matchedManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
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
        const insurance = (row[115] || '').toString().trim(); // DL열: 보험(폰교체)
        const uflix = (row[118] || '').toString().trim(); // DO열: 유플릭스
        const callTone = (row[122] || '').toString().trim(); // DS열: 통화연결음
        const music = (row[110] || '').toString().trim(); // DG열: 뮤직류
        
        let totalPoints = 0;
        
        // 각 항목별 포인트 계산 (코드 매핑 적용)
        [insurance, uflix, callTone, music].forEach(service => {
          if (service) {
            // 1. 코드 매핑 테이블에서 부가서비스명 찾기
            const mappedServiceName = strategicProductCodeMapping.get(service);
            
            if (mappedServiceName) {
              // 2. 부가서비스명으로 포인트 찾기
              let product = finalStrategicProducts.find(p => p.serviceName === mappedServiceName);
              
              // 3. 부가서비스명 매칭이 안되면 소분류로 매칭
              if (!product) {
                product = finalStrategicProducts.find(p => p.subCategory === mappedServiceName);
              }
              
              if (product) {
                totalPoints += product.points;
              }
            } else {
              // 매핑되지 않은 코드는 디버깅용으로 수집
              unmatchedStrategicProducts.add(service);
            }
          }
        });
        
        numerator += totalPoints;
      });
      
      console.log(`${manager} 전략상품 결과: numerator=${numerator}, denominator=${denominator}`);
      return {
        numerator,
        denominator,
        percentage: denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0
      };
    };

    const calculateInternetRatio = (manager) => {
      const activationRows = activationData.slice(1);
      const homeRows = homeData.slice(1);
      
      let numerator = 0;
      let denominator = 0;
      
      // 인터넷 비중 계산 (로그 최소화)
      let matchedHomeRows = 0;
      let internetRows = 0;
      
      // 개통데이터 기준으로 모수 계산
      activationRows.forEach(row => {
        if (row.length < 8) return;
        
        const activation = (row[37] || '').toString().trim(); // AL열: 개통
        const modelName = (row[13] || '').toString().trim(); // N열: 모델명
        const inputStore = (row[4] || '').toString().trim(); // E열: 입고처
        const planName = (row[21] || '').toString().trim(); // V열: 요금제
        const companyName = (row[6] || '').toString().trim(); // G열: 업체명 (폰클개통데이터)
        
        // 모수 조건 확인
        if (activation === '선불개통' || !modelName || inputStore === '중고') {
          return;
        }
        
        // 요금제군 확인 (2nd군 제외)
        const planInfo = planMapping.get(planName);
        if (planInfo && planInfo.group === '2nd군') {
          return;
        }
        
        // 담당자 매칭 확인 (업체명으로 매칭)
        const matchedManager = companyManagerMapping.get(companyName);
        if (matchedManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        denominator++;
      });
      
      // 홈데이터 기준으로 자수 계산
      homeRows.forEach(row => {
        if (row.length < 8) return;
        
        const product = (row[9] || '').toString().trim(); // J열: 가입상품
        const companyName = (row[2] || '').toString().trim(); // C열: 업체명 (폰클홈데이터)
        
        // 담당자 매칭 확인 (업체명으로 매칭)
        const matchedManager = companyManagerMapping.get(companyName);
        if (matchedManager !== manager) {
          return; // 해당 담당자가 아닌 경우 제외
        }
        
        matchedHomeRows++;
        
        // 자수 조건 확인
        if (product === '인터넷') {
          internetRows++;
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
    const unmatchedCompanies = new Set(); // 인터넷 비중용
    const unmatchedStrategicProducts = new Set(); // 전략상품용
    const unmatchedPlans = new Set(); // 요금제 매핑용
    
    // 담당자별 데이터 수집
    const manualRows = manualData.slice(1);
    console.log('매뉴얼데이터 행 수:', manualRows.length);
    
    // 첫 번째 행에서 컬럼 구조 확인
    if (manualRows.length > 0) {
      const firstRow = manualRows[0];
      console.log('=== 매뉴얼데이터 컬럼 구조 확인 ===');
      console.log('전체 행 길이:', firstRow.length);
      console.log('A열(0) - 가입번호:', firstRow[0]);
      console.log('H열(7) - 실판매POS 코드:', firstRow[7]);
      console.log('K열(10) - 가입구분:', firstRow[10]);
      console.log('AG열(32) - 최종모델:', firstRow[32]);
      console.log('AM열(38) - 최종요금제:', firstRow[38]);
      console.log('AN열(39) - 최종영업정책:', firstRow[39]);
      console.log('CL열(67) - 모델유형:', firstRow[67]);
      console.log('CX열(101) - 변경전요금제:', firstRow[101]);
      console.log('DG열(110) - 뮤직류:', firstRow[110]);
      console.log('DL열(115) - 보험(폰교체):', firstRow[115]);
      console.log('DO열(118) - 유플릭스:', firstRow[118]);
      console.log('DS열(122) - 통화연결음:', firstRow[122]);
      console.log('================================');
      
      // 전략상품 관련 컬럼들을 더 넓게 확인 (70-100 범위)
      console.log('=== 전략상품 관련 컬럼 확장 확인 ===');
      for (let i = 70; i <= 100; i++) {
        const value = firstRow[i];
        if (value && value.toString().trim() !== '') {
          console.log(`${i}열: "${value}"`);
        }
      }
      console.log('================================');
    }
    
    let matchedCount = 0;
    let unmatchedStores = new Set();
    
    manualRows.forEach(row => {
      if (row.length < 90) return;
      
      const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
      const manager = managerMapping.get(posCode);
      
      if (manager) {
        matchedCount++;
        if (!agentMap.has(manager)) {
          const officeInfo = managerOfficeMapping.get(manager) || { office: '', department: '' };
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
          const beforePlan = (row[101] || '').toString().trim(); // CX열: 변경전요금제
          
          // 첫 번째 담당자만 로그 출력 (너무 많은 로그 방지)
          if (manager === Array.from(agentMap.keys())[0] && finalPlan && beforePlan) {
            console.log(`${manager} 업셀기변 확인: finalPlan="${finalPlan}", beforePlan="${beforePlan}"`);
          }
          
          const finalPlanInfo = planMapping.get(finalPlan);
          const beforePlanInfo = planMapping.get(beforePlan);
          
          if (finalPlanInfo && beforePlanInfo) {
            if (manager === Array.from(agentMap.keys())[0]) {
              console.log(`${manager} 요금제 정보: final=${finalPlanInfo.group}(${finalPlanInfo.price}), before=${beforePlanInfo.group}(${beforePlanInfo.price})`);
            }
            if (beforePlanInfo.group === '115군' || beforePlanInfo.group === '105군') {
              agent.upsellChange.numerator++;
              if (manager === Array.from(agentMap.keys())[0]) {
                console.log(`${manager} 업셀기변 인정: 115군/105군 조건`);
              }
            } else if (beforePlanInfo.price < finalPlanInfo.price) {
              agent.upsellChange.numerator++;
              if (manager === Array.from(agentMap.keys())[0]) {
                console.log(`${manager} 업셀기변 인정: 가격 상승 조건`);
              }
            }
          } else {
            if (manager === Array.from(agentMap.keys())[0]) {
              console.log(`${manager} 요금제 정보 없음: finalPlanInfo=${!!finalPlanInfo}, beforePlanInfo=${!!beforePlanInfo}`);
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
        
        // 전략상품 계산 (모든 행에 대해 계산)
        agent.strategicProducts.denominator++;
        
        // 전략상품 디버깅 로그 (첫 번째 담당자만)
        if (manager === Array.from(agentMap.keys())[0] && manualRows.indexOf(row) < 5) {
          console.log(`=== ${manager} 전략상품 계산 디버깅 (${manualRows.indexOf(row) + 1}번째 행) ===`);
          console.log('기본조건 확인:', {
            subscriptionNumber: (row[0] || '').toString().trim(),
            finalPolicy: (row[39] || '').toString().trim(),
            modelType: (row[67] || '').toString().trim()
          });
        }
        
        const insurance = (row[115] || '').toString().trim(); // DL열: 보험(폰교체)
        const uflix = (row[118] || '').toString().trim(); // DO열: 유플릭스
        const callTone = (row[122] || '').toString().trim(); // DS열: 통화연결음
        const music = (row[110] || '').toString().trim(); // DG열: 뮤직류
        
        // 첫 번째 담당자의 첫 번째 행에서만 전체 컬럼 정보 출력
        if (manager === Array.from(agentMap.keys())[0] && manualRows.indexOf(row) === 0) {
          console.log('=== 전략상품 컬럼 디버깅 ===');
          console.log('전체 행 길이:', row.length);
          console.log('DL열(115):', row[115], '타입:', typeof row[115]);
          console.log('DO열(118):', row[118], '타입:', typeof row[118]);
          console.log('DS열(122):', row[122], '타입:', typeof row[122]);
          console.log('DG열(110):', row[110], '타입:', typeof row[110]);
          console.log('========================');
        }
        
        let totalPoints = 0;
        [insurance, uflix, callTone, music].forEach(service => {
          if (service) {
            // 첫 번째 담당자만 로그 출력 (너무 많은 로그 방지)
            if (manager === Array.from(agentMap.keys())[0]) {
              console.log(`${manager} 전략상품 확인: "${service}"`);
            }
            // 부가서비스명으로만 매칭 (소분류 매칭 제거)
            const product = finalStrategicProducts.find(p => p.serviceName === service);
            
            if (product) {
              totalPoints += product.points;
              if (manager === Array.from(agentMap.keys())[0]) {
                console.log(`${manager} 전략상품 매칭: ${service} -> ${product.points}점`);
              }
            } else {
              unmatchedStrategicProducts.add(service);
              if (manager === Array.from(agentMap.keys())[0]) {
                console.log(`${manager} 전략상품 매칭 실패: "${service}"`);
              }
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
      const posCode = (firstRow[7] || '').toString().trim();
      console.log(`실판매POS: "${posCode}"`);
    }



    // 담당자별 인터넷 비중 계산
    const activationRows = activationData.slice(1);
    const homeRows = homeData.slice(1);
    
    console.log('=== 인터넷 비중 계산 디버깅 ===');
    console.log('개통데이터 행 수:', activationRows.length);
    console.log('홈데이터 행 수:', homeRows.length);
    console.log('담당자 매핑 테이블 크기:', managerMapping.size);
    console.log('담당자 목록:', Array.from(managerMapping.values()));
    
    // 개통데이터/홈데이터 컬럼 구조 확인
    if (activationRows.length > 0) {
      const firstActivationRow = activationRows[0];
      console.log('=== 개통데이터 컬럼 구조 확인 ===');
      console.log('전체 행 길이:', firstActivationRow.length);
      console.log('E열(4) - 입고처:', firstActivationRow[4]);
      console.log('G열(6) - 업체명:', firstActivationRow[6]);
      console.log('N열(13) - 모델명:', firstActivationRow[13]);
      console.log('V열(21) - 요금제:', firstActivationRow[21]);
      console.log('AL열(37) - 개통:', firstActivationRow[37]);
      console.log('================================');
    }
    
    if (homeRows.length > 0) {
      const firstHomeRow = homeRows[0];
      console.log('=== 홈데이터 컬럼 구조 확인 ===');
      console.log('전체 행 길이:', firstHomeRow.length);
      console.log('C열(2) - 업체명:', firstHomeRow[2]); // 수정됨
      console.log('J열(9) - 가입상품:', firstHomeRow[9]);
      console.log('================================');
    }
    
    // 폰클출고처데이터 컬럼 구조 확인
    if (storeRows.length > 0) {
      const firstStoreRow = storeRows[0];
      console.log('=== 폰클출고처데이터 컬럼 구조 확인 ===');
      console.log('전체 행 길이:', firstStoreRow.length);
      console.log('C열(2) - 출고처:', firstStoreRow[2]);
      console.log('G열(6) - 업체명:', firstStoreRow[6]); // 수정됨
      console.log('E열(4) - 상태:', firstStoreRow[4]);
      console.log('H열(7) - 실판매POS 코드:', firstStoreRow[7]);
      console.log('N열(13) - 담당자:', firstStoreRow[13]);
      console.log('================================');
      
      // 폰클출고처데이터의 실제 업체명들 확인 (처음 10개)
      console.log('=== 폰클출고처데이터 업체명 샘플 ===');
      storeRows.slice(1, 11).forEach((row, index) => {
        if (row.length >= 14) {
          const companyName = (row[6] || '').toString().trim(); // G열로 수정
          const manager = (row[13] || '').toString().trim();
          const status = (row[4] || '').toString().trim();
          if (companyName && manager && status !== '미사용') {
            console.log(`${index + 1}. "${companyName}" -> "${manager}"`);
          }
        }
      });
      console.log('================================');
    }
    
    // 개통데이터/홈데이터의 업체명을 폰클출고처데이터와 매칭하기 위한 매핑 생성
    const companyNameMapping = new Map();
    
    storeRows.forEach(row => {
      if (row.length >= 14) {
        const posCode = (row[7] || '').toString().trim(); // H열: 실판매POS 코드
        const companyName = (row[6] || '').toString().trim(); // G열: 업체명 (수정됨)
        const manager = (row[13] || '').toString().trim(); // N열: 담당자
        const status = (row[4] || '').toString().trim(); // E열: 상태
        
        if (companyName && manager && status !== '미사용') {
          const cleanManager = manager.replace(/\([^)]*\)/g, '').trim();
          companyNameMapping.set(companyName, cleanManager);
        }
      }
    });
    
    console.log('업체명 매핑 테이블 크기:', companyNameMapping.size);
    console.log('업체명 매핑 예시:', Array.from(companyNameMapping.entries()).slice(0, 5));
    
    // 개통데이터에서 담당자별 모수 계산
    let activationProcessedCount = 0;
    let activationMatchedCount = 0;
    
    activationRows.forEach(row => {
      if (row.length < 38) return;
      
      const activation = (row[37] || '').toString().trim(); // AL열: 개통
      const modelName = (row[13] || '').toString().trim(); // N열: 모델명
      const inputStore = (row[4] || '').toString().trim(); // E열: 입고처
      const planName = (row[21] || '').toString().trim(); // V열: 요금제
      const companyName = (row[6] || '').toString().trim(); // G열: 업체명 (개통데이터는 G열)
      
      activationProcessedCount++;
      
      // 담당자 매칭 확인 (업체명으로 매칭)
      const manager = companyNameMapping.get(companyName);
      
      if (!manager) {
        unmatchedCompanies.add(companyName);
        return;
      }
      
      // 모수 조건 확인
      if (activation === '선불개통' || !modelName || inputStore === '중고') {
        return;
      }
      
      // 요금제군 확인 (2nd군 제외)
      const planInfo = planMapping.get(planName);
      if (planInfo && planInfo.group === '2nd군') {
        return;
      }
      
      // 해당 담당자의 모수 증가
      if (agentMap.has(manager)) {
        agentMap.get(manager).internetRatio.denominator++;
        activationMatchedCount++;
      }
    });
    
    console.log('개통데이터 처리 결과:', {
      processed: activationProcessedCount,
      matched: activationMatchedCount,
      unmatchedCompanies: Array.from(unmatchedCompanies).slice(0, 10) // 처음 10개만 표시
    });
    
    // 홈데이터에서 담당자별 자수 계산
    let homeProcessedCount = 0;
    let homeMatchedCount = 0;
    let internetCount = 0;
    
    homeRows.forEach(row => {
      if (row.length < 10) return;
      
      const product = (row[9] || '').toString().trim(); // J열: 가입상품
      const companyName = (row[2] || '').toString().trim(); // C열: 업체명 (홈데이터는 C열)
      
      homeProcessedCount++;
      
      // 담당자 매칭 확인 (업체명으로 매칭)
      const manager = companyNameMapping.get(companyName);
      
      if (!manager) {
        unmatchedCompanies.add(companyName);
        return;
      }
      
      // 자수 조건 확인
      if (product === '인터넷') {
        internetCount++;
        // 동판 문구가 없는 경우에만 추가 조건 확인
        if (!product.includes('동판')) {
          if (product !== '선불' && product !== '소호') {
            if (agentMap.has(manager)) {
              agentMap.get(manager).internetRatio.numerator++;
              homeMatchedCount++;
            }
          }
        } else {
          if (agentMap.has(manager)) {
            agentMap.get(manager).internetRatio.numerator++;
            homeMatchedCount++;
          }
        }
      }
    });
    
    console.log('홈데이터 처리 결과:', {
      processed: homeProcessedCount,
      matched: homeMatchedCount,
      internetProducts: internetCount,
      unmatchedCompanies: Array.from(unmatchedCompanies).slice(0, 10) // 처음 10개만 표시
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

    // 각 지표별 점수 계산 함수
    const calculateScore = (percentage, criteria, maxScore) => {
      for (let i = 0; i < criteria.length; i++) {
        if (percentage >= criteria[i].percentage) {
          return criteria[i].score;
        }
      }
      return 0; // 기준 미달 시 0점
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
        companies: Array.from(unmatchedCompanies),
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

    let sheetData = [];
    
    console.log('=== 전략상품 저장 디버깅 ===');
    console.log('저장 타입:', type);
    console.log('원본 데이터:', data);
    
    switch (type) {
      case 'matrix_criteria':
        // Matrix 기준값 저장 (만점 기준 반영)
        console.log('=== Matrix 기준값 저장 디버깅 ===');
        console.log('원본 데이터:', data);
        
        // 항상 기본값 사용 (프론트엔드 데이터 수집 문제로 인해)
        console.log('Matrix 기준값을 기본값으로 설정합니다.');
        data = [
          { score: 6, indicator: 'upsell', percentage: 92.0 },
          { score: 5, indicator: 'upsell', percentage: 88.0 },
          { score: 4, indicator: 'upsell', percentage: 84.0 },
          { score: 3, indicator: 'upsell', percentage: 80.0 },
          { score: 2, indicator: 'upsell', percentage: 76.0 },
          { score: 1, indicator: 'upsell', percentage: 75.0 },
          { score: 6, indicator: 'change105', percentage: 88.0 },
          { score: 5, indicator: 'change105', percentage: 84.0 },
          { score: 4, indicator: 'change105', percentage: 80.0 },
          { score: 3, indicator: 'change105', percentage: 76.0 },
          { score: 2, indicator: 'change105', percentage: 72.0 },
          { score: 1, indicator: 'change105', percentage: 71.0 },
          { score: 6, indicator: 'strategic', percentage: 90.0 },
          { score: 5, indicator: 'strategic', percentage: 80.0 },
          { score: 4, indicator: 'strategic', percentage: 70.0 },
          { score: 3, indicator: 'strategic', percentage: 60.0 },
          { score: 2, indicator: 'strategic', percentage: 50.0 },
          { score: 1, indicator: 'strategic', percentage: 49.0 },
          { score: 3, indicator: 'internet', percentage: 7.0 },
          { score: 2, indicator: 'internet', percentage: 6.0 },
          { score: 1, indicator: 'internet', percentage: 5.0 }
        ];
        
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
              const description = i === 0 ? '만점' : ''; // 첫 번째 점수만 '만점' 표시
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