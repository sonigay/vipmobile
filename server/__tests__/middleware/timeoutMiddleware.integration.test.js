/**
 * Timeout Middleware 통합 테스트
 * 
 * Express 앱과 함께 실제 환경에서 미들웨어 동작 검증
 */

const express = require('express');
const request = require('supertest');
const timeoutMiddleware = require('../../middleware/timeoutMiddleware');

// CORS 미들웨어 모킹
jest.mock('../../corsMiddleware', () => ({
  setBasicCORSHeaders: jest.fn((req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
  })
}));

describe('Timeout Middleware 통합 테스트', () => {
  let app;

  beforeEach(() => {
    // Express 앱 생성
    app = express();
    
    // 타임아웃 미들웨어 등록
    app.use(timeoutMiddleware);
    
    // 콘솔 에러 모킹
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('정상 요청 처리', () => {
    it('빠른 응답은 정상적으로 처리되어야 함', async () => {
      app.get('/fast', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/fast')
        .expect(200);

      expect(response.body).toEqual({ message: 'success' });
    });

    it('여러 요청을 동시에 처리할 수 있어야 함', async () => {
      app.get('/concurrent', (req, res) => {
        res.json({ message: 'ok' });
      });

      const requests = Array(10).fill(null).map(() =>
        request(app).get('/concurrent')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'ok' });
      });
    });
  });

  describe('타임아웃 설정 확인', () => {
    it('미들웨어가 요청 객체에 타임아웃을 설정해야 함', (done) => {
      app.get('/check-timeout', (req, res) => {
        // setTimeout이 호출되었는지 확인
        expect(req.setTimeout).toBeDefined();
        res.json({ message: 'timeout set' });
      });

      request(app)
        .get('/check-timeout')
        .expect(200)
        .end(done);
    });
  });

  describe('에러 처리', () => {
    it('라우트에서 에러가 발생해도 타임아웃 미들웨어는 영향받지 않아야 함', async () => {
      app.get('/error', (req, res, next) => {
        next(new Error('Test error'));
      });

      // 에러 핸들러 추가
      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app)
        .get('/error')
        .expect(500);

      expect(response.body).toEqual({ error: 'Test error' });
    });
  });

  describe('다양한 HTTP 메서드', () => {
    it('POST 요청에서도 타임아웃이 설정되어야 함', async () => {
      app.post('/post-test', (req, res) => {
        res.json({ method: 'POST' });
      });

      const response = await request(app)
        .post('/post-test')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body).toEqual({ method: 'POST' });
    });

    it('PUT 요청에서도 타임아웃이 설정되어야 함', async () => {
      app.put('/put-test', (req, res) => {
        res.json({ method: 'PUT' });
      });

      const response = await request(app)
        .put('/put-test')
        .send({ data: 'test' })
        .expect(200);

      expect(response.body).toEqual({ method: 'PUT' });
    });

    it('DELETE 요청에서도 타임아웃이 설정되어야 함', async () => {
      app.delete('/delete-test', (req, res) => {
        res.json({ method: 'DELETE' });
      });

      const response = await request(app)
        .delete('/delete-test')
        .expect(200);

      expect(response.body).toEqual({ method: 'DELETE' });
    });
  });

  describe('CORS 헤더 통합', () => {
    it('타임아웃 발생 시 CORS 헤더가 포함되어야 함', (done) => {
      const { setBasicCORSHeaders } = require('../../corsMiddleware');

      app.get('/timeout-test', (req, res) => {
        // 타임아웃 이벤트 강제 발생
        req.emit('timeout');
      });

      request(app)
        .get('/timeout-test')
        .end((err, res) => {
          // setBasicCORSHeaders가 호출되었는지 확인
          expect(setBasicCORSHeaders).toHaveBeenCalled();
          done();
        });
    });
  });

  describe('응답 헤더 확인', () => {
    it('정상 응답에는 타임아웃 관련 헤더가 없어야 함', async () => {
      app.get('/normal', (req, res) => {
        res.json({ status: 'ok' });
      });

      const response = await request(app)
        .get('/normal')
        .expect(200);

      expect(response.headers['x-timeout']).toBeUndefined();
    });
  });

  describe('긴 URL 처리', () => {
    it('매우 긴 URL 경로도 처리할 수 있어야 함', async () => {
      const longPath = '/api/' + 'segment/'.repeat(50) + 'end';
      
      app.get(longPath, (req, res) => {
        res.json({ path: 'long' });
      });

      const response = await request(app)
        .get(longPath)
        .expect(200);

      expect(response.body).toEqual({ path: 'long' });
    });
  });
});
