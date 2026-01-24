# Implementation Plan: API Performance Optimization

## Overview

이 구현 계획은 VIP Map Application의 API 성능 최적화 및 에러 해결을 위한 작업 목록입니다. **기능에는 영향을 주지 않으면서** 백엔드와 프론트엔드 간의 오류와 경고 메시지 발생 지점을 집중 개선합니다.

## Tasks

- [x] 1. CORS 미들웨어 전역 적용 및 개선
  - CORS 미들웨어를 모든 라우트 등록 전에 배치
  - 에러 응답에 CORS 헤더 포함
  - 타임아웃 응답에 CORS 헤더 포함
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.1 server/index.js에서 CORS 미들웨어 위치 조정
    - `app.use(corsMiddleware)`를 모든 라우트 등록 전으로 이동
    - 헬스체크 엔드포인트 제외
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 전역 에러 핸들러에 CORS 헤더 추가
    - 모든 에러 응답에 `setBasicCORSHeaders` 호출
    - 에러 타입, 메시지, 스택 트레이스 로깅
    - _Requirements: 1.5, 3.7, 7.1_

  - [x] 1.3 타임아웃 미들웨어에 CORS 헤더 추가
    - 타임아웃 발생 시 CORS 헤더 설정
    - 타임아웃 에러 로깅 (URL, 경과 시간, 타임아웃 설정값)
    - _Requirements: 2.1, 2.5, 7.4_

  - [ ]* 1.4 CORS 헤더 일관성 속성 테스트 작성
    - **Property 1: CORS Headers Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - 모든 API 엔드포인트에 대해 CORS 헤더가 일관되게 설정되는지 검증
    - fast-check를 사용하여 랜덤 엔드포인트와 오리진 생성

  - [ ]* 1.5 OPTIONS 프리플라이트 성공 속성 테스트 작성
    - **Property 2: OPTIONS Preflight Success**
    - **Validates: Requirements 1.4**
    - 모든 엔드포인트에 대해 OPTIONS 요청이 200 OK를 반환하는지 검증

- [x] 2. 개별 라우트에서 CORS 처리 제거
  - directRoutes.js, policyTableRoutes.js 등에서 OPTIONS 처리 코드 제거
  - CORS 미들웨어에 위임
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.1 server/directRoutes.js에서 OPTIONS 처리 제거
    - 모든 OPTIONS 요청 처리 코드 제거
    - CORS 미들웨어에 위임
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 server/policyTableRoutes.js에서 OPTIONS 처리 제거
    - 모든 OPTIONS 요청 처리 코드 제거
    - CORS 미들웨어에 위임
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.3 기타 라우트 파일에서 OPTIONS 처리 제거
    - meetingRoutes.js, obRoutes.js, teamRoutes.js 등 확인
    - OPTIONS 처리 코드가 있다면 제거
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. CORS 에러 로깅 강화
  - 요청 오리진, 허용된 오리진 목록, 실패 이유 로깅
  - 어떤 엔드포인트에서 CORS 에러가 발생하는지 추적
  - _Requirements: 1.5, 7.2_

  - [x] 3.1 server/corsMiddleware.js에서 CORS 에러 로깅 개선
    - 요청 오리진, 허용된 오리진 목록, 실패 이유 포함
    - 요청 경로, 메서드, 헤더 포함
    - _Requirements: 1.5, 7.2_

  - [ ]* 3.2 CORS 에러 로깅 완전성 속성 테스트 작성
    - **Property 3: CORS Error Logging Completeness**
    - **Validates: Requirements 1.5, 7.2**
    - CORS 에러 발생 시 필요한 정보가 모두 로깅되는지 검증

- [x] 4. Checkpoint - CORS 에러 해결 확인
  - 모든 API 엔드포인트에 대해 CORS 헤더가 설정되는지 확인
  - 에러 응답에도 CORS 헤더가 포함되는지 확인
  - OPTIONS 프리플라이트 요청이 200 OK를 반환하는지 확인
  - 사용자에게 질문이 있으면 물어보기


