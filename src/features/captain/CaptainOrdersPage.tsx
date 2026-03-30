import { useState, type ReactNode } from 'react';
import { ArrowLeft, ClipboardList, PackageCheck, Search, Truck, XCircle, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Textarea } from '../../components/ui/Textarea';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDateTime, formatNumber, getStatusLabel } from '../../lib/format';
import { getHiddenEntityIds } from '../../lib/view-state';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { DeliveryOrder, Order, OrderMode, OrderStatus } from '../../types/models';
import { getAllDeliveryOrders, updateDeliveryOrderStatus } from '../delivery/delivery-service';
import { getAllOrders, updateOrderStatus } from '../orders/order-service';
import { CaptainDateRangeFilter } from './CaptainDateRangeFilter';
import { CaptainShell } from './CaptainShell';
import type { CaptainDateRangeValue } from './captain-date-range';
import { getCaptainOrderActivityTimestamp, isTimestampInCaptainDateRange } from './captain-date-range';

type CaptainRequestFilter = 'all' | OrderMode;
type CaptainRequestRecord = {
  kind: OrderMode;
  order: Order | DeliveryOrder;
};

const requestFilters: Array<{ value: CaptainRequestFilter; label: string }> = [
  { value: 'all', label: 'هەمووی' },
  { value: 'travel', label: 'سەفەری' },
  { value: 'delivery', label: 'گەیاندن' },
];

const kindMeta: Record<
  OrderMode,
  {
    label: string;
    icon: LucideIcon;
    badgeClassName: string;
    cardClassName: string;
    linkClassName: string;
    acceptButtonClassName: string;
  }
> = {
  travel: {
    label: 'سەفەری',
    icon: ClipboardList,
    badgeClassName:
      'border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 text-amber-900 ring-1 ring-amber-100/80',
    cardClassName: 'border-amber-200/70 bg-gradient-to-br from-white via-orange-50/60 to-amber-100/55',
    linkClassName:
      'bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 text-white hover:from-sky-700 hover:via-cyan-700 hover:to-indigo-700 focus-visible:ring-sky-300',
    acceptButtonClassName:
      'bg-gradient-to-r from-emerald-600 via-green-600 to-teal-500 hover:from-emerald-700 hover:via-green-700 hover:to-teal-600 focus-visible:ring-emerald-300 disabled:bg-emerald-300',
  },
  delivery: {
    label: 'گەیاندن',
    icon: Truck,
    badgeClassName:
      'border-cyan-200/80 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 text-sky-900 ring-1 ring-cyan-100/80',
    cardClassName: 'border-sky-200/70 bg-gradient-to-br from-white via-sky-50/60 to-indigo-100/55',
    linkClassName:
      'bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 text-white hover:from-sky-700 hover:via-cyan-700 hover:to-indigo-700 focus-visible:ring-sky-300',
    acceptButtonClassName:
      'bg-gradient-to-r from-emerald-600 via-green-600 to-teal-500 hover:from-emerald-700 hover:via-green-700 hover:to-teal-600 focus-visible:ring-emerald-300 disabled:bg-emerald-300',
  },
};

const matchesOrderSearch = (record: CaptainRequestRecord, query: string) => {
  if (!query) {
    return true;
  }

  return (
    record.order.orderNumber.toLowerCase().includes(query) ||
    record.order.customerName.toLowerCase().includes(query) ||
    record.order.mobileNumber.toLowerCase().includes(query)
  );
};

const getOrderDetailsPath = (record: CaptainRequestRecord) =>
  record.kind === 'delivery' ? `/delivery-orders/${record.order.id}` : `/orders/${record.order.id}`;

const CaptainRequestInfoCard = ({
  label,
  value,
  className,
  valueClassName,
  dir,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
  dir?: 'ltr' | 'rtl';
}) => (
  <div className={cn('rounded-[1.25rem] border border-white/90 bg-white/95 px-3 py-2.5 shadow-[0_14px_26px_-24px_rgba(15,23,42,0.9)]', className)}>
    <p className="text-[11px] font-bold text-stone-500">{label}</p>
    <div className={cn('mt-1 text-[14px] font-black leading-6 text-stone-900', valueClassName)} dir={dir}>
      {value}
    </div>
  </div>
);

const captainRequestStatusClassName: Record<OrderStatus, string> = {
  pending_captain:
    'border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-orange-100 text-amber-900 ring-1 ring-amber-100/80 shadow-[0_12px_24px_-20px_rgba(245,158,11,0.65)]',
  accepted:
    'border-emerald-200 bg-gradient-to-r from-emerald-50 via-lime-50 to-green-100 text-emerald-900 ring-1 ring-emerald-100/80 shadow-[0_12px_24px_-20px_rgba(16,185,129,0.65)]',
  completed:
    'border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-green-100 text-teal-900 ring-1 ring-teal-100/80 shadow-[0_12px_24px_-20px_rgba(20,184,166,0.65)]',
  cancelled:
    'border-rose-200 bg-gradient-to-r from-rose-50 via-red-50 to-pink-100 text-rose-900 ring-1 ring-rose-100/80 shadow-[0_12px_24px_-20px_rgba(244,63,94,0.65)]',
};

