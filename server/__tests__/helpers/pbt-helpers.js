/**
 * 속성 기반 테스트 헬퍼 함수들
 * fast-check를 사용한 CORS 및 DAL 테스트를 위한 유틸리티
 */

const fc = require('fast-check');

/**
 * HTTP 메서드 생성기
 */
const httpMethodArbitrary = () => {
  return fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH');
};

/**
 * 유효한 오리진 URL 생성기
 * 허용된 오리진 목록에서만 선택
 */
const validOriginArbitrary = () => {
  return fc.constantFrom(
    // 프로덕션 도메인
    'https://vipmobile.vercel.app',
    // 개발 도메인들
    'http://localhost:3000',
    'http://localhost:3001'
  );
};

/**
 * 유효하지 않은 오리진 생성기
 */
const invalidOriginArbitrary = () => {
  return fc.oneof(
    // 잘못된 스키마
    fc.string().map(s => `ftp://${s}.com`),
    fc.string().map(s => `file://${s}`),
    // 허용되지 않은 도메인
    fc.webUrl({ validSchemes: ['http', 'https'] }).filter(url => 
      !url.includes('vipmobile.vercel.app') && 
      !url.includes('localhost')
    ),
    // 빈 문자열이나 null
    fc.constantFrom('', null, undefined)
  );
};

/**
 * HTTP 헤더 이름 생성기
 */
const httpHeaderNameArbitrary = () => {
  return fc.oneof(
    // 표준 CORS 헤더들
    fc.constantFrom(
      'Content-Type',
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Cache-Control'
    ),
    // 커스텀 헤더들
    fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-zA-Z0-9\-_]+$/.test(s))
      .map(s => `X-${s}`)
  );
};

/**
 * CORS 요청 컨텍스트 생성기
 */
const corsRequestContextArbitrary = () => {
  return fc.record({
    method: httpMethodArbitrary(),
    origin: fc.option(validOriginArbitrary(), { nil: undefined }),
    headers: fc.dictionary(
      httpHeaderNameArbitrary(),
      fc.string({ maxLength: 100 }),
      { maxKeys: 10 }
    ),
    path: fc.string({ minLength: 1, maxLength: 100 }).map(s => `/${s}`),
    isPreflight: fc.boolean()
  });
};

/**
 * 환경 변수 구성 생성기
 */
const corsConfigArbitrary = () => {
  return fc.record({
    CORS_ORIGIN: fc.option(
      fc.array(validOriginArbitrary(), { minLength: 1, maxLength: 5 })
        .map(origins => origins.join(',')),
      { nil: undefined }
    ),
    CORS_CREDENTIALS: fc.option(
      fc.constantFrom('true', 'false'),
      { nil: undefined }
    ),
    NODE_ENV: fc.constantFrom('development', 'production', 'test')
  });
};

/**
 * 대소문자 변형 오리진 생성기
 */
const caseVariantOriginArbitrary = () => {
  const baseOrigins = [
    'https://vipmobile.vercel.app',
    'http://localhost:3000'
  ];
  
  return fc.constantFrom(...baseOrigins).chain(origin => {
    return fc.array(fc.boolean(), { minLength: origin.length, maxLength: origin.length })
      .map(caseFlags => {
        return origin.split('').map((char, index) => 
          caseFlags[index] ? char.toUpperCase() : char.toLowerCase()
        ).join('');
      });
  });
};

/**
 * API 경로 생성기 (/api/direct 하위)
 */
const apiPathArbitrary = () => {
  const knownPaths = [
    '/api/direct/store-image/upload',
    '/api/direct/mobiles-master',
    '/api/direct/policy-settings',
    '/api/direct/store-main-page-texts',
    '/api/direct/transit-location/all',
    '/api/direct/transit-location/list'
  ];
  
  return fc.oneof(
    // 알려진 API 경로들
    fc.constantFrom(...knownPaths),
    // 동적 API 경로들
    fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-zA-Z0-9\-_/]+$/.test(s))
      .map(s => `/api/direct/${s}`)
  );
};

/**
 * 테스트 실행 설정
 */
