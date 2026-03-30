import { Bell, BellDot } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/use-live-query';
import { cn } from '../../lib/cn';
import { useSessionStore } from '../../stores/session-store';
import { getUnreadDeliveryNotificationCountForSession } from '../delivery/delivery-notification-service';
import { getUnreadCountForSession } from './notification-service';

interface NotificationBellProps {
  to: string;
  buttonClassName?: string;
  title?: string;
}

export const NotificationBell = ({ to, buttonClassName, title = 'ئاگەدارکردنەوەکان' }: NotificationBellProps) => {
  const session = useSessionStore((state) => state.session);

  const { data: unreadCount } = useLiveQuery(
    async () => {
      if (!session) {
        return 0;
      }

      const [travelUnread, deliveryUnread] = await Promise.all([
        getUnreadCountForSession(session),
        getUnreadDeliveryNotificationCountForSession(session).catch(() => 0),
      ]);
      return travelUnread + deliveryUnread;
    },
    0,
    ['notification-changed', 'delivery-notification-changed', 'view-state-changed', 'reset-performed'],
  );

  if (!session) {
    return null;
  }

  const BellIcon = unreadCount > 0 ? BellDot : Bell;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative inline-flex h-12 w-12 items-center justify-center rounded-2xl transition',
          isActive ? 'bg-brand-700 text-white shadow-card' : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
          buttonClassName,
        )
      }
      title={title}
      aria-label={title}
    >
      <BellIcon className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-black text-white shadow-card">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </NavLink>
  );
};
