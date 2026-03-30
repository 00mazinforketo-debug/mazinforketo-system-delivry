import { ImageOff, Images, Link2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { FoodImage } from '../../components/shared/FoodImage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import { detachMediaAsset, getMediaAssetUsage } from '../media/media-service';

export const AdminMediaPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, loading, error, reload } = useLiveQuery(
    async () => getMediaAssetUsage(),
    [],
    ['media-changed', 'menu-changed', 'catalog-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const actor = { role: session.role, displayName: session.displayName } as const;
  const deletingAsset = data.find((entry) => entry.asset.id === deletingId) ?? null;
  const totalSizeMb = (data.reduce((sum, entry) => sum + entry.asset.byteSize, 0) / (1024 * 1024)).toFixed(1);
  const linkedCount = data.filter((entry) => entry.usageCount > 0).length;
  const heroStats = [
    { label: 'کۆی asset', value: data.length },
    { label: 'asset ـی بەستراو', value: linkedCount },
    { label: 'قەبارەی هەڵگیراو', value: `${totalSizeMb} MB` },
  ] as const;

  return (
    <div className="space-y-6">
      <AdminHeroCard
        eyebrow="Media Assets"
        icon={Images}
        title="بەڕێوەبردنی وێنە هەڵگیراوەکان"
        description="ئەم بەشە وێنەکانی upload کراوی خواردنەکان بە شێوەی logical folder پیشان دەدات."
        stats={heroStats}
        actions={
          <>
            <Link to="/admin/menu" className="inline-flex items-center gap-2 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
              <Images className="h-4 w-4" />
              <span>گەڕانەوە بۆ menu</span>
            </Link>
            <Link to="/admin/settings/storage" className="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
              <Link2 className="h-4 w-4" />
              <span>storage overview</span>
            </Link>
          </>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <EmptyState title="هەڵە لە بارکردنی media assets" description={error} />
      ) : data.length === 0 ? (
        <EmptyState
          title="هێشتا هیچ وێنەیەک هەڵنەگیراوە"
          description="کاتێک لە admin/menu خواردن بە وێنە upload بکەیت، asset ـەکان لێرە دەردەکەون."
          action={
            <Link
              to="/admin/menu"
              className="inline-flex items-center rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              چوون بۆ menu
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((entry) => (
            <Card key={entry.asset.id} className="space-y-4">
              <FoodImage
                image={entry.asset.previewDataUrl}
                name={entry.asset.fileName}
                className="h-52 rounded-[1.8rem] bg-stone-50"
                fallbackClassName="text-5xl"
              />

              <div className="space-y-2">
                <p className="line-clamp-1 text-lg font-black text-stone-900">{entry.asset.fileName}</p>
                <p className="text-sm text-stone-500">
                  {entry.asset.width > 0 && entry.asset.height > 0
                    ? `${entry.asset.width} × ${entry.asset.height}`
                    : 'svg / unknown size'}
                </p>
              </div>

              <div className="rounded-3xl bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                <p>mime: {entry.asset.mimeType}</p>
                <p>size: {(entry.asset.byteSize / 1024).toFixed(0)} KB</p>
                <p>usage: {entry.usageCount}</p>
                <p className="line-clamp-1">
                  linked: {entry.linkedItems.map((item) => item.name).join('، ') || 'هیچ خواردنێک بەستراو نییە'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                  {entry.usageCount > 0 ? <Link2 className="h-3.5 w-3.5" /> : <ImageOff className="h-3.5 w-3.5" />}
                  <span>{entry.usageCount > 0 ? 'بەستراو' : 'ئازاد'}</span>
                </div>
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeletingId(entry.asset.id)}>
                  سڕینەوە
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingAsset)}
        title="سڕینەوەی media asset"
        description={`دڵنیایت لە سڕینەوەی "${deletingAsset?.asset.fileName ?? ''}"؟ ئەگەر بە خواردنێک بەستراو بێت، پەیوەندیی asset ـەکە لادەبرێت و خواردنەکە بۆ وێنەی بنەڕەتی دەگەڕێتەوە.`}
        confirmLabel="سڕینەوە"
        tone="danger"
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (!deletingAsset) {
            return;
          }

          void (async () => {
            try {
              await detachMediaAsset(deletingAsset.asset.id, actor);
              setDeletingId(null);
              await reload();
              showToast('media asset سڕایەوە.', 'success');
            } catch (caughtError) {
              showToast(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.', 'error');
            }
          })();
        }}
      />
    </div>
  );
};
