/**
 * Discord Rate Limit 수정 테스트
 * 
 * withDiscordRateLimit 함수가 Rate Limit을 자동으로 재시도하는지 확인
 */

const axios = require('axios');

async function testRateLimitFix() {
  console.log('🧪 Discord Rate Limit 수정 테스트\n');
  console.log('⚠️ 주의: 서버를 재시작해야 변경사항이 적용됩니다!');
  console.log('   1. 기존 서버 종료 (PID 2388)');
  console.log('   2. cd server');
  console.log('   3. node index.js\n');
  console.log('서버 재시작 후 이 테스트를 다시 실행하세요.\n');
  
  try {
    console.log('📊 LG 이미지 갱신 API 호출 (타임아웃: 180초)\n');
    
    const startTime = Date.now();
    const response = await axios.post(
      'http://localhost:4001/api/direct/refresh-images-from-discord?carrier=LG',
      {},
      { timeout: 180000 }
    );
    const endTime = Date.now();
    
    console.log(`\n✅ API 응답 성공 (${((endTime - startTime) / 1000).toFixed(2)}초)\n`);
    console.log('응답 데이터:');
    console.log(`  - 성공: ${response.data.success}`);
    console.log(`  - 통신사: ${response.data.carrier}`);
    console.log(`  - 업데이트된 이미지: ${response.data.updatedCount}개`);
    console.log(`  - 실패한 이미지: ${response.data.failedCount}개`);
    
    if (response.data.failedCount === 0) {
      console.log('\n🎉 Rate Limit 문제 해결 완료!');
      console.log('   모든 이미지가 성공적으로 갱신되었습니다.');
    } else if (response.data.failedCount < 50) {
      console.log('\n✅ Rate Limit 문제 대부분 해결!');
      console.log(`   실패한 이미지가 ${response.data.failedCount}개로 크게 감소했습니다.`);
      console.log('   (이전: 170개 실패 → 현재: ' + response.data.failedCount + '개 실패)');
    } else {
      console.log('\n⚠️ 여전히 많은 이미지가 실패했습니다.');
      console.log('   추가 조치가 필요할 수 있습니다.');
    }
    
    if (response.data.failedImages && response.data.failedImages.length > 0) {
      console.log(`\n  실패한 이미지 샘플 (최대 5개):`);
      response.data.failedImages.slice(0, 5).forEach((img, idx) => {
        console.log(`    ${idx + 1}. ${img.modelId}: ${img.reason}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.error('   타임아웃 발생 - API 처리 시간이 180초를 초과했습니다.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   서버가 실행되지 않았습니다. 서버를 시작하세요.');
    }
  }
}

testRateLimitFix();
