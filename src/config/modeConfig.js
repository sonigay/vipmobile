import {
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  AccountBalance as AccountBalanceIcon,
  Assignment as AssignmentIcon,
  BarChart as BarChartIcon,
  Policy as PolicyIcon,
  MeetingRoom as MeetingRoomIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  DataUsage as DataUsageIcon,
  Message as MessageIcon,
  Phone as PhoneIcon,
  Link as LinkIcon,
  Storefront as StorefrontIcon,
  Store as StoreIcon,
  RestaurantMenu as RestaurantMenuIcon,
  AccessTime as AccessTimeIcon,
  Security as SecurityIcon,
  HomeWork as HomeWorkIcon
} from '@mui/icons-material';

/**
 * 모드 키에 대한 별칭 매핑.
 * UI와 API가 혼용하는 문자열을 하나의 표준 키로 정규화하기 위해 사용한다.
 */
export const MODE_KEY_ALIASES = {
  basic: 'basicMode',
  general: 'basicMode',
  basicMode: 'basicMode',
  'inventory-recovery': 'inventoryRecovery',
  'data-collection': 'dataCollection',
  'sms-management': 'smsManagement',
  'ob-management': 'obManagement',
  'onsale-management': 'onSaleManagement',
  'onsale-reception': 'onSaleReception'
};

/**
 * 모드별 기본 구성 정보.
 * color는 헤더/버튼/업데이트팝업에 공통으로 사용되며,
 * sheetRefs는 권한/업데이트 시트 컬럼을 기록하여 모드 추가 시 누락을 방지한다.
 */
