export type GameEventName = 'fired' | 'hit' | 'exploded' | 'pickup' | 'respawned';
export type GameEventDetail = Readonly<Record<string, unknown>>;
export const gameEvents = new EventTarget();

export function emitGameEvent(type: GameEventName, detail: GameEventDetail = {}): void {
  gameEvents.dispatchEvent(new CustomEvent<GameEventDetail>(type, { detail }));
}

export function listenDetail<T>(target: EventTarget, type: string, listener: (detail: T) => void): void {
  target.addEventListener(type, (event: Event) => {
    if (event instanceof CustomEvent) listener(event.detail as T); // CustomEvent carries the typed detail for this internal event bus.
  });
}
