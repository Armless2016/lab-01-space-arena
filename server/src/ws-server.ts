import type { IncomingMessage } from 'node:http';
import { Buffer } from 'node:buffer';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { ServerMessageSchema } from '@space-arena/shared/schemas';
import { assertNever, type InputMessage } from '@space-arena/shared/types';
import { encodeSnapshotBinary } from '@space-arena/shared/protocol';
import { decodeInputBinary } from '@space-arena/shared/protocol';
import { getErrorMessage, getProtocolCloseCode, parseClientMessage, sendJson } from './protocol.ts';
import type { Room, RoomManager, RoomPlayer } from './rooms.ts';
import type { ServerConfig } from './config.ts';

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

export function attachWebSocketServer(httpServer: import('node:http').Server, options: { rooms: RoomManager; config: ServerConfig }) {
  const { rooms, config } = options;
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.wsMaxPayload });
  const clients = new Set<WebSocket>();
  const contexts = new WeakMap<WebSocket, SocketContext>();
  const allowMessage = new WeakMap<WebSocket, () => boolean>();

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
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
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  function contextOf(ws: WebSocket): SocketContext | undefined { return contexts.get(ws); }

  function installRateLimit(): () => boolean {
    let windowStart = Date.now();
    let count = 0;
    return () => {
      const now = Date.now();
      if (now - windowStart >= 1000) { windowStart = now; count = 0; }
      count += 1;
      return count <= config.maxMessagesPerSecond;
    };
  }

  function sendToClient(ws: WebSocket, payload: unknown, sendOptions: SendOptions = {}): boolean {
    if (ws.readyState !== WebSocket.OPEN) return false;
    if (!sendOptions.critical && ws.bufferedAmount > HIGH_WATER_MARK) return false;
    const context = contextOf(ws);
    const player: RoomPlayer | undefined = context?.room?.players.get(ws);
    const snapshot = ServerMessageSchema.safeParse(payload);
    if (snapshot.success && snapshot.data.type === 'snapshot' && player?.protocol === 'binary') {
      ws.send(encodeSnapshotBinary(snapshot.data), { binary: true });
      return true;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }

  function broadcastPlayers(room: Room): void {
    room.broadcast({ type: 'players', players: room.playerList }, (client, payload) => sendToClient(client, payload, { critical: true }));
  }

  function publishSnapshots(room: Room): void {
    for (const [client, player] of room.players) {
      if (client.readyState !== WebSocket.OPEN || client.bufferedAmount > HIGH_WATER_MARK) continue;
      const snapshot = room.snapshotFor(player);
      if (player.protocol === 'binary') client.send(encodeSnapshotBinary(snapshot), { binary: true });
      else client.send(JSON.stringify(snapshot));
    }
  }

  function leaveRoom(ws: WebSocket): void {
    const context = contextOf(ws);
    const room = context?.room;
    if (!room || !context) return;
    const player = room.leave(ws);
    if (!player) { context.room = null; return; }
    room.broadcast({ type: 'system', text: `${player.name} left` }, (client, payload) => sendToClient(client, payload));
    context.room = null;
    broadcastPlayers(room);
    void rooms.removeIfEmpty(room);
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    contexts.set(ws, { room: null, protocolMode: null, joinTimer: null, isAlive: true, missedPongs: 0 });
    const context = contextOf(ws);
    if (!context) return;
    context.joinTimer = setTimeout(() => {
      if (!context.room && ws.readyState === WebSocket.OPEN) ws.close(1008, 'join required within 5 seconds');
    }, JOIN_TIMEOUT_MS);
    allowMessage.set(ws, installRateLimit());

    ws.on('pong', () => {
      context.isAlive = true;
      context.missedPongs = 0;
    });

    ws.on('message', (data: RawData, isBinary: boolean) => {
      const rateCheck = allowMessage.get(ws);
      if (!rateCheck || !rateCheck()) { ws.close(1008, 'message rate limit exceeded'); return; }
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
        console.warn('[protocol] closing invalid client message:', getErrorMessage(error));
        ws.close(getProtocolCloseCode(error), getErrorMessage(error).slice(0, 100));
        return;
      }

      switch (message.type) {
        case 'join': {
          if (context.room) leaveRoom(ws);
          const room = rooms.get(message.roomId);
          if (!room) { sendJson(ws, { type: 'error', code: 'room_not_found' }); return; }
          const protocol = message.protocol ?? 'binary';
          const player = room.join(ws, message.playerName, protocol);
          if (!player) { sendJson(ws, { type: 'error', code: 'room_full' }); return; }
          context.room = room;
          context.protocolMode = player.protocol;
          if (context.joinTimer) clearTimeout(context.joinTimer);
          context.joinTimer = null;
          sendJson(ws, {
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
          if (!context.room) { sendJson(ws, { type: 'error', code: 'join_required' }); return; }
          // Old inputs can arrive after newer ones during jitter; the room ignores stale sequence numbers.
          context.room.acceptInput(ws, message);
          return;
        case 'chat': {
          if (!context.room) { sendJson(ws, { type: 'error', code: 'join_required' }); return; }
          const player = context.room.players.get(ws);
          if (context.room.chat(ws, message.message)) {
            context.room.broadcast({ type: 'chat', playerName: player?.name ?? 'Pilot', message: message.message }, (client, payload) => sendToClient(client, payload));
          }
          return;
        }
        default:
          assertNever(message, 'Unhandled client message');
      }
    });

    ws.on('close', () => {
      if (context.joinTimer) clearTimeout(context.joinTimer);
      leaveRoom(ws);
      clients.delete(ws);
      contexts.delete(ws);
      allowMessage.delete(ws);
    });
    ws.on('error', (error: Error) => console.error('[ws]', error));
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
    close: async (): Promise<void> => {
      clearInterval(heartbeat);
      for (const ws of clients) ws.close(1001, 'server shutdown');
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
