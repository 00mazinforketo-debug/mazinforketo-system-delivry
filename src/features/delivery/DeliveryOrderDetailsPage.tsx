import { ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { NavItem } from '../../components/shared/DashboardShell';
import { DashboardShell } from '../../components/shared/DashboardShell';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingBlock } from '../../components/ui/LoadingBlock';
import { useLiveQuery } from '../../hooks/use-live-query';
import { useSessionStore } from '../../stores/session-store';
import { CaptainShell } from '../captain/CaptainShell';
import { getDeliveryOrderById } from './delivery-service';
import { EmployeeShell } from '../employee/EmployeeShell';
import { OrderDetailsPanel } from '../orders/OrderDetailsPanel';

interface DeliveryOrderDetailsPageProps {
  navItems?: NavItem[];
  utilityItems?: NavItem[];
  shellTitle: string;
}

export const DeliveryOrderDetailsPage = ({ navItems, utilityItems, shellTitle }: DeliveryOrderDetailsPageProps) => {
  const session = useSessionStore((state) => state.session);
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: order, loading, error } = useLiveQuery(
    async () => (id ? getDeliveryOrderById(id) : Promise.resolve(undefined)),
    undefined,
    ['delivery-order-created', 'delivery-order-updated', 'reset-performed'],
    { pollIntervalMs: 8000, backgroundPollIntervalMs: 15000 },
  );

  if (!session) {
    return null;
  }

  const content = loading ? (
    <LoadingBlock />
  ) : error ? (
    <EmptyState title="هەڵە لە بارکردن" description={error} />
  ) : !order ? (
    <EmptyState title="داواکاریی گەیاندن نەدۆزرایەوە" description="ڕەنگە سڕابێتەوە یان ناسنامەکە هەڵە بێت." />
  ) : (
    <OrderDetailsPanel
      order={order}
      backAction={
        session.role === 'employee' ? (
          <Button
            variant="secondary"
            className="rounded-2xl bg-gradient-to-b from-white to-stone-100 px-3 py-2 text-xs font-black text-stone-700 shadow-[0_8px_18px_rgba(28,25,23,0.12)] hover:from-stone-50 hover:to-stone-200"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => navigate(-1)}
          >
            گەڕانەوە
          </Button>
        ) : null
      }
      showPrint={session.role !== 'captain'}
      captainView={session.role === 'captain'}
      simplifiedStatus={session.role === 'captain'}
      mode="delivery"
    />
  );

  if (session.role === 'employee') {
    return <EmployeeShell>{content}</EmployeeShell>;
  }

  if (session.role === 'captain') {
    return (
      <CaptainShell>
        <div className="space-y-3">
          <Button
            variant="secondary"
            className="rounded-[1.2rem] border border-stone-200 bg-white/95 px-3 py-2 text-[13px] font-black text-stone-700 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.25)] hover:bg-stone-50"
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate('/captain/orders')}
          >
            گەڕانەوە بۆ داواکاریەکان
          </Button>
          {content}
        </div>
      </CaptainShell>
    );
  }

  return (
    <DashboardShell title={shellTitle} subtitle="بینینی وردەکاریی گەیاندن" navItems={navItems} utilityItems={utilityItems}>
      {content}
    </DashboardShell>
  );
};
