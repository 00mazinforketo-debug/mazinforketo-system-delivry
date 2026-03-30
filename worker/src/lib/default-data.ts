import { IRAQ_LOCATION_OPTIONS } from '../../../src/config/locations';
import type { AppSettings, UserRole } from '../../../shared/models';

export interface DefaultUserSeed {
  id: string;
  role: UserRole;
  displayName: string;
  pin: string;
}

export const DEFAULT_USERS: DefaultUserSeed[] = [
  { id: 'user-employee-bahra', role: 'employee', displayName: 'بەهرە', pin: '2000' },
  { id: 'user-employee-razhan', role: 'employee', displayName: 'ڕاژان', pin: '9889' },
  { id: 'user-captain-yusuf', role: 'captain', displayName: 'یوسف', pin: '4321' },
  { id: 'user-admin-main', role: 'admin', displayName: 'ڕێگا', pin: '9900' },
];

export const buildDefaultSettings = (timestamp: string): AppSettings => ({
  id: 'app',
  businessName: 'ڕێستورانتی مەزن فۆڕ کیتۆ',
  provinceOptions: IRAQ_LOCATION_OPTIONS,
  orderSequence: 0,
  seededAt: timestamp,
  lastResetAt: timestamp,
  supportNote: '',
  deliveryMobileBlockEnabled: true,
  hiddenCategoryIds: [],
  hiddenMenuItemIds: [],
  updatedAt: timestamp,
});



