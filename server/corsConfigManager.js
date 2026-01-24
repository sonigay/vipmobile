/**
 * CORS 구성 관리자 (Configuration Manager)
 * 
 * 환경 변수에서 CORS 설정을 로드하고 관리합니다.
 * 요구사항 5.1, 5.2, 5.3, 5.4, 5.5 구현
 * 
 * 주요 기능:
 * - 환경 변수에서 CORS 설정 로드 (ALLOWED_ORIGINS, CORS_CREDENTIALS)
 * - 안전한 기본값 설정 및 폴백 로직
 * - 구성 검증 및 오류 처리
 * - 런타임 구성 업데이트 지원
 */

/**
 * 기본 CORS 구성 (요구사항 5.3 - 안전한 기본값)
 */
const DEFAULT_CONFIG = {
  // 허용된 오리진 목록 (요구사항 2.3, 2.4)
  allowedOrigins: [
    'https://vipmobile.vercel.app',  // 프로덕션 프론트엔드
    'https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app',  // Cloudtype 실제 서버 URL
    'https://vipmobile-backend.cloudtype.app',  // Cloudtype 커스텀 도메인
    'http://localhost:3000',          // 로컬 개발 (기본 포트)
    'http://localhost:3001'           // 로컬 개발 (대체 포트)
  ],
  
  // 허용된 HTTP 메서드 (요구사항 1.4)
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  
  // 허용된 헤더 (요구사항 1.5)
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-API-Key',
    'X-User-Id',
    'X-User-Role',
    'X-User-Name',
    'X-Mode',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  
  // 자격 증명 허용 여부 (요구사항 1.3)
  allowCredentials: true,
  
  // 프리플라이트 캐시 시간 (초) (요구사항 6.1)
  maxAge: 86400,  // 24시간
  
  // 개발 모드 여부 (요구사항 2.4)
  developmentMode: false,
  
  // 디버그 모드 여부 (요구사항 4.4)
  debugMode: false
};

/**
 * 현재 CORS 구성 (런타임에서 업데이트 가능)
 */
let currentConfig = null;

/**
 * 환경 변수에서 허용된 오리진 파싱 (요구사항 5.1)
 * @returns {string[]} 허용된 오리진 배열
 */
const parseAllowedOrigins = () => {
  // ALLOWED_ORIGINS 환경 변수 확인 (요구사항 5.1)
  const envOrigins = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN;
  
  if (!envOrigins || envOrigins.trim() === '') {
    console.log('ℹ️ [CORS Config] ALLOWED_ORIGINS 환경 변수가 설정되지 않음, 기본값 사용');
    return [...DEFAULT_CONFIG.allowedOrigins];
  }
  
  // 쉼표로 구분된 오리진 파싱
  const origins = envOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
  
  // 중복 제거 (대소문자 무관) (요구사항 2.5)
  const uniqueOrigins = [];
  const seenOrigins = new Set();
  
  for (const origin of origins) {
    const lowerOrigin = origin.toLowerCase();
    if (!seenOrigins.has(lowerOrigin)) {
      seenOrigins.add(lowerOrigin);
      uniqueOrigins.push(origin);
    }
  }
  
  console.log('✅ [CORS Config] 환경 변수에서 오리진 로드:', uniqueOrigins);
  return uniqueOrigins;
};

/**
 * 환경 변수에서 자격 증명 설정 파싱 (요구사항 5.2)
 * @returns {boolean} 자격 증명 허용 여부
 */
const parseAllowCredentials = () => {
  const envCredentials = process.env.CORS_CREDENTIALS;
  
  if (envCredentials === undefined || envCredentials === null) {
    console.log('ℹ️ [CORS Config] CORS_CREDENTIALS 환경 변수가 설정되지 않음, 기본값 사용');
    return DEFAULT_CONFIG.allowCredentials;
  }
  
  // 문자열을 boolean으로 변환
  const value = envCredentials.toLowerCase();
  const allowCredentials = value === 'true' || value === '1' || value === 'yes';
  
  console.log('✅ [CORS Config] 환경 변수에서 자격 증명 설정 로드:', allowCredentials);
  return allowCredentials;
};

/**
 * 환경 변수에서 개발 모드 설정 파싱
 * @returns {boolean} 개발 모드 여부
 */
const parseDevelopmentMode = () => {
  const nodeEnv = process.env.NODE_ENV;
  const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev';
  
  if (isDevelopment) {
    console.log('🔧 [CORS Config] 개발 모드 활성화');
  }
  
  return isDevelopment;
};

/**
 * 환경 변수에서 디버그 모드 설정 파싱
 * @returns {boolean} 디버그 모드 여부
 */
