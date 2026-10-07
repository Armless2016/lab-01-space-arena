export const gameEvents = new EventTarget();

export function emitGameEvent(type, detail = {}) {
  gameEvents.dispatchEvent(new CustomEvent(type, { detail }));
}
