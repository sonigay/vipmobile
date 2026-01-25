/**
 * 정책_기본정보 시트 마이그레이션 스크립트
 * 
 * 실행 방법:
 * node server/migration/migrate-policy-basic-info.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { supabase } = require('../supabaseClient');
const { google } = require('googleapis');

const SHEET_NAME = '정책_기본정보 '; // 주의: 끝에 공백 있음

// Google Sheets 클라이언트 생성
function createSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, SPREADSHEET_ID: process.env.SHEET_ID };
}

// 데이터 변환 함수
function transformRow(row, index) {
  return {
    "정책ID": row[0] || `POLICY_${Date.now()}_${index}`,
    "정책명": row[1] || '',
    "정책적용일": row[2] || '',
    "정책적용점": row[3] || '',
    "정책내용": row[4] || '',
    "금액": row[5] || '',
    "정책유형": row[6] || '',
    "무선유선": row[7] || '',
    "하위카테고리": row[8] || '',
    "입력자ID": row[9] || '',
    "입력자명": row[10] || '',
    "입력일시": row[11] || '',
    "승인상태_총괄": row[12] || '대기',
    "승인상태_정산팀": row[13] || '대기',
    "승인상태_소속팀": row[14] || '대기',
    "정책상태": row[15] || '활성',
    "취소사유": row[16] || '',
    "취소일시": row[17] || '',
    "취소자명": row[18] || '',
    "정산반영상태": row[19] || '미반영',
    "정산반영자명": row[20] || '',
    "정산반영일시": row[21] || '',
    "정산반영자ID": row[22] || '',
    "대상년월": row[23] || '',
    "복수점명": row[24] || '',
    "업체명": row[25] || '',
    "개통유형": row[26] || '',
    "95군이상금액": row[27] || '',
    "95군미만금액": row[28] || '',
    "소속팀": row[29] || '',
    "부가미유치금액": row[30] || '',
    "보험미유치금액": row[31] || '',
    "연결음미유치금액": row[32] || '',
    "부가유치시조건": row[33] || '',
    "보험유치시조건": row[34] || '',
    "연결음유치시조건": row[35] || '',
    "유플레이프리미엄유치금액": row[36] || '',
    "폰교체패스유치금액": row[37] || '',
    "음악감상유치금액": row[38] || '',
    "지정번호필터링유치금액": row[39] || '',
    "VAS2종동시유치조건": row[40] || '',
    "VAS2종중1개유치조건": row[41] || '',
    "부가3종모두유치조건": row[42] || '',
    "요금제유형별정책JSON": row[43] ? (row[43].startsWith('[') || row[43].startsWith('{') ? row[43] : null) : null,
    "정산입금처": row[44] || '',
    "연합대상하부점JSON": row[45] ? (row[45].startsWith('[') || row[45].startsWith('{') ? row[45] : null) : null,
    "조건JSON": row[46] ? (row[46].startsWith('[') || row[46].startsWith('{') ? row[46] : null) : null,
    "적용대상JSON": row[47] ? (row[47].startsWith('[') || row[47].startsWith('{') ? row[47] : null) : null,
    "개통유형_개별": row[48] || '',
    "담당자명": row[49] || '',
    "직접입력여부": row[50] || ''
  };
}

async function migrate() {
  console.log('🚀 정책_기본정보 마이그레이션 시작...\n');
  
  try {
    // 1. 테이블 생성 (스키마 파일 실행 필요)
    console.log('📋 1단계: 테이블 확인...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('policy_basic_info')
      .select('count')
      .limit(1);
    
    if (tableError && tableError.code === '42P01') {
      console.log('❌ policy_basic_info 테이블이 없습니다!');
      console.log('   Supabase SQL Editor에서 schema-policy.sql을 먼저 실행하세요.');
      process.exit(1);
    }
    
    console.log('✅ 테이블 확인 완료\n');
    
    // 2. Google Sheets에서 데이터 읽기
    console.log('📥 2단계: Google Sheets 데이터 읽기...');
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AY`
    });
    
    const rows = response.data.values || [];
    console.log(`   총 ${rows.length}행 읽음`);
    
    if (rows.length === 0) {
      console.log('⚠️  데이터가 없습니다.');
      return;
    }
    
    // 헤더 제거
    const dataRows = rows.slice(1);
    console.log(`   데이터 행: ${dataRows.length}개\n`);
    
    // 3. 데이터 변환
    console.log('🔄 3단계: 데이터 변환 중...');
    const transformedData = dataRows
      .filter(row => row[0]) // 정책ID가 있는 행만
      .map((row, index) => transformRow(row, index));
    
    console.log(`   변환 완료: ${transformedData.length}개\n`);
    
    // 4. 기존 데이터 삭제
    console.log('🗑️  4단계: 기존 데이터 삭제...');
    const { error: deleteError } = await supabase
      .from('policy_basic_info')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제
    
    if (deleteError) {
      console.log('⚠️  삭제 중 오류 (계속 진행):', deleteError.message);
    } else {
      console.log('✅ 기존 데이터 삭제 완료\n');
    }
    
    // 5. 배치 삽입 (100개씩)
    console.log('💾 5단계: Supabase에 데이터 삽입...');
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('policy_basic_info')
        .insert(batch)
        .select();
      
      if (error) {
        console.log(`   ❌ 배치 ${Math.floor(i / batchSize) + 1} 실패:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += data.length;
        console.log(`   ✅ 배치 ${Math.floor(i / batchSize) + 1}: ${data.length}개 삽입`);
      }
    }
    
    console.log('\n📊 마이그레이션 완료!');
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${errorCount}개`);
    console.log(`   성공률: ${((successCount / transformedData.length) * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

// 실행
migrate();
