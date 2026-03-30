import { Eye, EyeOff, FolderCog, Search, Soup } from 'lucide-react';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Button } from '../../components/ui/Button';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { getCategories, getMenuItems } from '../menu/menu-service';
import type { AppSettings } from '../../types/models';
import { getAppSettings, setCategoryVisibility, setMenuVisibility } from '../settings/settings-service';

type CatalogTab = 'categories' | 'items';

export const AdminCatalogSettingsPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [tab, setTab] = usePersistentState<CatalogTab>('admin-catalog-tab', 'categories');
  const [search, setSearch] = usePersistentState('admin-catalog-search', '');
  const [selectedCategory, setSelectedCategory] = usePersistentState('admin-catalog-item-category', 'all');
  const { data, loading, error, reload } = useLiveQuery<{
    settings: AppSettings | null;
    categories: Awaited<ReturnType<typeof getCategories>>;
    menuItems: Awaited<ReturnType<typeof getMenuItems>>;
  }>(
    async () => {
      const [settings, categories, menuItems] = await Promise.all([getAppSettings(), getCategories(), getMenuItems()]);
      return { settings, categories, menuItems };
    },
    {
      settings: null as AppSettings | null,
      categories: [],
      menuItems: [],
    },
    ['settings-changed', 'menu-changed', 'catalog-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;

  const sortedCategories = [...data.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const effectiveSelectedCategory =
    selectedCategory !== 'all' && !sortedCategories.some((category) => category.id === selectedCategory) ? 'all' : selectedCategory;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCategories = data.categories.filter((category) => category.name.toLowerCase().includes(normalizedSearch));
  const filteredItems = data.menuItems.filter((item) => {
    const categoryName = data.categories.find((category) => category.id === item.categoryId)?.name ?? '';
    const matchesCategory = effectiveSelectedCategory === 'all' || item.categoryId === effectiveSelectedCategory;
    return (
      matchesCategory &&
      (
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch) ||
        categoryName.toLowerCase().includes(normalizedSearch)
      )
    );
  });

  const hiddenCategoryIds = data.settings?.hiddenCategoryIds ?? [];
  const hiddenMenuItemIds = data.settings?.hiddenMenuItemIds ?? [];
  const heroStats = [
    { label: 'پۆلی شاراوە', value: hiddenCategoryIds.length },
    { label: 'خواردنی شاراوە', value: hiddenMenuItemIds.length },
    { label: 'خواردنی ناچالاک', value: data.menuItems.filter((item) => !item.isAvailable).length },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="کۆنترۆڵی خواردن"
        icon={FolderCog}
        title="دیاربوون و ڕێکخستنی خواردنەکان"
        description="لێرە دەتوانیت پۆل یان خواردن بشاریتەوە بۆ لای کارمەند بەبێ سڕینەوەی زانیاری."
        stats={heroStats}
        statsGridClassName="grid-cols-3"
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant={tab === 'categories' ? 'primary' : 'secondary'} icon={<FolderCog className="h-4 w-4" />} onClick={() => setTab('categories')}>
              پۆلەکان
            </Button>
            <Button variant={tab === 'items' ? 'primary' : 'secondary'} icon={<Soup className="h-4 w-4" />} onClick={() => setTab('items')}>
              خواردنەکان
            </Button>
          </div>

          <div className="relative lg:min-w-[24rem]">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pr-11"
              placeholder="گەڕان بە ناو، وەسف یان پۆل..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-stone-600">
            {tab === 'categories'
              ? `${filteredCategories.length} پۆل دەرکەوت`
              : `${filteredItems.length} خواردن دەرکەوت${effectiveSelectedCategory === 'all' ? '' : ' لەم پۆلەدا'}`}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
            }}
          >
            پاککردنەوەی فلتەر
          </Button>
        </div>

        {tab === 'items' ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${effectiveSelectedCategory === 'all' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              onClick={() => setSelectedCategory('all')}
            >
              هەموو پۆلەکان
            </button>
            {sortedCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${effectiveSelectedCategory === category.id ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error || !data.settings ? (
        <EmptyState title="هەڵە لە بارکردنی ڕێکخستنی خواردن" description={error ?? 'داتا نەدۆزرایەوە.'} />
      ) : tab === 'categories' ? (
        filteredCategories.length === 0 ? (
          <EmptyState
            title={data.categories.length === 0 ? 'هیچ پۆلێک نییە' : 'هیچ پۆلێک نەدۆزرایەوە'}
            description={data.categories.length === 0 ? 'پێش کۆنترۆڵی دیاربوون پۆل زیاد بکە.' : 'گەڕانەکەت بگۆڕە.'}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCategories.map((category) => {
              const itemCount = data.menuItems.filter((item) => item.categoryId === category.id).length;
              const isVisible = !hiddenCategoryIds.includes(category.id);

              return (
                <Card key={category.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-stone-900">{category.name}</p>
                      <p className="mt-1 text-sm text-stone-500">ڕیز #{category.sortOrder}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>
                      {isVisible ? 'دیار' : 'شاراوە'}
                    </span>
                  </div>

                  <div className="rounded-3xl bg-stone-50 p-4 text-sm text-stone-600">
                    <p>{itemCount} خواردن لەم پۆلەدا هەیە</p>
                  </div>

                  <Button
                    variant={isVisible ? 'secondary' : 'primary'}
                    icon={isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    onClick={() => {
                      void (async () => {
                        try {
                          await setCategoryVisibility(category.id, !isVisible, actor);
                          await reload();
                          showToast('دۆخی پۆلەکە نوێکرایەوە.', 'success');
                        } catch (caughtError) {
                          showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
                        }
                      })();
                    }}
                  >
                    {isVisible ? 'شارکردنەوە' : 'پیشاندان'}
                  </Button>
                </Card>
              );
            })}
          </div>
        )
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={data.menuItems.length === 0 ? 'هیچ خواردنێک نییە' : 'هیچ خواردنێک نەدۆزرایەوە'}
          description={data.menuItems.length === 0 ? 'پێش کۆنترۆڵی دیاربوون خواردن زیاد بکە.' : 'گەڕانەکەت بگۆڕە.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isVisible = !hiddenMenuItemIds.includes(item.id);
            const categoryName = data.categories.find((category) => category.id === item.categoryId)?.name ?? 'بێ پۆل';

            return (
              <Card key={item.id} className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-lg font-black text-stone-900">{item.name}</p>
                    <p className="mt-1 text-sm text-stone-500">{categoryName}</p>
                    <p className="mt-2 text-sm leading-7 text-stone-600">{item.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {item.isAvailable ? 'چالاک' : 'ناچالاک'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isVisible ? 'bg-sky-100 text-sky-800' : 'bg-stone-200 text-stone-700'}`}>
                      {isVisible ? 'دیار' : 'شاراوە'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={isVisible ? 'secondary' : 'primary'}
                    icon={isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    onClick={() => {
                      void (async () => {
                        try {
                          await setMenuVisibility(item.id, !isVisible, actor);
                          await reload();
                          showToast('دۆخی خواردنەکە نوێکرایەوە.', 'success');
                        } catch (caughtError) {
                          showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
                        }
                      })();
                    }}
                  >
                    {isVisible ? 'شارکردنەوە' : 'پیشاندان'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};




