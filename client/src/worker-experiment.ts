import { summarizeFrameTimes, type FramePerformanceSummary } from './performance-monitor.ts';

let retainedWorker: Worker | null = null;
let nextRequestId = 1;
interface PendingWorkerCall {
  readonly resolve: (summary: FramePerformanceSummary) => void;
  readonly reject: (error: Error) => void;
}
const pending = new Map<number, PendingWorkerCall>();

function createAnalysisWorker(): Worker {
  const worker = new Worker(new URL('./workers/frame-analysis.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<FramePerformanceSummary & { readonly id: number }>) => {
    const call = pending.get(event.data.id);
    if (!call) return;
    pending.delete(event.data.id);
    call.resolve(event.data);
  });
  worker.addEventListener('error', (event: ErrorEvent) => {
    const error = new Error(event.message || 'Frame analysis Worker failed');
    for (const call of pending.values()) call.reject(error);
    pending.clear();
  });
  return worker;
}

function summarizeInWorker(worker: Worker, input: Float64Array): Promise<FramePerformanceSummary> {
  const id = nextRequestId++;
  const values = input.slice();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, values }, [values.buffer]);
    } catch (error: unknown) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Compare a main-thread percentile calculation with the same calculation in a Worker.
 * A worker is retained only when the measured round-trip is faster.
 */
export async function runWorkerPerformanceExperiment(sampleCount = 1_800): Promise<{
  readonly samples: number;
  readonly mainThreadMs: number;
  readonly workerRoundTripMs: number;
  readonly workerRetained: boolean;
  readonly conclusion: string;
}> {
  retainedWorker?.terminate();
  retainedWorker = null;
  const samples = new Float64Array(Math.max(1_000, Math.trunc(sampleCount)));
  for (let index = 0; index < samples.length; index += 1) samples[index] = ((index * 7919) % 100_003) / 1000;
  const worker = createAnalysisWorker();
  try {
    await summarizeInWorker(worker, samples.slice(0, 128)); // Warm up worker and module before timing.
    const mainStart = performance.now();
    for (let run = 0; run < 3; run += 1) summarizeFrameTimes(samples);
    const mainThreadMs = (performance.now() - mainStart) / 3;
    const workerStart = performance.now();
    for (let run = 0; run < 3; run += 1) await summarizeInWorker(worker, samples);
    const workerRoundTripMs = (performance.now() - workerStart) / 3;
    const workerRetained = workerRoundTripMs < mainThreadMs;
    if (workerRetained) {
      // Any previous retained worker was terminated and cleared at function entry.
      retainedWorker = worker;
    } else {
      worker.terminate();
    }
    return {
      samples: samples.length,
      mainThreadMs,
      workerRoundTripMs,
      workerRetained,
      conclusion: workerRetained
        ? 'Worker was faster for this batch and is retained for large frame-analysis batches.'
        : 'Main thread was faster; Worker was terminated and the game keeps analysis on the main thread.',
    };
  } catch (error: unknown) {
    worker.terminate();
    throw error;
  }
}

export async function summarizeFrameBatch(samples: Float64Array): Promise<FramePerformanceSummary> {
  if (retainedWorker && samples.length >= 512) return summarizeInWorker(retainedWorker, samples);
  // This helper summarizes frame times only; GC metrics are supplied by FramePerformanceMonitor.
  return { ...summarizeFrameTimes(samples), gcCount: 0, gcPauseMs: 0 };
}

export function disposePerformanceWorker(): void {
  retainedWorker?.terminate();
  retainedWorker = null;
  pending.clear();
}
