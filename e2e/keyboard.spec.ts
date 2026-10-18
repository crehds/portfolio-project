import type { Page } from '@playwright/test';

import { COPY } from './support/contact-copy';
import { expect, test } from './support/contact-test';

// What a visitor who never touches a mouse can do: reach every control in an order that
// follows the page, see where focus is, jump past the header, switch the theme and send a
// message. Axe cannot judge these (axe-matrix.spec.ts covers what it can). The contact form
// runs against the Turnstile stub the contact specs use: the real widget cannot load here.

interface Stop {
  /** Position of the element among all elements of the document, in tree order. */
  order: number;
  tag: string;
  /** What names it, for a failure message. */
  name: string;
  inFooter: boolean;
  ring: { style: string; width: number };
}

/** The element that has focus, described; null when focus is on the page itself. */
function focused(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) {
      return null;
    }
    const style = getComputedStyle(element);
    return {
      order: [...document.querySelectorAll('*')].indexOf(element),
      tag: element.tagName.toLowerCase(),
      name:
        element.getAttribute('aria-label') ??
        element.textContent?.trim().slice(0, 40) ??
        element.id,
      inFooter: element.closest('footer') !== null,
      ring: {
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
      },
    };
  });
}

/**
 * Presses Tab from the top of the page until focus leaves the document or goes back to an
 * element at or before the one it was on: the end of the page, however the browser wraps. A
 * page that traps focus never gets there, and the limit fails the test instead of hanging it.
 */
async function tabThrough(page: Page): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let press = 0; press < 150; press += 1) {
    await page.keyboard.press('Tab');
    const stop = await focused(page);
    if (stop === null || stop.order <= (stops.at(-1)?.order ?? -1)) {
      return stops;
    }
    stops.push(stop);
  }
  throw new Error(
    `Focus never left the page; the last stops were ${JSON.stringify(stops.slice(-5))}`,
  );
}

const pages = [
  '/',
  '/es/',
  '/projects/',
  '/projects/pysa/',
  '/es/skills/',
  '/contact/',
  '/no-such-page',
];

test.describe('tabbing through a page', () => {
  for (const path of pages) {
    test(`${path}: starts at the skip link, follows the page, shows the focus ring and ends in the footer`, async ({
      page,
    }) => {
      await page.goto(path);

      const stops = await tabThrough(page);

      // The skip link, the site name, the nav, the switchers, then the page and the footer.
      expect(stops.length).toBeGreaterThan(8);
      expect(stops[0]?.name).toMatch(/skip|saltar/i);
      // Each stop is later in the document than the one before (tabThrough ends at the first
      // that is not), so no control is out of order, which a positive `tabindex` would cause,
      // and focus is never trapped on the way to the footer.
      expect(stops.at(-1)?.inFooter).toBe(true);
      for (const stop of stops) {
        const label = `the ring of ${stop.tag} "${stop.name}"`;
        expect(stop.ring.style, label).toBe('solid');
        expect(stop.ring.width, label).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

test.describe('the skip link', () => {
  for (const L of COPY) {
    test(`is the first stop, shows itself when focused and moves focus to the main content (${L.lang})`, async ({
      page,
    }) => {
      await page.goto(L.path);
      const skipLink = page.locator('.skip-link');
      expect((await skipLink.boundingBox())!.y).toBeLessThan(0);

      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
      await expect
        .poll(async () => (await skipLink.boundingBox())!.y)
        .toBeGreaterThanOrEqual(0);

      await page.keyboard.press('Enter');
      await expect(page.locator('#main')).toBeFocused();
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(
          () => document.activeElement?.closest('main') !== null,
        ),
      ).toBe(true);
    });
  }
});

test.describe('the theme toggle', () => {
  for (const key of ['Enter', 'Space']) {
    test(`switches the theme with ${key}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      const toggle = page.locator('#theme-toggle');
      await toggle.focus();

      await page.keyboard.press(key);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toBeFocused();

      await page.keyboard.press(key);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });
  }

  test('is reached by tabbing from the top of the page', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('#theme-toggle');

    for (let press = 0; press < 20; press += 1) {
      await page.keyboard.press('Tab');
      if (await toggle.evaluate((el) => el === document.activeElement)) {
        return;
      }
    }
    throw new Error('Twenty Tab presses did not reach the theme toggle.');
  });
});

test.describe('the contact form, with the keyboard alone', () => {
  for (const L of COPY) {
    test(`is filled in, sent and followed to the success page (${L.lang})`, async ({
      page,
      marker,
    }) => {
      await page.goto(L.path);
      await page.getByLabel(L.name).focus();

      await page.keyboard.type('Ada Lovelace');
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(L.email)).toBeFocused();
      await page.keyboard.type('ada@example.com');
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(L.message)).toBeFocused();
      await page.keyboard.type(`Keyboard ${marker}`);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: L.submit })).toBeFocused();
      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(
        (url) => url.pathname + url.search === L.sentPath,
      );
      await expect(page.getByRole('status')).toContainText(L.sent);
    });

    test(`reports an empty form, and the links of its summary lead to the fields (${L.lang})`, async ({
      page,
    }) => {
      await page.goto(L.path);
      await page.getByRole('button', { name: L.submit }).focus();
      await page.keyboard.press('Enter');

      const summary = page.locator('#contact-error-summary');
      await expect(summary).toBeVisible();
      await summary.getByRole('link').first().focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel(L.name)).toBeFocused();
    });
  }
});
