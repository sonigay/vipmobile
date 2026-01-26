/**
 * 정책 설정 삭제 API 테스트
 * 
 * 태스크 1.1: 정책 설정 API 보완 - 삭제 메서드 테스트
 * 
 * 테스트 시나리오:
 * 1. LG 통신사의 정책 설정 조회 (삭제 전)
 * 2. 각 정책 삭제 API 호출
 * 3. 정책 설정 조회 (삭제 후) - 데이터가 없어야 함
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const CARRIER = 'LG';

async function testPolicyDelete() {
  console.log('='.repeat(80));
  console.log('정책 설정 삭제 API 테스트 시작');
  console.log('='.repeat(80));
  console.log(`통신사: ${CARRIER}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`USE_DB_DIRECT_STORE: ${process.env.USE_DB_DIRECT_STORE}`);
  console.log('='.repeat(80));

  try {
    // 1. 삭제 전 정책 설정 조회
    console.log('\n📖 1. 삭제 전 정책 설정 조회');
    const beforeResponse = await axios.get(`${API_BASE_URL}/api/direct/policy-settings`, {
      params: { carrier: CARRIER, noCache: true }
    });
    
    console.log('✅ 조회 성공');
    console.log('마진:', beforeResponse.data.margin);
    console.log('부가서비스 개수:', beforeResponse.data.addonServices?.length || 0);
    console.log('보험상품 개수:', beforeResponse.data.insurances?.length || 0);
    console.log('특별정책 개수:', beforeResponse.data.specialPolicies?.length || 0);

    // 2. 마진 삭제
    console.log('\n🗑️ 2. 정책 마진 삭제');
    const deleteMarginResponse = await axios.delete(`${API_BASE_URL}/api/direct/policy-settings/margin/${CARRIER}`);
    console.log('✅ 마진 삭제 성공:', deleteMarginResponse.data);

    // 3. 부가서비스 삭제
    console.log('\n🗑️ 3. 부가서비스 정책 삭제');
    const deleteAddonResponse = await axios.delete(`${API_BASE_URL}/api/direct/policy-settings/addon/${CARRIER}`);
    console.log('✅ 부가서비스 삭제 성공:', deleteAddonResponse.data);

    // 4. 보험상품 삭제
    console.log('\n🗑️ 4. 보험상품 정책 삭제');
    const deleteInsuranceResponse = await axios.delete(`${API_BASE_URL}/api/direct/policy-settings/insurance/${CARRIER}`);
    console.log('✅ 보험상품 삭제 성공:', deleteInsuranceResponse.data);

    // 5. 특별정책 삭제
    console.log('\n🗑️ 5. 특별 정책 삭제');
    const deleteSpecialResponse = await axios.delete(`${API_BASE_URL}/api/direct/policy-settings/special/${CARRIER}`);
    console.log('✅ 특별정책 삭제 성공:', deleteSpecialResponse.data);

    // 6. 삭제 후 정책 설정 조회
    console.log('\n📖 6. 삭제 후 정책 설정 조회');
    const afterResponse = await axios.get(`${API_BASE_URL}/api/direct/policy-settings`, {
      params: { carrier: CARRIER, noCache: true }
    });
    
    console.log('✅ 조회 성공');
    console.log('마진:', afterResponse.data.margin);
    console.log('부가서비스 개수:', afterResponse.data.addonServices?.length || 0);
    console.log('보험상품 개수:', afterResponse.data.insurances?.length || 0);
    console.log('특별정책 개수:', afterResponse.data.specialPolicies?.length || 0);

    // 7. 검증
    console.log('\n✅ 7. 검증 결과');
    const isMarginDeleted = afterResponse.data.margin === null || afterResponse.data.margin === 0;
    const isAddonDeleted = (afterResponse.data.addonServices?.length || 0) === 0;
    const isInsuranceDeleted = (afterResponse.data.insurances?.length || 0) === 0;
    const isSpecialDeleted = (afterResponse.data.specialPolicies?.length || 0) === 0;

    console.log('마진 삭제:', isMarginDeleted ? '✅ 성공' : '❌ 실패');
    console.log('부가서비스 삭제:', isAddonDeleted ? '✅ 성공' : '❌ 실패');
    console.log('보험상품 삭제:', isInsuranceDeleted ? '✅ 성공' : '❌ 실패');
    console.log('특별정책 삭제:', isSpecialDeleted ? '✅ 성공' : '❌ 실패');

    if (isMarginDeleted && isAddonDeleted && isInsuranceDeleted && isSpecialDeleted) {
      console.log('\n🎉 모든 삭제 API 테스트 성공!');
    } else {
      console.log('\n⚠️ 일부 삭제 API 테스트 실패');
    }

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('테스트 완료');
  console.log('='.repeat(80));
}

// 테스트 실행
testPolicyDelete();
