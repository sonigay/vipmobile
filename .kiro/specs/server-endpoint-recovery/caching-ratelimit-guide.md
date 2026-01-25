# 캐싱 및 Rate Limiting 가이드

## 개요
Google Sheets API 호출을 최적화하고 Rate Limit 오류를 방지하기 위한 캐싱 및 Rate Limiting 전략 가이드입니다.

---

## 1. Cache Manager

### 1.1 개요
- **위치**: `server/utils/cacheManager.js`
- **타입**: 메모리 기반 캐시 (싱글톤)
- **기본 TTL**: 5분 (300,000ms)
- **최대 크기**: 200개 항목 (FIFO 방식)

### 1.2 주요 기능
- TTL 기반 자동 만료
- 크기 제한 (FIFO)
- 패턴 기반 삭제
- 캐시 상태 조회

### 1.3 사용법

#### 기본 사용
```javascript
const cacheManager = require('../utils/cacheManager');

// 캐시에 저장 (기본 TTL: 5분)
cacheManager.set('stores_list', storesData);

// 캐시에서 조회
const cachedData = cacheManager.get('stores_list');
if (cachedData) {
  return res.json(cachedData);
}

// 캐시 삭제
cacheManager.delete('stores_list');
```

#### 커스텀 TTL
```javascript
// 10분 TTL
cacheManager.set('long_term_data', data, 10 * 60 * 1000);

// 1분 TTL (자주 변경되는 데이터)
cacheManager.set('realtime_data', data, 60 * 1000);

// 1시간 TTL (거의 변경되지 않는 데이터)
cacheManager.set('static_data', data, 60 * 60 * 1000);
```

#### 패턴 기반 삭제
```javascript
// 'stores_'로 시작하는 모든 캐시 삭제
cacheManager.deletePattern('stores_');

// 'activation_2025_'로 시작하는 모든 캐시 삭제
cacheManager.deletePattern('activation_2025_');
```

#### 캐시 상태 조회
```javascript
const status = cacheManager.status();
console.log(`Total: ${status.total}, Valid: ${status.valid}, Expired: ${status.expired}`);
```

### 1.4 캐시 키 네이밍 규칙

#### 기본 형식
```
{category}_{identifier}_{params}
```

#### 예시
```javascript
// 매장 목록
'stores_list'

// 특정 대리점의 매장 목록
'stores_agent_대리점명'

// 팀 목록
'teams_list'

// 영업 데이터 (날짜별)
'sales_data_2025-01-25'

// 개통 데이터 (월별)
'activation_current_month_2025-01'
'activation_previous_month_2024-12'

// 모델 목록
'models_list'

// 지도 표시 옵션 (사용자별)
'map_display_user123'
```

---

## 2. Rate Limiter

### 2.1 개요
- **위치**: `server/utils/rateLimiter.js`
- **타입**: Exponential Backoff 재시도 (싱글톤)
- **기본 간격**: 500ms
- **최대 재시도**: 5회

### 2.2 주요 기능
- API 호출 간 최소 간격 보장 (500ms)
- Rate Limit 에러 자동 감지 (429, RESOURCE_EXHAUSTED)
- Exponential backoff 재시도
- 재시도 간격: 3초 * 2^attempt + jitter (최대 60초)

### 2.3 사용법

#### 기본 사용
```javascript
const rateLimiter = require('../utils/rateLimiter');

// Google Sheets API 호출을 rateLimiter로 감싸기
const response = await rateLimiter.execute(() =>
  sheetsClient.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '시트이름!A:Z'
  })
);

const values = response.data.values || [];
```

#### 여러 API 호출
```javascript
// 병렬 호출 (각각 Rate Limiting 적용)
const [stores, agents, teams] = await Promise.all([
  rateLimiter.execute(() => getStores()),
  rateLimiter.execute(() => getAgents()),
  rateLimiter.execute(() => getTeams())
]);

// 순차 호출 (자동으로 500ms 간격 유지)
const stores = await rateLimiter.execute(() => getStores());
const agents = await rateLimiter.execute(() => getAgents());
```

