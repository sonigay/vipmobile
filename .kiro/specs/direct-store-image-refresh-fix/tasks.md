# Implementation Plan: 직영점모드 휴대폰시세표 이미지 갱신 및 API 오류 수정

## Overview

이 구현 계획은 직영점모드 휴대폰시세표의 이미지 갱신 기능 실패 및 API 오류 문제를 해결하기 위한 단계별 작업을 정의합니다. 주요 목표는 통신사별 독립적인 데이터 재빌드, Discord 메시지 ID를 통한 이미지 갱신, CORS 오류 해결, API 초기화 오류 수정입니다.

## Tasks

- [x] 1. API 초기화 오류 수정
  - [x] 1.1 directStoreApiClient 변수 초기화 순서 수정
    - `src/api/directStoreApiClient.js` 파일에서 변수 초기화 순서 재구성
    - 순환 참조 제거: 헬퍼 함수 → 캐시/큐 → smartFetch → API 클라이언트 순서로 정의
    - ReferenceError 발생 가능성 제거
    - _Requirements: 2.1, 2.2_
  
  - [ ]* 1.2 API 초기화 오류 테스트 작성
    - 모든 API 함수 (getMobilesMaster, getPlansMaster, getMobilesPricing, getPolicySettings) 호출 테스트
    - 초기화 오류 없이 정상 응답 확인
    - _Requirements: 2.2_

- [x] 2. CORS 미들웨어 강화
  - [x] 2.1 CORS 헤더 설정 개선
    - `server/corsMiddleware.js`에서 모든 요청에 CORS 헤더 설정 보장
    - 오류 발생 시에도 기본 CORS 헤더 설정 (폴백 메커니즘)
    - OPTIONS 프리플라이트 요청 처리 개선
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 2.2 CORS 미들웨어 테스트 작성
    - 모든 API 엔드포인트에 대한 CORS 헤더 존재 확인
    - OPTIONS 요청 처리 테스트
    - _Requirements: 3.5_

- [x] 3. 백엔드: 통신사별 마스터 데이터 재빌드 API 구현
  - [x] 3.1 rebuildMaster 엔드포인트 수정
    - `server/directRoutes.js`에 `POST /api/direct/rebuild-master?carrier=SK` 엔드포인트 추가/수정
    - carrier 파라미터 검증 (SK, KT, LG만 허용)
    - rebuildDeviceMaster, rebuildPlanMaster, rebuildPricingMaster 함수 호출
    - 통신사별 독립 처리로 서버 부하 감소
    - _Requirements: 1.1, 5.4_
  
  - [x] 3.2 rebuildDeviceMaster 함수 개선
    - 통신사 필터링 추가 (해당 통신사 데이터만 처리)
    - Google Sheets API Rate Limit 고려 (기존 메커니즘 활용)
    - 성공/실패 카운트 반환
    - _Requirements: 1.1_
  
  - [ ]* 3.3 마스터 데이터 재빌드 테스트 작성
    - 통신사별 재빌드 성공 테스트
    - 잘못된 carrier 파라미터 처리 테스트
    - _Requirements: 1.1_

- [x] 4. 백엔드: Discord 메시지 ID를 통한 이미지 갱신 API 구현
  - [x] 4.1 refreshImagesFromDiscord 함수 구현
    - `server/directRoutes.js`에 refreshImagesFromDiscord(carrier) 함수 추가
    - 직영점_모델이미지 시트에서 Discord 메시지 ID 조회
    - Discord API를 통해 최신 이미지 URL 가져오기
    - Google Sheets batchUpdate API 사용 (50개씩 배치 처리)
    - 배치 간 1초 지연으로 Rate Limit 방지
    - _Requirements: 1-1.2, 1-1.3, 4.2, 4.3_
  
  - [x] 4.2 fetchImageUrlFromDiscordMessage 함수 구현
    - Discord API를 통해 메시지 조회
    - 첨부 파일에서 이미지 URL 추출
    - 오류 처리 및 로깅
    - _Requirements: 1-1.2_
  
  - [x] 4.3 refresh-images-from-discord 엔드포인트 추가
    - `POST /api/direct/refresh-images-from-discord?carrier=SK` 엔드포인트 추가
    - carrier 파라미터 검증
    - refreshImagesFromDiscord 함수 호출
    - 성공/실패 이미지 목록 반환
    - _Requirements: 1-1.1, 1-1.4_
  
  - [ ]* 4.4 이미지 갱신 API 테스트 작성
    - Discord API 모킹
    - 이미지 URL 갱신 성공 테스트
    - Discord 메시지 ID 없는 경우 처리 테스트
    - _Requirements: 1-1.5_

