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
    checkPermission: () => true,
    subTabs: [
      { 
        key: 'totalClosing', 
        label: '전체총마감'
      },
      { key: 'agentClosing', label: '담당자별마감' }
    ]
  },
  { 
    key: 'bondChart', 
    label: '채권장표', 
    hasPermission: (store) => store?.modePermissions?.bondChart,
    checkPermission: (store) => !!store?.modePermissions?.bondChart,
    subTabs: [
      { key: 'overdueBond', label: '연체채권' },
      { 
        key: 'rechotanchoBond', 
        label: '재초담초채권',
        // 상세 옵션: 저장 시점 문자열 지정(선택 시 해당 옵션을 자동선택)
        detailOptions: {
          type: 'bondHistory',
          options: [
            {
              key: 'bondHistoryTimestamp',
              label: '저장 시점 (선택 안하면 최신)',
              type: 'select',
              values: [], // 동적으로 로드됨 (MeetingEditor에서 처리)
              defaultValue: ''
            }
          ]
        }
      },
      { 
        key: 'subscriberIncrease', 
        label: '가입자증감',
        // 상세 옵션: 표시 단위(년/월) 및 대상 연도 선택
        detailOptions: {
          type: 'subscriberIncrease',
          options: [
            {
              key: 'subscriberPeriod',
              label: '표시 단위',
              type: 'select',
              values: [
                { key: 'year', label: '년단위' },
                { key: 'month', label: '월단위' }
              ],
              defaultValue: 'year'
            },
            {
              key: 'targetYear',
              label: '대상 년도',
              type: 'text',
              placeholder: '예: 2025 (비워두면 최신)',
              defaultValue: ''
            }
          ]
        }
      }
    ]
  },
  { 
    key: 'indicatorChart', 
    label: '지표장표', 
    hasPermission: true,
    checkPermission: () => true,
    subTabs: [
      { key: 'monthlyAward', label: '월간시상' },
      { key: 'salesIndicator', label: '매출지표' },
      { key: 'salesVolume', label: '판매량' },
      { key: 'structurePolicy', label: '구조정책' }
    ]
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
  { 
    key: 'faceBudget', 
    label: '액면예산', 
    checkPermission: () => true,
    subTabs: [
      { key: 'I', label: 'Ⅰ' },
      { key: 'II', label: 'Ⅱ' },
      { key: 'summary', label: '종합' }
    ]
  },
  { key: 'basicVerbal', label: '기본구두', checkPermission: () => true },
  { key: 'separateAdditional', label: '별도추가', checkPermission: () => true },
  { key: 'additionalSupport', label: '부가추가지원', checkPermission: () => true },
  { key: 'additionalDeduction', label: '부가차감지원', checkPermission: () => true },
  { key: 'sheetConfig', label: '시트설정', checkPermission: () => true }
];

// 검수 모드 탭 정의
const INSPECTION_TABS = [
  { 
    key: 'general', 
    label: '일반검수항목', 
    checkPermission: () => true,
    detailOptions: {
      type: 'field',
      options: [
        {
          key: 'selectedField',
          label: '세부 항목',
          type: 'select',
          values: [
            { key: 'all', label: '모든 항목' },
            { key: 'storeCode', label: '대리점코드' },
            { key: 'activationDateTime', label: '개통일시분' },
            { key: 'modelName', label: '모델명(일련번호)' },
            { key: 'activationType', label: '개통유형' },
            { key: 'salesPos', label: '실판매POS' },
            { key: 'ratePlan', label: '요금제' },
            { key: 'releasePrice', label: '출고가상이' },
            { key: 'supportPrice', label: '지원금 및 약정상이' },
            { key: 'freeInstallment', label: '프리할부상이' },
            { key: 'distributionSupport', label: '유통망지원금 상이' }
          ],
          defaultValue: 'all'
        }
      ]
    }
  },
  { 
    key: 'additional', 
    label: '추가검수항목', 
    checkPermission: () => true,
    detailOptions: {
      type: 'field',
      options: [
        {
          key: 'selectedField',
          label: '세부 항목',
          type: 'select',
          values: [
            { key: 'all', label: '모든 항목' },
            { key: 'uplay', label: '유플레이 유치 추가' },
            { key: 'vcoloring', label: 'V컬러링 음악감상 플러스 유치' },
            { key: 'phoneExchangePass', label: '폰교체 패스 유치' },
            { key: 'phoneExchangeSlim', label: '폰교체 슬림 유치' },
            { key: 'phoneSafePass', label: '폰 안심패스 유치' },
            { key: 'callTone', label: '통화연결음 유치' },
            { key: 'youthPlan1', label: '청소년요금제추가정책(1)유치' },
            { key: 'youthPlan2', label: '청소년요금제추가정책(2)유치' },
            { key: 'distributionSupport', label: '유통망지원금 활성화정책' }
          ],
          defaultValue: 'all'
        }
      ]
    }
  },
  { 
    key: 'deduction', 
    label: '차감검수항목', 
    checkPermission: () => true,
    detailOptions: {
      type: 'field',
      options: [
        {
          key: 'selectedField',
          label: '세부 항목',
          type: 'select',
          values: [
            { key: 'all', label: '모든 항목' },
            { key: 'uplayNo', label: '유플레이 미유치 차감' },
            { key: 'callToneNo', label: '통화연결음 미유치' },
            { key: 'insuranceNo', label: '보험 미유치' },
            { key: 'select115', label: '115군 선택약정 차감' },
            { key: 'selectS721', label: '선택약정 S721(010신규) 차감' },
            { key: 'selectS931', label: '선택약정 S931,S938,S937(MNP) 차감' },
            { key: 'selectIphone16', label: '선택약정 아이폰16류전체(MNP) 차감' },
            { key: 'a166Mnp', label: 'A166 44군 대상외요금제(MNP) 차감' },
            { key: 'a166Change', label: 'A166 44군 대상외요금제(기변) 차감' },
            { key: 'policyChange', label: '정책기변 차감' },
            { key: 'changeTarget', label: '기변 C타겟 차감' },
            { key: 'senior33', label: '33군미만, 시니어1군시 차감' },
            { key: 'onsaleOnline', label: '온세일 전략온라인POS 차감' }
          ],
          defaultValue: 'all'
        }
      ]
    }
  }
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

