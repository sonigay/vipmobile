# Discord 이미지 URL 갱신 기능 진단 보고서

## 📋 진단 일시
2024-12-XX

## ✅ 구현 완료 항목

### 1. Discord 메시지 ID 저장
- ✅ **직영점_모델이미지**: Discord 메시지 ID 저장됨 (I열)
- ✅ **직영점_단말마스터**: Discord 메시지 ID 저장됨 (P열)
- ✅ **직영점_매장사진**: Discord 메시지 ID 저장됨 (각 사진 타입별)
- ✅ **회의모드 슬라이드**: Discord 메시지 ID 저장됨

### 2. URL 갱신 API
- ✅ **GET /api/discord/refresh-image-url**: 구현 완료
  - threadId와 messageId로 최신 URL 조회
  - Discord API를 통한 메시지 조회 및 attachment URL 반환

## ❌ 누락된 기능

### 1. URL 갱신 후 시트 자동 저장
- ❌ 갱신된 URL을 각 시트에 자동으로 저장하는 로직 없음
- ❌ 수동 갱신 API 엔드포인트 없음

### 2. 프론트엔드 자동 갱신
- ❌ 이미지 로드 실패 시 자동으로 URL 갱신하는 로직 없음
- ❌ 갱신된 URL로 이미지 재로드하는 로직 없음

### 3. 각 시트별 갱신 API
- ❌ 직영점_모델이미지 URL 갱신 및 저장 API 없음
- ❌ 직영점_단말마스터 URL 갱신 및 저장 API 없음
- ❌ 직영점_매장사진 URL 갱신 및 저장 API 없음
- ❌ 회의모드 슬라이드 URL 갱신 및 저장 API 없음

## 🔧 구현 필요 사항

### 1. URL 갱신 및 저장 API 엔드포인트
각 시트별로 URL 갱신 후 자동 저장하는 API 필요:
- `POST /api/direct/refresh-mobile-image-url` - 직영점_모델이미지
- `POST /api/direct/refresh-master-image-url` - 직영점_단말마스터
- `POST /api/direct/refresh-store-photo-url` - 직영점_매장사진
- `PATCH /api/meetings/:meetingId/slide-image-url` - 회의모드 (이미 있음)

### 2. 프론트엔드 유틸리티 함수
이미지 로드 실패 시 자동 갱신하는 함수:
- `src/utils/discordImageUtils.js` 생성
- `loadImageWithRefresh(imageUrl, threadId, messageId, onRefresh)` 함수

### 3. 각 컴포넌트에 자동 갱신 적용
- `MobileListRow.js` - 상품 이미지
- `TodaysProductCard.js` - 오늘의 휴대폰 이미지
- `Map.js` - 매장 사진
- `SlideRenderer.js` - 회의 슬라이드 이미지

## 📊 시트별 상세 진단

### 직영점_모델이미지
- **헤더**: HEADERS_MOBILE_IMAGES (A:K)
- **Discord 메시지 ID 위치**: I열
- **Discord 스레드 ID 위치**: K열
- **이미지 URL 위치**: F열
- **상태**: ✅ 메시지 ID 저장됨, ❌ 갱신 후 저장 로직 없음

### 직영점_단말마스터
- **헤더**: HEADERS_MOBILE_MASTER (A:R)
- **Discord 메시지 ID 위치**: P열
- **Discord 스레드 ID 위치**: R열
- **이미지 URL 위치**: M열
- **상태**: ✅ 메시지 ID 저장됨, ❌ 갱신 후 저장 로직 없음

### 직영점_매장사진
- **헤더**: HEADERS_STORE_PHOTO (A:AH)
- **Discord 메시지 ID 위치**: 각 사진 타입별 (2, 6, 10, 14, 18, 22, 26, 30열)
- **Discord 스레드 ID 위치**: 각 사진 타입별 (4, 8, 12, 16, 20, 24, 28, 32열)
- **이미지 URL 위치**: 각 사진 타입별 (1, 5, 9, 13, 17, 21, 25, 29열)
- **상태**: ✅ 메시지 ID 저장됨, ❌ 갱신 후 저장 로직 없음

### 회의모드 슬라이드
- **헤더**: 회의 슬라이드 헤더 (Discord메시지ID 포함)
- **Discord 메시지 ID 위치**: 확인 필요
- **상태**: ✅ 메시지 ID 저장됨, ✅ 갱신 API 있음 (PATCH /api/meetings/:meetingId/slide-image)

## 🎯 구현 우선순위

1. **높음**: 프론트엔드 자동 갱신 유틸리티 함수
2. **높음**: 각 시트별 URL 갱신 및 저장 API
3. **중간**: 각 컴포넌트에 자동 갱신 적용
4. **낮음**: 주기적 자동 갱신 (선택사항)

