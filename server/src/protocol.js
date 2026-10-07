const TYPES = new Set(['join', 'leave', 'chat']);

export function parseClientMessage(raw, maxBytes) {
  if (Buffer.byteLength(raw) > maxBytes) throw Object.assign(new Error('message too large'), { code: 1009 });
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('invalid JSON'), { code: 1008 });
  }
  if (!value || typeof value !== 'object' || !TYPES.has(value.type)) {
    throw Object.assign(new Error('unknown message type'), { code: 1008 });
  }
  if (value.type === 'join') {
    if (typeof value.roomId !== 'string' || typeof value.playerName !== 'string') {
      throw Object.assign(new Error('invalid join form'), { code: 1008 });
    }
  }
  if (value.type === 'chat') {
    if (typeof value.message !== 'string' || value.message.length > 500) {
      throw Object.assign(new Error('invalid chat form'), { code: 1008 });
    }
  }
  return value;
}

export function sendJson(ws, payload) {
  if (ws.readyState !== 1) return false;
  ws.send(JSON.stringify(payload));
  return true;
}
