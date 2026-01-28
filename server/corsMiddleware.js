/**
 * CORS 미들웨어 - Cross-Origin Resource Sharing 처리
 * 
 * 이 미들웨어는 Vercel에 호스팅된 React 프론트엔드와 
 * Cloudtype에 호스팅된 Node.js 백엔드 간의 CORS 문제를 해결합니다.
 * 
 * 요구사항 참조: 1.1, 1.4, 1.5, 2.5, 6.3, 6.5
 */

const configManager = require('./corsConfigManager');
const {
  logValidationFailure,
  logValidationSuccess,
  logPreflight,
  checkAndLogMissingHeaders,
  logMiddlewareError,
  logConfigUpdate,
  logCache
} = require('./corsLogger');

// 오리진 검증 결과 캐시 (요구사항 6.3, 6.5)
const originValidationCache = new Map();
const CACHE_TTL = 3600000; // 1시간 (밀리초)
const MAX_CACHE_SIZE = 1000; // 최대 캐시 항목 수

/**
 * 오리진 검증 캐시 관리
 */
const cacheManager = {
  /**
   * 캐시에서 검증 결과 가져오기
   */
  get(origin) {
    const cached = originValidationCache.get(origin);
    if (!cached) {
      logCache('MISS', { origin });
      return null;
    }

    // TTL 확인
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      originValidationCache.delete(origin);
      logCache('EXPIRED', { origin });
      return null;
    }

    logCache('HIT', { origin });
    return cached.result;
  },

  /**
   * 캐시에 검증 결과 저장
   */
  set(origin, result) {
    // 캐시 크기 제한 확인
    if (originValidationCache.size >= MAX_CACHE_SIZE) {
      // 가장 오래된 항목 제거 (LRU 방식)
      const firstKey = originValidationCache.keys().next().value;
      originValidationCache.delete(firstKey);
      logCache('EVICT', { evictedOrigin: firstKey, reason: 'MAX_SIZE_REACHED' });
    }

    originValidationCache.set(origin, {
      result,
      timestamp: Date.now()
    });

    logCache('SET', { origin, result });
  },

  /**
   * 캐시 초기화
   */
  clear() {
    const size = originValidationCache.size;
    originValidationCache.clear();
    logCache('CLEAR', { clearedCount: size });
  },

  /**
   * 캐시 통계 정보
   */
  getStats() {
    return {
      size: originValidationCache.size,
      maxSize: MAX_CACHE_SIZE,
      ttl: CACHE_TTL
    };
  }
};

/**
 * 허용된 오리진 목록 관리 (요구사항 2.1, 2.2)
 * 구성 관리자에서 허용된 오리진 목록 가져오기
 */
const getAllowedOrigins = () => {
  const config = configManager.getConfiguration();
  return config.allowedOrigins;
};

/**
 * 대소문자 무관 오리진 매칭 (요구사항 2.5)
 * @param {string} requestOrigin - 요청 오리진
 * @param {string[]} allowedOrigins - 허용된 오리진 목록
 * @returns {string|null} - 매칭된 오리진 또는 null
 */
const matchOriginCaseInsensitive = (requestOrigin, allowedOrigins) => {
  if (!requestOrigin) return null;

  // 캐시 확인 (요구사항 6.3, 6.5)
  const cacheKey = requestOrigin.toLowerCase();
  const cachedResult = cacheManager.get(cacheKey);
  if (cachedResult !== null) {
    return cachedResult;
  }

  // 대소문자 무관 매칭
  const lowerRequestOrigin = requestOrigin.toLowerCase();
  const matchedOrigin = allowedOrigins.find(
    allowed => allowed.toLowerCase() === lowerRequestOrigin
  );

  // 결과 캐싱
  const result = matchedOrigin || null;
  cacheManager.set(cacheKey, result);

  return result;
};

