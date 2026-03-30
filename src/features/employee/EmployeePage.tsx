import { Search, ShoppingCart } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { usePersistentState } from '../../hooks/use-persistent-state';
import { formatCurrency, formatNumber } from '../../lib/format';
import type { AppSettings, Category, MenuItem } from '../../types/models';
import { useSessionStore } from '../../stores/session-store';
import { getCategories, getMenuItems } from '../menu/menu-service';
import { MenuCard } from '../menu/MenuCard';
import { useCartStore } from './cart-store';
import { EmployeeShell } from './EmployeeShell';
import { getEmployeeHiddenEntityIds } from './employee-visibility';
import { getAppSettings } from '../settings/settings-service';

export const EmployeePage = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const [search, setSearch] = usePersistentState('employee-search', '');
  const [selectedCategory, setSelectedCategory] = usePersistentState('employee-category', 'all');

  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const syncCatalog = useCartStore((state) => state.syncCatalog);

  const { data, loading, error } = useLiveQuery<{
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
    ['menu-changed', 'catalog-changed', 'settings-changed', 'reset-performed', 'view-state-changed'],
    { pollIntervalMs: 20000, backgroundPollIntervalMs: 30000 },
  );

  useEffect(() => {
    if (loading || error) {
      return;
    }

    syncCatalog(data.menuItems);
  }, [data.menuItems, error, loading, syncCatalog]);

  if (!session) {
    return null;
  }

  const hiddenCategoryIds = Array.from(new Set([...(data.settings?.hiddenCategoryIds ?? []), ...data.localHiddenCategoryIds]));
  const hiddenMenuItemIds = Array.from(new Set([...(data.settings?.hiddenMenuItemIds ?? []), ...data.localHiddenMenuItemIds]));
  const cartQuantityMap = new Map(cartItems.map((item) => [item.id, item.quantity]));
  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.lineTotal, 0);
  const visibleCategories = data.categories.filter((category) => !hiddenCategoryIds.includes(category.id));
  const sortedVisibleCategories = [...visibleCategories].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
  const effectiveSelectedCategory =
    selectedCategory !== 'all' && !sortedVisibleCategories.some((category) => category.id === selectedCategory)
      ? 'all'
      : selectedCategory;
  const filterButtons = [
    { id: 'all', label: 'هەمووی' },
    ...sortedVisibleCategories.map((category) => ({
      id: category.id,
      label: category.name,
    })),
  ];

  const filteredItems = data.menuItems.filter((item) => {
    const matchesAvailability = item.isAvailable;
    const matchesCategory = effectiveSelectedCategory === 'all' || item.categoryId === effectiveSelectedCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query);
    const matchesVisibility =
      !hiddenCategoryIds.includes(item.categoryId) && !hiddenMenuItemIds.includes(item.id);

    return matchesAvailability && matchesCategory && matchesSearch && matchesVisibility;
  });

  return (
    <EmployeeShell>
      <section className={`space-y-6 ${cartItemCount > 0 ? 'pb-28' : ''}`}>
        <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50">
          <div className="space-y-5">
            <div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-stone-900">هەڵبژاردنی مێنیو</h2>
              </div>
            </div>

            <div className="space-y-4 rounded-[1.9rem] border border-white/70 bg-white/75 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-stone-900">هەموو فلتەرەکان</p>
                <span className="rounded-[1rem] bg-gradient-to-br from-brand-100 to-brand-50 px-3 py-2 text-xs font-black text-brand-900">
                  {effectiveSelectedCategory === 'all'
                    ? 'هەموو پۆلەکان'
                    : sortedVisibleCategories.find((category) => category.id === effectiveSelectedCategory)?.name ?? 'هەمووی'}
                </span>
              </div>

              <div data-employee-filter-grid="true" className="grid grid-cols-4 gap-2">
                {filterButtons.map((button) => {
                  const isActive = effectiveSelectedCategory === button.id;

                  return (
                    <button
                      key={button.id}
                      type="button"
                      className={`flex min-h-[4.1rem] items-center justify-center rounded-[1.1rem] border px-2 py-3 text-center text-[0.76rem] font-black leading-5 transition sm:text-sm ${
                        isActive
                          ? 'border-brand-700 bg-brand-700 text-white shadow-card'
                          : 'border-white/80 bg-white/95 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                      onClick={() => setSelectedCategory(button.id)}
                    >
                      <span className="whitespace-normal break-words">{button.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative max-w-2xl">
              <div className="relative">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  className="rounded-[1.6rem] border-white/80 bg-white/90 pr-11 shadow-sm"
                  placeholder="گەڕان بە ناوی خواردن یان وەسف..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState title="هەڵە لە بارکردنی مێنیو" description={error} />
        ) : filteredItems.length === 0 ? (
          <EmptyState title="هیچ خواردنێک نەدۆزرایەوە" description="فلتەرەکان بگۆڕە یان لە ڕێخستنەکان visibility بپشکنەوە." />
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <MenuCard
                key={item.id}
                item={item}
                quantity={cartQuantityMap.get(item.id) ?? 0}
                onAdd={() => {
                  addItem(item);
                }}
                onIncrement={() => {
                  increment(item.id);
                }}
                onDecrement={() => {
                  decrement(item.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {cartItemCount > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => navigate('/employee/cart')}
            className="flex w-full items-center justify-between gap-4 rounded-[2rem] border border-white/70 bg-stone-950 px-4 py-4 text-white shadow-card transition hover:bg-stone-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-white">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="text-right">
                <p className="text-sm font-black">کۆی گشتی</p>
                <p className="mt-1 text-xs text-stone-300">{formatNumber(cartItemCount)} بابەت لە سەبەتەکەتدا هەیە</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-lg font-black text-brand-200">{formatCurrency(cartTotal)}</p>
              <p className="mt-1 text-xs font-semibold text-stone-300">بینینی سەبەت</p>
            </div>
          </button>
        </div>
      ) : null}
    </EmployeeShell>
  );
};
