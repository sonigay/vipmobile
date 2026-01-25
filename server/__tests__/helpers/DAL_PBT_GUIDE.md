# DAL Property-Based Testing 가이드

## 개요

이 가이드는 Hybrid Database Migration 프로젝트의 DAL(Data Access Layer)에 대한 Property-Based Testing(PBT)을 작성하는 방법을 설명합니다.

## 설치

fast-check는 이미 설치되어 있습니다:

```bash
npm install --save-dev fast-check
```

## 헬퍼 함수 사용법

### 1. 기본 임포트

```javascript
const {
  tableNameArbitrary,
  modeNameArbitrary,
  baseRecordArbitrary,
  policyMarginDataArbitrary,
  filtersArbitrary,
  runAsyncDALPropertyTest,
  assertDataEquivalence,
  validateMigrationStats,
  DAL_PBT_CONFIG,
  fc
} = require('./helpers/pbt-helpers');
```

### 2. 테이블 이름 생성기

Phase 1 마이그레이션 대상 테이블들을 무작위로 생성합니다:

```javascript
fc.assert(
  fc.property(
    tableNameArbitrary(),
    (tableName) => {
      // tableName은 다음 중 하나:
      // 'direct_store_policy_margin', 'policy_table_settings', 등
      console.log(tableName);
    }
  )
);
```

### 3. 데이터 레코드 생성기

#### 기본 레코드 (모든 테이블 공통)

```javascript
const record = baseRecordArbitrary();
// {
//   id: 'uuid-string',
//   created_at: '2024-01-01T00:00:00Z',
//   updated_at: '2024-01-01T00:00:00Z'
// }
```

#### 정책 마진 데이터

```javascript
const policyData = policyMarginDataArbitrary();
// {
//   id: 'uuid',
//   created_at: 'timestamp',
//   updated_at: 'timestamp',
//   policy_name: 'string',
//   margin_rate: 45.5,
//   is_active: true,
//   description: 'optional string or null'
// }
```

#### 설정 데이터

```javascript
const settingsData = settingsDataArbitrary();
// {
//   id: 'uuid',
//   setting_key: 'MY_SETTING',
//   setting_value: 'value',
//   setting_type: 'string',
//   is_public: false
// }
```

#### 요금제 마스터 데이터

```javascript
const planData = planMasterDataArbitrary();
// {
//   plan_name: '5G 프리미엄',
//   plan_code: 'PLAN_5G_001',
//   monthly_fee: 89000,
//   data_limit: 100,
//   carrier: 'SKT',
//   is_active: true
// }
```

#### 단말 마스터 데이터

```javascript
const deviceData = deviceMasterDataArbitrary();
// {
//   device_name: 'Galaxy S24',
//   device_code: 'SM_S921',
//   manufacturer: 'Samsung',
//   model_number: 'SM-S921N',
//   release_price: 1200000,
//   is_available: true
// }
```

### 4. 필터 조건 생성기

```javascript
const filters = filtersArbitrary();
// {
//   id: 'uuid' or undefined,
//   is_active: true or undefined,
//   created_after: 'timestamp' or undefined,
//   limit: 50 or undefined
// }
```

### 5. 마이그레이션 배치 생성기

유효한 레코드와 무효한 레코드가 혼합된 배치를 생성합니다:

```javascript
const batch = migrationBatchArbitrary(policyMarginDataArbitrary());
// [
//   { valid: true, data: {...} },
//   { valid: false, data: {...} },
//   ...
// ]
```

### 6. 트랜잭션 시퀀스 생성기

```javascript
const sequence = transactionSequenceArbitrary();
// [
//   { operation: 'create', tableName: 'table1', data: {...}, shouldFail: false },
//   { operation: 'update', tableName: 'table2', data: {...}, shouldFail: true },
//   ...
// ]
```

## Property Test 작성 예제

### Property 1: Data Validation Consistency

