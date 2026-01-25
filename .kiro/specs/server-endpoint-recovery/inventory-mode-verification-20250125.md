# 재고 관리 모드 원본 검증 및 수정

**작업일시**: 2025-01-25  
**작업자**: Kiro AI  
**프로토콜**: MODE_VERIFICATION_PROTOCOL v1.1

## 작업 개요

재고 관리 모드(InventoryMode)의 모든 API를 원본 파일(`server/index.js.backup.original`)과 비교하여 정확한 로직으로 수정합니다.

## Step 1: 원본 파일에서 API 검색

### 검색 결과

원본 파일에서 발견된 재고 관리 관련 API:

1. **GET /api/inventory/assignment-status** (9291-9630줄)
2. **POST /api/inventory/save-assignment** (9630-9930줄)
3. **GET /api/inventory/normalized-status** (9930-10080줄)
4. **POST /api/inventory/manual-assignment** (10080-10276줄)
5. **GET /api/inventory/activation-status** (10276줄~)
6. **GET /api/inventory-analysis** (26288줄~)
7. **GET /api/inventory/status** (30114줄~)
8. **GET /api/inventory/agent-filters** (30286줄~) - ✅ 이미 수정됨 (커밋 070b3fcd)
9. **GET /api/inventory/status-by-color** (30394줄~)
10. **GET /api/inventory-recovery/data** (36286줄~)
11. **POST /api/inventory-recovery/update-status** (36425줄~)
12. **POST /api/inventory-recovery/priority-models** (36514줄~)
13. **GET /api/inventory-recovery/priority-models** (36593줄~)
14. **POST /api/inventory-inspection** (38024줄~)
15. **GET /api/inventoryRecoveryAccess** (3256줄~)

## Step 2: 현재 구현 확인

### 현재 `inventoryRoutes.js`에 구현된 API

1. ✅ GET /api/inventory/assignment-status - **로직 완전히 다름**
2. ✅ POST /api/inventory/save-assignment - **로직 완전히 다름**
3. ✅ GET /api/inventory/normalized-status - **로직 완전히 다름**
4. ✅ POST /api/inventory/manual-assignment - **로직 완전히 다름**
5. ✅ GET /api/inventory/activation-status - **로직 완전히 다름**
6. ✅ GET /api/inventory/agent-filters - ✅ 이미 수정됨 (원본 로직)
7. ✅ GET /api/inventory-analysis - **로직 간소화됨**
8. ✅ GET /api/inventory/status - **로직 간소화됨**
9. ✅ GET /api/inventory/status-by-color - **로직 간소화됨**
10. ❌ GET /api/inventory-inspection - **잘못된 엔드포인트** (원본은 POST)
11. ❌ GET /api/company-inventory-details - **원본에 없음**
12. ❌ GET /api/confirmed-unconfirmed-inventory - **원본에 없음**

### 누락된 API

- GET /api/inventory-recovery/data
- POST /api/inventory-recovery/update-status
- POST /api/inventory-recovery/priority-models
- GET /api/inventory-recovery/priority-models
- POST /api/inventory-inspection (원본은 POST)
- GET /api/inventoryRecoveryAccess

## Step 3: 원본 로직 상세 분석

### 1. GET /api/inventory/assignment-status (9291-9630줄)

**원본 시트**:
- `사전예약사이트`
- `폰클재고데이터`
- `폰클출고처데이터`
- `폰클개통데이터`
- `정규화작업`

**원본 로직**:
- 5개 시트를 병렬로 가져옴
- 정규화 규칙 로드 (C열: 사전예약사이트 형식, D열: 폰클 모델, E열: 색상)
- POS코드 매핑 생성 (폰클출고처데이터)
- 사용 가능한 재고 정보 생성 (폰클재고데이터)
- 개통 완료된 일련번호 수집 (폰클개통데이터)
- 사전예약사이트 데이터 처리 및 배정 상태 계산
- 배정 순번 계산 (예약번호 → 온세일일시 → 마당접수일 → 사이트예약일)
- 통계 계산 (assigned, unassigned, activated, notActivated)

