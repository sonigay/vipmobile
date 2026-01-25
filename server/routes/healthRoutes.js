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

  // GET / - 서버 상태 확인 (백업 파일과 동일한 로직)
  router.get('/', (req, res) => {
    const { sheets, SPREADSHEET_ID } = sheetsClient || {};
    const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
    
    res.json({
      status: 'Server is running',
      timestamp: new Date().toISOString(),
      cache: cacheManager.status(),
      env: {
        SHEET_ID: SPREADSHEET_ID ? 'SET' : 'NOT SET',
        GOOGLE_SERVICE_ACCOUNT_EMAIL: GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET',
        GOOGLE_PRIVATE_KEY: GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET',
        PORT: process.env.PORT || 4000
      }
    });
  });

  // GET /api/version - 서버 버전 정보 (백업 파일과 동일한 로직)
  router.get('/api/version', (req, res) => {
    res.json({
      version: process.env.npm_package_version || '1.0.0',
      buildTime: Date.now().toString(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/cache-status - 캐시 상태 확인 (백업 파일과 동일한 로직)
  router.get('/api/cache-status', (req, res) => {
    res.json({
      status: 'success',
      cache: cacheManager.status(),
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

module.exports = createHealthRoutes;
