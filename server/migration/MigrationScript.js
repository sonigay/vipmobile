/**
 * Migration Script
 * 
 * Google Sheets 데이터를 Supabase로 마이그레이션합니다.
 * 
 * Requirements: 4.1, 4.3, 4.4, 4.5
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { supabase } = require('../supabaseClient');
const DataValidator = require('./DataValidator');

class MigrationScript {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.batchSize = options.batchSize || 100;
    this.validator = new DataValidator();
    
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Google Sheets 인증 정보
    this.credentials = {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    };
    
    this.sheetId = process.env.SHEET_ID;
  }

  /**
   * Google Sheets 문서 초기화
   */
  async initializeSheet() {
    if (!this.sheetId || !this.credentials.client_email || !this.credentials.private_key) {
      throw new Error('Google Sheets credentials not configured');
    }

    const doc = new GoogleSpreadsheet(this.sheetId);
    await doc.useServiceAccountAuth(this.credentials);
    await doc.loadInfo();
    
    return doc;
  }

  /**
   * 단일 시트 마이그레이션
   * @param {string} sheetName - Google Sheets 시트 이름
   * @param {string} tableName - Supabase 테이블 이름
   * @param {Function} transformFn - 데이터 변환 함수 (선택적)
   */
  async migrateSheet(sheetName, tableName, transformFn = null) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 마이그레이션: ${sheetName} → ${tableName}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`모드: ${this.dryRun ? 'DRY RUN (실제 저장 안 함)' : 'LIVE (실제 저장)'}`);

    // 통계 초기화
    this.resetStats();

    try {
      // 1. Google Sheets에서 데이터 읽기
      console.log('\n[1/5] Google Sheets 데이터 읽기...');
      const doc = await this.initializeSheet();
      const sheet = doc.sheetsByTitle[sheetName];
      
      if (!sheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }

      const rows = await sheet.getRows();
      this.stats.total = rows.length;
      
      console.log(`   ✅ ${rows.length}개 행 읽기 완료`);

      if (rows.length === 0) {
        console.log('   ⚠️  데이터가 없습니다. 마이그레이션 건너뜀.');
        return this.stats;
      }

      // 2. 데이터 변환 및 검증
      console.log('\n[2/5] 데이터 변환 및 검증...');
      const processedData = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let data = row.toObject();

        try {
          // 데이터 변환 (사용자 정의 함수)
          if (transformFn) {
            data = transformFn(data, i + 1);
          }

          // 데이터 타입 변환 (Validator)
          data = this.validator.transform(tableName, data);

          // 데이터 검증
          const validation = this.validator.validate(tableName, data, i + 1);
          
          if (!validation.valid) {
            this.stats.failed++;
            this.stats.errors.push({
              row: i + 1,
              data: row.toObject(),
              errors: validation.errors
            });
            console.log(`   ❌ Row ${i + 1}: 검증 실패`);
            continue;
          }

          processedData.push(data);

        } catch (error) {
          this.stats.failed++;
          this.stats.errors.push({
            row: i + 1,
            data: row.toObject(),
            error: error.message
          });
          console.log(`   ❌ Row ${i + 1}: ${error.message}`);
        }
      }

      console.log(`   ✅ ${processedData.length}개 행 검증 완료`);
      console.log(`   ❌ ${this.stats.failed}개 행 검증 실패`);

      if (processedData.length === 0) {
        console.log('\n⚠️  유효한 데이터가 없습니다. 마이그레이션 중단.');
        return this.stats;
      }

      // 3. Dry-run 모드 확인
      if (this.dryRun) {
        console.log('\n[3/5] DRY RUN 모드 - 실제 저장 건너뜀');
        console.log(`   📋 ${processedData.length}개 행이 저장될 예정입니다.`);
        this.stats.skipped = processedData.length;
        this.printStats();
        return this.stats;
      }

      // 4. Supabase에 배치 삽입
      console.log('\n[3/5] Supabase에 데이터 삽입...');
      await this.batchInsert(tableName, processedData);

      // 5. 결과 출력
      console.log('\n[4/5] 마이그레이션 완료');
      this.printStats();

      return this.stats;

    } catch (error) {
      console.error('\n❌ 마이그레이션 실패:', error.message);
      throw error;
    }
  }

  /**
   * 배치 삽입
   */
  async batchInsert(tableName, dataArray) {
    const totalBatches = Math.ceil(dataArray.length / this.batchSize);
    
    for (let i = 0; i < dataArray.length; i += this.batchSize) {
      const batch = dataArray.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      
      console.log(`   배치 ${batchNumber}/${totalBatches} (${batch.length}개 행)...`);

      try {
        const { data, error } = await supabase
          .from(tableName)
          .insert(batch)
          .select();

        if (error) {
          // 배치 전체 실패 시 개별 삽입 시도
          console.log(`   ⚠️  배치 삽입 실패, 개별 삽입 시도...`);
          await this.insertIndividually(tableName, batch);
        } else {
          this.stats.success += batch.length;
          console.log(`   ✅ ${batch.length}개 행 삽입 완료`);
        }

      } catch (error) {
        console.error(`   ❌ 배치 ${batchNumber} 실패:`, error.message);
        // 개별 삽입 시도
        await this.insertIndividually(tableName, batch);
      }

      // API 제한 방지를 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * 개별 삽입 (배치 실패 시)
   */
  async insertIndividually(tableName, dataArray) {
    for (let i = 0; i < dataArray.length; i++) {
      const data = dataArray[i];
      
      try {
        const { error } = await supabase
          .from(tableName)
          .insert(data);

        if (error) {
          this.stats.failed++;
          this.stats.errors.push({
            data,
            error: error.message
          });
          console.log(`      ❌ 행 ${i + 1}: ${error.message}`);
        } else {
          this.stats.success++;
        }

      } catch (error) {
        this.stats.failed++;
        this.stats.errors.push({
          data,
          error: error.message
        });
        console.log(`      ❌ 행 ${i + 1}: ${error.message}`);
      }

      // API 제한 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 여러 시트 마이그레이션
   */
  async migrateAll(migrations) {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 일괄 마이그레이션 시작');
    console.log('='.repeat(70));
    console.log(`총 ${migrations.length}개 시트 마이그레이션 예정\n`);

    const results = {};
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < migrations.length; i++) {
      const { sheetName, tableName, transformFn } = migrations[i];
      
      console.log(`\n[${i + 1}/${migrations.length}] ${sheetName}`);

      try {
        const stats = await this.migrateSheet(sheetName, tableName, transformFn);
        results[tableName] = stats;
        totalSuccess += stats.success;
        totalFailed += stats.failed;

      } catch (error) {
        results[tableName] = {
          error: error.message,
          stats: this.stats
        };
        totalFailed += this.stats.total;
      }

      // 시트 간 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 전체 결과 요약
    console.log('\n' + '='.repeat(70));
    console.log('📊 전체 마이그레이션 결과');
    console.log('='.repeat(70));
    
    Object.entries(results).forEach(([tableName, result]) => {
      if (result.error) {
        console.log(`❌ ${tableName}: ERROR - ${result.error}`);
      } else {
        console.log(`✅ ${tableName}: ${result.success}/${result.total} 성공`);
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log(`총 성공: ${totalSuccess}`);
    console.log(`총 실패: ${totalFailed}`);
    console.log('='.repeat(70));

    return results;
  }

  /**
   * 통계 초기화
   */
  resetStats() {
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
  }

  /**
   * 통계 출력
   */
  printStats() {
    console.log('\n📊 마이그레이션 통계:');
    console.log(`   총 행 수: ${this.stats.total}`);
    console.log(`   성공: ${this.stats.success}`);
    console.log(`   실패: ${this.stats.failed}`);
    console.log(`   건너뜀: ${this.stats.skipped}`);

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ 에러 목록 (최대 10개):`);
      this.stats.errors.slice(0, 10).forEach((error, idx) => {
        console.log(`   ${idx + 1}. Row ${error.row || '?'}:`);
        if (error.errors) {
          error.errors.forEach(err => console.log(`      - ${err}`));
        } else if (error.error) {
          console.log(`      - ${error.error}`);
        }
      });

      if (this.stats.errors.length > 10) {
        console.log(`   ... 그 외 ${this.stats.errors.length - 10}개`);
      }
    }
  }

  /**
   * 에러 로그 저장
   */
  async saveErrorLog(filename = 'migration-errors.json') {
    if (this.stats.errors.length === 0) {
      return;
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    const logPath = path.join(__dirname, '../logs', filename);
    
    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.writeFile(
        logPath,
        JSON.stringify(this.stats.errors, null, 2),
        'utf8'
      );
      console.log(`\n💾 에러 로그 저장: ${logPath}`);
    } catch (error) {
      console.error('에러 로그 저장 실패:', error.message);
    }
  }
}

module.exports = MigrationScript;
