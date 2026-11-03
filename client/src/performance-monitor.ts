export interface FramePerformanceSummary {
  readonly samples: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly gcCount: number;
  readonly gcPauseMs: number;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

export function summarizeFrameTimes(samples: ArrayLike<number>): Pick<FramePerformanceSummary, 'samples' | 'p50' | 'p95' | 'p99'> {
  const sorted: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    if (value !== undefined && Number.isFinite(value)) sorted.push(value);
  }
  sorted.sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50: percentile(sorted, 0.50),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

/** Records frame times and GC entries without allocating a new record per frame. */
export class FramePerformanceMonitor {
  readonly #samples: Float64Array;
  readonly #maxSamples: number;
  #sampleCount = 0;
  #sampleIndex = 0;
  #gcCount = 0;
  #gcPauseMs = 0;
  #observer: PerformanceObserver | null = null;

  public constructor(maxSamples = 1800) {
    this.#maxSamples = Math.max(60, Math.trunc(maxSamples));
    this.#samples = new Float64Array(this.#maxSamples);
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes('gc')) return;
      this.#observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.#gcCount += 1;
          this.#gcPauseMs += Math.max(0, entry.duration);
        }
      });
      this.#observer.observe({ entryTypes: ['gc'] });
    } catch {
      this.#observer = null;
    }
  }

  public record(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs < 0) return;
    this.#samples[this.#sampleIndex] = frameMs;
    this.#sampleIndex = (this.#sampleIndex + 1) % this.#maxSamples;
    this.#sampleCount = Math.min(this.#maxSamples, this.#sampleCount + 1);
  }

  public snapshot(): FramePerformanceSummary {
    return { ...summarizeFrameTimes(this.#orderedSamples()), ...this.gcSummary() };
  }

  /** Copy the ring buffer only when a summary is requested (never from record()). */
  public copySamples(): Float64Array {
    return this.#orderedSamples();
  }

  public gcSummary(): Pick<FramePerformanceSummary, 'gcCount' | 'gcPauseMs'> {
    return { gcCount: this.#gcCount, gcPauseMs: this.#gcPauseMs };
  }

  #orderedSamples(): Float64Array {
    const ordered = new Float64Array(this.#sampleCount);
    const start = this.#sampleCount === this.#maxSamples ? this.#sampleIndex : 0;
    for (let index = 0; index < this.#sampleCount; index += 1) {
      ordered[index] = this.#samples[(start + index) % this.#maxSamples] ?? 0;
    }
    return ordered;
  }

  public disconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }
}
