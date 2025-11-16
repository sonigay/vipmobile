import html2canvas from 'html2canvas';

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
    
    // 배경색 (흰색) 임계값 설정
    const backgroundColorThreshold = 250; // RGB 값이 모두 250 이상이면 배경으로 간주
    const alphaThreshold = 10; // 알파값이 10 이하면 투명으로 간주
    
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    
    // 실제 콘텐츠 영역 찾기 (상단, 좌측, 우측, 하단 모두)
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 배경이 아닌 픽셀인지 확인
        const isBackground = 
          (r >= backgroundColorThreshold && 
           g >= backgroundColorThreshold && 
           b >= backgroundColorThreshold) ||
          a < alphaThreshold;
        
        if (!isBackground) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // 콘텐츠가 없는 경우 원본 반환
    if (minX >= maxX || minY >= maxY) {
      return canvas;
    }
    
    // 여유 공간 추가 (상하좌우 10px씩)
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // 크롭된 Canvas 생성
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');
    
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
  const targetHeight = Math.max(Math.ceil(scrollHeight * widthScale), 720); // 최소 높이 안전값

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
    ...options
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
      
      // Canvas를 Blob으로 변환
      const blob = await new Promise((resolve, reject) => {
        croppedCanvas.toBlob(
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

