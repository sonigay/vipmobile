require('dotenv').config();
const { google } = require('googleapis');
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
const JSZip = require('jszip');
const xml2js = require('xml2js');

// Discord 봇 설정
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_MEETING_CHANNEL_ID = process.env.DISCORD_MEETING_CHANNEL_ID || '1438813568374931578';
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

// Discord 봇 초기화
let discordBot = null;
if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
  discordBot = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  
  discordBot.once('ready', () => {
    console.log(`✅ [회의] Discord 봇이 준비되었습니다: ${discordBot.user.tag}`);
  });
  
  discordBot.login(DISCORD_BOT_TOKEN)
    .then(() => console.log('✅ [회의] Discord 봇 로그인 성공'))
    .catch(error => console.error('❌ [회의] Discord 봇 로그인 실패:', error));
}

// Google Sheets 클라이언트 생성
function createSheetsClient() {
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  // MEETING_SHEET_ID가 있으면 사용, 없으면 기본 SHEET_ID 사용
  const SPREADSHEET_ID = process.env.MEETING_SHEET_ID || process.env.SHEET_ID;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
    throw new Error('Missing Google Sheets environment variables');
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, SPREADSHEET_ID };
}

// Google Sheets API 재시도 헬퍼 함수
async function retrySheetsOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isQuotaError = error.code === 429 || 
        (error.message && error.message.includes('Quota exceeded')) ||
        (error.response && error.response.status === 429);
      
      if (isQuotaError && attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`⚠️ [Sheets API] 할당량 초과, ${waitTime}ms 후 재시도 (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

// 시트 헤더 확인 및 생성
async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  try {
    // 시트 존재 여부 확인 (재시도 포함)
    const spreadsheet = await retrySheetsOperation(async () => {
      return await sheets.spreadsheets.get({ spreadsheetId });
    });

    const sheetExists = spreadsheet.data.sheets.some(sheet => sheet.properties.title === sheetName);

    if (!sheetExists) {
      // 시트 생성 (재시도 포함)
      await retrySheetsOperation(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
      });
    }

    // 헤더 확인 및 설정 (재시도 포함)
    const headerRange = `${sheetName}!A2:${String.fromCharCode(64 + headers.length)}2`;
    const headerResponse = await retrySheetsOperation(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: headerRange
      });
    });

    const existingHeaders = headerResponse.data.values?.[0] || [];
    if (existingHeaders.length === 0 || existingHeaders.join('|') !== headers.join('|')) {
      // 헤더 설정 (1행은 비우고 2행에 헤더, 재시도 포함)
      await retrySheetsOperation(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: headerRange,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [headers]
          }
        });
      });
    }
  } catch (error) {
    console.error(`시트 헤더 확인 오류 (${sheetName}):`, error);
    throw error;
  }
}

// 회의 ID 생성
function generateMeetingId(meetingDate, meetingNumber) {
  const dateStr = meetingDate.replace(/-/g, '');
  return `meeting-${dateStr}-${String(meetingNumber).padStart(3, '0')}`;
}

// 회의 목록 조회
async function getMeetings(req, res) {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const sheetName = '회의목록';

    // 시트 헤더 확인
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '회의이름', '회의날짜', '차수', '생성자', '생성일시', '상태', '회의장소', '참석자'
    ]);

    // 데이터 조회 (3행부터)
    const range = `${sheetName}!A3:I`;
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range
      });
    } catch (rangeError) {
      // 범위에 데이터가 없을 수 있음 (정상적인 경우)
      console.log('회의 목록 범위 조회 결과 없음 (정상):', rangeError.message);
      return res.json({ success: true, meetings: [] });
    }

    const rows = response.data.values || [];
    const meetings = rows
      .filter(row => row && row[0] && row[0].trim()) // 회의ID가 있는 행만
      .map(row => ({
        meetingId: row[0],
        meetingName: row[1] || '',
        meetingDate: row[2] || '',
        meetingNumber: parseInt(row[3]) || 0,
        createdBy: row[4] || '',
        createdAt: row[5] || '',
        status: row[6] || 'preparing',
        meetingLocation: row[7] || '',
        participants: row[8] || ''
      }))
      .sort((a, b) => {
        // 날짜 내림차순, 차수 내림차순
        if (a.meetingDate !== b.meetingDate) {
          return b.meetingDate.localeCompare(a.meetingDate);
        }
        return b.meetingNumber - a.meetingNumber;
      });

    res.json({ success: true, meetings });
  } catch (error) {
    console.error('회의 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 회의 생성
async function createMeeting(req, res) {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const sheetName = '회의목록';
    const { meetingName, meetingDate, meetingNumber, meetingLocation, participants, createdBy } = req.body;

    // 필수 필드 검증
    if (!meetingName || !meetingDate || !meetingNumber || !createdBy) {
      return res.status(400).json({ 
        success: false, 
        error: '필수 필드가 누락되었습니다.' 
      });
    }

    // 시트 헤더 확인
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '회의이름', '회의날짜', '차수', '생성자', '생성일시', '상태', '회의장소', '참석자'
    ]);

    // 차수 중복 확인
    const range = `${sheetName}!A3:I`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range
    });

    const rows = response.data.values || [];
    const duplicate = rows.find(row => 
      row[2] === meetingDate && parseInt(row[3]) === parseInt(meetingNumber)
    );

    if (duplicate) {
      return res.status(400).json({ 
        success: false, 
        error: `해당 날짜(${meetingDate})에 차수 ${meetingNumber}가 이미 존재합니다.` 
      });
    }

    // 회의 ID 생성
    const meetingId = generateMeetingId(meetingDate, meetingNumber);
    const createdAt = new Date().toISOString();

    // 데이터 추가 (3행부터)
    const newRow = [
      meetingId,
      meetingName,
      meetingDate,
      meetingNumber,
      createdBy,
      createdAt,
      'preparing',
      meetingLocation || '',
      participants || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A3`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow]
      }
    });

    res.json({ 
      success: true, 
      meeting: {
        meetingId,
        meetingName,
        meetingDate,
        meetingNumber,
        createdBy,
        createdAt,
        status: 'preparing'
      }
    });
  } catch (error) {
    console.error('회의 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 회의 수정
async function updateMeeting(req, res) {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const sheetName = '회의목록';
    const { meetingId } = req.params;
    const { meetingName, meetingDate, meetingNumber, meetingLocation, participants, status } = req.body;

    // 시트 헤더 확인 (회의장소, 참석자 컬럼 포함)
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '회의이름', '회의날짜', '차수', '생성자', '생성일시', '상태', '회의장소', '참석자'
    ]);

    // 데이터 조회
    const range = `${sheetName}!A3:I`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === meetingId);

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' });
    }

    // 차수 중복 확인 (자신 제외, meetingDate와 meetingNumber가 변경되는 경우만)
    if (meetingDate && meetingNumber && (meetingDate !== rows[rowIndex][2] || parseInt(meetingNumber) !== parseInt(rows[rowIndex][3]))) {
      const duplicate = rows.find((row, idx) => 
        idx !== rowIndex && row[2] === meetingDate && parseInt(row[3]) === parseInt(meetingNumber)
      );

      if (duplicate) {
        return res.status(400).json({ 
          success: false, 
          error: `해당 날짜(${meetingDate})에 차수 ${meetingNumber}가 이미 존재합니다.` 
        });
      }
    }

    // 데이터 업데이트 (배열 길이 보장)
    const updateRow = [...rows[rowIndex]];
    // 배열 길이가 9 미만이면 확장 (회의장소, 참석자 포함)
    while (updateRow.length < 9) {
      updateRow.push('');
    }
    if (meetingName !== undefined) updateRow[1] = meetingName;
    if (meetingDate !== undefined) updateRow[2] = meetingDate;
    if (meetingNumber !== undefined) updateRow[3] = meetingNumber;
    if (status !== undefined) updateRow[6] = status; // 상태 업데이트 (인덱스 6)
    if (meetingLocation !== undefined) updateRow[7] = meetingLocation;
    if (participants !== undefined) updateRow[8] = participants;
    
    console.log(`🔄 [updateMeeting] 회의 상태 업데이트: ${meetingId} -> ${status}`);
    console.log(`🔄 [updateMeeting] 업데이트할 행:`, updateRow);

    const updateRange = `${sheetName}!A${rowIndex + 3}:I${rowIndex + 3}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [updateRow]
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('회의 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 회의 삭제
async function deleteMeeting(req, res) {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const sheetName = '회의목록';
    const { meetingId } = req.params;

    // 데이터 조회
    const range = `${sheetName}!A3:G`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === meetingId);

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '회의를 찾을 수 없습니다.' });
    }

    // 행 삭제
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }))
                .data.sheets.find(s => s.properties.title === sheetName).properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 2, // 1행(빈 행) + 1행(헤더) + rowIndex
              endIndex: rowIndex + 3
            }
          }
        }]
      }
    });

    // 회의설정 시트에서도 해당 회의 데이터 삭제
    const configSheetName = '회의설정';
    const configRange = `${configSheetName}!A3:M`;
    const configResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: configRange
    });

    const configRows = configResponse.data.values || [];
    const configRowIndices = configRows
      .map((row, idx) => row[0] === meetingId ? idx : -1)
      .filter(idx => idx !== -1)
      .reverse(); // 역순으로 삭제 (인덱스 변경 방지)

    if (configRowIndices.length > 0) {
      const configSheetId = (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }))
        .data.sheets.find(s => s.properties.title === configSheetName).properties.sheetId;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: configRowIndices.map(rowIndex => ({
            deleteDimension: {
              range: {
                sheetId: configSheetId,
                dimension: 'ROWS',
                startIndex: rowIndex + 2,
                endIndex: rowIndex + 3
              }
            }
          }))
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('회의 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// CORS 헤더 설정 헬퍼 함수
function setCORSHeaders(req, res) {
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [];
  const defaultOrigins = [
    'https://vipmobile.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000'
  ];
  const allowedOrigins = [...corsOrigins, ...defaultOrigins];
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length > 0) {
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
}

// 회의 설정 조회
async function getMeetingConfig(req, res) {
  try {
    // CORS 헤더 설정
    setCORSHeaders(req, res);
    
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const { meetingId } = req.params;
    const sheetName = '회의설정';

    // 시트 헤더 확인 (tabLabel, subTabLabel, 세부항목옵션 컬럼 추가)
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '슬라이드ID', '순서', '타입', '모드', '탭', '제목', '내용', '배경색', '이미지URL', '캡처시간', 'Discord포스트ID', 'Discord스레드ID', '탭라벨', '서브탭라벨', '세부항목옵션', '회의날짜', '회의차수', '회의장소', '참석자', '생성자'
    ]);

    // 데이터 조회 (tabLabel, subTabLabel, 세부항목옵션 컬럼 포함)
    const range = `${sheetName}!A3:U`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range
    });

    const rows = response.data.values || [];
    console.log(`📖 [getMeetingConfig] 회의ID ${meetingId}의 전체 행 수: ${rows.length}`);
    
    const filteredRows = rows.filter(row => row[0] === meetingId);
    console.log(`📖 [getMeetingConfig] 필터링된 행 수: ${filteredRows.length}`);
    
    const slides = filteredRows
      .map((row, idx) => {
        const tabValue = row[5] || '';
        // tab/subTab 형식으로 저장된 경우 파싱
        const [tab, subTab] = tabValue.includes('/') ? tabValue.split('/') : [tabValue, ''];
        
        const slide = {
          slideId: row[1] || '',
          order: parseInt(row[2]) || 0,
          type: row[3] || 'mode-tab',
          mode: row[4] || '',
          tab: tab || '',
          subTab: subTab || '',
          tabLabel: row[13] || '', // 탭라벨
          subTabLabel: row[14] || '', // 서브탭라벨
          detailLabel: row[15] || '', // 세부항목옵션
          title: row[6] || '',
          content: row[7] || '',
          backgroundColor: row[8] || '#ffffff',
          imageUrl: row[9] || '',
          capturedAt: row[10] || '',
          discordPostId: row[11] || '',
          discordThreadId: row[12] || '',
          // 메인 슬라이드 필드 (있으면 사용) - 인덱스 조정 필요
          meetingDate: row[16] || '',
          meetingNumber: row[17] ? parseInt(row[17]) : undefined,
          meetingLocation: row[18] || '',
          participants: row[19] || '',
          createdBy: row[20] || ''
        };
        
        console.log(`📖 [getMeetingConfig] 슬라이드 ${idx + 1}:`, {
          slideId: slide.slideId,
          order: slide.order,
          type: slide.type,
          mode: slide.mode,
          tab: slide.tab,
          subTab: slide.subTab,
          imageUrl: slide.imageUrl || '없음',
          hasImageUrl: !!slide.imageUrl
        });
        
        return slide;
      })
      .sort((a, b) => a.order - b.order);
    
    // 목차 슬라이드가 있으면 modeGroups 재구성
    const tocSlideIndex = slides.findIndex(s => s.type === 'toc');
    if (tocSlideIndex !== -1) {
      const tocSlide = slides[tocSlideIndex];
      const modeGroups = {};
      
      // 모든 슬라이드를 순회하며 모드별로 그룹화
      slides.forEach(slide => {
        if (slide.type === 'mode-tab' && slide.mode) {
          const modeKey = slide.mode;
          if (!modeGroups[modeKey]) {
            modeGroups[modeKey] = [];
          }
          modeGroups[modeKey].push(slide);
        } else if (slide.type === 'mode-only' && slide.mode) {
          const modeKey = slide.mode;
          if (!modeGroups[modeKey]) {
            modeGroups[modeKey] = [];
          }
          modeGroups[modeKey].push(slide);
        } else if (slide.type === 'custom') {
          if (!modeGroups['custom']) {
            modeGroups['custom'] = [];
          }
          modeGroups['custom'].push(slide);
        }
      });
      
      // 목차 슬라이드에 modeGroups 추가
      tocSlide.modeGroups = modeGroups;
      slides[tocSlideIndex] = tocSlide;
      
      console.log(`📖 [getMeetingConfig] 목차 슬라이드 modeGroups 재구성 완료:`, {
        modeCount: Object.keys(modeGroups).length,
        customCount: modeGroups['custom']?.length || 0
      });
    }

    console.log(`📖 [getMeetingConfig] 최종 슬라이드 수: ${slides.length}, 이미지 URL이 있는 슬라이드: ${slides.filter(s => s.imageUrl).length}`);
    res.json({ success: true, slides });
  } catch (error) {
    console.error('회의 설정 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 회의 설정 저장
async function saveMeetingConfig(req, res) {
  try {
    // CORS 헤더 설정
    setCORSHeaders(req, res);
    
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const { meetingId } = req.params;
    const { slides } = req.body;
    const sheetName = '회의설정';

    if (!Array.isArray(slides)) {
      return res.status(400).json({ success: false, error: '슬라이드 배열이 필요합니다.' });
    }

    // 시트 헤더 확인 (tabLabel, subTabLabel, 세부항목옵션 컬럼 추가)
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '슬라이드ID', '순서', '타입', '모드', '탭', '제목', '내용', '배경색', '이미지URL', '캡처시간', 'Discord포스트ID', 'Discord스레드ID', '탭라벨', '서브탭라벨', '세부항목옵션', '회의날짜', '회의차수', '회의장소', '참석자', '생성자'
    ]);

    // 기존 데이터 조회 (메인 슬라이드 필드 및 tabLabel, subTabLabel, 세부항목옵션 포함, 재시도 포함)
    const range = `${sheetName}!A3:U`;
    const response = await retrySheetsOperation(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range
      });
    });

    const existingRows = response.data.values || [];
    console.log(`📋 [saveMeetingConfig] 기존 행 수: ${existingRows.length}, 저장할 슬라이드 수: ${slides.length}`);
    
    // 각 슬라이드를 개별적으로 업데이트 또는 추가
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      
      // 필수 필드 검증
      if (!slide || typeof slide !== 'object') {
        console.error(`❌ [saveMeetingConfig] 슬라이드 ${i + 1}이 유효하지 않습니다.`, slide);
        continue;
      }
      
      // slideId 생성 (유효성 검증 포함)
      const slideId = slide.slideId || slide.id || `slide-${slide.order || i + 1}`;
      if (!slideId || typeof slideId !== 'string') {
        console.error(`❌ [saveMeetingConfig] 슬라이드 ${i + 1}의 slideId가 유효하지 않습니다.`, slide);
        continue;
      }
      
      // order 검증 및 정규화
      const order = typeof slide.order === 'number' && slide.order >= 0 
        ? slide.order 
        : (typeof slide.order === 'string' && !isNaN(parseInt(slide.order)))
          ? parseInt(slide.order)
          : i + 1;
      
      console.log(`\n🔄 [saveMeetingConfig] 슬라이드 ${i + 1}/${slides.length} 처리 시작:`, {
        slideId,
        order,
        mode: slide.mode || '',
        tab: slide.tab || '',
        subTab: slide.subTab || '',
        imageUrl: slide.imageUrl || '없음',
        discordPostId: slide.discordPostId || '없음',
        discordThreadId: slide.discordThreadId || '없음'
      });
      
      // 기존 슬라이드 찾기: slideId로 먼저 찾고, 없으면 mode/tab/subTab/order로 찾기
      let existingRowIndex = existingRows.findIndex((row, idx) => 
        row[0] === meetingId && row[1] === slideId
      );
      
      console.log(`🔍 [saveMeetingConfig] slideId로 찾기 결과: ${existingRowIndex !== -1 ? `찾음 (행 ${existingRowIndex + 3})` : '없음'}`);
      
      // slideId로 찾지 못한 경우 mode/tab/subTab/order로 찾기
      if (existingRowIndex === -1) {
        const tabValue = slide.subTab ? `${slide.tab || ''}/${slide.subTab}` : (slide.tab || '');
        existingRowIndex = existingRows.findIndex((row, idx) => {
          if (row[0] !== meetingId) return false;
          // mode, tab, order가 모두 일치하는지 확인 (subTab은 tab 필드에 포함됨)
          const rowMode = row[4] || '';
          const rowTab = row[5] || '';
          const rowOrder = parseInt(row[2] || 0);
          
          const matches = rowMode === (slide.mode || '') && 
                 rowTab === tabValue && 
                 rowOrder === (slide.order || 0);
          
          if (matches) {
            console.log(`🔍 [saveMeetingConfig] mode/tab/order로 찾음 (행 ${idx + 3}):`, {
              rowMode,
              rowTab,
              rowOrder,
              slideMode: slide.mode,
              slideTab: tabValue,
              slideOrder: slide.order
            });
          }
          
          return matches;
        });
        
        if (existingRowIndex !== -1) {
          console.log(`✅ [saveMeetingConfig] mode/tab/order로 찾기 성공: 행 ${existingRowIndex + 3}`);
        } else {
          console.log(`❌ [saveMeetingConfig] mode/tab/order로도 찾지 못함, 새로 추가`);
        }
      }

      // subTab이 있으면 tab 필드에 tab/subTab 형식으로 저장
      const tabValue = slide.subTab ? `${slide.tab || ''}/${slide.subTab}` : (slide.tab || '');
      
      // 메인 슬라이드의 경우 추가 필드 포함 (tabLabel, subTabLabel, 세부항목옵션 추가)
      // 타입 검증 및 정규화
      const slideType = typeof slide.type === 'string' ? slide.type : 'mode-tab';
      const slideMode = typeof slide.mode === 'string' ? slide.mode : '';

      // 기존 행이 있는 경우, imageUrl/캡처시간/Discord ID가 비어 있으면 기존 값을 보존
      const existingRow = existingRowIndex !== -1 ? existingRows[existingRowIndex] : null;
      const existingImageUrl = existingRow ? (existingRow[9] || '') : '';
      const existingCapturedAt = existingRow ? (existingRow[10] || '') : '';
      const existingDiscordPostId = existingRow ? (existingRow[11] || '') : '';
      const existingDiscordThreadId = existingRow ? (existingRow[12] || '') : '';

      const incomingImageUrl = slide.imageUrl && slide.imageUrl !== '없음' ? slide.imageUrl : '';
      const incomingCapturedAt = slide.capturedAt || '';
      const incomingDiscordPostId = slide.discordPostId && slide.discordPostId !== '없음' ? slide.discordPostId : '';
      const incomingDiscordThreadId = slide.discordThreadId && slide.discordThreadId !== '없음' ? slide.discordThreadId : '';

      const mergedImageUrl =
        incomingImageUrl ||
        (existingImageUrl && existingImageUrl !== '없음' ? existingImageUrl : '');
      const mergedCapturedAt = incomingCapturedAt || existingCapturedAt;
      const mergedDiscordPostId =
        incomingDiscordPostId ||
        (existingDiscordPostId && existingDiscordPostId !== '없음' ? existingDiscordPostId : '');
      const mergedDiscordThreadId =
        incomingDiscordThreadId ||
        (existingDiscordThreadId && existingDiscordThreadId !== '없음' ? existingDiscordThreadId : '');
      
      const newRow = [
        meetingId,
        slideId,
        order,
        slideType,
        slideMode,
        tabValue,
        slide.title || '',
        slide.content || '',
        slide.backgroundColor || '#ffffff',
        mergedImageUrl,
        mergedCapturedAt,
        mergedDiscordPostId,
        mergedDiscordThreadId,
        slide.tabLabel || '', // 탭라벨
        slide.subTabLabel || '', // 서브탭라벨
        slide.detailLabel || '', // 세부항목옵션 (예: "코드별 실적", "사무실별 실적" 등)
        slide.meetingDate || '', // 메인 슬라이드용
        slide.meetingNumber || '', // 메인 슬라이드용
        slide.meetingLocation || '', // 메인 슬라이드용
        slide.participants || '', // 메인 슬라이드용
        slide.createdBy || '' // 메인 슬라이드용
      ];

      if (existingRowIndex !== -1) {
        // 기존 슬라이드 업데이트 (메인 슬라이드 필드 및 tabLabel, subTabLabel, 세부항목옵션 포함, 재시도 포함)
        const updateRange = `${sheetName}!A${existingRowIndex + 3}:U${existingRowIndex + 3}`;
        console.log(`📝 [saveMeetingConfig] 기존 슬라이드 업데이트 시작: 범위 ${updateRange}`);
        const updateResult = await retrySheetsOperation(async () => {
          return await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [newRow]
            }
          });
        });
        console.log(`✅ [saveMeetingConfig] 업데이트 완료:`, {
          updatedCells: updateResult.data.updatedCells,
          updatedRange: updateResult.data.updatedRange,
          imageUrl: slide.imageUrl || '없음'
        });
        // 기존 행 데이터도 업데이트 (다음 반복을 위해)
        existingRows[existingRowIndex] = newRow;
      } else {
        // 새 슬라이드 추가 (재시도 포함)
        console.log(`📝 [saveMeetingConfig] 새 슬라이드 추가 시작`);
        const appendResult = await retrySheetsOperation(async () => {
          return await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A3`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [newRow]
            }
          });
        });
        console.log(`✅ [saveMeetingConfig] 추가 완료:`, {
          updatedCells: appendResult.data.updates?.updatedCells,
          updatedRange: appendResult.data.updates?.updatedRange,
          imageUrl: slide.imageUrl || '없음'
        });
        // 기존 행 목록에도 추가 (다음 반복을 위해)
        existingRows.push(newRow);
      }
      
      // 각 슬라이드 저장 후 약간의 지연 (Google Sheets API rate limit 방지)
      if (i < slides.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 200ms -> 500ms로 증가
      }
    }
    
    console.log(`\n✅ [saveMeetingConfig] 모든 슬라이드 저장 완료 (${slides.length}개)`);

    // 회의 날짜와 차수 추출 후 준비중 스레드 rename 시도
    try {
      const mainSlide = slides.find(s => s.type === 'main') || {};
      const meetingDate = mainSlide.meetingDate || req.body.meetingDate || new Date().toISOString().split('T')[0];
      const meetingNumber = mainSlide.meetingNumber || req.body.meetingNumber;
      const yearMonth = meetingDate.substring(0, 7);
      if (meetingNumber) {
        await renamePreparedPostToNumber(yearMonth, meetingNumber);
      } else {
        console.log('ℹ️ [saveMeetingConfig] meetingNumber가 없어 스레드 rename을 건너뜁니다.');
      }
    } catch (renameErr) {
      console.warn('⚠️ [saveMeetingConfig] 준비중 스레드 rename 중 오류:', renameErr.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('회의 설정 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Discord 포럼 게시판에서 년월별 포스트 찾기 또는 생성 (차수별, 모드 라벨 구분)
async function findOrCreatePost(channel, yearMonth, meetingNumber, modeLabel) {
  try {
    // 포스트 이름 생성
    // 예: "2025-11 회의 - 1차(어플모드)" 또는 "2025-11 회의 - 1차(커스텀)"
    const suffix = modeLabel ? `(${modeLabel})` : '';
    const baseWithNumber = meetingNumber ? `${yearMonth} 회의 - ${meetingNumber}차` : `${yearMonth} 회의 - 준비중`;
    const postName = `${baseWithNumber}${suffix}`;
    
    console.log(`🔍 [findOrCreatePost] 포스트 찾기 시작:`, {
      yearMonth,
      meetingNumber,
      postName
    });
    
    // 포럼 채널의 활성 포스트 가져오기
    const activeThreads = await channel.threads.fetchActive();
    
    // 활성 스레드에서 차수별 포스트 찾기
    // meetingNumber가 있으면 정확히 일치하는 포스트를 찾고, 없으면 yearMonth만 일치하는 포스트를 찾음
    let post = null;
    
    if (meetingNumber) {
      // meetingNumber가 있으면 정확히 일치하는 포스트를 찾음
      // 여러 패턴으로 매칭 시도
      post = Array.from(activeThreads.threads.values()).find(thread => {
        const threadName = thread.name;
        const matches = 
          // 새 포맷(모드 라벨 포함) 또는 구 포맷(모드 라벨 없이)
          threadName === postName ||
          threadName === `${baseWithNumber}` ||
          threadName === `${baseWithNumber}(어플모드)` ||
          threadName === `${baseWithNumber}(커스텀)` ||
          (threadName.includes(`${yearMonth} 회의`) && threadName.includes(`${meetingNumber}차`));
        if (matches) {
          console.log(`✅ [findOrCreatePost] 활성 포스트 찾음 (차수 일치): ${threadName} (ID: ${thread.id})`);
        }
        return matches;
      });
    } else {
      // meetingNumber가 없으면 yearMonth만 일치하는 포스트를 찾음 (가장 최근 것)
      // 여러 개가 있을 수 있으므로 가장 최근 것을 선택
      const matchingThreads = Array.from(activeThreads.threads.values())
        .filter(thread => thread.name.startsWith(`${yearMonth} 회의`))
        .sort((a, b) => {
          // 생성 시간으로 정렬 (최신순)
          return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
        });
      
      if (matchingThreads.length > 0) {
        post = matchingThreads[0];
        console.log(`✅ [findOrCreatePost] 활성 포스트 찾음 (년월 일치, 차수 없음, 가장 최근): ${post.name} (ID: ${post.id})`);
      }
    }
    
    if (post) {
      console.log(`📌 [Discord] 기존 포스트 찾음: ${post.name} (ID: ${post.id})`);
      return post;
    }
    
    // 아카이브된 스레드도 확인
    if (!post) {
      try {
        const archivedThreads = await channel.threads.fetchArchived({ limit: 100 });
        
        if (meetingNumber) {
          // meetingNumber가 있으면 정확히 일치하는 포스트를 찾음
          // 여러 패턴으로 매칭 시도
          post = Array.from(archivedThreads.threads.values()).find(thread => {
            const threadName = thread.name;
            const matches = 
              threadName === postName || 
              threadName === `${baseWithNumber}` ||
              threadName === `${baseWithNumber}(어플모드)` ||
              threadName === `${baseWithNumber}(커스텀)` ||
              (threadName.includes(`${yearMonth} 회의`) && threadName.includes(`${meetingNumber}차`));
            if (matches) {
              console.log(`✅ [findOrCreatePost] 아카이브된 포스트 찾음 (차수 일치): ${threadName} (ID: ${thread.id})`);
            }
            return matches;
          });
        } else {
          // meetingNumber가 없으면 yearMonth만 일치하는 포스트를 찾음 (가장 최근 것)
          const matchingThreads = Array.from(archivedThreads.threads.values())
            .filter(thread => thread.name.startsWith(`${yearMonth} 회의`))
            .sort((a, b) => {
              // 생성 시간으로 정렬 (최신순)
              return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
            });
          
          if (matchingThreads.length > 0) {
            post = matchingThreads[0];
            console.log(`✅ [findOrCreatePost] 아카이브된 포스트 찾음 (년월 일치, 차수 없음, 가장 최근): ${post.name} (ID: ${post.id})`);
          }
        }
        
        if (post) {
          console.log(`📌 [Discord] 아카이브된 포스트 찾음: ${post.name} (ID: ${post.id})`);
          return post;
        }
      } catch (archivedError) {
        console.warn('아카이브된 스레드 조회 실패:', archivedError);
        // 계속 진행
      }
    }
    
    // 포스트 생성 (포럼 채널에서는 스레드 생성)
    // meetingNumber가 없으면 년월만 사용하여 포스트 생성 (차수 없이)
    const finalPostName = meetingNumber ? postName : `${yearMonth} 회의 - 준비중${suffix}`;
    console.log(`📌 [Discord] 새 포스트 생성: ${finalPostName} (meetingNumber: ${meetingNumber || '없음'})`);
    const newPost = await channel.threads.create({
      name: finalPostName,
      message: {
        content: `${finalPostName} 이미지 저장`
      },
      appliedTags: []
    });
    
    console.log(`✅ [Discord] 새 포스트 생성 완료: ${finalPostName} (ID: ${newPost.id})`);
    return newPost;
  } catch (error) {
    console.error('포스트 찾기/생성 오류:', error);
    throw error;
  }
}

// 회의 스레드 찾기 또는 생성
async function findOrCreateThread(post, meetingId) {
  try {
    // 포스트(스레드) 내의 하위 스레드 찾기
    // Discord 포럼에서는 포스트 자체가 스레드이므로, 여기서는 포스트를 그대로 사용
    // 또는 포스트 내에 메시지로 회의 정보를 저장하고, 이미지는 해당 포스트에 업로드
    
    // 일단 포스트를 스레드로 사용 (나중에 필요시 수정)
    return post;
  } catch (error) {
    console.error('스레드 찾기/생성 오류:', error);
    throw error;
  }
}

/**
 * 이미지에서 하단 공백만 자동으로 제거합니다.
 * 상단 헤더와 작성자 정보는 유지하고, 하단의 공백만 제거/보정합니다.
 * @param {Buffer} imageBuffer - 원본 이미지 버퍼
 * @param {Object} options
 * @param {'white'|'pink'} options.bottomColor - 하단을 확장할 때 사용할 배경 색상 (기본: white)
 * @returns {Promise<{buffer: Buffer, originalWidth: number, originalHeight: number, croppedWidth: number, croppedHeight: number}>}
 */
async function autoCropImage(imageBuffer, options = {}) {
  try {
    // 원본 이미지 메타데이터 가져오기
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;
    
    console.log(`🔍 [autoCropImage] 원본 이미지 크기: ${originalWidth}x${originalHeight}`);
    
    // 이미지의 raw 픽셀 데이터 읽기 (RGBA)
    const { data } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 배경색 (흰색) 임계값 설정
    const backgroundColorThreshold = 250; // RGB 값이 모두 250 이상이면 배경으로 간주
    const alphaThreshold = 10; // 알파값이 10 이하면 투명으로 간주
    
    let lastContentY = -1; // 마지막 콘텐츠가 있는 Y 좌표 (하단부터 스캔, -1은 아직 찾지 못함)
    
    // 하단부터 역순으로 스캔하여 마지막 콘텐츠 라인 찾기
    for (let y = originalHeight - 1; y >= 0; y--) {
      let hasContent = false;
      for (let x = 0; x < originalWidth; x++) {
        const index = (y * originalWidth + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        
        // 배경이 아닌 픽셀인지 확인
        const isBackground = 
          (r >= backgroundColorThreshold && 
           g >= backgroundColorThreshold && 
           b >= backgroundColorThreshold) ||
          a < alphaThreshold;
        
        if (!isBackground) {
          hasContent = true;
          lastContentY = y;
          break; // 이 라인에 콘텐츠가 있으면 중단
        }
      }
      // 콘텐츠가 있는 라인을 찾으면 중단 (하단부터 역순 스캔)
      if (hasContent) {
        break;
      }
    }
    
    // 콘텐츠가 없는 경우 원본 반환
    if (lastContentY === -1) {
      console.log(`⚠️ [autoCropImage] 콘텐츠가 없는 이미지로 판단, 원본 반환`);
      return {
        buffer: imageBuffer,
        originalWidth,
        originalHeight,
        croppedWidth: originalWidth,
        croppedHeight: originalHeight
      };
    }
    
    // 최소 하단 여백 보장 (클라이언트와 일치: 기본 96px, 커스텀 업로드 등에서는 0으로 줄일 수 있음)
    const minBottomPadding = typeof options.minBottomPadding === 'number' ? options.minBottomPadding : 96;
    const desiredBottom = lastContentY + minBottomPadding + 1;
    let finalBuffer;
    let croppedHeight;

    if (desiredBottom <= originalHeight) {
      // 원본 내부에서 여백 보장 가능 → 해당 높이까지 크롭
      croppedHeight = desiredBottom;
      finalBuffer = await sharp(imageBuffer)
        .extract({
          left: 0,
          top: 0,
          width: originalWidth,
          height: croppedHeight
        })
        .png()
        .toBuffer();
    } else {
      // 원본 끝까지 내용이 닿아 여백이 부족 → 아래로 지정된 색상 영역을 확장
      const extra = desiredBottom - originalHeight;
      croppedHeight = originalHeight + extra;
      const bottomColor = options.bottomColor === 'pink'
        ? { r: 255, g: 182, b: 193, alpha: 1 } // #FFB6C1 파스텔 핫핑크
        : { r: 255, g: 255, b: 255, alpha: 1 }; // 기본 흰색
      finalBuffer = await sharp(imageBuffer)
        .extend({
          bottom: extra,
          background: bottomColor
        })
        .png()
        .toBuffer();
    }
    
    const croppedWidth = originalWidth;
    
    console.log(`✂️ [autoCropImage] 하단 공백 처리: ${originalWidth}x${originalHeight} → ${croppedWidth}x${croppedHeight}`);
    
    return {
      buffer: finalBuffer,
      originalWidth,
      originalHeight,
      croppedWidth,
      croppedHeight
    };
  } catch (error) {
    console.error('❌ [autoCropImage] 이미지 크롭 오류:', error);
    // 크롭 실패 시 원본 이미지 반환
    const metadata = await sharp(imageBuffer).metadata();
    return {
      buffer: imageBuffer,
      originalWidth: metadata.width || 0,
      originalHeight: metadata.height || 0,
      croppedWidth: metadata.width || 0,
      croppedHeight: metadata.height || 0
    };
  }
}

// 동영상 업로드 (Discord)
async function uploadVideoToDiscord(videoBuffer, filename, meetingId, meetingDate, meetingNumber, modeLabel) {
  if (!DISCORD_LOGGING_ENABLED || !discordBot) {
    throw new Error('Discord 봇이 초기화되지 않았습니다.');
  }

  // 봇이 준비될 때까지 대기
  if (!discordBot.isReady()) {
    for (let i = 0; i < 10; i++) {
      if (discordBot.isReady()) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!discordBot.isReady()) {
    throw new Error('Discord 봇이 준비되지 않았습니다.');
  }

  try {
    const channel = await discordBot.channels.fetch(DISCORD_MEETING_CHANNEL_ID);
    if (!channel) {
      throw new Error(`채널을 찾을 수 없습니다: ${DISCORD_MEETING_CHANNEL_ID}`);
    }

    // 년월 추출 (예: "2025-01")
    const yearMonth = meetingDate ? meetingDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
    
    // 해당 년월과 차수의 포스트 찾기 또는 생성
    let post = await findOrCreatePost(channel, yearMonth, meetingNumber, modeLabel);
    
    // 회의 스레드 찾기 또는 생성 (현재는 포스트를 그대로 사용)
    let thread = post;
    
    // 동영상 업로드
    const attachment = new AttachmentBuilder(videoBuffer, { name: filename });
    const message = await thread.send({ files: [attachment] });
    
    const result = {
      videoUrl: message.attachments.first().url,
      postId: post.id,
      threadId: thread.id
    };
    
    return result;
  } catch (error) {
    console.error('Discord 동영상 업로드 오류:', error);
    throw error;
  }
}

// 이미지 업로드 (Discord)
async function uploadImageToDiscord(imageBuffer, filename, meetingId, meetingDate, meetingNumber, modeLabel, metadata = null) {
  if (!DISCORD_LOGGING_ENABLED || !discordBot) {
    throw new Error('Discord 봇이 초기화되지 않았습니다.');
  }

  // 봇이 준비될 때까지 대기
  if (!discordBot.isReady()) {
    for (let i = 0; i < 10; i++) {
      if (discordBot.isReady()) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!discordBot.isReady()) {
    throw new Error('Discord 봇이 준비되지 않았습니다.');
  }

  try {
    const channel = await discordBot.channels.fetch(DISCORD_MEETING_CHANNEL_ID);
    if (!channel) {
      throw new Error(`채널을 찾을 수 없습니다: ${DISCORD_MEETING_CHANNEL_ID}`);
    }

    // 년월 추출 (예: "2025-01")
    const yearMonth = meetingDate ? meetingDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
    
    // 해당 년월과 차수의 포스트 찾기 또는 생성
    let post = await findOrCreatePost(channel, yearMonth, meetingNumber, modeLabel);
    
    // 회의 스레드 찾기 또는 생성 (현재는 포스트를 그대로 사용)
    let thread = post;
    
    // 이미지 업로드
    const attachment = new AttachmentBuilder(imageBuffer, { name: filename });
    const message = await thread.send({ files: [attachment] });
    
    const result = {
      imageUrl: message.attachments.first().url,
      postId: post.id,
      threadId: thread.id
    };
    
    // 메타데이터가 있으면 추가
    if (metadata) {
      result.originalWidth = metadata.originalWidth;
      result.originalHeight = metadata.originalHeight;
      result.croppedWidth = metadata.croppedWidth;
      result.croppedHeight = metadata.croppedHeight;
    }
    
    return result;
  } catch (error) {
    console.error('Discord 이미지 업로드 오류:', error);
    throw error;
  }
}

// "준비중" 포스트를 확정 차수 포스트로 rename
async function renamePreparedPostToNumber(yearMonth, meetingNumber) {
  try {
    if (!DISCORD_LOGGING_ENABLED || !discordBot) {
      return;
    }
    if (!meetingNumber) return;
    if (!discordBot.isReady()) return;
    const channel = await discordBot.channels.fetch(DISCORD_MEETING_CHANNEL_ID);
    if (!channel) return;
    const labels = ['어플모드', '커스텀'];
    const activeThreads = await channel.threads.fetchActive();
    const archivedThreads = await channel.threads.fetchArchived({ limit: 100 });
    const allThreads = [
      ...Array.from(activeThreads.threads.values()),
      ...Array.from(archivedThreads.threads.values())
    ];
    for (const modeLabel of labels) {
      const preparedName = `${yearMonth} 회의 - 준비중(${modeLabel})`;
      const finalName = `${yearMonth} 회의 - ${meetingNumber}차(${modeLabel})`;
      const thread = allThreads.find(t => t.name === preparedName);
      if (thread && thread.editable !== false) {
        try {
          await thread.setName(finalName);
          console.log(`✅ [Discord] 스레드 이름 변경: ${preparedName} → ${finalName}`);
        } catch (e) {
          console.warn(`⚠️ [Discord] 스레드 이름 변경 실패 (${preparedName}):`, e.message);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ [Discord] 준비중 스레드 rename 처리 중 오류:', e.message);
  }
}

// 이미지 업로드 API
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB 제한
});

async function uploadMeetingImage(req, res) {
  try {
    // CORS 헤더 설정
    setCORSHeaders(req, res);
    
    const { meetingId } = req.params;
    const { meetingDate, slideOrder } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '이미지 파일이 없습니다.' });
    }

    // 임시 meetingId인 경우 (커스텀 슬라이드 이미지 업로드)
    const isTempMeeting = meetingId === 'temp-custom-slide';
    const filename = req.file.originalname || (isTempMeeting 
      ? `custom-slide-${Date.now()}.${req.file.originalname?.split('.').pop() || 'png'}`
      : `meeting-${meetingId}-${slideOrder}.png`);
    
    // 회의 정보 조회 (차수 가져오기)
    let meetingNumber = null;
    if (!isTempMeeting) {
      try {
        const { sheets, SPREADSHEET_ID } = createSheetsClient();
        const sheetName = '회의목록';
        const range = `${sheetName}!A3:G`;
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range
        });
        
        const rows = response.data.values || [];
        const meetingRow = rows.find(row => row[0] === meetingId);
        
        if (meetingRow && meetingRow[3]) {
          meetingNumber = parseInt(meetingRow[3]);
          console.log(`📋 [uploadMeetingImage] 회의 차수 조회: ${meetingNumber}차`);
        } else {
          console.warn(`⚠️ [uploadMeetingImage] 회의 정보를 찾을 수 없습니다: ${meetingId}`);
        }
      } catch (meetingError) {
        console.warn('회의 정보 조회 실패 (차수 정보 없이 진행):', meetingError);
        // 차수 정보가 없어도 계속 진행
      }
    }
    
    console.log(`📤 [uploadMeetingImage] Discord 업로드 시작:`, {
      meetingId,
      isTempMeeting,
      meetingDate,
      meetingNumber,
      filename
    });
    
    // 이미지 자동 크롭 처리 (회의 캡처본은 하단 여백을 파스텔 핫핑크로 확장)
    console.log(`✂️ [uploadMeetingImage] 이미지 자동 크롭 시작`);
    const croppedResult = await autoCropImage(req.file.buffer, { bottomColor: 'pink' });
    console.log(`✅ [uploadMeetingImage] 이미지 자동 크롭 완료:`, {
      originalSize: `${croppedResult.originalWidth}x${croppedResult.originalHeight}`,
      croppedSize: `${croppedResult.croppedWidth}x${croppedResult.croppedHeight}`,
      reduction: `${((1 - (croppedResult.croppedWidth * croppedResult.croppedHeight) / (croppedResult.originalWidth * croppedResult.originalHeight)) * 100).toFixed(2)}%`
    });
    
    // Discord에 업로드 (크롭된 이미지 사용)
    const result = await uploadImageToDiscord(
      croppedResult.buffer,
      filename,
      isTempMeeting ? `temp-${meetingDate || new Date().toISOString().split('T')[0]}` : meetingId,
      meetingDate || new Date().toISOString().split('T')[0],
      meetingNumber, // meetingNumber를 명시적으로 전달하여 같은 포스트를 찾도록 함
      '어플모드',
      {
        originalWidth: croppedResult.originalWidth,
        originalHeight: croppedResult.originalHeight,
        croppedWidth: croppedResult.croppedWidth,
        croppedHeight: croppedResult.croppedHeight
      }
    );
    
    console.log(`✅ [uploadMeetingImage] Discord 업로드 완료:`, {
      imageUrl: result.imageUrl,
      postId: result.postId,
      threadId: result.threadId
    });

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      postId: result.postId,
      threadId: result.threadId,
      // 원본 크기 정보 포함
      originalWidth: result.originalWidth,
      originalHeight: result.originalHeight,
      croppedWidth: result.croppedWidth,
      croppedHeight: result.croppedHeight
    });
  } catch (error) {
    // CORS 헤더 설정 (에러 응답에도 포함)
    setCORSHeaders(req, res);
    
    console.error('이미지 업로드 오류:', error);
    
    // 에러 타입에 따라 적절한 HTTP 상태 코드 반환
    let statusCode = 500;
    let errorMessage = error.message || '이미지 업로드 중 오류가 발생했습니다.';
    
    if (error.message.includes('Discord')) {
      statusCode = 503; // Service Unavailable
      errorMessage = 'Discord 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('크롭') || error.message.includes('이미지 처리')) {
      statusCode = 422; // Unprocessable Entity
      errorMessage = '이미지 처리 중 오류가 발생했습니다. 이미지 파일 형식을 확인해주세요.';
    } else if (error.message.includes('파일이 없습니다')) {
      statusCode = 400; // Bad Request
      errorMessage = '이미지 파일이 없습니다.';
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      errorType: error.name || 'UnknownError',
      timestamp: new Date().toISOString()
    });
  }
}

