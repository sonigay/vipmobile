# 재고 필터링 유틸리티 통합 가이드

## 개요

이 문서는 `inventoryFilterUtils.js` 모듈을 `server/index.js`의 재고장표 API에 통합하는 방법을 설명합니다.

## 문제 상황

1. **#N/A 에러 표시**: 폰클재고데이터 F열의 VLOOKUP 실패로 `#N/A (Did not find value 'C4920' in VLOOKUP evaluation.)` 에러가 표시됨
2. **유심 필터링 누락**: 휴대폰만 표시되어야 하는데 유심, 워치 등도 함께 표시됨

## 해결 방안

### 1. 유틸리티 모듈 사용

`inventoryFilterUtils.js` 모듈은 다음 기능을 제공합니다:

- `normalizeCategory()`: #N/A 에러를 "기타"로 변환
- `isPhoneType()`: 휴대폰 여부 확인
- `isValidInventoryRow()`: 재고 행 유효성 검증
- `processInventoryRow()`: 재고 행 처리 및 정규화
- `filterAndProcessInventory()`: 전체 재고 데이터 필터링 및 처리

### 2. 통합 방법

#### 2.1. 모듈 임포트

`server/index.js` 상단에 다음 코드를 추가합니다:

```javascript
// 재고 필터링 유틸리티
const {
  normalizeCategory,
  isPhoneType,
  isValidInventoryRow,
  processInventoryRow,
  filterAndProcessInventory
} = require('./inventoryFilterUtils');
```

#### 2.2. 재고장표 API 수정 (방법 1: 간단한 수정)

**위치**: `server/index.js` 라인 30116 - `/api/inventory/status` 엔드포인트

**기존 코드** (라인 30151-30170):
```javascript
inventoryValues.slice(3).forEach((row, index) => {
  if (row.length >= 23) {
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const color = (row[14] || '').toString().trim(); // O열: 색상
    const category = (row[5] || '').toString().trim(); // F열: 구분
    const office = (row[6] || '').toString().trim(); // G열: 사무실
    const department = (row[7] || '').toString().trim(); // H열: 소속
    const agent = (row[8] || '').toString().trim(); // I열: 담당자
    const store = (row[21] || '').toString().trim(); // V열: 출고처

    // ... 필터링 로직 ...

    if (modelName && category !== '#N/A') {
      validModels++;
      // ... 나머지 로직 ...
    }
  }
});
```

**수정된 코드**:
```javascript
inventoryValues.slice(3).forEach((row, index) => {
  if (row.length >= 23) {
    const modelType = (row[4] || '').toString().trim();  // E열: 종류 ⭐ 추가
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const color = (row[14] || '').toString().trim(); // O열: 색상
    const category = (row[5] || '').toString().trim(); // F열: 구분
    const office = (row[6] || '').toString().trim(); // G열: 사무실
    const department = (row[7] || '').toString().trim(); // H열: 소속
    const agent = (row[8] || '').toString().trim(); // I열: 담당자
    const store = (row[21] || '').toString().trim(); // V열: 출고처

    // ... 필터링 로직 ...

    // ⭐ 수정: 유효성 검증 강화
    if (isValidInventoryRow({ modelName, category, modelType, phoneOnly: true })) {
      validModels++;
      
      // ⭐ 수정: 구분 정규화
      const normalizedCategory = normalizeCategory(category, modelName);
      
      // ... 나머지 로직에서 category 대신 normalizedCategory 사용 ...
    }
  }
});
```

#### 2.3. 재고장표 API 수정 (방법 2: 전체 리팩토링)

**더 깔끔한 방법**으로 전체 처리 로직을 유틸리티로 대체:

```javascript
// 기존 forEach 루프 전체를 다음으로 대체
const processedInventory = filterAndProcessInventory(inventoryValues, {
  phoneOnly: true,
  skipRows: 3
});

let validModels = 0;
const modelStats = new Map();

processedInventory.forEach(item => {
  validModels++;
  
  // 필터링 적용
  if (req.query.agent && req.query.agent !== item.agent) return;
  if (req.query.office && req.query.office !== item.office) return;
  if (req.query.department && req.query.department !== item.department) return;

  // 모델별 통계 집계
  const key = item.modelName;
  if (!modelStats.has(key)) {
    modelStats.set(key, {
      modelName: item.modelName,
      category: item.category,  // 이미 정규화된 값
      totalCount: 0,
      assignedCount: 0,
      unassignedCount: 0,
      offices: new Set(),
      departments: new Set(),
      agents: new Set()
    });
  }

  const stats = modelStats.get(key);
  stats.totalCount++;
  
  if (item.store) {
    stats.assignedCount++;
  } else {
    stats.unassignedCount++;
  }
  
  if (item.office) stats.offices.add(item.office);
  if (item.department) stats.departments.add(item.department);
  if (item.agent) stats.agents.add(item.agent);
});
```

### 3. 색상별 재고 현황 API 수정

**위치**: `server/index.js` 라인 30373 - `/api/inventory/status-by-color` 엔드포인트

**기존 코드** (라인 30406-30420):
```javascript
inventoryValues.slice(3).forEach(row => {
  if (row.length >= 23) {
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const color = (row[14] || '').toString().trim(); // O열: 색상
    const category = (row[5] || '').toString().trim(); // F열: 구분
    // ...

    if (modelName && color && category !== '#N/A') {
      // ...
    }
  }
});
```

