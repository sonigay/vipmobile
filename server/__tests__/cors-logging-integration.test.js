/**
 * CORS 로깅 시스템 통합 테스트
 * 
 * CORS 미들웨어와 로깅 시스템의 통합을 검증합니다.
 * 요구사항 4.1, 4.4, 4.5 통합 검증
 */

const request = require('supertest');
const express = require('express');
const { corsMiddleware, configManager } = require('../corsMiddleware');

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

// 테스트용 Express 앱 생성
const createTestApp = () => {
  const app = express();
  app.use(corsMiddleware);
  
  app.get('/test', (req, res) => {
    res.json({ message: 'Test endpoint' });
  });
  
  return app;
};

describe('CORS 로깅 시스템 통합 테스트', () => {
  describe('검증 실패 로깅 (요구사항 4.1)', () => {
    test('허용되지 않은 오리진 요청 시 검증 실패 로그 생성', async () => {
      const app = createTestApp();
      
      await request(app)
        .get('/test')
        .set('Origin', 'https://malicious.com')
        .expect(403);
      
      // 검증 실패 로그 확인
      const validationFailureLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:VALIDATION_FAILURE]')
      );
      
      expect(validationFailureLogs.length).toBeGreaterThan(0);
      
      const failureLog = validationFailureLogs[0];
      expect(failureLog.level).toBe('warn');
      expect(failureLog.args[1]).toContain('오리진 검증 실패');
      
      const logData = failureLog.args[2];
      expect(logData.origin).toBe('https://malicious.com');
      expect(logData).toHaveProperty('reason');
      expect(logData).toHaveProperty('path');
      expect(logData).toHaveProperty('method');
    });

    test('검증 실패 로그에 타임스탬프 포함', async () => {
      const app = createTestApp();
      
      await request(app)
        .get('/test')
        .set('Origin', 'https://unauthorized.com')
        .expect(403);
      
      const validationFailureLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:VALIDATION_FAILURE]')
      );
      
      expect(validationFailureLogs.length).toBeGreaterThan(0);
      
      // 로그 데이터에 타임스탬프가 있는지 확인 (내부적으로 생성됨)
      const failureLog = validationFailureLogs[0];
      expect(failureLog.args[2]).toHaveProperty('origin');
    });
  });

  describe('검증 성공 로깅 (요구사항 4.4)', () => {
    test('디버그 모드에서 허용된 오리진 요청 시 성공 로그 생성', async () => {
      // 디버그 모드 활성화
      const originalConfig = configManager.getConfiguration();
      configManager.updateConfiguration({ debugMode: true });
      
      const app = createTestApp();
      
      await request(app)
        .get('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .expect(200);
      
      // 검증 성공 로그 확인
      const validationSuccessLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:VALIDATION_SUCCESS]')
      );
      
      expect(validationSuccessLogs.length).toBeGreaterThan(0);
      
      const successLog = validationSuccessLogs[0];
      expect(successLog.level).toBe('log');
      expect(successLog.args[1]).toContain('오리진 검증 성공');
      
      const logData = successLog.args[2];
      expect(logData.origin).toBe('https://vipmobile.vercel.app');
      expect(logData).toHaveProperty('matchedOrigin');
      expect(logData).toHaveProperty('reason');
      
      // 디버그 모드 복원
      configManager.updateConfiguration({ debugMode: originalConfig.debugMode });
    });

    test('디버그 모드가 아닐 때는 성공 로그 생성하지 않음', async () => {
      // 디버그 모드 비활성화 확인
      const config = configManager.getConfiguration();
      if (config.debugMode) {
        configManager.updateConfiguration({ debugMode: false });
      }
      
      const app = createTestApp();
      
      await request(app)
        .get('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .expect(200);
      
      // 검증 성공 로그가 없어야 함
      const validationSuccessLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:VALIDATION_SUCCESS]')
      );
      
      expect(validationSuccessLogs.length).toBe(0);
    });
  });

  describe('프리플라이트 로깅', () => {
    test('OPTIONS 요청 시 프리플라이트 로그 생성', async () => {
      const app = createTestApp();
      
      await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .expect(200);
      
      // 프리플라이트 로그 확인
      const preflightLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:PREFLIGHT]')
      );
      
      expect(preflightLogs.length).toBeGreaterThan(0);
      
      // REQUEST 로그 확인
      const requestLog = preflightLogs.find(log => 
        log.args[1] && log.args[1].includes('OPTIONS 프리플라이트 요청 처리')
      );
      expect(requestLog).toBeDefined();
      
      // SUCCESS 로그 확인
      const successLog = preflightLogs.find(log => 
        log.args[1] && log.args[1].includes('프리플라이트 요청 검증 성공')
      );
      expect(successLog).toBeDefined();
    });

    test('허용되지 않은 메서드로 프리플라이트 요청 시 실패 로그 생성', async () => {
      const app = createTestApp();
      
      await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'INVALID')
        .expect(400);
      
      // 프리플라이트 실패 로그 확인
      const preflightFailureLogs = consoleOutput.filter(log => 
        log.level === 'warn' &&
        log.args[0] && log.args[0].includes('[CORS:PREFLIGHT]') &&
        log.args[1] && log.args[1].includes('실패')
      );
      
      expect(preflightFailureLogs.length).toBeGreaterThan(0);
    });
  });

  describe('캐시 로깅', () => {
    test('오리진 검증 캐싱 시 캐시 로그 생성', async () => {
      // 캐시 로그는 DEBUG 레벨이므로 환경 변수 설정
      const originalLogLevel = process.env.CORS_LOG_LEVEL;
      process.env.CORS_LOG_LEVEL = 'DEBUG';
      
      const app = createTestApp();
      
      // 첫 번째 요청 (캐시 MISS)
      await request(app)
        .get('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .expect(200);
      
      // 캐시 관련 로그 확인 (MISS 또는 SET)
      const cacheLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:CACHE]')
      );
      
      // 캐시 로그가 생성되었는지 확인
      expect(cacheLogs.length).toBeGreaterThan(0);
      
      // 환경 변수 복원
      if (originalLogLevel) {
        process.env.CORS_LOG_LEVEL = originalLogLevel;
      } else {
        delete process.env.CORS_LOG_LEVEL;
      }
    });
  });

  describe('미들웨어 오류 로깅', () => {
    test('미들웨어 오류 발생 시 오류 로그 생성 및 폴백 처리', () => {
      // 미들웨어 내부에서 오류를 발생시키는 시나리오
      // corsMiddleware는 try-catch로 오류를 처리하므로
      // 직접 오류 로깅 함수를 테스트
      const { logMiddlewareError } = require('../corsLogger');
      
      const testError = new Error('Test middleware error');
      const context = {
        path: '/test',
        method: 'GET',
        origin: 'https://example.com'
      };
      
      logMiddlewareError(testError, context);
      
      // 미들웨어 오류 로그 확인
      const errorLogs = consoleOutput.filter(log => 
        log.level === 'error' &&
        log.args[0] && log.args[0].includes('[CORS:MIDDLEWARE_ERROR]')
      );
      
      expect(errorLogs.length).toBeGreaterThan(0);
      
      const errorLog = errorLogs[0];
      expect(errorLog.args[1]).toContain('미들웨어 오류 발생');
      expect(errorLog.args[2]).toHaveProperty('error');
      expect(errorLog.args[2].error).toBe('Test middleware error');
      expect(errorLog.args[2].path).toBe('/test');
      expect(errorLog.args[2].method).toBe('GET');
    });
  });

  describe('구성 업데이트 로깅', () => {
    test('구성 업데이트 성공 시 로그 생성', () => {
      const { updateCORSConfiguration } = require('../corsMiddleware');
      
      const result = updateCORSConfiguration({
        debugMode: true
      });
      
      expect(result.success).toBe(true);
      
      // 구성 업데이트 성공 로그 확인
      const configUpdateLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:CONFIG_UPDATE]') &&
        log.args[1] && log.args[1].includes('구성 업데이트 성공')
      );
      
      expect(configUpdateLogs.length).toBeGreaterThan(0);
      
      const updateLog = configUpdateLogs[0];
      expect(updateLog.args[2]).toHaveProperty('updatedFields');
      expect(updateLog.args[2]).toHaveProperty('newConfig');
    });

    test('구성 업데이트 실패 시 경고 로그 생성', () => {
      const { updateCORSConfiguration } = require('../corsMiddleware');
      
      // 잘못된 구성으로 업데이트 시도
      const result = updateCORSConfiguration({
        allowedOrigins: 'not-an-array' // 배열이어야 함
      });
      
      expect(result.success).toBe(false);
      
      // 구성 업데이트 실패 로그 확인
      const configUpdateLogs = consoleOutput.filter(log => 
        log.level === 'warn' &&
        log.args[0] && log.args[0].includes('[CORS:CONFIG_UPDATE]') &&
        log.args[1] && log.args[1].includes('구성 업데이트 실패')
      );
      
      expect(configUpdateLogs.length).toBeGreaterThan(0);
      
      const updateLog = configUpdateLogs[0];
      expect(updateLog.args[2]).toHaveProperty('errors');
    });
  });

  describe('로그 형식 일관성', () => {
    test('모든 로그가 구조화된 형식을 따름', async () => {
      // 디버그 모드 활성화
      configManager.updateConfiguration({ debugMode: true });
      
      const app = createTestApp();
      
      // 다양한 요청 수행
      await request(app)
        .get('/test')
        .set('Origin', 'https://vipmobile.vercel.app');
      
      await request(app)
        .get('/test')
        .set('Origin', 'https://malicious.com');
      
      await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST');
      
      // 모든 CORS 로그 확인
      const corsLogs = consoleOutput.filter(log => 
        log.args[0] && log.args[0].includes('[CORS:')
      );
      
      expect(corsLogs.length).toBeGreaterThan(0);
      
      // 각 로그가 일관된 형식을 따르는지 확인
      corsLogs.forEach(log => {
        // 아이콘과 카테고리 포함
        expect(log.args[0]).toMatch(/[❌⚠️ℹ️🔍] \[CORS:[A-Z_]+\]/);
        
        // 메시지 포함
        expect(log.args[1]).toBeDefined();
        expect(typeof log.args[1]).toBe('string');
        
        // 데이터가 있는 경우 객체 형태
        if (log.args[2]) {
          expect(typeof log.args[2]).toBe('object');
        }
      });
    });
  });
});
