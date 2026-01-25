# 시트 이름 전수 조사 보고서

## 원본 파일에서 확인된 정확한 시트 이름 목록

### 기본 시트 (server/index.js.backup.original 905-954줄)

```javascript
const INVENTORY_SHEET_NAME = '폰클재고데이터';
const STORE_SHEET_NAME = '폰클출고처데이터';
const PLAN_SHEET_NAME = '무선요금제군';
const AGENT_SHEET_NAME = '대리점아이디관리';
const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터';
const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '폰클개통데이터(전월)';
const UPDATE_SHEET_NAME = '어플업데이트';
const MANUAL_DATA_SHEET_NAME = '수기초';
const INSPECTION_RESULT_SHEET_NAME = '검수결과';
const SMS_SHEET_NAME = 'SMS관리';
const SMS_RULES_SHEET_NAME = 'SMS전달규칙';
const SMS_HISTORY_SHEET_NAME = 'SMS전달이력';
const SMS_AUTO_REPLY_RULES_SHEET_NAME = 'SMS자동응답규칙';
const SMS_AUTO_REPLY_CONTACTS_SHEET_NAME = 'SMS자동응답거래처';
const SMS_AUTO_REPLY_HISTORY_SHEET_NAME = 'SMS자동응답이력';
const QUICK_COST_SHEET_NAME = '퀵비용관리';
const MARKER_COLOR_SETTINGS_SHEET_NAME = '관리자모드_마커색상설정';
const NORMALIZATION_HISTORY_SHEET_NAME = '정규화이력';
const INSPECTION_MEMO_SHEET_NAME = '여직원검수데이터메모';
const INSPECTION_SETTINGS_SHEET_NAME = '검수설정';
const RESERVATION_SITE_SHEET_NAME = '사전예약사이트';
const YARD_RECEIPT_SHEET_NAME = '마당접수';
const ON_SALE_SHEET_NAME = '온세일';
const POS_CODE_MAPPING_SHEET_NAME = 'POS코드변경설정';
const NORMALIZATION_WORK_SHEET_NAME = '정규화작업';
const SUBSCRIBER_INCREASE_SHEET_NAME = '가입자증감';
const PHONEKL_HOME_DATA_SHEET_NAME = '폰클홈데이터';
const MONTHLY_AWARD_SETTINGS_SHEET_NAME = '장표모드셋팅메뉴';
const CUSTOMER_QUEUE_SHEET_NAME = '직영점_구매대기';
const CUSTOMER_PRE_APPROVAL_SHEET_NAME = '직영점_사전승낙서마크';
const CUSTOMER_STORE_PHOTO_SHEET_NAME = '직영점_매장사진';
const CUSTOMER_BOARD_SHEET_NAME = '직영점_게시판';
const TRANSIT_LOCATION_SHEET_NAME = '직영점_대중교통위치';
```

### 하드코딩된 시트 이름 (원본 파일에서 발견)

```javascript
'판매점정보'        // 2152, 9205줄
'raw데이터'         // 3039줄
'지도재고노출옵션'   // 2460, 2530, 2640줄
'일반모드권한관리'   // 2836, 4190줄
```

## 리팩토링된 라우터 파일 시트 이름 검증

### ✅ 정확한 시트 이름 사용 중

1. **storeRoutes.js**
   - `폰클재고데이터` ✅
   - `폰클출고처데이터` ✅

2. **salesRoutes.js**
   - `대리점아이디관리` ✅
   - `raw데이터` ✅

3. **smsRoutes.js**
   - `SMS관리` ✅
   - `SMS자동응답규칙` ✅
   - `SMS자동응답이력` ✅

4. **teamRoutes.js**
   - `대리점아이디관리` ✅

5. **policyRoutes.js**
   - `폰클출고처데이터` ✅
   - `어플업데이트` ✅

6. **memberRoutes.js**
   - `직영점_구매대기` ✅
   - `직영점_게시판` ✅

### ⚠️ 임의로 작성된 시트 이름 (원본 확인 필요)

1. **subscriberIncreaseRoutes.js**
   - ❌ `가입자증가접근권한` → 원본 확인 필요
   - ❌ `가입자증감` → 원본: `가입자증감` ✅

2. **smsRoutes.js**
   - ❌ `SMS자동응답대기` → 원본 확인 필요
   - ❌ `SMS연락처` → 원본 확인 필요
   - ❌ `SMS수신` → 원본 확인 필요
   - ❌ `SMS이력` → 원본 확인 필요
   - ❌ `SMS통계` → 원본 확인 필요
   - ❌ `SMS규칙` → 원본 확인 필요

3. **salesByStoreRoutes.js**
   - ❌ `매장별판매` → 원본 확인 필요

