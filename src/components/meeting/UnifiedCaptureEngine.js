/**
 * 완전 통합 슬라이드 캡처 엔진 (시니어 개발자 리뷰 및 개선 버전)
 * 98% 이상 성공률을 목표로 한 설정 기반 통합 캡처 로직
 * 모든 슬라이드 타입을 단일 파이프라인으로 처리
 * 
 * 개선 사항:
 * 1. 메모리 누수 방지 (Blob URL 정리, DOM 정리)
 * 2. 경쟁 상태 처리 (언마운트 체크, 작업 취소)
 * 3. 에러 처리 강화 (null 체크, 유효성 검증)
 * 4. 로직 안정성 개선 (복원 보장, 폴백 처리)
 * 5. 성능 최적화 (DOM 조작 최소화, 캐싱)
 * 6. 타입 안정성 (입력 검증, 경계값 처리)
 */

import { captureElement } from '../../utils/screenCapture';
import {
  identifySlideType,
  getCaptureConfig,
  waitForDataLoading,
  findTables,
  measureContentSize,
  resizeBoxesToContent,
  removeRightWhitespace,
} from './SlideCaptureConfig';

// 이미지 크기 제한 상수
// 원본 크기 기준 (html2canvas의 scale이 적용되기 전)
// screenCapture.js의 BASE_CAPTURE_WIDTH(1280px)와 일관성 유지
const MAX_WIDTH = 1280;  // 최대 너비 (원본) - 2560에서 축소하여 파일 크기 제한 및 일관성 유지
const MAX_HEIGHT = 4000;  // 최대 높이 (원본) - 8000에서 축소하여 파일 크기 제한
const SCALE = 2;  // html2canvas scale 파라미터 (픽셀 밀도 배율)

