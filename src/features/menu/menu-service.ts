import { apiRequest, invalidateApiCache } from '../../lib/api';
import {
  deleteMenuImageFromFirestoreByToken,
  isFirebaseFirestoreConfigured,
  isFirestoreImageToken,
  uploadMenuImageToFirestore,
} from '../../lib/firebase-firestore';
import type { PreparedMenuImageAsset } from '../../lib/menu-image';
import { publishSyncEvent } from '../../lib/sync';
import type { Actor, Category, MediaAsset, MenuItem } from '../../types/models';

export interface CategoryInput {
  id?: string;
  name: string;
  sortOrder: number;
}

export interface MenuItemInput {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  imageAsset?: PreparedMenuImageAsset | null;
  clearImageAsset?: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

const CATALOG_TTL_MS = 60_000;
const CATALOG_INVALIDATION_PATHS = ['/api/categories', '/api/menu-items', '/api/reports/summary'] as const;
const MEDIA_RELATED_INVALIDATION_PATHS = ['/api/media', '/api/reports/summary'] as const;

const publishCatalogEvents = (entityId?: string, mediaEntityId?: string | null) => {
  publishSyncEvent('menu-changed', entityId);
  publishSyncEvent('catalog-changed', entityId);
  if (mediaEntityId) {
    publishSyncEvent('media-changed', mediaEntityId);
  }
};

const deleteImageAsset = async (assetId: string) => {
  await apiRequest<{ asset: MediaAsset; linkedItems: MenuItem[] } | null>(`/api/media/${assetId}`, {
    method: 'DELETE',
  });
};

export const getCategories = async () =>
  apiRequest<Category[]>('/api/categories', {
    localCache: { ttlMs: CATALOG_TTL_MS },
  });

export const getMenuItems = async () =>
  apiRequest<MenuItem[]>('/api/menu-items', {
    localCache: { ttlMs: CATALOG_TTL_MS },
  });

export const saveCategory = async (input: CategoryInput, actor: Actor) => {
  void actor;
  const category = await apiRequest<Category>(input.id ? `/api/categories/${input.id}` : '/api/categories', {
    method: input.id ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      sortOrder: input.sortOrder,
    }),
  });
  await invalidateApiCache(...CATALOG_INVALIDATION_PATHS);
  publishCatalogEvents(category.id);
  return category;
};

export const deleteCategory = async (categoryId: string, actor: Actor) => {
  void actor;
  await apiRequest<{ ok: boolean }>(`/api/categories/${categoryId}`, {
    method: 'DELETE',
  });
  await invalidateApiCache(...CATALOG_INVALIDATION_PATHS);
  publishCatalogEvents(categoryId);
};

export const saveMenuItem = async (input: MenuItemInput, actor: Actor) => {
  void actor;
  const existingItem = input.id ? (await apiRequest<MenuItem[]>('/api/menu-items')).find((entry) => entry.id === input.id) ?? null : null;
  let uploadedFirestoreImage: { dataUrl: string; documentId: string; token: string } | null = null;
  let previousAssetToDelete: string | null = null;
  let previousFirestoreTokenToDelete: string | null = null;

  try {
    if (input.imageAsset) {
      if (!isFirebaseFirestoreConfigured()) {
        throw new Error('Cloud Firestore هێشتا ڕێکنەخراوە. ناتوانرێت وێنەی خواردن پاشەکەوت بکرێت.');
      }

      uploadedFirestoreImage = await uploadMenuImageToFirestore(input.imageAsset, {
        menuItemId: input.id ?? existingItem?.id ?? undefined,
        menuName: input.name,
      });

      if (existingItem?.imageAssetId) {
        previousAssetToDelete = existingItem.imageAssetId;
      }

      if (existingItem?.image && isFirestoreImageToken(existingItem.image)) {
        previousFirestoreTokenToDelete = existingItem.image;
      }
    } else if (input.clearImageAsset && existingItem?.imageAssetId) {
      previousAssetToDelete = existingItem.imageAssetId;
    }

    if (
      input.clearImageAsset &&
      existingItem?.image &&
      isFirestoreImageToken(existingItem.image)
    ) {
      previousFirestoreTokenToDelete = existingItem.image;
    } else if (
      !input.imageAsset &&
      existingItem?.image &&
      existingItem.image !== input.image &&
      isFirestoreImageToken(existingItem.image)
    ) {
      previousFirestoreTokenToDelete = existingItem.image;
    }

    const savedItem = await apiRequest<MenuItem>(input.id ? `/api/menu-items/${input.id}` : '/api/menu-items', {
      method: input.id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        image:
          uploadedFirestoreImage?.token
          ?? (input.clearImageAsset ? '🍽️' : input.image),
        imageAssetId:
          input.clearImageAsset || uploadedFirestoreImage
            ? null
            : existingItem?.imageAssetId ?? null,
        isAvailable: input.isAvailable,
        sortOrder: input.sortOrder,
      }),
    });

    if (previousAssetToDelete) {
      await deleteImageAsset(previousAssetToDelete);
    }

    if (previousFirestoreTokenToDelete && previousFirestoreTokenToDelete !== uploadedFirestoreImage?.token) {
      try {
        await deleteMenuImageFromFirestoreByToken(previousFirestoreTokenToDelete);
      } catch {
        // Ignore Firestore cleanup failures after the menu item was already saved.
      }
    }

    await invalidateApiCache(...CATALOG_INVALIDATION_PATHS, ...MEDIA_RELATED_INVALIDATION_PATHS);
    publishCatalogEvents(savedItem.id, previousAssetToDelete);
    return savedItem;
  } catch (error) {
    if (uploadedFirestoreImage?.token) {
      try {
        await deleteMenuImageFromFirestoreByToken(uploadedFirestoreImage.token);
      } catch {
        // Ignore follow-up cleanup failures after the primary error.
      }
    }

    throw error;
  }
};

export const deleteMenuItem = async (menuItemId: string, actor: Actor) => {
  void actor;
  const existingItem = (await apiRequest<MenuItem[]>('/api/menu-items')).find((entry) => entry.id === menuItemId) ?? null;
  await apiRequest<{ ok: boolean }>(`/api/menu-items/${menuItemId}`, {
    method: 'DELETE',
  });

  if (existingItem?.image && isFirestoreImageToken(existingItem.image)) {
    try {
      await deleteMenuImageFromFirestoreByToken(existingItem.image);
    } catch {
      // Ignore Firestore cleanup failures after the menu item was already deleted from the primary backend.
    }
  }

  await invalidateApiCache(...CATALOG_INVALIDATION_PATHS, ...MEDIA_RELATED_INVALIDATION_PATHS);
  publishCatalogEvents(menuItemId);
};

export const setMenuAvailability = async (menuItemId: string, isAvailable: boolean, actor: Actor) => {
  void actor;
  const updatedItem = await apiRequest<MenuItem>(`/api/menu-items/${menuItemId}/availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isAvailable }),
  });
  await invalidateApiCache(...CATALOG_INVALIDATION_PATHS);
  publishCatalogEvents(menuItemId);
  return updatedItem;
};

