/**
 * Cache Monitor Module
 * 
 * 캐시 크기와 동시 요청 수를 모니터링하고 경고를 발생시킵니다.
 * 
 * 요구사항:
 * - 10.3: 캐시 크기가 임계값을 초과하면 경고 로그 출력
 * - 10.4: 동시 요청 수가 임계값을 초과하면 경고 로그 출력
 */

/**
 * 캐시 크기 임계값
 */
const CACHE_SIZE_THRESHOLDS = {
  WARNING: 180,  // 90% of max (200)
  CRITICAL: 195  // 97.5% of max (200)
};

/**
 * 동시 요청 수 임계값
 */
const CONCURRENT_REQUESTS_THRESHOLDS = {
  WARNING: 8,   // 80% of typical max (10)
  CRITICAL: 12  // 120% of typical max (10)
};

/**
 * 캐시 크기 모니터링 클래스
 */
class CacheMonitor {
  constructor(options = {}) {
    this.maxCacheSize = options.maxCacheSize || 200;
    this.warningThreshold = options.warningThreshold || CACHE_SIZE_THRESHOLDS.WARNING;
    this.criticalThreshold = options.criticalThreshold || CACHE_SIZE_THRESHOLDS.CRITICAL;
    this.checkInterval = options.checkInterval || 60000; // 1분마다 체크
    this.lastWarningTime = 0;
    this.warningCooldown = 300000; // 5분 쿨다운
  }

  /**
   * 캐시 크기를 확인하고 필요시 경고를 발생시킵니다.
   * @param {number} currentSize - 현재 캐시 크기
   * @param {string} cacheName - 캐시 이름 (로깅용)
   */
  checkCacheSize(currentSize, cacheName = 'default') {
    const now = Date.now();
    const usagePercent = Math.round((currentSize / this.maxCacheSize) * 100);
    
    // 쿨다운 체크 (너무 자주 경고하지 않도록)
    if (now - this.lastWarningTime < this.warningCooldown) {
      return;
    }
    
    if (currentSize >= this.criticalThreshold) {
      console.error('🔴 [Cache Monitor] 캐시 크기 임계값 초과 (Critical):', {
        cacheName: cacheName,
        currentSize: currentSize,
        maxSize: this.maxCacheSize,
        usagePercent: usagePercent,
        threshold: 'CRITICAL',
        recommendation: 'LRU eviction이 곧 발생합니다. 캐시 크기 증가를 고려하세요.',
        timestamp: new Date().toISOString()
      });
      this.lastWarningTime = now;
    } else if (currentSize >= this.warningThreshold) {
      console.warn('⚠️ [Cache Monitor] 캐시 크기 경고:', {
        cacheName: cacheName,
        currentSize: currentSize,
        maxSize: this.maxCacheSize,
        usagePercent: usagePercent,
        threshold: 'WARNING',
        recommendation: '캐시 크기가 임계값에 근접했습니다.',
        timestamp: new Date().toISOString()
      });
      this.lastWarningTime = now;
    }
  }

  /**
   * 캐시 통계를 반환합니다.
   * @param {number} currentSize - 현재 캐시 크기
   * @returns {Object} 캐시 통계
   */
  getStats(currentSize) {
    const usagePercent = Math.round((currentSize / this.maxCacheSize) * 100);
    const remainingCapacity = this.maxCacheSize - currentSize;
    
    return {
      currentSize: currentSize,
      maxSize: this.maxCacheSize,
      usagePercent: usagePercent,
      remainingCapacity: remainingCapacity,
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      status: this.getStatus(currentSize)
    };
  }

  /**
   * 현재 캐시 상태를 반환합니다.
   * @param {number} currentSize - 현재 캐시 크기
   * @returns {string} 상태 ('normal', 'warning', 'critical')
   */
  getStatus(currentSize) {
    if (currentSize >= this.criticalThreshold) {
      return 'critical';
    } else if (currentSize >= this.warningThreshold) {
      return 'warning';
    }
    return 'normal';
  }
}

/**
 * 동시 요청 수 모니터링 클래스
 */