const PBT_CONFIG = {
  // 각 속성 테스트당 실행 횟수 (최소 100회)
  numRuns: 100,
  // 시드 설정 (재현 가능한 테스트)
  seed: 42,
  // 타임아웃 설정
  timeout: 5000,
  // 실패 시 축소 시도 횟수
  maxSkipsPerRun: 100
};

/**
 * 속성 테스트 실행 헬퍼
 */
const runPropertyTest = (name, property, config = {}) => {
  const testConfig = { ...PBT_CONFIG, ...config };
  
  test(name, () => {
    fc.assert(property, testConfig);
  });
};

module.exports = {
  // 생성기들
  httpMethodArbitrary,
  validOriginArbitrary,
  invalidOriginArbitrary,
  httpHeaderNameArbitrary,
  corsRequestContextArbitrary,
  corsConfigArbitrary,
  caseVariantOriginArbitrary,
  apiPathArbitrary,
  
  // 설정 및 헬퍼
  PBT_CONFIG,
  runPropertyTest,
  
  // fast-check 직접 접근
  fc
};

// ============================================================================
// DAL (Data Access Layer) 테스트 헬퍼 함수들
// ============================================================================

/**
 * 테이블 이름 생성기
 * Phase 1 마이그레이션 대상 테이블들
 */
const tableNameArbitrary = () => {
  return fc.constantFrom(
    // Direct Store Mode 테이블들
    'direct_store_policy_margin',
    'direct_store_policy_addon_services',
    'direct_store_policy_insurance',
    'direct_store_policy_special',
    'direct_store_settings',
    'direct_store_main_page_texts',
    'direct_store_plan_master',
    'direct_store_device_master',
    'direct_store_device_pricing_policy',
    'direct_store_model_images',
    'direct_store_todays_mobiles',
    'direct_store_transit_locations',
    'direct_store_photos',
    // Policy Mode 테이블들
    'policy_table_settings',
    'policy_table_list',
    'policy_user_groups',
    'policy_tab_order',
    'policy_group_change_history',
    'policy_default_groups',
    'policy_other_types',
    'budget_channel_settings',
    'budget_basic_settings',
    'budget_basic_data_settings'
  );
};

/**
 * 모드 이름 생성기
 */
const modeNameArbitrary = () => {
  return fc.constantFrom(
    'direct-store',
    'policy',
    'customer'
  );
};

/**
 * UUID 생성기 (PostgreSQL UUID 형식)
 */
const uuidArbitrary = () => {
  return fc.uuid();
};

/**
 * 타임스탬프 생성기 (ISO 8601 형식)
 */
const timestampArbitrary = () => {
  return fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(date => date.toISOString());
};

/**
 * 일반 데이터 레코드 생성기
 * 모든 테이블에 공통적으로 있는 필드들
 */
const baseRecordArbitrary = () => {
  return fc.record({
    id: uuidArbitrary(),
    created_at: timestampArbitrary(),
    updated_at: timestampArbitrary()
  });
};

/**
 * 정책 마진 데이터 생성기
 */
const policyMarginDataArbitrary = () => {
  return fc.record({
    ...baseRecordArbitrary().value,
    policy_name: fc.string({ minLength: 1, maxLength: 100 }),
    margin_rate: fc.float({ min: 0, max: 100 }),
    is_active: fc.boolean(),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: null })
  });
};

/**
 * 설정 데이터 생성기
 */
const settingsDataArbitrary = () => {
  return fc.record({
    ...baseRecordArbitrary().value,
    setting_key: fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
    setting_value: fc.string({ maxLength: 1000 }),
    setting_type: fc.constantFrom('string', 'number', 'boolean', 'json'),
    is_public: fc.boolean()
  });
};

/**
 * 요금제 마스터 데이터 생성기
 */
const planMasterDataArbitrary = () => {
  return fc.record({
    ...baseRecordArbitrary().value,
    plan_name: fc.string({ minLength: 1, maxLength: 100 }),
    plan_code: fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[A-Z0-9_]+$/.test(s)),
    monthly_fee: fc.integer({ min: 0, max: 200000 }),
    data_limit: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
    carrier: fc.constantFrom('SKT', 'KT', 'LGU+', 'MVNO'),
    is_active: fc.boolean()
  });
};

