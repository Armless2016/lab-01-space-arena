import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const environmentSchema = z.object({
  PORT: z.preprocess((value: unknown) => value === undefined || value === '' ? 3000 : Number(value), z.number().int().min(1).max(65535)),
  WS_MAX_PAYLOAD: z.preprocess((value: unknown) => value === undefined || value === '' ? 16 * 1024 : Number(value), z.number().int().min(1024).max(1024 * 1024)),
  MAX_MESSAGES_PER_SECOND: z.preprocess((value: unknown) => value === undefined || value === '' ? 120 : Number(value), z.number().int().min(1).max(1000)),
  LOG_DIR: z.string().default('./server/logs'),
  CLIENT_DIST_DIR: z.string().default('./client/dist'),
});

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export interface ServerConfig {
  readonly port: number;
  readonly wsMaxPayload: number;
  readonly maxMessagesPerSecond: number;
  readonly logDir: string;
  readonly clientDistDir: string;
}

export function loadConfig(): ServerConfig {
  // Read the repository .env when supported; OS variables take precedence over values in the file.
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
    } catch (error: unknown) {
      if (!isMissingFile(error)) throw error;
    }
  }
  const env = environmentSchema.parse(process.env);
  return {
    port: env.PORT,
    wsMaxPayload: env.WS_MAX_PAYLOAD,
    maxMessagesPerSecond: env.MAX_MESSAGES_PER_SECOND,
    logDir: path.resolve(PROJECT_ROOT, env.LOG_DIR),
    clientDistDir: path.resolve(PROJECT_ROOT, env.CLIENT_DIST_DIR),
  };
}
