export const BUSINESS_TIME_ZONE = 'Asia/Baghdad';

const getDateValue = (value: string | Date) => (value instanceof Date ? value : new Date(value));

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const getBusinessDayKey = (value: string | Date, timeZone = BUSINESS_TIME_ZONE) => {
  if (timeZone === BUSINESS_TIME_ZONE) {
    return dayKeyFormatter.format(getDateValue(value));
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(getDateValue(value));
};

const dateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export const getBusinessDateTimeParts = (value: string | Date, timeZone = BUSINESS_TIME_ZONE) => {
  const date = getDateValue(value);
  const formatter =
    timeZone === BUSINESS_TIME_ZONE
      ? dateTimePartsFormatter
      : new Intl.DateTimeFormat('en-CA', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dayKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour ?? '0'),
    minute: Number(values.minute ?? '0'),
    second: Number(values.second ?? '0'),
  };
};

export const isDeliveryMobileBlockWindowActive = (value: string | Date, timeZone = BUSINESS_TIME_ZONE) =>
  getBusinessDateTimeParts(value, timeZone).hour >= 9;
