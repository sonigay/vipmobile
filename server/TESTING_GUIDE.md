# Testing Guide - Hybrid Database Migration

이 문서는 Hybrid Database Migration 프로젝트의 테스트 전략과 Jest 설정에 대한 가이드입니다.

## 목차

1. [테스트 환경 설정](#테스트-환경-설정)
2. [Jest 설정 개요](#jest-설정-개요)
3. [테스트 실행 방법](#테스트-실행-방법)
4. [테스트 작성 가이드](#테스트-작성-가이드)
5. [Property-Based Testing](#property-based-testing)
6. [커버리지 리포트](#커버리지-리포트)

## 테스트 환경 설정

### 필수 패키지

프로젝트에는 다음 테스트 패키지가 설치되어 있습니다:

```json
{
  "devDependencies": {
    "jest": "^30.2.0",
    "fast-check": "^4.5.3",
    "supertest": "^7.2.2"
  }
}
```

### 환경 변수

테스트 실행 시 다음 환경 변수가 자동으로 설정됩니다 (`test-setup.js`):

```javascript
// 기본 환경
process.env.NODE_ENV = 'test';

// Supabase 설정 (테스트용)
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';

// Google Sheets 설정 (테스트용)
process.env.SHEET_ID = 'test-sheet-id';
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@test.iam.gserviceaccount.com';

// Feature Flags (기본값: false)
process.env.USE_DB_DIRECT_STORE = 'false';
process.env.USE_DB_POLICY = 'false';
process.env.USE_DB_CUSTOMER = 'false';

// Property-Based Testing 설정
global.PBT_NUM_RUNS = 100; // 기본 실행 횟수
```

실제 데이터베이스 연결이 필요한 통합 테스트의 경우, `.env.test` 파일을 생성하여 실제 연결 정보를 제공할 수 있습니다:

```bash
# server/.env.test
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SHEET_ID=your-test-sheet-id
```

## Jest 설정 개요

### 주요 설정 (`jest.config.js`)

```javascript
{
  testEnvironment: 'node',           // Node.js 환경
  testTimeout: 30000,                // 30초 타임아웃 (PBT 고려)
  collectCoverage: true,             // 커버리지 자동 수집
  coverageThreshold: {               // 최소 커버리지 70%
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
}
```

### 커버리지 대상 파일

다음 파일들이 커버리지 측정 대상입니다:

- `dal/**/*.js` - Data Access Layer
- `migration/**/*.js` - 마이그레이션 스크립트
- `backup/**/*.js` - 백업/복원 스크립트
- `routes/**/*.js` - API 라우트
- `middleware/**/*.js` - 미들웨어
- `utils/**/*.js` - 유틸리티 함수

제외 대상:
- `index.js` - 서버 진입점
- `supabaseClient.js` - 실제 연결 파일
- `__tests__/**` - 테스트 파일 자체

## 테스트 실행 방법

### 기본 명령어

```bash
# 모든 테스트 실행
npm test

# Watch 모드 (파일 변경 시 자동 재실행)
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage

# 상세 출력 모드
npm run test:verbose
```

### 특정 테스트 파일 실행

```bash
# 특정 파일만 실행
npm test -- dal.test.js

# 특정 패턴 매칭
npm test -- --testNamePattern="DataAccessLayer"

# 특정 디렉토리
npm test -- __tests__/dal/
```

### Property-Based Testing 설정

PBT 실행 횟수를 조정하려면:

```bash
# 환경 변수로 실행 횟수 지정
PBT_NUM_RUNS=1000 npm test

# 특정 시드로 재현 가능한 테스트
PBT_SEED=42 npm test
```

## 테스트 작성 가이드

### Unit Test 예제

```javascript
// __tests__/dal/DataAccessLayer.test.js

const DataAccessLayer = require('../../dal/DataAccessLayer');
const DatabaseImplementation = require('../../dal/DatabaseImplementation');

describe('DataAccessLayer', () => {
  let dal;

  beforeEach(() => {
    dal = new DataAccessLayer(new DatabaseImplementation());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create a record successfully', async () => {
      const data = {
        name: 'Test Policy',
        value: 100
      };

      const result = await dal.create('direct_store_policy_margin', data);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Policy');
      expect(result.value).toBe(100);
    });

    test('should throw error with invalid data', async () => {
      await expect(
        dal.create('direct_store_policy_margin', null)
      ).rejects.toThrow();
    });
  });

  describe('read', () => {
    test('should read records with filters', async () => {
      const filters = { status: 'active' };
      const results = await dal.read('direct_store_policy_margin', filters);

      expect(Array.isArray(results)).toBe(true);
      results.forEach(record => {
        expect(record.status).toBe('active');
      });
    });
  });
});
```

### Property-Based Test 예제

```javascript
// __tests__/dal/DataAccessLayer-properties.test.js

const fc = require('fast-check');
const DataAccessLayer = require('../../dal/DataAccessLayer');

describe('DAL Property Tests', () => {
  
  test('Feature: hybrid-database-migration, Property 1: Data validation should be consistent', async () => {
    const validator = new DataValidator();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tableName: fc.constantFrom('direct_store_policy_margin', 'policy_table_settings'),
          data: fc.record({
            name: fc.string(),
            value: fc.integer()
          })
        }),
        async ({ tableName, data }) => {
          // 동일한 입력에 대해 여러 번 검증
          const result1 = validator.validate(tableName, data);
          const result2 = validator.validate(tableName, data);
          const result3 = validator.validate(tableName, data);

          // 모든 결과가 동일해야 함
          expect(result1.valid).toBe(result2.valid);
          expect(result2.valid).toBe(result3.valid);
          expect(result1.errors).toEqual(result2.errors);
          expect(result2.errors).toEqual(result3.errors);
        }
      ),
      { numRuns: global.PBT_NUM_RUNS }
    );
  });

  test('Feature: hybrid-database-migration, Property 2: Dry-run should be idempotent', async () => {
    const migrator = new MigrationScript({ dryRun: true });

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sheetName: fc.constantFrom('직영점_정책_마진', '정책모드_정책표설정'),
          tableName: fc.constantFrom('direct_store_policy_margin', 'policy_table_settings')
        }),
        async ({ sheetName, tableName }) => {
          // Dry-run을 여러 번 실행
          const result1 = await migrator.migrateSheet(sheetName, tableName);
          const result2 = await migrator.migrateSheet(sheetName, tableName);

          // 결과가 동일해야 함
          expect(result1.total).toBe(result2.total);
          expect(result1.success).toBe(result2.success);
          expect(result1.failed).toBe(result2.failed);
        }
      ),
      { numRuns: 10 } // Dry-run은 빠르므로 적은 횟수
    );
  });
});
```

### Integration Test 예제

```javascript
// __tests__/routes/directRoutes.integration.test.js

const request = require('supertest');
const express = require('express');
const directRoutes = require('../../routes/directRoutes');

describe('Direct Store Routes Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(directRoutes);
  });

  describe('GET /api/direct/policy/margin', () => {
    test('should return policy margin data', async () => {
      const response = await request(app)
        .get('/api/direct/policy/margin')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/direct/policy/margin', () => {
    test('should create new policy margin', async () => {
      const newPolicy = {
        name: 'Test Policy',
        value: 100
      };

      const response = await request(app)
        .post('/api/direct/policy/margin')
        .send(newPolicy)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(newPolicy.name);
    });
  });
});
```

## Property-Based Testing

### PBT 작성 원칙

1. **속성 정의**: 모든 입력에 대해 참이어야 하는 속성을 명확히 정의
2. **제너레이터 선택**: 적절한 fast-check 제너레이터 사용
3. **반례 처리**: 실패 시 반례를 분석하여 버그 또는 속성 수정
4. **실행 횟수**: 기본 100회, 중요한 속성은 1000회 이상

### 주요 제너레이터

```javascript
const fc = require('fast-check');

// 기본 타입
fc.string()           // 임의의 문자열
fc.integer()          // 정수
fc.boolean()          // 불리언
fc.uuid()             // UUID

// 복합 타입
fc.record({           // 객체
  name: fc.string(),
  age: fc.integer({ min: 0, max: 120 })
})

fc.array(fc.string()) // 배열

// 제약 조건
fc.string({ minLength: 1, maxLength: 100 })
fc.integer({ min: 0, max: 1000 })

// 상수 선택
fc.constantFrom('option1', 'option2', 'option3')
```

### 속성 예제

**Property 1: Data Validation Consistency**
```javascript
// 동일한 입력에 대해 검증 결과가 항상 동일해야 함
validator.validate(table, data) === validator.validate(table, data)
```

**Property 2: Dry-Run Idempotence**
```javascript
// Dry-run은 여러 번 실행해도 결과가 동일해야 함
dryRun(config) === dryRun(config)
```

**Property 3: Migration Error Resilience**
```javascript
// 성공 + 실패 = 전체
migrate(records).success + migrate(records).failed === records.length
```

**Property 4: DAL Implementation Equivalence**
```javascript
// 두 구현체는 동일한 결과를 반환해야 함
dbImpl.read(entity, filters) ≈ gsImpl.read(entity, filters)
```

## 커버리지 리포트

### 커버리지 확인

```bash
# 커버리지 리포트 생성
npm run test:coverage

# 리포트 위치
# - 텍스트: 콘솔 출력
# - HTML: server/coverage/index.html
# - LCOV: server/coverage/lcov.info
```

### 커버리지 임계값

프로젝트는 최소 70% 커버리지를 요구합니다:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

임계값 미달 시 테스트가 실패합니다.

### HTML 리포트 보기

```bash
# 커버리지 생성 후
cd server/coverage
# index.html을 브라우저로 열기
```

HTML 리포트에서 다음을 확인할 수 있습니다:
- 파일별 커버리지 상세 정보
- 커버되지 않은 코드 라인 하이라이트
- 브랜치 커버리지 상세

## 모킹 (Mocking)

### Supabase 모킹

실제 데이터베이스 연결 없이 테스트하려면:

```javascript
// __tests__/mocks/supabase.mock.js

jest.mock('../../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: {}, error: null }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));
```

### Google Sheets 모킹

```javascript
jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
    useServiceAccountAuth: jest.fn(),
    loadInfo: jest.fn(),
    sheetsByTitle: {
      'TestSheet': {
        getRows: jest.fn(() => Promise.resolve([]))
      }
    }
  }))
}));
```

## 트러블슈팅

### 일반적인 문제

**1. 타임아웃 에러**
```javascript
// 특정 테스트의 타임아웃 증가
test('long running test', async () => {
  // ...
}, 60000); // 60초
```

**2. 환경 변수 누락**
```bash
# .env.test 파일 생성 또는
# test-setup.js에서 기본값 확인
```

**3. 모킹 문제**
```javascript
// 각 테스트 전에 모킹 초기화
beforeEach(() => {
  jest.clearAllMocks();
});
```

**4. PBT 실패 재현**
```bash
# 실패 시 출력된 시드 사용
PBT_SEED=12345 npm test
```

## 베스트 프랙티스

1. **테스트 격리**: 각 테스트는 독립적으로 실행 가능해야 함
2. **명확한 이름**: 테스트 이름은 무엇을 검증하는지 명확히 표현
3. **AAA 패턴**: Arrange, Act, Assert 순서로 작성
4. **모킹 최소화**: 가능한 실제 구현 사용, 필요시에만 모킹
5. **PBT 활용**: 엣지 케이스 발견을 위해 PBT 적극 활용
6. **커버리지 목표**: 70% 이상 유지, 중요 로직은 100% 목표

## 참고 자료

- [Jest 공식 문서](https://jestjs.io/)
- [fast-check 공식 문서](https://fast-check.dev/)
- [supertest GitHub](https://github.com/ladjs/supertest)
- [Property-Based Testing 가이드](https://fast-check.dev/docs/introduction/)