### 2.4 재시도 로직

#### 재시도 간격 계산
```
delay = 3000ms * 2^attempt + random(0-2000ms)
최대 60초
```

#### 재시도 예시
- 1차 시도: 즉시
- 2차 시도: 3초 + jitter (약 3-5초 후)
- 3차 시도: 6초 + jitter (약 6-8초 후)
- 4차 시도: 12초 + jitter (약 12-14초 후)
- 5차 시도: 24초 + jitter (약 24-26초 후)
- 6차 시도: 48초 + jitter (약 48-50초 후, 최대 60초)

---

## 3. 통합 사용 패턴

### 3.1 캐시 우선 조회 패턴

```javascript
router.get('/api/stores', async (req, res) => {
  try {
    if (!requireSheetsClient(res)) return;

    // 1. 캐시 확인
    const cacheKey = 'stores_list';
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ [캐시] 매장 목록 캐시 사용');
      return sendSuccess(res, { stores: cachedData });
    }

    // 2. 캐시 미스 - API 호출 (Rate Limiting 적용)
    console.log('🔄 [API] 매장 목록 조회 중...');
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '폰클출고처데이터!A:Z'
      })
    );

    const values = response.data.values || [];
    const stores = processStoreData(values);

    // 3. 캐시에 저장
    cacheManager.set(cacheKey, stores);
    console.log('💾 [캐시] 매장 목록 캐시 저장');

    // 4. 응답
    sendSuccess(res, { stores });

  } catch (error) {
    logError('매장조회', '매장 목록 조회 실패', error);
    sendInternalError(res, '매장 목록 조회에 실패했습니다.', error);
  }
});
```

### 3.2 파라미터별 캐시 패턴

```javascript
router.get('/api/sales-data', async (req, res) => {
  try {
    if (!requireSheetsClient(res)) return;

    const { date } = req.query;
    
    // 파라미터를 포함한 캐시 키
    const cacheKey = `sales_data_${date || 'all'}`;
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData) {
      return sendSuccess(res, { sales: cachedData });
    }

    // API 호출 및 캐시 저장
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '영업데이터!A:Z'
      })
    );

    const sales = processSalesData(response.data.values, date);
    cacheManager.set(cacheKey, sales);
    
    sendSuccess(res, { sales });

  } catch (error) {
    logError('영업데이터', '영업 데이터 조회 실패', error);
    sendInternalError(res, '영업 데이터 조회에 실패했습니다.', error);
  }
});
```

### 3.3 캐시 무효화 패턴

```javascript
// POST/PUT/DELETE 요청 시 관련 캐시 무효화
router.post('/api/stores', async (req, res) => {
  try {
    if (!requireSheetsClient(res)) return;

    // 1. 데이터 저장
    await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '폰클출고처데이터!A:Z',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newStoreData] }
      })
    );

    // 2. 관련 캐시 무효화
    cacheManager.deletePattern('stores_');
    console.log('🗑️ [캐시] 매장 관련 캐시 무효화');

    sendSuccess(res, null, '매장이 성공적으로 추가되었습니다.');

  } catch (error) {
    logError('매장추가', '매장 추가 실패', error);
    sendInternalError(res, '매장 추가에 실패했습니다.', error);
  }
});
```

---

## 4. 엔드포인트별 캐싱 전략

### 4.1 자주 조회되고 거의 변경되지 않는 데이터 (긴 TTL)

**TTL: 10-30분**

- 모델 목록 (`/api/models`)
- 팀 목록 (`/api/teams`)
- 대리점 목록 (`/api/agents`)

```javascript
cacheManager.set('models_list', data, 30 * 60 * 1000); // 30분
```

### 4.2 자주 조회되고 가끔 변경되는 데이터 (중간 TTL)

**TTL: 5분 (기본값)**

- 매장 목록 (`/api/stores`)
- 영업 데이터 (`/api/sales-data`)
- 개통 데이터 (`/api/activation-data/*`)

```javascript
cacheManager.set('stores_list', data); // 기본 5분
```

### 4.3 실시간성이 중요한 데이터 (짧은 TTL)

