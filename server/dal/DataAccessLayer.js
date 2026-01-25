/**
 * Data Access Layer (DAL)
 * 
 * 데이터 소스를 추상화하여 Google Sheets와 Database를 
 * 통일된 인터페이스로 접근합니다.
 * 
 * Requirements: 5.1, 5.2
 */

class DataAccessLayer {
  /**
   * @param {Object} implementation - GoogleSheetsImpl 또는 DatabaseImpl
   */
  constructor(implementation) {
    if (!implementation) {
      throw new Error('Implementation is required');
    }
    this.implementation = implementation;
  }

  /**
   * 새로운 레코드 생성
   * @param {string} entity - 테이블/시트 이름
   * @param {Object} data - 생성할 데이터
   * @returns {Promise<Object>} 생성된 레코드
   */
  async create(entity, data) {
    if (!entity) {
      throw new Error('Entity name is required');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }

    return await this.implementation.create(entity, data);
  }

  /**
   * 레코드 조회
   * @param {string} entity - 테이블/시트 이름
   * @param {Object} filters - 필터 조건 (선택적)
   * @returns {Promise<Array>} 조회된 레코드 배열
   */
  async read(entity, filters = {}) {
    if (!entity) {
      throw new Error('Entity name is required');
    }

    return await this.implementation.read(entity, filters);
  }

  /**
   * 레코드 업데이트
   * @param {string} entity - 테이블/시트 이름
   * @param {string} id - 레코드 ID
   * @param {Object} data - 업데이트할 데이터
   * @returns {Promise<Object>} 업데이트된 레코드
   */
  async update(entity, id, data) {
    if (!entity) {
      throw new Error('Entity name is required');
    }
    if (!id) {
      throw new Error('Record ID is required');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }

    return await this.implementation.update(entity, id, data);
  }

  /**
   * 레코드 삭제
   * @param {string} entity - 테이블/시트 이름
   * @param {string} id - 레코드 ID
   * @returns {Promise<Object>} 삭제 결과
   */
  async delete(entity, id) {
    if (!entity) {
      throw new Error('Entity name is required');
    }
    if (!id) {
      throw new Error('Record ID is required');
    }

    return await this.implementation.delete(entity, id);
  }

  /**
   * 배치 생성
   * @param {string} entity - 테이블/시트 이름
   * @param {Array} dataArray - 생성할 데이터 배열
   * @returns {Promise<Array>} 생성된 레코드 배열
   */
  async batchCreate(entity, dataArray) {
    if (!entity) {
      throw new Error('Entity name is required');
    }
    if (!Array.isArray(dataArray)) {
      throw new Error('Data must be an array');
    }
    if (dataArray.length === 0) {
      return [];
    }

    return await this.implementation.batchCreate(entity, dataArray);
  }

  /**
   * 트랜잭션 실행 (Database only)
   * @param {Function} callback - 트랜잭션 내에서 실행할 콜백
   * @returns {Promise<any>} 콜백 실행 결과
   */
  async transaction(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (this.implementation.transaction) {
      return await this.implementation.transaction(callback);
    }
    
    throw new Error('Transactions not supported by this implementation');
  }

  /**
   * 구현체 타입 확인
   * @returns {string} 'database' 또는 'sheets'
   */
  getImplementationType() {
    if (this.implementation.constructor.name === 'DatabaseImplementation') {
      return 'database';
    } else if (this.implementation.constructor.name === 'GoogleSheetsImplementation') {
      return 'sheets';
    }
    return 'unknown';
  }
}

module.exports = DataAccessLayer;
