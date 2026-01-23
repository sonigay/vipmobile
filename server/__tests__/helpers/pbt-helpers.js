/**
 * 속성 기반 테스트 헬퍼 함수들
 * fast-check를 사용한 CORS 테스트를 위한 유틸리티
 */

const fc = require('fast-check');

/**
 * HTTP 메서드 생성기
 */
const httpMethodArbitrary = () => {
  return fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH');
};

/**
 * 유효한 오리진 URL 생성기
 * 허용된 오리진 목록에서만 선택
 */
const validOriginArbitrary = () => {
  return fc.constantFrom(
    // 프로덕션 도메인
    'https://vipmobile.vercel.app',
    // 개발 도메인들
    'http://localhost:3000',
    'http://localhost:3001'
  );
};

/**
 * 유효하지 않은 오리진 생성기
 */
const invalidOriginArbitrary = () => {
  return fc.oneof(
    // 잘못된 스키마
    fc.string().map(s => `ftp://${s}.com`),
    fc.string().map(s => `file://${s}`),
    // 허용되지 않은 도메인
    fc.webUrl({ validSchemes: ['http', 'https'] }).filter(url => 
      !url.includes('vipmobile.vercel.app') && 
      !url.includes('localhost')
    ),
    // 빈 문자열이나 null
    fc.constantFrom('', null, undefined)
  );
};

/**
 * HTTP 헤더 이름 생성기
 */
const httpHeaderNameArbitrary = () => {
  return fc.oneof(
    // 표준 CORS 헤더들
    fc.constantFrom(
      'Content-Type',
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Cache-Control'
    ),
    // 커스텀 헤더들
    fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-zA-Z0-9\-_]+$/.test(s))
      .map(s => `X-${s}`)
  );
};

/**
 * CORS 요청 컨텍스트 생성기
 */
const corsRequestContextArbitrary = () => {
  return fc.record({
    method: httpMethodArbitrary(),
    origin: fc.option(validOriginArbitrary(), { nil: undefined }),
    headers: fc.dictionary(
      httpHeaderNameArbitrary(),
      fc.string({ maxLength: 100 }),
      { maxKeys: 10 }
    ),
    path: fc.string({ minLength: 1, maxLength: 100 }).map(s => `/${s}`),
    isPreflight: fc.boolean()
  });
};

/**
 * 환경 변수 구성 생성기
 */
const corsConfigArbitrary = () => {
  return fc.record({
    CORS_ORIGIN: fc.option(
      fc.array(validOriginArbitrary(), { minLength: 1, maxLength: 5 })
        .map(origins => origins.join(',')),
      { nil: undefined }
    ),
    CORS_CREDENTIALS: fc.option(
      fc.constantFrom('true', 'false'),
      { nil: undefined }
    ),
    NODE_ENV: fc.constantFrom('development', 'production', 'test')
  });
};

/**
 * 대소문자 변형 오리진 생성기
 */
const caseVariantOriginArbitrary = () => {
  const baseOrigins = [
    'https://vipmobile.vercel.app',
    'http://localhost:3000'
  ];
  
  return fc.constantFrom(...baseOrigins).chain(origin => {
    return fc.array(fc.boolean(), { minLength: origin.length, maxLength: origin.length })
      .map(caseFlags => {
        return origin.split('').map((char, index) => 
          caseFlags[index] ? char.toUpperCase() : char.toLowerCase()
        ).join('');
      });
  });
};

/**
 * API 경로 생성기 (/api/direct 하위)
 */
const apiPathArbitrary = () => {
  const knownPaths = [
    '/api/direct/store-image/upload',
    '/api/direct/mobiles-master',
    '/api/direct/policy-settings',
    '/api/direct/store-main-page-texts',
    '/api/direct/transit-location/all',
    '/api/direct/transit-location/list'
  ];
  
  return fc.oneof(
    // 알려진 API 경로들
    fc.constantFrom(...knownPaths),
    // 동적 API 경로들
    fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-zA-Z0-9\-_/]+$/.test(s))
      .map(s => `/api/direct/${s}`)
  );
};

/**
 * 테스트 실행 설정
 */
const PBT_CONFIG = {
  // 각 속성 테스트당 실행 횟수 (최소 100회)
  numRuns: 100,
  // 시드 설정 (재현 가능한 테스트)
  seed: 42,
  // 타임아웃 설정
  timeout: 5000,
  // 실패 시 축소 시도 횟수
  maxSkipsPerRun: 100
};

/**
 * 속성 테스트 실행 헬퍼
 */
const runPropertyTest = (name, property, config = {}) => {
  const testConfig = { ...PBT_CONFIG, ...config };
  
  test(name, () => {
    fc.assert(property, testConfig);
  });
};

module.exports = {
  // 생성기들
  httpMethodArbitrary,
  validOriginArbitrary,
  invalidOriginArbitrary,
  httpHeaderNameArbitrary,
  corsRequestContextArbitrary,
  corsConfigArbitrary,
  caseVariantOriginArbitrary,
  apiPathArbitrary,
  
  // 설정 및 헬퍼
  PBT_CONFIG,
  runPropertyTest,
  
  // fast-check 직접 접근
  fc
};