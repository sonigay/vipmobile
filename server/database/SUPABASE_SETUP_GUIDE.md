# Supabase 설정 가이드

## 1단계: Supabase 계정 생성 및 프로젝트 설정

### 1.1 계정 생성
1. https://supabase.com 방문
2. "Start your project" 클릭
3. GitHub 또는 이메일로 가입

### 1.2 새 프로젝트 생성
1. Dashboard에서 "New Project" 클릭
2. 프로젝트 정보 입력:
   - **Project name**: `vip-map-production` (또는 원하는 이름)
   - **Database Password**: 강력한 비밀번호 생성 (안전하게 보관!)
   - **Region**: `Northeast Asia (Seoul)` 선택 (한국 서버)
   - **Pricing Plan**: `Free` 선택
3. "Create new project" 클릭
4. 프로젝트 생성 완료까지 약 2분 대기

## 2단계: API 키 확인

### 2.1 API 설정 페이지 접근
1. 좌측 메뉴에서 "Settings" (톱니바퀴 아이콘) 클릭
2. "API" 탭 선택

### 2.2 필요한 정보 복사
다음 정보를 복사하여 안전한 곳에 저장:

- **Project URL**: `https://xxxxx.supabase.co` 형식
- **anon public key**: `eyJhbGc...` 형식의 긴 토큰
- **service_role key**: 서버 사이드 작업용 (더 많은 권한) ⭐ **이것을 사용하세요**

## 3단계: 환경 변수 설정

### 3.1 server/.env 파일 수정
`server/.env` 파일을 열고 다음 내용을 추가:

```bash
# ============================================================================
# Supabase 설정 (추가)
# ============================================================================

# Supabase Project URL
SUPABASE_URL=https://xxxxx.supabase.co

# Supabase Service Role Key (서버 사이드용, anon key가 아님!)
SUPABASE_KEY=eyJhbGc...your-service-role-key-here...

# Feature Flags (초기에는 모두 false)
USE_DB_DIRECT_STORE=false
USE_DB_POLICY=false
USE_DB_CUSTOMER=false
```

⚠️ **주의**: 
- `SUPABASE_KEY`에는 **service_role key**를 사용하세요 (anon key 아님)
- service_role key는 모든 권한을 가지므로 절대 프론트엔드에 노출하지 마세요
- `.env` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다

### 3.2 환경 변수 확인
```bash
cd server
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ 설정됨' : '❌ 없음')"
```

## 4단계: 스키마 생성

### 4.1 SQL Editor 접근
1. Supabase Dashboard에서 "SQL Editor" 메뉴 클릭
2. 새 쿼리 생성 ("New query" 버튼)

### 4.2 스키마 파일 실행

다음 파일들을 **순서대로** 실행하세요:

#### 1️⃣ 직영점 모드 (14개 테이블)
```bash
# 파일 위치: server/database/schema-direct-store.sql
```

1. 파일 내용 전체를 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. 성공 메시지 확인

#### 2️⃣ 정책 모드 (10개 테이블)
```bash
# 파일 위치: server/database/schema-policy.sql
```

1. 파일 내용 전체를 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. 성공 메시지 확인

#### 3️⃣ 고객 모드 (7개 테이블)
```bash
# 파일 위치: server/database/schema-customer.sql
```

1. 파일 내용 전체를 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. 성공 메시지 확인

### 4.3 테이블 생성 확인
1. 좌측 메뉴에서 "Table Editor" 클릭
2. 31개 테이블이 생성되었는지 확인:
   - `direct_store_*` (14개)
   - `policy_*`, `budget_*` (10개)
   - `customer_*`, `purchase_*`, `board`, `reservation_*`, `unmatched_*` (7개)

## 5단계: 연결 테스트

### 5.1 테스트 스크립트 실행
```bash
cd server
node testSupabaseConnection.js
```

예상 출력:
```
✅ Supabase 클라이언트 초기화 완료
✅ Supabase 연결 성공!
```

### 5.2 스키마 확인 스크립트 실행
```bash
cd server
node migration/createSchema.js
```

