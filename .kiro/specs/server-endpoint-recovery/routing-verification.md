# 라우팅 테이블 검증 보고서

## 생성 일시
2025-01-25

## 검증 목적
중복 엔드포인트 제거 후 모든 엔드포인트가 유일하고 라우팅 충돌이 없는지 확인

---

## 검증 방법

### 1. 엔드포인트 추출
모든 라우터 파일(`server/routes/*.js`)에서 다음 패턴 검색:
- `router.get()`
- `router.post()`
- `router.put()`
- `router.delete()`
- `router.patch()`

### 2. 중복 검사
- 동일한 HTTP 메서드 + URL 조합이 여러 파일에 존재하는지 확인
- 베이스 경로를 고려한 전체 URL 비교

### 3. 충돌 검사
- 파라미터 경로와 정적 경로 간 충돌 확인
- 예: `/api/stores/:id`와 `/api/stores/detail` 순서 확인

---

## 검증 결과

### ✅ 중복 제거 완료

이전에 발견된 2개의 중복 엔드포인트가 성공적으로 제거되었습니다:

1. **POST /api/verify-password**
   - ✅ authRoutes.js에만 존재
   - ❌ directStoreAdditionalRoutes.js에서 제거됨

2. **POST /api/verify-direct-store-password**
   - ✅ authRoutes.js에만 존재
   - ❌ directStoreAdditionalRoutes.js에서 제거됨

### ✅ 라우팅 충돌 없음

모든 엔드포인트가 유일하며 라우팅 충돌이 없습니다.

---

## 라우터 파일별 엔드포인트 요약

### authRoutes.js (인증)
- POST /api/login
- POST /api/verify-password
- POST /api/verify-direct-store-password

### storeRoutes.js (매장)
- GET /api/stores

### agentRoutes.js (대리점)
- GET /api/agents

### teamRoutes.js (팀)
- GET /api/teams
- GET /api/team-leaders

### salesRoutes.js (영업)
- GET /api/sales-data
- GET /api/sales-mode-access

### activationRoutes.js (개통)
- GET /api/activation-data/current-month
- GET /api/activation-data/previous-month
- GET /api/activation-data/by-date
- GET /api/activation-data/date-comparison/:date

### modelRoutes.js (모델)
- GET /api/models

### coordinateRoutes.js (좌표)
- POST /api/update-coordinates
- POST /api/update-sales-coordinates

### mapDisplayRoutes.js (지도 표시)
- GET /api/map-display-option
- POST /api/map-display-option
- POST /api/map-display-option/batch
- GET /api/map-display-option/values
- GET /api/map-display-option/users

### inventoryRecoveryRoutes.js (재고회수)
- GET /api/inventoryRecoveryAccess

### memberRoutes.js (직영점 회원)
- POST /api/member/login
- GET /api/member/queue/all
- GET /api/member/queue
- POST /api/member/queue
- PUT /api/member/queue/:id
- DELETE /api/member/queue/:id
- GET /api/member/board
- GET /api/member/board/:id
- POST /api/member/board
- PUT /api/member/board/:id
- DELETE /api/member/board/:id

### directStoreAdditionalRoutes.js (직영점 추가)
- GET /api/direct/drive-monitoring
- GET /api/direct/pre-approval-mark/:storeName
- POST /api/direct/pre-approval-mark
- GET /api/direct/store-image/:storeName
- POST /api/direct/store-image
- GET /api/direct/sales
- POST /api/direct/sales
- PUT /api/direct/sales/:id

### onsaleRoutes.js (온세일)
- POST /api/onsale/activation-info/:sheetId/:rowIndex/complete

### healthRoutes.js (헬스체크)
- GET /health
- GET /
- GET /api/version

### loggingRoutes.js (로깅)
- POST /api/client-logs
- POST /api/log-activity

### cacheRoutes.js (캐시)
- GET /api/cache-status
- POST /api/cache-refresh

### smsRoutes.js (SMS)
- GET /api/sms/list
- POST /api/sms/send
- GET /api/sms/auto-reply/rules
- POST /api/sms/auto-reply/rules
- PUT /api/sms/auto-reply/rules/:id
- DELETE /api/sms/auto-reply/rules/:id
- GET /api/sms/auto-reply/pending
- GET /api/sms/auto-reply/history
- GET /api/sms/auto-reply/contacts
- POST /api/sms/auto-reply/contacts
- DELETE /api/sms/auto-reply/contacts/:id
- GET /api/sms/received
- GET /api/sms/history
- GET /api/sms/stats
- POST /api/sms/forward
- POST /api/sms/register
- GET /api/sms/rules
- POST /api/sms/rules
- PUT /api/sms/rules/:id
- DELETE /api/sms/rules/:id
- POST /api/sms/auto-reply/update-status
- POST /api/sms/cleanup
- POST /api/sms/update-forward-status

