/**
 * Logging Middleware
 * 
 * 이 미들웨어는 모든 HTTP 요청과 응답을 콘솔에 로깅합니다.
 * 요청 정보(메서드, URL, IP)와 응답 정보(상태 코드, 응답 시간)를 기록합니다.
 * 
 * 개발 환경에서는 상세한 로그를, 프로덕션 환경에서는 간결한 로그를 출력합니다.
 * 
 * 요구사항 참조: 3.3
 */

/**
 * 로깅 미들웨어 함수
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 * @param {Function} next - Express next 함수
 */
function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress;

  // 요청 로깅 (요구사항 3.3)
  if (process.env.NODE_ENV === 'development') {
    // 개발 환경: 상세 로그
    console.log(`📡 [${timestamp}] ${method} ${url}`);
    console.log(`   IP: ${ip}`);
    console.log(`   User-Agent: ${userAgent}`);
  } else {
    // 프로덕션 환경: 간결한 로그
    console.log(`📡 [${timestamp}] ${method} ${url} - IP: ${ip}`);
  }

  // 응답 완료 시 로깅 (요구사항 3.3)
  res.on('finish', () => {
    const statusCode = res.statusCode;
    const responseTime = Date.now() - startTime;
    
    // 상태 코드에 따른 이모지 선택
    let emoji = '✅';
    if (statusCode >= 500) {
      emoji = '❌';
    } else if (statusCode >= 400) {
      emoji = '⚠️';
    } else if (statusCode >= 300) {
      emoji = '🔄';
    }

    if (process.env.NODE_ENV === 'development') {
      // 개발 환경: 상세 로그
      console.log(`${emoji} [${timestamp}] ${method} ${url}`);
      console.log(`   Status: ${statusCode}`);
      console.log(`   Response Time: ${responseTime}ms`);
    } else {
      // 프로덕션 환경: 간결한 로그
      console.log(`${emoji} [${timestamp}] ${method} ${url} - ${statusCode} - ${responseTime}ms`);
    }
  });

  // 요청 시작 시간 저장 (응답 시간 측정용)
  req.startTime = startTime;
  
  next();
}

module.exports = loggingMiddleware;
