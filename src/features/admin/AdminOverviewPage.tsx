import {
  Activity,
  BellRing,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  PackageCheck,
  Settings2,
  ShieldCheck,
  Soup,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { formatCurrency, formatDateTime, formatWeekdayMonthDay } from '../../lib/format';
import type { AppSettings, ReportsSummaryDto } from '../../types/models';
import { getAllMediaAssets } from '../media/media-service';
import { getAllNotifications } from '../notifications/notification-service';
import { getReportsSummary } from './reports-service';
import { getAppSettings, getRecentActivity } from '../settings/settings-service';

const quickLinks = [
  {
    to: '/admin',
    label: 'داشبۆرد',
    description: 'پوختەی سیستەم، ئامار، quick actions و داتای operational لە یەک شوێن.',
    icon: LayoutDashboard,
    tone: 'from-stone-100 via-white to-brand-50 border-stone-200 text-stone-900',
  },
  {
    to: '/admin/all-foods?tab=items',
    label: 'خواردنەکان',
    description: 'پۆلەکان و خواردنەکان لە یەک پەیج، زیادکردن، دەستکاری و وێنەکان.',
    icon: FolderKanban,
    tone: 'from-amber-50 via-white to-orange-50 border-amber-100 text-amber-900',
  },
  {
    to: '/admin/reports',
    label: 'ڕاپۆرتەکان',
    description: 'ڕاپۆرت، ئامار، daily trends و summary ی فرۆشتن.',
    icon: BarChart3,
    tone: 'from-violet-50 via-white to-fuchsia-50 border-violet-100 text-violet-900',
  },
] as const;

export const AdminOverviewPage = () => {
  const { data, loading, error } = useLiveQuery<{
    reports: ReportsSummaryDto | null;
    settings: AppSettings | null;
    logs: Awaited<ReturnType<typeof getRecentActivity>>;
    notifications: Awaited<ReturnType<typeof getAllNotifications>>;
    mediaAssets: Awaited<ReturnType<typeof getAllMediaAssets>>;
  }>(
    async () => {
      const [reports, settings, logs, notifications, mediaAssets] = await Promise.all([
        getReportsSummary(),
        getAppSettings(),
        getRecentActivity(8),
        getAllNotifications(),
        getAllMediaAssets(),
      ]);
      return { reports, settings, logs, notifications, mediaAssets };
    },
    {
      reports: null as ReportsSummaryDto | null,
      settings: null as AppSettings | null,
      logs: [],
      notifications: [],
      mediaAssets: [],
    },
    ['order-created', 'order-updated', 'notification-changed', 'menu-changed', 'catalog-changed', 'media-changed', 'settings-changed', 'reset-performed'],
  );

  if (loading) {
    return <LoadingBlock />;
  }

  if (error || !data.settings) {
    return <EmptyState title="هەڵە لە بارکردنی پوختە" description={error ?? 'داتا نەدۆزرایەوە.'} />;
  }

  const reports = data.reports;
  if (!reports) {
    return <EmptyState title="هەڵە لە بارکردنی پوختە" description="ڕاپۆرتەکان نەدۆزرایەوە." />;
  }

  const displayBusinessName =
    data.settings.businessName === 'چێشتخانەی نایاب' ? 'ڕێستورانتی مەزن فۆڕ کیتۆ' : data.settings.businessName;
  const pending = reports.totals.pending;
  const accepted = Math.max(0, reports.totals.orders - reports.totals.pending - reports.totals.completed - reports.totals.cancelled);
  const completed = reports.totals.completed;
  const revenue = reports.totals.revenue;
  const unreadNotifications = data.notifications.filter((notification) => !notification.isRead).length;
  const isBlankSystem =
    reports.totals.orders === 0 &&
    reports.totals.menuItems === 0 &&
    reports.totals.categories === 0 &&
    reports.totals.notifications === 0 &&
    data.mediaAssets.length === 0;
  const dailyCounts = reports.dailySeries.slice(0, 7);
  const heroStats = [
    {
      label: 'دوایین reset',
      labelClassName: 'text-[10px]',
      value: formatDateTime(data.settings.lastResetAt),
      hint: 'نوێترین پاککردنەوە',
    },
    {
      label: 'پارێزگا',
      value: data.settings.provinceOptions.length,
      hint: 'ناوچەی چالاک',
    },
    {
      label: 'کۆدی دواترین order',
      value: data.settings.orderSequence,
      hint: 'sequence ی ئێستا',
    },
    {
      label: 'نەخوێندراوە',
      value: unreadNotifications,
      hint: 'notification نوێ',
    },
  ] as const;

  const commandStats = [
    {
      label: 'چاوەڕێی کاپتن',
      value: pending,
      hint: 'order ی چاوەڕوانی',
      icon: ClipboardList,
      tone: 'from-amber-50 to-orange-50 border-amber-100 text-amber-900',
    },
    {
      label: 'قبوڵکراوەکان',
      value: accepted,
      hint: 'لە قۆناغی کاردایە',
      icon: PackageCheck,
      tone: 'from-sky-50 to-cyan-50 border-sky-100 text-sky-900',
    },
    {
      label: 'تەواوبووەکان',
      value: completed,
      hint: 'ئەنجام دراوە',
      icon: CheckCircle2,
      tone: 'from-emerald-50 to-teal-50 border-emerald-100 text-emerald-900',
    },
    {
      label: 'نوێترین پەیام',
      value: unreadNotifications,
      hint: 'نەخوێندراوە',
      icon: BellRing,
      tone: 'from-rose-50 to-pink-50 border-rose-100 text-rose-900',
    },
    {
      label: 'کۆی فرۆشتن',
      value: formatCurrency(revenue),
      hint: 'کۆی گشتی پارەکان',
      icon: Wallet,
      tone: 'from-stone-100 to-white border-stone-200 text-stone-900',
    },
    {
      label: 'کۆی گشتی ئۆردەرەکان',
      value: reports.totals.orders,
      hint: 'هەموو داواکارییەکان',
      icon: BarChart3,
      tone: 'from-violet-50 to-fuchsia-50 border-violet-100 text-violet-900',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="ئادمێن فەرمان دەکات"
        icon={FolderKanban}
        title={displayBusinessName}
        statsGridClassName="grid-cols-2"
        stats={heroStats}
        actions={
          <div className="grid w-full grid-cols-3 gap-3">
            <Link
              to="/admin/all-foods?tab=items"
              className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-black text-stone-900 shadow-lg transition hover:-translate-y-0.5"
            >
              <Soup className="h-4 w-4" />
              <span>خواردنەکان</span>
            </Link>
            <Link
              to="/admin/reports"
              className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Activity className="h-4 w-4" />
              <span>بینینی ڕاپۆرتەکان</span>
            </Link>
            <Link
              to="/admin/settings"
              className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Settings2 className="h-4 w-4" />
              <span>ڕێکخستن</span>
            </Link>
          </div>
        }
      />

      {isBlankSystem ? (
        <Card className="overflow-hidden border-amber-100 bg-gradient-to-r from-amber-50 via-white to-emerald-50">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-stone-900 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span>سیستەم ئامادەی پڕکردنەوەی ڕاستەقینەی داتایە</span>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-stone-600">
                ئێستا دەتوانیت سەرەتا پۆلەکان دروست بکەیت، پاشان خواردنەکان بە وێنە و نرخ زیاد بکەیت. هەموو
                flow ـەکە لە `هەموو خواردنەکان` بە شێوەی studio ئامادە کراوە.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/all-foods?tab=categories"
                className="inline-flex items-center gap-2 rounded-[1.4rem] bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                <FolderPlus className="h-4 w-4" />
                <span>زیادکردنی پۆل</span>
              </Link>
              <Link
                to="/admin/all-foods?tab=items"
                className="inline-flex items-center gap-2 rounded-[1.4rem] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:border-brand-200 hover:bg-brand-50"
              >
                <Soup className="h-4 w-4" />
                <span>زیادکردنی خواردن</span>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">system pulse</p>
            <h3 className="mt-2 text-2xl font-black text-stone-900">دۆخی ڕاستەوخۆی سیستەم</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {commandStats.map((stat) => (
            <Card
              key={stat.label}
              className={`border bg-gradient-to-br p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${stat.tone}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white/70 shadow-sm">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black">{stat.value}</p>
              </div>
              <p className="mt-4 text-base font-black">{stat.label}</p>
              <p className="mt-1 text-sm opacity-75">{stat.hint}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">quick launch</p>
            <h3 className="mt-2 text-xl font-black text-stone-900">کورتکراوە گرنگەکان</h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              title={link.label}
              aria-label={link.label}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border bg-gradient-to-br shadow-sm transition hover:-translate-y-0.5 ${link.tone}`}
            >
              <link.icon className="h-5 w-5" />
              <span className="sr-only">{link.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-sky-50/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">daily view</p>
              <h3 className="mt-2 text-2xl font-black text-stone-900">ئاماری ڕۆژانە</h3>
              <p className="mt-1 text-sm text-stone-600">ژمارەی داواکاری و کۆی فرۆشتن لە دوا ڕۆژەکان.</p>
            </div>
            <Activity className="h-5 w-5 text-brand-700" />
          </div>

          <div className="space-y-3">
            {dailyCounts.length === 0 ? (
              <EmptyState title="هێشتا data نییە" description="کاتێک order زیاد بکرێت، ئامارە ڕۆژانەکان لێرە دەردەکەون." />
            ) : (
              dailyCounts.map((entry) => (
                <div key={entry.dayKey} className="flex items-center justify-between rounded-[1.6rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                  <div>
                    <p className="font-black text-stone-900">{formatWeekdayMonthDay(entry.dayKey)}</p>
                    <p className="mt-1 text-sm text-stone-500">{entry.orderCount} داواکاری</p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black text-brand-800">{formatCurrency(entry.revenue)}</p>
                    <p className="mt-1 text-xs text-stone-500">{entry.dayKey}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-emerald-50/60">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">activity feed</p>
            <h3 className="mt-2 text-2xl font-black text-stone-900">چالاکییە دواییەکان</h3>
          </div>

          <div className="space-y-3">
            {data.logs.length === 0 ? (
              <EmptyState title="log نییە" description="کاتێک action ـێک ئەنجام بدرێت، لێرە تۆمار دەکرێت." />
            ) : (
              data.logs.map((log) => (
                <div key={log.id} className="rounded-[1.6rem] border border-white/80 bg-white/95 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="font-black text-stone-900">{log.message}</p>
                    <span className="text-xs text-stone-500">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    {log.actorName} • {log.type}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-orange-50/60">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">system facts</p>
            <h3 className="mt-2 text-2xl font-black text-stone-900">داتای سیستەم</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.8rem] border border-stone-200 bg-white/95 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-brand-50 text-brand-800">
                  <Settings2 className="h-4 w-4" />
                </div>
                <p className="font-black text-stone-900">ڕێکخستنەکان</p>
              </div>
              <div className="mt-4 space-y-2 text-sm text-stone-600">
                <p>دوایین نوێکردنەوە: {formatDateTime(data.settings.updatedAt)}</p>
                <p>hidden items: {data.settings.hiddenCategoryIds.length + data.settings.hiddenMenuItemIds.length}</p>
                <p>پارێزگا: {data.settings.provinceOptions.length}</p>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-stone-200 bg-white/95 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-emerald-50 text-emerald-800">
                  <Database className="h-4 w-4" />
                </div>
                <p className="font-black text-stone-900">کاتالۆگ و media</p>
              </div>
              <div className="mt-4 space-y-2 text-sm text-stone-600">
                <p>خواردنی چالاک: {reports.totals.availableMenuItems}</p>
                <p>خواردنی ناچالاک: {reports.totals.unavailableMenuItems}</p>
                <p>پۆلەکان: {reports.totals.categories}</p>
                <p>media assets: {data.mediaAssets.length}</p>
              </div>
            </div>

            <Link
              to="/admin/employee-activity"
              className="rounded-[1.8rem] border border-stone-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-sky-50 text-sky-800">
                  <Users className="h-4 w-4" />
                </div>
                <p className="font-black text-stone-900">چاڵاکی کارمەند</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-stone-600">بینینی بەراوردی کارمەند و هەژمارکردنی باشترینیان.</p>
            </Link>

            <Link
              to="/admin/settings/maintenance"
              className="rounded-[1.8rem] border border-stone-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-rose-50 text-rose-800">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="font-black text-stone-900">سڕینەوەی داتاکان</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-stone-600">چوونە ناو پەیجی سڕینەوەی داتاکان.</p>
            </Link>
          </div>
        </Card>

        <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">latest messages</p>
              <h3 className="mt-2 text-2xl font-black text-stone-900">نوێترین notifications</h3>
              <p className="mt-1 text-sm text-stone-600">پوختەی پەیامە نوێکان بۆ کاپتن و کارمەند.</p>
            </div>
            <Link to="/admin/notifications" className="text-sm font-semibold text-brand-700 transition hover:text-brand-900">
              بینینی هەموو
            </Link>
          </div>

          <div className="space-y-3">
            {data.notifications.length === 0 ? (
              <EmptyState title="notification نییە" />
            ) : (
              data.notifications.slice(0, 4).map((notification) => (
                <div key={notification.id} className="rounded-[1.6rem] border border-white/80 bg-white/95 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-stone-900">{notification.title}</p>
                      <p className="mt-1 text-sm leading-7 text-stone-600">{notification.message}</p>
                    </div>
                    {!notification.isRead ? (
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">نوێ</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs text-stone-500">{formatDateTime(notification.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
