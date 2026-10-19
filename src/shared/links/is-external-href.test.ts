import { describe, expect, it } from 'vitest';

import { isExternalHref } from './is-external-href';

describe('isExternalHref', () => {
  it.each([
    'https://github.com/crehds',
    'https://wa.me/51970791041',
    'http://example.com/',
    // The scheme is case-insensitive, and a browser reads it that way.
    'HTTPS://EXAMPLE.COM/',
  ])('treats the absolute http(s) URL %j as external', (href) => {
    expect(isExternalHref(href)).toBe(true);
  });

  it.each(['/cv/en.pdf', '/projects/', '/es/projects/pysa/', 'projects/pysa/'])(
    'treats the relative path %j as internal',
    (href) => {
      expect(isExternalHref(href)).toBe(false);
    },
  );

  it.each(['#main', '#'])('treats the fragment %j as internal', (href) => {
    expect(isExternalHref(href)).toBe(false);
  });

  // A mail client, a dialer or a script never opens in a tab of its own, so a new tab would
  // only stay blank behind them.
  it.each([
    'mailto:carlos15erh@gmail.com',
    'tel:+51970791041',
    'javascript:void(0)',
    'ftp://example.com/file.txt',
    'data:text/plain,hello',
  ])('does not treat the %j link as external', (href) => {
    expect(isExternalHref(href)).toBe(false);
  });

  // Only an absolute URL counts, so a protocol-relative one, which names a host but no
  // scheme, stays out as well.
  it.each(['', '   ', 'https://', '//example.com/'])(
    'does not treat %j as external: it is not an absolute URL',
    (href) => {
      expect(isExternalHref(href)).toBe(false);
    },
  );
});
