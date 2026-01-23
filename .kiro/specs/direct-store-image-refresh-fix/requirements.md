# Requirements Document

## Introduction

직영점모드 휴대폰시세표의 이미지 갱신 기능 및 API 오류 문제를 해결하기 위한 요구사항 문서입니다. 현재 "이미지갱신하기" 버튼이 작동하지 않고, 다수의 API 호출에서 초기화 오류 및 CORS 정책 오류가 발생하고 있습니다.

## Glossary

- **System**: 직영점모드 휴대폰시세표 시스템
- **Image_Refresh_Service**: 이미지 갱신 서비스
- **API_Client**: directStoreApiClient (프론트엔드 API 클라이언트)
- **Backend_Server**: Express 기반 백엔드 서버
- **Discord_CDN**: Discord Content Delivery Network (이미지 호스팅)
- **Master_Data**: 단말 마스터, 요금제 마스터, 단말 요금정책 데이터
- **CORS_Middleware**: Cross-Origin Resource Sharing 미들웨어
- **SWR_Cache**: Stale-While-Revalidate 캐싱 메커니즘

## Requirements

### Requirement 1: 통신사별 시세표 갱신 기능 (기존 새로고침 버튼 개선)

**User Story:** 관리자로서, "시세표갱신하기" 버튼을 클릭하면 해당 통신사의 마스터 데이터가 재빌드되고 UI에 즉시 반영되기를 원합니다.

#### Acceptance Criteria

1. WHEN 사용자가 특정 통신사 탭에서 "시세표갱신하기" 버튼을 클릭하면, THE System SHALL 해당 통신사의 마스터 데이터만 재빌드해야 합니다
2. WHEN 마스터 데이터 재빌드가 완료되면, THE System SHALL 해당 통신사의 프론트엔드 캐시를 무효화하고 최신 데이터를 다시 로드해야 합니다
3. WHEN 시세표 갱신이 완료되면, THE System SHALL 사용자에게 성공 메시지와 함께 갱신된 항목 수를 표시해야 합니다
4. IF 시세표 갱신 중 오류가 발생하면, THE System SHALL 사용자에게 구체적인 오류 메시지를 표시해야 합니다
5. WHEN 시세표 갱신이 진행 중일 때, THE System SHALL 버튼을 비활성화하고 로딩 인디케이터를 표시해야 합니다

### Requirement 1-1: 통신사별 이미지 갱신 기능

**User Story:** 관리자로서, "이미지갱신하기" 버튼을 클릭하면 해당 통신사의 Discord 메시지 ID를 통해 이미지가 재업로드되고 UI에 즉시 반영되기를 원합니다.

#### Acceptance Criteria

1. WHEN 사용자가 특정 통신사 탭에서 "이미지갱신하기" 버튼을 클릭하면, THE System SHALL 해당 통신사의 Discord 메시지 ID를 조회해야 합니다
2. WHEN Discord 메시지 ID가 존재하면, THE System SHALL Discord API를 통해 최신 이미지 URL을 가져와야 합니다
3. WHEN 새로운 이미지 URL을 가져오면, THE System SHALL Google Sheets의 이미지 URL 필드를 업데이트해야 합니다
4. WHEN 이미지 갱신이 완료되면, THE System SHALL 해당 통신사의 이미지 캐시를 무효화하고 UI에 새 이미지를 표시해야 합니다
5. IF 이미지 갱신 중 오류가 발생하면, THE System SHALL 실패한 모델 목록과 함께 오류 메시지를 표시해야 합니다

### Requirement 2: API 초기화 오류 해결

**User Story:** 개발자로서, ReferenceError: Cannot access 'd' before initialization 오류가 발생하지 않도록 API 클라이언트가 안정적으로 작동하기를 원합니다.

#### Acceptance Criteria

1. WHEN API_Client가 초기화될 때, THE System SHALL 모든 변수를 올바른 순서로 초기화해야 합니다
2. WHEN getMobilesMaster, getPlansMaster, getMobilesPricing, getPolicySettings API가 호출될 때, THE System SHALL 초기화 오류 없이 정상적으로 응답을 반환해야 합니다
3. WHEN 여러 API 호출이 동시에 발생할 때, THE System SHALL 요청 대기열을 통해 순차적으로 처리해야 합니다
4. WHEN 백그라운드 캐시 갱신이 실행될 때, THE System SHALL 초기화 오류 없이 조용히 실행되어야 합니다
5. FOR ALL 통신사(LG, KT, SK), API 호출은 동일한 안정성을 보장해야 합니다

### Requirement 3: CORS 정책 오류 해결

**User Story:** 사용자로서, CORS 정책 오류로 인해 API 호출이 차단되지 않고 정상적으로 작동하기를 원합니다.

#### Acceptance Criteria

