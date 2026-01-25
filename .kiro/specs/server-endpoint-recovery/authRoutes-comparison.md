# authRoutes.js 로직 비교 분석

## 분석 일시
2025-01-25

## 비교 대상
- **원본**: `server/index.js` (Git 롤백 버전, 3989-4350줄)
- **현재**: `server/routes/authRoutes.js`

---

## 🚨 중대한 차이점 발견

### 1. POST /api/login - **완전히 다른 로직**

#### ❌ 현재 authRoutes.js의 문제점

**현재 구현**:
```javascript
// 매장 정보만 조회
const storeRows = storeValues.slice(1);
const storeRow = storeRows.find(row => {
  const rowStoreId = (row[15] || '').toString().trim(); // H열: 매장 ID
  return rowStoreId === storeId;
});
```

**원본 로직 (올바른 구현)**:
```javascript
// 1. 대리점 관리자 먼저 확인 (병렬 조회)
const [agentValues, storeValues] = await Promise.all([
  getSheetValues(AGENT_SHEET_NAME),
  getSheetValues(STORE_SHEET_NAME)
]);

// 2. 대리점 관리자 ID 확인
const agentRows = agentValues.slice(1);
const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디)

if (agent) {
  // 대리점 관리자 로그인 처리
  // - 32개 권한 필드 확인 (H~AF열)
  // - modePermissions 객체 생성
  // - agentInfo 객체 생성
  return res.json({ success: true, isAgent: true, ... });
}

// 3. 일반모드권한관리 시트 확인
const generalModeValues = await getSheetValues('일반모드권한관리');
const generalModeRows = generalModeValues.slice(3); // 4행부터 데이터
const foundGeneralUser = generalModeRows.find(row => 
  row[0].toUpperCase() === storeId.toUpperCase()
);

if (foundGeneralUser) {
  // 일반 사용자 로그인 처리
  // - 4개 모드 권한 확인 (D, E, G, I열)
  // - 폰클출고처데이터에서 추가 정보 조회
  return res.json({ success: true, isAgent: false, ... });
}

// 4. 매장 ID도 아닌 경우
return res.status(404).json({ error: 'Store not found' });
```

#### 🔴 치명적 문제

1. **대리점 관리자 로그인 불가**: 현재 코드는 매장 정보만 조회하므로 대리점 관리자가 로그인할 수 없음
2. **일반모드 사용자 로그인 불가**: `일반모드권한관리` 시트를 전혀 확인하지 않음
3. **권한 정보 누락**: 32개 권한 필드를 전혀 반환하지 않음
4. **응답 구조 완전히 다름**: 
   - 원본: `{ success, isAgent, modePermissions, agentInfo/storeInfo }`
   - 현재: `{ success, storeId, storeName, message }`

---

### 2. POST /api/verify-password - **컬럼 인덱스 확인 필요**

#### 현재 구현
```javascript
const agentRows = agentValues.slice(3); // 헤더 3행 제외
const agentRow = agentRows.find(row => {
  const rowUserId = (row[2] || '').toString().trim(); // C열: 연락처(아이디)
  return rowUserId === userId;
});

const storedPassword = (agentRow[4] || '').toString().trim(); // E열: 패스워드
const passwordNotUsed = agentRow[3]; // D열: 패스워드 미사용
```

#### 원본 로직
```javascript
const agentRows = agentValues.slice(1); // 헤더 1행 제외 ⚠️
const agent = agentRows.find(row => row[2] === storeId); // C열: 연락처(아이디) ✅

const passwordNotUsed = agent[3] === 'TRUE'; // D열: 패스워드 미사용 ✅
const storedPassword = agent[4] || ''; // E열: 패스워드 ✅
```

#### ⚠️ 차이점
- **헤더 행 수**: 현재 `slice(3)` vs 원본 `slice(1)` 
  - **확인 필요**: 실제 시트의 헤더가 몇 행인지 확인 필요
