export class ReconnectingSocket extends EventTarget {
  #url;
  #socket = null;
  #queue = [];
  #attempt = 0;
  #timer = null;
  #stopped = false;
  #joined = null;

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

  join(roomId, playerName) {
    this.#joined = { roomId, playerName };
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'join', roomId, playerName });
    }
  }

  send(payload) {
    const message = JSON.stringify(payload);
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(message);
      return;
    }
    if (this.#queue.length >= this.maxQueue) this.#queue.shift();
    this.#queue.push(message);
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

  #open() {
    if (this.#stopped || this.#socket) return;
    this.dispatchEvent(new CustomEvent('state', { detail: { state: 'connecting' } }));
    const socket = new WebSocket(this.#url);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      this.#attempt = 0;
      this.dispatchEvent(new CustomEvent('state', { detail: { state: 'open' } }));
      if (this.#joined) this.send({ type: 'join', ...this.#joined });
      this.#flush();
    });
    socket.addEventListener('message', (event) => {
      try {
        this.dispatchEvent(new CustomEvent('message', { detail: JSON.parse(event.data) }));
      } catch {
        this.dispatchEvent(new CustomEvent('error', { detail: { error: new Error('Invalid server JSON') } }));
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
