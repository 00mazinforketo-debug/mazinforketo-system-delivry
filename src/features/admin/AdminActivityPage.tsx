import { Activity, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { formatDateTime } from '../../lib/format';
import { getRecentActivity } from '../settings/settings-service';

export const AdminActivityPage = () => {
  const [search, setSearch] = usePersistentState('admin-activity-search', '');
  const { data, loading, error } = useLiveQuery(
    async () => getRecentActivity(120),
    [],
    ['order-created', 'order-updated', 'menu-changed', 'catalog-changed', 'media-changed', 'notification-changed', 'settings-changed', 'reset-performed'],
  );

  if (loading) {
    return <LoadingBlock />;
  }

  if (error) {
    return <EmptyState title="هەڵە لە بارکردنی چالاکی" description={error} />;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredLogs = data.filter((log) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      log.message.toLowerCase().includes(normalizedSearch) ||
      log.actorName.toLowerCase().includes(normalizedSearch) ||
      log.type.toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="Audit"
        icon={Activity}
        title="تۆماری چالاکی و گۆڕانکاری"
        description="هەموو action ـە operational ـە سەرەکییەکان لێرە تۆمار دەبن بۆ پشکنینەوە و شوێنکەوتن."
        stats={[
          { label: 'کۆی تۆمارەکان', value: data.length },
          { label: 'ئەنجامی search', value: filteredLogs.length },
        ]}
        actions={
          <Link to="/admin/employee-activity" className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
            <Users className="h-4 w-4" />
            <span>چاڵاکی کارمەند</span>
          </Link>
        }
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-black text-stone-900">گەڕان بە تۆمارەکان</h3>
            <p className="mt-1 text-sm text-stone-600">بە ناوی actor، type یان message بگەڕێ.</p>
          </div>
          <div className="relative lg:min-w-[24rem]">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pr-11"
              placeholder="گەڕان بە actor یان action..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </Card>

      {filteredLogs.length === 0 ? (
        <EmptyState
          title={data.length === 0 ? 'هێشتا log نییە' : 'هیچ ئەنجامێک نەدۆزرایەوە'}
          description={
            data.length === 0
              ? 'کاتێک action ـێک لەلایەن admin، captain یان employee ئەنجام بدرێت، لێرە دەردەکەوێت.'
              : 'search ـەکەت بگۆڕە بۆ بینینی تۆمارەکان.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    <Activity className="h-3.5 w-3.5" />
                    <span>{log.type}</span>
                  </div>
                  <p className="text-lg font-black text-stone-900">{log.message}</p>
                </div>
                <span className="text-sm text-stone-500">{formatDateTime(log.createdAt)}</span>
              </div>
              <div className="rounded-3xl bg-stone-50 p-4 text-sm text-stone-600">
                <p>
                  actor: {log.actorName} ({log.actorRole})
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
