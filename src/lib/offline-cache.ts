import { openAppDb } from './db';
import { readLastSession, readSession } from './storage';
import type { ApiCacheEntry } from './db';

const nowIso = () => new Date().toISOString();

const normalizePath = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path, window.location.origin);
    return `${url.pathname}${url.search}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
};

const getSessionScope = () => {
  const session = readSession() ?? readLastSession();
  if (!session) {
    return 'anonymous';
  }

  return `${session.userId}:${session.role}:${session.displayName}`;
};

export const buildApiCacheKey = (path: string, method = 'GET') => {
  const normalizedMethod = method.toUpperCase();
  return `${normalizedMethod}:${getSessionScope()}:${normalizePath(path)}`;
};

export const readApiCache = async <T>(key: string): Promise<T | null> => {
  const db = await openAppDb();
  const entry = await db.get('apiCache', key);
  return entry ? (entry.data as T) : null;
};

export const readApiCacheEntry = async (key: string): Promise<ApiCacheEntry | null> => {
  const db = await openAppDb();
  return (await db.get('apiCache', key)) ?? null;
};

export const writeApiCache = async (key: string, data: unknown) => {
  const db = await openAppDb();
  await db.put('apiCache', {
    key,
    data,
    updatedAt: nowIso(),
  });
};

export const deleteApiCache = async (key: string) => {
  const db = await openAppDb();
  await db.delete('apiCache', key);
};

const extractPathFromApiCacheKey = (key: string) => {
  const pathSeparatorIndex = key.indexOf(':/');
  if (pathSeparatorIndex < 0) {
    return null;
  }

  return key.slice(pathSeparatorIndex + 1);
};

export const deleteApiCacheByPathPrefixes = async (prefixes: string[]) => {
  if (prefixes.length === 0) {
    return;
  }

  const db = await openAppDb();
  const keys = await db.getAllKeys('apiCache');
  const transaction = db.transaction('apiCache', 'readwrite');
  const store = transaction.objectStore('apiCache');

  await Promise.all(
    keys.map(async (key) => {
      const cacheKey = String(key);
      const path = extractPathFromApiCacheKey(cacheKey);
      if (!path || !prefixes.some((prefix) => path.startsWith(prefix))) {
        return;
      }

      await store.delete(cacheKey);
    }),
  );

  await transaction.done;
};

export const readFirestoreImageCache = async (token: string) => {
  const db = await openAppDb();
  const entry = await db.get('firestoreImages', token);
  return entry?.dataUrl ?? null;
};

export const writeFirestoreImageCache = async (token: string, dataUrl: string | null) => {
  const db = await openAppDb();
  await db.put('firestoreImages', {
    token,
    dataUrl,
    updatedAt: nowIso(),
  });
};

export const deleteFirestoreImageCache = async (token: string) => {
  const db = await openAppDb();
  await db.delete('firestoreImages', token);
};
