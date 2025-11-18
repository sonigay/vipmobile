/**
 * 완전 통합 슬라이드 캡처 엔진
 * 98% 이상 성공률을 목표로 한 설정 기반 통합 캡처 로직
 * 모든 슬라이드 타입을 단일 파이프라인으로 처리
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
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 8000;
const SCALE = 2;

/**
 * 5단계 헤더 탐지 로직 (98% 성공률 목표)
 */
function detectHeader(slideElement, options = {}) {
  const { preserveHeader = true } = options;
  if (!preserveHeader || !slideElement) return null;

  const slideRect = slideElement.getBoundingClientRect();
  const companyNames = ['(주)브이아이피플러스', '브이아이피플러스', '브이아이피', 'VIPPLUS'];
  const headerKeywords = ['header', 'Header', 'MuiAppBar', 'MuiToolbar', 'banner'];

  // 1단계: 클래스명/속성 기반 검색
  let headerElement = slideElement.querySelector(
    '[class*="header"], [class*="Header"], .MuiAppBar-root, .MuiToolbar-root, header, [role="banner"]'
  );
  
  if (headerElement) {
    const headerRect = headerElement.getBoundingClientRect();
    const relativeTop = headerRect.top - slideRect.top;
    if (relativeTop >= -30 && relativeTop < 250 && headerRect.height > 30 && headerRect.width > 200) {
      const hasLogo = headerElement.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null;
      const hasCompanyName = companyNames.some(name => 
        (headerElement.textContent || '').includes(name)
      );
      
      if (hasLogo || hasCompanyName || headerRect.height > 50) {
        return headerElement;
      }
    }
  }

  // 2단계: 위치 기반 검색 (절대/고정 위치)
  const fixedOrAbsolute = Array.from(slideElement.querySelectorAll('*')).find(el => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const relativeTop = rect.top - slideRect.top;
    
    return (style.position === 'fixed' || style.position === 'absolute') &&
           relativeTop >= -20 && relativeTop < 200 &&
           rect.height > 50 && rect.width > 200 &&
           (rect.width > slideRect.width * 0.4);
  });
  
  if (fixedOrAbsolute) {
    const hasLogo = fixedOrAbsolute.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null;
    const hasCompanyName = companyNames.some(name => 
      (fixedOrAbsolute.textContent || '').includes(name)
    );
    
    if (hasLogo || hasCompanyName) {
      return fixedOrAbsolute;
    }
  }

  // 3단계: 텍스트 컨텐츠 기반 검색
  const allElements = Array.from(slideElement.querySelectorAll('*'));
  const textBased = allElements.find(el => {
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - slideRect.top;
    const text = (el.textContent || '').trim().toLowerCase();
    const hasCompanyName = companyNames.some(name => 
      text.includes(name.toLowerCase().replace(/\s/g, ''))
    );
    
    return relativeTop >= -30 && relativeTop < 250 &&
           elRect.height > 40 && 
           elRect.width > slideRect.width * 0.4 &&
           hasCompanyName &&
           !text.includes('재고장표') && // 중간 컨텐츠 헤더 제외
           !text.includes('테이블');
  });
  
  if (textBased) {
    return textBased;
  }

  // 4단계: 구조적 검색 (DOM 트리 상단 + 로고 포함)
  const structureBased = allElements.find(el => {
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - slideRect.top;
    const hasLogo = el.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null;
    
    return relativeTop >= -30 && relativeTop < 200 &&
           elRect.height > 40 &&
           elRect.width > slideRect.width * 0.3 &&
           hasLogo &&
           !(el.textContent || '').toLowerCase().includes('재고장표');
  });
  
  if (structureBased) {
    return structureBased;
  }

  // 5단계: 폴백 검색 (후보 요소 선별)
  const candidates = allElements.filter(el => {
    const elRect = el.getBoundingClientRect();
    const relativeTop = elRect.top - slideRect.top;
    const text = (el.textContent || '').trim().toLowerCase();
    
    return relativeTop >= -30 && relativeTop < 200 &&
           elRect.height > 30 &&
           elRect.width > slideRect.width * 0.3 &&
           !text.includes('재고장표') &&
           !text.includes('테이블') &&
           !text.includes('그래프');
  }).sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    const aTop = aRect.top - slideRect.top;
    const bTop = bRect.top - slideRect.top;
    
    // 상단에 가까울수록, 크기가 클수록 우선순위
    if (Math.abs(aTop) !== Math.abs(bTop)) {
      return Math.abs(aTop) - Math.abs(bTop);
    }
    return (bRect.width * bRect.height) - (aRect.width * aRect.height);
  });
  
  if (candidates.length > 0) {
    return candidates[0];
  }

  return null;
}

