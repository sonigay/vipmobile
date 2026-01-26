/**
 * 스케줄러 동작 확인 테스트
 * 
 * 이 스크립트는 다음을 확인합니다:
 * 1. Discord 이미지 자동 갱신 스케줄 실행 로그 확인
 * 2. 데이터 재빌드 스케줄 실행 로그 확인
 * 3. Supabase 데이터 업데이트 확인
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchedulerStatus() {
  console.log('='.repeat(80));
  console.log('📊 스케줄러 동작 확인 테스트');
  console.log('='.repeat(80));
  console.log();

  // 1. Supabase 연결 확인
  console.log('1️⃣ Supabase 연결 확인...');
  try {
    const { data, error } = await supabase
      .from('direct_store_plan_master')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    console.log('   ✅ Supabase 연결 성공');
  } catch (error) {
    console.error('   ❌ Supabase 연결 실패:', error.message);
    process.exit(1);
  }
  console.log();

  // 2. 요금제 마스터 데이터 확인
  console.log('2️⃣ 요금제 마스터 데이터 확인...');
  try {
    // 통신사별 카운트
    const { count: skCount } = await supabase
      .from('direct_store_plan_master')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'SK');
    
    const { count: ktCount } = await supabase
      .from('direct_store_plan_master')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'KT');
    
    const { count: lgCount } = await supabase
      .from('direct_store_plan_master')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'LG');

    console.log('   📊 요금제 마스터 데이터:');
    console.log(`      - SK: ${skCount || 0}개`);
    console.log(`      - KT: ${ktCount || 0}개`);
    console.log(`      - LG: ${lgCount || 0}개`);
    console.log(`      - 총합: ${(skCount || 0) + (ktCount || 0) + (lgCount || 0)}개`);

    // 최근 업데이트 시간 확인
    const { data: recentPlan } = await supabase
      .from('direct_store_plan_master')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (recentPlan?.updated_at) {
      const updateTime = new Date(recentPlan.updated_at);
      const now = new Date();
      const diffMinutes = Math.floor((now - updateTime) / 1000 / 60);
      console.log(`   ⏰ 최근 업데이트: ${updateTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${diffMinutes}분 전)`);
    }
  } catch (error) {
    console.error('   ❌ 요금제 마스터 데이터 확인 실패:', error.message);
  }
  console.log();

  // 3. 단말 마스터 데이터 확인
  console.log('3️⃣ 단말 마스터 데이터 확인...');
  try {
    const { count: skCount } = await supabase
      .from('direct_store_device_master')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'SK');
    
    const { count: ktCount } = await supabase
      .from('direct_store_device_master')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'KT');
    
    const { count: lgCount } = await supabase
      .from('direct_store_device_master')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'LG');

    console.log('   📊 단말 마스터 데이터:');
    console.log(`      - SK: ${skCount || 0}개`);
    console.log(`      - KT: ${ktCount || 0}개`);
    console.log(`      - LG: ${lgCount || 0}개`);
    console.log(`      - 총합: ${(skCount || 0) + (ktCount || 0) + (lgCount || 0)}개`);

    // 최근 업데이트 시간 확인
    const { data: recentDevice } = await supabase
      .from('direct_store_device_master')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (recentDevice?.updated_at) {
      const updateTime = new Date(recentDevice.updated_at);
      const now = new Date();
      const diffMinutes = Math.floor((now - updateTime) / 1000 / 60);
      console.log(`   ⏰ 최근 업데이트: ${updateTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${diffMinutes}분 전)`);
    }
  } catch (error) {
    console.error('   ❌ 단말 마스터 데이터 확인 실패:', error.message);
  }
  console.log();

  // 4. 단말 요금정책 데이터 확인
  console.log('4️⃣ 단말 요금정책 데이터 확인...');
  try {
    const { count: skCount } = await supabase
      .from('direct_store_device_pricing_policy')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'SK');
    
    const { count: ktCount } = await supabase
      .from('direct_store_device_pricing_policy')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'KT');
    
    const { count: lgCount } = await supabase
      .from('direct_store_device_pricing_policy')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'LG');

    console.log('   📊 단말 요금정책 데이터:');
    console.log(`      - SK: ${skCount || 0}개`);
    console.log(`      - KT: ${ktCount || 0}개`);
    console.log(`      - LG: ${lgCount || 0}개`);
    console.log(`      - 총합: ${(skCount || 0) + (ktCount || 0) + (lgCount || 0)}개`);

    // 최근 업데이트 시간 확인
    const { data: recentPricing } = await supabase
      .from('direct_store_device_pricing_policy')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (recentPricing?.updated_at) {
      const updateTime = new Date(recentPricing.updated_at);
      const now = new Date();
      const diffMinutes = Math.floor((now - updateTime) / 1000 / 60);
      console.log(`   ⏰ 최근 업데이트: ${updateTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${diffMinutes}분 전)`);
    }
  } catch (error) {
    console.error('   ❌ 단말 요금정책 데이터 확인 실패:', error.message);
  }
  console.log();

  // 5. 모델 이미지 데이터 확인
  console.log('5️⃣ 모델 이미지 데이터 확인...');
  try {
    const { count: skCount } = await supabase
      .from('direct_store_model_images')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'SK');
    
    const { count: ktCount } = await supabase
      .from('direct_store_model_images')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'KT');
    
    const { count: lgCount } = await supabase
      .from('direct_store_model_images')
      .select('*', { count: 'exact', head: true })
      .eq('통신사', 'LG');

    console.log('   📊 모델 이미지 데이터:');
    console.log(`      - SK: ${skCount || 0}개`);
    console.log(`      - KT: ${ktCount || 0}개`);
    console.log(`      - LG: ${lgCount || 0}개`);
    console.log(`      - 총합: ${(skCount || 0) + (ktCount || 0) + (lgCount || 0)}개`);

    // 최근 업데이트 시간 확인
    const { data: recentImage } = await supabase
      .from('direct_store_model_images')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (recentImage?.updated_at) {
      const updateTime = new Date(recentImage.updated_at);
      const now = new Date();
      const diffMinutes = Math.floor((now - updateTime) / 1000 / 60);
      console.log(`   ⏰ 최근 업데이트: ${updateTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${diffMinutes}분 전)`);
    }
  } catch (error) {
    console.error('   ❌ 모델 이미지 데이터 확인 실패:', error.message);
  }
  console.log();

  // 6. 스케줄러 실행 시간 안내
  console.log('6️⃣ 스케줄러 실행 시간 안내');
  console.log('   📅 Discord 이미지 자동 갱신:');
  console.log('      - 03:30, 07:30, 11:30, 17:30, 20:30, 23:30 (Asia/Seoul)');
  console.log('   📅 데이터 재빌드:');
  console.log('      - 11:10, 12:10, 13:10, 14:10, 15:10, 16:10, 17:10, 18:10, 19:10 (Asia/Seoul)');
  console.log();

  // 7. 현재 시간 및 다음 스케줄 예상
  const now = new Date();
  const seoulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  console.log('7️⃣ 현재 시간 (Asia/Seoul)');
  console.log(`   ⏰ ${seoulTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log();

  // 다음 이미지 갱신 스케줄 계산
  const imageRefreshTimes = [3.5, 7.5, 11.5, 17.5, 20.5, 23.5]; // 시간 (소수점은 30분)
  const currentHour = seoulTime.getHours() + seoulTime.getMinutes() / 60;
  const nextImageRefresh = imageRefreshTimes.find(t => t > currentHour) || imageRefreshTimes[0];
  const hoursUntilImageRefresh = nextImageRefresh > currentHour 
    ? nextImageRefresh - currentHour 
    : 24 - currentHour + nextImageRefresh;
  
  console.log('8️⃣ 다음 스케줄 예상');
  console.log(`   🖼️  다음 이미지 갱신: 약 ${Math.floor(hoursUntilImageRefresh)}시간 ${Math.round((hoursUntilImageRefresh % 1) * 60)}분 후`);

  // 다음 재빌드 스케줄 계산
  const rebuildHours = [11, 12, 13, 14, 15, 16, 17, 18, 19];
  const currentHourInt = seoulTime.getHours();
  const currentMinute = seoulTime.getMinutes();
  const nextRebuild = rebuildHours.find(h => h > currentHourInt || (h === currentHourInt && currentMinute < 10));
  
  if (nextRebuild) {
    const minutesUntilRebuild = (nextRebuild - currentHourInt) * 60 + (10 - currentMinute);
    console.log(`   🔄 다음 데이터 재빌드: 약 ${Math.floor(minutesUntilRebuild / 60)}시간 ${minutesUntilRebuild % 60}분 후`);
  } else {
    const minutesUntilRebuild = (24 - currentHourInt + 11) * 60 + (10 - currentMinute);
    console.log(`   🔄 다음 데이터 재빌드: 약 ${Math.floor(minutesUntilRebuild / 60)}시간 ${minutesUntilRebuild % 60}분 후 (내일)`);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('✅ 스케줄러 동작 확인 완료');
  console.log('='.repeat(80));
  console.log();
  console.log('💡 참고사항:');
  console.log('   - 스케줄러는 서버가 실행 중일 때만 동작합니다.');
  console.log('   - 서버 로그에서 "⏰ [스케줄러]" 메시지를 확인하세요.');
  console.log('   - 데이터가 최근에 업데이트되지 않았다면 스케줄 시간을 기다리거나');
  console.log('     직영점관리모드에서 수동으로 "데이터 재빌드" 또는 "시세표 갱신하기"를 실행하세요.');
  console.log();
}

// 실행
checkSchedulerStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  });
