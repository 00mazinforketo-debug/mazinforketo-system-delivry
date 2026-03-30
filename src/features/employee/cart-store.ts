import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MenuItem, OrderItem } from '../../types/models';
import { useToastStore } from '../../stores/toast-store';

interface CartState {
  items: OrderItem[];
  addItem: (item: MenuItem) => void;
  increment: (itemId: string) => void;
  decrement: (itemId: string) => void;
  remove: (itemId: string) => void;
  syncCatalog: (items: MenuItem[]) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((entry) => entry.id === item.id);
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.id === item.id
                  ? {
                      ...entry,
                      quantity: entry.quantity + 1,
                      lineTotal: (entry.quantity + 1) * entry.price,
                    }
                  : entry,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                id: item.id,
                name: item.name,
                image: item.image,
                price: item.price,
                quantity: 1,
                lineTotal: item.price,
              },
            ],
          };
        }),
      increment: (itemId) =>
        set((state) => ({
          items: state.items.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  quantity: entry.quantity + 1,
                  lineTotal: (entry.quantity + 1) * entry.price,
                }
              : entry,
          ),
        })),
      decrement: (itemId) =>
        set((state) => ({
          items: state.items
            .map((entry) =>
              entry.id === itemId
                ? {
                    ...entry,
                    quantity: entry.quantity - 1,
                    lineTotal: (entry.quantity - 1) * entry.price,
                  }
                : entry,
            )
            .filter((entry) => entry.quantity > 0),
        })),
      remove: (itemId) =>
        set((state) => ({
          items: state.items.filter((entry) => entry.id !== itemId),
        })),
      syncCatalog: (items) =>
        set((state) => {
          if (state.items.length === 0) {
            return state;
          }

          const availableItems = new Map(items.filter((item) => item.isAvailable).map((item) => [item.id, item]));
          let removedCount = 0;
          let updatedCount = 0;

          const nextItems = state.items.flatMap((entry) => {
            const source = availableItems.get(entry.id);
            if (!source) {
              removedCount += 1;
              return [];
            }

            const nextLineTotal = source.price * entry.quantity;
            const nextEntry: OrderItem = {
              ...entry,
              name: source.name,
              image: source.image,
              price: source.price,
              lineTotal: nextLineTotal,
            };

            if (
              nextEntry.name !== entry.name ||
              nextEntry.image !== entry.image ||
              nextEntry.price !== entry.price ||
              nextEntry.lineTotal !== entry.lineTotal
            ) {
              updatedCount += 1;
            }

            return [nextEntry];
          });

          if (removedCount === 0 && updatedCount === 0) {
            return state;
          }

          const showToast = useToastStore.getState().show;
          if (removedCount > 0) {
            showToast('هەندێک خواردن لە سەبەتەکە لابرا چونکە سڕدرانەوە یان ناچالاک کران.', 'info');
          } else if (updatedCount > 0) {
            showToast('زانیاریی سەبەتەکە لەگەڵ مێنیوی نوێ sync کرا.', 'info');
          }

          return {
            items: nextItems,
          };
        }),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'restaurant-ops:cart',
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
