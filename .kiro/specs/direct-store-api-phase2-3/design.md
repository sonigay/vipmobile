# 직영점 모드 API 전환 Phase 2-3 설계

## 아키텍처 개요

### 전체 구조
```
┌─────────────────┐
│  Frontend       │
│  (React)        │
└────────┬────────┘
         │ HTTP Request (GET/POST/PUT/DELETE)
         ▼
┌─────────────────────────────────────────┐
│  Backend (Express)                      │
│  ┌─────────────────────────────────┐   │
│  │  directRoutes.js                │   │
│  │  ┌───────────────────────────┐  │   │
│  │  │  Feature Flag Check       │  │   │
│  │  │  USE_DB_DIRECT_STORE      │  │   │
│  │  └───────────┬───────────────┘  │   │
│  │              │                   │   │
│  │      ┌───────┴────────┐         │   │
│  │      │                │         │   │
│  │      ▼                ▼         │   │
│  │  ┌────────┐    ┌──────────┐    │   │
│  │  │ DAL    │    │ Google   │    │   │
│  │  │ (DB)   │    │ Sheets   │    │   │
│  │  └────────┘    └──────────┘    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Phase 1 보완: 읽기 전용 API → 완전한 CRUD

### 공통 패턴

**모든 API는 다음 패턴을 따릅니다**:

```javascript
// 읽기 (GET)
router.get('/resource', async (req, res) => {
  const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';
  
  if (USE_DB) {
    try {
      const data = await DirectStoreDAL.getResource();
      return res.json(data);
    } catch (err) {
      console.error('Supabase 실패, Google Sheets로 폴백');
    }
  }
  
  // Google Sheets 로직 (기존)
});

// 쓰기 (POST)
router.post('/resource', async (req, res) => {
  const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';
  
  if (USE_DB) {
    try {
      await DirectStoreDAL.createResource(req.body);
      return res.json({ success: true });
    } catch (err) {
      console.error('Supabase 실패, Google Sheets로 폴백');
    }
  }
  
  // Google Sheets 로직 (기존)
});

// 수정 (PUT)
router.put('/resource/:id', async (req, res) => {
  const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';
  
  if (USE_DB) {
    try {
      await DirectStoreDAL.updateResource(req.params.id, req.body);
      return res.json({ success: true });
    } catch (err) {
      console.error('Supabase 실패, Google Sheets로 폴백');
    }
  }
  
  // Google Sheets 로직 (기존)
});

