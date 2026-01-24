# Design Document

## Overview

이 설계는 server/index.js (42,966줄)를 기능별 라우트 모듈로 분리하여 유지보수성을 개선하는 대규모 리팩토링을 다룹니다. 기존 코드의 기능을 100% 유지하면서, 코드 구조를 명확히 하고, 테스트 가능성을 높이며, 여러 개발자가 동시에 작업할 수 있도록 합니다.

### 설계 원칙

1. **하위 호환성 유지**: 모든 기존 API 엔드포인트 URL과 응답 형식 유지
2. **점진적 마이그레이션**: 각 라우트 그룹을 독립적으로 분리하여 위험 최소화
3. **공통 리소스 공유**: Google Sheets 클라이언트, 캐시, Rate Limiter 등을 모든 모듈에서 공유
4. **일관된 패턴**: 기존에 분리된 모듈(directRoutes, meetingRoutes)의 패턴 따르기
5. **테스트 가능성**: 의존성 주입을 통해 각 모듈을 독립적으로 테스트 가능하게 구성

## Architecture

### 현재 구조 (Before)

```
server/
├── index.js (42,966줄)
│   ├── 미들웨어 설정
│   ├── Google Sheets 클라이언트 초기화
│   ├── 캐시 시스템
│   ├── Rate Limiter
│   ├── Discord 봇
│   ├── 모든 API 라우트 (200+ 엔드포인트)
│   └── 에러 처리
├── directRoutes.js (이미 분리됨)
├── meetingRoutes.js (이미 분리됨)
├── obRoutes.js (이미 분리됨)
├── teamRoutes.js (이미 분리됨)
└── policyTableRoutes.js (이미 분리됨)
```

### 목표 구조 (After)

```
server/
├── index.js (핵심 서버 설정만, ~500줄 목표)
│   ├── 미들웨어 등록
│   ├── 공통 리소스 초기화
│   └── 라우트 모듈 로딩
├── routes/
│   ├── healthRoutes.js
│   ├── teamRoutes.js
│   ├── loggingRoutes.js
│   ├── cacheRoutes.js
│   ├── coordinateRoutes.js
│   ├── storeRoutes.js
│   ├── mapDisplayRoutes.js
│   ├── salesRoutes.js
│   ├── inventoryRecoveryRoutes.js
│   ├── modelRoutes.js
│   ├── agentRoutes.js
│   ├── activationRoutes.js
│   ├── authRoutes.js
│   ├── memberRoutes.js
│   ├── directRoutes.js (기존)
│   ├── onsaleRoutes.js
│   ├── inventoryRoutes.js
│   ├── meetingRoutes.js (기존)
│   ├── budgetRoutes.js
│   ├── policyNoticeRoutes.js
│   ├── obRoutes.js (기존)
│   ├── teamRoutes.js (기존)
│   └── policyTableRoutes.js (기존)
├── middleware/
│   ├── corsMiddleware.js (기존)
│   ├── timeoutMiddleware.js
│   ├── loggingMiddleware.js
│   └── errorMiddleware.js
├── utils/
│   ├── sheetsClient.js
│   ├── cacheManager.js
│   ├── rateLimiter.js
│   ├── discordBot.js
│   ├── responseFormatter.js
│   └── errorHandler.js
├── config/
│   └── constants.js
└── __tests__/
    └── routes/
```


## Components and Interfaces

### 1. Core Server (server/index.js)

리팩토링 후 index.js는 다음만 포함:

```javascript
// 환경 변수 로드
require('dotenv').config();
const express = require('express');

// 공통 리소스 초기화
const { sheetsClient, SPREADSHEET_ID } = require('./utils/sheetsClient');
const cacheManager = require('./utils/cacheManager');
const rateLimiter = require('./utils/rateLimiter');
const discordBot = require('./utils/discordBot');

// 미들웨어
const { corsMiddleware } = require('./middleware/corsMiddleware');
const timeoutMiddleware = require('./middleware/timeoutMiddleware');
const loggingMiddleware = require('./middleware/loggingMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();
const port = process.env.PORT || 4000;

// 미들웨어 등록 (순서 중요)
app.use(timeoutMiddleware);
app.use(corsMiddleware);
app.use(express.json());
app.use(loggingMiddleware);

// 공통 컨텍스트 객체 (모든 라우트에서 사용)
const context = {
  sheetsClient,
  SPREADSHEET_ID,
  cacheManager,
  rateLimiter,
  discordBot
};

// 라우트 모듈 로딩
const healthRoutes = require('./routes/healthRoutes');
const teamRoutes = require('./routes/teamRoutes');
// ... 기타 라우트 모듈

// 라우트 등록
app.use('/', healthRoutes(context));
app.use('/api', teamRoutes(context));
// ... 기타 라우트 등록

// 에러 처리 미들웨어 (마지막에 등록)
app.use(errorMiddleware);

// 서버 시작
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
```

