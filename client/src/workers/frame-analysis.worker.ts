interface WorkerRequest {
  readonly id: number;
  readonly values: Float64Array;
}
interface WorkerResponse {
  readonly id: number;
  readonly samples: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly gcCount: number;
  readonly gcPauseMs: number;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

// Vite runs this module in a Worker; this narrows the shared globalThis type to the Worker message API.
const workerScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

workerScope.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const values = Array.from(event.data.values).filter(Number.isFinite).sort((a, b) => a - b);
  workerScope.postMessage({
    id: event.data.id,
    samples: values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    gcCount: 0,
    gcPauseMs: 0,
  });
};

export {};
