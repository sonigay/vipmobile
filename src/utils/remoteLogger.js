// 간단한 원격 로거: console 출력의 일부를 서버로 전송
// 사용: enableRemoteLogger({ enabled: true, sessionId, level: 'warn' })
import { API_BASE_URL } from '../api';
export function enableRemoteLogger(options = {}) {
  const {
    enabled = true,
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level = 'warn', // 'debug' | 'info' | 'warn' | 'error'
    apiBaseUrl = API_BASE_URL,
  } = options;
  if (!enabled) return () => {};
  const levels = ['debug', 'info', 'warn', 'error'];
  const minIdx = Math.max(0, levels.indexOf(level));
  const shouldSend = (lv) => levels.indexOf(lv) >= minIdx;

  const original = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  let queue = [];
  let timer = null;
  const flush = async () => {
    if (queue.length === 0) return;
    const batch = queue.splice(0, queue.length);
    try {
      await fetch(`${apiBaseUrl}/api/client-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          ts: Date.now(),
          logs: batch,
        }),
      });
    } catch {
      // 네트워크 실패는 조용히 무시
    }
  };
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 1500);
  };

  const wrap = (lv) => (...args) => {
    try {
      if (shouldSend(lv)) {
        queue.push({
          lv,
          ts: Date.now(),
          msg: args
            .map((a) => {
              try {
                if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
                if (typeof a === 'object') return JSON.stringify(a);
                return String(a);
              } catch {
                return String(a);
              }
            })
            .join(' '),
          path: typeof location !== 'undefined' ? location.pathname + location.search : '',
        });
        if (queue.length >= 10) {
          flush();
        } else {
          schedule();
        }
      }
    } catch {}
    try {
      original[lv](...args);
    } catch {}
  };

  console.debug = wrap('debug');
  console.info = wrap('info');
  console.warn = wrap('warn');
  console.error = wrap('error');

  // 해제 함수 반환
  return () => {
    console.debug = original.debug;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    if (timer) clearTimeout(timer);
    queue = [];
  };
}


