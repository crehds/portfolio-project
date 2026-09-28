import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALES, isLocale } from './locales';

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
});
