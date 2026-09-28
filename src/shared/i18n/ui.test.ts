import { describe, expect, it } from 'vitest';

import { LOCALES } from './locales';
import { getDictionary } from './ui';

describe('getDictionary', () => {
  it('has the same keys for every locale', () => {
    const [reference, ...rest] = LOCALES.map((locale) =>
      Object.keys(getDictionary(locale)).sort(),
    );

    for (const keys of rest) {
      expect(keys).toEqual(reference);
    }
  });

  it('has a non-empty string for every key in every locale', () => {
    for (const locale of LOCALES) {
      const dictionary = getDictionary(locale);

      for (const [key, value] of Object.entries(dictionary)) {
        expect(typeof value, `${locale}.${key}`).toBe('string');
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('returns the expected english strings', () => {
    expect(getDictionary('en')).toEqual({
      siteTitle: 'Carlos Rodríguez Huerta',
      siteDescription:
        'Portfolio of Carlos Rodríguez Huerta, full-stack web developer. Rebuild in progress.',
      rebuildNotice: 'Portfolio rebuild in progress.',
      languageSwitcherLabel: 'Language switcher',
    });
  });

  it('returns the expected spanish strings', () => {
    expect(getDictionary('es')).toEqual({
      siteTitle: 'Carlos Rodríguez Huerta',
      siteDescription:
        'Portafolio de Carlos Rodríguez Huerta, desarrollador web full-stack. Reconstrucción en curso.',
      rebuildNotice: 'Portafolio en reconstrucción.',
      languageSwitcherLabel: 'Selector de idioma',
    });
  });
});
