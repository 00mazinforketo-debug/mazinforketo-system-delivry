import type { UserRole } from '../../types/models';

export const getRoleHomePath = (role: UserRole) => {
  switch (role) {
    case 'employee':
      return '/employee';
    case 'captain':
      return '/captain';
    case 'admin':
      return '/admin';
    default:
      return '/login';
  }
};
