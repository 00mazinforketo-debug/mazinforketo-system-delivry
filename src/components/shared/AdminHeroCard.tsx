import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

export interface AdminHeroStat {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: string;
  labelClassName?: string;
}

interface AdminHeroCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  stats?: readonly AdminHeroStat[];
  statsGridClassName?: string;
  children?: ReactNode;
  className?: string;
}

const statGridClass = (count: number) => {
  if (count <= 1) {
    return 'grid-cols-1';
  }

  if (count === 2) {
    return 'sm:grid-cols-2';
  }

  if (count === 3) {
    return 'sm:grid-cols-2 xl:grid-cols-3';
  }

  return 'sm:grid-cols-2 xl:grid-cols-4';
};

export const AdminHeroCard = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  stats = [],
  statsGridClassName,
  children,
  className,
}: AdminHeroCardProps) => (
  <Card className={cn('overflow-hidden border-stone-200 bg-gradient-to-br from-stone-950 via-stone-900 to-brand-900 p-4 text-white lg:p-5', className)}>
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white/70">
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            <span>{eyebrow}</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight lg:text-3xl">{title}</h2>
            {description ? <p className="max-w-3xl text-sm leading-6 text-white/75">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      {children ? <div className="flex flex-col gap-3">{children}</div> : null}

      {stats.length > 0 ? (
        <div className={cn('grid gap-3', statsGridClassName ?? statGridClass(stats.length))}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                'rounded-[1.6rem] border border-white/10 bg-white/10 p-4 shadow-inner',
                stat.tone,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                {stat.icon ? (
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-white/15 text-current">
                    <stat.icon className="h-4.5 w-4.5" />
                  </div>
                ) : null}
                <div className={cn('min-w-0', stat.icon ? 'text-left' : 'w-full text-right')}>
                  <p className={cn('text-[11px] font-semibold opacity-70', stat.labelClassName)}>{stat.label}</p>
                  <p className="mt-1 truncate text-2xl font-black">{stat.value}</p>
                </div>
              </div>
              {stat.hint ? <p className="mt-3 text-xs opacity-70">{stat.hint}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </Card>
);
