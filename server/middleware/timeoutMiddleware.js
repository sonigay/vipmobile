/**
 * Timeout Middleware
 * 
 * 이 미들웨어는 모든 HTTP 요청에 대해 5분(300,000ms) 타임아웃을 설정합니다.
 * 타임아웃 발생 시 CORS 헤더를 포함한 504 Gateway Timeout 응답을 반환합니다.
 * 
 * 요구사항 참조: 3.1, 3.2, 12.3
 */

const { setBasicCORSHeaders } = require('../corsMiddleware');

/**
 * 타임아웃 미들웨어 함수
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 * @param {Function} next - Express next 함수
 */
function timeoutMiddleware(req, res, next) {
  const startTime = Date.now();
  const timeoutDuration = 300000; // 5분 (밀리초)
  
  // 요청 및 응답 타임아웃 설정 (요구사항 3.1)
  req.setTimeout(timeoutDuration);
  res.setTimeout(timeoutDuration);
  
  // 타임아웃 이벤트 핸들러 (요구사항 3.2, 12.3)
  req.on('timeout', () => {
    const elapsedTime = Date.now() - startTime;
    
    // CORS 헤더 설정 (요구사항 12.3)
    setBasicCORSHeaders(req, res);
    
    // 타임아웃 에러 로깅 (요구사항 12.3)
    console.error('⏱️ Request timeout:', {
      url: req.originalUrl,
      method: req.method,
      elapsedTime: `${elapsedTime}ms`,
      timeout: `${timeoutDuration}ms`
    });
    
    // 504 Gateway Timeout 응답 (요구사항 3.2)
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request exceeded 5 minute timeout',
        elapsedTime
      });
    }
  });
  
  next();
}

module.exports = timeoutMiddleware;
