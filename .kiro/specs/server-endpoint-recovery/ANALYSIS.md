# 엔드포인트 분석 결과

## 📊 백업 파일 분석

### 백업 파일에서 발견된 엔드포인트 (50개)

#### Health & System (4개)
1. `GET /health`
2. `GET /` (서버 상태)
3. `GET /api/version`
4. `GET /api/test`

#### Cache & Logging (4개)
5. `GET /api/cache-status`
6. `POST /api/cache-refresh`
7. `POST /api/client-logs`
8. `POST /api/log-activity`

#### Team & Coordinate (4개)
9. `GET /api/teams`
10. `GET /api/team-leaders`
11. `POST /api/update-coordinates`
12. `POST /api/update-sales-coordinates`

#### Store, Model, Agent (3개)
13. `GET /api/stores`
14. `GET /api/models`
15. `GET /api/agents`

#### Map Display Options (5개)
16. `GET /api/map-display-option`
17. `POST /api/map-display-option`
18. `POST /api/map-display-option/batch`
19. `GET /api/map-display-option/values`
20. `GET /api/map-display-option/users`

#### Sales & Activation (6개)
21. `GET /api/sales-data`
22. `GET /api/sales-mode-access`
23. `GET /api/inventoryRecoveryAccess`
24. `GET /api/activation-data/current-month`
25. `GET /api/activation-data/previous-month`
26. `GET /api/activation-data/by-date`
27. `GET /api/activation-data/date-comparison/:date`

#### Authentication (3개)
28. `POST /api/login`
29. `POST /api/verify-password`
30. `POST /api/verify-direct-store-password`

#### Member Management (11개)
31. `POST /api/member/login`
32. `GET /api/member/queue/all`
33. `GET /api/member/queue`
34. `POST /api/member/queue`
35. `PUT /api/member/queue/:id`
36. `DELETE /api/member/queue/:id`
37. `GET /api/member/board`
38. `GET /api/member/board/:id`
39. `POST /api/member/board`
40. `PUT /api/member/board/:id`
41. `DELETE /api/member/board/:id`

#### Direct Store (7개)
42. `GET /api/direct/drive-monitoring`
43. `GET /api/direct/pre-approval-mark/:storeName`
44. `POST /api/direct/pre-approval-mark`
45. `GET /api/direct/store-image/:storeName`
46. `POST /api/direct/store-image`
47. `POST /api/direct/store-image/upload`

#### Onsale (1개)
48. `POST /api/onsale/activation-info/:sheetId/:rowIndex/complete`

#### 주석 처리된 엔드포인트 (2개)
49. `GET /api/direct/todays-mobiles` (주석 처리됨)
50. `GET /api/direct/mobiles` (주석 처리됨)

---

## 🔍 현재 라우터 구조 분석

### 현재 등록된 라우터 모듈 (34개)

#### Phase 3 (3개)
- healthRoutes
- loggingRoutes
- cacheRoutes

#### Phase 4 (5개)
- teamRoutes
- coordinateRoutes
- storeRoutes
- modelRoutes
- agentRoutes

#### Phase 5 (5개)
- mapDisplayRoutes
- salesRoutes
- inventoryRecoveryRoutes
- activationRoutes
- authRoutes

#### Phase 6 (4개)
- memberRoutes
- onsaleRoutes
- inventoryRoutes
- budgetRoutes
- policyNoticeRoutes

#### Additional (17개)
- policyRoutes
- notificationRoutes
- appUpdateRoutes
- discordRoutes
- miscRoutes
- assignmentRoutes
- closingChartRoutes
- inspectionRoutes
- reservationRoutes
- smsRoutes
- cancelCheckRoutes
- dataCollectionRoutes
- quickCostRoutes
- rechotanchoBondRoutes
- subscriberIncreaseRoutes
- salesByStoreRoutes
- posCodeRoutes
- directStoreAdditionalRoutes

#### Existing (3개)
- directRoutes
- meetingRoutes (12개 엔드포인트 직접 등록)
- obRoutes
- policyTableRoutes

---

## ⚠️ 문제점 분석

### 1. 백업 파일의 50개 엔드포인트 중 현재 상태 확인 필요

**확인이 필요한 이유:**
- 백업 파일에는 `app.get()`, `app.post()` 등으로 **직접 등록**된 엔드포인트가 50개
- 현재는 34개의 **라우터 모듈**로 분리되어 있음
- 각 라우터 모듈 내부에 엔드포인트가 있는지 확인 필요

### 2. 예상되는 문제

#### 누락 가능성이 높은 엔드포인트:
1. **Health & System** - healthRoutes에 있어야 함
   - `GET /health` ✓ (백업에 있음)
   - `GET /` ✓ (백업에 있음)
   - `GET /api/version` ✓ (백업에 있음)
   - `GET /api/test` ✓ (백업에 있음)

2. **Team & Coordinate** - teamRoutes, coordinateRoutes에 있어야 함
   - `GET /api/teams` ✓
   - `GET /api/team-leaders` ✓
   - `POST /api/update-coordinates` ✓
   - `POST /api/update-sales-coordinates` ✓

3. **Map Display** - mapDisplayRoutes에 있어야 함
   - 5개 엔드포인트 모두 확인 필요

4. **Member Management** - memberRoutes에 있어야 함
   - 11개 엔드포인트 모두 확인 필요

5. **Direct Store** - directStoreAdditionalRoutes에 있어야 함
   - 7개 엔드포인트 확인 필요

### 3. 시트 이름 및 컬럼 범위 문제

백업 파일에는 정확한 시트 이름과 컬럼 범위가 있지만, 라우터 모듈로 분리하면서:
- 시트 이름이 변경되었을 가능성
- 컬럼 인덱스가 잘못 매핑되었을 가능성
- 캐시 키가 변경되었을 가능성

---

## 📋 다음 단계

### 즉시 확인이 필요한 작업:

1. **각 라우터 파일 내부 확인**
   ```bash
   # 예시: teamRoutes.js에 실제로 엔드포인트가 있는지 확인
   cat server/routes/teamRoutes.js
   ```

2. **누락된 엔드포인트 식별**
   - 백업 파일의 50개 엔드포인트
   - vs 현재 라우터 파일들의 실제 엔드포인트

3. **시트 참조 검증**
   - 백업 파일의 시트 이름
   - vs 현재 라우터 파일의 시트 이름

---

## 🚨 긴급 권장사항

### 옵션 1: 즉시 백업 복구 (가장 안전)
```bash
# 현재 상태 백업
cp server/index.js server/index.js.broken

# 원본 복구
cp server/index.js.backup.1769270785967 server/index.js

# 서버 재시작
npm start
```

### 옵션 2: 체계적 복구 (시간 소요)
1. 각 라우터 파일 내부 확인
2. 누락된 엔드포인트 복구
3. 시트 참조 수정
4. 테스트 및 검증

---

## 📊 요약

- **백업 파일**: 50개의 직접 등록된 엔드포인트
- **현재 구조**: 34개의 라우터 모듈 (내부 엔드포인트 개수 미확인)
- **문제**: 라우터 모듈 내부에 엔드포인트가 제대로 있는지 확인 필요
- **위험도**: 🔴 **매우 높음** - 애플리케이션이 작동하지 않는 상태

**결론: 각 라우터 파일을 하나씩 확인하여 실제로 엔드포인트가 구현되어 있는지 검증해야 합니다.**
