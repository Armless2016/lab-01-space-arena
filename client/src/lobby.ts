import { fetchJson } from './asset-loader.ts';

export interface LobbyRoom {
  readonly id: string;
  readonly name: string;
  readonly players: number;
  readonly maxPlayers: number;
  readonly width: number;
  readonly height: number;
  readonly asteroids: number;
  readonly enemies: number;
}
export interface LobbyRoomsDetail { readonly rooms: readonly LobbyRoom[] }
export interface LobbyErrorDetail { readonly error: unknown }
export interface LobbyJoinDetail { readonly room: LobbyRoom; readonly playerName: string }

interface LobbyOptions { readonly url?: string; readonly intervalMs?: number }

function mergeSignals(signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const available = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(available);
  const controller = new AbortController();
  const abort = (event: Event): void => {
    const signal = event.currentTarget;
    if (signal instanceof AbortSignal) controller.abort(signal.reason);
  };
  for (const signal of available) signal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function parseRooms(value: unknown): LobbyRoom[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is LobbyRoom => {
    if (typeof item !== 'object' || item === null) return false;
    return 'id' in item && typeof item.id === 'string'
      && 'name' in item && typeof item.name === 'string'
      && 'players' in item && typeof item.players === 'number'
      && 'maxPlayers' in item && typeof item.maxPlayers === 'number'
      && 'width' in item && typeof item.width === 'number'
      && 'height' in item && typeof item.height === 'number'
      && 'asteroids' in item && typeof item.asteroids === 'number'
      && 'enemies' in item && typeof item.enemies === 'number';
  });
}

export class Lobby extends EventTarget {
  #controller: AbortController | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #rooms: LobbyRoom[] = [];
  #visible = false;
  readonly url: string;
  readonly intervalMs: number;

  constructor({ url = '/api/rooms', intervalMs = 3000 }: LobbyOptions = {}) {
    super();
    this.url = url;
    this.intervalMs = intervalMs;
  }

  get rooms(): LobbyRoom[] { return [...this.#rooms]; }

  async start(): Promise<void> {
    this.stop();
    this.#visible = true;
    this.#controller = new AbortController();
    await this.refresh();
    if (!this.#visible) return;
    this.#timer = setInterval(() => { void this.refresh(); }, this.intervalMs);
  }

  async refresh(): Promise<void> {
    const controller = this.#controller;
    if (!this.#visible || !controller) return;
    const timeout = AbortSignal.timeout(2200);
    const signal = mergeSignals([controller.signal, timeout]);
    try {
      const value = await fetchJson(this.url, { signal, retries: 0 });
      this.#rooms = parseRooms(value);
      this.dispatchEvent(new CustomEvent<LobbyRoomsDetail>('rooms', { detail: { rooms: this.rooms } }));
    } catch (error: unknown) {
      if (this.#visible) this.dispatchEvent(new CustomEvent<LobbyErrorDetail>('error', { detail: { error } }));
    }
  }

  join(roomId: string, playerName: string): void {
    const room = this.#rooms.find((candidate) => candidate.id === roomId);
    if (!room) {
      this.dispatchEvent(new CustomEvent<LobbyErrorDetail>('error', { detail: { error: new Error('Room not found') } }));
      return;
    }
    this.stop();
    this.dispatchEvent(new CustomEvent<LobbyJoinDetail>('join', {
      detail: { room: { ...room }, playerName: playerName.trim() || 'Pilot' },
    }));
  }

  leave(): void {
    this.dispatchEvent(new Event('leave'));
    this.stop();
  }

  stop(): void {
    this.#visible = false;
    if (this.#timer !== null) clearInterval(this.#timer);
    this.#timer = null;
    this.#controller?.abort(new DOMException('Lobby hidden', 'AbortError'));
    this.#controller = null;
  }
}