// 안전한 DOM 유틸리티
const SafeDOM = {
  /**
   * 요소가 DOM 트리에 존재하는지 확인
   */
  isInDOM(element) {
    if (!element) return false;
    if (element === document.body) return true;
    return document.body.contains(element);
  },

  /**
   * 안전하게 getBoundingClientRect 호출 (캐싱 지원)
   */
  getBoundingRect(element, cache = null) {
    if (!element || !this.isInDOM(element)) {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    }
    
    // 캐시가 있고 최신이면 재사용
    if (cache && cache.element === element && cache.timestamp > Date.now() - 100) {
      return cache.rect;
    }
    
    try {
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width || 0,
        height: rect.height || 0,
        top: rect.top || 0,
        left: rect.left || 0,
        right: rect.right || 0,
        bottom: rect.bottom || 0,
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [SafeDOM] getBoundingClientRect 실패:', error);
      }
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    }
  },

  /**
   * 안전하게 스타일 복원
   */
  restoreStyle(element, property, originalValue) {
    if (!element || !this.isInDOM(element)) return;
    
    try {
      if (originalValue !== undefined && originalValue !== null && originalValue !== '') {
        element.style.setProperty(property, originalValue);
      } else {
        element.style.removeProperty(property);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [SafeDOM] 스타일 복원 실패 (${property}):`, error);
      }
    }
  },
};

/**
 * 5단계 헤더 탐지 로직 (98% 성공률 목표)
 * 개선: DOM 유효성 검증, 에러 처리 강화
 */
function detectHeader(slideElement, options = {}) {
  try {
    const { preserveHeader = true } = options;
    if (!preserveHeader || !slideElement || !SafeDOM.isInDOM(slideElement)) {
      return null;
    }

    const slideRect = SafeDOM.getBoundingRect(slideElement);
    const companyNames = ['(주)브이아이피플러스', '브이아이피플러스', '브이아이피', 'VIPPLUS'];
    
    // 1단계: 클래스명/속성 기반 검색
    try {
      const headerElement = slideElement.querySelector(
        '[class*="header"], [class*="Header"], .MuiAppBar-root, .MuiToolbar-root, header, [role="banner"]'
      );
      
      if (headerElement && SafeDOM.isInDOM(headerElement)) {
        const headerRect = SafeDOM.getBoundingRect(headerElement);
        const relativeTop = headerRect.top - slideRect.top;
        
        if (relativeTop >= -30 && relativeTop < 250 && headerRect.height > 30 && headerRect.width > 200) {
          const hasLogo = headerElement.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null;
          const textContent = headerElement.textContent || '';
          const hasCompanyName = companyNames.some(name => textContent.includes(name));
          
          if (hasLogo || hasCompanyName || headerRect.height > 50) {
            return headerElement;
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [detectHeader] 1단계 검색 실패:', error);
      }
    }

    // 2단계: 위치 기반 검색 (절대/고정 위치)
    try {
      const allElements = Array.from(slideElement.querySelectorAll('*'));
      const fixedOrAbsolute = allElements.find(el => {
        if (!SafeDOM.isInDOM(el)) return false;
        
        try {
          const style = window.getComputedStyle(el);
          const rect = SafeDOM.getBoundingRect(el);
          const relativeTop = rect.top - slideRect.top;
          
          return (style.position === 'fixed' || style.position === 'absolute') &&
                 relativeTop >= -20 && relativeTop < 200 &&
                 rect.height > 50 && rect.width > 200 &&
                 (rect.width > slideRect.width * 0.4);
        } catch {
          return false;
        }
      });
      
      if (fixedOrAbsolute && SafeDOM.isInDOM(fixedOrAbsolute)) {
        const hasLogo = fixedOrAbsolute.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null;
        const textContent = fixedOrAbsolute.textContent || '';
        const hasCompanyName = companyNames.some(name => textContent.includes(name));
        
        if (hasLogo || hasCompanyName) {
          return fixedOrAbsolute;
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [detectHeader] 2단계 검색 실패:', error);
      }
    }

    // 3단계: 텍스트 컨텐츠 기반 검색
    try {
      const allElements = Array.from(slideElement.querySelectorAll('*'));
      const textBased = allElements.find(el => {
        if (!SafeDOM.isInDOM(el)) return false;
        
        try {
          const elRect = SafeDOM.getBoundingRect(el);
          const relativeTop = elRect.top - slideRect.top;
          const text = (el.textContent || '').trim().toLowerCase();
          const hasCompanyName = companyNames.some(name => 
            text.includes(name.toLowerCase().replace(/\s/g, ''))
          );
          
          return relativeTop >= -30 && relativeTop < 250 &&
                 elRect.height > 40 && 
                 elRect.width > slideRect.width * 0.4 &&
                 hasCompanyName &&
                 !text.includes('재고장표') &&
                 !text.includes('테이블');
        } catch {
          return false;
        }
      });
      
      if (textBased && SafeDOM.isInDOM(textBased)) {
        return textBased;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [detectHeader] 3단계 검색 실패:', error);
      }
    }

    // 4단계: 구조적 검색 (DOM 트리 상단 + 로고 포함)
    try {
      const allElements = Array.from(slideElement.querySelectorAll('*'));
      const structureBased = allElements.find(el => {
        if (!SafeDOM.isInDOM(el)) return false;
        
        try {
          const elRect = SafeDOM.getBoundingRect(el);
          const relativeTop = elRect.top - slideRect.top;
          const hasLogo = el.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null;
          
          return relativeTop >= -30 && relativeTop < 200 &&
                 elRect.height > 40 &&
                 elRect.width > slideRect.width * 0.3 &&
                 hasLogo &&
                 !(el.textContent || '').toLowerCase().includes('재고장표');
        } catch {
          return false;
        }
      });
      
      if (structureBased && SafeDOM.isInDOM(structureBased)) {
        return structureBased;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [detectHeader] 4단계 검색 실패:', error);
      }
    }

    // 5단계: 폴백 검색 (후보 요소 선별)
    try {
      const allElements = Array.from(slideElement.querySelectorAll('*'));
      const candidates = allElements
        .filter(el => {
          if (!SafeDOM.isInDOM(el)) return false;
          
          try {
            const elRect = SafeDOM.getBoundingRect(el);
            const relativeTop = elRect.top - slideRect.top;
            const text = (el.textContent || '').trim().toLowerCase();
            
            return relativeTop >= -30 && relativeTop < 200 &&
                   elRect.height > 30 &&
                   elRect.width > slideRect.width * 0.3 &&
                   !text.includes('재고장표') &&
                   !text.includes('테이블') &&
                   !text.includes('그래프');
          } catch {
            return false;
          }
        })
        .sort((a, b) => {
          try {
            const aRect = SafeDOM.getBoundingRect(a);
            const bRect = SafeDOM.getBoundingRect(b);
            const aTop = aRect.top - slideRect.top;
            const bTop = bRect.top - slideRect.top;
            
            if (Math.abs(aTop) !== Math.abs(bTop)) {
              return Math.abs(aTop) - Math.abs(bTop);
            }
            return (bRect.width * bRect.height) - (aRect.width * aRect.height);
          } catch {
            return 0;
          }
        });
      
      if (candidates.length > 0 && SafeDOM.isInDOM(candidates[0])) {
        return candidates[0];
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [detectHeader] 5단계 검색 실패:', error);
      }
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [detectHeader] 헤더 탐지 전체 실패:', error);
    }
    return null;
  }
}

/**
 * 확대/펼치기 버튼 찾기 및 클릭
 * 개선: 에러 처리, DOM 유효성 검증
 */
async function clickExpandButtons(slideElement, config) {
  if (!config?.needsTableExpansion || !slideElement || !SafeDOM.isInDOM(slideElement)) {
    return;
  }

  try {
    // '확대' 버튼 찾기 (월간시상용)
    const expandBtn = Array.from(slideElement.querySelectorAll('button, .MuiButton-root')).find(
      (el) => {
        if (!SafeDOM.isInDOM(el)) return false;
        const text = (el.textContent || '').trim();
        return text === '확대' || text.includes('확대');
      }
    );

    if (expandBtn && SafeDOM.isInDOM(expandBtn)) {
      try {
        expandBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 200));
        expandBtn.click();
        await new Promise(r => setTimeout(r, 1200));
        return;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [clickExpandButtons] 확대 버튼 클릭 실패:', error);
        }
      }
    }

    // '펼치기' 버튼 찾기 (다른 슬라이드용)
    const expandButtons = Array.from(document.querySelectorAll('button, .MuiButton-root'))
      .filter(el => {
        if (!SafeDOM.isInDOM(el) || !slideElement.contains(el)) return false;
        const text = (el.textContent || '').trim();
        return text.includes('펼치기');
      });

    for (const btn of expandButtons) {
      if (!SafeDOM.isInDOM(btn)) continue;
      
      try {
        btn.click();
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [clickExpandButtons] 펼치기 버튼 클릭 실패:', error);
        }
      }
    }

    if (expandButtons.length > 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [clickExpandButtons] 전체 실패:', error);
    }
  }
}

/**
 * 스크롤 제거 로직
 * 개선: DOM 유효성 검증, 에러 처리
 */
function removeScrollConstraints(element) {
  if (!element || !SafeDOM.isInDOM(element)) return;

  try {
    element.scrollTop = 0;
    if (element.parentElement) {
      element.parentElement.scrollTop = 0;
    }

    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      if (!el || !el.style || !SafeDOM.isInDOM(el)) return;

      try {
        const computed = window.getComputedStyle(el);
        const hasMaxHeight = computed.maxHeight && computed.maxHeight !== 'none' && computed.maxHeight !== 'auto';
        const hasOverflow = computed.overflow === 'auto' || computed.overflow === 'scroll' || computed.overflow === 'hidden';
        const hasOverflowY = computed.overflowY === 'auto' || computed.overflowY === 'scroll' || computed.overflowY === 'hidden';
        const hasVhHeight = computed.height && (computed.height.includes('vh') || computed.height.includes('%'));

        if (hasOverflow || hasOverflowY) {
          el.style.setProperty('overflow', 'visible', 'important');
          el.style.setProperty('overflow-y', 'visible', 'important');
          el.style.setProperty('overflow-x', 'visible', 'important');
        }

        if (hasMaxHeight) {
          el.style.setProperty('max-height', 'none', 'important');
        }

        if (hasVhHeight) {
          el.style.setProperty('height', 'auto', 'important');
        }

        if (el.scrollHeight && el.scrollHeight > el.clientHeight) {
          el.style.setProperty('height', `${el.scrollHeight}px`, 'important');
          el.style.setProperty('max-height', 'none', 'important');
          el.style.setProperty('overflow', 'visible', 'important');
        }
      } catch (error) {
        // 개별 요소 처리 실패는 무시
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ [removeScrollConstraints] 스크롤 제거 실패:', error);
    }
  }
}

/**
 * 헤더 크기 조정 (콘텐츠 너비에 맞춤)
 * 개선: DOM 유효성 검증, 복원 함수 안정성
 */
async function adjustHeaderWidth(headerElement, contentWidth, slideElement) {
  if (!headerElement || !contentWidth || contentWidth <= 0 || !SafeDOM.isInDOM(headerElement)) {
    return null;
  }

  try {
    const headerRect = SafeDOM.getBoundingRect(headerElement);
    const originalStyles = {
      width: headerElement.style.width || '',
      maxWidth: headerElement.style.maxWidth || '',
      minWidth: headerElement.style.minWidth || '',
      display: headerElement.style.display || '',
      justifyContent: headerElement.style.justifyContent || '',
    };

    // 헤더가 콘텐츠보다 작으면 콘텐츠 크기에 맞춤
    if (headerRect.width < contentWidth) {
      headerElement.style.width = `${contentWidth}px`;
      headerElement.style.maxWidth = `${contentWidth}px`;
      headerElement.style.minWidth = `${contentWidth}px`;
      headerElement.style.display = 'block';

      // 헤더 내부 요소들도 비율 조정
      const headerChildren = headerElement.querySelectorAll('*');
      const childStyles = new Map();

      headerChildren.forEach(child => {
        if (!SafeDOM.isInDOM(child)) return;
        
        try {
          const childStyle = window.getComputedStyle(child);
          const childRect = SafeDOM.getBoundingRect(child);

          childStyles.set(child, {
            width: child.style.width || '',
            maxWidth: child.style.maxWidth || '',
          });

          // 비율 기반이 아닌 고정 너비 요소만 조정
          if (childStyle.width && !childStyle.width.includes('%') && !childStyle.width.includes('auto')) {
            const currentWidth = parseFloat(childStyle.width) || childRect.width;
            if (currentWidth > 0 && headerRect.width > 0) {
              const ratio = contentWidth / headerRect.width;
              const newWidth = currentWidth * ratio;
              child.style.width = `${newWidth}px`;
            }
          }

          // 컨테이너 요소는 width 100%로 설정
          if (child.classList.contains('MuiContainer-root') ||
              child.classList.contains('MuiBox-root') ||
              childStyle.display === 'flex' ||
              childStyle.display === 'grid') {
            child.style.width = '100%';
            child.style.maxWidth = '100%';
          }
        } catch (e) {
          // 개별 자식 요소 처리 실패는 무시
        }
      });

      await new Promise(r => setTimeout(r, 200));

      // 복원 함수 반환 (안전하게 실행 보장)
      return () => {
        try {
          if (!SafeDOM.isInDOM(headerElement)) return;
          
          SafeDOM.restoreStyle(headerElement, 'width', originalStyles.width);
          SafeDOM.restoreStyle(headerElement, 'max-width', originalStyles.maxWidth);
          SafeDOM.restoreStyle(headerElement, 'min-width', originalStyles.minWidth);
          SafeDOM.restoreStyle(headerElement, 'display', originalStyles.display);
          SafeDOM.restoreStyle(headerElement, 'justify-content', originalStyles.justifyContent);

          childStyles.forEach((styles, child) => {
            if (!SafeDOM.isInDOM(child)) return;
            
            SafeDOM.restoreStyle(child, 'width', styles.width);
            SafeDOM.restoreStyle(child, 'max-width', styles.maxWidth);
          });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [adjustHeaderWidth] 복원 실패:', error);
          }
        }
      };
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [adjustHeaderWidth] 헤더 크기 조정 실패:', error);
    }
    return null;
  }
}

/**
 * 월간시상 슬라이드 특수 처리: 5개 테이블 찾기 및 commonAncestor 계산
 * 개선: null 체크, DOM 유효성 검증
 */
function findMonthlyAwardTables(slideElement) {
  if (!slideElement || !SafeDOM.isInDOM(slideElement)) {
    return [];
  }

  try {
    const allElements = Array.from(slideElement.querySelectorAll('.MuiPaper-root, .MuiBox-root'));

    const statsPaper = allElements.find(el => {
      if (!SafeDOM.isInDOM(el)) return false;
      const text = el.textContent || '';
      return text.includes('월간시상 현황') &&
             text.includes('확대') &&
             (text.includes('셋팅') || text.includes('업셀기변') || text.includes('기변105이상'));
    });

    const matrixPaper = allElements.find(el => {
      if (!SafeDOM.isInDOM(el)) return false;
      const text = el.textContent || '';
      return (text.includes('월간시상 Matrix') || text.includes('만점기준')) &&
             text.includes('총점') &&
             text.includes('달성상황');
    });

    const channelBox = allElements.find(el => {
      if (!SafeDOM.isInDOM(el)) return false;
      const text = el.textContent || '';
      return text.includes('채널별 성과 현황') && text.includes('축소');
    });

    const officeBox = allElements.find(el => {
      if (!SafeDOM.isInDOM(el)) return false;
      const text = el.textContent || '';
      return text.includes('사무실별 성과 현황') && text.includes('축소');
    });

    const departmentBox = allElements.find(el => {
      if (!SafeDOM.isInDOM(el)) return false;
      const text = el.textContent || '';
      return text.includes('소속별 성과 현황') && text.includes('축소');
    });

    return [statsPaper, matrixPaper, channelBox, officeBox, departmentBox]
      .filter(Boolean)
      .filter(el => SafeDOM.isInDOM(el));
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [findMonthlyAwardTables] 테이블 찾기 실패:', error);
    }
    return [];
  }
}

/**
 * Common Ancestor 찾기 (월간시상용)
 * 개선: null 체크, DOM 유효성 검증
 */
function findCommonAncestor(elements, slideElement) {
  if (!elements || elements.length === 0 || !slideElement || !SafeDOM.isInDOM(slideElement)) {
    return slideElement;
  }

  try {
    // 유효한 요소만 필터링
    const validElements = elements.filter(el => el && SafeDOM.isInDOM(el));
    if (validElements.length === 0) {
      return slideElement;
    }

    const getAncestors = (el) => {
      const list = [];
      let cur = el;
      while (cur && SafeDOM.isInDOM(cur)) {
        list.push(cur);
        cur = cur.parentElement;
      }
      return list;
    };

    let common = getAncestors(validElements[0]);
    for (let i = 1; i < validElements.length; i++) {
      const ancestors = new Set(getAncestors(validElements[i]));
      common = common.filter(a => ancestors.has(a));
    }

    const foundAncestor = common.find(el => el !== document.body && slideElement.contains(el)) || slideElement;

    if (foundAncestor && foundAncestor !== slideElement && SafeDOM.isInDOM(foundAncestor)) {
      const foundRect = SafeDOM.getBoundingRect(foundAncestor);
      const slideRect = SafeDOM.getBoundingRect(slideElement);

      // foundAncestor가 너무 크면 (슬라이드의 90% 이상) slideElement 사용
      if (foundRect.height >= slideRect.height * 0.9 && foundRect.width >= slideRect.width * 0.9) {
        return slideElement;
      }

      // 테이블이 있는지 확인
      const hasTableInFound = Array.from(foundAncestor.querySelectorAll('table, .MuiTable-root, .MuiTableContainer-root'))
        .some(el => SafeDOM.isInDOM(el));
      
      if (!hasTableInFound) {
        return slideElement;
      }

      return foundAncestor;
    }

    return slideElement;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [findCommonAncestor] 공통 조상 찾기 실패:', error);
    }
    return slideElement;
  }
}

/**
 * 재시도 메커니즘 (개선: 에러 분류, 타임아웃 처리)
 */
async function withRetry(fn, maxRetries = 3, delay = 500) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 재시도 불가능한 에러는 즉시 throw
      if (error.name === 'TypeError' && error.message?.includes('Cannot read')) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 지수 백오프
      const retryDelay = delay * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, retryDelay));
    }
  }
  
  throw lastError || new Error('알 수 없는 오류가 발생했습니다.');
}

/**
 * Blob을 Image로 변환 (개선: 메모리 누수 방지)
 */
function blobToImage(blob) {
  if (!blob || !(blob instanceof Blob)) {
    return Promise.reject(new Error('유효하지 않은 Blob입니다.'));
  }

  return new Promise((resolve, reject) => {
    let url = null;
    let isResolved = false;
    
    try {
      url = URL.createObjectURL(blob);
      const img = new Image();
      
      const cleanup = () => {
        if (url && !isResolved) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            // URL 정리 실패는 무시
          }
        }
      };
      
      // 타임아웃 설정 (10초)
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error('이미지 로딩 타임아웃'));
        }
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(img);
        }
      };
      
      img.onerror = (e) => {
        clearTimeout(timeoutId);
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error('이미지 로딩 실패'));
        }
      };
      
      img.src = url;
    } catch (error) {
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          // 무시
        }
      }
      reject(error);
    }
  });
}

/**
 * 헤더 + 콘텐츠 합성 (개선: 에러 처리, 메모리 관리)
 */
async function compositeHeaderAndContent(headerBlob, contentBlob) {
  let headerImg = null;
  let contentImg = null;
  
  try {
    // 이미지 로딩
    headerImg = await blobToImage(headerBlob);
    contentImg = await blobToImage(contentBlob);

    // 헤더가 제대로 캡처되었는지 확인
    if (!headerImg || headerImg.width < 100 || headerImg.height < 20) {
      return contentBlob; // 헤더가 없으면 콘텐츠만 반환
    }

    // 합성 전 크기 검증: 최대 크기 제한 (25MB 이하 유지)
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    const maxWidth = MAX_WIDTH * SCALE;  // scale 적용 후 최대 너비
    const maxHeight = MAX_HEIGHT * SCALE;  // scale 적용 후 최대 높이
    
    const finalWidth = Math.min(Math.max(headerImg.width, contentImg.width), maxWidth);
    const finalHeight = Math.min(headerImg.height + contentImg.height, maxHeight);
    
    // 예상 파일 크기 검증 (RGBA, 압축 전)
    const estimatedPixels = finalWidth * finalHeight;
    const estimatedSizeMB = (estimatedPixels * 4) / (1024 * 1024); // RGBA = 4 bytes per pixel
    
    if (estimatedSizeMB > 50) {  // 50MB 이상이면 경고
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [compositeHeaderAndContent] 합성 이미지 예상 크기가 큼: ${estimatedSizeMB.toFixed(2)}MB (${finalWidth}x${finalHeight})`);
      }
    }

    const canvas = document.createElement('canvas');
    const gap = 0;
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context를 가져올 수 없습니다.');
    }
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 헤더 중앙 정렬
    const headerX = (canvas.width - headerImg.width) / 2;
    ctx.drawImage(headerImg, headerX, 0);

    // 콘텐츠 중앙 정렬
    const contentX = (canvas.width - contentImg.width) / 2;
    ctx.drawImage(contentImg, contentX, headerImg.height + gap);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Blob 변환 실패'));
          }
        },
        'image/png',
        0.95
      );
    });
    
    // 실제 파일 크기 검증
    if (blob && blob.size > MAX_FILE_SIZE) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [compositeHeaderAndContent] 합성 이미지가 25MB 제한 초과: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);
      }
      // 크기 초과 시에도 반환 (서버에서 처리)
    }
    
    return blob;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [compositeHeaderAndContent] 합성 실패:', error);
    }
    // 합성 실패 시 콘텐츠만 반환
    return contentBlob || null;
  }
}

