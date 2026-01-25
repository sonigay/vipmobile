/**
 * Error Response Utility
 * 
 * 일관된 에러 응답 형식을 제공합니다.
 * 
 * 표준 에러 응답 형식:
 * {
 *   success: false,
 *   error: "사용자 친화적 에러 메시지",
 *   details: "기술적 상세 정보 (선택적)",
 *   code: "ERROR_CODE (선택적)"
 * }
 */

/**
 * 표준화된 에러 응답 생성
 * 
 * @param {Object} res - Express response 객체
 * @param {number} statusCode - HTTP 상태 코드 (400, 500 등)
 * @param {string} message - 사용자 친화적 에러 메시지
 * @param {Error|string} [error] - 원본 에러 객체 또는 상세 메시지
 * @param {string} [code] - 에러 코드 (선택적)
 */
function sendError(res, statusCode, message, error = null, code = null) {
  const response = {
    success: false,
    error: message
  };

  // 상세 정보 추가 (개발 환경에서만 또는 명시적으로 제공된 경우)
  if (error) {
    if (error instanceof Error) {
      response.details = error.message;
      
      // 개발 환경에서는 스택 트레이스도 포함
      if (process.env.NODE_ENV === 'development') {
        response.stack = error.stack;
      }
    } else if (typeof error === 'string') {
      response.details = error;
    }
  }

  // 에러 코드 추가 (선택적)
  if (code) {
    response.code = code;
  }

  res.status(statusCode).json(response);
}

/**
 * 400 Bad Request 에러 응답
 */
function sendBadRequest(res, message, details = null) {
  sendError(res, 400, message, details, 'BAD_REQUEST');
}

/**
 * 401 Unauthorized 에러 응답
 */
function sendUnauthorized(res, message = '인증이 필요합니다.', details = null) {
  sendError(res, 401, message, details, 'UNAUTHORIZED');
}

/**
 * 403 Forbidden 에러 응답
 */
function sendForbidden(res, message = '접근 권한이 없습니다.', details = null) {
  sendError(res, 403, message, details, 'FORBIDDEN');
}

/**
 * 404 Not Found 에러 응답
 */
function sendNotFound(res, message = '요청한 리소스를 찾을 수 없습니다.', details = null) {
  sendError(res, 404, message, details, 'NOT_FOUND');
}

/**
 * 500 Internal Server Error 에러 응답
 */
function sendInternalError(res, message = '서버 내부 오류가 발생했습니다.', error = null) {
  sendError(res, 500, message, error, 'INTERNAL_ERROR');
}

/**
 * 503 Service Unavailable 에러 응답
 */
function sendServiceUnavailable(res, message = '서비스를 일시적으로 사용할 수 없습니다.', details = null) {
  sendError(res, 503, message, details, 'SERVICE_UNAVAILABLE');
}

/**
 * Google Sheets 클라이언트 없음 에러
 */
function sendSheetsUnavailable(res) {
  sendServiceUnavailable(
    res,
    'Google Sheets 서비스를 사용할 수 없습니다. 환경 변수를 확인해주세요.',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SHEET_ID가 설정되어 있는지 확인하세요.'
  );
}

/**
 * Rate Limit 초과 에러
 */
function sendRateLimitError(res, message = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.') {
  sendError(res, 429, message, null, 'RATE_LIMIT_EXCEEDED');
}

/**
 * 에러 로깅 헬퍼
 * 
 * @param {string} category - 에러 카테고리 (예: '로그인', '매장조회')
 * @param {string} message - 에러 메시지
 * @param {Error} error - 에러 객체
 */
function logError(category, message, error) {
  console.error(`❌ [${category}] ${message}:`, error);
  
  // 개발 환경에서는 스택 트레이스도 출력
  if (process.env.NODE_ENV === 'development' && error && error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * 성공 응답 헬퍼
 * 
 * @param {Object} res - Express response 객체
 * @param {*} data - 응답 데이터
 * @param {string} [message] - 성공 메시지 (선택적)
 */
function sendSuccess(res, data, message = null) {
  const response = {
    success: true
  };

  if (message) {
    response.message = message;
  }

  // data가 객체인 경우 펼쳐서 추가
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    Object.assign(response, data);
  } else {
    response.data = data;
  }

  res.json(response);
}

module.exports = {
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendInternalError,
  sendServiceUnavailable,
  sendSheetsUnavailable,
  sendRateLimitError,
  logError,
  sendSuccess
};
