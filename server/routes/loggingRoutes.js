/**
 * Logging Routes
 * 
 * 클라이언트 로그 수집 및 사용자 활동 로깅 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - POST /api/client-logs - 클라이언트 로그 수집
 * - POST /api/log-activity - 사용자 활동 로깅
 * 
 * Requirements: 1.1, 1.2, 7.3
 */

const express = require('express');
const router = express.Router();

/**
 * Logging Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.discordBot - Discord 봇
 * @returns {express.Router} Express 라우터
 */
function createLoggingRoutes(context) {
  const { discordBot } = context;
  const { EmbedBuilder, sendNotification: sendDiscordNotification, CHANNEL_ID: DISCORD_CHANNEL_ID, LOGGING_ENABLED: DISCORD_LOGGING_ENABLED } = discordBot;

  // POST /api/client-logs - 클라이언트 원격 로그 수집
  router.post('/api/client-logs', (req, res) => {
    try {
      const { sessionId, userAgent, ts, logs } = req.body || {};

      if (Array.isArray(logs) && logs.length > 0) {
        console.log('🛰️ [CLIENT LOGS]', {
          sessionId,
          userAgent,
          ts,
          count: logs.length
        });

        // 상세 로그는 너무 많을 수 있으니 일부만 미리보기
        const preview = logs.slice(0, 5);
        preview.forEach((l, i) => {
          console.log(`📝 [${i + 1}/${logs.length}] ${l.lv} ${new Date(l.ts).toISOString()} ${l.path} :: ${l.msg}`);
        });
      }

      res.status(200).json({ success: true });
    } catch (e) {
      console.error('❌ [CLIENT LOGS] 수집 오류:', e?.message || e);
      res.status(200).json({ success: true }); // 로깅 실패는 무시
    }
  });

  // POST /api/log-activity - 사용자 활동 로깅
  router.post('/api/log-activity', async (req, res) => {
    // 즉시 응답 반환
    res.json({ success: true });

    // 로깅 처리를 비동기로 실행
    setImmediate(async () => {
      try {
        const {
          userId,
          userType,
          targetName,
          ipAddress,
          location,
          deviceInfo,
          activity,
          model,
          colorName,
          callButton
        } = req.body;

        // 활동 유형에 따른 제목 설정
        let title = '사용자 활동';
        let embedColor = 3447003; // 파란색

        if (activity === 'login') {
          title = '사용자 로그인';
          embedColor = 5763719; // 초록색
        } else if (activity === 'search') {
          title = '모델 검색';
          embedColor = 16776960; // 노란색
        } else if (activity === 'call_button') {
          title = '전화 연결 버튼 클릭';
          embedColor = 15548997; // 빨간색
        } else if (activity === 'kakao_button') {
          title = '카톡문구 생성';
          embedColor = 16776960; // 노란색 (카카오톡 색상)
        }

        // Discord로 로그 전송 시도
        if (DISCORD_LOGGING_ENABLED && EmbedBuilder) {
          try {
            // Embed 생성
            const embed = new EmbedBuilder()
              .setTitle(title)
              .setColor(embedColor)
              .setTimestamp()
              .addFields(
                {
                  name: '사용자 정보',
                  value: `ID: ${userId}\n종류: ${userType === 'agent' ? '관리자' : '일반'}\n대상: ${targetName || '없음'}`
                },
                {
                  name: '접속 정보',
                  value: `IP: ${ipAddress}\n위치: ${location || '알 수 없음'}\n기기: ${deviceInfo || '알 수 없음'}`
                }
              )
              .setFooter({
                text: userType === 'agent'
                  ? '(주)브이아이피플러스 관리자 활동 로그'
                  : '(주)브이아이피플러스 매장 활동 로그'
              });

            // 검색 정보가 있는 경우 필드 추가
            if (model) {
              embed.addFields({
                name: '검색 정보',
                value: `모델: ${model}${colorName ? `\n색상: ${colorName}` : ''}`
              });
            }

            // 전화 버튼 정보가 있는 경우 필드 추가
            if (callButton) {
              embed.addFields({
                name: '전화 연결 정보',
                value: `대상: ${callButton.storeName || '알 수 없음'}\n전화번호: ${callButton.phoneNumber || '없음'}`
              });
            }

            // Discord 알림 전송
            await sendDiscordNotification(DISCORD_CHANNEL_ID, embed);

            console.log('✅ [활동 로그] Discord 전송 성공:', {
              userId,
              activity,
              userType
            });
          } catch (discordError) {
            console.error('❌ [활동 로그] Discord 전송 실패:', discordError.message);
          }
        } else {
          // Discord 로깅이 비활성화된 경우 콘솔에만 기록
          console.log('📊 [활동 로그]', {
            userId,
            userType,
            activity,
            targetName,
            model,
            colorName,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('❌ [활동 로그] 처리 오류:', error.message);
      }
    });
  });

  return router;
}

module.exports = createLoggingRoutes;
