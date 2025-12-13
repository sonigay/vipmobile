/**
 * 직영점모드 금액 계산 엔진
 * 모든 금액 계산 로직을 한 곳에 통합하여 관리
 */

import { parsePrice, formatPrice } from './directStoreUtils';

/**
 * 할부수수료 계산 (연 5.9%, 원리금균등상환)
 * @param {number} principal - 할부원금
 * @param {number} period - 할부기간 (개월)
 * @returns {{total: number, monthly: number}} 총 할부수수료, 월 할부수수료
 */
export const calculateInstallmentFee = (principal, period) => {
  const rate = 0.059; // 연이율 5.9%
  
  if (period === 0 || principal === 0) {
    return { total: 0, monthly: 0 };
  }

  const monthlyRate = rate / 12;
  const monthlyPayment = 
    (principal * monthlyRate * Math.pow(1 + monthlyRate, period)) / 
    (Math.pow(1 + monthlyRate, period) - 1);
  const totalPayment = monthlyPayment * period;
  const totalFee = totalPayment - principal; // 총 할부수수료

  return {
    total: Math.floor(totalFee / 10) * 10, // 10원 단위 절사
    monthly: Math.floor(monthlyPayment / 10) * 10
  };
};

/**
 * 요금제 기본료 계산 (선택약정 할인, LG 프리미어 할인 포함)
 * @param {number} baseFee - 기본 요금제 기본료
 * @param {string} contractType - 약정 유형 ('standard' | 'selected')
 * @param {string} carrier - 통신사 ('SK' | 'KT' | 'LG')
 * @param {boolean} lgPremier - LG 프리미어 약정 적용 여부
 * @returns {number} 계산된 요금제 기본료
 */
export const calculatePlanFee = (baseFee, contractType, carrier, lgPremier = false) => {
  let fee = baseFee;

  // 선택약정 할인 (25%)
  if (contractType === 'selected') {
    fee = fee * 0.75;
  }

  // LG 프리미어 약정 할인 (-5,250원)
  if (carrier === 'LG' && lgPremier && baseFee >= 85000) {
    fee = fee - 5250;
  }

  return Math.floor(fee / 10) * 10; // 10원 단위 절사
};

/**
 * 필수 부가서비스 월요금 합계 계산
 * @param {Array<{monthlyFee: number}>} requiredAddons - 필수 부가서비스 목록
 * @returns {number} 월요금 합계
 */
export const calculateRequiredAddonsFee = (requiredAddons = []) => {
  return requiredAddons.reduce((sum, addon) => sum + (addon.monthlyFee || 0), 0);
};

/**
 * 할부원금 계산 (부가유치)
 * @param {number} factoryPrice - 출고가
 * @param {number} publicSupport - 이통사지원금
 * @param {number} storeSupportWithAddon - 대리점추가지원금 (부가유치)
 * @param {boolean} usePublicSupport - 이통사지원금 사용 여부
 * @returns {number} 할부원금
 */
export const calculateInstallmentPrincipalWithAddon = (
  factoryPrice,
  publicSupport,
  storeSupportWithAddon,
  usePublicSupport = true
) => {
  const support = usePublicSupport ? publicSupport : 0;
  return Math.max(0, factoryPrice - support - storeSupportWithAddon);
};

/**
 * 할부원금 계산 (부가미유치)
 * @param {number} factoryPrice - 출고가
 * @param {number} publicSupport - 이통사지원금
 * @param {number} storeSupportWithoutAddon - 대리점추가지원금 (부가미유치)
 * @param {boolean} usePublicSupport - 이통사지원금 사용 여부
 * @returns {number} 할부원금
 */
export const calculateInstallmentPrincipalWithoutAddon = (
  factoryPrice,
  publicSupport,
  storeSupportWithoutAddon,
  usePublicSupport = true
) => {
  const support = usePublicSupport ? publicSupport : 0;
  return Math.max(0, factoryPrice - support - storeSupportWithoutAddon);
};

/**
 * 최종 월 납부금 계산
 * @param {string} paymentType - 결제 유형 ('installment' | 'cash')
 * @param {number} installmentPrincipal - 할부원금
 * @param {number} installmentPeriod - 할부기간
 * @param {number} planFee - 요금제 기본료
 * @param {number} addonsFee - 부가서비스 월요금
 * @returns {number} 최종 월 납부금
 */
export const calculateTotalMonthlyFee = (
  paymentType,
  installmentPrincipal,
  installmentPeriod,
  planFee,
  addonsFee
) => {
  if (paymentType === 'cash') {
    return 0; // 현금은 월 납부 없음
  }

  const installmentFee = calculateInstallmentFee(installmentPrincipal, installmentPeriod);
  return installmentFee.monthly + planFee + addonsFee;
};

