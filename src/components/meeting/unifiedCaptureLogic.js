/**
 * 통합 캡처 로직
 * 모든 슬라이드 타입의 캡처 로직을 설정 기반으로 통합 처리
 */

import { 
  identifySlideType, 
  getCaptureConfig, 
  waitForDataLoading, 
  findTables, 
  measureContentSize, 
  resizeBoxesToContent, 
  removeRightWhitespace 
} from './SlideCaptureConfig';
import { captureElement } from '../../utils/screenCapture';

/**
 * 슬라이드 타입별 특수 처리 함수
 */
const slideSpecificHandlers = {
  /**
   * 월간시상 슬라이드 처리
   */
  async monthlyAward(slideElement, slide) {
    // 1) 확대 버튼 클릭
    const expandBtn = Array.from(document.querySelectorAll('button, .MuiButton-root')).find(
      (el) => typeof el.textContent === 'string' && el.textContent.trim() === '확대'
    );
    if (expandBtn) {
      expandBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // 2) 5개 테이블 찾기
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

    const tables = [statsPaper, matrixPaper, channelBox, officeBox, departmentBox].filter(Boolean);

    // 3) commonAncestor 찾기
    let commonAncestor = slideElement;
    
    if (tables.length > 0) {
      const findCommonAncestor = (elements) => {
        if (!elements || elements.length === 0) return null;
        const getAncestors = (el) => {
          const list = [];
          let cur = el;
          while (cur) { list.push(cur); cur = cur.parentElement; }
          return list;
        };
        let common = getAncestors(elements[0]);
        for (let i = 1; i < elements.length; i++) {
          const ancestors = new Set(getAncestors(elements[i]));
          common = common.filter(a => ancestors.has(a));
        }
        return common.find(el => el !== document.body && slideElement.contains(el)) || slideElement;
      };
      
      const foundAncestor = findCommonAncestor(tables);
      
      if (foundAncestor) {
        const foundRect = foundAncestor.getBoundingClientRect();
        const slideRect = slideElement.getBoundingClientRect();
        
        if (foundRect.height >= slideRect.height * 0.9 && foundRect.width >= slideRect.width * 0.9) {
          commonAncestor = slideElement;
        } else {
          const hasTableInFound = Array.from(foundAncestor.querySelectorAll('table, .MuiTable-root, .MuiTableContainer-root')).length > 0;
          if (!hasTableInFound) {
            commonAncestor = slideElement;
          } else {
            commonAncestor = foundAncestor;
          }
        }
      }
    }

    // 4) 콘텐츠 크기 측정 및 캡처
    if (commonAncestor) {
      commonAncestor.scrollIntoView({ block: 'start', behavior: 'instant' });
      await new Promise(r => setTimeout(r, 500));

      // 측정 도구 사용
      const sizeInfo = measureContentSize(commonAncestor, {
        preferTables: true,
        excludeBorders: true,
        padding: 100
      });

      // 높이 설정
      const originalHeight = commonAncestor.style.height;
      const originalMaxHeight = commonAncestor.style.maxHeight;
      commonAncestor.style.height = `${sizeInfo.measuredHeight}px`;
      commonAncestor.style.maxHeight = `${sizeInfo.measuredHeight}px`;
      commonAncestor.style.overflow = 'visible';

      await new Promise(r => setTimeout(r, 300));

      // 콘텐츠 밑 여백 제거를 위해 크롭 활성화
      const blob = await captureElement(commonAncestor, {
        scale: 2,
        useCORS: true,
        fixedBottomPaddingPx: 0,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        skipAutoCrop: false, // 크롭 활성화 (콘텐츠 밑 여백 제거)
        height: sizeInfo.measuredHeight * 2
      });

      // 스타일 복원
      if (originalHeight) {
        commonAncestor.style.height = originalHeight;
      } else {
        commonAncestor.style.removeProperty('height');
      }
      if (originalMaxHeight) {
        commonAncestor.style.maxHeight = originalMaxHeight;
      } else {
        commonAncestor.style.removeProperty('max-height');
      }
      commonAncestor.style.removeProperty('overflow');

      return blob;
    }

    return null;
  },

  /**
   * 전체총마감 슬라이드 처리
   */
  async totalClosing(slideElement, slide, captureTargetElement) {
    const config = getCaptureConfig(slide);

    // 데이터 로딩 대기
    if (config.needsDataLoadingWait) {
      await waitForDataLoading(slideElement, {
        maxWait: 20000,
        loadingTexts: ['로딩', '불러오는 중', '데이터를 불러오는 중'],
      });
    }

    // 모든 섹션 펼치기
    if (config.needsTableExpansion) {
      const expandButtons = Array.from(document.querySelectorAll('button, .MuiButton-root'))
        .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'));
      for (const btn of expandButtons) {
        btn.click();
        await new Promise(r => setTimeout(r, 300));
      }
      await new Promise(r => setTimeout(r, 1000)); // 모든 섹션 렌더링 대기
    }

    // 박스 크기 조정
    let originalBoxStyles = null;
    if (config.needsBoxResize && captureTargetElement) {
      originalBoxStyles = await resizeBoxesToContent(captureTargetElement, {
        iterations: config.boxResizeIterations || 2,
        tolerance: 0.05,
        minPadding: 10
      });
    }

    // 콘텐츠 크기 측정
    if (config.needsHeightMeasurement && captureTargetElement) {
      const sizeInfo = measureContentSize(captureTargetElement, {
        preferTables: true,
        excludeBorders: true,
        padding: 100
      });

      // 담당자별 실적 테이블 포함 확인
      if (config.needsManagerTableInclusion) {
        const managerTables = findTables(captureTargetElement, { includeContainers: true })
          .filter(table => {
            const text = (table.textContent || '').toLowerCase();
            return text.includes('담당자별') || text.includes('담당자');
          });

        if (managerTables.length > 0) {
          const lastTable = managerTables[managerTables.length - 1];
          const rect = captureTargetElement.getBoundingClientRect();
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
          captureTargetElement.getBoundingClientRect().width
        );
      }

      // 슬라이드 헤더 너비를 콘텐츠 가로길이에 맞춰 조정 (전체총마감)
      const slideHeader = slideElement.querySelector('[class*="header"], [class*="Header"], .MuiAppBar-root, .MuiToolbar-root, header, [role="banner"]');
      const originalHeaderStyles = new Map();
      if (slideHeader && sizeInfo.measuredWidth > 0) {
        const headerRect = slideHeader.getBoundingClientRect();
        const contentWidth = sizeInfo.measuredWidth;
        
        if (headerRect.width < contentWidth) {
          originalHeaderStyles.set(slideHeader, {
            width: slideHeader.style.width,
            maxWidth: slideHeader.style.maxWidth,
            minWidth: slideHeader.style.minWidth
          });
          
          // 헤더 너비를 콘텐츠 너비에 맞춤
          slideHeader.style.width = `${contentWidth}px`;
          slideHeader.style.maxWidth = `${contentWidth}px`;
          slideHeader.style.minWidth = `${contentWidth}px`;
          
          // 헤더 내부 요소들도 비율 조정
          const headerChildren = slideHeader.querySelectorAll('*');
          headerChildren.forEach(child => {
            const childStyle = window.getComputedStyle(child);
            if (childStyle.width && childStyle.width.includes('%')) {
              // 비율 기반이면 그대로 유지
            } else if (childStyle.width && !childStyle.width.includes('auto')) {
              // 고정 너비면 비율로 조정
              const currentWidth = parseFloat(childStyle.width) || 0;
              if (currentWidth > 0 && headerRect.width > 0) {
                const ratio = contentWidth / headerRect.width;
                child.style.width = `${currentWidth * ratio}px`;
              }
            }
          });
        }
      }

      // 스타일 적용
      const originalHeight = captureTargetElement.style.height;
      const originalMaxHeight = captureTargetElement.style.maxHeight;
      const originalWidth = captureTargetElement.style.width;
      const originalMaxWidth = captureTargetElement.style.maxWidth;

      captureTargetElement.style.height = `${sizeInfo.measuredHeight}px`;
      captureTargetElement.style.maxHeight = `${sizeInfo.measuredHeight}px`;
      captureTargetElement.style.width = `${sizeInfo.measuredWidth}px`;
      captureTargetElement.style.maxWidth = `${sizeInfo.measuredWidth}px`;
      captureTargetElement.style.overflow = 'visible';

      await new Promise(r => setTimeout(r, 300));

      const blob = await captureElement(captureTargetElement, {
        scale: 2,
        useCORS: true,
        fixedBottomPaddingPx: 0, // 핑크바 제거
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        skipAutoCrop: false, // 크롭 활성화 (콘텐츠 밑 여백 제거)
        height: sizeInfo.measuredHeight * 2,
        width: sizeInfo.measuredWidth * 2 // 너비도 명시적으로 설정
      });

      // 스타일 복원
      if (originalHeight) {
        captureTargetElement.style.height = originalHeight;
      } else {
        captureTargetElement.style.removeProperty('height');
      }
      if (originalMaxHeight) {
        captureTargetElement.style.maxHeight = originalMaxHeight;
      } else {
        captureTargetElement.style.removeProperty('max-height');
      }
      if (originalWidth) {
        captureTargetElement.style.width = originalWidth;
      } else {
        captureTargetElement.style.removeProperty('width');
      }
      if (originalMaxWidth) {
        captureTargetElement.style.maxWidth = originalMaxWidth;
      } else {
        captureTargetElement.style.removeProperty('max-width');
      }
      captureTargetElement.style.removeProperty('overflow');

      // 헤더 스타일 복원
      if (originalHeaderStyles.size > 0) {
        originalHeaderStyles.forEach((styles, header) => {
          if (!header || !header.style) return;
          if (styles.width) header.style.width = styles.width;
          else header.style.removeProperty('width');
          if (styles.maxWidth) header.style.maxWidth = styles.maxWidth;
          else header.style.removeProperty('max-width');
          if (styles.minWidth) header.style.minWidth = styles.minWidth;
          else header.style.removeProperty('min-width');
        });
      }

      // 박스 스타일 복원
      if (originalBoxStyles) {
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
      }

      return blob;
    }

    return null;
  },

  /**
   * 가입자증감 슬라이드 처리
   */
  async subscriberIncrease(slideElement, slide, captureTargetElement) {
    const config = getCaptureConfig(slide);

    // 데이터 로딩 대기
    if (config.needsDataLoadingWait) {
      await waitForDataLoading(slideElement, {
        maxWait: 10000,
        loadingTexts: ['데이터를 불러오는 중', '불러오는 중', '로딩 중'],
        checkLoadingIcon: true,
        checkDataPresence: true
      });
    }

    await new Promise(r => setTimeout(r, 1000)); // 추가 안정화 대기

    // 박스 크기 조정
    let originalBoxStyles = null;
    if (config.needsBoxResize && captureTargetElement) {
      originalBoxStyles = await resizeBoxesToContent(captureTargetElement, {
        iterations: config.boxResizeIterations || 2,
        tolerance: 0.05,
        minPadding: 10
      });
    }

    // 콘텐츠 크기 측정
    if (config.needsHeightMeasurement && captureTargetElement) {
      const sizeInfo = measureContentSize(captureTargetElement, {
        preferTables: true,
        preferCharts: true,
        excludeBorders: true,
        padding: 40
      });

      // 오른쪽 여백 제거
      if (config.needsRightWhitespaceRemoval) {
        sizeInfo.measuredWidth = removeRightWhitespace(
          sizeInfo.measuredWidth,
          sizeInfo.maxRelativeRight,
          sizeInfo.scrollWidth,
          captureTargetElement.getBoundingClientRect().width
        );
      }

      // 슬라이드 헤더 너비를 콘텐츠 가로길이에 맞춰 조정 (가입자증감)
      const slideHeader = slideElement.querySelector('[class*="header"], [class*="Header"], .MuiAppBar-root, .MuiToolbar-root, header, [role="banner"]');
      const originalHeaderStyles = new Map();
      if (slideHeader && sizeInfo.measuredWidth > 0) {
        const headerRect = slideHeader.getBoundingClientRect();
        const contentWidth = sizeInfo.measuredWidth;
        
        if (headerRect.width < contentWidth) {
          originalHeaderStyles.set(slideHeader, {
            width: slideHeader.style.width,
            maxWidth: slideHeader.style.maxWidth,
            minWidth: slideHeader.style.minWidth
          });
          
          slideHeader.style.width = `${contentWidth}px`;
          slideHeader.style.maxWidth = `${contentWidth}px`;
          slideHeader.style.minWidth = `${contentWidth}px`;
        }
      }

      // 테이블과 그래프 크기를 슬라이드 크기에 맞춰 조정
      const tables = captureTargetElement.querySelectorAll('table, .MuiTable-root, .MuiTableContainer-root');
      const charts = captureTargetElement.querySelectorAll('canvas, svg, [class*="recharts"], [class*="Chart"]');
      const originalTableChartStyles = new Map();
      
      // 슬라이드 콘텐츠 박스 너비 기준으로 조정
      const slideContentBox = captureTargetElement.querySelector('.MuiPaper-root, .MuiCard-root, [class*="container"], [class*="Container"]');
      const targetWidth = slideContentBox ? slideContentBox.getBoundingClientRect().width : sizeInfo.measuredWidth;
      
      // 테이블 크기 조정
      tables.forEach(table => {
        const tableRect = table.getBoundingClientRect();
        if (tableRect.width > targetWidth) {
          originalTableChartStyles.set(table, {
            width: table.style.width,
            maxWidth: table.style.maxWidth
          });
          table.style.width = `${targetWidth}px`;
          table.style.maxWidth = `${targetWidth}px`;
        }
      });
      
      // 그래프 크기 조정
      charts.forEach(chart => {
        const chartRect = chart.getBoundingClientRect();
        if (chartRect.width > targetWidth) {
          originalTableChartStyles.set(chart, {
            width: chart.style.width,
            maxWidth: chart.style.maxWidth
          });
          chart.style.width = `${targetWidth}px`;
          chart.style.maxWidth = `${targetWidth}px`;
        }
      });

      // 높이 제한 (scrollHeight * 1.05)
      if (sizeInfo.measuredHeight > sizeInfo.scrollHeight * 1.1) {
        sizeInfo.measuredHeight = Math.min(sizeInfo.measuredHeight, sizeInfo.scrollHeight * 1.05);
      }

      // 스타일 적용
      const originalHeight = captureTargetElement.style.height;
      const originalMaxHeight = captureTargetElement.style.maxHeight;
      const originalWidth = captureTargetElement.style.width;
      const originalMaxWidth = captureTargetElement.style.maxWidth;

      captureTargetElement.style.height = `${sizeInfo.measuredHeight}px`;
      captureTargetElement.style.maxHeight = `${sizeInfo.measuredHeight}px`;
      captureTargetElement.style.width = `${sizeInfo.measuredWidth}px`;
      captureTargetElement.style.maxWidth = `${sizeInfo.measuredWidth}px`;
      captureTargetElement.style.overflow = 'visible';

      await new Promise(r => setTimeout(r, 300));

      const blob = await captureElement(captureTargetElement, {
        scale: 2,
        useCORS: true,
        fixedBottomPaddingPx: 0, // 핑크바 제거
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        skipAutoCrop: false, // 크롭 활성화 (콘텐츠 밑 여백 제거)
        height: sizeInfo.measuredHeight * 2,
        width: sizeInfo.measuredWidth * 2
      });

      // 스타일 복원
      if (originalHeight) captureTargetElement.style.height = originalHeight;
      else captureTargetElement.style.removeProperty('height');
      if (originalMaxHeight) captureTargetElement.style.maxHeight = originalMaxHeight;
      else captureTargetElement.style.removeProperty('max-height');
      if (originalWidth) captureTargetElement.style.width = originalWidth;
      else captureTargetElement.style.removeProperty('width');
      if (originalMaxWidth) captureTargetElement.style.maxWidth = originalMaxWidth;
      else captureTargetElement.style.removeProperty('max-width');
      captureTargetElement.style.removeProperty('overflow');

      // 헤더 스타일 복원 (가입자증감)
      if (originalHeaderStyles.size > 0) {
        originalHeaderStyles.forEach((styles, header) => {
          if (!header || !header.style) return;
          if (styles.width) header.style.width = styles.width;
          else header.style.removeProperty('width');
          if (styles.maxWidth) header.style.maxWidth = styles.maxWidth;
          else header.style.removeProperty('max-width');
          if (styles.minWidth) header.style.minWidth = styles.minWidth;
          else header.style.removeProperty('min-width');
        });
      }

      // 테이블/그래프 스타일 복원 (가입자증감)
      if (originalTableChartStyles.size > 0) {
        originalTableChartStyles.forEach((styles, element) => {
          if (!element || !element.style) return;
          if (styles.width) element.style.width = styles.width;
          else element.style.removeProperty('width');
          if (styles.maxWidth) element.style.maxWidth = styles.maxWidth;
          else element.style.removeProperty('max-width');
        });
      }

      // 박스 스타일 복원
      if (originalBoxStyles) {
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
      }

      return blob;
    }

    return null;
  },

  /**
   * 재초담초채권 슬라이드 처리
   */
  async rechotanchoBond(slideElement, slide, captureTargetElement) {
    const config = getCaptureConfig(slide);

    // 박스 크기 조정
    let originalBoxStyles = null;
    if (config.needsBoxResize && captureTargetElement) {
      originalBoxStyles = await resizeBoxesToContent(captureTargetElement, {
        iterations: config.boxResizeIterations || 2,
        tolerance: 0.05,
        minPadding: 10
      });
    }

    // 헤더 크기 조정
    const originalHeaderStyles = new Map();
    if (config.needsHeaderSizeAdjustment && captureTargetElement) {
      const dataInputHeaders = captureTargetElement.querySelectorAll('h6, .MuiTypography-h6, .MuiTypography-h5');
      const elementRect = captureTargetElement.getBoundingClientRect();

      for (const header of dataInputHeaders) {
        try {
          const headerText = (header.textContent || '').trim();
          if (headerText && 
              (headerText.includes('입력') || headerText.includes('데이터') || 
               headerText.includes('채권') || headerText.includes('현황')) &&
              !headerText.includes('조회') && !headerText.includes('선택')) {
            const headerRect = header.getBoundingClientRect();
            if (headerRect.width > elementRect.width * 0.95) {
              originalHeaderStyles.set(header, {
                width: header.style.width,
                maxWidth: header.style.maxWidth,
                fontSize: header.style.fontSize,
                padding: header.style.padding
              });

              const maxHeaderWidth = elementRect.width * 0.90;
              header.style.maxWidth = `${maxHeaderWidth}px`;
              header.style.width = `${maxHeaderWidth}px`;
              header.style.overflow = 'hidden';
              header.style.textOverflow = 'ellipsis';
              header.style.whiteSpace = 'nowrap';

              const headerStyle = window.getComputedStyle(header);
              const currentFontSize = parseFloat(headerStyle.fontSize || '16');
              if (currentFontSize > 14) {
                header.style.fontSize = `${Math.max(14, currentFontSize * 0.9)}px`;
              }
            }
          }
        } catch (e) {
          // 무시
        }
      }
    }

    // 콘텐츠 크기 측정
    if (config.needsHeightMeasurement && captureTargetElement) {
      const sizeInfo = measureContentSize(captureTargetElement, {
        preferTables: true,
        preferCharts: true,
        excludeBorders: true,
        padding: 40
      });

      // 오른쪽 여백 제거
      if (config.needsRightWhitespaceRemoval) {
        sizeInfo.measuredWidth = removeRightWhitespace(
          sizeInfo.measuredWidth,
          sizeInfo.maxRelativeRight,
          sizeInfo.scrollWidth,
          captureTargetElement.getBoundingClientRect().width
        );
      }

      // 재초담초채권: 콘텐츠 박스 너비 통일 (슬라이드 콘텐츠 박스 비율에 맞춤)
      const contentBoxes = captureTargetElement.querySelectorAll('.MuiPaper-root, .MuiCard-root, [class*="Paper"], [class*="Card"]');
      let originalContentBoxStyles = new Map();
      const slideContentBoxWidth = captureTargetElement.getBoundingClientRect().width;
      
      // 모든 콘텐츠 박스를 동일한 너비로 통일
      contentBoxes.forEach(box => {
        const boxRect = box.getBoundingClientRect();
        if (boxRect.width > 0) {
          originalContentBoxStyles.set(box, {
            width: box.style.width,
            maxWidth: box.style.maxWidth,
            minWidth: box.style.minWidth
          });
          
          // 슬라이드 콘텐츠 박스 너비의 95%로 통일 (여유 공간 확보)
          const unifiedWidth = slideContentBoxWidth * 0.95;
          box.style.width = `${unifiedWidth}px`;
          box.style.maxWidth = `${unifiedWidth}px`;
          box.style.minWidth = `${unifiedWidth}px`;
        }
      });

      // 스타일 적용
      const originalHeight = captureTargetElement.style.height;
      const originalMaxHeight = captureTargetElement.style.maxHeight;
      const originalWidth = captureTargetElement.style.width;
      const originalMaxWidth = captureTargetElement.style.maxWidth;

      captureTargetElement.style.height = `${sizeInfo.measuredHeight}px`;
      captureTargetElement.style.maxHeight = `${sizeInfo.measuredHeight}px`;
      captureTargetElement.style.width = `${sizeInfo.measuredWidth}px`;
      captureTargetElement.style.maxWidth = `${sizeInfo.measuredWidth}px`;
      captureTargetElement.style.overflow = 'visible';

      await new Promise(r => setTimeout(r, 300));

      const blob = await captureElement(captureTargetElement, {
        scale: 2,
        useCORS: true,
        fixedBottomPaddingPx: 0, // 핑크바 제거
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        skipAutoCrop: false, // 크롭 활성화 (콘텐츠 밑 여백 제거)
        height: sizeInfo.measuredHeight * 2
      });

      // 스타일 복원
      if (originalHeight) captureTargetElement.style.height = originalHeight;
      else captureTargetElement.style.removeProperty('height');
      if (originalMaxHeight) captureTargetElement.style.maxHeight = originalMaxHeight;
      else captureTargetElement.style.removeProperty('max-height');
      if (originalWidth) captureTargetElement.style.width = originalWidth;
      else captureTargetElement.style.removeProperty('width');
      if (originalMaxWidth) captureTargetElement.style.maxWidth = originalMaxWidth;
      else captureTargetElement.style.removeProperty('max-width');
      captureTargetElement.style.removeProperty('overflow');

      // 콘텐츠 박스 스타일 복원 (재초담초채권)
      if (originalContentBoxStyles && originalContentBoxStyles.size > 0) {
        originalContentBoxStyles.forEach((styles, box) => {
          if (!box || !box.style) return;
          if (styles.width) box.style.width = styles.width;
          else box.style.removeProperty('width');
          if (styles.maxWidth) box.style.maxWidth = styles.maxWidth;
          else box.style.removeProperty('max-width');
          if (styles.minWidth) box.style.minWidth = styles.minWidth;
          else box.style.removeProperty('min-width');
        });
      }

      // 헤더 스타일 복원 (재초담초채권)
      if (originalHeaderStyles && originalHeaderStyles.size > 0) {
        originalHeaderStyles.forEach((styles, header) => {
          if (!header || !header.style) return;
          if (styles.width) header.style.width = styles.width;
          else header.style.removeProperty('width');
          if (styles.maxWidth) header.style.maxWidth = styles.maxWidth;
          else header.style.removeProperty('max-width');
          if (styles.fontSize) header.style.fontSize = styles.fontSize;
          else header.style.removeProperty('font-size');
          if (styles.padding) header.style.padding = styles.padding;
          else header.style.removeProperty('padding');
          header.style.removeProperty('overflow');
          header.style.removeProperty('text-overflow');
          header.style.removeProperty('white-space');
        });
      }

      // 박스 스타일 복원
      if (originalBoxStyles) {
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
      }

      return blob;
    }

    return null;
  },

  /**
   * 재고장표 슬라이드 처리
   */
  async inventoryChart(slideElement, slide, captureTargetElement) {
    const config = getCaptureConfig(slide);

    // 데이터 로딩 대기
    if (config.needsDataLoadingWait) {
      await waitForDataLoading(slideElement, {
        maxWait: 10000,
        loadingTexts: ['로딩', '불러오는 중'],
      });
    }

    // 모든 '펼치기' 버튼 클릭
    if (config.needsTableExpansion) {
      Array.from(document.querySelectorAll('button, .MuiButton-root'))
        .filter(el => typeof el.textContent === 'string' && el.textContent.includes('펼치기'))
        .forEach(el => el.click());
      await new Promise(r => setTimeout(r, 500));
    }

    // 헤더 찾기 (슬라이드 헤더) - 강화된 로직
    let headerElement = null;
    if (config.needsHeaderComposition) {
      const slideRect = slideElement.getBoundingClientRect();
      
      // 방법 1: fixed/absolute 위치 요소 찾기
      const fixedOrAbsolute = Array.from(slideElement.querySelectorAll('*')).find(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const relativeTop = rect.top - slideRect.top;
        return (style.position === 'fixed' || style.position === 'absolute') &&
               relativeTop >= -20 && relativeTop < 200 &&
               rect.height > 50 && rect.width > 200;
      });
      if (fixedOrAbsolute) {
        headerElement = fixedOrAbsolute;
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [재고장표] 헤더 찾음 (fixed/absolute):', fixedOrAbsolute);
        }
      }

      // 방법 2: 직접 자식 요소 중에서 찾기 (회사명 포함)
      if (!headerElement) {
        for (const child of Array.from(slideElement.children)) {
          const style = window.getComputedStyle(child);
          const text = (child.textContent || '').trim();
          const rect = child.getBoundingClientRect();
          const relativeTop = rect.top - slideRect.top;
          
          // 슬라이드 상단 헤더: absolute/fixed 위치이거나, 상단에 위치하고, 회사명 포함
          if (((style.position === 'absolute' || style.position === 'fixed') || relativeTop < 150) &&
              (relativeTop >= -20 && relativeTop < 200) &&
              (text.includes('(주)브이아이피플러스') || text.includes('브이아이피') || 
               text.includes('회사') || text.includes('company')) &&
              !text.includes('재고장표') && // 중간 컨텐츠 헤더 제외
              rect.height > 50 && rect.width > 200) {
            headerElement = child;
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [재고장표] 헤더 찾음 (직접 자식):', text.substring(0, 50));
            }
            break;
          }
        }
      }

      // 방법 3: 클래스명 기반 찾기
      if (!headerElement) {
        const byClass = slideElement.querySelector('[class*="header"], [class*="Header"], .MuiAppBar-root, .MuiToolbar-root, header, [role="banner"]');
        if (byClass) {
          const rect = byClass.getBoundingClientRect();
          const relativeTop = rect.top - slideRect.top;
          if (relativeTop >= -20 && relativeTop < 250 && rect.height > 30) {
            headerElement = byClass;
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [재고장표] 헤더 찾음 (클래스명):', byClass);
            }
          }
        }
      }

      // 방법 4: 모든 요소 중에서 찾기 (더 넓은 조건)
      if (!headerElement) {
        const allElements = Array.from(slideElement.querySelectorAll('*'));
        const found = allElements.find(el => {
          const elRect = el.getBoundingClientRect();
          const relativeTop = elRect.top - slideRect.top;
          const text = (el.textContent || '').toLowerCase();
          const style = window.getComputedStyle(el);
          
          return relativeTop >= -20 && relativeTop < 250 && 
                 elRect.height > 40 && 
                 elRect.width > slideRect.width * 0.4 &&
                 !text.includes('재고장표') && // 중간 컨텐츠 헤더 제외
                 (text.includes('(주)브이아이피플러스') || 
                  text.includes('브이아이피') ||
                  text.includes('회사') || text.includes('company') || 
                  el.querySelector('img, svg, [class*="logo"], [class*="Logo"]') !== null); // 로고 포함
        });
        
        if (found) {
          headerElement = found;
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [재고장표] 헤더 찾음 (모든 요소):', found);
          }
        }
      }

      // 방법 5: 상단에 위치한 큰 요소 중에서 찾기 (최후의 수단)
      if (!headerElement) {
        const allElements = Array.from(slideElement.querySelectorAll('*'));
        const candidates = allElements.filter(el => {
          const elRect = el.getBoundingClientRect();
          const relativeTop = elRect.top - slideRect.top;
          const text = (el.textContent || '').trim().toLowerCase();
          return relativeTop >= -30 && relativeTop < 200 && 
                 elRect.height > 30 && 
                 elRect.width > slideRect.width * 0.3 &&
                 !text.includes('재고장표');
        }).sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          const aTop = aRect.top - slideRect.top;
          const bTop = bRect.top - slideRect.top;
          // 상단에 가까울수록, 크기가 클수록 우선순위
          if (Math.abs(aTop) !== Math.abs(bTop)) return Math.abs(aTop) - Math.abs(bTop);
          return (bRect.width * bRect.height) - (aRect.width * aRect.height);
        });
        
        if (candidates.length > 0) {
          headerElement = candidates[0];
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [재고장표] 헤더 찾음 (후보 중 최상단):', candidates[0]);
          }
        }
      }

      if (!headerElement && process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [재고장표] 헤더를 찾지 못했습니다.');
      }
    }

    // 테이블 박스 찾기
    const tableBox = slideElement.querySelector('.MuiPaper-root, .MuiCard-root, [class*="table"], [class*="Table"]');
    const tableContainer = tableBox ? tableBox.querySelector('.MuiTableContainer-root, [class*="container"], [class*="Container"]') : null;
    const actualTable = tableContainer ? tableContainer.querySelector('table, .MuiTable-root') : null;

    if (tableBox && tableContainer && actualTable) {
      // 박스 크기 조정
      if (config.needsBoxResize) {
        const tableRect = actualTable.getBoundingClientRect();
        const tableScrollWidth = actualTable.scrollWidth || tableRect.width;
        const tableScrollHeight = actualTable.scrollHeight || tableRect.height;

        const tableBoxStyle = window.getComputedStyle(tableBox);
        const tableContainerStyle = window.getComputedStyle(tableContainer);

        const paddingLeft = parseInt(tableBoxStyle.paddingLeft || '0') || 0;
        const paddingRight = parseInt(tableBoxStyle.paddingRight || '0') || 0;
        const paddingTop = parseInt(tableBoxStyle.paddingTop || '0') || 0;
        const paddingBottom = parseInt(tableBoxStyle.paddingBottom || '0') || 0;

        // 콘텐츠에 맞는 크기로 조정 (여백 최소화)
        const adjustedWidth = tableScrollWidth + paddingLeft + paddingRight + 10; // 여유공간 최소화
        const adjustedHeight = tableScrollHeight + paddingTop + paddingBottom + 10; // 여유공간 최소화

        const originalTableBoxWidth = tableBox.style.width;
        const originalTableBoxHeight = tableBox.style.height;
        const originalTableBoxMaxWidth = tableBox.style.maxWidth;
        const originalTableBoxMaxHeight = tableBox.style.maxHeight;

        tableBox.style.width = `${adjustedWidth}px`;
        tableBox.style.height = `${adjustedHeight}px`;
        tableBox.style.maxWidth = `${adjustedWidth}px`;
        tableBox.style.maxHeight = `${adjustedHeight}px`;

        const originalTableContainerWidth = tableContainer.style.width;
        const originalTableContainerHeight = tableContainer.style.height;
        const originalTableContainerMaxWidth = tableContainer.style.maxWidth;
        const originalTableContainerMaxHeight = tableContainer.style.maxHeight;

        tableContainer.style.width = `${adjustedWidth}px`;
        tableContainer.style.height = `${adjustedHeight}px`;
        tableContainer.style.maxWidth = `${adjustedWidth}px`;
        tableContainer.style.maxHeight = `${adjustedHeight}px`;

        // 중앙 정렬
        if (config.needsTableCentering) {
          tableBox.style.margin = '0 auto';
        }

        await new Promise(r => setTimeout(r, 300));

        // 헤더 + 테이블 합성
        if (config.needsHeaderComposition && headerElement) {
          const blobToImage = (blob) => new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = (e) => reject(e);
            img.src = url;
          });

          // 헤더 요소가 실제로 보이는지 확인
          const headerRect = headerElement.getBoundingClientRect();
          const headerVisible = headerRect.width > 0 && headerRect.height > 0 && 
                                window.getComputedStyle(headerElement).display !== 'none' &&
                                window.getComputedStyle(headerElement).visibility !== 'hidden';
          
          if (!headerVisible && process.env.NODE_ENV === 'development') {
            console.warn('⚠️ [재고장표] 헤더 요소가 보이지 않습니다:', headerElement);
          }

          const headerBlob = await captureElement(headerElement, {
            scale: 2,
            useCORS: true,
            fixedBottomPaddingPx: 0,
            backgroundColor: '#ffffff',
            skipAutoCrop: true, // 헤더는 크롭하지 않음
          });

          const tableBlob = await captureElement(tableBox, {
            scale: 2,
            useCORS: true,
            fixedBottomPaddingPx: 0, // 핑크바 제거
            backgroundColor: '#ffffff',
            skipAutoCrop: false, // 크롭 활성화 (하단 여백 제거)
          });

          const headerImg = await blobToImage(headerBlob);
          const tableImg = await blobToImage(tableBlob);

          // 헤더가 제대로 캡처되었는지 확인 (너무 작으면 무시)
          if (headerImg.width < 100 || headerImg.height < 20) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [재고장표] 헤더 이미지가 너무 작습니다:', { width: headerImg.width, height: headerImg.height });
            }
            // 헤더가 없으면 테이블만 반환
            const blob = await captureElement(tableBox, {
              scale: 2,
              useCORS: true,
              fixedBottomPaddingPx: 0,
              backgroundColor: '#ffffff',
              skipAutoCrop: false,
            });
            
            // 스타일 복원 후 반환
            if (originalTableBoxWidth) tableBox.style.width = originalTableBoxWidth;
            else tableBox.style.removeProperty('width');
            if (originalTableBoxHeight) tableBox.style.height = originalTableBoxHeight;
            else tableBox.style.removeProperty('height');
            if (originalTableBoxMaxWidth) tableBox.style.maxWidth = originalTableBoxMaxWidth;
            else tableBox.style.removeProperty('max-width');
            if (originalTableBoxMaxHeight) tableBox.style.maxHeight = originalTableBoxMaxHeight;
            else tableBox.style.removeProperty('max-height');

            if (originalTableContainerWidth) tableContainer.style.width = originalTableContainerWidth;
            else tableContainer.style.removeProperty('width');
            if (originalTableContainerHeight) tableContainer.style.height = originalTableContainerHeight;
            else tableContainer.style.removeProperty('height');
            if (originalTableContainerMaxWidth) tableContainer.style.maxWidth = originalTableContainerMaxWidth;
            else tableContainer.style.removeProperty('max-width');
            if (originalTableContainerMaxHeight) tableContainer.style.maxHeight = originalTableContainerMaxHeight;
            else tableContainer.style.removeProperty('max-height');
            tableBox.style.removeProperty('margin');

            return blob;
          }

          const canvas = document.createElement('canvas');
          const gap = 0;
          canvas.width = Math.max(headerImg.width, tableImg.width);
          canvas.height = headerImg.height + tableImg.height + gap;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 헤더 중앙 정렬
          const headerX = (canvas.width - headerImg.width) / 2;
          ctx.drawImage(headerImg, headerX, 0);

          // 테이블 중앙 정렬
          const tableX = (canvas.width - tableImg.width) / 2;
          ctx.drawImage(tableImg, tableX, headerImg.height + gap);

          const compositeBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [재고장표] 헤더 + 테이블 합성 완료:', { 
              headerSize: { width: headerImg.width, height: headerImg.height },
              tableSize: { width: tableImg.width, height: tableImg.height },
              compositeSize: { width: canvas.width, height: canvas.height }
            });
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

          if (originalTableContainerWidth) tableContainer.style.width = originalTableContainerWidth;
          else tableContainer.style.removeProperty('width');
          if (originalTableContainerHeight) tableContainer.style.height = originalTableContainerHeight;
          else tableContainer.style.removeProperty('height');
          if (originalTableContainerMaxWidth) tableContainer.style.maxWidth = originalTableContainerMaxWidth;
          else tableContainer.style.removeProperty('max-width');
          if (originalTableContainerMaxHeight) tableContainer.style.maxHeight = originalTableContainerMaxHeight;
          else tableContainer.style.removeProperty('max-height');

          tableBox.style.removeProperty('margin');

          return compositeBlob;
        } else {
          // 헤더 없이 테이블만 캡처
          const blob = await captureElement(tableBox, {
            scale: 2,
            useCORS: true,
            fixedBottomPaddingPx: 0, // 핑크바 제거
            backgroundColor: '#ffffff',
            skipAutoCrop: false, // 크롭 활성화 (하단 여백 제거)
          });

          // 스타일 복원
          if (originalTableBoxWidth) tableBox.style.width = originalTableBoxWidth;
          else tableBox.style.removeProperty('width');
          if (originalTableBoxHeight) tableBox.style.height = originalTableBoxHeight;
          else tableBox.style.removeProperty('height');
          if (originalTableBoxMaxWidth) tableBox.style.maxWidth = originalTableBoxMaxWidth;
          else tableBox.style.removeProperty('max-width');
          if (originalTableBoxMaxHeight) tableBox.style.maxHeight = originalTableBoxMaxHeight;
          else tableBox.style.removeProperty('max-height');

          if (originalTableContainerWidth) tableContainer.style.width = originalTableContainerWidth;
          else tableContainer.style.removeProperty('width');
          if (originalTableContainerHeight) tableContainer.style.height = originalTableContainerHeight;
          else tableContainer.style.removeProperty('height');
          if (originalTableContainerMaxWidth) tableContainer.style.maxWidth = originalTableContainerMaxWidth;
          else tableContainer.style.removeProperty('max-width');
          if (originalTableContainerMaxHeight) tableContainer.style.maxHeight = originalTableContainerMaxHeight;
          else tableContainer.style.removeProperty('max-height');

          tableBox.style.removeProperty('margin');

          return blob;
        }
      }
    }

    return null;
  },

  /**
   * 기본 슬라이드 처리 (main, toc, ending)
   */
  async basicSlide(slideElement, slide, captureTargetElement) {
    const config = getCaptureConfig(slide);

    // 스크롤 제약 제거
    if (config.needsScrollRemoval && captureTargetElement) {
      captureTargetElement.scrollTop = 0;
      if (captureTargetElement.parentElement) {
        captureTargetElement.parentElement.scrollTop = 0;
      }

      const allElements = captureTargetElement.querySelectorAll('*');
      const originalStyles = new Map();

      allElements.forEach(el => {
        if (!el || !el.style) return;

        const styles = {
          overflow: el.style.overflow,
          overflowY: el.style.overflowY,
          overflowX: el.style.overflowX,
          maxHeight: el.style.maxHeight,
          height: el.style.height,
          minHeight: el.style.minHeight
        };
        originalStyles.set(el, styles);

        const computed = window.getComputedStyle(el);
        const hasMaxHeight = computed.maxHeight && computed.maxHeight !== 'none' && computed.maxHeight !== 'auto';
        const hasOverflow = computed.overflow === 'auto' || computed.overflow === 'scroll' || computed.overflow === 'hidden';
        const hasOverflowY = computed.overflowY === 'auto' || computed.overflowY === 'scroll' || computed.overflowY === 'hidden';
        const hasVhHeight = computed.height && (computed.height.includes('vh') || computed.height.includes('%'));

        if (hasOverflow || hasOverflowY || el.style.overflow || el.style.overflowY) {
          el.style.setProperty('overflow', 'visible', 'important');
          el.style.setProperty('overflow-y', 'visible', 'important');
          el.style.setProperty('overflow-x', 'visible', 'important');
        }

        if (hasMaxHeight || el.style.maxHeight) {
          el.style.setProperty('max-height', 'none', 'important');
        }

        if (hasVhHeight || (el.style.height && (el.style.height.includes('vh') || el.style.height.includes('%')))) {
          el.style.setProperty('height', 'auto', 'important');
        }

        if (el.scrollHeight && el.scrollHeight > el.clientHeight) {
          el.style.setProperty('height', `${el.scrollHeight}px`, 'important');
          el.style.setProperty('max-height', 'none', 'important');
          el.style.setProperty('overflow', 'visible', 'important');
        }
      });
    }

    // 콘텐츠 크기 측정
    if (config.needsHeightMeasurement && captureTargetElement) {
      const elementRect = captureTargetElement.getBoundingClientRect();
      const allChildren = captureTargetElement.querySelectorAll('*');
      let maxBottom = elementRect.height;
      let maxRight = elementRect.width;

      allChildren.forEach(child => {
        try {
          const childRect = child.getBoundingClientRect();
          const relativeBottom = childRect.bottom - elementRect.top;
          const relativeRight = childRect.right - elementRect.left;
          maxBottom = Math.max(maxBottom, relativeBottom);
          maxRight = Math.max(maxRight, relativeRight);
        } catch (e) {
          // 무시
        }
      });

      const actualContentHeight = Math.max(maxBottom, captureTargetElement.scrollHeight || elementRect.height);
      const actualContentWidth = Math.max(
        maxRight, 
        captureTargetElement.scrollWidth || elementRect.width,
        elementRect.width
      );

      const targetHeight = Math.max(actualContentHeight, 400);
      const BASE_CAPTURE_WIDTH = 1280;
      const targetWidth = BASE_CAPTURE_WIDTH;

      // 너비 설정
      if (config.needsWidthAdjustment) {
        const originalWidth = captureTargetElement.style.width;
        const originalMaxWidth = captureTargetElement.style.maxWidth;
        captureTargetElement.style.setProperty('width', `${targetWidth}px`, 'important');
        captureTargetElement.style.setProperty('max-width', `${targetWidth}px`, 'important');

        await new Promise(r => setTimeout(r, 200));

        const blob = await captureElement(captureTargetElement, {
          scale: 2,
          useCORS: true,
          fixedBottomPaddingPx: config.defaultPadding,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          width: targetWidth,
          height: targetHeight,
          windowWidth: targetWidth,
          windowHeight: targetHeight,
          skipAutoCrop: true,
        });

        // 너비 복원
        if (originalWidth) {
          captureTargetElement.style.width = originalWidth;
        } else {
          captureTargetElement.style.removeProperty('width');
        }
        if (originalMaxWidth) {
          captureTargetElement.style.maxWidth = originalMaxWidth;
        } else {
          captureTargetElement.style.removeProperty('max-width');
        }

        return blob;
      }
    }

    return null;
  },
};

