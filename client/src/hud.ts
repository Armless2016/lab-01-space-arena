export interface HudElements {
  readonly root: HTMLElement;
  readonly playerName: HTMLElement;
  readonly roomName: HTMLElement;
  readonly hp: HTMLElement;
  readonly score: HTMLElement;
  readonly entities: HTMLElement;
  readonly steps: HTMLElement;
  readonly frames: HTMLElement;
  readonly frameTime: HTMLElement;
  readonly audioState: HTMLElement;
}
export interface NetworkStats {
  readonly hp?: number;
  readonly score?: number;
  readonly entities?: number;
  readonly players?: number;
  readonly stepsPerSecond?: number;
  readonly framesPerSecond?: number;
  readonly frameTimeMs?: number;
}

export function createHud(elements: HudElements) {
  return {
    show: () => { elements.root.hidden = false; },
    hide: () => { elements.root.hidden = true; },
    setPlayer: (name: string) => { elements.playerName.textContent = name; },
    setRoom: (name: string) => { elements.roomName.textContent = name; },
    setAudioState: (state: string) => { elements.audioState.textContent = state; },
    updateNetwork(stats: NetworkStats): void {
      elements.hp.textContent = String(stats.hp ?? 0);
      elements.score.textContent = String(stats.score ?? 0);
      elements.entities.textContent = String(stats.entities ?? stats.players ?? 0);
      elements.steps.textContent = String(stats.stepsPerSecond ?? 30);
      elements.frames.textContent = String(stats.framesPerSecond ?? 0);
      elements.frameTime.textContent = Number(stats.frameTimeMs ?? 0).toFixed(2);
    },
  };
}
