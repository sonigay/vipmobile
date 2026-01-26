/**
 * LG 시세표 API 호출 테스트
 * 
 * 목적:
 * - GET /api/direct/mobiles?carrier=LG 호출
 * - 응답 데이터에서 이미지 URL 확인
 * - 이미지가 없는 모델 확인
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

async function testLGAPICall() {
  try {
    console.log('=== LG 시세표 API 호출 테스트 ===\n');
    console.log(`API URL: ${API_URL}/api/direct/mobiles?carrier=LG\n`);

    // API 호출
    const response = await axios.get(`${API_URL}/api/direct/mobiles`, {
      params: { carrier: 'LG' }
    });

    const mobileList = response.data;
    console.log(`✅ 응답 받음: ${mobileList.length}개 모델\n`);

    // 이미지가 있는 모델과 없는 모델 분류
    const withImage = mobileList.filter(m => m.image);
    const withoutImage = mobileList.filter(m => !m.image);

    console.log(`📊 통계:`);
    console.log(`  - 이미지 있음: ${withImage.length}개`);
    console.log(`  - 이미지 없음: ${withoutImage.length}개\n`);

    // 이미지가 있는 모델 출력 (처음 10개)
    if (withImage.length > 0) {
      console.log('=== 이미지가 있는 모델 (처음 10개) ===');
      withImage.slice(0, 10).forEach((mobile, idx) => {
        console.log(`\n[${idx + 1}] ${mobile.model} (${mobile.petName})`);
        console.log(`  - 이미지: ${mobile.image ? mobile.image.substring(0, 80) + '...' : '없음'}`);
        console.log(`  - Discord메시지ID: ${mobile.discordMessageId || '없음'}`);
        console.log(`  - Discord스레드ID: ${mobile.discordThreadId || '없음'}`);
      });
    }

    // 이미지가 없는 모델 출력
    if (withoutImage.length > 0) {
      console.log('\n\n=== 이미지가 없는 모델 ===');
      withoutImage.forEach((mobile, idx) => {
        console.log(`[${idx + 1}] ${mobile.model} (${mobile.petName})`);
      });
    }

    // 특정 모델 확인 (SM-S926N256, SM-F766N256 등)
    console.log('\n\n=== 특정 모델 확인 ===');
    const testModels = ['SM-S926N256', 'SM-F766N256', 'UIP17-256', 'SM-A166L', 'AT-M140L'];
    testModels.forEach(modelName => {
      const mobile = mobileList.find(m => m.model === modelName);
      if (mobile) {
        console.log(`\n✅ ${modelName} 찾음`);
        console.log(`  - 펫네임: ${mobile.petName}`);
        console.log(`  - 이미지: ${mobile.image ? '있음' : '없음'}`);
        if (mobile.image) {
          console.log(`    ${mobile.image.substring(0, 80)}...`);
        }
        console.log(`  - Discord메시지ID: ${mobile.discordMessageId || '없음'}`);
        console.log(`  - Discord스레드ID: ${mobile.discordThreadId || '없음'}`);
      } else {
        console.log(`\n❌ ${modelName} 찾을 수 없음`);
      }
    });

    console.log('\n\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
}

// 실행
testLGAPICall();
