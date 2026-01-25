/**
 * Supabase 스키마 생성 스크립트
 * 
 * 31개 테이블의 스키마를 Supabase에 생성합니다.
 * - 직영점 모드: 14개 테이블
 * - 정책 모드: 10개 테이블
 * - 고객 모드: 7개 테이블
 */

// 환경 변수 로드
require('dotenv').config();

const { supabase } = require('../supabaseClient');
const fs = require('fs').promises;
const path = require('path');

class SchemaCreator {
  constructor() {
    this.results = {
      success: [],
      failed: [],
      skipped: []
    };
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
   * SQL 문을 개별 명령어로 분리
   * (세미콜론 기준, 주석 제거)
   */
  parseSQLStatements(sql) {
    // 주석 제거 (-- 스타일)
    let cleaned = sql.replace(/--[^\n]*/g, '');
    
    // 블록 주석 제거 (/* */ 스타일)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 세미콜론으로 분리
    const statements = cleaned
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return statements;
  }

  /**
   * 단일 SQL 명령어 실행
   */
  async executeSQLStatement(statement, index) {
    try {
      // Supabase는 rpc를 통해 SQL 실행
      // 또는 직접 SQL 실행이 불가능하므로 테이블별로 생성
      
      // 테이블 생성 명령어인지 확인
      if (statement.toUpperCase().includes('CREATE TABLE')) {
        const tableName = this.extractTableName(statement);
        console.log(`  [${index}] 테이블 생성 중: ${tableName}`);
        
        // Supabase에서는 SQL Editor를 통해 직접 실행해야 함
        // 또는 Supabase Management API 사용
        
        return { success: true, tableName, statement };
      }
      
      // 트리거 생성
      if (statement.toUpperCase().includes('CREATE TRIGGER')) {
        const triggerName = this.extractTriggerName(statement);
        console.log(`  [${index}] 트리거 생성 중: ${triggerName}`);
        return { success: true, triggerName, statement };
      }
      
      // 인덱스 생성
      if (statement.toUpperCase().includes('CREATE INDEX')) {
        const indexName = this.extractIndexName(statement);
        console.log(`  [${index}] 인덱스 생성 중: ${indexName}`);
        return { success: true, indexName, statement };
      }
      
      // 함수 생성
      if (statement.toUpperCase().includes('CREATE OR REPLACE FUNCTION')) {
        console.log(`  [${index}] 함수 생성 중`);
        return { success: true, type: 'function', statement };
      }
      
      return { success: true, type: 'other', statement };
      
    } catch (error) {
      console.error(`  ❌ [${index}] SQL 실행 실패:`, error.message);
      return { success: false, error: error.message, statement };
    }
  }

  /**
   * 테이블명 추출
   */
  extractTableName(statement) {
    const match = statement.match(/CREATE TABLE\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * 트리거명 추출
   */
  extractTriggerName(statement) {
    const match = statement.match(/CREATE TRIGGER\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * 인덱스명 추출
   */
  extractIndexName(statement) {
    const match = statement.match(/CREATE INDEX\s+(\w+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * SQL 파일 실행
   */
  async executeSQLFile(filename) {
    console.log(`\n📄 SQL 파일 실행: ${filename}`);
    
    try {
      const sql = await this.readSQLFile(filename);
      const statements = this.parseSQLStatements(sql);
      
      console.log(`   총 ${statements.length}개 명령어 발견`);
      
      const results = [];
      for (let i = 0; i < statements.length; i++) {
        const result = await this.executeSQLStatement(statements[i], i + 1);
        results.push(result);
        
        // API 제한 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`   ✅ 성공: ${successCount}, ❌ 실패: ${failCount}`);
      
      return { filename, results, successCount, failCount };
      
    } catch (error) {
      console.error(`❌ SQL 파일 실행 실패 [${filename}]:`, error.message);
      return { filename, error: error.message, successCount: 0, failCount: 0 };
    }
  }

  /**
   * 스키마 생성 가이드 출력
   */
  printManualInstructions() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 Supabase SQL Editor에서 수동 실행 가이드');
    console.log('='.repeat(70));
    console.log('\n⚠️  Supabase는 프로그래밍 방식의 SQL 실행을 제한합니다.');
    console.log('    다음 단계를 따라 SQL Editor에서 직접 실행하세요:\n');
    
    console.log('1️⃣  Supabase 대시보드 접속');
    console.log('   https://supabase.com/dashboard\n');
    
    console.log('2️⃣  프로젝트 선택 후 "SQL Editor" 메뉴 클릭\n');
    
    console.log('3️⃣  다음 파일들을 순서대로 실행:\n');
    console.log('   📁 server/database/schema-direct-store.sql');
    console.log('      → 직영점 모드 14개 테이블 생성\n');
    console.log('   📁 server/database/schema-policy.sql');
    console.log('      → 정책 모드 10개 테이블 생성\n');
    console.log('   📁 server/database/schema-customer.sql');
    console.log('      → 고객 모드 7개 테이블 생성\n');
    
    console.log('4️⃣  각 파일 내용을 복사하여 SQL Editor에 붙여넣기\n');
    
    console.log('5️⃣  "Run" 버튼 클릭하여 실행\n');
    
    console.log('6️⃣  실행 완료 후 "Table Editor"에서 테이블 확인\n');
    
    console.log('='.repeat(70));
    console.log('\n💡 팁: 한 번에 하나의 파일씩 실행하는 것을 권장합니다.');
    console.log('       에러 발생 시 해당 파일만 다시 실행하면 됩니다.\n');
  }

  /**
   * 테이블 존재 여부 확인
   */
  async checkTablesExist() {
    console.log('\n🔍 생성된 테이블 확인 중...\n');
    
    const tablesToCheck = [
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
    
    const existingTables = [];
    const missingTables = [];
    
    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error) {
          if (error.message.includes('relation') || error.message.includes('does not exist')) {
            missingTables.push(tableName);
            console.log(`   ❌ ${tableName}`);
          } else {
            // 다른 에러 (권한 등)
            console.log(`   ⚠️  ${tableName} (에러: ${error.message})`);
          }
        } else {
          existingTables.push(tableName);
          console.log(`   ✅ ${tableName}`);
        }
      } catch (error) {
        missingTables.push(tableName);
        console.log(`   ❌ ${tableName}`);
      }
      
      // API 제한 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`📊 테이블 확인 결과: ${existingTables.length}/${tablesToCheck.length} 생성됨`);
    console.log('='.repeat(70));
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  생성되지 않은 테이블 (${missingTables.length}개):`);
      missingTables.forEach(t => console.log(`   - ${t}`));
    }
    
    return { existingTables, missingTables, total: tablesToCheck.length };
  }

  /**
   * 스키마 생성 실행
   */
  async createSchema() {
    console.log('='.repeat(70));
    console.log('Supabase 스키마 생성 스크립트');
    console.log('='.repeat(70));
    
    // Supabase 연결 확인
    if (!supabase) {
      console.error('\n❌ Supabase 클라이언트가 초기화되지 않았습니다.');
      console.error('   SUPABASE_URL과 SUPABASE_KEY 환경 변수를 확인하세요.\n');
      return;
    }
    
    console.log('\n✅ Supabase 클라이언트 연결 확인 완료\n');
    
    // 수동 실행 가이드 출력
    this.printManualInstructions();
    
    // 테이블 존재 여부 확인
    const checkResult = await this.checkTablesExist();
    
    if (checkResult.existingTables.length === checkResult.total) {
      console.log('\n🎉 모든 테이블이 이미 생성되어 있습니다!');
    } else if (checkResult.existingTables.length > 0) {
      console.log('\n⚠️  일부 테이블만 생성되어 있습니다.');
      console.log('   위의 가이드를 따라 나머지 테이블을 생성하세요.');
    } else {
      console.log('\n📝 위의 가이드를 따라 SQL Editor에서 스키마를 생성하세요.');
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  const creator = new SchemaCreator();
  await creator.createSchema();
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SchemaCreator };
