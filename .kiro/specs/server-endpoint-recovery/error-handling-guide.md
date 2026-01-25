# 에러 처리 표준화 가이드

## 개요
모든 라우터 엔드포인트에서 일관된 에러 처리 및 응답 형식을 사용하기 위한 가이드입니다.

---

## 표준 에러 응답 형식

### 기본 구조
```json
{
  "success": false,
  "error": "사용자 친화적 에러 메시지",
  "details": "기술적 상세 정보 (선택적)",
  "code": "ERROR_CODE (선택적)",
  "stack": "스택 트레이스 (개발 환경에서만)"
}
```

### 성공 응답 형식
```json
{
  "success": true,
  "message": "성공 메시지 (선택적)",
  "data": "응답 데이터"
}
```

---

## 에러 응답 유틸리티 사용법

### 1. 유틸리티 임포트
```javascript
const {
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendInternalError,
  sendServiceUnavailable,
  sendSheetsUnavailable,
  sendRateLimitError,
  logError,
  sendSuccess
} = require('../utils/errorResponse');
```

### 2. 400 Bad Request (잘못된 요청)
```javascript
// 필수 파라미터 누락
if (!storeId) {
  return sendBadRequest(res, 'Store ID가 필요합니다.');
}

// 유효성 검증 실패
if (storeId.length < 3) {
  return sendBadRequest(res, 'Store ID는 최소 3자 이상이어야 합니다.', 'Invalid length');
}
```

### 3. 401 Unauthorized (인증 실패)
```javascript
// 로그인 실패
if (!user) {
  return sendUnauthorized(res, '아이디 또는 비밀번호가 올바르지 않습니다.');
}

// 토큰 만료
if (isTokenExpired(token)) {
  return sendUnauthorized(res, '세션이 만료되었습니다. 다시 로그인해주세요.');
}
```

### 4. 403 Forbidden (권한 없음)
```javascript
// 접근 권한 없음
if (!hasPermission(user, 'admin')) {
  return sendForbidden(res, '관리자 권한이 필요합니다.');
}
```

### 5. 404 Not Found (리소스 없음)
```javascript
// 데이터 없음
if (!store) {
  return sendNotFound(res, '매장을 찾을 수 없습니다.');
}
```

### 6. 500 Internal Server Error (서버 오류)
```javascript
// 일반적인 서버 오류
try {
  // ... 로직
} catch (error) {
  logError('매장조회', '매장 목록 조회 실패', error);
  return sendInternalError(res, '매장 목록 조회에 실패했습니다.', error);
}
```

### 7. 503 Service Unavailable (서비스 불가)
```javascript
// Google Sheets 클라이언트 없음
if (!sheetsClient) {
  return sendSheetsUnavailable(res);
}

// 외부 API 응답 없음
if (!externalApiResponse) {
  return sendServiceUnavailable(res, '외부 API 서비스를 사용할 수 없습니다.');
}
```

### 8. 429 Rate Limit Exceeded (요청 한도 초과)
```javascript
// Rate Limit 초과
if (isRateLimitExceeded()) {
  return sendRateLimitError(res);
}
```

### 9. 성공 응답
```javascript
// 데이터와 함께 성공 응답
sendSuccess(res, { stores: storeList, count: storeList.length });

// 메시지와 함께 성공 응답
sendSuccess(res, { id: newId }, '매장이 성공적으로 생성되었습니다.');

// 단순 성공 응답
sendSuccess(res, null, '작업이 완료되었습니다.');
```

---

## 에러 로깅 표준

### 1. 로그 형식
```javascript
logError('카테고리', '에러 메시지', error);
```

### 2. 카테고리 예시
- `로그인` - 인증 관련
- `매장조회` - 매장 데이터 조회
- `팀목록` - 팀 데이터 조회
- `영업데이터` - 영업 실적 조회
- `개통데이터` - 개통 실적 조회
- `직영점` - 직영점 관련
- `예약` - 예약 관련
- `SMS` - SMS 관련

### 3. 로그 출력 예시
```
❌ [매장조회] 매장 목록 조회 실패: Error: Network timeout
Stack trace: (개발 환경에서만)
```

