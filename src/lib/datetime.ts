/**
 * Format a date for display without timezone shifts.
 * All display uses en-US locale formatting on the ISO string directly.
 */

export function formatDate(startTime: string): string {
  return new Date(startTime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateLong(startTime: string): string {
  return new Date(startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export function formatDateTime(startTime: string): string {
  return new Date(startTime).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Convert a date + time string (from a datetime-local or separate date/time inputs)
 * into an ISO string. The inputs are treated as local time.
 */
export function combineDateAndTime(dateStr: string, timeStr: string): string {
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return dt.toISOString();
}

/**
 * Check if a date string is in the past
 */
export function isPastDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  return date < today;
}
