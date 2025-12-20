# Google Drive 파일 저장 위치 안내

## 📍 현재 저장 위치

### 자동 생성된 폴더 구조

**코드 위치**: `server/index.js:4111-4204`

**폴더 구조**:
```
어플자료/
  └── 고객모드/
      └── {매장명}/
          ├── 매장사진/  (front, inside, outside, outside2 사진)
          └── 직원사진/  (manager, staff1, staff2, staff3 사진)
```

**현재 상태**:
- ✅ **자동으로 폴더 구조 생성 후 저장**
- ✅ **사진 타입에 따라 자동으로 매장사진 또는 직원사진 폴더에 저장**
- ⚠️ **일반 Google 계정으로는 직접 볼 수 없음** (서비스 계정 전용 공간)
- ✅ **첫 업로드 시 필요한 폴더가 자동으로 생성됨**

---

## 🔍 파일 확인 방법

### 방법 1: Google Cloud Console에서 확인 (권장)

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. **IAM 및 관리자** > **서비스 계정** 메뉴로 이동
4. 서비스 계정 이메일 클릭 (예: `xxx@project.iam.gserviceaccount.com`)
5. **키** 탭에서 서비스 계정 키 다운로드 (없는 경우)
6. 서비스 계정 이메일로 Google Drive 접속 시도
   - ⚠️ **주의**: 서비스 계정은 일반적으로 Google Drive 웹 인터페이스에 직접 로그인할 수 없음

### 방법 2: Google Drive API로 파일 목록 조회

서버에 다음 API를 추가하여 파일 목록을 확인할 수 있습니다:

```javascript
// GET /api/direct/store-image/list: 업로드된 파일 목록 조회
app.get('/api/direct/store-image/list', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: "mimeType contains 'image/'",
      fields: 'files(id, name, createdTime, webViewLink)',
      orderBy: 'createdTime desc',
      pageSize: 100
    });
    res.json(response.data.files);
  } catch (error) {
    console.error('파일 목록 조회 오류:', error);
    res.status(500).json({ error: '파일 목록을 불러오는데 실패했습니다.' });
  }
});
```

### 방법 3: 파일 URL로 확인

업로드된 파일의 URL을 통해 확인:
- URL 형식: `https://drive.google.com/uc?export=view&id=${fileId}`
- 구글시트의 `직영점_매장사진` 시트에서 URL 확인 가능

---

## 📂 특정 폴더에 저장하도록 변경하기

현재는 루트 디렉토리에 저장되지만, 특정 폴더에 저장하도록 변경할 수 있습니다.

### 옵션 1: 공유 폴더에 저장 (일반 계정에서도 확인 가능)

1. **Google Drive에서 폴더 생성**
   - 일반 Google 계정으로 Google Drive 접속
   - "매장 사진" 폴더 생성
   - 폴더 공유 설정에서 서비스 계정 이메일 추가 (편집 권한)

2. **폴더 ID 확인**
   - 폴더 URL에서 ID 추출: `https://drive.google.com/drive/folders/{폴더ID}`
   - 또는 폴더를 열고 URL에서 `folders/` 뒤의 문자열

3. **코드 수정**
   ```javascript
   const fileMetadata = {
     name: fileName,
     parents: ['폴더ID'] // 환경변수로 관리 권장
   };
   ```

### 옵션 2: 매장별 폴더 자동 생성

각 매장마다 폴더를 만들고 그 안에 저장:

```javascript
// 폴더 생성 또는 조회
async function getOrCreateStoreFolder(storeName) {
  const folderName = `매장사진_${storeName}`;
  
  // 기존 폴더 검색
  const searchResponse = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
    fields: 'files(id, name)'
  });
  
  if (searchResponse.data.files.length > 0) {
    return searchResponse.data.files[0].id;
  }
  
  // 폴더 생성
  const folderResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });
  
  // 폴더를 공개로 설정 (선택사항)
  await drive.permissions.create({
    fileId: folderResponse.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });
  
  return folderResponse.data.id;
}
```

---

## 💡 권장 사항

### 현재 구조 유지 (루트 디렉토리)
**장점**:
- 구현이 간단함
- 추가 설정 불필요
- 파일은 URL로 접근 가능

**단점**:
- 일반 계정으로 직접 확인 어려움
- 파일 관리가 어려울 수 있음

### 특정 폴더에 저장 (권장)
**장점**:
- 파일 관리 용이
- 일반 계정에서도 확인 가능 (공유 폴더인 경우)
- 정리된 구조

**단점**:
- 폴더 생성 및 공유 설정 필요
- 코드 수정 필요

---

## 🔧 즉시 적용 가능한 개선안

### 환경변수로 폴더 ID 관리

1. **환경변수 추가**
   ```bash
   GOOGLE_DRIVE_STORE_PHOTOS_FOLDER_ID=폴더ID
   ```

2. **코드 수정**
   ```javascript
   const fileMetadata = {
     name: fileName,
     parents: process.env.GOOGLE_DRIVE_STORE_PHOTOS_FOLDER_ID 
       ? [process.env.GOOGLE_DRIVE_STORE_PHOTOS_FOLDER_ID]
       : [] // 폴더 ID가 없으면 루트에 저장
   };
   ```

이렇게 하면:
- 폴더 ID가 설정되어 있으면 해당 폴더에 저장
- 설정되어 있지 않으면 루트 디렉토리에 저장 (현재 동작)

---

## 📋 요약

**현재 저장 위치**: 자동 생성된 폴더 구조
```
어플자료 > 고객모드 > {매장명} > (매장사진 또는 직원사진)
```

**폴더 자동 생성 로직**:
1. `어플자료` 폴더 생성 또는 조회
2. `고객모드` 폴더 생성 또는 조회 (어플자료 안에)
3. `{매장명}` 폴더 생성 또는 조회 (고객모드 안에)
4. `매장사진` 또는 `직원사진` 폴더 생성 또는 조회 (매장명 안에)
   - front, inside, outside, outside2 → 매장사진 폴더
   - manager, staff1, staff2, staff3 → 직원사진 폴더

**확인 방법**:
1. 구글시트의 `직영점_매장사진` 시트에서 URL 확인
2. 파일 URL로 직접 접근하여 확인
3. Google Drive API로 파일 목록 조회 (API 추가 필요)

**구현 완료**:
- ✅ 특정 폴더에 저장하도록 변경 완료
- ✅ 매장별 폴더 자동 생성 완료
- ✅ 사진 타입별 폴더 자동 분류 완료

---

**참고**: 서비스 계정의 Google Drive는 일반 Google 계정과는 별도의 공간입니다. 파일은 정상적으로 저장되며, URL을 통해 접근 가능합니다. 폴더 구조는 자동으로 생성되며, 이미 존재하는 폴더는 재사용됩니다.



