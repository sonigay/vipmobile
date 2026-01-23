/**
 * CORS 로깅 시스템 단위 테스트
 * 
 * 요구사항 4.1, 4.4, 4.5 검증
 */

const {
  LogLevel,
  LogCategory,
  logValidationFailure,
  logValidationSuccess,
  logPreflight,
  checkAndLogMissingHeaders,
  logMiddlewareError,
  logConfigUpdate,
  logCache,
  shouldLog,
  createLogEntry,
  outputLog
} = require('../corsLogger');

// 콘솔 출력 모킹
let consoleOutput = [];
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

beforeEach(() => {
  consoleOutput = [];
  
  // 콘솔 함수 모킹
  console.log = jest.fn((...args) => {
    consoleOutput.push({ level: 'log', args });
  });
  console.warn = jest.fn((...args) => {
    consoleOutput.push({ level: 'warn', args });
  });
  console.error = jest.fn((...args) => {
    consoleOutput.push({ level: 'error', args });
  });
});

afterEach(() => {
  // 콘솔 복원
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('CORS 로깅 시스템', () => {
  describe('구조화된 로그 생성', () => {
    test('createLogEntry는 타임스탬프를 포함한 구조화된 로그를 생성해야 함', () => {
      const logEntry = createLogEntry(
        LogLevel.INFO,
        LogCategory.VALIDATION_SUCCESS,
        '테스트 메시지',
        { origin: 'https://example.com' }
      );
      
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.category).toBe(LogCategory.VALIDATION_SUCCESS);
      expect(logEntry.message).toBe('테스트 메시지');
      expect(logEntry.origin).toBe('https://example.com');
      
      // 타임스탬프가 ISO 형식인지 확인
      expect(() => new Date(logEntry.timestamp)).not.toThrow();
    });
  });

  describe('검증 실패 로깅 (요구사항 4.1)', () => {
    test('logValidationFailure는 오리진과 타임스탬프를 로깅해야 함', () => {
      const origin = 'https://malicious.com';
      const reason = 'Origin not in allowed list';
      const additionalData = {
        path: '/api/test',
        method: 'GET'
      };
      
      logValidationFailure(origin, reason, additionalData);
      
      expect(console.warn).toHaveBeenCalled();
      expect(consoleOutput.length).toBeGreaterThan(0);
      
      const logCall = consoleOutput[0];
      expect(logCall.level).toBe('warn');
      expect(logCall.args[0]).toContain('[CORS:VALIDATION_FAILURE]');
      expect(logCall.args[1]).toContain('오리진 검증 실패');
      
      const logData = logCall.args[2];
      expect(logData.origin).toBe(origin);
      expect(logData.reason).toBe(reason);
      expect(logData.path).toBe('/api/test');
      expect(logData.method).toBe('GET');
      // timestamp는 로그 엔트리에 있지만 출력 데이터에서는 제외됨
    });

    test('logValidationFailure는 추가 데이터 없이도 작동해야 함', () => {
      const origin = 'https://test.com';
      const reason = 'Test reason';
      
      logValidationFailure(origin, reason);
      
      expect(console.warn).toHaveBeenCalled();
      const logData = consoleOutput[0].args[2];
      expect(logData.origin).toBe(origin);
      expect(logData.reason).toBe(reason);
    });
  });

  describe('검증 성공 로깅 (요구사항 4.4)', () => {
    test('logValidationSuccess는 디버그 모드에서 성공 정보를 로깅해야 함', () => {
      const origin = 'https://vipmobile.vercel.app';
      const matchedOrigin = 'https://vipmobile.vercel.app';
      const reason = 'Origin matched in allowed list';
      
      logValidationSuccess(origin, matchedOrigin, reason);
      
      expect(console.log).toHaveBeenCalled();
      expect(consoleOutput.length).toBeGreaterThan(0);
      
      const logCall = consoleOutput[0];
      expect(logCall.level).toBe('log');
      expect(logCall.args[0]).toContain('[CORS:VALIDATION_SUCCESS]');
      expect(logCall.args[1]).toContain('오리진 검증 성공');
      
      const logData = logCall.args[2];
      expect(logData.origin).toBe(origin);
      expect(logData.matchedOrigin).toBe(matchedOrigin);
      expect(logData.reason).toBe(reason);
      // timestamp는 로그 엔트리에 있지만 출력 데이터에서는 제외됨
    });
  });

  describe('프리플라이트 로깅', () => {
    test('logPreflight는 REQUEST 타입을 로깅해야 함', () => {
      const data = {
        method: 'OPTIONS',
        url: '/api/test',
        origin: 'https://example.com',
        requestedMethod: 'POST',
        requestedHeaders: 'content-type'
      };
      
      logPreflight('REQUEST', data);
      
      expect(console.log).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      expect(logCall.args[0]).toContain('[CORS:PREFLIGHT]');
      expect(logCall.args[1]).toContain('OPTIONS 프리플라이트 요청 처리');
    });

    test('logPreflight는 SUCCESS 타입을 로깅해야 함', () => {
      const data = { origin: 'https://example.com' };
      
      logPreflight('SUCCESS', data);
      
      expect(console.log).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      expect(logCall.args[1]).toContain('프리플라이트 요청 검증 성공');
    });

    test('logPreflight는 FAILURE 타입을 경고로 로깅해야 함', () => {
      const data = {
        origin: 'https://malicious.com',
        reason: 'Origin not allowed'
      };
      
      logPreflight('FAILURE', data);
      
      expect(console.warn).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      expect(logCall.level).toBe('warn');
      expect(logCall.args[1]).toContain('프리플라이트 요청 검증 실패');
    });
  });

  describe('누락된 CORS 헤더 감지 (요구사항 4.5)', () => {
    test('checkAndLogMissingHeaders는 누락된 헤더를 감지하고 경고해야 함', () => {
      // 모의 응답 객체
      const mockRes = {
        getHeader: jest.fn((header) => {
          if (header === 'Access-Control-Allow-Origin') {
            return 'https://example.com';
          }
          // 다른 헤더는 누락
          return undefined;
        })
      };
      
      const context = {
        path: '/api/test',
        method: 'GET'
      };
      
      const hasMissing = checkAndLogMissingHeaders(mockRes, context);
      
      expect(hasMissing).toBe(true);
      expect(console.warn).toHaveBeenCalled();
      
      const logCall = consoleOutput[0];
      expect(logCall.level).toBe('warn');
      expect(logCall.args[0]).toContain('[CORS:MISSING_HEADERS]');
      expect(logCall.args[1]).toContain('응답에서 CORS 헤더 누락 감지');
      
      const logData = logCall.args[2];
      expect(logData.missingHeaders).toContain('Access-Control-Allow-Methods');
      expect(logData.missingHeaders).toContain('Access-Control-Allow-Headers');
      expect(logData.path).toBe('/api/test');
      expect(logData.method).toBe('GET');
    });

    test('checkAndLogMissingHeaders는 모든 헤더가 있으면 경고하지 않아야 함', () => {
      // 모든 헤더가 있는 모의 응답 객체
      const mockRes = {
        getHeader: jest.fn((header) => {
          const headers = {
            'Access-Control-Allow-Origin': 'https://example.com',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          };
          return headers[header];
        })
      };
      
      const hasMissing = checkAndLogMissingHeaders(mockRes);
      
      expect(hasMissing).toBe(false);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('미들웨어 오류 로깅', () => {
    test('logMiddlewareError는 오류 정보를 로깅해야 함', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      const context = {
        path: '/api/test',
        method: 'POST',
        origin: 'https://example.com'
      };
      
      logMiddlewareError(error, context);
      
      expect(console.error).toHaveBeenCalled();
      
      const logCall = consoleOutput[0];
      expect(logCall.level).toBe('error');
      expect(logCall.args[0]).toContain('[CORS:MIDDLEWARE_ERROR]');
      expect(logCall.args[1]).toContain('미들웨어 오류 발생');
      
      const logData = logCall.args[2];
      expect(logData.error).toBe('Test error');
      expect(logData.stack).toBe('Error stack trace');
      expect(logData.path).toBe('/api/test');
      expect(logData.method).toBe('POST');
      expect(logData.origin).toBe('https://example.com');
    });
  });

  describe('구성 업데이트 로깅', () => {
    test('logConfigUpdate는 성공 시 INFO 레벨로 로깅해야 함', () => {
      const data = {
        updatedFields: ['allowedOrigins', 'debugMode'],
        newConfig: { allowedOrigins: ['https://new.com'], debugMode: true }
      };
      
      logConfigUpdate('SUCCESS', data);
      
      expect(console.log).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      expect(logCall.args[1]).toContain('구성 업데이트 성공');
    });

    test('logConfigUpdate는 실패 시 WARN 레벨로 로깅해야 함', () => {
      const data = {
        errors: ['Invalid origin format'],
        attemptedConfig: { allowedOrigins: ['invalid'] }
      };
      
      logConfigUpdate('FAILURE', data);
      
      expect(console.warn).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      expect(logCall.level).toBe('warn');
      expect(logCall.args[1]).toContain('구성 업데이트 실패');
    });
  });

  describe('캐시 로깅', () => {
    test('logCache는 다양한 캐시 액션을 로깅해야 함', () => {
      const actions = ['HIT', 'MISS', 'SET', 'CLEAR', 'EVICT', 'EXPIRED'];
      
      actions.forEach(action => {
        consoleOutput = [];
        logCache(action, { origin: 'https://example.com' });
        
        expect(console.log).toHaveBeenCalled();
        const logCall = consoleOutput[0];
        expect(logCall.args[0]).toContain('[CORS:CACHE]');
        expect(logCall.args[1]).toContain(`캐시 ${action}`);
      });
    });
  });

  describe('로그 레벨 필터링', () => {
    test('shouldLog는 환경 변수에 따라 로그 레벨을 필터링해야 함', () => {
      // 기본값 (INFO)
      expect(shouldLog(LogLevel.ERROR)).toBe(true);
      expect(shouldLog(LogLevel.WARN)).toBe(true);
      expect(shouldLog(LogLevel.INFO)).toBe(true);
      expect(shouldLog(LogLevel.DEBUG)).toBe(false);
    });

    test('shouldLog는 ERROR 레벨에서 ERROR만 허용해야 함', () => {
      const originalEnv = process.env.CORS_LOG_LEVEL;
      process.env.CORS_LOG_LEVEL = 'ERROR';
      
      expect(shouldLog(LogLevel.ERROR)).toBe(true);
      expect(shouldLog(LogLevel.WARN)).toBe(false);
      expect(shouldLog(LogLevel.INFO)).toBe(false);
      expect(shouldLog(LogLevel.DEBUG)).toBe(false);
      
      process.env.CORS_LOG_LEVEL = originalEnv;
    });

    test('shouldLog는 DEBUG 레벨에서 모든 로그를 허용해야 함', () => {
      const originalEnv = process.env.CORS_LOG_LEVEL;
      process.env.CORS_LOG_LEVEL = 'DEBUG';
      
      expect(shouldLog(LogLevel.ERROR)).toBe(true);
      expect(shouldLog(LogLevel.WARN)).toBe(true);
      expect(shouldLog(LogLevel.INFO)).toBe(true);
      expect(shouldLog(LogLevel.DEBUG)).toBe(true);
      
      process.env.CORS_LOG_LEVEL = originalEnv;
    });
  });

  describe('로그 출력 형식', () => {
    test('outputLog는 적절한 아이콘과 함께 로그를 출력해야 함', () => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.ERROR,
        category: LogCategory.MIDDLEWARE_ERROR,
        message: '테스트 오류',
        detail: '상세 정보'
      };
      
      outputLog(logEntry);
      
      expect(console.error).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      expect(logCall.args[0]).toContain('❌');
      expect(logCall.args[0]).toContain('[CORS:MIDDLEWARE_ERROR]');
      expect(logCall.args[1]).toBe('테스트 오류');
      expect(logCall.args[2]).toHaveProperty('detail', '상세 정보');
    });

    test('outputLog는 데이터가 없으면 메시지만 출력해야 함', () => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        category: LogCategory.CONFIG_UPDATE,
        message: '간단한 메시지'
      };
      
      outputLog(logEntry);
      
      expect(console.log).toHaveBeenCalled();
      const logCall = consoleOutput[0];
      // timestamp는 제외되고 prefix와 message만 출력되어야 함
      expect(logCall.args.length).toBe(2); // prefix와 message
      expect(logCall.args[0]).toContain('[CORS:CONFIG_UPDATE]');
      expect(logCall.args[1]).toBe('간단한 메시지');
    });
  });
});
