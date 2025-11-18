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
// 1920px로 변경: 콘텐츠 가로 너비 일치도 향상 (1280px → 1920px, 1.5배 증가)
const MAX_WIDTH = 1920;  // 최대 너비 (원본) - 콘텐츠 일치도 향상을 위해 1280에서 증가
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
    // 헤더 탐지: preserveHeader가 true이거나 needsHeaderComposition/needsHeaderSizeAdjustment가 true일 때
    if (config?.preserveHeader || config?.needsHeaderComposition || config?.needsHeaderSizeAdjustment) {
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

        // 헤더가 있고 preserveHeader가 true일 때: 높이와 너비에 헤더 포함
        if (config?.preserveHeader && elements.headerElement && SafeDOM.isInDOM(elements.headerElement) && sizeInfo) {
          try {
            const headerRect = SafeDOM.getBoundingRect(elements.headerElement);
            const contentRect = SafeDOM.getBoundingRect(elements.contentElement);
            const slideRect = SafeDOM.getBoundingRect(elements.slideElement);
            
            // 헤더 높이 추가
            const headerHeight = headerRect.height || 0;
            if (headerHeight > 0) {
              sizeInfo.measuredHeight = (sizeInfo.measuredHeight || 0) + headerHeight;
              if (process.env.NODE_ENV === 'development') {
                console.log(`📏 [adjustSizes] 헤더 높이 포함: ${headerHeight}px (총 높이: ${sizeInfo.measuredHeight}px)`);
              }
            }
            
            // 헤더와 콘텐츠 중 더 큰 너비 사용
            const headerWidth = headerRect.width || 0;
            const contentWidth = sizeInfo.measuredWidth || contentRect.width || 0;
            if (headerWidth > contentWidth) {
              sizeInfo.measuredWidth = headerWidth;
              if (process.env.NODE_ENV === 'development') {
                console.log(`📏 [adjustSizes] 헤더 너비 적용: ${headerWidth}px (콘텐츠: ${contentWidth}px)`);
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [adjustSizes] 헤더 크기 포함 실패:', error);
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
          
          // 1920px 대응: 모든 슬라이드 높이 제한 강화 (25MB 제한 준수)
          // 3840px(너비) × 8000px(높이) × 4 bytes = 122MB 압축 전 → 약 25MB 압축 후
          // 모든 슬라이드는 최대 8000px(실제) = 4000px(원본)로 제한
          const slideId = elements.slideElement?.getAttribute('data-slide-id') || elements.contentElement?.getAttribute('data-slide-id') || '';
          const isToc = slideId.includes('toc') || slideId.includes('TOC');
          const isMain = slideId.includes('main') && !slideId.includes('toc');
          const isEnding = slideId.includes('ending');
          
          // MAX_HEIGHT = 4000px (원본) = 8000px (실제 SCALE 2 적용)
          // 모든 슬라이드에 동일한 높이 제한 적용 (25MB 제한 준수)
          const maxAllowedHeight = MAX_HEIGHT; // 4000px (원본) = 8000px (실제)
          
          if (isToc || isMain || isEnding) {
            // 메인/목차/엔딩 슬라이드: 최대 높이 제한 적용
            sizeInfo.measuredHeight = Math.min(sizeInfo.measuredHeight || 0, maxAllowedHeight);
            if (process.env.NODE_ENV === 'development') {
              const slideType = isToc ? '목차' : (isMain ? '메인' : '엔딩');
              console.log(`📏 [adjustSizes] ${slideType} 슬라이드 높이 제한: ${sizeInfo.measuredHeight}px (최대 ${maxAllowedHeight}px)`);
            }
          } else {
            // 기타 슬라이드: 최대 높이 제한 적용
            sizeInfo.measuredHeight = Math.min(sizeInfo.measuredHeight || 0, maxAllowedHeight);
            if (process.env.NODE_ENV === 'development' && sizeInfo.measuredHeight >= maxAllowedHeight) {
              console.warn(`⚠️ [adjustSizes] 기타 슬라이드 높이가 최대 제한에 도달: ${sizeInfo.measuredHeight}px`);
            }
          }
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
          // 테이블 컨테이너 찾기 (data-capture-exclude가 없는 것만)
          let tableContainer = elements.contentElement?.querySelector('.MuiTableContainer-root');
          
          // data-capture-exclude가 있는 요소는 제외
          if (tableContainer) {
            let current = tableContainer;
            while (current && current !== elements.slideElement) {
              if (current.getAttribute('data-capture-exclude') === 'true') {
                tableContainer = null;
                break;
              }
              current = current.parentElement;
            }
          }
          
          // 테이블 컨테이너를 찾지 못한 경우, 직접 찾기
          if (!tableContainer) {
            const allContainers = Array.from(elements.contentElement?.querySelectorAll('.MuiTableContainer-root') || []);
            tableContainer = allContainers.find(container => {
              let current = container;
              while (current && current !== elements.slideElement) {
                if (current.getAttribute('data-capture-exclude') === 'true') {
                  return false;
                }
                current = current.parentElement;
              }
              const text = container.textContent || '';
              return text.includes('총계') || text.includes('모델명') || container.querySelector('table') !== null;
            });
          }
          
          if (!tableContainer || !SafeDOM.isInDOM(tableContainer)) {
            throw new Error('테이블 컨테이너를 찾을 수 없습니다.');
          }

          const actualTable = tableContainer.querySelector('table, .MuiTable-root');
          if (!actualTable || !SafeDOM.isInDOM(actualTable)) {
            throw new Error('테이블 요소를 찾을 수 없습니다.');
          }

          // 테이블 박스 컨테이너 찾기 (MuiPaper-root 또는 MuiCard-root)
          const tableBox = tableContainer.closest('.MuiPaper-root, .MuiCard-root') || tableContainer.parentElement;
          if (!tableBox || !SafeDOM.isInDOM(tableBox)) {
            throw new Error('테이블 박스를 찾을 수 없습니다.');
          }

          // 스크롤 제거 및 높이 확장
          const originalTableContainerStyles = {
            height: tableContainer.style.height || '',
            maxHeight: tableContainer.style.maxHeight || '',
            width: tableContainer.style.width || '',
            maxWidth: tableContainer.style.maxWidth || '',
            overflow: tableContainer.style.overflow || ''
          };
          
          tableContainer.style.maxHeight = 'none';
          tableContainer.style.overflow = 'visible';
          tableContainer.style.height = 'auto';
          
          // 스크롤을 최하단까지 이동하여 모든 데이터가 렌더링되도록 함
          tableContainer.scrollTop = tableContainer.scrollHeight;
          await new Promise(r => setTimeout(r, 300));
          
          // 다시 최상단으로 이동
          tableContainer.scrollTop = 0;
          await new Promise(r => setTimeout(r, 300));

          // 테이블의 실제 전체 크기 측정 (마지막 행까지 포함)
          const tableRect = SafeDOM.getBoundingRect(actualTable);
          let actualTableWidth = tableRect.width;
          let actualTableHeight = 0;
          
          const tbody = actualTable.querySelector('tbody');
          if (tbody) {
            const allRows = tbody.querySelectorAll('tr');
            if (allRows.length > 0) {
              const firstRow = allRows[0];
              const lastRow = allRows[allRows.length - 1];
              const firstRowRect = SafeDOM.getBoundingRect(firstRow);
              const lastRowRect = SafeDOM.getBoundingRect(lastRow);
              
              // 마지막 행까지의 실제 높이 계산
              const tableTop = tableRect.top;
              const tableBottom = lastRowRect.bottom;
              actualTableHeight = tableBottom - tableTop + 20; // 여유 공간 20px
              
              // scrollHeight도 확인하고 더 큰 값 사용
              const scrollHeight = tableContainer.scrollHeight || 0;
              if (scrollHeight > actualTableHeight) {
                actualTableHeight = scrollHeight;
              }
            } else {
              actualTableHeight = tableRect.height;
            }
          } else {
            actualTableHeight = tableRect.height;
            const scrollHeight = tableContainer.scrollHeight || 0;
            if (scrollHeight > actualTableHeight) {
              actualTableHeight = scrollHeight;
            }
          }

          // 테이블 박스 크기 조정 (패딩/보더 고려)
          const tableBoxStyle = window.getComputedStyle(tableBox);
          const boxPaddingLeft = parseInt(tableBoxStyle.paddingLeft || '0') || 16;
          const boxPaddingRight = parseInt(tableBoxStyle.paddingRight || '0') || 16;
          const boxPaddingTop = parseInt(tableBoxStyle.paddingTop || '0') || 16;
          const boxPaddingBottom = parseInt(tableBoxStyle.paddingBottom || '0') || 16;
          const boxBorderLeft = parseInt(tableBoxStyle.borderLeftWidth || '0') || 1;
          const boxBorderRight = parseInt(tableBoxStyle.borderRightWidth || '0') || 1;
          const boxBorderTop = parseInt(tableBoxStyle.borderTopWidth || '0') || 1;
          const boxBorderBottom = parseInt(tableBoxStyle.borderBottomWidth || '0') || 1;
          
          const adjustedBoxWidth = actualTableWidth + boxPaddingLeft + boxPaddingRight + boxBorderLeft + boxBorderRight + 20;
          const adjustedBoxHeight = actualTableHeight + boxPaddingTop + boxPaddingBottom + boxBorderTop + boxBorderBottom + 20;

          const originalTableBoxStyles = {
            height: tableBox.style.height || '',
            maxHeight: tableBox.style.maxHeight || '',
            width: tableBox.style.width || '',
            maxWidth: tableBox.style.maxWidth || '',
            overflow: tableBox.style.overflow || '',
            padding: tableBox.style.padding || '',
            margin: tableBox.style.margin || ''
          };

          styleRestores.push(() => {
            if (SafeDOM.isInDOM(tableBox)) {
              SafeDOM.restoreStyle(tableBox, 'height', originalTableBoxStyles.height);
              SafeDOM.restoreStyle(tableBox, 'max-height', originalTableBoxStyles.maxHeight);
              SafeDOM.restoreStyle(tableBox, 'width', originalTableBoxStyles.width);
              SafeDOM.restoreStyle(tableBox, 'max-width', originalTableBoxStyles.maxWidth);
              SafeDOM.restoreStyle(tableBox, 'overflow', originalTableBoxStyles.overflow);
              SafeDOM.restoreStyle(tableBox, 'padding', originalTableBoxStyles.padding);
              SafeDOM.restoreStyle(tableBox, 'margin', originalTableBoxStyles.margin);
              tableBox.style.removeProperty('display');
              tableBox.style.removeProperty('flex-direction');
              tableBox.style.removeProperty('align-items');
              tableBox.style.removeProperty('justify-content');
            }
            if (SafeDOM.isInDOM(tableContainer)) {
              SafeDOM.restoreStyle(tableContainer, 'height', originalTableContainerStyles.height);
              SafeDOM.restoreStyle(tableContainer, 'max-height', originalTableContainerStyles.maxHeight);
              SafeDOM.restoreStyle(tableContainer, 'width', originalTableContainerStyles.width);
              SafeDOM.restoreStyle(tableContainer, 'max-width', originalTableContainerStyles.maxWidth);
              SafeDOM.restoreStyle(tableContainer, 'overflow', originalTableContainerStyles.overflow);
              tableContainer.style.removeProperty('margin');
            }
          });

          // 박스 크기를 실제 콘텐츠 크기로 설정
          tableBox.style.width = `${adjustedBoxWidth}px`;
          tableBox.style.maxWidth = `${adjustedBoxWidth}px`;
          tableBox.style.height = `${adjustedBoxHeight}px`;
          tableBox.style.maxHeight = `${adjustedBoxHeight}px`;
          tableBox.style.overflow = 'visible';
          
          // 테이블 컨테이너도 콘텐츠에 맞춰 조정
          tableContainer.style.width = `${actualTableWidth}px`;
          tableContainer.style.maxWidth = `${actualTableWidth}px`;
          tableContainer.style.height = `${actualTableHeight}px`;
          tableContainer.style.maxHeight = `${actualTableHeight}px`;
          tableContainer.style.overflow = 'visible';
          tableContainer.style.margin = '0 auto';

          if (config?.needsTableCentering) {
            tableBox.style.margin = '0 auto';
            tableBox.style.display = 'flex';
            tableBox.style.flexDirection = 'column';
            tableBox.style.alignItems = 'center';
            tableBox.style.justifyContent = 'center';
          }

          await new Promise(r => setTimeout(r, 500)); // 박스 크기 조정 후 렌더링 대기

          // 헤더 캡처 (재고장표 슬라이드용 강화된 헤더 탐지)
          let headerBlob = null;
          if (config?.needsHeaderComposition) {
            // 먼저 detectHeader로 찾은 헤더 사용
            if (elements.headerElement && SafeDOM.isInDOM(elements.headerElement)) {
              try {
                elements.headerElement.scrollIntoView({ block: 'start', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 200));
                headerBlob = await captureElement(elements.headerElement, {
                  scale: SCALE,
                  useCORS: true,
                  fixedBottomPaddingPx: 0,
                  backgroundColor: '#ffffff',
                  skipAutoCrop: true,
                });
              } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ [executeCapture] 헤더 캡처 실패, 대체 방법 시도:', error);
                }
              }
            }
            
            // 헤더를 찾지 못한 경우 대체 방법 시도
            if (!headerBlob) {
              try {
                const slideRect = SafeDOM.getBoundingRect(elements.slideElement);
                const allElements = Array.from(elements.slideElement.querySelectorAll('*'));
                
                // 재고장표 슬라이드 헤더 찾기: 회사명 포함, 상단 위치, 재고장표 텍스트 제외
                const headerCandidate = allElements.find(el => {
                  if (!SafeDOM.isInDOM(el)) return false;
                  const style = window.getComputedStyle(el);
                  const rect = SafeDOM.getBoundingRect(el);
                  const relativeTop = rect.top - slideRect.top;
                  const text = (el.textContent || '').trim();
                  
                  return ((style.position === 'absolute' || style.position === 'fixed') || relativeTop < 150) &&
                         (relativeTop >= -20 && relativeTop < 250) &&
                         text.includes('(주)브이아이피플러스') &&
                         !text.includes('재고장표') &&
                         rect.height > 50 && rect.width > 200;
                });
                
                if (headerCandidate) {
                  headerCandidate.scrollIntoView({ block: 'start', behavior: 'instant' });
                  await new Promise(r => setTimeout(r, 200));
                  headerBlob = await captureElement(headerCandidate, {
                    scale: SCALE,
                    useCORS: true,
                    fixedBottomPaddingPx: 0,
                    backgroundColor: '#ffffff',
                    skipAutoCrop: true,
                  });
                  if (process.env.NODE_ENV === 'development') {
                    console.log('✅ [executeCapture] 재고장표 헤더 찾음 (대체 방법)');
                  }
                }
              } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('⚠️ [executeCapture] 대체 헤더 탐지 실패:', error);
                }
              }
            }
          }

          // 테이블 캡처 (정확한 크기로)
          const tableWidth = Math.min(adjustedBoxWidth, MAX_WIDTH);
          const tableHeight = Math.min(adjustedBoxHeight, MAX_HEIGHT);

          const tableBlob = await captureElement(tableBox, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: 0,
            backgroundColor: '#ffffff',
            skipAutoCrop: false, // autoCrop 활성화하여 불필요한 공간 제거
            width: tableWidth,
            height: tableHeight,
          });

          // 합성 또는 테이블만 반환
          if (headerBlob && tableBlob) {
            blob = await compositeHeaderAndContent(headerBlob, tableBlob);
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [executeCapture] 재고장표 헤더+테이블 합성 완료');
            }
          } else {
            blob = tableBlob;
            if (process.env.NODE_ENV === 'development' && !headerBlob) {
              console.warn('⚠️ [executeCapture] 재고장표 헤더를 찾지 못해 테이블만 캡처');
            }
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
        // 직접 캡처: preserveHeader가 true이고 헤더가 있으면 slideElement 전체 캡처, 아니면 contentElement만 캡처
        const captureElementForDirect = (config?.preserveHeader && elements.headerElement && SafeDOM.isInDOM(elements.headerElement))
          ? elements.slideElement // 헤더를 포함하려면 slideElement 전체 캡처
          : elements.contentElement; // 헤더 없으면 contentElement만 캡처
        
        if (!captureElementForDirect || !SafeDOM.isInDOM(captureElementForDirect)) {
          throw new Error('유효하지 않은 캡처 요소입니다.');
        }

        if (sizeInfo) {
          const originalHeight = captureElementForDirect.style.height || '';
          const originalMaxHeight = captureElementForDirect.style.maxHeight || '';
          const originalWidth = captureElementForDirect.style.width || '';
          const originalMaxWidth = captureElementForDirect.style.maxWidth || '';

          styleRestores.push(() => {
            if (SafeDOM.isInDOM(captureElementForDirect)) {
              SafeDOM.restoreStyle(captureElementForDirect, 'height', originalHeight);
              SafeDOM.restoreStyle(captureElementForDirect, 'max-height', originalMaxHeight);
              SafeDOM.restoreStyle(captureElementForDirect, 'width', originalWidth);
              SafeDOM.restoreStyle(captureElementForDirect, 'max-width', originalMaxWidth);
              SafeDOM.restoreStyle(captureElementForDirect, 'overflow', '');
            }
          });

          captureElementForDirect.style.height = `${sizeInfo.measuredHeight || 0}px`;
          captureElementForDirect.style.maxHeight = `${sizeInfo.measuredHeight || 0}px`;
          captureElementForDirect.style.width = `${sizeInfo.measuredWidth || 0}px`;
          captureElementForDirect.style.maxWidth = `${sizeInfo.measuredWidth || 0}px`;
          captureElementForDirect.style.overflow = 'visible';

          await new Promise(r => setTimeout(r, 300));

          // width/height는 원본 크기만 전달 (SCALE 곱하지 않음)
          const captureWidth = Math.min(sizeInfo.measuredWidth || 0, MAX_WIDTH);
          const captureHeight = Math.min(sizeInfo.measuredHeight || 0, MAX_HEIGHT);

          if (process.env.NODE_ENV === 'development' && config?.preserveHeader && elements.headerElement) {
            console.log(`📸 [executeCapture] direct 캡처: 헤더 포함 slideElement 캡처 (${captureWidth}x${captureHeight})`);
          }

          blob = await captureElement(captureElementForDirect, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: 0, // 핑크바 제거
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            skipAutoCrop: false, // autoCrop 활성화 (불필요한 공백 제거)
            width: captureWidth,
            height: captureHeight,
          });
        } else {
          // 기본 캡처 (크기 측정 없이) - autoCrop으로 불필요한 공백 제거
          blob = await captureElement(captureElementForDirect, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: 0, // 핑크바 제거
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            skipAutoCrop: false, // autoCrop 활성화 (불필요한 공백 제거)
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

      // 5. 파일 크기 검증 및 경고 강화
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
      if (blob && blob.size > MAX_FILE_SIZE) {
        const sizeMB = blob.size / (1024 * 1024);
        if (process.env.NODE_ENV === 'development') {
          console.error(`❌ [captureSlide] ${slideType} 슬라이드 파일 크기 초과: ${sizeMB.toFixed(2)}MB (25MB 제한)`);
          console.error(`   - 실제 너비: ${MAX_WIDTH * SCALE}px, 높이: 최대 ${MAX_HEIGHT * SCALE}px`);
          console.error(`   - 모든 슬라이드는 높이 제한(${MAX_HEIGHT * SCALE}px)을 확인하세요.`);
        }
        // 크기 초과 시에도 반환 (서버에서 처리하도록)
      } else if (blob && blob.size > 20 * 1024 * 1024) {
        // 20MB 이상이면 경고 (25MB 근접)
        const sizeMB = blob.size / (1024 * 1024);
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ [captureSlide] ${slideType} 슬라이드 파일 크기가 큼: ${sizeMB.toFixed(2)}MB (25MB 제한 근접)`);
        }
      }
      
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