export const CaptainOrdersPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [activeFilter, setActiveFilter] = usePersistentState<CaptainRequestFilter>('captain-orders-mode-filter', 'all');
  const [search, setSearch] = usePersistentState('captain-requests-search', '');
  const [dateRange, setDateRange] = usePersistentState<CaptainDateRangeValue>('captain-orders-date-range', { fromDate: '', toDate: '' });
  const [cancelTarget, setCancelTarget] = useState<CaptainRequestRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busyAction, setBusyAction] = useState<{ orderId: string; status: OrderStatus } | null>(null);
  const { data, loading, error, reload } = useLiveQuery(
    async () => {
      const [orders, deliveryOrders] = await Promise.all([getAllOrders(), getAllDeliveryOrders()]);
      return { orders, deliveryOrders };
    },
    {
      orders: [] as Order[],
      deliveryOrders: [] as DeliveryOrder[],
    },
    ['order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'view-state-changed', 'reset-performed'],
    { pollIntervalMs: 5000, backgroundPollIntervalMs: 12000 },
  );

  if (!session) {
    return null;
  }

  const travelHiddenIds = new Set(getHiddenEntityIds('orders', session));
  const deliveryHiddenIds = new Set(getHiddenEntityIds('deliveryOrders', session));
  const query = search.trim().toLowerCase();
  const allRecords: CaptainRequestRecord[] = [
    ...data.orders
      .filter((order) => order.status !== 'completed' && !travelHiddenIds.has(order.id))
      .map((order) => ({ kind: 'travel' as const, order })),
    ...data.deliveryOrders
      .filter((order) => order.status !== 'completed' && !deliveryHiddenIds.has(order.id))
      .map((order) => ({ kind: 'delivery' as const, order })),
  ].sort((left, right) => right.order.createdAt.localeCompare(left.order.createdAt));

  const recordsWithinDateRange = allRecords.filter((record) => isTimestampInCaptainDateRange(getCaptainOrderActivityTimestamp(record.order), dateRange));
  const recordsWithinModeAndDate = recordsWithinDateRange.filter((record) => (activeFilter === 'all' ? true : record.kind === activeFilter));
  const visibleRecords = recordsWithinModeAndDate
    .filter((record) => matchesOrderSearch(record, query));

  const counts = {
    total: recordsWithinModeAndDate.length,
    pending: recordsWithinModeAndDate.filter((record) => record.order.status === 'pending_captain').length,
    accepted: recordsWithinModeAndDate.filter((record) => record.order.status === 'accepted').length,
    cancelled: recordsWithinModeAndDate.filter((record) => record.order.status === 'cancelled').length,
    all: recordsWithinDateRange.length,
    travel: recordsWithinDateRange.filter((record) => record.kind === 'travel').length,
    delivery: recordsWithinDateRange.filter((record) => record.kind === 'delivery').length,
  };

  const handleStatusUpdate = async (record: CaptainRequestRecord, status: OrderStatus, nextCancelReason = '') => {
    setBusyAction({ orderId: record.order.id, status });
    try {
      if (record.kind === 'delivery') {
        await updateDeliveryOrderStatus(record.order.id, status, { role: session.role, displayName: session.displayName }, nextCancelReason);
      } else {
        await updateOrderStatus(record.order.id, status, { role: session.role, displayName: session.displayName }, nextCancelReason);
      }
      await reload();
      if (status === 'accepted') {
        showToast(`${kindMeta[record.kind].label}ەکە بە سەرکەوتوویی قبوڵ کرا.`, 'success');
      } else {
        showToast(`${kindMeta[record.kind].label}ەکە هەڵوەشایەوە.`, 'success');
      }
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) {
      return;
    }

    const reason = cancelReason.trim() || `داواکاریی ${cancelTarget.order.orderNumber} هەڵوەشایەوە.`;
    await handleStatusUpdate(cancelTarget, 'cancelled', reason);
    setCancelTarget(null);
    setCancelReason('');
  };

  return (
    <CaptainShell>
      <section className="space-y-6">
        <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/70">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>داواکاریەکان</span>
                </Badge>
                <div>
                  <h1 className="text-3xl font-black text-stone-900">هەموو داواکاریەکان</h1>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {requestFilters.map((filter) => {
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
              </div>
            </div>

            <CaptainDateRangeFilter value={dateRange} onChange={setDateRange} />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.8rem] bg-stone-950 p-4 text-white">
                <p className="text-xs text-stone-300">کۆی گشتی</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.total)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-amber-50 p-4 text-amber-900">
                <p className="text-xs text-amber-700">لە چاوڕوانیدایە</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.pending)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-sky-50 p-4 text-sky-900">
                <p className="text-xs text-sky-700">قبوڵ کراوە</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.accepted)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-rose-50 p-4 text-rose-900">
                <p className="text-xs text-rose-700">هەڵوەشایەوە</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.cancelled)}</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
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
          <EmptyState title="هەڵە لە بارکردنی داواکاریەکان" description={error} />
        ) : visibleRecords.length === 0 ? (
          <EmptyState title="هێشتا داواکاری نییە" description="کاتێک کارمەند داواکارییەکی نوێ بنێرێت، لێرە دەردەکەوێت." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleRecords.map((record) => {
              const meta = kindMeta[record.kind];
              const ModeIcon = meta.icon;
              const isBusy = busyAction?.orderId === record.order.id;
              const busyStatus = isBusy ? busyAction?.status : null;
              const canAccept = record.order.status === 'pending_captain';
              const canCancel = record.order.status === 'pending_captain' || record.order.status === 'accepted';
              const totalQuantity = record.order.items.reduce((sum, item) => sum + item.quantity, 0);
              const itemSummary = record.order.items.map((item) => `${item.name} ×${item.quantity}`).join('، ');
              const accentBarClassName =
                record.kind === 'delivery'
                  ? 'from-sky-500 via-cyan-400 to-blue-500'
                  : 'from-amber-400 via-orange-400 to-brand-600';
              const summaryCardClassName =
                record.kind === 'delivery'
                  ? 'bg-gradient-to-r from-[#ddf4ff] via-[#b8d8ff] to-[#88a6ff] text-slate-950'
                  : 'bg-gradient-to-r from-[#ffe8ae] via-[#ffc97b] to-[#f39a6b] text-slate-950';
              const infoCardClassName =
                record.kind === 'delivery'
                  ? 'border-sky-100/80 bg-gradient-to-br from-white via-white to-sky-50/85'
                  : 'border-amber-100/80 bg-gradient-to-br from-white via-white to-orange-50/85';
              const noteCardClassName =
                record.kind === 'delivery'
                  ? 'border-cyan-100 bg-gradient-to-br from-white via-cyan-50/35 to-sky-50/70 text-sky-950'
                  : 'border-amber-100 bg-gradient-to-br from-white via-amber-50/35 to-orange-50/70 text-amber-950';

              return (
                <Card
                  key={`${record.kind}-${record.order.id}`}
                  className={cn(
                    'overflow-hidden border-stone-200/80 p-0 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.45)] ring-1 ring-white/70',
                    meta.cardClassName,
                  )}
                >
                  <div className="p-3.5">
                    <div className={cn('h-1.5 rounded-full bg-gradient-to-r', accentBarClassName)} />

                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-stone-600">{formatDateTime(record.order.createdAt)}</p>
                        <p className="text-2xl font-black tracking-tight text-stone-950">{record.order.orderNumber}</p>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <div className={cn('inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-black shadow-[0_10px_24px_-20px_rgba(15,23,42,0.5)]', meta.badgeClassName)}>
                            <ModeIcon className="h-3.5 w-3.5" />
                            <span>جۆری ئۆردەر: {meta.label}</span>
                          </div>
                          <div className="inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-3 py-1.5 text-[12px] font-black text-white shadow-[0_10px_24px_-20px_rgba(20,184,166,0.7)]">
                            کارمەند: {record.order.createdByName}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'shrink-0 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-black',
                            captainRequestStatusClassName[record.order.status],
                          )}
                        >
                          <span>دۆخی ئۆردەر: {getStatusLabel(record.order.status)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <CaptainRequestInfoCard label="ناوی کڕیار" value={record.order.customerName} className={infoCardClassName} />
                        <CaptainRequestInfoCard
                          label="شوێنی گەیاندن"
                          value={
                            <>
                              {record.order.province}
                              {record.order.extraAddress ? `، ${record.order.extraAddress}` : ''}
                            </>
                          }
                          className={infoCardClassName}
                        />
                        <CaptainRequestInfoCard
                          label="ژمارەی مۆبایل"
                          value={record.order.mobileNumber}
                          className={infoCardClassName}
                          valueClassName="text-right [unicode-bidi:plaintext]"
                          dir="ltr"
                        />
                        <CaptainRequestInfoCard
                          label="خواردنەکان"
                          value={`${formatNumber(record.order.items.length)} جۆر / ${formatNumber(totalQuantity)} دانە`}
                          className={infoCardClassName}
                        />
                        <CaptainRequestInfoCard
                          label="دوایین گۆڕانکاری"
                          value={
                            record.order.status === 'accepted'
                              ? formatDateTime(record.order.acceptedAt)
                              : record.order.status === 'cancelled'
                                ? formatDateTime(record.order.updatedAt)
                                : formatDateTime(record.order.createdAt)
                          }
                          className={infoCardClassName}
                        />
                        <CaptainRequestInfoCard label="کۆی گشتی" value={formatCurrency(record.order.total)} className={infoCardClassName} />
                      </div>

                      <div
                        className={cn(
                          'rounded-[1.55rem] px-4 py-3 text-right shadow-[0_16px_34px_-24px_rgba(79,70,229,0.55)] ring-1 ring-white/70',
                          summaryCardClassName,
                        )}
                      >
                        <p className="text-[12px] font-black opacity-80">پوختەی خواردنەکان</p>
                        <p className="mt-1 text-[15px] font-black leading-7">{itemSummary}</p>
                      </div>

                      {record.order.note ? (
                        <div
                          className={cn(
                            'rounded-[1.45rem] px-3 py-2.5 text-right text-[13px] leading-6 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.35)]',
                            noteCardClassName,
                          )}
                        >
                          <p className="font-black">تێبینی</p>
                          <p className="mt-1">{record.order.note}</p>
                        </div>
                      ) : null}

                      {record.order.cancelReason ? (
                        <div className="rounded-[1.45rem] border border-rose-200 bg-rose-50/85 px-3 py-2.5 text-right text-[13px] leading-6 text-rose-800 shadow-[0_12px_24px_-22px_rgba(244,63,94,0.35)]">
                          <p className="font-black">هۆکاری هەڵوەشاندنەوە</p>
                          <p className="mt-1">{record.order.cancelReason}</p>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={canAccept ? 'primary' : 'secondary'}
                          className={cn('rounded-[1.1rem] px-3 py-2.5 text-[13px] font-black shadow-[0_14px_28px_-22px_rgba(15,23,42,0.5)]', canAccept ? meta.acceptButtonClassName : '')}
                          onClick={() => void handleStatusUpdate(record, 'accepted')}
                          disabled={!canAccept || isBusy}
                        >
                          <PackageCheck className="h-4 w-4" />
                          <span>
                            {busyStatus === 'accepted'
                              ? 'چاوەڕێبە...'
                              : canAccept
                                ? 'قبوڵکردن'
                                : record.order.status === 'accepted'
                                  ? 'قبوڵکراوە'
                                  : 'هەڵوەشاوە'}
                          </span>
                        </Button>
                        <Button
                          variant={canCancel ? 'danger' : 'secondary'}
                          className={cn(
                            'rounded-[1.1rem] px-3 py-2.5 text-[13px] font-black shadow-[0_14px_28px_-22px_rgba(244,63,94,0.45)]',
                            canCancel
                              ? 'bg-gradient-to-r from-rose-600 via-red-500 to-pink-500 text-white hover:from-rose-700 hover:via-red-600 hover:to-pink-600 focus-visible:ring-rose-300 disabled:bg-rose-300'
                              : '',
                          )}
                          onClick={() => {
                            setCancelTarget(record);
                            setCancelReason(record.order.cancelReason ?? '');
                          }}
                          disabled={!canCancel || isBusy}
                        >
                          <XCircle className="h-4 w-4" />
                          <span>{record.order.status === 'cancelled' ? 'هەڵوەشاوە' : 'هەڵوەشاندنەوە'}</span>
                        </Button>
                        <Link
                          to={getOrderDetailsPath(record)}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-[1.1rem] px-3 py-2.5 text-[13px] font-black shadow-[0_14px_28px_-22px_rgba(59,130,246,0.35)] transition',
                            meta.linkClassName,
                          )}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>بینینی وردەکاری</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="هەڵوەشاندنەوەی داواکاری"
        description="پێش هەڵوەشاندنەوە، هۆکارێکی ڕوون بنووسە تا لە مێژوو و ئاگەدارکردنەوەکاندا وەک ڕیکۆرد بمێنێتەوە."
        confirmLabel="بەڵێ، هەڵیوەشێنەوە"
        cancelLabel="پاشگەزبوونەوە"
        tone="danger"
        busy={Boolean(cancelTarget && busyAction?.orderId === cancelTarget.order.id && busyAction.status === 'cancelled')}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
        }}
        onConfirm={() => void handleCancel()}
        extraContent={
          <div className="space-y-2">
            <p className="text-sm font-semibold text-stone-700">هۆکار</p>
            <Textarea
              className="min-h-[110px] resize-none"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="هۆکاری هەڵوەشاندنەوەکە بنووسە."
            />
          </div>
        }
      />
    </CaptainShell>
  );
};

