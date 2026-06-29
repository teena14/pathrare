/**
 * A lightweight centralized logger abstraction.
 * In a real-world scenario, this could wrap Pino, Winston, or send logs to Datadog/Sentry.
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  warn: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${message}`, error, meta ? JSON.stringify(meta) : '');
    }
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[ERROR] ${message}`, error, meta ? JSON.stringify(meta) : '');
    }
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
};
