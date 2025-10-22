// VIP 필수 확장프로그램
// U+ 온라인 가입 페이지에서 대리점 정보 처리 및 워터마크 표시
//
// 버전 히스토리:
// v1.0.0 - 초기 버전: 대리점 정보 숨김
// v1.1.0 - 워터마크 추가: localStorage에서 업체명 읽어 대각선 워터마크 표시
// v1.1.1 - 버그 수정: 인디케이터 사라짐 수정, U+ 색상 수정, 콘솔 로그 제거
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
  window.VIP_EXTENSION_VERSION = '1.1.1'; // 버전 정보 노출
  document.documentElement.setAttribute('data-vip-extension', 'installed');
  document.documentElement.setAttribute('data-vip-extension-version', '1.1.1');

  // 메타 태그도 추가 (추가 감지 방법)
  const metaTag = document.createElement('meta');
  metaTag.name = 'vip-extension-installed';
  metaTag.content = 'true';
  if (document.head) {
    document.head.appendChild(metaTag);
  }

  // U+ 페이지에서만 처리 실행
  if (!window.location.href.includes('onsalemobile.uplus.co.kr')) {
    // console.log('✅ VIP 확장프로그램 활성화 완료');
    return;
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
      // 인디케이터 내부 텍스트는 건너뛰기
      const parentElement = node.parentElement;
      if (parentElement && parentElement.id === 'vip-company-indicator') {
        continue;
      }
      
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
    
    // 4. 회사명 인디케이터 표시 (우측 상단)
    if (!document.getElementById('vip-company-indicator')) {
      const indicator = document.createElement('div');
      indicator.id = 'vip-company-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        color: black;
        padding: 8px 15px;
        border-radius: 20px;
        border: 2px solid black;
        font-size: 12px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        font-weight: 500;
      `;
      indicator.textContent = '(주)브이아이피플러스';
      document.body.appendChild(indicator);
      // console.log('📌 회사명 인디케이터 생성 (계속 표시)');
    }
    
    // 5. 워터마크 표시 (대각선, 전체 화면)
    if (!document.getElementById('vip-watermark-container')) {
      const companyName = localStorage.getItem('vip_company_name');
      if (companyName) {
        const watermarkContainer = document.createElement('div');
        watermarkContainer.id = 'vip-watermark-container';
        watermarkContainer.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 999998;
          overflow: hidden;
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
        // console.log('💧 워터마크 생성:', companyName);
      }
    }
    
    // if (modified) {
    //   console.log('✅ 대리점 정보 처리 완료');
    // }
    
    return modified;
  }

  // 페이지 로드 시 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideAgentInfo);
  } else {
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
