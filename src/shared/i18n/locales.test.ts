import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, INTL_LOCALE_TAGS, LOCALES, isLocale } from './locales';

describe('locales', () => {
  it('lists the supported locales with English first', () => {
    expect(LOCALES).toEqual(['en', 'es']);
  });

  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('recognizes supported locale strings', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
  });

  it('rejects unsupported or empty locale strings', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('')).toBe(false);
  });

  it('pins every locale to a neutral regional Intl tag, not a bare language subtag', () => {
    // `es-419` (Latin American Spanish), not a country-specific override like `es-PE`
    // (which renders September "setiembre" instead of "septiembre" - see
    // `format-project-date.test.ts` and the T09b entry in
    // odd/tasks/portfolio-astro-rebuild.md). Every date/number formatter in the
    // codebase must import this one map instead of pinning its own tag.
    expect(INTL_LOCALE_TAGS).toEqual({ en: 'en-US', es: 'es-419' });
  });
});
