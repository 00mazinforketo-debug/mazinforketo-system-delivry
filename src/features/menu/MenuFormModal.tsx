import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FoodImage } from '../../components/shared/FoodImage';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { getMenuImageProviderLabel, isFirebaseFirestoreConfigured, isFirestoreImageToken } from '../../lib/firebase-firestore';
import { prepareMenuImageAsset, type PreparedMenuImageAsset } from '../../lib/menu-image';
import type { Category, MenuItem } from '../../types/models';

const menuSchema = z.object({
  categoryId: z.string().min(1, 'پۆل پێویستە.'),
  name: z.string().min(2, 'ناو پێویستە.'),
  description: z.string().min(5, 'وەسفەکە کەمە.'),
  price: z.coerce.number().positive('نرخ دەبێت زیاتر بێت لە سفر.'),
  image: z.string().min(1, 'وێنەیەک هەڵبژێرە یان هێمایەک بهێڵە.'),
  sortOrder: z.coerce.number().int().positive('ڕیزبەندی پێویستە.'),
  isAvailable: z.enum(['yes', 'no']),
});

type MenuFormValues = z.infer<typeof menuSchema>;

interface MenuFormModalProps {
  open: boolean;
  categories: Category[];
  initialItem?: MenuItem | null;
  onClose: () => void;
  onOpenCategories?: () => void;
  onSubmit: (values: {
    id?: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    image: string;
    imageAsset?: PreparedMenuImageAsset | null;
    clearImageAsset?: boolean;
    sortOrder: number;
    isAvailable: boolean;
  }) => Promise<void>;
}

const formatImageBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

