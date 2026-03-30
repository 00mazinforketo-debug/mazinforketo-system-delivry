import { apiDownload, apiRequest, invalidateApiCache } from '../../lib/api';
import { clearAllSessions, clearLastSession, clearPreferences } from '../../lib/storage';
import { publishSyncEvent } from '../../lib/sync';
import { logoutRequest } from '../auth/auth-service';
import type { Actor, ActivityLog, AppSettings, BackupPayload, DeleteOrdersPreviewDto, OrdersNotificationsSummaryDto } from '../../types/models';

export type BackupScope = 'all' | 'employee' | 'captain' | 'admin';

const SETTINGS_TTL_MS = 60_000;
const SUMMARY_TTL_MS = 12_000;
const ACTIVITY_TTL_MS = 15_000;
const FULL_DATA_INVALIDATION_PATHS = [
  '/api/settings',
  '/api/categories',
  '/api/menu-items',
  '/api/media',
  '/api/orders',
  '/api/delivery-orders',
  '/api/notifications',
  '/api/delivery-notifications',
  '/api/reports/summary',
  '/api/activity',
  '/api/analytics/employee-activity',
  '/api/maintenance/orders-notifications-summary',
] as const;

const normalizeSettings = (settings: AppSettings): AppSettings => ({
  ...settings,
  provinceOptions: Array.isArray(settings.provinceOptions) ? settings.provinceOptions : [],
  deliveryMobileBlockEnabled: settings.deliveryMobileBlockEnabled !== false,
  hiddenCategoryIds: Array.isArray(settings.hiddenCategoryIds) ? settings.hiddenCategoryIds : [],
  hiddenMenuItemIds: Array.isArray(settings.hiddenMenuItemIds) ? settings.hiddenMenuItemIds : [],
});

const publishFullDataResetEvents = () => {
  publishSyncEvent('reset-performed');
  publishSyncEvent('settings-changed');
  publishSyncEvent('menu-changed');
  publishSyncEvent('catalog-changed');
  publishSyncEvent('media-changed');
  publishSyncEvent('notification-changed');
  publishSyncEvent('order-created');
  publishSyncEvent('delivery-order-created');
  publishSyncEvent('delivery-order-updated');
  publishSyncEvent('delivery-notification-changed');
};

export const getAppSettings = async () =>
  normalizeSettings(
    await apiRequest<AppSettings>('/api/settings', {
      localCache: { ttlMs: SETTINGS_TTL_MS },
    }),
  );

export const updateAppSettings = async (input: Partial<AppSettings>, actor: Actor) => {
  void actor;
  const current = normalizeSettings(await apiRequest<AppSettings>('/api/settings'));
  const updated = await apiRequest<AppSettings>('/api/settings/business', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      businessName: input.businessName ?? current.businessName,
      provinceOptions: input.provinceOptions ?? current.provinceOptions,
      supportNote: input.supportNote ?? current.supportNote,
      deliveryMobileBlockEnabled: input.deliveryMobileBlockEnabled ?? current.deliveryMobileBlockEnabled,
    }),
  });
  await invalidateApiCache('/api/settings', '/api/reports/summary');
  publishSyncEvent('settings-changed');
  return normalizeSettings(updated);
};

export const setCategoryVisibility = async (categoryId: string, isVisible: boolean, actor: Actor) => {
  void actor;
  const settings = await apiRequest<AppSettings>('/api/settings/visibility', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entityType: 'category',
      entityId: categoryId,
      isVisible,
    }),
  });
  await invalidateApiCache('/api/settings', '/api/categories', '/api/menu-items', '/api/reports/summary');
  publishSyncEvent('settings-changed', categoryId);
  publishSyncEvent('catalog-changed', categoryId);
  return normalizeSettings(settings);
};

