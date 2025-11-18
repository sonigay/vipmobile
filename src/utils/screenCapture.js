import html2canvas from 'html2canvas';

/**
 * Canvas에서 하단 공백을 자동으로 제거합니다.
 * 실제 콘텐츠 영역만 남기고 하얀 공백을 제거합니다.
 * @param {HTMLCanvasElement} canvas - 원본 Canvas
 * @returns {Promise<HTMLCanvasElement>} 크롭된 Canvas
 */
async function autoCropCanvas(canvas) {
  try {
    // 메모리 부족 방지: 캔버스가 너무 크면 자동 크롭을 건너뛰고 원본 반환
    // 일반적으로 width * height * 4 (RGBA)가 약 268MB 이상이면 메모리 부족 발생
    // 안전 마진을 고려하여 약 200MB (50,000,000 픽셀) 미만일 때만 크롭 수행
    const pixelCount = canvas.width * canvas.height;
    const MAX_PIXELS_FOR_CROP = 50000000; // 50M 픽셀 (약 200MB)
    
    if (pixelCount > MAX_PIXELS_FOR_CROP) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [autoCropCanvas] 캔버스가 너무 커서 자동 크롭 건너뜀: ${canvas.width}x${canvas.height} (${(pixelCount / 1000000).toFixed(2)}M 픽셀)`);
      }
      return canvas; // 원본 반환 (크롭 없음)
    }
    
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
  // 자동 크롭 건너뛰기 옵션
  const skipAutoCrop = options.skipAutoCrop === true;
  // html2canvas에는 전달하지 않을 커스텀 옵션을 제거한 사본을 사용할 것
  const { fixedBottomPaddingPx: _omitFixed, skipAutoCrop: _omitSkipAutoCrop, ...html2CanvasOptions } = options || {};

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
  const BASE_CAPTURE_WIDTH = 1920; // 표준 캡처 폭(px) - 1920px로 변경 (1280px → 1920px, 1.5배)
  const widthScale = BASE_CAPTURE_WIDTH / Math.max(scrollWidth, 1);
  const targetWidth = BASE_CAPTURE_WIDTH;
  // 메인/목차는 헤더 포함 전체를 캡처하므로 충분한 높이 보장
  const slideId = element.getAttribute('data-slide-id') || '';
  const isMain = slideId.includes('main') && !slideId.includes('toc');
  const isToc = slideId.includes('toc');
  const isMainOrToc = isMain || isToc;
  
  // 메인/목차 슬라이드: 고정 가로폭(1920px) 적용 시 세로 재흐름으로 인한 하단 잘림 방지
  // 높이 = scrollHeight × (1/widthScale) × 배율, 최소 높이 보장
  // autoCrop 유지로 과도 여백은 자동 제거
  let targetHeight;
  if (isToc) {
    // 목차 슬라이드는 항목이 매우 많을 수 있으므로 실제 스크롤 가능한 콘텐츠 영역을 찾아 높이 계산
    // 먼저 스크롤을 맨 위로 이동하여 정확한 높이 측정
    element.scrollTop = 0;
    if (element.parentElement) element.parentElement.scrollTop = 0;
    
    // 스크롤 가능한 목차 콘텐츠 영역 찾기 (maxHeight 제한이 있는 Box)
    const scrollableBoxes = Array.from(element.querySelectorAll('.MuiBox-root, div, section'));
    let tocContentArea = null;
    let maxScrollHeight = 0;
    
    for (const box of scrollableBoxes) {
      const styles = window.getComputedStyle(box);
      const hasMaxHeight = styles.maxHeight && styles.maxHeight !== 'none' && styles.maxHeight !== 'auto';
      const hasOverflowY = styles.overflowY === 'auto' || styles.overflowY === 'scroll';
      
      if (hasMaxHeight || hasOverflowY) {
        const boxScrollHeight = box.scrollHeight || 0;
        if (boxScrollHeight > maxScrollHeight) {
          maxScrollHeight = boxScrollHeight;
          tocContentArea = box;
        }
      }
    }
    
    // 모든 자식 요소의 실제 높이 계산 (포함된 모든 콘텐츠)
    let totalContentHeight = scrollHeight;
    const allChildren = element.querySelectorAll('*');
    allChildren.forEach(child => {
      const childRect = child.getBoundingClientRect();
      const childBottom = childRect.top + (child.scrollHeight || childRect.height);
      totalContentHeight = Math.max(totalContentHeight, childBottom - element.getBoundingClientRect().top);
    });
    
    // 스크롤 가능한 영역이 있으면 그 높이 사용, 없으면 전체 콘텐츠 높이 사용
    const actualTocHeight = tocContentArea ? 
      Math.max(tocContentArea.scrollHeight, maxScrollHeight) : 
      Math.max(totalContentHeight, scrollHeight, element.scrollHeight);
    
    // 계산된 높이와 고정 최소 높이 중 큰 값 사용
    // 목차는 실제 콘텐츠가 매우 길 수 있으므로 실제 높이의 1.8배 + 여유공간
    // 1920px로 증가하면서 파일 크기 제한(25MB)을 고려하여 높이 계산 최적화
    const heightScale = widthScale < 1 ? (1 / widthScale) : 1;
    const reflowMultiplier = 1.8; // 목차 재흐름 배율 (2.0 → 1.8, 25MB 제한을 위해 더 감소)
    const calculatedHeight = Math.ceil(actualTocHeight * heightScale * reflowMultiplier) + 800; // 여유공간 800px 추가 (1000 → 800, 파일 크기 절감)
    
    // 1920px 기준 파일 크기 제한 고려: 최대 높이 7000px로 제한 (3840 × 7000 × 4 ≈ 107MB 압축 전 → 약 20-22MB 압축 후, 안전한 여유)
    const maxAllowedHeight = 7000; // 1920px 대응: 8000px → 7000px로 감소 (25MB 제한 안전하게 준수)
    const minHeightFromContent = actualTocHeight + 1200; // 실제 높이 + 1200px (1500 → 1200, 파일 크기 절감)
    targetHeight = Math.min(
      Math.max(calculatedHeight, minHeightFromContent, 5000), // 최소 5000px (6000 → 5000, 파일 크기 절감)
      maxAllowedHeight // 최대 7000px로 제한
    );
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📏 [screenCapture] 목차 슬라이드 높이 계산:`, {
        tocContentArea: tocContentArea ? 'found' : 'not found',
        actualTocHeight,
        scrollHeight,
        totalContentHeight,
        calculatedHeight,
        targetHeight,
        heightScale,
        maxScrollHeight
      });
    }
  } else if (isMain || slideId.includes('ending')) {
    // 메인/엔딩 슬라이드는 실제 콘텐츠 높이를 정확히 측정
    // 먼저 스크롤을 맨 위로 이동하여 정확한 높이 측정
    element.scrollTop = 0;
    if (element.parentElement) element.parentElement.scrollTop = 0;
    
    // 모든 자식 요소의 실제 높이 계산 (포함된 모든 콘텐츠)
    let totalContentHeight = scrollHeight;
    const allChildren = element.querySelectorAll('*');
    allChildren.forEach(child => {
      const childRect = child.getBoundingClientRect();
      const childBottom = childRect.top + (child.scrollHeight || childRect.height);
      totalContentHeight = Math.max(totalContentHeight, childBottom - element.getBoundingClientRect().top);
    });
    
    // 실제 콘텐츠 높이 사용 (더 정확한 측정)
    // 여러 방법으로 높이 측정하고 가장 큰 값 사용
    const measuredHeights = [
      totalContentHeight,
      scrollHeight,
      element.scrollHeight,
      element.offsetHeight,
      element.getBoundingClientRect().height
    ];
    
    // 자식 요소 중 가장 아래에 있는 요소의 위치 측정
    let maxChildBottom = 0;
    allChildren.forEach(child => {
      const rect = child.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const relativeBottom = rect.bottom - elementRect.top + (child.scrollHeight || 0);
      maxChildBottom = Math.max(maxChildBottom, relativeBottom);
    });
    measuredHeights.push(maxChildBottom);
    
    const actualHeight = Math.max(...measuredHeights.filter(h => h > 0));
    
    // 계산된 높이와 고정 최소 높이 중 큰 값 사용
    // 고정 가로폭 적용 시 세로 재흐름을 고려한 높이 계산
    // 1920px 대응: 파일 크기 제한(25MB)을 고려하여 높이 계산 최적화
    const heightScale = widthScale < 1 ? (1 / widthScale) : 1;
    const reflowMultiplier = 2.0; // 재흐름 고려 배율 (1.5 → 2.0)
    const calculatedHeight = Math.ceil(actualHeight * heightScale * reflowMultiplier) + 1000; // 여유공간 1000px 추가 (1500 → 1000, 1920px 대응으로 감소)
    
    // 1920px 기준 파일 크기 제한 고려: 최대 높이 8000px로 제한 (3840 × 8000 × 4 ≈ 122MB 압축 전 → 약 25MB 압축 후)
    const maxAllowedHeight = 8000; // 1920px 대응: 최대 높이 8000px로 제한 (25MB 제한 준수)
    const minHeightFromContent = actualHeight + 1500; // 실제 높이 + 1500px (2000 → 1500)
    targetHeight = Math.min(
      Math.max(calculatedHeight, minHeightFromContent, 5000), // 최소 5000px (6000 → 5000, 1920px 대응으로 감소)
      maxAllowedHeight // 최대 8000px로 제한
    );
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📏 [screenCapture] ${isMain ? '메인' : '엔딩'} 슬라이드 높이 계산:`, {
        actualHeight,
        scrollHeight,
        totalContentHeight,
        calculatedHeight,
        targetHeight,
        heightScale
      });
    }
  } else {
    // 기타 슬라이드: 기존 로직 유지하되 최대 높이 제한 추가
    // 1920px 대응: 파일 크기 제한(25MB)을 고려하여 높이 계산 최적화
    const reflowBoost = widthScale < 1 ? (1 / widthScale) : 1;
    const minHeight = 1040;
    const calculatedHeight = Math.ceil(scrollHeight * reflowBoost * 1.35);
    
    // 1920px 기준 파일 크기 제한 고려: 최대 높이 8000px로 제한
    const maxAllowedHeight = 8000; // 1920px 대응: 최대 높이 8000px로 제한 (25MB 제한 준수)
    targetHeight = Math.min(
      Math.max(calculatedHeight, minHeight),
      maxAllowedHeight // 최대 8000px로 제한
    );
    
    if (process.env.NODE_ENV === 'development' && targetHeight >= maxAllowedHeight) {
      console.warn(`⚠️ [screenCapture] 기타 슬라이드 높이가 최대 제한에 도달: ${targetHeight}px (계산된 높이: ${calculatedHeight}px)`);
    }
  }

      // 메인/목차/엔딩 슬라이드의 경우: skipAutoCrop이 true이면 타일 캡처 로직 건너뛰기
  const shouldUseTiledCapture = !skipAutoCrop && (isToc || isMain || slideId.includes('ending'));
  
  const defaultOptions = {
    scale: 2, // 고해상도 (2배)
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: targetWidth,
    height: shouldUseTiledCapture ? undefined : targetHeight, // 타일 캡처 시 height 제거
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: targetWidth,
    windowHeight: shouldUseTiledCapture ? undefined : targetHeight, // 타일 캡처 시 windowHeight 제거
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
        
        // 클론된 문서에서 slideId 다시 추출 (더 안전함)
        const clonedSlideId = clonedElement.getAttribute('data-slide-id') || '';
        const clonedIsToc = clonedSlideId.includes('toc');
        const clonedIsMain = clonedSlideId.includes('main') && !clonedSlideId.includes('toc');
        const clonedIsEnding = clonedSlideId.includes('ending');
        const isSpecialSlide = clonedIsToc || clonedIsMain || clonedIsEnding;
        
        // 목차/메인/엔딩 슬라이드인 경우: 모든 스크롤 제약을 제거하여 전체 콘텐츠 표시
        if (isSpecialSlide) {
          // 1단계: 클론된 문서의 모든 요소를 순회하여 스크롤 제약 제거 (더 직접적이고 확실한 방법)
          const allClonedElements = clonedElement.querySelectorAll('*');
          allClonedElements.forEach(clonedEl => {
            if (!clonedEl || !clonedEl.style) return;
            
            // 인라인 스타일에서 직접 확인
            const inlineMaxHeight = clonedEl.style.maxHeight || clonedEl.style.getPropertyValue('max-height');
            const inlineOverflow = clonedEl.style.overflow || clonedEl.style.getPropertyValue('overflow');
            const inlineOverflowY = clonedEl.style.overflowY || clonedEl.style.getPropertyValue('overflow-y');
            const inlineHeight = clonedEl.style.height || clonedEl.style.getPropertyValue('height');
            
            // maxHeight 제거 (vh, %, 픽셀 값 모두)
            if (inlineMaxHeight && inlineMaxHeight !== 'none' && inlineMaxHeight !== 'auto') {
              clonedEl.style.setProperty('max-height', 'none', 'important');
            }
            
            // overflow 제거
            if (inlineOverflow === 'auto' || inlineOverflow === 'scroll' || inlineOverflow === 'hidden') {
              clonedEl.style.setProperty('overflow', 'visible', 'important');
            }
            if (inlineOverflowY === 'auto' || inlineOverflowY === 'scroll' || inlineOverflowY === 'hidden') {
              clonedEl.style.setProperty('overflow-y', 'visible', 'important');
            }
            if (clonedEl.style.getPropertyValue('overflow-x') === 'auto' || 
                clonedEl.style.getPropertyValue('overflow-x') === 'scroll' || 
                clonedEl.style.getPropertyValue('overflow-x') === 'hidden') {
              clonedEl.style.setProperty('overflow-x', 'visible', 'important');
            }
            
            // height가 vh나 %로 제한된 경우 제거
            if (inlineHeight && (inlineHeight.includes('vh') || inlineHeight.includes('%'))) {
              clonedEl.style.setProperty('height', 'auto', 'important');
            }
            
            // 스크롤 위치 초기화
            if (clonedEl.scrollTop !== undefined) {
              clonedEl.scrollTop = 0;
            }
            if (clonedEl.scrollLeft !== undefined) {
              clonedEl.scrollLeft = 0;
            }
          });
          
          // 2단계: 원본 요소에서 computed styles 확인하여 클론에 적용 (원본 스타일도 확인)
          const originalElements = Array.from(element.querySelectorAll('*'));
          originalElements.forEach((originalEl, index) => {
            try {
              const computedStyles = window.getComputedStyle(originalEl);
              const hasMaxHeight = computedStyles.maxHeight && 
                                   computedStyles.maxHeight !== 'none' && 
                                   computedStyles.maxHeight !== 'auto';
              const hasOverflow = computedStyles.overflow === 'auto' || 
                                 computedStyles.overflow === 'scroll' ||
                                 computedStyles.overflow === 'hidden';
              const hasOverflowY = computedStyles.overflowY === 'auto' || 
                                  computedStyles.overflowY === 'scroll' ||
                                  computedStyles.overflowY === 'hidden';
              const hasVhHeight = computedStyles.height && 
                                 (computedStyles.height.includes('vh') || 
                                  computedStyles.height.includes('%'));
              
              if (hasMaxHeight || hasOverflow || hasOverflowY || hasVhHeight) {
                // 클론된 문서에서 같은 위치의 요소 찾기 (인덱스 기반)
                const clonedElements = Array.from(clonedElement.querySelectorAll('*'));
                const clonedEl = clonedElements[index];
                
                if (clonedEl && clonedEl !== clonedElement) {
                  if (hasMaxHeight) {
                    clonedEl.style.setProperty('max-height', 'none', 'important');
                  }
                  if (hasOverflow) {
                    clonedEl.style.setProperty('overflow', 'visible', 'important');
                  }
                  if (hasOverflowY) {
                    clonedEl.style.setProperty('overflow-y', 'visible', 'important');
                  }
                  if (hasVhHeight) {
                    clonedEl.style.setProperty('height', 'auto', 'important');
                  }
                }
              }
            } catch (e) {
              // 요소가 DOM에서 제거되었을 수 있으므로 무시
            }
          });
          
          // 3단계: 메인 컨테이너 자체도 확실하게 처리
          clonedElement.style.setProperty('overflow', 'visible', 'important');
          clonedElement.style.setProperty('overflow-y', 'visible', 'important');
          clonedElement.style.setProperty('overflow-x', 'visible', 'important');
          clonedElement.style.setProperty('max-height', 'none', 'important');
          
          // 4단계: 스크롤 가능한 컨테이너를 찾아서 높이를 실제 콘텐츠 높이로 확장
          const scrollableContainers = clonedElement.querySelectorAll('*');
          scrollableContainers.forEach(container => {
            if (container.scrollHeight && container.scrollHeight > container.clientHeight) {
              // 스크롤 가능한 컨테이너는 실제 스크롤 높이만큼 확장
              container.style.setProperty('height', `${container.scrollHeight}px`, 'important');
              container.style.setProperty('max-height', 'none', 'important');
              container.style.setProperty('overflow', 'visible', 'important');
            }
          });
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
        
        // body와 html의 높이도 조정 (더 확실하게)
        clonedDoc.body.style.height = `${targetHeight}px`;
        clonedDoc.body.style.minHeight = `${targetHeight}px`;
        clonedDoc.body.style.maxHeight = 'none';
        clonedDoc.body.style.overflow = 'visible';
        clonedDoc.documentElement.style.height = `${targetHeight}px`;
        clonedDoc.documentElement.style.minHeight = `${targetHeight}px`;
        clonedDoc.documentElement.style.maxHeight = 'none';
        clonedDoc.documentElement.style.overflow = 'visible';
        
        // 클론된 요소 자체의 높이도 명시적으로 설정
        clonedElement.style.height = `${targetHeight}px`;
        clonedElement.style.minHeight = `${targetHeight}px`;
        clonedElement.style.maxHeight = 'none';
        
        // 클론된 요소의 모든 부모 요소도 높이 확장 (최대 3단계)
        let clonedParent = clonedElement.parentElement;
        let parentDepth = 0;
        while (clonedParent && clonedParent !== clonedDoc.body && parentDepth < 3) {
          clonedParent.style.maxHeight = 'none';
          clonedParent.style.overflow = 'visible';
          clonedParent.style.height = `${targetHeight}px`;
          clonedParent = clonedParent.parentElement;
          parentDepth++;
        }
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
      let canvas;
      
      // 메인/목차/엔딩 슬라이드의 경우: 요소를 강제로 확장하여 전체 콘텐츠 캡처
      if (shouldUseTiledCapture) {
        // 요소의 실제 scrollHeight를 정확히 측정
        await new Promise(r => setTimeout(r, 200)); // 스타일 변경 후 렌더링 대기
        
        // 모든 자식 요소의 최하단 위치 측정
        let maxBottom = 0;
        const elementRect = element.getBoundingClientRect();
        const allChildren = element.querySelectorAll('*');
        
        allChildren.forEach(child => {
          try {
            const childRect = child.getBoundingClientRect();
            const relativeBottom = childRect.bottom - elementRect.top;
            maxBottom = Math.max(maxBottom, relativeBottom);
            
            // scrollHeight가 있으면 그것도 고려
            if (child.scrollHeight && child.scrollHeight > child.clientHeight) {
              const scrollHeightDiff = child.scrollHeight - child.clientHeight;
              maxBottom = Math.max(maxBottom, relativeBottom + scrollHeightDiff);
            }
          } catch (e) {
            // 무시하고 계속
          }
        });
        
        const actualScrollHeight = Math.max(
          element.scrollHeight,
          element.offsetHeight,
          element.getBoundingClientRect().height,
          maxBottom,
          targetHeight
        );
        
        // 요소를 실제로 확장하여 모든 콘텐츠가 보이도록
        const originalHeight = element.style.height;
        const originalMinHeight = element.style.minHeight;
        const originalMaxHeight = element.style.maxHeight;
        const originalOverflow = element.style.overflow;
        
        // 요소의 높이를 실제 scrollHeight로 강제 설정
        element.style.setProperty('height', `${actualScrollHeight}px`, 'important');
        element.style.setProperty('min-height', `${actualScrollHeight}px`, 'important');
        element.style.setProperty('max-height', 'none', 'important');
        element.style.setProperty('overflow', 'visible', 'important');
        
        // 부모 요소도 확인
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 3) {
          const parentComputed = window.getComputedStyle(parent);
          if (parentComputed.maxHeight && parentComputed.maxHeight !== 'none' && parentComputed.maxHeight !== 'auto') {
            parent.style.setProperty('max-height', 'none', 'important');
          }
          if (parentComputed.overflow === 'auto' || parentComputed.overflow === 'scroll' || parentComputed.overflow === 'hidden') {
            parent.style.setProperty('overflow', 'visible', 'important');
          }
          parent = parent.parentElement;
          depth++;
        }
        
        // 확장 후 렌더링 대기
        await new Promise(r => setTimeout(r, 500));
        
        // 최종 높이 재확인
        const finalScrollHeight = Math.max(
          element.scrollHeight,
          element.offsetHeight,
          actualScrollHeight
        );
        
        if (finalScrollHeight > actualScrollHeight) {
          element.style.setProperty('height', `${finalScrollHeight}px`, 'important');
          element.style.setProperty('min-height', `${finalScrollHeight}px`, 'important');
          await new Promise(r => setTimeout(r, 300));
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📏 [screenCapture] 요소 확장: ${actualScrollHeight}px → ${finalScrollHeight}px`);
        }
        
        // html2canvas 옵션에서 height 제한 제거
        const expandedOptions = {
          ...defaultOptions,
          // height와 windowHeight를 제거하여 html2canvas가 확장된 요소의 전체 높이를 캡처하도록
        };
        delete expandedOptions.height;
        delete expandedOptions.windowHeight;
        
        // 확장된 요소 캡처
        canvas = await html2canvas(element, expandedOptions);
        
        // 원본 스타일 복원
        if (originalHeight) {
          element.style.height = originalHeight;
        } else {
          element.style.removeProperty('height');
        }
        if (originalMinHeight) {
          element.style.minHeight = originalMinHeight;
        } else {
          element.style.removeProperty('min-height');
        }
        if (originalMaxHeight) {
          element.style.maxHeight = originalMaxHeight;
        } else {
          element.style.removeProperty('max-height');
        }
        if (originalOverflow) {
          element.style.overflow = originalOverflow;
        } else {
          element.style.removeProperty('overflow');
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ [screenCapture] 확장 캡처 완료: ${canvas.height}px`);
        }
      } else {
        // 일반 슬라이드: 기존 방식 사용
        canvas = await html2canvas(element, defaultOptions);
      }
      
      // 하단 공백 자동 제거를 위한 크롭 처리 (skipAutoCrop이 false일 때만)
      let finalCanvas = canvas;
      if (!skipAutoCrop) {
        finalCanvas = await autoCropCanvas(canvas);
      }
      
      // 핑크바 제거: fixedBottomPaddingPx 옵션은 하위 호환성을 위해 유지하지만 무시됨
      
      // Canvas를 Blob으로 변환
      // 1920px 대응: 큰 이미지는 압축 품질을 낮춰서 파일 크기 제한(25MB) 준수
      const isToc = slideId.includes('toc');
      const isMain = slideId.includes('main') && !slideId.includes('toc');
      const isEnding = slideId.includes('ending');
      const isLargeSlide = isToc || isMain || isEnding; // 메인/목차/엔딩은 큰 슬라이드
      
      // 큰 슬라이드나 높이가 큰 슬라이드는 압축 품질을 낮춤
      const SCALE = 2; // html2canvas scale 파라미터 (픽셀 밀도 배율)
      const estimatedHeight = finalCanvas.height / SCALE; // 원본 높이 추정
      const isVeryTall = estimatedHeight > 6000; // 6000px 이상이면 매우 긴 슬라이드
      // 목차 슬라이드는 파일 크기가 크므로 더 낮은 품질 사용 (0.85)
      const quality = isToc ? 0.85 : ((isLargeSlide || isVeryTall) ? 0.90 : 0.95); // 목차: 85%, 큰 슬라이드: 90%, 기타: 95%
      
      if (process.env.NODE_ENV === 'development') {
        if (quality === 0.85) {
          console.log(`📦 [screenCapture] 압축 품질 85% 적용: 목차 슬라이드 (높이: ${estimatedHeight.toFixed(0)}px, 파일 크기 최적화)`);
        } else if (quality === 0.90) {
          console.log(`📦 [screenCapture] 압축 품질 90% 적용: ${isLargeSlide ? '큰 슬라이드' : '긴 슬라이드'} (높이: ${estimatedHeight.toFixed(0)}px)`);
        }
      }
      
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
          quality // 품질 (0.90-0.95, 큰 슬라이드는 0.90으로 파일 크기 절감)
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

