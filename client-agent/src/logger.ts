/**
 * Simple logger utility that respects CLIENT_DEBUG environment variable
 */

const isDebugEnabled =
  process.env.CLIENT_DEBUG === 'true' || process.env.CLIENT_DEBUG === '1';

export const logger = {
  log: (...args: any[]) => {
    if (isDebugEnabled) {
      console.log('[client]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDebugEnabled) {
      console.warn('[client]', ...args);
    }
  },
  error: (...args: any[]) => {
    // Always show errors
    console.error('[client]', ...args);
  },
};
