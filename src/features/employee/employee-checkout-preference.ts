import { readPreference, writePreference } from '../../lib/storage';
import type { OrderMode, Session } from '../../types/models';

const buildPreferenceKey = (session: Session) => `employee-checkout-default-mode:${session.userId}`;

export const getEmployeeCheckoutDefaultMode = (session: Session | null | undefined): OrderMode => {
  if (!session) {
    return 'travel';
  }

  return readPreference<OrderMode>(buildPreferenceKey(session), 'travel');
};

export const setEmployeeCheckoutDefaultMode = (session: Session, mode: OrderMode) => {
  writePreference(buildPreferenceKey(session), mode);
};
