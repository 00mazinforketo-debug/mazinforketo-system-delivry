import { ArrowRight, Bell, CalendarRange, Check, ClipboardList, Loader2, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Select } from '../../components/ui/Select';
import { useLiveQuery } from '../../hooks/use-live-query';
import { formatCurrency, formatNumber } from '../../lib/format';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { DeleteOrdersPreviewDto, OrdersNotificationsSummaryDto, UserRole } from '../../types/models';
import { executeDeleteOrdersByRange, getOrdersNotificationsSummary, previewDeleteOrdersByRange } from '../settings/settings-service';

type DeleteRangeType = 'yesterday' | 'single_day' | 'custom_range';

type DeleteFilters = {
  roles: UserRole[];
  rangeType: DeleteRangeType;
  date: string;
  fromDate: string;
  toDate: string;
  includeTravelOrders: boolean;
  includeDeliveryOrders: boolean;
  includeTravelNotifications: boolean;
  includeDeliveryNotifications: boolean;
  includeActivityLogs: boolean;
};

const defaultFilters: DeleteFilters = {
  roles: ['employee', 'captain', 'admin'],
  rangeType: 'yesterday',
  date: '',
  fromDate: '',
  toDate: '',
  includeTravelOrders: true,
  includeDeliveryOrders: true,
  includeTravelNotifications: true,
  includeDeliveryNotifications: true,
  includeActivityLogs: true,
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'employee', label: 'کارمەند' },
  { value: 'captain', label: 'کاپتن' },
  { value: 'admin', label: 'ئادمێن' },
];

