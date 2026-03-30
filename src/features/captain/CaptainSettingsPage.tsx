import { Bell, ClipboardList, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { appendHiddenEntityIds, getHiddenEntityIds } from '../../lib/view-state';
import { formatNumber } from '../../lib/format';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { DeliveryNotification, DeliveryOrder, NotificationItem, Order } from '../../types/models';
import { getAllDeliveryOrders } from '../delivery/delivery-service';
import { getDeliveryNotificationsForSession, hideDeliveryNotificationsForSession } from '../delivery/delivery-notification-service';
import { getNotificationsForSession, hideNotificationsForSession } from '../notifications/notification-service';
import { getAllOrders } from '../orders/order-service';
import { CaptainShell } from './CaptainShell';

type ClearAction = 'orders' | 'notifications' | null;

export const CaptainSettingsPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<ClearAction>(null);

  const { data, loading, error, reload } = useLiveQuery<{
    travelOrders: Order[];
    deliveryOrders: DeliveryOrder[];
    notifications: NotificationItem[];
    deliveryNotifications: DeliveryNotification[];
  }>(
    async () => {
      const [travelOrders, deliveryOrders, notifications, deliveryNotifications] = await Promise.all([
        getAllOrders(),
        getAllDeliveryOrders(),
        session ? getNotificationsForSession(session) : Promise.resolve([]),
        session ? getDeliveryNotificationsForSession(session) : Promise.resolve([]),
      ]);

      return {
        travelOrders: travelOrders.filter((order) => order.status !== 'pending_captain'),
        deliveryOrders: deliveryOrders.filter((order) => order.status !== 'pending_captain'),
        notifications,
        deliveryNotifications,
      };
    },
    {
      travelOrders: [],
      deliveryOrders: [],
      notifications: [],
      deliveryNotifications: [],
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
  const visibleNotificationCount = data.notifications.length + data.deliveryNotifications.length;
  const visibleOrderCount = visibleTravelOrders.length + visibleDeliveryOrders.length;

  const actionMeta = {
    orders: {
      title: 'سڕینەوەی هەموو ئۆردەرەکان',
      description: 'هەموو ئۆردەر، مێژوو و ئاگەدارکردنەوەکانی کاپتن تەنها لە لای خۆت و لەم ئامێرەدا دەشاردرێنەوە. لە لای ئادمین و لە cloud هەر دەمێنن.',
    },
    notifications: {
      title: 'سڕینەوەی ئاگەدارکردنەوەکان',
      description: 'پەیامەکانی سەفەری و گەیاندن تەنها لە لیستی کاپتندا دەشارێنەوە.',
    },
  } as const;

  const runClearAction = async () => {
    if (!activeAction) {
      return;
    }

    setBusy(true);
    try {
      if (activeAction === 'orders') {
        appendHiddenEntityIds('orders', session, visibleTravelOrders.map((order) => order.id));
        appendHiddenEntityIds('deliveryOrders', session, visibleDeliveryOrders.map((order) => order.id));
        await Promise.all([hideNotificationsForSession(session), hideDeliveryNotificationsForSession(session)]);
        showToast('هەموو ئۆردەر و ئاگەدارکردنەوەکانی کاپتن تەنها لە لای خۆت شاراوە کرانەوە.', 'success');
      }

      if (activeAction === 'notifications') {
        await Promise.all([hideNotificationsForSession(session), hideDeliveryNotificationsForSession(session)]);
        showToast('ئاگەدارکردنەوەکانی کاپتن شاراوە کرانەوە.', 'success');
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
    <CaptainShell>
      <section className="space-y-6">
        <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/70">
          <div className="mx-auto max-w-3xl space-y-5 text-center">
            <Badge className="border-brand-200 bg-brand-50 text-brand-800">
              <Settings2 className="h-3.5 w-3.5" />
              <span>ڕێخستن</span>
            </Badge>
            <div>
              <h1 className="text-3xl font-black text-stone-900">ناوەندی ڕێخستنی کاپتن</h1>
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState title="هەڵە لە بارکردنی ڕێکخستن" description={error} />
        ) : (
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="space-y-5 border-stone-200 bg-white/95">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-50 text-brand-900">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <Badge>{formatNumber(visibleOrderCount)}</Badge>
              </div>
              <div className="space-y-2 text-right">
                <h2 className="text-xl font-black text-stone-900">سڕینەوەی هەموو ئۆردەرەکان</h2>
                <p className="text-sm leading-7 text-stone-600">
                  {formatNumber(visibleTravelOrders.length)} سەفەری و {formatNumber(visibleDeliveryOrders.length)} گەیاندن
                  دەتوانی لە لای خۆت بسڕیتەوە.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-stone-50 px-3 py-3 text-right">
                  <p className="text-xs text-stone-500">سەفەری</p>
                  <p className="mt-1 font-black text-stone-900">{formatNumber(visibleTravelOrders.length)}</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-3 py-3 text-right">
                  <p className="text-xs text-sky-700">گەیاندن</p>
                  <p className="mt-1 font-black text-sky-900">{formatNumber(visibleDeliveryOrders.length)}</p>
                </div>
              </div>
              <Button
                variant="danger"
                block
                icon={<Trash2 className="h-4 w-4" />}
                disabled={visibleOrderCount === 0 && visibleNotificationCount === 0}
                onClick={() => setActiveAction('orders')}
              >
                سڕینەوەی هەموو ئۆردەرەکان
              </Button>
            </Card>

            <Card className="space-y-5 border-stone-200 bg-white/95">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-stone-100 text-stone-900">
                  <Bell className="h-6 w-6" />
                </div>
                <Badge>{formatNumber(visibleNotificationCount)}</Badge>
              </div>
              <div className="space-y-2 text-right">
                <h2 className="text-xl font-black text-stone-900">پاککردنەوەی ئاگەدارکردنەوەکان</h2>
                <p className="text-sm leading-7 text-stone-600">
                  {formatNumber(data.notifications.length)} پەیامی سەفەری و {formatNumber(data.deliveryNotifications.length)} پەیامی گەیاندن
                  لە لیستی کاپتن شاراوە دەکرێنەوە.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-brand-50 px-3 py-3 text-right">
                  <p className="text-xs text-brand-700">سەفەری</p>
                  <p className="mt-1 font-black text-brand-900">{formatNumber(data.notifications.length)}</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-3 py-3 text-right">
                  <p className="text-xs text-sky-700">گەیاندن</p>
                  <p className="mt-1 font-black text-sky-900">{formatNumber(data.deliveryNotifications.length)}</p>
                </div>
              </div>
              <Button
                variant="danger"
                block
                icon={<Trash2 className="h-4 w-4" />}
                disabled={visibleNotificationCount === 0}
                onClick={() => setActiveAction('notifications')}
              >
                سڕینەوەی ئاگەدارکردنەوەکان
              </Button>
            </Card>

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
    </CaptainShell>
  );
};
