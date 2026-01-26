/**
 * LG 메인 페이지 문구 삭제 API 간단 테스트
 * 
 * Google Sheets를 직접 확인하지 않고 API만 테스트
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const USE_DB = process.env.USE_DB_DIRECT_STORE;

console.log('='.repeat(80));
console.log('LG 메인 페이지 문구 삭제 API 간단 테스트');
console.log('='.repeat(80));
console.log(`API URL: ${BASE_URL}`);
console.log(`USE_DB_DIRECT_STORE: ${USE_DB}`);
console.log('='.repeat(80));

async function testMainPageTextDelete() {
  try {
    // 1. LG 메인 페이지 문구 추가 (테스트용)
    console.log('\n📝 1. LG 메인 페이지 문구 추가 (테스트용)');
    console.log('-'.repeat(80));
    
    const addResponse = await axios.post(`${BASE_URL}/api/direct/main-page-texts`, {
      carrier: 'LG',
      category: '테스트카테고리',
      textType: 'transitionPage',
      content: '테스트 문구입니다.',
      imageUrl: 'https://example.com/test.jpg'
    });
    
    if (!addResponse.data.success) {
      console.error('❌ 추가 실패:', addResponse.data);
      return;
    }
    
    console.log('✅ 추가 성공:', addResponse.data.message);

    // 2. LG 메인 페이지 문구 삭제
    console.log('\n🗑️  2. LG 메인 페이지 문구 삭제');
    console.log('-'.repeat(80));
    
    const deleteResponse = await axios.delete(`${BASE_URL}/api/direct/main-page-text/LG`);
    
    if (!deleteResponse.data.success) {
      console.error('❌ 삭제 실패:', deleteResponse.data);
      return;
    }
    
    console.log('✅ 삭제 성공:', deleteResponse.data.message);

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
