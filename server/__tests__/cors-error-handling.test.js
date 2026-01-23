/**
 * CORS 오류 처리 시스템 테스트
 * 
 * Task 6.1: 포괄적인 오류 처리 시스템 구축
 * 요구사항 4.2, 4.3 검증
 */

const {
  corsMiddleware,
  handlePreflightRequest,
  setBasicCORSHeaders,
  configManager
} = require('../corsMiddleware');

describe('CORS 오류 처리 시스템', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  
  beforeEach(() => {
    // 테스트 전에 구성 초기화
    configManager.resetConfiguration();
    
    // Mock request 객체
    mockReq = {
      method: 'GET',
      path: '/api/test',
      url: '/api/test',
      headers: {}
    };
    
    // Mock response 객체
    mockRes = {
      headers: {},
      statusCode: 200,
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
    
    // Mock next 함수
    mockNext = jest.fn();
    
    // 콘솔 출력 억제
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('요구사항 4.3: 미들웨어 오류 복구', () => {
    test('CORS 미들웨어에서 오류 발생 시 오류를 로그하고 기본 CORS 헤더로 폴백해야 함', () => {
      // 오류를 발생시키는 상황 시뮬레이션
      // res.header를 오류를 던지도록 수정
      const originalHeader = mockRes.header;
      let callCount = 0;
      mockRes.header = jest.fn(function(name, value) {
        callCount++;
        // 첫 번째 호출에서 오류 발생
        if (callCount === 1) {
          throw new Error('Header setting error');
        }
        // 이후 호출은 정상 동작 (폴백 처리)
        return originalHeader.call(this, name, value);
      });
      
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 오류가 로그되었는지 확인
      expect(console.error).toHaveBeenCalled();
      
      // 기본 CORS 헤더가 설정되었는지 확인 (폴백)
      expect(mockRes.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(mockRes.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(mockRes.headers['Access-Control-Allow-Headers']).toBeDefined();
      
      // next()가 호출되어 처리가 계속되는지 확인
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('오류 발생 시에도 요청 처리가 중단되지 않아야 함', () => {
      // 심각한 오류 시뮬레이션
      mockRes.header = jest.fn(() => {
        throw new Error('Critical error');
      });
      
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // next()가 호출되어 요청 처리가 계속되는지 확인
      expect(mockNext).toHaveBeenCalled();
    });
    
    test('오류 로그에 요청 컨텍스트 정보가 포함되어야 함', () => {
      // setBasicCORSHeaders 내부에서 오류가 발생하도록 설정
      // res.header의 첫 번째 호출에서 오류 발생
      let callCount = 0;
      const originalHeader = mockRes.header;
      mockRes.header = jest.fn(function(name, value) {
        callCount++;
        // 첫 번째 호출에서 오류 발생 (setBasicCORSHeaders 내부)
        if (callCount === 1) {
          throw new Error('Test error in setBasicCORSHeaders');
        }
        // 이후 호출은 정상 동작 (폴백 처리)
        return originalHeader.call(this, name, value);
      });
      
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      mockReq.path = '/api/test/endpoint';
      mockReq.method = 'POST';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 오류 로그가 호출되었는지 확인
      // outputLog는 console.error를 사용하므로 console.error가 호출되어야 함
      expect(console.error).toHaveBeenCalled();
      
      // 로그에 컨텍스트 정보가 포함되었는지 확인
      const errorCalls = console.error.mock.calls;
      const logString = JSON.stringify(errorCalls);
      
      // 경로와 메서드가 로그에 포함되어 있는지 확인
      expect(logString).toContain('endpoint');
      expect(logString).toContain('POST');
    });
  });
  
  describe('요구사항 4.2: 프리플라이트 오류 처리', () => {
    test('허용되지 않은 오리진의 프리플라이트 요청은 403으로 거부되어야 함', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.origin = 'https://malicious.example.com';
      mockReq.headers['access-control-request-method'] = 'POST';
      
      // 프리플라이트 핸들러 실행
      handlePreflightRequest(mockReq, mockRes);
      
      // 403 상태 코드 확인
      expect(mockRes.status).toHaveBeenCalledWith(403);
      
      // 오류 메시지 확인
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error).toBe('Forbidden');
      expect(errorResponse.message).toContain('Origin not allowed');
      expect(errorResponse.origin).toBe('https://malicious.example.com');
    });
    
    test('허용되지 않은 메서드의 프리플라이트 요청은 400으로 거부되어야 함', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      mockReq.headers['access-control-request-method'] = 'TRACE'; // 허용되지 않은 메서드
      
      // 프리플라이트 핸들러 실행
      handlePreflightRequest(mockReq, mockRes);
      
      // 400 상태 코드 확인
      expect(mockRes.status).toHaveBeenCalledWith(400);
      
      // 오류 메시지 확인
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error).toBe('Invalid preflight request');
      expect(errorResponse.message).toContain('Method TRACE is not allowed');
      expect(errorResponse.allowedMethods).toBeDefined();
    });
    
    test('허용되지 않은 헤더의 프리플라이트 요청은 400으로 거부되어야 함', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      mockReq.headers['access-control-request-method'] = 'POST';
      mockReq.headers['access-control-request-headers'] = 'X-Custom-Forbidden-Header';
      
      // 프리플라이트 핸들러 실행
      handlePreflightRequest(mockReq, mockRes);
      
      // 400 상태 코드 확인
      expect(mockRes.status).toHaveBeenCalledWith(400);
      
      // 오류 메시지 확인
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error).toBe('Invalid preflight request');
      expect(errorResponse.message).toContain('requested headers are not allowed');
    });
    
    test('프리플라이트 오류 시 요청 세부사항이 로그되어야 함', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.origin = 'https://malicious.example.com';
      mockReq.headers['access-control-request-method'] = 'POST';
      mockReq.headers['access-control-request-headers'] = 'Content-Type';
      
      // 프리플라이트 핸들러 실행
      handlePreflightRequest(mockReq, mockRes);
      
      // 로그가 호출되었는지 확인
      expect(console.log).toHaveBeenCalled();
      
      // 로그에 요청 세부사항이 포함되었는지 확인
      const logs = console.log.mock.calls.map(call => JSON.stringify(call));
      const combinedLogs = logs.join(' ');
      expect(combinedLogs).toContain('malicious.example.com');
    });
    
    test('유효한 프리플라이트 요청은 200으로 응답해야 함', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      mockReq.headers['access-control-request-method'] = 'POST';
      mockReq.headers['access-control-request-headers'] = 'Content-Type, Authorization';
      
      // 프리플라이트 핸들러 실행
      handlePreflightRequest(mockReq, mockRes);
      
      // 200 상태 코드 확인
      expect(mockRes.status).toHaveBeenCalledWith(200);
      
      // CORS 헤더가 설정되었는지 확인
      expect(mockRes.headers['Access-Control-Allow-Origin']).toBe('https://vipmobile.vercel.app');
      expect(mockRes.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(mockRes.headers['Access-Control-Allow-Headers']).toBeDefined();
      
      // 응답 종료 확인
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
  
  describe('403 Forbidden 응답 처리', () => {
    test('허용되지 않은 오리진의 일반 요청은 403으로 거부되어야 함', () => {
      mockReq.method = 'GET';
      mockReq.headers.origin = 'https://unauthorized.example.com';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 403 상태 코드 확인
      expect(mockRes.status).toHaveBeenCalledWith(403);
      
      // 오류 메시지 확인
      expect(mockRes.json).toHaveBeenCalled();
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.error).toBe('Forbidden');
      expect(errorResponse.message).toContain('Origin not allowed');
      
      // next()가 호출되지 않았는지 확인 (요청 차단)
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('403 응답에 거부 이유가 포함되어야 함', () => {
      mockReq.method = 'POST';
      mockReq.headers.origin = 'https://blocked.example.com';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 응답 본문 확인
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.reason).toBeDefined();
      expect(errorResponse.origin).toBe('https://blocked.example.com');
    });
  });
  
  describe('기본 CORS 헤더 폴백', () => {
    test('오류 발생 시 최소한의 CORS 헤더가 설정되어야 함', () => {
      // 오류를 발생시키는 상황
      const originalHeader = mockRes.header;
      let firstCall = true;
      mockRes.header = jest.fn(function(name, value) {
        if (firstCall) {
          firstCall = false;
          throw new Error('Initial error');
        }
        return originalHeader.call(this, name, value);
      });
      
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 폴백 헤더 확인
      expect(mockRes.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(mockRes.headers['Access-Control-Allow-Methods']).toBeDefined();
      expect(mockRes.headers['Access-Control-Allow-Headers']).toBeDefined();
      expect(mockRes.headers['Access-Control-Allow-Credentials']).toBeDefined();
    });
    
    test('폴백 헤더는 구성 관리자의 기본값을 사용해야 함', () => {
      // 오류 발생 시뮬레이션
      const originalHeader = mockRes.header;
      let firstCall = true;
      mockRes.header = jest.fn(function(name, value) {
        if (firstCall) {
          firstCall = false;
          throw new Error('Error');
        }
        return originalHeader.call(this, name, value);
      });
      
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 기본 구성 가져오기
      const config = configManager.getConfiguration();
      
      // 폴백 헤더가 기본 구성과 일치하는지 확인
      expect(mockRes.headers['Access-Control-Allow-Origin']).toBe(config.allowedOrigins[0]);
      expect(mockRes.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(mockRes.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    });
  });
  
  describe('설명적인 오류 메시지', () => {
    test('403 오류 메시지는 사용자가 이해하기 쉬워야 함', () => {
      mockReq.headers.origin = 'https://unknown.example.com';
      
      // 미들웨어 실행
      corsMiddleware(mockReq, mockRes, mockNext);
      
      // 오류 메시지 확인
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.message).toBe('Origin not allowed');
      expect(errorResponse.error).toBe('Forbidden');
    });
    
    test('400 오류 메시지는 무엇이 잘못되었는지 명확히 설명해야 함', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.origin = 'https://vipmobile.vercel.app';
      mockReq.headers['access-control-request-method'] = 'INVALID_METHOD';
      
      // 프리플라이트 핸들러 실행
      handlePreflightRequest(mockReq, mockRes);
      
      // 오류 메시지 확인
      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.message).toContain('Method INVALID_METHOD is not allowed');
      expect(errorResponse.allowedMethods).toBeDefined();
    });
  });
});
