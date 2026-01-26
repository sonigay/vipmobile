# 직영점 모드 API 전환 Phase 1 완료

## 완료 날짜: 2026-01-25

---

## Phase 1: 핵심 읽기 API 전환 완료 ✅

### 전환된 API (6개)

#### 1. ✅ `GET /api/direct/policy-settings` - 정책 설정 조회
- **상태**: DAL 전환 완료
- **테이블**: 
  - `direct_store_policy_margin`
  - `direct_store_policy_addon_services`
  - `direct_store_policy_insurance`
  - `direct_store_policy_special`
- **DAL 메서드**:
  - `getPolicyMargin(carrier)`
  - `getPolicyAddonServices(carrier)`
  - `getPolicyInsurance(carrier)`
  - `getPolicySpecial(carrier)`
- **Feature Flag**: `USE_DB_DIRECT_STORE=true`
- **동작 방식**: Supabase 우선, Google Sheets 폴백

#### 2. ✅ `GET /api/direct/link-settings` - 링크 설정 조회
- **상태**: DAL 전환 완료
- **테이블**: `direct_store_settings`
- **DAL 메서드**: `getSettings(carrier, settingType)`
- **Feature Flag**: `USE_DB_DIRECT_STORE=true`
- **동작 방식**: Supabase 우선, Google Sheets 폴백

#### 3. ✅ `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 조회
- **상태**: DAL 전환 완료
- **테이블**: `direct_store_todays_mobiles`
- **DAL 메서드**: `getTodaysMobiles()`
- **Feature Flag**: `USE_DB_DIRECT_STORE=true`
- **동작 방식**: Supabase 우선, Google Sheets 폴백
- **특징**: 프리미엄/중저가 태그 기반 필터링

#### 4. ✅ `GET /api/direct/transit-location/list` - 매장별 대중교통 위치 조회
- **상태**: DAL 전환 완료
- **테이블**: 
  - `direct_store_transit_locations`
  - `direct_store_photos` (버스터미널ID목록, 지하철역ID목록)
- **DAL 메서드**: 
  - `getAllTransitLocations()`
  - `dal.read('direct_store_photos')`
- **Feature Flag**: `USE_DB_DIRECT_STORE=true`
- **동작 방식**: Supabase 우선, Google Sheets 폴백

#### 5. ✅ `POST /api/direct/transit-location/save` - 매장별 대중교통 위치 저장
- **상태**: DAL 전환 완료
- **테이블**: `direct_store_photos`
- **DAL 메서드**: `updateStoreTransitLocations(storeName, busTerminalIds, subwayStationIds)`
- **Feature Flag**: `USE_DB_DIRECT_STORE=true`
- **동작 방식**: Supabase 우선, Google Sheets 폴백

---

## DirectStoreDAL 추가 메서드 (Phase 1)

### 읽기 메서드 (이미 구현됨)
- ✅ `getPolicyMargin(carrier)` - 정책 마진 조회
- ✅ `getPolicyAddonServices(carrier)` - 부가서비스 정책 조회
- ✅ `getPolicyInsurance(carrier)` - 보험상품 정책 조회
- ✅ `getPolicySpecial(carrier)` - 특별 정책 조회
- ✅ `getSettings(carrier, settingType)` - 설정 조회
- ✅ `getTodaysMobiles(carrier)` - 오늘의 휴대폰 조회
- ✅ `getAllTransitLocations()` - 대중교통 위치 전체 조회

### 쓰기/수정 메서드 (새로 추가)
- ✅ `getStoreTransitLocations(storeName)` - 매장별 대중교통 위치 조회
- ✅ `updateStoreTransitLocations(storeName, busTerminalIds, subwayStationIds)` - 매장별 대중교통 위치 업데이트
- ✅ `updatePolicyMargin(carrier, margin)` - 정책 마진 업데이트
- ✅ `updatePolicyAddonServices(carrier, services)` - 부가서비스 정책 업데이트 (전체 교체)
- ✅ `updatePolicyInsurance(carrier, insurances)` - 보험상품 정책 업데이트 (전체 교체)
- ✅ `updatePolicySpecial(carrier, policies)` - 특별 정책 업데이트 (전체 교체)
- ✅ `updateSettings(carrier, settingType, settings)` - 설정 업데이트
- ✅ `updateModelImages(carrier, modelId, images)` - 모델 이미지 업데이트 (Discord 새로고침용)

---

## 전체 API 전환 현황

### ✅ 완료된 API (15개)

