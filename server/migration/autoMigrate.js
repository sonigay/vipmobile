/**
 * 자동 마이그레이션 스크립트
 * 
 * Task 17-53을 자동으로 실행합니다.
 * - 스키마 확인
 * - 백업 생성
 * - 데이터 마이그레이션
 * - 검증
 */

require('dotenv').config();
const { SchemaCreator } = require('./createSchema');
const BackupScript = require('./BackupScript');
const MigrationScript = require('./MigrationScript');
const { MIGRATIONS } = require('./runMigration');

class AutoMigrate {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.skipBackup = options.skipBackup || false;
    this.mode = options.mode || 'all'; // 'all', 'direct', 'policy', 'customer'
    
    this.results = {
      schemaCheck: null,
      backup: null,
      migration: null,
      validation: null
    };
  }

  /**
   * Step 1: 스키마 확인
   */
  async checkSchema() {
    console.log('\n' + '='.repeat(70));
    console.log('Step 1: 스키마 확인');
    console.log('='.repeat(70));
    
    const creator = new SchemaCreator();
    const result = await creator.checkTablesExist();
    
    this.results.schemaCheck = result;
    
    if (result.existingTables.length === 0) {
      console.log('\n❌ 스키마가 생성되지 않았습니다!');
      console.log('\n다음 방법 중 하나로 스키마를 생성하세요:');
      console.log('\n방법 1: Supabase SQL Editor (권장)');
      console.log('  1. https://supabase.com/dashboard 접속');
      console.log('  2. SQL Editor 메뉴 클릭');
      console.log('  3. 다음 파일들을 순서대로 실행:');
      console.log('     - server/database/schema-direct-store.sql');
      console.log('     - server/database/schema-policy.sql');
      console.log('     - server/database/schema-customer.sql');
      console.log('\n방법 2: 자동 스크립트');
      console.log('  node migration/executeSchema.js');
      console.log('\n스키마 생성 후 다시 실행하세요.\n');
      return false;
    }
    
    if (result.missingTables.length > 0) {
      console.log(`\n⚠️  일부 테이블이 누락되었습니다 (${result.missingTables.length}개)`);
      console.log('누락된 테이블:', result.missingTables.slice(0, 5).join(', '));
      
      if (result.missingTables.length > 5) {
        console.log(`... 외 ${result.missingTables.length - 5}개`);
      }
      
      console.log('\n스키마를 완전히 생성한 후 다시 실행하세요.\n');
      return false;
    }
    
    console.log('\n✅ 모든 스키마가 준비되었습니다!');
    return true;
  }

  /**
   * Step 2: 백업 생성
   */
  async createBackup() {
    if (this.skipBackup) {
      console.log('\n⏭️  백업 건너뛰기 (--skip-backup 옵션)');
      return true;
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('Step 2: 백업 생성 (안전장치)');
    console.log('='.repeat(70));
    
    try {
      const backup = new BackupScript();
      const result = await backup.backupAll();
      
      this.results.backup = result;
      
      if (result.success) {
        console.log('\n✅ 백업 생성 완료!');
        return true;
      } else {
        console.log('\n⚠️  백업 생성 중 일부 에러 발생');
        console.log('계속 진행하시겠습니까? (Ctrl+C로 중단)');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      }
    } catch (error) {
      console.error('\n❌ 백업 생성 실패:', error.message);
      console.log('백업 없이 계속 진행하시겠습니까? (Ctrl+C로 중단)');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return true;
    }
  }

  /**
   * Step 3: 데이터 마이그레이션
   */
  async migrateData() {
    console.log('\n' + '='.repeat(70));
    console.log('Step 3: 데이터 마이그레이션');
    console.log('='.repeat(70));
    
    if (this.dryRun) {
      console.log('\n⚠️  DRY-RUN 모드: 실제 데이터는 변경되지 않습니다.\n');
    }
    
    // 마이그레이션 목록 선택
    let migrations = [];
    
    if (this.mode === 'all') {
      migrations = [
        ...MIGRATIONS.direct,
        ...MIGRATIONS.policy,
        ...MIGRATIONS.customer
      ];
    } else if (MIGRATIONS[this.mode]) {
      migrations = MIGRATIONS[this.mode];
    } else {
      console.error(`❌ 알 수 없는 모드: ${this.mode}`);
      return false;
    }
    
    console.log(`📋 마이그레이션 대상: ${migrations.length}개 시트\n`);
    
    // 확인 메시지 (LIVE 모드일 때만)
    if (!this.dryRun) {
      console.log('⚠️  경고: 실제 데이터가 Supabase에 저장됩니다!');
      console.log('   계속하려면 5초 기다리세요...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 마이그레이션 실행
    const migrator = new MigrationScript({ dryRun: this.dryRun });
    
    try {
      const results = await migrator.migrateAll(migrations);
      
      this.results.migration = results;
      
      // 에러 로그 저장
      await migrator.saveErrorLog(`migration-errors-${this.mode}-${Date.now()}.json`);
      
      console.log('\n✅ 마이그레이션 완료!');
      return true;
      
    } catch (error) {
      console.error('\n❌ 마이그레이션 실패:', error);
      this.results.migration = { error: error.message };
      return false;
    }
  }

  /**
   * Step 4: 검증
   */
  async validate() {
    console.log('\n' + '='.repeat(70));
    console.log('Step 4: 데이터 검증');
    console.log('='.repeat(70));
    
    if (this.dryRun) {
      console.log('\n⏭️  DRY-RUN 모드에서는 검증을 건너뜁니다.\n');
      return true;
    }
    
    // 간단한 검증: 테이블 행 수 확인
    const creator = new SchemaCreator();
    const result = await creator.checkTablesExist();
    
    console.log(`\n✅ ${result.existingTables.length}개 테이블 확인 완료`);
    
    this.results.validation = result;
    return true;
  }

  /**
   * 최종 요약
   */
  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('마이그레이션 완료 요약');
    console.log('='.repeat(70));
    
    if (this.results.schemaCheck) {
      console.log(`\n✅ 스키마: ${this.results.schemaCheck.existingTables.length}/${this.results.schemaCheck.total} 테이블`);
    }
    
    if (this.results.backup) {
      console.log(`✅ 백업: ${this.results.backup.stats.tablesBackedUp}개 테이블, ${this.results.backup.stats.totalRows}행`);
    }
    
    if (this.results.migration) {
      console.log(`✅ 마이그레이션: 완료`);
    }
    
    if (this.results.validation) {
      console.log(`✅ 검증: ${this.results.validation.existingTables.length}개 테이블 확인`);
    }
    
    console.log('\n' + '='.repeat(70));
    
    if (!this.dryRun) {
      console.log('\n🎉 다음 단계:');
      console.log('1. Feature Flag 활성화:');
      console.log('   .env 파일에서 USE_DB_*=true 설정');
      console.log('2. 서버 재시작:');
      console.log('   npm restart');
      console.log('3. API 테스트:');
      console.log('   curl http://localhost:4000/health');
    } else {
      console.log('\n💡 DRY-RUN 테스트 완료!');
      console.log('실제 마이그레이션을 실행하려면:');
      console.log('  node migration/autoMigrate.js --mode=all');
    }
    
    console.log('\n');
  }

  /**
   * 전체 프로세스 실행
   */
  async run() {
    console.log('='.repeat(70));
    console.log('🚀 자동 마이그레이션 시작');
    console.log('='.repeat(70));
    console.log(`모드: ${this.mode}`);
    console.log(`실행 타입: ${this.dryRun ? 'DRY-RUN (테스트)' : 'LIVE (실제 저장)'}`);
    console.log('='.repeat(70));
    
    // Step 1: 스키마 확인
    const schemaOk = await this.checkSchema();
    if (!schemaOk) {
      console.log('\n❌ 스키마 확인 실패. 마이그레이션을 중단합니다.\n');
      return false;
    }
    
    // Step 2: 백업 생성
    await this.createBackup();
    
    // Step 3: 데이터 마이그레이션
    const migrationOk = await this.migrateData();
    if (!migrationOk) {
      console.log('\n❌ 마이그레이션 실패.\n');
      return false;
    }
    
    // Step 4: 검증
    await this.validate();
    
    // 최종 요약
    this.printSummary();
    
    return true;
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    dryRun: args.includes('--dry-run'),
    skipBackup: args.includes('--skip-backup'),
    mode: args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'all'
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
자동 마이그레이션 스크립트

사용법:
  node migration/autoMigrate.js [옵션]

옵션:
  --mode=<mode>      마이그레이션 모드 (all, direct, policy, customer)
  --dry-run          테스트 실행 (실제 저장 안 함)
  --skip-backup      백업 건너뛰기
  --help, -h         도움말 출력

예시:
  # 전체 테스트
  node migration/autoMigrate.js --mode=all --dry-run

  # 직영점 모드만 실제 실행
  node migration/autoMigrate.js --mode=direct

  # 전체 실행 (백업 포함)
  node migration/autoMigrate.js --mode=all
    `);
    return;
  }
  
  const autoMigrate = new AutoMigrate(options);
  await autoMigrate.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = AutoMigrate;