- [x] 5. 예산모드 API 500 에러 수정
  - `/api/budget/policy-group-settings`, `/api/budget/month-sheets` 등의 500 에러 수정
  - Google Sheets API 호출 실패 시 명확한 에러 메시지 반환
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.1 server/index.js에서 예산 API 에러 처리 개선
    - try-catch 블록 확인 및 보완
    - Google Sheets API 호출 실패 시 명확한 에러 메시지 반환
    - 시트가 존재하지 않는 경우 빈 배열 반환
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 예산 API 에러 로깅 강화
    - 에러 타입, 메시지, 스택 트레이스 로깅
    - 요청 정보 (경로, 메서드, 헤더) 로깅
    - _Requirements: 3.7, 7.1_

  - [ ]* 5.3 API 응답 유효성 속성 테스트 작성
    - **Property 8: API Response Validity**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - 모든 예산 API 엔드포인트가 유효한 데이터 또는 명확한 에러 메시지를 반환하는지 검증

- [x] 6. 정책모드 API 404 에러 수정
  - `/api/team-leaders` 엔드포인트 404 에러 수정
  - `/api/policy-table/user-groups/{id}/change-history` 엔드포인트 500 에러 수정
  - _Requirements: 3.5, 3.6_

  - [x] 6.1 /api/team-leaders 엔드포인트 수정
    - 팀장 목록을 올바르게 반환하도록 수정
    - 시트가 존재하지 않는 경우 빈 배열 반환
    - _Requirements: 3.5_

  - [x] 6.2 /api/policy-table/user-groups/{id}/change-history 엔드포인트 수정
    - 변경 이력을 올바르게 반환하도록 수정
    - 에러 처리 강화
    - _Requirements: 3.6_

  - [ ]* 6.3 팀장 목록 API 단위 테스트 작성
    - `/api/team-leaders` 엔드포인트가 200 OK를 반환하는지 확인
    - 팀장 목록이 올바른 형식인지 확인
    - _Requirements: 3.5_

  - [ ]* 6.4 변경 이력 API 단위 테스트 작성
    - `/api/policy-table/user-groups/{id}/change-history` 엔드포인트가 200 OK를 반환하는지 확인
    - 변경 이력이 올바른 형식인지 확인
    - _Requirements: 3.6_

- [x] 7. Rate Limiter 개선
  - 최소 호출 간격: 2초 → 500ms
  - 최대 동시 요청: 2개 → 5개
  - Exponential Backoff + Jitter 적용
  - _Requirements: 2.2, 2.3, 5.4_

  - [x] 7.1 server/index.js에서 Rate Limiter 설정 변경
    - `SHEETS_API_COOLDOWN`: 2000ms → 500ms
    - 성능 개선을 위한 조정
    - _Requirements: 2.2_

  - [x] 7.2 server/directRoutes.js에서 Rate Limiter 설정 변경
    - `MIN_API_INTERVAL_MS`: 2000ms → 500ms
    - `MAX_CONCURRENT_SHEETS_REQUESTS`: 2 → 5
    - _Requirements: 2.2, 2.4_

  - [x] 7.3 Exponential Backoff + Jitter 재시도 로직 확인
    - `rateLimitedSheetsCall` 함수에서 Jitter 적용 확인
    - 최대 재시도 횟수: 5회
    - 최대 대기 시간: 60초
    - _Requirements: 2.3, 5.4_

  - [ ]* 7.4 Rate Limiting 간격 속성 테스트 작성
    - **Property 5: Rate Limiting Interval**
    - **Validates: Requirements 2.2**
    - 연속적인 Google Sheets API 호출 간격이 최소 500ms인지 검증

  - [ ]* 7.5 Exponential Backoff 재시도 속성 테스트 작성
    - **Property 6: Exponential Backoff Retry**
    - **Validates: Requirements 2.3, 5.4, 8.3**
    - Rate Limit 에러 발생 시 최대 5회 재시도하는지 검증
    - Exponential Backoff와 Jitter가 적용되는지 검증

- [x] 8. Cache Manager 개선
  - Fresh TTL: 5분
  - Stale TTL: 30분
  - 최대 캐시 크기: 200개
  - LRU Eviction 전략
  - _Requirements: 5.1, 5.2, 5.5_

  - [x] 8.1 server/directRoutes.js에서 캐시 설정 확인
    - `CACHE_FRESH_TTL`: 5분
    - `CACHE_STALE_TTL`: 30분
    - 설정이 올바른지 확인
    - _Requirements: 5.1_

  - [x] 8.2 server/index.js에서 캐시 크기 제한 확인
    - `MAX_CACHE_SIZE`: 200개
    - LRU Eviction 로직 확인
    - _Requirements: 5.5_

  - [ ]* 8.3 캐시 히트 최적화 속성 테스트 작성
    - **Property 14: Cache Hit Optimization**
    - **Validates: Requirements 5.1, 5.2**
    - 캐시된 데이터가 있을 때 Google Sheets API를 호출하지 않는지 검증

  - [ ]* 8.4 LRU 캐시 Eviction 속성 테스트 작성
    - **Property 16: LRU Cache Eviction**
    - **Validates: Requirements 5.5**
    - 캐시 크기가 200개를 초과할 때 가장 오래된 항목이 삭제되는지 검증