export const setMenuVisibility = async (menuItemId: string, isVisible: boolean, actor: Actor) => {
  void actor;
  const settings = await apiRequest<AppSettings>('/api/settings/visibility', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      entityType: 'menuItem',
      entityId: menuItemId,
      isVisible,
    }),
  });
  await invalidateApiCache('/api/settings', '/api/menu-items', '/api/reports/summary');
  publishSyncEvent('settings-changed', menuItemId);
  publishSyncEvent('catalog-changed', menuItemId);
  publishSyncEvent('menu-changed', menuItemId);
  return normalizeSettings(settings);
};

export const exportBackup = async () => {
  await apiDownload('/api/exports/backup.json', `restaurant-backup-${new Date().toISOString().slice(0, 10)}.json`);
  return true;
};

const dedupeById = <T extends { id: string }>(entries: T[]) => Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());

const fetchBackupPayload = async () => apiRequest<BackupPayload>('/api/exports/backup-data');

const scopeBackupPayload = (backup: BackupPayload, scope: BackupScope): BackupPayload => {
  if (scope === 'all') {
    return backup;
  }

  return {
    ...backup,
    orders: backup.orders.filter((order) => order.createdByRole === scope),
    deliveryOrders: backup.deliveryOrders.filter((order) => order.createdByRole === scope),
    notifications: backup.notifications.filter((notification) => notification.targetRole === scope),
    deliveryNotifications: backup.deliveryNotifications.filter((notification) => notification.targetRole === scope),
    activityLogs: backup.activityLogs.filter((log) => log.actorRole === scope),
  };
};

const mergeScopedBackup = (current: BackupPayload, incoming: BackupPayload, scope: Exclude<BackupScope, 'all'>): BackupPayload => ({
  ...current,
  orders: dedupeById([
    ...current.orders.filter((order) => order.createdByRole !== scope),
    ...incoming.orders.filter((order) => order.createdByRole === scope),
  ]),
  deliveryOrders: dedupeById([
    ...current.deliveryOrders.filter((order) => order.createdByRole !== scope),
    ...incoming.deliveryOrders.filter((order) => order.createdByRole === scope),
  ]),
  notifications: dedupeById([
    ...current.notifications.filter((notification) => notification.targetRole !== scope),
    ...incoming.notifications.filter((notification) => notification.targetRole === scope),
  ]),
  deliveryNotifications: dedupeById([
    ...current.deliveryNotifications.filter((notification) => notification.targetRole !== scope),
    ...incoming.deliveryNotifications.filter((notification) => notification.targetRole === scope),
  ]),
  activityLogs: dedupeById([
    ...current.activityLogs.filter((log) => log.actorRole !== scope),
    ...incoming.activityLogs.filter((log) => log.actorRole === scope),
  ]),
});

