import { Buffer } from 'node:buffer';
import { decodeInputBinary } from '@space-arena/shared/protocol.js';

const TYPES = new Set(['join', 'leave', 'chat', 'input']);
const INPUT_KEYS = new Set(['type', 'seq', 'throttle', 'turn', 'fire']);

export function parseClientMessage(raw, maxBytes) {
  if (Buffer.byteLength(raw) > maxBytes) throw Object.assign(new Error('message too large'), { code: 1009 });
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('invalid JSON'), { code: 1008 });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !TYPES.has(value.type)) {
    throw Object.assign(new Error('unknown message type'), { code: 1008 });
  }
  if (value.type === 'join') {
    if (typeof value.roomId !== 'string' || typeof value.playerName !== 'string') {
      throw Object.assign(new Error('invalid join form'), { code: 1008 });
    }
    if (value.protocol !== undefined && !['json', 'binary'].includes(value.protocol)) {
      throw Object.assign(new Error('protocol must be json or binary'), { code: 1008 });
    }
  }
  if (value.type === 'chat') {
    if (typeof value.message !== 'string' || value.message.length > 500) {
      throw Object.assign(new Error('invalid chat form'), { code: 1008 });
    }
  }
  if (value.type === 'input') {
    const keys = Object.keys(value);
    if (keys.some((key) => !INPUT_KEYS.has(key))) {
      throw Object.assign(new Error('input may contain controls only; coordinates are not accepted'), { code: 1008 });
    }
    if (!Number.isInteger(value.seq) || value.seq < 0 || value.seq > 0xffffffff
      || !Number.isFinite(value.throttle) || value.throttle < -1 || value.throttle > 1
      || !Number.isFinite(value.turn) || value.turn < -1 || value.turn > 1
      || typeof value.fire !== 'boolean') {
      throw Object.assign(new Error('invalid input form'), { code: 1008 });
    }
  }
  return value;
}

export { decodeInputBinary };

export function sendJson(ws, payload) {
  if (ws.readyState !== 1) return false;
  ws.send(JSON.stringify(payload));
  return true;
}
