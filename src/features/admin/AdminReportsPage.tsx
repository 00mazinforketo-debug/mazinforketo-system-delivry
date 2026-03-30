import { BarChart3, BellRing, CheckCircle2, ClipboardList, Soup, SquareMenu, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { formatCurrency, formatNumber, formatWeekdayMonthDay } from '../../lib/format';
import type { ReportsSummaryDto } from '../../types/models';
import { getCategories, getMenuItems } from '../menu/menu-service';
import { getAllNotifications } from '../notifications/notification-service';
import { getReportsSummary } from './reports-service';

export const AdminReportsPage = () => {
  const { data, loading, error } = useLiveQuery<{
    reports: ReportsSummaryDto | null;
    menuItems: Awaited<ReturnType<typeof getMenuItems>>;
    categories: Awaited<ReturnType<typeof getCategories>>;
    notifications: Awaited<ReturnType<typeof getAllNotifications>>;
  }>(
    async () => {
      const [reports, menuItems, categories, notifications] = await Promise.all([
        getReportsSummary(),
        getMenuItems(),
        getCategories(),
        getAllNotifications(),
      ]);
      return { reports, menuItems, categories, notifications };
    },
    {
      reports: null as ReportsSummaryDto | null,
      menuItems: [],
      categories: [],
      notifications: [],
    },
    ['order-created', 'order-updated', 'menu-changed', 'catalog-changed', 'notification-changed', 'reset-performed'],
  );

  if (loading) {
    return <LoadingBlock />;
  }

  if (error) {
    return <EmptyState title="هەڵە لە بارکردنی ڕاپۆرتەکان" description={error} />;
  }

  if (!data.reports) {
    return <EmptyState title="هەڵە لە بارکردنی ڕاپۆرتەکان" description="ڕاپۆرتەکان نەدۆزرایەوە." />;
  }

  const reports = data.reports;
  const revenue = reports.totals.revenue;
  const pending = reports.totals.pending;
  const completed = reports.totals.completed;
  const cancelled = reports.totals.cancelled;
  const unreadNotifications = data.notifications.filter((notification) => !notification.isRead).length;
  const topCategories = data.categories
    .map((category) => ({
      ...category,
      itemCount: data.menuItems.filter((item) => item.categoryId === category.id).length,
    }))
    .sort((left, right) => right.itemCount - left.itemCount || left.sortOrder - right.sortOrder)
    .slice(0, 6);
  const dailyCounts = reports.dailySeries.slice(0, 10);
  const heroStats = [
    { label: 'کۆی فرۆشتن', value: formatCurrency(revenue), hint: 'کۆی گشتی پارەکان' },
    { label: 'چاوەڕێی کاپتن', value: pending, hint: 'داواکارییە چاوەڕوانەکان' },
    { label: 'تەواوبووەکان', value: completed, hint: 'ئەنجام دراوە' },
    { label: 'نەخوێندراوە', value: unreadNotifications, hint: 'ئاگەدارکردنەوەی نوێ' },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="ڕاپۆرتەکان"
        icon={BarChart3}
        title="ڕاپۆرت و داتای کۆکراوە"
        description="لێرە ئاماری داواکاریەکان، کاتەکان، فرۆشتن و دۆخی خواردنەکان دەبینرێت."
        stats={heroStats}
        statsGridClassName="grid-cols-2"
        actions={
          <>
            <Link to="/admin/orders" className="inline-flex items-center gap-2 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
              <ClipboardList className="h-4 w-4" />
              <span>بینینی داواکاریەکان</span>
            </Link>
            <Link to="/admin/menu" className="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
              <Soup className="h-4 w-4" />
              <span>بینینی خواردنەکان</span>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-brand-50">
          <div className="flex items-center justify-between">
            <ClipboardList className="h-5 w-5 text-brand-700" />
            <span className="text-3xl font-black text-brand-900">{reports.totals.orders}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-brand-800">کۆی داواکاریەکان</p>
        </Card>
        <Card className="bg-amber-50">
          <div className="flex items-center justify-between">
            <BarChart3 className="h-5 w-5 text-amber-700" />
            <span className="text-3xl font-black text-amber-900">{pending}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-amber-800">چاوەڕێی کاپتن</p>
        </Card>
        <Card className="bg-emerald-50">
          <div className="flex items-center justify-between">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <span className="text-3xl font-black text-emerald-900">{completed}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-emerald-800">تەواوبووەکان</p>
        </Card>
        <Card className="bg-rose-50">
          <div className="flex items-center justify-between">
            <Wallet className="h-5 w-5 text-rose-700" />
            <span className="text-3xl font-black text-rose-900">{cancelled}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-rose-800">هەڵوەشاوەکان</p>
        </Card>
        <Card className="bg-stone-50">
          <div className="flex items-center justify-between">
            <Soup className="h-5 w-5 text-stone-700" />
            <span className="text-3xl font-black text-stone-900">{data.menuItems.length}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-stone-700">کۆی خواردن</p>
        </Card>
        <Card className="bg-sky-50">
          <div className="flex items-center justify-between">
            <BellRing className="h-5 w-5 text-sky-700" />
            <span className="text-3xl font-black text-sky-900">{data.notifications.length}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-sky-800">کۆی ئاگەدارکردنەوەکان</p>
        </Card>
      </div>

      <Card className="border-stone-200 bg-gradient-to-r from-brand-50 via-white to-amber-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-stone-800 shadow-sm">
              <Users className="h-4 w-4 text-brand-700" />
              <span>چاڵاکیی کارمەندان</span>
            </div>
            <p className="text-sm leading-7 text-stone-600">
              {reports.employeeActivity.topPerformer
                ? `${reports.employeeActivity.topPerformer.displayName} لە ئێستادا زۆرترین داواکاریی هەیە.`
                : 'هێشتا هیچ داواکارییەکی کارمەند تۆمار نەکراوە.'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
              <p>کۆی داواکاری</p>
              <p className="mt-2 text-lg font-black text-stone-900">{formatNumber(reports.employeeActivity.totalEmployeeOrders)}</p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
              <p>کاتژمێر</p>
              <p className="mt-2 text-lg font-black text-stone-900">{formatNumber(Math.round(reports.employeeActivity.totalEstimatedWorkMinutes / 60))}</p>
            </div>
            <Link to="/admin/employee-activity" className="inline-flex items-center justify-center rounded-3xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
              بینینی وردەکاری
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4">
          <div>
            <h3 className="text-xl font-black text-stone-900">ڕاپۆرتی ڕۆژانەی داواکاریەکان</h3>
            <p className="mt-1 text-sm text-stone-600">ژمارە و کۆی گشتیی داواکاریەکان لە دوا ڕۆژەکاندا.</p>
          </div>

          <div className="space-y-3">
            {dailyCounts.length === 0 ? (
              <EmptyState title="هێشتا زانیاری نییە" description="کاتێک داواکاری زیاد بکرێت، ڕاپۆرتی ڕۆژانە لێرە دەردەکەوێت." />
            ) : (
              dailyCounts.map((entry) => (
                <div key={entry.dayKey} className="flex items-center justify-between rounded-3xl bg-stone-50 p-4">
                  <div>
                    <p className="font-black text-stone-900">{formatWeekdayMonthDay(entry.dayKey)}</p>
                    <p className="mt-1 text-sm text-stone-500">{entry.orderCount} داواکاری</p>
                  </div>
                  <p className="text-lg font-black text-brand-800">{formatCurrency(entry.revenue)}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-xl font-black text-stone-900">باشترین پۆلەکان</h3>
            <p className="mt-1 text-sm text-stone-600">ڕیزبەندی پۆلەکان بە پێی ژمارەی خواردنەکانیان.</p>
          </div>

          <div className="space-y-3">
            {topCategories.length === 0 ? (
              <EmptyState title="پۆل نییە" description="پاش زیادکردنی پۆل و خواردنەکان لێرە داتایان دەردەکەوێت." />
            ) : (
              topCategories.map((category, index) => (
                <div key={category.id} className="flex items-center justify-between rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-950 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-black text-stone-900">{category.name}</p>
                      <p className="mt-1 text-sm text-stone-500">ڕیز #{category.sortOrder}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black text-brand-800">{category.itemCount}</p>
                    <p className="mt-1 text-xs text-stone-500">خواردن</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/employee-activity" className="rounded-3xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100">
              <p>چاڵاکی کارمەند</p>
              <p className="mt-2 text-xs font-normal text-amber-700">بەراوردی داواکاری و کاتژمێری بەهرە و ڕاژان</p>
            </Link>
            <Link to="/admin/media" className="rounded-3xl bg-brand-50 p-4 text-sm font-semibold text-brand-900 transition hover:bg-brand-100">
              <p>وێنە هەڵگیراوەکان</p>
              <p className="mt-2 text-xs font-normal text-brand-700">بینینی وێنە هەڵگیراوەکان</p>
            </Link>
            <Link to="/admin/activity" className="rounded-3xl bg-stone-100 p-4 text-sm font-semibold text-stone-900 transition hover:bg-stone-200">
              <p>چالاکی</p>
              <p className="mt-2 text-xs font-normal text-stone-600">بینینی تۆماری چالاکییەکان</p>
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-stone-900">دۆخی خواردنەکان</h3>
              <p className="mt-1 text-sm text-stone-600">پوختەی خواردن و پۆلەکان.</p>
            </div>
            <SquareMenu className="h-5 w-5 text-stone-700" />
          </div>
          <div className="rounded-3xl bg-stone-50 p-4 text-sm leading-7 text-stone-600">
            <p>پۆلەکان: {data.categories.length}</p>
            <p>خواردنی چالاک: {reports.totals.availableMenuItems}</p>
            <p>خواردنی ناچالاک: {reports.totals.unavailableMenuItems}</p>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-stone-900">دۆخی ئاگەدارکردنەوەکان</h3>
              <p className="mt-1 text-sm text-stone-600">ئاگەدارکردنەوەکانی سیستەم و داواکاریەکان.</p>
            </div>
            <BellRing className="h-5 w-5 text-stone-700" />
          </div>
          <div className="rounded-3xl bg-stone-50 p-4 text-sm leading-7 text-stone-600">
            <p>کۆی ئاگەدارکردنەوەکان: {data.notifications.length}</p>
            <p>نەخوێندراوە: {unreadNotifications}</p>
            <p>داواکارییە تەواوبووەکان: {completed}</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
