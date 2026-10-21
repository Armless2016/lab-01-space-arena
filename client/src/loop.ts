export function createLoop({ step = 1 / 60, update, render, onStats, maxStepsPerFrame = 8 }) {
  let running = false;
  let frameId = 0;
  let previousTime = null;
  let accumulator = 0;
  let frames = 0;
  let steps = 0;
  let statsStart = 0;

  function frame(timestamp) {
    if (!running) return;

    if (previousTime === null) {
      previousTime = timestamp;
      statsStart = timestamp;
    }

    const frameDelta = Math.min((timestamp - previousTime) / 1000, 0.25);
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

    const alpha = accumulator / step;
    render(alpha, frameDelta);
    frames += 1;

    const statsElapsed = timestamp - statsStart;
    if (statsElapsed >= 1000) {
      onStats?.({
        stepsPerSecond: Math.round((steps * 1000) / statsElapsed),
        framesPerSecond: Math.round((frames * 1000) / statsElapsed),
        frameTimeMs: frameDelta * 1000,
      });
      steps = 0;
      frames = 0;
      statsStart = timestamp;
    }

    frameId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      previousTime = null;
      accumulator = 0;
      frameId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frameId);
    },
  };
}
