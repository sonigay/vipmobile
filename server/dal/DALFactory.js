/**
 * DAL Factory
 * 
 * Feature Flag에 따라 적절한 구현체를 반환하는 팩토리 클래스
 * Singleton 패턴 적용
 * 
 * Requirements: 5.1, 5.2, 7.1
 */

const DataAccessLayer = require('./DataAccessLayer');
const DatabaseImplementation = require('./DatabaseImplementation');
const GoogleSheetsImplementation = require('./GoogleSheetsImplementation');
const FeatureFlagManager = require('./FeatureFlagManager');

class DALFactory {
  constructor() {
    // Feature Flag Manager 초기화
    this.featureFlags = new FeatureFlagManager();

    // Database Implementation 초기화
    try {
      this.dbImpl = new DatabaseImplementation();
      console.log('[DALFactory] Database implementation initialized');
    } catch (error) {
      console.warn('[DALFactory] Database implementation failed to initialize:', error.message);
      this.dbImpl = null;
    }

    // Google Sheets Implementation 초기화
    try {
      const sheetId = process.env.SHEET_ID;
      const credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      };

      if (!sheetId || !credentials.client_email || !credentials.private_key) {
        throw new Error('Google Sheets credentials not configured');
      }

      this.gsImpl = new GoogleSheetsImplementation(sheetId, credentials);
      console.log('[DALFactory] Google Sheets implementation initialized');
    } catch (error) {
      console.warn('[DALFactory] Google Sheets implementation failed to initialize:', error.message);
      this.gsImpl = null;
    }
  }

  /**
   * 모드 또는 개별 탭에 맞는 DAL 인스턴스 반환
   * @param {string} key - 모드 이름 또는 계층형 키 (예: 'quick-service', 'quick-service:history')
   * @returns {DataAccessLayer} DAL 인스턴스
   */
  getDAL(key) {
    if (!key) {
      throw new Error('Key is required');
    }

    // Feature Flag 확인 (계층 구조 지원)
    const useDatabase = this.featureFlags.isEnabled(key);

    // 구현체 선택
    let implementation;
    let implType;

    if (useDatabase && this.dbImpl) {
      implementation = this.dbImpl;
      implType = 'Database';
    } else if (this.gsImpl) {
      implementation = this.gsImpl;
      implType = 'Google Sheets';
    } else {
      throw new Error('No valid implementation available');
    }

    console.log(`[DALFactory] Key: ${key}, Using: ${implType}`);

    return new DataAccessLayer(implementation);
  }

  /**
   * Feature Flag Manager 반환
   * @returns {FeatureFlagManager}
   */
  getFeatureFlags() {
    return this.featureFlags;
  }

  /**
   * Database Implementation 직접 반환 (테스트용)
   * @returns {DatabaseImplementation|null}
   */
  getDatabaseImpl() {
    return this.dbImpl;
  }

  /**
   * Google Sheets Implementation 직접 반환 (테스트용)
   * @returns {GoogleSheetsImplementation|null}
   */
  getGoogleSheetsImpl() {
    return this.gsImpl;
  }

  /**
   * 구현체 상태 확인
   * @returns {Object} 구현체 상태
   */
  getStatus() {
    return {
      database: this.dbImpl !== null,
      googleSheets: this.gsImpl !== null,
      featureFlags: this.featureFlags.getAllFlags()
    };
  }
}

// Singleton instance
const dalFactory = new DALFactory();

module.exports = dalFactory;
