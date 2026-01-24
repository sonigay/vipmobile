/**
 * VIP Plus Server
 * 
 * 리팩토링된 서버 메인 파일
 * - 모든 라우트가 별도 모듈로 분리됨
 * - 공통 리소스를 컨텍스트 객체로 공유
 * - 미들웨어 기반 에러 처리
 */

require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 4000;

// ============================================================================
// 공통 리소스 초기화
// ============================================================================

let sheetsClient = null;
let SPREADSHEET_ID = null;

try {
  const sheetsModule = require('./utils/sheetsClient');
  sheetsClient = sheetsModule.sheets;
  SPREADSHEET_ID = sheetsModule.SPREADSHEET_ID;
  console.log('✅ Google Sheets 클라이언트 초기화 완료');
} catch (error) {
  console.warn('⚠️  Google Sheets 클라이언트 초기화 실패:', error.message);
  console.warn('⚠️  환경 변수를 확인하세요. 서버는 제한된 기능으로 계속 실행됩니다.');
}

const cacheManager = require('./utils/cacheManager');
const rateLimiter = require('./utils/rateLimiter');
const { discordBot, EmbedBuilder, sendDiscordNotification, DISCORD_CHANNEL_ID, DISCORD_LOGGING_ENABLED } = require('./utils/discordBot');

// 공통 컨텍스트 객체 (모든 라우트에서 사용)
const sharedContext = {
  sheetsClient: {
    sheets: sheetsClient,
    SPREADSHEET_ID: SPREADSHEET_ID
  },
  cacheManager,
  rateLimiter,
  discordBot: {
    bot: discordBot,
    EmbedBuilder,
    sendNotification: sendDiscordNotification,
    CHANNEL_ID: DISCORD_CHANNEL_ID,
    LOGGING_ENABLED: DISCORD_LOGGING_ENABLED
  }
};

// ============================================================================
// 미들웨어 설정
// ============================================================================

const timeoutMiddleware = require('./middleware/timeoutMiddleware');
const { corsMiddleware } = require('./corsMiddleware');
const loggingMiddleware = require('./middleware/loggingMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');

