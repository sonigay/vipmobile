# 라우터 등록 순서 최적화

## 생성 일시
2025-01-25

---

## 라우터 등록 순서 원칙

### 1. 구체적 경로 우선
- 구체적인 경로를 먼저 등록
- 파라미터 경로를 나중에 등록
- 와일드카드 경로를 마지막에 등록

### 2. 베이스 경로별 그룹화
- 같은 베이스 경로를 가진 라우터를 함께 등록
- 예: `/api/member/*` 관련 라우터들을 연속으로 등록

### 3. 중요도 순서
- Health & Monitoring (최우선)
- Authentication (인증)
- Core Data (매장, 대리점, 팀 등)
- Feature-specific (기능별)

---

## 현재 라우터 등록 순서 분석

### Phase 3 (Health & Monitoring)
```javascript
app.use('/', createHealthRoutes(sharedContext));        // GET /health, GET /
app.use('/', createLoggingRoutes(sharedContext));       // POST /api/client-logs
app.use('/', createCacheRoutes(sharedContext));         // GET /api/cache-status
```
✅ **순서 적절**: Health 체크가 최우선

### Phase 4 (Core Data)
```javascript
app.use('/', createTeamRoutes(sharedContext));          // GET /api/teams
app.use('/', createCoordinateRoutes(sharedContext));    // POST /api/update-coordinates
app.use('/', createStoreRoutes(sharedContext));         // GET /api/stores
app.use('/', createModelRoutes(sharedContext));         // GET /api/models
app.use('/', createAgentRoutes(sharedContext));         // GET /api/agents
```
✅ **순서 적절**: 핵심 데이터 조회

### Phase 5 (Sales & Auth)
```javascript
app.use('/', createMapDisplayRoutes(sharedContext));    // GET /api/map-display-option
app.use('/', createSalesRoutes(sharedContext));         // GET /api/sales-data
app.use('/', createInventoryRecoveryRoutes(sharedContext)); // GET /api/inventoryRecoveryAccess
app.use('/', createActivationRoutes(sharedContext));    // GET /api/activation-data/*
app.use('/', createAuthRoutes(sharedContext));          // POST /api/login
```
⚠️ **문제**: Auth가 너무 늦게 등록됨 (Phase 5)

### Phase 6 (Feature-specific)
```javascript
app.use('/', createMemberRoutes(sharedContext));        // /api/member/*
app.use('/', createOnsaleRoutes(sharedContext));        // POST /api/onsale/*
app.use('/', createInventoryRoutes(sharedContext));     // /api/inventory/*
app.use('/', createBudgetRoutes(sharedContext));        // /api/budget/*
app.use('/', createPolicyNoticeRoutes(sharedContext));  // /api/policy-notice/*
```
✅ **순서 적절**: 기능별 라우터

### Additional Routes
```javascript
app.use('/api', createPolicyRoutes(sharedContext));
app.use('/api', createNotificationRoutes(sharedContext));
app.use('/api', createAppUpdateRoutes(sharedContext));
app.use('/api', createDiscordRoutes(sharedContext));
app.use('/api', createMiscRoutes(sharedContext));
app.use('/', createAssignmentRoutes(sharedContext));
app.use('/', createClosingChartRoutes(sharedContext));
app.use('/', createInspectionRoutes(sharedContext));
app.use('/', createReservationRoutes(sharedContext));
app.use('/', createSmsRoutes(sharedContext));
app.use('/', createCancelCheckRoutes(sharedContext));
app.use('/', createDataCollectionRoutes(sharedContext));
app.use('/', createQuickCostRoutes(sharedContext));
app.use('/', createRechotanchoBondRoutes(sharedContext));
app.use('/', createSubscriberIncreaseRoutes(sharedContext));
app.use('/', createSalesByStoreRoutes(sharedContext));
app.use('/', createPosCodeRoutes(sharedContext));
app.use('/api/direct', createDirectStoreAdditionalRoutes(sharedContext));
```
✅ **순서 적절**: 추가 기능들

---

## 최적화된 라우터 등록 순서

### 권장 순서

