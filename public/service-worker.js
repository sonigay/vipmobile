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
  // POST 요청은 캐시하지 않음
  if (event.request.method === 'POST') {
    event.respondWith(fetch(event.request));
    return;
  }
  
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
              cache.put(event.request, responseClone).catch(error => {
                console.log('캐시 저장 실패 (무시):', error);
              });
            }).catch(error => {
              console.log('캐시 열기 실패 (무시):', error);
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
              cache.put(event.request, responseClone).catch(error => {
                console.log('캐시 저장 실패 (무시):', error);
              });
            }).catch(error => {
              console.log('캐시 열기 실패 (무시):', error);
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
      // 모든 클라이언트 페이지에 새로고침 요청 (자동 로그아웃 제거)
      return self.clients.claim();
    })
  );
});

// 푸시 알림 수신 처리
self.addEventListener('push', event => {
  console.log('푸시 알림 수신 시작:', {
    hasData: !!event.data,
    dataType: event.data ? typeof event.data : 'none'
  });
  
  let notificationData = {
    title: '새로운 알림',
    body: '새로운 알림이 도착했습니다.',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'assignment-notification',
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // 푸시 데이터가 있으면 파싱
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('푸시 데이터 파싱 성공:', data);
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (error) {
      console.error('푸시 데이터 파싱 오류:', error);
      // 파싱 실패 시 텍스트로 읽기 시도
      try {
        const textData = event.data.text();
        console.log('푸시 데이터 텍스트:', textData);
      } catch (textError) {
        console.error('푸시 데이터 텍스트 읽기 실패:', textError);
      }
    }
  }
  
  console.log('최종 알림 데이터:', notificationData);
  
  // 사운드 알림 재생 (Service Worker에서는 Audio 객체 사용 불가)
  const playNotificationSound = () => {
    try {
      // Service Worker에서는 Audio 객체를 직접 사용할 수 없으므로
      // 클라이언트에게 사운드 재생을 요청
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'PLAY_NOTIFICATION_SOUND',
            soundUrl: '/sounds/notification.mp3'
          });
        });
      });
    } catch (error) {
      console.log('사운드 재생 요청 실패:', error);
    }
  };
  
  // 알림 표시
  event.waitUntil(
    Promise.all([
      // 사운드 재생
      playNotificationSound(),
      // 알림 표시
      self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        tag: notificationData.tag,
        data: notificationData.data,
        requireInteraction: false, // 자동으로 사라지도록 변경
        silent: false, // 기본 브라우저 알림음도 재생
        vibrate: [200, 100, 200], // 진동 추가
        actions: [
          {
            action: 'view',
            title: '확인',
            icon: '/logo192.png'
          },
          {
            action: 'dismiss',
            title: '닫기'
          }
        ]
      }).then(() => {
        console.log('알림 표시 완료');
      }).catch(error => {
        console.error('알림 표시 실패:', error);
      })
    ])
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  console.log('알림 클릭:', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // 앱 열기 또는 포커스
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // 이미 열린 창이 있으면 포커스
      for (let client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // 열린 창이 없으면 새 창 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// 알림 닫기 처리
self.addEventListener('notificationclose', event => {
  console.log('알림 닫힘:', event);
  
  // 알림이 닫힐 때 클라이언트에게 알림
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_CLOSED',
        notificationId: event.notification.tag
      });
    });
  });
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
  
  // 푸시 알림 구독 요청
  if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    event.waitUntil(
      self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.data.applicationServerKey
      }).then(subscription => {
        // 구독 정보를 클라이언트에게 전달
        event.ports[0].postMessage({
          type: 'PUSH_SUBSCRIPTION_SUCCESS',
          subscription: subscription
        });
      }).catch(error => {
        console.error('푸시 구독 실패:', error);
        event.ports[0].postMessage({
          type: 'PUSH_SUBSCRIPTION_ERROR',
          error: error.message
        });
      })
    );
  }
  
  // 푸시 알림 구독 해제 요청
  if (event.data && event.data.type === 'UNSUBSCRIBE_PUSH') {
    event.waitUntil(
      self.registration.pushManager.getSubscription().then(subscription => {
        if (subscription) {
          return subscription.unsubscribe();
        }
      }).then(() => {
        event.ports[0].postMessage({
          type: 'PUSH_UNSUBSCRIPTION_SUCCESS'
        });
      }).catch(error => {
        console.error('푸시 구독 해제 실패:', error);
        event.ports[0].postMessage({
          type: 'PUSH_UNSUBSCRIPTION_ERROR',
          error: error.message
        });
      })
    );
  }
}); 