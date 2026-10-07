import { createServer } from 'node:http';
import process from 'node:process';
import { createRequire } from 'node:module';
import { loadConfig } from './config.js';
import { createHttpHandler } from './http.js';
import { createMatchLogger } from './match-log.js';
import { RoomManager } from './rooms.js';
import { attachWebSocketServer } from './ws-server.js';

const require = createRequire(import.meta.url);
const commonJsDemo = require('../examples/commonjs-demo.cjs');
const config = loadConfig();
const loggerCache = new Map();

async function loggerFactory(roomId) {
  if (!loggerCache.has(roomId)) loggerCache.set(roomId, await createMatchLogger(config.logDir, roomId));
  return loggerCache.get(roomId);
}

const rooms = new RoomManager(loggerFactory);
await rooms.loadSeed();
const server = createServer(createHttpHandler({ config, rooms }));
const wsServer = attachWebSocketServer(server, { rooms, config });

let closing = false;
async function gracefulShutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal}: shutting down`);
  await wsServer.close();
  await new Promise((resolve) => server.close(resolve));
  await rooms.closeAll();
  loggerCache.clear();
  process.exitCode = 0;
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

server.listen(config.port, () => {
  console.log(`Space Arena server listening on http://localhost:${config.port}`);
  console.log(commonJsDemo.describe());
  console.log(`WebSocket endpoint: ws://localhost:${config.port}/ws`);
  console.log(`Logs: ${config.logDir}`);
});
