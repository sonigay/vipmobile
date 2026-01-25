# Hybrid Database Migration Guide

## 개요

VIP Map Application을 Google Sheets에서 Supabase (PostgreSQL) + Google Sheets 하이브리드 시스템으로 마이그레이션하는 완전한 가이드입니다.

## 사전 준비

### 1. Supabase 프로젝트 설정

1. **Supabase 계정 생성**
   - https://supabase.com 접속
   - 무료 계정 생성

2. **프로젝트 생성**
   - "New Project" 클릭
   - 프로젝트 이름: `vip-map-production`
   - 데이터베이스 비밀번호 설정 (안전하게 보관!)
   - 리전: Seoul (ap-northeast-2)

3. **API 키 확인**
   - Settings → API 메뉴
   - `Project URL` 복사
   - `service_role` key 복사 (anon key 아님!)

### 2. 환경 변수 설정

**로컬 환경 (`server/.env`)**:
```bash
# Supabase 설정
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-service-role-key-here

# Feature Flags (초기에는 false)
USE_DB_DIRECT_STORE=false
USE_DB_POLICY=false
USE_DB_CUSTOMER=false

# Google Sheets (기존 설정 유지)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
SHEET_ID=...
```

**Cloudtype 환경 변수**:
- Cloudtype 대시보드에서 동일한 환경 변수 추가

## 마이그레이션 단계

### Step 1: 스키마 생성

**방법 A: Supabase SQL Editor (권장)**

1. Supabase 대시보드 → SQL Editor
2. 다음 파일들을 순서대로 실행:
   ```
   server/database/schema-direct-store.sql
   server/database/schema-policy.sql
   server/database/schema-customer.sql
   ```

**방법 B: 자동 스크립트**
```bash
cd server
node migration/executeSchema.js
```

**확인**:
```bash
node migration/createSchema.js
```
→ "31/31 생성됨" 메시지 확인

### Step 2: 백업 생성 (안전장치)

마이그레이션 전 Google Sheets 데이터 백업:

```bash
cd server
node migration/BackupScript.js backup
```

백업 파일은 `server/backups/` 디렉토리에 저장됩니다.

### Step 3: 데이터 마이그레이션 (Dry-run)

실제 데이터를 변경하지 않고 테스트:

```bash
# 전체 테스트
node migration/runMigration.js --all --dry-run

# 모드별 테스트
node migration/runMigration.js --mode=direct --dry-run
node migration/runMigration.js --mode=policy --dry-run
node migration/runMigration.js --mode=customer --dry-run
```

에러가 없는지 확인합니다.

### Step 4: 실제 데이터 마이그레이션

**직영점 모드 (14개 시트)**:
```bash
node migration/runMigration.js --mode=direct
```

**정책 모드 (10개 시트)**:
```bash
node migration/runMigration.js --mode=policy
```

**고객 모드 (7개 시트)**:
```bash
node migration/runMigration.js --mode=customer
```

**전체 한 번에**:
```bash
node migration/runMigration.js --all
```

### Step 5: 데이터 검증

마이그레이션 후 데이터 확인:

1. **Supabase Table Editor에서 확인**
   - 각 테이블의 행 수 확인
   - 샘플 데이터 확인

2. **Google Sheets와 비교**
   - 행 수 일치 확인
   - 무작위 샘플 데이터 비교

### Step 6: Feature Flag 활성화 (개발 환경)

`.env` 파일 수정:
```bash
USE_DB_DIRECT_STORE=true  # 직영점 모드 활성화
USE_DB_POLICY=false       # 아직 비활성화
USE_DB_CUSTOMER=false     # 아직 비활성화
```

서버 재시작:
```bash
npm start
```

### Step 7: API 테스트

직영점 모드 API 테스트:
```bash
# 예시: 정책 마진 조회
curl http://localhost:4000/api/direct-store/policy-margin
```

프론트엔드에서 직영점 모드 기능 테스트.

