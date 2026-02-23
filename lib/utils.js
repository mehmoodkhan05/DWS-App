import { format } from 'date-fns';

/**
 * Parse a date-only value (YYYY-MM-DD or ISO string) as a local date.
 */
export function parseDateOnly(dateStr) {
  if (dateStr == null) return null;
  const str = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr.toISOString().split('T')[0];
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a date-only value for display (timezone-safe).
 */
export function formatDateOnly(dateStr, formatStr = 'MMM dd, yyyy') {
  const date = parseDateOnly(dateStr);
  return date ? format(date, formatStr) : '';
}
