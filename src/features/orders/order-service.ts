import { apiRequest, ApiError, invalidateApiCache } from '../../lib/api';
import { readLastSession, readSession } from '../../lib/storage';
import { publishSyncEvent } from '../../lib/sync';
import type { Actor, Order, OrderItem, OrderStatus, Session, UserRole } from '../../types/models';
import {
  cancelQueuedOrder,
  flushQueuedOrdersForSession,
  getQueuedOrderById,
  listQueuedOrdersForSession,
  mergeOrdersWithQueued,
  queueOfflineOrder,
} from './offline-order-outbox';

export interface CreateOrderInput {
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

const ORDER_LIST_TTL_MS = 12_000;
const ORDER_DETAIL_TTL_MS = 10_000;
const ORDER_INVALIDATION_PATHS = [
  '/api/orders',
  '/api/notifications',
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

const publishOrderEvents = (orderId: string) => {
  publishSyncEvent('order-created', orderId);
  publishSyncEvent('notification-changed', orderId);
};

const createRemoteOrder = async (input: CreateOrderInput, clientCreatedAt: string) =>
  apiRequest<Order>('/api/orders', {
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

export const getAllOrders = async () =>
  apiRequest<Order[]>('/api/orders?scope=all', {
    localCache: { ttlMs: ORDER_LIST_TTL_MS },
  });

export const getOrderById = async (orderId: string) => {
  try {
    return await apiRequest<Order>(`/api/orders/${orderId}`, {
      localCache: { ttlMs: ORDER_DETAIL_TTL_MS },
    });
  } catch (error) {
    const session = getStoredSession();
    const queuedOrder = session ? await getQueuedOrderById(orderId, session) : null;
    if (queuedOrder) {
      return queuedOrder;
    }

    throw error;
  }
};

export const getOrdersByCreator = async (creatorName: string) => {
  void creatorName;
  const session = getStoredSession();
  const queuedOrders = session ? await listQueuedOrdersForSession(session) : [];

  try {
    const orders = await apiRequest<Order[]>('/api/orders?scope=mine', {
      localCache: { ttlMs: ORDER_LIST_TTL_MS },
    });
    return mergeOrdersWithQueued(orders, queuedOrders);
  } catch (error) {
    if (queuedOrders.length > 0) {
      return queuedOrders;
    }

    throw error;
  }
};

export const createOrder = async (input: CreateOrderInput) => {
  const clientCreatedAt = new Date().toISOString();

  try {
    const order = await createRemoteOrder(input, clientCreatedAt);
    await invalidateApiCache(...ORDER_INVALIDATION_PATHS);
    publishOrderEvents(order.id);
    return order;
  } catch (error) {
    if (error instanceof ApiError && error.status > 0 && error.status < 500) {
      throw error;
    }

    const session = getStoredSession();
    if (!session) {
      throw error;
    }

    const queuedOrder = await queueOfflineOrder(
      {
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
      },
      session,
    );
    publishOrderEvents(queuedOrder.id);
    return queuedOrder;
  }
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  actor: Actor,
  cancelReason = '',
) => {
  const normalizedCancelReason = normalizeCancelReason(actor, cancelReason);

  const session = getStoredSession();
  const queuedOrder = session ? await getQueuedOrderById(orderId, session) : null;
  if (queuedOrder) {
    if (status !== 'cancelled' || session?.role !== 'employee') {
      throw new Error('ئەو داواکارییە هێشتا لە ئامێرەکەدایە و تەنها دەتوانرێت هەڵوەشێندرێتەوە.');
    }

    await cancelQueuedOrder(orderId, session);
    return {
      ...queuedOrder,
      status: 'cancelled' as const,
      cancelReason: normalizedCancelReason,
      updatedAt: new Date().toISOString(),
      offlineState: 'queued' as const,
      syncError: null,
    };
  }

  const order = await apiRequest<Order>(`/api/orders/${orderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      cancelReason: normalizedCancelReason,
    }),
  });
  await invalidateApiCache(...ORDER_INVALIDATION_PATHS);
  publishSyncEvent('order-updated', orderId);
  publishSyncEvent('notification-changed', orderId);
  return order;
};

export const flushOfflineOrders = async () => {
  const session = getStoredSession();
  if (!session) {
    return { syncedCount: 0, failedCount: 0 };
  }

  return flushQueuedOrdersForSession(session);
};
