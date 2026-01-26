const axios = require('axios');

async function testSimpleAPI() {
  try {
    console.log('Testing API connection...');
    const response = await axios.get('http://localhost:4000/api/health', { timeout: 5000 });
    console.log('✅ API is responding:', response.data);
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   서버가 실행되지 않았거나 포트 4000에서 응답하지 않습니다.');
    }
  }
}

testSimpleAPI();
