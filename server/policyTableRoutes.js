require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { Client, GatewayIntentBits, AttachmentBuilder, ChannelType } = require('discord.js');
// Puppeteer 없이 Google Sheets API + Canvas 사용
const sharp = require('sharp');

// Discord 봇 설정 (server/index.js의 전역 discordBot 사용 또는 자체 초기화)
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

// Discord 봇 초기화 (server/index.js의 전역 봇을 사용하거나 자체 초기화)
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
    console.log(`✅ [정책표] Discord 봇이 준비되었습니다: ${discordBot.user.tag}`);
  });

  discordBot.login(DISCORD_BOT_TOKEN)
    .then(() => console.log('✅ [정책표] Discord 봇 로그인 성공'))
    .catch(error => console.error('❌ [정책표] Discord 봇 로그인 실패:', error));
}

// ===== 로컬 PC 디스코드 봇 명령어 전송용 클라이언트 =====
// 클라우드 서버의 기존 봇(discordBot)과 별도로 명령어 전송 전용 봇 클라이언트를 사용
let discordBotForCommands = null;

/**
 * 로컬 PC 디스코드 봇에 명령어를 전송하기 위한 별도 봇 클라이언트 초기화
 * 기존 discordBot과는 별도로 동작하여 충돌 방지
 */
async function initDiscordBotForCommands() {
  // 이미 초기화되어 있고 준비 상태라면 재사용
  if (discordBotForCommands && discordBotForCommands.isReady()) {
    return discordBotForCommands;
  }

  // 기존 봇 토큰 사용 (로컬 PC 봇이 아닌 클라우드 서버 봇)
  // 로컬 PC 봇은 별도로 실행되므로, 클라우드 서버 봇이 명령어를 전송
  if (!DISCORD_BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN 환경 변수가 설정되지 않았습니다.');
  }

  // 새 클라이언트 생성 (기존 discordBot과 별도)
  discordBotForCommands = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  // 로그인 먼저 실행
  await discordBotForCommands.login(DISCORD_BOT_TOKEN)
    .then(() => console.log('✅ [정책표] Discord 봇 (명령어 전송용) 로그인 성공'))
    .catch(error => {
      console.error('❌ [정책표] Discord 봇 (명령어 전송용) 로그인 실패:', error);
      throw error;
    });

  // 봇이 준비될 때까지 대기 (로그인 후 ready 이벤트 대기)
  await new Promise((resolve, reject) => {
    // 이미 ready 상태라면 즉시 resolve
    if (discordBotForCommands.isReady()) {
      console.log('✅ 디스코드 봇 (명령어 전송용) 준비 완료');
      resolve(discordBotForCommands);
      return;
    }

    // ready 이벤트 리스너 등록
    discordBotForCommands.once('ready', () => {
      console.log('✅ 디스코드 봇 (명령어 전송용) 준비 완료');
      resolve(discordBotForCommands);
    });

    // 30초 타임아웃
    setTimeout(() => {
      reject(new Error('디스코드 봇 준비 시간 초과'));
    }, 30000);
  });

  return discordBotForCommands;
}

/**
 * 생성자적용권한 이름 가져오기 (대리점아이디관리 시트에서)
 * @param {Array<string>} creatorPermissions - 역할 코드 배열 (예: ["AA", "BB"])
 * @returns {Promise<string>} 첫 번째 역할 코드에 해당하는 이름
 */
