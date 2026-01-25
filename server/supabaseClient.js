/**
 * Supabase Client
 * 
 * Supabase 데이터베이스 연결 클라이언트
 * - PostgreSQL 데이터베이스 접근
 * - RESTful API 자동 생성
 * - 실시간 구독 지원
 */

const { createClient } = require('@supabase/supabase-js');

// 환경 변수에서 Supabase 연결 정보 로드
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Supabase 클라이언트 생성
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('✅ Supabase 클라이언트 초기화 완료');
} else {
  console.warn('⚠️ Supabase 환경 변수가 설정되지 않았습니다.');
  console.warn('   SUPABASE_URL과 SUPABASE_KEY를 .env 파일에 추가하세요.');
}

/**
 * Supabase 연결 테스트
 * @returns {Promise<boolean>} 연결 성공 여부
 */
async function testConnection() {
  if (!supabase) {
    console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
    return false;
  }

  try {
    // 간단한 쿼리로 연결 테스트
    // 테이블이 없어도 에러가 발생하지 않도록 처리
    const { error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);
    
    // PGRST116 또는 42P01: 테이블이 없음 (정상 - 아직 테이블을 만들지 않았으므로)
    // 새로운 Supabase는 다른 에러 메시지를 반환할 수 있음
    if (error && !error.message.includes('table') && !error.message.includes('relation')) {
      console.error('❌ Supabase 연결 실패:', error.message);
      return false;
    }
    
    console.log('✅ Supabase 연결 성공!');
    return true;
  } catch (error) {
    console.error('❌ Supabase 연결 테스트 중 오류:', error.message);
    return false;
  }
}

/**
 * 데이터베이스 상태 확인
 * @returns {Promise<Object>} 데이터베이스 상태 정보
 */
async function getStatus() {
  if (!supabase) {
    return {
      connected: false,
      error: 'Supabase client not initialized'
    };
  }

  try {
    const isConnected = await testConnection();
    
    return {
      connected: isConnected,
      url: supabaseUrl,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

module.exports = {
  supabase,
  testConnection,
  getStatus
};
