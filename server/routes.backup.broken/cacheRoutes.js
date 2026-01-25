/**
 * Cache Routes
 * 
 * 캐시 관리 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - POST /api/cache-refresh - 캐시 강제 새로고침
 * 
 * Requirements: 1.1, 1.2, 7.4
 */

const express = require('express');
const router = express.Router();

/**
 * Cache Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.cacheManager - 캐시 매니저
 * @returns {express.Router} Express 라우터
 */
function createCacheRoutes(context) {
  const { cacheManager } = context;

  // POST /api/cache-refresh - 캐시 강제 새로고침
  router.post('/api/cache-refresh', (req, res) => {
    try {
      const { sheet } = req.body;

      if (sheet) {
        // 특정 시트 캐시만 삭제
        cacheManager.delete(`sheet_${sheet}`);
        
        console.log(`🔄 [캐시] 특정 시트 캐시 삭제: ${sheet}`);
        
        res.json({
          status: 'success',
          message: `캐시 새로고침 완료: ${sheet}`,
          timestamp: new Date().toISOString()
        });
      } else {
        // 전체 캐시 정리
        cacheManager.cleanup();
        
        console.log('🔄 [캐시] 전체 캐시 정리 완료');
        
        res.json({
          status: 'success',
          message: '전체 캐시 새로고침 완료',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ [캐시] 새로고침 오류:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

module.exports = createCacheRoutes;
