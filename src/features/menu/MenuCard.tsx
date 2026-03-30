import { Minus, Plus } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { MenuItem } from '../../types/models';
import { Card } from '../../components/ui/Card';
import { FoodImage } from '../../components/shared/FoodImage';

interface MenuCardProps {
  item: MenuItem;
  quantity?: number;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

export const MenuCard = ({ item, quantity = 0, onAdd, onIncrement, onDecrement }: MenuCardProps) => (
  <Card className="group flex h-full flex-col overflow-hidden rounded-[2rem] p-3">
    <div className="relative flex min-h-32 items-center justify-center rounded-[1.6rem] bg-gradient-to-br from-brand-50 via-white to-olive-50 p-4">
      {!item.isAvailable ? (
        <span className="absolute right-3 top-3 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-700">
          ناچالاک
        </span>
      ) : null}
      <FoodImage
        image={item.image}
        name={item.name}
        className="h-24 w-full rounded-[1.4rem]"
        fallbackClassName="text-5xl"
      />
    </div>

    <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
      <h3 className="min-h-12 text-sm font-black leading-6 text-stone-900">{item.name}</h3>
      <p className="mt-2 text-sm font-black text-brand-800">{formatCurrency(item.price)}</p>

      <div className="mt-auto pt-3">
        {quantity > 0 ? (
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center rounded-2xl bg-stone-100 p-1 shadow-sm">
            <button
              type="button"
              className="inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl bg-white text-stone-700 transition hover:bg-stone-200"
              onClick={onDecrement}
              aria-label={`کەمکردنەوەی ${item.name}`}
              title={`کەمکردنەوەی ${item.name}`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-center text-sm font-black text-stone-900">{quantity}</span>
            <button
              type="button"
              className="inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800"
              onClick={onIncrement}
              aria-label={`زیادکردنی ${item.name}`}
              title={`زیادکردنی ${item.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : onAdd ? (
          <button
            type="button"
            className="inline-flex h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:bg-brand-300"
            onClick={onAdd}
            disabled={!item.isAvailable}
            aria-label={`زیادکردنی ${item.name}`}
            title={`زیادکردنی ${item.name}`}
          >
            <Plus className="h-4 w-4" />
            <span>زیادکردن</span>
          </button>
        ) : null}
      </div>
    </div>
  </Card>
);
