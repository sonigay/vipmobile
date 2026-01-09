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
// 서버 시작을 블로킹하지 않도록 비동기로 초기화
let discordBot = null;
if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
  // 비동기로 초기화하여 서버 시작을 블로킹하지 않음
  setImmediate(() => {
    try {
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
        .catch(error => {
          console.error('❌ [정책표] Discord 봇 로그인 실패:', error.message);
          discordBot = null; // 실패 시 null로 설정
        });
    } catch (error) {
      console.error('❌ [정책표] Discord 봇 초기화 오류:', error.message);
      discordBot = null;
    }
  });
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
    
    // 대리점아이디관리 시트 조회 (캐싱 적용)
    const response = await getAgentManagementData(sheets, SPREADSHEET_ID);

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
    // 형식: !screenshot <URL> policyTableName=<이름> userName=<사용자> requestId=<고유ID>
    // requestId를 추가하여 여러 요청을 구분할 수 있도록 함
    const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const command = `!screenshot ${sheetUrl} policyTableName=${encodeURIComponent(policyTableName)} userName=${encodeURIComponent(userName)} requestId=${requestId}`;
    console.log(`📤 [${requestId}] 디스코드 명령어 전송: ${command.substring(0, 100)}...`);
    console.log(`📤 [${requestId}] 정책표: ${policyTableName}, URL: ${sheetUrl.substring(0, 50)}...`);
    
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
const SHEET_TAB_ORDER = '정책표목록_탭순서';
const SHEET_GROUP_CHANGE_HISTORY = '정책모드_정책영업그룹_변경이력';
const SHEET_DEFAULT_GROUPS = '정책모드_기본정책영업그룹';
const SHEET_OTHER_POLICY_TYPES = '정책모드_기타정책목록';
const SHEET_BUDGET_CHANNEL_SETTINGS = '예산모드_예산채널설정';
const SHEET_BASIC_BUDGET_SETTINGS = '예산모드_기본예산설정';
const SHEET_BASIC_DATA_SETTINGS = '예산모드_기본데이터설정';

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

const HEADERS_BUDGET_CHANNEL_SETTINGS = [
  '예산채널ID',
  '예산채널이름',
  '예산채널설명',
  '예산채널링크',
  '년월',
  '확인자적용권한',
  '등록일시',
  '등록자'
];

const HEADERS_BASIC_BUDGET_SETTINGS = [
  '기본예산ID',
  '기본예산이름',
  '기본예산설명',
  '기본예산링크',
  '년월',
  '확인자적용권한',
  '등록일시',
  '등록자'
];

const HEADERS_BASIC_DATA_SETTINGS = [
  '기본데이터ID',
  '기본데이터이름',
  '기본데이터설명',
  '기본데이터링크',
  '년월',
  '확인자적용권한',
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
  '등록일시',           // 12
  '생성자ID',           // 13: 생성자ID (N열)
  '확인이력'            // 14: 확인이력 (JSON 배열 형식) (O열)
];

const HEADERS_USER_GROUPS = [
  '그룹ID',
  '그룹이름',
  '일반사용자목록',
  '등록일시',
  '등록자',
  '폰클등록여부'  // Y/N
];

const HEADERS_TAB_ORDER = [
  '사용자ID',
  '탭순서',
  '생성카드순서',
  '수정일시',
  '수정자'
];

const HEADERS_DEFAULT_GROUPS = [
  '사용자ID',
  '정책표ID',
  '기본그룹ID목록',  // JSON 배열 형식
  '수정일시',
  '수정자'
];

const HEADERS_OTHER_POLICY_TYPES = [
  '정책명',
  '등록일시',
  '등록자'
];

const HEADERS_GROUP_CHANGE_HISTORY = [
  '변경ID',
  '그룹ID',
  '그룹이름',
  '변경타입',        // 그룹이름/업체명
  '변경항목',        // 추가/수정/삭제
  '변경전값',
  '변경후값',
  '변경일시',
  '변경자ID',
  '변경자이름',
  '폰클적용여부',    // Y/N (하위 호환성 유지)
  '폰클적용일시',
  '폰클적용자',
  '폰클적용업체명'   // JSON 배열: ["업체A", "업체B"] (업체명별 개별 적용)
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

// 캐시 TTL 설정 (성능 최적화: 적절한 TTL)
const CACHE_TTL = {
  USER_GROUPS: 30 * 60 * 1000,       // 30분 (자주 변하지 않으므로 TTL 연장해 API 호출 수 감소)
  POLICY_TABLES: 2 * 60 * 1000,      // 2분 (정책표 목록 - 적절한 실시간성 유지)
  POLICY_TABLE_DETAIL: 30 * 1000, // 30초 (정책표 상세 - 실시간성 중요)
  POLICY_TABLE_SETTINGS: 30 * 60 * 1000, // 30분 (정책표 설정 - 읽기 전용, 자주 변경되지 않음)
  POLICY_TABLE_TABS: 2 * 60 * 1000,  // 2분 (탭 목록 - 적절한 실시간성 유지)
  GENERAL_MODE_PERMISSION: 30 * 60 * 1000, // 30분 (일반모드권한관리 시트 - 자주 변경되지 않음)
  COMPANIES: 30 * 60 * 1000,          // 30분 (업체명 목록 - 자주 변경되지 않음)
  AGENT_MANAGEMENT: 30 * 60 * 1000,   // 30분 (대리점아이디관리 - 자주 변경되지 않음, 매우 자주 호출됨)
  SHEET_HEADERS: 30 * 60 * 1000,      // 30분 (시트 헤더 - 자주 변경되지 않음)
  DEFAULT_GROUPS: 30 * 60 * 1000,    // 30분 (기본 그룹 설정 - 자주 변경되지 않음)
  OTHER_POLICY_TYPES: 30 * 60 * 1000, // 30분 (기타정책 목록 - 자주 변경되지 않음)
  // 변경이력은 캐싱하지 않음 (실시간성 중요)
};

// 정책영업그룹 마지막 성공 응답 (rate limit 시 사용)
let lastUserGroupsCache = null;
// 기본 그룹 설정 마지막 성공 응답 (userId별)
const lastDefaultGroupsCache = new Map();
// 기타정책 목록 마지막 성공 응답
let lastOtherPolicyTypesCache = null;
// 대리점아이디관리 마지막 성공 응답 (rate limit 시 사용)
let lastAgentManagementCache = null;

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

// 캐시 무효화 헬퍼 함수
function invalidateCache(pattern) {
  const keysToDelete = [];
  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => cacheStore.delete(key));
  if (keysToDelete.length > 0) {
    console.log(`🗑️ [캐시 무효화] ${pattern}: ${keysToDelete.length}개 항목 삭제`);
  }
}

