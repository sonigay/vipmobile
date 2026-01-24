/**
 * Assignment Routes
 * 
 * 재고 배정 관리 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/assignment/history - 배정 히스토리 조회
 * - POST /api/assignment/complete - 배정 완료 처리
 * 
 * Requirements: 1.1, 1.2, 7.8
 */

const express = require('express');
const router = express.Router();

/**
 * Assignment Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createAssignmentRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // Google Sheets 클라이언트가 없으면 에러 응답 반환하는 헬퍼 함수
  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({
        success: false,
        error: 'Google Sheets client not available. Please check environment variables.'
      });
      return false;
    }
    return true;
  };

  // GET /api/assignment/history - 배정 히스토리 조회
  router.get('/api/assignment/history', async (req, res) => {
    try {
      // 배정 히스토리 데이터 (임시로 하드코딩된 데이터 반환)
      const assignments = [
        {
          id: 1,
          assigner: '경수',
          model: 'iPhone 15 Pro',
          color: '블랙',
          quantity: 50,
          target_office: '경인사무소',
          target_department: '영업1팀',
          target_agent: '김영업',
          assigned_at: new Date('2024-01-15T10:30:00'),
          status: 'completed'
        },
        {
          id: 2,
          assigner: '홍기현',
          model: 'Galaxy S24',
          color: '화이트',
          quantity: 30,
          target_office: '호남사무소',
          target_department: '영업2팀',
          target_agent: '이영업',
          assigned_at: new Date('2024-01-15T09:15:00'),
          status: 'completed'
        }
      ];

      res.json({ success: true, assignments });
    } catch (error) {
      console.error('배정 히스토리 조회 오류:', error);
      res.status(500).json({ success: false, error: '배정 히스토리 조회 실패' });
    }
  });

  // POST /api/assignment/complete - 배정 완료 처리
  router.post('/api/assignment/complete', async (req, res) => {
    try {
      const {
        assigner,
        model,
        color,
        quantity,
        target_office,
        target_department,
        target_agent,
        target_offices,
        target_departments,
        target_agents
      } = req.body;

      // 실제 배정된 수량 계산 (quantity가 0이 아닌 경우에만)
      const actualQuantity = parseInt(quantity) || 0;

      // 배정 정보 저장 (실제로는 데이터베이스에 저장)
      const assignment = {
        id: Date.now(),
        assigner,
        model,
        color,
        quantity: actualQuantity,
        target_office,
        target_department,
        target_agent,
        assigned_at: new Date(),
        status: 'completed'
      };

      console.log('새로운 배정 완료:', assignment);
      console.log('배정 대상자:', { target_offices, target_departments, target_agents });

      // 배정 대상자에게만 알림 전송 (실제 배정된 수량이 있는 경우에만)
      if (actualQuantity > 0) {
        const notification = {
          type: 'assignment_completed',
          title: '새로운 배정 완료',
          message: `${assigner}님이 ${model} (${color}) ${actualQuantity}대를 배정했습니다.`,
          data: assignment,
          timestamp: new Date()
        };

        console.log('알림 전송 시작:', {
          notification,
          targetOffices: target_offices,
          targetDepartments: target_departments,
          targetAgents: target_agents
        });

        // TODO: 실제 알림 전송 로직 구현 필요
        // await sendNotificationToTargetAgents(notification, target_offices, target_departments, target_agents);
      } else {
        console.log('배정된 수량이 0이므로 알림을 전송하지 않습니다.');
      }

      res.json({ success: true, assignment });
    } catch (error) {
      console.error('배정 완료 처리 오류:', error);
      res.status(500).json({ success: false, error: '배정 완료 처리 실패' });
    }
  });

  return router;
}

module.exports = createAssignmentRoutes;
