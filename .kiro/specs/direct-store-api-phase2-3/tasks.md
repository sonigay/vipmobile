# Tasks

## Phase 0: 재빌드 및 스케줄러 검증

- [x] 0.1 재빌드 함수 Supabase 쓰기 검증
  _Requirements: 1.1_
  - `rebuildPlanMaster()` 함수: Feature Flag 확인, Supabase 쓰기 로직 확인, Google Sheets 폴백 확인
  - `rebuildDeviceMaster()` 함수: Feature Flag 확인, Supabase 쓰기 로직 확인, Google Sheets 폴백 확인
  - `rebuildPricingMaster()` 함수: Feature Flag 확인, Supabase 쓰기 로직 확인, Google Sheets 폴백 확인

- [x] 0.2 스케줄러 복원 (원본 로직 기반)
  _Requirements: 1.2_
  - `server/index.js`에 `node-cron` import 추가
  - Discord 이미지 자동 갱신 스케줄 추가 (매일 03:30, 07:30, 11:30, 17:30, 20:30, 23:30, 타임존: Asia/Seoul)
  - 데이터 재빌드 스케줄 추가 (매일 11:10-19:10 매시간, 타임존: Asia/Seoul)
  - 서버 시작 시 초기 실행 (Discord 이미지 갱신, 데이터 재빌드)
  - `refreshAllDiscordImages()` 함수 구현 (모든 통신사 이미지 갱신, 에러 핸들링, Discord 알림)
  - `rebuildMasterData()` 함수 구현 (모든 통신사 마스터 데이터 재빌드, 에러 핸들링, Discord 알림)
  - 스케줄 실행 로그 추가 (시작/완료/에러)

- [x] 0.3 재빌드 버튼 테스트
  _Requirements: 1.1_
  - 직영점관리모드에서 "데이터 재빌드" 버튼 테스트 (SK, KT, LG, 전체)
  - Supabase 데이터 확인 (`직영점_요금제마스터`, `직영점_단말마스터`, `직영점_단말요금정책`)
  - Google Sheets 폴백 테스트 (Feature Flag를 `false`로 설정 후 재빌드 실행)

- [x] 0.4 시세표 갱신 버튼 테스트
  _Requirements: 1.3_
  - 직영점관리모드에서 "시세표 갱신하기" 버튼 테스트 (SK, KT, LG)
  - Discord에서 이미지 URL 가져오기 확인
  - `직영점_모델이미지` 테이블 업데이트 확인
  - 시세표에서 이미지 표시 확인

- [x] 0.5 스케줄러 동작 확인
  _Requirements: 1.4_
  - Discord 이미지 자동 갱신 스케줄 실행 로그 확인
  - 데이터 재빌드 스케줄 실행 로그 확인
  - Supabase 데이터 업데이트 확인

- [x] 0.6 성능 최적화 - Google Sheets Rate Limit 로직 제거
  _Requirements: 1.5_
  - `withRetry()` 함수를 `withRetrySupabase()`와 `withRetryGoogleSheets()`로 분리
  - `withRetrySupabase()`: 딜레이 없음, 재시도만 지원 (네트워크 에러 대응)
  - `withRetryGoogleSheets()`: 기존 Rate Limit 로직 유지 (MIN_API_INTERVAL_MS, MAX_CONCURRENT_SHEETS_REQUESTS)
  - Supabase를 사용하는 API에서 `withRetrySupabase()` 사용
  - Google Sheets를 사용하는 API에서 `withRetryGoogleSheets()` 사용
  - 영향 받는 API: 정책 설정, 링크 설정, 메인 페이지 문구, 요금제 마스터, 단말 마스터, 오늘의 휴대폰, 대중교통 위치

- [x] 0.7 시세표 이미지 로드 문제 수정
  _Requirements: 1.6_
  - `server/index.js.backup.original`의 이미지 로드 로직 분석 (line 6288-6400)
  - `server/directRoutes.js`의 현재 이미지 로드 로직 분석 (line 4900-5100, `getMobileList()` 함수)
  - 차이점 파악 및 문제 원인 규명
  - `getMobileList()` 함수의 이미지 매핑 로직 수정
  - 이미지 URL 정규화 로직 확인
  - Discord 메시지 ID 매핑 확인
  - 시세표에서 이미지 로드 테스트 (SK, KT, LG)
  - 브라우저 콘솔 에러 확인

## Phase 1: Phase 1 보완 - 읽기 전용 API에 쓰기/수정/삭제 추가

