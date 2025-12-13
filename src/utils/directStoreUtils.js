/**
 * 직영점모드 공통 유틸리티 함수
 * 모델명 정규화, 데이터 변환 등 공통 로직
 */

/**
 * 모델 코드 정규화 함수
 * 공백, 하이픈, 언더스코어 제거, 대문자 변환, 용량 표기 통일
 * @param {string} modelCode - 원본 모델 코드
 * @returns {string} 정규화된 모델 코드
 */
export const normalizeModelCode = (modelCode) => {
  if (!modelCode) return '';
  let normalized = modelCode.toString().trim().toUpperCase();

  // 1. 공백, 하이픈, 언더스코어 제거
  normalized = normalized.replace(/[\s\-_]/g, '');

  // 2. 용량 표기 통일
  // 256G, 256GB -> 256
  // 512G, 512GB -> 512
  // 128G, 128GB -> 128
  normalized = normalized.replace(/(\d+)(GB|G)$/, '$1');

  // 3. 1T, 1TB -> 1T 통일
  normalized = normalized.replace(/(\d+)TB$/, '$1T');

  return normalized;
};

/**
 * 하이픈 변형 생성 함수
 * @param {string} model - 모델명
 * @returns {string[]} 하이픈 변형 배열
 */
export const generateHyphenVariants = (model) => {
  if (!model) return [];
  
  const variants = new Set();
  const normalized = model.replace(/[\s\-_]/g, '');
  
  // 원본 추가
  variants.add(model);
  
  // 하이픈 추가 변형
  if (normalized.length > 0) {
    // 예: SM-S928N256 -> SMS928N256, SM-S928-N256 등
    const parts = normalized.match(/([A-Z]+)(\d+)([A-Z]*)(\d*)/);
    if (parts) {
      const [, brand, num1, mid, num2] = parts;
      if (brand && num1) {
        variants.add(`${brand}-${num1}${mid || ''}${num2 || ''}`);
        if (mid && num2) {
          variants.add(`${brand}-${num1}-${mid}${num2}`);
        }
      }
    }
  }
  
  return Array.from(variants);
};

/**
 * 개통유형 문자열을 표준화하여 배열로 반환
 * @param {string} raw - 원본 개통유형 문자열
 * @returns {string[]} 표준화된 개통유형 배열 ['010신규', 'MNP', '기변']
 */
export const parseOpeningTypes = (raw) => {
  const text = (raw || '').toString().toLowerCase().replace(/\s/g, '');

  // 전유형 키워드 처리
  if (text.includes('전유형') || text.includes('전체') || text.includes('모두')) {
    return ['010신규', 'MNP', '기변'];
  }

  const types = [];

  // 010 신규
  if (text.includes('010') || text.includes('신규')) types.push('010신규');

  // MNP / 번호이동
  if (text.includes('mnp') || text.includes('번호이동')) types.push('MNP');

  // 기변
  if (text.includes('기변') || text.includes('기기변경')) types.push('기변');

  // 기본값
  if (types.length === 0) return ['010신규'];

  return [...new Set(types)];
};

/**
 * 개통유형 변환 (010신규/MNP/기변 -> NEW/MNP/CHANGE)
 * @param {string} type - 개통유형
 * @returns {string} 변환된 개통유형
 */
export const convertOpeningType = (type) => {
  if (!type) return 'NEW';
  if (type === '010신규' || type === 'NEW') return 'NEW';
  if (type === 'MNP') return 'MNP';
  if (type === '기변' || type === 'CHANGE') return 'CHANGE';
  return 'NEW';
};

/**
 * 개통유형 역변환 (NEW/MNP/CHANGE -> 010신규/MNP/기변)
 * @param {string} type - 개통유형
 * @returns {string} 변환된 개통유형
 */
export const reverseConvertOpeningType = (type) => {
  if (!type) return '010신규';
  if (type === 'NEW') return '010신규';
  if (type === 'MNP') return 'MNP';
  if (type === 'CHANGE') return '기변';
  return '010신규';
};

/**
 * 금액 포맷팅 (천 단위 콤마)
 * @param {number} amount - 금액
 * @returns {string} 포맷팅된 금액 문자열
 */
export const formatPrice = (amount) => {
  if (amount === null || amount === undefined) return '0';
  return Number(amount).toLocaleString('ko-KR');
};

/**
 * 금액 파싱 (콤마 제거)
 * @param {string|number} value - 금액 문자열 또는 숫자
 * @returns {number} 파싱된 금액
 */
export const parsePrice = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    return Number(value.replace(/,/g, '')) || 0;
  }
  return 0;
};

/**
 * 통신사별 테마 색상
 */
export const CARRIER_THEMES = {
  SK: {
    primary: '#00a9e0',
    secondary: '#e60012',
    bg: '#f0f9fc'
  },
  KT: {
    primary: '#00abc7',
    secondary: '#333',
    bg: '#f0fcfc'
  },
  LG: {
    primary: '#ec008c',
    secondary: '#333',
    bg: '#fcf0f6'
  }
};

/**
 * 통신사 이름 가져오기
 * @param {string} carrier - 통신사 코드
 * @returns {string} 통신사 이름
 */
export const getCarrierName = (carrier) => {
  const names = {
    SK: 'SKT',
    KT: 'KT',
    LG: 'LG U+'
  };
  return names[carrier] || carrier;
};

/**
 * 요금제군 표시명 생성
 * @param {string} planName - 요금제명
 * @param {string} planGroup - 요금제군
 * @returns {string} 표시명 (예: "5GX 프라임(115군)")
 */
export const formatPlanDisplayName = (planName, planGroup) => {
  if (!planName) return '';
  return planGroup ? `${planName}(${planGroup})` : planName;
};

/**
 * 이미지 URL 검증
 * @param {string} url - 이미지 URL
 * @returns {boolean} 유효한 URL인지 여부
 */
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 디버그 로그 헬퍼 (개발 환경에서만)
 * @param {string} tag - 태그
 * @param {any} data - 데이터
 */
export const debugLog = (tag, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${tag}]`, data);
  }
};

/**
 * 에러 메시지 정규화
 * @param {Error|string} error - 에러 객체 또는 문자열
 * @returns {string} 사용자 친화적인 에러 메시지
 */
export const normalizeErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return '알 수 없는 오류가 발생했습니다.';
};
