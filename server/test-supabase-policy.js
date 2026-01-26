/**
 * Supabase 정책 데이터 확인 스크립트
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 설정이 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicyData() {
  console.log('='.repeat(80));
  console.log('Supabase 정책 데이터 확인');
  console.log('='.repeat(80));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log('='.repeat(80));

  try {
    // 1. 정책 마진
    console.log('\n📊 1. 정책 마진 (direct_store_policy_margin)');
    const { data: marginData, error: marginError } = await supabase
      .from('direct_store_policy_margin')
      .select('*')
      .eq('통신사', 'LG');
    
    if (marginError) {
      console.error('❌ 에러:', marginError.message);
    } else {
      console.log(`✅ 데이터 개수: ${marginData.length}`);
      if (marginData.length > 0) {
        console.log('샘플:', marginData[0]);
      }
    }

    // 2. 부가서비스 정책
    console.log('\n📊 2. 부가서비스 정책 (direct_store_policy_addon_services)');
    const { data: addonData, error: addonError } = await supabase
      .from('direct_store_policy_addon_services')
      .select('*')
      .eq('통신사', 'LG');
    
    if (addonError) {
      console.error('❌ 에러:', addonError.message);
    } else {
      console.log(`✅ 데이터 개수: ${addonData.length}`);
      if (addonData.length > 0) {
        console.log('샘플:', addonData[0]);
      }
    }

    // 3. 보험상품 정책
    console.log('\n📊 3. 보험상품 정책 (direct_store_policy_insurance)');
    const { data: insuranceData, error: insuranceError } = await supabase
      .from('direct_store_policy_insurance')
      .select('*')
      .eq('통신사', 'LG');
    
    if (insuranceError) {
      console.error('❌ 에러:', insuranceError.message);
    } else {
      console.log(`✅ 데이터 개수: ${insuranceData.length}`);
      if (insuranceData.length > 0) {
        console.log('샘플:', insuranceData[0]);
      }
    }

    // 4. 특별 정책
    console.log('\n📊 4. 특별 정책 (direct_store_policy_special)');
    const { data: specialData, error: specialError } = await supabase
      .from('direct_store_policy_special')
      .select('*')
      .eq('통신사', 'LG');
    
    if (specialError) {
      console.error('❌ 에러:', specialError.message);
    } else {
      console.log(`✅ 데이터 개수: ${specialData.length}`);
      if (specialData.length > 0) {
        console.log('샘플:', specialData[0]);
      }
    }

  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('확인 완료');
  console.log('='.repeat(80));
}

checkPolicyData();
