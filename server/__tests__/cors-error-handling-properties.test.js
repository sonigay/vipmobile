/**
 * CORS 오류 처리 시스템 속성 기반 테스트
 * 
 * Task 6.1: 포괄적인 오류 처리 시스템 구축
 * 요구사항 4.2, 4.3 검증
 * 
 * 속성 기반 테스트를 통해 다양한 오류 시나리오에서
 * 시스템이 올바르게 동작하는지 검증합니다.
 */

const fc = require('fast-check');
const {
  corsMiddleware,
  handlePreflightRequest,
  validateRequestedMethod,
  validateRequestedHeaders,
  configManager
} = require('../corsMiddleware');

describe('CORS 오류 처리 속성 기반 테스트', () => {
  beforeEach(() => {
    // 테스트 전에 구성 초기화
    configManager.resetConfiguration();
    
    // 콘솔 출력 억제
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
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
   * 속성 9: 미들웨어 오류 복구
   * Feature: cors-configuration-fix
   * Property 9: 모든 CORS 미들웨어 오류에 대해, 오류가 로그되고 
   * 기본 CORS 헤더로 처리가 계속되어야 합니다
   * 
   * **Validates: Requirements 4.3**
   */
  describe('Property 9: 미들웨어 오류 복구', () => {
    test('모든 오류 상황에서 next()가 호출되어 처리가 계속되어야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (method, path) => {
            // 허용된 오리진 사용 (오리진 검증 실패가 아닌 미들웨어 오류를 테스트)
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest(method, allowedOrigin, path);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 오류를 발생시키는 상황 시뮬레이션
            let firstCall = true;
            const originalHeader = mockRes.header;
            mockRes.header = jest.fn(function(name, value) {
              if (firstCall) {
                firstCall = false;
                throw new Error('Simulated error');
              }
              return originalHeader.call(this, name, value);
            });
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // next()가 호출되어 처리가 계속되는지 확인
            expect(mockNext).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('오류 발생 시에도 기본 CORS 헤더가 설정되어야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (method) => {
            // 허용된 오리진 사용
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest(method, allowedOrigin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 오류 시뮬레이션
            let firstCall = true;
            const originalHeader = mockRes.header;
            mockRes.header = jest.fn(function(name, value) {
              if (firstCall) {
                firstCall = false;
                throw new Error('Error');
              }
              return originalHeader.call(this, name, value);
            });
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 기본 CORS 헤더가 설정되었는지 확인
            const hasOriginHeader = mockRes.headers['Access-Control-Allow-Origin'] !== undefined;
            const hasMethodsHeader = mockRes.headers['Access-Control-Allow-Methods'] !== undefined;
            const hasHeadersHeader = mockRes.headers['Access-Control-Allow-Headers'] !== undefined;
            
            return hasOriginHeader && hasMethodsHeader && hasHeadersHeader;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * 속성 8: 프리플라이트 오류 처리
   * Feature: cors-configuration-fix
   * Property 8: 모든 유효하지 않은 프리플라이트 요청에 대해, 
   * 요청 세부사항이 로그되고 설명적인 오류 메시지가 반환되어야 합니다
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 8: 프리플라이트 오류 처리', () => {
    test('허용되지 않은 오리진의 프리플라이트 요청은 항상 403을 반환해야 함', () => {
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
          (origin, method) => {
            const mockReq = createMockRequest('OPTIONS', origin);
            mockReq.headers['access-control-request-method'] = method;
            const mockRes = createMockResponse();
            
            // 프리플라이트 핸들러 실행
            handlePreflightRequest(mockReq, mockRes);
            
            // 403 상태 코드 확인
            expect(mockRes.statusCode).toBe(403);
            
            // 오류 메시지 확인
            expect(mockRes.body).toBeDefined();
            expect(mockRes.body.error).toBe('Forbidden');
            expect(mockRes.body.message).toContain('Origin not allowed');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('허용되지 않은 메서드의 프리플라이트 요청은 항상 400을 반환해야 함', () => {
      // 허용되지 않은 메서드 생성기
      const invalidMethodArb = fc.constantFrom(
        'TRACE', 'CONNECT', 'INVALID', 'CUSTOM', 'FORBIDDEN'
      );
      
      fc.assert(
        fc.property(
          invalidMethodArb,
          (method) => {
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest('OPTIONS', allowedOrigin);
            mockReq.headers['access-control-request-method'] = method;
            const mockRes = createMockResponse();
            
            // 프리플라이트 핸들러 실행
            handlePreflightRequest(mockReq, mockRes);
            
            // 400 상태 코드 확인
            expect(mockRes.statusCode).toBe(400);
            
            // 오류 메시지 확인
            expect(mockRes.body).toBeDefined();
            expect(mockRes.body.error).toBe('Invalid preflight request');
            expect(mockRes.body.message).toContain('not allowed');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('유효한 프리플라이트 요청은 항상 200을 반환해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'),
          fc.constantFrom('Content-Type', 'Authorization', 'X-Requested-With'),
          (method, header) => {
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest('OPTIONS', allowedOrigin);
            mockReq.headers['access-control-request-method'] = method;
            mockReq.headers['access-control-request-headers'] = header;
            const mockRes = createMockResponse();
            
            // 프리플라이트 핸들러 실행
            handlePreflightRequest(mockReq, mockRes);
            
            // 200 상태 코드 확인
            expect(mockRes.statusCode).toBe(200);
            
            // CORS 헤더 확인
            expect(mockRes.headers['Access-Control-Allow-Origin']).toBeDefined();
            expect(mockRes.headers['Access-Control-Allow-Methods']).toBeDefined();
            expect(mockRes.headers['Access-Control-Allow-Headers']).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * 메서드 검증 속성 테스트
   */
  describe('메서드 검증 속성', () => {
    test('허용된 메서드는 항상 검증을 통과해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'),
          (method) => {
            const result = validateRequestedMethod(method);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('대소문자가 다른 허용된 메서드도 검증을 통과해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('get', 'post', 'put', 'delete', 'options', 'patch'),
          (method) => {
            const result = validateRequestedMethod(method);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * 헤더 검증 속성 테스트
   */
  describe('헤더 검증 속성', () => {
    test('허용된 헤더는 항상 검증을 통과해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin'
          ),
          (header) => {
            const result = validateRequestedHeaders(header);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('여러 허용된 헤더의 조합은 검증을 통과해야 함', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom(
              'Content-Type',
              'Authorization',
              'X-Requested-With'
            ),
            { minLength: 1, maxLength: 3 }
          ),
          (headers) => {
            const headersString = headers.join(', ');
            const result = validateRequestedHeaders(headersString);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('대소문자가 다른 허용된 헤더도 검증을 통과해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'content-type',
            'authorization',
            'x-requested-with'
          ),
          (header) => {
            const result = validateRequestedHeaders(header);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * 403 Forbidden 응답 속성
   */
  describe('403 Forbidden 응답 속성', () => {
    test('허용되지 않은 모든 오리진은 403을 받아야 함', () => {
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
          (origin, method) => {
            const mockReq = createMockRequest(method, origin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 403 상태 코드 확인
            expect(mockRes.statusCode).toBe(403);
            
            // next()가 호출되지 않았는지 확인
            expect(mockNext).not.toHaveBeenCalled();
            
            // 오류 메시지 확인
            expect(mockRes.body).toBeDefined();
            expect(mockRes.body.error).toBe('Forbidden');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * 오류 메시지 명확성 속성
   */
  describe('오류 메시지 명확성 속성', () => {
    test('모든 403 응답은 명확한 오류 메시지를 포함해야 함', () => {
      const unauthorizedOriginArb = fc.webUrl().filter(url => {
        const config = configManager.getConfiguration();
        return !config.allowedOrigins.some(
          allowed => allowed.toLowerCase() === url.toLowerCase()
        );
      });
      
      fc.assert(
        fc.property(
          unauthorizedOriginArb,
          (origin) => {
            const mockReq = createMockRequest('GET', origin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 오류 메시지 구조 확인
            expect(mockRes.body).toHaveProperty('error');
            expect(mockRes.body).toHaveProperty('message');
            expect(mockRes.body).toHaveProperty('origin');
            expect(mockRes.body).toHaveProperty('reason');
            
            // 메시지가 비어있지 않은지 확인
            expect(mockRes.body.message).toBeTruthy();
            expect(mockRes.body.error).toBeTruthy();
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('모든 400 응답은 설명적인 오류 메시지를 포함해야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('TRACE', 'CONNECT', 'INVALID'),
          (method) => {
            const config = configManager.getConfiguration();
            const allowedOrigin = config.allowedOrigins[0];
            
            const mockReq = createMockRequest('OPTIONS', allowedOrigin);
            mockReq.headers['access-control-request-method'] = method;
            const mockRes = createMockResponse();
            
            // 프리플라이트 핸들러 실행
            handlePreflightRequest(mockReq, mockRes);
            
            // 오류 메시지 구조 확인
            expect(mockRes.body).toHaveProperty('error');
            expect(mockRes.body).toHaveProperty('message');
            
            // 메시지가 무엇이 잘못되었는지 설명하는지 확인
            expect(mockRes.body.message).toContain('not allowed');
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
