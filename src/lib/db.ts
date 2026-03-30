import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ActivityLog,
  AppSettings,
  Category,
  DeliveryNotification,
  DeliveryOrder,
  MediaAsset,
  MenuItem,
  NotificationItem,
  Order,
  OrderItem,
  Session,
} from '../types/models';

export interface ApiCacheEntry {
  key: string;
  data: unknown;
  updatedAt: string;
}

export interface FirestoreImageEntry {
  token: string;
  dataUrl: string | null;
  updatedAt: string;
}

export interface QueuedOrderInput {
  customerName: string;
  mobileNumber: string;
  province: string;
  extraAddress: string;
  note: string;
  specialRequests: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  clientCreatedAt?: string;
}

export interface QueuedOrderRecord {
  id: string;
  type: 'create-order';
  payload: QueuedOrderInput;
  session: Pick<Session, 'userId' | 'role' | 'displayName'>;
  tempOrder: Order;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
}

export interface QueuedDeliveryOrderInput {
  customerName: string;
  mobileNumber: string;
  province: string;
  extraAddress: string;
  note: string;
  specialRequests: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  clientCreatedAt?: string;
}

export interface QueuedDeliveryOrderRecord {
  id: string;
  type: 'create-delivery-order';
  payload: QueuedDeliveryOrderInput;
  session: Pick<Session, 'userId' | 'role' | 'displayName'>;
  tempOrder: DeliveryOrder;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError: string | null;
}

