import { CheckCircle2, Clock3, MapPinned, PackageCheck, Printer, Truck, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FoodImage } from '../../components/shared/FoodImage';
import { cn } from '../../lib/cn';
import { formatCurrency, formatDateOnly, formatDateTime, formatTimeOnly, getStatusLabel, getStatusTone } from '../../lib/format';
import type { DeliveryOrder, Order, OrderMode, OrderStatus } from '../../types/models';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface OrderDetailsPanelProps {
  order: Order | DeliveryOrder;
  actions?: ReactNode;
  backAction?: ReactNode;
  showPrint?: boolean;
  simplifiedStatus?: boolean;
  captainView?: boolean;
  mode?: OrderMode;
}

const fullStatusSteps: Array<{ key: OrderStatus; label: string; icon: typeof Clock3 }> = [
  { key: 'pending_captain', label: 'لە چاوەڕوانیدایە', icon: Clock3 },
  { key: 'accepted', label: 'قبوڵ کراوە', icon: PackageCheck },
  { key: 'completed', label: 'گەیشتووە', icon: Truck },
];

const employeeStatusSteps = [
  { key: 'pending_captain', label: 'لە چاوڕوانیدایە', icon: Clock3 },
  { key: 'accepted', label: 'قبوڵ کراوە', icon: PackageCheck },
] satisfies Array<{ key: 'pending_captain' | 'accepted'; label: string; icon: typeof Clock3 }>;

const deliveryResponseSteps = [
  {
    key: 'pending_captain',
    label: 'لە چاوەڕوانیدایە',
    icon: Clock3,
    activeClassName: 'border-amber-300 bg-gradient-to-b from-amber-100 to-orange-100 text-amber-900 shadow-[0_12px_22px_rgba(251,191,36,0.28)]',
    idleClassName: 'border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50 text-amber-700',
    iconActiveClassName: 'bg-white/75 text-amber-700',
    iconIdleClassName: 'bg-white/80 text-amber-500',
  },
  {
    key: 'accepted',
    label: 'قبوڵکراوە',
    icon: PackageCheck,
    activeClassName: 'border-emerald-300 bg-gradient-to-b from-emerald-100 to-lime-100 text-emerald-900 shadow-[0_12px_22px_rgba(16,185,129,0.24)]',
    idleClassName: 'border-emerald-200 bg-gradient-to-b from-emerald-50 to-lime-50 text-emerald-700',
    iconActiveClassName: 'bg-white/80 text-emerald-700',
    iconIdleClassName: 'bg-white/85 text-emerald-500',
  },
  {
    key: 'cancelled',
    label: 'هەڵوەشایەوە',
    icon: XCircle,
    activeClassName: 'border-rose-300 bg-gradient-to-b from-rose-100 to-red-100 text-rose-900 shadow-[0_12px_22px_rgba(244,63,94,0.24)]',
    idleClassName: 'border-rose-200 bg-gradient-to-b from-rose-50 to-red-50 text-rose-700',
    iconActiveClassName: 'bg-white/80 text-rose-700',
    iconIdleClassName: 'bg-white/85 text-rose-500',
  },
] satisfies Array<{
  key: 'pending_captain' | 'accepted' | 'cancelled';
  label: string;
  icon: typeof Clock3;
  activeClassName: string;
  idleClassName: string;
  iconActiveClassName: string;
  iconIdleClassName: string;
}>;

const reachedStatus = (current: OrderStatus, target: OrderStatus, simplifiedStatus: boolean) => {
  if (simplifiedStatus) {
    if (current === 'cancelled') {
      return false;
    }

    if (target === 'pending_captain') {
      return true;
    }

    return current === 'accepted' || current === 'completed';
  }

  const order = ['pending_captain', 'accepted', 'completed'];
  if (current === 'cancelled') {
    return false;
  }

  return order.indexOf(current) >= order.indexOf(target);
};

