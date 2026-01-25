/**
 * 직영점 모드 DAL 라우트
 * 
 * DAL(Data Access Layer)을 사용하여 Supabase/Google Sheets를 자동 전환합니다.
 * Feature Flag(USE_DB_DIRECT_STORE)에 따라 데이터 소스가 결정됩니다.
 */

const express = require('express');
const router = express.Router();
const dalFactory = require('../dal/DALFactory');

// ============================================================================
// 1. 오늘의 휴대폰 API (읽기/쓰기)
// ============================================================================

/**
 * GET /api/direct-dal/todays-mobiles
 * 오늘의 휴대폰 목록 조회
 */
router.get('/todays-mobiles', async (req, res) => {
  try {
    const directDAL = dalFactory.getDAL('direct-store');
    
    // DAL을 통해 데이터 조회 (Feature Flag에 따라 자동 전환)
    const rows = await directDAL.read('direct_store_todays_mobiles');
    
    // 데이터 변환
    const mobiles = rows.map(row => ({
      id: row.id,
      modelName: row.모델명 || '',
      petName: row.펫네임 || '',
      carrier: row.통신사 || '',
      factoryPrice: row.출고가 || 0,
      carrierSubsidy: row.이통사지원금 || 0,
      dealerSubsidyWithAddon: row['대리점지원금(부가유치)'] || 0,
      dealerSubsidyWithoutAddon: row['대리점지원금(부가미유치)'] || 0,
      imageUrl: row.이미지 || '',
      requiredAddon: row.필수부가서비스 || '',
      isPopular: row.인기 || false,
      isRecommended: row.추천 || false,
      isCheap: row.저렴 || false,
      isPremium: row.프리미엄 || false,
      isBudget: row.알뜰 || false,
      updatedAt: row.updated_at
    }));
    
    res.json({ success: true, data: mobiles });
  } catch (error) {
    console.error('[DirectDAL] 오늘의 휴대폰 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/direct-dal/mobiles/:modelId/tags
 * 휴대폰 태그 업데이트
 */
router.put('/mobiles/:modelId/tags', async (req, res) => {
  try {
    const { modelId } = req.params;
    const { tags } = req.body;
    
    if (!tags) {
      return res.status(400).json({ success: false, error: '태그 데이터가 필요합니다.' });
    }
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 1. 해당 모델 찾기 (모델ID 또는 모델명으로 조회)
    const rows = await directDAL.read('direct_store_todays_mobiles');
    const mobile = rows.find(row => 
      row.모델ID === modelId || 
      row.모델명 === modelId ||
      row.id === parseInt(modelId)
    );
    
    if (!mobile) {
      return res.status(404).json({ success: false, error: '모델을 찾을 수 없습니다.' });
    }
    
    // 2. 태그 업데이트 (ID 기반)
    await directDAL.update('direct_store_todays_mobiles', mobile.id, {
      인기: tags.isPopular !== undefined ? tags.isPopular : mobile.인기,
      추천: tags.isRecommended !== undefined ? tags.isRecommended : mobile.추천,
      저렴: tags.isCheap !== undefined ? tags.isCheap : mobile.저렴,
      프리미엄: tags.isPremium !== undefined ? tags.isPremium : mobile.프리미엄,
      알뜰: tags.isBudget !== undefined ? tags.isBudget : mobile.알뜰
    });
    
    res.json({ success: true, message: '태그가 업데이트되었습니다.' });
  } catch (error) {
    console.error('[DirectDAL] 태그 업데이트 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. 메인 페이지 문구 API (읽기/쓰기)
// ============================================================================

/**
 * GET /api/direct-dal/main-page-texts
 * 메인 페이지 문구 조회
 */
router.get('/main-page-texts', async (req, res) => {
  try {
    const directDAL = dalFactory.getDAL('direct-store');
    
    const rows = await directDAL.read('direct_store_main_page_texts');
    
    const texts = rows.map(row => ({
      id: row.id,
      carrier: row.통신사 || '',
      category: row.카테고리 || '',
      textType: row.설정유형 || '',
      content: row.문구내용 || '',
      imageUrl: row.이미지URL || '',
      updatedAt: row.수정일시 || row.updated_at
    }));
    
    res.json({ success: true, data: texts });
  } catch (error) {
    console.error('[DirectDAL] 메인 페이지 문구 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/direct-dal/main-page-texts
 * 메인 페이지 문구 저장/업데이트
 */
router.post('/main-page-texts', async (req, res) => {
  try {
    const { carrier, category, textType, content, imageUrl } = req.body;
    
    if (!textType || !content) {
      return res.status(400).json({ success: false, error: '설정유형과 문구내용은 필수입니다.' });
    }
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 1. 기존 데이터 확인
    const rows = await directDAL.read('direct_store_main_page_texts');
    const existing = rows.find(row => 
      row.통신사 === (carrier || '') &&
      row.카테고리 === (category || '') &&
      row.설정유형 === textType
    );
    
    if (existing) {
      // 2-1. 업데이트
      await directDAL.update('direct_store_main_page_texts', existing.id, {
        문구내용: content,
        이미지URL: imageUrl || '',
        수정일시: new Date().toISOString()
      });
      
      res.json({ success: true, message: '문구가 업데이트되었습니다.', id: existing.id });
    } else {
      // 2-2. 생성
      const result = await directDAL.create('direct_store_main_page_texts', {
        통신사: carrier || '',
        카테고리: category || '',
        설정유형: textType,
        문구내용: content,
        이미지URL: imageUrl || '',
        수정일시: new Date().toISOString()
      });
      
      res.json({ success: true, message: '문구가 생성되었습니다.', id: result.id });
    }
  } catch (error) {
    console.error('[DirectDAL] 메인 페이지 문구 저장 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3. 대중교통 위치 API (CRUD)
// ============================================================================

/**
 * GET /api/direct-dal/transit-location/all
 * 모든 대중교통 위치 조회
 */
router.get('/transit-location/all', async (req, res) => {
  try {
    const directDAL = dalFactory.getDAL('direct-store');
    
    const rows = await directDAL.read('direct_store_transit_locations');
    
    const locations = rows.map(row => ({
      id: row.ID || row.id,
      type: row.타입 || '',
      name: row.이름 || '',
      address: row.주소 || '',
      latitude: row.위도 || 0,
      longitude: row.경도 || 0,
      updatedAt: row.수정일시 || row.updated_at
    }));
    
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('[DirectDAL] 대중교통 위치 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/direct-dal/transit-location/create
 * 대중교통 위치 생성
 */
router.post('/transit-location/create', async (req, res) => {
  try {
    const { type, name, address, latitude, longitude } = req.body;
    
    if (!type || !name || !address) {
      return res.status(400).json({ success: false, error: '타입, 이름, 주소는 필수입니다.' });
    }
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 고유 ID 생성
    const uniqueId = `TL_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const result = await directDAL.create('direct_store_transit_locations', {
      ID: uniqueId,
      타입: type,
      이름: name,
      주소: address,
      위도: latitude || 0,
      경도: longitude || 0,
      수정일시: new Date().toISOString()
    });
    
    res.json({ success: true, message: '대중교통 위치가 생성되었습니다.', id: result.id, uniqueId });
  } catch (error) {
    console.error('[DirectDAL] 대중교통 위치 생성 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/direct-dal/transit-location/:id
 * 대중교통 위치 수정
 */
router.put('/transit-location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, name, address, latitude, longitude } = req.body;
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 1. 기존 데이터 확인
    const rows = await directDAL.read('direct_store_transit_locations');
    const existing = rows.find(row => row.ID === id || row.id === parseInt(id));
    
    if (!existing) {
      return res.status(404).json({ success: false, error: '대중교통 위치를 찾을 수 없습니다.' });
    }
    
    // 2. 업데이트
    await directDAL.update('direct_store_transit_locations', existing.id, {
      타입: type !== undefined ? type : existing.타입,
      이름: name !== undefined ? name : existing.이름,
      주소: address !== undefined ? address : existing.주소,
      위도: latitude !== undefined ? latitude : existing.위도,
      경도: longitude !== undefined ? longitude : existing.경도,
      수정일시: new Date().toISOString()
    });
    
    res.json({ success: true, message: '대중교통 위치가 수정되었습니다.' });
  } catch (error) {
    console.error('[DirectDAL] 대중교통 위치 수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/direct-dal/transit-location/:id
 * 대중교통 위치 삭제
 */
router.delete('/transit-location/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 1. 기존 데이터 확인
    const rows = await directDAL.read('direct_store_transit_locations');
    const existing = rows.find(row => row.ID === id || row.id === parseInt(id));
    
    if (!existing) {
      return res.status(404).json({ success: false, error: '대중교통 위치를 찾을 수 없습니다.' });
    }
    
    // 2. 삭제
    await directDAL.delete('direct_store_transit_locations', existing.id);
    
    res.json({ success: true, message: '대중교통 위치가 삭제되었습니다.' });
  } catch (error) {
    console.error('[DirectDAL] 대중교통 위치 삭제 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 4. 정책 설정 API (읽기/쓰기)
// ============================================================================

/**
 * GET /api/direct-dal/policy-settings?carrier=SK
 * 정책 설정 조회
 */
router.get('/policy-settings', async (req, res) => {
  try {
    const carrier = req.query.carrier || 'SK';
    
    const directDAL = dalFactory.getDAL('direct-store');
    
    // 1. 마진 설정
    const marginRows = await directDAL.read('direct_store_policy_margin');
    const marginRow = marginRows.find(row => row.통신사 === carrier);
    const baseMargin = marginRow ? (marginRow.마진 || 0) : 0;
    
    // 2. 부가서비스 설정
    const addonRows = await directDAL.read('direct_store_policy_addon_services');
    const addonList = addonRows
      .filter(row => row.통신사 === carrier)
      .map(row => ({
        name: row.서비스명 || '',
        fee: row.월요금 || 0,
        incentive: row.유치추가금액 || 0,
        deduction: -(Math.abs(row.미유치차감금액 || 0))
      }));
    
    // 3. 보험상품 설정
    const insuranceRows = await directDAL.read('direct_store_policy_insurance');
    const insuranceList = insuranceRows
      .filter(row => row.통신사 === carrier)
      .map(row => ({
        name: row.보험상품명 || '',
        minPrice: row.출고가최소 || 0,
        maxPrice: row.출고가최대 || 0,
        fee: row.월요금 || 0,
        incentive: row.유치추가금액 || 0,
        deduction: -(Math.abs(row.미유치차감금액 || 0))
      }));
    
    // 4. 별도 정책
    const specialRows = await directDAL.read('direct_store_policy_special');
    const specialPolicies = specialRows
      .filter(row => row.통신사 === carrier && row.적용여부 === true)
      .map(row => ({
        name: row.정책명 || '',
        type: row.정책타입 || '',
        amount: row.금액 || 0,
        conditions: row.조건JSON ? JSON.parse(row.조건JSON) : null
      }));
    
    res.json({
      success: true,
      data: {
        baseMargin,
        addonList,
        insuranceList,
        specialPolicies
      }
    });
  } catch (error) {
    console.error('[DirectDAL] 정책 설정 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 5. DAL 상태 확인 API (디버깅용)
// ============================================================================

/**
 * GET /api/direct-dal/status
 * DAL 상태 및 Feature Flag 확인
 */
router.get('/status', async (req, res) => {
  try {
    const status = dalFactory.getStatus();
    const directDAL = dalFactory.getDAL('direct-store');
    
    res.json({
      success: true,
      data: {
        ...status,
        currentMode: 'direct-store',
        usingDatabase: status.featureFlags['direct-store'],
        dalInitialized: true
      }
    });
  } catch (error) {
    console.error('[DirectDAL] 상태 확인 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