### 2. 공통 유틸리티 모듈

#### 2.1 Google Sheets Client (utils/sheetsClient.js)

```javascript
const { google } = require('googleapis');

// Google Sheets 클라이언트 초기화
function createSheetsClient() {
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
    throw new Error('Missing Google Sheets environment variables');
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.includes('\\n') 
      ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : GOOGLE_PRIVATE_KEY,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  return { sheets, drive, auth, SPREADSHEET_ID };
}

module.exports = createSheetsClient();
```

#### 2.2 Rate Limiter (utils/rateLimiter.js)

```javascript
// Rate Limiter with exponential backoff
class RateLimiter {
  constructor(cooldown = 500, maxRetries = 5) {
    this.lastCall = 0;
    this.cooldown = cooldown;
    this.maxRetries = maxRetries;
  }

  async execute(apiCall) {
    // 기본 Rate Limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.cooldown) {
      const waitTime = this.cooldown - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        const isRateLimitError = this.isRateLimitError(error);
        
        if (isRateLimitError && attempt < this.maxRetries - 1) {
          const jitter = Math.random() * 2000;
          const baseDelay = 3000;
          const delay = baseDelay * Math.pow(2, attempt) + jitter;
          const waitTime = Math.min(delay, 60000);
          
          console.warn(`⚠️ Rate limit error, retrying in ${Math.round(waitTime)}ms (${attempt + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw error;
      }
    }
  }

  isRateLimitError(error) {
    return error.code === 429 ||
      (error.response && error.response.status === 429) ||
      (error.message && error.message.includes('Quota exceeded'));
  }
}

module.exports = new RateLimiter();
```


#### 2.3 Cache Manager (utils/cacheManager.js)

```javascript
// 캐시 시스템
class CacheManager {
  constructor(ttl = 5 * 60 * 1000, maxSize = 200) {
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  set(key, data, customTtl = null) {
    const now = Date.now();
    const ttl = customTtl || this.ttl;
    
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: now + ttl
    });

    // 캐시 크기 제한
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key) {
    this.cache.delete(key);
  }

  deletePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  status() {
    const now = Date.now();
    const validItems = Array.from(this.cache.entries())
      .filter(([key, item]) => now <= item.ttl);
    
    return {
      total: this.cache.size,
      valid: validItems.length,
      expired: this.cache.size - validItems.length
    };
  }
}

module.exports = new CacheManager();
```

#### 2.4 Discord Bot (utils/discordBot.js)

```javascript
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

let discordBot = null;
let EmbedBuilderClass = null;

if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
  try {
    discordBot = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    EmbedBuilderClass = EmbedBuilder;

    discordBot.once('ready', () => {
      console.log('🤖 Discord 봇이 준비되었습니다:', discordBot.user.tag);
    });

    discordBot.login(DISCORD_BOT_TOKEN);
  } catch (error) {
    console.error('디스코드 봇 초기화 실패:', error.message);
  }
}

async function sendDiscordNotification(channelId, embed) {
  if (!DISCORD_LOGGING_ENABLED || !discordBot || !discordBot.isReady()) {
    return;
  }

  try {
    const channel = await discordBot.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Discord 알림 전송 실패:', error);
  }
}

module.exports = {
  discordBot,
  EmbedBuilder: EmbedBuilderClass,
  sendDiscordNotification,
  DISCORD_CHANNEL_ID,
  DISCORD_LOGGING_ENABLED
};
```

#### 2.5 Response Formatter (utils/responseFormatter.js)

```javascript
// 표준화된 응답 형식
function successResponse(data, message = null) {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

function errorResponse(error, statusCode = 500) {
  return {
    success: false,
    error: error.message || 'Internal server error',
    statusCode
  };
}

module.exports = {
  successResponse,
  errorResponse
};
```

#### 2.6 Error Handler (utils/errorHandler.js)

```javascript
// 공통 에러 처리 함수
function handleError(error, req, res, context = {}) {
  console.error('❌ Error:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    ...context
  });

  // Discord 알림 (심각한 에러만)
  if (error.statusCode >= 500) {
    // Discord 알림 로직
  }

  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

module.exports = { handleError };
```

### 3. 미들웨어 모듈

#### 3.1 Timeout Middleware (middleware/timeoutMiddleware.js)

```javascript
const { setBasicCORSHeaders } = require('./corsMiddleware');

function timeoutMiddleware(req, res, next) {
  const startTime = Date.now();
  const timeoutDuration = 300000; // 5분
  
  req.setTimeout(timeoutDuration);
  res.setTimeout(timeoutDuration);
  
  req.on('timeout', () => {
    const elapsedTime = Date.now() - startTime;
    
    setBasicCORSHeaders(req, res);
    
    console.error('⏱️ Request timeout:', {
      url: req.originalUrl,
      method: req.method,
      elapsedTime: `${elapsedTime}ms`,
      timeout: `${timeoutDuration}ms`
    });
    
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request exceeded 5 minute timeout',
        elapsedTime
      });
    }
  });
  
  next();
}

