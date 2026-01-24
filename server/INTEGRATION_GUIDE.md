# API 성능 최적화 통합 가이드

이 문서는 API 성능 최적화 작업에서 생성된 모듈들을 `server/index.js`에 통합하는 방법을 설명합니다.

## 생성된 모듈

### 1. healthCheck.js
헬스체크 엔드포인트를 위한 모듈입니다.

**기능:**
- 서버 상태, 타임스탬프, 메모리 사용량, CPU 사용량 반환
- Google Sheets API 연결 상태 확인
- 연결 실패 시 'unhealthy' 상태 반환

**통합 방법:**
```javascript
const { createHealthCheckHandler } = require('./healthCheck');

// Google Sheets 클라이언트 초기화 전
let healthCheckHandler = createHealthCheckHandler();
app.get('/health', (req, res) => healthCheckHandler(req, res));

// Google Sheets 클라이언트 초기화 후 (doc 변수가 준비된 후)
healthCheckHandler = createHealthCheckHandler({ sheetsClient: doc });
```

### 2. responseTimeLogger.js
응답 시간 로깅 미들웨어입니다.

**기능:**
- 모든 API 요청의 응답 시간 측정 및 로깅
- 3초 이상: 경고 로그
- 5초 이상: 에러 로그
- 응답 시간 통계 추적

**통합 방법:**
```javascript
const { createResponseTimeLoggerWithFilter, createResponseTimeTracker } = require('./responseTimeLogger');

// CORS 미들웨어 다음에 추가
app.use(corsMiddleware);
app.use(createResponseTimeLoggerWithFilter(['/health'])); // /health는 제외

// 또는 통계 추적이 필요한 경우
const responseTimeTracker = createResponseTimeTracker();
app.use(responseTimeTracker);

// 통계 조회 엔드포인트 추가 (선택사항)
app.get('/api/stats/response-time', (req, res) => {
  res.json(responseTimeTracker.getStats());
});
```

### 3. cacheMonitor.js
캐시 크기 및 동시 요청 수 모니터링 모듈입니다.

**기능:**
- 캐시 크기가 180개(90%) 이상: 경고
- 캐시 크기가 195개(97.5%) 이상: 에러
- 동시 요청 수가 8개 이상: 경고
- 동시 요청 수가 12개 이상: 에러

**통합 방법:**
```javascript
const { SystemMonitor } = require('./cacheMonitor');

// 시스템 모니터 초기화
const systemMonitor = new SystemMonitor({
  cache: {
    maxCacheSize: 200,
    warningThreshold: 180,
    criticalThreshold: 195
  },
  concurrentRequests: {
    warningThreshold: 8,
    criticalThreshold: 12
  }
});

// 캐시 크기 체크 (캐시에 항목 추가/삭제 시)
function updateCache(key, value) {
  cache.set(key, value);
  systemMonitor.checkCache(cache.size, 'mainCache');
}

// 동시 요청 수 체크 (Google Sheets API 호출 시)
async function rateLimitedSheetsCall(fn) {
  activeRequests++;
  systemMonitor.checkConcurrentRequests(activeRequests, 'Google Sheets API');
  
  try {
    return await fn();
  } finally {
    activeRequests--;
  }
}

// 모니터링 통계 엔드포인트 추가 (선택사항)
app.get('/api/stats/system', (req, res) => {
  const stats = systemMonitor.getSystemStats(cache.size, activeRequests);
  res.json(stats);
});
```

## 통합 순서

`server/index.js`에 다음 순서로 통합하세요:

### 1단계: 모듈 import
```javascript
const { createHealthCheckHandler } = require('./healthCheck');
const { createResponseTimeLoggerWithFilter } = require('./responseTimeLogger');
const { SystemMonitor } = require('./cacheMonitor');
```

### 2단계: 초기화
```javascript
// 헬스체크 핸들러 (Google Sheets 클라이언트 없이)
let healthCheckHandler = createHealthCheckHandler();

// 시스템 모니터
const systemMonitor = new SystemMonitor({
  cache: { maxCacheSize: 200, warningThreshold: 180, criticalThreshold: 195 },
  concurrentRequests: { warningThreshold: 8, criticalThreshold: 12 }
});
```

### 3단계: 미들웨어 등록
```javascript
// CORS 미들웨어 (가장 먼저)
app.use(corsMiddleware);

// 응답 시간 로깅 미들웨어
app.use(createResponseTimeLoggerWithFilter(['/health']));

// 헬스체크 엔드포인트
app.get('/health', (req, res) => healthCheckHandler(req, res));

// 나머지 라우트들...
```

### 4단계: Google Sheets 초기화 후 업데이트
```javascript
// Google Sheets 클라이언트 초기화 후
const doc = new GoogleSpreadsheet(SHEET_ID);
await doc.useServiceAccountAuth(creds);
await doc.loadInfo();

// 헬스체크 핸들러 업데이트
healthCheckHandler = createHealthCheckHandler({ sheetsClient: doc });
```

