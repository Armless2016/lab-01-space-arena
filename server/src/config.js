import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function integerFromEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function loadConfig() {
  // Load the repository-root .env when supported; OS-provided variables still take precedence.
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  const port = integerFromEnv('PORT', 3000, { min: 1, max: 65535 });
  const wsMaxPayload = integerFromEnv('WS_MAX_PAYLOAD', 16 * 1024, { min: 1024, max: 1024 * 1024 });
  const maxMessagesPerSecond = integerFromEnv('MAX_MESSAGES_PER_SECOND', 120, { min: 1, max: 1000 });
  const logDir = path.resolve(PROJECT_ROOT, process.env.LOG_DIR || './server/logs');
  const clientDistDir = path.resolve(PROJECT_ROOT, process.env.CLIENT_DIST_DIR || './client/dist');
  return { port, wsMaxPayload, maxMessagesPerSecond, logDir, clientDistDir };
}
