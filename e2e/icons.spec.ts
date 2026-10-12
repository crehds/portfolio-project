import { expect, test } from '@playwright/test';

import { COPY } from './support/contact-copy';

// The icons of the site (public/, drawn by scripts/icons) and the tint of the browser around it
// (`theme-color`). The unit tests prove the markup and tie the colors to the tokens
// (base-layout.test.ts, src/styles/icons.test.ts); this spec proves that the built site links
// them from every page and that the server answers each file as the kind of file it is.
//
// Spelled out here, not imported, like the expectations of the other specs.

const PAGES = [
  ...['', '/es'].flatMap((prefix) =>
    ['/', '/projects/', '/experience/', '/skills/'].map((path) =>
      path === '/' && prefix ? `${prefix}/` : `${prefix}${path}`,
    ),
  ),
  '/projects/pysa/',
  '/es/projects/pysa/',
  ...COPY.map(({ path }) => path),
  // The error pages carry them too: a visitor who lands on a 404 still gets the tab icon.
  '/404',
  '/es/404/',
  '/no-such-page',
  '/es/no-such-page',
];

const ICONS = [
  {
    selector: 'link[rel="icon"][href="/favicon.ico"]',
    path: '/favicon.ico',
    mediaType: /^image\/(?:x-icon|vnd\.microsoft\.icon)\b/,
  },
  {
    selector: 'link[rel="icon"][href="/icon.svg"][type="image/svg+xml"]',
    path: '/icon.svg',
    mediaType: /^image\/svg\+xml\b/,
  },
  {
    selector: 'link[rel="apple-touch-icon"][href="/apple-touch-icon.png"]',
    path: '/apple-touch-icon.png',
    mediaType: /^image\/png\b/,
  },
];

test.describe('icon files', () => {
  for (const { path, mediaType } of ICONS) {
    test(`${path} is served with the right media type`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(mediaType);
      expect((await response.body()).length).toBeGreaterThan(0);
    });
  }

  test('the touch icon is 180x180 and the .ico holds a 32 and a 48 pixel picture', async ({
    request,
  }) => {
    const png = await (await request.get('/apple-touch-icon.png')).body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);

    const ico = await (await request.get('/favicon.ico')).body();
    expect([ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([1, 2]);
    expect([ico.readUInt8(6), ico.readUInt8(6 + 16)]).toEqual([32, 48]);
  });
});

test.describe('head of every page', () => {
  for (const path of PAGES) {
    test(`${path} links the three icons and sets one theme-color per scheme`, async ({
      page,
    }) => {
      await page.goto(path);

      for (const { selector } of ICONS) {
        await expect(page.locator(selector), selector).toHaveCount(1);
      }
      // The .ico names its size, so a browser that reads the SVG takes that one.
      await expect(
        page.locator('link[rel="icon"][href="/favicon.ico"]'),
      ).toHaveAttribute('sizes', '32x32');

      const tints = await page
        .locator('meta[name="theme-color"]')
        .evaluateAll((tags) =>
          tags.map((tag) => [
            tag.getAttribute('media'),
            tag.getAttribute('content'),
          ]),
        );
      expect(tints).toEqual([
        ['(prefers-color-scheme: light)', '#faf9f5'],
        ['(prefers-color-scheme: dark)', '#161a17'],
      ]);
    });
  }
});
