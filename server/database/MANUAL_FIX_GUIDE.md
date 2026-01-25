# 마이그레이션 문제 해결 가이드

## 문제 상황

3개 테이블에 NOT NULL 제약이 남아있어 마이그레이션 실패:
- `direct_store_todays_mobiles`: 0/9 실패
- `direct_store_photos`: 0/24 실패  
- `direct_store_main_page_texts`: 5/6 실패

## 원인

Supabase에 이전 스키마(NOT NULL 제약 포함)가 남아있음. 로컬 스키마 파일은 수정되었지만 Supabase에 반영되지 않음.

## 해결 방법 (권장)

### 1단계: Supabase 대시보드 접속

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2단계: 문제 테이블 삭제

`server/database/DROP_PROBLEM_TABLES.sql` 파일 내용을 복사하여 실행:

```sql
DROP TABLE IF EXISTS direct_store_todays_mobiles CASCADE;
DROP TABLE IF EXISTS direct_store_photos CASCADE;
DROP TABLE IF EXISTS direct_store_main_page_texts CASCADE;
```

**실행 버튼 클릭** (또는 Ctrl+Enter)

### 3단계: 테이블 재생성 (NULL 허용)

`server/database/CREATE_PROBLEM_TABLES.sql` 파일 내용을 복사하여 실행:

```sql
-- 3개 테이블 CREATE TABLE 문 실행
-- (파일 내용 전체 복사)
```

**실행 버튼 클릭**

### 4단계: 마이그레이션 재실행

클라우드타입 터미널에서:

```bash
node migration/autoMigrate.js --mode=direct
```

### 5단계: 결과 확인

모든 테이블이 성공했는지 확인:
- ✅ `direct_store_todays_mobiles`: 9/9 성공
- ✅ `direct_store_photos`: 24/24 성공
- ✅ `direct_store_main_page_texts`: 6/6 성공

## 대안 방법 (고급)

### 방법 A: psql 명령줄 도구 사용

```bash
# 1. 삭제
psql -h db.xxx.supabase.co -U postgres -d postgres -f server/database/DROP_PROBLEM_TABLES.sql

# 2. 재생성
psql -h db.xxx.supabase.co -U postgres -d postgres -f server/database/CREATE_PROBLEM_TABLES.sql
```

### 방법 B: Supabase Table Editor에서 수동 삭제

1. Table Editor 메뉴 클릭
2. 각 테이블 우클릭 → Delete table
3. SQL Editor에서 CREATE_PROBLEM_TABLES.sql 실행

## 검증

마이그레이션 완료 후:

```bash
# 1. 테이블 확인
node migration/createSchema.js

# 2. 데이터 확인 (Supabase 대시보드)
# Table Editor에서 각 테이블 열어서 데이터 확인

# 3. Feature Flag 활성화
# server/.env 파일에서:
USE_DB_DIRECT_STORE=true

# 4. 서버 재시작 (클라우드타입 자동 재배포)
```

## 주의사항

- **DROP TABLE CASCADE**는 관련된 외래 키도 함께 삭제합니다
- 현재 스키마에는 외래 키가 없으므로 안전합니다
- 백업은 `server/backups/` 폴더에 자동 저장되어 있습니다

## 문제 발생 시

1. Supabase 대시보드에서 테이블이 정상적으로 삭제/생성되었는지 확인
2. 환경 변수 확인: `SUPABASE_URL`, `SUPABASE_KEY`
3. 마이그레이션 에러 로그 확인: `server/migration/migration-errors-*.json`

## 다음 단계

마이그레이션 완료 후:
1. Policy 모드 마이그레이션: `node migration/autoMigrate.js --mode=policy`
2. Customer 모드 마이그레이션: `node migration/autoMigrate.js --mode=customer`
3. DAL 연동 및 API 테스트
