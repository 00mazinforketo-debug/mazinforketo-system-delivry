import { Search, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { getAllDeliveryNotifications, markDeliveryNotificationsAsReadForSession } from './delivery-notification-service';
import { getAllDeliveryOrders } from './delivery-service';
import { useSessionStore } from '../../stores/session-store';

type SortOption = 'newest' | 'oldest' | 'total_desc' | 'total_asc';

export const AdminDeliveryOrdersPage = () => {
  const session = useSessionStore((state) => state.session);
  const [filters, setFilters] = usePersistentState('admin-delivery-orders-filters', {
    search: '',
    status: 'all',
    sort: 'newest' as SortOption,
  });

  const { data, loading, error } = useLiveQuery(
    async () => {
      const [orders, notifications] = await Promise.all([getAllDeliveryOrders(), getAllDeliveryNotifications()]);
      return { orders, notifications };
    },
    {
      orders: [],
      notifications: [],
    },
    ['delivery-order-created', 'delivery-order-updated', 'delivery-notification-changed', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  const normalizedSearch = filters.search.trim().toLowerCase();
  const unreadByOrderId = new Map<string, number>();
  for (const notification of data.notifications) {
    if (!notification.isRead) {
      unreadByOrderId.set(notification.deliveryOrderId, (unreadByOrderId.get(notification.deliveryOrderId) ?? 0) + 1);
    }
  }

  const stats = {
    total: data.orders.length,
    pending: data.orders.filter((order) => order.status === 'pending_captain').length,
    accepted: data.orders.filter((order) => order.status === 'accepted').length,
    completed: data.orders.filter((order) => order.status === 'completed').length,
    cancelled: data.orders.filter((order) => order.status === 'cancelled').length,
  };

  const filteredOrders = data.orders
    .filter((order) => {
      const matchesStatus = filters.status === 'all' || order.status === filters.status;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        order.orderNumber.toLowerCase().includes(normalizedSearch) ||
        order.customerName.toLowerCase().includes(normalizedSearch) ||
        order.mobileNumber.includes(normalizedSearch) ||
        order.createdByName.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    })
    .sort((left, right) => {
      switch (filters.sort) {
        case 'oldest':
          return left.createdAt.localeCompare(right.createdAt);
        case 'total_desc':
          return right.total - left.total;
        case 'total_asc':
          return left.total - right.total;
        case 'newest':
        default:
          return right.createdAt.localeCompare(left.createdAt);
      }
    });

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="گەیاندن"
        icon={Truck}
        title="بەڕێوەبردنی گەیاندنەکان"
        className="border-sky-100 from-sky-700 via-sky-800 to-cyan-900"
        statsGridClassName="sm:grid-cols-2"
        stats={[
          { label: 'کۆی گشتی', value: stats.total, tone: 'border-sky-100 bg-white/80 text-stone-900' },
          { label: 'چاوەڕێ', value: stats.pending, tone: 'border-amber-100 bg-amber-50/70 text-stone-900' },
          { label: 'قبوڵکراوە', value: stats.accepted, tone: 'border-sky-100 bg-sky-50/70 text-stone-900' },
          { label: 'تەواوبوو', value: stats.completed, tone: 'border-emerald-100 bg-emerald-50/70 text-stone-900' },
        ]}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pr-11"
              placeholder="گەڕان بە delivery number، ناوی کڕیار، mobile، یان ناوی کارمەند..."
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setFilters({ search: '', status: 'all', sort: 'newest' });
              if (session) {
                void markDeliveryNotificationsAsReadForSession(session);
              }
            }}
          >
            پاککردنەوە و خوێندنەوەی نوێکان
          </Button>
        </div>
      </AdminHeroCard>

      <Card className="space-y-4 border-sky-100">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_16rem_16rem]">
          <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="all">هەموو دۆخەکان</option>
            <option value="pending_captain">چاوەڕێ</option>
            <option value="accepted">قبوڵکراوە</option>
            <option value="completed">تەواوبوو</option>
            <option value="cancelled">هەڵوەشاوە</option>
          </Select>
          <Select
            value={filters.sort}
            onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as SortOption }))}
          >
            <option value="newest">نوێترین</option>
            <option value="oldest">کۆنترین</option>
            <option value="total_desc">بە نرخ: بەرز بۆ نزم</option>
            <option value="total_asc">بە نرخ: نزم بۆ بەرز</option>
          </Select>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">{filteredOrders.length} ئەنجام</div>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی گەیاندنەکان" description={error} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title={data.orders.length === 0 ? 'هیچ گەیاندنێک نییە' : 'هیچ ئەنجامێک بەم فلتەرە نەدۆزرایەوە'}
          description={data.orders.length === 0 ? 'کاتێک کارمەند delivery order بنێرێت، لێرە دەردەکەوێت.' : 'گەڕان یان فلتەرەکان بگۆڕە.'}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:hidden">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="space-y-4 border-sky-100 bg-white/95">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-stone-900">{order.orderNumber}</p>
                      <Badge className="border-sky-200 bg-sky-50 text-sky-800">گەیاندن</Badge>
                      {(unreadByOrderId.get(order.id) ?? 0) > 0 ? (
                        <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800">نوێ {(unreadByOrderId.get(order.id) ?? 0)}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">{order.customerName}</p>
                    <p className="mt-1 text-xs text-stone-500">{order.mobileNumber}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="grid gap-3 rounded-[1.8rem] bg-sky-50/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">کارمەند</span>
                    <span className="font-semibold text-stone-900">{order.createdByName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">کات</span>
                    <span className="font-semibold text-stone-900">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-500">کۆی گشتی</span>
                    <span className="font-black text-sky-800">{formatCurrency(order.total)}</span>
                  </div>
                </div>

                <Link to={`/admin/delivery-orders/${order.id}`} className="inline-flex items-center gap-2 font-semibold text-sky-700 transition hover:text-sky-900">
                  <span>بینینی وردەکاری</span>
                </Link>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden border-sky-100 p-0 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-stone-200 bg-sky-50 text-stone-500">
                  <tr>
                    <th className="px-4 py-4 text-right font-semibold">ژمارە</th>
                    <th className="px-4 py-4 text-right font-semibold">کڕیار</th>
                    <th className="px-4 py-4 text-right font-semibold">کارمەند</th>
                    <th className="px-4 py-4 text-right font-semibold">مۆبایل</th>
                    <th className="px-4 py-4 text-right font-semibold">دۆخ</th>
                    <th className="px-4 py-4 text-right font-semibold">نوێ</th>
                    <th className="px-4 py-4 text-right font-semibold">کۆ</th>
                    <th className="px-4 py-4 text-right font-semibold">کات</th>
                    <th className="px-4 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-stone-100">
                      <td className="px-4 py-4 font-black text-stone-900">{order.orderNumber}</td>
                      <td className="px-4 py-4 text-stone-700">{order.customerName}</td>
                      <td className="px-4 py-4 text-stone-700">{order.createdByName}</td>
                      <td className="px-4 py-4 text-stone-600">{order.mobileNumber}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-4">
                        {(unreadByOrderId.get(order.id) ?? 0) > 0 ? (
                          <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800">{unreadByOrderId.get(order.id)}</Badge>
                        ) : (
                          <span className="text-stone-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-black text-sky-800">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-4 text-stone-600">{formatDateTime(order.createdAt)}</td>
                      <td className="px-4 py-4">
                        <Link to={`/admin/delivery-orders/${order.id}`} className="font-semibold text-sky-700 transition hover:text-sky-900">
                          بینینی وردەکاری
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
