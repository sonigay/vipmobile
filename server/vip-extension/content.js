// VIP 필수 확장프로그램
// U+ 온라인 가입 페이지에서 대리점 정보 처리 및 워터마크 표시
//
// 버전 히스토리:
// v1.0.0 - 초기 버전: 대리점 정보 숨김
// v1.1.0 - 워터마크 추가: localStorage에서 업체명 읽어 대각선 워터마크 표시
// v1.1.1 - 버그 수정: 인디케이터 사라짐 수정, U+ 색상 수정, 콘솔 로그 제거
// v1.1.2 - 인디케이터 영구 수정: MutationObserver 밖으로 이동, !important 추가
// v1.2.0 - 워터마크 개선: localStorage → URL 파라미터로 변경 (도메인 간 전달)
// v1.2.1 - 버그 수정: 요소 숨김 로직에서 인디케이터 제외, document.body 대기 추가
// v1.3.0 - 도메인 간 공유: chrome.storage.local 사용, VIP 앱에서 자동 저장, 인디케이터 중앙 정렬
//
// 버전 관리 규칙 (AI 자동 업데이트):
// - 버그 수정: patch 버전 증가 (예: 1.1.0 → 1.1.1)
// - 기능 추가: minor 버전 증가 (예: 1.1.0 → 1.2.0)
// - 큰 변경: major 버전 증가 (예: 1.1.0 → 2.0.0)

