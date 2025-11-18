/**
 * API 호출 재시도 메커니즘
 * 네트워크 에러 및 일시적 서버 오류에 대한 자동 복구
 * 98% 이상 성공률 달성을 위한 핵심 유틸리티
 */

/**
 * 네트워크 에러 또는 재시도 가능한 에러인지 확인
 */
function isRetryableError(error, response) {
  // 네트워크 에러
  if (!response) {
    const errorMessage = (error?.message || '').toLowerCase();
    return (
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('cors') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('aborted') ||
      error?.name === 'TypeError' ||
      error?.name === 'NetworkError'
    );
  }

  // 재시도 가능한 HTTP 상태 코드
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (retryableStatusCodes.includes(response.status)) {
    return true;
  }

  // Google Sheets API 할당량 초과 오류 (특수 처리)
  if (response.status === 500 || response.status === 429) {
    try {
      // 응답 본문에서 Quota exceeded 확인 시도 (비동기)
      return false; // 일단 재시도 가능한 것으로 간주 (상세 확인은 별도)
    } catch {
      return true;
    }
  }

  return false;
}

/**
 * 재시도 지연 시간 계산 (지수 백오프)
 */
function getRetryDelay(attempt, baseDelay = 1000, maxDelay = 10000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  // Jitter 추가 (동시 재시도 방지)
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

/**
 * fetch 호출에 재시도 메커니즘 추가
 * 
 * @param {string|Request} url - 요청 URL 또는 Request 객체
 * @param {Object} options - fetch 옵션
 * @param {number} options.maxRetries - 최대 재시도 횟수 (기본: 3)
 * @param {number} options.baseDelay - 기본 재시도 지연 시간 (밀리초, 기본: 1000)
 * @param {number} options.maxDelay - 최대 재시도 지연 시간 (밀리초, 기본: 10000)
 * @param {number} options.timeout - 요청 타임아웃 (밀리초, 기본: 30000)
 * @param {Function} options.shouldRetry - 커스텀 재시도 조건 함수 (선택)
 * @returns {Promise<Response>} 응답 객체
 */
export async function fetchWithRetry(url, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    timeout = 30000,
    shouldRetry = null,
    ...fetchOptions
  } = options;

  let lastError = null;
  let lastResponse = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 타임아웃 설정
      const abortController = new AbortController();
      const timeoutId = timeout ? setTimeout(() => abortController.abort(), timeout) : null;

      // AbortSignal 병합 (기존 signal이 있으면 병합)
      const signal = fetchOptions.signal
        ? (() => {
            const combinedAbortController = new AbortController();
            
            // 기존 signal 리스너
            fetchOptions.signal.addEventListener('abort', () => {
              combinedAbortController.abort();
            });
            
            // 타임아웃 리스너
            abortController.signal.addEventListener('abort', () => {
              combinedAbortController.abort();
            });
            
            return combinedAbortController.signal;
          })()
        : abortController.signal;

      const response = await fetch(url, {
        ...fetchOptions,
        signal,
      }).catch((fetchError) => {
        clearTimeout(timeoutId);
        
        // AbortError 처리
        if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
          const timeoutError = new Error('요청 시간이 초과되었습니다.');
          timeoutError.name = 'TimeoutError';
          timeoutError.isTimeout = true;
          throw timeoutError;
        }
        
        // 네트워크 에러 처리
        const networkError = new Error(`네트워크 오류: ${fetchError.message}`);
        networkError.name = 'NetworkError';
        networkError.isNetworkError = true;
        networkError.originalError = fetchError;
        throw networkError;
      });

      clearTimeout(timeoutId);

      // 응답 확인
      if (!response.ok) {
        // 응답 본문 확인 (에러 메시지 추출)
        let errorText = '';
        let errorData = null;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.clone().json();
            errorText = errorData?.message || errorData?.error || '';
          } else {
            errorText = await response.clone().text();
          }
        } catch {
          // 응답 본문 읽기 실패는 무시
        }

        // Google Sheets API 할당량 초과 오류 (특수 처리)
        if ((response.status === 500 || response.status === 429) && 
            (errorText.includes('Quota exceeded') || errorText.includes('quota'))) {
          lastResponse = response;
          lastError = new Error('Google Sheets API 할당량이 초과되었습니다.');
          lastError.status = response.status;
          lastError.isQuotaExceeded = true;
          
          // 할당량 초과는 더 긴 대기 시간 필요
          if (attempt < maxRetries) {
            const quotaDelay = getRetryDelay(attempt, baseDelay * 3, maxDelay * 2);
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [fetchWithRetry] 할당량 초과, 재시도 ${attempt}/${maxRetries} (${Math.round(quotaDelay)}ms 대기)`);
            }
            await new Promise(resolve => setTimeout(resolve, quotaDelay));
            continue;
          }
          
          throw lastError;
        }

        // 커스텀 재시도 조건 확인
        if (shouldRetry && typeof shouldRetry === 'function') {
          const shouldRetryResult = await shouldRetry(response, errorData || errorText, attempt);
          if (!shouldRetryResult) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
          }
        }

        // 재시도 가능한 에러인지 확인
        if (isRetryableError(null, response)) {
          lastResponse = response;
          lastError = new Error(`HTTP error! status: ${response.status}`);
          lastError.status = response.status;
          lastError.response = response;
          
          if (attempt < maxRetries) {
            const delay = getRetryDelay(attempt, baseDelay, maxDelay);
            if (process.env.NODE_ENV === 'development') {
              console.warn(`⚠️ [fetchWithRetry] 재시도 ${attempt}/${maxRetries} (${Math.round(delay)}ms 대기): ${response.status} ${response.statusText}`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // 재시도 불가능한 에러
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // 성공
      if (process.env.NODE_ENV === 'development' && attempt > 1) {
        console.log(`✅ [fetchWithRetry] 재시도 성공: ${attempt}/${maxRetries}`);
      }
      return response;

    } catch (error) {
      lastError = error;
      
      // 재시도 가능한 에러인지 확인
      const isRetryable = isRetryableError(error, lastResponse);
      
      if (isRetryable && attempt < maxRetries) {
        const delay = getRetryDelay(attempt, baseDelay, maxDelay);
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ [fetchWithRetry] 재시도 ${attempt}/${maxRetries} (${Math.round(delay)}ms 대기): ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // 마지막 시도 실패 또는 재시도 불가능한 에러
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ [fetchWithRetry] 모든 재시도 실패 (${attempt}/${maxRetries}):`, error);
      }
      throw error;
    }
  }

  // 이론상 도달 불가능하지만 안전장치
  throw lastError || new Error('알 수 없는 오류가 발생했습니다.');
}

/**
 * JSON 응답을 포함한 fetchWithRetry 래퍼
 */
export async function fetchJsonWithRetry(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  const data = await response.json();
  return { response, data };
}

