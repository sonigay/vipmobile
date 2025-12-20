# Discord 이미지 URL 만료 문제 해결 방안

## 🔍 문제 상황

1. **현재 상황**:
   - Discord에 이미지를 업로드하면 처음에는 URL이 작동함
   - 시간이 지나면 URL이 만료되어 이미지가 로드되지 않음
   - 하지만 Discord 앱에서는 이미지가 여전히 존재함

2. **보유 정보**:
   - 게시판 ID (postId/threadId)
   - 몇 번째 메시지인지 (인덱스)
   - **메시지 ID는 저장하지 않음** (현재)

---

## ✅ 해결 가능성: **가능함**

Discord.js를 사용하면 메시지를 다시 조회해서 최신 attachment URL을 가져올 수 있습니다.

---

## 🎯 해결 방안

### 방법 1: 메시지 ID 저장 (권장) ⭐

**장점**:
- 가장 정확하고 확실한 방법
- 메시지를 직접 조회 가능
- 다른 메시지 추가와 무관

**구현 방법**:
1. 업로드 시 `message.id` 저장
2. URL 만료 감지 시 메시지 ID로 재조회
3. 최신 attachment URL 가져오기

**코드 예시**:
```javascript
// 업로드 시 메시지 ID 저장
const result = {
  imageUrl: message.attachments.first().url,
  messageId: message.id,  // 추가
  postId: post.id,
  threadId: thread.id
};

// URL 갱신 함수
async function refreshDiscordImageUrl(threadId, messageId) {
  try {
    const thread = await discordBot.channels.fetch(threadId);
    const message = await thread.messages.fetch(messageId);
    const attachment = message.attachments.first();
    
    if (attachment) {
      return attachment.url; // 최신 URL 반환
    }
    return null;
  } catch (error) {
    console.error('Discord 메시지 조회 실패:', error);
    return null;
  }
}
```

---

### 방법 2: 메시지 인덱스로 찾기 (대안)

**장점**:
- 기존 데이터 구조 유지 가능
- 메시지 ID 저장 불필요

**단점**:
- 다른 메시지가 추가되면 인덱스가 변경될 수 있음
- 덜 정확함

**구현 방법**:
1. threadId와 메시지 인덱스로 메시지 목록 조회
2. 특정 인덱스의 메시지 찾기
3. attachment URL 가져오기

**코드 예시**:
```javascript
async function refreshDiscordImageUrlByIndex(threadId, messageIndex) {
  try {
    const thread = await discordBot.channels.fetch(threadId);
    const messages = await thread.messages.fetch({ limit: 100 });
    const messageArray = Array.from(messages.values());
    
    // 인덱스로 메시지 찾기 (최신 메시지가 첫 번째)
    const message = messageArray[messageIndex];
    
    if (message) {
      const attachment = message.attachments.first();
      if (attachment) {
        return attachment.url;
      }
    }
    return null;
  } catch (error) {
    console.error('Discord 메시지 조회 실패:', error);
    return null;
  }
}
```

---

## 🔧 구현 단계

### 1단계: 메시지 ID 저장 추가

**파일**: `server/meetingRoutes.js`

```javascript
// uploadImageToDiscord 함수 수정
const result = {
  imageUrl: message.attachments.first().url,
  messageId: message.id,  // 추가
  postId: post.id,
  threadId: thread.id
};
```

### 2단계: URL 갱신 API 엔드포인트 생성

**새 엔드포인트**: `GET /api/discord/refresh-image-url`

```javascript
app.get('/api/discord/refresh-image-url', async (req, res) => {
  try {
    const { threadId, messageId } = req.query;
    
    if (!threadId || !messageId) {
      return res.status(400).json({
        success: false,
        error: 'threadId와 messageId가 필요합니다.'
      });
    }
    
    const thread = await discordBot.channels.fetch(threadId);
    const message = await thread.messages.fetch(messageId);
    const attachment = message.attachments.first();
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: '첨부파일을 찾을 수 없습니다.'
      });
    }
    
    return res.json({
      success: true,
      imageUrl: attachment.url,
      messageId: message.id,
      threadId: thread.id
    });
  } catch (error) {
    console.error('Discord URL 갱신 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### 3단계: 프론트엔드에서 URL 만료 감지 및 갱신

**파일**: `src/api/directStoreApi.js` 또는 관련 파일

```javascript
// 이미지 로드 실패 시 URL 갱신 시도
async function loadImageWithRefresh(imageUrl, threadId, messageId) {
  try {
    // 먼저 원본 URL 시도
    const img = new Image();
    img.src = imageUrl;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = async () => {
        // URL 만료 감지 - 갱신 시도
        try {
          const response = await fetch(
            `/api/discord/refresh-image-url?threadId=${threadId}&messageId=${messageId}`
          );
          const data = await response.json();
          
          if (data.success) {
            img.src = data.imageUrl; // 새 URL로 재시도
            img.onload = resolve;
            img.onerror = reject;
          } else {
            reject(new Error('URL 갱신 실패'));
          }
        } catch (error) {
          reject(error);
        }
      };
    });
    
    return img.src;
  } catch (error) {
    console.error('이미지 로드 실패:', error);
    throw error;
  }
}
```

---

## 📊 데이터 저장 구조

### Google Sheets에 저장할 정보

현재 저장 중인 정보:
- `imageUrl`: Discord 이미지 URL
- `postId`: 게시판 ID
- `threadId`: 스레드 ID

**추가 저장 필요**:
- `messageId`: 메시지 ID (방법 1 권장)
- 또는 `messageIndex`: 메시지 인덱스 (방법 2)

---

## ⚠️ 주의사항

1. **Discord API Rate Limit**:
   - 메시지 조회 시 API 호출 제한 있음
   - 너무 자주 갱신하지 않도록 주의

2. **메시지 삭제 가능성**:
   - 메시지가 삭제되면 조회 불가
   - 에러 처리 필요

3. **채널 접근 권한**:
   - 봇이 채널에 접근할 수 있어야 함
   - 권한 확인 필요

---

## 🎯 권장 구현 순서

1. **즉시 구현**: 메시지 ID 저장 추가
   - 기존 코드에 `messageId` 추가
   - Google Sheets에 `messageId` 컬럼 추가

2. **URL 갱신 API 구현**:
   - `/api/discord/refresh-image-url` 엔드포인트 생성
   - 메시지 ID로 메시지 조회 및 URL 반환

3. **프론트엔드 통합**:
   - 이미지 로드 실패 시 자동 갱신
   - 또는 주기적 갱신 (선택사항)

---

## 📝 요약

**가능성**: ✅ **가능함**

**권장 방법**: 메시지 ID 저장 후 재조회

**핵심 포인트**:
1. 업로드 시 `message.id` 저장
2. URL 만료 시 메시지 ID로 재조회
3. 최신 attachment URL 가져오기
4. 프론트엔드에서 자동 갱신 로직 구현

**예상 효과**:
- URL 만료 문제 해결
- 이미지 지속적 표시 가능
- 사용자 경험 개선


