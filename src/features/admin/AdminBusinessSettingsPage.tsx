import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Settings2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { useLiveQuery } from '../../hooks/use-live-query';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { AppSettings } from '../../types/models';
import { getAppSettings, updateAppSettings } from '../settings/settings-service';

const settingsSchema = z.object({
  businessName: z.string().min(2, 'ناوی بازرگانی پێویستە.'),
  provinceOptionsText: z.string().min(2, 'لانیکەم یەک پارێزگا بنووسە.'),
  supportNote: z.string().min(4, 'تێبینیی پشتگیری پێویستە.'),
  deliveryMobileBlockEnabled: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export const AdminBusinessSettingsPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const { data, loading, error, reload } = useLiveQuery<AppSettings | null>(
    async () => getAppSettings(),
    null,
    ['settings-changed', 'reset-performed'],
    { pollIntervalMs: 0, backgroundPollIntervalMs: 0 },
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: '',
      provinceOptionsText: '',
      supportNote: '',
      deliveryMobileBlockEnabled: true,
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (isDirty) {
      return;
    }

    reset({
      businessName: data.businessName,
      provinceOptionsText: data.provinceOptions.join('\n'),
      supportNote: data.supportNote,
      deliveryMobileBlockEnabled: data.deliveryMobileBlockEnabled,
    });
  }, [data, isDirty, reset]);

  const [businessName, provinceOptionsText, supportNote, deliveryMobileBlockEnabled] = useWatch({
    control,
    name: ['businessName', 'provinceOptionsText', 'supportNote', 'deliveryMobileBlockEnabled'],
  });
  const safeBusinessName = businessName ?? '';
  const safeProvinceOptionsText = provinceOptionsText ?? '';
  const safeSupportNote = supportNote ?? '';
  const safeDeliveryMobileBlockEnabled = deliveryMobileBlockEnabled ?? true;
  const provincePreview = safeProvinceOptionsText
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await updateAppSettings(
        {
          businessName: values.businessName.trim(),
          provinceOptions: values.provinceOptionsText
            .split(/\n|,/)
            .map((value) => value.trim())
            .filter(Boolean),
          supportNote: values.supportNote.trim(),
          deliveryMobileBlockEnabled: values.deliveryMobileBlockEnabled,
        },
        actor,
      );

      reset({
        businessName: updated.businessName,
        provinceOptionsText: updated.provinceOptions.join('\n'),
        supportNote: updated.supportNote,
        deliveryMobileBlockEnabled: updated.deliveryMobileBlockEnabled,
      });
      await reload();
      showToast('ڕێکخستنی بزنس پاشەکەوتکرا.', 'success');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
    }
  });

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="بزنس"
        icon={Settings2}
        title="ڕێکخستنی بزنس و ناوچەکان"
        description="ناوی بازرگانی، لیستی پارێزگا و ناوچەکان، و تێبینی پشتگیری لێرە دەستکاریکراو و پاشەکەوت دەکرێن."
      />

      {loading ? (
        <LoadingBlock />
      ) : error || !data ? (
        <EmptyState title="هەڵە لە بارکردنی settings" description={error ?? 'داتا نەدۆزرایەوە.'} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <Card className="space-y-5">
            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-2 text-sm font-semibold text-stone-700">
                <span>ناوی بازرگانی</span>
                <Input placeholder="وەک: ڕێستورانتی مەزن فۆڕ کیتۆ" {...register('businessName')} />
                <p className="text-xs text-stone-500">ناوی نوێی بزنس لێرە بنووسە. پاش پاشەکەوتکردن، لە ناو سیستەمەکە نوێ دەبێتەوە.</p>
                {errors.businessName ? <p className="text-xs text-rose-600">{errors.businessName.message}</p> : null}
              </label>

              <label className="block space-y-2 text-sm font-semibold text-stone-700">
                <span>لیستی پارێزگا و ناوچەکان</span>
                <Textarea className="min-h-[180px]" placeholder={'هەر ناوچەیەک لە هێڵێکی جیاواز بنووسە'} {...register('provinceOptionsText')} />
                <p className="text-xs text-stone-500">بۆ زیادکردنی ناوچەی نوێ، لە هێڵێکی جیاواز بنووسە یان بە کۆما لە یەکتر جیا بکە.</p>
                {errors.provinceOptionsText ? <p className="text-xs text-rose-600">{errors.provinceOptionsText.message}</p> : null}
              </label>

              <label className="block space-y-2 text-sm font-semibold text-stone-700">
                <span>تێبینی پشتگیری</span>
                <Textarea className="min-h-[160px]" placeholder="تێبینییەکی نوێ بۆ پشتگیری بنووسە..." {...register('supportNote')} />
                <p className="text-xs text-stone-500">ئەم تێبینییە لە شوێنە پەیوەندیدارەکاندا نیشان دەدرێت، بۆیە بە شێوەی ڕوون و کورتی بنووسە.</p>
                {errors.supportNote ? <p className="text-xs text-rose-600">{errors.supportNote.message}</p> : null}
              </label>

              <label className="flex items-start justify-between gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-black text-stone-900">بلۆککردنی ژمارەی مۆبایل بۆ گەیاندن</p>
                  <p className="text-sm leading-7 text-stone-600">
                    کاتێک چالاک بێت، هەمان ژمارەی مۆبایل تەنها یەک جار بۆ گەیاندن قبوڵ دەکرێت.
                    کاتێک ناچالاک بکرێت، ئەو سنوورە لابردراوە.
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-3 rounded-full bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm">
                  <input type="checkbox" className="h-5 w-5 accent-brand-700" {...register('deliveryMobileBlockEnabled')} />
                  <span>{safeDeliveryMobileBlockEnabled ? 'چالاکە' : 'ناچالاکە'}</span>
                </span>
              </label>

              <Button type="submit" icon={<Save className="h-4 w-4" />} disabled={isSubmitting}>
                {isSubmitting ? 'چاوەڕێبە...' : 'پاشەکەوتکردن'}
              </Button>
            </form>
          </Card>

          <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/40">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">پێشبینین</p>
              <h3 className="mt-2 text-2xl font-black text-stone-900">گۆڕانکارییە ئێستاکان</h3>
              <p className="mt-2 text-sm leading-7 text-stone-600">پاش پاشەکەوتکردن، ئەم زانیارییانە وەک ڕێکخستنی نوێ نیشان دەدرێن.</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.6rem] border border-stone-200 bg-white/95 p-4 shadow-sm">
                <p className="text-xs font-semibold text-stone-500">ناوی بازرگانی</p>
                <p className="mt-2 text-lg font-black text-stone-900">{safeBusinessName.trim() || 'بێ ناو'}</p>
              </div>

              <div className="rounded-[1.6rem] border border-stone-200 bg-white/95 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-stone-500">پارێزگا و ناوچەکان</p>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{provincePreview.length} ناوچە</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {provincePreview.length > 0 ? (
                    provincePreview.map((province) => (
                      <span key={province} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
                        {province}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">هێشتا هیچ ناوچەیەک نەنوسراوە.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-stone-200 bg-white/95 p-4 shadow-sm">
                <p className="text-xs font-semibold text-stone-500">تێبینی پشتگیری</p>
                <p className="mt-2 text-sm leading-7 text-stone-700">{safeSupportNote.trim() || 'هێشتا هیچ تێبینییەک نەنوسراوە.'}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
