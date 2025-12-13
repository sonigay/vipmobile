/**
 * 직영점모드 API 클라이언트 (개선된 버전)
 * 에러 핸들링, 재시도 로직, 타입 안정성 개선
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
    
    // 성공 응답
    if (response.ok) {
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
  return response.json();
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
    const response = await fetchWithRetry(`${BASE_URL}/settings`);
    return handleResponse(response, '설정 조회 실패');
  },

  /**
   * 설정 저장
   */
  saveSettings: async (settings) => {
    const response = await fetchWithRetry(`${BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse(response, '설정 저장 실패');
  },

  // === 상품 데이터 ===

  /**
   * 오늘의 휴대폰 조회
   */
  getTodaysMobiles: async () => {
    try {
      const response = await fetchWithRetry(`${BASE_URL}/todays-mobiles`);
      const data = await handleResponse(response, '오늘의 휴대폰 조회 실패');
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
   * 휴대폰 목록 조회
   */
  getMobileList: async (carrier, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (carrier) params.append('carrier', carrier);
      if (options.withMeta) params.append('meta', '1');

      const response = await fetchWithRetry(`${BASE_URL}/mobiles?${params.toString()}`);
      const data = await handleResponse(response, '휴대폰 목록 조회 실패');
      
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

      const response = await fetchWithRetry(`${BASE_URL}/sales?${params.toString()}`);
      return handleResponse(response, '판매일보 조회 실패');
    } catch (error) {
      console.error('판매일보 조회 실패:', error);
      return [];
    }
  },

  /**
   * 판매일보 등록
   */
  createSalesReport: async (data) => {
    const response = await fetchWithRetry(`${BASE_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response, '판매일보 등록 실패');
  },

  /**
   * 판매일보 수정
   */
  updateSalesReport: async (id, data) => {
    const response = await fetchWithRetry(`${BASE_URL}/sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response, '판매일보 수정 실패');
  },

  // === 구분 태그 업데이트 ===

  /**
   * 구분 태그 업데이트
   */
  updateMobileTags: async (modelId, payload) => {
    try {
      const response = await fetchWithRetry(`${BASE_URL}/mobiles/${modelId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return handleResponse(response, '구분 태그 업데이트 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/upload-image`, {
        method: 'POST',
        body: formData
      });
      return handleResponse(response, '이미지 업로드 실패');
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
   */
  getPolicySettings: async (carrier) => {
    try {
      const response = await fetchWithRetry(`${BASE_URL}/policy-settings?carrier=${carrier}`);
      return handleResponse(response, '정책 설정 조회 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/policy-settings?carrier=${carrier}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return handleResponse(response, '정책 설정 저장 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/link-settings?carrier=${carrier}`);
      return handleResponse(response, '링크 설정 조회 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/link-settings?carrier=${carrier}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return handleResponse(response, '링크 설정 저장 실패');
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
      
      const response = await fetchWithRetry(`${BASE_URL}/link-settings/fetch-range?${params.toString()}`);
      return handleResponse(response, '범위 데이터 조회 실패');
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
      
      const response = await fetchWithRetry(`${BASE_URL}/link-settings/plan-groups?${params.toString()}`);
      return handleResponse(response, '요금제군 조회 실패');
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
      
      const response = await fetchWithRetry(`${BASE_URL}/mobiles/${modelId}/calculate?${params.toString()}`);
      
      // 404 에러는 모델을 찾을 수 없는 것이므로 재시도하지 않음
      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || '모델을 찾을 수 없습니다.', status: 404 };
      }
      
      return handleResponse(response, '가격 계산 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/main-page-texts`);
      return handleResponse(response, '문구 조회 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/main-page-texts`);
      const data = await handleResponse(response, '메인헤더 문구 조회 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/main-page-texts`);
      const data = await handleResponse(response, '연결페이지 문구 조회 실패');
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
      const response = await fetchWithRetry(`${BASE_URL}/main-page-texts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, category, textType, content, imageUrl })
      });
      return handleResponse(response, '문구 저장 실패');
    } catch (error) {
      console.error('문구 저장 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
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

      const response = await fetchWithRetry(`${BASE_URL}/upload-transition-page-image`, {
        method: 'POST',
        body: formData
      });
      return handleResponse(response, '이미지 업로드 실패');
    } catch (error) {
      console.error('연결페이지 이미지 업로드 실패:', error);
      return { success: false, error: normalizeErrorMessage(error) };
    }
  }
};
