import { apiRequest, ApiError, invalidateApiCache } from '../../lib/api';
import { openAppDb, type QueuedOrderInput, type QueuedOrderRecord } from '../../lib/db';
import { publishSyncEvent } from '../../lib/sync';
import type { Order, Session } from '../../types/models';

const nowIso = () => new Date().toISOString();

const buildOfflineOrderNumber = (timestamp: string) => {
  const compact = timestamp
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .replaceAll('.', '')
    .slice(2, 14);
  return `OFF-${compact}`;
};

const sortByCreatedAtDesc = (orders: Order[]) => [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
const ORDER_INVALIDATION_PATHS = [
  '/api/orders',
  '/api/notifications',
  '/api/reports/summary',
  '/api/activity',
  '/api/analytics/employee-activity',
  '/api/maintenance/orders-notifications-summary',
] as const;

const buildQueuedOrder = (input: QueuedOrderInput, session: Pick<Session, 'userId' | 'role' | 'displayName'>): QueuedOrderRecord => {
  const createdAt = input.clientCreatedAt ?? nowIso();
  const id = `offline-order-${crypto.randomUUID()}`;
  const tempOrder: Order = {
    id,
    orderNumber: buildOfflineOrderNumber(createdAt),
    customerName: input.customerName,
    mobileNumber: input.mobileNumber,
    province: input.province,
    extraAddress: input.extraAddress,
    note: input.note,
    specialRequests: input.specialRequests,
    items: input.items,
    subtotal: input.subtotal,
    total: input.total,
    status: 'pending_captain',
    createdByRole: session.role,
    createdByName: session.displayName,
    createdByUserId: session.userId,
    createdAt,
    acceptedAt: null,
    completedAt: null,
    updatedAt: createdAt,
    cancelReason: '',
    offlineState: 'queued',
    queuedAt: createdAt,
    syncError: null,
  };

  return {
    id,
    type: 'create-order',
    payload: {
      ...input,
      clientCreatedAt: createdAt,
    },
    session,
    tempOrder,
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
    lastError: null,
  };
};

const withSyncError = (record: QueuedOrderRecord, message: string): QueuedOrderRecord => ({
  ...record,
  attempts: record.attempts + 1,
  updatedAt: nowIso(),
  lastError: message,
  tempOrder: {
    ...record.tempOrder,
    updatedAt: nowIso(),
    syncError: message,
  },
});

export const queueOfflineOrder = async (
  input: QueuedOrderInput,
  session: Pick<Session, 'userId' | 'role' | 'displayName'>,
) => {
  const record = buildQueuedOrder(input, session);
  const db = await openAppDb();
  await db.put('orderOutbox', record);
  publishSyncEvent('order-created', record.id);
  return record.tempOrder;
};

export const listQueuedOrdersForSession = async (session: Pick<Session, 'userId'>) => {
  const db = await openAppDb();
  const records = await db.getAllFromIndex('orderOutbox', 'by-userId', session.userId);
  return sortByCreatedAtDesc(records.map((record) => record.tempOrder));
};

export const getQueuedOrderById = async (orderId: string, session?: Pick<Session, 'userId'>) => {
  const db = await openAppDb();
  const record = await db.get('orderOutbox', orderId);
  if (!record) {
    return null;
  }

  if (session && record.session.userId !== session.userId) {
    return null;
  }

  return record.tempOrder;
};

export const cancelQueuedOrder = async (orderId: string, session: Pick<Session, 'userId' | 'role'>) => {
  if (session.role !== 'employee') {
    return false;
  }

  const db = await openAppDb();
  const record = await db.get('orderOutbox', orderId);
  if (!record || record.session.userId !== session.userId) {
    return false;
  }

  await db.delete('orderOutbox', orderId);
  publishSyncEvent('order-updated', orderId);
  return true;
};

export const mergeOrdersWithQueued = (remoteOrders: Order[], queuedOrders: Order[]) => {
  const merged = [...remoteOrders];
  const knownIds = new Set(remoteOrders.map((order) => order.id));

  for (const queuedOrder of queuedOrders) {
    if (!knownIds.has(queuedOrder.id)) {
      merged.push(queuedOrder);
    }
  }

  return sortByCreatedAtDesc(merged);
};

export const flushQueuedOrdersForSession = async (session: Pick<Session, 'userId' | 'role' | 'displayName'>) => {
  const db = await openAppDb();
  const queued = (await db.getAllFromIndex('orderOutbox', 'by-userId', session.userId)).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  let syncedCount = 0;
  let failedCount = 0;

  for (const record of queued) {
    try {
      const order = await apiRequest<Order>('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...record.payload,
          clientCreatedAt: record.payload.clientCreatedAt ?? record.createdAt,
        }),
      });

      await db.delete('orderOutbox', record.id);
      await invalidateApiCache(...ORDER_INVALIDATION_PATHS);
      publishSyncEvent('order-created', order.id);
      publishSyncEvent('notification-changed', order.id);
      syncedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : 'هەڵەیەک ڕوویدا.';
      await db.put('orderOutbox', withSyncError(record, message));

      if (!(error instanceof ApiError) || error.status === 0 || error.status === 401 || error.status === 403 || error.status >= 500) {
        break;
      }
    }
  }

  return { syncedCount, failedCount };
};


