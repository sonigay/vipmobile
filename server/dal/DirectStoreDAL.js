/**
 * DirectStoreDAL - 직영점 모드 전용 DAL 헬퍼
 * 
 * 직영점 모드의 복잡한 비즈니스 로직을 DAL로 전환하기 위한 헬퍼 함수들
 */

const dalFactory = require('./DALFactory');
const { supabase } = require('../supabaseClient');

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
        id: data[0].id,
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
        id: row.id,
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
        id: row.id,
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
          const raw = row['조건JSON'];
          if (raw && typeof raw === 'object') {
            conditionJson = raw;
          } else if (raw && typeof raw === 'string') {
            conditionJson = JSON.parse(raw);
          }
        } catch (e) {
          console.warn('[DirectStoreDAL] 조건JSON 파싱 실패:', row['조건JSON']);
        }

        console.log(`[DirectStoreDAL] 특별 정책 레코드 변환 (${carrier}): id=${row.id}, name=${row['정책명']}`);

        return {
          id: row.id,
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
          const raw = row['설정값JSON'];
          if (raw && typeof raw === 'object') {
            settingsJson = raw;
          } else if (raw && typeof raw === 'string') {
            settingsJson = JSON.parse(raw);
          }
        } catch (e) {
          console.warn('[DirectStoreDAL] 설정값JSON 파싱 실패:', row['설정값JSON']);
        }

        return {
          id: row.id,
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
   * 요금제 마스터 생성
   * @param {Object} data - 요금제 데이터
   * @param {string} data.carrier - 통신사 (SK/KT/LG)
   * @param {string} data.planName - 요금제명
   * @param {string} data.planGroup - 요금제군
   * @param {number} data.basicFee - 기본료
   * @param {string} data.planCode - 요금제코드
   * @param {boolean} data.isActive - 사용여부
   * @param {string} data.note - 비고
   */
  async createPlanMaster(data) {
    try {
      const record = {
        '통신사': data.carrier,
        '요금제명': data.planName,
        '요금제군': data.planGroup,
        '기본료': data.basicFee,
        '요금제코드': data.planCode || '',
        '사용여부': data.isActive ? 'Y' : 'N',
        '비고': data.note || ''
      };

      await this.dal.create('direct_store_plan_master', record);
      console.log(`[DirectStoreDAL] 요금제 마스터 생성 완료: ${data.carrier} - ${data.planName}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 요금제 마스터 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 요금제 마스터 수정
   * @param {string} carrier - 통신사
   * @param {string} planName - 요금제명
   * @param {Object} updates - 수정할 데이터
   */
  async updatePlanMaster(carrier, planName, updates) {
    try {
      // 🔥 복합 키 사용: Supabase 직접 사용
      const { supabase } = require('../supabaseClient');

      const record = {};
      if (updates.planGroup !== undefined) record['요금제군'] = updates.planGroup;
      if (updates.basicFee !== undefined) record['기본료'] = updates.basicFee;
      if (updates.planCode !== undefined) record['요금제코드'] = updates.planCode;
      if (updates.isActive !== undefined) record['사용여부'] = updates.isActive ? 'Y' : 'N';
      if (updates.note !== undefined) record['비고'] = updates.note;

      const { data, error } = await supabase
        .from('direct_store_plan_master')
        .update(record)
        .eq('통신사', carrier)
        .eq('요금제명', planName)
        .select();

      if (error) {
        throw new Error(`DB Update Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 요금제 마스터 수정 완료: ${carrier} - ${planName}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 요금제 마스터 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 요금제 마스터 삭제
   * @param {string} carrier - 통신사
   * @param {string} planName - 요금제명
   */
  async deletePlanMaster(carrier, planName) {
    try {
      // 🔥 복합 키 사용: Supabase 직접 사용
      const { supabase } = require('../supabaseClient');

      const { data, error } = await supabase
        .from('direct_store_plan_master')
        .delete()
        .eq('통신사', carrier)
        .eq('요금제명', planName)
        .select();

      if (error) {
        throw new Error(`DB Delete Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 요금제 마스터 삭제 완료: ${carrier} - ${planName}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 요금제 마스터 삭제 실패:', error);
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
        id: row.id, // UUID 추가
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
   * 오늘의 휴대폰 생성
   */
  async createTodaysMobile(mobileData) {
    try {
      const record = {
        '통신사': mobileData.carrier,
        '모델ID': mobileData.modelId || '',
        '모델명': mobileData.modelName,
        '펫네임': mobileData.petName || '',
        '제조사': mobileData.manufacturer || '',
        '출고가': mobileData.factoryPrice || 0,
        '이미지URL': mobileData.imageUrl || '',
        '순서': mobileData.displayOrder || 0,
        '표시여부': mobileData.isActive !== false,
        '등록일시': new Date().toISOString()
      };

      await this.dal.create('direct_store_todays_mobiles', record);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 오늘의 휴대폰 생성 실패:', error);
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

  /**
   * 매장별 대중교통 위치 조회
   */
  async getStoreTransitLocations(storeName) {
    try {
      const data = await this.dal.read('direct_store_photos', { '업체명': storeName });

      if (data.length === 0) {
        return {
          storeName,
          busTerminalIds: [],
          subwayStationIds: []
        };
      }

      const row = data[0];
      let busTerminalIds = [];
      let subwayStationIds = [];

      try {
        busTerminalIds = row['버스터미널ID목록'] ? JSON.parse(row['버스터미널ID목록']) : [];
      } catch (e) {
        console.warn('[DirectStoreDAL] 버스터미널ID목록 파싱 실패:', row['버스터미널ID목록']);
      }

      try {
        subwayStationIds = row['지하철역ID목록'] ? JSON.parse(row['지하철역ID목록']) : [];
      } catch (e) {
        console.warn('[DirectStoreDAL] 지하철역ID목록 파싱 실패:', row['지하철역ID목록']);
      }

      return {
        storeName,
        busTerminalIds: Array.isArray(busTerminalIds) ? busTerminalIds : [],
        subwayStationIds: Array.isArray(subwayStationIds) ? subwayStationIds : []
      };
    } catch (error) {
      console.error('[DirectStoreDAL] 매장별 대중교통 위치 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매장별 대중교통 위치 업데이트
   */
  async updateStoreTransitLocations(storeName, busTerminalIds, subwayStationIds) {
    try {
      const filters = { '업체명': storeName };

      // 기존 데이터 확인
      const existing = await this.dal.read('direct_store_photos', filters);

      const updates = {
        '버스터미널ID목록': JSON.stringify(Array.isArray(busTerminalIds) ? busTerminalIds : []),
        '지하철역ID목록': JSON.stringify(Array.isArray(subwayStationIds) ? subwayStationIds : []),
        '수정일시': new Date().toISOString()
      };

      if (existing.length > 0) {
        await this.dal.update('direct_store_photos', filters, updates);
      } else {
        await this.dal.create('direct_store_photos', { ...filters, ...updates });
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 매장별 대중교통 위치 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 정책 마진 업데이트
   */
  async updatePolicyMargin(carrier, margin) {
    try {
      const filters = { '통신사': carrier };

      // 기존 데이터 확인
      const existing = await this.dal.read('direct_store_policy_margin', filters);

      const updates = {
        '마진': margin
      };

      if (existing.length > 0) {
        await this.dal.update('direct_store_policy_margin', filters, updates);
      } else {
        await this.dal.create('direct_store_policy_margin', { ...filters, ...updates });
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 정책 마진 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 부가서비스 정책 업데이트 (전체 교체)
   */
  async updatePolicyAddonServices(carrier, services) {
    try {
      // 1. 기존 데이터 삭제
      await this.dal.delete('direct_store_policy_addon_services', { '통신사': carrier });

      // 2. 새 데이터 삽입
      for (const service of services) {
        const record = {
          '통신사': carrier,
          '서비스명': service.serviceName || '',
          '월요금': service.monthlyFee || 0,
          '유치추가금액': service.attractionBonus || 0,
          '미유치차감금액': service.noAttractionDeduction || 0,
          '상세설명': service.description || '',
          '공식사이트URL': service.officialUrl || ''
        };

        await this.dal.create('direct_store_policy_addon_services', record);
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 부가서비스 정책 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 보험상품 정책 업데이트 (전체 교체)
   */
  async updatePolicyInsurance(carrier, insurances) {
    try {
      // 1. 기존 데이터 삭제
      await this.dal.delete('direct_store_policy_insurance', { '통신사': carrier });

      // 2. 새 데이터 삽입
      for (const insurance of insurances) {
        const record = {
          '통신사': carrier,
          '보험상품명': insurance.productName || '',
          '출고가최소': insurance.minPrice || 0,
          '출고가최대': insurance.maxPrice || 0,
          '월요금': insurance.monthlyFee || 0,
          '유치추가금액': insurance.attractionBonus || 0,
          '미유치차감금액': insurance.noAttractionDeduction || 0,
          '상세설명': insurance.description || '',
          '공식사이트URL': insurance.officialUrl || ''
        };

        await this.dal.create('direct_store_policy_insurance', record);
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 보험상품 정책 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 특별 정책 업데이트 (전체 교체)
   */
  async updatePolicySpecial(carrier, policies) {
    try {
      // 1. 기존 데이터 삭제
      await this.dal.delete('direct_store_policy_special', { '통신사': carrier });

      // 2. 새 데이터 삽입
      for (const policy of policies) {
        const record = {
          '통신사': carrier,
          '정책명': policy.policyName || '',
          '정책타입': policy.policyType || '',
          '금액': policy.amount || 0,
          '적용여부': policy.isActive ? 'TRUE' : 'FALSE',
          '조건JSON': policy.condition ? JSON.stringify(policy.condition) : ''
        };

        await this.dal.create('direct_store_policy_special', record);
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 특별 정책 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 설정 업데이트
   */
  async updateSettings(carrier, settingType, settings) {
    try {
      const filters = {
        '통신사': carrier,
        '설정유형': settingType
      };

      // 기존 데이터 확인
      const existing = await this.dal.read('direct_store_settings', filters);

      const updates = {
        '시트ID': settings.sheetId || '',
        '시트URL': settings.sheetUrl || '',
        '설정값JSON': settings.settings ? JSON.stringify(settings.settings) : ''
      };

      if (existing.length > 0) {
        await this.dal.update('direct_store_settings', filters, updates);
      } else {
        await this.dal.create('direct_store_settings', { ...filters, ...updates });
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 설정 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 모델 이미지 업데이트 (Discord에서 새로고침)
   */
  async updateModelImages(carrier, modelId, images) {
    try {
      // 1. 기존 이미지 삭제
      await this.dal.delete('direct_store_model_images', {
        '통신사': carrier,
        '모델ID': modelId
      });

      // 2. 새 이미지 삽입
      for (const image of images) {
        const record = {
          '통신사': carrier,
          '모델ID': modelId,
          '모델명': image.modelName || '',
          '펫네임': image.petName || '',
          '제조사': image.manufacturer || '',
          '이미지URL': image.imageUrl || '',
          '비고': image.note || '',
          '색상': image.color || '',
          'Discord메시지ID': image.discordMessageId || '',
          'Discord포스트ID': image.discordPostId || '',
          'Discord스레드ID': image.discordThreadId || ''
        };

        await this.dal.create('direct_store_model_images', record);
      }

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 모델 이미지 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 모델 이미지 URL 업데이트 (단일 이미지)
   * @param {string} id - 이미지 레코드 ID (UUID)
   * @param {string} imageUrl - 새 이미지 URL
   */
  async updateModelImageUrl(id, imageUrl) {
    try {
      const updates = {
        '이미지URL': imageUrl
      };

      // 🔥 수정: id를 직접 전달 (객체가 아닌 문자열)
      await this.dal.update('direct_store_model_images', id, updates);

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 모델 이미지 URL 업데이트 실패:', error);
      throw error;
    }
  }

  // ==================== 재빌드 메서드 (Google Sheets → Supabase) ====================

  /**
   * 요금제 마스터 재빌드 (Google Sheets → Supabase)
   * @param {Array} planData - 요금제 데이터 배열
   * @returns {Promise<Object>} { totalCount, perCarrier }
   */
  async rebuildPlanMaster(planData) {
    try {
      const startTime = Date.now();
      console.log(`🔄 [DirectStoreDAL.rebuildPlanMaster] 요금제 마스터 재빌드 시작 - ${new Date(startTime).toISOString()}`);

      // 1. 기존 데이터 삭제 (전체 삭제)
      await this.dal.deleteAll('direct_store_plan_master');

      // 2. 새 데이터 삽입
      const records = planData.map(plan => ({
        '통신사': plan.carrier,
        '요금제명': plan.planName,
        '요금제군': plan.planGroup,
        '기본료': plan.basicFee || 0,
        '요금제코드': plan.planCode || '',
        '사용여부': plan.isActive ? 'Y' : 'N',
        '비고': plan.note || ''
      }));

      // 배치 생성 (DirectStoreDAL은 DALFactory를 통해 생성된 DataAccessLayer 인스턴스를 사용하므로 batchCreate 호출 가능)
      // DataAccessLayer.batchCreate -> Implementation.batchCreate
      await this.dal.batchCreate('direct_store_plan_master', records);
      const insertedCount = records.length;

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [DirectStoreDAL.rebuildPlanMaster] 요금제 마스터 재빌드 완료 - ${new Date().toISOString()}`, {
        소요시간: `${elapsedTime}초`,
        총개수: insertedCount
      });

      return { totalCount: insertedCount };
    } catch (error) {
      console.error('[DirectStoreDAL] 요금제 마스터 재빌드 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 마스터 재빌드 (Google Sheets → Supabase)
   * @param {Array} deviceData - 단말 데이터 배열
   * @returns {Promise<Object>} { totalCount, perCarrier }
   */
  async rebuildDeviceMaster(deviceData) {
    try {
      const startTime = Date.now();
      console.log(`🔄 [DirectStoreDAL.rebuildDeviceMaster] 단말 마스터 재빌드 시작 - ${new Date(startTime).toISOString()}`);

      // 1. 기존 데이터 삭제 (전체 삭제)
      await this.dal.deleteAll('direct_store_device_master');

      // 2. 새 데이터 삽입
      const records = deviceData.map(device => ({
        '통신사': device.carrier,
        '모델ID': device.modelId,
        '모델명': device.modelName,
        '펫네임': device.petName || '',
        '제조사': device.manufacturer || '',
        '출고가': device.factoryPrice || 0,
        '기본요금제군': device.defaultPlanGroup || '',
        'isPremium': device.isPremium ? 'Y' : 'N',
        'isBudget': device.isBudget ? 'Y' : 'N',
        'isPopular': device.isPopular ? 'Y' : 'N',
        'isRecommended': device.isRecommended ? 'Y' : 'N',
        'isCheap': device.isCheap ? 'Y' : 'N',
        '이미지URL': device.imageUrl || '',
        '사용여부': device.isActive ? 'Y' : 'N',
        '비고': device.note || '',
        'Discord메시지ID': device.discordMessageId || '',
        'Discord포스트ID': device.discordPostId || '',
        'Discord스레드ID': device.discordThreadId || ''
      }));

      await this.dal.batchCreate('direct_store_device_master', records);
      const insertedCount = records.length;

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [DirectStoreDAL.rebuildDeviceMaster] 단말 마스터 재빌드 완료 - ${new Date().toISOString()}`, {
        소요시간: `${elapsedTime}초`,
        총개수: insertedCount
      });

      return { totalCount: insertedCount };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 마스터 재빌드 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 요금 정책 재빌드 (Google Sheets → Supabase)
   * @param {Array} pricingData - 요금 정책 데이터 배열
   * @returns {Promise<Object>} { totalCount, perCarrier }
   */
  async rebuildPricingMaster(pricingData) {
    try {
      const startTime = Date.now();
      console.log(`🔄 [DirectStoreDAL.rebuildPricingMaster] 단말 요금정책 재빌드 시작 - ${new Date(startTime).toISOString()}`);

      // 1. 기존 데이터 삭제 (전체 삭제)
      await this.dal.deleteAll('direct_store_device_pricing_policy');

      // 2. 새 데이터 삽입
      const records = pricingData.map(pricing => ({
        '통신사': pricing.carrier,
        '모델ID': pricing.modelId,
        '모델명': pricing.modelName,
        '요금제군': pricing.planGroup,
        '요금제코드': pricing.planCode || '',
        '개통유형': pricing.openingType,
        '출고가': pricing.factoryPrice || 0,
        '이통사지원금': pricing.publicSupport || 0,
        '대리점추가지원금_부가유치': pricing.storeAdditionalSupportWithAddon || 0,
        '정책마진': pricing.policyMargin || 0,
        '정책ID': pricing.policyId || '',
        '기준일자': pricing.baseDate || '',
        '비고': pricing.note || ''
      }));

      await this.dal.batchCreate('direct_store_device_pricing_policy', records);
      const insertedCount = records.length;

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [DirectStoreDAL.rebuildPricingMaster] 단말 요금정책 재빌드 완료 - ${new Date().toISOString()}`, {
        소요시간: `${elapsedTime}초`,
        총개수: insertedCount
      });

      return { totalCount: insertedCount };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 요금정책 재빌드 실패:', error);
      throw error;
    }
  }

  /**
   * 정책 마진 삭제
   * @param {string} carrier - 통신사 (SK, KT, LG)
   * @returns {Promise<Object>} { success: true }
   */
  async deletePolicyMargin(carrier) {
    try {
      await this.dal.delete('direct_store_policy_margin', { '통신사': carrier });
      console.log(`[DirectStoreDAL] 정책 마진 삭제 완료: ${carrier}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 정책 마진 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 부가서비스 정책 삭제
   * @param {string} carrier - 통신사 (SK, KT, LG)
   * @returns {Promise<Object>} { success: true }
   */
  async deletePolicyAddonServices(carrier) {
    try {
      await this.dal.delete('direct_store_policy_addon_services', { '통신사': carrier });
      console.log(`[DirectStoreDAL] 부가서비스 정책 삭제 완료: ${carrier}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 부가서비스 정책 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 보험상품 정책 삭제
   * @param {string} carrier - 통신사 (SK, KT, LG)
   * @returns {Promise<Object>} { success: true }
   */
  async deletePolicyInsurance(carrier) {
    try {
      await this.dal.delete('direct_store_policy_insurance', { '통신사': carrier });
      console.log(`[DirectStoreDAL] 보험상품 정책 삭제 완료: ${carrier}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 보험상품 정책 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 특별 정책 삭제
   * @param {string} carrier - 통신사 (SK, KT, LG)
   * @returns {Promise<Object>} { success: true }
   */
  async deletePolicySpecial(carrier) {
    try {
      await this.dal.delete('direct_store_policy_special', { '통신사': carrier });
      console.log(`[DirectStoreDAL] 특별 정책 삭제 완료: ${carrier}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 특별 정책 삭제 실패:', error);
      throw error;
    }
  }



  /**
   * 메인 페이지 문구 삭제
   * @param {string} carrier - 통신사 (SK, KT, LG) - 빈 문자열이면 mainHeader
   * @returns {Promise<Object>} { success: true }
   */
  async deleteMainPageText(carrier) {
    try {
      const filters = { '통신사': carrier || '' };
      await this.dal.delete('direct_store_main_page_texts', filters);
      console.log(`[DirectStoreDAL] 메인 페이지 문구 삭제 완료: ${carrier || 'mainHeader'}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 메인 페이지 문구 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 마스터 생성
   * @param {Object} data - 단말 데이터
   * @param {string} data.carrier - 통신사 (SK/KT/LG)
   * @param {string} data.modelId - 모델ID
   * @param {string} data.modelName - 모델명
   * @param {string} data.petName - 펫네임
   * @param {string} data.manufacturer - 제조사
   * @param {number} data.factoryPrice - 출고가
   * @param {string} data.defaultPlanGroup - 기본요금제군
   * @param {boolean} data.isPremium - 프리미엄 여부
   * @param {boolean} data.isBudget - 보급형 여부
   * @param {boolean} data.isPopular - 인기 여부
   * @param {boolean} data.isRecommended - 추천 여부
   * @param {boolean} data.isCheap - 저렴 여부
   * @param {string} data.imageUrl - 이미지URL
   * @param {boolean} data.isActive - 사용여부
   * @param {string} data.note - 비고
   * @param {string} data.discordMessageId - Discord메시지ID
   * @param {string} data.discordPostId - Discord포스트ID
   * @param {string} data.discordThreadId - Discord스레드ID
   * @returns {Promise<Object>} { success: true }
   */
  async createDeviceMaster(data) {
    try {
      const record = {
        '통신사': data.carrier,
        '모델ID': data.modelId,
        '모델명': data.modelName,
        '펫네임': data.petName || '',
        '제조사': data.manufacturer || '',
        '출고가': data.factoryPrice || 0,
        '기본요금제군': data.defaultPlanGroup || '',
        'isPremium': data.isPremium || false,
        'isBudget': data.isBudget || false,
        'isPopular': data.isPopular || false,
        'isRecommended': data.isRecommended || false,
        'isCheap': data.isCheap || false,
        '이미지URL': data.imageUrl || '',
        '사용여부': data.isActive !== false, // 기본값 true
        '비고': data.note || '',
        'Discord메시지ID': data.discordMessageId || '',
        'Discord포스트ID': data.discordPostId || '',
        'Discord스레드ID': data.discordThreadId || ''
      };

      await this.dal.create('direct_store_device_master', record);
      console.log(`[DirectStoreDAL] 단말 마스터 생성 완료: ${data.carrier} - ${data.modelId}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 마스터 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 마스터 수정
   * @param {string} carrier - 통신사
   * @param {string} modelId - 모델ID
   * @param {Object} updates - 수정할 필드들
   * @returns {Promise<Object>} { success: true }
   */
  async updateDeviceMaster(carrier, modelId, updates) {
    try {
      const record = {};

      // 수정 가능한 필드만 매핑
      if (updates.modelName !== undefined) record['모델명'] = updates.modelName;
      if (updates.petName !== undefined) record['펫네임'] = updates.petName;
      if (updates.manufacturer !== undefined) record['제조사'] = updates.manufacturer;
      if (updates.factoryPrice !== undefined) record['출고가'] = updates.factoryPrice;
      if (updates.defaultPlanGroup !== undefined) record['기본요금제군'] = updates.defaultPlanGroup;
      if (updates.isPremium !== undefined) record['isPremium'] = updates.isPremium;
      if (updates.isBudget !== undefined) record['isBudget'] = updates.isBudget;
      if (updates.isPopular !== undefined) record['isPopular'] = updates.isPopular;
      if (updates.isRecommended !== undefined) record['isRecommended'] = updates.isRecommended;
      if (updates.isCheap !== undefined) record['isCheap'] = updates.isCheap;
      if (updates.imageUrl !== undefined) record['이미지URL'] = updates.imageUrl;
      if (updates.isActive !== undefined) record['사용여부'] = updates.isActive;
      if (updates.note !== undefined) record['비고'] = updates.note;
      if (updates.discordMessageId !== undefined) record['Discord메시지ID'] = updates.discordMessageId;
      if (updates.discordPostId !== undefined) record['Discord포스트ID'] = updates.discordPostId;
      if (updates.discordThreadId !== undefined) record['Discord스레드ID'] = updates.discordThreadId;

      // Supabase 직접 사용 (복합 키 지원)
      const { data, error } = await supabase
        .from('direct_store_device_master')
        .update(record)
        .eq('통신사', carrier)
        .eq('모델ID', modelId)
        .select();

      if (error) {
        throw new Error(`DB Update Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 단말 마스터 수정 완료: ${carrier} - ${modelId}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 마스터 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 마스터 삭제
   * @param {string} carrier - 통신사
   * @param {string} modelId - 모델ID
   * @returns {Promise<Object>} { success: true }
   */
  async deleteDeviceMaster(carrier, modelId) {
    try {
      // Supabase 직접 사용 (복합 키 지원)
      const { data, error } = await supabase
        .from('direct_store_device_master')
        .delete()
        .eq('통신사', carrier)
        .eq('모델ID', modelId)
        .select();

      if (error) {
        throw new Error(`DB Delete Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 단말 마스터 삭제 완료: ${carrier} - ${modelId}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 마스터 삭제 실패:', error);
      throw error;
    }
  }

  // ==================== 단말 요금정책 CRUD ====================

  /**
   * 단말 요금정책 생성
   * @param {Object} data - 요금정책 데이터
   * @param {string} data.carrier - 통신사
   * @param {string} data.modelId - 모델ID
   * @param {string} data.modelName - 모델명
   * @param {string} data.planGroup - 요금제군
   * @param {string} data.planCode - 요금제코드
   * @param {string} data.openingType - 개통유형 (MNP, 기변, 010신규 등)
   * @param {number} data.factoryPrice - 출고가
   * @param {number} data.publicSupport - 이통사지원금
   * @param {number} data.storeAdditionalSupportWithAddon - 대리점추가지원금_부가유치
   * @param {number} data.policyMargin - 정책마진
   * @param {string} data.policyId - 정책ID (선택)
   * @param {string} data.baseDate - 기준일자 (선택)
   * @param {string} data.note - 비고 (선택)
   * @returns {Promise<Object>} { success: true }
   */
  async createPricingMaster(data) {
    try {
      const record = {
        '통신사': data.carrier,
        '모델ID': data.modelId,
        '모델명': data.modelName,
        '요금제군': data.planGroup,
        '요금제코드': data.planCode || '',
        '개통유형': data.openingType,
        '출고가': data.factoryPrice || 0,
        '이통사지원금': data.publicSupport || 0,
        '대리점추가지원금_부가유치': data.storeAdditionalSupportWithAddon || 0,
        '정책마진': data.policyMargin || 0,
        '정책ID': data.policyId || '',
        '기준일자': data.baseDate || new Date().toISOString().split('T')[0],
        '비고': data.note || ''
      };

      await this.dal.create('direct_store_device_pricing_policy', record);
      console.log(`[DirectStoreDAL] 단말 요금정책 생성 완료: ${data.carrier} - ${data.modelId} - ${data.planGroup} - ${data.openingType}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 요금정책 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 요금정책 수정
   * @param {string} carrier - 통신사
   * @param {string} modelId - 모델ID
   * @param {string} planGroup - 요금제군
   * @param {string} openingType - 개통유형
   * @param {Object} updates - 수정할 데이터
   * @returns {Promise<Object>} { success: true }
   */
  async updatePricingMaster(carrier, modelId, planGroup, openingType, updates) {
    try {
      const record = {};

      // 수정 가능한 필드만 매핑
      if (updates.modelName !== undefined) record['모델명'] = updates.modelName;
      if (updates.planCode !== undefined) record['요금제코드'] = updates.planCode;
      if (updates.factoryPrice !== undefined) record['출고가'] = updates.factoryPrice;
      if (updates.publicSupport !== undefined) record['이통사지원금'] = updates.publicSupport;
      if (updates.storeAdditionalSupportWithAddon !== undefined) record['대리점추가지원금_부가유치'] = updates.storeAdditionalSupportWithAddon;
      if (updates.policyMargin !== undefined) record['정책마진'] = updates.policyMargin;
      if (updates.policyId !== undefined) record['정책ID'] = updates.policyId;
      if (updates.baseDate !== undefined) record['기준일자'] = updates.baseDate;
      if (updates.note !== undefined) record['비고'] = updates.note;

      // Supabase 직접 사용 (복합 키 지원)
      const { data, error } = await supabase
        .from('direct_store_device_pricing_policy')
        .update(record)
        .eq('통신사', carrier)
        .eq('모델ID', modelId)
        .eq('요금제군', planGroup)
        .eq('개통유형', openingType)
        .select();

      if (error) {
        throw new Error(`DB Update Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 단말 요금정책 수정 완료: ${carrier} - ${modelId} - ${planGroup} - ${openingType}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 요금정책 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 단말 요금정책 삭제
   * @param {string} carrier - 통신사
   * @param {string} modelId - 모델ID
   * @param {string} planGroup - 요금제군
   * @param {string} openingType - 개통유형
   * @returns {Promise<Object>} { success: true }
   */
  async deletePricingMaster(carrier, modelId, planGroup, openingType) {
    try {
      // Supabase 직접 사용 (복합 키 지원)
      const { data, error } = await supabase
        .from('direct_store_device_pricing_policy')
        .delete()
        .eq('통신사', carrier)
        .eq('모델ID', modelId)
        .eq('요금제군', planGroup)
        .eq('개통유형', openingType)
        .select();

      if (error) {
        throw new Error(`DB Delete Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 단말 요금정책 삭제 완료: ${carrier} - ${modelId} - ${planGroup} - ${openingType}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 단말 요금정책 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 링크 설정 삭제 (Supabase)
   */
  async deleteLinkSettings(carrier, settingType) {
    try {
      const { error } = await supabase
        .from('direct_store_settings')
        .delete()
        .eq('통신사', carrier)
        .eq('설정유형', settingType);

      if (error) {
        throw new Error(`DB Delete Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 링크 설정 삭제 완료: ${carrier} - ${settingType}`);
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 링크 설정 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 정책 마진 저장 (Supabase)
   */
  async savePolicyMargin(carrier, margin) {
    try {
      const { error } = await supabase
        .from('direct_store_policy_margin')
        .upsert({
          '통신사': carrier,
          '마진': margin
        }, { onConflict: '통신사' });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 정책 마진 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 부가서비스 정책 저장 (Supabase)
   */
  async savePolicyAddonServices(carrier, addonList) {
    try {
      // 해당 통신사 데이터 먼저 일괄 삭제 (중복 방지)
      await supabase.from('direct_store_policy_addon_services').delete().eq('통신사', carrier);

      if (addonList && addonList.length > 0) {
        const insertData = addonList.map(item => ({
          '통신사': carrier,
          '서비스명': item.name || '',
          '월요금': item.fee || 0,
          '유치추가금액': item.incentive || 0,
          '미유치차감금액': item.deduction || 0,
          '상세설명': item.description || '',
          '공식사이트URL': item.url || ''
        }));
        const { error } = await supabase.from('direct_store_policy_addon_services').insert(insertData);
        if (error) throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 부가서비스 정책 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 보험상품 정책 저장 (Supabase)
   */
  async savePolicyInsurance(carrier, insuranceList) {
    try {
      // 해당 통신사 데이터 먼저 일괄 삭제 (중복 방지)
      await supabase.from('direct_store_policy_insurance').delete().eq('통신사', carrier);

      if (insuranceList && insuranceList.length > 0) {
        const insertData = insuranceList.map(item => ({
          '통신사': carrier,
          '보험상품명': item.name || '',
          '출고가최소': item.minPrice || 0,
          '출고가최대': item.maxPrice || 0,
          '월요금': item.fee || 0,
          '유치추가금액': item.incentive || 0,
          '미유치차감금액': item.deduction || 0,
          '상세설명': item.description || '',
          '공식사이트URL': item.url || ''
        }));
        const { error } = await supabase.from('direct_store_policy_insurance').insert(insertData);
        if (error) throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 보험상품 정책 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 특별 정책(별도정책) 저장 (Supabase)
   */
  async savePolicySpecial(carrier, specialList) {
    try {
      // 해당 통신사 데이터 먼저 일괄 삭제 (중복 방지)
      await supabase.from('direct_store_policy_special').delete().eq('통신사', carrier);

      if (specialList && specialList.length > 0) {
        const insertData = specialList.map(item => ({
          '통신사': carrier,
          '정책명': item.name || '',
          '정책타입': item.policyType || 'general',
          '금액': item.amount || 0,
          '적용여부': item.isActive !== false,
          '조건JSON': item.conditionsJson ? (typeof item.conditionsJson === 'string' ? item.conditionsJson : JSON.stringify(item.conditionsJson)) : null
        }));
        const { error } = await supabase.from('direct_store_policy_special').insert(insertData);
        if (error) throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 특별 정책 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 링크 설정 저장 (Supabase)
   */
  async saveLinkSettings(carrier, settingType, sheetId, settingsJson) {
    try {
      // Upsert (통신사 + 설정유형 기준)
      const { data, error } = await supabase
        .from('direct_store_settings')
        .upsert({
          '통신사': carrier,
          '설정유형': settingType,
          '시트ID': sheetId,
          '설정값JSON': typeof settingsJson === 'string' ? settingsJson : JSON.stringify(settingsJson)
        })
        .select();

      if (error) {
        throw new Error(`DB Upsert Error: ${error.message}`);
      }

      console.log(`[DirectStoreDAL] 링크 설정 저장 완료: ${carrier} - ${settingType}`);
      return { success: true, data };
    } catch (error) {
      console.error('[DirectStoreDAL] 링크 설정 저장 실패:', error);
      throw error;
    }
  }


  /**
   * 링크 설정 조회 (Supabase)
   * @param {string} carrier - 통신사
   */
  async getSettings(carrier) {
    try {
      const { data, error } = await supabase
        .from('direct_store_settings')
        .select('*')
        .eq('통신사', carrier);

      if (error) throw error;

      // DB 컬럼을 프론트엔드/API 예상 포맷으로 매핑
      return data.map(item => ({
        carrier: item.통신사,
        settingType: item.설정유형,
        sheetId: item.시트ID,
        sheetUrl: item.시트URL,
        settings: item.설정값JSON ? JSON.parse(item.설정값JSON) : {}
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 링크 설정 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 메인 페이지 문구 조회 (Supabase)
   */
  async getMainPageTexts() {
    try {
      const { data, error } = await supabase
        .from('direct_store_main_page_texts')
        .select('*');

      if (error) throw error;

      return data.map(item => ({
        carrier: item.통신사,
        category: item.카테고리,
        type: item.설정유형,
        content: item.문구내용,
        imageUrl: item.이미지URL,
        updatedAt: item.수정일시
      }));
    } catch (error) {
      console.error('[DirectStoreDAL] 메인 페이지 문구 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 메인 페이지 문구 업데이트 (Supabase)
   */
  async updateMainPageText(carrier, category, textType, data) {
    try {
      const record = {
        '통신사': carrier || '',
        '카테고리': category || '',
        '설정유형': textType,
        '문구내용': data.content || '',
        '이미지URL': data.imageUrl || '',
        '수정일시': new Date().toISOString()
      };

      // Upsert: 통신사+카테고리+설정유형 복합 키로 유니크 제약이 있다고 가정
      // 만약 복합 키가 없다면 delete/insert 방식 사용
      // 여기서는 delete -> insert 방식 사용 (안전하게)

      const filters = {
        '통신사': carrier || '',
        '카테고리': category || '',
        '설정유형': textType
      };

      await this.dal.delete('direct_store_main_page_texts', filters);
      await this.dal.create('direct_store_main_page_texts', record);

      return { success: true };
    } catch (error) {
      console.error('[DirectStoreDAL] 메인 페이지 문구 업데이트 실패:', error);
      throw error;
    }
  }
}

module.exports = new DirectStoreDAL();
