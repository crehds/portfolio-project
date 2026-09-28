import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';

import { localized } from './localized';

describe('localized', () => {
  it('accepts a value for every supported locale', () => {
    const schema = localized(z.string());

    const result = schema.parse({
      en: 'Full-stack web developer',
      es: 'Desarrollador web full-stack',
    });

    expect(result).toEqual({
      en: 'Full-stack web developer',
      es: 'Desarrollador web full-stack',
    });
  });

  it('rejects a value missing a locale', () => {
    const schema = localized(z.string());

    expect(() => schema.parse({ en: 'only English' })).toThrow();
  });

  it('rejects a value with the wrong inner type', () => {
    const schema = localized(z.string());

    expect(() => schema.parse({ en: 'ok', es: 42 })).toThrow();
  });
});