---

## 라우터 파일 표준 패턴

### 기본 구조
```javascript
const express = require('express');
const router = express.Router();
const {
  sendBadRequest,
  sendInternalError,
  sendSheetsUnavailable,
  logError,
  sendSuccess
} = require('../utils/errorResponse');

function createMyRoutes(context) {
  const { sheetsClient, rateLimiter } = context;

  // Google Sheets 클라이언트 확인 헬퍼
  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets) {
      sendSheetsUnavailable(res);
      return false;
    }
    return true;
  };

  // GET /api/my-endpoint
  router.get('/api/my-endpoint', async (req, res) => {
    try {
      // 1. Sheets 클라이언트 확인
      if (!requireSheetsClient(res)) return;

      // 2. 파라미터 검증
      const { id } = req.query;
      if (!id) {
        return sendBadRequest(res, 'ID가 필요합니다.');
      }

      // 3. 비즈니스 로직
      const data = await fetchData(id);

      // 4. 데이터 없음 처리
      if (!data) {
        return sendNotFound(res, '데이터를 찾을 수 없습니다.');
      }

      // 5. 성공 응답
      sendSuccess(res, { data });

    } catch (error) {
      // 6. 에러 로깅 및 응답
      logError('카테고리', '작업 실패', error);
      sendInternalError(res, '작업에 실패했습니다.', error);
    }
  });

  return router;
}

module.exports = createMyRoutes;
```

---

## HTTP 상태 코드 가이드

### 2xx 성공
- **200 OK**: 요청 성공
- **201 Created**: 리소스 생성 성공

### 4xx 클라이언트 오류
- **400 Bad Request**: 잘못된 요청 (파라미터 누락, 유효성 검증 실패)
- **401 Unauthorized**: 인증 실패 (로그인 필요)
- **403 Forbidden**: 권한 없음 (로그인은 했지만 접근 권한 없음)
- **404 Not Found**: 리소스 없음
- **429 Too Many Requests**: Rate Limit 초과

### 5xx 서버 오류
- **500 Internal Server Error**: 서버 내부 오류
- **503 Service Unavailable**: 서비스 일시 불가 (Google Sheets 연결 실패 등)

---

## 마이그레이션 체크리스트

기존 라우터 파일을 표준화할 때:

- [ ] `errorResponse` 유틸리티 임포트
- [ ] `requireSheetsClient` 함수를 `sendSheetsUnavailable` 사용하도록 수정
- [ ] 모든 `res.status(400).json({ error: ... })`를 `sendBadRequest`로 교체
- [ ] 모든 `res.status(500).json({ error: ... })`를 `sendInternalError`로 교체
- [ ] 모든 `console.error`를 `logError`로 교체
- [ ] 성공 응답을 `sendSuccess`로 통일 (선택적)
- [ ] 에러 응답 형식 일관성 확인

---

## 예시: 기존 코드 vs 표준화된 코드

### 기존 코드
```javascript
try {
  if (!sheetsClient) {
    return res.status(503).json({ error: 'Sheets not available' });
  }
  
  if (!storeId) {
    return res.status(400).json({ error: 'Store ID required' });
  }
  
  const data = await fetchData(storeId);
  res.json({ success: true, data });
  
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: error.message });
}
```

### 표준화된 코드
```javascript
try {
  if (!requireSheetsClient(res)) return;
  
  if (!storeId) {
    return sendBadRequest(res, 'Store ID가 필요합니다.');
  }
  
  const data = await fetchData(storeId);
  sendSuccess(res, { data });
  
} catch (error) {
  logError('매장조회', '데이터 조회 실패', error);
  sendInternalError(res, '데이터 조회에 실패했습니다.', error);
}
```

---

## 다음 단계

1. ✅ `server/utils/errorResponse.js` 생성 완료
2. ⏳ 모든 라우터 파일에 적용 (Task 11.1)
3. ⏳ 에러 로깅 표준화 (Task 11.2)
4. ⏳ 통합 테스트 (Task 16)
