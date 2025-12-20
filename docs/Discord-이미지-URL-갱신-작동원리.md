# Discord 이미지 URL 갱신 작동 원리

## 🔍 작동 원리 설명

### ❌ 잘못된 이해
**"URL을 직접 로드한다"**
- 만료된 URL을 그대로 사용하려고 시도
- 시간이 지나면 URL이 만료되어 이미지 로드 실패

### ✅ 올바른 작동 원리
**"Discord 메시지 ID로 메시지를 조회 → 메시지의 attachment에서 최신 URL 가져오기 → 그 URL로 이미지 로드"**

---

## 📊 단계별 작동 흐름

### 1단계: 이미지 업로드 시 (최초)
```
사용자가 이미지 업로드
    ↓
Discord에 이미지 업로드
    ↓
Discord가 메시지 생성
    ↓
메시지 객체 반환:
  - message.id (메시지 ID) ← 저장 필요!
  - message.attachments.first().url (이미지 URL)
    ↓
Google Sheets에 저장:
  - imageUrl: "https://cdn.discordapp.com/attachments/..."
  - messageId: "1234567890123456789"
  - threadId: "9876543210987654321"
```

### 2단계: 이미지 표시 시 (일반)
```
프론트엔드에서 이미지 표시
    ↓
저장된 imageUrl 사용
    ↓
이미지 로드 시도
    ↓
성공 → 이미지 표시 ✅
실패 → 3단계로 이동
```

### 3단계: URL 만료 감지 및 갱신
```
이미지 로드 실패 (URL 만료)
    ↓
Discord 메시지 ID로 메시지 조회
  API: GET /api/discord/refresh-image-url?threadId=...&messageId=...
    ↓
서버에서 Discord API 호출:
  const thread = await discordBot.channels.fetch(threadId);
  const message = await thread.messages.fetch(messageId);
  const attachment = message.attachments.first();
  const newUrl = attachment.url; // 최신 URL
    ↓
최신 URL 반환
    ↓
프론트엔드에서 새 URL로 이미지 로드
    ↓
이미지 표시 성공 ✅
```

---

## 💡 핵심 개념

### Discord의 Attachment URL 특성

1. **URL은 만료될 수 있음**
   - Discord CDN의 보안 정책
   - 시간이 지나면 URL이 만료됨
   - 하지만 이미지 자체는 삭제되지 않음

2. **메시지는 영구 보존**
   - 메시지가 삭제되지 않는 한 계속 존재
   - 메시지 ID로 언제든지 조회 가능

3. **최신 URL은 항상 가져올 수 있음**
   - 메시지를 조회하면 attachment 객체에서 최신 URL 제공
   - 만료된 URL이 아닌 새로운 URL 반환

---

## 🔧 실제 코드 예시

### 서버 측 (URL 갱신 API)

```javascript
// GET /api/discord/refresh-image-url
app.get('/api/discord/refresh-image-url', async (req, res) => {
  const { threadId, messageId } = req.query;
  
  // 1. Discord에서 메시지 조회
  const thread = await discordBot.channels.fetch(threadId);
  const message = await thread.messages.fetch(messageId);
  
  // 2. 메시지의 attachment에서 최신 URL 가져오기
  const attachment = message.attachments.first();
  
  if (!attachment) {
    return res.status(404).json({ error: '첨부파일 없음' });
  }
  
  // 3. 최신 URL 반환
  return res.json({
    success: true,
    imageUrl: attachment.url, // ← 이게 최신 URL!
    messageId: message.id,
    threadId: thread.id
  });
});
```

### 프론트엔드 측 (이미지 로드)

```javascript
// 이미지 로드 함수
async function loadImage(imageUrl, threadId, messageId) {
  const img = new Image();
  
  // 1차 시도: 저장된 URL 사용
  img.src = imageUrl;
  
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img.src);
    
    img.onerror = async () => {
      // URL 만료 감지 → 갱신 시도
      try {
        const response = await fetch(
          `/api/discord/refresh-image-url?threadId=${threadId}&messageId=${messageId}`
        );
        const data = await response.json();
        
        if (data.success) {
          // 2차 시도: 갱신된 URL 사용
          img.src = data.imageUrl; // ← 최신 URL로 재시도
          
          img.onload = () => resolve(img.src);
          img.onerror = () => reject(new Error('이미지 로드 실패'));
        } else {
          reject(new Error('URL 갱신 실패'));
        }
      } catch (error) {
        reject(error);
      }
    };
  });
}
```

---

## 🎯 정리

### 질문: "URL을 로드한다 vs 메시지 ID로 메시지를 로드한다?"

**답변**: **메시지 ID로 메시지를 조회해서 최신 URL을 가져온 후, 그 URL로 이미지를 로드합니다.**

### 작동 순서:
1. ✅ **메시지 ID로 메시지 조회** (Discord API)
2. ✅ **메시지의 attachment에서 최신 URL 추출**
3. ✅ **추출한 URL로 이미지 로드** (일반적인 이미지 로드)

### 왜 이렇게 하나요?
- Discord의 attachment URL은 만료될 수 있음
- 하지만 메시지 자체는 영구 보존됨
- 메시지를 조회하면 항상 최신 URL을 받을 수 있음
- 따라서 메시지 ID를 저장해두면, URL이 만료되어도 언제든지 최신 URL을 가져올 수 있음

---

## 📝 비유로 이해하기

### 일반적인 이미지 URL (만료 없음)
```
이미지 URL → 직접 이미지 로드
예: https://example.com/image.jpg
```

### Discord 이미지 URL (만료 가능)
```
저장된 URL (만료됨) → 로드 실패 ❌
    ↓
메시지 ID로 메시지 조회
    ↓
메시지에서 최신 URL 가져오기
    ↓
최신 URL → 이미지 로드 성공 ✅
```

**마치 "열쇠(메시지 ID)"로 "금고(메시지)"를 열어서 "새 열쇠(최신 URL)"를 꺼내는 것과 같습니다.**
