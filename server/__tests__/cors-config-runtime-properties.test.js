/**
 * CORS 런타임 구성 업데이트 속성 기반 테스트
 * 
 * Task 7.12: 런타임 구성 업데이트 속성 테스트
 * 요구사항 5.5 검증
 * 
 * 속성 기반 테스트를 통해 런타임 구성 업데이트가
 * 재시작 없이 올바르게 적용되는지 검증합니다.
 */

const fc = require('fast-check');
const {
  corsMiddleware,
  updateCORSConfiguration,
  getCORSConfiguration,
  configManager
} = require('../corsMiddleware');

describe('CORS 런타임 구성 업데이트 속성 기반 테스트', () => {
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
   * 속성 12: 런타임 구성 업데이트
   * Feature: cors-configuration-fix
   * Property 12: 모든 구성 변경에 대해, 새 설정이 재시작 없이 적용되어야 합니다
   * 
   * **Validates: Requirements 5.5**
   */
  describe('Property 12: 런타임 구성 업데이트', () => {
    test('새로운 오리진 추가는 즉시 적용되어야 함', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (newOrigins, method) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            const initialOrigins = initialConfig.allowedOrigins;
            
            // 새로운 오리진 추가
            const updatedOrigins = [...initialOrigins, ...newOrigins];
            const updateResult = updateCORSConfiguration({
              allowedOrigins: updatedOrigins
            });
            
            // 업데이트 성공 확인
            expect(updateResult.success).toBe(true);
            
            // 새 구성 가져오기
            const newConfig = getCORSConfiguration();
            
            // 새로운 오리진이 포함되어 있는지 확인
            newOrigins.forEach(origin => {
              expect(newConfig.allowedOrigins).toContain(origin);
            });
            
            // 새로운 오리진으로 요청 테스트
            const testOrigin = newOrigins[0];
            const mockReq = createMockRequest(method, testOrigin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 새로운 오리진이 허용되는지 확인
            expect(mockRes.statusCode).not.toBe(403);
            expect(mockRes.headers['Access-Control-Allow-Origin']).toBe(testOrigin);
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
    
    test('허용된 메서드 변경은 즉시 적용되어야 함', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'),
            { minLength: 1, maxLength: 6 }
          ).map(methods => [...new Set(methods)]), // 중복 제거
          (newMethods) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            const allowedOrigin = initialConfig.allowedOrigins[0];
            
            // 메서드 업데이트
            const updateResult = updateCORSConfiguration({
              allowedMethods: newMethods
            });
            
            // 업데이트 성공 확인
            expect(updateResult.success).toBe(true);
            
            // 새 구성 가져오기
            const newConfig = getCORSConfiguration();
            
            // 새로운 메서드가 포함되어 있는지 확인
            expect(newConfig.allowedMethods).toEqual(newMethods);
            
            // 프리플라이트 요청으로 테스트
            const testMethod = newMethods[0];
            const mockReq = createMockRequest('OPTIONS', allowedOrigin);
            mockReq.headers['access-control-request-method'] = testMethod;
            const mockRes = createMockResponse();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes);
            
            // 새로운 메서드가 허용되는지 확인
            expect(mockRes.statusCode).toBe(200);
            expect(mockRes.headers['Access-Control-Allow-Methods']).toContain(testMethod);
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
    
    test('자격 증명 설정 변경은 즉시 적용되어야 함', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (newCredentialsSetting, method) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            const allowedOrigin = initialConfig.allowedOrigins[0];
            
            // 자격 증명 설정 업데이트
            const updateResult = updateCORSConfiguration({
              allowCredentials: newCredentialsSetting
            });
            
            // 업데이트 성공 확인
            expect(updateResult.success).toBe(true);
            
            // 새 구성 가져오기
            const newConfig = getCORSConfiguration();
            expect(newConfig.allowCredentials).toBe(newCredentialsSetting);
            
            // 요청으로 테스트
            const mockReq = createMockRequest(method, allowedOrigin);
            const mockRes = createMockResponse();
            const mockNext = jest.fn();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes, mockNext);
            
            // 자격 증명 헤더가 올바르게 설정되었는지 확인
            expect(mockRes.headers['Access-Control-Allow-Credentials']).toBe(
              newCredentialsSetting.toString()
            );
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('Max-Age 설정 변경은 즉시 적용되어야 함', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 86400 * 7 }), // 0 ~ 7일
          (newMaxAge) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            const allowedOrigin = initialConfig.allowedOrigins[0];
            
            // Max-Age 업데이트
            const updateResult = updateCORSConfiguration({
              maxAge: newMaxAge
            });
            
            // 업데이트 성공 확인
            expect(updateResult.success).toBe(true);
            
            // 새 구성 가져오기
            const newConfig = getCORSConfiguration();
            expect(newConfig.maxAge).toBe(newMaxAge);
            
            // 프리플라이트 요청으로 테스트
            const mockReq = createMockRequest('OPTIONS', allowedOrigin);
            mockReq.headers['access-control-request-method'] = 'GET';
            const mockRes = createMockResponse();
            
            // 미들웨어 실행
            corsMiddleware(mockReq, mockRes);
            
            // Max-Age 헤더가 올바르게 설정되었는지 확인
            expect(mockRes.headers['Access-Control-Max-Age']).toBe(newMaxAge.toString());
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('부분 구성 업데이트는 다른 설정을 유지해야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (newOrigin) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            const initialMethods = [...initialConfig.allowedMethods];
            const initialHeaders = [...initialConfig.allowedHeaders];
            const initialCredentials = initialConfig.allowCredentials;
            const initialMaxAge = initialConfig.maxAge;
            
            // 오리진만 업데이트
            const updateResult = updateCORSConfiguration({
              allowedOrigins: [newOrigin]
            });
            
            // 업데이트 성공 확인
            expect(updateResult.success).toBe(true);
            
            // 새 구성 가져오기
            const newConfig = getCORSConfiguration();
            
            // 오리진은 변경되었지만 다른 설정은 유지되어야 함
            expect(newConfig.allowedOrigins).toContain(newOrigin);
            expect(newConfig.allowedMethods).toEqual(initialMethods);
            expect(newConfig.allowedHeaders).toEqual(initialHeaders);
            expect(newConfig.allowCredentials).toBe(initialCredentials);
            expect(newConfig.maxAge).toBe(initialMaxAge);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('유효하지 않은 구성 업데이트는 거부되어야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { allowedOrigins: [] }, // 빈 오리진 배열
            { allowedOrigins: ['invalid-url'] }, // 유효하지 않은 URL
            { allowedMethods: [] }, // 빈 메서드 배열
            { allowedHeaders: [] }, // 빈 헤더 배열
            { allowCredentials: 'not-a-boolean' }, // 잘못된 타입
            { maxAge: -1 } // 음수 값
          ),
          (invalidConfig) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            
            // 유효하지 않은 구성으로 업데이트 시도
            const updateResult = updateCORSConfiguration(invalidConfig);
            
            // 업데이트 실패 확인
            expect(updateResult.success).toBe(false);
            expect(updateResult.errors).toBeDefined();
            expect(updateResult.errors.length).toBeGreaterThan(0);
            
            // 구성이 변경되지 않았는지 확인
            const currentConfig = getCORSConfiguration();
            expect(currentConfig.allowedOrigins).toEqual(initialConfig.allowedOrigins);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('여러 설정을 동시에 업데이트할 수 있어야 함', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 3 }),
          fc.array(
            fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            { minLength: 1, maxLength: 4 }
          ).map(methods => [...new Set(methods)]),
          fc.boolean(),
          fc.integer({ min: 3600, max: 86400 }),
          (newOrigins, newMethods, newCredentials, newMaxAge) => {
            // 여러 설정을 동시에 업데이트
            const updateResult = updateCORSConfiguration({
              allowedOrigins: newOrigins,
              allowedMethods: newMethods,
              allowCredentials: newCredentials,
              maxAge: newMaxAge
            });
            
            // 업데이트 성공 확인
            expect(updateResult.success).toBe(true);
            
            // 새 구성 가져오기
            const newConfig = getCORSConfiguration();
            
            // 모든 설정이 올바르게 업데이트되었는지 확인
            expect(newConfig.allowedOrigins).toEqual(newOrigins);
            expect(newConfig.allowedMethods).toEqual(newMethods);
            expect(newConfig.allowCredentials).toBe(newCredentials);
            expect(newConfig.maxAge).toBe(newMaxAge);
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
    
    test('구성 업데이트 후 즉시 미들웨어에 반영되어야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (newOrigin, method) => {
            // 초기에는 허용되지 않은 오리진
            const mockReq1 = createMockRequest(method, newOrigin);
            const mockRes1 = createMockResponse();
            const mockNext1 = jest.fn();
            
            // 미들웨어 실행 (거부되어야 함)
            corsMiddleware(mockReq1, mockRes1, mockNext1);
            const initialStatus = mockRes1.statusCode;
            
            // 새 오리진 추가
            const currentConfig = getCORSConfiguration();
            updateCORSConfiguration({
              allowedOrigins: [...currentConfig.allowedOrigins, newOrigin]
            });
            
            // 동일한 오리진으로 다시 요청
            const mockReq2 = createMockRequest(method, newOrigin);
            const mockRes2 = createMockResponse();
            const mockNext2 = jest.fn();
            
            // 미들웨어 실행 (허용되어야 함)
            corsMiddleware(mockReq2, mockRes2, mockNext2);
            const newStatus = mockRes2.statusCode;
            
            // 초기에는 거부되었지만 업데이트 후에는 허용되어야 함
            if (initialStatus === 403) {
              expect(newStatus).not.toBe(403);
              expect(mockRes2.headers['Access-Control-Allow-Origin']).toBe(newOrigin);
            }
            
            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
    
    test('구성 업데이트는 로그되어야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (newOrigin) => {
            consoleLogSpy.mockClear();
            
            // 구성 업데이트
            const currentConfig = getCORSConfiguration();
            updateCORSConfiguration({
              allowedOrigins: [...currentConfig.allowedOrigins, newOrigin]
            });
            
            // 로그가 호출되었는지 확인
            expect(consoleLogSpy).toHaveBeenCalled();
            
            // 로그에 CONFIG_UPDATE 카테고리가 포함되어 있는지 확인
            const logCalls = consoleLogSpy.mock.calls;
            const hasConfigUpdate = logCalls.some(call => {
              const logString = call.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ');
              return logString.includes('CONFIG_UPDATE');
            });
            expect(hasConfigUpdate).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('실패한 구성 업데이트도 로그되어야 함', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { allowedOrigins: [] },
            { allowedMethods: [] },
            { maxAge: -1 }
          ),
          (invalidConfig) => {
            consoleWarnSpy.mockClear();
            consoleLogSpy.mockClear();
            
            // 유효하지 않은 구성으로 업데이트 시도
            updateCORSConfiguration(invalidConfig);
            
            // 경고 또는 로그가 호출되었는지 확인
            const hasLog = consoleWarnSpy.mock.calls.length > 0 || 
                          consoleLogSpy.mock.calls.length > 0;
            expect(hasLog).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * 구성 불변성 테스트
   */
  describe('구성 불변성', () => {
    test('getCORSConfiguration은 깊은 복사본을 반환해야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (newOrigin) => {
            // 구성 가져오기
            const config1 = getCORSConfiguration();
            
            // 반환된 객체 수정
            config1.allowedOrigins.push(newOrigin);
            
            // 다시 구성 가져오기
            const config2 = getCORSConfiguration();
            
            // 원본 구성이 변경되지 않았는지 확인
            expect(config2.allowedOrigins).not.toContain(newOrigin);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('updateCORSConfiguration은 원본 객체를 수정하지 않아야 함', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (newOrigin) => {
            // 초기 구성 가져오기
            const initialConfig = getCORSConfiguration();
            const initialOrigins = [...initialConfig.allowedOrigins];
            
            // 새 구성 객체 생성
            const newConfig = {
              allowedOrigins: [...initialOrigins, newOrigin]
            };
            
            // 구성 업데이트
            updateCORSConfiguration(newConfig);
            
            // 전달한 객체가 수정되지 않았는지 확인
            expect(newConfig.allowedOrigins).toEqual([...initialOrigins, newOrigin]);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
