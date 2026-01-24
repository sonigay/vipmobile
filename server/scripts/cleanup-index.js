/**
 * index.js 정리 스크립트
 * 
 * Phase 3-6에서 모듈화된 라우트 코드를 index.js에서 제거합니다.
 * 안전을 위해 백업을 생성하고, 단계별로 제거합니다.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INDEX_FILE = path.join(__dirname, '..', 'index.js');
const BACKUP_FILE = path.join(__dirname, '..', 'index.js.backup.' + Date.now());

// 제거할 라우트 패턴 (Phase 6부터 역순)
const ROUTES_TO_REMOVE = [
  // Phase 6: Member Routes
  { pattern: /^app\.post\(['"]\/api\/member\/login['"]/, name: 'Member Login' },
  { pattern: /^app\.get\(['"]\/api\/member\/queue\/all['"]/, name: 'Member Queue All' },
  { pattern: /^app\.get\(['"]\/api\/member\/queue['"]/, name: 'Member Queue Get' },
  { pattern: /^app\.post\(['"]\/api\/member\/queue['"]/, name: 'Member Queue Post' },
  { pattern: /^app\.put\(['"]\/api\/member\/queue/, name: 'Member Queue Put' },
  { pattern: /^app\.delete\(['"]\/api\/member\/queue/, name: 'Member Queue Delete' },
  { pattern: /^app\.get\(['"]\/api\/member\/board['"]/, name: 'Member Board Get' },
  { pattern: /^app\.get\(['"]\/api\/member\/board\//, name: 'Member Board Get By ID' },
  { pattern: /^app\.post\(['"]\/api\/member\/board['"]/, name: 'Member Board Post' },
  { pattern: /^app\.put\(['"]\/api\/member\/board/, name: 'Member Board Put' },
  { pattern: /^app\.delete\(['"]\/api\/member\/board/, name: 'Member Board Delete' },
  
  // Phase 6: Onsale Routes
  { pattern: /^app\.post\(['"]\/api\/onsale\/activation-info\/[^'"]+(\/complete|\/pending|\/unpending|\/cancel)['"]/, name: 'Onsale Status Change' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/activation-list['"]/, name: 'Onsale Activation List' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/activation-info/, name: 'Onsale Activation Info Get' },
  { pattern: /^app\.put\(['"]\/api\/onsale\/activation-info/, name: 'Onsale Activation Info Put' },
  { pattern: /^app\.post\(['"]\/api\/onsale\/activation-info['"]/, name: 'Onsale Activation Info Post' },
  { pattern: /^app\.post\(['"]\/api\/onsale\/uplus-submission['"]/, name: 'Onsale U+ Submission' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/links['"]/, name: 'Onsale Links Get' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/active-links['"]/, name: 'Onsale Active Links' },
  { pattern: /^app\.post\(['"]\/api\/onsale\/links['"]/, name: 'Onsale Links Post' },
  { pattern: /^app\.put\(['"]\/api\/onsale\/links/, name: 'Onsale Links Put' },
  { pattern: /^app\.delete\(['"]\/api\/onsale\/links/, name: 'Onsale Links Delete' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/policies\/groups['"]/, name: 'Onsale Policy Groups' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/policies['"]/, name: 'Onsale Policies Get' },
  { pattern: /^app\.get\(['"]\/api\/onsale\/policies\//, name: 'Onsale Policies Get By ID' },
  { pattern: /^app\.post\(['"]\/api\/onsale\/policies['"]/, name: 'Onsale Policies Post' },
  { pattern: /^app\.put\(['"]\/api\/onsale\/policies/, name: 'Onsale Policies Put' },
  { pattern: /^app\.delete\(['"]\/api\/onsale\/policies/, name: 'Onsale Policies Delete' },
  { pattern: /^app\.post\(['"]\/api\/onsale\/policies\/[^'"]+\/view['"]/, name: 'Onsale Policy View' },
  { pattern: /^app\.post\(['"]\/api\/onsale-proxy['"]/, name: 'Onsale Proxy' },
  
  // Phase 6: Inventory Routes
  { pattern: /^app\.get\(['"]\/api\/inventory\/assignment-status['"]/, name: 'Inventory Assignment Status' },
  { pattern: /^app\.post\(['"]\/api\/inventory\/save-assignment['"]/, name: 'Inventory Save Assignment' },
  { pattern: /^app\.get\(['"]\/api\/inventory\/normalized-status['"]/, name: 'Inventory Normalized Status' },
  { pattern: /^app\.post\(['"]\/api\/inventory\/manual-assignment['"]/, name: 'Inventory Manual Assignment' },
  { pattern: /^app\.get\(['"]\/api\/inventory\/activation-status['"]/, name: 'Inventory Activation Status' },
  { pattern: /^app\.get\(['"]\/api\/inventory-analysis['"]/, name: 'Inventory Analysis' },
  
  // Phase 6: Budget Routes
  { pattern: /^app\.get\(['"]\/api\/budget\/policy-groups['"]/, name: 'Budget Policy Groups' },
  { pattern: /^app\.post\(['"]\/api\/budget\/policy-group-settings['"]/, name: 'Budget Policy Group Settings Post' },
  { pattern: /^app\.get\(['"]\/api\/budget\/policy-group-settings['"]/, name: 'Budget Policy Group Settings Get' },
  { pattern: /^app\.delete\(['"]\/api\/budget\/policy-group-settings/, name: 'Budget Policy Group Settings Delete' },
  { pattern: /^app\.post\(['"]\/api\/budget\/calculate-usage['"]/, name: 'Budget Calculate Usage' },
  
  // Phase 6: Policy Notice Routes
  { pattern: /^app\.get\(['"]\/api\/policy-notices['"]/, name: 'Policy Notices Get' },
  { pattern: /^app\.post\(['"]\/api\/policy-notices['"]/, name: 'Policy Notices Post' },
  { pattern: /^app\.put\(['"]\/api\/policy-notices/, name: 'Policy Notices Put' },
  { pattern: /^app\.delete\(['"]\/api\/policy-notices/, name: 'Policy Notices Delete' },
  
  // Phase 5: Map Display Routes
  { pattern: /^app\.get\(['"]\/api\/map-display-option['"]/, name: 'Map Display Option Get' },
  { pattern: /^app\.post\(['"]\/api\/map-display-option\/batch['"]/, name: 'Map Display Option Batch' },
  { pattern: /^app\.post\(['"]\/api\/map-display-option['"]/, name: 'Map Display Option Post' },
  { pattern: /^app\.get\(['"]\/api\/map-display-option\/values['"]/, name: 'Map Display Option Values' },
  { pattern: /^app\.get\(['"]\/api\/map-display-option\/users['"]/, name: 'Map Display Option Users' },
  
  // Phase 5: Sales Routes
  { pattern: /^app\.get\(['"]\/api\/sales-data['"]/, name: 'Sales Data' },
  { pattern: /^app\.get\(['"]\/api\/sales-mode-access['"]/, name: 'Sales Mode Access' },
  
  // Phase 5: Inventory Recovery Routes
  { pattern: /^app\.get\(['"]\/api\/inventoryRecoveryAccess['"]/, name: 'Inventory Recovery Access' },
  
  // Phase 5: Activation Routes
  { pattern: /^app\.get\(['"]\/api\/activation-data\/current-month['"]/, name: 'Activation Current Month' },
  { pattern: /^app\.get\(['"]\/api\/activation-data\/previous-month['"]/, name: 'Activation Previous Month' },
  { pattern: /^app\.get\(['"]\/api\/activation-data\/by-date['"]/, name: 'Activation By Date' },
  { pattern: /^app\.get\(['"]\/api\/activation-data\/date-comparison/, name: 'Activation Date Comparison' },
  
  // Phase 5: Auth Routes
  { pattern: /^app\.post\(['"]\/api\/login['"]/, name: 'Login' },
  { pattern: /^app\.post\(['"]\/api\/verify-password['"]/, name: 'Verify Password' },
  { pattern: /^app\.post\(['"]\/api\/verify-direct-store-password['"]/, name: 'Verify Direct Store Password' },
  
  // Phase 4: Team Routes
  { pattern: /^app\.get\(['"]\/api\/teams['"]/, name: 'Teams' },
  { pattern: /^app\.get\(['"]\/api\/team-leaders['"]/, name: 'Team Leaders' },
  
  // Phase 4: Coordinate Routes
  { pattern: /^app\.post\(['"]\/api\/update-coordinates['"]/, name: 'Update Coordinates' },
  { pattern: /^app\.post\(['"]\/api\/update-sales-coordinates['"]/, name: 'Update Sales Coordinates' },
  
  // Phase 4: Store Routes
  { pattern: /^app\.get\(['"]\/api\/stores['"]/, name: 'Stores' },
  
  // Phase 4: Model Routes
  { pattern: /^app\.get\(['"]\/api\/models['"]/, name: 'Models' },
  
  // Phase 4: Agent Routes
  { pattern: /^app\.get\(['"]\/api\/agents['"]/, name: 'Agents' },
  
  // Phase 3: Health Routes
  { pattern: /^app\.get\(['"]\/health['"]/, name: 'Health' },
  { pattern: /^app\.get\(['"]\/api\/version['"]/, name: 'Version' },
  { pattern: /^app\.get\(['"]\/api\/cache-status['"]/, name: 'Cache Status' },
  
  // Phase 3: Logging Routes
  { pattern: /^app\.post\(['"]\/api\/client-logs['"]/, name: 'Client Logs' },
  { pattern: /^app\.post\(['"]\/api\/log-activity['"]/, name: 'Log Activity' },
  
  // Phase 3: Cache Routes
  { pattern: /^app\.post\(['"]\/api\/cache-refresh['"]/, name: 'Cache Refresh' },
];

async function removeRouteBlock(lines, startIndex) {
  let braceCount = 0;
  let inRoute = false;
  let endIndex = startIndex;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // 라우트 시작 감지
    if (i === startIndex) {
      inRoute = true;
    }
    
    if (inRoute) {
      // 중괄호 카운팅
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      // 라우트 끝 감지 (});로 끝나고 braceCount가 0)
      if (braceCount === 0 && line.trim().match(/^\}\);?\s*$/)) {
        endIndex = i;
        break;
      }
    }
  }
  
  return endIndex;
}

async function cleanupIndex() {
  console.log('🧹 index.js 정리 시작...\n');
  
  // 1. 백업 생성
  console.log('📦 백업 생성 중...');
  fs.copyFileSync(INDEX_FILE, BACKUP_FILE);
  console.log(`✅ 백업 완료: ${BACKUP_FILE}\n`);
  
  // 2. 파일 읽기
  console.log('📖 파일 읽기 중...');
  const content = fs.readFileSync(INDEX_FILE, 'utf8');
  const lines = content.split('\n');
  console.log(`✅ 총 ${lines.length}줄 읽음\n`);
  
  // 3. 제거할 라우트 찾기
  console.log('🔍 제거할 라우트 찾는 중...\n');
  const routesToRemove = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const route of ROUTES_TO_REMOVE) {
      if (route.pattern.test(line)) {
        const endIndex = await removeRouteBlock(lines, i);
        routesToRemove.push({
          name: route.name,
          startLine: i + 1, // 1-based
          endLine: endIndex + 1,
          lineCount: endIndex - i + 1
        });
        console.log(`  ✓ 발견: ${route.name} (줄 ${i + 1}-${endIndex + 1}, ${endIndex - i + 1}줄)`);
        break;
      }
    }
  }
  
  console.log(`\n📊 총 ${routesToRemove.length}개 라우트 발견\n`);
  
  // 4. 역순으로 제거 (뒤에서부터 제거해야 인덱스가 안 꼬임)
  console.log('🗑️  라우트 제거 중...\n');
  routesToRemove.sort((a, b) => b.startLine - a.startLine);
  
  let totalRemoved = 0;
  for (const route of routesToRemove) {
    lines.splice(route.startLine - 1, route.lineCount);
    totalRemoved += route.lineCount;
    console.log(`  ✓ 제거: ${route.name} (${route.lineCount}줄)`);
  }
  
  console.log(`\n✅ 총 ${totalRemoved}줄 제거\n`);
  
  // 5. 파일 저장
  console.log('💾 파일 저장 중...');
  const newContent = lines.join('\n');
  fs.writeFileSync(INDEX_FILE, newContent, 'utf8');
  console.log(`✅ 저장 완료\n`);
  
  // 6. 결과 출력
  const originalLines = content.split('\n').length;
  const newLines = lines.length;
  const reduction = ((originalLines - newLines) / originalLines * 100).toFixed(2);
  
  console.log('📊 정리 결과:');
  console.log(`  원본: ${originalLines}줄`);
  console.log(`  정리 후: ${newLines}줄`);
  console.log(`  감소: ${originalLines - newLines}줄 (${reduction}%)\n`);
  
  console.log('📋 다음 단계:');
  console.log('1. 문법 오류 확인: node -c server/index.js');
  console.log('2. 서버 시작: npm start');
  console.log('3. API 테스트 실행');
  console.log('4. 문제 발생 시 백업 복구:');
  console.log(`   cp ${BACKUP_FILE} ${INDEX_FILE}\n`);
}

// 실행
cleanupIndex().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
