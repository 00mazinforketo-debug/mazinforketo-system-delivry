import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/session-store';
import { Card } from '../components/ui/Card';

export const AppBootstrap = ({ children }: { children: ReactNode }) => {
  const hydrate = useSessionStore((state) => state.hydrate);
  const ready = useSessionStore((state) => state.ready);
  const [error, setError] = useState<string | null>(null);
  const [minimumDelayComplete, setMinimumDelayComplete] = useState(false);

  useEffect(() => {
    const boot = async () => {
      try {
        await hydrate();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'ناتوانرێت ئەپەکە ئامادە بکرێت.');
      }
    };

    void boot();
  }, [hydrate]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setMinimumDelayComplete(true);
    }, 2000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-4">
        <Card className="max-w-lg space-y-3 text-center">
          <h1 className="text-2xl font-black text-stone-900">هەڵەی ئامادەکردنی ئەپ</h1>
          <p className="text-sm leading-7 text-stone-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!ready || !minimumDelayComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand p-4">
        <Card className="max-w-lg space-y-3 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
          <h1 className="text-2xl font-black text-stone-900">پشکینینی سیستەم</h1>
          <p className="text-sm leading-7 text-stone-600">
            چاوەڕێ بکە ئێستا سیستەم چێک دەکرێتەوە لە هەبوونی هەر کێشەیێک پەیوەندیمان پێ بکەن لە پەیجی دەربارە
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
