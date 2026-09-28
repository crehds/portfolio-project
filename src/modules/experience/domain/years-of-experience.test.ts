import { describe, expect, it } from 'vitest';

import { yearsOfExperience } from './years-of-experience';

describe('yearsOfExperience', () => {
  it('returns 0 for no entries', () => {
    expect(yearsOfExperience([])).toBe(0);
  });

  it('counts a single closed period in whole years, rounded down', () => {
    // 2020-01 .. 2021-12 inclusive = 24 months.
    const entries = [{ start: '2020-01', end: '2021-12' }];

    expect(yearsOfExperience(entries)).toBe(2);
  });

  it('merges overlapping periods instead of double-counting the overlap', () => {
    // A: 2020-01..2021-06 (18mo), B: 2021-01..2022-01 (13mo), overlap Jan-Jun 2021.
    // Merged coverage is 2020-01..2022-01 inclusive = 25 months.
    const entries = [
      { start: '2020-01', end: '2021-06' },
      { start: '2021-01', end: '2022-01' },
    ];

    expect(yearsOfExperience(entries)).toBe(2);
  });

  it('does not count the gap between non-overlapping periods', () => {
    // 6 months + 6 months, with an 18-month unemployment gap in between.
    const entries = [
      { start: '2018-01', end: '2018-06' },
      { start: '2020-01', end: '2020-06' },
    ];

    expect(yearsOfExperience(entries)).toBe(1);
  });

  it('treats a null end as ongoing through the given "now"', () => {
    const now = new Date(Date.UTC(2024, 5, 15)); // 2024-06-15
    const entries = [{ start: '2022-06', end: null }];

    expect(yearsOfExperience(entries, now)).toBe(2);
  });

  it('defaults "now" to the current date when not provided', () => {
    const entries = [{ start: '2020-01', end: null }];

    expect(yearsOfExperience(entries)).toBeGreaterThan(0);
  });
});
