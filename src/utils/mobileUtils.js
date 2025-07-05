// 모바일 UI 최적화 유틸리티

// 디바이스 타입 감지
export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop'
};

// 화면 크기 브레이크포인트
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1200
};

// 디바이스 타입 감지 함수
export const getDeviceType = () => {
  const width = window.innerWidth;
  
  if (width < BREAKPOINTS.MOBILE) {
    return DEVICE_TYPES.MOBILE;
  } else if (width < BREAKPOINTS.TABLET) {
    return DEVICE_TYPES.TABLET;
  } else {
    return DEVICE_TYPES.DESKTOP;
  }
};

// 모바일 환경 확인
export const isMobile = () => {
  return getDeviceType() === DEVICE_TYPES.MOBILE;
};

// 태블릿 환경 확인
export const isTablet = () => {
  return getDeviceType() === DEVICE_TYPES.TABLET;
};

// 데스크톱 환경 확인
export const isDesktop = () => {
  return getDeviceType() === DEVICE_TYPES.DESKTOP;
};

// 터치 디바이스 확인
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// 화면 방향 감지
export const getScreenOrientation = () => {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
};

// 모바일 브라우저 확인
export const isMobileBrowser = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

// 모바일 최적화 설정 클래스
class MobileOptimizationManager {
  constructor() {
    this.deviceType = getDeviceType();
    this.isTouch = isTouchDevice();
    this.orientation = getScreenOrientation();
    this.isMobileBrowser = isMobileBrowser();
    
    this.setupEventListeners();
  }

  // 이벤트 리스너 설정
  setupEventListeners() {
    // 화면 크기 변경 감지
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // 화면 방향 변경 감지
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    
    // 터치 이벤트 최적화
    if (this.isTouch) {
      this.setupTouchOptimizations();
    }
  }

  // 화면 크기 변경 처리
  handleResize() {
    const newDeviceType = getDeviceType();
    if (newDeviceType !== this.deviceType) {
      this.deviceType = newDeviceType;
      this.onDeviceTypeChange(newDeviceType);
    }
  }

  // 화면 방향 변경 처리
  handleOrientationChange() {
    const newOrientation = getScreenOrientation();
    if (newOrientation !== this.orientation) {
      this.orientation = newOrientation;
      this.onOrientationChange(newOrientation);
    }
  }

