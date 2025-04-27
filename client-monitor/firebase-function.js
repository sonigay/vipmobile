// Firebase Cloud Function 예시 코드
// 이 코드는 Firebase Functions에 배포되어 동작합니다.

const functions = require('firebase-functions');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

// 환경 변수 설정 (Firebase Functions 콘솔에서 설정)
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const API_KEY = process.env.API_KEY; // 보안을 위한 API 키

// Discord 봇 초기화
let discordBot = null;
let botInitialized = false;

async function initializeBot() {
  if (botInitialized) return;
  
  try {
    discordBot = new Client({ 
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    await discordBot.login(DISCORD_BOT_TOKEN);
    console.log('Discord 봇 로그인 성공');
    botInitialized = true;
  } catch (error) {
    console.error('Discord 봇 초기화 실패:', error);
    throw new Error('Discord 봇 초기화 실패');
  }
}

// Discord 알림 전송
async function sendDiscordAlert(status, details) {
  await initializeBot();
  
  try {
    const channel = await discordBot.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel) {
      console.error(`채널을 찾을 수 없습니다: ${DISCORD_CHANNEL_ID}`);
      throw new Error('채널을 찾을 수 없습니다');
    }
    
    const isDown = status === 'down';
    
    const embed = new EmbedBuilder()
      .setTitle(isDown ? '🚨 서버 다운 알림' : '✅ 서버 복구 알림')
      .setColor(isDown ? 15548997 : 5763719) // 빨간색 또는 초록색
      .setDescription(isDown 
        ? '@everyone\n클라이언트에서 서버 다운을 감지했습니다. 서비스 이용이 불가능할 수 있습니다.'
        : '@everyone\n클라이언트에서 서버 복구를 감지했습니다. 서비스를 이용할 수 있습니다.')
      .setTimestamp()
      .addFields({
        name: '알림 시간',
        value: new Date().toLocaleString()
      });
    
    // 추가 정보가 있으면 필드 추가
    if (details) {
      embed.addFields({
        name: '상세 정보',
        value: JSON.stringify(details, null, 2)
      });
    }
    
    embed.setFooter({ text: 'VIP+ 클라이언트 모니터링' });
    
    await channel.send({ content: '@everyone', embeds: [embed] });
    console.log(`Discord 알림 전송 성공: 서버 ${isDown ? '다운' : '복구'}`);
    return true;
  } catch (error) {
    console.error('Discord 알림 전송 실패:', error);
    throw new Error('Discord 알림 전송 실패');
  }
}

// Firebase Function - 서버 상태 보고 엔드포인트
exports.reportServerStatus = functions.https.onRequest(async (req, res) => {
  try {
    // CORS 헤더 설정
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      // CORS preflight 요청 처리
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }
    
    // POST 요청만 허용
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    // API 키 확인
    const apiKey = req.headers.authorization || '';
    if (apiKey !== `Bearer ${API_KEY}`) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    
    const { status, details } = req.body;
    
    if (!status || (status !== 'up' && status !== 'down')) {
      res.status(400).json({ error: 'Invalid status. Must be "up" or "down"' });
      return;
    }
    
    await sendDiscordAlert(status, details);
    
    res.status(200).json({ success: true, message: 'Alert sent successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}); 