(function() {
  'use strict';
  
  // console.log('🔧 VIP 필수 확장프로그램 활성화');

  // 확장 프로그램이 설치되어 있음을 표시 (모든 도메인에서)
  window.VIP_AGENT_PROTECTION_ENABLED = true;
  window.VIP_EXTENSION_VERSION = '1.3.0'; // 버전 정보 노출
  document.documentElement.setAttribute('data-vip-extension', 'installed');
  document.documentElement.setAttribute('data-vip-extension-version', '1.3.0');

  // 메타 태그도 추가 (추가 감지 방법)
  const metaTag = document.createElement('meta');
  metaTag.name = 'vip-extension-installed';
  metaTag.content = 'true';
  if (document.head) {
    document.head.appendChild(metaTag);
  }

  // VIP 앱에서 업체명 저장 (chrome.storage 사용 - 도메인 간 공유)
  if (window.location.href.includes('vipmobile.netlify.app') || 
      window.location.href.includes('localhost:3000')) {
    // VIP 앱에서 로그인 정보 감지 및 저장
    const checkAndSaveCompanyName = () => {
      const loginState = localStorage.getItem('loginState');
      if (loginState) {
        try {
          const parsed = JSON.parse(loginState);
          if (parsed.store && parsed.store.name) {
            chrome.storage.local.set({ 
              vipCompanyName: parsed.store.name 
            }, () => {
              console.log('💾 chrome.storage에 업체명 저장:', parsed.store.name);
            });
          }
        } catch (e) {
          console.error('로그인 정보 파싱 오류:', e);
        }
      }
    };
    
    // 즉시 실행
    checkAndSaveCompanyName();
    
    // localStorage 변경 감지
    window.addEventListener('storage', checkAndSaveCompanyName);
    
    // 주기적 체크 (1초마다)
    setInterval(checkAndSaveCompanyName, 1000);
    
    console.log('✅ VIP 앱: 업체명 자동 저장 활성화');
    return;
  }

  // U+ 페이지에서만 처리 실행
  if (!window.location.href.includes('onsalemobile.uplus.co.kr')) {
    // console.log('✅ VIP 확장프로그램 활성화 완료');
    return;
  }

  // 인디케이터 & 워터마크는 한 번만 생성 (MutationObserver 밖)
  function createIndicatorAndWatermark() {
    // document.body가 없으면 대기
    if (!document.body) {
      console.log('⚠️ document.body 대기 중...');
      setTimeout(createIndicatorAndWatermark, 100);
      return;
    }
    
    // 1. 회사명 인디케이터 표시 (우측 상단)
    if (!document.getElementById('vip-company-indicator')) {
      console.log('🔨 인디케이터 생성 시작');
      const indicator = document.createElement('div');
      indicator.id = 'vip-company-indicator';
      indicator.className = 'vip-permanent-element'; // 보호용 클래스
      indicator.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: white !important;
        color: black !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        border: 2px solid black !important;
        font-size: 12px !important;
        z-index: 999999 !important;
        font-family: Arial, sans-serif !important;
        font-weight: 500 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        visibility: visible !important;
      `;
      indicator.textContent = '(주)브이아이피플러스';
      document.body.appendChild(indicator);
      console.log('📌 회사명 인디케이터 생성 완료, DOM 확인:', document.getElementById('vip-company-indicator'));
    } else {
      console.log('✅ 인디케이터 이미 존재');
    }
    
    // 2. 워터마크 표시 (대각선, 전체 화면)
    if (!document.getElementById('vip-watermark-container')) {
      // chrome.storage에서 업체명 가져오기 (도메인 간 공유)
      chrome.storage.local.get(['vipCompanyName'], (result) => {
        const companyName = result.vipCompanyName;
        
        if (companyName) {
          console.log('✅ chrome.storage에서 업체명 확인:', companyName);
        const watermarkContainer = document.createElement('div');
        watermarkContainer.id = 'vip-watermark-container';
        watermarkContainer.className = 'vip-permanent-element'; // 보호용 클래스
        watermarkContainer.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          pointer-events: none !important;
          z-index: 999998 !important;
          overflow: hidden !important;
        `;
        
        // 대각선으로 여러 개 생성
        for (let i = 0; i < 15; i++) {
          const watermark = document.createElement('div');
          watermark.style.cssText = `
            position: absolute;
            top: ${i * 15}%;
            left: -20%;
            width: 140%;
            text-align: center;
            transform: rotate(-45deg);
            font-size: 48px;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.08);
            font-family: Arial, sans-serif;
            user-select: none;
          `;
          watermark.textContent = companyName;
          watermarkContainer.appendChild(watermark);
        }
        
          document.body.appendChild(watermarkContainer);
          console.log('💧 워터마크 생성:', companyName);
        } else {
          console.log('⚠️ chrome.storage에 업체명 없음');
        }
      });
    }
  }

  // 대리점 정보 숨김 처리
  function hideAgentInfo() {
    let modified = false;
    
    // URL은 그대로 유지 (기능 유지를 위해 변경하지 않음)
    
    // 1. 텍스트 패턴 치환
    const textPatterns = [
      // 팝업 문구 전체 교체 (자연스럽게)
      { 
        pattern: /고객님은 LG유플러스의 대리점인[^를]*를 통해 가입이 됩니다\./gi, 
        replacement: '고객님은 LG유플러스 공식 인증 대리점을 통해 가입이 됩니다.' 
      },
      // 주소, 전화번호 등 제거
      { pattern: /대리점코드\s*\[\d+\]/gi, replacement: '' },
      { pattern: /\([^)]*평택[^)]*\)/gi, replacement: '' },
      { pattern: /070-5038-4437/gi, replacement: '' },
      { pattern: /125-86-06495/gi, replacement: '' },
      { pattern: /\(\s*-\s*\[P\d+\]\)/gi, replacement: '' }  // ( - [P384168]) 제거
    ];
    
    // 2. DOM 텍스트 노드 순회하며 치환
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const nodesToModify = [];
    let node;
    
    while (node = walker.nextNode()) {
      // VIP 영구 요소는 건너뛰기 (인디케이터, 워터마크)
      let currentElement = node.parentElement;
      let skip = false;
      
      while (currentElement) {
        if (currentElement.id === 'vip-company-indicator' || 
            currentElement.id === 'vip-watermark-container' ||
            currentElement.className === 'vip-permanent-element') {
          skip = true;
          break;
        }
        currentElement = currentElement.parentElement;
      }
      
      if (skip) continue;
      
      const originalText = node.textContent;
      let newText = originalText;
      
      // 기본 패턴 적용
      textPatterns.forEach(({ pattern, replacement }) => {
        newText = newText.replace(pattern, replacement);
      });
      
      // 회사명 교체 (VIP 관련 제외)
      if (!originalText.includes('브이아이피') && !originalText.includes('VIP')) {
        // 다른 회사명만 교체
        newText = newText.replace(/주식회사\s+[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        newText = newText.replace(/\(주\)[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        newText = newText.replace(/\(유\)[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        newText = newText.replace(/\(사\)[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
      }
      
      if (newText !== originalText) {
        nodesToModify.push({ node, newText });
      }
    }
    
    nodesToModify.forEach(({ node, newText }) => {
      node.textContent = newText;
      modified = true;
    });
    
    // 3. 특정 요소 숨김 (display: none) - 제거하면 페이지가 깨질 수 있음
    document.querySelectorAll('div, p, span, td, th, li').forEach(element => {
      // VIP 영구 요소는 건너뛰기
      if (element.id === 'vip-company-indicator' || 
          element.id === 'vip-watermark-container' ||
          element.className === 'vip-permanent-element' ||
          element.closest('#vip-company-indicator') ||
          element.closest('#vip-watermark-container')) {
        return; // 건너뛰기
      }
      
      const text = element.textContent || '';
      
      // 대리점 정보만 포함하고 다른 중요 정보가 없는 작은 요소만 숨김
      const hasDealerInfo = 
        text.includes('가입대리점명') ||
        text.includes('판매점명') ||
        (text.includes('브이아이피') && text.length < 100) ||
        (text.includes('평택시 평택로') && text.length < 200) ||
        text.includes('070-5038-4437') ||
        text.includes('125-86-06495') ||
        (text.includes('대리점코드') && text.length < 100);
      
      // 작은 요소만 숨김 (children이 적고, 텍스트가 짧은 경우)
      if (hasDealerInfo && element.children.length < 2 && text.length < 300) {
        element.style.display = 'none';
        // console.log('🙈 요소 숨김:', text.substring(0, 50));
        modified = true;
      }
    });
    
    return modified;
  }

  // 인디케이터 & 워터마크 생성 (한 번만)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createIndicatorAndWatermark();
      hideAgentInfo();
    });
  } else {
    createIndicatorAndWatermark();
    hideAgentInfo();
  }

  // 동적 변경 감지 (AJAX로 콘텐츠가 추가되는 경우 대응)
  const observer = new MutationObserver((mutations) => {
    // 너무 자주 실행되지 않도록 디바운싱
    clearTimeout(observer.debounceTimer);
    observer.debounceTimer = setTimeout(() => {
      hideAgentInfo();
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // console.log('✅ VIP 필수 확장프로그램 실행 중...');

})(); // IIFE 끝
