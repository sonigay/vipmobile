# 부가서비스/보험상품 개별 선택 기능 - Google Sheets 반영 내용

## 📊 수정 전후 비교

### 수정 전
- **부가서비스 유치 여부**: 라디오 버튼으로 전체 선택 (부가유치/부가미유치)
- **대리점지원금**: 정책설정에서 가져온 고정값 사용
  - `storeSupportWithAddon`: 부가유치 시 고정 대리점지원금
  - `storeSupportWithoutAddon`: 부가미유치 시 고정 대리점지원금

### 수정 후
- **부가서비스/보험상품**: 개별 체크박스로 선택 가능
- **대리점지원금**: 선택된 상품에 따라 동적으로 계산
  - 선택된 상품의 `incentive` 합계 추가
  - 선택되지 않은 상품의 `deduction` 합계 차감
  - 계산식: `동적 대리점지원금 = 기본 대리점지원금 + 선택된 상품들의 incentive 합계 - 선택되지 않은 상품들의 deduction 합계`

## 📝 Google Sheets 저장 필드

### 1. 직영점모드 (판매일보 시트 - `salesReport`)

#### 저장되는 필드
```javascript
{
  storeSupportWithAddon: calculateDynamicStoreSupport.withAddon,  // 동적 계산값
  storeSupportNoAddon: calculateDynamicStoreSupport.withoutAddon, // 동적 계산값
  storeSupportWithoutAddon: calculateDynamicStoreSupport.withoutAddon, // 하위 호환
  // ... 기타 필드
}
```

#### 시트 컬럼
- **대리점추가지원금(부가유치)**: `storeSupportWithAddon` → 동적 계산값 저장
- **대리점추가지원금(부가미유치)**: `storeSupportNoAddon` → 동적 계산값 저장

#### 변경 사항
- ✅ **이전**: 정책설정에서 가져온 고정값 저장
- ✅ **현재**: 사용자가 선택한 부가서비스/보험상품에 따라 동적으로 계산된 값 저장

### 2. 고객모드 (구매대기 시트 - `purchaseQueue`)

#### 저장되는 필드
```javascript
{
  dealerSupportWithAdd: calculateDynamicStoreSupport.withAddon,      // 동적 계산값
  dealerSupportWithoutAdd: calculateDynamicStoreSupport.withoutAddon, // 동적 계산값
  // ... 기타 필드
}
```

#### 시트 컬럼
- **대리점지원금(부가유치)**: `dealerSupportWithAdd` → 동적 계산값 저장
- **대리점지원금(부가미유치)**: `dealerSupportWithoutAdd` → 동적 계산값 저장

#### 변경 사항
- ✅ **이전**: 정책설정에서 가져온 고정값 저장
- ✅ **현재**: 사용자가 선택한 부가서비스/보험상품에 따라 동적으로 계산된 값 저장

## 🔄 동적 계산 로직

### 계산 과정

1. **선택된 상품의 incentive 합계 계산**
   ```javascript
   selectedIncentive = 
     선택된 부가서비스들의 incentive 합계 +
     선택된 보험상품들의 incentive 합계
   ```

2. **선택되지 않은 상품의 deduction 합계 계산**
   ```javascript
   unselectedDeduction = 
     선택되지 않은 부가서비스들의 deduction 합계 +
     선택되지 않은 보험상품들의 deduction 합계
   ```

3. **동적 대리점지원금 계산**
   ```javascript
   dynamicStoreSupportWithAddon = 
     기본 storeSupportWithAddon + selectedIncentive - unselectedDeduction
   
   dynamicStoreSupportWithoutAddon = 
     기본 storeSupportWithoutAddon - unselectedDeduction
   ```

4. **할부원금 및 최종 구매가 계산**
   ```javascript
   할부원금 = 출고가 - 이통사지원금 - 동적 대리점지원금
   ```

## 📋 저장 예시

### 시나리오 1: 모든 부가서비스 선택
- **선택된 상품**: 우주패스 (incentive: 10,000원), V컬러링 (incentive: 5,000원)
- **기본 대리점지원금**: 100,000원
- **계산된 대리점지원금**: 100,000 + 10,000 + 5,000 = **115,000원**

### 시나리오 2: 일부 부가서비스만 선택
- **선택된 상품**: 우주패스 (incentive: 10,000원)
- **선택되지 않은 상품**: V컬러링 (deduction: 3,000원)
- **기본 대리점지원금**: 100,000원
- **계산된 대리점지원금**: 100,000 + 10,000 - 3,000 = **107,000원**

### 시나리오 3: 부가서비스 미선택
- **선택된 상품**: 없음
- **선택되지 않은 상품**: 우주패스 (deduction: 5,000원), V컬러링 (deduction: 3,000원)
- **기본 대리점지원금**: 100,000원
- **계산된 대리점지원금**: 100,000 - 5,000 - 3,000 = **92,000원**

## ⚠️ 주의사항

1. **음수 방지**: 계산된 대리점지원금이 음수가 되지 않도록 `Math.max(0, ...)` 처리
2. **기본값 유지**: 정책설정에서 가져온 기본 대리점지원금은 유지하고, 선택된 상품에 따라 증감
3. **실시간 업데이트**: 상품 선택 시 즉시 대리점지원금과 할부원금이 자동 업데이트

## 🎯 핵심 개선 사항

1. **개별 선택 가능**: 부가서비스/보험상품을 개별적으로 선택/해제 가능
2. **동적 계산**: 선택된 상품에 따라 대리점지원금이 실시간으로 계산
3. **자동 반영**: 계산된 값이 할부원금, 최종 구매가에 자동 반영
4. **Google Sheets 저장**: 동적 계산된 값이 Google Sheets에 저장되어 정확한 데이터 관리

