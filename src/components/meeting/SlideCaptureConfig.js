/**
 * 슬라이드 타입별 캡처 설정 및 예측 가능한 문제점 해결
 * 모든 슬라이드 타입의 공통 패턴과 특수 요구사항을 체계적으로 관리
 */

/**
 * 슬라이드 타입 식별
 */
export function identifySlideType(slide) {
  if (!slide) return null;

  const type = slide.type;
  const mode = slide.mode;
  const tab = slide.tab;
  const subTab = slide.subTab;

  // 기본 슬라이드
  if (type === 'main') return 'main';
  if (type === 'toc') return 'toc';
  if (type === 'ending') return 'ending';
  if (type === 'custom') return slide.videoUrl ? 'custom-video' : 'custom';

  // 모드 기반 슬라이드
  if (mode === 'inventoryChart' || (mode === 'chart' && (tab === 'inventoryChart' || subTab === 'inventoryChart'))) {
    return 'inventoryChart';
  }

  if (mode === 'chart') {
    if ((tab === 'indicatorChart' || subTab === 'monthlyAward')) {
      return 'monthlyAward';
    }
    if (tab === 'closingChart' && subTab === 'totalClosing') {
      return 'totalClosing';
    }
    if ((tab === 'bondChart' || tab === 'bond') && subTab === 'rechotanchoBond') {
      return 'rechotanchoBond';
    }
    if ((tab === 'bondChart' || tab === 'bond') && subTab === 'subscriberIncrease') {
      return 'subscriberIncrease';
    }
    if (tab === 'closingChart' && subTab && subTab !== 'totalClosing') {
      return 'closingDetail'; // CS 개통 실적 등 개별 실적
    }
  }

  return 'default';
}

/**
 * 슬라이드 타입별 캡처 설정
 * 98% 이상 성공률을 목표로 한 완전한 설정 기반 처리
 */
