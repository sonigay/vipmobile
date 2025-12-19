# Google Drive API 설정 상태 확인 보고서

## ✅ 현재 설정 상태

### 1. 서비스 계정 설정 확인

**코드 위치**: `server/index.js:788-790`

```javascript
const SPREADSHEET_ID = process.env.SHEET_ID;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
```

**상태**: ✅ **이미 설정되어 있음**
- Google Sheets API를 사용 중이므로 동일한 서비스 계정 사용 가능
- 환경변수는 이미 프로젝트에 설정되어 있을 것으로 예상

**확인 방법**:
- 서버 실행 시 환경변수 체크 로그 확인
- `server/index.js:798-804`에서 환경변수 누락 시 에러 로그 출력

---

### 2. Google API 인증 설정 확인

**코드 위치**: `server/index.js:967-975`

```javascript
const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file' // Google Drive 파일 업로드 권한
  ]
});
```

**상태**: ✅ **Google Drive scope 추가 완료**
- `https://www.googleapis.com/auth/drive.file` scope가 추가됨
- Google Drive API 클라이언트 생성됨 (`server/index.js:985`)

---

### 3. Google Drive API 클라이언트 확인

**코드 위치**: `server/index.js:984-985`

```javascript
// Google Drive API 클라이언트 생성
const drive = google.drive({ version: 'v3', auth });
```

**상태**: ✅ **클라이언트 생성 완료**

---

## ⚠️ 추가로 필요한 설정

### Google Cloud Console에서 Drive API 활성화

**현재 상태**: 
- ✅ 코드 레벨에서는 모든 설정 완료
- ⚠️ Google Cloud Console에서 Drive API 활성화 필요

**확인 방법**:
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 현재 프로젝트 선택 (Google Sheets API를 사용하는 프로젝트)
3. **API 및 서비스** > **라이브러리** 메뉴로 이동
4. "Google Drive API" 검색
5. **사용 설정** 버튼 클릭 여부 확인

**예상 오류** (Drive API 미활성화 시):
- `Drive API has not been used in project` 오류 발생
- 파일 업로드 시 403 Forbidden 또는 404 Not Found 오류

---

## 📋 설정 확인 체크리스트

### ✅ 코드 레벨 (완료)
- [x] 서비스 계정 환경변수 사용 (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- [x] Google Drive scope 추가 (`https://www.googleapis.com/auth/drive.file`)
- [x] Google Drive API 클라이언트 생성 (`google.drive({ version: 'v3', auth })`)
- [x] 파일 업로드 API 구현 (`POST /api/direct/store-image/upload`)

### ⚠️ Google Cloud Console (확인 필요)
- [ ] Google Drive API 활성화 여부 확인
- [ ] 서비스 계정 권한 확인 (Drive API 사용 권한)

---

## 🔍 환경변수 확인 방법

### 서버 실행 시 확인
서버를 실행하면 다음 로그를 통해 환경변수 설정 여부를 확인할 수 있습니다:

```javascript
// server/index.js:798-804
if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not defined in environment variables');
}

if (!GOOGLE_PRIVATE_KEY) {
  console.error('GOOGLE_PRIVATE_KEY is not defined in environment variables');
}
```

**정상적인 경우**: 에러 로그 없이 서버 시작
**문제가 있는 경우**: 위의 에러 로그 출력

---

## 🧪 테스트 방법

### 1. 환경변수 확인 테스트
서버를 실행하고 콘솔 로그 확인:
- 에러 로그 없음 → 환경변수 설정 완료
- 에러 로그 있음 → 환경변수 설정 필요

### 2. Google Drive API 활성화 확인 테스트
파일 업로드 시도:
- 성공 → Drive API 활성화 완료
- `Drive API has not been used in project` 오류 → Drive API 활성화 필요

---

## 📝 결론

### ✅ 이미 설정된 항목
1. 서비스 계정 환경변수 사용 (Google Sheets API와 동일)
2. Google Drive scope 추가
3. Google Drive API 클라이언트 생성
4. 파일 업로드 API 구현

### ⚠️ 확인이 필요한 항목
1. **Google Cloud Console에서 Drive API 활성화** (가장 중요)
2. 서비스 계정에 Drive API 사용 권한 확인

**다음 단계**: Google Cloud Console에서 Drive API를 활성화하면 바로 사용 가능합니다.

---

**확인 일시**: 2024-12-XX
**결론**: 코드 레벨 설정은 완료되었으며, Google Cloud Console에서 Drive API 활성화만 하면 됩니다.

