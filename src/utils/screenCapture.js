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

  const defaultOptions = {
    scale: 2, // 고해상도 (2배)
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: element.scrollWidth || window.innerWidth,
    height: element.scrollHeight || window.innerHeight,
    logging: false,
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

