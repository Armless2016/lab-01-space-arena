import { WebSocketServer } from 'ws';
import { encodeSnapshotBinary } from '@space-arena/shared/protocol.js';
import { decodeInputBinary, parseClientMessage, sendJson } from './protocol.js';

const JOIN_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 15000;
const MAX_MISSED_PONGS = 2;
const HIGH_WATER_MARK = 64 * 1024;

function installRateLimit(socket, limit) {
  socket.rateWindowStart = Date.now();
  socket.rateCount = 0;
  return () => {
    const now = Date.now();
    if (now - socket.rateWindowStart >= 1000) {
      socket.rateWindowStart = now;
      socket.rateCount = 0;
    }
    socket.rateCount += 1;
    return socket.rateCount <= limit;
  };
}

export function attachWebSocketServer(httpServer, { rooms, config }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.wsMaxPayload });
  const clients = new Set();
  const allowMessage = new WeakMap();

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
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

  function sendToClient(ws, payload, { critical = false } = {}) {
    if (ws.readyState !== 1) return false;
    if (!critical && ws.bufferedAmount > HIGH_WATER_MARK) return false;
    const record = ws.room?.players.get(ws);
    if (payload.type === 'snapshot' && record?.protocol === 'binary') {
      ws.send(encodeSnapshotBinary(payload), { binary: true });
      return true;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }

  function broadcastPlayers(room) {
    room.broadcast({ type: 'players', players: room.playerList }, (client, payload) => sendToClient(client, payload, { critical: true }));
  }

  function publishSnapshots(room) {
    for (const [client, player] of room.players) {
      if (client.readyState !== 1 || client.bufferedAmount > HIGH_WATER_MARK) continue;
      const snapshot = room.snapshotFor(player);
      if (player.protocol === 'binary') client.send(encodeSnapshotBinary(snapshot), { binary: true });
      else client.send(JSON.stringify(snapshot));
    }
  }

  function leaveRoom(ws) {
    const room = ws.room;
    if (!room) return;
    const player = room.leave(ws);
    if (!player) {
      ws.room = null;
      return;
    }
    room.broadcast({ type: 'system', text: `${player.name} left` }, (client, payload) => sendToClient(client, payload));
    ws.room = null;
    broadcastPlayers(room);
    void rooms.removeIfEmpty(room);
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.isAlive = true;
    ws.missedPongs = 0;
    ws.room = null;
    ws.protocolMode = null;
    ws.joinTimer = setTimeout(() => {
      if (!ws.room) ws.close(1008, 'join required within 5 seconds');
    }, JOIN_TIMEOUT_MS);
    allowMessage.set(ws, installRateLimit(ws, config.maxMessagesPerSecond));

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.missedPongs = 0;
    });

    ws.on('message', (data, isBinary) => {
      if (!allowMessage.get(ws)()) {
        ws.close(1008, 'message rate limit exceeded');
        return;
      }
      let message;
      try {
        if (isBinary) {
          if (ws.protocolMode !== 'binary' || !ws.room) throw Object.assign(new Error('binary input not negotiated'), { code: 1008 });
          message = decodeInputBinary(data);
        } else {
          message = parseClientMessage(data.toString(), config.wsMaxPayload);
          if (message.type === 'input' && ws.protocolMode === 'binary') {
            throw Object.assign(new Error('binary input expected'), { code: 1008 });
          }
        }
      } catch (error) {
        ws.close(error.code || 1008, String(error.message || 'invalid message').slice(0, 100));
        return;
      }

      if (message.type === 'join') {
        if (ws.room) leaveRoom(ws);
        const room = rooms.get(message.roomId);
        if (!room) {
          sendJson(ws, { type: 'error', code: 'room_not_found' });
          return;
        }
        const player = room.join(ws, message.playerName, message.protocol || 'binary');
        if (!player) {
          sendJson(ws, { type: 'error', code: 'room_full' });
          return;
        }
        ws.room = room;
        ws.protocolMode = player.protocol;
        clearTimeout(ws.joinTimer);
        ws.joinTimer = null;
        sendJson(ws, {
          type: 'joined',
          room: room.summary,
          playerId: player.playerId,
          protocol: player.protocol,
          seed: room.seed,
          players: room.playerList,
          snapshot: room.snapshotFor(player),
        });
        room.broadcast({ type: 'system', text: `${player.name} joined` }, (client, payload) => sendToClient(client, payload));
        broadcastPlayers(room);
        room.startSimulation(publishSnapshots);
        return;
      }

      if (message.type === 'leave') {
        leaveRoom(ws);
        return;
      }

      if (message.type === 'input') {
        if (!ws.room) {
          sendJson(ws, { type: 'error', code: 'join_required' });
          return;
        }
        // Jitter may reorder frames. Stale sequences are ignored, not treated as fatal.
        ws.room.acceptInput(ws, message);
        return;
      }

      if (message.type === 'chat') {
        if (!ws.room) {
          sendJson(ws, { type: 'error', code: 'join_required' });
          return;
        }
        const player = ws.room.players.get(ws);
        if (ws.room.chat(ws, message.message)) {
          ws.room.broadcast({ type: 'chat', playerName: player?.name || 'Pilot', message: message.message }, (client, payload) => sendToClient(client, payload));
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(ws.joinTimer);
      leaveRoom(ws);
      clients.delete(ws);
    });
    ws.on('error', (error) => console.error('[ws]', error));
  });

  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (ws.readyState !== 1) continue;
      if (!ws.isAlive) {
        ws.missedPongs += 1;
        if (ws.missedPongs >= MAX_MISSED_PONGS) {
          ws.terminate();
          continue;
        }
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, PING_INTERVAL_MS);
  heartbeat.unref?.();

  return {
    wss,
    clients,
    close: async () => {
      clearInterval(heartbeat);
      for (const ws of clients) ws.close(1001, 'server shutdown');
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}
