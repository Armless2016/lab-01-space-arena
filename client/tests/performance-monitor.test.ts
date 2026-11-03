import { describe, expect, it } from 'vitest';
import { FramePerformanceMonitor, summarizeFrameTimes } from '../src/performance-monitor.ts';

describe('frame performance telemetry', () => {
  it('calculates median and tail percentiles', () => {
    expect(summarizeFrameTimes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({ samples: 10, p50: 5, p95: 10, p99: 10 });
  });
  it('returns zero percentiles for an empty sample', () => {
    expect(summarizeFrameTimes([])).toEqual({ samples: 0, p50: 0, p95: 0, p99: 0 });
  });
  it('ignores non-finite frame values', () => {
    expect(summarizeFrameTimes([2, Number.NaN, Infinity, 4]).samples).toBe(2);
  });
  it('keeps only the most recent configured number of samples', () => {
    const monitor = new FramePerformanceMonitor(60);
    for (let index = 1; index <= 100; index += 1) monitor.record(index);
    expect(monitor.snapshot().samples).toBe(60);
    expect(monitor.snapshot().p50).toBe(70);
    monitor.disconnect();
  });
  it('copies ring-buffer samples in chronological order for optional Worker analysis', () => {
    const monitor = new FramePerformanceMonitor(60);
    for (let index = 1; index <= 65; index += 1) monitor.record(index);
    expect(Array.from(monitor.copySamples()).slice(0, 3)).toEqual([6, 7, 8]);
    expect(Array.from(monitor.copySamples()).at(-1)).toBe(65);
    monitor.disconnect();
  });
  it('ignores negative frame times', () => {
    const monitor = new FramePerformanceMonitor();
    monitor.record(-1); monitor.record(16.7);
    expect(monitor.snapshot().samples).toBe(1);
    monitor.disconnect();
  });
  it('exposes GC counters even when the browser does not support GC entries', () => {
    const monitor = new FramePerformanceMonitor();
    expect(monitor.snapshot().gcCount).toBeGreaterThanOrEqual(0);
    expect(monitor.snapshot().gcPauseMs).toBeGreaterThanOrEqual(0);
    monitor.disconnect();
  });
});