```javascript
// ============================================================================
// Phase 1: Health & Monitoring (최우선)
// ============================================================================
app.use('/', createHealthRoutes(sharedContext));
app.use('/', createLoggingRoutes(sharedContext));
app.use('/', createCacheRoutes(sharedContext));

// ============================================================================
// Phase 2: Authentication (인증 - 두 번째 우선순위)
// ============================================================================
app.use('/', createAuthRoutes(sharedContext));

// ============================================================================
// Phase 3: Core Data (핵심 데이터)
// ============================================================================
app.use('/', createStoreRoutes(sharedContext));
app.use('/', createAgentRoutes(sharedContext));
app.use('/', createTeamRoutes(sharedContext));
app.use('/', createModelRoutes(sharedContext));
app.use('/', createCoordinateRoutes(sharedContext));

// ============================================================================
// Phase 4: Sales & Activation (영업 데이터)
// ============================================================================
app.use('/', createSalesRoutes(sharedContext));
app.use('/', createSalesByStoreRoutes(sharedContext));
app.use('/', createActivationRoutes(sharedContext));

// ============================================================================
// Phase 5: Map & Display (지도 및 표시)
// ============================================================================
app.use('/', createMapDisplayRoutes(sharedContext));

// ============================================================================
// Phase 6: Inventory (재고 관리)
// ============================================================================
app.use('/', createInventoryRoutes(sharedContext));
app.use('/', createInventoryRecoveryRoutes(sharedContext));
app.use('/', createAssignmentRoutes(sharedContext));

// ============================================================================
// Phase 7: Direct Store (직영점 - 구체적 경로 먼저)
// ============================================================================
app.use('/api/direct', createDirectStoreAdditionalRoutes(sharedContext));
app.use('/', createMemberRoutes(sharedContext));

// ============================================================================
// Phase 8: Reservation & SMS (예약 및 SMS)
// ============================================================================
app.use('/', createReservationRoutes(sharedContext));
app.use('/', createSmsRoutes(sharedContext));

// ============================================================================
// Phase 9: Policy & Notification (정책 및 알림)
// ============================================================================
app.use('/api', createPolicyRoutes(sharedContext));
app.use('/', createPolicyNoticeRoutes(sharedContext));
app.use('/api', createNotificationRoutes(sharedContext));

// ============================================================================
// Phase 10: Budget & Inspection (예산 및 검수)
// ============================================================================
app.use('/', createBudgetRoutes(sharedContext));
app.use('/', createInspectionRoutes(sharedContext));
app.use('/', createClosingChartRoutes(sharedContext));

// ============================================================================
// Phase 11: Additional Features (추가 기능)
// ============================================================================
app.use('/', createOnsaleRoutes(sharedContext));
app.use('/', createCancelCheckRoutes(sharedContext));
app.use('/', createDataCollectionRoutes(sharedContext));
app.use('/', createQuickCostRoutes(sharedContext));
app.use('/', createRechotanchoBondRoutes(sharedContext));
app.use('/', createSubscriberIncreaseRoutes(sharedContext));
app.use('/', createPosCodeRoutes(sharedContext));

// ============================================================================
// Phase 12: Utility & Misc (유틸리티)
// ============================================================================
app.use('/api', createAppUpdateRoutes(sharedContext));
app.use('/api', createDiscordRoutes(sharedContext));
app.use('/api', createMiscRoutes(sharedContext));

// ============================================================================
// Phase 13: Legacy Routes (기존 라우트)
// ============================================================================
const policyTableRouter = setupPolicyTableRoutes(app);
app.use('/api', policyTableRouter);
```

---

## 주요 변경 사항

### 1. Auth 라우터 우선순위 상승
**변경 전**: Phase 5 (5번째)
**변경 후**: Phase 2 (2번째)

**이유**: 로그인은 대부분의 기능에 선행되어야 하므로 우선순위를 높임

### 2. 기능별 그룹화
- Sales 관련: `salesRoutes`, `salesByStoreRoutes`, `activationRoutes`
- Inventory 관련: `inventoryRoutes`, `inventoryRecoveryRoutes`, `assignmentRoutes`
- Direct Store 관련: `directStoreAdditionalRoutes`, `memberRoutes`
- Policy 관련: `policyRoutes`, `policyNoticeRoutes`

### 3. 베이스 경로 충돌 방지
- `/api/direct/*` 라우터를 `/api/member/*` 보다 먼저 등록
- 구체적인 경로가 파라미터 경로보다 우선

---

## 라우터 등록 에러 처리

### 현재 구현
```javascript
try {
  app.use('/', createHealthRoutes(sharedContext));
  console.log('✅ [Phase 3] Health routes mounted');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount Health routes:', e.message);
}
```

### 권장 개선
```javascript
try {
  app.use('/', createHealthRoutes(sharedContext));
  console.log('✅ [Phase 1] Health routes mounted');
} catch (e) {
  console.error('❌ [Phase 1] Failed to mount Health routes:', e.message);
  // Health 라우터는 필수이므로 서버 종료
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}
```

---

## 라우터 등록 순서 검증

### 검증 항목
- [ ] Health 라우터가 최우선으로 등록됨
- [ ] Auth 라우터가 Phase 2에 등록됨
- [ ] 구체적 경로가 파라미터 경로보다 먼저 등록됨
- [ ] 베이스 경로 충돌이 없음
- [ ] 모든 라우터가 에러 처리로 감싸져 있음

### 테스트 방법
```bash
# 서버 시작 후 로그 확인
npm start

# 예상 출력:
# ✅ [Phase 1] Health routes mounted
# ✅ [Phase 2] Auth routes mounted
# ✅ [Phase 3] Store routes mounted
# ...
```

---

## 다음 단계

1. ✅ 라우터 등록 순서 문서 작성 완료
2. ⏳ index.js에 최적화된 순서 적용 (선택적)
3. ⏳ 서버 시작 테스트
4. ⏳ 라우터 등록 로그 확인

---

## 참고사항

### 현재 순서도 작동함
- 현재 라우터 등록 순서도 기능적으로 문제없음
- Auth가 늦게 등록되어도 라우팅은 정상 작동
- 최적화는 **선택적**이며 필수는 아님

### 최적화 효과
- 로그 가독성 향상 (기능별 그룹화)
- 유지보수 용이성 향상
- 라우터 추가 시 명확한 위치 파악

### 적용 여부
- **즉시 적용 불필요**: 현재 순서로도 정상 작동
- **추후 리팩토링 시 고려**: 대규모 수정 시 적용
