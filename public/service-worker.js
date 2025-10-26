// VIP 앱 Service Worker - 안전한 버전
const CACHE_NAME = 'vip-app-cache-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

// 설치 시 캐시 생성
self.addEventListener('install', event => {
  console.log('Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 열기 성공');
        // 안전한 캐시 추가 - 실패해도 계속 진행
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(error => {
              console.warn(`캐시 실패 (무시): ${url}`, error);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('Service Worker 설치 완료');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker 설치 실패:', error);
      })
  );
});

// 활성화 시 이전 캐시 정리
self.addEventListener('activate', event => {
  console.log('Service Worker 활성화 중...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker 활성화 완료');
      return self.clients.claim();
    })
  );
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
  // POST 요청은 캐시하지 않음
  if (event.request.method === 'POST') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 성공한 응답만 캐시
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone).catch(error => {
              console.log('캐시 저장 실패 (무시):', error);
            });
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

// 푸시 알림 처리
self.addEventListener('push', event => {
  console.log('푸시 알림 수신:', event);
  
  const options = {
    body: '새로운 알림이 도착했습니다.',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'vip-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification('VIP 알림', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        return clients[0].focus();
      } else {
        return self.clients.openWindow('/');
      }
    })
  );
}); 