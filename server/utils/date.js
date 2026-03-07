/**
 * Format a date value (Date object or ISO string) as YYYY-MM-DD.
 * Ensures date-only fields are returned without timezone shift.
 * Uses UTC methods to fetch the date regardless of server timezone.
 */
export function toDateOnlyString(val) {
  if (val == null) return null;
  
  // If it's already a string in YYYY-MM-DD format, return it directly
  if (typeof val === 'string') {
    const part = val.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      return part;
    }
    // If it's an ISO string, extract the date part
    return part;
  }
  
  // If it's a Date object, use UTC methods to avoid timezone shift
  // This ensures the date stored in DB (as DATE type) is returned correctly
  // regardless of server timezone
  if (val instanceof Date) {
    // Use UTC methods to fetch date regardless of timezone
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  return val;
}

/**
 * Ensure expense_date is stored as YYYY-MM-DD string for correct date storage.
 */
export function formatExpenseDateForStore(val) {
  return toDateOnlyString(val);
}
