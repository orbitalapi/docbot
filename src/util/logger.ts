import pino from 'pino';

/**
 * Log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Create a logger instance
 */
export function createLogger(level: LogLevel = 'info') {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return pino({
    level,
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger((process.env.LOG_LEVEL as LogLevel) || 'info');
