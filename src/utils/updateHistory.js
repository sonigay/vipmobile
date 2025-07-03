// 업데이트 내용 관리 시스템
export const UPDATE_HISTORY = [
  {
    version: '2024.12.19',
    date: '2024-12-19',
    title: '관리자 모드 재고 확인 기능 추가',
    changes: [
      '담당재고확인/전체재고확인 메뉴 추가',
      '담당자별 재고 필터링 기능 구현',
      '화면 전환 시 상태 저장 기능',
      '카톡 복사 팝업 메시지 개선'
    ],
    type: 'feature'
  },
  {
    version: '2024.12.18',
    date: '2024-12-18',
    title: '자동 캐시 관리 시스템 구축',
    changes: [
      'Service Worker 기반 자동 캐시 무효화',
      '업데이트 내용 팝업 시스템',
      '캐시 상태 실시간 모니터링',
      '자동 업데이트 알림 기능'
    ],
    type: 'system'
  }
];

// 로컬 스토리지 키
const LAST_UPDATE_KEY = 'lastUpdateVersion';
const UPDATE_HISTORY_KEY = 'updateHistory';

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

// 새로운 업데이트가 있는지 확인
export const hasNewUpdates = () => {
  const lastVersion = getLastUpdateVersion();
  const latestVersion = UPDATE_HISTORY[0]?.version || '0.0.0';
  
  return compareVersions(latestVersion, lastVersion) > 0;
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

// 확인하지 않은 업데이트 목록 가져오기
export const getUnreadUpdates = () => {
  const lastVersion = getLastUpdateVersion();
  
  return UPDATE_HISTORY.filter(update => 
    compareVersions(update.version, lastVersion) > 0
  );
};

// 모든 업데이트 내용 가져오기
export const getAllUpdates = () => {
  return UPDATE_HISTORY;
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