async function getCreatorPermissionName(creatorPermissions) {
  if (!creatorPermissions || creatorPermissions.length === 0) {
    return 'Unknown';
  }

  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    const agentSheetName = '대리점아이디관리';
    
    const response = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${agentSheetName}!A:Z`
      });
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return creatorPermissions[0]; // 시트에 데이터가 없으면 역할 코드 반환
    }

    // 첫 번째 역할 코드로 이름 찾기
    const firstRoleCode = creatorPermissions[0];
    const userRow = rows.find(row => {
      // R열(17번 인덱스): 권한레벨
      return row[17] === firstRoleCode;
    });

    if (userRow) {
      // A열(0번 인덱스): 대상(이름)
      return userRow[0] || firstRoleCode;
    }

    return firstRoleCode; // 찾지 못하면 역할 코드 반환
  } catch (error) {
    console.warn('⚠️ 생성자적용권한 이름 가져오기 실패:', error.message);
    return creatorPermissions[0]; // 에러 시 역할 코드 반환
  }
}

/**
 * 로컬 PC 디스코드 봇에 스크린샷 명령어를 전송하고 이미지 URL과 메시지 ID를 받아옴
 * @param {string} sheetUrl - Google Sheets URL
 * @param {string} policyTableName - 정책표 이름
 * @param {string} userName - 실행한 사람 이름
 * @param {string} channelId - 디스코드 채널 ID
 * @param {Array<string>} creatorPermissions - 생성자적용권한 역할 코드 배열
 * @returns {Promise<{imageUrl: string, messageId: string, threadId: string}>} 이미지 URL, 메시지 ID, 스레드/포스트 ID
 */
async function captureSheetViaDiscordBot(sheetUrl, policyTableName, userName, channelId, creatorPermissions = []) {
  try {
    // 명령어 전송용 봇 초기화
    const bot = await initDiscordBotForCommands();
    const channel = await bot.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`디스코드 채널을 찾을 수 없습니다: ${channelId}`);
    }

    // 생성자적용권한 이름 가져오기
    const creatorPermissionName = await getCreatorPermissionName(creatorPermissions);
    
    // 포스트 이름 생성 (포럼 채널용): 정책표이름-생성자적용권한사람이름-실행한사람이름
    const postName = `${policyTableName}-${creatorPermissionName}-${userName}`;
    let targetChannel = channel; // 실제로 메시지를 보낼 채널/포스트

    // 포럼 채널인지 확인
    if (channel.type === ChannelType.GuildForum) {
      console.log(`📋 포럼 채널 감지: ${channelId}, 포스트 찾기/생성: ${postName}`);
      
      // 활성 포스트 가져오기
      const activeThreads = await channel.threads.fetchActive();
      
      // 기존 포스트 찾기
      let post = Array.from(activeThreads.threads.values()).find(
        thread => thread.name === postName
      );

      if (!post) {
        // 아카이브된 포스트도 확인
        try {
          const archivedThreads = await channel.threads.fetchArchived({ limit: 100 });
          post = Array.from(archivedThreads.threads.values()).find(
            thread => thread.name === postName
          );
          
          if (post) {
            // 아카이브된 포스트를 활성화
            await post.setArchived(false);
            console.log(`✅ 아카이브된 포스트 활성화: ${postName}`);
          }
        } catch (error) {
          console.warn('⚠️ 아카이브된 포스트 확인 실패:', error.message);
        }
      }

      if (!post) {
        // 새 포스트 생성
        console.log(`📌 새 포스트 생성: ${postName}`);
        post = await channel.threads.create({
          name: postName,
          message: {
            content: `${postName} 이미지 저장`
          }
        });
        console.log(`✅ 새 포스트 생성 완료: ${postName} (ID: ${post.id})`);
      } else {
        console.log(`✅ 기존 포스트 찾음: ${postName} (ID: ${post.id})`);
      }

      // 포스트를 타겟 채널로 설정
      targetChannel = post;
    } else {
      // 일반 텍스트 채널인지 확인
      if (!channel.isTextBased() || channel.isDMBased()) {
        throw new Error(`채널이 텍스트 채널이 아닙니다: ${channelId} (타입: ${channel.type})`);
      }
      // 일반 채널은 그대로 사용
      targetChannel = channel;
    }

    // 명령어 생성
    // 형식: !screenshot <URL> policyTableName=<이름> userName=<사용자>
    const command = `!screenshot ${sheetUrl} policyTableName=${encodeURIComponent(policyTableName)} userName=${encodeURIComponent(userName)}`;
    console.log(`📤 디스코드 명령어 전송: ${command.substring(0, 100)}...`);
    
    // 명령어 메시지 전송 (포스트 또는 일반 채널)
    const commandMessage = await targetChannel.send(command);
    const commandMessageId = commandMessage.id;

    // 로컬 PC 봇 ID 확인 (환경변수에서 가져오기, 선택사항)
    const LOCAL_BOT_ID = process.env.DISCORD_LOCAL_BOT_ID;
    // 클라우드 서버 봇 ID (명령어를 보낸 봇)
    const CLOUD_BOT_ID = bot.user.id;

    console.log(`🔍 [정책표] 완료 신호 대기 설정:`);
    console.log(`   타겟 채널/포스트 ID: ${targetChannel.id}`);
    console.log(`   타겟 채널/포스트 이름: ${targetChannel.name || 'N/A'}`);
    console.log(`   명령어 메시지 ID: ${commandMessageId}`);
    console.log(`   클라우드 서버 봇 ID: ${CLOUD_BOT_ID}`);
    console.log(`   로컬 PC 봇 ID: ${LOCAL_BOT_ID || '(설정되지 않음)'}`);

    // 포스트(thread)인 경우 명시적으로 fetch
    if (targetChannel.isThread()) {
      try {
        await targetChannel.fetch(); // 포스트 최신 상태로 갱신
        console.log(`✅ [정책표] 포스트 fetch 완료: ${targetChannel.id} (${targetChannel.name})`);
      } catch (error) {
        console.warn(`⚠️ [정책표] 포스트 fetch 실패:`, error.message);
      }
    }

    // 로컬 PC 봇이 보낸 완료 신호 메시지 대기
    // 형식: !screenshot-complete commandId=<commandMessageId> imageId=<imageMessageId>
    const filter = (msg) => {
      const isTargetChannel = msg.channel.id === targetChannel.id;
      const isNotCloudBot = msg.author.id !== CLOUD_BOT_ID; // 클라우드 서버 봇이 아닌 메시지만
      const isCompleteSignal = msg.content && msg.content.startsWith('!screenshot-complete');
      
      // 완료 신호 파싱
      let commandIdMatch = null;
      let imageIdMatch = null;
      if (isCompleteSignal) {
        commandIdMatch = msg.content.match(/commandId=(\d+)/);
        imageIdMatch = msg.content.match(/imageId=(\d+)/);
      }

      // 명령어 ID를 문자열로 명시적 변환하여 정확한 매칭 보장
      // Discord 메시지 ID는 숫자 문자열이지만, 타입 안전성을 위해 String() 사용
      const receivedCommandId = commandIdMatch ? String(commandIdMatch[1]) : null;
      const expectedCommandId = String(commandMessageId);
      const isMatchingCommand = receivedCommandId === expectedCommandId;
      const hasImageId = imageIdMatch && imageIdMatch[1];

      // 로컬 PC 봇 ID 확인
      const isLocalBot = LOCAL_BOT_ID ? msg.author.id === LOCAL_BOT_ID : true;

      const matches = isTargetChannel &&
                     isNotCloudBot &&
                     isCompleteSignal &&
                     isMatchingCommand &&
                     hasImageId &&
                     isLocalBot;

      if (isTargetChannel && isCompleteSignal) {
        console.log(`🔍 [정책표] 완료 신호 필터링:`, {
          messageId: msg.id,
          authorId: msg.author.id,
          authorName: msg.author.username,
          content: msg.content,
          receivedCommandId,
          expectedCommandId,
          isMatchingCommand,
          hasImageId,
          isLocalBot,
          matches
        });
      }

      return matches;
    };

    const collector = targetChannel.createMessageCollector({
      filter,
      time: 90000, // 90초 대기 (Selenium 스크린샷 생성 시간 고려)
      max: 1
    });

    return new Promise((resolve, reject) => {
      collector.on('collect', async (completeSignalMsg) => {
        try {
          console.log(`📥 [정책표] 완료 신호 수신:`, {
            messageId: completeSignalMsg.id,
            content: completeSignalMsg.content
          });

          // 완료 신호에서 이미지 메시지 ID 추출
          const imageIdMatch = completeSignalMsg.content.match(/imageId=(\d+)/);
          if (!imageIdMatch) {
            reject(new Error('완료 신호에 이미지 메시지 ID가 없습니다.'));
            return;
          }

          const imageMessageId = imageIdMatch[1];
          console.log(`🔍 [정책표] 이미지 메시지 ID 추출: ${imageMessageId}`);

          // 이미지 메시지 가져오기
          const imageMessage = await targetChannel.messages.fetch(imageMessageId);
          if (!imageMessage) {
            reject(new Error(`이미지 메시지를 찾을 수 없습니다: ${imageMessageId}`));
            return;
          }

          const attachment = imageMessage.attachments.first();
          if (!attachment || !attachment.contentType?.startsWith('image/')) {
            reject(new Error('이미지가 포함된 메시지를 찾을 수 없습니다.'));
            return;
          }

          const imageUrl = attachment.url;
          const messageId = imageMessage.id;
          const threadId = targetChannel.id; // 포스트/스레드 ID

          console.log(`✅ [정책표] 스크린샷 생성 완료: ${imageUrl} (메시지 ID: ${messageId}, 스레드 ID: ${threadId})`);
          resolve({ imageUrl, messageId, threadId });

        } catch (error) {
          console.error(`❌ [정책표] 완료 신호 처리 오류:`, error);
          reject(error);
        }
      });

      collector.on('end', (collected) => {
        console.log(`🔚 [정책표] 완료 신호 수집 종료:`, {
          collectedCount: collected.size,
          collectedMessages: Array.from(collected.values()).map(msg => ({
            id: msg.id,
            authorId: msg.author.id,
            authorName: msg.author.username,
            content: msg.content,
            timestamp: msg.createdTimestamp
          }))
        });
        
        if (collected.size === 0) {
          console.error(`❌ [정책표] 완료 신호 수집 실패: 90초 동안 완료 신호를 받지 못했습니다.`);
          console.error(`   타겟 채널/포스트 ID: ${targetChannel.id}`);
          console.error(`   명령어 메시지 ID: ${commandMessageId}`);
          reject(new Error('디스코드 봇 응답 시간 초과 (90초)'));
        }
      });
    });

  } catch (error) {
    console.error('❌ 디스코드 봇 명령어 실행 오류:', error);
    throw error;
  }
}

// Google Sheets 클라이언트 생성
function createSheetsClient() {
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;

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

// 시트 이름 정의
const SHEET_POLICY_TABLE_SETTINGS = '정책모드_정책표설정';
const SHEET_POLICY_TABLE_LIST = '정책모드_정책표목록';
const SHEET_USER_GROUPS = '정책모드_일반사용자그룹';

// 시트 헤더 정의
const HEADERS_POLICY_TABLE_SETTINGS = [
  '정책표ID',
  '정책표이름',
  '정책표설명',
  '정책표링크',           // 편집 링크 (사용자가 클릭하는 링크)
  '정책표공개링크',        // 공개 링크 (/pubhtml, Puppeteer 캡처용)
  '디스코드채널ID',
  '생성자적용권한',
  '등록일시',
  '등록자'
];

const HEADERS_POLICY_TABLE_LIST = [
  '정책표ID',           // 0: 고유 ID
  '정책표ID_설정',      // 1: 설정과 연결된 ID
  '정책표이름',         // 2
  '정책적용일시',       // 3
  '정책적용내용',       // 4
  '접근권한',           // 5
  '생성자',             // 6
  '생성일시',           // 7
  '디스코드메시지ID',   // 8
  '디스코드스레드ID',   // 9
  '이미지URL',          // 10
  '등록여부',           // 11
  '등록일시'            // 12
];

const HEADERS_USER_GROUPS = [
  '그룹ID',
  '그룹이름',
  '일반사용자목록',
  '등록일시',
  '등록자'
];

// 구글시트 편집 링크 정규화 함수
// 시트 ID만 넣어도, 전체 URL을 넣어도 편집 가능한 표준 URL로 변환
function normalizeGoogleSheetEditLink(link) {
  if (!link) return '';
  
  // 공백 제거
  link = link.trim();
  
  // 시트 ID만 있는 경우 (예: "1Vy8Qhce3B6_41TxRfVUs883ioLxiGTUjkbD_nKebgrs")
  if (/^[a-zA-Z0-9-_]+$/.test(link)) {
    return `https://docs.google.com/spreadsheets/d/${link}/edit`;
  }
  
  // 이미 전체 URL인 경우
  if (link.startsWith('http://') || link.startsWith('https://')) {
    // 시트 ID 추출
    const sheetIdMatch = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetIdMatch) {
      const sheetId = sheetIdMatch[1];
      // gid 파라미터 추출 (있는 경우)
      const gidMatch = link.match(/[?&#]gid=([0-9]+)/);
      if (gidMatch) {
        const gid = gidMatch[1];
        return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=${gid}#gid=${gid}`;
      }
      return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    }
  }
  
  // 변환 실패 시 원본 반환
  return link;
}

