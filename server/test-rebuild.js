/**
 * 재빌드 버튼 테스트 스크립트
 * 태스크 0.3: 재빌드 버튼 테스트
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testRebuild(carrier) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 [테스트] ${carrier || '전체'} 재빌드 시작...`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();

  try {
    const url = carrier 
      ? `${BASE_URL}/api/direct/rebuild-master?carrier=${carrier}`
      : `${BASE_URL}/api/direct/rebuild-master`;

    const response = await axios.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2분 타임아웃
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ [성공] ${carrier || '전체'} 재빌드 완료 (${elapsedTime}초)`);
    console.log(`\n📊 [결과]:`);
    console.log(JSON.stringify(response.data, null, 2));

    return {
      success: true,
      carrier: carrier || 'ALL',
      elapsedTime,
      data: response.data
    };
  } catch (error) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error(`❌ [실패] ${carrier || '전체'} 재빌드 실패 (${elapsedTime}초)`);
    console.error(`오류: ${error.message}`);
    
    if (error.response) {
      console.error(`상태 코드: ${error.response.status}`);
      console.error(`응답 데이터:`, error.response.data);
    }

    return {
      success: false,
      carrier: carrier || 'ALL',
      elapsedTime,
      error: error.message
    };
  }
}

async function checkSupabaseData() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 [검증] Supabase 데이터 확인...`);
  console.log(`${'='.repeat(60)}\n`);

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  try {
    // 요금제 마스터 확인
    const { data: plans, error: plansError } = await supabase
      .from('직영점_요금제마스터')
      .select('통신사, count')
      .limit(1);

    if (plansError) throw plansError;

    const { count: plansCount } = await supabase
      .from('직영점_요금제마스터')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ 직영점_요금제마스터: ${plansCount}개`);

    // 단말 마스터 확인
    const { count: devicesCount } = await supabase
      .from('직영점_단말마스터')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ 직영점_단말마스터: ${devicesCount}개`);

    // 단말 요금정책 확인
    const { count: pricingCount } = await supabase
      .from('직영점_단말요금정책')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ 직영점_단말요금정책: ${pricingCount}개`);

    // 통신사별 카운트
    console.log(`\n📊 [통신사별 데이터]:`);
    
    for (const carrier of ['SK', 'KT', 'LG']) {
      const { count: carrierPlans } = await supabase
        .from('직영점_요금제마스터')
        .select('*', { count: 'exact', head: true })
        .eq('통신사', carrier);

      const { count: carrierDevices } = await supabase
        .from('직영점_단말마스터')
        .select('*', { count: 'exact', head: true })
        .eq('통신사', carrier);

      const { count: carrierPricing } = await supabase
        .from('직영점_단말요금정책')
        .select('*', { count: 'exact', head: true })
        .eq('통신사', carrier);

      console.log(`  ${carrier}: 요금제 ${carrierPlans}개, 단말 ${carrierDevices}개, 요금정책 ${carrierPricing}개`);
    }

    return {
      success: true,
      plans: plansCount,
      devices: devicesCount,
      pricing: pricingCount
    };
  } catch (error) {
    console.error(`❌ Supabase 데이터 확인 실패:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 재빌드 버튼 테스트 시작`);
  console.log(`Feature Flag: USE_DB_DIRECT_STORE=${process.env.USE_DB_DIRECT_STORE}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = [];

  // 1. SK 재빌드 테스트
  results.push(await testRebuild('SK'));
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기

  // 2. KT 재빌드 테스트
  results.push(await testRebuild('KT'));
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기

  // 3. LG 재빌드 테스트
  results.push(await testRebuild('LG'));
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기

  // 4. 전체 재빌드 테스트
  results.push(await testRebuild(null));

  // 5. Supabase 데이터 확인 (USE_DB_DIRECT_STORE=true인 경우만)
  let supabaseCheck = null;
  if (process.env.USE_DB_DIRECT_STORE === 'true') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
    supabaseCheck = await checkSupabaseData();
  }

  // 최종 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 [최종 결과 요약]`);
  console.log(`${'='.repeat(60)}\n`);

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.carrier}: ${result.elapsedTime}초`);
  });

  if (supabaseCheck) {
    console.log(`\n📊 [Supabase 데이터]:`);
    if (supabaseCheck.success) {
      console.log(`  ✅ 요금제: ${supabaseCheck.plans}개`);
      console.log(`  ✅ 단말: ${supabaseCheck.devices}개`);
      console.log(`  ✅ 요금정책: ${supabaseCheck.pricing}개`);
    } else {
      console.log(`  ❌ 확인 실패: ${supabaseCheck.error}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 테스트 완료`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

// 실행
main().catch(error => {
  console.error('테스트 실행 중 오류 발생:', error);
  process.exit(1);
});
