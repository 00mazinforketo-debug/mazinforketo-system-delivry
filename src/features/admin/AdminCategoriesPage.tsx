import { FolderPlus, Pencil, Search, Soup, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { CategoryFormModal } from '../menu/CategoryFormModal';
import { deleteCategory, getCategories, getMenuItems, saveCategory } from '../menu/menu-service';
import type { Category } from '../../types/models';

type CategoryItemsFilter = 'all' | 'with-items' | 'empty';

export const AdminCategoriesPage = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [search, setSearch] = usePersistentState('admin-categories-search', '');
  const [itemsFilter, setItemsFilter] = usePersistentState<CategoryItemsFilter>('admin-categories-items-filter', 'all');

  const { data, loading, error, reload } = useLiveQuery(
    async () => {
      const [categories, menuItems] = await Promise.all([getCategories(), getMenuItems()]);
      return { categories, menuItems };
    },
    {
      categories: [],
      menuItems: [],
    },
    ['menu-changed', 'catalog-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const itemCountByCategoryId = new Map(
    data.categories.map((category) => [category.id, data.menuItems.filter((item) => item.categoryId === category.id).length]),
  );
  const sortedCategories = [...data.categories].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCategories = sortedCategories.filter((category) => {
    const itemCount = itemCountByCategoryId.get(category.id) ?? 0;
    const matchesSearch = !normalizedSearch || category.name.toLowerCase().includes(normalizedSearch);
    const matchesItemsFilter =
      itemsFilter === 'all' ||
      (itemsFilter === 'with-items' ? itemCount > 0 : itemCount === 0);

    return matchesSearch && matchesItemsFilter;
  });
  const emptyCategoriesCount = sortedCategories.filter((category) => (itemCountByCategoryId.get(category.id) ?? 0) === 0).length;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-amber-50 via-white to-stone-50">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-700">Categories</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-900">بەڕێوەبردنی پۆلەکان</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">پۆلەکان بناغەی مێنیوی تۆن. لێرە ڕیزبەندییان بکە، ناویان بگۆڕە، و بزانە هەر بەشێک چەند خواردنی تێدایە.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                icon={<FolderPlus className="h-4 w-4" />}
                onClick={() => {
                  setEditingCategory(null);
                  setModalOpen(true);
                }}
              >
                پۆلی نوێ
              </Button>
              <Button variant="secondary" icon={<Soup className="h-4 w-4" />} onClick={() => navigate('/admin/menu')}>
                گەڕانەوە بۆ مێنیو
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.8rem] border border-stone-200 bg-white/80 p-4">
              <p className="text-xs font-semibold text-stone-500">کۆی پۆلەکان</p>
              <p className="mt-3 text-3xl font-black text-stone-900">{data.categories.length}</p>
            </div>
            <div className="rounded-[1.8rem] border border-stone-200 bg-white/80 p-4">
              <p className="text-xs font-semibold text-stone-500">کۆی خواردن لە هەموو پۆلەکان</p>
              <p className="mt-3 text-3xl font-black text-stone-900">{data.menuItems.length}</p>
            </div>
            <div className="rounded-[1.8rem] border border-stone-200 bg-white/80 p-4">
              <p className="text-xs font-semibold text-stone-500">پۆلی بەتاڵ</p>
              <p className="mt-3 text-3xl font-black text-stone-900">{emptyCategoriesCount}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-black text-stone-900">گەڕان و فلتەری پۆلەکان</h3>
            <p className="mt-1 text-sm text-stone-600">پۆلەکان بە ناو بگەڕێ و تەنها ئەوانە دیاری بکە کە خواردنیان هەیە یان بەتاڵن.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:min-w-[30rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input className="pr-11" placeholder="گەڕان بە ناوی پۆل..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setItemsFilter('all');
              }}
            >
              پاککردنەوەی فلتەر
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-stone-600">{filteredCategories.length} پۆل دەرکەوت</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${itemsFilter === 'all' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              onClick={() => setItemsFilter('all')}
            >
              هەموو پۆلەکان
            </button>
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${itemsFilter === 'with-items' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              onClick={() => setItemsFilter('with-items')}
            >
              تەنها پڕ
            </button>
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${itemsFilter === 'empty' ? 'bg-brand-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              onClick={() => setItemsFilter('empty')}
            >
              تەنها بەتاڵ
            </button>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی پۆلەکان" description={error} />
      ) : data.categories.length === 0 ? (
        <EmptyState
          title="هیچ پۆلێک نییە"
          description="یەکەم category دروست بکە بۆ ئەوەی بتوانیت خواردنەکان بە شێوەی پڕۆفیشناڵ ڕێکبخەیت."
          action={
            <Button
              icon={<FolderPlus className="h-4 w-4" />}
              onClick={() => {
                setEditingCategory(null);
                setModalOpen(true);
              }}
            >
              زیادکردنی یەکەم پۆل
            </Button>
          }
        />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          title="هیچ پۆلێک بەم فلتەرە نەدۆزرایەوە"
          description="گەڕان یان فلتەرەکان بگۆڕە بۆ ئەوەی پۆلەکان دەربکەون."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCategories.map((category) => {
            const itemCount = itemCountByCategoryId.get(category.id) ?? 0;
            return (
              <Card key={category.id} className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-amber-100 text-amber-800">
                      <Soup className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-stone-900">{category.name}</h3>
                      <p className="mt-1 text-sm text-stone-500">{itemCount} خواردن لەم پۆلەدا هەیە</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">ڕیز {category.sortOrder}</span>
                </div>

                <div className="rounded-[1.6rem] bg-stone-50 p-4 text-sm text-stone-600">
                  <p>ئەم پۆلە بە کاردێت بۆ پشکنینی فلتەر و هەڵبژاردنی خواردن لە employee side.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={() => {
                      setEditingCategory(category);
                      setModalOpen(true);
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

      <CategoryFormModal
        open={isModalOpen}
        initialCategory={editingCategory}
        onClose={() => {
          setModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={async (values) => {
          try {
            await saveCategory(values, actor);
            await reload();
            showToast('پۆل پاشەکەوتکرا.', 'success');
          } catch (caughtError) {
            showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
          }
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
              await reload();
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
