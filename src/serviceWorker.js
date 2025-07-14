const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('Service Worker 등록 성공:', registration);
      
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('새로운 컨텐츠가 사용 가능합니다. 앱을 완전히 종료해주세요.');
              
              // 완전한 앱 종료 안내
              if (typeof window !== 'undefined') {
                alert(
                  '업데이트가 완료되었습니다.\n\n' +
                  '앱을 완전히 종료하고 다시 실행해주세요.\n\n' +
                  '이 창을 닫고 앱을 다시 열어주세요.'
                );
                
                // 3초 후 자동으로 창 닫기 시도
                setTimeout(() => {
                  try {
                    window.close();
                  } catch (error) {
                    console.log('자동 창 닫기 실패 - 사용자가 수동으로 닫아주세요');
                  }
                }, 3000);
              }
              
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('컨텐츠가 오프라인 사용을 위해 캐시되었습니다.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
      
      // Service Worker 메시지 리스너 추가
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_CLEARED') {
          console.log('Service Worker 캐시 정리 완료');
        }
      });
    })
    .catch((error) => {
      console.error('서비스 워커 등록 중 에러 발생:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('인터넷 연결이 없습니다. 앱이 오프라인 모드로 실행됩니다.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
} 