export const OrderDetailsPanel = ({
  order,
  actions,
  backAction,
  showPrint,
  simplifiedStatus = false,
  captainView = false,
  mode = 'travel',
}: OrderDetailsPanelProps) => {
  const displayedStatus = {
    label: getStatusLabel(order.status),
    tone: getStatusTone(order.status),
  };
  const statusSteps = simplifiedStatus ? employeeStatusSteps : fullStatusSteps;
  const acceptedDisplayAt = order.acceptedAt ?? order.completedAt;
  const isDelivery = mode === 'delivery';
  const modeLabel = isDelivery ? 'گەیاندن' : 'سەفەری';
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const accentBadge = isDelivery
    ? 'border-sky-200 bg-sky-50 text-sky-800'
    : 'border-brand-200 bg-brand-50 text-brand-800';
  const accentIcon = isDelivery ? 'text-sky-700' : 'text-brand-700';
  const accentFooter = isDelivery ? 'bg-sky-50' : 'bg-brand-50';
  const accentTotal = isDelivery ? 'text-sky-900' : 'text-brand-900';
  const compactSurface = isDelivery
    ? 'border-sky-100 bg-gradient-to-br from-white via-sky-50/55 to-cyan-50/70'
    : 'border-brand-100 bg-gradient-to-br from-white via-brand-50/55 to-amber-50/70';
  const activeDeliveryResponseKey = order.status === 'completed' ? 'accepted' : order.status;
  const infoPanelClassName = isDelivery
    ? 'border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/70'
    : 'border-brand-100 bg-gradient-to-br from-white via-brand-50/65 to-amber-50/75';
  const infoCardClassName = cn(
    'rounded-[1.6rem] border border-white/80 bg-white/95 shadow-[0_10px_24px_rgba(28,25,23,0.07)]',
    captainView ? 'p-3' : 'p-4',
  );
  const customerFieldCards = [
    {
      label: 'ناوی کڕیار',
      value: order.customerName,
    },
    {
      label: 'شوێنی گەیاندن',
      value: order.province || 'بەتاڵ',
    },
    {
      label: 'ژمارەی مۆبایل',
      value: order.mobileNumber,
      valueClassName: 'text-right [unicode-bidi:plaintext]',
      dir: 'ltr' as const,
    },
    {
      label: 'وردەکاری ناونیشان',
      value: order.extraAddress || 'بەتاڵ',
    },
    {
      label: 'تێبینی',
      value: order.note || 'بەتاڵ',
    },
    {
      label: 'کۆی گشتی',
      value: formatCurrency(order.total),
      valueClassName: accentTotal,
      cardClassName: isDelivery
        ? 'border-sky-200 bg-gradient-to-br from-sky-100 via-white to-cyan-100'
        : 'border-brand-200 bg-gradient-to-br from-brand-100 via-white to-amber-100',
    },
  ];
  const dateFieldCards = [
    {
      label: 'نێردراوە',
      value: formatDateTime(order.createdAt),
      cardClassName: 'border-stone-200 bg-gradient-to-br from-white to-stone-100',
      valueClassName: 'text-stone-900',
    },
    {
      label: 'قبوڵکراوە',
      value: formatDateTime(simplifiedStatus ? acceptedDisplayAt : order.acceptedAt),
      cardClassName: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50',
      valueClassName: 'text-emerald-900',
    },
    {
      label: 'هەڵوەشایەوە',
      value: order.status === 'cancelled' ? formatDateTime(order.updatedAt) : 'هێشتا نییە',
      cardClassName: 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-red-50',
      valueClassName: order.status === 'cancelled' ? 'text-rose-900' : 'text-rose-700',
    },
    {
      label: 'هۆکاری هەڵوەشاندنەوە',
      value: order.cancelReason || 'بەتاڵ',
      cardClassName: 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-red-50',
      valueClassName: order.cancelReason ? 'text-rose-900' : 'text-rose-700',
    },
  ];

  return (
    <Card className={cn('print:shadow-none', captainView ? 'space-y-4 p-4' : 'space-y-6')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className={cn('space-y-2', captainView && 'min-w-0 flex-1')}>
          {captainView ? (
            <>
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-start gap-2">
                  <Badge className={accentBadge}>{modeLabel}</Badge>
                  <Badge className={displayedStatus.tone}>{displayedStatus.label}</Badge>
                </div>
                <h2
                  className="shrink-0 text-left text-[1.7rem] font-black tracking-tight text-stone-900 [unicode-bidi:plaintext] sm:text-[1.95rem]"
                  dir="ltr"
                >
                  {order.orderNumber}
                </h2>
              </div>
              <div className={cn('rounded-[1.9rem] border p-3.5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.18)]', compactSurface)}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <p className="text-[11px] font-semibold text-stone-500">داواکاری نێردراوە لە لایەن</p>
                  <p className="justify-self-start text-left text-[11px] font-semibold text-stone-500">بەروار / کاتژمێر</p>
                  <p className="text-sm font-black text-stone-900">کارمەند: {order.createdByName}</p>
                  <p className="justify-self-start text-left text-sm font-black text-stone-900 [unicode-bidi:plaintext]" dir="ltr">
                    {formatDateOnly(order.createdAt)} {formatTimeOnly(order.createdAt)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={accentBadge}>{modeLabel}</Badge>
                <Badge className={accentBadge}>{order.orderNumber}</Badge>
                {!simplifiedStatus ? <StatusBadge status={order.status} /> : null}
                {order.offlineState === 'queued' ? (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-800">لە ئامێرەکەدا هەڵگیراوە</Badge>
                ) : null}
              </div>
              <h2 className="text-2xl font-black text-stone-900">{order.customerName}</h2>
              <p className="text-sm text-stone-600">{order.mobileNumber}</p>
              <p className={`text-xs font-semibold ${isDelivery ? 'text-sky-700' : 'text-brand-700'}`}>
                نێردراوە لە لایەن {order.createdByName}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 print:hidden">
          <div className="flex flex-wrap justify-end gap-3">
            {showPrint ? (
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                چاپ
              </Button>
            ) : null}
            {actions}
          </div>
          {backAction}
        </div>
      </div>

      <div className={cn('rounded-4xl bg-stone-50', captainView ? 'p-3.5' : 'p-4')}>
        <div className={cn('flex flex-wrap items-center gap-2', captainView ? 'mb-3' : 'mb-4')}>
          <h3 className="text-sm font-black text-stone-900">دۆخی {modeLabel}</h3>
          {order.offlineState === 'queued' ? (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800">
              <Clock3 className="h-3.5 w-3.5" />
              <span>چاوەڕێی sync</span>
            </Badge>
          ) : null}
        </div>
        {isDelivery ? (
          <div className={cn('grid grid-cols-3', captainView ? 'gap-2' : 'gap-3')}>
            {deliveryResponseSteps.map((step) => {
              const active = activeDeliveryResponseKey === step.key;
              const StepIcon = step.icon;
              return (
                <div
                  key={step.key}
                  className={cn(
                    captainView ? 'rounded-[1.5rem] border px-2.5 py-3 text-center transition' : 'rounded-[1.8rem] border px-3 py-4 text-center transition',
                    active ? step.activeClassName : step.idleClassName,
                  )}
                >
                  <div
                    className={cn(
                      'mx-auto flex items-center justify-center',
                      captainView ? 'h-9 w-9 rounded-[1rem]' : 'h-11 w-11 rounded-2xl',
                      active ? step.iconActiveClassName : step.iconIdleClassName,
                    )}
                  >
                    <StepIcon className={captainView ? 'h-4 w-4' : 'h-5 w-5'} />
                  </div>
                  <p className={cn('font-black leading-5', captainView ? 'mt-2 text-[11px]' : 'mt-3 text-xs sm:text-sm')}>{step.label}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={cn('grid gap-2.5', captainView ? 'grid-cols-2' : simplifiedStatus ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
            {statusSteps.map((step) => {
              const active = reachedStatus(order.status, step.key, simplifiedStatus);
              const StepIcon = step.icon;
              return (
                <div
                  key={step.key}
                  className={cn(
                    captainView ? 'rounded-[1.5rem] border p-3' : 'rounded-3xl border p-4',
                    active ? 'border-brand-200 bg-white text-brand-900' : 'border-stone-200 bg-white text-stone-500',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StepIcon className={cn(captainView ? 'h-3.5 w-3.5' : 'h-4 w-4', active ? accentIcon : 'text-stone-400')} />
                    <p className={cn('font-black', captainView ? 'text-[12px]' : '')}>{step.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={cn('rounded-[2rem] border shadow-[0_16px_36px_rgba(28,25,23,0.07)]', infoPanelClassName, captainView ? 'p-4' : 'p-5')}>
        <div className={cn(captainView ? 'space-y-4 lg:grid lg:grid-cols-[1.18fr_0.92fr] lg:gap-3 lg:space-y-0' : 'space-y-5')}>
          <div>
            <div className={cn('flex items-center gap-2', captainView ? 'mb-3' : 'mb-4')}>
              <MapPinned className={`h-4 w-4 ${accentIcon}`} />
              <h3 className="text-sm font-black text-stone-900">زانیاریی کڕیار</h3>
            </div>

            <div className={cn('grid grid-cols-2', captainView ? 'gap-2' : 'gap-3')}>
              {customerFieldCards.map((field) => (
                <div key={field.label} className={cn(infoCardClassName, field.cardClassName)}>
                  <p className="text-xs font-bold text-stone-500">{field.label}</p>
                  <p
                    className={cn(
                      captainView ? 'mt-1.5 text-[13px] font-black leading-6 text-stone-900 sm:text-sm' : 'mt-2 text-sm font-black leading-7 text-stone-900 sm:text-base',
                      field.valueClassName,
                    )}
                    dir={field.dir}
                  >
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {!captainView ? <div className="h-px bg-gradient-to-l from-white/0 via-stone-200 to-white/0" /> : null}

          <div>
            <div className={cn('flex items-center gap-2', captainView ? 'mb-3' : 'mb-4')}>
              <CheckCircle2 className={`h-4 w-4 ${accentIcon}`} />
              <h3 className="text-sm font-black text-stone-900">کات و بەروار</h3>
            </div>

            <div className={cn('grid grid-cols-2', captainView ? 'gap-2' : 'gap-3')}>
              {dateFieldCards.map((field) => (
                <div key={field.label} className={cn(infoCardClassName, field.cardClassName)}>
                  <p className="text-xs font-bold text-stone-500">{field.label}</p>
                  <p
                    className={cn(
                      captainView ? 'mt-1.5 text-[13px] font-black leading-6 sm:text-sm' : 'mt-2 text-sm font-black leading-7 sm:text-base',
                      field.valueClassName,
                    )}
                  >
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={cn('space-y-4', captainView && 'space-y-3')}>
        <div className="flex items-center justify-between gap-3">
          <h3 className={cn('font-black text-stone-900', captainView ? 'text-lg' : 'text-xl')}>خواردنەکان</h3>
          <div
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-black shadow-inner',
              isDelivery ? 'bg-sky-100 text-sky-900' : 'bg-brand-100 text-brand-900',
            )}
          >
            {order.items.length} بابەت
          </div>
        </div>

        <div className={cn('grid', captainView ? 'grid-cols-2 gap-2.5' : 'gap-4')}>
          {order.items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'border',
                captainView
                  ? isDelivery
                    ? 'rounded-[1.7rem] border-sky-100 bg-gradient-to-br from-white via-sky-50/65 to-cyan-50/75 p-3 shadow-[0_18px_34px_-28px_rgba(14,165,233,0.45)]'
                    : 'rounded-[1.7rem] border-brand-100 bg-gradient-to-br from-white via-brand-50/65 to-amber-50/75 p-3 shadow-[0_18px_34px_-28px_rgba(180,83,9,0.32)]'
                  : 'rounded-4xl border-stone-200 bg-white p-4',
              )}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className={cn('space-y-2', captainView && 'space-y-1.5')}>
                  <p className={cn('font-black text-stone-900', captainView ? 'text-base leading-6' : 'text-lg')}>{item.name}</p>
                  {captainView ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black shadow-[0_10px_18px_-16px_rgba(15,23,42,0.45)]',
                          isDelivery
                            ? 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 text-white'
                            : 'bg-gradient-to-r from-brand-700 via-brand-800 to-amber-700 text-white',
                        )}
                      >
                        {formatCurrency(item.price)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-stone-700 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.28)]">
                        {item.quantity} دانە
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className={`text-sm font-semibold ${isDelivery ? 'text-sky-800' : 'text-brand-800'}`}>{formatCurrency(item.price)}</p>
                      <p className="text-sm text-stone-600">چەند دانە: {item.quantity}</p>
                    </>
                  )}
                </div>
                <FoodImage
                  image={item.image}
                  name={item.name}
                  className={cn(
                    captainView ? 'h-14 w-14 rounded-[1.2rem] ring-1 ring-white/80 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)]' : 'h-20 w-20 rounded-3xl',
                    isDelivery ? 'bg-sky-50' : 'bg-brand-50',
                  )}
                  fallbackClassName={captainView ? 'text-[1.65rem]' : 'text-4xl'}
                />
              </div>

              <div
                className={cn(
                  captainView ? 'mt-3 flex items-center justify-between text-sm' : 'mt-4 flex items-center justify-between text-sm',
                  captainView
                    ? isDelivery
                      ? 'rounded-[1.2rem] bg-white/80 px-3 py-2 text-sky-900 shadow-inner'
                      : 'rounded-[1.2rem] bg-white/80 px-3 py-2 text-brand-900 shadow-inner'
                    : 'rounded-3xl bg-stone-50 px-4 py-3',
                )}
              >
                <span className={captainView ? 'text-[12px] font-bold opacity-80' : 'text-stone-600'}>کۆی ئەم بابەتە</span>
                <span className="font-black text-stone-900">{formatCurrency(item.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {captainView ? (
        <div className="grid grid-cols-3 gap-2">
          <div className={cn('rounded-[1.45rem] border px-3 py-3 text-center shadow-[0_14px_28px_-22px_rgba(15,23,42,0.25)]', compactSurface)}>
            <p className="text-[11px] font-bold text-stone-500">ژمارەی دانەکان</p>
            <p className="mt-1 text-sm font-black text-stone-900">{totalQuantity}</p>
          </div>
          <div className={cn('rounded-[1.45rem] border px-3 py-3 text-center shadow-[0_14px_28px_-22px_rgba(15,23,42,0.25)]', compactSurface)}>
            <p className="text-[11px] font-bold text-stone-500">کۆی سەرەتایی</p>
            <p className="mt-1 text-sm font-black text-stone-900">{formatCurrency(order.subtotal)}</p>
          </div>
          <div className={cn('rounded-[1.45rem] border px-3 py-3 text-center shadow-[0_14px_28px_-22px_rgba(15,23,42,0.25)]', accentFooter, isDelivery ? 'border-sky-200' : 'border-brand-200')}>
            <p className="text-[11px] font-bold text-stone-500">کۆی گشتی</p>
            <p className={cn('mt-1 text-sm font-black', accentTotal)}>{formatCurrency(order.total)}</p>
          </div>
        </div>
      ) : (
        <div className={`mr-auto w-full max-w-md space-y-3 rounded-4xl p-5 ${accentFooter}`}>
          <div className="flex items-center justify-between text-sm text-stone-700">
            <span>کۆی سەرەتایی</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className={`flex items-center justify-between text-xl font-black ${accentTotal}`}>
            <span>کۆی گشتی</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      )}
    </Card>
  );
};
