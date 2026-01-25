/**
 * BackupScript - Supabase 데이터베이스 백업 스크립트
 * 
 * 기능:
 * - 전체 데이터베이스 백업
 * - 특정 테이블 백업
 * - 백업 파일 압축 및 저장
 * - 백업 이력 관리
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabase } = require('../supabaseClient');
const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');
const archiver = require('archiver');

class BackupScript {
  constructor(options = {}) {
    this.backupDir = options.backupDir || path.join(__dirname, '../backups');
    this.compress = options.compress !== false; // 기본값: true
    this.maxBackups = options.maxBackups || 30; // 최대 30개 백업 유지
    
    this.stats = {
      startTime: null,
      endTime: null,
      tablesBackedUp: 0,
      totalRows: 0,
      backupSize: 0,
      errors: []
    };
  }

  /**
   * 백업 디렉토리 생성
   */
  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`✅ 백업 디렉토리 준비: ${this.backupDir}`);
    } catch (error) {
      console.error('❌ 백업 디렉토리 생성 실패:', error.message);
      throw error;
    }
  }

  /**
   * 테이블 목록 조회
   */
  async getTableList() {
    const tables = [
      // 직영점 모드
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
      'direct_store_sales_daily',
      // 정책 모드
      'policy_table_settings',
      'policy_table_list',
      'policy_user_groups',
      'policy_tab_order',
      'policy_group_change_history',
      'policy_default_groups',
      'policy_other_types',
      'budget_channel_settings',
      'budget_basic_settings',
      'budget_basic_data_settings',
      // 고객 모드
      'customer_info',
      'purchase_queue',
      'board',
      'direct_store_pre_approval_marks',
      'reservation_all_customers',
      'reservation_customers',
      'unmatched_customers'
    ];
    
    return tables;
  }

  /**
   * 단일 테이블 백업
   */
  async backupTable(tableName) {
    try {
      console.log(`  📦 백업 중: ${tableName}`);
      
      // 전체 데이터 조회
      const { data, error } = await supabase
        .from(tableName)
        .select('*');
      
      if (error) {
        throw new Error(`테이블 조회 실패: ${error.message}`);
      }
      
      const rowCount = data ? data.length : 0;
      console.log(`     ✅ ${rowCount}행 백업 완료`);
      
      this.stats.totalRows += rowCount;
      
      return {
        tableName,
        rowCount,
        data: data || []
      };
      
    } catch (error) {
      console.error(`     ❌ 백업 실패: ${error.message}`);
      this.stats.errors.push({ tableName, error: error.message });
      return {
        tableName,
        rowCount: 0,
        data: [],
        error: error.message
      };
    }
  }

  /**
   * 전체 데이터베이스 백업
   */
  async backupAll(tables = null) {
    this.stats.startTime = new Date();
    
    console.log('='.repeat(70));
    console.log('Supabase 데이터베이스 백업 시작');
    console.log('='.repeat(70));
    console.log();
    
    // 백업 디렉토리 생성
    await this.ensureBackupDir();
    
    // 테이블 목록
    const tablesToBackup = tables || await this.getTableList();
    console.log(`📋 백업 대상: ${tablesToBackup.length}개 테이블\n`);
    
    // 각 테이블 백업
    const backupData = {};
    for (const tableName of tablesToBackup) {
      const result = await this.backupTable(tableName);
      backupData[tableName] = result;
      this.stats.tablesBackedUp++;
      
      // API 제한 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 백업 파일 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.json`;
    const backupFilePath = path.join(this.backupDir, backupFileName);
    
    const backupContent = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: tablesToBackup.length,
        totalRows: this.stats.totalRows
      },
      data: backupData
    };
    
    await fs.writeFile(
      backupFilePath,
      JSON.stringify(backupContent, null, 2),
      'utf8'
    );
    
    const fileStats = await fs.stat(backupFilePath);
    this.stats.backupSize = fileStats.size;
    
    console.log(`\n💾 백업 파일 저장: ${backupFileName}`);
    console.log(`   크기: ${(this.stats.backupSize / 1024 / 1024).toFixed(2)} MB`);
    
    // 압축
    if (this.compress) {
      await this.compressBackup(backupFilePath);
    }
    
    // 오래된 백업 정리
    await this.cleanOldBackups();
    
    this.stats.endTime = new Date();
    
    // 결과 출력
    this.printStats();
    
    return {
      success: this.stats.errors.length === 0,
      backupFile: backupFilePath,
      stats: this.stats
    };
  }

  /**
   * 백업 파일 압축
   */
  async compressBackup(backupFilePath) {
    return new Promise((resolve, reject) => {
      const zipFilePath = backupFilePath.replace('.json', '.zip');
      const output = createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', async () => {
        const zipStats = await fs.stat(zipFilePath);
        const compressionRatio = ((1 - zipStats.size / this.stats.backupSize) * 100).toFixed(1);
        
        console.log(`\n🗜️  압축 완료: ${path.basename(zipFilePath)}`);
        console.log(`   압축 크기: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   압축률: ${compressionRatio}%`);
        
        // 원본 JSON 파일 삭제
        await fs.unlink(backupFilePath);
        
        resolve(zipFilePath);
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      archive.file(backupFilePath, { name: path.basename(backupFilePath) });
      archive.finalize();
    });
  }

  /**
   * 오래된 백업 파일 정리
   */
  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && (f.endsWith('.json') || f.endsWith('.zip')))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.stat(path.join(this.backupDir, f)).then(s => s.mtime)
        }));
      
      // 시간순 정렬
      const sortedFiles = await Promise.all(
        backupFiles.map(async f => ({
          ...f,
          time: await f.time
        }))
      );
      
      sortedFiles.sort((a, b) => b.time - a.time);
      
      // 최대 개수 초과 시 삭제
      if (sortedFiles.length > this.maxBackups) {
        const filesToDelete = sortedFiles.slice(this.maxBackups);
        
        console.log(`\n🗑️  오래된 백업 ${filesToDelete.length}개 삭제 중...`);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          console.log(`   삭제: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('❌ 백업 정리 실패:', error.message);
    }
  }

  /**
   * 통계 출력
   */
  printStats() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(70));
    console.log('백업 완료');
    console.log('='.repeat(70));
    console.log(`✅ 백업된 테이블: ${this.stats.tablesBackedUp}개`);
    console.log(`✅ 총 행 수: ${this.stats.totalRows.toLocaleString()}행`);
    console.log(`⏱️  소요 시간: ${duration.toFixed(1)}초`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  에러 발생: ${this.stats.errors.length}개`);
      this.stats.errors.forEach(({ tableName, error }) => {
        console.log(`   - ${tableName}: ${error}`);
      });
    }
    
    console.log('='.repeat(70));
  }

  /**
   * 백업 목록 조회
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && (f.endsWith('.json') || f.endsWith('.zip')));
      
      console.log('\n📋 백업 파일 목록:');
      console.log('='.repeat(70));
      
      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        const size = (stats.size / 1024 / 1024).toFixed(2);
        const date = stats.mtime.toLocaleString('ko-KR');
        
        console.log(`  ${file}`);
        console.log(`    크기: ${size} MB | 생성일: ${date}`);
      }
      
      console.log('='.repeat(70));
      console.log(`총 ${backupFiles.length}개 백업 파일\n`);
      
      return backupFiles;
    } catch (error) {
      console.error('❌ 백업 목록 조회 실패:', error.message);
      return [];
    }
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'backup';
  
  const backup = new BackupScript();
  
  if (command === 'list') {
    await backup.listBackups();
  } else if (command === 'backup') {
    await backup.backupAll();
  } else {
    console.log('사용법:');
    console.log('  node BackupScript.js backup  # 전체 백업');
    console.log('  node BackupScript.js list    # 백업 목록');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BackupScript;
