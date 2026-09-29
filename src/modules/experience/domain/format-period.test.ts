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

// Independent oracle: unlike the assertions above (which build their expectation from
// the same `Intl.DateTimeFormat` call the implementation uses, so they can't catch a
// bug shared by both call sites), these hardcode what the output should actually read.
describe('formatPeriod literal oracle', () => {
  const DASH = '–'; // en dash, exact separator `formatPeriod` joins labels with.

  it('formats an English period against a hardcoded literal', () => {
    // Verified with `Intl.DateTimeFormat('en', { month: 'short', year: 'numeric',
    // timeZone: 'UTC' })` on Node v24.21.0 (ICU 78.3): stable "MMM YYYY" abbreviations,
    // unlikely to vary by ICU version.
    expect(formatPeriod('2023-01', null, 'en')).toBe(
      `Jan 2023 ${DASH} Present`,
    );
    expect(formatPeriod('2023-01', '2024-06', 'en')).toBe(
      `Jan 2023 ${DASH} Jun 2024`,
    );
  });

  it('formats a Spanish period against a tolerant literal pattern', () => {
    // Observed "ene 2023" / "jun 2024" on Node v24.21.0 (ICU 78.3, no trailing dot),
    // but Spanish short-month abbreviations may gain a trailing dot on other ICU/CLDR
    // versions (see the module comment above `icuMonthYear`), so this stays a regex
    // tolerant to that one variation instead of an exact string.
    expect(formatPeriod('2023-01', null, 'es')).toMatch(
      new RegExp(`^ene\\.? 2023 ${DASH} Actualidad$`, 'i'),
    );
    expect(formatPeriod('2023-01', '2024-06', 'es')).toMatch(
      new RegExp(`^ene\\.? 2023 ${DASH} jun\\.? 2024$`, 'i'),
    );
  });

  // Regression guard for the shared `es-419` tag (see `INTL_LOCALE_TAGS` in
  // `src/shared/i18n/locales.ts`, added by T09b): a region override like `es-PE` adds a
  // trailing dot to every short-month abbreviation ("set. 2023" for September) - unlike
  // `es-419`/bare `es`, which this module already used, so this passes before and after
  // the shared-map refactor; it exists to catch a future accidental switch to a
  // region-specific tag.
  it('formats a Spanish period through September with the neutral abbreviation, not the es-PE regionalism ("set.")', () => {
    expect(formatPeriod('2023-01', '2023-09', 'es')).toMatch(
      new RegExp(`^ene\\.? 2023 ${DASH} sept\\.? 2023$`, 'i'),
    );
  });
});
