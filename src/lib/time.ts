/**
 * Timestamp handling for the veto-core wire formats.
 *
 * The backend is inconsistent: JPA entities (SessionEntity, AgentPatternEntity)
 * serialize Instant fields as fractional epoch SECONDS (Jackson's default
 * WRITE_DATES_AS_TIMESTAMPS), while hand-built Map responses (auth status,
 * tasks, veto) carry ISO-8601 strings. Parse both.
 */
export function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14:32" today, "Aug 8" otherwise; falls back to the raw value for unparseable input. */
export function formatTimestamp(value: string | number | null | undefined): string {
  const date = toDate(value);
  if (date === null) {
    return typeof value === 'string' ? value : '—';
  }
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Full locale date-time for detail views. */
export function formatFullTimestamp(value: string | number | null | undefined): string {
  const date = toDate(value);
  if (date === null) {
    return typeof value === 'string' ? value : '—';
  }
  return date.toLocaleString();
}
