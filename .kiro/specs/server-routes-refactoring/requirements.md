# Requirements Document

## Introduction

server/index.js 파일이 42,966줄로 비대해져 유지보수가 매우 어려운 상황입니다. 이 파일은 Express 서버의 모든 라우트, 미들웨어, 비즈니스 로직을 포함하고 있어 코드 가독성이 낮고, 테스트가 어려우며, 여러 개발자가 동시에 작업하기 힘듭니다. 이 프로젝트는 server/index.js를 기능별로 모듈화하여 유지보수성을 개선하고, 코드 구조를 명확히 하며, 테스트 가능성을 높이는 것을 목표로 합니다.

## Glossary

- **Server**: Express 기반 Node.js 백엔드 서버
- **Route_Module**: 특정 기능 영역의 API 엔드포인트를 그룹화한 독립적인 모듈
- **Middleware**: HTTP 요청/응답 처리 파이프라인의 중간 처리 함수
- **Google_Sheets_Client**: Google Sheets API와 통신하는 인증된 클라이언트 객체
- **Cache_System**: API 응답을 메모리에 저장하여 성능을 개선하는 시스템
- **Rate_Limiter**: Google Sheets API 호출 빈도를 제한하는 메커니즘
- **CORS_Middleware**: Cross-Origin Resource Sharing 헤더를 처리하는 미들웨어
- **Discord_Bot**: 로깅 및 알림을 위한 Discord 봇 클라이언트
- **Health_Check**: 서버 상태를 확인하는 엔드포인트
- **Shared_Utility**: 여러 라우트 모듈에서 공통으로 사용하는 유틸리티 함수

## Requirements

### Requirement 1: 라우트 모듈 분리

**User Story:** 개발자로서, 기능별로 분리된 라우트 모듈을 통해 코드를 쉽게 찾고 수정할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN server/index.js가 실행되면, THE Server SHALL 모든 라우트 모듈을 server/routes/ 디렉토리에서 로드해야 합니다
2. WHEN 라우트 모듈이 생성되면, THE Route_Module SHALL 단일 기능 영역의 API 엔드포인트만 포함해야 합니다
3. WHEN 라우트 모듈이 등록되면, THE Server SHALL 기존 API 엔드포인트 URL을 변경하지 않아야 합니다
4. WHEN 새로운 라우트가 추가되면, THE Route_Module SHALL 독립적으로 테스트 가능해야 합니다
5. WHEN 라우트 모듈이 로드되면, THE Server SHALL 모듈 로딩 실패 시 명확한 에러 메시지를 출력해야 합니다

### Requirement 2: 공통 유틸리티 분리

**User Story:** 개발자로서, 중복 코드를 제거하고 공통 기능을 재사용할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN 공통 유틸리티가 생성되면, THE Shared_Utility SHALL server/utils/ 디렉토리에 배치되어야 합니다
2. WHEN 여러 라우트에서 동일한 로직이 사용되면, THE Shared_Utility SHALL 해당 로직을 단일 함수로 제공해야 합니다
3. WHEN 유틸리티 함수가 호출되면, THE Shared_Utility SHALL 일관된 에러 처리를 제공해야 합니다
4. WHEN 캐시 관련 기능이 필요하면, THE Cache_System SHALL 독립적인 모듈로 분리되어야 합니다
5. WHEN Rate Limiting이 필요하면, THE Rate_Limiter SHALL 독립적인 모듈로 분리되어야 합니다

### Requirement 3: 미들웨어 모듈화

**User Story:** 개발자로서, 미들웨어를 독립적으로 관리하고 테스트할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN 서버가 시작되면, THE CORS_Middleware SHALL 모든 라우트보다 먼저 등록되어야 합니다
2. WHEN 타임아웃 미들웨어가 실행되면, THE Middleware SHALL 5분 초과 요청에 대해 504 에러를 반환해야 합니다
3. WHEN 로깅 미들웨어가 실행되면, THE Middleware SHALL 모든 요청/응답을 콘솔에 기록해야 합니다
4. WHEN 미들웨어가 분리되면, THE Middleware SHALL server/middleware/ 디렉토리에 배치되어야 합니다
5. WHEN 에러가 발생하면, THE Middleware SHALL 일관된 에러 응답 형식을 제공해야 합니다

