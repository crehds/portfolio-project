import { describe, expect, it } from 'vitest';

import { SITE_URL } from '../site/site-url';
import { buildRobotsTxt } from './robots-txt';

describe('buildRobotsTxt', () => {
  it('lets every crawler in and names the sitemap index on the site', () => {
    expect(buildRobotsTxt('https://example.com')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap-index.xml\n',
    );
  });

  it('reads a site with a trailing slash (`Astro.site.href`) the same way', () => {
    expect(buildRobotsTxt('https://example.com/')).toBe(
      buildRobotsTxt('https://example.com'),
    );
    expect(buildRobotsTxt('https://example.com/')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap-index.xml\n',
    );
  });

  it('builds the sitemap line from the configured site', () => {
    expect(buildRobotsTxt(SITE_URL)).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
    );
  });

  it('ends with one newline and keeps the blank line between the rules and the sitemap', () => {
    const lines = buildRobotsTxt(SITE_URL).split('\n');

    expect(lines).toHaveLength(5);
    expect(lines[2]).toBe('');
    expect(lines[4]).toBe('');
  });

  it('blocks nothing, the /cv/ routes included', () => {
    // The CV routes answer with `X-Robots-Tag: noindex`, and a crawler that is not allowed to
    // fetch a URL never sees that header: Google then keeps the URL indexable from links
    // alone. So no Disallow line, for /cv/, for the 404 pages or for anything else.
    expect(buildRobotsTxt(SITE_URL)).not.toMatch(/disallow/i);
  });

  it('refuses a site that is not an absolute URL, instead of writing a Sitemap line crawlers ignore', () => {
    // `Sitemap:` must be a fully qualified URL.
    expect(() => buildRobotsTxt('')).toThrow();
    expect(() => buildRobotsTxt('example.com')).toThrow();
  });
});
