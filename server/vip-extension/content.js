// VIP 대리점 정보 보호 확장 프로그램
// U+ 온라인 가입 페이지에서 대리점 정보를 자동으로 숨김

(function() {
  'use strict';
  
  console.log('🔧 VIP 필수 확장프로그램 활성화');

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

  // U+ 페이지에서만 처리 실행
  if (!window.location.href.includes('onsalemobile.uplus.co.kr')) {
    console.log('✅ VIP 확장프로그램 활성화 완료');
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
      // 포괄적 패턴 - 브이아이피 제외한 다른 회사명만 교체
      { 
        pattern: /주식회사\s*(?!.*브이아이피|.*VIP)[가-힣A-Za-z0-9\s]+/gi, 
        replacement: '공식인증대리점' 
      },  // 주식회사 (브이아이피 제외)
      { 
        pattern: /\(주\)(?!.*브이아이피|.*VIP)[가-힣A-Za-z0-9\s]+/gi, 
        replacement: '공식인증대리점' 
      },  // (주) (브이아이피 제외)
      { 
        pattern: /\(유\)(?!.*브이아이피|.*VIP)[가-힣A-Za-z0-9\s]+/gi, 
        replacement: '공식인증대리점' 
      },  // (유) 회사명
      { 
        pattern: /\(사\)(?!.*브이아이피|.*VIP)[가-힣A-Za-z0-9\s]+/gi, 
        replacement: '공식인증대리점' 
      },  // (사) 회사명
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
        console.log('🙈 요소 숨김:', text.substring(0, 50));
        modified = true;
      }
    });
    
    // 4. 회사명 표시 (계속 떠있음, 깜빡이지 않음)
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
      console.log('📌 회사명 인디케이터 생성 (계속 표시)');
    }
    
    if (modified) {
      console.log('✅ 대리점 정보 처리 완료');
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

  console.log('✅ VIP 필수 확장프로그램 실행 중...');

})(); // IIFE 끝
