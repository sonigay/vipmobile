const puppeteer = require('puppeteer');

let browser = null;

// 브라우저 초기화 (한 번만 실행)
async function initBrowser() {
  if (browser) {
    return browser;
  }
  
  const args = process.env.PUPPETEER_ARGS 
    ? process.env.PUPPETEER_ARGS.split(',')
    : ['--no-sandbox', '--disable-setuid-sandbox'];
  
  browser = await puppeteer.launch({
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    args: args
  });
  
  console.log('✅ 브라우저가 준비되었습니다.');
  return browser;
}

// Google Sheets 스크린샷 생성
async function captureSheetAsImage(sheetUrl, options = {}) {
  const {
    waitTime = 3000,        // 페이지 로딩 대기 시간 (ms)
    viewportWidth = 1920,   // 뷰포트 너비
    viewportHeight = 1080,  // 뷰포트 높이
    selector = null,        // 특정 영역 선택자 (null이면 전체)
    fullPage = false        // 전체 페이지 캡처 여부
  } = options;
  
  if (!browser) {
    await initBrowser();
  }
  
  const page = await browser.newPage();
  
  try {
    // 뷰포트 설정
    await page.setViewport({ 
      width: viewportWidth, 
      height: viewportHeight 
    });
    
    // Google Sheets URL로 이동
    console.log(`📸 스크린샷 생성 중: ${sheetUrl}`);
    await page.goto(sheetUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // 추가 대기 시간 (시트 로딩 완료 대기)
    await page.waitForTimeout(waitTime);
    
    let screenshot;
    
    if (selector) {
      // 특정 영역만 캡처
      console.log(`🎯 선택자로 캡처: ${selector}`);
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`선택자를 찾을 수 없습니다: ${selector}`);
      }
      screenshot = await element.screenshot({ 
        type: 'png',
        encoding: 'binary'
      });
    } else if (fullPage) {
      // 전체 페이지 캡처
      console.log('📄 전체 페이지 캡처');
      screenshot = await page.screenshot({ 
        type: 'png', 
        fullPage: true,
        encoding: 'binary'
      });
    } else {
      // Google Sheets 그리드 영역 찾기
      const gridSelectors = [
        '.grid-container',
        '.grid-viewport',
        '[role="grid"]',
        '.sheets-grid-container'
      ];
      
      let gridElement = null;
      for (const sel of gridSelectors) {
        try {
          gridElement = await page.$(sel);
          if (gridElement) {
            console.log(`✅ 그리드 영역 찾음: ${sel}`);
            break;
          }
        } catch (e) {
          // 선택자 찾기 실패, 다음 시도
        }
      }
      
      if (gridElement) {
        screenshot = await gridElement.screenshot({ 
          type: 'png',
          encoding: 'binary'
        });
      } else {
        // 그리드를 찾지 못하면 전체 페이지 캡처
        console.log('⚠️ 그리드 영역을 찾지 못해 전체 페이지 캡처');
        screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: true,
          encoding: 'binary'
        });
      }
    }
    
    console.log('✅ 스크린샷 생성 완료');
    return screenshot;
    
  } catch (error) {
    console.error('❌ 스크린샷 생성 오류:', error);
    throw error;
  } finally {
    await page.close();
  }
}

// 브라우저 종료
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('🔒 브라우저가 종료되었습니다.');
  }
}

module.exports = {
  initBrowser,
  captureSheetAsImage,
  closeBrowser
};

