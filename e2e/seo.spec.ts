import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { SITE_URL } from '../src/shared/i18n/locales';
import { COPY } from './support/contact-copy';

// What a search engine is told about every address of the site (T12): which URL is the page's
// own, and which pages stay out of the index. The unit tests (paths.test.ts, base-layout.test.ts)
// prove the rules; this spec proves them in the built site, page by page, in both locales.
//
// The test server answers on localhost, and the canonical link names the production host: the
// link is built from the configured site, never from the address the page was reached on.

type Lang = 'en' | 'es';

/** An address in a locale: English is unprefixed, Spanish lives under `/es/`. */
function inLang(lang: Lang, path: string): string {
  return lang === 'en' ? path : `/es${path}`;
}

const LANGS: readonly Lang[] = ['en', 'es'];

// The published projects, as in projects-list.spec.ts. The drafts have no page.
const PUBLISHED_PROJECT_SLUGS = [
  'expresion-latina',
  'pysa',
  'game-with-keyboard',
  'bachatealo',
];

// Home, the three section pages and one page per published project, in each locale: the pages
// that are static files in the build. The contact pages run on demand (the form posts to them),
// so the build has no file for them; COPY has their addresses.
const PRERENDERED = LANGS.flatMap((lang) =>
  [
    '/',
    '/projects/',
    '/experience/',
    '/skills/',
    ...PUBLISHED_PROJECT_SLUGS.map((slug) => `/projects/${slug}/`),
  ].map((path) => ({ lang, path: inLang(lang, path) })),
);

const ON_DEMAND = COPY.map(({ lang, path }) => ({ lang, path }));

const PAGES = [...PRERENDERED, ...ON_DEMAND];

// The 404 pages are built like any other page but are not indexable (see below). `404.html` is
// not a folder index, so only the Spanish one needs to be named.
const BUILT_ERROR_PAGES = ['/es/404/'];

const DIST_CLIENT = new URL('../dist/client/', import.meta.url);

/** The address of every folder index in the build, but the error pages', sorted. */
function prerenderedPathsInBuild(): string[] {
  return readdirSync(DIST_CLIENT, { recursive: true, encoding: 'utf8' })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
    .map((file) => `/${file.slice(0, -'index.html'.length)}`)
    .filter((path) => !BUILT_ERROR_PAGES.includes(path))
    .sort();
}

test.describe('the pages this spec checks', () => {
  // The checks below are table-driven, so a page that is missing from the table is a page that
  // is not checked. Reading the build is what keeps the table honest: a page added to or removed
  // from the site, or dropped from the table by mistake, fails here instead of going unseen.
  test('are every indexable page of the site, in both locales', () => {
    expect(prerenderedPathsInBuild()).toEqual(
      PRERENDERED.map(({ path }) => path).sort(),
    );
    // 16 static pages and the 2 contact pages.
    expect(PAGES).toHaveLength(18);
  });
});

test.describe('canonical link', () => {
  for (const { lang, path } of PAGES) {
    test(`${path} has one, its own address on the site, and no robots meta`, async ({
      page,
    }) => {
      await page.goto(path);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', `${SITE_URL}${path}`);
      // It names the page's own hreflang alternate, so the two never disagree.
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
      ).toHaveAttribute('href', `${SITE_URL}${path}`);
      // An indexable page must not ask to be left out.
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }

  for (const { lang, path, sentPath } of COPY) {
    test(`${sentPath} leaves the query out (${lang})`, async ({ page }) => {
      const response = await page.goto(sentPath);

      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).search).toBe('?sent=1');
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', `${SITE_URL}${path}`);
    });
  }
});

// The 404 pages answer 200 at `/404` and `/es/404/` (plain assets), and 404 at every other
// address: either way they are not pages to index, and they have no address of their own to
// call canonical.
test.describe('error pages', () => {
  for (const { lang, path } of [
    { lang: 'en', path: '/404' },
    { lang: 'es', path: '/es/404/' },
    { lang: 'en', path: '/no-such-page' },
    { lang: 'es', path: '/es/no-such-page' },
  ] as const) {
    test(`${path} asks not to be indexed and has no canonical link`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveCount(1);
      await expect(robots).toHaveAttribute('content', 'noindex');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    });
  }
});
