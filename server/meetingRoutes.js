require('dotenv').config();
const { google } = require('googleapis');
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');

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

// 시트 헤더 확인 및 생성
async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  try {
    // 시트 존재 여부 확인
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(sheet => sheet.properties.title === sheetName);

    if (!sheetExists) {
      // 시트 생성
      await sheets.spreadsheets.batchUpdate({
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
    }

    // 헤더 확인 및 설정
    const headerRange = `${sheetName}!A2:${String.fromCharCode(64 + headers.length)}2`;
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange
    });

    const existingHeaders = headerResponse.data.values?.[0] || [];
    if (existingHeaders.length === 0 || existingHeaders.join('|') !== headers.join('|')) {
      // 헤더 설정 (1행은 비우고 2행에 헤더)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: headerRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers]
        }
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

// 회의 설정 조회
async function getMeetingConfig(req, res) {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const { meetingId } = req.params;
    const sheetName = '회의설정';

    // 시트 헤더 확인
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '슬라이드ID', '순서', '타입', '모드', '탭', '제목', '내용', '배경색', '이미지URL', '캡처시간', 'Discord포스트ID', 'Discord스레드ID'
    ]);

    // 데이터 조회
    const range = `${sheetName}!A3:M`;
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
          title: row[6] || '',
          content: row[7] || '',
          backgroundColor: row[8] || '#ffffff',
          imageUrl: row[9] || '',
          capturedAt: row[10] || '',
          discordPostId: row[11] || '',
          discordThreadId: row[12] || '',
          // 메인 슬라이드 필드 (있으면 사용)
          meetingDate: row[13] || '',
          meetingNumber: row[14] ? parseInt(row[14]) : undefined,
          meetingLocation: row[15] || '',
          participants: row[16] || '',
          createdBy: row[17] || ''
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
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const { meetingId } = req.params;
    const { slides } = req.body;
    const sheetName = '회의설정';

    if (!Array.isArray(slides)) {
      return res.status(400).json({ success: false, error: '슬라이드 배열이 필요합니다.' });
    }

    // 시트 헤더 확인
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '슬라이드ID', '순서', '타입', '모드', '탭', '제목', '내용', '배경색', '이미지URL', '캡처시간', 'Discord포스트ID', 'Discord스레드ID'
    ]);

    // 기존 데이터 조회 (메인 슬라이드 필드 포함)
    const range = `${sheetName}!A3:R`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range
    });

    const existingRows = response.data.values || [];
    console.log(`📋 [saveMeetingConfig] 기존 행 수: ${existingRows.length}, 저장할 슬라이드 수: ${slides.length}`);
    
    // 각 슬라이드를 개별적으로 업데이트 또는 추가
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideId = slide.slideId || slide.id || `slide-${slide.order}`;
      
      console.log(`\n🔄 [saveMeetingConfig] 슬라이드 ${i + 1}/${slides.length} 처리 시작:`, {
        slideId,
        order: slide.order,
        mode: slide.mode,
        tab: slide.tab,
        subTab: slide.subTab,
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
      
      // 메인 슬라이드의 경우 추가 필드 포함
      const newRow = [
        meetingId,
        slideId,
        slide.order || 0,
        slide.type || 'mode-tab',
        slide.mode || '',
        tabValue,
        slide.title || '',
        slide.content || '',
        slide.backgroundColor || '#ffffff',
        slide.imageUrl || '',
        slide.capturedAt || '',
        slide.discordPostId || '',
        slide.discordThreadId || '',
        slide.meetingDate || '', // 메인 슬라이드용
        slide.meetingNumber || '', // 메인 슬라이드용
        slide.meetingLocation || '', // 메인 슬라이드용
        slide.participants || '', // 메인 슬라이드용
        slide.createdBy || '' // 메인 슬라이드용
      ];

      if (existingRowIndex !== -1) {
        // 기존 슬라이드 업데이트 (메인 슬라이드 필드 포함)
        const updateRange = `${sheetName}!A${existingRowIndex + 3}:R${existingRowIndex + 3}`;
        console.log(`📝 [saveMeetingConfig] 기존 슬라이드 업데이트 시작: 범위 ${updateRange}`);
        const updateResult = await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRow]
          }
        });
        console.log(`✅ [saveMeetingConfig] 업데이트 완료:`, {
          updatedCells: updateResult.data.updatedCells,
          updatedRange: updateResult.data.updatedRange,
          imageUrl: slide.imageUrl || '없음'
        });
        // 기존 행 데이터도 업데이트 (다음 반복을 위해)
        existingRows[existingRowIndex] = newRow;
      } else {
        // 새 슬라이드 추가
        console.log(`📝 [saveMeetingConfig] 새 슬라이드 추가 시작`);
        const appendResult = await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A3`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRow]
          }
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
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`\n✅ [saveMeetingConfig] 모든 슬라이드 저장 완료 (${slides.length}개)`);

    res.json({ success: true });
  } catch (error) {
    console.error('회의 설정 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Discord 포럼 게시판에서 년월별 포스트 찾기 또는 생성 (차수별)
async function findOrCreatePost(channel, yearMonth, meetingNumber) {
  try {
    // 포스트 이름 생성 (예: "2025-11 회의 - 1차")
    const postName = meetingNumber 
      ? `${yearMonth} 회의 - ${meetingNumber}차`
      : `${yearMonth} 회의`;
    
    console.log(`🔍 [findOrCreatePost] 포스트 찾기 시작:`, {
      yearMonth,
      meetingNumber,
      postName
    });
    
    // 포럼 채널의 활성 포스트 가져오기
    const activeThreads = await channel.threads.fetchActive();
    
    // 활성 스레드에서 차수별 포스트 찾기
    // meetingNumber가 있으면 정확히 일치하는 포스트를 찾고, 없으면 yearMonth만 일치하는 포스트를 찾음
    let post = Array.from(activeThreads.threads.values()).find(thread => {
      if (meetingNumber) {
        // meetingNumber가 있으면 정확히 일치하는 포스트를 찾음
        const matches = thread.name === postName || 
          thread.name === `${yearMonth} 회의 - ${meetingNumber}차`;
        if (matches) {
          console.log(`✅ [findOrCreatePost] 활성 포스트 찾음 (차수 일치): ${thread.name} (ID: ${thread.id})`);
        }
        return matches;
      } else {
        // meetingNumber가 없으면 yearMonth만 일치하는 포스트를 찾음 (가장 최근 것)
        const matches = thread.name.startsWith(`${yearMonth} 회의`);
        if (matches) {
          console.log(`✅ [findOrCreatePost] 활성 포스트 찾음 (년월 일치, 차수 없음): ${thread.name} (ID: ${thread.id})`);
        }
        return matches;
      }
    });
    
    if (post) {
      console.log(`📌 [Discord] 기존 포스트 찾음: ${post.name} (ID: ${post.id})`);
      return post;
    }
    
    // 아카이브된 스레드도 확인
    try {
      const archivedThreads = await channel.threads.fetchArchived({ limit: 100 });
      post = Array.from(archivedThreads.threads.values()).find(thread => {
        if (meetingNumber) {
          // meetingNumber가 있으면 정확히 일치하는 포스트를 찾음
          const matches = thread.name === postName || 
            thread.name === `${yearMonth} 회의 - ${meetingNumber}차`;
          if (matches) {
            console.log(`✅ [findOrCreatePost] 아카이브된 포스트 찾음 (차수 일치): ${thread.name} (ID: ${thread.id})`);
          }
          return matches;
        } else {
          // meetingNumber가 없으면 yearMonth만 일치하는 포스트를 찾음 (가장 최근 것)
          const matches = thread.name.startsWith(`${yearMonth} 회의`);
          if (matches) {
            console.log(`✅ [findOrCreatePost] 아카이브된 포스트 찾음 (년월 일치, 차수 없음): ${thread.name} (ID: ${thread.id})`);
          }
          return matches;
        }
      });
      
      if (post) {
        console.log(`📌 [Discord] 아카이브된 포스트 찾음: ${postName} (ID: ${post.id})`);
        return post;
      }
    } catch (archivedError) {
      console.warn('아카이브된 스레드 조회 실패:', archivedError);
      // 계속 진행
    }
    
    // 포스트 생성 (포럼 채널에서는 스레드 생성)
    console.log(`📌 [Discord] 새 포스트 생성: ${postName}`);
    const newPost = await channel.threads.create({
      name: postName,
      message: {
        content: `${postName} 이미지 저장`
      },
      appliedTags: []
    });
    
    console.log(`✅ [Discord] 새 포스트 생성 완료: ${postName} (ID: ${newPost.id})`);
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

// 이미지 업로드 (Discord)
async function uploadImageToDiscord(imageBuffer, filename, meetingId, meetingDate, meetingNumber) {
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
    let post = await findOrCreatePost(channel, yearMonth, meetingNumber);
    
    // 회의 스레드 찾기 또는 생성 (현재는 포스트를 그대로 사용)
    let thread = post;
    
    // 이미지 업로드
    const attachment = new AttachmentBuilder(imageBuffer, { name: filename });
    const message = await thread.send({ files: [attachment] });
    
    return {
      imageUrl: message.attachments.first().url,
      postId: post.id,
      threadId: thread.id
    };
  } catch (error) {
    console.error('Discord 이미지 업로드 오류:', error);
    throw error;
  }
}

// 이미지 업로드 API
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB 제한
});

async function uploadMeetingImage(req, res) {
  try {
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
    
    // Discord에 업로드
    const result = await uploadImageToDiscord(
      req.file.buffer,
      filename,
      isTempMeeting ? `temp-${meetingDate || new Date().toISOString().split('T')[0]}` : meetingId,
      meetingDate || new Date().toISOString().split('T')[0],
      meetingNumber // meetingNumber를 명시적으로 전달하여 같은 포스트를 찾도록 함
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
      threadId: result.threadId
    });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Excel 파일을 이미지로 변환
async function convertExcelToImages(excelBuffer, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);
    
    const imageBuffers = [];
    
    // 각 워크시트를 이미지로 변환
    for (let i = 0; i < workbook.worksheets.length; i++) {
      const worksheet = workbook.worksheets[i];
      const sheetName = worksheet.name;
      
      console.log(`📊 [Excel 변환] 시트 "${sheetName}" 처리 중...`);
      
      // Excel 데이터를 이미지로 변환
      const imageBuffer = await convertExcelToImage(worksheet, `${filename}_${sheetName}`);
      
      if (!imageBuffer) {
        // Canvas가 없는 경우 HTML로 변환하여 반환 (나중에 puppeteer로 처리 가능)
        console.warn(`⚠️ [Excel 변환] Canvas가 없어 시트 "${sheetName}"을 이미지로 변환할 수 없습니다.`);
        continue;
      }
      imageBuffers.push({
        buffer: imageBuffer,
        filename: `${filename}_${sheetName}.png`,
        sheetName: sheetName
      });
    }
    
    return imageBuffers;
  } catch (error) {
    console.error('Excel 변환 오류:', error);
    throw new Error(`Excel 파일 변환 실패: ${error.message}`);
  }
}

// Excel 워크시트를 HTML로 변환
function convertExcelToHTML(worksheet) {
  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += 'body { font-family: "Malgun Gothic", "AppleGothic", "NanumGothic", "Noto Sans CJK KR", Arial, sans-serif; margin: 20px; }';
  html += 'table { border-collapse: collapse; width: 100%; }';
  html += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }';
  html += 'th { background-color: #4a90e2; color: white; font-weight: bold; }';
  html += 'tr:nth-child(even) { background-color: #f8f9fa; }';
  html += 'tr:hover { background-color: #f0f0f0; }';
  html += 'h2 { color: #333; margin-bottom: 20px; }';
  html += '</style></head><body>';
  html += `<h2>${worksheet.name || 'Sheet'}</h2>`;
  html += '<table>';
  
  // 헤더 행
  const headerRow = worksheet.getRow(1);
  if (headerRow && headerRow.values && headerRow.values.length > 1) {
    html += '<thead><tr>';
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      html += `<th>${cell.value || ''}</th>`;
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
      html += `<td>${value}</td>`;
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
    
    // 한글 폰트 등록 시도 (시스템 폰트 사용)
    // Windows: 'Malgun Gothic', 'Gulim', 'Batang'
    // Linux: 'Noto Sans CJK KR', 'NanumGothic', 'DejaVu Sans'
    // macOS: 'AppleGothic', 'NanumGothic'
    const koreanFonts = [
      'Malgun Gothic',      // Windows
      'Gulim',              // Windows
      'Batang',             // Windows
      'Noto Sans CJK KR',   // Linux
      'NanumGothic',       // Linux/macOS
      'AppleGothic',        // macOS
      'Arial Unicode MS',   // 범용
      'sans-serif'          // 폴백
    ];
    
    // 한글을 지원하는 폰트 찾기
    let fontFamily = 'Arial';
    try {
      // 시스템 폰트 목록 확인 (canvas는 기본적으로 시스템 폰트를 사용)
      // 실제로는 첫 번째로 시도할 폰트를 설정
      fontFamily = koreanFonts[0]; // 기본값으로 Malgun Gothic 시도
    } catch (fontError) {
      console.warn('⚠️ [Excel 변환] 폰트 등록 실패, 기본 폰트 사용:', fontError.message);
    }
    
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
    ctx.font = `bold 36px "${fontFamily}", Arial, sans-serif`;
    const title = worksheet.name || filename;
    // 한글 텍스트 렌더링
    try {
      ctx.fillText(title, padding, 50);
    } catch (textError) {
      console.warn('⚠️ [Excel 변환] 제목 렌더링 오류, 기본 폰트로 재시도:', textError.message);
      ctx.font = 'bold 36px Arial';
      ctx.fillText(title, padding, 50);
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
      ctx.font = `bold 18px "${fontFamily}", Arial, sans-serif`;
      let xPos = startX + 10;
      headerRow.forEach((cell, colIndex) => {
        const text = cell.value || '';
        // 텍스트가 너무 길면 자르기
        const displayText = text.length > 25 ? text.substring(0, 22) + '...' : text;
        try {
          ctx.fillText(displayText, xPos, yPos + 25);
        } catch (textError) {
          // 폰트 오류 시 기본 폰트로 재시도
          ctx.font = 'bold 18px Arial';
          ctx.fillText(displayText, xPos, yPos + 25);
          ctx.font = `bold 18px "${fontFamily}", Arial, sans-serif`;
        }
        xPos += colWidth;
      });
      yPos += rowHeight;
    }
    
    // 데이터 행
    ctx.font = `16px "${fontFamily}", Arial, sans-serif`;
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
        const text = cell.value || '';
        // 텍스트가 너무 길면 자르기
        const displayText = text.length > 25 ? text.substring(0, 22) + '...' : text;
        try {
          ctx.fillText(displayText, xPos, yPos + 25);
        } catch (textError) {
          // 폰트 오류 시 기본 폰트로 재시도
          ctx.font = '16px Arial';
          ctx.fillText(displayText, xPos, yPos + 25);
          ctx.font = `16px "${fontFamily}", Arial, sans-serif`;
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
    // 방법 1: LibreOffice 사용 (서버에 LibreOffice 설치 필요)
    // const { exec } = require('child_process');
    // const fs = require('fs');
    // const path = require('path');
    // const os = require('os');
    // 
    // const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppt-convert-'));
    // const inputPath = path.join(tempDir, `${filename}.pptx`);
    // const outputPath = path.join(tempDir, 'output');
    // 
    // fs.writeFileSync(inputPath, pptBuffer);
    // 
    // return new Promise((resolve, reject) => {
    //   exec(`libreoffice --headless --convert-to pdf --outdir "${outputPath}" "${inputPath}"`, (error) => {
    //     if (error) reject(error);
    //     // PDF를 이미지로 변환하는 로직 추가
    //   });
    // });

    // 방법 2: puppeteer 사용 (HTML로 변환 후 스크린샷)
    // const puppeteer = require('puppeteer');
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // // PPT를 HTML로 변환하는 로직 필요
    // await page.goto('data:text/html,...');
    // const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    // await browser.close();
    // return screenshot;

    // 임시: 에러 메시지 개선
    console.warn('⚠️ [PPT 변환] PPT 변환 기능은 아직 구현되지 않았습니다. LibreOffice 또는 puppeteer 설치가 필요합니다.');
    throw new Error('PPT 변환 기능은 아직 구현되지 않았습니다. 서버에 LibreOffice를 설치하거나 puppeteer를 사용하여 구현할 수 있습니다.');
  } catch (error) {
    console.error('PPT 변환 오류:', error);
    throw error;
  }
}

// 커스텀 슬라이드 파일 업로드 (이미지, Excel, PPT 지원)
async function uploadCustomSlideFile(req, res) {
  try {
    const { meetingId } = req.params;
    const { meetingDate, fileType, meetingNumber: bodyMeetingNumber } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 없습니다.' });
    }

    const file = req.file;
    const detectedFileType = fileType || (file.mimetype.startsWith('image/') ? 'image' : 'unknown');
    
    console.log(`📤 [uploadCustomSlideFile] 파일 업로드 시작: ${file.originalname}, 타입: ${detectedFileType}`);
    
    let imageBuffers = [];
    
    if (detectedFileType === 'image') {
      // 이미지 파일은 그대로 사용
      imageBuffers.push({
        buffer: file.buffer,
        filename: file.originalname || `image-${Date.now()}.png`,
        sheetName: null
      });
    } else if (detectedFileType === 'excel') {
      // Excel 파일 변환 (HTML + Puppeteer 방식으로 한글 지원)
      try {
        // 먼저 HTML로 변환 시도
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer);
        
        const imageBuffersFromHTML = [];
        for (let i = 0; i < workbook.worksheets.length; i++) {
          const worksheet = workbook.worksheets[i];
          const html = convertExcelToHTML(worksheet);
          
          // Puppeteer로 HTML을 이미지로 변환
          try {
            const puppeteer = require('puppeteer');
            const browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            
            // HTML 콘텐츠를 data URL로 설정
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            // 스크린샷 촬영
            const screenshot = await page.screenshot({
              type: 'png',
              fullPage: true,
              encoding: 'binary'
            });
            
            await browser.close();
            
            imageBuffersFromHTML.push({
              buffer: screenshot,
              filename: `${file.originalname || 'excel'}_${worksheet.name}.png`,
              sheetName: worksheet.name
            });
          } catch (puppeteerError) {
            console.warn('⚠️ [Excel 변환] Puppeteer 변환 실패, Canvas로 재시도:', puppeteerError.message);
            // Puppeteer 실패 시 Canvas로 폴백
            imageBuffers = await convertExcelToImages(file.buffer, file.originalname || 'excel');
            break; // Canvas 방식으로 전환했으므로 루프 종료
          }
        }
        
        if (imageBuffersFromHTML.length > 0) {
          imageBuffers = imageBuffersFromHTML;
        } else {
          // Puppeteer가 없으면 Canvas로 폴백
          imageBuffers = await convertExcelToImages(file.buffer, file.originalname || 'excel');
        }
      } catch (excelError) {
        console.error('Excel 변환 오류:', excelError);
        // Canvas가 없는 경우 더 명확한 에러 메시지
        if (excelError.message.includes('Canvas')) {
          return res.status(503).json({ 
            success: false, 
            error: 'Excel 파일 변환 기능을 사용하려면 서버에 Canvas 모듈 또는 Puppeteer가 설치되어 있어야 합니다. 관리자에게 문의하세요.' 
          });
        }
        throw excelError;
      }
    } else if (detectedFileType === 'ppt') {
      // PPT 파일 변환 (나중에 구현)
      return res.status(501).json({ 
        success: false, 
        error: 'PPT 변환 기능은 아직 구현되지 않았습니다.' 
      });
    } else {
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
      // 임시 회의인 경우, meetingNumber가 있으면 사용하고, 없으면 meetingDate만 사용
      const uploadMeetingId = isTempMeeting 
        ? `temp-${meetingDate || new Date().toISOString().split('T')[0]}` 
        : meetingId;
      
      // meetingNumber가 없으면 meetingDate만 사용하여 포스트를 찾도록 함
      // 하지만 이 경우 다른 포스트가 생성될 수 있으므로, 가능하면 meetingNumber를 전달해야 함
      const finalMeetingNumber = meetingNumber || (isTempMeeting ? null : null);
      
      console.log(`📤 [uploadCustomSlideFile] Discord 업로드 시작 (${i + 1}/${imageBuffers.length}):`, {
        uploadMeetingId,
        meetingDate,
        meetingNumber: finalMeetingNumber,
        isTempMeeting,
        filename: imageData.filename
      });
      
      const result = await uploadImageToDiscord(
        imageData.buffer,
        imageData.filename,
        uploadMeetingId,
        meetingDate || new Date().toISOString().split('T')[0],
        finalMeetingNumber // meetingNumber를 명시적으로 전달하여 같은 포스트를 찾도록 함
      );
      
      console.log(`✅ [uploadCustomSlideFile] Discord 업로드 완료 (${i + 1}/${imageBuffers.length}):`, {
        imageUrl: result.imageUrl,
        postId: result.postId,
        threadId: result.threadId
      });
      
      imageUrls.push(result.imageUrl);
      console.log(`✅ [uploadCustomSlideFile] 이미지 ${i + 1}/${imageBuffers.length} 업로드 완료: ${result.imageUrl}`);
    }
    
    // 여러 이미지인 경우 imageUrls 배열 반환, 단일 이미지인 경우 imageUrl 반환
    if (imageUrls.length === 1) {
      res.json({
        success: true,
        imageUrl: imageUrls[0],
        imageUrls: imageUrls
      });
    } else {
      res.json({
        success: true,
        imageUrls: imageUrls,
        imageUrl: imageUrls[0] // 첫 번째 이미지를 기본으로
      });
    }
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({ success: false, error: error.message });
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
  upload // multer middleware
};

