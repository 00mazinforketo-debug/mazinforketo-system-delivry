import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100',
        className,
        props.disabled && 'cursor-not-allowed bg-stone-100',
      )}
      {...props}
    />
  ),
);

Select.displayName = 'Select';
