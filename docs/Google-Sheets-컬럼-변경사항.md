# Google Sheets 컬럼 헤더 변경 사항 (Discord 메시지 ID 추가)

## 📋 현재 상태

### 회의설정 시트 컬럼 구조 (A~V, 22개 컬럼)

| 컬럼 | 헤더명 | 설명 | 저장 데이터 |
|------|--------|------|-------------|
| A | 회의ID | 회의 고유 ID | meetingId |
| B | 슬라이드ID | 슬라이드 고유 ID | slideId |
| C | 순서 | 슬라이드 순서 | order |
| D | 타입 | 슬라이드 타입 | slideType |
| E | 모드 | 슬라이드 모드 | slideMode |
| F | 탭 | 탭 값 | tabValue |
| G | 제목 | 슬라이드 제목 | slide.title |
| H | 내용 | 슬라이드 내용 | slide.content |
| I | 배경색 | 배경색 | slide.backgroundColor |
| J | 이미지URL | 이미지 URL | mergedImageUrl |
| K | 동영상URL | 동영상 URL | mergedVideoUrl |
| L | 캡처시간 | 캡처 시간 | mergedCapturedAt |
| M | Discord포스트ID | Discord 포스트 ID | mergedDiscordPostId |
| N | Discord스레드ID | Discord 스레드 ID | mergedDiscordThreadId |
| O | 탭라벨 | 탭 라벨 | slide.tabLabel |
| P | 서브탭라벨 | 서브탭 라벨 | slide.subTabLabel |
| Q | 세부항목옵션 | 세부항목 옵션 | slide.detailLabel |
| R | 회의날짜 | 회의 날짜 | slide.meetingDate |
| S | 회의차수 | 회의 차수 | slide.meetingNumber |
| T | 회의장소 | 회의 장소 | slide.meetingLocation |
| U | 참석자 | 참석자 | slide.participants |
| V | 생성자 | 생성자 | slide.createdBy |

---

## ✅ 변경 사항

### 추가할 컬럼

**W열: Discord메시지ID**
- **목적**: Discord 메시지 ID 저장 (URL 갱신용)
- **데이터 타입**: 문자열 (Discord 메시지 ID)
- **저장 위치**: W열 (23번째 컬럼)

---

## 🔧 코드 변경 사항

### 1. 헤더 정의 업데이트

**파일**: `server/meetingRoutes.js`

**현재 코드** (라인 465, 591):
```javascript
await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
  '회의ID', '슬라이드ID', '순서', '타입', '모드', '탭', '제목', '내용', '배경색', '이미지URL', '동영상URL', '캡처시간', 'Discord포스트ID', 'Discord스레드ID', '탭라벨', '서브탭라벨', '세부항목옵션', '회의날짜', '회의차수', '회의장소', '참석자', '생성자'
]);
```

**변경 후**:
```javascript
await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
  '회의ID', '슬라이드ID', '순서', '타입', '모드', '탭', '제목', '내용', '배경색', '이미지URL', '동영상URL', '캡처시간', 'Discord포스트ID', 'Discord스레드ID', 'Discord메시지ID', '탭라벨', '서브탭라벨', '세부항목옵션', '회의날짜', '회의차수', '회의장소', '참석자', '생성자'
]);
```

---

### 2. 데이터 범위 업데이트

**현재 코드** (라인 470, 596):
```javascript
const range = `${sheetName}!A3:V`;
```

**변경 후**:
```javascript
const range = `${sheetName}!A3:W`;
```

---

### 3. newRow 배열에 messageId 추가

**파일**: `server/meetingRoutes.js`

**현재 코드** (라인 720-743):
```javascript
const newRow = [
  meetingId,
  slideId,
  order,
  slideType,
  slideMode,
  tabValue,
  slide.title || '',
  slide.content || '',
  slide.backgroundColor || '#ffffff',
  mergedImageUrl,
  mergedVideoUrl,
  mergedCapturedAt,
  mergedDiscordPostId,
  mergedDiscordThreadId,
  slide.tabLabel || '',
  slide.subTabLabel || '',
  slide.detailLabel || '',
  slide.meetingDate || '',
  slide.meetingNumber || '',
  slide.meetingLocation || '',
  slide.participants || '',
  slide.createdBy || ''
];
```

