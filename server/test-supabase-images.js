/**
 * Supabase 이미지 데이터 확인
 * 
 * 목적:
 * - 직영점_모델이미지 테이블에서 LG 데이터 확인
 * - Google Sheets와 Supabase 데이터 비교
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseImages() {
  try {
    console.log('=== Supabase 이미지 데이터 확인 ===\n');

    // 1. 직영점_모델이미지 테이블에서 LG 데이터 조회
    const { data, error } = await supabase
      .from('직영점_모델이미지')
      .select('*')
      .eq('통신사', 'LG')
      .order('모델ID', { ascending: true });

    if (error) {
      console.error('❌ Supabase 조회 실패:', error);
      return;
    }

    console.log(`✅ LG 이미지 데이터: ${data.length}개\n`);

    if (data.length === 0) {
      console.log('⚠️ LG 이미지 데이터가 없습니다.');
      return;
    }

    // 2. 데이터 출력
    console.log('=== LG 이미지 데이터 ===');
    data.forEach((row, idx) => {
      console.log(`\n[${idx + 1}] ${row['모델명'] || row['모델ID']}`);
      console.log(`  - 통신사: ${row['통신사']}`);
      console.log(`  - 모델ID: ${row['모델ID']}`);
      console.log(`  - 모델명: ${row['모델명']}`);
      console.log(`  - 펫네임: ${row['펫네임']}`);
      console.log(`  - 제조사: ${row['제조사']}`);
      console.log(`  - 이미지URL: ${row['이미지URL'] ? '있음' : '없음'}`);
      if (row['이미지URL']) {
        console.log(`    ${row['이미지URL'].substring(0, 80)}...`);
      }
      console.log(`  - Discord메시지ID: ${row['Discord메시지ID'] || '없음'}`);
      console.log(`  - Discord스레드ID: ${row['Discord스레드ID'] || '없음'}`);
    });

    // 3. 특정 모델 확인
    console.log('\n\n=== 특정 모델 확인 ===');
    const testModels = ['SM-S926N256', 'SM-F766N256', 'UIP17-256', 'SM-A166L', 'AT-M140L'];
    
    for (const modelName of testModels) {
      const { data: modelData, error: modelError } = await supabase
        .from('직영점_모델이미지')
        .select('*')
        .eq('통신사', 'LG')
        .or(`모델ID.eq.${modelName},모델명.eq.${modelName}`)
        .single();

      if (modelError) {
        console.log(`\n❌ ${modelName} 찾을 수 없음: ${modelError.message}`);
      } else {
        console.log(`\n✅ ${modelName} 찾음`);
        console.log(`  - 펫네임: ${modelData['펫네임']}`);
        console.log(`  - 이미지URL: ${modelData['이미지URL'] ? '있음' : '없음'}`);
        if (modelData['이미지URL']) {
          console.log(`    ${modelData['이미지URL'].substring(0, 80)}...`);
        }
      }
    }

    console.log('\n\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  }
}

// 실행
testSupabaseImages();
