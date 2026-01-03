const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const Jimp = require('jimp');

let driver = null;

// 브라우저 상태 확인
async function isBrowserAlive() {
  if (!driver) {
    return false;
  }
  
  try {
    // 간단한 명령어로 브라우저가 살아있는지 확인
    await driver.getCurrentUrl();
    return true;
  } catch (error) {
    // 브라우저가 종료되었거나 연결이 끊어진 경우
    console.warn('⚠️ 브라우저 상태 확인 실패:', error.message);
    driver = null; // 드라이버 초기화
    return false;
  }
}

// 브라우저 초기화 (한 번만 실행)
async function initBrowser() {
  // 브라우저가 이미 있고 살아있는지 확인
  if (driver) {
    const isAlive = await isBrowserAlive();
    if (isAlive) {
      return driver;
    }
    // 브라우저가 죽었으면 재초기화
    console.log('🔄 브라우저가 종료되었습니다. 재초기화 중...');
    driver = null;
  }

  const options = new chrome.Options();
  
  // 환경변수에서 headless 설정 확인 (기본값: headless 모드)
  // PM2에서 실행할 때는 반드시 headless 모드로 실행해야 콘솔창이 열리지 않음
  if (process.env.PUPPETEER_HEADLESS !== 'false') {
    options.addArguments('--headless=new'); // 새로운 headless 모드 사용
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
  
  // PM2 환경에서 콘솔창이 열리지 않도록 추가 옵션
  options.addArguments('--disable-infobars'); // 정보 바 비활성화
  options.addArguments('--disable-dev-shm-usage'); // /dev/shm 사용 비활성화
  options.addArguments('--remote-debugging-port=0'); // 디버깅 포트 자동 할당
  
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

  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    console.log('✅ 브라우저가 준비되었습니다.');
    return driver;
  } catch (error) {
    console.error('❌ 브라우저 초기화 실패:', error);
    if (error.message && error.message.includes('ECONNREFUSED')) {
      console.error('   → Chrome DevTools Protocol 연결 실패');
      console.error('   → Chrome이 실행 중인지 확인하세요');
      console.error('   → 포트가 이미 사용 중일 수 있습니다');
    }
    throw error;
  }
}

