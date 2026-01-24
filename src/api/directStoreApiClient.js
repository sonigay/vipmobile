/**
 * 직영점모드 API 클라이언트 (개선된 버전)
 * 에러 핸들링, 재시도 로직, 타입 안정성 개선
 * + 스마트 스로틀링 (중복 요청 제거 및 대기열 관리)
 */

import { API_BASE_URL } from '../api';
import { normalizeErrorMessage } from '../utils/directStoreUtils';

const BASE_URL = `${API_BASE_URL}/api/direct`;

// 재시도 설정
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1초
  retryableStatusCodes: [429, 500, 502, 503, 504] // 재시도 가능한 HTTP 상태 코드
};

/**
 * 요청 대기열 관리 클래스
 * 동시에 실행되는 무거운 요청 수를 제한하여 서버 과부하 방지
 */
class RequestQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// 무거운 요청을 처리하는 전역 큐 (동시 실행 1개로 제한)
const heavyRequestQueue = new RequestQueue(3); // 기존 1에서 3으로 증가 (Master 데이터 병렬 로딩 허용)

// 진행 중인 요청 캐시 (중복 요청 제거용)
// Key: URL + Params string, Value: Promise
const pendingRequests = new Map();

/**
 * 재시도 가능한 에러인지 확인
 */
const isRetryableError = (error, status) => {
  if (status && RETRY_CONFIG.retryableStatusCodes.includes(status)) {
    return true;
  }
  // 네트워크 오류
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  return false;
};

/**
 * 지연 함수
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 재시도 로직이 포함된 fetch 래퍼
 */
const fetchWithRetry = async (url, options = {}, retryCount = 0) => {
  try {
    const response = await fetch(url, options);

    // 성공 응답 or 304 Not Modified
    if (response.ok || response.status === 304) {
      return response;
    }

    // 재시도 가능한 에러이고 재시도 횟수가 남아있으면 재시도
    if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(null, response.status)) {
      await delay(RETRY_CONFIG.retryDelay * (retryCount + 1)); // 지수 백오프
      return fetchWithRetry(url, options, retryCount + 1);
    }

    // 재시도 불가능하거나 최대 재시도 횟수 초과
    return response;
  } catch (error) {
    // 네트워크 오류 등
    if (retryCount < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
      await delay(RETRY_CONFIG.retryDelay * (retryCount + 1));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
};

/**
 * API 응답 처리 (에러 핸들링 포함)
 */
const handleResponse = async (response, errorMessage = '요청 실패') => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || errorMessage;
    const error = new Error(message);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
};

/**
 * 스마트 API 요청 래퍼
 * 1. 중복 요청 제거 (Deduplication)
 * 2. 대기열 처리 (Queueing) - heavyRequest: true 인 경우만
 */
// 캐시 저장소 (In-Memory)
const memoryCache = new Map();
// Key: URL, Value: { data, timestamp, promise (if pending) }

/**
 * 캐시 설정
 */
const CACHE_CONFIG = {
  dataTTL: 1000 * 60 * 60, // 1시간 (데이터 유효 데이터로 간주하는 시간) - 이 시간 내에는 캐시 즉시 반환 + 백그라운드 갱신
  // 만약 "백그라운드 갱신 없이 캐시만 사용"하고 싶다면 별도 옵션 필요하지만, SWR은 항상 백그라운드 갱신을 전제로 함
};

/**
 * 실제 요청 실행 함수 (헬퍼 함수)
 * smartFetch 외부에 정의하여 순환 참조 방지
 */
const executeRequestWithQueue = async (reqUrl, reqOptions, isHeavy, errMsg) => {
  // 실제 요청 실행 함수
  const execute = async () => {
    const response = await fetchWithRetry(reqUrl, reqOptions);
    return handleResponse(response, errMsg);
  };

  if (isHeavy) {
    return heavyRequestQueue.add(execute);
  }
  return execute();
};

/**
 * 스마트 API 요청 래퍼
 * 1. 중복 요청 제거 (Deduplication)
 * 2. 대기열 처리 (Queueing) - heavyRequest: true 인 경우만
 * 3. SWR 캐싱 (Stale-While-Revalidate) - cache: true 인 경우만
 */
