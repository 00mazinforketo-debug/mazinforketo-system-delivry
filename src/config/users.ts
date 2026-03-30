import type { KnownUser, UserRole } from '../types/models';

interface LocalUserSeed extends KnownUser {
  pin: string;
}

export const AUTH_USERS: LocalUserSeed[] = [
  { role: 'employee', displayName: 'بەهرە', pin: '2000' },
  { role: 'employee', displayName: 'ڕاژان', pin: '9889' },
  { role: 'captain', displayName: 'یوسف', pin: '4321' },
  { role: 'admin', displayName: 'ڕێگا', pin: '9900' },
];

export const ROLE_DISPLAY_HINTS: Array<Pick<KnownUser, 'displayName'> & { role: UserRole }> = AUTH_USERS.map(
  ({ role, displayName }) => ({ role, displayName }),
);
