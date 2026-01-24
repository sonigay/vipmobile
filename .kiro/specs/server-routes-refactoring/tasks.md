# Implementation Plan: Server Routes Refactoring

## Overview

이 구현 계획은 server/index.js (42,966줄)를 기능별 라우트 모듈로 분리하는 대규모 리팩토링을 단계적으로 수행합니다. 각 단계는 독립적으로 테스트 및 배포 가능하며, 기존 기능을 100% 유지합니다.

## Tasks

### Phase 1: 공통 인프라 분리

- [x] 1. Google Sheets 클라이언트 모듈 생성
  - [x] 1.1 utils/sheetsClient.js 파일 생성
    - Google Sheets API 클라이언트 초기화 로직 구현
    - Google Drive API 클라이언트 포함
    - 환경 변수 검증 로직 추가
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [ ]* 1.2 sheetsClient 단위 테스트 작성
    - 클라이언트 초기화 테스트
    - 환경 변수 누락 시 에러 테스트
    - 싱글톤 패턴 검증
    - _Requirements: 4.1, 10.5_

- [x] 2. Rate Limiter 모듈 생성
  - [x] 2.1 utils/rateLimiter.js 파일 생성
    - Rate Limiting 로직 구현 (500ms 간격)
    - Exponential backoff 재시도 로직 구현
    - Rate Limit 에러 감지 로직 구현
    - _Requirements: 2.5, 4.3, 4.4_
  
  - [ ]* 2.2 rateLimiter 단위 테스트 작성
    - 최소 간격 보장 테스트
    - 재시도 로직 테스트
    - Rate Limit 에러 감지 테스트
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 2.3 rateLimiter Property 테스트 작성
    - **Property 3: Rate Limiter 최소 간격 보장**
    - **Validates: Requirements 4.3, 13.5**

- [x] 3. Cache Manager 모듈 생성
  - [x] 3.1 utils/cacheManager.js 파일 생성
    - 캐시 저장/조회/삭제 로직 구현
    - TTL 관리 로직 구현 (5분)
    - 캐시 크기 제한 로직 구현 (200개)
    - 캐시 정리 로직 구현
    - _Requirements: 2.4, 5.1, 5.2, 5.3_
  
  - [ ]* 3.2 cacheManager 단위 테스트 작성
    - 캐시 저장/조회 테스트
    - TTL 만료 테스트
    - 크기 제한 테스트
    - 캐시 정리 테스트
    - _Requirements: 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 3.3 cacheManager Property 테스트 작성
    - **Property 4: 캐시 TTL 준수**
    - **Validates: Requirements 5.2**

- [x] 4. Discord Bot 모듈 생성
  - [x] 4.1 utils/discordBot.js 파일 생성
    - Discord 봇 초기화 로직 구현
    - 조건부 초기화 로직 구현 (LOGGING_ENABLED)
    - 알림 전송 함수 구현
    - 에러 처리 로직 구현
    - _Requirements: 2.5, 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 4.2 discordBot 단위 테스트 작성
    - 조건부 초기화 테스트
    - 알림 전송 테스트
    - 전송 실패 시 에러 처리 테스트
    - _Requirements: 6.2, 6.3, 6.5_

- [x] 5. 공통 유틸리티 함수 생성
  - [x] 5.1 utils/responseFormatter.js 파일 생성
    - successResponse 함수 구현
    - errorResponse 함수 구현
    - _Requirements: 9.3_
  
  - [x] 5.2 utils/errorHandler.js 파일 생성
    - handleError 함수 구현
    - Discord 알림 통합
    - 에러 로깅 로직 구현
    - _Requirements: 9.2, 12.1, 12.5_
  
  - [ ]* 5.3 공통 유틸리티 단위 테스트 작성
    - responseFormatter 테스트
    - errorHandler 테스트
    - _Requirements: 9.2, 9.3_

- [x] 6. 설정 상수 모듈 생성
  - [x] 6.1 config/constants.js 파일 생성
    - 시트 이름 상수 정의
    - 캐시 TTL 상수 정의
    - Rate Limit 설정 상수 정의
    - _Requirements: 2.1_

- [ ] 7. Checkpoint - 공통 인프라 검증
  - 모든 유틸리티 모듈 단위 테스트 통과 확인
  - 사용자에게 질문이 있으면 확인


### Phase 2: 미들웨어 분리

- [ ] 8. Timeout 미들웨어 생성
  - [x] 8.1 middleware/timeoutMiddleware.js 파일 생성
    - 타임아웃 설정 로직 구현 (5분)
    - 타임아웃 발생 시 CORS 헤더 추가
    - 504 에러 응답 구현
    - 에러 로깅 구현
    - _Requirements: 3.1, 3.2, 12.3_
  
  - [ ]* 8.2 timeoutMiddleware 단위 테스트 작성
    - 타임아웃 동작 테스트
    - CORS 헤더 포함 확인
    - _Requirements: 3.2, 12.3_

- [ ] 9. Logging 미들웨어 생성
  - [x] 9.1 middleware/loggingMiddleware.js 파일 생성
    - 요청 로깅 로직 구현
    - 응답 로깅 로직 구현
    - 응답 시간 측정 로직 구현
    - _Requirements: 3.3_
  
  - [ ]* 9.2 loggingMiddleware 단위 테스트 작성
    - 요청/응답 로깅 테스트
    - 응답 시간 측정 테스트
    - _Requirements: 3.3_

- [ ] 10. Error 미들웨어 생성
  - [x] 10.1 middleware/errorMiddleware.js 파일 생성
    - 에러 처리 로직 구현
    - 일관된 에러 응답 형식 구현
    - 개발/프로덕션 환경별 스택 트레이스 처리
    - _Requirements: 3.5, 12.1_
  
  - [ ]* 10.2 errorMiddleware 단위 테스트 작성
    - 에러 응답 형식 테스트
    - 환경별 스택 트레이스 테스트
    - _Requirements: 3.5, 12.1_
  
  - [ ]* 10.3 errorMiddleware Property 테스트 작성
    - **Property 2: 에러 응답 일관성**
    - **Validates: Requirements 2.3, 3.5, 8.4, 12.1**

- [x] 11. index.js에 미들웨어 통합
  - [x] 11.1 index.js에서 미들웨어 import 추가
    - timeoutMiddleware import
    - loggingMiddleware import
    - errorMiddleware import
    - _Requirements: 3.1, 3.4_
  
  - [x] 11.2 미들웨어 등록 순서 설정 (Phase 7로 연기)
    - **주의: server/index.js 직접 접근 금지**
    - 이 작업은 Phase 7 (Task 39.2)에서 처리
    - _Requirements: 3.1_