const smartFetch = async (url, options = {}, config = {}) => {
  const {
    heavyRequest = false,
    errorMessage = '요청 실패',
    useCache = false, // 캐시 사용 여부
    forceRefresh = false // 강제 새로고침 여부 (캐시 무시)
  } = config;

  // 1. 캐시 키 생성
  // POST/PUT 등 부작용이 있는 요청은 캐싱하면 안 됨
  const isCacheable = (!options.method || options.method === 'GET') && useCache;
  const cacheKey = isCacheable ? `${url}` : null;

  // 2. [Case A] 강제 새로고침이 아니고, 캐시가 존재하면 즉시 반환 (SWR 핵심)
  if (cacheKey && !forceRefresh && memoryCache.has(cacheKey)) {
    const cachedItem = memoryCache.get(cacheKey);
    // 캐시가 너무 오래되지 않았는지 확인 (예: 24시간 지난 건 삭제 등 - 현재는 무조건 반환 후 갱신)
    // 여기서는 "즉시 반환"을 위해 바로 리턴.
    // 단, 백그라운드 갱신을 위해 아래 로직을 "비동기"로 실행해야 함.

    // 백그라운드 갱신 시작 (결과를 기다리지 않음)
    // 🔥 주의: React 상태 업데이트 등이 연동되지 않으므로, 다음 번 접근 시 최신 데이터가 됨.
    // 만약 "보고 있는 화면"을 실시간 갱신하고 싶다면 별도 이벤트나 Hook이 필요함.
    // 사용자는 "백그라운드에서 조용히 진행"을 원했으므로 이 방식이 적합.

    // 중복 갱신 방지: 이미 갱신 요청이 진행 중이면 스킵
    if (!cachedItem.isRefreshing) {
      cachedItem.isRefreshing = true;
      // 대기열 로직을 태워서 백그라운드 실행
      (async () => {
        try {
          const freshData = await executeRequestWithQueue(url, options, heavyRequest, errorMessage);
          // 갱신 성공 시 캐시 업데이트 (요구사항 4.1)
          memoryCache.set(cacheKey, {
            data: freshData,
            timestamp: Date.now(),
            isRefreshing: false
          });
          // console.log(`[SmartFetch] 백그라운드 캐시 갱신 완료: ${cacheKey}`);
        } catch (err) {
          // 🔥 태스크 10.2, 10.3: 백그라운드 갱신 에러 처리 강화 (요구사항 4.2, 4.4)
          console.warn(`[SmartFetch] 백그라운드 캐시 갱신 실패: ${cacheKey}`, {
            오류타입: err.name || 'Error',
            오류메시지: err.message,
            상태코드: err.status,
            타임스탬프: new Date().toISOString()
          });
          
          // 실패 시 플래그 해제 및 캐시 무효화 (다음 요청 시 새로 가져오도록)
          cachedItem.isRefreshing = false;
          
          // 캐시 갱신 실패 시 캐시 무효화 (요구사항 4.4)
          // 기존 캐시는 유지하되, 다음 요청 시 강제로 새로 가져오도록 만료 시간을 과거로 설정
          if (memoryCache.has(cacheKey)) {
            const existingCache = memoryCache.get(cacheKey);
            memoryCache.set(cacheKey, {
              ...existingCache,
              timestamp: 0, // 만료된 것으로 표시
              isRefreshing: false
            });
          }
        }
      })();
    }

    return cachedItem.data;
  }

  // 3. [Case B] 캐시가 없거나 강제 새로고침인 경우 -> 실제 네트워크 요청

  // 중복 요청 방지 (De-duplication)
  if (cacheKey && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // 요청 생성 및 대기열 등록
  const requestPromise = executeRequestWithQueue(url, options, heavyRequest, errorMessage)
    .then(data => {
      // 성공 시 캐시에 저장
      if (cacheKey) {
        memoryCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          isRefreshing: false
        });
        pendingRequests.delete(cacheKey); // 진행 중 목록에서 제거
      }
      return data;
    })
    .catch(err => {
      if (cacheKey) pendingRequests.delete(cacheKey); // 에러 시에도 진행 중 목록에서 제거
      throw err;
    });

  // 진행 중 목록(Pending)에 등록
  if (cacheKey) {
    pendingRequests.set(cacheKey, requestPromise);
  }

  return requestPromise;
};


/**
 * 직영점모드 API 클라이언트
 */
