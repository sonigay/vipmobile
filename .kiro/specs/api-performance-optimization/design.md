# Design Document: API Performance Optimization

## Overview

이 디자인은 VIP Map Application의 API 성능 최적화 및 에러 해결을 위한 종합적인 솔루션을 제공합니다. 현재 시스템은 다음과 같은 주요 문제를 겪고 있습니다:

1. **광범위한 CORS 에러**: 
   - 직영점 모드 API (`/api/direct/*`)에서 504 Gateway Timeout과 함께 CORS 정책 위반 발생
   - 예산모드 API (`/api/budget/*`)에서 CORS 에러 발생
   - 관리자모드 마커색상 설정 API (`/api/marker-color-settings`)에서 CORS 에러 발생
   - **근본 원인**: CORS 미들웨어가 일부 라우트에만 적용되고, 일부 라우트는 CORS 헤더 설정 전에 응답을 반환
   
2. **API 500/404 에러**: 예산모드 및 정책모드 API에서 서버 에러 발생

3. **SmartFetch 캐싱 오류**: 백그라운드 캐시 갱신 중 ReferenceError 발생

4. **성능 저하**: 클릭 핸들러 지연, Forced Reflow, 반복적인 API 호출

이 디자인은 기존 아키텍처를 유지하면서 문제를 해결하고, Google Sheets API 쿼터 제한 내에서 최적의 성능을 제공하는 것을 목표로 합니다.

### CORS 문제의 근본 원인 분석

현재 시스템에서 CORS 에러가 광범위하게 발생하는 이유:

1. **라우트 등록 순서 문제**: 
   - `server/index.js`에서 CORS 미들웨어가 등록된 후, 일부 라우트가 별도로 등록됨
   - `setupDirectRoutes`, `setupPolicyTableRoutes` 등이 자체적으로 CORS 처리를 시도하지만 일관성 없음

2. **OPTIONS 프리플라이트 처리 누락**:
   - 일부 라우트에서 OPTIONS 요청을 명시적으로 처리하지 않음
   - 브라우저가 프리플라이트 요청을 보내지만 적절한 응답을 받지 못함

3. **에러 응답에서 CORS 헤더 누락**:
   - 500/404 에러 발생 시 CORS 헤더가 설정되지 않아 브라우저가 에러 메시지를 읽을 수 없음

4. **타임아웃 시 CORS 헤더 누락**:
   - 504 Gateway Timeout 발생 시 CORS 헤더가 설정되지 않음

## Architecture

### 현재 아키텍처

```
[React Frontend (Vercel)]
         ↓
    [CORS Layer]
         ↓
[Express Backend (Cloudtype)]
         ↓
  [Rate Limiter]
         ↓
  [Cache Manager]
         ↓
[Google Sheets API]
```

### 개선된 아키텍처

```
[React Frontend (Vercel)]
         ↓
  [SmartFetch Client]
    - SWR Caching
    - Request Deduplication
    - Heavy Request Queue
         ↓
    [CORS Middleware]
    - Origin Validation
    - Preflight Handling
    - Error Logging
         ↓
[Express Backend (Cloudtype)]
    - Request Timeout (5min)
    - Concurrent Request Limit (10)
         ↓
  [Rate Limiter]
    - Min Interval: 500ms
    - Max Concurrent: 5
    - Exponential Backoff
         ↓
  [Cache Manager]
    - TTL: 5min (fresh)
    - Stale TTL: 30min
    - Max Size: 200
    - LRU Eviction
         ↓
[Google Sheets API]
    - Quota: 60 req/min
```

## Components and Interfaces

### 1. CORS Middleware (Backend)

**위치**: `server/corsMiddleware.js`, `server/index.js`

**책임**:
- 모든 API 엔드포인트에 대한 오리진 검증 및 CORS 헤더 설정
- OPTIONS 프리플라이트 요청 처리
- 에러 응답에도 CORS 헤더 포함
- CORS 에러 로깅

