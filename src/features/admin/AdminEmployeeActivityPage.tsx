import { Activity, BadgeCheck, Clock3, Medal, Send, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import {
  formatCurrency,
  formatDateOnly,
  formatDateTime,
  formatDurationFromMinutes,
  formatNumber,
  formatTimeOnly,
} from '../../lib/format';
import { getEmployeeActivityReport } from './employee-activity-service';

export const AdminEmployeeActivityPage = () => {
  const { data, loading, error } = useLiveQuery<Awaited<ReturnType<typeof getEmployeeActivityReport>>>(
    async () => getEmployeeActivityReport(),
    {
      employees: [],
      rankedEmployees: [],
      totalEmployeeOrders: 0,
      totalEstimatedWorkMinutes: 0,
      activeEmployeeCount: 0,
      topPerformer: null,
    },
    ['order-created', 'order-updated', 'reset-performed'],
  );

  if (loading) {
    return <LoadingBlock />;
  }

  if (error) {
    return <EmptyState title="هەڵە لە بارکردنی چاڵاکی کارمەند" description={error} />;
  }

  const maxOrders = Math.max(...data.rankedEmployees.map((employee) => employee.totalOrders), 1);
  const heroStats = [
    { label: 'کۆی order ی کارمەندان', value: formatNumber(data.totalEmployeeOrders) },
    { label: 'کارمەندی چالاک', value: formatNumber(data.activeEmployeeCount) },
    { label: 'کۆی کارکردن', value: formatDurationFromMinutes(data.totalEstimatedWorkMinutes) },
    { label: 'باشترین ئەدا', value: data.topPerformer ? formatNumber(data.topPerformer.totalOrders) : '0' },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="کارمەندی چاڵاک"
        icon={Users}
        title="چاڵاکی و بەرهەمی کارمەندان"
        description="ئەم ڕاپۆرتە تەنها لەسەر بنەمای کاتی ناردنی order هەژمار دەکرێت. لە هەر ڕۆژێکی 24 کاتژمێردا یەکەم ناردن و دوایین ناردن وەک دەستپێک و کۆتاییی shift هەژمار دەکرێن."
        stats={heroStats}
        statsGridClassName="grid-cols-2"
        actions={
          <>
            <Link to="/admin/orders" className="inline-flex items-center gap-2 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
              <Send className="h-4 w-4" />
              <span>بینینی orders</span>
            </Link>
            <Link to="/admin/reports" className="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
              <Activity className="h-4 w-4" />
              <span>گەڕانەوە بۆ reports</span>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-brand-50">
          <div className="flex items-center justify-between">
            <Send className="h-5 w-5 text-brand-700" />
            <span className="text-3xl font-black text-brand-900">{formatNumber(data.totalEmployeeOrders)}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-brand-800">کۆی order ی کارمەندان</p>
        </Card>
        <Card className="bg-emerald-50">
          <div className="flex items-center justify-between">
            <Users className="h-5 w-5 text-emerald-700" />
            <span className="text-3xl font-black text-emerald-900">{formatNumber(data.activeEmployeeCount)}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-emerald-800">کارمەندی چالاک</p>
        </Card>
        <Card className="bg-amber-50">
          <div className="flex items-center justify-between">
            <Clock3 className="h-5 w-5 text-amber-700" />
            <span className="text-xl font-black text-amber-900">{formatDurationFromMinutes(data.totalEstimatedWorkMinutes)}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-amber-800">کۆی کارکردن</p>
        </Card>
        <Card className="bg-stone-50">
          <div className="flex items-center justify-between">
            <Medal className="h-5 w-5 text-stone-700" />
            <span className="text-2xl font-black text-stone-900">{data.topPerformer ? formatNumber(data.topPerformer.totalOrders) : '0'}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-stone-700">باشترین ئەدا</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {data.rankedEmployees.map((employee, index) => {
          const orderShare = Math.round((employee.totalOrders / maxOrders) * 100);

          return (
            <Card key={employee.displayName} className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-black text-stone-800">
                    <Medal className="h-4 w-4 text-amber-600" />
                    <span>#{formatNumber(index + 1)}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-stone-900">{employee.displayName}</h3>
                    <p className="mt-1 text-sm text-stone-500">چاڵاکیی هەژمارکراو بە پێی ناردنی order</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  <p>بنەمای هەژمارکردن: ماوەی نێوان ناردنی داواکاریەکان</p>
                  <p className="mt-1 font-semibold text-stone-900">{employee.totalOrders > 0 ? 'چالاکە' : 'هێشتا بێ data'}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl bg-brand-50 p-4">
                  <p className="text-xs font-semibold text-brand-700">کۆی orders</p>
                  <p className="mt-3 text-2xl font-black text-brand-900">{formatNumber(employee.totalOrders)}</p>
                </div>
                <div className="rounded-3xl bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-700">کاتژمێری هەژمارکراو</p>
                  <p className="mt-3 text-lg font-black text-amber-900">{formatDurationFromMinutes(employee.estimatedWorkMinutes)}</p>
                </div>
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-xs font-semibold text-emerald-700">ڕۆژی چالاک</p>
                  <p className="mt-3 text-2xl font-black text-emerald-900">{formatNumber(employee.activeDays)}</p>
                </div>
                <div className="rounded-3xl bg-stone-50 p-4">
                  <p className="text-xs font-semibold text-stone-500">فرۆشتنی هەژمارکراو</p>
                  <p className="mt-3 text-lg font-black text-stone-900">{formatCurrency(employee.totalSales)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-stone-600">بەراوردی چالاکی</span>
                  <span className="font-black text-stone-900">{formatNumber(orderShare)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-700 via-brand-600 to-amber-500" style={{ width: `${orderShare}%` }} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                  <p className="font-black text-stone-900">یەکەم و دوایین order</p>
                  <p className="mt-2">سەرەتای ناردن: {formatDateTime(employee.firstOrderAt)}</p>
                  <p>کۆتایی ناردن: {formatDateTime(employee.lastOrderAt)}</p>
                  <p>ناوەندی orders لە هەر ڕۆژ: {formatNumber(employee.averageOrdersPerDay.toFixed(employee.averageOrdersPerDay % 1 === 0 ? 0 : 1))}</p>
                </div>
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                  <p className="font-black text-stone-900">دۆخی orders</p>
                  <p>تەواوبووەکان: {formatNumber(employee.completedOrders)}</p>
                  <p>قبوڵکراوەکان: {formatNumber(employee.acceptedOrders)}</p>
                  <p>چاوەڕێی کاپتن: {formatNumber(employee.pendingOrders)}</p>
                  <p>هەڵوەشاوەکان: {formatNumber(employee.cancelledOrders)}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-stone-200 bg-white p-4 text-sm leading-7 text-stone-600">
                <p className="font-black text-stone-900">باشترین ڕۆژ</p>
                {employee.busiestDay ? (
                  <>
                    <p className="mt-2">{formatDateOnly(employee.busiestDay.dayKey)}</p>
                    <p>orders: {formatNumber(employee.busiestDay.orderCount)}</p>
                    <p>span: {formatDurationFromMinutes(employee.busiestDay.estimatedWorkMinutes)}</p>
                  </>
                ) : (
                  <p className="mt-2">هێشتا order ێک نییە بۆ ئەم کارمەندە.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {data.employees.map((employee) => (
          <Card key={`${employee.displayName}-days`} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-stone-900">ڕۆژەکانی {employee.displayName}</h3>
                <p className="mt-1 text-sm text-stone-600">لە هەر ڕۆژێکدا یەکەم و دوایین ئۆردەر نێوانیان پیشان دەدرێت.</p>
              </div>
              <BadgeCheck className="h-5 w-5 text-brand-700" />
            </div>

            {employee.days.length === 0 ? (
              <EmptyState title="هێشتا order نییە" description="کاتێک ئەم کارمەندە order بنێرێت، ڕاپۆرتی ڕۆژانەی لێرە دەردەکەوێت." />
            ) : (
              <div className="space-y-3">
                {employee.days.map((day) => (
                  <div key={`${employee.displayName}-${day.dayKey}`} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black text-stone-900">{formatDateOnly(day.dayKey)}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          یەکەم order: {formatTimeOnly(day.firstOrderAt)} • دوایین order: {formatTimeOnly(day.lastOrderAt)}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-black text-brand-800">{formatDurationFromMinutes(day.estimatedWorkMinutes)}</p>
                        <p className="mt-1 text-xs text-stone-500">{formatNumber(day.orderCount)} order</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-stone-600">
                        <p>سەرەتای ناردن: {formatDateTime(day.firstOrderAt)}</p>
                        <p>کۆتایی ناردن: {formatDateTime(day.lastOrderAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-stone-600">
                        <p>کۆی order: {formatNumber(day.orderCount)}</p>
                        <p>کۆی فرۆشتن: {formatCurrency(day.totalSales)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