### Step 8: 점진적 롤아웃

1. **직영점 모드 프로덕션 배포**
   ```bash
   USE_DB_DIRECT_STORE=true
   ```
   - 1-2일 모니터링
   - 에러 없으면 다음 단계

2. **정책 모드 활성화**
   ```bash
   USE_DB_POLICY=true
   ```
   - 1-2일 모니터링

3. **고객 모드 활성화**
   ```bash
   USE_DB_CUSTOMER=true
   ```
   - 최종 모니터링

### Step 9: Google Sheets 정리 (선택적)

모든 모드가 안정적으로 작동하면:
- 마이그레이션된 시트를 "Archive" 폴더로 이동
- 또는 읽기 전용으로 설정
- **삭제하지 말 것!** (롤백 시 필요)

## 롤백 절차

문제 발생 시 즉시 롤백:

### 방법 1: Feature Flag 비활성화 (즉시)

`.env` 파일 수정:
```bash
USE_DB_DIRECT_STORE=false
USE_DB_POLICY=false
USE_DB_CUSTOMER=false
```

서버 재시작 → Google Sheets로 즉시 복귀

### 방법 2: 백업 복원

```bash
cd server

# 백업 목록 확인
node migration/RestoreScript.js list

# 최신 백업 복원
node migration/RestoreScript.js restore-latest

# 특정 백업 복원
node migration/RestoreScript.js restore backup-2025-01-26.zip
```

## 모니터링

### 성능 모니터링

```javascript
const QueryPerformanceMonitor = require('./migration/QueryPerformanceMonitor');
const monitor = new QueryPerformanceMonitor();

// 쿼리 실행 시간 측정
await monitor.measureQuery('getCustomers', async () => {
  return await dal.read('customer_info');
});

// 통계 확인
monitor.printStats();
```

### Health Check

```bash
curl http://localhost:4000/health
```

응답:
```json
{
  "status": "ok",
  "database": {
    "supabase": "connected",
    "googleSheets": "connected"
  },
  "featureFlags": {
    "directStore": true,
    "policy": false,
    "customer": false
  }
}
```

## 문제 해결

### 마이그레이션 실패

**증상**: 일부 시트 마이그레이션 실패

**해결**:
1. 에러 로그 확인
2. 해당 시트만 재실행:
   ```bash
   node migration/runMigration.js --sheet="직영점_정책_마진"
   ```

### 데이터 불일치

**증상**: Supabase와 Google Sheets 데이터 다름

**해결**:
1. 백업 복원
2. 마이그레이션 재실행
3. 데이터 검증 스크립트 실행

### 성능 저하

**증상**: API 응답 느림

**해결**:
1. 쿼리 성능 모니터링
2. 인덱스 추가
3. 캐싱 활성화

## 체크리스트

### 마이그레이션 전
- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 설정
- [ ] 스키마 생성 완료
- [ ] 백업 생성 완료
- [ ] Dry-run 테스트 성공

### 마이그레이션 중
- [ ] 직영점 모드 마이그레이션 완료
- [ ] 정책 모드 마이그레이션 완료
- [ ] 고객 모드 마이그레이션 완료
- [ ] 데이터 검증 완료

### 마이그레이션 후
- [ ] Feature Flag 활성화
- [ ] API 테스트 완료
- [ ] 프론트엔드 테스트 완료
- [ ] 성능 모니터링 설정
- [ ] 백업 스케줄링 설정

## 참고 문서

- [SCHEMA_DESIGN_SUMMARY.md](../../server/database/SCHEMA_DESIGN_SUMMARY.md)
- [SCHEMA_CREATION_GUIDE.md](./SCHEMA_CREATION_GUIDE.md)
- [design.md](./design.md)
- [requirements.md](./requirements.md)

## 지원

문제 발생 시:
1. 로그 파일 확인: `server/logs/`
2. Discord 채널에 문의
3. GitHub Issues 등록
