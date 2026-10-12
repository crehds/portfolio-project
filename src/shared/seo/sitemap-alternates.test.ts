import { afterEach, describe, expect, it, vi } from 'vitest';

import { hreflangAlternates } from '../i18n/paths';
import { SITE_URL } from '../site/site-url';
import { withXDefaultAlternate } from './sitemap-alternates';

// The head's rule is the real one in every test but one: it is wrapped, not replaced, so that
// the test can make it answer without an `x-default`, which the real rule never does. The spy
// is reset after each test (below), so that answer cannot outlive the test that set it.
vi.mock('../i18n/paths', async (importOriginal) => {
  const paths = await importOriginal<typeof import('../i18n/paths')>();

  return { ...paths, hreflangAlternates: vi.fn(paths.hreflangAlternates) };
});

afterEach(() => {
  // `mockReset` puts the wrapped rule back as the implementation and drops any answer that a
  // test queued with `mockReturnValueOnce` and did not use.
  vi.mocked(hreflangAlternates).mockReset();
});

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

  it('refuses an entry whose head would declare no x-default, instead of writing one that disagrees with the head', () => {
    // The real rule always ends its answer with an `x-default`; this stands in for a change
    // that breaks that. Taking the entry as it is would publish a sitemap the page head
    // contradicts, so the build fails and names the page.
    vi.mocked(hreflangAlternates).mockReturnValueOnce([
      { hreflang: 'en', href: 'https://example.com/projects/' },
      { hreflang: 'es', href: 'https://example.com/es/projects/' },
    ]);

    expect(() =>
      withXDefaultAlternate(entry('/projects/', '/es/projects/'), SITE),
    ).toThrow(
      'The page head has no x-default alternate for https://example.com/projects/.',
    );
  });
});
