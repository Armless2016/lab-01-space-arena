import { fetchJson } from './asset-loader.js';

function mergeSignals(signals) {
  if (AbortSignal.any) return AbortSignal.any(signals.filter(Boolean));
  const controller = new AbortController();
  const abort = (event) => controller.abort(event.target.reason);
  for (const signal of signals.filter(Boolean)) signal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

export class Lobby extends EventTarget {
  #controller = null;
  #timer = null;
  #rooms = [];
  #visible = false;

  constructor({ url = '/api/rooms', intervalMs = 3000 } = {}) {
    super();
    this.url = url;
    this.intervalMs = intervalMs;
  }

  get rooms() {
    return [...this.#rooms];
  }

  async start() {
    this.stop();
    this.#visible = true;
    this.#controller = new AbortController();
    await this.refresh();
    if (!this.#visible) return;
    this.#timer = setInterval(() => {
      void this.refresh();
    }, this.intervalMs);
  }

  async refresh() {
    if (!this.#visible || !this.#controller) return;
    const timeout = AbortSignal.timeout(2200);
    const signal = mergeSignals([this.#controller.signal, timeout]);

    try {
      const rooms = await fetchJson(this.url, { signal, retries: 0 });
      this.#rooms = Array.isArray(rooms) ? rooms : [];
      this.dispatchEvent(new CustomEvent('rooms', { detail: { rooms: this.rooms } }));
    } catch (error) {
      if (this.#visible) {
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      }
    }
  }

  join(roomId, playerName) {
    const room = this.#rooms.find((candidate) => candidate.id === roomId);
    if (!room) {
      this.dispatchEvent(new CustomEvent('error', { detail: { error: new Error('Room not found') } }));
      return;
    }

    this.stop();
    this.dispatchEvent(new CustomEvent('join', {
      detail: {
        room: { ...room },
        playerName: playerName.trim() || 'Pilot',
      },
    }));
  }

  leave() {
    this.dispatchEvent(new CustomEvent('leave'));
    this.stop();
  }

  stop() {
    this.#visible = false;
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
    this.#controller?.abort(new DOMException('Lobby hidden', 'AbortError'));
    this.#controller = null;
  }
}
