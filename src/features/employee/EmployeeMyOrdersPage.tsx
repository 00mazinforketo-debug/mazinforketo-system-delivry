import { CalendarRange, LayoutGrid, Route as RouteIcon, Search, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Select } from '../../components/ui/Select';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { cn } from '../../lib/cn';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { DeliveryOrder, Order } from '../../types/models';
import { getBusinessDayKey } from '../../../shared/business-time';
import { updateDeliveryOrderStatus } from '../delivery/delivery-service';
import { updateOrderStatus } from '../orders/order-service';
import { EmployeeShell } from './EmployeeShell';
import { buildEmployeeOrderDateGroups, EmployeeOrderCard, matchesEmployeeOrderSearch, orderModeMeta, type MyOrdersMode, useEmployeeMyOrdersData } from './employee-my-orders-shared';

type EmployeeMyOrdersSection = MyOrdersMode | 'date';
type EmployeeMyOrdersStatusFilter = 'all' | 'pending_captain' | 'accepted' | 'cancelled';

const employeeMyOrdersStatusFilters: Array<{ value: EmployeeMyOrdersStatusFilter; label: string }> = [
  { value: 'all', label: 'هەمووی' },
  { value: 'pending_captain', label: 'لەچاوڕوانیدایە' },
  { value: 'accepted', label: 'قبوڵکراوە' },
  { value: 'cancelled', label: 'هەڵوەشێنراو' },
];

const dateModeMeta = {
  label: 'بەروار',
  emptyTitle: 'هێشتا هیچ بەروارێک نییە',
  emptyDescription: 'کاتێک ئۆردەرێک دروست بکەیت، بەروارەکەی لێرە دەردەکەوێت.',
  surfaceClassName: 'border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-sand/90',
  searchPlaceholder: 'گەڕان لە ئۆردەرەکانی ئەو ڕۆژە بە کۆد، ناو یان ژمارەی مۆبایل...',
} as const;

