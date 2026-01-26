# 직영점 모드 남은 API 전환 목록

## 현재 상태 (2026-01-25)

### ✅ 이미 DAL로 전환 완료된 API (10개)

#### 읽기 API (5개)
1. ✅ `GET /api/direct/transit-location/all` - 대중교통 위치 조회
2. ✅ `GET /api/direct/main-page-texts` - 메인 페이지 문구 조회
3. ✅ `GET /api/direct/plans-master` - 요금제 마스터 조회
4. ✅ `GET /api/direct/mobiles-master` - 단말 마스터 조회
5. ✅ `GET /api/direct/mobiles-pricing` - 단말 요금 정책 조회

#### 쓰기/수정/삭제 API (5개)
6. ✅ `POST /api/direct/transit-location/create` - 대중교통 위치 생성
7. ✅ `PUT /api/direct/transit-location/:id` - 대중교통 위치 수정
8. ✅ `DELETE /api/direct/transit-location/:id` - 대중교통 위치 삭제
9. ✅ `POST /api/direct/rebuild-master` - 마스터 데이터 통합 재빌드
10. ✅ `PUT /api/direct/mobiles/:modelId/tags` - 휴대폰 태그 업데이트

---

## 🔄 남은 API 전환 목록 (우선순위별)

### 우선순위 1: 핵심 읽기 API (6개)

1. ⏳ `GET /api/direct/policy-settings` - 정책 설정 조회
   - 테이블: `direct_store_policy_margin`, `direct_store_policy_addon_services`, `direct_store_policy_insurance`, `direct_store_policy_special`
   - DAL 메서드: `getPolicyMargin()`, `getPolicyAddonServices()`, `getPolicyInsurance()`, `getPolicySpecial()`
   - 현재 상태: Google Sheets 직접 읽기

2. ⏳ `GET /api/direct/link-settings` - 링크 설정 조회
   - 테이블: `direct_store_settings`
   - DAL 메서드: `getSettings()`
   - 현재 상태: Google Sheets 직접 읽기

3. ⏳ `GET /api/direct/mobiles` - 휴대폰 목록 조회 (동적 생성)
   - 테이블: `direct_store_device_master`, `direct_store_model_images`, `direct_store_todays_mobiles`
   - DAL 메서드: `getDeviceMaster()`, `getModelImages()`, `getTodaysMobiles()`
   - 현재 상태: Google Sheets 직접 읽기 + 복잡한 병합 로직

