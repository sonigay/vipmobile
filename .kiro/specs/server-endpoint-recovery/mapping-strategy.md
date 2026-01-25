# 라우터 매핑 전략 문서

**작성일**: 2025-01-25  
**버전**: 1.0

---

## 📋 개요

이 문서는 VIP Plus 서버의 라우터 모듈 매핑 규칙과 각 모듈의 책임 범위를 정의합니다.

---

## 🎯 라우터 매핑 원칙

### 1. 기능별 분리 원칙
- 각 라우터 모듈은 **단일 책임**을 가짐
- 관련된 엔드포인트를 하나의 모듈로 그룹화
- 모듈 간 의존성 최소화

### 2. RESTful 원칙 준수
- 리소스 중심의 URL 설계
- HTTP 메서드의 의미론적 사용 (GET, POST, PUT, DELETE)
- 계층적 URL 구조

### 3. 베이스 경로 일관성
- 모든 API는 `/api` 접두사 사용 (일부 예외 제외)
- 리소스명은 복수형 사용 (예: `/api/stores`, `/api/agents`)
- 하이픈(-) 사용, 언더스코어(_) 지양

---

## 📊 라우터 모듈 매핑 테이블

### Phase 3: 핵심 시스템 라우트

| 라우터 모듈 | 베이스 경로 | 책임 범위 | 엔드포인트 수 |
|------------|------------|----------|--------------|
| **healthRoutes** | `/`, `/api` | 서버 상태 확인, 버전 정보 | 4개 |
| **loggingRoutes** | `/api` | 클라이언트 로그 수집, 활동 로깅 | 2개 |
| **cacheRoutes** | `/api` | 캐시 상태 확인, 캐시 새로고침 | 2개 |

**상세 매핑**:
- `healthRoutes.js`:
  - `GET /health` - 서버 헬스체크
  - `GET /` - 서버 상태 확인
  - `GET /api/version` - 버전 정보
  - `GET /api/cache-status` - 캐시 상태 (중복 가능성)

- `loggingRoutes.js`:
  - `POST /api/client-logs` - 클라이언트 로그 수집
  - `POST /api/log-activity` - 사용자 활동 로깅

- `cacheRoutes.js`:
  - `POST /api/cache-refresh` - 캐시 강제 새로고침

---

### Phase 4: 기본 데이터 조회 라우트

| 라우터 모듈 | 베이스 경로 | 책임 범위 | 엔드포인트 수 |
|------------|------------|----------|--------------|
| **teamRoutes** | `/api` | 팀 목록, 팀장 정보 조회 | 2개 |
| **coordinateRoutes** | `/api` | 주소 좌표 변환 및 업데이트 | 2개 |
| **storeRoutes** | `/api` | 매장 정보 조회 | 1개 |
| **modelRoutes** | `/api` | 모델 및 색상 정보 조회 | 3개 |
| **agentRoutes** | `/api` | 대리점 정보 조회 | 5개 |

**상세 매핑**:
- `teamRoutes.js`:
  - `GET /api/teams` - 팀 목록 조회
  - `GET /api/team-leaders` - 팀장 목록 조회

- `coordinateRoutes.js`:
  - `POST /api/update-coordinates` - 매장 주소 좌표 업데이트
  - `POST /api/update-sales-coordinates` - 판매점 주소 좌표 업데이트

- `storeRoutes.js`:
  - `GET /api/stores` - 매장 목록 조회

- `modelRoutes.js`:
  - `GET /api/models` - 모델 목록 조회
  - `GET /api/operation-models` - 운영 모델 조회
  - `GET /api/model-normalization` - 모델 정규화

- `agentRoutes.js`:
  - `GET /api/agents` - 대리점 목록 조회
  - `GET /api/agent-office-department` - 사무실/부서 정보
  - `GET /api/agent-closing-chart` - 마감 차트
  - `GET /api/agent-closing-agents` - 마감 대리점
  - `GET /api/agent-closing-initial` - 마감 초기값

---

### Phase 5: 비즈니스 로직 라우트

| 라우터 모듈 | 베이스 경로 | 책임 범위 | 엔드포인트 수 |
|------------|------------|----------|--------------|
| **mapDisplayRoutes** | `/api` | 지도 표시 옵션 관리 | 5개 |
| **salesRoutes** | `/api` | 영업 데이터 조회 및 권한 관리 | 2개 |
| **inventoryRecoveryRoutes** | `/api` | 재고회수 모드 접근 권한 | 1개 |
| **activationRoutes** | `/api` | 개통 실적 데이터 조회 | 4개 |
| **authRoutes** | `/api` | 인증 및 비밀번호 검증 | 3개 |

**상세 매핑**:
- `mapDisplayRoutes.js`:
  - `GET /api/map-display-option` - 지도 표시 옵션 조회
  - `POST /api/map-display-option` - 지도 표시 옵션 저장
  - `POST /api/map-display-option/batch` - 배치 저장
  - `GET /api/map-display-option/values` - 선택값 목록
  - `GET /api/map-display-option/users` - 사용자 목록

