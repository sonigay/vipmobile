/**
 * Database Implementation
 * 
 * Supabase (PostgreSQL) 데이터베이스 구현체
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */

const { supabase } = require('../supabaseClient');

class DatabaseImplementation {
  constructor() {
    if (!supabase) {
      throw new Error('Supabase client is not initialized');
    }
  }

  /**
   * 새로운 레코드 생성
   * @param {string} entity - 테이블 이름
   * @param {Object} data - 생성할 데이터
   * @returns {Promise<Object>} 생성된 레코드
   */
  async create(entity, data) {
    try {
      const { data: result, error } = await supabase
        .from(entity)
        .insert(data)
        .select()
        .single();
      
      if (error) {
        throw new Error(`DB Create Error [${entity}]: ${error.message}`);
      }
      
      return result;
    } catch (error) {
      console.error(`[DatabaseImplementation] Create failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 레코드 조회
   * @param {string} entity - 테이블 이름
   * @param {Object} filters - 필터 조건
   * @returns {Promise<Array>} 조회된 레코드 배열
   */
  async read(entity, filters = {}) {
    try {
      let query = supabase.from(entity).select('*');
      
      // 필터 적용
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
      
      const { data, error } = await query;
      
      if (error) {
        throw new Error(`DB Read Error [${entity}]: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error(`[DatabaseImplementation] Read failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 레코드 업데이트
   * @param {string} entity - 테이블 이름
   * @param {string} id - 레코드 ID
   * @param {Object} data - 업데이트할 데이터
   * @returns {Promise<Object>} 업데이트된 레코드
   */
  async update(entity, id, data) {
    try {
      const { data: result, error } = await supabase
        .from(entity)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new Error(`DB Update Error [${entity}]: ${error.message}`);
      }
      
      if (!result) {
        throw new Error(`Record not found: ${entity} with id ${id}`);
      }
      
      return result;
    } catch (error) {
      console.error(`[DatabaseImplementation] Update failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 레코드 삭제
   * @param {string} entity - 테이블 이름
   * @param {string} id - 레코드 ID
   * @returns {Promise<Object>} 삭제 결과
   */
  async delete(entity, id) {
    try {
      const { error } = await supabase
        .from(entity)
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(`DB Delete Error [${entity}]: ${error.message}`);
      }
      
      return { success: true, id };
    } catch (error) {
      console.error(`[DatabaseImplementation] Delete failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 배치 생성
   * @param {string} entity - 테이블 이름
   * @param {Array} dataArray - 생성할 데이터 배열
   * @returns {Promise<Array>} 생성된 레코드 배열
   */
  async batchCreate(entity, dataArray) {
    try {
      const { data, error } = await supabase
        .from(entity)
        .insert(dataArray)
        .select();
      
      if (error) {
        throw new Error(`DB Batch Create Error [${entity}]: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error(`[DatabaseImplementation] Batch create failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 트랜잭션 실행
   * @param {Function} callback - 트랜잭션 내에서 실행할 콜백
   * @returns {Promise<any>} 콜백 실행 결과
   */
  async transaction(callback) {
    try {
      // Supabase는 PostgreSQL 트랜잭션을 지원
      // 복잡한 트랜잭션은 RPC 또는 직접 SQL 사용
      return await callback(supabase);
    } catch (error) {
      console.error('[DatabaseImplementation] Transaction failed:', error);
      throw error;
    }
  }
}

module.exports = DatabaseImplementation;
