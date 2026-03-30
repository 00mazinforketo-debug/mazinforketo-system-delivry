import { Bell, ClipboardList, Download, FolderOpen, Images, Loader2, Truck, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { AppSettings } from '../../types/models';
import type { BackupScope } from '../settings/settings-service';
import { exportBackupForScope, getAppSettings, importBackupForScope } from '../settings/settings-service';
import { getAllDeliveryNotifications } from '../delivery/delivery-notification-service';
import { getAllDeliveryOrders } from '../delivery/delivery-service';
import { getAllMediaAssets } from '../media/media-service';
import { getCategories, getMenuItems } from '../menu/menu-service';
import { getAllNotifications } from '../notifications/notification-service';
import { getAllOrders } from '../orders/order-service';

const scopeOptions: Array<{ value: BackupScope; label: string }> = [
  { value: 'all', label: 'هەمووی' },
  { value: 'employee', label: 'کارمەند' },
  { value: 'captain', label: 'کاپتن' },
  { value: 'admin', label: 'ئادمێن' },
];

export const AdminStoragePage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scope, setScope] = useState<BackupScope>('all');
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [pendingImportText, setPendingImportText] = useState('');
  const [pendingImportName, setPendingImportName] = useState('');
  const [busyAction, setBusyAction] = useState<'export' | 'import' | null>(null);

  const { data, loading, error, reload } = useLiveQuery<{
    settings: AppSettings | null;
    categories: Awaited<ReturnType<typeof getCategories>>;
    menuItems: Awaited<ReturnType<typeof getMenuItems>>;
    mediaAssets: Awaited<ReturnType<typeof getAllMediaAssets>>;
    orders: Awaited<ReturnType<typeof getAllOrders>>;
    deliveryOrders: Awaited<ReturnType<typeof getAllDeliveryOrders>>;
    notifications: Awaited<ReturnType<typeof getAllNotifications>>;
    deliveryNotifications: Awaited<ReturnType<typeof getAllDeliveryNotifications>>;
  }>(
    async () => {
      const [settings, categories, menuItems, mediaAssets, orders, deliveryOrders, notifications, deliveryNotifications] = await Promise.all([
        getAppSettings(),
        getCategories(),
        getMenuItems(),
        getAllMediaAssets(),
        getAllOrders(),
        getAllDeliveryOrders(),
        getAllNotifications(),
        getAllDeliveryNotifications(),
      ]);

      return {
        settings,
        categories,
        menuItems,
        mediaAssets,
        orders,
        deliveryOrders,
        notifications,
        deliveryNotifications,
      };
    },
    {
      settings: null as AppSettings | null,
      categories: [],
      menuItems: [],
      mediaAssets: [],
      orders: [],
      deliveryOrders: [],
      notifications: [],
      deliveryNotifications: [],
    },
    ['settings-changed', 'menu-changed', 'catalog-changed', 'media-changed', 'order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'notification-changed', 'delivery-notification-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const heroStats = [
    { label: 'Media Assets', value: data.mediaAssets.length },
    { label: 'Catalog Data', value: data.categories.length + data.menuItems.length },
    { label: 'سەفەری', value: data.orders.length },
    { label: 'گەیاندن', value: data.deliveryOrders.length },
  ] as const;

  const filteredOrders = scope === 'all' ? data.orders : data.orders.filter((order) => order.createdByRole === scope);
  const filteredDeliveryOrders = scope === 'all' ? data.deliveryOrders : data.deliveryOrders.filter((order) => order.createdByRole === scope);
  const filteredNotifications = scope === 'all' ? data.notifications : data.notifications.filter((notification) => notification.targetRole === scope);
  const filteredDeliveryNotifications =
    scope === 'all' ? data.deliveryNotifications : data.deliveryNotifications.filter((notification) => notification.targetRole === scope);

  const handleExport = async () => {
    setBusyAction('export');
    try {
      await exportBackupForScope(scope);
      showToast('backup دابەزێنرا.', 'success');
      setConfirmExportOpen(false);
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleImport = async () => {
    if (!pendingImportText) {
      return;
    }

    setBusyAction('import');
    try {
      await importBackupForScope(pendingImportText, scope, actor);
      await reload();
      showToast('داتاکان گەڕانەوە.', 'success');
      setConfirmImportOpen(false);
      setPendingImportText('');
      setPendingImportName('');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusyAction(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="پاراستن"
        icon={FolderOpen}
        title="export/import و backup"
        description="بۆ هەڵگرتنی داتاوزانیاریەکان، وێنەکان و گەڕانەوەی داتاوزانیاریەکان."
        stats={heroStats}
        statsGridClassName="grid-cols-2"
      />

      {loading ? (
        <LoadingBlock />
      ) : error || !data.settings ? (
        <EmptyState title="هەڵە لە بارکردنی پاراستن" description={error ?? 'داتا نەدۆزرایەوە.'} />
      ) : (
        <>
          <Card className="space-y-5 border-stone-200 bg-white/95">
            <div className="space-y-3">
              <h3 className="text-lg font-black text-stone-900">هەڵبژاردنی بەش</h3>
              <div className="grid grid-cols-2 gap-3">
                {scopeOptions.map((item) => {
                  const active = scope === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={`rounded-[1.35rem] border px-4 py-3 text-sm font-black transition ${
                        active
                          ? 'border-stone-900 bg-stone-950 text-white shadow-card'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                      onClick={() => setScope(item.value)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-stone-50 p-4 text-right">
                <div className="flex items-center justify-between gap-3">
                  <ClipboardList className="h-5 w-5 text-stone-500" />
                  <p className="text-xs text-stone-500">سەفەری</p>
                </div>
                <p className="mt-3 text-2xl font-black text-stone-900">{filteredOrders.length}</p>
              </div>
              <div className="rounded-3xl bg-sky-50 p-4 text-right">
                <div className="flex items-center justify-between gap-3">
                  <Truck className="h-5 w-5 text-sky-700" />
                  <p className="text-xs text-sky-700">گەیاندن</p>
                </div>
                <p className="mt-3 text-2xl font-black text-sky-900">{filteredDeliveryOrders.length}</p>
              </div>
              <div className="rounded-3xl bg-brand-50 p-4 text-right">
                <div className="flex items-center justify-between gap-3">
                  <Bell className="h-5 w-5 text-brand-700" />
                  <p className="text-xs text-brand-700">ئاگەدارکردنەوە</p>
                </div>
                <p className="mt-3 text-2xl font-black text-brand-900">{filteredNotifications.length + filteredDeliveryNotifications.length}</p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-4 text-right">
                <div className="flex items-center justify-between gap-3">
                  <Images className="h-5 w-5 text-amber-700" />
                  <p className="text-xs text-amber-700">وێنە و خواردن</p>
                </div>
                <p className="mt-3 text-2xl font-black text-amber-900">{data.mediaAssets.length + data.menuItems.length + data.categories.length}</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-emerald-50/60">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-stone-900">کورتکراوە دابەزاندنی داتاکان</h3>
                <p className="text-sm leading-7 text-stone-600">
                  settings، پۆلەکان، خواردنەکان، وێنەکان، سەفەری، گەیاندن و ئاگەدارکردنەوەکان بە پشتگیریی هەڵبژاردنی `هەمووی / کارمەند / کاپتن / ئادمێن` وەک فایل دادەبەزێنێت.
                </p>
              </div>
              <Button icon={busyAction === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} onClick={() => setConfirmExportOpen(true)}>
                کورتکراوە دابەزاندنی داتاکان
              </Button>
            </Card>

            <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/60">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-stone-900">گەڕانەوەی داتاکان</h3>
                <p className="text-sm leading-7 text-stone-600">
                  بۆ `هەمووی` هەموو داتای backup دەگەڕێتەوە. بۆ `کارمەند / کاپتن / ئادمێن` تەنها ئۆردەر و ئاگەدارکردنەوە و تۆماری چالاکیی هەمان بەش دەگەڕێتەوە.
                </p>
              </div>
              <Button variant="secondary" icon={busyAction === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>
                گەڕانەوەی داتاکان
              </Button>
            </Card>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }

              void (async () => {
                setPendingImportText(await file.text());
                setPendingImportName(file.name);
                setConfirmImportOpen(true);
              })();
            }}
          />

          <ConfirmDialog
            open={confirmExportOpen}
            title="دابەزاندنی backup"
            description="ئەم هەنگاوە backup ـێکی runtime data، وێنە و ڕێکخستنەکان بۆت دابەزێنێت. فایلەکە source code نییە، بەڵکو داتای سیستەمە."
            confirmLabel="بەڵێ، دایبەزێنە"
            cancelLabel="پاشگەزبوونەوە"
            busy={busyAction === 'export'}
            onClose={() => setConfirmExportOpen(false)}
            onConfirm={() => void handleExport()}
            extraContent={
              <div className="rounded-3xl bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                <p>بەشی هەڵبژێردراو: {scopeOptions.find((item) => item.value === scope)?.label}</p>
                <p>سەفەری: {filteredOrders.length}</p>
                <p>گەیاندن: {filteredDeliveryOrders.length}</p>
                <p>ئاگەدارکردنەوە: {filteredNotifications.length + filteredDeliveryNotifications.length}</p>
              </div>
            }
          />

          <ConfirmDialog
            open={confirmImportOpen}
            title="گەڕانەوەی backup"
            description="ئەم هەنگاوە داتاکانی بەشی هەڵبژێردراو دەگەڕێنێتەوە. بۆ `هەمووی` هەموو سیستەم دەگۆڕدرێت، بۆ ڕۆڵەکان تەنها داتای هەمان ڕۆڵ نوێ دەکرێتەوە."
            confirmLabel="بەڵێ، گەڕانەوە بکە"
            cancelLabel="پاشگەزبوونەوە"
            busy={busyAction === 'import'}
            onClose={() => {
              setConfirmImportOpen(false);
              setPendingImportText('');
              setPendingImportName('');
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            onConfirm={() => void handleImport()}
            extraContent={
              <div className="rounded-3xl bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                <p>فایل: {pendingImportName || 'دیارینەکراوە'}</p>
                <p>بەشی هەڵبژێردراو: {scopeOptions.find((item) => item.value === scope)?.label}</p>
              </div>
            }
          />
        </>
      )}
    </div>
  );
};
