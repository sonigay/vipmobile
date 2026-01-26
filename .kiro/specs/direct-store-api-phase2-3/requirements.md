# 직영점 모드 API 전환 Phase 2-3 요구사항

## 프로젝트 개요

**목표**: 직영점 모드의 남은 API들을 완전한 CRUD로 전환하여 Supabase와 Google Sheets 간 자동 전환 가능하도록 구현

**배경**:
- Phase 1 완료: 15개 API 전환 (읽기 위주)
- **문제점**: Phase 1에서 읽기만 구현되어 쓰기/수정/삭제가 누락됨
- **해결책**: 모든 API에 대해 완전한 CRUD 구현
- Feature Flag: `USE_DB_DIRECT_STORE=true`

## Phase 1 API 보완 필요 사항

### 보완-1: 정책 설정 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/policy-settings` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/policy-settings` - 정책 설정 저장 (전체 교체)
- `PUT /api/direct/policy-settings/:carrier` - 정책 설정 수정
- `DELETE /api/direct/policy-settings/:carrier` - 정책 설정 삭제
- `DELETE /api/direct/policy-settings/:carrier/addon/:serviceName` - 특정 부가서비스 삭제
- `DELETE /api/direct/policy-settings/:carrier/insurance/:productName` - 특정 보험상품 삭제
- `DELETE /api/direct/policy-settings/:carrier/special/:policyName` - 특정 특별정책 삭제

### 보완-2: 링크 설정 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/link-settings` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/link-settings` - 링크 설정 저장
- `PUT /api/direct/link-settings/:carrier/:settingType` - 링크 설정 수정
- `DELETE /api/direct/link-settings/:carrier/:settingType` - 링크 설정 삭제

### 보완-3: 메인 페이지 문구 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/main-page-texts` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/main-page-texts` - 메인 페이지 문구 저장
- `PUT /api/direct/main-page-texts/:carrier/:category/:type` - 문구 수정
- `DELETE /api/direct/main-page-texts/:carrier/:category/:type` - 문구 삭제

### 보완-4: 요금제 마스터 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/plans-master` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/plans-master` - 요금제 마스터 저장
- `PUT /api/direct/plans-master/:carrier/:planName` - 요금제 수정
- `DELETE /api/direct/plans-master/:carrier/:planName` - 요금제 삭제

### 보완-5: 단말 마스터 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/mobiles-master` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/mobiles-master` - 단말 마스터 저장
- `PUT /api/direct/mobiles-master/:carrier/:modelId` - 단말 정보 수정
- `DELETE /api/direct/mobiles-master/:carrier/:modelId` - 단말 삭제

### 보완-6: 단말 요금 정책 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/mobiles-pricing` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/mobiles-pricing` - 단말 요금 정책 저장
- `PUT /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup` - 요금 정책 수정
- `DELETE /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup` - 요금 정책 삭제

### 보완-7: 오늘의 휴대폰 API (읽기만 완료 → CRUD 완성)
**현재 상태**: `GET /api/direct/todays-mobiles` 만 구현됨 ✅  
**필요 작업**:
- `POST /api/direct/todays-mobiles` - 오늘의 휴대폰 추가
- `PUT /api/direct/todays-mobiles/:modelName/:carrier` - 오늘의 휴대폰 수정
- `DELETE /api/direct/todays-mobiles/:modelName/:carrier` - 오늘의 휴대폰 삭제

## 사용자 스토리

