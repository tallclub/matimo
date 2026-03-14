import winston from 'winston';
import { MatimoLogger, LogLevel, LoggerConfig } from './logger.js';

/**
 * Winston-based logger implementation for Matimo SDK
 * Provides structured logging with optional JSON format for production use.
 * Supports environment variable overrides for log level and format.
 *
 * @internal
 */
export class WinstonMatimoLogger implements MatimoLogger {
  private winstonLogger: winston.Logger;

  constructor(config: { logLevel: LogLevel; logFormat: 'json' | 'simple' }) {
    // Map Matimo log levels to Winston levels
    const winstonLevel = this.mapLogLevel(config.logLevel);

    // Create format based on config
    const format = this.createFormat(config.logFormat);

    this.winstonLogger = winston.createLogger({
      level: winstonLevel,
      // When logLevel is 'silent', suppress ALL output. This is critical for
      // MCP stdio transport where stdout is reserved for JSON-RPC messages —
      // any non-JSON output (even error logs) corrupts the protocol.
      silent: config.logLevel === 'silent',
      format,
      transports: [
        new winston.transports.Console({
          // Write ALL log levels to stderr instead of stdout. This prevents
          // log output from corrupting stdio-based protocols (e.g., MCP)
          // where stdout is reserved for structured messages.
          stderrLevels: ['error', 'warn', 'info', 'debug'],
          format: winston.format.combine(winston.format.colorize(), format),
        }),
      ],
    });
  }

  private mapLogLevel(level: LogLevel): string {
    const levelMap: Record<LogLevel, string> = {
      silent: 'error', // Winston level when silent — actual suppression handled by silent: true
      error: 'error',
      warn: 'warn',
      info: 'info',
      debug: 'debug',
    };
    return levelMap[level];
  }

  private createFormat(format: 'json' | 'simple'): winston.Logform.Format {
    if (format === 'json') {
      return winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      );
    }

    // Simple human-readable format
    return winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr ? '\n' + metaStr : ''}`;
      })
    );
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.winstonLogger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.winstonLogger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.winstonLogger.error(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.winstonLogger.debug(message, meta);
  }
}

/**
 * Create a logger from config
 * Uses Winston if no custom logger provided, otherwise returns the custom logger
 *
 * @internal
 */
export function createLogger(config: LoggerConfig): MatimoLogger {
  if (config.logger) {
    return config.logger;
  }

  return new WinstonMatimoLogger({
    logLevel: config.logLevel || 'info',
    logFormat: config.logFormat || (process.env.NODE_ENV === 'production' ? 'json' : 'simple'),
  });
}
