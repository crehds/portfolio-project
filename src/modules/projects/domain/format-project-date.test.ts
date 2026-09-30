import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatProjectDate } from './format-project-date';

describe('formatProjectDate', () => {
  // `vi.unstubAllEnvs` restores TZ exactly, deleting it when it was unset. Assigning a
  // saved `undefined` back instead stores the string "undefined", an unknown zone that
  // behaves as UTC and would hide a missing UTC pin from the later tests on a non-UTC host.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('formats an english date as a long, unambiguous date', () => {
    expect(formatProjectDate(new Date('2026-09-28'), 'en')).toBe(
      'September 28, 2026',
    );
  });

  it('formats a spanish date with a tolerant pattern (CLDR month spelling can vary across ICU versions)', () => {
    const result = formatProjectDate(new Date('2026-09-23'), 'es');

    expect(result).toMatch(/^23 de \p{L}+\.? de 2026$/u);
  });

  // Tolerant oracle: the shared `es-419` tag (see `INTL_LOCALE_TAGS` in
  // `src/shared/i18n/locales.ts`) spells September "septiembre", unlike the `es-PE`
  // region override this module used to pin, which renders "setiembre" - see the T09b
  // entry in odd/tasks/portfolio-astro-rebuild.md. It asserts that spelling plus the
  // day and the year instead of the full string, because an ICU/CLDR update can reword
  // the rest of the pattern ("23 de septiembre de 2026" on Node v24.21.0, ICU 78.3).
  it('formats a spanish date with the shared es-419 tag, not the es-PE regionalism', () => {
    const result = formatProjectDate(new Date('2026-09-23'), 'es');

    expect(result).toContain('septiembre');
    expect(result).not.toContain('setiembre');
    expect(result).toContain('23');
    expect(result).toContain('2026');
  });

  // `z.coerce.date()` parses a bare "YYYY-MM-DD" frontmatter value (e.g. `date:
  // 2026-09-28`) as UTC midnight (per the ECMAScript Date Time String Format), so
  // formatting with the host's local timezone instead of a pinned UTC would silently
  // shift the displayed day for half the world's timezones - including the owner's own
  // "Lima, Peru" (UTC-5), where a naive local-time format renders this exact date as
  // "September 27, 2026" instead of the 28th.
  it('renders the exact calendar day from the frontmatter, not shifted by the host timezone', () => {
    vi.stubEnv('TZ', 'America/Lima'); // UTC-5: would roll the day back if not pinned to UTC
    expect(formatProjectDate(new Date('2026-09-28'), 'en')).toBe(
      'September 28, 2026',
    );

    vi.stubEnv('TZ', 'Pacific/Kiritimati'); // UTC+14: would roll the day forward instead
    expect(formatProjectDate(new Date('2026-09-28'), 'en')).toBe(
      'September 28, 2026',
    );
  });
});
