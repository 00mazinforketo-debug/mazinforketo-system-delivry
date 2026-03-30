import type { PreparedMenuImageAsset } from './menu-image';
import { deleteFirestoreImageCache, readFirestoreImageCache, writeFirestoreImageCache } from './offline-cache';
import { compressMenuImageDataUrl } from './menu-image';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
};

const requiredConfigEntries = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
] as const;

const FIRESTORE_IMAGE_COLLECTION = 'menuImages';
const FIRESTORE_IMAGE_TOKEN_PREFIX = 'firestore-image:';
const MAX_FIRESTORE_DATA_URL_BYTES = 900 * 1024;
const textEncoder = new TextEncoder();
const imageCache = new Map<string, string | null | Promise<string | null>>();

const getUtf8ByteSize = (value: string) => textEncoder.encode(value).length;
const getTokenFromDocumentId = (documentId: string) => `${FIRESTORE_IMAGE_TOKEN_PREFIX}${documentId}`;

const getDocumentIdFromToken = (token?: string | null) => {
  if (!token || !token.startsWith(FIRESTORE_IMAGE_TOKEN_PREFIX)) {
    return null;
  }

  const documentId = token.slice(FIRESTORE_IMAGE_TOKEN_PREFIX.length).trim();
  return documentId || null;
};

const buildFirestoreRestDocumentUrl = (documentId: string) =>
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${FIRESTORE_IMAGE_COLLECTION}/${documentId}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;

const encodeFirestoreValue = (value: string | number | boolean | null) => {
  if (value === null) {
    return { nullValue: null };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
};

const buildFirestoreFields = (input: Record<string, string | number | boolean | null>) =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, encodeFirestoreValue(value)]));

const readFirestoreDataUrlField = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const fields = 'fields' in payload && payload.fields && typeof payload.fields === 'object' ? payload.fields : null;
  if (!fields) {
    return null;
  }

  const dataUrlField =
    'dataUrl' in fields && fields.dataUrl && typeof fields.dataUrl === 'object' ? fields.dataUrl : null;
  return dataUrlField && 'stringValue' in dataUrlField && typeof dataUrlField.stringValue === 'string'
    ? dataUrlField.stringValue
    : null;
};

const firestoreRestRequest = async <T = unknown>(documentId: string, init?: RequestInit) => {
  const response = await fetch(buildFirestoreRestDocumentUrl(documentId), {
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Firestore request failed: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json().catch(() => null)) as T | null;
};

const fitMenuImageToFirestore = async (draft: PreparedMenuImageAsset) => {
  const candidates = new Set<string>([draft.originalDataUrl, draft.previewDataUrl]);
  const compressionSteps = [
    { maxDimension: 1180, quality: 0.82 },
    { maxDimension: 1040, quality: 0.8 },
    { maxDimension: 900, quality: 0.76 },
    { maxDimension: 760, quality: 0.72 },
    { maxDimension: 620, quality: 0.68 },
    { maxDimension: 520, quality: 0.64 },
  ] as const;

  for (const step of compressionSteps) {
    candidates.add(
      await compressMenuImageDataUrl(draft.originalDataUrl, {
        maxDimension: step.maxDimension,
        quality: step.quality,
      }),
    );
  }

  for (const candidate of candidates) {
    if (candidate && getUtf8ByteSize(candidate) <= MAX_FIRESTORE_DATA_URL_BYTES) {
      return candidate;
    }
  }

  throw new Error('قەبارەی وێنەکە زۆر گەورەیە بۆ Cloud Firestore. تکایە وێنەیەکی بچووک‌تر هەڵبژێرە.');
};

export const getMissingFirebaseConfigKeys = () =>
  requiredConfigEntries.filter(([, value]) => !String(value).trim()).map(([key]) => key);

export const isFirebaseFirestoreConfigured = () => getMissingFirebaseConfigKeys().length === 0;

export const getMenuImageProviderLabel = () => 'Cloud Firestore';

export const isFirestoreImageToken = (value?: string | null) => Boolean(getDocumentIdFromToken(value));

export const uploadMenuImageToFirestore = async (
  draft: PreparedMenuImageAsset,
  options?: { menuItemId?: string; menuName?: string },
) => {
  if (!isFirebaseFirestoreConfigured()) {
    throw new Error('Cloud Firestore هێشتا ڕێکنەخراوە. env ـەکانی Firebase زیاد بکە.');
  }

  const dataUrl = await fitMenuImageToFirestore(draft);
  const documentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const token = getTokenFromDocumentId(documentId);

  await firestoreRestRequest(documentId, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: buildFirestoreFields({
        byteSize: getUtf8ByteSize(dataUrl),
        createdAt: now,
        dataUrl,
        fileName: draft.fileName,
        height: draft.height,
        menuItemId: options?.menuItemId ?? null,
        menuItemName: options?.menuName?.trim() || null,
        mimeType: draft.mimeType,
        originalByteSize: draft.byteSize,
        updatedAt: now,
        width: draft.width,
      }),
    }),
  });

  imageCache.set(token, dataUrl);
  await writeFirestoreImageCache(token, dataUrl);

  return {
    dataUrl,
    documentId,
    token,
  };
};

export const readMenuImageFromFirestoreToken = async (token: string) => {
  const documentId = getDocumentIdFromToken(token);
  if (!documentId) {
    return null;
  }

  const cachedValue = imageCache.get(token);
  if (typeof cachedValue === 'string' || cachedValue === null) {
    return cachedValue;
  }

  if (cachedValue) {
    return cachedValue;
  }

  const persisted = await readFirestoreImageCache(token);
  if (persisted) {
    imageCache.set(token, persisted);
    return persisted;
  }

  const pendingRead = (async () => {
    try {
      const payload = await firestoreRestRequest(documentId);

      if (!payload) {
        await deleteFirestoreImageCache(token);
        return null;
      }

      const dataUrl = readFirestoreDataUrlField(payload);
      await writeFirestoreImageCache(token, dataUrl);
      return dataUrl;
    } catch (error) {
      const cachedDataUrl = await readFirestoreImageCache(token);
      if (cachedDataUrl) {
        return cachedDataUrl;
      }

      throw error;
    }
  })();

  imageCache.set(token, pendingRead);

  try {
    const dataUrl = await pendingRead;
    imageCache.set(token, dataUrl);
    return dataUrl;
  } catch (error) {
    imageCache.delete(token);
    throw error;
  }
};

export const deleteMenuImageFromFirestoreByToken = async (token: string) => {
  const documentId = getDocumentIdFromToken(token);
  if (!documentId) {
    return false;
  }

  await firestoreRestRequest(documentId, {
    method: 'DELETE',
  });
  imageCache.delete(token);
  await deleteFirestoreImageCache(token);
  return true;
};
