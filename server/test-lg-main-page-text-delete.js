/**
 * LG 메인 페이지 문구 삭제 API 테스트
 * 
 * 테스트 시나리오:
 * 1. LG 메인 페이지 문구 조회
 * 2. LG 메인 페이지 문구 삭제
 * 3. 삭제 후 조회하여 확인
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const USE_DB = process.env.USE_DB_DIRECT_STORE;

console.log('='.repeat(80));
console.log('LG 메인 페이지 문구 삭제 API 테스트');
console.log('='.repeat(80));
console.log(`API URL: ${BASE_URL}`);
console.log(`USE_DB_DIRECT_STORE: ${USE_DB}`);
console.log('='.repeat(80));

async function testMainPageTextDelete() {
  try {
    // 1. LG 메인 페이지 문구 조회
    console.log('\n📖 1. LG 메인 페이지 문구 조회');
    console.log('-'.repeat(80));
    
    const getResponse = await axios.get(`${BASE_URL}/api/direct/main-page-texts`);
    
    if (!getResponse.data.success) {
      console.error('❌ 조회 실패:', getResponse.data);
      return;
    }
    
    const lgTexts = getResponse.data.data.transitionPages?.LG || {};
    console.log(`✅ LG 문구 개수: ${Object.keys(lgTexts).length}개`);
    
    if (Object.keys(lgTexts).length > 0) {
      console.log('\n현재 LG 문구:');
      Object.entries(lgTexts).forEach(([category, text]) => {
        console.log(`  - ${category}: ${text.content?.substring(0, 50)}...`);
      });
    } else {
      console.log('⚠️  LG 문구가 없습니다. 테스트를 위해 먼저 문구를 추가해주세요.');
      return;
    }

    // 2. LG 메인 페이지 문구 삭제
    console.log('\n🗑️  2. LG 메인 페이지 문구 삭제');
    console.log('-'.repeat(80));
    
    const deleteResponse = await axios.delete(`${BASE_URL}/api/direct/main-page-text/LG`);
    
    if (!deleteResponse.data.success) {
      console.error('❌ 삭제 실패:', deleteResponse.data);
      return;
    }
    
    console.log('✅ 삭제 성공:', deleteResponse.data.message);

    // 3. 삭제 후 조회하여 확인
    console.log('\n🔍 3. 삭제 후 조회하여 확인');
    console.log('-'.repeat(80));
    
    // 캐시 무효화를 위해 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const verifyResponse = await axios.get(`${BASE_URL}/api/direct/main-page-texts`);
    
    if (!verifyResponse.data.success) {
      console.error('❌ 조회 실패:', verifyResponse.data);
      return;
    }
    
    const lgTextsAfter = verifyResponse.data.data.transitionPages?.LG || {};
    console.log(`✅ 삭제 후 LG 문구 개수: ${Object.keys(lgTextsAfter).length}개`);
    
    if (Object.keys(lgTextsAfter).length === 0) {
      console.log('✅ LG 문구가 모두 삭제되었습니다.');
    } else {
      console.log('⚠️  일부 LG 문구가 남아있습니다:');
      Object.entries(lgTextsAfter).forEach(([category, text]) => {
        console.log(`  - ${category}: ${text.content?.substring(0, 50)}...`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 테스트 완료');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 데이터:', error.response.data);
      console.error('응답 상태:', error.response.status);
    }
  }
}

// 테스트 실행
testMainPageTextDelete();
