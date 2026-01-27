/**
 * Google Sheets 인증 테스트
 * 
 * 환경변수가 올바르게 설정되었는지 확인
 */

require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

log('='.repeat(60), 'blue');
log('Google Sheets 인증 환경변수 검증', 'blue');
log('='.repeat(60), 'blue');

// 1. 환경변수 존재 여부 확인
log('\n1. 환경변수 존재 여부 확인', 'yellow');

const requiredVars = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'SHEET_ID'
];

let allPresent = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    log(`✅ ${varName}: 설정됨`, 'green');
    
    // 값의 일부만 표시 (보안)
    if (varName === 'GOOGLE_SERVICE_ACCOUNT_EMAIL') {
      log(`   값: ${value}`, 'yellow');
    } else if (varName === 'SHEET_ID') {
      log(`   값: ${value}`, 'yellow');
    } else if (varName === 'GOOGLE_PRIVATE_KEY') {
      const preview = value.substring(0, 50) + '...';
      log(`   값 (일부): ${preview}`, 'yellow');
      log(`   길이: ${value.length} 문자`, 'yellow');
      
      // Private Key 형식 검증
      if (value.includes('BEGIN PRIVATE KEY')) {
        log(`   ✅ Private Key 형식 확인됨`, 'green');
      } else {
        log(`   ❌ Private Key 형식이 올바르지 않습니다`, 'red');
        allPresent = false;
      }
      
      // 줄바꿈 문자 확인
      if (value.includes('\\n')) {
        log(`   ⚠️  이스케이프된 줄바꿈(\\n) 발견 - 자동 변환됨`, 'yellow');
      } else if (value.includes('\n')) {
        log(`   ✅ 실제 줄바꿈 문자 사용 중`, 'green');
      }
    }
  } else {
    log(`❌ ${varName}: 설정되지 않음`, 'red');
    allPresent = false;
  }
});

if (!allPresent) {
  log('\n❌ 일부 환경변수가 누락되었습니다!', 'red');
  log('Cloudtype 환경변수 설정을 확인하세요.', 'yellow');
  process.exit(1);
}

// 2. Google Sheets 클라이언트 초기화 테스트
log('\n2. Google Sheets 클라이언트 초기화 테스트', 'yellow');

try {
  const { google } = require('googleapis');
  
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;
  
  // Private Key 변환
  const privateKey = GOOGLE_PRIVATE_KEY.includes('\\n') 
    ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : GOOGLE_PRIVATE_KEY;
  
  log('Private Key 변환 완료', 'green');
  
  // JWT 인증 객체 생성
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
  
  log('JWT 인증 객체 생성 완료', 'green');
  
  // Google Sheets API 클라이언트 생성
  const sheets = google.sheets({
    version: 'v4',
    auth,
    timeout: 60000
  });
  
  log('Google Sheets 클라이언트 생성 완료', 'green');
  
  // 3. 실제 API 호출 테스트
  log('\n3. 실제 API 호출 테스트', 'yellow');
  log('스프레드시트 메타데이터 조회 중...', 'yellow');
  
  sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'properties.title,sheets.properties.title'
  }).then(response => {
    log('✅ API 호출 성공!', 'green');
    log(`스프레드시트 제목: ${response.data.properties.title}`, 'yellow');
    log(`시트 개수: ${response.data.sheets.length}개`, 'yellow');
    
    log('\n시트 목록:', 'yellow');
    response.data.sheets.forEach((sheet, index) => {
      log(`  ${index + 1}. ${sheet.properties.title}`, 'yellow');
    });
    
    log('\n' + '='.repeat(60), 'blue');
    log('🎉 모든 테스트 통과! Google Sheets 인증이 정상입니다.', 'green');
    log('='.repeat(60), 'blue');
  }).catch(error => {
    log('❌ API 호출 실패!', 'red');
    log(`에러 코드: ${error.code}`, 'red');
    log(`에러 메시지: ${error.message}`, 'red');
    
    if (error.code === 403) {
      log('\n⚠️  403 Forbidden 에러 원인:', 'yellow');
      log('1. Service Account에 스프레드시트 공유 권한이 없음', 'yellow');
      log('2. Google Sheets API가 활성화되지 않음', 'yellow');
      log('3. Private Key가 올바르지 않음', 'yellow');
      log('\n해결 방법:', 'yellow');
      log('1. Google Sheets에서 Service Account 이메일에 편집 권한 부여', 'yellow');
      log(`   이메일: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}`, 'yellow');
      log('2. Google Cloud Console에서 Sheets API 활성화 확인', 'yellow');
    } else if (error.code === 404) {
      log('\n⚠️  404 Not Found 에러 원인:', 'yellow');
      log('SHEET_ID가 올바르지 않거나 스프레드시트가 삭제됨', 'yellow');
      log(`현재 SHEET_ID: ${SPREADSHEET_ID}`, 'yellow');
    }
    
    log('\n' + '='.repeat(60), 'blue');
    process.exit(1);
  });
  
} catch (error) {
  log('❌ 클라이언트 초기화 실패!', 'red');
  log(`에러: ${error.message}`, 'red');
  log(`스택: ${error.stack}`, 'red');
  
  log('\n' + '='.repeat(60), 'blue');
  process.exit(1);
}
