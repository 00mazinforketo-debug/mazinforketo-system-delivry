import { Badge } from './Badge';
import { getStatusLabel, getStatusTone } from '../../lib/format';
import type { OrderStatus } from '../../types/models';

export const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge className={getStatusTone(status)}>{getStatusLabel(status)}</Badge>
);