export const SLIDE_CAPTURE_CONFIG = {
  // 기본 슬라이드 (main, toc, ending)
  main: {
    needsScrollRemoval: true,           // 스크롤 제약 제거 필요
    needsWidthAdjustment: true,         // 너비 조정 (1920px)
    needsHeightMeasurement: true,       // 높이 측정 (실제 콘텐츠)
    needsBoxResize: false,              // 박스 크기 조정 불필요
    needsRightWhitespaceRemoval: true,  // 오른쪽 여백 제거
    needsDataLoadingWait: false,        // 데이터 로딩 대기 불필요
    needsTableExpansion: false,         // 테이블 펼치기 불필요
    captureMethod: 'direct',            // 직접 캡처
    preserveHeader: false,              // 헤더 보존 불필요 (전체 캡처)
    needsHeaderComposition: false,      // 헤더 합성 불필요
    needsHeaderSizeAdjustment: false,   // 헤더 크기 조정 불필요
    needsTableVerification: false,      // 테이블 검증 불필요
    needsManagerTableInclusion: false,  // 담당자별 테이블 포함 불필요
    boxResizeIterations: 1,             // 박스 크기 조정 반복 횟수
    retryConfig: { maxRetries: 3, delay: 500 }, // 재시도 설정
  },
  toc: {
    needsScrollRemoval: true,
    needsWidthAdjustment: true,
    needsHeightMeasurement: true,
    needsBoxResize: false,
    needsRightWhitespaceRemoval: true,
    needsDataLoadingWait: false,
    needsTableExpansion: false,
    captureMethod: 'direct',
    preserveHeader: false,
    needsHeaderComposition: false,
    needsHeaderSizeAdjustment: false,
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 1,
    retryConfig: { maxRetries: 3, delay: 500 },
  },
  ending: {
    needsScrollRemoval: true,
    needsWidthAdjustment: true,
    needsHeightMeasurement: true,
    needsBoxResize: false,
    needsRightWhitespaceRemoval: true,
    needsDataLoadingWait: false,
    needsTableExpansion: false,
    captureMethod: 'direct',
    preserveHeader: false,
    needsHeaderComposition: false,
    needsHeaderSizeAdjustment: false,
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 1,
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // 월간시상
  monthlyAward: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: true,
    needsBoxResize: false,
    needsRightWhitespaceRemoval: false,
    needsDataLoadingWait: true,         // 확대 버튼 클릭 후 대기
    needsTableExpansion: true,          // 확대 버튼 클릭
    captureMethod: 'commonAncestor',    // commonAncestor 찾아서 캡처
    preserveHeader: false,              // 헤더 포함 캡처
    needsHeaderComposition: false,      // 헤더 합성 불필요
    needsHeaderSizeAdjustment: false,   // 헤더 크기 조정 불필요
    needsTableVerification: true,       // 테이블 검증 필요
    minTablesCount: 5,                  // 최소 5개 테이블 필요
    needsManagerTableInclusion: false,
    boxResizeIterations: 1,
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // 전체총마감
  totalClosing: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: true,
    needsBoxResize: true,               // 박스 크기 조정 필요 (2번 반복)
    needsRightWhitespaceRemoval: true,  // 오른쪽 여백 제거
    needsDataLoadingWait: true,         // 데이터 로드 완료 대기
    needsTableExpansion: true,          // 모든 섹션 펼치기
    captureMethod: 'direct',
    preserveHeader: true,               // 헤더 보존
    needsHeaderComposition: false,      // 헤더 합성 불필요 (직접 캡처에 포함)
    needsHeaderSizeAdjustment: true,    // 헤더 크기 조정 필요 (콘텐츠 너비에 맞춤)
    needsTableVerification: false,
    needsManagerTableInclusion: true,   // 담당자별 실적 테이블 포함 필요
    boxResizeIterations: 2,             // 박스 크기 조정 반복 횟수
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // 가입자증감
  subscriberIncrease: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: true,
    needsBoxResize: true,               // 박스 크기 조정 필요
    needsRightWhitespaceRemoval: true,  // 오른쪽 여백 제거
    needsDataLoadingWait: true,         // 데이터 로드 완료 대기 (로딩 텍스트/아이콘 확인)
    needsTableExpansion: false,
    needsTableScroll: true,             // 테이블 스크롤 처리
    captureMethod: 'direct',
    preserveHeader: true,               // 헤더 보존
    needsHeaderComposition: false,      // 헤더 합성 불필요
    needsHeaderSizeAdjustment: true,    // 헤더 크기 조정 필요
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 2,
    needsYearSelection: true,           // 년도 선택 필요 (현재는 수동)
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // 재초담초채권
  rechotanchoBond: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: true,
    needsBoxResize: true,               // 박스 크기 조정 필요
    needsRightWhitespaceRemoval: true,  // 오른쪽 여백 제거
    needsDataLoadingWait: true,         // 데이터 로드 완료 대기 (그래프 렌더링 보장)
    needsTableExpansion: false,
    captureMethod: 'direct',            // direct 방식 유지 (헤더/콘텐츠 비율 개선)
    preserveHeader: true,               // 헤더 보존
    needsHeaderComposition: false,      // 헤더 합성 불필요
    needsHeaderSizeAdjustment: true,    // 헤더 크기 조정 필요 (데이터입력 헤더)
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 2,
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // 재고장표
  inventoryChart: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: true,
    needsBoxResize: true,               // 테이블 박스 크기 조정
    needsRightWhitespaceRemoval: false,
    needsDataLoadingWait: true,         // 데이터 로드 완료 대기
    needsTableExpansion: true,          // 펼치기 버튼 클릭
    captureMethod: 'composite',         // 헤더 + 테이블 합성
    preserveHeader: true,               // 헤더 보존
    needsHeaderComposition: true,       // 헤더 합성 필요
    needsHeaderSizeAdjustment: false,   // 헤더 크기 조정 불필요 (합성 방식)
    needsTableCentering: true,          // 테이블 중앙 정렬
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 1,
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // CS 개별 실적
  closingDetail: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: false,
    needsBoxResize: false,
    needsRightWhitespaceRemoval: false,
    needsDataLoadingWait: true,         // 데이터 로드 완료 대기
    needsTableExpansion: true,          // 특정 섹션만 펼치기
    captureMethod: 'direct',
    preserveHeader: false,
    needsHeaderComposition: false,
    needsHeaderSizeAdjustment: false,
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 1,
    retryConfig: { maxRetries: 3, delay: 500 },
  },

  // 기본값
  default: {
    needsScrollRemoval: false,
    needsWidthAdjustment: false,
    needsHeightMeasurement: false,
    needsBoxResize: false,
    needsRightWhitespaceRemoval: false,
    needsDataLoadingWait: false,
    needsTableExpansion: false,
    captureMethod: 'direct',
    preserveHeader: false,
    needsHeaderComposition: false,
    needsHeaderSizeAdjustment: false,
    needsTableVerification: false,
    needsManagerTableInclusion: false,
    boxResizeIterations: 1,
    retryConfig: { maxRetries: 3, delay: 500 },
  },
};