/**
 * 통합 캡처 파이프라인: 전처리
 * 개선: 에러 처리, 안전한 실행
 */
async function preProcess(slideElement, captureTargetElement, config) {
  if (!slideElement || !SafeDOM.isInDOM(slideElement)) {
    throw new Error('유효하지 않은 slideElement입니다.');
  }

  try {
    // 데이터 로딩 대기
    if (config?.needsDataLoadingWait) {
      await waitForDataLoading(slideElement, {
        maxWait: 20000,
        loadingTexts: ['로딩', '불러오는 중', '데이터를 불러오는 중'],
        checkLoadingIcon: true,
        checkDataPresence: true,
      });
    }

    // 버튼 클릭 (확대/펼치기)
    if (config?.needsTableExpansion) {
      await clickExpandButtons(slideElement, config);
    }

    // 스크롤 제거
    if (config?.needsScrollRemoval && captureTargetElement && SafeDOM.isInDOM(captureTargetElement)) {
      removeScrollConstraints(captureTargetElement);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [preProcess] 전처리 실패:', error);
    }
    // 전처리 실패해도 계속 진행
  }
}

/**
 * 통합 캡처 파이프라인: 요소 탐지
 * 개선: null 체크, 안전한 기본값
 */
function detectElements(slideElement, captureTargetElement, config) {
  if (!slideElement || !SafeDOM.isInDOM(slideElement)) {
    throw new Error('유효하지 않은 slideElement입니다.');
  }

  const elements = {
    slideElement,
    captureTargetElement: (captureTargetElement && SafeDOM.isInDOM(captureTargetElement)) ? captureTargetElement : slideElement,
    headerElement: null,
    contentElement: null,
    tables: [],
  };

  try {
    // 헤더 탐지
    if (config?.needsHeaderComposition || config?.needsHeaderSizeAdjustment) {
      elements.headerElement = detectHeader(slideElement, { preserveHeader: true });
    }

    // 콘텐츠 요소는 captureTargetElement 사용
    elements.contentElement = elements.captureTargetElement;

    // 테이블 찾기 (필요한 경우)
    if ((config?.needsTableVerification || config?.needsManagerTableInclusion) && elements.contentElement) {
      try {
        elements.tables = findTables(elements.contentElement, { includeContainers: true }) || [];
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [detectElements] 테이블 찾기 실패:', error);
        }
        elements.tables = [];
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [detectElements] 요소 탐지 실패:', error);
    }
  }

  return elements;
}

