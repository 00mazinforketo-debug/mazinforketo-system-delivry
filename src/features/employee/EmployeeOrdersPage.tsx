import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { formatDateTime } from '../../lib/format';
import { getHiddenEntityIds } from '../../lib/view-state';
import type { Order } from '../../types/models';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { getOrdersByCreator, updateOrderStatus } from '../orders/order-service';
import { EmployeeShell } from './EmployeeShell';

type EmployeeOrdersTab = 'all' | 'pending' | 'accepted' | 'completed' | 'cancelled';

export const EmployeeOrdersPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [activeTab, setActiveTab] = usePersistentState<EmployeeOrdersTab>('employee-orders-tab', 'all');
  const [search, setSearch] = usePersistentState('employee-orders-search', '');
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useLiveQuery<Order[]>(
    async () => getOrdersByCreator(session?.displayName ?? ''),
    [],
    ['order-created', 'order-updated', 'view-state-changed', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  if (!session) {
    return null;
  }

  const hiddenIds = new Set(getHiddenEntityIds('orders', session));
  const query = search.trim().toLowerCase();
  const filteredOrders = data
    .filter((order) => !hiddenIds.has(order.id))
    .filter((order) => {
      if (activeTab === 'pending') {
        return order.status === 'pending_captain';
      }

      if (activeTab === 'accepted') {
        return order.status === 'accepted';
      }

      if (activeTab === 'completed') {
        return order.status === 'completed';
      }

      if (activeTab === 'cancelled') {
        return order.status === 'cancelled';
      }

      return true;
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

  const handleRejectOrder = async () => {
    if (!session || !rejectingOrder) {
      return;
    }

    setBusy(true);
    try {
      await updateOrderStatus(
        rejectingOrder.id,
        'cancelled',
        { role: session.role, displayName: session.displayName },
        'لەلایەن کارمەندەوە ڕەتکرایەوە.',
      );
      setRejectingOrder(null);
      await reload();
      showToast('سەفەرییەکە بە سەرکەوتوویی ڕەتکرایەوە.', 'success');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmployeeShell>
      <section className="space-y-6">
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-stone-900">سەفەری</h2>
            </div>
            <Badge>{filteredOrders.length} سەفەر</Badge>
          </div>

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
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${activeTab === tab.key ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700'}`}
                onClick={() => setActiveTab(tab.key as EmployeeOrdersTab)}
              >
                {tab.label}
              </button>
            ))}
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
          <EmptyState title="هەڵە لە بارکردنی سەفەری" description={error} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState title="هێشتا سەفەری نییە" description="کاتێک داواکاری بنێریت یان گەڕانەکە بگۆڕیت، لێرە دەردەکەوێت." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="space-y-4 text-right">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2 text-right">
                    <p className="text-lg font-black text-stone-900">کۆدی سەفەری {order.orderNumber}</p>
                    <p className="text-xs font-semibold text-stone-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={order.status} />
                    {order.offlineState === 'queued' ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800">لە ئامێرەکەدا هەڵگیراوە</Badge>
                    ) : null}
                    <Badge className="border-stone-200 bg-stone-100 text-stone-700">{order.items.length} بابەت</Badge>
                  </div>
                </div>

                <div className="grid gap-3 rounded-3xl bg-stone-50 p-4 text-sm">
                  <div className="text-right">
                    <p className="text-stone-500">ناوی کڕیار</p>
                    <p className="mt-1 font-bold text-stone-900">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-stone-500">ژمارەی مۆبایل</p>
                    <p className="mt-1 font-bold text-stone-900 text-right [unicode-bidi:plaintext]" dir="ltr">
                      {order.mobileNumber}
                    </p>
                  </div>
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
                    to={`/orders/${order.id}`}
                    className="inline-flex items-center justify-center rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
                  >
                    بینینی وردەکاری
                  </Link>
                  <div className="flex items-center">
                    {order.status === 'pending_captain' ? (
                      <Button variant="danger" onClick={() => setRejectingOrder(order)}>
                        ڕەتکردنەوەی سەفەری
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(rejectingOrder)}
        title="ڕەتکردنەوەی سەفەری"
        description="ئەم ئۆردەرە لەلایەن کارمەندەوە ڕەت دەکرێتەوە و لە بەشی ڕەتکردنەوەکاندا دەمێنێتەوە."
        confirmLabel="بەڵێ، ڕەتیکەوە"
        cancelLabel="پاشگەزبوونەوە"
        tone="danger"
        busy={busy}
        onClose={() => setRejectingOrder(null)}
        onConfirm={() => void handleRejectOrder()}
      />
    </EmployeeShell>
  );
};


