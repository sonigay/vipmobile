/**
 * 하이브리드 시스템 자동 검증 스크립트
 * 
 * 시나리오:
 * 1. 현재 소스 상태 확인 (기본적으로 Google Sheets여야 함)
 * 2. Feature Flag를 Supabase로 변경
 * 3. 소스 상태 재확인 (Supabase여야 함)
 * 4. 데이터 조회 API 호출 (Supabase 연결 테스트)
 * 5. Feature Flag 원복 (Google Sheets로 돌아가야 함)
 */

const BASE_URL = 'http://localhost:4000';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const log = (msg, color = RESET) => console.log(`${color}${msg}${RESET}`);

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function runTest() {
    log('🚀 하이브리드 시스템 자동 검증 시작...\n', CYAN);

    // Step 1: Check Initial Status
    log('[Step 1] 현재 데이터 소스 상태 확인...', CYAN);
    const status1 = await fetchAPI('/api/quick-cost/source-status');
    if (!status1.ok) {
        log(`❌ 서버 접속 실패: ${status1.error || status1.status}`, RED);
        process.exit(1);
    }
    const initialSource = status1.data.data.currentSource;
    log(`   👉 현재 소스: ${initialSource}`, initialSource === 'sheets' ? GREEN : RED);

    // Step 2: Switch to Supabase
    log('\n[Step 2] Feature Flag 변경 -> Supabase 활성화...', CYAN);
    const switchRes = await fetchAPI('/api/db/flags', {
        method: 'POST',
        body: JSON.stringify({ key: 'quick-service', enabled: true })
    });
    if (switchRes.ok && switchRes.data.success) {
        log('   ✅ Feature Flag 변경 성공', GREEN);
    } else {
        log('   ❌ Feature Flag 변경 실패', RED);
        process.exit(1);
    }

    // Step 3: Verify Switch
    log('\n[Step 3] 변경된 소스 상태 확인...', CYAN);
    const status2 = await fetchAPI('/api/quick-cost/source-status');
    const newSource = status2.data.data.currentSource;
    if (newSource === 'supabase') {
        log(`   ✅ 소스 전환 확인: ${newSource}`, GREEN);
    } else {
        log(`   ❌ 소스 전환 실패: ${newSource}`, RED);
    }

    // Step 4: Test Data Fetch (Supabase)
    log('\n[Step 4] Supabase 데이터 조회 테스트...', CYAN);
    const dataRes = await fetchAPI('/api/quick-cost/companies');
    if (dataRes.ok && dataRes.data.success) {
        log(`   ✅ 데이터 조회 성공 (Source: ${dataRes.data.source})`, GREEN);
        log(`   📊 업체 수: ${dataRes.data.data.length}개`, GREEN);
    } else {
        log(`   ⚠️ 데이터 조회 경고: ${dataRes.data?.error || 'Unknown error'}`, RED);
        log('   (테이블이 비어있거나 스키마가 없으면 실패할 수 있음)');
    }

    // Step 5: Restore Flag
    log('\n[Step 5] Feature Flag 원복 -> Google Sheets...', CYAN);
    const restoreRes = await fetchAPI('/api/db/flags', {
        method: 'POST',
        body: JSON.stringify({ key: 'quick-service', enabled: false })
    });
    if (restoreRes.ok && restoreRes.data.success) {
        log('   ✅ Feature Flag 원복 성공', GREEN);
    } else {
        log('   ❌ Feature Flag 원복 실패', RED);
    }

    log('\n🎉 모든 테스트 완료!', CYAN);
}

runTest();
