/**
 * Google Sheets Implementation
 * 
 * Google Sheets API 구현체
 * 
 * Requirements: 5.2
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const cacheManager = require('../utils/cacheManager'); // 캐시 매니저 추가

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
    this.CACHE_TTL = 5 * 60 * 1000; // 5분 캐시
    this.pendingRequests = new Map(); // 진행 중인 요청(Promise) 저장소
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
        console.log(`[GoogleSheetsImplementation] Initialized: ${this.doc.title}`);
      } catch (error) {
        console.error('[GoogleSheetsImplementation] Initialization failed:', error);
        throw new Error(`Failed to initialize Google Sheets: ${error.message}`);
      }
    }
    // 이미 초기화된 경우 재사용 (doc.loadInfo()를 매번 호출하지 않음)
  }

  /**
   * 시트 가져오기
   * @private
   * @param {string} entity - 시트 이름
   * @returns {Promise<Object>} 시트 객체
   */
  async getSheet(entity) {
    await this.initialize();

    // 논리적 테이블 이름 -> 실제 시트 이름 매핑
    const SHEET_MAPPING = {
      // 직영점 관련
      'direct_store_device_master': '직영점_단말마스터',
      'direct_store_model_images': '직영점_모델이미지',
      'direct_store_todays_mobiles': '직영점_오늘의휴대폰',
      'direct_store_sales_daily': '직영점_판매일보',
      'direct_store_settings': '직영점_설정',
      'direct_store_policy_margin': '직영점_정책_마진',
      'direct_store_policy_addon_services': '직영점_정책_부가서비스',
      'direct_store_policy_special': '직영점_정책_별도',
      'direct_store_policy_insurance': '직영점_정책_보험상품',
      'direct_store_plan_master': '직영점_요금제마스터',
      'direct_store_main_page_texts': '직영점_메인페이지문구',
      'direct_store_transit_locations': '직영점_대중교통위치',
      'direct_store_photos': '직영점_매장사진',
      'direct_store_device_pricing_policy': '직영점_단말요금정책'
    };

    const sheetTitle = SHEET_MAPPING[entity] || entity;

    // 디버깅 로그 (매핑 확인용)
    if (SHEET_MAPPING[entity]) {
      // console.log(`[GoogleSheetsImplementation] Mapping '${entity}' -> '${sheetTitle}'`);
    }

    const sheet = this.doc.sheetsByTitle[sheetTitle];
    if (!sheet) {
      console.error(`[GoogleSheetsImplementation] Available sheets: ${Object.keys(this.doc.sheetsByTitle).join(', ')}`);
      throw new Error(`Sheet not found: ${sheetTitle} (Logical: ${entity})`);
    }

    return sheet;
  }

  /**
   * Google Sheets v3 Row 객체를 일반 객체로 변환
   * @private
   * @param {Object} row - Google Sheets Row 객체
   * @returns {Object} 일반 객체
   */
  _rowToObject(row) {
    if (!row) return null;

    // v3에서는 row 객체의 프로퍼티 자체가 데이터임
    // 내부 프로퍼티(_xml, _links 등)와 메서드(save, del)를 제외하고 반환
    const obj = {};
    const keys = Object.keys(row);

    // _로 시작하지 않고 함수가 아닌 프로퍼티만 추출
    keys.forEach(key => {
      if (!key.startsWith('_') && typeof row[key] !== 'function') {
        obj[key] = row[key];
      }
    });

    return obj;
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

      // 캐시 무효화 (해당 엔티티 관련 모든 캐시 삭제)
      cacheManager.deletePattern(`GS:${entity}`);

      return this._rowToObject(row);
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Create failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 시트 전체 데이터 조회 (내부용, 캐싱 및 중복 요청 방지 적용)
   * @private
   * @param {string} entity - 시트 이름
   * @returns {Promise<Array>} 전체 데이터 배열
   */
  async _fetchAllData(entity) {
    const cacheKey = `GS:${entity}:ALL`; // 전체 데이터 캐시 키

    // 1. 캐시 확인
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      if (process.env.NODE_ENV === 'development') {
        process.stdout.write('.'); // 캐시 히트
      }
      return cachedData;
    }

    // 2. 진행 중인 요청 확인 (Request Coalescing)
    if (this.pendingRequests.has(entity)) {
      if (process.env.NODE_ENV === 'development') {
        process.stdout.write('+'); // 중복 요청 병합
      }
      return this.pendingRequests.get(entity);
    }

    // 3. 실제 데이터 요청 및 Promise 저장
    const fetchPromise = (async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[GoogleSheetsImplementation] API Fetch: ${entity}`);
        }

        const sheet = await this.getSheet(entity);
        const rows = await sheet.getRows();
        const results = rows.map(row => this._rowToObject(row));

        // 성공 시 캐시 저장
        cacheManager.set(cacheKey, results, this.CACHE_TTL);
        return results;
      } catch (error) {
        throw error;
      } finally {
        // 완료 후 pendingMap에서 제거
        this.pendingRequests.delete(entity);
      }
    })();

    this.pendingRequests.set(entity, fetchPromise);
    return fetchPromise;
  }

  /**
   * 레코드 조회 (캐싱 적용)
   * @param {string} entity - 시트 이름
   * @param {Object} filters - 필터 조건
   * @returns {Promise<Array>} 조회된 레코드 배열
   */
  async read(entity, filters = {}) {
    try {
      // 전체 데이터 조회 (캐시/중복방지 적용됨)
      let results = await this._fetchAllData(entity);

      // 메모리상에서 필터 적용
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
      // v3 호환: id 컬럼 직접 접근
      const row = rows.find(r => r.id === id || r['id'] === id);

      if (!row) {
        throw new Error(`Row not found with id: ${id}`);
      }

      // 데이터 업데이트 (v3 방식: 프로퍼티 직접 할당)
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id') { // ID는 수정 불가
          row[key] = value;
        }
      });

      await row.save();

      // 캐시 무효화
      cacheManager.deletePattern(`GS:${entity}`);

      return this._rowToObject(row);
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
      // v3 호환: id 컬럼 직접 접근
      const row = rows.find(r => r.id === id || r['id'] === id);

      if (!row) {
        throw new Error(`Row not found with id: ${id}`);
      }

      await row.del(); // v3에서는 delete()가 아니라 del()

      // 캐시 무효화
      cacheManager.deletePattern(`GS:${entity}`);

      return { success: true, id };
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Delete failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 테이블의 모든 레코드 삭제 (재빌드용)
   * @param {string} entity - 시트 이름
   * @returns {Promise<boolean>} 성공 여부
   */
  async deleteAll(entity) {
    try {
      const sheet = await this.getSheet(entity);

      // v3 최적화: resize를 사용하여 모든 행 삭제 (헤더 유지 가정: rowCount 1)
      if (sheet.resize) {
        await sheet.resize({ rowCount: 1, columnCount: sheet.columnCount });
        console.log(`[GoogleSheetsImplementation] deleteAll(resize) success: ${entity}`);
      } else {
        // resize가 지원되지 않는 경우 (fallback)
        // 주의: 매우 느리고 Quota 소모가 큼
        const rows = await sheet.getRows();
        // 5개씩 끊어서 삭제 (Rate Limit 방지)
        const chunk = 5;
        for (let i = 0; i < rows.length; i += chunk) {
          const batch = rows.slice(i, i + chunk);
          await Promise.all(batch.map(row => row.del()));
          await new Promise(resolve => setTimeout(resolve, 500)); // 딜레이
        }
      }

      // 캐시 무효화
      cacheManager.deletePattern(`GS:${entity}`);

      return true;
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] deleteAll failed for ${entity}:`, error);
      throw error;
    }
  }

  /**
   * 배치 생성 (Throttling 적용)
   * @param {string} entity - 시트 이름
   * @param {Array} dataArray - 생성할 데이터 배열
   * @returns {Promise<Array>} 생성된 레코드 배열
   */
  async batchCreate(entity, dataArray) {
    try {
      const sheet = await this.getSheet(entity);
      const results = [];

      // Rate Limit 방지: 배치 사이즈 증가 (addRows 사용 시 단일 요청이므로 더 많이 가능)
      const CONCURRENCY_LIMIT = 50;
      const DELAY_MS = 1000; // 배치 간 딜레이 (1초)

      for (let i = 0; i < dataArray.length; i += CONCURRENCY_LIMIT) {
        const chunk = dataArray.slice(i, i + CONCURRENCY_LIMIT);

        // addRows를 사용하여 단일 요청으로 처리 (Quota 절약)
        let chunkRows;
        if (sheet.addRows) {
          chunkRows = await sheet.addRows(chunk);
        } else {
          // Fallback for older versions
          const chunkPromises = chunk.map(data => sheet.addRow(data));
          chunkRows = await Promise.all(chunkPromises);
        }

        if (chunkRows) {
          chunkRows.forEach(row => results.push(this._rowToObject(row)));
        }

        // 진행 상황 로깅 (대량 데이터일 경우)
        if (dataArray.length > 20) {
          if (process.env.NODE_ENV === 'development') {
            process.stdout.write(`+${chunk.length} `);
          }
        }

        // 마지막 청크가 아니면 딜레이
        if (i + CONCURRENCY_LIMIT < dataArray.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      if (dataArray.length > 20 && process.env.NODE_ENV === 'development') {
        console.log(' Done.');
      }

      // 캐시 무효화
      cacheManager.deletePattern(`GS:${entity}`);

      return results;
    } catch (error) {
      console.error(`[GoogleSheetsImplementation] Batch create failed for ${entity}:`, error);
      throw error;
    }
  }
  // 트랜잭션은 Google Sheets에서 지원하지 않음
  // transaction() 메서드는 구현하지 않음
}

module.exports = GoogleSheetsImplementation;
