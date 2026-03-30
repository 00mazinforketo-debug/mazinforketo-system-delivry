import { ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { getRoleLabel } from '../../lib/format';
import type { Session } from '../../types/models';

export const RoleIdentity = ({ session }: { session: Session }) => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge className="border-brand-200 bg-brand-50 text-brand-800">
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>{getRoleLabel(session.role)}</span>
    </Badge>
    <Badge>{session.displayName}</Badge>
  </div>
);
