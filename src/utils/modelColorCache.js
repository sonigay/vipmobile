// 모델색상별 정리 캐시 시스템
class ModelColorCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultExpiry = 10 * 60 * 1000; // 10분
    this.maxCacheSize = 50; // 최대 캐시 항목 수
  }

  // 캐시 키 생성
  generateKey(type, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${type}:${paramString}`;
  }

  // 캐시에 데이터 저장
  set(key, data, expiry = this.defaultExpiry) {
    // 캐시 크기 제한 확인
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + expiry);
  }

  // 캐시에서 데이터 조회
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const expiry = this.cacheExpiry.get(key);
    if (Date.now() > expiry) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  // 캐시에서 데이터 삭제
  delete(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  // 가장 오래된 캐시 항목 제거
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry < oldestTime) {
        oldestTime = expiry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  // 만료된 캐시 정리
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }

  // 특정 타입의 캐시만 삭제
  clearByType(type) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.delete(key);
      }
    }
  }

  // 전체 캐시 클리어
  clear() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  // 캐시 상태 정보
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 전역 캐시 인스턴스
const modelColorCache = new ModelColorCache();

// 캐시된 모델색상별 데이터 로드
export const getCachedModelColorData = async (apiUrl) => {
  const key = modelColorCache.generateKey('modelColorData', { apiUrl });
  
  // 캐시에서 확인
  const cached = modelColorCache.get(key);
  if (cached) {
    console.log('✅ 캐시에서 모델색상별 데이터 로드');
    return cached;
  }

  // API 호출
  console.log('🔄 모델색상별 데이터 API 호출');
  try {
    const response = await fetch(`${apiUrl}/api/reservation-sales/model-color`);
    
    if (!response.ok) {
      throw new Error('모델색상별 데이터를 불러올 수 없습니다.');
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 캐시에 저장 (10분 TTL)
      modelColorCache.set(key, data, 10 * 60 * 1000);
      console.log('💾 모델색상별 데이터 캐시에 저장');
      return data;
    } else {
      throw new Error(data.message || '모델색상별 데이터 로드에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 모델색상별 데이터 로드 실패:', error);
    throw error;
  }
};

// 캐시된 정규화 상태 확인
export const getCachedNormalizationStatus = async (apiUrl) => {
  const key = modelColorCache.generateKey('normalizationStatus', { apiUrl });
  
  // 캐시에서 확인
  const cached = modelColorCache.get(key);
  if (cached) {
    console.log('✅ 캐시에서 정규화 상태 로드');
    return cached;
  }

  // API 호출
  console.log('🔄 정규화 상태 API 호출');
  try {
    const response = await fetch(`${apiUrl}/api/reservation-settings/normalization-status`);
    
    if (!response.ok) {
      throw new Error('정규화 상태를 확인할 수 없습니다.');
    }
    
    const data = await response.json();
    
    // 캐시에 저장 (5분 TTL)
    modelColorCache.set(key, data, 5 * 60 * 1000);
    console.log('💾 정규화 상태 캐시에 저장');
    return data;
  } catch (error) {
    console.error('❌ 정규화 상태 확인 실패:', error);
    throw error;
  }
};

// 캐시된 고객 리스트 로드 (POS별)
export const getCachedCustomerListByPos = async (apiUrl, posName) => {
  const key = modelColorCache.generateKey('customerListByPos', { apiUrl, posName });
  
  // 캐시에서 확인
  const cached = modelColorCache.get(key);
  if (cached) {
    console.log(`✅ 캐시에서 POS별 고객 리스트 로드: ${posName}`);
    return cached;
  }

  // API 호출
  console.log(`🔄 POS별 고객 리스트 API 호출: ${posName}`);
  try {
    const response = await fetch(`${apiUrl}/api/reservation-sales/model-color/by-pos/${encodeURIComponent(posName)}`);
    
    if (!response.ok) {
      throw new Error('POS별 고객 리스트를 불러올 수 없습니다.');
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 캐시에 저장 (5분 TTL)
      modelColorCache.set(key, data, 5 * 60 * 1000);
      console.log(`💾 POS별 고객 리스트 캐시에 저장: ${posName}`);
      return data;
    } else {
      throw new Error(data.message || 'POS별 고객 리스트 로드에 실패했습니다.');
    }
  } catch (error) {
    console.error(`❌ POS별 고객 리스트 로드 실패: ${posName}`, error);
    throw error;
  }
};

// 캐시된 고객 리스트 로드 (모델별)
export const getCachedCustomerListByModel = async (apiUrl, model) => {
  const key = modelColorCache.generateKey('customerListByModel', { apiUrl, model });
  
  // 캐시에서 확인
  const cached = modelColorCache.get(key);
  if (cached) {
    console.log(`✅ 캐시에서 모델별 고객 리스트 로드: ${model}`);
    return cached;
  }

  // API 호출
  console.log(`🔄 모델별 고객 리스트 API 호출: ${model}`);
  try {
    const response = await fetch(`${apiUrl}/api/reservation-sales/model-color/by-model/${encodeURIComponent(model)}`);
    
    if (!response.ok) {
      throw new Error('모델별 고객 리스트를 불러올 수 없습니다.');
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 캐시에 저장 (5분 TTL)
      modelColorCache.set(key, data, 5 * 60 * 1000);
      console.log(`💾 모델별 고객 리스트 캐시에 저장: ${model}`);
      return data;
    } else {
      throw new Error(data.message || '모델별 고객 리스트 로드에 실패했습니다.');
    }
  } catch (error) {
    console.error(`❌ 모델별 고객 리스트 로드 실패: ${model}`, error);
    throw error;
  }
};

// 캐시 관리 함수들
export const clearModelColorCache = (type = null) => {
  if (type) {
    modelColorCache.clearByType(type);
    console.log(`🧹 ${type} 타입 모델색상 캐시 클리어 완료`);
  } else {
    modelColorCache.clear();
    console.log('🧹 전체 모델색상 캐시 클리어 완료');
  }
};

export const getModelColorCacheStats = () => {
  return modelColorCache.getStats();
};

export const cleanupExpiredModelColorCache = () => {
  modelColorCache.cleanup();
  console.log('🧹 만료된 모델색상 캐시 정리 완료');
};

// 주기적 캐시 정리 (5분마다)
setInterval(cleanupExpiredModelColorCache, 5 * 60 * 1000);

export default modelColorCache; 