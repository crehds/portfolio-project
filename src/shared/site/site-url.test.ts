import { describe, expect, it } from 'vitest';

import { SITE_URL } from './site-url';

describe('SITE_URL', () => {
  it('is an https origin: no path and no trailing slash', () => {
    // Pathnames start with a slash and are appended to it (`canonicalHref`,
    // `hreflangAlternates`), and Astro takes it as `site`, so a path or a trailing slash
    // would corrupt every absolute URL built from it.
    expect(new URL(SITE_URL).protocol).toBe('https:');
    expect(SITE_URL).toBe(new URL(SITE_URL).origin);
  });
});
