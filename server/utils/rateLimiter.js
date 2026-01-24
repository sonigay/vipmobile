/**
 * Rate Limiter with Exponential Backoff
 * 
 * Google Sheets API 호출 빈도를 제한하고, Rate Limit 에러 발생 시
 * exponential backoff 전략으로 자동 재시도합니다.
 * 
 * Features:
 * - 연속된 API 호출 간 최소 500ms 간격 보장
 * - Rate Limit 에러 감지 (429, RESOURCE_EXHAUSTED)
 * - Exponential backoff 재시도 (최대 5회)
 * - 재시도 간격: 3초 * 2^attempt + jitter (최대 60초)
 * 
 * @module utils/rateLimiter
 */

/**
 * Rate Limiter 클래스
 * 싱글톤 패턴으로 구현되어 전역에서 하나의 인스턴스만 사용
 */
class RateLimiter {
  /**
   * RateLimiter 생성자
   * 
   * @param {number} cooldown - API 호출 간 최소 간격 (밀리초), 기본값 500ms
   * @param {number} maxRetries - 최대 재시도 횟수, 기본값 5회
   */
  constructor(cooldown = 500, maxRetries = 5) {
    this.lastCall = 0;
    this.cooldown = cooldown;
    this.maxRetries = maxRetries;
  }

  /**
   * API 호출을 Rate Limiting과 재시도 로직으로 감싸서 실행합니다.
   * 
   * @param {Function} apiCall - 실행할 API 호출 함수 (Promise 반환)
   * @returns {Promise<any>} API 호출 결과
   * @throws {Error} 최대 재시도 횟수 초과 시 마지막 에러를 throw
   */
  async execute(apiCall) {
    // 기본 Rate Limiting: 최소 간격 보장
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.cooldown) {
      const waitTime = this.cooldown - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        const isRateLimitError = this.isRateLimitError(error);
        
        // Rate Limit 에러이고 재시도 가능한 경우
        if (isRateLimitError && attempt < this.maxRetries - 1) {
          const jitter = Math.random() * 2000; // 0-2초 랜덤 지터
          const baseDelay = 3000; // 3초 기본 지연
          const delay = baseDelay * Math.pow(2, attempt) + jitter;
          const waitTime = Math.min(delay, 60000); // 최대 60초
          
          console.warn(`⚠️ Rate limit error, retrying in ${Math.round(waitTime)}ms (attempt ${attempt + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Rate Limit 에러가 아니거나 최대 재시도 횟수 초과
        throw error;
      }
    }
  }

  /**
   * 에러가 Rate Limit 에러인지 확인합니다.
   * 
   * @param {Error} error - 확인할 에러 객체
   * @returns {boolean} Rate Limit 에러 여부
   */
  isRateLimitError(error) {
    return error.code === 429 ||
      (error.response && error.response.status === 429) ||
      (error.message && error.message.includes('Quota exceeded')) ||
      (error.message && error.message.includes('RESOURCE_EXHAUSTED'));
  }
}

// 싱글톤 인스턴스 생성 및 export
module.exports = new RateLimiter();