/**
 * 오리진 검증 함수 (요구사항 2.1, 2.2)
 * @param {string} requestOrigin - 요청 오리진
 * @param {string[]} allowedOrigins - 허용된 오리진 목록
 * @param {boolean} developmentMode - 개발 모드 여부
 * @returns {Object} 검증 결과 { isValid, matchedOrigin, reason }
 */
const validateOrigin = (requestOrigin, allowedOrigins, developmentMode = false) => {
  if (!requestOrigin) {
    return {
      isValid: true,
      matchedOrigin: null,
      reason: 'No origin header present'
    };
  }

  // 대소문자 무관 오리진 매칭 (요구사항 2.5, 캐싱 포함)
  const matchedOrigin = matchOriginCaseInsensitive(requestOrigin, allowedOrigins);

  if (matchedOrigin) {
    return {
      isValid: true,
      matchedOrigin: matchedOrigin,
      reason: 'Origin matched in allowed list'
    };
  }

  // 🔥 Vercel 프리뷰 및 프로젝트 도메인 동적 허용
  if (requestOrigin && (
    requestOrigin.endsWith('.vercel.app') ||
    requestOrigin.includes('-vipmobiles-projects.vercel.app')
  )) {
    return {
      isValid: true,
      matchedOrigin: requestOrigin,
      reason: 'Vercel preview/project domain dynamically allowed'
    };
  }

  // 개발 모드에서는 모든 오리진 허용 (요구사항 2.4)
  if (developmentMode) {
    return {
      isValid: true,
      matchedOrigin: null,
      reason: 'Development mode - all origins allowed'
    };
  }

  // 허용되지 않은 오리진 (요구사항 2.2)
  return {
    isValid: false,
    matchedOrigin: null,
    reason: 'Origin not in allowed list'
  };
};

/**
 * 기본 CORS 헤더 설정 함수
 * 요구사항 1.1, 1.4, 1.5, 2.5 구현
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 * @param {string} origin - 요청 오리진
 * @returns {Object} 검증 결과 { isValid, reason }
 */
const setBasicCORSHeaders = (req, res, origin = null) => {
  const config = configManager.getConfiguration();
  const allowedOrigins = config.allowedOrigins;
  const requestOrigin = origin || req.headers.origin;

  // 오리진 검증 (요구사항 2.1, 2.2)
  const validation = validateOrigin(requestOrigin, allowedOrigins, config.developmentMode);

  // 검증 실패 시 (요구사항 2.2, 4.1)
  if (!validation.isValid) {
    logValidationFailure(requestOrigin, validation.reason, {
      path: req.path,
      method: req.method
    });

    return {
      isValid: false,
      reason: validation.reason
    };
  }

  // 디버그 모드에서 성공적인 검증 로깅 (요구사항 4.4)
  if (config.debugMode && requestOrigin) {
    logValidationSuccess(requestOrigin, validation.matchedOrigin, validation.reason);
  }

  // Access-Control-Allow-Origin 헤더 설정 (요구사항 1.1, 2.5)
  if (requestOrigin) {
    // 원본 요청 오리진 반환 (브라우저 호환성)
    res.header('Access-Control-Allow-Origin', requestOrigin);
  } else if (allowedOrigins.length > 0) {
    // 기본값으로 첫 번째 허용된 오리진 사용
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  // Access-Control-Allow-Methods 헤더 설정 (요구사항 1.4)
  res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));

  // Access-Control-Allow-Headers 헤더 설정 (요구사항 1.5)
  res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

  // 자격 증명 허용 (구성 관리자에서 가져오기)
  res.header('Access-Control-Allow-Credentials', config.allowCredentials.toString());

  // 프리플라이트 캐싱 (구성 관리자에서 가져오기)
  res.header('Access-Control-Max-Age', config.maxAge.toString());

  // 누락된 CORS 헤더 감지 (요구사항 4.5)
  if (config.debugMode) {
    checkAndLogMissingHeaders(res, {
      path: req.path,
      method: req.method
    });
  }

  return {
    isValid: true,
    reason: validation.reason
  };
};

