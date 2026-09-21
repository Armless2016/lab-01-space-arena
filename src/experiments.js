function summarize(values) {
  if (values.length === 0) {
    return { average: 0, min: 0, max: 0, stdDev: 0 };
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;

  return {
    average,
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev: Math.sqrt(variance),
  };
}

export function runBlockingExperiment(blockMs = 500) {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const start = performance.now();
      let now = start;

      while (now - start < blockMs) {
        now = performance.now();
      }

      const finishedBlockingAt = performance.now();

      requestAnimationFrame((nextFrameTimestamp) => {
        const gap = nextFrameTimestamp - start;
        const skipped60HzFrames = Math.max(0, gap / (1000 / 60) - 1);

        resolve({
          blockMsRequested: blockMs,
          blockMsActual: finishedBlockingAt - start,
          nextFrameGapMs: gap,
          skipped60HzFrames,
        });
      });
    });
  });
}

export function runIntervalExperiment(durationMs = 3000, intervalMs = 1000 / 60) {
  return new Promise((resolve) => {
    const start = performance.now();
    let previous = start;
    const intervals = [];
    let callbacks = 0;

    const id = window.setInterval(() => {
      const now = performance.now();
      callbacks += 1;
      intervals.push(now - previous);
      previous = now;

      if (now - start >= durationMs) {
        window.clearInterval(id);
        const elapsed = now - start;
        const stats = summarize(intervals);

        resolve({
          requestedIntervalMs: intervalMs,
          elapsedMs: elapsed,
          callbacks,
          callbacksPerSecond: (callbacks * 1000) / elapsed,
          averageIntervalMs: stats.average,
          minIntervalMs: stats.min,
          maxIntervalMs: stats.max,
          jitterStdDevMs: stats.stdDev,
        });
      }
    }, intervalMs);
  });
}

function simulateVariableStep(fps, durationSeconds) {
  const dt = 1 / fps;
  const acceleration = 100;
  let x = 0;
  let v = 0;

  for (let elapsed = 0; elapsed < durationSeconds - 1e-12; elapsed += dt) {
    v += acceleration * dt;
    x += v * dt;
  }

  return { x, v };
}

function simulateFixedStep(renderFps, durationSeconds) {
  const fixedDt = 1 / 60;
  const renderDt = 1 / renderFps;
  const acceleration = 100;
  let x = 0;
  let v = 0;
  let accumulator = 0;

  for (let elapsed = 0; elapsed < durationSeconds - 1e-12; elapsed += renderDt) {
    accumulator += renderDt;

    while (accumulator >= fixedDt) {
      v += acceleration * fixedDt;
      x += v * fixedDt;
      accumulator -= fixedDt;
    }
  }

  return { x, v };
}

export function runVariableStepExperiment(durationSeconds = 2) {
  const fpsValues = [30, 60, 120];

  return fpsValues.map((fps) => {
    const variable = simulateVariableStep(fps, durationSeconds);
    const fixed = simulateFixedStep(fps, durationSeconds);

    return {
      renderFps: fps,
      variablePosition: variable.x,
      fixedPosition: fixed.x,
      variableVelocity: variable.v,
      fixedVelocity: fixed.v,
    };
  });
}
