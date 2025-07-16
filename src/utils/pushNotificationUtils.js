// 푸시 알림 관리 유틸리티

const API_URL = process.env.REACT_APP_API_URL;

// VAPID 공개키를 URL-safe base64에서 Uint8Array로 변환
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 푸시 알림 구독
export async function subscribeToPushNotifications(userId) {
  try {
    // console.log('푸시 알림 구독 시작 - userId:', userId);
    
    if (!userId) {
      throw new Error('사용자 ID가 제공되지 않았습니다.');
    }
    
    if (!API_URL) {
      throw new Error('API URL이 설정되지 않았습니다.');
    }
    
    // 1. VAPID 공개키 가져오기
    // console.log('VAPID 공개키 요청 중...');
    const response = await fetch(`${API_URL}/api/push/vapid-public-key`);
    
    if (!response.ok) {
      throw new Error(`VAPID 공개키 요청 실패: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    // console.log('VAPID 응답:', data);
    
    if (!data.success || !data.publicKey) {
      throw new Error('VAPID 공개키를 가져올 수 없습니다.');
    }
    
    const { publicKey } = data;
    // console.log('VAPID 공개키 획득 성공');
    
    // 2. Service Worker 등록 확인
    if (!('serviceWorker' in navigator)) {
      throw new Error('이 브라우저는 Service Worker를 지원하지 않습니다.');
    }
    
    if (!('PushManager' in window)) {
      throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
    }
    
    // console.log('Service Worker 등록 중...');
    const registration = await navigator.serviceWorker.ready;
    // console.log('Service Worker 등록 완료:', registration);
    
    // 3. 기존 구독 확인
    // console.log('기존 구독 확인 중...');
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // console.log('이미 푸시 알림에 구독되어 있습니다.');
      return subscription;
    }
    
    // 4. 새 구독 생성
    // console.log('새 구독 생성 중...');
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    // console.log('Application Server Key 변환 완료');
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });
    
    // console.log('브라우저 푸시 구독 생성 완료:', subscription);
    
    // 5. 서버에 구독 정보 전송
    // console.log('서버에 구독 정보 전송 중...');
    const subscribeResponse = await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userId
      })
    });
    
    // console.log('서버 응답 상태:', subscribeResponse.status);
    
    if (!subscribeResponse.ok) {
      const errorText = await subscribeResponse.text();
      console.error('서버 응답 오류:', errorText);
      throw new Error(`서버에 구독 정보를 저장할 수 없습니다: ${subscribeResponse.status} ${subscribeResponse.statusText}`);
    }
    
    const subscribeResult = await subscribeResponse.json();
    // console.log('서버 구독 응답:', subscribeResult);
    
    if (!subscribeResult.success) {
      throw new Error(subscribeResult.error || '서버 구독 등록 실패');
    }
    
    // console.log('푸시 알림 구독 완료');
    return subscription;
    
  } catch (error) {
    console.error('푸시 알림 구독 실패:', error);
    console.error('오류 상세 정보:', {
      message: error.message,
      stack: error.stack,
      userId: userId
    });
    throw error;
  }
}

// 푸시 알림 구독 해제
export async function unsubscribeFromPushNotifications(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }
    
    // 서버에서 구독 정보 삭제
    await fetch(`${API_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });
    
    // console.log('푸시 알림 구독 해제 완료');
    return true;
    
  } catch (error) {
    console.error('푸시 알림 구독 해제 실패:', error);
    throw error;
  }
}

// 푸시 알림 권한 확인
export async function checkPushNotificationPermission() {
  if (!('Notification' in window)) {
    return 'not-supported';
  }
  
  return Notification.permission;
}

// 푸시 알림 권한 요청
export async function requestPushNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('이 브라우저는 알림을 지원하지 않습니다.');
  }
  
  const permission = await Notification.requestPermission();
  return permission;
}

// 푸시 알림 구독 상태 확인
export async function getPushSubscriptionStatus() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      subscribed: !!subscription,
      subscription
    };
  } catch (error) {
    console.error('구독 상태 확인 실패:', error);
    return {
      subscribed: false,
      subscription: null
    };
  }
}

// 테스트 푸시 알림 전송
export async function sendTestPushNotification(userId) {
  try {
    if (!API_URL) {
      throw new Error('API URL이 설정되지 않았습니다.');
    }
    
    // console.log('테스트 푸시 알림 전송 시작 - userId:', userId);
    
    const response = await fetch(`${API_URL}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        notification: {
          title: '테스트 알림',
          message: '푸시 알림이 정상적으로 작동합니다!',
          data: {
            type: 'test',
            timestamp: Date.now()
          }
        }
      })
    });
    
    // console.log('테스트 알림 서버 응답 상태:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('테스트 알림 서버 응답 오류:', errorText);
      throw new Error(`테스트 알림 전송 실패: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    // console.log('테스트 알림 서버 응답:', result);
    
    if (!result.success) {
      throw new Error(result.error || '테스트 알림 전송 실패');
    }
    
    // console.log('테스트 푸시 알림 전송 완료');
    return true;
    
  } catch (error) {
    console.error('테스트 푸시 알림 전송 실패:', error);
    throw error;
  }
}

// 푸시 알림 디버깅 정보 출력
export async function debugPushNotificationStatus() {
  try {
    console.log('=== 푸시 알림 디버깅 정보 ===');
    
    // 1. 브라우저 지원 확인
    console.log('1. 브라우저 지원 확인:');
    console.log('- Service Worker 지원:', 'serviceWorker' in navigator);
    console.log('- Push Manager 지원:', 'PushManager' in window);
    console.log('- Notification 지원:', 'Notification' in window);
    
    // 2. 권한 상태 확인
    console.log('2. 권한 상태:');
    console.log('- Notification 권한:', Notification.permission);
    
    // 3. Service Worker 상태 확인
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      console.log('3. Service Worker 상태:');
      console.log('- 등록됨:', !!registration);
      console.log('- 활성 상태:', registration.active ? '활성' : '비활성');
      
      // 4. 구독 상태 확인
      const subscription = await registration.pushManager.getSubscription();
      console.log('4. 푸시 구독 상태:');
      console.log('- 구독됨:', !!subscription);
      if (subscription) {
        console.log('- 구독 정보:', {
          endpoint: subscription.endpoint,
          keys: subscription.keys ? Object.keys(subscription.keys) : 'none'
        });
      }
    }
    
    // 5. API URL 확인
    console.log('5. API URL:', API_URL);
    
    // 6. 서버 구독 정보 확인
    try {
      const response = await fetch(`${API_URL}/api/push/subscriptions`);
      if (response.ok) {
        const data = await response.json();
        console.log('6. 서버 구독 정보:');
        console.log('- 총 구독 수:', data.totalCount);
        console.log('- 메모리 구독 수:', data.memoryCount);
        console.log('- 시트 구독 수:', data.sheetCount);
        console.log('- 구독 목록:', data.subscriptions);
      }
    } catch (error) {
      console.error('서버 구독 정보 조회 실패:', error);
    }
    
    console.log('=== 디버깅 정보 완료 ===');
    
  } catch (error) {
    console.error('푸시 알림 디버깅 실패:', error);
  }
} 