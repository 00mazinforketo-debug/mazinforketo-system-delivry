import { apiRequest } from '../../lib/api';
import type { ReportsSummaryDto } from '../../types/models';

export const getReportsSummary = async (): Promise<ReportsSummaryDto> =>
  apiRequest<ReportsSummaryDto>('/api/reports/summary', {
    localCache: { ttlMs: 15_000 },
  });
