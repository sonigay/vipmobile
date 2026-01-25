/**
 * Supabase 연결 테스트 스크립트
 * 
 * 사용법:
 *   node testSupabaseConnection.js
 * 
 * 이 스크립트는 Supabase 연결이 올바르게 설정되었는지 확인합니다.
 */

require('dotenv').config();
const { supabase, testConnection, getStatus } = require('./supabaseClient');

async function main() {
  console.log('\n🔍 Supabase 연결 테스트 시작...');
  console.log('━'.repeat(50));
  
  // 1. 환경 변수 확인
  console.log('\n📋 연결 정보:');
  console.log(`  URL: ${process.env.SUPABASE_URL || '❌ 설정되지 않음'}`);
  console.log(`  Key: ${process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 20) + '...' : '❌ 설정되지 않음'}`);
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log('\n❌ 환경 변수가 설정되지 않았습니다!');
    console.log('\n해결 방법:');
    console.log('1. server/.env 파일을 열어주세요');
    console.log('2. 다음 내용을 추가하세요:');
    console.log('   SUPABASE_URL=https://your-project.supabase.co');
    console.log('   SUPABASE_KEY=your-service-role-key');
    console.log('3. Supabase 대시보드 > Settings > API에서 값을 복사하세요');
    process.exit(1);
  }
  
  console.log('\n━'.repeat(50));
  
  // 2. Supabase 클라이언트 확인
  if (!supabase) {
    console.log('\n❌ Supabase 클라이언트 초기화 실패!');
    console.log('환경 변수를 확인하고 다시 시도하세요.');
    process.exit(1);
  }
  
  console.log('\n✅ Supabase 클라이언트 초기화 성공!');
  
  // 3. 연결 테스트
  console.log('\n🔌 데이터베이스 연결 테스트 중...');
  const isConnected = await testConnection();
  
  if (!isConnected) {
    console.log('\n❌ 연결 테스트 실패!');
    console.log('\n해결 방법:');
    console.log('1. Supabase 대시보드에서 프로젝트가 활성화되어 있는지 확인');
    console.log('2. SUPABASE_KEY가 service_role 키인지 확인 (anon 키 아님!)');
    console.log('3. 인터넷 연결 확인');
    console.log('4. 방화벽 설정 확인');
    process.exit(1);
  }
  
  // 4. 상태 정보 확인
  console.log('\n📊 데이터베이스 상태 확인 중...');
  const status = await getStatus();
  
  if (status.connected) {
    console.log('\n✅ 데이터베이스 접근 가능!');
    console.log(`  연결 시간: ${status.timestamp}`);
  }
  
  // 5. 최종 결과
  console.log('\n━'.repeat(50));
  console.log('🎉 모든 테스트 통과! Supabase 사용 준비 완료!');
  console.log('━'.repeat(50));
  console.log('\n다음 단계:');
  console.log('1. 데이터베이스 스키마 생성');
  console.log('2. 마이그레이션 스크립트 실행');
  console.log('3. DAL (Data Access Layer) 구현');
  console.log('\n');
}

// 스크립트 실행
main().catch(error => {
  console.error('\n❌ 테스트 중 오류 발생:', error.message);
  console.error('\n상세 오류:');
  console.error(error);
  process.exit(1);
});
