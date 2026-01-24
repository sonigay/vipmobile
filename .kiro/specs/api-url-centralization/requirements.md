# Requirements Document

## Introduction

이 문서는 VIP Map Application의 API URL 중앙화 기능에 대한 요구사항을 정의합니다. 현재 시스템은 여러 파일에 하드코딩된 API URL을 사용하고 있어 CORS 오류와 유지보수 문제를 야기하고 있습니다. 이 기능은 모든 API URL을 단일 진실 공급원(Single Source of Truth)으로 중앙화하여 일관성과 유지보수성을 개선합니다.

## Glossary

- **API_URL**: 백엔드 서버의 기본 URL (예: `https://vipmobile-backend.cloudtype.app`)
- **Frontend**: React 기반 웹 애플리케이션
- **Backend**: Node.js/Express 기반 서버
- **CORS**: Cross-Origin Resource Sharing, 브라우저의 교차 출처 요청 보안 정책
- **Environment_Variable**: 환경 변수, 배포 환경에 따라 다른 값을 가질 수 있는 설정 값
- **Single_Source_of_Truth**: 단일 진실 공급원, 특정 데이터의 유일한 권위 있는 출처
- **Hardcoded_URL**: 소스 코드에 직접 작성된 URL 문자열
- **Android_App**: Kotlin 기반 Android 동반 애플리케이션

## Requirements

### Requirement 1: API URL 중앙화

**User Story:** 개발자로서, 모든 API 요청이 단일 설정 지점에서 URL을 참조하도록 하여, URL 변경 시 한 곳만 수정하면 되도록 하고 싶습니다.

#### Acceptance Criteria

1. THE Frontend SHALL use a single centralized API_URL configuration for all HTTP requests
2. WHEN the API_URL is changed in the centralized configuration, THEN all components SHALL automatically use the updated URL
3. THE Frontend SHALL NOT contain any Hardcoded_URL values outside the centralized configuration
4. THE centralized configuration SHALL support Environment_Variable overrides for different deployment environments

### Requirement 2: 하드코딩된 URL 제거

**User Story:** 개발자로서, 코드베이스에서 모든 하드코딩된 API URL을 제거하여, 일관성 없는 URL 사용으로 인한 버그를 방지하고 싶습니다.

#### Acceptance Criteria

1. WHEN searching for Hardcoded_URL patterns in the codebase, THEN no API URL strings SHALL be found outside the centralized configuration
2. THE `src/utils/policyService.js` SHALL import and use the centralized API_URL
3. THE `src/components/PolicyMode.js` SHALL import and use the centralized API_URL for all 3 API calls
4. THE `src/components/BudgetMode.js` SHALL import and use the centralized API_URL
5. THE `src/components/ActivationInfoPage.js` SHALL import and use the centralized API_URL
6. THE Android_App SHALL use a centralized configuration mechanism for API_URL

### Requirement 3: CORS 설정 동기화

**User Story:** 시스템 관리자로서, 백엔드 CORS 설정이 실제 프론트엔드 배포 URL과 일치하도록 하여, CORS 오류를 방지하고 싶습니다.

#### Acceptance Criteria

1. WHEN the Backend receives a request from `port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app`, THEN the CORS middleware SHALL allow the request
2. THE Backend SHALL maintain a list of allowed origins that includes all valid Frontend deployment URLs
3. WHEN a new Frontend deployment URL is added, THEN the Backend CORS configuration SHALL be updated to include it
4. THE Backend SHALL log CORS-related errors with the requesting origin for debugging purposes

### Requirement 4: 환경 변수 문서화

**User Story:** 개발자로서, API URL 설정 방법에 대한 명확한 문서를 원하여, 새로운 환경에 배포할 때 올바르게 설정할 수 있도록 하고 싶습니다.

#### Acceptance Criteria

1. THE system SHALL provide documentation that lists all required Environment_Variable names
2. THE documentation SHALL include example values for each Environment_Variable
3. THE documentation SHALL explain the precedence order when multiple configuration sources exist
4. THE documentation SHALL describe how to configure API_URL for development, staging, and production environments

### Requirement 5: 설정 검증

**User Story:** 개발자로서, 애플리케이션 시작 시 API URL 설정이 유효한지 자동으로 검증하여, 잘못된 설정으로 인한 런타임 오류를 조기에 발견하고 싶습니다.

#### Acceptance Criteria

1. WHEN the Frontend starts, THEN the system SHALL validate that API_URL is defined and not empty
2. WHEN the API_URL is invalid (malformed URL), THEN the system SHALL log a warning message
3. IF the API_URL is not configured, THEN the system SHALL use a documented default value
4. THE system SHALL log the active API_URL during startup for debugging purposes

### Requirement 6: Android 앱 설정 통합

**User Story:** Android 개발자로서, Android 앱도 중앙화된 설정 메커니즘을 사용하여, 웹 앱과 동일한 방식으로 API URL을 관리하고 싶습니다.

#### Acceptance Criteria

1. THE Android_App SHALL read API_URL from a centralized configuration file or build configuration
2. WHEN the API_URL needs to be changed, THEN only the configuration file SHALL need to be modified
3. THE Android_App SHALL support different API_URL values for debug and release build variants
4. THE Android_App configuration SHALL be documented alongside Frontend configuration
