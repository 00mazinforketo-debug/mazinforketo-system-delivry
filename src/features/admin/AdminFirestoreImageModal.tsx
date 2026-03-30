import { Camera, ImagePlus, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FoodImage } from '../../components/shared/FoodImage';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { getMissingFirebaseConfigKeys, isFirebaseFirestoreConfigured } from '../../lib/firebase-firestore';
import { prepareMenuImageAsset, type PreparedMenuImageAsset } from '../../lib/menu-image';
import type { MenuItem } from '../../types/models';

interface AdminFirestoreImageModalProps {
  open: boolean;
  menuItem: MenuItem | null;
  categoryName: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (draft: PreparedMenuImageAsset) => Promise<void>;
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

export const AdminFirestoreImageModal = ({
  open,
  menuItem,
  categoryName,
  busy,
  onClose,
  onSubmit,
}: AdminFirestoreImageModalProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<PreparedMenuImageAsset | null>(null);
  const [isPreparing, setPreparing] = useState(false);
  const firestoreReady = isFirebaseFirestoreConfigured();
  const missingKeys = getMissingFirebaseConfigKeys();

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedImage(null);
    setPreparing(false);
  }, [open, menuItem?.id]);

  const handleFileSelection = async (file?: File) => {
    if (!file) {
      return;
    }

    setPreparing(true);
    try {
      const preparedAsset = await prepareMenuImageAsset(file);
      setSelectedImage(preparedAsset);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Modal
      open={open}
      title={menuItem ? `وێنە بۆ ${menuItem.name}` : 'uploadی وێنە'}
      description="ئەم modal ـە وێنەکە لە Cloud Firestore وەک document هەڵدەگرێت و token ـەکەی لە Cloudflare بۆ خواردنەکە پاشەکەوت دەکات."
      onClose={onClose}
    >
      {!menuItem ? null : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-stone-50 p-3">
                <FoodImage
                  image={selectedImage?.previewDataUrl ?? menuItem.image}
                  name={menuItem.name}
                  className="h-56 w-full rounded-[1.5rem] bg-white"
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
                  void handleFileSelection(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<ImagePlus className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPreparing || busy || !firestoreReady}
                >
                  {isPreparing ? 'ئامادەکردنی وێنە...' : 'هەڵبژاردنی وێنە'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<Camera className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPreparing || busy || !firestoreReady}
                >
                  camera / gallery
                </Button>
              </div>

              {selectedImage ? (
                <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">
                  <p>upload target: Cloud Firestore</p>
                  <p>ناوی فایل: {selectedImage.fileName}</p>
                  <p>mime type: {selectedImage.mimeType}</p>
                  <p>قەبارە: {formatImageBytes(selectedImage.byteSize)}</p>
                  <p>dimensions: {selectedImage.width} × {selectedImage.height}</p>
                </div>
              ) : (
                <div className="rounded-[1.6rem] border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
                  وێنەیەک هەڵبژێرە تا preview و metadata ـەکە دەرکەوێت، پاشان upload بکە.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.6rem] bg-stone-50 p-4 text-sm leading-7 text-stone-600">
                <p>ناو: {menuItem.name}</p>
                <p>پۆل: {categoryName || 'بێ پۆل'}</p>
                <p>نرخ: {menuItem.price}</p>
                <p>ڕیز: {menuItem.sortOrder}</p>
                <p>وەسف: {menuItem.description}</p>
              </div>

              {firestoreReady ? (
                <div className="rounded-[1.6rem] border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-7 text-brand-900">
                  وێنەکە لە Cloud Firestore هەڵدەگیرێت، دواتر token ـەکە بۆ ئەم خواردنە لە Cloudflare پاشەکەوت دەکرێت.
                </div>
              ) : (
                <div className="rounded-[1.6rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-800">
                  Cloud Firestore هێشتا ئامادە نییە. ئەم env ـانە پڕ بکە لە `.env.local`:
                  <p className="mt-2 font-semibold">{missingKeys.join('، ')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              پاشگەزبوونەوە
            </Button>
            <Button
              icon={<UploadCloud className="h-4 w-4" />}
              onClick={() => {
                if (!selectedImage) {
                  return;
                }

                void onSubmit(selectedImage);
              }}
              disabled={!selectedImage || !firestoreReady || isPreparing || busy}
            >
              {busy ? 'چاوەڕێبە...' : 'upload و پاشەکەوتکردن'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
