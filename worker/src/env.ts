import type { Session, UserRole } from '../../shared/models';

export interface AppBindings {
  DB: D1Database;
  MENU_ASSETS: R2Bucket;
  ASSETS: Fetcher;
  APP_ENV: string;
  APP_ORIGIN: string;
  COOKIE_NAME: string;
  SESSION_TTL_DAYS: string;
  PIN_PEPPER: string;
}

export interface AuthUser extends Session {
  sessionId: string;
  expiresAt: string;
}

export interface AppVariables {
  authUser: AuthUser | null;
}

export type RoleRequirement = UserRole | UserRole[];
