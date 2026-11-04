import { createServer } from 'node:http';
import process from 'node:process';
import { createRequire } from 'node:module';
import { loadConfig } from './config.ts';
import { createHttpHandler } from './http.ts';
import { createMatchLogger, type MatchLogger } from './match-log.ts';
import { RoomManager } from './rooms.ts';
import { attachWebSocketServer } from './ws-server.ts';
import { RuntimeMetrics } from './runtime-metrics.ts';
import { logger } from './logger.ts';

const require = createRequire(import.meta.url);
const commonJsDemo: { describe: () => string } = require('../examples/commonjs-demo.cjs');
const config = loadConfig();
logger.level = config.logLevel;
const loggerCache = new Map<string, MatchLogger>();
const metrics = new RuntimeMetrics();

async function loggerFactory(roomId: string): Promise<MatchLogger> {
  const existing = loggerCache.get(roomId);
  if (existing) return existing;
  const matchLogger = await createMatchLogger(config.logDir, roomId);
  loggerCache.set(roomId, matchLogger);
  return matchLogger;
}

const rooms = new RoomManager(loggerFactory, {
  maxRooms: config.maxRooms,
  maxPlayersPerRoom: config.maxPlayersPerRoom,
});
// A removed temporary room closes its log stream; remove the cached logger so a later
// room with the same ID receives a fresh writable stream instead of a closed one.
rooms.on('removed', (roomId) => { loggerCache.delete(roomId); });
await rooms.loadSeed();
const readiness = {
  ready: false,
  shuttingDown: false,
  canAcceptPlayers: () => rooms.list().some((room) => room.players < room.maxPlayers) || rooms.list().length < config.maxRooms,
};
const server = createServer();
const wsServer = attachWebSocketServer(server, { rooms, config, metrics, readiness });
server.on('request', createHttpHandler({
  config,
  rooms,
  metrics,
  readiness,
  connectionCount: () => wsServer.connectionCount,
}));
let closing: Promise<void> | null = null;

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (closing) return closing;
  readiness.shuttingDown = true;
  readiness.ready = false;
  closing = (async () => {
    const forceExit = setTimeout(() => {
      logger.fatal({ reason }, 'graceful_shutdown_timeout');
      process.exit(1);
    }, 8000);
    forceExit.unref();
    logger.info({ reason, connections: wsServer.connectionCount }, 'server_shutdown_started');
    try {
      // Keep /health reachable while clients receive shutdown; /ready is already 503.
      await wsServer.close();
      await rooms.closeAll();
      loggerCache.clear();
      const httpClosed = new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections();
      });
      await httpClosed;
      metrics.close();
      process.exitCode = exitCode;
      logger.info({ reason, exitCode }, 'server_shutdown_complete');
      await new Promise<void>((resolve) => { logger.flush(() => resolve()); });
    } catch (error: unknown) {
      logger.fatal({ err: error, reason }, 'server_shutdown_failed');
      process.exitCode = 1;
    } finally {
      clearTimeout(forceExit);
    }
  })();
  return closing;
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'uncaught_exception');
  void shutdown('uncaughtException', 1);
});
process.once('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason }, 'unhandled_rejection');
  void shutdown('unhandledRejection', 1);
});

server.listen(config.port, '0.0.0.0', () => {
  readiness.ready = true;
  logger.info({ port: config.port, gitSha: config.buildSha, allowedOrigins: config.allowedOrigins }, 'server_started');
  logger.info({ moduleSystem: commonJsDemo.describe() }, 'module_system_demo');
});
