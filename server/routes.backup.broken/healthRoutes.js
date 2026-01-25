/**
 * Health Check Routes
 * 
 * 서버 상태 모니터링 및 헬스체크 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /health - 서버 헬스체크 (상세 정보 포함)
 * - GET / - 서버 상태 확인 (간단한 응답)
 * - GET /api/version - 서버 버전 정보
 * - GET /api/cache-status - 캐시 상태 확인
 * 
 * Requirements: 1.1, 1.2, 7.1
 */

const express = require('express');
const router = express.Router();
const { 
  createHealthCheckHandler, 
  getMemoryUsage, 
  getCpuUsage, 
  getUptime 
} = require('../healthCheck');

/**
 * Health Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @param {Object} context.discordBot - Discord 봇
 * @returns {express.Router} Express 라우터
 */
function createHealthRoutes(context) {
  const { sheetsClient, cacheManager } = context;

  // GET /health - 상세 헬스체크
  router.get('/health', createHealthCheckHandler({ sheetsClient }));

  // GET / - 간단한 서버 상태 확인
  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      message: 'VIP Map Server is running',
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/version - 서버 버전 정보
  router.get('/api/version', (req, res) => {
    const packageJson = require('../../package.json');
    
    res.json({
      success: true,
      version: packageJson.version || '1.0.0',
      name: packageJson.name || 'vip-map-server',
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/cache-status - 캐시 상태 확인
  router.get('/api/cache-status', (req, res) => {
    try {
      const cacheStatus = cacheManager.status();
      const memory = getMemoryUsage();
      const uptime = getUptime();
      
      res.json({
        success: true,
        cache: cacheStatus,
        memory: memory.process,
        uptime: uptime.process,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error fetching cache status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createHealthRoutes;
