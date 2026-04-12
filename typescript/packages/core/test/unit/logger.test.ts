/**
 * Logger Tests
 * Comprehensive coverage of logger initialization, configuration, and fallback behaviors
 */

import {
  MatimoLogger,
  LogLevel,
  getLoggerConfig,
  setGlobalMatimoLogger,
  getGlobalMatimoLogger,
} from '../../src/logging/logger';

describe('Logger Configuration and Management', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.MATIMO_LOG_LEVEL;
    delete process.env.MATIMO_LOG_FORMAT;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
  });

  describe('getLoggerConfig', () => {
    it('should return default config when no arguments provided', () => {
      const config = getLoggerConfig();

      expect(config.logLevel).toBe('info');
      expect(config.logFormat).toBe('simple');
      expect(config.logger).toBeUndefined();
    });

    it('should use environment variable MATIMO_LOG_LEVEL', () => {
      process.env.MATIMO_LOG_LEVEL = 'debug';
      const config = getLoggerConfig();

      expect(config.logLevel).toBe('debug');
    });

    it('should prioritize environment variable over config for log level', () => {
      process.env.MATIMO_LOG_LEVEL = 'error';
      const config = getLoggerConfig({ logLevel: 'debug' });

      expect(config.logLevel).toBe('error');
    });

    it('should use config logLevel when env var not set', () => {
      const config = getLoggerConfig({ logLevel: 'warn' });

      expect(config.logLevel).toBe('warn');
    });

    it('should support all log levels from config', () => {
      const levels: LogLevel[] = ['silent', 'error', 'warn', 'info', 'debug'];

      for (const level of levels) {
        const config = getLoggerConfig({ logLevel: level });
        expect(config.logLevel).toBe(level);
      }
    });

    it('should use environment variable MATIMO_LOG_FORMAT', () => {
      process.env.MATIMO_LOG_FORMAT = 'json';
      const config = getLoggerConfig();

      expect(config.logFormat).toBe('json');
    });

    it('should prioritize environment variable over config for log format', () => {
      process.env.MATIMO_LOG_FORMAT = 'json';
      const config = getLoggerConfig({ logFormat: 'simple' });

      expect(config.logFormat).toBe('json');
    });

    it('should use config logFormat when env var not set', () => {
      const config = getLoggerConfig({ logFormat: 'json' });

      expect(config.logFormat).toBe('json');
    });

    it('should default to json format in production', () => {
      process.env.NODE_ENV = 'production';
      const config = getLoggerConfig();

      expect(config.logFormat).toBe('json');
    });

    it('should default to simple format in development', () => {
      process.env.NODE_ENV = 'development';
      const config = getLoggerConfig();

      expect(config.logFormat).toBe('simple');
    });

    it('should default to simple format when NODE_ENV not set', () => {
      const config = getLoggerConfig();

      expect(config.logFormat).toBe('simple');
    });

    it('should include custom logger in config', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const config = getLoggerConfig({ logger: customLogger });

      expect(config.logger).toBe(customLogger);
    });

    it('should handle all combinations of config options', () => {
      process.env.MATIMO_LOG_LEVEL = 'warn';
      process.env.MATIMO_LOG_FORMAT = 'json';
      process.env.NODE_ENV = 'production';

      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const config = getLoggerConfig({
        logLevel: 'debug',
        logFormat: 'simple',
        logger: customLogger,
      });

      expect(config.logLevel).toBe('warn'); // env var wins
      expect(config.logFormat).toBe('json'); // env var wins
      expect(config.logger).toBe(customLogger);
    });
  });

  describe('Global Logger Instance', () => {
    it('should return no-op logger when not initialized', () => {
      // Reset global logger state
      setGlobalMatimoLogger(undefined as unknown as MatimoLogger);

      const logger = getGlobalMatimoLogger();

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();

      // No-op functions should not throw
      expect(() => logger.info('test')).not.toThrow();
      expect(() => logger.warn('test')).not.toThrow();
      expect(() => logger.error('test')).not.toThrow();
      expect(() => logger.debug('test')).not.toThrow();
    });

    it('should set and return custom logger instance', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      expect(logger).toBe(customLogger);
    });

    it('should use custom logger methods', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      logger.info('info message', { key: 'value' });
      logger.warn('warn message');
      logger.error('error message', { error: 'details' });
      logger.debug('debug message');

      expect(customLogger.info).toHaveBeenCalledWith('info message', { key: 'value' });
      expect(customLogger.warn).toHaveBeenCalledWith('warn message');
      expect(customLogger.error).toHaveBeenCalledWith('error message', { error: 'details' });
      expect(customLogger.debug).toHaveBeenCalledWith('debug message');
    });

    it('should allow switching between loggers', () => {
      const logger1: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const logger2: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(logger1);
      expect(getGlobalMatimoLogger()).toBe(logger1);

      setGlobalMatimoLogger(logger2);
      expect(getGlobalMatimoLogger()).toBe(logger2);

      const retrieved = getGlobalMatimoLogger();
      retrieved.info('test');

      expect(logger1.info).not.toHaveBeenCalled();
      expect(logger2.info).toHaveBeenCalledWith('test');
    });

    it('should handle metadata parameter in info logs', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      const metadata = { userId: '123', action: 'login' };
      logger.info('User logged in', metadata);

      expect(customLogger.info).toHaveBeenCalledWith('User logged in', metadata);
    });

    it('should handle metadata parameter in warn logs', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      const metadata = { severity: 'high' };
      logger.warn('Warning message', metadata);

      expect(customLogger.warn).toHaveBeenCalledWith('Warning message', metadata);
    });

    it('should handle metadata parameter in error logs', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      const metadata = { code: 'ERR_INVALID' };
      logger.error('Error occurred', metadata);

      expect(customLogger.error).toHaveBeenCalledWith('Error occurred', metadata);
    });

    it('should handle metadata parameter in debug logs', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      const metadata = { trace: 'full' };
      logger.debug('Debug message', metadata);

      expect(customLogger.debug).toHaveBeenCalledWith('Debug message', metadata);
    });

    it('should work with logs without metadata', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      setGlobalMatimoLogger(customLogger);
      const logger = getGlobalMatimoLogger();

      logger.info('message without meta');
      logger.warn('warning without meta');
      logger.error('error without meta');
      logger.debug('debug without meta');

      expect(customLogger.info).toHaveBeenCalledWith('message without meta');
      expect(customLogger.warn).toHaveBeenCalledWith('warning without meta');
      expect(customLogger.error).toHaveBeenCalledWith('error without meta');
      expect(customLogger.debug).toHaveBeenCalledWith('debug without meta');
    });

    it('should have no-op logger methods callable with any number of arguments', () => {
      setGlobalMatimoLogger(undefined as unknown as MatimoLogger);
      const logger = getGlobalMatimoLogger();

      // Should not throw with various argument combinations
      expect(() => logger.info('msg')).not.toThrow();
      expect(() => logger.info('msg', {})).not.toThrow();
      expect(() => logger.info('msg', { key: 'value' })).not.toThrow();

      expect(() => logger.warn('msg')).not.toThrow();
      expect(() => logger.error('msg')).not.toThrow();
      expect(() => logger.debug('msg')).not.toThrow();
    });
  });

  describe('Logger Interface Compliance', () => {
    it('should have all required methods in logger interface', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      // Should compile and work without errors
      expect(customLogger.info).toBeDefined();
      expect(customLogger.warn).toBeDefined();
      expect(customLogger.error).toBeDefined();
      expect(customLogger.debug).toBeDefined();

      expect(typeof customLogger.info).toBe('function');
      expect(typeof customLogger.warn).toBe('function');
      expect(typeof customLogger.error).toBe('function');
      expect(typeof customLogger.debug).toBe('function');
    });

    it('should accept optional metadata in all methods', () => {
      const customLogger: MatimoLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const meta = { key: 'value' };

      // All methods should accept message and optional metadata
      customLogger.info('msg', meta);
      customLogger.warn('msg', meta);
      customLogger.error('msg', meta);
      customLogger.debug('msg');

      expect(customLogger.info).toHaveBeenCalledWith('msg', meta);
      expect(customLogger.warn).toHaveBeenCalledWith('msg', meta);
      expect(customLogger.error).toHaveBeenCalledWith('msg', meta);
      expect(customLogger.debug).toHaveBeenCalledWith('msg');
    });
  });

  describe('Environment Variable Isolation', () => {
    it('should not affect global state between tests', () => {
      process.env.MATIMO_LOG_LEVEL = 'debug';
      const config1 = getLoggerConfig();
      expect(config1.logLevel).toBe('debug');

      // Reset (as done in beforeEach)
      delete process.env.MATIMO_LOG_LEVEL;
      const config2 = getLoggerConfig();
      expect(config2.logLevel).toBe('info');
    });

    it('should handle empty string env variables', () => {
      process.env.MATIMO_LOG_LEVEL = '';
      const config = getLoggerConfig();

      // Empty string is falsy, should fall back to default or config
      expect(config.logLevel).toBe('info');
    });
  });
});
