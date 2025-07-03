// 버전 관리를 위한 캐시 이름 (날짜 기반)
const getCacheName = () => {
  const today = new Date();
  const dateStr = today.getFullYear() + 
    String(today.getMonth() + 1).padStart(2, '0') + 
    String(today.getDate()).padStart(2, '0');
  return `vipmap-cache-v${dateStr}`;
};

const CACHE_NAME = getCacheName();
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css'
];

// 설치 시 기존 캐시 모두 삭제
self.addEventListener('install', event => {
  console.log('Service Worker 설치 중 - 캐시 무효화 시작');
  event.waitUntil(
    // 기존 캐시 모두 삭제
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log(`기존 캐시 삭제: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // 새 캐시 생성
      return caches.open(CACHE_NAME);
    }).then(cache => {
      console.log(`새 캐시 생성: ${CACHE_NAME}`);
      return cache.addAll(urlsToCache);
    })
  );
});

// 네트워크 우선, 캐시 폴백 전략
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 네트워크 응답이 성공하면 캐시에 저장
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 가져오기
        return caches.match(event.request);
      })
  );
});

// 활성화 시 이전 캐시 정리
self.addEventListener('activate', event => {
  console.log('Service Worker 활성화 - 이전 캐시 정리');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`이전 캐시 삭제: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 메시지 처리 (앱에서 캐시 정리 요청 시)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
}); 