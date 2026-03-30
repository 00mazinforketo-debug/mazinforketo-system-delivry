import { useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  MapPin,
  PackageCheck,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Textarea } from '../../components/ui/Textarea';
import { useLiveQuery } from '../../hooks/use-live-query';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDateOnly, formatNumber, formatTimeOnly, getStatusLabel, getStatusTone } from '../../lib/format';
import { getHiddenEntityIds } from '../../lib/view-state';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { DeliveryOrder, Order, OrderMode, OrderStatus } from '../../types/models';
import { getAllDeliveryOrders, updateDeliveryOrderStatus } from '../delivery/delivery-service';
import { getAllOrders, updateOrderStatus } from '../orders/order-service';
import { CaptainShell } from './CaptainShell';

type CaptainInboxRecord = {
  kind: OrderMode;
  order: Order | DeliveryOrder;
};

const kindMeta: Record<
  OrderMode,
  {
    label: string;
    icon: LucideIcon;
    badgeClassName: string;
    iconWrapClassName: string;
    cardClassName: string;
    acceptButtonClassName: string;
    detailsClassName: string;
  }
> = {
  travel: {
    label: 'سەفەری',
    icon: ClipboardList,
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-900',
    iconWrapClassName: 'bg-amber-100 text-amber-800 shadow-[0_12px_28px_-18px_rgba(217,119,6,0.9)]',
    cardClassName: 'border-amber-100 bg-gradient-to-br from-white via-amber-50/70 to-stone-50',
    acceptButtonClassName: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-300 disabled:bg-amber-300',
    detailsClassName: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
  },
  delivery: {
    label: 'گەیاندن',
    icon: Truck,
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-900',
    iconWrapClassName: 'bg-sky-100 text-sky-800 shadow-[0_12px_28px_-18px_rgba(14,116,144,0.9)]',
    cardClassName: 'border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-stone-50',
    acceptButtonClassName: 'bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-300 disabled:bg-sky-300',
    detailsClassName: 'bg-sky-100 text-sky-900 hover:bg-sky-200',
  },
};

const getOrderDetailsPath = (record: CaptainInboxRecord) =>
  record.kind === 'delivery' ? `/delivery-orders/${record.order.id}` : `/orders/${record.order.id}`;

const getOrderNoteText = (order: Order | DeliveryOrder) => {
  const parts = [order.note, order.specialRequests].map((value) => value.trim()).filter(Boolean);
  return parts.join(' / ');
};

const getItemSummary = (order: Order | DeliveryOrder) => {
  const preview = order.items.slice(0, 2).map((item) => `${item.name} ×${formatNumber(item.quantity)}`);
  if (order.items.length <= 2) {
    return preview.join('، ');
  }

  return `${preview.join('، ')} + ${formatNumber(order.items.length - 2)} بابەتی تر`;
};

