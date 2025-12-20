# Google Sheets 편집 vs Google Drive 이미지 업로드 - 차이점 설명

## 🤔 왜 Google Sheets는 편집이 되는데 이미지 업로드는 안 될까?

이것은 Google의 API 설계와 정책 차이 때문입니다. 핵심 차이점을 설명합니다.

---

## 📊 Google Sheets API (편집 작업)

### 작동 방식
- **작업 유형**: 기존 파일의 **데이터를 수정**하는 작업
- **저장 공간**: 새로 사용하지 않음 (기존 파일 내부의 데이터만 변경)
- **권한**: Service Account가 스프레드시트에 "편집자" 권한만 있으면 가능

### 예시
```javascript
// ✅ 작동함: 셀 값 변경 (저장 공간 사용 안 함)
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '시트1!A1',
  valueInputOption: 'RAW',
  resource: { values: [['새로운 값']] }
});

// ✅ 작동함: 행 추가 (기존 파일에 데이터 추가)
await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: '시트1!A:Z',
  valueInputOption: 'RAW',
  resource: { values: [['새 행 데이터']] }
});
```

### 왜 작동하는가?
1. **기존 파일 수정**: 새 파일을 만드는 게 아니라 기존 스프레드시트의 내용만 변경
2. **저장 공간 불필요**: 스프레드시트 파일 자체는 이미 존재하고, 그 안의 데이터만 변경
3. **권한만 필요**: Service Account가 스프레드시트에 "편집자" 권한이 있으면 가능

---

## 📁 Google Drive API (파일 업로드)

### 작동 방식
- **작업 유형**: **새 파일을 생성**하는 작업
- **저장 공간**: 새로 사용함 (새 파일이 생성되므로)
- **권한**: Service Account가 폴더에 "편집자" 권한이 있어도, **저장 공간 할당량이 없으면 실패**

### 예시
```javascript
// ❌ 개인 드라이브에 저장 시도 → 실패
await drive.files.create({
  requestBody: {
    name: 'image.jpg',
    parents: [folderId] // 개인 드라이브의 폴더
  },
  media: { body: imageStream }
});
// 에러: "Service Accounts do not have storage quota"

// ✅ Shared Drive에 저장 → 성공
await drive.files.create({
  requestBody: {
    name: 'image.jpg',
    parents: [folderId],
    driveId: sharedDriveId // Shared Drive ID
  },
  media: { body: imageStream }
});
```

### 왜 작동하지 않는가?
1. **새 파일 생성**: 기존 파일 수정이 아니라 완전히 새로운 파일을 만듦
2. **저장 공간 필요**: 새 파일을 저장하려면 저장 공간 할당량이 필요
3. **Service Account의 한계**: Service Account는 **저장 공간 할당량이 없음**
   - 개인 드라이브(My Drive)에 저장하려면 → 할당량 필요 → 실패 ❌
   - Shared Drive에 저장하려면 → 조직의 할당량 사용 → 성공 ✅

---

## 🔍 핵심 차이점 비교표

| 항목 | Google Sheets 편집 | Google Drive 업로드 |
|------|-------------------|---------------------|
| **작업 유형** | 기존 파일 데이터 수정 | 새 파일 생성 |
| **저장 공간** | 사용 안 함 | 새로 사용함 |
| **Service Account 할당량** | 불필요 | 필요 (없으면 실패) |
| **개인 드라이브** | ✅ 가능 (편집 권한만 있으면) | ❌ 불가능 (할당량 없음) |
| **Shared Drive** | ✅ 가능 | ✅ 가능 (조직 할당량 사용) |
| **공유 폴더** | ✅ 가능 | ❌ 불가능 (개인 드라이브에 있으면) |

---

## 💡 비유로 이해하기

### Google Sheets 편집 = 책의 내용 수정
- 기존 책(스프레드시트)이 이미 있음
- 책의 페이지 내용만 수정 (새 책을 만드는 게 아님)
- 책장 공간을 새로 사용하지 않음
- **권한만 있으면 가능**

### Google Drive 업로드 = 새 책을 책장에 추가
- 완전히 새로운 책(파일)을 만듦
- 책장에 공간이 필요함
- Service Account는 **책장 공간이 없음**
- 개인 책장(My Drive)에는 추가 불가 ❌
- 공용 책장(Shared Drive)에는 추가 가능 ✅

---

## 🎯 실제 코드에서의 차이

### 현재 코드: Google Sheets 편집
```javascript
// server/index.js
// ✅ 작동함: 기존 스프레드시트의 데이터만 변경
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '시트1!A:Z'
});

await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '시트1!A1',
  valueInputOption: 'RAW',
  resource: { values: [['새 값']] }
});
```

### 현재 코드: Google Drive 이미지 업로드
```javascript
// server/index.js
// ❌ 개인 드라이브에 저장 시도 → 실패
// ✅ Shared Drive에 저장 → 성공
const fileMetadata = {
  name: fileName,
  parents: [folderId]
};

// Shared Drive인 경우 driveId 지정
if (driveId) {
  fileMetadata.driveId = driveId;
}

await drive.files.create({
  requestBody: fileMetadata,
  media: { body: imageStream },
  supportsAllDrives: true
});
```

---

## 📝 요약

### Google Sheets 편집이 되는 이유
- 기존 파일의 **데이터만 수정**하는 작업
- 저장 공간을 새로 사용하지 않음
- Service Account가 스프레드시트에 "편집자" 권한만 있으면 가능

### Google Drive 업로드가 안 되는 이유
- **새 파일을 생성**하는 작업
- 저장 공간을 새로 사용함
- Service Account는 **저장 공간 할당량이 없음**
- 개인 드라이브에 저장하려면 할당량 필요 → 실패
- Shared Drive에 저장하려면 조직 할당량 사용 → 성공

---

## 🔧 해결 방법

### 방법 1: Shared Drive 사용 (권장)
- Google Workspace 구독 필요 (유료)
- Shared Drive 생성 후 Service Account 추가
- 조직의 저장 공간 할당량 사용

### 방법 2: OAuth Delegation
- Google Workspace 관리자 권한 필요
- Service Account가 사용자 계정을 대신해 저장
- 사용자의 저장 공간 할당량 사용

### 방법 3: 공유 폴더 (현재 시도 중)
- 개인 드라이브의 공유 폴더
- **일반적으로 작동하지 않음** (할당량 문제)
- 하지만 테스트해볼 가치는 있음

---

## ❓ 자주 묻는 질문

**Q: 왜 같은 Service Account인데 Sheets는 되고 Drive는 안 되나요?**  
A: Sheets는 기존 파일 수정(저장 공간 불필요), Drive는 새 파일 생성(저장 공간 필요)이기 때문입니다.

**Q: 공유 폴더에 "편집자" 권한을 주면 안 되나요?**  
A: 권한은 있지만, 저장 공간 할당량이 없어서 개인 드라이브에는 저장할 수 없습니다.

**Q: Google Sheets 파일도 개인 드라이브에 있는데 왜 편집이 되나요?**  
A: 편집은 기존 파일의 데이터만 변경하는 것이므로 저장 공간을 새로 사용하지 않습니다.

**Q: Shared Drive 없이 해결할 방법이 있나요?**  
A: OAuth Delegation을 사용하면 가능하지만, Google Workspace 관리자 권한이 필요합니다.


