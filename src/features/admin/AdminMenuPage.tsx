import { ImagePlus, Images, Pencil, Plus, Power, Search, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { deleteMenuItem, getCategories, getMenuItems, saveMenuItem, setMenuAvailability } from '../menu/menu-service';
import { MenuFormModal } from '../menu/MenuFormModal';
import type { MenuItem } from '../../types/models';

type MenuAvailabilityFilter = 'all' | 'available' | 'unavailable';

export const AdminMenuPage = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [search, setSearch] = usePersistentState('admin-menu-search', '');
  const [selectedCategory, setSelectedCategory] = usePersistentState('admin-menu-category', 'all');
  const [availabilityFilter, setAvailabilityFilter] = usePersistentState<MenuAvailabilityFilter>('admin-menu-availability', 'all');

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
  const effectiveSelectedCategory =
    selectedCategory !== 'all' && !sortedCategories.some((category) => category.id === selectedCategory) ? 'all' : selectedCategory;
  const categoryMap = new Map(data.categories.map((category) => [category.id, category.name]));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = data.menuItems.filter((item) => {
    const matchesCategory = effectiveSelectedCategory === 'all' || item.categoryId === effectiveSelectedCategory;
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' ? item.isAvailable : !item.isAvailable);
    const matchesSearch =
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.description.toLowerCase().includes(normalizedSearch) ||
      (categoryMap.get(item.categoryId) ?? '').toLowerCase().includes(normalizedSearch);
    return matchesCategory && matchesAvailability && matchesSearch;
  });

  const availableCount = data.menuItems.filter((item) => item.isAvailable).length;
  const unavailableCount = data.menuItems.length - availableCount;
  const visibleAvailableCount = filteredItems.filter((item) => item.isAvailable).length;
  const visibleUnavailableCount = filteredItems.length - visibleAvailableCount;
  const heroStats = [
    { label: 'کۆی خواردن', value: data.menuItems.length },
    { label: 'چالاک', value: availableCount, tone: 'border-emerald-300/20 bg-emerald-400/10' },
    { label: 'ناچالاک', value: unavailableCount, tone: 'border-amber-300/20 bg-amber-300/10' },
  ] as const;

  const safeReload = async () => {
    await reload();
  };

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="Menu studio"
        icon={Images}
        title="بەڕێوەبردنی مێنیو"
        description="خواردن، نرخ، category، و وێنەکان بە شێوەی inventory-style لێرە دەبینی و بەخێرایی دەستکاریان دەکەیت."
        stats={heroStats}
        actions={
          <>
            <Button
              variant="secondary"
              className="border border-white/15 bg-white/10 text-white hover:bg-white/20"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingItem(null);
                setModalOpen(true);
              }}
            >
              خواردنی نوێ
            </Button>
            <Button
              variant="ghost"
              className="border border-white/15 bg-stone-950/20 text-white hover:bg-white/10"
              icon={<Tags className="h-4 w-4" />}
              onClick={() => navigate('/admin/categories')}
            >
              بەڕێوەبردنی پۆلەکان
            </Button>
            <Button
              variant="ghost"
              className="border border-white/15 bg-stone-950/20 text-white hover:bg-white/10"
              icon={<Images className="h-4 w-4" />}
              onClick={() => navigate('/admin/media')}
            >
              Media Assets
            </Button>
            <Button
              variant="ghost"
              className="border border-white/15 bg-stone-950/20 text-white hover:bg-white/10"
              icon={<ImagePlus className="h-4 w-4" />}
              onClick={() => navigate('/admin/menu-images')}
            >
              وێنەی هەڵگیراوەکان
            </Button>
          </>
        }
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black text-stone-900">گەڕان و فلتەر</h3>
            <p className="mt-1 text-sm text-stone-600">خواردنەکان بە ناو، وەسف، category و دۆخی چالاک/ناچالاک بگەڕێ و لیستەکە بەخێرایی سنووردار بکە.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:min-w-[30rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input className="pr-11" placeholder="گەڕان بە ناو، وەسف یان category..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setAvailabilityFilter('all');
              }}
            >
              پاککردنەوەی فلتەر
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-stone-600">
            {filteredItems.length} خواردن دەرکەوت
            {effectiveSelectedCategory === 'all' ? '' : ' لەم پۆلەدا'}
            {availabilityFilter === 'all' ? '' : availabilityFilter === 'available' ? ' و تەنها چالاکەکان' : ' و تەنها ناچالاکەکان'}
          </p>
          <div className="flex flex-wrap gap-2 text-sm text-stone-500">
            <span>{visibleAvailableCount} چالاک</span>
            <span>{visibleUnavailableCount} ناچالاک</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${availabilityFilter === 'all' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
            onClick={() => setAvailabilityFilter('all')}
          >
            هەموو دۆخەکان
          </button>
          <button
            type="button"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${availabilityFilter === 'available' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
            onClick={() => setAvailabilityFilter('available')}
          >
            تەنها چالاک
          </button>
          <button
            type="button"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${availabilityFilter === 'unavailable' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
            onClick={() => setAvailabilityFilter('unavailable')}
          >
            تەنها ناچالاک
          </button>
        </div>

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
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی مێنیو" description={error} />
      ) : data.categories.length === 0 ? (
        <EmptyState
          title="هێشتا پۆلێک نییە"
          description="پێش زیادکردنی خواردن پێویستە category ـەکان دروست بکرێن. ئێستا سیستەم blank ـە و ئامادەی پڕکردنەوەی ڕاستەقینەی تۆیە."
          action={
            <Button icon={<Tags className="h-4 w-4" />} onClick={() => navigate('/admin/categories')}>
              دروستکردنی یەکەم پۆل
            </Button>
          }
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={data.menuItems.length === 0 ? 'هیچ خواردنێک نییە' : 'هیچ خواردنێک بەم فلتەرە نەدۆزرایەوە'}
          description={
            data.menuItems.length === 0
              ? 'یەکەم خواردن زیاد بکە، وێنەی بۆ هەڵبژێرە و مێنیو دەستپێبکە.'
              : 'فلتەرەکان بگۆڕە یان خواردنی نوێ زیاد بکە.'
          }
          action={
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingItem(null);
                setModalOpen(true);
              }}
            >
              خواردنی نوێ
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:hidden">
            {filteredItems.map((item) => (
              <Card key={item.id} className="overflow-hidden p-0">
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)]">
                  <FoodImage image={item.image} name={item.name} className="h-full min-h-40 bg-stone-50" fallbackClassName="text-5xl" />
                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-stone-900">{item.name}</p>
                        <p className="mt-1 text-sm text-stone-500">{categoryMap.get(item.categoryId) ?? 'بێ پۆل'}</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                        {item.isAvailable ? 'چالاک' : 'ناچالاک'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-3xl bg-stone-50 px-4 py-3 text-sm">
                      <span className="font-black text-brand-800">{formatCurrency(item.price)}</span>
                      <span className="text-stone-500">ڕیز {item.sortOrder}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => {
                          setEditingItem(item);
                          setModalOpen(true);
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

          <Card className="hidden overflow-hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-4 py-4 text-right font-semibold">خواردن</th>
                    <th className="px-4 py-4 text-right font-semibold">پۆل</th>
                    <th className="px-4 py-4 text-right font-semibold">نرخ</th>
                    <th className="px-4 py-4 text-right font-semibold">دۆخ</th>
                    <th className="px-4 py-4 text-right font-semibold">ڕیز</th>
                    <th className="px-4 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="border-b border-stone-100 align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4">
                          <FoodImage image={item.image} name={item.name} className="h-16 w-16 rounded-3xl bg-stone-50" fallbackClassName="text-3xl" />
                          <div className="max-w-[22rem]">
                            <p className="font-black text-stone-900">{item.name}</p>
                            <p className="mt-1 text-xs leading-6 text-stone-500">{item.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">{categoryMap.get(item.categoryId) ?? 'بێ پۆل'}</td>
                      <td className="px-4 py-4 font-black text-brand-800">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                          {item.isAvailable ? 'چالاک' : 'ناچالاک'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-stone-600">{item.sortOrder}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            className="px-3 py-2"
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => {
                              setEditingItem(item);
                              setModalOpen(true);
                            }}
                          >
                            دەستکاری
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-3 py-2"
                            icon={<Power className="h-4 w-4" />}
                            onClick={() => {
                              void (async () => {
                                await setMenuAvailability(item.id, !item.isAvailable, actor);
                                await safeReload();
                              })();
                            }}
                          >
                            {item.isAvailable ? 'ناچالاک' : 'چالاک'}
                          </Button>
                          <Button
                            variant="danger"
                            className="px-3 py-2"
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => setDeletingItem(item)}
                          >
                            سڕینەوە
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <MenuFormModal
        open={isModalOpen}
        categories={data.categories}
        initialItem={editingItem}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onOpenCategories={() => {
          setModalOpen(false);
          navigate('/admin/categories');
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
    </div>
  );
};
