export interface MicrotaskPuzzleResult {
  readonly name: string;
  readonly output: readonly string[];
  readonly explanation: string;
}

export async function runMicrotaskPuzzles(): Promise<MicrotaskPuzzleResult[]> {
  const results: MicrotaskPuzzleResult[] = [];
  {
    const output: string[] = ['sync-A'];
    Promise.resolve().then(() => output.push('microtask-B'));
    setTimeout(() => output.push('task-C'), 0);
    output.push('sync-D');
    await new Promise<void>((resolve) => setTimeout(resolve, 12));
    results.push({ name: '1. Promise microtask vs setTimeout task', output, explanation: 'Synchronous code runs first, then the microtask queue is drained before the timer task runs.' });
  }
  {
    const output: string[] = ['sync-A'];
    void (async () => { output.push('async-B'); await Promise.resolve(); output.push('after-await-C'); })();
    output.push('sync-D');
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    results.push({ name: '2. await creates a continuation microtask', output, explanation: 'The part after await resumes asynchronously as a microtask, so sync-D happens before after-await-C.' });
  }
  {
    const output: string[] = ['sync-A'];
    Promise.resolve().then(() => { output.push('then-B'); setTimeout(() => output.push('timer-C'), 0); });
    Promise.resolve().then(() => output.push('then-D'));
    output.push('sync-E');
    await new Promise<void>((resolve) => setTimeout(resolve, 12));
    results.push({ name: '3. setTimeout scheduled inside .then', output, explanation: 'The second .then stays in the current microtask drain; the timer waits for a later task turn.' });
  }
  {
    const output: string[] = ['sync-A'];
    requestAnimationFrame(() => { output.push('raf-B'); Promise.resolve().then(() => output.push('micro-after-raf-C')); });
    Promise.resolve().then(() => output.push('micro-D'));
    output.push('sync-E');
    await new Promise<void>((resolve) => setTimeout(resolve, 35));
    results.push({ name: '4. requestAnimationFrame and a following microtask', output, explanation: 'Promise callbacks run as microtasks; rAF runs at a rendering opportunity, and a Promise scheduled inside it adds a further microtask.' });
  }
  {
    const output: string[] = ['sync-A'];
    Promise.resolve().then(() => { output.push('micro-B'); return Promise.resolve('value'); }).then(() => output.push('micro-C'));
    Promise.resolve().then(() => output.push('micro-D'));
    output.push('sync-E');
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    results.push({ name: '5. FIFO microtask queue with a chained Promise', output, explanation: 'Microtasks are queued in order; a chained continuation is appended after the current callback yields back to the queue.' });
  }
  return results;
}
