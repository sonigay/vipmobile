/**
 * 전역 가격 캐시 유틸리티
 * 휴대폰목록과 오늘의휴대폰 페이지가 공유하는 가격 캐시
 * sessionStorage를 사용하여 새로고침 후에도 유지 (1시간 만료)
 */

// 🔥 캐시 버전: 서버 버그 수정 시 버전을 올려서 이전 캐시 무효화
const CACHE_VERSION = 'v7'; // v7: 잘못된 sessionStorage 값 강제 무효화
const CACHE_KEY = `directStore_priceCache_${CACHE_VERSION}`;
const CACHE_EXPIRY = 60 * 60 * 1000; // 1시간 (밀리초)

// 🔥 개발 중 캐시 비활성화 플래그
// 환경 변수로 제어: REACT_APP_DISABLE_PRICE_CACHE=true
// 또는 localStorage에 'disablePriceCache' 키가 있으면 비활성화
const DISABLE_CACHE = 
  process.env.REACT_APP_DISABLE_PRICE_CACHE === 'true' ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('disablePriceCache') === 'true');

/**
 * 캐시에서 가격 데이터 가져오기
 * @param {string} modelId - 모델 ID
 * @param {string} planGroup - 요금제군 (예: '115군', '33군')
 * @param {string} openingType - 개통 유형 ('010신규', 'MNP', '기변')
 * @param {string} carrier - 통신사 ('SK', 'KT', 'LG')
 * @returns {object|null} 캐시된 가격 데이터 또는 null
 */
export const getCachedPrice = (modelId, planGroup, openingType, carrier) => {
  // 🔥 캐시 비활성화 플래그 확인
  if (DISABLE_CACHE) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[priceCache] 캐시 비활성화됨 - 항상 API 호출');
    }
    return null;
  }

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
  // 🔥 캐시 비활성화 플래그 확인
  if (DISABLE_CACHE) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[priceCache] 캐시 비활성화됨 - 저장하지 않음');
    }
    return;
  }

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
  // 🔥 캐시 비활성화 플래그 확인
  if (DISABLE_CACHE) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[priceCache] 캐시 비활성화됨 - 배치 저장하지 않음');
    }
    return;
  }

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
      return { count: 0, age: 0, expired: false, disabled: DISABLE_CACHE };
    }

    const { cache, timestamp } = JSON.parse(cacheData);
    const age = Date.now() - timestamp;
    const expired = age > CACHE_EXPIRY;

    return {
      count: Object.keys(cache || {}).length,
      age: Math.floor(age / 1000 / 60), // 분 단위
      expired,
      disabled: DISABLE_CACHE,
      timestamp: new Date(timestamp).toLocaleString()
    };
  } catch (err) {
    return { count: 0, age: 0, expired: true, disabled: DISABLE_CACHE, error: err.message };
  }
};

/**
 * 캐시 비활성화/활성화 (런타임 제어)
 * @param {boolean} disable - true면 비활성화, false면 활성화
 */
export const setCacheDisabled = (disable) => {
  if (typeof localStorage !== 'undefined') {
    if (disable) {
      localStorage.setItem('disablePriceCache', 'true');
      console.log('✅ [priceCache] 캐시가 비활성화되었습니다. 페이지를 새로고침하면 적용됩니다.');
    } else {
      localStorage.removeItem('disablePriceCache');
      console.log('✅ [priceCache] 캐시가 활성화되었습니다. 페이지를 새로고침하면 적용됩니다.');
    }
  }
};

/**
 * 캐시 비활성화 상태 확인
 * @returns {boolean} 캐시가 비활성화되었는지 여부
 */
export const isCacheDisabled = () => {
  return DISABLE_CACHE;
};

// 개발 환경에서 전역 함수로 노출 (브라우저 콘솔에서 사용 가능)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window.priceCache = {
    disable: () => setCacheDisabled(true),
    enable: () => setCacheDisabled(false),
    stats: () => {
      const stats = getCacheStats();
      console.table(stats);
      return stats;
    },
    clear: clearPriceCache,
    isDisabled: isCacheDisabled
  };
  console.log('💡 [priceCache] 개발 모드: 브라우저 콘솔에서 window.priceCache.disable() 또는 window.priceCache.enable() 사용 가능');
}

