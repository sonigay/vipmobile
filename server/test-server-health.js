/**
 * 서버 Health Check 테스트
 * 
 * Cloudtype 배포 후 서버가 정상 작동하는지 확인
 */

const axios = require('axios');

// 테스트할 서버 URL (환경에 맞게 수정)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, method = 'GET', data = null) {
  try {
    log(`\n테스트: ${name}`, 'blue');
    log(`URL: ${url}`, 'yellow');
    
    const startTime = Date.now();
    const config = {
      method,
      url,
      timeout: 10000
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    log(`✅ 성공 (${duration}ms)`, 'green');
    log(`상태 코드: ${response.status}`);
    
    if (response.data) {
      const dataStr = JSON.stringify(response.data, null, 2);
      if (dataStr.length > 500) {
        log(`응답 데이터: ${dataStr.substring(0, 500)}...`, 'yellow');
      } else {
        log(`응답 데이터: ${dataStr}`, 'yellow');
      }
    }
    
    return { success: true, duration, status: response.status };
  } catch (error) {
    log(`❌ 실패`, 'red');
    if (error.response) {
      log(`상태 코드: ${error.response.status}`, 'red');
      log(`에러 메시지: ${JSON.stringify(error.response.data)}`, 'red');
    } else if (error.request) {
      log(`서버 응답 없음 (타임아웃 또는 연결 실패)`, 'red');
    } else {
      log(`에러: ${error.message}`, 'red');
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('='.repeat(60), 'blue');
  log('서버 Health Check 테스트 시작', 'blue');
  log('='.repeat(60), 'blue');
  log(`서버 URL: ${SERVER_URL}\n`, 'yellow');
  
  const results = [];
  
  // 1. Health Check
  results.push(await testEndpoint(
    'Health Check',
    `${SERVER_URL}/health`
  ));
  
  // 2. 팀 목록 조회
  results.push(await testEndpoint(
    '팀 목록 조회',
    `${SERVER_URL}/api/teams`
  ));
  
  // 3. 매장 목록 조회
  results.push(await testEndpoint(
    '매장 목록 조회',
    `${SERVER_URL}/api/stores`
  ));
  
  // 4. 모델 목록 조회
  results.push(await testEndpoint(
    '모델 목록 조회',
    `${SERVER_URL}/api/models`
  ));
  
  // 5. 정책공지사항 조회
  results.push(await testEndpoint(
    '정책공지사항 조회',
    `${SERVER_URL}/api/policy-notices`
  ));
  
  // 6. 캐시 상태 조회
  results.push(await testEndpoint(
    '캐시 상태 조회',
    `${SERVER_URL}/api/cache/stats`
  ));
  
  // 결과 요약
  log('\n' + '='.repeat(60), 'blue');
  log('테스트 결과 요약', 'blue');
  log('='.repeat(60), 'blue');
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = ((successCount / totalCount) * 100).toFixed(1);
  
  log(`\n총 테스트: ${totalCount}개`, 'yellow');
  log(`성공: ${successCount}개`, 'green');
  log(`실패: ${totalCount - successCount}개`, 'red');
  log(`성공률: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');
  
  if (successRate === '100.0') {
    log('\n🎉 모든 테스트 통과! 서버가 정상 작동합니다.', 'green');
  } else {
    log('\n⚠️  일부 테스트 실패. 로그를 확인하세요.', 'yellow');
  }
  
  // 평균 응답 시간
  const successResults = results.filter(r => r.success && r.duration);
  if (successResults.length > 0) {
    const avgDuration = successResults.reduce((sum, r) => sum + r.duration, 0) / successResults.length;
    log(`평균 응답 시간: ${avgDuration.toFixed(0)}ms`, 'yellow');
  }
  
  log('\n' + '='.repeat(60), 'blue');
}

// 실행
runTests().catch(error => {
  log(`\n치명적 에러: ${error.message}`, 'red');
  process.exit(1);
});
