import type { DeliveryOrder, Order } from '../../types/models';

export interface CaptainDateRangeValue {
  fromDate: string;
  toDate: string;
}

const toDateKey = (timestamp: string) => {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return '';
  }

  return new Date(parsed).toISOString().slice(0, 10);
};

const formatDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
};

export const hasCaptainDateRange = (range: CaptainDateRangeValue) => Boolean(range.fromDate || range.toDate);

export const normalizeCaptainDateRange = (range: CaptainDateRangeValue): CaptainDateRangeValue => {
  if (range.fromDate && range.toDate && range.fromDate > range.toDate) {
    return {
      fromDate: range.toDate,
      toDate: range.fromDate,
    };
  }

  return range;
};

export const isTimestampInCaptainDateRange = (timestamp: string, range: CaptainDateRangeValue) => {
  const normalized = normalizeCaptainDateRange(range);
  if (!normalized.fromDate && !normalized.toDate) {
    return true;
  }

  const dateKey = toDateKey(timestamp);
  if (!dateKey) {
    return false;
  }

  if (normalized.fromDate && dateKey < normalized.fromDate) {
    return false;
  }

  if (normalized.toDate && dateKey > normalized.toDate) {
    return false;
  }

  return true;
};

export const formatCaptainDateRangeLabel = (range: CaptainDateRangeValue) => {
  const normalized = normalizeCaptainDateRange(range);
  if (normalized.fromDate && normalized.toDate) {
    return `لە ${formatDateValue(normalized.fromDate)} هەتا ${formatDateValue(normalized.toDate)}`;
  }

  if (normalized.fromDate) {
    return `لە ${formatDateValue(normalized.fromDate)} بە دواوە`;
  }

  if (normalized.toDate) {
    return `هەتا ${formatDateValue(normalized.toDate)}`;
  }

  return 'هەموو بەروارەکان';
};

export const getCaptainOrderActivityTimestamp = (order: Order | DeliveryOrder) => {
  if (order.status === 'accepted') {
    return order.acceptedAt ?? order.updatedAt ?? order.createdAt;
  }

  if (order.status === 'completed') {
    return order.completedAt ?? order.updatedAt ?? order.createdAt;
  }

  if (order.status === 'cancelled') {
    return order.updatedAt ?? order.createdAt;
  }

  return order.createdAt;
};