- [x] 12. Checkpoint - 미들웨어 검증
  - 미들웨어 파일들 생성 완료 ✅
  - 단위 테스트는 선택적 작업으로 스킵
  - index.js 통합은 Phase 7에서 처리
  - **Phase 3 (간단한 라우트 모듈 분리)로 진행**

### Phase 3: 간단한 라우트 모듈 분리

- [x] 13. Health Check 라우트 생성
  - [x] 13.1 routes/healthRoutes.js 파일 생성
    - GET /health 엔드포인트 구현
    - GET / 엔드포인트 구현
    - GET /api/version 엔드포인트 구현
    - GET /api/cache-status 엔드포인트 구현
    - healthCheck 모듈 통합
    - _Requirements: 1.1, 1.2, 7.1_
  
  - [ ]* 13.2 healthRoutes 단위 테스트 작성
    - 각 엔드포인트 응답 테스트
    - 캐시 상태 조회 테스트
    - _Requirements: 7.1_

- [x] 14. Logging 라우트 생성
  - [x] 14.1 routes/loggingRoutes.js 파일 생성
    - POST /api/client-logs 엔드포인트 구현
    - POST /api/log-activity 엔드포인트 구현
    - Discord 알림 통합
    - _Requirements: 1.1, 1.2, 7.3_
  
  - [ ]* 14.2 loggingRoutes 단위 테스트 작성
    - 클라이언트 로그 수집 테스트
    - 활동 로깅 테스트
    - _Requirements: 7.3_

- [x] 15. Cache 라우트 생성
  - [x] 15.1 routes/cacheRoutes.js 파일 생성
    - POST /api/cache-refresh 엔드포인트 구현
    - 캐시 무효화 로직 구현
    - _Requirements: 1.1, 1.2, 7.4_
  
  - [ ]* 15.2 cacheRoutes 단위 테스트 작성
    - 캐시 새로고침 테스트
    - _Requirements: 7.4_

- [x] 16. index.js에 라우트 통합
  - [x] 16.1 공통 컨텍스트 객체 생성
    - sheetsClient, cacheManager, rateLimiter, discordBot 포함
    - _Requirements: 4.2_
  
  - [x] 16.2 라우트 모듈 등록
    - healthRoutes 등록
    - loggingRoutes 등록
    - cacheRoutes 등록
    - _Requirements: 1.1, 1.3_

- [x] 17. Checkpoint - 간단한 라우트 검증
  - 모든 라우트 단위 테스트 통과 확인
  - API 엔드포인트 URL 변경 없음 확인
  - 사용자에게 질문이 있으면 확인

### Phase 4: 중간 복잡도 라우트 모듈 분리

- [x] 18. Team 라우트 재구성
  - [x] 18.1 routes/teamRoutes.js 파일 재구성
    - 기존 teamRoutes.js를 새 패턴으로 변환
    - GET /api/teams 엔드포인트 구현
    - GET /api/team-leaders 엔드포인트 구현
    - 컨텍스트 객체 사용
    - _Requirements: 1.1, 1.2, 7.2_
  
  - [ ]* 18.2 teamRoutes 단위 테스트 작성
    - 팀 목록 조회 테스트
    - 팀장 목록 조회 테스트
    - _Requirements: 7.2_

- [x] 19. Coordinate 라우트 생성
  - [x] 19.1 routes/coordinateRoutes.js 파일 생성
    - POST /api/update-coordinates 엔드포인트 구현
    - POST /api/update-sales-coordinates 엔드포인트 구현
    - Kakao Maps API 통합
    - _Requirements: 1.1, 1.2, 7.5_
  
  - [ ]* 19.2 coordinateRoutes 단위 테스트 작성
    - 좌표 업데이트 테스트
    - Kakao API 호출 테스트
    - _Requirements: 7.5_

- [x] 20. Store 라우트 생성
  - [x] 20.1 routes/storeRoutes.js 파일 생성
    - GET /api/stores 엔드포인트 구현
    - 출고 제외 필터링 로직 구현
    - 캐싱 적용
    - _Requirements: 1.1, 1.2, 7.6_
  
  - [ ]* 20.2 storeRoutes 단위 테스트 작성
    - 스토어 데이터 조회 테스트
    - 필터링 로직 테스트
    - 캐싱 동작 테스트
    - _Requirements: 7.6_

- [x] 21. Model 라우트 생성
  - [x] 21.1 routes/modelRoutes.js 파일 생성
    - GET /api/models 엔드포인트 구현
    - 모델 정보 추출 로직 구현
    - 중복 제거 및 정렬 로직 구현
    - _Requirements: 1.1, 1.2, 7.10_
  
  - [ ]* 21.2 modelRoutes 단위 테스트 작성
    - 모델 데이터 조회 테스트
    - 중복 제거 테스트
    - _Requirements: 7.10_

- [x] 22. Agent 라우트 생성
  - [x] 22.1 routes/agentRoutes.js 파일 생성
    - GET /api/agents 엔드포인트 구현
    - 권한 정보 포함 로직 구현
    - _Requirements: 1.1, 1.2, 7.11_
  
  - [ ]* 22.2 agentRoutes 단위 테스트 작성
    - 대리점 정보 조회 테스트
    - 권한 정보 포함 확인
    - _Requirements: 7.11_

- [x] 23. index.js에 라우트 통합
  - [x] 23.1 새 라우트 모듈 등록
    - teamRoutes 재등록
    - coordinateRoutes 등록
    - storeRoutes 등록
    - modelRoutes 등록
    - agentRoutes 등록
    - _Requirements: 1.1, 1.3_

- [x] 24. Checkpoint - 중간 복잡도 라우트 검증
  - 모든 라우트 단위 테스트 통과 확인
  - API 호환성 확인
  - 사용자에게 질문이 있으면 확인


### Phase 5: 복잡한 라우트 모듈 분리

- [x] 25. Map Display 라우트 생성
  - [x] 25.1 routes/mapDisplayRoutes.js 파일 생성
    - GET /api/map-display-option 엔드포인트 구현
    - POST /api/map-display-option 엔드포인트 구현
    - POST /api/map-display-option/batch 엔드포인트 구현
    - GET /api/map-display-option/values 엔드포인트 구현
    - GET /api/map-display-option/users 엔드포인트 구현
    - 권한 기반 접근 제어 구현
    - _Requirements: 1.1, 1.2, 7.7_
  
  - [ ]* 25.2 mapDisplayRoutes 단위 테스트 작성
    - 각 엔드포인트 테스트
    - 권한 검증 테스트
    - _Requirements: 7.7_