/**
 * 단말 마스터 데이터 생성기
 */
const deviceMasterDataArbitrary = () => {
  return fc.record({
    ...baseRecordArbitrary().value,
    device_name: fc.string({ minLength: 1, maxLength: 100 }),
    device_code: fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => /^[A-Z0-9_]+$/.test(s)),
    manufacturer: fc.constantFrom('Samsung', 'Apple', 'LG', 'Xiaomi', 'Google'),
    model_number: fc.string({ minLength: 1, maxLength: 50 }),
    release_price: fc.integer({ min: 0, max: 3000000 }),
    is_available: fc.boolean()
  });
};

/**
 * 정책표 설정 데이터 생성기
 */
const policyTableSettingsDataArbitrary = () => {
  return fc.record({
    ...baseRecordArbitrary().value,
    table_name: fc.string({ minLength: 1, maxLength: 100 }),
    display_order: fc.integer({ min: 0, max: 100 }),
    is_visible: fc.boolean(),
    permissions: fc.array(fc.constantFrom('read', 'write', 'delete'), { minLength: 1, maxLength: 3 }),
    metadata: fc.option(fc.jsonValue(), { nil: null })
  });
};

/**
 * 필터 조건 생성기
 */
const filtersArbitrary = () => {
  return fc.record({
    id: fc.option(uuidArbitrary(), { nil: undefined }),
    is_active: fc.option(fc.boolean(), { nil: undefined }),
    created_after: fc.option(timestampArbitrary(), { nil: undefined }),
    limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined })
  });
};

/**
 * CRUD 작업 타입 생성기
 */
const crudOperationArbitrary = () => {
  return fc.constantFrom('create', 'read', 'update', 'delete');
};

/**
 * 마이그레이션 배치 데이터 생성기
 * 일부는 유효하고 일부는 무효한 레코드 혼합
 */
const migrationBatchArbitrary = (dataArbitrary) => {
  return fc.array(
    fc.record({
      valid: fc.boolean(),
      data: dataArbitrary
    }),
    { minLength: 10, maxLength: 100 }
  );
};

/**
 * 유효하지 않은 데이터 생성기
 * 검증 실패를 유발하는 데이터
 */
const invalidDataArbitrary = () => {
  return fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(''),
    fc.constant([]),
    fc.record({
      // 필수 필드 누락
      invalid_field: fc.string()
    }),
    fc.record({
      // 잘못된 타입
      id: fc.integer(),
      created_at: fc.string({ maxLength: 5 })
    })
  );
};

/**
 * 피처 플래그 상태 생성기
 */
const featureFlagStateArbitrary = () => {
  return fc.record({
    'direct-store': fc.boolean(),
    'policy': fc.boolean(),
    'customer': fc.boolean()
  });
};

/**
 * 데이터베이스 에러 시나리오 생성기
 */
const dbErrorScenarioArbitrary = () => {
  return fc.constantFrom(
    'connection_timeout',
    'authentication_failed',
    'table_not_found',
    'constraint_violation',
    'network_error',
    'permission_denied'
  );
};

/**
 * 백업 파일명 생성기
 */
const backupFilenameArbitrary = (tableName) => {
  return fc.record({
    tableName: fc.constant(tableName),
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
      .map(date => date.toISOString().replace(/[:.]/g, '-'))
  }).map(({ tableName, timestamp }) => `${tableName}_${timestamp}.json`);
};

/**
 * 성능 메트릭 생성기
 */
const performanceMetricsArbitrary = () => {
  return fc.record({
    queryTime: fc.integer({ min: 0, max: 5000 }),
    rowCount: fc.integer({ min: 0, max: 10000 }),
    memoryUsage: fc.integer({ min: 0, max: 1000000000 }),
    cpuUsage: fc.float({ min: 0, max: 100 })
  });
};

/**
 * 트랜잭션 작업 시퀀스 생성기
 */
