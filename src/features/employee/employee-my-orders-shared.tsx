/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useLiveQuery } from '../../hooks/use-live-query';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDateOnly, formatDateTime } from '../../lib/format';
import { getHiddenEntityIds } from '../../lib/view-state';
import type { DeliveryOrder, Order, OrderMode, Session } from '../../types/models';
import { getBusinessDayKey } from '../../../shared/business-time';
import { getDeliveryOrdersByCreator } from '../delivery/delivery-service';
import { getOrdersByCreator } from '../orders/order-service';

export type OrderKind = Extract<OrderMode, 'travel' | 'delivery'>;
export type MyOrdersMode = OrderKind | 'all';
export type EmployeeOrderRecord = Order | DeliveryOrder;
export type CombinedEmployeeOrderRecord = {
  dayKey: string;
  mode: OrderKind;
  order: EmployeeOrderRecord;
};

export type EmployeeOrderDateGroup = {
  dayKey: string;
  label: string;
  records: CombinedEmployeeOrderRecord[];
};

export const orderModeMeta: Record<
  MyOrdersMode,
  {
    label: string;
    emptyTitle: string;
    emptyDescription: string;
    badgeClassName: string;
    buttonActiveClassName: string;
    buttonIdleClassName: string;
    buttonIconWrapClassName: string;
    surfaceClassName: string;
    cardClassName: string;
    detailsClassName: string;
    actionClassName: string;
    searchPlaceholder: string;
  }
> = {
  all: {
    label: 'هەمووی',
    emptyTitle: 'هێشتا ئۆردەر نییە',
    emptyDescription: 'کاتێک سەفەری یان گەیاندن بنێریت، لێرە دەردەکەوێت.',
    badgeClassName: 'border-stone-200 bg-stone-100 text-stone-800',
    buttonActiveClassName: 'border-stone-900 bg-stone-950 text-white shadow-card',
    buttonIdleClassName: 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50',
    buttonIconWrapClassName: 'bg-white/20 text-white',
    surfaceClassName: 'border-stone-200 bg-gradient-to-br from-white via-stone-50 to-stone-100/70',
    cardClassName: 'border-stone-200 bg-white/95',
    detailsClassName: 'bg-stone-50',
    actionClassName: 'bg-stone-900 text-white hover:bg-stone-800',
    searchPlaceholder: 'گەڕان بە کۆدی ئۆردەر، ناوی کڕیار یان ژمارەی مۆبایل...',
  },
  travel: {
    label: 'سەفەری',
    emptyTitle: 'هێشتا سەفەری نییە',
    emptyDescription: 'کاتێک داواکارییەکی سەفەری بنێریت، لێرە دەردەکەوێت.',
    badgeClassName: 'border-brand-200 bg-brand-50 text-brand-800',
    buttonActiveClassName: 'border-brand-700 bg-stone-950 text-white shadow-card',
    buttonIdleClassName: 'border-stone-200 bg-white text-stone-700 hover:border-brand-200 hover:bg-brand-50',
    buttonIconWrapClassName: 'bg-white/20 text-white',
    surfaceClassName: 'border-brand-100 bg-gradient-to-br from-white via-stone-50 to-brand-50/80',
    cardClassName: 'border-stone-200 bg-white/95',
    detailsClassName: 'bg-stone-50',
    actionClassName: 'bg-brand-700 text-white hover:bg-brand-800',
    searchPlaceholder: 'گەڕان بە کۆدی سەفەری، ناوی کڕیار یان ژمارەی مۆبایل...',
  },
  delivery: {
    label: 'گەیاندن',
    emptyTitle: 'هێشتا گەیاندن نییە',
    emptyDescription: 'کاتێک داواکارییەکی گەیاندن بنێریت، لێرە دەردەکەوێت.',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-800',
    buttonActiveClassName: 'border-sky-700 bg-sky-700 text-white shadow-card',
    buttonIdleClassName: 'border-sky-100 bg-white text-stone-700 hover:border-sky-200 hover:bg-sky-50',
    buttonIconWrapClassName: 'bg-white/20 text-white',
    surfaceClassName: 'border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/70',
    cardClassName: 'border-sky-100 bg-white/95',
    detailsClassName: 'bg-sky-50/70',
    actionClassName: 'bg-sky-700 text-white hover:bg-sky-800',
    searchPlaceholder: 'گەڕان بە کۆدی گەیاندن، ناوی کڕیار یان ژمارەی مۆبایل...',
  },
};

export const matchesEmployeeOrderSearch = (order: EmployeeOrderRecord, query: string) => {
  if (!query) {
    return true;
  }

  return (
    order.orderNumber.toLowerCase().includes(query) ||
    order.customerName.toLowerCase().includes(query) ||
    order.mobileNumber.toLowerCase().includes(query)
  );
};

export const getOrderDetailsPath = (order: EmployeeOrderRecord, mode: OrderKind) =>
  mode === 'delivery' ? `/delivery-orders/${order.id}` : `/orders/${order.id}`;

export const buildCombinedEmployeeOrders = (travelOrders: Order[], deliveryOrders: DeliveryOrder[]) =>
  [
    ...travelOrders.map<CombinedEmployeeOrderRecord>((order) => ({ dayKey: getBusinessDayKey(order.createdAt), mode: 'travel', order })),
    ...deliveryOrders.map<CombinedEmployeeOrderRecord>((order) => ({ dayKey: getBusinessDayKey(order.createdAt), mode: 'delivery', order })),
  ].sort((left, right) => right.order.createdAt.localeCompare(left.order.createdAt));