const parseDebugMode = () => {
  const envDebug = process.env.CORS_DEBUG || process.env.DEBUG;
  
  if (!envDebug) {
    return DEFAULT_CONFIG.debugMode;
  }
  
  const value = envDebug.toLowerCase();
  const isDebug = value === 'true' || value === '1' || value === 'yes' || value === 'cors';
  
  if (isDebug) {
    console.log('🐛 [CORS Config] 디버그 모드 활성화');
  }
  
  return isDebug;
};

/**
 * 환경 변수에서 허용된 메서드 파싱
 * @returns {string[]} 허용된 메서드 배열
 */
const parseAllowedMethods = () => {
  const envMethods = process.env.ALLOWED_METHODS || process.env.CORS_METHODS;
  
  if (!envMethods || envMethods.trim() === '') {
    return [...DEFAULT_CONFIG.allowedMethods];
  }
  
  const methods = envMethods
    .split(',')
    .map(method => method.trim().toUpperCase())
    .filter(method => method.length > 0);
  
  console.log('✅ [CORS Config] 환경 변수에서 메서드 로드:', methods);
  return methods;
};

/**
 * 환경 변수에서 허용된 헤더 파싱
 * @returns {string[]} 허용된 헤더 배열
 */
const parseAllowedHeaders = () => {
  const envHeaders = process.env.ALLOWED_HEADERS || process.env.CORS_HEADERS;
  
  if (!envHeaders || envHeaders.trim() === '') {
    return [...DEFAULT_CONFIG.allowedHeaders];
  }
  
  const headers = envHeaders
    .split(',')
    .map(header => header.trim())
    .filter(header => header.length > 0);
  
  console.log('✅ [CORS Config] 환경 변수에서 헤더 로드:', headers);
  return headers;
};

/**
 * 환경 변수에서 Max-Age 설정 파싱
 * @returns {number} Max-Age 값 (초)
 */
const parseMaxAge = () => {
  const envMaxAge = process.env.CORS_MAX_AGE;
  
  if (!envMaxAge) {
    return DEFAULT_CONFIG.maxAge;
  }
  
  const maxAge = parseInt(envMaxAge, 10);
  
  if (isNaN(maxAge) || maxAge < 0) {
    console.warn('⚠️ [CORS Config] 유효하지 않은 CORS_MAX_AGE 값, 기본값 사용:', envMaxAge);
    return DEFAULT_CONFIG.maxAge;
  }
  
  console.log('✅ [CORS Config] 환경 변수에서 Max-Age 로드:', maxAge);
  return maxAge;
};

/**
 * 구성 검증 (요구사항 5.4)
 * @param {Object} config - 검증할 구성
 * @returns {Object[]} 검증 오류 배열
 */
const validateConfiguration = (config) => {
  const errors = [];
  
  // 허용된 오리진 검증
  if (!Array.isArray(config.allowedOrigins)) {
    errors.push({
      field: 'allowedOrigins',
      message: 'allowedOrigins must be an array',
      value: config.allowedOrigins
    });
  } else if (config.allowedOrigins.length === 0) {
    errors.push({
      field: 'allowedOrigins',
      message: 'allowedOrigins cannot be empty',
      value: config.allowedOrigins
    });
  } else {
    // 각 오리진이 유효한 URL 형식인지 확인
    config.allowedOrigins.forEach((origin, index) => {
      if (typeof origin !== 'string' || origin.trim() === '') {
        errors.push({
          field: `allowedOrigins[${index}]`,
          message: 'Origin must be a non-empty string',
          value: origin
        });
      } else if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
        errors.push({
          field: `allowedOrigins[${index}]`,
          message: 'Origin must start with http:// or https://',
          value: origin
        });
      }
    });
  }
  
  // 허용된 메서드 검증
  if (!Array.isArray(config.allowedMethods)) {
    errors.push({
      field: 'allowedMethods',
      message: 'allowedMethods must be an array',
      value: config.allowedMethods
    });
  } else if (config.allowedMethods.length === 0) {
    errors.push({
      field: 'allowedMethods',
      message: 'allowedMethods cannot be empty',
      value: config.allowedMethods
    });
  }
  
  // 허용된 헤더 검증
  if (!Array.isArray(config.allowedHeaders)) {
    errors.push({
      field: 'allowedHeaders',
      message: 'allowedHeaders must be an array',
      value: config.allowedHeaders
    });
  } else if (config.allowedHeaders.length === 0) {
    errors.push({
      field: 'allowedHeaders',
      message: 'allowedHeaders cannot be empty',
      value: config.allowedHeaders
    });
  }
  
  // 자격 증명 검증
  if (typeof config.allowCredentials !== 'boolean') {
    errors.push({
      field: 'allowCredentials',
      message: 'allowCredentials must be a boolean',
      value: config.allowCredentials
    });
  }
  
  // Max-Age 검증
  if (typeof config.maxAge !== 'number' || config.maxAge < 0) {
    errors.push({
      field: 'maxAge',
      message: 'maxAge must be a non-negative number',
      value: config.maxAge
    });
  }
  
  // 개발 모드 검증
  if (typeof config.developmentMode !== 'boolean') {
    errors.push({
      field: 'developmentMode',
      message: 'developmentMode must be a boolean',
      value: config.developmentMode
    });
  }
  
  // 디버그 모드 검증
  if (typeof config.debugMode !== 'boolean') {
    errors.push({
      field: 'debugMode',
      message: 'debugMode must be a boolean',
      value: config.debugMode
    });
  }
  
  return errors;
};