예상 출력:
```
✅ Supabase 클라이언트 연결 확인 완료
🔍 생성된 테이블 확인 중...
   ✅ direct_store_policy_margin
   ✅ direct_store_policy_addon_services
   ...
📊 테이블 확인 결과: 31/31 생성됨
🎉 모든 테이블이 이미 생성되어 있습니다!
```

## 6단계: Row Level Security (RLS) 설정 (선택사항)

### 6.1 RLS 비활성화 (개발 단계)
개발 단계에서는 RLS를 비활성화하여 편리하게 작업할 수 있습니다:

```sql
-- 모든 테이블의 RLS 비활성화
ALTER TABLE direct_store_policy_margin DISABLE ROW LEVEL SECURITY;
ALTER TABLE direct_store_policy_addon_services DISABLE ROW LEVEL SECURITY;
-- ... (나머지 테이블도 동일)
```

### 6.2 RLS 활성화 (프로덕션 단계)
프로덕션 배포 전에 RLS를 활성화하고 정책을 설정하세요:

```sql
-- 예시: 모든 사용자가 읽기 가능, 서비스 역할만 쓰기 가능
ALTER TABLE direct_store_policy_margin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all users"
ON direct_store_policy_margin
FOR SELECT
USING (true);

CREATE POLICY "Allow write access for service role only"
ON direct_store_policy_margin
FOR ALL
USING (auth.role() = 'service_role');
```

## 7단계: 백업 설정 (자동)

Supabase Free Tier는 자동으로 다음을 제공합니다:
- ✅ 일일 자동 백업 (7일 보관)
- ✅ Point-in-time recovery (PITR) - 유료 플랜에서 사용 가능

추가 백업이 필요한 경우:
```bash
cd server
node migration/backup.js
```

## 문제 해결

### 문제 1: "relation does not exist" 에러
**원인**: 테이블이 생성되지 않음  
**해결**: 4단계의 SQL 스키마 파일을 다시 실행

### 문제 2: "permission denied" 에러
**원인**: service_role key 대신 anon key 사용  
**해결**: `.env` 파일의 `SUPABASE_KEY`를 service_role key로 변경

### 문제 3: 연결 타임아웃
**원인**: 네트워크 문제 또는 잘못된 URL  
**해결**: 
1. `SUPABASE_URL`이 정확한지 확인
2. 인터넷 연결 확인
3. Supabase 프로젝트가 활성 상태인지 확인

### 문제 4: 한글 컬럼명 에러
**원인**: 큰따옴표 없이 한글 컬럼명 사용  
**해결**: 
```javascript
// ❌ 잘못된 사용
.select('통신사, 마진')

// ✅ 올바른 사용 (Supabase 클라이언트는 자동 처리)
.select('통신사, 마진') // 실제로는 자동으로 처리됨

// 직접 SQL 작성 시에만 큰따옴표 필요
.rpc('custom_function', {
  query: 'SELECT "통신사", "마진" FROM direct_store_policy_margin'
})
```

## Supabase Free Tier 제한사항

- **Database**: 500MB 저장 공간
- **API Requests**: 무제한
- **Bandwidth**: 5GB/월
- **File Storage**: 1GB
- **Realtime**: 200 concurrent connections
- **Edge Functions**: 500,000 invocations/월
- **Automatic Backups**: 7일 보관

현재 시스템의 31개 테이블 데이터는 500MB 이내로 충분히 수용 가능합니다.

## 다음 단계

✅ Supabase 설정 완료!

이제 다음 작업을 진행할 수 있습니다:
1. **Task 14-16**: 마이그레이션 스크립트 구현
2. **Task 17-53**: Google Sheets 데이터를 Supabase로 마이그레이션
3. **Task 54-61**: 백업 및 모니터링 설정
4. **Task 62-71**: 테스트 및 문서화
5. **Task 72-76**: 프로덕션 배포

## 참고 문서

- [Supabase 공식 문서](https://supabase.com/docs)
- [PostgreSQL 한글 컬럼명 사용](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS)
- [SCHEMA_MAPPING_STRATEGY.md](../../.kiro/specs/hybrid-database-migration/SCHEMA_MAPPING_STRATEGY.md)
