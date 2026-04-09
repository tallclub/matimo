import { WinstonMatimoLogger, createLogger } from '../../src/logging/winston-logger';
import { MatimoLogger } from '../../src/logging/logger';

describe('WinstonMatimoLogger', () => {
  describe('with JSON format', () => {
    it('should create logger with json format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'json',
      });

      expect(logger).toBeInstanceOf(WinstonMatimoLogger);
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('debug');
    });

    it('should log info messages with json format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'json',
      });

      // Should not throw
      logger.info('Test message', { key: 'value' });
      logger.info('Simple message');
    });

    it('should log warn messages with json format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'warn',
        logFormat: 'json',
      });

      logger.warn('Warning message', { level: 'warn' });
      logger.warn('Simple warning');
    });

    it('should log error messages with json format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'error',
        logFormat: 'json',
      });

      logger.error('Error message', { error: 'test' });
      logger.error('Simple error');
    });

    it('should log debug messages with json format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'debug',
        logFormat: 'json',
      });

      logger.debug('Debug message', { debug: true });
      logger.debug('Simple debug');
    });
  });

  describe('with simple format', () => {
    it('should create logger with simple format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'simple',
      });

      expect(logger).toBeInstanceOf(WinstonMatimoLogger);
    });

    it('should log info messages with simple format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'simple',
      });

      logger.info('Test message', { key: 'value' });
      logger.info('Simple message');
    });

    it('should log warn messages with simple format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'warn',
        logFormat: 'simple',
      });

      logger.warn('Warning message', { level: 'warn' });
      logger.warn('Simple warning');
    });

    it('should log error messages with simple format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'error',
        logFormat: 'simple',
      });

      logger.error('Error message', { error: 'test' });
      logger.error('Simple error');
    });

    it('should log debug messages with simple format', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'debug',
        logFormat: 'simple',
      });

      logger.debug('Debug message', { debug: true });
      logger.debug('Simple debug');
    });

    it('should handle empty metadata', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'simple',
      });

      logger.info('Message with no meta');
      logger.warn('Warning without meta');
      logger.error('Error without meta');
      logger.debug('Debug without meta');
    });

    it('should handle complex metadata', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'simple',
      });

      logger.info('Complex message', {
        nested: { key: 'value', array: [1, 2, 3] },
        boolean: true,
        number: 42,
        string: 'test',
      });
    });
  });

  describe('log levels', () => {
    it('should respect silent log level', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'silent',
        logFormat: 'simple',
      });

      // Should not throw even in silent mode
      logger.info('Should not appear');
      logger.warn('Should not appear');
      logger.debug('Should not appear');
      logger.error('Error should appear');
    });

    it('should respect error log level', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'error',
        logFormat: 'simple',
      });

      logger.error('This should log');
      logger.warn('This might not log');
      logger.info('This will not log');
      logger.debug('This will not log');
    });

    it('should respect warn log level', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'warn',
        logFormat: 'simple',
      });

      logger.warn('This should log');
      logger.error('This should log');
      logger.info('This will not log');
      logger.debug('This will not log');
    });

    it('should respect info log level', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'info',
        logFormat: 'simple',
      });

      logger.info('This should log');
      logger.warn('This should log');
      logger.error('This should log');
      logger.debug('This will not log');
    });

    it('should respect debug log level', () => {
      const logger = new WinstonMatimoLogger({
        logLevel: 'debug',
        logFormat: 'simple',
      });

      logger.debug('This should log');
      logger.info('This should log');
      logger.warn('This should log');
      logger.error('This should log');
    });
  });

  describe('all log level and format combinations', () => {
    const logLevels = ['silent', 'error', 'warn', 'info', 'debug'] as const;
    const formats = ['json', 'simple'] as const;

    logLevels.forEach((level) => {
      formats.forEach((format) => {
        it(`should create logger with ${level} level and ${format} format`, () => {
          const logger = new WinstonMatimoLogger({
            logLevel: level,
            logFormat: format,
          });

          expect(logger).toBeDefined();
          logger.info('Test');
          logger.warn('Test');
          logger.error('Test');
          logger.debug('Test');
        });
      });
    });
  });
});

describe('createLogger function', () => {
  beforeEach(() => {
    delete process.env.MATIMO_LOG_LEVEL;
    delete process.env.MATIMO_LOG_FORMAT;
    delete process.env.NODE_ENV;
  });

  it('should create WinstonMatimoLogger when no custom logger provided', () => {
    const logger = createLogger({
      logLevel: 'info',
      logFormat: 'simple',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);
  });

  it('should return custom logger if provided', () => {
    const customLogger: MatimoLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const logger = createLogger({
      logLevel: 'info',
      logFormat: 'simple',
      logger: customLogger,
    });

    expect(logger).toBe(customLogger);
  });

  it('should use provided logLevel', () => {
    const logger = createLogger({
      logLevel: 'debug',
      logFormat: 'simple',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);
    logger.debug('Test debug message');
  });

  it('should use provided logFormat', () => {
    const logger = createLogger({
      logLevel: 'info',
      logFormat: 'json',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);
    logger.info('Test info message');
  });

  it('should default to json format in production', () => {
    process.env.NODE_ENV = 'production';

    const logger = createLogger({
      logLevel: 'info',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);

    delete process.env.NODE_ENV;
  });

  it('should default to simple format in development', () => {
    process.env.NODE_ENV = 'development';

    const logger = createLogger({
      logLevel: 'info',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);

    delete process.env.NODE_ENV;
  });

  it('should default to simple format when NODE_ENV not set', () => {
    delete process.env.NODE_ENV;

    const logger = createLogger({
      logLevel: 'info',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);
  });

  it('should use default logLevel of info', () => {
    const logger = createLogger({
      logFormat: 'simple',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);
  });

  it('should handle all logLevel options', () => {
    const levels = ['silent', 'error', 'warn', 'info', 'debug'] as const;

    levels.forEach((level) => {
      const logger = createLogger({
        logLevel: level,
        logFormat: 'simple',
      });

      expect(logger).toBeInstanceOf(WinstonMatimoLogger);
    });
  });

  it('should handle undefined logLevel', () => {
    const logger = createLogger({
      logFormat: 'json',
    });

    expect(logger).toBeInstanceOf(WinstonMatimoLogger);
    logger.info('Test');
  });

  it('should prefer explicit logger over creating new one', () => {
    const customLogger: MatimoLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const logger = createLogger({
      logLevel: 'debug',
      logFormat: 'json',
      logger: customLogger,
    });

    expect(logger).toBe(customLogger);
    expect(logger).not.toBeInstanceOf(WinstonMatimoLogger);
  });
});