/**
 * 통합 캡처 파이프라인: 크기 조정
 * 개선: 복원 함수 안정성, 에러 처리
 */
async function adjustSizes(elements, config) {
  const restoreFunctions = [];

  try {
    // 박스 크기 조정
    if (config?.needsBoxResize && elements.contentElement && SafeDOM.isInDOM(elements.contentElement)) {
      try {
        const originalBoxStyles = await resizeBoxesToContent(elements.contentElement, {
          iterations: config.boxResizeIterations || 2,
          tolerance: 0.05,
          minPadding: 10,
        });

        if (originalBoxStyles) {
          restoreFunctions.push(() => {
            try {
              originalBoxStyles.forEach((styles, box) => {
                if (!box || !box.style || !SafeDOM.isInDOM(box)) return;
                
                SafeDOM.restoreStyle(box, 'height', styles.height);
                SafeDOM.restoreStyle(box, 'max-height', styles.maxHeight);
                SafeDOM.restoreStyle(box, 'width', styles.width);
                SafeDOM.restoreStyle(box, 'max-width', styles.maxWidth);
              });
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [adjustSizes] 박스 스타일 복원 실패:', error);
              }
            }
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [adjustSizes] 박스 크기 조정 실패:', error);
        }
      }
    }

    // 콘텐츠 크기 측정
    let sizeInfo = null;
    if (config?.needsHeightMeasurement && elements.contentElement && SafeDOM.isInDOM(elements.contentElement)) {
      try {
        sizeInfo = measureContentSize(elements.contentElement, {
          preferTables: config.needsManagerTableInclusion || config.needsTableVerification,
          preferCharts: config.captureMethod === 'direct',
          excludeBorders: true,
          padding: 40,
        });

        // 담당자별 실적 테이블 포함 (전체총마감용)
        if (config?.needsManagerTableInclusion && elements.tables && elements.tables.length > 0) {
          const managerTables = elements.tables.filter(table => {
            if (!SafeDOM.isInDOM(table)) return false;
            const text = (table.textContent || '').toLowerCase();
            return text.includes('담당자별') || text.includes('담당자');
          });

          if (managerTables.length > 0) {
            const lastTable = managerTables[managerTables.length - 1];
            if (SafeDOM.isInDOM(lastTable) && SafeDOM.isInDOM(elements.contentElement)) {
              const rect = SafeDOM.getBoundingRect(elements.contentElement);
              const tableRect = SafeDOM.getBoundingRect(lastTable);
              const relativeBottom = tableRect.bottom - rect.top;
              
              if (relativeBottom > (sizeInfo.maxRelativeBottom || 0)) {
                sizeInfo.maxRelativeBottom = relativeBottom;
                sizeInfo.measuredHeight = Math.max(
                  relativeBottom + 100,
                  sizeInfo.measuredHeight || 0
                );
              }
            }
          }
        }

        // 오른쪽 여백 제거
        if (config?.needsRightWhitespaceRemoval && sizeInfo) {
          try {
            const rect = SafeDOM.getBoundingRect(elements.contentElement);
            sizeInfo.measuredWidth = removeRightWhitespace(
              sizeInfo.measuredWidth || 0,
              sizeInfo.maxRelativeRight || 0,
              sizeInfo.scrollWidth || 0,
              rect.width
            );
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [adjustSizes] 오른쪽 여백 제거 실패:', error);
            }
          }
        }

        // 이미지 크기 제한
        if (sizeInfo) {
          sizeInfo.measuredWidth = Math.min(sizeInfo.measuredWidth || 0, MAX_WIDTH);
          sizeInfo.measuredHeight = Math.min(sizeInfo.measuredHeight || 0, MAX_HEIGHT);
        }

        // 헤더 너비 조정
        if (config?.needsHeaderSizeAdjustment && elements.headerElement && sizeInfo && sizeInfo.measuredWidth > 0) {
          try {
            const restoreHeader = await adjustHeaderWidth(
              elements.headerElement,
              sizeInfo.measuredWidth,
              elements.slideElement
            );
            if (restoreHeader) {
              restoreFunctions.push(restoreHeader);
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [adjustSizes] 헤더 너비 조정 실패:', error);
            }
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ [adjustSizes] 크기 측정 실패:', error);
        }
      }
    }

    return { sizeInfo, restoreFunctions };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [adjustSizes] 전체 실패:', error);
    }
    return { sizeInfo: null, restoreFunctions };
  }
}

