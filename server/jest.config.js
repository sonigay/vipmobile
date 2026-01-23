/**
 * Jest 구성 파일
 * CORS 구성 수정 프로젝트를 위한 테스트 환경 설정
 */

module.exports = {
  // 테스트 환경 설정
  testEnvironment: 'node',
  
  // 테스트 파일 패턴
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 테스트 파일 확장자
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/'
  ],
  
  // 커버리지 설정
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 커버리지 대상 파일
  collectCoverageFrom: [
    '*.js',
    '!index.js',
    '!ecosystem.config.js',
    '!jest.config.js',
    '!coverage/**',
    '!node_modules/**',
    '!logs/**'
  ],
  
  // 테스트 설정
  verbose: true,
  
  // 테스트 타임아웃 (30초)
  testTimeout: 30000,
  
  // 테스트 전 설정
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  
  // 모듈 경로 매핑
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // 테스트 실행 전 정리
  clearMocks: true,
  restoreMocks: true
};