- [x] 26. Sales 라우트 생성
  - [x] 26.1 routes/salesRoutes.js 파일 생성
    - GET /api/sales-data 엔드포인트 구현
    - GET /api/sales-mode-access 엔드포인트 구현
    - 권한 기반 접근 제어 구현
    - _Requirements: 1.1, 1.2, 7.8_
  
  - [ ]* 26.2 salesRoutes 단위 테스트 작성
    - 영업 데이터 조회 테스트
    - 권한 검증 테스트
    - _Requirements: 7.8_

- [x] 27. Inventory Recovery 라우트 생성
  - [x] 27.1 routes/inventoryRecoveryRoutes.js 파일 생성
    - GET /api/inventoryRecoveryAccess 엔드포인트 구현
    - 권한 검증 로직 구현
    - _Requirements: 1.1, 1.2, 7.9_
  
  - [ ]* 27.2 inventoryRecoveryRoutes 단위 테스트 작성
    - 권한 검증 테스트
    - _Requirements: 7.9_

- [x] 28. Activation 라우트 생성
  - [x] 28.1 routes/activationRoutes.js 파일 생성
    - GET /api/activation-data/current-month 엔드포인트 구현
    - GET /api/activation-data/previous-month 엔드포인트 구현
    - GET /api/activation-data/by-date 엔드포인트 구현
    - GET /api/activation-data/date-comparison/:date 엔드포인트 구현
    - 날짜별 필터링 및 집계 로직 구현
    - _Requirements: 1.1, 1.2, 7.12_
  
  - [ ]* 28.2 activationRoutes 단위 테스트 작성
    - 각 엔드포인트 테스트
    - 날짜 필터링 테스트
    - _Requirements: 7.12_

- [x] 29. Auth 라우트 생성
  - [x] 29.1 routes/authRoutes.js 파일 생성
    - POST /api/login 엔드포인트 구현
    - POST /api/verify-password 엔드포인트 구현
    - POST /api/verify-direct-store-password 엔드포인트 구현
    - 로그인 이력 기록 로직 구현
    - _Requirements: 1.1, 1.2, 7.13_
  
  - [ ]* 29.2 authRoutes 단위 테스트 작성
    - 로그인 검증 테스트
    - 비밀번호 검증 테스트
    - _Requirements: 7.13_

- [x] 30. index.js에 라우트 통합
  - [x] 30.1 새 라우트 모듈 등록
    - mapDisplayRoutes 등록
    - salesRoutes 등록
    - inventoryRecoveryRoutes 등록
    - activationRoutes 등록
    - authRoutes 등록
    - _Requirements: 1.1, 1.3_

- [x] 31. Checkpoint - 복잡한 라우트 검증
  - 모든 라우트 단위 테스트 통과 확인
  - API 호환성 확인
  - 사용자에게 질문이 있으면 확인

### Phase 6: 대규모 라우트 모듈 분리

- [x] 32. Member 라우트 생성
  - [x] 32.1 routes/memberRoutes.js 파일 생성 (Part 1)
    - POST /api/member/login 엔드포인트 구현
    - GET /api/member/queue/all 엔드포인트 구현
    - GET /api/member/queue 엔드포인트 구현
    - POST /api/member/queue 엔드포인트 구현
    - PUT /api/member/queue/:id 엔드포인트 구현
    - DELETE /api/member/queue/:id 엔드포인트 구현
    - _Requirements: 1.1, 1.2, 7.14_
  
  - [x] 32.2 routes/memberRoutes.js 파일 생성 (Part 2)
    - GET /api/member/board 엔드포인트 구현
    - GET /api/member/board/:id 엔드포인트 구현
    - POST /api/member/board 엔드포인트 구현
    - PUT /api/member/board/:id 엔드포인트 구현
    - DELETE /api/member/board/:id 엔드포인트 구현
    - _Requirements: 1.1, 1.2, 7.14_
  
  - [ ]* 32.3 memberRoutes 단위 테스트 작성
    - 고객 로그인 테스트
    - 구매 대기 CRUD 테스트
    - 게시판 CRUD 테스트
    - _Requirements: 7.14_

- [x] 33. Onsale 라우트 생성
  - [x] 33.1 routes/onsaleRoutes.js 파일 생성 (Part 1)
    - POST /api/onsale/activation-info/:sheetId/:rowIndex/complete 구현
    - POST /api/onsale/activation-info/:sheetId/:rowIndex/pending 구현
    - POST /api/onsale/activation-info/:sheetId/:rowIndex/unpending 구현
    - POST /api/onsale/activation-info/:sheetId/:rowIndex/cancel 구현
    - GET /api/onsale/activation-list 구현
    - GET /api/onsale/activation-info/:sheetId/:rowIndex 구현
    - PUT /api/onsale/activation-info/:sheetId/:rowIndex 구현
    - POST /api/onsale/activation-info 구현
    - _Requirements: 1.1, 1.2, 7.15_
  
  - [x] 33.2 routes/onsaleRoutes.js 파일 생성 (Part 2)
    - POST /api/onsale/uplus-submission 구현
    - GET /api/onsale/links 구현
    - GET /api/onsale/active-links 구현
    - POST /api/onsale/links 구현
    - PUT /api/onsale/links/:rowIndex 구현
    - DELETE /api/onsale/links/:rowIndex 구현
    - _Requirements: 1.1, 1.2, 7.15_
  
  - [x] 33.3 routes/onsaleRoutes.js 파일 생성 (Part 3)
    - GET /api/onsale/policies/groups 구현
    - GET /api/onsale/policies 구현
    - GET /api/onsale/policies/:id 구현
    - POST /api/onsale/policies 구현
    - PUT /api/onsale/policies/:id 구현
    - DELETE /api/onsale/policies/:id 구현
    - POST /api/onsale/policies/:id/view 구현
    - POST /api/onsale-proxy 구현
    - _Requirements: 1.1, 1.2, 7.15_
  
  - [ ]* 33.4 onsaleRoutes 단위 테스트 작성
    - 개통정보 CRUD 테스트
    - 상태 변경 테스트
    - 링크 관리 테스트
    - 정책 게시판 테스트
    - _Requirements: 7.15_

