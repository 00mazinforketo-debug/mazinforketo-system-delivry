import { BellDot, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDateTime } from '../../lib/format';
import type { Order } from '../../types/models';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { cn } from '../../lib/cn';

interface OrderListItemProps {
  order: Order;
  active?: boolean;
  highlightNew?: boolean;
  supportingText?: string;
  onSelect?: () => void;
}

export const OrderListItem = ({ order, active, highlightNew, supportingText, onSelect }: OrderListItemProps) => (
  <Card
    className={cn(
      'cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-soft',
      active && 'border-brand-300 ring-2 ring-brand-100',
      highlightNew && 'border-amber-300 bg-amber-50/80',
    )}
    onClick={onSelect}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-stone-900">{order.orderNumber}</h3>
          {highlightNew ? (
            <Badge className="border-amber-200 bg-amber-100 text-amber-800">
              <BellDot className="h-3.5 w-3.5" />
              <span>نوێ</span>
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-stone-700">{order.customerName}</p>
        {supportingText ? <p className="text-xs font-semibold text-brand-700">{supportingText}</p> : null}
        <p className="text-xs text-stone-500">{formatDateTime(order.createdAt)}</p>
      </div>
      <div className="space-y-2 text-left">
        <StatusBadge status={order.status} />
        <p className="text-base font-bold text-brand-800">{formatCurrency(order.total)}</p>
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
      <span>{order.items.length} بابەت</span>
      <Link
        to={`/orders/${order.id}`}
        className="inline-flex items-center gap-1 font-semibold text-brand-700"
        onClick={(event) => event.stopPropagation()}
      >
        وردەکاری
        <ChevronLeft className="h-4 w-4" />
      </Link>
    </div>
  </Card>
);