**주요 함수**:
```typescript
interface CORSMiddleware {
  // 메인 미들웨어 함수
  corsMiddleware(req: Request, res: Response, next: NextFunction): void;
  
  // 오리진 검증
  validateOrigin(origin: string, allowedOrigins: string[], devMode: boolean): ValidationResult;
  
  // CORS 헤더 설정
  setBasicCORSHeaders(req: Request, res: Response, origin?: string): ValidationResult;
  
  // 프리플라이트 처리
  handlePreflightRequest(req: Request, res: Response): void;
  
  // 에러 응답 래퍼 (CORS 헤더 포함)
  sendErrorWithCORS(res: Response, statusCode: number, error: any): void;
}

interface ValidationResult {
  isValid: boolean;
  matchedOrigin?: string;
  reason: string;
}
```

**개선 사항**:

1. **전역 CORS 미들웨어 적용**:
   - `app.use(corsMiddleware)`를 모든 라우트 등록 전에 배치
   - 모든 API 엔드포인트에 일관된 CORS 헤더 적용

2. **에러 응답에 CORS 헤더 포함**:
   - 500/404 에러 발생 시에도 CORS 헤더 설정
   - 브라우저가 에러 메시지를 읽을 수 있도록 함

3. **OPTIONS 프리플라이트 자동 처리**:
   - CORS 미들웨어에서 모든 OPTIONS 요청을 자동으로 처리
   - 개별 라우트에서 OPTIONS 처리 코드 제거

4. **타임아웃 응답에 CORS 헤더 포함**:
   - 타임아웃 미들웨어에서 CORS 헤더 설정

5. **상세한 CORS 에러 로깅**:
   - 요청 오리진, 허용된 오리진 목록, 실패 이유 로깅
   - 어떤 엔드포인트에서 CORS 에러가 발생하는지 추적

**구현 전략**:

```javascript
// server/index.js

// 1. CORS 미들웨어를 가장 먼저 등록
app.use(corsMiddleware);

// 2. 타임아웃 미들웨어에 CORS 헤더 추가
app.use((req, res, next) => {
  req.setTimeout(300000); // 5분
  res.setTimeout(300000); // 5분
  
  // 타임아웃 발생 시 CORS 헤더 포함
  req.on('timeout', () => {
    setBasicCORSHeaders(req, res);
    res.status(504).json({
      error: 'Gateway Timeout',
      message: 'Request exceeded 5 minute timeout'
    });
  });
  
  next();
});

// 3. 전역 에러 핸들러에 CORS 헤더 추가
app.use((err, req, res, next) => {
  // 에러 발생 시에도 CORS 헤더 설정
  setBasicCORSHeaders(req, res);
  
  console.error('❌ [Global Error Handler]', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// 4. 개별 라우트에서 OPTIONS 처리 제거
// setupDirectRoutes, setupPolicyTableRoutes 등에서
// OPTIONS 처리 코드를 제거하고 CORS 미들웨어에 위임
```

### 2. Rate Limiter (Backend)

**위치**: `server/index.js` (rateLimitedSheetsCall 함수)

**책임**:
- Google Sheets API 호출 빈도 제한
- Rate Limit 에러 재시도
- Exponential Backoff 적용

**주요 함수**:
```typescript
interface RateLimiter {
  // Rate Limit이 적용된 API 호출
  rateLimitedSheetsCall<T>(
    apiCall: () => Promise<T>,
    maxRetries?: number
  ): Promise<T>;
  
  // 호출 가능 여부 확인
  canMakeRequest(): boolean;
  
  // 호출 기록
  recordRequest(): void;
  
  // 대기 시간 계산
  getWaitTime(): number;
}
```

**개선 사항**:
1. 최소 호출 간격: 2초 → 500ms (성능 개선)
2. 최대 동시 요청: 2개 → 5개 (처리량 증가)
3. Exponential Backoff + Jitter (동시 요청 분산)
4. 최대 재시도 횟수: 5회
5. 최대 대기 시간: 60초

### 3. Cache Manager (Backend)

**위치**: `server/directRoutes.js` (cacheStore, getCacheEntry 함수)

**책임**:
- API 응답 캐싱
- SWR (Stale-While-Revalidate) 전략
- 캐시 만료 및 Eviction

