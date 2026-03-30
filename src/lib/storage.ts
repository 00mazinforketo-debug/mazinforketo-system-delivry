import type { Session } from '../types/models';

const LAST_SESSION_KEY = 'restaurant-ops:last-session';
const SESSION_PREFIX = 'restaurant-ops:session:';
const PREF_PREFIX = 'restaurant-ops:pref:';
const TAB_ID_KEY = 'restaurant-ops:tab-id';

const safeParse = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const getTabId = () => {
  const existing = window.sessionStorage.getItem(TAB_ID_KEY);
  if (existing) {
    return existing;
  }

  const tabId = `tab_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(TAB_ID_KEY, tabId);
  return tabId;
};

const getSessionKey = () => `${SESSION_PREFIX}${getTabId()}`;

export const readSession = () => safeParse<Session>(window.localStorage.getItem(getSessionKey()));

export const writeSession = (session: Session) => {
  const serialized = JSON.stringify(session);
  window.localStorage.setItem(getSessionKey(), serialized);
  window.localStorage.setItem(LAST_SESSION_KEY, serialized);
};

export const clearSession = () => {
  window.localStorage.removeItem(getSessionKey());
};

export const clearAllSessions = () => {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(SESSION_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
};

export const readLastSession = () => safeParse<Session>(window.localStorage.getItem(LAST_SESSION_KEY));

export const clearLastSession = () => {
  window.localStorage.removeItem(LAST_SESSION_KEY);
};

export const readPreference = <T>(key: string, fallback: T) =>
  safeParse<T>(window.localStorage.getItem(`${PREF_PREFIX}${key}`)) ?? fallback;

export const writePreference = <T>(key: string, value: T) => {
  window.localStorage.setItem(`${PREF_PREFIX}${key}`, JSON.stringify(value));
};

export const clearPreferences = () => {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(PREF_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
};

export const clearPreferencesByPrefix = (prefix: string) => {
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(`${PREF_PREFIX}${prefix}`))
    .forEach((key) => window.localStorage.removeItem(key));
};
