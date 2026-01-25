# 모드별 원본 로직 검증 및 수정 프로토콜

## 목적
사용자가 특정 모드에서 문제를 발견했을 때, 해당 모드의 모든 API를 원본 파일과 비교하여 완전히 동일하게 수정하는 표준 절차

## 작업 규칙

### 1. 사용자 요청 형식
```
"[모드명] 원본파일 확인해서 수정해줘"
```

예시:
- "정책모드 원본파일 확인해서 수정해줘"
- "재고모드 원본파일 확인해서 수정해줘"
- "직영점모드 원본파일 확인해서 수정해줘"

### 2. 작업 절차

#### Step 1: 모드 관련 API 엔드포인트 식별
1. 원본 파일(`server/index.js.backup.original`)에서 해당 모드의 모든 API 엔드포인트 검색
2. grepSearch로 관련 키워드 검색
   - 예: 정책모드 → `/api/policies`, `/api/policy`
   - 예: 재고모드 → `/api/inventory`
   - 예: 직영점모드 → `/api/direct`, `/api/customer`

#### Step 2: 각 API별 원본 로직 확인
각 API마다 다음 항목을 원본 파일에서 확인:

1. **시트 이름**
   - 상수 정의 확인 (예: `const POLICY_SHEET_NAME = '정책_기본정보 '`)
   - 하드코딩된 시트 이름 확인

2. **시트 인덱스 (컬럼 위치)**
   - 각 필드가 어느 컬럼에서 읽히는지 확인
   - 예: `row[0]` (A열), `row[23]` (X열), `row[49]` (AX열)

3. **필드 매핑**
   - 원본에서 반환하는 모든 필드 확인
   - 누락된 필드가 없는지 확인

4. **응답 형식**
   - 배열로 반환하는지, 객체로 반환하는지
   - `{ success: true, data: [] }` vs `[]` 직접 반환

5. **필터링 로직**
   - 데이터 필터링 조건 확인
   - 정렬 순서 확인

6. **캐시 설정**
   - 캐시 사용 여부
   - 캐시 TTL (Time To Live)

7. **에러 처리**
   - 에러 메시지 형식
   - 에러 응답 코드

#### Step 3: 현재 구현과 비교
1. 해당 라우터 파일 읽기 (예: `server/routes/policyRoutes.js`)
2. 각 API별로 원본과 차이점 문서화
3. 차이점 목록 작성

#### Step 4: 수정 작업
1. 원본 로직을 정확히 복사
2. 팩토리 함수 패턴 유지 (`createXxxRoutes(context)`)
3. 주석으로 원본 파일 위치 표시
   ```javascript
   // 원본: server/index.js.backup.original (27433-27850줄)
   ```

#### Step 5: 검증
1. 로컬 서버 시작 확인
2. 모든 라우트 마운트 확인
3. Git 커밋 및 푸시

#### Step 6: 문서화
1. 수정 내역을 마크다운 파일로 작성
2. 파일명: `.kiro/specs/server-endpoint-recovery/[모드명]-verification-[날짜].md`
3. 내용:
   - 수정된 API 목록
   - 각 API별 변경 사항
   - 원본 파일 참조 위치

## 검증 체크리스트

각 API마다 다음 항목을 확인:

- [ ] 시트 이름이 원본과 동일한가?
- [ ] 모든 컬럼 인덱스가 원본과 동일한가?
- [ ] 모든 필드가 매핑되었는가?
- [ ] 응답 형식이 원본과 동일한가?
- [ ] 필터링 로직이 원본과 동일한가?
- [ ] 캐시 설정이 원본과 동일한가?
- [ ] 에러 처리가 원본과 동일한가?
- [ ] 주석으로 원본 위치가 표시되었는가?

## 모드별 주요 API 매핑

### 정책모드 (PolicyMode)
- **라우터 파일**: `server/routes/policyRoutes.js`
- **주요 API**:
  - `GET /api/policies` - 정책 목록 조회
  - `POST /api/policies` - 정책 생성
  - `PUT /api/policies/:policyId` - 정책 수정
  - `DELETE /api/policies/:policyId` - 정책 삭제
  - `PUT /api/policies/:policyId/approve` - 정책 승인
  - `PUT /api/policies/:policyId/cancel` - 정책 취소
  - `GET /api/policies/shoe-counting` - 구두정책 카운팅
- **관련 시트**: `정책_기본정보 `, `폰클출고처데이터`

### 재고모드 (InventoryMode)
- **라우터 파일**: `server/routes/inventoryRoutes.js`
- **주요 API**:
  - `GET /api/inventory` - 재고 목록 조회
  - `GET /api/inventory/agent-filters` - 담당자 필터 목록
  - `GET /api/inventory/summary` - 재고 요약
