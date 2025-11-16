import html2canvas from 'html2canvas';

// 슬라이드 하단 여백 색상 (파스텔톤 핫핑크)
const BOTTOM_PADDING_COLOR = '#FFB6C1';

/**
 * Canvas에서 하단 공백을 자동으로 제거합니다.
 * 실제 콘텐츠 영역만 남기고 하얀 공백을 제거합니다.
 * @param {HTMLCanvasElement} canvas - 원본 Canvas
 * @returns {Promise<HTMLCanvasElement>} 크롭된 Canvas
 */
async function autoCropCanvas(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // 배경색 감지 개선: 그라데이션 배경도 감지할 수 있도록 임계값 조정
    // 메인/목차 슬라이드의 그라데이션 배경: #f8f9fa(248,249,250), #e9ecef(233,236,239), #f1f3f5(241,243,245)
    // 평균 밝기가 높고 색상 차이가 적은 영역을 배경으로 간주
    const backgroundColorThreshold = 230; // RGB 값이 모두 230 이상이면 배경으로 간주 (기존 250에서 낮춤)
    const alphaThreshold = 10; // 알파값이 10 이하면 투명으로 간주
    
    // 그라데이션 배경 감지를 위한 추가 로직
    const isLightBackground = (r, g, b) => {
      // 밝은 회색 계열 배경 감지 (RGB 평균이 230 이상이고, 색상 차이가 20 이하)
      const avg = (r + g + b) / 3;
      const maxDiff = Math.max(r, g, b) - Math.min(r, g, b);
      return avg >= 230 && maxDiff <= 20;
    };
    
    let minX = canvas.width;
    let minY = 0; // 상단은 0부터 시작 (상단 공백 유지)
    let maxX = 0;
    let maxY = 0;
    
    // 실제 콘텐츠 영역 찾기 (하단부터 역순으로 스캔하여 마지막 콘텐츠 라인 찾기)
    // 하단 공백만 제거하기 위해 하단부터 스캔
    // 근본적 개선: 마지막 콘텐츠 라인을 찾은 후, 그 아래에 최소 여유 공간을 강제로 보장
    let consecutiveEmptyLines = 0;
    const requiredEmptyLines = 20; // 연속으로 20줄 이상 빈 공간이면 하단 공백으로 간주
    const minBottomPadding = 80; // 마지막 콘텐츠 라인 아래 최소 여유 공간 (헤더-내용 간격과 비슷)
    
    // 마지막 콘텐츠 라인을 찾기 위한 변수 (하단에서 가장 가까운 콘텐츠 라인)
    let lastContentLine = 0;
    
    // 하단부터 스캔: y는 canvas.height - 1부터 0까지 감소
    for (let y = canvas.height - 1; y >= 0; y--) {
      let contentPixels = 0;
      
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 배경이 아닌 픽셀인지 확인 (기존 로직 + 그라데이션 배경 감지)
        const isStandardBackground = 
          (r >= backgroundColorThreshold && 
           g >= backgroundColorThreshold && 
           b >= backgroundColorThreshold) ||
          a < alphaThreshold;
        
        const isGradientBackground = isLightBackground(r, g, b);
        const isBackground = isStandardBackground || isGradientBackground;
        
        if (!isBackground) {
          contentPixels++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      
      // 콘텐츠가 있는 라인인지 확인 (라인의 5% 이상이 콘텐츠면 콘텐츠 라인으로 간주)
      const contentRatio = contentPixels / canvas.width;
      if (contentRatio > 0.05) {
        // 실제 콘텐츠가 있는 라인
        consecutiveEmptyLines = 0;
        // 하단부터 스캔하므로, 첫 번째로 만나는 콘텐츠 라인이 하단에서 가장 가까운 콘텐츠 = 마지막 콘텐츠 라인
        if (lastContentLine === 0) {
          lastContentLine = y; // 마지막 콘텐츠 라인 기록
        }
        if (maxY === 0) {
          maxY = y; // 첫 번째 콘텐츠 라인 (하단부터)
        }
      } else {
        // 빈 라인
        consecutiveEmptyLines++;
        // 연속된 빈 라인이 충분히 많으면 하단 공백으로 간주하고 중단
        // 단, 마지막 콘텐츠 라인 아래 최소 여유 공간은 보장
        if (consecutiveEmptyLines >= requiredEmptyLines && lastContentLine > 0) {
          // 하단(canvas.height - 1)에서 마지막 콘텐츠 라인(lastContentLine)까지의 거리
          // 이 거리가 최소 여유 공간보다 작으면, 최소 여유 공간을 보장
          const bottomSpace = (canvas.height - 1) - lastContentLine;
          if (bottomSpace < minBottomPadding) {
            // 최소 여유 공간보다 적으면, 마지막 콘텐츠 라인 + 최소 여유 공간으로 설정
            maxY = Math.min(canvas.height - 1, lastContentLine + minBottomPadding);
          } else {
            // 충분한 공백이 있으면 현재 위치(y)에서 중단
            // 하지만 마지막 콘텐츠 라인 아래 최소 여유 공간은 보장
            maxY = Math.min(canvas.height - 1, lastContentLine + minBottomPadding);
          }
          break;
        }
      }
    }
    
    // 마지막 콘텐츠 라인을 찾았지만 충분한 공백이 없는 경우, 최소 여유 공간 보장
    // (연속된 빈 라인을 만나지 못한 경우에도 보장)
    if (lastContentLine > 0) {
      if (maxY === 0) {
        // 콘텐츠는 찾았지만 maxY가 설정되지 않은 경우
        maxY = Math.min(canvas.height - 1, lastContentLine + minBottomPadding);
      } else {
        // 하단에서 마지막 콘텐츠 라인까지의 거리 확인
        const bottomSpace = (canvas.height - 1) - lastContentLine;
        if (bottomSpace < minBottomPadding) {
          // 마지막 콘텐츠 라인 아래 최소 여유 공간을 강제로 보장
          maxY = Math.min(canvas.height - 1, lastContentLine + minBottomPadding);
        } else {
          // 충분한 공백이 있어도, 마지막 콘텐츠 라인 기준으로 최소 여유 공간 보장
          // (너무 많은 공백을 제거하지 않도록)
          const currentBottomSpace = maxY - lastContentLine;
          if (currentBottomSpace < minBottomPadding) {
            maxY = Math.min(canvas.height - 1, lastContentLine + minBottomPadding);
          }
        }
      }
    }
    
    // 좌우 경계를 정확히 찾기 위해 전체 높이에서 스캔 (상단부터 maxY까지)
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 배경 감지 로직 통일 (기존 로직 + 그라데이션 배경 감지)
        const isStandardBackground = 
          (r >= backgroundColorThreshold && 
           g >= backgroundColorThreshold && 
           b >= backgroundColorThreshold) ||
          a < alphaThreshold;
        
        const isGradientBackground = isLightBackground(r, g, b);
        const isBackground = isStandardBackground || isGradientBackground;
        
        if (!isBackground) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }
    
    // 콘텐츠가 없는 경우 원본 반환
    if (minX >= maxX || maxY <= 0) {
      return canvas;
    }
    
    // 여유 공간 추가 (좌우 10px)
    // 하단은 마지막 콘텐츠 라인 기준으로 최소 여유 공간을 보장해야 하는데,
    // 콘텐츠가 캔버스의 맨 아래까지 차는 경우 기존 높이에서는 여유 공간을 확보할 수 없음.
    // 이 경우 잘라낼 영역의 출력 높이를 늘려서(아래쪽에 흰색 영역을 추가) 최소 여유 공간을 보장한다.
    const paddingX = 10; // 좌우 여유 공간
    minX = Math.max(0, minX - paddingX);
    minY = 0; // 상단은 항상 0부터 시작
    maxX = Math.min(canvas.width, maxX + paddingX);
    maxY = Math.min(canvas.height, maxY);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // 콘텐츠가 캔버스 하단까지 닿아 최소 여유 공간을 캔버스 내부에서 확보하지 못한 경우를 보정
    // lastContentLine은 하단에서 가장 가까운 실제 콘텐츠 y좌표
    // desiredMaxYRaw = 마지막 콘텐츠 라인 + 최소 여유 공간
    const desiredMaxYRaw = lastContentLine > 0 ? (lastContentLine + minBottomPadding) : maxY;
    const extraBottomPadding = Math.max(0, desiredMaxYRaw - (canvas.height - 1));
    
    // 크롭된 Canvas 생성
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    // 필요한 경우 하단에 추가 여백을 포함하여 출력 높이를 확장
    croppedCanvas.height = height + extraBottomPadding;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // 배경 흰색으로 초기화 (추가 여백 영역이 투명해지지 않도록)
    // 여기서는 기본 배경을 유지하고, 실제 하단 고정 여백은 captureElement 단계에서 별도 색상으로 처리
    croppedCtx.fillStyle = '#ffffff';
    croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
    
    // 원본 Canvas에서 크롭된 영역만 복사
    croppedCtx.drawImage(
      canvas,
      minX, minY, width, height,
      0, 0, width, height
    );
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✂️ [autoCropCanvas] 크롭 완료: ${canvas.width}x${canvas.height} → ${width}x${height}`);
    }
    
    return croppedCanvas;
  } catch (error) {
    console.warn('⚠️ [autoCropCanvas] 크롭 실패, 원본 반환:', error);
    // 크롭 실패 시 원본 반환
    return canvas;
  }
}

/**
 * DOM 요소를 이미지로 캡처합니다.
 * @param {HTMLElement} element - 캡처할 DOM 요소
 * @param {Object} options - 캡처 옵션
 * @returns {Promise<Blob>} 이미지 Blob
 */
export async function captureElement(element, options = {}) {
  if (!element) {
    throw new Error('캡처할 요소가 없습니다.');
  }

  // 호출 측에서 고정 하단 여백(px)을 지정할 수 있도록 옵션 분리
  const fixedBottomPaddingPx = typeof options.fixedBottomPaddingPx === 'number'
    ? Math.max(0, Math.floor(options.fixedBottomPaddingPx))
    : 0;
  // html2canvas에는 전달하지 않을 커스텀 옵션을 제거한 사본을 사용할 것
  const { fixedBottomPaddingPx: _omitFixed, ...html2CanvasOptions } = options || {};

  // 요소의 실제 스크롤 크기 계산 (더 정확하게)
  // 모든 자식 요소를 포함한 실제 크기 계산
  const calculateFullSize = (el) => {
    let maxWidth = el.scrollWidth || el.offsetWidth || el.clientWidth || 0;
    let maxHeight = el.scrollHeight || el.offsetHeight || el.clientHeight || 0;
    
    // 모든 자식 요소를 순회하며 실제 크기 확인
    const allChildren = el.querySelectorAll('*');
    allChildren.forEach(child => {
      const childWidth = child.scrollWidth || child.offsetWidth || 0;
      const childHeight = child.scrollHeight || child.offsetHeight || 0;
      const childRect = child.getBoundingClientRect();
      const childRight = childRect.right - childRect.left + (child.scrollWidth || 0);
      const childBottom = childRect.bottom - childRect.top + (child.scrollHeight || 0);
      
      maxWidth = Math.max(maxWidth, childRight, childWidth);
      maxHeight = Math.max(maxHeight, childBottom, childHeight);
    });
    
    // 테이블이나 스크롤 가능한 컨테이너의 경우 추가 계산
    const scrollableContainers = el.querySelectorAll('[style*="overflow"], .MuiTableContainer-root, .MuiPaper-root');
    scrollableContainers.forEach(container => {
      if (container.scrollHeight > container.clientHeight) {
        maxHeight = Math.max(maxHeight, container.scrollHeight);
      }
      if (container.scrollWidth > container.clientWidth) {
        maxWidth = Math.max(maxWidth, container.scrollWidth);
      }
    });
    
    return { width: maxWidth, height: maxHeight };
  };
  
  const fullSize = calculateFullSize(element);
  const scrollWidth = Math.max(
    fullSize.width,
    element.scrollWidth,
    element.offsetWidth,
    element.clientWidth,
    window.innerWidth
  );
  const scrollHeight = Math.max(
    fullSize.height,
    element.scrollHeight,
    element.offsetHeight,
    element.clientHeight,
    window.innerHeight
  );
  
  // 공통 헤더 위치/크기 일관성을 위해 가로 폭을 표준화(고정)하고,
  // 세로는 콘텐츠에 따라 가변(좁은 폭으로 재흐름되어 길어질 수 있음)
  const BASE_CAPTURE_WIDTH = 1280; // 표준 캡처 폭(px)
  const widthScale = BASE_CAPTURE_WIDTH / Math.max(scrollWidth, 1);
  const targetWidth = BASE_CAPTURE_WIDTH;
  // 메인/목차는 헤더 포함 전체를 캡처하므로 충분한 높이 보장
  const slideId = element.getAttribute('data-slide-id') || '';
  const isMainOrToc = slideId.includes('main') || slideId.includes('toc');
  
  // 메인/목차 슬라이드: 고정 가로폭(1280px) 적용 시 세로 재흐름으로 인한 하단 잘림 방지
  // 높이 = scrollHeight × (1/widthScale) × 1.6, 최소 1100px 보장 (목차 항목이 많은 경우 대비)
  // autoCrop 유지로 과도 여백은 자동 제거
  let targetHeight;
  if (isMainOrToc) {
    const heightScale = widthScale < 1 ? (1 / widthScale) : 1;
    targetHeight = Math.max(Math.ceil(scrollHeight * heightScale * 1.6), 1100);
  } else {
    // 기타 슬라이드: 기존 로직 유지
    const reflowBoost = widthScale < 1 ? (1 / widthScale) : 1;
    const minHeight = 1040;
    targetHeight = Math.max(Math.ceil(scrollHeight * reflowBoost * 1.35), minHeight);
  }

  const defaultOptions = {
    scale: 2, // 고해상도 (2배)
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: targetWidth,
    height: targetHeight,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: targetWidth,
    windowHeight: targetHeight,
    removeContainer: false, // 컨테이너 제거하지 않음
    onclone: (clonedDoc, element) => {
      // 클론된 문서에서 요소 찾기
      const clonedElement = clonedDoc.querySelector(`[data-slide-id="${element.getAttribute('data-slide-id')}"]`) || 
                           clonedDoc.body.firstElementChild;
      
      if (clonedElement) {
        // 스크롤 위치를 맨 위로 설정
        clonedElement.scrollTop = 0;
        clonedElement.scrollLeft = 0;
        
        // 부모 요소들도 스크롤 위치 조정
        let parent = clonedElement.parentElement;
        while (parent && parent !== clonedDoc.body) {
          parent.scrollTop = 0;
          parent.scrollLeft = 0;
          parent = parent.parentElement;
        }
        
        // 전체 높이를 표시하도록 스타일 조정
        clonedElement.style.overflow = 'visible';
        clonedElement.style.height = 'auto';
        clonedElement.style.maxHeight = 'none';
        // 표준 폭으로 고정
        clonedElement.style.width = `${targetWidth}px`;
        // 세로는 표준 폭에 따른 스케일로 재흐름된 콘텐츠의 최대치 확보
        clonedElement.style.minHeight = `${targetHeight}px`;
        
        // 캡처 시 상단 정렬로 변경 (하단 공백 제거를 위해)
        // flex 컨테이너의 경우 상단 정렬로 변경
        const flexContainers = clonedElement.querySelectorAll('[style*="justify-content"], [style*="justifyContent"]');
        flexContainers.forEach(container => {
          const style = container.getAttribute('style') || '';
          // center, space-between, space-around 등을 flex-start로 변경
          if (style.includes('justify-content: center') || 
              style.includes('justifyContent: center') ||
              style.includes('justify-content:space-between') ||
              style.includes('justifyContent:space-between') ||
              style.includes('justify-content: space-between') ||
              style.includes('justifyContent: space-between')) {
            container.style.justifyContent = 'flex-start';
          }
        });
        
        // 직접 스타일이 있는 요소들도 확인 (클론된 문서의 요소들)
        const allFlexElements = clonedElement.querySelectorAll('*');
        allFlexElements.forEach(el => {
          // 인라인 스타일 확인
          const inlineStyle = el.getAttribute('style') || '';
          const hasFlexDisplay = inlineStyle.includes('display: flex') || 
                                inlineStyle.includes('display:flex') ||
                                inlineStyle.includes('display: inline-flex') ||
                                inlineStyle.includes('display:inline-flex');
          
          // sx prop이나 MUI 스타일은 이미 인라인 스타일로 변환되어 있을 수 있음
          if (hasFlexDisplay || el.style.display === 'flex' || el.style.display === 'inline-flex') {
            // justifyContent가 center나 space-between인 경우 flex-start로 변경
            if (inlineStyle.includes('justify-content: center') ||
                inlineStyle.includes('justifyContent: center') ||
                inlineStyle.includes('justify-content:space-between') ||
                inlineStyle.includes('justifyContent:space-between') ||
                inlineStyle.includes('justify-content: space-between') ||
                inlineStyle.includes('justifyContent: space-between') ||
                inlineStyle.includes('justify-content:space-around') ||
                inlineStyle.includes('justify-content: space-around') ||
                el.style.justifyContent === 'center' ||
                el.style.justifyContent === 'space-between' ||
                el.style.justifyContent === 'space-around') {
              el.style.justifyContent = 'flex-start';
            }
          }
        });
        
        // 모든 자식 요소의 overflow와 높이 확인 및 조정
        const allChildren = clonedElement.querySelectorAll('*');
        allChildren.forEach(child => {
          // overflow 속성 제거하여 전체 영역 표시
          const computedStyle = window.getComputedStyle(child);
          if (computedStyle.overflow === 'hidden' || computedStyle.overflow === 'auto' || computedStyle.overflow === 'scroll') {
            child.style.overflow = 'visible';
          }
          
          // maxHeight 제거
          if (child.style.maxHeight || computedStyle.maxHeight !== 'none') {
            child.style.maxHeight = 'none';
          }
          
          // 스크롤 컨테이너인 경우 높이를 실제 스크롤 높이로 설정
          if (child.scrollHeight > child.clientHeight) {
            child.style.height = 'auto';
            child.style.minHeight = `${child.scrollHeight}px`;
            child.style.overflow = 'visible';
          }
          
          // MuiPaper, MuiBox 등 Material-UI 컨테이너도 확인
          if (child.classList.contains('MuiPaper-root') || 
              child.classList.contains('MuiBox-root') ||
              child.classList.contains('MuiContainer-root')) {
            if (child.scrollHeight > child.clientHeight) {
              child.style.height = 'auto';
              child.style.minHeight = `${child.scrollHeight}px`;
              child.style.overflow = 'visible';
            }
          }
        });
        
        // body와 html도 스크롤 위치 조정 및 overflow 설정
        clonedDoc.body.style.overflow = 'visible';
        clonedDoc.documentElement.style.overflow = 'visible';
        clonedDoc.body.scrollTop = 0;
        clonedDoc.body.scrollLeft = 0;
        clonedDoc.documentElement.scrollTop = 0;
        clonedDoc.documentElement.scrollLeft = 0;
        
        // body와 html의 높이도 조정
        clonedDoc.body.style.height = 'auto';
        clonedDoc.body.style.minHeight = `${targetHeight}px`;
        clonedDoc.documentElement.style.height = 'auto';
        clonedDoc.documentElement.style.minHeight = `${targetHeight}px`;
      }
    },
    ...html2CanvasOptions
  };

  try {
    // 캡쳐에서 제외할 요소들 숨기기
    const excludeElements = element.querySelectorAll('[data-capture-exclude="true"]');
    const originalStyles = [];
    
    excludeElements.forEach((el) => {
      originalStyles.push({
        element: el,
        display: el.style.display
      });
      el.style.display = 'none';
    });
    
    try {
      // Canvas 생성
      const canvas = await html2canvas(element, defaultOptions);
      
      // 하단 공백 자동 제거를 위한 크롭 처리
      const croppedCanvas = await autoCropCanvas(canvas);
      
      // 고정 하단 여백 추가(요청된 경우): 크롭 결과 캔버스 높이를 늘리고 아래를 흰색으로 채움
      let finalCanvas = croppedCanvas;
      if (fixedBottomPaddingPx > 0) {
        const padded = document.createElement('canvas');
        padded.width = croppedCanvas.width;
        padded.height = croppedCanvas.height + fixedBottomPaddingPx;
        const pctx = padded.getContext('2d');
        // 전체를 파스텔톤 핫핑크로 채우고, 위쪽에 원본 이미지를 그려
        // 최종적으로 하단 여백 영역만 핫핑크가 보이도록 함
        pctx.fillStyle = BOTTOM_PADDING_COLOR;
        pctx.fillRect(0, 0, padded.width, padded.height);
        pctx.drawImage(croppedCanvas, 0, 0);
        finalCanvas = padded;
      }
      
      // Canvas를 Blob으로 변환
      const blob = await new Promise((resolve, reject) => {
        finalCanvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('이미지 변환에 실패했습니다.'));
            }
          },
          'image/png',
          0.95 // 품질 (0.95 = 95%, 파일 크기와 품질의 균형)
        );
      });
      
      // 원래 스타일 복원
      originalStyles.forEach(({ element, display }) => {
        element.style.display = display;
      });
      
      return blob;
    } catch (captureError) {
      // 에러 발생 시에도 원래 스타일 복원
      originalStyles.forEach(({ element, display }) => {
        element.style.display = display;
      });
      throw captureError;
    }
  } catch (error) {
    console.error('화면 캡처 오류:', error);
    throw error;
  }
}

/**
 * Blob을 Base64로 변환합니다.
 * @param {Blob} blob - 변환할 Blob
 * @returns {Promise<string>} Base64 문자열
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 이미지 파일명을 생성합니다.
 * @param {string} meetingId - 회의 ID
 * @param {number} slideOrder - 슬라이드 순서
 * @returns {string} 파일명
 */
export function generateImageFilename(meetingId, slideOrder) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${meetingId}_${slideOrder}_${timestamp}.png`;
}

