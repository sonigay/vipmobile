/**
 * Supabase 데이터 확인 스크립트
 * 태스크 0.3: 재빌드 버튼 테스트 - Supabase 데이터 확인
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkSupabaseData() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Supabase 데이터 확인`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 1. 요금제 마스터 확인
    console.log(`📊 [직영점_요금제마스터] (direct_store_plan_master)`);
    const { data: allPlans, error: plansError } = await supabase
      .from('direct_store_plan_master')
      .select('통신사');

    if (plansError) {
      console.error(`  ❌ 오류: ${plansError.message}`);
      return { success: false, error: plansError.message };
    }
    
    const plansCount = allPlans ? allPlans.length : 0;
    console.log(`  ✅ 총 ${plansCount}개`);

    // 통신사별 카운트
    for (const carrier of ['SK', 'KT', 'LG']) {
      const carrierPlans = allPlans ? allPlans.filter(p => p.통신사 === carrier) : [];
      console.log(`     ${carrier}: ${carrierPlans.length}개`);
    }

      // 샘플 데이터 조회 (LG 5개)
      const { data: samplePlans } = await supabase
        .from('direct_store_plan_master')
        .select('통신사, 요금제명, 요금제군, 기본료')
        .eq('통신사', 'LG')
        .limit(5);

      if (samplePlans && samplePlans.length > 0) {
        console.log(`\n  📝 샘플 데이터 (LG 5개):`);
        samplePlans.forEach((plan, idx) => {
          console.log(`     ${idx + 1}. ${plan.요금제명} (${plan.요금제군}) - ${plan.기본료}원`);
        });
      }
    

    // 2. 단말 마스터 확인
    console.log(`\n📊 [직영점_단말마스터] (direct_store_device_master)`);
    const { data: allDevices, error: devicesError } = await supabase
      .from('direct_store_device_master')
      .select('통신사');

    if (devicesError) {
      console.error(`  ❌ 오류: ${devicesError.message}`);
      return { success: false, error: devicesError.message };
    }
    
    const devicesCount = allDevices ? allDevices.length : 0;
    console.log(`  ✅ 총 ${devicesCount}개`);

    // 통신사별 카운트
    for (const carrier of ['SK', 'KT', 'LG']) {
      const carrierDevices = allDevices ? allDevices.filter(d => d.통신사 === carrier) : [];
      console.log(`     ${carrier}: ${carrierDevices.length}개`);
    }

      // 샘플 데이터 조회 (LG 5개)
      const { data: sampleDevices } = await supabase
        .from('direct_store_device_master')
        .select('통신사, 모델명, 펫네임, 출고가, isPremium, isBudget')
        .eq('통신사', 'LG')
        .limit(5);

      if (sampleDevices && sampleDevices.length > 0) {
        console.log(`\n  📝 샘플 데이터 (LG 5개):`);
        sampleDevices.forEach((device, idx) => {
          const tags = [];
          if (device.isPremium === 'Y') tags.push('프리미엄');
          if (device.isBudget === 'Y') tags.push('보급형');
          const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
          console.log(`     ${idx + 1}. ${device.모델명} (${device.펫네임}) - ${device.출고가}원${tagStr}`);
        });
      }
    

    // 3. 단말 요금정책 확인
    console.log(`\n📊 [직영점_단말요금정책] (direct_store_device_pricing_policy)`);
    const { data: allPricing, error: pricingError } = await supabase
      .from('direct_store_device_pricing_policy')
      .select('통신사');

    if (pricingError) {
      console.error(`  ❌ 오류: ${pricingError.message}`);
      return { success: false, error: pricingError.message };
    }
    
    const pricingCount = allPricing ? allPricing.length : 0;
    console.log(`  ✅ 총 ${pricingCount}개`);

    // 통신사별 카운트
    for (const carrier of ['SK', 'KT', 'LG']) {
      const carrierPricing = allPricing ? allPricing.filter(p => p.통신사 === carrier) : [];
      console.log(`     ${carrier}: ${carrierPricing.length}개`);
    }

      // 샘플 데이터 조회 (LG 5개)
      if (pricingCount > 0) {
        const { data: samplePricing } = await supabase
          .from('direct_store_device_pricing_policy')
          .select('통신사, 모델명, 요금제군, 개통유형, 이통사지원금, 정책마진')
          .eq('통신사', 'LG')
          .limit(5);

        if (samplePricing && samplePricing.length > 0) {
          console.log(`\n  📝 샘플 데이터 (LG 5개):`);
          samplePricing.forEach((pricing, idx) => {
            console.log(`     ${idx + 1}. ${pricing.모델명} (${pricing.요금제군}, ${pricing.개통유형}) - 지원금: ${pricing.이통사지원금}원, 마진: ${pricing.정책마진}원`);
          });
        }
      }
    

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Supabase 데이터 확인 완료`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      plans: plansCount,
      devices: devicesCount,
      pricing: pricingCount
    };
  } catch (error) {
    console.error(`\n❌ Supabase 데이터 확인 실패:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 실행
checkSupabaseData()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('스크립트 실행 중 오류 발생:', error);
    process.exit(1);
  });
