/**
 * Phase 2-3 통합 테스트
 * 
 * 전체 CRUD 플로우 및 Feature Flag 전환 테스트
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testIntegration() {
  console.log('🧪 Phase 2-3 통합 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔥 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ========== 1. 요금제 마스터 CRUD 플로우 ==========
    console.log('📋 1. 요금제 마스터 CRUD 플로우 테스트');
    
    // CREATE
    const planData = {
      carrier: 'TEST',
      planName: 'TEST-PLAN-' + Date.now(),
      planCode: 'TEST-CODE',
      planGroup: 'TEST-GROUP',
      basicFee: 50000,
      isActive: true,
      note: 'Test'
    };
    
    await axios.post(`${API_BASE_URL}/api/direct/plans-master`, planData);
    console.log('  ✅ CREATE 성공');
    testsPassed++;
    
    // UPDATE
    await axios.put(`${API_BASE_URL}/api/direct/plans-master/${planData.carrier}/${planData.planName}`, {
      basicFee: 60000
    });
    console.log('  ✅ UPDATE 성공');
    testsPassed++;
    
    // DELETE
    await axios.delete(`${API_BASE_URL}/api/direct/plans-master/${planData.carrier}/${planData.planName}`);
    console.log('  ✅ DELETE 성공');
    testsPassed++;
    console.log('');

    // ========== 2. 단말 마스터 CRUD 플로우 ==========
    console.log('📱 2. 단말 마스터 CRUD 플로우 테스트');
    
    // CREATE
    const deviceData = {
      carrier: 'TEST',
      modelId: 'TEST-MODEL-' + Date.now(),
      modelName: 'Test Device',
      petName: 'Test',
      manufacturer: 'Test Inc',
      factoryPrice: 1000000,
      defaultPlanGroup: '115군',
      isActive: true
    };
    
    await axios.post(`${API_BASE_URL}/api/direct/mobiles-master`, deviceData);
    console.log('  ✅ CREATE 성공');
    testsPassed++;
    
    // UPDATE
    await axios.put(`${API_BASE_URL}/api/direct/mobiles-master/${deviceData.carrier}/${deviceData.modelId}`, {
      factoryPrice: 1100000
    });
    console.log('  ✅ UPDATE 성공');
    testsPassed++;
    
    // DELETE
    await axios.delete(`${API_BASE_URL}/api/direct/mobiles-master/${deviceData.carrier}/${deviceData.modelId}`);
    console.log('  ✅ DELETE 성공');
    testsPassed++;
    console.log('');

    // ========== 3. 단말 요금정책 CRUD 플로우 ==========
    console.log('💰 3. 단말 요금정책 CRUD 플로우 테스트');
    
    // CREATE
    const pricingData = {
      carrier: 'TEST',
      modelId: 'TEST-MODEL-' + Date.now(),
      modelName: 'Test Device',
      planGroup: '115군',
      planCode: 'TEST-CODE',
      openingType: 'MNP',
      factoryPrice: 1000000,
      publicSupport: 500000,
      storeAdditionalSupportWithAddon: 100000,
      policyMargin: 50000,
      policyId: 'TEST-POLICY',
      baseDate: '2024-01-01',
      note: 'Test'
    };
    
    await axios.post(`${API_BASE_URL}/api/direct/mobiles-pricing`, pricingData);
    console.log('  ✅ CREATE 성공');
    testsPassed++;
    
    // UPDATE
    await axios.put(
      `${API_BASE_URL}/api/direct/mobiles-pricing/${pricingData.carrier}/${pricingData.modelId}/${pricingData.planGroup}/${pricingData.openingType}`,
      { publicSupport: 600000 }
    );
    console.log('  ✅ UPDATE 성공');
    testsPassed++;
    
    // DELETE
    await axios.delete(
      `${API_BASE_URL}/api/direct/mobiles-pricing/${pricingData.carrier}/${pricingData.modelId}/${pricingData.planGroup}/${pricingData.openingType}`
    );
    console.log('  ✅ DELETE 성공');
    testsPassed++;
    console.log('');

    // ========== 4. 시세표 조회 API 테스트 ==========
    console.log('📊 4. 시세표 조회 API 테스트');
    
    const pricingResponse = await axios.get(`${API_BASE_URL}/api/direct/mobiles-pricing?carrier=LG`);
    if (pricingResponse.data.success && Array.isArray(pricingResponse.data.data)) {
      console.log(`  ✅ 시세표 조회 성공 (${pricingResponse.data.data.length}개)`);
      testsPassed++;
    } else {
      console.log('  ❌ 시세표 조회 실패');
      testsFailed++;
    }
    console.log('');

    // ========== 5. 시세표 마스터 조회 API 테스트 ==========
    console.log('📱 5. 시세표 마스터 조회 API 테스트');
    
    const masterResponse = await axios.get(`${API_BASE_URL}/api/direct/mobiles-master?carrier=LG`);
    if (masterResponse.data.success && Array.isArray(masterResponse.data.data)) {
      console.log(`  ✅ 시세표 마스터 조회 성공 (${masterResponse.data.data.length}개)`);
      testsPassed++;
    } else {
      console.log('  ❌ 시세표 마스터 조회 실패');
      testsFailed++;
    }
    console.log('');

    // ========== 6. 오늘의 휴대폰 API 테스트 ==========
    console.log('📱 6. 오늘의 휴대폰 API 테스트');
    
    const mobileData = {
      carrier: 'TEST',
      modelId: 'TEST-MODEL-' + Date.now(),
      modelName: 'Test Device',
      petName: 'Test',
      manufacturer: 'Test Inc',
      factoryPrice: 1000000,
      imageUrl: 'https://example.com/image.png',
      displayOrder: 1,
      isActive: true
    };
    
    await axios.post(`${API_BASE_URL}/api/direct/todays-mobiles`, mobileData);
    console.log('  ✅ 오늘의 휴대폰 생성 성공');
    testsPassed++;
    
    const todaysResponse = await axios.get(`${API_BASE_URL}/api/direct/todays-mobiles`);
    if (todaysResponse.data.premium && todaysResponse.data.budget) {
      console.log('  ✅ 오늘의 휴대폰 조회 성공');
      testsPassed++;
    } else {
      console.log('  ❌ 오늘의 휴대폰 조회 실패');
      testsFailed++;
    }
    console.log('');

    // ========== 결과 요약 ==========
    console.log('=' .repeat(50));
    console.log('📊 테스트 결과 요약');
    console.log('=' .repeat(50));
    console.log(`✅ 성공: ${testsPassed}개`);
    console.log(`❌ 실패: ${testsFailed}개`);
    console.log(`📈 성공률: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(2)}%`);
    console.log('');

    if (testsFailed === 0) {
      console.log('🎉 모든 통합 테스트 통과!\n');
    } else {
      console.log('⚠️ 일부 테스트 실패\n');
    }

  } catch (error) {
    console.error('❌ 통합 테스트 실패:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('상세 에러:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testIntegration();
