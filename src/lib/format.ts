import { BUSINESS_TIME_ZONE } from '../../shared/business-time';
import type { OrderStatus, UserRole } from '../types/models';

const latinNumberLocale = 'ar-IQ-u-nu-latn';

const latinizeDigits = (value: string) =>
  value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));

const parseDateValue = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value));

const currencyFormatter = new Intl.NumberFormat(latinNumberLocale, {
  style: 'currency',
  currency: 'IQD',
  maximumFractionDigits: 0,
});

const dayFormatter = new Intl.DateTimeFormat(latinNumberLocale, {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: 'short',
});
const weekdayLabelMap: Record<string, string> = {
  Sat: 'شەمە',
  Sun: 'یەک شەم',
  Mon: 'دوو شەم',
  Tue: 'سێ شەم',
  Wed: 'چوارشەم',
  Thu: 'پێنج شەم',
  Fri: 'هەینی',
};

const getDateTimeParts = (value: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(parseDateValue(value));
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    dayPeriod: getPart('dayPeriod').toUpperCase(),
  };
};

const getDateOnlyParts = (value: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const parts = formatter.formatToParts(parseDateValue(value));
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
};

export const formatCurrency = (value: number) => latinizeDigits(currencyFormatter.format(value));

export const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'هێشتا نییە';
  }

  const parts = getDateTimeParts(value);
  return latinizeDigits(`${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`);
};

export const formatDateOnly = (value: string | null) => {
  if (!value) {
    return 'هێشتا نییە';
  }

  const parts = getDateOnlyParts(value);
  return latinizeDigits(`${parts.year}/${parts.month}/${parts.day}`);
};

export const formatTimeOnly = (value: string | null) => {
  if (!value) {
    return 'هێشتا نییە';
  }

  const parts = getDateTimeParts(value);
  return latinizeDigits(`${parts.hour}:${parts.minute} ${parts.dayPeriod}`);
};

export const formatDayLabel = (value: string) => latinizeDigits(dayFormatter.format(parseDateValue(value)));
export const formatWeekdayMonthDay = (value: string) => {
  const weekdayKey = weekdayFormatter.format(parseDateValue(value));
  const parts = getDateOnlyParts(value);
  return latinizeDigits(`${weekdayLabelMap[weekdayKey] ?? weekdayKey} ${parts.month}/${parts.day}`);
};

export const formatNumber = (value: number | string) => latinizeDigits(String(value));

export const formatDurationFromMinutes = (value: number) => {
  const safeValue = Math.max(0, Math.round(value));
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;

  if (hours === 0) {
    return `${formatNumber(minutes)} خولەک`;
  }

  if (minutes === 0) {
    return `${formatNumber(hours)} کاتژمێر`;
  }

  return `${formatNumber(hours)} کاتژمێر و ${formatNumber(minutes)} خولەک`;
};

export const getStatusLabel = (status: OrderStatus) => {
  switch (status) {
    case 'pending_captain':
      return 'لە چاوەڕوانیدایە';
    case 'accepted':
      return 'قبوڵ کراوە';
    case 'completed':
      return 'گەیشتووە';
    case 'cancelled':
      return 'هەڵوەشایەوە';
    default:
      return status;
  }
};

export const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case 'employee':
      return 'کارمەند';
    case 'captain':
      return 'کاپتن';
    case 'admin':
      return 'ئادمین';
    default:
      return role;
  }
};

export const getStatusTone = (status: OrderStatus) => {
  switch (status) {
    case 'pending_captain':
      return 'border-amber-200 bg-amber-100 text-amber-800';
    case 'accepted':
      return 'border-sky-200 bg-sky-100 text-sky-800';
    case 'completed':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'cancelled':
      return 'border-rose-200 bg-rose-100 text-rose-800';
    default:
      return 'border-stone-200 bg-stone-100 text-stone-700';
  }
};