// 관련 캐시를 한 번에 무효화하는 헬퍼 함수
function invalidateRelatedCaches(type, id = null) {
  switch(type) {
    case 'user-group':
      // 정책영업그룹 변경 시 관련된 모든 캐시 무효화
      invalidateCache('user-groups');
      invalidateCache('change-history'); // 변경이력은 캐싱하지 않지만, 혹시 모를 경우를 대비
      invalidateCache('policy-tables'); // 정책영업그룹 이름이 정책표 목록에 표시되므로
      break;
    case 'policy-table':
      // 정책표 변경 시 관련 캐시 무효화
      invalidateCache('policy-tables');
      if (id) {
        invalidateCache(`policy-tables-${id}`);
      }
      break;
    case 'change-history':
      // 변경이력은 캐싱하지 않지만, 혹시 모를 경우를 대비
      invalidateCache('change-history');
      break;
  }
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
    
    setCache(cacheKey, headers, CACHE_TTL.SHEET_HEADERS);
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

// 대리점아이디관리 시트 조회 (캐싱 적용)
async function getAgentManagementData(sheets, SPREADSHEET_ID) {
  const agentSheetName = '대리점아이디관리';
  const cacheKey = `agent-management-${SPREADSHEET_ID}`;
  
  // 캐시 확인
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('✅ [캐시 히트] 대리점아이디관리');
    // 캐시된 데이터는 rows 배열이므로 response 형식으로 변환
    return { data: { values: cached } };
  }

  let response;
  try {
    response = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${agentSheetName}!A:Z`
      });
    });
  } catch (err) {
    // rate limit 등으로 실패 시 마지막 성공 데이터라도 반환
    const isRateLimitError =
      err?.code === 429 ||
      err?.response?.status === 429 ||
      (err?.message && err.message.toLowerCase().includes('quota exceeded')) ||
      (err?.message && err.message.toLowerCase().includes('ratelimit')) ||
      (err?.response?.data?.error?.status === 'RESOURCE_EXHAUSTED');

    if (isRateLimitError && lastAgentManagementCache) {
      console.warn('⚠️ [대리점아이디관리] rate limit 발생, 마지막 캐시 데이터 반환');
      setCache(cacheKey, lastAgentManagementCache, CACHE_TTL.AGENT_MANAGEMENT);
      return { data: { values: lastAgentManagementCache } };
    }
    throw err;
  }

  // 응답이 없거나 data가 없는 경우 처리
  if (!response || !response.data) {
    throw new Error('대리점아이디관리 시트 조회 실패: 응답이 없습니다.');
  }

  const rows = response.data.values || [];
  // 캐시에 저장 (rows 배열로 저장)
  setCache(cacheKey, rows, CACHE_TTL.AGENT_MANAGEMENT);
  lastAgentManagementCache = rows;
  return response;
}

// 권한 체크 헬퍼 함수
async function checkPermission(req, allowedRoles, mode = 'policy') {
  try {
    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    
    // 대리점아이디관리 시트에서 사용자 정보 조회 (캐싱 적용)
    const response = await getAgentManagementData(sheets, SPREADSHEET_ID);

    // 응답이 없거나 data가 없는 경우 처리
    if (!response || !response.data) {
      console.error(`[${mode === 'budget' ? '예산' : '정책'}표] 권한 체크 오류: 대리점아이디관리 시트 응답이 없습니다.`);
      return { hasPermission: false, error: '대리점아이디관리 시트 조회 실패' };
    }

    const rows = response.data.values || [];
    if (rows.length < 2) {
      console.warn(`[${mode === 'budget' ? '예산' : '정책'}표] 권한 체크: 대리점아이디관리 시트에 데이터가 없습니다.`);
      return { hasPermission: false, error: '대리점아이디관리 시트에 데이터가 없습니다.' };
    }

  // 로그인한 사용자 정보 찾기 (헤더에서 가져오기)
  const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId;
  const userRole = req.headers['x-user-role'] || req.body?.userRole || req.query?.userRole;
  
  // 대리점아이디관리 시트에서 사용자 정보 찾기
  // C열(2번 인덱스): 연락처(아이디) = contactId
  // A열(0번 인덱스): 대상(이름)
  // 정책모드: 접근권한 11인덱스, 권한레벨 17인덱스
  // 예산모드: 접근권한 18인덱스, 권한레벨 19인덱스
  const roleIndex = mode === 'budget' ? 19 : 17; // 예산모드는 19, 정책모드는 17
  const accessPermissionIndex = mode === 'budget' ? 18 : 11; // 예산모드는 18, 정책모드는 11
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
        role: userRow[roleIndex] || userRole,  // 권한레벨 (모드에 따라 인덱스 다름)
        accessPermission: userRow[accessPermissionIndex] || ''  // 접근권한 (모드에 따라 인덱스 다름)
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

  // 동적 권한 체크: 두 글자 대문자 패턴(팀장) 자동 인식
  const twoLetterPattern = /^[A-Z]{2}$/;
  let hasPermission = false;
  
  // allowedRoles에 'TEAM_LEADER'가 있으면 두 글자 대문자 패턴 체크
  if (allowedRoles.includes('TEAM_LEADER')) {
    hasPermission = finalUserRole === 'SS' || twoLetterPattern.test(finalUserRole);
  } else {
    // 기존 로직: 직접 권한 레벨 비교
    hasPermission = allowedRoles.includes(finalUserRole);
  }
  
  console.log('[정책표] 권한 체크 결과:', { 
    hasPermission, 
    finalUserRole, 
    allowedRoles,
    userName: finalUserName,
    userId: finalUserId,
    isTeamLeaderCheck: allowedRoles.includes('TEAM_LEADER')
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
  } catch (error) {
    console.error('[정책표] 권한 체크 오류:', error);
    return { 
      hasPermission: false, 
      error: error.message || '권한 체크 중 오류가 발생했습니다.',
      userRole: null,
      userId: null,
      userName: null
    };
  }
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

// ===== 큐 시스템 =====
// 대기열 관리 및 중복 생성 방지
const generationQueue = {
  queue: [], // 대기 중인 작업 목록 { jobId, userId, userName, policyTableName, createdAt, queuePosition }
  processing: [], // 처리 중인 작업 목록 { jobId, userId, userName, policyTableName, startedAt }
  maxConcurrent: 1, // 동시에 처리할 수 있는 최대 작업 수 (디스코드 봇이 한 번에 하나만 처리)
  userActiveJobs: new Map() // 사용자별 활성 작업 추적 { userId: Set<jobId> }
};

// 큐에 작업 추가
function addToQueue(jobId, userId, userName, policyTableName) {
  // 사용자가 이미 대기 중이거나 처리 중인 작업이 있는지 확인
  const userJobs = generationQueue.userActiveJobs.get(userId) || new Set();
  if (userJobs.size > 0) {
    // 이미 활성 작업이 있으면 큐에 추가하지 않고 기존 작업 정보 반환
    const existingJobId = Array.from(userJobs)[0];
    const existingJob = generationQueue.queue.find(item => item.jobId === existingJobId) ||
                       generationQueue.processing.find(item => item.jobId === existingJobId);
    if (existingJob) {
      return { ...existingJob, isDuplicate: true };
    }
  }

  const queuePosition = generationQueue.queue.length + 1;
  const queueItem = {
    jobId,
    userId,
    userName,
    policyTableName,
    createdAt: new Date().toISOString(),
    queuePosition
  };
  generationQueue.queue.push(queueItem);
  
  // 사용자 활성 작업에 추가
  if (!generationQueue.userActiveJobs.has(userId)) {
    generationQueue.userActiveJobs.set(userId, new Set());
  }
  generationQueue.userActiveJobs.get(userId).add(jobId);
  
  console.log(`📋 [큐] 작업 추가: ${jobId} (${policyTableName}, ${userName}), 대기순번: ${queuePosition}`);
  return queueItem;
}

// 큐에서 작업 제거
function removeFromQueue(jobId) {
  const index = generationQueue.queue.findIndex(item => item.jobId === jobId);
  if (index !== -1) {
    const queueItem = generationQueue.queue[index];
    generationQueue.queue.splice(index, 1);
    
    // 사용자 활성 작업에서 제거
    const userJobs = generationQueue.userActiveJobs.get(queueItem.userId);
    if (userJobs) {
      userJobs.delete(jobId);
      if (userJobs.size === 0) {
        generationQueue.userActiveJobs.delete(queueItem.userId);
      }
    }
    
    // 대기순번 재계산
    generationQueue.queue.forEach((item, idx) => {
      item.queuePosition = idx + 1;
    });
    console.log(`📋 [큐] 작업 제거: ${jobId}, 남은 대기: ${generationQueue.queue.length}`);
  }
}

// 처리 중인 작업 추가
function addToProcessing(jobId, userId, userName, policyTableName) {
  const processingItem = {
    jobId,
    userId,
    userName,
    policyTableName,
    startedAt: new Date().toISOString()
  };
  generationQueue.processing.push(processingItem);
  console.log(`⚙️ [큐] 처리 시작: ${jobId} (${policyTableName}, ${userName}), 처리 중: ${generationQueue.processing.length}`);
}

// 처리 중인 작업 제거
function removeFromProcessing(jobId) {
  const index = generationQueue.processing.findIndex(item => item.jobId === jobId);
  if (index !== -1) {
    const processingItem = generationQueue.processing[index];
    generationQueue.processing.splice(index, 1);
    
    // 사용자 활성 작업에서 제거
    const userJobs = generationQueue.userActiveJobs.get(processingItem.userId);
    if (userJobs) {
      userJobs.delete(jobId);
      if (userJobs.size === 0) {
        generationQueue.userActiveJobs.delete(processingItem.userId);
      }
    }
    
    console.log(`⚙️ [큐] 처리 완료: ${jobId}, 처리 중: ${generationQueue.processing.length}`);
  }
}

// 큐 상태 조회 (사용자 수와 작업 수 계산)
function getQueueStatus() {
  // 대기 중인 사용자 수 계산 (중복 제거)
  const queuedUserIds = new Set(generationQueue.queue.map(item => item.userId));
  const queuedUserCount = queuedUserIds.size;
  const queuedJobCount = generationQueue.queue.length;
  
  // 처리 중인 사용자 수 계산
  const processingUserIds = new Set(generationQueue.processing.map(item => item.userId));
  const processingUserCount = processingUserIds.size;
  const processingJobCount = generationQueue.processing.length;
  
  return {
    queueLength: queuedJobCount,
    processingLength: processingJobCount,
    maxConcurrent: generationQueue.maxConcurrent,
    queuedUserCount: queuedUserCount,
    processingUserCount: processingUserCount,
    queue: generationQueue.queue.map(item => ({
      jobId: item.jobId,
      userName: item.userName,
      policyTableName: item.policyTableName,
      queuePosition: item.queuePosition,
      createdAt: item.createdAt
    })),
    processing: generationQueue.processing.map(item => ({
      jobId: item.jobId,
      userName: item.userName,
      policyTableName: item.policyTableName,
      startedAt: item.startedAt
    }))
  };
}

// 특정 사용자의 대기순번 조회
function getUserQueuePosition(userId, jobId) {
  const queueItem = generationQueue.queue.find(item => item.jobId === jobId && item.userId === userId);
  if (queueItem) {
    return queueItem.queuePosition;
  }
  // 처리 중인 경우
  const processingItem = generationQueue.processing.find(item => item.jobId === jobId && item.userId === userId);
  if (processingItem) {
    return 0; // 처리 중
  }
  return null; // 큐에 없음
}

// 사용자가 이미 활성 작업이 있는지 확인
function hasUserActiveJob(userId) {
  const userJobs = generationQueue.userActiveJobs.get(userId);
  return userJobs && userJobs.size > 0;
}

// 큐 처리 함수 (대기 중인 작업을 순차적으로 처리)
let isProcessingQueue = false;
async function processQueue() {
  // 이미 처리 중이면 중복 실행 방지
  if (isProcessingQueue) {
    return;
  }

  isProcessingQueue = true;

  try {
    while (generationQueue.queue.length > 0 && generationQueue.processing.length < generationQueue.maxConcurrent) {
      const queueItem = generationQueue.queue[0]; // 첫 번째 항목 가져오기
      const { jobId, userId, userName, policyTableName } = queueItem;

      // 큐에서 제거하고 처리 중으로 이동
      removeFromQueue(jobId);
      addToProcessing(jobId, userId, userName, policyTableName);
      
      // 작업 상태에서 실제 파라미터 가져오기
      const jobStatus = getJobStatus(jobId);
      if (!jobStatus || !jobStatus.params) {
        console.error(`[큐] 작업 파라미터를 찾을 수 없습니다: ${jobId}`);
        removeFromProcessing(jobId);
        continue;
      }

      const params = jobStatus.params;
      
      // 상태 업데이트
      updateJobStatus(jobId, {
        ...jobStatus,
        status: 'processing',
        progress: 0,
        message: '처리 중...',
        queuePosition: 0
      });

      // 실제 작업 실행 (비동기, 완료를 기다리지 않음)
      processPolicyTableGeneration(jobId, params)
        .then(() => {
          removeFromProcessing(jobId);
          // 다음 작업 처리
          processQueue();
        })
        .catch(error => {
          console.error(`[큐] 작업 실패: ${jobId}`, error);
          removeFromProcessing(jobId);
          updateJobStatus(jobId, {
            status: 'failed',
            progress: 0,
            message: `처리 실패: ${error.message}`,
            error: error.message
          });
          // 다음 작업 처리
          processQueue();
        });
    }
  } finally {
    isProcessingQueue = false;
  }
}

// 정책표 생성 백그라운드 작업
async function processPolicyTableGeneration(jobId, params) {
  const { policyTableId, applyDate, applyContent, accessGroupId, accessGroupIds, creatorName, creatorRole, creatorId } = params;
  
  // accessGroupIds 배열 처리 (하위 호환성을 위해 accessGroupId도 지원)
  const groupIds = accessGroupIds || (accessGroupId ? [accessGroupId] : []);

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

    // 디버깅: 전달받은 policyTableId 로그
    console.log(`[정책표 생성] 요청된 policyTableId: ${policyTableId}`);
    console.log(`[정책표 생성] 사용 가능한 정책표 ID 목록:`, settingsRows.slice(1).map(row => row[0]));

    const settingsRow = settingsRows.find(row => row[0] === policyTableId);
    if (!settingsRow) {
      console.error(`[정책표 생성] ❌ 정책표 ID ${policyTableId}를 찾을 수 없습니다.`);
      console.error(`[정책표 생성] 사용 가능한 ID:`, settingsRows.slice(1).map(row => ({ id: row[0], name: row[1] })));
      throw new Error(`정책표 ID ${policyTableId}를 찾을 수 없습니다.`);
    }

    const policyTableName = settingsRow[1];
    const policyTableDescription = settingsRow[2] || '';
    const policyTableLink = settingsRow[3];  // 편집 링크
    const policyTablePublicLink = settingsRow[4] || settingsRow[3];  // 공개 링크 (없으면 편집 링크 사용)
    const discordChannelId = settingsRow[5];
    const creatorPermissions = settingsRow[6] ? JSON.parse(settingsRow[6]) : []; // 생성자적용권한

    // 디버깅: 찾은 정책표 정보 로그
    console.log(`[정책표 생성] ✅ 정책표 찾음: ${policyTableName} (ID: ${policyTableId})`);
    console.log(`[정책표 생성] 편집 링크: ${policyTableLink}`);
    console.log(`[정책표 생성] 공개 링크: ${policyTablePublicLink}`);

    // 2. 디스코드 봇을 통한 스크린샷 생성 (Canvas 렌더링 대체)
    updateJobStatus(jobId, {
      status: 'processing',
      progress: 50,
      message: '디스코드 봇으로 스크린샷 생성 중...'
    });

    const sheetUrl = policyTablePublicLink || policyTableLink;
    console.log(`[정책표 생성] 📸 사용할 시트 URL: ${sheetUrl}`);

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

    const createdAt = new Date().toISOString();
    const newRowId = `POL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 여러 그룹 ID를 JSON 배열 형식으로 저장
    const accessGroupIdsJson = groupIds.length > 0 ? JSON.stringify(groupIds) : '';

    const newRow = [
      newRowId,                    // 0: 정책표ID (고유 ID)
      policyTableId,               // 1: 정책표ID (설정과 연결)
      policyTableName,             // 2: 정책표이름
      applyDate,                   // 3: 정책적용일시
      applyContent,                // 4: 정책적용내용
      accessGroupIdsJson,          // 5: 접근권한 (그룹ID 배열 JSON)
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
        range: `${SHEET_POLICY_TABLE_LIST}!A:N`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRow] }
      });
    });

    // 완료
    updateJobStatus(jobId, {
      status: 'completed',
      progress: 100,
      message: groupIds.length > 1 
        ? `${groupIds.length}개 그룹에 대한 정책표 생성이 완료되었습니다.`
        : '정책표 생성이 완료되었습니다.',
      result: {
        id: newRowId,
        policyTableId,
        policyTableName,
        imageUrl,
        messageId,
        threadId,
        groupCount: groupIds.length
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
    
    // 디버깅 로그 (정책표 관련 요청만)
    const isPolicyTableRequest = req.url && req.url.includes('/api/policy-tables');
    
    if (isPolicyTableRequest) {
      console.log('🔍 [setCORSHeaders] 호출:', {
        url: req.url,
        method: req.method,
        origin: origin,
        allowedOrigins: allowedOrigins,
        originInAllowed: origin && allowedOrigins.includes(origin)
      });
    }
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && process.env.CORS_ORIGIN?.includes(origin)) {
      // 환경 변수에 있는 경우도 허용
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://vipmobile.vercel.app');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, X-API-Key, x-user-id, x-user-role, x-user-name, x-mode');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24시간 캐시
    
    if (isPolicyTableRequest) {
      console.log('✅ [setCORSHeaders] CORS 헤더 설정 완료:', {
        'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
        'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
      });
    }
  };

  // CORS 헤더는 전역 핸들러(app.options('*'))에서 처리되므로
  // 라우터에서는 각 라우트 핸들러에서만 setCORSHeaders 호출
  // OPTIONS 요청은 전역 핸들러가 처리

  // ========== 정책표생성설정 관련 API ==========

  // GET /api/policy-table-settings
  router.get('/policy-table-settings', async (req, res) => {
    setCORSHeaders(req, res);
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    try {
      // 정책표생성 탭 접근 권한: SS(총괄) 또는 두 글자 대문자 패턴(팀장)
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 캐시 확인 (30분 TTL - 읽기 전용 데이터)
      const userId = req.headers['x-user-id'] || req.query.userId;
      const cacheKey = `policy-table-settings-${SPREADSHEET_ID}-${userId || 'all'}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 정책표 설정 목록');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_TAB_ORDER, HEADERS_TAB_ORDER);

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

      let settings = dataRows.map(row => ({
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

      // 사용자별 생성카드 순서 적용
      if (userId) {
        try {
          const orderResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_TAB_ORDER}!A:E`
            });
          });
          
          const orderRows = orderResponse.data.values || [];
          if (orderRows.length > 1) {
            const orderDataRows = orderRows.slice(1);
            const userOrderRow = orderDataRows.find(row => row[0] === userId);
            
            if (userOrderRow && userOrderRow[2]) {
              try {
                const cardOrderArray = JSON.parse(userOrderRow[2]);
                if (Array.isArray(cardOrderArray) && cardOrderArray.length > 0) {
                  // 순서 배열을 기준으로 카드 정렬
                  const orderMap = new Map();
                  cardOrderArray.forEach((settingId, index) => {
                    orderMap.set(settingId, index);
                  });
                  
                  // 순서 배열에 있는 카드와 없는 카드 분리
                  const orderedSettings = [];
                  const unorderedSettings = [];
                  
                  settings.forEach(setting => {
                    if (orderMap.has(setting.id)) {
                      orderedSettings.push({ setting, order: orderMap.get(setting.id) });
                    } else {
                      unorderedSettings.push(setting);
                    }
                  });
                  
                  // 순서대로 정렬
                  orderedSettings.sort((a, b) => a.order - b.order);
                  
                  // 순서가 있는 카드 먼저, 그 다음 순서가 없는 카드
                  settings = [...orderedSettings.map(item => item.setting), ...unorderedSettings];
                  
                  console.log('✅ [정책표] 생성카드 순서 적용:', {
                    userId,
                    cardOrderArray,
                    orderedCount: orderedSettings.length,
                    unorderedCount: unorderedSettings.length
                  });
                }
              } catch (parseError) {
                console.warn('[정책표] 생성카드 순서 JSON 파싱 오류:', parseError);
              }
            }
          }
        } catch (orderError) {
          console.warn('[정책표] 생성카드 순서 조회 오류:', orderError);
          // 순서 조회 실패 시 기본 순서 사용
        }
      }

      // 캐시에 저장 (30분 TTL)
      setCache(cacheKey, settings, CACHE_TTL.POLICY_TABLE_SETTINGS);
      
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

  // ========== 예산채널설정 관련 API ==========

  // GET /api/budget-channel-settings
  router.get('/budget-channel-settings', async (req, res) => {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    try {
      // 예산채널설정 탭 접근 권한: SS(총괄), S(정산) 또는 두 글자 대문자 패턴(팀장)
      const permission = await checkPermission(req, ['SS', 'S', 'TEAM_LEADER'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 년월 필터 파라미터
      const yearMonth = req.query.yearMonth;
      
      // 캐시 확인 (30분 TTL) - 년월별로 캐시 분리
      const userId = req.headers['x-user-id'] || req.query.userId;
      const cacheKey = `budget-channel-settings-${SPREADSHEET_ID}-${userId || 'all'}-${yearMonth || 'all'}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 예산채널 설정 목록');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BUDGET_CHANNEL_SETTINGS, HEADERS_BUDGET_CHANNEL_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BUDGET_CHANNEL_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);

      let settings = dataRows.map(row => ({
        id: row[0] || '',
        channelName: row[1] || '',
        channelDescription: row[2] || '',
        channelLink: row[3] || '',
        yearMonth: row[4] || '',
        checkerPermissions: row[5] ? JSON.parse(row[5]) : [],
        registeredAt: row[6] || '',
        registeredBy: row[7] || ''
      }));

      // 년월 필터 적용
      if (yearMonth) {
        settings = settings.filter(setting => setting.yearMonth === yearMonth);
      }

      // 캐시에 저장 (30분 TTL)
      setCache(cacheKey, settings, CACHE_TTL.POLICY_TABLE_SETTINGS);

      return res.json(settings);
    } catch (error) {
      console.error('[예산채널] 설정 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/budget-channel-settings
  router.post('/budget-channel-settings', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { channelName, channelDescription, channelLink, yearMonth, checkerPermissions } = req.body;

      if (!channelName || !channelLink || !yearMonth || !checkerPermissions || !Array.isArray(checkerPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      // 년월 형식 검증 (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ success: false, error: '년월 형식이 올바르지 않습니다. (YYYY-MM 형식)' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BUDGET_CHANNEL_SETTINGS, HEADERS_BUDGET_CHANNEL_SETTINGS);

      // 편집 링크 정규화
      const normalizedEditLink = normalizeGoogleSheetEditLink(channelLink);
      
      const newId = `BC_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId,
        channelName,
        channelDescription || '',
        normalizedEditLink,
        yearMonth,
        JSON.stringify(checkerPermissions),
        registeredAt,
        registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BUDGET_CHANNEL_SETTINGS}!A:H`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [newRow]
          }
        });
      });

      // 캐시 무효화
      invalidateCache('budget-channel-settings');

      return res.json({
        success: true,
        id: newId,
        message: '예산채널 설정이 추가되었습니다.'
      });
    } catch (error) {
      console.error('[예산채널] 설정 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/budget-channel-settings/:id
  router.put('/budget-channel-settings/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { channelName, channelDescription, channelLink, yearMonth, checkerPermissions } = req.body;

      if (!channelName || !channelLink || !yearMonth || !checkerPermissions || !Array.isArray(checkerPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      // 년월 형식 검증 (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ success: false, error: '년월 형식이 올바르지 않습니다. (YYYY-MM 형식)' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BUDGET_CHANNEL_SETTINGS, HEADERS_BUDGET_CHANNEL_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BUDGET_CHANNEL_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      
      // 헤더 행 제외 (첫 번째 행은 헤더)
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '예산채널 설정을 찾을 수 없습니다.' });
      }
      
      // 헤더를 제외한 데이터 행에서 찾기
      const dataRows = rows.slice(1);
      const rowIndex = dataRows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '예산채널 설정을 찾을 수 없습니다.' });
      }

      // 편집 링크 정규화
      const normalizedEditLink = normalizeGoogleSheetEditLink(channelLink);

      // dataRows[rowIndex]는 헤더를 제외한 데이터 행이므로
      // 업데이트 시 rowIndex + 2를 사용 (헤더 1행 + 0-based 인덱스 + 1)
      const updatedRow = [
        id,
        channelName,
        channelDescription || '',
        normalizedEditLink,
        yearMonth,
        JSON.stringify(checkerPermissions),
        dataRows[rowIndex][6] || new Date().toISOString(), // 등록일시 유지
        dataRows[rowIndex][7] || permission.userId || 'Unknown' // 등록자 유지
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BUDGET_CHANNEL_SETTINGS}!A${rowIndex + 2}:H${rowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [updatedRow]
          }
        });
      });

      // 캐시 무효화
      invalidateCache('budget-channel-settings');

      return res.json({
        success: true,
        message: '예산채널 설정이 수정되었습니다.'
      });
    } catch (error) {
      console.error('[예산채널] 설정 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/budget-channel-settings/:id
  router.delete('/budget-channel-settings/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BUDGET_CHANNEL_SETTINGS, HEADERS_BUDGET_CHANNEL_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BUDGET_CHANNEL_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '예산채널 설정을 찾을 수 없습니다.' });
      }

      // 행 삭제 (헤더 행이 있으므로 rowIndex + 1이 실제 시트의 행 번호)
      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_BUDGET_CHANNEL_SETTINGS),
                  dimension: 'ROWS',
                  startIndex: rowIndex + 1, // 헤더 행 다음부터 시작
                  endIndex: rowIndex + 2
                }
              }
            }]
          }
        });
      });

      // 캐시 무효화
      invalidateCache('budget-channel-settings');

      return res.json({
        success: true,
        message: '예산채널 설정이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[예산채널] 설정 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 기본예산설정 관련 API ==========

  // GET /api/basic-budget-settings
  router.get('/basic-budget-settings', async (req, res) => {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    try {
      // 기본예산설정 탭 접근 권한: SS(총괄), S(정산) 또는 두 글자 대문자 패턴(팀장)
      const permission = await checkPermission(req, ['SS', 'S', 'TEAM_LEADER'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const yearMonth = req.query.yearMonth;
      const userId = req.headers['x-user-id'] || req.query.userId;
      const cacheKey = `basic-budget-settings-${SPREADSHEET_ID}-${userId || 'all'}-${yearMonth || 'all'}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 기본예산 설정 목록');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_BUDGET_SETTINGS, HEADERS_BASIC_BUDGET_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_BUDGET_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      let settings = dataRows.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        description: row[2] || '',
        link: row[3] || '',
        yearMonth: row[4] || '',
        checkerPermissions: row[5] ? JSON.parse(row[5]) : [],
        registeredAt: row[6] || '',
        registeredBy: row[7] || ''
      }));

      if (yearMonth) {
        settings = settings.filter(setting => setting.yearMonth === yearMonth);
      }

      setCache(cacheKey, settings, CACHE_TTL.POLICY_TABLE_SETTINGS);
      return res.json(settings);
    } catch (error) {
      console.error('[기본예산] 설정 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/basic-budget-settings
  router.post('/basic-budget-settings', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { name, description, link, yearMonth, checkerPermissions } = req.body;
      if (!name || !link || !yearMonth || !checkerPermissions || !Array.isArray(checkerPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ success: false, error: '년월 형식이 올바르지 않습니다. (YYYY-MM 형식)' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_BUDGET_SETTINGS, HEADERS_BASIC_BUDGET_SETTINGS);
      const normalizedEditLink = normalizeGoogleSheetEditLink(link);
      const newId = `BB_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId, name, description || '', normalizedEditLink, yearMonth,
        JSON.stringify(checkerPermissions), registeredAt, registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_BUDGET_SETTINGS}!A:H`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });
      invalidateCache('basic-budget-settings');
      return res.json({ success: true, id: newId, message: '기본예산 설정이 추가되었습니다.' });
    } catch (error) {
      console.error('[기본예산] 설정 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/basic-budget-settings/:id
  router.put('/basic-budget-settings/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { name, description, link, yearMonth, checkerPermissions } = req.body;
      if (!name || !link || !yearMonth || !checkerPermissions || !Array.isArray(checkerPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ success: false, error: '년월 형식이 올바르지 않습니다. (YYYY-MM 형식)' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_BUDGET_SETTINGS, HEADERS_BASIC_BUDGET_SETTINGS);
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_BUDGET_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '기본예산 설정을 찾을 수 없습니다.' });
      }

      const dataRows = rows.slice(1);
      const rowIndexInFiltered = dataRows.findIndex(row => row[0] === id);

      if (rowIndexInFiltered === -1) {
        return res.status(404).json({ success: false, error: '기본예산 설정을 찾을 수 없습니다.' });
      }

      const actualRowIndex = rowIndexInFiltered + 1;
      const normalizedEditLink = normalizeGoogleSheetEditLink(link);
      const updatedRow = [
        id, name, description || '', normalizedEditLink, yearMonth,
        JSON.stringify(checkerPermissions),
        dataRows[rowIndexInFiltered][6] || new Date().toISOString(),
        dataRows[rowIndexInFiltered][7] || permission.userId || 'Unknown'
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_BUDGET_SETTINGS}!A${actualRowIndex + 1}:H${actualRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });
      invalidateCache('basic-budget-settings');
      return res.json({ success: true, message: '기본예산 설정이 수정되었습니다.' });
    } catch (error) {
      console.error('[기본예산] 설정 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/basic-budget-settings/:id
  router.delete('/basic-budget-settings/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_BUDGET_SETTINGS, HEADERS_BASIC_BUDGET_SETTINGS);
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_BUDGET_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '기본예산 설정을 찾을 수 없습니다.' });
      }
      
      // 헤더를 제외한 데이터 행에서 찾기
      const dataRows = rows.slice(1);
      const rowIndexInFiltered = dataRows.findIndex(row => row[0] === id);

      if (rowIndexInFiltered === -1) {
        return res.status(404).json({ success: false, error: '기본예산 설정을 찾을 수 없습니다.' });
      }

      // 실제 시트 행 번호 = 헤더(1행) + 찾은 인덱스 + 1 (0-based to 1-based)
      const actualRowIndex = rowIndexInFiltered + 1;

      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_BASIC_BUDGET_SETTINGS),
                  dimension: 'ROWS',
                  startIndex: actualRowIndex,
                  endIndex: actualRowIndex + 1
                }
              }
            }]
          }
        });
      });
      invalidateCache('basic-budget-settings');
      return res.json({ success: true, message: '기본예산 설정이 삭제되었습니다.' });
    } catch (error) {
      console.error('[기본예산] 설정 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 기본데이터설정 관련 API ==========

  // GET /api/basic-data-settings
  router.get('/basic-data-settings', async (req, res) => {
    setCORSHeaders(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    try {
      // 기본데이터설정 탭 접근 권한: SS(총괄), S(정산) 또는 두 글자 대문자 패턴(팀장)
      const permission = await checkPermission(req, ['SS', 'S', 'TEAM_LEADER'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const yearMonth = req.query.yearMonth;
      const userId = req.headers['x-user-id'] || req.query.userId;
      const cacheKey = `basic-data-settings-${SPREADSHEET_ID}-${userId || 'all'}-${yearMonth || 'all'}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 기본데이터 설정 목록');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_DATA_SETTINGS, HEADERS_BASIC_DATA_SETTINGS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_DATA_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      let settings = dataRows.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        description: row[2] || '',
        link: row[3] || '',
        yearMonth: row[4] || '',
        checkerPermissions: row[5] ? JSON.parse(row[5]) : [],
        registeredAt: row[6] || '',
        registeredBy: row[7] || ''
      }));

      if (yearMonth) {
        settings = settings.filter(setting => setting.yearMonth === yearMonth);
      }

      setCache(cacheKey, settings, CACHE_TTL.POLICY_TABLE_SETTINGS);
      return res.json(settings);
    } catch (error) {
      console.error('[기본데이터] 설정 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/basic-data-settings
  router.post('/basic-data-settings', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { name, description, link, yearMonth, checkerPermissions } = req.body;
      if (!name || !link || !yearMonth || !checkerPermissions || !Array.isArray(checkerPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ success: false, error: '년월 형식이 올바르지 않습니다. (YYYY-MM 형식)' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_DATA_SETTINGS, HEADERS_BASIC_DATA_SETTINGS);
      const normalizedEditLink = normalizeGoogleSheetEditLink(link);
      const newId = `BD_${Date.now()}`;
      const registeredAt = new Date().toISOString();
      const registeredBy = permission.userId || 'Unknown';

      const newRow = [
        newId, name, description || '', normalizedEditLink, yearMonth,
        JSON.stringify(checkerPermissions), registeredAt, registeredBy
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_DATA_SETTINGS}!A:H`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });
      invalidateCache('basic-data-settings');
      return res.json({ success: true, id: newId, message: '기본데이터 설정이 추가되었습니다.' });
    } catch (error) {
      console.error('[기본데이터] 설정 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/basic-data-settings/:id
  router.put('/basic-data-settings/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { name, description, link, yearMonth, checkerPermissions } = req.body;
      if (!name || !link || !yearMonth || !checkerPermissions || !Array.isArray(checkerPermissions)) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ success: false, error: '년월 형식이 올바르지 않습니다. (YYYY-MM 형식)' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_DATA_SETTINGS, HEADERS_BASIC_DATA_SETTINGS);
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_DATA_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '기본데이터 설정을 찾을 수 없습니다.' });
      }

      const dataRows = rows.slice(1);
      const rowIndexInFiltered = dataRows.findIndex(row => row[0] === id);

      if (rowIndexInFiltered === -1) {
        return res.status(404).json({ success: false, error: '기본데이터 설정을 찾을 수 없습니다.' });
      }

      const actualRowIndex = rowIndexInFiltered + 1;
      const normalizedEditLink = normalizeGoogleSheetEditLink(link);
      const updatedRow = [
        id, name, description || '', normalizedEditLink, yearMonth,
        JSON.stringify(checkerPermissions),
        dataRows[rowIndexInFiltered][6] || new Date().toISOString(),
        dataRows[rowIndexInFiltered][7] || permission.userId || 'Unknown'
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_DATA_SETTINGS}!A${actualRowIndex + 1}:H${actualRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });
      invalidateCache('basic-data-settings');
      return res.json({ success: true, message: '기본데이터 설정이 수정되었습니다.' });
    } catch (error) {
      console.error('[기본데이터] 설정 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/basic-data-settings/:id
  router.delete('/basic-data-settings/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS'], 'budget');
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_BASIC_DATA_SETTINGS, HEADERS_BASIC_DATA_SETTINGS);
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_BASIC_DATA_SETTINGS}!A:H`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '기본데이터 설정을 찾을 수 없습니다.' });
      }
      
      // 헤더를 제외한 데이터 행에서 찾기
      const dataRows = rows.slice(1);
      const rowIndexInFiltered = dataRows.findIndex(row => row[0] === id);

      if (rowIndexInFiltered === -1) {
        return res.status(404).json({ success: false, error: '기본데이터 설정을 찾을 수 없습니다.' });
      }

      // 실제 시트 행 번호 = 헤더(1행) + 찾은 인덱스 + 1 (0-based to 1-based)
      const actualRowIndex = rowIndexInFiltered + 1;

      await withRetry(async () => {
        return await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_BASIC_DATA_SETTINGS),
                  dimension: 'ROWS',
                  startIndex: actualRowIndex,
                  endIndex: actualRowIndex + 1
                }
              }
            }]
          }
        });
      });
      invalidateCache('basic-data-settings');
      return res.json({ success: true, message: '기본데이터 설정이 삭제되었습니다.' });
    } catch (error) {
      console.error('[기본데이터] 설정 삭제 오류:', error);
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

  // 접근권한 그룹 ID 배열 파싱 (하위 호환성 지원)
  function parseAccessGroupIds(accessGroupIdString) {
    if (!accessGroupIdString) {
      return [];
    }

    try {
      // JSON 배열 형식: ["UG_1", "UG_2"]
      const parsed = JSON.parse(accessGroupIdString);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // 단일 값도 배열로 반환
      return [parsed];
    } catch (error) {
      // JSON 파싱 실패 시 단일 값으로 처리 (하위 호환성)
      return accessGroupIdString ? [accessGroupIdString] : [];
    }
  }

  // 변경이력 저장 함수
  async function saveGroupChangeHistory(sheets, spreadsheetId, historyData) {
    await ensureSheetHeaders(sheets, spreadsheetId, SHEET_GROUP_CHANGE_HISTORY, HEADERS_GROUP_CHANGE_HISTORY);
    
    const changeId = `HIST_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const beforeValueStr = typeof historyData.beforeValue === 'string' 
      ? historyData.beforeValue 
      : JSON.stringify(historyData.beforeValue || '');
    const afterValueStr = typeof historyData.afterValue === 'string' 
      ? historyData.afterValue 
      : JSON.stringify(historyData.afterValue || '');
    
    const historyRow = [
      changeId,           // 변경ID
      historyData.groupId,
      historyData.groupName,
      historyData.changeType,
      historyData.changeAction,
      beforeValueStr,
      afterValueStr,
      new Date().toISOString(),
      historyData.changedBy,
      historyData.changedByName,
      'N',                // 폰클적용여부 (기본값: N, 하위 호환성)
      '',                 // 폰클적용일시
      '',                 // 폰클적용자
      '[]'                // 폰클적용업체명 (JSON 배열, 기본값: 빈 배열)
    ];

    await withRetry(async () => {
      return await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: `${SHEET_GROUP_CHANGE_HISTORY}!A:N`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [historyRow] }
      });
    });
  }

  // GET /api/policy-table/user-groups
  router.get('/policy-table/user-groups', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      // S 권한자도 정책영업그룹 조회 가능하도록 권한 체크 수정
      const userRole = req.headers['x-user-role'] || req.query?.userRole;
      const twoLetterPattern = /^[A-Z]{2}$/;
      const hasPermission = userRole === 'SS' || userRole === 'S' || twoLetterPattern.test(userRole);
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 캐시 확인 (TTL 내)
      const cacheKey = `user-groups-${SPREADSHEET_ID}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 정책영업그룹 목록');
        return res.json(cached);
      }

      // 시트 헤더 보장
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      let response;
      try {
        response = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:F`
          });
        });
      } catch (err) {
        // rate limit 등으로 실패 시 마지막 성공 데이터라도 반환
        const isRateLimitError =
          err?.code === 429 ||
          err?.response?.status === 429 ||
          (err?.message && err.message.toLowerCase().includes('quota exceeded')) ||
          (err?.message && err.message.toLowerCase().includes('ratelimit')) ||
          (err?.response?.data?.error?.status === 'RESOURCE_EXHAUSTED');

        if (isRateLimitError && lastUserGroupsCache) {
          console.warn('⚠️ [정책영업그룹] rate limit 발생, 마지막 캐시 데이터 반환');
          setCache(cacheKey, lastUserGroupsCache, CACHE_TTL.USER_GROUPS);
          return res.json(lastUserGroupsCache);
        }
        throw err;
      }

      const rows = response.data.values || [];
      if (rows.length < 2) {
        const emptyResult = [];
        setCache(cacheKey, emptyResult, CACHE_TTL.USER_GROUPS);
        return res.json(emptyResult);
      }

      const dataRows = rows.slice(1);

      const groups = dataRows.map(row => {
        const groupData = parseUserGroupData(row[2]);
        const groupName = row[1] || '';
        return {
          id: row[0] || '',
          name: groupName,  // name 필드 추가 (하위 호환성)
          groupName: groupName,
          companyNames: groupData.companyNames,
          managerIds: groupData.managerIds,
          // 하위 호환성을 위해 userIds도 반환 (기존 코드 호환)
          userIds: groupData.managerIds, // managerIds를 userIds로도 반환
          registeredAt: row[3] || '',
          registeredBy: row[4] || '',
          phoneRegistered: row[5] === 'Y' || row[5] === 'y' || false  // 폰클등록여부
        };
      });

      // 캐시에 저장 (확장된 TTL)
      setCache(cacheKey, groups, CACHE_TTL.USER_GROUPS);
      lastUserGroupsCache = groups; // rate limit 발생 시 사용할 마지막 성공 데이터
      console.log('💾 [캐시 저장] 정책영업그룹 목록');

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
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
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
        registeredBy,
        'N'  // 폰클등록여부 (기본값: N)
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:F`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        });
      });

      // 변경이력 저장: 그룹 추가
      await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
        groupId: newId,
        groupName: groupName,
        changeType: '그룹이름',
        changeAction: '추가',
        beforeValue: '',
        afterValue: groupName,
        changedBy: permission.userId || 'Unknown',
        changedByName: permission.userName || 'Unknown'
      });

      // 변경이력 저장: 업체명 추가
      if (uniqueCompanyNames.length > 0) {
        await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
          groupId: newId,
          groupName: groupName,
          changeType: '업체명',
          changeAction: '추가',
          beforeValue: [],
          afterValue: uniqueCompanyNames,
          changedBy: permission.userId || 'Unknown',
          changedByName: permission.userName || 'Unknown'
        });
      }

      // 캐시 무효화: 정책영업그룹 추가 시 관련 캐시 모두 무효화
      invalidateRelatedCaches('user-group');

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
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
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
          range: `${SHEET_USER_GROUPS}!A:F`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '그룹을 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const existingData = parseUserGroupData(existingRow[2]);
      const existingGroupName = existingRow[1];
      const existingPhoneRegistered = existingRow[5] || 'N';

      // 새로운 데이터가 제공되면 사용, 없으면 기존 데이터 유지
      let finalCompanyNames = companyNames !== undefined ? companyNames : existingData.companyNames;
      let finalManagerIds = managerIds !== undefined ? managerIds : existingData.managerIds;
      const finalGroupName = groupName !== undefined ? groupName : existingGroupName;

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
        finalGroupName,
        JSON.stringify(groupData),
        existingRow[3],
        existingRow[4],
        existingPhoneRegistered  // 폰클등록여부 유지
      ];

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A${rowIndex + 1}:F${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 변경이력 저장: 그룹이름 변경
      if (groupName !== undefined && groupName !== existingGroupName) {
        await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
          groupId: id,
          groupName: finalGroupName,
          changeType: '그룹이름',
          changeAction: '수정',
          beforeValue: existingGroupName,
          afterValue: groupName,
          changedBy: permission.userId || 'Unknown',
          changedByName: permission.userName || 'Unknown'
        });
      }

      // 변경이력 저장: 업체명 변경
      if (companyNames !== undefined) {
        const existingCompanyNames = existingData.companyNames || [];
        const newCompanyNames = uniqueCompanyNames;

        // 추가된 업체명
        const added = newCompanyNames.filter(c => !existingCompanyNames.includes(c));
        // 삭제된 업체명
        const removed = existingCompanyNames.filter(c => !newCompanyNames.includes(c));

        // 추가된 업체명 이력 저장
        if (added.length > 0) {
          await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
            groupId: id,
            groupName: finalGroupName,
            changeType: '업체명',
            changeAction: '추가',
            beforeValue: existingCompanyNames,
            afterValue: newCompanyNames,
            changedBy: permission.userId || 'Unknown',
            changedByName: permission.userName || 'Unknown'
          });
        }

        // 삭제된 업체명 이력 저장 (각각 개별로 저장)
        if (removed.length > 0) {
          for (const removedCompany of removed) {
            await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
              groupId: id,
              groupName: finalGroupName,
              changeType: '업체명',
              changeAction: '삭제',
              beforeValue: existingCompanyNames,
              afterValue: newCompanyNames,
              changedBy: permission.userId || 'Unknown',
              changedByName: permission.userName || 'Unknown'
            });
          }
        }
      }

      // 캐시 무효화: 정책영업그룹 수정 시 관련 캐시 모두 무효화
      invalidateRelatedCaches('user-group');

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
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
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

      const deletedRow = rows[rowIndex];
      const deletedGroupName = deletedRow[1] || '';
      const deletedData = parseUserGroupData(deletedRow[2]);
      const deletedCompanyNames = deletedData.companyNames || [];

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

      // 변경이력 저장: 그룹 삭제
      await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
        groupId: id,
        groupName: deletedGroupName,
        changeType: '그룹이름',
        changeAction: '삭제',
        beforeValue: deletedGroupName,
        afterValue: '',
        changedBy: permission.userId || 'Unknown',
        changedByName: permission.userName || 'Unknown'
      });

      // 변경이력 저장: 업체명 삭제 (그룹 삭제 시 모든 업체명도 삭제된 것으로 기록)
      if (deletedCompanyNames.length > 0) {
        for (const deletedCompany of deletedCompanyNames) {
          await saveGroupChangeHistory(sheets, SPREADSHEET_ID, {
            groupId: id,
            groupName: deletedGroupName,
            changeType: '업체명',
            changeAction: '삭제',
            beforeValue: deletedCompanyNames,
            afterValue: [],
            changedBy: permission.userId || 'Unknown',
            changedByName: permission.userName || 'Unknown'
          });
        }
      }

      // 캐시 무효화: 정책영업그룹 삭제 시 관련 캐시 모두 무효화
      invalidateRelatedCaches('user-group');

      return res.json({
        success: true,
        message: '정책영업그룹이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 그룹 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-table/user-groups/:id/change-history
  router.get('/policy-table/user-groups/:id/change-history', async (req, res) => {
    setCORSHeaders(req, res);
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    try {
      // S 권한자도 변경이력 조회 가능하도록 권한 체크
      const userRole = req.headers['x-user-role'] || req.query?.userRole;
      const twoLetterPattern = /^[A-Z]{2}$/;
      const hasPermission = userRole === 'SS' || userRole === 'S' || twoLetterPattern.test(userRole);
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_GROUP_CHANGE_HISTORY, HEADERS_GROUP_CHANGE_HISTORY);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_GROUP_CHANGE_HISTORY}!A:N`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      
      // 해당 그룹ID의 변경이력만 필터링
      const history = dataRows
        .filter(row => row[1] === id) // 그룹ID로 필터링
        .map(row => {
          // 변경전값과 변경후값 파싱 (JSON 배열일 수 있음)
          let beforeValue = row[5] || '';
          let afterValue = row[6] || '';
          
          try {
            const beforeParsed = JSON.parse(beforeValue);
            beforeValue = Array.isArray(beforeParsed) ? beforeParsed : beforeValue;
          } catch (e) {
            // JSON이 아니면 문자열 그대로 사용
          }
          
          try {
            const afterParsed = JSON.parse(afterValue);
            afterValue = Array.isArray(afterParsed) ? afterParsed : afterValue;
          } catch (e) {
            // JSON이 아니면 문자열 그대로 사용
          }

          // 폰클적용업체명 파싱 (JSON 배열)
          let phoneAppliedCompanies = [];
          try {
            const phoneAppliedCompaniesStr = row[13] || '[]';
            const parsed = JSON.parse(phoneAppliedCompaniesStr);
            phoneAppliedCompanies = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            // JSON 파싱 실패 시 빈 배열
            phoneAppliedCompanies = [];
          }

          return {
            changeId: row[0] || '',
            groupId: row[1] || '',
            groupName: row[2] || '',
            changeType: row[3] || '',      // 그룹이름/업체명
            changeAction: row[4] || '',   // 추가/수정/삭제
            beforeValue: beforeValue,
            afterValue: afterValue,
            changedAt: row[7] || '',
            changedBy: row[8] || '',
            changedByName: row[9] || '',
            phoneApplied: row[10] || 'N',  // 폰클적용여부 (하위 호환성)
            phoneAppliedAt: row[11] || '',  // 폰클적용일시
            phoneAppliedBy: row[12] || '',  // 폰클적용자
            phoneAppliedCompanies: phoneAppliedCompanies  // 폰클적용업체명 배열
          };
        })
        .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)); // 최신순 정렬

      return res.json(history);
    } catch (error) {
      console.error('[정책표] 변경이력 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table/user-groups/:id/change-history/:changeId/apply-phone
  router.put('/policy-table/user-groups/:id/change-history/:changeId/apply-phone', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      // S 권한자도 폰클 적용 가능하도록 권한 체크
      const userRole = req.headers['x-user-role'] || req.query?.userRole;
      const twoLetterPattern = /^[A-Z]{2}$/;
      const hasPermission = userRole === 'SS' || userRole === 'S' || twoLetterPattern.test(userRole);
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id: groupId } = req.params;
      const { changeId } = req.params;
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER', 'S']);
      
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_GROUP_CHANGE_HISTORY, HEADERS_GROUP_CHANGE_HISTORY);

      // 변경이력 조회
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_GROUP_CHANGE_HISTORY}!A:N`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.status(404).json({ success: false, error: '변경이력을 찾을 수 없습니다.' });
      }

      const dataRows = rows.slice(1);
      const rowIndex = dataRows.findIndex(row => row[0] === changeId && row[1] === groupId);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '변경이력을 찾을 수 없습니다.' });
      }

      const existingRow = dataRows[rowIndex];
      const updatedRow = [...existingRow];
      
      // 배열 길이를 최소 14로 보장
      while (updatedRow.length < 14) {
        updatedRow.push('');
      }
      
      // 변경이력 데이터 파싱
      let afterValue = [];
      try {
        const afterValueStr = existingRow[6] || '[]';
        const parsed = JSON.parse(afterValueStr);
        afterValue = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      } catch (e) {
        afterValue = existingRow[6] ? [existingRow[6]] : [];
      }
      
      // 기존 폰클적용업체명 파싱
      let phoneAppliedCompanies = [];
      try {
        const phoneAppliedCompaniesStr = existingRow[13] || '[]';
        const parsed = JSON.parse(phoneAppliedCompaniesStr);
        phoneAppliedCompanies = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        phoneAppliedCompanies = [];
      }
      
      // 요청에서 특정 업체명이 있는지 확인 (프론트엔드에서 전달)
      const { companyName } = req.body; // 선택적: 특정 업체명
      
      // 업체명별 개별 적용
      if (existingRow[3] === '업체명' && companyName) {
        // 특정 업체명에만 폰클 적용
        if (!phoneAppliedCompanies.includes(companyName)) {
          phoneAppliedCompanies.push(companyName);
        }
        // 폰클적용업체명 업데이트
        updatedRow[13] = JSON.stringify(phoneAppliedCompanies);
        // 폰클적용여부는 적용된 업체명이 있으면 Y
        updatedRow[10] = phoneAppliedCompanies.length > 0 ? 'Y' : 'N';
      } else {
        // 그룹이름이거나 업체명이 지정되지 않은 경우: 전체 적용 (기존 로직)
        updatedRow[10] = 'Y'; // 폰클적용여부
        // 모든 업체명을 적용 목록에 추가
        if (existingRow[3] === '업체명' && Array.isArray(afterValue)) {
          phoneAppliedCompanies = [...new Set([...phoneAppliedCompanies, ...afterValue])];
          updatedRow[13] = JSON.stringify(phoneAppliedCompanies);
        }
      }
      
      updatedRow[11] = new Date().toISOString(); // 폰클적용일시
      updatedRow[12] = permission.userName || permission.userId || 'Unknown'; // 폰클적용자

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_GROUP_CHANGE_HISTORY}!A${rowIndex + 2}:N${rowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 캐시 무효화: 변경이력 업데이트 시 관련 캐시 무효화
      invalidateRelatedCaches('change-history');
      invalidateRelatedCaches('user-group'); // 정책영업그룹 목록에도 영향

      return res.json({
        success: true,
        message: '폰클 적용이 완료되었습니다.',
        phoneAppliedAt: updatedRow[11],
        phoneAppliedBy: updatedRow[12]
      });
    } catch (error) {
      console.error('[정책표] 폰클 적용 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table/user-groups/:id/phone-register
  router.put('/policy-table/user-groups/:id/phone-register', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      // S 권한자도 폰클 등록 가능하도록 권한 체크
      const userRole = req.headers['x-user-role'] || req.query?.userRole;
      const twoLetterPattern = /^[A-Z]{2}$/;
      const hasPermission = userRole === 'SS' || userRole === 'S' || twoLetterPattern.test(userRole);
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { phoneRegistered } = req.body; // true/false

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A:F`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '그룹을 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const updatedRow = [...existingRow];
      
      // 배열 길이를 최소 6으로 보장
      while (updatedRow.length < 6) {
        updatedRow.push('');
      }
      
      // 폰클 등록 여부 업데이트
      updatedRow[5] = phoneRegistered ? 'Y' : 'N';

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_USER_GROUPS}!A${rowIndex + 1}:F${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 캐시 무효화: 폰클 등록 여부 변경 시 정책영업그룹 목록 캐시 무효화
      invalidateRelatedCaches('user-group');

      return res.json({
        success: true,
        message: '폰클 등록 여부가 업데이트되었습니다.',
        phoneRegistered: phoneRegistered
      });
    } catch (error) {
      console.error('[정책표] 폰클 등록 여부 업데이트 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-table/companies
  router.get('/policy-table/companies', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      // S 권한자도 업체명 목록 조회 가능하도록 권한 체크 수정
      const userRole = req.headers['x-user-role'] || req.query?.userRole;
      const twoLetterPattern = /^[A-Z]{2}$/;
      const hasPermission = userRole === 'SS' || userRole === 'S' || twoLetterPattern.test(userRole);
      
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      
      // 캐시 확인 (30분 TTL)
      const cacheKey = `companies-${SPREADSHEET_ID}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 업체명 목록');
        return res.json(cached);
      }

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
      
      // 캐시에 저장 (30분 TTL)
      const result = {
        success: true,
        companies: companies
      };
      setCache(cacheKey, result, CACHE_TTL.COMPANIES);
      
      console.log('✅ [정책표] 업체명 목록 로드:', {
        totalCompanies: companies.length,
        companies: companies.map(c => ({
          companyName: c.companyName,
          managerCount: c.managerIds.length
        }))
      });

      return res.json(result);
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
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { policyTableId, applyDate, applyContent, accessGroupId, accessGroupIds } = req.body;

      if (!policyTableId || !applyDate || !applyContent) {
        return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다.' });
      }

      // 디버깅: 요청 받은 데이터 로그
      console.log(`[정책표 생성 API] 요청 받음:`);
      console.log(`  - policyTableId: ${policyTableId}`);
      console.log(`  - applyDate: ${applyDate}`);
      console.log(`  - applyContent: ${applyContent}`);
      console.log(`  - accessGroupIds: ${JSON.stringify(accessGroupIds || accessGroupId)}`);

      // accessGroupIds 배열 처리 (하위 호환성을 위해 accessGroupId도 지원)
      const groupIds = accessGroupIds || (accessGroupId ? [accessGroupId] : []);

      // 사용자가 이미 활성 작업이 있는지 확인
      const userId = permission.userId || '';
      if (hasUserActiveJob(userId)) {
        return res.status(409).json({ 
          success: false, 
          error: '이미 진행 중인 정책표 생성 작업이 있습니다. 완료될 때까지 기다려주세요.' 
        });
      }

      // 정책표 이름 가져오기 (큐 표시용)
      let policyTableName = '정책표';
      try {
        const { sheets, SPREADSHEET_ID } = createSheetsClient();
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);
        const settingsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_TABLE_SETTINGS}!A:B`
          });
        });
        
        // 응답이 없거나 data가 없는 경우 처리
        if (!settingsResponse || !settingsResponse.data) {
          console.warn('정책표 이름 조회 실패: 응답이 없습니다.');
        } else {
          const settingsRows = settingsResponse.data.values || [];
          const settingsRow = settingsRows.find(row => row[0] === policyTableId);
          if (settingsRow && settingsRow[1]) {
            policyTableName = settingsRow[1];
          }
        }
      } catch (error) {
        console.warn('정책표 이름 조회 실패:', error.message);
        // 에러가 발생해도 기본값 '정책표'를 사용하여 계속 진행
      }

      // 작업 ID 생성
      const jobId = `JOB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 작업 파라미터 저장
      const jobParams = {
        policyTableId,
        applyDate,
        applyContent,
        accessGroupIds: groupIds,
        creatorName: permission.userName || 'Unknown',
        creatorRole: permission.userRole,
        creatorId: userId
      };

      // 큐에 작업 추가
      const queueItem = addToQueue(jobId, userId, permission.userName || 'Unknown', policyTableName);
      
      // 중복 요청인 경우
      if (queueItem.isDuplicate) {
        return res.status(409).json({ 
          success: false, 
          error: '이미 진행 중인 정책표 생성 작업이 있습니다.',
          existingJobId: queueItem.jobId
        });
      }

      const queuePosition = queueItem.queuePosition;
      const queueStatus = getQueueStatus();

      // 초기 상태 설정 (파라미터 포함)
      updateJobStatus(jobId, {
        status: 'queued',
        progress: 0,
        message: `대기 중... (${queueStatus.queuedUserCount}명의 사용자가 ${queueStatus.queueLength}건 대기 중)`,
        queuePosition: queuePosition,
        queueLength: queueStatus.queueLength,
        queuedUserCount: queueStatus.queuedUserCount,
        params: jobParams // 큐 처리 시 사용할 파라미터 저장
      });

      // 큐 처리 시작 (비동기)
      processQueue().catch(error => {
        console.error('[정책표] 큐 처리 오류:', error);
      });

      // 큐 상태 반환
      return res.json({
        success: true,
        jobId: jobId,
        status: 'queued',
        message: `대기 중... (${queueStatus.queuedUserCount}명의 사용자가 ${queueStatus.queueLength}건 대기 중)`,
        queuePosition: queuePosition,
        queueLength: queueStatus.queueLength,
        queuedUserCount: queueStatus.queuedUserCount
      });
    } catch (error) {
      console.error('[정책표] 생성 요청 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/policy-table/queue-status
  // 큐 상태 조회 API
  router.get('/policy-table/queue-status', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const queueStatus = getQueueStatus();
      return res.json({
        success: true,
        ...queueStatus
      });
    } catch (error) {
      console.error('[정책표] 큐 상태 조회 오류:', error);
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

      // 큐 정보 추가
      const queueStatus = getQueueStatus();
      const queueItem = generationQueue.queue.find(item => item.jobId === jobId);
      const processingItem = generationQueue.processing.find(item => item.jobId === jobId);
      
      const response = {
        ...status,
        queueInfo: {
          queuePosition: queueItem ? queueItem.queuePosition : (processingItem ? 0 : null),
          queueLength: queueStatus.queueLength,
          queuedUserCount: queueStatus.queuedUserCount,
          processingLength: queueStatus.processingLength,
          isProcessing: !!processingItem
        }
      };

      // 대기 중인 경우 메시지 업데이트
      if (status.status === 'queued' && queueItem) {
        response.message = `대기 중... (${queueStatus.queuedUserCount}명의 사용자가 ${queueStatus.queueLength}건 대기 중)`;
      }

      return res.json(response);
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
      
      // 캐시 확인 (30초 TTL)
      const cacheKey = `policy-tables-tabs-${SPREADSHEET_ID}-${mode || 'all'}-${userId || 'all'}-${userRole || 'all'}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 탭 목록');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_SETTINGS, HEADERS_POLICY_TABLE_SETTINGS);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_TAB_ORDER, HEADERS_TAB_ORDER);

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
        
        // 정책영업그룹 목록과 일반모드권한관리 시트를 병렬로 조회 (캐시 우선)
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        const generalModeCacheKey = `general-mode-permission-${SPREADSHEET_ID}`;
        const cachedUserGroups = getCache(userGroupsCacheKey);
        const cachedGeneralMode = getCache(generalModeCacheKey);
        
        // 병렬로 필요한 데이터 조회 (캐시에 없을 때만 API 호출)
        const [userGroupsData, generalModeData, policyListData] = await Promise.all([
          // 정책영업그룹 목록 조회
          (async () => {
            if (cachedUserGroups) {
              return cachedUserGroups;
            }
            await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
            const userGroupsResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_USER_GROUPS}!A:E`
              });
            });
            const userGroupsRows = userGroupsResponse.data.values || [];
            const userGroupsDataRows = userGroupsRows.slice(1);
            const groups = userGroupsDataRows.map(row => {
              const groupId = row[0] || '';
              const groupName = row[1] || '';
              const groupData = parseUserGroupData(row[2]);
              return { 
                id: groupId, 
                name: groupName,  // name 필드 추가 (하위 호환성)
                groupName: groupName,  // groupName 필드도 유지
                ...groupData 
              };
            });
            setCache(userGroupsCacheKey, groups, CACHE_TTL.USER_GROUPS);
            return groups;
          })(),
          // 일반모드권한관리 시트 조회
          (async () => {
            if (cachedGeneralMode) {
              return cachedGeneralMode;
            }
            const generalModeSheetName = '일반모드권한관리';
            const generalModeResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${generalModeSheetName}!A:K`
              });
            });
            const generalModeRows = generalModeResponse.data.values || [];
            setCache(generalModeCacheKey, generalModeRows, CACHE_TTL.GENERAL_MODE_PERMISSION);
            return generalModeRows;
          })(),
          // 정책표목록 조회 (접근권한 확인용 - 캐시 활용)
          (async () => {
            const policyListCacheKey = `policy-tables-list-for-tabs-${SPREADSHEET_ID}`;
            const cachedPolicyList = getCache(policyListCacheKey);
            if (cachedPolicyList) {
              return cachedPolicyList;
            }
            const policyListResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_POLICY_TABLE_LIST}!A:M`
              });
            });
            const policyRows = policyListResponse.data.values || [];
            setCache(policyListCacheKey, policyRows, CACHE_TTL.POLICY_TABLES);
            return policyRows;
          })()
        ]);

        // 데이터 처리
        const userGroupsMap = new Map();
        if (Array.isArray(userGroupsData)) {
          userGroupsData.forEach(group => {
            if (group.id) {
              userGroupsMap.set(group.id, {
                companyNames: group.companyNames || [],
                managerIds: group.managerIds || []
              });
            }
          });
        }

        const generalModeRows = Array.isArray(generalModeData) ? generalModeData : [];
        const policyRows = Array.isArray(policyListData) ? policyListData : [];
        const policyDataRows = policyRows.length > 1 ? policyRows.slice(1) : [];
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
          const accessGroupIds = parseAccessGroupIds(row[5]); // 접근권한 (그룹ID 배열)
          for (const accessGroupId of accessGroupIds) {
            if (accessGroupId) {
              const groupData = userGroupsMap.get(accessGroupId);
              if (groupData) {
                // companyNames에 현재 사용자의 업체명이 포함되어 있는지 확인
                const companyNames = groupData.companyNames || [];
                if (companyNames.includes(userCompanyName)) {
                  accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
                  break; // 하나라도 매칭되면 추가하고 다음 정책표로
                }
              }
            }
          }
        });

        // 접근 가능한 탭만 필터링
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      } else if (['SS', 'S'].includes(userRole)) {
        // SS(총괄), S(정산) 레벨은 모든 탭 표시
      } else if (userRole && /^[A-Z]{2}$/.test(userRole)) {
        // 팀장 레벨(두 글자 대문자 패턴)은 본인이 생성한 정책표 + 담당자인 그룹의 정책표 탭 표시
        const currentUserId = req.headers['x-user-id'] || userId;
        
        // 정책표목록과 정책영업그룹 목록을 병렬로 조회 (캐시 우선)
        const policyListCacheKey = `policy-tables-list-for-tabs-${SPREADSHEET_ID}`;
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        const cachedPolicyList = getCache(policyListCacheKey);
        const cachedUserGroups = getCache(userGroupsCacheKey);
        
        const [policyListData, userGroupsData] = await Promise.all([
          // 정책표목록 조회
          (async () => {
            if (cachedPolicyList) {
              return cachedPolicyList;
            }
            const policyListResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_POLICY_TABLE_LIST}!A:O`
              });
            });
            const policyRows = policyListResponse.data.values || [];
            setCache(policyListCacheKey, policyRows, CACHE_TTL.POLICY_TABLES);
            return policyRows;
          })(),
          // 정책영업그룹 목록 조회
          (async () => {
            if (cachedUserGroups && Array.isArray(cachedUserGroups)) {
              return cachedUserGroups;
            }
            await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
            const userGroupsResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_USER_GROUPS}!A:E`
              });
            });
            const userGroupsRows = userGroupsResponse.data.values || [];
            const userGroupsDataRows = userGroupsRows.slice(1);
            const groups = userGroupsDataRows.map(row => {
              const groupId = row[0] || '';
              const groupName = row[1] || '';
              const groupData = parseUserGroupData(row[2]);
              return { 
                id: groupId, 
                name: groupName,  // name 필드 추가 (하위 호환성)
                groupName: groupName,  // groupName 필드도 유지
                ...groupData 
              };
            });
            setCache(userGroupsCacheKey, groups, CACHE_TTL.USER_GROUPS);
            return groups;
          })()
        ]);
        
        const policyRows = Array.isArray(policyListData) ? policyListData : [];
        const policyDataRows = policyRows.length > 1 ? policyRows.slice(1) : [];
        
        const userGroupsMap = new Map();
        if (Array.isArray(userGroupsData)) {
          userGroupsData.forEach(group => {
            if (group.id) {
              // name 또는 groupName 필드 모두 지원
              const groupName = group.name || group.groupName;
              userGroupsMap.set(group.id, {
                name: groupName,
                companyNames: group.companyNames || [],
                managerIds: group.managerIds || []
              });
            }
          });
        }
        
        const accessiblePolicyTableIds = new Set();
        policyDataRows.forEach(row => {
          const creatorId = row[13] || ''; // 생성자ID
          const accessGroupIds = parseAccessGroupIds(row[5]); // 접근권한 (그룹ID 배열)
          
          // 1. 본인이 생성한 정책표인지 확인
          if (creatorId === currentUserId) {
            accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
          }
          
          // 2. 본인이 담당자인 그룹의 정책표인지 확인
          for (const accessGroupId of accessGroupIds) {
            if (accessGroupId) {
              const groupData = userGroupsMap.get(accessGroupId);
              if (groupData) {
                const managerIds = groupData.managerIds || [];
                if (managerIds.includes(currentUserId)) {
                  accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
                  break; // 하나라도 매칭되면 추가하고 다음 정책표로
                }
              }
            }
          }
        });
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      } else {
        // 그 외 사용자(A-F)는 그룹의 담당자(managerIds)에 포함된 경우만 해당 그룹의 탭 표시
        // 정책표목록에서 접근권한 확인
        const policyListResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_TABLE_LIST}!A:O`
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
          const accessGroupIds = parseAccessGroupIds(row[5]); // 접근권한 (그룹ID 배열)
          for (const accessGroupId of accessGroupIds) {
            if (accessGroupId) {
              const groupData = userGroupsMap.get(accessGroupId);
              if (groupData) {
                const managerIds = groupData.managerIds || [];
                if (managerIds.includes(currentUserId)) {
                  accessiblePolicyTableIds.add(row[1]); // 정책표ID_설정
                  break; // 하나라도 매칭되면 추가하고 다음 정책표로
                }
              }
            }
          }
        });

        // 접근 가능한 탭만 필터링
        tabs = tabs.filter(tab => accessiblePolicyTableIds.has(tab.policyTableId));
      }

      // 사용자별 탭 순서 적용
      const currentUserId = req.headers['x-user-id'] || userId;
      if (currentUserId) {
        try {
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_TAB_ORDER, HEADERS_TAB_ORDER);
          const orderResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_TAB_ORDER}!A:D`
            });
          });
          
          const orderRows = orderResponse.data.values || [];
          if (orderRows.length > 1) {
            const orderDataRows = orderRows.slice(1);
            const userOrderRow = orderDataRows.find(row => row[0] === currentUserId);
            
            if (userOrderRow && userOrderRow[1]) {
              try {
                const orderArray = JSON.parse(userOrderRow[1]);
                if (Array.isArray(orderArray) && orderArray.length > 0) {
                  // 순서 배열을 기준으로 탭 정렬
                  const orderMap = new Map();
                  orderArray.forEach((policyTableId, index) => {
                    orderMap.set(policyTableId, index);
                  });
                  
                  // 순서 배열에 있는 탭과 없는 탭 분리
                  const orderedTabs = [];
                  const unorderedTabs = [];
                  
                  tabs.forEach(tab => {
                    if (orderMap.has(tab.policyTableId)) {
                      orderedTabs.push({ tab, order: orderMap.get(tab.policyTableId) });
                    } else {
                      unorderedTabs.push(tab);
                    }
                  });
                  
                  // 순서대로 정렬
                  orderedTabs.sort((a, b) => a.order - b.order);
                  
                  // 순서가 있는 탭 먼저, 그 다음 순서가 없는 탭
                  tabs = [...orderedTabs.map(item => item.tab), ...unorderedTabs];
                }
              } catch (parseError) {
                console.warn('[정책표] 탭 순서 JSON 파싱 오류:', parseError);
              }
            }
          }
        } catch (orderError) {
          console.warn('[정책표] 탭 순서 조회 오류:', orderError);
          // 순서 조회 실패 시 기본 순서 사용
        }
      }

      // 캐시에 저장 (캐시 미스인 경우에만)
      if (!cached) {
        setCache(cacheKey, tabs, CACHE_TTL.POLICY_TABLE_TABS);
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
      
      // 캐시 키 생성 (사용자별, 모드별, 정책표이름별로 구분)
      const cacheKey = `policy-tables-${SPREADSHEET_ID}-all-${policyTableName}-${mode || 'all'}-${currentUserId || 'all'}-${userRole || 'all'}`;
      
      // 캐시 확인 (30초 TTL)
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 정책표 목록');
        return res.json(cached);
      }
      
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json([]);
      }

      const dataRows = rows.slice(1);
      
      // 정책영업그룹 목록 조회 (정액영업그룹 이름 표시용 - 정책모드에서만)
      // 캐시에서 가져오기 또는 병렬 조회
      let userGroupsNameMap = new Map();
      let userGroupsMap = new Map(); // 일반정책모드에서도 사용
      
      if (!isGeneralPolicyMode) {
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        const cachedUserGroups = getCache(userGroupsCacheKey);
        
        if (cachedUserGroups && Array.isArray(cachedUserGroups)) {
          // 캐시에서 가져온 데이터를 Map으로 변환
          // 캐시 데이터 구조: { id, groupName, companyNames, managerIds, ... }
          cachedUserGroups.forEach(group => {
            // groupName 또는 name 필드 모두 지원 (하위 호환성)
            const groupName = group.groupName || group.name;
            if (group.id && groupName) {
              userGroupsNameMap.set(group.id, groupName);
            }
          });
        } else {
          // 캐시에 없으면 직접 조회
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });
          
          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          userGroupsDataRows.forEach(row => {
            const groupId = row[0] || '';
            const groupName = row[1] || '';
            if (groupId && groupName) {
              userGroupsNameMap.set(groupId, groupName);
            }
          });
        }
      }
      
      let policies = dataRows
        .filter(row => {
          // 정책표이름 필터
          if (row[2] !== policyTableName) return false;
          // 등록여부 필터 (등록된 것만)
          if (row[11] !== 'Y') return false;
          return true;
        })
        .map(row => {
          const accessGroupId = row[5] || '';
          const accessGroupIds = parseAccessGroupIds(accessGroupId);
          
          // 정액영업그룹 이름 배열 생성 (정책모드에서만)
          const accessGroupNames = !isGeneralPolicyMode && accessGroupIds.length > 0
            ? accessGroupIds
                .map(groupId => userGroupsNameMap.get(groupId))
                .filter(name => name) // undefined 제거
            : [];
          
          // 확인이력 파싱
          let viewHistory = [];
          try {
            const viewHistoryStr = row[14] || '[]';
            viewHistory = JSON.parse(viewHistoryStr);
            if (!Array.isArray(viewHistory)) {
              viewHistory = [];
            }
          } catch (e) {
            console.warn('[정책표] 확인이력 파싱 오류:', e);
            viewHistory = [];
          }
          
          return {
            id: row[0] || '',
            policyTableId: row[1] || '',
            policyTableName: row[2] || '',
            applyDate: row[3] || '',
            applyContent: row[4] || '',
            accessGroupId: accessGroupId,
            accessGroupNames: accessGroupNames, // 정액영업그룹 이름 배열 추가
            creator: row[6] || '',
            creatorId: row[13] || '', // 생성자ID (새로 추가)
            createdAt: row[7] || '',
            messageId: row[8] || '',
            threadId: row[9] || '',
            imageUrl: row[10] || '',
            registeredAt: row[12] || '',
            viewHistory: viewHistory // 확인이력 추가
          };
        });

      // 권한 필터링
      if (isGeneralPolicyMode) {
        // 일반정책모드 필터링: companyNames 기반
        // 정책영업그룹 목록과 일반모드권한관리 시트를 병렬로 조회 (캐시 우선)
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        const generalModeCacheKey = `general-mode-permission-${SPREADSHEET_ID}`;
        const cachedUserGroups = getCache(userGroupsCacheKey);
        const cachedGeneralMode = getCache(generalModeCacheKey);
        
        // 병렬로 필요한 데이터 조회 (캐시에 없을 때만 API 호출)
        const [userGroupsData, generalModeData] = await Promise.all([
          // 정책영업그룹 목록 조회
          (async () => {
            if (cachedUserGroups && Array.isArray(cachedUserGroups)) {
              return cachedUserGroups;
            }
            await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
            const userGroupsResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_USER_GROUPS}!A:E`
              });
            });
            const userGroupsRows = userGroupsResponse.data.values || [];
            const userGroupsDataRows = userGroupsRows.slice(1);
            const groups = userGroupsDataRows.map(row => {
              const groupId = row[0] || '';
              const groupName = row[1] || '';
              const groupData = parseUserGroupData(row[2]);
              return { 
                id: groupId, 
                name: groupName,  // name 필드 추가 (하위 호환성)
                groupName: groupName,  // groupName 필드도 유지
                ...groupData 
              };
            });
            setCache(userGroupsCacheKey, groups, CACHE_TTL.USER_GROUPS);
            return groups;
          })(),
          // 일반모드권한관리 시트 조회
          (async () => {
            if (cachedGeneralMode && Array.isArray(cachedGeneralMode)) {
              return cachedGeneralMode;
            }
            const generalModeSheetName = '일반모드권한관리';
            const generalModeResponse = await withRetry(async () => {
              return await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${generalModeSheetName}!A:K`
              });
            });
            const generalModeRows = generalModeResponse.data.values || [];
            setCache(generalModeCacheKey, generalModeRows, CACHE_TTL.GENERAL_MODE_PERMISSION);
            return generalModeRows;
          })()
        ]);
        
        // 데이터 처리
        const userGroupsMap = new Map();
        if (Array.isArray(userGroupsData)) {
          userGroupsData.forEach(group => {
            if (group.id) {
              // name 또는 groupName 필드 모두 지원
              const groupName = group.name || group.groupName;
              userGroupsMap.set(group.id, {
                name: groupName,
                companyNames: group.companyNames || [],
                managerIds: group.managerIds || []
              });
            }
          });
        }
        
        const generalModeRows = Array.isArray(generalModeData) ? generalModeData : [];
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
          const accessGroupIds = parseAccessGroupIds(policy.accessGroupId);
          if (accessGroupIds.length === 0) {
            console.log('❌ [일반정책모드] 접근권한 없음:', policy.id);
            return false; // 접근권한이 없으면 접근 불가
          }
          
          // 여러 그룹 중 하나라도 매칭되면 접근 가능
          for (const accessGroupId of accessGroupIds) {
            const groupData = userGroupsMap.get(accessGroupId);
            if (groupData) {
              // companyNames에 현재 사용자의 업체명이 포함되어 있는지 확인
              const companyNames = groupData.companyNames || [];
              if (companyNames.includes(userCompanyName)) {
                console.log('✅ [일반정책모드] 정책표 필터링 - 접근 허용:', {
                  policyId: policy.id,
                  accessGroupId,
                  companyNames,
                  userCompanyName
                });
                return true;
              }
            }
          }
          
          console.log('❌ [일반정책모드] 정책표 필터링 - 접근 거부:', {
            policyId: policy.id,
            accessGroupIds
          });
          return false;
        });
        
        console.log('✅ [일반정책모드] 필터링 완료:', {
          filteredCount: policies.length
        });
      } else if (['SS', 'S'].includes(userRole)) {
        // SS(총괄), S(정산) 레벨은 모든 정책표 표시
      } else if (userRole && /^[A-Z]{2}$/.test(userRole)) {
        // 팀장 레벨(두 글자 대문자 패턴)은 본인이 생성한 정책표 + 담당자인 그룹의 정책표 확인 가능
        const currentUserId = req.headers['x-user-id'] || req.query.userId;
        
        // 정책영업그룹 목록 조회 (담당자 필터링용) - 캐시에서 가져오기
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        const cachedUserGroups = getCache(userGroupsCacheKey);
        
        const userGroupsMap = new Map();
        if (cachedUserGroups && Array.isArray(cachedUserGroups)) {
          // 캐시에서 가져온 데이터를 Map으로 변환
          cachedUserGroups.forEach(group => {
            if (group.id) {
              userGroupsMap.set(group.id, {
                name: group.name,
                companyNames: group.companyNames || [],
                managerIds: group.managerIds || []
              });
            }
          });
        } else {
          // 캐시에 없으면 직접 조회
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });

          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          userGroupsDataRows.forEach(row => {
            const groupId = row[0];
            const groupData = parseUserGroupData(row[2]);
            userGroupsMap.set(groupId, groupData);
          });
        }
        
        console.log('🔍 [정책모드] 팀장 필터링 시작:', {
          userRole,
          currentUserId,
          totalPolicies: policies.length,
          userGroupsMapSize: userGroupsMap.size
        });
        
        policies = policies.filter(policy => {
          // 1. 본인이 생성한 정책표인지 확인
          let isCreator = false;
          if (policy.creatorId) {
            isCreator = policy.creatorId === currentUserId;
          }
          
          // 2. 본인이 담당자인 그룹의 정책표인지 확인
          let isManager = false;
          const accessGroupIds = parseAccessGroupIds(policy.accessGroupId);
          for (const accessGroupId of accessGroupIds) {
            if (accessGroupId) {
              const groupData = userGroupsMap.get(accessGroupId);
              if (groupData) {
                const managerIds = groupData.managerIds || [];
                if (managerIds.includes(currentUserId)) {
                  isManager = true;
                  break; // 하나라도 매칭되면 true
                }
              }
            }
          }
          
          const hasAccess = isCreator || isManager;
          
          console.log(`🔍 [정책모드] 팀장 필터링 체크: ${policy.policyTableName}`, {
            policyId: policy.id,
            creatorId: policy.creatorId,
            currentUserId,
            isCreator,
            isManager,
            accessGroupIds,
            hasAccess
          });
          
          return hasAccess;
        });
        
        console.log('✅ [정책모드] 팀장 필터링 완료:', {
          filteredCount: policies.length,
          filtered: policies.map(p => p.policyTableName)
        });
      } else {
        // 그 외 사용자(A-F)는 그룹의 담당자(managerIds)에 포함된 경우만 해당 그룹의 정책표 표시
        // 정책영업그룹 목록 조회 - 캐시에서 가져오기
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        const cachedUserGroups = getCache(userGroupsCacheKey);
        
        const userGroupsMap = new Map();
        if (cachedUserGroups && Array.isArray(cachedUserGroups)) {
          // 캐시에서 가져온 데이터를 Map으로 변환
          cachedUserGroups.forEach(group => {
            if (group.id) {
              userGroupsMap.set(group.id, {
                name: group.name,
                companyNames: group.companyNames || [],
                managerIds: group.managerIds || []
              });
            }
          });
        } else {
          // 캐시에 없으면 직접 조회
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });

          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          userGroupsDataRows.forEach(row => {
            const groupId = row[0];
            const groupData = parseUserGroupData(row[2]);
            userGroupsMap.set(groupId, groupData);
          });
        }

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
          const accessGroupIds = parseAccessGroupIds(policy.accessGroupId);
          if (accessGroupIds.length === 0) {
            console.log('❌ [정책모드] 접근권한 없음:', policy.id);
            return false; // 접근권한이 없으면 접근 불가
          }
          
          // 여러 그룹 중 하나라도 매칭되면 접근 가능
          for (const accessGroupId of accessGroupIds) {
            const groupData = userGroupsMap.get(accessGroupId);
            if (groupData) {
              // managerIds에 현재 사용자 아이디가 포함되어 있는지 확인
              const managerIds = groupData.managerIds || [];
              if (managerIds.includes(currentUserId)) {
                console.log('✅ [정책모드] 정책표 필터링 - 접근 허용:', {
                  policyId: policy.id,
                  accessGroupId,
                  managerIds,
                  currentUserId
                });
                return true;
              }
            }
          }
          
          console.log('❌ [정책모드] 정책표 필터링 - 접근 거부:', {
            policyId: policy.id,
            accessGroupIds
          });
          return false;
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

      // 캐시에 저장 (30초 TTL)
      setCache(cacheKey, policies, CACHE_TTL.POLICY_TABLES);
      console.log('💾 [캐시 저장] 정책표 목록');

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
      const permission = await checkPermission(req, ['S', 'SS', 'TEAM_LEADER']);
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
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      const updatedRow = [...existingRow];
      // 배열 길이를 최소 14로 보장 (생성자ID 포함, N열까지)
      while (updatedRow.length < 14) {
        updatedRow.push('');
      }
      updatedRow[11] = 'Y'; // 등록여부
      updatedRow[12] = new Date().toISOString(); // 등록일시
      // updatedRow[13]은 이미 creatorId가 있거나 빈 문자열

      // N열까지 포함하여 저장 (HEADERS_POLICY_TABLE_LIST에 생성자ID 추가됨)
      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 2}:N${rowIndex + 2}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 캐시 무효화: 정책표 등록 시 관련 캐시 무효화
      invalidateRelatedCaches('policy-table', id);

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
      
      // 캐시 확인 (30초 TTL)
      const cacheKey = `policy-tables-${SPREADSHEET_ID}-${id}-${mode || 'all'}`;
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 정책표 상세');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
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
        const accessGroupIds = parseAccessGroupIds(row[5]); // 접근권한 (그룹ID 배열)
        
        if (accessGroupIds.length === 0) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }

        // 정책영업그룹 조회 (캐시 활용)
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        let userGroupsDataRows = [];
        const cachedUserGroups = getCache(userGroupsCacheKey);
        
        if (cachedUserGroups) {
          // 캐시에서 가져온 데이터 사용
          userGroupsDataRows = cachedUserGroups.map(group => {
            // 캐시된 데이터를 원본 시트 형식으로 변환 (호환성 유지)
            return [group.id, group.groupName, JSON.stringify({
              companyNames: group.companyNames,
              managerIds: group.managerIds
            })];
          });
        } else {
          // 캐시가 없으면 API 호출
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });
          const userGroupsRows = userGroupsResponse.data.values || [];
          userGroupsDataRows = userGroupsRows.slice(1);
        }
        
        // 현재 사용자의 업체명 확인 (캐시 활용)
        const generalModeSheetName = '일반모드권한관리';
        const generalModeCacheKey = `general-mode-permission-${SPREADSHEET_ID}`;
        let generalModeRows = [];
        const cachedGeneralMode = getCache(generalModeCacheKey);
        
        if (cachedGeneralMode) {
          generalModeRows = cachedGeneralMode;
        } else {
          const generalModeResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${generalModeSheetName}!A:K`
            });
          });
          generalModeRows = generalModeResponse.data.values || [];
          // 캐시에 저장 (30초 TTL)
          setCache(generalModeCacheKey, generalModeRows, CACHE_TTL.GENERAL_MODE_PERMISSION);
        }

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

        // 여러 그룹 중 하나라도 매칭되면 접근 가능
        let hasAccess = false;
        for (const accessGroupId of accessGroupIds) {
          const userGroup = userGroupsDataRows.find(r => r[0] === accessGroupId);
          if (userGroup) {
            const groupData = parseUserGroupData(userGroup[2]);
            const companyNames = groupData.companyNames || [];
            if (companyNames.includes(userCompanyName)) {
              hasAccess = true;
              break;
            }
          }
        }

        if (!hasAccess) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      } else if (['SS', 'S'].includes(userRole)) {
        // SS(총괄), S(정산) 레벨은 모든 정책표 접근 가능
      } else if (userRole && /^[A-Z]{2}$/.test(userRole)) {
        // 팀장 레벨(두 글자 대문자 패턴)은 본인이 생성한 정책표 + 담당자인 그룹의 정책표 접근 가능
        const currentUserId = req.headers['x-user-id'];
        const creatorId = row[13] || ''; // 생성자ID
        const accessGroupIds = parseAccessGroupIds(row[5]); // 접근권한 (그룹ID 배열)
        
        // 1. 본인이 생성한 정책표인지 확인
        const isCreator = creatorId && creatorId === currentUserId;
        
        // 2. 본인이 담당자인 그룹의 정책표인지 확인
        let isManager = false;
        if (accessGroupIds.length > 0) {
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });

          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          
          for (const accessGroupId of accessGroupIds) {
            const userGroup = userGroupsDataRows.find(r => r[0] === accessGroupId);
            if (userGroup) {
              const groupData = parseUserGroupData(userGroup[2]);
              const managerIds = groupData.managerIds || [];
              if (managerIds.includes(currentUserId)) {
                isManager = true;
                break;
              }
            }
          }
        }
        
        // 둘 다 아니면 접근 불가
        if (!isCreator && !isManager) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      } else {
        // 그 외 사용자(A-F)는 그룹의 담당자(managerIds)에 포함된 경우만 접근 가능
        const accessGroupIds = parseAccessGroupIds(row[5]); // 접근권한 (그룹ID 배열)
        if (accessGroupIds.length === 0) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
        
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
        const userGroupsResponse = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_USER_GROUPS}!A:E`
          });
        });

        const userGroupsRows = userGroupsResponse.data.values || [];
        const userGroupsDataRows = userGroupsRows.slice(1);
        const currentUserId = req.headers['x-user-id'];
        
        // 여러 그룹 중 하나라도 매칭되면 접근 가능
        let hasAccess = false;
        for (const accessGroupId of accessGroupIds) {
          const userGroup = userGroupsDataRows.find(r => r[0] === accessGroupId);
          if (userGroup) {
            const groupData = parseUserGroupData(userGroup[2]);
            const managerIds = groupData.managerIds || [];
            if (managerIds.includes(currentUserId)) {
              hasAccess = true;
              break;
            }
          }
        }
        
        if (!hasAccess) {
          return res.status(403).json({ success: false, error: '이 정책표에 접근할 권한이 없습니다.' });
        }
      }

      // 확인이력 파싱
      let viewHistory = [];
      try {
        const viewHistoryStr = row[14] || '[]';
        viewHistory = JSON.parse(viewHistoryStr);
        if (!Array.isArray(viewHistory)) {
          viewHistory = [];
        }
      } catch (e) {
        console.warn('[정책표] 확인이력 파싱 오류:', e);
        viewHistory = [];
      }

      // 정책영업그룹 이름 매핑 (정책모드에서만)
      const accessGroupId = row[5] || '';
      const accessGroupIds = parseAccessGroupIds(accessGroupId);
      let accessGroupNames = [];
      
      if (!isGeneralPolicyMode && accessGroupIds.length > 0) {
        // 정책영업그룹 조회 (캐시 활용)
        const userGroupsCacheKey = `user-groups-${SPREADSHEET_ID}`;
        let userGroupsNameMap = new Map();
        const cachedUserGroups = getCache(userGroupsCacheKey);
        
        if (cachedUserGroups) {
          // 캐시에서 가져온 데이터 사용
          cachedUserGroups.forEach(group => {
            if (group.id && group.name) {
              userGroupsNameMap.set(group.id, group.name);
            }
          });
        } else {
          // 캐시에 없으면 직접 조회
          await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_USER_GROUPS, HEADERS_USER_GROUPS);
          const userGroupsResponse = await withRetry(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_USER_GROUPS}!A:E`
            });
          });
          
          const userGroupsRows = userGroupsResponse.data.values || [];
          const userGroupsDataRows = userGroupsRows.slice(1);
          userGroupsDataRows.forEach(groupRow => {
            const groupId = groupRow[0] || '';
            const groupName = groupRow[1] || '';
            if (groupId && groupName) {
              userGroupsNameMap.set(groupId, groupName);
            }
          });
        }
        
        // 정책영업그룹 이름 배열 생성
        accessGroupNames = accessGroupIds
          .map(groupId => userGroupsNameMap.get(groupId))
          .filter(name => name); // undefined 제거
      }

      const policy = {
        id: row[0] || '',
        policyTableId: row[1] || '',
        policyTableName: row[2] || '',
        applyDate: row[3] || '',
        applyContent: row[4] || '',
        accessGroupId: accessGroupId,
        accessGroupNames: accessGroupNames, // 정책영업그룹 이름 배열 추가
        creator: row[6] || '',
        creatorId: row[13] || '', // 생성자ID
        createdAt: row[7] || '',
        messageId: row[8] || '',
        threadId: row[9] || '',
        imageUrl: row[10] || '',
        registeredAt: row[12] || '',
        viewHistory: viewHistory // 확인이력 추가
      };

      // 캐시에 저장 (30초 TTL)
      setCache(cacheKey, policy, CACHE_TTL.POLICY_TABLE_DETAIL);
      console.log('💾 [캐시 저장] 정책표 상세');

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
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
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
      
      // 배열 길이를 최소 15로 보장 (O열까지, 확인이력 포함)
      while (updatedRow.length < 15) {
        updatedRow.push('');
      }
      
      // updatedRow가 15개 요소(A~O열)를 가지므로 O열까지 포함하여 업데이트
      // rowIndex는 헤더를 포함한 배열 인덱스이므로, 실제 시트 행 번호는 rowIndex + 1
      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 1}:O${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 캐시 무효화: 이미지 갱신 시 정책표 상세 및 목록 캐시 무효화
      invalidateRelatedCaches('policy-table', id);

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

  // GET /api/policy-tables/tabs/order
  router.get('/policy-tables/tabs/order', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_TAB_ORDER, HEADERS_TAB_ORDER);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_TAB_ORDER}!A:E`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.json({ success: true, tabOrder: null, cardOrder: null });
      }

      const dataRows = rows.slice(1);
      const userOrderRow = dataRows.find(row => row[0] === userId);

      if (!userOrderRow) {
        return res.json({ success: true, tabOrder: null, cardOrder: null });
      }

      let tabOrder = null;
      let cardOrder = null;

      try {
        if (userOrderRow[1]) {
          const tabOrderArray = JSON.parse(userOrderRow[1]);
          tabOrder = Array.isArray(tabOrderArray) ? tabOrderArray : null;
        }
      } catch (parseError) {
        console.error('[정책표] 탭 순서 JSON 파싱 오류:', parseError);
      }

      try {
        if (userOrderRow[2]) {
          const cardOrderArray = JSON.parse(userOrderRow[2]);
          cardOrder = Array.isArray(cardOrderArray) ? cardOrderArray : null;
        }
      } catch (parseError) {
        console.error('[정책표] 생성카드 순서 JSON 파싱 오류:', parseError);
      }

      return res.json({
        success: true,
        tabOrder: tabOrder,
        cardOrder: cardOrder,
        updatedAt: userOrderRow[3] || null,
        updatedBy: userOrderRow[4] || null
      });
    } catch (error) {
      console.error('[정책표] 탭 순서 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-tables/tabs/order
  router.put('/policy-tables/tabs/order', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const userId = req.headers['x-user-id'] || req.body.userId;
      const { order, cardOrder } = req.body; // order는 탭 순서, cardOrder는 생성카드 순서
      let updatedBy = req.headers['x-user-name'] || req.body.updatedBy || 'Unknown';
      // URL 인코딩된 경우 디코딩
      try {
        updatedBy = decodeURIComponent(updatedBy);
      } catch (e) {
        // 디코딩 실패 시 원본 값 사용
      }

      if (!userId) {
        return res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
      }

      if (order !== undefined && (!Array.isArray(order))) {
        return res.status(400).json({ success: false, error: '탭 순서는 배열이어야 합니다.' });
      }

      if (cardOrder !== undefined && (!Array.isArray(cardOrder))) {
        return res.status(400).json({ success: false, error: '생성카드 순서는 배열이어야 합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_TAB_ORDER, HEADERS_TAB_ORDER);

      // 기존 데이터 조회
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_TAB_ORDER}!A:E`
        });
      });

      const rows = response.data.values || [];
      const dataRows = rows.length > 1 ? rows.slice(1) : [];
      const userOrderRowIndex = dataRows.findIndex(row => row[0] === userId);

      const now = new Date().toLocaleString('ko-KR');
      const existingRow = userOrderRowIndex !== -1 ? dataRows[userOrderRowIndex] : [];
      
      // 기존 값 유지하면서 업데이트
      const tabOrderJson = order !== undefined ? JSON.stringify(order) : (existingRow[1] || '');
      const cardOrderJson = cardOrder !== undefined ? JSON.stringify(cardOrder) : (existingRow[2] || '');
      
      const newRow = [userId, tabOrderJson, cardOrderJson, now, updatedBy];

      if (userOrderRowIndex !== -1) {
        // 기존 행 업데이트
        await withRetry(async () => {
          return await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TAB_ORDER}!A${userOrderRowIndex + 2}:E${userOrderRowIndex + 2}`,
            valueInputOption: 'RAW',
            resource: { values: [newRow] }
          });
        });
      } else {
        // 새 행 추가
        await withRetry(async () => {
          return await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TAB_ORDER}!A:E`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [newRow] }
          });
        });
      }

      return res.json({
        success: true,
        message: '순서가 저장되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 순서 저장 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-tables/:id - 정책표 수정
  router.put('/policy-tables/:id', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { applyDate, applyContent, accessGroupIds } = req.body;

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
        });
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: '정책표를 찾을 수 없습니다.' });
      }

      const existingRow = rows[rowIndex];
      
      // 수정할 필드만 업데이트 (기존 값 유지)
      const updatedRow = [...existingRow];
      if (applyDate !== undefined) {
        updatedRow[3] = applyDate; // 정책적용일시
      }
      if (applyContent !== undefined) {
        updatedRow[4] = applyContent; // 정책적용내용
      }
      if (accessGroupIds !== undefined) {
        // accessGroupIds 배열을 JSON 문자열로 변환
        const accessGroupIdsJson = Array.isArray(accessGroupIds) && accessGroupIds.length > 0
          ? JSON.stringify(accessGroupIds)
          : '';
        updatedRow[5] = accessGroupIdsJson; // 접근권한
      }

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 1}:O${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        });
      });

      // 캐시 무효화: 정책표 수정 시 관련 캐시 무효화
      invalidateRelatedCaches('policy-table', id);

      return res.json({
        success: true,
        message: '정책표가 수정되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 수정 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/policy-tables/:id
  router.delete('/policy-tables/:id', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
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

      // 캐시 무효화: 정책표 삭제 시 관련 캐시 무효화
      invalidateRelatedCaches('policy-table', id);

      return res.json({
        success: true,
        message: '정책표가 삭제되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 삭제 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 기본 정책영업그룹 설정 관련 API ==========

  // GET /api/policy-table/default-groups/:userId - 사용자의 기본 그룹 설정 조회
  router.get('/policy-table/default-groups/:userId', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { userId } = req.params;
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const cacheKey = `default-groups-${SPREADSHEET_ID}-${userId}`;

      // 캐시 확인
      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 기본 그룹 설정', userId);
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_DEFAULT_GROUPS, HEADERS_DEFAULT_GROUPS);

      let response;
      try {
        response = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_DEFAULT_GROUPS}!A:E`
          });
        });
      } catch (err) {
        const isRateLimitError =
          err?.code === 429 ||
          err?.response?.status === 429 ||
          (err?.message && err.message.toLowerCase().includes('quota exceeded')) ||
          (err?.message && err.message.toLowerCase().includes('ratelimit')) ||
          (err?.response?.data?.error?.status === 'RESOURCE_EXHAUSTED');

        if (isRateLimitError && lastDefaultGroupsCache.has(userId)) {
          console.warn('⚠️ [기본그룹] rate limit 발생, 마지막 캐시 데이터 반환', userId);
          const fallback = lastDefaultGroupsCache.get(userId);
          setCache(cacheKey, fallback, CACHE_TTL.USER_GROUPS);
          return res.json(fallback);
        }
        throw err;
      }

      const rows = response.data.values || [];
      const dataRows = rows.length > 1 ? rows.slice(1) : [];
      
      // 해당 사용자의 설정만 필터링
      const userSettings = dataRows
        .filter(row => row[0] === userId)
        .map(row => ({
          policyTableId: row[1] || '',
          defaultGroupIds: row[2] ? (row[2].startsWith('[') ? JSON.parse(row[2]) : [row[2]]) : []
        }));

      // 정책표ID별로 매핑
      const defaultGroups = {};
      userSettings.forEach(setting => {
        if (setting.policyTableId) {
          defaultGroups[setting.policyTableId] = setting.defaultGroupIds;
        }
      });

      const result = {
        success: true,
        defaultGroups: defaultGroups
      };

      setCache(cacheKey, result, CACHE_TTL.USER_GROUPS);
      lastDefaultGroupsCache.set(userId, result);
      return res.json(result);
    } catch (error) {
      console.error('[정책표] 기본 그룹 설정 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // PUT /api/policy-table/default-groups/:userId - 사용자의 기본 그룹 설정 저장
  router.put('/policy-table/default-groups/:userId', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      console.log('[정책표] 기본 그룹 설정 저장 요청:', {
        userId: req.params.userId,
        body: req.body,
        userRole: req.headers['x-user-role'],
        userIdHeader: req.headers['x-user-id']
      });

      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
      if (!permission.hasPermission) {
        console.log('[정책표] 기본 그룹 설정 저장 권한 없음:', {
          userRole: req.headers['x-user-role'],
          requiredRoles: ['SS', 'TEAM_LEADER']
        });
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { userId } = req.params;
      const { policyTableId, defaultGroupIds } = req.body;

      if (!policyTableId) {
        return res.status(400).json({ success: false, error: '정책표ID가 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_DEFAULT_GROUPS, HEADERS_DEFAULT_GROUPS);

      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_DEFAULT_GROUPS}!A:E`
        });
      });

      const rows = response.data.values || [];
      const dataRows = rows.length > 1 ? rows.slice(1) : [];
      
      // 해당 사용자와 정책표ID에 해당하는 행 찾기
      const rowIndex = dataRows.findIndex(row => row[0] === userId && row[1] === policyTableId);

      const now = new Date().toLocaleString('ko-KR');
      const updatedBy = permission.userName || 'Unknown';
      const defaultGroupIdsJson = Array.isArray(defaultGroupIds) && defaultGroupIds.length > 0
        ? JSON.stringify(defaultGroupIds)
        : '';

      if (rowIndex !== -1) {
        // 기존 행 업데이트
        await withRetry(async () => {
          return await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_DEFAULT_GROUPS}!A${rowIndex + 2}:E${rowIndex + 2}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[userId, policyTableId, defaultGroupIdsJson, now, updatedBy]]
            }
          });
        });
      } else {
        // 새 행 추가
        await withRetry(async () => {
          return await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_DEFAULT_GROUPS}!A:E`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[userId, policyTableId, defaultGroupIdsJson, now, updatedBy]]
            }
          });
        });
      }

      // 캐시 무효화
      invalidateCache(`default-groups-${SPREADSHEET_ID}-${userId}`);
      lastDefaultGroupsCache.delete(userId);

      return res.json({
        success: true,
        message: '기본 그룹 설정이 저장되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 기본 그룹 설정 저장 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== 기타정책 목록 관리 API ==========

  // GET /api/policy-table/other-policy-types - 기타정책 목록 조회
  router.get('/policy-table/other-policy-types', async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      const cacheKey = `other-policy-types-${SPREADSHEET_ID}`;

      const cached = getCache(cacheKey);
      if (cached) {
        console.log('✅ [캐시 히트] 기타정책 목록');
        return res.json(cached);
      }

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_OTHER_POLICY_TYPES, HEADERS_OTHER_POLICY_TYPES);

      let response;
      try {
        response = await withRetry(async () => {
          return await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_OTHER_POLICY_TYPES}!A:C`
          });
        });
      } catch (err) {
        const isRateLimitError =
          err?.code === 429 ||
          err?.response?.status === 429 ||
          (err?.message && err.message.toLowerCase().includes('quota exceeded')) ||
          (err?.message && err.message.toLowerCase().includes('ratelimit')) ||
          (err?.response?.data?.error?.status === 'RESOURCE_EXHAUSTED');

        if (isRateLimitError && lastOtherPolicyTypesCache) {
          console.warn('⚠️ [기타정책] rate limit 발생, 마지막 캐시 데이터 반환');
          setCache(cacheKey, lastOtherPolicyTypesCache, CACHE_TTL.USER_GROUPS);
          return res.json(lastOtherPolicyTypesCache);
        }
        throw err;
      }

      const rows = response.data.values || [];
      const dataRows = rows.length > 1 ? rows.slice(1) : [];
      
      const otherPolicyTypes = dataRows
        .filter(row => row[0]) // 정책명이 있는 것만
        .map(row => ({
          name: row[0] || '',
          registeredAt: row[1] || '',
          registeredBy: row[2] || ''
        }));

      const result = {
        success: true,
        otherPolicyTypes: otherPolicyTypes
      };

      setCache(cacheKey, result, CACHE_TTL.USER_GROUPS);
      lastOtherPolicyTypesCache = result;
      return res.json(result);
    } catch (error) {
      console.error('[정책표] 기타정책 목록 조회 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/policy-table/other-policy-types - 기타정책 추가
  router.post('/policy-table/other-policy-types', express.json(), async (req, res) => {
    setCORSHeaders(req, res);
    try {
      const permission = await checkPermission(req, ['SS', 'TEAM_LEADER']);
      if (!permission.hasPermission) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { policyName } = req.body;

      if (!policyName || !policyName.trim()) {
        return res.status(400).json({ success: false, error: '정책명이 필요합니다.' });
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_OTHER_POLICY_TYPES, HEADERS_OTHER_POLICY_TYPES);

      const now = new Date().toLocaleString('ko-KR');
      const registeredBy = permission.userName || 'Unknown';

      await withRetry(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_OTHER_POLICY_TYPES}!A:C`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[policyName.trim(), now, registeredBy]]
          }
        });
      });

      // 캐시 무효화
      invalidateCache(`other-policy-types-${SPREADSHEET_ID}`);
      lastOtherPolicyTypesCache = null;

      return res.json({
        success: true,
        message: '기타정책이 추가되었습니다.'
      });
    } catch (error) {
      console.error('[정책표] 기타정책 추가 오류:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // OPTIONS 요청은 전역 핸들러(app.options('*'))에서 처리되므로
  // 라우터 레벨 OPTIONS 핸들러는 제거 (전역 핸들러가 먼저 실행됨)
  // 만약 라우터 핸들러가 필요하다면, 전역 핸들러가 실행되지 않을 때를 대비해 남겨둠
  // 하지만 현재는 전역 핸들러가 모든 OPTIONS 요청을 처리하므로 주석 처리
  /*
  router.options('/policy-tables/:id/view', (req, res) => {
    console.log('🔍 [라우터 OPTIONS] /api/policy-tables/:id/view 요청 수신:', {
      method: req.method,
      url: req.url,
      path: req.path,
      origin: req.headers.origin,
      'access-control-request-method': req.headers['access-control-request-method'],
      'access-control-request-headers': req.headers['access-control-request-headers'],
      'x-mode': req.headers['x-mode'],
      allHeaders: req.headers
    });
    
    setCORSHeaders(req, res);
    
    console.log('✅ [라우터 OPTIONS] CORS 헤더 설정 완료:', {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    });
    
    res.status(200).end();
  });
  */

  // POST /api/policy-tables/:id/view - 정책표 확인이력 기록
  router.post('/policy-tables/:id/view', express.json(), async (req, res) => {
    console.log('🔍 [POST] /api/policy-tables/:id/view 요청 수신:', {
      method: req.method,
      url: req.url,
      path: req.path,
      params: req.params,
      origin: req.headers.origin,
      'x-user-id': req.headers['x-user-id'],
      'x-user-role': req.headers['x-user-role'],
      'x-user-name': req.headers['x-user-name'],
      'x-mode': req.headers['x-mode'],
      body: req.body,
      allHeaders: Object.keys(req.headers).reduce((acc, key) => {
        if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'origin') {
          acc[key] = req.headers[key];
        }
        return acc;
      }, {})
    });
    
    setCORSHeaders(req, res);
    
    try {
      const { id } = req.params;
      const { companyId, companyName } = req.body;
      const userId = req.headers['x-user-id'] || req.query.userId;
      const userName = req.headers['x-user-name'] ? decodeURIComponent(req.headers['x-user-name']) : (req.query.userName || '');
      const userRole = req.headers['x-user-role'] || req.query.userRole;
      const mode = req.headers['x-mode'] || req.query.mode; // 일반정책모드/정책모드 구분
      
      console.log('🔍 [POST] 파싱된 값:', {
        id,
        companyId,
        companyName,
        userId,
        userName,
        userRole,
        mode
      });

      if (!companyId || !companyName) {
        return res.status(400).json({
          success: false,
          error: '업체 ID와 업체명은 필수입니다.'
        });
      }

      // 정책모드인 경우 대리점아이디관리에서 이름과 직함 정보 가져오기
      let displayName = companyName;
      let qualification = '';
      
      // 정책모드 사용자인 경우 (일반정책모드가 아닌 경우) 대리점아이디관리에서 정보 조회
      // 일반정책모드는 업체명만 사용, 정책모드는 이름+직함 사용
      if (mode !== 'generalPolicy' && userRole) { // 일반정책모드가 아닌 경우
        try {
          const { sheets, SPREADSHEET_ID } = createSheetsClient();
          const agentResponse = await getAgentManagementData(sheets, SPREADSHEET_ID);

          const agentRows = agentResponse.data.values || [];
          if (agentRows.length >= 2) {
            const agentRow = agentRows.find(row => row[2] === companyId); // C열(2번 인덱스): 연락처(아이디)
            if (agentRow) {
              const name = agentRow[0] || ''; // A열: 대상(이름)
              qualification = agentRow[1] || ''; // B열: 자격(직함)
              if (name && qualification) {
                displayName = `${name} (${qualification})`;
              } else if (name) {
                displayName = name;
              }
            }
          }
        } catch (agentError) {
          console.warn('[정책표] 대리점아이디관리 조회 실패, 기본값 사용:', agentError);
          // 조회 실패 시 기본값 사용
        }
      }

      const { sheets, SPREADSHEET_ID } = createSheetsClient();
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_TABLE_LIST, HEADERS_POLICY_TABLE_LIST);

      // 기존 데이터 읽기
      const response = await withRetry(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A:O`
        });
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return res.status(404).json({
          success: false,
          error: '정책표를 찾을 수 없습니다.'
        });
      }

      const dataRows = rows.slice(1);
      const rowIndex = dataRows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({
          success: false,
          error: '정책표를 찾을 수 없습니다.'
        });
      }

      const existingRow = dataRows[rowIndex];
      const updatedRow = [...existingRow];

      // 배열 길이를 최소 15로 보장 (O열까지)
      while (updatedRow.length < 15) {
        updatedRow.push('');
      }

      // 기존 확인 이력 파싱
      let viewHistory = [];
      try {
        const viewHistoryStr = updatedRow[14] || '[]';
        viewHistory = JSON.parse(viewHistoryStr);
        if (!Array.isArray(viewHistory)) {
          viewHistory = [];
        }
      } catch (error) {
        console.warn('[정책표] 확인이력 파싱 오류, 빈 배열로 초기화:', error);
        viewHistory = [];
      }

      // 같은 업체의 기존 확인 이력 찾기
      const existingView = viewHistory.find(v => v.companyId === companyId);
      // 한국 시간(KST, UTC+9)으로 변환
      const now = new Date().toLocaleString('sv-SE', {
        timeZone: 'Asia/Seoul'
      }).replace('T', ' ');

      if (existingView) {
        // 기존 확인 이력이 있으면 조회일시만 업데이트
        existingView.viewDate = now;
      } else {
        // 새로운 확인 이력 추가
        viewHistory.push({
          companyId: companyId,
          companyName: displayName, // 이름과 직함이 포함된 표시명
          viewDate: now,
          firstViewDate: now
        });
      }

      // 확인 이력 업데이트
      updatedRow[14] = JSON.stringify(viewHistory);

      await withRetry(async () => {
        return await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_POLICY_TABLE_LIST}!A${rowIndex + 2}:O${rowIndex + 2}`,
          valueInputOption: 'RAW',
          resource: { values: [updatedRow] }
        });
      });

      console.log(`✅ [정책표] 확인이력 기록 완료: 업체 ${companyName}`);
      
      // 캐시 무효화: 확인이력 업데이트 시 정책표 상세 캐시 무효화
      invalidateRelatedCaches('policy-table', id);

      return res.json({ success: true, message: '확인 이력이 기록되었습니다.' });

    } catch (error) {
      console.error('❌ [정책표] 확인이력 기록 실패:', error);
      return res.status(500).json({
        success: false,
        error: '확인 이력 기록에 실패했습니다.',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = setupPolicyTableRoutes;

