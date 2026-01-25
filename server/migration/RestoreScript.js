/**
 * RestoreScript - Supabase 데이터베이스 복원 스크립트
 * 
 * 기능:
 * - 백업 파일에서 데이터 복원
 * - 특정 테이블만 복원
 * - 복원 전 데이터 검증
 * - 복원 이력 관리
 */

require('dotenv').config();
const { supabase } = require('../supabaseClient');
const fs = require('fs').promises;
const path = require('path');
const unzipper = require('unzipper');

class RestoreScript {
  constructor(options = {}) {
    this.backupDir = options.backupDir || path.join(__dirname, '../backups');
    this.batchSize = options.batchSize || 100;
    this.dryRun = options.dryRun || false;
    
    this.stats = {
      startTime: null,
      endTime: null,
      tablesRestored: 0,
      totalRows: 0,
      errors: []
    };
  }

  /**
   * 백업 파일 목록 조회
   */
  async listBackupFiles() {
    try {
      const files = await fs.readdir(this.backupDir);
      return files
        .filter(f => f.startsWith('backup-') && (f.endsWith('.json') || f.endsWith('.zip')))
        .sort()
        .reverse(); // 최신 순
    } catch (error) {
      console.error('❌ 백업 파일 목록 조회 실패:', error.message);
      return [];
    }
  }

  /**
   * 백업 파일 읽기
   */
  async readBackupFile(backupFileName) {
    const backupFilePath = path.join(this.backupDir, backupFileName);
    
    try {
      // ZIP 파일인 경우 압축 해제
      if (backupFileName.endsWith('.zip')) {
        return await this.readZipBackup(backupFilePath);
      }
      
      // JSON 파일 직접 읽기
      const content = await fs.readFile(backupFilePath, 'utf8');
      return JSON.parse(content);
      
    } catch (error) {
      console.error('❌ 백업 파일 읽기 실패:', error.message);
      throw error;
    }
  }

