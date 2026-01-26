# Google Sheets → Supabase 데이터 마이그레이션 명령어

## 📋 개요

모든 Google Sheets 데이터를 Supabase로 마이그레이션하는 명령어입니다.
**Supabase에 테이블이 존재하는 것만 자동으로 업데이트**됩니다.

---

## 🚀 기본 사용법

### 1. 전체 마이그레이션 (모든 카테고리)

```bash
node server/migration/migrate-all-sheets-to-supabase.js
```

**마이그레이션 대상**:
- ✅ 정책 모드 (11개 테이블)
- ✅ 직영점 모드 (KT/LG/SK 각 6개 테이블 = 18개)
- ✅ 고객 모드 (2개 테이블)
- ✅ 마스터 데이터 (3개 테이블)

**총 34개 테이블** (Supabase에 존재하는 것만 업데이트)

---

### 2. 미리보기 (Dry Run)

실제 데이터 변경 없이 마이그레이션 시뮬레이션:

```bash
node server/migration/migrate-all-sheets-to-supabase.js --dry-run
```

**출력 예시**:
```
📂 [1/4] 정책 모드 마이그레이션 시작...
   📄 정책_기본정보 → policy_basic_info
   📊 150개 행 발견
   [DRY-RUN] 150개 행을 policy_basic_info에 삽입 예정
   ✅ 150개 행 마이그레이션 완료
```

---

### 3. 특정 카테고리만 마이그레이션

#### 정책 모드만
```bash
node server/migration/migrate-all-sheets-to-supabase.js --only=policy
```

#### 직영점 모드만
```bash
node server/migration/migrate-all-sheets-to-supabase.js --only=direct-store
```

#### 고객 모드만
```bash
node server/migration/migrate-all-sheets-to-supabase.js --only=customer
```

#### 마스터 데이터만
```bash
node server/migration/migrate-all-sheets-to-supabase.js --only=master
```

---

### 4. 강제 덮어쓰기

기존 데이터를 강제로 덮어쓰기:

```bash
node server/migration/migrate-all-sheets-to-supabase.js --force
```

---

## 📊 마이그레이션 대상 상세

### 1. 정책 모드 (11개 테이블)

| Google Sheets 시트명 | Supabase 테이블명 | 상태 |
|---------------------|-------------------|------|
| 정책_기본정보 | `policy_basic_info` | ✅ 테이블 존재 |
| 정책모드_정책표설정 | `policy_table_settings` | ✅ 테이블 존재 |
| 정책모드_정책표목록 | `policy_table_list` | ✅ 테이블 존재 |
| 정책모드_일반사용자그룹 | `policy_user_groups` | ✅ 테이블 존재 |
| 정책표목록_탭순서 | `policy_tab_order` | ✅ 테이블 존재 |
| 정책모드_정책영업그룹_변경이력 | `policy_group_change_history` | ✅ 테이블 존재 |
| 정책모드_기본정책영업그룹 | `policy_default_groups` | ✅ 테이블 존재 |
| 정책모드_기타정책목록 | `policy_other_types` | ✅ 테이블 존재 |
| 예산모드_예산채널설정 | `budget_channel_settings` | ✅ 테이블 존재 |
| 예산모드_기본예산설정 | `budget_basic_settings` | ✅ 테이블 존재 |
| 예산모드_기본데이터설정 | `budget_basic_data_settings` | ✅ 테이블 존재 |

---

### 2. 직영점 모드 (18개 테이블)

각 통신사(KT, LG, SK)별로 6개 시트:

| Google Sheets 시트명 | Supabase 테이블명 | 상태 |
|---------------------|-------------------|------|
| {통신사}_직영점_요금제마스터 | `direct_store_plan_master` | ✅ 테이블 존재 |
| {통신사}_직영점_단말마스터 | `direct_store_device_master` | ✅ 테이블 존재 |
| {통신사}_직영점_단말요금정책 | `direct_store_device_pricing_policy` | ✅ 테이블 존재 |
| {통신사}_직영점_모델이미지 | `direct_store_model_images` | ✅ 테이블 존재 |
| {통신사}_직영점_오늘의휴대폰 | `direct_store_todays_mobiles` | ✅ 테이블 존재 |
| {통신사}_직영점_메인페이지문구 | `direct_store_main_page_texts` | ✅ 테이블 존재 |

**예시**: `KT_직영점_요금제마스터`, `LG_직영점_단말마스터`, `SK_직영점_모델이미지`

---

### 3. 고객 모드 (2개 테이블)

| Google Sheets 시트명 | Supabase 테이블명 | 상태 |
|---------------------|-------------------|------|
| 고객_대기고객 | `customer_queue` | ⚠️ 테이블 미존재 (건너뜀) |
| 고객_상담이력 | `customer_consultation_history` | ⚠️ 테이블 미존재 (건너뜀) |

---

