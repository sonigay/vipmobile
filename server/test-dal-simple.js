/**
 * DirectStoreDAL 간단 테스트
 */

require('dotenv').config();

async function testDAL() {
  console.log('='.repeat(80));
  console.log('DirectStoreDAL 간단 테스트');
  console.log('='.repeat(80));
  
  console.log('\n1. DirectStoreDAL 모듈 로드...');
  const directStoreDAL = require('./dal/DirectStoreDAL');
  console.log('✅ DirectStoreDAL 로드 성공');
  console.log('   타입:', typeof directStoreDAL);
  console.log('   메서드:', Object.getOwnPropertyNames(Object.getPrototypeOf(directStoreDAL)).filter(m => m !== 'constructor'));
  
  console.log('\n2. Supabase 연결 테스트...');
  try {
    const data = await directStoreDAL.getAllDeviceMasters();
    console.log('✅ Supabase 연결 성공');
    console.log(`   조회된 단말 수: ${data.length}개`);
  } catch (error) {
    console.error('❌ Supabase 연결 실패:', error.message);
  }
  
  console.log('\n' + '='.repeat(80));
}

testDAL().catch(console.error);