### Requirement 4: Google Sheets 클라이언트 공유

**User Story:** 개발자로서, 모든 라우트 모듈에서 동일한 Google Sheets 클라이언트를 사용할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN 서버가 시작되면, THE Google_Sheets_Client SHALL 단일 인스턴스로 초기화되어야 합니다
2. WHEN 라우트 모듈이 Google Sheets에 접근하면, THE Google_Sheets_Client SHALL 공유된 인스턴스를 사용해야 합니다
3. WHEN API 호출이 실행되면, THE Rate_Limiter SHALL Google Sheets API 호출 빈도를 제한해야 합니다
4. WHEN Rate Limit 에러가 발생하면, THE Rate_Limiter SHALL 자동으로 재시도해야 합니다
5. WHEN 인증이 실패하면, THE Google_Sheets_Client SHALL 명확한 에러 메시지를 반환해야 합니다

### Requirement 5: 캐시 시스템 모듈화

**User Story:** 개발자로서, 캐시 시스템을 독립적으로 관리하고 모니터링할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN 캐시가 생성되면, THE Cache_System SHALL 독립적인 모듈로 분리되어야 합니다
2. WHEN 데이터가 캐시되면, THE Cache_System SHALL 5분 TTL을 적용해야 합니다
3. WHEN 캐시 크기가 200개를 초과하면, THE Cache_System SHALL 가장 오래된 항목을 삭제해야 합니다
4. WHEN 캐시 상태가 조회되면, THE Cache_System SHALL 유효/만료 항목 수를 반환해야 합니다
5. WHEN 캐시가 정리되면, THE Cache_System SHALL 만료된 항목만 삭제해야 합니다

### Requirement 6: Discord 봇 모듈화

**User Story:** 개발자로서, Discord 로깅 기능을 독립적으로 관리할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN Discord 봇이 초기화되면, THE Discord_Bot SHALL 독립적인 모듈로 분리되어야 합니다
2. WHEN 로깅이 비활성화되면, THE Discord_Bot SHALL 초기화되지 않아야 합니다
3. WHEN 에러가 발생하면, THE Discord_Bot SHALL Discord 채널에 알림을 전송해야 합니다
4. WHEN 서버가 충돌하면, THE Discord_Bot SHALL @everyone 멘션과 함께 알림을 전송해야 합니다
5. WHEN Discord 전송이 실패하면, THE Discord_Bot SHALL 콘솔에 에러를 기록하고 계속 실행되어야 합니다

### Requirement 7: 라우트 그룹 정의

**User Story:** 개발자로서, 명확한 기준으로 라우트를 그룹화하여 코드 구조를 이해하기 쉽게 만들고 싶습니다.

#### Acceptance Criteria

