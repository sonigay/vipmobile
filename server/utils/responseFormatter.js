/**
 * Response Formatter Utility
 * 
 * 표준화된 API 응답 형식을 제공하는 유틸리티 모듈입니다.
 * 모든 라우트 모듈에서 일관된 응답 형식을 사용할 수 있도록 합니다.
 * 
 * Requirements: 9.3
 */

/**
 * 성공 응답 형식을 생성합니다.
 * 
 * @param {*} data - 응답 데이터
 * @param {string|null} message - 선택적 메시지
 * @returns {Object} 표준화된 성공 응답 객체
 * 
 * @example
 * successResponse({ users: [...] })
 * // { success: true, data: { users: [...] } }
 * 
 * @example
 * successResponse({ id: 123 }, 'User created successfully')
 * // { success: true, data: { id: 123 }, message: 'User created successfully' }
 */
function successResponse(data, message = null) {
  return {
    success: true,
    data,
    ...(message && { message })
  };
}

/**
 * 에러 응답 형식을 생성합니다.
 * 
 * @param {string|Error} error - 에러 메시지 또는 Error 객체
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 * @returns {Object} 표준화된 에러 응답 객체
 * 
 * @example
 * errorResponse('User not found', 404)
 * // { success: false, error: 'User not found', statusCode: 404 }
 * 
 * @example
 * errorResponse(new Error('Database connection failed'))
 * // { success: false, error: 'Database connection failed', statusCode: 500 }
 */
function errorResponse(error, statusCode = 500) {
  return {
    success: false,
    error: error.message || error || 'Internal server error',
    statusCode
  };
}

module.exports = {
  successResponse,
  errorResponse
};
