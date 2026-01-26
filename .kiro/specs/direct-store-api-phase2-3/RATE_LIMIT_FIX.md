# Discord Rate Limit 수정 완료

## 문제점
- LG 이미지 170개 갱신 시 170개 중 많은 수가 Discord Rate Limit (429 오류)로 실패
- 기존 100ms 지연으로는 Discord API Rate Limit을 피할 수 없음

## 해결 방법

### 1. `withDiscordRateLimit` 함수 추가
**위치**: `server/directRoutes.js` (line ~1935)

```javascript
async function withDiscordRateLimit(fn, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Rate Limit 에러 감지 (429)
      const isRateLimitError = 
        error.message && error.message.includes('429') ||
        error.message && error.message.includes('rate limit');
      
      if (isRateLimitError && attempt < maxRetries - 1) {
        // Discord API가 제공하는 retry_after 값 추출
        let retryAfter = 0.5; // 기본값 500ms
        
        try {
          const match = error.message.match(/"retry_after":\s*([\d.]+)/);
          if (match) {
            retryAfter = parseFloat(match[1]);
          }
        } catch (parseError) {
          // 파싱 실패 시 기본값 사용
        }
        
        // Exponential backoff: retry_after + 추가 지연
        const baseDelay = retryAfter * 1000; // 초를 밀리초로 변환
        const exponentialDelay = Math.pow(2, attempt) * 100; // 100ms, 200ms, 400ms, 800ms...
        const jitter = Math.random() * 100; // 0~100ms 랜덤
        const totalDelay = baseDelay + exponentialDelay + jitter;
        
        console.warn(`⚠️ [withDiscordRateLimit] Rate Limit 발생, ${Math.round(totalDelay)}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
        continue;
      }
      
      // Rate Limit 에러가 아니거나 최대 재시도 횟수 초과
      throw error;
    }
  }
  throw new Error('Max retries exceeded for Discord API');
}
```

**특징**:
- Discord API가 제공하는 `retry_after` 값을 파싱하여 정확한 대기 시간 계산
- Exponential Backoff: 재시도마다 지연 시간 증가 (100ms → 200ms → 400ms → 800ms → 1600ms)
- Jitter: 랜덤 지연 추가로 동시 요청 분산
- 최대 5번 재시도

### 2. `fetchImageUrlFromDiscordMessage` 함수 수정
**변경 전**:
```javascript
async function fetchImageUrlFromDiscordMessage(messageId, postId, threadId) {
  // ...
  try {
    const response = await fetch(url, { ... });
    // ...
  } catch (error) {
    throw error;
  }
}
```

**변경 후**:
```javascript
async function fetchImageUrlFromDiscordMessage(messageId, postId, threadId) {
  // ...
  return withDiscordRateLimit(async () => {
    const response = await fetch(url, { ... });
    // ...
  });
}
```

### 3. 불필요한 100ms 지연 제거
**변경 전**:
```javascript
// Discord API Rate Limit 고려: 요청 간 지연
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 지연
```

**변경 후**:
```javascript
// Discord API Rate Limit은 withDiscordRateLimit 함수에서 자동 처리됨
```

## 예상 효과
1. ✅ **Rate Limit 자동 재시도**: 429 오류 발생 시 자동으로 재시도
2. ✅ **지능적인 대기 시간**: Discord API가 제공하는 `retry_after` 값 사용
3. ✅ **성능 향상**: 불필요한 100ms 지연 제거로 정상 요청은 더 빠르게 처리
4. ✅ **안정성 향상**: Exponential Backoff로 Rate Limit 회피 확률 증가

## 테스트 방법

### 1. 서버 재시작
```bash
# 기존 서버 종료 (PID 2388)
# Windows에서 수동으로 종료하거나:
taskkill /F /PID 2388

# 서버 재시작
cd server
node index.js
```

### 2. 테스트 실행
```bash
cd server
node test-rate-limit-fix.js
```

### 3. 예상 결과
- **이전**: 170개 중 많은 수 실패 (Rate Limit 429)
- **이후**: 대부분 성공, 일부만 실패 (재시도 후에도 Rate Limit 발생 시)

## 추가 개선 사항 (선택)
필요 시 다음 개선 가능:
1. **배치 처리**: 한 번에 10개씩 처리하고 배치 간 지연 추가
2. **Rate Limit 추적**: 전역 Rate Limit 카운터로 요청 속도 제어
3. **우선순위 큐**: 중요한 이미지 먼저 처리

## 관련 파일
- `server/directRoutes.js` - Rate Limit 처리 로직 추가
- `server/test-rate-limit-fix.js` - 테스트 스크립트
- `server/.env` - DISCORD_CHANNEL_ID 설정 완료

## 완료 상태
- [x] `withDiscordRateLimit` 함수 추가
- [x] `fetchImageUrlFromDiscordMessage` 함수 수정
- [x] 불필요한 100ms 지연 제거
- [ ] 서버 재시작 및 테스트 (사용자 작업 필요)