// 컬럼 인덱스 헬퍼 함수
function getColumnLetter(columnNumber) {
  let result = '';
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
}

// 간단한 메모리 캐시
const cacheStore = new Map();
function getCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}
function setCache(key, data, ttlMs = 60 * 1000) {
  cacheStore.set(key, { data, expires: Date.now() + ttlMs });
}

// Rate limit 에러 재시도 함수
async function withRetry(fn, maxRetries = 5, baseDelay = 2000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimitError =
        error.code === 429 ||
        (error.response && error.response.status === 429) ||
        (error.response && error.response.data && error.response.data.error &&
          (error.response.data.error.status === 'RESOURCE_EXHAUSTED' ||
            error.response.data.error.message && error.response.data.error.message.includes('Quota exceeded'))) ||
        (error.message && (
          error.message.includes('Quota exceeded') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('429') ||
          error.message.includes('rateLimitExceeded')
        ));

      if (isRateLimitError && attempt < maxRetries - 1) {
        const jitter = Math.random() * 1000;
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// 시트 헤더 확인 및 생성
async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  const cacheKey = `headers-${sheetName}-${spreadsheetId}`;
  const CACHE_TTL = 5 * 60 * 1000;

  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const spreadsheet = await withRetry(async () => {
      return await sheets.spreadsheets.get({ spreadsheetId });
    });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === sheetName);

    if (!sheetExists) {
      await withRetry(async () => {
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

    const res = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`
      });
    });
    const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
    const needsInit = firstRow.length === 0 || headers.some((h, i) => (firstRow[i] || '') !== h) || firstRow.length < headers.length;
    
    if (needsInit) {
      await withRetry(async () => {
        const lastColumn = getColumnLetter(headers.length);
        return await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:${lastColumn}1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] }
        });
      });
      cacheStore.delete(cacheKey);
      return headers;
    }
    
    setCache(cacheKey, headers, CACHE_TTL);
    return headers;
  } catch (error) {
    console.error(`[정책표] Failed to ensure sheet headers for ${sheetName}:`, error);
    cacheStore.delete(cacheKey);
    throw error;
  }
}

// 시트 ID 가져오기 헬퍼 함수
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const spreadsheet = await withRetry(async () => {
    return await sheets.spreadsheets.get({ spreadsheetId });
  });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

// 권한 체크 헬퍼 함수
async function checkPermission(req, allowedRoles) {
  const { sheets, SPREADSHEET_ID } = createSheetsClient();
  
  // 대리점아이디관리 시트에서 사용자 정보 조회
  const agentSheetName = '대리점아이디관리';
  const response = await withRetry(async () => {
    return await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${agentSheetName}!A:Z`
    });
  });

  const rows = response.data.values || [];
  if (rows.length < 2) {
    throw new Error('대리점아이디관리 시트에 데이터가 없습니다.');
  }

  // 로그인한 사용자 정보 찾기 (헤더에서 가져오기)
  const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId;
  const userRole = req.headers['x-user-role'] || req.body?.userRole || req.query?.userRole;
  
  // 대리점아이디관리 시트에서 사용자 정보 찾기
  // C열(2번 인덱스): 연락처(아이디) = contactId
  // A열(0번 인덱스): 대상(이름)
  // R열(17번 인덱스): 권한레벨
  let userInfo = null;
  if (userId) {
    const userRow = rows.find(row => {
      // C열(2번 인덱스)에서 contactId로 찾기
      return row[2] === userId;
    });
    if (userRow) {
      userInfo = {
        id: userRow[2] || userId,      // C열: 연락처(아이디)
        name: userRow[0] || userId,    // A열: 대상(이름)
        role: userRow[17] || userRole  // R열(17번 인덱스): 권한레벨
      };
    }
  }
  
  // userRole이 없으면 userInfo에서 가져오기
  const finalUserRole = userRole || userInfo?.role;
  const finalUserId = userId || userInfo?.id;
  // 이름은 반드시 userInfo에서 가져오기 (아이디가 아닌 이름)
  const finalUserName = userInfo?.name || null;

  // 디버깅 로그
  console.log('[정책표] 권한 체크:', {
    userId: userId,
    userRole: userRole,
    finalUserRole: finalUserRole,
    finalUserId: finalUserId,
    finalUserName: finalUserName,
    userInfo: userInfo ? { id: userInfo.id, name: userInfo.name, role: userInfo.role } : null,
    allowedRoles: allowedRoles
  });

  if (!finalUserRole) {
    console.error('[정책표] 권한 정보 없음:', { userId, userRole, userInfo });
    return { hasPermission: false, error: '사용자 권한 정보가 없습니다.' };
  }

  const hasPermission = allowedRoles.includes(finalUserRole);
  console.log('[정책표] 권한 체크 결과:', { 
    hasPermission, 
    finalUserRole, 
    allowedRoles,
    userName: finalUserName,
    userId: finalUserId
  });
  
  // userName이 없으면 에러 (이름은 필수)
  if (!finalUserName) {
    console.error('[정책표] 사용자 이름을 찾을 수 없습니다:', { userId, userInfo });
  return { 
    hasPermission, 
    userRole: finalUserRole, 
    userId: finalUserId, 
      userName: finalUserId // 폴백: 아이디라도 반환
    };
  }
  
  return { 
    hasPermission, 
    userRole: finalUserRole, 
    userId: finalUserId, 
    userName: finalUserName
  };
}

