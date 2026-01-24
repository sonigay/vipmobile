/**
 * Response Time Logger Middleware
 * 
 * 모든 API 요청의 응답 시간을 측정하고 로깅합니다.
 * 
 * 요구사항:
 * - 9.1: 모든 API 요청 완료 시 응답 시간 로깅
 * - 9.2: 응답 시간이 3초를 초과하면 경고 로그 출력
 * - 9.3: 응답 시간이 5초를 초과하면 에러 로그 출력
 */

/**
 * 응답 시간 임계값 (밀리초)
 */
const RESPONSE_TIME_THRESHOLDS = {
  WARNING: 3000,  // 3초
  ERROR: 5000     // 5초
};

/**
 * 응답 시간을 측정하고 로깅하는 미들웨어
 * @returns {Function} Express 미들웨어 함수
 */
function createResponseTimeLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();
    
    // 원래의 res.end 함수를 저장
    const originalEnd = res.end;
    
    // res.end를 오버라이드하여 응답 완료 시점을 캡처
    res.end = function(...args) {
      // 응답 시간 계산 (밀리초)
      const elapsedTime = Date.now() - startTime;
      const hrElapsed = process.hrtime(startHrTime);
      const preciseElapsedTime = hrElapsed[0] * 1000 + hrElapsed[1] / 1000000;
      
      // 로그 데이터 구성
      const logData = {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime: Math.round(preciseElapsedTime),
        timestamp: new Date().toISOString()
      };
      
      // 응답 시간에 따라 로그 레벨 결정
      if (preciseElapsedTime >= RESPONSE_TIME_THRESHOLDS.ERROR) {
        // 5초 이상: 에러 로그
        console.error('🔴 [Response Time] 매우 느린 응답:', {
          ...logData,
          threshold: 'ERROR (>5s)',
          severity: 'critical'
        });
      } else if (preciseElapsedTime >= RESPONSE_TIME_THRESHOLDS.WARNING) {
        // 3초 이상: 경고 로그
        console.warn('⚠️ [Response Time] 느린 응답:', {
          ...logData,
          threshold: 'WARNING (>3s)',
          severity: 'warning'
        });
      } else {
        // 정상: 일반 로그 (개발 환경에서만)
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [Response Time]', {
            ...logData,
            severity: 'normal'
          });
        }
      }
      
      // 원래의 res.end 호출
      originalEnd.apply(res, args);
    };
    
    next();
  };
}

/**
 * 특정 경로를 응답 시간 로깅에서 제외하는 필터 미들웨어
 * @param {Array<string>} excludePaths - 제외할 경로 목록
 * @returns {Function} Express 미들웨어 함수
 */
function createResponseTimeLoggerWithFilter(excludePaths = ['/health']) {
  const logger = createResponseTimeLogger();
  
  return (req, res, next) => {
    // 제외 경로 확인
    const shouldExclude = excludePaths.some(path => {
      if (typeof path === 'string') {
        return req.path === path || req.originalUrl === path;
      }
      if (path instanceof RegExp) {
        return path.test(req.path) || path.test(req.originalUrl);
      }
      return false;
    });
    
    if (shouldExclude) {
      // 제외 경로는 로깅하지 않음
      return next();
    }
    
    // 로깅 미들웨어 실행
    logger(req, res, next);
  };
}

/**
 * 응답 시간 통계를 추적하는 미들웨어
 * @returns {Function} Express 미들웨어 함수
 */
function createResponseTimeTracker() {
  const stats = {
    totalRequests: 0,
    totalResponseTime: 0,
    slowRequests: 0,
    verySlowRequests: 0,
    fastestRequest: Infinity,
    slowestRequest: 0,
    requestsByEndpoint: new Map()
  };
  
  const middleware = (req, res, next) => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();
    
    const originalEnd = res.end;
    
    res.end = function(...args) {
      const hrElapsed = process.hrtime(startHrTime);
      const elapsedTime = hrElapsed[0] * 1000 + hrElapsed[1] / 1000000;
      
      // 통계 업데이트
      stats.totalRequests++;
      stats.totalResponseTime += elapsedTime;
      stats.fastestRequest = Math.min(stats.fastestRequest, elapsedTime);
      stats.slowestRequest = Math.max(stats.slowestRequest, elapsedTime);
      
      if (elapsedTime >= RESPONSE_TIME_THRESHOLDS.ERROR) {
        stats.verySlowRequests++;
      } else if (elapsedTime >= RESPONSE_TIME_THRESHOLDS.WARNING) {
        stats.slowRequests++;
      }
      
      // 엔드포인트별 통계
      const endpoint = `${req.method} ${req.path}`;
      if (!stats.requestsByEndpoint.has(endpoint)) {
        stats.requestsByEndpoint.set(endpoint, {
          count: 0,
          totalTime: 0,
          avgTime: 0
        });
      }
      
      const endpointStats = stats.requestsByEndpoint.get(endpoint);
      endpointStats.count++;
      endpointStats.totalTime += elapsedTime;
      endpointStats.avgTime = endpointStats.totalTime / endpointStats.count;
      
      originalEnd.apply(res, args);
    };
    
    next();
  };
  
  // 통계 조회 함수 추가
  middleware.getStats = () => {
    const avgResponseTime = stats.totalRequests > 0 
      ? stats.totalResponseTime / stats.totalRequests 
      : 0;
    
    return {
      ...stats,
      avgResponseTime: Math.round(avgResponseTime),
      fastestRequest: stats.fastestRequest === Infinity ? 0 : Math.round(stats.fastestRequest),
      slowestRequest: Math.round(stats.slowestRequest)
    };
  };
  
  // 통계 초기화 함수 추가
  middleware.resetStats = () => {
    stats.totalRequests = 0;
    stats.totalResponseTime = 0;
    stats.slowRequests = 0;
    stats.verySlowRequests = 0;
    stats.fastestRequest = Infinity;
    stats.slowestRequest = 0;
    stats.requestsByEndpoint.clear();
  };
  
  return middleware;
}

module.exports = {
  createResponseTimeLogger,
  createResponseTimeLoggerWithFilter,
  createResponseTimeTracker,
  RESPONSE_TIME_THRESHOLDS
};
