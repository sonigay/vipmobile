const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLGImageCount() {
  const { data, error, count } = await supabase
    .from('direct_store_model_images')
    .select('*', { count: 'exact' })
    .eq('통신사', 'LG');

  if (error) {
    console.error('❌ 조회 실패:', error);
  } else {
    console.log(`📊 LG 이미지 총 개수: ${count}개`);
    console.log(`   Discord메시지ID가 있는 것: ${data.filter(d => d.Discord메시지ID).length}개`);
    console.log(`   Discord메시지ID가 없는 것: ${data.filter(d => !d.Discord메시지ID).length}개`);
  }
}

checkLGImageCount();