**TTL: 1-2분**

- 직영점 대기열 (`/api/member/queue`)
- SMS 수신 목록 (`/api/sms/received`)
- 예약 목록 (`/api/reservation/list`)

```javascript
cacheManager.set('member_queue', data, 60 * 1000); // 1분
```

### 4.4 캐시하지 않는 데이터

- 로그인 (`/api/login`) - 보안상 캐시 금지
- 비밀번호 검증 (`/api/verify-password`) - 보안상 캐시 금지
- 데이터 생성/수정/삭제 (POST/PUT/DELETE) - 캐시 무효화만 수행

---

## 5. 성능 최적화 팁

### 5.1 병렬 조회 최적화

```javascript
// ❌ 나쁜 예: 순차 조회 (느림)
const stores = await getStores();
const agents = await getAgents();
const teams = await getTeams();

// ✅ 좋은 예: 병렬 조회 (빠름)
const [stores, agents, teams] = await Promise.all([
  getStores(),
  getAgents(),
  getTeams()
]);
```

### 5.2 캐시 워밍 (Cache Warming)

```javascript
// 서버 시작 시 자주 사용되는 데이터 미리 캐싱
async function warmupCache() {
  console.log('🔥 [캐시] 캐시 워밍 시작...');
  
  try {
    await Promise.all([
      getStores(),    // 매장 목록 캐싱
      getAgents(),    // 대리점 목록 캐싱
      getTeams(),     // 팀 목록 캐싱
      getModels()     // 모델 목록 캐싱
    ]);
    
    console.log('✅ [캐시] 캐시 워밍 완료');
  } catch (error) {
    console.error('❌ [캐시] 캐시 워밍 실패:', error);
  }
}

// index.js에서 서버 시작 후 호출
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  warmupCache();
});
```

### 5.3 주기적 캐시 정리

```javascript
// 10분마다 만료된 캐시 정리
setInterval(() => {
  const cleaned = cacheManager.cleanup();
  if (cleaned > 0) {
    console.log(`🧹 [캐시] ${cleaned}개 만료된 캐시 정리`);
  }
}, 10 * 60 * 1000);
```

---

## 6. 모니터링 및 디버깅

### 6.1 캐시 상태 엔드포인트

```javascript
// GET /api/cache-status
router.get('/api/cache-status', (req, res) => {
  const status = cacheManager.status();
  const keys = cacheManager.keys();
  
  res.json({
    success: true,
    cache: {
      total: status.total,
      valid: status.valid,
      expired: status.expired,
      maxSize: 200,
      keys: keys.slice(0, 20) // 최근 20개만 표시
    }
  });
});
```

### 6.2 캐시 히트율 로깅

```javascript
let cacheHits = 0;
let cacheMisses = 0;

// 캐시 조회 시
const cachedData = cacheManager.get(cacheKey);
if (cachedData) {
  cacheHits++;
  console.log(`✅ [캐시 HIT] ${cacheKey} (히트율: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1)}%)`);
} else {
  cacheMisses++;
  console.log(`❌ [캐시 MISS] ${cacheKey} (히트율: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1)}%)`);
}
```

---

## 7. 체크리스트

### 모든 GET 엔드포인트에 적용
- [ ] 캐시 키 정의
- [ ] 캐시 조회 로직 추가
- [ ] Rate Limiter로 API 호출 감싸기
- [ ] 캐시 저장 로직 추가
- [ ] 적절한 TTL 설정

### 모든 POST/PUT/DELETE 엔드포인트에 적용
- [ ] Rate Limiter로 API 호출 감싸기
- [ ] 관련 캐시 무효화 로직 추가

### 성능 최적화
- [ ] 병렬 조회 가능한 곳 확인
- [ ] 캐시 워밍 고려
- [ ] 주기적 캐시 정리 설정

---

## 8. 다음 단계

1. ✅ Cache Manager 구현 완료
2. ✅ Rate Limiter 구현 완료
3. ⏳ 모든 라우터에 적용 (Task 12.1, 12.2)
4. ⏳ 성능 테스트 및 최적화
