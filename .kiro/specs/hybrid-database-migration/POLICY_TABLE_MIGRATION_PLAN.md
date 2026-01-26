# 정책표 Supabase 마이그레이션 계획

## 현재 상태 (2026-01-26)

### ✅ 이미 Supabase 적용 완료
- **정책 기본정보 API** (`server/routes/policyRoutes.js`)
  - `policy_basic_info` 테이블 사용
  - 정책 생성/수정/삭제/조회
  - 정책 카테고리 관리

### ❌ Supabase 미적용 (Google Sheets만 사용)
- **정책표 관련 모든 API** (`server/policyTableRoutes.js`)
  - 약 40개 API
  - 모두 Google Sheets 직접 읽기/쓰기

---

## 정책표 API 목록 (40개)

### 1. 정책표생성설정 탭 (4개)
1. `GET /api/policy-table-settings` - 정책표 설정 조회
2. `POST /api/policy-table-settings` - 정책표 설정 생성
3. `PUT /api/policy-table-settings/:id` - 정책표 설정 수정
4. `DELETE /api/policy-table-settings/:id` - 정책표 설정 삭제

**Supabase 테이블**: `policy_table_settings`

---

### 2. 예산채널확인 탭 (4개)
5. `GET /api/budget-channel-settings` - 예산 채널 설정 조회
6. `POST /api/budget-channel-settings` - 예산 채널 설정 생성
7. `PUT /api/budget-channel-settings/:id` - 예산 채널 설정 수정
8. `DELETE /api/budget-channel-settings/:id` - 예산 채널 설정 삭제

**Supabase 테이블**: `budget_channel_settings`

---

### 3. 기본예산설정 탭 (4개)
9. `GET /api/basic-budget-settings` - 기본 예산 설정 조회
10. `POST /api/basic-budget-settings` - 기본 예산 설정 생성
11. `PUT /api/basic-budget-settings/:id` - 기본 예산 설정 수정
12. `DELETE /api/basic-budget-settings/:id` - 기본 예산 설정 삭제

**Supabase 테이블**: `budget_basic_settings`

---

### 4. 기본데이터설정 탭 (4개)
13. `GET /api/basic-data-settings` - 기본 데이터 설정 조회
14. `POST /api/basic-data-settings` - 기본 데이터 설정 생성
15. `PUT /api/basic-data-settings/:id` - 기본 데이터 설정 수정
16. `DELETE /api/basic-data-settings/:id` - 기본 데이터 설정 삭제

**Supabase 테이블**: `budget_basic_data_settings`

---

### 5. 정책영업그룹 관리 (7개)
17. `GET /api/policy-table/user-groups` - 정책영업그룹 조회
18. `POST /api/policy-table/user-groups` - 정책영업그룹 생성
19. `PUT /api/policy-table/user-groups/:id` - 정책영업그룹 수정
20. `DELETE /api/policy-table/user-groups/:id` - 정책영업그룹 삭제
21. `GET /api/policy-table/user-groups/:id/change-history` - 변경 이력 조회
22. `PUT /api/policy-table/user-groups/:id/change-history/:changeId/apply-phone` - 폰클 적용
23. `PUT /api/policy-table/user-groups/:id/phone-register` - 폰클 등록

**Supabase 테이블**: `policy_user_groups`, `policy_group_change_history`

---

### 6. 업체명 관리 (1개)
24. `GET /api/policy-table/companies` - 업체명 목록 조회

**Supabase 테이블**: 새로 추가 필요 `policy_companies`

---

### 7. 정책표 생성 (3개)
25. `POST /api/policy-table/generate` - 정책표 생성 (이미지 생성 포함)
26. `GET /api/policy-table/queue-status` - 큐 상태 조회
27. `GET /api/policy-table/generate/:jobId/status` - 작업 상태 조회

**Supabase 테이블**: `policy_table_list`, Discord 연동

---

### 8. 정책표목록 탭 (11개)
28. `GET /api/policy-tables/tabs` - 정책표 탭 목록 조회
29. `GET /api/policy-tables` - 정책표 목록 조회
30. `POST /api/policy-tables/:id/register` - 정책표 등록
31. `GET /api/policy-tables/:id` - 정책표 상세 조회
32. `POST /api/policy-tables/:id/refresh-image` - 정책표 이미지 새로고침
33. `GET /api/policy-tables/:id/download-excel` - 정책표 엑셀 다운로드
34. `GET /api/policy-tables/tabs/order` - 탭 순서 조회
35. `PUT /api/policy-tables/tabs/order` - 탭 순서 저장
36. `PUT /api/policy-tables/:id` - 정책표 수정
37. `DELETE /api/policy-tables/:id` - 정책표 삭제
38. `POST /api/policy-tables/:id/view` - 정책표 확인이력 기록

**Supabase 테이블**: `policy_table_list`, `policy_tab_order`

---

