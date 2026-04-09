/**
 * Logger interface for Matimo SDK
 * Provides a contract for logging implementations allowing users to plug in
 * their own loggers (Winston, Pino, custom) or use the default Winston logger.
 *
 * @example
 * ```typescript
 * // Use default Winston logger
 * const matimo = await MatimoInstance.init({
 *   toolPaths: ['./tools'],
 *   logLevel: 'debug'
 * });
 *
 * // Use custom logger
 * const customLogger = { info: (...) => {}, warn: (...) => {}, ... };
 * const matimo = await MatimoInstance.init({
 *   toolPaths: ['./tools'],
 *   logger: customLogger
 * });
 * ```
 */
export interface MatimoLogger {
  /**
   * Log an informational message with optional metadata
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log a warning message with optional metadata
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log an error message with optional metadata
   */
  error(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log a debug message with optional metadata
   */
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Log level for Matimo logger
 * silent: No logs (useful for testing)
 * error: Only errors
 * warn: Warnings and errors
 * info: Info, warnings, and errors
 * debug: All logs including debug messages
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /**
   * Log level for output (default: 'info')
   * Environment variable: MATIMO_LOG_LEVEL
   */
  logLevel?: LogLevel;

  /**
   * Log format: 'json' for structured logging, 'simple' for human-readable
   * Default: 'json' in production, 'simple' in development
   * Environment variable: MATIMO_LOG_FORMAT
   */
  logFormat?: 'json' | 'simple';

  /**
   * Custom logger instance. If provided, overrides all other logger options.
   * Allows users to plug in Winston, Pino, or any custom logger.
   */
  logger?: MatimoLogger;
}

/**
 * Get logger configuration from environment variables and config object
 * Environment variables take precedence over programmatic config.
 * Supports:
 * - MATIMO_LOG_LEVEL: 'silent' | 'error' | 'warn' | 'info' | 'debug'
 * - MATIMO_LOG_FORMAT: 'json' | 'simple'
 */
export function getLoggerConfig(config?: LoggerConfig): {
  logLevel: LogLevel;
  logFormat: 'json' | 'simple';
  logger?: MatimoLogger;
} {
  const logLevel = (process.env.MATIMO_LOG_LEVEL as LogLevel) || config?.logLevel || 'info';
  const logFormat =
    (process.env.MATIMO_LOG_FORMAT as 'json' | 'simple') ||
    config?.logFormat ||
    (process.env.NODE_ENV === 'production' ? 'json' : 'simple');

  return {
    logLevel,
    logFormat,
    logger: config?.logger,
  };
}

/**
 * Global logger instance used by Matimo modules
 * Set via setGlobalMatimoLogger, accessed via getGlobalMatimoLogger
 *
 * @internal
 */
let globalMatimoLogger: MatimoLogger | undefined;

/**
 * Set the global Matimo logger instance
 * Called by MatimoInstance.init() during initialization
 *
 * @internal
 */
export function setGlobalMatimoLogger(logger: MatimoLogger): void {
  globalMatimoLogger = logger;
}

/**
 * Get the global Matimo logger instance
 * Returns a no-op logger if not initialized (safe fallback)
 *
 * @internal
 */
export function getGlobalMatimoLogger(): MatimoLogger {
  if (!globalMatimoLogger) {
    // Return no-op logger if not initialized (safe fallback for tests/edge cases)
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
  }
  return globalMatimoLogger;
}