/**
 * 슬라이드 타입에 따른 캡처 설정 가져오기
 */
export function getCaptureConfig(slide) {
  const slideType = identifySlideType(slide);
  return SLIDE_CAPTURE_CONFIG[slideType] || SLIDE_CAPTURE_CONFIG.default;
}

/**
 * 예측 가능한 문제점 해결을 위한 공통 유틸리티
 */

/**
 * 데이터 로딩 완료 대기
 */
export async function waitForDataLoading(element, options = {}) {
  const {
    maxWait = 10000,
    checkInterval = 200,
    loadingTexts = ['로딩', '불러오는 중', '데이터를 불러오는 중'],
    checkLoadingIcon = true,
    checkDataPresence = true,
  } = options;

  const start = Date.now();
  while (Date.now() - start < maxWait) {
    // 로딩 텍스트 확인
    const hasLoadingText = Array.from(element.querySelectorAll('*')).some(el => {
      const text = (el.textContent || '').trim();
      return loadingTexts.some(loadingText => text.includes(loadingText));
    });

    // 로딩 아이콘 확인
    const hasLoadingIcon = checkLoadingIcon && 
      element.querySelector('.MuiCircularProgress-root, [class*="loading"], [class*="Loading"]') !== null;

    // 데이터 존재 확인 (테이블, 그래프 등)
    const hasData = !checkDataPresence || (
      element.querySelectorAll('table, .MuiTable-root, canvas, svg, [class*="recharts"]').length > 0
    );

    if (!hasLoadingText && !hasLoadingIcon && hasData) {
      return true; // 로딩 완료
    }

    await new Promise(r => setTimeout(r, checkInterval));
  }

  return false; // 타임아웃
}

/**
 * 테이블 요소 찾기 (다양한 셀렉터 지원)
 */
export function findTables(element, options = {}) {
  const {
    includeContainers = false,
    minHeight = 50,
  } = options;

  const selectors = ['table', '.MuiTable-root', '.MuiTableContainer-root'];
  if (includeContainers) {
    selectors.push('.MuiPaper-root', '.MuiCard-root', '[class*="Table"]');
  }

  const tables = [];
  selectors.forEach(selector => {
    element.querySelectorAll(selector).forEach(table => {
      const rect = table.getBoundingClientRect();
      if (rect.height >= minHeight) {
        tables.push(table);
      }
    });
  });

  return [...new Set(tables)]; // 중복 제거
}

/**
 * 실제 콘텐츠 크기 측정 (박스 라인 제외)
 */
