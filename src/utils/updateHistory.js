// 동적 업데이트 내용 관리 시스템
let cachedUpdateHistory = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

// 서버에서 업데이트 히스토리 가져오기
export const fetchUpdateHistory = async () => {
  const now = Date.now();
  
  // 캐시가 유효한 경우 캐시된 데이터 반환
  if (cachedUpdateHistory && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedUpdateHistory;
  }
  
  try {
    const response = await fetch('/api/updates');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Response is not JSON');
    }
    
    const result = await response.json();
    if (result.success && result.data) {
      cachedUpdateHistory = result.data;
      lastFetchTime = now;
      return result.data;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('업데이트 히스토리 가져오기 실패:', error);
    // 에러 시 기본 업데이트 정보 반환
    return getDefaultUpdateHistory();
  }
};

// 기본 업데이트 히스토리 (서버 연결 실패 시 사용)
const getDefaultUpdateHistory = () => {
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split('T')[0];
  
  return [
    {
      version: `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${String(currentDate.getDate()).padStart(2, '0')}`,
      date: formattedDate,
      title: '동적 업데이트 시스템 구축',
      changes: [
        '서버 기반 동적 업데이트 시스템 구현',
        '실시간 업데이트 내용 가져오기',
        '캐시 시스템으로 성능 최적화',
        '오프라인 시 기본 업데이트 정보 제공'
      ],
      type: 'system',
      timestamp: currentDate.getTime()
    }
  ];
};

// 로컬 스토리지 키
const LAST_UPDATE_KEY = 'lastUpdateVersion';
const UPDATE_HISTORY_KEY = 'updateHistory';
const HIDE_UNTIL_DATE_KEY = 'hideUpdateUntilDate';

// 마지막으로 본 업데이트 버전 가져오기
export const getLastUpdateVersion = () => {
  try {
    return localStorage.getItem(LAST_UPDATE_KEY) || '0.0.0';
  } catch (error) {
    console.error('마지막 업데이트 버전 조회 실패:', error);
    return '0.0.0';
  }
};

// 마지막 업데이트 버전 저장
export const setLastUpdateVersion = (version) => {
  try {
    localStorage.setItem(LAST_UPDATE_KEY, version);
  } catch (error) {
    console.error('마지막 업데이트 버전 저장 실패:', error);
  }
};

// 오늘 하루 보지 않기 설정 가져오기
export const getHideUntilDate = () => {
  try {
    const hideUntil = localStorage.getItem(HIDE_UNTIL_DATE_KEY);
    return hideUntil ? new Date(hideUntil) : null;
  } catch (error) {
    console.error('오늘 하루 보지 않기 설정 조회 실패:', error);
    return null;
  }
};

// 오늘 하루 보지 않기 설정 저장
export const setHideUntilDate = (date) => {
  try {
    localStorage.setItem(HIDE_UNTIL_DATE_KEY, date.toISOString());
  } catch (error) {
    console.error('오늘 하루 보지 않기 설정 저장 실패:', error);
  }
};

// 새로운 업데이트가 있는지 확인 (동적)
export const hasNewUpdates = async () => {
  // 오늘 하루 보지 않기 설정 확인
  const hideUntil = getHideUntilDate();
  if (hideUntil && new Date() < hideUntil) {
    console.log('오늘 하루 보지 않기 설정으로 인해 업데이트 팝업 숨김');
    return false;
  }

  try {
    const updateHistory = await fetchUpdateHistory();
    const lastVersion = getLastUpdateVersion();
    const latestVersion = updateHistory[0]?.version || '0.0.0';
    
    return compareVersions(latestVersion, lastVersion) > 0;
  } catch (error) {
    console.error('업데이트 확인 실패:', error);
    return false;
  }
};

// 버전 비교 함수
const compareVersions = (version1, version2) => {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }
  
  return 0;
};

// 확인하지 않은 업데이트 목록 가져오기 (동적)
export const getUnreadUpdates = async () => {
  try {
    const updateHistory = await fetchUpdateHistory();
    const lastVersion = getLastUpdateVersion();
    
    return updateHistory.filter(update => 
      compareVersions(update.version, lastVersion) > 0
    );
  } catch (error) {
    console.error('미읽 업데이트 목록 가져오기 실패:', error);
    return [];
  }
};

// 모든 업데이트 내용 가져오기 (동적)
export const getAllUpdates = async () => {
  try {
    return await fetchUpdateHistory();
  } catch (error) {
    console.error('전체 업데이트 목록 가져오기 실패:', error);
    return getDefaultUpdateHistory();
  }
};

// 업데이트 내용을 텍스트로 변환
export const formatUpdateContent = (updates) => {
  if (!updates || updates.length === 0) {
    return '새로운 업데이트가 없습니다.';
  }
  
  return updates.map(update => {
    const changeList = update.changes.map(change => `• ${change}`).join('\n');
    return `📅 ${update.date} - ${update.title}\n${changeList}`;
  }).join('\n\n');
}; 