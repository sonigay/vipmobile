# Implementation Plan: API URL Centralization

## Overview

이 구현 계획은 VIP Map Application의 API URL 중앙화를 위한 단계별 작업을 정의합니다. 모든 하드코딩된 API URL을 제거하고 `src/api.js`의 `API_BASE_URL`을 단일 진실 공급원으로 확립합니다.

## Tasks

- [x] 1. Frontend 하드코딩 제거 - PolicyService
  - `src/utils/policyService.js` 파일 수정
  - 1번째 줄의 하드코딩된 `API_URL` 선언 제거
  - `src/api.js`에서 `API_BASE_URL` import 추가
  - 모든 `API_URL` 참조를 `API_BASE_URL`로 변경
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Frontend 하드코딩 제거 - PolicyMode
  - [x] 2.1 PolicyMode 컴포넌트 수정
    - `src/components/PolicyMode.js` 파일 수정
    - 파일 상단에 `import { API_BASE_URL } from '../api';` 추가
    - Line 391 (`handleNoticeSave` 함수): 하드코딩된 URL 선언 제거
    - Line 444 (`handleNoticeDelete` 함수): 하드코딩된 URL 선언 제거
    - Line 768 (`handleDeleteClick` 함수): 하드코딩된 URL 선언 제거
    - 모든 함수에서 `API_BASE_URL` 직접 사용
    - _Requirements: 1.1, 1.2, 2.2_
  
  - [ ]* 2.2 PolicyMode 단위 테스트 작성
    - `src/components/__tests__/PolicyMode.test.js` 생성
    - API_BASE_URL import 확인 테스트
    - 하드코딩된 URL 부재 확인 테스트
    - _Requirements: 2.1_

- [x] 3. Frontend 하드코딩 제거 - BudgetMode
  - [x] 3.1 BudgetMode 컴포넌트 수정
    - `src/components/BudgetMode.js` 파일 수정
    - 파일 상단에 `import { API_BASE_URL } from '../api';` 추가
    - Line 605 (`handleRecalculateAll` 함수): 하드코딩된 URL 선언 제거
    - `API_BASE_URL` 직접 사용
    - _Requirements: 1.1, 1.2, 2.3_
  
  - [ ]* 3.2 BudgetMode 단위 테스트 작성
    - `src/components/__tests__/BudgetMode.test.js` 생성
    - API_BASE_URL import 확인 테스트
    - 하드코딩된 URL 부재 확인 테스트
    - _Requirements: 2.3_

- [x] 4. Frontend 하드코딩 제거 - ActivationInfoPage
  - [x] 4.1 ActivationInfoPage 컴포넌트 수정
    - `src/components/ActivationInfoPage.js` 파일 수정
    - 파일 상단에 `import { API_BASE_URL } from '../api';` 추가
    - Line 87 (`loadEditData` 함수): 하드코딩된 URL 선언 제거
    - `API_BASE_URL` 직접 사용
    - _Requirements: 1.1, 1.2, 2.4_
  
  - [ ]* 4.2 ActivationInfoPage 단위 테스트 작성
    - `src/components/__tests__/ActivationInfoPage.test.js` 생성
    - API_BASE_URL import 확인 테스트
    - 하드코딩된 URL 부재 확인 테스트
    - _Requirements: 2.4_

- [x] 5. Checkpoint - Frontend 변경사항 검증
  - 모든 프론트엔드 파일 수정 완료 확인
  - 로컬에서 `npm start` 실행하여 동작 확인
  - 브라우저 콘솔에서 API 요청 정상 작동 확인
  - 사용자에게 질문이 있으면 문의

- [x] 6. API Configuration 검증 로직 추가
  - [x] 6.1 URL 검증 함수 구현
    - `src/api.js` 파일 수정
    - `validateURL` 함수 추가 (URL 형식 검증)
    - 환경 변수 검증 로직 추가
    - 잘못된 URL 시 경고 로그 출력
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 6.2 API Configuration 단위 테스트 작성
    - `src/__tests__/api.test.js` 생성
    - 환경 변수 설정 시 사용 확인 테스트
    - 환경 변수 미설정 시 기본값 사용 확인 테스트
    - 잘못된 URL 형식 처리 테스트
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Backend CORS 설정 업데이트
  - [x] 7.1 환경 변수 문서 작성
    - `.kiro/specs/api-url-centralization/ENV_SETUP.md` 생성
    - Frontend 환경 변수 설명 (`REACT_APP_API_URL`)
    - Backend 환경 변수 설명 (`ALLOWED_ORIGINS`)
    - 각 배포 환경별 설정 예시 작성
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 7.2 Cloudtype 환경 변수 설정
    - Cloudtype 대시보드에서 `ALLOWED_ORIGINS` 환경 변수 추가
    - 실제 배포 URL 포함:
      - `https://vipmobile.vercel.app`
      - `https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app`
      - `https://vipmobile-backend.cloudtype.app`
      - `http://localhost:3000`
    - 서버 재시작
    - 로그에서 CORS 설정 확인
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 8. Checkpoint - Backend CORS 검증
  - Vercel 배포된 프론트엔드에서 API 요청 테스트
  - 브라우저 콘솔에서 CORS 오류 없는지 확인
  - 백엔드 로그에서 허용된 오리진 확인
  - 사용자에게 질문이 있으면 문의

