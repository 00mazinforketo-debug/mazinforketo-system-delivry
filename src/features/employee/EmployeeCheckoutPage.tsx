import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FoodImage } from '../../components/shared/FoodImage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Textarea } from '../../components/ui/Textarea';
import { useLiveQuery } from '../../hooks/use-live-query';
import { cn } from '../../lib/cn';
import { formatCurrency } from '../../lib/format';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { AppSettings, MenuItem, OrderMode } from '../../types/models';
import { createDeliveryOrder } from '../delivery/delivery-service';
import { getMenuItems } from '../menu/menu-service';
import { createOrder } from '../orders/order-service';
import { getAppSettings } from '../settings/settings-service';
import { useCartStore } from './cart-store';
import { EmployeeShell } from './EmployeeShell';
import { getEmployeeCheckoutDefaultMode } from './employee-checkout-preference';

const checkoutSchema = z.object({
  customerName: z.string().min(2, 'ناوی کڕیار پێویستە.'),
  mobileNumber: z.string().regex(/^[0-9]{8,15}$/, 'ژمارەی مۆبایل دەبێت تەنها لە ژمارە پێکبێت.'),
  province: z.string().min(2, 'پارێزگا پێویستە.'),
  extraAddress: z.string().max(200).optional(),
  note: z.string().max(240).optional(),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export const EmployeeCheckoutPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const navigate = useNavigate();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const syncCatalog = useCartStore((state) => state.syncCatalog);
  const [orderMode, setOrderMode] = useState<OrderMode>(() => getEmployeeCheckoutDefaultMode(session));

  const { data, loading, error } = useLiveQuery<{
    settings: AppSettings | null;
    menuItems: MenuItem[];
  }>(
    async () => {
      const [settings, menuItems] = await Promise.all([getAppSettings(), getMenuItems()]);
      return { settings, menuItems };
    },
    {
      settings: null as AppSettings | null,
      menuItems: [],
    },
    ['settings-changed', 'menu-changed', 'catalog-changed', 'reset-performed'],
  );

  useEffect(() => {
    if (loading || error) {
      return;
    }

    syncCatalog(data.menuItems);
  }, [data.menuItems, error, loading, syncCatalog]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      mobileNumber: '',
      province: '',
      extraAddress: '',
      note: '',
    },
  });

  const mobileRegister = register('mobileNumber', {
    setValueAs: (value) => String(value ?? '').replace(/\D+/g, ''),
  });

  useEffect(() => {
    if (session && items.length === 0 && !isSubmitting) {
      navigate('/employee/cart', { replace: true });
    }
  }, [isSubmitting, items.length, navigate, session]);

  useEffect(() => {
    setOrderMode(getEmployeeCheckoutDefaultMode(session));
  }, [session]);

  if (!session) {
    return null;
  }

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const isDeliveryMode = orderMode === 'delivery';

  const onSubmit = handleSubmit(async (values) => {
    try {
      const commonPayload = {
        ...values,
        mobileNumber: values.mobileNumber.replace(/\D+/g, ''),
        extraAddress: values.extraAddress ?? '',
        note: values.note ?? '',
        specialRequests: '',
        items,
        subtotal: total,
        total,
        createdByRole: session.role,
        createdByName: session.displayName,
      };

      const order = isDeliveryMode
        ? await createDeliveryOrder(commonPayload, { settings: data.settings })
        : await createOrder(commonPayload);
      clear();
      showToast(
        order.offlineState === 'queued'
          ? isDeliveryMode
            ? 'داواکاریی گەیاندن لە ئامێرەکەت هەڵگیرا. کاتێک هێڵی ئینتەرنێت گەڕایەوە خۆکارانە دەنێردرێت.'
            : 'داواکارییەکە لە ئامێرەکەت هەڵگیرا. کاتێک هێڵی ئینتەرنێت گەڕایەوە خۆکارانە دەنێردرێت.'
          : isDeliveryMode
            ? 'داواکاریی گەیاندن بە سەرکەوتوویی نێردرا.'
            : 'داواکارییەکە بە سەرکەوتوویی نێردرا.',
        order.offlineState === 'queued' ? 'info' : 'success',
      );
      navigate(isDeliveryMode ? '/employee/delivery-orders' : '/employee/orders', { replace: true });
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    }
  });

  return (
    <EmployeeShell>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.92fr)]">
        <Card className={`space-y-5 ${isDeliveryMode ? 'border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-cyan-50/70' : ''}`}>
          <div className="flex flex-nowrap items-center justify-between gap-3" dir="ltr">
            <div className="flex shrink-0 items-center gap-2" dir="rtl">
              {([
                { value: 'travel', label: 'سەفەری' },
                { value: 'delivery', label: 'گەیاندن' },
              ] as const).map((mode) => {
                const isActive = orderMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    className={cn(
                      'rounded-2xl border px-4 py-2.5 text-sm font-black transition sm:px-[1.1rem] sm:py-2.5 sm:text-[0.95rem]',
                      isActive
                        ? mode.value === 'delivery'
                          ? 'border-sky-700 bg-sky-700 text-white shadow-card'
                          : 'border-brand-700 bg-brand-700 text-white shadow-card'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50',
                    )}
                    onClick={() => setOrderMode(mode.value)}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <div className="min-w-0 text-right" dir="rtl">
              <h2 className="truncate text-[1.28rem] font-black leading-tight text-stone-900 sm:text-[1.45rem]">
                تەواوکردنی داواکاری
              </h2>
            </div>
          </div>

          {loading ? (
            <LoadingBlock />
          ) : error || !data.settings ? (
            <EmptyState title="هەڵە لە بارکردنی ڕێکخستن" description={error ?? 'ڕێکخستنەکان نەدۆزرایەوە.'} />
          ) : (
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-stone-700">
                  <span>ناوی کڕیار</span>
                  <Input placeholder="بۆ نموونە: کەیوان" {...register('customerName')} />
                  {errors.customerName ? <p className="text-xs text-rose-600">{errors.customerName.message}</p> : null}
                </label>

                <label className="space-y-2 text-sm font-semibold text-stone-700">
                  <span>ژمارەی مۆبایل</span>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    pattern="[0-9]*"
                    dir="ltr"
                    lang="en"
                    placeholder="07510322374"
                    {...mobileRegister}
                    onInput={(event) => {
                      const target = event.currentTarget;
                      target.value = target.value.replace(/\D+/g, '').slice(0, 15);
                    }}
                  />
                  {isDeliveryMode ? (
                    <p className="text-xs font-normal leading-6 text-stone-500">
                      لە 9:00ی بەیانی تا 12:00ی شەو، هەمان ژمارەی مۆبایل
                      <br />
                      تەنها یەک جار بۆ گەیاندن قبوڵ دەکرێت.
                    </p>
                  ) : null}
                  {errors.mobileNumber ? <p className="text-xs text-rose-600">{errors.mobileNumber.message}</p> : null}
                </label>
              </div>

              <label className="space-y-2 text-sm font-semibold text-stone-700">
                <span>پارێزگا، شار یان ناوچە</span>
                <Input
                  list="province-list"
                  placeholder="بۆ نموونە: هەولێر، سلێمانی، دهۆک، بغدا، بەسرە..."
                  {...register('province')}
                />
                <datalist id="province-list">
                  {data.settings.provinceOptions.map((province) => (
                    <option key={province} value={province} />
                  ))}
                </datalist>
                {errors.province ? <p className="text-xs text-rose-600">{errors.province.message}</p> : null}
              </label>

              <label className="space-y-2 text-sm font-semibold text-stone-700">
                <span>وردەکاریی ناونیشان</span>
                <Textarea className="min-h-[58px] resize-none" placeholder="گەڕەک، نزیكترین نیشانە، شوێنی نزیک..." {...register('extraAddress')} />
              </label>

              <label className="space-y-2 text-sm font-semibold text-stone-700">
                <span>تێبینی</span>
                <Textarea className="min-h-[58px] resize-none" placeholder="هەر تێبینییەکی پێویست..." {...register('note')} />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => navigate('/employee/cart')}>
                  پاشگەزبوونەوە
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || items.length === 0}
                  className={isDeliveryMode ? 'bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-300 disabled:bg-sky-300' : ''}
                >
                  {isSubmitting ? 'چاوەڕێبە...' : 'ناردنی داواکاری'}
                </Button>
              </div>
            </form>
          )}
        </Card>

        <div className="space-y-6 xl:sticky xl:top-28 xl:self-start">
          <Card className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-stone-900">پوختەی داواکاری</h2>
            </div>

            {items.length === 0 ? (
              <EmptyState title="سەبەت بەتاڵە" description="بگەڕێرەوە بۆ سەبەتەی کڕین و بابەت زیاد بکە." />
            ) : (
              <>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-3xl bg-stone-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <FoodImage
                            image={item.image}
                            name={item.name}
                            className={`h-16 w-16 rounded-3xl ${isDeliveryMode ? 'bg-sky-50' : 'bg-brand-50'}`}
                            fallbackClassName="text-3xl"
                          />
                          <div>
                            <p className="font-black text-stone-900">{item.name}</p>
                            <p className="mt-1 text-sm text-stone-500">چەند دانە: {item.quantity}</p>
                          </div>
                        </div>
                        <p className={`text-sm font-black ${isDeliveryMode ? 'text-sky-800' : 'text-brand-800'}`}>{formatCurrency(item.lineTotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`rounded-3xl p-4 text-sm ${isDeliveryMode ? 'bg-sky-50' : 'bg-brand-50'}`}>
                  <div className="flex items-center justify-between text-stone-600">
                    <span>ژمارەی بابەت</span>
                    <span>{itemCount}</span>
                  </div>
                  <div className={`mt-2 flex items-center justify-between text-lg font-black ${isDeliveryMode ? 'text-sky-900' : 'text-brand-900'}`}>
                    <span>کۆی گشتی</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </section>
    </EmployeeShell>
  );
};
