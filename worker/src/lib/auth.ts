import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import type { UserRole } from '../../../shared/models';
import type { AppBindings, AppVariables, AuthUser, RoleRequirement } from '../env';
import { createOpaqueToken, hashPin, hashSessionToken } from './crypto';
import { ensureCoreData } from './data';

type AppContext = Context<{ Bindings: AppBindings; Variables: AppVariables }>;

const SESSION_LOOKUP_SQL = `
SELECT
  sessions.id AS sessionId,
  sessions.created_at AS createdAt,
  sessions.expires_at AS expiresAt,
  sessions.last_seen_at AS lastSeenAt,
  users.id AS userId,
  users.role AS role,
  users.display_name AS displayName
FROM sessions
INNER JOIN users ON users.id = sessions.user_id
WHERE sessions.token_hash = ? AND users.is_active = 1
LIMIT 1
`;

const parseDays = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? '30', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
};

const addDays = (source: Date, days: number) => {
  const next = new Date(source);
  next.setDate(next.getDate() + days);
  return next;
};

const isHttpsUrl = (value?: string | null) => {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const secureCookie = (c: AppContext) => {
  if (isHttpsUrl(c.req.url)) {
    return true;
  }

  if (c.req.url.startsWith('http://')) {
    return false;
  }

  return c.env.APP_ENV === 'production' && isHttpsUrl(c.env.APP_ORIGIN);
};

export const authOptional: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> = async (c, next) => {
  const authUser = await readAuthUser(c);
  c.set('authUser', authUser);
  await next();
};

export const readAuthUser = async (c: AppContext): Promise<AuthUser | null> => {
  const rawToken = getCookie(c, c.env.COOKIE_NAME);
  if (!rawToken) {
    return null;
  }

  const tokenHash = await hashSessionToken(rawToken, c.env.PIN_PEPPER);
  const row = await c.env.DB.prepare(SESSION_LOOKUP_SQL).bind(tokenHash).first<{
    sessionId: string;
    createdAt: string;
    expiresAt: string;
    lastSeenAt: string;
    userId: string;
    role: UserRole;
    displayName: string;
  }>();

  if (!row) {
    return null;
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(row.sessionId).run();
    deleteCookie(c, c.env.COOKIE_NAME, { path: '/' });
    return null;
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.sessionId).run();

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    role: row.role,
    displayName: row.displayName,
    loginAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
};

export const requireAuth = (c: AppContext) => {
  const authUser = c.get('authUser');
  if (!authUser) {
    throw new HTTPException(401, { message: 'تکایە سەرەتا بچۆ ژوورەوە.' });
  }

  return authUser;
};

export const requireRole = (c: AppContext, required: RoleRequirement) => {
  const authUser = requireAuth(c);
  const roles = Array.isArray(required) ? required : [required];
  if (!roles.includes(authUser.role)) {
    throw new HTTPException(403, { message: 'ڕێگەت پێنەدراوە بۆ ئەم بەشە.' });
  }

  return authUser;
};

export const createSessionForPin = async (c: AppContext, pin: string) => {
  await ensureCoreData(c.env);
  const pinHash = await hashPin(pin, c.env.PIN_PEPPER);
  const user = await c.env.DB
    .prepare(
      `
      SELECT id AS userId, role, display_name AS displayName
      FROM users
      WHERE pin_hash = ? AND is_active = 1
      LIMIT 1
      `,
    )
    .bind(pinHash)
    .first<{ userId: string; role: UserRole; displayName: string }>();

  if (!user) {
    throw new HTTPException(401, { message: 'PIN هەڵەیە. تکایە دووبارە هەوڵبدە.' });
  }

  const token = createOpaqueToken();
  const tokenHash = await hashSessionToken(token, c.env.PIN_PEPPER);
  const now = new Date();
  const expiresAt = addDays(now, parseDays(c.env.SESSION_TTL_DAYS)).toISOString();
  const sessionId = crypto.randomUUID();

  await c.env.DB
    .prepare(
      `
      INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(sessionId, user.userId, tokenHash, expiresAt, now.toISOString(), now.toISOString())
    .run();

  setCookie(c, c.env.COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: secureCookie(c),
    expires: new Date(expiresAt),
  });

  return {
    sessionId,
    userId: user.userId,
    role: user.role,
    displayName: user.displayName,
    loginAt: now.toISOString(),
    expiresAt,
  } satisfies AuthUser;
};

export const clearAuthSession = async (c: AppContext) => {
  const rawToken = getCookie(c, c.env.COOKIE_NAME);
  if (rawToken) {
    const tokenHash = await hashSessionToken(rawToken, c.env.PIN_PEPPER);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  deleteCookie(c, c.env.COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookie(c),
  });
};

export const cleanupExpiredSessions = async (env: AppBindings) => {
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
};

