import { apiRequest, ApiError, invalidateApiCache } from '../../lib/api';
import { openAppDb } from '../../lib/db';
import { readLastSession, readSession } from '../../lib/storage';
import { publishSyncEvent } from '../../lib/sync';
import { getBusinessDayKey, isDeliveryMobileBlockWindowActive } from '../../../shared/business-time';
import type { Actor, AppSettings, DeliveryOrder, OrderItem, OrderStatus, Session, UserRole } from '../../types/models';
import {
  cancelQueuedDeliveryOrder,
  flushQueuedDeliveryOrdersForSession,
  getQueuedDeliveryOrderById,
  listAllQueuedDeliveryOrders,
  listQueuedDeliveryOrdersForSession,
  mergeDeliveryOrdersWithQueued,
  queueOfflineDeliveryOrder,
} from './offline-delivery-outbox';

export interface CreateDeliveryOrderInput {
  customerName: string;
  mobileNumber: string;
  province: string;
  extraAddress: string;
  note: string;
  specialRequests: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  createdByRole: UserRole;
  createdByName: string;
}

const DELIVERY_LIST_TTL_MS = 12_000;
const DELIVERY_DETAIL_TTL_MS = 10_000;
const DELIVERY_INVALIDATION_PATHS = [
  '/api/delivery-orders',
  '/api/delivery-notifications',
  '/api/reports/summary',
  '/api/activity',
  '/api/analytics/employee-activity',
  '/api/maintenance/orders-notifications-summary',
] as const;

const EMPLOYEE_CANCELLED_MESSAGES = new Set([
  '',
  'لەلایەن کارمەندەوە ڕەتکرایەوە.',
  'لەلایەن کارمەندەوە پێش sync هەڵوەشایەوە.',
]);

const getStoredSession = (): Session | null => readSession() ?? readLastSession();

const normalizeCancelReason = (actor: Actor, cancelReason: string) => {
  const normalizedReason = cancelReason.trim();

  if (actor.role === 'employee' && EMPLOYEE_CANCELLED_MESSAGES.has(normalizedReason)) {
    return `لەلایەن ${actor.displayName} ڕەتکرایەوە.`;
  }

  return normalizedReason;
};

const sortByCreatedAtDesc = (orders: DeliveryOrder[]) => [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

const publishDeliveryEvents = (orderId: string) => {
  publishSyncEvent('delivery-order-created', orderId);
  publishSyncEvent('delivery-notification-changed', orderId);
};

const publishDeliveryUpdateEvents = (orderId: string) => {
  publishSyncEvent('delivery-order-updated', orderId);
  publishSyncEvent('delivery-notification-changed', orderId);
};

const createRemoteDeliveryOrder = async (input: CreateDeliveryOrderInput, clientCreatedAt: string) =>
  apiRequest<DeliveryOrder>('/api/delivery-orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerName: input.customerName,
      mobileNumber: input.mobileNumber,
      province: input.province,
      extraAddress: input.extraAddress,
      note: input.note,
      specialRequests: input.specialRequests,
      items: input.items,
      subtotal: input.subtotal,
      total: input.total,
      clientCreatedAt,
    }),
  });

export const normalizeDeliveryMobileNumber = (value: string) => String(value ?? '').replace(/\D+/g, '');

const shouldEnforceDeliveryMobileBlock = (settings?: Pick<AppSettings, 'deliveryMobileBlockEnabled'> | null, referenceDate: string | Date = new Date()) =>
  settings?.deliveryMobileBlockEnabled !== false && isDeliveryMobileBlockWindowActive(referenceDate);

const cacheDeliveryOrders = async (orders: DeliveryOrder[]) => {
  const db = await openAppDb();
  const transaction = db.transaction('deliveryOrders', 'readwrite');
  await Promise.all(orders.map((order) => transaction.objectStore('deliveryOrders').put(order)));
  await transaction.done;
  return orders;
};

const cacheDeliveryOrder = async (order: DeliveryOrder) => {
  const db = await openAppDb();
  await db.put('deliveryOrders', order);
  return order;
};

export const getCachedDeliveryOrders = async () => {
  const db = await openAppDb();
  const orders = await db.getAll('deliveryOrders');
  return sortByCreatedAtDesc(orders);
};

export const findKnownDeliveryDuplicate = async (
  mobileNumber: string,
  options?: {
    settings?: Pick<AppSettings, 'deliveryMobileBlockEnabled'> | null;
    referenceDate?: string | Date;
  },
) => {
  const normalizedMobileNumber = normalizeDeliveryMobileNumber(mobileNumber);
  const referenceDate = options?.referenceDate ?? new Date();
  if (!shouldEnforceDeliveryMobileBlock(options?.settings, referenceDate)) {
    return null;
  }

  const currentDayKey = getBusinessDayKey(referenceDate);
  const [cachedOrders, queuedOrders] = await Promise.all([getCachedDeliveryOrders(), listAllQueuedDeliveryOrders()]);
  return (
    [...cachedOrders, ...queuedOrders].find(
      (order) =>
        normalizeDeliveryMobileNumber(order.mobileNumber) === normalizedMobileNumber &&
        getBusinessDayKey(order.createdAt) === currentDayKey,
    ) ?? null
  );
};

export const assertNoKnownDeliveryDuplicate = async (
  mobileNumber: string,
  options?: {
    settings?: Pick<AppSettings, 'deliveryMobileBlockEnabled'> | null;
    referenceDate?: string | Date;
  },
) => {
  const duplicate = await findKnownDeliveryDuplicate(mobileNumber, options);
  if (duplicate) {
    throw new Error(`ژمارەی مۆبایل ${normalizeDeliveryMobileNumber(mobileNumber)} ئەمڕۆ پێشتر لە گەیاندن تۆمارکراوە (${duplicate.orderNumber}).`);
  }
};