/**
 * 확대/펼치기 버튼 찾기 및 클릭
 */
async function clickExpandButtons(slideElement, config) {
  if (!config.needsTableExpansion) return;

  // '확대' 버튼 찾기 (월간시상용)
  const expandBtn = Array.from(slideElement.querySelectorAll('button, .MuiButton-root')).find(
    (el) => {
      const text = (el.textContent || '').trim();
      return text === '확대' || text.includes('확대');
    }
  );

  if (expandBtn) {
    expandBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
    await new Promise(r => setTimeout(r, 200));
    expandBtn.click();
    await new Promise(r => setTimeout(r, 1200)); // 확대 후 충분한 렌더링 대기
    return;
  }

  // '펼치기' 버튼 찾기 (다른 슬라이드용)
  const expandButtons = Array.from(document.querySelectorAll('button, .MuiButton-root'))
    .filter(el => {
      const text = (el.textContent || '').trim();
      return text.includes('펼치기') && slideElement.contains(el);
    });

  for (const btn of expandButtons) {
    btn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  if (expandButtons.length > 0) {
    await new Promise(r => setTimeout(r, 1000)); // 모든 섹션 렌더링 대기
  }
}

/**
 * 스크롤 제거 로직
 */
function removeScrollConstraints(element) {
  if (!element) return;

  element.scrollTop = 0;
  if (element.parentElement) {
    element.parentElement.scrollTop = 0;
  }

  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    if (!el || !el.style) return;

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
  });
}

/**
 * 헤더 크기 조정 (콘텐츠 너비에 맞춤)
 */
async function adjustHeaderWidth(headerElement, contentWidth, slideElement) {
  if (!headerElement || !contentWidth || contentWidth <= 0) return null;

  const headerRect = headerElement.getBoundingClientRect();
  const originalStyles = {
    width: headerElement.style.width,
    maxWidth: headerElement.style.maxWidth,
    minWidth: headerElement.style.minWidth,
    display: headerElement.style.display,
    justifyContent: headerElement.style.justifyContent,
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
      try {
        const childStyle = window.getComputedStyle(child);
        const childRect = child.getBoundingClientRect();

        childStyles.set(child, {
          width: child.style.width,
          maxWidth: child.style.maxWidth,
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
        // 무시
      }
    });

    await new Promise(r => setTimeout(r, 200));

    return () => {
      // 복원 함수
      if (originalStyles.width) headerElement.style.width = originalStyles.width;
      else headerElement.style.removeProperty('width');
      if (originalStyles.maxWidth) headerElement.style.maxWidth = originalStyles.maxWidth;
      else headerElement.style.removeProperty('max-width');
      if (originalStyles.minWidth) headerElement.style.minWidth = originalStyles.minWidth;
      else headerElement.style.removeProperty('min-width');
      if (originalStyles.display) headerElement.style.display = originalStyles.display;
      else headerElement.style.removeProperty('display');
      if (originalStyles.justifyContent) headerElement.style.justifyContent = originalStyles.justifyContent;
      else headerElement.style.removeProperty('justify-content');

      childStyles.forEach((styles, child) => {
        if (!child || !child.style) return;
        if (styles.width) child.style.width = styles.width;
        else child.style.removeProperty('width');
        if (styles.maxWidth) child.style.maxWidth = styles.maxWidth;
        else child.style.removeProperty('max-width');
      });
    };
  }

  return null;
}

/**
 * 월간시상 슬라이드 특수 처리: 5개 테이블 찾기 및 commonAncestor 계산
 */
