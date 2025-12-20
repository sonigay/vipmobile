# Google Drive API 이미지 저장 - 필요한 사항

## 📋 현재 Google Sheets API 사용 방식

### 인증 방식
- **Service Account (JWT)** 사용
- **Scope**: `https://www.googleapis.com/auth/spreadsheets`
- **상태**: ✅ 정상 작동 중

### 코드 위치
```javascript
// server/index.js:973-980
const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file' // 이미 추가됨
  ]
});
```

---

## ⚠️ Google Drive API에 필요한 추가 사항

### 1. Google Cloud Console 설정 (필수)

#### 1-1. Drive API 활성화
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **현재 Google Sheets API를 사용하는 프로젝트** 선택
3. **API 및 서비스** > **라이브러리** 메뉴
4. "Google Drive API" 검색 후 **사용 설정** 클릭

**확인 방법**: API 목록에 "Google Drive API"가 "사용 설정됨" 상태인지 확인

---

### 2. Google Sheets 파일 위치 확인 (중요)

현재 Google Sheets 파일이 어디에 있는지 확인이 필요합니다:

#### 확인 방법
1. Google Sheets 파일 열기
2. 파일 URL 확인:
   - 개인 드라이브: `https://docs.google.com/spreadsheets/d/{ID}/edit`
   - Shared Drive: URL에 "drive" 또는 "folders" 포함 가능

#### 위치별 대응

**A. Google Sheets가 개인 드라이브(My Drive)에 있는 경우**
- ❌ **문제**: Service Account는 개인 드라이브에 저장할 수 없음
- ✅ **해결 방법**: 
  1. Shared Drive 생성 (Google Workspace 필요)
  2. Google Sheets 파일을 Shared Drive로 이동
  3. Service Account를 Shared Drive에 추가

**B. Google Sheets가 Shared Drive에 있는 경우**
- ✅ **가능**: 같은 Shared Drive에 이미지 저장 가능
- ✅ **필요한 작업**: Service Account가 해당 Shared Drive에 접근 권한 있는지 확인

---

### 3. Service Account 권한 설정 (필수)

#### 3-1. Shared Drive에 Service Account 추가
1. Google Drive에서 Shared Drive 열기
2. **설정** (톱니바퀴 아이콘) 클릭
3. **관리** 탭 > **멤버 추가**
4. Service Account 이메일 추가 (`GOOGLE_SERVICE_ACCOUNT_EMAIL` 환경변수 값)
5. 권한: **콘텐츠 관리자** 또는 **편집자** 선택

#### 3-2. 권한 확인
- Service Account가 Shared Drive의 파일을 읽고 쓸 수 있어야 함
- Google Sheets API가 작동한다면 이미 권한이 있는 것

---

### 4. 코드에서 이미 추가된 사항 (확인만)

✅ **이미 완료된 부분**:
- `https://www.googleapis.com/auth/drive.file` scope 추가됨
- Google Drive API 클라이언트 생성됨
- 폴더 자동 생성 로직 구현됨
- Shared Drive 지원 옵션 추가됨 (`supportsAllDrives: true`)

---

## 🔍 확인 체크리스트

다음 사항을 확인해주세요:

- [ ] Google Cloud Console에서 **Drive API 활성화** 확인
- [ ] Google Sheets 파일이 **Shared Drive에 있는지** 확인
- [ ] Service Account가 **Shared Drive 멤버로 추가**되어 있는지 확인
- [ ] Service Account 권한이 **콘텐츠 관리자** 또는 **편집자**인지 확인

---

## 📝 요약

**사용자가 직접 해야 할 일**:
1. Google Cloud Console에서 Drive API 활성화
2. Google Sheets 파일 위치 확인 (개인 드라이브 vs Shared Drive)
3. Shared Drive가 없다면 생성하고, Google Sheets 파일 이동
4. Service Account를 Shared Drive 멤버로 추가

**코드는 이미 준비되어 있음**:
- 인증 설정 완료
- 폴더 자동 생성 로직 완료
- Shared Drive 지원 완료

---

## ❓ 문제 발생 시

### 에러: "Service Accounts do not have storage quota"
- **원인**: 개인 드라이브에 저장 시도
- **해결**: Shared Drive 사용 필요
- **참고**: `docs/Shared-Drive-생성-가이드.md` 파일 참조

### 에러: "File not found" (404)
- **원인**: Service Account가 파일에 접근 권한 없음
- **해결**: Shared Drive에 Service Account 추가 또는 폴더 공유 확인

### 에러: "Drive API has not been used in project"
- **원인**: Drive API 미활성화
- **해결**: Google Cloud Console에서 Drive API 활성화

## 📚 추가 문서

- **Shared Drive 생성 방법**: `docs/Shared-Drive-생성-가이드.md` 참조
