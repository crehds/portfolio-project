import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';

import { SITE_URL } from '../src/shared/site/site-url';
import { expect, test } from './support/csp-guard';

// Axe over every page the site publishes, in both locales and both color schemes. The list is
// read from the built sitemap (`dist/client/sitemap-0.xml`), so a page added later is covered
// without touching this file; the 404 pages are not in a sitemap and are named here. The
// contact page is checked in its plain state; contact-a11y.spec.ts covers its other states.
//
// The scheme is set by emulating `prefers-color-scheme`, the way a visitor's OS sets it: with
// nothing stored, the site's theme script follows the OS (theme.spec.ts), so this takes the
// same path as a real visit and needs no storage seeding. Each test asserts that `data-theme`
// really took the emulated value, so a run cannot pass while checking the wrong scheme.

const SITEMAP = fileURLToPath(
  new URL('../dist/client/sitemap-0.xml', import.meta.url),
);

/** The path of every `<loc>` in the built sitemap. */
const sitemapPaths = [
  ...readFileSync(SITEMAP, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
].map(([, loc = '']) => loc.replace(SITE_URL, ''));

// An address with no page behind it answers 404 with the error page of its locale
// (not-found.spec.ts).
const notFoundPaths = ['/no-such-page', '/es/no-such-page'];

const pages = [...sitemapPaths, ...notFoundPaths];

test.describe('the pages to check', () => {
  test('come from the sitemap and include the known routes', () => {
    expect(sitemapPaths).toEqual(
      expect.arrayContaining(['/', '/es/', '/contact/', '/es/contact/']),
    );
    expect(sitemapPaths.every((path) => path.startsWith('/'))).toBe(true);
    expect(new Set(pages).size).toBe(pages.length);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe on every page (${colorScheme})`, () => {
    for (const path of pages) {
      test(`${path} has no detectable accessibility violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme,
        );

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }
  });
}