export const CaptainPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [cancelTarget, setCancelTarget] = useState<CaptainInboxRecord | null>(null);
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

  const allVisibleRecords: CaptainInboxRecord[] = [
    ...data.orders
      .filter((order) => order.status !== 'completed' && !travelHiddenIds.has(order.id))
      .map((order) => ({ kind: 'travel' as const, order })),
    ...data.deliveryOrders
      .filter((order) => order.status !== 'completed' && !deliveryHiddenIds.has(order.id))
      .map((order) => ({ kind: 'delivery' as const, order })),
  ].sort((left, right) => right.order.createdAt.localeCompare(left.order.createdAt));

  const pendingRecords = allVisibleRecords.filter((record) => record.order.status === 'pending_captain');

  const counts = {
    pending: pendingRecords.length,
    travelPending: pendingRecords.filter((record) => record.kind === 'travel').length,
    deliveryPending: pendingRecords.filter((record) => record.kind === 'delivery').length,
    activeTotal: allVisibleRecords.length,
  };

  const handleStatusUpdate = async (record: CaptainInboxRecord, status: OrderStatus, nextCancelReason = '') => {
    setBusyAction({ orderId: record.order.id, status });
    try {
      if (record.kind === 'delivery') {
        await updateDeliveryOrderStatus(record.order.id, status, { role: session.role, displayName: session.displayName }, nextCancelReason);
      } else {
        await updateOrderStatus(record.order.id, status, { role: session.role, displayName: session.displayName }, nextCancelReason);
      }

      await reload();
      showToast(
        status === 'accepted'
          ? `${kindMeta[record.kind].label}ەکە بە سەرکەوتوویی قبوڵ کرا.`
          : `${kindMeta[record.kind].label}ەکە هەڵوەشایەوە و هۆکارەکە نێردرا.`,
        'success',
      );
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
        <Card className="overflow-hidden border-white/90 bg-gradient-to-br from-white via-stone-50 to-brand-50/70">
          <div className="min-h-[19rem]">
            <div className="space-y-4">
              <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                <ClipboardList className="h-3.5 w-3.5" />
                <span>داواکاریی نوێی کارمەندەکان</span>
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-stone-900">ئاگەداری ئۆردەرەکەت بە.</h1>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.9rem] bg-stone-950 px-4 py-4 text-white shadow-card">
                  <p className="text-xs text-stone-300">لە چاوڕوانیدا</p>
                  <p className="mt-2 text-3xl font-black">{formatNumber(counts.pending)}</p>
                </div>
                <div className="rounded-[1.9rem] bg-amber-50 px-4 py-4 text-amber-900 shadow-[0_18px_42px_-28px_rgba(217,119,6,0.8)]">
                  <p className="text-xs text-amber-700">سەفەری</p>
                  <p className="mt-2 text-3xl font-black">{formatNumber(counts.travelPending)}</p>
                </div>
                <div className="rounded-[1.9rem] bg-sky-50 px-4 py-4 text-sky-900 shadow-[0_18px_42px_-28px_rgba(2,132,199,0.8)]">
                  <p className="text-xs text-sky-700">گەیاندن</p>
                  <p className="mt-2 text-3xl font-black">{formatNumber(counts.deliveryPending)}</p>
                </div>
                <div className="rounded-[1.9rem] bg-white px-4 py-4 text-stone-900 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.35)]">
                  <p className="text-xs text-stone-500">کۆی داواکارییە چالاکەکان</p>
                  <p className="mt-2 text-3xl font-black">{formatNumber(counts.activeTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState title="هەڵە لە بارکردنی داواکاریەکان" description={error} />
        ) : pendingRecords.length === 0 ? (
          <EmptyState title="هێشتا داواکاریی نوێ نییە" description="کاتێک کارمەندێک ئۆردەرێکت بۆ بنێرێت تۆ قبوڵی بکەیت یان ڕەتی بکەیتەوە ئۆردەرەکە لێرە نامێنێت ئەجێتە پەیجی داواکاریەکان." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {pendingRecords.map((record) => {
              const meta = kindMeta[record.kind];
              const ModeIcon = meta.icon;
              const orderNote = getOrderNoteText(record.order);
              const totalQuantity = record.order.items.reduce((sum, item) => sum + item.quantity, 0);
              const isBusy = busyAction?.orderId === record.order.id;
              const busyStatus = isBusy ? busyAction?.status : null;

              return (
                <Card
                  key={`${record.kind}-${record.order.id}`}
                  className={cn('overflow-hidden border-white/90 p-0 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)]', meta.cardClassName)}
                >
                  <div className="space-y-4 p-4 sm:p-5">
                    <div className="space-y-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.35rem]', meta.iconWrapClassName)}>
                          <ModeIcon className="h-5 w-5" />
                        </div>
                        <p className="truncate text-lg font-black tracking-wide text-stone-900 sm:text-xl">
                          کۆدی ئۆردەر: {record.order.orderNumber}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Badge className={meta.badgeClassName}>
                            <span>{meta.label}</span>
                          </Badge>
                          <Badge className={getStatusTone(record.order.status)}>
                            <span>{getStatusLabel(record.order.status)}</span>
                          </Badge>
                        </div>

                        <p className="text-right text-xs font-semibold text-stone-500">
                          {formatDateOnly(record.order.createdAt)} - {formatTimeOnly(record.order.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.55rem] border border-white/90 bg-white/92 px-4 py-4 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.45)]">
                      <div className="grid gap-3">
                        <div className="grid grid-cols-2 gap-4 border-b border-stone-200/80 pb-3">
                          <div className="text-right">
                            <p className="text-[11px] font-bold text-stone-500">ناوی کڕیار</p>
                            <p className="mt-1 text-sm font-black leading-6 text-stone-900">{record.order.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-bold text-stone-500">کارمەند</p>
                            <p className="mt-1 text-sm font-black leading-6 text-stone-900">{record.order.createdByName}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-b border-stone-200/80 pb-3">
                          <div className="text-right">
                            <p className="text-[11px] font-bold text-stone-500">ژمارەی مۆبایل</p>
                            <p className="mt-1 text-sm font-black leading-6 text-stone-900 text-right [unicode-bidi:plaintext]" dir="ltr">
                              {record.order.mobileNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-bold text-stone-500">کۆی گشتی</p>
                            <p className="mt-1 text-sm font-black leading-6 text-stone-900">{formatCurrency(record.order.total)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-b border-stone-200/80 pb-3">
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-2 text-stone-500" dir="ltr">
                              <p className="text-[11px] font-bold">شوێنی گەیاندن</p>
                              <MapPin className="h-4 w-4 shrink-0" />
                            </div>
                            <p className="mt-1 text-sm font-black leading-6 text-stone-900">{record.order.province || 'هێشتا شوێن دیاری نەکراوە'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-bold text-stone-500">وردەکاری ناونیشان</p>
                            <p className="mt-1 text-sm font-black leading-6 text-stone-900">{record.order.extraAddress || 'بەتاڵ'}</p>
                          </div>
                        </div>

                        <div className="border-t border-stone-200/80 pt-2.5 text-right">
                          <p className="text-[11px] font-bold text-stone-500">تێبینی</p>
                          <p className="mt-1 min-h-[2.6rem] text-[13px] font-black leading-6 text-stone-900">{orderNote || '\u00A0'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="rounded-[1.55rem] border border-white/90 bg-white/90 px-4 py-3 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.45)]">
                        <p className="text-[11px] font-bold text-stone-500">
                          پوختەی خواردنەکان
                          <span className="mr-1 text-stone-400">
                            ({formatNumber(record.order.items.length)} جۆر / {formatNumber(totalQuantity)} دانە)
                          </span>
                        </p>
                        <p className="mt-2 text-sm font-black leading-7 text-stone-900">{getItemSummary(record.order)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        className={cn('rounded-[1.35rem] px-3 py-3 shadow-[0_16px_34px_-20px_rgba(15,23,42,0.45)]', meta.acceptButtonClassName)}
                        onClick={() => void handleStatusUpdate(record, 'accepted')}
                        disabled={isBusy}
                      >
                        <PackageCheck className="h-4 w-4" />
                        <span>{busyStatus === 'accepted' ? 'چاوەڕێبە...' : 'قبوڵکردن'}</span>
                      </Button>

                      <Button
                        variant="danger"
                        className="rounded-[1.35rem] px-3 py-3 shadow-[0_16px_34px_-20px_rgba(225,29,72,0.5)]"
                        onClick={() => {
                          setCancelTarget(record);
                          setCancelReason(record.order.cancelReason ?? '');
                        }}
                        disabled={isBusy}
                      >
                        <XCircle className="h-4 w-4" />
                        <span>{busyStatus === 'cancelled' ? 'چاوەڕێبە...' : 'هەڵوەشاندنەوە'}</span>
                      </Button>

                      <Link
                        to={getOrderDetailsPath(record)}
                        className={cn(
                          'inline-flex items-center justify-center gap-2 rounded-[1.35rem] px-3 py-3 text-sm font-black shadow-[0_16px_34px_-20px_rgba(15,23,42,0.35)] transition',
                          meta.detailsClassName,
                        )}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>وردەکاری</span>
                      </Link>
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
        description="هۆکاری هەڵوەشاندنەوەکە بنووسە. هەر دەقێک بنووسیت وەک ئاگەدارکردنەوە بۆ کارمەند دەچێت."
        confirmLabel="هەڵیوەشێنەوە"
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
            <p className="text-sm font-bold text-stone-700">هۆکار</p>
            <Textarea
              className="min-h-[110px] resize-none"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="نمونە: کێشە لە شوێنی گەیاندن، ژمارە هەڵەیە، یان هەر هۆکارێکی تر..."
            />
          </div>
        }
      />
    </CaptainShell>
  );
};