/**
 * 현금가 계산
 * @param {number} installmentPrincipal - 할부원금
 * @param {number} customCashPrice - 사용자 입력 현금가
 * @returns {number} 현금가
 */
export const calculateCashPrice = (installmentPrincipal, customCashPrice = 0) => {
  if (installmentPrincipal > 0 && customCashPrice === 0) {
    return installmentPrincipal;
  }
  return customCashPrice;
};

/**
 * 구매가 계산 (부가유치)
 * @param {number} factoryPrice - 출고가
 * @param {number} publicSupport - 이통사지원금
 * @param {number} storeSupportWithAddon - 대리점추가지원금 (부가유치)
 * @returns {number} 구매가
 */
export const calculatePurchasePriceWithAddon = (
  factoryPrice,
  publicSupport,
  storeSupportWithAddon
) => {
  return Math.max(0, factoryPrice - publicSupport - storeSupportWithAddon);
};

/**
 * 구매가 계산 (부가미유치)
 * @param {number} factoryPrice - 출고가
 * @param {number} publicSupport - 이통사지원금
 * @param {number} storeSupportWithoutAddon - 대리점추가지원금 (부가미유치)
 * @returns {number} 구매가
 */
export const calculatePurchasePriceWithoutAddon = (
  factoryPrice,
  publicSupport,
  storeSupportWithoutAddon
) => {
  return Math.max(0, factoryPrice - publicSupport - storeSupportWithoutAddon);
};

/**
 * 대리점 지원금 계산 (부가유치)
 * @param {number} policyRebate - 정책표 요금제군별 리베이트
 * @param {number} baseMargin - 마진
 * @param {number} totalAddonIncentive - 부가서비스 추가금액
 * @param {number} totalSpecialAddition - 별도정책 추가금액
 * @returns {number} 대리점 지원금
 */
export const calculateStoreSupportWithAddon = (
  policyRebate,
  baseMargin,
  totalAddonIncentive,
  totalSpecialAddition
) => {
  return Math.max(0,
    policyRebate - baseMargin + totalAddonIncentive + totalSpecialAddition
  );
};

/**
 * 대리점 지원금 계산 (부가미유치)
 * @param {number} policyRebate - 정책표 요금제군별 리베이트
 * @param {number} baseMargin - 마진
 * @param {number} totalAddonDeduction - 부가서비스 차감금액
 * @param {number} totalSpecialDeduction - 별도정책 차감금액
 * @returns {number} 대리점 지원금
 */
export const calculateStoreSupportWithoutAddon = (
  policyRebate,
  baseMargin,
  totalAddonDeduction,
  totalSpecialDeduction
) => {
  return Math.max(0,
    policyRebate - baseMargin + totalAddonDeduction + totalSpecialDeduction
  );
};

/**
 * 통합 가격 계산 (모든 가격 정보를 한 번에 계산)
 * @param {Object} params - 계산 파라미터
 * @param {number} params.factoryPrice - 출고가
 * @param {number} params.publicSupport - 이통사지원금
 * @param {number} params.storeSupportWithAddon - 대리점추가지원금 (부가유치)
 * @param {number} params.storeSupportWithoutAddon - 대리점추가지원금 (부가미유치)
 * @param {boolean} params.withAddon - 부가유치 여부
 * @param {boolean} params.usePublicSupport - 이통사지원금 사용 여부
 * @returns {Object} 계산된 가격 정보
 */
export const calculateAllPrices = ({
  factoryPrice,
  publicSupport,
  storeSupportWithAddon,
  storeSupportWithoutAddon,
  withAddon = true,
  usePublicSupport = true
}) => {
  const storeSupport = withAddon ? storeSupportWithAddon : storeSupportWithoutAddon;
  const installmentPrincipal = withAddon
    ? calculateInstallmentPrincipalWithAddon(factoryPrice, publicSupport, storeSupportWithAddon, usePublicSupport)
    : calculateInstallmentPrincipalWithoutAddon(factoryPrice, publicSupport, storeSupportWithoutAddon, usePublicSupport);
  
  const purchasePrice = withAddon
    ? calculatePurchasePriceWithAddon(factoryPrice, publicSupport, storeSupportWithAddon)
    : calculatePurchasePriceWithoutAddon(factoryPrice, publicSupport, storeSupportWithoutAddon);

  return {
    storeSupport,
    installmentPrincipal,
    purchasePrice,
    cashPrice: calculateCashPrice(installmentPrincipal, 0)
  };
};
