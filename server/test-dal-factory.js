/**
 * DALFactory 테스트
 */

require('dotenv').config();
const dalFactory = require('./dal/DALFactory');

console.log('='.repeat(80));
console.log('DALFactory 테스트');
console.log('='.repeat(80));
console.log('환경 변수:');
console.log('USE_DB_DIRECT_STORE:', process.env.USE_DB_DIRECT_STORE);
console.log('USE_DB_POLICY:', process.env.USE_DB_POLICY);
console.log('USE_DB_CUSTOMER:', process.env.USE_DB_CUSTOMER);
console.log('='.repeat(80));

// DALFactory 상태 확인
const status = dalFactory.getStatus();
console.log('\nDALFactory 상태:');
console.log('Database 사용 가능:', status.database);
console.log('Google Sheets 사용 가능:', status.googleSheets);
console.log('Feature Flags:', status.featureFlags);

// direct-store 모드 DAL 생성
console.log('\n='.repeat(80));
console.log('direct-store 모드 DAL 생성 테스트');
console.log('='.repeat(80));

try {
  const dal = dalFactory.getDAL('direct-store');
  console.log('✅ DAL 생성 성공');
} catch (error) {
  console.error('❌ DAL 생성 실패:', error.message);
}

console.log('\n='.repeat(80));
console.log('테스트 완료');
console.log('='.repeat(80));
