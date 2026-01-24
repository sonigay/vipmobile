/**
 * Discord Routes
 * Discord 관련 API 엔드포인트
 */

module.exports = function createDiscordRoutes(context) {
  const express = require('express');
  const router = express.Router();
  
  const { discordBot } = context;

  // Discord 이미지 URL 갱신 API
  router.get('/discord/refresh-image-url', async (req, res) => {
    try {
      const { threadId, messageId } = req.query;
      
      if (!threadId || !messageId) {
        return res.status(400).json({ error: 'threadId와 messageId가 필요합니다.' });
      }

      if (!discordBot.bot || !discordBot.LOGGING_ENABLED) {
        return res.status(503).json({ error: 'Discord 봇이 비활성화되어 있습니다.' });
      }

      // Discord에서 메시지 가져오기
      const channel = await discordBot.bot.channels.fetch(threadId);
      if (!channel) {
        return res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
      }

      const message = await channel.messages.fetch(messageId);
      if (!message) {
        return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
      }

      // 첨부 파일에서 이미지 URL 추출
      const imageUrl = message.attachments.first()?.url || null;
      
      if (!imageUrl) {
        return res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
      }

      res.json({ 
        success: true, 
        imageUrl,
        threadId,
        messageId
      });
    } catch (error) {
      console.error('Discord 이미지 URL 갱신 실패:', error);
      res.status(500).json({ error: 'Discord 이미지 URL 갱신 실패' });
    }
  });

  return router;
};
