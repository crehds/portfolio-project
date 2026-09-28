import { describe, expect, it } from 'vitest';

import { isYearMonth, parseYearMonth, yearMonthToIndex } from './year-month';

describe('isYearMonth', () => {
  it('accepts a valid YYYY-MM value', () => {
    expect(isYearMonth('2023-01')).toBe(true);
    expect(isYearMonth('2023-12')).toBe(true);
  });

  it('rejects an out-of-range month', () => {
    expect(isYearMonth('2023-00')).toBe(false);
    expect(isYearMonth('2023-13')).toBe(false);
  });

  it('rejects a value missing zero-padding', () => {
    expect(isYearMonth('2023-1')).toBe(false);
  });

  it('rejects a non-date string', () => {
    expect(isYearMonth('not-a-date')).toBe(false);
  });
});

describe('parseYearMonth', () => {
  it('parses the year and month from a valid value', () => {
    expect(parseYearMonth('2023-05')).toEqual({ year: 2023, month: 5 });
  });

  it('throws for an invalid value', () => {
    expect(() => parseYearMonth('2023-13')).toThrow();
  });
});

describe('yearMonthToIndex', () => {
  it('orders months across a year boundary', () => {
    const dec2022 = yearMonthToIndex({ year: 2022, month: 12 });
    const jan2023 = yearMonthToIndex({ year: 2023, month: 1 });

    expect(jan2023).toBe(dec2022 + 1);
  });

  it('is consistent with a Date-derived index for the same month', () => {
    const now = new Date(Date.UTC(2023, 0, 15)); // January 2023
    const fromNow = now.getUTCFullYear() * 12 + now.getUTCMonth();

    expect(yearMonthToIndex({ year: 2023, month: 1 })).toBe(fromNow);
  });
});