const downloadBackupPayload = (payload: BackupPayload, fileName: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportBackupForScope = async (scope: BackupScope) => {
  const backup = await fetchBackupPayload();
  const scopedBackup = scopeBackupPayload(backup, scope);
  downloadBackupPayload(scopedBackup, `restaurant-backup-${scope}-${new Date().toISOString().slice(0, 10)}.json`);
  return true;
};

export const exportOrdersCsvFile = async () => {
  await apiDownload('/api/exports/orders.csv', `restaurant-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  return true;
};

export const exportDeliveryOrdersCsvFile = async () => {
  await apiDownload('/api/exports/delivery-orders.csv', `restaurant-delivery-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  return true;
};

export const importBackup = async (rawText: string, actor: Actor) => {
  void actor;
  const payload = JSON.parse(rawText) as BackupPayload;
  const settings = await apiRequest<AppSettings>('/api/import/backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  await invalidateApiCache(...FULL_DATA_INVALIDATION_PATHS);
  publishFullDataResetEvents();
  return normalizeSettings(settings);
};

export const importBackupForScope = async (rawText: string, scope: BackupScope, actor: Actor) => {
  if (scope === 'all') {
    return importBackup(rawText, actor);
  }

  const incoming = JSON.parse(rawText) as BackupPayload;
  const current = await fetchBackupPayload();
  const merged = mergeScopedBackup(current, incoming, scope);
  const settings = await apiRequest<AppSettings>('/api/import/backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(merged),
  });
  await invalidateApiCache(...FULL_DATA_INVALIDATION_PATHS);
  publishFullDataResetEvents();
  return normalizeSettings(settings);
};

export const prepareBlankSystem = async (actor: Actor) => {
  void actor;
  const settings = await apiRequest<AppSettings>('/api/maintenance/prepare-blank', {
    method: 'POST',
  });
  clearPreferences();
  await invalidateApiCache(...FULL_DATA_INVALIDATION_PATHS);
  publishFullDataResetEvents();
  publishSyncEvent('order-updated');
  return normalizeSettings(settings);
};

export const previewDeleteOrdersByRange = async (input: {
  rangeType: 'yesterday' | 'single_day' | 'custom_range';
  roles: Array<'employee' | 'captain' | 'admin'>;
  includeTravelOrders: boolean;
  includeDeliveryOrders: boolean;
  includeTravelNotifications: boolean;
  includeDeliveryNotifications: boolean;
  includeActivityLogs: boolean;
  date?: string;
  fromDate?: string;
  toDate?: string;
}) =>
  apiRequest<DeleteOrdersPreviewDto>('/api/maintenance/orders/delete-preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

export const executeDeleteOrdersByRange = async (
  input: {
    rangeType: 'yesterday' | 'single_day' | 'custom_range';
    roles: Array<'employee' | 'captain' | 'admin'>;
    includeTravelOrders: boolean;
    includeDeliveryOrders: boolean;
    includeTravelNotifications: boolean;
    includeDeliveryNotifications: boolean;
    includeActivityLogs: boolean;
    date?: string;
    fromDate?: string;
    toDate?: string;
  },
  actor: Actor,
) => {
  void actor;
  const preview = await apiRequest<DeleteOrdersPreviewDto>('/api/maintenance/orders/delete-execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  await invalidateApiCache(...FULL_DATA_INVALIDATION_PATHS);
  publishSyncEvent('order-updated');
  publishSyncEvent('delivery-order-updated');
  publishSyncEvent('notification-changed');
  publishSyncEvent('delivery-notification-changed');
  publishSyncEvent('reset-performed');
  return preview;
};

export const getOrdersNotificationsSummary = async () =>
  apiRequest<OrdersNotificationsSummaryDto>('/api/maintenance/orders-notifications-summary', {
    localCache: { ttlMs: SUMMARY_TTL_MS },
  });

export const clearAllOrdersAndNotifications = async (actor: Actor) => {
  void actor;
  const summary = await apiRequest<OrdersNotificationsSummaryDto>('/api/maintenance/orders-notifications-clear', {
    method: 'POST',
  });
  await invalidateApiCache(...FULL_DATA_INVALIDATION_PATHS);
  publishSyncEvent('order-updated');
  publishSyncEvent('delivery-order-updated');
  publishSyncEvent('notification-changed');
  publishSyncEvent('delivery-notification-changed');
  publishSyncEvent('reset-performed');
  return summary;
};

export const clearLocalBrowserState = () => {
  clearPreferences();
  clearAllSessions();
  clearLastSession();
};

export const clearBrowserCacheAndRefresh = async () => {
  clearLocalBrowserState();
  window.sessionStorage.clear();

  try {
    await logoutRequest();
  } catch {
    // Ignore logout failures while clearing local browser state.
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  }

  window.location.replace('/login');
};

export const resetDemoData = async (actor: Actor) => prepareBlankSystem(actor);

export const getRecentActivity = async (limit?: number) =>
  apiRequest<ActivityLog[]>(`/api/activity${typeof limit === 'number' ? `?limit=${limit}` : ''}`, {
    localCache: { ttlMs: ACTIVITY_TTL_MS },
  });
