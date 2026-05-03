import pino from 'pino';
import { config } from '../config.js';

const isDev = config.nodeEnv !== 'production';

/**
 * Root application logger.
 *
 * Development : pretty-printed, coloured, DEBUG level and above.
 * Production  : structured JSON, INFO level and above (ship to log aggregator).
 *
 * Create per-module child loggers via `logger.child({ module: 'auth' })` so
 * every line is tagged and easy to filter.
 */
export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageFormat: '{module} › {msg}',
          },
        },
      }
    : {}),
});