- **관련 시트**: `폰클재고데이터`, `폰클개통데이터`

### 직영점모드 (DirectStoreMode)
- **라우터 파일**: `server/routes/directRoutes.js`, `server/directRoutes.js`
- **주요 API**:
  - `GET /api/direct/customer-queue` - 구매대기 목록
  - `GET /api/direct/board` - 게시판 목록
  - `POST /api/direct/upload-image` - 이미지 업로드
- **관련 시트**: `직영점_구매대기`, `직영점_게시판`, `직영점_매장사진`

### 정산모드 (SettlementMode)
- **라우터 파일**: `server/routes/settlementRoutes.js` (존재 여부 확인 필요)
- **주요 API**: TBD
- **관련 시트**: TBD

### 검수모드 (InspectionMode)
- **라우터 파일**: `server/routes/inspectionRoutes.js`
- **주요 API**: TBD
- **관련 시트**: `검수결과`, `여직원검수데이터메모`, `검수설정`

### 예약모드 (ReservationMode)
- **라우터 파일**: `server/routes/reservationRoutes.js`
- **주요 API**: TBD
- **관련 시트**: `사전예약사이트`

### 회의모드 (MeetingMode)
- **라우터 파일**: `server/meetingRoutes.js`
- **주요 API**: TBD
- **관련 시트**: TBD

### OB관리모드 (ObManagementMode)
- **라우터 파일**: `server/obRoutes.js`
- **주요 API**: TBD
- **관련 시트**: TBD

## 작업 템플릿

### 비교 문서 템플릿
```markdown
# [모드명] API 원본 비교 및 수정

## 작업 일시
- 날짜: YYYY-MM-DD
- 작업자: AI Assistant

## 수정된 API 목록

### 1. [API 엔드포인트]
- **원본 위치**: server/index.js.backup.original (줄번호)
- **현재 파일**: server/routes/xxxRoutes.js
- **상태**: ✅ 수정 완료 / ⚠️ 부분 수정 / ❌ 미수정

#### 변경 사항
1. **시트 이름**
   - 변경 전: `xxx`
   - 변경 후: `yyy`

2. **컬럼 인덱스**
   - 변경 전: `row[10]`
   - 변경 후: `row[15]`

3. **필드 매핑**
   - 추가된 필드: `manager` (AX열, row[49])
   - 삭제된 필드: 없음

4. **응답 형식**
   - 변경 전: `{ success: true, data: [] }`
   - 변경 후: `[]` 직접 반환

#### 원본 로직 (요약)
```javascript
// 핵심 로직만 발췌
```

#### 수정 후 로직 (요약)
```javascript
// 핵심 로직만 발췌
```

---

## 검증 결과
- [ ] 로컬 테스트 완료
- [ ] 모든 라우트 마운트 확인
- [ ] Git 커밋 완료
- [ ] 배포 완료

## 참고사항
- 추가 수정이 필요한 부분
- 알려진 이슈
```

## 자동화 가능한 부분

향후 스크립트로 자동화할 수 있는 작업:
1. 원본 파일에서 특정 모드의 모든 API 엔드포인트 추출
2. 각 API의 시트 이름 추출
3. 각 API의 컬럼 인덱스 추출
4. 현재 구현과 자동 비교

## 주의사항

1. **원본 파일 직접 읽기 금지**
   - `server/index.js.backup.original`는 40000줄이므로 grepSearch만 사용
   - 필요한 부분만 readFile로 100-200줄씩 읽기

2. **팩토리 함수 패턴 유지**
   - 모든 라우터는 `createXxxRoutes(context)` 형태
   - `context`에서 `sheetsClient`, `cacheManager`, `rateLimiter` 사용

3. **에러 처리 일관성**
   - 원본과 동일한 에러 메시지 사용
   - 원본과 동일한 HTTP 상태 코드 사용

4. **캐시 정책 유지**
   - 원본과 동일한 캐시 TTL 사용
   - 캐시 키 네이밍 일관성 유지

5. **로깅 일관성**
   - 원본과 유사한 로그 메시지 사용
   - 디버깅에 필요한 정보 포함

## 예시: 정책모드 검증 작업

### 사용자 요청
```
정책모드 원본파일 확인해서 수정해줘
```

### AI 작업 순서
1. grepSearch로 `/api/policies` 관련 모든 엔드포인트 찾기
2. 각 엔드포인트별로 원본 로직 확인 (100-200줄씩)
3. `server/routes/policyRoutes.js` 읽기
4. 차이점 문서화
5. 원본 로직으로 수정
6. 로컬 테스트
7. Git 커밋 및 푸시
8. 수정 내역 문서 작성

## 버전 관리

- **문서 버전**: 1.0
- **작성일**: 2025-01-25
- **최종 수정일**: 2025-01-25
