// Simple logger with environment gating and throttling
import { API_BASE_URL } from '../api';

const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

let lastLogAt = 0;
const defaultThrottleMs = 1000; // 1s

function shouldLog(throttleMs = defaultThrottleMs) {
  const now = Date.now();
  if (now - lastLogAt >= throttleMs) {
    lastLogAt = now;
    return true;
  }
  return false;
}

// 🔥 태스크 12.1: 클라이언트 에러를 백엔드로 전송 (요구사항 7.5)
// 세션 ID 생성 (브라우저 세션당 고유 ID)
const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 로그 버퍼 (배치 전송을 위해)
let logBuffer = [];
const MAX_BUFFER_SIZE = 50;
const FLUSH_INTERVAL = 10000; // 10초마다 전송

// 백엔드로 로그 전송
const sendLogsToBackend = async (logs) => {
  if (!logs || logs.length === 0) return;
  
  try {
    await fetch(`${API_BASE_URL}/api/client-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        userAgent: navigator.userAgent,
        ts: Date.now(),
        logs
      })
    });
  } catch (e) {
    // 로그 전송 실패는 무시 (무한 루프 방지)
    console.debug('Failed to send logs to backend:', e.message);
  }
};

// 로그 버퍼에 추가
const addToBuffer = (level, msg, data) => {
  logBuffer.push({
    lv: level,
    ts: Date.now(),
    path: window.location.pathname,
    msg: typeof msg === 'string' ? msg : JSON.stringify(msg),
    data: data ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : undefined
  });
  
  // 버퍼가 가득 차면 즉시 전송
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    const logsToSend = [...logBuffer];
    logBuffer = [];
    sendLogsToBackend(logsToSend);
  }
};

// 주기적으로 로그 버퍼 전송
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (logBuffer.length > 0) {
      const logsToSend = [...logBuffer];
      logBuffer = [];
      sendLogsToBackend(logsToSend);
    }
  }, FLUSH_INTERVAL);
  
  // 페이지 언로드 시 남은 로그 전송
  window.addEventListener('beforeunload', () => {
    if (logBuffer.length > 0) {
      const logsToSend = [...logBuffer];
      logBuffer = [];
      // sendBeacon을 사용하여 비동기 전송 (페이지 언로드 시에도 전송 보장)
      navigator.sendBeacon(
        `${API_BASE_URL}/api/client-logs`,
        JSON.stringify({
          sessionId,
          userAgent: navigator.userAgent,
          ts: Date.now(),
          logs: logsToSend
        })
      );
    }
  });
}

export const logger = {
  debug: (msg, data, throttleMs = defaultThrottleMs) => {
    if (!isDev) return;
    if (!shouldLog(throttleMs)) return;
    // eslint-disable-next-line no-console
    console.debug(msg, data);
  },
  info: (msg, data) => {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.info(msg, data);
  },
  warn: (msg, data) => {
    // eslint-disable-next-line no-console
    console.warn(msg, data);
    // 경고도 백엔드로 전송 (요구사항 7.5)
    addToBuffer('WARN', msg, data);
  },
  error: (msg, data) => {
    // eslint-disable-next-line no-console
    console.error(msg, data);
    // 에러를 백엔드로 전송 (요구사항 7.5)
    addToBuffer('ERROR', msg, data);
  }
};


