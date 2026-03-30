import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Card } from './Card';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export const Modal = ({ open, title, description, children, onClose }: ModalProps) => {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <Card className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-stone-900">{title}</h2>
            {description ? <p className="mt-2 text-sm text-stone-600">{description}</p> : null}
          </div>
          <Button variant="ghost" className="h-10 w-10 rounded-full p-0" onClick={onClose} aria-label="داخستن">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </Card>
    </div>,
    document.body,
  );
};