- 컬럼 인덱스는 동일 (C, D, E열)

---

### 3. POST /api/verify-direct-store-password - **컬럼 인덱스 불확실**

#### 현재 구현
```javascript
const storeRows = storeValues.slice(1);
const storeRow = storeRows.find(row => {
  const rowStoreId = (row[15] || '').toString().trim(); // H열: 매장 ID
  return rowStoreId === storeId;
});

const storedPassword = (storeRow[16] || '').toString().trim(); // I열: 비밀번호 (가정)
```

#### 원본 로직
```javascript
// 원본 index.js에는 이 엔드포인트가 없음!
// 일반모드권한관리 시트에서 직영점 비밀번호 확인:
const directStorePassword = (foundGeneralUser[7] || '').toString().trim(); // H열: 직영점 모드 비밀번호
```

#### 🔴 문제점
1. **원본에 없는 엔드포인트**: 이 엔드포인트는 원본 index.js에 존재하지 않음
2. **잘못된 시트 참조**: `폰클출고처데이터`가 아니라 `일반모드권한관리` 시트를 확인해야 함
3. **잘못된 컬럼**: I열(16)이 아니라 H열(7)을 확인해야 함

---

## 📋 수정 필요 사항 요약

### 최우선 (치명적)
1. **POST /api/login 완전 재작성 필요**
   - 대리점 관리자 로그인 로직 추가
   - 일반모드권한관리 시트 확인 로직 추가
   - 32개 권한 필드 처리
   - 응답 구조 수정

### 높은 우선순위
2. **POST /api/verify-password 헤더 행 수 확인**
   - `slice(3)` vs `slice(1)` 검증 필요

3. **POST /api/verify-direct-store-password 로직 수정**
   - 시트 변경: `폰클출고처데이터` → `일반모드권한관리`
   - 컬럼 변경: I열(16) → H열(7)

---

## 🎯 다음 단계

1. POST /api/login 엔드포인트를 원본 로직으로 완전히 교체
2. 대리점아이디관리 시트의 실제 헤더 행 수 확인
3. POST /api/verify-direct-store-password 로직 수정
4. 테스트 실행하여 검증

---

## 📊 원본 로직 상세 정보

### 대리점 관리자 권한 필드 (32개)
- H열(7): 재고모드
- I열(8): 정산모드
- J열(9): 검수모드
- K열(10): 채권장표 메뉴
- L열(11): 정책모드
- M열(12): 검수전체현황
- N열(13): 회의모드 (M/O)
- O열(14): 사전예약모드
- P열(15): 장표모드
- Q열(16): 팀코드
- R열(17): 권한
- S열(18): 예산모드
- U열(20): 영업모드
- V열(21): 재고회수모드
- W열(22): 정보수집모드
- X열(23): SMS 관리모드
- Y열(24): OB 관리모드 (O/M/S)
- Z열(25): 관리자모드 (O/M)
- AA열(26): 온세일관리모드 (O/S/M)
- AB열(27): 식대 모드
- AC열(28): 근퇴 모드
- AD열(29): 리스크 관리 모드
- AE열(30): 직영점 관리 모드 (M/S/O)
- AF열(31): 퀵서비스 관리 모드

### 일반모드권한관리 시트 구조
- A열(0): 사용자ID(POS코드)
- B열(1): 업체명
- C열(2): 그룹
- D열(3): 기본 모드
- E열(4): 온세일접수 모드 (O/M)
- G열(6): 직영점 모드
- H열(7): 직영점 모드 비밀번호
- I열(8): 일반정책모드
- J열(9): 일반정책모드 비밀번호

### 폰클출고처데이터 시트 구조 (매장 정보)
- D열(3): 사무실
- E열(4): 소속
- F열(5): 담당자
- H열(7): 코드
- I열(8): 위도
- J열(9): 경도
- L열(11): 주소
- P열(15): 매장 ID
- T열(19): 전화번호
