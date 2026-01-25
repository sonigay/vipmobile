# 정책모드 API 원본 비교 및 수정

## 작업 일시
- 날짜: 2025-01-25
- 작업자: AI Assistant
- 커밋: 070b3fcd

## 문제 발견
- **보고자**: 사용자
- **증상**: 정책모드 추가정책 탭에서 상단에 담당자 탭이 나타나지 않음
- **예상 동작**: 담당자 이름별로 상단에 탭으로 나열되어야 함

## 원인 분석

### 1. 프론트엔드 로직 확인
- **파일**: `src/components/PolicyMode.js`
- **위치**: 2096-2119줄
- **로직**: `managers` 배열을 사용하여 담당자 탭 렌더링
```javascript
{Array.isArray(managers) && managers.map((manager) => (
  <Chip
    key={manager}
    label={`${manager} (${managerPolicyCounts[manager] || 0})`}
    onClick={() => setSelectedManager(manager)}
    color={selectedManager === manager ? 'primary' : 'default'}
  />
))}
```

### 2. 담당자 목록 로드 로직 확인
- **파일**: `src/components/PolicyMode.js`
- **함수**: `loadManagers()` (314-351줄)
- **API 호출**: `GET /api/inventory/agent-filters`
- **데이터 사용**: `data.data.map(agent => agent.target)` - `target` 필드 사용

### 3. 서버 API 확인
- **파일**: `server/routes/inventoryRoutes.js`
- **엔드포인트**: `GET /api/inventory/agent-filters`
- **문제**: 잘못된 시트(`대리점아이디관리`)에서 데이터를 가져옴
- **반환 데이터**: `{ code, name, office }` - `target` 필드 없음

## 수정된 API

### 1. GET /api/inventory/agent-filters

#### 원본 위치
- **파일**: `server/index.js.backup.original`
- **줄번호**: 30286-30380줄

#### 현재 파일
- **파일**: `server/routes/inventoryRoutes.js`
- **줄번호**: 373-490줄

#### 상태
✅ 수정 완료

#### 변경 사항

##### 1. 시트 이름
- **변경 전**: `대리점아이디관리` (잘못된 시트)
- **변경 후**: `폰클재고데이터`, `폰클개통데이터` (원본과 동일)

##### 2. 데이터 추출 로직
**변경 전**:
```javascript
// 대리점아이디관리 시트에서 대리점 목록 조회
const values = await getSheetValues('대리점아이디관리');
const headers = values[0] || [];
const rows = values.slice(1);

const agentCodeIndex = headers.indexOf('대리점코드');
const agentNameIndex = headers.indexOf('대리점명');
const officeIndex = headers.indexOf('사무실');

const filters = rows
  .filter(row => row[agentCodeIndex] && row[agentNameIndex])
  .map(row => ({
    code: row[agentCodeIndex] || '',
    name: row[agentNameIndex] || '',
    office: row[officeIndex] || ''
  }));
```

**변경 후**:
```javascript
// 폰클재고데이터와 폰클개통데이터 병렬로 가져오기
const [inventoryValues, activationValues] = await Promise.all([
  getSheetValues('폰클재고데이터'),
  getSheetValues('폰클개통데이터')
]);

// 재고 데이터에서 담당자 추출
inventoryValues.slice(3).forEach(row => {
  if (row.length >= 23) {
    const modelName = (row[13] || '').toString().trim(); // N열: 모델명
    const category = (row[5] || '').toString().trim(); // F열: 구분
    const office = (row[6] || '').toString().trim(); // G열: 사무실
    const department = (row[7] || '').toString().trim(); // H열: 소속
    const agent = (row[8] || '').toString().trim(); // I열: 담당자

    if (modelName && category !== '#N/A' && agent) {
      agentsWithInventory.add(agent);
      if (!agentInfo.has(agent)) {
        agentInfo.set(agent, { office, department });
      }
    }
  }
});

// 개통 데이터에서 담당자 추출 (당월만)
activationValues.slice(3).forEach(row => {
  if (row.length >= 23) {
    const activationDate = (row[9] || '').toString().trim(); // J열: 개통일
    const modelName = (row[21] || '').toString().trim(); // V열: 모델명
    const office = (row[6] || '').toString().trim(); // G열: 사무실
    const department = (row[7] || '').toString().trim(); // H열: 소속
    const agent = (row[8] || '').toString().trim(); // I열: 담당자

    if (activationDate && modelName && agent) {
      // 현재 월의 데이터만 처리
      const dateMatch = activationDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month] = dateMatch;
        const activationYear = parseInt(year);
        const activationMonth = parseInt(month);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        if (activationYear === currentYear && activationMonth === currentMonth) {
          agentsWithActivation.add(agent);
          if (!agentInfo.has(agent)) {
            agentInfo.set(agent, { office, department });
          }
        }
      }
    }
  }
});
```