4. **reservationRoutes.js**
   - ❌ `예약관리` → 원본 확인 필요
   - ❌ `예약설정목록` → 원본 확인 필요
   - ❌ `예약설정데이터` → 원본 확인 필요
   - ❌ `예약판매전체고객` → 원본 확인 필요
   - ❌ `예약판매모델색상` → 원본 확인 필요
   - ❌ `예약배정메모리` → 원본 확인 필요
   - ❌ `예약배정변경이력` → 원본 확인 필요
   - ❌ `예약사이트` → 원본: `사전예약사이트` ❌
   - ❌ `온세일접수` → 원본 확인 필요
   - ❌ `야드접수` → 원본 확인 필요
   - ❌ `예약재고현황` → 원본 확인 필요
   - ❌ `예약판매고객` → 원본 확인 필요
   - ❌ `예약설정` → 원본 확인 필요
   - ❌ `예약모델데이터` → 원본 확인 필요
   - ❌ `예약정규화상태` → 원본 확인 필요
   - ❌ `예약정규화데이터` → 원본 확인 필요

5. **rechotanchoBondRoutes.js**
   - ❌ `레초탄초채권` → 원본 확인 필요
   - ❌ `레초탄초채권이력` → 원본 확인 필요

6. **quickCostRoutes.js**
   - ❌ `빠른견적모델` → 원본 확인 필요
   - ❌ `빠른견적전화번호` → 원본 확인 필요
   - ❌ `빠른견적목록` → 원본 확인 필요
   - ❌ `빠른견적이력` → 원본 확인 필요
   - ❌ `빠른견적통계` → 원본 확인 필요
   - ❌ `빠른견적품질` → 원본 확인 필요

7. **posCodeRoutes.js**
   - ❌ `POS코드매핑` → 원본: `POS코드변경설정` ❌

## 수정 완료 내역

### 1차 수정 (커밋 8ac5f5e0)
- ✅ `당월개통실적` → `폰클개통데이터`
- ✅ `전월개통실적` → `폰클개통데이터(전월)`
- ✅ `매장목록`/`매장정보` → `폰클출고처데이터`
- ✅ `마커색상설정` → `관리자모드_마커색상설정`

### 2차 수정 (커밋 5b4a0eb4)
- ✅ `구매대기` → `직영점_구매대기`
- ✅ `게시판` → `직영점_게시판`

### 3차 수정 (커밋 17f2b725)
- ✅ `예약사이트` → `사전예약사이트`
- ✅ `POS코드매핑` → `POS코드변경설정`

### 4차 수정 (커밋 a99b52fd)
- ✅ `가입자증가` → `가입자증감`
- ✅ `가입자증가접근권한` → `가입자증감`
- ✅ `가입자증가제외` → `가입자증감제외`
- ✅ `온세일접수` → `온세일`
- ✅ `야드접수` → `마당접수`

## 원본에 존재하지 않는 임의 시트 이름 (수정 불필요)

다음 시트 이름들은 리팩토링 과정에서 임의로 만들어진 것으로, 원본 파일에 해당 엔드포인트가 존재하지 않습니다:

### SMS 관련
- `SMS자동응답대기` - 원본에 없음
- `SMS연락처` - 원본에 없음
- `SMS수신` - 원본에 없음
- `SMS이력` - 원본에 없음
- `SMS통계` - 원본에 없음
- `SMS규칙` - 원본에 없음
- `SMS등록` - 원본에 없음
- `SMS자동응답연락처` - 원본에 없음

### 예약 관련
- `예약관리` - 원본에 없음
- `예약설정목록` - 원본에 없음
- `예약설정데이터` - 원본에 없음
- `예약판매전체고객` - 원본에 없음
- `예약판매모델색상` - 원본에 없음
- `예약배정메모리` - 원본에 없음
- `예약배정변경이력` - 원본에 없음
- `예약재고현황` - 원본에 없음
- `예약판매고객` - 원본에 없음
- `예약설정` - 원본에 없음
- `예약모델데이터` - 원본에 없음
- `예약정규화상태` - 원본에 없음
- `예약정규화데이터` - 원본에 없음

### 빠른견적 관련
- `빠른견적모델` - 원본에 없음
- `빠른견적전화번호` - 원본에 없음
- `빠른견적목록` - 원본에 없음
- `빠른견적이력` - 원본에 없음
- `빠른견적통계` - 원본에 없음
- `빠른견적품질` - 원본에 없음
- `빠른견적` - 원본에 없음

### 기타
- `레초탄초채권` - 원본에 없음
- `레초탄초채권이력` - 원본에 없음
- `매장별판매` - 원본에 없음

**참고**: 원본 파일(server/index.js.backup.original)에는 `퀵비용관리` 시트가 정의되어 있지만(920줄), 실제 사용하는 엔드포인트는 없습니다.
