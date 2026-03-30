import { ArrowRight, Power, PowerOff, Search, Tags, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { AppSettings, Category, MenuItem } from '../../types/models';
import { getCategories, getMenuItems } from '../menu/menu-service';
import { getAppSettings } from '../settings/settings-service';
import { EmployeeShell } from './EmployeeShell';
import { getEmployeeHiddenEntityIds, setEmployeeEntityVisibility } from './employee-visibility';

type VisibilityTab = 'categories' | 'menuItems';

export const EmployeeMenuManagementPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const navigate = useNavigate();
  const [visibilityTab, setVisibilityTab] = usePersistentState<VisibilityTab>('employee-settings-menu-tab', 'categories');
  const [search, setSearch] = useState('');

  const { data, loading, error, reload } = useLiveQuery<{
    categories: Category[];
    menuItems: MenuItem[];
    settings: AppSettings | null;
    localHiddenCategoryIds: string[];
    localHiddenMenuItemIds: string[];
  }>(
    async () => {
      const [categories, menuItems, settings] = await Promise.all([getCategories(), getMenuItems(), getAppSettings()]);
      return {
        categories,
        menuItems,
        settings,
        localHiddenCategoryIds: session ? getEmployeeHiddenEntityIds('categories', session) : [],
        localHiddenMenuItemIds: session ? getEmployeeHiddenEntityIds('menuItems', session) : [],
      };
    },
    {
      categories: [],
      menuItems: [],
      settings: null as AppSettings | null,
      localHiddenCategoryIds: [],
      localHiddenMenuItemIds: [],
    },
    ['menu-changed', 'catalog-changed', 'media-changed', 'settings-changed', 'view-state-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const adminHiddenCategoryIds = data.settings?.hiddenCategoryIds ?? [];
  const adminHiddenMenuItemIds = data.settings?.hiddenMenuItemIds ?? [];
  const hiddenCategoryIds = Array.from(new Set([...adminHiddenCategoryIds, ...data.localHiddenCategoryIds]));
  const hiddenMenuItemIds = Array.from(new Set([...adminHiddenMenuItemIds, ...data.localHiddenMenuItemIds]));
  const categoryCounts = new Map(
    data.categories.map((category) => [
      category.id,
      data.menuItems.filter((item) => item.categoryId === category.id).length,
    ]),
  );
  const menuQuery = search.trim().toLowerCase();
  const visibleMenuItems = data.menuItems.filter((item) => !menuQuery || item.name.toLowerCase().includes(menuQuery));

  return (
    <EmployeeShell>
      <section className="space-y-6">
        <Card className="space-y-5 border-stone-200 bg-white/95">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Badge className="border-brand-200 bg-brand-50 text-brand-800">
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>بەڕێوبردنی مینو</span>
              </Badge>
              <div>
                <h1 className="text-3xl font-black text-stone-900">بەڕێوبردنی دەرکەوتنی مینو</h1>
              </div>
            </div>
            <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/employee/settings')}>
              گەڕانەوە
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${visibilityTab === 'categories' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700'}`}
                onClick={() => setVisibilityTab('categories')}
              >
                <Tags className="h-4 w-4" />
                <span>فلتەرەکان یان پۆلەکان</span>
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${visibilityTab === 'menuItems' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700'}`}
                onClick={() => setVisibilityTab('menuItems')}
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span>خواردنەکان</span>
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                className="pr-11"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="گەڕان بە ناوی خواردن..."
                disabled={visibilityTab !== 'menuItems'}
              />
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState title="هەڵە لە بارکردنی ڕێکخستن" description={error} />
        ) : visibilityTab === 'categories' ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {data.categories.map((category) => {
              const isAdminHidden = adminHiddenCategoryIds.includes(category.id);
              const isLocallyHidden = data.localHiddenCategoryIds.includes(category.id);
              const isVisible = !hiddenCategoryIds.includes(category.id);
              return (
                <Card key={category.id} className="flex items-center justify-between gap-3 border-stone-200 bg-white/95">
                  <div>
                    <p className="font-black text-stone-900">{category.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{categoryCounts.get(category.id) ?? 0} خواردن</p>
                    {isAdminHidden ? (
                      <p className="mt-1 text-xs font-semibold text-amber-700">ئەم پۆلە لەلایەن ئادمینەوە globally شاراوە کراوە.</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={isAdminHidden}
                    className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${isVisible ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'} disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400`}
                    onClick={async () => {
                      setEmployeeEntityVisibility('categories', session, category.id, !isLocallyHidden);
                      await reload();
                      showToast(`${category.name} ${isLocallyHidden ? 'دووبارە پیشان دەدرێت' : 'لە بینینی تۆدا شاراوە کرا'}.`, 'success');
                    }}
                  >
                    {isLocallyHidden ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    <span>{isLocallyHidden ? 'OFF' : 'ON'}</span>
                  </button>
                </Card>
              );
            })}
          </div>
        ) : visibleMenuItems.length === 0 ? (
          <EmptyState title="خواردن نەدۆزرایەوە" description="ناوی خواردنەکە بگۆڕە یان خانەی گەڕان بەتاڵ بکەرەوە." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {visibleMenuItems.map((item) => {
              const isAdminHidden = adminHiddenMenuItemIds.includes(item.id);
              const isLocallyHidden = data.localHiddenMenuItemIds.includes(item.id);
              const isVisible = item.isAvailable && !hiddenMenuItemIds.includes(item.id);
              const categoryName = data.categories.find((category) => category.id === item.categoryId)?.name ?? 'بێ پۆل';
              return (
                <Card key={item.id} className="flex items-center justify-between gap-3 border-stone-200 bg-white/95">
                  <div>
                    <p className="font-black text-stone-900">{item.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{categoryName}</p>
                    {!item.isAvailable ? (
                      <p className="mt-1 text-xs font-semibold text-amber-700">ئەو خواردنە لەلایەن بەڕێوەبەرەوە ناچالاک کراوە.</p>
                    ) : isAdminHidden ? (
                      <p className="mt-1 text-xs font-semibold text-amber-700">ئەم خواردنە لەلایەن ئادمینەوە globally شاراوە کراوە.</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={!item.isAvailable || isAdminHidden}
                    className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${isVisible ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'} disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400`}
                    onClick={async () => {
                      setEmployeeEntityVisibility('menuItems', session, item.id, !isLocallyHidden);
                      await reload();
                      showToast(`${item.name} ${isLocallyHidden ? 'دووبارە پیشان دەدرێت' : 'لە بینینی تۆدا شاراوە کرا'}.`, 'success');
                    }}
                  >
                    {isLocallyHidden ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    <span>{isLocallyHidden ? 'OFF' : 'ON'}</span>
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </EmployeeShell>
  );
};
