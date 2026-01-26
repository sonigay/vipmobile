/**
 * 시세표 이미지 로드 테스트 (LG 통신사)
 * 
 * 테스트 목적:
 * 1. 직영점_모델이미지 시트에서 이미지 데이터 읽기
 * 2. imageMap 생성 확인
 * 3. getMobileList() API 호출 시 이미지 매핑 확인
 * 4. 이미지 URL, Discord 메시지 ID, Discord 스레드 ID 확인
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function testImageLoad() {
  console.log('=== 시세표 이미지 로드 테스트 (LG) ===\n');

  try {
    // LG 통신사의 시세표 조회
    console.log('1. LG 시세표 조회 중...');
    const response = await axios.get(`${API_URL}/api/direct/mobiles`, {
      params: {
        carrier: 'LG',
        storeId: 'test-store'
      }
    });

    if (!response.data || !Array.isArray(response.data)) {
      console.error('❌ 응답 데이터가 배열이 아닙니다:', response.data);
      return;
    }

    const mobileList = response.data;
    console.log(`✅ 총 ${mobileList.length}개 모델 조회됨\n`);

    // 이미지가 있는 모델과 없는 모델 분류
    const withImage = mobileList.filter(m => m.image);
    const withoutImage = mobileList.filter(m => !m.image);

    console.log('2. 이미지 로드 통계:');
    console.log(`   - 이미지 있음: ${withImage.length}개`);
    console.log(`   - 이미지 없음: ${withoutImage.length}개`);
    console.log(`   - 이미지 로드율: ${((withImage.length / mobileList.length) * 100).toFixed(1)}%\n`);

    // Discord 정보가 있는 모델 확인
    const withDiscordInfo = mobileList.filter(m => m.discordMessageId || m.discordThreadId);
    console.log('3. Discord 정보 통계:');
    console.log(`   - Discord 정보 있음: ${withDiscordInfo.length}개`);
    console.log(`   - Discord 메시지 ID 있음: ${mobileList.filter(m => m.discordMessageId).length}개`);
    console.log(`   - Discord 스레드 ID 있음: ${mobileList.filter(m => m.discordThreadId).length}개\n`);

    // 샘플 데이터 출력 (이미지가 있는 첫 5개)
    console.log('4. 이미지가 있는 모델 샘플 (최대 5개):');
    withImage.slice(0, 5).forEach((mobile, idx) => {
      console.log(`   ${idx + 1}. ${mobile.model} (${mobile.petName})`);
      console.log(`      - 이미지 URL: ${mobile.image.substring(0, 80)}...`);
      console.log(`      - Discord 메시지 ID: ${mobile.discordMessageId || '없음'}`);
      console.log(`      - Discord 스레드 ID: ${mobile.discordThreadId || '없음'}`);
    });

    // 이미지가 없는 모델 샘플 출력
    if (withoutImage.length > 0) {
      console.log('\n5. 이미지가 없는 모델 샘플 (최대 5개):');
      withoutImage.slice(0, 5).forEach((mobile, idx) => {
        console.log(`   ${idx + 1}. ${mobile.model} (${mobile.petName})`);
      });
    }

    // 결과 요약
    console.log('\n=== 테스트 결과 요약 ===');
    if (withImage.length === 0) {
      console.log('❌ 이미지가 로드된 모델이 없습니다!');
      console.log('   원인 가능성:');
      console.log('   1. 직영점_모델이미지 시트에 LG 데이터가 없음');
      console.log('   2. 이미지 매핑 로직 오류');
      console.log('   3. 모델 코드 불일치');
    } else if (withImage.length < mobileList.length * 0.5) {
      console.log('⚠️  이미지 로드율이 50% 미만입니다.');
      console.log('   일부 모델의 이미지가 누락되었을 수 있습니다.');
    } else {
      console.log('✅ 이미지 로드가 정상적으로 작동합니다.');
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('   응답 상태:', error.response.status);
      console.error('   응답 데이터:', error.response.data);
    }
  }
}

// 테스트 실행
testImageLoad();
