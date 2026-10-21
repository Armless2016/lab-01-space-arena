import { z } from 'zod';
export type ManifestAsset = Readonly<{ type: 'image' | 'audio' | 'json'; url: string }>;
export interface AssetManifest {
  readonly version: number;
  readonly retries: number;
  readonly assets: Readonly<Record<string, ManifestAsset>>;
}
export interface FetchResourceOptions {
  readonly signal?: AbortSignal;
  readonly retries?: number;
  readonly baseDelay?: number;
  readonly jitter?: number;
  readonly responseType?: 'json' | 'arrayBuffer';
  readonly requestInit?: RequestInit;
}
export interface LoadOptions {
  readonly signal?: AbortSignal;
  readonly retries?: number;
  readonly audioContext?: AudioContext;
}
export interface LoadProgress {
  readonly completed: number;
  readonly total: number;
  readonly current: string | null;
}
export interface LoadAllOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: LoadProgress) => void;
  readonly audioContext?: AudioContext;
}
export interface LoadedAssets {
  readonly ship: ImageBitmap;
  readonly bullet: ImageBitmap;
  readonly asteroid: ImageBitmap;
  readonly pickup: ImageBitmap;
  readonly fire: AudioBuffer;
  readonly hit: AudioBuffer;
  readonly explosion: AudioBuffer;
  readonly pickupSound: AudioBuffer;
  readonly meta: unknown;
}
type AssetValue = ImageBitmap | AudioBuffer | ArrayBuffer | unknown;
type ResourceResponse = unknown | ArrayBuffer;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

async function fetchResource(url: string, options: FetchResourceOptions = {}): Promise<ResourceResponse> {
  const {
    signal, retries = 3, baseDelay = 180, jitter = 120,
    responseType = 'arrayBuffer', requestInit = {},
  } = options;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { ...requestInit, signal, cache: 'no-store' });
      if (!response.ok) {
        const failure = new Error(`HTTP ${response.status} for ${url}`);
        if (isClientError(response.status)) Object.assign(failure, { noRetry: true });
        throw failure;
      }
      if (responseType === 'json') {
        const value: unknown = await response.json();
        return value;
      }
      return await response.arrayBuffer();
    } catch (error: unknown) {
      if (signal?.aborted) throw signal.reason ?? error;
      const noRetry = error instanceof Error && 'noRetry' in error;
      if (noRetry || attempt >= retries) throw error;
      await wait(baseDelay * 2 ** attempt + Math.random() * jitter, signal);
    }
  }
  throw new Error(`Unable to load ${url}`);
}

export async function fetchJson(url: string, options: FetchResourceOptions = {}): Promise<unknown> {
  return fetchResource(url, { ...options, responseType: 'json' });
}

export async function loadImage(url: string, options: LoadOptions = {}): Promise<ImageBitmap> {
  const bytes = await fetchResource(url, { ...options, responseType: 'arrayBuffer' });
  if (!(bytes instanceof ArrayBuffer)) throw new TypeError(`Image response for ${url} was not binary`);
  return createImageBitmap(new Blob([bytes]));
}

export async function loadAudio(url: string, options: LoadOptions = {}): Promise<AudioBuffer | ArrayBuffer> {
  const bytes = await fetchResource(url, { ...options, responseType: 'arrayBuffer' });
  if (!(bytes instanceof ArrayBuffer)) throw new TypeError(`Audio response for ${url} was not binary`);
  if (!options.audioContext) return bytes;
  return options.audioContext.decodeAudioData(bytes.slice(0));
}

export async function loadJson(url: string, options: LoadOptions = {}): Promise<unknown> {
  return fetchJson(url, options);
}

const AssetManifestSchema = z.object({
  version: z.number().int().nonnegative(),
  retries: z.number().int().min(0).max(10),
  assets: z.record(z.object({
    type: z.union([z.literal('image'), z.literal('audio'), z.literal('json')]),
    url: z.string().min(1),
  }).strict()),
}).strict();

export function parseAssetManifest(value: unknown): AssetManifest {
  return AssetManifestSchema.parse(value);
}

export async function loadAll(manifest: AssetManifest, options: LoadAllOptions = {}): Promise<LoadedAssets> {
  const { signal, onProgress, audioContext } = options;
  const entries = Object.entries(manifest.assets);
  let completed = 0;
  onProgress?.({ completed, total: entries.length, current: null });
  const promises = entries.map(async ([name, asset]): Promise<readonly [string, AssetValue]> => {
    const loadOptions: LoadOptions = { signal, retries: manifest.retries, audioContext };
    let value: AssetValue;
    switch (asset.type) {
      case 'image': value = await loadImage(asset.url, loadOptions); break;
      case 'audio': value = await loadAudio(asset.url, loadOptions); break;
      case 'json': value = await loadJson(asset.url, loadOptions); break;
      default: {
        const exhaustive: never = asset.type;
        throw new Error(`Unsupported manifest asset type: ${exhaustive}`);
      }
    }
    completed += 1;
    onProgress?.({ completed, total: entries.length, current: name });
    return [name, value];
  });
  const loadedEntries = await Promise.all(promises);
  const result = new Map(loadedEntries);
  const ship = result.get('ship');
  const bullet = result.get('bullet');
  const asteroid = result.get('asteroid');
  const pickup = result.get('pickup');
  const fire = result.get('fire');
  const hit = result.get('hit');
  const explosion = result.get('explosion');
  const pickupSound = result.get('pickupSound');
  if (!(ship instanceof ImageBitmap) || !(bullet instanceof ImageBitmap) || !(asteroid instanceof ImageBitmap) || !(pickup instanceof ImageBitmap)) {
    throw new TypeError('Manifest is missing required sprite images');
  }
  if (!(fire instanceof AudioBuffer) || !(hit instanceof AudioBuffer) || !(explosion instanceof AudioBuffer) || !(pickupSound instanceof AudioBuffer)) {
    throw new TypeError('Audio buffers were not decoded; provide an unlocked AudioContext');
  }
  return { ship, bullet, asteroid, pickup, fire, hit, explosion, pickupSound, meta: result.get('meta') };
}

export function describeLoadError(error: unknown): string {
  return errorMessage(error);
}
