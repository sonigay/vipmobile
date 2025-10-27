# VIP 안드로이드 매니저 v2.1.6

메시지를 자동으로 수신하여 서버로 전송하는 백그라운드 관리 앱입니다.

## 📱 기능

- ✅ SMS 자동 수신
- ✅ 서버로 즉시 전송
- ✅ SMS 자동 전달 (규칙 기반)
- ✅ SMS 자동응답 (FAQ 기반) ⭐ NEW!
- ✅ 백그라운드 실행
- ✅ 부팅 시 자동 시작
- ✅ 연결 테스트 기능

## 🛠️ 빌드 방법

### 1. Android Studio 설치

1. [Android Studio](https://developer.android.com/studio) 다운로드 및 설치
2. Android Studio 실행

### 2. 프로젝트 열기

1. Android Studio에서 `File` → `Open` 클릭
2. `android-app` 폴더 선택
3. `OK` 클릭
4. Gradle 동기화 대기 (3-5분)

### 3. APK 빌드

**방법 A: 디버그 APK (빠름, 테스트용)**
```
1. 메뉴: Build → Build Bundle(s) / APK(s) → Build APK(s)
2. 빌드 완료 대기 (1-2분)
3. 하단에 "locate" 링크 클릭
4. app-debug.apk 파일 생성됨
```

**방법 B: 릴리즈 APK (정식 배포용)**
```
1. 메뉴: Build → Generate Signed Bundle / APK
2. APK 선택 → Next
3. Create new... 클릭 (키 생성)
4. 키 정보 입력 → OK
5. Next → Finish
6. app-release.apk 파일 생성됨
```

### 4. APK 파일 위치

빌드 완료 후 APK 파일은 다음 경로에 생성됩니다:

```
android-app/app/build/outputs/apk/debug/app-debug.apk
```

또는

```
android-app/app/build/outputs/apk/release/app-release.apk
```

## 📲 설치 방법

### 방법 1: USB 케이블 (추천)

```
1. APK 파일을 PC에서 찾기
2. USB 케이블로 안드로이드폰 연결
3. 파일 탐색기에서 폰 내부 저장소 열기
4. APK 파일을 폰으로 복사
5. 폰에서 파일 관리자 앱 열기
6. APK 파일 찾아서 터치
7. "설치" 버튼 클릭
8. "출처를 알 수 없는 앱" 허용
9. 설치 완료!
```

### 방법 2: Google Drive/Dropbox

```
1. APK 파일을 Google Drive 또는 Dropbox에 업로드
2. 공유 링크 생성
3. 안드로이드폰 브라우저에서 링크 열기
4. APK 다운로드
5. 다운로드 폴더에서 APK 터치
6. 설치
```

### 방법 3: QR 코드

```
1. APK를 클라우드 저장소에 업로드
2. QR 코드 생성 (링크)
3. 폰 카메라로 QR 코드 스캔
4. 다운로드 및 설치
```

## ⚙️ 앱 설정

### 1. 첫 실행 시

앱을 실행하면 다음과 같이 설정합니다:

```
1. SMS 읽기 권한 허용
2. 서버 URL 입력: https://your-app.cloudtype.app
3. "저장 및 서비스 시작" 버튼 클릭
4. "연결 테스트" 버튼으로 서버 연결 확인
```

### 2. 배터리 최적화 제외 (중요!)

```
1. 설정 → 배터리 → 배터리 최적화
2. "모든 앱" 선택
3. "SMS Forwarder" 찾기
4. "최적화 안 함" 선택
5. 저장
```

### 3. 자동 실행 허용 (기종별 다름)

**삼성:**
```
설정 → 앱 → SMS Forwarder → 배터리 → 백그라운드 사용 제한 없음
```

**샤오미:**
```
설정 → 앱 → SMS Forwarder → 자동 시작 ON
```

**LG:**
```
설정 → 배터리 → 배터리 절약 → SMS Forwarder → 제외
```

## 🧪 테스트 방법

### 1. 연결 테스트

```
1. 앱 실행
2. 서버 URL 입력
3. "저장 및 서비스 시작" 클릭
4. "연결 테스트" 클릭
5. "서버 연결 성공!" 메시지 확인
```

### 2. SMS 수신 테스트

```
1. 다른 폰에서 테스트 SMS 전송
2. 앱에서 "마지막 SMS 정보" 업데이트 확인
3. 웹 어플 → SMS 관리 모드 → SMS 목록 확인
4. 구글 시트 "SMS관리"에서 데이터 확인
```

## 🔧 문제 해결

### 앱이 자동으로 종료됨
- 배터리 최적화 제외 설정 확인
- 자동 실행 권한 확인
- 백그라운드 제한 해제

### SMS가 서버로 전송되지 않음
- 서버 URL 확인 (https:// 포함)
- 인터넷 연결 확인
- "연결 테스트" 버튼으로 서버 상태 확인
- 로그 확인 (Android Studio → Logcat)

### 권한 오류
- 앱 삭제 후 재설치
- SMS 읽기 권한 다시 허용

## 📝 로그 확인 방법

Android Studio에서 로그 확인:

```
1. 폰을 USB로 PC에 연결
2. Android Studio → Logcat 탭
3. 필터에 "SmsReceiver" 입력
4. SMS 수신 시 로그 확인
```

## 🔄 업데이트 방법

새 버전 설치 시:

```
1. 새 APK 빌드
2. 기존 앱 위에 그냥 설치 (삭제 불필요)
3. 설정 유지됨
4. 완료!
```

## ⚠️ 주의사항

1. **폰을 항상 켜두세요** - 꺼지면 SMS를 받을 수 없음
2. **충전 상태 유지** - 배터리 방전 주의
3. **WiFi 또는 데이터 연결** - 서버 전송에 필요
4. **여러 폰에 설치 가능** - 같은 APK 사용

## 💡 활용 팁

### 여러 폰 사용 시

```
폰1 (은행 알림용): SMS Forwarder 설치 → 서버 URL 입력
폰2 (카드 알림용): SMS Forwarder 설치 → 서버 URL 입력
폰3 (택배 알림용): SMS Forwarder 설치 → 서버 URL 입력

→ 웹에서 모든 SMS 한 곳에서 확인!
```

### 구형폰 활용

```
- 안 쓰는 구형 스마트폰 활용
- WiFi만 연결하면 OK
- 유심 있어야 SMS 수신 가능
- 충전기에 꽂아두고 사용
```

## 🆘 지원

문제가 발생하면:
1. 로그 확인 (Logcat)
2. 서버 URL 재확인
3. 권한 재설정
4. 앱 재설치

---

**제작:** VIP Plus  
**버전:** 2.1.2 (GitHub Release 자동 배포)  
**최종 업데이트:** 2025-10-19  
**빌드:** GitHub Actions Auto Build + Release
**서버 URL:** https://vipmobile-backend.cloudtype.app