export function measureContentSize(element, options = {}) {
  const {
    preferTables = true,
    preferCharts = false,
    excludeBorders = true,
    padding = 40,
  } = options;

  const rect = element.getBoundingClientRect();
  let maxRelativeBottom = 0;
  let maxRelativeRight = 0;
  let actualContentHeight = 0;
  let actualContentWidth = 0;

  // 테이블 우선 측정
  if (preferTables) {
    const tables = findTables(element, { includeContainers: false });
    for (const table of tables) {
      try {
        const tableRect = table.getBoundingClientRect();
        const relativeBottom = tableRect.bottom - rect.top;
        const relativeRight = tableRect.right - rect.left;
        const scrollWidth = table.scrollWidth || tableRect.width;

        if (relativeBottom > 0) {
          maxRelativeBottom = Math.max(maxRelativeBottom, relativeBottom);
          actualContentHeight = Math.max(actualContentHeight, tableRect.height);
        }
        if (relativeRight > 0) {
          maxRelativeRight = Math.max(maxRelativeRight, relativeRight);
          actualContentWidth = Math.max(actualContentWidth, scrollWidth);
        }
      } catch (e) {
        // 무시
      }
    }
  }

  // 그래프 측정
  if (preferCharts || maxRelativeBottom === 0) {
    const charts = element.querySelectorAll('canvas, svg, [class*="recharts"], [class*="Chart"]');
    for (const chart of charts) {
      try {
        const chartRect = chart.getBoundingClientRect();
        const relativeBottom = chartRect.bottom - rect.top;
        const relativeRight = chartRect.right - rect.left;

        if (relativeBottom > 0 && chartRect.height > 50) {
          maxRelativeBottom = Math.max(maxRelativeBottom, relativeBottom);
          actualContentHeight = Math.max(actualContentHeight, chartRect.height);
        }
        if (relativeRight > 0 && chartRect.width > 100) {
          maxRelativeRight = Math.max(maxRelativeRight, relativeRight);
          actualContentWidth = Math.max(actualContentWidth, chartRect.width);
        }
      } catch (e) {
        // 무시
      }
    }
  }

  // Fallback: 모든 자식 요소 확인
  if (maxRelativeBottom === 0 || maxRelativeRight === 0) {
    const allChildren = element.querySelectorAll('*');
    for (const child of allChildren) {
      try {
        const childRect = child.getBoundingClientRect();
        const relativeBottom = childRect.bottom - rect.top;
        const relativeRight = childRect.right - rect.left;

        // 박스 라인 제외
        if (excludeBorders) {
          const style = window.getComputedStyle(child);
          const hasBorder = style.borderWidth && style.borderWidth !== '0px';
          const isLargeContainer = childRect.width > rect.width * 0.8 && childRect.height > 200;
          if (hasBorder && isLargeContainer) continue;
        }

        if (relativeBottom > 0 && childRect.height > 50) {
          maxRelativeBottom = Math.max(maxRelativeBottom, relativeBottom);
          actualContentHeight = Math.max(actualContentHeight, childRect.height);
        }
        if (relativeRight > 0 && childRect.width > 100) {
          maxRelativeRight = Math.max(maxRelativeRight, relativeRight);
          actualContentWidth = Math.max(actualContentWidth, childRect.width);
        }
      } catch (e) {
        // 무시
      }
    }
  }

  const scrollHeight = element.scrollHeight || rect.height;
  const scrollWidth = element.scrollWidth || rect.width;

  const measuredHeight = Math.max(
    maxRelativeBottom + padding,
    actualContentHeight + padding,
    scrollHeight
  );

  const measuredWidth = Math.max(
    maxRelativeRight + padding,
    actualContentWidth + padding,
    rect.width // 최소 너비 보장
  );

  return {
    maxRelativeBottom,
    maxRelativeRight,
    actualContentHeight,
    actualContentWidth,
    measuredHeight,
    measuredWidth,
    scrollHeight,
    scrollWidth,
  };
}

/**
 * 박스 크기 조정 (콘텐츠에 맞게)
 */
