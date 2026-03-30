import { useEffect, useRef } from 'react';
import { flushOfflineDeliveryOrders } from '../features/delivery/delivery-service';
import { flushOfflineOrders } from '../features/orders/order-service';
import { useSessionStore } from '../stores/session-store';
import { useToastStore } from '../stores/toast-store';

export const OfflineSyncBootstrap = () => {
  const session = useSessionStore((state) => state.session);
  const showToast = useToastStore((state) => state.show);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let disposed = false;

    const runSync = async (announceSuccess: boolean) => {
      if (disposed || syncingRef.current || !navigator.onLine) {
        return;
      }

      syncingRef.current = true;
      try {
        const [travelResult, deliveryResult] = await Promise.all([flushOfflineOrders(), flushOfflineDeliveryOrders()]);
        if (!disposed && announceSuccess) {
          if (travelResult.syncedCount > 0) {
            showToast(`داواکارییە هەڵگیراوەکانی سەفەری sync کرانەوە: ${travelResult.syncedCount}`, 'success');
          }

          if (deliveryResult.syncedCount > 0) {
            showToast(`داواکارییە هەڵگیراوەکانی گەیاندن sync کرانەوە: ${deliveryResult.syncedCount}`, 'success');
          }
        }
      } finally {
        syncingRef.current = false;
      }
    };

    void runSync(false);

    const handleOnline = () => {
      void runSync(true);
    };
    const handleFocus = () => {
      void runSync(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runSync(false);
      }
    };

    const timerId = window.setInterval(() => {
      void runSync(false);
    }, 15000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timerId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, showToast]);

  return null;
};
