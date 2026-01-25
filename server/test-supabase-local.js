/**
 * 로컬 Supabase 연결 및 스키마 확인 스크립트
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('='.repeat(70));
console.log('🔍 로컬 Supabase 연결 테스트');
console.log('='.repeat(70));
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Feature Flags:`);
console.log(`  - USE_DB_DIRECT_STORE: ${process.env.USE_DB_DIRECT_STORE}`);
console.log(`  - USE_DB_POLICY: ${process.env.USE_DB_POLICY}`);
console.log(`  - USE_DB_CUSTOMER: ${process.env.USE_DB_CUSTOMER}`);
console.log('='.repeat(70));

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('\n📊 테이블 존재 확인 중...\n');

    // 직영점 테이블 확인 (14개)
    const directStoreTables = [
      'direct_store_policy_margin',
      'direct_store_policy_addon_services',
      'direct_store_policy_insurance',
      'direct_store_policy_special',
      'direct_store_settings',
      'direct_store_main_page_texts',
      'direct_store_plan_master',
      'direct_store_device_master',
      'direct_store_device_pricing_policy',
      'direct_store_model_images',
      'direct_store_todays_mobiles',
      'direct_store_transit_locations',
      'direct_store_photos',
      'direct_store_sales_daily'
    ];

    // 정책 테이블 확인 (10개)
    const policyTables = [
      'policy_table_settings',
      'policy_table_list',
      'policy_user_groups',
      'policy_tab_order',
      'policy_group_change_history',
      'policy_default_groups',
      'policy_other_types',
      'budget_channel_settings',
      'budget_basic_settings',
      'budget_basic_data_settings'
    ];

    // 고객 테이블 확인 (7개)
    const customerTables = [
      'customer_info',
      'purchase_queue',
      'board',
      'direct_store_pre_approval_marks',
      'reservation_all_customers',
      'reservation_customers',
      'unmatched_customers'
    ];

    let successCount = 0;
    let failCount = 0;

    console.log('📦 직영점 모드 테이블 (14개):');
    for (const table of directStoreTables) {
      try {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) throw error;
        console.log(`  ✅ ${table}`);
        successCount++;
      } catch (error) {
        console.log(`  ❌ ${table} - ${error.message}`);
        failCount++;
      }
    }

    console.log('\n📋 정책 모드 테이블 (10개):');
    for (const table of policyTables) {
      try {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) throw error;
        console.log(`  ✅ ${table}`);
        successCount++;
      } catch (error) {
        console.log(`  ❌ ${table} - ${error.message}`);
        failCount++;
      }
    }

    console.log('\n👥 고객 모드 테이블 (7개):');
    for (const table of customerTables) {
      try {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) throw error;
        console.log(`  ✅ ${table}`);
        successCount++;
      } catch (error) {
        console.log(`  ❌ ${table} - ${error.message}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 결과 요약:');
    console.log(`  ✅ 성공: ${successCount}/31 테이블`);
    console.log(`  ❌ 실패: ${failCount}/31 테이블`);
    console.log('='.repeat(70));

    if (successCount === 31) {
      console.log('\n🎉 모든 테이블이 정상적으로 생성되었습니다!');
      console.log('\n다음 단계:');
      console.log('  1. 마이그레이션 실행: node migration/autoMigrate.js --mode=all');
      console.log('  2. 또는 모드별 실행:');
      console.log('     - node migration/autoMigrate.js --mode=direct');
      console.log('     - node migration/autoMigrate.js --mode=policy');
      console.log('     - node migration/autoMigrate.js --mode=customer');
    } else {
      console.log('\n⚠️  일부 테이블이 생성되지 않았습니다.');
      console.log('   Supabase SQL Editor에서 스키마 파일을 다시 실행하세요.');
    }

  } catch (error) {
    console.error('\n❌ 연결 실패:', error.message);
    console.log('\n문제 해결:');
    console.log('  1. .env 파일의 SUPABASE_URL과 SUPABASE_KEY 확인');
    console.log('  2. Supabase 프로젝트가 활성화되어 있는지 확인');
    console.log('  3. 네트워크 연결 확인');
  }
}

testConnection();
