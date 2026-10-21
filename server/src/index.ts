import { createServer } from 'node:http';
import process from 'node:process';
import { createRequire } from 'node:module';
import { loadConfig } from './config.ts';
import { createHttpHandler } from './http.ts';
import { createMatchLogger, type MatchLogger } from './match-log.ts';
import { RoomManager } from './rooms.ts';
import { attachWebSocketServer } from './ws-server.ts';

const require = createRequire(import.meta.url);
const commonJsDemo: { describe: () => string } = require('../examples/commonjs-demo.cjs');
const config = loadConfig();
const loggerCache = new Map<string, MatchLogger>();

async function loggerFactory(roomId: string): Promise<MatchLogger> {
  const existing = loggerCache.get(roomId);
  if (existing) return existing;
  const logger = await createMatchLogger(config.logDir, roomId);
  loggerCache.set(roomId, logger);
  return logger;
}

const rooms = new RoomManager(loggerFactory);
await rooms.loadSeed();
const server = createServer(createHttpHandler({ config, rooms }));
const wsServer = attachWebSocketServer(server, { rooms, config });
let closing = false;

async function gracefulShutdown(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (closing) return;
  closing = true;
  console.log(`${signal}: shutting down`);
  await wsServer.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rooms.closeAll();
  loggerCache.clear();
  process.exitCode = 0;
}

process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });

server.listen(config.port, () => {
  console.log(`Space Arena server listening on http://localhost:${config.port}`);
  console.log(commonJsDemo.describe());
  console.log(`WebSocket endpoint: ws://localhost:${config.port}/ws`);
  console.log(`Logs: ${config.logDir}`);
});