- [x] 5. 프론트엔드: directStoreApiClient 메서드 추가
  - [x] 5.1 rebuildMaster 메서드 추가
    - `src/api/directStoreApiClient.js`에 rebuildMaster(carrier) 메서드 추가
    - smartFetch를 사용하여 `/api/direct/rebuild-master` 호출
    - 오류 처리 및 재시도 로직
    - _Requirements: 1.1_
  
  - [x] 5.2 refreshImagesFromDiscord 메서드 추가
    - refreshImagesFromDiscord(carrier) 메서드 추가
    - smartFetch를 사용하여 `/api/direct/refresh-images-from-discord` 호출
    - 오류 처리 및 재시도 로직
    - _Requirements: 1-1.1_
  
  - [x] 5.3 통신사별 캐시 관리 메서드 추가
    - clearCacheByCarrier(carrier) 메서드 추가: 해당 통신사 캐시만 무효화
    - clearImageCache(carrier) 메서드 추가: 해당 통신사 이미지 캐시만 무효화
    - clearCache() 메서드 유지: 전체 캐시 무효화
    - _Requirements: 5.1, 5.5_

- [x] 6. 프론트엔드: MobileListTab 컴포넌트 수정
  - [x] 6.1 handleReload 함수 개선 (시세표 갱신)
    - `src/components/direct/MobileListTab.js`의 handleReload 함수 수정
    - directStoreApiClient.rebuildMaster(carrier) 호출
    - 성공 시 clearCacheByCarrier(carrier) 호출
    - reloadTrigger 증가로 데이터 재로드
    - 성공/실패 메시지 표시
    - _Requirements: 1.1, 1.3, 1.4_
  
  - [x] 6.2 handleRefreshAllImages 함수 개선 (이미지 갱신)
    - 기존 개별 API 호출 방식을 통신사별 일괄 처리로 변경
    - directStoreApiClient.refreshImagesFromDiscord(carrier) 호출
    - 성공 시 clearImageCache(carrier) 호출
    - reloadTrigger 증가로 데이터 재로드
    - 성공/실패 이미지 수 표시
    - _Requirements: 1-1.1, 1-1.3, 1-1.4_
  
  - [x] 6.3 버튼 텍스트 변경
    - "새로고침" 버튼 → "시세표갱신하기" 버튼으로 텍스트 변경
    - 툴팁 추가: "해당 통신사의 마스터 데이터를 재빌드합니다"
    - _Requirements: 8.1, 8.4_

- [x] 7. 오류 로깅 및 모니터링 개선
  - [x] 7.1 백엔드 오류 로깅 강화
    - API 오류 발생 시 상세 정보 로깅 (오류 타입, 메시지, 스택 트레이스, 요청 정보)
    - CORS 오류 발생 시 요청 오리진, 허용된 오리진 목록, 실패 이유 로깅
    - Discord CDN 이미지 404 오류 발생 시 이미지 URL, 모델 정보, 통신사 정보 로깅
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 7.2 로그 빈도 제한 적용
    - 동일한 경고 로그는 1분에 1번만 출력 (logWarningOnce 함수 활용)
    - 백그라운드 캐시 갱신 실패 시 경고 로그 빈도 제한
    - _Requirements: 7.4_
  
  - [x] 7.3 중요 작업 로깅 추가
    - 이미지 갱신 시작/완료 시점 로깅
    - 마스터 데이터 재빌드 시작/완료 시점 로깅
    - 소요 시간 측정 및 로깅
    - _Requirements: 7.5_

- [x] 8. 최종 통합 테스트 및 검증
  - [x] 8.1 시세표 갱신 기능 E2E 테스트
    - 사용자가 "시세표갱신하기" 버튼 클릭
    - 로딩 인디케이터 표시 확인
    - 성공 메시지 및 갱신된 항목 수 표시 확인
    - UI에 새 데이터 반영 확인
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 8.2 이미지 갱신 기능 E2E 테스트
    - 사용자가 "이미지갱신하기" 버튼 클릭
    - 로딩 인디케이터 표시 확인
    - 성공/실패 이미지 수 표시 확인
    - UI에 새 이미지 반영 확인
    - _Requirements: 1-1.1, 1-1.3, 1-1.6_
  
  - [x] 8.3 CORS 오류 해결 확인
    - 프론트엔드에서 백엔드 API 호출 시 CORS 오류 없음 확인
    - 모든 API 엔드포인트에 대한 CORS 헤더 존재 확인
    - _Requirements: 3.1, 3.3, 3.5_
  
  - [x] 8.4 API 초기화 오류 해결 확인
    - 페이지 로드 시 ReferenceError 발생하지 않음 확인
    - 모든 API 호출이 정상적으로 작동함 확인
    - _Requirements: 2.1, 2.2, 2.5_

- [ ] 9. 최종 점검 및 문서화
  - 모든 테스트 통과 확인
  - 성능 측정 (API 호출 횟수, 재빌드 소요 시간)
  - 사용자에게 변경사항 안내

## Notes

- 태스크는 순차적으로 진행하되, 독립적인 작업은 병렬 처리 가능
- 각 태스크는 특정 요구사항을 검증하며, 요구사항 번호가 명시되어 있음
- `*` 표시된 태스크는 선택적 (테스트 관련)
- Google Sheets API Rate Limit을 항상 고려하여 구현
- Discord API Rate Limit도 고려하여 요청 간 지연 추가
- 기존 API는 유지하면서 새로운 API 추가 (점진적 개선)