// Excel 파일을 이미지로 변환
// 1순위: ExcelJS → HTML → Puppeteer 스크린샷 (한글 렌더링 품질 우선)
// 실패 시: Canvas 기반 `convertExcelToImage`로 폴백하여 Chrome 없이도 동작하도록 보장
async function convertExcelToImages(excelBuffer, filename) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);

  // 1) HTML + Puppeteer 파이프라인 시도
  try {
    const imageBuffers = [];

    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.error('❌ [Excel 변환] puppeteer 모듈을 로드할 수 없습니다 (HTML 파이프라인 건너뜀):', e.message);
      throw e;
    }

    const { executablePath } = require('puppeteer');
    let chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || null;
    if (!chromePath) {
      try {
        chromePath = executablePath();
      } catch (e) {
        console.warn('⚠️ [Excel 변환] Puppeteer 기본 executablePath 탐색 실패:', e.message);
      }
    }

    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    const browser = await puppeteer.launch(launchOptions);

    try {
      for (let i = 0; i < workbook.worksheets.length; i++) {
        const worksheet = workbook.worksheets[i];
        const sheetName = worksheet.name || `Sheet${i + 1}`;
        console.log(`📊 [Excel 변환] (HTML/Puppeteer) 시트 "${sheetName}" 처리 중...`);

        const html = convertExcelToHTML(worksheet);
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.waitForTimeout(800);

        const elementHandle = await page.$('body');
        if (!elementHandle) {
          console.warn(`⚠️ [Excel 변환] body 요소를 찾을 수 없습니다. 시트: ${sheetName}`);
          await page.close();
          continue;
        }

        const screenshotBuffer = await elementHandle.screenshot({
          type: 'png',
          fullPage: true
        });
        await page.close();

        imageBuffers.push({
          buffer: screenshotBuffer,
          filename: `${filename}_${sheetName}.png`,
          sheetName
        });
      }
    } finally {
      await browser.close();
    }

    if (imageBuffers.length === 0) {
      throw new Error('변환된 시트가 없습니다. Excel 내용이 비어있거나 렌더링에 실패했습니다.');
    }

    return imageBuffers;
  } catch (error) {
    console.warn('⚠️ [Excel 변환] HTML/Puppeteer 방식 실패, Canvas 기반 변환으로 폴백:', error.message);
  }

  // 2) Puppeteer가 없거나 Chrome을 찾지 못하면 Canvas 기반 폴백 사용
  try {
    console.log('📊 [Excel 변환] Canvas 폴백 파이프라인 시작...');
    const imageBuffers = [];
    for (let i = 0; i < workbook.worksheets.length; i++) {
      const worksheet = workbook.worksheets[i];
      const sheetName = worksheet.name || `Sheet${i + 1}`;
      console.log(`📊 [Excel 변환] (Canvas) 시트 "${sheetName}" 처리 중...`);
      const imageBuffer = await convertExcelToImage(worksheet, `${filename}_${sheetName}`);
      if (imageBuffer) {
        imageBuffers.push({
          buffer: imageBuffer,
          filename: `${filename}_${sheetName}.png`,
          sheetName
        });
      }
    }
    if (imageBuffers.length === 0) {
      throw new Error('Canvas를 이용한 Excel 변환에도 실패했습니다.');
    }
    return imageBuffers;
  } catch (fallbackError) {
    console.error('❌ [Excel 변환] Canvas 폴백 파이프라인도 실패:', fallbackError);
    throw new Error(`Excel 파일 변환 실패: ${fallbackError.message}`);
  }
}

