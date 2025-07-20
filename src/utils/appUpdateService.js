// 어플업데이트 시트 기반 업데이트 서비스

// 시트 컬럼 매핑
const UPDATE_SHEET_COLUMNS = {
  DATE: 0,           // A열: 날짜
  GENERAL: 1,        // B열: 일반모드 업데이트내용
  AGENT: 2,          // C열: 관리자모드 업데이트내용
  INVENTORY: 3,      // D열: 재고관리모드 업데이트내용
  SETTLEMENT: 4,     // E열: 정산모드 업데이트내용
  INSPECTION: 5,     // F열: 검수모드 업데이트내용
  POLICY: 6,         // G열: 정책모드 업데이트내용
  MEETING: 7,        // H열: 회의모드 업데이트내용
  RESERVATION: 8,    // I열: 사전예약모드 업데이트내용
  CHART: 9,          // J열: 장표모드 업데이트내용
  ADMIN_IDS: 10      // K열: 관리자아이디
};

// 모드별 컬럼 매핑
const MODE_COLUMN_MAP = {
  'general': UPDATE_SHEET_COLUMNS.GENERAL,
  'agent': UPDATE_SHEET_COLUMNS.AGENT,
  'inventory': UPDATE_SHEET_COLUMNS.INVENTORY,
  'settlement': UPDATE_SHEET_COLUMNS.SETTLEMENT,
  'inspection': UPDATE_SHEET_COLUMNS.INSPECTION,
  'policy': UPDATE_SHEET_COLUMNS.POLICY,
  'meeting': UPDATE_SHEET_COLUMNS.MEETING,
  'reservation': UPDATE_SHEET_COLUMNS.RESERVATION,
  'chart': UPDATE_SHEET_COLUMNS.CHART
};

// 캐시 설정
let updateDataCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 어플업데이트 시트에서 데이터 가져오기
export const fetchAppUpdates = async () => {
  const now = Date.now();
  
  // 캐시가 유효한 경우 캐시된 데이터 반환
  if (updateDataCache && (now - lastFetchTime) < CACHE_DURATION) {
    return updateDataCache;
  }
  
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/app-updates`);
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      updateDataCache = result.data;
      lastFetchTime = now;
      return result.data;
    } else {
      throw new Error(result.message || '업데이트 데이터 로드 실패');
    }
  } catch (error) {
    console.error('어플업데이트 데이터 로드 오류:', error);
    return [];
  }
};

// 특정 모드의 업데이트 내용 가져오기
export const getUpdatesForMode = async (mode) => {
  try {
    const updates = await fetchAppUpdates();
    const columnIndex = MODE_COLUMN_MAP[mode];
    
    if (columnIndex === undefined) {
      console.warn(`알 수 없는 모드: ${mode}`);
      return [];
    }
    
    // 해당 모드의 업데이트 내용만 필터링
    return updates
      .filter(row => row.length > columnIndex && row[columnIndex] && row[columnIndex].trim())
      .map(row => ({
        date: row[UPDATE_SHEET_COLUMNS.DATE] || '',
        content: row[columnIndex] || '',
        mode: mode
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // 최신순 정렬
  } catch (error) {
    console.error(`${mode} 모드 업데이트 로드 오류:`, error);
    return [];
  }
};

// 최신 업데이트 가져오기 (기본값: 최신 1개)
export const getLatestUpdateForMode = async (mode, count = 1) => {
  const updates = await getUpdatesForMode(mode);
  return updates.slice(0, count);
};

// 특정 날짜의 업데이트 가져오기
export const getUpdatesByDate = async (mode, date) => {
  const updates = await getUpdatesForMode(mode);
  return updates.filter(update => update.date.includes(date));
};

// 사용 가능한 날짜 목록 가져오기
export const getAvailableDates = async (mode) => {
  const updates = await getUpdatesForMode(mode);
  const dates = [...new Set(updates.map(update => update.date))];
  return dates.sort((a, b) => new Date(b) - new Date(a)); // 최신순 정렬
};

// 관리자 권한 확인
export const checkAdminPermission = async (userId) => {
  try {
    const updates = await fetchAppUpdates();
    const adminIds = updates
      .filter(row => row.length > UPDATE_SHEET_COLUMNS.ADMIN_IDS && row[UPDATE_SHEET_COLUMNS.ADMIN_IDS])
      .map(row => row[UPDATE_SHEET_COLUMNS.ADMIN_IDS].toString().trim());
    
    return adminIds.includes(userId.toString().trim());
  } catch (error) {
    console.error('관리자 권한 확인 오류:', error);
    return false;
  }
};

// 새 업데이트 추가 (관리자만)
export const addNewUpdate = async (updateData) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/app-updates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // 캐시 무효화
      updateDataCache = null;
      return result;
    } else {
      throw new Error(result.message || '업데이트 추가 실패');
    }
  } catch (error) {
    console.error('새 업데이트 추가 오류:', error);
    throw error;
  }
};

// 캐시 무효화
export const invalidateCache = () => {
  updateDataCache = null;
  lastFetchTime = 0;
}; 