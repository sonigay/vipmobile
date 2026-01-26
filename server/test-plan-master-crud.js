/**
 * 요금제 마스터 CRUD API 테스트
 * 
 * 테스트 순서:
 * 1. POST - 새 요금제 생성
 * 2. GET - 생성된 요금제 조회
 * 3. PUT - 요금제 수정
 * 4. GET - 수정된 요금제 조회
 * 5. DELETE - 요금제 삭제
 * 6. GET - 삭제 확인
 */

const axios = require('axios');

const API_BASE = 'http://localhost:4000/api/direct';
const TEST_CARRIER = 'LG';
const TEST_PLAN_NAME = '테스트요금제_' + Date.now();

async function testPlanMasterCRUD() {
  console.log('=== 요금제 마스터 CRUD 테스트 시작 ===\n');
  
  try {
    // 1. POST - 요금제 생성
    console.log('1. POST - 요금제 생성');
    const createData = {
      carrier: TEST_CARRIER,
      planName: TEST_PLAN_NAME,
      planGroup: '115군',
      basicFee: 115000,
      planCode: 'LG115TEST',
      isActive: true,
      note: 'CRUD 테스트용 요금제'
    };
    
    const createRes = await axios.post(`${API_BASE}/plans-master`, createData);
    console.log('✅ 생성 성공:', createRes.data);
    console.log('');
    
    // 2. GET - 생성된 요금제 조회
    console.log('2. GET - 생성된 요금제 조회');
    const getRes1 = await axios.get(`${API_BASE}/plans-master?carrier=${TEST_CARRIER}`);
    const createdPlan = getRes1.data.data.find(p => p.planName === TEST_PLAN_NAME);
    
    if (createdPlan) {
      console.log('✅ 조회 성공:', createdPlan);
    } else {
      console.log('❌ 생성된 요금제를 찾을 수 없습니다.');
      return;
    }
    console.log('');
    
    // 3. PUT - 요금제 수정
    console.log('3. PUT - 요금제 수정');
    const updateData = {
      basicFee: 120000,
      note: '수정된 테스트 요금제'
    };
    
    const updateRes = await axios.put(
      `${API_BASE}/plans-master/${TEST_CARRIER}/${encodeURIComponent(TEST_PLAN_NAME)}`,
      updateData
    );
    console.log('✅ 수정 성공:', updateRes.data);
    console.log('');
    
    // 4. GET - 수정된 요금제 조회
    console.log('4. GET - 수정된 요금제 조회');
    const getRes2 = await axios.get(`${API_BASE}/plans-master?carrier=${TEST_CARRIER}`);
    const updatedPlan = getRes2.data.data.find(p => p.planName === TEST_PLAN_NAME);
    
    if (updatedPlan) {
      console.log('✅ 조회 성공:', updatedPlan);
      console.log('   기본료 변경 확인:', updatedPlan.basicFee === 120000 ? '✅' : '❌');
      console.log('   비고 변경 확인:', updatedPlan.note === '수정된 테스트 요금제' ? '✅' : '❌');
    } else {
      console.log('❌ 수정된 요금제를 찾을 수 없습니다.');
    }
    console.log('');
    
    // 5. DELETE - 요금제 삭제
    console.log('5. DELETE - 요금제 삭제');
    const deleteRes = await axios.delete(
      `${API_BASE}/plans-master/${TEST_CARRIER}/${encodeURIComponent(TEST_PLAN_NAME)}`
    );
    console.log('✅ 삭제 성공:', deleteRes.data);
    console.log('');
    
    // 6. GET - 삭제 확인
    console.log('6. GET - 삭제 확인');
    const getRes3 = await axios.get(`${API_BASE}/plans-master?carrier=${TEST_CARRIER}`);
    const deletedPlan = getRes3.data.data.find(p => p.planName === TEST_PLAN_NAME);
    
    if (!deletedPlan) {
      console.log('✅ 삭제 확인: 요금제가 정상적으로 삭제되었습니다.');
    } else {
      console.log('❌ 삭제 실패: 요금제가 여전히 존재합니다.');
    }
    console.log('');
    
    console.log('=== 모든 테스트 완료 ===');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.response?.data || error.message);
    
    // 에러 발생 시 정리 작업
    try {
      console.log('\n정리 작업: 테스트 요금제 삭제 시도...');
      await axios.delete(
        `${API_BASE}/plans-master/${TEST_CARRIER}/${encodeURIComponent(TEST_PLAN_NAME)}`
      );
      console.log('✅ 정리 완료');
    } catch (cleanupError) {
      console.log('정리 작업 실패 (무시 가능):', cleanupError.message);
    }
  }
}

// 테스트 실행
testPlanMasterCRUD();
