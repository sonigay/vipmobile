/**
 * Jest 테스트 설정 파일
 * 모든 테스트 실행 전에 로드되는 설정
 */

// 환경 변수 설정 (테스트용)
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'https://vipmobile.vercel.app,http://localhost:3000,http://localhost:3001';

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