// Excel 워크시트를 HTML로 변환
function convertExcelToHTML(worksheet) {
  let html = '<!DOCTYPE html><html><head>';
  html += '<meta charset="UTF-8">';
  html += '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
  // Google Fonts에서 Noto Sans KR 폰트 로드 (Linux 서버에서도 한글 폰트 사용 가능)
  html += '<link rel="preconnect" href="https://fonts.googleapis.com">';
  html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
  html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">';
  html += '<style>';
  // Google Fonts Noto Sans KR을 우선 사용하고, 시스템 폰트를 폴백으로 사용
  html += '* { ';
  html += 'font-family: "Noto Sans KR", "Malgun Gothic", "맑은 고딕", "AppleGothic", "Apple SD Gothic Neo", "NanumGothic", "Nanum Gothic", "Noto Sans CJK KR", "Gulim", "굴림", "Batang", "바탕", "Gungsuh", "궁서", "Dotum", "돋움", Arial, sans-serif !important; ';
  html += 'font-feature-settings: normal !important; ';
  html += 'font-variant: normal !important; ';
  html += 'text-rendering: optimizeLegibility !important; ';
  html += '-webkit-font-smoothing: antialiased !important; ';
  html += '-moz-osx-font-smoothing: grayscale !important; ';
  html += '}';
  html += 'body { margin: 20px; font-size: 14px; line-height: 1.5; }';
  html += 'table { border-collapse: collapse; width: 100%; font-family: inherit !important; }';
  html += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-family: inherit !important; }';
  html += 'th { background-color: #4a90e2; color: white; font-weight: bold; }';
  html += 'tr:nth-child(even) { background-color: #f8f9fa; }';
  html += 'tr:hover { background-color: #f0f0f0; }';
  html += 'h2 { color: #333; margin-bottom: 20px; font-family: inherit !important; }';
  html += '</style></head><body>';
  // 시트 이름도 HTML 이스케이프 처리
  const sheetName = (worksheet.name || 'Sheet')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  html += `<h2>${sheetName}</h2>`;
  html += '<table>';
  
  // 헤더 행
  const headerRow = worksheet.getRow(1);
  if (headerRow && headerRow.values && headerRow.values.length > 1) {
    html += '<thead><tr>';
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
      // HTML 이스케이프 처리 (한글 등 특수문자 보호)
      const escapedValue = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      html += `<th>${escapedValue}</th>`;
    });
    html += '</tr></thead>';
  }
  
  // 데이터 행
  html += '<tbody>';
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // 헤더는 이미 처리됨
    
    html += '<tr>';
    row.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
      // HTML 이스케이프 처리 (한글 등 특수문자 보호)
      const escapedValue = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      html += `<td>${escapedValue}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></body></html>';
  
  return html;
}

// Excel 워크시트를 이미지로 변환 (Canvas 사용)
async function convertExcelToImage(worksheet, filename) {
  try {
    // Canvas 모듈 동적 로드 (optional)
    let canvasModule;
    let createCanvas;
    let registerFont;
    
    try {
      canvasModule = require('canvas');
      createCanvas = canvasModule.createCanvas;
      registerFont = canvasModule.registerFont;
    } catch (canvasError) {
      console.error('❌ [Excel 변환] Canvas 모듈을 찾을 수 없습니다:', canvasError.message);
      throw new Error('Excel 파일을 이미지로 변환하려면 Canvas 모듈이 필요합니다. 서버에 Canvas를 설치해주세요: npm install canvas');
    }
    
    // 시스템 한글 폰트 우선순위 (OS별)
    // Canvas는 시스템 폰트를 직접 사용하므로 폰트 이름만 지정
    const os = require('os');
    const platform = os.platform();
    
    let fontFamily = 'Arial'; // 기본값
    
    // OS별 한글 폰트 우선순위
    if (platform === 'win32') {
      // Windows: 맑은 고딕 우선
      fontFamily = 'Malgun Gothic';
    } else if (platform === 'darwin') {
      // macOS: AppleGothic 우선
      fontFamily = 'AppleGothic';
    } else {
      // Linux: Noto Sans CJK KR 또는 NanumGothic
      fontFamily = 'Noto Sans CJK KR';
    }
    
    console.log(`📝 [Excel 변환] OS: ${platform}, 사용 폰트: ${fontFamily}`);
    
    // Excel 데이터 읽기
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowData = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowData.push({
          value: cell.value !== null && cell.value !== undefined ? String(cell.value) : '',
          type: cell.type
        });
      });
      rows.push(rowData);
    });
    
    if (rows.length === 0) {
      throw new Error('Excel 시트에 데이터가 없습니다.');
    }
    
    // 동적 크기 계산
    const maxCols = Math.max(...rows.map(r => r.length));
    const maxRows = Math.min(rows.length, 50); // 최대 50행
    const colWidth = 180;
    const rowHeight = 35;
    const padding = 50;
    const headerHeight = 80;
    
    const canvasWidth = Math.max(1920, padding * 2 + colWidth * maxCols);
    const canvasHeight = Math.max(1080, headerHeight + padding * 2 + rowHeight * maxRows);
    
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    // 텍스트 인코딩 설정 (UTF-8)
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    
    // 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 제목
    ctx.fillStyle = '#000000';
    ctx.font = `bold 36px ${fontFamily}, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const title = String(worksheet.name || filename);
    // 한글 텍스트 렌더링 (UTF-8 인코딩 보장)
    try {
      ctx.fillText(title, padding, 50);
    } catch (textError) {
      console.warn(`⚠️ [Excel 변환] 제목 렌더링 오류 (${title.substring(0, 10)}...), 기본 폰트로 재시도:`, textError.message);
      ctx.font = 'bold 36px Arial';
      ctx.fillText(title, padding, 50);
      ctx.font = `bold 36px ${fontFamily}, Arial, sans-serif`;
    }
    
    // 테이블 영역
    let yPos = headerHeight;
    const startX = padding;
    
    // 헤더 행 (첫 번째 행)
    if (rows.length > 0) {
      const headerRow = rows[0];
      ctx.fillStyle = '#4a90e2';
      ctx.fillRect(startX, yPos, colWidth * maxCols, rowHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 18px ${fontFamily}, Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      let xPos = startX + 10;
      headerRow.forEach((cell, colIndex) => {
        const text = String(cell.value || '');
        // 텍스트가 너무 길면 자르기
        let displayText = text.length > 25 ? text.substring(0, 22) + '...' : text;
        
        // 한글 텍스트 렌더링 (UTF-8 인코딩 보장)
        try {
          // 텍스트 측정
          const metrics = ctx.measureText(displayText);
          const textY = yPos + rowHeight / 2;
          ctx.fillText(displayText, xPos, textY);
        } catch (textError) {
          // 폰트 오류 시 기본 폰트로 재시도
          console.warn(`⚠️ [Excel 변환] 헤더 텍스트 렌더링 오류 (${displayText.substring(0, 10)}...):`, textError.message);
          ctx.font = 'bold 18px Arial';
          ctx.fillText(displayText, xPos, yPos + rowHeight / 2);
          ctx.font = `bold 18px ${fontFamily}, Arial, sans-serif`;
        }
        xPos += colWidth;
      });
      yPos += rowHeight;
    }
    
    // 데이터 행
    ctx.font = `16px ${fontFamily}, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (let i = 1; i < Math.min(rows.length, maxRows + 1); i++) {
      const row = rows[i];
      
      // 짝수 행 배경색
      if (i % 2 === 0) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(startX, yPos, colWidth * maxCols, rowHeight);
      }
      
      ctx.fillStyle = '#000000';
      let xPos = startX + 10;
      row.forEach((cell, colIndex) => {
        const text = String(cell.value || '');
        // 텍스트가 너무 길면 자르기
        let displayText = text.length > 25 ? text.substring(0, 22) + '...' : text;
        
        // 한글 텍스트 렌더링 (UTF-8 인코딩 보장)
        try {
          const textY = yPos + rowHeight / 2;
          ctx.fillText(displayText, xPos, textY);
        } catch (textError) {
          // 폰트 오류 시 기본 폰트로 재시도
          console.warn(`⚠️ [Excel 변환] 데이터 텍스트 렌더링 오류 (${displayText.substring(0, 10)}...):`, textError.message);
          ctx.font = '16px Arial';
          ctx.fillText(displayText, xPos, yPos + rowHeight / 2);
          ctx.font = `16px ${fontFamily}, Arial, sans-serif`;
        }
        xPos += colWidth;
      });
      yPos += rowHeight;
      
      if (yPos > canvas.height - padding) break;
    }
    
    // 그리드 라인
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= maxCols; i++) {
      ctx.beginPath();
      ctx.moveTo(startX + i * colWidth, headerHeight);
      ctx.lineTo(startX + i * colWidth, yPos);
      ctx.stroke();
    }
    for (let i = 0; i <= Math.min(rows.length, maxRows + 1); i++) {
      ctx.beginPath();
      ctx.moveTo(startX, headerHeight + i * rowHeight);
      ctx.lineTo(startX + maxCols * colWidth, headerHeight + i * rowHeight);
      ctx.stroke();
    }
    
    // Canvas를 Buffer로 변환
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Excel 이미지 변환 오류:', error);
    throw error;
  }
}

// PPT 파일을 이미지로 변환
async function convertPPTToImages(pptBuffer, filename) {
  try {
    console.log(`📊 [PPT 변환] PPT 파일 변환 시작: ${filename}`);
    
    // PPTX 파일은 ZIP 파일이므로 압축 해제
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(pptBuffer);
    
    // 슬라이드 파일 목록 가져오기 (ppt/slides/slide*.xml)
    const slideFiles = Object.keys(zipContent.files)
      .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort((a, b) => {
        // slide1.xml, slide2.xml 순서로 정렬
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
        return numA - numB;
      });
    
    if (slideFiles.length === 0) {
      throw new Error('PPTX 파일에서 슬라이드를 찾을 수 없습니다.');
    }
    
    console.log(`📊 [PPT 변환] ${slideFiles.length}개의 슬라이드 발견`);
    
    const parser = new xml2js.Parser();
    const imageBuffers = [];
    
    // Puppeteer 브라우저 초기화 (한 번만 생성하여 재사용)
    const puppeteer = require('puppeteer');
    let browser;
    if (!global.pptBrowser) {
      try {
        // Puppeteer 설정: Chrome 자동 다운로드 허용
        const launchOptions = {
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer'
          ]
        };
        
        // 환경 변수로 Chrome 경로가 지정된 경우에만 사용
        // 지정되지 않으면 Puppeteer가 자동으로 Chrome을 다운로드
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
          launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }
        
        console.log('🚀 [PPT 변환] Puppeteer 브라우저 실행 시도...');
        global.pptBrowser = await puppeteer.launch(launchOptions);
        console.log('✅ [PPT 변환] Puppeteer 브라우저 실행 성공');
      } catch (launchError) {
        console.error('❌ [PPT 변환] Puppeteer 브라우저 실행 실패:', launchError.message);
        
        // Chrome을 찾을 수 없는 경우 처리
        if (launchError.message.includes('Could not find Chrome') || 
            launchError.message.includes('Browser was not found') ||
            launchError.message.includes('Executable doesn\'t exist')) {
          console.log('📥 [PPT 변환] Chrome을 찾을 수 없습니다. 설치된 Chrome 경로 확인 중...');
          
          // 이미 설치된 Chrome 경로 확인 (Puppeteer 캐시 디렉토리에서)
          const os = require('os');
          const path = require('path');
          const fs = require('fs');
          
          // 공통 경로 후보
          const commonCandidates = [
            process.env.PUPPETEER_EXECUTABLE_PATH,
            process.env.CHROME_PATH,
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/opt/google/chrome/chrome'
          ].filter(Boolean);
          
          const puppeteerCacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');
          const chromePaths = [
            path.join(puppeteerCacheDir, 'chrome', 'linux-142.0.7444.162', 'chrome-linux64', 'chrome'),
            path.join(puppeteerCacheDir, 'chrome', 'linux-*', 'chrome-linux64', 'chrome'),
          ];
          
          // 실제 설치된 Chrome 경로 찾기
          let foundChromePath = null;
          try {
            // 특정 버전 경로 확인
            const specificPath = chromePaths[0];
            if (fs.existsSync(specificPath)) {
              foundChromePath = specificPath;
              console.log(`✅ [PPT 변환] 설치된 Chrome 발견: ${foundChromePath}`);
            } else {
              // 와일드카드 경로 검색
              const chromeDir = path.join(puppeteerCacheDir, 'chrome');
              if (fs.existsSync(chromeDir)) {
                const versions = fs.readdirSync(chromeDir);
                for (const version of versions) {
                  const chromePath = path.join(chromeDir, version, 'chrome-linux64', 'chrome');
                  if (fs.existsSync(chromePath)) {
                    foundChromePath = chromePath;
                    console.log(`✅ [PPT 변환] 설치된 Chrome 발견: ${foundChromePath}`);
                    break;
                  }
                }
              }
              // 시스템 공통 경로도 확인
              if (!foundChromePath) {
                for (const candidate of commonCandidates) {
                  try {
                    if (candidate && fs.existsSync(candidate)) {
                      foundChromePath = candidate;
                      console.log(`✅ [PPT 변환] 시스템 Chrome 발견: ${foundChromePath}`);
                      break;
                    }
                  } catch (_) {}
                }
              }
            }
          } catch (pathError) {
            console.warn('⚠️ [PPT 변환] Chrome 경로 확인 실패:', pathError.message);
          }
          
          if (foundChromePath) {
            // 설치된 Chrome 경로로 재시도
            try {
              const retryOptions = {
                headless: true,
                executablePath: foundChromePath,
                args: [
                  '--no-sandbox', 
                  '--disable-setuid-sandbox', 
                  '--disable-dev-shm-usage',
                  '--disable-gpu',
                  '--disable-software-rasterizer'
                ]
              };
              global.pptBrowser = await puppeteer.launch(retryOptions);
              console.log('✅ [PPT 변환] Puppeteer 브라우저 실행 성공 (설치된 Chrome 사용)');
            } catch (retryError) {
              console.error('❌ [PPT 변환] 설치된 Chrome으로 실행 실패:', retryError.message);
              throw new Error(`PPT 변환을 위해 Chrome이 필요합니다. Chrome이 설치되어 있지만 실행에 실패했습니다.\n\n` +
                `해결 방법:\n` +
                `1. 서버를 재시작하세요.\n` +
                `2. 환경 변수 PUPPETEER_EXECUTABLE_PATH 또는 CHROME_PATH에 Chrome 경로를 설정하세요: ${foundChromePath}\n` +
                `3. 또는 package.json postinstall에서 'npx puppeteer browsers install chrome'을 실행해 캐시에 설치하세요.\n\n` +
                `원본 에러: ${launchError.message}\n` +
                `재시도 에러: ${retryError.message}`);
            }
          } else {
            // Chrome이 설치되지 않은 경우
            throw new Error(`PPT 변환을 위해 Chrome이 필요합니다.\n\n` +
              `해결 방법:\n` +
              `1. 서버 터미널에서 다음 명령을 실행하세요:\n` +
              `   cd server\n` +
              `   npx puppeteer browsers install chrome\n\n` +
              `2. 설치 완료 후 서버를 재시작하세요.\n\n` +
              `원본 에러: ${launchError.message}`);
          }
        } else {
          throw launchError;
        }
      }
    }
    browser = global.pptBrowser;
    
    // 각 슬라이드를 HTML로 변환 후 이미지로 변환
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideXml = await zipContent.files[slideFile].async('string');
      
      // XML 파싱
      const slideData = await parser.parseStringPromise(slideXml);
      
      // 슬라이드 내용 추출 (텍스트, 이미지 등)
      const slideContent = await extractSlideContent(slideData, zipContent);
      
      // HTML 생성
      const html = generateSlideHTML(slideContent, i + 1, slideFiles.length);
      
      // Puppeteer로 이미지 변환
      const page = await browser.newPage();
      
      try {
        await page.setContent(html, { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        // 한글 폰트가 로드되도록 대기
        await page.evaluateHandle(() => {
          return document.fonts.ready;
        });
        
        // 추가 대기 시간 (폰트 렌더링 완료 보장)
        await page.waitForTimeout(2000);
        
        // 스크린샷 촬영
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: true,
          encoding: 'binary'
        });
        
        // 이미지 자동 크롭 처리
        const croppedResult = await autoCropImage(screenshot);
        
        imageBuffers.push({
          buffer: croppedResult.buffer,
          filename: `${filename}_slide${i + 1}.png`,
          sheetName: `슬라이드 ${i + 1}`,
          metadata: {
            originalWidth: croppedResult.originalWidth,
            originalHeight: croppedResult.originalHeight,
            croppedWidth: croppedResult.croppedWidth,
            croppedHeight: croppedResult.croppedHeight
          }
        });
        
        console.log(`✅ [PPT 변환] 슬라이드 ${i + 1}/${slideFiles.length} 변환 완료`);
      } catch (error) {
        console.error(`❌ [PPT 변환] 슬라이드 ${i + 1} 변환 실패:`, error);
        throw error;
      } finally {
        await page.close();
      }
    }
    
    // 브라우저는 유지 (다음 변환을 위해)
    
    console.log(`✅ [PPT 변환] PPT 파일 변환 완료: ${filename} (${imageBuffers.length}개 슬라이드)`);
    
    return imageBuffers;
  } catch (error) {
    console.error('❌ [PPT 변환] PPT 변환 오류:', error);
    throw new Error(`PPT 변환 실패: ${error.message}`);
  }
}

// 슬라이드 내용 추출
async function extractSlideContent(slideData, zipContent) {
  const content = {
    texts: [],
    images: []
  };
  
  try {
    // 텍스트 추출 (a:t 요소)
    const extractText = (obj, texts = []) => {
      if (typeof obj === 'string') {
        if (obj.trim()) texts.push(obj.trim());
      } else if (Array.isArray(obj)) {
        obj.forEach(item => extractText(item, texts));
      } else if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key === 'a:t' || key === 't') {
            extractText(obj[key], texts);
          } else {
            extractText(obj[key], texts);
          }
        });
      }
      return texts;
    };
    
    content.texts = extractText(slideData);
    
    // 이미지 추출 (a:blip 요소의 r:embed 속성)
    const extractImages = (obj, images = []) => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key === 'a:blip' && obj[key] && obj[key]['$'] && obj[key]['$']['r:embed']) {
            const imageId = obj[key]['$']['r:embed'];
            images.push(imageId);
          } else {
            extractImages(obj[key], images);
          }
        });
      } else if (Array.isArray(obj)) {
        obj.forEach(item => extractImages(item, images));
      }
      return images;
    };
    
    const imageIds = extractImages(slideData);
    
    // 이미지 파일 찾기 및 Base64 변환
    const imagePromises = imageIds.map(async (imageId) => {
      try {
        // 관계 파일에서 이미지 경로 찾기
        // ppt/slides/_rels/slide*.xml.rels 파일들을 확인
        const relsFiles = Object.keys(zipContent.files)
          .filter(name => name.includes('_rels') && name.endsWith('.rels'));
        
        let imagePath = null;
        for (const relsFile of relsFiles) {
          try {
            const relsContent = await zipContent.files[relsFile].async('string');
            const relsData = await parser.parseStringPromise(relsContent);
            
            // Relationship 요소에서 이미지 찾기
            const relationships = relsData['Relationships']?.['Relationship'] || [];
            for (const rel of relationships) {
              if (rel['$'] && rel['$']['Id'] === imageId) {
                const target = rel['$']['Target'];
                if (target) {
                  // 상대 경로를 절대 경로로 변환
                  if (target.startsWith('../')) {
                    imagePath = target.replace('../', 'ppt/');
                  } else if (target.startsWith('media/')) {
                    imagePath = `ppt/${target}`;
                  } else {
                    imagePath = target;
                  }
                  break;
                }
              }
            }
            if (imagePath) break;
          } catch (err) {
            // 관계 파일 파싱 실패 시 무시하고 계속
            continue;
          }
        }
        
        // 이미지 파일 찾기
        if (imagePath) {
          const imageFile = zipContent.files[imagePath];
          if (imageFile && !imageFile.dir) {
            const imageBuffer = await imageFile.async('nodebuffer');
            const base64 = imageBuffer.toString('base64');
            const mimeType = getImageMimeType(imagePath);
            return {
              id: imageId,
              data: `data:${mimeType};base64,${base64}`,
              path: imagePath
            };
          }
        }
        
        // 직접 media 폴더에서 찾기
        const mediaFiles = Object.keys(zipContent.files)
          .filter(name => name.startsWith('ppt/media/') && !name.endsWith('/'));
        
        for (const mediaFile of mediaFiles) {
          const fileName = mediaFile.split('/').pop();
          if (fileName.includes(imageId) || imageId.includes(fileName)) {
            const imageBuffer = await zipContent.files[mediaFile].async('nodebuffer');
            const base64 = imageBuffer.toString('base64');
            const mimeType = getImageMimeType(mediaFile);
            return {
              id: imageId,
              data: `data:${mimeType};base64,${base64}`,
              path: mediaFile
            };
          }
        }
        
        return null;
      } catch (error) {
        console.warn(`⚠️ [PPT 변환] 이미지 ${imageId} 추출 실패:`, error.message);
        return null;
      }
    });
    
    const extractedImages = await Promise.all(imagePromises);
    content.images = extractedImages.filter(img => img !== null);
    
  } catch (error) {
    console.warn('⚠️ [PPT 변환] 슬라이드 내용 추출 중 오류:', error);
  }
  
  return content;
}

// 이미지 MIME 타입 추출
function getImageMimeType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/png';
}

// 슬라이드 HTML 생성
function generateSlideHTML(slideContent, slideNumber, totalSlides) {
  const texts = slideContent.texts || [];
  const images = slideContent.images || [];
  const title = texts[0] || `슬라이드 ${slideNumber}`;
  const bodyTexts = texts.slice(1);
  
  // 이미지 HTML 생성
  const imagesHTML = images.map((img, idx) => {
    return `<img src="${img.data}" alt="이미지 ${idx + 1}" style="max-width: 100%; height: auto; margin: 10px 0;" />`;
  }).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: "Malgun Gothic", "AppleGothic", "NanumGothic", "Noto Sans CJK KR", "Noto Sans KR", Arial, sans-serif;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #f1f3f5 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 40px 20px;
        }
        .ppt-slide {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05);
          padding: 60px 80px;
          max-width: 1200px;
          width: 100%;
          min-height: 600px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .ppt-title {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 30px;
          color: #212529;
          line-height: 1.4;
        }
        .ppt-content {
          font-size: 20px;
          line-height: 1.8;
          color: #495057;
        }
        .ppt-content p {
          margin-bottom: 16px;
        }
        .ppt-content ul, .ppt-content ol {
          margin-left: 30px;
          margin-bottom: 16px;
        }
        .ppt-content li {
          margin-bottom: 8px;
        }
        .slide-number {
          position: absolute;
          bottom: 20px;
          right: 20px;
          font-size: 14px;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <div class="ppt-slide">
        <div class="ppt-title">${escapeHtml(title)}</div>
        <div class="ppt-content">
          ${bodyTexts.map(text => `<p>${escapeHtml(text)}</p>`).join('')}
          ${imagesHTML}
        </div>
        <div class="slide-number">${slideNumber} / ${totalSlides}</div>
      </div>
    </body>
    </html>
  `;
}