// 작업 상태 저장 (메모리 또는 구글시트)
const jobStatusStore = new Map();

function updateJobStatus(jobId, status) {
  jobStatusStore.set(jobId, {
    ...status,
    updatedAt: new Date().toISOString()
  });
}

function getJobStatus(jobId) {
  return jobStatusStore.get(jobId) || null;
}

// 정책표 생성 백그라운드 작업
async function processPolicyTableGeneration(jobId, params) {
  const { policyTableId, applyDate, applyContent, accessGroupId, creatorName, creatorRole, creatorId } = params;

  try {
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 0,
      message: '초기화 중...'
    });

    // 1. 정책표 설정 조회
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 10,
      message: '정책표 설정 조회 중...'
    });

    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

    const settingsResponse = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
      });
    });

    const settingsRows = settingsResponse.data.values || [];
    if (settingsRows.length < 2) {
      throw new Error('정책표 설정을 찾을 수 없습니다.');
    }

    const settingsRow = settingsRows.find(row => row[0] === policyTableId);
    if (!settingsRow) {
      throw new Error(`정책표 ID ${policyTableId}를 찾을 수 없습니다.`);
    }

    const policyTableName = settingsRow[1];
    const policyTableDescription = settingsRow[2] || '';
    const policyTableLink = settingsRow[3];  // 편집 링크
    const policyTablePublicLink = settingsRow[4] || settingsRow[3];  // 공개 링크 (없으면 편집 링크 사용)
    const discordChannelId = settingsRow[5];
    const creatorPermissions = settingsRow[6] ? JSON.parse(settingsRow[6]) : []; // 생성자적용권한

    // 2. 디스코드 봇을 통한 스크린샷 생성 (Canvas 렌더링 대체)
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 50,
      message: '디스코드 봇으로 스크린샷 생성 중...'
    });

    const sheetUrl = policyTablePublicLink || policyTableLink;

    // 로컬 PC 디스코드 봇에 명령어 전송 및 이미지 URL, 메시지 ID, 스레드 ID 받기
    // captureSheetViaDiscordBot에서 포스트/스레드를 찾거나 생성하고 명령어를 전송함
    const { imageUrl, messageId: discordMessageId, threadId } = await captureSheetViaDiscordBot(
      sheetUrl,
      policyTableName,
      creatorName, // 실행한 사람 이름 전달
      discordChannelId,
      creatorPermissions // 생성자적용권한 전달
    );

    // 이미지 URL, 메시지 ID, 스레드 ID는 모두 captureSheetViaDiscordBot에서 받았으므로
    // 추가 처리 없이 바로 사용
    const messageId = discordMessageId; // 디스코드 봇이 업로드한 메시지 ID
    // threadId는 captureSheetViaDiscordBot에서 반환한 포스트/스레드 ID

    // 4. 구글시트에 저장
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 90,
      message: '데이터 저장 중...'
    });

    await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

    const newRowId = `POL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

      const newRow = [
        newRowId,                    // 0: 정책표ID (고유 ID)
        policyTableId,               // 1: 정책표ID (설정과 연결)
        policyTableName,             // 2: 정책표이름
        applyDate,                   // 3: 정책적용일시
        applyContent,                // 4: 정책적용내용
        accessGroupId || '',         // 5: 접근권한 (그룹ID)
        creatorName || 'Unknown',  // 6: 생성자 (이름)
        createdAt,                   // 7: 생성일시
        messageId,                   // 8: 디스코드메시지ID
        threadId,                    // 9: 디스코드스레드ID
        imageUrl,                    // 10: 이미지URL
        'N',                         // 11: 등록여부
        '',                          // 12: 등록일시
        creatorId || ''              // 13: 생성자ID (새로 추가)
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:M`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

    // 완료
    updateJobStatus(jobId, {
      status: 'completed',
      progress: 100,
      message: '정책표 생성이 완료되었습니다.',
      result: {
        id: newRowId,
        policyTableId,
        policyTableName,
        imageUrl,
        messageId,
        threadId
      }
    });

  } catch (error) {
    console.error('[정책표] 생성 오류:', error);
    updateJobStatus(jobId, {
      status: 'failed',
      progress: 0,
      message: '정책표 생성에 실패했습니다.',
      error: error.message
    });
  } finally {
    // Puppeteer를 사용하지 않으므로 browser 정리 불필요
  }
}