export const buildEmployeeOrderDateGroups = (records: CombinedEmployeeOrderRecord[]) => {
  const groups = new Map<string, EmployeeOrderDateGroup>();

  for (const record of records) {
    const group = groups.get(record.dayKey);

    if (group) {
      group.records.push(record);
      continue;
    }

    groups.set(record.dayKey, {
      dayKey: record.dayKey,
      label: formatDateOnly(record.dayKey),
      records: [record],
    });
  }

  return Array.from(groups.values());
};

export const useEmployeeMyOrdersData = (session: Session | null) => {
  const travelQuery = useLiveQuery<Order[]>(
    async () => getOrdersByCreator(session?.displayName ?? ''),
    [],
    ['order-created', 'order-updated', 'view-state-changed', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  const deliveryQuery = useLiveQuery<DeliveryOrder[]>(
    async () => getDeliveryOrdersByCreator(session?.displayName ?? ''),
    [],
    ['delivery-order-created', 'delivery-order-updated', 'delivery-notification-changed', 'view-state-changed', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  const travelHiddenIds = session ? new Set(getHiddenEntityIds('orders', session)) : new Set<string>();
  const deliveryHiddenIds = session ? new Set(getHiddenEntityIds('deliveryOrders', session)) : new Set<string>();
  const visibleTravelOrders = travelQuery.data.filter((order) => !travelHiddenIds.has(order.id));
  const visibleDeliveryOrders = deliveryQuery.data.filter((order) => !deliveryHiddenIds.has(order.id));
  const combinedVisibleOrders = buildCombinedEmployeeOrders(visibleTravelOrders, visibleDeliveryOrders);

  return {
    travelQuery,
    deliveryQuery,
    visibleTravelOrders,
    visibleDeliveryOrders,
    combinedVisibleOrders,
  };
};

interface EmployeeOrderCardProps {
  record: CombinedEmployeeOrderRecord;
  onRejectTravelOrder: (order: Order) => void;
  onRejectDeliveryOrder: (order: DeliveryOrder) => void;
}

export const EmployeeOrderCard = ({ record, onRejectTravelOrder, onRejectDeliveryOrder }: EmployeeOrderCardProps) => {
  const { mode, order } = record;
  const meta = orderModeMeta[mode];

  return (
    <Card className={cn('space-y-4 text-right', meta.cardClassName)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 text-right">
          <p className="text-lg font-black text-stone-900">
            {mode === 'delivery' ? 'کۆدی گەیاندن' : 'کۆدی سەفەری'} {order.orderNumber}
          </p>
          <p className="text-xs font-semibold text-stone-500">{formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={meta.badgeClassName}>{meta.label}</Badge>
          <StatusBadge status={order.status} />
          {order.offlineState === 'queued' ? (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800">لە ئامێرەکەدا هەڵگیراوە</Badge>
          ) : null}
          <Badge className="border-stone-200 bg-stone-100 text-stone-700">{order.items.length} بابەت</Badge>
        </div>
      </div>

      <div className={cn('grid gap-3 rounded-[1.7rem] p-4 text-sm', meta.detailsClassName)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-right">
            <p className="text-stone-500">ناوی کڕیار</p>
            <p className="mt-1 font-bold text-stone-900">{order.customerName}</p>
          </div>
          <div className="text-right">
            <p className="text-stone-500">ژمارەی مۆبایل</p>
            <p className="mt-1 font-bold text-stone-900 [unicode-bidi:plaintext]" dir="ltr">
              {order.mobileNumber}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-right">
            <p className="text-stone-500">شوێنی گەیاندن</p>
            <p className="mt-1 font-bold text-stone-900">
              {order.province}
              {order.extraAddress ? `، ${order.extraAddress}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-stone-500">کۆی گشتی</p>
            <p className="mt-1 font-bold text-stone-900">{formatCurrency(order.total)}</p>
          </div>
        </div>

        {order.note ? (
          <div className="text-right">
            <p className="text-stone-500">تێبینی</p>
            <p className="mt-1 font-bold text-stone-900">{order.note}</p>
          </div>
        ) : null}

        {order.status === 'accepted' ? (
          <div className="text-right">
            <p className="text-stone-500">قبوڵ کراوە</p>
            <p className="mt-1 font-bold text-stone-900">{formatDateTime(order.acceptedAt)}</p>
          </div>
        ) : null}

        {order.status === 'completed' ? (
          <div className="text-right">
            <p className="text-stone-500">تەواوبووە</p>
            <p className="mt-1 font-bold text-emerald-700">{formatDateTime(order.completedAt)}</p>
          </div>
        ) : null}

        {order.offlineState === 'queued' ? (
          <div className="text-right">
            <p className="text-stone-500">دۆخی sync</p>
            <p className="mt-1 font-bold text-amber-700">{order.syncError || 'لە ئامێرەکەدا هەڵگیراوە و چاوەڕێی نێردرانە بۆ cloud ـە.'}</p>
          </div>
        ) : null}

        {order.cancelReason ? (
          <div className="text-right">
            <p className="text-stone-500">هۆکاری هەڵوەشاندنەوە</p>
            <p className="mt-1 font-bold text-rose-700">{order.cancelReason}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={getOrderDetailsPath(order, mode)}
          className={cn('inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition', meta.actionClassName)}
        >
          بینینی وردەکاری
        </Link>
        {order.status === 'pending_captain' ? (
          <Button variant="danger" onClick={() => (mode === 'delivery' ? onRejectDeliveryOrder(order as DeliveryOrder) : onRejectTravelOrder(order as Order))}>
            {mode === 'delivery' ? 'ڕەتکردنەوەی گەیاندن' : 'ڕەتکردنەوەی سەفەری'}
          </Button>
        ) : null}
      </div>
    </Card>
  );
};
