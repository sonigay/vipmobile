# 통합 테스트 가이드

## 생성 일시
2025-01-25

---

## 개요
서버 엔드포인트의 통합 테스트 작성 및 실행 가이드입니다.

---

## 1. 테스트 환경 설정

### 1.1 필요한 패키지
이미 설치되어 있음:
- `jest` - 테스트 프레임워크
- `supertest` - HTTP 요청 테스트
- `fast-check` - Property-based 테스트

### 1.2 테스트 설정 파일
`server/jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/test-setup.js/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  setupFilesAfterEnv: ['./test-setup.js']
};
```

---

## 2. 테스트 작성 패턴

### 2.1 기본 구조
```javascript
const request = require('supertest');
const express = require('express');

describe('라우터 이름', () => {
  let app;
  let mockContext;

  beforeEach(() => {
    // 테스트용 앱 및 컨텍스트 설정
    app = express();
    app.use(express.json());
    
    mockContext = {
      sheetsClient: {
        sheets: mockSheetsClient,
        SPREADSHEET_ID: 'test-spreadsheet-id'
      },
      rateLimiter: {
        execute: jest.fn(fn => fn())
      },
      cacheManager: {
        get: jest.fn(),
        set: jest.fn()
      }
    };

    const router = createRouter(mockContext);
    app.use('/', router);
  });

  describe('GET /api/endpoint', () => {
    it('성공 케이스: 정상 응답', async () => {
      // 테스트 코드
    });

    it('실패 케이스: 에러 처리', async () => {
      // 테스트 코드
    });
  });
});
```

### 2.2 Health 엔드포인트 테스트 예시
```javascript
// server/__tests__/routes/healthRoutes.test.js
const request = require('supertest');
const express = require('express');
const createHealthRoutes = require('../../routes/healthRoutes');

describe('Health Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    const router = createHealthRoutes({});
    app.use('/', router);
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('VIP Plus Server');
    });
  });

  describe('GET /api/version', () => {
    it('should return version info', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
    });
  });
});
```

### 2.3 Auth 엔드포인트 테스트 예시
```javascript
// server/__tests__/routes/authRoutes.test.js
const request = require('supertest');
const express = require('express');
const createAuthRoutes = require('../../routes/authRoutes');

describe('Auth Routes', () => {
  let app;
  let mockContext;
  let mockSheetsClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockSheetsClient = {
      spreadsheets: {
        values: {
          get: jest.fn()
        }
      }
    };

    mockContext = {
      sheetsClient: {
        sheets: mockSheetsClient,
        SPREADSHEET_ID: 'test-id'
      },
      rateLimiter: {
        execute: jest.fn(fn => fn())
      },
      cacheManager: {
        get: jest.fn(),
        set: jest.fn()
      }
    };

    const router = createAuthRoutes(mockContext);
    app.use('/', router);
  });

  describe('POST /api/login', () => {
    it('should reject login without storeId', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle agent login successfully', async () => {
      // Mock Google Sheets response
      mockSheetsClient.spreadsheets.values.get.mockResolvedValueOnce({
        data: {
          values: [
            ['헤더행'],
            ['대리점명', '자격', '010-1234-5678', 'TRUE', '', '사무실', '소속', 'O', 'O']
          ]
        }
      });

      const response = await request(app)
        .post('/api/login')
        .send({ storeId: '010-1234-5678' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('isAgent', true);
      expect(response.body).toHaveProperty('modePermissions');
    });

    it('should return 404 for non-existent store', async () => {
      mockSheetsClient.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['헤더행']] }
      });

      const response = await request(app)
        .post('/api/login')
        .send({ storeId: 'non-existent' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/verify-password', () => {
    it('should reject without userId or password', async () => {
      const response = await request(app)
        .post('/api/verify-password')
        .send({ userId: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
```

---

## 3. 테스트 실행

### 3.1 모든 테스트 실행
```bash
cd server
npm test
```

### 3.2 특정 파일 테스트
```bash
npm test -- healthRoutes.test.js
```

### 3.3 Watch 모드
```bash
npm test -- --watch
```

### 3.4 커버리지 확인
```bash
npm test -- --coverage
```

---

## 4. 테스트 작성 가이드

### 4.1 성공 케이스 테스트
```javascript
it('should return data successfully', async () => {
  // Arrange: 테스트 데이터 준비
  const mockData = { /* ... */ };
  mockSheetsClient.spreadsheets.values.get.mockResolvedValue({
    data: { values: mockData }
  });

  // Act: 엔드포인트 호출
  const response = await request(app)
    .get('/api/endpoint')
    .expect(200);

  // Assert: 응답 검증
  expect(response.body).toHaveProperty('success', true);
  expect(response.body.data).toBeDefined();
});
```

### 4.2 실패 케이스 테스트
```javascript
it('should handle errors gracefully', async () => {
  // Arrange: 에러 발생 시뮬레이션
  mockSheetsClient.spreadsheets.values.get.mockRejectedValue(
    new Error('Network error')
  );

  // Act & Assert
  const response = await request(app)
    .get('/api/endpoint')
    .expect(500);

  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
});
```

### 4.3 파라미터 검증 테스트
```javascript
it('should validate required parameters', async () => {
  const response = await request(app)
    .post('/api/endpoint')
    .send({}) // 필수 파라미터 누락
    .expect(400);

  expect(response.body).toHaveProperty('success', false);
  expect(response.body.error).toContain('required');
});
```

