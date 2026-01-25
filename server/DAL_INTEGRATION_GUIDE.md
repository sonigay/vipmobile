# DAL 연동 가이드 - 직영점 모드

## 개요

직영점 모드 API를 Google Sheets 직접 호출에서 DAL(Data Access Layer)을 통한 호출로 전환합니다.
Feature Flag(`USE_DB_DIRECT_STORE=true`)가 활성화되면 자동으로 Supabase를 사용합니다.

## 현재 상태

- ✅ 마이그레이션 완료: 3,739/3,740 행 성공
- ✅ Feature Flag 활성화: `USE_DB_DIRECT_STORE=true`
- ✅ DAL 구조 완벽 구현
- ❌ API 라우트가 아직 Google Sheets 직접 호출 중

## DAL 사용 패턴

### 1. DAL Factory 초기화

```javascript
const dalFactory = require('./dal/DALFactory');

// 직영점 모드 DAL 가져오기
const directDAL = dalFactory.getDAL('direct-store');
```

### 2. CRUD 작업

#### 조회 (Read)
```javascript
// 기존: Google Sheets 직접 호출
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '직영점_오늘의휴대폰'
});
const rows = res.data.values || [];

// 변경: DAL 사용
const rows = await directDAL.read('direct_store_todays_mobiles');
```

#### 생성 (Create)
```javascript
// 기존: Google Sheets append
await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: '직영점_오늘의휴대폰',
  valueInputOption: 'USER_ENTERED',
  resource: { values: [[data]] }
});

// 변경: DAL 사용
await directDAL.create('direct_store_todays_mobiles', {
  "통신사": "LG",
  "모델ID": "SM-F766N256",
  "모델명": "갤럭시 Z Flip7",
  // ... 기타 필드
});
```

#### 수정 (Update)
```javascript
// 기존: Google Sheets update (행 번호 기반)
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `직영점_오늘의휴대폰!A${rowIndex}:Z${rowIndex}`,
  valueInputOption: 'USER_ENTERED',
  resource: { values: [[updatedData]] }
});

// 변경: DAL 사용 (ID 기반)
await directDAL.update('direct_store_todays_mobiles', id, {
  "통신사": "LG",
  "모델명": "갤럭시 Z Flip7 (수정)"
});
```

#### 삭제 (Delete)
```javascript
// 기존: Google Sheets delete (행 삭제)
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  resource: {
    requests: [{
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex, endIndex }
      }
    }]
  }
});

// 변경: DAL 사용
await directDAL.delete('direct_store_todays_mobiles', id);
```

## 테이블 매핑

| Google Sheets 시트명 | Supabase 테이블명 |
|---------------------|-------------------|
| 직영점_정책_마진 | direct_store_policy_margin |
| 직영점_정책_부가서비스 | direct_store_policy_addon_services |
| 직영점_정책_보험상품 | direct_store_policy_insurance |
| 직영점_정책_별도 | direct_store_policy_special |
| 직영점_설정 | direct_store_settings |
| 직영점_메인페이지문구 | direct_store_main_page_texts |
| 직영점_요금제마스터 | direct_store_plan_master |
| 직영점_단말마스터 | direct_store_device_master |
| 직영점_단말요금정책 | direct_store_device_pricing_policy |
| 직영점_모델이미지 | direct_store_model_images |
| 직영점_오늘의휴대폰 | direct_store_todays_mobiles |
| 직영점_대중교통위치 | direct_store_transit_locations |
| 직영점_매장사진 | direct_store_photos |
| 직영점_판매일보 | direct_store_sales_daily |

## 우선순위 API 엔드포인트

