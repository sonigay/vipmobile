// 서버 모니터링 유틸리티
// 서버 다운 감지 시 Firebase Function을 호출하여 Discord에 알림 전송

// 환경 변수에서 설정 가져오기
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const MONITOR_ENDPOINT = process.env.REACT_APP_MONITOR_ENDPOINT || 'https://us-central1-your-project.cloudfunctions.net/reportServerStatus';
const API_KEY = process.env.REACT_APP_MONITOR_API_KEY || '';
const CHECK_INTERVAL = process.env.REACT_APP_CHECK_INTERVAL ? parseInt(process.env.REACT_APP_CHECK_INTERVAL) : 60000; // 기본 1분
const MAX_RETRIES = process.env.REACT_APP_MAX_RETRIES ? parseInt(process.env.REACT_APP_MAX_RETRIES) : 3; // 기본 3회

// 상태 관리
let serverStatus = {
  online: true,
  lastChecked: null,
  lastOnline: new Date().toISOString(),
  lastOffline: null,
  retryCount: 0,
  lastNotified: null
};

// 로컬 스토리지에서 상태 복원
const loadStatus = () => {
  try {
    const savedStatus = localStorage.getItem('serverMonitorStatus');
    if (savedStatus) {
      serverStatus = { ...serverStatus, ...JSON.parse(savedStatus) };
      console.log('서버 모니터링 상태 로드됨:', serverStatus);
    }
  } catch (error) {
    console.error('서버 모니터링 상태 로드 실패:', error);
  }
};

// 로컬 스토리지에 상태 저장
const saveStatus = () => {
  try {
    localStorage.setItem('serverMonitorStatus', JSON.stringify(serverStatus));
  } catch (error) {
    console.error('서버 모니터링 상태 저장 실패:', error);
  }
};

// 서버 상태 확인
const checkServerStatus = async () => {
  console.log(`서버 상태 확인 중... (${new Date().toLocaleString()})`);
  serverStatus.lastChecked = new Date().toISOString();
  
  try {
    // 서버 상태 엔드포인트에 요청 (타임아웃 5초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_URL}`, { 
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      // 서버 온라인
      console.log('서버 온라인 확인됨');
      
      // 이전에 오프라인이었다면 복구 알림 전송
      if (!serverStatus.online && serverStatus.lastOffline) {
        console.log('서버가 복구됨, 알림 전송');
        await sendStatusAlert('up');
      }
      
      serverStatus.online = true;
      serverStatus.lastOnline = new Date().toISOString();
      serverStatus.retryCount = 0;
    } else {
      // 서버 오류 응답
      handleServerDown('응답 상태 코드: ' + response.status);
    }
  } catch (error) {
    // 요청 실패
    handleServerDown('연결 오류: ' + (error.name === 'AbortError' ? '타임아웃' : error.message));
  }
  
  saveStatus();
};

// 서버 다운 처리
const handleServerDown = async (reason) => {
  console.log(`서버 다운 감지: ${reason}`);
  
  serverStatus.retryCount++;
  console.log(`재시도 횟수: ${serverStatus.retryCount}/${MAX_RETRIES}`);
  
  if (serverStatus.retryCount >= MAX_RETRIES) {
    if (serverStatus.online) {
      // 이전에 온라인이었을 때만 알림 전송
      serverStatus.online = false;
      serverStatus.lastOffline = new Date().toISOString();
      await sendStatusAlert('down', { reason });
    } else {
      // 이미 오프라인으로 알려진 경우, 알림 주기 체크 (2시간마다 한 번만)
      const lastNotified = serverStatus.lastNotified ? new Date(serverStatus.lastNotified) : null;
      const now = new Date();
      if (!lastNotified || (now - lastNotified) > 2 * 60 * 60 * 1000) {
        console.log('서버 다운 상태 지속, 재알림 전송');
        await sendStatusAlert('down', { 
          reason,
          duration: lastNotified ? `${Math.round((now - lastNotified) / (60 * 1000))} 분` : '알 수 없음'
        });
      }
    }
  }
};

// Firebase Function에 상태 알림 전송
const sendStatusAlert = async (status, details = {}) => {
  if (!MONITOR_ENDPOINT || !API_KEY) {
    console.log('모니터링 엔드포인트 또는 API 키가 설정되지 않아 알림을 보낼 수 없습니다.');
    return;
  }
  
  try {
    // 클라이언트 정보 수집
    const clientInfo = {
      userAgent: navigator.userAgent,
      location: window.location.href,
      timestamp: new Date().toISOString(),
      ipInfo: localStorage.getItem('userIpInfo') ? JSON.parse(localStorage.getItem('userIpInfo')) : null
    };
    
    const response = await fetch(MONITOR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        status,
        details: {
          ...details,
          clientInfo
        }
      })
    });
    
    if (response.ok) {
      console.log(`서버 ${status === 'down' ? '다운' : '복구'} 알림 전송 성공`);
      serverStatus.lastNotified = new Date().toISOString();
    } else {
      console.error('알림 전송 실패:', await response.text());
    }
  } catch (error) {
    console.error('알림 전송 요청 실패:', error);
  }
};

// 모니터링 시작
const startMonitoring = () => {
  // Netlify 환경에서만 모니터링 활성화
  if (!window.location.hostname.includes('netlify.app') && 
      !window.location.hostname.includes('localhost')) {
    console.log('로컬 개발 환경이 아닌 곳에서만 서버 모니터링을 활성화합니다.');
    return;
  }
  
  console.log(`서버 모니터링 시작 - 간격: ${CHECK_INTERVAL}ms, 엔드포인트: ${API_URL}`);
  loadStatus();
  
  // 첫 번째 검사 즉시 실행
  setTimeout(checkServerStatus, 5000); // 5초 후 첫 검사 (앱 로딩 시간 고려)
  
  // 정기적으로 검사
  const intervalId = setInterval(checkServerStatus, CHECK_INTERVAL);
  
  // 언마운트 시 정리 함수 반환
  return () => {
    clearInterval(intervalId);
    console.log('서버 모니터링 중지됨');
  };
};

export { startMonitoring, checkServerStatus }; 