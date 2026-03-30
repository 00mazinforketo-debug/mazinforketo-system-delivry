import { BellRing, Search, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { cn } from '../../lib/cn';
import { formatDateTime, getRoleLabel } from '../../lib/format';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { getAllDeliveryOrders } from '../delivery/delivery-service';
import { clearAllDeliveryNotifications, getAllDeliveryNotifications } from '../delivery/delivery-notification-service';
import { clearAllNotifications, getAllNotifications } from '../notifications/notification-service';
import { getAllOrders } from '../orders/order-service';

type AdminNotificationFilter = 'all' | 'travel' | 'delivery' | 'employee';
type UnifiedAdminNotification = {
  id: string;
  notificationId: string;
  kind: 'travel' | 'delivery';
  targetRole: 'employee' | 'captain' | 'admin';
  targetDisplayName: string | null;
  orderId: string;
  orderNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const filterButtonClass = (active: boolean) =>
  cn(
    'rounded-[1.4rem] border px-4 py-3 text-right text-sm font-black transition',
    active
      ? 'border-stone-900 bg-stone-950 text-white shadow-card'
      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50',
  );

export const AdminNotificationsPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [search, setSearch] = usePersistentState('admin-notifications-search', '');
  const [activeFilter, setActiveFilter] = usePersistentState<AdminNotificationFilter>('admin-notifications-filter', 'all');
  const [clearOpen, setClearOpen] = useState(false);

  const { data, loading, error, reload } = useLiveQuery(
    async () => {
      const [travelNotifications, deliveryNotifications, travelOrders, deliveryOrders] = await Promise.all([
        getAllNotifications(),
        getAllDeliveryNotifications(),
        getAllOrders(),
        getAllDeliveryOrders(),
      ]);
      return {
        notifications: [
          ...travelNotifications.map<UnifiedAdminNotification>((notification) => ({
            id: `travel-${notification.id}`,
            notificationId: notification.id,
            kind: 'travel',
            targetRole: notification.targetRole,
            targetDisplayName: notification.targetDisplayName,
            orderId: notification.orderId,
            orderNumber: notification.orderNumber,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
          })),
          ...deliveryNotifications.map<UnifiedAdminNotification>((notification) => ({
            id: `delivery-${notification.id}`,
            notificationId: notification.id,
            kind: 'delivery',
            targetRole: notification.targetRole,
            targetDisplayName: notification.targetDisplayName,
            orderId: notification.deliveryOrderId,
            orderNumber: notification.deliveryOrderNumber,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
          })),
        ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
        travelOrders,
        deliveryOrders,
      };
    },
    {
      notifications: [] as UnifiedAdminNotification[],
      travelOrders: [],
      deliveryOrders: [],
    },
    ['notification-changed', 'delivery-notification-changed', 'order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const normalizedSearch = search.trim().toLowerCase();
  const travelOrderMap = new Map(data.travelOrders.map((order) => [order.id, order]));
  const deliveryOrderMap = new Map(data.deliveryOrders.map((order) => [order.id, order]));
  const notificationsWithinFilter = data.notifications.filter((notification) => {
    if (activeFilter === 'all') {
      return true;
    }

    if (activeFilter === 'employee') {
      return notification.targetRole === 'employee';
    }

    return notification.kind === activeFilter;
  });
  const filteredNotifications = data.notifications.filter((notification) => {
    if (activeFilter !== 'all') {
      if (activeFilter === 'employee' && notification.targetRole !== 'employee') {
        return false;
      }

      if (activeFilter !== 'employee' && notification.kind !== activeFilter) {
        return false;
      }
    }

    const linkedOrder = notification.kind === 'delivery' ? deliveryOrderMap.get(notification.orderId) : travelOrderMap.get(notification.orderId);
    const matchesSearch =
      !normalizedSearch ||
      notification.title.toLowerCase().includes(normalizedSearch) ||
      notification.message.toLowerCase().includes(normalizedSearch) ||
      notification.orderNumber.toLowerCase().includes(normalizedSearch) ||
      (notification.targetDisplayName ?? '').toLowerCase().includes(normalizedSearch) ||
      (linkedOrder?.customerName ?? '').toLowerCase().includes(normalizedSearch) ||
      (linkedOrder?.mobileNumber ?? '').toLowerCase().includes(normalizedSearch);
    return matchesSearch;
  });

  const unreadCount = notificationsWithinFilter.filter((notification) => !notification.isRead).length;
  const filterCounts: Record<AdminNotificationFilter, number> = {
    all: data.notifications.length,
    travel: data.notifications.filter((notification) => notification.kind === 'travel').length,
    delivery: data.notifications.filter((notification) => notification.kind === 'delivery').length,
    employee: data.notifications.filter((notification) => notification.targetRole === 'employee').length,
  };
  const filterItems: Array<{ value: AdminNotificationFilter; label: string; icon: typeof BellRing }> = [
    { value: 'all', label: 'هەمووی', icon: BellRing },
    { value: 'travel', label: 'سەفەری', icon: BellRing },
    { value: 'delivery', label: 'گەیاندن', icon: Truck },
    { value: 'employee', label: 'کارمەند', icon: BellRing },
  ];

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="ئاگەدارکردنەوە"
        icon={BellRing}
        title="هەموو ئاگەدارکردنەوەیێک"
        statsGridClassName="grid-cols-2"
        stats={[
          { label: 'کۆی پەیام', value: notificationsWithinFilter.length },
          { label: 'نەخوێندراوە', value: unreadCount, tone: 'border-brand-300/20 bg-brand-300/10' },
        ]}
        actions={
          <Button
            variant="secondary"
            className="border border-stone-200 bg-white text-stone-900 hover:bg-stone-100"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setClearOpen(true)}
            disabled={data.notifications.length === 0}
          >
            پاککردنەوەی هەموو ئاگەدارکردنەوەکان
          </Button>
        }
      />

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {filterItems.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                className={filterButtonClass(isActive)}
                onClick={() => setActiveFilter(filter.value)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-[1rem]', isActive ? 'bg-white/10 text-white' : 'bg-stone-100 text-stone-700')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', isActive ? 'bg-white/10 text-white' : 'bg-stone-100 text-stone-600')}>
                    {filterCounts[filter.value]}
                  </span>
                </div>
                <p className="mt-3">{filter.label}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input className="pr-11" placeholder="گەڕان بە عنوان، کۆدی order، ناوی بەکارهێنەر یان مۆبایل..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی notifications" description={error} />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          title={data.notifications.length === 0 ? 'هیچ ئاگەدارکردنەوەیەک نییە' : 'بەم فلتەرە ئاگەدارکردنەوە نەدۆزرایەوە'}
          description={
            data.notifications.length === 0
              ? undefined
              : 'گەڕان یان filter ـەکە بگۆڕە.'
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredNotifications.map((notification) => {
            const orderStatus =
              notification.kind === 'delivery'
                ? deliveryOrderMap.get(notification.orderId)?.status
                : travelOrderMap.get(notification.orderId)?.status;
            return (
              <Card
                key={notification.id}
                className={cn(
                  'space-y-4',
                  notification.kind === 'delivery'
                    ? notification.isRead
                      ? 'border-sky-100 bg-white/95'
                      : 'border-sky-200 bg-sky-50/80'
                    : notification.isRead
                      ? 'border-stone-200 bg-white/90'
                      : 'border-brand-200 bg-brand-50/80',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={cn('flex h-11 w-11 items-center justify-center rounded-3xl', notification.kind === 'delivery' ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-700')}>
                        {notification.kind === 'delivery' ? <Truck className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                      </div>
                      <Badge className={cn('border-white bg-white', notification.kind === 'delivery' ? 'text-sky-700' : 'text-stone-700')}>
                        {notification.kind === 'delivery' ? 'گەیاندن' : 'سەفەری'}
                      </Badge>
                      <Badge className="border-stone-200 bg-white text-stone-700">{getRoleLabel(notification.targetRole)}</Badge>
                      {notification.targetDisplayName ? <Badge className="border-brand-200 bg-white text-brand-800">{notification.targetDisplayName}</Badge> : null}
                      {!notification.isRead ? <Badge className="border-brand-200 bg-white text-brand-800">نوێ</Badge> : null}
                    </div>
                    <p className="text-lg font-black text-stone-900">{notification.title}</p>
                    <p className="text-sm leading-7 text-stone-600">{notification.message}</p>
                  </div>
                  {orderStatus ? <StatusBadge status={orderStatus} /> : null}
                </div>

                <div className="rounded-[1.6rem] bg-stone-50 p-4 text-sm text-stone-600">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-stone-500">کۆدی order</p>
                      <p className="mt-1 font-black text-stone-900">{notification.orderNumber}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-stone-500">کات</p>
                      <p className="mt-1 font-semibold text-stone-900">{formatDateTime(notification.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-stone-500">ID: {notification.notificationId.slice(0, 10)}</span>
                  <Link
                    to={notification.kind === 'delivery' ? `/admin/delivery-orders/${notification.orderId}` : `/admin/orders/${notification.orderId}`}
                    className="font-semibold text-brand-700 transition hover:text-brand-900"
                  >
                    بینینی order
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        title="پاککردنەوەی هەموو ئاگەدارکردنەوەکان"
        description="ئەم کارە هەموو ئاگەدارکردنەوەکانی سەفەری و گەیاندن لادەبات."
        confirmLabel="پاکبکەوە"
        tone="danger"
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          void (async () => {
            try {
              await Promise.all([clearAllNotifications(actor), clearAllDeliveryNotifications()]);
              setClearOpen(false);
              await reload();
              showToast('هەموو ئاگەدارکردنەوەکان پاککرانەوە.', 'success');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
            }
          })();
        }}
      />
    </div>
  );
};
