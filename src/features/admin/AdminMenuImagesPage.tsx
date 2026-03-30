import { ImagePlus, Search, Soup, SquareMenu } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FoodImage } from '../../components/shared/FoodImage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { isFirestoreImageToken } from '../../lib/firebase-firestore';
import { formatCurrency } from '../../lib/format';
import { isMenuImageSource } from '../../lib/menu-image';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { getCategories, getMenuItems, saveMenuItem } from '../menu/menu-service';
import type { MenuItem } from '../../types/models';
import { AdminFirestoreImageModal } from './AdminFirestoreImageModal';

export const AdminMenuImagesPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [search, setSearch] = usePersistentState('admin-menu-images-search', '');
  const [selectedCategory, setSelectedCategory] = usePersistentState('admin-menu-images-category', 'all');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSaving, setSaving] = useState(false);

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
  const categoryMap = useMemo(() => new Map(data.categories.map((category) => [category.id, category.name])), [data.categories]);
  const itemsWithoutImages = useMemo(
    () => data.menuItems.filter((item) => !isMenuImageSource(item.image) && !isFirestoreImageToken(item.image)),
    [data.menuItems],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = itemsWithoutImages.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
    const categoryName = categoryMap.get(item.categoryId) ?? '';
    const matchesSearch =
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.description.toLowerCase().includes(normalizedSearch) ||
      categoryName.toLowerCase().includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-700">هەڵگرتنی وێنە</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-900">خواردنە بێ وێنەکان</h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/admin/menu" className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
                <Soup className="h-4 w-4" />
                <span>گەڕانەوە بۆ مێنیو</span>
              </Link>
              <Link to="/admin/categories" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
                <SquareMenu className="h-4 w-4" />
                <span>بینینی پۆلەکان</span>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-[1.8rem] border border-stone-200 bg-white/80 p-4">
              <p className="text-xs font-semibold text-stone-500">خواردنی بێ وێنە</p>
              <p className="mt-3 text-3xl font-black text-stone-900">{itemsWithoutImages.length}</p>
            </div>
            <div className="rounded-[1.8rem] border border-stone-200 bg-white/80 p-4">
              <p className="text-xs font-semibold text-stone-500">داتای فلتەرکراو</p>
              <p className="mt-3 text-3xl font-black text-stone-900">{filteredItems.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black text-stone-900">گەڕان و فلتەر</h3>
            <p className="mt-1 text-sm text-stone-600">بە ناوی خواردن یان پۆل بگەڕێ و تەنها ئەو item ـانە بدۆزەوە کە وێنەیان نییە.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:min-w-[30rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input className="pr-11" placeholder="گەڕان بە ناوی خواردن یان پۆل..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
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
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${selectedCategory === 'all' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
            onClick={() => setSelectedCategory('all')}
          >
            هەموو پۆلەکان
          </button>
          {data.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${selectedCategory === category.id ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
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
        <EmptyState title="هەڵە لە بارکردنی خواردنەکان" description={error} />
      ) : itemsWithoutImages.length === 0 ? (
        <EmptyState
          title="هەموو خواردنەکان وێنەیان هەیە"
          description="ئەم بەشە تەنها خواردنە بێ وێنەکان پیشان دەدات. ئێستا هیچ item ـێکی بێ وێنە نەماوە."
          action={
            <Link
              to="/admin/menu"
              className="inline-flex items-center rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              گەڕانەوە بۆ مێنیو
            </Link>
          }
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState title="هیچ item ـێک بەم فلتەرە نەدۆزرایەوە" description="فلتەرەکان بگۆڕە یان لە هەموو پۆلەکان بگەڕێ." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="space-y-4">
              <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
                <FoodImage image={item.image} name={item.name} className="h-24 rounded-3xl bg-stone-50" fallbackClassName="text-4xl" />
                <div className="space-y-2">
                  <button type="button" className="text-right text-lg font-black text-stone-900 hover:text-brand-800" onClick={() => setEditingItem(item)}>
                    {item.name}
                  </button>
                  <p className="text-sm text-stone-500">{categoryMap.get(item.categoryId) ?? 'بێ پۆل'}</p>
                  <p className="line-clamp-2 text-sm leading-6 text-stone-600">{item.description}</p>
                </div>
              </div>

              <div className="rounded-3xl bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                <p>نرخ: {formatCurrency(item.price)}</p>
                <p>ڕیزبەندی: {item.sortOrder}</p>
                <p>وێنەی ئێستا: {isFirestoreImageToken(item.image) ? 'لە Cloud Firestore' : item.image || '🍽️'}</p>
              </div>

              <Button icon={<ImagePlus className="h-4 w-4" />} onClick={() => setEditingItem(item)}>
                uploadی وێنە
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AdminFirestoreImageModal
        open={Boolean(editingItem)}
        menuItem={editingItem}
        categoryName={editingItem ? categoryMap.get(editingItem.categoryId) ?? 'بێ پۆل' : ''}
        busy={isSaving}
        onClose={() => {
          setEditingItem(null);
          setSaving(false);
        }}
        onSubmit={async (draft) => {
          if (!editingItem) {
            return;
          }

          setSaving(true);
          try {
            await saveMenuItem(
              {
                id: editingItem.id,
                categoryId: editingItem.categoryId,
                name: editingItem.name,
                description: editingItem.description,
                price: editingItem.price,
                image: editingItem.image,
                imageAsset: draft,
                sortOrder: editingItem.sortOrder,
                isAvailable: editingItem.isAvailable,
              },
              actor,
            );
            await reload();
            showToast('وێنەکە بۆ Cloud Firestore هاتە پاشەکەوت و خواردن نوێکرایەوە.', 'success');
            setEditingItem(null);
          } catch (caughtError) {
            showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
};
