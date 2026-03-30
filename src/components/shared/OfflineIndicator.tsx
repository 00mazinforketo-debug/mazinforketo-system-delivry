import { Wifi, WifiOff } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { useOnlineStatus } from '../../hooks/use-online-status';

interface OfflineIndicatorProps {
  iconOnly?: boolean;
}

export const OfflineIndicator = ({ iconOnly = false }: OfflineIndicatorProps) => {
  const isOnline = useOnlineStatus();
  const label = isOnline ? 'ئۆنلاین' : 'ئۆفلاین';

  return (
    <Badge
      aria-label={label}
      title={label}
      className={
        isOnline
          ? `border-emerald-200 bg-emerald-50 text-emerald-800 ${iconOnly ? 'px-2.5 py-2' : ''}`
          : `border-rose-200 bg-rose-50 text-rose-800 ${iconOnly ? 'px-2.5 py-2' : ''}`
      }
    >
      {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {!iconOnly ? <span>{label}</span> : null}
    </Badge>
  );
};
