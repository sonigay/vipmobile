/**
 * Direct Store API 엔드포인트 단위 테스트
 * 
 * Phase 2-3에서 추가된 API 엔드포인트 테스트
 */

const request = require('supertest');
const express = require('express');

// Express 앱 설정 (테스트용)
const app = express();
app.use(express.json());

// directRoutes 로드
const directRoutes = require('../directRoutes');
app.use('/api/direct', directRoutes);

describe('Direct Store API Endpoints - Phase 2-3', () => {
  
  describe('정책 설정 API', () => {
    test('DELETE /api/direct/policy-settings/margin/:carrier', async () => {
      const response = await request(app)
        .delete('/api/direct/policy-settings/margin/TEST')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('DELETE /api/direct/policy-settings/addon/:carrier', async () => {
      const response = await request(app)
        .delete('/api/direct/policy-settings/addon/TEST')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('DELETE /api/direct/policy-settings/insurance/:carrier', async () => {
      const response = await request(app)
        .delete('/api/direct/policy-settings/insurance/TEST')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('DELETE /api/direct/policy-settings/special/:carrier', async () => {
      const response = await request(app)
        .delete('/api/direct/policy-settings/special/TEST')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('링크 설정 API', () => {
    test('DELETE /api/direct/link-settings/:carrier/:settingType', async () => {
      const response = await request(app)
        .delete('/api/direct/link-settings/TEST/TEST_TYPE')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('메인 페이지 문구 API', () => {
    test('DELETE /api/direct/main-page-text/:carrier', async () => {
      const response = await request(app)
        .delete('/api/direct/main-page-text/TEST')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('요금제 마스터 API', () => {
    const testPlan = {
      carrier: 'TEST',
      planName: 'TEST-PLAN',
      planCode: 'TEST-CODE',
      planGroup: 'TEST-GROUP',
      monthlyFee: 50000,
      dataAllowance: '100GB',
      voiceAllowance: '무제한',
      smsAllowance: '무제한',
      isActive: true
    };

    test('POST /api/direct/plans-master', async () => {
      const response = await request(app)
        .post('/api/direct/plans-master')
        .send(testPlan)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('PUT /api/direct/plans-master/:carrier/:planName', async () => {
      const response = await request(app)
        .put('/api/direct/plans-master/TEST/TEST-PLAN')
        .send({ monthlyFee: 60000 })
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('DELETE /api/direct/plans-master/:carrier/:planName', async () => {
      const response = await request(app)
        .delete('/api/direct/plans-master/TEST/TEST-PLAN')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('단말 마스터 API', () => {
    const testDevice = {
      carrier: 'TEST',
      modelId: 'TEST-MODEL',
      modelName: 'Test Device',
      petName: 'Test',
      manufacturer: 'Test Inc',
      factoryPrice: 1000000,
      defaultPlanGroup: '115군',
      isActive: true
    };

    test('POST /api/direct/mobiles-master', async () => {
      const response = await request(app)
        .post('/api/direct/mobiles-master')
        .send(testDevice)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('PUT /api/direct/mobiles-master/:carrier/:modelId', async () => {
      const response = await request(app)
        .put('/api/direct/mobiles-master/TEST/TEST-MODEL')
        .send({ factoryPrice: 1100000 })
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('DELETE /api/direct/mobiles-master/:carrier/:modelId', async () => {
      const response = await request(app)
        .delete('/api/direct/mobiles-master/TEST/TEST-MODEL')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('GET /api/direct/mobiles-master?carrier=LG', async () => {
      const response = await request(app)
        .get('/api/direct/mobiles-master?carrier=LG')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('단말 요금정책 API', () => {
    const testPricing = {
      carrier: 'TEST',
      modelId: 'TEST-MODEL',
      modelName: 'Test Device',
      planGroup: '115군',
      planCode: 'TEST-CODE',
      openingType: 'MNP',
      factoryPrice: 1000000,
      publicSupport: 500000,
      storeAdditionalSupportWithAddon: 100000,
      policyMargin: 50000,
      policyId: 'TEST-POLICY',
      baseDate: '2024-01-01',
      note: 'Test'
    };

    test('POST /api/direct/mobiles-pricing', async () => {
      const response = await request(app)
        .post('/api/direct/mobiles-pricing')
        .send(testPricing)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('PUT /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType', async () => {
      const response = await request(app)
        .put('/api/direct/mobiles-pricing/TEST/TEST-MODEL/115군/MNP')
        .send({ publicSupport: 600000 })
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('DELETE /api/direct/mobiles-pricing/:carrier/:modelId/:planGroup/:openingType', async () => {
      const response = await request(app)
        .delete('/api/direct/mobiles-pricing/TEST/TEST-MODEL/115군/MNP')
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('GET /api/direct/mobiles-pricing?carrier=LG', async () => {
      const response = await request(app)
        .get('/api/direct/mobiles-pricing?carrier=LG')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('오늘의 휴대폰 API', () => {
    const testMobile = {
      carrier: 'TEST',
      modelId: 'TEST-MODEL',
      modelName: 'Test Device',
      petName: 'Test',
      manufacturer: 'Test Inc',
      factoryPrice: 1000000,
      imageUrl: 'https://example.com/image.png',
      displayOrder: 1,
      isActive: true
    };

    test('POST /api/direct/todays-mobiles', async () => {
      const response = await request(app)
        .post('/api/direct/todays-mobiles')
        .send(testMobile)
        .expect('Content-Type', /json/);
      
      expect(response.status).toBeLessThan(500);
    });

    test('GET /api/direct/todays-mobiles', async () => {
      const response = await request(app)
        .get('/api/direct/todays-mobiles')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('premium');
      expect(response.body).toHaveProperty('budget');
      expect(Array.isArray(response.body.premium)).toBe(true);
      expect(Array.isArray(response.body.budget)).toBe(true);
    });
  });
});