```javascript
test('Feature: hybrid-database-migration, Property 1: Validation should be consistent', () => {
  const DataValidator = require('../migration/DataValidator');
  const validator = new DataValidator();

  fc.assert(
    fc.property(
      tableNameArbitrary(),
      baseRecordArbitrary(),
      (tableName, data) => {
        const result1 = validator.validate(tableName, data);
        const result2 = validator.validate(tableName, data);

        // 동일한 입력에 대해 동일한 결과
        expect(result1.valid).toBe(result2.valid);
        expect(result1.errors).toEqual(result2.errors);
      }
    ),
    DAL_PBT_CONFIG
  );
});
```

### Property 4: DAL Implementation Equivalence

```javascript
test('Feature: hybrid-database-migration, Property 4: Both implementations should produce equivalent results', async () => {
  const DataAccessLayer = require('../dal/DataAccessLayer');
  const DatabaseImplementation = require('../dal/DatabaseImplementation');
  const GoogleSheetsImplementation = require('../dal/GoogleSheetsImplementation');

  await fc.assert(
    fc.asyncProperty(
      tableNameArbitrary(),
      filtersArbitrary(),
      async (tableName, filters) => {
        const dbImpl = new DatabaseImplementation();
        const gsImpl = new GoogleSheetsImplementation(
          process.env.SHEET_ID,
          credentials
        );

        const dbDAL = new DataAccessLayer(dbImpl);
        const gsDAL = new DataAccessLayer(gsImpl);

        const dbResult = await dbDAL.read(tableName, filters);
        const gsResult = await gsDAL.read(tableName, filters);

        // 결과의 길이가 같아야 함
        expect(dbResult.length).toBe(gsResult.length);

        // 각 레코드가 동등해야 함 (타임스탬프 제외)
        if (dbResult.length > 0) {
          expect(assertDataEquivalence(dbResult[0], gsResult[0])).toBe(true);
        }
      }
    ),
    DAL_PBT_CONFIG
  );
});
```

### Property 7: Feature Flag Consistency

```javascript
test('Feature: hybrid-database-migration, Property 7: Feature flag should consistently control data source', () => {
  const dalFactory = require('../dal/DALFactory');
  const DatabaseImplementation = require('../dal/DatabaseImplementation');

  fc.assert(
    fc.property(
      modeNameArbitrary(),
      fc.boolean(),
      (mode, useDatabase) => {
        // 플래그 설정
        if (useDatabase) {
          dalFactory.getFeatureFlags().enable(mode);
        } else {
          dalFactory.getFeatureFlags().disable(mode);
        }

        // DAL 가져오기
        const dal = dalFactory.getDAL(mode);

        // 구현체 확인
        const isUsingDatabase = dal.implementation instanceof DatabaseImplementation;
        expect(isUsingDatabase).toBe(useDatabase);
      }
    ),
    DAL_PBT_CONFIG
  );
});
```

## 검증 헬퍼 함수

### assertDataEquivalence

타임스탬프 필드를 제외하고 두 객체가 동등한지 확인합니다:

```javascript
const data1 = {
  id: '123',
  name: 'Test',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z'
};

const data2 = {
  id: '123',
  name: 'Test',
  created_at: '2024-01-03T00:00:00Z', // 다른 타임스탬프
  updated_at: '2024-01-04T00:00:00Z'  // 다른 타임스탬프
};

// 타임스탬프를 제외하면 동등함
expect(assertDataEquivalence(data1, data2)).toBe(true);

// 커스텀 제외 필드
expect(assertDataEquivalence(data1, data2, ['created_at', 'updated_at', 'id'])).toBe(true);
```

### validateMigrationStats

마이그레이션 통계가 올바른지 검증합니다:

```javascript
const stats = {
  total: 100,
  success: 80,
  failed: 20,
  errors: []
};

expect(validateMigrationStats(stats, 100)).toBe(true);
```

## 테스트 설정

### DAL_PBT_CONFIG

기본 설정:

```javascript
{
  numRuns: 100,        // 각 속성당 100회 실행
  timeout: 10000,      // 10초 타임아웃
  seed: 42,            // 재현 가능한 테스트
  maxSkipsPerRun: 100  // 최대 스킵 횟수
}
```

### 커스텀 설정

