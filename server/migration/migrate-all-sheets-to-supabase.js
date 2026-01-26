#!/usr/bin/env node
/**
 * 모든 Google Sheets 데이터를 Supabase로 마이그레이션
 * 
 * 사용법:
 *   node server/migration/migrate-all-sheets-to-supabase.js
 * 
 * 옵션:
 *   --dry-run: 실제 마이그레이션 없이 미리보기만
 *   --force: 기존 데이터 덮어쓰기
 *   --only=<category>: 특정 카테고리만 마이그레이션 (policy, direct-store, customer, master)
 * 
 * 예시:
 *   node server/migration/migrate-all-sheets-to-supabase.js --dry-run
 *   node server/migration/migrate-all-sheets-to-supabase.js --only=policy
 *   node server/migration/migrate-all-sheets-to-supabase.js --force
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Sheets 클라이언트 생성
function createSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return google.sheets({ version: 'v4', auth });
}

const sheets = createSheetsClient();
const SPREADSHEET_ID = process.env.SHEET_ID;

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const onlyCategory = args.find(arg => arg.startsWith('--only='))?.split('=')[1];

console.log('🚀 Google Sheets → Supabase 전체 마이그레이션 시작');
console.log('📋 옵션:', { isDryRun, isForce, onlyCategory: onlyCategory || 'all' });
console.log('');

// 마이그레이션 통계
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  categories: {}
};

/**
 * Google Sheets에서 데이터 읽기
 */