- [x] 9. Android 앱 설정 중앙화
  - [x] 9.1 build.gradle 수정
    - `android-app/app/build.gradle` 파일 수정
    - `buildConfigField`로 `API_BASE_URL` 추가
    - debug/release 빌드 타입별 URL 설정
    - _Requirements: 6.1, 6.2_
  
  - [x] 9.2 MainActivity.kt 수정
    - `android-app/app/src/main/java/com/vipplus/manager/MainActivity.kt` 수정
    - 하드코딩된 `defaultUrl` 제거
    - `BuildConfig.API_BASE_URL` 사용
    - 에러 처리 추가 (BuildConfig 로드 실패 시)
    - _Requirements: 6.1, 6.3_
  
  - [ ]* 9.3 Android 빌드 테스트
    - Debug 빌드 생성 및 API 요청 테스트
    - Release 빌드 생성 및 API 요청 테스트
    - 로그에서 사용된 API URL 확인
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. 통합 테스트 작성
  - [ ]* 10.1 하드코딩 검증 테스트
    - `src/__tests__/no-hardcoded-urls.test.js` 생성
    - 모든 파일에서 하드코딩된 URL 검색
    - `api.js` 외 파일에서 발견 시 테스트 실패
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 10.2 Import 일관성 테스트
    - `src/__tests__/import-consistency.test.js` 생성
    - 모든 파일이 `api.js`에서 import하는지 확인
    - 런타임에 동일한 URL 값 사용하는지 확인
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 10.3 CORS 통합 테스트
    - `server/__tests__/cors-integration.test.js` 생성
    - 허용된 오리진에서 요청 시 성공 확인
    - 허용되지 않은 오리진에서 요청 시 403 확인
    - _Requirements: 3.1, 3.2, 3.3_

- [-] 11. Checkpoint - 전체 테스트 실행
  - 모든 단위 테스트 실행: `npm test`
  - 모든 통합 테스트 실행
  - 테스트 커버리지 확인
  - 실패한 테스트 수정
  - 사용자에게 질문이 있으면 문의

- [~] 12. 문서화 및 배포 가이드 작성
  - [x] 12.1 배포 가이드 업데이트
    - `docs/배포가이드.md` 업데이트 (또는 생성)
    - Frontend 배포 시 환경 변수 설정 방법
    - Backend 배포 시 환경 변수 설정 방법
    - Android 앱 빌드 시 설정 방법
    - _Requirements: 4.1, 4.2, 4.3, 6.4_
  
  - [x] 12.2 개발자 온보딩 문서 업데이트
    - `docs/개발자가이드.md` 업데이트 (또는 생성)
    - API URL 설정 방법 설명
    - 로컬 개발 환경 설정 가이드
    - 트러블슈팅 섹션 추가
    - _Requirements: 4.1, 4.2, 4.3_

- [~] 13. 최종 검증 및 배포
  - [~] 13.1 로컬 환경 최종 테스트
    - 모든 모드에서 API 요청 정상 작동 확인
    - 브라우저 콘솔 오류 없는지 확인
    - 네트워크 탭에서 올바른 URL 사용 확인
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [~] 13.2 Vercel 배포 및 테스트
    - Frontend를 Vercel에 배포
    - 배포된 URL에서 전체 기능 테스트
    - CORS 오류 없는지 확인
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [~] 13.3 Cloudtype 배포 및 테스트
    - Backend를 Cloudtype에 배포
    - 환경 변수 설정 확인
    - 로그에서 CORS 설정 확인
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [~] 13.4 Android 앱 배포 (선택사항)
    - Release 빌드 생성
    - 실제 기기에서 테스트
    - API 요청 정상 작동 확인
    - _Requirements: 6.1, 6.2, 6.3_

- [~] 14. 최종 Checkpoint - 완료 확인
  - 모든 요구사항 충족 확인
  - 모든 테스트 통과 확인
  - 문서 완성도 확인
  - 사용자에게 최종 승인 요청

## Notes

- 작업은 순차적으로 진행하며, 각 Checkpoint에서 검증 후 다음 단계로 진행
- `*` 표시된 작업은 선택사항이며, 빠른 MVP를 위해 건너뛸 수 있음
- Frontend 작업(1-6)은 Backend 작업(7-8)과 독립적으로 진행 가능
- Android 작업(9)은 Frontend/Backend 작업과 독립적으로 진행 가능
- 각 파일 수정 후 즉시 로컬 테스트를 수행하여 문제 조기 발견
- CORS 설정 변경 시 반드시 서버 재시작 필요
