/**
 * 통합 캡처 로직 (레거시 호환성 유지)
 * 새로운 UnifiedCaptureEngine로 리다이렉트
 * 
 * 모든 슬라이드별 특수 핸들러는 UnifiedCaptureEngine.js로 이동
 * 98% 이상 성공률을 목표로 한 완전 통합 아키텍처
 */

import { captureSlide } from './UnifiedCaptureEngine';

/**
 * 레거시 호환성을 위한 unifiedCapture 함수
 * 새로운 UnifiedCaptureEngine.captureSlide로 위임
 * 
 * @param {HTMLElement} slideElement - 슬라이드 요소
 * @param {Object} slide - 슬라이드 정보 객체
 * @param {HTMLElement} captureTargetElement - 캡처 대상 요소
 * @returns {Promise<Blob>} 캡처된 이미지 Blob
 */
export async function unifiedCapture(slideElement, slide, captureTargetElement, meeting = null) {
  return await captureSlide(slideElement, slide, captureTargetElement, meeting);
}

// 기존 슬라이드별 특수 핸들러는 UnifiedCaptureEngine.js로 완전 이동
// 모든 로직은 설정 기반 통합 파이프라인으로 처리됨