  // 터치 최적화 설정
  setupTouchOptimizations() {
    // 터치 스크롤 최적화
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  // 터치 시작 처리
  handleTouchStart(event) {
    // 터치 시작 시 스크롤 최적화
    if (event.target.closest('.scrollable')) {
      event.target.style.overflow = 'auto';
    }
  }

  // 터치 이동 처리
  handleTouchMove(event) {
    // 터치 이동 시 스크롤 성능 최적화
    if (event.target.closest('.scrollable')) {
      event.preventDefault();
    }
  }

  // 터치 종료 처리
  handleTouchEnd(event) {
    // 터치 종료 시 정리
    if (event.target.closest('.scrollable')) {
      event.target.style.overflow = '';
    }
  }

  // 디바이스 타입 변경 콜백
  onDeviceTypeChange(newDeviceType) {
    // 디바이스 타입 변경 시 필요한 조치
    console.log('디바이스 타입 변경:', newDeviceType);
    
    // 모바일로 변경 시 사이드바 닫기
    if (newDeviceType === DEVICE_TYPES.MOBILE) {
      this.closeSidebars();
    }
  }

  // 화면 방향 변경 콜백
  onOrientationChange(newOrientation) {
    console.log('화면 방향 변경:', newOrientation);
    
    // 방향 변경 시 레이아웃 조정
    this.adjustLayoutForOrientation(newOrientation);
  }

  // 사이드바 닫기
  closeSidebars() {
    // 모바일에서 사이드바 자동 닫기
    const sidebars = document.querySelectorAll('.sidebar, .drawer');
    sidebars.forEach(sidebar => {
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }

  // 방향에 따른 레이아웃 조정
  adjustLayoutForOrientation(orientation) {
    if (orientation === 'portrait') {
      // 세로 모드에서 레이아웃 조정
      document.body.classList.add('portrait-mode');
      document.body.classList.remove('landscape-mode');
    } else {
      // 가로 모드에서 레이아웃 조정
      document.body.classList.add('landscape-mode');
      document.body.classList.remove('portrait-mode');
    }
  }

  // 모바일 최적화 스타일 적용
  applyMobileOptimizations() {
    if (this.deviceType === DEVICE_TYPES.MOBILE) {
      // 모바일 전용 스타일 적용
      document.body.classList.add('mobile-optimized');
      
      // 터치 영역 확대
      this.expandTouchTargets();
      
      // 스크롤 최적화
      this.optimizeScrolling();
    } else {
      document.body.classList.remove('mobile-optimized');
    }
  }

  // 터치 영역 확대
  expandTouchTargets() {
    const touchTargets = document.querySelectorAll('button, a, input, select');
    touchTargets.forEach(target => {
      const rect = target.getBoundingClientRect();
      if (rect.height < 44 || rect.width < 44) {
        target.style.minHeight = '44px';
        target.style.minWidth = '44px';
        target.classList.add('touch-target');
      }
    });
  }

  // 스크롤 최적화
  optimizeScrolling() {
    // 부드러운 스크롤 적용
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // 스크롤 성능 최적화
    const scrollableElements = document.querySelectorAll('.scrollable, .overflow-auto');
    scrollableElements.forEach(element => {
      element.style.webkitOverflowScrolling = 'touch';
      element.style.overflowScrolling = 'touch';
    });
  }

  // 모바일 네비게이션 최적화
  optimizeMobileNavigation() {
    if (this.deviceType === DEVICE_TYPES.MOBILE) {
      // 하단 네비게이션 바 추가
      this.addBottomNavigation();
      
      // 스와이프 제스처 추가
      this.addSwipeGestures();
    }
  }

  // 하단 네비게이션 바 추가
  addBottomNavigation() {
    const existingNav = document.querySelector('.bottom-navigation');
    if (!existingNav) {
      const bottomNav = document.createElement('div');
      bottomNav.className = 'bottom-navigation';
      bottomNav.innerHTML = `
        <div class="nav-item" data-section="map">
          <i class="material-icons">map</i>
          <span>지도</span>
        </div>
        <div class="nav-item" data-section="inventory">
          <i class="material-icons">inventory</i>
          <span>재고</span>
        </div>
        <div class="nav-item" data-section="history">
          <i class="material-icons">history</i>
          <span>이력</span>
        </div>
        <div class="nav-item" data-section="settings">
          <i class="material-icons">settings</i>
          <span>설정</span>
        </div>
      `;
      
      document.body.appendChild(bottomNav);
      
      // 네비게이션 이벤트 리스너 추가
      bottomNav.addEventListener('click', this.handleBottomNavigation.bind(this));
    }
  }

  // 하단 네비게이션 클릭 처리
  handleBottomNavigation(event) {
    const navItem = event.target.closest('.nav-item');
    if (navItem) {
      const section = navItem.dataset.section;
      this.navigateToSection(section);
    }
  }

  // 섹션 네비게이션
  navigateToSection(section) {
    // 섹션별 네비게이션 로직
    switch (section) {
      case 'map':
        // 지도 섹션으로 이동
        break;
      case 'inventory':
        // 재고 섹션으로 이동
        break;
      case 'history':
        // 이력 섹션으로 이동
        break;
      case 'settings':
        // 설정 섹션으로 이동
        break;
    }
  }

  // 스와이프 제스처 추가
  addSwipeGestures() {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // 수평 스와이프 감지
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          this.handleSwipeRight();
        } else {
          this.handleSwipeLeft();
        }
      }
      
      // 수직 스와이프 감지
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
        if (deltaY > 0) {
          this.handleSwipeDown();
        } else {
          this.handleSwipeUp();
        }
      }
    }, { passive: true });
  }

  // 스와이프 제스처 처리
  handleSwipeRight() {
    // 오른쪽 스와이프 - 이전 페이지 또는 사이드바 열기
    console.log('오른쪽 스와이프');
  }

  handleSwipeLeft() {
    // 왼쪽 스와이프 - 다음 페이지 또는 사이드바 닫기
    console.log('왼쪽 스와이프');
  }

  handleSwipeUp() {
    // 위쪽 스와이프 - 새로고침 또는 위로 스크롤
    console.log('위쪽 스와이프');
  }

  handleSwipeDown() {
    // 아래쪽 스와이프 - 새로고침 또는 아래로 스크롤
    console.log('아래쪽 스와이프');
  }

  // 성능 최적화
  optimizePerformance() {
    if (this.deviceType === DEVICE_TYPES.MOBILE) {
      // 이미지 지연 로딩
      this.setupLazyLoading();
      
      // 애니메이션 최적화
      this.optimizeAnimations();
      
      // 메모리 사용량 최적화
      this.optimizeMemoryUsage();
    }
  }

  // 지연 로딩 설정
  setupLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  // 애니메이션 최적화
  optimizeAnimations() {
    // 하드웨어 가속 사용
    const animatedElements = document.querySelectorAll('.animated, .transition');
    animatedElements.forEach(element => {
      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'transform';
    });
  }

  // 메모리 사용량 최적화
  optimizeMemoryUsage() {
    // 불필요한 이벤트 리스너 정리
    this.cleanupEventListeners();
    
    // 캐시 크기 제한
    this.limitCacheSize();
  }

  // 이벤트 리스너 정리
  cleanupEventListeners() {
    // 주기적으로 불필요한 이벤트 리스너 정리
    setInterval(() => {
      // 메모리 누수 방지
      if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          console.warn('메모리 사용량이 높습니다. 정리를 시작합니다.');
          // 가비지 컬렉션 유도
          if (window.gc) {
            window.gc();
          }
        }
      }
    }, 30000); // 30초마다 체크
  }

  // 캐시 크기 제한
  limitCacheSize() {
    // 로컬 스토리지 크기 제한
    const maxCacheSize = 50 * 1024 * 1024; // 50MB
    let currentSize = 0;
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        currentSize += localStorage[key].length * 2; // UTF-16 문자당 2바이트
      }
    }
    
    if (currentSize > maxCacheSize) {
      // 오래된 캐시 데이터 삭제
      this.cleanupOldCache();
    }
  }

  // 오래된 캐시 정리
  cleanupOldCache() {
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
    const sortedKeys = cacheKeys.sort((a, b) => {
      const timeA = localStorage.getItem(`${a}_timestamp`) || 0;
      const timeB = localStorage.getItem(`${b}_timestamp`) || 0;
      return timeA - timeB;
    });
    
    // 가장 오래된 캐시부터 삭제
    const keysToDelete = sortedKeys.slice(0, Math.floor(sortedKeys.length / 2));
    keysToDelete.forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_timestamp`);
    });
  }

  // 현재 상태 가져오기
  getCurrentState() {
    return {
      deviceType: this.deviceType,
      isTouch: this.isTouch,
      orientation: this.orientation,
      isMobileBrowser: this.isMobileBrowser,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    };
  }

  // 정리
  destroy() {
    // 이벤트 리스너 제거
    window.removeEventListener('resize', this.handleResize.bind(this));
    window.removeEventListener('orientationchange', this.handleOrientationChange.bind(this));
    
    // 터치 이벤트 리스너 제거
    if (this.isTouch) {
      document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      document.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    }
  }
}

// 싱글톤 인스턴스 생성
export const mobileOptimizationManager = new MobileOptimizationManager();

// 편의 함수들
export const applyMobileOptimizations = () => {
  mobileOptimizationManager.applyMobileOptimizations();
};

export const optimizeMobileNavigation = () => {
  mobileOptimizationManager.optimizeMobileNavigation();
};

export const optimizePerformance = () => {
  mobileOptimizationManager.optimizePerformance();
};

export const getCurrentDeviceState = () => {
  return mobileOptimizationManager.getCurrentState();
}; 