**현재 구현 문제**:
- ❌ 시트 이름 잘못됨: `폰클재고데이터`, `예약데이터` (원본은 `사전예약사이트`)
- ❌ 로직 완전히 다름: 단순 집계만 수행
- ❌ 정규화 규칙 미사용
- ❌ POS코드 매핑 미사용
- ❌ 배정 순번 계산 미사용

### 2. POST /api/inventory/save-assignment (9630-9930줄)

**원본 시트**:
- `사전예약사이트`

**원본 로직**:
- 중복 배정 자동 정리 로직 (개통완료 고객 제외)
- 일련번호별 예약번호 매핑
- 중복 배정된 일련번호 정리 (우선순위: 예약번호 순)
- G열에 일련번호 저장
- 개통완료 고객은 새로운 배정에서 제외 (기존 일련번호 유지)
- 기존 배정 유지 로직
- 일련번호 중복 체크

**현재 구현 문제**:
- ❌ 시트 이름 잘못됨: `폰클재고데이터` (원본은 `사전예약사이트`)
- ❌ 중복 배정 정리 로직 없음
- ❌ 개통완료 고객 처리 로직 없음
- ❌ G열 업데이트 로직 간소화됨

### 3. GET /api/inventory/normalized-status (9930-10080줄)

**원본 시트**:
- `정규화작업`
- `폰클재고데이터`

**원본 로직**:
- 정규화작업 C열에 있는 모델들만 추출
- 폰클재고데이터에서 사무실별 모델별 재고 수량 집계
- 사무실명 매칭: 평택사무실, 인천사무실, 군산사무실, 안산사무실
- F열(모델명&용량) + "|" + G열(색상) 조합 생성
- 정규화작업 C열에 있는 모델인지 확인
- 사무실별 사전예약사이트 형식으로 변환

**현재 구현 문제**:
- ❌ 시트 이름 잘못됨: `정규화작업시트` (원본은 `정규화작업`)
- ❌ 로직 완전히 다름: C열 기준 집계만 수행
- ❌ 정규화작업 C열 모델 필터링 없음
- ❌ 사무실별 집계 로직 다름

### 4. POST /api/inventory/manual-assignment (10080-10276줄)

**원본 시트**:
- `사전예약사이트`
- `폰클재고데이터`
- `폰클출고처데이터`
- `정규화작업`

**원본 로직**:
- 4개 시트를 병렬로 가져옴
- 정규화 규칙 로드
- POS코드 매핑 생성
- 사용 가능한 재고 정보 생성
- 이미 배정된 일련번호 추적
- 사전예약사이트 데이터 처리 및 자동 배정
- 배정 결과 저장 (save-assignment API 호출)

**현재 구현 문제**:
- ❌ 시트 이름 잘못됨: `폰클재고데이터` (원본은 `사전예약사이트`)
- ❌ 로직 완전히 다름: 단순 시리얼번호 찾기만 수행
- ❌ 정규화 규칙 미사용
- ❌ POS코드 매핑 미사용
- ❌ 자동 배정 로직 없음

## Step 4: 수정 계획

### 우선순위 1: 핵심 배정 로직 (즉시 수정 필요)

1. **GET /api/inventory/assignment-status** - 원본 로직 완전 복사
2. **POST /api/inventory/save-assignment** - 원본 로직 완전 복사
3. **GET /api/inventory/normalized-status** - 원본 로직 완전 복사
4. **POST /api/inventory/manual-assignment** - 원본 로직 완전 복사

### 우선순위 2: 개통 상태 및 분석 (다음 수정)

5. **GET /api/inventory/activation-status** - 원본 로직 확인 후 수정
6. **GET /api/inventory-analysis** - 원본 로직 확인 후 수정
7. **GET /api/inventory/status** - 원본 로직 확인 후 수정
8. **GET /api/inventory/status-by-color** - 원본 로직 확인 후 수정

### 우선순위 3: 재고 회수 관련 (별도 라우터 필요)

9. **GET /api/inventory-recovery/data** - 원본 로직 확인 후 추가
10. **POST /api/inventory-recovery/update-status** - 원본 로직 확인 후 추가
11. **POST /api/inventory-recovery/priority-models** - 원본 로직 확인 후 추가
12. **GET /api/inventory-recovery/priority-models** - 원본 로직 확인 후 추가
13. **GET /api/inventoryRecoveryAccess** - 원본 로직 확인 후 추가

