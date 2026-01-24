/**
 * Google Sheets Client Module
 * 
 * Google Sheets API와 Google Drive API 클라이언트를 초기화하고 제공합니다.
 * 싱글톤 패턴으로 구현되어 애플리케이션 전체에서 동일한 인스턴스를 공유합니다.
 * 
 * @module utils/sheetsClient
 */

const { google } = require('googleapis');

/**
 * Google Sheets 클라이언트를 생성하고 초기화합니다.
 * 
 * 환경 변수 요구사항:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: Google Service Account 이메일
 * - GOOGLE_PRIVATE_KEY: Google Service Account Private Key
 * - SHEET_ID: Google Spreadsheet ID
 * 
 * @returns {Object} Google Sheets 클라이언트 객체
 * @returns {Object} sheets - Google Sheets API v4 클라이언트
 * @returns {Object} drive - Google Drive API v3 클라이언트
 * @returns {Object} auth - JWT 인증 객체
 * @returns {string} SPREADSHEET_ID - 스프레드시트 ID
 * 
 * @throws {Error} 필수 환경 변수가 누락된 경우
 */
function createSheetsClient() {
  // 환경 변수 로드
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;

  // 환경 변수 검증
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error(
      'Missing required environment variable: GOOGLE_SERVICE_ACCOUNT_EMAIL\n' +
      'Please set GOOGLE_SERVICE_ACCOUNT_EMAIL in your .env file'
    );
  }

  if (!GOOGLE_PRIVATE_KEY) {
    throw new Error(
      'Missing required environment variable: GOOGLE_PRIVATE_KEY\n' +
      'Please set GOOGLE_PRIVATE_KEY in your .env file'
    );
  }

  if (!SPREADSHEET_ID) {
    throw new Error(
      'Missing required environment variable: SHEET_ID\n' +
      'Please set SHEET_ID in your .env file'
    );
  }

  // JWT 인증 객체 생성
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // \\n을 실제 줄바꿈 문자로 변환
    key: GOOGLE_PRIVATE_KEY.includes('\\n') 
      ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : GOOGLE_PRIVATE_KEY,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });

  // Google Sheets API 클라이언트 생성 (타임아웃 설정 포함)
  const sheets = google.sheets({
    version: 'v4',
    auth,
    timeout: 60000 // 60초 타임아웃
  });

  // Google Drive API 클라이언트 생성
  const drive = google.drive({
    version: 'v3',
    auth
  });

  console.log('✅ Google Sheets 클라이언트 초기화 완료');
  console.log(`   - Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`   - Service Account: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}`);

  return {
    sheets,
    drive,
    auth,
    SPREADSHEET_ID
  };
}

// 싱글톤 인스턴스 생성 및 export
module.exports = createSheetsClient();
