/**
 * Discord Bot Module
 * 
 * Discord 봇을 초기화하고 알림 전송 기능을 제공합니다.
 * DISCORD_LOGGING_ENABLED 환경 변수가 'true'이고 DISCORD_BOT_TOKEN이 있을 때만 초기화됩니다.
 * 
 * @module utils/discordBot
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_LOGGING_ENABLED = process.env.DISCORD_LOGGING_ENABLED === 'true';

let discordBot = null;
let EmbedBuilderClass = null;

// 조건부 초기화: DISCORD_LOGGING_ENABLED가 'true'이고 DISCORD_BOT_TOKEN이 있을 때만 초기화
if (DISCORD_LOGGING_ENABLED && DISCORD_BOT_TOKEN) {
  try {
    discordBot = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    EmbedBuilderClass = EmbedBuilder;

    discordBot.once('ready', () => {
      console.log('🤖 Discord 봇이 준비되었습니다:', discordBot.user.tag);
    });

    discordBot.login(DISCORD_BOT_TOKEN);
  } catch (error) {
    // 초기화 실패 시 에러를 throw하지 않고 콘솔에 로그만 기록
    console.error('디스코드 봇 초기화 실패:', error.message);
  }
}

/**
 * Discord 채널에 알림을 전송합니다.
 * 
 * @param {string} channelId - Discord 채널 ID
 * @param {EmbedBuilder} embed - 전송할 Embed 객체
 * @returns {Promise<void>}
 */
async function sendDiscordNotification(channelId, embed) {
  // Discord 로깅이 비활성화되어 있거나 봇이 준비되지 않았으면 아무것도 하지 않음
  if (!DISCORD_LOGGING_ENABLED || !discordBot || !discordBot.isReady()) {
    return;
  }

  try {
    const channel = await discordBot.channels.fetch(channelId);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    // 전송 실패 시 콘솔에 로그만 기록하고 계속 실행
    console.error('Discord 알림 전송 실패:', error);
  }
}

module.exports = {
  discordBot,
  EmbedBuilder: EmbedBuilderClass,
  sendDiscordNotification,
  DISCORD_CHANNEL_ID,
  DISCORD_LOGGING_ENABLED
};