### US-1: 정책 설정 완전한 CRUD (우선순위: 최고)
**As a** 시스템 관리자  
**I want** 정책 설정의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** Feature Flag만 변경하면 Supabase와 Google Sheets를 자동으로 전환할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/policy-settings?carrier=SK` - 정책 설정 조회
   - 마진, 부가서비스, 보험상품, 특별정책 모두 조회
   
2. **쓰기 (신규)**:
   - `POST /api/direct/policy-settings` - 정책 설정 저장 (전체 교체)
   - Request Body: `{ carrier, margin, addonServices[], insurances[], specialPolicies[] }`
   - Feature Flag에 따라 Supabase 또는 Google Sheets에 저장
   - 기존 데이터 삭제 후 새 데이터 삽입
   
3. **수정 (신규)**:
   - `PUT /api/direct/policy-settings/:carrier` - 정책 설정 수정
   - Request Body: `{ margin?, addonServices[]?, insurances[]?, specialPolicies[]? }`
   - 부분 업데이트 지원
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/policy-settings/:carrier` - 전체 정책 삭제
   - `DELETE /api/direct/policy-settings/:carrier/addon/:serviceName` - 특정 부가서비스 삭제
   - `DELETE /api/direct/policy-settings/:carrier/insurance/:productName` - 특정 보험상품 삭제
   - `DELETE /api/direct/policy-settings/:carrier/special/:policyName` - 특정 특별정책 삭제

### US-2: 링크 설정 완전한 CRUD (우선순위: 최고)
**As a** 시스템 관리자  
**I want** 링크 설정의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** 외부 시트 연동 설정을 유연하게 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/link-settings?carrier=SK` - 링크 설정 조회
   - 설정 유형별로 조회 (policy, support, planGroup 등)
   
2. **쓰기 (신규)**:
   - `POST /api/direct/link-settings` - 링크 설정 저장
   - Request Body: `{ carrier, settingType, sheetId, sheetUrl, settings }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/link-settings/:carrier/:settingType` - 링크 설정 수정
   - Request Body: `{ sheetId?, sheetUrl?, settings? }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/link-settings/:carrier/:settingType` - 특정 설정 삭제

### US-3: 메인 페이지 문구 완전한 CRUD (우선순위: 높음)
**As a** 매장 관리자  
**I want** 메인 페이지 문구의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** 메인 페이지 문구를 유연하게 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/main-page-texts?carrier=SK` - 메인 페이지 문구 조회
   
2. **쓰기 (신규)**:
   - `POST /api/direct/main-page-texts` - 메인 페이지 문구 저장
   - Request Body: `{ carrier, category, type, content, imageUrl }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/main-page-texts/:carrier/:category/:type` - 문구 수정
   - Request Body: `{ content?, imageUrl? }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/main-page-texts/:carrier/:category/:type` - 특정 문구 삭제

### US-4: 요금제 마스터 완전한 CRUD (우선순위: 높음)
**As a** 시스템 관리자  
**I want** 요금제 마스터의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** 요금제 정보를 유연하게 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/plans-master?carrier=SK` - 요금제 마스터 조회
   
2. **쓰기 (신규)**:
   - `POST /api/direct/plans-master` - 요금제 마스터 저장
   - Request Body: `{ carrier, planName, planGroup, basicFee, planCode, isActive, note }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/plans-master/:carrier/:planName` - 요금제 수정
   - Request Body: `{ planGroup?, basicFee?, planCode?, isActive?, note? }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/plans-master/:carrier/:planName` - 요금제 삭제

### US-5: 단말 마스터 완전한 CRUD (우선순위: 높음)
**As a** 시스템 관리자  
**I want** 단말 마스터의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** 단말 정보를 유연하게 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/mobiles-master?carrier=SK` - 단말 마스터 조회
   
2. **쓰기 (신규)**:
   - `POST /api/direct/mobiles-master` - 단말 마스터 저장
   - Request Body: `{ carrier, modelId, modelName, petName, manufacturer, factoryPrice, ... }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/mobiles-master/:carrier/:modelId` - 단말 정보 수정
   - Request Body: `{ modelName?, petName?, factoryPrice?, isPremium?, isBudget?, ... }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/mobiles-master/:carrier/:modelId` - 단말 삭제