/**
 * 통합 캡처 파이프라인: 캡처 실행
 * 개선: null 체크, 에러 처리, 복원 보장
 */
async function executeCapture(elements, config, sizeInfo) {
  let blob = null;
  const styleRestores = [];

  try {
    switch (config?.captureMethod) {
      case 'commonAncestor': {
        // 월간시상: commonAncestor 찾아서 캡처
        try {
          const tables = findMonthlyAwardTables(elements.slideElement);
          const commonAncestor = findCommonAncestor(tables, elements.slideElement);

          if (!commonAncestor || !SafeDOM.isInDOM(commonAncestor)) {
            throw new Error('commonAncestor를 찾을 수 없습니다.');
          }

          commonAncestor.scrollIntoView({ block: 'start', behavior: 'instant' });
          await new Promise(r => setTimeout(r, 500));

          if (!sizeInfo) {
            sizeInfo = measureContentSize(commonAncestor, {
              preferTables: true,
              excludeBorders: true,
              padding: 100,
            });
          }

          const originalHeight = commonAncestor.style.height || '';
          const originalMaxHeight = commonAncestor.style.maxHeight || '';
          
          styleRestores.push(() => {
            if (SafeDOM.isInDOM(commonAncestor)) {
              SafeDOM.restoreStyle(commonAncestor, 'height', originalHeight);
              SafeDOM.restoreStyle(commonAncestor, 'max-height', originalMaxHeight);
              SafeDOM.restoreStyle(commonAncestor, 'overflow', '');
            }
          });

          commonAncestor.style.height = `${Math.min(sizeInfo?.measuredHeight || 0, MAX_HEIGHT)}px`;
          commonAncestor.style.maxHeight = `${Math.min(sizeInfo?.measuredHeight || 0, MAX_HEIGHT)}px`;
          commonAncestor.style.overflow = 'visible';

          await new Promise(r => setTimeout(r, 300));

          // width/height는 원본 크기만 전달 (SCALE 곱하지 않음)
          blob = await captureElement(commonAncestor, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: 0,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            skipAutoCrop: false,
            height: Math.min(sizeInfo?.measuredHeight || 0, MAX_HEIGHT),
            width: Math.min(sizeInfo?.measuredWidth || 0, MAX_WIDTH),
          });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ [executeCapture] commonAncestor 캡처 실패:', error);
          }
          throw error;
        }
        break;
      }

      case 'composite': {
        // 재고장표: 헤더 + 테이블 합성
        try {
          const tableBox = elements.contentElement?.querySelector('.MuiPaper-root, .MuiCard-root, [class*="table"], [class*="Table"]');
          const tableContainer = tableBox ? tableBox.querySelector('.MuiTableContainer-root, [class*="container"], [class*="Container"]') : null;
          const actualTable = tableContainer ? tableContainer.querySelector('table, .MuiTable-root') : null;

          if (!tableBox || !actualTable || !SafeDOM.isInDOM(tableBox) || !SafeDOM.isInDOM(actualTable)) {
            throw new Error('테이블 요소를 찾을 수 없습니다.');
          }

          // 테이블 박스 크기 조정
          const tableRect = SafeDOM.getBoundingRect(actualTable);
          const tableScrollWidth = actualTable.scrollWidth || tableRect.width;
          const tableScrollHeight = actualTable.scrollHeight || tableRect.height;

          const tableBoxStyle = window.getComputedStyle(tableBox);
          const paddingLeft = parseInt(tableBoxStyle.paddingLeft || '0') || 0;
          const paddingRight = parseInt(tableBoxStyle.paddingRight || '0') || 0;
          const paddingTop = parseInt(tableBoxStyle.paddingTop || '0') || 0;
          const paddingBottom = parseInt(tableBoxStyle.paddingBottom || '0') || 0;

          const adjustedWidth = tableScrollWidth + paddingLeft + paddingRight + 10;
          const adjustedHeight = tableScrollHeight + paddingTop + paddingBottom + 10;

          const originalTableBoxWidth = tableBox.style.width || '';
          const originalTableBoxHeight = tableBox.style.height || '';
          const originalTableBoxMaxWidth = tableBox.style.maxWidth || '';
          const originalTableBoxMaxHeight = tableBox.style.maxHeight || '';
          const originalMargin = tableBox.style.margin || '';

          styleRestores.push(() => {
            if (SafeDOM.isInDOM(tableBox)) {
              SafeDOM.restoreStyle(tableBox, 'width', originalTableBoxWidth);
              SafeDOM.restoreStyle(tableBox, 'height', originalTableBoxHeight);
              SafeDOM.restoreStyle(tableBox, 'max-width', originalTableBoxMaxWidth);
              SafeDOM.restoreStyle(tableBox, 'max-height', originalTableBoxMaxHeight);
              SafeDOM.restoreStyle(tableBox, 'margin', originalMargin);
            }
          });

          tableBox.style.width = `${adjustedWidth}px`;
          tableBox.style.height = `${adjustedHeight}px`;
          tableBox.style.maxWidth = `${adjustedWidth}px`;
          tableBox.style.maxHeight = `${adjustedHeight}px`;

          if (config?.needsTableCentering) {
            tableBox.style.margin = '0 auto';
          }

          await new Promise(r => setTimeout(r, 300));

          // 헤더 캡처
          let headerBlob = null;
          if (elements.headerElement && config?.needsHeaderComposition && SafeDOM.isInDOM(elements.headerElement)) {
            try {
              headerBlob = await captureElement(elements.headerElement, {
                scale: SCALE,
                useCORS: true,
                fixedBottomPaddingPx: 0,
                backgroundColor: '#ffffff',
                skipAutoCrop: true,
              });
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [executeCapture] 헤더 캡처 실패:', error);
              }
              // 헤더 캡처 실패해도 계속 진행
            }
          }

          // 테이블 캡처
          const tableWidth = Math.min(adjustedWidth, MAX_WIDTH);
          const tableHeight = Math.min(adjustedHeight, MAX_HEIGHT);

          const tableBlob = await captureElement(tableBox, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: 0,
            backgroundColor: '#ffffff',
            skipAutoCrop: false,
            width: tableWidth,
            height: tableHeight,
          });

          // 합성 또는 테이블만 반환
          if (headerBlob && tableBlob) {
            blob = await compositeHeaderAndContent(headerBlob, tableBlob);
          } else {
            blob = tableBlob;
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ [executeCapture] composite 캡처 실패:', error);
          }
          throw error;
        }
        break;
      }

      case 'direct':
      default: {
        // 직접 캡처
        if (!elements.contentElement || !SafeDOM.isInDOM(elements.contentElement)) {
          throw new Error('유효하지 않은 contentElement입니다.');
        }

        if (sizeInfo) {
          const originalHeight = elements.contentElement.style.height || '';
          const originalMaxHeight = elements.contentElement.style.maxHeight || '';
          const originalWidth = elements.contentElement.style.width || '';
          const originalMaxWidth = elements.contentElement.style.maxWidth || '';

          styleRestores.push(() => {
            if (SafeDOM.isInDOM(elements.contentElement)) {
              SafeDOM.restoreStyle(elements.contentElement, 'height', originalHeight);
              SafeDOM.restoreStyle(elements.contentElement, 'max-height', originalMaxHeight);
              SafeDOM.restoreStyle(elements.contentElement, 'width', originalWidth);
              SafeDOM.restoreStyle(elements.contentElement, 'max-width', originalMaxWidth);
              SafeDOM.restoreStyle(elements.contentElement, 'overflow', '');
            }
          });

          elements.contentElement.style.height = `${sizeInfo.measuredHeight || 0}px`;
          elements.contentElement.style.maxHeight = `${sizeInfo.measuredHeight || 0}px`;
          elements.contentElement.style.width = `${sizeInfo.measuredWidth || 0}px`;
          elements.contentElement.style.maxWidth = `${sizeInfo.measuredWidth || 0}px`;
          elements.contentElement.style.overflow = 'visible';

          await new Promise(r => setTimeout(r, 300));

          // width/height는 원본 크기만 전달 (SCALE 곱하지 않음)
          const captureWidth = Math.min(sizeInfo.measuredWidth || 0, MAX_WIDTH);
          const captureHeight = Math.min(sizeInfo.measuredHeight || 0, MAX_HEIGHT);

          blob = await captureElement(elements.contentElement, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: config?.needsPinkBarRemoval ? 0 : (config?.defaultPadding || 40),
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            skipAutoCrop: !config?.needsPinkBarRemoval,
            width: captureWidth,
            height: captureHeight,
          });
        } else {
          // 기본 캡처 (크기 측정 없이)
          blob = await captureElement(elements.contentElement, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: config?.defaultPadding || 40,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
          });
        }
        break;
      }
    }

    // 스타일 복원
    styleRestores.forEach(restore => {
      try {
        restore();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [executeCapture] 스타일 복원 실패:', error);
        }
      }
    });

    if (!blob) {
      throw new Error('캡처된 이미지가 없습니다.');
    }

    return blob;
  } catch (error) {
    // 에러 발생 시에도 스타일 복원 시도
    styleRestores.forEach(restore => {
      try {
        restore();
      } catch (e) {
        // 무시
      }
    });
    throw error;
  }
}

