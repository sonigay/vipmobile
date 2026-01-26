const axios = require('axios');

async function testDiscordAPI() {
  try {
    console.log('📊 Discord 이미지 갱신 API 테스트\n');
    console.log('요청: POST http://localhost:4000/api/direct/refresh-images-from-discord?carrier=LG');
    console.log('타임아웃: 60초\n');
    
    const startTime = Date.now();
    const response = await axios.post(
      'http://localhost:4000/api/direct/refresh-images-from-discord?carrier=LG',
      {},
      { timeout: 60000 }
    );
    const endTime = Date.now();
    
    console.log(`✅ API 응답 성공 (${((endTime - startTime) / 1000).toFixed(2)}초)`);
    console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ API 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNABORTED') {
      console.error('   타임아웃 발생 - API 처리 시간이 60초를 초과했습니다.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   서버가 실행되지 않았거나 포트 4000에서 응답하지 않습니다.');
    }
  }
}

testDiscordAPI();
