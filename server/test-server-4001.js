/**
 * 테스트용 서버 (포트 4001)
 * Rate Limit 수정 테스트를 위한 임시 서버
 */

// 환경변수 로드
require('dotenv').config();

// 포트 변경
process.env.PORT = 4001;

console.log('🚀 테스트 서버 시작 (포트 4001)');
console.log('   Rate Limit 수정 테스트용 임시 서버입니다.\n');

// 기존 서버 로직 실행
require('./index.js');
