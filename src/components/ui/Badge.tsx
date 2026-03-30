import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700',
      className,
    )}
    {...props}
  />
);