### 9. 기본 그룹 설정 (2개)
39. `GET /api/policy-table/default-groups/:userId` - 사용자 기본 그룹 조회
40. `PUT /api/policy-table/default-groups/:userId` - 사용자 기본 그룹 저장

**Supabase 테이블**: `policy_default_groups`

---

### 10. 기타정책 관리 (2개)
41. `GET /api/policy-table/other-policy-types` - 기타정책 목록 조회
42. `POST /api/policy-table/other-policy-types` - 기타정책 추가

**Supabase 테이블**: `policy_other_types`

---

## Supabase 스키마 현황

### ✅ 이미 생성된 테이블 (11개)
1. `policy_basic_info` - 정책 기본정보 ⭐ 이미 사용 중
2. `policy_table_settings` - 정책표 설정
3. `policy_table_list` - 정책표 목록
4. `policy_user_groups` - 정책영업그룹
5. `policy_tab_order` - 탭 순서
6. `policy_group_change_history` - 변경 이력
7. `policy_default_groups` - 기본 그룹
8. `policy_other_types` - 기타정책
9. `budget_channel_settings` - 예산 채널 설정
10. `budget_basic_settings` - 기본 예산 설정
11. `budget_basic_data_settings` - 기본 데이터 설정

### ⏳ 추가 필요한 테이블 (1개)
12. `policy_companies` - 업체명 목록

---

## 마이그레이션 전략

### Phase 1: 설정 관리 API (우선순위 높음) - 16개
- 정책표생성설정 (4개)
- 예산채널확인 (4개)
- 기본예산설정 (4개)
- 기본데이터설정 (4개)

**특징**: CRUD 패턴이 명확하고 단순함

---

### Phase 2: 그룹 및 기본 데이터 API (우선순위 중간) - 12개
- 정책영업그룹 관리 (7개)
- 기본 그룹 설정 (2개)
- 기타정책 관리 (2개)
- 업체명 관리 (1개)

**특징**: 변경 이력 관리 포함

---

### Phase 3: 정책표 생성 및 목록 API (우선순위 높음) - 14개
- 정책표 생성 (3개)
- 정책표목록 탭 (11개)

**특징**: Discord 연동, 이미지 생성, 복잡한 비즈니스 로직

---

## 마이그레이션 방법

### 1. DAL 패턴 적용
```javascript
// server/dal/PolicyTableDAL.js 생성
class PolicyTableDAL {
  constructor(dal) {
    this.dal = dal;
  }

  // 정책표 설정
  async getPolicyTableSettings() { ... }
  async createPolicyTableSetting(data) { ... }
  async updatePolicyTableSetting(id, data) { ... }
  async deletePolicyTableSetting(id) { ... }

  // 예산 채널 설정
  async getBudgetChannelSettings() { ... }
  async createBudgetChannelSetting(data) { ... }
  // ... 등등
}
```

### 2. 라우트 수정
```javascript
// server/policyTableRoutes.js
const { DALFactory } = require('./dal/DALFactory');
const PolicyTableDAL = require('./dal/PolicyTableDAL');

const dal = DALFactory.create();
const policyTableDAL = new PolicyTableDAL(dal);

router.get('/policy-table-settings', async (req, res) => {
  try {
    const settings = await policyTableDAL.getPolicyTableSettings();
    res.json(settings);
  } catch (error) {
    // 에러 처리
  }
});
```

### 3. 마이그레이션 스크립트
```javascript
// server/migration/migrate-policy-table.js
// Google Sheets → Supabase 데이터 마이그레이션
```

---

## 예상 작업량

- **Phase 1 (설정 관리 API)**: 16개 API, 약 3-4시간
- **Phase 2 (그룹 및 기본 데이터 API)**: 12개 API, 약 3-4시간
- **Phase 3 (정책표 생성 및 목록 API)**: 14개 API, 약 4-5시간

**총 예상 작업 시간**: 10-13시간

---

## 마이그레이션 실행 명령어

### 로컬 환경
```bash
# 1. 스키마 생성 (이미 완료)
node server/migration/executeSchema.js

# 2. 데이터 마이그레이션
node server/migration/migrate-policy-table.js

# 3. 검증
node server/test-policy-table-migration.js
```

### 클라우드타입 환경
```bash
# SSH 접속 후
cd /app
node server/migration/migrate-policy-table.js
```

---

## 주의사항

1. **Discord 연동 유지**: 정책표 이미지 생성 시 Discord API 사용
2. **Google Sheets 병행**: 마이그레이션 완료 전까지 Google Sheets 읽기 유지
3. **캐시 무효화**: 정책표 변경 시 캐시 무효화 로직 유지
4. **권한 체크**: SS, S, 팀장 권한 체크 로직 유지
5. **변경 이력**: 정책영업그룹 변경 시 이력 자동 기록

---

**작성일**: 2026-01-26  
**작성자**: Kiro AI
