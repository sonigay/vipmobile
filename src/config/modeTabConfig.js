/**
 * 각 모드의 탭 정보를 정의합니다.
 * 회의 모드에서 사용할 모드/탭 선택을 위해 사용됩니다.
 */

// OB 관리 모드 탭 정의
const OB_MANAGEMENT_TABS = [
  { 
    key: 'calculator', 
    label: '투게더 계산기', 
    roles: ['O', 'S', 'M'],
    checkPermission: (store) => {
      const role = store?.obManagementRole || store?.agentInfo?.obManagementRole || 'O';
      return ['O', 'S', 'M'].includes(role.toString().toUpperCase());
    }
  },
  { 
    key: 'overview', 
    label: 'OB 정산 확인', 
    roles: ['S', 'M'],
    checkPermission: (store) => {
      const role = store?.obManagementRole || store?.agentInfo?.obManagementRole || 'O';
      return ['S', 'M'].includes(role.toString().toUpperCase());
    }
  },
  { 
    key: 'management', 
    label: 'OB 정산 관리', 
    roles: ['M'],
    checkPermission: (store) => {
      const role = store?.obManagementRole || store?.agentInfo?.obManagementRole || 'O';
      return role.toString().toUpperCase() === 'M';
    }
  }
];

// 장표 모드 탭 정의
const CHART_TABS = [
  { 
    key: 'closingChart', 
    label: '마감장표', 
    hasPermission: true,
    checkPermission: () => true
  },
  { 
    key: 'bondChart', 
    label: '채권장표', 
    hasPermission: (store) => store?.modePermissions?.bondChart,
    checkPermission: (store) => !!store?.modePermissions?.bondChart
  },
  { 
    key: 'indicatorChart', 
    label: '지표장표', 
    hasPermission: true,
    checkPermission: () => true
  },
  { 
    key: 'inventoryChart', 
    label: '재고장표', 
    hasPermission: true,
    checkPermission: () => true
  }
];

// 예산 모드 탭 정의
const BUDGET_TABS = [
  { key: 'faceBudget', label: '액면예산', checkPermission: () => true },
  { key: 'basicVerbal', label: '기본구두', checkPermission: () => true },
  { key: 'separateAdditional', label: '별도추가', checkPermission: () => true },
  { key: 'additionalSupport', label: '부가추가지원', checkPermission: () => true },
  { key: 'additionalDeduction', label: '부가차감지원', checkPermission: () => true },
  { key: 'sheetConfig', label: '시트설정', checkPermission: () => true }
];

// 검수 모드 탭 정의
const INSPECTION_TABS = [
  { key: 'general', label: '일반검수항목', checkPermission: () => true },
  { key: 'additional', label: '추가검수항목', checkPermission: () => true },
  { key: 'deduction', label: '차감검수항목', checkPermission: () => true }
];

// SMS 관리 모드 탭 정의
const SMS_MANAGEMENT_TABS = [
  { key: 'forward', label: 'SMS 목록', checkPermission: () => true },
  { key: 'forwardRules', label: '전달 규칙', checkPermission: () => true },
  { key: 'forwardHistory', label: '전달 이력', checkPermission: () => true },
  { key: 'forwardSettings', label: '설정', checkPermission: () => true },
  { key: 'autoReply', label: '규칙 관리', checkPermission: () => true },
  { key: 'autoReplyPartners', label: '거래처 관리', checkPermission: () => true },
  { key: 'autoReplyHistory', label: '응답 이력', checkPermission: () => true },
  { key: 'autoReplySettings', label: '설정', checkPermission: () => true }
];

// 모드별 탭 매핑
export const MODE_TAB_MAP = {
  obManagement: {
    tabs: OB_MANAGEMENT_TABS,
    getAvailableTabs: (store) => {
      return OB_MANAGEMENT_TABS.filter(tab => tab.checkPermission(store));
    }
  },
  chart: {
    tabs: CHART_TABS,
    getAvailableTabs: (store) => {
      return CHART_TABS.filter(tab => tab.checkPermission(store));
    }
  },
  budget: {
    tabs: BUDGET_TABS,
    getAvailableTabs: (store) => {
      return BUDGET_TABS.filter(tab => tab.checkPermission(store));
    }
  },
  inspection: {
    tabs: INSPECTION_TABS,
    getAvailableTabs: (store) => {
      return INSPECTION_TABS.filter(tab => tab.checkPermission(store));
    }
  },
  smsManagement: {
    tabs: SMS_MANAGEMENT_TABS,
    getAvailableTabs: (store) => {
      return SMS_MANAGEMENT_TABS.filter(tab => tab.checkPermission(store));
    }
  }
  // 추가 모드는 필요에 따라 확장
};

/**
 * 특정 모드의 사용 가능한 탭 목록을 반환합니다.
 * @param {string} modeKey - 모드 키
 * @param {object} store - 로그인된 사용자 정보
 * @returns {Array} 사용 가능한 탭 목록
 */
export function getAvailableTabsForMode(modeKey, store) {
  const modeConfig = MODE_TAB_MAP[modeKey];
  if (!modeConfig) {
    return [];
  }
  return modeConfig.getAvailableTabs(store);
}

/**
 * 모든 모드의 탭 정보를 반환합니다.
 * @param {object} store - 로그인된 사용자 정보
 * @returns {Object} 모드별 사용 가능한 탭 목록
 */
export function getAllAvailableTabs(store) {
  const result = {};
  Object.keys(MODE_TAB_MAP).forEach(modeKey => {
    result[modeKey] = getAvailableTabsForMode(modeKey, store);
  });
  return result;
}

