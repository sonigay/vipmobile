/**
 * Google Sheets Implementation
 * 
 * Google Sheets API 구현체
 * 
 * Requirements: 5.2
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');

class GoogleSheetsImplementation {
  /**
   * @param {string} sheetId - Google Spreadsheet ID
   * @param {Object} credentials - Service Account 인증 정보
   */
  constructor(sheetId, credentials) {
    if (!sheetId) {
      throw new Error('Sheet ID is required');
    }
    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new Error('Valid credentials are required');
    }

    this.sheetId = sheetId;
    this.credentials = credentials;
    this.doc = null;
  }

  /**
   * Google Sheets 문서 초기화
   * @private
   */
  async initialize() {
    if (!this.doc) {
      try {
        this.doc = new GoogleSpreadsheet(this.sheetId);
        await this.doc.useServiceAccountAuth(this.credentials);
        await this.doc.loadInfo();
      } catch (error) {
        console.error('[GoogleSheetsImplementation] Initialization failed:', error);
        throw new Error(`Failed to initialize Google Sheets: ${error.message}`);
      }
    }
  }

  /**
   * 시트 가져오기
   * @private
   * @param {string} entity - 시트 이름
   * @returns {Promise<Object>} 시트 객체
   */
  async getSheet(entity) {
    await this.initialize();
    
    const sheet = this.doc.sheetsByTitle[entity];
    if (!sheet) {
      throw new Error(`Sheet not found: ${entity}`);
    }
    
    return sheet;
  }

  /**
   * 새로운 레코드 생성
   * @param {string} entity - 시트 이름
   * @param {Object} data - 생성할 데이터
   * @returns {Promise<Object>} 생성된 레코드
   */
  async create(entity, data) {
    try {
      const sheet = await this.getSheet(entity);
      const row = await sheet.addRow(data);
      return row.toObject();
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Create failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 레코드 조회
   * @param {string} entity - 시트 이름
   * @param {Object} filters - 필터 조건
   * @returns {Promise<Array>} 조회된 레코드 배열
   */
  async read(entity, filters = {}) {
    try {
      const sheet = await this.getSheet(entity);
      const rows = await sheet.getRows();
      let results = rows.map(row => row.toObject());
      
      // 필터 적용
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          results = results.filter(item => item[key] === value);
        }
      });
      
      return results;
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Read failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 레코드 업데이트
   * @param {string} entity - 시트 이름
   * @param {string} id - 레코드 ID
   * @param {Object} data - 업데이트할 데이터
   * @returns {Promise<Object>} 업데이트된 레코드
   */
  async update(entity, id, data) {
    try {
      const sheet = await this.getSheet(entity);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('id') === id);
      
      if (!row) {
        throw new Error(`Row not found with id: ${id}`);
      }
      
      // 데이터 업데이트
      Object.entries(data).forEach(([key, value]) => {
        row.set(key, value);
      });
      
      await row.save();
      return row.toObject();
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Update failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 레코드 삭제
   * @param {string} entity - 시트 이름
   * @param {string} id - 레코드 ID
   * @returns {Promise<Object>} 삭제 결과
   */
  async delete(entity, id) {
    try {
      const sheet = await this.getSheet(entity);
      const rows = await sheet.getRows();
      const row = rows.find(r => r.get('id') === id);
      
      if (!row) {
        throw new Error(`Row not found with id: ${id}`);
      }
      
      await row.delete();
      return { success: true, id };
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Delete failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 배치 생성
   * @param {string} entity - 시트 이름
   * @param {Array} dataArray - 생성할 데이터 배열
   * @returns {Promise<Array>} 생성된 레코드 배열
   */
  async batchCreate(entity, dataArray) {
    try {
      const sheet = await this.getSheet(entity);
      const rows = await sheet.addRows(dataArray);
      return rows.map(row => row.toObject());
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Batch create failed for ${entity}:`, error);
      throw error;
    }
  }

  // 트랜잭션은 Google Sheets에서 지원하지 않음
  // transaction() 메서드는 구현하지 않음
}

module.exports = GoogleSheetsImplementation;