// HTML 이스케이프
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 커스텀 슬라이드 파일 업로드 (이미지, Excel, PPT 지원)
async function uploadCustomSlideFile(req, res) {
  try {
    // CORS 헤더 설정
    setCORSHeaders(req, res);
    
    const { meetingId } = req.params;
    const { meetingDate, fileType, meetingNumber: bodyMeetingNumber } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }

    const file = req.file;
    
    // 파일 타입 자동 감지 (fileType이 제공되지 않은 경우)
    let detectedFileType = fileType;
    if (!detectedFileType) {
      const fileName = (file.originalname || '').toLowerCase();
      const mimeType = file.mimetype || '';
      
      if (mimeType.startsWith('image/')) {
        detectedFileType = 'image';
      } else if (
        fileName.endsWith('.xlsx') || 
        fileName.endsWith('.xls') || 
        mimeType.includes('spreadsheet') ||
        mimeType.includes('excel')
      ) {
        detectedFileType = 'excel';
      } else if (
        fileName.endsWith('.pptx') || 
        fileName.endsWith('.ppt') || 
        mimeType.includes('presentation') ||
        mimeType.includes('powerpoint')
      ) {
        detectedFileType = 'ppt';
      } else if (
        fileName.endsWith('.mp4') ||
        fileName.endsWith('.mov') ||
        fileName.endsWith('.avi') ||
        fileName.endsWith('.webm') ||
        fileName.endsWith('.mkv') ||
        mimeType.startsWith('video/')
      ) {
        detectedFileType = 'video';
      } else {
        detectedFileType = 'unknown';
      }
    }
    
    console.log(`📤 [uploadCustomSlideFile] 파일 업로드 시작: ${file.originalname}, 타입: ${detectedFileType}`);
    
    let imageBuffers = [];
    
    if (detectedFileType === 'image') {
      // 이미지 파일 자동 크롭 처리
      console.log(`✂️ [uploadCustomSlideFile] 이미지 자동 크롭 시작`);
      // 커스텀 업로드 이미지는 하단 여백 확장 없이, 순수 하단 공백만 잘라낸다 (minBottomPadding: 0, 색상: 흰색)
      const croppedResult = await autoCropImage(file.buffer, { minBottomPadding: 0, bottomColor: 'white' });
      console.log(`✅ [uploadCustomSlideFile] 이미지 자동 크롭 완료:`, {
        originalSize: `${croppedResult.originalWidth}x${croppedResult.originalHeight}`,
        croppedSize: `${croppedResult.croppedWidth}x${croppedResult.croppedHeight}`,
        reduction: `${((1 - (croppedResult.croppedWidth * croppedResult.croppedHeight) / (croppedResult.originalWidth * croppedResult.originalHeight)) * 100).toFixed(2)}%`
      });
      imageBuffers.push({
        buffer: croppedResult.buffer,
        filename: file.originalname || `image-${Date.now()}.png`,
        sheetName: null,
        metadata: {
          originalWidth: croppedResult.originalWidth,
          originalHeight: croppedResult.originalHeight,
          croppedWidth: croppedResult.croppedWidth,
          croppedHeight: croppedResult.croppedHeight
        }
      });
    } else if (detectedFileType === 'excel') {
      // Excel 파일 변환
      try {
        const os = require('os');
        const fs = require('fs');
        const path = require('path');
        const { exec } = require('child_process');

        // 1) LibreOffice(soffice) 우선 시도 → PNG 직변환 또는 PDF 변환 후 래스터
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-conv-'));
        const srcPath = path.join(tmpDir, file.originalname || `excel-${Date.now()}.xlsx`);
        fs.writeFileSync(srcPath, file.buffer);

        const whichCmd = (cmd) => new Promise(resolve => {
          exec(`which ${cmd}`, (err, stdout) => resolve(!err && stdout ? stdout.trim() : null));
        });
        const runCmd = (cmd, cwd = undefined, timeout = 120000) => new Promise((resolve, reject) => {
          exec(cmd, { cwd, timeout }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve({ stdout, stderr });
          });
        });

        const pngOutputs = [];
        const pdfOutputs = [];

        const sofficePath = await whichCmd('soffice');
        const gsPath = await whichCmd('gs');

        if (sofficePath) {
          try {
            // a) PNG 직접 변환 시도
            await runCmd(`"${sofficePath}" --headless --convert-to png --outdir "${tmpDir}" "${srcPath}"`, tmpDir, 180000);
            const base = path.basename(srcPath, path.extname(srcPath));
            const pngCandidates = fs.readdirSync(tmpDir)
              .filter(f => f.toLowerCase().endsWith('.png') && f.startsWith(base))
              .map(f => path.join(tmpDir, f));
            if (pngCandidates.length > 0) {
              for (const p of pngCandidates.sort()) {
                const buf = fs.readFileSync(p);
                pngOutputs.push({ buffer: buf, filename: `${file.originalname || 'excel'}_${path.basename(p, '.png')}.png`, sheetName: path.basename(p, '.png') });
              }
            }
          } catch (e) {
            console.warn('⚠️ [Excel 변환] soffice PNG 변환 실패, PDF 경유 시도:', e.message);
          }

          // b) PDF 변환 후 PNG 추출 시도(soffice 또는 ghostscript)
          if (pngOutputs.length === 0) {
            try {
              await runCmd(`"${sofficePath}" --headless --convert-to pdf --outdir "${tmpDir}" "${srcPath}"`, tmpDir, 180000);
              const base = path.basename(srcPath, path.extname(srcPath));
              const pdfFile = fs.readdirSync(tmpDir).find(f => f.toLowerCase().endsWith('.pdf') && f.startsWith(base));
              if (pdfFile) {
                const pdfPath = path.join(tmpDir, pdfFile);
                // 우선 ghostscript로 래스터
                if (gsPath) {
                  try {
                    const outPattern = path.join(tmpDir, `${base}-page-%03d.png`);
                    await runCmd(`"${gsPath}" -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pngalpha -r200 -o "${outPattern}" "${pdfPath}"`, tmpDir, 180000);
                    const gsPngs = fs.readdirSync(tmpDir)
                      .filter(f => f.startsWith(`${base}-page-`) && f.endsWith('.png'))
                      .map(f => path.join(tmpDir, f))
                      .sort();
                    for (const p of gsPngs) {
                      const buf = fs.readFileSync(p);
                      pngOutputs.push({ buffer: buf, filename: `${file.originalname || 'excel'}_${path.basename(p, '.png')}.png`, sheetName: path.basename(p, '.png') });
                    }
                  } catch (gsErr) {
                    console.warn('⚠️ [Excel 변환] ghostscript 래스터 실패:', gsErr.message);
                  }
                }

                // ghostscript가 없거나 실패하면 sharp로 페이지별 시도
                if (pngOutputs.length === 0) {
                  try {
                    // 일부 환경의 sharp는 PDF 지원이 없을 수 있음
                    const sharp = require('sharp');
                    // 페이지 수를 알 수 없으니 0..n 범위를 시도하며 실패 시 중단
                    for (let page = 0; page < 20; page++) {
                      try {
                        const buf = await sharp(pdfPath, { page, density: 200 }).png().toBuffer();
                        if (buf && buf.length > 0) {
                          pngOutputs.push({ buffer: buf, filename: `${file.originalname || 'excel'}_page-${String(page + 1).padStart(2, '0')}.png`, sheetName: `page-${page + 1}` });
                        } else {
                          break;
                        }
                      } catch {
                        // 더 이상 페이지가 없으면 중단
                        if (page === 0) throw new Error('sharp PDF 렌더 실패');
                        break;
                      }
                    }
                  } catch (sharpErr) {
                    console.warn('⚠️ [Excel 변환] sharp PDF 렌더 실패:', sharpErr.message);
                  }
                }
              }
            } catch (pdfErr) {
              console.warn('⚠️ [Excel 변환] soffice PDF 변환 실패:', pdfErr.message);
            }
          }
        }

        if (pngOutputs.length > 0) {
          // LibreOffice/GS/Sharp 경로 중 하나로 성공했으면 그 결과 사용
          imageBuffers = pngOutputs;
        }

        // 2) LibreOffice 경로가 실패하면 기존 HTML→Puppeteer → Canvas 폴백으로 진행
        if (imageBuffers.length === 0) {
          // 먼저 HTML로 변환 시도 (기존 로직)
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        
        const imageBuffersFromHTML = [];
        for (let i = 0; i < workbook.worksheets.length; i++) {
          const worksheet = workbook.worksheets[i];
          const html = convertExcelToHTML(worksheet);
          
          // Puppeteer로 HTML을 이미지로 변환 (한글 폰트 확실히 로드)
          try {
            const puppeteer = require('puppeteer');
            
            // Puppeteer 설정: Chrome 자동 다운로드 허용
            const launchOptions = {
              headless: true,
              args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--font-render-hinting=none', // 폰트 렌더링 힌팅 비활성화
                '--disable-font-subpixel-positioning' // 폰트 서브픽셀 위치 지정 비활성화
              ]
            };
            
            // 환경 변수로 Chrome 경로가 지정된 경우에만 사용
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
              launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }
            
            const browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            
            // 뷰포트 설정 (한글 렌더링 개선)
            await page.setViewport({
              width: 1920,
              height: 1080,
              deviceScaleFactor: 2 // 고해상도로 렌더링
            });
            
            // HTML 콘텐츠 설정 (폰트 로드 대기)
            await page.setContent(html, { 
              waitUntil: 'networkidle0',
              timeout: 60000 // 타임아웃 증가
            });
            
            // Google Fonts 로드 대기
            await page.evaluateHandle(() => {
              return document.fonts.ready;
            });
            
            // 폰트가 실제로 로드되었는지 확인
            await page.evaluate(async () => {
              // Noto Sans KR 폰트가 로드되었는지 확인
              const checkFont = async () => {
                try {
                  await document.fonts.load('400 16px "Noto Sans KR"');
                  await document.fonts.load('500 16px "Noto Sans KR"');
                  await document.fonts.load('700 16px "Noto Sans KR"');
                  return true;
                } catch (e) {
                  return false;
                }
              };
              
              const fontLoaded = await checkFont();
              if (!fontLoaded) {
                console.warn('⚠️ [Excel 변환] Noto Sans KR 폰트 로드 실패, 시스템 폰트 사용');
              }
              
              // 모든 요소에 폰트 강제 적용
              const koreanFonts = '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", "AppleGothic", "Apple SD Gothic Neo", "NanumGothic", "Nanum Gothic", "Noto Sans CJK KR", "Gulim", "굴림", "Batang", "바탕", sans-serif';
              const allElements = document.querySelectorAll('*');
              allElements.forEach(el => {
                el.style.fontFamily = koreanFonts;
                el.style.fontFeatureSettings = 'normal';
                el.style.fontVariant = 'normal';
                el.style.textRendering = 'optimizeLegibility';
                el.style.webkitFontSmoothing = 'antialiased';
                el.style.mozOsxFontSmoothing = 'grayscale';
              });
              
              // 강제 리플로우 트리거 (렌더링 강제)
              const forceReflow = () => {
                document.body.offsetHeight;
                document.body.style.display = 'none';
                document.body.offsetHeight;
                document.body.style.display = '';
                document.body.offsetHeight;
              };
              forceReflow();
            });
            
            // 폰트 적용 후 충분한 대기 시간 (Google Fonts 로드 대기)
            await page.waitForTimeout(2000);
            
            // 한글 텍스트가 제대로 렌더링되었는지 확인
            await page.evaluate(() => {
              // 테이블의 모든 텍스트 확인
              const cells = document.querySelectorAll('th, td');
              let hasKorean = false;
              cells.forEach(cell => {
                const text = cell.textContent || '';
                // 한글 유니코드 범위 확인 (AC00-D7A3)
                if (/[\uAC00-\uD7A3]/.test(text)) {
                  hasKorean = true;
                }
              });
              
              if (!hasKorean) {
                console.warn('⚠️ [Excel 변환] 한글 텍스트가 감지되지 않았습니다.');
              }
            });
            
            // 스크린샷 촬영 (고해상도)
            const screenshot = await page.screenshot({
              type: 'png',
              fullPage: true,
              encoding: 'binary'
            });
            
            await browser.close();
            
            // Excel 변환 이미지도 자동 크롭 처리
            const croppedResult = await autoCropImage(screenshot);
            imageBuffersFromHTML.push({
              buffer: croppedResult.buffer,
              filename: `${file.originalname || 'excel'}_${worksheet.name}.png`,
              sheetName: worksheet.name,
              metadata: {
                originalWidth: croppedResult.originalWidth,
                originalHeight: croppedResult.originalHeight,
                croppedWidth: croppedResult.croppedWidth,
                croppedHeight: croppedResult.croppedHeight
              }
            });
          } catch (puppeteerError) {
            console.warn('⚠️ [Excel 변환] Puppeteer 변환 실패, Canvas로 재시도:', puppeteerError.message);
            // Puppeteer 실패 시 Canvas로 폴백
            const canvasImages = await convertExcelToImages(file.buffer, file.originalname || 'excel');
            // Canvas로 변환된 이미지들도 자동 크롭 처리
            imageBuffers = await Promise.all(canvasImages.map(async (img) => {
              const croppedResult = await autoCropImage(img.buffer);
              return {
                ...img,
                buffer: croppedResult.buffer,
                metadata: {
                  originalWidth: croppedResult.originalWidth,
                  originalHeight: croppedResult.originalHeight,
                  croppedWidth: croppedResult.croppedWidth,
                  croppedHeight: croppedResult.croppedHeight
                }
              };
            }));
            break; // Canvas 방식으로 전환했으므로 루프 종료
          }
        }
        
          if (imageBuffersFromHTML.length > 0) {
            imageBuffers = imageBuffersFromHTML;
          } else {
            // Puppeteer가 없으면 Canvas로 폴백
            const canvasImages = await convertExcelToImages(file.buffer, file.originalname || 'excel');
            // Canvas로 변환된 이미지들도 자동 크롭 처리
            imageBuffers = await Promise.all(canvasImages.map(async (img) => {
              const croppedResult = await autoCropImage(img.buffer);
              return {
                ...img,
                buffer: croppedResult.buffer,
                metadata: {
                  originalWidth: croppedResult.originalWidth,
                  originalHeight: croppedResult.originalHeight,
                  croppedWidth: croppedResult.croppedWidth,
                  croppedHeight: croppedResult.croppedHeight
                }
              };
            }));
          }
        }
      } catch (excelError) {
        // CORS 헤더 설정 (에러 응답에도 포함)
        setCORSHeaders(req, res);
        console.error('Excel 변환 오류:', excelError);
        // Canvas가 없는 경우 더 명확한 에러 메시지
        if (excelError.message.includes('Canvas')) {
          return res.status(503).json({ 
            success: false, 
            error: 'Excel 파일 변환 기능을 사용하려면 서버에 Canvas 모듈 또는 Puppeteer가 설치되어 있어야 합니다. 관리자에게 문의하세요.' 
          });
        }
        return res.status(500).json({ 
          success: false, 
          error: `Excel 변환 실패: ${excelError.message}` 
        });
      }
    } else if (detectedFileType === 'ppt') {
      // PPT 파일 변환
      try {
        const pptImages = await convertPPTToImages(file.buffer, file.originalname || 'presentation');
        // PPT 변환 이미지도 자동 크롭 처리
        imageBuffers = await Promise.all(pptImages.map(async (img) => {
          const croppedResult = await autoCropImage(img.buffer);
          return {
            ...img,
            buffer: croppedResult.buffer,
            metadata: {
              originalWidth: croppedResult.originalWidth,
              originalHeight: croppedResult.originalHeight,
              croppedWidth: croppedResult.croppedWidth,
              croppedHeight: croppedResult.croppedHeight
            }
          };
        }));
      } catch (pptError) {
        // CORS 헤더 설정 (에러 응답에도 포함)
        setCORSHeaders(req, res);
        console.error('PPT 변환 오류:', pptError);
        return res.status(500).json({ 
          success: false, 
          error: `PPT 변환 실패: ${pptError.message}` 
        });
      }
    } else if (detectedFileType === 'video') {
      // 동영상 파일 업로드
      try {
        console.log(`🎬 [uploadCustomSlideFile] 동영상 파일 업로드 시작: ${file.originalname}`);
        
        // 회의 정보 조회 (차수 가져오기) - 동영상 업로드 전에 필요
        let meetingNumber = bodyMeetingNumber ? parseInt(bodyMeetingNumber) : null;
        const isTempMeeting = meetingId === 'temp-custom-slide';
        
        if (!meetingNumber && !isTempMeeting) {
          try {
            const { sheets, SPREADSHEET_ID } = createSheetsClient();
            const sheetName = '회의목록';
            const range = `${sheetName}!A3:G`;
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range
            });
            
            const rows = response.data.values || [];
            const meetingRow = rows.find(row => row[0] === meetingId);
            
            if (meetingRow && meetingRow[3]) {
              meetingNumber = parseInt(meetingRow[3]);
            }
          } catch (meetingError) {
            console.warn('회의 정보 조회 실패:', meetingError);
          }
        }
        
        const uploadMeetingId = isTempMeeting 
          ? `temp-${meetingDate || new Date().toISOString().split('T')[0]}` 
          : meetingId;
        const finalMeetingDate = meetingDate || new Date().toISOString().split('T')[0];
        
        // Discord에 동영상 업로드
        const result = await uploadVideoToDiscord(
          file.buffer,
          file.originalname || `video-${Date.now()}.mp4`,
          uploadMeetingId,
          finalMeetingDate,
          meetingNumber,
          '커스텀'
        );
        
        console.log(`✅ [uploadCustomSlideFile] 동영상 업로드 완료: ${result.videoUrl}`);
        
        // 동영상 URL 반환
        res.json({
          success: true,
          videoUrl: result.videoUrl,
          postId: result.postId,
          threadId: result.threadId,
          fileType: 'video'
        });
        return;
      } catch (videoError) {
        // CORS 헤더 설정 (에러 응답에도 포함)
        setCORSHeaders(req, res);
        console.error('동영상 업로드 오류:', videoError);
        return res.status(500).json({ 
          success: false, 
          error: `동영상 업로드 실패: ${videoError.message}` 
        });
      }
    } else {
      // CORS 헤더 설정 (에러 응답에도 포함)
      setCORSHeaders(req, res);
      return res.status(400).json({ 
        success: false, 
        error: '지원하지 않는 파일 형식입니다.' 
      });
    }
    
    // 회의 정보 조회 (차수 가져오기)
    let meetingNumber = bodyMeetingNumber ? parseInt(bodyMeetingNumber) : null;
    const isTempMeeting = meetingId === 'temp-custom-slide';
    
    console.log(`🔍 [uploadCustomSlideFile] 초기 상태:`, {
      meetingId,
      bodyMeetingNumber,
      meetingNumber,
      isTempMeeting,
      meetingDate
    });
    
    // body에서 meetingNumber를 받지 못한 경우, Google Sheets에서 조회
    if (!meetingNumber && !isTempMeeting) {
      try {
        const { sheets, SPREADSHEET_ID } = createSheetsClient();
        const sheetName = '회의목록';
        const range = `${sheetName}!A3:G`;
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range
        });
        
        const rows = response.data.values || [];
        const meetingRow = rows.find(row => row[0] === meetingId);
        
        if (meetingRow && meetingRow[3]) {
          meetingNumber = parseInt(meetingRow[3]);
          console.log(`📋 [uploadCustomSlideFile] 회의 차수 조회 (Google Sheets): ${meetingNumber}차`);
        } else {
          console.warn(`⚠️ [uploadCustomSlideFile] 회의 정보를 찾을 수 없습니다: ${meetingId}`);
        }
      } catch (meetingError) {
        console.warn('회의 정보 조회 실패:', meetingError);
      }
    } else if (meetingNumber) {
      console.log(`📋 [uploadCustomSlideFile] 회의 차수 (요청 본문에서): ${meetingNumber}차`);
    } else if (isTempMeeting) {
      // 임시 회의인 경우, meetingNumber가 없으면 null로 유지
      console.log('📋 [uploadCustomSlideFile] 임시 회의 (커스텀 슬라이드), meetingNumber 없음');
      
      // 임시 회의인 경우에도 meetingDate를 사용하여 같은 포스트를 찾도록 시도
      // 하지만 meetingNumber가 없으면 다른 포스트가 생성될 수 있음
      if (!meetingNumber && meetingDate) {
        console.warn('⚠️ [uploadCustomSlideFile] 임시 회의에서 meetingNumber가 없습니다. meetingDate만 사용하여 포스트를 찾습니다.');
      }
    }
    
    // 최종 meetingNumber 확인 및 로깅
    console.log(`📋 [uploadCustomSlideFile] 최종 meetingNumber: ${meetingNumber}, meetingDate: ${meetingDate}, isTempMeeting: ${isTempMeeting}`);
    
    // 각 이미지를 Discord에 업로드
    // 임시 회의인 경우에도 meetingDate와 meetingNumber를 사용하여 같은 포스트에 저장되도록 함
    const imageUrls = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const imageData = imageBuffers[i];
      
      // Discord 업로드 시 meetingId는 실제 meetingId를 사용하되, 
      // meetingNumber와 meetingDate를 명시적으로 전달하여 같은 포스트를 찾도록 함
      // 임시 회의인 경우에도 meetingNumber가 있으면 사용하여 같은 포스트를 찾도록 함
      const uploadMeetingId = isTempMeeting 
        ? `temp-${meetingDate || new Date().toISOString().split('T')[0]}` 
        : meetingId;
      
      // meetingNumber를 명시적으로 전달하여 같은 포스트를 찾도록 함
      // 임시 회의인 경우에도 meetingNumber가 있으면 사용
      // meetingNumber가 없으면 meetingDate만 사용하여 포스트를 찾도록 함
      const finalMeetingNumber = meetingNumber || null;
      
      // meetingDate가 없으면 오늘 날짜 사용
      const finalMeetingDate = meetingDate || new Date().toISOString().split('T')[0];
      
      console.log(`📤 [uploadCustomSlideFile] Discord 업로드 시작 (${i + 1}/${imageBuffers.length}):`, {
        uploadMeetingId,
        meetingDate: finalMeetingDate,
        meetingNumber: finalMeetingNumber,
        isTempMeeting,
        filename: imageData.filename
      });
      
      // 검색을 위한 추적 강화를 위해 파일명 개선
      const generatedFilename = `custom-${finalMeetingDate}-${uploadMeetingId}-${i + 1}.png`;
      const result = await uploadImageToDiscord(
        imageData.buffer,
        generatedFilename,
        uploadMeetingId,
        finalMeetingDate,
        finalMeetingNumber, // meetingNumber를 명시적으로 전달하여 같은 포스트를 찾도록 함
        '커스텀',
        imageData.metadata || null // 메타데이터 전달
      );
      
      console.log(`✅ [uploadCustomSlideFile] Discord 업로드 완료 (${i + 1}/${imageBuffers.length}):`, {
        imageUrl: result.imageUrl,
        postId: result.postId,
        threadId: result.threadId
      });
      
      imageUrls.push({
        imageUrl: result.imageUrl,
        originalWidth: result.originalWidth,
        originalHeight: result.originalHeight,
        croppedWidth: result.croppedWidth,
        croppedHeight: result.croppedHeight
      });
      console.log(`✅ [uploadCustomSlideFile] 이미지 ${i + 1}/${imageBuffers.length} 업로드 완료: ${result.imageUrl}`);
    }
    
    // 여러 이미지인 경우 imageUrls 배열 반환, 단일 이미지인 경우 imageUrl 반환
    if (imageUrls.length === 1) {
      res.json({
        success: true,
        imageUrl: imageUrls[0].imageUrl,
        imageUrls: imageUrls.map(img => img.imageUrl),
        // 메타데이터 포함
        originalWidth: imageUrls[0].originalWidth,
        originalHeight: imageUrls[0].originalHeight,
        croppedWidth: imageUrls[0].croppedWidth,
        croppedHeight: imageUrls[0].croppedHeight,
        metadata: imageUrls
      });
    } else {
      res.json({
        success: true,
        imageUrls: imageUrls.map(img => img.imageUrl),
        imageUrl: imageUrls[0]?.imageUrl || null, // 첫 번째 이미지를 기본으로
        metadata: imageUrls // 모든 이미지의 메타데이터
      });
    }
  } catch (error) {
    // CORS 헤더 설정 (에러 응답에도 포함)
    setCORSHeaders(req, res);
    
    console.error('파일 업로드 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Discord CDN 이미지 프록시 (CORS 문제 해결)
async function proxyDiscordImage(req, res) {
  try {
    // CORS 헤더 설정
    setCORSHeaders(req, res);
    
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).json({ 
        success: false, 
        error: '이미지 URL이 필요합니다.' 
      });
    }
    
    // Discord CDN URL인지 확인
    if (!imageUrl.includes('cdn.discordapp.com')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Discord CDN URL만 허용됩니다.' 
      });
    }
    
    // Discord CDN에서 이미지 가져오기 (Node.js 내장 https 모듈 사용)
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    let contentType = 'image/png'; // 기본값
    
    const imageBuffer = await new Promise((resolve, reject) => {
      const parsedUrl = new URL(imageUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const request = protocol.get(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`이미지 가져오기 실패: ${response.statusCode} ${response.statusMessage}`));
          return;
        }
        
        // Content-Type 가져오기
        contentType = response.headers['content-type'] || 'image/png';
        
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
      
      request.on('error', reject);
      request.end();
    });
    
    // 이미지 응답 전송
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    res.send(imageBuffer);
  } catch (error) {
    console.error('Discord 이미지 프록시 오류:', error);
    // CORS 헤더 설정 (에러 응답에도 포함)
    setCORSHeaders(req, res);
    res.status(500).json({ 
      success: false, 
      error: '이미지를 가져오는데 실패했습니다.',
      message: error.message 
    });
  }
}

