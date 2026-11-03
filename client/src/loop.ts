export interface LoopStats {
  readonly stepsPerSecond: number;
  readonly framesPerSecond: number;
  readonly frameTimeMs: number;
}

export interface LoopOptions {
  readonly step?: number;
  readonly update: (dt: number) => void;
  readonly render: (alpha: number, frameDelta: number) => void;
  readonly onStats?: (stats: LoopStats) => void;
  readonly maxStepsPerFrame?: number;
}

export function createLoop({ step = 1 / 60, update, render, onStats, maxStepsPerFrame = 8 }: LoopOptions) {
  let running = false;
  let frameId = 0;
  let previousTime: number | null = null;
  let accumulator = 0;
  let frames = 0;
  let steps = 0;
  let statsStart = 0;

  function frame(timestamp: number): void {
    if (!running) return;
    if (previousTime === null) {
      previousTime = timestamp;
      statsStart = timestamp;
    }
    const frameDelta = Math.min(Math.max(0, (timestamp - previousTime) / 1000), 0.25);
    previousTime = timestamp;
    accumulator += frameDelta;
    let stepsThisFrame = 0;
    while (accumulator >= step && stepsThisFrame < maxStepsPerFrame) {
      update(step);
      accumulator -= step;
      stepsThisFrame += 1;
      steps += 1;
    }
    if (stepsThisFrame === maxStepsPerFrame) accumulator = 0;
    render(accumulator / step, frameDelta);
    frames += 1;
    const elapsed = timestamp - statsStart;
    if (elapsed >= 1000) {
      onStats?.({
        stepsPerSecond: Math.round((steps * 1000) / elapsed),
        framesPerSecond: Math.round((frames * 1000) / elapsed),
        frameTimeMs: frameDelta * 1000,
      });
      steps = 0;
      frames = 0;
      statsStart = timestamp;
    }
    frameId = requestAnimationFrame(frame);
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      previousTime = null;
      accumulator = 0;
      frameId = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(frameId);
    },
  };
}
