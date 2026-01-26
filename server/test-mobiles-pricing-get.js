require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testMobilesPricingGet() {
  console.log('🧪 시세표 조회 API 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔥 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  try {
    // 1. 전체 조회 (LG)
    console.log('1️⃣ LG 전체 시세표 조회');
    const allResponse = await axios.get(`${API_BASE_URL}/api/direct/mobiles-pricing?carrier=LG`);
    console.log(`✅ 조회 성공: ${allResponse.data.data.length}개 데이터`);
    if (allResponse.data.data.length > 0) {
      console.log('첫 번째 데이터:', JSON.stringify(allResponse.data.data[0], null, 2));
    }
    console.log('');

    // 2. 모델ID 필터링
    if (allResponse.data.data.length > 0) {
      const firstModelId = allResponse.data.data[0].modelId;
      console.log(`2️⃣ 모델ID 필터링 조회 (${firstModelId})`);
      const modelResponse = await axios.get(
        `${API_BASE_URL}/api/direct/mobiles-pricing?carrier=LG&modelId=${firstModelId}`
      );
      console.log(`✅ 조회 성공: ${modelResponse.data.data.length}개 데이터`);
      console.log('');
    }

    // 3. 요금제군 필터링
    if (allResponse.data.data.length > 0) {
      const firstPlanGroup = allResponse.data.data[0].planGroup;
      console.log(`3️⃣ 요금제군 필터링 조회 (${firstPlanGroup})`);
      const planResponse = await axios.get(
        `${API_BASE_URL}/api/direct/mobiles-pricing?carrier=LG&planGroup=${firstPlanGroup}`
      );
      console.log(`✅ 조회 성공: ${planResponse.data.data.length}개 데이터`);
      console.log('');
    }

    // 4. 개통유형 필터링
    console.log('4️⃣ 개통유형 필터링 조회 (MNP)');
    const mnpResponse = await axios.get(
      `${API_BASE_URL}/api/direct/mobiles-pricing?carrier=LG&openingType=MNP`
    );
    console.log(`✅ 조회 성공: ${mnpResponse.data.data.length}개 데이터`);
    console.log('');

    console.log('✅ 모든 테스트 완료!\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('상세 에러:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testMobilesPricingGet();