### 4.4 권한 검증 테스트
```javascript
it('should check permissions', async () => {
  mockSheetsClient.spreadsheets.values.get.mockResolvedValue({
    data: { values: [['헤더'], ['user', '', '', '', '', '', '', '']] }
  });

  const response = await request(app)
    .get('/api/protected-endpoint')
    .expect(403);

  expect(response.body).toHaveProperty('success', false);
  expect(response.body.error).toContain('권한');
});
```

---

## 5. Mock 데이터 작성

### 5.1 Google Sheets Mock
```javascript
const mockAgentData = [
  ['대리점명', '자격', '연락처', '패스워드미사용', '패스워드', '사무실', '소속', 
   '재고모드', '정산모드', '검수모드', '채권장표', '정책모드', '검수전체현황', 
   '회의모드', '사전예약모드', '장표모드', '팀코드', '권한', '예산모드'],
  ['테스트대리점', '정규', '010-1234-5678', 'TRUE', '', '본사', '영업1팀', 
   'O', 'O', 'O', 'O', 'O', 'O', 'M', 'O', 'O', 'T001', 'ADMIN', 'O']
];

mockSheetsClient.spreadsheets.values.get.mockResolvedValue({
  data: { values: mockAgentData }
});
```

### 5.2 Store Mock
```javascript
const mockStoreData = [
  ['헤더1', '헤더2', '...', 'POS코드'],
  ['매장1', '주소1', '...', 'STORE001'],
  ['매장2', '주소2', '...', 'STORE002']
];
```

---

## 6. 테스트 커버리지 목표

### 6.1 우선순위별 커버리지
- **필수 엔드포인트** (로그인, Health): 90% 이상
- **핵심 엔드포인트** (매장, 대리점, 팀): 80% 이상
- **기타 엔드포인트**: 70% 이상

### 6.2 테스트 항목
각 엔드포인트마다:
- [ ] 성공 케이스 (최소 1개)
- [ ] 실패 케이스 (최소 1개)
- [ ] 파라미터 검증
- [ ] 에러 처리

---

## 7. 통합 테스트 체크리스트

### Health & Monitoring
- [ ] GET /health
- [ ] GET /
- [ ] GET /api/version
- [ ] POST /api/client-logs
- [ ] GET /api/cache-status

### Authentication
- [ ] POST /api/login (대리점 관리자)
- [ ] POST /api/login (일반 사용자)
- [ ] POST /api/login (실패 케이스)
- [ ] POST /api/verify-password
- [ ] POST /api/verify-direct-store-password

### Core Data
- [ ] GET /api/stores
- [ ] GET /api/agents
- [ ] GET /api/teams
- [ ] GET /api/team-leaders
- [ ] GET /api/models

### Sales & Activation
- [ ] GET /api/sales-data
- [ ] GET /api/sales-mode-access
- [ ] GET /api/activation-data/current-month
- [ ] GET /api/activation-data/previous-month

---

## 8. 테스트 실행 결과 예시

### 성공 케이스
```
PASS  server/__tests__/routes/healthRoutes.test.js
  Health Routes
    GET /health
      ✓ should return healthy status (25ms)
    GET /
      ✓ should return welcome message (15ms)
    GET /api/version
      ✓ should return version info (12ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        2.5s
```

### 커버리지 리포트
```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   85.5  |   78.2   |   82.1  |   86.3  |
 routes/            |   88.2  |   81.5   |   85.7  |   89.1  |
  healthRoutes.js   |   95.0  |   90.0   |   100   |   95.0  |
  authRoutes.js     |   82.5  |   75.0   |   80.0  |   83.2  |
--------------------|---------|----------|---------|---------|
```

---

## 9. 문제 해결

### 9.1 테스트 실패 시
1. 에러 메시지 확인
2. Mock 데이터 검증
3. 엔드포인트 로직 확인
4. 환경변수 확인

### 9.2 타임아웃 에러
```javascript
// 타임아웃 증가
jest.setTimeout(10000); // 10초
```

### 9.3 Mock 초기화
```javascript
afterEach(() => {
  jest.clearAllMocks();
});
```

---

## 10. 다음 단계

### 현재 상태
- ✅ 테스트 환경 설정 완료 (Jest, Supertest)
- ✅ 기존 테스트 파일 존재 (CORS 관련)
- ⏳ 엔드포인트별 테스트 작성 필요

### 권장 작업 순서
1. Health 엔드포인트 테스트 작성
2. Auth 엔드포인트 테스트 작성
3. Core Data 엔드포인트 테스트 작성
4. 테스트 실행 및 커버리지 확인

### 선택적 작업
- Property-based 테스트 추가
- E2E 테스트 작성
- 성능 테스트 추가

---

## 참고사항

### 테스트는 선택적
- 현재 서버는 테스트 없이도 실행 가능
- 테스트는 코드 품질 향상을 위한 추가 작업
- 시간이 부족하면 수동 테스트로 대체 가능

### 수동 테스트 우선
- Task 17에서 수동 테스트 진행
- curl 또는 Postman으로 주요 엔드포인트 확인
- 프론트엔드 연결 테스트

### 통합 테스트는 추후 진행 가능
- 서버 실행 후 필요 시 작성
- 버그 발견 시 테스트 케이스 추가
- 점진적으로 커버리지 향상
