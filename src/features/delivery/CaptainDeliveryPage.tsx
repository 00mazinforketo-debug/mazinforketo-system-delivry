import { useState } from 'react';
import { ArrowLeft, CheckCircle2, PackageCheck, Search, Truck, XCircle } from 'lucide-react';
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
import { formatCurrency, formatDateTime, formatNumber, getStatusLabel, getStatusTone } from '../../lib/format';
import type { DeliveryOrder } from '../../types/models';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { CaptainShell } from '../captain/CaptainShell';
import { getDeliveryNotificationsForSession, markDeliveryNotificationsAsReadForSession } from './delivery-notification-service';
import { getAllDeliveryOrders, updateDeliveryOrderStatus } from './delivery-service';

type CaptainOrdersTab = 'all' | 'pending' | 'accepted' | 'completed' | 'cancelled';

export const CaptainDeliveryPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [activeTab, setActiveTab] = usePersistentState<CaptainOrdersTab>('captain-delivery-tab', 'all');
  const [search, setSearch] = usePersistentState('captain-delivery-search', '');
  const [cancelOrder, setCancelOrder] = useState<DeliveryOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busyAction, setBusyAction] = useState<{ orderId: string; status: DeliveryOrder['status'] } | null>(null);

  const { data, loading, error, reload } = useLiveQuery(
    async () => {
      const [orders, notifications] = await Promise.all([
        getAllDeliveryOrders(),
        session ? getDeliveryNotificationsForSession(session) : Promise.resolve([]),
      ]);
      return { orders, notifications };
    },
    {
      orders: [] as DeliveryOrder[],
      notifications: [],
    },
    ['delivery-order-created', 'delivery-order-updated', 'delivery-notification-changed', 'reset-performed'],
    { pollIntervalMs: 5000, backgroundPollIntervalMs: 12000 },
  );

  const unreadByOrderId = new Map<string, number>();
  for (const notification of data.notifications) {
    if (!notification.isRead) {
      unreadByOrderId.set(notification.deliveryOrderId, (unreadByOrderId.get(notification.deliveryOrderId) ?? 0) + 1);
    }
  }

  if (!session) {
    return null;
  }

  const query = search.trim().toLowerCase();
  const visibleOrders = data.orders
    .filter((order) => {
      if (activeTab === 'all') {
        return true;
      }

      if (activeTab === 'pending') {
        return order.status === 'pending_captain';
      }

      if (activeTab === 'accepted') {
        return order.status === 'accepted';
      }

      if (activeTab === 'completed') {
        return order.status === 'completed';
      }

      return order.status === 'cancelled';
    })
    .filter((order) => {
      if (!query) {
        return true;
      }

      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.mobileNumber.toLowerCase().includes(query)
      );
    });

  const counts = {
    total: data.orders.length,
    pending: data.orders.filter((order) => order.status === 'pending_captain').length,
    accepted: data.orders.filter((order) => order.status === 'accepted').length,
    completed: data.orders.filter((order) => order.status === 'completed').length,
    cancelled: data.orders.filter((order) => order.status === 'cancelled').length,
  };

  const handleStatusUpdate = async (orderId: string, status: DeliveryOrder['status'], nextCancelReason = '') => {
    setBusyAction({ orderId, status });
    try {
      await updateDeliveryOrderStatus(orderId, status, { role: session.role, displayName: session.displayName }, nextCancelReason);
      await reload();
      if (status === 'accepted') {
        showToast('گەیاندنەکە بە سەرکەوتوویی قبوڵ کرا.', 'success');
      } else if (status === 'completed') {
        showToast('گەیاندنەکە بە سەرکەوتوویی تەواو کرا.', 'success');
      } else {
        showToast('گەیاندنەکە هەڵوەشایەوە.', 'success');
      }
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrder) {
      return;
    }

    const reason = cancelReason.trim() || `داواکاریی ${cancelOrder.orderNumber} هەڵوەشایەوە.`;
    await handleStatusUpdate(cancelOrder.id, 'cancelled', reason);
    setCancelOrder(null);
    setCancelReason('');
  };

  return (
    <CaptainShell>
      <section className="space-y-6">
        <Card className="overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                  <Truck className="h-3.5 w-3.5" />
                  <span>گەیاندن</span>
                </Badge>
                <div>
                  <h1 className="text-3xl font-black text-stone-900">بەشی گەیاندنی کاپتن</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                    پەیجی گەیاندن بۆ بڕیار و شاردنەوەی ئەو داواکارییانە دانراوە کە پێویستیان بە شوێنکەوتن و
                    هەڵسوکەوتی خێراتر هەیە.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-sky-200 bg-white text-sky-800">{formatNumber(visibleOrders.length)} گەیاندن</Badge>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void (async () => {
                      await markDeliveryNotificationsAsReadForSession(session);
                      await reload();
                    })();
                  }}
                >
                  هەموو بخوێنەوە
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              <div className="rounded-[1.8rem] bg-emerald-50 p-4 text-emerald-900">
                <p className="text-xs text-emerald-700">تەواوبووە</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.completed)}</p>
              </div>
              <div className="rounded-[1.8rem] bg-rose-50 p-4 text-rose-900">
                <p className="text-xs text-rose-700">هەڵوەشاوە</p>
                <p className="mt-2 text-3xl font-black">{formatNumber(counts.cancelled)}</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'هەمووی' },
                  { key: 'pending', label: 'لە چاوڕوانیدایە' },
                  { key: 'accepted', label: 'قبوڵ کراوەکان' },
                  { key: 'completed', label: 'تەواوبووەکان' },
                  { key: 'cancelled', label: 'هەڵوەشاوەکان' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={cn(
                      'rounded-[1.3rem] border px-4 py-3 text-sm font-black transition',
                      activeTab === tab.key
                        ? 'border-sky-700 bg-sky-700 text-white shadow-card'
                        : 'border-white/80 bg-white/95 text-stone-700 hover:border-sky-200 hover:bg-sky-50',
                    )}
                    onClick={() => setActiveTab(tab.key as CaptainOrdersTab)}
                  >
                    {tab.label}
                  </button>
                ))}
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
          <EmptyState title="هەڵە لە بارکردنی گەیاندنەکان" description={error} />
        ) : visibleOrders.length === 0 ? (
          <EmptyState title="هێشتا گەیاندن نییە" description="کاتێک کارمەند داواکاریی گەیاندن بنێرێت، لێرە دەردەکەوێت." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleOrders.map((order) => {
              const canAccept = order.status === 'pending_captain';
              const canComplete = order.status === 'accepted';
              const canCancel = order.status === 'pending_captain' || order.status === 'accepted';
              const busyStatus = busyAction?.orderId === order.id ? busyAction.status : null;
              const unreadCount = unreadByOrderId.get(order.id) ?? 0;
              const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <Card key={order.id} className="space-y-5 overflow-hidden border-sky-100 bg-white/95">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3 text-right">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                          <Truck className="h-3.5 w-3.5" />
                          <span>گەیاندن</span>
                        </Badge>
                        <Badge className={getStatusTone(order.status)}>{getStatusLabel(order.status)}</Badge>
                        {unreadCount > 0 ? <Badge className="border-cyan-200 bg-cyan-50 text-cyan-800">نوێ {formatNumber(unreadCount)}</Badge> : null}
                      </div>
                      <div>
                        <p className="text-xl font-black text-stone-900">{order.orderNumber}</p>
                        <p className="mt-1 text-xs font-semibold text-stone-500">{formatDateTime(order.createdAt)}</p>
                      </div>
                    </div>
                    <div className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-4 py-2 text-sm font-black text-sky-900 shadow-inner">
                      کارمەند: {order.createdByName}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-[1.8rem] border border-sky-100 bg-sky-50/60 p-4 text-sm sm:grid-cols-2">
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
                    <div className="text-right">
                      <p className="text-stone-500">ناونیشان</p>
                      <p className="mt-1 font-bold text-stone-900">
                        {order.province}
                        {order.extraAddress ? `، ${order.extraAddress}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-500">خواردنەکان</p>
                      <p className="mt-1 font-bold text-stone-900">
                        {formatNumber(order.items.length)} جۆر / {formatNumber(totalQuantity)} دانە
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-500">دوایین گۆڕانکاری</p>
                      <p className="mt-1 font-bold text-stone-900">
                        {order.status === 'completed'
                          ? formatDateTime(order.completedAt)
                          : order.status === 'accepted'
                            ? formatDateTime(order.acceptedAt)
                            : formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-500">کۆی گشتی</p>
                      <p className="mt-1 font-bold text-stone-900">{formatCurrency(order.total)}</p>
                    </div>
                  </div>

                  {order.note ? (
                    <div className="rounded-[1.7rem] border border-stone-200 bg-white px-4 py-3 text-right text-sm leading-7 text-stone-700">
                      <p className="font-black text-stone-900">تێبینی</p>
                      <p className="mt-1">{order.note}</p>
                    </div>
                  ) : null}

                  {order.cancelReason ? (
                    <div className="rounded-[1.7rem] border border-rose-200 bg-rose-50/80 px-4 py-3 text-right text-sm leading-7 text-rose-800">
                      <p className="font-black">هۆکاری هەڵوەشاندنەوە</p>
                      <p className="mt-1">{order.cancelReason}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Button
                      variant={canAccept ? 'primary' : 'secondary'}
                      className={canAccept ? 'bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-300 disabled:bg-sky-300' : ''}
                      onClick={() => void handleStatusUpdate(order.id, 'accepted')}
                      disabled={!canAccept || busyAction?.orderId === order.id}
                    >
                      <PackageCheck className="h-4 w-4" />
                      <span>{busyStatus === 'accepted' ? 'چاوەڕێبە...' : canAccept ? 'قبوڵکردن' : 'قبوڵکراوە'}</span>
                    </Button>
                    <Button
                      variant={canComplete ? 'primary' : 'secondary'}
                      className={canComplete ? 'bg-teal-700 hover:bg-teal-800 focus-visible:ring-teal-300 disabled:bg-teal-300' : ''}
                      onClick={() => void handleStatusUpdate(order.id, 'completed')}
                      disabled={!canComplete || busyAction?.orderId === order.id}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{busyStatus === 'completed' ? 'چاوەڕێبە...' : canComplete ? 'تەواوکردن' : 'تەواوبووە'}</span>
                    </Button>
                    <Button
                      variant={canCancel ? 'danger' : 'secondary'}
                      onClick={() => {
                        setCancelOrder(order);
                        setCancelReason(order.cancelReason ?? '');
                      }}
                      disabled={!canCancel || busyAction?.orderId === order.id}
                    >
                      <XCircle className="h-4 w-4" />
                      <span>{order.status === 'cancelled' ? 'هەڵوەشاوە' : 'هەڵوەشاندنەوە'}</span>
                    </Button>
                    <Link
                      to={`/delivery-orders/${order.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-200"
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

      <ConfirmDialog
        open={Boolean(cancelOrder)}
        title="هەڵوەشاندنەوەی داواکاریی گەیاندن"
        description="پێش هەڵوەشاندنەوە، هۆکارێکی ڕوون بنووسە تا لە گەیاندنەکاندا وەکوو ڕیکۆرد بمێنێتەوە."
        confirmLabel="بەڵێ، هەڵیوەشێنەوە"
        cancelLabel="پاشگەزبوونەوە"
        tone="danger"
        busy={Boolean(cancelOrder && busyAction?.orderId === cancelOrder.id && busyAction.status === 'cancelled')}
        onClose={() => {
          setCancelOrder(null);
          setCancelReason('');
        }}
        onConfirm={() => void handleCancelOrder()}
        extraContent={
          <div className="space-y-2">
            <p className="text-sm font-semibold text-stone-700">هۆکار</p>
            <Textarea
              className="min-h-[110px] resize-none"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="بۆ نموونە: ژمارەکە دووبارە بوو یان کڕیار داوای وەستاندنەوەی کرد."
            />
          </div>
        }
      />
    </CaptainShell>
  );
};
