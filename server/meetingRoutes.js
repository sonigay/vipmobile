require('dotenv').config();
const { google } = require('googleapis');
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const multer = require('multer');
const path = require('path');

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
      '회의ID', '회의이름', '회의날짜', '차수', '생성자', '생성일시', '상태'
    ]);

    // 데이터 조회 (3행부터)
    const range = `${sheetName}!A3:G`;
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
        status: row[6] || 'preparing'
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
    const { meetingName, meetingDate, meetingNumber, createdBy } = req.body;

    // 필수 필드 검증
    if (!meetingName || !meetingDate || !meetingNumber || !createdBy) {
      return res.status(400).json({ 
        success: false, 
        error: '필수 필드가 누락되었습니다.' 
      });
    }

    // 시트 헤더 확인
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, sheetName, [
      '회의ID', '회의이름', '회의날짜', '차수', '생성자', '생성일시', '상태'
    ]);

    // 차수 중복 확인
    const range = `${sheetName}!A3:G`;
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
      'preparing'
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
    const { meetingName, meetingDate, meetingNumber, status } = req.body;

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
    // 배열 길이가 7 미만이면 확장
    while (updateRow.length < 7) {
      updateRow.push('');
    }
    if (meetingName !== undefined) updateRow[1] = meetingName;
    if (meetingDate !== undefined) updateRow[2] = meetingDate;
    if (meetingNumber !== undefined) updateRow[3] = meetingNumber;
    if (status !== undefined) updateRow[6] = status; // 상태 업데이트 (인덱스 6)
    
    console.log(`🔄 [updateMeeting] 회의 상태 업데이트: ${meetingId} -> ${status}`);
    console.log(`🔄 [updateMeeting] 업데이트할 행:`, updateRow);

    const updateRange = `${sheetName}!A${rowIndex + 3}:G${rowIndex + 3}`;
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
    const slides = rows
      .filter(row => row[0] === meetingId)
      .map(row => {
        const tabValue = row[5] || '';
        // tab/subTab 형식으로 저장된 경우 파싱
        const [tab, subTab] = tabValue.includes('/') ? tabValue.split('/') : [tabValue, ''];
        
        return {
          slideId: row[1],
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
          discordThreadId: row[12] || ''
        };
      })
      .sort((a, b) => a.order - b.order);

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

    // 기존 데이터 조회
    const range = `${sheetName}!A3:M`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range
    });

    const existingRows = response.data.values || [];
    
    // 각 슬라이드를 개별적으로 업데이트 또는 추가
    for (const slide of slides) {
      const slideId = slide.slideId || slide.id || `slide-${slide.order}`;
      
      // 기존 슬라이드 찾기: slideId로 먼저 찾고, 없으면 mode/tab/subTab/order로 찾기
      let existingRowIndex = existingRows.findIndex((row, idx) => 
        row[0] === meetingId && row[1] === slideId
      );
      
      // slideId로 찾지 못한 경우 mode/tab/subTab/order로 찾기
      if (existingRowIndex === -1) {
        const tabValue = slide.subTab ? `${slide.tab || ''}/${slide.subTab}` : (slide.tab || '');
        existingRowIndex = existingRows.findIndex((row, idx) => {
          if (row[0] !== meetingId) return false;
          // mode, tab, order가 모두 일치하는지 확인 (subTab은 tab 필드에 포함됨)
          const rowMode = row[4] || '';
          const rowTab = row[5] || '';
          const rowOrder = parseInt(row[2] || 0);
          
          return rowMode === (slide.mode || '') && 
                 rowTab === tabValue && 
                 rowOrder === (slide.order || 0);
        });
      }

      // subTab이 있으면 tab 필드에 tab/subTab 형식으로 저장
      const tabValue = slide.subTab ? `${slide.tab || ''}/${slide.subTab}` : (slide.tab || '');
      
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
        slide.discordThreadId || ''
      ];

      if (existingRowIndex !== -1) {
        // 기존 슬라이드 업데이트
        const updateRange = `${sheetName}!A${existingRowIndex + 3}:M${existingRowIndex + 3}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRow]
          }
        });
        // 기존 행 데이터도 업데이트 (다음 반복을 위해)
        existingRows[existingRowIndex] = newRow;
        console.log(`✅ [saveMeetingConfig] 슬라이드 ${slideId} 업데이트 완료 (행 ${existingRowIndex + 3}), URL: ${slide.imageUrl || '없음'}`);
      } else {
        // 새 슬라이드 추가
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A3`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRow]
          }
        });
        // 기존 행 목록에도 추가 (다음 반복을 위해)
        existingRows.push(newRow);
        console.log(`✅ [saveMeetingConfig] 슬라이드 ${slideId} 추가 완료, URL: ${slide.imageUrl || '없음'}`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('회의 설정 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Discord 포럼 게시판에서 년월별 포스트 찾기 또는 생성
async function findOrCreatePost(channel, yearMonth) {
  try {
    // 포럼 채널의 활성 포스트 가져오기
    const activeThreads = await channel.threads.fetchActive();
    
    // 활성 스레드에서 년월로 포스트 찾기
    let post = Array.from(activeThreads.threads.values()).find(thread => 
      thread.name.includes(yearMonth) || thread.name === `${yearMonth} 회의`
    );
    
    if (post) {
      return post;
    }
    
    // 아카이브된 스레드도 확인
    try {
      const archivedThreads = await channel.threads.fetchArchived({ limit: 100 });
      post = Array.from(archivedThreads.threads.values()).find(thread => 
        thread.name.includes(yearMonth) || thread.name === `${yearMonth} 회의`
      );
      
      if (post) {
        return post;
      }
    } catch (archivedError) {
      console.warn('아카이브된 스레드 조회 실패:', archivedError);
      // 계속 진행
    }
    
    // 포스트 생성 (포럼 채널에서는 스레드 생성)
    const newPost = await channel.threads.create({
      name: `${yearMonth} 회의`,
      message: {
        content: `${yearMonth} 회의 이미지 저장`
      },
      appliedTags: []
    });
    
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
async function uploadImageToDiscord(imageBuffer, filename, meetingId, meetingDate) {
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
    
    // 해당 년월의 포스트 찾기 또는 생성
    let post = await findOrCreatePost(channel, yearMonth);
    
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

    const filename = req.file.originalname || `meeting-${meetingId}-${slideOrder}.png`;
    
    // Discord에 업로드
    const result = await uploadImageToDiscord(
      req.file.buffer,
      filename,
      meetingId,
      meetingDate
    );

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

module.exports = {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingConfig,
  saveMeetingConfig,
  uploadMeetingImage,
  upload // multer middleware
};

