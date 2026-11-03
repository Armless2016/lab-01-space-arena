import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLoop } from '../src/loop.ts';

describe('fixed-step requestAnimationFrame loop', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextId: number;
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;

  function installRaf(): void {
    callbacks = new Map(); nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextId++; callbacks.set(id, callback); return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { callbacks.delete(id); });
  }
  function flush(timestamp: number): void {
    const first = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!first) throw new Error('No scheduled animation frame');
    callbacks.delete(first[0]); first[1](timestamp);
  }
  afterEach(() => {
    vi.useRealTimers(); vi.unstubAllGlobals();
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  });

  it('schedules a frame when started', () => {
    installRaf(); const loop = createLoop({ update: () => {}, render: () => {} });
    loop.start(); expect(callbacks.size).toBe(1); loop.stop();
  });
  it('does not start duplicate animation loops', () => {
    installRaf(); const loop = createLoop({ update: () => {}, render: () => {} });
    loop.start(); loop.start(); expect(callbacks.size).toBe(1); loop.stop();
  });
  it('renders the initial frame without a simulation update', () => {
    installRaf(); const update = vi.fn(); const render = vi.fn();
    const loop = createLoop({ update, render }); loop.start(); flush(0);
    expect(update).not.toHaveBeenCalled(); expect(render).toHaveBeenCalledWith(0, 0); loop.stop();
  });
  it('runs one 60 Hz simulation step after one frame interval', () => {
    installRaf(); const update = vi.fn(); const loop = createLoop({ update, render: () => {} });
    loop.start(); flush(0); flush(1000 / 60); expect(update).toHaveBeenCalledTimes(1); loop.stop();
  });
  it('uses a fixed dt independent of render timestamp', () => {
    installRaf(); const update = vi.fn(); const loop = createLoop({ step: 0.02, update, render: () => {} });
    loop.start(); flush(0); flush(20); expect(update).toHaveBeenLastCalledWith(0.02); loop.stop();
  });
  it('passes interpolation alpha to render', () => {
    installRaf(); const render = vi.fn(); const loop = createLoop({ step: 0.02, update: () => {}, render });
    loop.start(); flush(0); flush(10); expect(render.mock.calls.at(-1)?.[0]).toBeCloseTo(0.5); loop.stop();
  });
  it('caps catch-up steps and prevents a spiral of death', () => {
    installRaf(); const update = vi.fn(); const loop = createLoop({ update, render: () => {}, maxStepsPerFrame: 3 });
    loop.start(); flush(0); flush(250); expect(update).toHaveBeenCalledTimes(3); loop.stop();
  });
  it('clamps negative frame deltas to zero', () => {
    installRaf(); const update = vi.fn(); const loop = createLoop({ update, render: () => {} });
    loop.start(); flush(10); flush(5); expect(update).not.toHaveBeenCalled(); loop.stop();
  });
  it('reports frame statistics after one second', () => {
    installRaf(); const onStats = vi.fn(); const loop = createLoop({ update: () => {}, render: () => {}, onStats });
    loop.start(); flush(0); flush(500); flush(1000);
    expect(onStats).toHaveBeenCalledTimes(1); expect(onStats.mock.calls[0]?.[0].framesPerSecond).toBe(3); loop.stop();
  });
  it('stops scheduling frames after stop', () => {
    installRaf(); const loop = createLoop({ update: () => {}, render: () => {} });
    loop.start(); flush(0); loop.stop(); expect(callbacks.size).toBe(0);
  });
  it('can restart after stop', () => {
    installRaf(); const loop = createLoop({ update: () => {}, render: () => {} });
    loop.start(); loop.stop(); loop.start(); expect(callbacks.size).toBe(1); loop.stop();
  });
  it('uses fake timers alongside a controlled RAF queue', () => {
    vi.useFakeTimers(); installRaf(); const loop = createLoop({ update: () => {}, render: () => {} });
    loop.start(); expect(vi.isFakeTimers()).toBe(true); expect(callbacks.size).toBe(1); loop.stop();
  });
});