/**
 * 요청된 메서드 검증 (요구사항 1.2, 6.1)
 * @param {string} method - 요청된 HTTP 메서드
 * @returns {boolean} - 메서드가 허용되는지 여부
 */
const validateRequestedMethod = (method) => {
  if (!method) return true; // 메서드가 지정되지 않은 경우 허용

  const config = configManager.getConfiguration();
  const allowedMethods = config.allowedMethods.map(m => m.toUpperCase());
  return allowedMethods.includes(method.toUpperCase());
};

/**
 * 요청된 헤더 검증 (요구사항 1.2, 6.1)
 * @param {string} headersString - 쉼표로 구분된 요청 헤더 문자열
 * @returns {boolean} - 모든 헤더가 허용되는지 여부
 */
const validateRequestedHeaders = (headersString) => {
  if (!headersString) return true; // 헤더가 지정되지 않은 경우 허용

  const config = configManager.getConfiguration();
  const allowedHeaders = config.allowedHeaders.map(h => h.toLowerCase());

  // 요청된 헤더들을 파싱하고 소문자로 변환
  const requestedHeaders = headersString
    .split(',')
    .map(header => header.trim().toLowerCase())
    .filter(header => header.length > 0);

  // 모든 요청된 헤더가 허용 목록에 있는지 확인
  return requestedHeaders.every(header => allowedHeaders.includes(header));
};

/**
 * OPTIONS 요청 처리 함수 (프리플라이트 요청)
 * 요구사항 1.2, 6.1 구현
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 */
const handlePreflightRequest = (req, res) => {
  const requestedMethod = req.headers['access-control-request-method'];
  const requestedHeaders = req.headers['access-control-request-headers'];

  // 프리플라이트 요청 로깅
  logPreflight('REQUEST', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    requestedMethod,
    requestedHeaders
  });

  // 오리진 검증 먼저 수행 (요구사항 2.1, 2.2)
  const config = configManager.getConfiguration();
  const validation = validateOrigin(
    req.headers.origin,
    config.allowedOrigins,
    config.developmentMode
  );

  if (!validation.isValid) {
    logPreflight('FAILURE', {
      origin: req.headers.origin,
      reason: validation.reason,
      type: 'ORIGIN_VALIDATION'
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Origin not allowed',
      origin: req.headers.origin
    });
  }

  // 요청된 메서드 검증 (요구사항 4.2)
  if (requestedMethod && !validateRequestedMethod(requestedMethod)) {
    logPreflight('FAILURE', {
      method: requestedMethod,
      origin: req.headers.origin,
      type: 'METHOD_VALIDATION',
      allowedMethods: config.allowedMethods
    });

    return res.status(400).json({
      error: 'Invalid preflight request',
      message: `Method ${requestedMethod} is not allowed`,
      allowedMethods: config.allowedMethods
    });
  }

  // 요청된 헤더 검증 (요구사항 4.2)
  if (requestedHeaders && !validateRequestedHeaders(requestedHeaders)) {
    logPreflight('FAILURE', {
      headers: requestedHeaders,
      origin: req.headers.origin,
      type: 'HEADERS_VALIDATION'
    });

    return res.status(400).json({
      error: 'Invalid preflight request',
      message: 'One or more requested headers are not allowed',
      requestedHeaders: requestedHeaders
    });
  }

  // 검증 통과 - 기본 CORS 헤더 설정
  setBasicCORSHeaders(req, res);

  logPreflight('SUCCESS', {
    origin: req.headers.origin,
    requestedMethod,
    requestedHeaders
  });

  // 200 OK 응답으로 프리플라이트 요청 완료
  res.status(200).end();
};

/**
 * 메인 CORS 미들웨어 함수
 * 요구사항 3.1, 3.2, 3.3 구현
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 * @param {Function} next - Express next 함수
 */
