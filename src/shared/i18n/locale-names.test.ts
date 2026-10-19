import { describe, expect, it } from 'vitest';

import { LOCALES } from './locales';
import { LOCALE_NAMES } from './locale-names';

describe('LOCALE_NAMES', () => {
  it('gives each locale its own endonym', () => {
    expect(LOCALE_NAMES).toEqual({ en: 'English', es: 'Español' });
  });

  it('has an entry for every supported locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeTruthy();
    }
  });
});
