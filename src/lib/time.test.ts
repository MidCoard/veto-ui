import { describe, it, expect } from 'vitest';
import { toDate, formatTimestamp, formatFullTimestamp } from './time';

describe('toDate', () => {
  it('parses fractional epoch seconds (JPA entity wire format)', () => {
    // 1785506065.3236 epoch seconds — what SessionEntity.createdAt actually sends.
    const date = toDate(1785506065.3236);
    expect(date).not.toBeNull();
    // Date stores integer milliseconds.
    expect(date?.getTime()).toBe(Math.floor(1785506065.3236 * 1000));
  });

  it('parses ISO-8601 strings (Map response wire format)', () => {
    const date = toDate('2026-08-10T10:50:28.302209700Z');
    expect(date).not.toBeNull();
    expect(date?.getUTCFullYear()).toBe(2026);
  });

  it('returns null for null/undefined/garbage', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('not a date')).toBeNull();
  });
});

describe('formatTimestamp', () => {
  it('renders an em dash for missing values', () => {
    expect(formatTimestamp(null)).toBe('—');
    expect(formatTimestamp(undefined)).toBe('—');
  });

  it('falls back to the raw string for unparseable input', () => {
    expect(formatTimestamp('garbage')).toBe('garbage');
  });

  it('formats epoch-second input as a real date', () => {
    expect(formatTimestamp(1785506065.3236)).not.toBe('—');
  });
});

describe('formatFullTimestamp', () => {
  it('formats both wire formats', () => {
    expect(formatFullTimestamp(1785506065.3236)).not.toBe('—');
    expect(formatFullTimestamp('2026-08-10T10:50:28Z')).not.toBe('—');
  });
});
