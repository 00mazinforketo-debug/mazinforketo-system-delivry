import { Boxes, CheckCircle2, FolderPlus, Pencil, Plus, Power, Search, Soup, Sparkles, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { FoodImage } from '../../components/shared/FoodImage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { formatCurrency } from '../../lib/format';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { Category, MenuItem } from '../../types/models';
import { CategoryFormModal } from '../menu/CategoryFormModal';
import { MenuFormModal } from '../menu/MenuFormModal';
import {
  deleteCategory,
  deleteMenuItem,
  getCategories,
  getMenuItems,
  saveCategory,
  saveMenuItem,
  setMenuAvailability,
} from '../menu/menu-service';

type CatalogTab = 'categories' | 'items';
type MenuAvailabilityFilter = 'all' | 'available' | 'unavailable';
type CategoryItemsFilter = 'all' | 'with-items' | 'empty';

const getCatalogTab = (value: string | null): CatalogTab => (value === 'categories' ? 'categories' : 'items');

const itemFilterClass = (active: boolean) =>
  active
    ? 'bg-stone-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]'
    : 'bg-white/85 text-stone-700 hover:bg-white';

export const AdminAllFoodsPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getCatalogTab(searchParams.get('tab'));
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isMenuModalOpen, setMenuModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [menuSearch, setMenuSearch] = usePersistentState('admin-all-foods-menu-search', '');
  const [selectedCategory, setSelectedCategory] = usePersistentState('admin-all-foods-selected-category', 'all');
  const [availabilityFilter, setAvailabilityFilter] = usePersistentState<MenuAvailabilityFilter>(
    'admin-all-foods-availability',
    'all',
  );
  const [categorySearch, setCategorySearch] = usePersistentState('admin-all-foods-category-search', '');
  const [categoryItemsFilter, setCategoryItemsFilter] = usePersistentState<CategoryItemsFilter>(
    'admin-all-foods-category-items-filter',
    'all',
  );

  const { data, loading, error, reload } = useLiveQuery(
    async () => {
      const [categories, menuItems] = await Promise.all([getCategories(), getMenuItems()]);
      return { categories, menuItems };
    },
    {
      categories: [],
      menuItems: [],
    },
    ['menu-changed', 'catalog-changed', 'media-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const sortedCategories = [...data.categories].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
  const categoryMap = new Map(sortedCategories.map((category) => [category.id, category.name]));
  const itemCountByCategoryId = new Map(
    sortedCategories.map((category) => [category.id, data.menuItems.filter((item) => item.categoryId === category.id).length]),
  );
  const effectiveSelectedCategory =
    selectedCategory !== 'all' && !sortedCategories.some((category) => category.id === selectedCategory) ? 'all' : selectedCategory;

  const normalizedMenuSearch = menuSearch.trim().toLowerCase();
  const filteredItems = data.menuItems.filter((item) => {
    const matchesCategory = effectiveSelectedCategory === 'all' || item.categoryId === effectiveSelectedCategory;
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' ? item.isAvailable : !item.isAvailable);
    const matchesSearch =
      !normalizedMenuSearch ||
      item.name.toLowerCase().includes(normalizedMenuSearch) ||
      item.description.toLowerCase().includes(normalizedMenuSearch) ||
      (categoryMap.get(item.categoryId) ?? '').toLowerCase().includes(normalizedMenuSearch);
    return matchesCategory && matchesAvailability && matchesSearch;
  });

  const normalizedCategorySearch = categorySearch.trim().toLowerCase();
  const filteredCategories = sortedCategories.filter((category) => {
    const itemCount = itemCountByCategoryId.get(category.id) ?? 0;
    const matchesSearch = !normalizedCategorySearch || category.name.toLowerCase().includes(normalizedCategorySearch);
    const matchesItemsFilter =
      categoryItemsFilter === 'all' ||
      (categoryItemsFilter === 'with-items' ? itemCount > 0 : itemCount === 0);
    return matchesSearch && matchesItemsFilter;
  });

  const availableCount = data.menuItems.filter((item) => item.isAvailable).length;
  const emptyCategoriesCount = sortedCategories.filter((category) => (itemCountByCategoryId.get(category.id) ?? 0) === 0).length;

  const setActiveTab = (tab: CatalogTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const safeReload = async () => {
    await reload();
  };

  const openNewMenuItemModal = () => {
    setEditingItem(null);
    setMenuModalOpen(true);
    setActiveTab('items');
  };

  const openNewCategoryModal = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
    setActiveTab('categories');
  };

  const studioStats = [
    {
      label: 'کۆی خواردنەکان',
      value: data.menuItems.length,
      hint: 'خواردنە تۆمارکراوەکان',
      icon: Soup,
      tone: 'from-amber-50 to-orange-50 border-amber-100 text-amber-900',
    },
    {
      label: 'پۆلەکان',
      value: sortedCategories.length,
      hint: 'پۆلە ڕێکخراوەکان',
      icon: Boxes,
      tone: 'from-violet-50 to-fuchsia-50 border-violet-100 text-violet-900',
    },
    {
      label: 'خواردنی چالاک',
      value: availableCount,
      hint: 'لە ئێستادا دیارن',
      icon: CheckCircle2,
      tone: 'from-emerald-50 to-teal-50 border-emerald-100 text-emerald-900',
    },
    {
      label: 'پۆلی بەتاڵ',
      value: emptyCategoriesCount,
      hint: 'خواردنی تێدا نییە',
      icon: Tags,
      tone: 'from-stone-100 to-white border-stone-200 text-stone-900',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="ناوەندی خواردنەکان"
        icon={Sparkles}
        title="هەموو خواردنەکان"
        statsGridClassName="grid-cols-2"
        stats={studioStats}
      >
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`rounded-[1.5rem] border p-4 text-right transition ${activeTab === 'items' ? 'border-white/10 bg-white text-stone-900 shadow-xl' : 'border-white/10 bg-white/10 text-white hover:bg-white/15'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] ${activeTab === 'items' ? 'bg-amber-100 text-amber-800' : 'bg-white/10 text-white'}`}>
                <Soup className="h-4.5 w-4.5" />
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeTab === 'items' ? 'bg-stone-100 text-stone-700' : 'bg-white/10 text-white/80'}`}>
                {filteredItems.length} دەرکەوتن
              </span>
            </div>
            <p className={`mt-3 text-base font-black ${activeTab === 'items' ? 'text-stone-900' : 'text-white'}`}>خواردنەکان</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`rounded-[1.5rem] border p-4 text-right transition ${activeTab === 'categories' ? 'border-white/10 bg-white text-stone-900 shadow-xl' : 'border-white/10 bg-white/10 text-white hover:bg-white/15'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] ${activeTab === 'categories' ? 'bg-violet-100 text-violet-800' : 'bg-white/10 text-white'}`}>
                <FolderPlus className="h-4.5 w-4.5" />
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeTab === 'categories' ? 'bg-stone-100 text-stone-700' : 'bg-white/10 text-white/80'}`}>
                {filteredCategories.length} دەرکەوتن
              </span>
            </div>
            <p className={`mt-3 text-base font-black ${activeTab === 'categories' ? 'text-stone-900' : 'text-white'}`}>پۆلەکان</p>
          </button>
        </div>

      </AdminHeroCard>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی کاتالۆگ" description={error} />
      ) : activeTab === 'items' ? (
        <>
          <Card className="space-y-5 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-amber-50/60">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">بەڕێوەبردنی خواردن</p>
                <h3 className="mt-2 text-2xl font-black text-stone-900">بەڕێوەبردنی خواردنەکان</h3>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">بە ناو، وەسف و پۆل بگەڕێ. دۆخی چالاک/ناچالاک بگۆڕە، وەسف بنووسە،</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button icon={<Plus className="h-4 w-4" />} onClick={openNewMenuItemModal}>
                    زیادکردنی خواردن
                  </Button>
                  <p className="text-xs leading-6 text-stone-500">
                    وێنەی نوێ بۆ Cloud Firestore دەچێت، ناو و نرخ و پۆل و دۆخی خواردنیش لە سیستەمی backend پاشەکەوت دەکرێت.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    className="pr-11"
                    placeholder="گەڕان بە ناو، وەسف یان پۆل..."
                    value={menuSearch}
                    onChange={(event) => setMenuSearch(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(availabilityFilter === 'all')}`} onClick={() => setAvailabilityFilter('all')}>
                    هەموو دۆخەکان
                  </button>
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(availabilityFilter === 'available')}`} onClick={() => setAvailabilityFilter('available')}>
                    تەنها چالاک
                  </button>
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(availabilityFilter === 'unavailable')}`} onClick={() => setAvailabilityFilter('unavailable')}>
                    تەنها ناچالاک
                  </button>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-stone-200 bg-white/90 p-4 shadow-sm">
                <p className="text-sm font-black text-stone-900">پۆل و پاککردنەوە</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(effectiveSelectedCategory === 'all')}`} onClick={() => setSelectedCategory('all')}>
                    هەموو پۆلەکان
                  </button>
                  {sortedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(effectiveSelectedCategory === category.id)}`}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => {
                    setMenuSearch('');
                    setSelectedCategory('all');
                    setAvailabilityFilter('all');
                  }}
                >
                  پاککردنەوەی فلتەر
                </Button>
              </div>
            </div>
          </Card>

          {sortedCategories.length === 0 ? (
            <EmptyState
              title="پێش زیادکردنی خواردن پێویستە پۆلێک هەبێت"
              description="سەرەتا پۆل دروست بکە، پاشان خواردنەکان لەناو ئەو پۆلانەدا زیاد بکە."
              action={
                <Button icon={<FolderPlus className="h-4 w-4" />} onClick={openNewCategoryModal}>
                  زیادکردنی یەکەم پۆل
                </Button>
              }
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title={data.menuItems.length === 0 ? 'هیچ خواردنێک نییە' : 'هیچ خواردنێک بەم فلتەرە نەدۆزرایەوە'}
              description={
                data.menuItems.length === 0
                  ? 'کلیک لە زیادکردنی خواردن بکە و یەکەم خواردنی نوێ زیاد بکە.'
                  : 'فلتەرەکان بگۆڕە یان خواردنی نوێ زیاد بکە.'
              }
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={openNewMenuItemModal}>
                  زیادکردنی خواردن
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-amber-50/40 p-0 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
                >
                  <div className="grid grid-cols-[7rem_minmax(0,1fr)]">
                    <div className="relative">
                      <FoodImage
                        image={item.image}
                        name={item.name}
                        className="h-full min-h-48 bg-stone-50"
                        fallbackClassName="text-5xl"
                      />
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm">
                        {categoryMap.get(item.categoryId) ?? 'بێ پۆل'}
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-stone-900">{item.name}</p>
                          <p className="mt-2 text-sm leading-7 text-stone-600">{item.description || 'بێ وەسف'}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}
                        >
                          {item.isAvailable ? 'چالاک' : 'ناچالاک'}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-stone-200 bg-white/85 p-3 shadow-sm">
                          <p className="text-xs font-semibold text-stone-500">نرخ</p>
                          <p className="mt-2 text-lg font-black text-brand-800">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="rounded-[1.4rem] border border-stone-200 bg-white/85 p-3 shadow-sm">
                          <p className="text-xs font-semibold text-stone-500">ڕیزبەندی</p>
                          <p className="mt-2 text-lg font-black text-stone-900">{item.sortOrder}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => {
                            setEditingItem(item);
                            setMenuModalOpen(true);
                          }}
                        >
                          دەستکاری
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<Power className="h-4 w-4" />}
                          onClick={() => {
                            void (async () => {
                              await setMenuAvailability(item.id, !item.isAvailable, actor);
                              await safeReload();
                            })();
                          }}
                        >
                          {item.isAvailable ? 'ناچالاککردن' : 'چالاککردن'}
                        </Button>
                        <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeletingItem(item)}>
                          سڕینەوە
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Card className="space-y-5 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-violet-50/60">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">بەڕێوەبردنی پۆلەکان</p>
                <h3 className="mt-2 text-2xl font-black text-stone-900">بەڕێوەبردنی پۆلەکان</h3>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                  پۆلەکان بەشە سەرەکییەکانی مێنیۆن. ناوی پۆل، ڕیزبەندی و دۆخی پڕ/بەتاڵییان بە ئاسانیدا لێرە دەبینیت.
                </p>
              </div>
              <Button icon={<FolderPlus className="h-4 w-4" />} onClick={openNewCategoryModal}>
                زیادکردنی پۆل
              </Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  className="pr-11"
                  placeholder="گەڕان بە ناوی پۆل..."
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                />
              </div>

              <div className="rounded-[1.8rem] border border-stone-200 bg-white/90 p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(categoryItemsFilter === 'all')}`} onClick={() => setCategoryItemsFilter('all')}>
                    هەموو پۆلەکان
                  </button>
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(categoryItemsFilter === 'with-items')}`} onClick={() => setCategoryItemsFilter('with-items')}>
                    تەنها پڕ
                  </button>
                  <button type="button" className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${itemFilterClass(categoryItemsFilter === 'empty')}`} onClick={() => setCategoryItemsFilter('empty')}>
                    تەنها بەتاڵ
                  </button>
                </div>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => {
                    setCategorySearch('');
                    setCategoryItemsFilter('all');
                  }}
                >
                  پاککردنەوەی فلتەر
                </Button>
              </div>
            </div>
          </Card>

          {sortedCategories.length === 0 ? (
            <EmptyState
              title="هیچ پۆلێک نییە"
              description="کلیک لە زیادکردنی پۆل بکە بۆ ئەوەی بتوانیت خواردنەکانت لەناو پۆلەکاندا دابنێیت."
              action={
                <Button icon={<FolderPlus className="h-4 w-4" />} onClick={openNewCategoryModal}>
                  زیادکردنی یەکەم پۆل
                </Button>
              }
            />
          ) : filteredCategories.length === 0 ? (
            <EmptyState title="هیچ پۆلێک بەم فلتەرە نەدۆزرایەوە" description="گەڕان یان فلتەرەکان بگۆڕە." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCategories.map((category) => {
                const itemCount = itemCountByCategoryId.get(category.id) ?? 0;
                return (
                  <Card
                    key={category.id}
                    className="space-y-5 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-violet-50/40 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-violet-100 text-violet-800 shadow-sm">
                          <Soup className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-stone-900">{category.name}</h3>
                          <p className="mt-1 text-sm text-stone-500">{itemCount} خواردن لەم پۆلەدا هەیە</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm">
                        ڕیز {category.sortOrder}
                      </span>
                    </div>

                    <div className="rounded-[1.4rem] border border-stone-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-xs font-semibold text-stone-500">خواردنەکان</p>
                      <p className="mt-2 text-lg font-black text-stone-900">{itemCount}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryModalOpen(true);
                        }}
                      >
                        دەستکاری
                      </Button>
                      <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeletingCategory(category)}>
                        سڕینەوە
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <MenuFormModal
        open={isMenuModalOpen}
        categories={sortedCategories}
        initialItem={editingItem}
        onClose={() => {
          setMenuModalOpen(false);
          setEditingItem(null);
        }}
        onOpenCategories={() => {
          setMenuModalOpen(false);
          setActiveTab('categories');
        }}
        onSubmit={async (values) => {
          try {
            await saveMenuItem(values, actor);
            await safeReload();
            showToast('خواردن پاشەکەوتکرا.', 'success');
          } catch (caughtError) {
            showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
          }
        }}
      />

      <CategoryFormModal
        open={isCategoryModalOpen}
        initialCategory={editingCategory}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={async (values) => {
          try {
            await saveCategory(values, actor);
            await safeReload();
            showToast('پۆل پاشەکەوتکرا.', 'success');
          } catch (caughtError) {
            showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        title="سڕینەوەی خواردن"
        description={`دڵنیایت لە سڕینەوەی "${deletingItem?.name ?? ''}"؟`}
        confirmLabel="سڕینەوە"
        tone="danger"
        onClose={() => setDeletingItem(null)}
        onConfirm={() => {
          if (!deletingItem) {
            return;
          }

          void (async () => {
            try {
              await deleteMenuItem(deletingItem.id, actor);
              setDeletingItem(null);
              await safeReload();
              showToast('خواردن سڕایەوە.', 'success');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
            }
          })();
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        title="سڕینەوەی پۆل"
        description={`دڵنیایت لە سڕینەوەی "${deletingCategory?.name ?? ''}"؟`}
        confirmLabel="سڕینەوە"
        tone="danger"
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => {
          if (!deletingCategory) {
            return;
          }

          void (async () => {
            try {
              await deleteCategory(deletingCategory.id, actor);
              setDeletingCategory(null);
              await safeReload();
              showToast('پۆل سڕایەوە.', 'success');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
            }
          })();
        }}
      />
    </div>
  );
};
