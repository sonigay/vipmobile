# Discord 이미지 URL 만료 판단 기준

## 🔍 스케줄 자동 갱신 시 만료 여부 판단 방법

### 1. 검증 방식: HTTP HEAD 요청

스케줄이 실행될 때 각 Discord 이미지 URL에 대해 **HTTP HEAD 요청**을 보내서 실제로 접근 가능한지 확인합니다.

```javascript
// server/index.js의 validateImageUrl() 함수
async function validateImageUrl(imageUrl, timeoutMs = 5000) {
  // HTTP HEAD 요청으로 이미지 접근 가능 여부 확인
  const req = client.request(imageUrl, {
    method: 'HEAD',
    timeout: 5000, // 5초 타임아웃
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ImageValidator/1.0)'
    }
  });
}
```

**HEAD 요청을 사용하는 이유**:
- GET 요청보다 가볍고 빠름 (이미지 전체를 다운로드하지 않음)
- HTTP 상태 코드만 확인하면 되므로 효율적
- Discord CDN의 Rate Limit에 덜 부담

---

## 📊 만료 판단 기준

### 상태 코드별 판단

| HTTP 상태 코드 | 판단 결과 | 상태값 | 설명 |
|---------------|----------|--------|------|
| **200-399** | ✅ **정상** | `valid` | 이미지에 정상적으로 접근 가능 |
| **404** | ❌ **만료** | `expired` | 이미지가 삭제되었거나 URL이 만료됨 |
| **400-499** (404 제외) | ❌ **오류** | `error` | 클라이언트 오류 (권한 없음 등) |
| **500-599** | ❌ **오류** | `error` | 서버 오류 |
| **타임아웃** | ❌ **타임아웃** | `timeout` | 5초 내 응답 없음 |
| **연결 실패** | ❌ **오류** | `error` | 네트워크 연결 실패 |

### 코드 구현

```javascript
// server/index.js 6657-6685줄
req.on('response', (res) => {
  const statusCode = res.statusCode;
  
  if (statusCode >= 200 && statusCode < 400) {
    // ✅ 정상: 이미지 접근 가능
    resolve({ valid: true, status: 'valid', statusCode });
  } else if (statusCode === 404) {
    // ❌ 만료: Discord CDN에서 이미지가 삭제됨
    resolve({ valid: false, status: 'expired', error: '이미지가 만료되었습니다 (404)', statusCode });
  } else {
    // ❌ 오류: 기타 HTTP 오류
    resolve({ valid: false, status: 'error', error: `HTTP ${statusCode}`, statusCode });
  }
});

req.on('error', (error) => {
  if (error.code === 'ETIMEDOUT') {
    // ❌ 타임아웃: 5초 내 응답 없음
    resolve({ valid: false, status: 'timeout', error: '요청 시간 초과' });
  } else {
    // ❌ 연결 실패
    resolve({ valid: false, status: 'error', error: '연결 실패' });
  }
});
```

---

## 🔄 스케줄 실행 흐름

### 1단계: URL 유효성 검증

```javascript
// server/index.js 14589-14597줄
// 모든 이미지 URL에 대해 HEAD 요청으로 검증
const validationResults = await Promise.all(
  itemsToValidate.map(async (item) => {
    const validation = await validateImageUrl(item.imageUrl);
    return { ...item, urlValid: validation.valid, urlStatus: validation.status };
  })
);
```

### 2단계: 만료된 항목만 필터링

```javascript
// server/index.js 14600-14602줄
const expiredItems = validationResults.filter(item => 
  !item.urlValid ||                    // 검증 실패
  item.urlStatus === 'expired' ||       // 404 (만료)
  item.urlStatus === 'error' ||         // 기타 HTTP 오류
  item.urlStatus === 'timeout'          // 타임아웃
);
```

### 3단계: 만료된 항목만 갱신

```javascript
// 만료된 항목만 Discord API로 새 URL 가져와서 갱신
const results = await processBatchRefreshItems(expiredItems);
```

---

## ⚙️ 설정값

### 타임아웃 설정
- **기본 타임아웃**: 5초 (`timeoutMs = 5000`)
- 타임아웃 내 응답이 없으면 `timeout` 상태로 판단

### 검증 방식
- **HTTP 메서드**: HEAD (이미지 전체 다운로드 없이 헤더만 확인)
- **User-Agent**: `Mozilla/5.0 (compatible; ImageValidator/1.0)`

---

## 📝 판단 기준 요약

### ✅ 정상으로 판단되는 경우
- HTTP 상태 코드: **200-399**
- 이미지에 정상적으로 접근 가능
- 예: `200 OK`, `301 Redirect`, `304 Not Modified` 등

### ❌ 만료로 판단되는 경우
- HTTP 상태 코드: **404 Not Found**
- Discord CDN에서 이미지가 삭제되었거나 URL이 만료됨
- 가장 일반적인 만료 사례

### ❌ 오류로 판단되는 경우
- HTTP 상태 코드: **400-499** (404 제외), **500-599**
- 네트워크 연결 실패
- 예: `403 Forbidden`, `500 Internal Server Error`, `ENOTFOUND` 등

### ❌ 타임아웃으로 판단되는 경우
- **5초 내 응답 없음**
- 네트워크 지연 또는 서버 응답 지연

---

## 🎯 핵심 포인트

1. **실제 HTTP 요청으로 확인**: URL이 존재하는지만 확인하는 것이 아니라, 실제로 이미지에 접근 가능한지 확인합니다.

2. **404 = 만료**: Discord CDN에서 이미지가 삭제되었거나 URL이 만료되면 404를 반환하므로, 이를 만료로 판단합니다.

3. **HEAD 요청 사용**: 효율성을 위해 GET 대신 HEAD 요청을 사용하여 이미지 전체를 다운로드하지 않고 헤더만 확인합니다.

4. **타임아웃 5초**: 각 URL 검증은 최대 5초 내에 완료되어야 하며, 초과 시 타임아웃으로 판단합니다.

5. **병렬 처리**: 모든 URL을 동시에 검증하여 속도를 높입니다 (Promise.all 사용).

---

## 💡 예시

### 정상 URL
```
요청: HEAD https://cdn.discordapp.com/attachments/...
응답: 200 OK
결과: valid = true, status = 'valid'
```

### 만료된 URL
```
요청: HEAD https://cdn.discordapp.com/attachments/...
응답: 404 Not Found
결과: valid = false, status = 'expired'
→ 갱신 대상으로 분류
```

### 타임아웃
```
요청: HEAD https://cdn.discordapp.com/attachments/...
응답: 5초 내 응답 없음
결과: valid = false, status = 'timeout'
→ 갱신 대상으로 분류
```

---

**결론**: 스케줄은 각 Discord 이미지 URL에 대해 **HTTP HEAD 요청**을 보내서 실제 접근 가능 여부를 확인하고, **404 응답을 받으면 만료로 판단**하여 갱신 대상으로 분류합니다.


