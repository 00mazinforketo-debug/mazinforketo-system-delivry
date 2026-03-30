import { apiRequest, invalidateApiCache } from '../../lib/api';
import { openAppDb } from '../../lib/db';
import { publishSyncEvent } from '../../lib/sync';
import type {
  ActivityLog,
  AppSettings,
  BackupPayload,
  Category,
  DeliveryNotification,
  DeliveryOrder,
  MediaAsset,
  MenuItem,
  NotificationItem,
  Order,
} from '../../types/models';

export interface LocalMigrationPreview {
  hasLocalData: boolean;
  businessName: string | null;
  orderSequence: number;
  counts: {
    categories: number;
    menuItems: number;
    mediaAssets: number;
    orders: number;
    deliveryOrders: number;
    notifications: number;
    deliveryNotifications: number;
    activityLogs: number;
  };
  totalImageBytes: number;
  lastLocalResetAt: string | null;
}

const loadLocalBackup = async (): Promise<BackupPayload | null> => {
  const db = await openAppDb();
  const [settings, categories, menuItems, mediaAssets, orders, deliveryOrders, notifications, deliveryNotifications, activityLogs] = await Promise.all([
    db.get('settings', 'app'),
    db.getAll('categories'),
    db.getAll('menuItems'),
    db.getAll('mediaAssets'),
    db.getAll('orders'),
    db.getAll('deliveryOrders'),
    db.getAll('notifications'),
    db.getAll('deliveryNotifications'),
    db.getAll('activityLogs'),
  ]);

  if (!settings) {
    return null;
  }

  return {
    exportedAt: new Date().toISOString(),
    settings: settings as AppSettings,
    categories: categories as Category[],
    menuItems: menuItems as MenuItem[],
    mediaAssets: mediaAssets as MediaAsset[],
    orders: orders as Order[],
    deliveryOrders: deliveryOrders as DeliveryOrder[],
    notifications: notifications as NotificationItem[],
    deliveryNotifications: deliveryNotifications as DeliveryNotification[],
    activityLogs: activityLogs as ActivityLog[],
  };
};

export const previewLocalBrowserMigration = async (): Promise<LocalMigrationPreview> => {
  const backup = await loadLocalBackup();
  if (!backup) {
    return {
      hasLocalData: false,
      businessName: null,
      orderSequence: 0,
      counts: {
        categories: 0,
        menuItems: 0,
        mediaAssets: 0,
        orders: 0,
        deliveryOrders: 0,
        notifications: 0,
        deliveryNotifications: 0,
        activityLogs: 0,
      },
      totalImageBytes: 0,
      lastLocalResetAt: null,
    };
  }

  return {
    hasLocalData: true,
    businessName: backup.settings.businessName,
    orderSequence: backup.settings.orderSequence,
    counts: {
      categories: backup.categories.length,
      menuItems: backup.menuItems.length,
      mediaAssets: backup.mediaAssets.length,
      orders: backup.orders.length,
      deliveryOrders: backup.deliveryOrders.length,
      notifications: backup.notifications.length,
      deliveryNotifications: backup.deliveryNotifications.length,
      activityLogs: backup.activityLogs.length,
    },
    totalImageBytes: backup.mediaAssets.reduce((sum, asset) => sum + asset.byteSize, 0),
    lastLocalResetAt: backup.settings.lastResetAt,
  };
};

export const importLocalBrowserData = async () => {
  const backup = await loadLocalBackup();
  if (!backup) {
    throw new Error('هیچ data ی local لەم browser ـەدا نەدۆزرایەوە.');
  }

  const settings = await apiRequest<AppSettings>('/api/import/backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(backup),
  });

  await invalidateApiCache(
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
  );
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

  return settings;
};
