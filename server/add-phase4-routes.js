/**
 * Phase 4 라우트 추가 스크립트
 * 
 * server/index.js에 Phase 4 라우트 모듈을 추가합니다.
 * - coordinateRoutes (재구성)
 * - storeRoutes
 * - modelRoutes
 * - agentRoutes
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

// 1. Import 추가 (Phase 3 라우트 import 다음에 추가)
const importSection = `// Phase 3 라우트 모듈
const createHealthRoutes = require('./routes/healthRoutes');
const createLoggingRoutes = require('./routes/loggingRoutes');
const createCacheRoutes = require('./routes/cacheRoutes');`;

const newImports = `// Phase 3 라우트 모듈
const createHealthRoutes = require('./routes/healthRoutes');
const createLoggingRoutes = require('./routes/loggingRoutes');
const createCacheRoutes = require('./routes/cacheRoutes');

// Phase 4 라우트 모듈
const createCoordinateRoutes = require('./routes/coordinateRoutes');
const createStoreRoutes = require('./routes/storeRoutes');
const createModelRoutes = require('./routes/modelRoutes');
const createAgentRoutes = require('./routes/agentRoutes');`;

if (content.includes('const createCoordinateRoutes')) {
  console.log('⚠️  Phase 4 라우트 import가 이미 존재합니다.');
} else {
  content = content.replace(importSection, newImports);
  console.log('✅ Phase 4 라우트 import 추가 완료');
}

// 2. 라우트 등록 코드 추가 (Phase 3 라우트 등록 다음에 추가)
const routeRegistrationMarker = `try {
  app.use('/', createCacheRoutes(sharedContext));
  console.log('✅ [Phase 3] Cache routes mounted');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount cache routes:', e.message);
}

setupDirectRoutes(app);`;

const newRouteRegistration = `try {
  app.use('/', createCacheRoutes(sharedContext));
  console.log('✅ [Phase 3] Cache routes mounted');
} catch (e) {
  console.error('❌ [Phase 3] Failed to mount cache routes:', e.message);
}

// Phase 4 라우트 등록
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

setupDirectRoutes(app);`;

if (content.includes('createCoordinateRoutes(sharedContext)')) {
  console.log('⚠️  Phase 4 라우트 등록 코드가 이미 존재합니다.');
} else {
  content = content.replace(routeRegistrationMarker, newRouteRegistration);
  console.log('✅ Phase 4 라우트 등록 코드 추가 완료');
}

// 파일 저장
fs.writeFileSync(INDEX_FILE, content, 'utf8');
console.log('✅ server/index.js 업데이트 완료');

console.log('\n📋 다음 단계:');
console.log('1. npm start 로 서버 시작');
console.log('2. 다음 엔드포인트 테스트:');
console.log('   - POST http://localhost:4000/api/update-coordinates');
console.log('   - POST http://localhost:4000/api/update-sales-coordinates');
console.log('   - GET http://localhost:4000/api/stores');
console.log('   - GET http://localhost:4000/api/models');
console.log('   - GET http://localhost:4000/api/agents');
console.log('3. 문제 발생 시 백업 파일로 복구:');
console.log(`   cp ${BACKUP_FILE} ${INDEX_FILE}`);
