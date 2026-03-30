import type { SyncEvent, SyncEventType } from '../types/models';

const CHANNEL_NAME = 'restaurant-ops-sync';
const STORAGE_KEY = 'restaurant-ops:last-sync';
const WINDOW_EVENT = 'restaurant-ops:sync-event';

let channel: BroadcastChannel | null = null;

const getChannel = () => {
  if (!('BroadcastChannel' in window)) {
    return null;
  }

  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }

  return channel;
};

export const publishSyncEvent = (type: SyncEventType, entityId?: string) => {
  const payload: SyncEvent = { type, at: new Date().toISOString(), entityId };
  getChannel()?.postMessage(payload);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent<SyncEvent>(WINDOW_EVENT, { detail: payload }));
};

export const subscribeToSyncEvents = (listener: (event: SyncEvent) => void) => {
  const broadcast = getChannel();

  const handleMessage = (event: MessageEvent<SyncEvent>) => listener(event.data);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      listener(JSON.parse(event.newValue) as SyncEvent);
    } catch {
      return;
    }
  };
  const handleWindowEvent = (event: Event) => {
    listener((event as CustomEvent<SyncEvent>).detail);
  };

  broadcast?.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);
  window.addEventListener(WINDOW_EVENT, handleWindowEvent);

  return () => {
    broadcast?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(WINDOW_EVENT, handleWindowEvent);
  };
};
