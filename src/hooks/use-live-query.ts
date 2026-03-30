import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToSyncEvents } from '../lib/sync';
import type { SyncEventType } from '../types/models';

interface QueryState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

interface LiveQueryOptions {
  pollIntervalMs?: number;
  backgroundPollIntervalMs?: number;
}

export const useLiveQuery = <T>(
  loader: () => Promise<T>,
  initialData: T,
  syncTypes?: SyncEventType[],
  options?: LiveQueryOptions,
): QueryState<T> => {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  const syncTypesRef = useRef(syncTypes);
  const optionsRef = useRef(options);
  const hasResolvedRef = useRef(false);
  const inFlightReloadRef = useRef<Promise<void> | null>(null);
  const queuedReloadRef = useRef(false);
  const scheduledReloadRef = useRef<number | null>(null);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    syncTypesRef.current = syncTypes;
  }, [syncTypes]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const syncKey = syncTypes?.join(',') ?? 'all';

  const runReload = useCallback(async () => {
    if (inFlightReloadRef.current) {
      queuedReloadRef.current = true;
      return inFlightReloadRef.current;
    }

    const shouldShowLoading = !hasResolvedRef.current;
    if (shouldShowLoading) {
      setLoading(true);
      setError(null);
    }

    const reloadPromise = (async () => {
      try {
        const result = await loaderRef.current();
        hasResolvedRef.current = true;
        setData(result);
        setError(null);
      } catch (caughtError) {
        if (!hasResolvedRef.current) {
          setError(caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.');
        }
      } finally {
        setLoading(false);
      }
    })();

    inFlightReloadRef.current = reloadPromise;

    try {
      await reloadPromise;
    } finally {
      inFlightReloadRef.current = null;

      if (queuedReloadRef.current) {
        queuedReloadRef.current = false;
        void runReload();
      }
    }
  }, []);

  const scheduleReload = useCallback(
    (delayMs = 120) => {
      if (scheduledReloadRef.current !== null) {
        window.clearTimeout(scheduledReloadRef.current);
      }

      scheduledReloadRef.current = window.setTimeout(() => {
        scheduledReloadRef.current = null;
        void runReload();
      }, delayMs);
    },
    [runReload],
  );

  const reload = useCallback(async () => runReload(), [runReload]);

  useEffect(() => {
    void runReload();
    const unsubscribe = subscribeToSyncEvents((event) => {
      if (!syncTypesRef.current || syncTypesRef.current.includes(event.type)) {
        scheduleReload();
      }
    });

    const handleFocus = () => {
      scheduleReload(80);
    };

    let timerId: number | undefined;
    const scheduleNextPoll = () => {
      const pollInterval =
        document.visibilityState === 'visible'
          ? optionsRef.current?.pollIntervalMs ?? 15000
          : optionsRef.current?.backgroundPollIntervalMs ?? optionsRef.current?.pollIntervalMs ?? 30000;

      if (!pollInterval || pollInterval <= 0) {
        return;
      }

      timerId = window.setTimeout(async () => {
        await runReload();
        scheduleNextPoll();
      }, pollInterval);
    };

    const handleVisibilityChange = () => {
      if (timerId) {
        window.clearTimeout(timerId);
      }

      if (document.visibilityState === 'visible') {
        scheduleReload(80);
      }

      scheduleNextPoll();
    };

    scheduleNextPoll();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      if (scheduledReloadRef.current !== null) {
        window.clearTimeout(scheduledReloadRef.current);
      }
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [runReload, scheduleReload, syncKey]);

  return { data, loading, error, reload };
};