export const AdminMaintenancePage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const navigate = useNavigate();
  const [filters, setFilters] = useState<DeleteFilters>(defaultFilters);
  const [preview, setPreview] = useState<DeleteOrdersPreviewDto | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, loading, error, reload } = useLiveQuery<OrdersNotificationsSummaryDto>(
    async () => getOrdersNotificationsSummary(),
    {
      travelOrders: 0,
      deliveryOrders: 0,
      travelNotifications: 0,
      deliveryNotifications: 0,
      totalOrders: 0,
      totalNotifications: 0,
    },
    ['order-created', 'order-updated', 'delivery-order-created', 'delivery-order-updated', 'notification-changed', 'delivery-notification-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const totalRecords = data.totalOrders + data.totalNotifications;
  const allRolesSelected = roleOptions.every((role) => filters.roles.includes(role.value));
  const hasSelectedRoles = filters.roles.length > 0;
  const hasSelectedDataTypes =
    filters.includeTravelOrders ||
    filters.includeDeliveryOrders ||
    filters.includeTravelNotifications ||
    filters.includeDeliveryNotifications ||
    filters.includeActivityLogs;
  const hasValidDate =
    filters.rangeType === 'yesterday' ||
    (filters.rangeType === 'single_day' && Boolean(filters.date)) ||
    (filters.rangeType === 'custom_range' && Boolean(filters.fromDate) && Boolean(filters.toDate) && filters.fromDate <= filters.toDate);
  const canSubmit = hasSelectedRoles && hasSelectedDataTypes && hasValidDate;

  const resetPreview = () => setPreview(null);

  const updateFilters = (nextValue: Partial<DeleteFilters>) => {
    resetPreview();
    setFilters((current) => ({ ...current, ...nextValue }));
  };

  const toggleRole = (role: UserRole | 'all') => {
    resetPreview();
    if (role === 'all') {
      setFilters((current) => ({
        ...current,
        roles: roleOptions.map((item) => item.value),
      }));
      return;
    }

    setFilters((current) => ({
      ...current,
      roles: current.roles.includes(role) ? current.roles.filter((entry) => entry !== role) : [...current.roles, role],
    }));
  };

  const buildPayload = () => ({
    rangeType: filters.rangeType,
    roles: filters.roles,
    includeTravelOrders: filters.includeTravelOrders,
    includeDeliveryOrders: filters.includeDeliveryOrders,
    includeTravelNotifications: filters.includeTravelNotifications,
    includeDeliveryNotifications: filters.includeDeliveryNotifications,
    includeActivityLogs: filters.includeActivityLogs,
    ...(filters.rangeType === 'single_day' ? { date: filters.date } : {}),
    ...(filters.rangeType === 'custom_range' ? { fromDate: filters.fromDate, toDate: filters.toDate } : {}),
  });

  const handlePreview = async () => {
    if (!canSubmit) {
      showToast('هەڵبژاردنی ڕۆڵ، بەروار و جۆری داتا تەواو بکە.', 'error');
      return;
    }

    setPreviewBusy(true);
    try {
      const result = await previewDeleteOrdersByRange(buildPayload());
      setPreview(result);
      if (result.totalRecords === 0) {
        showToast('هیچ داتایەک بۆ ئەم هەڵبژاردنانە نەدۆزرایەوە.', 'success');
      }
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!canSubmit) {
      showToast('هەڵبژاردنی ڕۆڵ، بەروار و جۆری داتا تەواو بکە.', 'error');
      return;
    }

    setDeleteBusy(true);
    try {
      const result = await executeDeleteOrdersByRange(buildPayload(), actor);
      setPreview(result);
      await reload();
      showToast(
        `${formatNumber(result.totalRecords)} تۆمار سڕایەوە: ${formatNumber(result.travelOrders)} سەفەری، ${formatNumber(result.deliveryOrders)} گەیاندن، ${formatNumber(result.travelNotifications + result.deliveryNotifications)} ئاگەدارکردنەوە، ${formatNumber(result.activityLogCount)} چالاکی.`,
        'success',
      );
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const summaryCards = [
    {
      label: 'سەفەری',
      value: data.travelOrders,
      icon: ClipboardList,
      className: 'bg-stone-50 text-stone-900',
      labelClassName: 'text-stone-500',
      iconClassName: 'text-stone-500',
    },
    {
      label: 'ئاگەدارکردنەوەی سەفەری',
      value: data.travelNotifications,
      icon: Bell,
      className: 'bg-brand-50 text-brand-900',
      labelClassName: 'text-brand-700',
      iconClassName: 'text-brand-700',
    },
    {
      label: 'گەیاندن',
      value: data.deliveryOrders,
      icon: Truck,
      className: 'bg-sky-50 text-sky-900',
      labelClassName: 'text-sky-700',
      iconClassName: 'text-sky-700',
    },
    {
      label: 'ئاگەدارکردنەوەی گەیاندن',
      value: data.deliveryNotifications,
      icon: Bell,
      className: 'bg-amber-50 text-amber-900',
      labelClassName: 'text-amber-700',
      iconClassName: 'text-amber-700',
    },
  ] as const;

  return (
    <section className="space-y-6">
      <Card className="space-y-5 border-stone-200 bg-white/95">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge className="border-rose-200 bg-rose-50 text-rose-800">
              <Trash2 className="h-3.5 w-3.5" />
              <span>سڕینەوەی داتا</span>
            </Badge>
            <h1 className="text-xl font-black text-stone-900">پاککردنەوەی ئۆردەر و ئاگەدارکردنەوەکان</h1>
          </div>
          <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/admin/settings')}>
            گەڕانەوە
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی داتاکان" description={error} />
      ) : (
        <>
          <Card className="space-y-5 border-stone-200 bg-white/95">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-stone-900">پوختەی ئێستا</h2>
              <Badge className="border-rose-200 bg-rose-50 text-rose-800">{formatNumber(totalRecords)}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {summaryCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`rounded-3xl p-4 text-right ${item.className}`}>
                    <div className="flex items-center justify-between gap-3">
                      <Icon className={`h-5 w-5 ${item.iconClassName}`} />
                      <p className={`text-xs ${item.labelClassName}`}>{item.label}</p>
                    </div>
                    <p className="mt-3 text-2xl font-black">{formatNumber(item.value)}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-5 border-stone-200 bg-white/95">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-stone-900">پاککردنەوەی دیاریکراو</h2>
                <p className="text-sm text-stone-500">ڕۆڵ، بەروار و جۆری داتا هەڵبژێرە، پاشان پێشبینین ببینە و بیسڕەوە.</p>
              </div>
              <Badge className="border-stone-200 bg-stone-100 text-stone-700">
                <CalendarRange className="h-3.5 w-3.5" />
                <span>
                  {filters.rangeType === 'yesterday'
                    ? 'دوێنێ'
                    : filters.rangeType === 'single_day'
                      ? 'ڕۆژێکی دیاریکراو'
                      : 'ماوەی تایبەت'}
                </span>
              </Badge>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-black text-stone-900">هەڵبژاردنی ڕۆڵ</p>
              <div className="grid grid-cols-2 gap-3">
                {[{ value: 'all' as const, label: 'هەمووی' }, ...roleOptions].map((role) => {
                  const active = role.value === 'all' ? allRolesSelected : filters.roles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      className={`flex items-center justify-between rounded-[1.35rem] border px-4 py-3 text-sm font-black transition ${
                        active
                          ? 'border-stone-900 bg-stone-950 text-white shadow-card'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                      onClick={() => toggleRole(role.value)}
                    >
                      <span>{role.label}</span>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                          active
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-stone-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-6 text-stone-500">
                ئەگەر `هەمووی` هەڵبژێریت، واتە داتای کارمەند و کاپتن و ئادمێن لە هەمان ماوەدا دەسڕدرێتەوە. ئۆردەرەکان بە ڕۆڵی دروستکەر هەژمار دەکرێن، ئاگەدارکردنەوەکانیش بە ڕۆڵی وەرگر.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-right">
                <span className="text-sm font-black text-stone-900">جۆری بەروار</span>
                <Select value={filters.rangeType} onChange={(event) => updateFilters({ rangeType: event.target.value as DeleteRangeType })}>
                  <option value="yesterday">دوێنێ</option>
                  <option value="single_day">ڕۆژێکی دیاریکراو</option>
                  <option value="custom_range">ماوەی تایبەت</option>
                </Select>
              </label>

              {filters.rangeType === 'single_day' ? (
                <label className="space-y-2 text-right">
                  <span className="text-sm font-black text-stone-900">بەروار</span>
                  <Input type="date" value={filters.date} onChange={(event) => updateFilters({ date: event.target.value })} />
                </label>
              ) : filters.rangeType === 'custom_range' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-right">
                    <span className="text-sm font-black text-stone-900">لە بەرواری</span>
                    <Input type="date" value={filters.fromDate} onChange={(event) => updateFilters({ fromDate: event.target.value })} />
                  </label>
                  <label className="space-y-2 text-right">
                    <span className="text-sm font-black text-stone-900">بۆ بەرواری</span>
                    <Input type="date" value={filters.toDate} onChange={(event) => updateFilters({ toDate: event.target.value })} />
                  </label>
                </div>
              ) : (
                <div className="rounded-3xl bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-600">
                  دوێنێ بە شێوازی ڕۆژی کار هەژمار دەکرێت و هەموو تۆمارەکانی ئەو ڕۆژە دەدۆزێتەوە.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-black text-stone-900">جۆری داتا</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'includeTravelOrders', label: 'سەفەری' },
                  { key: 'includeTravelNotifications', label: 'ئاگەدارکردنەوەی سەفەری' },
                  { key: 'includeDeliveryOrders', label: 'گەیاندن' },
                  { key: 'includeDeliveryNotifications', label: 'ئاگەدارکردنەوەی گەیاندن' },
                  { key: 'includeActivityLogs', label: 'چالاکییە دواییەکان' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex cursor-pointer items-center justify-between rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 ${item.key === 'includeActivityLogs' ? 'sm:col-span-2' : ''}`}
                  >
                    <span className="text-sm font-black text-stone-900">{item.label}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-stone-900"
                      checked={filters[item.key as keyof DeleteFilters] as boolean}
                      onChange={(event) => updateFilters({ [item.key]: event.target.checked } as Partial<DeleteFilters>)}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs leading-6 text-stone-500">
                تێبینی: کاتێک ئۆردەرێک دەسڕدرێتەوە، ئاگەدارکردنەوە پەیوەندیدارەکانی خۆکار لەگەڵی دەسڕدرێنەوە. ئەگەر `چالاکییە دواییەکان`یش هەڵبژێریت، feed ـی چالاکی لە هەمان ماوەدا پاک دەکرێتەوە.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                icon={previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
                disabled={!canSubmit || previewBusy || deleteBusy}
                onClick={() => void handlePreview()}
              >
                پێشبینین
              </Button>
              <Button
                variant="danger"
                icon={deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                disabled={!canSubmit || previewBusy || deleteBusy}
                onClick={() => void handleDelete()}
              >
                سڕینەوەی هەڵبژاردەکان
              </Button>
            </div>

            {!hasSelectedRoles || !hasSelectedDataTypes || !hasValidDate ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                دەبێت لانیکەم یەک ڕۆڵ، یەک جۆر داتا و بەروارێکی دروست هەڵبژێریت.
              </div>
            ) : null}

            {preview ? (
              <div className="space-y-4 rounded-[1.8rem] border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-stone-900">ئەنجامی preview</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {preview.fromDate} تا {preview.toDate}
                    </p>
                  </div>
                  <Badge className="border-rose-200 bg-rose-50 text-rose-800">{formatNumber(preview.totalRecords)}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-white px-4 py-4">
                    <p className="text-xs text-stone-500">سەفەری</p>
                    <p className="mt-2 text-2xl font-black text-stone-900">{formatNumber(preview.travelOrders)}</p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4">
                    <p className="text-xs text-stone-500">ئاگەدارکردنەوەی سەفەری</p>
                    <p className="mt-2 text-2xl font-black text-stone-900">{formatNumber(preview.travelNotifications)}</p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4">
                    <p className="text-xs text-stone-500">گەیاندن</p>
                    <p className="mt-2 text-2xl font-black text-stone-900">{formatNumber(preview.deliveryOrders)}</p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4">
                    <p className="text-xs text-stone-500">ئاگەدارکردنەوەی گەیاندن</p>
                    <p className="mt-2 text-2xl font-black text-stone-900">{formatNumber(preview.deliveryNotifications)}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-white px-4 py-4">
                    <p className="text-xs text-stone-500">کاریگەری لەسەر پارە</p>
                    <p className="mt-2 text-lg font-black text-stone-900">{formatCurrency(preview.totalSalesImpact)}</p>
                  </div>
                  <div className="rounded-3xl bg-white px-4 py-4">
                    <p className="text-xs text-stone-500">تۆماری چالاکی</p>
                    <p className="mt-2 text-lg font-black text-stone-900">{formatNumber(preview.activityLogCount)}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </>
      )}
    </section>
  );
};
