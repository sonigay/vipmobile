# VIP Plus Server

(주)브이아이피플러스 - 모바일 재고 관리 시스템 백엔드 서버

## 개요

이 서버는 Google Sheets를 데이터베이스로 사용하는 Express 기반 REST API 서버입니다. 모바일 재고 관리, 개통 정보 관리, 예산 관리 등 다양한 기능을 제공합니다.

## 아키텍처

### 디렉토리 구조

```
server/
├── index.js                    # 메인 서버 파일 (333줄)
├── routes/                     # 라우트 모듈 (17개)
│   ├── healthRoutes.js        # 헬스체크
│   ├── loggingRoutes.js       # 로깅
│   ├── cacheRoutes.js         # 캐시 관리
│   ├── teamRoutes.js          # 팀 관리
│   ├── coordinateRoutes.js    # 좌표 변환
│   ├── storeRoutes.js         # 스토어 데이터
│   ├── modelRoutes.js         # 모델 데이터
│   ├── agentRoutes.js         # 대리점 데이터
│   ├── mapDisplayRoutes.js    # 지도 표시 옵션
│   ├── salesRoutes.js         # 영업 데이터
│   ├── inventoryRecoveryRoutes.js  # 재고회수
│   ├── activationRoutes.js    # 개통 데이터
│   ├── authRoutes.js          # 인증
│   ├── memberRoutes.js        # 고객 관리
│   ├── onsaleRoutes.js        # 개통정보 관리
│   ├── inventoryRoutes.js     # 재고 관리
│   ├── budgetRoutes.js        # 예산 관리
│   └── policyNoticeRoutes.js  # 정책 공지사항
├── middleware/                 # 미들웨어 (3개)
│   ├── timeoutMiddleware.js   # 타임아웃 처리
│   ├── loggingMiddleware.js   # 로깅
│   └── errorMiddleware.js     # 에러 처리
├── utils/                      # 유틸리티 (6개)
│   ├── sheetsClient.js        # Google Sheets 클라이언트
│   ├── cacheManager.js        # 캐시 관리
│   ├── rateLimiter.js         # Rate Limiting
│   ├── discordBot.js          # Discord 봇
│   ├── responseFormatter.js   # 응답 포맷터
│   └── errorHandler.js        # 에러 핸들러
├── config/                     # 설정
│   └── constants.js           # 상수 정의
├── directRoutes.js            # 직영점 라우트 (기존)
├── meetingRoutes.js           # 회의 라우트 (기존)
├── obRoutes.js                # OB 라우트 (기존)
├── policyTableRoutes.js       # 정책 테이블 라우트 (기존)
├── corsMiddleware.js          # CORS 미들웨어 (기존)
└── __tests__/                 # 테스트
```

### 라우트 모듈 패턴

모든 라우트 모듈은 팩토리 패턴을 사용합니다:

```javascript
// routes/exampleRoutes.js
const express = require('express');
const router = express.Router();

function createExampleRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter, discordBot } = context;

  router.get('/api/example', async (req, res) => {
    // 라우트 로직
  });

  return router;
}

module.exports = createExampleRoutes;
```

### 공통 컨텍스트 객체

모든 라우트 모듈은 공통 리소스를 컨텍스트 객체로 받습니다:

```javascript
const sharedContext = {
  sheetsClient: {
    sheets: GoogleSheetsAPI,
    SPREADSHEET_ID: string
  },
  cacheManager: CacheManager,
  rateLimiter: RateLimiter,
  discordBot: {
    bot: DiscordClient,
    EmbedBuilder: EmbedBuilder,
    sendNotification: Function,
    CHANNEL_ID: string,
    LOGGING_ENABLED: boolean
  }
};
```

## 설치 및 실행

### 필수 요구사항

- Node.js 22.x 이상
- npm 또는 yarn

### 환경 변수 설정

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```env
# 서버 설정
PORT=4000
NODE_ENV=development

# Google Sheets API
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SHEET_ID=your-spreadsheet-id

# Discord 봇 (선택적)
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CHANNEL_ID=your-channel-id
DISCORD_LOGGING_ENABLED=true

# Kakao Maps API
KAKAO_API_KEY=your-kakao-api-key

# CORS 설정 (선택적)
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
CORS_CREDENTIALS=true
```

### 설치

```bash
cd server
npm install
```

