import { AlertCircle, ArrowLeft, CircleHelp, Delete, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoleHomePath } from './auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SUPPORT_LABEL, SUPPORT_URL } from '../../config/support';
import { useSessionStore } from '../../stores/session-store';

const keypadValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export const LoginPage = () => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const loginWithPin = useSessionStore((state) => state.loginWithPin);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) {
      navigate(getRoleHomePath(session.role), { replace: true });
    }
  }, [navigate, session]);

  const submitPin = useCallback(async () => {
    if (pin.length !== 4) {
      setError('PIN دەبێت 4 ژمارە بێت.');
      return;
    }

    try {
      const activeSession = await loginWithPin(pin);
      setError('');
      navigate(getRoleHomePath(activeSession.role), { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'PIN هەڵەیە. تکایە دووبارە هەوڵبدە.');
      setPin('');
    }
  }, [loginWithPin, navigate, pin]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        setPin((current) => (current.length >= 4 ? current : `${current}${event.key}`));
      } else if (event.key === 'Backspace') {
        setPin((current) => current.slice(0, -1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void submitPin();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [submitPin]);

  const handleKeypad = (value: (typeof keypadValues)[number]) => {
    setError('');

    if (value === 'clear') {
      setPin('');
      return;
    }

    if (value === 'back') {
      setPin((current) => current.slice(0, -1));
      return;
    }

    setPin((current) => (current.length >= 4 ? current : `${current}${value}`));
  };

  const statusTone = error
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : pin.length === 4
      ? 'border-brand-200 bg-brand-50 text-brand-900'
      : 'border-stone-200 bg-white/90 text-stone-600';

  return (
    <div className="min-h-screen bg-sand bg-grain p-4 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
          <div className="w-full max-w-xl space-y-4">
            <div className={`sticky top-4 z-10 min-h-[5.75rem] rounded-4xl border p-4 shadow-card backdrop-blur-md ${statusTone}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">دۆخی چوونەژوورەوە</p>
              <div className="mt-2 min-h-[2.25rem]">
                {error ? (
                  <p className="text-sm font-bold">{error}</p>
                ) : pin.length === 4 ? (
                  <p className="text-sm font-bold">PIN ئامادەی ناردنە. کلیک لە چوونەژوورەوە بکە.</p>
                ) : null}
              </div>
            </div>

            <Card className="overflow-hidden border-white/80 p-6 sm:p-8">
              <div className="space-y-6">
                <div className="space-y-3 text-center">
                  <h1 className="text-3xl font-black leading-tight text-stone-900 sm:text-4xl">بەخێر بێیت کارمەندی زیرەک</h1>
                  <p className="mx-auto max-w-lg text-sm leading-7 text-stone-600 sm:text-base">
                    بۆ چوونە ژوورەوە سەرەتا دەبێت لای ئادمێن خۆت تۆمار بکەیت دواتر ڕێگات پێ دەدرێت چوونە ژوورەوە بکەیت
                  </p>
                  <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">PIN</p>
                </div>

                <div className="grid grid-cols-4 gap-3" dir="ltr">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`pin-slot-${index + 1}`}
                      className="flex h-16 items-center justify-center rounded-3xl border border-stone-200 bg-stone-50 text-2xl font-black text-brand-800 [font-variant-numeric:tabular-nums]"
                    >
                      {pin[index] ? '•' : ''}
                    </div>
                  ))}
                </div>

                {error ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="grid grid-cols-3 gap-3" dir="ltr">
                  {keypadValues.map((value) => (
                    <button
                      key={value}
                      className="rounded-3xl border border-stone-200 bg-white px-4 py-5 text-lg font-bold text-stone-900 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 [font-variant-numeric:tabular-nums]"
                      onClick={() => handleKeypad(value)}
                    >
                      {value === 'clear' ? 'پاک' : value === 'back' ? <Delete className="mx-auto h-5 w-5" /> : <span lang="en">{value}</span>}
                    </button>
                  ))}
                </div>

                <Button block icon={<ArrowLeft className="h-4 w-4" />} onClick={() => void submitPin()}>
                  چوونەژوورەوە
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <header className="rounded-4xl border border-white/80 bg-white/90 p-4 shadow-card backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-50 text-brand-700 shadow-inner">
                <CircleHelp className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-stone-900">دەربارە</p>
                <p className="text-sm leading-7 text-stone-600">
                  بۆ زانیاریی زیاتر دەربارەی دروستکردنی ئەپڵیکەیشن، سیستەم و وێب ئەپ، تکایە کلیک لە
                  <span className="mx-1 font-black text-brand-800">{SUPPORT_LABEL}</span>
                  بکە.
                </p>
              </div>
            </div>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{SUPPORT_LABEL}</span>
            </a>
          </div>
        </header>
      </div>
    </div>
  );
};