### US-6: 단말 요금 정책 완전한 CRUD (우선순위: 높음)
**As a** 시스템 관리자  
**I want** 단말 요금 정책의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** 요금 정책을 유연하게 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/mobiles-pricing?carrier=SK` - 단말 요금 정책 조회
   
2. **쓰기 (신규)**:
   - `POST /api/direct/mobiles-pricing` - 단말 요금 정책 저장
   - Request Body: `{ carrier, modelId, planGroup, openingType, publicSupport, ... }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup` - 요금 정책 수정
   - Request Body: `{ publicSupport?, storeAdditionalSupportWithAddon?, policyMargin?, ... }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup` - 요금 정책 삭제

### US-7: 오늘의 휴대폰 완전한 CRUD (우선순위: 중간)
**As a** 매장 관리자  
**I want** 오늘의 휴대폰의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** 오늘의 휴대폰을 유연하게 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 조회
   
2. **쓰기 (신규)**:
   - `POST /api/direct/todays-mobiles` - 오늘의 휴대폰 추가
   - Request Body: `{ modelName, carrier, isPremium, isBudget, isPopular, ... }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/todays-mobiles/:modelName/:carrier` - 오늘의 휴대폰 수정
   - Request Body: `{ isPremium?, isBudget?, isPopular?, isRecommended?, isCheap? }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/todays-mobiles/:modelName/:carrier` - 오늘의 휴대폰 삭제

### US-8: 모델 이미지 완전한 CRUD (우선순위: 중간)
**As a** 시스템 관리자  
**I want** 모델 이미지의 읽기/쓰기/수정/삭제를 모두 DAL로 전환  
**So that** Discord에서 이미지를 새로고침하거나 수동으로 관리할 수 있다

**인수 기준**:
1. **읽기 (이미 완료 ✅)**:
   - `GET /api/direct/mobiles-master` - 단말 마스터 조회 (이미지 포함)
   
2. **쓰기 (신규)**:
   - `POST /api/direct/refresh-images-from-discord` - Discord에서 이미지 새로고침
   - `POST /api/direct/model-images` - 모델 이미지 추가
   - Request Body: `{ carrier, modelId, imageUrl, discordMessageId, discordThreadId }`
   
3. **수정 (신규)**:
   - `PUT /api/direct/model-images/:carrier/:modelId` - 특정 모델 이미지 수정
   - Request Body: `{ imageUrl?, discordMessageId?, discordThreadId? }`
   
4. **삭제 (신규)**:
   - `DELETE /api/direct/model-images/:carrier/:modelId` - 특정 모델 이미지 삭제

### US-9: 복잡한 읽기 API 전환 (우선순위: 중간)
**As a** 직영점 사용자  
**I want** 휴대폰 목록 조회 시 이미지/태그 데이터를 Supabase에서 읽기  
**So that** 성능이 개선되고 데이터 일관성이 유지된다

**인수 기준**:
1. `GET /api/direct/mobiles` - 휴대폰 목록 조회
   - 이미지/태그 데이터만 Supabase에서 읽기
   - 외부 시트 읽기 로직은 유지 (정책표, 이통사지원금)
   - 계산 로직은 그대로 유지
   
2. `GET /api/direct/mobiles/:modelId/calculate` - 요금제별 대리점지원금 계산
   - 정책 데이터를 Supabase에서 읽기
   - 계산 로직은 그대로 유지

## 비기능 요구사항

### NFR-1: 성능
- API 응답 시간: Supabase 사용 시 80-95% 단축
- 캐시 TTL: 5분 (신선한 상태), 30분 (만료되었지만 사용 가능)
- Rate Limit 에러 처리: 최대 5회 재시도, Exponential backoff

### NFR-2: 호환성
- 기존 프론트엔드 코드 수정 없이 동작
- Feature Flag만 변경하면 Supabase ↔ Google Sheets 자동 전환
- Google Sheets 폴백 지원 (Supabase 실패 시)

### NFR-3: 데이터 일관성
- 쓰기 작업 시 트랜잭션 보장
- 전체 교체 방식 (기존 데이터 삭제 후 새 데이터 삽입)
- 에러 발생 시 롤백

### NFR-4: 로깅 및 모니터링
- 모든 DAL 작업 로깅
- 성능 메트릭 수집 (소요 시간, 데이터 개수)
- 에러 추적 및 알림

## 제약사항

1. **외부 시트 읽기 유지**: 정책표, 이통사지원금 시트는 Google Sheets에서 계속 읽기
2. **계산 로직 유지**: 복잡한 계산 로직은 수정하지 않음
3. **프론트엔드 수정 금지**: 서버만 수정
4. **한글 컬럼명**: PostgreSQL에서 큰따옴표 필요 (`SELECT "통신사" FROM table`)

## 우선순위

### Phase 1 보완 (최우선)
1. 정책 설정 CRUD 완성
2. 링크 설정 CRUD 완성
3. 메인 페이지 문구 CRUD 완성
4. 요금제 마스터 CRUD 완성
5. 단말 마스터 CRUD 완성
6. 단말 요금 정책 CRUD 완성
7. 오늘의 휴대폰 CRUD 완성

### Phase 2 (중간 우선순위)
8. 복잡한 읽기 API 전환 (2개)

### Phase 3 (낮은 우선순위)
9. 디버그/관리 API (4개)
10. 매장별 설정 API (4개)

## 성공 기준

- [ ] Phase 1 보완 완료: 7개 API 그룹의 CRUD 완성
- [ ] Phase 2 완료: 2개 복잡한 읽기 API 전환
- [ ] Phase 3 완료: 8개 디버그/관리/매장별 설정 API 전환
- [ ] 전체 API CRUD 완성률: 100%
- [ ] 성능 개선: 평균 80% 이상 응답 시간 단축
- [ ] 에러율: 1% 미만
- [ ] Feature Flag 전환 시 정상 동작 확인

## Phase 0: 재빌드 및 스케줄러 검증

### 1.1: 재빌드 함수 Supabase 쓰기 검증
**현재 상태**: `rebuildPlanMaster()`, `rebuildDeviceMaster()`, `rebuildPricingMaster()` 함수가 Supabase 쓰기를 지원하도록 구현됨  
**검증 필요**:
- Feature Flag `USE_DB_DIRECT_STORE=true` 설정 시 Supabase에 데이터 쓰기 확인
- Feature Flag `USE_DB_DIRECT_STORE=false` 설정 시 Google Sheets에 데이터 쓰기 확인 (폴백)
- 직영점관리모드의 "데이터 재빌드" 버튼 테스트 (SK, KT, LG, 전체)

### 1.2: 스케줄러 복원
**현재 상태**: 원본 파일(`server/index.js.backup.original`)에는 스케줄러가 있었으나 현재 `server/index.js`에는 없음  
**복원 필요**:
- Discord 이미지 자동 갱신 스케줄 (매일 03:30, 07:30, 11:30, 17:30, 20:30, 23:30, 타임존: Asia/Seoul)
- 데이터 재빌드 스케줄 (매일 11:10-19:10 매시간, 타임존: Asia/Seoul)
- 서버 시작 시 초기 실행 (Discord 이미지 갱신, 데이터 재빌드)
- `refreshAllDiscordImages()` 함수 구현 (모든 통신사 이미지 갱신, 에러 핸들링, Discord 알림)
- `rebuildMasterData()` 함수 구현 (모든 통신사 마스터 데이터 재빌드, 에러 핸들링, Discord 알림)

### 1.3: 시세표 갱신 버튼 테스트
**현재 상태**: 직영점관리모드에 "시세표 갱신하기" 버튼이 있음  
**테스트 필요**:
- Discord에서 이미지 URL 가져오기 확인
- `직영점_모델이미지` 테이블 업데이트 확인
- 시세표에서 이미지 표시 확인

### 1.4: 스케줄러 동작 확인
**검증 필요**:
- Discord 이미지 자동 갱신 스케줄 실행 로그 확인
- 데이터 재빌드 스케줄 실행 로그 확인
- Supabase 데이터 업데이트 확인

### 1.5: 성능 최적화 - Google Sheets Rate Limit 로직 제거
**문제점**: Supabase로 전환된 API들이 여전히 Google Sheets Rate Limit 로직을 사용하여 버튼 반응 속도가 느림  
**원인**:
- `MIN_API_INTERVAL_MS = 500` (최소 0.5초 간격)
- `MAX_CONCURRENT_SHEETS_REQUESTS = 5` (동시 요청 수 제한)
- `withRetry()` 함수의 Exponential backoff (2초 기본 딜레이)
- `sheetsRequestQueue` 큐 시스템

**해결책**:
- Supabase를 사용하는 API에서는 Rate Limit 로직 제거
- `withRetry()` 함수를 Supabase용과 Google Sheets용으로 분리
- Supabase용: 딜레이 없음, 재시도만 지원 (네트워크 에러 대응)
- Google Sheets용: 기존 Rate Limit 로직 유지

**영향 범위**:
- `GET /api/direct/policy-settings` - 정책 설정 조회
- `GET /api/direct/link-settings` - 링크 설정 조회
- `GET /api/direct/main-page-texts` - 메인 페이지 문구 조회
- `GET /api/direct/plans-master` - 요금제 마스터 조회
- `GET /api/direct/mobiles-master` - 단말 마스터 조회
- `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 조회
- `GET /api/direct/transit-locations` - 대중교통 위치 조회
- `POST /api/direct/transit-locations` - 대중교통 위치 저장

