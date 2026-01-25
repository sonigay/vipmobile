# Supabase 스키마 생성 가이드

## 개요

31개 테이블의 스키마를 Supabase PostgreSQL 데이터베이스에 생성하는 가이드입니다.

## 실행 방법

### 방법 1: Supabase SQL Editor (권장)

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 버튼 클릭

3. **스키마 파일 실행 (순서대로)**

   **Step 1: 직영점 모드 (14개 테이블)**
   ```
   파일: server/database/schema-direct-store.sql
   ```
   - 파일 내용 전체를 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭
   - 성공 메시지 확인

   **Step 2: 정책 모드 (10개 테이블)**
   ```
   파일: server/database/schema-policy.sql
   ```
   - 파일 내용 전체를 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭
   - 성공 메시지 확인

   **Step 3: 고객 모드 (7개 테이블)**
   ```
   파일: server/database/schema-customer.sql
   ```
   - 파일 내용 전체를 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭
   - 성공 메시지 확인

4. **테이블 생성 확인**
   - 왼쪽 메뉴에서 "Table Editor" 클릭
   - 31개 테이블이 생성되었는지 확인

### 방법 2: 자동 스크립트 (실험적)

```bash
cd server
node migration/executeSchema.js
```

**주의**: PostgreSQL 직접 연결이 제한될 수 있으므로 방법 1을 권장합니다.

## 생성될 테이블 목록

### 직영점 모드 (14개)
1. direct_store_policy_margin
2. direct_store_policy_addon_services
3. direct_store_policy_insurance
4. direct_store_policy_special
5. direct_store_settings
6. direct_store_main_page_texts
7. direct_store_plan_master
8. direct_store_device_master
9. direct_store_device_pricing_policy
10. direct_store_model_images
11. direct_store_todays_mobiles
12. direct_store_transit_locations
13. direct_store_photos
14. direct_store_sales_daily

### 정책 모드 (10개)
15. policy_table_settings
16. policy_table_list
17. policy_user_groups
18. policy_tab_order
19. policy_group_change_history
20. policy_default_groups
21. policy_other_types
22. budget_channel_settings
23. budget_basic_settings
24. budget_basic_data_settings

### 고객 모드 (7개)
25. customer_info
26. purchase_queue
27. board
28. direct_store_pre_approval_marks
29. reservation_all_customers
30. reservation_customers
31. unmatched_customers

## 스키마 확인

스키마 생성 후 다음 스크립트로 확인:

```bash
cd server
node migration/createSchema.js
```

모든 테이블이 생성되었으면 "31/31 생성됨" 메시지가 표시됩니다.

## 다음 단계

스키마 생성 완료 후:

1. **데이터 마이그레이션 테스트 (Dry-run)**
   ```bash
   node migration/runMigration.js --all --dry-run
   ```

2. **실제 데이터 마이그레이션**
   ```bash
   node migration/runMigration.js --all
   ```

## 문제 해결

### 에러: "relation already exists"
- 테이블이 이미 존재합니다
- 기존 테이블을 삭제하거나 스킵하세요

### 에러: "function update_updated_at_column does not exist"
- schema-direct-store.sql을 먼저 실행하세요
- 이 파일에 함수 정의가 포함되어 있습니다

### 테이블이 보이지 않음
- SQL Editor에서 실행 후 페이지 새로고침
- Table Editor에서 확인

## 참고

- 한글 컬럼명은 큰따옴표로 감싸야 합니다
- 모든 테이블에 id, created_at, updated_at 컬럼이 자동 추가됩니다
- updated_at은 UPDATE 시 자동으로 갱신됩니다
