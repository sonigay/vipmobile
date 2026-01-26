/**
 * LG 시세표 API 응답 테스트
 * 
 * 목적: GET /api/direct/mobiles?carrier=LG API 응답 확인
 */

const axios = require('axios');

async function testAPIResponse() {
  console.log('='.repeat(80));
  console.log('LG 시세표 API 응답 테스트');
  console.log('='.repeat(80));

  try {
    const url = 'http://localhost:4000/api/direct/mobiles?carrier=LG';
    console.log(`\n📡 API 호출: ${url}`);

    const response = await axios.get(url);
    const mobileList = response.data;

    console.log(`\n✅ API 응답 성공`);
    console.log(`   총 ${mobileList.length}개 모델 반환`);

    // 이미지가 있는 모델과 없는 모델 분류
    const withImage = mobileList.filter(m => m.image && m.image.trim() !== '');
    const withoutImage = mobileList.filter(m => !m.image || m.image.trim() === '');

    console.log(`\n📊 이미지 통계:`);
    console.log(`   이미지 있음: ${withImage.length}개`);
    console.log(`   이미지 없음: ${withoutImage.length}개`);

    if (withImage.length > 0) {
      console.log(`\n✅ 이미지가 있는 모델 샘플 (첫 5개):`);
      withImage.slice(0, 5).forEach((mobile, idx) => {
        console.log(`   ${idx + 1}. ${mobile.model} (${mobile.petName})`);
        console.log(`      이미지: ${mobile.image.substring(0, 60)}...`);
        if (mobile.discordMessageId) {
          console.log(`      Discord메시지ID: ${mobile.discordMessageId}`);
        }
        if (mobile.discordThreadId) {
          console.log(`      Discord스레드ID: ${mobile.discordThreadId}`);
        }
      });
    }

    if (withoutImage.length > 0) {
      console.log(`\n⚠️ 이미지가 없는 모델 (첫 10개):`);
      withoutImage.slice(0, 10).forEach((mobile, idx) => {
        console.log(`   ${idx + 1}. ${mobile.model} (${mobile.petName})`);
      });
    }

    // 특정 모델 상세 확인 (SM-S926N256)
    const testModel = mobileList.find(m => m.model === 'SM-S926N256');
    if (testModel) {
      console.log(`\n🔍 특정 모델 상세 확인: SM-S926N256`);
      console.log(JSON.stringify(testModel, null, 2));
    }

    // 전체 응답 저장
    const fs = require('fs');
    fs.writeFileSync('test-api-response-lg.json', JSON.stringify(mobileList, null, 2));
    console.log(`\n💾 전체 응답을 test-api-response-lg.json에 저장했습니다.`);

  } catch (error) {
    console.error('\n❌ API 호출 실패:', error.message);
    if (error.response) {
      console.error('   상태 코드:', error.response.status);
      console.error('   응답 데이터:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('테스트 완료');
  console.log('='.repeat(80));
}

testAPIResponse();
