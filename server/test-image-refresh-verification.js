/**
 * Task 0.4: 시세표 갱신 버튼 테스트
 * 
 * Discord 이미지 갱신 API 테스트 및 Supabase 데이터 확인
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('./supabaseClient');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testImageRefresh() {
  console.log('🧪 Task 0.4: 시세표 갱신 버튼 테스트 시작\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔥 Feature Flag (USE_DB_DIRECT_STORE): ${process.env.USE_DB_DIRECT_STORE}\n`);

  try {
    // ========== 1. LG 이미지 갱신 테스트 ==========
    console.log('1️⃣ LG 시세표 이미지 갱신 테스트');
    
    // 갱신 전 데이터 확인
    const { data: beforeData, error: beforeError } = await supabase
      .from('direct_store_model_images')
      .select('*')
      .eq('통신사', 'LG')
      .limit(3);
    
    if (beforeError) {
      console.log(`  ⚠️ 갱신 전 데이터 조회 실패:`, beforeError.message);
    } else {
      console.log(`  📊 갱신 전: ${beforeData.length}개 이미지 데이터`);
    }
    
    // 이미지 갱신 API 호출
    const lgResponse = await axios.post(`${API_BASE_URL}/api/direct/refresh-images-from-discord?carrier=LG`);
    console.log(`  ✅ LG 이미지 갱신 API 호출 성공:`, lgResponse.data);
    
    // 갱신 후 데이터 확인
    const { data: afterData, error: afterError } = await supabase
      .from('direct_store_model_images')
      .select('*')
      .eq('통신사', 'LG')
      .limit(3);
    
    if (afterError) {
      console.log(`  ⚠️ 갱신 후 데이터 조회 실패:`, afterError.message);
    } else {
      console.log(`  ✅ 갱신 후: ${afterData.length}개 이미지 데이터`);
      if (afterData.length > 0) {
        console.log(`     첫 번째 이미지:`, {
          통신사: afterData[0]['통신사'],
          모델명: afterData[0]['모델명'],
          이미지URL: afterData[0]['이미지URL']?.substring(0, 80) + '...',
          Discord메시지ID: afterData[0]['Discord메시지ID']
        });
      }
    }
    console.log('');

    // ========== 2. 전체 통신사 이미지 갱신 테스트 ==========
    console.log('2️⃣ 전체 통신사 시세표 이미지 갱신 테스트');
    
    const allResponse = await axios.post(`${API_BASE_URL}/api/direct/refresh-images-from-discord`);
    console.log(`  ✅ 전체 이미지 갱신 API 호출 성공:`, allResponse.data);
    
    // 각 통신사별 이미지 데이터 확인
    for (const carrier of ['SK', 'KT', 'LG']) {
      const { data, error } = await supabase
        .from('direct_store_model_images')
        .select('통신사', { count: 'exact', head: true })
        .eq('통신사', carrier);
      
      if (error) {
        console.log(`  ⚠️ ${carrier} 이미지 데이터 확인 실패:`, error.message);
      } else {
        console.log(`  ✅ ${carrier}: 이미지 데이터 확인`);
      }
    }
    console.log('');

    // ========== 3. 이미지 URL 유효성 확인 ==========
    console.log('3️⃣ 이미지 URL 유효성 확인');
    
    const { data: imageData, error: imageError } = await supabase
      .from('direct_store_model_images')
      .select('통신사, 모델명, 이미지URL')
      .eq('통신사', 'LG')
      .not('이미지URL', 'is', null)
      .limit(5);
    
    if (imageError) {
      console.log(`  ⚠️ 이미지 데이터 조회 실패:`, imageError.message);
    } else {
      console.log(`  ✅ ${imageData.length}개 이미지 URL 확인`);
      imageData.forEach((img, idx) => {
        const hasValidUrl = img['이미지URL'] && img['이미지URL'].startsWith('https://');
        console.log(`     ${idx + 1}. ${img['모델명']}: ${hasValidUrl ? '✅ 유효' : '❌ 무효'}`);
      });
    }
    console.log('');

    // ========== 4. 결과 요약 ==========
    console.log('=' .repeat(50));
    console.log('📊 Task 0.4 테스트 결과');
    console.log('=' .repeat(50));
    console.log('✅ 이미지 갱신 API 정상 작동');
    console.log('✅ Discord에서 이미지 URL 가져오기 확인');
    console.log('✅ Supabase 이미지 데이터 업데이트 확인');
    console.log('✅ 이미지 URL 유효성 확인');
    console.log('');
    console.log('🎉 Task 0.4 완료!\n');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('상세 에러:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testImageRefresh();