#### 읽기 API (10개)
1. ✅ `GET /api/direct/transit-location/all` - 대중교통 위치 조회
2. ✅ `GET /api/direct/main-page-texts` - 메인 페이지 문구 조회
3. ✅ `GET /api/direct/plans-master` - 요금제 마스터 조회
4. ✅ `GET /api/direct/mobiles-master` - 단말 마스터 조회
5. ✅ `GET /api/direct/mobiles-pricing` - 단말 요금 정책 조회
6. ✅ `GET /api/direct/policy-settings` - 정책 설정 조회 ⭐ Phase 1
7. ✅ `GET /api/direct/link-settings` - 링크 설정 조회 ⭐ Phase 1
8. ✅ `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 조회 ⭐ Phase 1
9. ✅ `GET /api/direct/transit-location/list` - 매장별 대중교통 위치 조회 ⭐ Phase 1

#### 쓰기/수정/삭제 API (6개)
10. ✅ `POST /api/direct/transit-location/create` - 대중교통 위치 생성
11. ✅ `PUT /api/direct/transit-location/:id` - 대중교통 위치 수정
12. ✅ `DELETE /api/direct/transit-location/:id` - 대중교통 위치 삭제
13. ✅ `POST /api/direct/rebuild-master` - 마스터 데이터 통합 재빌드
14. ✅ `PUT /api/direct/mobiles/:modelId/tags` - 휴대폰 태그 업데이트
15. ✅ `POST /api/direct/transit-location/save` - 매장별 대중교통 위치 저장 ⭐ Phase 1

---

## 남은 API (우선순위별)

### 우선순위 2: 복잡한 읽기 API (2개)

1. ⏳ `GET /api/direct/mobiles` - 휴대폰 목록 조회 (동적 생성)
   - **복잡도**: 매우 높음 (외부 시트 읽기, 이미지/태그 병합, 정책 계산)
   - **테이블**: `direct_store_device_master`, `direct_store_model_images`, `direct_store_todays_mobiles`
   - **DAL 메서드**: `getDeviceMaster()`, `getModelImages()`, `getTodaysMobiles()`
   - **비고**: Google Sheets 외부 링크 읽기 로직 유지 필요

2. ⏳ `GET /api/direct/mobiles/:modelId/calculate` - 요금제별 대리점지원금 계산
   - **복잡도**: 매우 높음 (복잡한 계산 로직, 정책 적용)
   - **테이블**: `direct_store_device_pricing_policy`, `direct_store_policy_margin`, `direct_store_policy_addon_services`, `direct_store_policy_insurance`
   - **DAL 메서드**: `getDevicePricingPolicy()`, `getPolicyMargin()`, `getPolicyAddonServices()`, `getPolicyInsurance()`
   - **비고**: 계산 로직은 그대로 유지, 데이터만 Supabase에서 읽기

### 우선순위 3: 쓰기/수정 API (3개)

3. ⏳ `POST /api/direct/policy-settings` - 정책 설정 저장
4. ⏳ `POST /api/direct/link-settings` - 링크 설정 저장
5. ⏳ `POST /api/direct/main-page-texts` - 메인페이지 문구 저장

### 우선순위 4: 디버그/관리 API (4개)

6. ⏳ `GET /api/direct/debug/link-settings` - 링크 설정 디버그
7. ⏳ `GET /api/direct/debug/rebuild-master-preview` - 재빌드 미리보기
8. ⏳ `GET /api/direct/link-settings/fetch-range` - 시트 범위 데이터 가져오기
9. ⏳ `GET /api/direct/link-settings/plan-groups` - 요금제군 목록 조회

### 우선순위 5: 매장별 설정 API (4개)

10. ⏳ `GET /api/direct/store-slideshow-settings` - 매장별 슬라이드쇼 설정 조회
11. ⏳ `POST /api/direct/store-slideshow-settings` - 매장별 슬라이드쇼 설정 저장
12. ⏳ `GET /api/direct/store-main-page-texts` - 매장별 메인페이지 문구 조회
13. ⏳ `POST /api/direct/store-main-page-texts` - 매장별 메인페이지 문구 저장

---

## 테스트 가이드

### Phase 1 API 테스트

#### 1. 정책 설정 조회 테스트
```bash
# Supabase에서 읽기 (USE_DB_DIRECT_STORE=true)
curl http://localhost:4000/api/direct/policy-settings?carrier=SK

# 응답 확인
# - margin.baseMargin: 정책 마진
# - addon.list: 부가서비스 목록
# - insurance.list: 보험상품 목록
# - special.list: 특별 정책 목록
```

#### 2. 링크 설정 조회 테스트
```bash
# Supabase에서 읽기
curl http://localhost:4000/api/direct/link-settings?carrier=SK