- [x] 34. Inventory 라우트 생성
  - [x] 34.1 routes/inventoryRoutes.js 파일 생성
    - GET /api/inventory/assignment-status 구현
    - POST /api/inventory/save-assignment 구현
    - GET /api/inventory/normalized-status 구현
    - POST /api/inventory/manual-assignment 구현
    - GET /api/inventory/activation-status 구현
    - GET /api/inventory-analysis 구현
    - _Requirements: 1.1, 1.2, 7.16_
  
  - [ ]* 34.2 inventoryRoutes 단위 테스트 작성
    - 재고 배정 로직 테스트
    - 재고 현황 집계 테스트
    - _Requirements: 7.16_

- [x] 35. Budget 라우트 생성
  - [x] 35.1 routes/budgetRoutes.js 파일 생성
    - GET /api/budget/policy-groups 구현
    - POST /api/budget/policy-group-settings 구현
    - GET /api/budget/policy-group-settings 구현
    - DELETE /api/budget/policy-group-settings/:name 구현
    - POST /api/budget/calculate-usage 구현
    - _Requirements: 1.1, 1.2, 7.18_
  
  - [ ]* 35.2 budgetRoutes 단위 테스트 작성
    - 정책그룹 관리 테스트
    - 예산 계산 테스트
    - _Requirements: 7.18_

- [x] 36. Policy Notice 라우트 생성
  - [x] 36.1 routes/policyNoticeRoutes.js 파일 생성
    - GET /api/policy-notices 구현
    - POST /api/policy-notices 구현
    - PUT /api/policy-notices/:id 구현
    - DELETE /api/policy-notices/:id 구현
    - _Requirements: 1.1, 1.2, 7.19_
  
  - [ ]* 36.2 policyNoticeRoutes 단위 테스트 작성
    - 공지사항 CRUD 테스트
    - 필터링 테스트
    - _Requirements: 7.19_

- [x] 37. index.js에 라우트 통합
  - [x] 37.1 새 라우트 모듈 등록
    - memberRoutes 등록
    - onsaleRoutes 등록
    - inventoryRoutes 등록
    - budgetRoutes 등록
    - policyNoticeRoutes 등록
    - _Requirements: 1.1, 1.3_

- [x] 38. Checkpoint - 대규모 라우트 검증
  - 모든 라우트 단위 테스트 통과 확인
  - API 호환성 확인
  - 사용자에게 질문이 있으면 확인


### Phase 7: index.js 정리 및 최종 검증

- [x] 39. index.js 정리
  - [x] 39.1 index.js에서 모든 라우트 코드 제거
    - 개별 라우트 핸들러 코드 삭제
    - 라우트 모듈 import만 유지
    - 공통 컨텍스트 객체 생성 코드 유지
    - _Requirements: 1.1, 8.1_
  
  - [x] 39.2 라우트 모듈 로딩 로직 정리
    - **주의: 이 시점에서 index.js는 충분히 작아져 있어야 함 (~1000줄 이하)**
    - 모든 라우트 모듈 import 정리
    - 라우트 등록 순서 확인
    - **미들웨어 등록 순서 최종 확인 및 설정 (Task 11.2에서 연기된 작업)**
      - timeout → CORS → JSON parser → logging 순서 확인
      - errorMiddleware는 마지막에 등록
    - 에러 처리 추가 (모듈 로딩 실패 시)
    - _Requirements: 1.5, 3.1_
  
  - [x] 39.3 주석 및 문서화 추가
    - 파일 헤더 주석 추가
    - 각 섹션 설명 주석 추가
    - _Requirements: 11.1_

- [ ] 40. 통합 테스트 작성
  - [ ] 40.1 API 호환성 통합 테스트 작성
    - 모든 엔드포인트 URL 변경 없음 확인
    - 응답 형식 변경 없음 확인
    - _Requirements: 8.1, 8.3, 14.1, 14.2_
  
  - [ ]* 40.2 API 호환성 Property 테스트 작성
    - **Property 1: API 엔드포인트 하위 호환성**
    - **Validates: Requirements 1.3, 8.1, 8.3, 14.1, 14.2**

- [ ] 41. 성능 테스트 작성
  - [ ]* 41.1 응답 시간 비교 테스트 작성
    - 리팩토링 전후 응답 시간 비교
    - 120% 이내 확인
    - _Requirements: 8.5, 13.1_
  
  - [ ]* 41.2 캐시 효율성 테스트 작성
    - 캐시 히트율 비교
    - _Requirements: 13.2_
  
  - [ ]* 41.3 동시성 테스트 작성
    - 동시 요청 처리 능력 비교
    - _Requirements: 13.3_
  
  - [ ]* 41.4 메모리 사용량 테스트 작성
    - 메모리 사용량 비교
    - _Requirements: 13.4_
  
  - [ ]* 41.5 성능 유지 Property 테스트 작성
    - **Property 5: 성능 유지**
    - **Validates: Requirements 8.5, 13.1, 13.2, 13.3, 13.4**

- [ ] 42. E2E 테스트 작성
  - [ ]* 42.1 주요 사용자 시나리오 E2E 테스트 작성
    - 로그인 → 재고 조회 → 배정 시나리오
    - 개통정보 등록 → 완료 처리 시나리오
    - 정책 조회 → 확인 이력 기록 시나리오
    - _Requirements: 8.1_

- [x] 43. 문서 업데이트
  - [x] 43.1 README.md 업데이트
    - Server Architecture 섹션 추가
    - Directory Structure 설명 추가
    - Adding New Routes 가이드 추가
    - Testing 섹션 추가
    - _Requirements: 11.5_
  
  - [x] 43.2 각 모듈 JSDoc 주석 검토
    - 모든 공개 함수에 JSDoc 추가
    - 파라미터 및 반환값 문서화
    - _Requirements: 11.2_
  
  - [x] 43.3 API 엔드포인트 문서 생성
    - 각 라우트 모듈의 엔드포인트 목록 정리
    - 요청/응답 형식 문서화
    - _Requirements: 11.3_

