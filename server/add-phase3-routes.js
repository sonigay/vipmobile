/**
 * Phase 3 라우트 추가 스크립트
 * 
 * server/index.js에 Phase 3 라우트 모듈을 추가합니다.
 * - healthRoutes
 * - loggingRoutes
 * - cacheRoutes
 */

const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, 'index.js');
const BACKUP_FILE = path.join(__dirname, 'index.js.backup.' + Date.now());

// 백업 생성
console.log('📦 백업 생성 중...');
fs.copyFileSync(INDEX_FILE, BACKUP_FILE);
console.log(`✅ 백업 완료: ${BACKUP_FILE}`);

// 파일 읽기
let content = fs.readFileSync(INDEX_FILE, 'utf8');

// 1. Import 추가 (setupPolicyTableRoutes 다음에 추가)
const importSection = `const setupPolicyTableRoutes = require('./policyTableRoutes');`;
const newImports = `const setupPolicyTableRoutes = require('./policyTableRoutes');

// Phase 3 라우트 모듈
const createHealthRoutes = require('./routes/healthRoutes');
const createLoggingRoutes = require('./routes/loggingRoutes');
const createCacheRoutes = require('./routes/cacheRoutes');`;

if (content.includes('const createHealthRoutes')) {
  console.log('⚠️  Phase 3 라우트 import가 이미 존재합니다.');
} else {
  content = content.replace(importSection, newImports);
  console.log('✅ Phase 3 라우트 import 추가 완료');
}

// 2. 공통 컨텍스트 객체 생성 코드 추가
// 클라이언트 로그 수집 엔드포인트 이전에 추가 (라우트 등록 전)
const clientLogsMarker = `// 클라이언트 원격 로그 수집 (비차단, CORS 적용)
app.post('/api/client-logs', (req, res) => {`;

const contextCreation = `// ==================== 공통 컨텍스트 객체 (Phase 3) ====================
// 모든 라우트 모듈에서 공유하는 리소스
let sharedContext;
try {
  const sheetsClientModule = require('./utils/sheetsClient');
  sharedContext = {
    sheetsClient: sheetsClientModule,
    cacheManager: require('./utils/cacheManager'),
    rateLimiter: require('./utils/rateLimiter'),
    discordBot: require('./utils/discordBot')
  };
  console.log('✅ [Phase 3] 공통 컨텍스트 객체 생성 완료');
} catch (error) {
  console.warn('⚠️  [Phase 3] Google Sheets 클라이언트 초기화 실패, 제한된 기능으로 실행:', error.message);
  sharedContext = {
    sheetsClient: null,
    cacheManager: require('./utils/cacheManager'),
    rateLimiter: require('./utils/rateLimiter'),
    discordBot: require('./utils/discordBot')
  };
}

// 클라이언트 원격 로그 수집 (비차단, CORS 적용)
app.post('/api/client-logs', (req, res) => {`;

if (content.includes('sharedContext')) {
  console.log('⚠️  공통 컨텍스트 객체가 이미 존재합니다.');
} else {
  content = content.replace(clientLogsMarker, contextCreation);
  console.log('✅ 공통 컨텍스트 객체 생성 코드 추가 완료');
}

// 3. 라우트 등록 코드 추가 (setupDirectRoutes 이전에 추가)
const routeRegistrationMarker = `// ==================== API 라우트들 ====================
setupDirectRoutes(app);`;

const newRouteRegistration = `// ==================== API 라우트들 ====================

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

setupDirectRoutes(app);`;

if (content.includes('createHealthRoutes(sharedContext)')) {
  console.log('⚠️  Phase 3 라우트 등록 코드가 이미 존재합니다.');
} else {
  content = content.replace(routeRegistrationMarker, newRouteRegistration);
  console.log('✅ Phase 3 라우트 등록 코드 추가 완료');
}

// 파일 저장
fs.writeFileSync(INDEX_FILE, content, 'utf8');
console.log('✅ server/index.js 업데이트 완료');

console.log('\n📋 다음 단계:');
console.log('1. npm start 로 서버 시작');
console.log('2. 다음 엔드포인트 테스트:');
console.log('   - GET http://localhost:4000/health');
console.log('   - GET http://localhost:4000/api/version');
console.log('   - GET http://localhost:4000/api/cache-status');
console.log('   - POST http://localhost:4000/api/cache-refresh');
console.log('3. 문제 발생 시 백업 파일로 복구:');
console.log(`   cp ${BACKUP_FILE} ${INDEX_FILE}`);
