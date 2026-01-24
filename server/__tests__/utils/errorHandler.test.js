/**
 * Error Handler Unit Tests
 * 
 * errorHandler 유틸리티의 기능을 검증합니다.
 */

const { handleError } = require('../../utils/errorHandler');

// Mock discordBot
jest.mock('../../utils/discordBot', () => ({
  sendDiscordNotification: jest.fn(),
  EmbedBuilder: class MockEmbedBuilder {
    constructor() {
      this.fields = [];
    }
    setColor() { return this; }
    setTitle() { return this; }
    setDescription() { return this; }
    addFields(...fields) { 
      this.fields.push(...fields);
      return this; 
    }
    setTimestamp() { return this; }
  },
  DISCORD_CHANNEL_ID: 'test-channel-id',
  DISCORD_LOGGING_ENABLED: false
}));

describe('errorHandler', () => {
  let mockReq;
  let mockRes;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock request
    mockReq = {
      path: '/api/test',
      method: 'GET'
    };

    // Mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('handleError', () => {
    it('should log error with path, method, and message', () => {
      const error = new Error('Test error');
      
      handleError(error, mockReq, mockRes);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error:',
        expect.objectContaining({
          path: '/api/test',
          method: 'GET',
          error: 'Test error'
        })
      );
    });

    it('should log stack trace (first 3 lines only)', () => {
      const error = new Error('Test error');
      error.stack = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      
      handleError(error, mockReq, mockRes);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error:',
        expect.objectContaining({
          stack: 'Line 1\nLine 2\nLine 3'
        })
      );
    });

    it('should include additional context in log', () => {
      const error = new Error('Test error');
      const context = { operation: 'fetchData', userId: '123' };
      
      handleError(error, mockReq, mockRes, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error:',
        expect.objectContaining({
          operation: 'fetchData',
          userId: '123'
        })
      );
    });

    it('should return 500 status code by default', () => {
      const error = new Error('Test error');
      
      handleError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should use custom status code if provided', () => {
      const error = new Error('Not found');
      error.statusCode = 404;
      
      handleError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return error response with success: false', () => {
      const error = new Error('Test error');
      
      handleError(error, mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Test error'
        })
      );
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      handleError(error, mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: 'Error stack trace'
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      handleError(error, mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          stack: expect.anything()
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle error without message', () => {
      const error = new Error();
      
      handleError(error, mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error'
        })
      );
    });

    it('should handle error without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;
      
      handleError(error, mockReq, mockRes);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error:',
        expect.objectContaining({
          error: 'Test error'
        })
      );
    });
  });

  describe('Discord notification', () => {
    it('should not send Discord notification for 4xx errors', () => {
      const { sendDiscordNotification } = require('../../utils/discordBot');
      
      const error = new Error('Bad request');
      error.statusCode = 400;
      
      handleError(error, mockReq, mockRes);

      expect(sendDiscordNotification).not.toHaveBeenCalled();
    });

    it('should send Discord notification for 500+ errors when enabled', () => {
      // Re-mock with DISCORD_LOGGING_ENABLED = true
      jest.resetModules();
      jest.mock('../../utils/discordBot', () => ({
        sendDiscordNotification: jest.fn(),
        EmbedBuilder: class MockEmbedBuilder {
          constructor() {
            this.fields = [];
          }
          setColor() { return this; }
          setTitle() { return this; }
          setDescription() { return this; }
          addFields(...fields) { 
            this.fields.push(...fields);
            return this; 
          }
          setTimestamp() { return this; }
        },
        DISCORD_CHANNEL_ID: 'test-channel-id',
        DISCORD_LOGGING_ENABLED: true
      }));

      const { handleError: handleErrorWithDiscord } = require('../../utils/errorHandler');
      const { sendDiscordNotification } = require('../../utils/discordBot');
      
      const error = new Error('Server error');
      error.statusCode = 500;
      
      handleErrorWithDiscord(error, mockReq, mockRes);

      expect(sendDiscordNotification).toHaveBeenCalled();
    });
  });
});
