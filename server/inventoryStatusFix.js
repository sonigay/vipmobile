/**
 * 재고장표 API 수정 패치
 * 
 * 문제:
 * 1. M열(row[12])에서 유심 필터링이 없음
 * 2. 운영모델 순서대로 정렬이 없음
 * 
 * 해결:
 * 1. row[12]가 "유심"이 아닌 경우만 처리
 * 2. 운영모델 시트 순서대로 정렬
 */

// 이 코드를 server/index.js의 30150라인 근처에 적용해야 합니다.

// ===== 수정 전 코드 (30150-30170 라인 근처) =====
/*
inventoryValues.slice(3).forEach((row, index) => {
  if (row.length >= 23) {
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const color = (row[14] || '').toString().trim(); // O열: 색상
    const category = (row[5] || '').toString().trim(); // F열: 구분
    const office = (row[6] || '').toString().trim(); // G열: 사무실
    const department = (row[7] || '').toString().trim(); // H열: 소속
    const agent = (row[8] || '').toString().trim(); // I열: 담당자
    const store = (row[21] || '').toString().trim(); // V열: 출고처

    if (modelName && category !== '#N/A') {
      validModels++;
      // ... 나머지 로직
    }
  }
});
*/

// ===== 수정 후 코드 =====
/*
inventoryValues.slice(3).forEach((row, index) => {
  if (row.length >= 23) {
    const modelType = (row[12] || '').toString().trim(); // M열: 휴대폰/유심/웨어러블/태블릿 ⭐ 추가
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const color = (row[14] || '').toString().trim(); // O열: 색상
    const category = (row[5] || '').toString().trim(); // F열: 구분
    const office = (row[6] || '').toString().trim(); // G열: 사무실
    const department = (row[7] || '').toString().trim(); // H열: 소속
    const agent = (row[8] || '').toString().trim(); // I열: 담당자
    const store = (row[21] || '').toString().trim(); // V열: 출고처

    // ⭐ 수정: 유심 제외 + #N/A 제외
    if (modelName && category !== '#N/A' && modelType !== '유심') {
      validModels++;
      // ... 나머지 로직
    }
  }
});
*/

// ===== 정렬 로직 추가 (30240-30260 라인 근처) =====
// 결과 데이터 구성 부분에 운영모델 순서 정렬 추가

/*
// 기존 코드:
const result = {
  success: true,
  data: Array.from(inventoryMap.values()).map(item => ({
    ...item,
    dailyActivation: item.dailyActivation.map((count, index) => ({
      day: String(index + 1).padStart(2, '0'),
      count
    }))
  }))
};
*/

// ===== 수정 후 코드 =====
/*
// ⭐ 운영모델 순서 가져오기
const operationModelValues = await getSheetValues('운영모델');
const modelOrder = {};
operationModelValues.slice(3).forEach((row, index) => {
  if (row.length >= 3) {
    const modelName = (row[2] || '').toString().trim(); // C열: 모델명
    if (modelName && modelName !== '모델명') {
      modelOrder[modelName] = index;
    }
  }
});

// ⭐ 운영모델 순서대로 정렬
const sortedData = Array.from(inventoryMap.values())
  .map(item => ({
    ...item,
    dailyActivation: item.dailyActivation.map((count, index) => ({
      day: String(index + 1).padStart(2, '0'),
      count
    }))
  }))
  .sort((a, b) => {
    const aOrder = modelOrder[a.modelName] !== undefined ? modelOrder[a.modelName] : 999999;
    const bOrder = modelOrder[b.modelName] !== undefined ? modelOrder[b.modelName] : 999999;
    return aOrder - bOrder;
  });

const result = {
  success: true,
  data: sortedData
};
*/

module.exports = {
  // 이 파일은 참고용입니다. 실제 적용은 sed 명령어로 수행합니다.
};
