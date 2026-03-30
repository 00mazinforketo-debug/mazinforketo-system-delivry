import { CalendarRange, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/cn';
import type { CaptainDateRangeValue } from './captain-date-range';
import { formatCaptainDateRangeLabel, hasCaptainDateRange, normalizeCaptainDateRange } from './captain-date-range';

interface CaptainDateRangeFilterProps {
  value: CaptainDateRangeValue;
  onChange: (value: CaptainDateRangeValue) => void;
}

export const CaptainDateRangeFilter = ({ value, onChange }: CaptainDateRangeFilterProps) => {
  const hasRange = hasCaptainDateRange(value);
  const [open, setOpen] = useState(hasRange);
  const normalized = normalizeCaptainDateRange(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={hasRange || open ? 'primary' : 'secondary'}
          icon={<CalendarRange className="h-4 w-4" />}
          onClick={() => setOpen((current) => !current)}
        >
          بەروار
        </Button>
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm font-semibold',
            hasRange ? 'border-brand-100 bg-brand-50 text-brand-900' : 'border-stone-200 bg-white/90 text-stone-600',
          )}
        >
          {formatCaptainDateRangeLabel(normalized)}
        </div>
        {hasRange ? (
          <Button
            variant="ghost"
            icon={<X className="h-4 w-4" />}
            onClick={() => {
              onChange({ fromDate: '', toDate: '' });
              setOpen(false);
            }}
          >
            پاککردنەوە
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="grid gap-3 rounded-[1.8rem] border border-white/80 bg-white/90 p-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-stone-700">
            <span>لە</span>
            <Input
              type="date"
              value={normalized.fromDate}
              max={normalized.toDate || undefined}
              onChange={(event) => onChange(normalizeCaptainDateRange({ ...normalized, fromDate: event.target.value }))}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-stone-700">
            <span>هەتا</span>
            <Input
              type="date"
              value={normalized.toDate}
              min={normalized.fromDate || undefined}
              onChange={(event) => onChange(normalizeCaptainDateRange({ ...normalized, toDate: event.target.value }))}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
};