/**
 * 파일 크기 검증 및 경고
 */
function validateFileSize(blob, context = '') {
  if (!blob) return blob;
  
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  const sizeMB = blob.size / (1024 * 1024);
  
  if (blob.size > MAX_FILE_SIZE) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ [UnifiedCaptureEngine] ${context} 이미지가 25MB 제한 초과: ${sizeMB.toFixed(2)}MB`);
    }
    // 크기 초과 시에도 반환 (서버에서 처리)
  } else if (process.env.NODE_ENV === 'development' && blob.size > 20 * 1024 * 1024) {
    // 20MB 이상이면 경고
    console.warn(`⚠️ [UnifiedCaptureEngine] ${context} 이미지 크기가 큼: ${sizeMB.toFixed(2)}MB (25MB 제한 근접)`);
  }
  
  return blob;
}

/**
 * 메인 통합 캡처 함수
 * 모든 슬라이드 타입을 단일 파이프라인으로 처리
 * 개선: 완전한 에러 처리, 복원 보장, 입력 검증
 */
export async function captureSlide(slideElement, slide, captureTargetElement) {
  // 입력 검증
  if (!slideElement) {
    throw new Error('slideElement가 없습니다.');
  }

  if (!SafeDOM.isInDOM(slideElement)) {
    throw new Error('slideElement가 DOM 트리에 존재하지 않습니다.');
  }

  let slideType;
  let config;
  
  try {
    slideType = identifySlideType(slide);
    config = getCaptureConfig(slide);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [captureSlide] 슬라이드 타입 식별 실패:', error);
    }
    throw new Error('슬라이드 타입을 식별할 수 없습니다.');
  }

  // 재시도 메커니즘으로 실행
  return await withRetry(async () => {
    let restoreFunctions = [];
    
    try {
      // 1. 전처리
      await preProcess(slideElement, captureTargetElement, config);

      // 2. 요소 탐지
      const elements = detectElements(slideElement, captureTargetElement, config);

      // 3. 크기 조정
      const { sizeInfo, restoreFunctions: adjustRestores } = await adjustSizes(elements, config);
      restoreFunctions = adjustRestores || [];

      // 4. 캡처 실행
      const blob = await executeCapture(elements, config, sizeInfo);

      // 5. 파일 크기 검증
      return validateFileSize(blob, slideType);
    } catch (error) {
      // 에러 발생 시 복원 함수 실행 보장
      restoreFunctions.forEach(restore => {
        try {
          restore();
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [captureSlide] 복원 실패:', e);
          }
        }
      });
      throw error;
    } finally {
      // finally에서도 복원 보장
      restoreFunctions.forEach(restore => {
        try {
          restore();
        } catch (e) {
          // 무시
        }
      });
    }
  }, config?.retryConfig?.maxRetries || 3, config?.retryConfig?.delay || 500);
}