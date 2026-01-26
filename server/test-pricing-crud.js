/**
 * 단말 요금정책 CRUD 테스트 스크립트
 * 
 * 테스트 순서:
 * 1. POST - 새 요금정책 생성
 * 2. GET - 생성된 요금정책 조회
 * 3. PUT - 요금정책 수정
 * 4. GET - 수정된 요금정책 조회
 * 5. DELETE - 요금정책 삭제
 * 6. GET - 삭제 확인
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_CARRIER = 'LG';
const TEST_MODEL_ID = 'TEST-MODEL-001';
const TEST_MODEL_NAME = '테스트 모델';
const TEST_PLAN_GROUP = '115군';
const TEST_OPENING_TYPE = 'MNP';

async function testPricingCRUD() {
  console.log('🧪 단말 요금정책 CRUD 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`📍 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  try {
    // 1. POST - 새 요금정책 생성
    console.log('1️⃣ POST - 새 요금정책 생성');
    const createData = {
      carrier: TEST_CARRIER,
      modelId: TEST_MODEL_ID,
      modelName: TEST_MODEL_NAME,
      planGroup: TEST_PLAN_GROUP,
      planCode: 'LG115',
      openingType: TEST_OPENING_TYPE,
      factoryPrice: 1000000,
      publicSupport: 500000,
      storeAdditionalSupportWithAddon: 100000,
      policyMargin: 50000,
      policyId: 'TEST-POLICY-001',
      baseDate: '2024-01-15',
      note: '테스트용 요금정책'
    };

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/direct/mobiles-pricing`,
      createData
    );
    console.log('✅ 생성 성공:', createResponse.data);
    console.log('');

    // 2. GET - 생성된 요금정책 조회
    console.log('2️⃣ GET - 생성된 요금정책 조회');
    const getResponse1 = await axios.get(
      `${API_BASE_URL}/api/direct/mobiles-pricing`,
      {
        params: {
          carrier: TEST_CARRIER,
          modelId: TEST_MODEL_ID,
          planGroup: TEST_PLAN_GROUP,
          openingType: TEST_OPENING_TYPE
        }
      }
    );
    console.log('✅ 조회 성공:', JSON.stringify(getResponse1.data.data, null, 2));
    console.log('');

    // 3. PUT - 요금정책 수정
    console.log('3️⃣ PUT - 요금정책 수정');
    const updateData = {
      publicSupport: 600000,
      storeAdditionalSupportWithAddon: 150000,
      policyMargin: 60000,
      note: '수정된 테스트용 요금정책'
    };

    const updateResponse = await axios.put(
      `${API_BASE_URL}/api/direct/mobiles-pricing/${TEST_CARRIER}/${TEST_MODEL_ID}/${TEST_PLAN_GROUP}/${TEST_OPENING_TYPE}`,
      updateData
    );
    console.log('✅ 수정 성공:', updateResponse.data);
    console.log('');

    // 4. GET - 수정된 요금정책 조회
    console.log('4️⃣ GET - 수정된 요금정책 조회');
    const getResponse2 = await axios.get(
      `${API_BASE_URL}/api/direct/mobiles-pricing`,
      {
        params: {
          carrier: TEST_CARRIER,
          modelId: TEST_MODEL_ID,
          planGroup: TEST_PLAN_GROUP,
          openingType: TEST_OPENING_TYPE
        }
      }
    );
    console.log('✅ 조회 성공:', JSON.stringify(getResponse2.data.data, null, 2));
    
    // 수정 확인
    const updatedItem = getResponse2.data.data[0];
    if (updatedItem) {
      console.log('\n📊 수정 확인:');
      console.log(`  - publicSupport: ${updatedItem.publicSupport} (예상: 600000)`);
      console.log(`  - storeSupportWithAddon: ${updatedItem.storeSupportWithAddon} (예상: 150000)`);
      console.log(`  - policyMargin: ${updatedItem.policyMargin} (예상: 60000)`);
      console.log(`  - note: ${updatedItem.note} (예상: 수정된 테스트용 요금정책)`);
    }
    console.log('');

    // 5. DELETE - 요금정책 삭제
    console.log('5️⃣ DELETE - 요금정책 삭제');
    const deleteResponse = await axios.delete(
      `${API_BASE_URL}/api/direct/mobiles-pricing/${TEST_CARRIER}/${TEST_MODEL_ID}/${TEST_PLAN_GROUP}/${TEST_OPENING_TYPE}`
    );
    console.log('✅ 삭제 성공:', deleteResponse.data);
    console.log('');

    // 6. GET - 삭제 확인
    console.log('6️⃣ GET - 삭제 확인');
    const getResponse3 = await axios.get(
      `${API_BASE_URL}/api/direct/mobiles-pricing`,
      {
        params: {
          carrier: TEST_CARRIER,
          modelId: TEST_MODEL_ID,
          planGroup: TEST_PLAN_GROUP,
          openingType: TEST_OPENING_TYPE
        }
      }
    );
    console.log('✅ 조회 성공:', JSON.stringify(getResponse3.data.data, null, 2));
    
    if (getResponse3.data.data.length === 0) {
      console.log('✅ 삭제 확인: 데이터가 정상적으로 삭제되었습니다.');
    } else {
      console.log('⚠️ 삭제 확인: 데이터가 아직 남아있습니다.');
    }
    console.log('');

    console.log('🎉 모든 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 데이터:', error.response.data);
      console.error('응답 상태:', error.response.status);
    }
    process.exit(1);
  }
}

// 테스트 실행
testPricingCRUD();