/**
 * 환경 변수에서 CORS 구성 로드 (요구사항 5.1, 5.2, 5.3)
 * @returns {Object} CORS 구성 객체
 */
const loadConfiguration = () => {
  console.log('🔄 [CORS Config] 환경 변수에서 CORS 구성 로드 중...');
  
  const config = {
    allowedOrigins: parseAllowedOrigins(),
    allowedMethods: parseAllowedMethods(),
    allowedHeaders: parseAllowedHeaders(),
    allowCredentials: parseAllowCredentials(),
    maxAge: parseMaxAge(),
    developmentMode: parseDevelopmentMode(),
    debugMode: parseDebugMode()
  };
  
  // 구성 검증 (요구사항 5.4)
  const errors = validateConfiguration(config);
  
  if (errors.length > 0) {
    console.error('❌ [CORS Config] 구성 검증 실패:', errors);
    console.error('⚠️ [CORS Config] 안전한 기본값으로 폴백합니다.');
    
    // 안전한 기본값으로 폴백 (요구사항 5.3)
    return { ...DEFAULT_CONFIG };
  }
  
  console.log('✅ [CORS Config] CORS 구성 로드 완료:', {
    originsCount: config.allowedOrigins.length,
    methodsCount: config.allowedMethods.length,
    headersCount: config.allowedHeaders.length,
    allowCredentials: config.allowCredentials,
    maxAge: config.maxAge,
    developmentMode: config.developmentMode,
    debugMode: config.debugMode
  });
  
  return config;
};

/**
 * 현재 CORS 구성 가져오기
 * @returns {Object} 현재 CORS 구성
 */
const getConfiguration = () => {
  // 구성이 아직 로드되지 않은 경우 로드
  if (!currentConfig) {
    currentConfig = loadConfiguration();
  }
  
  // 구성 깊은 복사본 반환 (불변성 보장)
  return {
    ...currentConfig,
    allowedOrigins: [...currentConfig.allowedOrigins],
    allowedMethods: [...currentConfig.allowedMethods],
    allowedHeaders: [...currentConfig.allowedHeaders]
  };
};

/**
 * 런타임에서 CORS 구성 업데이트 (요구사항 5.5)
 * @param {Object} newConfig - 새로운 구성 (부분 업데이트 지원)
 * @returns {Object} 업데이트 결과 { success, errors, config }
 */
const updateConfiguration = (newConfig) => {
  console.log('🔄 [CORS Config] 런타임 구성 업데이트 요청:', newConfig);
  
  // 현재 구성 가져오기
  const current = getConfiguration();
  
  // 새로운 구성 병합
  const merged = {
    ...current,
    ...newConfig
  };
  
  // 구성 검증
  const errors = validateConfiguration(merged);
  
  if (errors.length > 0) {
    console.error('❌ [CORS Config] 구성 업데이트 검증 실패:', errors);
    return {
      success: false,
      errors: errors,
      config: current
    };
  }
  
  // 구성 업데이트
  currentConfig = merged;
  
  console.log('✅ [CORS Config] 런타임 구성 업데이트 성공:', {
    originsCount: merged.allowedOrigins.length,
    methodsCount: merged.allowedMethods.length,
    headersCount: merged.allowedHeaders.length,
    allowCredentials: merged.allowCredentials,
    maxAge: merged.maxAge,
    developmentMode: merged.developmentMode,
    debugMode: merged.debugMode
  });
  
  return {
    success: true,
    errors: [],
    config: merged
  };
};

/**
 * 구성 초기화 (테스트용)
 */
const resetConfiguration = () => {
  console.log('🔄 [CORS Config] 구성 초기화');
  currentConfig = null;
};

/**
 * 기본 구성 가져오기 (테스트용)
 */
const getDefaultConfiguration = () => {
  return { ...DEFAULT_CONFIG };
};

// 서버 시작 시 구성 로드 및 검증 (요구사항 5.4)
const initialConfig = loadConfiguration();
currentConfig = initialConfig;

module.exports = {
  getConfiguration,
  updateConfiguration,
  loadConfiguration,
  validateConfiguration,
  resetConfiguration,
  getDefaultConfiguration,
  // 내부 함수들 (테스트용)
  parseAllowedOrigins,
  parseAllowCredentials,
  parseDevelopmentMode,
  parseDebugMode,
  parseAllowedMethods,
  parseAllowedHeaders,
  parseMaxAge
};