### 1.6: 시세표 이미지 로드 문제 수정
**문제점**: 시세표에서 모델 이미지가 로드되지 않음  
**원인 파악 필요**:
- 원본 로직 (`server/index.js.backup.original` line 6288-6400) 분석
- 현재 로직 (`server/directRoutes.js` line 4900-5100, `getMobileList()` 함수) 분석
- 차이점 파악 및 문제 원인 규명

**수정 필요**:
- `getMobileList()` 함수의 이미지 매핑 로직 수정
- 이미지 URL 정규화 로직 확인
- Discord 메시지 ID 매핑 확인

## 참고 문서

- `server/dal/DirectStoreDAL.js` - DirectStoreDAL 헬퍼 클래스
- `server/directRoutes.js` - 직영점 API 라우트
- `server/index.js.backup.original` - 원본 로직 참고용
- `.kiro/specs/hybrid-database-migration/API_CONVERSION_PHASE1_COMPLETE.md` - Phase 1 완료 상태
- `.kiro/specs/hybrid-database-migration/REMAINING_APIS.md` - 남은 API 목록

## Phase 1: Phase 1 보완 - 읽기 전용 API에 쓰기/수정/삭제 추가

### US-2: Phase 2 - 복잡한 읽기 API 전환 (우선순위 중간)
**As a** 직영점 사용자  
**I want** 휴대폰 목록 조회 시 이미지/태그 데이터를 Supabase에서 읽기  
**So that** 성능이 개선되고 데이터 일관성이 유지된다

