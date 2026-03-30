import { apiRequest, invalidateApiCache } from '../../lib/api';
import { publishSyncEvent } from '../../lib/sync';
import { appendHiddenEntityIds, getHiddenEntityIds } from '../../lib/view-state';
import type { Actor, NotificationItem, Session } from '../../types/models';

const NOTIFICATION_TTL_MS = 10_000;

export const getNotificationsForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  const notifications = await apiRequest<NotificationItem[]>('/api/notifications', {
    localCache: { ttlMs: NOTIFICATION_TTL_MS },
  });
  const hiddenIds = new Set(getHiddenEntityIds('notifications', session));
  return notifications.filter((notification) => !hiddenIds.has(notification.id));
};

export const getAllNotifications = async () =>
  apiRequest<NotificationItem[]>('/api/notifications?scope=all', {
    localCache: { ttlMs: NOTIFICATION_TTL_MS },
  });

export const getUnreadCountForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  const notifications = await getNotificationsForSession(session);
  return notifications.filter((notification) => !notification.isRead).length;
};

export const markNotificationsAsReadForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  void session;
  await apiRequest<{ ok: boolean }>('/api/notifications/mark-read', {
    method: 'POST',
  });
  await invalidateApiCache('/api/notifications');
  publishSyncEvent('notification-changed');
  return true;
};

export const hideNotificationsForSession = async (session: Pick<Session, 'role' | 'displayName'>) => {
  const notifications = await getNotificationsForSession(session);
  if (notifications.length === 0) {
    return 0;
  }

  appendHiddenEntityIds(
    'notifications',
    session,
    notifications.map((notification) => notification.id),
  );
  publishSyncEvent('notification-changed');
  return notifications.length;
};

export const clearAllNotifications = async (actor: Actor) => {
  void actor;
  await apiRequest<{ ok: boolean }>('/api/notifications/clear', {
    method: 'POST',
  });
  await invalidateApiCache('/api/notifications', '/api/reports/summary', '/api/maintenance/orders-notifications-summary');
  publishSyncEvent('notification-changed');
  return true;
};
