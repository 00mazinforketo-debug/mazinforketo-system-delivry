import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export const Drawer = ({ open, title, children, onClose }: DrawerProps) => {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <aside className="absolute bottom-0 left-0 right-0 max-h-[88vh] rounded-t-[2rem] bg-white p-5 shadow-soft md:bottom-4 md:left-auto md:right-4 md:top-4 md:w-[430px] md:rounded-[2rem]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <Button variant="ghost" className="h-10 w-10 rounded-full p-0" onClick={onClose} aria-label="داخستن">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(88vh-80px)] overflow-y-auto md:h-full">{children}</div>
      </aside>
    </div>,
    document.body,
  );
};
