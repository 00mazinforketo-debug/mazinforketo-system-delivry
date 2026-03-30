import { useEffect, useState } from 'react';
import { readPreference, writePreference } from '../lib/storage';

export const usePersistentState = <T>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => readPreference<T>(key, initialValue));

  useEffect(() => {
    writePreference(key, value);
  }, [key, value]);

  return [value, setValue] as const;
};
