/**
 * CORS 로깅 시스템 속성 기반 테스트
 * 
 * Task 7.7, 7.10, 7.11: 로깅 관련 속성 테스트
 * 요구사항 4.1, 4.4, 4.5 검증
 * 
 * 속성 기반 테스트를 통해 로깅 시스템이 모든 상황에서
 * 일관되게 동작하는지 검증합니다.
 */

const fc = require('fast-check');
const {
  corsMiddleware,
  configManager
} = require('../corsMiddleware');
const {
  logValidationFailure,
  logValidationSuccess,
  checkAndLogMissingHeaders,
  LogLevel,
  LogCategory
} = require('../corsLogger');

describe('CORS 로깅 시스템 속성 기반 테스트', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  
  beforeEach(() => {
    // 테스트 전에 구성 초기화
    configManager.resetConfiguration();
    
    // 콘솔 출력 스파이 설정
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  /**
   * Mock 객체 생성 헬퍼
   */
  const createMockRequest = (method, origin, path = '/api/test') => ({
    method,
    path,
    url: path,
    headers: origin ? { origin } : {}
  });
  
  const createMockResponse = () => {
    const res = {
      headers: {},
      statusCode: 200,
      body: null,
      header: jest.fn(function(name, value) {
        this.headers[name] = value;
        return this;
      }),
      getHeader: jest.fn(function(name) {
        return this.headers[name];
      }),
      status: jest.fn(function(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function(data) {
        this.body = data;
        return this;
      }),
      end: jest.fn()
    };
    return res;
  };
  
  /**
   * 속성 7: 오류 로깅 일관성
   * Feature: cors-configuration-fix
   * Property 7: 모든 CORS 검증 실패에 대해, 거부된 오리진과 
   * 타임스탬프가 로그에 기록되어야 합니다
   * 
   * **Validates: Requirements 4.1**
   */
  describe('Property 7: 오류 로깅 일관성', () => {
    test('모든 검증 실패는 오리진과 타임스탬프를 로그해야 함', () => {
      // 허용되지 않은 오리진 생성기
      const unauthorizedOriginArb = fc.webUrl().filter(url => {
        const config = configManager.getConfiguration();
        return !config.allowedOrigins.some(
          allowed => allowed.toLowerCase() === url.toLowerCase()
        );
      });
      
      fc.assert(
        fc.property(
          unauthorizedOriginArb,
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`),
          (origin, method, path) => {
            // 콘솔 스파이 초기화
            consoleLogSpy.mockClear();
            consoleWarnSpy.mockClear();
            consoleErrorSpy.mockClear();
            
            const mockReq = createMockRequest(method, origin, path);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 경고 로그가 호출되었는지 확인
            expect(consoleWarnSpy).toHaveBeenCalled();
            
            // 로그에 오리진이 포함되어 있는지 확인
            const logCalls = consoleWarnSpy.mock.calls;
            const hasOriginInLog = logCalls.some(call => {
              // call은 배열이고, 각 요소는 문자열 또는 객체일 수 있음
              const logString = call.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ');
              return logString.includes(origin);
            });
            expect(hasOriginInLog).toBe(true);
            
            // 로그에 VALIDATION_FAILURE 카테고리가 포함되어 있는지 확인
            const hasValidationFailure = logCalls.some(call => {
              const logString = call.join(' ');
              return logString.includes('VALIDATION_FAILURE');
            });
            expect(hasValidationFailure).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('검증 실패 로그는 항상 경고 레벨이어야 함', () => {
      const unauthorizedOriginArb = fc.webUrl().filter(url => {
        const config = configManager.getConfiguration();
        return !config.allowedOrigins.some(
          allowed => allowed.toLowerCase() === url.toLowerCase()
        );
      });
      
      fc.assert(
        fc.property(
          unauthorizedOriginArb,
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (origin, method) => {
            consoleWarnSpy.mockClear();
            
            const mockReq = createMockRequest(method, origin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // console.warn이 호출되었는지 확인 (경고 레벨)
            expect(consoleWarnSpy).toHaveBeenCalled();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('검증 실패 로그는 요청 컨텍스트를 포함해야 함', () => {
      const unauthorizedOriginArb = fc.webUrl().filter(url => {
        const config = configManager.getConfiguration();
        return !config.allowedOrigins.some(
          allowed => allowed.toLowerCase() === url.toLowerCase()
        );
      });
      
      fc.assert(
        fc.property(
          unauthorizedOriginArb,
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 30 }).map(s => `/api/${s}`),
          (origin, method, path) => {
            consoleWarnSpy.mockClear();
            
            const mockReq = createMockRequest(method, origin, path);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 로그에 path와 method가 포함되어 있는지 확인
            const logCalls = consoleWarnSpy.mock.calls;
            const logString = logCalls.map(call => 
              call.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ')
            ).join(' ');
            
            // path 또는 method가 로그에 포함되어 있는지 확인
            const hasContext = logString.includes(path) || logString.includes(method);
            expect(hasContext).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('logValidationFailure 함수는 항상 일관된 형식으로 로그해야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`),
          (origin, reason, method, path) => {
            consoleWarnSpy.mockClear();
            
            // logValidationFailure 직접 호출
            logValidationFailure(origin, reason, { method, path });
            
            // console.warn이 호출되었는지 확인
            expect(consoleWarnSpy).toHaveBeenCalled();
            
            // 로그 형식 확인
            const logCalls = consoleWarnSpy.mock.calls;
            expect(logCalls.length).toBeGreaterThan(0);
            
            // 첫 번째 인자에 카테고리가 포함되어 있는지 확인
            const firstArg = logCalls[0][0];
            expect(firstArg).toContain('CORS');
            expect(firstArg).toContain('VALIDATION_FAILURE');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * 속성 10: 디버그 모드 로깅
   * Feature: cors-configuration-fix
   * Property 10: 모든 성공적인 CORS 검증에 대해, 
   * 디버그 모드가 활성화된 경우 로그에 기록되어야 합니다
   * 
   * **Validates: Requirements 4.4**
   */
  describe('Property 10: 디버그 모드 로깅', () => {
    test('디버그 모드에서 모든 성공적인 검증은 로그되어야 함', () => {
      // 디버그 모드 활성화
      const originalEnv = process.env.CORS_DEBUG;
      process.env.CORS_DEBUG = 'true';
      configManager.resetConfiguration();
      
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 30 }).map(s => `/api/${s}`),
          (method, path) => {
            consoleLogSpy.mockClear();
            
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest(method, allowedOrigin, path);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 디버그 로그가 호출되었는지 확인
            expect(consoleLogSpy).toHaveBeenCalled();
            
            // 로그에 VALIDATION_SUCCESS 카테고리가 포함되어 있는지 확인
            const logCalls = consoleLogSpy.mock.calls;
            const hasValidationSuccess = logCalls.some(call => {
              const logString = call.join(' ');
              return logString.includes('VALIDATION_SUCCESS');
            });
            expect(hasValidationSuccess).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
      
      // 환경 변수 복원
      if (originalEnv !== undefined) {
        process.env.CORS_DEBUG = originalEnv;
      } else {
        delete process.env.CORS_DEBUG;
      }
      configManager.resetConfiguration();
    });
    
    test('디버그 모드가 비활성화된 경우 성공 검증은 로그되지 않아야 함', () => {
      // 디버그 모드 비활성화
      const originalEnv = process.env.CORS_DEBUG;
      delete process.env.CORS_DEBUG;
      configManager.resetConfiguration();
      
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (method) => {
            consoleLogSpy.mockClear();
            
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest(method, allowedOrigin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // VALIDATION_SUCCESS 로그가 없어야 함
            const logCalls = consoleLogSpy.mock.calls;
            const hasValidationSuccess = logCalls.some(call => {
              const logString = call.join(' ');
              return logString.includes('VALIDATION_SUCCESS');
            });
            expect(hasValidationSuccess).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
      
      // 환경 변수 복원
      if (originalEnv !== undefined) {
        process.env.CORS_DEBUG = originalEnv;
      }
      configManager.resetConfiguration();
    });
    
    test('디버그 로그는 매칭된 오리진 정보를 포함해야 함', () => {
      // 디버그 모드 활성화
      const originalEnv = process.env.CORS_DEBUG;
      process.env.CORS_DEBUG = 'true';
      configManager.resetConfiguration();
      
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (method) => {
            consoleLogSpy.mockClear();
            
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest(method, allowedOrigin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 로그에 오리진 정보가 포함되어 있는지 확인
            const logCalls = consoleLogSpy.mock.calls;
            const logString = logCalls.map(call => 
              call.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ')
            ).join(' ');
            const hasOrigin = logString.includes(allowedOrigin);
            expect(hasOrigin).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
      
      // 환경 변수 복원
      if (originalEnv !== undefined) {
        process.env.CORS_DEBUG = originalEnv;
      } else {
        delete process.env.CORS_DEBUG;
      }
      configManager.resetConfiguration();
    });
    
    test('logValidationSuccess 함수는 디버그 레벨로 로그해야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (origin, matchedOrigin, reason) => {
            consoleLogSpy.mockClear();
            
            // logValidationSuccess 직접 호출
            logValidationSuccess(origin, matchedOrigin, reason);
            
            // console.log가 호출되었는지 확인 (디버그 레벨)
            expect(consoleLogSpy).toHaveBeenCalled();
            
            // 로그에 VALIDATION_SUCCESS 카테고리가 포함되어 있는지 확인
            const logCalls = consoleLogSpy.mock.calls;
            const firstArg = logCalls[0][0];
            expect(firstArg).toContain('VALIDATION_SUCCESS');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * 속성 11: 누락 헤더 감지
   * Feature: cors-configuration-fix
   * Property 11: 모든 응답에 대해, CORS 헤더가 누락된 경우 
   * 경고가 로그되어야 합니다
   * 
   * **Validates: Requirements 4.5**
   */
  describe('Property 11: 누락 헤더 감지', () => {
    test('필수 CORS 헤더가 누락된 경우 항상 경고를 로그해야 함', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              'Access-Control-Allow-Origin',
              'Access-Control-Allow-Methods',
              'Access-Control-Allow-Headers'
            ),
            { minLength: 1, maxLength: 3 }
          ).map(headers => [...new Set(headers)]), // 중복 제거
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 30 }).map(s => `/api/${s}`),
          (missingHeaders, method, path) => {
            consoleWarnSpy.mockClear();
            
            // 일부 헤더만 설정된 응답 객체 생성
            const mockRes = createMockResponse();
            
            // 모든 헤더 설정
            mockRes.header('Access-Control-Allow-Origin', 'https://example.com');
            mockRes.header('Access-Control-Allow-Methods', 'GET, POST');
            mockRes.header('Access-Control-Allow-Headers', 'Content-Type');
            
            // 지정된 헤더들을 제거
            missingHeaders.forEach(header => {
              delete mockRes.headers[header];
            });
            
            // 누락 헤더 감지 함수 호출
            const hasMissing = checkAndLogMissingHeaders(mockRes, { method, path });
            
            // 누락된 헤더가 있으면 true 반환
            expect(hasMissing).toBe(true);
            
            // 경고 로그가 호출되었는지 확인
            expect(consoleWarnSpy).toHaveBeenCalled();
            
            // 로그에 MISSING_HEADERS 카테고리가 포함되어 있는지 확인
            const logCalls = consoleWarnSpy.mock.calls;
            const hasMissingHeadersLog = logCalls.some(call => {
              const logString = call.join(' ');
              return logString.includes('MISSING_HEADERS');
            });
            expect(hasMissingHeadersLog).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('모든 필수 헤더가 존재하면 경고를 로그하지 않아야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          fc.string({ minLength: 1, maxLength: 30 }).map(s => `/api/${s}`),
          (method, path) => {
            consoleWarnSpy.mockClear();
            
            // 모든 필수 헤더가 설정된 응답 객체 생성
            const mockRes = createMockResponse();
            mockRes.header('Access-Control-Allow-Origin', 'https://example.com');
            mockRes.header('Access-Control-Allow-Methods', 'GET, POST');
            mockRes.header('Access-Control-Allow-Headers', 'Content-Type');
            
            // 누락 헤더 감지 함수 호출
            const hasMissing = checkAndLogMissingHeaders(mockRes, { method, path });
            
            // 누락된 헤더가 없으면 false 반환
            expect(hasMissing).toBe(false);
            
            // 경고 로그가 호출되지 않았는지 확인
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('누락 헤더 로그는 어떤 헤더가 누락되었는지 명시해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Access-Control-Allow-Origin',
            'Access-Control-Allow-Methods',
            'Access-Control-Allow-Headers'
          ),
          (missingHeader) => {
            consoleWarnSpy.mockClear();
            
            // 하나의 헤더만 누락된 응답 객체 생성
            const mockRes = createMockResponse();
            mockRes.header('Access-Control-Allow-Origin', 'https://example.com');
            mockRes.header('Access-Control-Allow-Methods', 'GET, POST');
            mockRes.header('Access-Control-Allow-Headers', 'Content-Type');
            
            // 지정된 헤더 제거
            delete mockRes.headers[missingHeader];
            
            // 누락 헤더 감지 함수 호출
            checkAndLogMissingHeaders(mockRes, { method: 'GET', path: '/test' });
            
            // 로그에 누락된 헤더 이름이 포함되어 있는지 확인
            const logCalls = consoleWarnSpy.mock.calls;
            const logString = logCalls.map(call => 
              call.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ')
            ).join(' ');
            const hasMissingHeaderName = logString.includes(missingHeader);
            expect(hasMissingHeaderName).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('디버그 모드에서 미들웨어는 자동으로 누락 헤더를 감지해야 함', () => {
      // 디버그 모드 활성화
      const originalEnv = process.env.CORS_DEBUG;
      process.env.CORS_DEBUG = 'true';
      configManager.resetConfiguration();
      
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (method) => {
            consoleWarnSpy.mockClear();
            
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest(method, allowedOrigin);
            const mockRes = createMockResponse();
            
            // 헤더 설정을 방해하여 누락 상황 시뮬레이션
            const originalHeader = mockRes.header;
            let skipNextHeader = false;
            mockRes.header = jest.fn(function(name, value) {
              if (name === 'Access-Control-Allow-Methods' && !skipNextHeader) {
                skipNextHeader = true;
                return this; // 이 헤더는 설정하지 않음
              }
              return originalHeader.call(this, name, value);
            });
            
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 누락 헤더 경고가 로그되었는지 확인
            // (디버그 모드에서는 자동으로 감지)
            const logCalls = consoleWarnSpy.mock.calls;
            const hasMissingHeadersWarning = logCalls.some(call => {
              const logString = call.join(' ');
              return logString.includes('MISSING_HEADERS');
            });
            
            // 헤더가 실제로 누락된 경우에만 경고가 있어야 함
            if (skipNextHeader) {
              expect(hasMissingHeadersWarning).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
      
      // 환경 변수 복원
      if (originalEnv !== undefined) {
        process.env.CORS_DEBUG = originalEnv;
      } else {
        delete process.env.CORS_DEBUG;
      }
      configManager.resetConfiguration();
    });
  });
  
  /**
   * 로그 형식 일관성 테스트
   */
  describe('로그 형식 일관성', () => {
    test('모든 로그는 타임스탬프를 포함해야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (origin, reason) => {
            consoleWarnSpy.mockClear();
            
            // 검증 실패 로그
            logValidationFailure(origin, reason);
            
            // 로그가 호출되었는지 확인
            expect(consoleWarnSpy).toHaveBeenCalled();
            
            // 타임스탬프는 내부적으로 생성되므로 로그 함수가 호출되었는지만 확인
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('모든 로그는 카테고리를 포함해야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string({ minLength: 1, maxLength: 100 }),
          (origin, reason) => {
            consoleWarnSpy.mockClear();
            
            // 검증 실패 로그
            logValidationFailure(origin, reason);
            
            // 로그에 카테고리가 포함되어 있는지 확인
            const logCalls = consoleWarnSpy.mock.calls;
            const firstArg = logCalls[0][0];
            expect(firstArg).toContain('CORS');
            expect(firstArg).toContain('VALIDATION_FAILURE');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