// Google Sheets 스크린샷 생성
async function captureSheetAsImage(sheetUrl, options = {}) {
  const {
    waitTime = 3000  // 페이지 로딩 대기 시간 (ms)
  } = options;

  // 브라우저 초기화 및 상태 확인
  if (!driver) {
    await initBrowser();
  } else {
    // 브라우저가 살아있는지 확인
    const isAlive = await isBrowserAlive();
    if (!isAlive) {
      console.log('🔄 브라우저 재초기화 중...');
      await initBrowser();
    }
  }

  // 각 요청마다 새로운 탭을 열어서 처리 (동시 요청 충돌 방지)
  let originalWindowHandle = null;
  let newTabHandle = null;

  try {
    console.log(`📸 스크린샷 생성 중: ${sheetUrl}`);
    
    // 1. 현재 창 핸들 저장
    originalWindowHandle = await driver.getWindowHandle();
    const originalHandles = await driver.getAllWindowHandles();
    
    // 2. 새 탭 열기
    await driver.executeScript("window.open('about:blank', '_blank');");
    
    // 3. 새 탭 핸들 찾기
    await new Promise(resolve => setTimeout(resolve, 500)); // 탭 생성 대기
    const allHandles = await driver.getAllWindowHandles();
    newTabHandle = allHandles.find(handle => !originalHandles.includes(handle));
    
    if (!newTabHandle) {
      throw new Error('새 탭을 생성할 수 없습니다.');
    }
    
    // 4. 새 탭으로 전환
    await driver.switchTo().window(newTabHandle);
    console.log('   → 새 탭으로 전환 완료');
    
    // 5. Google Sheets URL로 이동
    await driver.get(sheetUrl);
    console.log('🌐 시트 로드 완료');
    
    // 4. 페이지가 완전히 로드될 때까지 대기
    await driver.wait(async () => {
      const readyState = await driver.executeScript('return document.readyState');
      return readyState === 'complete';
    }, 10000);

    // 5. Google Sheets 동적 로딩 완료 대기 (추가 대기 시간)
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 추가 대기

    // iframe을 찾아 그 안으로 포커스 전환 (재시도 로직 추가)
    let iframe = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries && !iframe) {
      try {
        iframe = await driver.wait(
          until.elementLocated(By.css('#pageswitcher-content')),
          20000 // 타임아웃을 20초로 줄이고 재시도로 보완
        );
        break; // 성공하면 루프 종료
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⚠️ iframe 찾기 실패, 재시도 ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
        } else {
          throw new Error(`iframe을 찾을 수 없습니다 (#pageswitcher-content). 재시도 ${maxRetries}회 실패: ${error.message}`);
        }
      }
    }
    
    await driver.switchTo().frame(iframe);
    console.log('🔍 iframe 내부로 포커스 전환 완료.');

    // iframe 안에서 테이블 요소 탐색 (재시도 로직 추가)
    let table = null;
    retryCount = 0;
    
    while (retryCount < maxRetries && !table) {
      try {
        table = await driver.wait(
          until.elementLocated(By.css('table')),
          20000 // 타임아웃을 20초로 줄이고 재시도로 보완
        );
        await driver.wait(
          until.elementIsVisible(table),
          10000
        );
        break; // 성공하면 루프 종료
      } catch (error) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⚠️ 테이블 요소 찾기 실패, 재시도 ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
        } else {
          // iframe에서 나와서 다시 시도
          await driver.switchTo().defaultContent();
          throw new Error(`테이블 요소를 찾을 수 없습니다. 재시도 ${maxRetries}회 실패: ${error.message}`);
        }
      }
    }
    
    console.log('✅ 테이블 요소 찾음');

    // 테이블이 보이도록 스크롤
    await driver.executeScript("arguments[0].scrollIntoView(true);", table);
    
    // 추가 대기 시간 (시트 로딩 완료 대기)
    // Google Sheets는 동적 로딩이 많으므로 충분한 대기 시간 필요
    await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, 3000))); // 최소 3초 대기

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
    try {
      await driver.switchTo().defaultContent();
    } catch (e) {
      console.warn('   → defaultContent 전환 실패 (무시):', e.message);
    }

    // 새 탭 닫기 (안전하게)
    if (newTabHandle) {
      try {
        // 현재 탭이 여전히 유효한지 확인
        const currentHandle = await driver.getWindowHandle();
        if (currentHandle === newTabHandle) {
          // 새 탭이 현재 탭이면 닫기
          await driver.close();
          console.log('   → 새 탭 닫기 완료');
        } else {
          // 이미 다른 탭으로 전환된 경우 새 탭으로 전환 후 닫기
          try {
            await driver.switchTo().window(newTabHandle);
            await driver.close();
            console.log('   → 새 탭으로 전환 후 닫기 완료');
          } catch (e) {
            console.warn('   → 새 탭 전환/닫기 실패 (이미 닫혔을 수 있음):', e.message);
          }
        }
        
        // 원래 탭으로 전환
        if (originalWindowHandle) {
          try {
            // 원래 탭이 여전히 존재하는지 확인
            const allHandles = await driver.getAllWindowHandles();
            if (allHandles.includes(originalWindowHandle)) {
              await driver.switchTo().window(originalWindowHandle);
              console.log('   → 원래 탭으로 복귀 완료');
            } else {
              // 원래 탭이 없으면 첫 번째 탭으로 전환
              if (allHandles.length > 0) {
                await driver.switchTo().window(allHandles[0]);
                console.log('   → 첫 번째 탭으로 전환 완료');
              }
            }
          } catch (e) {
            console.warn('   → 원래 탭으로 전환 실패:', e.message);
            // 첫 번째 탭으로 전환 시도
            try {
              const allHandles = await driver.getAllWindowHandles();
              if (allHandles.length > 0) {
                await driver.switchTo().window(allHandles[0]);
              }
            } catch (e2) {
              // 전환 실패 무시
            }
          }
        }
      } catch (e) {
        console.warn('   → 탭 닫기 실패 (무시):', e.message);
        // 원래 탭으로 전환 시도
        try {
          if (originalWindowHandle) {
            const allHandles = await driver.getAllWindowHandles();
            if (allHandles.includes(originalWindowHandle)) {
              await driver.switchTo().window(originalWindowHandle);
            } else if (allHandles.length > 0) {
              await driver.switchTo().window(allHandles[0]);
            }
          }
        } catch (e2) {
          // 전환 실패 무시
        }
      }
    }

    return buffer;

  } catch (error) {
    console.error('❌ 스크린샷 생성 오류:', error);
    console.error('   에러 타입:', error.name);
    console.error('   에러 메시지:', error.message);
    
    // ECONNREFUSED 에러인 경우 브라우저 재초기화 시도
    if (error.message && error.message.includes('ECONNREFUSED')) {
      console.error('   → Chrome DevTools Protocol 연결 실패');
      console.log('   → 브라우저 재초기화 시도 중...');
      
      // 드라이버 초기화
      try {
        if (driver) {
          await driver.quit().catch(() => {}); // 종료 시도 (에러 무시)
        }
      } catch (e) {
        // 종료 실패 무시
      }
      driver = null;
      
      // 브라우저 재초기화
      try {
        await initBrowser();
        console.log('   → 브라우저 재초기화 완료');
      } catch (initError) {
        console.error('   → 브라우저 재초기화 실패:', initError.message);
        throw error; // 원래 에러를 다시 throw
      }
      
      // 재초기화 후 에러를 다시 throw하여 상위에서 재시도하도록 함
      throw new Error(`브라우저 연결 실패 (재초기화 완료, 재시도 필요): ${error.message}`);
    }
    
    // 에러 발생 시에도 새 탭 닫기 및 원래 탭으로 전환 (안전하게)
    try {
      if (newTabHandle && driver) {
        try {
          // 현재 탭이 새 탭인지 확인
          const currentHandle = await driver.getWindowHandle();
          if (currentHandle === newTabHandle) {
            await driver.close();
          } else {
            // 새 탭으로 전환 후 닫기 시도
            try {
              await driver.switchTo().window(newTabHandle);
              await driver.close();
            } catch (e) {
              // 탭이 이미 닫혔을 수 있음
              console.warn('   → 새 탭이 이미 닫혔거나 접근 불가:', e.message);
            }
          }
        } catch (e) {
          // 탭 닫기 실패 무시
          console.warn('   → 탭 닫기 실패 (무시):', e.message);
        }
        
        // 원래 탭으로 전환
        if (originalWindowHandle) {
          try {
            const allHandles = await driver.getAllWindowHandles();
            if (allHandles.includes(originalWindowHandle)) {
              await driver.switchTo().window(originalWindowHandle);
            } else if (allHandles.length > 0) {
              // 원래 탭이 없으면 첫 번째 탭으로
              await driver.switchTo().window(allHandles[0]);
            }
          } catch (e) {
            console.warn('   → 원래 탭으로 전환 실패:', e.message);
          }
        }
      } else if (driver) {
        try {
          await driver.switchTo().defaultContent();
        } catch (e) {
          // defaultContent 전환 실패 무시
        }
      }
    } catch (e) {
      // 전환 실패 무시
      console.warn('   → 탭 정리 중 오류 (무시):', e.message);
    }
    
    throw error;
  }
}

// 브라우저 종료
async function closeBrowser() {
  if (driver) {
    try {
      await driver.quit();
      console.log('🔒 브라우저가 종료되었습니다.');
    } catch (error) {
      console.warn('⚠️ 브라우저 종료 중 오류 (무시):', error.message);
    } finally {
      driver = null;
    }
  }
  
  // 추가: Chrome 프로세스가 남아있을 수 있으므로 강제 종료 시도 (Windows)
  if (process.platform === 'win32') {
    try {
      const { exec } = require('child_process');
      // Chrome 프로세스 중 selenium 관련 프로세스만 종료
      exec('taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq *chrome*" 2>nul', (error) => {
        if (!error) {
          console.log('🧹 남아있는 Chrome 프로세스 정리 완료');
        }
      });
    } catch (e) {
      // 무시
    }
  }
}

module.exports = {
  initBrowser,
  captureSheetAsImage,
  closeBrowser
};
