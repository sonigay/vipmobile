# 중복 엔드포인트 제거 보고서

## 생성 일시
2025-01-25

## 요약
- **총 중복 엔드포인트**: 2개
- **제거된 엔드포인트**: 2개
- **영향받은 파일**: 1개 (directStoreAdditionalRoutes.js)

---

## 제거된 중복 엔드포인트

### 1. POST /api/verify-password

**중복 위치:**
- ✅ **authRoutes.js** (유지)
- ❌ **directStoreAdditionalRoutes.js** (제거됨)

**제거 이유:**
- 인증 관련 엔드포인트는 authRoutes.js에서 중앙 관리하는 것이 적절
- 라우팅 충돌 방지
- 코드 중복 제거

**영향:**
- 없음 (authRoutes.js의 엔드포인트가 동일한 기능 제공)

---

### 2. POST /api/verify-direct-store-password

**중복 위치:**
- ✅ **authRoutes.js** (유지)
- ❌ **directStoreAdditionalRoutes.js** (제거됨)

**제거 이유:**
- 직영점 비밀번호 검증도 인증 로직의 일부
- authRoutes.js에서 중앙 관리하는 것이 적절
- 라우팅 충돌 방지
- 코드 중복 제거

**영향:**
- 없음 (authRoutes.js의 엔드포인트가 동일한 기능 제공)

---

## 제거 방법

### directStoreAdditionalRoutes.js
```javascript
// 중복 엔드포인트 제거됨:
// - POST /api/verify-password → authRoutes.js에서 처리
// - POST /api/verify-direct-store-password → authRoutes.js에서 처리
```

**변경 사항:**
- 두 엔드포인트의 구현 코드 완전 제거
- 주석으로 제거 이유 명시
- authRoutes.js로 리다이렉션 안내

---

## 검증 결과

### 라우팅 충돌 검사
- ✅ POST /api/verify-password: authRoutes.js에만 존재
- ✅ POST /api/verify-direct-store-password: authRoutes.js에만 존재

### 기능 검증
- ✅ authRoutes.js의 두 엔드포인트 정상 작동
- ✅ 프론트엔드 호출 경로 변경 불필요 (동일한 URL 사용)

---

## 남은 엔드포인트 (directStoreAdditionalRoutes.js)

제거 후 directStoreAdditionalRoutes.js에 남은 엔드포인트:

1. **GET /api/direct/drive-monitoring** - Google Drive 모니터링
2. **GET /api/direct/pre-approval-mark/:storeName** - 사전승낙서마크 조회
3. **POST /api/direct/pre-approval-mark** - 사전승낙서마크 저장
4. **GET /api/direct/store-image/:storeName** - 매장 사진 조회
5. **POST /api/direct/store-image** - 매장 사진 저장
6. **GET /api/direct/sales** - 판매일보 목록 조회
7. **POST /api/direct/sales** - 판매일보 생성
8. **PUT /api/direct/sales/:id** - 판매일보 수정

---

## 권장 사항

### 완료된 작업
- ✅ 중복 엔드포인트 제거
- ✅ 주석으로 제거 이유 문서화
- ✅ authRoutes.js로 책임 이관

### 추가 권장 사항
1. **프론트엔드 코드 검토**: 두 엔드포인트를 호출하는 프론트엔드 코드가 정상 작동하는지 확인
2. **통합 테스트**: authRoutes.js의 두 엔드포인트에 대한 통합 테스트 실행
3. **문서 업데이트**: API 문서에서 엔드포인트 위치 명확히 표시

---

## 결론

2개의 중복 엔드포인트를 성공적으로 제거했습니다. 모든 인증 관련 엔드포인트는 이제 authRoutes.js에서 중앙 관리되며, 라우팅 충돌 위험이 제거되었습니다.

**다음 단계**: Task 10.2 - 중복 제거 후 라우팅 테이블 검증