### 실행

```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션 모드
npm start

# PM2로 실행
pm2 start ecosystem.config.js
```

## API 엔드포인트

### Health Check

- `GET /health` - 서버 상태 확인
- `GET /api/version` - 서버 버전 정보
- `GET /api/cache-status` - 캐시 상태 확인

### 인증

- `POST /api/login` - 로그인
- `POST /api/verify-password` - 비밀번호 검증
- `POST /api/verify-direct-store-password` - 직영점 비밀번호 검증

### 팀 관리

- `GET /api/teams` - 팀 목록 조회
- `GET /api/team-leaders` - 팀장 목록 조회

### 스토어 관리

- `GET /api/stores` - 스토어 데이터 조회
- `GET /api/models` - 모델 데이터 조회
- `GET /api/agents` - 대리점 데이터 조회

### 재고 관리

- `GET /api/inventory/assignment-status` - 재고 배정 상태
- `POST /api/inventory/save-assignment` - 배정 저장
- `GET /api/inventory/normalized-status` - 정규화 재고 현황
- `POST /api/inventory/manual-assignment` - 수동 배정
- `GET /api/inventory/activation-status` - 개통 상태 확인
- `GET /api/inventory-analysis` - 재고 분석

### 개통 정보 관리

- `GET /api/onsale/activation-list` - 개통정보 목록
- `GET /api/onsale/activation-info/:sheetId/:rowIndex` - 개통정보 조회
- `POST /api/onsale/activation-info` - 개통정보 저장
- `PUT /api/onsale/activation-info/:sheetId/:rowIndex` - 개통정보 수정
- `POST /api/onsale/activation-info/:sheetId/:rowIndex/complete` - 개통완료
- `POST /api/onsale/activation-info/:sheetId/:rowIndex/pending` - 개통보류
- `POST /api/onsale/activation-info/:sheetId/:rowIndex/unpending` - 보류해제
- `POST /api/onsale/activation-info/:sheetId/:rowIndex/cancel` - 개통취소

### 예산 관리

- `GET /api/budget/policy-groups` - 정책그룹 목록
- `GET /api/budget/policy-group-settings` - 정책그룹 설정 목록
- `POST /api/budget/policy-group-settings` - 정책그룹 설정 저장
- `DELETE /api/budget/policy-group-settings/:name` - 정책그룹 설정 삭제
- `POST /api/budget/calculate-usage` - 사용예산 계산

### 고객 관리

- `POST /api/member/login` - 고객 로그인
- `GET /api/member/queue` - 구매 대기 목록
- `POST /api/member/queue` - 구매 대기 등록
- `PUT /api/member/queue/:id` - 구매 대기 수정
- `DELETE /api/member/queue/:id` - 구매 대기 삭제
- `GET /api/member/board` - 게시판 목록
- `POST /api/member/board` - 게시판 글 작성

### 기타

- `POST /api/client-logs` - 클라이언트 로그 수집
- `POST /api/log-activity` - 활동 로깅
- `POST /api/cache-refresh` - 캐시 새로고침
- `POST /api/update-coordinates` - 좌표 업데이트
- `GET /api/activation-data/current-month` - 당월 개통실적
- `GET /api/sales-data` - 영업 데이터

전체 API 목록은 각 라우트 모듈 파일을 참조하세요.

## 새 라우트 추가하기

### 1. 라우트 모듈 생성

`routes/` 디렉토리에 새 파일을 생성합니다:

```javascript
// routes/newFeatureRoutes.js
const express = require('express');
const router = express.Router();

/**
 * New Feature Routes
 * 
 * 새 기능의 API 엔드포인트를 제공합니다.
 */

function createNewFeatureRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter, discordBot } = context;

  // GET /api/new-feature
  router.get('/api/new-feature', async (req, res) => {
    try {
      // 캐시 확인
      const cacheKey = 'new_feature_data';
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached, cached: true });
      }

      // Google Sheets API 호출 (Rate Limiting 적용)
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'Sheet1!A:Z'
        })
      );

      const data = response.data.values || [];
      
      // 캐시 저장
      cacheManager.set(cacheKey, data);

      res.json({ success: true, data });
    } catch (error) {
      console.error('❌ Error fetching new feature data:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  return router;
}

module.exports = createNewFeatureRoutes;
```

