/**
 * 전역 가격 캐시 유틸리티
 * 휴대폰목록과 오늘의휴대폰 페이지가 공유하는 가격 캐시
 * sessionStorage를 사용하여 새로고침 후에도 유지 (1시간 만료)
 */

// 🔥 캐시 버전: 서버 버그 수정 시 버전을 올려서 이전 캐시 무효화
const CACHE_VERSION = 'v7'; // v7: 잘못된 sessionStorage 값 강제 무효화
const CACHE_KEY = `directStore_priceCache_${CACHE_VERSION}`;
const CACHE_EXPIRY = 60 * 60 * 1000; // 1시간 (밀리초)

/**
 * 캐시에서 가격 데이터 가져오기
 * @param {string} modelId - 모델 ID
 * @param {string} planGroup - 요금제군 (예: '115군', '33군')
 * @param {string} openingType - 개통 유형 ('010신규', 'MNP', '기변')
 * @param {string} carrier - 통신사 ('SK', 'KT', 'LG')
 * @returns {object|null} 캐시된 가격 데이터 또는 null
 */
export const getCachedPrice = (modelId, planGroup, openingType, carrier) => {
  try {
    const cacheData = sessionStorage.getItem(CACHE_KEY);
    if (!cacheData) return null;

    const { cache, timestamp } = JSON.parse(cacheData);
    
    // 캐시 만료 확인
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    const cacheKey = `${modelId}-${planGroup}-${openingType}-${carrier}`;
    return cache[cacheKey] || null;
  } catch (err) {
    console.error('캐시 읽기 실패:', err);
    return null;
  }
};

/**
 * 캐시에 가격 데이터 저장
 * @param {string} modelId - 모델 ID
 * @param {string} planGroup - 요금제군
 * @param {string} openingType - 개통 유형
 * @param {string} carrier - 통신사
 * @param {object} priceData - 가격 데이터
 */
export const setCachedPrice = (modelId, planGroup, openingType, carrier, priceData) => {
  try {
    const cacheKey = `${modelId}-${planGroup}-${openingType}-${carrier}`;
    
    let cacheData = sessionStorage.getItem(CACHE_KEY);
    let cache = {};
    let timestamp = Date.now();

    if (cacheData) {
      try {
        const parsed = JSON.parse(cacheData);
        // 만료된 캐시는 무시
        if (Date.now() - parsed.timestamp <= CACHE_EXPIRY) {
          cache = parsed.cache || {};
          timestamp = parsed.timestamp; // 기존 타임스탬프 유지
        }
      } catch (e) {
        // 파싱 실패 시 새로 시작
        cache = {};
        timestamp = Date.now();
      }
    }

    // 가격 데이터 저장
    cache[cacheKey] = {
      ...priceData,
      cachedAt: Date.now()
    };

    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cache, timestamp }));
  } catch (err) {
    console.error('캐시 저장 실패:', err);
  }
};

/**
 * 여러 가격 데이터를 한 번에 저장 (배치 저장)
 * @param {Array} priceEntries - [{ modelId, planGroup, openingType, carrier, priceData }, ...]
 */
export const setCachedPricesBatch = (priceEntries) => {
  try {
    let cacheData = sessionStorage.getItem(CACHE_KEY);
    let cache = {};
    let timestamp = Date.now();

    if (cacheData) {
      try {
        const parsed = JSON.parse(cacheData);
        if (Date.now() - parsed.timestamp <= CACHE_EXPIRY) {
          cache = parsed.cache || {};
          timestamp = parsed.timestamp;
        }
      } catch (e) {
        cache = {};
        timestamp = Date.now();
      }
    }

    // 모든 가격 데이터 저장
    priceEntries.forEach(({ modelId, planGroup, openingType, carrier, priceData }) => {
      const cacheKey = `${modelId}-${planGroup}-${openingType}-${carrier}`;
      cache[cacheKey] = {
        ...priceData,
        cachedAt: Date.now()
      };
    });

    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ cache, timestamp }));
  } catch (err) {
    console.error('배치 캐시 저장 실패:', err);
  }
};

/**
 * 캐시 초기화 (모든 캐시 삭제)
 */
export const clearPriceCache = () => {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.error('캐시 초기화 실패:', err);
  }
};

/**
 * 캐시 상태 확인 (디버깅용)
 * @returns {object} 캐시 통계
 */
export const getCacheStats = () => {
  try {
    const cacheData = sessionStorage.getItem(CACHE_KEY);
    if (!cacheData) {
      return { count: 0, age: 0, expired: false };
    }

    const { cache, timestamp } = JSON.parse(cacheData);
    const age = Date.now() - timestamp;
    const expired = age > CACHE_EXPIRY;

    return {
      count: Object.keys(cache || {}).length,
      age: Math.floor(age / 1000 / 60), // 분 단위
      expired,
      timestamp: new Date(timestamp).toLocaleString()
    };
  } catch (err) {
    return { count: 0, age: 0, expired: true, error: err.message };
  }
};

