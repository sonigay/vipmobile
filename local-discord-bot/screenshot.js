const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const Jimp = require('jimp');

let driver = null;

// 브라우저 초기화 (한 번만 실행)
async function initBrowser() {
  if (driver) {
    return driver;
  }

  const options = new chrome.Options();
  
  // 환경변수에서 headless 설정 확인
  if (process.env.PUPPETEER_HEADLESS !== 'false') {
    options.addArguments('--headless');
  }
  
  // Chrome 옵션 설정 (기존 Selenium 코드에서 가져옴)
  options.addArguments('--disable-gpu');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--disable-software-rasterizer');
  options.addArguments('--disable-extensions');
  options.addArguments('--disable-notifications');
  options.addArguments('--disable-popup-blocking');
  options.addArguments('--window-size=2560,10000');
  options.addArguments('--hide-scrollbars');
  options.addArguments('--log-level=3');
  options.addArguments('--silent');
  options.addArguments('--memory-pressure-off');
  options.addArguments('--max_old_space_size=4096');
  options.addArguments('--disable-background-timer-throttling');
  options.addArguments('--disable-backgrounding-occluded-windows');
  options.addArguments('--disable-renderer-backgrounding');
  
  // 환경변수에서 추가 인수 가져오기
  if (process.env.PUPPETEER_ARGS) {
    const additionalArgs = process.env.PUPPETEER_ARGS.split(',');
    additionalArgs.forEach(arg => {
      if (arg.trim()) {
        options.addArguments(arg.trim());
      }
    });
  }
  
  options.excludeSwitches(['enable-logging', 'enable-automation']);
  options.setLoggingPrefs({ 'browser': 'OFF', 'driver': 'OFF' });

  driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  console.log('✅ 브라우저가 준비되었습니다.');
  return driver;
}

// Google Sheets 스크린샷 생성
async function captureSheetAsImage(sheetUrl, options = {}) {
  const {
    waitTime = 3000  // 페이지 로딩 대기 시간 (ms)
  } = options;

  if (!driver) {
    await initBrowser();
  }

  try {
    console.log(`📸 스크린샷 생성 중: ${sheetUrl}`);
    
    // Google Sheets URL로 이동
    await driver.get(sheetUrl);
    console.log('🌐 시트 로드 완료');

    // iframe을 찾아 그 안으로 포커스 전환
    const iframe = await driver.wait(
      until.elementLocated(By.css('#pageswitcher-content')),
      30000
    );
    await driver.switchTo().frame(iframe);
    console.log('🔍 iframe 내부로 포커스 전환 완료.');

    // iframe 안에서 테이블 요소 탐색
    const table = await driver.wait(
      until.elementLocated(By.css('table')),
      30000
    );
    await driver.wait(
      until.elementIsVisible(table),
      30000
    );
    console.log('✅ 테이블 요소 찾음');

    // 테이블이 보이도록 스크롤
    await driver.executeScript("arguments[0].scrollIntoView(true);", table);
    
    // 추가 대기 시간 (시트 로딩 완료 대기)
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // 테이블 위치 정보 가져오기
    const rect = await table.getRect();
    console.log(`📐 테이블 위치: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`);

    // 전체 스크린샷 찍기
    const screenshot = await driver.takeScreenshot();
    const image = await Jimp.read(Buffer.from(screenshot, 'base64'));

    // 테이블 영역만 크롭 (기존 Selenium 코드 로직 사용)
    const x = Math.max(0, Math.floor(rect.x * 0.95));
    const y = Math.max(0, Math.floor(rect.y * 0.95));
    const width = Math.min(image.bitmap.width - x, Math.floor(rect.width * 1.01));
    const height = Math.min(image.bitmap.height - y, Math.floor(rect.height * 1.01));

    console.log(`✂️ 크롭 영역: x=${x}, y=${y}, width=${width}, height=${height}`);

    const cropped = image.crop(x, y, width, height);
    
    // 버퍼로 변환 (파일 저장 대신)
    const buffer = await cropped.getBufferAsync(Jimp.MIME_PNG);
    
    console.log('✅ 스크린샷 생성 완료');

    // 작업이 끝나면 메인 페이지로 다시 포커스 전환
    await driver.switchTo().defaultContent();

    return buffer;

  } catch (error) {
    console.error('❌ 스크린샷 생성 오류:', error);
    
    // 에러 발생 시에도 메인 페이지로 전환
    try {
      await driver.switchTo().defaultContent();
    } catch (e) {
      // 전환 실패 무시
    }
    
    throw error;
  }
}

// 브라우저 종료
async function closeBrowser() {
  if (driver) {
    await driver.quit();
    driver = null;
    console.log('🔒 브라우저가 종료되었습니다.');
  }
}

module.exports = {
  initBrowser,
  captureSheetAsImage,
  closeBrowser
};
