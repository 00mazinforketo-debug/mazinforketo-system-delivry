import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../lib/cn';
import { useSessionStore } from '../../stores/session-store';
import { useToastStore } from '../../stores/toast-store';
import type { OrderMode } from '../../types/models';
import { EmployeeShell } from './EmployeeShell';
import { getEmployeeCheckoutDefaultMode, setEmployeeCheckoutDefaultMode } from './employee-checkout-preference';

const checkoutModeOptions: Array<{ value: OrderMode; label: string }> = [
  { value: 'travel', label: 'سەفەری' },
  { value: 'delivery', label: 'گەیاندن' },
];

export const EmployeeCheckoutSettingsPage = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<OrderMode>(() => getEmployeeCheckoutDefaultMode(session));

  useEffect(() => {
    setSelectedMode(getEmployeeCheckoutDefaultMode(session));
  }, [session]);

  if (!session) {
    return null;
  }

  return (
    <EmployeeShell>
      <section className="mx-auto max-w-3xl space-y-6">
        <Card className="space-y-6 border-stone-200 bg-white/95">
          <div className="flex justify-end">
            <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/employee/settings')}>
              گەڕانەوە
            </Button>
          </div>

          <div className="space-y-5">
            <h1 className="text-center text-2xl font-black text-stone-900">جۆری ناردن هەڵبژێرە</h1>

            <div className="grid gap-3 sm:grid-cols-2">
              {checkoutModeOptions.map((option) => {
                const isActive = selectedMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'rounded-[1.8rem] border px-4 py-5 text-base font-black transition',
                      isActive
                        ? 'border-brand-700 bg-brand-700 text-white shadow-card'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-brand-200 hover:bg-brand-50',
                    )}
                    onClick={() => setSelectedMode(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <Button
              block
              onClick={() => {
                setEmployeeCheckoutDefaultMode(session, selectedMode);
                showToast('ڕێخستنەکە پاشەکەوت کرا.', 'success');
                navigate('/employee/settings');
              }}
            >
              پاشەکەوتکردن
            </Button>
          </div>
        </Card>
      </section>
    </EmployeeShell>
  );
};