- `salesRoutes.js`:
  - `GET /api/sales-data` - 영업 데이터 조회
  - `GET /api/sales-mode-access` - 영업 모드 접근 권한

- `inventoryRecoveryRoutes.js`:
  - `GET /api/inventoryRecoveryAccess` - 재고회수 모드 접근 권한

- `activationRoutes.js`:
  - `GET /api/activation-data/current-month` - 당월 개통 실적
  - `GET /api/activation-data/previous-month` - 전월 개통 실적
  - `GET /api/activation-data/by-date` - 날짜별 개통 실적
  - `GET /api/activation-data/date-comparison/:date` - 날짜 비교

- `authRoutes.js`:
  - `POST /api/login` - 로그인
  - `POST /api/verify-password` - 비밀번호 검증
  - `POST /api/verify-direct-store-password` - 직영점 비밀번호 검증

---

### Phase 6: 고급 기능 라우트

| 라우터 모듈 | 베이스 경로 | 책임 범위 | 엔드포인트 수 |
|------------|------------|----------|--------------|
| **memberRoutes** | `/api/member` | 고객 관리 (로그인, 대기열, 게시판) | 11개 |
| **onsaleRoutes** | `/api/onsale` | 온라인 판매 관리 | 21개 |
| **inventoryRoutes** | `/api` | 재고 관리 및 배정 | 12개 |
| **budgetRoutes** | `/api/budget` | 예산 관리 | 20개 |
| **policyNoticeRoutes** | `/api` | 정책 공지사항 관리 | 4개 |

**상세 매핑**:
- `memberRoutes.js`:
  - `POST /api/member/login` - 고객 로그인
  - `GET /api/member/queue/all` - 전체 대기열 조회
  - `GET /api/member/queue` - 고객별 대기열 조회
  - `POST /api/member/queue` - 대기열 등록
  - `PUT /api/member/queue/:id` - 대기열 수정
  - `DELETE /api/member/queue/:id` - 대기열 삭제
  - `GET /api/member/board` - 게시판 목록
  - `GET /api/member/board/:id` - 게시판 상세
  - `POST /api/member/board` - 게시판 작성
  - `PUT /api/member/board/:id` - 게시판 수정
  - `DELETE /api/member/board/:id` - 게시판 삭제

- `onsaleRoutes.js`:
  - 개통 정보 관리 (8개)
  - 링크 관리 (5개)
  - 정책 관리 (8개)

- `inventoryRoutes.js`:
  - 재고 상태 조회 (6개)
  - 배정 관리 (3개)
  - 분석 및 검사 (3개)

- `budgetRoutes.js`:
  - 정책 그룹 관리 (4개)
  - 월별 시트 관리 (3개)
  - 사용자 시트 관리 (9개)
  - 요약 및 재계산 (4개)

- `policyNoticeRoutes.js`:
  - `GET /api/policy-notices` - 공지사항 목록
  - `POST /api/policy-notices` - 공지사항 작성
  - `PUT /api/policy-notices/:id` - 공지사항 수정
  - `DELETE /api/policy-notices/:id` - 공지사항 삭제

---

### Additional: 확장 기능 라우트

| 라우터 모듈 | 베이스 경로 | 책임 범위 | 엔드포인트 수 |
|------------|------------|----------|--------------|
| **policyRoutes** | `/policies`, `/policy`, `/api` | 정책 문서 관리 | 23개 |
| **notificationRoutes** | `/notifications`, `/api` | 알림 관리 | 3개 |
| **appUpdateRoutes** | `/app-updates`, `/api` | 앱 업데이트 관리 | 2개 |
| **discordRoutes** | `/discord`, `/api` | Discord 통합 | 1개 |
| **miscRoutes** | 다양함 | 기타 유틸리티 엔드포인트 | 50개 |
| **assignmentRoutes** | `/api/assignment` | 배정 이력 관리 | 2개 |
| **closingChartRoutes** | `/api/closing-chart` | 마감 차트 관리 | 4개 |
| **inspectionRoutes** | `/api/inspection` | 검수 관리 | 14개 |
| **reservationRoutes** | `/api/reservation` | 예약 관리 | 23개 |
| **smsRoutes** | `/api/sms` | SMS 관리 | 21개 |
| **cancelCheckRoutes** | `/api/cancel-check` | 취소 확인 | 3개 |
| **dataCollectionRoutes** | `/api/data-collection-updates` | 데이터 수집 | 2개 |
| **quickCostRoutes** | `/api/quick-cost` | 빠른 비용 계산 | 13개 |
| **rechotanchoBondRoutes** | `/api/rechotancho-bond` | 레초탄초 채권 관리 | 6개 |
| **subscriberIncreaseRoutes** | `/api/subscriber-increase` | 가입자 증가 관리 | 7개 |
| **salesByStoreRoutes** | `/api/sales-by-store` | 매장별 판매 | 2개 |
| **posCodeRoutes** | `/api/pos-code-mappings` | POS 코드 매핑 | 3개 |
| **directStoreAdditionalRoutes** | `/api/direct` | 직영점 추가 기능 | 10개 |