**수정된 코드**:
```javascript
inventoryValues.slice(3).forEach(row => {
  if (row.length >= 23) {
    const modelType = (row[4] || '').toString().trim();  // E열: 종류 ⭐ 추가
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const color = (row[14] || '').toString().trim(); // O열: 색상
    const category = (row[5] || '').toString().trim(); // F열: 구분
    // ...

    // ⭐ 수정: 유효성 검증 강화
    if (modelName && color && isValidInventoryRow({ modelName, category, modelType, phoneOnly: true })) {
      const normalizedCategory = normalizeCategory(category, modelName);
      // ... 나머지 로직에서 normalizedCategory 사용 ...
    }
  }
});
```

### 4. 담당자 목록 API 수정

**위치**: `server/index.js` 라인 30275 - `/api/inventory/agents` 엔드포인트

**기존 코드** (라인 30297-30310):
```javascript
inventoryValues.slice(3).forEach(row => {
  if (row.length >= 23) {
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const category = (row[5] || '').toString().trim(); // F열: 구분
    // ...

    if (modelName && category !== '#N/A' && agent) {
      // ...
    }
  }
});
```

**수정된 코드**:
```javascript
inventoryValues.slice(3).forEach(row => {
  if (row.length >= 23) {
    const modelType = (row[4] || '').toString().trim();  // E열: 종류 ⭐ 추가
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const category = (row[5] || '').toString().trim(); // F열: 구분
    // ...

    // ⭐ 수정: 유효성 검증 강화
    if (agent && isValidInventoryRow({ modelName, category, modelType, phoneOnly: true })) {
      // ...
    }
  }
});
```

## 통합 체크리스트

### 필수 수정 사항

- [ ] `server/index.js` 상단에 `inventoryFilterUtils` 모듈 임포트
- [ ] `/api/inventory/status` 엔드포인트 수정 (라인 30116)
  - [ ] E열(종류) 추출 추가
  - [ ] `isValidInventoryRow()` 사용
  - [ ] `normalizeCategory()` 사용
- [ ] `/api/inventory/status-by-color` 엔드포인트 수정 (라인 30373)
  - [ ] E열(종류) 추출 추가
  - [ ] `isValidInventoryRow()` 사용
  - [ ] `normalizeCategory()` 사용
- [ ] `/api/inventory/agents` 엔드포인트 수정 (라인 30275)
  - [ ] E열(종류) 추출 추가
  - [ ] `isValidInventoryRow()` 사용

### 선택 사항

- [ ] 전체 리팩토링: `filterAndProcessInventory()` 사용
- [ ] 로깅 강화: 필터링 통계 출력
- [ ] 에러 처리 개선: #N/A 에러 발생 시 알림

## 테스트 방법

### 1. 로컬 테스트

```bash
cd server
npm start
```

### 2. API 테스트

```bash
# 재고 상태 조회
curl http://localhost:4000/api/inventory/status

# 응답 확인 사항:
# - category 필드에 #N/A 값이 없어야 함
# - 유심, 워치가 포함되지 않아야 함
# - 휴대폰만 표시되어야 함
```

### 3. 프론트엔드 테스트

1. 장표모드 > 재고장표 접속
2. 구분 컬럼 확인
   - 삼성, 애플, 기타, 2ND만 표시
   - #N/A 에러 없음
3. 모델 목록 확인
   - 휴대폰만 표시
   - 유심 미표시

### 4. 로그 확인

서버 콘솔에서 다음 로그 확인:

```
⚠️ [재고필터] VLOOKUP 에러 발견: 모델=C4920, 원본값=#N/A (Did not find value 'C4920' in VLOOKUP evaluation.) → "기타"로 변환
📊 [재고필터] 처리 완료: 전체=1234, 유효=1100, 종류필터=120, 에러필터=14
```

## 롤백 방법

문제가 발생하면 다음과 같이 롤백할 수 있습니다:

1. `server/index.js`에서 수정한 부분을 원래대로 되돌림
2. `server/inventoryFilterUtils.js` 파일 삭제 (선택)
3. 서버 재시작

## 추가 개선 사항

### 1. Google Sheets 수정

**폰클재고데이터 시트 F열 수식**을 다음과 같이 수정하면 백엔드 수정 없이도 #N/A 에러를 방지할 수 있습니다:

```excel
=IFERROR(VLOOKUP(N2, 운영모델!$C:$D, 2, FALSE), "기타")
```

### 2. 운영모델 시트 업데이트

누락된 모델을 운영모델 시트에 추가하여 VLOOKUP 실패를 방지합니다.

### 3. 프론트엔드 개선

`src/components/screens/InventoryStatusScreen.js`에서도 구분 값 정규화를 추가할 수 있습니다:

```javascript
// 구분 값 정규화 함수
const normalizeCategory = (cat) => {
  if (!cat || cat.includes('#N/A') || cat.includes('ERROR')) {
    return '기타';
  }
  return cat;
};

// 정렬 로직에서 사용
const categoryOrder = { '삼성': 1, '애플': 2, '기타': 3, '2ND': 4 };
const aOrder = categoryOrder[normalizeCategory(a.category)] || 5;
const bOrder = categoryOrder[normalizeCategory(b.category)] || 5;
```

## 참고 자료

- 진단서: `docs/재고장표-구분필드-문제-진단서.md`
- 유틸리티 모듈: `server/inventoryFilterUtils.js`
- 백엔드 API: `server/index.js` (라인 30116-30450)
- 프론트엔드: `src/components/screens/InventoryStatusScreen.js`

---

**작성일**: 2026-01-24  
**작성자**: Kiro AI  
**문서 버전**: 1.0