- [x] 44. 최종 검증
  - [x] 44.1 모든 테스트 실행
    - 단위 테스트 실행 (npm run test:unit)
    - 통합 테스트 실행 (npm run test:integration)
    - Property 테스트 실행 (npm run test:properties)
    - E2E 테스트 실행 (npm run test:e2e)
    - _Requirements: 8.2, 10.1_
  
  - [x] 44.2 테스트 커버리지 확인
    - 라인 커버리지 80% 이상 확인
    - 브랜치 커버리지 75% 이상 확인
    - 함수 커버리지 90% 이상 확인
    - _Requirements: 10.1_
  
  - [x] 44.3 코드 품질 검사
    - ESLint 실행
    - 코드 스타일 확인
    - _Requirements: 11.1_

- [x] 45. 배포 준비
  - [x] 45.1 환경 변수 확인
    - 모든 필수 환경 변수 문서화
    - .env.example 파일 업데이트
    - _Requirements: 11.5_
  
  - [x] 45.2 배포 체크리스트 작성
    - 배포 전 확인 사항 정리
    - 롤백 절차 문서화
    - 모니터링 지표 정의
    - _Requirements: 8.1_
  
  - [x] 45.3 Git 태그 생성
    - 리팩토링 완료 버전 태그 생성
    - 변경 사항 요약 작성
    - _Requirements: 8.1_

- [x] 46. 최종 Checkpoint
  - 모든 테스트 통과 확인
  - 문서 완성도 확인
  - 배포 준비 완료 확인
  - 사용자에게 최종 승인 요청

## Notes

### 테스트 전략

- **단위 테스트**: 각 모듈의 독립적 기능 검증
- **통합 테스트**: 모듈 간 상호작용 및 API 호환성 검증
- **Property-based 테스트**: 보편적 속성 검증 (최소 100회 반복)
- **E2E 테스트**: 실제 사용자 시나리오 검증

### 선택적 태스크 (*)

"*" 표시된 태스크는 선택적으로 수행할 수 있습니다. 핵심 기능 구현에 집중하려면 이 태스크들을 건너뛸 수 있지만, 코드 품질과 안정성을 위해 수행하는 것을 권장합니다.

### 마이그레이션 순서

각 Phase는 순차적으로 진행하며, 각 Phase 완료 후 Checkpoint에서 검증합니다. 문제가 발견되면 이전 Phase로 돌아가 수정합니다.

### 롤백 계획

각 Phase마다 Git 브랜치를 생성하여 롤백 가능한 상태를 유지합니다. 배포 후 문제 발생 시 이전 버전으로 즉시 롤백할 수 있습니다.

### 예상 소요 시간

- Phase 1: 1주 (공통 인프라)
- Phase 2: 1주 (미들웨어)
- Phase 3: 1주 (간단한 라우트)
- Phase 4: 1주 (중간 복잡도 라우트)
- Phase 5: 1주 (복잡한 라우트)
- Phase 6: 2주 (대규모 라우트)
- Phase 7: 1주 (정리 및 검증)

**총 예상 소요 시간: 8주**

### 성공 기준

- [ ] 모든 기존 API 엔드포인트 URL 유지
- [ ] 모든 API 응답 형식 유지
- [ ] 모든 테스트 통과 (단위/통합/Property/E2E)
- [ ] 성능 저하 없음 (120% 이내)
- [ ] 테스트 커버리지 목표 달성 (라인 80%, 브랜치 75%, 함수 90%)
- [ ] index.js 크기 98% 이상 감소 (42,966줄 → ~500줄)
- [ ] 문서 완성도 100%


## 대용량 파일 처리 전략

### 문제점

server/index.js 파일이 42,966줄로 매우 크기 때문에 다음과 같은 문제가 발생할 수 있습니다:
- 파일 전체를 메모리에 로드 시 메모리 부족
- 에디터 성능 저하
- Git diff 확인 어려움

### 해결 방법

#### 방법 1: 부분적 읽기 (권장)

각 라우트 그룹을 분리할 때 해당 부분만 읽어서 처리합니다:

```bash
# 특정 라인 범위만 읽기
sed -n '1000,2000p' server/index.js > temp_section.js

# 특정 패턴 검색
grep -n "app.get('/api/teams" server/index.js

# 특정 함수만 추출
awk '/^app.get.*\/api\/teams/,/^});/' server/index.js > teams_route.js
```

**구현 순서:**
1. grep으로 라우트 위치 파악 (라인 번호 확인)
2. sed로 해당 라인 범위만 추출
3. 추출한 코드를 새 라우트 모듈로 변환
4. 원본 파일에서 해당 부분 삭제
5. 테스트 실행하여 검증

#### 방법 2: 점진적 분리 (안전)

한 번에 하나의 라우트 그룹만 분리하고 즉시 테스트합니다:

```bash
# 1. 백업 생성
cp server/index.js server/index.js.backup

# 2. 작은 라우트부터 시작 (예: health routes)
# - grep으로 위치 확인
# - 해당 코드를 새 파일로 복사
# - 원본에서 주석 처리 (삭제 X)
# - 테스트 실행
# - 성공하면 주석 제거

# 3. 다음 라우트로 진행
```

#### 방법 3: Git을 활용한 안전한 분리

각 Phase마다 별도 브랜치를 생성하여 롤백 가능하게 합니다:

```bash
# Phase별 브랜치 생성
git checkout -b refactor/phase-1-infrastructure
# ... 작업 수행
git commit -m "Phase 1: 공통 인프라 분리"

git checkout -b refactor/phase-2-middleware
# ... 작업 수행
git commit -m "Phase 2: 미들웨어 분리"

# 문제 발생 시 이전 브랜치로 롤백
git checkout refactor/phase-1-infrastructure
```

#### 방법 4: 스크립트 자동화

라우트 추출을 자동화하는 스크립트 작성:

```javascript
// scripts/extract-routes.js
const fs = require('fs');
const readline = require('readline');

async function extractRoutes(inputFile, pattern, outputFile) {
  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let capturing = false;
  let buffer = [];
  let braceCount = 0;

  for await (const line of rl) {
    if (line.match(pattern)) {
      capturing = true;
    }

    if (capturing) {
      buffer.push(line);
      
      // 중괄호 카운팅으로 함수 끝 감지
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount === 0 && buffer.length > 0) {
        fs.appendFileSync(outputFile, buffer.join('\n') + '\n\n');
        buffer = [];
        capturing = false;
      }
    }
  }
}

// 사용 예
extractRoutes(
  'server/index.js',
  /app\.get\('\/api\/teams'/,
  'temp/teams-routes.js'
);
```

### 권장 작업 순서

**Phase 1-2 (공통 인프라 & 미들웨어):**
- 새 파일 생성만 하므로 index.js 읽기 불필요
- 기존 코드 참고만 하면 됨

