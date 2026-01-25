/**
 * Data Validator
 * 
 * Google Sheets 데이터를 Supabase로 마이그레이션하기 전에
 * 데이터 유효성을 검증합니다.
 * 
 * Requirements: 4.2, 4.5
 */

class DataValidator {
  constructor() {
    // 테이블별 검증 규칙
    this.rules = this.initializeRules();
    this.errors = [];
  }

  /**
   * 검증 규칙 초기화
   */
  initializeRules() {
    return {
      // 직영점 모드
      'direct_store_policy_margin': {
        required: ['통신사'],
        types: {
          '통신사': 'string',
          '마진': 'number'
        }
      },
      'direct_store_policy_addon_services': {
        required: ['통신사', '서비스명'],
        types: {
          '통신사': 'string',
          '서비스명': 'string',
          '월요금': 'number',
          '유치추가금액': 'number',
          '미유치차감금액': 'number'
        }
      },
      'direct_store_settings': {
        required: ['통신사', '설정유형'],
        types: {
          '통신사': 'string',
          '설정유형': 'string'
        }
      },
      'direct_store_plan_master': {
        required: ['통신사', '요금제명'],
        types: {
          '통신사': 'string',
          '요금제명': 'string',
          '기본료': 'number'
        }
      },
      'direct_store_device_master': {
        required: ['통신사', '모델ID', '모델명'],
        types: {
          '통신사': 'string',
          '모델ID': 'string',
          '모델명': 'string',
          '출고가': 'number'
        }
      },
      // 정책 모드
      'policy_table_settings': {
        required: ['정책표ID', '정책표명'],
        types: {
          '정책표ID': 'string',
          '정책표명': 'string'
        }
      },
      'policy_table_list': {
        required: ['정책표ID', '정책명'],
        types: {
          '정책표ID': 'string',
          '정책명': 'string'
        }
      },
      // 고객 모드
      'customer_info': {
        required: ['고객명', '연락처'],
        types: {
          '고객명': 'string',
          '연락처': 'string'
        }
      },
      'purchase_queue': {
        required: ['고객명', '연락처', '등록일시'],
        types: {
          '고객명': 'string',
          '연락처': 'string'
        }
      },
      'board': {
        required: ['제목', '내용', '작성자', '작성일시'],
        types: {
          '제목': 'string',
          '내용': 'string',
          '작성자': 'string'
        }
      }
    };
  }