---

### Existing: 기존 라우트 (레거시)

| 라우터 모듈 | 베이스 경로 | 책임 범위 | 엔드포인트 수 |
|------------|------------|----------|--------------|
| **directRoutes** | `/api/direct` | 직영점 기본 기능 | 다수 |
| **meetingRoutes** | `/api/meetings` | 회의 관리 | 12개 |
| **obRoutes** | `/api/ob` | 아웃바운드 관리 | 다수 |
| **policyTableRoutes** | `/api/policy-table` | 정책표 생성 | 다수 |

---

## 🔄 중복 엔드포인트 해결 전략

### 현재 중복 (2개):

1. **`POST /api/verify-password`**
   - **유지**: `authRoutes.js` (Phase 5)
   - **제거**: `directStoreAdditionalRoutes.js`
   - **이유**: 인증 관련 로직은 authRoutes에 집중

2. **`POST /api/verify-direct-store-password`**
   - **유지**: `authRoutes.js` (Phase 5)
   - **제거**: `directStoreAdditionalRoutes.js`
   - **이유**: 인증 관련 로직은 authRoutes에 집중

---

## 📐 URL 패턴 규칙

### 1. 리소스 명명 규칙
- **복수형 사용**: `/api/stores`, `/api/agents`, `/api/models`
- **하이픈 구분**: `/api/map-display-option`, `/api/team-leaders`
- **계층 구조**: `/api/member/queue`, `/api/onsale/policies`

### 2. 파라미터 규칙
- **ID 파라미터**: `/:id`, `/:policyId`, `/:meetingId`
- **이름 파라미터**: `/:storeName`, `/:agentName`
- **복합 파라미터**: `/:sheetId/:rowIndex`

### 3. 액션 규칙
- **동사 사용 최소화**: RESTful 원칙 준수
- **필요시 명확한 동사**: `/complete`, `/approve`, `/cancel`
- **배치 작업**: `/batch` 접미사

---

## 🎯 새로운 라우터 모듈 추가 가이드

### 1. 모듈 생성 기준
- 5개 이상의 관련 엔드포인트
- 명확한 단일 책임
- 독립적인 비즈니스 로직

### 2. 파일 명명 규칙
- `{기능명}Routes.js` 형식
- 카멜케이스 사용
- 예: `userManagementRoutes.js`, `reportGenerationRoutes.js`

### 3. 모듈 구조
```javascript
const express = require('express');
const router = express.Router();

module.exports = (sharedContext) => {
  const { sheetsClient, cacheManager, rateLimiter, discordBot } = sharedContext;
  
  // 엔드포인트 정의
  router.get('/api/resource', async (req, res) => {
    // 로직
  });
  
  return router;
};
```

---

## 📊 베이스 경로 충돌 검사

### 현재 베이스 경로 목록:
- `/` - healthRoutes
- `/api` - 대부분의 라우트
- `/api/member` - memberRoutes
- `/api/onsale` - onsaleRoutes
- `/api/budget` - budgetRoutes
- `/api/direct` - directRoutes, directStoreAdditionalRoutes
- `/api/meetings` - meetingRoutes
- `/api/assignment` - assignmentRoutes
- `/api/closing-chart` - closingChartRoutes
- `/api/inspection` - inspectionRoutes
- `/api/reservation` - reservationRoutes
- `/api/sms` - smsRoutes
- `/api/cancel-check` - cancelCheckRoutes
- `/api/quick-cost` - quickCostRoutes
- `/api/rechotancho-bond` - rechotanchoBondRoutes
- `/api/subscriber-increase` - subscriberIncreaseRoutes
- `/api/sales-by-store` - salesByStoreRoutes
- `/api/pos-code-mappings` - posCodeRoutes
- `/policies` - policyRoutes
- `/policy` - policyRoutes
- `/notifications` - notificationRoutes
- `/app-updates` - appUpdateRoutes
- `/discord` - discordRoutes

### 충돌 없음 ✅
모든 베이스 경로가 고유하며 충돌이 없습니다.

---

## 📝 요약

- **총 라우터 모듈**: 35개
- **총 엔드포인트**: 300개
- **중복 엔드포인트**: 2개 (해결 예정)
- **베이스 경로 충돌**: 없음
- **매핑 전략**: 기능별 분리, RESTful 원칙 준수

---

**작성 완료**: 2025-01-25  
**다음 단계**: Task 3.2 - 베이스 경로 및 URL 패턴 표준화
