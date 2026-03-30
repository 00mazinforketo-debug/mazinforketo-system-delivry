import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { Category } from '../../types/models';

const categorySchema = z.object({
  name: z.string().min(2, 'ناوی پۆل پێویستە.'),
  sortOrder: z.coerce.number().int().positive('ڕیزبەندی پێویستە.'),
});

type CategoryValues = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  open: boolean;
  initialCategory?: Category | null;
  onClose: () => void;
  onSubmit: (values: { id?: string; name: string; sortOrder: number }) => Promise<void>;
}

export const CategoryFormModal = ({
  open,
  initialCategory,
  onClose,
  onSubmit,
}: CategoryFormModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      sortOrder: 1,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      name: initialCategory?.name ?? '',
      sortOrder: initialCategory?.sortOrder ?? 1,
    });
  }, [initialCategory, open, reset]);

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      id: initialCategory?.id,
      name: values.name,
      sortOrder: values.sortOrder,
    });
    onClose();
  });

  return (
    <Modal
      open={open}
      title={initialCategory ? 'دەستکاریکردنی پۆل' : 'زیادکردنی پۆلی نوێ'}
      description="پۆلەکانی مێنیو لێرە ڕێکبخە."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <label className="space-y-2 text-sm font-semibold text-stone-700">
          <span>ناوی پۆل</span>
          <Input {...register('name')} />
          {errors.name ? <p className="text-xs text-rose-600">{errors.name.message}</p> : null}
        </label>

        <label className="space-y-2 text-sm font-semibold text-stone-700">
          <span>ڕیزبەندی</span>
          <Input type="number" min="1" {...register('sortOrder')} />
          {errors.sortOrder ? <p className="text-xs text-rose-600">{errors.sortOrder.message}</p> : null}
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            پاشگەزبوونەوە
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'چاوەڕێبە...' : initialCategory ? 'پاشەکەوتکردن' : 'زیادکردن'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