4. ⏳ `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 조회
   - 테이블: `direct_store_todays_mobiles`
   - DAL 메서드: `getTodaysMobiles()`
   - 현재 상태: Google Sheets 직접 읽기

5. ⏳ `GET /api/direct/mobiles/:modelId/calculate` - 요금제별 대리점지원금 계산
   - 테이블: `direct_store_device_pricing_policy`, `direct_store_policy_margin`, `direct_store_policy_addon_services`, `direct_store_policy_insurance`
   - DAL 메서드: `getDevicePricingPolicy()`, `getPolicyMargin()`, `getPolicyAddonServices()`, `getPolicyInsurance()`
   - 현재 상태: Google Sheets 직접 읽기 + 복잡한 계산 로직

6. ⏳ `GET /api/direct/transit-location/list` - 매장별 대중교통 위치 조회
   - 테이블: `direct_store_photos` (버스터미널ID목록, 지하철역ID목록 컬럼)
   - DAL 메서드: 새로 추가 필요 `getStoreTransitLocations(storeName)`
   - 현재 상태: Google Sheets 직접 읽기

---

### 우선순위 2: 쓰기/수정 API (5개)

7. ⏳ `POST /api/direct/policy-settings` - 정책 설정 저장
   - 테이블: `direct_store_policy_margin`, `direct_store_policy_addon_services`, `direct_store_policy_insurance`, `direct_store_policy_special`
   - DAL 메서드: 새로 추가 필요 `updatePolicyMargin()`, `updatePolicyAddonServices()`, `updatePolicyInsurance()`, `updatePolicySpecial()`
   - 현재 상태: Google Sheets 직접 쓰기

8. ⏳ `POST /api/direct/link-settings` - 링크 설정 저장
   - 테이블: `direct_store_settings`
   - DAL 메서드: 새로 추가 필요 `updateSettings()`
   - 현재 상태: Google Sheets 직접 쓰기

9. ⏳ `POST /api/direct/main-page-texts` - 메인페이지 문구 저장
   - 테이블: `direct_store_main_page_texts`
   - DAL 메서드: `updateMainPageText()` (이미 구현됨)
   - 현재 상태: Google Sheets 직접 쓰기

10. ⏳ `POST /api/direct/transit-location/save` - 매장별 대중교통 위치 저장
    - 테이블: `direct_store_photos` (버스터미널ID목록, 지하철역ID목록 컬럼)
    - DAL 메서드: 새로 추가 필요 `updateStoreTransitLocations(storeName, busTerminalIds, subwayStationIds)`
    - 현재 상태: Google Sheets 직접 쓰기

11. ⏳ `POST /api/direct/refresh-images-from-discord` - Discord에서 이미지 새로고침
    - 테이블: `direct_store_model_images`
    - DAL 메서드: 새로 추가 필요 `updateModelImages()`
    - 현재 상태: Google Sheets 직접 쓰기

---

### 우선순위 3: 재빌드 API (2개) - ✅ 이미 완료

12. ✅ `POST /api/direct/plans-master/rebuild` - 요금제 마스터 재빌드
    - 상태: Supabase 쓰기 전환 완료

13. ✅ `POST /api/direct/rebuild-master` - 통합 재빌드
    - 상태: Supabase 쓰기 전환 완료

---

### 우선순위 4: 디버그/관리 API (4개) - 낮은 우선순위

14. ⏳ `GET /api/direct/debug/link-settings` - 링크 설정 디버그
15. ⏳ `GET /api/direct/debug/rebuild-master-preview` - 재빌드 미리보기
16. ⏳ `GET /api/direct/link-settings/fetch-range` - 시트 범위 데이터 가져오기
17. ⏳ `GET /api/direct/link-settings/plan-groups` - 요금제군 목록 조회

---

### 우선순위 5: 매장별 설정 API (4개) - 낮은 우선순위

18. ⏳ `GET /api/direct/store-slideshow-settings` - 매장별 슬라이드쇼 설정 조회
19. ⏳ `POST /api/direct/store-slideshow-settings` - 매장별 슬라이드쇼 설정 저장
20. ⏳ `GET /api/direct/store-main-page-texts` - 매장별 메인페이지 문구 조회
21. ⏳ `POST /api/direct/store-main-page-texts` - 매장별 메인페이지 문구 저장

---

## 전환 전략

### Phase 1: 핵심 읽기 API 전환 (우선순위 1)
- 가장 많이 사용되는 API들
- 프론트엔드에서 직접 호출하는 API들
- 성능 개선 효과가 큰 API들

### Phase 2: 쓰기/수정 API 전환 (우선순위 2)
- 데이터 일관성이 중요한 API들
- 트랜잭션 처리가 필요한 API들

### Phase 3: 디버그/관리 API 전환 (우선순위 4)
- 개발자 도구용 API들
- 사용 빈도가 낮은 API들

### Phase 4: 매장별 설정 API 전환 (우선순위 5)
- 특정 매장에서만 사용하는 API들
- 사용 빈도가 매우 낮은 API들

---

## 필요한 DirectStoreDAL 메서드 추가 목록

### 읽기 메서드 (이미 구현됨)
- ✅ `getPolicyMargin(carrier)`
- ✅ `getPolicyAddonServices(carrier)`
- ✅ `getPolicyInsurance(carrier)`
- ✅ `getPolicySpecial(carrier)`
- ✅ `getSettings(carrier, settingType)`
- ✅ `getDeviceMaster(carrier, modelId)`
- ✅ `getModelImages(carrier, modelId)`
- ✅ `getTodaysMobiles(carrier)`
- ✅ `getDevicePricingPolicy(carrier, modelId, planGroup)`

### 쓰기/수정 메서드 (추가 필요)
- ⏳ `updatePolicyMargin(carrier, margin)` - 정책 마진 업데이트
- ⏳ `updatePolicyAddonServices(carrier, services)` - 부가서비스 정책 업데이트
- ⏳ `updatePolicyInsurance(carrier, insurances)` - 보험상품 정책 업데이트
- ⏳ `updatePolicySpecial(carrier, policies)` - 특별 정책 업데이트
- ⏳ `updateSettings(carrier, settingType, settings)` - 설정 업데이트
- ⏳ `updateModelImages(carrier, modelId, images)` - 모델 이미지 업데이트
- ⏳ `getStoreTransitLocations(storeName)` - 매장별 대중교통 위치 조회
- ⏳ `updateStoreTransitLocations(storeName, busTerminalIds, subwayStationIds)` - 매장별 대중교통 위치 업데이트

---

## 예상 작업량

- **Phase 1 (핵심 읽기 API)**: 6개 API, 약 2-3시간
- **Phase 2 (쓰기/수정 API)**: 5개 API, 약 2-3시간
- **Phase 3 (디버그/관리 API)**: 4개 API, 약 1-2시간
- **Phase 4 (매장별 설정 API)**: 4개 API, 약 1-2시간

**총 예상 작업 시간**: 6-10시간

---

**작성일**: 2026-01-25  
**작성자**: Kiro AI
