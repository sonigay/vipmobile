// VIP 대리점 정보 보호 확장 프로그램
// U+ 온라인 가입 페이지에서 대리점 정보를 자동으로 숨김

(function() {
  'use strict';
  
  console.log('🔒 VIP 대리점 정보 보호 확장 프로그램 활성화');

  // 확장 프로그램이 설치되어 있음을 표시 (모든 도메인에서)
  window.VIP_AGENT_PROTECTION_ENABLED = true;
  document.documentElement.setAttribute('data-vip-extension', 'installed');

  // 메타 태그도 추가 (추가 감지 방법)
  const metaTag = document.createElement('meta');
  metaTag.name = 'vip-extension-installed';
  metaTag.content = 'true';
  if (document.head) {
    document.head.appendChild(metaTag);
  }

  // U+ 페이지에서만 대리점 정보 숨김 처리
  if (!window.location.href.includes('onsalemobile.uplus.co.kr')) {
    console.log('✅ VIP 확장 프로그램 활성 표시 완료 (대리점 정보 숨김은 U+ 페이지에서만)');
    return;
  }

  // 대리점 정보 숨김 처리
  function hideAgentInfo() {
    let modified = false;
    
    // 1. URL에서 agentId 숨기기
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('agentId')) {
        const originalAgentId = url.searchParams.get('agentId');
        console.log('🔍 원본 agentId 감지:', originalAgentId);
        
        // URL은 그대로 두고 (기능 유지) 표시만 변경
        // 실제로는 history API로 변경하지 않음 (세션 유지)
      }
    } catch (error) {
      console.error('URL 파싱 오류:', error);
    }
    
    // 2. 텍스트 패턴 치환 (옵션 3: 해당 요소 제거)
    const textPatterns = [
      { pattern: /\(주\)브이아이피플러스/gi, replacement: '' },
      { pattern: /브이아이피플러스/gi, replacement: '' },
      { pattern: /VIP플러스/gi, replacement: '' },
      { pattern: /대리점코드\s*\[\d+\]/gi, replacement: '' },
      { pattern: /\[브이아이피\d+_[^\]]+\]/gi, replacement: '' },
      { pattern: /경기도\s*평택시\s*평택로\s*23[^)]*\)/gi, replacement: '' },
      { pattern: /\(17917\)[^)]*평택[^)]*\)/gi, replacement: '' },
      { pattern: /070-5038-4437/gi, replacement: '' },
      { pattern: /125-86-06495/gi, replacement: '' }
    ];
    
    // 3. DOM 텍스트 노드 순회하며 치환
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const nodesToModify = [];
    let node;
    
    while (node = walker.nextNode()) {
      const originalText = node.textContent;
      let newText = originalText;
      
      textPatterns.forEach(({ pattern, replacement }) => {
        newText = newText.replace(pattern, replacement);
      });
      
      if (newText !== originalText) {
        nodesToModify.push({ node, newText });
      }
    }
    
    nodesToModify.forEach(({ node, newText }) => {
      node.textContent = newText;
      modified = true;
    });
    
    // 4. 특정 요소 완전 제거 (옵션 3)
    // 대리점 정보가 포함된 div, p 태그 찾아서 제거
    const elementsToRemove = [];
    
    document.querySelectorAll('div, p, span, td, th').forEach(element => {
      const text = element.textContent || '';
      
      // 대리점명, 주소, 전화번호가 포함된 요소 찾기
      if (
        text.includes('가입대리점명') ||
        text.includes('판매점명') ||
        text.includes('브이아이피') ||
        text.includes('평택시 평택로') ||
        text.includes('070-5038') ||
        text.includes('125-86-06495') ||
        text.includes('대리점코드')
      ) {
        // 해당 요소의 직계 부모가 아닌 경우에만 제거
        // (너무 큰 요소를 제거하면 레이아웃이 깨질 수 있음)
        if (element.children.length < 3) {
          elementsToRemove.push(element);
        }
      }
    });
    
    elementsToRemove.forEach(element => {
      console.log('🗑️ 요소 제거:', element.textContent.substring(0, 50));
      element.remove();
      modified = true;
    });
    
    // 5. 확장 프로그램 작동 표시
    if (modified) {
      console.log('✅ 대리점 정보 숨김 완료');
      
      // 페이지 상단에 작은 표시 추가 (선택적)
      if (!document.getElementById('vip-protection-indicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'vip-protection-indicator';
        indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: #667eea;
          color: white;
          padding: 8px 15px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 999999;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          font-family: Arial, sans-serif;
        `;
        indicator.textContent = '🔒 정보 보호 활성화';
        document.body.appendChild(indicator);
        
        // 3초 후 자동 제거
        setTimeout(() => {
          indicator.style.opacity = '0';
          indicator.style.transition = 'opacity 0.5s';
          setTimeout(() => indicator.remove(), 500);
        }, 3000);
      }
    }
    
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

  console.log('🔒 VIP 대리점 정보 보호 확장 프로그램 실행 중...');

})(); // IIFE 끝
