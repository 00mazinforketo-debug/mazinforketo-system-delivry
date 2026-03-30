import { openAppDb } from '../../lib/db';
import { createId } from '../../lib/id';
import type { ActivityLog, Actor } from '../../types/models';

export const addActivityLog = async (type: string, message: string, actor: Actor) => {
  const db = await openAppDb();
  const log: ActivityLog = {
    id: createId('log'),
    type,
    message,
    actorRole: actor.role,
    actorName: actor.displayName,
    createdAt: new Date().toISOString(),
  };

  await db.put('activityLogs', log);
  return log;
};

export const getActivityLogs = async (limit?: number) => {
  const db = await openAppDb();
  const logs = await db.getAllFromIndex('activityLogs', 'by-createdAt');
  const sorted = [...logs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
};
