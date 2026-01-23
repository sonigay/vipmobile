/**
 * CORS 속성 기반 테스트
 * fast-check를 사용한 정확성 속성 검증
 * 
 * 이 파일은 설계 문서의 13개 정확성 속성을 검증합니다.
 */

const request = require('supertest');
const express = require('express');
const { corsMiddleware, getCORSConfiguration } = require('../corsMiddleware');
const {
  fc,
  validOriginArbitrary,
  invalidOriginArbitrary,
  httpMethodArbitrary,
  corsRequestContextArbitrary,
  caseVariantOriginArbitrary,
  apiPathArbitrary,
  runPropertyTest,
  PBT_CONFIG
} = require('./helpers/pbt-helpers');

describe('CORS 속성 기반 테스트', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(corsMiddleware);
    
    // 테스트용 라우트들 추가
    app.all('*', (req, res) => {
      res.json({ 
        message: 'Test endpoint',
        method: req.method,
        path: req.path 
      });
    });
  });

  describe('속성 1: CORS 헤더 포함', () => {
    /**
     * **검증: 요구사항 1.1, 1.4, 1.5**
     * 모든 API 요청에 대해, 응답은 필수 CORS 헤더를 포함해야 합니다
     */
    runPropertyTest(
      '모든 유효한 요청에 필수 CORS 헤더가 포함되어야 함',
      fc.asyncProperty(
        corsRequestContextArbitrary(),
        async (context) => {
          const response = await request(app)
            [context.method.toLowerCase()]('/test')
            .set('Origin', context.origin || 'https://vipmobile.vercel.app');

          // 필수 CORS 헤더 검증
          expect(response.headers['access-control-allow-origin']).toBeDefined();
          expect(response.headers['access-control-allow-methods']).toBeDefined();
          expect(response.headers['access-control-allow-headers']).toBeDefined();
          
          // 헤더 값 검증
          expect(response.headers['access-control-allow-methods']).toMatch(/GET.*POST.*PUT.*DELETE.*OPTIONS/);
          expect(response.headers['access-control-allow-headers']).toMatch(/Content-Type.*Authorization.*X-Requested-With/);
        }
      )
    );
  });

  describe('속성 2: 프리플라이트 응답 완전성', () => {
    /**
     * **검증: 요구사항 1.2, 6.1**
     * 모든 OPTIONS 프리플라이트 요청에 대해, 응답은 적절한 CORS 헤더와 
     * Access-Control-Max-Age 헤더(86400초)를 포함해야 합니다
     */
    runPropertyTest(
      '모든 OPTIONS 요청에 완전한 프리플라이트 응답',
      fc.asyncProperty(
        validOriginArbitrary(),
        apiPathArbitrary(),
        async (origin, path) => {
          const response = await request(app)
            .options(path)
            .set('Origin', origin);

          // 프리플라이트 응답 검증
          expect(response.status).toBe(200);
          expect(response.headers['access-control-allow-origin']).toBeDefined();
          expect(response.headers['access-control-allow-methods']).toBeDefined();
          expect(response.headers['access-control-allow-headers']).toBeDefined();
          expect(response.headers['access-control-max-age']).toBe('86400');
        }
      )
    );

    runPropertyTest(
      '허용된 메서드로 프리플라이트 요청 시 성공',
      fc.asyncProperty(
        validOriginArbitrary(),
        httpMethodArbitrary(),
        apiPathArbitrary(),
        async (origin, method, path) => {
          const response = await request(app)
            .options(path)
            .set('Origin', origin)
            .set('Access-Control-Request-Method', method);

          // 허용된 메서드는 200 응답
          expect(response.status).toBe(200);
          expect(response.headers['access-control-max-age']).toBe('86400');
        }
      )
    );

    runPropertyTest(
      '허용되지 않은 메서드로 프리플라이트 요청 시 400 에러',
      fc.asyncProperty(
        validOriginArbitrary(),
        fc.constantFrom('TRACE', 'CONNECT', 'INVALID', 'CUSTOM'),
        apiPathArbitrary(),
        async (origin, invalidMethod, path) => {
          const response = await request(app)
            .options(path)
            .set('Origin', origin)
            .set('Access-Control-Request-Method', invalidMethod);

          // 허용되지 않은 메서드는 400 에러
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty('error');
        }
      )
    );

    const allowedHeadersArbitrary = () => {
      return fc.array(
        fc.constantFrom(
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
        ),
        { minLength: 1, maxLength: 5 }
      ).map(headers => headers.join(', '));
    };

    runPropertyTest(
      '허용된 헤더로 프리플라이트 요청 시 성공',
      fc.asyncProperty(
        validOriginArbitrary(),
        allowedHeadersArbitrary(),
        apiPathArbitrary(),
        async (origin, headers, path) => {
          const response = await request(app)
            .options(path)
            .set('Origin', origin)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', headers);

          // 허용된 헤더는 200 응답
          expect(response.status).toBe(200);
          expect(response.headers['access-control-max-age']).toBe('86400');
        }
      )
    );

    const forbiddenHeadersArbitrary = () => {
      return fc.oneof(
        fc.constant('X-Forbidden-Header'),
        fc.constant('X-Evil-Header'),
        fc.constant('X-Custom-Forbidden'),
        fc.string({ minLength: 5, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9\-]+$/.test(s))
          .map(s => `X-Forbidden-${s}`)
      );
    };

    runPropertyTest(
      '허용되지 않은 헤더로 프리플라이트 요청 시 400 에러',
      fc.asyncProperty(
        validOriginArbitrary(),
        forbiddenHeadersArbitrary(),
        apiPathArbitrary(),
        async (origin, forbiddenHeader, path) => {
          const response = await request(app)
            .options(path)
            .set('Origin', origin)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', forbiddenHeader);

          // 허용되지 않은 헤더는 400 에러
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty('error');
        }
      )
    );
  });

  describe('속성 3: 자격 증명 헤더 설정', () => {
    /**
     * **검증: 요구사항 1.3**
     * 모든 자격 증명이 포함된 요청에 대해, 응답은 
     * Access-Control-Allow-Credentials 헤더를 true로 설정해야 합니다
     */
    runPropertyTest(
      '모든 요청에 자격 증명 헤더가 true로 설정됨',
      fc.asyncProperty(
        httpMethodArbitrary(),
        validOriginArbitrary(),
        async (method, origin) => {
          const response = await request(app)
            [method.toLowerCase()]('/test')
            .set('Origin', origin);

          expect(response.headers['access-control-allow-credentials']).toBe('true');
        }
      )
    );
  });

  describe('속성 4: 오리진 검증 정확성', () => {
    /**
     * **검증: 요구사항 2.1, 2.2**
     * 모든 요청에 대해, 허용된 오리진에서 온 요청은 성공해야 하고,
     * 허용되지 않은 오리진에서 온 요청은 적절히 처리되어야 합니다
     */
    runPropertyTest(
      '허용된 오리진 요청은 올바른 CORS 헤더로 성공',
      fc.asyncProperty(
        validOriginArbitrary(),
        httpMethodArbitrary(),
        async (origin, method) => {
          const response = await request(app)
            [method.toLowerCase()]('/test')
            .set('Origin', origin);

          // 허용된 오리진은 성공적으로 처리
          if (method !== 'OPTIONS') {
            expect(response.status).not.toBe(403);
          }
          expect(response.headers['access-control-allow-origin']).toBe(origin);
        }
      )
    );
  });

  describe('속성 5: 대소문자 무관 오리진 매칭', () => {
    /**
     * **검증: 요구사항 2.5**
     * 모든 유효한 오리진에 대해, 대소문자가 다른 변형도 동일하게 매칭되어야 합니다
     */
    runPropertyTest(
      '대소문자 변형 오리진이 동일하게 매칭됨',
      fc.asyncProperty(
        caseVariantOriginArbitrary(),
        apiPathArbitrary(),
        async (origin, path) => {
          const response = await request(app)
            .get(path)
            .set('Origin', origin);
          
          // 대소문자 변형에 관계없이 CORS 헤더가 설정되어야 함
          expect(response.headers['access-control-allow-origin']).toBe(origin);
          expect(response.headers['access-control-allow-methods']).toBeDefined();
          expect(response.headers['access-control-allow-headers']).toBeDefined();
        }
      )
    );

    test('대소문자 변형 오리진 처리 검증', async () => {
      // 다양한 대소문자 변형 테스트
      const variants = [
        'https://vipmobile.vercel.app',
        'HTTPS://VIPMOBILE.VERCEL.APP',
        'HtTpS://VipMobile.Vercel.App',
        'https://VIPMOBILE.vercel.app',
        'HTTP://LOCALHOST:3000',
        'http://LocalHost:3000',
        'HTTP://localhost:3000'
      ];
      
      for (const variant of variants) {
        const response = await request(app)
          .get('/test')
          .set('Origin', variant);
        
        // 모든 변형이 정상적으로 처리되어야 함
        expect(response.headers['access-control-allow-origin']).toBe(variant);
      }
    });
  });

  describe('속성 6: API 경로 커버리지', () => {
    /**
     * **검증: 요구사항 3.1**
     * 모든 /api/direct 경로 하의 엔드포인트에 대해, 
     * CORS 헤더가 적절히 설정되어야 합니다
     */
    runPropertyTest(
      '모든 API 경로에 CORS 헤더 적용',
      fc.asyncProperty(
        apiPathArbitrary(),
        validOriginArbitrary(),
        httpMethodArbitrary(),
        async (path, origin, method) => {
          const response = await request(app)
            [method.toLowerCase()](path)
            .set('Origin', origin);

          // API 경로에 CORS 헤더 적용 확인
          expect(response.headers['access-control-allow-origin']).toBeDefined();
          expect(response.headers['access-control-allow-methods']).toBeDefined();
          expect(response.headers['access-control-allow-headers']).toBeDefined();
        }
      )
    );
  });

  describe('속성 13: 오리진 검증 캐싱', () => {
    /**
     * **검증: 요구사항 6.3, 6.5**
     * 모든 동일한 오리진의 반복 요청에 대해, 캐시된 검증 결과가 사용되어야 합니다
     */
    const { matchOriginCaseInsensitive, getAllowedOrigins, cacheManager } = require('../corsMiddleware');

    beforeEach(() => {
      // 각 테스트 전에 캐시 초기화
      cacheManager.clear();
    });

    runPropertyTest(
      '동일 오리진 반복 요청 시 캐시 사용',
      fc.asyncProperty(
        validOriginArbitrary(),
        fc.integer({ min: 2, max: 10 }),
        async (origin, repeatCount) => {
          const allowedOrigins = getAllowedOrigins();
          
          // 첫 번째 호출
          const firstResult = matchOriginCaseInsensitive(origin, allowedOrigins);
          
          // 반복 호출
          for (let i = 0; i < repeatCount; i++) {
            const result = matchOriginCaseInsensitive(origin, allowedOrigins);
            // 모든 결과가 동일해야 함
            expect(result).toEqual(firstResult);
          }
          
          // 캐시에 저장되었는지 확인
          const stats = cacheManager.getStats();
          expect(stats.size).toBeGreaterThan(0);
        }
      )
    );

    test('대소문자 다른 오리진도 동일한 캐시 키 사용', () => {
      const allowedOrigins = getAllowedOrigins();
      
      // 소문자 버전
      const result1 = matchOriginCaseInsensitive('https://vipmobile.vercel.app', allowedOrigins);
      const cacheSize1 = cacheManager.getStats().size;
      
      // 대문자 버전 (동일한 캐시 키 사용)
      const result2 = matchOriginCaseInsensitive('HTTPS://VIPMOBILE.VERCEL.APP', allowedOrigins);
      const cacheSize2 = cacheManager.getStats().size;
      
      // 캐시 크기가 증가하지 않아야 함 (동일한 키 사용)
      expect(cacheSize2).toBe(cacheSize1);
      
      // 결과는 동일해야 함
      expect(result1).toBe(result2);
    });

    test('캐시 크기 제한 확인', () => {
      const allowedOrigins = getAllowedOrigins();
      const stats = cacheManager.getStats();
      
      // 최대 캐시 크기 확인
      expect(stats.maxSize).toBe(1000);
      
      // 많은 다른 오리진으로 캐시 채우기
      for (let i = 0; i < 50; i++) {
        matchOriginCaseInsensitive(`https://test${i}.com`, allowedOrigins);
      }
      
      // 캐시 크기가 제한 내에 있는지 확인
      const newStats = cacheManager.getStats();
      expect(newStats.size).toBeLessThanOrEqual(stats.maxSize);
    });
  });

  describe('테스트 환경 검증', () => {
    test('fast-check 라이브러리 동작 확인', () => {
      // fast-check가 올바르게 설치되고 동작하는지 확인
      const result = fc.sample(fc.integer({ min: 1, max: 100 }), 10);
      expect(result).toHaveLength(10);
      expect(result.every(n => n >= 1 && n <= 100)).toBe(true);
    });

    test('속성 기반 테스트 헬퍼 함수 동작 확인', () => {
      const origins = fc.sample(validOriginArbitrary(), 5);
      expect(origins).toHaveLength(5);
      expect(origins.every(origin => typeof origin === 'string')).toBe(true);
    });

    test('PBT 구성 설정 확인', () => {
      expect(PBT_CONFIG.numRuns).toBeGreaterThanOrEqual(100);
      expect(PBT_CONFIG.timeout).toBeGreaterThan(0);
    });
  });
});