### 우선순위 4: 재고 검수 (별도 라우터 필요)

14. **POST /api/inventory-inspection** - 원본 로직 확인 후 수정

### 삭제 대상

- GET /api/inventory-inspection (원본에 없음, POST로 변경 필요)
- GET /api/company-inventory-details (원본에 없음)
- GET /api/confirmed-unconfirmed-inventory (원본에 없음)

## Step 5: 수정 작업 시작

### 작업 순서

1. 원본 파일에서 각 API의 정확한 로직 확인 (readFile로 100-200줄씩)
2. 시트 이름, 컬럼 인덱스, 필드 매핑, 응답 형식 모두 확인
3. 헬퍼 함수도 원본에서 복사
4. `inventoryRoutes.js` 파일 수정
5. 로컬 테스트
6. Git 커밋 및 푸시
7. 이 문서 업데이트

## 체크리스트

### 🚨 최우선 원칙

- [ ] 원본 로직을 100% 그대로 복사
- [ ] 시트 이름을 원본과 동일하게 사용
- [ ] 컬럼 인덱스를 원본과 동일하게 사용
- [ ] 필드 매핑을 원본과 동일하게 사용
- [ ] 응답 형식을 원본과 동일하게 사용
- [ ] 헬퍼 함수도 원본에서 복사

### API별 체크리스트

#### 1. GET /api/inventory/assignment-status
- [ ] 원본 로직 확인 완료
- [ ] 시트 이름 확인: `사전예약사이트`, `폰클재고데이터`, `폰클출고처데이터`, `폰클개통데이터`, `정규화작업`
- [ ] 컬럼 인덱스 확인
- [ ] 필드 매핑 확인
- [ ] 응답 형식 확인
- [ ] 헬퍼 함수 확인
- [ ] 수정 완료
- [ ] 로컬 테스트 완료
- [ ] Git 커밋 완료

#### 2. POST /api/inventory/save-assignment
- [ ] 원본 로직 확인 완료
- [ ] 시트 이름 확인: `사전예약사이트`
- [ ] 컬럼 인덱스 확인
- [ ] 필드 매핑 확인
- [ ] 응답 형식 확인
- [ ] 헬퍼 함수 확인
- [ ] 수정 완료
- [ ] 로컬 테스트 완료
- [ ] Git 커밋 완료

#### 3. GET /api/inventory/normalized-status
- [ ] 원본 로직 확인 완료
- [ ] 시트 이름 확인: `정규화작업`, `폰클재고데이터`
- [ ] 컬럼 인덱스 확인
- [ ] 필드 매핑 확인
- [ ] 응답 형식 확인
- [ ] 헬퍼 함수 확인
- [ ] 수정 완료
- [ ] 로컬 테스트 완료
- [ ] Git 커밋 완료

#### 4. POST /api/inventory/manual-assignment
- [ ] 원본 로직 확인 완료
- [ ] 시트 이름 확인: `사전예약사이트`, `폰클재고데이터`, `폰클출고처데이터`, `정규화작업`
- [ ] 컬럼 인덱스 확인
- [ ] 필드 매핑 확인
- [ ] 응답 형식 확인
- [ ] 헬퍼 함수 확인
- [ ] 수정 완료
- [ ] 로컬 테스트 완료
- [ ] Git 커밋 완료

## 작업 진행 상황

### 2025-01-25

- ✅ Step 1: 원본 파일에서 API 검색 완료
- ✅ Step 2: 현재 구현 확인 완료
- ✅ Step 3: 원본 로직 상세 분석 시작 (1-4번 API)
- ⏳ Step 4: 수정 계획 수립 완료
- ⏳ Step 5: 수정 작업 시작 예정

## 참고 사항

- 원본 파일: `server/index.js.backup.original` (40000줄)
- 현재 파일: `server/routes/inventoryRoutes.js`
- 프로토콜: `.kiro/specs/server-endpoint-recovery/MODE_VERIFICATION_PROTOCOL.md` v1.1
