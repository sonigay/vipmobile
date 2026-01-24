/**
 * 재고 데이터 필터링 및 정규화 유틸리티
 * 
 * 목적:
 * - 폰클재고데이터의 구분(F열) 필드에서 #N/A 에러 처리
 * - 종류(E열) 필드를 사용하여 휴대폰만 필터링
 * 
 * 작성일: 2026-01-24
 */

/**
 * 구분 값을 정규화합니다.
 * #N/A 에러나 기타 에러 값을 "기타"로 변환합니다.
 * 
 * @param {string} category - 원본 구분 값 (F열)
 * @param {string} modelName - 모델명 (로깅용)
 * @returns {string} 정규화된 구분 값
 */
function normalizeCategory(category, modelName = '') {
  if (!category) {
    return '기타';
  }

  const categoryStr = category.toString().trim();
  
  // #N/A 에러나 ERROR 문자열이 포함된 경우
  if (categoryStr.includes('#N/A') || 
      categoryStr.includes('ERROR') || 
      categoryStr.includes('#REF') ||
      categoryStr.includes('#VALUE')) {
    
    if (modelName) {
      console.warn(`⚠️ [재고필터] VLOOKUP 에러 발견: 모델=${modelName}, 원본값=${categoryStr} → "기타"로 변환`);
    }
    
    return '기타';
  }

  return categoryStr;
}

/**
 * 재고 행이 휴대폰인지 확인합니다.
 * 
 * @param {string} modelType - 종류 값 (E열)
 * @returns {boolean} 휴대폰이면 true
 */
function isPhoneType(modelType) {
  if (!modelType) {
    return false;
  }

  const typeStr = modelType.toString().trim();
  
  // 휴대폰만 허용
  return typeStr === '휴대폰';
}

/**
 * 재고 행이 유효한지 검증합니다.
 * 
 * @param {Object} options - 검증 옵션
 * @param {string} options.modelName - 모델명 (N열)
 * @param {string} options.category - 구분 (F열)
 * @param {string} options.modelType - 종류 (E열)
 * @param {boolean} options.phoneOnly - 휴대폰만 필터링할지 여부 (기본: true)
 * @returns {boolean} 유효한 행이면 true
 */
function isValidInventoryRow(options) {
  const {
    modelName,
    category,
    modelType,
    phoneOnly = true
  } = options;

  // 모델명이 없으면 무효
  if (!modelName || !modelName.toString().trim()) {
    return false;
  }

  // 구분이 #N/A이면 무효 (정규화 전 체크)
  const categoryStr = (category || '').toString().trim();
  if (categoryStr.includes('#N/A') || 
      categoryStr.includes('ERROR') || 
      categoryStr.includes('#REF') ||
      categoryStr.includes('#VALUE')) {
    // #N/A는 로그만 남기고 무효 처리 (또는 "기타"로 변환하여 유효 처리 가능)
    // 현재는 무효 처리하여 목록에서 제외
    return false;
  }

  // 휴대폰만 필터링하는 경우
  if (phoneOnly) {
    if (!isPhoneType(modelType)) {
      return false;
    }
  }

  return true;
}

/**
 * 재고 데이터 행을 처리합니다.
 * 
 * @param {Array} row - 재고 데이터 행
 * @param {Object} options - 처리 옵션
 * @param {boolean} options.phoneOnly - 휴대폰만 필터링할지 여부 (기본: true)
 * @returns {Object|null} 처리된 데이터 또는 null (무효한 경우)
 */
function processInventoryRow(row, options = {}) {
  const { phoneOnly = true } = options;

  if (!row || row.length < 23) {
    return null;
  }

  // 원본 데이터 추출
  const modelType = (row[4] || '').toString().trim();  // E열: 종류
  const category = (row[5] || '').toString().trim();   // F열: 구분
  const office = (row[6] || '').toString().trim();     // G열: 사무실
  const department = (row[7] || '').toString().trim(); // H열: 소속
  const agent = (row[8] || '').toString().trim();      // I열: 담당자
  const modelName = (row[13] || '').toString().trim(); // N열: 모델명
  const color = (row[14] || '').toString().trim();     // O열: 색상
  const store = (row[21] || '').toString().trim();     // V열: 출고처

  // 유효성 검증
  if (!isValidInventoryRow({ modelName, category, modelType, phoneOnly })) {
    return null;
  }

  // 구분 정규화
  const normalizedCategory = normalizeCategory(category, modelName);

  return {
    modelType,
    category: normalizedCategory,
    office,
    department,
    agent,
    modelName,
    color,
    store,
    // 원본 값도 포함 (디버깅용)
    _original: {
      category,
      modelType
    }
  };
}

/**
 * 재고 데이터 배열을 필터링하고 처리합니다.
 * 
 * @param {Array} inventoryValues - 전체 재고 데이터 (헤더 포함)
 * @param {Object} options - 처리 옵션
 * @param {boolean} options.phoneOnly - 휴대폰만 필터링할지 여부 (기본: true)
 * @param {number} options.skipRows - 건너뛸 행 수 (기본: 3)
 * @returns {Array} 처리된 재고 데이터 배열
 */
function filterAndProcessInventory(inventoryValues, options = {}) {
  const { phoneOnly = true, skipRows = 3 } = options;

  if (!inventoryValues || inventoryValues.length <= skipRows) {
    return [];
  }

  const processedData = [];
  let totalRows = 0;
  let validRows = 0;
  let filteredByType = 0;
  let filteredByError = 0;

  inventoryValues.slice(skipRows).forEach((row, index) => {
    totalRows++;

    const processed = processInventoryRow(row, { phoneOnly });
    
    if (processed) {
      processedData.push(processed);
      validRows++;
    } else {
      // 필터링 이유 분석 (디버깅용)
      if (row.length >= 23) {
        const modelType = (row[4] || '').toString().trim();
        const category = (row[5] || '').toString().trim();
        
        if (phoneOnly && modelType !== '휴대폰') {
          filteredByType++;
        }
        
        if (category.includes('#N/A') || category.includes('ERROR')) {
          filteredByError++;
        }
      }
    }
  });

  console.log(`📊 [재고필터] 처리 완료: 전체=${totalRows}, 유효=${validRows}, 종류필터=${filteredByType}, 에러필터=${filteredByError}`);

  return processedData;
}

module.exports = {
  normalizeCategory,
  isPhoneType,
  isValidInventoryRow,
  processInventoryRow,
  filterAndProcessInventory
};