### 1단계: 읽기 전용 API (안전)
- ✅ `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 조회
- ✅ `GET /api/direct/main-page-texts` - 메인페이지 문구 조회
- ✅ `GET /api/direct/transit-location/all` - 대중교통 위치 조회
- ✅ `GET /api/direct/policy-settings` - 정책 설정 조회

### 2단계: 쓰기 API (중요)
- 🔥 `PUT /api/direct/mobiles/:modelId/tags` - 휴대폰 태그 업데이트
- 🔥 `POST /api/direct/main-page-texts` - 메인페이지 문구 저장
- 🔥 `POST /api/direct/transit-location/create` - 대중교통 위치 생성
- 🔥 `PUT /api/direct/transit-location/:id` - 대중교통 위치 수정
- 🔥 `DELETE /api/direct/transit-location/:id` - 대중교통 위치 삭제

### 3단계: 복잡한 API
- `POST /api/direct/rebuild-master` - 마스터 데이터 재빌드
- `POST /api/direct/policy-settings` - 정책 설정 저장
- `POST /api/direct/link-settings` - 링크 설정 저장

## 구현 예시: 오늘의 휴대폰 조회

### 기존 코드 (directRoutes.js)
```javascript
router.get('/todays-mobiles', async (req, res) => {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_오늘의휴대폰'
    });
    
    const rows = (res.data.values || []).slice(1); // 헤더 제거
    
    // 데이터 변환
    const mobiles = rows.map(row => ({
      modelName: row[0],
      petName: row[1],
      carrier: row[2],
      // ... 기타 필드
    }));
    
    res.json({ success: true, data: mobiles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 변경 코드 (DAL 사용)
```javascript
const dalFactory = require('./dal/DALFactory');

router.get('/todays-mobiles', async (req, res) => {
  try {
    const directDAL = dalFactory.getDAL('direct-store');
    
    // DAL을 통해 데이터 조회 (Feature Flag에 따라 자동 전환)
    const rows = await directDAL.read('direct_store_todays_mobiles');
    
    // 데이터 변환 (Supabase는 이미 객체 형태로 반환)
    const mobiles = rows.map(row => ({
      id: row.id,
      modelName: row.모델명,
      petName: row.펫네임,
      carrier: row.통신사,
      // ... 기타 필드
    }));
    
    res.json({ success: true, data: mobiles });
  } catch (error) {
    console.error('[Direct] 오늘의 휴대폰 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 구현 예시: 휴대폰 태그 업데이트

### 기존 코드
```javascript
router.put('/mobiles/:modelId/tags', async (req, res) => {
  try {
    const { modelId } = req.params;
    const { tags } = req.body;
    
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    
    // 1. 전체 데이터 읽기
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_오늘의휴대폰'
    });
    
    const rows = res.data.values || [];
    
    // 2. 해당 모델 찾기
    const rowIndex = rows.findIndex(row => row[0] === modelId);
    
    // 3. 태그 업데이트
    rows[rowIndex][9] = tags.isPopular ? 'Y' : 'N';
    rows[rowIndex][10] = tags.isRecommended ? 'Y' : 'N';
    // ... 기타 태그
    
    // 4. 전체 데이터 다시 쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: '직영점_오늘의휴대폰',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 변경 코드 (DAL 사용)
```javascript
const dalFactory = require('./dal/DALFactory');

router.put('/mobiles/:modelId/tags', async (req, res) => {
  try {
    const { modelId } = req.params;
    const { tags } = req.body;
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 1. 해당 모델 찾기 (모델ID로 조회)
    const rows = await directDAL.read('direct_store_todays_mobiles');
    const mobile = rows.find(row => row.모델ID === modelId || row.모델명 === modelId);
    
    if (!mobile) {
      return res.status(404).json({ success: false, error: '모델을 찾을 수 없습니다.' });
    }
    
    // 2. 태그 업데이트 (ID 기반)
    await directDAL.update('direct_store_todays_mobiles', mobile.id, {
      isPopular: tags.isPopular,
      isRecommended: tags.isRecommended,
      isCheap: tags.isCheap,
      isPremium: tags.isPremium,
      isBudget: tags.isBudget
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Direct] 태그 업데이트 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 주의사항

### 1. 컬럼명 차이
- **Google Sheets**: 배열 인덱스 (row[0], row[1], ...)
- **Supabase**: 한글 컬럼명 (row.통신사, row.모델명, ...)

### 2. ID 필드
- **Google Sheets**: 행 번호 기반 (불안정)
- **Supabase**: `id` 필드 (SERIAL PRIMARY KEY, 안정적)

### 3. 데이터 타입
- **Google Sheets**: 모든 값이 문자열
- **Supabase**: 타입이 명확 (INTEGER, VARCHAR, BOOLEAN, TIMESTAMP)

### 4. 캐싱
- **Google Sheets**: 수동 캐싱 필요 (Rate Limit 방지)
- **Supabase**: 캐싱 불필요 (빠른 응답 속도)

### 5. 트랜잭션
- **Google Sheets**: 트랜잭션 없음 (부분 실패 가능)
- **Supabase**: 트랜잭션 지원 (원자성 보장)

## 테스트 방법

### 1. Feature Flag 확인
```bash
# .env 파일 확인
cat server/.env | grep USE_DB_DIRECT_STORE
# 출력: USE_DB_DIRECT_STORE=true
```

### 2. DAL 상태 확인
```javascript
const dalFactory = require('./dal/DALFactory');
console.log(dalFactory.getStatus());
// 출력:
// {
//   database: true,
//   googleSheets: true,
//   featureFlags: {
//     'direct-store': true,
//     'policy': true,
//     'customer': true
//   }
// }
```

### 3. API 테스트
```bash
# 오늘의 휴대폰 조회
curl http://localhost:4000/api/direct/todays-mobiles

# 태그 업데이트
curl -X PUT http://localhost:4000/api/direct/mobiles/SM-F766N256/tags \
  -H "Content-Type: application/json" \
  -d '{"tags":{"isPopular":true,"isRecommended":false}}'
```

### 4. 로그 확인
```bash
# DAL 사용 확인
tail -f server/logs/app.log | grep "DALFactory"
# 출력: [DALFactory] Mode: direct-store, Using: Database
```

## 다음 단계

1. ✅ Feature Flag 활성화 완료
2. 🔄 **현재 단계**: API 라우트 DAL 연동
3. ⏭️ 테스트 및 검증
4. ⏭️ 프론트엔드 연동 확인
5. ⏭️ Google Sheets 백업 유지 (읽기 전용)

## 참고 자료

- `server/dal/DALFactory.js` - DAL Factory 구현
- `server/dal/DataAccessLayer.js` - DAL 인터페이스
- `server/dal/DatabaseImplementation.js` - Supabase 구현체
- `server/dal/GoogleSheetsImplementation.js` - Google Sheets 구현체
- `server/dal/FeatureFlagManager.js` - Feature Flag 관리