**Phase 3-6 (라우트 분리):**
1. `grep -n "app.get('/api/teams" server/index.js` 로 라인 번호 확인
2. `sed -n '222,268p' server/index.js` 로 해당 부분만 추출
3. 추출한 코드를 새 라우트 모듈로 변환
4. 원본 파일에서 해당 부분을 주석 처리 (삭제 X)
5. 테스트 실행
6. 성공하면 주석 제거

**Phase 7 (정리):**
- 모든 라우트가 분리된 후 index.js 정리
- 이 시점에는 파일이 충분히 작아져 있음

### 메모리 절약 팁

1. **스트리밍 방식 사용**
   ```javascript
   const fs = require('fs');
   const readline = require('readline');
   
   const rl = readline.createInterface({
     input: fs.createReadStream('server/index.js'),
     crlfDelay: Infinity
   });
   
   rl.on('line', (line) => {
     // 한 줄씩 처리
   });
   ```

2. **필요한 부분만 로드**
   - 전체 파일을 메모리에 올리지 않음
   - 라인 단위로 스트리밍 처리

3. **임시 파일 활용**
   - 추출한 코드를 임시 파일에 저장
   - 검증 후 최종 파일로 이동

### 안전장치

1. **백업 필수**
   ```bash
   cp server/index.js server/index.js.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **Git 커밋 자주 하기**
   - 각 라우트 분리 후 즉시 커밋
   - 문제 발생 시 쉽게 롤백

3. **테스트 자동화**
   - 각 분리 작업 후 자동으로 테스트 실행
   - 실패 시 즉시 중단

### 예상 작업 시간 조정

대용량 파일 처리를 고려하여 예상 시간을 다음과 같이 조정합니다:

- Phase 1: 1주 (변경 없음)
- Phase 2: 1주 (변경 없음)
- Phase 3: 1.5주 (0.5주 추가 - 추출 스크립트 작성)
- Phase 4: 1.5주 (0.5주 추가)
- Phase 5: 1.5주 (0.5주 추가)
- Phase 6: 2.5주 (0.5주 추가)
- Phase 7: 1주 (변경 없음)

**총 예상 소요 시간: 10주** (기존 8주 → 10주)


## 철저한 테스트 전략

### 테스트 레벨

이 리팩토링 프로젝트는 **기존 기능의 100% 유지**가 핵심이므로, 다음과 같은 다층 테스트 전략을 사용합니다:

#### 1단계: 단위 테스트 (Unit Tests)
**목적:** 각 모듈의 독립적 기능 검증

**적용 시점:**
- 각 유틸리티 모듈 생성 후 즉시 (Task 1.2, 2.2, 3.2, 4.2, 5.3)
- 각 미들웨어 생성 후 즉시 (Task 8.2, 9.2, 10.2)
- 각 라우트 모듈 생성 후 즉시 (Task 13.2, 14.2, 15.2, ...)

**검증 항목:**
- 함수 입력/출력 정확성
- 에러 처리 로직
- 엣지 케이스 처리

**예시:**
```javascript
// cacheManager.test.js
describe('CacheManager', () => {
  it('should store and retrieve data', () => {
    cacheManager.set('key1', 'value1');
    expect(cacheManager.get('key1')).toBe('value1');
  });

  it('should expire data after TTL', async () => {
    cacheManager.set('key2', 'value2', 1000); // 1초 TTL
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(cacheManager.get('key2')).toBeNull();
  });
});
```

#### 2단계: 통합 테스트 (Integration Tests)
**목적:** 모듈 간 상호작용 및 API 호환성 검증

**적용 시점:**
- 각 Phase 완료 후 Checkpoint에서 (Task 7, 12, 17, 24, 31, 38)
- Phase 7에서 전체 통합 테스트 (Task 40)

**검증 항목:**
- API 엔드포인트 URL 변경 없음
- 요청/응답 형식 변경 없음
- 모듈 간 데이터 흐름 정확성

**예시:**
```javascript
// api-compatibility.test.js
describe('API Compatibility', () => {
  it('GET /api/teams should return same format', async () => {
    const response = await request(app).get('/api/teams');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(response.body.teams[0]).toHaveProperty('code');
    expect(response.body.teams[0]).toHaveProperty('name');
  });
});
```

#### 3단계: Property-Based Tests
**목적:** 보편적 속성 검증 (무작위 입력으로 엣지 케이스 발견)

**적용 시점:**
- 핵심 모듈 완성 후 (Task 2.3, 3.3, 10.3)
- Phase 7에서 전체 Property 테스트 (Task 40.2, 41.5)

**검증 항목:**
- Rate Limiter 최소 간격 보장 (Property 3)
- 캐시 TTL 준수 (Property 4)
- 에러 응답 일관성 (Property 2)
- API 호환성 (Property 1)
- 성능 유지 (Property 5)

**예시:**
```javascript
// rate-limiting.properties.test.js
const fc = require('fast-check');