# 응답 확인
# - planGroup: 요금제 설정
# - support: 단말 지원 설정
# - policy: 정책 설정
```

#### 3. 오늘의 휴대폰 조회 테스트
```bash
# Supabase에서 읽기
curl http://localhost:4000/api/direct/todays-mobiles

# 응답 확인
# - premium: 프리미엄 휴대폰 목록 (최대 3개)
# - budget: 중저가 휴대폰 목록 (최대 2개)
```

#### 4. 매장별 대중교통 위치 조회 테스트
```bash
# Supabase에서 읽기
curl http://localhost:4000/api/direct/transit-location/list

# 응답 확인
# - data: 매장별 대중교통 위치 목록
#   - storeName: 매장명
#   - busTerminals: 버스터미널 목록
#   - subwayStations: 지하철역 목록
```

#### 5. 매장별 대중교통 위치 저장 테스트
```bash
# Supabase에 쓰기
curl -X POST http://localhost:4000/api/direct/transit-location/save \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "테스트매장",
    "busTerminalIds": ["TL_123", "TL_456"],
    "subwayStationIds": ["TL_789"]
  }'

# 응답 확인
# - success: true
# - message: "대중교통 위치가 저장되었습니다."
```

### Feature Flag 테스트

```bash
# 1. .env 파일에서 Feature Flag 확인
USE_DB_DIRECT_STORE=true

# 2. 서버 재시작
cd server
npm start

# 3. API 호출 시 로그 확인
# - "Supabase에서 데이터 읽기 시작" 메시지 확인
# - "Supabase에서 데이터 읽기 완료" 메시지 확인

# 4. Feature Flag를 false로 변경하여 Google Sheets 모드 테스트
USE_DB_DIRECT_STORE=false

# 5. 서버 재시작 후 API 호출
# - "Google Sheets에서 데이터 읽기 시작" 메시지 확인
```

---

## 성능 개선 효과

### Phase 1 API 전환 후 예상 성능 개선

1. **정책 설정 조회 (`GET /api/direct/policy-settings`)**
   - Google Sheets: 4개 시트 읽기 (약 2-4초)
   - Supabase: 4개 테이블 병렬 조회 (약 0.2-0.5초)
   - **개선율**: 약 80-90% 단축

2. **링크 설정 조회 (`GET /api/direct/link-settings`)**
   - Google Sheets: 1개 시트 읽기 + 필터링 (약 1-2초)
   - Supabase: 1개 테이블 조회 (약 0.1-0.2초)
   - **개선율**: 약 90% 단축

3. **오늘의 휴대폰 조회 (`GET /api/direct/todays-mobiles`)**
   - Google Sheets: 3개 통신사 × 복잡한 로직 (약 5-10초)
   - Supabase: 1개 테이블 조회 + 필터링 (약 0.2-0.5초)
   - **개선율**: 약 95% 단축

4. **매장별 대중교통 위치 조회 (`GET /api/direct/transit-location/list`)**
   - Google Sheets: 2개 시트 읽기 + 병합 (약 2-3초)
   - Supabase: 2개 테이블 조회 + 병합 (약 0.2-0.4초)
   - **개선율**: 약 85-90% 단축

---

## 다음 단계 (Phase 2)

### 우선순위 2: 복잡한 읽기 API 전환

1. `GET /api/direct/mobiles` - 휴대폰 목록 조회
   - 외부 시트 읽기 로직 유지
   - 이미지/태그 병합은 Supabase에서 읽기
   - 정책 계산 로직은 그대로 유지

2. `GET /api/direct/mobiles/:modelId/calculate` - 요금제별 대리점지원금 계산
   - 계산 로직은 그대로 유지
   - 데이터만 Supabase에서 읽기

---

## 참고 문서

- `server/dal/DirectStoreDAL.js` - DirectStoreDAL 헬퍼 클래스 (32개 메서드)
- `server/directRoutes.js` - 직영점 API 라우트 (15개 API 전환 완료)
- `server/DAL_INTEGRATION_GUIDE.md` - DAL 통합 가이드
- `server/DAL_TEST_GUIDE.md` - DAL 테스트 가이드
- `.kiro/specs/hybrid-database-migration/REMAINING_APIS.md` - 남은 API 목록

---

**작성일**: 2026-01-25  
**작성자**: Kiro AI  
**버전**: 1.0 (Phase 1 완료)

