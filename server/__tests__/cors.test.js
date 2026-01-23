/**
 * CORS 미들웨어 기본 테스트
 * Jest를 사용한 단위 테스트
 */

const request = require('supertest');
const express = require('express');
const { 
  corsMiddleware, 
  getCORSConfiguration, 
  getAllowedOrigins,
  matchOriginCaseInsensitive,
  cacheManager,
  validateRequestedMethod,
  validateRequestedHeaders
} = require('../corsMiddleware');

describe('CORS 미들웨어 기본 테스트', () => {
  let app;

  beforeEach(() => {
    // 각 테스트마다 새로운 Express 앱 생성
    app = express();
    app.use(corsMiddleware);
    
    // 테스트용 라우트 추가
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });
    
    // 캐시 초기화
    cacheManager.clear();
  });

  describe('기본 CORS 헤더 설정', () => {
    test('GET 요청에 CORS 헤더가 포함되어야 함', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    test('허용된 오리진에서 요청 시 올바른 Origin 헤더 설정', async () => {
      const testOrigin = 'https://vipmobile.vercel.app';
      const response = await request(app)
        .get('/test')
        .set('Origin', testOrigin);

      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
    });

    test('localhost 오리진 허용 확인', async () => {
      const testOrigin = 'http://localhost:3000';
      const response = await request(app)
        .get('/test')
        .set('Origin', testOrigin);

      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
    });
  });

  describe('OPTIONS 프리플라이트 요청 처리', () => {
    test('OPTIONS 요청이 200 상태로 응답해야 함', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-max-age']).toBe('86400');
    });

    test('프리플라이트 요청에 필요한 모든 헤더 포함', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    test('허용된 메서드로 프리플라이트 요청 시 성공', async () => {
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of allowedMethods) {
        const response = await request(app)
          .options('/test')
          .set('Origin', 'https://vipmobile.vercel.app')
          .set('Access-Control-Request-Method', method);

        expect(response.status).toBe(200);
      }
    });

    test('허용되지 않은 메서드로 프리플라이트 요청 시 400 에러', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'TRACE');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('not allowed');
    });

    test('허용된 헤더로 프리플라이트 요청 시 성공', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization, X-Requested-With');

      expect(response.status).toBe(200);
    });

    test('허용되지 않은 헤더로 프리플라이트 요청 시 400 에러', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-Custom-Forbidden-Header');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('headers are not allowed');
    });

    test('메서드와 헤더 모두 지정하지 않은 프리플라이트 요청 허용', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.status).toBe(200);
    });

    test('대소문자 무관 헤더 검증', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'CONTENT-TYPE, authorization, X-Requested-With');

      expect(response.status).toBe(200);
    });

    test('Access-Control-Max-Age 헤더가 86400초로 설정됨', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'https://vipmobile.vercel.app')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-max-age']).toBe('86400');
    });
  });

  describe('구성 함수 테스트', () => {
    test('CORS 구성 정보 반환', () => {
      const config = getCORSConfiguration();
      
      expect(config).toHaveProperty('allowedOrigins');
      expect(config).toHaveProperty('allowedMethods');
      expect(config).toHaveProperty('allowedHeaders');
      expect(config).toHaveProperty('allowCredentials');
      expect(config).toHaveProperty('maxAge');
      
      expect(config.allowCredentials).toBe(true);
      expect(config.maxAge).toBe(86400);
    });

    test('허용된 오리진 목록 반환', () => {
      const origins = getAllowedOrigins();
      
      expect(Array.isArray(origins)).toBe(true);
      expect(origins).toContain('https://vipmobile.vercel.app');
      expect(origins).toContain('http://localhost:3000');
    });
  });

  describe('대소문자 무관 오리진 매칭 (요구사항 2.5)', () => {
    test('정확한 대소문자 매칭', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive('https://vipmobile.vercel.app', allowedOrigins);
      
      expect(result).toBe('https://vipmobile.vercel.app');
    });

    test('대문자 변형 매칭', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive('HTTPS://VIPMOBILE.VERCEL.APP', allowedOrigins);
      
      expect(result).toBe('https://vipmobile.vercel.app');
    });

    test('혼합 대소문자 변형 매칭', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive('HtTpS://VipMobile.Vercel.App', allowedOrigins);
      
      expect(result).toBe('https://vipmobile.vercel.app');
    });

    test('localhost 대소문자 변형 매칭', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive('HTTP://LOCALHOST:3000', allowedOrigins);
      
      expect(result).toBe('http://localhost:3000');
    });

    test('허용되지 않은 오리진은 null 반환', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive('https://evil.com', allowedOrigins);
      
      expect(result).toBeNull();
    });

    test('빈 오리진은 null 반환', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive('', allowedOrigins);
      
      expect(result).toBeNull();
    });

    test('null 오리진은 null 반환', () => {
      const allowedOrigins = getAllowedOrigins();
      const result = matchOriginCaseInsensitive(null, allowedOrigins);
      
      expect(result).toBeNull();
    });
  });

  describe('오리진 검증 캐싱 (요구사항 6.3, 6.5)', () => {
    test('캐시에 검증 결과 저장 및 조회', () => {
      const allowedOrigins = getAllowedOrigins();
      
      // 첫 번째 호출 - 캐시 미스
      const result1 = matchOriginCaseInsensitive('https://vipmobile.vercel.app', allowedOrigins);
      expect(result1).toBe('https://vipmobile.vercel.app');
      
      // 두 번째 호출 - 캐시 히트
      const result2 = matchOriginCaseInsensitive('https://vipmobile.vercel.app', allowedOrigins);
      expect(result2).toBe('https://vipmobile.vercel.app');
      
      // 캐시 통계 확인
      const stats = cacheManager.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('대소문자 다른 오리진도 캐시 사용', () => {
      const allowedOrigins = getAllowedOrigins();
      
      // 소문자로 첫 호출
      const result1 = matchOriginCaseInsensitive('https://vipmobile.vercel.app', allowedOrigins);
      expect(result1).toBe('https://vipmobile.vercel.app');
      
      // 대문자로 두 번째 호출 - 동일한 캐시 키 사용
      const result2 = matchOriginCaseInsensitive('HTTPS://VIPMOBILE.VERCEL.APP', allowedOrigins);
      expect(result2).toBe('https://vipmobile.vercel.app');
    });

    test('캐시 초기화 기능', () => {
      const allowedOrigins = getAllowedOrigins();
      
      // 캐시에 항목 추가
      matchOriginCaseInsensitive('https://vipmobile.vercel.app', allowedOrigins);
      expect(cacheManager.getStats().size).toBeGreaterThan(0);
      
      // 캐시 초기화
      cacheManager.clear();
      expect(cacheManager.getStats().size).toBe(0);
    });

    test('캐시 통계 정보 확인', () => {
      const stats = cacheManager.getStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('ttl');
      expect(stats.maxSize).toBe(1000);
      expect(stats.ttl).toBe(3600000); // 1시간
    });
  });

  describe('대소문자 무관 오리진 매칭 통합 테스트', () => {
    test('대문자 오리진으로 요청 시 정상 처리', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'HTTPS://VIPMOBILE.VERCEL.APP');

      expect(response.headers['access-control-allow-origin']).toBe('HTTPS://VIPMOBILE.VERCEL.APP');
    });

    test('혼합 대소문자 오리진으로 요청 시 정상 처리', async () => {
      const testOrigin = 'HtTpS://VipMobile.Vercel.App';
      const response = await request(app)
        .get('/test')
        .set('Origin', testOrigin);

      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
    });

    test('localhost 대문자 변형으로 요청 시 정상 처리', async () => {
      const testOrigin = 'HTTP://LOCALHOST:3000';
      const response = await request(app)
        .get('/test')
        .set('Origin', testOrigin);

      expect(response.headers['access-control-allow-origin']).toBe(testOrigin);
    });
  });

  describe('허용된 오리진 목록 관리 개선', () => {
    test('중복 오리진 제거 (대소문자 무관)', () => {
      // 환경 변수 설정 (테스트용)
      const originalEnv = process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = 'https://vipmobile.vercel.app,HTTPS://VIPMOBILE.VERCEL.APP,http://localhost:3000';
      
      const origins = getAllowedOrigins();
      
      // 대소문자 다른 중복이 제거되었는지 확인
      const lowerOrigins = origins.map(o => o.toLowerCase());
      const uniqueLowerOrigins = [...new Set(lowerOrigins)];
      expect(lowerOrigins.length).toBe(uniqueLowerOrigins.length);
      
      // 환경 변수 복원
      process.env.CORS_ORIGIN = originalEnv;
    });

    test('환경 변수 오리진 트림 처리', () => {
      const originalEnv = process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = '  https://example.com  ,  https://test.com  ';
      
      // 구성 초기화하여 새로운 환경 변수 반영
      const { configManager } = require('../corsMiddleware');
      configManager.resetConfiguration();
      
      const origins = getAllowedOrigins();
      
      // 트림된 오리진이 포함되어 있는지 확인
      expect(origins.some(o => o === 'https://example.com')).toBe(true);
      expect(origins.some(o => o === 'https://test.com')).toBe(true);
      
      // 공백이 포함된 오리진이 없는지 확인
      expect(origins.some(o => o.includes('  '))).toBe(false);
      
      process.env.CORS_ORIGIN = originalEnv;
      configManager.resetConfiguration();
    });

    test('빈 환경 변수 처리', () => {
      const originalEnv = process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = '';
      
      const origins = getAllowedOrigins();
      
      // 기본 오리진들은 여전히 포함되어야 함
      expect(origins).toContain('https://vipmobile.vercel.app');
      expect(origins).toContain('http://localhost:3000');
      
      process.env.CORS_ORIGIN = originalEnv;
    });
  });

  describe('프리플라이트 요청 메서드 및 헤더 검증 (요구사항 1.2, 6.1)', () => {
    describe('validateRequestedMethod', () => {
      test('허용된 메서드는 true 반환', () => {
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];
        
        allowedMethods.forEach(method => {
          expect(validateRequestedMethod(method)).toBe(true);
        });
      });

      test('대소문자 무관 메서드 검증', () => {
        expect(validateRequestedMethod('get')).toBe(true);
        expect(validateRequestedMethod('GET')).toBe(true);
        expect(validateRequestedMethod('Post')).toBe(true);
        expect(validateRequestedMethod('pOsT')).toBe(true);
      });

      test('허용되지 않은 메서드는 false 반환', () => {
        const disallowedMethods = ['TRACE', 'CONNECT', 'INVALID'];
        
        disallowedMethods.forEach(method => {
          expect(validateRequestedMethod(method)).toBe(false);
        });
      });

      test('빈 메서드는 true 반환 (선택적)', () => {
        expect(validateRequestedMethod('')).toBe(true);
        expect(validateRequestedMethod(null)).toBe(true);
        expect(validateRequestedMethod(undefined)).toBe(true);
      });
    });

    describe('validateRequestedHeaders', () => {
      test('허용된 헤더는 true 반환', () => {
        expect(validateRequestedHeaders('Content-Type')).toBe(true);
        expect(validateRequestedHeaders('Authorization')).toBe(true);
        expect(validateRequestedHeaders('X-Requested-With')).toBe(true);
        expect(validateRequestedHeaders('X-API-Key')).toBe(true);
      });

      test('여러 허용된 헤더는 true 반환', () => {
        expect(validateRequestedHeaders('Content-Type, Authorization')).toBe(true);
        expect(validateRequestedHeaders('Content-Type, Authorization, X-Requested-With')).toBe(true);
        expect(validateRequestedHeaders('X-User-Id, X-User-Role, X-User-Name')).toBe(true);
      });

      test('대소문자 무관 헤더 검증', () => {
        expect(validateRequestedHeaders('content-type')).toBe(true);
        expect(validateRequestedHeaders('CONTENT-TYPE')).toBe(true);
        expect(validateRequestedHeaders('Content-Type')).toBe(true);
        expect(validateRequestedHeaders('AUTHORIZATION, x-requested-with')).toBe(true);
      });

      test('공백 처리', () => {
        expect(validateRequestedHeaders('Content-Type,  Authorization  ,X-Requested-With')).toBe(true);
        expect(validateRequestedHeaders('  Content-Type  ')).toBe(true);
      });

      test('허용되지 않은 헤더는 false 반환', () => {
        expect(validateRequestedHeaders('X-Custom-Forbidden-Header')).toBe(false);
        expect(validateRequestedHeaders('X-Evil-Header')).toBe(false);
      });

      test('일부 허용되지 않은 헤더가 포함되면 false 반환', () => {
        expect(validateRequestedHeaders('Content-Type, X-Forbidden-Header')).toBe(false);
        expect(validateRequestedHeaders('Authorization, X-Evil-Header, X-Requested-With')).toBe(false);
      });

      test('빈 헤더는 true 반환 (선택적)', () => {
        expect(validateRequestedHeaders('')).toBe(true);
        expect(validateRequestedHeaders(null)).toBe(true);
        expect(validateRequestedHeaders(undefined)).toBe(true);
      });

      test('모든 표준 CORS 헤더 허용', () => {
        const standardHeaders = [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Origin',
          'Accept',
          'X-API-Key',
          'X-User-Id',
          'X-User-Role',
          'X-User-Name',
          'X-Mode',
          'Cache-Control',
          'Pragma',
          'Expires'
        ];
        
        const headersString = standardHeaders.join(', ');
        expect(validateRequestedHeaders(headersString)).toBe(true);
      });
    });
  });
});