module.exports = {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingConfig,
  saveMeetingConfig,
  uploadMeetingImage,
  uploadCustomSlideFile,
  proxyDiscordImage,
  upload // multer middleware
};

// ========== Discord Thread Title Utilities (GET/RENAME) ==========

// 스레드 정보 조회 (제목 확인)
async function getDiscordThreadInfo(req, res) {
  try {
    setCORSHeaders(req, res);
    if (!DISCORD_LOGGING_ENABLED || !discordBot) {
      return res.status(503).json({ success: false, error: 'Discord 봇이 활성화되지 않았습니다.' });
    }
    const { threadId } = req.params;
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'threadId가 필요합니다.' });
    }
    if (!discordBot.isReady()) {
      return res.status(503).json({ success: false, error: 'Discord 봇 준비 중입니다.' });
    }
    const thread = await discordBot.channels.fetch(threadId);
    if (!thread) {
      return res.status(404).json({ success: false, error: '해당 스레드를 찾을 수 없습니다.' });
    }
    return res.json({
      success: true,
      threadId: thread.id,
      name: thread.name
    });
  } catch (error) {
    setCORSHeaders(req, res);
    console.error('Discord 스레드 조회 오류:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// 스레드 제목 변경
async function renameDiscordThread(req, res) {
  try {
    setCORSHeaders(req, res);
    if (!DISCORD_LOGGING_ENABLED || !discordBot) {
      return res.status(503).json({ success: false, error: 'Discord 봇이 활성화되지 않았습니다.' });
    }
    const { threadId } = req.params;
    const { desiredTitle } = req.body || {};
    if (!threadId) {
      return res.status(400).json({ success: false, error: 'threadId가 필요합니다.' });
    }
    if (!desiredTitle || typeof desiredTitle !== 'string' || !desiredTitle.trim()) {
      return res.status(400).json({ success: false, error: 'desiredTitle이 필요합니다.' });
    }
    const title = desiredTitle.trim().slice(0, 100); // Discord 스레드명 길이 제한 보호
    if (!discordBot.isReady()) {
      return res.status(503).json({ success: false, error: 'Discord 봇 준비 중입니다.' });
    }
    const thread = await discordBot.channels.fetch(threadId);
    if (!thread) {
      return res.status(404).json({ success: false, error: '해당 스레드를 찾을 수 없습니다.' });
    }
    await thread.setName(title);
    console.log(`✅ [Discord] 스레드 이름 변경 완료: ${threadId} → ${title}`);
    return res.json({ success: true, threadId, name: title });
  } catch (error) {
    setCORSHeaders(req, res);
    console.error('Discord 스레드 제목 변경 오류:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// 내보내기
module.exports.getDiscordThreadInfo = getDiscordThreadInfo;
module.exports.renameDiscordThread = renameDiscordThread;

// 단일 슬라이드 이미지 URL 업데이트
async function updateSlideImageUrl(req, res) {
  try {
    setCORSHeaders(req, res);
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const { meetingId } = req.params;
    const { slideId, imageUrl } = req.body || {};
    const sheetName = '회의설정';
    if (!meetingId || !slideId || !imageUrl) {
      return res.status(400).json({ success: false, error: 'meetingId, slideId, imageUrl가 필요합니다.' });
    }
    // 데이터 조회
    const range = `${sheetName}!A3:T`;
    const response = await retrySheetsOperation(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range
      });
    });
    const rows = response.data.values || [];
    // 행 찾기 (A:회의ID, B:슬라이드ID)
    const rowIndex = rows.findIndex(row => row[0] === meetingId && row[1] === slideId);
    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: '해당 슬라이드를 찾을 수 없습니다.' });
    }
    // 이미지URL은 10번째 컬럼(J) → zero-based index 9
    const targetRowNumber = 3 + rowIndex; // 데이터 시작이 3행
    const targetCell = `${sheetName}!J${targetRowNumber}`;
    await retrySheetsOperation(async () => {
      return await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: targetCell,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[imageUrl]] }
      });
    });
    return res.json({ success: true, row: targetRowNumber, imageUrl });
  } catch (error) {
    setCORSHeaders(req, res);
    console.error('단일 슬라이드 이미지 URL 업데이트 오류:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports.updateSlideImageUrl = updateSlideImageUrl;
