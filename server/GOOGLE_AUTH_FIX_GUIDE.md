# Google Sheets 인증 에러 해결 가이드

## 🚨 현재 에러

```
GaxiosError: Method doesn't allow unregistered callers (callers without established identity). 
Please use API Key or other form of API consumer identity to call this API.
```

**에러 코드**: 403 Forbidden  
**원인**: Google Service Account 인증 정보가 올바르지 않거나 누락됨

---

## 📋 체크리스트

### 1단계: Cloudtype 환경변수 확인

다음 3개 환경변수가 **모두** 설정되어 있어야 합니다:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
SHEET_ID=1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18
```

#### ⚠️ 중요 사항

1. **GOOGLE_PRIVATE_KEY 형식**
   - 전체를 큰따옴표(`"`)로 감싸야 함
   - 줄바꿈은 `\n`으로 표시 (이스케이프)
   - `-----BEGIN PRIVATE KEY-----`로 시작
   - `-----END PRIVATE KEY-----`로 끝남

2. **올바른 예시**
   ```
   "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...(중략)...xyz\n-----END PRIVATE KEY-----\n"
   ```

3. **잘못된 예시**
   ```
   ❌ 따옴표 없음: -----BEGIN PRIVATE KEY-----...
   ❌ 줄바꿈 그대로: -----BEGIN PRIVATE KEY-----
                      MIIEvQIBADANBgkqhkiG9w0...
   ❌ 이스케이프 안 됨: -----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0...
   ```

---

## 🔧 해결 방법

### 방법 1: Cloudtype 환경변수 재설정 (권장)

1. **Google Cloud Console에서 Service Account Key 다운로드**
   - https://console.cloud.google.com/iam-admin/serviceaccounts
   - Service Account 선택
   - "키" 탭 → "키 추가" → "새 키 만들기" → JSON 선택
   - JSON 파일 다운로드

2. **JSON 파일에서 정보 추출**
   ```json
   {
     "type": "service_account",
     "project_id": "your-project",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0...\n-----END PRIVATE KEY-----\n",
     "client_email": "your-service-account@project.iam.gserviceaccount.com",
     ...
   }
   ```

3. **Cloudtype 환경변수 설정**
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: `client_email` 값 복사
   - `GOOGLE_PRIVATE_KEY`: `private_key` 값 **전체** 복사 (따옴표 포함)
   - `SHEET_ID`: 스프레드시트 ID

4. **저장 후 서버 재시작**

### 방법 2: 환경변수 형식 변환

현재 Private Key가 여러 줄로 되어 있다면:

**변환 전:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC
BKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

**변환 후:**
```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**변환 방법:**
1. 모든 줄바꿈을 `\n`으로 변경
2. 전체를 큰따옴표로 감싸기

---

## 🧪 테스트 방법

### 로컬 테스트
```bash
cd server

# 환경변수 설정 (로컬 .env 파일)
# GOOGLE_SERVICE_ACCOUNT_EMAIL=...
# GOOGLE_PRIVATE_KEY="..."
# SHEET_ID=...

# 인증 테스트 실행
node test-google-auth.js
```

**정상 출력 예시:**
```
✅ GOOGLE_SERVICE_ACCOUNT_EMAIL: 설정됨
✅ GOOGLE_PRIVATE_KEY: 설정됨
✅ SHEET_ID: 설정됨
✅ Private Key 형식 확인됨
✅ JWT 인증 객체 생성 완료
✅ Google Sheets 클라이언트 생성 완료
✅ API 호출 성공!
스프레드시트 제목: VIP Mobile 관리
시트 개수: 50개
🎉 모든 테스트 통과!
```

### Cloudtype에서 테스트

1. **환경변수 설정 후 재배포**
2. **로그 확인**
   ```
   ✅ Google Sheets 클라이언트 초기화 완료
      - Spreadsheet ID: 1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18
      - Service Account: your-service-account@project.iam.gserviceaccount.com
   ```

3. **API 호출 테스트**
   ```bash
   curl https://your-cloudtype-url.com/api/teams
   ```

---

## 🔍 추가 확인 사항

### 1. Google Sheets API 활성화 확인
- https://console.cloud.google.com/apis/library
- "Google Sheets API" 검색
- "사용 설정됨" 확인

### 2. Service Account 권한 확인
- Google Sheets 파일 열기
- "공유" 버튼 클릭
- Service Account 이메일 추가 (편집 권한)
- 예: `your-service-account@project.iam.gserviceaccount.com`

### 3. Spreadsheet ID 확인
- Google Sheets URL에서 추출
- `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
- 현재 ID: `1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18`

---

## 🚨 자주 발생하는 실수

### 실수 1: Private Key에 따옴표 없음
```bash
❌ GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
✅ GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 실수 2: 줄바꿈 이스케이프 안 됨
```bash
❌ GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0..."

✅ GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0..."
```

### 실수 3: Service Account 이메일 오타
```bash
❌ GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com (공백 포함)
✅ GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
```

### 실수 4: 잘못된 SHEET_ID
```bash
❌ SHEET_ID=https://docs.google.com/spreadsheets/d/1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18/edit
✅ SHEET_ID=1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18
```

---

## 📝 Cloudtype 환경변수 설정 예시

```bash
# Google Sheets 설정 (필수)
GOOGLE_SERVICE_ACCOUNT_EMAIL=vip-mobile-sheets@vip-mobile-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\n-----END PRIVATE KEY-----\n"
SHEET_ID=1scNwIN5ZgV_DGGQW7WKJW9mL33vMGnFfsASPHYxt-18

# Supabase 비활성화
USE_SUPABASE=false
USE_DB_DIRECT_STORE=false
USE_DB_POLICY=false
USE_DB_CUSTOMER=false

# 서버 설정
PORT=4000
NODE_ENV=production

# Discord (선택)
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CHANNEL_ID=your-channel-id
DISCORD_LOGGING_ENABLED=true

# Kakao Maps (선택)
KAKAO_API_KEY=your-kakao-api-key
```

---

## ✅ 해결 확인

환경변수 설정 후:

1. **Cloudtype에서 재배포**
2. **로그 확인**
   - `✅ Google Sheets 클라이언트 초기화 완료` 메시지 확인
3. **API 테스트**
   - `/api/teams`, `/api/stores` 등 호출
   - 403 에러 없이 정상 응답 확인

---

**작성일**: 2025-01-26  
**작성자**: Kiro AI  
**상태**: 인증 문제 해결 가이드
