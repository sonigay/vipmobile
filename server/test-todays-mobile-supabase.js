require('dotenv').config();
const { supabase } = require('./supabaseClient');

async function testTodaysMobileSupabase() {
  console.log('🧪 Supabase 오늘의 휴대폰 데이터 확인\n');

  try {
    // 1. 모든 데이터 조회
    console.log('1️⃣ 모든 오늘의 휴대폰 데이터 조회');
    const { data, error } = await supabase
      .from('direct_store_todays_mobiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ 조회 실패:', error);
      return;
    }

    console.log(`✅ 조회 성공: ${data.length}개 데이터`);
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    // 2. LG 데이터만 조회
    console.log('2️⃣ LG 오늘의 휴대폰 데이터 조회');
    const { data: lgData, error: lgError } = await supabase
      .from('direct_store_todays_mobiles')
      .select('*')
      .eq('통신사', 'LG')
      .order('created_at', { ascending: false });

    if (lgError) {
      console.error('❌ 조회 실패:', lgError);
      return;
    }

    console.log(`✅ 조회 성공: ${lgData.length}개 데이터`);
    console.log(JSON.stringify(lgData, null, 2));

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testTodaysMobileSupabase();