```javascript
await fc.assert(
  fc.asyncProperty(
    tableNameArbitrary(),
    async (tableName) => {
      // 테스트 로직
    }
  ),
  {
    ...DAL_PBT_CONFIG,
    numRuns: 200,  // 더 많은 반복
    timeout: 20000 // 더 긴 타임아웃
  }
);
```

## 비동기 테스트

비동기 속성 테스트는 `fc.asyncProperty`를 사용합니다:

```javascript
test('Async property test', async () => {
  await fc.assert(
    fc.asyncProperty(
      tableNameArbitrary(),
      async (tableName) => {
        const result = await someAsyncOperation(tableName);
        expect(result).toBeDefined();
      }
    ),
    DAL_PBT_CONFIG
  );
}, DAL_PBT_CONFIG.timeout);
```

## 테이블별 데이터 생성기 매핑

특정 테이블에 맞는 데이터 생성기를 자동으로 가져옵니다:

```javascript
const { getDataArbitraryForTable } = require('./helpers/pbt-helpers');

const tableName = 'direct_store_policy_margin';
const dataArbitrary = getDataArbitraryForTable(tableName);

const data = dataArbitrary();
// 해당 테이블에 맞는 데이터 구조 반환
```

## 실행 방법

### 모든 테스트 실행

```bash
cd server
npm test
```

### 특정 테스트 파일 실행

```bash
npm test dal-pbt-example.test.js
```

### Watch 모드

```bash
npm run test:watch
```

### 커버리지 리포트

```bash
npm run test:coverage
```

## 디버깅

### 실패한 케이스 재현

fast-check는 실패한 케이스를 자동으로 축소(shrink)하여 최소 재현 케이스를 제공합니다:

```
Property failed after 42 tests
{ seed: 1234567890, path: "42:0:1:0", endOnFailure: true }
Counterexample: [...]
```

실패한 케이스를 재현하려면:

```javascript
fc.assert(
  fc.property(...),
  {
    seed: 1234567890,
    path: "42:0:1:0"
  }
);
```

### 로깅

테스트 중 값을 확인하려면:

```javascript
fc.assert(
  fc.property(
    tableNameArbitrary(),
    (tableName) => {
      console.log('Testing with table:', tableName);
      // 테스트 로직
    }
  )
);
```

## 모범 사례

1. **명확한 속성 정의**: 각 테스트는 설계 문서의 특정 속성을 검증해야 합니다.

2. **적절한 반복 횟수**: 최소 100회 실행 (`numRuns: 100`)

3. **태그 사용**: 테스트 이름에 속성 번호 포함
   ```javascript
   test('Feature: hybrid-database-migration, Property 1: ...', ...)
   ```

4. **타임아웃 설정**: 비동기 테스트는 충분한 타임아웃 설정

5. **격리된 테스트**: 각 테스트는 독립적으로 실행 가능해야 함

6. **의미 있는 생성기**: 실제 사용 케이스를 반영하는 데이터 생성

7. **에러 처리**: 예상되는 에러도 테스트에 포함

## 참고 자료

- [fast-check 공식 문서](https://github.com/dubzzz/fast-check)
- [Property-Based Testing 소개](https://hypothesis.works/articles/what-is-property-based-testing/)
- Design Document의 Correctness Properties 섹션
- `server/__tests__/dal-pbt-example.test.js` 예제 파일

## 문제 해결

### 테스트가 너무 느림

- `numRuns` 값을 줄이기 (개발 중에는 10-20)
- 프로덕션 CI에서만 100회 실행

### 생성된 데이터가 유효하지 않음

- 생성기에 `.filter()` 추가하여 유효한 데이터만 생성
- 또는 검증 로직을 테스트에 포함

### 타임아웃 에러

- `timeout` 값 증가
- 비동기 작업 최적화
- 모의(mock) 객체 사용 고려

## 다음 단계

1. DAL 구현 완료 후 예제 테스트의 `.skip` 제거
2. 각 Correctness Property에 대한 실제 테스트 작성
3. 통합 테스트와 함께 실행하여 전체 시스템 검증
4. CI/CD 파이프라인에 PBT 추가