**변경 후**:
```javascript
const newRow = [
  meetingId,
  slideId,
  order,
  slideType,
  slideMode,
  tabValue,
  slide.title || '',
  slide.content || '',
  slide.backgroundColor || '#ffffff',
  mergedImageUrl,
  mergedVideoUrl,
  mergedCapturedAt,
  mergedDiscordPostId,
  mergedDiscordThreadId,
  mergedDiscordMessageId,  // 추가
  slide.tabLabel || '',
  slide.subTabLabel || '',
  slide.detailLabel || '',
  slide.meetingDate || '',
  slide.meetingNumber || '',
  slide.meetingLocation || '',
  slide.participants || '',
  slide.createdBy || ''
];
```

---

### 4. mergedDiscordMessageId 변수 생성

**파일**: `server/meetingRoutes.js`

**위치**: `mergedDiscordPostId`, `mergedDiscordThreadId` 생성 부분 근처

**추가할 코드**:
```javascript
// Discord 메시지 ID 병합 (최신 값 우선)
const mergedDiscordMessageId = slide.discordMessageId || 
  (existingRow && existingRow[14]) || // 기존 데이터에서 가져오기 (W열, 인덱스 14)
  '';
```

---

### 5. 업데이트 범위 수정

**현재 코드** (라인 747):
```javascript
const updateRange = `${sheetName}!A${existingRowIndex + 3}:V${existingRowIndex + 3}`;
```

**변경 후**:
```javascript
const updateRange = `${sheetName}!A${existingRowIndex + 3}:W${existingRowIndex + 3}`;
```

---

### 6. uploadImageToDiscord 함수 수정

**파일**: `server/meetingRoutes.js`

**현재 코드** (라인 1216-1220):
```javascript
const result = {
  imageUrl: message.attachments.first().url,
  postId: post.id,
  threadId: thread.id
};
```

**변경 후**:
```javascript
const result = {
  imageUrl: message.attachments.first().url,
  messageId: message.id,  // 추가
  postId: post.id,
  threadId: thread.id
};
```

---

### 7. uploadMeetingImage에서 messageId 저장

**파일**: `server/meetingRoutes.js`

**현재 코드**: `result` 객체에 `messageId`가 포함되어 있지만, Google Sheets에 저장하지 않음

**추가 필요**: `uploadMeetingImage` 함수에서 이미지 업로드 후 Google Sheets에 `messageId` 저장 로직 추가

---

## 📝 요약

### 변경할 파일
1. `server/meetingRoutes.js`

### 변경 사항
1. ✅ 헤더에 'Discord메시지ID' 추가 (W열)
2. ✅ 데이터 범위를 A3:V → A3:W로 변경
3. ✅ newRow 배열에 mergedDiscordMessageId 추가
4. ✅ mergedDiscordMessageId 변수 생성 로직 추가
5. ✅ updateRange를 A:V → A:W로 변경
6. ✅ uploadImageToDiscord에서 messageId 반환 추가
7. ✅ uploadMeetingImage에서 messageId를 Google Sheets에 저장

### Google Sheets 수동 작업
- **필요 없음**: `ensureSheetHeaders` 함수가 자동으로 헤더를 생성/확인함

---

## ⚠️ 주의사항

1. **기존 데이터 호환성**:
   - 기존 행에는 W열이 비어있을 수 있음
   - 새로 업로드되는 이미지만 messageId가 저장됨
   - 기존 데이터는 URL 갱신 시 수동으로 messageId를 찾아야 할 수 있음

2. **데이터 마이그레이션** (선택사항):
   - 기존 이미지의 messageId를 찾아서 채우는 스크립트 작성 가능
   - 하지만 Discord API rate limit 고려 필요

---

## 🎯 구현 순서

1. `uploadImageToDiscord` 함수에 `messageId` 추가
2. 헤더 정의에 'Discord메시지ID' 추가
3. 데이터 범위를 A3:W로 변경
4. `mergedDiscordMessageId` 변수 생성 로직 추가
5. `newRow` 배열에 `mergedDiscordMessageId` 추가
6. `updateRange`를 A:W로 변경
7. 테스트: 이미지 업로드 후 Google Sheets에 messageId 저장 확인


