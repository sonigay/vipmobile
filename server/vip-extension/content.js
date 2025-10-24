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
// v1.3.1 - JavaScript 구문 에러 수정: console.log 템플릿 리터럴 문제 해결
// v1.3.2 - HTML 치환 범위 축소: U+ 페이지 백지 현상 해결, 안전성 검증 강화
//
// 버전 관리 규칙 (AI 자동 업데이트):
// - 버그 수정: patch 버전 증가 (예: 1.1.0 → 1.1.1)
// - 기능 추가: minor 버전 증가 (예: 1.1.0 → 1.2.0)
// - 큰 변경: major 버전 증가 (예: 1.1.0 → 2.0.0)
//
// 자동 버전 계산: 현재 최신 버전은 v1.3.2

(function() {
  'use strict';
  
  // 자동 버전 계산 함수
  function getCurrentVersion() {
    const versionHistory = [
      'v1.0.0', 'v1.1.0', 'v1.1.1', 'v1.1.2', 'v1.2.0', 'v1.2.1', 
      'v1.3.0', 'v1.3.1', 'v1.3.2'
    ];
    return versionHistory[versionHistory.length - 1];
  }
  
  // 현재 버전 자동 계산
  const CURRENT_VERSION = getCurrentVersion();
  
  // VIP 앱에서 온 접속인지 확인 (vipCompany 파라미터 체크)
  const urlParams = new URLSearchParams(window.location.search);
  const vipCompany = urlParams.get('vipCompany');
  
  // 개통정보 페이지 감지
  const isActivationInfoPage = 
    (window.location.hostname.includes('vipmobile.netlify.app') || 
     window.location.hostname.includes('localhost')) &&
    urlParams.get('activationSheetId');
  
  let isVipAppAccess = false;
  if (vipCompany) {
    console.log('✅ VIP 앱에서 온 접속 확인:', decodeURIComponent(vipCompany));
    isVipAppAccess = true;
  } else {
    console.log('🔒 VIP 앱이 아닌 직접 접속으로 기능 비활성화');
    isVipAppAccess = false;
  }

  // 확장 프로그램이 설치되어 있음을 표시 (VIP 앱에서만)
  window.VIP_AGENT_PROTECTION_ENABLED = true;
  window.VIP_EXTENSION_VERSION = CURRENT_VERSION; // 자동 계산된 버전 정보
  document.documentElement.setAttribute('data-vip-extension', 'installed');
  document.documentElement.setAttribute('data-vip-extension-version', CURRENT_VERSION);

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
    // VIP 앱에서 온 접속이 아니면 기능 비활성화
    if (!isVipAppAccess) {
      return;
    }
    
    // 개통정보 페이지에서는 회사명 치환/숨김 비활성화
    if (isActivationInfoPage) {
      console.log('📝 개통정보 페이지: 워터마크만 표시, 회사명 치환 비활성화');
    }
    
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
      // URL 파라미터에서 업체명 가져오기
      const urlParams = new URLSearchParams(window.location.search);
      const companyName = urlParams.get('vipCompany');
      
      if (companyName) {
        console.log('✅ URL 파라미터에서 업체명 확인:', decodeURIComponent(companyName));
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
        
        // 화면 전체에 넓게 분포된 랜덤 위치로 여러 개 생성
        for (let i = 0; i < 20; i++) {
          const watermark = document.createElement('div');
          
          // 더 넓은 분포를 위한 위치 계산 (격자 기반 + 랜덤 오프셋)
          const gridCols = 5; // 5열
          const gridRows = 4; // 4행
          const col = i % gridCols;
          const row = Math.floor(i / gridCols);
          
          // 격자 기반 위치 + 랜덤 오프셋
          const baseTop = (row * 25) + (Math.random() - 0.5) * 20; // ±10% 오프셋
          const baseLeft = (col * 25) + (Math.random() - 0.5) * 20; // ±10% 오프셋
          
          const randomTop = Math.max(0, Math.min(100, baseTop));
          const randomLeft = Math.max(0, Math.min(100, baseLeft));
          const randomRotation = (Math.random() - 0.5) * 60; // -30도 ~ +30도
          
          // 랜덤 글씨 크기 (40px ~ 120px) - 적당히 보기 좋게
          const randomFontSize = 40 + Math.random() * 80;
          
          watermark.style.cssText = `
            position: absolute;
            top: ${randomTop}%;
            left: ${randomLeft}%;
            text-align: center;
            transform: rotate(${randomRotation}deg);
            font-size: ${randomFontSize}px;
            font-weight: bold;
            color: rgba(0, 0, 0, 0.08);
            font-family: Arial, sans-serif;
            user-select: none;
            white-space: nowrap;
            pointer-events: none;
          `;
          watermark.textContent = decodeURIComponent(companyName);
          watermarkContainer.appendChild(watermark);
        }
        
        document.body.appendChild(watermarkContainer);
        console.log('💧 워터마크 생성:', decodeURIComponent(companyName));
      } else {
        console.log('⚠️ URL에 업체명 파라미터 없음');
      }
    }
  }

  // 대리점 정보 숨김 처리
  function hideAgentInfo() {
    // VIP 앱에서 온 접속이 아니면 기능 비활성화
    if (!isVipAppAccess) {
      return;
    }
    
    // 개통정보 페이지에서는 회사명 치환/숨김 비활성화
    if (isActivationInfoPage) {
      console.log('📝 개통정보 페이지: 회사명 치환/숨김 비활성화');
      return;
    }
    let modified = false;
    
    // URL은 그대로 유지 (기능 유지를 위해 변경하지 않음)
    
    // 1. 텍스트 패턴 치환 (보호 로직 적용)
    const textPatterns = [
      // 팝업 문구 전체 교체 (자연스럽게)
      { 
        pattern: /고객님은 LG유플러스의 대리점인[^를]*를 통해 가입이 됩니다\./gi, 
        replacement: '고객님은 LG유플러스 공식 인증 대리점을 통해 가입이 됩니다.' 
      },
      // 회사명 치환 (VIP 관련 회사명 제외)
      { 
        pattern: /\(주\)(?!브이아이피)[^)]*/gi, 
        replacement: '공식인증대리점' 
      },
      { 
        pattern: /주식회사\s+(?!브이아이피)[^\s]*/gi, 
        replacement: '공식인증대리점' 
      },
      // 에프원 특별 처리
      { 
        pattern: /주식회사\s*에프원/gi, 
        replacement: '공식인증대리점' 
      },
      { 
        pattern: /\(주\)에프원/gi, 
        replacement: '공식인증대리점' 
      },
      { 
        pattern: /에프원/gi, 
        replacement: '공식인증대리점' 
      },
      { 
        pattern: /\(유\)[^)]*/gi, 
        replacement: '공식인증대리점' 
      },
      { 
        pattern: /\(사\)[^)]*/gi, 
        replacement: '공식인증대리점' 
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
      
      // 디버깅: 에프원이나 주식회사가 포함된 텍스트 찾기
      if (originalText.includes('에프원') || originalText.includes('주식회사')) {
        console.log(`🔍 발견된 텍스트:`, originalText);
        console.log(`📍 위치:`, node.parentElement?.tagName, node.parentElement?.className);
      }
      
      // 🛡️ 강력한 보호 로직 - 치환 전에 먼저 확인
      const vipCompany = urlParams.get('vipCompany');
      const isVipRelated = originalText.includes('브이아이피') || originalText.includes('VIP');
      const isUserCompany = vipCompany && originalText.includes(vipCompany);
      const isLgUplus = originalText.includes('엘지유플러스') || originalText.includes('LG유플러스') || originalText.includes('(주)엘지유플러스') || originalText.includes('유플러스') || originalText.includes('(주)유플러스');
      
      console.log('🔍 회사명 체크:', {
        originalText: originalText.substring(0, 50) + '...',
        vipCompany,
        isVipRelated,
        isUserCompany,
        isLgUplus
      });
      
      // 🚫 보호 대상이면 아예 치환하지 않음
      if (isVipRelated || isUserCompany || isLgUplus) {
        if (isUserCompany) {
          console.log('🛡️ 사용자 업체명 강력 보호:', vipCompany, '→ 치환하지 않음');
        } else if (isLgUplus) {
          console.log('🛡️ LG U+ 공식 회사명 강력 보호: → 치환하지 않음');
        } else if (isVipRelated) {
          console.log('🛡️ VIP 관련 회사명 강력 보호: → 치환하지 않음');
        }
        // 보호 대상이면 아예 치환하지 않음
        newText = originalText;
      } else {
        // 보호 대상이 아닌 경우에만 패턴 치환
        textPatterns.forEach(({ pattern, replacement }) => {
          if (pattern.test(newText)) {
            console.log('✅ 패턴 매치:', pattern, '→', replacement);
            newText = newText.replace(pattern, replacement);
          }
        });
        
        // 회사명 치환 (보호 대상이 아닌 경우에만)
        const beforeReplace = newText;
        newText = newText.replace(/주식회사\s+[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        newText = newText.replace(/\(주\)[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        newText = newText.replace(/\(유\)[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        newText = newText.replace(/\(사\)[가-힣A-Za-z0-9]+/gi, '공식인증대리점');
        
        if (beforeReplace !== newText) {
          console.log('🔄 회사명 치환:', beforeReplace, '→', newText);
        }
      }
      
      if (newText !== originalText) {
        console.log('✨ 텍스트 변경됨:', originalText, '→', newText);
        nodesToModify.push({ node, newText });
      }
    }
    
    nodesToModify.forEach(({ node, newText }) => {
      node.textContent = newText;
      modified = true;
    });
    
    // 3. 추가: 특정 위치의 HTML 요소들만 치환 (대리점 정보 영역)
    const specificSelectors = [
      '.dialog-c-text',           // U+ 대화상자 텍스트 영역
      '.dynamic-data-temp'        // 동적 데이터 표시 영역
    ];
    
    specificSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element.id === 'vip-company-indicator' || 
            element.id === 'vip-watermark-container' ||
            element.className === 'vip-permanent-element') {
          return; // VIP 영구 요소는 건너뛰기
        }
        
        // 🛡️ 안전성 검증: 스크립트, 스타일, 메타 태그는 절대 건드리지 않음
        if (element.tagName === 'SCRIPT' || 
            element.tagName === 'STYLE' || 
            element.tagName === 'META' ||
            element.tagName === 'LINK' ||
            element.tagName === 'TITLE') {
          return; // 핵심 페이지 요소는 건드리지 않음
        }
        
        // 🛡️ 안전성 검증: HTML에 스크립트나 스타일이 포함된 경우 건드리지 않음
        if (element.innerHTML.includes('<script') || 
            element.innerHTML.includes('<style') ||
            element.innerHTML.includes('function(') ||
            element.innerHTML.includes('var ') ||
            element.innerHTML.includes('const ') ||
            element.innerHTML.includes('let ')) {
          return; // JavaScript나 CSS가 포함된 요소는 건드리지 않음
        }
        
        const originalHTML = element.innerHTML;
        let newHTML = originalHTML;
        
        
        // 🛡️ 강력한 HTML 보호 로직 - 치환 전에 먼저 확인
        const vipCompany = urlParams.get('vipCompany');
        const isVipRelated = newHTML.includes('브이아이피') || newHTML.includes('VIP');
        const isUserCompany = vipCompany && newHTML.includes(vipCompany);
        const isLgUplus = newHTML.includes('엘지유플러스') || newHTML.includes('LG유플러스') || newHTML.includes('(주)엘지유플러스') || newHTML.includes('유플러스') || newHTML.includes('(주)유플러스');
        
        // 🚫 보호 대상이면 아예 치환하지 않음
        if (isVipRelated || isUserCompany || isLgUplus) {
          if (isUserCompany) {
            console.log('🛡️ 사용자 업체명 HTML 강력 보호:', vipCompany, '→ 치환하지 않음');
          } else if (isLgUplus) {
            console.log('🛡️ LG U+ 공식 회사명 HTML 강력 보호: → 치환하지 않음');
          } else if (isVipRelated) {
            console.log('🛡️ VIP 관련 회사명 HTML 강력 보호: → 치환하지 않음');
          }
          // 보호 대상이면 아예 치환하지 않음
          newHTML = originalHTML;
        } else {
          // 보호 대상이 아닌 경우에만 패턴 치환
          textPatterns.forEach(({ pattern, replacement }) => {
            if (pattern.test(newHTML)) {
              console.log('🔧 HTML 패턴 매치 [' + selector + ']:', pattern, '→', replacement);
              newHTML = newHTML.replace(pattern, replacement);
            }
          });
          
          // 회사명 치환 (보호 대상이 아닌 경우에만)
          const beforeReplace = newHTML;
          newHTML = newHTML.replace(/주식회사\s*에프원/gi, '공식인증대리점');
          newHTML = newHTML.replace(/\(주\)에프원/gi, '공식인증대리점');
          newHTML = newHTML.replace(/에프원/gi, '공식인증대리점');
          
          if (beforeReplace !== newHTML) {
            console.log('🔧 회사명 HTML 치환 [' + selector + ']:', beforeReplace, '→', newHTML);
          }
        }
        
        if (newHTML !== originalHTML) {
          element.innerHTML = newHTML;
          modified = true;
          console.log('🔧 HTML 치환됨 [' + selector + ']:', originalHTML, '→', newHTML);
        }
      });
    });
    
    // 4. 특정 input 필드만 처리 (대리점명 관련 필드만)
    const dealerInputSelectors = [
      'input[id="selling-store-name"]',
      'input[name="agentName"]',
      'input[title*="대리점"]',
      'input[title*="판매점"]'
    ];
    
    dealerInputSelectors.forEach(selector => {
      const inputs = document.querySelectorAll(selector);
      inputs.forEach(input => {
        if (input.value) {
          const originalValue = input.value;
          let newValue = originalValue;
          
          console.log('🔍 대리점 input 발견 [' + selector + ']:', originalValue);
          
          // 🛡️ 강력한 INPUT 보호 로직 - 치환 전에 먼저 확인
          const vipCompany = urlParams.get('vipCompany');
          const isVipRelated = newValue.includes('브이아이피') || newValue.includes('VIP');
          const isUserCompany = vipCompany && newValue.includes(vipCompany);
          const isLgUplus = newValue.includes('엘지유플러스') || newValue.includes('LG유플러스') || newValue.includes('(주)엘지유플러스') || newValue.includes('유플러스') || newValue.includes('(주)유플러스');
          
          // 🚫 보호 대상이면 아예 치환하지 않음
          if (isVipRelated || isUserCompany || isLgUplus) {
            if (isUserCompany) {
              console.log('🛡️ 사용자 업체명 INPUT 강력 보호:', vipCompany, '→ 치환하지 않음');
            } else if (isLgUplus) {
              console.log('🛡️ LG U+ 공식 회사명 INPUT 강력 보호: → 치환하지 않음');
            } else if (isVipRelated) {
              console.log('🛡️ VIP 관련 회사명 INPUT 강력 보호: → 치환하지 않음');
            }
            // 보호 대상이면 아예 치환하지 않음
            newValue = originalValue;
          } else {
            // 보호 대상이 아닌 경우에만 패턴 치환
            textPatterns.forEach(({ pattern, replacement }) => {
              if (pattern.test(newValue)) {
                console.log('🔧 대리점 INPUT 패턴 매치:', pattern, '→', replacement);
                newValue = newValue.replace(pattern, replacement);
              }
            });
            
            // 회사명 치환 (보호 대상이 아닌 경우에만)
            const beforeReplace = newValue;
            newValue = newValue.replace(/주식회사\s*에프원/gi, '공식인증대리점');
            newValue = newValue.replace(/\(주\)에프원/gi, '공식인증대리점');
            newValue = newValue.replace(/에프원/gi, '공식인증대리점');
            
            if (beforeReplace !== newValue) {
              console.log('🔧 에프원 대리점 INPUT 치환:', beforeReplace, '→', newValue);
            }
          }
          
          if (newValue !== originalValue) {
            input.value = newValue;
            modified = true;
            console.log('🔧 대리점 INPUT 치환됨:', originalValue, '→', newValue);
          }
        }
      });
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

  // U+ 제출 데이터 수집 기능
  function collectUplusSubmissionData() {
    // U+ 페이지에서만 실행
    if (!window.location.hostname.includes('onsalemobile.uplus.co.kr')) {
      return;
    }
    
    // vipCompany 파라미터로 VIP 앱에서 온 것 확인
    const vipCompany = urlParams.get('vipCompany');
    if (!vipCompany) {
      return;
    }
    
    // localStorage에서 시트 정보 가져오기 (개통양식 페이지에서 저장해둠)
    const sheetId = localStorage.getItem('vip_activation_sheetId');
    const sheetName = localStorage.getItem('vip_activation_sheetName');
    
    if (!sheetId || !sheetName) {
      console.log('시트 정보 없음, U+ 데이터 수집 불가');
      return;
    }
    
    // 제출 버튼 감지 (U+ 페이지의 submit 버튼)
    const submitButtons = document.querySelectorAll('button[type="submit"], button.submit, .btn-submit');
    
    submitButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        // 약간의 지연을 주어 폼 데이터가 완전히 입력되도록
        setTimeout(async () => {
          const formData = {};
          
          // 모든 input, select, textarea 수집
          document.querySelectorAll('input, select, textarea').forEach(field => {
            if (field.name || field.id) {
              const key = field.name || field.id;
              if (field.type === 'checkbox' || field.type === 'radio') {
                if (field.checked) {
                  formData[key] = field.value || true;
                }
              } else {
                formData[key] = field.value;
              }
            }
          });
          
          // 전화번호 추출 (매칭용)
          const phoneNumber = formData.phoneNumber || formData.phone || 
                             formData.tel || formData.contact || '';
          
          console.log('U+ 제출 데이터 수집:', formData);
          
          // VIP 앱 API로 전송
          try {
            const response = await fetch('https://vipmobile.netlify.app/api/onsale/uplus-submission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheetId,
                sheetName,
                phoneNumber,
                data: formData
              })
            });
            
            if (response.ok) {
              console.log('✅ U+ 제출 데이터 저장 완료');
            }
          } catch (error) {
            console.error('U+ 데이터 저장 실패:', error);
          }
        }, 500);
      });
    });
  }

  // U+ 페이지에서 실행
  if (window.location.hostname.includes('onsalemobile.uplus.co.kr')) {
    collectUplusSubmissionData();
  }

  // console.log('✅ VIP 필수 확장프로그램 실행 중...');

})(); // IIFE 끝