function findMonthlyAwardTables(slideElement) {
  const allElements = Array.from(slideElement.querySelectorAll('.MuiPaper-root, .MuiBox-root'));

  const statsPaper = allElements.find(el => {
    const text = el.textContent || '';
    return text.includes('월간시상 현황') &&
           text.includes('확대') &&
           (text.includes('셋팅') || text.includes('업셀기변') || text.includes('기변105이상'));
  });

  const matrixPaper = allElements.find(el => {
    const text = el.textContent || '';
    return (text.includes('월간시상 Matrix') || text.includes('만점기준')) &&
           text.includes('총점') &&
           text.includes('달성상황');
  });

  const channelBox = allElements.find(el => {
    const text = el.textContent || '';
    return text.includes('채널별 성과 현황') && text.includes('축소');
  });

  const officeBox = allElements.find(el => {
    const text = el.textContent || '';
    return text.includes('사무실별 성과 현황') && text.includes('축소');
  });

  const departmentBox = allElements.find(el => {
    const text = el.textContent || '';
    return text.includes('소속별 성과 현황') && text.includes('축소');
  });

  return [statsPaper, matrixPaper, channelBox, officeBox, departmentBox].filter(Boolean);
}

/**
 * Common Ancestor 찾기 (월간시상용)
 */
function findCommonAncestor(elements, slideElement) {
  if (!elements || elements.length === 0) return slideElement;

  const getAncestors = (el) => {
    const list = [];
    let cur = el;
    while (cur) {
      list.push(cur);
      cur = cur.parentElement;
    }
    return list;
  };

  let common = getAncestors(elements[0]);
  for (let i = 1; i < elements.length; i++) {
    const ancestors = new Set(getAncestors(elements[i]));
    common = common.filter(a => ancestors.has(a));
  }

  const foundAncestor = common.find(el => el !== document.body && slideElement.contains(el)) || slideElement;

  if (foundAncestor && foundAncestor !== slideElement) {
    const foundRect = foundAncestor.getBoundingClientRect();
    const slideRect = slideElement.getBoundingClientRect();

    // foundAncestor가 너무 크면 (슬라이드의 90% 이상) slideElement 사용
    if (foundRect.height >= slideRect.height * 0.9 && foundRect.width >= slideRect.width * 0.9) {
      return slideElement;
    }

    // 테이블이 있는지 확인
    const hasTableInFound = Array.from(foundAncestor.querySelectorAll('table, .MuiTable-root, .MuiTableContainer-root')).length > 0;
    if (!hasTableInFound) {
      return slideElement;
    }

    return foundAncestor;
  }

  return slideElement;
}

/**
 * 재시도 메커니즘
 */
async function withRetry(fn, maxRetries = 3, delay = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
}

/**
 * Blob을 Image로 변환
 */
function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * 헤더 + 콘텐츠 합성
 */