##### 3. 응답 형식
**변경 전**:
```javascript
res.json({
  success: true,
  data: uniqueFilters  // { code, name, office }[]
});
```

**변경 후**:
```javascript
const result = {
  success: true,
  data: Array.from(allAgentsWithData).map(agent => ({
    target: agent,           // ✅ 프론트엔드에서 사용하는 필드
    contactId: agent,
    office: agentInfo.get(agent)?.office || '',
    department: agentInfo.get(agent)?.department || '',
    hasInventory: agentsWithInventory.has(agent),
    hasActivation: agentsWithActivation.has(agent)
  })).sort((a, b) => a.target.localeCompare(b.target))
};

res.json(result);
```

##### 4. 캐시 설정
**변경 전**:
```javascript
// 캐시 저장 (10분)
cacheManager.set(cacheKey, uniqueFilters, 10 * 60 * 1000);
```

**변경 후**:
```javascript
// 캐시 저장 (30분) - 원본과 동일
cacheManager.set(cacheKey, result, 30 * 60 * 1000);
```

##### 5. 컬럼 인덱스 (폰클재고데이터)
- `row[5]`: F열 - 구분
- `row[6]`: G열 - 사무실
- `row[7]`: H열 - 소속
- `row[8]`: I열 - 담당자 ✅
- `row[13]`: N열 - 모델명

##### 6. 컬럼 인덱스 (폰클개통데이터)
- `row[6]`: G열 - 사무실
- `row[7]`: H열 - 소속
- `row[8]`: I열 - 담당자 ✅
- `row[9]`: J열 - 개통일
- `row[21]`: V열 - 모델명

## 검증 결과

### 로컬 테스트
✅ 서버 정상 시작
```
✅ [Phase 6] Inventory routes mounted
✅ 모든 라우트 등록 완료
```

### Git 커밋
✅ 커밋 완료
```
commit 070b3fcd
fix: 정책모드 담당자 탭 표시 수정 - /api/inventory/agent-filters API 원본 로직 복사
```

### 배포
✅ 푸시 완료
```
To https://github.com/sonigay/vipmobile
   065762d0..070b3fcd  main -> main
```

## 추가 작업

### MODE_VERIFICATION_PROTOCOL.md 작성
모드별 원본 검증 및 수정을 위한 표준 프로토콜 문서 작성
- 작업 절차 정의
- 검증 체크리스트
- 모드별 주요 API 매핑
- 작업 템플릿

## 예상 결과

### 수정 전
- 정책모드 추가정책 탭에서 담당자 탭이 표시되지 않음
- `managers` 배열이 비어있음

### 수정 후
- 폰클재고데이터와 폰클개통데이터에서 실제 재고/개통 실적이 있는 담당자 목록 추출
- 담당자별로 탭이 상단에 표시됨
- 각 담당자별 정책 개수가 표시됨

## 참고사항

### 프론트엔드 필터링 로직
`src/components/PolicyMode.js`의 `loadManagers()` 함수에서 다음과 같이 필터링:
```javascript
const excludedNames = ['VIP직영', '인천사무실', '안산사무실', '평택사무실'];

const uniqueNames = [...new Set(allNames.map(name => {
  // 괄호 제거 (예: "홍기현(직영)" → "홍기현")
  return name.replace(/\([^)]*\)/g, '').trim();
}))]
.filter(name => name && !excludedNames.includes(name))
.sort();
```

### 담당자별 정책 개수 계산
`managerPolicyCounts` 상태를 사용하여 각 담당자별 정책 개수를 표시

## 알려진 이슈
없음

## 다음 단계
1. 배포 후 실제 환경에서 담당자 탭이 정상적으로 표시되는지 확인
2. 다른 모드에서도 유사한 문제가 있는지 확인
3. MODE_VERIFICATION_PROTOCOL.md에 따라 다른 모드들도 순차적으로 검증
