import { useEffect } from 'react';
import { useToastStore } from '../../stores/toast-store';
import { cn } from '../../lib/cn';

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-stone-200 bg-white text-stone-900',
};

export const ToastViewport = () => {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const timers = items.map((item) =>
      window.setTimeout(() => {
        dismiss(item.id);
      }, 3200),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismiss, items]);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-3 md:left-auto md:w-[360px]">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto rounded-3xl border px-4 py-3 shadow-card backdrop-blur-sm',
            toneClasses[item.tone ?? 'info'],
          )}
        >
          <p className="text-sm font-semibold">{item.title}</p>
        </div>
      ))}
    </div>
  );
};
