import { fetchJson, loadImage, loadJson, loadAudio } from './asset-loader.js';
import { runMicrotaskPuzzles } from './microtask-puzzles.js';

export async function runFailureGallery(kind) {
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
      } catch (error) {
        return { case: 'abort during load', status: 'handled', error: error.name };
      }
    }

    if (kind === 'json') {
      await loadJson('/api/broken-json', { retries: 0 });
      return { case: 'broken JSON', status: 'unexpected success' };
    }

    return { status: 'unknown test' };
  } catch (error) {
    return {
      case: kind,
      status: 'handled — game continues',
      error: error.name,
      message: error.message,
    };
  }
}

export async function runPromiseCombinatorsDemo() {
  const values = await Promise.all([
    Promise.resolve('image'),
    Promise.resolve('audio'),
    Promise.resolve('rooms'),
  ]);

  const settled = await Promise.allSettled([
    Promise.resolve('ok'),
    Promise.reject(new Error('expected diagnostic failure')),
  ]);

  const race = await Promise.race([
    new Promise((resolve) => setTimeout(() => resolve('slow'), 15)),
    Promise.resolve('fast'),
  ]);

  const any = await Promise.any([
    Promise.reject(new Error('first failed')),
    Promise.resolve('first successful result'),
  ]);

  return {
    PromiseAll: values,
    PromiseAllSettled: settled.map((item) => item.status),
    PromiseRace: race,
    PromiseAny: any,
  };
}

export async function measureAssetStrategies(manifest, audioContext) {
  const entries = Object.entries(manifest.assets);

  const loadOne = async ([, asset]) => {
    if (asset.type === 'image') return loadImage(asset.url, { retries: 0 });
    if (asset.type === 'audio') return loadAudio(asset.url, { retries: 0, audioContext });
    return loadJson(asset.url, { retries: 0 });
  };

  const sequentialStart = performance.now();
  for (const entry of entries) await loadOne(entry);
  const sequentialMs = performance.now() - sequentialStart;

  const concurrentStart = performance.now();
  await Promise.all(entries.map(loadOne));
  const concurrentMs = performance.now() - concurrentStart;

  return {
    files: entries.length,
    sequentialMs: Number(sequentialMs.toFixed(2)),
    concurrentMs: Number(concurrentMs.toFixed(2)),
    speedup: Number((sequentialMs / Math.max(concurrentMs, 0.01)).toFixed(2)),
  };
}

export { runMicrotaskPuzzles };
