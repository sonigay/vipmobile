# Google Sheets 저장 구조 상세 설명

## 📊 저장되는 시트

### 1. 직영점모드: `직영점_판매일보` 시트

#### 시트 헤더 구조 (A~Z 컬럼)
```javascript
const DIRECT_SALES_HEADERS = [
  '번호',                    // A (0)
  'POS코드',                 // B (1)
  '업체명',                  // C (2)
  '매장ID',                  // D (3)
  '판매일시',                // E (4)
  '고객명',                  // F (5)
  'CTN',                     // G (6)
  '통신사',                  // H (7)
  '단말기모델명',            // I (8)
  '색상',                    // J (9)
  '단말일련번호',            // K (10)
  '유심모델명',              // L (11)
  '유심일련번호',            // M (12)
  '개통유형',                // N (13)
  '전통신사',                // O (14)
  '할부구분',                // P (15)
  '할부개월',                // Q (16)
  '약정',                    // R (17)
  '요금제',                  // S (18)
  '부가서비스',              // T (19)
  '출고가',                  // U (20)
  '이통사지원금',            // V (21)
  '대리점추가지원금(부가유치)',    // W (22) ⭐ 동적 계산값 저장
  '대리점추가지원금(부가미유치)',  // X (23) ⭐ 동적 계산값 저장
  '마진',                    // Y (24)
  '상태'                     // Z (25)
];
```

#### 저장되는 데이터 (수정 후)
```javascript
const row = [
  id,                                    // 번호
  data.posCode,                          // POS코드
  data.company,                          // 업체명
  data.storeId,                          // 매장ID
  data.soldAt,                           // 판매일시
  data.customerName,                     // 고객명
  data.customerContact,                  // CTN
  data.carrier,                          // 통신사
  data.model,                            // 단말기모델명
  data.color,                            // 색상
  data.deviceSerial,                     // 단말일련번호
  data.usimModel,                        // 유심모델명
  data.usimSerial,                       // 유심일련번호
  openingTypeKor,                        // 개통유형 (신규/번호이동/기기변경)
  data.prevCarrier,                      // 전통신사
  data.installmentType,                  // 할부구분
  data.installmentPeriod,                 // 할부개월
  contractTypeKor,                       // 약정
  data.plan,                             // 요금제
  addonsText,                            // 부가서비스 (선택된 상품명 목록)
  data.factoryPrice,                     // 출고가
  data.publicSupport,                    // 이통사지원금
  data.storeSupportWithAddon,            // 🔥 동적 계산된 대리점추가지원금(부가유치)
  data.storeSupportNoAddon,              // 🔥 동적 계산된 대리점추가지원금(부가미유치)
  data.margin,                           // 마진
  data.status                            // 상태
];
```

#### 동적 계산값 저장 위치
- **W열 (22번 인덱스)**: `대리점추가지원금(부가유치)`
  - 저장값: `calculateDynamicStoreSupport.withAddon`
  - 계산식: `기본 storeSupportWithAddon + 선택된 상품들의 incentive 합계 - 선택되지 않은 상품들의 deduction 합계`

- **X열 (23번 인덱스)**: `대리점추가지원금(부가미유치)`
  - 저장값: `calculateDynamicStoreSupport.withoutAddon`
  - 계산식: `기본 storeSupportWithoutAddon - 선택되지 않은 상품들의 deduction 합계`

### 2. 고객모드: `직영점_구매대기` 시트

#### 시트 헤더 구조 (A~AB 컬럼)
```javascript
const CUSTOMER_QUEUE_HEADERS = [
  '번호',                    // A (0)
  'CTN',                     // B (1)
  '고객명',                  // C (2)
  '통신사',                  // D (3)
  '단말기모델명',            // E (4)
  '색상',                    // F (5)
  '단말일련번호',            // G (6)
  '유심모델명',              // H (7)
  '유심일련번호',            // I (8)
  '개통유형',                // J (9)
  '전통신사',                // K (10)
  '할부구분',                // L (11)
  '할부개월',                // M (12)
  '약정',                    // N (13)
  '요금제',                  // O (14)
  '부가서비스',              // P (15)
  '출고가',                  // Q (16)
  '이통사지원금',            // R (17)
  '대리점지원금(부가유치)',   // S (18) ⭐ 동적 계산값 저장
  '대리점지원금(부가미유치)', // T (19) ⭐ 동적 계산값 저장
  '매장명',                  // U (20)
  '매장전화번호',            // V (21)
  '매장주소',                // W (22)
  '매장계좌정보',            // X (23)
  '등록일시',                // Y (24)
  '상태',                    // Z (25)
  '처리자',                  // AA (26)
  '처리일시'                 // AB (27)
];
```

#### 저장되는 데이터 (수정 후)
```javascript
const newRow = [
  id,                                    // 번호
  data.ctn,                              // CTN
  data.name,                             // 고객명
  data.carrier,                          // 통신사
  data.model,                            // 단말기모델명
  data.color,                            // 색상
  data.deviceSerial,                     // 단말일련번호
  data.usimModel,                        // 유심모델명
  data.usimSerial,                       // 유심일련번호
  data.activationType,                   // 개통유형
  data.oldCarrier,                       // 전통신사
  data.installmentType,                  // 할부구분
  data.installmentMonths,                // 할부개월
  data.contractType,                     // 약정
  data.plan,                             // 요금제
  data.additionalServices,               // 부가서비스 (선택된 상품명 목록)
  data.factoryPrice,                     // 출고가
  data.carrierSupport,                    // 이통사지원금
  data.dealerSupportWithAdd,              // 🔥 동적 계산된 대리점지원금(부가유치)
  data.dealerSupportWithoutAdd,           // 🔥 동적 계산된 대리점지원금(부가미유치)
  data.storeName,                        // 매장명
  data.storePhone,                       // 매장전화번호
  data.storeAddress,                     // 매장주소
  data.storeBankInfo,                    // 매장계좌정보
  new Date().toISOString(),              // 등록일시
  '구매대기',                            // 상태
  '',                                    // 처리자
  ''                                     // 처리일시
];
```

