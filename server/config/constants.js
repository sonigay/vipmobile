/**
 * Constants Configuration
 * 
 * 이 모듈은 서버 전체에서 사용되는 상수들을 정의합니다.
 * - Google Sheets 시트 이름
 * - 캐시 TTL 설정
 * - Rate Limit 설정
 * 
 * Requirements: 2.1
 */

/**
 * Google Sheets 시트 이름 상수
 * 
 * 모든 시트 이름을 중앙에서 관리하여 일관성을 유지하고
 * 시트 이름 변경 시 한 곳에서만 수정하면 되도록 합니다.
 */
const SHEET_NAMES = {
  // 대리점 및 사용자 관리
  AGENT_MANAGEMENT: '대리점아이디관리',
  GENERAL_MODE_PERMISSION: '일반모드권한관리',
  
  // 폰클 데이터
  PHONEKL_STORE_DATA: '폰클출고처데이터',
  PHONEKL_INVENTORY_DATA: '폰클재고데이터',
  PHONEKL_ACTIVATION_DATA: '폰클개통데이터',
  
  // 직영점 관련
  DIRECT_SALES_DAILY: '직영점_판매일보',
  DIRECT_TODAY_PHONE: '직영점_오늘의휴대폰',
  DIRECT_SETTINGS: '직영점_설정',
  DIRECT_MODEL_IMAGE: '직영점_모델이미지',
  DIRECT_DEVICE_MASTER: '직영점_단말마스터',
  DIRECT_POLICY_MARGIN: '직영점_정책_마진',
  DIRECT_POLICY_ADDON: '직영점_정책_부가서비스',
  DIRECT_POLICY_SEPARATE: '직영점_정책_별도',
  
  // 회의 관련
  MEETING_LIST: '회의목록',
  
  // 지도 및 재고 관리
  MAP_DISPLAY_OPTION: '지도재고노출옵션',
  
  // 예산 관리
  BUDGET_POLICY_GROUP: '예산_정책그룹관리',
  BUDGET_USER_SHEET: '예산_사용자시트관리',
  BUDGET_FACE_VALUE: '액면예산',
  
  // 온세일 관련
  ONSALE: '온세일',
  ONSALE_LINK_MANAGEMENT: '온세일링크관리',
  ONSALE_POLICY_BOARD: '온세일정책게시판',
  
  // 기타
  MADANG_RECEPTION: '마당접수',
  PRE_RESERVATION_SITE: '사전예약사이트',
  POLICY_NOTICE: '정책모드공지사항',
  BOND_DETAILS: '재초담초채권_내역',
  SALES_STORE_INFO: '판매점정보'
};

/**
 * 캐시 TTL (Time To Live) 설정
 * 
 * 캐시된 데이터의 유효 시간을 밀리초 단위로 정의합니다.
 * 기본값: 5분 (300,000ms)
 */
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 최대 캐시 크기
 * 
 * 메모리에 저장할 수 있는 최대 캐시 항목 수입니다.
 */
const MAX_CACHE_SIZE = 200;

/**
 * Rate Limit 설정
 * 
 * Google Sheets API 호출 빈도를 제한하기 위한 설정입니다.
 * - COOLDOWN: 연속된 API 호출 사이의 최소 대기 시간 (밀리초)
 * - MAX_RETRIES: Rate Limit 에러 발생 시 최대 재시도 횟수
 */
const RATE_LIMIT_COOLDOWN = 500; // 500ms
const RATE_LIMIT_MAX_RETRIES = 5; // 최대 5회 재시도

/**
 * API Rate Limit 설정
 * 
 * Google Sheets API 무료 할당량을 고려한 분당 최대 요청 수입니다.
 * 무료 할당량: 60회/분 → 안전하게 45회/분으로 제한
 */
const API_MAX_REQUESTS_PER_MINUTE = 45;

/**
 * 동시 요청 제한
 * 
 * 서버가 동시에 처리할 수 있는 최대 요청 수입니다.
 */
const MAX_CONCURRENT_REQUESTS = 10;

/**
 * 타임아웃 설정
 * 
 * HTTP 요청의 최대 처리 시간 (밀리초)입니다.
 */
const REQUEST_TIMEOUT = 5 * 60 * 1000; // 5분

/**
 * SMS 캐시 TTL
 * 
 * SMS API 응답의 캐시 유효 시간입니다.
 */
const SMS_CACHE_TTL = 10 * 1000; // 10초

module.exports = {
  // 시트 이름
  SHEET_NAMES,
  
  // 캐시 설정
  CACHE_TTL,
  MAX_CACHE_SIZE,
  SMS_CACHE_TTL,
  
  // Rate Limit 설정
  RATE_LIMIT_COOLDOWN,
  RATE_LIMIT_MAX_RETRIES,
  API_MAX_REQUESTS_PER_MINUTE,
  
  // 동시성 설정
  MAX_CONCURRENT_REQUESTS,
  
  // 타임아웃 설정
  REQUEST_TIMEOUT
};
