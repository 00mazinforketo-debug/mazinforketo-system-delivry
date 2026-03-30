import { apiRequest } from '../../lib/api';
import { publishSyncEvent } from '../../lib/sync';
import type { Actor, MediaAsset, MenuItem } from '../../types/models';

interface MediaUsageEntry {
  asset: MediaAsset;
  linkedItems: MenuItem[];
  usageCount: number;
}

export const getAllMediaAssets = async () => apiRequest<MediaAsset[]>('/api/media');

export const getMediaAssetById = async (assetId: string) => {
  const assets = await getAllMediaAssets();
  return assets.find((asset) => asset.id === assetId);
};

export const getMediaAssetUsage = async () => apiRequest<MediaUsageEntry[]>('/api/media?includeUsage=1');

export const detachMediaAsset = async (assetId: string, actor: Actor) => {
  void actor;
  const result = await apiRequest<{ asset: MediaAsset; linkedItems: MenuItem[] } | null>(`/api/media/${assetId}`, {
    method: 'DELETE',
  });
  publishSyncEvent('media-changed', assetId);
  publishSyncEvent('catalog-changed', assetId);
  publishSyncEvent('menu-changed', assetId);
  return result;
};

export const uploadMediaAsset = async (file: File, meta: { width: number; height: number }, actor: Actor) => {
  void actor;
  const formData = new FormData();
  formData.set('file', file);
  formData.set('width', String(meta.width));
  formData.set('height', String(meta.height));

  const asset = await apiRequest<MediaAsset>('/api/media', {
    method: 'POST',
    body: formData,
  });

  publishSyncEvent('media-changed', asset.id);
  publishSyncEvent('catalog-changed', asset.id);
  publishSyncEvent('menu-changed', asset.id);
  return asset;
};

