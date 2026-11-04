import type { IncomingMessage } from 'node:http';
import { Buffer } from 'node:buffer';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { ServerMessageSchema } from '@space-arena/shared/schemas';
import { assertNever, type InputMessage } from '@space-arena/shared/types';
import { encodeSnapshotBinary } from '@space-arena/shared/protocol';
import { decodeInputBinary } from '@space-arena/shared/protocol';
import { getErrorMessage, getProtocolCloseCode, parseClientMessage } from './protocol.ts';
import type { Room, RoomManager, RoomPlayer } from './rooms.ts';
import type { ServerConfig } from './config.ts';
import { createMessageRateLimiter } from './rate-limit.ts';
import { isAllowedOrigin, getClientIp, IpConnectionLimiter } from './origin.ts';
import type { RuntimeMetrics } from './runtime-metrics.ts';
import { logger } from './logger.ts';
import type { Logger } from 'pino';

const JOIN_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 15000;
const MAX_MISSED_PONGS = 2;
const HIGH_WATER_MARK = 64 * 1024;
interface SocketContext {
  room: Room | null;
  protocolMode: 'json' | 'binary' | null;
  joinTimer: NodeJS.Timeout | null;
  isAlive: boolean;
  missedPongs: number;
  clientIp: string;
  log: Logger;
}
type SendOptions = { readonly critical?: boolean };

function toText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

function toBinaryBuffer(data: RawData): Buffer | ArrayBuffer | ArrayBufferView {
  if (Array.isArray(data)) return Buffer.concat(data);
  return data;
}

