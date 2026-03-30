import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'rounded-4xl border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur-sm',
      className,
    )}
    {...props}
  />
);
