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
// Service Worker 에러 방지를 위해 완전 비활성화
// serviceWorker.register();
console.log('Service Worker 비활성화 (에러 방지)'); 