export const MenuFormModal = ({
  open,
  categories,
  initialItem,
  onClose,
  onOpenCategories,
  onSubmit,
}: MenuFormModalProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImageBusy, setImageBusy] = useState(false);
  const [pendingImageAsset, setPendingImageAsset] = useState<PreparedMenuImageAsset | null>(null);
  const [clearImageAsset, setClearImageAsset] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MenuFormValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      categoryId: '',
      name: '',
      description: '',
      price: 0,
      image: '🍽️',
      sortOrder: 1,
      isAvailable: 'yes',
    },
  });

  const currentImage = watch('image');
  const hasCategories = categories.length > 0;
  const imageProviderLabel = getMenuImageProviderLabel();
  const firestoreReady = isFirebaseFirestoreConfigured();
  const uploadTargetLabel = firestoreReady ? imageProviderLabel : 'Cloud Firestore نا ئامادەیە';

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      categoryId: initialItem?.categoryId ?? categories[0]?.id ?? '',
      name: initialItem?.name ?? '',
      description: initialItem?.description ?? '',
      price: initialItem?.price ?? 0,
      image: initialItem?.image ?? '🍽️',
      sortOrder: initialItem?.sortOrder ?? 1,
      isAvailable: initialItem?.isAvailable ? 'yes' : 'no',
    });
    setImageBusy(false);
    setPendingImageAsset(null);
    setClearImageAsset(false);
  }, [categories, initialItem, open, reset]);

  const handleImageSelection = async (file?: File) => {
    if (!file) {
      return;
    }

    setImageBusy(true);
    try {
      const preparedAsset = await prepareMenuImageAsset(file);
      if (preparedAsset) {
        setPendingImageAsset(preparedAsset);
        setClearImageAsset(false);
        setValue('image', preparedAsset.previewDataUrl, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } finally {
      setImageBusy(false);
    }
  };

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      id: initialItem?.id,
      categoryId: values.categoryId,
      name: values.name.trim(),
      description: values.description.trim(),
      price: values.price,
      image: values.image.trim(),
      imageAsset: pendingImageAsset,
      clearImageAsset,
      sortOrder: values.sortOrder,
      isAvailable: values.isAvailable === 'yes',
    });
    onClose();
  });

  return (
    <Modal
      open={open}
      title={initialItem ? 'دەستکاریکردنی خواردن' : 'زیادکردنی خواردنی نوێ'}
      description={`لە موبایل دەتوانیت وێنە لە camera یان gallery هەڵبژێریت، پاشان ناو، نرخ و پۆل دیاری بکەیت. داتای خواردن لە Cloudflare دەپارێزرێت و وێنەکان بە ${imageProviderLabel} پاشەکەوت دەکرێن.`}
      onClose={onClose}
    >
      {!hasCategories ? (
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-dashed border-stone-200 bg-stone-50 p-5 text-center">
            <p className="text-lg font-black text-stone-900">پێش زیادکردنی خواردن پێویستە پۆلێک هەبێت</p>
            <p className="mt-2 text-sm leading-7 text-stone-600">بۆ نموونە پۆلی سەرەکی، گریل، خواردنەوە یان هەر بەشێکی تر دروست بکە، پاشان بگەڕێرەوە بۆ زیادکردنی خواردن.</p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              داخستن
            </Button>
            <Button onClick={onOpenCategories}>چوون بۆ بەڕێوەبردنی پۆلەکان</Button>
          </div>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-stone-50 p-3">
                <FoodImage
                  image={currentImage}
                  name={watch('name') || initialItem?.name || 'خواردن'}
                  className="h-52 w-full rounded-[1.5rem] bg-white"
                  fallbackClassName="text-6xl"
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  void handleImageSelection(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<ImagePlus className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImageBusy}
                >
                  {isImageBusy ? 'ئامادەکردنی وێنە...' : 'هەڵبژاردنی وێنە'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<Camera className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImageBusy}
                >
                  camera / gallery
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-[1.6rem] bg-stone-50 px-4 py-3 text-sm text-stone-600">
                <span>
                  ئەگەر وێنە هەڵنەبژێریت، هێمای بنەڕەتی پیشان دەدرێت.
                  {firestoreReady
                    ? ` وێنەی نوێ ڕاستەوخۆ لە ${imageProviderLabel} دەپارێزرێت.`
                    : ` ${imageProviderLabel} هێشتا ئامادە نییە و ناتوانرێت upload ئەنجام بدرێت.`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-2"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    setValue('image', '🍽️', {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setPendingImageAsset(null);
                    setClearImageAsset(Boolean(initialItem?.imageAssetId || isFirestoreImageToken(initialItem?.image)));
                  }}
                >
                  سڕینەوەی وێنە
                </Button>
              </div>

              {pendingImageAsset ? (
                <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">
                  <p>upload target: {uploadTargetLabel}</p>
                  <p>ناوی فایل: {pendingImageAsset.fileName}</p>
                  <p>mime type: {pendingImageAsset.mimeType}</p>
                  <p>قەبارە: {formatImageBytes(pendingImageAsset.byteSize)}</p>
                  <p>dimensions: {pendingImageAsset.width} × {pendingImageAsset.height}</p>
                </div>
              ) : (initialItem?.imageAssetId || isFirestoreImageToken(initialItem?.image)) && !clearImageAsset ? (
                <div className="rounded-[1.6rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
                  وێنەی ئێستا هەر لە Cloud Firestore دەمێنێتەوە. ئەگەر فایلێکی نوێ هەڵبژێریت، metadata ـی ئەو فایلە لێرە پیشان دەدرێت.
                </div>
              ) : null}

              {errors.image ? <p className="text-xs text-rose-600">{errors.image.message}</p> : null}
            </div>

            <div className="space-y-4">
              <label className="space-y-2 text-sm font-semibold text-stone-700">
                <span>پۆل</span>
                <Select {...register('categoryId')}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                {errors.categoryId ? <p className="text-xs text-rose-600">{errors.categoryId.message}</p> : null}
              </label>

              <label className="space-y-2 text-sm font-semibold text-stone-700">
                <span>ناوی خواردن</span>
                <Input placeholder="بۆ نموونە: کەبابی تایبەت" {...register('name')} />
                {errors.name ? <p className="text-xs text-rose-600">{errors.name.message}</p> : null}
              </label>

              <label className="space-y-2 text-sm font-semibold text-stone-700">
                <span>وەسف</span>
                <Textarea className="min-h-[110px] resize-none" placeholder="پوختەی خواردن، پێکهاتە، یان زانیاریی گرنگ..." {...register('description')} />
                {errors.description ? <p className="text-xs text-rose-600">{errors.description.message}</p> : null}
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm font-semibold text-stone-700">
                  <span>نرخ</span>
                  <Input type="number" min="0" inputMode="decimal" {...register('price')} />
                  {errors.price ? <p className="text-xs text-rose-600">{errors.price.message}</p> : null}
                </label>

                <label className="space-y-2 text-sm font-semibold text-stone-700">
                  <span>ڕیزبەندی</span>
                  <Input type="number" min="1" inputMode="numeric" {...register('sortOrder')} />
                  {errors.sortOrder ? <p className="text-xs text-rose-600">{errors.sortOrder.message}</p> : null}
                </label>

                <label className="space-y-2 text-sm font-semibold text-stone-700">
                  <span>دۆخ</span>
                  <Select {...register('isAvailable')}>
                    <option value="yes">چالاک</option>
                    <option value="no">ناچالاک</option>
                  </Select>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              پاشگەزبوونەوە
            </Button>
            <Button type="submit" disabled={isSubmitting || isImageBusy}>
              {isSubmitting ? 'چاوەڕێبە...' : initialItem ? 'پاشەکەوتکردن' : 'زیادکردن'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};



