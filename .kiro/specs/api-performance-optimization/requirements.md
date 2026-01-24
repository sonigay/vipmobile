# Requirements Document

## Introduction

VIP Map Application의 API 성능 최적화 및 에러 해결을 위한 요구사항 문서입니다. 현재 시스템은 CORS 에러, API 타임아웃, 500/404 에러, 캐싱 로직 오류 등 다양한 문제로 인해 사용자 경험이 저하되고 있습니다. 본 요구사항은 이러한 문제들을 체계적으로 해결하여 안정적이고 빠른 서비스를 제공하는 것을 목표로 합니다.

## Glossary

- **CORS (Cross-Origin Resource Sharing)**: 웹 브라우저에서 다른 도메인의 리소스에 접근할 수 있도록 허용하는 메커니즘
- **API_Gateway**: 클라이언트와 백엔드 서비스 간의 모든 API 요청을 처리하는 진입점
- **Cache_Manager**: 데이터 캐싱을 관리하는 시스템 컴포넌트
- **Rate_Limiter**: API 호출 빈도를 제한하여 서비스 안정성을 보장하는 메커니즘
- **Google_Sheets_API**: Google Sheets를 데이터 소스로 사용하기 위한 API
- **SmartFetch**: 클라이언트 측 캐싱 및 재시도 로직을 포함한 fetch 래퍼 함수
- **Backend_Server**: Express 기반 Node.js 백엔드 서버
- **Frontend_Client**: React 기반 프론트엔드 애플리케이션
- **Error_Handler**: 에러를 감지하고 적절히 처리하는 시스템 컴포넌트
- **Timeout_Manager**: API 요청 타임아웃을 관리하는 컴포넌트

## Requirements

### Requirement 1: CORS 에러 해결

**User Story:** 개발자로서, CORS 에러로 인한 API 호출 실패를 해결하여 모든 API 엔드포인트가 정상적으로 작동하도록 하고 싶습니다.

#### Acceptance Criteria

1. WHEN 프론트엔드가 `/api/direct/mobiles-pricing` 엔드포인트를 호출하면, THE Backend_Server SHALL CORS 헤더를 올바르게 설정하여 응답을 반환한다
2. WHEN 프론트엔드가 `/api/direct/policy-settings` 엔드포인트를 호출하면, THE Backend_Server SHALL CORS 헤더를 올바르게 설정하여 응답을 반환한다
3. WHEN 프론트엔드가 `/api/direct/store-main-page-texts` 엔드포인트를 호출하면, THE Backend_Server SHALL CORS 헤더를 올바르게 설정하여 응답을 반환한다
4. WHEN OPTIONS 프리플라이트 요청이 발생하면, THE Backend_Server SHALL 200 OK 응답과 함께 적절한 CORS 헤더를 반환한다
5. WHEN CORS 에러가 발생하면, THE Error_Handler SHALL 요청 오리진, 허용된 오리진 목록, 실패 이유를 상세히 로깅한다

### Requirement 2: API 타임아웃 문제 해결

**User Story:** 사용자로서, API 요청이 504 Gateway Timeout 없이 적절한 시간 내에 응답을 받고 싶습니다.

#### Acceptance Criteria

1. WHEN API 요청이 발생하면, THE Backend_Server SHALL 5분 이내에 응답을 반환한다
2. WHEN Google Sheets API 호출이 발생하면, THE Rate_Limiter SHALL 호출 간격을 최소 2초로 제한한다
3. WHEN Google Sheets API Rate Limit 에러가 발생하면, THE Backend_Server SHALL Exponential Backoff 전략으로 최대 5회 재시도한다
4. WHEN 동시 API 요청이 10개를 초과하면, THE Backend_Server SHALL 요청을 큐에 저장하고 순차적으로 처리한다
5. IF API 요청이 5분을 초과하면, THEN THE Timeout_Manager SHALL 요청을 중단하고 타임아웃 에러를 반환한다

### Requirement 3: 500/404 에러 해결

**User Story:** 개발자로서, 500 Internal Server Error와 404 Not Found 에러를 해결하여 모든 API 엔드포인트가 안정적으로 작동하도록 하고 싶습니다.

