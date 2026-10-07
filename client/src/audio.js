export function createAudioSystem() {
  let context = null;
  const buffers = new Map();

  async function unlock() {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context;
  }

  function setBuffer(name, buffer) {
    buffers.set(name, buffer);
  }

  function play(name, { volume = 0.2, rate = 1 } = {}) {
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
    unlock,
    setBuffer,
    play,
    get state() {
      return context?.state ?? 'locked';
    },
  };
}
