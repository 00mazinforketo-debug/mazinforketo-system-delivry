import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { formatCurrency } from '../../lib/format';
import { createOrder } from '../orders/order-service';
import type { OrderItem, Session } from '../../types/models';

const checkoutSchema = z.object({
  customerName: z.string().min(2, 'ناوی کڕیار پێویستە.'),
  mobileNumber: z.string().regex(/^[0-9]{8,15}$/, 'ژمارەی مۆبایل دەبێت تەنها لە ژمارە پێکبێت.'),
  province: z.string().min(2, 'پارێزگا پێویستە.'),
  extraAddress: z.string().max(200).optional(),
  note: z.string().max(240).optional(),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

interface CheckoutModalProps {
  open: boolean;
  items: OrderItem[];
  total: number;
  provinceOptions: string[];
  session: Session;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

export const CheckoutModal = ({
  open,
  items,
  total,
  provinceOptions,
  session,
  onClose,
  onCreated,
}: CheckoutModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
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
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const order = await createOrder({
      ...values,
      extraAddress: values.extraAddress ?? '',
      note: values.note ?? '',
      specialRequests: '',
      items,
      subtotal: total,
      total,
      createdByRole: session.role,
      createdByName: session.displayName,
    });
    await onCreated();
    if (order.offlineState === 'queued') {
      onClose();
    }
    reset();
  });

  return (
    <Modal
      open={open}
      title="تەواوکردنی داواکاری"
      onClose={onClose}
    >
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
              placeholder="بۆ نموونە: 07510322374"
              {...mobileRegister}
              onInput={(event) => {
                const target = event.currentTarget;
                target.value = target.value.replace(/\D+/g, '');
              }}
            />
            {errors.mobileNumber ? <p className="text-xs text-rose-600">{errors.mobileNumber.message}</p> : null}
          </label>
        </div>

        <label className="space-y-2 text-sm font-semibold text-stone-700">
          <span>پارێزگا، شار یان ناوچە</span>
          <Input
            list="province-list"
            placeholder="بۆ نموونە: هەولێر، ئەنکاوە، سۆران، زاخۆ..."
            {...register('province')}
          />
          <datalist id="province-list">
            {provinceOptions.map((province) => (
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
          <Textarea placeholder="هەر تێبینییەکی پێویست..." className="min-h-[58px] resize-none" {...register('note')} />
        </label>

        <div className="rounded-3xl bg-brand-50 p-4 text-sm">
          <div className="flex items-center justify-between text-stone-600">
            <span>ژمارەی بابەت</span>
            <span>{items.reduce((totalCount, item) => totalCount + item.quantity, 0)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-lg font-black text-brand-900">
            <span>کۆی گشتی</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            پاشگەزبوونەوە
          </Button>
          <Button type="submit" disabled={isSubmitting || items.length === 0}>
            {isSubmitting ? 'چاوەڕێبە...' : 'ناردنی داواکاری'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