### 5단계: 캐시 및 동시 요청 모니터링 통합
```javascript
// 캐시 업데이트 시
function setCache(key, value) {
  cache.set(key, value);
  
  // LRU eviction
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  
  // 캐시 크기 모니터링
  systemMonitor.checkCache(cache.size, 'mainCache');
}

// Google Sheets API 호출 시
async function rateLimitedSheetsCall(fn) {
  // 동시 요청 수 증가
  activeRequests++;
  systemMonitor.checkConcurrentRequests(activeRequests, 'Google Sheets API');
  
  try {
    // Rate limiting 로직...
    return await fn();
  } finally {
    activeRequests--;
  }
}
```

## 검증 방법

### 1. 헬스체크 엔드포인트 테스트
```bash
curl http://localhost:4000/health
```

**예상 응답:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-24T10:00:00.000Z",
  "uptime": {
    "process": 3600,
    "system": 86400
  },
  "memory": {
    "process": {
      "heapUsed": 50,
      "heapTotal": 100,
      "rss": 150,
      "external": 10
    },
    "system": {
      "total": 16384,
      "free": 8192,
      "used": 8192,
      "usagePercent": 50
    }
  },
  "cpu": {
    "count": 8,
    "average": 25,
    "cores": [...]
  },
  "googleSheets": {
    "status": "healthy",
    "message": "Google Sheets API connection is healthy"
  }
}
```

### 2. 응답 시간 로깅 확인
서버 로그에서 다음과 같은 메시지를 확인하세요:

```
✅ [Response Time] { method: 'GET', url: '/api/stores', statusCode: 200, responseTime: 150 }
⚠️ [Response Time] 느린 응답: { method: 'GET', url: '/api/budget/month-sheets', responseTime: 3500 }
🔴 [Response Time] 매우 느린 응답: { method: 'POST', url: '/api/policy-table', responseTime: 5200 }
```

### 3. 캐시 크기 경고 확인
캐시가 임계값에 도달하면 다음과 같은 로그가 출력됩니다:

```
⚠️ [Cache Monitor] 캐시 크기 경고: { cacheName: 'mainCache', currentSize: 185, usagePercent: 92 }
🔴 [Cache Monitor] 캐시 크기 임계값 초과 (Critical): { cacheName: 'mainCache', currentSize: 198, usagePercent: 99 }
```

### 4. 동시 요청 수 경고 확인
동시 요청이 많을 때 다음과 같은 로그가 출력됩니다:

```
⚠️ [Concurrent Requests] 동시 요청 수 경고: { context: 'Google Sheets API', currentCount: 9 }
🔴 [Concurrent Requests] 동시 요청 수 임계값 초과 (Critical): { context: 'Google Sheets API', currentCount: 13 }
```

## 주의사항

1. **server/index.js 파일이 크거나 불안정한 경우:**
   - 작은 부분씩 통합하세요
   - 각 단계마다 서버를 재시작하고 테스트하세요
   - 문제가 발생하면 이전 단계로 롤백하세요

2. **성능 영향:**
   - 응답 시간 로깅은 매우 가벼운 오버헤드만 발생시킵니다 (< 1ms)
   - 캐시 모니터링은 쿨다운 메커니즘으로 로그 스팸을 방지합니다
   - 헬스체크는 별도 엔드포인트이므로 일반 API에 영향을 주지 않습니다

3. **로그 레벨:**
   - 개발 환경: 모든 응답 시간 로깅
   - 프로덕션 환경: 경고 및 에러만 로깅
   - `NODE_ENV` 환경 변수로 제어됩니다

## 문제 해결

### 문제: 헬스체크가 항상 'unknown' 상태를 반환
**해결:** Google Sheets 클라이언트 초기화 후 `healthCheckHandler`를 업데이트했는지 확인하세요.

### 문제: 응답 시간 로그가 너무 많음
**해결:** `createResponseTimeLoggerWithFilter`의 제외 경로 목록에 자주 호출되는 엔드포인트를 추가하세요.

### 문제: 캐시 경고가 너무 자주 발생
**해결:** `cacheMonitor.js`의 `warningCooldown` 값을 증가시키세요 (기본값: 5분).

## 추가 개선 사항

1. **통계 대시보드:**
   - `/api/stats/response-time` 엔드포인트로 응답 시간 통계 조회
   - `/api/stats/system` 엔드포인트로 캐시 및 동시 요청 통계 조회
   - 프론트엔드에서 실시간 모니터링 대시보드 구현

2. **알림 통합:**
   - Discord webhook으로 경고 전송
   - 이메일 알림 설정
   - Slack 통합

3. **메트릭 수집:**
   - Prometheus 메트릭 export
   - Grafana 대시보드 구성
   - CloudWatch 통합 (AWS 환경)

## 참고 자료

- [Express 미들웨어 가이드](https://expressjs.com/en/guide/using-middleware.html)
- [Node.js 성능 모니터링](https://nodejs.org/api/perf_hooks.html)
- [Google Sheets API 문서](https://developers.google.com/sheets/api)
