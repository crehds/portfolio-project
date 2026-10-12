import { describe, expect, it } from 'vitest';

import { hreflangAlternates } from '../i18n/paths';
import { SITE_URL } from '../site/site-url';
import { withXDefaultAlternate } from './sitemap-alternates';

const SITE = 'https://example.com';

/**
 * What `@astrojs/sitemap` produces for a page that exists in both locales: the page's own
 * address and one alternate per locale. `page` is the address the entry is for.
 */
function entry(english: string, spanish: string, page = english, site = SITE) {
  return {
    url: `${site}${page}`,
    links: [
      { url: `${site}${english}`, lang: 'en' },
      { url: `${site}${spanish}`, lang: 'es' },
    ],
  };
}

describe('withXDefaultAlternate', () => {
  it('adds an x-default alternate that points at the default locale, after the locales', () => {
    const page = entry('/projects/pysa/', '/es/projects/pysa/');

    expect(withXDefaultAlternate(page, SITE).links).toEqual([
      { url: 'https://example.com/projects/pysa/', lang: 'en' },
      { url: 'https://example.com/es/projects/pysa/', lang: 'es' },
      { url: 'https://example.com/projects/pysa/', lang: 'x-default' },
    ]);
  });

  it('points the x-default of a Spanish page at its English page', () => {
    const page = entry('/skills/', '/es/skills/', '/es/skills/');

    expect(withXDefaultAlternate(page, SITE).links?.at(-1)).toEqual({
      url: 'https://example.com/skills/',
      lang: 'x-default',
    });
  });

  it('points the x-default of both home pages at the English home page', () => {
    for (const home of ['/', '/es/']) {
      const page = entry('/', '/es/', home);

      expect(withXDefaultAlternate(page, SITE).links?.at(-1), home).toEqual({
        url: 'https://example.com/',
        lang: 'x-default',
      });
    }
  });

  it('ends up with the alternates that the head of the page declares', () => {
    // The head renders `hreflangAlternates` as it is, so the sitemap has to say the same.
    for (const [english, spanish] of [
      ['/', '/es/'],
      ['/projects/', '/es/projects/'],
      ['/projects/pysa/', '/es/projects/pysa/'],
      ['/contact/', '/es/contact/'],
    ] as const) {
      for (const path of [english, spanish]) {
        const page = entry(english, spanish, path, SITE_URL);
        const head = hreflangAlternates(path, SITE_URL).map(
          ({ hreflang, href }) => ({ url: href, lang: hreflang }),
        );

        expect(withXDefaultAlternate(page, SITE_URL).links, path).toEqual(head);
      }
    }
  });

  it('reads a site with or without a trailing slash the same way', () => {
    const expected = [
      { url: 'https://example.com/projects/', lang: 'en' },
      { url: 'https://example.com/es/projects/', lang: 'es' },
      { url: 'https://example.com/projects/', lang: 'x-default' },
    ];

    for (const site of [SITE, `${SITE}/`]) {
      const page = entry('/projects/', '/es/projects/');

      expect(withXDefaultAlternate(page, site).links, site).toEqual(expected);
    }
  });

  it('keeps every other field, and leaves the entry it was given alone', () => {
    const page = {
      ...entry('/projects/', '/es/projects/'),
      lastmod: '2026-10-11T00:00:00.000Z',
      changefreq: 'weekly',
      priority: 0.7,
    };
    const before = structuredClone(page);

    expect(withXDefaultAlternate(page, SITE)).toMatchObject({
      url: 'https://example.com/projects/',
      lastmod: '2026-10-11T00:00:00.000Z',
      changefreq: 'weekly',
      priority: 0.7,
    });
    expect(page).toEqual(before);
  });

  it('adds it once, however many times it is applied', () => {
    const once = withXDefaultAlternate(entry('/skills/', '/es/skills/'), SITE);
    const twice = withXDefaultAlternate(once, SITE);

    expect(twice).toEqual(once);
    expect(
      twice.links?.filter(({ lang }) => lang === 'x-default'),
    ).toHaveLength(1);
  });

  it('leaves a page with no alternates as it is: a lone x-default would say nothing', () => {
    expect(
      withXDefaultAlternate({ url: 'https://example.com/contact/' }, SITE),
    ).toEqual({ url: 'https://example.com/contact/' });
    expect(
      withXDefaultAlternate(
        { url: 'https://example.com/contact/', links: [] },
        SITE,
      ),
    ).toEqual({ url: 'https://example.com/contact/', links: [] });
  });
});
