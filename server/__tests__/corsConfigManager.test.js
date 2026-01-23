/**
 * CORS 구성 관리자 단위 테스트
 * 
 * 요구사항 5.1, 5.2, 5.3, 5.4, 5.5 검증
 */

const configManager = require('../corsConfigManager');

describe('CORS 구성 관리자', () => {
  // 각 테스트 전에 환경 변수 백업
  let originalEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    configManager.resetConfiguration();
  });
  
  afterEach(() => {
    // 환경 변수 복원
    process.env = originalEnv;
    configManager.resetConfiguration();
  });
  
  describe('환경 변수에서 구성 로드 (요구사항 5.1, 5.2)', () => {
    test('ALLOWED_ORIGINS 환경 변수에서 오리진 로드', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://test.com');
      expect(config.allowedOrigins.length).toBe(2);
    });
    
    test('CORS_ORIGIN 환경 변수에서 오리진 로드 (대체 이름)', () => {
      process.env.CORS_ORIGIN = 'https://example.com,https://test.com';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://test.com');
    });
    
    test('CORS_CREDENTIALS 환경 변수에서 자격 증명 설정 로드', () => {
      process.env.CORS_CREDENTIALS = 'true';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowCredentials).toBe(true);
    });
    
    test('CORS_CREDENTIALS false 값 처리', () => {
      process.env.CORS_CREDENTIALS = 'false';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowCredentials).toBe(false);
    });
    
    test('CORS_CREDENTIALS 다양한 true 값 처리 (1, yes)', () => {
      process.env.CORS_CREDENTIALS = '1';
      let config = configManager.loadConfiguration();
      expect(config.allowCredentials).toBe(true);
      
      configManager.resetConfiguration();
      process.env.CORS_CREDENTIALS = 'yes';
      config = configManager.loadConfiguration();
      expect(config.allowCredentials).toBe(true);
    });
    
    test('ALLOWED_METHODS 환경 변수에서 메서드 로드', () => {
      process.env.ALLOWED_METHODS = 'GET,POST,PUT';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedMethods).toContain('GET');
      expect(config.allowedMethods).toContain('POST');
      expect(config.allowedMethods).toContain('PUT');
      expect(config.allowedMethods.length).toBe(3);
    });
    
    test('ALLOWED_HEADERS 환경 변수에서 헤더 로드', () => {
      process.env.ALLOWED_HEADERS = 'Content-Type,Authorization';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedHeaders).toContain('Content-Type');
      expect(config.allowedHeaders).toContain('Authorization');
      expect(config.allowedHeaders.length).toBe(2);
    });
    
    test('CORS_MAX_AGE 환경 변수에서 Max-Age 로드', () => {
      process.env.CORS_MAX_AGE = '3600';
      
      const config = configManager.loadConfiguration();
      
      expect(config.maxAge).toBe(3600);
    });
    
    test('NODE_ENV=development 시 개발 모드 활성화', () => {
      process.env.NODE_ENV = 'development';
      
      const config = configManager.loadConfiguration();
      
      expect(config.developmentMode).toBe(true);
    });
    
    test('CORS_DEBUG 환경 변수에서 디버그 모드 로드', () => {
      process.env.CORS_DEBUG = 'true';
      
      const config = configManager.loadConfiguration();
      
      expect(config.debugMode).toBe(true);
    });
  });
  
  describe('안전한 기본값 설정 (요구사항 5.3)', () => {
    test('환경 변수가 없을 때 기본 오리진 사용', () => {
      delete process.env.ALLOWED_ORIGINS;
      delete process.env.CORS_ORIGIN;
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedOrigins).toContain('https://vipmobile.vercel.app');
      expect(config.allowedOrigins).toContain('http://localhost:3000');
      expect(config.allowedOrigins).toContain('http://localhost:3001');
    });
    
    test('빈 환경 변수일 때 기본 오리진 사용', () => {
      process.env.ALLOWED_ORIGINS = '';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedOrigins).toContain('https://vipmobile.vercel.app');
      expect(config.allowedOrigins.length).toBeGreaterThan(0);
    });
    
    test('환경 변수가 없을 때 기본 자격 증명 설정 사용', () => {
      delete process.env.CORS_CREDENTIALS;
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowCredentials).toBe(true);
    });
    
    test('환경 변수가 없을 때 기본 메서드 사용', () => {
      delete process.env.ALLOWED_METHODS;
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedMethods).toContain('GET');
      expect(config.allowedMethods).toContain('POST');
      expect(config.allowedMethods).toContain('PUT');
      expect(config.allowedMethods).toContain('DELETE');
      expect(config.allowedMethods).toContain('OPTIONS');
    });
    
    test('환경 변수가 없을 때 기본 헤더 사용', () => {
      delete process.env.ALLOWED_HEADERS;
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedHeaders).toContain('Content-Type');
      expect(config.allowedHeaders).toContain('Authorization');
      expect(config.allowedHeaders).toContain('X-Requested-With');
    });
    
    test('환경 변수가 없을 때 기본 Max-Age 사용', () => {
      delete process.env.CORS_MAX_AGE;
      
      const config = configManager.loadConfiguration();
      
      expect(config.maxAge).toBe(86400);
    });
    
    test('유효하지 않은 Max-Age 값일 때 기본값 사용', () => {
      process.env.CORS_MAX_AGE = 'invalid';
      
      const config = configManager.loadConfiguration();
      
      expect(config.maxAge).toBe(86400);
    });
    
    test('음수 Max-Age 값일 때 기본값 사용', () => {
      process.env.CORS_MAX_AGE = '-100';
      
      const config = configManager.loadConfiguration();
      
      expect(config.maxAge).toBe(86400);
    });
  });
  
  describe('구성 검증 (요구사항 5.4)', () => {
    test('유효한 구성은 오류 없음', () => {
      const validConfig = {
        allowedOrigins: ['https://example.com'],
        allowedMethods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        allowCredentials: true,
        maxAge: 3600,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(validConfig);
      
      expect(errors).toHaveLength(0);
    });
    
    test('allowedOrigins가 배열이 아니면 오류', () => {
      const invalidConfig = {
        allowedOrigins: 'not-an-array',
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        allowCredentials: true,
        maxAge: 3600,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(invalidConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('allowedOrigins');
    });
    
    test('allowedOrigins가 비어있으면 오류', () => {
      const invalidConfig = {
        allowedOrigins: [],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        allowCredentials: true,
        maxAge: 3600,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(invalidConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('allowedOrigins');
    });
    
    test('오리진이 http:// 또는 https://로 시작하지 않으면 오류', () => {
      const invalidConfig = {
        allowedOrigins: ['example.com', 'ftp://test.com'],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        allowCredentials: true,
        maxAge: 3600,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(invalidConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field.includes('allowedOrigins'))).toBe(true);
    });
    
    test('allowedMethods가 배열이 아니면 오류', () => {
      const invalidConfig = {
        allowedOrigins: ['https://example.com'],
        allowedMethods: 'GET,POST',
        allowedHeaders: ['Content-Type'],
        allowCredentials: true,
        maxAge: 3600,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(invalidConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('allowedMethods');
    });
    
    test('allowCredentials가 boolean이 아니면 오류', () => {
      const invalidConfig = {
        allowedOrigins: ['https://example.com'],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        allowCredentials: 'true',
        maxAge: 3600,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(invalidConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'allowCredentials')).toBe(true);
    });
    
    test('maxAge가 음수면 오류', () => {
      const invalidConfig = {
        allowedOrigins: ['https://example.com'],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        allowCredentials: true,
        maxAge: -100,
        developmentMode: false,
        debugMode: false
      };
      
      const errors = configManager.validateConfiguration(invalidConfig);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'maxAge')).toBe(true);
    });
  });
  
  describe('런타임 구성 업데이트 (요구사항 5.5)', () => {
    test('유효한 구성으로 업데이트 성공', () => {
      const newConfig = {
        allowedOrigins: ['https://new-domain.com']
      };
      
      const result = configManager.updateConfiguration(newConfig);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config.allowedOrigins).toContain('https://new-domain.com');
    });
    
    test('부분 업데이트 지원 (기존 설정 유지)', () => {
      const initialConfig = configManager.getConfiguration();
      const initialMethods = initialConfig.allowedMethods;
      
      const newConfig = {
        allowedOrigins: ['https://new-domain.com']
      };
      
      const result = configManager.updateConfiguration(newConfig);
      
      expect(result.success).toBe(true);
      expect(result.config.allowedOrigins).toContain('https://new-domain.com');
      expect(result.config.allowedMethods).toEqual(initialMethods);
    });
    
    test('유효하지 않은 구성으로 업데이트 실패', () => {
      const invalidConfig = {
        allowedOrigins: []  // 빈 배열은 유효하지 않음
      };
      
      const result = configManager.updateConfiguration(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('업데이트 실패 시 기존 구성 유지', () => {
      const initialConfig = configManager.getConfiguration();
      const initialOrigins = [...initialConfig.allowedOrigins];
      
      const invalidConfig = {
        allowedOrigins: []
      };
      
      const result = configManager.updateConfiguration(invalidConfig);
      
      expect(result.success).toBe(false);
      
      const currentConfig = configManager.getConfiguration();
      expect(currentConfig.allowedOrigins).toEqual(initialOrigins);
    });
    
    test('여러 필드 동시 업데이트', () => {
      const newConfig = {
        allowedOrigins: ['https://new-domain.com'],
        allowCredentials: false,
        maxAge: 7200
      };
      
      const result = configManager.updateConfiguration(newConfig);
      
      expect(result.success).toBe(true);
      expect(result.config.allowedOrigins).toContain('https://new-domain.com');
      expect(result.config.allowCredentials).toBe(false);
      expect(result.config.maxAge).toBe(7200);
    });
  });
  
  describe('오리진 파싱 및 정규화', () => {
    test('오리진 트림 처리', () => {
      process.env.ALLOWED_ORIGINS = '  https://example.com  ,  https://test.com  ';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://test.com');
      expect(config.allowedOrigins.every(o => !o.includes('  '))).toBe(true);
    });
    
    test('중복 오리진 제거 (대소문자 무관)', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,HTTPS://EXAMPLE.COM,https://test.com';
      
      const config = configManager.loadConfiguration();
      
      // 대소문자 무관하게 중복 제거되어야 함
      const exampleOrigins = config.allowedOrigins.filter(
        o => o.toLowerCase() === 'https://example.com'
      );
      expect(exampleOrigins.length).toBe(1);
    });
    
    test('빈 오리진 필터링', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,,https://test.com,  ,';
      
      const config = configManager.loadConfiguration();
      
      expect(config.allowedOrigins).toContain('https://example.com');
      expect(config.allowedOrigins).toContain('https://test.com');
      expect(config.allowedOrigins.every(o => o.trim().length > 0)).toBe(true);
    });
  });
  
  describe('getConfiguration 함수', () => {
    test('구성이 로드되지 않은 경우 자동 로드', () => {
      configManager.resetConfiguration();
      
      const config = configManager.getConfiguration();
      
      expect(config).toBeDefined();
      expect(config.allowedOrigins).toBeDefined();
      expect(config.allowedMethods).toBeDefined();
    });
    
    test('구성 복사본 반환 (불변성 보장)', () => {
      const config1 = configManager.getConfiguration();
      const config2 = configManager.getConfiguration();
      
      // 다른 객체여야 함
      expect(config1).not.toBe(config2);
      
      // 하지만 내용은 같아야 함
      expect(config1).toEqual(config2);
    });
    
    test('반환된 구성 수정이 원본에 영향 없음', () => {
      const config = configManager.getConfiguration();
      const originalOrigins = [...config.allowedOrigins];
      
      // 반환된 구성 수정
      config.allowedOrigins.push('https://hacker.com');
      
      // 다시 가져온 구성은 수정되지 않아야 함
      const newConfig = configManager.getConfiguration();
      expect(newConfig.allowedOrigins).toEqual(originalOrigins);
    });
  });
  
  describe('기본 구성', () => {
    test('기본 구성에 프로덕션 도메인 포함', () => {
      const defaultConfig = configManager.getDefaultConfiguration();
      
      expect(defaultConfig.allowedOrigins).toContain('https://vipmobile.vercel.app');
    });
    
    test('기본 구성에 localhost 포트 포함', () => {
      const defaultConfig = configManager.getDefaultConfiguration();
      
      expect(defaultConfig.allowedOrigins).toContain('http://localhost:3000');
      expect(defaultConfig.allowedOrigins).toContain('http://localhost:3001');
    });
    
    test('기본 구성에 필수 메서드 포함', () => {
      const defaultConfig = configManager.getDefaultConfiguration();
      
      expect(defaultConfig.allowedMethods).toContain('GET');
      expect(defaultConfig.allowedMethods).toContain('POST');
      expect(defaultConfig.allowedMethods).toContain('PUT');
      expect(defaultConfig.allowedMethods).toContain('DELETE');
      expect(defaultConfig.allowedMethods).toContain('OPTIONS');
    });
    
    test('기본 구성에 필수 헤더 포함', () => {
      const defaultConfig = configManager.getDefaultConfiguration();
      
      expect(defaultConfig.allowedHeaders).toContain('Content-Type');
      expect(defaultConfig.allowedHeaders).toContain('Authorization');
      expect(defaultConfig.allowedHeaders).toContain('X-Requested-With');
    });
    
    test('기본 구성의 자격 증명 설정', () => {
      const defaultConfig = configManager.getDefaultConfiguration();
      
      expect(defaultConfig.allowCredentials).toBe(true);
    });
    
    test('기본 구성의 Max-Age 설정 (24시간)', () => {
      const defaultConfig = configManager.getDefaultConfiguration();
      
      expect(defaultConfig.maxAge).toBe(86400);
    });
  });
});
