// Popup 스크립트

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('protection-status');
  const testBtn = document.getElementById('test-btn');
  const versionEl = document.querySelector('.version');
  
  // 버전 정보 동적으로 표시
  const manifest = chrome.runtime.getManifest();
  if (versionEl) {
    versionEl.textContent = `v${manifest.version}`;
  }
  
  // 현재 탭 확인
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab && tab.url && tab.url.includes('onsalemobile.uplus.co.kr')) {
    statusEl.textContent = '보호 중';
    statusEl.classList.add('active');
    
    // 페이지에 확장 프로그램이 작동 중인지 확인
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.VIP_AGENT_PROTECTION_ENABLED || false
      });
      
      if (result && result[0]?.result) {
        statusEl.textContent = '보호 중';
      }
    } catch (error) {
      console.error('스크립트 실행 오류:', error);
    }
  } else {
    statusEl.textContent = '대기 중';
  }
  
  // 테스트 버튼
  testBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://onsalemobile.uplus.co.kr/open-market?formId=2464468&agentId=306891&openmktCd=12'
    });
  });
});

