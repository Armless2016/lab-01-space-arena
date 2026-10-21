export interface AudioSystem {
  unlock(): Promise<AudioContext>;
  setBuffer(name: string, buffer: AudioBuffer): void;
  play(name: string, options?: { readonly volume?: number; readonly rate?: number }): void;
  readonly state: AudioContextState | 'locked';
}

export function createAudioSystem(): AudioSystem {
  let context: AudioContext | null = null;
  const buffers = new Map<string, AudioBuffer>();

  async function unlock(): Promise<AudioContext> {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context;
  }

  function setBuffer(name: string, buffer: AudioBuffer): void {
    buffers.set(name, buffer);
  }

  function play(name: string, { volume = 0.2, rate = 1 }: { readonly volume?: number; readonly rate?: number } = {}): void {
    const buffer = buffers.get(name);
    if (!context || !buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  return {
    unlock, setBuffer, play,
    get state() { return context?.state ?? 'locked'; },
  };
}
