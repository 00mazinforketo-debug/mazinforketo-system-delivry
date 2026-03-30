import { apiRequest, ApiError, invalidateApiCache } from '../../lib/api';
import { openAppDb, type QueuedDeliveryOrderInput, type QueuedDeliveryOrderRecord } from '../../lib/db';
import { publishSyncEvent } from '../../lib/sync';
import type { DeliveryOrder, Session } from '../../types/models';

const nowIso = () => new Date().toISOString();

const buildOfflineOrderNumber = (timestamp: string) => {
  const compact = timestamp
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .replaceAll('.', '')
    .slice(2, 14);
  return `OFF-DLV-${compact}`;
};

const sortByCreatedAtDesc = (orders: DeliveryOrder[]) => [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
const DELIVERY_INVALIDATION_PATHS = [
  '/api/delivery-orders',
  '/api/delivery-notifications',
  '/api/reports/summary',
  '/api/activity',
  '/api/analytics/employee-activity',
  '/api/maintenance/orders-notifications-summary',
] as const;

const buildQueuedOrder = (
  input: QueuedDeliveryOrderInput,
  session: Pick<Session, 'userId' | 'role' | 'displayName'>,
): QueuedDeliveryOrderRecord => {
  const createdAt = input.clientCreatedAt ?? nowIso();
  const id = `offline-delivery-order-${crypto.randomUUID()}`;
  const tempOrder: DeliveryOrder = {
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
    type: 'create-delivery-order',
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

const withSyncError = (record: QueuedDeliveryOrderRecord, message: string): QueuedDeliveryOrderRecord => ({
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

export const queueOfflineDeliveryOrder = async (
  input: QueuedDeliveryOrderInput,
  session: Pick<Session, 'userId' | 'role' | 'displayName'>,
) => {
  const record = buildQueuedOrder(input, session);
  const db = await openAppDb();
  await db.put('deliveryOutbox', record);
  publishSyncEvent('delivery-order-created', record.id);
  return record.tempOrder;
};

export const listQueuedDeliveryOrdersForSession = async (session: Pick<Session, 'userId'>) => {
  const db = await openAppDb();
  const records = await db.getAllFromIndex('deliveryOutbox', 'by-userId', session.userId);
  return sortByCreatedAtDesc(records.map((record) => record.tempOrder));
};

export const listAllQueuedDeliveryOrders = async () => {
  const db = await openAppDb();
  const records = await db.getAll('deliveryOutbox');
  return records.map((record) => record.tempOrder);
};

export const getQueuedDeliveryOrderById = async (orderId: string, session?: Pick<Session, 'userId'>) => {
  const db = await openAppDb();
  const record = await db.get('deliveryOutbox', orderId);
  if (!record) {
    return null;
  }

  if (session && record.session.userId !== session.userId) {
    return null;
  }

  return record.tempOrder;
};

export const cancelQueuedDeliveryOrder = async (orderId: string, session: Pick<Session, 'userId' | 'role'>) => {
  if (session.role !== 'employee') {
    return false;
  }

  const db = await openAppDb();
  const record = await db.get('deliveryOutbox', orderId);
  if (!record || record.session.userId !== session.userId) {
    return false;
  }

  await db.delete('deliveryOutbox', orderId);
  publishSyncEvent('delivery-order-updated', orderId);
  return true;
};

export const mergeDeliveryOrdersWithQueued = (remoteOrders: DeliveryOrder[], queuedOrders: DeliveryOrder[]) => {
  const merged = [...remoteOrders];
  const knownIds = new Set(remoteOrders.map((order) => order.id));

  for (const queuedOrder of queuedOrders) {
    if (!knownIds.has(queuedOrder.id)) {
      merged.push(queuedOrder);
    }
  }

  return sortByCreatedAtDesc(merged);
};

export const flushQueuedDeliveryOrdersForSession = async (session: Pick<Session, 'userId' | 'role' | 'displayName'>) => {
  const db = await openAppDb();
  const queued = (await db.getAllFromIndex('deliveryOutbox', 'by-userId', session.userId)).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  let syncedCount = 0;
  let failedCount = 0;

  for (const record of queued) {
    try {
      const order = await apiRequest<DeliveryOrder>('/api/delivery-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...record.payload,
          clientCreatedAt: record.payload.clientCreatedAt ?? record.createdAt,
        }),
      });

      await db.delete('deliveryOutbox', record.id);
      await db.put('deliveryOrders', order);
      await invalidateApiCache(...DELIVERY_INVALIDATION_PATHS);
      publishSyncEvent('delivery-order-created', order.id);
      publishSyncEvent('delivery-notification-changed', order.id);
      syncedCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : 'هەڵەیەک ڕوویدا.';
      await db.put('deliveryOutbox', withSyncError(record, message));

      if (!(error instanceof ApiError) || error.status === 0 || error.status === 401 || error.status === 403 || error.status >= 500) {
        break;
      }
    }
  }

  return { syncedCount, failedCount };
};