### 2. index.js에 등록

`server/index.js`에 라우트를 추가합니다:

```javascript
// 라우트 모듈 로딩
const createNewFeatureRoutes = require('./routes/newFeatureRoutes');

// 라우트 등록
try {
  app.use('/', createNewFeatureRoutes(sharedContext));
  console.log('✅ New Feature routes mounted');
} catch (e) {
  console.error('❌ Failed to mount new feature routes:', e.message);
}
```

### 3. 테스트

```bash
# 서버 재시작
npm start

# API 테스트
curl http://localhost:4000/api/new-feature
```

## 테스트

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 실행
npm test -- routes/healthRoutes.test.js

# 커버리지 확인
npm run test:coverage

# Watch 모드
npm run test:watch
```

## 캐시 시스템

서버는 메모리 기반 캐시 시스템을 사용합니다:

- **TTL**: 5분 (300,000ms)
- **최대 크기**: 200개 항목
- **자동 정리**: TTL 만료 시 자동 삭제

캐시 사용 예시:

```javascript
// 캐시 저장
cacheManager.set('key', data, 300000); // 5분 TTL

// 캐시 조회
const cached = cacheManager.get('key');

// 캐시 삭제
cacheManager.delete('key');

// 패턴 기반 삭제
cacheManager.deletePattern('prefix_');

// 캐시 상태 확인
const status = cacheManager.status();
```

## Rate Limiting

Google Sheets API 호출은 Rate Limiter를 통해 제한됩니다:

- **최소 간격**: 500ms
- **재시도**: 최대 5회
- **Exponential Backoff**: 3초 × 2^attempt

사용 예시:

```javascript
const response = await rateLimiter.execute(() =>
  sheetsClient.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:Z'
  })
);
```

## 에러 처리

모든 에러는 일관된 형식으로 반환됩니다:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 500
}
```

개발 환경에서는 스택 트레이스도 포함됩니다.

## Discord 알림

심각한 에러(500+)는 Discord 채널로 자동 알림됩니다:

- 서버 충돌
- Uncaught Exception
- Unhandled Promise Rejection
- API 에러

## 배포

### Cloudtype 배포

`cloudtype.yml` 파일이 설정되어 있습니다:

```bash
# Cloudtype CLI로 배포
cloudtype deploy
```

### PM2 배포

```bash
# PM2로 시작
pm2 start ecosystem.config.js

# 상태 확인
pm2 status

# 로그 확인
pm2 logs

# 재시작
pm2 restart all
```

## 모니터링

### 헬스체크

```bash
curl http://localhost:4000/health
```

응답:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-25T...",
  "uptime": { "process": 123, "system": 456 },
  "memory": { ... },
  "cpu": { ... },
  "googleSheets": { "status": "healthy" }
}
```

### 캐시 상태

```bash
curl http://localhost:4000/api/cache-status
```

## 문제 해결

### Google Sheets API 연결 실패

```
⚠️  Google Sheets 클라이언트 초기화 실패
```

**해결 방법:**
1. `.env` 파일에 `GOOGLE_SERVICE_ACCOUNT_EMAIL`과 `GOOGLE_PRIVATE_KEY` 확인
2. Private Key에 `\n`이 제대로 이스케이프되어 있는지 확인
3. Service Account에 Spreadsheet 접근 권한이 있는지 확인

### Rate Limit 에러

```
⚠️ Rate limit error, retrying...
```

**해결 방법:**
- 자동으로 재시도됩니다 (최대 5회)
- 계속 발생하면 API 호출 빈도를 줄이세요

### 포트 충돌

```
Error: listen EADDRINUSE: address already in use :::4000
```

**해결 방법:**
```bash
# 포트 사용 중인 프로세스 종료
lsof -ti:4000 | xargs kill -9

# 또는 다른 포트 사용
PORT=4001 npm start
```

## 리팩토링 히스토리

이 서버는 대규모 리팩토링을 거쳤습니다:

- **원본**: 43,055줄의 단일 파일
- **리팩토링 후**: 333줄 + 17개 모듈
- **감소율**: 99.23%

자세한 내용은 `REFACTORING_STATUS.md`를 참조하세요.

## 라이선스

(주)브이아이피플러스 - All Rights Reserved

## 문의

기술 지원이 필요하면 개발팀에 문의하세요.
