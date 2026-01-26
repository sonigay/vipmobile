require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testMobilesMasterGet() {
  console.log('🧪 시세표 마스터 조회 API 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔥 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  try {
    // 1. 전체 조회 (LG)
    console.log('1️⃣ LG 전체 단말 마스터 조회');
    const allResponse = await axios.get(`${API_BASE_URL}/api/direct/mobiles-master?carrier=LG`);
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
        `${API_BASE_URL}/api/direct/mobiles-master?carrier=LG&modelId=${firstModelId}`
      );
      console.log(`✅ 조회 성공: ${modelResponse.data.data.length}개 데이터`);
      console.log('데이터:', JSON.stringify(modelResponse.data.data[0], null, 2));
      console.log('');
    }

    // 3. 통신사별 조회
    console.log('3️⃣ 통신사별 단말 마스터 조회');
    for (const carrier of ['SK', 'KT', 'LG']) {
      const carrierResponse = await axios.get(
        `${API_BASE_URL}/api/direct/mobiles-master?carrier=${carrier}`
      );
      console.log(`  ${carrier}: ${carrierResponse.data.data.length}개`);
    }
    console.log('');

    console.log('✅ 모든 테스트 완료!\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('상세 에러:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testMobilesMasterGet();
