import { ArrowRight, Bell, SquareMenu, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { appendHiddenEntityIds, getHiddenEntityIds } from '../../lib/view-state';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { DeliveryOrder, NotificationItem, Order } from '../../types/models';
import { getDeliveryOrdersByCreator } from '../delivery/delivery-service';
import { getNotificationsForSession, hideNotificationsForSession } from '../notifications/notification-service';
import { getOrdersByCreator } from '../orders/order-service';
import { EmployeeShell } from './EmployeeShell';

type ClearAction = 'notifications' | 'travel' | 'delivery' | null;

export const EmployeeDataClearPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<ClearAction>(null);

  const { data, loading, error, reload } = useLiveQuery<{
    travelOrders: Order[];
    deliveryOrders: DeliveryOrder[];
    notifications: NotificationItem[];
  }>(
    async () => {
      const [travelOrders, deliveryOrders, notifications] = await Promise.all([
        getOrdersByCreator(session?.displayName ?? ''),
        getDeliveryOrdersByCreator(session?.displayName ?? ''),
        session ? getNotificationsForSession(session) : Promise.resolve([]),
      ]);
      return { travelOrders, deliveryOrders, notifications };
    },
    {
      travelOrders: [],
      deliveryOrders: [],
      notifications: [],
    },
    ['order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'notification-changed', 'delivery-notification-changed', 'view-state-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const hiddenTravelIds = new Set(getHiddenEntityIds('orders', session));
  const hiddenDeliveryIds = new Set(getHiddenEntityIds('deliveryOrders', session));
  const visibleTravelOrders = data.travelOrders.filter((order) => !hiddenTravelIds.has(order.id));
  const visibleDeliveryOrders = data.deliveryOrders.filter((order) => !hiddenDeliveryIds.has(order.id));

  const actionMeta = {
    notifications: {
      title: 'سڕینەوەی ئاگەدارکردنەوەکان',
      description: 'ئەم هەنگاوە پەیامەکانت تەنها لە لای خۆت دەشارێتەوە.',
    },
    travel: {
      title: 'سڕینەوەی ئۆردەری سەفەری',
      description: 'هەموو ئۆردەرە سەفەرییەکانت تەنها لە بینینی تۆدا شاراوە دەکرێنەوە.',
    },
    delivery: {
      title: 'سڕینەوەی ئۆردەری گەیاندن',
      description: 'هەموو ئۆردەرە گەیاندنەکانت تەنها لە بینینی تۆدا شاراوە دەکرێنەوە.',
    },
  } as const;

  const runClearAction = async () => {
    if (!activeAction) {
      return;
    }

    setBusy(true);
    try {
      if (activeAction === 'notifications') {
        await hideNotificationsForSession(session);
        showToast('ئاگەدارکردنەوەکانت لە لای خۆت شاراوە کرانەوە.', 'success');
      }

      if (activeAction === 'travel') {
        appendHiddenEntityIds('orders', session, visibleTravelOrders.map((order) => order.id));
        showToast('ئۆردەری سەفەرییەکانت لە لای خۆت شاراوە کرانەوە.', 'success');
      }

      if (activeAction === 'delivery') {
        appendHiddenEntityIds('deliveryOrders', session, visibleDeliveryOrders.map((order) => order.id));
        showToast('ئۆردەری گەیاندنەکانت لە لای خۆت شاراوە کرانەوە.', 'success');
      }

      await reload();
      setActiveAction(null);
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmployeeShell>
      <section className="space-y-6">
        <Card className="space-y-5 border-stone-200 bg-white/95">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge className="border-rose-200 bg-rose-50 text-rose-800">
                <Trash2 className="h-3.5 w-3.5" />
                <span>سڕینەوەی داتا</span>
              </Badge>
              <div>
                <h1 className="text-3xl font-black text-stone-900">پاککردنەوەی داتای کارمەند</h1>
              </div>
            </div>
            <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/employee/settings')}>
              گەڕانەوە
            </Button>
          </div>
        </Card>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState title="هەڵە لە بارکردنی داتاکان" description={error} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {[
              {
                key: 'notifications',
                title: 'ئاگەدارکردنەوەکان',
                count: data.notifications.length,
                description: 'هەموو پەیامەکانی تۆ تەنها لە لای خۆت بسڕەوە.',
                icon: Bell,
                tone: 'bg-stone-50 text-stone-900',
              },
              {
                key: 'travel',
                title: 'ئۆردەری سەفەری',
                count: visibleTravelOrders.length,
                description: 'تەنها سەفەرییەکانت لە مێژوو و لیستەکاندا پاک بکەرەوە.',
                icon: SquareMenu,
                tone: 'bg-brand-50 text-brand-900',
              },
              {
                key: 'delivery',
                title: 'ئۆردەری گەیاندن',
                count: visibleDeliveryOrders.length,
                description: 'تەنها گەیاندنەکانت لە مێژوو و لیستەکاندا پاک بکەرەوە.',
                icon: Truck,
                tone: 'bg-sky-50 text-sky-900',
              },
            ].map((card) => (
              <Card key={card.key} className="space-y-4 border-stone-200 bg-white/95">
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-3xl ${card.tone}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <Badge>{card.count}</Badge>
                </div>
                <div>
                  <h2 className="text-xl font-black text-stone-900">{card.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-stone-600">{card.description}</p>
                </div>
                <Button
                  variant="danger"
                  className="w-full"
                  icon={<Trash2 className="h-4 w-4" />}
                  disabled={card.count === 0}
                  onClick={() => setActiveAction(card.key as Exclude<ClearAction, null>)}
                >
                  سڕینەوە
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(activeAction)}
        title={activeAction ? actionMeta[activeAction].title : ''}
        description={activeAction ? actionMeta[activeAction].description : ''}
        confirmLabel="بەڵێ، بیسڕەوە"
        cancelLabel="پاشگەزبوونەوە"
        tone="danger"
        busy={busy}
        onClose={() => setActiveAction(null)}
        onConfirm={() => void runClearAction()}
      />
    </EmployeeShell>
  );
};
