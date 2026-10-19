import { describe, expect, it } from 'vitest';

import { LOCALES } from '../../shared/i18n/locales';
import { cvDownloadName, cvObjectKey, cvPath } from './cv-path';

describe('cvPath', () => {
  it('points each locale at its own download route', () => {
    expect(cvPath('en')).toBe('/cv/en.pdf');
    expect(cvPath('es')).toBe('/cv/es.pdf');
  });
});

describe('cvObjectKey', () => {
  it('names the bucket object after the locale', () => {
    expect(cvObjectKey('en')).toBe('en.pdf');
    expect(cvObjectKey('es')).toBe('es.pdf');
  });

  // The route is `/cv/[locale].pdf` and serves the object named `<locale>.pdf`, so the two
  // have to keep the same file name or the download route would look for a missing key.
  it('is the file name of the route path', () => {
    for (const locale of LOCALES) {
      expect(cvPath(locale).endsWith(`/${cvObjectKey(locale)}`)).toBe(true);
    }
  });
});

describe('cvDownloadName', () => {
  it('names the saved file after the owner and the locale', () => {
    expect(cvDownloadName('en')).toBe('Carlos-Rodriguez-Huerta-CV-EN.pdf');
    expect(cvDownloadName('es')).toBe('Carlos-Rodriguez-Huerta-CV-ES.pdf');
  });

  // The value goes inside a quoted `Content-Disposition` filename, so it must stay plain
  // ASCII with no quote, backslash, slash or control character to escape.
  it('stays plain ASCII so the header needs no escaping', () => {
    for (const locale of LOCALES) {
      expect(cvDownloadName(locale)).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });
});
