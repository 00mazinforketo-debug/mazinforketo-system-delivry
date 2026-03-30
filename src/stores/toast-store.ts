import { create } from 'zustand';
import { createId } from '../lib/id';

export interface ToastItem {
  id: string;
  title: string;
  tone?: 'success' | 'error' | 'info';
}

interface ToastState {
  items: ToastItem[];
  show: (title: string, tone?: ToastItem['tone']) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (title, tone = 'info') =>
    set((state) => ({
      items: [...state.items, { id: createId('toast'), title, tone }],
    })),
  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));
