import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { cn } from '../../lib/cn';
import { formatDateTime, getStatusLabel, getStatusTone } from '../../lib/format';
import type { DeliveryNotification, DeliveryOrder, Order } from '../../types/models';
import { useSessionStore } from '../../stores/session-store';
import { getNotificationsForSession, markNotificationsAsReadForSession } from '../notifications/notification-service';
import { getDeliveryNotificationsForSession, markDeliveryNotificationsAsReadForSession } from '../delivery/delivery-notification-service';
import { getDeliveryOrdersByCreator } from '../delivery/delivery-service';
import { getOrdersByCreator } from '../orders/order-service';
import { EmployeeShell } from './EmployeeShell';

type EmployeeNotificationFilter = 'all' | 'travel' | 'delivery';

type UnifiedNotification = {
  id: string;
  kind: EmployeeNotificationFilter;
  orderId: string;
  orderNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const notificationFilters: Array<{ value: EmployeeNotificationFilter; label: string }> = [
  { value: 'all', label: 'هەمووی' },
  { value: 'travel', label: 'سەفەری' },
  { value: 'delivery', label: 'گەیاندن' },
];

const getNotificationStatusMeta = (status?: Order['status']) =>
  status
    ? {
        label: getStatusLabel(status),
        tone: getStatusTone(status),
      }
    : {
        label: 'بێ دۆخ',
        tone: 'border-stone-200 bg-stone-100 text-stone-700',
      };

export const EmployeeNotificationsPage = () => {
  const session = useSessionStore((state) => state.session);
  const [search, setSearch] = usePersistentState('employee-notifications-search', '');
  const [activeFilter, setActiveFilter] = usePersistentState<EmployeeNotificationFilter>('employee-notifications-filter', 'all');
  const {
    data: notificationState,
    loading,
    error,
    reload,
  } = useLiveQuery<{
    notifications: UnifiedNotification[];
    travelOrders: Order[];
    deliveryOrders: DeliveryOrder[];
  }>(
    async () => {
      if (!session) {
        return {
          notifications: [] as UnifiedNotification[],
          travelOrders: [] as Order[],
          deliveryOrders: [] as DeliveryOrder[],
        };
      }

      const [travelNotifications, deliveryNotifications, travelOrders, deliveryOrders] = await Promise.all([
        getNotificationsForSession(session),
        getDeliveryNotificationsForSession(session),
        getOrdersByCreator(session.displayName),
        getDeliveryOrdersByCreator(session.displayName),
      ]);

      const notifications = [
        ...travelNotifications.map<UnifiedNotification>((notification) => ({
          id: `travel-${notification.id}`,
          kind: 'travel',
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        })),
        ...deliveryNotifications.map<UnifiedNotification>((notification: DeliveryNotification) => ({
          id: `delivery-${notification.id}`,
          kind: 'delivery',
          orderId: notification.deliveryOrderId,
          orderNumber: notification.deliveryOrderNumber,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        })),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return { notifications, travelOrders, deliveryOrders };
    },
    {
      notifications: [] as UnifiedNotification[],
      travelOrders: [] as Order[],
      deliveryOrders: [] as DeliveryOrder[],
    },
    [
      'notification-changed',
      'delivery-notification-changed',
      'order-created',
      'order-updated',
      'delivery-order-created',
      'delivery-order-updated',
      'view-state-changed',
      'reset-performed',
    ],
    { pollIntervalMs: 10000, backgroundPollIntervalMs: 18000 },
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    void (async () => {
      await Promise.all([
        markNotificationsAsReadForSession(session),
        markDeliveryNotificationsAsReadForSession(session).catch(() => false),
      ]);
      await reload();
    })();
  }, [reload, session]);

  if (!session) {
    return null;
  }

  const orderLookup = new Map(notificationState.travelOrders.map((order) => [order.id, order]));
  const deliveryOrderLookup = new Map(notificationState.deliveryOrders.map((order) => [order.id, order]));
  const query = search.trim().toLowerCase();
  const filteredNotifications = notificationState.notifications.filter((notification) => {
    if (activeFilter !== 'all' && notification.kind !== activeFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    const linkedOrder = notification.kind === 'delivery' ? deliveryOrderLookup.get(notification.orderId) : orderLookup.get(notification.orderId);
    return (
      notification.orderNumber.toLowerCase().includes(query) ||
      linkedOrder?.customerName.toLowerCase().includes(query) ||
      linkedOrder?.mobileNumber.toLowerCase().includes(query) ||
      notification.title.toLowerCase().includes(query) ||
      notification.message.toLowerCase().includes(query)
    );
  });

  return (
    <EmployeeShell>
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-stone-900">ئاگەدارکردنەوەکان</h2>
            <p className="mt-1 text-sm text-stone-600">هەموو پەیامەکانی داواکاری و دۆخی نوێ لێرە دەردەکەون.</p>
          </div>
          <Badge>{filteredNotifications.length} پەیام</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {notificationFilters.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                className={cn(
                  'rounded-2xl border px-3 py-3 text-sm font-black transition',
                  isActive
                    ? 'border-brand-700 bg-brand-700 text-white shadow-card'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-brand-200 hover:bg-brand-50',
                )}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <Input
          placeholder="گەڕان بە کۆدی ئۆردەر، ناوی کڕیار یان ژمارەی موبایل..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی ئاگەدارکردنەوەکان" description={error} />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState title="هێشتا ئاگەدارکردنەوە نییە" description="کاتێک دۆخی ئۆردەرەکەت بگۆڕێت، لێرە دەردەکەوێت." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredNotifications.map((notification) => {
            const linkedOrder = notification.kind === 'delivery' ? deliveryOrderLookup.get(notification.orderId) : orderLookup.get(notification.orderId);
            const statusMeta = getNotificationStatusMeta(linkedOrder?.status);

            return (
              <Card
                key={notification.id}
                className={cn(
                  'space-y-4 text-right',
                  notification.kind === 'delivery'
                    ? notification.isRead
                      ? 'border-sky-100 bg-white/95'
                      : 'border-sky-200 bg-sky-50/80'
                    : notification.isRead
                      ? 'border-stone-200 bg-white/90'
                      : 'border-brand-200 bg-brand-50/70',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2 text-right">
                    <p className="font-black text-stone-900">{notification.title}</p>
                    <p className="text-sm leading-7 text-stone-600">{notification.message}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={notification.kind === 'delivery' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-brand-200 bg-brand-50 text-brand-800'}>
                      {notification.kind === 'delivery' ? 'گەیاندن' : 'سەفەری'}
                    </Badge>
                    <Badge className={statusMeta.tone}>{statusMeta.label}</Badge>
                    {!notification.isRead ? <Badge className="border-brand-200 bg-white text-brand-800">نوێ</Badge> : null}
                  </div>
                </div>

                {linkedOrder ? (
                  <div className="grid gap-3 rounded-3xl bg-white/80 p-4 text-sm">
                    <div className="text-right">
                      <p className="text-stone-500">ناوی کڕیار</p>
                      <p className="mt-1 font-bold text-stone-900">{linkedOrder.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-500">ژمارەی مۆبایل</p>
                      <p className="mt-1 font-bold text-stone-900 text-right [unicode-bidi:plaintext]" dir="ltr">
                        {linkedOrder.mobileNumber}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="space-y-1 text-right text-stone-500">
                    <p>{notification.orderNumber}</p>
                    <p>{formatDateTime(notification.createdAt)}</p>
                  </div>
                  <Link
                    to={notification.kind === 'delivery' ? `/delivery-orders/${notification.orderId}` : `/orders/${notification.orderId}`}
                    className={cn(
                      'font-semibold transition',
                      notification.kind === 'delivery' ? 'text-sky-700 hover:text-sky-900' : 'text-brand-700 hover:text-brand-900',
                    )}
                  >
                    بینینی ئۆردەر
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </EmployeeShell>
  );
};