- [x] 9. Checkpoint - 백엔드 성능 개선 확인
  - Rate Limiter가 올바르게 동작하는지 확인
  - Cache Manager가 올바르게 동작하는지 확인
  - API 응답 시간이 개선되었는지 확인
  - 사용자에게 질문이 있으면 물어보기

- [x] 10. SmartFetch 캐싱 로직 개선
  - ReferenceError 수정
  - 백그라운드 캐시 갱신 에러 처리 강화
  - 캐시 갱신 실패 시 다음 요청에서 캐시 무효화
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 10.1 src/api/directStoreApiClient.js에서 ReferenceError 수정
    - 변수 'd' 초기화 문제 확인 및 수정
    - 코드 리뷰를 통해 초기화되지 않은 변수 찾기
    - _Requirements: 4.3_

  - [x] 10.2 백그라운드 캐시 갱신 에러 처리 강화
    - try-catch 블록 확인
    - 에러 로깅 강화
    - 기존 캐시 유지
    - _Requirements: 4.2_

  - [x] 10.3 캐시 갱신 실패 시 캐시 무효화 로직 추가
    - 캐시 갱신 실패 시 `isRefreshing` 플래그 해제
    - 다음 요청 시 캐시 무효화
    - _Requirements: 4.4_

  - [ ]* 10.4 SmartFetch 백그라운드 갱신 속성 테스트 작성
    - **Property 10: SmartFetch Background Refresh**
    - **Validates: Requirements 4.1**
    - 캐시된 데이터 반환 시 백그라운드 갱신이 발생하는지 검증

  - [ ]* 10.5 SmartFetch 에러 복원력 속성 테스트 작성
    - **Property 11: SmartFetch Error Resilience**
    - **Validates: Requirements 4.2**
    - 백그라운드 갱신 에러 발생 시 기존 캐시가 유지되는지 검증

- [x] 11. 에러 로깅 강화
  - API 에러 로깅 (타입, 메시지, 스택 트레이스, 요청 정보)
  - Google Sheets API 에러 로깅 (에러 코드, 메시지, 재시도 횟수)
  - 타임아웃 에러 로깅 (요청 URL, 경과 시간, 타임아웃 설정값)
  - _Requirements: 7.1, 7.3, 7.4_

  - [x] 11.1 server/index.js에서 API 에러 로깅 강화
    - 에러 타입, 메시지, 스택 트레이스 로깅
    - 요청 정보 (경로, 메서드, 헤더) 로깅
    - _Requirements: 7.1_

  - [x] 11.2 Google Sheets API 에러 로깅 강화
    - 에러 코드, 메시지, 재시도 횟수 로깅
    - `rateLimitedSheetsCall` 함수에서 로깅 추가
    - _Requirements: 7.3_

  - [x] 11.3 타임아웃 에러 로깅 강화
    - 요청 URL, 경과 시간, 타임아웃 설정값 로깅
    - 타임아웃 미들웨어에서 로깅 추가
    - _Requirements: 7.4_

  - [ ]* 11.4 API 에러 로깅 완전성 속성 테스트 작성
    - **Property 9: API Error Logging Completeness**
    - **Validates: Requirements 3.7, 7.1**
    - API 에러 발생 시 필요한 정보가 모두 로깅되는지 검증

  - [ ]* 11.5 Google Sheets API 에러 로깅 속성 테스트 작성
    - **Property 19: Google Sheets API Error Logging**
    - **Validates: Requirements 7.3**
    - Google Sheets API 에러 발생 시 필요한 정보가 모두 로깅되는지 검증

  - [ ]* 11.6 타임아웃 에러 로깅 속성 테스트 작성
    - **Property 20: Timeout Error Logging**
    - **Validates: Requirements 7.4**
    - 타임아웃 에러 발생 시 필요한 정보가 모두 로깅되는지 검증