export async function resizeBoxesToContent(element, options = {}) {
  const {
    iterations = 2,
    tolerance = 0.05,
    minPadding = 10,
  } = options;

  const boxContainers = element.querySelectorAll('.MuiPaper-root, .MuiCard-root, [class*="Container"], [class*="Box"]');
  const originalStyles = new Map();

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (const box of boxContainers) {
      try {
        const boxStyle = window.getComputedStyle(box);
        const boxRect = box.getBoundingClientRect();

        // 내부 콘텐츠 확인
        const innerTable = box.querySelector('table, .MuiTable-root, .MuiTableContainer-root');
        const innerChart = box.querySelector('canvas, svg, [class*="recharts"], [class*="Chart"]');
        const hasContent = innerTable || innerChart;

        if (hasContent) {
          // 원본 스타일 저장 (첫 번째 반복에서만)
          if (iteration === 0 && !originalStyles.has(box)) {
            originalStyles.set(box, {
              height: box.style.height,
              maxHeight: box.style.maxHeight,
              width: box.style.width,
              maxWidth: box.style.maxWidth,
            });
          }

          // 내부 콘텐츠 크기 측정
          let boxContentWidth = 0;
          let boxContentHeight = 0;

          if (innerTable) {
            const tableRect = innerTable.getBoundingClientRect();
            const tableScrollWidth = innerTable.scrollWidth || tableRect.width;
            boxContentWidth = Math.max(boxContentWidth, tableScrollWidth);
            boxContentHeight = Math.max(boxContentHeight, tableRect.height);
          }

          if (innerChart) {
            const chartRect = innerChart.getBoundingClientRect();
            if (chartRect.width > 100 && chartRect.height > 50) {
              boxContentWidth = Math.max(boxContentWidth, chartRect.width);
              boxContentHeight = Math.max(boxContentHeight, chartRect.height);
            }
          }

          if (boxContentWidth > 0 && boxContentHeight > 0) {
            // 패딩/보더 고려
            const boxPaddingLeft = parseInt(boxStyle.paddingLeft || '0') || 0;
            const boxPaddingRight = parseInt(boxStyle.paddingRight || '0') || 0;
            const boxBorderLeft = parseInt(boxStyle.borderLeftWidth || '0') || 0;
            const boxBorderRight = parseInt(boxStyle.borderRightWidth || '0') || 0;
            const boxPaddingTop = parseInt(boxStyle.paddingTop || '0') || 0;
            const boxPaddingBottom = parseInt(boxStyle.paddingBottom || '0') || 0;
            const boxBorderTop = parseInt(boxStyle.borderTopWidth || '0') || 0;
            const boxBorderBottom = parseInt(boxStyle.borderBottomWidth || '0') || 0;

            const adjustedBoxWidth = boxContentWidth + boxPaddingLeft + boxPaddingRight + boxBorderLeft + boxBorderRight + minPadding;
            const adjustedBoxHeight = boxContentHeight + boxPaddingTop + boxPaddingBottom + boxBorderTop + boxBorderBottom + minPadding;

            // 박스 크기 조정 (과도한 크기만)
            const widthTolerance = boxContentWidth * tolerance;
            if (boxRect.width > adjustedBoxWidth + widthTolerance) {
              box.style.setProperty('width', `${adjustedBoxWidth}px`, 'important');
              box.style.setProperty('max-width', `${adjustedBoxWidth}px`, 'important');
            }

            if (boxRect.height > adjustedBoxHeight + widthTolerance) {
              box.style.setProperty('height', `${adjustedBoxHeight}px`, 'important');
              box.style.setProperty('max-height', `${adjustedBoxHeight}px`, 'important');
            }
          }
        }
      } catch (e) {
        // 무시
      }
    }

    // 반복 사이 대기
    if (iteration < iterations - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // 박스 조정 후 렌더링 대기
  if (boxContainers.length > 0) {
    await new Promise(r => setTimeout(r, 300));
  }

  return originalStyles; // 복원용
}

/**
 * 오른쪽 여백 제거 (maxRelativeRight vs scrollWidth 비교)
 */
export function removeRightWhitespace(measuredWidth, maxRelativeRight, scrollWidth, elementWidth) {
  // maxRelativeRight가 있으면 우선 사용 (실제 콘텐츠 위치)
  if (maxRelativeRight > 0) {
    const scrollWidthDiff = scrollWidth - maxRelativeRight;
    
    // scrollWidth가 maxRelativeRight보다 크면 불필요한 여백 포함
    if (scrollWidthDiff > 50) {
      // maxRelativeRight 기준 사용 (오른쪽 여백 제거)
      return Math.max(measuredWidth, maxRelativeRight + 40);
    } else {
      // 차이가 작으면 scrollWidth 사용
      return Math.max(measuredWidth, Math.min(scrollWidth, maxRelativeRight * 1.1));
    }
  }

  // maxRelativeRight가 없으면 scrollWidth 사용
  if (scrollWidth > 0) {
    return Math.max(measuredWidth, Math.min(scrollWidth, elementWidth * 1.2));
  }

  return measuredWidth;
}

