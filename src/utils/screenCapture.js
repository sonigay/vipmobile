import html2canvas from 'html2canvas';

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

  const defaultOptions = {
    scale: 2, // 고해상도 (2배)
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: scrollWidth,
    height: scrollHeight,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: scrollWidth,
    windowHeight: scrollHeight,
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
        clonedElement.style.minHeight = `${scrollHeight}px`; // 명시적 높이 설정
        clonedElement.style.width = `${scrollWidth}px`; // 명시적 너비 설정
        
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
        clonedDoc.body.style.minHeight = `${scrollHeight}px`;
        clonedDoc.documentElement.style.height = 'auto';
        clonedDoc.documentElement.style.minHeight = `${scrollHeight}px`;
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
      
      // Canvas를 Blob으로 변환
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
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

