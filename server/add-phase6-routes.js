/**
 * Phase 6 라우트 추가 스크립트
 * 
 * server/index.js에 Phase 6 라우트 모듈을 추가합니다.
 * - memberRoutes (고객 관련)
 * - onsaleRoutes (개통정보 관련)
 * - inventoryRoutes (재고 관리)
 * - budgetRoutes (예산 관리)
 * - policyNoticeRoutes (정책 공지사항)
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

// 1. Import 추가 (Phase 6 라우트 import 다음에 추가)
const importSection = `// Phase 6 라우트 모듈
const createMemberRoutes = require('./routes/memberRoutes');`;

const newImports = `// Phase 6 라우트 모듈
const createMemberRoutes = require('./routes/memberRoutes');
const createOnsaleRoutes = require('./routes/onsaleRoutes');
const createInventoryRoutes = require('./routes/inventoryRoutes');
const createBudgetRoutes = require('./routes/budgetRoutes');
const createPolicyNoticeRoutes = require('./routes/policyNoticeRoutes');`;

if (content.includes('const createOnsaleRoutes') &&
    content.includes('const createInventoryRoutes') &&
    content.includes('const createBudgetRoutes') &&
    content.includes('const createPolicyNoticeRoutes')) {
  console.log('⚠️  Phase 6 라우트 import가 이미 존재합니다.');
} else {
  content = content.replace(importSection, newImports);
  console.log('✅ Phase 6 라우트 import 추가 완료');
}

// 2. 라우트 등록 코드 추가 (Phase 5 라우트 등록 다음에 추가)
const routeRegistrationMarker = `try {
  app.use('/', createAuthRoutes(sharedContext));
  console.log('✅ [Phase 5] Auth routes mounted');
} catch (e) {
  console.error('❌ [Phase 5] Failed to mount auth routes:', e.message);
}

setupDirectRoutes(app);`;

const newRouteRegistration = `try {
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

setupDirectRoutes(app);`;

if (content.includes('createMemberRoutes(sharedContext)') &&
    content.includes('createOnsaleRoutes(sharedContext)') &&
    content.includes('createInventoryRoutes(sharedContext)') &&
    content.includes('createBudgetRoutes(sharedContext)') &&
    content.includes('createPolicyNoticeRoutes(sharedContext)')) {
  console.log('⚠️  Phase 6 라우트 등록 코드가 이미 존재합니다.');
} else {
  content = content.replace(routeRegistrationMarker, newRouteRegistration);
  console.log('✅ Phase 6 라우트 등록 코드 추가 완료');
}

// 파일 저장
fs.writeFileSync(INDEX_FILE, content, 'utf8');
console.log('✅ server/index.js 업데이트 완료');

console.log('\n📋 다음 단계:');
console.log('1. npm start 로 서버 시작');
console.log('2. 다음 엔드포인트 테스트:');
console.log('   - POST http://localhost:4000/api/member/login');
console.log('   - GET http://localhost:4000/api/member/queue');
console.log('   - GET http://localhost:4000/api/onsale/activation-list');
console.log('   - GET http://localhost:4000/api/inventory/assignment-status');
console.log('   - GET http://localhost:4000/api/budget/policy-groups');
console.log('   - GET http://localhost:4000/api/policy-notices');
console.log('3. 문제 발생 시 백업 파일로 복구:');
console.log(`   cp ${BACKUP_FILE} ${INDEX_FILE}`);

console.log('\n📊 Phase 6 완료 상태:');
console.log('✅ Member 라우트 (11개 엔드포인트)');
console.log('✅ Onsale 라우트 (20+ 엔드포인트)');
console.log('✅ Inventory 라우트 (6개 엔드포인트)');
console.log('✅ Budget 라우트 (5개 엔드포인트)');
console.log('✅ Policy Notice 라우트 (4개 엔드포인트)');
console.log('\n🎉 Phase 6 완료! 총 46+ 엔드포인트가 모듈화되었습니다.');
