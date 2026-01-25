/**
 * DirectStoreDAL - 직영점 모드 전용 DAL 헬퍼
 * 
 * 직영점 모드의 복잡한 비즈니스 로직을 DAL로 전환하기 위한 헬퍼 함수들
 */

const dalFactory = require('./DALFactory');

class DirectStoreDAL {
  constructor() {
    this.dal = dalFactory.getDAL('direct-store');
  }

  /**
   * 대중교통 위치 전체 조회
   */
  async getAllTransitLocations() {
    try {
      const data = await this.dal.read('direct_store_transit_locations');
      return data.map(row => ({
        id: row.id,
        type: row['타입'],
        name: row['이름'],
        address: row['주소'],
        latitude: parseFloat(row['위도']),
        longitude: parseFloat(row['경도']),
        updatedAt: row['수정일시']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 대중교통 위치 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 메인 페이지 문구 조회
   */
  async getMainPageTexts(carrier = null) {
    try {
      const filters = carrier ? { '통신사': carrier } : {};
      const data = await this.dal.read('direct_store_main_page_texts', filters);
      
      return data.map(row => ({
        carrier: row['통신사'],
        category: row['카테고리'],
        type: row['설정유형'],
        content: row['문구내용'],
        imageUrl: row['이미지URL'],
        updatedAt: row['수정일시']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 메인 페이지 문구 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 정책 마진 조회
   */
  async getPolicyMargin(carrier) {
    try {
      const data = await this.dal.read('direct_store_policy_margin', { '통신사': carrier });
      
      if (data.length === 0) {
        return null;
      }
      
      return {
        carrier: data[0]['통신사'],
        margin: parseInt(data[0]['마진']) || 0
      };
    } catch (error) {
      console.error('[DirectStoreDAL] 정책 마진 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 부가서비스 정책 조회
   */
  async getPolicyAddonServices(carrier) {
    try {
      const data = await this.dal.read('direct_store_policy_addon_services', { '통신사': carrier });
      
      return data.map(row => ({
        carrier: row['통신사'],
        serviceName: row['서비스명'],
        monthlyFee: parseInt(row['월요금']) || 0,
        attractionBonus: parseInt(row['유치추가금액']) || 0,
        noAttractionDeduction: parseInt(row['미유치차감금액']) || 0,
        description: row['상세설명'],
        officialUrl: row['공식사이트URL']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 부가서비스 정책 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 보험상품 정책 조회
   */
  async getPolicyInsurance(carrier) {
    try {
      const data = await this.dal.read('direct_store_policy_insurance', { '통신사': carrier });
      
      return data.map(row => ({
        carrier: row['통신사'],
        productName: row['보험상품명'],
        minPrice: parseInt(row['출고가최소']) || 0,
        maxPrice: parseInt(row['출고가최대']) || 0,
        monthlyFee: parseInt(row['월요금']) || 0,
        attractionBonus: parseInt(row['유치추가금액']) || 0,
        noAttractionDeduction: parseInt(row['미유치차감금액']) || 0,
        description: row['상세설명'],
        officialUrl: row['공식사이트URL']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 보험상품 정책 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특별 정책 조회
   */
  async getPolicySpecial(carrier) {
    try {
      const data = await this.dal.read('direct_store_policy_special', { '통신사': carrier });
      
      return data.map(row => {
        let conditionJson = null;
        try {
          conditionJson = row['조건JSON'] ? JSON.parse(row['조건JSON']) : null;
        } catch (e) {
          console.warn('[DirectStoreDAL] 조건JSON 파싱 실패:', row['조건JSON']);
        }
        
        return {
          carrier: row['통신사'],
          policyName: row['정책명'],
          policyType: row['정책타입'],
          amount: parseInt(row['금액']) || 0,
          isActive: row['적용여부'] === 'TRUE' || row['적용여부'] === true,
          condition: conditionJson
        };
      });
    } catch (error) {
      console.error('[DirectStoreDAL] 특별 정책 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 설정 조회
   */
  async getSettings(carrier, settingType = null) {
    try {
      const filters = { '통신사': carrier };
      if (settingType) {
        filters['설정유형'] = settingType;
      }
      
      const data = await this.dal.read('direct_store_settings', filters);
      
      return data.map(row => {
        let settingsJson = null;
        try {
          settingsJson = row['설정값JSON'] ? JSON.parse(row['설정값JSON']) : null;
        } catch (e) {
          console.warn('[DirectStoreDAL] 설정값JSON 파싱 실패:', row['설정값JSON']);
        }
        
        return {
          carrier: row['통신사'],
          settingType: row['설정유형'],
          sheetId: row['시트ID'],
          sheetUrl: row['시트URL'],
          settings: settingsJson
        };
      });
    } catch (error) {
      console.error('[DirectStoreDAL] 설정 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 요금제 마스터 조회
   */
  async getPlanMaster(carrier, planGroup = null) {
    try {
      const filters = { '통신사': carrier };
      if (planGroup) {
        filters['요금제군'] = planGroup;
      }
      
      const data = await this.dal.read('direct_store_plan_master', filters);
      
      return data.map(row => ({
        carrier: row['통신사'],
        planName: row['요금제명'],
        planGroup: row['요금제군'],
        basicFee: parseInt(row['기본료']) || 0,
        planCode: row['요금제코드'],
        isActive: row['사용여부'] === 'Y',
        note: row['비고']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 요금제 마스터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 마스터 조회
   */
  async getDeviceMaster(carrier, modelId = null) {
    try {
      const filters = { '통신사': carrier };
      if (modelId) {
        filters['모델ID'] = modelId;
      }
      
      const data = await this.dal.read('direct_store_device_master', filters);
      
      return data.map(row => ({
        carrier: row['통신사'],
        modelId: row['모델ID'],
        modelName: row['모델명'],
        petName: row['펫네임'],
        manufacturer: row['제조사'],
        factoryPrice: parseInt(row['출고가']) || 0,
        defaultPlanGroup: row['기본요금제군'],
        isPremium: row['isPremium'] === 'Y',
        isBudget: row['isBudget'] === 'Y',
        isPopular: row['isPopular'] === 'Y',
        isRecommended: row['isRecommended'] === 'Y',
        isCheap: row['isCheap'] === 'Y',
        imageUrl: row['이미지URL'],
        isActive: row['사용여부'] === 'Y',
        note: row['비고'],
        discordMessageId: row['Discord메시지ID'],
        discordPostId: row['Discord포스트ID'],
        discordThreadId: row['Discord스레드ID']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 마스터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 모델 이미지 조회
   */
  async getModelImages(carrier, modelId = null) {
    try {
      const filters = { '통신사': carrier };
      if (modelId) {
        filters['모델ID'] = modelId;
      }
      
      const data = await this.dal.read('direct_store_model_images', filters);
      
      return data.map(row => ({
        carrier: row['통신사'],
        modelId: row['모델ID'],
        modelName: row['모델명'],
        petName: row['펫네임'],
        manufacturer: row['제조사'],
        imageUrl: row['이미지URL'],
        note: row['비고'],
        color: row['색상'],
        discordMessageId: row['Discord메시지ID'],
        discordPostId: row['Discord포스트ID'],
        discordThreadId: row['Discord스레드ID']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 모델 이미지 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 휴대폰 조회
   */
  async getTodaysMobiles(carrier = null) {
    try {
      const filters = carrier ? { '통신사': carrier } : {};
      const data = await this.dal.read('direct_store_todays_mobiles', filters);
      
      return data.map(row => ({
        modelName: row['모델명'],
        petName: row['펫네임'],
        carrier: row['통신사'],
        modelId: row['모델ID'],
        factoryPrice: parseInt(row['출고가']) || 0,
        publicSupport: parseInt(row['이통사지원금']) || 0,
        storeSupportWithAddon: parseInt(row['대리점지원금(부가유치)']) || 0,
        storeSupportNoAddon: parseInt(row['대리점지원금(부가미유치)']) || 0,
        imageUrl: row['이미지'],
        requiredAddons: row['필수부가서비스'],
        isPopular: row['인기'] === 'Y' || row['인기'] === true,
        isRecommended: row['추천'] === 'Y' || row['추천'] === true,
        isCheap: row['저렴'] === 'Y' || row['저렴'] === true,
        isPremium: row['프리미엄'] === 'Y' || row['프리미엄'] === true,
        isBudget: row['중저가'] === 'Y' || row['중저가'] === true
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 오늘의 휴대폰 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 요금 정책 조회
   */
  async getDevicePricingPolicy(carrier, modelId = null, planGroup = null) {
    try {
      const filters = { '통신사': carrier };
      if (modelId) {
        filters['모델ID'] = modelId;
      }
      if (planGroup) {
        filters['요금제군'] = planGroup;
      }
      
      const data = await this.dal.read('direct_store_device_pricing_policy', filters);
      
      return data.map(row => ({
        carrier: row['통신사'],
        modelId: row['모델ID'],
        modelName: row['모델명'],
        planGroup: row['요금제군'],
        planCode: row['요금제코드'],
        openingType: row['개통유형'],
        factoryPrice: parseInt(row['출고가']) || 0,
        publicSupport: parseInt(row['이통사지원금']) || 0,
        storeAdditionalSupportWithAddon: parseInt(row['대리점추가지원금_부가유치']) || 0,
        policyMargin: parseInt(row['정책마진']) || 0,
        policyId: row['정책ID'],
        baseDate: row['기준일자'],
        note: row['비고']
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 요금 정책 조회 실패:', error);
      throw error;
    }
  }

  // ==================== 쓰기/수정/삭제 메서드 ====================

  /**
   * 대중교통 위치 생성
   */
  async createTransitLocation(data) {
    try {
      const record = {
        id: data.id,
        '타입': data.type,
        '이름': data.name,
        '주소': data.address,
        '위도': data.latitude,
        '경도': data.longitude,
        '수정일시': new Date().toISOString()
      };
      
      await this.dal.create('direct_store_transit_locations', record);
      return { success: true, id: data.id };
    } catch (error) {
      console.error('[DirectStoreDAL] 대중교통 위치 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 대중교통 위치 수정
   */
  async updateTransitLocation(id, data) {
    try {
      const updates = {
        '수정일시': new Date().toISOString()
      };
      
      if (data.type) updates['타입'] = data.type;
      if (data.name) updates['이름'] = data.name;
      if (data.address) updates['주소'] = data.address;
      if (data.latitude !== undefined) updates['위도'] = data.latitude;
      if (data.longitude !== undefined) updates['경도'] = data.longitude;
      
      await this.dal.update('direct_store_transit_locations', { id }, updates);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 대중교통 위치 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 대중교통 위치 삭제
   */
  async deleteTransitLocation(id) {
    try {
      await this.dal.delete('direct_store_transit_locations', { id });
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 대중교통 위치 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 휴대폰 태그 업데이트
   */
  async updateTodaysMobileTags(modelName, carrier, tags) {
    try {
      const filters = {
        '모델명': modelName,
        '통신사': carrier
      };
      
      // 기존 데이터 확인
      const existing = await this.dal.read('direct_store_todays_mobiles', filters);
      
      const updates = {
        '인기': tags.isPopular ? 'Y' : 'N',
        '추천': tags.isRecommended ? 'Y' : 'N',
        '저렴': tags.isCheap ? 'Y' : 'N',
        '프리미엄': tags.isPremium ? 'Y' : 'N',
        '중저가': tags.isBudget ? 'Y' : 'N'
      };
      
      if (existing.length > 0) {
        // 업데이트
        await this.dal.update('direct_store_todays_mobiles', filters, updates);
      } else {
        // 새로 생성
        const record = {
          '모델명': modelName,
          '펫네임': tags.petName || '',
          '통신사': carrier,
          '모델ID': tags.modelId || '',
          '출고가': tags.factoryPrice || 0,
          '이통사지원금': tags.publicSupport || 0,
          '대리점지원금(부가유치)': tags.storeSupportWithAddon || 0,
          '대리점지원금(부가미유치)': tags.storeSupportNoAddon || 0,
          '이미지': tags.imageUrl || '',
          '필수부가서비스': tags.requiredAddons || '',
          ...updates
        };
        await this.dal.create('direct_store_todays_mobiles', record);
      }
      
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 오늘의 휴대폰 태그 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 휴대폰 삭제 (모든 태그가 false일 때)
   */
  async deleteTodaysMobile(modelName, carrier) {
    try {
      await this.dal.delete('direct_store_todays_mobiles', {
        '모델명': modelName,
        '통신사': carrier
      });
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 오늘의 휴대폰 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 마스터 태그 업데이트
   */
  async updateDeviceMasterTags(modelId, carrier, tags) {
    try {
      const updates = {};
      
      if (tags.isPremium !== undefined) updates['isPremium'] = tags.isPremium ? 'Y' : 'N';
      if (tags.isBudget !== undefined) updates['isBudget'] = tags.isBudget ? 'Y' : 'N';
      if (tags.isPopular !== undefined) updates['isPopular'] = tags.isPopular ? 'Y' : 'N';
      if (tags.isRecommended !== undefined) updates['isRecommended'] = tags.isRecommended ? 'Y' : 'N';
      if (tags.isCheap !== undefined) updates['isCheap'] = tags.isCheap ? 'Y' : 'N';
      
      await this.dal.update('direct_store_device_master', {
        '모델ID': modelId,
        '통신사': carrier
      }, updates);
      
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 마스터 태그 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 판매 일보 생성
   */
  async createSalesDaily(data) {
    try {
      const record = {
        '번호': data.id || `sales-${Date.now()}`,
        'POS코드': data.posCode || '',
        '업체명': data.storeName || '',
        '매장ID': data.storeId || '',
        '판매일시': data.saleDate || new Date().toISOString(),
        '고객명': data.customerName || '',
        'CTN': data.ctn || '',
        '통신사': data.carrier || '',
        '단말기모델명': data.modelName || '',
        '색상': data.color || '',
        '단말일련번호': data.serialNumber || '',
        '개통유형': data.openingType || '',
        '요금제명': data.planName || '',
        '요금제군': data.planGroup || '',
        '기본료': data.basicFee || 0,
        '출고가': data.factoryPrice || 0,
        '이통사지원금': data.publicSupport || 0,
        '대리점지원금': data.storeSupport || 0,
        '고객부담금': data.customerPayment || 0,
        '할부개월': data.installmentMonths || 0,
        '월할부금': data.monthlyInstallment || 0,
        '부가서비스': data.addonServices || '',
        '보험상품': data.insurance || '',
        '판매자': data.seller || '',
        '비고': data.note || '',
        '등록일시': new Date().toISOString()
      };
      
      await this.dal.create('direct_store_sales_daily', record);
      return { success: true, id: record['번호'] };
    } catch (error) {
      console.error('[DirectStoreDAL] 판매 일보 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 메인 페이지 문구 업데이트
   */
  async updateMainPageText(carrier, category, type, data) {
    try {
      const filters = {
        '통신사': carrier || '',
        '카테고리': category || '',
        '설정유형': type
      };
      
      const updates = {
        '문구내용': data.content || '',
        '이미지URL': data.imageUrl || '',
        '수정일시': new Date().toISOString()
      };
      
      // 기존 데이터 확인
      const existing = await this.dal.read('direct_store_main_page_texts', filters);
      
      if (existing.length > 0) {
        await this.dal.update('direct_store_main_page_texts', filters, updates);
      } else {
        await this.dal.create('direct_store_main_page_texts', { ...filters, ...updates });
      }
      
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 메인 페이지 문구 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 매장 사진 업데이트
   */
  async updateStorePhoto(storeName, photoType, data) {
    try {
      const filters = { '업체명': storeName };
      
      // 기존 데이터 확인
      const existing = await this.dal.read('direct_store_photos', filters);
      
      const updates = {};
      
      // photoType에 따라 업데이트할 필드 결정
      if (photoType === 'front') {
        updates['전면사진URL'] = data.url || '';
        updates['전면사진Discord메시지ID'] = data.discordMessageId || '';
        updates['전면사진Discord포스트ID'] = data.discordPostId || '';
        updates['전면사진Discord스레드ID'] = data.discordThreadId || '';
      } else if (photoType === 'interior') {
        updates['내부사진URL'] = data.url || '';
        updates['내부사진Discord메시지ID'] = data.discordMessageId || '';
        updates['내부사진Discord포스트ID'] = data.discordPostId || '';
        updates['내부사진Discord스레드ID'] = data.discordThreadId || '';
      } else if (photoType === 'exterior') {
        updates['외부사진URL'] = data.url || '';
        updates['외부사진Discord메시지ID'] = data.discordMessageId || '';
        updates['외부사진Discord포스트ID'] = data.discordPostId || '';
        updates['외부사진Discord스레드ID'] = data.discordThreadId || '';
      }
      
      if (existing.length > 0) {
        await this.dal.update('direct_store_photos', filters, updates);
      } else {
        await this.dal.create('direct_store_photos', { ...filters, ...updates });
      }
      
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 매장 사진 업데이트 실패:', error);
      throw error;
    }
  }
}

module.exports = new DirectStoreDAL();
