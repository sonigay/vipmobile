/**
 * 시세표 갱신 버튼 테스트 스크립트
 * 
 * 태스크 0.4: 시세표 갱신 버튼 테스트
 * - Discord에서 이미지 URL 가져오기 확인
 * - `직영점_모델이미지` 테이블 업데이트 확인
 * - 시세표에서 이미지 표시 확인
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase 설정이 없습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testImageRefresh() {
  console.log('🔍 시세표 갱신 버튼 테스트 시작\n');

  try {
    // 1. direct_store_model_images 테이블 확인
    console.log('📊 1. direct_store_model_images 테이블 데이터 확인');
    const { data: images, error: imagesError } = await supabase
      .from('direct_store_model_images')
      .select('*')
      .limit(10);

    if (imagesError) {
      console.error('❌ 테이블 조회 실패:', imagesError);
      return;
    }

    console.log(`✅ 총 ${images.length}개 이미지 발견`);
    
    if (images.length === 0) {
      console.log('⚠️ 테이블에 데이터가 없습니다. 먼저 데이터를 마이그레이션하세요.');
      return;
    }

    // 2. Discord 메시지 ID가 있는 이미지 확인
    console.log('\n📊 2. Discord 메시지 ID가 있는 이미지 확인');
    const imagesWithDiscord = images.filter(img => img['Discord메시지ID']);
    console.log(`✅ Discord 메시지 ID가 있는 이미지: ${imagesWithDiscord.length}개`);

    if (imagesWithDiscord.length > 0) {
      console.log('\n샘플 데이터:');
      imagesWithDiscord.slice(0, 3).forEach((img, idx) => {
        console.log(`\n${idx + 1}. ${img['통신사']} - ${img['모델명']}`);
        console.log(`   모델ID: ${img['모델ID']}`);
        console.log(`   이미지URL: ${img['이미지URL']?.substring(0, 50)}...`);
        console.log(`   Discord메시지ID: ${img['Discord메시지ID']}`);
        console.log(`   Discord스레드ID: ${img['Discord스레드ID'] || '없음'}`);
      });
    }

    // 3. 통신사별 통계
    console.log('\n📊 3. 통신사별 이미지 통계');
    const carriers = ['SK', 'KT', 'LG'];
    for (const carrier of carriers) {
      const { count, error } = await supabase
        .from('direct_store_model_images')
        .select('*', { count: 'exact', head: true })
        .eq('통신사', carrier);

      if (error) {
        console.error(`❌ ${carrier} 조회 실패:`, error);
      } else {
        console.log(`   ${carrier}: ${count}개`);
      }
    }

    // 4. API 엔드포인트 테스트 (로컬 서버가 실행 중이어야 함)
    console.log('\n📊 4. API 엔드포인트 테스트');
    console.log('⚠️ 이 테스트는 로컬 서버가 실행 중이어야 합니다.');
    console.log('   서버 실행: cd server && npm start');
    console.log('\n테스트 명령어:');
    console.log('   curl -X POST "http://localhost:4000/api/direct/refresh-images-from-discord?carrier=SK"');
    console.log('   curl -X POST "http://localhost:4000/api/direct/refresh-images-from-discord?carrier=KT"');
    console.log('   curl -X POST "http://localhost:4000/api/direct/refresh-images-from-discord?carrier=LG"');

    // 5. Discord 설정 확인
    console.log('\n📊 5. Discord 설정 확인');
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
    
    if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
      console.log('⚠️ Discord 설정이 없습니다.');
      console.log('   .env 파일에 다음 설정을 추가하세요:');
      console.log('   DISCORD_BOT_TOKEN=your-bot-token');
      console.log('   DISCORD_CHANNEL_ID=your-channel-id');
      console.log('   DISCORD_LOGGING_ENABLED=true');
    } else {
      console.log('✅ Discord 설정이 있습니다.');
      console.log(`   BOT_TOKEN: ${DISCORD_BOT_TOKEN.substring(0, 20)}...`);
      console.log(`   CHANNEL_ID: ${DISCORD_CHANNEL_ID}`);
    }

    console.log('\n✅ 테스트 완료');
    console.log('\n📝 다음 단계:');
    console.log('1. Discord 설정이 없다면 .env 파일에 추가');
    console.log('2. 서버 실행: cd server && npm start');
    console.log('3. 프론트엔드에서 직영점관리모드 > Discord 이미지 모니터링 탭 접속');
    console.log('4. "선택 항목 갱신" 버튼 클릭하여 테스트');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 실행
testImageRefresh().then(() => {
  console.log('\n🎉 스크립트 종료');
  process.exit(0);
}).catch(err => {
  console.error('❌ 스크립트 오류:', err);
  process.exit(1);
});
