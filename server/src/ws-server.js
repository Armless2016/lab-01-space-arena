import { WebSocketServer } from 'ws';
import { parseClientMessage, sendJson } from './protocol.js';

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

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.isAlive = true;
    ws.missedPongs = 0;
    ws.room = null;
    ws.joinTimer = setTimeout(() => {
      if (!ws.room) ws.close(1008, 'join required within 5 seconds');
    }, JOIN_TIMEOUT_MS);
    allowMessage.set(ws, installRateLimit(ws, config.maxMessagesPerSecond));

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.missedPongs = 0;
    });

    ws.on('message', (data) => {
      if (!allowMessage.get(ws)()) {
        ws.close(1008, 'message rate limit exceeded');
        return;
      }
      let message;
      try {
        message = parseClientMessage(data.toString(), config.wsMaxPayload);
      } catch (error) {
        ws.close(error.code || 1008, error.message);
        return;
      }

      if (message.type === 'join') {
        const room = rooms.get(message.roomId);
        if (!room) return sendJson(ws, { type: 'error', code: 'room_not_found' });
        if (!room.join(ws, message.playerName)) return sendJson(ws, { type: 'error', code: 'room_full' });
        ws.room = room;
        clearTimeout(ws.joinTimer);
        ws.joinTimer = null;
        room.record({ type: 'join', playerName: room.players.get(ws).name });
        room.broadcast({ type: 'system', text: `${room.players.get(ws).name} joined` }, (client, payload) => sendToClient(client, payload));
        sendJson(ws, { type: 'joined', room: room.summary });
        return;
      }

      if (message.type === 'leave') {
        leaveRoom(ws);
        return;
      }

      if (message.type === 'chat') {
        if (!ws.room) return sendJson(ws, { type: 'error', code: 'join_required' });
        const playerName = ws.room.players.get(ws)?.name || 'Pilot';
        ws.room.chat(ws, message.message);
        ws.room.record({ type: 'chat', playerName, message: message.message });
        ws.room.broadcast({ type: 'chat', playerName, message: message.message }, (client, payload) => sendToClient(client, payload));
      }
    });

    ws.on('close', () => {
      clearTimeout(ws.joinTimer);
      leaveRoom(ws);
      clients.delete(ws);
    });
    ws.on('error', (error) => {
      console.error('[ws]', error);
    });
  });

  function sendToClient(ws, payload, { critical = false } = {}) {
    if (ws.readyState !== 1) return false;
    if (!critical && ws.bufferedAmount > HIGH_WATER_MARK) return false;
    return sendJson(ws, payload);
  }

  function leaveRoom(ws) {
    const room = ws.room;
    if (!room) return;
    const player = room.players.get(ws);
    room.leave(ws);
    room.record({ type: 'leave', playerName: player?.name || 'Pilot' });
    room.broadcast({ type: 'system', text: `${player?.name || 'Pilot'} left` }, (client, payload) => sendToClient(client, payload));
    ws.room = null;
    rooms.removeIfEmpty(room);
  }

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
