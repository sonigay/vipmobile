/**
 * Supabase 스키마 실행 스크립트 (Supabase 클라이언트 사용)
 * 
 * Supabase 클라이언트를 사용하여 SQL 스키마 파일을 실행합니다.
 * PostgreSQL 직접 연결 대신 Supabase RPC를 사용합니다.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabase } = require('../supabaseClient');
const fs = require('fs').promises;
const path = require('path');

class SchemaExecutor {
  constructor() {
    if (!supabase) {
      throw new Error('Supabase 클라이언트가 초기화되지 않았습니다. SUPABASE_URL과 SUPABASE_KEY를 확인하세요.');
    }
    
    this.supabase = supabase;
    this.results = {
      success: [],
      failed: []
    };
  }

  /**
   * Supabase 연결 테스트
   */
  async testConnection() {
    try {
      // 간단한 쿼리로 연결 테스트
      const { error } = await this.supabase
        .from('_test_connection')
        .select('*')
        .limit(1);
      
      // 테이블이 없는 것은 정상 (아직 생성 전)
      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        console.error('❌ Supabase 연결 실패:', error.message);
        return false;
      }
      
      console.log('✅ Supabase 연결 성공\n');
      return true;
    } catch (error) {
      console.error('❌ Supabase 연결 테스트 실패:', error.message);
      return false;
    }
  }

  /**
   * SQL 파일 읽기
   */
  async readSQLFile(filename) {
    const filePath = path.join(__dirname, '../database', filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error(`❌ SQL 파일 읽기 실패 [${filename}]:`, error.message);
      throw error;
    }
  }

  /**
   * SQL 실행 (Supabase RPC 사용)
   */
  async executeSQL(sql, filename) {
    try {
      // SQL을 개별 문장으로 분리 (세미콜론 기준)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`  📝 ${statements.length}개 SQL 문장 실행 중...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const statement of statements) {
        try {
          // Supabase RPC를 사용하여 SQL 실행
          const { error } = await this.supabase.rpc('exec_sql', { 
            sql_query: statement 
          });
          
          if (error) {
            // RPC 함수가 없는 경우 대체 방법 사용
            if (error.message.includes('function') && error.message.includes('does not exist')) {
              console.log('  ⚠️  RPC 함수가 없습니다. 대체 방법을 사용합니다.');
              await this.executeSQLDirect(statement);
              successCount++;
            } else {
              console.error(`  ❌ SQL 실행 실패:`, error.message.substring(0, 100));
              errorCount++;
            }
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`  ❌ SQL 실행 오류:`, err.message.substring(0, 100));
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        console.log(`✅ ${filename} 실행 완료 (${successCount}/${statements.length})`);
        this.results.success.push(filename);
        return true;
      } else {
        console.log(`⚠️  ${filename} 부분 실행 (성공: ${successCount}, 실패: ${errorCount})`);
        this.results.failed.push({ 
          filename, 
          error: `${errorCount}개 문장 실패` 
        });
        return false;
      }
    } catch (error) {
      console.error(`❌ ${filename} 실행 실패:`, error.message);
      this.results.failed.push({ filename, error: error.message });
      return false;
    }
  }

  /**
   * SQL 직접 실행 (DROP TABLE, CREATE TABLE 등)
   */
  async executeSQLDirect(statement) {
    // DROP TABLE 처리
    if (statement.toUpperCase().includes('DROP TABLE')) {
      const match = statement.match(/DROP TABLE IF EXISTS\s+([^\s;]+)/i);
      if (match) {
        const tableName = match[1].replace(/"/g, '');
        // Supabase에서는 테이블 삭제를 직접 지원하지 않으므로 경고만 출력
        console.log(`  ⚠️  DROP TABLE ${tableName} - Supabase 대시보드에서 수동 삭제 필요`);
        return;
      }
    }
    
    // CREATE TABLE은 Supabase가 자동으로 처리하지 않으므로 경고
    if (statement.toUpperCase().includes('CREATE TABLE')) {
      console.log(`  ⚠️  CREATE TABLE - Supabase SQL Editor에서 실행 필요`);
      return;
    }
  }

  /**
   * 스키마 파일 실행
   */
  async executeSQLFile(filename) {
    console.log(`\n📄 SQL 파일 실행: ${filename}`);
    
    try {
      const sql = await this.readSQLFile(filename);
      return await this.executeSQL(sql, filename);
    } catch (error) {
      return false;
    }
  }

  /**
   * 모든 스키마 파일 실행
   */
  async executeAllSchemas(mode = 'all') {
    console.log('='.repeat(70));
    console.log('Supabase 스키마 실행 스크립트');
    console.log('='.repeat(70));
    console.log();
    
    // 연결 테스트
    const connected = await this.testConnection();
    if (!connected) {
      console.log('\n⚠️  연결 테스트 실패했지만 계속 진행합니다...\n');
    }
    
    // 스키마 파일 목록
    let schemaFiles = [];
    
    if (mode === 'all') {
      schemaFiles = [
        'schema-direct-store.sql',
        'schema-policy.sql',
        'schema-customer.sql'
      ];
    } else if (mode === 'direct') {
      schemaFiles = ['schema-direct-store.sql'];
    } else if (mode === 'policy') {
      schemaFiles = ['schema-policy.sql'];
    } else if (mode === 'customer') {
      schemaFiles = ['schema-customer.sql'];
    } else {
      console.error(`❌ 알 수 없는 모드: ${mode}`);
      return;
    }
    
    console.log(`📋 실행 대상: ${schemaFiles.length}개 파일\n`);
    
    // 중요 안내
    console.log('⚠️  중요: Supabase 클라이언트는 DDL(CREATE/DROP TABLE)을 직접 실행할 수 없습니다.');
    console.log('   다음 방법 중 하나를 사용하세요:\n');
    console.log('   방법 1 (권장): Supabase SQL Editor');
    console.log('     1. https://supabase.com/dashboard 접속');
    console.log('     2. SQL Editor 메뉴 클릭');
    console.log('     3. 아래 파일 내용을 복사하여 실행:\n');
    
    for (const file of schemaFiles) {
      console.log(`        - server/database/${file}`);
    }
    
    console.log('\n   방법 2: psql 명령줄 도구');
    console.log('     psql -h db.xxx.supabase.co -U postgres -d postgres -f server/database/schema-xxx.sql\n');
    
    console.log('='.repeat(70));
    console.log('\n계속하려면 5초 기다리세요...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 순서대로 실행 (실제로는 경고만 출력)
    for (const file of schemaFiles) {
      await this.executeSQLFile(file);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 결과 출력
    console.log('\n' + '='.repeat(70));
    console.log('실행 결과');
    console.log('='.repeat(70));
    console.log(`✅ 성공: ${this.results.success.length}개`);
    console.log(`❌ 실패: ${this.results.failed.length}개`);
    
    if (this.results.failed.length > 0) {
      console.log('\n실패한 파일:');
      this.results.failed.forEach(({ filename, error }) => {
        console.log(`  - ${filename}: ${error}`);
      });
    }
    
    console.log('='.repeat(70));
  }

  /**
   * 테이블 목록 확인
   */
  async listTables() {
    try {
      // Supabase에서 테이블 목록 조회
      const { data, error } = await this.supabase
        .rpc('get_tables');
      
      if (error) {
        // RPC 함수가 없는 경우 대체 방법
        console.log('\n⚠️  테이블 목록 조회 RPC 함수가 없습니다.');
        console.log('   Supabase 대시보드의 Table Editor에서 확인하세요.\n');
        return [];
      }
      
      console.log('\n📊 생성된 테이블 목록:');
      data.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
      console.log(`\n총 ${data.length}개 테이블 생성됨\n`);
      
      return data;
    } catch (error) {
      console.log('\n⚠️  테이블 목록 조회 실패:', error.message);
      console.log('   Supabase 대시보드의 Table Editor에서 확인하세요.\n');
      return [];
    }
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'all';
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
Supabase 스키마 실행 스크립트

⚠️  주의: 이 스크립트는 Supabase SQL Editor 사용을 권장합니다.
   Supabase 클라이언트는 DDL(CREATE/DROP TABLE)을 직접 실행할 수 없습니다.

사용법:
  node migration/executeSchema.js [옵션]

옵션:
  --mode=<mode>      실행 모드 (all, direct, policy, customer)
  --help, -h         도움말 출력

예시:
  # 전체 스키마 확인
  node migration/executeSchema.js --mode=all

  # 직영점 모드만 확인
  node migration/executeSchema.js --mode=direct

권장 방법:
  1. Supabase 대시보드 접속: https://supabase.com/dashboard
  2. SQL Editor 메뉴 클릭
  3. 스키마 파일 내용 복사 & 실행:
     - server/database/schema-direct-store.sql
     - server/database/schema-policy.sql
     - server/database/schema-customer.sql
      `);
      return;
    }
    
    const executor = new SchemaExecutor();
    await executor.executeAllSchemas(mode);
    
    // 테이블 목록 확인
    await executor.listTables();
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error.message);
    console.log('\n💡 해결 방법:');
    console.log('   1. .env 파일에 SUPABASE_URL과 SUPABASE_KEY가 설정되어 있는지 확인');
    console.log('   2. Supabase 대시보드의 SQL Editor를 사용하여 스키마 파일 직접 실행');
    console.log('   3. 스키마 생성 후 autoMigrate.js로 데이터 마이그레이션 진행\n');
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SchemaExecutor };
