/**
 * VIP Plus Server
 * 
 * 리팩토링된 서버 메인 파일
 * - 모든 라우트가 별도 모듈로 분리됨
 * - 공통 리소스를 컨텍스트 객체로 공유
 * - 미들웨어 기반 에러 처리
 */

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const result = require('dotenv').config({ path: envPath });
  if (result.error) {
    console.error('❌ [.env] Load Error:', result.error);
  } else {
    console.log('✅ [.env] Loaded from:', envPath);
    console.log('   - PORT:', process.env.PORT);
    console.log('   - GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set' : 'Missing');
  }
} else {
  console.warn('⚠️  [.env] File not found at:', envPath);
}
const express = require('express');
const cron = require('node-cron');
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
  const coordinateModule = createCoordinateRoutes(sharedContext);
  const coordinateRouter = coordinateModule.router || coordinateModule;
  app.use('/', coordinateRouter);
  console.log('✅ [Phase 4] Coordinate routes mounted');

  // 서버 시작 시 위경도 자동 업데이트 (10초 지연 실행)
  if (coordinateModule.updateStoreCoordinates) {
    setTimeout(async () => {
      try {
        console.log('🔄 [자동업데이트] 서버 시작 시 위경도 자동 업데이트 실행...');
        await coordinateModule.updateStoreCoordinates();
        if (coordinateModule.updateSalesCoordinates) {
          await coordinateModule.updateSalesCoordinates();
        }
      } catch (error) {
        console.error('❌ [자동업데이트] 서버 시작 시 위경도 업데이트 실패:', error.message);
      }
    }, 10000); // 10초 후 실행
  }

  // 매일 새벽 04:00 정기 위경도 업데이트 스케줄 등록
  cron.schedule('0 4 * * *', async () => {
    try {
      console.log('⏰ [스케줄러] 정기 위경도 자동 업데이트 시작 (04:00)...');
      if (coordinateModule.updateStoreCoordinates) await coordinateModule.updateStoreCoordinates();
      if (coordinateModule.updateSalesCoordinates) await coordinateModule.updateSalesCoordinates();
      console.log('✅ [스케줄러] 정기 위경도 자동 업데이트 완료');
    } catch (error) {
      console.error('❌ [스케줄러] 정기 위경도 업데이트 실패:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul'
  });
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
  app.use('/api/inventory-recovery', createInventoryRecoveryRoutes(sharedContext));
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
  const createAppUpdateRoutes = require('./routes/appUpdateRoutes');
  app.use('/api', createAppUpdateRoutes(sharedContext));
  console.log('✅ [Additional] App Update routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount app update routes:', e.message);
}

try {
  const createPolicyRoutes = require('./routes/policyRoutes');
  app.use('/api', createPolicyRoutes(sharedContext));
  console.log('✅ [Additional] Policy routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount policy routes:', e.message);
}

// Chart Mode Routes
try {
  const createClosingChartRoutes = require('./routes/closingChartRoutes');
  app.use('/api', createClosingChartRoutes(sharedContext));
  console.log('✅ [Chart] Closing Chart routes mounted');
} catch (e) {
  console.error('❌ [Chart] Failed to mount closing chart routes:', e.message);
}

try {
  const createRechotanchoBondRoutes = require('./routes/rechotanchoBondRoutes');
  app.use('/', createRechotanchoBondRoutes(sharedContext)); // This router already has /api prefix in paths
  console.log('✅ [Chart] Rechotancho Bond routes mounted');
} catch (e) {
  console.error('❌ [Chart] Failed to mount rechotancho bond routes:', e.message);
}

try {
  const createSubscriberIncreaseRoutes = require('./routes/subscriberIncreaseRoutes');
  app.use('/', createSubscriberIncreaseRoutes(sharedContext)); // This router already has /api prefix in paths
  console.log('✅ [Chart] Subscriber Increase routes mounted');
} catch (e) {
  console.error('❌ [Chart] Failed to mount subscriber increase routes:', e.message);
}

try {
  const monthlyAwardAPI = require('./monthlyAwardAPI');
  // MonthlyAwardAPI doesn't export a router factory, so we map handlers manually or wrap them
  // Assuming getMonthlyAwardData handles req, res
  app.get('/api/monthly-award/data', (req, res) => monthlyAwardAPI.getMonthlyAwardData(req, res));
  app.post('/api/monthly-award/settings', (req, res) => monthlyAwardAPI.saveMonthlyAwardSettings(req, res));
  console.log('✅ [Chart] Monthly Award routes mounted');
} catch (e) {
  console.error('❌ [Chart] Failed to mount monthly award routes:', e.message);
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

// Error Logging Routes (통합 에러 모니터링)
try {
  const { supabase } = require('./supabaseClient');
  const { initErrorRoutes } = require('./routes/errorRoutes');
  app.use('/api/errors', initErrorRoutes(supabase));
  console.log('✅ [Additional] Error Logging routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount error logging routes:', e.message);
}

try {
  const createCancelCheckRoutes = require('./routes/cancelCheckRoutes');
  app.use('/', createCancelCheckRoutes(sharedContext));
  console.log('✅ [Additional] Cancel Check routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount cancel check routes:', e.message);
}

try {
  const createDataCollectionRoutes = require('./routes/dataCollectionRoutes');
  app.use('/', createDataCollectionRoutes(sharedContext));
  console.log('✅ [Additional] Data Collection routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount data collection routes:', e.message);
}

try {
  const createQuickCostRoutes = require('./routes/quickCostRoutes');
  app.use('/', createQuickCostRoutes(sharedContext));
  console.log('✅ [Additional] Quick Cost routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount quick cost routes:', e.message);
}

try {
  const createRechotanchoBondRoutes = require('./routes/rechotanchoBondRoutes');
  app.use('/', createRechotanchoBondRoutes(sharedContext));
  console.log('✅ [Additional] Rechotancho Bond routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount rechotancho bond routes:', e.message);
}

try {
  const createSubscriberIncreaseRoutes = require('./routes/subscriberIncreaseRoutes');
  app.use('/', createSubscriberIncreaseRoutes(sharedContext));
  console.log('✅ [Additional] Subscriber Increase routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount subscriber increase routes:', e.message);
}

try {
  const createSalesByStoreRoutes = require('./routes/salesByStoreRoutes');
  app.use('/', createSalesByStoreRoutes(sharedContext));
  console.log('✅ [Additional] Sales By Store routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount sales by store routes:', e.message);
}

try {
  const createPosCodeRoutes = require('./routes/posCodeRoutes');
  app.use('/', createPosCodeRoutes(sharedContext));
  console.log('✅ [Additional] POS Code routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount POS code routes:', e.message);
}

try {
  const createDirectStoreAdditionalRoutes = require('./routes/directStoreAdditionalRoutes');
  app.use('/api/direct', createDirectStoreAdditionalRoutes(sharedContext));
  console.log('✅ [Additional] Direct Store Additional routes mounted');
} catch (e) {
  console.error('❌ [Additional] Failed to mount direct store additional routes:', e.message);
}

// DAL 기반 직영점 라우트 (Supabase/Google Sheets 자동 전환)
try {
  const directStoreDALRoutes = require('./routes/directStoreDALRoutes');
  app.use('/api/direct-dal', directStoreDALRoutes);
  console.log('✅ [DAL] Direct Store DAL routes mounted at /api/direct-dal');
} catch (e) {
  console.error('❌ [DAL] Failed to mount direct store DAL routes:', e.message);
}

// DB 소스 관리 라우트 (Phase 3)
try {
  const dbManagementRoutes = require('./routes/dbManagementRoutes');
  app.use('/api/db', dbManagementRoutes);
  console.log('✅ [Phase 3] DB Management routes mounted at /api/db');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount DB management routes:', e.message);
}

// 기존 라우트 등록
try {
  setupDirectRoutes(app);
  console.log('✅ [Existing] Direct routes mounted');
} catch (e) {
  console.error('❌ [Existing] Failed to mount direct routes:', e.message);
}

try {
  // meetingRoutes는 함수가 아니라 객체이므로 직접 등록
  app.get('/api/meetings', meetingRoutes.getMeetings);
  app.post('/api/meetings', meetingRoutes.createMeeting);
  app.put('/api/meetings/:meetingId', meetingRoutes.updateMeeting);
  app.delete('/api/meetings/:meetingId', meetingRoutes.deleteMeeting);
  app.get('/api/meetings/:meetingId/config', meetingRoutes.getMeetingConfig);
  app.post('/api/meetings/:meetingId/config', meetingRoutes.saveMeetingConfig);
  app.post('/api/meetings/:meetingId/upload-image', meetingRoutes.uploadMeetingImage);
  app.post('/api/meetings/:meetingId/upload-file', meetingRoutes.upload.single('file'), meetingRoutes.uploadCustomSlideFile);
  app.get('/api/meetings/proxy-image', meetingRoutes.proxyDiscordImage);
  app.get('/api/meetings/discord-thread/:threadId', express.json(), meetingRoutes.getDiscordThreadInfo);
  app.patch('/api/meetings/discord-thread/:threadId', express.json(), meetingRoutes.renameDiscordThread);
  app.patch('/api/meetings/:meetingId/slide-image', express.json(), meetingRoutes.updateSlideImageUrl);
  console.log('✅ [Existing] Meeting routes mounted');
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
  const policyTableRouter = setupPolicyTableRoutes(app);
  app.use('/api', policyTableRouter);
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
// 스케줄러 함수 정의
// ============================================================================

// Discord 이미지 자동 갱신 함수
async function refreshAllDiscordImages() {
  console.log('🔄 [스케줄러] Discord 이미지 자동 갱신 시작...');

  try {
    const { refreshDiscordImagesForCarrier } = require('./directRoutes');
    const carriers = ['SK', 'KT', 'LG'];

    for (const carrier of carriers) {
      try {
        console.log(`[스케줄러] ${carrier} Discord 이미지 갱신 중...`);
        await refreshDiscordImagesForCarrier(carrier);
        console.log(`[스케줄러] ${carrier} Discord 이미지 갱신 완료`);
      } catch (error) {
        console.error(`[스케줄러] ${carrier} Discord 이미지 갱신 실패:`, error.message);
      }
    }

    console.log('✅ [스케줄러] Discord 이미지 자동 갱신 완료');
  } catch (error) {
    console.error('❌ [스케줄러] Discord 이미지 자동 갱신 오류:', error);
  }
}

// 재시도 헬퍼 함수 (지수 백오프)
async function retryWithBackoff(fn, maxRetries = 3, baseDelayMs = 2000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.warn(`⚠️ [재시도] 시도 ${attempt + 1}/${maxRetries} 실패, ${delayMs}ms 후 재시도... (오류: ${error.message})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

// 데이터 재빌드 실행 상태 관리
let isRebuilding = false;
let rebuildStartTime = null;
const MAX_REBUILD_DURATION_MS = 30 * 60 * 1000; // 30분 최대 실행 시간

// 데이터 재빌드 함수
async function rebuildMasterData() {
  // 이미 재빌드가 진행 중이면 건너뛰기
  if (isRebuilding) {
    const elapsed = rebuildStartTime ? Date.now() - rebuildStartTime : 0;
    if (elapsed > MAX_REBUILD_DURATION_MS) {
      console.warn('⚠️ [스케줄러] 재빌드가 최대 실행 시간을 초과했습니다. 강제 종료합니다.');
      isRebuilding = false;
      rebuildStartTime = null;
    } else {
      console.log(`⚠️ [스케줄러] 이미 재빌드가 진행 중입니다. (경과 시간: ${Math.floor(elapsed / 1000)}초) 건너뜁니다.`);
      return;
    }
  }

  isRebuilding = true;
  rebuildStartTime = Date.now();
  const startTime = Date.now();

  try {
    console.log('🔄 [스케줄러] 데이터 재빌드 시작...');

    const { rebuildPlanMaster, rebuildDeviceMaster, rebuildPricingMaster } = require('./directRoutes');
    const carriers = ['SK', 'KT', 'LG'];

    // 1. 요금제 마스터 리빌드 (재시도 포함)
    console.log(`[스케줄러] Rebuilding Plan Master for ${carriers.join(',')}`);
    const planResult = await retryWithBackoff(
      () => rebuildPlanMaster(carriers),
      3,
      2000
    );
    console.log(`[스케줄러] Plan Master 완료: ${planResult?.totalCount || 0}개`);

    // 2. 단말 마스터 리빌드 (재시도 포함)
    console.log(`[스케줄러] Rebuilding Device Master for ${carriers.join(',')}`);
    const deviceResult = await retryWithBackoff(
      () => rebuildDeviceMaster(carriers),
      3,
      2000
    );
    console.log(`[스케줄러] Device Master 완료: ${deviceResult?.totalCount || 0}개`);

    // 3. 단말 요금정책 리빌드 (재시도 포함)
    console.log(`[스케줄러] Rebuilding Pricing Master for ${carriers.join(',')}`);
    const pricingResult = await retryWithBackoff(
      () => rebuildPricingMaster(carriers),
      3,
      2000
    );
    console.log(`[스케줄러] Pricing Master 완료: ${pricingResult?.totalCount || 0}개`);

    const elapsed = Date.now() - startTime;
    console.log(`✅ [스케줄러] 데이터 재빌드 완료 (소요 시간: ${Math.floor(elapsed / 1000)}초)`);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ [스케줄러] 데이터 재빌드 오류 (소요 시간: ${Math.floor(elapsed / 1000)}초):`, error);
    console.error(`❌ [스케줄러] 재시도 후에도 실패했습니다. 다음 스케줄에서 다시 시도합니다.`);
  } finally {
    isRebuilding = false;
    rebuildStartTime = null;
  }
}

// ============================================================================
// 서버 시작
// ============================================================================

app.listen(port, () => {
  console.log('='.repeat(60));
  console.log(`✅ VIP Plus Server running on port ${port}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));

  // ============================================================================
  // 스케줄러 등록
  // ============================================================================

  console.log('⏰ [스케줄러] 스케줄 등록 시작...');

  // Discord 이미지 자동 갱신 스케줄 등록
  const imageRefreshSchedules = [
    { time: '03:30', cron: '30 3 * * *' },
    { time: '07:30', cron: '30 7 * * *' },
    { time: '11:30', cron: '30 11 * * *' },
    { time: '17:30', cron: '30 17 * * *' },
    { time: '20:30', cron: '30 20 * * *' },
    { time: '23:30', cron: '30 23 * * *' }
  ];

  imageRefreshSchedules.forEach(({ time, cron: cronExpr }) => {
    cron.schedule(cronExpr, async () => {
      console.log(`⏰ [스케줄러] 정기 스케줄 실행: Discord 이미지 자동 갱신 (${time})`);
      await refreshAllDiscordImages();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul'
    });
    console.log(`✅ [스케줄러] Discord 이미지 자동 갱신 스케줄 등록: ${time} (Asia/Seoul)`);
  });

  // 데이터 재빌드 스케줄 등록
  // 매일 11:00-19:00 매시간 10분 (11:10, 12:10, 13:10, ..., 19:10)
  for (let hour = 11; hour <= 19; hour++) {
    cron.schedule(`10 ${hour} * * *`, async () => {
      console.log(`⏰ [스케줄러] 정기 스케줄 실행: 데이터 재빌드 (${hour}:10)`);
      await rebuildMasterData();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul'
    });
    console.log(`✅ [스케줄러] 데이터 재빌드 스케줄 등록: ${hour}:10 (Asia/Seoul)`);
  }

  console.log('✅ [스케줄러] 모든 스케줄 등록 완료');

  // 서버 시작 시 초기 실행 (지연 실행)
  console.log('🚀 [스케줄러] 서버 시작 시 자동 실행 예약...');

  // 데이터 재빌드 (서버 시작 15분 후)
  setTimeout(async () => {
    console.log('🔄 [스케줄러] 서버 시작 시 데이터 재빌드 실행 (지연 실행)');
    await rebuildMasterData();
  }, 15 * 60 * 1000); // 15분 후

  // Discord 이미지 자동 갱신 (서버 시작 30분 후)
  setTimeout(async () => {
    console.log('🔄 [스케줄러] 서버 시작 시 Discord 이미지 자동 갱신 실행 (지연 실행)');
    await refreshAllDiscordImages();
  }, 30 * 60 * 1000); // 30분 후

  console.log('✅ [스케줄러] 서버 시작 시 자동 실행 예약 완료 (재빌드: 15분 후, 이미지 갱신: 30분 후)');
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
