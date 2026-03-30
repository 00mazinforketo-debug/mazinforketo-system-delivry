import { buildApiCacheKey, deleteApiCacheByPathPrefixes, readApiCache, readApiCacheEntry, writeApiCache } from './offline-cache';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error?: {
    message?: string;
    details?: unknown;
  };
}

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

interface LocalCachePolicy {
  ttlMs: number;
}

interface ApiRequestOptions extends RequestInit {
  localCache?: LocalCachePolicy;
}

interface MemoryCacheEntry {
  data: unknown;
  path: string;
  updatedAt: number;
}

interface InFlightRequestEntry {
  generation: number;
  path: string;
  promise: Promise<unknown>;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const getApiBase = () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const memoryCache = new Map<string, MemoryCacheEntry>();
const inFlightGetRequests = new Map<string, InFlightRequestEntry>();
let cacheGeneration = 0;

const toUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = getApiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const parseError = async (response: Response) => {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as ApiFailure | null;
    return new ApiError(payload?.error?.message ?? 'هەڵەیەک ڕوویدا.', response.status, payload?.error?.details);
  }

  const message = await response.text().catch(() => '');
  return new ApiError(message || 'هەڵەیەک ڕوویدا.', response.status);
};

const getRequestMethod = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const getLocalCacheTtlMs = (options?: ApiRequestOptions) => Math.max(0, options?.localCache?.ttlMs ?? 0);
const isFreshCacheTimestamp = (updatedAt: number, ttlMs: number) => Date.now() - updatedAt <= ttlMs;
const normalizeCachePath = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path, window.location.origin);
    return `${url.pathname}${url.search}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
};

const createOfflineError = (error: unknown) =>
  error instanceof ApiError
    ? error
    : new ApiError('هەڵەیەک ڕوویدا.', 0, error);

const readFreshCachedResponse = async <T>(cacheKey: string, path: string, ttlMs: number): Promise<T | null> => {
  if (ttlMs <= 0) {
    return null;
  }

  const memoryEntry = memoryCache.get(cacheKey);
  if (memoryEntry && isFreshCacheTimestamp(memoryEntry.updatedAt, ttlMs)) {
    return memoryEntry.data as T;
  }

  const persistedEntry = await readApiCacheEntry(cacheKey);
  const persistedUpdatedAt = Date.parse(persistedEntry?.updatedAt ?? '');
  if (!persistedEntry || Number.isNaN(persistedUpdatedAt) || !isFreshCacheTimestamp(persistedUpdatedAt, ttlMs)) {
    return null;
  }

  memoryCache.set(cacheKey, {
    data: persistedEntry.data,
    path,
    updatedAt: persistedUpdatedAt,
  });
  return persistedEntry.data as T;
};

const storeCachedResponse = async (cacheKey: string, path: string, data: unknown) => {
  const updatedAt = Date.now();
  memoryCache.set(cacheKey, {
    data,
    path,
    updatedAt,
  });
  await writeApiCache(cacheKey, data);
};

export const invalidateApiCache = async (...pathPrefixes: string[]) => {
  const normalizedPrefixes = pathPrefixes
    .map((prefix) => normalizeCachePath(prefix))
    .filter((prefix, index, values) => prefix.length > 0 && values.indexOf(prefix) === index);

  if (normalizedPrefixes.length === 0) {
    return;
  }

  cacheGeneration += 1;

  for (const [cacheKey, entry] of memoryCache.entries()) {
    if (normalizedPrefixes.some((prefix) => entry.path.startsWith(prefix))) {
      memoryCache.delete(cacheKey);
    }
  }

  for (const [cacheKey, entry] of inFlightGetRequests.entries()) {
    if (normalizedPrefixes.some((prefix) => entry.path.startsWith(prefix))) {
      inFlightGetRequests.delete(cacheKey);
    }
  }

  await deleteApiCacheByPathPrefixes(normalizedPrefixes);
};

export const apiRequest = async <T>(path: string, init?: ApiRequestOptions): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const method = getRequestMethod(init);
  const cacheKey = method === 'GET' ? buildApiCacheKey(path, method) : null;
  const normalizedPath = normalizeCachePath(path);
  const ttlMs = method === 'GET' ? getLocalCacheTtlMs(init) : 0;
  let response: Response;

  if (cacheKey) {
    const cached = await readFreshCachedResponse<T>(cacheKey, normalizedPath, ttlMs);
    if (cached !== null) {
      return cached;
    }

    const pendingRequest = inFlightGetRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest.promise as Promise<T>;
    }
  }

  const requestGeneration = cacheGeneration;
  const runRequest = async () => {
    const requestInit: RequestInit = { ...(init ?? {}) };
    delete (requestInit as ApiRequestOptions).localCache;

    try {
      response = await fetch(toUrl(path), {
        credentials: 'include',
        ...requestInit,
        headers,
      });
    } catch (error) {
      if (cacheKey) {
        const cached = await readApiCache<T>(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }

      throw createOfflineError(error);
    }

    if (!response.ok) {
      if (cacheKey && response.status >= 500) {
        const cached = await readApiCache<T>(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }

      throw await parseError(response);
    }

    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!payload.success) {
      throw new ApiError(payload.error?.message ?? 'هەڵەیەک ڕوویدا.', response.status, payload.error?.details);
    }

    if (cacheKey && requestGeneration === cacheGeneration) {
      await storeCachedResponse(cacheKey, normalizedPath, payload.data);
    }

    return payload.data;
  };

  if (!cacheKey) {
    return runRequest();
  }

  const requestPromise = runRequest();
  inFlightGetRequests.set(cacheKey, {
    generation: requestGeneration,
    path: normalizedPath,
    promise: requestPromise,
  });

  try {
    return await requestPromise;
  } finally {
    const pendingRequest = inFlightGetRequests.get(cacheKey);
    if (pendingRequest?.promise === requestPromise) {
      inFlightGetRequests.delete(cacheKey);
    }
  }
};

export const apiDownload = async (path: string, fallbackFileName: string) => {
  const response = await fetch(toUrl(path), {
    credentials: 'include',
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const blob = await response.blob();
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const matched = disposition.match(/filename="?([^"]+)"?/i);
  link.href = url;
  link.download = matched?.[1] ?? fallbackFileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const dataUrlToFile = (value: string, fileName: string, mimeType?: string) => {
  const matched = value.match(/^data:(.+?);base64,(.+)$/);
  if (!matched) {
    throw new Error('فۆرماتی وێنە دروست نییە.');
  }

  const [, embeddedMimeType, base64] = matched;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType ?? embeddedMimeType });
};
