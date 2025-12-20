# Google Drive API 설정 가이드

## ✅ 구현 완료

매장 사진 파일 업로드 기능이 Google Drive API를 사용하도록 수정되었습니다.

## 📋 필요한 설정

### 1. Google Cloud Console에서 Drive API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (현재 Google Sheets API를 사용하는 프로젝트)
3. **API 및 서비스** > **라이브러리** 메뉴로 이동
4. "Google Drive API" 검색
5. **사용 설정** 클릭

### 2. 서비스 계정 권한 확인

현재 사용 중인 서비스 계정이 Google Drive API를 사용할 수 있는지 확인:

- 서비스 계정 이메일: `GOOGLE_SERVICE_ACCOUNT_EMAIL` 환경변수
- 서비스 계정 키: `GOOGLE_PRIVATE_KEY` 환경변수

**이미 Google Sheets API를 사용 중이라면 동일한 서비스 계정을 사용하면 됩니다.**

### 3. 환경변수 확인

다음 환경변수가 설정되어 있는지 확인:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 🔧 구현 내용

### 변경 사항

1. **Google API 인증 설정 수정**
   - `scopes`에 `https://www.googleapis.com/auth/drive.file` 추가
   - Google Drive 파일 업로드 권한 부여

2. **Google Drive API 클라이언트 생성**
   ```javascript
   const drive = google.drive({ version: 'v3', auth });
   ```

3. **파일 업로드 로직 변경**
   - 로컬 파일 시스템에 임시 저장
   - Google Drive에 파일 업로드
   - 공개 링크 생성 (`https://drive.google.com/uc?export=view&id=${fileId}`)
   - 로컬 파일 삭제

### 파일 저장 위치

- **Google Drive**: 자동 생성된 폴더 구조에 저장
- **폴더 구조**: 
  ```
  어플자료/
    └── 고객모드/
        └── {매장명}/
            ├── 매장사진/  (front, inside, outside, outside2)
            └── 직원사진/  (manager, staff1, staff2, staff3)
  ```
- **파일명 형식**: `{매장명}_{사진타입}_{타임스탬프}.{확장자}`
  - 예: `VIP직영점_강남점_front_1703123456789.jpg`

**폴더 자동 생성**:
- 첫 업로드 시 필요한 폴더가 자동으로 생성됩니다
- 이미 존재하는 폴더는 재사용됩니다
- 각 매장마다 별도의 폴더가 생성됩니다

**⚠️ 중요**: 
- 서비스 계정의 Google Drive는 일반 Google 계정으로는 직접 볼 수 없습니다
- 파일은 정상적으로 저장되며, URL을 통해 접근 가능합니다
- 파일 확인은 구글시트의 `직영점_매장사진` 시트에서 URL을 확인하거나, 파일 URL로 직접 접근할 수 있습니다

### 공개 링크

업로드된 파일은 자동으로 공개 설정되어 누구나 링크로 접근 가능합니다.

**링크 형식:**
- 직접 보기: `https://drive.google.com/uc?export=view&id=${fileId}`
- 썸네일: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`

## 🧪 테스트 방법

1. 서버 재시작
2. 직영점모드 또는 직영점관리모드에서 "선호구입매장" 탭 접속
3. 매장 선택 후 편집 다이얼로그 열기
4. 사진 필드 옆의 업로드 버튼 클릭
5. 이미지 파일 선택
6. 업로드 완료 후 URL이 자동으로 입력되는지 확인
7. 저장 후 구글시트에 URL이 저장되는지 확인

## ⚠️ 주의사항

1. **Google Drive API 할당량**
   - 무료 할당량: 15GB 저장 공간
   - 일일 API 호출 제한: 1,000,000,000회 (충분함)

2. **파일 크기 제한**
   - 현재 설정: 10MB
   - Google Drive 제한: 5TB (단일 파일)

3. **공개 링크**
   - 파일은 공개 설정되어 있지만, 파일 ID를 모르면 접근 불가
   - 보안을 위해 파일 ID는 노출하지 않는 것이 좋습니다

## 🔍 문제 해결

### 오류: "Drive API has not been used in project"

**해결 방법:**
1. Google Cloud Console에서 Drive API 활성화
2. 서버 재시작

### 오류: "Insufficient Permission"

**해결 방법:**
1. 서비스 계정에 Drive API 권한이 있는지 확인
2. Google Cloud Console에서 서비스 계정 권한 확인

### 오류: "File not found"

**해결 방법:**
1. 파일이 실제로 Google Drive에 업로드되었는지 확인
2. 서비스 계정의 Google Drive 확인

## 📝 추가 개선 사항 (선택)

### 특정 폴더에 저장하기

현재는 루트 디렉토리에 저장되지만, 특정 폴더에 저장하려면:

```javascript
const fileMetadata = {
  name: fileName,
  parents: ['폴더ID'] // Google Drive 폴더 ID
};
```

### 폴더 자동 생성

매장별로 폴더를 만들고 싶다면:

```javascript
// 폴더 생성
const folderResponse = await drive.files.create({
  requestBody: {
    name: storeName,
    mimeType: 'application/vnd.google-apps.folder'
  },
  fields: 'id'
});

const folderId = folderResponse.data.id;

// 파일을 해당 폴더에 저장
const fileMetadata = {
  name: fileName,
  parents: [folderId]
};
```

---

**구현 완료일**: 2024-12-XX
**상태**: ✅ 완료


