# DAL 전환 현황

## 개요

Google Sheets 기반 API를 DAL(Data Access Layer)로 전환하여 Supabase와 Google Sheets를 자동으로 전환할 수 있도록 개선하는 작업입니다.

**목표:** Feature Flag(`USE_DB_*`)만 변경하면 데이터 소스를 즉시 전환할 수 있도록 함

---

## 완료된 작업

### 1. 정책모드 (Policy Mode)

#### 데이터 마이그레이션
- ✅ `policy_basic_info` 테이블 스키마 생성
- ✅ 1,235개 정책 데이터 마이그레이션 완료 (성공률 100%)
- ✅ Feature Flag: `USE_DB_POLICY=true`

#### API 전환
- ✅ `GET /api/policies` - 정책 목록 조회
  - Supabase 우선 사용
  - 실패 시 Google Sheets 폴백

**파일:**
- `server/database/schema-policy.sql`
- `server/migration/migrate-policy-basic-info.js`
- `server/routes/policyRoutes.js`

---

### 2. 직영점모드 (Direct Store Mode)

#### 데이터 마이그레이션
- ✅ 14개 테이블 스키마 생성
- ✅ 3,739개 레코드 마이그레이션 완료 (성공률 99.97%)
- ✅ Feature Flag: `USE_DB_DIRECT_STORE=true`

#### API 전환 (일부)
- ✅ `GET /api/direct/transit-location/all` - 대중교통 위치 조회
- ✅ `GET /api/direct/main-page-texts` - 메인 페이지 문구 조회

**파일:**
- `server/database/schema-direct-store.sql`
- `server/directRoutes.js` (8000+ 줄, 일부만 전환됨)

---

### 3. 고객모드 (Customer Mode)

#### 데이터 마이그레이션
- ✅ 4개 테이블 스키마 생성
- ✅ 데이터 마이그레이션 완료
- ✅ Feature Flag: `USE_DB_CUSTOMER=true`

#### API 전환
- ⏳ 대기 중 (API 전환 필요)

**파일:**
- `server/database/schema-customer.sql`

---

## 진행 중인 작업

### 직영점모드 나머지 API 전환

직영점모드는 매우 복잡한 비즈니스 로직을 포함하고 있어 단계적으로 전환 중입니다.

**우선순위 높은 API:**
1. `GET /api/direct/todays-mobiles` - 오늘의 휴대폰 (메인 화면)
2. `GET /api/direct/mobiles` - 휴대폰 목록
3. `GET /api/direct/policy-settings` - 정책 설정
4. `GET /api/direct/mobiles/:modelId/calculate` - 가격 계산
5. `PUT /api/direct/mobiles/:modelId/tags` - 태그 업데이트

**복잡도:**
- 직영점 API는 8000+ 줄의 복잡한 로직 포함
- Google Sheets에서 여러 시트를 조합하여 데이터 생성
- 실시간 계산 로직 포함

---

## 아키텍처

### DAL Factory 패턴

```javascript
const dalFactory = require('./dal/DALFactory');

// Feature Flag에 따라 자동으로 구현체 선택
const dal = dalFactory.getDAL('policy'); // 또는 'direct-store', 'customer'

// 데이터 조회 (Supabase 또는 Google Sheets)
const data = await dal.read('policy_basic_info', { "대상년월": "2025-01" });
```

### Feature Flags

`.env` 파일에서 설정:

```env
USE_DB_POLICY=true           # 정책모드: Supabase 사용
USE_DB_DIRECT_STORE=true     # 직영점모드: Supabase 사용
USE_DB_CUSTOMER=true         # 고객모드: Supabase 사용
```

`false`로 설정하면 Google Sheets 사용

---

## 다음 단계

### 1. 직영점모드 주요 API 전환
- [ ] `GET /api/direct/todays-mobiles`
- [ ] `GET /api/direct/mobiles`
- [ ] `GET /api/direct/policy-settings`
- [ ] `GET /api/direct/mobiles/:modelId/calculate`
- [ ] `PUT /api/direct/mobiles/:modelId/tags`

### 2. 고객모드 API 전환
- [ ] 고객모드 관련 엔드포인트 파악
- [ ] DAL 전환 작업

### 3. 성능 테스트
- [ ] Supabase vs Google Sheets 성능 비교
- [ ] 로딩 시간 측정
- [ ] 캐시 전략 최적화

### 4. 배포 및 모니터링
- [ ] 클라우드타입 재배포
- [ ] 프로덕션 환경에서 Feature Flag 테스트
- [ ] 에러 모니터링

---

## 기술 스택

- **데이터베이스:** Supabase (PostgreSQL)
- **기존 데이터 소스:** Google Sheets API
- **DAL 패턴:** Factory Pattern + Strategy Pattern
- **Feature Flag:** 환경 변수 기반

---

## 참고 문서

- `server/DAL_INTEGRATION_GUIDE.md` - DAL 통합 가이드
- `server/DAL_TEST_GUIDE.md` - DAL 테스트 가이드
- `server/database/SCHEMA_DESIGN_DETAILED.md` - 스키마 설계 상세
- `.kiro/specs/hybrid-database-migration/` - 마이그레이션 스펙

---

**최종 업데이트:** 2025-01-25
**작성자:** Kiro AI