module.exports = timeoutMiddleware;
```

#### 3.2 Logging Middleware (middleware/loggingMiddleware.js)

```javascript
function loggingMiddleware(req, res, next) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`📡 [${timestamp}] ${method} ${url} - IP: ${ip}`);

  res.on('finish', () => {
    const statusCode = res.statusCode;
    const responseTime = Date.now() - req.startTime;
    console.log(`✅ [${timestamp}] ${method} ${url} - ${statusCode} - ${responseTime}ms`);
  });

  req.startTime = Date.now();
  next();
}

module.exports = loggingMiddleware;
```

#### 3.3 Error Middleware (middleware/errorMiddleware.js)

```javascript
function errorMiddleware(err, req, res, next) {
  console.error('❌ Unhandled error:', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack
  });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorMiddleware;
```


### 4. 라우트 모듈 패턴

모든 라우트 모듈은 다음 패턴을 따릅니다:

```javascript
// routes/exampleRoutes.js
const express = require('express');
const router = express.Router();

/**
 * Example Routes
 * 
 * 이 모듈은 예제 기능의 API 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/example - 예제 데이터 조회
 * - POST /api/example - 예제 데이터 생성
 */

function createExampleRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter, discordBot } = context;

  // GET /api/example
  router.get('/example', async (req, res) => {
    try {
      // 캐시 확인
      const cacheKey = 'example_data';
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
      console.error('❌ Error fetching example data:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // POST /api/example
  router.post('/example', async (req, res) => {
    try {
      const { name, value } = req.body;

      // 유효성 검사
      if (!name || !value) {
        return res.status(400).json({
          success: false,
          error: 'Name and value are required'
        });
      }

      // Google Sheets API 호출
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'Sheet1!A:B',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[name, value]]
          }
        })
      );

      // 캐시 무효화
      cacheManager.delete('example_data');

      res.json({ success: true, message: 'Data created successfully' });
    } catch (error) {
      console.error('❌ Error creating example data:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  return router;
}

module.exports = createExampleRoutes;
```

### 5. 라우트 그룹 정의

#### 5.1 Health Check Routes (routes/healthRoutes.js)

**엔드포인트:**
- GET /health - 서버 헬스체크
- GET / - 서버 상태 확인
- GET /api/version - 서버 버전 정보
- GET /api/cache-status - 캐시 상태 확인

**책임:**
- 서버 상태 모니터링
- 메모리, CPU 사용량 확인
- Google Sheets 연결 상태 확인
- 캐시 통계 제공

#### 5.2 Team Routes (routes/teamRoutes.js)

**엔드포인트:**
- GET /api/teams - 팀 목록 조회
- GET /api/team-leaders - 팀장 목록 조회

**책임:**
- 대리점아이디관리 시트에서 팀 정보 조회
- 권한 레벨 기반 팀장 필터링

#### 5.3 Logging Routes (routes/loggingRoutes.js)

**엔드포인트:**
- POST /api/client-logs - 클라이언트 로그 수집
- POST /api/log-activity - 사용자 활동 로깅

**책임:**
- 프론트엔드 로그 수집
- 사용자 활동 추적
- Discord 알림 전송

#### 5.4 Cache Routes (routes/cacheRoutes.js)

**엔드포인트:**
- POST /api/cache-refresh - 캐시 강제 새로고침

**책임:**
- 특정 시트의 캐시 무효화
- 전체 캐시 초기화

#### 5.5 Coordinate Routes (routes/coordinateRoutes.js)

**엔드포인트:**
- POST /api/update-coordinates - 주소를 위도/경도로 변환
- POST /api/update-sales-coordinates - 판매점 좌표 업데이트

**책임:**
- Kakao Maps API를 사용한 지오코딩
- Google Sheets에 좌표 업데이트

#### 5.6 Store Routes (routes/storeRoutes.js)

**엔드포인트:**
- GET /api/stores - 스토어 데이터 조회

**책임:**
- 폰클출고처데이터 시트 조회
- 출고 제외 필터링
- 캐싱 적용

#### 5.7 Map Display Routes (routes/mapDisplayRoutes.js)

**엔드포인트:**
- GET /api/map-display-option - 지도 재고 노출 옵션 조회
- POST /api/map-display-option - 지도 재고 노출 옵션 저장
- POST /api/map-display-option/batch - 배치 저장 (M 권한자용)
- GET /api/map-display-option/values - 선택값 목록 조회
- GET /api/map-display-option/users - O 사용자 목록 조회

**책임:**
- 지도 재고 노출 설정 관리
- 권한 기반 접근 제어

#### 5.8 Sales Routes (routes/salesRoutes.js)

**엔드포인트:**
- GET /api/sales-data - 영업 모드 데이터 조회
- GET /api/sales-mode-access - 영업 모드 접근 권한 확인

**책임:**
- 판매점정보 시트 조회
- 권한 기반 접근 제어

#### 5.9 Inventory Recovery Routes (routes/inventoryRecoveryRoutes.js)

**엔드포인트:**
- GET /api/inventoryRecoveryAccess - 재고회수 모드 접근 권한 확인

**책임:**
- 재고회수 권한 검증

#### 5.10 Model Routes (routes/modelRoutes.js)

**엔드포인트:**
- GET /api/models - 모델과 색상 데이터 조회

**책임:**
- 폰클재고데이터 시트에서 모델 정보 추출
- 중복 제거 및 정렬

#### 5.11 Agent Routes (routes/agentRoutes.js)

**엔드포인트:**
- GET /api/agents - 대리점 ID 정보 조회

**책임:**
- 대리점아이디관리 시트 조회
- 권한 정보 포함

#### 5.12 Activation Routes (routes/activationRoutes.js)

**엔드포인트:**
- GET /api/activation-data/current-month - 당월 개통실적
- GET /api/activation-data/previous-month - 전월 개통실적
- GET /api/activation-data/by-date - 날짜별 개통실적
- GET /api/activation-data/date-comparison/:date - 날짜 비교

**책임:**
- 폰클개통데이터 시트 조회
- 날짜별 필터링 및 집계


#### 5.13 Auth Routes (routes/authRoutes.js)

**엔드포인트:**
- POST /api/login - 로그인 검증
- POST /api/verify-password - 패스워드 검증
- POST /api/verify-direct-store-password - 직영점 비밀번호 검증

**책임:**
- 사용자 인증
- 비밀번호 검증
- 로그인 이력 기록

#### 5.14 Member Routes (routes/memberRoutes.js)

**엔드포인트:**
- POST /api/member/login - 고객 로그인
- GET /api/member/queue/all - 모든 구매 대기 목록
- GET /api/member/queue - 고객 구매 대기 목록
- POST /api/member/queue - 구매 대기 등록
- PUT /api/member/queue/:id - 구매 대기 수정
- DELETE /api/member/queue/:id - 구매 대기 삭제
- GET /api/member/board - 게시판 목록
- GET /api/member/board/:id - 게시판 상세
- POST /api/member/board - 게시판 글 작성
- PUT /api/member/board/:id - 게시판 글 수정
- DELETE /api/member/board/:id - 게시판 글 삭제

**책임:**
- 고객 인증 및 세션 관리
- 구매 대기 큐 관리
- 게시판 CRUD 작업

#### 5.15 Onsale Routes (routes/onsaleRoutes.js)

**엔드포인트:**
- POST /api/onsale/activation-info/:sheetId/:rowIndex/complete - 개통완료
- POST /api/onsale/activation-info/:sheetId/:rowIndex/pending - 개통보류
- POST /api/onsale/activation-info/:sheetId/:rowIndex/unpending - 보류해제
- POST /api/onsale/activation-info/:sheetId/:rowIndex/cancel - 개통취소
- GET /api/onsale/activation-list - 개통정보 목록
- GET /api/onsale/activation-info/:sheetId/:rowIndex - 개통정보 조회
- PUT /api/onsale/activation-info/:sheetId/:rowIndex - 개통정보 수정
- POST /api/onsale/activation-info - 개통정보 저장
- POST /api/onsale/uplus-submission - U+ 제출 데이터 저장
- GET /api/onsale/links - 온세일 링크 목록 (관리자)
- GET /api/onsale/active-links - 활성화된 링크 (일반)
- POST /api/onsale/links - 링크 추가
- PUT /api/onsale/links/:rowIndex - 링크 수정
- DELETE /api/onsale/links/:rowIndex - 링크 삭제
- GET /api/onsale/policies/groups - 정책 그룹 목록
- GET /api/onsale/policies - 정책 목록
- GET /api/onsale/policies/:id - 정책 상세
- POST /api/onsale/policies - 정책 등록
- PUT /api/onsale/policies/:id - 정책 수정
- DELETE /api/onsale/policies/:id - 정책 삭제
- POST /api/onsale/policies/:id/view - 정책 확인 이력
- POST /api/onsale-proxy - 온세일 프록시

**책임:**
- 개통정보 관리 (CRUD, 상태 변경)
- 온세일 링크 관리
- 정책 게시판 관리
- U+ 제출 데이터 처리

#### 5.16 Inventory Routes (routes/inventoryRoutes.js)

**엔드포인트:**
- GET /api/inventory/assignment-status - 재고배정 상태 계산
- POST /api/inventory/save-assignment - 배정 저장
- GET /api/inventory/normalized-status - 정규화작업시트 재고 현황
- POST /api/inventory/manual-assignment - 수동 배정 실행
- GET /api/inventory/activation-status - 실시간 개통 상태 확인
- GET /api/inventory-analysis - 재고 현황 분석

**책임:**
- 재고 배정 로직
- 재고 현황 집계
- 개통 상태 확인
- 재고 분석

#### 5.17 Budget Routes (routes/budgetRoutes.js)

**엔드포인트:**
- GET /api/budget/policy-groups - 정책그룹 목록
- POST /api/budget/policy-group-settings - 정책그룹 설정 저장
- GET /api/budget/policy-group-settings - 정책그룹 설정 목록
- DELETE /api/budget/policy-group-settings/:name - 정책그룹 설정 삭제
- POST /api/budget/calculate-usage - 사용예산 계산

**책임:**
- 정책그룹 관리
- 예산 계산 로직
- 예산 사용 현황 집계

#### 5.18 Policy Notice Routes (routes/policyNoticeRoutes.js)

**엔드포인트:**
- GET /api/policy-notices - 공지사항 목록
- POST /api/policy-notices - 공지사항 생성
- PUT /api/policy-notices/:id - 공지사항 수정
- DELETE /api/policy-notices/:id - 공지사항 삭제

**책임:**
- 정책 공지사항 CRUD
- 연월 및 카테고리 필터링

## Data Models

### Context Object

모든 라우트 모듈에 전달되는 공통 컨텍스트:

```typescript
interface Context {
  sheetsClient: {
    sheets: GoogleSheetsAPI;
    drive: GoogleDriveAPI;
    auth: JWT;
    SPREADSHEET_ID: string;
  };
  cacheManager: CacheManager;
  rateLimiter: RateLimiter;
  discordBot: {
    bot: Client | null;
    EmbedBuilder: typeof EmbedBuilder | null;
    sendNotification: (channelId: string, embed: Embed) => Promise<void>;
    CHANNEL_ID: string;
    LOGGING_ENABLED: boolean;
  };
}
```

### Route Module Function Signature

```typescript
type RouteModuleFactory = (context: Context) => express.Router;
```

### Cache Entry

```typescript
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}
```

### Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  statusCode?: number;
  stack?: string; // development only
}
```

### Success Response

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  cached?: boolean;
}
```


## Correctness Properties

Property-based testing은 소프트웨어의 정확성을 검증하기 위해 많은 생성된 입력에 대해 보편적 속성을 테스트합니다. 각 속성은 모든 유효한 입력에 대해 참이어야 하는 형식적 명세입니다.

### Property Reflection

Prework 분석 결과, 다음과 같은 중복 및 통합 가능한 속성들을 식별했습니다:

**통합 가능한 속성들:**
- 1.3 (엔드포인트 URL 유지), 8.1 (기존 기능 100% 유지), 14.1 (API URL 유지) → 단일 속성으로 통합
- 3.5 (미들웨어 에러 형식), 12.1 (서버 에러 형식) → 단일 속성으로 통합
- 8.3 (API 응답 형식 유지), 14.2 (응답 구조 유지) → 단일 속성으로 통합
- 13.1, 13.2, 13.3, 13.4 (성능 관련) → 성능 유지 속성으로 통합

**제거 가능한 중복:**
- 2.4, 2.5, 5.1, 6.1 (파일 구조) → 단일 예제 테스트로 충분
- 10.1-10.5 (테스트 가능성) → 설계 검증이므로 속성 테스트 불필요

### Property 1: API 엔드포인트 하위 호환성

*For any* 기존 API 엔드포인트, 리팩토링 후에도 동일한 URL로 접근 가능하고 동일한 응답 형식을 반환해야 합니다.

**Validates: Requirements 1.3, 8.1, 8.3, 14.1, 14.2**

### Property 2: 에러 응답 일관성

*For any* 에러 상황, 모든 라우트 모듈은 동일한 에러 응답 형식 `{ success: false, error: string, statusCode?: number }`을 반환해야 합니다.

**Validates: Requirements 2.3, 3.5, 8.4, 12.1**

### Property 3: Rate Limiter 최소 간격 보장

*For any* 연속된 Google Sheets API 호출, Rate Limiter는 최소 500ms 간격을 보장해야 합니다.

**Validates: Requirements 4.3, 13.5**

### Property 4: 캐시 TTL 준수

*For any* 캐시된 데이터, 5분(300,000ms) 후에는 만료되어 캐시에서 제거되어야 합니다.

**Validates: Requirements 5.2**

### Property 5: 성능 유지

*For any* API 엔드포인트, 리팩토링 후 평균 응답 시간은 리팩토링 전 대비 120% 이내여야 합니다.

**Validates: Requirements 8.5, 13.1, 13.2, 13.3, 13.4**


## Error Handling

### 에러 처리 전략

1. **일관된 에러 응답 형식**
   ```javascript
   {
     success: false,
     error: "Error message",
     statusCode: 500,
     stack: "..." // development only
   }
   ```

2. **에러 타입별 처리**
   - **400 Bad Request**: 유효성 검사 실패
   - **401 Unauthorized**: 인증 실패
   - **403 Forbidden**: 권한 부족
   - **404 Not Found**: 리소스 없음
   - **429 Too Many Requests**: Rate Limit 초과 (자동 재시도)
   - **500 Internal Server Error**: 서버 에러 (Discord 알림)
   - **504 Gateway Timeout**: 타임아웃 (CORS 헤더 포함)

3. **Google Sheets API 에러 처리**
   - Rate Limit 에러 (429, RESOURCE_EXHAUSTED): Exponential backoff로 자동 재시도
   - 인증 에러: 명확한 에러 메시지와 함께 즉시 실패
   - 네트워크 에러: 최대 5회 재시도

4. **Discord 알림**
   - 500 에러: 관리자 채널에 알림
   - 서버 충돌: @everyone 멘션과 함께 긴급 알림
   - Discord 전송 실패: 콘솔에 로그만 기록하고 서버 계속 실행

5. **에러 로깅**
   ```javascript
   console.error('❌ Error:', {
     path: req.path,
     method: req.method,
     error: error.message,
     stack: error.stack?.split('\n').slice(0, 3).join('\n'),
     timestamp: new Date().toISOString()
   });
   ```

### 에러 처리 흐름

```
Request → Middleware → Route Handler
                ↓              ↓
            Error?         Error?
                ↓              ↓
         Error Middleware ←────┘
                ↓
         Log to Console
                ↓
         Discord Notification (if 500+)
                ↓
         Send Error Response