#### Acceptance Criteria

1. WHEN `/api/budget/policy-group-settings` 엔드포인트가 호출되면, THE Backend_Server SHALL 유효한 데이터 또는 명확한 에러 메시지를 반환한다
2. WHEN `/api/budget/month-sheets` 엔드포인트가 호출되면, THE Backend_Server SHALL 유효한 데이터 또는 명확한 에러 메시지를 반환한다
3. WHEN `/api/budget/policy-groups` 엔드포인트가 호출되면, THE Backend_Server SHALL 유효한 데이터 또는 명확한 에러 메시지를 반환한다
4. WHEN `/api/budget/user-sheets-v2` 엔드포인트가 호출되면, THE Backend_Server SHALL 유효한 데이터 또는 명확한 에러 메시지를 반환한다
5. WHEN `/api/team-leaders` 엔드포인트가 호출되면, THE Backend_Server SHALL 404 에러 대신 유효한 팀장 목록을 반환한다
6. WHEN `/api/policy-table/user-groups/{id}/change-history` 엔드포인트가 호출되면, THE Backend_Server SHALL 500 에러 대신 유효한 변경 이력을 반환한다
7. WHEN API 에러가 발생하면, THE Error_Handler SHALL 에러 타입, 메시지, 스택 트레이스, 요청 정보를 상세히 로깅한다

### Requirement 4: SmartFetch 캐싱 로직 개선

**User Story:** 개발자로서, SmartFetch의 백그라운드 캐시 갱신 실패를 해결하여 안정적인 캐싱 메커니즘을 구현하고 싶습니다.

#### Acceptance Criteria

1. WHEN SmartFetch가 캐시된 데이터를 반환하면, THE SmartFetch SHALL 백그라운드에서 캐시를 갱신한다
2. WHEN 백그라운드 캐시 갱신 중 에러가 발생하면, THE SmartFetch SHALL 에러를 로깅하고 기존 캐시를 유지한다
3. WHEN 변수 'd'가 초기화되기 전에 접근하면, THE SmartFetch SHALL ReferenceError를 발생시키지 않는다
4. WHEN 캐시 갱신이 실패하면, THE SmartFetch SHALL 다음 요청 시 캐시를 무효화하고 새로운 데이터를 가져온다
5. WHEN 캐시 TTL이 만료되면, THE Cache_Manager SHALL 자동으로 캐시를 삭제한다

### Requirement 5: Google Sheets API 호출 최적화

**User Story:** 시스템 관리자로서, Google Sheets API 쿼터 제한을 초과하지 않으면서 빠른 응답 속도를 유지하고 싶습니다.

#### Acceptance Criteria

1. WHEN Google Sheets API 호출이 발생하면, THE Cache_Manager SHALL 5분간 결과를 캐싱한다
2. WHEN 캐시된 데이터가 존재하면, THE Backend_Server SHALL Google Sheets API를 호출하지 않고 캐시된 데이터를 반환한다
3. WHEN API 호출 빈도가 분당 45회를 초과하면, THE Rate_Limiter SHALL 추가 요청을 대기시킨다
4. WHEN Rate Limit 에러가 발생하면, THE Backend_Server SHALL Exponential Backoff와 Jitter를 적용하여 재시도한다
5. WHEN 캐시 크기가 200개를 초과하면, THE Cache_Manager SHALL LRU 방식으로 가장 오래된 항목을 삭제한다

### Requirement 6: 클라이언트 성능 개선

**User Story:** 사용자로서, 클릭 이벤트와 UI 업데이트가 빠르게 반응하여 부드러운 사용자 경험을 얻고 싶습니다.

#### Acceptance Criteria

1. WHEN 클릭 이벤트 핸들러가 실행되면, THE Frontend_Client SHALL 100ms 이내에 처리를 완료한다
2. WHEN UI 업데이트가 발생하면, THE Frontend_Client SHALL Forced Reflow를 최소화한다
3. WHEN 반복적인 API 호출이 발생하면, THE Frontend_Client SHALL 요청을 병합하거나 디바운싱한다
4. WHEN 대량의 데이터를 렌더링하면, THE Frontend_Client SHALL 가상화 또는 페이지네이션을 사용한다
5. WHEN 이미지를 로드하면, THE Frontend_Client SHALL Lazy Loading을 적용한다

