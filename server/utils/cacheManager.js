/**
 * Cache Manager
 * 
 * 메모리 기반 캐시 시스템으로 Google Sheets API 호출을 최소화합니다.
 * 
 * Features:
 * - TTL (Time To Live) 기반 자동 만료
 * - 크기 제한 (FIFO 방식)
 * - 패턴 기반 삭제
 * - 캐시 상태 조회
 * 
 * @module utils/cacheManager
 */

/**
 * 캐시 시스템 클래스
 * 싱글톤 패턴으로 구현되어 전역에서 하나의 인스턴스만 사용
 */
class CacheManager {
  /**
   * CacheManager 생성자
   * 
   * @param {number} ttl - 기본 TTL (밀리초), 기본값: 5분 (300,000ms)
   * @param {number} maxSize - 최대 캐시 항목 수, 기본값: 200개
   */
  constructor(ttl = 5 * 60 * 1000, maxSize = 200) {
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  /**
   * 캐시에 데이터를 저장합니다.
   * 캐시 크기가 maxSize를 초과하면 가장 오래된 항목(FIFO)을 삭제합니다.
   * 
   * @param {string} key - 캐시 키
   * @param {any} data - 저장할 데이터
   * @param {number|null} customTtl - 커스텀 TTL (밀리초), null이면 기본 TTL 사용
   * @returns {void}
   */
  set(key, data, customTtl = null) {
    const now = Date.now();
    const ttl = customTtl || this.ttl;
    
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: now + ttl
    });

    // 캐시 크기 제한 - FIFO 방식으로 가장 오래된 항목 삭제
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * 캐시에서 데이터를 조회합니다.
   * TTL이 만료된 경우 자동으로 삭제하고 null을 반환합니다.
   * 
   * @param {string} key - 캐시 키
   * @returns {any|null} 캐시된 데이터 또는 null (없거나 만료된 경우)
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 특정 키의 캐시를 삭제합니다.
   * 
   * @param {string} key - 삭제할 캐시 키
   * @returns {boolean} 삭제 성공 여부
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 패턴과 일치하는 모든 캐시 항목을 삭제합니다.
   * 
   * @param {string} pattern - 삭제할 키의 시작 패턴
   * @returns {number} 삭제된 항목 수
   */
  deletePattern(pattern) {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * 만료된 캐시 항목을 정리합니다.
   * 
   * @returns {number} 정리된 항목 수
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * 캐시 상태를 조회합니다.
   * 
   * @returns {Object} 캐시 상태 정보
   * @returns {number} return.total - 전체 캐시 항목 수
   * @returns {number} return.valid - 유효한 캐시 항목 수
   * @returns {number} return.expired - 만료된 캐시 항목 수
   */
  status() {
    const now = Date.now();
    const validItems = Array.from(this.cache.entries())
      .filter(([key, item]) => now <= item.ttl);
    
    return {
      total: this.cache.size,
      valid: validItems.length,
      expired: this.cache.size - validItems.length
    };
  }

  /**
   * 모든 캐시를 삭제합니다.
   * 
   * @returns {void}
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 캐시의 모든 키를 반환합니다.
   * 
   * @returns {string[]} 캐시 키 배열
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * 캐시 항목 수를 반환합니다.
   * 
   * @returns {number} 캐시 항목 수
   */
  size() {
    return this.cache.size;
  }
}

// 싱글톤 인스턴스 생성 및 export
module.exports = new CacheManager();
