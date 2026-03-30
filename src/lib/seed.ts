import type { ActivityLog, AppSettings, Category, MediaAsset, MenuItem, NotificationItem, Order } from '../types/models';
import { IRAQ_LOCATION_OPTIONS } from '../config/locations';
import { createId } from './id';
import { openAppDb } from './db';

const seededAt = '2026-03-24T00:00:00.000Z';

const categories: Category[] = [];
const menuItems: MenuItem[] = [];
const mediaAssets: MediaAsset[] = [];
const orders: Order[] = [];
const notifications: NotificationItem[] = [];

const defaultSettings: AppSettings = {
  id: 'app',
  businessName: 'ڕێستورانتی مەزن فۆڕ کیتۆ',
  provinceOptions: IRAQ_LOCATION_OPTIONS,
  orderSequence: 0,
  seededAt,
  lastResetAt: seededAt,
  supportNote: 'ئەم ئەپە local-first ـە و داتا تەنها لەسەر ئەم ئامێرە هەڵدەگیرێت.',
  deliveryMobileBlockEnabled: true,
  hiddenCategoryIds: [],
  hiddenMenuItemIds: [],
  updatedAt: seededAt,
};

const buildActivityLogs = (timestamp: string, message: string, type: string): ActivityLog[] => [
  {
    id: createId('log'),
    type,
    message,
    actorRole: 'system',
    actorName: 'سیستەم',
    createdAt: timestamp,
  },
];

export const ensureSeededData = async () => {
  const db = await openAppDb();
  const existingSettings = await db.get('settings', 'app');
  if (existingSettings?.seededAt) {
    return;
  }

  const transaction = db.transaction(['categories', 'menuItems', 'mediaAssets', 'orders', 'settings', 'activityLogs', 'notifications'], 'readwrite');

  await Promise.all(categories.map((category) => transaction.objectStore('categories').put(category)));
  await Promise.all(menuItems.map((item) => transaction.objectStore('menuItems').put(item)));
  await Promise.all(mediaAssets.map((asset) => transaction.objectStore('mediaAssets').put(asset)));
  await Promise.all(orders.map((order) => transaction.objectStore('orders').put(order)));
  await transaction.objectStore('settings').put(defaultSettings);
  await Promise.all(buildActivityLogs(seededAt, 'سیستەم بە دۆخی بەتاڵ ئامادە کرا.', 'system_seed').map((log) => transaction.objectStore('activityLogs').put(log)));
  await Promise.all(notifications.map((notification) => transaction.objectStore('notifications').put(notification)));
  await transaction.done;
};

export const buildBlankSeedData = (timestamp = new Date().toISOString()) => ({
  settings: {
    ...defaultSettings,
    seededAt: timestamp,
    updatedAt: timestamp,
    lastResetAt: timestamp,
    orderSequence: 0,
  },
  categories: categories.map((category) => ({ ...category, createdAt: timestamp, updatedAt: timestamp })),
  menuItems: menuItems.map((item) => ({ ...item, createdAt: timestamp, updatedAt: timestamp })),
  mediaAssets: mediaAssets.map((asset) => ({ ...asset, createdAt: timestamp, updatedAt: timestamp })),
  orders: orders.map((order) => ({
    ...order,
    updatedAt: timestamp,
  })),
  notifications: notifications.map((notification) => ({
    ...notification,
    createdAt: timestamp,
  })),
  activityLogs: buildActivityLogs(timestamp, 'سیستەم بۆ کارکردنی ڕاستەقینە بە دۆخی بەتاڵ ئامادە کرا.', 'prepare_blank'),
});