1. WHEN 헬스체크 라우트가 분리되면, THE Route_Module SHALL /health, /, /api/version, /api/cache-status 엔드포인트를 포함해야 합니다
2. WHEN 팀 관련 라우트가 분리되면, THE Route_Module SHALL /api/teams, /api/team-leaders 엔드포인트를 포함해야 합니다
3. WHEN 로깅 라우트가 분리되면, THE Route_Module SHALL /api/client-logs, /api/log-activity 엔드포인트를 포함해야 합니다
4. WHEN 캐시 관리 라우트가 분리되면, THE Route_Module SHALL /api/cache-refresh 엔드포인트를 포함해야 합니다
5. WHEN 좌표 업데이트 라우트가 분리되면, THE Route_Module SHALL /api/update-coordinates, /api/update-sales-coordinates 엔드포인트를 포함해야 합니다
6. WHEN 스토어 데이터 라우트가 분리되면, THE Route_Module SHALL /api/stores 엔드포인트를 포함해야 합니다
7. WHEN 지도 재고 노출 라우트가 분리되면, THE Route_Module SHALL /api/map-display-option/* 엔드포인트를 포함해야 합니다
8. WHEN 영업 모드 라우트가 분리되면, THE Route_Module SHALL /api/sales-data, /api/sales-mode-access 엔드포인트를 포함해야 합니다
9. WHEN 재고회수 라우트가 분리되면, THE Route_Module SHALL /api/inventoryRecoveryAccess 엔드포인트를 포함해야 합니다
10. WHEN 모델 및 대리점 라우트가 분리되면, THE Route_Module SHALL /api/models, /api/agents 엔드포인트를 포함해야 합니다
11. WHEN 개통실적 라우트가 분리되면, THE Route_Module SHALL /api/activation-data/* 엔드포인트를 포함해야 합니다
12. WHEN 로그인 라우트가 분리되면, THE Route_Module SHALL /api/login, /api/verify-password, /api/verify-direct-store-password 엔드포인트를 포함해야 합니다
13. WHEN 고객(member) 라우트가 분리되면, THE Route_Module SHALL /api/member/* 엔드포인트를 포함해야 합니다
14. WHEN 직영점(direct) 라우트가 분리되면, THE Route_Module SHALL /api/direct/* 엔드포인트를 포함해야 합니다 (이미 분리됨)
15. WHEN 온세일 라우트가 분리되면, THE Route_Module SHALL /api/onsale/* 엔드포인트를 포함해야 합니다
16. WHEN 재고 관리 라우트가 분리되면, THE Route_Module SHALL /api/inventory/* 엔드포인트를 포함해야 합니다
17. WHEN 회의 라우트가 분리되면, THE Route_Module SHALL /api/meetings/* 엔드포인트를 포함해야 합니다 (이미 분리됨)
18. WHEN 예산 관리 라우트가 분리되면, THE Route_Module SHALL /api/budget/* 엔드포인트를 포함해야 합니다
19. WHEN 정책 공지 라우트가 분리되면, THE Route_Module SHALL /api/policy-notices/* 엔드포인트를 포함해야 합니다

### Requirement 8: 점진적 마이그레이션

**User Story:** 개발자로서, 프로덕션 환경에 영향을 주지 않고 안전하게 리팩토링을 진행하고 싶습니다.

#### Acceptance Criteria

1. WHEN 라우트 모듈이 분리되면, THE Server SHALL 기존 기능을 100% 유지해야 합니다
2. WHEN 마이그레이션이 진행되면, THE Server SHALL 각 모듈을 독립적으로 테스트할 수 있어야 합니다
3. WHEN 새 모듈이 배포되면, THE Server SHALL 기존 API 응답 형식을 유지해야 합니다
4. WHEN 에러가 발생하면, THE Server SHALL 기존과 동일한 에러 처리를 제공해야 합니다
5. WHEN 성능이 측정되면, THE Server SHALL 리팩토링 전과 동일하거나 더 나은 성능을 보여야 합니다

### Requirement 9: 코드 중복 제거

**User Story:** 개발자로서, 중복된 코드를 제거하여 유지보수 비용을 줄이고 싶습니다.

#### Acceptance Criteria

1. WHEN 공통 로직이 식별되면, THE Shared_Utility SHALL 해당 로직을 단일 함수로 제공해야 합니다
2. WHEN 에러 처리가 필요하면, THE Shared_Utility SHALL 일관된 에러 처리 함수를 제공해야 합니다
3. WHEN 응답 형식이 필요하면, THE Shared_Utility SHALL 표준화된 응답 포맷 함수를 제공해야 합니다
4. WHEN 데이터 변환이 필요하면, THE Shared_Utility SHALL 재사용 가능한 변환 함수를 제공해야 합니다
5. WHEN 유효성 검사가 필요하면, THE Shared_Utility SHALL 공통 검증 함수를 제공해야 합니다

### Requirement 10: 테스트 가능성 개선

**User Story:** 개발자로서, 각 모듈을 독립적으로 테스트하여 코드 품질을 보장하고 싶습니다.

#### Acceptance Criteria

1. WHEN 라우트 모듈이 생성되면, THE Route_Module SHALL 의존성 주입을 통해 테스트 가능해야 합니다
2. WHEN 유틸리티가 생성되면, THE Shared_Utility SHALL 순수 함수로 작성되어 테스트 가능해야 합니다
3. WHEN 미들웨어가 생성되면, THE Middleware SHALL 독립적으로 테스트 가능해야 합니다
4. WHEN 캐시 시스템이 생성되면, THE Cache_System SHALL 모의 객체로 대체 가능해야 합니다
5. WHEN Google Sheets 클라이언트가 사용되면, THE Google_Sheets_Client SHALL 모의 객체로 대체 가능해야 합니다

### Requirement 11: 문서화 및 주석

**User Story:** 개발자로서, 명확한 문서와 주석을 통해 코드를 쉽게 이해하고 싶습니다.

#### Acceptance Criteria

1. WHEN 라우트 모듈이 생성되면, THE Route_Module SHALL 파일 상단에 모듈 설명 주석을 포함해야 합니다
2. WHEN 함수가 작성되면, THE Shared_Utility SHALL JSDoc 형식의 주석을 포함해야 합니다
3. WHEN API 엔드포인트가 정의되면, THE Route_Module SHALL 엔드포인트 설명 주석을 포함해야 합니다
4. WHEN 복잡한 로직이 있으면, THE Route_Module SHALL 인라인 주석으로 설명을 제공해야 합니다
5. WHEN 마이그레이션이 완료되면, THE Server SHALL README 파일에 새로운 구조를 문서화해야 합니다

### Requirement 12: 에러 처리 표준화

**User Story:** 개발자로서, 일관된 에러 처리를 통해 디버깅을 쉽게 하고 싶습니다.

#### Acceptance Criteria

1. WHEN 에러가 발생하면, THE Server SHALL 일관된 에러 응답 형식을 반환해야 합니다
2. WHEN Google Sheets API 에러가 발생하면, THE Rate_Limiter SHALL 에러 타입에 따라 적절히 처리해야 합니다
3. WHEN 타임아웃이 발생하면, THE Middleware SHALL CORS 헤더를 포함한 504 에러를 반환해야 합니다
4. WHEN 유효성 검사가 실패하면, THE Route_Module SHALL 400 에러와 명확한 메시지를 반환해야 합니다
5. WHEN 서버 에러가 발생하면, THE Server SHALL 500 에러와 함께 Discord 알림을 전송해야 합니다

### Requirement 13: 성능 유지

**User Story:** 개발자로서, 리팩토링 후에도 동일하거나 더 나은 성능을 유지하고 싶습니다.

#### Acceptance Criteria

1. WHEN 라우트가 호출되면, THE Server SHALL 리팩토링 전과 동일한 응답 시간을 유지해야 합니다
2. WHEN 캐시가 사용되면, THE Cache_System SHALL 기존과 동일한 캐시 히트율을 유지해야 합니다
3. WHEN 동시 요청이 발생하면, THE Server SHALL 기존과 동일한 처리량을 유지해야 합니다
4. WHEN 메모리가 사용되면, THE Server SHALL 리팩토링 전과 유사한 메모리 사용량을 유지해야 합니다
5. WHEN Rate Limiting이 적용되면, THE Rate_Limiter SHALL Google Sheets API 할당량을 초과하지 않아야 합니다

### Requirement 14: 하위 호환성 유지

**User Story:** 개발자로서, 기존 클라이언트 코드를 수정하지 않고 리팩토링을 완료하고 싶습니다.

#### Acceptance Criteria

1. WHEN API 엔드포인트가 변경되면, THE Server SHALL 기존 URL을 유지해야 합니다
2. WHEN 응답 형식이 변경되면, THE Server SHALL 기존 응답 구조를 유지해야 합니다
3. WHEN 요청 파라미터가 변경되면, THE Server SHALL 기존 파라미터를 지원해야 합니다
4. WHEN 헤더가 변경되면, THE Server SHALL 기존 헤더를 지원해야 합니다
5. WHEN 인증이 변경되면, THE Server SHALL 기존 인증 방식을 유지해야 합니다
