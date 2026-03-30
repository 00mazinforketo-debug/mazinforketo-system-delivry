import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  extraContent?: ReactNode;
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'دڵنیابووم',
  cancelLabel = 'پاشگەزبوونەوە',
  tone = 'primary',
  busy,
  onConfirm,
  onClose,
  extraContent,
}: ConfirmDialogProps) => (
  <Modal open={open} title={title} description={description} onClose={onClose}>
    {extraContent}
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
        {busy ? 'چاوەڕێبە...' : confirmLabel}
      </Button>
    </div>
  </Modal>
);
