/**
 * Timeout Middleware 단위 테스트
 * 
 * 요구사항 3.1, 3.2, 12.3 검증
 */

const timeoutMiddleware = require('../../middleware/timeoutMiddleware');
const { setBasicCORSHeaders } = require('../../corsMiddleware');

// setBasicCORSHeaders 모킹
jest.mock('../../corsMiddleware', () => ({
  setBasicCORSHeaders: jest.fn()
}));

describe('Timeout Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // 요청 객체 모킹
    req = {
      setTimeout: jest.fn(),
      on: jest.fn(),
      originalUrl: '/api/test',
      method: 'GET',
      headers: {
        origin: 'https://example.com'
      }
    };

    // 응답 객체 모킹
    res = {
      setTimeout: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false
    };

    // next 함수 모킹
    next = jest.fn();

    // 콘솔 에러 모킹
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // setBasicCORSHeaders 모킹 초기화
    setBasicCORSHeaders.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('타임아웃 설정', () => {
    it('요청과 응답에 5분(300,000ms) 타임아웃을 설정해야 함 (요구사항 3.1)', () => {
      timeoutMiddleware(req, res, next);

      expect(req.setTimeout).toHaveBeenCalledWith(300000);
      expect(res.setTimeout).toHaveBeenCalledWith(300000);
    });

    it('next() 함수를 호출하여 다음 미들웨어로 진행해야 함', () => {
      timeoutMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('타임아웃 이벤트 리스너를 등록해야 함', () => {
      timeoutMiddleware(req, res, next);

      expect(req.on).toHaveBeenCalledWith('timeout', expect.any(Function));
    });
  });

  describe('타임아웃 발생 시 처리', () => {
    it('CORS 헤더를 설정해야 함 (요구사항 12.3)', () => {
      timeoutMiddleware(req, res, next);

      // 타임아웃 이벤트 핸들러 가져오기
      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      // 타임아웃 발생 시뮬레이션
      timeoutHandler();

      expect(setBasicCORSHeaders).toHaveBeenCalledWith(req, res);
    });

    it('504 Gateway Timeout 응답을 반환해야 함 (요구사항 3.2)', () => {
      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Gateway Timeout',
          message: 'Request exceeded 5 minute timeout',
          elapsedTime: expect.any(Number)
        })
      );
    });

    it('타임아웃 에러를 로깅해야 함 (요구사항 12.3)', () => {
      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      expect(console.error).toHaveBeenCalledWith(
        '⏱️ Request timeout:',
        expect.objectContaining({
          url: '/api/test',
          method: 'GET',
          elapsedTime: expect.stringMatching(/\d+ms/),
          timeout: '300000ms'
        })
      );
    });

    it('헤더가 이미 전송된 경우 응답을 보내지 않아야 함', () => {
      res.headersSent = true;

      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('경과 시간을 정확하게 계산해야 함', (done) => {
      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      // 100ms 대기 후 타임아웃 발생
      setTimeout(() => {
        timeoutHandler();

        const jsonCall = res.json.mock.calls[0][0];
        expect(jsonCall.elapsedTime).toBeGreaterThanOrEqual(100);
        expect(jsonCall.elapsedTime).toBeLessThan(200);

        done();
      }, 100);
    });
  });

  describe('에러 응답 형식', () => {
    it('일관된 에러 응답 형식을 반환해야 함', () => {
      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      const errorResponse = res.json.mock.calls[0][0];

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('elapsedTime');
      expect(typeof errorResponse.error).toBe('string');
      expect(typeof errorResponse.message).toBe('string');
      expect(typeof errorResponse.elapsedTime).toBe('number');
    });
  });

  describe('다양한 요청 시나리오', () => {
    it('POST 요청에서도 동일하게 동작해야 함', () => {
      req.method = 'POST';
      req.originalUrl = '/api/data';

      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      expect(console.error).toHaveBeenCalledWith(
        '⏱️ Request timeout:',
        expect.objectContaining({
          url: '/api/data',
          method: 'POST'
        })
      );
    });

    it('오리진 헤더가 없는 요청에서도 동작해야 함', () => {
      delete req.headers.origin;

      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      expect(setBasicCORSHeaders).toHaveBeenCalledWith(req, res);
      expect(res.status).toHaveBeenCalledWith(504);
    });

    it('긴 URL 경로에서도 동작해야 함', () => {
      req.originalUrl = '/api/very/long/path/with/many/segments?param=value';

      timeoutMiddleware(req, res, next);

      const timeoutHandler = req.on.mock.calls.find(
        call => call[0] === 'timeout'
      )[1];

      timeoutHandler();

      expect(console.error).toHaveBeenCalledWith(
        '⏱️ Request timeout:',
        expect.objectContaining({
          url: '/api/very/long/path/with/many/segments?param=value'
        })
      );
    });
  });
});
