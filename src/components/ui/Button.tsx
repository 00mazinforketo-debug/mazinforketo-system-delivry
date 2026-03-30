import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  icon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-300 disabled:bg-brand-300',
  secondary:
    'bg-stone-100 text-stone-900 hover:bg-stone-200 focus-visible:ring-stone-300 disabled:bg-stone-100',
  ghost:
    'bg-white/70 text-stone-700 hover:bg-white focus-visible:ring-stone-200 disabled:bg-stone-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300 disabled:bg-rose-300',
};

export const Button = ({
  className,
  variant = 'primary',
  block,
  icon,
  children,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed',
      variantClasses[variant],
      block && 'w-full',
      className,
    )}
    {...props}
  >
    {icon}
    {children}
  </button>
);
