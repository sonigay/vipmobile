# Cloudtype 배포 가이드

## 현재 상황
- ✅ 구글시트 행수 증가 완료
- ✅ 환경변수 `USE_SUPABASE=false` 설정
- ⏳ 서버 재시작 및 테스트 필요

---

## 1단계: Cloudtype 환경변수 확인

### 필수 환경변수 체크리스트

```bash
# Google Sheets 설정 (필수)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SHEET_ID=your-spreadsheet-id

# Supabase 비활성화 (중요!)
USE_SUPABASE=false          # ⚠️ 소문자 false
USE_DB_DIRECT_STORE=false   # ⚠️ 소문자 false
USE_DB_POLICY=false         # ⚠️ 소문자 false
USE_DB_CUSTOMER=false       # ⚠️ 소문자 false

# 서버 설정
PORT=4000
NODE_ENV=production

# Discord 설정 (선택)
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CHANNEL_ID=your-channel-id
DISCORD_LOGGING_ENABLED=true

# Kakao Maps (선택)
KAKAO_API_KEY=your-kakao-api-key

# CORS 설정 (선택)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_CREDENTIALS=true

# 캐시 설정 (선택)
CACHE_TTL=300000
RATE_LIMIT_COOLDOWN=500
RATE_LIMIT_MAX_RETRIES=5
```

### ⚠️ 중요 사항

1. **USE_SUPABASE는 반드시 소문자 `false`**
   - ❌ `FALSE`, `False`, `0` (작동 안 함)
   - ✅ `false` (정확히 이렇게)

2. **GOOGLE_PRIVATE_KEY 형식**
   ```
   "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
   ```
   - 전체를 큰따옴표로 감싸기
   - 줄바꿈은 `\n`으로 표시

3. **SHEET_ID 확인**
   - Google Sheets URL에서 추출
   - `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

---

## 2단계: Cloudtype에서 서버 재시작

### 방법 1: 재배포
1. Cloudtype 대시보드 접속
2. 프로젝트 선택
3. "재배포" 버튼 클릭
4. 배포 로그 확인

### 방법 2: 환경변수 변경 후 자동 재시작
1. 환경변수 수정
2. "저장" 클릭
3. 자동으로 재시작됨

---

## 3단계: 배포 로그 확인

### 정상 로그 예시
```
✅ Google Sheets 클라이언트 초기화 완료
📡 라우트 등록 중...
✅ [Phase 3] Health routes mounted
✅ [Phase 3] Logging routes mounted
✅ [Phase 3] Cache routes mounted
✅ [Phase 4] Team routes mounted
✅ [Phase 4] Coordinate routes mounted
✅ [Phase 4] Store routes mounted
✅ [Phase 4] Model routes mounted
✅ [Phase 4] Agent routes mounted
✅ [Phase 5] Map Display routes mounted
✅ [Phase 5] Sales routes mounted
✅ [Phase 5] Inventory Recovery routes mounted
✅ [Phase 5] Activation routes mounted
✅ [Phase 5] Auth routes mounted
✅ [Phase 6] Member routes mounted
✅ [Phase 6] Onsale routes mounted
✅ [Phase 6] Inventory routes mounted
✅ [Phase 6] Budget routes mounted
✅ [Phase 6] Policy Notice routes mounted
✅ 모든 라우트 등록 완료
✅ VIP Plus Server running on port 4000
```

### 에러 로그 확인 사항
```
❌ Google Sheets 클라이언트 초기화 실패
→ 환경변수 확인 필요

❌ Failed to mount XXX routes
→ 특정 라우터 모듈 문제

⚠️ Supabase 연결 시도
→ USE_SUPABASE=false 확인 필요
```

---

## 4단계: 서버 테스트

### 로컬에서 테스트 (배포된 서버)
```bash
cd server

# 환경변수 설정
export SERVER_URL=https://your-cloudtype-url.com

# 테스트 실행
node test-server-health.js
```

### 브라우저에서 테스트
```
https://your-cloudtype-url.com/health
```

**정상 응답 예시:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T...",
  "uptime": 123.456,
  "memory": {
    "used": "50 MB",
    "total": "512 MB"
  }
}
```

---

## 5단계: 주요 API 테스트

### 1. 팀 목록 조회
```bash
curl https://your-cloudtype-url.com/api/teams
```

### 2. 매장 목록 조회
```bash
curl https://your-cloudtype-url.com/api/stores
```

### 3. 모델 목록 조회
```bash
curl https://your-cloudtype-url.com/api/models
```

### 4. 정책공지사항 조회
```bash
curl https://your-cloudtype-url.com/api/policy-notices
```

### 5. 캐시 상태 조회
```bash
curl https://your-cloudtype-url.com/api/cache/stats
```

---

## 6단계: 프론트엔드 연결

### Vercel 환경변수 설정
```bash
REACT_APP_API_URL=https://your-cloudtype-url.com
REACT_APP_ENV=production
REACT_APP_LOGGING_ENABLED=false
```

### 프론트엔드 재배포
1. Vercel 대시보드 접속
2. 프로젝트 선택
3. "Redeploy" 클릭
4. 배포 완료 대기

---

## 문제 해결

### 문제 1: 서버가 시작되지 않음
**증상**: 배포 로그에서 에러 발생

**해결 방법**:
1. 환경변수 확인 (특히 `USE_SUPABASE=false`)
2. `GOOGLE_PRIVATE_KEY` 형식 확인
3. `SHEET_ID` 확인

### 문제 2: API 응답이 느림
**증상**: 응답 시간 5초 이상

**해결 방법**:
1. Google Sheets API Rate Limit 확인
2. 캐시 설정 확인 (`CACHE_TTL`)
3. Rate Limiter 설정 확인

### 문제 3: 특정 API만 실패
**증상**: 일부 엔드포인트만 404 또는 500 에러

**해결 방법**:
1. 배포 로그에서 라우터 등록 확인
2. 해당 라우터 모듈 파일 존재 확인
3. Google Sheets 시트 이름 및 범위 확인

### 문제 4: CORS 에러
**증상**: 프론트엔드에서 API 호출 시 CORS 에러

**해결 방법**:
1. `ALLOWED_ORIGINS` 환경변수 확인
2. 프론트엔드 도메인 추가
3. `CORS_CREDENTIALS=true` 설정

---

## 체크리스트

배포 전:
- [ ] 환경변수 모두 설정 완료
- [ ] `USE_SUPABASE=false` (소문자) 확인
- [ ] Google Sheets 행수 증가 완료
- [ ] 로컬 테스트 완료

배포 후:
- [ ] 배포 로그 확인 (에러 없음)
- [ ] `/health` 엔드포인트 응답 확인
- [ ] 주요 API 테스트 완료
- [ ] 프론트엔드 연결 테스트 완료

---

## 다음 단계

1. **Cloudtype 환경변수 확인 및 수정**
2. **서버 재시작**
3. **테스트 스크립트 실행** (`node test-server-health.js`)
4. **프론트엔드 환경변수 설정**
5. **프론트엔드 재배포**

---

**작성일**: 2025-01-26  
**작성자**: Kiro AI  
**상태**: 배포 준비 완료