const transactionSequenceArbitrary = () => {
  return fc.array(
    fc.record({
      operation: crudOperationArbitrary(),
      tableName: tableNameArbitrary(),
      data: fc.jsonValue(),
      shouldFail: fc.boolean()
    }),
    { minLength: 2, maxLength: 10 }
  );
};

/**
 * DAL 테스트 설정
 */
const DAL_PBT_CONFIG = {
  numRuns: 100,
  timeout: 10000,
  seed: 42,
  maxSkipsPerRun: 100
};

/**
 * DAL 속성 테스트 실행 헬퍼
 */
const runDALPropertyTest = (name, property, config = {}) => {
  const testConfig = { ...DAL_PBT_CONFIG, ...config };
  
  test(name, () => {
    fc.assert(property, testConfig);
  }, testConfig.timeout);
};

/**
 * 비동기 DAL 속성 테스트 실행 헬퍼
 */
const runAsyncDALPropertyTest = (name, asyncProperty, config = {}) => {
  const testConfig = { ...DAL_PBT_CONFIG, ...config };
  
  test(name, async () => {
    await fc.assert(asyncProperty, testConfig);
  }, testConfig.timeout);
};

/**
 * 데이터 동등성 검증 헬퍼
 * 타임스탬프 필드를 제외하고 두 객체가 동등한지 확인
 */
const assertDataEquivalence = (data1, data2, excludeFields = ['created_at', 'updated_at']) => {
  const normalize = (obj) => {
    const normalized = { ...obj };
    excludeFields.forEach(field => delete normalized[field]);
    return normalized;
  };
  
  return JSON.stringify(normalize(data1)) === JSON.stringify(normalize(data2));
};

/**
 * 마이그레이션 통계 검증 헬퍼
 */
const validateMigrationStats = (stats, totalRecords) => {
  return (
    stats.total === totalRecords &&
    stats.success + stats.failed === totalRecords &&
    stats.success >= 0 &&
    stats.failed >= 0 &&
    Array.isArray(stats.errors)
  );
};

/**
 * 테이블별 데이터 생성기 매핑
 */
const getDataArbitraryForTable = (tableName) => {
  const mapping = {
    'direct_store_policy_margin': policyMarginDataArbitrary,
    'direct_store_settings': settingsDataArbitrary,
    'direct_store_plan_master': planMasterDataArbitrary,
    'direct_store_device_master': deviceMasterDataArbitrary,
    'policy_table_settings': policyTableSettingsDataArbitrary
  };
  
  return mapping[tableName] || baseRecordArbitrary;
};

// DAL 헬퍼 함수들을 모듈에 추가
module.exports = {
  // 기존 CORS 생성기들
  httpMethodArbitrary,
  validOriginArbitrary,
  invalidOriginArbitrary,
  httpHeaderNameArbitrary,
  corsRequestContextArbitrary,
  corsConfigArbitrary,
  caseVariantOriginArbitrary,
  apiPathArbitrary,
  
  // DAL 생성기들
  tableNameArbitrary,
  modeNameArbitrary,
  uuidArbitrary,
  timestampArbitrary,
  baseRecordArbitrary,
  policyMarginDataArbitrary,
  settingsDataArbitrary,
  planMasterDataArbitrary,
  deviceMasterDataArbitrary,
  policyTableSettingsDataArbitrary,
  filtersArbitrary,
  crudOperationArbitrary,
  migrationBatchArbitrary,
  invalidDataArbitrary,
  featureFlagStateArbitrary,
  dbErrorScenarioArbitrary,
  backupFilenameArbitrary,
  performanceMetricsArbitrary,
  transactionSequenceArbitrary,
  getDataArbitraryForTable,
  
  // 설정 및 헬퍼
  PBT_CONFIG,
  DAL_PBT_CONFIG,
  runPropertyTest,
  runDALPropertyTest,
  runAsyncDALPropertyTest,
  
  // 검증 헬퍼
  assertDataEquivalence,
  validateMigrationStats,
  
  // fast-check 직접 접근
  fc
};