**인수 기준**:
1. `GET /api/direct/mobiles` - 휴대폰 목록 조회
   - 이미지/태그 데이터만 Supabase에서 읽기
   - 외부 시트 읽기 로직은 유지 (정책표, 이통사지원금)
   - 계산 로직은 그대로 유지
   - Feature Flag에 따라 Supabase 또는 Google Sheets 자동 전환
   
2. `GET /api/direct/mobiles/:modelId/calculate` - 요금제별 대리점지원금 계산
   - 정책 데이터를 Supabase에서 읽기
   - 계산 로직은 그대로 유지
   - Feature Flag에 따라 Supabase 또는 Google Sheets 자동 전환

### US-3: Phase 4 - 디버그/관리 API 전환 (우선순위 낮음)
**As a** 개발자  
**I want** 디버그 및 관리 API를 DAL로 전환  
**So that** 개발 및 디버깅 시 일관된 데이터 접근 방식을 사용할 수 있다

**인수 기준**:
1. `GET /api/direct/debug/link-settings` - 링크 설정 디버그
2. `GET /api/direct/debug/rebuild-master-preview` - 재빌드 미리보기
3. `GET /api/direct/link-settings/fetch-range` - 시트 범위 데이터 가져오기
4. `GET /api/direct/link-settings/plan-groups` - 요금제군 목록 조회

