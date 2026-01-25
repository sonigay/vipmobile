/**
 * Supabase 스키마 실행 스크립트 (PostgreSQL 직접 연결)
 * 
 * pg 라이브러리를 사용하여 Supabase PostgreSQL에 직접 연결하고
 * SQL 스키마 파일을 실행합니다.
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class SchemaExecutor {
  constructor() {
    // Supabase URL에서 PostgreSQL 연결 정보 추출
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL과 SUPABASE_KEY 환경 변수가 필요합니다.');
    }
    
    // Supabase URL 파싱: https://xxxxx.supabase.co
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('유효하지 않은 SUPABASE_URL 형식입니다.');
    }
    
    // PostgreSQL 연결 설정
    this.client = new Client({
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: supabaseKey, // service_role key를 비밀번호로 사용
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    this.results = {
      success: [],
      failed: []
    };
  }

  /**
   * 데이터베이스 연결
   */
  async connect() {
    try {
      await this.client.connect();
      console.log('✅ PostgreSQL 연결 성공\n');
      return true;
    } catch (error) {
      console.error('❌ PostgreSQL 연결 실패:', error.message);
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
   * SQL 실행
   */
  async executeSQL(sql, filename) {
    try {
      await this.client.query(sql);
      console.log(`✅ ${filename} 실행 완료`);
      this.results.success.push(filename);
      return true;
    } catch (error) {
      console.error(`❌ ${filename} 실행 실패:`, error.message);
      this.results.failed.push({ filename, error: error.message });
      return false;
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
  async executeAllSchemas() {
    console.log('='.repeat(70));
    console.log('Supabase 스키마 실행 스크립트');
    console.log('='.repeat(70));
    console.log();
    
    // 연결
    const connected = await this.connect();
    if (!connected) {
      return;
    }
    
    // 스키마 파일 목록
    const schemaFiles = [
      'schema-direct-store.sql',
      'schema-policy.sql',
      'schema-customer.sql'
    ];
    
    // 순서대로 실행
    for (const file of schemaFiles) {
      await this.executeSQLFile(file);
      // 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    
    // 연결 종료
    await this.client.end();
  }

  /**
   * 테이블 목록 확인
   */
  async listTables() {
    try {
      const result = await this.client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      
      console.log('\n📊 생성된 테이블 목록:');
      result.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.table_name}`);
      });
      console.log(`\n총 ${result.rows.length}개 테이블 생성됨\n`);
      
      return result.rows;
    } catch (error) {
      console.error('❌ 테이블 목록 조회 실패:', error.message);
      return [];
    }
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    const executor = new SchemaExecutor();
    await executor.executeAllSchemas();
    
    // 테이블 목록 확인
    await executor.connect();
    await executor.listTables();
    await executor.client.end();
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error.message);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SchemaExecutor };
