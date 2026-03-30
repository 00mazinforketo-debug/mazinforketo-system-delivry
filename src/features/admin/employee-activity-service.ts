import { apiRequest } from '../../lib/api';
import type { EmployeeActivityReport } from '../../types/models';

export type {
  EmployeeActivityDaySummary,
  EmployeeActivitySummary,
  EmployeeActivityReport,
} from '../../types/models';

export const getEmployeeActivityReport = async (): Promise<EmployeeActivityReport> =>
  apiRequest<EmployeeActivityReport>('/api/analytics/employee-activity', {
    localCache: { ttlMs: 15_000 },
  });