// 미들웨어 등록 (순서 중요)
app.use(timeoutMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(loggingMiddleware);

// ============================================================================
// 라우트 모듈 로딩
// ============================================================================

// Phase 3 라우트 모듈
const createHealthRoutes = require('./routes/healthRoutes');
const createLoggingRoutes = require('./routes/loggingRoutes');
const createCacheRoutes = require('./routes/cacheRoutes');

// Phase 4 라우트 모듈
const createTeamRoutes = require('./routes/teamRoutes');
const createCoordinateRoutes = require('./routes/coordinateRoutes');
const createStoreRoutes = require('./routes/storeRoutes');
const createModelRoutes = require('./routes/modelRoutes');
const createAgentRoutes = require('./routes/agentRoutes');

// Phase 5 라우트 모듈
const createMapDisplayRoutes = require('./routes/mapDisplayRoutes');
const createSalesRoutes = require('./routes/salesRoutes');
const createInventoryRecoveryRoutes = require('./routes/inventoryRecoveryRoutes');
const createActivationRoutes = require('./routes/activationRoutes');
const createAuthRoutes = require('./routes/authRoutes');

// Phase 6 라우트 모듈
const createMemberRoutes = require('./routes/memberRoutes');
const createOnsaleRoutes = require('./routes/onsaleRoutes');
const createInventoryRoutes = require('./routes/inventoryRoutes');
const createBudgetRoutes = require('./routes/budgetRoutes');
const createPolicyNoticeRoutes = require('./routes/policyNoticeRoutes');

// 기존 라우트 모듈
const setupDirectRoutes = require('./directRoutes');
const meetingRoutes = require('./meetingRoutes');
const setupObRoutes = require('./obRoutes');
const setupPolicyTableRoutes = require('./policyTableRoutes');

// ============================================================================
// 라우트 등록
// ============================================================================

console.log('📡 라우트 등록 중...\n');

// Phase 3 라우트 등록
try {
  app.use('/', createHealthRoutes(sharedContext));
  console.log('✅ [Phase 3] Health routes mounted');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount health routes:', e.message);
}

try {
  app.use('/', createLoggingRoutes(sharedContext));
  console.log('✅ [Phase 3] Logging routes mounted');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount logging routes:', e.message);
}

try {
  app.use('/', createCacheRoutes(sharedContext));
  console.log('✅ [Phase 3] Cache routes mounted');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount cache routes:', e.message);
}

// Phase 4 라우트 등록
try {
  app.use('/', createTeamRoutes(sharedContext));
  console.log('✅ [Phase 4] Team routes mounted');
} catch (e) {
  console.error('❌ [Phase 4] Failed to mount team routes:', e.message);
}

try {
  app.use('/', createCoordinateRoutes(sharedContext));
  console.log('✅ [Phase 4] Coordinate routes mounted');
} catch (e) {
  console.error('❌ [Phase 4] Failed to mount coordinate routes:', e.message);
}

try {
  app.use('/', createStoreRoutes(sharedContext));
  console.log('✅ [Phase 4] Store routes mounted');
} catch (e) {
  console.error('❌ [Phase 4] Failed to mount store routes:', e.message);
}

try {
  app.use('/', createModelRoutes(sharedContext));
  console.log('✅ [Phase 4] Model routes mounted');
} catch (e) {
  console.error('❌ [Phase 4] Failed to mount model routes:', e.message);
}

try {
  app.use('/', createAgentRoutes(sharedContext));
  console.log('✅ [Phase 4] Agent routes mounted');
} catch (e) {
  console.error('❌ [Phase 4] Failed to mount agent routes:', e.message);
}

// Phase 5 라우트 등록
try {
  app.use('/', createMapDisplayRoutes(sharedContext));
  console.log('✅ [Phase 5] Map Display routes mounted');
} catch (e) {
  console.error('❌ [Phase 5] Failed to mount map display routes:', e.message);
}

try {
  app.use('/', createSalesRoutes(sharedContext));
  console.log('✅ [Phase 5] Sales routes mounted');
} catch (e) {
  console.error('❌ [Phase 5] Failed to mount sales routes:', e.message);
}

try {
  app.use('/', createInventoryRecoveryRoutes(sharedContext));
  console.log('✅ [Phase 5] Inventory Recovery routes mounted');
} catch (e) {
  console.error('❌ [Phase 5] Failed to mount inventory recovery routes:', e.message);
}

try {
  app.use('/', createActivationRoutes(sharedContext));
  console.log('✅ [Phase 5] Activation routes mounted');
} catch (e) {
  console.error('❌ [Phase 5] Failed to mount activation routes:', e.message);
}

try {
  app.use('/', createAuthRoutes(sharedContext));
  console.log('✅ [Phase 5] Auth routes mounted');
} catch (e) {
  console.error('❌ [Phase 5] Failed to mount auth routes:', e.message);
}

// Phase 6 라우트 등록
try {
  app.use('/', createMemberRoutes(sharedContext));
  console.log('✅ [Phase 6] Member routes mounted');
} catch (e) {
  console.error('❌ [Phase 6] Failed to mount member routes:', e.message);
}

try {
  app.use('/', createOnsaleRoutes(sharedContext));
  console.log('✅ [Phase 6] Onsale routes mounted');
} catch (e) {
  console.error('❌ [Phase 6] Failed to mount onsale routes:', e.message);
}

try {
  app.use('/', createInventoryRoutes(sharedContext));
  console.log('✅ [Phase 6] Inventory routes mounted');
} catch (e) {
  console.error('❌ [Phase 6] Failed to mount inventory routes:', e.message);
}

try {
  app.use('/', createBudgetRoutes(sharedContext));
  console.log('✅ [Phase 6] Budget routes mounted');
} catch (e) {
  console.error('❌ [Phase 6] Failed to mount budget routes:', e.message);
}

try {
  app.use('/', createPolicyNoticeRoutes(sharedContext));
  console.log('✅ [Phase 6] Policy Notice routes mounted');
} catch (e) {
  console.error('❌ [Phase 6] Failed to mount policy notice routes:', e.message);
}

// 추가 라우트 등록 (누락된 엔드포인트)
try {
  const createPolicyRoutes = require('./routes/policyRoutes');
  app.use('/api', createPolicyRoutes(sharedContext));
  console.log('✅ [Additional] Policy routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount policy routes:', e.message);
}

try {
  const createNotificationRoutes = require('./routes/notificationRoutes');
  app.use('/api', createNotificationRoutes(sharedContext));
  console.log('✅ [Additional] Notification routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount notification routes:', e.message);
}

try {
  const createAppUpdateRoutes = require('./routes/appUpdateRoutes');
  app.use('/api', createAppUpdateRoutes(sharedContext));
  console.log('✅ [Additional] App Update routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount app update routes:', e.message);
}

try {
  const createDiscordRoutes = require('./routes/discordRoutes');
  app.use('/api', createDiscordRoutes(sharedContext));
  console.log('✅ [Additional] Discord routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount discord routes:', e.message);
}

try {
  const createMiscRoutes = require('./routes/miscRoutes');
  app.use('/api', createMiscRoutes(sharedContext));
  console.log('✅ [Additional] Misc routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount misc routes:', e.message);
}

try {
  const createAssignmentRoutes = require('./routes/assignmentRoutes');
  app.use('/', createAssignmentRoutes(sharedContext));
  console.log('✅ [Additional] Assignment routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount assignment routes:', e.message);
}

try {
  const createClosingChartRoutes = require('./routes/closingChartRoutes');
  app.use('/', createClosingChartRoutes(sharedContext));
  console.log('✅ [Additional] Closing Chart routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount closing chart routes:', e.message);
}

try {
  const createInspectionRoutes = require('./routes/inspectionRoutes');
  app.use('/', createInspectionRoutes(sharedContext));
  console.log('✅ [Additional] Inspection routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount inspection routes:', e.message);
}

try {
  const createReservationRoutes = require('./routes/reservationRoutes');
  app.use('/', createReservationRoutes(sharedContext));
  console.log('✅ [Additional] Reservation routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount reservation routes:', e.message);
}

try {
  const createSmsRoutes = require('./routes/smsRoutes');
  app.use('/', createSmsRoutes(sharedContext));
  console.log('✅ [Additional] SMS routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount SMS routes:', e.message);
}

// 기존 라우트 등록
try {
  setupDirectRoutes(app);
  console.log('✅ [Existing] Direct routes mounted');
} catch (e) {
  console.error('❌ [Existing] Failed to mount direct routes:', e.message);
}

try {
  // meetingRoutes는 함수가 아니라 객체이므로 별도 처리 필요
  // 기존 코드에서 직접 app.get/post로 등록되어 있음
  console.log('⚠️  [Existing] Meeting routes - 기존 방식 유지 (별도 등록 필요)');
} catch (e) {
  console.error('❌ [Existing] Failed to mount meeting routes:', e.message);
}

try {
  setupObRoutes(app);
  console.log('✅ [Existing] OB routes mounted');
} catch (e) {
  console.error('❌ [Existing] Failed to mount OB routes:', e.message);
}

try {
  setupPolicyTableRoutes(app);
  console.log('✅ [Existing] Policy Table routes mounted');
} catch (e) {
  console.error('❌ [Existing] Failed to mount policy table routes:', e.message);
}

console.log('\n✅ 모든 라우트 등록 완료\n');

// ============================================================================
// 에러 처리 미들웨어 (마지막에 등록)
// ============================================================================

app.use(errorMiddleware);

// ============================================================================
// 서버 시작
// ============================================================================

app.listen(port, () => {
  console.log('='.repeat(60));
  console.log(`✅ VIP Plus Server running on port ${port}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
});

// ============================================================================
// 프로세스 에러 핸들링
// ============================================================================

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  
  if (DISCORD_LOGGING_ENABLED && discordBot && EmbedBuilder) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🚨 서버 충돌 - Uncaught Exception')
      .setDescription('서버에서 처리되지 않은 예외가 발생했습니다.')
      .addFields(
        { name: '에러 메시지', value: error.message || 'Unknown error' },
        { name: '스택 트레이스', value: error.stack?.substring(0, 1000) || 'No stack trace' }
      )
      .setTimestamp();
    
    sendDiscordNotification(DISCORD_CHANNEL_ID, embed).then(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  
  if (DISCORD_LOGGING_ENABLED && discordBot && EmbedBuilder) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🚨 Unhandled Promise Rejection')
      .setDescription('처리되지 않은 Promise rejection이 발생했습니다.')
      .addFields(
        { name: 'Reason', value: String(reason).substring(0, 1000) }
      )
      .setTimestamp();
    
    sendDiscordNotification(DISCORD_CHANNEL_ID, embed);
  }
});

module.exports = app;
