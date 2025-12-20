# Shared Drive 생성 가이드

## 📋 공유 폴더 vs Shared Drive

### 공유 폴더 (현재 상황)
- **위치**: 개인 드라이브 안에 있는 폴더
- **공유 방식**: 폴더를 다른 사람과 공유
- **문제**: Service Account는 개인 드라이브에 저장할 수 없음 ❌

### Shared Drive (필요한 것)
- **위치**: 개인 드라이브와 별도의 공간
- **공유 방식**: 드라이브 전체를 팀과 공유
- **장점**: Service Account가 저장 가능 ✅

---

## 🔧 Shared Drive 생성 방법

### 전제 조건
- **Google Workspace 계정 필요** (일반 Google 계정은 불가능)
- Google Workspace 관리자 권한 또는 Shared Drive 생성 권한 필요

### 방법 1: Google Drive 웹에서 생성

1. **Google Drive 접속**
   - https://drive.google.com 접속

2. **왼쪽 메뉴 확인**
   - "공유 드라이브" 또는 "Shared drives" 메뉴가 보이는지 확인
   - 보이지 않으면 Google Workspace 계정이 아니거나 권한이 없을 수 있음

3. **공유 드라이브 생성**
   - 왼쪽 메뉴에서 "공유 드라이브" 클릭
   - "+ 새로 만들기" 또는 "새 공유 드라이브" 클릭
   - 드라이브 이름 입력 (예: "앱 데이터 저장소")
   - "만들기" 클릭

4. **Service Account 추가**
   - 생성된 공유 드라이브 열기
   - 오른쪽 상단 "사람 추가" 또는 "멤버 추가" 클릭
   - Service Account 이메일 입력: `siljuk@siljuk.iam.gserviceaccount.com`
   - 권한: **"콘텐츠 관리자"** 또는 **"편집자"** 선택
   - "전송" 클릭

5. **폴더 생성**
   - 공유 드라이브 안에 "어플자료" 폴더 생성
   - 이 폴더는 자동으로 Shared Drive에 있음

---

### 방법 2: Google Workspace 관리 콘솔에서 생성

1. **Google Workspace 관리 콘솔 접속**
   - https://admin.google.com 접속
   - 관리자 계정으로 로그인

2. **공유 드라이브 관리**
   - "앱" > "Google Workspace" > "Drive 및 문서" > "공유 드라이브" 메뉴
   - "공유 드라이브 만들기" 클릭

3. **드라이브 생성 및 설정**
   - 이름 입력
   - Service Account를 멤버로 추가

---

## ⚠️ Google Workspace 계정이 없는 경우

### 대안 1: OAuth Delegation 사용 (권장)
Service Account 대신 사용자 계정으로 인증하여 개인 드라이브에 저장

**장점:**
- Google Workspace 불필요
- 개인 드라이브에 저장 가능
- 공유 폴더 사용 가능

**단점:**
- 사용자 인증 필요
- 토큰 갱신 필요

### 대안 2: Google Workspace 계정 생성
- Google Workspace 비즈니스 스탠다드 이상 필요
- 월 구독료 발생

---

## 🔍 현재 계정 확인 방법

1. **Google Drive 접속**
2. **왼쪽 메뉴 확인**
   - "공유 드라이브" 또는 "Shared drives" 메뉴가 보이면 → Google Workspace 계정 ✅
   - 보이지 않으면 → 일반 Google 계정 ❌

---

## 📝 Shared Drive 생성 후 설정

1. **폴더 ID 확인**
   - Shared Drive 안에 "어플자료" 폴더 생성
   - 폴더 URL에서 폴더 ID 추출
   - 예: `https://drive.google.com/drive/folders/폴더ID`
   - 이 폴더 ID를 `APP_DATA_FOLDER_ID` 환경변수에 설정

2. **Service Account 권한 확인**
   - Service Account가 공유 드라이브 멤버로 추가되어 있는지 확인
   - 권한: "콘텐츠 관리자" 또는 "편집자"

3. **테스트**
   - 서버 재시작 후 이미지 업로드 테스트
   - 로그에서 "Drive ID: xxx (Shared Drive)" 메시지 확인

---

## ❓ 질문

**Q: 왜 공유 폴더로는 안 되나요?**
A: 공유 폴더는 개인 드라이브 안에 있어서 Service Account가 저장할 수 없습니다. Shared Drive는 별도의 공간이어서 Service Account가 저장할 수 있습니다.

**Q: Google Workspace 계정이 없으면?**
A: OAuth Delegation을 사용하여 사용자 계정으로 인증하면 개인 드라이브에 저장할 수 있습니다.