**주요 함수**:
```typescript
interface CacheManager {
  // 캐시 조회
  getCacheEntry(key: string): CacheEntry | null;
  
  // 캐시 저장
  setCacheEntry(key: string, data: any, ttl: number): void;
  
  // 캐시 삭제
  deleteCacheEntry(key: string): void;
  
  // 캐시 정리
  cleanupExpiredCache(): void;
  
  // LRU Eviction
  evictOldestEntry(): void;
}

interface CacheEntry {
  data: any;
  expires: number;
  isFresh: boolean;
  isStale: boolean;
}
```

**개선 사항**:
1. Fresh TTL: 5분 (신선한 데이터)
2. Stale TTL: 30분 (만료되었지만 사용 가능)
3. 최대 캐시 크기: 200개
4. LRU Eviction 전략
5. 백그라운드 캐시 갱신 (SWR)


### 4. SmartFetch Client (Frontend)

**위치**: `src/api/directStoreApiClient.js`

**책임**:
- 클라이언트 측 캐싱
- 중복 요청 제거
- Heavy Request 큐잉
- SWR 캐싱 전략

**주요 함수**:
```typescript
interface SmartFetch {
  // 스마트 API 요청
  smartFetch<T>(
    url: string,
    options?: RequestOptions,
    config?: SmartFetchConfig
  ): Promise<T>;
  
  // 요청 실행 (큐 포함)
  executeRequestWithQueue<T>(
    url: string,
    options: RequestOptions,
    isHeavy: boolean,
    errorMessage: string
  ): Promise<T>;
}

interface SmartFetchConfig {
  heavyRequest?: boolean;
  errorMessage?: string;
  useCache?: boolean;
  forceRefresh?: boolean;
}
```

**개선 사항**:
1. ReferenceError 수정 (변수 'd' 초기화 문제)
2. 백그라운드 캐시 갱신 에러 처리 강화
3. 캐시 갱신 실패 시 다음 요청에서 캐시 무효화
4. 중복 갱신 방지 (isRefreshing 플래그)

### 5. Error Handler (Backend & Frontend)

**위치**: `server/index.js`, `src/utils/logger.js`

**책임**:
- 에러 감지 및 로깅
- 에러 정보 수집
- 중앙 집중식 로깅

**주요 함수**:
```typescript
interface ErrorHandler {
  // API 에러 로깅
  logApiError(error: Error, context: RequestContext): void;
  
  // CORS 에러 로깅
  logCorsError(origin: string, reason: string, context: RequestContext): void;
  
  // Google Sheets API 에러 로깅
  logSheetsApiError(error: Error, retryCount: number): void;
  
  // 타임아웃 에러 로깅
  logTimeoutError(url: string, elapsedTime: number, timeout: number): void;
  
  // 클라이언트 에러 전송
  sendClientError(error: Error, context: ClientContext): Promise<void>;
}

interface RequestContext {
  path: string;
  method: string;
  headers: Record<string, string>;
  origin?: string;
}

interface ClientContext {
  sessionId: string;
  userAgent: string;
  timestamp: number;
  path: string;
}
```

**개선 사항**:
1. 상세한 에러 로깅 (타입, 메시지, 스택 트레이스, 요청 정보)
2. CORS 에러 로깅 강화 (요청 오리진, 허용된 오리진 목록, 실패 이유)
3. Google Sheets API 에러 로깅 (에러 코드, 메시지, 재시도 횟수)
4. 타임아웃 에러 로깅 (요청 URL, 경과 시간, 타임아웃 설정값)
5. 클라이언트 에러 중앙 집중식 로깅

### 6. Timeout Manager (Backend)

**위치**: `server/index.js`

**책임**:
- API 요청 타임아웃 관리
- 타임아웃 에러 처리

**주요 함수**:
```typescript
interface TimeoutManager {
  // 타임아웃 설정
  setTimeout(req: Request, res: Response, timeout: number): void;
  
  // 타임아웃 체크
  checkTimeout(startTime: number, timeout: number): boolean;
  
  // 타임아웃 에러 반환
  handleTimeout(req: Request, res: Response): void;
}
```

**개선 사항**:
1. 요청 타임아웃: 5분
2. 응답 타임아웃: 5분
3. 타임아웃 에러 로깅