  /**
   * ZIP 백업 파일 읽기
   */
  async readZipBackup(zipFilePath) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      fs.createReadStream(zipFilePath)
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          if (entry.path.endsWith('.json')) {
            entry.on('data', (chunk) => chunks.push(chunk));
            entry.on('end', () => {
              const content = Buffer.concat(chunks).toString('utf8');
              resolve(JSON.parse(content));
            });
          } else {
            entry.autodrain();
          }
        })
        .on('error', reject);
    });
  }

  /**
   * 테이블 데이터 복원
   */
  async restoreTable(tableName, data) {
    if (this.dryRun) {
      console.log(`  [DRY-RUN] ${tableName}: ${data.length}행 복원 예정`);
      return { success: true, rowsRestored: data.length };
    }
    
    try {
      console.log(`  📦 복원 중: ${tableName} (${data.length}행)`);
      
      if (data.length === 0) {
        console.log(`     ⚠️  데이터 없음`);
        return { success: true, rowsRestored: 0 };
      }
      
      // 기존 데이터 삭제 (선택적)
      // await this.clearTable(tableName);
      
      // 배치 삽입
      let rowsRestored = 0;
      for (let i = 0; i < data.length; i += this.batchSize) {
        const batch = data.slice(i, i + this.batchSize);
        
        const { error } = await supabase
          .from(tableName)
          .insert(batch);
        
        if (error) {
          // 개별 삽입 재시도
          console.log(`     ⚠️  배치 삽입 실패, 개별 삽입 시도...`);
          
          for (const row of batch) {
            const { error: rowError } = await supabase
              .from(tableName)
              .insert(row);
            
            if (rowError) {
              console.error(`     ❌ 행 삽입 실패:`, rowError.message);
              this.stats.errors.push({
                tableName,
                row,
                error: rowError.message
              });
            } else {
              rowsRestored++;
            }
          }
        } else {
          rowsRestored += batch.length;
        }
        
        // 진행률 표시
        if (data.length > 100 && (i + this.batchSize) % 500 === 0) {
          const progress = ((i + this.batchSize) / data.length * 100).toFixed(1);
          console.log(`     진행: ${progress}%`);
        }
      }
      
      console.log(`     ✅ ${rowsRestored}행 복원 완료`);
      this.stats.totalRows += rowsRestored;
      
      return { success: true, rowsRestored };
      
    } catch (error) {
      console.error(`     ❌ 복원 실패: ${error.message}`);
      this.stats.errors.push({ tableName, error: error.message });
      return { success: false, rowsRestored: 0, error: error.message };
    }
  }

  /**
   * 테이블 데이터 삭제
   */
  async clearTable(tableName) {
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제
      
      if (error) {
        console.warn(`     ⚠️  테이블 초기화 실패: ${error.message}`);
      } else {
        console.log(`     🗑️  기존 데이터 삭제 완료`);
      }
    } catch (error) {
      console.warn(`     ⚠️  테이블 초기화 중 오류: ${error.message}`);
    }
  }

  /**
   * 전체 데이터베이스 복원
   */
  async restoreAll(backupFileName, options = {}) {
    this.stats.startTime = new Date();
    
    console.log('='.repeat(70));
    console.log('Supabase 데이터베이스 복원 시작');
    console.log('='.repeat(70));
    
    if (this.dryRun) {
      console.log('⚠️  DRY-RUN 모드: 실제 데이터는 변경되지 않습니다.\n');
    }
    
    // 백업 파일 읽기
    console.log(`\n📂 백업 파일 읽기: ${backupFileName}`);
    const backupData = await this.readBackupFile(backupFileName);
    
    console.log(`\n📋 백업 정보:`);
    console.log(`   생성일: ${backupData.metadata.timestamp}`);
    console.log(`   테이블 수: ${backupData.metadata.tables}`);
    console.log(`   총 행 수: ${backupData.metadata.totalRows.toLocaleString()}`);
    console.log();
    
    // 복원할 테이블 필터링
    const tablesToRestore = options.tables || Object.keys(backupData.data);
    console.log(`📦 복원 대상: ${tablesToRestore.length}개 테이블\n`);
    
    // 각 테이블 복원
    for (const tableName of tablesToRestore) {
      const tableData = backupData.data[tableName];
      
      if (!tableData) {
        console.log(`  ⚠️  ${tableName}: 백업 데이터 없음`);
        continue;
      }
      
      if (tableData.error) {
        console.log(`  ⚠️  ${tableName}: 백업 시 에러 발생 (${tableData.error})`);
        continue;
      }
      
      await this.restoreTable(tableName, tableData.data);
      this.stats.tablesRestored++;
      
      // API 제한 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.stats.endTime = new Date();
    
    // 결과 출력
    this.printStats();
    
    return {
      success: this.stats.errors.length === 0,
      stats: this.stats
    };
  }

  /**
   * 특정 테이블만 복원
   */
  async restoreTables(backupFileName, tableNames) {
    return await this.restoreAll(backupFileName, { tables: tableNames });
  }

  /**
   * 통계 출력
   */
  printStats() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    
    console.log('\n' + '='.repeat(70));
    console.log(this.dryRun ? '복원 시뮬레이션 완료' : '복원 완료');
    console.log('='.repeat(70));
    console.log(`✅ 복원된 테이블: ${this.stats.tablesRestored}개`);
    console.log(`✅ 총 행 수: ${this.stats.totalRows.toLocaleString()}행`);
    console.log(`⏱️  소요 시간: ${duration.toFixed(1)}초`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  에러 발생: ${this.stats.errors.length}개`);
      this.stats.errors.slice(0, 10).forEach(({ tableName, error }) => {
        console.log(`   - ${tableName}: ${error}`);
      });
      
      if (this.stats.errors.length > 10) {
        console.log(`   ... 외 ${this.stats.errors.length - 10}개`);
      }
    }
    
    console.log('='.repeat(70));
  }

  /**
   * 최신 백업 파일 찾기
   */
  async getLatestBackup() {
    const files = await this.listBackupFiles();
    return files.length > 0 ? files[0] : null;
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'list') {
    const restore = new RestoreScript();
    const files = await restore.listBackupFiles();
    
    console.log('\n📋 복원 가능한 백업 파일:');
    console.log('='.repeat(70));
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });
    console.log('='.repeat(70));
    console.log(`총 ${files.length}개 백업 파일\n`);
    
  } else if (command === 'restore') {
    const backupFile = args[1];
    const dryRun = args.includes('--dry-run');
    
    if (!backupFile) {
      console.error('❌ 백업 파일명을 지정하세요.');
      console.log('\n사용법:');
      console.log('  node RestoreScript.js restore <backup-file> [--dry-run]');
      console.log('\n예시:');
      console.log('  node RestoreScript.js restore backup-2025-01-26.zip');
      console.log('  node RestoreScript.js restore backup-2025-01-26.zip --dry-run');
      process.exit(1);
    }
    
    const restore = new RestoreScript({ dryRun });
    await restore.restoreAll(backupFile);
    
  } else if (command === 'restore-latest') {
    const dryRun = args.includes('--dry-run');
    const restore = new RestoreScript({ dryRun });
    
    const latestBackup = await restore.getLatestBackup();
    if (!latestBackup) {
      console.error('❌ 백업 파일이 없습니다.');
      process.exit(1);
    }
    
    console.log(`📂 최신 백업 파일: ${latestBackup}\n`);
    await restore.restoreAll(latestBackup);
    
  } else {
    console.log('사용법:');
    console.log('  node RestoreScript.js list                           # 백업 목록');
    console.log('  node RestoreScript.js restore <file> [--dry-run]     # 복원');
    console.log('  node RestoreScript.js restore-latest [--dry-run]     # 최신 백업 복원');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RestoreScript;
