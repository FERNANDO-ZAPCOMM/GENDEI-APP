const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Get the current date/time parts in the clinic's timezone.
 */
export function nowInTimezone(timezone?: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  dateString: string;
} {
  const tz = timezone || DEFAULT_TIMEZONE;
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hours = get('hour');
  const minutes = get('minute');

  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, hours, minutes, dateString };
}

/**
 * Convert a Date object to a yyyy-MM-dd string in the clinic's timezone.
 */
export function formatDateInTimezone(date: Date, timezone?: string): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Check if a given Date falls on "today" in the clinic's timezone.
 */
export function isTodayInTimezone(date: Date, timezone?: string): boolean {
  return formatDateInTimezone(date, timezone) === nowInTimezone(timezone).dateString;
}
