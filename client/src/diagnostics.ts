import { fetchJson, loadImage, loadJson, loadAudio, type AssetManifest } from './asset-loader.ts';
import { runMicrotaskPuzzles, type MicrotaskPuzzleResult } from './microtask-puzzles.ts';

export type FailureKind = '404' | 'timeout' | 'abort' | 'json' | string;
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function nameOf(error: unknown): string { return error instanceof Error ? error.name : 'Error'; }

export async function runFailureGallery(kind: FailureKind): Promise<Record<string, unknown>> {
  try {
    if (kind === '404') {
      await loadImage('/assets/does-not-exist.png', { retries: 3 });
      return { case: '404 sprite', status: 'unexpected success' };
    }
    if (kind === 'timeout') {
      await fetchJson('/api/slow?ms=1800', { signal: AbortSignal.timeout(120), retries: 0 });
      return { case: 'network timeout', status: 'unexpected success' };
    }
    if (kind === 'abort') {
      const controller = new AbortController();
      const promise = fetchJson('/api/slow?ms=900', { signal: controller.signal, retries: 0 });
      setTimeout(() => controller.abort(new DOMException('User cancelled test', 'AbortError')), 80);
      try {
        await promise;
        return { case: 'abort during load', status: 'unexpected success' };
      } catch (error: unknown) {
        return { case: 'abort during load', status: 'handled', error: nameOf(error) };
      }
    }
    if (kind === 'json') {
      await loadJson('/api/broken-json', { retries: 0 });
      return { case: 'broken JSON', status: 'unexpected success' };
    }
    return { status: 'unknown test' };
  } catch (error: unknown) {
    return { case: kind, status: 'handled — game continues', error: nameOf(error), message: messageOf(error) };
  }
}

export async function runPromiseCombinatorsDemo(): Promise<Record<string, unknown>> {
  const values = await Promise.all([Promise.resolve('image'), Promise.resolve('audio'), Promise.resolve('rooms')]);
  const settled = await Promise.allSettled([Promise.resolve('ok'), Promise.reject(new Error('expected diagnostic failure'))]);
  const race = await Promise.race([new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 15)), Promise.resolve('fast')]);
  const anyResult = await Promise.any([Promise.reject(new Error('first failed')), Promise.resolve('first successful result')]);
  return { PromiseAll: values, PromiseAllSettled: settled.map((item) => item.status), PromiseRace: race, PromiseAny: anyResult };
}

export async function measureAssetStrategies(manifest: AssetManifest, audioContext: AudioContext): Promise<{ files: number; sequentialMs: number; concurrentMs: number; speedup: number }> {
  const entries = Object.entries(manifest.assets);
  const loadOne = async (entry: readonly [string, AssetManifest['assets'][string]]): Promise<unknown> => {
    const [, asset] = entry;
    switch (asset.type) {
      case 'image': return loadImage(asset.url, { retries: 0 });
      case 'audio': return loadAudio(asset.url, { retries: 0, audioContext });
      case 'json': return loadJson(asset.url, { retries: 0 });
      default: { const exhaustive: never = asset.type; throw new Error(`Unknown asset type: ${exhaustive}`); }
    }
  };
  const sequentialStart = performance.now();
  for (const entry of entries) await loadOne(entry);
  const sequentialMs = performance.now() - sequentialStart;
  const concurrentStart = performance.now();
  await Promise.all(entries.map((entry) => loadOne(entry)));
  const concurrentMs = performance.now() - concurrentStart;
  return { files: entries.length, sequentialMs: Number(sequentialMs.toFixed(2)), concurrentMs: Number(concurrentMs.toFixed(2)), speedup: Number((sequentialMs / Math.max(concurrentMs, 0.01)).toFixed(2)) };
}

export { runMicrotaskPuzzles };
export type { MicrotaskPuzzleResult };
