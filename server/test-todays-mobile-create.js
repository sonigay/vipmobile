require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testTodaysMobileCreate() {
  console.log('🧪 오늘의 휴대폰 생성 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔥 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  try {
    // 1. POST - 새 오늘의 휴대폰 생성
    console.log('1️⃣ POST - 새 오늘의 휴대폰 생성');
    const createData = {
      carrier: 'LG',
      modelName: '갤럭시 S24',
      modelId: 'SM-S921',
      category: '프리미엄',
      tags: ['5G', '플래그십'],
      displayOrder: 1,
      isActive: true
    };

    const createResponse = await axios.post(
      `${API_BASE_URL}/api/direct/todays-mobiles`,
      createData
    );
    console.log('✅ 생성 성공:', createResponse.data);
    console.log('');

    // 2. GET - 생성된 오늘의 휴대폰 조회
    console.log('2️⃣ GET - 생성된 오늘의 휴대폰 조회');
    const getResponse = await axios.get(`${API_BASE_URL}/api/direct/todays-mobiles`);
    
    // LG 프리미엄 카테고리에서 방금 생성한 모델 찾기
    const createdMobile = getResponse.data.premium.find(
      m => m.carrier === 'LG' && m.modelId === 'SM-S921'
    );
    
    if (createdMobile) {
      console.log('✅ 조회 성공:', JSON.stringify(createdMobile, null, 2));
    } else {
      console.log('⚠️ 생성된 데이터를 찾을 수 없습니다.');
      console.log('프리미엄 데이터:', getResponse.data.premium.filter(m => m.carrier === 'LG'));
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

testTodaysMobileCreate();
