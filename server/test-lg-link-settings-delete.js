/**
 * LG 링크 설정 삭제 API 테스트
 * 
 * 테스트 시나리오:
 * 1. LG 링크 설정 조회 (삭제 전)
 * 2. LG 링크 설정 삭제 (policy 설정)
 * 3. LG 링크 설정 조회 (삭제 후 확인)
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testLGLinkSettingsDelete() {
  console.log('='.repeat(80));
  console.log('🧪 LG 링크 설정 삭제 API 테스트 시작');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. LG 링크 설정 조회 (삭제 전)
    console.log('📖 1단계: LG 링크 설정 조회 (삭제 전)');
    console.log('-'.repeat(80));
    
    const getResponse1 = await axios.get(`${API_BASE_URL}/api/direct/link-settings`, {
      params: { carrier: 'LG' }
    });
    
    console.log('✅ 조회 성공 (삭제 전)');
    console.log('응답 데이터:', JSON.stringify(getResponse1.data, null, 2));
    console.log();

    // 2. LG 링크 설정 삭제 (policy 설정)
    console.log('🗑️ 2단계: LG 링크 설정 삭제 (policy 설정)');
    console.log('-'.repeat(80));
    
    const deleteResponse = await axios.delete(
      `${API_BASE_URL}/api/direct/link-settings/LG/policy`
    );
    
    console.log('✅ 삭제 성공');
    console.log('응답 데이터:', JSON.stringify(deleteResponse.data, null, 2));
    console.log();

    // 3. LG 링크 설정 조회 (삭제 후 확인)
    console.log('📖 3단계: LG 링크 설정 조회 (삭제 후 확인)');
    console.log('-'.repeat(80));
    
    const getResponse2 = await axios.get(`${API_BASE_URL}/api/direct/link-settings`, {
      params: { carrier: 'LG' }
    });
    
    console.log('✅ 조회 성공 (삭제 후)');
    console.log('응답 데이터:', JSON.stringify(getResponse2.data, null, 2));
    console.log();

    // 결과 비교
    console.log('📊 결과 비교');
    console.log('-'.repeat(80));
    console.log('삭제 전 policy 설정:', getResponse1.data.policy);
    console.log('삭제 후 policy 설정:', getResponse2.data.policy);
    
    if (getResponse1.data.policy.link && !getResponse2.data.policy.link) {
      console.log('✅ policy 설정이 정상적으로 삭제되었습니다.');
    } else {
      console.log('⚠️ policy 설정이 삭제되지 않았거나 이미 비어있었습니다.');
    }
    console.log();

    console.log('='.repeat(80));
    console.log('✅ 테스트 완료');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('에러 스택:', error.stack);
    process.exit(1);
  }
}

// 테스트 실행
testLGLinkSettingsDelete();
