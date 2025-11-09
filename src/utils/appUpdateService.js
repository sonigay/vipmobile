// 어플업데이트 시트 기반 업데이트 서비스

// 시트 컬럼 매핑
const UPDATE_SHEET_COLUMNS = {
  DATE: 0,           // A열: 날짜
  ADMIN_IDS: 1,      // B열: 관리자아이디 (수정 권한)
  GENERAL: 2,        // C열: 일반모드 업데이트내용
  AGENT: 3,          // D열: 관리자모드 업데이트내용
  INVENTORY: 4,      // E열: 재고관리모드 업데이트내용
  SETTLEMENT: 5,     // F열: 정산모드 업데이트내용
  INSPECTION: 6,     // G열: 검수모드 업데이트내용
  POLICY: 7,         // H열: 정책모드 업데이트내용
  MEETING: 8,        // I열: 회의모드 업데이트내용
  RESERVATION: 9,    // J열: 사전예약모드 업데이트내용
  CHART: 10,         // K열: 장표모드 업데이트내용
  BUDGET: 11,        // L열: 예산모드 업데이트내용
  SALES: 12,         // M열: 영업모드 업데이트내용
  INVENTORY_RECOVERY: 13,  // N열: 재고회수모드 업데이트내용
  DATA_COLLECTION: 14,     // O열: 정보수집모드 업데이트내용
  SMS_MANAGEMENT: 15,      // P열: SMS 관리모드 업데이트내용
  OB_MANAGEMENT: 16,       // Q열: OB 관리모드 업데이트내용
  ONSALE_MANAGEMENT: 17,   // R열: 온세일관리모드 업데이트내용
  ONSALE_RECEPTION: 18,    // S열: 온세일접수모드 업데이트내용
  MEAL_ALLOWANCE: 19,      // T열: 식대 모드 업데이트내용
  ATTENDANCE: 20,          // U열: 근퇴 모드 업데이트내용
  RISK_MANAGEMENT: 21,     // V열: 리스크 관리 모드 업데이트내용
  DIRECT_STORE_MANAGEMENT: 22, // W열: 직영점 관리 모드 업데이트내용
  DIRECT_STORE: 23,         // X열: 직영점 모드 업데이트내용
  QUICK_SERVICE_MANAGEMENT: 24 // Y열: 퀵서비스 관리 모드 업데이트내용
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
  'chart': UPDATE_SHEET_COLUMNS.CHART,
  'budget': UPDATE_SHEET_COLUMNS.BUDGET,
  'sales': UPDATE_SHEET_COLUMNS.SALES,
  'inventoryRecovery': UPDATE_SHEET_COLUMNS.INVENTORY_RECOVERY,
  'inventory-recovery': UPDATE_SHEET_COLUMNS.INVENTORY_RECOVERY, // 별칭
  'dataCollection': UPDATE_SHEET_COLUMNS.DATA_COLLECTION,
  'data-collection': UPDATE_SHEET_COLUMNS.DATA_COLLECTION, // 별칭
  'smsManagement': UPDATE_SHEET_COLUMNS.SMS_MANAGEMENT,
  'sms-management': UPDATE_SHEET_COLUMNS.SMS_MANAGEMENT, // 별칭
  'obManagement': UPDATE_SHEET_COLUMNS.OB_MANAGEMENT,
  'ob-management': UPDATE_SHEET_COLUMNS.OB_MANAGEMENT, // 별칭
  'onSaleManagement': UPDATE_SHEET_COLUMNS.ONSALE_MANAGEMENT,
  'onsale-management': UPDATE_SHEET_COLUMNS.ONSALE_MANAGEMENT, // 별칭
  'onSaleReception': UPDATE_SHEET_COLUMNS.ONSALE_RECEPTION,
  'onsale-reception': UPDATE_SHEET_COLUMNS.ONSALE_RECEPTION, // 별칭
  'mealAllowance': UPDATE_SHEET_COLUMNS.MEAL_ALLOWANCE,
  'attendance': UPDATE_SHEET_COLUMNS.ATTENDANCE,
  'riskManagement': UPDATE_SHEET_COLUMNS.RISK_MANAGEMENT,
  'directStoreManagement': UPDATE_SHEET_COLUMNS.DIRECT_STORE_MANAGEMENT,
  'directStore': UPDATE_SHEET_COLUMNS.DIRECT_STORE,
  'quickServiceManagement': UPDATE_SHEET_COLUMNS.QUICK_SERVICE_MANAGEMENT,
  'basic': UPDATE_SHEET_COLUMNS.GENERAL,  // 기본모드는 일반모드와 동일
  'basicMode': UPDATE_SHEET_COLUMNS.GENERAL  // 별칭
};

// 캐시 설정
let updateDataCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// API URL 헬퍼 함수
function getApiUrl() {
  const url = process.env.REACT_APP_API_URL;
  if (!url) {
    throw new Error('REACT_APP_API_URL 환경변수가 설정되어 있지 않습니다.');
  }
  return url;
}

// 어플업데이트 시트에서 데이터 가져오기
export const fetchAppUpdates = async () => {
  const now = Date.now();
  
  // 캐시가 유효한 경우 캐시된 데이터 반환
  if (updateDataCache && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('🔍 [appUpdateService] 캐시된 데이터 사용');
    return updateDataCache;
  }
  
  try {
    console.log('🔍 [appUpdateService] API 호출 시작');
    const apiUrl = getApiUrl();
    console.log('🔍 [appUpdateService] API URL:', apiUrl);
    
    const response = await fetch(`${apiUrl}/api/app-updates`);
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🔍 [appUpdateService] API 응답:', result);
    
    if (result.success) {
      updateDataCache = result.data;
      lastFetchTime = now;
      console.log('✅ [appUpdateService] 데이터 로드 성공:', result.data.length, '건');
      return result.data;
    } else {
      throw new Error(result.message || '업데이트 데이터 로드 실패');
    }
  } catch (error) {
    console.error('❌ [appUpdateService] 어플업데이트 데이터 로드 오류:', error);
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
    const response = await fetch(`${getApiUrl()}/api/app-updates`, {
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