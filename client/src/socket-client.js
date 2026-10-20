import { decodeSnapshotBinary, encodeInputBinary } from '@space-arena/shared/protocol.js';

function frameSize(frame) {
  if (typeof frame === 'string') return new TextEncoder().encode(frame).byteLength;
  if (frame instanceof ArrayBuffer) return frame.byteLength;
  if (ArrayBuffer.isView(frame)) return frame.byteLength;
  return 0;
}

export class ReconnectingSocket extends EventTarget {
  #url;
  #socket = null;
  #queue = [];
  #attempt = 0;
  #timer = null;
  #stopped = false;
  #joined = null;
  #protocol = 'binary';

  constructor(url = '/ws', { maxQueue = 100, maxDelay = 8000 } = {}) {
    super();
    this.#url = url;
    this.maxQueue = maxQueue;
    this.maxDelay = maxDelay;
  }

  connect() {
    this.#stopped = false;
    this.#open();
  }

  join(roomId, playerName, protocol = 'binary') {
    this.#protocol = protocol === 'json' ? 'json' : 'binary';
    this.#joined = { roomId, playerName, protocol: this.#protocol };
    if (this.#socket?.readyState === WebSocket.OPEN) this.send({ type: 'join', ...this.#joined });
  }

  send(payload) {
    let frame;
    try {
      frame = payload?.type === 'input' && this.#protocol === 'binary'
        ? encodeInputBinary(payload)
        : JSON.stringify(payload);
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      return 0;
    }
    const bytes = frameSize(frame);
    if (this.#socket?.readyState === WebSocket.OPEN) {
      // Avoid letting a slow peer grow the browser's internal send queue forever.
      if (this.#socket.bufferedAmount > 64 * 1024 && payload?.type === 'input') return 0;
      this.#socket.send(frame);
      return bytes;
    }
    // Gameplay inputs are time-sensitive; replaying stale controls after reconnect
    // would advance the server's sequence beyond the new client's sequence.
    if (payload?.type === 'input') return 0;
    if (this.#queue.length >= this.maxQueue) this.#queue.shift();
    this.#queue.push(frame);
    return bytes;
  }

  close() {
    this.#stopped = true;
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#joined = null;
    this.#queue = [];
    this.#socket?.close(1000, 'client closed');
    this.#socket = null;
  }

  get bufferedAmount() {
    return this.#socket?.bufferedAmount ?? 0;
  }

  get protocol() {
    return this.#protocol;
  }

  #open() {
    if (this.#stopped || this.#socket) return;
    this.dispatchEvent(new CustomEvent('state', { detail: { state: 'connecting' } }));
    const socket = new WebSocket(this.#url);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    socket.addEventListener('open', () => {
      this.#attempt = 0;
      this.dispatchEvent(new CustomEvent('state', { detail: { state: 'open' } }));
      if (this.#joined) this.send({ type: 'join', ...this.#joined });
      this.#flush();
    });
    socket.addEventListener('message', (event) => {
      try {
        let message;
        let bytes;
        if (event.data instanceof ArrayBuffer || ArrayBuffer.isView(event.data)) {
          bytes = frameSize(event.data);
          message = decodeSnapshotBinary(event.data);
        } else {
          bytes = frameSize(String(event.data));
          message = JSON.parse(event.data);
        }
        this.dispatchEvent(new CustomEvent('message', {
          detail: { ...message, __transportBytes: bytes },
        }));
      } catch (error) {
        this.dispatchEvent(new CustomEvent('error', { detail: { error: new Error(`Invalid server frame: ${error.message}`) } }));
      }
    });
    socket.addEventListener('error', () => {
      this.dispatchEvent(new CustomEvent('state', { detail: { state: 'error' } }));
    });
    socket.addEventListener('close', (event) => {
      if (this.#socket === socket) this.#socket = null;
      this.dispatchEvent(new CustomEvent('state', { detail: { state: 'closed', code: event.code, reason: event.reason } }));
      if (!this.#stopped && event.code !== 1008 && event.code !== 1009) this.#scheduleReconnect();
    });
  }

  #flush() {
    while (this.#queue.length && this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(this.#queue.shift());
    }
  }

  #scheduleReconnect() {
    clearTimeout(this.#timer);
    const base = Math.min(this.maxDelay, 250 * 2 ** this.#attempt);
    const jitter = Math.random() * 180;
    const delay = base + jitter;
    this.#attempt += 1;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#open();
    }, delay);
    this.dispatchEvent(new CustomEvent('state', { detail: { state: 'reconnecting', delay } }));
  }
}
