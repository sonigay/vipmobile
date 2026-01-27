import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

import { initErrorCollector } from './utils/errorCollector';

// 에러 모니터링 시스템 초기화
initErrorCollector({
  captureConsoleErrors: true,
  captureNetworkErrors: true,
  captureUnhandledErrors: true,
  flushInterval: 5000 // 5초마다 에러 전송
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA 기능을 활성화하려면 register()를 호출하세요.
// Service Worker 안전한 버전으로 다시 활성화
serviceWorker.register();
console.log('Service Worker 안전한 버전 활성화'); 