// 푸시 알림 관리 유틸리티

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
    // 1. VAPID 공개키 가져오기
    const response = await fetch('/api/push/vapid-public-key');
    const { publicKey } = await response.json();
    
    if (!publicKey) {
      throw new Error('VAPID 공개키를 가져올 수 없습니다.');
    }
    
    // 2. Service Worker 등록 확인
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
    }
    
    const registration = await navigator.serviceWorker.ready;
    
    // 3. 기존 구독 확인
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('이미 푸시 알림에 구독되어 있습니다.');
      return subscription;
    }
    
    // 4. 새 구독 생성
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    
    // 5. 서버에 구독 정보 전송
    const subscribeResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userId
      })
    });
    
    if (!subscribeResponse.ok) {
      throw new Error('서버에 구독 정보를 저장할 수 없습니다.');
    }
    
    console.log('푸시 알림 구독 완료');
    return subscription;
    
  } catch (error) {
    console.error('푸시 알림 구독 실패:', error);
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
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });
    
    console.log('푸시 알림 구독 해제 완료');
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
    const response = await fetch('/api/push/send', {
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
            type: 'test'
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('테스트 알림 전송 실패');
    }
    
    console.log('테스트 푸시 알림 전송 완료');
    return true;
    
  } catch (error) {
    console.error('테스트 푸시 알림 전송 실패:', error);
    throw error;
  }
} 