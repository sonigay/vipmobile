const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDiscordInfo() {
  console.log('\n============================================================');
  console.log('📊 Discord 정보 확인');
  console.log('============================================================\n');

  // 직영점_단말마스터에서 Discord 정보 확인
  const { data: deviceMaster, error: deviceError } = await supabase
    .from('direct_store_device_master')
    .select('통신사, 모델명, "Discord메시지ID", "Discord포스트ID", "Discord스레드ID"')
    .eq('통신사', 'LG')
    .not('Discord메시지ID', 'is', null)
    .limit(5);

  if (deviceError) {
    console.error('❌ 단말마스터 조회 오류:', deviceError);
  } else {
    console.log('📱 [직영점_단말마스터] Discord 정보:');
    console.log(`   총 ${deviceMaster.length}개 (Discord메시지ID가 있는 것만)\n`);
    deviceMaster.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.모델명}`);
      console.log(`      메시지ID: ${item.Discord메시지ID}`);
      console.log(`      포스트ID: ${item.Discord포스트ID}`);
      console.log(`      스레드ID: ${item.Discord스레드ID}`);
    });
  }

  // 직영점_단말요금정책에서 Discord 정보 확인
  const { data: pricingPolicy, error: pricingError } = await supabase
    .from('direct_store_device_pricing_policy')
    .select('통신사, 모델명, 요금제군, "Discord메시지ID", "Discord포스트ID", "Discord스레드ID"')
    .eq('통신사', 'LG')
    .not('Discord메시지ID', 'is', null)
    .limit(5);

  if (pricingError) {
    console.error('❌ 단말요금정책 조회 오류:', pricingError);
  } else {
    console.log('\n\n💰 [직영점_단말요금정책] Discord 정보:');
    console.log(`   총 ${pricingPolicy.length}개 (Discord메시지ID가 있는 것만)\n`);
    pricingPolicy.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.모델명} - ${item.요금제군}`);
      console.log(`      메시지ID: ${item.Discord메시지ID}`);
      console.log(`      포스트ID: ${item.Discord포스트ID}`);
      console.log(`      스레드ID: ${item.Discord스레드ID}`);
    });
  }

  console.log('\n============================================================');
  console.log('✅ Discord 정보 확인 완료');
  console.log('============================================================\n');
}

checkDiscordInfo().catch(console.error);