async function compositeHeaderAndContent(headerBlob, contentBlob) {
  const headerImg = await blobToImage(headerBlob);
  const contentImg = await blobToImage(contentBlob);

  // 헤더가 제대로 캡처되었는지 확인
  if (headerImg.width < 100 || headerImg.height < 20) {
    return contentBlob; // 헤더가 없으면 콘텐츠만 반환
  }

  const canvas = document.createElement('canvas');
  const gap = 0;
  canvas.width = Math.max(headerImg.width, contentImg.width);
  canvas.height = headerImg.height + contentImg.height + gap;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 헤더 중앙 정렬
  const headerX = (canvas.width - headerImg.width) / 2;
  ctx.drawImage(headerImg, headerX, 0);

  // 콘텐츠 중앙 정렬
  const contentX = (canvas.width - contentImg.width) / 2;
  ctx.drawImage(contentImg, contentX, headerImg.height + gap);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * 통합 캡처 파이프라인: 전처리
 */
async function preProcess(slideElement, captureTargetElement, config) {
  // 데이터 로딩 대기
  if (config.needsDataLoadingWait) {
    await waitForDataLoading(slideElement, {
      maxWait: 20000,
      loadingTexts: ['로딩', '불러오는 중', '데이터를 불러오는 중'],
      checkLoadingIcon: true,
      checkDataPresence: true,
    });
  }

  // 버튼 클릭 (확대/펼치기)
  await clickExpandButtons(slideElement, config);

  // 스크롤 제거
  if (config.needsScrollRemoval && captureTargetElement) {
    removeScrollConstraints(captureTargetElement);
  }
}

/**
 * 통합 캡처 파이프라인: 요소 탐지
 */
function detectElements(slideElement, captureTargetElement, config) {
  const elements = {
    slideElement,
    captureTargetElement: captureTargetElement || slideElement,
    headerElement: null,
    contentElement: null,
    tables: [],
  };

  // 헤더 탐지
  if (config.needsHeaderComposition || config.needsHeaderSizeAdjustment) {
    elements.headerElement = detectHeader(slideElement, { preserveHeader: true });
  }

  // 콘텐츠 요소는 captureTargetElement 사용
  elements.contentElement = elements.captureTargetElement;

  // 테이블 찾기 (필요한 경우)
  if (config.needsTableVerification || config.needsManagerTableInclusion) {
    elements.tables = findTables(elements.contentElement, { includeContainers: true });
  }

  return elements;
}

/**
 * 통합 캡처 파이프라인: 크기 조정
 */
async function adjustSizes(elements, config) {
  const restoreFunctions = [];

  // 박스 크기 조정
  if (config.needsBoxResize && elements.contentElement) {
    const originalBoxStyles = await resizeBoxesToContent(elements.contentElement, {
      iterations: config.boxResizeIterations || 2,
      tolerance: 0.05,
      minPadding: 10,
    });

    restoreFunctions.push(() => {
      originalBoxStyles.forEach((styles, box) => {
        if (!box || !box.style) return;
        if (styles.height) box.style.height = styles.height;
        else box.style.removeProperty('height');
        if (styles.maxHeight) box.style.maxHeight = styles.maxHeight;
        else box.style.removeProperty('max-height');
        if (styles.width) box.style.width = styles.width;
        else box.style.removeProperty('width');
        if (styles.maxWidth) box.style.maxWidth = styles.maxWidth;
        else box.style.removeProperty('max-width');
      });
    });
  }

  // 콘텐츠 크기 측정
  let sizeInfo = null;
  if (config.needsHeightMeasurement && elements.contentElement) {
    sizeInfo = measureContentSize(elements.contentElement, {
      preferTables: config.needsManagerTableInclusion || config.needsTableVerification,
      preferCharts: config.captureMethod === 'direct',
      excludeBorders: true,
      padding: 40,
    });

    // 담당자별 실적 테이블 포함 (전체총마감용)
    if (config.needsManagerTableInclusion) {
      const managerTables = elements.tables.filter(table => {
        const text = (table.textContent || '').toLowerCase();
        return text.includes('담당자별') || text.includes('담당자');
      });

      if (managerTables.length > 0) {
        const lastTable = managerTables[managerTables.length - 1];
        const rect = elements.contentElement.getBoundingClientRect();
        const tableRect = lastTable.getBoundingClientRect();
        const relativeBottom = tableRect.bottom - rect.top;
        if (relativeBottom > sizeInfo.maxRelativeBottom) {
          sizeInfo.maxRelativeBottom = relativeBottom;
          sizeInfo.measuredHeight = Math.max(
            relativeBottom + 100,
            sizeInfo.measuredHeight
          );
        }
      }
    }

    // 오른쪽 여백 제거
    if (config.needsRightWhitespaceRemoval) {
      sizeInfo.measuredWidth = removeRightWhitespace(
        sizeInfo.measuredWidth,
        sizeInfo.maxRelativeRight,
        sizeInfo.scrollWidth,
        elements.contentElement.getBoundingClientRect().width
      );
    }

    // 이미지 크기 제한
    if (sizeInfo.measuredWidth > MAX_WIDTH) {
      sizeInfo.measuredWidth = MAX_WIDTH;
    }
    if (sizeInfo.measuredHeight > MAX_HEIGHT) {
      sizeInfo.measuredHeight = MAX_HEIGHT;
    }

    // 헤더 너비 조정
    if (config.needsHeaderSizeAdjustment && elements.headerElement && sizeInfo.measuredWidth > 0) {
      const restoreHeader = await adjustHeaderWidth(
        elements.headerElement,
        sizeInfo.measuredWidth,
        elements.slideElement
      );
      if (restoreHeader) {
        restoreFunctions.push(restoreHeader);
      }
    }
  }

  return { sizeInfo, restoreFunctions };
}

/**
 * 통합 캡처 파이프라인: 캡처 실행
 */
async function executeCapture(elements, config, sizeInfo) {
  let blob = null;

  switch (config.captureMethod) {
    case 'commonAncestor': {
      // 월간시상: commonAncestor 찾아서 캡처
      const tables = findMonthlyAwardTables(elements.slideElement);
      const commonAncestor = findCommonAncestor(tables, elements.slideElement);

      commonAncestor.scrollIntoView({ block: 'start', behavior: 'instant' });
      await new Promise(r => setTimeout(r, 500));

      if (!sizeInfo) {
        sizeInfo = measureContentSize(commonAncestor, {
          preferTables: true,
          excludeBorders: true,
          padding: 100,
        });
      }

      const originalHeight = commonAncestor.style.height;
      const originalMaxHeight = commonAncestor.style.maxHeight;
      commonAncestor.style.height = `${Math.min(sizeInfo.measuredHeight, MAX_HEIGHT)}px`;
      commonAncestor.style.maxHeight = `${Math.min(sizeInfo.measuredHeight, MAX_HEIGHT)}px`;
      commonAncestor.style.overflow = 'visible';

      await new Promise(r => setTimeout(r, 300));

      blob = await captureElement(commonAncestor, {
        scale: SCALE,
        useCORS: true,
        fixedBottomPaddingPx: 0,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        skipAutoCrop: false,
        height: Math.min(sizeInfo.measuredHeight * SCALE, MAX_HEIGHT * SCALE),
        width: Math.min(sizeInfo.measuredWidth * SCALE, MAX_WIDTH * SCALE),
      });

      // 스타일 복원
      if (originalHeight) commonAncestor.style.height = originalHeight;
      else commonAncestor.style.removeProperty('height');
      if (originalMaxHeight) commonAncestor.style.maxHeight = originalMaxHeight;
      else commonAncestor.style.removeProperty('max-height');
      commonAncestor.style.removeProperty('overflow');

      break;
    }

    case 'composite': {
      // 재고장표: 헤더 + 테이블 합성
      const tableBox = elements.contentElement.querySelector('.MuiPaper-root, .MuiCard-root, [class*="table"], [class*="Table"]');
      const tableContainer = tableBox ? tableBox.querySelector('.MuiTableContainer-root, [class*="container"], [class*="Container"]') : null;
      const actualTable = tableContainer ? tableContainer.querySelector('table, .MuiTable-root') : null;

      if (tableBox && actualTable) {
        // 테이블 박스 크기 조정
        const tableRect = actualTable.getBoundingClientRect();
        const tableScrollWidth = actualTable.scrollWidth || tableRect.width;
        const tableScrollHeight = actualTable.scrollHeight || tableRect.height;

        const tableBoxStyle = window.getComputedStyle(tableBox);
        const paddingLeft = parseInt(tableBoxStyle.paddingLeft || '0') || 0;
        const paddingRight = parseInt(tableBoxStyle.paddingRight || '0') || 0;
        const paddingTop = parseInt(tableBoxStyle.paddingTop || '0') || 0;
        const paddingBottom = parseInt(tableBoxStyle.paddingBottom || '0') || 0;

        const adjustedWidth = tableScrollWidth + paddingLeft + paddingRight + 10;
        const adjustedHeight = tableScrollHeight + paddingTop + paddingBottom + 10;

        const originalTableBoxWidth = tableBox.style.width;
        const originalTableBoxHeight = tableBox.style.height;
        const originalTableBoxMaxWidth = tableBox.style.maxWidth;
        const originalTableBoxMaxHeight = tableBox.style.maxHeight;

        tableBox.style.width = `${adjustedWidth}px`;
        tableBox.style.height = `${adjustedHeight}px`;
        tableBox.style.maxWidth = `${adjustedWidth}px`;
        tableBox.style.maxHeight = `${adjustedHeight}px`;

        if (config.needsTableCentering) {
          tableBox.style.margin = '0 auto';
        }

        await new Promise(r => setTimeout(r, 300));

        // 헤더 캡처
        let headerBlob = null;
        if (elements.headerElement && config.needsHeaderComposition) {
          headerBlob = await captureElement(elements.headerElement, {
            scale: SCALE,
            useCORS: true,
            fixedBottomPaddingPx: 0,
            backgroundColor: '#ffffff',
            skipAutoCrop: true,
          });
        }

        // 테이블 캡처
        const tableWidth = Math.min(adjustedWidth * SCALE, MAX_WIDTH * SCALE);
        const tableHeight = Math.min(adjustedHeight * SCALE, MAX_HEIGHT * SCALE);

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
        if (headerBlob) {
          blob = await compositeHeaderAndContent(headerBlob, tableBlob);
        } else {
          blob = tableBlob;
        }

        // 스타일 복원
        if (originalTableBoxWidth) tableBox.style.width = originalTableBoxWidth;
        else tableBox.style.removeProperty('width');
        if (originalTableBoxHeight) tableBox.style.height = originalTableBoxHeight;
        else tableBox.style.removeProperty('height');
        if (originalTableBoxMaxWidth) tableBox.style.maxWidth = originalTableBoxMaxWidth;
        else tableBox.style.removeProperty('max-width');
        if (originalTableBoxMaxHeight) tableBox.style.maxHeight = originalTableBoxMaxHeight;
        else tableBox.style.removeProperty('max-height');
        tableBox.style.removeProperty('margin');
      }
      break;
    }

    case 'direct':
    default: {
      // 직접 캡처
      if (!elements.contentElement) break;

      if (sizeInfo) {
        const originalHeight = elements.contentElement.style.height;
        const originalMaxHeight = elements.contentElement.style.maxHeight;
        const originalWidth = elements.contentElement.style.width;
        const originalMaxWidth = elements.contentElement.style.maxWidth;

        elements.contentElement.style.height = `${sizeInfo.measuredHeight}px`;
        elements.contentElement.style.maxHeight = `${sizeInfo.measuredHeight}px`;
        elements.contentElement.style.width = `${sizeInfo.measuredWidth}px`;
        elements.contentElement.style.maxWidth = `${sizeInfo.measuredWidth}px`;
        elements.contentElement.style.overflow = 'visible';

        await new Promise(r => setTimeout(r, 300));

        const captureWidth = Math.min(sizeInfo.measuredWidth * SCALE, MAX_WIDTH * SCALE);
        const captureHeight = Math.min(sizeInfo.measuredHeight * SCALE, MAX_HEIGHT * SCALE);

        blob = await captureElement(elements.contentElement, {
          scale: SCALE,
          useCORS: true,
          fixedBottomPaddingPx: config.needsPinkBarRemoval ? 0 : config.defaultPadding,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          skipAutoCrop: !config.needsPinkBarRemoval,
          width: captureWidth,
          height: captureHeight,
        });

        // 스타일 복원
        if (originalHeight) elements.contentElement.style.height = originalHeight;
        else elements.contentElement.style.removeProperty('height');
        if (originalMaxHeight) elements.contentElement.style.maxHeight = originalMaxHeight;
        else elements.contentElement.style.removeProperty('max-height');
        if (originalWidth) elements.contentElement.style.width = originalWidth;
        else elements.contentElement.style.removeProperty('width');
        if (originalMaxWidth) elements.contentElement.style.maxWidth = originalMaxWidth;
        else elements.contentElement.style.removeProperty('max-width');
        elements.contentElement.style.removeProperty('overflow');
      } else {
        // 기본 캡처 (크기 측정 없이)
        blob = await captureElement(elements.contentElement, {
          scale: SCALE,
          useCORS: true,
          fixedBottomPaddingPx: config.defaultPadding,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        });
      }
      break;
    }
  }

  return blob;
}

/**
 * 메인 통합 캡처 함수
 * 모든 슬라이드 타입을 단일 파이프라인으로 처리
 */
export async function captureSlide(slideElement, slide, captureTargetElement) {
  if (!slideElement) {
    throw new Error('slideElement가 없습니다.');
  }

  const slideType = identifySlideType(slide);
  const config = getCaptureConfig(slide);

  // 재시도 메커니즘으로 실행
  return await withRetry(async () => {
    // 1. 전처리
    await preProcess(slideElement, captureTargetElement, config);

    // 2. 요소 탐지
    const elements = detectElements(slideElement, captureTargetElement, config);

    // 3. 크기 조정
    const { sizeInfo, restoreFunctions } = await adjustSizes(elements, config);

    try {
      // 4. 캡처 실행
      const blob = await executeCapture(elements, config, sizeInfo);

      return blob;
    } finally {
      // 스타일 복원
      restoreFunctions.forEach(restore => {
        try {
          restore();
        } catch (e) {
          // 복원 실패는 무시
        }
      });
    }
  }, 3, 500);
}