## Data Models

### 1. Cache Entry

```typescript
interface CacheEntry {
  data: any;                // 캐시된 데이터
  timestamp: number;        // 캐시 생성 시간
  expires: number;          // 만료 시간
  isRefreshing: boolean;    // 백그라운드 갱신 중 여부
}
```

### 2. API Request Context

```typescript
interface RequestContext {
  path: string;             // 요청 경로
  method: string;           // HTTP 메서드
  headers: Record<string, string>; // 요청 헤더
  origin?: string;          // 요청 오리진
  startTime: number;        // 요청 시작 시간
}
```

### 3. Rate Limit State

```typescript
interface RateLimitState {
  requests: number[];       // 최근 요청 타임스탬프 목록
  isRateLimited: boolean;   // Rate Limit 상태
  maxRequestsPerMinute: number; // 분당 최대 요청 수
}
```

### 4. Error Log Entry

```typescript
interface ErrorLogEntry {
  timestamp: number;        // 에러 발생 시간
  type: string;             // 에러 타입
  message: string;          // 에러 메시지
  stack?: string;           // 스택 트레이스
  context: RequestContext;  // 요청 컨텍스트
  retryCount?: number;      // 재시도 횟수
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: CORS Headers Consistency

*For any* API endpoint and any valid origin, when a request is made, the Backend_Server should set CORS headers consistently and return a valid response or a clear error message.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: OPTIONS Preflight Success

*For any* API endpoint, when an OPTIONS preflight request is made with valid headers, the Backend_Server should return 200 OK with appropriate CORS headers.

**Validates: Requirements 1.4**

### Property 3: CORS Error Logging Completeness

*For any* CORS error, the Error_Handler should log the request origin, allowed origins list, and failure reason.

**Validates: Requirements 1.5, 7.2**

### Property 4: API Response Timeout

*For any* API request, the Backend_Server should respond within 5 minutes or return a timeout error.

**Validates: Requirements 2.1, 2.5**

### Property 5: Rate Limiting Interval

*For any* two consecutive Google Sheets API calls, the time interval between them should be at least 500ms (improved from 2 seconds).

**Validates: Requirements 2.2**

### Property 6: Exponential Backoff Retry

*For any* Google Sheets API Rate Limit error, the Backend_Server should retry up to 5 times with exponential backoff and jitter.

**Validates: Requirements 2.3, 5.4, 8.3**

### Property 7: Concurrent Request Queueing

*For any* set of concurrent API requests exceeding 10, the Backend_Server should queue excess requests and process them sequentially.

**Validates: Requirements 2.4**

### Property 8: API Response Validity

*For any* API endpoint (budget, policy, team), when called, the Backend_Server should return either valid data or a clear error message with appropriate HTTP status code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 9: API Error Logging Completeness

*For any* API error, the Error_Handler should log error type, message, stack trace, and request information (path, method, headers).

**Validates: Requirements 3.7, 7.1**

### Property 10: SmartFetch Background Refresh

*For any* cached data request, when SmartFetch returns cached data, it should trigger background cache refresh without blocking the response.

**Validates: Requirements 4.1**

### Property 11: SmartFetch Error Resilience

*For any* background cache refresh error, SmartFetch should log the error and maintain the existing cache without throwing exceptions.

**Validates: Requirements 4.2**

### Property 12: Cache Invalidation on Failure

*For any* cache refresh failure, SmartFetch should invalidate the cache on the next request and fetch fresh data.

**Validates: Requirements 4.4**

### Property 13: Cache TTL Expiration

*For any* cache entry, when TTL expires, the Cache_Manager should automatically delete the entry.

**Validates: Requirements 4.5**

### Property 14: Cache Hit Optimization

*For any* API request with valid cached data, the Backend_Server should return cached data without calling Google Sheets API.

**Validates: Requirements 5.1, 5.2**

### Property 15: Rate Limit Queueing

*For any* API call rate exceeding 45 requests per minute, the Rate_Limiter should queue additional requests.

**Validates: Requirements 5.3**

### Property 16: LRU Cache Eviction

*For any* cache exceeding 200 entries, the Cache_Manager should evict the least recently used entry.

**Validates: Requirements 5.5**

### Property 17: Event Handler Performance

*For any* click event handler, execution time should be less than 100ms.

**Validates: Requirements 6.1**

### Property 18: API Request Debouncing

*For any* repeated API calls within a short time window, the Frontend_Client should debounce or merge requests.

**Validates: Requirements 6.3**

### Property 19: Google Sheets API Error Logging

*For any* Google Sheets API error, the Error_Handler should log error code, message, and retry count.

**Validates: Requirements 7.3**

### Property 20: Timeout Error Logging

*For any* timeout error, the Error_Handler should log request URL, elapsed time, and timeout setting.

**Validates: Requirements 7.4**

### Property 21: Client Error Transmission

*For any* client-side error, the Frontend_Client should transmit error information to the backend for centralized logging.

**Validates: Requirements 7.5**

### Property 22: API Retry Logic

*For any* failed API request, the Backend_Server should retry up to 3 times with exponential backoff.

**Validates: Requirements 8.1, 8.2**

### Property 23: Retry Failure Message

*For any* API request that fails after all retries, the Backend_Server should return a clear error message.

**Validates: Requirements 8.4**

### Property 24: Retry Logging

*For any* retry attempt, the Backend_Server should log retry count and wait time.

**Validates: Requirements 8.5**

### Property 25: Response Time Logging

*For any* completed API request, the Backend_Server should log the response time.

**Validates: Requirements 9.1**

### Property 26: Slow Response Warning

*For any* API response time exceeding 3 seconds, the Backend_Server should output a warning log.

**Validates: Requirements 9.2**

### Property 27: Very Slow Response Alert

*For any* API response time exceeding 5 seconds, the Backend_Server should output an error log and send an alert.

**Validates: Requirements 9.3**

### Property 28: Average Response Time Alert

*For any* average response time exceeding 1 second over a time window, the Backend_Server should send a performance degradation alert.

**Validates: Requirements 9.4**

### Property 29: Health Check Unhealthy State

*For any* Google Sheets API connection failure, the Backend_Server should change health check status to 'unhealthy'.

**Validates: Requirements 10.2**

### Property 30: Cache Size Warning

*For any* cache size exceeding threshold, the Backend_Server should output a warning log.

**Validates: Requirements 10.3**

### Property 31: Concurrent Request Warning

*For any* concurrent request count exceeding threshold, the Backend_Server should output a warning log.

**Validates: Requirements 10.4**


## Error Handling

### 1. CORS Errors

**에러 타입**: CORS Policy Violation, 504 Gateway Timeout

**발생 위치**:
- `/api/direct/*` (직영점 모드 API)
- `/api/budget/*` (예산모드 API)
- `/api/marker-color-settings` (관리자모드 마커색상 설정)
- 기타 모든 API 엔드포인트

**근본 원인**:
1. CORS 미들웨어가 일부 라우트에만 적용됨
2. 에러 응답에 CORS 헤더가 누락됨
3. OPTIONS 프리플라이트 요청 처리 누락
4. 타임아웃 응답에 CORS 헤더가 누락됨

**처리 전략**:

1. **전역 CORS 미들웨어 적용**:
   ```javascript
   // server/index.js 최상단
   app.use(corsMiddleware);
   ```

2. **에러 응답에 CORS 헤더 포함**:
   ```javascript
   // 전역 에러 핸들러
   app.use((err, req, res, next) => {
     setBasicCORSHeaders(req, res);
     res.status(err.status || 500).json({
       error: err.name,
       message: err.message
     });
   });
   ```

3. **타임아웃 응답에 CORS 헤더 포함**:
   ```javascript
   app.use((req, res, next) => {
     req.setTimeout(300000);
     res.setTimeout(300000);
     
     req.on('timeout', () => {
       setBasicCORSHeaders(req, res);
       res.status(504).json({
         error: 'Gateway Timeout',
         message: 'Request exceeded 5 minute timeout'
       });
     });
     
     next();
   });
   ```

4. **개별 라우트에서 OPTIONS 처리 제거**:
   - `directRoutes.js`, `policyTableRoutes.js` 등에서 OPTIONS 처리 코드 제거
   - CORS 미들웨어에 위임

5. **상세한 CORS 에러 로깅**:
   ```javascript
   console.warn(`❌ [CORS] 허용되지 않은 오리진:`, {
     요청오리진: origin,
     허용된오리진목록: config.allowedOrigins,
     실패이유: validation.reason,
     요청정보: {
       경로: req.path,
       메서드: req.method,
       헤더: req.headers
     }
   });
   ```

**에러 응답 형식**:
```json
{
  "error": "Forbidden",
  "message": "Origin not allowed",
  "origin": "https://example.com",
  "reason": "Origin not in allowed list"
}
```

**검증 방법**:
1. 모든 API 엔드포인트에 대해 CORS 헤더가 설정되는지 확인
2. 에러 응답에도 CORS 헤더가 포함되는지 확인
3. OPTIONS 프리플라이트 요청이 200 OK를 반환하는지 확인
4. 타임아웃 발생 시 CORS 헤더가 포함되는지 확인

### 2. API 500/404 Errors

**에러 타입**: Internal Server Error, Not Found

**처리 전략**:
1. 모든 API 엔드포인트에 try-catch 블록 추가
2. Google Sheets API 호출 실패 시 명확한 에러 메시지 반환
3. 시트가 존재하지 않는 경우 404 대신 빈 배열 반환
4. 상세한 에러 로깅 (에러 타입, 메시지, 스택 트레이스, 요청 정보)

**에러 응답 형식**:
```json
{
  "error": "Internal Server Error",
  "message": "Failed to fetch policy groups",
  "details": "Sheet '예산_정책그룹관리' not found"
}
```

### 3. Rate Limit Errors

**에러 타입**: 429 Too Many Requests, RESOURCE_EXHAUSTED

**처리 전략**:
1. Exponential Backoff + Jitter 재시도
2. 최대 5회 재시도
3. 최대 대기 시간 60초
4. 재시도 횟수 및 대기 시간 로깅

**에러 응답 형식**:
```json
{
  "error": "Rate Limit Exceeded",
  "message": "Google Sheets API quota exceeded",
  "retryAfter": 30,
  "retryCount": 3
}
```

### 4. Timeout Errors

**에러 타입**: Request Timeout, Gateway Timeout

**처리 전략**:
1. 요청 타임아웃: 5분
2. 응답 타임아웃: 5분
3. 타임아웃 발생 시 요청 중단
4. 타임아웃 에러 로깅 (요청 URL, 경과 시간, 타임아웃 설정값)

**에러 응답 형식**:
```json
{
  "error": "Request Timeout",
  "message": "Request exceeded 5 minute timeout",
  "url": "/api/budget/policy-groups",
  "elapsedTime": 300000,
  "timeout": 300000
}
```

### 5. Cache Errors

**에러 타입**: Cache Refresh Failure, ReferenceError

**처리 전략**:
1. 백그라운드 캐시 갱신 실패 시 에러 로깅
2. 기존 캐시 유지
3. 다음 요청 시 캐시 무효화
4. ReferenceError 방지 (변수 초기화 확인)

**에러 응답 형식**:
```json
{
  "error": "Cache Refresh Failed",
  "message": "Background cache refresh failed",
  "cacheKey": "/api/direct/mobiles-pricing?carrier=SK",
  "reason": "Network error"
}
```

## Testing Strategy

### Dual Testing Approach

이 프로젝트는 **Unit Testing**과 **Property-Based Testing**을 모두 사용하여 포괄적인 테스트 커버리지를 제공합니다.

#### Unit Testing

**목적**: 특정 예제, 엣지 케이스, 에러 조건 검증

**테스트 대상**:
1. `/api/team-leaders` 엔드포인트 404 에러 수정 확인
2. `/api/policy-table/user-groups/{id}/change-history` 엔드포인트 500 에러 수정 확인
3. `/health` 엔드포인트 응답 형식 확인
4. 응답 시간 통계 리포트 생성 확인
5. 서버 시작 시 초기화 로깅 확인

**테스트 프레임워크**: Jest

**예제**:
```javascript
describe('Team Leaders API', () => {
  it('should return team leaders list instead of 404', async () => {
    const response = await request(app).get('/api/team-leaders');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
  });
});
```

#### Property-Based Testing

**목적**: 범용 속성을 모든 입력에 대해 검증

**테스트 대상**:
1. CORS 헤더 일관성 (Property 1)
2. OPTIONS 프리플라이트 성공 (Property 2)
3. CORS 에러 로깅 완전성 (Property 3)
4. API 응답 타임아웃 (Property 4)
5. Rate Limiting 간격 (Property 5)
6. Exponential Backoff 재시도 (Property 6)
7. 동시 요청 큐잉 (Property 7)
8. API 응답 유효성 (Property 8)
9. API 에러 로깅 완전성 (Property 9)
10. SmartFetch 백그라운드 갱신 (Property 10)
11. SmartFetch 에러 복원력 (Property 11)
12. 캐시 무효화 (Property 12)
13. 캐시 TTL 만료 (Property 13)
14. 캐시 히트 최적화 (Property 14)
15. Rate Limit 큐잉 (Property 15)
16. LRU 캐시 Eviction (Property 16)
17. 이벤트 핸들러 성능 (Property 17)
18. API 요청 디바운싱 (Property 18)
19. Google Sheets API 에러 로깅 (Property 19)
20. 타임아웃 에러 로깅 (Property 20)
21. 클라이언트 에러 전송 (Property 21)
22. API 재시도 로직 (Property 22)
23. 재시도 실패 메시지 (Property 23)
24. 재시도 로깅 (Property 24)
25. 응답 시간 로깅 (Property 25)
26. 느린 응답 경고 (Property 26)
27. 매우 느린 응답 알림 (Property 27)
28. 평균 응답 시간 알림 (Property 28)
29. 헬스체크 Unhealthy 상태 (Property 29)
30. 캐시 크기 경고 (Property 30)
31. 동시 요청 경고 (Property 31)

**테스트 프레임워크**: fast-check (Node.js)

**설정**:
- 최소 반복 횟수: 100회
- 각 속성 테스트는 디자인 문서의 속성을 참조
- 태그 형식: **Feature: api-performance-optimization, Property {number}: {property_text}**

**예제**:
```javascript
const fc = require('fast-check');

describe('Property 1: CORS Headers Consistency', () => {
  /**
   * Feature: api-performance-optimization
   * Property 1: For any API endpoint and any valid origin, when a request is made,
   * the Backend_Server should set CORS headers consistently and return a valid response
   * or a clear error message.
   */
  it('should set CORS headers consistently for all endpoints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/api/direct/mobiles-pricing', '/api/direct/policy-settings', '/api/direct/store-main-page-texts'),
        fc.constantFrom('https://vipmobile.vercel.app', 'https://example.com'),
        async (endpoint, origin) => {
          const response = await request(app)
            .get(endpoint)
            .set('Origin', origin);
          
          // CORS 헤더가 설정되어 있어야 함
          expect(response.headers['access-control-allow-origin']).toBeDefined();
          
          // 응답은 유효한 데이터 또는 명확한 에러 메시지여야 함
          if (response.status >= 400) {
            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('message');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**목적**: 컴포넌트 간 통합 검증

**테스트 시나리오**:
1. 프론트엔드 → CORS Middleware → 백엔드 → Google Sheets API 전체 플로우
2. Rate Limiter → Cache Manager → Google Sheets API 통합
3. SmartFetch → 백엔드 API → 캐시 통합

### Performance Testing

**목적**: 성능 요구사항 검증

**테스트 시나리오**:
1. 클릭 이벤트 핸들러 실행 시간 측정 (< 100ms)
2. API 응답 시간 측정 (< 5분)
3. 동시 요청 처리 성능 측정 (10개 이상)
4. 캐시 히트율 측정

### Load Testing

**목적**: 시스템 부하 테스트

**테스트 시나리오**:
1. 분당 45회 이상 API 호출 시 Rate Limiting 동작 확인
2. 200개 이상 캐시 항목 생성 시 LRU Eviction 동작 확인
3. 10개 이상 동시 요청 시 큐잉 동작 확인