```

## Testing Strategy

### 테스트 접근 방식

이 리팩토링 프로젝트는 **기존 기능의 100% 유지**가 핵심이므로, 다음과 같은 이중 테스트 전략을 사용합니다:

1. **통합 테스트 (Integration Tests)**
   - 리팩토링 전후의 API 응답 비교
   - 모든 엔드포인트에 대한 회귀 테스트
   - 실제 Google Sheets API 호출 (테스트 시트 사용)

2. **단위 테스트 (Unit Tests)**
   - 각 유틸리티 함수의 독립적 테스트
   - 모의 객체를 사용한 라우트 모듈 테스트
   - 미들웨어 동작 검증

3. **Property-Based Tests**
   - 보편적 속성 검증 (최소 100회 반복)
   - 무작위 입력 생성으로 엣지 케이스 발견
   - fast-check 라이브러리 사용

### 테스트 구조

```
server/__tests__/
├── integration/
│   ├── api-compatibility.test.js    # API 호환성 테스트
│   ├── performance.test.js          # 성능 비교 테스트
│   └── end-to-end.test.js          # E2E 테스트
├── unit/
│   ├── utils/
│   │   ├── cacheManager.test.js
│   │   ├── rateLimiter.test.js
│   │   ├── sheetsClient.test.js
│   │   └── discordBot.test.js
│   ├── middleware/
│   │   ├── timeout.test.js
│   │   ├── logging.test.js
│   │   └── error.test.js
│   └── routes/
│       ├── healthRoutes.test.js
│       ├── teamRoutes.test.js
│       └── ... (각 라우트 모듈)
└── properties/
    ├── api-compatibility.properties.test.js
    ├── error-handling.properties.test.js
    ├── rate-limiting.properties.test.js
    ├── cache-ttl.properties.test.js
    └── performance.properties.test.js
