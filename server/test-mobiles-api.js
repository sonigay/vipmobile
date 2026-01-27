#!/usr/bin/env node
/**
 * 휴대폰 목록 API 테스트
 * 
 * 사용법:
 *   node server/test-mobiles-api.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function testMobilesAPI() {
  console.log('🧪 휴대폰 목록 API 테스트 시작...\n');

  const carriers = ['LG']; // LG만 테스트

  for (const carrier of carriers) {
    console.log(`\n📱 [${carrier}] 휴대폰 목록 조회...`);
    
    try {
      const response = await axios.get(`${API_URL}/api/direct/mobiles`, {
        params: { carrier }
      });

      const mobiles = response.data;
      console.log(`✅ 총 ${mobiles.length}개 모델 조회 완료`);

      if (mobiles.length > 0) {
        // 첫 3개 모델 샘플 출력
        console.log('\n📋 샘플 데이터 (첫 3개):');
        mobiles.slice(0, 3).forEach((mobile, index) => {
          console.log(`\n${index + 1}. ${mobile.model} (${mobile.petName})`);
          console.log(`   출고가: ${mobile.factoryPrice?.toLocaleString() || 0}원`);
          console.log(`   이통사지원금: ${mobile.publicSupport?.toLocaleString() || 0}원`);
          console.log(`   대리점지원금(부가유치): ${mobile.storeSupportWithAddon?.toLocaleString() || 0}원`);
          console.log(`   대리점지원금(부가미유치): ${mobile.storeSupportNoAddon?.toLocaleString() || 0}원`);
          console.log(`   할부원금(부가유치): ${mobile.purchasePriceWithAddon?.toLocaleString() || 0}원`);
          console.log(`   할부원금(부가미유치): ${mobile.purchasePriceNoAddon?.toLocaleString() || 0}원`);
          console.log(`   이미지: ${mobile.image ? '있음' : '없음'}`);
          console.log(`   태그: ${mobile.tags?.join(', ') || '없음'}`);
        });

        // 지원금이 0인 모델 확인
        const zeroSupportModels = mobiles.filter(m => 
          m.publicSupport === 0 || 
          m.storeSupportWithAddon === 0 || 
          m.storeSupportNoAddon === 0
        );

        if (zeroSupportModels.length > 0) {
          console.log(`\n⚠️  지원금이 0인 모델: ${zeroSupportModels.length}개`);
          zeroSupportModels.slice(0, 5).forEach(m => {
            console.log(`   - ${m.model}: 이통사=${m.publicSupport}, 대리점(유치)=${m.storeSupportWithAddon}, 대리점(미유치)=${m.storeSupportNoAddon}`);
          });
        }

        // 정렬 확인 (모델명 순서)
        console.log(`\n📊 정렬 순서 (첫 10개 모델명):`);
        mobiles.slice(0, 10).forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.model}`);
        });
      } else {
        console.log('⚠️  데이터가 없습니다.');
      }
    } catch (error) {
      console.error(`❌ [${carrier}] API 호출 실패:`, error.message);
      if (error.response) {
        console.error(`   상태 코드: ${error.response.status}`);
        console.error(`   응답 데이터:`, error.response.data);
      }
    }
  }

  console.log('\n✅ 테스트 완료');
}

testMobilesAPI().catch(error => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});
