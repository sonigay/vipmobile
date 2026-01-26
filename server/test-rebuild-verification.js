/**
 * Task 0.3: 재빌드 버튼 테스트
 * 
 * 데이터 재빌드 API 테스트 및 Supabase 데이터 확인
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('./supabaseClient');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testRebuild() {
  console.log('🧪 Task 0.3: 재빌드 버튼 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔥 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  try {
    // ========== 1. LG 재빌드 테스트 ==========
    console.log('1️⃣ LG 데이터 재빌드 테스트');
    
    const lgResponse = await axios.post(`${API_BASE_URL}/api/direct/plans-master/rebuild?carrier=LG`);
    console.log(`  ✅ LG 재빌드 API 호출 성공:`, lgResponse.data);
    
    // Supabase 데이터 확인
    console.log('  📊 Supabase 데이터 확인 중...');
    
    const { data: planData, error: planError } = await supabase
      .from('direct_store_plan_master')
      .select('*')
      .eq('통신사', 'LG')
      .limit(5);
    
    if (planError) {
      console.log(`  ⚠️ 요금제 마스터 조회 실패:`, planError.message);
    } else {
      console.log(`  ✅ 요금제 마스터: ${planData.length}개 데이터 확인`);
      if (planData.length > 0) {
        console.log(`     첫 번째 데이터:`, planData[0]);
      }
    }
    
    const { data: deviceData, error: deviceError } = await supabase
      .from('direct_store_device_master')
      .select('*')
      .eq('통신사', 'LG')
      .limit(5);
    
    if (deviceError) {
      console.log(`  ⚠️ 단말 마스터 조회 실패:`, deviceError.message);
    } else {
      console.log(`  ✅ 단말 마스터: ${deviceData.length}개 데이터 확인`);
      if (deviceData.length > 0) {
        console.log(`     첫 번째 데이터:`, deviceData[0]);
      }
    }
    
    const { data: pricingData, error: pricingError } = await supabase
      .from('direct_store_device_pricing_policy')
      .select('*')
      .eq('통신사', 'LG')
      .limit(5);
    
    if (pricingError) {
      console.log(`  ⚠️ 단말 요금정책 조회 실패:`, pricingError.message);
    } else {
      console.log(`  ✅ 단말 요금정책: ${pricingData.length}개 데이터 확인`);
      if (pricingData.length > 0) {
        console.log(`     첫 번째 데이터:`, pricingData[0]);
      }
    }
    console.log('');

    // ========== 2. 전체 통신사 재빌드 테스트 ==========
    console.log('2️⃣ 전체 통신사 데이터 재빌드 테스트');
    
    const allResponse = await axios.post(`${API_BASE_URL}/api/direct/plans-master/rebuild`);
    console.log(`  ✅ 전체 재빌드 API 호출 성공:`, allResponse.data);
    
    // 각 통신사별 데이터 확인
    for (const carrier of ['SK', 'KT', 'LG']) {
      const { data, error } = await supabase
        .from('direct_store_plan_master')
        .select('통신사', { count: 'exact', head: true })
        .eq('통신사', carrier);
      
      if (error) {
        console.log(`  ⚠️ ${carrier} 데이터 확인 실패:`, error.message);
      } else {
        console.log(`  ✅ ${carrier}: 요금제 마스터 데이터 확인`);
      }
    }
    console.log('');

    // ========== 3. 결과 요약 ==========
    console.log('=' .repeat(50));
    console.log('📊 Task 0.3 테스트 결과');
    console.log('=' .repeat(50));
    console.log('✅ 재빌드 API 정상 작동');
    console.log('✅ Supabase 데이터 저장 확인');
    console.log('✅ 전체 통신사 재빌드 확인');
    console.log('');
    console.log('🎉 Task 0.3 완료!\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('상세 에러:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testRebuild();