### US-4: Phase 5 - 매장별 설정 API 전환 (우선순위 낮음)
**As a** 매장 관리자  
**I want** 매장별 설정 API를 DAL로 전환  
**So that** 매장별 커스터마이징이 가능하다

**인수 기준**:
1. `GET /api/direct/store-slideshow-settings` - 매장별 슬라이드쇼 설정 조회
2. `POST /api/direct/store-slideshow-settings` - 매장별 슬라이드쇼 설정 저장
3. `GET /api/direct/store-main-page-texts` - 매장별 메인페이지 문구 조회
4. `POST /api/direct/store-main-page-texts` - 매장별 메인페이지 문구 저장

## 비기능 요구사항

### NFR-1: 성능
- API 응답 시간: Supabase 사용 시 80-95% 단축
- 캐시 TTL: 5분 (신선한 상태), 30분 (만료되었지만 사용 가능)
- Rate Limit 에러 처리: 최대 5회 재시도, Exponential backoff

### NFR-2: 호환성
- 기존 프론트엔드 코드 수정 없이 동작
- Feature Flag만 변경하면 Supabase ↔ Google Sheets 자동 전환
- Google Sheets 폴백 지원 (Supabase 실패 시)

### NFR-3: 데이터 일관성
- 쓰기 작업 시 트랜잭션 보장
- 전체 교체 방식 (기존 데이터 삭제 후 새 데이터 삽입)
- 에러 발생 시 롤백

### NFR-4: 로깅 및 모니터링
- 모든 DAL 작업 로깅
- 성능 메트릭 수집 (소요 시간, 데이터 개수)
- 에러 추적 및 알림

## 제약사항

1. **외부 시트 읽기 유지**: 정책표, 이통사지원금 시트는 Google Sheets에서 계속 읽기
2. **계산 로직 유지**: 복잡한 계산 로직은 수정하지 않음
3. **프론트엔드 수정 금지**: 서버만 수정
4. **한글 컬럼명**: PostgreSQL에서 큰따옴표 필요 (`SELECT "통신사" FROM table`)

## 우선순위

1. **Phase 3**: 쓰기/수정 API (4개) - 가장 중요
2. **Phase 2**: 복잡한 읽기 API (2개) - 중간 중요도
3. **Phase 4**: 디버그/관리 API (4개) - 낮은 우선순위
4. **Phase 5**: 매장별 설정 API (4개) - 가장 낮은 우선순위

## 성공 기준

- [ ] Phase 3 완료: 4개 쓰기/수정 API 전환
- [ ] Phase 2 완료: 2개 복잡한 읽기 API 전환
- [ ] Phase 4 완료: 4개 디버그/관리 API 전환
- [ ] Phase 5 완료: 4개 매장별 설정 API 전환
- [ ] 전체 API 전환율: 100% (28개 / 28개)
- [ ] 성능 개선: 평균 80% 이상 응답 시간 단축
- [ ] 에러율: 1% 미만
- [ ] Feature Flag 전환 시 정상 동작 확인

## 참고 문서

- `server/dal/DirectStoreDAL.js` - DirectStoreDAL 헬퍼 클래스
- `server/directRoutes.js` - 직영점 API 라우트
- `.kiro/specs/hybrid-database-migration/API_CONVERSION_PHASE1_COMPLETE.md` - Phase 1 완료 상태
- `.kiro/specs/hybrid-database-migration/REMAINING_APIS.md` - 남은 API 목록
