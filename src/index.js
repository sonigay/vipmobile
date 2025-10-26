import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

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