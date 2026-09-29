import { afterEach, describe, expect, it } from 'vitest';

import { formatProjectDate } from './format-project-date';

describe('formatProjectDate', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('formats an english date as a long, unambiguous date', () => {
    expect(formatProjectDate(new Date('2026-09-28'), 'en')).toBe(
      'September 28, 2026',
    );
  });

  it('formats a spanish date with a tolerant pattern (CLDR month spelling can change - e.g. es-PE renders "setiembre")', () => {
    const result = formatProjectDate(new Date('2026-09-23'), 'es');

    expect(result).toMatch(/^23 de \p{L}+\.? de 2026$/u);
  });

  // `z.coerce.date()` parses a bare "YYYY-MM-DD" frontmatter value (e.g. `date:
  // 2026-09-28`) as UTC midnight (per the ECMAScript Date Time String Format), so
  // formatting with the host's local timezone instead of a pinned UTC would silently
  // shift the displayed day for half the world's timezones - including the owner's own
  // "Lima, Peru" (UTC-5), where a naive local-time format renders this exact date as
  // "September 27, 2026" instead of the 28th.
  it('renders the exact calendar day from the frontmatter, not shifted by the host timezone', () => {
    process.env.TZ = 'America/Lima'; // UTC-5: would roll the day back if not pinned to UTC
    expect(formatProjectDate(new Date('2026-09-28'), 'en')).toBe(
      'September 28, 2026',
    );

    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14: would roll the day forward instead
    expect(formatProjectDate(new Date('2026-09-28'), 'en')).toBe(
      'September 28, 2026',
    );
  });
});