1. WHEN 프론트엔드(vipmobile.vercel.app)에서 백엔드(port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app)로 요청을 보낼 때, THE CORS_Middleware SHALL Access-Control-Allow-Origin 헤더를 올바르게 설정해야 합니다
2. WHEN OPTIONS 프리플라이트 요청이 발생할 때, THE CORS_Middleware SHALL 200 OK 응답과 함께 필요한 CORS 헤더를 반환해야 합니다
3. WHEN 모든 API 엔드포인트(/api/direct/*)에 요청이 발생할 때, THE CORS_Middleware SHALL 일관되게 CORS 헤더를 설정해야 합니다
4. WHEN 허용된 오리진 목록이 업데이트될 때, THE System SHALL 런타임에 동적으로 반영해야 합니다
5. FOR ALL API 응답, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers 헤더가 포함되어야 합니다

### Requirement 4: Discord CDN 이미지 관리 개선

**User Story:** 관리자로서, Discord CDN에 업로드된 이미지가 만료되거나 404 오류가 발생하지 않도록 안정적으로 관리되기를 원합니다.

#### Acceptance Criteria

1. WHEN 이미지 URL이 Discord CDN을 가리킬 때, THE Image_Refresh_Service SHALL 주기적으로 URL 유효성을 검증해야 합니다
2. IF Discord CDN 이미지 URL이 404 오류를 반환하면, THE System SHALL 해당 이미지를 재업로드하고 URL을 업데이트해야 합니다
3. WHEN 이미지가 재업로드될 때, THE System SHALL Google Sheets의 이미지 URL 필드를 새로운 URL로 업데이트해야 합니다
4. WHEN 이미지 URL 검증이 실패할 때, THE System SHALL 로그에 상세한 오류 정보를 기록해야 합니다
5. FOR ALL 단말 모델, 이미지 URL은 항상 유효한 상태를 유지해야 합니다

### Requirement 5: API 호출 최적화 및 성능 개선 (통신사별 처리)

**User Story:** 사용자로서, 통신사별로 API 호출이 최적화되어 서버 부하 없이 빠르고 안정적으로 데이터를 로드하기를 원합니다.

#### Acceptance Criteria

1. WHEN 동일한 API 요청이 짧은 시간 내에 여러 번 발생할 때, THE API_Client SHALL 중복 요청을 제거하고 하나의 요청만 실행해야 합니다
2. WHEN 캐시된 데이터가 존재할 때, THE API_Client SHALL 즉시 캐시 데이터를 반환하고 백그라운드에서 갱신해야 합니다 (SWR 패턴)
3. WHEN Rate Limit 오류(429)가 발생할 때, THE System SHALL 지수 백오프(Exponential Backoff)를 사용하여 재시도해야 합니다
4. WHEN 특정 통신사 데이터만 갱신할 때, THE System SHALL 해당 통신사 데이터만 처리하여 서버 부하를 최소화해야 합니다
5. FOR ALL 통신사별 API 호출, 다른 통신사의 캐시나 데이터에 영향을 주지 않아야 합니다

### Requirement 6: 백그라운드 캐시 갱신 안정화

**User Story:** 개발자로서, 백그라운드 캐시 갱신이 조용히 실행되고 사용자 경험을 방해하지 않기를 원합니다.

#### Acceptance Criteria

1. WHEN 캐시된 데이터가 오래되었을 때(Stale), THE System SHALL 백그라운드에서 조용히 데이터를 갱신해야 합니다
2. WHEN 백그라운드 갱신이 실패할 때, THE System SHALL 오류를 로그에 기록하되 사용자에게는 표시하지 않아야 합니다
3. WHEN 백그라운드 갱신이 진행 중일 때, THE System SHALL 중복 갱신 요청을 방지해야 합니다
4. WHEN 슬라이드쇼가 실행 중일 때, THE System SHALL 가격 데이터만 백그라운드에서 갱신하고 슬라이드를 리셋하지 않아야 합니다
5. FOR ALL 백그라운드 작업, 메인 스레드를 블로킹하지 않아야 합니다

### Requirement 7: 오류 로깅 및 모니터링 개선

**User Story:** 개발자로서, 발생하는 오류를 상세하게 로깅하고 모니터링하여 문제를 빠르게 파악하고 해결하기를 원합니다.

#### Acceptance Criteria

1. WHEN API 오류가 발생할 때, THE System SHALL 오류 타입, 메시지, 스택 트레이스, 요청 정보를 로그에 기록해야 합니다
2. WHEN CORS 오류가 발생할 때, THE System SHALL 요청 오리진, 허용된 오리진 목록, 실패 이유를 로그에 기록해야 합니다
3. WHEN Discord CDN 이미지 404 오류가 발생할 때, THE System SHALL 이미지 URL, 모델 정보, 통신사 정보를 로그에 기록해야 합니다
4. WHEN 백그라운드 캐시 갱신이 실패할 때, THE System SHALL 경고 로그를 남기되 동일한 경고는 1분에 1번만 출력해야 합니다
5. FOR ALL 중요한 작업(이미지 갱신, 마스터 데이터 재빌드), 시작과 완료 시점을 로그에 기록해야 합니다

### Requirement 8: 시세표 갱신 및 이미지 갱신 버튼 UI/UX 개선

**User Story:** 사용자로서, 시세표 갱신 및 이미지 갱신 버튼의 상태를 명확하게 알 수 있고, 진행 상황을 확인할 수 있기를 원합니다.

#### Acceptance Criteria

1. WHEN 시세표 갱신이 진행 중일 때, THE System SHALL 버튼 텍스트를 "갱신 중..."으로 변경하고 로딩 스피너를 표시해야 합니다
2. WHEN 시세표 갱신이 완료되면, THE System SHALL 성공 메시지와 함께 갱신된 항목 수를 표시해야 합니다
3. IF 갱신이 실패하면, THE System SHALL 오류 메시지와 함께 재시도 옵션을 제공해야 합니다
4. WHEN 버튼에 마우스를 올리면, THE System SHALL 툴팁으로 기능 설명을 표시해야 합니다
5. FOR ALL 갱신 작업, 예상 소요 시간을 사용자에게 안내해야 합니다
6. WHEN 이미지 갱신이 완료되면, THE System SHALL 성공한 이미지 수와 실패한 이미지 수를 함께 표시해야 합니다