const corsMiddleware = (req, res, next) => {
  try {
    const origin = req.headers.origin;
    const config = configManager.getConfiguration();

    // 1. 오리진 검증 (요구사항 3.1)
    const validation = validateOrigin(origin, config.allowedOrigins, config.developmentMode);

    // 검증 실패 시 경고 로그 (요구사항 3.1)
    if (!validation.isValid && origin) {
      // 🔥 태스크 7.1: CORS 오류 로깅 강화 - 요청 오리진, 허용된 오리진 목록, 실패 이유 로깅
      console.warn(`❌ [CORS] 허용되지 않은 오리진:`, {
        요청오리진: origin,
        허용된오리진목록: config.allowedOrigins,
        실패이유: validation.reason,
        요청정보: {
          경로: req.path,
          메서드: req.method,
          헤더: req.headers
        },
        개발모드: config.developmentMode
      });
      logValidationFailure(origin, validation.reason, {
        path: req.path,
        method: req.method
      });
    }

    // 2. CORS 헤더 설정 (항상 설정 - 요구사항 3.1, 3.2)
    // 검증 실패 시에도 헤더를 설정하여 브라우저가 명확한 오류 메시지를 받을 수 있도록 함
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (config.allowedOrigins.length > 0) {
      res.header('Access-Control-Allow-Origin', config.allowedOrigins[0]);
    }

    res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    res.header('Access-Control-Allow-Credentials', config.allowCredentials.toString());
    res.header('Access-Control-Max-Age', config.maxAge.toString());

    // 3. OPTIONS 프리플라이트 요청 처리 (요구사항 3.3)
    if (req.method === 'OPTIONS') {
      const requestedMethod = req.headers['access-control-request-method'];
      const requestedHeaders = req.headers['access-control-request-headers'];

      // 프리플라이트 요청 로깅
      logPreflight('REQUEST', {
        method: req.method,
        url: req.url,
        origin: origin,
        requestedMethod: requestedMethod,
        requestedHeaders: requestedHeaders
      });

      // 요청된 메서드 검증 (요구사항 3.3)
      if (requestedMethod && !validateRequestedMethod(requestedMethod)) {
        logPreflight('FAILURE', {
          method: requestedMethod,
          origin: origin,
          type: 'METHOD_VALIDATION',
          allowedMethods: config.allowedMethods
        });

        return res.status(400).json({
          error: 'Invalid preflight request',
          message: `Method ${requestedMethod} is not allowed`,
          allowedMethods: config.allowedMethods
        });
      }

      // 요청된 헤더 검증 (요구사항 3.3)
      if (requestedHeaders && !validateRequestedHeaders(requestedHeaders)) {
        logPreflight('FAILURE', {
          headers: requestedHeaders,
          origin: origin,
          type: 'HEADERS_VALIDATION'
        });

        return res.status(400).json({
          error: 'Invalid preflight request',
          message: 'One or more requested headers are not allowed',
          requestedHeaders: requestedHeaders
        });
      }

      // 검증 통과 - 프리플라이트 성공
      logPreflight('SUCCESS', {
        origin: origin,
        requestedMethod: requestedMethod,
        requestedHeaders: requestedHeaders,
        validationPassed: validation.isValid
      });

      return res.status(200).end();
    }

    // 4. 실제 요청에서 오리진 검증 실패 시 403 응답
    if (!validation.isValid && origin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Origin not allowed',
        origin: origin,
        reason: validation.reason
      });
    }

    // 5. 디버그 모드에서 성공적인 검증 로깅
    if (config.debugMode && origin && validation.isValid) {
      logValidationSuccess(origin, validation.matchedOrigin, validation.reason);
    }

    // 6. 다음 미들웨어로 진행
    next();
  } catch (error) {
    // 미들웨어 오류 처리 (요구사항 3.2 - 폴백 메커니즘)
    // 🔥 태스크 7.1: 백엔드 오류 로깅 강화 - API 오류 상세 로깅
    console.error('❌ [CORS Middleware] 오류:', {
      오류타입: error.name || 'Error',
      오류메시지: error.message,
      스택트레이스: error.stack,
      요청정보: {
        경로: req.path,
        메서드: req.method,
        오리진: req.headers.origin,
        헤더: req.headers
      }
    });
    logMiddlewareError(error, {
      path: req.path,
      method: req.method,
      origin: req.headers.origin
    });

    // 오류 발생 시에도 기본 CORS 헤더 설정 (요구사항 3.2)
    try {
      const config = configManager.getConfiguration();
      const origin = req.headers.origin;

      // 오리진이 있으면 그대로 반환, 없으면 첫 번째 허용된 오리진 사용
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
      } else if (config.allowedOrigins.length > 0) {
        res.header('Access-Control-Allow-Origin', config.allowedOrigins[0]);
      } else {
        // 설정이 없는 경우 와일드카드 사용 (최후의 폴백)
        res.header('Access-Control-Allow-Origin', '*');
      }

      res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
      res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
      res.header('Access-Control-Allow-Credentials', config.allowCredentials.toString());

      console.log('✅ [CORS Middleware] 폴백 CORS 헤더 설정 완료');
    } catch (fallbackError) {
      // 폴백 처리도 실패한 경우 최소한의 헤더 설정
      console.error('❌ [CORS Middleware] 폴백 처리 실패:', fallbackError.message);
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // 오류가 발생해도 항상 next() 호출하여 처리 계속 (요구사항 3.2)
    next();
  }
};