// 삭제 (DELETE)
router.delete('/resource/:id', async (req, res) => {
  const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';
  
  if (USE_DB) {
    try {
      await DirectStoreDAL.deleteResource(req.params.id);
      return res.json({ success: true });
    } catch (err) {
      console.error('Supabase 실패, Google Sheets로 폴백');
    }
  }
  
  // Google Sheets 로직 (기존)
});
```

## 1. 정책 설정 완전한 CRUD

### 1.1 읽기 (이미 완료 ✅)
- `GET /api/direct/policy-settings?carrier=SK`
- DAL 메서드: `getPolicyMargin()`, `getPolicyAddonServices()`, `getPolicyInsurance()`, `getPolicySpecial()`

### 1.2 쓰기 (신규)

**API**: `POST /api/direct/policy-settings`

**Request Body**:
```json
{
  "carrier": "SK",
  "margin": 50000,
  "addonServices": [
    { "serviceName": "서비스1", "monthlyFee": 5000, "attractionBonus": 10000, "noAttractionDeduction": -5000 }
  ],
  "insurances": [
    { "productName": "보험1", "minPrice": 0, "maxPrice": 1000000, "monthlyFee": 10000, "attractionBonus": 20000 }
  ],
  "specialPolicies": [
    { "policyName": "정책1", "policyType": "추가", "amount": 30000, "isActive": true }
  ]
}
```

**DAL 메서드** (이미 구현됨 ✅):
- `updatePolicyMargin(carrier, margin)`
- `updatePolicyAddonServices(carrier, services)` - 전체 교체
- `updatePolicyInsurance(carrier, insurances)` - 전체 교체
- `updatePolicySpecial(carrier, policies)` - 전체 교체

### 1.3 수정 (신규)

**API**: `PUT /api/direct/policy-settings/:carrier`

**Request Body** (부분 업데이트):
```json
{
  "margin": 60000
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `updatePolicyMarginOnly(carrier, margin)` - 마진만 수정

### 1.4 삭제 (신규)

**API 목록**:
- `DELETE /api/direct/policy-settings/:carrier` - 전체 정책 삭제
- `DELETE /api/direct/policy-settings/:carrier/addon/:serviceName` - 특정 부가서비스 삭제
- `DELETE /api/direct/policy-settings/:carrier/insurance/:productName` - 특정 보험상품 삭제
- `DELETE /api/direct/policy-settings/:carrier/special/:policyName` - 특정 특별정책 삭제

**필요한 DAL 메서드** (신규 추가 필요):
- `deletePolicyAll(carrier)` - 전체 정책 삭제
- `deletePolicyAddonService(carrier, serviceName)` - 특정 부가서비스 삭제
- `deletePolicyInsurance(carrier, productName)` - 특정 보험상품 삭제
- `deletePolicySpecial(carrier, policyName)` - 특정 특별정책 삭제

## 2. 링크 설정 완전한 CRUD

### 2.1 읽기 (이미 완료 ✅)
- `GET /api/direct/link-settings?carrier=SK`
- DAL 메서드: `getSettings(carrier, settingType)`

### 2.2 쓰기 (신규)

**API**: `POST /api/direct/link-settings`

**Request Body**:
```json
{
  "carrier": "SK",
  "settingType": "policy",
  "sheetId": "1abc2def3ghi",
  "sheetUrl": "https://docs.google.com/spreadsheets/d/...",
  "settings": {
    "modelRange": "A2:A100",
    "petNameRange": "B2:B100"
  }
}
```

**DAL 메서드** (이미 구현됨 ✅):
- `updateSettings(carrier, settingType, settings)`

### 2.3 수정 (신규)

**API**: `PUT /api/direct/link-settings/:carrier/:settingType`

**Request Body** (부분 업데이트):
```json
{
  "settings": {
    "modelRange": "A2:A200"
  }
}
```

**DAL 메서드**: 기존 `updateSettings()` 사용 가능 ✅

### 2.4 삭제 (신규)

**API**: `DELETE /api/direct/link-settings/:carrier/:settingType`

**필요한 DAL 메서드** (신규 추가 필요):
- `deleteSettings(carrier, settingType)` - 특정 설정 삭제

## 3. 메인 페이지 문구 완전한 CRUD

### 3.1 읽기 (이미 완료 ✅)
- `GET /api/direct/main-page-texts?carrier=SK`
- DAL 메서드: `getMainPageTexts(carrier)`

### 3.2 쓰기 (신규)

**API**: `POST /api/direct/main-page-texts`

**Request Body**:
```json
{
  "carrier": "SK",
  "category": "메인배너",
  "type": "상단문구",
  "content": "환영합니다",
  "imageUrl": "https://..."
}
```

**DAL 메서드** (이미 구현됨 ✅):
- `updateMainPageText(carrier, category, type, data)`

### 3.3 수정 (신규)

**API**: `PUT /api/direct/main-page-texts/:carrier/:category/:type`

**Request Body**:
```json
{
  "content": "새로운 문구"
}
```

**DAL 메서드**: 기존 `updateMainPageText()` 사용 가능 ✅

### 3.4 삭제 (신규)

**API**: `DELETE /api/direct/main-page-texts/:carrier/:category/:type`

**필요한 DAL 메서드** (신규 추가 필요):
- `deleteMainPageText(carrier, category, type)` - 특정 문구 삭제

## 4. 요금제 마스터 완전한 CRUD

### 4.1 읽기 (이미 완료 ✅)
- `GET /api/direct/plans-master?carrier=SK`
- DAL 메서드: `getPlanMaster(carrier, planGroup)`

### 4.2 쓰기 (신규)

**API**: `POST /api/direct/plans-master`

**Request Body**:
```json
{
  "carrier": "SK",
  "planName": "5G 프리미어 에센셜",
  "planGroup": "115군",
  "basicFee": 115000,
  "planCode": "SK115",
  "isActive": true,
  "note": ""
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `createPlanMaster(data)` - 요금제 추가

### 4.3 수정 (신규)

**API**: `PUT /api/direct/plans-master/:carrier/:planName`

**Request Body**:
```json
{
  "basicFee": 120000,
  "isActive": false
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `updatePlanMaster(carrier, planName, updates)` - 요금제 수정

### 4.4 삭제 (신규)

**API**: `DELETE /api/direct/plans-master/:carrier/:planName`

**필요한 DAL 메서드** (신규 추가 필요):
- `deletePlanMaster(carrier, planName)` - 요금제 삭제

## 5. 단말 마스터 완전한 CRUD

### 5.1 읽기 (이미 완료 ✅)
- `GET /api/direct/mobiles-master?carrier=SK`
- DAL 메서드: `getDeviceMaster(carrier, modelId)`

### 5.2 쓰기 (신규)

**API**: `POST /api/direct/mobiles-master`

**Request Body**:
```json
{
  "carrier": "SK",
  "modelId": "SM-S926N256",
  "modelName": "갤럭시 S24+",
  "petName": "S24+",
  "manufacturer": "삼성",
  "factoryPrice": 1353000,
  "defaultPlanGroup": "115군",
  "isPremium": true,
  "isBudget": false,
  "isActive": true
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `createDeviceMaster(data)` - 단말 추가

### 5.3 수정 (신규)

**API**: `PUT /api/direct/mobiles-master/:carrier/:modelId`

**Request Body**:
```json
{
  "factoryPrice": 1400000,
  "isPremium": false
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `updateDeviceMaster(carrier, modelId, updates)` - 단말 수정

### 5.4 삭제 (신규)

**API**: `DELETE /api/direct/mobiles-master/:carrier/:modelId`

**필요한 DAL 메서드** (신규 추가 필요):
- `deleteDeviceMaster(carrier, modelId)` - 단말 삭제

## 6. 단말 요금 정책 완전한 CRUD

### 6.1 읽기 (이미 완료 ✅)
- `GET /api/direct/mobiles-pricing?carrier=SK`
- DAL 메서드: `getDevicePricingPolicy(carrier, modelId, planGroup)`

### 6.2 쓰기 (신규)

**API**: `POST /api/direct/mobiles-pricing`

**Request Body**:
```json
{
  "carrier": "SK",
  "modelId": "SM-S926N256",
  "modelName": "갤럭시 S24+",
  "planGroup": "115군",
  "planCode": "SK115",
  "openingType": "MNP",
  "factoryPrice": 1353000,
  "publicSupport": 690000,
  "storeAdditionalSupportWithAddon": 100000,
  "policyMargin": 50000
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `createDevicePricingPolicy(data)` - 요금 정책 추가

### 6.3 수정 (신규)

**API**: `PUT /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup`

**Request Body**:
```json
{
  "publicSupport": 700000,
  "storeAdditionalSupportWithAddon": 120000
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `updateDevicePricingPolicy(carrier, modelId, planGroup, updates)` - 요금 정책 수정

### 6.4 삭제 (신규)

**API**: `DELETE /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup`

**필요한 DAL 메서드** (신규 추가 필요):
- `deleteDevicePricingPolicy(carrier, modelId, planGroup)` - 요금 정책 삭제

## 7. 오늘의 휴대폰 완전한 CRUD

### 7.1 읽기 (이미 완료 ✅)
- `GET /api/direct/todays-mobiles`
- DAL 메서드: `getTodaysMobiles(carrier)`

### 7.2 쓰기 (신규)

**API**: `POST /api/direct/todays-mobiles`

**Request Body**:
```json
{
  "modelName": "갤럭시 S24+",
  "carrier": "SK",
  "isPremium": true,
  "isBudget": false,
  "isPopular": true,
  "isRecommended": false,
  "isCheap": false
}
```

**필요한 DAL 메서드** (신규 추가 필요):
- `createTodaysMobile(data)` - 오늘의 휴대폰 추가

### 7.3 수정 (신규)

**API**: `PUT /api/direct/todays-mobiles/:modelName/:carrier`

**Request Body**:
```json
{
  "isPremium": false,
  "isPopular": false
}
```

**DAL 메서드** (이미 구현됨 ✅):
- `updateTodaysMobileTags(modelName, carrier, tags)`

### 7.4 삭제 (신규)

**API**: `DELETE /api/direct/todays-mobiles/:modelName/:carrier`

**DAL 메서드** (이미 구현됨 ✅):
- `deleteTodaysMobile(modelName, carrier)`

## 필요한 DAL 메서드 추가 목록

### 정책 설정 (4개)
- `deletePolicyAll(carrier)` - 전체 정책 삭제
- `deletePolicyAddonService(carrier, serviceName)` - 특정 부가서비스 삭제
- `deletePolicyInsurance(carrier, productName)` - 특정 보험상품 삭제
- `deletePolicySpecial(carrier, policyName)` - 특별정책 삭제

### 링크 설정 (1개)
- `deleteSettings(carrier, settingType)` - 설정 삭제

### 메인 페이지 문구 (1개)
- `deleteMainPageText(carrier, category, type)` - 문구 삭제

### 요금제 마스터 (3개)
- `createPlanMaster(data)` - 요금제 추가
- `updatePlanMaster(carrier, planName, updates)` - 요금제 수정
- `deletePlanMaster(carrier, planName)` - 요금제 삭제

### 단말 마스터 (3개)
- `createDeviceMaster(data)` - 단말 추가
- `updateDeviceMaster(carrier, modelId, updates)` - 단말 수정
- `deleteDeviceMaster(carrier, modelId)` - 단말 삭제

### 단말 요금 정책 (3개)
- `createDevicePricingPolicy(data)` - 요금 정책 추가
- `updateDevicePricingPolicy(carrier, modelId, planGroup, updates)` - 요금 정책 수정
- `deleteDevicePricingPolicy(carrier, modelId, planGroup)` - 요금 정책 삭제

### 오늘의 휴대폰 (1개)
- `createTodaysMobile(data)` - 오늘의 휴대폰 추가

**총 16개 메서드 추가 필요**

## 에러 처리 전략

### 1. Supabase 실패 시 Google Sheets 폴백
```javascript
const USE_DB = process.env.USE_DB_DIRECT_STORE === 'true';

if (USE_DB) {
  try {
    const data = await DirectStoreDAL.method();
    return res.json(data);
  } catch (err) {
    console.error('[Direct] Supabase 실패, Google Sheets로 폴백:', err.message);
    // 폴백: Google Sheets
  }
}

// Google Sheets 로직 (기존)
```

### 2. 트랜잭션 보장 (쓰기 작업)
```javascript
try {
  // 1. 기존 데이터 삭제
  await DirectStoreDAL.delete(...);
  
  // 2. 새 데이터 삽입
  for (const item of items) {
    await DirectStoreDAL.create(...);
  }
  
  return { success: true };
} catch (err) {
  console.error('[Direct] 쓰기 실패:', err);
  throw err; // 롤백은 Supabase에서 자동 처리
}
```

## 배포 전략

### 1. 단계별 배포
1. **Phase 1 보완**: CRUD 메서드 추가 및 API 구현
2. **Phase 2**: 복잡한 읽기 API 전환
3. **Phase 3**: 디버그/관리 API 전환

### 2. Feature Flag 전환
```bash
# 1. Supabase 모드로 전환
USE_DB_DIRECT_STORE=true

# 2. 테스트 및 모니터링

# 3. 문제 발생 시 즉시 롤백
USE_DB_DIRECT_STORE=false
```
