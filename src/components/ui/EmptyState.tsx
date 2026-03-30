import type { ReactNode } from 'react';
import { Card } from './Card';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <Card className="border-dashed bg-white/70 text-center">
    <div className="mx-auto max-w-md space-y-3 py-6">
      <h3 className="text-lg font-bold text-stone-900">{title}</h3>
      {description ? <p className="text-sm leading-7 text-stone-600">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  </Card>
);