### 4. 마스터 데이터 (3개 테이블)

| Google Sheets 시트명 | Supabase 테이블명 | 상태 |
|---------------------|-------------------|------|
| 대리점아이디관리 | `master_agent_management` | ⚠️ 테이블 미존재 (건너뜀) |
| 일반모드권한관리 | `master_general_mode_permissions` | ⚠️ 테이블 미존재 (건너뜀) |
| 대중교통위치 | `master_transit_locations` | ✅ 테이블 존재 |

---

## 🔄 마이그레이션 동작 방식

1. **Google Sheets에서 데이터 읽기**
   - 모든 시트의 데이터를 읽어옴
   - 헤더 행을 기준으로 객체 배열로 변환

2. **Supabase 테이블 존재 여부 확인**
   - 각 테이블이 Supabase에 존재하는지 자동 확인
   - 존재하지 않는 테이블은 자동으로 건너뜀

3. **Upsert (Insert or Update)**
   - 기존 데이터가 있으면 업데이트
   - 없으면 새로 삽입
   - 고유 키(uniqueKey)를 기준으로 중복 방지

4. **결과 통계 출력**
   - 성공/실패/건너뜀 개수 표시
   - 카테고리별 통계 제공

---

## 📈 출력 예시

```bash
$ node server/migration/migrate-all-sheets-to-supabase.js

🚀 Google Sheets → Supabase 전체 마이그레이션 시작
📋 옵션: { isDryRun: false, isForce: false, onlyCategory: 'all' }

📂 [1/4] 정책 모드 마이그레이션 시작...

   📄 정책_기본정보 → policy_basic_info
   📊 150개 행 발견
   ✅ 150개 행 마이그레이션 완료

   📄 정책모드_정책표설정 → policy_table_settings
   📊 25개 행 발견
   ✅ 25개 행 마이그레이션 완료

   📄 정책모드_정책표목록 → policy_table_list
   📊 300개 행 발견
   ✅ 300개 행 마이그레이션 완료

📂 [2/4] 직영점 모드 마이그레이션 시작...

   🏢 KT 직영점 데이터 마이그레이션...
      📄 KT_직영점_요금제마스터 → direct_store_plan_master
      📊 50개 행 발견
      ✅ 50개 행 마이그레이션 완료

   🏢 LG 직영점 데이터 마이그레이션...
      📄 LG_직영점_단말마스터 → direct_store_device_master
      📊 120개 행 발견
      ✅ 120개 행 마이그레이션 완료

📂 [3/4] 고객 모드 마이그레이션 시작...

   📄 고객_대기고객 → customer_queue
   📊 10개 행 발견
   ⚠️  테이블 없음: customer_queue (건너뜀)

📂 [4/4] 마스터 데이터 마이그레이션 시작...

   📄 대중교통위치 → master_transit_locations
   📊 50개 행 발견
   ✅ 50개 행 마이그레이션 완료

============================================================
📊 마이그레이션 완료 통계
============================================================
총 시트: 34개
✅ 성공: 29개
❌ 실패: 0개
⏭️  건너뜀: 5개

카테고리별 통계:
  policy: 11/11 성공
  direct-store: 18/18 성공
  customer: 0/2 성공
  master: 1/3 성공
============================================================
```

---

## ⚠️ 주의사항

1. **환경변수 필수**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `SHEET_ID`

2. **테이블 자동 생성 안 됨**
   - Supabase에 테이블이 없으면 자동으로 건너뜀
   - 테이블 생성은 `node server/migration/executeSchema.js` 먼저 실행

3. **데이터 덮어쓰기**
   - Upsert 방식이므로 기존 데이터가 업데이트됨
   - 백업 권장: `node server/migration/BackupScript.js`

4. **Google Sheets API 제한**
   - 분당 60회 제한
   - 자동 재시도 로직 포함

---

## 🔧 트러블슈팅

### 1. 테이블이 없다는 오류
```
⚠️  테이블 없음: policy_table_settings (건너뜀)
```

**해결**: 먼저 스키마 생성
```bash
node server/migration/executeSchema.js
```

### 2. 권한 오류
```
❌ Supabase 삽입 실패: permission denied
```

**해결**: `SUPABASE_SERVICE_ROLE_KEY` 확인 (anon key가 아닌 service_role key 사용)

### 3. Google Sheets API 제한
```
❌ 시트 읽기 실패: Quota exceeded
```

**해결**: 잠시 대기 후 재실행 (자동 재시도 로직 포함)

---

## 📅 정기 업데이트 권장

데이터를 주기적으로 동기화하려면:

```bash
# 매일 자정 실행 (cron)
0 0 * * * cd /app && node server/migration/migrate-all-sheets-to-supabase.js

# 또는 수동 실행
node server/migration/migrate-all-sheets-to-supabase.js
```

---

**작성일**: 2026-01-26  
**작성자**: Kiro AI