#### 동적 계산값 저장 위치
- **S열 (18번 인덱스)**: `대리점지원금(부가유치)`
  - 저장값: `calculateDynamicStoreSupport.withAddon`
  - 계산식: `기본 storeSupportWithAddon + 선택된 상품들의 incentive 합계 - 선택되지 않은 상품들의 deduction 합계`

- **T열 (19번 인덱스)**: `대리점지원금(부가미유치)`
  - 저장값: `calculateDynamicStoreSupport.withoutAddon`
  - 계산식: `기본 storeSupportWithoutAddon - 선택되지 않은 상품들의 deduction 합계`

## 🔄 저장 프로세스

### 1. 프론트엔드 (OpeningInfoPage.js)

#### 사용자 선택
```javascript
// 사용자가 부가서비스/보험상품 개별 선택
selectedAddons = Set(['우주패스', 'V컬러링'])
selectedInsurances = Set(['폰교체패스'])
```

#### 동적 계산
```javascript
// 선택된 상품들의 incentive 합계
selectedIncentive = 
  우주패스.incentive (10,000원) +
  V컬러링.incentive (5,000원) +
  폰교체패스.incentive (15,000원)
  = 30,000원

// 선택되지 않은 상품들의 deduction 합계
unselectedDeduction = 
  (선택되지 않은 상품들의 deduction 합계)
  = 0원 (모두 선택했으므로)

// 동적 대리점지원금 계산
calculateDynamicStoreSupport.withAddon = 
  100,000원 (기본값) + 30,000원 - 0원 = 130,000원
```

#### 저장 데이터 구성
```javascript
const saveData = {
  // ... 기타 필드
  storeSupportWithAddon: 130,000,  // 동적 계산값
  storeSupportNoAddon: 100,000,    // 동적 계산값
  // ...
};
```

### 2. API 호출

#### 직영점모드
```javascript
// POST /api/direct/sales
await directStoreApiClient.createSalesReport(saveData);
```

#### 고객모드
```javascript
// POST /api/member/queue
await customerAPI.addToPurchaseQueue(purchaseQueueData);
```

### 3. 서버 (server/index.js)

#### 판매일보 저장
```javascript
// 직영점_판매일보 시트에 행 추가
const row = [
  // ... 기타 데이터
  data.storeSupportWithAddon || 0,  // W열: 동적 계산값
  data.storeSupportNoAddon || 0,    // X열: 동적 계산값
  // ...
];

await sheets.spreadsheets.values.append({
  range: '직영점_판매일보!A2',
  resource: { values: [row] }
});
```

#### 구매대기 저장
```javascript
// 직영점_구매대기 시트에 행 추가
const newRow = [
  // ... 기타 데이터
  data.dealerSupportWithAdd || 0,      // S열: 동적 계산값
  data.dealerSupportWithoutAdd || 0,   // T열: 동적 계산값
  // ...
];

await sheets.spreadsheets.values.append({
  range: '직영점_구매대기!A2',
  resource: { values: [newRow] }
});
```

## 📋 실제 저장 예시

### 시나리오: 우주패스와 V컬러링 선택

#### 프론트엔드 계산
```
기본 대리점지원금: 100,000원
선택된 상품:
  - 우주패스 (incentive: 10,000원)
  - V컬러링 (incentive: 5,000원)
선택되지 않은 상품: 없음

동적 계산:
  withAddon = 100,000 + 10,000 + 5,000 = 115,000원
  withoutAddon = 100,000원 (변화 없음)
```

#### Google Sheets 저장
```
직영점_판매일보 시트:
  W열 (대리점추가지원금(부가유치)): 115,000
  X열 (대리점추가지원금(부가미유치)): 100,000

직영점_구매대기 시트:
  S열 (대리점지원금(부가유치)): 115,000
  T열 (대리점지원금(부가미유치)): 100,000
```

## ⚠️ 중요 사항

1. **최종 계산값만 저장**: Google Sheets에는 동적으로 계산된 최종 금액만 저장됩니다.
   - 선택된 상품 목록은 저장되지 않습니다 (부가서비스 컬럼에는 상품명만 저장)
   - incentive/deduction 정보는 저장되지 않습니다

2. **재계산 불가**: 저장된 값은 고정값이므로, 나중에 정책이 변경되어도 재계산되지 않습니다.
   - 저장 시점의 계산값이 그대로 유지됩니다

3. **데이터 일관성**: 
   - 동일한 선택 조합이면 항상 동일한 금액이 계산됩니다
   - 정책설정의 incentive/deduction 값이 변경되면 새로 저장되는 데이터에만 반영됩니다

4. **마진 계산**: 마진은 동적 대리점지원금을 사용하여 계산됩니다
   ```javascript
   purchasePrice = factoryPrice - publicSupport - dynamicStoreSupport
   margin = purchasePrice >= 0 ? baseMargin : Math.abs(purchasePrice)
   ```

## 🎯 핵심 정리

1. **프론트엔드**: 사용자 선택 → 동적 계산 → API 호출
2. **서버**: API 데이터 → Google Sheets 행 구성 → 시트에 저장
3. **Google Sheets**: 최종 계산된 금액만 저장 (계산 과정은 저장 안 됨)
4. **결과**: 선택된 상품에 따라 다른 대리점지원금이 저장되어 정확한 데이터 관리 가능