- [x] 1.1 정책 설정 API 보완
  _Requirements: 2.1_
  - DirectStoreDAL에 삭제 메서드 추가: `deletePolicyMargin()`, `deletePolicyAddonServices()`, `deletePolicyInsurance()`, `deletePolicySpecial()`
  - directRoutes.js에 삭제 API 추가: `DELETE /api/direct/policy-settings/margin/:carrier`, `DELETE /api/direct/policy-settings/addon/:carrier`, `DELETE /api/direct/policy-settings/insurance/:carrier`, `DELETE /api/direct/policy-settings/special/:carrier`

- [x] 1.2 링크 설정 API 보완
  _Requirements: 2.2_
  - DirectStoreDAL에 삭제 메서드 추가: `deleteLinkSettings(carrier, settingType)`
  - directRoutes.js에 삭제 API 추가: `DELETE /api/direct/link-settings/:carrier/:settingType`

- [x] 1.3 메인 페이지 문구 API 보완
  _Requirements: 2.3_
  - DirectStoreDAL에 삭제 메서드 추가: `deleteMainPageText(carrier)`
  - directRoutes.js에 삭제 API 추가: `DELETE /api/direct/main-page-text/:carrier`

- [x] 1.4 요금제 마스터 API 보완
  _Requirements: 2.4_
  - DirectStoreDAL에 CRUD 메서드 추가: `createPlanMaster()`, `updatePlanMaster()`, `deletePlanMaster()`
  - directRoutes.js에 CRUD API 추가: `POST /api/direct/plans-master`, `PUT /api/direct/plans-master/:carrier/:planName`, `DELETE /api/direct/plans-master/:carrier/:planName`

- [x] 1.5 단말 마스터 API 보완
  _Requirements: 2.5_
  - DirectStoreDAL에 CRUD 메서드 추가: `createDeviceMaster()`, `updateDeviceMaster()`, `deleteDeviceMaster()`
  - directRoutes.js에 CRUD API 추가: `POST /api/direct/mobiles-master`, `PUT /api/direct/mobiles-master/:carrier/:modelId`, `DELETE /api/direct/mobiles-master/:carrier/:modelId`

- [x] 1.6 단말 요금정책 API 보완
  _Requirements: 2.6_
  - DirectStoreDAL에 CRUD 메서드 추가: `createPricingMaster()`, `updatePricingMaster()`, `deletePricingMaster()`
  - directRoutes.js에 CRUD API 추가: `POST /api/direct/mobiles-pricing`, `PUT /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType`, `DELETE /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType`

- [x] 1.7 오늘의 휴대폰 API 보완
  _Requirements: 2.7_
  - DirectStoreDAL에 생성 메서드 추가: `createTodaysMobile(mobileData)`
  - directRoutes.js에 생성 API 추가: `POST /api/direct/todays-mobiles`

## Phase 2: 복잡한 읽기 API 전환

- [x] 2.1 시세표 조회 API 전환
  _Requirements: 3.1_
  - `GET /api/direct/mobiles-pricing` 분석 (현재 Google Sheets 로직, 필요한 조인 및 필터링 로직 파악)
  - DirectStoreDAL 메서드 구현: `getMobilePricing(carrier, filters)` (복잡한 조인 쿼리 작성)
  - API 전환 (Feature Flag 적용, Google Sheets 폴백 유지)

- [x] 2.2 시세표 마스터 조회 API 전환
  _Requirements: 3.2_
  - `GET /api/direct/mobiles-master` 분석 (현재 Google Sheets 로직, 필요한 조인 및 필터링 로직 파악)
  - DirectStoreDAL 메서드 구현: `getMobileMaster(carrier, filters)` (복잡한 조인 쿼리 작성)
  - API 전환 (Feature Flag 적용, Google Sheets 폴백 유지)

## Phase 3: 테스트 및 검증

- [x] 3.1 단위 테스트
  _Requirements: 4.1_
  - DirectStoreDAL 메서드 단위 테스트 작성
  - API 엔드포인트 단위 테스트 작성

- [x] 3.2 통합 테스트
  _Requirements: 4.2_
  - 전체 CRUD 플로우 테스트
  - Feature Flag 전환 테스트 (Supabase ↔ Google Sheets)

- [x] 3.3 E2E 테스트
  _Requirements: 4.3_
  - 프론트엔드에서 시세표 조회 테스트
  - 프론트엔드에서 데이터 수정 테스트
  - 프론트엔드에서 데이터 삭제 테스트
