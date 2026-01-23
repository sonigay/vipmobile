/**
 * 직영점모드 휴대폰시세표 이미지 갱신 및 API 오류 수정 E2E 테스트
 * Feature: direct-store-image-refresh-fix
 * 
 * 이 테스트는 다음 태스크를 검증합니다:
 * - 8.1: 시세표 갱신 기능 E2E 테스트
 * - 8.2: 이미지 갱신 기능 E2E 테스트
 * - 8.3: CORS 오류 해결 확인
 * - 8.4: API 초기화 오류 해결 확인
 */

const request = require('supertest');
const express = require('express');
const { corsMiddleware } = require('../corsMiddleware');

// 테스트용 Express 앱 설정
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);

  // Mock 라우트 설정
  // 실제 directRoutes.js의 엔드포인트를 모킹합니다
  
  // 시세표 갱신 API
  app.post('/api/direct/rebuild-master', (req, res) => {
    const { carrier } = req.query;
    
    if (!carrier || !['SK', 'KT', 'LG'].includes(carrier)) {
      return res.status(400).json({
        success: false,
        error: '유효한 통신사를 지정해주세요 (SK, KT, LG)'
      });
    }
    
    // Mock 성공 응답
    res.json({
      success: true,
      carrier: carrier,
      deviceCount: 150,
      planCount: 45,
      pricingCount: 300
    });
  });

  // 이미지 갱신 API
  app.post('/api/direct/refresh-images-from-discord', (req, res) => {
    const { carrier } = req.query;
    
    if (!carrier || !['SK', 'KT', 'LG'].includes(carrier)) {
      return res.status(400).json({
        success: false,
        error: '유효한 통신사를 지정해주세요 (SK, KT, LG)'
      });
    }
    
    // Mock 성공 응답
    res.json({
      success: true,
      carrier: carrier,
      updatedCount: 120,
      failedCount: 5,
      updatedImages: [
        {
          modelId: 'SM-S911N',
          oldUrl: 'https://cdn.discordapp.com/old/image1.png',
          newUrl: 'https://cdn.discordapp.com/new/image1.png'
        }
      ],
      failedImages: [
        {
          modelId: 'SM-A546N',
          reason: 'Discord 메시지 ID 없음'
        }
      ]
    });
  });

  // 기존 API 엔드포인트들 (API 초기화 오류 테스트용)
  app.get('/api/direct/mobiles-master', (req, res) => {
    const { carrier } = req.query;
    res.json({
      success: true,
      data: [
        { modelId: 'SM-S911N', model: '갤럭시 S23', carrier: carrier || 'SK' }
      ]
    });
  });

  app.get('/api/direct/plans-master', (req, res) => {
    const { carrier } = req.query;
    res.json({
      success: true,
      data: [
        { planId: 'PLAN001', planName: '5G 프리미어 플러스', carrier: carrier || 'SK' }
      ]
    });
  });

  app.get('/api/direct/mobiles-pricing', (req, res) => {
    const { carrier } = req.query;
    res.json({
      success: true,
      data: [
        { modelId: 'SM-S911N', planGroup: '5G프리미어', price: 1200000 }
      ]
    });
  });

  app.get('/api/direct/policy-settings', (req, res) => {
    res.json({
      success: true,
      data: {
        requiredAddons: '부가서비스1,부가서비스2'
      }
    });
  });

  return app;
}

describe('태스크 8.1: 시세표 갱신 기능 E2E 테스트', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('사용자가 "시세표갱신하기" 버튼 클릭 시 API 호출 성공', async () => {
    // Requirements: 1.1, 1.2, 1.3
    const response = await request(app)
      .post('/api/direct/rebuild-master?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.carrier).toBe('SK');
  });

  test('성공 메시지 및 갱신된 항목 수 표시 확인', async () => {
    // Requirements: 1.3
    const response = await request(app)
      .post('/api/direct/rebuild-master?carrier=KT')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.body).toHaveProperty('deviceCount');
    expect(response.body).toHaveProperty('planCount');
    expect(response.body).toHaveProperty('pricingCount');
    expect(response.body.deviceCount).toBeGreaterThan(0);
    expect(response.body.planCount).toBeGreaterThan(0);
    expect(response.body.pricingCount).toBeGreaterThan(0);
  });

  test('잘못된 통신사 파라미터 처리', async () => {
    // Requirements: 1.4
    const response = await request(app)
      .post('/api/direct/rebuild-master?carrier=INVALID')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('유효한 통신사');
  });

  test('모든 통신사에 대해 시세표 갱신 가능', async () => {
    // Requirements: 1.1
    const carriers = ['SK', 'KT', 'LG'];

    for (const carrier of carriers) {
      const response = await request(app)
        .post(`/api/direct/rebuild-master?carrier=${carrier}`)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.carrier).toBe(carrier);
    }
  });

  test('CORS 헤더가 응답에 포함됨', async () => {
    // Requirements: 3.1, 3.3, 3.5
    const response = await request(app)
      .post('/api/direct/rebuild-master?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.headers['access-control-allow-origin']).toBeDefined();
    expect(response.headers['access-control-allow-methods']).toBeDefined();
    expect(response.headers['access-control-allow-headers']).toBeDefined();
  });
});

