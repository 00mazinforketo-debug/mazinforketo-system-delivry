import { readPreference, writePreference } from './storage';
import { publishSyncEvent } from './sync';
import type { Session } from '../types/models';

type ViewEntity = 'orders' | 'deliveryOrders' | 'notifications' | 'deliveryNotifications';

const getViewStateKey = (entity: ViewEntity, session: Pick<Session, 'role' | 'displayName'>) =>
  `hidden-${entity}:${session.role}:${session.displayName}`;

const normalizeIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

export const getHiddenEntityIds = (
  entity: ViewEntity,
  session: Pick<Session, 'role' | 'displayName'>,
) => readPreference<string[]>(getViewStateKey(entity, session), []);

export const appendHiddenEntityIds = (
  entity: ViewEntity,
  session: Pick<Session, 'role' | 'displayName'>,
  ids: string[],
) => {
  const current = getHiddenEntityIds(entity, session);
  writePreference(getViewStateKey(entity, session), normalizeIds([...current, ...ids]));
  publishSyncEvent('view-state-changed');
};

export const clearHiddenEntityIds = (
  entity: ViewEntity,
  session: Pick<Session, 'role' | 'displayName'>,
) => {
  writePreference(getViewStateKey(entity, session), []);
  publishSyncEvent('view-state-changed');
};
