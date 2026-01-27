/**
 * errorCollector.js
 * 프론트엔드 에러 수집 유틸리티
 * 
 * 기능:
 * - console.error 인터셉트
 * - window.onerror / unhandledrejection 캡처
 * - fetch 실패 감지
 * - 에러를 백엔드로 전송
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// 에러 큐 (배치 전송용)
let errorQueue = [];
let flushTimer = null;

// 현재 모드 (외부에서 설정)
let currentMode = '';
let currentUserId = '';

/**
 * 에러 수집기 초기화
 */
export const initErrorCollector = (options = {}) => {
    const {
        mode = '',
        userId = '',
        captureConsoleErrors = true,
        captureNetworkErrors = true,
        captureUnhandledErrors = true,
        flushInterval = 5000
    } = options;

    currentMode = mode;
    currentUserId = userId;

    // console.error 인터셉트
    if (captureConsoleErrors) {
        const originalConsoleError = console.error;
        console.error = (...args) => {
            captureError({
                type: 'frontend',
                level: 'error',
                message: args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' '),
                source: 'console.error'
            });
            originalConsoleError.apply(console, args);
        };

        // console.warn도 캡처 (선택적)
        const originalConsoleWarn = console.warn;
        console.warn = (...args) => {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            // MUI 경고 등 중요 경고만 캡처
            if (message.includes('MUI:') || message.includes('Warning:')) {
                captureError({
                    type: 'frontend',
                    level: 'warning',
                    message,
                    source: 'console.warn'
                });
            }
            originalConsoleWarn.apply(console, args);
        };
    }

    // window.onerror (전역 에러)
    if (captureUnhandledErrors) {
        window.onerror = (message, source, lineNumber, columnNumber, error) => {
            captureError({
                type: 'frontend',
                level: 'error',
                message: typeof message === 'string' ? message : error?.message || 'Unknown error',
                stack: error?.stack,
                source,
                lineNumber,
                columnNumber
            });
            return false; // 기본 에러 처리 계속
        };

        // unhandledrejection (Promise 에러)
        window.addEventListener('unhandledrejection', (event) => {
            captureError({
                type: 'frontend',
                level: 'error',
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                source: 'unhandledrejection'
            });
        });
    }

    // fetch 인터셉트 (네트워크 에러)
    if (captureNetworkErrors) {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            const method = args[1]?.method || 'GET';

            try {
                const response = await originalFetch.apply(window, args);

                // 4xx, 5xx 에러 캡처
                if (!response.ok && response.status >= 400) {
                    let responseBody = '';
                    try {
                        responseBody = await response.clone().text();
                    } catch (e) {
                        // 응답 본문 읽기 실패
                    }

                    captureError({
                        type: 'network',
                        level: response.status >= 500 ? 'error' : 'warning',
                        message: `HTTP ${response.status}: ${response.statusText}`,
                        apiEndpoint: url,
                        statusCode: response.status,
                        requestMethod: method,
                        responseBody: responseBody.substring(0, 1000)
                    });
                }

                return response;
            } catch (error) {
                // 네트워크 자체 실패 (CORS, 연결 끊김 등)
                captureError({
                    type: 'network',
                    level: 'error',
                    message: error.message || 'Network request failed',
                    stack: error.stack,
                    apiEndpoint: url,
                    requestMethod: method
                });
                throw error;
            }
        };
    }

    // 주기적 플러시
    if (flushInterval > 0) {
        flushTimer = setInterval(flushErrors, flushInterval);
    }

    console.log('[ErrorCollector] Initialized with mode:', mode);
};

/**
 * 에러 수집 (큐에 추가)
 */
export const captureError = (errorData) => {
    const enrichedError = {
        ...errorData,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: currentUserId,
        mode: currentMode,
        timestamp: new Date().toISOString()
    };

    errorQueue.push(enrichedError);

    // 에러가 10개 이상이면 즉시 플러시
    if (errorQueue.length >= 10) {
        flushErrors();
    }
};

/**
 * 에러 큐를 서버로 전송
 */
export const flushErrors = async () => {
    if (errorQueue.length === 0) return;

    const errorsToSend = [...errorQueue];
    errorQueue = [];

    try {
        for (const error of errorsToSend) {
            await fetch(`${API_BASE_URL}/api/errors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(error)
            }).catch(() => {
                // 에러 로깅 자체가 실패해도 무시
            });
        }
    } catch (e) {
        // 에러 전송 실패 - 무시 (무한 루프 방지)
    }
};

/**
 * 현재 모드 업데이트
 */
export const setErrorCollectorMode = (mode) => {
    currentMode = mode;
};

/**
 * 현재 사용자 ID 업데이트
 */
export const setErrorCollectorUserId = (userId) => {
    currentUserId = userId;
};

/**
 * React Error Boundary에서 사용
 */
export const captureReactError = (error, errorInfo) => {
    captureError({
        type: 'react',
        level: 'error',
        message: error.message || String(error),
        stack: error.stack,
        source: 'ErrorBoundary',
        metadata: {
            componentStack: errorInfo?.componentStack
        }
    });
};

/**
 * 수동 에러 로깅 (개발자가 직접 호출)
 */
export const logError = (message, metadata = {}) => {
    captureError({
        type: 'frontend',
        level: 'error',
        message,
        source: 'manual',
        metadata
    });
};

/**
 * 수동 경고 로깅
 */
export const logWarning = (message, metadata = {}) => {
    captureError({
        type: 'frontend',
        level: 'warning',
        message,
        source: 'manual',
        metadata
    });
};

/**
 * 에러 수집기 정리
 */
export const cleanupErrorCollector = () => {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    flushErrors(); // 남은 에러 전송
};

export default {
    initErrorCollector,
    captureError,
    captureReactError,
    logError,
    logWarning,
    setErrorCollectorMode,
    setErrorCollectorUserId,
    flushErrors,
    cleanupErrorCollector
};
