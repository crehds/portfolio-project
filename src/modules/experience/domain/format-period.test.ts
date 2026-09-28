import { describe, expect, it } from 'vitest';

import { formatPeriod } from './format-period';

// Assert against Node's real ICU output rather than a hardcoded literal: Spanish
// short-month abbreviations may include a trailing dot depending on the ICU data
// bundled with the Node runtime.
function icuMonthYear(locale: string, year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

describe('formatPeriod', () => {
  it('formats an English period with "Present" for an ongoing role', () => {
    const expected = `${icuMonthYear('en', 2023, 1)} – Present`;

    expect(formatPeriod('2023-01', null, 'en')).toBe(expected);
  });

  it('formats an English period with a closed end date', () => {
    const expected = `${icuMonthYear('en', 2023, 1)} – ${icuMonthYear('en', 2024, 6)}`;

    expect(formatPeriod('2023-01', '2024-06', 'en')).toBe(expected);
  });

  it('formats a Spanish period with "Actualidad" for an ongoing role', () => {
    const expected = `${icuMonthYear('es', 2023, 1)} – Actualidad`;

    expect(formatPeriod('2023-01', null, 'es')).toBe(expected);
  });

  it('formats a Spanish period with a closed end date', () => {
    const expected = `${icuMonthYear('es', 2023, 1)} – ${icuMonthYear('es', 2024, 6)}`;

    expect(formatPeriod('2023-01', '2024-06', 'es')).toBe(expected);
  });
});
