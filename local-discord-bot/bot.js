require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { initBrowser, captureSheetAsImage, closeBrowser } = require('./screenshot');
const { google } = require('googleapis');
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN_LOCAL;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_CLOUD_BOT_ID = process.env.DISCORD_CLOUD_BOT_ID; // 클라우드 서버 봇 ID

if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN_LOCAL이 설정되지 않았습니다.');
  console.error('   .env 파일을 생성하고 DISCORD_BOT_TOKEN_LOCAL을 설정해주세요.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== Google Sheets API 인증 설정 =====
function getGoogleAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google 서비스 계정 정보가 설정되지 않았습니다. GOOGLE_SERVICE_ACCOUNT_EMAIL과 GOOGLE_PRIVATE_KEY를 확인해주세요.');
  }
  
  const auth = new google.auth.JWT(
    serviceAccountEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly']
  );
  
  return auth;
}

// ===== Google Sheets API를 사용하여 엑셀 파일 다운로드 =====
async function downloadExcelWithAPI(spreadsheetId, filePath) {
  console.log(`📥 [로컬PC봇] Google Sheets API로 다운로드 시작: ${spreadsheetId}`);
  console.log(`💾 [로컬PC봇] 저장 경로: ${filePath}`);
  
  try {
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    // Google Sheets API로 첫 번째 시트 정보 확인
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
    });
    
    if (!spreadsheet.data.sheets || spreadsheet.data.sheets.length === 0) {
      throw new Error('시트를 찾을 수 없습니다.');
    }
    
    const firstSheet = spreadsheet.data.sheets[0];
    const firstSheetTitle = firstSheet.properties.title;
    console.log(`📋 [로컬PC봇] 첫 번째 시트: ${firstSheetTitle}`);
    console.log(`📊 [로컬PC봇] 전체 시트 수: ${spreadsheet.data.sheets.length}개`);
    
    // 원본 파일 다운로드
    console.log(`📥 [로컬PC봇] 원본 엑셀 파일 다운로드 중...`);
    const tempFilePath = filePath.replace('.xlsx', '_temp.xlsx');
    
    const response = await drive.files.export({
      fileId: spreadsheetId,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }, {
      responseType: 'stream'
    });
    
    const fileStream = require('fs').createWriteStream(tempFilePath);
    await new Promise((resolve, reject) => {
      response.data.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      response.data.on('error', reject);
    });
    fileStream.close();
    
    console.log(`✅ [로컬PC봇] 원본 파일 다운로드 완료`);
    
    // 파일 크기 확인
    const stats = await fs.stat(tempFilePath);
    console.log(`📊 [로컬PC봇] 다운로드된 파일 크기: ${stats.size} bytes`);
    
    // xlsx 라이브러리를 사용하여 첫 번째 시트만 남기고 수식을 값으로 변환
    console.log(`📖 [로컬PC봇] xlsx 라이브러리로 첫 번째 시트만 추출 및 수식 변환 중...`);
    try {
      // 원본 파일 읽기 (수식 및 서식 포함)
      const workbook = XLSX.readFile(tempFilePath, {
        cellStyles: true,
        cellNF: true,
        cellHTML: false,
        cellFormula: true,
        sheetStubs: true
      });
      
      console.log(`📊 [로컬PC봇] 워크북 시트 수: ${workbook.SheetNames.length}개`);
      
      if (workbook.SheetNames.length === 0) {
        throw new Error('시트를 찾을 수 없습니다.');
      }
      
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      console.log(`📋 [로컬PC봇] 첫 번째 시트: ${firstSheetName}`);
      
      // 데이터 확인
      const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1:A1');
      console.log(`📊 [로컬PC봇] 시트 범위: ${firstSheet['!ref'] || 'A1:A1'}`);
      
      let totalDataCount = 0;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = firstSheet[cellAddress];
          if (cell && (cell.v !== undefined || cell.w !== undefined || cell.f !== undefined)) {
            totalDataCount++;
          }
        }
      }
      console.log(`📊 [로컬PC봇] 전체 데이터 확인: 총 ${totalDataCount}개 셀에 데이터 있음`);
      
      // 데이터가 없으면 원본 파일 사용
      if (totalDataCount === 0) {
        throw new Error('읽은 데이터가 없습니다. 원본 파일을 사용합니다.');
      }
      
      // 수식을 값으로 변환 (서식은 유지)
      console.log(`🔄 [로컬PC봇] 수식을 값으로 변환 중...`);
      let formulaCount = 0;
      let valuePreservedCount = 0;
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = firstSheet[cellAddress];
          
          if (cell && cell.f) {
            // 수식이 있는 경우
            formulaCount++;
            const originalFormula = cell.f;
            
            // 계산된 값 사용 (cell.v가 우선, 없으면 cell.w 사용)
            if (cell.v !== undefined) {
              // 원시 값이 있으면 사용 (서식 유지)
              delete cell.f; // 수식 제거
              valuePreservedCount++;
            } else if (cell.w !== undefined) {
              // 서식이 적용된 값이 있으면 사용
              const value = cell.w;
              delete cell.f; // 수식 제거
              cell.v = value;
              cell.t = 's'; // 문자열 타입
              valuePreservedCount++;
            } else {
              // 계산된 값이 없으면 수식 제거하고 빈 값으로 설정
              delete cell.f;
              cell.v = '';
              cell.t = 's'; // 문자열 타입
            }
          }
        }
      }
      
      console.log(`📊 [로컬PC봇] 변환된 수식 수: ${formulaCount}개, 값 보존: ${valuePreservedCount}개`);
      
      // 변환 후 데이터 재확인
      let afterTotalDataCount = 0;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = firstSheet[cellAddress];
          if (cell && (cell.v !== undefined || cell.w !== undefined)) {
            afterTotalDataCount++;
          }
        }
      }
      console.log(`📊 [로컬PC봇] 변환 후 데이터 확인: 총 ${afterTotalDataCount}개 셀에 데이터 있음`);
      
      // 데이터가 손실되었는지 확인
      if (afterTotalDataCount < totalDataCount * 0.5) {
        throw new Error(`데이터 손실 감지: ${totalDataCount}개 -> ${afterTotalDataCount}개. 원본 파일을 사용합니다.`);
      }
      
      // 첫 번째 시트만 포함된 새로운 워크북 생성
      const newWorkbook = XLSX.utils.book_new();
      
      // 워크북 레벨 서식 정보 복사 (있는 경우)
      if (workbook.SSF) {
        newWorkbook.SSF = workbook.SSF; // 공유 문자열 서식
      }
      if (workbook.Styles) {
        newWorkbook.Styles = workbook.Styles; // 스타일 정보
      }
      if (workbook.Theme) {
        newWorkbook.Theme = workbook.Theme; // 테마 정보
      }
      if (workbook.Props) {
        newWorkbook.Props = workbook.Props; // 속성 정보
      }
      
      // 시트 추가 (서식 정보 포함: 행 높이, 열 너비, 병합 등)
      const sheetCopy = JSON.parse(JSON.stringify(firstSheet));
      
      // 서식 정보 명시적으로 복사
      if (firstSheet['!rows']) {
        sheetCopy['!rows'] = firstSheet['!rows'];
      }
      if (firstSheet['!cols']) {
        sheetCopy['!cols'] = firstSheet['!cols'];
      }
      if (firstSheet['!merges']) {
        sheetCopy['!merges'] = firstSheet['!merges'];
      }
      if (firstSheet['!ref']) {
        sheetCopy['!ref'] = firstSheet['!ref'];
      }
      if (firstSheet['!margins']) {
        sheetCopy['!margins'] = firstSheet['!margins'];
      }
      if (firstSheet['!protect']) {
        sheetCopy['!protect'] = firstSheet['!protect'];
      }
      
      // 셀 스타일 정보도 복사
      for (const cellAddress in firstSheet) {
        if (cellAddress.startsWith('!')) continue; // 메타데이터는 이미 복사됨
        const cell = firstSheet[cellAddress];
        if (cell && cell.s) {
          // 셀 스타일 정보가 있으면 복사
          if (!sheetCopy[cellAddress]) {
            sheetCopy[cellAddress] = {};
          }
          sheetCopy[cellAddress].s = cell.s;
        }
      }
      
      XLSX.utils.book_append_sheet(newWorkbook, sheetCopy, firstSheetName);
      
      // 저장 전 최종 데이터 확인
      const finalSheet = newWorkbook.Sheets[firstSheetName];
      const finalRange = XLSX.utils.decode_range(finalSheet['!ref'] || 'A1:A1');
      let finalDataCount = 0;
      for (let R = finalRange.s.r; R <= finalRange.e.r; ++R) {
        for (let C = finalRange.s.c; C <= finalRange.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = finalSheet[cellAddress];
          if (cell && (cell.v !== undefined || cell.w !== undefined)) {
            finalDataCount++;
          }
        }
      }
      console.log(`📊 [로컬PC봇] 저장 전 최종 데이터 확인: ${finalDataCount}개 셀에 데이터 있음`);
      
      if (finalDataCount === 0) {
        throw new Error('저장 전 데이터가 없습니다. 원본 파일을 사용합니다.');
      }
      
      // 새로운 파일로 저장 (서식 유지 옵션 최대화)
      XLSX.writeFile(newWorkbook, filePath, {
        bookType: 'xlsx',
        bookSST: false,
        cellStyles: true,  // 셀 스타일 쓰기
        cellNF: true,      // 숫자 서식 쓰기
        compression: true // 압축 사용
      });
      
      const newStats = await fs.stat(filePath);
      console.log(`📊 [로컬PC봇] 저장된 파일 크기: ${newStats.size} bytes`);
      
      console.log(`✅ [로컬PC봇] 첫 번째 시트만 추출 및 수식 변환 완료 (데이터 유지)`);
      
    } catch (xlsxError) {
      console.error(`⚠️ [로컬PC봇] xlsx 처리 실패, 원본 파일 사용: ${xlsxError.message}`);
      // xlsx 처리 실패 시 원본 파일 그대로 사용
      await fs.copyFile(tempFilePath, filePath);
      const newStats = await fs.stat(filePath);
      console.log(`📊 [로컬PC봇] 저장된 파일 크기: ${newStats.size} bytes (원본 파일)`);
    }
    
    // 임시 파일 삭제
    await fs.unlink(tempFilePath).catch(() => {});
    
    console.log(`✅ [로컬PC봇] 엑셀 파일 생성 완료 (첫 번째 시트만): ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error(`❌ [로컬PC봇] Google Sheets API 오류:`, error.message);
    throw error;
  }
}

// 봇 준비 완료
client.once('ready', async () => {
  console.log(`✅ 디스코드 봇이 준비되었습니다: ${client.user.tag}`);
  console.log(`📡 채널 ID: ${DISCORD_CHANNEL_ID || '모든 채널'}`);
  
  // 브라우저 초기화
  await initBrowser();
});

// ===== 메시지 명령어 처리 =====
// 클라우드 서버가 보낸 명령어를 감지하고 처리
client.on('messageCreate', async (message) => {
  // 자신이 보낸 메시지는 처리하지 않음
  if (message.author.id === client.user.id) return;
  
  // 클라우드 서버 봇의 메시지만 처리
  if (message.author.bot) {
    if (DISCORD_CLOUD_BOT_ID && message.author.id !== DISCORD_CLOUD_BOT_ID) {
      return; // 클라우드 서버 봇이 아니면 무시
    } else if (!DISCORD_CLOUD_BOT_ID) {
      // 환경변수가 설정되지 않았으면 모든 봇 메시지 무시 (기존 동작)
      return;
    }
  }
  
  // 특정 채널만 처리 (설정된 경우)
  if (DISCORD_CHANNEL_ID && message.channel.id !== DISCORD_CHANNEL_ID) {
    return;
  }
  
  // ===== 명령어 감지 =====
  // 명령어 형식: !screenshot <URL> [옵션]
  // 예: !screenshot https://docs.google.com/spreadsheets/d/... policyTableName=경수일반 userName=홍길동
  if (message.content.startsWith('!screenshot ')) {
    console.log(`📥 [로컬PC봇] 명령어 수신: ${message.content.substring(0, 100)}...`);
    
    const commandText = message.content.replace('!screenshot ', '').trim();
    
    // ===== 1단계: 명령어 파싱 =====
    // URL과 옵션을 분리
    const parts = commandText.split(' ');
    const sheetUrl = parts[0];
    
    // 옵션 파싱 (key=value 형식)
    const options = {};
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('=')) {
        const [key, value] = part.split('=');
        options[key] = decodeURIComponent(value);
      }
    }
    
    const policyTableName = options.policyTableName || '정책표';
    const userName = options.userName || 'Unknown';
    const requestId = options.requestId || `LOCAL_${Date.now()}`;
    const waitTime = parseInt(options.waitTime) || 3000;
    const viewportWidth = parseInt(options.viewportWidth) || 1920;
    const viewportHeight = parseInt(options.viewportHeight) || 1080;
    const editUrl = options.editUrl || null; // 엑셀 파일 생성용 편집 링크
    
    console.log(`📋 [로컬PC봇] [${requestId}] 파싱된 정보:`);
    console.log(`   [${requestId}] URL: ${sheetUrl.substring(0, 50)}...`);
    console.log(`   [${requestId}] 정책표: ${policyTableName}`);
    console.log(`   [${requestId}] 사용자: ${userName}`);
    console.log(`   [${requestId}] 대기시간: ${waitTime}ms`);
    if (editUrl) {
      console.log(`   [${requestId}] 편집 링크: ${editUrl.substring(0, 50)}...`);
    } else {
      console.log(`   [${requestId}] 편집 링크: 없음 (스크린샷 URL 사용)`);
    }
    
    // ===== 2단계: 로딩 메시지 전송 =====
    // 클라우드 서버에 작업 시작을 알림
    const loadingMsg = await message.reply({
      content: `📸 **스크린샷 생성 중...**\n` +
               `📋 정책표: ${policyTableName}\n` +
               `👤 사용자: ${userName}\n` +
               `🔗 URL: ${sheetUrl.substring(0, 50)}...`
    });
    
    try {
      // ===== 3단계: 스크린샷 생성 =====
      // Puppeteer를 사용하여 Google Sheets를 열고 스크린샷 생성
      console.log(`🖼️ [로컬PC봇] [${requestId}] Puppeteer로 스크린샷 생성 시작...`);
      console.log(`🖼️ [로컬PC봇] [${requestId}] 정책표: ${policyTableName}, URL: ${sheetUrl.substring(0, 50)}...`);
      
      let imageBuffer;
      let retryCount = 0;
      const maxRetries = 2; // 최대 2번 재시도 (초기 시도 + 1번 재시도)
      
      while (retryCount < maxRetries) {
        try {
          imageBuffer = await captureSheetAsImage(sheetUrl, {
            waitTime: waitTime,
            viewportWidth: viewportWidth,
            viewportHeight: viewportHeight
          });
          break; // 성공하면 루프 종료
        } catch (error) {
          retryCount++;
          
          // ECONNREFUSED 에러이고 재시도 가능한 경우
          if (error.message && error.message.includes('ECONNREFUSED') && retryCount < maxRetries) {
            console.log(`🔄 [로컬PC봇] [${requestId}] 브라우저 연결 실패, 재시도 ${retryCount}/${maxRetries - 1}...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
            continue;
          }
          
          // 재시도 불가능하거나 다른 에러인 경우 throw
          throw error;
        }
      }
      
      console.log(`✅ [로컬PC봇] [${requestId}] 스크린샷 생성 완료 (크기: ${imageBuffer.length} bytes)`);
      console.log(`✅ [로컬PC봇] [${requestId}] 정책표: ${policyTableName}`);
      
      // ===== 4단계: 이미지를 디스코드에 업로드 =====
      // 생성한 이미지를 디스코드 채널에 업로드
      // 클라우드 서버가 이 이미지 URL을 추출하여 사용
      const embed = new EmbedBuilder()
        .setTitle('✅ 스크린샷 생성 완료')
        .setDescription(`**정책표**: ${policyTableName}\n**생성자**: ${userName}`)
        .setColor(0x00FF00)
        .setTimestamp();
      
      const imageMessage = await loadingMsg.edit({
        content: '',
        embeds: [embed],
        files: [{
          attachment: imageBuffer,
          name: `정책표_${policyTableName}_${Date.now()}.png`
        }]
      });
      
      console.log(`📤 [로컬PC봇] 이미지 디스코드 업로드 완료 (메시지 ID: ${imageMessage.id})`);
      
      // ===== 엑셀 파일 생성 =====
      let excelMessageId = null;
      let excelBuffer = null;

      try {
        console.log(`📊 [로컬PC봇] [${requestId}] 엑셀 파일 생성 시작...`);
        
        // excel 디렉토리 생성 (없으면)
        try {
          await fs.access('./excel');
        } catch {
          await fs.mkdir('./excel', { recursive: true });
        }
        
        // 엑셀 파일 생성용 URL 결정 (편집 링크 우선 사용)
        const excelUrl = editUrl || sheetUrl;
        console.log(`🔍 [로컬PC봇] [${requestId}] 스크린샷용 URL: ${sheetUrl}`);
        console.log(`🔍 [로컬PC봇] [${requestId}] 엑셀용 URL: ${excelUrl}${editUrl ? ' (편집 링크 사용)' : ' (스크린샷 URL 사용)'}`);
        
        // URL에서 spreadsheetId 추출 (더 robust한 방식)
        let spreadsheetId = null;
        
        // 방법 1: 일반 형식 /spreadsheets/d/{ID}/
        const normalMatch = excelUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{44})/);
        if (normalMatch) {
          spreadsheetId = normalMatch[1];
          console.log(`✅ [로컬PC봇] [${requestId}] 일반 형식으로 추출: ${spreadsheetId}`);
        } else {
          // 방법 2: 2PACX 형식 /spreadsheets/d/e/2PACX-1v.../
          const pacxMatch = excelUrl.match(/\/spreadsheets\/d\/e\/(2PACX-1v[^\/]+)/);
          if (pacxMatch) {
            // 2PACX 형식은 실제 spreadsheetId를 찾기 어려우므로 편집 링크 필요
            if (!editUrl) {
              console.error(`❌ [로컬PC봇] [${requestId}] 2PACX 형식 URL인데 편집 링크(editUrl)가 전달되지 않았습니다.`);
              console.error(`❌ [로컬PC봇] [${requestId}] 서버에서 편집 링크를 전송하도록 수정이 필요합니다.`);
              throw new Error('2PACX 형식의 URL은 편집 링크가 필요합니다. 서버에서 editUrl 파라미터를 전송해야 합니다.');
            } else {
              // 편집 링크가 있으면 편집 링크에서 spreadsheetId 추출 시도
              console.log(`🔄 [로컬PC봇] [${requestId}] 2PACX 형식 감지, 편집 링크에서 spreadsheetId 추출 시도: ${editUrl.substring(0, 50)}...`);
              const editIdMatch = editUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{44})/);
              if (editIdMatch) {
                spreadsheetId = editIdMatch[1];
                console.log(`✅ [로컬PC봇] [${requestId}] 편집 링크에서 추출: ${spreadsheetId}`);
              } else {
                throw new Error('편집 링크에서도 spreadsheetId를 추출할 수 없습니다.');
              }
            }
          } else {
            // 방법 3: pubhtml 형식에서도 시도
            const pubhtmlMatch = excelUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/pubhtml/);
            if (pubhtmlMatch) {
              spreadsheetId = pubhtmlMatch[1];
              console.log(`✅ [로컬PC봇] [${requestId}] pubhtml 형식으로 추출: ${spreadsheetId}`);
            } else {
              // 방법 4: edit 형식 /spreadsheets/d/{ID}/edit
              const editMatch = excelUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/edit/);
              if (editMatch) {
                spreadsheetId = editMatch[1];
                console.log(`✅ [로컬PC봇] [${requestId}] edit 형식으로 추출: ${spreadsheetId}`);
              }
            }
          }
        }
        
        if (!spreadsheetId) {
          console.error(`❌ [로컬PC봇] [${requestId}] URL 형식을 인식할 수 없습니다: ${excelUrl}`);
          throw new Error('Google Sheets URL에서 spreadsheetId를 추출할 수 없습니다. 편집 링크 형식인지 확인해주세요.');
        }
        
        console.log(`📋 [로컬PC봇] [${requestId}] 추출된 spreadsheetId: ${spreadsheetId}`);
        
        // 파일명 생성 (Windows에서 사용 불가능한 문자 제거)
        const safeName = policyTableName
          .replace(/[<>:"/\\|?*]/g, '_')
          .replace(/\s+/g, '_');
        const excelFilename = `${safeName}_${Date.now()}.xlsx`;
        const excelPath = path.join('./excel', excelFilename);
        
        // 엑셀 파일 다운로드 (Google Sheets API 사용)
        let downloadSuccess = false;
        
        try {
          // Google Sheets API 사용 (서비스 계정 권한 필요)
          console.log(`🔐 [로컬PC봇] [${requestId}] 서비스 계정으로 접근 시도: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'NOT SET'}`);
          await downloadExcelWithAPI(spreadsheetId, excelPath);
          await fs.access(excelPath);
          downloadSuccess = true;
          console.log(`✅ [로컬PC봇] [${requestId}] Google Sheets API로 엑셀 다운로드 완료`);
        } catch (apiError) {
          console.error(`❌ [로컬PC봇] [${requestId}] Google Sheets API 실패: ${apiError.message}`);
          console.error(`📋 [로컬PC봇] [${requestId}] spreadsheetId: ${spreadsheetId}`);
          console.error(`⚠️ [로컬PC봇] [${requestId}] 서비스 계정(${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'NOT SET'})이 해당 시트(${spreadsheetId})에 접근 권한이 있는지 확인하세요.`);
          console.error(`💡 [로컬PC봇] [${requestId}] 해결 방법: Google Sheets에서 "공유" 버튼 클릭 → 서비스 계정 이메일 추가 → "뷰어" 권한 부여`);
          // API 실패 시 엑셀 파일 생성 실패로 처리 (이미지는 정상)
        }
        
        if (downloadSuccess) {
          // 파일을 버퍼로 읽기
          excelBuffer = await fs.readFile(excelPath);
          
          // 엑셀 파일을 디스코드에 업로드
          const excelAttachment = new AttachmentBuilder(excelBuffer, {
            name: `${safeName}.xlsx`
          });
          
          const excelMessage = await message.channel.send({
            content: `📊 **엑셀 파일**`,
            files: [excelAttachment]
          });
          
          excelMessageId = excelMessage.id;
          console.log(`📤 [로컬PC봇] [${requestId}] 엑셀 파일 디스코드 업로드 완료 (메시지 ID: ${excelMessageId})`);
          
          // 임시 파일 삭제
          await fs.unlink(excelPath).catch(() => {});
        } else {
          console.warn(`⚠️ [로컬PC봇] [${requestId}] 엑셀 파일 생성 실패 (이미지는 정상 생성됨)`);
        }
      } catch (excelError) {
        console.error(`❌ [로컬PC봇] [${requestId}] 엑셀 파일 생성 오류:`, excelError);
        // 엑셀 파일 생성 실패해도 이미지는 정상이므로 계속 진행
      }
      
      // ===== 5단계: 클라우드 서버에 완료 신호 전송 =====
      // 클라우드 서버 봇이 이 신호를 감지하고 이미지 URL을 추출
      const commandMessageId = message.id; // 원본 명령어 메시지 ID
      let completeSignal = `!screenshot-complete commandId=${commandMessageId} imageId=${imageMessage.id}`;
      if (excelMessageId) {
        completeSignal += ` excelId=${excelMessageId}`;
      }
      await message.channel.send(completeSignal);
      console.log(`📡 [로컬PC봇] 완료 신호 전송: ${completeSignal}`);
      
      console.log(`✅ [로컬PC봇] 전체 작업 완료: ${policyTableName} (${userName})`);
      
    } catch (error) {
      console.error('❌ [로컬PC봇] 스크린샷 생성 오류:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ 스크린샷 생성 실패')
        .setDescription(`오류: ${error.message}`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await loadingMsg.edit({
        content: '',
        embeds: [errorEmbed]
      });
    }
  }
  
  // 헬스 체크 명령어
  if (message.content === '!health') {
    const embed = new EmbedBuilder()
      .setTitle('🤖 봇 상태')
      .setDescription('✅ 정상 작동 중')
      .addFields(
        { name: '브라우저', value: browser ? '✅ 준비됨' : '❌ 준비 안 됨', inline: true },
        { name: '채널', value: message.channel.name, inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
});

// 에러 처리
client.on('error', (error) => {
  console.error('❌ 디스코드 봇 오류:', error);
});

// 프로세스 종료 시 브라우저 종료
process.on('SIGINT', async () => {
  console.log('\n🛑 봇 종료 중...');
  await closeBrowser();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 봇 종료 중 (SIGTERM)...');
  await closeBrowser();
  client.destroy();
  process.exit(0);
});

// PM2 재시작 시 브라우저 정리
process.on('beforeExit', async () => {
  console.log('🔄 프로세스 종료 전 브라우저 정리...');
  await closeBrowser();
});

// 봇 로그인
client.login(DISCORD_BOT_TOKEN).catch(error => {
  console.error('❌ 디스코드 봇 로그인 실패:', error);
  process.exit(1);
});