class ConcurrentRequestsMonitor {
  constructor(options = {}) {
    this.warningThreshold = options.warningThreshold || CONCURRENT_REQUESTS_THRESHOLDS.WARNING;
    this.criticalThreshold = options.criticalThreshold || CONCURRENT_REQUESTS_THRESHOLDS.CRITICAL;
    this.lastWarningTime = 0;
    this.warningCooldown = 60000; // 1분 쿨다운
    this.peakConcurrentRequests = 0;
  }

  /**
   * 동시 요청 수를 확인하고 필요시 경고를 발생시킵니다.
   * @param {number} currentCount - 현재 동시 요청 수
   * @param {string} context - 컨텍스트 정보 (로깅용)
   */
  checkConcurrentRequests(currentCount, context = 'API') {
    const now = Date.now();
    
    // 피크 값 업데이트
    if (currentCount > this.peakConcurrentRequests) {
      this.peakConcurrentRequests = currentCount;
    }
    
    // 쿨다운 체크
    if (now - this.lastWarningTime < this.warningCooldown) {
      return;
    }
    
    if (currentCount >= this.criticalThreshold) {
      console.error('🔴 [Concurrent Requests] 동시 요청 수 임계값 초과 (Critical):', {
        context: context,
        currentCount: currentCount,
        threshold: 'CRITICAL',
        criticalThreshold: this.criticalThreshold,
        peakCount: this.peakConcurrentRequests,
        recommendation: '서버 부하가 높습니다. Rate limiting 강화를 고려하세요.',
        timestamp: new Date().toISOString()
      });
      this.lastWarningTime = now;
    } else if (currentCount >= this.warningThreshold) {
      console.warn('⚠️ [Concurrent Requests] 동시 요청 수 경고:', {
        context: context,
        currentCount: currentCount,
        threshold: 'WARNING',
        warningThreshold: this.warningThreshold,
        peakCount: this.peakConcurrentRequests,
        recommendation: '동시 요청 수가 증가하고 있습니다.',
        timestamp: new Date().toISOString()
      });
      this.lastWarningTime = now;
    }
  }

  /**
   * 동시 요청 통계를 반환합니다.
   * @param {number} currentCount - 현재 동시 요청 수
   * @returns {Object} 동시 요청 통계
   */
  getStats(currentCount) {
    return {
      currentCount: currentCount,
      peakCount: this.peakConcurrentRequests,
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      status: this.getStatus(currentCount)
    };
  }

  /**
   * 현재 동시 요청 상태를 반환합니다.
   * @param {number} currentCount - 현재 동시 요청 수
   * @returns {string} 상태 ('normal', 'warning', 'critical')
   */
  getStatus(currentCount) {
    if (currentCount >= this.criticalThreshold) {
      return 'critical';
    } else if (currentCount >= this.warningThreshold) {
      return 'warning';
    }
    return 'normal';
  }

  /**
   * 피크 값을 초기화합니다.
   */
  resetPeak() {
    this.peakConcurrentRequests = 0;
  }
}

/**
 * 통합 모니터링 클래스
 */
class SystemMonitor {
  constructor(options = {}) {
    this.cacheMonitor = new CacheMonitor(options.cache);
    this.concurrentRequestsMonitor = new ConcurrentRequestsMonitor(options.concurrentRequests);
  }

  /**
   * 캐시 크기를 모니터링합니다.
   */
  checkCache(currentSize, cacheName) {
    return this.cacheMonitor.checkCacheSize(currentSize, cacheName);
  }

  /**
   * 동시 요청 수를 모니터링합니다.
   */
  checkConcurrentRequests(currentCount, context) {
    return this.concurrentRequestsMonitor.checkConcurrentRequests(currentCount, context);
  }

  /**
   * 전체 시스템 통계를 반환합니다.
   */
  getSystemStats(cacheSize, concurrentRequests) {
    return {
      cache: this.cacheMonitor.getStats(cacheSize),
      concurrentRequests: this.concurrentRequestsMonitor.getStats(concurrentRequests),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  CacheMonitor,
  ConcurrentRequestsMonitor,
  SystemMonitor,
  CACHE_SIZE_THRESHOLDS,
  CONCURRENT_REQUESTS_THRESHOLDS
};