/**
 * 통합 캡처 처리
 */
export async function unifiedCapture(slideElement, slide, captureTargetElement) {
  const slideType = identifySlideType(slide);
  const config = getCaptureConfig(slide);

  // 슬라이드 타입별 특수 처리
  let blob = null;

  switch (slideType) {
    case 'monthlyAward':
      blob = await slideSpecificHandlers.monthlyAward(slideElement, slide);
      break;
    case 'totalClosing':
      blob = await slideSpecificHandlers.totalClosing(slideElement, slide, captureTargetElement);
      break;
    case 'subscriberIncrease':
      blob = await slideSpecificHandlers.subscriberIncrease(slideElement, slide, captureTargetElement);
      break;
    case 'rechotanchoBond':
      blob = await slideSpecificHandlers.rechotanchoBond(slideElement, slide, captureTargetElement);
      break;
    case 'inventoryChart':
      blob = await slideSpecificHandlers.inventoryChart(slideElement, slide, captureTargetElement);
      break;
    case 'main':
    case 'toc':
    case 'ending':
      blob = await slideSpecificHandlers.basicSlide(slideElement, slide, captureTargetElement);
      break;
    default:
      // 기본 캡처
      if (captureTargetElement) {
        blob = await captureElement(captureTargetElement, {
          scale: 2,
          useCORS: true,
          fixedBottomPaddingPx: config.defaultPadding,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        });
      }
      break;
  }

  return blob;
}

