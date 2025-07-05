// 버전 관리를 위한 캐시 이름 (빌드 시점 기반)
const getCacheName = () => {
  // 빌드 시점의 타임스탬프를 사용하여 고유한 캐시 이름 생성
  const buildTime = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `vipmap-cache-v${buildTime}-${randomSuffix}`;
};

const CACHE_NAME = getCacheName();
const BUILD_VERSION = Date.now().toString(); // 빌드 버전 정보
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
    }).then(() => {
      // 강제로 새로운 서비스 워커 활성화
      return self.skipWaiting();
    })
  );
});

// 네트워크 우선, 캐시 폴백 전략 (강화된 캐시 무효화)
self.addEventListener('fetch', event => {
  // HTML 파일과 JS 파일은 항상 네트워크에서 가져오기
  if (event.request.url.includes('/index.html') || 
      event.request.url.includes('/static/js/') ||
      event.request.url.includes('/static/css/')) {
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
  } else {
    // 다른 리소스는 기존 전략 유지
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});

// 활성화 시 이전 캐시 정리 및 페이지 제어
self.addEventListener('activate', event => {
  console.log('Service Worker 활성화 - 이전 캐시 정리 및 페이지 제어');
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
    }).then(() => {
      // 새로운 배포 감지 시 모든 클라이언트에게 알림
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'AUTO_LOGOUT_REQUIRED',
            buildVersion: BUILD_VERSION
          });
        });
      });
      
      // 모든 클라이언트 페이지에 새로고침 요청
      return self.clients.claim();
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
  
  // 빌드 버전 정보 요청
  if (event.data && event.data.type === 'GET_BUILD_VERSION') {
    event.ports[0].postMessage({ version: BUILD_VERSION });
  }
  
  // 새로운 배포 감지 시 자동 로그아웃
  if (event.data && event.data.type === 'NEW_DEPLOYMENT_DETECTED') {
    // 모든 클라이언트에게 새 배포 알림
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'AUTO_LOGOUT_REQUIRED',
          buildVersion: BUILD_VERSION
        });
      });
    });
  }
}); 