import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { formatCurrency } from '../../lib/format';
import type { AppSettings, MenuItem } from '../../types/models';
import { useSessionStore } from '../../stores/session-store';
import { getMenuItems } from '../menu/menu-service';
import { getAppSettings } from '../settings/settings-service';
import { useCartStore } from './cart-store';
import { EmployeeShell } from './EmployeeShell';

export const EmployeeCartPage = () => {
  const session = useSessionStore((state) => state.session);
  const navigate = useNavigate();

  const items = useCartStore((state) => state.items);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const remove = useCartStore((state) => state.remove);
  const syncCatalog = useCartStore((state) => state.syncCatalog);

  const { data, loading, error } = useLiveQuery<{
    settings: AppSettings | null;
    menuItems: MenuItem[];
  }>(
    async () => {
      const [settings, menuItems] = await Promise.all([getAppSettings(), getMenuItems()]);
      return { settings, menuItems };
    },
    {
      settings: null as AppSettings | null,
      menuItems: [],
    },
    ['settings-changed', 'menu-changed', 'catalog-changed', 'reset-performed'],
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

  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <EmployeeShell>
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-2xl font-black text-stone-900">سەبەتەی کڕین</h2>
          </Card>

          {items.length === 0 ? (
            <Card>
              <EmptyState
                title="سەبەت بەتاڵە"
                description="هێشتا هیچ خواردنێکت هەڵنەبژاردووە. بگەڕێرەوە بۆ سەرەکی و داواکارییەکەت دروست بکە."
              />
              <div className="mt-4 flex justify-center">
                <Link
                  to="/employee"
                  className="inline-flex items-center rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  گەڕانەوە بۆ سەرەکی
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">{item.name}</h3>
                      <p className="mt-1 text-sm text-stone-600">{formatCurrency(item.price)}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-rose-100 p-2 text-rose-700 transition hover:bg-rose-200"
                      onClick={() => remove(item.id)}
                      aria-label="سڕینەوە"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-2xl bg-stone-100 p-2 transition hover:bg-stone-200"
                        onClick={() => decrement(item.id)}
                        aria-label="کەمکردنەوە"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-10 text-center text-base font-black text-stone-900">{item.quantity}</span>
                      <button
                        type="button"
                        className="rounded-2xl bg-stone-100 p-2 transition hover:bg-stone-200"
                        onClick={() => increment(item.id)}
                        aria-label="زیادکردن"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="text-lg font-black text-brand-800">{formatCurrency(item.lineTotal)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-stone-900">پوختەی سەبەت</h2>
              <p className="mt-1 text-sm text-stone-600">پێش ناردن، پوختەی داواکارییەکەت لێرە دڵنیابکەرەوە.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-stone-50 p-4">
                <p className="text-xs text-stone-500">ژمارەی بابەت</p>
                <p className="mt-2 text-2xl font-black text-stone-900">{itemCount}</p>
              </div>
              <div className="rounded-3xl bg-brand-50 p-4">
                <p className="text-xs text-brand-700">کۆی گشتی</p>
                <p className="mt-2 text-2xl font-black text-brand-900">{formatCurrency(subtotal)}</p>
              </div>
            </div>

            {loading ? (
              <LoadingBlock />
            ) : error ? (
              <EmptyState title="هەڵە لە بارکردنی ڕێکخستن" description={error} />
            ) : (
              <Button
                block
                icon={<ShoppingCart className="h-4 w-4" />}
                onClick={() => navigate('/employee/checkout')}
                disabled={items.length === 0 || !data.settings}
              >
                تەواوکردنی داواکاری
              </Button>
            )}
          </Card>
        </div>
      </section>
    </EmployeeShell>
  );
};
