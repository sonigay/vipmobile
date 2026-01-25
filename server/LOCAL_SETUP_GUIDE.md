# 로컬 개발 환경 설정 가이드

## 개요
이 가이드는 VIP Plus 서버를 로컬 환경에서 실행하기 위한 설정 방법을 안내합니다.

---

## 1. 환경변수 설정

### 1.1 `.env` 파일 확인
`server/.env` 파일이 생성되어 있습니다. 이 파일에 실제 값을 입력해야 합니다.

### 1.2 Cloudtype에서 환경변수 복사

Cloudtype 대시보드에서 다음 환경변수 값을 복사하세요:

#### 필수 환경변수 (반드시 설정)
1. **GOOGLE_SERVICE_ACCOUNT_EMAIL**
   - Google Service Account 이메일 주소
   - 예: `vipplus-service@project-id.iam.gserviceaccount.com`

2. **GOOGLE_PRIVATE_KEY**
   - Google Service Account Private Key
   - ⚠️ **중요**: 줄바꿈이 `\n`으로 표시되어야 합니다
   - 전체 키를 큰따옴표로 감싸야 합니다
   - 예시:
     ```
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
     ```

3. **SHEET_ID**
   - Google Spreadsheet ID
   - 스프레드시트 URL에서 확인 가능
   - 예: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

#### 선택적 환경변수 (필요시 설정)
4. **DISCORD_BOT_TOKEN** (Discord 로깅 사용 시)
5. **DISCORD_CHANNEL_ID** (Discord 로깅 사용 시)
6. **KAKAO_API_KEY** (Kakao Maps 사용 시)
7. **VAPID_PUBLIC_KEY** (Web Push 알림 사용 시)
8. **VAPID_PRIVATE_KEY** (Web Push 알림 사용 시)

### 1.3 `.env` 파일 수정

1. `server/.env` 파일을 텍스트 에디터로 엽니다
2. 위에서 복사한 값들을 해당 위치에 붙여넣습니다
3. 파일을 저장합니다

---

## 2. 서버 실행

### 2.1 의존성 설치 (최초 1회)
```bash
cd server
npm install
```

### 2.2 서버 시작
```bash
npm start
```

또는 개발 모드 (nodemon 사용):
```bash
npm run dev
```

### 2.3 서버 정상 작동 확인
브라우저에서 다음 URL을 열어 확인:
- http://localhost:4000/health

정상 응답 예시:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-25T12:00:00.000Z",
  "uptime": 123.456
}
```

---

## 3. 프론트엔드 연결

### 3.1 프론트엔드 환경변수 설정
프로젝트 루트의 `.env` 파일을 생성하거나 수정:

```bash
# 프로젝트 루트/.env
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENV=development
REACT_APP_LOGGING_ENABLED=true
```

### 3.2 프론트엔드 실행
```bash
# 프로젝트 루트에서
npm start
```

프론트엔드는 http://localhost:3000 에서 실행됩니다.

---

## 4. 문제 해결

### 4.1 "Missing required environment variables" 오류
**원인**: 필수 환경변수가 설정되지 않음

**해결**:
1. `server/.env` 파일이 존재하는지 확인
2. `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SHEET_ID`가 설정되어 있는지 확인
3. 값에 오타가 없는지 확인

### 4.2 "Invalid credentials" 오류
**원인**: Google Service Account 인증 정보가 잘못됨

**해결**:
1. Cloudtype에서 정확한 값을 다시 복사
2. `GOOGLE_PRIVATE_KEY`의 줄바꿈이 `\n`으로 표시되어 있는지 확인
3. 큰따옴표로 전체 키를 감쌌는지 확인

### 4.3 "EADDRINUSE" 오류 (포트 충돌)
**원인**: 4000번 포트가 이미 사용 중

**해결**:
1. `.env` 파일에서 `PORT=4001`로 변경
2. 프론트엔드 `.env`의 `REACT_APP_API_URL`도 `http://localhost:4001`로 변경

### 4.4 CORS 오류
**원인**: 프론트엔드 Origin이 허용되지 않음

**해결**:
`server/.env` 파일에서 `ALLOWED_ORIGINS` 확인:
```
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

---

## 5. 개발 팁

### 5.1 로그 레벨 조정
디버깅이 필요한 경우 `.env`에서:
```
LOG_LEVEL=debug
```

### 5.2 Discord 로깅 비활성화
로컬 개발 시 Discord 알림이 불필요한 경우:
```
DISCORD_LOGGING_ENABLED=false
```

### 5.3 캐시 비활성화
개발 중 실시간 데이터 확인이 필요한 경우:
```
CACHE_TTL=0
```

### 5.4 Hot Reload 사용
코드 변경 시 자동 재시작:
```bash
npm run dev
```

---

## 6. 보안 주의사항

⚠️ **중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!

- `.env` 파일은 이미 `.gitignore`에 포함되어 있습니다
- 실수로 커밋한 경우 즉시 키를 재발급하세요
- 팀원과 공유 시 안전한 방법(암호화된 메시지 등)을 사용하세요

---

## 7. 다음 단계

환경 설정이 완료되면:
1. ✅ 서버가 정상 실행되는지 확인
2. ✅ 프론트엔드가 서버에 연결되는지 확인
3. ✅ 로그인 기능이 작동하는지 테스트
4. ✅ 주요 API 엔드포인트 테스트

문제가 발생하면 위의 "문제 해결" 섹션을 참고하세요.
