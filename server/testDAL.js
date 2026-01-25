/**
 * DAL 테스트 스크립트
 * 
 * DAL (Data Access Layer)이 제대로 작동하는지 확인합니다.
 */

require('dotenv').config();
const dalFactory = require('./dal/DALFactory');

async function main() {
  console.log('\n🔍 DAL 테스트 시작...');
  console.log('━'.repeat(50));

  // 1. DALFactory 상태 확인
  console.log('\n📊 DALFactory 상태:');
  const status = dalFactory.getStatus();
  console.log('  Database 구현체:', status.database ? '✅ 초기화됨' : '❌ 초기화 실패');
  console.log('  Google Sheets 구현체:', status.googleSheets ? '✅ 초기화됨' : '❌ 초기화 실패');
  console.log('  Feature Flags:', JSON.stringify(status.featureFlags, null, 2));

  // 2. Feature Flag 테스트
  console.log('\n🚩 Feature Flag 테스트:');
  const featureFlags = dalFactory.getFeatureFlags();
  
  console.log('  direct-store 모드:', featureFlags.isEnabled('direct-store') ? '✅ Database 사용' : '⚠️ Google Sheets 사용');
  console.log('  policy 모드:', featureFlags.isEnabled('policy') ? '✅ Database 사용' : '⚠️ Google Sheets 사용');
  console.log('  customer 모드:', featureFlags.isEnabled('customer') ? '✅ Database 사용' : '⚠️ Google Sheets 사용');

  // 3. DAL 인스턴스 생성 테스트
  console.log('\n🏗️ DAL 인스턴스 생성 테스트:');
  
  try {
    const directStoreDAL = dalFactory.getDAL('direct-store');
    console.log('  ✅ direct-store DAL 생성 성공');
    console.log('     구현체 타입:', directStoreDAL.getImplementationType());
  } catch (error) {
    console.log('  ❌ direct-store DAL 생성 실패:', error.message);
  }

  try {
    const policyDAL = dalFactory.getDAL('policy');
    console.log('  ✅ policy DAL 생성 성공');
    console.log('     구현체 타입:', policyDAL.getImplementationType());
  } catch (error) {
    console.log('  ❌ policy DAL 생성 실패:', error.message);
  }

  // 4. Feature Flag 동적 변경 테스트
  console.log('\n🔄 Feature Flag 동적 변경 테스트:');
  
  console.log('  direct-store 모드 활성화 시도...');
  featureFlags.enable('direct-store');
  console.log('  현재 상태:', featureFlags.isEnabled('direct-store') ? '✅ 활성화됨' : '❌ 비활성화됨');
  
  console.log('  direct-store 모드 비활성화 시도...');
  featureFlags.disable('direct-store');
  console.log('  현재 상태:', featureFlags.isEnabled('direct-store') ? '✅ 활성화됨' : '❌ 비활성화됨');

  // 5. 환경 변수 재로드 테스트
  console.log('\n🔃 환경 변수 재로드 테스트:');
  featureFlags.reload();
  console.log('  ✅ 환경 변수에서 플래그 재로드 완료');
  console.log('  현재 플래그:', JSON.stringify(featureFlags.getAllFlags(), null, 2));

  // 최종 결과
  console.log('\n━'.repeat(50));
  console.log('🎉 DAL 테스트 완료!');
  console.log('━'.repeat(50));
  console.log('\n다음 단계:');
  console.log('1. 데이터베이스 스키마 정의');
  console.log('2. 마이그레이션 스크립트 작성');
  console.log('3. API 엔드포인트 업데이트');
  console.log('\n');
}

// 스크립트 실행
main().catch(error => {
  console.error('\n❌ 테스트 중 오류 발생:', error.message);
  console.error('\n상세 오류:');
  console.error(error);
  process.exit(1);
});