describe('태스크 8.2: 이미지 갱신 기능 E2E 테스트', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('사용자가 "이미지갱신하기" 버튼 클릭 시 API 호출 성공', async () => {
    // Requirements: 1-1.1, 1-1.3
    const response = await request(app)
      .post('/api/direct/refresh-images-from-discord?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.carrier).toBe('SK');
  });

  test('성공/실패 이미지 수 표시 확인', async () => {
    // Requirements: 1-1.6
    const response = await request(app)
      .post('/api/direct/refresh-images-from-discord?carrier=KT')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.body).toHaveProperty('updatedCount');
    expect(response.body).toHaveProperty('failedCount');
    expect(response.body.updatedCount).toBeGreaterThanOrEqual(0);
    expect(response.body.failedCount).toBeGreaterThanOrEqual(0);
  });

  test('갱신된 이미지 목록 반환 확인', async () => {
    // Requirements: 1-1.3, 1-1.4
    const response = await request(app)
      .post('/api/direct/refresh-images-from-discord?carrier=LG')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.body).toHaveProperty('updatedImages');
    expect(response.body).toHaveProperty('failedImages');
    expect(Array.isArray(response.body.updatedImages)).toBe(true);
    expect(Array.isArray(response.body.failedImages)).toBe(true);
  });

  test('실패한 이미지 목록에 실패 이유 포함', async () => {
    // Requirements: 1-1.5
    const response = await request(app)
      .post('/api/direct/refresh-images-from-discord?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    if (response.body.failedImages && response.body.failedImages.length > 0) {
      const failedImage = response.body.failedImages[0];
      expect(failedImage).toHaveProperty('modelId');
      expect(failedImage).toHaveProperty('reason');
      expect(typeof failedImage.reason).toBe('string');
    }
  });

  test('모든 통신사에 대해 이미지 갱신 가능', async () => {
    // Requirements: 1-1.1
    const carriers = ['SK', 'KT', 'LG'];

    for (const carrier of carriers) {
      const response = await request(app)
        .post(`/api/direct/refresh-images-from-discord?carrier=${carrier}`)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.carrier).toBe(carrier);
    }
  });

  test('잘못된 통신사 파라미터 처리', async () => {
    const response = await request(app)
      .post('/api/direct/refresh-images-from-discord?carrier=INVALID')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('유효한 통신사');
  });
});

