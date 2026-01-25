# 시트 이름 수정 완료 보고

## 문제 상황

배포 후 여러 API에서 "Unable to parse range" 오류 발생:
- `Unable to parse range: 당월개통실적!A:Z`
- `Unable to parse range: 전월개통실적!A:Z`
- `Unable to parse range: 매장목록!A:Z`
- `Unable to parse range: 마커색상설정!A:Z`

## 원인 분석

리팩토링 과정에서 시트 이름을 원본 파일에서 확인하지 않고 임의로 작성함:
- ❌ `당월개통실적` → ✅ `폰클개통데이터`
- ❌ `전월개통실적` → ✅ `폰클개통데이터(전월)`
- ❌ `매장목록` / `매장정보` → ✅ `폰클출고처데이터`
- ❌ `마커색상설정` → ✅ `관리자모드_마커색상설정`

## 수정 내용

### 1. 원본 파일에서 시트 이름 확인

`server/index.js.backup.original` 905-921줄에서 정확한 시트 이름 확인:

```javascript
const INVENTORY_SHEET_NAME = '폰클재고데이터';
const STORE_SHEET_NAME = '폰클출고처데이터';
const PLAN_SHEET_NAME = '무선요금제군';
const AGENT_SHEET_NAME = '대리점아이디관리';
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';
const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터(전월)';
const UPDATE_SHEET_NAME = '어플업데이트';
const MARKER_COLOR_SETTINGS_SHEET_NAME = '관리자모드_마커색상설정';
```

### 2. 수정된 파일 목록

#### `server/routes/policyRoutes.js`
```javascript
// 수정 전
const STORE_SHEET_NAME = '매장정보';

// 수정 후
const STORE_SHEET_NAME = '폰클출고처데이터';
```

#### `server/routes/activationRoutes.js`
```javascript
// 수정 전
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '당월개통실적';
const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '전월개통실적';

// 수정 후
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';
const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터(전월)';
```

#### `server/routes/miscRoutes.js`
```javascript
// 수정 전
const values = await getSheetValues('매장목록');
const values = await getSheetValues('마커색상설정');

// 수정 후
const values = await getSheetValues('폰클출고처데이터');
const values = await getSheetValues('관리자모드_마커색상설정');
```

## 배포 정보

- **커밋 해시**: 8ac5f5e0
- **커밋 메시지**: "fix: 시트 이름 원본 확인 및 수정 - 정책/개통/매장/마커색상 시트"
- **배포 시간**: 2026-01-25 11:20 (KST)
- **수정된 파일**: 3개
  - `server/routes/policyRoutes.js`
  - `server/routes/activationRoutes.js`
  - `server/routes/miscRoutes.js`

## 검증 방법

1. **개통 데이터 API 테스트**
   ```bash
   curl https://vipmobile-server.vercel.app/api/activation-data/by-date
   ```
   - 예상 결과: 200 OK, 개통 데이터 반환

2. **매장 목록 API 테스트**
   ```bash
   curl https://vipmobile-server.vercel.app/api/stores/unique-values?type=code
   ```
   - 예상 결과: 200 OK, 매장 코드 목록 반환

3. **마커 색상 설정 API 테스트**
   ```bash
   curl https://vipmobile-server.vercel.app/api/marker-color-settings
   ```
   - 예상 결과: 200 OK, 마커 색상 설정 반환

4. **정책 목록 API 테스트**
   ```bash
   curl https://vipmobile-server.vercel.app/api/policies
   ```
   - 예상 결과: 200 OK, 정책 목록 반환

## 교훈

1. **원본 확인 필수**: 시트 이름, 컬럼 인덱스 등은 반드시 원본 파일에서 확인
2. **grepSearch 활용**: 원본 파일에서 상수 정의를 검색하여 정확한 값 확인
3. **배포 전 검증**: 로컬에서 실제 Google Sheets 연결 테스트 필요
4. **문서화**: 시트 이름 매핑 테이블을 문서로 작성하여 참조

## 2차 수정 (2026-01-25)

### 추가 발견된 시트 이름 오류

원본 파일 950-954줄에서 확인:
```javascript
const CUSTOMER_QUEUE_SHEET_NAME = '직영점_구매대기';
const CUSTOMER_BOARD_SHEET_NAME = '직영점_게시판';
const CUSTOMER_PRE_APPROVAL_SHEET_NAME = '직영점_사전승낙서마크';
const CUSTOMER_STORE_PHOTO_SHEET_NAME = '직영점_매장사진';
const TRANSIT_LOCATION_SHEET_NAME = '직영점_대중교통위치';
```

### 수정된 파일: `server/routes/memberRoutes.js`

```javascript
// 수정 전
const QUEUE_SHEET_NAME = '구매대기';
const BOARD_SHEET_NAME = '게시판';

// 수정 후
const QUEUE_SHEET_NAME = '직영점_구매대기';
const BOARD_SHEET_NAME = '직영점_게시판';
```

### 배포 정보

- **커밋 예정**: 2차 시트 이름 수정
- **수정된 파일**: 1개
  - `server/routes/memberRoutes.js`

## 다음 단계

1. ✅ 1차 시트 이름 수정 완료 (커밋 8ac5f5e0)
2. ✅ 2차 시트 이름 수정 완료 (memberRoutes.js)
3. ⏳ Git 커밋 및 푸시 필요
4. ⏳ 배포 후 실제 API 테스트 필요
5. ⏳ 정책 API의 나머지 엔드포인트 원본 로직 복사 (선택사항)
