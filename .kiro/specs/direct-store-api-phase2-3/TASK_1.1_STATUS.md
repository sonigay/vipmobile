# 태스크 1.1 정책 설정 API 보완 - 진행 상태

## 완료된 작업 ✅

### 1. DirectStoreDAL 삭제 메서드 추가
**파일**: `server/dal/DirectStoreDAL.js`

추가된 메서드:
- `deletePolicyMargin(carrier)` - 정책 마진 삭제
- `deletePolicyAddonServices(carrier)` - 부가서비스 정책 삭제
- `deletePolicyInsurance(carrier)` - 보험상품 정책 삭제
- `deletePolicySpecial(carrier)` - 특별 정책 삭제

### 2. directRoutes.js DELETE API 엔드포인트 추가
**파일**: `server/directRoutes.js`

추가된 API:
- `DELETE /api/direct/policy-settings/margin/:carrier`
- `DELETE /api/direct/policy-settings/addon/:carrier`
- `DELETE /api/direct/policy-settings/insurance/:carrier`
- `DELETE /api/direct/policy-settings/special/:carrier`

### 3. Feature Flag 지원
- `USE_DB_DIRECT_STORE=true` 시 Supabase 사용
- `USE_DB_DIRECT_STORE=false` 시 Google Sheets 폴백 (미구현, 501 에러 반환)

### 4. GET API 폴백 로직 개선
- Supabase 실패 시 Google Sheets로 자동 폴백
- 에러 로깅 개선

## 남은 문제 ⚠️

### Supabase API 키 설정 문제

**문제**: `.env` 파일의 `SUPABASE_KEY` 값이 잘못된 형식입니다.

**현재 상태**:
```
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1ZGd3eGZvdmxrYW9vcm9rZ2VuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzU0NTU5NywiZXhwIjoyMDUzMTIxNTk3fQ.sb_secret_YX8HZSoKs-rCbg0rMs0-iA_qfbEa9nC
```

**에러 메시지**: `Invalid API key`

**원인**: JWT 토큰의 signature 부분이 잘못되었습니다. `.sb_secret_`는 JWT의 일부가 아닙니다.

## 해결 방법 📋

### 1. Supabase 대시보드에서 올바른 Service Role Key 확인

1. Supabase 대시보드 접속: https://supabase.com/dashboard
2. 프로젝트 선택: `qudgwxfovlkaoorokgen`
3. Settings → API 메뉴로 이동
4. **Service Role Key** 복사 (anon key가 아님!)

### 2. `.env` 파일 수정

`server/.env` 파일에서 다음 값을 수정:

```bash
# 올바른 Service Role Key로 교체
SUPABASE_KEY=<여기에_실제_Service_Role_Key_붙여넣기>
```

### 3. 서버 재시작

```bash
cd server
npm start
```

### 4. 테스트 실행

```bash
cd server
node test-policy-delete.js
```

## 테스트 시나리오

테스트 스크립트: `server/test-policy-delete.js`

1. LG 통신사의 정책 설정 조회 (삭제 전)
2. 정책 마진 삭제
3. 부가서비스 정책 삭제
4. 보험상품 정책 삭제
5. 특별 정책 삭제
6. 정책 설정 조회 (삭제 후) - 데이터가 없어야 함

## 다음 단계

Supabase API 키 문제가 해결되면:
1. 테스트 실행 및 검증
2. 태스크 1.1 완료 표시
3. 태스크 1.2 (링크 설정 API 보완)로 진행

## 참고 파일

- `server/dal/DirectStoreDAL.js` - DAL 메서드
- `server/directRoutes.js` - API 엔드포인트
- `server/.env` - 환경 변수 설정
- `server/test-policy-delete.js` - 테스트 스크립트
- `server/test-dal-factory.js` - DAL Factory 테스트
- `server/test-supabase-policy.js` - Supabase 연결 테스트