export const getAllDeliveryOrders = async () => {
  try {
    const orders = await apiRequest<DeliveryOrder[]>('/api/delivery-orders?scope=all', {
      localCache: { ttlMs: DELIVERY_LIST_TTL_MS },
    });
    await cacheDeliveryOrders(orders);
    return orders;
  } catch (error) {
    const cachedOrders = await getCachedDeliveryOrders();
    if (cachedOrders.length > 0) {
      return cachedOrders;
    }

    throw error;
  }
};

export const getDeliveryOrderById = async (orderId: string) => {
  try {
    const order = await apiRequest<DeliveryOrder>(`/api/delivery-orders/${orderId}`, {
      localCache: { ttlMs: DELIVERY_DETAIL_TTL_MS },
    });
    await cacheDeliveryOrder(order);
    return order;
  } catch (error) {
    const session = getStoredSession();
    const queuedOrder = session ? await getQueuedDeliveryOrderById(orderId, session) : null;
    if (queuedOrder) {
      return queuedOrder;
    }

    const db = await openAppDb();
    const cachedOrder = await db.get('deliveryOrders', orderId);
    if (cachedOrder) {
      return cachedOrder;
    }

    throw error;
  }
};

export const getDeliveryOrdersByCreator = async (creatorName: string) => {
  void creatorName;
  const session = getStoredSession();
  const queuedOrders = session ? await listQueuedDeliveryOrdersForSession(session) : [];

  try {
    const orders = await apiRequest<DeliveryOrder[]>('/api/delivery-orders?scope=mine', {
      localCache: { ttlMs: DELIVERY_LIST_TTL_MS },
    });
    await cacheDeliveryOrders(orders);
    return mergeDeliveryOrdersWithQueued(orders, queuedOrders);
  } catch (error) {
    const cachedOrders = session ? (await getCachedDeliveryOrders()).filter((order) => order.createdByUserId === session.userId) : [];
    const merged = mergeDeliveryOrdersWithQueued(cachedOrders, queuedOrders);
    if (merged.length > 0) {
      return merged;
    }

    throw error;
  }
};

export const createDeliveryOrder = async (
  input: CreateDeliveryOrderInput,
  options?: { settings?: Pick<AppSettings, 'deliveryMobileBlockEnabled'> | null },
) => {
  const clientCreatedAt = new Date().toISOString();
  const normalizedMobileNumber = normalizeDeliveryMobileNumber(input.mobileNumber);
  await assertNoKnownDeliveryDuplicate(normalizedMobileNumber, {
    settings: options?.settings,
    referenceDate: clientCreatedAt,
  });

  try {
    const order = await createRemoteDeliveryOrder({ ...input, mobileNumber: normalizedMobileNumber }, clientCreatedAt);
    await cacheDeliveryOrder(order);
    await invalidateApiCache(...DELIVERY_INVALIDATION_PATHS);
    publishDeliveryEvents(order.id);
    return order;
  } catch (error) {
    if (error instanceof ApiError && error.status > 0 && error.status < 500) {
      throw error;
    }

    const session = getStoredSession();
    if (!session) {
      throw error;
    }

    await assertNoKnownDeliveryDuplicate(normalizedMobileNumber, {
      settings: options?.settings,
      referenceDate: clientCreatedAt,
    });
    const queuedOrder = await queueOfflineDeliveryOrder(
      {
        customerName: input.customerName,
        mobileNumber: normalizedMobileNumber,
        province: input.province,
        extraAddress: input.extraAddress,
        note: input.note,
        specialRequests: input.specialRequests,
        items: input.items,
        subtotal: input.subtotal,
        total: input.total,
        clientCreatedAt,
      },
      session,
    );
    publishDeliveryEvents(queuedOrder.id);
    return queuedOrder;
  }
};

export const updateDeliveryOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  actor: Actor,
  cancelReason = '',
) => {
  const normalizedCancelReason = normalizeCancelReason(actor, cancelReason);

  const session = getStoredSession();
  const queuedOrder = session ? await getQueuedDeliveryOrderById(orderId, session) : null;
  if (queuedOrder) {
    if (status !== 'cancelled' || session?.role !== 'employee') {
      throw new Error('ئەو داواکاریی گەیاندنە هێشتا لە ئامێرەکەدایە و تەنها دەتوانرێت هەڵوەشێندرێتەوە.');
    }

    await cancelQueuedDeliveryOrder(orderId, session);
    const updatedOrder: DeliveryOrder = {
      ...queuedOrder,
      status: 'cancelled',
      cancelReason: normalizedCancelReason,
      updatedAt: new Date().toISOString(),
      offlineState: 'queued',
      syncError: null,
    };
    publishDeliveryUpdateEvents(orderId);
    return updatedOrder;
  }

  const order = await apiRequest<DeliveryOrder>(`/api/delivery-orders/${orderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      cancelReason: normalizedCancelReason,
    }),
  });
  await cacheDeliveryOrder(order);
  await invalidateApiCache(...DELIVERY_INVALIDATION_PATHS);
  publishDeliveryUpdateEvents(orderId);
  return order;
};

export const flushOfflineDeliveryOrders = async () => {
  const session = getStoredSession();
  if (!session) {
    return { syncedCount: 0, failedCount: 0 };
  }

  return flushQueuedDeliveryOrdersForSession(session);
};
