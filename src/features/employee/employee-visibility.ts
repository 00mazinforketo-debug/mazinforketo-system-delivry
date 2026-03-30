import { readPreference, writePreference } from '../../lib/storage';
import { publishSyncEvent } from '../../lib/sync';
import type { Session } from '../../types/models';

type EmployeeVisibilityEntity = 'categories' | 'menuItems';

const getEmployeeVisibilityKey = (entity: EmployeeVisibilityEntity, session: Pick<Session, 'role' | 'displayName'>) =>
  `employee-visibility:${session.role}:${session.displayName}:${entity}`;

const normalizeIds = (value: string[]) => Array.from(new Set(value.filter((entry) => typeof entry === 'string' && entry.length > 0)));

export const getEmployeeHiddenEntityIds = (
  entity: EmployeeVisibilityEntity,
  session: Pick<Session, 'role' | 'displayName'>,
) => readPreference<string[]>(getEmployeeVisibilityKey(entity, session), []);

export const setEmployeeEntityVisibility = (
  entity: EmployeeVisibilityEntity,
  session: Pick<Session, 'role' | 'displayName'>,
  entityId: string,
  isVisible: boolean,
) => {
  const current = getEmployeeHiddenEntityIds(entity, session);
  const next = isVisible ? current.filter((entry) => entry !== entityId) : normalizeIds([...current, entityId]);
  writePreference(getEmployeeVisibilityKey(entity, session), next);
  publishSyncEvent('view-state-changed', entityId);
  return next;
};
