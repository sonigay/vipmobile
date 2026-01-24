/**
 * Error Handler Utility
 * 
 * 공통 에러 처리 함수를 제공합니다.
 * - 일관된 에러 로깅
 * - Discord 알림 통합 (500+ 에러만)
 * - 표준화된 에러 응답 형식
 * 
 * @module utils/errorHandler
 */

const { sendDiscordNotification, EmbedBuilder, DISCORD_CHANNEL_ID, DISCORD_LOGGING_ENABLED } = require('./discordBot');

/**
 * 에러를 처리하고 클라이언트에 응답을 전송합니다.
 * 
 * @param {Error} error - 발생한 에러 객체
 * @param {import('express').Request} req - Express 요청 객체
 * @param {import('express').Response} res - Express 응답 객체
 * @param {Object} [context={}] - 추가 컨텍스트 정보 (로깅용)
 * @returns {void}
 * 
 * @example
 * try {
 *   // Some operation
 * } catch (error) {
 *   handleError(error, req, res, { operation: 'fetchData' });
 * }
 */
function handleError(error, req, res, context = {}) {
  // 에러 로깅
  const errorLog = {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    timestamp: new Date().toISOString(),
    ...context
  };

  console.error('❌ Error:', errorLog);

  // 상태 코드 결정
  const statusCode = error.statusCode || 500;

  // Discord 알림 (500 이상 에러만)
  if (statusCode >= 500 && DISCORD_LOGGING_ENABLED && EmbedBuilder) {
    sendDiscordErrorNotification(error, req, context);
  }

  // 클라이언트 응답
  const errorResponse = {
    success: false,
    error: error.message || 'Internal server error'
  };

  // 개발 환경에서만 stack trace 포함
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Discord 채널에 에러 알림을 전송합니다.
 * 
 * @param {Error} error - 발생한 에러 객체
 * @param {import('express').Request} req - Express 요청 객체
 * @param {Object} context - 추가 컨텍스트 정보
 * @returns {Promise<void>}
 * @private
 */
async function sendDiscordErrorNotification(error, req, context) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000) // 빨간색
      .setTitle('🚨 서버 에러 발생')
      .setDescription(`**${error.message}**`)
      .addFields(
        { name: '경로', value: req.path, inline: true },
        { name: '메서드', value: req.method, inline: true },
        { name: '상태 코드', value: String(error.statusCode || 500), inline: true },
        { name: '시간', value: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), inline: false }
      )
      .setTimestamp();

    // 추가 컨텍스트 정보가 있으면 필드에 추가
    if (Object.keys(context).length > 0) {
      const contextStr = JSON.stringify(context, null, 2);
      if (contextStr.length <= 1024) {
        embed.addFields({ name: '컨텍스트', value: `\`\`\`json\n${contextStr}\n\`\`\``, inline: false });
      }
    }

    // Stack trace 추가 (처음 3줄만)
    if (error.stack) {
      const stackPreview = error.stack.split('\n').slice(0, 3).join('\n');
      if (stackPreview.length <= 1024) {
        embed.addFields({ name: 'Stack Trace', value: `\`\`\`\n${stackPreview}\n\`\`\``, inline: false });
      }
    }

    await sendDiscordNotification(DISCORD_CHANNEL_ID, embed);
  } catch (discordError) {
    // Discord 알림 실패는 서버 동작에 영향을 주지 않음
    console.error('Discord 에러 알림 전송 실패:', discordError.message);
  }
}

module.exports = {
  handleError
};