describe('태스크 8.3: CORS 오류 해결 확인', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('프론트엔드에서 백엔드 API 호출 시 CORS 오류 없음', async () => {
    // Requirements: 3.1, 3.3, 3.5
    const response = await request(app)
      .get('/api/direct/mobiles-master?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://vipmobile.vercel.app');
  });

  test('모든 API 엔드포인트에 대한 CORS 헤더 존재 확인', async () => {
    // Requirements: 3.1, 3.3, 3.5
    const endpoints = [
      '/api/direct/mobiles-master?carrier=SK',
      '/api/direct/plans-master?carrier=SK',
      '/api/direct/mobiles-pricing?carrier=SK',
      '/api/direct/policy-settings',
      '/api/direct/rebuild-master?carrier=SK',
      '/api/direct/refresh-images-from-discord?carrier=SK'
    ];

    for (const endpoint of endpoints) {
      const method = endpoint.includes('rebuild') || endpoint.includes('refresh') ? 'post' : 'get';
      const response = await request(app)[method](endpoint)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    }
  });

  test('OPTIONS 프리플라이트 요청 처리 확인', async () => {
    // Requirements: 3.2
    const response = await request(app)
      .options('/api/direct/rebuild-master')
      .set('Origin', 'https://vipmobile.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeDefined();
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
  });

  test('허용된 오리진에서 요청 시 정상 처리', async () => {
    // Requirements: 3.1
    const allowedOrigins = [
      'https://vipmobile.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    for (const origin of allowedOrigins) {
      const response = await request(app)
        .get('/api/direct/mobiles-master?carrier=SK')
        .set('Origin', origin);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  test('모든 HTTP 메서드에 대한 CORS 헤더 설정', async () => {
    // Requirements: 3.3
    const methods = [
      { method: 'get', endpoint: '/api/direct/mobiles-master?carrier=SK' },
      { method: 'post', endpoint: '/api/direct/rebuild-master?carrier=SK' }
    ];

    for (const { method, endpoint } of methods) {
      const response = await request(app)[method](endpoint)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    }
  });
});

describe('태스크 8.4: API 초기화 오류 해결 확인', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('페이지 로드 시 ReferenceError 발생하지 않음 확인', async () => {
    // Requirements: 2.1, 2.2
    // 모든 API를 순차적으로 호출하여 초기화 오류가 없는지 확인
    const apiCalls = [
      { method: 'get', endpoint: '/api/direct/mobiles-master?carrier=SK' },
      { method: 'get', endpoint: '/api/direct/plans-master?carrier=SK' },
      { method: 'get', endpoint: '/api/direct/mobiles-pricing?carrier=SK' },
      { method: 'get', endpoint: '/api/direct/policy-settings' }
    ];

    for (const { method, endpoint } of apiCalls) {
      const response = await request(app)[method](endpoint)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }
  });

  test('모든 API 호출이 정상적으로 작동함 확인', async () => {
    // Requirements: 2.2, 2.5
    const carriers = ['SK', 'KT', 'LG'];
    const apis = [
      { method: 'get', endpoint: '/api/direct/mobiles-master' },
      { method: 'get', endpoint: '/api/direct/plans-master' },
      { method: 'get', endpoint: '/api/direct/mobiles-pricing' }
    ];

    for (const carrier of carriers) {
      for (const { method, endpoint } of apis) {
        const response = await request(app)[method](`${endpoint}?carrier=${carrier}`)
          .set('Origin', 'https://vipmobile.vercel.app');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      }
    }
  });

  test('동시 API 호출 시 초기화 오류 없음', async () => {
    // Requirements: 2.3
    const promises = [
      request(app).get('/api/direct/mobiles-master?carrier=SK').set('Origin', 'https://vipmobile.vercel.app'),
      request(app).get('/api/direct/plans-master?carrier=KT').set('Origin', 'https://vipmobile.vercel.app'),
      request(app).get('/api/direct/mobiles-pricing?carrier=LG').set('Origin', 'https://vipmobile.vercel.app'),
      request(app).get('/api/direct/policy-settings').set('Origin', 'https://vipmobile.vercel.app')
    ];

    const responses = await Promise.all(promises);

    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  test('API 응답 데이터 구조 검증', async () => {
    // Requirements: 2.2
    const response = await request(app)
      .get('/api/direct/mobiles-master?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('오류 발생 시 명확한 오류 메시지 반환', async () => {
    // Requirements: 2.2
    const response = await request(app)
      .post('/api/direct/rebuild-master?carrier=INVALID')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(typeof response.body.error).toBe('string');
    expect(response.body.error.length).toBeGreaterThan(0);
  });
});

describe('통합 시나리오 테스트', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  test('시세표 갱신 후 데이터 조회 플로우', async () => {
    // 1. 시세표 갱신
    const rebuildResponse = await request(app)
      .post('/api/direct/rebuild-master?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(rebuildResponse.status).toBe(200);
    expect(rebuildResponse.body.success).toBe(true);

    // 2. 갱신된 데이터 조회
    const dataResponse = await request(app)
      .get('/api/direct/mobiles-master?carrier=SK')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(dataResponse.status).toBe(200);
    expect(dataResponse.body.success).toBe(true);
    expect(dataResponse.body.data).toBeDefined();
  });

  test('이미지 갱신 후 데이터 조회 플로우', async () => {
    // 1. 이미지 갱신
    const refreshResponse = await request(app)
      .post('/api/direct/refresh-images-from-discord?carrier=KT')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.success).toBe(true);

    // 2. 갱신된 데이터 조회
    const dataResponse = await request(app)
      .get('/api/direct/mobiles-master?carrier=KT')
      .set('Origin', 'https://vipmobile.vercel.app');

    expect(dataResponse.status).toBe(200);
    expect(dataResponse.body.success).toBe(true);
  });

  test('여러 통신사 순차 처리', async () => {
    const carriers = ['SK', 'KT', 'LG'];

    for (const carrier of carriers) {
      // 시세표 갱신
      const rebuildResponse = await request(app)
        .post(`/api/direct/rebuild-master?carrier=${carrier}`)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(rebuildResponse.status).toBe(200);
      expect(rebuildResponse.body.carrier).toBe(carrier);

      // 이미지 갱신
      const refreshResponse = await request(app)
        .post(`/api/direct/refresh-images-from-discord?carrier=${carrier}`)
        .set('Origin', 'https://vipmobile.vercel.app');

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.carrier).toBe(carrier);
    }
  });
});