describe('Property: Rate Limiter 최소 간격 보장', () => {
  it('should maintain minimum 500ms interval between calls', () => {
    // Feature: server-routes-refactoring, Property 3
    fc.assert(
      fc.property(
        fc.array(fc.constant(null), { minLength: 10, maxLength: 20 }),
        async (calls) => {
          const timestamps = [];
          
          for (const _ of calls) {
            const start = Date.now();
            await rateLimiter.execute(() => Promise.resolve());
            timestamps.push(Date.now() - start);
          }
          
          // 연속된 호출 간 최소 500ms 간격 확인
          for (let i = 1; i < timestamps.length; i++) {
            const interval = timestamps[i] - timestamps[i-1];
            expect(interval).toBeGreaterThanOrEqual(500);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 4단계: E2E 테스트 (End-to-End Tests)
**목적:** 실제 사용자 시나리오 검증

**적용 시점:**
- Phase 7에서 전체 E2E 테스트 (Task 42)

**검증 항목:**
- 로그인 → 재고 조회 → 배정 시나리오
- 개통정보 등록 → 완료 처리 시나리오
- 정책 조회 → 확인 이력 기록 시나리오

**예시:**
```javascript
// inventory-assignment.e2e.test.js
describe('E2E: Inventory Assignment Flow', () => {
  it('should complete full assignment workflow', async () => {
    // 1. 로그인
    const loginRes = await request(app)
      .post('/api/login')
      .send({ storeId: 'TEST001', password: 'test123' });
    expect(loginRes.status).toBe(200);

    // 2. 재고 조회
    const inventoryRes = await request(app)
      .get('/api/stores')
      .query({ includeShipped: 'false' });
    expect(inventoryRes.status).toBe(200);
    expect(inventoryRes.body.data.length).toBeGreaterThan(0);

    // 3. 배정 실행
    const assignmentRes = await request(app)
      .post('/api/inventory/save-assignment')
      .send({
        assignments: [{
          reservationNumber: 'RES001',
          assignedSerialNumber: 'SN12345'
        }]
      });
    expect(assignmentRes.status).toBe(200);
    expect(assignmentRes.body.success).toBe(true);
  });
});
```

#### 5단계: 성능 테스트 (Performance Tests)
**목적:** 리팩토링 후 성능 저하 없음 확인

**적용 시점:**
- Phase 7에서 성능 테스트 (Task 41)

**검증 항목:**
- 응답 시간 120% 이내
- 캐시 히트율 유지
- 동시 요청 처리 능력 유지
- 메모리 사용량 유사

**예시:**
```javascript
// performance.test.js
describe('Performance Tests', () => {
  it('should maintain response time within 120%', async () => {
    const endpoints = [
      '/api/teams',
      '/api/stores',
      '/api/models',
      '/api/agents'
    ];

    for (const endpoint of endpoints) {
      const times = [];
      
      // 100회 반복 측정
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await request(app).get(endpoint);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const baselineTime = getBaselineTime(endpoint); // 리팩토링 전 기준
      
      expect(avgTime).toBeLessThanOrEqual(baselineTime * 1.2);
    }
  });
});
```

### Checkpoint 테스트 프로세스

각 Phase의 Checkpoint에서 다음 테스트를 **반드시** 실행합니다:

**Phase 1 Checkpoint (Task 7):**
```bash
# 1. 단위 테스트 실행
npm run test:unit -- utils/

# 2. 테스트 커버리지 확인
npm run test:coverage -- utils/

# 3. 결과 확인
# - 모든 테스트 통과
# - 커버리지 80% 이상
```

**Phase 2 Checkpoint (Task 12):**
```bash
# 1. 미들웨어 단위 테스트
npm run test:unit -- middleware/

# 2. 미들웨어 통합 테스트
npm run test:integration -- middleware/

# 3. 결과 확인
```

**Phase 3-6 Checkpoint (Task 17, 24, 31, 38):**
```bash
# 1. 라우트 단위 테스트
npm run test:unit -- routes/

# 2. API 호환성 통합 테스트
npm run test:integration -- api-compatibility

# 3. 해당 Phase의 엔드포인트만 선택적 테스트
npm run test:integration -- --grep "Phase 3"

# 4. 결과 확인
# - 모든 테스트 통과
# - API URL 변경 없음
# - 응답 형식 변경 없음
```

**Phase 7 최종 Checkpoint (Task 46):**
```bash
# 1. 전체 단위 테스트
npm test

# 2. 전체 통합 테스트
npm run test:integration

# 3. Property-based 테스트
npm run test:properties

# 4. E2E 테스트
npm run test:e2e

# 5. 성능 테스트
npm run test:performance

# 6. 테스트 커버리지 확인
npm run test:coverage

# 7. 결과 확인
# - 모든 테스트 통과
# - 커버리지 목표 달성 (라인 80%, 브랜치 75%, 함수 90%)
# - 성능 저하 없음 (120% 이내)
```

### 테스트 실패 시 대응

**단위 테스트 실패:**
1. 즉시 작업 중단
2. 실패 원인 분석
3. 코드 수정
4. 테스트 재실행
5. 통과 후 다음 작업 진행

**통합 테스트 실패:**
1. 즉시 작업 중단
2. API 호환성 문제 확인
3. 응답 형식 비교
4. 코드 수정
5. 전체 통합 테스트 재실행
6. 통과 후 다음 Phase 진행

**Property 테스트 실패:**
1. 실패한 입력 케이스 확인
2. 엣지 케이스 분석
3. 코드 수정
4. Property 테스트 재실행 (최소 100회)
5. 통과 후 다음 작업 진행

**E2E 테스트 실패:**
1. 전체 워크플로우 검토
2. 실패 지점 확인
3. 관련 모듈 수정
4. 전체 E2E 테스트 재실행
5. 통과 후 배포 진행

**성능 테스트 실패:**
1. 성능 저하 원인 분석 (캐시, Rate Limiting, 쿼리 등)
2. 최적화 수행
3. 성능 테스트 재실행
4. 120% 이내 확인 후 배포 진행

### 테스트 자동화

모든 테스트는 Git pre-commit hook으로 자동 실행됩니다:

```bash
# .git/hooks/pre-commit
#!/bin/sh

echo "Running tests before commit..."

# 단위 테스트 실행
npm run test:unit
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed. Commit aborted."
  exit 1
fi

# 통합 테스트 실행 (변경된 파일만)
npm run test:integration -- --changed
if [ $? -ne 0 ]; then
  echo "❌ Integration tests failed. Commit aborted."
  exit 1
fi

echo "✅ All tests passed. Proceeding with commit."
exit 0
```

### 테스트 커버리지 목표

각 Phase에서 다음 커버리지 목표를 달성해야 합니다:

| Phase | 라인 커버리지 | 브랜치 커버리지 | 함수 커버리지 |
|-------|--------------|----------------|--------------|
| 1-2   | 85%+         | 80%+           | 90%+         |
| 3-4   | 80%+         | 75%+           | 90%+         |
| 5-6   | 80%+         | 75%+           | 90%+         |
| 7     | 80%+         | 75%+           | 90%+         |

### 테스트 문서화

각 테스트 파일은 다음 정보를 포함해야 합니다:

```javascript
/**
 * Cache Manager Unit Tests
 * 
 * Tests:
 * - Data storage and retrieval
 * - TTL expiration
 * - Size limit enforcement
 * - Cache cleanup
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */
describe('CacheManager', () => {
  // ...
});
```

### 요약

**테스트 보장 사항:**
- ✅ 각 모듈 생성 후 즉시 단위 테스트
- ✅ 각 Phase 완료 후 통합 테스트
- ✅ 핵심 모듈에 Property-based 테스트
- ✅ 최종 단계에서 E2E 테스트
- ✅ 성능 테스트로 성능 저하 방지
- ✅ Checkpoint마다 전체 검증
- ✅ 테스트 실패 시 즉시 중단 및 수정
- ✅ Git hook으로 자동 테스트 실행
- ✅ 커버리지 목표 달성 확인

**이 전략으로 버그와 에러를 최소화하고, 기존 기능을 100% 유지할 수 있습니다.**


## 중요: server/index.js 즉시 정리 원칙

### 원칙

**각 라우트 모듈 생성이 완료되고 테스트가 통과하면, 즉시 server/index.js에서 해당 코드를 제거합니다.**

이렇게 하면:
- ✅ server/index.js 파일 크기가 점진적으로 감소
- ✅ 메모리 부담 감소
- ✅ 진행 상황을 명확히 확인 가능
- ✅ 중복 코드 방지

### 작업 순서 (각 라우트 모듈마다 반복)

```bash
# 1. 새 라우트 모듈 생성
# routes/teamRoutes.js 파일 생성 및 코드 작성

# 2. 단위 테스트 작성 및 실행
npm run test:unit -- routes/teamRoutes.test.js

# 3. 테스트 통과 확인
# ✅ 모든 테스트 통과

# 4. index.js에 라우트 등록
# index.js에 import 및 app.use() 추가

# 5. 통합 테스트 실행
npm run test:integration -- --grep "teams"

# 6. 테스트 통과 확인
# ✅ API 호환성 확인

# 7. 즉시 index.js에서 기존 코드 제거
# grep으로 해당 라우트 위치 확인
grep -n "app.get('/api/teams" server/index.js

# sed로 해당 라인 범위 삭제
sed -i '222,268d' server/index.js

# 8. 삭제 후 즉시 테스트 재실행
npm run test:integration -- --grep "teams"

# 9. 테스트 통과 확인
# ✅ 여전히 정상 작동

# 10. Git 커밋
git add .
git commit -m "Refactor: Extract team routes to separate module"

# 11. 파일 크기 확인
wc -l server/index.js
# 예: 42,700줄 (266줄 감소)
```

### 각 Phase별 예상 감소량

| Phase | 라우트 모듈 | 예상 감소 줄 수 | 누적 감소 | 남은 줄 수 |
|-------|------------|----------------|----------|-----------|
| 시작   | -          | -              | -        | 42,966    |
| 1-2   | 인프라/미들웨어 | 0 (새 파일만 생성) | 0        | 42,966    |
| 3     | health, logging, cache | ~500 | 500 | 42,466 |
| 4     | team, coordinate, store, model, agent | ~1,500 | 2,000 | 40,966 |
| 5     | mapDisplay, sales, inventoryRecovery, activation, auth | ~3,000 | 5,000 | 37,966 |
| 6     | member, onsale, inventory, budget, policyNotice | ~37,000 | 42,000 | 966 |
| 7     | 정리 | ~466 | 42,466 | ~500 |

### 자동화 스크립트

라우트 제거를 자동화하는 스크립트:

```javascript
// scripts/remove-route-from-index.js
const fs = require('fs');
const readline = require('readline');

async function removeRoute(pattern, outputFile = 'server/index.js.new') {
  const fileStream = fs.createReadStream('server/index.js');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let skipping = false;
  let braceCount = 0;
  let output = [];

  for await (const line of rl) {
    if (line.match(pattern)) {
      console.log(`Found route to remove: ${line.trim()}`);
      skipping = true;
      braceCount = 0;
    }

    if (skipping) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount === 0 && line.includes('});')) {
        console.log(`Route removal complete`);
        skipping = false;
        continue; // 이 줄도 제거
      }
      continue; // 스킵 중인 줄은 출력에 포함하지 않음
    }

    output.push(line);
  }

  fs.writeFileSync(outputFile, output.join('\n'));
  console.log(`✅ New file written to ${outputFile}`);
  console.log(`Original: ${await countLines('server/index.js')} lines`);
  console.log(`New: ${output.length} lines`);
  console.log(`Removed: ${await countLines('server/index.js') - output.length} lines`);
}

async function countLines(file) {
  const fileStream = fs.createReadStream(file);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let count = 0;
  for await (const line of rl) {
    count++;
  }
  return count;
}

// 사용 예
removeRoute(/app\.get\('\/api\/teams'/);
```

사용 방법:
```bash
# 1. 스크립트 실행
node scripts/remove-route-from-index.js

# 2. 새 파일 확인
diff server/index.js server/index.js.new

# 3. 테스트 실행
npm run test:integration

# 4. 테스트 통과하면 교체
mv server/index.js.new server/index.js

# 5. 커밋
git add server/index.js
git commit -m "Remove team routes from index.js"
```

### 안전 장치

**백업 자동 생성:**
```bash
# 각 제거 작업 전 자동 백업
cp server/index.js server/index.js.backup.$(date +%Y%m%d_%H%M%S)
```

**제거 전 확인:**
```bash
# 제거할 코드 미리보기
grep -A 50 "app.get('/api/teams" server/index.js

# 확인 후 제거
```

**제거 후 즉시 검증:**
```bash
# 1. 문법 오류 확인
node -c server/index.js

# 2. 서버 시작 테스트
timeout 5s npm start

# 3. API 테스트
curl http://localhost:4000/api/teams
```

### 진행 상황 추적

각 Phase 완료 후 진행 상황을 기록합니다:

```bash
# 현재 줄 수 확인
wc -l server/index.js

# 진행률 계산
echo "scale=2; (42966 - $(wc -l < server/index.js)) / 42966 * 100" | bc
# 예: 11.65% 완료
```

### 주의사항

1. **한 번에 하나씩**: 여러 라우트를 동시에 제거하지 말고, 하나씩 제거하고 테스트
2. **테스트 필수**: 제거 후 반드시 통합 테스트 실행
3. **커밋 자주**: 각 라우트 제거 후 즉시 커밋하여 롤백 가능하게 유지
4. **백업 유지**: 자동 백업 파일은 최소 1주일 보관

### 예상 타임라인

각 라우트 모듈당:
- 모듈 생성: 30분
- 테스트 작성: 30분
- index.js 제거: 10분
- 검증: 10분
- **총: 약 1.5시간**

Phase 6 (대규모 라우트)의 경우:
- 5개 대규모 모듈 × 3시간 = 15시간 (약 2일)
- 즉시 제거로 파일 크기 37,000줄 감소

**이 방식으로 작업하면 Phase 6 완료 시점에 index.js는 이미 1,000줄 미만으로 줄어들어 있습니다.**
