import { ClipboardList, Search, Truck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { getAllDeliveryOrders } from '../delivery/delivery-service';
import { getAllOrders } from '../orders/order-service';

type SortOption = 'newest' | 'oldest' | 'total_desc' | 'total_asc';

export const AdminOrdersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = usePersistentState('admin-orders-filters', {
    search: '',
    status: 'all',
    sort: 'newest' as SortOption,
  });
  const activeScope = (() => {
    const scope = searchParams.get('scope');
    return scope === 'travel' || scope === 'delivery' ? scope : 'all';
  })();

  const { data, loading, error } = useLiveQuery(
    async () => {
      const [orders, deliveryOrders] = await Promise.all([getAllOrders(), getAllDeliveryOrders()]);
      return { orders, deliveryOrders };
    },
    {
      orders: [],
      deliveryOrders: [],
    },
    ['order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  const normalizedSearch = filters.search.trim().toLowerCase();
  const travelOrders = data.orders.map((order) => ({
    ...order,
    kind: 'travel' as const,
    detailsTo: `/admin/orders/${order.id}`,
  }));
  const deliveryOrders = data.deliveryOrders.map((order) => ({
    ...order,
    kind: 'delivery' as const,
    detailsTo: `/admin/delivery-orders/${order.id}`,
  }));
  const activeOrders =
    activeScope === 'travel'
      ? travelOrders
      : activeScope === 'delivery'
        ? deliveryOrders
        : [...travelOrders, ...deliveryOrders];
  const scopeMeta = {
    all: {
      eyebrow: 'داواکاریەکان',
      title: 'بینینی هەموو داواکاریەکان',
      emptyTitle: 'هیچ داواکارییەک نییە',
      emptyDescription: 'کاتێک سەفەری یان گەیاندن تۆمار بکرێت، لێرە دەردەکەوێت.',
    },
    travel: {
      eyebrow: 'سەفەری',
      title: 'بەڕێوەبردنی سەفەریەکان',
      emptyTitle: 'هیچ سەفەرییەک نییە',
      emptyDescription: 'کاتێک کارمەند سەفەری بنێرێت، لێرە دەردەکەوێت.',
    },
    delivery: {
      eyebrow: 'گەیاندن',
      title: 'بەڕێوەبردنی گەیاندنەکان',
      emptyTitle: 'هیچ گەیاندنێک نییە',
      emptyDescription: 'کاتێک کارمەند گەیاندن بنێرێت، لێرە دەردەکەوێت.',
    },
  } as const;
  const stats = {
    total: activeOrders.length,
    pending: activeOrders.filter((order) => order.status === 'pending_captain').length,
    accepted: activeOrders.filter((order) => order.status === 'accepted').length,
    completed: activeOrders.filter((order) => order.status === 'completed').length,
    cancelled: activeOrders.filter((order) => order.status === 'cancelled').length,
  };

  const filteredOrders = activeOrders
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
        eyebrow={scopeMeta[activeScope].eyebrow}
        icon={ClipboardList}
        title={scopeMeta[activeScope].title}
        statsGridClassName="grid-cols-2"
        stats={[
          { label: 'کۆی گشتی', value: stats.total, tone: 'border-brand-100 bg-white/80 text-stone-900' },
          { label: 'چاوەڕێ', value: stats.pending, tone: 'border-amber-100 bg-amber-50/70 text-stone-900' },
          { label: 'قبوڵکراوە', value: stats.accepted, tone: 'border-sky-100 bg-sky-50/70 text-stone-900' },
          { label: 'تەواوبوو', value: stats.completed, tone: 'border-emerald-100 bg-emerald-50/70 text-stone-900' },
        ]}
      >
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'all' as const, label: 'هەمووی', icon: ClipboardList },
            { value: 'travel' as const, label: 'سەفەری', icon: ClipboardList },
            { value: 'delivery' as const, label: 'گەیاندن', icon: Truck },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (item.value === 'all') {
                  next.delete('scope');
                } else {
                  next.set('scope', item.value);
                }
                setSearchParams(next, { replace: true });
              }}
              className={`rounded-[1.5rem] border px-4 py-3 text-right transition ${activeScope === item.value ? 'border-white/10 bg-white text-stone-900 shadow-xl' : 'border-white/10 bg-white/10 text-white hover:bg-white/15'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] ${activeScope === item.value ? 'bg-stone-100 text-stone-900' : 'bg-white/10 text-white'}`}>
                  <item.icon className="h-4.5 w-4.5" />
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeScope === item.value ? 'bg-stone-100 text-stone-700' : 'bg-white/10 text-white/80'}`}>
                  {item.value === 'all' ? data.orders.length + data.deliveryOrders.length : item.value === 'travel' ? data.orders.length : data.deliveryOrders.length}
                </span>
              </div>
              <p className={`mt-3 text-base font-black ${activeScope === item.value ? 'text-stone-900' : 'text-white'}`}>{item.label}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pr-11"
              placeholder="گەڕان بە کۆدی داواکاری، ناوی کڕیار، مۆبایل، یان ناوی کارمەند..."
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
          <ButtonRow
            onClear={() =>
              setFilters({
                search: '',
                status: 'all',
                sort: 'newest',
              })
            }
          />
        </div>
      </AdminHeroCard>

      <Card className="space-y-4">
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
          <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600">{filteredOrders.length} ئەنجام</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'هەموو' },
            { value: 'pending_captain', label: 'چاوەڕێ' },
            { value: 'accepted', label: 'قبوڵکراوە' },
            { value: 'completed', label: 'تەواوبوو' },
            { value: 'cancelled', label: 'هەڵوەشاوە' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${filters.status === item.value ? 'bg-stone-950 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              onClick={() => setFilters((current) => ({ ...current, status: item.value }))}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی داواکاریەکان" description={error} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title={activeOrders.length === 0 ? scopeMeta[activeScope].emptyTitle : 'هیچ ئەنجامێک بەم فلتەرە نەدۆزرایەوە'}
          description={
            activeOrders.length === 0
              ? scopeMeta[activeScope].emptyDescription
              : 'گەڕان یان فلتەرەکان بگۆڕە.'
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:hidden">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-stone-900">{order.orderNumber}</p>
                      {activeScope === 'all' ? (
                        <Badge className={order.kind === 'travel' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-sky-200 bg-sky-50 text-sky-800'}>
                          {order.kind === 'travel' ? 'سەفەری' : 'گەیاندن'}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">{order.customerName}</p>
                    <p className="mt-1 text-xs text-stone-500">{order.mobileNumber}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="grid gap-3 rounded-[1.8rem] bg-stone-50 p-4 text-sm">
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
                    <span className="font-black text-brand-800">{formatCurrency(order.total)}</span>
                  </div>
                </div>

                <Link to={order.detailsTo} className="inline-flex items-center gap-2 font-semibold text-brand-700 transition hover:text-brand-900">
                  <span>بینینی وردەکاری</span>
                </Link>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-4 py-4 text-right font-semibold">ژمارە</th>
                    <th className="px-4 py-4 text-right font-semibold">کڕیار</th>
                    <th className="px-4 py-4 text-right font-semibold">کارمەند</th>
                    <th className="px-4 py-4 text-right font-semibold">مۆبایل</th>
                    <th className="px-4 py-4 text-right font-semibold">دۆخ</th>
                    <th className="px-4 py-4 text-right font-semibold">کۆ</th>
                    <th className="px-4 py-4 text-right font-semibold">کات</th>
                    <th className="px-4 py-4 text-right font-semibold">کردار</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-stone-100">
                      <td className="px-4 py-4 font-black text-stone-900">
                        <div className="space-y-2">
                          <p>{order.orderNumber}</p>
                          {activeScope === 'all' ? (
                            <Badge className={order.kind === 'travel' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-sky-200 bg-sky-50 text-sky-800'}>
                              {order.kind === 'travel' ? 'سەفەری' : 'گەیاندن'}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-700">{order.customerName}</td>
                      <td className="px-4 py-4 text-stone-700">{order.createdByName}</td>
                      <td className="px-4 py-4 text-stone-600">{order.mobileNumber}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-4 font-black text-brand-800">{formatCurrency(order.total)}</td>
                      <td className="px-4 py-4 text-stone-600">{formatDateTime(order.createdAt)}</td>
                      <td className="px-4 py-4">
                        <Link to={order.detailsTo} className="font-semibold text-brand-700 transition hover:text-brand-900">
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

const ButtonRow = ({ onClear }: { onClear: () => void }) => (
  <button
    type="button"
    className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-200"
    onClick={onClear}
  >
    پاککردنەوەی فلتەر
  </button>
);