- [x] 12. 클라이언트 에러 중앙 집중식 로깅
  - 클라이언트 에러를 백엔드로 전송
  - `/api/client-logs` 엔드포인트 활용
  - _Requirements: 7.5_

  - [x] 12.1 src/utils/logger.js에서 에러 전송 로직 확인
    - 클라이언트 에러 발생 시 백엔드로 전송하는지 확인
    - `/api/client-logs` 엔드포인트 활용
    - _Requirements: 7.5_

  - [ ]* 12.2 클라이언트 에러 전송 속성 테스트 작성
    - **Property 21: Client Error Transmission**
    - **Validates: Requirements 7.5**
    - 클라이언트 에러 발생 시 백엔드로 전송되는지 검증

- [x] 13. 헬스체크 엔드포인트 개선
  - 서버 상태, 타임스탬프, 메모리 사용량, CPU 사용량 반환
  - Google Sheets API 연결 실패 시 'unhealthy' 상태 반환
  - _Requirements: 10.1, 10.2_

  - [x] 13.1 server/index.js에서 /health 엔드포인트 개선
    - 메모리 사용량, CPU 사용량 추가
    - Google Sheets API 연결 상태 확인
    - _Requirements: 10.1, 10.2_

  - [ ]* 13.2 헬스체크 엔드포인트 단위 테스트 작성
    - `/health` 엔드포인트가 올바른 형식을 반환하는지 확인
    - 서버 상태, 타임스탬프, 메모리 사용량, CPU 사용량 포함 확인
    - _Requirements: 10.1_

  - [ ]* 13.3 헬스체크 Unhealthy 상태 속성 테스트 작성
    - **Property 29: Health Check Unhealthy State**
    - **Validates: Requirements 10.2**
    - Google Sheets API 연결 실패 시 'unhealthy' 상태를 반환하는지 검증

- [x] 14. 모니터링 및 알림 강화
  - 응답 시간 모니터링
  - 캐시 크기 경고
  - 동시 요청 수 경고
  - _Requirements: 9.1, 9.2, 9.3, 10.3, 10.4_

  - [x] 14.1 응답 시간 로깅 추가
    - 모든 API 요청 완료 시 응답 시간 로깅
    - _Requirements: 9.1_

  - [x] 14.2 느린 응답 경고 로깅 추가
    - 응답 시간이 3초를 초과하면 경고 로그 출력
    - 응답 시간이 5초를 초과하면 에러 로그 출력
    - _Requirements: 9.2, 9.3_

  - [x] 14.3 캐시 크기 경고 로깅 추가
    - 캐시 크기가 임계값(예: 180개)을 초과하면 경고 로그 출력
    - _Requirements: 10.3_

  - [x] 14.4 동시 요청 수 경고 로깅 추가
    - 동시 요청 수가 임계값(예: 8개)을 초과하면 경고 로그 출력
    - _Requirements: 10.4_

  - [ ]* 14.5 응답 시간 로깅 속성 테스트 작성
    - **Property 25: Response Time Logging**
    - **Validates: Requirements 9.1**
    - API 요청 완료 시 응답 시간이 로깅되는지 검증

  - [ ]* 14.6 느린 응답 경고 속성 테스트 작성
    - **Property 26: Slow Response Warning**
    - **Validates: Requirements 9.2**
    - 응답 시간이 3초를 초과할 때 경고 로그가 출력되는지 검증

  - [ ]* 14.7 매우 느린 응답 알림 속성 테스트 작성
    - **Property 27: Very Slow Response Alert**
    - **Validates: Requirements 9.3**
    - 응답 시간이 5초를 초과할 때 에러 로그가 출력되는지 검증

- [x] 15. Final Checkpoint - 전체 시스템 검증
  - 모든 CORS 에러가 해결되었는지 확인
  - 모든 500/404 에러가 해결되었는지 확인
  - SmartFetch 캐싱 로직이 올바르게 동작하는지 확인
  - 에러 로깅이 올바르게 동작하는지 확인
  - 성능이 개선되었는지 확인
  - 사용자에게 최종 확인 요청

## Notes

- `*` 표시가 있는 태스크는 선택적(optional)이며, 빠른 MVP를 위해 건너뛸 수 있습니다
- 각 태스크는 특정 요구사항을 참조하여 추적 가능성을 보장합니다
- Checkpoint 태스크는 점진적인 검증을 보장합니다
- 속성 테스트는 범용 정확성 속성을 검증합니다
- 단위 테스트는 특정 예제 및 엣지 케이스를 검증합니다
