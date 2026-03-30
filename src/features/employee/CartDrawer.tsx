import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../lib/format';
import type { OrderItem } from '../../types/models';

interface CartDrawerProps {
  open: boolean;
  items: OrderItem[];
  subtotal: number;
  onClose: () => void;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onNext: () => void;
}

export const CartDrawer = ({
  open,
  items,
  subtotal,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onNext,
}: CartDrawerProps) => (
  <Drawer open={open} title="سەبەت" onClose={onClose}>
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState
          title="سەبەت بەتاڵە"
          description="خواردنێک هەڵبژێرە بۆ ئەوەی داواکارییەکە دروست بکرێت."
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-stone-900">{item.name}</h3>
                    <p className="mt-1 text-sm text-stone-600">{formatCurrency(item.price)}</p>
                  </div>
                  <button
                    className="rounded-full bg-rose-100 p-2 text-rose-700"
                    onClick={() => onRemove(item.id)}
                    aria-label="سڕینەوە"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-2xl bg-white p-2 shadow-sm"
                      onClick={() => onDecrement(item.id)}
                      aria-label="کەمکردنەوە"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      className="rounded-2xl bg-white p-2 shadow-sm"
                      onClick={() => onIncrement(item.id)}
                      aria-label="زیادکردن"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="font-bold text-brand-800">{formatCurrency(item.lineTotal)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-4xl bg-brand-900 p-4 text-white">
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>ژمارەی بابەت</span>
              <span>{items.reduce((total, item) => total + item.quantity, 0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xl font-black">
              <span>کۆی گشتی</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <Button
              block
              className="mt-4 bg-white text-brand-900 hover:bg-brand-50"
              icon={<ShoppingBag className="h-4 w-4" />}
              onClick={onNext}
            >
              دواتر
            </Button>
          </div>
        </>
      )}
    </div>
  </Drawer>
);
