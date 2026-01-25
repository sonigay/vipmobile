/**
 * QueryPerformanceMonitor - 쿼리 성능 모니터링
 * 
 * 기능:
 * - 쿼리 실행 시간 측정
 * - 느린 쿼리 감지 및 로깅
 * - 성능 통계 수집
 */

class QueryPerformanceMonitor {
  constructor(options = {}) {
    this.slowQueryThreshold = options.slowQueryThreshold || 1000; // 1초
    this.enabled = options.enabled !== false;
    
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      totalTime: 0,
      queries: []
    };
  }

  /**
   * 쿼리 실행 시간 측정
   */
  async measureQuery(queryName, queryFn) {
    if (!this.enabled) {
      return await queryFn();
    }
    
    const startTime = Date.now();
    
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      this.recordQuery(queryName, duration, true);
      
      if (duration > this.slowQueryThreshold) {
        console.warn(`⚠️  느린 쿼리 감지: ${queryName} (${duration}ms)`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQuery(queryName, duration, false, error.message);
      throw error;
    }
  }

  /**
   * 쿼리 기록
   */
  recordQuery(queryName, duration, success, error = null) {
    this.stats.totalQueries++;
    this.stats.totalTime += duration;
    
    if (duration > this.slowQueryThreshold) {
      this.stats.slowQueries++;
    }
    
    this.stats.queries.push({
      name: queryName,
      duration,
      success,
      error,
      timestamp: new Date().toISOString()
    });
    
    // 최근 100개만 유지
    if (this.stats.queries.length > 100) {
      this.stats.queries.shift();
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    const avgTime = this.stats.totalQueries > 0 
      ? (this.stats.totalTime / this.stats.totalQueries).toFixed(2)
      : 0;
    
    return {
      totalQueries: this.stats.totalQueries,
      slowQueries: this.stats.slowQueries,
      avgTime: parseFloat(avgTime),
      totalTime: this.stats.totalTime,
      recentQueries: this.stats.queries.slice(-10)
    };
  }

  /**
   * 통계 출력
   */
  printStats() {
    const stats = this.getStats();
    
    console.log('\n' + '='.repeat(70));
    console.log('쿼리 성능 통계');
    console.log('='.repeat(70));
    console.log(`총 쿼리 수: ${stats.totalQueries}`);
    console.log(`느린 쿼리: ${stats.slowQueries} (${(stats.slowQueries / stats.totalQueries * 100).toFixed(1)}%)`);
    console.log(`평균 실행 시간: ${stats.avgTime}ms`);
    console.log(`총 실행 시간: ${stats.totalTime}ms`);
    
    if (stats.recentQueries.length > 0) {
      console.log('\n최근 쿼리:');
      stats.recentQueries.forEach(q => {
        const status = q.success ? '✅' : '❌';
        console.log(`  ${status} ${q.name}: ${q.duration}ms`);
      });
    }
    
    console.log('='.repeat(70));
  }

  /**
   * 통계 초기화
   */
  reset() {
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      totalTime: 0,
      queries: []
    };
  }
}

module.exports = QueryPerformanceMonitor;
