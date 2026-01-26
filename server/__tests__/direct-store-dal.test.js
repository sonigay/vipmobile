/**
 * DirectStoreDAL 단위 테스트
 * 
 * Phase 2-3에서 추가된 CRUD 메서드 테스트
 */

const DirectStoreDAL = require('../dal/DirectStoreDAL');

describe('DirectStoreDAL - Phase 2-3 CRUD Tests', () => {
  
  describe('정책 설정 API', () => {
    test('deletePolicyMargin - 정책 마진 삭제', async () => {
      const result = await DirectStoreDAL.deletePolicyMargin('TEST');
      expect(result).toHaveProperty('success', true);
    });

    test('deletePolicyAddonServices - 부가서비스 정책 삭제', async () => {
      const result = await DirectStoreDAL.deletePolicyAddonServices('TEST');
      expect(result).toHaveProperty('success', true);
    });

    test('deletePolicyInsurance - 보험상품 정책 삭제', async () => {
      const result = await DirectStoreDAL.deletePolicyInsurance('TEST');
      expect(result).toHaveProperty('success', true);
    });

    test('deletePolicySpecial - 특별 정책 삭제', async () => {
      const result = await DirectStoreDAL.deletePolicySpecial('TEST');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('링크 설정 API', () => {
    test('deleteLinkSettings - 링크 설정 삭제', async () => {
      const result = await DirectStoreDAL.deleteLinkSettings('TEST', 'TEST_TYPE');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('메인 페이지 문구 API', () => {
    test('deleteMainPageText - 메인 페이지 문구 삭제', async () => {
      const result = await DirectStoreDAL.deleteMainPageText('TEST');
      expect(result).toHaveProperty('success', true);
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

    test('createPlanMaster - 요금제 마스터 생성', async () => {
      const result = await DirectStoreDAL.createPlanMaster(testPlan);
      expect(result).toHaveProperty('success', true);
    });

    test('updatePlanMaster - 요금제 마스터 수정', async () => {
      const result = await DirectStoreDAL.updatePlanMaster('TEST', 'TEST-PLAN', {
        monthlyFee: 60000
      });
      expect(result).toHaveProperty('success', true);
    });

    test('deletePlanMaster - 요금제 마스터 삭제', async () => {
      const result = await DirectStoreDAL.deletePlanMaster('TEST', 'TEST-PLAN');
      expect(result).toHaveProperty('success', true);
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

    test('createDeviceMaster - 단말 마스터 생성', async () => {
      const result = await DirectStoreDAL.createDeviceMaster(testDevice);
      expect(result).toHaveProperty('success', true);
    });

    test('updateDeviceMaster - 단말 마스터 수정', async () => {
      const result = await DirectStoreDAL.updateDeviceMaster('TEST', 'TEST-MODEL', {
        factoryPrice: 1100000
      });
      expect(result).toHaveProperty('success', true);
    });

    test('deleteDeviceMaster - 단말 마스터 삭제', async () => {
      const result = await DirectStoreDAL.deleteDeviceMaster('TEST', 'TEST-MODEL');
      expect(result).toHaveProperty('success', true);
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

    test('createPricingMaster - 단말 요금정책 생성', async () => {
      const result = await DirectStoreDAL.createPricingMaster(testPricing);
      expect(result).toHaveProperty('success', true);
    });

    test('updatePricingMaster - 단말 요금정책 수정', async () => {
      const result = await DirectStoreDAL.updatePricingMaster(
        'TEST',
        'TEST-MODEL',
        '115군',
        'MNP',
        { publicSupport: 600000 }
      );
      expect(result).toHaveProperty('success', true);
    });

    test('deletePricingMaster - 단말 요금정책 삭제', async () => {
      const result = await DirectStoreDAL.deletePricingMaster(
        'TEST',
        'TEST-MODEL',
        '115군',
        'MNP'
      );
      expect(result).toHaveProperty('success', true);
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

    test('createTodaysMobile - 오늘의 휴대폰 생성', async () => {
      const result = await DirectStoreDAL.createTodaysMobile(testMobile);
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('시세표 조회 API', () => {
    test('getDevicePricingPolicy - 시세표 조회 (carrier만)', async () => {
      const result = await DirectStoreDAL.getDevicePricingPolicy('LG');
      expect(Array.isArray(result)).toBe(true);
    });

    test('getDevicePricingPolicy - 시세표 조회 (carrier + modelId)', async () => {
      const result = await DirectStoreDAL.getDevicePricingPolicy('LG', 'SM-S921');
      expect(Array.isArray(result)).toBe(true);
    });

    test('getDevicePricingPolicy - 시세표 조회 (carrier + planGroup)', async () => {
      const result = await DirectStoreDAL.getDevicePricingPolicy('LG', null, '115군');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('시세표 마스터 조회 API', () => {
    test('getDeviceMaster - 단말 마스터 조회 (carrier만)', async () => {
      const result = await DirectStoreDAL.getDeviceMaster('LG');
      expect(Array.isArray(result)).toBe(true);
    });

    test('getDeviceMaster - 단말 마스터 조회 (carrier + modelId)', async () => {
      const result = await DirectStoreDAL.getDeviceMaster('LG', 'SM-S921');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
