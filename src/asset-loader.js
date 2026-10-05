function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function isClientError(status) {
  return status >= 400 && status < 500;
}

async function fetchResource(url, { signal, retries = 3, baseDelay = 180, jitter = 120, responseType = 'arrayBuffer' } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (!response.ok) {
        if (isClientError(response.status)) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return responseType === 'json' ? response.json() : response.arrayBuffer();
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      const clientError = /^HTTP 4\d\d/.test(error.message ?? '');
      if (clientError || attempt >= retries) throw error;
      const delay = baseDelay * 2 ** attempt + Math.random() * jitter;
      await wait(delay, signal);
    }
  }

  throw new Error(`Unable to load ${url}`);
}

export async function fetchJson(url, options = {}) {
  return fetchResource(url, { ...options, responseType: 'json' });
}

export async function loadImage(url, { signal, retries = 3 } = {}) {
  const bytes = await fetchResource(url, { signal, retries });
  const blob = new Blob([bytes]);
  return createImageBitmap(blob);
}

export async function loadAudio(url, { signal, audioContext, retries = 3 } = {}) {
  const bytes = await fetchResource(url, { signal, retries });
  if (!audioContext) return bytes;
  return audioContext.decodeAudioData(bytes.slice(0));
}

export async function loadJson(url, { signal, retries = 3 } = {}) {
  return fetchJson(url, { signal, retries });
}

export async function loadAll(manifest, { signal, onProgress, audioContext } = {}) {
  const entries = Object.entries(manifest.assets);
  let completed = 0;
  onProgress?.({ completed, total: entries.length, current: null });

  const promises = entries.map(async ([name, asset]) => {
    const value = asset.type === 'image'
      ? await loadImage(asset.url, { signal, retries: manifest.retries })
      : asset.type === 'audio'
        ? await loadAudio(asset.url, { signal, audioContext, retries: manifest.retries })
        : await loadJson(asset.url, { signal, retries: manifest.retries });

    completed += 1;
    onProgress?.({ completed, total: entries.length, current: name });
    return [name, value];
  });

  const loaded = await Promise.all(promises);
  return Object.fromEntries(loaded);
}
