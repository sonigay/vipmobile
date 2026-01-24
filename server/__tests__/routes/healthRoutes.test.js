/**
 * Health Routes Unit Tests
 * 
 * Tests:
 * - GET /health endpoint
 * - GET / endpoint
 * - GET /api/version endpoint
 * - GET /api/cache-status endpoint
 * 
 * Requirements: 7.1
 */

const express = require('express');
const request = require('supertest');
const createHealthRoutes = require('../../routes/healthRoutes');

describe('Health Routes', () => {
  let app;
  let mockContext;

  beforeEach(() => {
    // Mock context 생성
    mockContext = {
      sheetsClient: {
        sheets: {},
        drive: {},
        auth: {},
        SPREADSHEET_ID: 'test-sheet-id'
      },
      cacheManager: {
        status: jest.fn().mockReturnValue({
          total: 100,
          valid: 80,
          expired: 20
        })
      },
      rateLimiter: {},
      discordBot: {}
    };

    // Express 앱 생성
    app = express();
    app.use(express.json());
    
    // Health routes 등록
    const healthRoutes = createHealthRoutes(mockContext);
    app.use('/', healthRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return server health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('googleSheets');
    });

    it('should include memory usage information', async () => {
      const response = await request(app).get('/health');

      expect(response.body.memory).toHaveProperty('process');
      expect(response.body.memory).toHaveProperty('system');
      expect(response.body.memory.process).toHaveProperty('heapUsed');
      expect(response.body.memory.system).toHaveProperty('total');
    });

    it('should include CPU usage information', async () => {
      const response = await request(app).get('/health');

      expect(response.body.cpu).toHaveProperty('count');
      expect(response.body.cpu).toHaveProperty('average');
      expect(response.body.cpu).toHaveProperty('cores');
      expect(Array.isArray(response.body.cpu.cores)).toBe(true);
    });

    it('should include Google Sheets connection status', async () => {
      const response = await request(app).get('/health');

      expect(response.body.googleSheets).toHaveProperty('status');
      expect(response.body.googleSheets).toHaveProperty('message');
    });
  });

  describe('GET /', () => {
    it('should return simple server status', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'VIP Map Server is running',
        timestamp: expect.any(String)
      });
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app).get('/');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('GET /api/version', () => {
    it('should return server version information', async () => {
      const response = await request(app).get('/api/version');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('node');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return Node.js version', async () => {
      const response = await request(app).get('/api/version');

      expect(response.body.node).toBe(process.version);
    });
  });

  describe('GET /api/cache-status', () => {
    it('should return cache status', async () => {
      const response = await request(app).get('/api/cache-status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        cache: {
          total: 100,
          valid: 80,
          expired: 20,
          hitRate: 80
        },
        timestamp: expect.any(String)
      });
      expect(mockContext.cacheManager.status).toHaveBeenCalled();
    });

    it('should call cacheManager.status()', async () => {
      await request(app).get('/api/cache-status');

      expect(mockContext.cacheManager.status).toHaveBeenCalledTimes(1);
    });

    it('should handle cache manager errors', async () => {
      // 새로운 앱과 컨텍스트 생성 (에러를 던지는 mock 사용)
      const errorContext = {
        ...mockContext,
        cacheManager: {
          status: jest.fn().mockImplementation(() => {
            throw new Error('Cache error');
          })
        }
      };

      const errorApp = express();
      errorApp.use(express.json());
      const errorRoutes = createHealthRoutes(errorContext);
      errorApp.use('/', errorRoutes);

      const response = await request(errorApp).get('/api/cache-status');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Cache error',
        timestamp: expect.any(String)
      });
    });

    it('should calculate hit rate correctly when cache is empty', async () => {
      // 새로운 앱과 컨텍스트 생성 (빈 캐시 mock 사용)
      const emptyContext = {
        ...mockContext,
        cacheManager: {
          status: jest.fn().mockReturnValue({
            total: 0,
            valid: 0,
            expired: 0
          })
        }
      };

      const emptyApp = express();
      emptyApp.use(express.json());
      const emptyRoutes = createHealthRoutes(emptyContext);
      emptyApp.use('/', emptyRoutes);

      const response = await request(emptyApp).get('/api/cache-status');

      expect(response.body.cache.hitRate).toBe(0);
    });
  });

  describe('Context Integration', () => {
    it('should use provided sheetsClient', async () => {
      const response = await request(app).get('/health');

      // sheetsClient가 healthCheck 모듈에 전달되었는지 확인
      expect(response.body.googleSheets).toBeDefined();
    });

    it('should use provided cacheManager', async () => {
      await request(app).get('/api/cache-status');

      expect(mockContext.cacheManager.status).toHaveBeenCalled();
    });
  });
});
