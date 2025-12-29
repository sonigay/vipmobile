require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { initBrowser, captureSheetAsImage, closeBrowser } = require('./screenshot');

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
    const waitTime = parseInt(options.waitTime) || 3000;
    const viewportWidth = parseInt(options.viewportWidth) || 1920;
    const viewportHeight = parseInt(options.viewportHeight) || 1080;
    
    console.log(`📋 [로컬PC봇] 파싱된 정보:`);
    console.log(`   URL: ${sheetUrl.substring(0, 50)}...`);
    console.log(`   정책표: ${policyTableName}`);
    console.log(`   사용자: ${userName}`);
    console.log(`   대기시간: ${waitTime}ms`);
    
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
      console.log(`🖼️ [로컬PC봇] Puppeteer로 스크린샷 생성 시작...`);
      
      const imageBuffer = await captureSheetAsImage(sheetUrl, {
        waitTime: waitTime,
        viewportWidth: viewportWidth,
        viewportHeight: viewportHeight
      });
      
      console.log(`✅ [로컬PC봇] 스크린샷 생성 완료 (크기: ${imageBuffer.length} bytes)`);
      
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
      
      // ===== 5단계: 클라우드 서버에 완료 신호 전송 =====
      // 클라우드 서버 봇이 이 신호를 감지하고 이미지 URL을 추출
      const commandMessageId = message.id; // 원본 명령어 메시지 ID
      const completeSignal = `!screenshot-complete commandId=${commandMessageId} imageId=${imageMessage.id}`;
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

// 봇 로그인
client.login(DISCORD_BOT_TOKEN).catch(error => {
  console.error('❌ 디스코드 봇 로그인 실패:', error);
  process.exit(1);
});