### reservationRoutes.js (예약)
- GET /api/reservation/list
- POST /api/reservation/save
- GET /api/reservation-settings/list
- GET /api/reservation-settings/data
- POST /api/reservation-settings/save
- GET /api/reservation-sales/all-customers
- GET /api/reservation-sales/model-color
- GET /api/reservation-sales/customer-list/by-agent/:agentName
- GET /api/reservation/assignment-memory
- POST /api/reservation/save-assignment-memory
- GET /api/reservation/assignment-changes
- GET /api/reservation-data/reservation-site
- GET /api/reservation-data/on-sale-receipt

### salesByStoreRoutes.js (매장별 판매)
- GET /api/sales-by-store/data
- POST /api/sales-by-store/update-agent

### subscriberIncreaseRoutes.js (가입자 증가)
- GET /api/subscriber-increase/access
- GET /api/subscriber-increase/data
- POST /api/subscriber-increase/save
- POST /api/subscriber-increase/bulk-save
- DELETE /api/subscriber-increase/delete
- POST /api/subscriber-increase/init-sheet
- POST /api/subscriber-increase/add-excluded-row

---

## 라우팅 순서 권장사항

### 현재 index.js의 라우터 등록 순서
```javascript
// 1. Health & Monitoring (최우선)
app.use('/', healthRoutes);

// 2. Authentication (인증)
app.use('/api', authRoutes);

// 3. Logging & Cache
app.use('/api', loggingRoutes);
app.use('/api', cacheRoutes);

// 4. Core Data (구체적 경로 우선)
app.use('/api', storeRoutes);
app.use('/api', agentRoutes);
app.use('/api', teamRoutes);
app.use('/api', modelRoutes);
app.use('/api', coordinateRoutes);
app.use('/api', mapDisplayRoutes);

// 5. Sales & Activation
app.use('/api', salesRoutes);
app.use('/api', activationRoutes);
app.use('/api', salesByStoreRoutes);

// 6. Inventory
app.use('/api', inventoryRecoveryRoutes);

// 7. Direct Store
app.use('/api/member', memberRoutes);
app.use('/api/direct', directStoreAdditionalRoutes);

// 8. Reservation & SMS
app.use('/api', reservationRoutes);
app.use('/api', smsRoutes);

// 9. Onsale
app.use('/api', onsaleRoutes);

// 10. Subscriber Increase
app.use('/api', subscriberIncreaseRoutes);
```

### ✅ 순서 검증 결과
- 구체적인 경로가 파라미터 경로보다 먼저 등록됨
- 베이스 경로 충돌 없음
- 와일드카드 경로 없음 (404 핸들러는 마지막에 등록)

---

## 잠재적 충돌 검사

### 파라미터 경로 vs 정적 경로
다음 경로들을 검토했으나 충돌 없음:

1. **member 관련**
   - `/api/member/queue/all` (정적) → 먼저 매칭
   - `/api/member/queue/:id` (파라미터) → 나중에 매칭
   - ✅ 순서 올바름

2. **board 관련**
   - `/api/member/board` (정적) → 먼저 매칭
   - `/api/member/board/:id` (파라미터) → 나중에 매칭
   - ✅ 순서 올바름

3. **direct store 관련**
   - `/api/direct/pre-approval-mark/:storeName` (파라미터)
   - `/api/direct/store-image/:storeName` (파라미터)
   - `/api/direct/sales/:id` (파라미터)
   - ✅ 정적 경로와 충돌 없음

---

## 결론

### ✅ 검증 통과
1. **중복 엔드포인트**: 없음 (2개 제거 완료)
2. **라우팅 충돌**: 없음
3. **라우터 등록 순서**: 최적화됨
4. **베이스 경로 충돌**: 없음

### 권장 사항
1. ✅ 현재 라우팅 구조 유지
2. ✅ 새 엔드포인트 추가 시 중복 검사 필수
3. ✅ 파라미터 경로는 정적 경로 이후에 정의

---

## 다음 단계

Task 10.2 완료 → Task 11로 진행
- 에러 처리 및 미들웨어 표준화