async function readSheet(sheetName, range = 'A:Z') {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`
    });
    return response.data.values || [];
  } catch (error) {
    console.error(`❌ 시트 읽기 실패: ${sheetName}`, error.message);
    return null;
  }
}

/**
 * 배열 데이터를 객체로 변환
 */
function rowsToObjects(rows, headers) {
  if (!rows || rows.length < 2) return [];
  
  const dataRows = rows.slice(1); // 헤더 제외
  return dataRows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });
}

/**
 * Supabase 테이블 존재 여부 확인
 */
async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    // 테이블이 존재하면 에러가 없거나 데이터 관련 에러만 발생
    return !error || error.code !== '42P01'; // 42P01 = undefined_table
  } catch (error) {
    return false;
  }
}

/**
 * Supabase에 데이터 삽입 (upsert)
 */
async function upsertToSupabase(tableName, data, uniqueKey) {
  // 테이블 존재 여부 확인
  const tableExists = await checkTableExists(tableName);
  if (!tableExists) {
    console.log(`   ⚠️  테이블 없음: ${tableName} (건너뜀)`);
    return { success: false, skipped: true, error: 'Table does not exist' };
  }

  if (isDryRun) {
    console.log(`   [DRY-RUN] ${data.length}개 행을 ${tableName}에 삽입 예정`);
    return { success: true, count: data.length };
  }

  try {
    const { data: result, error } = await supabase
      .from(tableName)
      .upsert(data, { onConflict: uniqueKey });

    if (error) throw error;
    return { success: true, count: data.length };
  } catch (error) {
    console.error(`   ❌ Supabase 삽입 실패: ${tableName}`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 1. 정책 모드 마이그레이션
 */
async function migratePolicyMode() {
  console.log('📂 [1/4] 정책 모드 마이그레이션 시작...');
  const category = 'policy';
  stats.categories[category] = { total: 0, success: 0, failed: 0 };

  const migrations = [
    {
      sheetName: '정책_기본정보',
      tableName: 'policy_basic_info',
      uniqueKey: '정책ID',
      headers: ['정책ID', '정책명', '정책적용일', '정책적용점', '정책내용', '금액', '정책유형', '무선유선', '하위카테고리', '입력자ID', '입력자명', '입력일시', '승인상태_총괄', '승인상태_정산팀', '승인상태_소속팀', '정책상태', '취소사유', '취소일시', '취소자명', '정산반영상태', '정산반영자명', '정산반영일시', '정산반영자ID', '대상년월', '복수점명', '업체명', '개통유형', '95군이상금액', '95군미만금액', '소속팀']
    },
    {
      sheetName: '정책모드_정책표설정',
      tableName: 'policy_table_settings',
      uniqueKey: '정책표ID',
      headers: ['정책표ID', '정책표이름', '정책표설명', '정책표링크', '정책표공개링크', '디스코드채널ID', '생성자적용권한', '등록일시', '등록자', '정산팀노출제한']
    },
    {
      sheetName: '정책모드_정책표목록',
      tableName: 'policy_table_list',
      uniqueKey: '정책표ID',
      headers: ['정책표ID', '정책표ID_설정', '정책표이름', '정책적용일시', '정책적용내용', '접근권한', '생성자', '생성일시', '디스코드메시지ID', '디스코드스레드ID', '이미지URL', '등록여부', '등록일시', '생성자ID', '확인이력', '엑셀파일URL']
    },
    {
      sheetName: '정책모드_일반사용자그룹',
      tableName: 'policy_user_groups',
      uniqueKey: '그룹ID',
      headers: ['그룹ID', '그룹이름', '일반사용자목록', '등록일시', '등록자', '폰클등록여부']
    },
    {
      sheetName: '정책표목록_탭순서',
      tableName: 'policy_tab_order',
      uniqueKey: '사용자ID',
      headers: ['사용자ID', '탭순서', '생성카드순서', '수정일시', '수정자']
    },
    {
      sheetName: '정책모드_정책영업그룹_변경이력',
      tableName: 'policy_group_change_history',
      uniqueKey: '변경ID',
      headers: ['변경ID', '그룹ID', '그룹이름', '변경타입', '변경항목', '변경전값', '변경후값', '변경일시', '변경자ID', '변경자이름', '폰클적용여부', '폰클적용일시', '폰클적용자', '폰클적용업체명']
    },
    {
      sheetName: '정책모드_기본정책영업그룹',
      tableName: 'policy_default_groups',
      uniqueKey: '사용자ID',
      headers: ['사용자ID', '정책표ID', '기본그룹ID목록', '수정일시', '수정자']
    },
    {
      sheetName: '정책모드_기타정책목록',
      tableName: 'policy_other_types',
      uniqueKey: '정책명',
      headers: ['정책명', '등록일시', '등록자']
    },
    {
      sheetName: '예산모드_예산채널설정',
      tableName: 'budget_channel_settings',
      uniqueKey: '예산채널ID',
      headers: ['예산채널ID', '예산채널이름', '예산채널설명', '예산채널링크', '년월', '확인자적용권한', '등록일시', '등록자']
    },
    {
      sheetName: '예산모드_기본예산설정',
      tableName: 'budget_basic_settings',
      uniqueKey: '기본예산ID',
      headers: ['기본예산ID', '기본예산이름', '기본예산설명', '기본예산링크', '년월', '확인자적용권한', '등록일시', '등록자']
    },
    {
      sheetName: '예산모드_기본데이터설정',
      tableName: 'budget_basic_data_settings',
      uniqueKey: '기본데이터ID',
      headers: ['기본데이터ID', '기본데이터이름', '기본데이터설명', '기본데이터링크', '년월', '확인자적용권한', '등록일시', '등록자']
    }
  ];

  for (const migration of migrations) {
    stats.total++;
    stats.categories[category].total++;
    
    console.log(`\n   📄 ${migration.sheetName} → ${migration.tableName}`);
    
    const rows = await readSheet(migration.sheetName);
    if (!rows) {
      stats.failed++;
      stats.categories[category].failed++;
      continue;
    }

    const data = rowsToObjects(rows, migration.headers);
    console.log(`   📊 ${data.length}개 행 발견`);

    if (data.length === 0) {
      console.log(`   ⏭️  데이터 없음, 건너뜀`);
      stats.skipped++;
      continue;
    }

    const result = await upsertToSupabase(migration.tableName, data, migration.uniqueKey);
    if (result.skipped) {
      stats.skipped++;
      continue;
    }
    if (result.success) {
      console.log(`   ✅ ${result.count}개 행 마이그레이션 완료`);
      stats.success++;
      stats.categories[category].success++;
    } else {
      stats.failed++;
      stats.categories[category].failed++;
    }
  }
}

/**
 * 2. 직영점 모드 마이그레이션
 */
async function migrateDirectStoreMode() {
  console.log('\n📂 [2/4] 직영점 모드 마이그레이션 시작...');
  const category = 'direct-store';
  stats.categories[category] = { total: 0, success: 0, failed: 0 };

  const carriers = ['KT', 'LG', 'SK'];
  
  for (const carrier of carriers) {
    console.log(`\n   🏢 ${carrier} 직영점 데이터 마이그레이션...`);
    
    const migrations = [
      {
        sheetName: `${carrier}_직영점_요금제마스터`,
        tableName: 'direct_store_plan_master',
        uniqueKey: 'plan_id',
        transform: (data) => data.map(row => ({ ...row, carrier }))
      },
      {
        sheetName: `${carrier}_직영점_단말마스터`,
        tableName: 'direct_store_device_master',
        uniqueKey: 'model_id',
        transform: (data) => data.map(row => ({ ...row, carrier }))
      },
      {
        sheetName: `${carrier}_직영점_단말요금정책`,
        tableName: 'direct_store_device_pricing_policy',
        uniqueKey: 'id',
        transform: (data) => data.map(row => ({ ...row, carrier }))
      },
      {
        sheetName: `${carrier}_직영점_모델이미지`,
        tableName: 'direct_store_model_images',
        uniqueKey: 'id',
        transform: (data) => data.map(row => ({ ...row, carrier }))
      },
      {
        sheetName: `${carrier}_직영점_오늘의휴대폰`,
        tableName: 'direct_store_todays_mobiles',
        uniqueKey: 'id',
        transform: (data) => data.map(row => ({ ...row, carrier }))
      },
      {
        sheetName: `${carrier}_직영점_메인페이지문구`,
        tableName: 'direct_store_main_page_texts',
        uniqueKey: 'id',
        transform: (data) => data.map(row => ({ ...row, carrier }))
      }
    ];

    for (const migration of migrations) {
      stats.total++;
      stats.categories[category].total++;
      
      console.log(`      📄 ${migration.sheetName} → ${migration.tableName}`);
      
      const rows = await readSheet(migration.sheetName);
      if (!rows || rows.length < 2) {
        console.log(`      ⏭️  데이터 없음, 건너뜀`);
        stats.skipped++;
        continue;
      }

      const headers = rows[0];
      let data = rowsToObjects(rows, headers);
      
      if (migration.transform) {
        data = migration.transform(data);
      }

      console.log(`      📊 ${data.length}개 행 발견`);

      const result = await upsertToSupabase(migration.tableName, data, migration.uniqueKey);
      if (result.skipped) {
        stats.skipped++;
        continue;
      }
      if (result.success) {
        console.log(`      ✅ ${result.count}개 행 마이그레이션 완료`);
        stats.success++;
        stats.categories[category].success++;
      } else {
        stats.failed++;
        stats.categories[category].failed++;
      }
    }
  }
}

/**
 * 3. 고객 모드 마이그레이션
 */
async function migrateCustomerMode() {
  console.log('\n📂 [3/4] 고객 모드 마이그레이션 시작...');
  const category = 'customer';
  stats.categories[category] = { total: 0, success: 0, failed: 0 };

  const migrations = [
    {
      sheetName: '고객_대기고객',
      tableName: 'customer_queue',
      uniqueKey: 'queue_id'
    },
    {
      sheetName: '고객_상담이력',
      tableName: 'customer_consultation_history',
      uniqueKey: 'consultation_id'
    }
  ];

  for (const migration of migrations) {
    stats.total++;
    stats.categories[category].total++;
    
    console.log(`\n   📄 ${migration.sheetName} → ${migration.tableName}`);
    
    const rows = await readSheet(migration.sheetName);
    if (!rows || rows.length < 2) {
      console.log(`   ⏭️  데이터 없음, 건너뜀`);
      stats.skipped++;
      continue;
    }

    const headers = rows[0];
    const data = rowsToObjects(rows, headers);
    console.log(`   📊 ${data.length}개 행 발견`);

    const result = await upsertToSupabase(migration.tableName, data, migration.uniqueKey);
    if (result.skipped) {
      stats.skipped++;
      continue;
    }
    if (result.success) {
      console.log(`   ✅ ${result.count}개 행 마이그레이션 완료`);
      stats.success++;
      stats.categories[category].success++;
    } else {
      stats.failed++;
      stats.categories[category].failed++;
    }
  }
}

/**
 * 4. 마스터 데이터 마이그레이션
 */
async function migrateMasterData() {
  console.log('\n📂 [4/4] 마스터 데이터 마이그레이션 시작...');
  const category = 'master';
  stats.categories[category] = { total: 0, success: 0, failed: 0 };

  const migrations = [
    {
      sheetName: '대리점아이디관리',
      tableName: 'master_agent_management',
      uniqueKey: 'user_id'
    },
    {
      sheetName: '일반모드권한관리',
      tableName: 'master_general_mode_permissions',
      uniqueKey: 'user_id'
    },
    {
      sheetName: '대중교통위치',
      tableName: 'master_transit_locations',
      uniqueKey: 'location_id'
    }
  ];

  for (const migration of migrations) {
    stats.total++;
    stats.categories[category].total++;
    
    console.log(`\n   📄 ${migration.sheetName} → ${migration.tableName}`);
    
    const rows = await readSheet(migration.sheetName);
    if (!rows || rows.length < 2) {
      console.log(`   ⏭️  데이터 없음, 건너뜀`);
      stats.skipped++;
      continue;
    }

    const headers = rows[0];
    const data = rowsToObjects(rows, headers);
    console.log(`   📊 ${data.length}개 행 발견`);

    const result = await upsertToSupabase(migration.tableName, data, migration.uniqueKey);
    if (result.skipped) {
      stats.skipped++;
      continue;
    }
    if (result.success) {
      console.log(`   ✅ ${result.count}개 행 마이그레이션 완료`);
      stats.success++;
      stats.categories[category].success++;
    } else {
      stats.failed++;
      stats.categories[category].failed++;
    }
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    // 카테고리별 마이그레이션 실행
    if (!onlyCategory || onlyCategory === 'policy') {
      await migratePolicyMode();
    }
    
    if (!onlyCategory || onlyCategory === 'direct-store') {
      await migrateDirectStoreMode();
    }
    
    if (!onlyCategory || onlyCategory === 'customer') {
      await migrateCustomerMode();
    }
    
    if (!onlyCategory || onlyCategory === 'master') {
      await migrateMasterData();
    }

    // 최종 통계 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 마이그레이션 완료 통계');
    console.log('='.repeat(60));
    console.log(`총 시트: ${stats.total}개`);
    console.log(`✅ 성공: ${stats.success}개`);
    console.log(`❌ 실패: ${stats.failed}개`);
    console.log(`⏭️  건너뜀: ${stats.skipped}개`);
    console.log('');
    console.log('카테고리별 통계:');
    Object.entries(stats.categories).forEach(([category, stat]) => {
      console.log(`  ${category}: ${stat.success}/${stat.total} 성공`);
    });
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('\n⚠️  DRY-RUN 모드: 실제 데이터는 변경되지 않았습니다.');
      console.log('실제 마이그레이션을 실행하려면 --dry-run 옵션을 제거하세요.');
    }

    process.exit(stats.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ 마이그레이션 중 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
main();
