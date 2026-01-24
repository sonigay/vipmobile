/**
 * Error Middleware
 * 
 * Express 에러 처리 미들웨어입니다.
 * 모든 라우트에서 발생한 에러를 캐치하여 일관된 형식으로 응답합니다.
 * 
 * 특징:
 * - 일관된 에러 응답 형식 제공
 * - 개발 환경에서는 스택 트레이스 포함
 * - 프로덕션 환경에서는 스택 트레이스 제외
 * - 에러 로깅
 * 
 * 사용법:
 * - 모든 라우트 등록 후 마지막에 등록해야 합니다
 * - app.use(errorMiddleware);
 * 
 * Requirements: 3.5, 12.1
 * 
 * @module middleware/errorMiddleware
 */

/**
 * Express 에러 처리 미들웨어
 * 
 * @param {Error} err - 발생한 에러 객체
 * @param {import('express').Request} req - Express 요청 객체
 * @param {import('express').Response} res - Express 응답 객체
 * @param {import('express').NextFunction} next - Express next 함수
 * @returns {void}
 * 
 * @example
 * // index.js에서 사용
 * const errorMiddleware = require('./middleware/errorMiddleware');
 * 
 * // 모든 라우트 등록 후
 * app.use(errorMiddleware);
 */
function errorMiddleware(err, req, res, next) {
  // 에러 로깅
  console.error('❌ Unhandled error:', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  // 상태 코드 결정 (기본값: 500)
  const statusCode = err.statusCode || 500;

  // 에러 응답 객체 생성
  const errorResponse = {
    success: false,
    error: err.message || 'Internal server error'
  };

  // 개발 환경에서만 스택 트레이스 포함
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // 응답 전송
  res.status(statusCode).json(errorResponse);
}

module.exports = errorMiddleware;
