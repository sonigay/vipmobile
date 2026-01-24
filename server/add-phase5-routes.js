/**
 * Phase 5 라우트 추가 스크립트
 * 
 * server/index.js에 Phase 5 라우트 모듈을 추가합니다.
 * - mapDisplayRoutes
 * - salesRoutes
 * - inventoryRecoveryRoutes
 * - activationRoutes
 * - authRoutes
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

// 1. Import 추가 (Phase 4 라우트 import 다음에 추가)
const importSection = `// Phase 4 라우트 모듈
const createCoordinateRoutes = require('./routes/coordinateRoutes');
const createStoreRoutes = require('./routes/storeRoutes');
const createModelRoutes = require('./routes/modelRoutes');
const createAgentRoutes = require('./routes/agentRoutes');`;

const newImports = `// Phase 4 라우트 모듈
const createCoordinateRoutes = require('./routes/coordinateRoutes');
const createStoreRoutes = require('./routes/storeRoutes');
const createModelRoutes = require('./routes/modelRoutes');
const createAgentRoutes = require('./routes/agentRoutes');

// Phase 5 라우트 모듈
const createMapDisplayRoutes = require('./routes/mapDisplayRoutes');
const createSalesRoutes = require('./routes/salesRoutes');
const createInventoryRecoveryRoutes = require('./routes/inventoryRecoveryRoutes');
const createActivationRoutes = require('./routes/activationRoutes');
const createAuthRoutes = require('./routes/authRoutes');`;

if (content.includes('const createMapDisplayRoutes')) {
  console.log('⚠️  Phase 5 라우트 import가 이미 존재합니다.');
} else {
  content = content.replace(importSection, newImports);
  console.log('✅ Phase 5 라우트 import 추가 완료');
}

// 2. 라우트 등록 코드 추가 (Phase 4 라우트 등록 다음에 추가)
const routeRegistrationMarker = `try {
  app.use('/', createAgentRoutes(sharedContext));
  console.log('✅ [Phase 4] Agent routes mounted');
} catch (e) {
  console.error('❌ [Phase 4] Failed to mount agent routes:', e.message);
}

setupDirectRoutes(app);`;

const newRouteRegistration = `try {
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

setupDirectRoutes(app);`;

if (content.includes('createMapDisplayRoutes(sharedContext)')) {
  console.log('⚠️  Phase 5 라우트 등록 코드가 이미 존재합니다.');
} else {
  content = content.replace(routeRegistrationMarker, newRouteRegistration);
  console.log('✅ Phase 5 라우트 등록 코드 추가 완료');
}

// 파일 저장
fs.writeFileSync(INDEX_FILE, content, 'utf8');
console.log('✅ server/index.js 업데이트 완료');

console.log('\n📋 다음 단계:');
console.log('1. npm start 로 서버 시작');
console.log('2. 다음 엔드포인트 테스트:');
console.log('   - GET http://localhost:4000/api/map-display-option');
console.log('   - GET http://localhost:4000/api/sales-data');
console.log('   - GET http://localhost:4000/api/inventoryRecoveryAccess');
console.log('   - GET http://localhost:4000/api/activation-data/current-month');
console.log('   - POST http://localhost:4000/api/login');
console.log('3. 문제 발생 시 백업 파일로 복구:');
console.log(`   cp ${BACKUP_FILE} ${INDEX_FILE}`);
