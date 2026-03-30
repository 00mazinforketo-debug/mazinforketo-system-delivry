import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { isFirestoreImageToken, readMenuImageFromFirestoreToken } from '../../lib/firebase-firestore';
import { isMenuImageSource } from '../../lib/menu-image';

interface FoodImageProps {
  image?: string | null;
  name?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

export const FoodImage = ({
  image,
  name,
  className,
  imageClassName,
  fallbackClassName,
}: FoodImageProps) => {
  const [firestoreSource, setFirestoreSource] = useState<{
    dataUrl: string | null;
    token: string | null;
  }>({
    dataUrl: null,
    token: null,
  });
  const directSource = isMenuImageSource(image) ? image : null;
  const firestoreToken = isFirestoreImageToken(image) ? image : null;

  useEffect(() => {
    let active = true;

    if (firestoreToken) {
      void readMenuImageFromFirestoreToken(firestoreToken)
        .then((dataUrl) => {
          if (active) {
            setFirestoreSource({
              dataUrl,
              token: firestoreToken,
            });
          }
        })
        .catch(() => {
          if (active) {
            setFirestoreSource({
              dataUrl: null,
              token: firestoreToken,
            });
          }
        });
    }

    return () => {
      active = false;
    };
  }, [firestoreToken]);

  const resolvedSource = directSource ?? (firestoreToken && firestoreSource.token === firestoreToken ? firestoreSource.dataUrl : null);
  const fallbackValue = firestoreToken ? '🍽️' : image || '🍽️';

  return (
    <div className={cn('overflow-hidden', className)}>
      {resolvedSource ? (
        <img
          src={resolvedSource}
          alt={name ? `وێنەی ${name}` : 'وێنەی خواردن'}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center bg-white/80 text-center text-[2.25rem] leading-none shadow-inner',
            fallbackClassName,
          )}
          aria-label={name ? `هێمای ${name}` : 'هێمای خواردن'}
        >
          {fallbackValue}
        </div>
      )}
    </div>
  );
};