  /**
   * 단일 레코드 검증
   * @param {string} tableName - 테이블 이름
   * @param {Object} data - 검증할 데이터
   * @param {number} rowNumber - 행 번호 (에러 메시지용)
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate(tableName, data, rowNumber = null) {
    const errors = [];
    
    // 기본 검증
    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { valid: false, errors };
    }

    // 테이블별 규칙 가져오기
    const tableRules = this.rules[tableName];
    
    if (!tableRules) {
      // 규칙이 없는 테이블은 기본 검증만 수행
      return { valid: true, errors: [] };
    }

    // 필수 필드 검증
    if (tableRules.required) {
      for (const field of tableRules.required) {
        if (!data[field] || data[field] === '') {
          const msg = rowNumber 
            ? `Row ${rowNumber}: Required field "${field}" is missing or empty`
            : `Required field "${field}" is missing or empty`;
          errors.push(msg);
        }
      }
    }

    // 타입 검증
    if (tableRules.types) {
      for (const [field, expectedType] of Object.entries(tableRules.types)) {
        const value = data[field];
        
        // null/undefined는 허용 (nullable)
        if (value === null || value === undefined || value === '') {
          continue;
        }

        const actualType = this.getType(value);
        
        if (actualType !== expectedType) {
          const msg = rowNumber
            ? `Row ${rowNumber}: Field "${field}" should be ${expectedType}, got ${actualType}`
            : `Field "${field}" should be ${expectedType}, got ${actualType}`;
          errors.push(msg);
        }
      }
    }

    // 커스텀 검증 규칙
    if (tableRules.custom) {
      for (const customRule of tableRules.custom) {
        const customError = customRule(data, rowNumber);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 값의 타입 확인
   */
  getType(value) {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number' && !isNaN(value)) return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  /**
   * 배치 검증
   * @param {string} tableName - 테이블 이름
   * @param {Array} dataArray - 검증할 데이터 배열
   * @returns {Object} { valid: boolean, validCount: number, invalidCount: number, errors: Array }
   */
  validateBatch(tableName, dataArray) {
    if (!Array.isArray(dataArray)) {
      return {
        valid: false,
        validCount: 0,
        invalidCount: 0,
        errors: ['Data must be an array']
      };
    }

    const results = {
      valid: true,
      validCount: 0,
      invalidCount: 0,
      errors: []
    };

    dataArray.forEach((data, index) => {
      const validation = this.validate(tableName, data, index + 1);
      
      if (validation.valid) {
        results.validCount++;
      } else {
        results.invalidCount++;
        results.valid = false;
        results.errors.push({
          row: index + 1,
          data,
          errors: validation.errors
        });
      }
    });

    return results;
  }

  /**
   * 커스텀 검증 규칙 추가
   * @param {string} tableName - 테이블 이름
   * @param {Function} rule - 검증 함수
   */
  addCustomRule(tableName, rule) {
    if (!this.rules[tableName]) {
      this.rules[tableName] = {};
    }
    
    if (!this.rules[tableName].custom) {
      this.rules[tableName].custom = [];
    }
    
    this.rules[tableName].custom.push(rule);
  }

  /**
   * 데이터 변환 (타입 강제)
   * @param {string} tableName - 테이블 이름
   * @param {Object} data - 변환할 데이터
   * @returns {Object} 변환된 데이터
   */
  transform(tableName, data) {
    const tableRules = this.rules[tableName];
    
    if (!tableRules || !tableRules.types) {
      return data;
    }

    const transformed = { ...data };

    for (const [field, expectedType] of Object.entries(tableRules.types)) {
      const value = transformed[field];
      
      // null/undefined는 그대로 유지
      if (value === null || value === undefined || value === '') {
        transformed[field] = null;
        continue;
      }

      // 타입 변환
      try {
        switch (expectedType) {
          case 'number':
            transformed[field] = this.toNumber(value);
            break;
          case 'boolean':
            transformed[field] = this.toBoolean(value);
            break;
          case 'date':
            transformed[field] = this.toDate(value);
            break;
          case 'string':
            transformed[field] = String(value);
            break;
          default:
            // 변환 없음
            break;
        }
      } catch (error) {
        console.warn(`Failed to transform field "${field}" to ${expectedType}:`, error.message);
        // 변환 실패 시 원본 유지
      }
    }

    return transformed;
  }

  /**
   * 숫자로 변환
   */
  toNumber(value) {
    if (typeof value === 'number') return value;
    
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Cannot convert "${value}" to number`);
    }
    
    return num;
  }

  /**
   * 불리언으로 변환
   */
  toBoolean(value) {
    if (typeof value === 'boolean') return value;
    
    const str = String(value).toLowerCase().trim();
    
    if (['true', '1', 'o', 'y', 'yes'].includes(str)) return true;
    if (['false', '0', 'x', 'n', 'no'].includes(str)) return false;
    
    throw new Error(`Cannot convert "${value}" to boolean`);
  }

  /**
   * 날짜로 변환
   */
  toDate(value) {
    if (value instanceof Date) return value;
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Cannot convert "${value}" to date`);
    }
    
    return date;
  }

  /**
   * 검증 통계 출력
   */
  printStats(results) {
    console.log('\n📊 검증 통계:');
    console.log(`   총 레코드: ${results.validCount + results.invalidCount}`);
    console.log(`   유효: ${results.validCount}`);
    console.log(`   무효: ${results.invalidCount}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ 검증 실패 (${results.errors.length}개):`);
      results.errors.slice(0, 10).forEach((error, idx) => {
        console.log(`   ${idx + 1}. Row ${error.row}:`);
        error.errors.forEach(err => console.log(`      - ${err}`));
      });
      
      if (results.errors.length > 10) {
        console.log(`   ... 그 외 ${results.errors.length - 10}개`);
      }
    }
  }
}

module.exports = DataValidator;
