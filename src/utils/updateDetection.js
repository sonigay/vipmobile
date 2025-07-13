// 새로운 배포 감지 및 자동 로그아웃 시스템

// 빌드 시점 기반 버전 체크
const BUILD_VERSION_KEY = 'buildVersion';
const LAST_CHECK_KEY = 'lastUpdateCheck';

// 현재 빌드 버전 (Service Worker에서 가져오기)
const getCurrentBuildVersion = () => {
  return new Promise((resolve) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data && event.data.version) {
          resolve(event.data.version);
        } else {
          resolve(Date.now().toString());
        }
      };
      
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_BUILD_VERSION' },
        [channel.port2]
      );
      
      // 타임아웃 설정
      setTimeout(() => {
        resolve(Date.now().toString());
      }, 1000);
    } else {
      resolve(Date.now().toString());
    }
  });
};

// 저장된 빌드 버전 가져오기
export const getStoredBuildVersion = () => {
  try {
    return localStorage.getItem(BUILD_VERSION_KEY) || '0';
  } catch (error) {
    console.error('저장된 빌드 버전 조회 실패:', error);
    return '0';
  }
};

// 빌드 버전 저장
export const setStoredBuildVersion = (version) => {
  try {
    localStorage.setItem(BUILD_VERSION_KEY, version);
  } catch (error) {
    console.error('빌드 버전 저장 실패:', error);
  }
};

// 새로운 배포가 있는지 확인
export const hasNewDeployment = async () => {
  try {
    const currentVersion = await getCurrentBuildVersion();
    const storedVersion = getStoredBuildVersion();
    
    // console.log('배포 버전 체크:', { currentVersion, storedVersion });
    
    // 버전이 다르고, 저장된 버전이 '0'이 아닌 경우에만 새로운 배포로 간주
    const hasNew = currentVersion !== storedVersion && storedVersion !== '0';
    
    if (hasNew) {
      // console.log('새로운 배포 감지됨');
    } else {
      // console.log('새로운 배포 없음 또는 초기 로드');
    }
    
    return hasNew;
  } catch (error) {
    console.error('배포 감지 중 오류:', error);
    return false;
  }
};

// 자동 로그아웃 실행
export const performAutoLogout = async () => {
  try {
    // console.log('새로운 배포 감지 - 자동 로그아웃 실행');
    
    // 현재 빌드 버전 저장 (로그아웃 전에 저장)
    const currentVersion = await getCurrentBuildVersion();
    setStoredBuildVersion(currentVersion);
    
    // 로그인 상태 삭제
    localStorage.removeItem('loginState');
    
    // 기타 관련 데이터 삭제 (업데이트 버전 정보는 보존)
    localStorage.removeItem('userIpInfo');
    // localStorage.removeItem('lastUpdateVersion'); // 업데이트 버전 정보 보존
    // localStorage.removeItem('hideUpdateUntilDate'); // 업데이트 숨김 설정 보존
    
    // console.log('자동 로그아웃 완료 (업데이트 버전 정보 보존)');
    return true;
  } catch (error) {
    console.error('자동 로그아웃 실패:', error);
    return false;
  }
};

// 업데이트 체크 시간 관리
export const shouldCheckForUpdates = () => {
  try {
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    if (!lastCheck) return true;
    
    const lastCheckTime = parseInt(lastCheck);
    const currentTime = Date.now();
    const checkInterval = 5 * 60 * 1000; // 5분마다 체크
    
    return (currentTime - lastCheckTime) > checkInterval;
  } catch (error) {
    console.error('업데이트 체크 시간 확인 실패:', error);
    return true;
  }
};

// 업데이트 체크 시간 기록
export const setLastUpdateCheck = () => {
  try {
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch (error) {
    console.error('업데이트 체크 시간 기록 실패:', error);
  }
};

// Service Worker 업데이트 감지
export const checkServiceWorkerUpdate = () => {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve(false);
      return;
    }

    navigator.serviceWorker.getRegistrations().then(registrations => {
      let hasUpdate = false;
      
      registrations.forEach(registration => {
        if (registration.waiting) {
          hasUpdate = true;
          // console.log('Service Worker 업데이트 대기 중');
        }
      });
      
      resolve(hasUpdate);
    }).catch(error => {
      console.error('Service Worker 업데이트 체크 실패:', error);
      resolve(false);
    });
  });
};

// 강제 업데이트 실행
export const forceUpdate = () => {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve(false);
      return;
    }

    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        if (registration.waiting) {
          // 대기 중인 Service Worker에게 활성화 요청
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // 페이지 새로고침
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          
          resolve(true);
        }
      });
      
      resolve(false);
    }).catch(error => {
      console.error('강제 업데이트 실패:', error);
      resolve(false);
    });
  });
}; 