function setupPolicyTableRoutes(app) {
  const router = express.Router();

  // CORS 헤더 설정
  const setCORSHeaders = (req, res) => {
    // 환경 변수에서 허용할 도메인 목록 가져오기
    const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    
    // 기본 허용 도메인 (개발용 및 프로덕션)
    const defaultOrigins = [
      'https://vipmobile.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002'
    ];
    
    const allowedOrigins = [...defaultOrigins, ...corsOrigins];
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && process.env.CORS_ORIGIN?.includes(origin)) {
      // 환경 변수에 있는 경우도 허용
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://vipmobile.vercel.app');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, X-API-Key, x-user-id, x-user-role');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24시간 캐시
  };

  // CORS 헤더는 전역 핸들러(app.options('*'))에서 처리되므로
  // 라우터에서는 각 라우트 핸들러에서만 setCORSHeaders 호출
  // OPTIONS 요청은 전역 핸들러가 처리

  // ========== 정책표생성설정 관련 API ==========

  // GET /api/policy-table-settings
  router.get('/policy-table-settings', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      // 정책표생성 탭 접근 권한: SS, AA, BB, CC, DD, EE, FF
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const settings = dataRows.map(row => ({
        id: row[0] || '',
        policyTableName: row[1] || '',
        policyTableDescription: row[2] || '',
        policyTableLink: row[3] || '',
        policyTablePublicLink: row[4] || '',  // 공개 링크
        discordChannelId: row[5] || '',
        creatorPermissions: row[6] ? JSON.parse(row[6]) : [],
        registeredAt: row[7] || '',
        registeredBy: row[8] || ''
      }));

      console.log('🔍 [정책표] 설정 목록 조회:', {
        totalSettings: settings.length,
        settings: settings.map(s => ({
          id: s.id,
          policyTableName: s.policyTableName,
          creatorPermissions: s.creatorPermissions,
          creatorPermissionsType: typeof s.creatorPermissions,
          isArray: Array.isArray(s.creatorPermissions)
        }))
      });

      return res.json(settings);
    } catch (error) {
      console.error('[정책표] 설정 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-table-settings
  router.post('/policy-table-settings', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { policyTableName, policyTableDescription, policyTableLink, policyTablePublicLink, discordChannelId, creatorPermissions } = req.body;

      if (!policyTableName || !policyTableLink || !discordChannelId || !creatorPermissions || !Array.isArray(creatorPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      // 편집 링크 정규화 (시트 ID만 넣어도 전체 URL로 변환)
      const normalizedEditLink = normalizeGoogleSheetEditLink(policyTableLink);
      
      const newId = `PT_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId,
        policyTableName,
        policyTableDescription || '',
        normalizedEditLink,  // 정규화된 편집 링크
        policyTablePublicLink || '',  // 공개 링크 (선택)
        discordChannelId,
        JSON.stringify(creatorPermissions),
        registeredAt,
        registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

      return res.json({
        success: true,
        id: newId,
        message: '정책표 설정이 추가되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 설정 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table-settings/:id
  router.put('/policy-table-settings/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
        });
      });

      const rows = response.data.values || [];
      
      // 헤더 행 제외 (첫 번째 행은 헤더)
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }
      
      // 헤더를 제외한 데이터 행에서 찾기
      const dataRows = rows.slice(1);
      const rowIndex = dataRows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }

      const existingRow = dataRows[rowIndex];
      const { policyTableName, policyTableDescription, policyTableLink, policyTablePublicLink, discordChannelId, creatorPermissions } = req.body;
      
      // 편집 링크 정규화
      const normalizedEditLink = policyTableLink !== undefined 
        ? normalizeGoogleSheetEditLink(policyTableLink)
        : existingRow[3];
      
      const updatedRow = [
        id, // 정책표ID는 변경 불가
        policyTableName !== undefined ? policyTableName : existingRow[1],
        policyTableDescription !== undefined ? policyTableDescription : (existingRow[2] || ''),
        normalizedEditLink,  // 정규화된 편집 링크
        policyTablePublicLink !== undefined ? policyTablePublicLink : (existingRow[4] || ''),
        discordChannelId !== undefined ? discordChannelId : existingRow[5],
        creatorPermissions !== undefined ? JSON.stringify(creatorPermissions) : existingRow[6],
        existingRow[7], // 등록일시는 변경 불가
        existingRow[8]  // 등록자는 변경 불가
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A${rowIndex + 2}:I${rowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        id: id,
        message: '정책표 설정이 수정되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 설정 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-table-settings/:id
  router.delete('/policy-table-settings/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:I`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표 설정을 찾을 수 없습니다.' });
      }

      // 행 삭제
      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS),
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      });

      return res.json({
        success: true,
        message: '정책표 설정이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 설정 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 정책영업그룹 관련 API ==========

  // 정책영업그룹 데이터 파싱 헬퍼 함수
  function parseUserGroupData(dataString) {
    if (!dataString) {
      return { companyNames: [], managerIds: [] };
    }

    try {
      const parsed = JSON.parse(dataString);
      
      // 새로운 형식: {"companyNames": [...], "managerIds": [...]}
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          companyNames: Array.isArray(parsed.companyNames) ? parsed.companyNames : [],
          managerIds: Array.isArray(parsed.managerIds) ? parsed.managerIds : []
        };
      }
      
      // 기존 형식: ["A", "B", "C"] (권한 레벨 배열) - 무시하고 빈 배열 반환
      if (Array.isArray(parsed)) {
        console.log('[정책표] 기존 형식 감지 (권한 레벨 배열), 새로운 형식으로 초기화');
        return { companyNames: [], managerIds: [] };
      }
      
      return { companyNames: [], managerIds: [] };
    } catch (error) {
      console.error('[정책표] 그룹 데이터 파싱 오류:', error);
      return { companyNames: [], managerIds: [] };
    }
  }

  // GET /api/policy-table/user-groups
  router.get('/policy-table/user-groups', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);

      const groups = dataRows.map(row => {
        const groupData = parseUserGroupData(row[2]);
        return {
          id: row[0] || '',
          groupName: row[1] || '',
          companyNames: groupData.companyNames,
          managerIds: groupData.managerIds,
          // 하위 호환성을 위해 userIds도 반환 (기존 코드 호환)
          userIds: groupData.managerIds, // managerIds를 userIds로도 반환
          registeredAt: row[3] || '',
          registeredBy: row[4] || ''
        };
      });

      return res.json(groups);
    } catch (error) {
      console.error('[정책표] 그룹 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-table/user-groups
  router.post('/policy-table/user-groups', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { groupName, companyNames, managerIds } = req.body;

      // 하위 호환성: userIds도 받을 수 있음 (기존 코드 호환)
      const finalCompanyNames = companyNames || [];
      const finalManagerIds = managerIds || req.body.userIds || [];

      if (!groupName || (!Array.isArray(finalCompanyNames) && !Array.isArray(finalManagerIds))) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      // companyNames와 managerIds가 모두 비어있으면 에러
      if (finalCompanyNames.length === 0 && finalManagerIds.length === 0) {
        return res.status(400).json({ success: false, error: '업체명 또는 담당자를 최소 1개 이상 선택해야 합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const newId = `UG_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      // 중복 제거
      const uniqueCompanyNames = [...new Set(finalCompanyNames)];
      const uniqueManagerIds = [...new Set(finalManagerIds)];

      const groupData = {
        companyNames: uniqueCompanyNames,
        managerIds: uniqueManagerIds
      };

      const newRow = [
        newId,
        groupName,
        JSON.stringify(groupData),
        registeredAt,
        registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

      return res.json({
        success: true,
        id: newId,
        message: '정책영업그룹이 추가되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table/user-groups/:id
  router.put('/policy-table/user-groups/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { groupName, companyNames, managerIds } = req.body;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '그룹을 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const existingData = parseUserGroupData(existingRow[2]);

      // 새로운 데이터가 제공되면 사용, 없으면 기존 데이터 유지
      let finalCompanyNames = companyNames !== undefined ? companyNames : existingData.companyNames;
      let finalManagerIds = managerIds !== undefined ? managerIds : existingData.managerIds;

      // 하위 호환성: userIds도 받을 수 있음
      if (req.body.userIds && managerIds === undefined) {
        finalManagerIds = req.body.userIds;
      }

      // companyNames와 managerIds가 모두 비어있으면 에러
      if (finalCompanyNames.length === 0 && finalManagerIds.length === 0) {
        return res.status(400).json({ success: false, error: '업체명 또는 담당자를 최소 1개 이상 선택해야 합니다.' });
      }

      // 중복 제거
      const uniqueCompanyNames = [...new Set(finalCompanyNames)];
      const uniqueManagerIds = [...new Set(finalManagerIds)];

      const groupData = {
        companyNames: uniqueCompanyNames,
        managerIds: uniqueManagerIds
      };

      const updatedRow = [
        id,
        groupName !== undefined ? groupName : existingRow[1],
        JSON.stringify(groupData),
        existingRow[3],
        existingRow[4]
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A${rowIndex + 1}:E${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        id: id,
        message: '정책영업그룹이 수정되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-table/user-groups/:id
  router.delete('/policy-table/user-groups/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '그룹을 찾을 수 없습니다.' });
      }

      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS),
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      });

      return res.json({
        success: true,
        message: '정책영업그룹이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-table/companies
  router.get('/policy-table/companies', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const generalModeSheetName = '일반모드권한관리';
      
      // A~K열 범위로 읽기 (B열=업체명, I열=일반정책모드 권한, K열=담당자 아이디)
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${generalModeSheetName}!A:K`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 4) {
        return res.json({ success: true, companies: [] });
      }

      // 헤더 3행 제외하고 4행부터 데이터
      const dataRows = rows.slice(3);
      
      // 업체명별로 그룹화 (같은 업체명에 여러 담당자가 있을 수 있음)
      const companyMap = new Map();
      
      dataRows.forEach(row => {
        const companyName = (row[1] || '').trim(); // B열: 업체명
        const generalPolicyPermission = (row[8] || '').trim(); // I열: 일반정책모드 권한
        const managerId = (row[10] || '').trim(); // K열: 담당자 아이디
        
        // I열에 "O" 권한이 있는 경우만 포함
        if (companyName && generalPolicyPermission === 'O' && managerId) {
          if (!companyMap.has(companyName)) {
            companyMap.set(companyName, {
              companyName: companyName,
              managerIds: []
            });
          }
          
          const company = companyMap.get(companyName);
          if (!company.managerIds.includes(managerId)) {
            company.managerIds.push(managerId);
          }
        }
      });

      const companies = Array.from(companyMap.values());
      
      console.log('✅ [정책표] 업체명 목록 로드:', {
        totalCompanies: companies.length,
        companies: companies.map(c => ({
          companyName: c.companyName,
          managerCount: c.managerIds.length
        }))
      });

      return res.json({
        success: true,
        companies: companies
      });
    } catch (error) {
      console.error('[정책표] 업체명 목록 로드 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 정책표 생성 관련 API ==========

  // POST /api/policy-table/generate
  router.post('/policy-table/generate', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { policyTableId, applyDate, applyContent, accessGroupId } = req.body;

      if (!policyTableId || !applyDate || !applyContent) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      // 작업 ID 생성
      const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 백그라운드 작업 시작
      processPolicyTableGeneration(jobId, {
        policyTableId,
        applyDate,
        applyContent,
        accessGroupId,
        creatorName: permission.userName || 'Unknown',
        creatorRole: permission.userRole,
        creatorId: permission.userId || ''
      }).catch(error => {
        console.error('[정책표] 백그라운드 작업 오류:', error);
      });

      return res.json({
        success: true,
        jobId: jobId,
        status: 'queued',
        message: '정책표 생성이 시작되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 생성 요청 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-table/generate/:jobId/status
  router.get('/policy-table/generate/:jobId/status', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { jobId } = req.params;
      const status = getJobStatus(jobId);

      if (!status) {
        return res.status(404).json({ success: false, error: '작업을 찾을 수 없습니다.' });
      }

      return res.json(status);
    } catch (error) {
      console.error('[정책표] 상태 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 정책표목록 관련 API ==========

  // GET /api/policy-tables/tabs
  router.get('/policy-tables/tabs', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const userRole = req.headers['x-user-role'] || req.query.userRole;
      const userId = req.headers['x-user-id'] || req.query.userId;
      const mode = req.query.mode;
      const isGeneralPolicyMode = mode === 'generalPolicy' || mode === 'general-policy';
      
      if (!userRole && !isGeneralPolicyMode) {
        return res.status(400).json({ success: false, error: '사용자 권한 정보가 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_SETTINGS}!A:B`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      let tabs = dataRows.map(row => ({
        policyTableId: row[0] || '',
        policyTableName: row[1] || ''
      }));

      // 권한 필터링
      if (isGeneralPolicyMode) {
        // 일반정책모드 필터링: companyNames 기반
        const currentUserId = req.headers['x-user-id'] || userId;
        
        // 정책표목록에서 접근권한 확인
        const policyListResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_TABLE_LIST}!A:M`
          });
        });

        const policyRows = policyListResponse.data.values || [];
        const policyDataRows = policyRows.slice(1);

        // 정책영업그룹 목록 조회
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroupsMap = new Map();
        userGroupsDataRows.forEach(row => {
          const groupId = row[0];
          const groupData = parseUserGroupData(row[2]);
          userGroupsMap.set(groupId, groupData);
        });

        // 현재 사용자의 업체명 확인
        const generalModeSheetName = '일반모드권한관리';
        const generalModeResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${generalModeSheetName}!A:K`
          });
        });

        const generalModeRows = generalModeResponse.data.values || [];
        let userCompanyName = null;
        if (generalModeRows.length > 3) {
          const generalModeDataRows = generalModeRows.slice(3);
          const userRow = generalModeDataRows.find(row => 
            row[0] === currentUserId || row[10] === currentUserId // A열 또는 K열
          );
          if (userRow) {
            userCompanyName = (userRow[1] || '').trim(); // B열 업체명
          }
        }

        if (!userCompanyName) {
          // 업체명을 찾을 수 없으면 빈 배열 반환
          return res.json([]);
        }

        // 접근 가능한 정책표ID 목록 생성
        const accessiblePolicyTableIds = new Set();
        policyDataRows.forEach(row => {
          const accessGroupId = row[5]; // 접근권한 (그룹ID)
          if (accessGroupId) {
            const groupData = userGroupsMap.get(accessGroupId);
            if (groupData) {
              // companyNames에 현재 사용자의 업체명이 포함되어 있는지 확인
              const companyNames = groupData.companyNames || [];
              if (companyNames.includes(userCompanyName)) {
                accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
              }
            }
          }
        });

        // 접근 가능한 탭만 필터링
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      } else if (['SS', 'S'].includes(userRole)) {
        // SS(총괄), S(정산) 레벨은 모든 탭 표시
      } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
        // 팀장 레벨은 본인이 생성한 정책표의 탭만 표시
        const currentUserId = req.headers['x-user-id'] || userId;
        const policyListResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_TABLE_LIST}!A:N`
          });
        });

        const policyRows = policyListResponse.data.values || [];
        const policyDataRows = policyRows.slice(1);
        const accessiblePolicyTableIds = new Set();
        policyDataRows.forEach(row => {
          const creatorId = row[13] || ''; // 생성자ID
          if (creatorId === currentUserId) {
            accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
          }
        });
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      } else {
        // 그 외 사용자(A-F)는 그룹의 담당자(managerIds)에 포함된 경우만 해당 그룹의 탭 표시
        // 정책표목록에서 접근권한 확인
        const policyListResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_TABLE_LIST}!A:N`
          });
        });

        const policyRows = policyListResponse.data.values || [];
        const policyDataRows = policyRows.slice(1);

        // 정책영업그룹 목록 조회
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroupsMap = new Map();
        userGroupsDataRows.forEach(row => {
          const groupId = row[0];
          const groupData = parseUserGroupData(row[2]);
          userGroupsMap.set(groupId, groupData);
        });

        // 현재 사용자 아이디 확인
        const currentUserId = req.headers['x-user-id'] || userId;

        // 접근 가능한 정책표ID 목록 생성
        const accessiblePolicyTableIds = new Set();
        policyDataRows.forEach(row => {
          const accessGroupId = row[5]; // 접근권한 (그룹ID)
          if (accessGroupId) {
            const groupData = userGroupsMap.get(accessGroupId);
            if (groupData) {
              const managerIds = groupData.managerIds || [];
              if (managerIds.includes(currentUserId)) {
                accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
              }
            }
          }
        });

        // 접근 가능한 탭만 필터링
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      }

      return res.json(tabs);
    } catch (error) {
      console.error('[정책표] 탭 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-tables
  router.get('/policy-tables', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { policyTableName, applyDateSearch, creator, createDateFrom, createDateTo, mode } = req.query;
      const userRole = req.headers['x-user-role'] || req.query.userRole;
      const currentUserId = req.headers['x-user-id'] || req.query.userId;
      const isGeneralPolicyMode = mode === 'generalPolicy' || mode === 'general-policy';

      if (!policyTableName) {
        return res.status(400).json({ success: false, error: 'policyTableName이 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:N`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      let policies = dataRows
        .filter(row => {
          // 정책표이름 필터
          if (row[2] !== policyTableName) return false;
          // 등록여부 필터 (등록된 것만)
          if (row[11] !== 'Y') return false;
          return true;
        })
        .map(row => ({
          id: row[0] || '',
          policyTableId: row[1] || '',
          policyTableName: row[2] || '',
          applyDate: row[3] || '',
          applyContent: row[4] || '',
          accessGroupId: row[5] || '',
          creator: row[6] || '',
          creatorId: row[13] || '', // 생성자ID (새로 추가)
          createdAt: row[7] || '',
          messageId: row[8] || '',
          threadId: row[9] || '',
          imageUrl: row[10] || '',
          registeredAt: row[12] || ''
        }));

      // 권한 필터링
      if (isGeneralPolicyMode) {
        // 일반정책모드 필터링: companyNames 기반
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroupsMap = new Map();
        userGroupsDataRows.forEach(row => {
          const groupId = row[0];
          const groupData = parseUserGroupData(row[2]);
          userGroupsMap.set(groupId, groupData);
        });

        // 현재 사용자의 업체명 확인
        const generalModeSheetName = '일반모드권한관리';
        const generalModeResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${generalModeSheetName}!A:K`
          });
        });

        const generalModeRows = generalModeResponse.data.values || [];
        let userCompanyName = null;
        if (generalModeRows.length > 3) {
          const generalModeDataRows = generalModeRows.slice(3);
          const userRow = generalModeDataRows.find(row => 
            row[0] === currentUserId || row[10] === currentUserId // A열 또는 K열
          );
          if (userRow) {
            userCompanyName = (userRow[1] || '').trim(); // B열 업체명
          }
        }

        if (!userCompanyName) {
          // 업체명을 찾을 수 없으면 빈 배열 반환
          return res.json([]);
        }

        // 접근권한에 포함된 정책표만 필터링
        console.log('🔍 [일반정책모드] 필터링 시작:', {
          userCompanyName,
          totalPolicies: policies.length,
          userGroupsMapSize: userGroupsMap.size
        });
        
        policies = policies.filter(policy => {
          const accessGroupId = policy.accessGroupId;
          if (!accessGroupId) {
            console.log('❌ [일반정책모드] 접근권한 없음:', policy.id);
            return false; // 접근권한이 없으면 접근 불가
          }
          
          const groupData = userGroupsMap.get(accessGroupId);
          if (!groupData) {
            console.log('❌ [일반정책모드] 그룹 데이터 없음:', { accessGroupId, policyId: policy.id });
            return false;
          }

          // companyNames에 현재 사용자의 업체명이 포함되어 있는지 확인
          const companyNames = groupData.companyNames || [];
          const hasAccess = companyNames.includes(userCompanyName);
          
          console.log('🔍 [일반정책모드] 정책표 필터링:', {
            policyId: policy.id,
            accessGroupId,
            companyNames,
            userCompanyName,
            hasAccess
          });
          
          return hasAccess;
        });
        
        console.log('✅ [일반정책모드] 필터링 완료:', {
          filteredCount: policies.length
        });
      } else if (['SS', 'S'].includes(userRole)) {
        // SS(총괄), S(정산) 레벨은 모든 정책표 표시
      } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
        // 팀장 레벨은 본인이 생성한 정책표만 확인 가능
        const currentUserId = req.headers['x-user-id'] || req.query.userId;
        policies = policies.filter(policy => {
          // 생성자ID가 있으면 ID로 비교, 없으면 생성자 이름으로 비교 (하위 호환성)
          if (policy.creatorId) {
            return policy.creatorId === currentUserId;
          } else {
            // 기존 데이터 호환: 생성자 이름과 현재 사용자 이름 비교
            // checkPermission에서 가져온 사용자 이름과 비교
            // 하지만 정확하지 않을 수 있으므로, 가능하면 creatorId 사용 권장
            return false; // creatorId가 없으면 접근 불가 (안전한 기본값)
          }
        });
      } else {
        // 그 외 사용자(A-F)는 그룹의 담당자(managerIds)에 포함된 경우만 해당 그룹의 정책표 표시
        // 정책영업그룹 목록 조회
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroupsMap = new Map();
        userGroupsDataRows.forEach(row => {
          const groupId = row[0];
          const groupData = parseUserGroupData(row[2]);
          userGroupsMap.set(groupId, groupData);
        });

        // 현재 사용자 아이디 확인
        const currentUserId = req.headers['x-user-id'] || req.query.userId;

        console.log('🔍 [정책모드] 필터링 시작:', {
          userRole,
          currentUserId,
          totalPolicies: policies.length,
          userGroupsMapSize: userGroupsMap.size
        });

        // 접근권한에 포함된 정책표만 필터링
        policies = policies.filter(policy => {
          const accessGroupId = policy.accessGroupId;
          if (!accessGroupId) {
            console.log('❌ [정책모드] 접근권한 없음:', policy.id);
            return false; // 접근권한이 없으면 접근 불가
          }
          
          const groupData = userGroupsMap.get(accessGroupId);
          if (!groupData) {
            console.log('❌ [정책모드] 그룹 데이터 없음:', { accessGroupId, policyId: policy.id });
            return false;
          }

          // managerIds에 현재 사용자 아이디가 포함되어 있는지 확인
          const managerIds = groupData.managerIds || [];
          const hasAccess = managerIds.includes(currentUserId);
          
          console.log('🔍 [정책모드] 정책표 필터링:', {
            policyId: policy.id,
            accessGroupId,
            managerIds,
            currentUserId,
            hasAccess
          });
          
          return hasAccess;
        });
        
        console.log('✅ [정책모드] 필터링 완료:', {
          filteredCount: policies.length
        });
      }

      // 추가 필터링
      // 적용일시 텍스트 검색
      if (applyDateSearch) {
        const searchTerm = applyDateSearch.toLowerCase();
        policies = policies.filter(p => {
          const applyDate = (p.applyDate || '').toLowerCase();
          return applyDate.includes(searchTerm);
        });
      }
      if (creator) {
        policies = policies.filter(p => p.creator === creator);
      }
      if (createDateFrom) {
        policies = policies.filter(p => p.createdAt >= createDateFrom);
      }
      if (createDateTo) {
        policies = policies.filter(p => p.createdAt <= createDateTo);
      }

      return res.json(policies);
    } catch (error) {
      console.error('[정책표] 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-tables/:id/register
  router.post('/policy-tables/:id/register', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      // 권한 체크 (S와 SS 모두 허용)
      const permission = await checkPermission(req, ['S', 'SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        console.error('[정책표] 등록 권한 없음:', {
          userId: req.headers['x-user-id'],
          userRole: req.headers['x-user-role'],
          permission: permission
        });
        return res.status(403).json({ 
          success: false, 
          error: `권한이 없습니다. (사용자 역할: ${permission.userRole || '없음'})` 
        });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:N`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const updatedRow = [...existingRow];
      updatedRow[11] = 'Y'; // 등록여부
      updatedRow[12] = new Date().toISOString(); // 등록일시

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 1}:M${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        message: '정책표가 등록되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 등록 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-tables/:id
  router.get('/policy-tables/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { id } = req.params;
      const userRole = req.headers['x-user-role'] || req.query.userRole;
      const mode = req.query.mode;
      const isGeneralPolicyMode = mode === 'generalPolicy' || mode === 'general-policy';

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:N`
        });
      });

      const rows = response.data.values || [];
      const row = rows.find(r => r[0] === id);

      if (!row) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      // 권한 체크
      if (isGeneralPolicyMode) {
        // 일반정책모드 필터링: companyNames 기반
        const currentUserId = req.headers['x-user-id'] || req.query.userId;
        const accessGroupId = row[5]; // 접근권한 (그룹ID)
        
        if (!accessGroupId) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }

        // 정책영업그룹 조회
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const userGroup = userGroupsDataRows.find(r => r[0] === accessGroupId);
        
        if (!userGroup) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }

        const groupData = parseUserGroupData(userGroup[2]);
        
        // 현재 사용자의 업체명 확인
        const generalModeSheetName = '일반모드권한관리';
        const generalModeResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${generalModeSheetName}!A:K`
          });
        });

        const generalModeRows = generalModeResponse.data.values || [];
        let userCompanyName = null;
        if (generalModeRows.length > 3) {
          const generalModeDataRows = generalModeRows.slice(3);
          const userRow = generalModeDataRows.find(row => 
            row[0] === currentUserId || row[10] === currentUserId // A열 또는 K열
          );
          if (userRow) {
            userCompanyName = (userRow[1] || '').trim(); // B열 업체명
          }
        }

        if (!userCompanyName) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }

        // companyNames에 현재 사용자의 업체명이 포함되어 있는지 확인
        const companyNames = groupData.companyNames || [];
        if (!companyNames.includes(userCompanyName)) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      } else if (['SS', 'S'].includes(userRole)) {
        // SS(총괄), S(정산) 레벨은 모든 정책표 접근 가능
      } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
        // 팀장 레벨은 본인이 생성한 정책표만 접근 가능
        const currentUserId = req.headers['x-user-id'];
        const creatorId = row[13] || ''; // 생성자ID
        if (creatorId && creatorId !== currentUserId) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
        // creatorId가 없으면 기존 데이터이므로 접근 불가 (안전한 기본값)
        if (!creatorId) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      } else {
        // 그 외 사용자(A-F)는 그룹의 담당자(managerIds)에 포함된 경우만 접근 가능
        const accessGroupId = row[5]; // 접근권한 (그룹ID)
        if (accessGroupId) {
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });

          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          const userGroup = userGroupsDataRows.find(r => r[0] === accessGroupId);
          
          if (userGroup) {
            const groupData = parseUserGroupData(userGroup[2]);
            const currentUserId = req.headers['x-user-id'];
            const managerIds = groupData.managerIds || [];
            if (!managerIds.includes(currentUserId)) {
              return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
            }
          } else {
            return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
          }
        } else {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      }

      const policy = {
        id: row[0] || '',
        policyTableId: row[1] || '',
        policyTableName: row[2] || '',
        applyDate: row[3] || '',
        applyContent: row[4] || '',
        accessGroupId: row[5] || '',
        creator: row[6] || '',
        createdAt: row[7] || '',
        messageId: row[8] || '',
        threadId: row[9] || '',
        imageUrl: row[10] || '',
        registeredAt: row[12] || ''
      };

      return res.json(policy);
    } catch (error) {
      console.error('[정책표] 상세 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-tables/:id/refresh-image
  router.post('/policy-tables/:id/refresh-image', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:N`
        });
      });

      const rows = response.data.values || [];
      const row = rows.find(r => r[0] === id);

      if (!row) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      const messageId = row[8];
      if (!messageId) {
        return res.status(400).json({ success: false, error: '메시지 ID가 없습니다.' });
      }

      // Discord API로 메시지 조회하여 이미지 URL 갱신
      if (!DISCORD_LOGGING_ENABLED || !discordBot || !discordBot.isReady()) {
        return res.status(503).json({ success: false, error: 'Discord 봇이 준비되지 않았습니다.' });
      }

      // 스레드 ID로 스레드 찾기
      const threadId = row[9];
      if (!threadId) {
        return res.status(400).json({ success: false, error: '스레드 ID가 없습니다.' });
      }

      const thread = await discordBot.channels.fetch(threadId);
      if (!thread) {
        return res.status(404).json({ success: false, error: '디스코드 스레드를 찾을 수 없습니다.' });
      }

      const message = await thread.messages.fetch(messageId);
      if (!message || !message.attachments.first()) {
        return res.status(404).json({ success: false, error: '메시지 또는 이미지를 찾을 수 없습니다.' });
      }

      const newImageUrl = message.attachments.first().url;

      // 구글시트 업데이트
      const rowIndex = rows.findIndex(r => r[0] === id);
      const updatedRow = [...row];
      updatedRow[10] = newImageUrl; // 이미지URL

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 1}:M${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      return res.json({
        success: true,
        imageUrl: newImageUrl,
        message: '이미지가 갱신되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 이미지 갱신 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-tables/:id
  router.delete('/policy-tables/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:N`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST),
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      });

      return res.json({
        success: true,
        message: '정책표가 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = setupPolicyTableRoutes;