### Requirement 7: 에러 핸들링 및 로깅 강화

**User Story:** 개발자로서, 에러 발생 시 원인을 빠르게 파악하고 해결할 수 있도록 상세한 로그를 확인하고 싶습니다.

#### Acceptance Criteria

1. WHEN API 에러가 발생하면, THE Error_Handler SHALL 에러 타입, 메시지, 스택 트레이스, 요청 정보(경로, 메서드, 헤더)를 로깅한다
2. WHEN CORS 에러가 발생하면, THE Error_Handler SHALL 요청 오리진, 허용된 오리진 목록, 실패 이유를 로깅한다
3. WHEN Google Sheets API 에러가 발생하면, THE Error_Handler SHALL 에러 코드, 메시지, 재시도 횟수를 로깅한다
4. WHEN 타임아웃 에러가 발생하면, THE Error_Handler SHALL 요청 URL, 경과 시간, 타임아웃 설정값을 로깅한다
5. WHEN 클라이언트 에러가 발생하면, THE Frontend_Client SHALL 에러 정보를 백엔드로 전송하여 중앙 집중식 로깅을 수행한다

### Requirement 8: 재시도 로직 구현

**User Story:** 개발자로서, 일시적인 네트워크 오류나 서버 과부하 시 자동으로 재시도하여 안정성을 높이고 싶습니다.

#### Acceptance Criteria

1. WHEN API 요청이 실패하면, THE Backend_Server SHALL 최대 3회까지 재시도한다
2. WHEN 재시도 시, THE Backend_Server SHALL Exponential Backoff 전략을 사용한다
3. WHEN Rate Limit 에러가 발생하면, THE Backend_Server SHALL 최대 5회까지 재시도한다
4. WHEN 재시도가 모두 실패하면, THE Backend_Server SHALL 명확한 에러 메시지를 반환한다
5. WHEN 재시도 중이면, THE Backend_Server SHALL 재시도 횟수와 대기 시간을 로깅한다

### Requirement 9: API 응답 시간 모니터링

**User Story:** 시스템 관리자로서, API 응답 시간을 모니터링하여 성능 저하를 조기에 감지하고 싶습니다.

#### Acceptance Criteria

1. WHEN API 요청이 완료되면, THE Backend_Server SHALL 응답 시간을 로깅한다
2. WHEN 응답 시간이 3초를 초과하면, THE Backend_Server SHALL 경고 로그를 출력한다
3. WHEN 응답 시간이 5초를 초과하면, THE Backend_Server SHALL 에러 로그를 출력하고 알림을 전송한다
4. WHEN 평균 응답 시간이 1초를 초과하면, THE Backend_Server SHALL 성능 저하 알림을 전송한다
5. WHEN 응답 시간 통계가 수집되면, THE Backend_Server SHALL 일별/주별 리포트를 생성한다

### Requirement 10: 헬스체크 및 모니터링 강화

**User Story:** 시스템 관리자로서, 서버 상태를 실시간으로 모니터링하여 장애를 조기에 감지하고 싶습니다.

#### Acceptance Criteria

1. WHEN `/health` 엔드포인트가 호출되면, THE Backend_Server SHALL 서버 상태, 타임스탬프, 메모리 사용량, CPU 사용량을 반환한다
2. WHEN Google Sheets API 연결이 실패하면, THE Backend_Server SHALL 헬스체크 상태를 'unhealthy'로 변경한다
3. WHEN 캐시 크기가 임계값을 초과하면, THE Backend_Server SHALL 경고 로그를 출력한다
4. WHEN 동시 요청 수가 임계값을 초과하면, THE Backend_Server SHALL 경고 로그를 출력한다
5. WHEN 서버가 시작되면, THE Backend_Server SHALL 초기화 상태와 설정 정보를 로깅한다
