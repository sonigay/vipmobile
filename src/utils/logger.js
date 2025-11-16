// Simple logger with environment gating and throttling
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
  },
  error: (msg, data) => {
    // eslint-disable-next-line no-console
    console.error(msg, data);
  }
};