export const EmployeeMyOrdersPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [activeSection, setActiveSection] = usePersistentState<EmployeeMyOrdersSection>('employee-my-orders-mode', 'all');
  const [activeStatusFilter, setActiveStatusFilter] = usePersistentState<EmployeeMyOrdersStatusFilter>('employee-my-orders-status-filter', 'all');
  const [selectedDayKey, setSelectedDayKey] = usePersistentState('employee-my-orders-date-selected', '');
  const [search, setSearch] = usePersistentState('employee-my-orders-search', '');
  const [todayDayKey, setTodayDayKey] = useState(() => getBusinessDayKey(new Date()));
  const [rejectingTravelOrder, setRejectingTravelOrder] = useState<Order | null>(null);
  const [rejectingDeliveryOrder, setRejectingDeliveryOrder] = useState<DeliveryOrder | null>(null);
  const [busy, setBusy] = useState(false);

  const { travelQuery, deliveryQuery, combinedVisibleOrders } = useEmployeeMyOrdersData(session);

  useEffect(() => {
    const syncBusinessDay = () => {
      const nextDayKey = getBusinessDayKey(new Date());
      setTodayDayKey((currentDayKey) => {
        if (currentDayKey === nextDayKey) {
          return currentDayKey;
        }

        setActiveSection('all');
        return nextDayKey;
      });
    };

    syncBusinessDay();
    const intervalId = window.setInterval(syncBusinessDay, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [setActiveSection]);

  if (!session) {
    return null;
  }

  const query = search.trim().toLowerCase();
  const currentMeta = activeSection === 'date' ? dateModeMeta : orderModeMeta[activeSection];
  const currentLoading =
    activeSection === 'travel' ? travelQuery.loading : activeSection === 'delivery' ? deliveryQuery.loading : travelQuery.loading || deliveryQuery.loading;
  const currentError = activeSection === 'travel' ? travelQuery.error : activeSection === 'delivery' ? deliveryQuery.error : travelQuery.error || deliveryQuery.error;

  const dateGroups = buildEmployeeOrderDateGroups(combinedVisibleOrders);
  const hasDateGroups = dateGroups.length > 0;
  const activeDayKey = dateGroups.some((group) => group.dayKey === selectedDayKey) ? selectedDayKey : (dateGroups[0]?.dayKey ?? '');
  const activeDateGroup = dateGroups.find((group) => group.dayKey === activeDayKey) ?? null;
  const todayRecords = combinedVisibleOrders.filter((record) => record.dayKey === todayDayKey);
  const countScopeRecords = combinedVisibleOrders.filter((record) => record.dayKey === (activeSection === 'date' ? activeDayKey : todayDayKey));

  const statusScopeRecords =
    activeSection === 'date'
      ? activeDateGroup?.records ?? []
      : todayRecords.filter((record) => activeSection === 'all' || record.mode === activeSection);

  const currentRecords = statusScopeRecords
    .filter((record) => activeStatusFilter === 'all' || record.order.status === activeStatusFilter)
    .filter((record) => matchesEmployeeOrderSearch(record.order, query));

  const cardCounts = {
    all: countScopeRecords.length,
    travel: countScopeRecords.filter((record) => record.mode === 'travel').length,
    delivery: countScopeRecords.filter((record) => record.mode === 'delivery').length,
  };

  const statusCounts = {
    all: statusScopeRecords.length,
    pending_captain: statusScopeRecords.filter((record) => record.order.status === 'pending_captain').length,
    accepted: statusScopeRecords.filter((record) => record.order.status === 'accepted').length,
    cancelled: statusScopeRecords.filter((record) => record.order.status === 'cancelled').length,
  };

  const handleRejectTravelOrder = async () => {
    if (!session || !rejectingTravelOrder) {
      return;
    }

    setBusy(true);
    try {
      await updateOrderStatus(
        rejectingTravelOrder.id,
        'cancelled',
        { role: session.role, displayName: session.displayName },
        'لەلایەن کارمەندەوە ڕەتکرایەوە.',
      );
      setRejectingTravelOrder(null);
      await travelQuery.reload();
      showToast('سەفەرییەکە بە سەرکەوتوویی ڕەتکرایەوە.', 'success');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRejectDeliveryOrder = async () => {
    if (!session || !rejectingDeliveryOrder) {
      return;
    }

    setBusy(true);
    try {
      await updateDeliveryOrderStatus(
        rejectingDeliveryOrder.id,
        'cancelled',
        { role: session.role, displayName: session.displayName },
        'لەلایەن کارمەندەوە ڕەتکرایەوە.',
      );
      setRejectingDeliveryOrder(null);
      await deliveryQuery.reload();
      showToast('داواکاریی گەیاندن بە سەرکەوتوویی ڕەتکرایەوە.', 'success');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmployeeShell>
      <section className="space-y-6">
        <Card className={cn('space-y-5 overflow-hidden', currentMeta.surfaceClassName)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black text-stone-900">ئۆردەرەکانم</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                key: 'all',
                label: 'هەمووی',
                count: cardCounts.all,
                icon: LayoutGrid,
                accentClassName: 'bg-stone-100 text-stone-700',
              },
              {
                key: 'travel',
                label: 'سەفەری',
                count: cardCounts.travel,
                icon: RouteIcon,
                accentClassName: 'bg-brand-100 text-brand-800',
              },
              {
                key: 'delivery',
                label: 'گەیاندن',
                count: cardCounts.delivery,
                icon: Truck,
                accentClassName: 'bg-sky-100 text-sky-700',
              },
            ].map((item) => {
              const Icon = item.icon;
              const mode = item.key as MyOrdersMode;
              const isActive = activeSection === mode;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn(
                    'flex min-h-[108px] flex-col justify-between rounded-[1.8rem] border px-4 py-4 text-right transition',
                    isActive ? orderModeMeta[mode].buttonActiveClassName : orderModeMeta[mode].buttonIdleClassName,
                  )}
                  onClick={() => setActiveSection(mode)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', isActive ? orderModeMeta[mode].buttonIconWrapClassName : item.accentClassName)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge className={isActive ? 'border-white/20 bg-white/10 text-white' : orderModeMeta[mode].badgeClassName}>{item.count}</Badge>
                  </div>
                  <p className="text-base font-black">{item.label}</p>
                </button>
              );
            })}

            <button
              type="button"
              className={cn(
                'flex min-h-[108px] flex-col justify-between rounded-[1.8rem] border px-4 py-4 text-right transition',
                activeSection === 'date'
                  ? 'border-emerald-600 bg-emerald-700 text-white shadow-card'
                  : hasDateGroups
                    ? 'border-emerald-200 bg-white/90 text-stone-800 hover:border-emerald-300 hover:bg-emerald-50/80'
                    : 'border-stone-200 bg-white/70 text-stone-800 hover:border-stone-300 hover:bg-white',
              )}
              onClick={() => setActiveSection('date')}
            >
              <div>
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl',
                    activeSection === 'date' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700',
                  )}
                >
                  <CalendarRange className="h-5 w-5" />
                </div>
              </div>
              <p className="text-base font-black">بەروار</p>
            </button>
          </div>

          {activeSection === 'date' && hasDateGroups ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <label className="space-y-2 text-right">
                <span className="text-sm font-bold text-stone-700">هەڵبژاردنی بەروار</span>
                <Select
                  className="border-emerald-200 bg-white/95 text-right"
                  dir="rtl"
                  value={activeDayKey}
                  onChange={(event) => setSelectedDayKey(event.target.value)}
                >
                  {dateGroups.map((group) => (
                    <option key={group.dayKey} value={group.dayKey}>
                      {group.label} - {group.records.length} ئۆردەر
                    </option>
                  ))}
                </Select>
              </label>
              <div className="rounded-[1.8rem] border border-emerald-200 bg-emerald-700 px-4 py-4 text-right text-white shadow-card">
                <p className="text-xs font-bold text-white/70">بەرواری هەڵبژێردراو</p>
                <p className="mt-2 text-lg font-black">{activeDateGroup?.label || 'هێشتا نییە'}</p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-4 gap-2">
            {employeeMyOrdersStatusFilters.map((filter) => {
              const isActive = activeStatusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  className={cn(
                    'rounded-[1.1rem] border px-2 py-3 text-center text-[11px] font-black leading-4 transition sm:text-xs',
                    isActive
                      ? 'border-stone-900 bg-stone-950 text-white shadow-card'
                      : 'border-white/80 bg-white/90 text-stone-700 hover:border-stone-300 hover:bg-stone-50',
                  )}
                  onClick={() => setActiveStatusFilter(filter.value)}
                >
                  <span className="block">{filter.label}</span>
                  <span
                    className={cn(
                      'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px]',
                      isActive ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-600',
                    )}
                  >
                    {statusCounts[filter.value]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="border-white/70 bg-white/85 pr-11"
              placeholder={currentMeta.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </Card>

        {currentLoading ? (
          <LoadingBlock />
        ) : currentError ? (
          <EmptyState title={`هەڵە لە بارکردنی ${currentMeta.label}`} description={currentError} />
        ) : activeSection === 'date' && !hasDateGroups ? (
          <EmptyState title={dateModeMeta.emptyTitle} description={dateModeMeta.emptyDescription} />
        ) : currentRecords.length === 0 ? (
          <EmptyState
            title={activeSection === 'date' && activeDateGroup ? `هیچ ئۆردەرێک بۆ ${activeDateGroup.label} نەدۆزرایەوە` : currentMeta.emptyTitle}
            description={
              query
                ? 'گەڕانەکە بگۆڕە یان بسڕەوە بۆ ئەوەی هەموو ئۆردەرەکان ببینیت.'
                : activeSection === 'date'
                  ? 'بەروارێکی تر هەڵبژێرە یان چاوەڕێی ئۆردەرێکی نوێ بکە.'
                  : currentMeta.emptyDescription
            }
          />
        ) : activeSection === 'date' && activeDateGroup ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-stone-900">ئۆردەرەکانی {activeDateGroup.label}</h3>
                <p className="mt-1 text-sm font-semibold text-stone-500">هەموو سەفەری و گەیاندنەکانی ئەم ڕۆژە لێرەن.</p>
              </div>
              <Badge className="border-stone-200 bg-white/90 text-stone-700">{currentRecords.length} ئۆردەر</Badge>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {currentRecords.map((record) => (
                <EmployeeOrderCard
                  key={record.order.id}
                  record={record}
                  onRejectTravelOrder={setRejectingTravelOrder}
                  onRejectDeliveryOrder={setRejectingDeliveryOrder}
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {currentRecords.map((record) => (
              <EmployeeOrderCard
                key={record.order.id}
                record={record}
                onRejectTravelOrder={setRejectingTravelOrder}
                onRejectDeliveryOrder={setRejectingDeliveryOrder}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(rejectingTravelOrder)}
        title="ڕەتکردنەوەی سەفەری"
        description="ئەم ئۆردەرە لەلایەن کارمەندەوە ڕەت دەکرێتەوە و لە بەشی هەڵوەشاوەکاندا دەمێنێتەوە."
        confirmLabel="بەڵێ، ڕەتیکەوە"
        cancelLabel="پاشگەزبوونەوە"
        tone="danger"
        busy={busy}
        onClose={() => setRejectingTravelOrder(null)}
        onConfirm={() => void handleRejectTravelOrder()}
      />

      <ConfirmDialog
        open={Boolean(rejectingDeliveryOrder)}
        title="ڕەتکردنەوەی گەیاندن"
        description="ئەم داواکارییە لەلایەن کارمەندەوە ڕەت دەکرێتەوە و لە بەشی هەڵوەشاوەکاندا دەمێنێتەوە."
        confirmLabel="بەڵێ، ڕەتیکەوە"
        cancelLabel="پاشگەزبوونەوە"
        tone="danger"
        busy={busy}
        onClose={() => setRejectingDeliveryOrder(null)}
        onConfirm={() => void handleRejectDeliveryOrder()}
      />
    </EmployeeShell>
  );
};
