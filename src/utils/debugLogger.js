/**
 * 디버그 로거 유틸리티
 * 개발 환경에서만 로그를 출력하도록 관리
 */

const isDevelopment = process.env.NODE_ENV === 'development' ||
  process.env.REACT_APP_ENV === 'development' ||
  !process.env.NODE_ENV; // 기본값은 개발 환경으로 간주

/**
 * 디버그 로그를 개발 환경에서만 출력
 * @param {string} location - 로그 위치
 * @param {string} message - 로그 메시지
 * @param {object} data - 로그 데이터
 * @param {string} sessionId - 세션 ID
 * @param {string} runId - 실행 ID
 * @param {string} hypothesisId - 가설 ID
 */
export const debugLog = (location, message, data = {}, sessionId = 'debug-session', runId = 'run1', hypothesisId = 'H1') => {
  if (!isDevelopment) {
    return; // 프로덕션 환경에서는 로그 출력 안 함
  }

  // 로컬 로깅 서버(port 7242)로의 전송 코드 제거됨
  // try {
  //   fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', {
  //     ...
  //   }).catch(() => {});
  // } catch (error) {}
};

/**
 * 콘솔 로그를 개발 환경에서만 출력
 * @param {...any} args - 로그 인자
 */
export const consoleLog = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * 콘솔 경고를 개발 환경에서만 출력
 * @param {...any} args - 경고 인자
 */
export const consoleWarn = (...args) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * 콘솔 에러를 개발 환경에서만 출력 (에러는 항상 출력)
 * @param {...any} args - 에러 인자
 */
export const consoleError = (...args) => {
  // 에러는 항상 출력 (개발/프로덕션 모두)
  console.error(...args);
};
