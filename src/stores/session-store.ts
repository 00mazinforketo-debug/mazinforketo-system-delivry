import { create } from 'zustand';
import { getCurrentSession, loginWithPinRequest, logoutRequest } from '../features/auth/auth-service';
import { clearLastSession, clearPreferences, clearSession, clearAllSessions } from '../lib/storage';
import type { Session } from '../types/models';

interface SessionState {
  session: Session | null;
  ready: boolean;
  hydrate: () => Promise<void>;
  loginWithPin: (pin: string) => Promise<Session>;
  logout: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  ready: false,
  hydrate: async () => {
    const session = await getCurrentSession();
    set({ session, ready: true });
  },
  loginWithPin: async (pin: string) => {
    const session = await loginWithPinRequest(pin);
    set({ session });
    return session;
  },
  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      clearSession();
      clearLastSession();
      clearAllSessions();
      clearPreferences();
      set({ session: null });
    }
  },
}));
