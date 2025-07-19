// 전체고객리스트 캐시 시스템
class AllCustomerCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultExpiry = 15 * 60 * 1000; // 15분
    this.maxCacheSize = 30; // 최대 캐시 항목 수
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
const allCustomerCache = new AllCustomerCache();

// 캐시된 전체 고객리스트 로드
export const getCachedAllCustomerList = async (apiUrl) => {
  const key = allCustomerCache.generateKey('allCustomerList', { apiUrl });
  
  // 캐시에서 확인
  const cached = allCustomerCache.get(key);
  if (cached) {
    console.log('✅ 캐시에서 전체 고객리스트 로드');
    return cached;
  }

  // API 호출
  console.log('🔄 전체 고객리스트 API 호출');
  try {
    const response = await fetch(`${apiUrl}/api/reservation-sales/all-customers`);
    
    if (!response.ok) {
      throw new Error('전체 고객 리스트를 불러올 수 없습니다.');
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 캐시에 저장 (15분 TTL)
      allCustomerCache.set(key, data, 15 * 60 * 1000);
      console.log('💾 전체 고객리스트 캐시에 저장');
      return data;
    } else {
      throw new Error(data.message || '전체 고객 리스트 로드에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 전체 고객리스트 로드 실패:', error);
    throw error;
  }
};

// 캐시된 검색 결과 저장
export const getCachedSearchResults = (searchQuery, customerList) => {
  const key = allCustomerCache.generateKey('searchResults', { searchQuery });
  
  // 캐시에서 확인
  const cached = allCustomerCache.get(key);
  if (cached) {
    console.log(`✅ 캐시에서 검색 결과 로드: "${searchQuery}"`);
    return cached;
  }

  // 검색 실행
  console.log(`🔄 검색 실행: "${searchQuery}"`);
  const filtered = customerList.filter(customer => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (customer.customerName && customer.customerName.toLowerCase().includes(searchLower)) ||
      (customer.reservationNumber && customer.reservationNumber.toLowerCase().includes(searchLower)) ||
      (customer.modelCapacityColor && customer.modelCapacityColor.toLowerCase().includes(searchLower)) ||
      (customer.storeCode && customer.storeCode.toLowerCase().includes(searchLower)) ||
      (customer.posName && customer.posName.toLowerCase().includes(searchLower)) ||
      (customer.manager && customer.manager.toLowerCase().includes(searchLower)) ||
      (customer.reservationMemo && customer.reservationMemo.toLowerCase().includes(searchLower)) ||
      (customer.yardReceivedMemo && customer.yardReceivedMemo.toLowerCase().includes(searchLower))
    );
  });

  // 캐시에 저장 (5분 TTL)
  allCustomerCache.set(key, filtered, 5 * 60 * 1000);
  console.log(`💾 검색 결과 캐시에 저장: "${searchQuery}"`);
  
  return filtered;
};

// 캐시 관리 함수들
export const clearAllCustomerCache = (type = null) => {
  if (type) {
    allCustomerCache.clearByType(type);
    console.log(`🧹 ${type} 타입 전체고객리스트 캐시 클리어 완료`);
  } else {
    allCustomerCache.clear();
    console.log('🧹 전체 전체고객리스트 캐시 클리어 완료');
  }
};

export const getAllCustomerCacheStats = () => {
  return allCustomerCache.getStats();
};

export const cleanupExpiredAllCustomerCache = () => {
  allCustomerCache.cleanup();
  console.log('🧹 만료된 전체고객리스트 캐시 정리 완료');
};

// 주기적 캐시 정리 (5분마다)
setInterval(cleanupExpiredAllCustomerCache, 5 * 60 * 1000);

export default allCustomerCache; 