export const directStoreApiClient = {
  // === 설정 및 기초 데이터 ===

  /**
   * 설정 조회
   */
  getSettings: async () => {
    return smartFetch(`${BASE_URL}/settings`, {}, { errorMessage: '설정 조회 실패' });
  },

  /**
   * 설정 저장
   */
  saveSettings: async (settings) => {
    return smartFetch(`${BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }, { errorMessage: '설정 저장 실패' });
  },

  // === 상품 데이터 ===

  /**
   * 단말 마스터 조회 (신규) - Heavy Request
   */
  getMobilesMaster: async (carrier, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (carrier) params.append('carrier', carrier);

      const data = await smartFetch(
        `${BASE_URL}/mobiles-master?${params.toString()}`,
        {},
        { heavyRequest: true, errorMessage: '단말 마스터 조회 실패', useCache: !options.forceRefresh, forceRefresh: options.forceRefresh }
      );
      return data.data || [];
    } catch (error) {
      console.error('단말 마스터 조회 실패:', error);
      return [];
    }
  },

  /**
   * 요금제 마스터 조회 (신규) - Heavy Request
   */
  getPlansMaster: async (carrier, forceRefresh = false) => {
    try {
      const params = new URLSearchParams();
      if (carrier) params.append('carrier', carrier);

      const data = await smartFetch(
        `${BASE_URL}/plans-master?${params.toString()}`,
        {},
        { heavyRequest: true, errorMessage: '요금제 마스터 조회 실패', useCache: !forceRefresh, forceRefresh }
      );
      return data.data || [];
    } catch (error) {
      console.error('요금제 마스터 조회 실패:', error);
      return [];
    }
  },

  /**
   * 단말 요금정책 조회 (신규) - Heavy Request
   */
  getMobilesPricing: async (carrier, filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (carrier) params.append('carrier', carrier);
      if (filters.modelId) params.append('modelId', filters.modelId);
      if (filters.planGroup) params.append('planGroup', filters.planGroup);
      if (filters.openingType) params.append('openingType', filters.openingType);

      const data = await smartFetch(
        `${BASE_URL}/mobiles-pricing?${params.toString()}`,
        {},
        { heavyRequest: true, errorMessage: '단말 요금정책 조회 실패', useCache: !filters.forceRefresh, forceRefresh: filters.forceRefresh }
      );
      return data.data || [];
    } catch (error) {
      console.error('단말 요금정책 조회 실패:', error);
      return [];
    }
  },

  /**
   * 마스터 데이터 재빌드 트리거 (신규)
   */
  rebuildMaster: async (carrier) => {
    const params = new URLSearchParams();
    if (carrier) params.append('carrier', carrier);

    return smartFetch(`${BASE_URL}/rebuild-master?${params.toString()}`, {
      method: 'POST'
    }, { errorMessage: '마스터 데이터 재빌드 실패' });
  },

  /**
   * Discord 메시지 ID를 통한 이미지 재업로드
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  refreshImagesFromDiscord: async (carrier) => {
    const params = new URLSearchParams();
    if (carrier) params.append('carrier', carrier);

    return smartFetch(`${BASE_URL}/refresh-images-from-discord?${params.toString()}`, {
      method: 'POST'
    }, { errorMessage: '이미지 갱신 실패' });
  },

  /**
   * 오늘의 휴대폰 조회
   */
  getTodaysMobiles: async (forceRefresh = false) => {
    try {
      const data = await smartFetch(`${BASE_URL}/todays-mobiles`, {}, { errorMessage: '오늘의 휴대폰 조회 실패', useCache: !forceRefresh, forceRefresh });
      return data.premium && data.budget ? data : {
        premium: data.premium || [],
        budget: data.budget || []
      };
    } catch (error) {
      console.error('오늘의 휴대폰 조회 실패:', error);
      return { premium: [], budget: [] };
    }
  },

  /**
   * 휴대폰 목록 조회 (Legacy: 마스터 API로 대체 예정)
   */
  getMobileList: async (carrier, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (carrier) params.append('carrier', carrier);
      if (options.withMeta) params.append('meta', '1');

      const data = await smartFetch(
        `${BASE_URL}/mobiles?${params.toString()}`,
        {},
        { errorMessage: '휴대폰 목록 조회 실패' }
      );

      if (options.withMeta) {
        const list = Array.isArray(data) ? data : (data.data || data.mobileList || []);
        const meta = data.meta || {};
        return { list, meta };
      }

      return Array.isArray(data) ? data : (data.data || data.mobileList || []);
    } catch (error) {
      console.error('휴대폰 목록 조회 실패:', error);
      return [];
    }
  },

  // === 판매일보 ===

  /**
   * 판매일보 조회
   */
  getSalesReports: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      return await smartFetch(`${BASE_URL}/sales?${params.toString()}`, {}, { errorMessage: '판매일보 조회 실패' });
    } catch (error) {
      console.error('판매일보 조회 실패:', error);
      return [];
    }
  },

  /**
   * 판매일보 등록
   */
  createSalesReport: async (data) => {
    return smartFetch(`${BASE_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, { errorMessage: '판매일보 등록 실패' });
  },

  /**
   * 판매일보 수정
   */
  updateSalesReport: async (id, data) => {
    return smartFetch(`${BASE_URL}/sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, { errorMessage: '판매일보 수정 실패' });
  },

  // === 구분 태그 업데이트 ===

  /**
   * 구분 태그 업데이트
   */
  updateMobileTags: async (modelId, payload) => {
    try {
      return await smartFetch(`${BASE_URL}/mobiles/${modelId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, { errorMessage: '구분 태그 업데이트 실패' });
    } catch (error) {
      console.error('구분 태그 업데이트 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  // === 이미지 업로드 ===

  /**
   * 이미지 업로드 (Discord)
   */
  uploadImage: async (file, modelId, carrier, modelName, petName) => {
    const formData = new FormData();
    formData.append('image', file);
    if (modelId) formData.append('modelId', modelId);
    if (carrier) formData.append('carrier', carrier);
    if (modelName) formData.append('modelName', modelName);
    if (petName) formData.append('petName', petName);

    try {
      return await smartFetch(`${BASE_URL}/upload-image`, {
        method: 'POST',
        body: formData
      }, { errorMessage: '이미지 업로드 실패' });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
      }
      throw error;
    }
  },

  // === 직영점 관리 모드 API ===

  /**
   * 정책 설정 조회
   * @param {string} carrier - 통신사 (SK, KT, LG)
   * @param {boolean} noCache - 캐시 무시 여부 (기본값: false)
   */
  getPolicySettings: async (carrier, forceRefresh = false) => {
    try {
      const url = `${BASE_URL}/policy-settings?carrier=${carrier}`;

      // 정책 설정 조회도 Heavy Request로 취급
      return await smartFetch(url, {}, { heavyRequest: true, errorMessage: '정책 설정 조회 실패', useCache: !forceRefresh, forceRefresh });
    } catch (error) {
      console.error('정책 설정 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 정책 설정 저장
   */
  savePolicySettings: async (carrier, settings) => {
    try {
      return await smartFetch(`${BASE_URL}/policy-settings?carrier=${carrier}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }, { errorMessage: '정책 설정 저장 실패' });
    } catch (error) {
      console.error('정책 설정 저장 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 링크 설정 조회
   */
  getLinkSettings: async (carrier) => {
    try {
      return await smartFetch(`${BASE_URL}/link-settings?carrier=${carrier}`, {}, { errorMessage: '링크 설정 조회 실패' });
    } catch (error) {
      console.error('링크 설정 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 링크 설정 저장
   */
  saveLinkSettings: async (carrier, settings) => {
    try {
      return await smartFetch(`${BASE_URL}/link-settings?carrier=${carrier}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      }, { errorMessage: '링크 설정 저장 실패' });
    } catch (error) {
      console.error('링크 설정 저장 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 범위 데이터 조회
   */
  fetchRangeData: async (sheetId, range, unique = false) => {
    try {
      const params = new URLSearchParams();
      params.append('sheetId', sheetId);
      params.append('range', range);
      if (unique) params.append('unique', 'true');

      // Heavy Request? Maybe
      return await smartFetch(
        `${BASE_URL}/link-settings/fetch-range?${params.toString()}`,
        {},
        { heavyRequest: true, errorMessage: '범위 데이터 조회 실패' }
      );
    } catch (error) {
      console.error('범위 데이터 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error), data: [] };
    }
  },

  /**
   * 요금제군 조회
   */
  fetchPlanGroups: async (sheetId, range) => {
    try {
      const params = new URLSearchParams();
      params.append('sheetId', sheetId);
      params.append('range', range);

      return await smartFetch(
        `${BASE_URL}/link-settings/plan-groups?${params.toString()}`,
        {},
        { heavyRequest: true, errorMessage: '요금제군 조회 실패' }
      );
    } catch (error) {
      console.error('요금제군 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error), planGroups: [] };
    }
  },

  /**
   * 가격 계산
   */
  calculateMobilePrice: async (modelId, planGroup, openingType, carrier, modelName = null) => {
    try {
      const params = new URLSearchParams();
      params.append('planGroup', planGroup);
      params.append('openingType', openingType || '010신규');
      params.append('carrier', carrier);
      if (modelName) {
        params.append('modelName', modelName);
      }

      // smartFetch 사용 (직접 호출 대신)
      // 404 처리는 smartFetch 내부에서는 에러로 던져지므로 catch에서 잡아야 함
      // 하지만 404는 fetchWithRetry에서 throw하지 않고 response 리턴해주면 좋겠지만
      // smartFetch 로직상 handleResponse를 거치므로 에러가 됨.
      // 여기서는 404 특수 처리를 위해 별도 fetchWithRetry 사용 유지 고려했지만
      // smartFetch로도 에러 객체의 status 확인 가능.

      try {
        const data = await smartFetch(`${BASE_URL}/mobiles/${modelId}/calculate?${params.toString()}`, {}, { errorMessage: '가격 계산 실패' });
        return data;
      } catch (e) {
        if (e.status === 404) {
          const errorData = e.data || {};
          return { success: false, error: errorData.error || '모델을 찾을 수 없습니다.', status: 404 };
        }
        throw e;
      }
    } catch (error) {
      console.error('가격 계산 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  // === 메인페이지 문구 설정 ===

  /**
   * 메인페이지 문구 조회
   */
  getMainPageTexts: async () => {
    try {
      return await smartFetch(`${BASE_URL}/main-page-texts`, {}, { errorMessage: '문구 조회 실패' });
    } catch (error) {
      console.error('문구 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 메인헤더 문구 조회
   */
  getMainHeaderText: async () => {
    try {
      const data = await smartFetch(`${BASE_URL}/main-page-texts`, {}, { errorMessage: '메인헤더 문구 조회 실패' });
      return { success: true, data: data.data?.mainHeader || null };
    } catch (error) {
      console.error('메인헤더 문구 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 연결페이지 문구 조회
   */
  getTransitionPageText: async (carrier, category) => {
    try {
      const data = await smartFetch(`${BASE_URL}/main-page-texts`, {}, { errorMessage: '연결페이지 문구 조회 실패' });
      const text = data.data?.transitionPages?.[carrier]?.[category] || null;
      return { success: true, data: text };
    } catch (error) {
      console.error('연결페이지 문구 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 문구 저장
   */
  saveMainPageText: async (carrier, category, textType, content, imageUrl = '') => {
    try {
      return await smartFetch(`${BASE_URL}/main-page-texts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, category, textType, content, imageUrl })
      }, { errorMessage: '문구 저장 실패' });
    } catch (error) {
      console.error('문구 저장 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 대중교통 위치 목록 조회 (모든 위치)
   */
  getAllTransitLocations: async () => {
    try {
      return await smartFetch(`${BASE_URL}/transit-location/all`, {}, { errorMessage: '대중교통 위치 목록 조회 실패' });
    } catch (error) {
      console.error('대중교통 위치 목록 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error), data: [] };
    }
  },

  /**
   * 대중교통 위치 생성
   */
  createTransitLocation: async (type, name, address) => {
    try {
      return await smartFetch(`${BASE_URL}/transit-location/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, address })
      }, { errorMessage: '대중교통 위치 생성 실패' });
    } catch (error) {
      console.error('대중교통 위치 생성 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 대중교통 위치 수정
   */
  updateTransitLocation: async (id, type, name, address) => {
    try {
      return await smartFetch(`${BASE_URL}/transit-location/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, address })
      }, { errorMessage: '대중교통 위치 수정 실패' });
    } catch (error) {
      console.error('대중교통 위치 수정 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 대중교통 위치 삭제
   */
  deleteTransitLocation: async (id) => {
    try {
      return await smartFetch(`${BASE_URL}/transit-location/${id}`, {
        method: 'DELETE'
      }, { errorMessage: '대중교통 위치 삭제 실패' });
    } catch (error) {
      console.error('대중교통 위치 삭제 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 대중교통 위치 저장 (매장별 ID 목록)
   */
  saveTransitLocation: async (storeName, busTerminalIds, subwayStationIds) => {
    try {
      return await smartFetch(`${BASE_URL}/transit-location/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, busTerminalIds, subwayStationIds })
      }, { errorMessage: '대중교통 위치 저장 실패' });
    } catch (error) {
      console.error('대중교통 위치 저장 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 대중교통 위치 조회 (매장별)
   */
  getTransitLocations: async () => {
    try {
      return await smartFetch(`${BASE_URL}/transit-location/list`, {}, { errorMessage: '대중교통 위치 조회 실패' });
    } catch (error) {
      console.error('대중교통 위치 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error), data: [] };
    }
  },

  /**
   * 연결페이지 이미지 업로드
   */
  uploadTransitionPageImage: async (file, carrier, category) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('carrier', carrier);
      formData.append('category', category);

      return await smartFetch(`${BASE_URL}/upload-transition-page-image`, {
        method: 'POST',
        body: formData
      }, { errorMessage: '이미지 업로드 실패' });
    } catch (error) {
      console.error('연결페이지 이미지 업로드 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 매장별 슬라이드쇼 설정 조회
   */
  getStoreSlideshowSettings: async (storeId) => {
    try {
      return await smartFetch(`${BASE_URL}/store-slideshow-settings?storeId=${encodeURIComponent(storeId)}`, {}, { errorMessage: '슬라이드쇼 설정 조회 실패' });
    } catch (error) {
      console.error('슬라이드쇼 설정 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 매장별 슬라이드쇼 설정 저장
   */
  saveStoreSlideshowSettings: async (storeId, slideSettings, mainHeaderText, transitionPageTexts) => {
    try {
      return await smartFetch(`${BASE_URL}/store-slideshow-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId,
          slideSettings,
          mainHeaderText,
          transitionPageTexts
        })
      }, { errorMessage: '슬라이드쇼 설정 저장 실패' });
    } catch (error) {
      console.error('슬라이드쇼 설정 저장 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  /**
   * 매장별 메인페이지 문구 조회 (기본값 우선순위 처리)
   */
  getStoreMainPageTexts: async (storeId) => {
    try {
      return await smartFetch(`${BASE_URL}/store-main-page-texts?storeId=${encodeURIComponent(storeId)}`, {}, { errorMessage: '매장별 메인페이지 문구 조회 실패' });
    } catch (error) {
      console.error('매장별 메인페이지 문구 조회 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  },

  // === 캐시 관리 ===

  /**
   * 통신사별 캐시 무효화
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  clearCacheByCarrier: (carrier) => {
    let clearedCount = 0;
    
    // 해당 통신사 관련 캐시만 삭제
    for (const [key] of memoryCache.entries()) {
      if (key.includes(carrier)) {
        memoryCache.delete(key);
        clearedCount++;
      }
    }
    
    // 진행 중인 요청도 삭제
    for (const [key] of pendingRequests.entries()) {
      if (key.includes(carrier)) {
        pendingRequests.delete(key);
      }
    }
    
    console.log(`✅ [API Client] ${carrier} 캐시 초기화 완료 (${clearedCount}개 항목)`);
  },

  /**
   * 이미지 캐시만 무효화
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  clearImageCache: (carrier) => {
    let clearedCount = 0;
    
    // 이미지 관련 캐시만 삭제 (mobiles-master에 이미지 URL이 포함됨)
    for (const [key] of memoryCache.entries()) {
      if (key.includes('mobiles-master') && key.includes(carrier)) {
        memoryCache.delete(key);
        clearedCount++;
      }
    }
    
    console.log(`✅ [API Client] ${carrier} 이미지 캐시 초기화 완료 (${clearedCount}개 항목)`);
  },

  /**
   * 전체 캐시 무효화
   */
  clearCache: () => {
    const cacheSize = memoryCache.size;
    const pendingSize = pendingRequests.size;
    
    memoryCache.clear();
    pendingRequests.clear();
    
    console.log(`✅ [API Client] 전체 캐시 초기화 완료 (캐시: ${cacheSize}개, 진행중: ${pendingSize}개)`);
  },

  /**
   * 캐시 통계 조회 (디버깅용)
   */
  getCacheStats: () => {
    return {
      cacheSize: memoryCache.size,
      pendingRequests: pendingRequests.size,
      cacheKeys: Array.from(memoryCache.keys())
    };
  }
};
