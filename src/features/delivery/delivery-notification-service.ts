import { apiRequest, invalidateApiCache } from '../../lib/api';
import { openAppDb } from '../../lib/db';
import { publishSyncEvent } from '../../lib/sync';
import { appendHiddenEntityIds, getHiddenEntityIds } from '../../lib/view-state';
import type { DeliveryNotification, Session } from '../../types/models';

const DELIVERY_NOTIFICATION_TTL_MS = 10_000;

const cacheDeliveryNotifications = async (notifications: DeliveryNotification[]) => {
  const db = await openAppDb();
  const transaction = db.transaction('deliveryNotifications', 'readwrite');
  await Promise.all(notifications.map((notification) => transaction.objectStore('deliveryNotifications').put(notification)));
  await transaction.done;
  return notifications;
};

const getCachedDeliveryNotifications = async () => {
  const db = await openAppDb();
  return db.getAll('deliveryNotifications');
};

export const getDeliveryNotificationsForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  const hiddenIds = new Set(getHiddenEntityIds('deliveryNotifications', session));

  try {
    const notifications = await apiRequest<DeliveryNotification[]>('/api/delivery-notifications', {
      localCache: { ttlMs: DELIVERY_NOTIFICATION_TTL_MS },
    });
    await cacheDeliveryNotifications(notifications);
    return notifications.filter((notification) => !hiddenIds.has(notification.id));
  } catch (error) {
    const notifications = await getCachedDeliveryNotifications();
    if (notifications.length > 0) {
      return notifications.filter(
        (notification) =>
          notification.targetRole === session.role &&
          (notification.targetDisplayName === null || notification.targetDisplayName === session.displayName) &&
          !hiddenIds.has(notification.id),
      );
    }

    throw error;
  }
};

export const getAllDeliveryNotifications = async () => {
  try {
    const notifications = await apiRequest<DeliveryNotification[]>('/api/delivery-notifications?scope=all', {
      localCache: { ttlMs: DELIVERY_NOTIFICATION_TTL_MS },
    });
    await cacheDeliveryNotifications(notifications);
    return notifications;
  } catch (error) {
    const notifications = await getCachedDeliveryNotifications();
    if (notifications.length > 0) {
      return notifications;
    }

    throw error;
  }
};

export const getUnreadDeliveryNotificationCountForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  const notifications = await getDeliveryNotificationsForSession(session);
  return notifications.filter((notification) => !notification.isRead).length;
};

export const markDeliveryNotificationsAsReadForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  void session;
  await apiRequest<{ ok: boolean }>('/api/delivery-notifications/mark-read', {
    method: 'POST',
  });
  await invalidateApiCache('/api/delivery-notifications');
  publishSyncEvent('delivery-notification-changed');
  return true;
};

export const hideDeliveryNotificationsForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  const notifications = await getDeliveryNotificationsForSession(session);
  if (notifications.length === 0) {
    return 0;
  }

  appendHiddenEntityIds(
    'deliveryNotifications',
    session,
    notifications.map((notification) => notification.id),
  );
  publishSyncEvent('delivery-notification-changed');
  return notifications.length;
};

export const clearAllDeliveryNotifications = async () => {
  await apiRequest<{ ok: boolean }>('/api/delivery-notifications/clear', {
    method: 'POST',
  });
  await invalidateApiCache('/api/delivery-notifications', '/api/reports/summary', '/api/maintenance/orders-notifications-summary');
  publishSyncEvent('delivery-notification-changed');
  return true;
};