/**
 * CORS 구성 정보 반환
 */
const getCORSConfiguration = () => {
  return configManager.getConfiguration();
};

/**
 * CORS 구성 업데이트 (런타임)
 * @param {Object} newConfig - 새로운 구성 (부분 업데이트 지원)
 * @returns {Object} 업데이트 결과
 */
const updateCORSConfiguration = (newConfig) => {
  const result = configManager.updateConfiguration(newConfig);

  // 구성 업데이트 로깅
  if (result.success) {
    logConfigUpdate('SUCCESS', {
      updatedFields: Object.keys(newConfig),
      newConfig: result.config
    });

    // 구성 업데이트 성공 시 캐시 초기화
    cacheManager.clear();
  } else {
    logConfigUpdate('FAILURE', {
      errors: result.errors,
      attemptedConfig: newConfig
    });
  }

  return result;
};

/**
 * 레거시 setCORSHeaders 함수 (하위 호환성)
 * 기존 코드에서 사용하던 setCORSHeaders 함수를 통합된 구현으로 대체
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 */
const setCORSHeaders = (req, res) => {
  // 레거시 함수는 검증 실패를 무시하고 항상 헤더 설정
  // (기존 동작 유지를 위해)
  const config = configManager.getConfiguration();
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
  } else if (config.allowedOrigins.length > 0) {
    res.header('Access-Control-Allow-Origin', config.allowedOrigins[0]);
  }

  res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', config.allowCredentials.toString());
  res.header('Access-Control-Max-Age', config.maxAge.toString());
};

module.exports = {
  corsMiddleware,
  setBasicCORSHeaders,
  handlePreflightRequest,
  getCORSConfiguration,
  updateCORSConfiguration,  // 런타임 구성 업데이트
  getAllowedOrigins,
  setCORSHeaders,  // 하위 호환성을 위한 레거시 함수
  matchOriginCaseInsensitive,  // 대소문자 무관 오리진 매칭
  validateOrigin,  // 오리진 검증 함수
  cacheManager,  // 캐시 관리자
  validateRequestedMethod,  // 요청된 메서드 검증
  validateRequestedHeaders,  // 요청된 헤더 검증
  configManager  // 구성 관리자 노출
};