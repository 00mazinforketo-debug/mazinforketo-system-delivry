import { apiRequest } from '../../lib/api';
import { clearLastSession, clearSession, readLastSession, readSession, writeSession } from '../../lib/storage';
import type { AuthSessionDto, Session } from '../../types/models';

export const getCurrentSession = async (): Promise<Session | null> => {
  try {
    const response = await apiRequest<AuthSessionDto>('/api/auth/me');
    writeSession(response.session);
    return response.session;
  } catch (error) {
    if (error instanceof Error && 'status' in error && Number((error as { status?: number }).status) === 401) {
      clearSession();
      clearLastSession();
      return null;
    }

    return readSession() ?? readLastSession();
  }
};

export const loginWithPinRequest = async (pin: string): Promise<Session> => {
  const response = await apiRequest<AuthSessionDto>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pin }),
  });
  writeSession(response.session);
  return response.session;
};

export const logoutRequest = async () => {
  await apiRequest<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
};
