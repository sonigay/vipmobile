/**
 * CORS 로깅 시스템
 * 
 * 구조화된 로그 형식과 로그 레벨 관리를 제공합니다.
 * 요구사항 4.1, 4.4, 4.5 구현
 */

/**
 * 로그 레벨 정의
 */
const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * 로그 카테고리 정의
 */
const LogCategory = {
  VALIDATION_FAILURE: 'VALIDATION_FAILURE',
  VALIDATION_SUCCESS: 'VALIDATION_SUCCESS',
  PREFLIGHT: 'PREFLIGHT',
  MISSING_HEADERS: 'MISSING_HEADERS',
  MIDDLEWARE_ERROR: 'MIDDLEWARE_ERROR',
  CONFIG_UPDATE: 'CONFIG_UPDATE',
  CACHE: 'CACHE'
};

/**
 * 구조화된 로그 메시지 생성
 * @param {string} level - 로그 레벨
 * @param {string} category - 로그 카테고리
 * @param {string} message - 로그 메시지
 * @param {Object} data - 추가 데이터
 * @returns {Object} 구조화된 로그 객체
 */
const createLogEntry = (level, category, message, data = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...data
  };
};

/**
 * 로그 출력 함수
 * @param {Object} logEntry - 로그 엔트리
 */
const outputLog = (logEntry) => {
  const { level, category, message, timestamp, ...data } = logEntry;
  
  // 로그 레벨에 따른 아이콘
  const icons = {
    [LogLevel.ERROR]: '❌',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.DEBUG]: '🔍'
  };
  
  const icon = icons[level] || '📝';
  const prefix = `${icon} [CORS:${category}]`;
  
  // 콘솔 출력 함수 선택
  const logFn = {
    [LogLevel.ERROR]: console.error,
    [LogLevel.WARN]: console.warn,
    [LogLevel.INFO]: console.log,
    [LogLevel.DEBUG]: console.log
  }[level] || console.log;
  
  // 데이터가 있으면 함께 출력 (timestamp는 제외)
  if (Object.keys(data).length > 0) {
    logFn(prefix, message, data);
  } else {
    logFn(prefix, message);
  }
};

/**
 * CORS 검증 실패 로깅 (요구사항 4.1)
 * @param {string} origin - 거부된 오리진
 * @param {string} reason - 거부 이유
 * @param {Object} additionalData - 추가 데이터 (path, method 등)
 */
const logValidationFailure = (origin, reason, additionalData = {}) => {
  const logEntry = createLogEntry(
    LogLevel.WARN,
    LogCategory.VALIDATION_FAILURE,
    '오리진 검증 실패',
    {
      origin,
      reason,
      ...additionalData
    }
  );
  
  outputLog(logEntry);
};

/**
 * CORS 검증 성공 로깅 (요구사항 4.4)
 * 디버그 모드에서만 호출되어야 함
 * @param {string} origin - 허용된 오리진
 * @param {string} matchedOrigin - 매칭된 오리진
 * @param {string} reason - 허용 이유
 */
const logValidationSuccess = (origin, matchedOrigin, reason) => {
  const logEntry = createLogEntry(
    LogLevel.DEBUG,
    LogCategory.VALIDATION_SUCCESS,
    '오리진 검증 성공',
    {
      origin,
      matchedOrigin,
      reason
    }
  );
  
  outputLog(logEntry);
};

/**
 * 프리플라이트 요청 로깅
 * @param {string} type - 'REQUEST' 또는 'SUCCESS' 또는 'FAILURE'
 * @param {Object} data - 프리플라이트 관련 데이터
 */
const logPreflight = (type, data) => {
  const messages = {
    REQUEST: 'OPTIONS 프리플라이트 요청 처리',
    SUCCESS: '프리플라이트 요청 검증 성공',
    FAILURE: '프리플라이트 요청 검증 실패'
  };
  
  const level = type === 'FAILURE' ? LogLevel.WARN : LogLevel.INFO;
  
  const logEntry = createLogEntry(
    level,
    LogCategory.PREFLIGHT,
    messages[type] || 'Preflight request',
    data
  );
  
  outputLog(logEntry);
};

/**
 * 누락된 CORS 헤더 감지 및 경고 로깅 (요구사항 4.5)
 * @param {Object} res - Express response 객체
 * @param {Object} context - 요청 컨텍스트 (path, method 등)
 */
const checkAndLogMissingHeaders = (res, context = {}) => {
  const requiredHeaders = [
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers'
  ];
  
  const missingHeaders = [];
  
  // 응답 헤더 확인
  requiredHeaders.forEach(header => {
    const headerValue = res.getHeader(header);
    if (!headerValue) {
      missingHeaders.push(header);
    }
  });
  
  // 누락된 헤더가 있으면 경고 로깅
  if (missingHeaders.length > 0) {
    const logEntry = createLogEntry(
      LogLevel.WARN,
      LogCategory.MISSING_HEADERS,
      '응답에서 CORS 헤더 누락 감지',
      {
        missingHeaders,
        ...context
      }
    );
    
    outputLog(logEntry);
    return true; // 누락된 헤더 있음
  }
  
  return false; // 모든 헤더 존재
};

/**
 * 미들웨어 오류 로깅 (요구사항 4.3)
 * @param {Error} error - 오류 객체
 * @param {Object} context - 요청 컨텍스트
 */
const logMiddlewareError = (error, context = {}) => {
  const logEntry = createLogEntry(
    LogLevel.ERROR,
    LogCategory.MIDDLEWARE_ERROR,
    '미들웨어 오류 발생',
    {
      error: error.message,
      stack: error.stack,
      ...context
    }
  );
  
  outputLog(logEntry);
};

/**
 * 구성 업데이트 로깅
 * @param {string} type - 'SUCCESS' 또는 'FAILURE'
 * @param {Object} data - 업데이트 관련 데이터
 */
const logConfigUpdate = (type, data) => {
  const level = type === 'SUCCESS' ? LogLevel.INFO : LogLevel.WARN;
  const message = type === 'SUCCESS' 
    ? '구성 업데이트 성공' 
    : '구성 업데이트 실패';
  
  const logEntry = createLogEntry(
    level,
    LogCategory.CONFIG_UPDATE,
    message,
    data
  );
  
  outputLog(logEntry);
};

/**
 * 캐시 관련 로깅
 * @param {string} action - 'HIT', 'MISS', 'CLEAR', 'SET'
 * @param {Object} data - 캐시 관련 데이터
 */
const logCache = (action, data) => {
  const logEntry = createLogEntry(
    LogLevel.DEBUG,
    LogCategory.CACHE,
    `캐시 ${action}`,
    data
  );
  
  outputLog(logEntry);
};

/**
 * 로그 레벨 확인 함수
 * 환경 변수나 구성에 따라 특정 레벨의 로그를 필터링할 수 있음
 * @param {string} level - 확인할 로그 레벨
 * @returns {boolean} 로그 출력 여부
 */
const shouldLog = (level) => {
  // 환경 변수에서 로그 레벨 가져오기
  const configuredLevel = process.env.CORS_LOG_LEVEL || 'INFO';
  
  const levelPriority = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.DEBUG]: 3
  };
  
  return levelPriority[level] <= levelPriority[configuredLevel];
};

module.exports = {
  LogLevel,
  LogCategory,
  logValidationFailure,
  logValidationSuccess,
  logPreflight,
  checkAndLogMissingHeaders,
  logMiddlewareError,
  logConfigUpdate,
  logCache,
  shouldLog,
  createLogEntry,
  outputLog
};
