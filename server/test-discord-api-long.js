const axios = require('axios');

async function testDiscordAPILong() {
  try {
    console.log('📊 Discord 이미지 갱신 API 테스트 (긴 타임아웃)\n');
    console.log('요청: POST http://localhost:4000/api/direct/refresh-images-from-discord?carrier=LG');
    console.log('타임아웃: 180초 (3분)\n');
    console.log('⏳ 처리 중... (170개 이미지 예상 시간: 약 30-60초)\n');
    
    const startTime = Date.now();
    const response = await axios.post(
      'http://localhost:4000/api/direct/refresh-images-from-discord?carrier=LG',
      {},
      { timeout: 180000 } // 3분
    );
    const endTime = Date.now();
    
    console.log(`\n✅ API 응답 성공 (${((endTime - startTime) / 1000).toFixed(2)}초)`);
    console.log('\n응답 데이터:');
    console.log(`  - 성공: ${response.data.success}`);
    console.log(`  - 통신사: ${response.data.carrier}`);
    console.log(`  - 업데이트된 이미지: ${response.data.updatedCount}개`);
    console.log(`  - 실패한 이미지: ${response.data.failedCount}개`);
    console.log(`  - 메시지: ${response.data.message}`);
    
    if (response.data.updatedImages && response.data.updatedImages.length > 0) {
      console.log(`\n  업데이트된 이미지 샘플 (최대 5개):`);
      response.data.updatedImages.slice(0, 5).forEach((img, idx) => {
        console.log(`    ${idx + 1}. ${img.modelId}`);
        console.log(`       이전: ${img.oldUrl?.substring(0, 60)}...`);
        console.log(`       이후: ${img.newUrl?.substring(0, 60)}...`);
      });
    }
    
    if (response.data.failedImages && response.data.failedImages.length > 0) {
      console.log(`\n  실패한 이미지 샘플 (최대 5개):`);
      response.data.failedImages.slice(0, 5).forEach((img, idx) => {
        console.log(`    ${idx + 1}. ${img.modelId}: ${img.reason}`);
      });
    }
  } catch (error) {
    console.error('\n❌ API 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNABORTED') {
      console.error('   타임아웃 발생 - API 처리 시간이 180초를 초과했습니다.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   서버가 실행되지 않았거나 포트 4000에서 응답하지 않습니다.');
    }
  }
}

testDiscordAPILong();