interface RestaurantDB extends DBSchema {
  orders: {
    key: string;
    value: Order;
    indexes: {
      'by-status': string;
      'by-createdAt': string;
      'by-orderNumber': string;
    };
  };
  deliveryOrders: {
    key: string;
    value: DeliveryOrder;
    indexes: {
      'by-status': string;
      'by-createdAt': string;
      'by-orderNumber': string;
      'by-mobileNumber': string;
      'by-createdByUserId': string;
    };
  };
  menuItems: {
    key: string;
    value: MenuItem;
    indexes: {
      'by-categoryId': string;
      'by-sortOrder': number;
    };
  };
  categories: {
    key: string;
    value: Category;
    indexes: {
      'by-sortOrder': number;
    };
  };
  mediaAssets: {
    key: string;
    value: MediaAsset;
    indexes: {
      'by-kind': string;
      'by-createdAt': string;
    };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  activityLogs: {
    key: string;
    value: ActivityLog;
    indexes: {
      'by-createdAt': string;
      'by-type': string;
    };
  };
  notifications: {
    key: string;
    value: NotificationItem;
    indexes: {
      'by-createdAt': string;
      'by-targetRole': string;
      'by-targetDisplayName': string;
    };
  };
  deliveryNotifications: {
    key: string;
    value: DeliveryNotification;
    indexes: {
      'by-createdAt': string;
      'by-targetRole': string;
      'by-targetDisplayName': string;
      'by-deliveryOrderId': string;
    };
  };
  apiCache: {
    key: string;
    value: ApiCacheEntry;
  };
  orderOutbox: {
    key: string;
    value: QueuedOrderRecord;
    indexes: {
      'by-createdAt': string;
      'by-userId': string;
    };
  };
  deliveryOutbox: {
    key: string;
    value: QueuedDeliveryOrderRecord;
    indexes: {
      'by-createdAt': string;
      'by-userId': string;
      'by-mobileNumber': string;
    };
  };
  firestoreImages: {
    key: string;
    value: FirestoreImageEntry;
    indexes: {
      'by-updatedAt': string;
    };
  };
}

const DB_NAME = 'restaurant-ops-local-db';
const DB_VERSION = 5;

let dbPromise: Promise<IDBPDatabase<RestaurantDB>> | null = null;

export const openAppDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<RestaurantDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('orders')) {
          const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
          ordersStore.createIndex('by-status', 'status');
          ordersStore.createIndex('by-createdAt', 'createdAt');
          ordersStore.createIndex('by-orderNumber', 'orderNumber');
        }

        if (!db.objectStoreNames.contains('deliveryOrders')) {
          const deliveryOrdersStore = db.createObjectStore('deliveryOrders', { keyPath: 'id' });
          deliveryOrdersStore.createIndex('by-status', 'status');
          deliveryOrdersStore.createIndex('by-createdAt', 'createdAt');
          deliveryOrdersStore.createIndex('by-orderNumber', 'orderNumber');
          deliveryOrdersStore.createIndex('by-mobileNumber', 'mobileNumber');
          deliveryOrdersStore.createIndex('by-createdByUserId', 'createdByUserId');
        }

        if (!db.objectStoreNames.contains('menuItems')) {
          const menuStore = db.createObjectStore('menuItems', { keyPath: 'id' });
          menuStore.createIndex('by-categoryId', 'categoryId');
          menuStore.createIndex('by-sortOrder', 'sortOrder');
        }

        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('by-sortOrder', 'sortOrder');
        }

        if (!db.objectStoreNames.contains('mediaAssets')) {
          const mediaStore = db.createObjectStore('mediaAssets', { keyPath: 'id' });
          mediaStore.createIndex('by-kind', 'kind');
          mediaStore.createIndex('by-createdAt', 'createdAt');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('activityLogs')) {
          const activityStore = db.createObjectStore('activityLogs', { keyPath: 'id' });
          activityStore.createIndex('by-createdAt', 'createdAt');
          activityStore.createIndex('by-type', 'type');
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notificationsStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notificationsStore.createIndex('by-createdAt', 'createdAt');
          notificationsStore.createIndex('by-targetRole', 'targetRole');
          notificationsStore.createIndex('by-targetDisplayName', 'targetDisplayName');
        }

        if (!db.objectStoreNames.contains('deliveryNotifications')) {
          const deliveryNotificationsStore = db.createObjectStore('deliveryNotifications', { keyPath: 'id' });
          deliveryNotificationsStore.createIndex('by-createdAt', 'createdAt');
          deliveryNotificationsStore.createIndex('by-targetRole', 'targetRole');
          deliveryNotificationsStore.createIndex('by-targetDisplayName', 'targetDisplayName');
          deliveryNotificationsStore.createIndex('by-deliveryOrderId', 'deliveryOrderId');
        }

        if (!db.objectStoreNames.contains('apiCache')) {
          db.createObjectStore('apiCache', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('orderOutbox')) {
          const orderOutboxStore = db.createObjectStore('orderOutbox', { keyPath: 'id' });
          orderOutboxStore.createIndex('by-createdAt', 'createdAt');
          orderOutboxStore.createIndex('by-userId', 'session.userId');
        }

        if (!db.objectStoreNames.contains('deliveryOutbox')) {
          const deliveryOutboxStore = db.createObjectStore('deliveryOutbox', { keyPath: 'id' });
          deliveryOutboxStore.createIndex('by-createdAt', 'createdAt');
          deliveryOutboxStore.createIndex('by-userId', 'session.userId');
          deliveryOutboxStore.createIndex('by-mobileNumber', 'payload.mobileNumber');
        }

        if (!db.objectStoreNames.contains('firestoreImages')) {
          const firestoreImagesStore = db.createObjectStore('firestoreImages', { keyPath: 'token' });
          firestoreImagesStore.createIndex('by-updatedAt', 'updatedAt');
        }
      },
    });
  }

  return dbPromise;
};

export const clearIndexedDb = async () => {
  const db = await openAppDb();
  const stores = [
    'orders',
    'deliveryOrders',
    'menuItems',
    'categories',
    'mediaAssets',
    'settings',
    'activityLogs',
    'notifications',
    'deliveryNotifications',
    'apiCache',
    'orderOutbox',
    'deliveryOutbox',
    'firestoreImages',
  ] as const;
  const transaction = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((store) => transaction.objectStore(store).clear()));
  await transaction.done;
};
