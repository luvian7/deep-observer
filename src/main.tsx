import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'tdesign-react/esm/style/index.js';
import './index.css';

document.title = '深观 · 深度观察自己';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service Worker 已注册:', registration.scope);
        // 每小时检查一次更新
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
        // 监听更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                if (confirm('深观有新版本可用，是否立即更新？')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service Worker 注册失败:', error);
      });
  });
}