```

### Property-Based Test 설정

각 속성 테스트는 다음 형식을 따릅니다:

```javascript
const fc = require('fast-check');

describe('Property: API Endpoint Compatibility', () => {
  it('should maintain backward compatibility for all endpoints', () => {
    // Feature: server-routes-refactoring, Property 1: API 엔드포인트 하위 호환성
    fc.assert(
      fc.property(
        fc.constantFrom(...existingEndpoints),
        fc.record({
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          params: fc.object(),
          body: fc.object()
        }),
        async (endpoint, request) => {
          const oldResponse = await callOldAPI(endpoint, request);
          const newResponse = await callNewAPI(endpoint, request);
          
          expect(newResponse.status).toBe(oldResponse.status);
          expect(newResponse.data).toEqual(oldResponse.data);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 테스트 실행 순서

1. **Phase 1: 기준선 수집**
   - 리팩토링 전 모든 API 엔드포인트의 응답 기록
   - 성능 메트릭 수집 (응답 시간, 메모리 사용량)

2. **Phase 2: 단위 테스트**
   - 각 유틸리티 모듈 독립 테스트
   - 미들웨어 동작 검증

3. **Phase 3: 통합 테스트**
   - 리팩토링 후 API 응답과 기준선 비교
   - 모든 엔드포인트 회귀 테스트

4. **Phase 4: Property-Based Tests**
   - 보편적 속성 검증
   - 무작위 입력으로 엣지 케이스 발견

5. **Phase 5: 성능 테스트**
   - 응답 시간 비교
   - 메모리 사용량 비교
   - 동시 요청 처리 능력 비교

### 테스트 커버리지 목표

- **라인 커버리지**: 80% 이상
- **브랜치 커버리지**: 75% 이상
- **함수 커버리지**: 90% 이상
- **API 엔드포인트 커버리지**: 100%

### 모의 객체 (Mocks)

테스트에서 사용할 모의 객체:

```javascript
// Mock Google Sheets Client
const mockSheetsClient = {
  sheets: {
    spreadsheets: {
      values: {
        get: jest.fn(),
        update: jest.fn(),
        append: jest.fn()
      }
    }
  },
  SPREADSHEET_ID: 'test-sheet-id'
};

// Mock Cache Manager
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  deletePattern: jest.fn(),
  cleanup: jest.fn(),
  status: jest.fn()
};

// Mock Rate Limiter
const mockRateLimiter = {
  execute: jest.fn(async (fn) => await fn())
};

// Mock Discord Bot
const mockDiscordBot = {
  bot: null,
  EmbedBuilder: null,
  sendNotification: jest.fn(),
  CHANNEL_ID: 'test-channel-id',
  LOGGING_ENABLED: false
};
```

## Migration Plan

### 마이그레이션 단계

리팩토링은 다음 순서로 점진적으로 진행합니다:

**Phase 1: 공통 인프라 분리 (Week 1)**
1. utils/sheetsClient.js 생성
2. utils/cacheManager.js 생성
3. utils/rateLimiter.js 생성
4. utils/discordBot.js 생성
5. utils/responseFormatter.js 생성
6. utils/errorHandler.js 생성
7. config/constants.js 생성
8. 단위 테스트 작성 및 실행

**Phase 2: 미들웨어 분리 (Week 1)**
1. middleware/timeoutMiddleware.js 생성
2. middleware/loggingMiddleware.js 생성
3. middleware/errorMiddleware.js 생성
4. index.js에서 미들웨어 등록 순서 확인
5. 단위 테스트 작성 및 실행

**Phase 3: 간단한 라우트 모듈 분리 (Week 2)**
1. routes/healthRoutes.js
2. routes/loggingRoutes.js
3. routes/cacheRoutes.js
4. 각 모듈 테스트 및 배포
5. 프로덕션 모니터링

**Phase 4: 중간 복잡도 라우트 모듈 분리 (Week 2-3)**
1. routes/teamRoutes.js (기존 재구성)
2. routes/coordinateRoutes.js
3. routes/storeRoutes.js
4. routes/modelRoutes.js
5. routes/agentRoutes.js
6. 각 모듈 테스트 및 배포

**Phase 5: 복잡한 라우트 모듈 분리 (Week 3-4)**
1. routes/mapDisplayRoutes.js
2. routes/salesRoutes.js
3. routes/activationRoutes.js
4. routes/authRoutes.js
5. 각 모듈 테스트 및 배포

**Phase 6: 대규모 라우트 모듈 분리 (Week 4-5)**
1. routes/memberRoutes.js
2. routes/onsaleRoutes.js
3. routes/inventoryRoutes.js
4. routes/budgetRoutes.js
5. routes/policyNoticeRoutes.js
6. 각 모듈 테스트 및 배포

**Phase 7: index.js 정리 및 최종 검증 (Week 5)**
1. index.js에서 모든 라우트 코드 제거
2. 라우트 모듈 로딩 로직만 유지
3. 전체 통합 테스트 실행
4. 성능 테스트 실행
5. Property-based 테스트 실행
6. 최종 배포

### 롤백 계획

각 Phase마다 롤백 가능한 상태를 유지합니다:

1. **Git 브랜치 전략**
   - main: 프로덕션 코드
   - refactor/phase-N: 각 Phase별 브랜치
   - 각 Phase 완료 후 main에 머지

2. **배포 전 체크리스트**
   - [ ] 모든 단위 테스트 통과
   - [ ] 모든 통합 테스트 통과
   - [ ] Property-based 테스트 통과
   - [ ] 성능 테스트 통과 (120% 이내)
   - [ ] 코드 리뷰 완료
   - [ ] 문서 업데이트 완료

3. **모니터링 지표**
   - API 응답 시간
   - 에러율
   - Google Sheets API 할당량 사용량
   - 메모리 사용량
   - CPU 사용량

4. **롤백 트리거**
   - 에러율 5% 이상 증가
   - 평균 응답 시간 50% 이상 증가
   - Google Sheets API 할당량 초과
   - 메모리 누수 감지

### 위험 관리

**위험 요소:**
1. Google Sheets API 할당량 초과
2. 캐시 동작 변경으로 인한 성능 저하
3. 라우트 등록 순서 변경으로 인한 충돌
4. 공유 리소스 동시성 문제

**완화 전략:**
1. Rate Limiter 강화 및 모니터링
2. 캐시 히트율 모니터링 및 TTL 조정
3. 라우트 등록 순서 명시적 문서화
4. 공유 리소스에 대한 동시성 테스트

## Documentation

### 코드 문서화 표준

1. **파일 헤더 주석**
   ```javascript
   /**
    * Health Check Routes
    * 
    * 서버 상태 모니터링을 위한 API 엔드포인트를 제공합니다.
    * 
    * Endpoints:
    * - GET /health - 서버 헬스체크 (메모리, CPU, Google Sheets 연결 상태)
    * - GET / - 서버 상태 확인
    * - GET /api/version - 서버 버전 정보
    * - GET /api/cache-status - 캐시 상태 확인
    * 
    * @module routes/healthRoutes
    */
   ```

2. **함수 JSDoc**
   ```javascript
   /**
    * 캐시에 데이터를 저장합니다.
    * 
    * @param {string} key - 캐시 키
    * @param {any} data - 저장할 데이터
    * @param {number} [customTtl] - 커스텀 TTL (밀리초), 기본값은 5분
    * @returns {void}
    */
   set(key, data, customTtl = null) {
     // ...
   }
   ```

3. **복잡한 로직 인라인 주석**
   ```javascript
   // Rate Limit 에러 감지 (429, RESOURCE_EXHAUSTED)
   const isRateLimitError = 
     error.code === 429 ||
     (error.response && error.response.status === 429) ||
     (error.message && error.message.includes('Quota exceeded'));
   ```

### README 업데이트

리팩토링 완료 후 README.md에 다음 섹션 추가:

```markdown
## Server Architecture

### Directory Structure

- `server/index.js` - Main server entry point
- `server/routes/` - API route modules
- `server/middleware/` - Express middleware
- `server/utils/` - Shared utilities
- `server/config/` - Configuration constants

### Adding New Routes

1. Create a new file in `server/routes/`
2. Follow the route module pattern
3. Export a factory function that accepts context
4. Register the route in `server/index.js`

Example:
\`\`\`javascript
// routes/exampleRoutes.js
const express = require('express');
const router = express.Router();

function createExampleRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;
  
  router.get('/example', async (req, res) => {
    // Implementation
  });
  
  return router;
}

module.exports = createExampleRoutes;
\`\`\`

### Testing

Run tests:
\`\`\`bash
npm test                    # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:properties    # Property-based tests only
\`\`\`
```

## Conclusion

이 설계는 server/index.js를 기능별로 모듈화하여 유지보수성을 크게 개선합니다. 핵심 원칙은:

1. **하위 호환성 유지**: 모든 기존 API 엔드포인트와 응답 형식 유지
2. **점진적 마이그레이션**: 5주에 걸쳐 단계적으로 진행하여 위험 최소화
3. **공통 리소스 공유**: Google Sheets 클라이언트, 캐시, Rate Limiter 등을 모든 모듈에서 공유
4. **일관된 패턴**: 모든 라우트 모듈이 동일한 구조와 인터페이스 사용
5. **테스트 가능성**: 의존성 주입을 통해 각 모듈을 독립적으로 테스트 가능

리팩토링 완료 후:
- index.js: 42,966줄 → ~500줄 (98.8% 감소)
- 19개의 독립적인 라우트 모듈
- 6개의 공통 유틸리티 모듈
- 3개의 미들웨어 모듈
- 100% API 호환성 유지
- 성능 저하 없음 (120% 이내)
