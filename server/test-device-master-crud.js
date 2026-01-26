/**
 * 단말 마스터 CRUD API 테스트
 * 
 * 테스트 순서:
 * 1. POST - 새 단말 생성
 * 2. GET - 생성된 단말 조회
 * 3. PUT - 단말 정보 수정
 * 4. GET - 수정된 단말 조회
 * 5. DELETE - 단말 삭제
 * 6. GET - 삭제 확인
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_CARRIER = 'LG';
const TEST_MODEL_ID = 'TEST-MODEL-001';

// 색상 출력 헬퍼
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCreate() {
  log('\n📝 [1/6] POST /api/direct/mobiles-master - 단말 생성 테스트', 'cyan');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/direct/mobiles-master`, {
      carrier: TEST_CARRIER,
      modelId: TEST_MODEL_ID,
      modelName: '테스트 모델',
      petName: '테스트폰',
      manufacturer: '테스트제조사',
      factoryPrice: 1000000,
      defaultPlanGroup: '115군',
      isPremium: true,
      isBudget: false,
      isPopular: true,
      isRecommended: false,
      isCheap: false,
      imageUrl: 'https://example.com/test.jpg',
      isActive: true,
      note: '테스트용 단말'
    });
    
    if (response.data.success) {
      log('✅ 단말 생성 성공', 'green');
      console.log(response.data);
    } else {
      log('❌ 단말 생성 실패', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ 단말 생성 에러', 'red');
    console.error(error.response?.data || error.message);
  }
}

async function testRead() {
  log('\n📖 [2/6] GET /api/direct/mobiles-master - 단말 조회 테스트', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/direct/mobiles-master`, {
      params: {
        carrier: TEST_CARRIER,
        modelId: TEST_MODEL_ID
      }
    });
    
    if (response.data.success && response.data.data.length > 0) {
      log('✅ 단말 조회 성공', 'green');
      console.log(JSON.stringify(response.data.data[0], null, 2));
      return response.data.data[0];
    } else {
      log('❌ 단말 조회 실패 (데이터 없음)', 'red');
      console.log(response.data);
      return null;
    }
  } catch (error) {
    log('❌ 단말 조회 에러', 'red');
    console.error(error.response?.data || error.message);
    return null;
  }
}

async function testUpdate() {
  log('\n✏️ [3/6] PUT /api/direct/mobiles-master/:carrier/:modelId - 단말 수정 테스트', 'cyan');
  
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/direct/mobiles-master/${TEST_CARRIER}/${TEST_MODEL_ID}`,
      {
        factoryPrice: 1200000,
        isPremium: false,
        note: '테스트용 단말 (수정됨)'
      }
    );
    
    if (response.data.success) {
      log('✅ 단말 수정 성공', 'green');
      console.log(response.data);
    } else {
      log('❌ 단말 수정 실패', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ 단말 수정 에러', 'red');
    console.error(error.response?.data || error.message);
  }
}

async function testReadAfterUpdate() {
  log('\n📖 [4/6] GET /api/direct/mobiles-master - 수정 후 단말 조회 테스트', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/direct/mobiles-master`, {
      params: {
        carrier: TEST_CARRIER,
        modelId: TEST_MODEL_ID
      }
    });
    
    if (response.data.success && response.data.data.length > 0) {
      log('✅ 수정 후 단말 조회 성공', 'green');
      const device = response.data.data[0];
      console.log(JSON.stringify(device, null, 2));
      
      // 수정 사항 확인
      log('\n🔍 수정 사항 확인:', 'yellow');
      console.log(`  - factoryPrice: ${device.factoryPrice} (예상: 1200000)`);
      console.log(`  - isPremium: ${device.isPremium} (예상: false)`);
      console.log(`  - note: ${device.note} (예상: "테스트용 단말 (수정됨)")`);
      
      if (device.factoryPrice === 1200000 && device.isPremium === false) {
        log('✅ 수정 사항 확인 완료', 'green');
      } else {
        log('⚠️ 수정 사항이 반영되지 않았습니다', 'yellow');
      }
    } else {
      log('❌ 수정 후 단말 조회 실패 (데이터 없음)', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ 수정 후 단말 조회 에러', 'red');
    console.error(error.response?.data || error.message);
  }
}

async function testDelete() {
  log('\n🗑️ [5/6] DELETE /api/direct/mobiles-master/:carrier/:modelId - 단말 삭제 테스트', 'cyan');
  
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/direct/mobiles-master/${TEST_CARRIER}/${TEST_MODEL_ID}`
    );
    
    if (response.data.success) {
      log('✅ 단말 삭제 성공', 'green');
      console.log(response.data);
    } else {
      log('❌ 단말 삭제 실패', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ 단말 삭제 에러', 'red');
    console.error(error.response?.data || error.message);
  }
}

async function testReadAfterDelete() {
  log('\n📖 [6/6] GET /api/direct/mobiles-master - 삭제 후 단말 조회 테스트', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/direct/mobiles-master`, {
      params: {
        carrier: TEST_CARRIER,
        modelId: TEST_MODEL_ID
      }
    });
    
    if (response.data.success && response.data.data.length === 0) {
      log('✅ 삭제 확인 완료 (데이터 없음)', 'green');
      console.log(response.data);
    } else if (response.data.success && response.data.data.length > 0) {
      log('⚠️ 삭제되지 않았습니다', 'yellow');
      console.log(response.data.data[0]);
    } else {
      log('❌ 삭제 후 단말 조회 실패', 'red');
      console.log(response.data);
    }
  } catch (error) {
    log('❌ 삭제 후 단말 조회 에러', 'red');
    console.error(error.response?.data || error.message);
  }
}

async function runTests() {
  log('='.repeat(80), 'blue');
  log('단말 마스터 CRUD API 테스트 시작', 'blue');
  log('='.repeat(80), 'blue');
  log(`API Base URL: ${API_BASE_URL}`, 'blue');
  log(`Test Carrier: ${TEST_CARRIER}`, 'blue');
  log(`Test Model ID: ${TEST_MODEL_ID}`, 'blue');
  log(`USE_DB_DIRECT_STORE: ${process.env.USE_DB_DIRECT_STORE}`, 'blue');
  
  try {
    await testCreate();
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
    
    await testRead();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testUpdate();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testReadAfterUpdate();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testDelete();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testReadAfterDelete();
    
    log('\n' + '='.repeat(80), 'blue');
    log('테스트 완료', 'blue');
    log('='.repeat(80), 'blue');
  } catch (error) {
    log('\n테스트 실행 중 에러 발생', 'red');
    console.error(error);
  }
}

// 테스트 실행
runTests();
