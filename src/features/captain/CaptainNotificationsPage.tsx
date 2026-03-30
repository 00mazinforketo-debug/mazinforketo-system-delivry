import { useEffect } from 'react';
import { ArrowLeft, Bell, ClipboardList, Search, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { cn } from '../../lib/cn';
import { formatDateTime, formatNumber, getStatusLabel, getStatusTone } from '../../lib/format';
import type { DeliveryNotification, DeliveryOrder, NotificationItem, Order, OrderMode } from '../../types/models';
import { useSessionStore } from '../../stores/session-store';
import { getAllDeliveryOrders } from '../delivery/delivery-service';
import { getDeliveryNotificationsForSession, markDeliveryNotificationsAsReadForSession } from '../delivery/delivery-notification-service';
import { getNotificationsForSession, markNotificationsAsReadForSession } from '../notifications/notification-service';
import { getAllOrders } from '../orders/order-service';
import { CaptainDateRangeFilter } from './CaptainDateRangeFilter';
import { CaptainShell } from './CaptainShell';
import type { CaptainDateRangeValue } from './captain-date-range';
import { isTimestampInCaptainDateRange } from './captain-date-range';

type CaptainNotificationFilter = 'all' | OrderMode;
type UnifiedCaptainNotification = {
  id: string;
  kind: OrderMode;
  orderId: string;
  orderNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const notificationFilters: Array<{ value: CaptainNotificationFilter; label: string }> = [
  { value: 'all', label: 'هەمووی' },
  { value: 'travel', label: 'سەفەری' },
  { value: 'delivery', label: 'گەیاندن' },
];

export const CaptainNotificationsPage = () => {
  const session = useSessionStore((state) => state.session);
  const [search, setSearch] = usePersistentState('captain-notifications-search', '');
  const [activeFilter, setActiveFilter] = usePersistentState<CaptainNotificationFilter>('captain-notifications-filter', 'all');
  const [dateRange, setDateRange] = usePersistentState<CaptainDateRangeValue>('captain-notifications-date-range', { fromDate: '', toDate: '' });
  const {
    data: notificationState,
    loading,
    error,
    reload,
  } = useLiveQuery(
    async () => {
      if (!session) {
        return {
          notifications: [] as UnifiedCaptainNotification[],
          travelOrders: [] as Order[],
          deliveryOrders: [] as DeliveryOrder[],
        };
      }

      const [travelNotifications, deliveryNotifications, travelOrders, deliveryOrders] = await Promise.all([
        getNotificationsForSession(session),
        getDeliveryNotificationsForSession(session),
        getAllOrders(),
        getAllDeliveryOrders(),
      ]);

      const notifications = [
        ...travelNotifications.map<UnifiedCaptainNotification>((notification: NotificationItem) => ({
          id: `travel-${notification.id}`,
          kind: 'travel',
          orderId: notification.orderId,
          orderNumber: notification.orderNumber,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        })),
        ...deliveryNotifications.map<UnifiedCaptainNotification>((notification: DeliveryNotification) => ({
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
      notifications: [] as UnifiedCaptainNotification[],
      travelOrders: [] as Order[],
      deliveryOrders: [] as DeliveryOrder[],
    },
    ['notification-changed', 'delivery-notification-changed', 'order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'view-state-changed', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    void (async () => {
      await Promise.all([markNotificationsAsReadForSession(session), markDeliveryNotificationsAsReadForSession(session).catch(() => false)]);
      await reload();
    })();
  }, [reload, session]);

  if (!session) {
    return null;
  }

  const orderLookup = new Map(notificationState.travelOrders.map((order) => [order.id, order]));
  const deliveryOrderLookup = new Map(notificationState.deliveryOrders.map((order) => [order.id, order]));
  const query = search.trim().toLowerCase();
  const notificationsWithinDateRange = notificationState.notifications.filter((notification) => isTimestampInCaptainDateRange(notification.createdAt, dateRange));
  const notificationsWithinModeAndDate = notificationsWithinDateRange.filter((notification) => {
    if (activeFilter !== 'all' && notification.kind !== activeFilter) {
      return false;
    }

    return true;
  });
  const filteredNotifications = notificationsWithinModeAndDate.filter((notification) => {
    if (!query) {
      return true;
    }

    const linkedOrder = notification.kind === 'delivery' ? deliveryOrderLookup.get(notification.orderId) : orderLookup.get(notification.orderId);
    return (
      notification.orderNumber.toLowerCase().includes(query) ||
      notification.title.toLowerCase().includes(query) ||
      notification.message.toLowerCase().includes(query) ||
      linkedOrder?.customerName.toLowerCase().includes(query) ||
      linkedOrder?.mobileNumber.toLowerCase().includes(query)
    );
  });

  const counts = {
    total: notificationsWithinModeAndDate.length,
    unread: notificationsWithinModeAndDate.filter((notification) => !notification.isRead).length,
    all: notificationsWithinDateRange.length,
    travel: notificationsWithinDateRange.filter((notification) => notification.kind === 'travel').length,
    delivery: notificationsWithinDateRange.filter((notification) => notification.kind === 'delivery').length,
  };

  return (
    <CaptainShell>
      <section className="space-y-6">
        <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/60">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-3">
                <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                  <Bell className="h-3.5 w-3.5" />
                  <span>ئاگەدارکردنەوەکان</span>
                </Badge>
                <div>
                  <h1 className="text-3xl font-black text-stone-900">ئاگەدارکردنەوەی کاپتن</h1>
                </div>
              </div>
            </div>

            <CaptainDateRangeFilter value={dateRange} onChange={setDateRange} />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.8rem] bg-stone-950 p-4 text-white">
                <p className="text-xs text-stone-300">کۆی گشتی</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.total)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-amber-50 p-4 text-amber-900">
                <p className="text-xs text-amber-700">نەخوێندراوە</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.unread)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-brand-50 p-4 text-brand-900">
                <p className="text-xs text-brand-700">سەفەری</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.travel)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-sky-50 p-4 text-sky-900">
                <p className="text-xs text-sky-700">گەیاندن</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.delivery)}</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
              <div className="grid grid-cols-3 gap-2">
                {notificationFilters.map((filter) => {
                  const isActive = activeFilter === filter.value;
                  const count = counts[filter.value];
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      className={cn(
                        'rounded-[1.3rem] border px-3 py-3 text-sm font-black transition',
                        isActive
                          ? 'border-brand-700 bg-brand-700 text-white shadow-card'
                          : 'border-white/80 bg-white/95 text-stone-700 hover:border-brand-200 hover:bg-brand-50',
                      )}
                      onClick={() => setActiveFilter(filter.value)}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={cn(
                          'mr-2 inline-flex rounded-full px-2 py-0.5 text-xs',
                          isActive ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-600',
                        )}
                      >
                        {formatNumber(count)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  className="rounded-[1.5rem] border-white/80 bg-white/90 pr-11"
                  placeholder="گەڕان بە کۆد، ناو یان ژمارەی مۆبایل..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState title="هەڵە لە بارکردنی ئاگەدارکردنەوەکان" description={error} />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState title="هێشتا ئاگەدارکردنەوە نییە" description="کاتێک داواکارییەک بنێردرێت یان دۆخی بگۆڕێت، لێرە دەردەکەوێت." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredNotifications.map((notification) => {
              const linkedOrder = notification.kind === 'delivery' ? deliveryOrderLookup.get(notification.orderId) : orderLookup.get(notification.orderId);
              const statusLabel = linkedOrder?.status ? getStatusLabel(linkedOrder.status) : 'بێ دۆخ';
              const statusTone = linkedOrder?.status ? getStatusTone(linkedOrder.status) : 'border-stone-200 bg-stone-100 text-stone-700';

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    'space-y-5 overflow-hidden border-stone-200',
                    notification.kind === 'delivery'
                      ? notification.isRead
                        ? 'border-sky-100 bg-white/95'
                        : 'border-sky-200 bg-sky-50/80'
                      : notification.isRead
                        ? 'border-stone-200 bg-white/90'
                        : 'border-brand-200 bg-brand-50/70',
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3 text-right">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={notification.kind === 'delivery' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-brand-200 bg-brand-50 text-brand-800'}>
                          {notification.kind === 'delivery' ? <Truck className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                          <span>{notification.kind === 'delivery' ? 'گەیاندن' : 'سەفەری'}</span>
                        </Badge>
                        <Badge className={statusTone}>{statusLabel}</Badge>
                        {!notification.isRead ? <Badge className="border-brand-200 bg-white text-brand-800">نوێ</Badge> : null}
                      </div>
                      <div>
                        <p className="text-lg font-black text-stone-900">{notification.title}</p>
                        <p className="mt-2 text-sm leading-7 text-stone-600">{notification.message}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs font-semibold text-stone-500">
                      <p>{notification.orderNumber}</p>
                      <p className="mt-1">{formatDateTime(notification.createdAt)}</p>
                    </div>
                  </div>

                  {linkedOrder ? (
                    <div className="grid gap-3 rounded-[1.8rem] border border-white/70 bg-white/80 p-4 text-sm sm:grid-cols-2">
                      <div className="text-right">
                        <p className="text-stone-500">ناوی کڕیار</p>
                        <p className="mt-1 font-bold text-stone-900">{linkedOrder.customerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-stone-500">ژمارەی مۆبایل</p>
                        <p className="mt-1 font-bold text-stone-900 [unicode-bidi:plaintext]" dir="ltr">
                          {linkedOrder.mobileNumber}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Link
                      to={notification.kind === 'delivery' ? `/delivery-orders/${notification.orderId}` : `/orders/${notification.orderId}`}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                        notification.kind === 'delivery' ? 'bg-sky-100 text-sky-800 hover:bg-sky-200' : 'bg-stone-100 text-stone-800 hover:bg-stone-200',
                      )}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>بینینی وردەکاری</span>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </CaptainShell>
  );
};
