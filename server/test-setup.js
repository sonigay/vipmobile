/**
 * Jest 테스트 설정 파일
 * 모든 테스트 실행 전에 로드되는 설정
 */

// 환경 변수 설정 (테스트용)
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'https://vipmobile.vercel.app,http://localhost:3000,http://localhost:3001';

// Hybrid Database Migration 테스트를 위한 환경 변수
// 실제 Supabase 연결 정보는 .env.test 파일에서 로드하거나 모킹
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key';

// Google Sheets 테스트 환경 변수
process.env.SHEET_ID = process.env.SHEET_ID || 'test-sheet-id';
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'test@test.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || 'test-private-key';

// Feature Flag 테스트 환경 변수
process.env.USE_DB_DIRECT_STORE = 'false';
process.env.USE_DB_POLICY = 'false';
process.env.USE_DB_CUSTOMER = 'false';

// 콘솔 로그 레벨 설정 (테스트 중 로그 최소화)
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// 테스트 중 불필요한 로그 억제
console.log = (...args) => {
  // 테스트 관련 중요한 로그만 출력
  if (args.some(arg => typeof arg === 'string' && (
    arg.includes('[TEST]') || 
    arg.includes('[ERROR]') || 
    arg.includes('FAIL')
  ))) {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  // 에러는 항상 출력
  originalConsoleError(...args);
};

console.warn = (...args) => {
  // 경고는 테스트 관련만 출력
  if (args.some(arg => typeof arg === 'string' && arg.includes('[TEST]'))) {
    originalConsoleWarn(...args);
  }
};

// 테스트 완료 후 원래 콘솔 복원
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// 전역 테스트 타임아웃 설정
jest.setTimeout(30000);

// Property-Based Testing을 위한 전역 설정
global.PBT_NUM_RUNS = process.env.PBT_NUM_RUNS ? parseInt(process.env.PBT_NUM_RUNS) : 100;
global.PBT_SEED = process.env.PBT_SEED ? parseInt(process.env.PBT_SEED) : undefined;