export function attachWebSocketServer(httpServer: import('node:http').Server, options: { rooms: RoomManager; config: ServerConfig; metrics: RuntimeMetrics; readiness: { ready: boolean; shuttingDown: boolean; canAcceptPlayers?: () => boolean } }) {
  const { rooms, config, metrics, readiness } = options;
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.wsMaxPayload });
  const clients = new Set<WebSocket>();
  const contexts = new WeakMap<WebSocket, SocketContext>();
  const allowMessage = new WeakMap<WebSocket, () => boolean>();
  const ipLimiter = new IpConnectionLimiter(config.maxConnectionsPerIp);
  let accepting = true;

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    if (!accepting || readiness.shuttingDown || !readiness.ready || (readiness.canAcceptPlayers && !readiness.canAcceptPlayers())) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin, config)) {
      logger.warn({ origin: origin ?? null }, 'websocket_origin_rejected');
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }
    } catch {
      socket.destroy();
      return;
    }
    const clientIp = getClientIp(request, config.trustProxy);
    if (!ipLimiter.acquire(clientIp)) {
      logger.warn({ clientIp }, 'websocket_ip_connection_limit_reached');
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    try {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } catch (error: unknown) {
      ipLimiter.release(clientIp);
      logger.error({ err: error, clientIp }, 'websocket_upgrade_failed');
      socket.destroy();
    }
  });

  function contextOf(ws: WebSocket): SocketContext | undefined { return contexts.get(ws); }


  function sendToClient(ws: WebSocket, payload: unknown, sendOptions: SendOptions = {}): boolean {
    if (ws.readyState !== WebSocket.OPEN) return false;
    if (!sendOptions.critical && ws.bufferedAmount > HIGH_WATER_MARK) return false;
    const context = contextOf(ws);
    const player: RoomPlayer | undefined = context?.room?.players.get(ws);
    const snapshot = ServerMessageSchema.safeParse(payload);
    if (snapshot.success && snapshot.data.type === 'snapshot' && player?.protocol === 'binary') {
      const frame = encodeSnapshotBinary(snapshot.data);
      ws.send(frame, { binary: true });
      metrics.recordMessage(frame.byteLength);
      return true;
    }
    const frame = JSON.stringify(payload);
    ws.send(frame);
    metrics.recordMessage(Buffer.byteLength(frame));
    return true;
  }

  function broadcastPlayers(room: Room): void {
    room.broadcast({ type: 'players', players: room.playerList }, (client, payload) => sendToClient(client, payload, { critical: true }));
  }

  function publishSnapshots(room: Room): void {
    for (const [client, player] of room.players) {
      if (client.readyState !== WebSocket.OPEN || client.bufferedAmount > HIGH_WATER_MARK) continue;
      const snapshot = room.snapshotFor(player);
      if (player.protocol === 'binary') {
        const frame = encodeSnapshotBinary(snapshot);
        client.send(frame, { binary: true });
        metrics.recordMessage(frame.byteLength);
      } else {
        const frame = JSON.stringify(snapshot);
        client.send(frame);
        metrics.recordMessage(Buffer.byteLength(frame));
      }
    }
  }

  function leaveRoom(ws: WebSocket): void {
    const context = contextOf(ws);
    const room = context?.room;
    if (!room || !context) return;
    const player = room.leave(ws);
    if (!player) { context.room = null; return; }
    context.log.info({ playerId: player.playerId, playerName: player.name }, 'player_left_room');
    room.broadcast({ type: 'system', text: `${player.name} left` }, (client, payload) => sendToClient(client, payload));
    context.room = null;
    broadcastPlayers(room);
    void rooms.removeIfEmpty(room);
  }

  wss.on('connection', (ws, request) => {
    const clientIp = getClientIp(request, config.trustProxy);
    clients.add(ws);
    contexts.set(ws, { room: null, protocolMode: null, joinTimer: null, isAlive: true, missedPongs: 0, clientIp, log: logger.child({ clientIp }) });
    const context = contextOf(ws);
    if (!context) return;
    context.joinTimer = setTimeout(() => {
      if (!context.room && ws.readyState === WebSocket.OPEN) ws.close(1008, 'join required within 5 seconds');
    }, JOIN_TIMEOUT_MS);
    allowMessage.set(ws, createMessageRateLimiter(config.maxMessagesPerSecond));

    ws.on('pong', () => {
      context.isAlive = true;
      context.missedPongs = 0;
    });

    ws.on('message', (data: RawData, isBinary: boolean) => {
      const rateCheck = allowMessage.get(ws);
      const incomingBytes = isBinary
        ? (Array.isArray(data) ? Buffer.concat(data).byteLength : data.byteLength)
        : Buffer.byteLength(toText(data));
      metrics.recordMessage(incomingBytes);
      if (!rateCheck || !rateCheck()) { context.log.warn({ roomId: context.room?.id ?? null }, 'websocket_message_rate_limit_exceeded'); ws.close(1008, 'message rate limit exceeded'); return; }
      let message: InputMessage | ReturnType<typeof parseClientMessage>;
      try {
        if (isBinary) {
          if (context.protocolMode !== 'binary' || !context.room) {
            throw new Error('binary input not negotiated');
          }
          message = decodeInputBinary(toBinaryBuffer(data));
        } else {
          message = parseClientMessage(toText(data), config.wsMaxPayload);
          if (message.type === 'input' && context.protocolMode === 'binary') {
            throw new Error('binary input expected');
          }
        }
      } catch (error: unknown) {
        // Invalid JSON, Zod failures and malformed binary frames are logged before closing the client socket.
        context.log.warn({ err: error, roomId: context.room?.id ?? null }, 'invalid_websocket_message');
        ws.close(getProtocolCloseCode(error), getErrorMessage(error).slice(0, 100));
        return;
      }

      switch (message.type) {
        case 'join': {
          if (context.room) leaveRoom(ws);
          const room = rooms.get(message.roomId);
          if (!room) { sendToClient(ws, { type: 'error', code: 'room_not_found' }, { critical: true }); return; }
          const protocol = message.protocol ?? 'binary';
          const player = room.join(ws, message.playerName, protocol);
          if (!player) { sendToClient(ws, { type: 'error', code: 'room_full' }, { critical: true }); return; }
          context.room = room;
          context.protocolMode = player.protocol;
          context.log = logger.child({ clientIp: context.clientIp, roomId: room.id, playerId: player.playerId });
          context.log.info({ playerName: player.name, protocol: player.protocol }, 'player_joined_room');
          if (context.joinTimer) clearTimeout(context.joinTimer);
          context.joinTimer = null;
          sendToClient(ws, {
            type: 'joined', room: room.summary, playerId: player.playerId,
            protocol: player.protocol, seed: room.seed, players: room.playerList,
            snapshot: room.snapshotFor(player),
          });
          room.broadcast({ type: 'system', text: `${player.name} joined` }, (client, payload) => sendToClient(client, payload));
          broadcastPlayers(room);
          room.startSimulation(publishSnapshots);
          return;
        }
        case 'leave':
          leaveRoom(ws);
          return;
        case 'input':
          if (!context.room) { sendToClient(ws, { type: 'error', code: 'join_required' }, { critical: true }); return; }
          // Old inputs can arrive after newer ones during jitter; the room ignores stale sequence numbers.
          context.room.acceptInput(ws, message);
          return;
        case 'chat': {
          if (!context.room) { sendToClient(ws, { type: 'error', code: 'join_required' }, { critical: true }); return; }
          const player = context.room.players.get(ws);
          if (context.room.chat(ws, message.message)) {
            context.log.info({ messageLength: message.message.length }, 'room_chat_message');
            context.room.broadcast({ type: 'chat', playerName: player?.name ?? 'Pilot', message: message.message }, (client, payload) => sendToClient(client, payload));
          }
          return;
        }
        default:
          assertNever(message, 'Unhandled client message');
      }
    });

    ws.on('close', (code, reason) => {
      if (context.joinTimer) clearTimeout(context.joinTimer);
      context.log.info({ code, reason: reason.toString() }, 'websocket_closed');
      leaveRoom(ws);
      ipLimiter.release(context.clientIp);
      clients.delete(ws);
      contexts.delete(ws);
      allowMessage.delete(ws);
    });
    ws.on('error', (error: Error) => context.log.error({ err: error }, 'websocket_error'));
  });

  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const context = contextOf(ws);
      if (!context) continue;
      if (!context.isAlive) {
        context.missedPongs += 1;
        if (context.missedPongs >= MAX_MISSED_PONGS) { ws.terminate(); continue; }
      }
      context.isAlive = false;
      ws.ping();
    }
  }, PING_INTERVAL_MS);
  heartbeat.unref();

  return {
    wss,
    clients,
    get connectionCount(): number { return clients.size; },
    close: async (): Promise<void> => {
      accepting = false;
      clearInterval(heartbeat);
      const current = [...clients];
      const closePromises = current.map((ws) => new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) { resolve(); return; }
        const finish = (): void => resolve();
        ws.once('close', finish);
        if (ws.readyState === WebSocket.OPEN) {
          const shutdownFrame = JSON.stringify({ type: 'shutdown', reason: 'server_shutdown' });
          metrics.recordMessage(Buffer.byteLength(shutdownFrame));
          ws.send(shutdownFrame, (error) => {
            if (error) { ws.terminate(); return; }
            if (ws.readyState === WebSocket.OPEN) ws.close(1001, 'server shutdown');
          });
        } else {
          ws.terminate();
        }
        const force = setTimeout(() => { ws.terminate(); resolve(); }, 1500);
        force.unref();
      }));
      await Promise.all(closePromises);
      for (const ws of clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