export const MODE_CONFIG = {
  agent: {
    key: 'agent',
    title: '관리자 모드',
    description: '담당 매장의 재고와 개통 실적을 종합 관리합니다.',
    features: [
      '담당 매장 재고 현황 파악',
      '개통 실적 분석',
      '실시간 알림 관리',
      '매장별 상세 정보 확인'
    ],
    color: '#1E88E5',
    icon: BusinessIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!Z열',
      updates: '어플업데이트!D열'
    }
  },
  inventory: {
    key: 'inventory',
    title: '재고 관리 모드',
    description: '전체 재고 감사와 배정, 중복 케이스를 관리합니다.',
    features: [
      '재고 감사 및 마스터 관리',
      '재고 배정/회수 진행',
      '중복 재고 케이스 검토',
      '실시간 재고 대시보드'
    ],
    color: '#43A047',
    icon: InventoryIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!H열',
      updates: '어플업데이트!E열'
    }
  },
  settlement: {
    key: 'settlement',
    title: '정산 모드',
    description: '정산 데이터 업로드와 검증, 결과 공유를 처리합니다.',
    features: [
      '엑셀 업로드 및 자동 검증',
      '정산 데이터 처리',
      '파일 형식 검사',
      '정산 결과 내보내기'
    ],
    color: '#E53935',
    icon: AccountBalanceIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!I열',
      updates: '어플업데이트!F열'
    }
  },
  inspection: {
    key: 'inspection',
    title: '검수 모드',
    description: '검수 프로세스와 품질 기준을 일괄 관리합니다.',
    features: [
      '검수 프로세스 관리',
      '품질 기준 설정',
      '검수 결과 기록',
      '검수 리포트 생성'
    ],
    color: '#8E24AA',
    icon: AssignmentIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!J열',
      updates: '어플업데이트!G열'
    }
  },
  chart: {
    key: 'chart',
    title: '장표 모드',
    description: '채권 장표를 자동화하고 이미지 업로드를 지원합니다.',
    features: [
      '채권 장표 OCR 처리',
      '이미지 업로드 및 분석',
      '데이터 편집/저장',
      '권한 기반 메뉴 제어'
    ],
    color: '#FB8C00',
    icon: BarChartIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!P열',
      updates: '어플업데이트!K열'
    }
  },
  policy: {
    key: 'policy',
    title: '정책 모드',
    description: '정책 문서를 관리하고 새 공지를 배포합니다.',
    features: [
      '정책 문서 관리',
      '규정 업데이트 기록',
      '공지 게시',
      '정책 이력 추적'
    ],
    color: '#00838F',
    icon: PolicyIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!L열',
      updates: '어플업데이트!H열'
    }
  },
  meeting: {
    key: 'meeting',
    title: '회의 모드',
    description: '회의 일정을 조율하고 참석자를 관리합니다.',
    features: [
      '회의 일정 관리',
      '회의실 예약',
      '참석자 관리',
      '회의록 작성/배포'
    ],
    color: '#3949AB',
    icon: MeetingRoomIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!N열',
      updates: '어플업데이트!I열'
    }
  },
  reservation: {
    key: 'reservation',
    title: '사전예약 모드',
    description: '사전예약 데이터를 수집하고 일정 변동을 추적합니다.',
    features: [
      '사전예약 현황 모니터링',
      '일정 조율 및 배치',
      '알림/재확인 관리',
      '예약 데이터 분석'
    ],
    color: '#F06292',
    icon: EventIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!O열',
      updates: '어플업데이트!J열'
    }
  },
  budget: {
    key: 'budget',
    title: '예산 모드',
    description: '예산 집행 현황과 추가 지원 계획을 통합 관리합니다.',
    features: [
      '액면/추가 예산 관리',
      '지원 내역 기록',
      '예산 사용 분석',
      '정책 그룹 관리'
    ],
    color: '#6D4C41',
    icon: AccountBalanceIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!S열',
      updates: '어플업데이트!L열'
    }
  },
  sales: {
    key: 'sales',
    title: '영업 모드',
    description: '영업 실적을 지도 기반으로 시각화합니다.',
    features: [
      '지도 기반 실적 표시',
      'POS 코드별 실적 집계',
      '지역별 실적 분석',
      '실시간 필터링 지원'
    ],
    color: '#F4511E',
    icon: TrendingUpIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!U열',
      updates: '어플업데이트!M열'
    }
  },
  inventoryRecovery: {
    key: 'inventoryRecovery',
    title: '재고회수 모드',
    description: '회수 대상 재고를 추적하고 처리합니다.',
    features: [
      '재고 회수 요청 추적',
      '회수 진행 현황',
      '통계/리포트 제공',
      '자동화된 알림 처리'
    ],
    color: '#7CB342',
    icon: RefreshIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!V열',
      updates: '어플업데이트!N열'
    }
  },
  dataCollection: {
    key: 'dataCollection',
    title: '정보수집 모드',
    description: '현장 데이터를 수집하고 통계를 제공합니다.',
    features: [
      '데이터 수집/정리',
      '정보 분석 및 통계',
      '자동화된 처리',
      '실시간 모니터링'
    ],
    color: '#5C6BC0',
    icon: DataUsageIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!W열',
      updates: '어플업데이트!O열'
    }
  },
  smsManagement: {
    key: 'smsManagement',
    title: 'SMS 관리 모드',
    description: 'SMS 자동 수신과 전달 정책을 관리합니다.',
    features: [
      'SMS 자동 수신 설정',
      '번호별 전달 정책',
      '전송 이력 추적',
      '모니터링 대시보드'
    ],
    color: '#00796B',
    icon: MessageIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!X열',
      updates: '어플업데이트!P열'
    }
  },
  obManagement: {
    key: 'obManagement',
    title: 'OB 관리 모드',
    description: '아웃바운드 콜 데이터를 관리하고 성과를 분석합니다.',
    features: [
      '발신 현황 추적',
      '성과 분석 리포트',
      '고객 응대 기록',
      '자동화 설정'
    ],
    color: '#6A1B9A',
    icon: PhoneIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!Y열',
      updates: '어플업데이트!Q열'
    }
  },
  onSaleManagement: {
    key: 'onSaleManagement',
    title: '온세일관리 모드',
    description: '온세일 전용 링크와 접근 권한을 통합 제어합니다.',
    features: [
      '가입 링크 등록 및 수정',
      '대리점 정보 보호 설정',
      '링크 활성화 관리',
      '접근 권한 제어'
    ],
    color: '#7E57C2',
    icon: LinkIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!AA열',
      updates: '어플업데이트!R열'
    }
  },
  onSaleReception: {
    key: 'onSaleReception',
    title: '온세일접수 모드',
    description: '온세일 접수 건을 확인하고 안전하게 처리합니다.',
    features: [
      '온세일 접수 데이터 조회',
      '접수 상태 관리',
      '보안 기반 인증',
      '접수 내역 기록'
    ],
    color: '#AB47BC',
    icon: PhoneIcon,
    category: 'general',
    sheetRefs: {
      general: '일반모드권한관리!E열',
      updates: '어플업데이트!S열'
    }
  },
  basicMode: {
    key: 'basicMode',
    title: '기본 모드',
    description: '주변 매장 재고를 조회하고 요청합니다.',
    features: [
      '지도 기반 매장 검색',
      '재고 확인 및 요청',
      '주변 매장 탐색',
      '실시간 재고 현황'
    ],
    color: '#1565C0',
    icon: HomeWorkIcon,
    category: 'general',
    sheetRefs: {
      general: '일반모드권한관리!D열',
      updates: '어플업데이트!C열'
    }
  },
  mealAllowance: {
    key: 'mealAllowance',
    title: '식대 모드',
    description: '식대 신청 현황과 정산 내역을 검토합니다.',
    features: [
      '식대 신청 접수 관리',
      '예산 대비 사용량 모니터링',
      '정산 이력 추적',
      '승인/반려 내역 관리'
    ],
    color: '#FF7043',
    icon: RestaurantMenuIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!AB열',
      updates: '어플업데이트!T열'
    }
  },
  attendance: {
    key: 'attendance',
    title: '근퇴 모드',
    description: '근태 기록과 출퇴근 현황을 모니터링합니다.',
    features: [
      '출퇴근 기록 확인',
      '근태 이상 감지',
      '근무 패턴 분석',
      '내역 다운로드'
    ],
    color: '#26A69A',
    icon: AccessTimeIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!AC열',
      updates: '어플업데이트!U열'
    }
  },
  riskManagement: {
    key: 'riskManagement',
    title: '리스크 관리 모드',
    description: '매장 리스크 지표를 분석하고 조치를 기록합니다.',
    features: [
      '리스크 요인 모니터링',
      '조치 이력 기록',
      '알림 및 보고서',
      '권한별 접근 제어'
    ],
    color: '#C0CA33',
    icon: SecurityIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!AD열',
      updates: '어플업데이트!V열'
    }
  },
  directStoreManagement: {
    key: 'directStoreManagement',
    title: '직영점 관리 모드',
    description: '직영점 인력, 재고, 정책을 중앙에서 관리합니다.',
    features: [
      '직영점 운영 지표 확인',
      '정책 및 공지 배포',
      '인력 배치/이동 기록',
      '점포별 현황 리포트'
    ],
    color: '#546E7A',
    icon: StorefrontIcon,
    category: 'admin',
    sheetRefs: {
      admin: '대리점아이디관리!AE열',
      updates: '어플업데이트!W열'
    }
  },
  directStore: {
    key: 'directStore',
    title: '직영점 모드',
    description: '직영점 전용 자료와 업무 현황을 확인합니다.',
    features: [
      '직영점 재고 현황 조회',
      '업무 요청/처리 기록',
      '공지 및 문서 열람',
      '업데이트 이력 확인'
    ],
    color: '#455A64',
    icon: StoreIcon,
    category: 'general',
    sheetRefs: {
      general: '일반모드권한관리!G열',
      updates: '어플업데이트!X열'
    }
  }
};

export const MODE_ORDER = [
  'agent',
  'inventory',
  'settlement',
  'inspection',
  'chart',
  'policy',
  'meeting',
  'reservation',
  'budget',
  'sales',
  'inventoryRecovery',
  'dataCollection',
  'smsManagement',
  'obManagement',
  'onSaleManagement',
  'mealAllowance',
  'attendance',
  'riskManagement',
  'directStoreManagement',
  'basicMode',
  'directStore',
  'onSaleReception'
];

export const resolveModeKey = (mode) => {
  if (!mode) return null;
  return MODE_KEY_ALIASES[mode] || mode;
};

export const getModeConfig = (mode) => {
  const key = resolveModeKey(mode);
  return key ? MODE_CONFIG[key] : undefined;
};

export const getModeColor = (mode, fallback = '#1976d2') => {
  return getModeConfig(mode)?.color || fallback;
};

export const getModeTitle = (mode, fallback = '알 수 없는 모드') => {
  return getModeConfig(mode)?.title || fallback;
};

export const getModeIcon = (mode) => {
  const config = getModeConfig(mode);
  return config?.icon || BusinessIcon;
};

